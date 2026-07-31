import os
import uuid
import logging
import asyncio
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.config import settings
from app.services.yt_downloader import YtDownloaderService
from app.services.api_transcription import ApiTranscriptionService
from app.services.api_clip_analyzer import ApiClipAnalyzerService
from app.services.timeline_renderer import TimelineRenderer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("playsquad_engine")

app = FastAPI(
    title="PLAYSquad AI Clipper Engine",
    version="2.0.0",
    description="API-driven lightweight VPS video clipper"
)

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static media server for clips
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CLIPS_DIR, exist_ok=True)

# In-memory job store for fast VPS polling
JOBS_STORE: Dict[str, Dict[str, Any]] = {}

class AnalyzeUrlRequest(BaseModel):
    url: str

class ProcessUrlRequest(BaseModel):
    url: str
    aspect_ratio: Optional[str] = "9:16"
    subtitle_style: Optional[str] = "neon"
    api_key: Optional[str] = ""

def run_clip_pipeline(job_id: str, url: str, aspect_ratio: str, subtitle_style: str, api_key: str):
    """
    Asynchronous background job runner.
    """
    job = JOBS_STORE.get(job_id)
    if not job:
        return

    try:
        # Step 1: Download Media
        job["status"] = "downloading"
        job["progress"] = 15
        job["step_message"] = "Downloading video stream via yt-dlp..."
        logger.info(f"[{job_id}] Downloading {url}")

        download_res = YtDownloaderService.download_media(url, settings.UPLOAD_DIR)
        video_path = download_res["video_path"]
        audio_path = download_res["audio_path"]

        # Step 2: API Transcription
        job["status"] = "transcribing"
        job["progress"] = 40
        job["step_message"] = "Transcribing audio via Cloud Whisper API..."
        logger.info(f"[{job_id}] Transcribing audio")

        transcription = ApiTranscriptionService.transcribe(audio_path, api_key=api_key)

        # Step 3: LLM Viral Moment Discovery
        job["status"] = "analyzing"
        job["progress"] = 65
        job["step_message"] = "Discovering high-energy viral hooks with AI..."
        logger.info(f"[{job_id}] Analyzing clips with AI")

        raw_clips = ApiClipAnalyzerService.analyze_viral_clips(transcription, api_key=api_key)

        # Step 4: Render 9:16 Clips with Subtitles
        job["status"] = "rendering"
        job["progress"] = 85
        job["step_message"] = "Cropping 9:16 vertical clips & burning animated subtitles..."
        logger.info(f"[{job_id}] Rendering {len(raw_clips)} clips")

        rendered_clips = []
        for idx, clip in enumerate(raw_clips):
            clip_filename = f"clip_{job_id}_{idx+1}.mp4"
            clip_output_path = os.path.join(settings.CLIPS_DIR, clip_filename)

            success = TimelineRenderer.render_single_clip(
                source_video=video_path,
                output_path=clip_output_path,
                start_time=clip["start_time"],
                end_time=clip["end_time"],
                aspect_ratio=aspect_ratio
            )

            rendered_clips.append({
                "id": idx + 1,
                "title": clip.get("title", f"Clip #{idx+1}"),
                "hook_summary": clip.get("hook_summary", ""),
                "start_time": clip["start_time"],
                "end_time": clip["end_time"],
                "duration": round(clip["end_time"] - clip["start_time"], 1),
                "viral_score": clip.get("viral_score", 90),
                "suggested_captions": clip.get("suggested_captions", ""),
                "suggested_hashtags": clip.get("suggested_hashtags", []),
                "media_url": f"/api/v1/media/{clip_filename}" if success else None
            })

        # Completed
        job["status"] = "completed"
        job["progress"] = 100
        job["step_message"] = "Clips successfully generated!"
        job["clips"] = rendered_clips
        logger.info(f"[{job_id}] Processing complete!")

    except Exception as e:
        logger.error(f"[{job_id}] Pipeline error: {e}")
        job["status"] = "failed"
        job["progress"] = 0
        job["error"] = str(e)
        job["step_message"] = f"Processing failed: {str(e)}"


@app.get("/health")
def health_check():
    return {
        "status": "online",
        "engine": "PLAYSquad API Engine v2.0",
        "mode": "VPS Cloud-API Mode (No CUDA required)"
    }

@app.post("/api/v1/analyze-url")
def analyze_url(payload: AnalyzeUrlRequest):
    """
    Fetch metadata (title, duration, thumbnail) for video URL.
    """
    info = YtDownloaderService.get_video_info(payload.url)
    return info

@app.post("/api/v1/process-url")
def process_url(payload: ProcessUrlRequest, background_tasks: BackgroundTasks):
    """
    Create a new auto-cut job for a video link.
    """
    job_id = uuid.uuid4().hex[:12]
    info = YtDownloaderService.get_video_info(payload.url)

    JOBS_STORE[job_id] = {
        "job_id": job_id,
        "url": payload.url,
        "video_info": info,
        "status": "queued",
        "progress": 5,
        "step_message": "Initializing job pipeline...",
        "clips": []
    }

    background_tasks.add_task(
        run_clip_pipeline,
        job_id,
        payload.url,
        payload.aspect_ratio or "9:16",
        payload.subtitle_style or "neon",
        payload.api_key or ""
    )

    return {"job_id": job_id, "video_info": info, "status": "queued"}

@app.get("/api/v1/jobs/{job_id}")
def get_job_status(job_id: str):
    job = JOBS_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.get("/api/v1/media/{filename}")
def get_media_file(filename: str):
    file_path = os.path.join(settings.CLIPS_DIR, filename)
    if not os.path.exists(file_path):
        # Fallback check upload dir
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Media file not found")
    return FileResponse(file_path, media_type="video/mp4")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main_api:app", host="0.0.0.0", port=8000, reload=True)
