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
    
    stream_name = "stream:analyze"
    group_name = "python_ai_group"
    import socket
    consumer_name = f"python_worker_{socket.gethostname()}"

    try:
        r.xgroup_create(stream_name, group_name, id='0', mkstream=True)
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP Consumer Group name already exists" not in str(e):
            print(f"Error creating group: {e}")

    print(f"Listening for tasks on '{stream_name}' stream...")
    while True:
        try:
            results = r.xreadgroup(group_name, consumer_name, {stream_name: '>'}, count=1, block=5000)
            if not results:
                continue
            
            for stream, messages in results:
                for message_id, message_data in messages:
                    payload_bytes = message_data.get(b'payload', b'{}')
                    payload = json.loads(payload_bytes.decode('utf-8'))
                    
                    project_id = payload.get("project_id")
                    file_path = payload.get("file_path")
                    # Utilize the audio file if extracted by Go
                    audio_path = payload.get("audio_path")
                    if audio_path and os.path.exists(audio_path):
                        payload["file_path_for_audio"] = audio_path

                    prompt = payload.get("prompt", "")
                    
                    task_type = payload.get("type", "process")
                    
                    print(f">>> Received AI Task ({task_type}) for Project ID: {project_id}")
                    
                    proxy_path = payload.get("proxy_path")
                    
                    if task_type == "transcribe":
                        from app.workers.tasks import run_transcribe_video
                        asyncio.run(run_transcribe_video(project_id, file_path))
                    elif task_type == "render_custom":
                        from app.workers.tasks import run_render_custom
                        style_config = payload.get("style_config", {})
                        asyncio.run(run_render_custom(project_id, file_path, style_config))
                    else:
                        asyncio.run(run_process_video(project_id, file_path, prompt, audio_path, proxy_path))
                        
                    print(f"<<< Completed Task ({task_type}) for Project ID: {project_id}")
                    r.xack(stream_name, group_name, message_id)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"!!! Error processing task: {e}")

if __name__ == "__main__":
    start_worker()
