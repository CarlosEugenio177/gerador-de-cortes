import requests
import sys
import os

def upload_video(file_path):
    url = os.getenv("API_URL", "http://localhost:8000/api/v1/projects")

    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' does not exist.")
        return
    
    try:
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f, 'video/mp4')}
            data = {
                'title': f'Deduplication Test - {os.path.basename(file_path)}',
                'prompt': 'clip_quantity: 1, duration_request: 0.5 minutes'
            }
            print(f"Uploading {file_path} to {url}...")
            response = requests.post(url, files=files, data=data)
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"Error during upload: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_file = sys.argv[1]
    else:
        print("Usage: python test_upload.py <video_file_path>")
        sys.exit(1)
    upload_video(target_file)
