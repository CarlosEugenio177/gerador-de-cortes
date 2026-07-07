import os
import json
import asyncio
import logging
from redis import Redis
from app.services.transcription import TranscriptionService
# from app.services.storage import get_storage_service (if needed in future)

from tenacity import retry, wait_exponential, stop_after_attempt
from app.utils.logger import get_structured_logger

logger = get_structured_logger("tasks")

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

async def _generate_thumbnail(video_path: str, output_path: str):
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", video_path, "-ss", "00:00:01.000", "-vframes", "1", output_path,
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
        )
        await proc.wait()
    except Exception as e:
        logger.warning(f"Failed to generate thumbnail: {e}")

async def _generate_waveform(audio_path: str, output_path: str):
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", audio_path, "-filter_complex", "showwavespic=s=640x120", "-frames:v", "1", output_path,
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
        )
        await proc.wait()
    except Exception as e:
        logger.warning(f"Failed to generate waveform: {e}")

async def run_process_video(project_id: int, file_path: str, prompt: str, pre_extracted_audio: str = None, proxy_path: str = None) -> None:
    """Async task executor implementing the DB-less AI pipeline."""
    logger.info("Starting processing pipeline", extra={"project_id": project_id})
    
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    r = Redis.from_url(redis_url)

    _publish_status(project_id, "TRANSCRIBING", "Preparando mídias (Áudio, Thumbnails)...", 10)

    transcript_file = f"{file_path}.transcript.json"
    audio_path = None
    should_cleanup_audio = False

    try:
        transcription_service = TranscriptionService(model_size="base", device="cuda")

        if is_cancelled(project_id):
            logger.info("Project cancelled before transcription.", extra={"project_id": project_id})
            return

        # Wrapper functions to apply tenacity since we don't want to modify transcription.py right now
        @retry(wait=wait_exponential(multiplier=1, min=4, max=10), stop=stop_after_attempt(3))
        def _safe_extract(path):
            return transcription_service.extract_audio(path)

        @retry(wait=wait_exponential(multiplier=1, min=4, max=10), stop=stop_after_attempt(3))
        def _safe_transcribe(path):
            return transcription_service.transcribe_audio(path)

        if pre_extracted_audio and os.path.exists(pre_extracted_audio):
            logger.info("Using pre-extracted audio", extra={"project_id": project_id, "stage": "audio_extract"})
            audio_path = pre_extracted_audio
            should_cleanup_audio = False
        else:
            logger.info("Extracting audio from video...", extra={"project_id": project_id, "stage": "audio_extract"})
            audio_path = await asyncio.to_thread(_safe_extract, file_path)
            should_cleanup_audio = True

        # Dispatch parallel tasks for media assets
        thumb_path = f"{file_path}.thumb.jpg"
        wave_path = f"{file_path}.waveform.png"
        logger.info("Dispatching parallel thumbnail and waveform generation", extra={"project_id": project_id})
        await asyncio.gather(
            _generate_thumbnail(file_path, thumb_path),
            _generate_waveform(audio_path, wave_path)
        )

        if os.path.exists(transcript_file):
            logger.info("Found existing transcription. Skipping Faster-Whisper!", extra={"project_id": project_id})
            _publish_status(project_id, "TRANSCRIBING", "Carregando transcrição existente (Rápido)...", 20)
            with open(transcript_file, "r", encoding="utf-8") as f:
                segments = json.load(f)
        else:
            logger.info("Generating transcription with Faster-Whisper...", extra={"project_id": project_id, "stage": "whisper"})
            _publish_status(project_id, "TRANSCRIBING", "Transcrevendo áudio (this may take a while)...", 20)
            segments = await asyncio.to_thread(_safe_transcribe, audio_path)

            if not segments:
                raise ValueError("Transcription returned no segments. Audio might be empty.")
                
            # Cache the transcription
            with open(transcript_file, "w", encoding="utf-8") as f:
                json.dump(segments, f, ensure_ascii=False)
                
        _publish_status(project_id, "TRANSCRIBED", "Transcrição finalizada.", 30)
                
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

        logger.info(f"Parsing User Command with LLM: '{prompt}'...", extra={"project_id": project_id, "stage": "llm_parsing"})
        _publish_status(project_id, "ANALYZING", "A IA está interpretando o seu pedido de edição...", 40)
        
        @retry(wait=wait_exponential(multiplier=2, min=5, max=20), stop=stop_after_attempt(5))
        def _safe_parse_command(p):
            return llm_service.parse_user_command(p)
            
        command_config = _safe_parse_command(prompt)
        
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
                
                def progress_cb(current, total):
                    # Progress from 50% to 80%
                    if total > 0:
                        percent = 50 + int((current / total) * 30)
                        _publish_status(project_id, "ANALYZING", f"Analisando visualmente bloco {current+1} de {total}...", percent)

                @retry(wait=wait_exponential(multiplier=2, min=5, max=20), stop=stop_after_attempt(5))
                def _safe_score_blocks(b, tf, vp, pcb):
                    return scoring_service.score_blocks(b, topic_focus=tf, video_path=vp, progress_callback=pcb)

                scored_blocks = _safe_score_blocks(blocks, command_config.topic_focus, video_for_analysis, progress_cb)
                
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
                
        _publish_status(project_id, "ANALYZED", "Análise de momentos concluída.", 75)

        logger.info(f"Queuing {len(viral_moments)} video cuts for Render Engine...", extra={"project_id": project_id, "stage": "timeline_building"})
        _publish_status(project_id, "BUILDING_TIMELINE", f"Criando plano de edição para {len(viral_moments)} cortes...", 80)
        
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

            base_title = moment.get("title", f"Clip")
            clip_title = f"{base_title} (Corte {i+1})"
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
        _publish_status(project_id, "TIMELINE_READY", "Linha do tempo e operações construídas.", 85)

        # Envia os jobs para o render engine usando Streams ao invés de Lists (BLPop -> XReadGroup)
        for plan in render_jobs:
            r.xadd("stream:render", {"payload": json.dumps(plan)})

        logger.info("Project successfully processed and queued for rendering!", extra={"project_id": project_id, "stage": "queued_render"})
        _publish_status(project_id, "QUEUED_RENDER", "Plano de edição enviado para fila de renderização GPU...", 90)

    except Exception as e:
        logger.exception("Error processing project", extra={"project_id": project_id, "stage": "failed", "error_details": str(e)})
        # Publish to events:failed
        payload = json.dumps({"project_id": project_id, "status": "FAILED", "error": str(e)})
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
    should_cleanup_audio = False

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
