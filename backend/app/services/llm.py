import os
import json
import logging
from typing import List, Dict
import ollama
from tenacity import retry, stop_after_attempt, wait_exponential
from app.utils.json_parser import parse_robust_json
from app.schemas.llm_output import LLMScoreOutput, LLMViralMoment, LLMMomentsOutput, LLMCommandConfig

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self, model: str = "llama3:8b"):
        self.model = model
        self.host = os.getenv("OLLAMA_HOST", "http://ollama:11434")
        self.client = ollama.Client(host=self.host)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
    def extract_viral_moments(self, transcript_segments: List[Dict]) -> List[Dict]:
        """
        Takes a list of transcript segments and returns a list of viral moments.
        Each segment in transcript_segments should have 'start_time', 'end_time', and 'text'.
        Returns: list of dicts with 'start_time', 'end_time', 'viral_score', 'description'.
        """
        if not transcript_segments:
            return []

        # Format transcript for the prompt
        formatted_script = ""
        for seg in transcript_segments:
            formatted_script += f"[{seg['start_time']:.2f} - {seg['end_time']:.2f}] {seg['text']}\n"

        prompt = f"""
You are an expert Social Media Manager and Video Editor specializing in TikTok, Instagram Reels, and YouTube Shorts.
Your task is to analyze the following video transcript and identify the most viral, engaging, and interesting short clips.

Here is the transcript with timestamps:
{formatted_script}

CRITICAL RULES:
1. Identify 1 to 3 highly engaging moments.
2. The duration of EACH clip (end_time - start_time) MUST be strictly between 30 and 60 seconds. Do not create clips shorter than 30 seconds under any circumstances.
3. Ensure the clip has a strong hook (opening) and a satisfying conclusion.
4. Calculate a 'viral_score' from 0.0 to 100.0 based on how likely it is to go viral.
"""
        logger.info(f"Sending prompt to Ollama ({self.model}) to find viral moments...")
        
        try:
            response = self.client.chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a specialized JSON-only output assistant."},
                    {"role": "user", "content": prompt}
                ],
                format=LLMMomentsOutput.model_json_schema(),  # Use Structured Output
                options={"temperature": 0.3}
            )
            
            content = response.get("message", {}).get("content", "").strip()
            
            if not content:
                logger.error("Ollama returned empty response.")
                return []

            try:
                parsed_json = parse_robust_json(content)
                
                # Check if it returned a dict wrapper like {"clips": [...]}
                if isinstance(parsed_json, dict):
                    # Try Pydantic validation directly
                    try:
                        validated_output = LLMMomentsOutput(**parsed_json)
                        return [clip.model_dump() for clip in validated_output.clips]
                    except Exception:
                        pass
                        
                    # Manual fallback
                    for val in parsed_json.values():
                        if isinstance(val, list):
                            parsed_json = val
                            break
                    if isinstance(parsed_json, dict) and "start_time" in parsed_json:
                        parsed_json = [parsed_json]
                        
                if not isinstance(parsed_json, list):
                    logger.error(f"Ollama response is not a JSON array. Raw response: {content}")
                    return []
                    
                valid_clips = []
                for item in parsed_json:
                    try:
                        validated_clip = LLMViralMoment(**item)
                        valid_clips.append(validated_clip.model_dump())
                    except Exception as ve:
                        logger.warning(f"Skipping invalid clip from LLM: {ve}")
                        
                return valid_clips

            except Exception as e:
                logger.error(f"Failed to parse LLM JSON: {e}")
                raise ValueError("JSON parse failed, triggering retry") from e

        except Exception as e:
            logger.error(f"Error communicating with Ollama: {str(e)}")
            raise e

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
    def parse_user_command(self, user_prompt: str) -> LLMCommandConfig:
        """
        Translates a raw natural language prompt from the user into a structured AI command configuration.
        """
        if not user_prompt or not user_prompt.strip():
            return LLMCommandConfig() # Return default config

        prompt = f"""
You are the Brain of an AI Video Editor. The user has provided the following editing request:
"{user_prompt}"

Your task is to parse this request and extract the key editing intent.
Determine the topic focus, the number of clips requested, the target duration, and if they asked to remove silences or specific subtitle styles.
Also determine if they asked to remove background noise (e.g. "limpar audio", "tirar ruido").
Crucially, determine the 'video_format' requested by the user:
- "9:16" for TikTok, Instagram Reels, Shorts, Vertical formats. (Default if unspecified)
- "16:9" for YouTube, Horizontal, Cinematic formats.
- "1:1" for Square, Instagram Feed formats.

DURATION RULES:
If the user specifies a duration in minutes (e.g. "corte de 5 minutos", "5 min"), you MUST convert it to seconds (e.g. 5 * 60 = 300) and set BOTH `min_duration` and `max_duration` to that value. If they specify seconds, use that. If they don't specify, default to 30.0 and 60.0.

If the user explicitly specifies exact timestamps to cut (e.g., "from 0:10 to 0:25", "do segundo 10 ao 30"), you MUST extract them into the `manual_timestamps` list as floats in seconds (e.g., [[10.0, 25.0]]). If no explicit times are given, leave it empty.
"""
        logger.info("Sending command to Ollama for parsing...")
        try:
            response = self.client.chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a JSON-only configuration assistant."},
                    {"role": "user", "content": prompt}
                ],
                format=LLMCommandConfig.model_json_schema(),
                options={"temperature": 0.1}
            )
            
            content = response.get("message", {}).get("content", "").strip()
            
            if not content:
                return LLMCommandConfig()
                
            try:
                parsed_json = parse_robust_json(content)
                validated_config = LLMCommandConfig(**parsed_json)
                return validated_config
            except Exception as e:
                logger.error(f"Command parsing failed: {e}")
                return LLMCommandConfig() # Fallback to defaults
            
        except Exception as e:
            logger.error(f"Error communicating with Ollama for command parsing: {str(e)}")
            return LLMCommandConfig()


    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
    def score_block(self, text: str, topic_focus: str = "viral moments") -> float:
        """
        Scores a 15-second block of text on its potential to be a viral clip segment, considering the topic_focus.
        Returns a float between 0.0 and 100.0.
        """
        if not text or not text.strip():
            return 0.0
            
        prompt = f"""
You are an expert Social Media Manager. Rate the following 15-second transcript block on its potential to be part of a highly engaging short video.
The user specifically requested clips focused on the following theme/topic: '{topic_focus}'.

Evaluate the block based on how perfectly it aligns with the requested theme, its hook potential, emotional impact, and curiosity generation.

Transcript:
"{text}"
"""
        try:
            response = self.client.chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a JSON-only scoring assistant."},
                    {"role": "user", "content": prompt}
                ],
                format=LLMScoreOutput.model_json_schema(), # Use Structured Output
                options={"temperature": 0.1}
            )
            
            content = response.get("message", {}).get("content", "").strip()
            
            if not content:
                return 0.0
                
            try:
                parsed_json = parse_robust_json(content)
                validated_score = LLMScoreOutput(**parsed_json)
                return validated_score.score
            except Exception as e:
                logger.error(f"Score parsing failed: {e}")
                raise ValueError("Score parse failed, triggering retry") from e
            
        except Exception as e:
            logger.error(f"Error communicating with Ollama for scoring: {str(e)}")
            raise e
