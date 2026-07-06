import os
import json
import asyncio
import logging
from redis import Redis
from app.services.transcription import TranscriptionService
# from app.services.storage import get_storage_service (if needed in future)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def is_cancelled(project_id: int) -> bool:
    """Check if project was cancelled via Redis flag."""
    try:
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        r = Redis.from_url(redis_url)
        return r.exists(f"cancel:{project_id}") > 0
    except Exception:
        return False



def _publish_status(project_id: int, status: str, message: str, progress: int = 0):
    """Helper to publish status to Redis for WebSockets."""
    try:
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        redis_client = Redis.from_url(redis_url)
        payload = json.dumps({
            "project_id": project_id,
            "status": status, 
            "message": message, 
            "progress": progress
        })
        redis_client.xadd("stream:events:progress", {"payload": payload})
    except Exception as e:
        logger.error(f"Failed to publish status to Redis: {e}")

async def run_process_video(project_id: int, file_path: str, prompt: str, pre_extracted_audio: str = None, proxy_path: str = None) -> None:
    """Async task executor implementing the DB-less AI pipeline."""
    logger.info(f"Starting processing pipeline for project {project_id}")
    
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    r = Redis.from_url(redis_url)

    _publish_status(project_id, "transcribing", "Extracting audio from video...", 10)

    transcript_file = f"{file_path}.transcript.json"
    audio_path = None
    
    try:
        transcription_service = TranscriptionService(model_size="base", device="cuda")

        if is_cancelled(project_id):
            logger.info(f"Project {project_id} cancelled before transcription.")
            return

        if os.path.exists(transcript_file):
            logger.info("Found existing transcription. Skipping Faster-Whisper!")
            _publish_status(project_id, "transcribing", "Carregando transcrição existente (Rápido)...", 20)
            with open(transcript_file, "r", encoding="utf-8") as f:
                segments = json.load(f)
        else:
            if pre_extracted_audio and os.path.exists(pre_extracted_audio):
                logger.info(f"Using pre-extracted audio: {pre_extracted_audio}")
                audio_path = pre_extracted_audio
                # Do NOT delete this file in finally block since Go might need it or manage it
                should_cleanup_audio = False
            else:
                logger.info(f"Extracting audio from: {file_path}")
                audio_path = transcription_service.extract_audio(file_path)
                should_cleanup_audio = True

            logger.info("Generating transcription with Faster-Whisper...")
            _publish_status(project_id, "transcribing", "Transcribing audio (this may take a while)...", 20)
            segments = transcription_service.transcribe_audio(audio_path)

            if not segments:
                raise ValueError("Transcription returned no segments. Audio might be empty.")
                
            # Cache the transcription
            with open(transcript_file, "w", encoding="utf-8") as f:
                json.dump(segments, f, ensure_ascii=False)
                
        # Force garbage collection of VRAM before starting LLM
        transcription_service.unload_model()

        if is_cancelled(project_id):
            logger.info(f"Project {project_id} cancelled after transcription.")
            return

        duration = segments[-1]["end"]
        
        logger.info(f"Finding best moments using Intelligent Pipeline with Prompt: '{prompt}'...")
        from app.services.llm import LLMService
        from app.services.clip_scoring_service import ClipScoringService
        from app.services.subtitle import SubtitleService
        
        llm_service = LLMService(model="llama3")
        scoring_service = ClipScoringService(llm_service=llm_service)

        logger.info(f"Parsing User Command with LLM: '{prompt}'...")
        _publish_status(project_id, "analyzing", "A IA está interpretando o seu pedido de edição...", 40)
        command_config = llm_service.parse_user_command(prompt)
        
        # Override with explicit prompt instructions to prevent LLM hallucinations
        import re
        duration_match = re.search(r"duration_request:\s*([\d.]+)\s*minutes", prompt)
        if duration_match:
            try:
                mins = float(duration_match.group(1))
                secs = mins * 60.0
                command_config.min_duration = secs
                command_config.max_duration = secs
                logger.info(f"Regex override: duration set to {secs}s")
            except ValueError:
                pass
                
        qty_match = re.search(r"clip_quantity:\s*(\d+)", prompt)
        if qty_match:
            try:
                command_config.clip_count = int(qty_match.group(1))
                logger.info(f"Regex override: clip_count set to {command_config.clip_count}")
            except ValueError:
                pass

        
        import hashlib
        cache_key = f"{command_config.topic_focus}_{command_config.min_duration}_{command_config.max_duration}_{command_config.clip_count}_{'FULL' if 'FULL_VIDEO_EDIT' in prompt else ''}_{'MANUAL' if 'MANUAL CUT' in prompt else ''}_{prompt.count('from ')}"
        cache_hash = hashlib.md5(cache_key.encode()).hexdigest()
        moments_file = f"{file_path}.moments_{cache_hash}.json"

        viral_moments = []
        if os.path.exists(moments_file):
            logger.info("Found cached viral moments! Skipping scoring pipeline.")
            _publish_status(project_id, "analyzing", "Carregando momentos previamente analisados pela IA (Rápido)...", 70)
            with open(moments_file, "r", encoding="utf-8") as f:
                viral_moments = json.load(f)
        else:
            if "MANUAL CUT" in prompt and command_config.manual_timestamps and len(command_config.manual_timestamps) > 0:
                logger.info("Manual timestamps provided! Bypassing Semantic Scoring.")
                _publish_status(project_id, "analyzing", "Tempos manuais detectados. Pulando busca de IA...", 50)
                for t_range in command_config.manual_timestamps:
                    if isinstance(t_range, list) and len(t_range) >= 2:
                        start_val, end_val = float(t_range[0]), float(t_range[1])
                        if start_val < end_val:
                            viral_moments.append({"start_time": start_val, "end_time": end_val, "viral_score": 100.0, "title": "Corte Manual", "description": "Corte manual pelo usuário"})
            
            if "FULL_VIDEO_EDIT" in prompt:
                logger.info("Full Video Edit requested. Bypassing Semantic Scoring.")
                _publish_status(project_id, "analyzing", "Modo Edição Normal detectado. Aplicando estilo ao vídeo completo...", 50)
                viral_moments.append({
                    "start_time": 0.0, 
                    "end_time": duration, 
                    "viral_score": 100.0, 
                    "title": "Vídeo Completo", 
                    "description": "Edição do vídeo original na íntegra (legendas e silêncios)"
                })
                
            if not viral_moments:
                if is_cancelled(project_id):
                    logger.info(f"Project {project_id} cancelled before segmentation.")
                    return
                logger.info("Segmenting transcript into blocks...")
                _publish_status(project_id, "analyzing", f"Analisando texto e quadros do vídeo visualmente...", 50)
                blocks = scoring_service.segment_transcript(segments, block_size=15.0)
                
                logger.info("Scoring blocks with text and visual analysis...")
                video_for_analysis = proxy_path if proxy_path and os.path.exists(proxy_path) else file_path
                scored_blocks = scoring_service.score_blocks(blocks, topic_focus=command_config.topic_focus, video_path=video_for_analysis)
                
                logger.info("Merging and selecting best clips...")
                
                # Extract previously generated clips from prompt to avoid duplicates
                import re
                previous_clips = []
                for match in re.finditer(r"from ([\d.]+)s to ([\d.]+)s", prompt):
                    try:
                        prev_start = float(match.group(1))
                        prev_end = float(match.group(2))
                        previous_clips.append((prev_start, prev_end))
                    except ValueError:
                        pass
                
                viral_moments = scoring_service.merge_blocks(
                    scored_blocks, 
                    min_duration=command_config.min_duration, 
                    max_duration=command_config.max_duration, 
                    top_k=command_config.clip_count,
                    previous_clips=previous_clips
                )
                
                if not viral_moments:
                    logger.warning(f"Pipeline returned no viral moments. Creating a default clip.")
                    viral_moments = [{"start_time": 0.0, "end_time": min(command_config.min_duration, duration), "viral_score": 50.0}]

            # Save to cache
            with open(moments_file, "w", encoding="utf-8") as f:
                json.dump(viral_moments, f, ensure_ascii=False)

        logger.info(f"Queuing {len(viral_moments)} video cuts for Render Engine...")
        _publish_status(project_id, "analyzing", f"Criando plano de edição para {len(viral_moments)} cortes...", 80)
        
        subtitle_service = SubtitleService()
        total_clips = len(viral_moments)
        
        clips_metadata = []
        render_jobs = []

        # Extract requested formats from prompt
        import re
        formats_match = re.search(r"video_formats:\s*([\d:,\s]+)", prompt)
        requested_formats = []
        if formats_match:
            raw_formats = formats_match.group(1).split(",")
            requested_formats = [f.strip() for f in raw_formats if f.strip()]
        if not requested_formats:
            requested_formats = [command_config.video_format]

        for i, moment in enumerate(viral_moments):
            start = float(moment.get("start_time", 0.0))
            end = float(moment.get("end_time", min(start + command_config.min_duration, duration)))
            
            if end - start < command_config.min_duration:
                end = min(start + command_config.min_duration, duration)
            
            score = float(moment.get("viral_score", 0.0))
            
            subtitle_filename = file_path.replace(".mp4", f"_clip_{i+1}.ass")
            
            clip_words = []
            for seg in segments:
                if seg["start"] <= end and seg["end"] >= start:
                    for word in seg.get("words", []):
                        if word["start"] >= start and word["end"] <= end:
                            clip_words.append(word)
            
            subtitle_path = ""
            if command_config.subtitle_style.lower() != "none":
                subtitle_path = subtitle_filename if subtitle_service.generate_ass_file(clip_words, start, subtitle_filename, command_config.subtitle_style) else ""
            
            keep_segments = []
            if command_config.remove_silences and clip_words:
                current_start = clip_words[0]["start"]
                current_end = clip_words[0]["end"]
                
                for w in clip_words[1:]:
                    gap = w["start"] - current_end
                    if gap > 0.5:
                        keep_segments.append([current_start, current_end])
                        current_start = w["start"]
                    current_end = w["end"]
                keep_segments.append([current_start, current_end])

            clip_title = moment.get("title", f"Clip {i+1}")
            clip_desc = moment.get("description", f"Corte gerado por IA focado em {command_config.topic_focus}")

            operations = []
            clip_op = {
                "type": "clip",
                "start": start,
                "end": end,
                "score": score,
                "title": clip_title,
                "description": clip_desc
            }
            if keep_segments:
                clip_op["keep_segments"] = keep_segments
                
            operations.append(clip_op)

            if subtitle_path:
                operations.append({
                    "type": "subtitle",
                    "file": subtitle_path,
                    "style": command_config.subtitle_style
                })

            for v_format in requested_formats:
                formatted_title = f"[{v_format}] {clip_title}"
                # Duplicate operations to change title in metadata
                ops_copy = []
                for op in operations:
                    op_copy = op.copy()
                    if op_copy.get("type") == "clip":
                        op_copy["title"] = formatted_title
                    ops_copy.append(op_copy)

                edit_plan = {
                    "project_id": project_id,
                    "original_file": file_path,
                    "video_format": v_format,
                    "remove_noise": command_config.remove_noise,
                    "operations": ops_copy
                }
                render_jobs.append(edit_plan)

                clips_metadata.append({
                    "title": formatted_title,
                    "description": clip_desc,
                    "score": score,
                    "start_time": start,
                    "end_time": end
                })

        # Emite os metadados dos clipes para o Go salvar no banco antes de mandar pro render
        clips_payload = json.dumps({
            "project_id": project_id,
            "clips": clips_metadata
        })
        r.xadd("stream:events:clips_ready", {"payload": clips_payload})

        # Envia os jobs para o render engine
        for plan in render_jobs:
            r.xadd("stream:render", {"payload": json.dumps(plan)})

        logger.info(f"Project {project_id} successfully processed and queued for rendering!")
        _publish_status(project_id, "rendering", "Plano de edição enviado para renderização na GPU...", 85)

    except Exception as e:
        logger.exception(f"Error processing project {project_id}: {str(e)}")
        # Publish to events:failed
        payload = json.dumps({"project_id": project_id, "status": "failed", "error": str(e)})
        Redis.from_url(redis_url).xadd("stream:events:failed", {"payload": payload})
    finally:
        # Cleanup temporary audio file
        if should_cleanup_audio and audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup {audio_path}: {cleanup_error}")

