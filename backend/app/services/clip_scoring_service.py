import re
import logging
from typing import List, Dict
from app.services.llm import LLMService
from app.services.video_analyzer import VisualScoringService

logger = logging.getLogger(__name__)

class ClipScoringService:
    def __init__(self, llm_service: LLMService):
        self.llm_service = llm_service
        self.visual_service = VisualScoringService()
        self.llm_disabled = False

    def segment_transcript(self, segments: List[Dict], block_size: float = 15.0) -> List[Dict]:
        """
        Groups transcript segments into blocks of roughly `block_size` seconds.
        """
        blocks = []
        if not segments:
            return blocks

        current_block = {"start_time": segments[0]["start"], "end_time": segments[0]["end"], "text": ""}
        texts = []

        for seg in segments:
            if seg["start"] - current_block["start_time"] > block_size and texts:
                current_block["text"] = " ".join(texts)
                blocks.append(current_block)
                current_block = {"start_time": seg["start"], "end_time": seg["end"], "text": ""}
                texts = []
            
            texts.append(seg["text"].strip())
            current_block["end_time"] = seg["end"]

        if texts:
            current_block["text"] = " ".join(texts)
            blocks.append(current_block)

        return blocks

    def calculate_hook_score(self, text: str) -> float:
        score = 0.0
        text_lower = text.lower()
        if "?" in text:
            score += 30
        if any(word in text_lower for word in ["você", "te", "como", "faça", "pare", "veja"]):
            score += 20
        # Check if first few words are strong
        return min(score, 100.0)

    def calculate_emotion_score(self, text: str) -> float:
        score = 0.0
        text_lower = text.lower()
        if "!" in text:
            score += 30
        if any(word in text_lower for word in ["incrível", "absurdo", "loucura", "chocante", "pior", "melhor"]):
            score += 40
        return min(score, 100.0)

    def calculate_curiosity_score(self, text: str) -> float:
        score = 0.0
        text_lower = text.lower()
        if "por que" in text_lower or "porque" in text_lower:
            score += 30
        if any(word in text_lower for word in ["segredo", "motivo", "descubra", "você sabia", "verdade"]):
            score += 40
        return min(score, 100.0)

    def score_blocks(self, blocks: List[Dict], topic_focus: str = "viral moments", video_path: str = None) -> List[Dict]:
        """
        Scores each 15-second block individually, considering the topic_focus and visual framing.
        """
        scored_blocks = []
        for block in blocks:
            text = block["text"]
            hook = self.calculate_hook_score(text)
            emotion = self.calculate_emotion_score(text)
            curiosity = self.calculate_curiosity_score(text)
            
            # Using LLM for classification / qualitative analysis ONLY if NLP score is decent and not disabled
            llm_score = 0.0
            nlp_score = hook + emotion + curiosity
            
            if not self.llm_disabled and nlp_score >= 30.0:
                try:
                    llm_score = self.llm_service.score_block(text, topic_focus)
                except Exception as e:
                    logger.warning(f"CUDA/LLM Error detected during scoring: {e}. Circuit Breaker activated! LLM disabled for remaining blocks.")
                    self.llm_disabled = True
            elif self.llm_disabled:
                # LLM failed previously, fallback to boosting NLP to compensate
                llm_score = nlp_score / 3.0
            
            visual_score = 50.0
            if video_path:
                try:
                    visual_score = self.visual_service.analyze_block_visuals(video_path, block["start_time"], block["end_time"])
                except Exception as e:
                    logger.error(f"Visual scoring failed for block {block['start_time']}: {e}")
            
            # Recalculate based on non-zero metrics if LLM is disabled to maintain fair weights
            if self.llm_disabled:
                final_score = (hook + emotion + curiosity + visual_score) / 4.0
            else:
                final_score = (hook + emotion + curiosity + llm_score + visual_score) / 5.0
            
            scored_block = {
                **block,
                "hook_score": hook,
                "emotion_score": emotion,
                "curiosity_score": curiosity,
                "llm_score": llm_score,
                "visual_score": visual_score,
                "final_score": final_score
            }
            scored_blocks.append(scored_block)
            
            logger.info(f"Block [{block['start_time']} - {block['end_time']}] - Final Score: {final_score:.2f}")

        return scored_blocks

    def merge_blocks(self, scored_blocks: List[Dict], min_duration: float = 30.0, max_duration: float = 60.0, top_k: int = 3, previous_clips: List[tuple] = None) -> List[Dict]:
        """
        Merges adjacent high-scoring blocks into clips between 30 and 60 seconds.
        Selects the top_k best clips.
        """
        if not scored_blocks:
            return []

        # Find the highest scoring starting points
        scored_blocks.sort(key=lambda x: x["final_score"], reverse=True)
        
        clips = []
        used_times = previous_clips if previous_clips else []

        def is_overlapping(start, end):
            for us, ue in used_times:
                if start < ue and end > us:
                    return True
            return False

        # Attempt to build a clip starting from the highest scoring blocks
        original_blocks = sorted(scored_blocks, key=lambda x: x["start_time"])
        
        for base_block in scored_blocks:
            if len(clips) >= top_k:
                break
                
            start_time = base_block["start_time"]
            
            # Find index in original sequence
            idx = next(i for i, b in enumerate(original_blocks) if b["start_time"] == start_time)
            
            current_end = original_blocks[idx]["end_time"]
            current_score = original_blocks[idx]["final_score"]
            block_count = 1
            
            if is_overlapping(start_time, current_end):
                continue
                
            # Expand forward
            for j in range(idx + 1, len(original_blocks)):
                next_block = original_blocks[j]
                if next_block["end_time"] - start_time > max_duration + 10.0:
                    break
                    
                if is_overlapping(next_block["start_time"], next_block["end_time"]):
                    break
                    
                current_end = next_block["end_time"]
                current_score += next_block["final_score"]
                block_count += 1
                
            duration = current_end - start_time
            if duration >= min_duration - 10.0:
                avg_score = current_score / block_count
                clips.append({
                    "start_time": start_time,
                    "end_time": current_end,
                    "viral_score": avg_score
                })
                used_times.append((start_time, current_end))
                
        # Fallback if no clip reached min_duration
        if not clips and scored_blocks:
            best = scored_blocks[0]
            clips.append({
                "start_time": best["start_time"],
                "end_time": best["start_time"] + min_duration,
                "viral_score": best["final_score"]
            })
            
        return clips
