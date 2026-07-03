import asyncio
import redis
import os
import sys
import json

# Adiciona o diretório raiz ao PYTHONPATH para os imports funcionarem
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.workers.tasks import run_process_video

def start_worker():
    print("Starting Custom AI Worker (DB-less)...")
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    
    r = redis.from_url(redis_url)
    
    print("Listening for tasks on 'queue:analyze' list...")
    while True:
        try:
            # Block until a task is available
            queue_name, payload_bytes = r.blpop("queue:analyze")
            payload = json.loads(payload_bytes.decode('utf-8'))
            
            project_id = payload.get("project_id")
            file_path = payload.get("file_path")
            prompt = payload.get("prompt", "")
            
            print(f">>> Received AI Task for Project ID: {project_id}")
            asyncio.run(run_process_video(project_id, file_path, prompt))
            print(f"<<< Completed Task for Project ID: {project_id}")
            
        except Exception as e:
            print(f"!!! Error processing task: {e}")

if __name__ == "__main__":
    start_worker()
