import os
import re
import subprocess
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

class SilenceDetectionService:
    def __init__(self):
        pass

    def detect_silences(self, file_path: str, noise_tolerance: int = -30, min_duration: float = 0.5) -> List[Dict[str, float]]:
        """
        Runs FFmpeg silencedetect filter and parses the output to find silence segments.
        Returns a list of dicts: [{"start": 1.2, "end": 2.5}, ...]
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        command = [
            "ffmpeg",
            "-i", file_path,
            "-vn",  # Ignore video for faster processing
            "-af", f"silencedetect=noise={noise_tolerance}dB:d={min_duration}",
            "-f", "null",
            "-"
        ]

        logger.info(f"Running FFmpeg silence detection: {' '.join(command)}")

        try:
            # silencedetect outputs to stderr
            result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
            output = result.stderr

            silences = []
            
            # Regex to match silence_start and silence_end tags in FFmpeg output
            start_regex = re.compile(r"silence_start:\s+([\d\.]+)")
            end_regex = re.compile(r"silence_end:\s+([\d\.]+)")

            starts = start_regex.findall(output)
            ends = end_regex.findall(output)

            # Ensure we have matching starts and ends
            for s, e in zip(starts, ends):
                silences.append({
                    "start": float(s),
                    "end": float(e)
                })

            logger.info(f"Detected {len(silences)} silence segments.")
            return silences

        except subprocess.CalledProcessError as e:
            error_msg = e.stderr if e.stderr else str(e)
            logger.error(f"FFmpeg silence detection failed: {error_msg}")
            raise RuntimeError(f"Failed to detect silences: {error_msg}") from e
        except Exception as e:
            logger.error(f"Error during silence detection: {str(e)}")
            raise e