async def run_transcribe_video(project_id: int, file_path: str) -> None:
    logger.info(f"Starting standalone transcription for project {project_id}")
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    r = Redis.from_url(redis_url)

    _publish_status(project_id, "transcribing", "Extraindo áudio e legendas...", 10)
    transcript_file = f"{file_path}.transcript.json"
    audio_path = None

    try:
        if os.path.exists(transcript_file):
            logger.info("Found existing transcription. Skipping Faster-Whisper!")
            _publish_status(project_id, "transcribing", "Carregando transcrição existente (Rápido)...", 50)
            with open(transcript_file, "r", encoding="utf-8") as f:
                segments = json.load(f)
        else:
            from app.services.transcription import TranscriptionService
            transcription_service = TranscriptionService(model_size="base", device="cuda")
            
            # Check for globally cached audio from Go
            global_audio = file_path.replace(os.path.splitext(file_path)[1], "_audio.wav")
            should_cleanup_audio = True

            if os.path.exists(global_audio):
                logger.info(f"Using globally cached audio: {global_audio}")
                audio_path = global_audio
                should_cleanup_audio = False
            else:
                logger.info(f"Extracting audio from: {file_path}")
                audio_path = transcription_service.extract_audio(file_path)

            logger.info("Generating transcription with Faster-Whisper...")
            _publish_status(project_id, "transcribing", "Transcrevendo áudio com Whisper...", 30)
            segments = transcription_service.transcribe_audio(audio_path)

            if not segments:
                raise ValueError("Transcription returned no segments.")
                
            with open(transcript_file, "w", encoding="utf-8") as f:
                json.dump(segments, f, ensure_ascii=False)

        # Notify Go Backend
        payload = json.dumps({
            "project_id": project_id,
            "transcript": segments
        })
        r.xadd("stream:events:transcript_ready", {"payload": payload})
        
        _publish_status(project_id, "idle", "Transcrição concluída!", 100)

    except Exception as e:
        logger.exception(f"Error in transcribe for project {project_id}: {str(e)}")
        _publish_status(project_id, "failed", f"Erro na transcrição: {str(e)}")
    finally:
        if should_cleanup_audio and audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup {audio_path}: {cleanup_error}")

