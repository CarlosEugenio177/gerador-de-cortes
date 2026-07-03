import os
import subprocess
import logging
from typing import List, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class TranscriptionService:
    def __init__(self, model_size: str = "base", device: str = "cuda", compute_type: str = "float16"):
        """
        Initializes the transcription service. 
        Parameters are set to take advantage of NVIDIA GPUs (cuda, float16).
        """
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.model = None

    def _load_model(self) -> None:
        """Lazy load the Faster-Whisper model so it only allocates VRAM when needed."""
        if self.model is None:
            logger.info(f"Loading Faster-Whisper model '{self.model_size}' on {self.device}...")
            # Import inside function to prevent blocking global imports
            from faster_whisper import WhisperModel
            
            # This will automatically download the model on the first run
            self.model = WhisperModel(
                self.model_size, 
                device=self.device, 
                compute_type=self.compute_type
            )
            logger.info("Whisper model loaded successfully.")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
    def extract_audio(self, video_path: str) -> str:
        """
        Extracts mono audio at 16kHz from a video file using FFmpeg.
        These are the optimal settings for Whisper inference.
        Returns the path to the extracted .wav file.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        audio_path = f"{os.path.splitext(video_path)[0]}_audio.wav"
        
        # FFmpeg command: Mono (1 channel), 16000 Hz, pcm_s16le codec (.wav)
        command = [
            "ffmpeg",
            "-y",                   # Overwrite existing files
            "-i", video_path,       # Input video file
            "-vn",                  # Disable video stream
            "-acodec", "pcm_s16le", # Audio codec standard for WAV
            "-ar", "16000",         # Sample rate required by Whisper
            "-ac", "1",             # Mono audio
            audio_path
        ]

        logger.info(f"Extracting audio to {audio_path}")
        try:
            # Run FFmpeg, hiding standard output but capturing errors
            subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.decode() if e.stderr else str(e)
            logger.error(f"FFmpeg failed: {error_msg}")
            raise RuntimeError(f"Failed to extract audio from video: {error_msg}") from e

        return audio_path

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
    def transcribe_audio(self, audio_path: str) -> List[Dict[str, Any]]:
        """
        Transcribes the audio file using Faster-Whisper.
        Returns a list of segments mapping start time, end time, and transcribed text.
        """
        self._load_model()
        logger.info(f"Starting transcription for {audio_path}")
        
        # Transcribe returns an iterator of segments
        segments, info = self.model.transcribe(
            audio_path,
            beam_size=5,
            word_timestamps=True
        )
        
        logger.info(f"Detected language '{info.language}' with probability {info.language_probability:.2f}")

        results = []
        for segment in segments:
            results.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "words": [{"start": w.start, "end": w.end, "word": w.word} for w in segment.words] if segment.words else []
            })
            
        logger.info(f"Transcription completed with {len(results)} segments.")
        return results
