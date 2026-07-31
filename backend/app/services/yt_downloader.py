import os
import uuid
import logging
import yt_dlp
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class YtDownloaderService:
    @staticmethod
    def get_video_info(url: str) -> Dict[str, Any]:
        """
        Extract metadata without downloading full media.
        """
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # Determine platform logo/type
                platform = "generic"
                if "youtube" in url.lower() or "youtu.be" in url.lower():
                    platform = "youtube"
                elif "twitch" in url.lower():
                    platform = "twitch"
                elif "kick" in url.lower():
                    platform = "kick"
                elif "tiktok" in url.lower():
                    platform = "tiktok"

                return {
                    "id": info.get("id", str(uuid.uuid4())[:8]),
                    "title": info.get("title", "Stream / Video Highlight"),
                    "author": info.get("uploader", info.get("channel", "Unknown Creator")),
                    "duration": info.get("duration", 0),
                    "thumbnail": info.get("thumbnail", ""),
                    "platform": platform,
                    "url": url,
                }
        except Exception as e:
            logger.error(f"Error fetching video info for {url}: {e}")
            # Fallback mock/generic info if yt-dlp fails pre-fetch
            return {
                "id": str(uuid.uuid4())[:8],
                "title": "Video Stream Link",
                "author": "Streamer",
                "duration": 300,
                "thumbnail": "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop",
                "platform": "generic",
                "url": url
            }

    @staticmethod
    def download_media(url: str, output_dir: str = settings.UPLOAD_DIR) -> Dict[str, str]:
        """
        Download video and extract audio file for API processing.
        Returns dict with paths to video_path and audio_path.
        """
        file_prefix = f"vid_{uuid.uuid4().hex[:10]}"
        video_output = os.path.join(output_dir, f"{file_prefix}.mp4")
        audio_output = os.path.join(output_dir, f"{file_prefix}.mp3")

        # 1. Download video
        ydl_opts_video = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': video_output,
            'quiet': True,
            'no_warnings': True,
            'overwrites': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts_video) as ydl:
            ydl.download([url])

        # 2. Extract audio for API transcription
        ydl_opts_audio = {
            'format': 'bestaudio/best',
            'outtmpl': audio_output.replace('.mp3', '.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'quiet': True,
            'no_warnings': True,
            'overwrites': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts_audio) as ydl:
            ydl.download([url])

        return {
            "video_path": video_output,
            "audio_path": audio_output
        }