async def run_render_custom(project_id: int, file_path: str, style_config: dict) -> None:
    logger.info(f"Starting custom render for project {project_id}")
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    r = Redis.from_url(redis_url)

    try:
        _publish_status(project_id, "processing", "Preparando renderização...", 10)
        
        # Read the customized transcript (it should have been saved by Go)
        transcript_file = f"{file_path}.transcript.json"
        if not os.path.exists(transcript_file):
            raise FileNotFoundError("Transcript not found for custom render")
            
        with open(transcript_file, "r", encoding="utf-8") as f:
            segments = json.load(f)
            
        # We need to flatten segments into words for SubtitleService
        words = []
        for segment in segments:
            if "words" in segment:
                for w in segment["words"]:
                    words.append({"start": w["start"], "end": w["end"], "word": w["word"]})
            else:
                # Fallback if there are no word-level timestamps, just use the whole segment
                words.append({"start": segment["start"], "end": segment["end"], "word": segment["text"]})

        from app.services.subtitle import SubtitleService
        subtitle_service = SubtitleService()
        
        # We save the ASS file in the same directory
        ass_output_path = f"{file_path}.custom.ass"
        
        # Custom logic in SubtitleService will be called here
        subtitle_style = style_config.get("subtitle_style", "default")
        primary_color = style_config.get("primary_color")
        font_size = style_config.get("font_size")
        animation = style_config.get("animation")
        
        # For now, pass style_name. We'll modify generate_ass_file to accept more args soon.
        subtitle_service.generate_ass_file(
            words=words, 
            clip_start=0.0, 
            output_path=ass_output_path, 
            style_name=subtitle_style,
            primary_color=primary_color,
            font_size=font_size,
            animation=animation
        )

        ops = [{
            "operation_type": "add_subtitles",
            "file": ass_output_path
        }]
        
        video_format = style_config.get("video_format", "16:9")

        edit_plan = {
            "project_id": project_id,
            "original_file": file_path,
            "video_format": video_format,
            "remove_noise": style_config.get("remove_noise", False),
            "operations": ops
        }

        r.xadd("stream:render", {"payload": json.dumps(edit_plan)})
        
        _publish_status(project_id, "rendering", "Enviado para renderização...", 85)

    except Exception as e:
        logger.exception(f"Error in custom render for project {project_id}: {str(e)}")
        _publish_status(project_id, "failed", f"Erro no render: {str(e)}")
