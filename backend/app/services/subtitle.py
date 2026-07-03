import os
import math
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class SubtitleService:
    def __init__(self):
        pass

    def _format_time(self, seconds: float) -> str:
        """Format seconds to ASS time format: H:MM:SS.cs"""
        if seconds < 0:
            seconds = 0.0
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        centiseconds = int(round((seconds - int(seconds)) * 100))
        if centiseconds >= 100:
            secs += 1
            centiseconds -= 100
            if secs >= 60:
                minutes += 1
                secs -= 60
                if minutes >= 60:
                    hours += 1
                    minutes -= 60
        return f"{hours}:{minutes:02d}:{secs:02d}.{centiseconds:02d}"

    def generate_ass_file(self, words: List[Dict], clip_start: float, output_path: str, style_name: str = "default") -> bool:
        """
        Generates an Advanced SubStation Alpha (.ass) file for the clip.
        'words' is a list of dicts: {"start": float, "end": float, "word": str}
        """
        if not words:
            logger.warning("No words provided for subtitle generation.")
            return False

        style_name = style_name.lower().strip()

        # Styles Configuration
        # &H00FFFFFF = White
        # &H0000FFFF = Yellow (BGR)
        # &H00000000 = Black
        styles_map = {
            "default": "Style: Default,Roboto,90,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,6,0,5,10,10,960,1",
            "hormozi": "Style: Default,Impact,100,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,8,2,5,10,10,960,1",
            "netflix": "Style: Default,Arial,75,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,3,2,0,2,10,10,60,1"
        }

        # Fallback to default if style not found
        selected_style_def = styles_map.get(style_name, styles_map["default"])
        if "hormozi" in style_name:
            selected_style_def = styles_map["hormozi"]
        elif "netflix" in style_name:
            selected_style_def = styles_map["netflix"]

        ass_header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{selected_style_def}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(ass_header)
                
                # Group words into short phrases (max 4 words or 2 seconds)
                phrases = []
                current_phrase = []
                
                for word_data in words:
                    w_start = max(0.0, word_data.get("start", 0.0) - clip_start)
                    w_end = max(0.0, word_data.get("end", 0.0) - clip_start)
                    text = word_data.get("word", "").strip()
                    
                    if not text or w_end <= 0:
                        continue
                        
                    word_obj = {"start": w_start, "end": w_end, "text": text}
                    
                    if not current_phrase:
                        current_phrase.append(word_obj)
                    else:
                        time_since_start = w_end - current_phrase[0]["start"]
                        gap = w_start - current_phrase[-1]["end"]
                        
                        if len(current_phrase) >= 4 or time_since_start > 2.0 or gap > 0.5:
                            phrases.append(current_phrase)
                            current_phrase = [word_obj]
                        else:
                            current_phrase.append(word_obj)
                            
                if current_phrase:
                    phrases.append(current_phrase)
                    
                for phrase in phrases:
                    for i, active_word in enumerate(phrase):
                        event_start = active_word["start"]
                        if i < len(phrase) - 1:
                            event_end = phrase[i+1]["start"]
                        else:
                            event_end = active_word["end"] + 0.1
                            
                        start_str = self._format_time(event_start)
                        end_str = self._format_time(event_end)
                        
                        formatted_words = []
                        for j, w in enumerate(phrase):
                            if i == j:
                                if "hormozi" in style_name:
                                    # Yellow + Pop Animation (\t scaling) + Rotation jitter could be added, but simple scale is robust
                                    formatted_words.append(f"{{\\c&H00FFFF&\\fscx120\\fscy120\\t(0,100,\\fscx100\\fscy100)}}{w['text']}{{\\c&HFFFFFF&\\fscx100\\fscy100}}")
                                elif "netflix" in style_name:
                                    formatted_words.append(w["text"]) # Netflix doesn't do karaoke highlighting
                                else:
                                    # Default simple yellow highlight
                                    formatted_words.append(f"{{\\c&H00FFFF&}}{w['text']}{{\\c&HFFFFFF&}}")
                            else:
                                formatted_words.append(w["text"])
                                
                        text_line = " ".join(formatted_words)
                        f.write(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text_line}\n")
                        
            logger.info(f"Generated subtitle file: {output_path} with style {style_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to generate subtitle file: {str(e)}")
            return False
