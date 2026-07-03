import cv2
import logging
import numpy as np

logger = logging.getLogger(__name__)

class SmartCropService:
    def __init__(self):
        # Load the pre-trained Haar Cascade for face detection
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    def analyze_face_center(self, video_path: str, start_time: float, duration: float = 5.0) -> float:
        """
        Analyzes the video to find the primary face's X-center coordinate (normalized 0.0 to 1.0).
        Scans a few seconds of the video starting from start_time to find a stable face.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"Failed to open video for face tracking: {video_path}")
            return 0.5 # Default to center
            
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps == 0:
            fps = 30.0
            
        start_frame = int(start_time * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        
        frames_to_check = int(duration * fps)
        step = int(fps / 2) # Check 2 frames per second for speed
        
        centers_x = []
        width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        
        for i in range(0, frames_to_check, step):
            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame + i)
            ret, frame = cap.read()
            if not ret:
                break
                
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # Detect faces
            faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            
            if len(faces) > 0:
                # Assume the largest face is the primary speaker
                largest_face = max(faces, key=lambda rect: rect[2] * rect[3])
                x, y, w, h = largest_face
                center_x = x + (w / 2)
                centers_x.append(center_x / width) # Normalize 0 to 1
                
        cap.release()
        
        if not centers_x:
            logger.info(f"No faces detected in {video_path} at {start_time}s. Defaulting to center.")
            return 0.5
            
        # Return the median center to avoid outliers
        median_center = float(np.median(centers_x))
        logger.info(f"SmartCrop: Found primary face center at {median_center:.2f} (normalized)")
        return median_center

    def get_crop_filter(self, video_width: int, video_height: int, target_ratio: float, normalized_center_x: float) -> str:
        """
        Generates the FFmpeg crop filter string to center on the detected face.
        """
        current_ratio = video_width / video_height
        
        if current_ratio > target_ratio:
            # Video is wider than target. Crop width.
            new_width = int(video_height * target_ratio)
            new_height = video_height
            
            # Calculate X to center on the face, clamped to edges
            ideal_x = int((normalized_center_x * video_width) - (new_width / 2))
            crop_x = max(0, min(ideal_x, video_width - new_width))
            crop_y = 0
            
            return f"crop={new_width}:{new_height}:{crop_x}:{crop_y}"
        else:
            # Video is taller. Crop height (rare for vertical video targets, but handled)
            new_width = video_width
            new_height = int(video_width / target_ratio)
            crop_x = 0
            crop_y = int((video_height - new_height) / 2)
            
            return f"crop={new_width}:{new_height}:{crop_x}:{crop_y}"
