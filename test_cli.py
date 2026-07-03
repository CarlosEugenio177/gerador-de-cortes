import os
import requests
import sys

BASE_URL = "http://localhost:8000/api/v1"

def main():
    if len(sys.argv) < 2:
        print("Uso: python test_cli.py <caminho_do_video.mp4>")
        sys.exit(1)

    video_path = sys.argv[1]
    if not os.path.exists(video_path):
        print(f"Erro: O arquivo {video_path} não existe.")
        sys.exit(1)

    # 1. Fazer Login
    print("Fazendo login com carlo@example.com...")
    login_data = {
        "username": "carlo@example.com",
        "password": "1112345"
    }
    # A rota de login do FastAPI pede form-data padrão OAuth2
    response = requests.post(f"{BASE_URL}/auth/login", data=login_data)
    
    if response.status_code != 200:
        print(f"Falha no login: {response.text}")
        sys.exit(1)
        
    token = response.json()["access_token"]
    print("Login bem sucedido! Token de segurança (JWT) capturado.")

    # 2. Criar Projeto fazendo o Upload do Vídeo
    print(f"\nFazendo upload do vídeo '{video_path}'...")
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    with open(video_path, "rb") as f:
        files = {"file": (os.path.basename(video_path), f, "video/mp4")}
        data = {"title": "Meu Primeiro Teste via CLI"}
        
        response = requests.post(f"{BASE_URL}/projects/", headers=headers, data=data, files=files)
        
    if response.status_code == 201:
        project = response.json()
        print("\n✅ Sucesso! Projeto criado e enviado para a fila do Celery Worker.")
        print(f"ID do Projeto: {project['id']}")
        print(f"Status: {project['status']}")
        print("\nPara ver o status atualizado depois, use o comando:")
        print(f"curl -H \"Authorization: Bearer {token}\" {BASE_URL}/projects/{project['id']}")
    else:
        print(f"Falha no upload: {response.text}")

if __name__ == "__main__":
    main()
