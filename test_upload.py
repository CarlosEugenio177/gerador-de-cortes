import requests
import sys

def upload_video(file_path):
    url = "http://localhost:8000/api/v1/projects"
    
    try:
        with open(file_path, 'rb') as f:
            files = {'file': (file_path.split('\\')[-1], f, 'video/mp4')}
            data = {
                'title': 'Automated Deduplication Test',
                'prompt': 'clip_quantity: 1, duration_request: 0.5 minutes'
            }
            print(f"Uploading {file_path} to {url}...")
            response = requests.post(url, files=files, data=data)
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"Error during upload: {e}")

if __name__ == "__main__":
    target_file = r"E:\YTDown_YouTube_BRASIL-X-JAPAO-MINHA-OPINIAO_Media_n2oGMLVHyB0_001_1080p.mp4"
    upload_video(target_file)
