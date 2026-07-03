from pydantic import BaseModel, Field
from typing import List

class LLMScoreOutput(BaseModel):
    score: float = Field(..., ge=0.0, le=100.0, description="Viral potential score between 0.0 and 100.0")

class LLMViralMoment(BaseModel):
    start_time: float = Field(..., description="Start time in seconds")
    end_time: float = Field(..., description="End time in seconds")
    viral_score: float = Field(..., ge=0.0, le=100.0, description="Score between 0.0 and 100.0")
    title: str = Field(..., description="A catchy title for the clip")
    description: str = Field(..., description="A short description of why this clip is viral")

class LLMMomentsOutput(BaseModel):
    clips: List[LLMViralMoment] = Field(..., description="List of viral moments identified")

class LLMCommandConfig(BaseModel):
    clip_count: int = Field(default=3, description="Number of clips requested by the user")
    min_duration: float = Field(default=30.0, description="Minimum duration of each clip in seconds")
    max_duration: float = Field(default=60.0, description="Maximum duration of each clip in seconds")
    topic_focus: str = Field(default="viral moments", description="The semantic topic or theme the user wants to focus on")
    remove_silences: bool = Field(default=False, description="Whether the user explicitly requested silence removal")
    remove_noise: bool = Field(default=False, description="Whether the user requested background noise or hum removal")
    subtitle_style: str = Field(default="default", description="The requested style or color for the subtitles (e.g., 'hormozi_yellow', 'default', 'none')")
    video_format: str = Field(default="9:16", description="The requested aspect ratio format for the video (e.g., '16:9' for horizontal/youtube, '9:16' for vertical/tiktok, '1:1' for square)")
    manual_timestamps: list[list[float]] = Field(default=[], description="List of [start, end] pairs in seconds if the user specified exact times to clip")
