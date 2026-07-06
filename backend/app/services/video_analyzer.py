import cv2
import logging
import numpy as np
from typing import List, Dict

logger = logging.getLogger(__name__)

class VisualScoringService:
    def __init__(self):
        # Load the pre-trained Haar Cascade for face detection
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    def analyze_all_blocks_visuals(self, video_path: str, blocks: List[Dict], progress_callback=None) -> Dict[int, float]:
        """
        Analyzes the visual quality of all video blocks in a single, sequential pass.
        Uses cap.grab() to fast-forward without decoding, bypassing the massive CPU bottleneck
        of random seeking (cap.set).
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"VisualScoring: Failed to open video {video_path}")
            return {i: 50.0 for i in range(len(blocks))}
            
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps == 0:
            fps = 30.0
            
        frame_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        frame_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        frame_area = frame_width * frame_height
        
        target_frames = {}
        samples_per_block = 5
        
        # 1. Map out all frames we need to decode
        for idx, block in enumerate(blocks):
            duration = block["end_time"] - block["start_time"]
            if duration <= 0:
                continue
            step_time = duration / samples_per_block
            for i in range(samples_per_block):
                time_sec = block["start_time"] + (i * step_time)
                frame_idx = int(time_sec * fps)
                if frame_idx not in target_frames:
                    target_frames[frame_idx] = []
                target_frames[frame_idx].append(idx)
                
        sorted_targets = sorted(target_frames.keys())
        if not sorted_targets:
            cap.release()
            return {i: 50.0 for i in range(len(blocks))}
            
        block_face_scores = {i: [] for i in range(len(blocks))}
        block_sharpness_scores = {i: [] for i in range(len(blocks))}
        
        current_frame = 0
        target_idx = 0
        total_targets = len(sorted_targets)
        
        # 2. Sequential Single-Pass Read using grab()
        while cap.isOpened() and target_idx < total_targets:
            target = sorted_targets[target_idx]
            
            # Fast forward using grab() - skips CPU decoding
            while current_frame < target:
                ret = cap.grab()
                if not ret:
                    break
                current_frame += 1
                
            if current_frame != target:
                break
                
            # Actually decode the frame we need
            ret, frame = cap.retrieve()
            if not ret:
                break
                
            # Process visual metrics
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            variance = cv2.Laplacian(gray, cv2.CV_64F).var()
            sharp_score = min(variance / 5.0, 100.0)
            
            faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            
            face_score = 0.0
            if len(faces) > 0:
                largest_face = max(faces, key=lambda rect: rect[2] * rect[3])
                x, y, w, h = largest_face
                relative_size = (w * h) / frame_area
                fs = min((relative_size / 0.15) * 100.0, 100.0)
                face_score = max(fs, 40.0)
                
            # Assign score to all blocks needing this frame
            for b_idx in target_frames[target]:
                block_face_scores[b_idx].append(face_score)
                block_sharpness_scores[b_idx].append(sharp_score)
                
            current_frame += 1
            target_idx += 1
            
            # Progress callback for the UI
            if progress_callback and target_idx % max(1, total_targets // 20) == 0:
                progress_callback(target_idx, total_targets)
                
        cap.release()
        
        # 3. Aggregate final block scores
        final_scores = {}
        for idx in range(len(blocks)):
            f_scores = block_face_scores[idx]
            s_scores = block_sharpness_scores[idx]
            if not f_scores:
                final_scores[idx] = 50.0
            else:
                avg_face = float(np.mean(f_scores))
                avg_sharp = float(np.mean(s_scores))
                score = (avg_face * 0.8) + (avg_sharp * 0.2)
                final_scores[idx] = min(max(score, 0.0), 100.0)
                
        return final_scores
