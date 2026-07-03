# Gerador de Cortes (ClipForge AI)

Este projeto é uma API em Python/FastAPI que recebe vídeos e utiliza Inteligência Artificial para gerar cortes curtos e virais automaticamente. 

## 🚀 Arquitetura e Tecnologias

- **Backend:** FastAPI (Python 3.12)
- **Banco de Dados:** PostgreSQL (via SQLAlchemy)
- **Mensageria & Workers:** Redis e Celery para processamento assíncrono em background
- **Inteligência Artificial:** 
  - `faster-whisper`: Transcrição de áudio via GPU.
  - `ollama`: Processamento de linguagem natural (momentos virais).
- **Processamento de Mídia:** FFmpeg e OpenCV.
- **Infraestrutura:** Docker e Docker Compose.

## 🧠 Como a IA funciona (Inferência vs Treinamento)

**Você não precisa treinar a inteligência artificial!** O projeto já está configurado para utilizar modelos pré-treinados state-of-the-art.

- **Inferência Automática:** Quando um vídeo é enviado para a API, o `Celery Worker` inicia o trabalho. Na primeira vez que rodar, a biblioteca `faster-whisper` fará o download do modelo (ex: tamanho `base`) automaticamente para a sua máquina e o carregará diretamente na memória da placa de vídeo (VRAM).
- **Processamento Local:** Tudo roda de maneira isolada no container e localmente, sem depender de APIs pagas externas de IA para a transcrição.

## 🛠️ Como rodar o projeto

Certifique-se de ter o [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando.

1. Na raiz do projeto, execute o comando:
   ```bash
   docker compose up -d --build
   ```
2. O Docker irá baixar os serviços, construir a imagem da API e do Worker e rodar tudo em segundo plano.

## 🧪 Como testar

### 1. Testando via Interface do Swagger (Manual)
Com os containers rodando, acesse a documentação interativa da API no seu navegador:
- **Acesse:** [http://localhost:8000/docs](http://localhost:8000/docs)
- Lá você verá todos os endpoints (ex: Autenticação, Upload de Projetos).
- Você pode criar um usuário, fazer login e criar um projeto de vídeo para acionar o Worker.

### 2. Rodando Testes Automatizados (Pytest)
O backend possui testes implementados. Para rodar a suíte de testes por dentro do container do Docker:
```bash
docker exec -it clipforge_web pytest tests/ -v
```

## 📁 Estrutura do Backend
- `app/api/`: Rotas expostas no FastAPI.
- `app/services/`: Lógica de negócio e serviços de Inteligência Artificial (`transcription.py`).
- `app/workers/`: Configuração do Celery e tarefas em background (`tasks.py`).
- `app/models/`: Estrutura das tabelas no banco de dados.
