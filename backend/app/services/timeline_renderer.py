import os
import subprocess
import logging
from typing import List, Dict, Tuple
from tenacity import retry, stop_after_attempt, wait_exponential
from app.models.edit_operation import EditOperation
from app.services.aspect_ratio_service import AspectRatioService
from app.services.face_tracking import SmartCropService

logger = logging.getLogger(__name__)

class TimelineRenderer:
    def __init__(self, original_video: str, operations: List[EditOperation]):
        self.original_video = original_video
        self.operations = operations

    def _get_video_duration(self) -> float:
        """Helper to get video duration using ffprobe."""
        command = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", self.original_video
        ]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return float(result.stdout.strip())

    def _compute_keep_segments(self, duration: float) -> List[Tuple[float, float]]:
        # Find if there are 'clip' operations. If so, they define the base keep segments.
        # Otherwise, the base is the whole video.
        clips = [op for op in self.operations if op.operation_type == "clip"]
        if clips:
            # Assumes multiple clips are just multiple segments to keep
            keep_segments = [(float(c.start_time), float(c.end_time)) for c in clips if c.start_time is not None and c.end_time is not None]
            # Sort them by start time
            keep_segments.sort(key=lambda x: x[0])
        else:
            keep_segments = [(0.0, duration)]

        # Find remove_silence operations and subtract them from keep_segments
        silences = [op for op in self.operations if op.operation_type == "remove_silence"]
        for silence in silences:
            s_start = float(silence.start_time) if silence.start_time is not None else 0.0
            s_end = float(silence.end_time) if silence.end_time is not None else duration
            
            new_keep = []
            for k_start, k_end in keep_segments:
                # If silence completely covers keep segment
                if s_start <= k_start and s_end >= k_end:
                    continue
                # If silence is completely inside keep segment
                elif s_start > k_start and s_end < k_end:
                    new_keep.append((k_start, s_start))
                    new_keep.append((s_end, k_end))
                # If silence overlaps the beginning of keep segment
                elif s_start <= k_start and s_end > k_start:
                    new_keep.append((s_end, k_end))
                # If silence overlaps the end of keep segment
                elif s_start < k_end and s_end >= k_end:
                    new_keep.append((k_start, s_start))
                else:
                    # No overlap
                    new_keep.append((k_start, k_end))
            keep_segments = new_keep

        return keep_segments

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
    def render(self, output_path: str) -> bool:
        if not os.path.exists(self.original_video):
            logger.error(f"Original video not found: {self.original_video}")
            raise FileNotFoundError(f"Original video not found: {self.original_video}")

        duration = self._get_video_duration()
        keep_segments = self._compute_keep_segments(duration)

        if not keep_segments:
            logger.warning("No segments to render after applying operations.")
            return False

        filter_complex = []
        concat_inputs = []

        # 1. Trimming
        for i, (start, end) in enumerate(keep_segments):
            filter_complex.append(f"[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}];")
            filter_complex.append(f"[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{i}];")
            concat_inputs.append(f"[v{i}][a{i}]")

        concat_filter = "".join(concat_inputs) + f"concat=n={len(keep_segments)}:v=1:a=1[v_concat][a_concat];"
        filter_complex.append(concat_filter)

        # 2. Apply crop and resize
        current_v_out = "[v_concat]"
        
        crops = [op for op in self.operations if op.operation_type == "crop"]
        if crops:
            crop_op = crops[-1]
            params = crop_op.parameters or {}
            
            # If the crop op specifies an aspect ratio, use the service
            if "aspect_ratio" in params:
                target_ratio = params.get("aspect_ratio", "9:16")
                is_smart = params.get("smart", True)
                parsed_ratio = 9/16 if target_ratio == "9:16" else 16/9
                
                # Fetch video dimensions once using ffprobe
                if not hasattr(self, 'video_width'):
                    probe_cmd = [
                        "ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", self.original_video
                    ]
                    try:
                        dimensions = subprocess.check_output(probe_cmd).decode('utf-8').strip().split('x')
                        self.video_width = int(dimensions[0])
                        self.video_height = int(dimensions[1])
                    except Exception as e:
                        logger.error(f"Failed to probe video dimensions: {e}")
                        self.video_width, self.video_height = 1920, 1080
                
                if is_smart:
                    smart_crop = SmartCropService()
                    # We pass the start time of the first segment as a reference point for face detection
                    ref_time = keep_segments[0][0] if keep_segments else 0.0
                    normalized_x = smart_crop.analyze_face_center(self.original_video, start_time=ref_time)
                    crop_filter = smart_crop.get_crop_filter(self.video_width, self.video_height, parsed_ratio, normalized_x)
                    filter_complex.append(f"{current_v_out}{crop_filter}[v_crop];")
                else:
                    aspect_service = AspectRatioService()
                    crop_filter = aspect_service.get_crop_filter(target_ratio)
                    filter_complex.append(f"{current_v_out}{crop_filter}[v_crop];")
            else:
                # Fallback to manual w, h, x, y
                w = params.get("w", "iw")
                h = params.get("h", "ih")
                x = params.get("x", "(iw-ow)/2")
                y = params.get("y", "(ih-oh)/2")
                filter_complex.append(f"{current_v_out}crop={w}:{h}:{x}:{y}[v_crop];")
                
            current_v_out = "[v_crop]"

        resizes = [op for op in self.operations if op.operation_type == "resize"]
        if resizes:
            # Assuming parameters={"w": 1080, "h": 1920}
            resize_op = resizes[-1]
            params = resize_op.parameters or {}
            w = params.get("w", "iw")
            h = params.get("h", "ih")
            filter_complex.append(f"{current_v_out}scale={w}:{h}[v_resize];")
            current_v_out = "[v_resize]"

        # Map final outputs
        filter_complex_str = "".join(filter_complex)
        
        # Remove trailing semicolon for clean ffmpeg command
        if filter_complex_str.endswith(';'):
            filter_complex_str = filter_complex_str[:-1]

        command = [
            "ffmpeg",
            "-y",
            "-i", self.original_video,
            "-filter_complex", filter_complex_str,
            "-map", current_v_out,
            "-map", "[a_concat]",
            "-c:v", "libx264",
            "-preset", "fast",
            "-c:a", "aac",
            output_path
        ]

        logger.info(f"Running Timeline Renderer: {' '.join(command)}")

        try:
            result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if result.returncode != 0:
                logger.error(f"FFmpeg render error: {result.stderr}")
                raise RuntimeError(f"FFmpeg render failed: {result.stderr}")
            
            logger.info(f"Timeline successfully rendered: {output_path}")
            return True

        except Exception as e:
            logger.exception(f"Failed to execute Timeline Renderer: {str(e)}")
            raise e
