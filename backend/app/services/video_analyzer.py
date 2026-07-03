import cv2
import logging
import numpy as np
from typing import List, Dict

logger = logging.getLogger(__name__)

class VisualScoringService:
    def __init__(self):
        # Load the pre-trained Haar Cascade for face detection
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    def analyze_block_visuals(self, video_path: str, start_time: float, end_time: float) -> float:
        """
        Analyzes the visual quality of a specific video block.
        Scores based on face presence, face size (close-ups are better), and sharpness.
        Returns a score from 0.0 to 100.0
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"VisualScoring: Failed to open video {video_path}")
            return 50.0  # Default neutral score
            
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps == 0:
            fps = 30.0
            
        duration = end_time - start_time
        if duration <= 0:
            return 50.0
            
        # To be fast, we sample up to 5 frames spread across the block
        samples = 5
        step_time = duration / samples
        
        frame_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        frame_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        frame_area = frame_width * frame_height
        
        face_scores = []
        sharpness_scores = []
        
        for i in range(samples):
            current_time = start_time + (i * step_time)
            frame_idx = int(current_time * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            
            ret, frame = cap.read()
            if not ret:
                continue
                
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Sharpness (Laplacian variance)
            variance = cv2.Laplacian(gray, cv2.CV_64F).var()
            # Normalize sharpness (variance > 100 is usually not blurry, but varies by video)
            sharp_score = min(variance / 5.0, 100.0)
            sharpness_scores.append(sharp_score)
            
            # Detect faces
            faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            
            if len(faces) > 0:
                # Find the largest face
                largest_face = max(faces, key=lambda rect: rect[2] * rect[3])
                x, y, w, h = largest_face
                face_area = w * h
                
                # Calculate relative face size (0.0 to 1.0)
                # A face taking 10% of the screen is a nice medium shot. 20% is a close-up.
                relative_size = face_area / frame_area
                
                # Convert to score (0 to 100)
                # If relative size is > 0.02 (2%), it starts scoring well. Max out around 0.15 (15%).
                fs = min((relative_size / 0.15) * 100.0, 100.0)
                # Give a flat bonus just for having a face
                fs = max(fs, 40.0)
                face_scores.append(fs)
            else:
                face_scores.append(0.0)
                
        cap.release()
        
        if not face_scores:
            return 50.0
            
        # Calculate final visual score
        avg_face_score = float(np.mean(face_scores))
        avg_sharpness = float(np.mean(sharpness_scores))
        
        # We heavily weight the face score (80%) and slightly weight sharpness (20%)
        # If there's no face, max score is essentially 20. If blurry, penalty.
        final_visual_score = (avg_face_score * 0.8) + (avg_sharpness * 0.2)
        
        return min(max(final_visual_score, 0.0), 100.0)
