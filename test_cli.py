import os
import requests
import sys

BASE_URL = os.getenv("API_URL", "http://localhost:8000/api/v1")

def main():
    if len(sys.argv) < 2:
        print("Uso: python test_cli.py <caminho_do_video.mp4> [prompt]")
        sys.exit(1)

    video_path = sys.argv[1]
    prompt = sys.argv[2] if len(sys.argv) > 2 else "Gere 3 cortes curtos com legendas"

    if not os.path.exists(video_path):
        print(f"Erro: O arquivo {video_path} não existe.")
        sys.exit(1)

    print(f"\nFazendo upload do vídeo '{video_path}' para {BASE_URL}/projects...")
    with open(video_path, "rb") as f:
        files = {"file": (os.path.basename(video_path), f, "video/mp4")}
        data = {
            "title": f"Teste CLI - {os.path.basename(video_path)}",
            "prompt": prompt
        }
        response = requests.post(f"{BASE_URL}/projects", data=data, files=files)

    if response.status_code in (200, 201):
        project = response.json()
        print("\n✅ Sucesso! Projeto criado e enviado para o Go Gateway.")
        print(f"ID do Projeto: {project.get('id')}")
        print(f"Status: {project.get('status')}")
    else:
        print(f"Falha no upload ({response.status_code}): {response.text}")

if __name__ == "__main__":
    main()
