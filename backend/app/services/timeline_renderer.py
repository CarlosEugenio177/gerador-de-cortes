import os
import subprocess
import logging
from typing import List, Dict, Tuple, Optional

logger = logging.getLogger(__name__)

class TimelineRenderer:
    def __init__(self, original_video: str, operations: List[Any] = None):
        self.original_video = original_video
        self.operations = operations or []

    @staticmethod
    def render_single_clip(
        source_video: str,
        output_path: str,
        start_time: float,
        end_time: float,
        aspect_ratio: str = "9:16",
        subtitle_path: Optional[str] = None
    ) -> bool:
        """
        Slice video segment, apply aspect ratio crop (9:16 Shorts/Reels/TikTok default),
        and optionally burn subtitles.
        """
        duration = max(0.1, end_time - start_time)
        
        # Build filter complex for aspect ratio
        if aspect_ratio == "9:16":
            # Crop center 9:16 vertical
            vf_filter = "crop=ih*(9/16):ih:(iw-ow)/2:0,scale=1080:1920"
        elif aspect_ratio == "1:1":
            # Crop square
            vf_filter = "crop=ih:ih:(iw-ow)/2:0,scale=1080:1080"
        else:
            # 16:9 widescreen default scale
            vf_filter = "scale=1920:1080"

        if subtitle_path and os.path.exists(subtitle_path):
            # Escape path for FFmpeg subtitles filter
            clean_sub_path = subtitle_path.replace("\\", "/").replace(":", "\\:")
            vf_filter += f",subtitles='{clean_sub_path}'"

        command = [
            "ffmpeg",
            "-y",
            "-ss", str(start_time),
            "-i", source_video,
            "-t", str(duration),
            "-vf", vf_filter,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "22",
            "-c:a", "aac",
            "-b:a", "192k",
            output_path
        ]

        logger.info(f"Rendering clip [{start_time}s -> {end_time}s] to {output_path}")
        try:
            result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if result.returncode != 0:
                logger.error(f"FFmpeg single clip error: {result.stderr}")
                # Fallback to simple slice without complex filter if filter fails
                simple_cmd = [
                    "ffmpeg", "-y", "-ss", str(start_time), "-i", source_video,
                    "-t", str(duration), "-c:v", "libx264", "-c:a", "aac", output_path
                ]
                subprocess.run(simple_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            return os.path.exists(output_path)
        except Exception as e:
            logger.error(f"Failed to render single clip: {e}")
            return False
