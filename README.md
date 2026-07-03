# ClipForge AI

> *"O Cursor para edição de vídeos."*

ClipForge AI é um copiloto de edição de vídeos alimentado por Inteligência Artificial. Ele **não é** um editor de vídeo tradicional baseado em timeline (como Premiere ou CapCut), mas sim um assistente conversacional focado em transformar vídeos longos em conteúdo pronto para redes sociais através de instruções em linguagem natural.

## 🚀 Arquitetura e Tecnologias

O projeto utiliza uma arquitetura baseada em microsserviços para garantir escalabilidade, performance e clara separação de responsabilidades:

- **Frontend (`frontend/`):** Aplicação Next.js (React) focada em uma interface conversacional e "AI First".
- **API Gateway (`backend-go/`):** Desenvolvido em Go. Ponto central que lida com roteamento, banco de dados, WebSockets, etc.
- **AI Engine (`backend/`):** Motor em Python dedicado à IA. Responsável por transcrição veloz de áudio (`faster-whisper`), processamento de linguagem natural (`ollama`) e tomadas de decisão.
- **Render Engine (`backend-render/`):** Motor em Go integrado ao FFmpeg focado na renderização pesada e geração do vídeo final, com suporte a aceleração por hardware (NVIDIA/CUDA).
- **Armazenamento e Mensageria:** PostgreSQL (Banco de Dados Primário) e Redis (Cache e Filas de mensagens).
- **Infraestrutura:** Orquestrado via Docker e Docker Compose.

## 🧠 Como Funciona (AI-First)

1. **Upload e Instrução:** O usuário faz o upload de um vídeo longo e fornece uma instrução simples (ex: *"Encontre os 3 momentos mais virais e adicione legendas estilo TikTok"*).
2. **AI Director:** O *AI Engine* transcreve o áudio e analisa o contexto através de Modelos de Linguagem (LLMs).
3. **Plano de Execução:** A IA entende a intenção e elabora um plano, que é convertido em uma série de operações matemáticas e lógicas (`EditOperations`).
4. **Renderização:** O *Render Engine* processa sequencialmente as operações de edição, gerando a mídia final sem intervenção manual.
5. **Local e Privado:** O projeto é construído para rodar de forma contida na máquina/servidor, sem enviar seus arquivos de mídia para APIs externas.

## 🛠️ Como Rodar o Projeto (Desenvolvimento Local)

### Pré-requisitos
- [Docker e Docker Compose](https://www.docker.com/products/docker-desktop/) instalados.
- GPU NVIDIA (para aceleração do *AI Engine* e *Render Engine*, requer os drivers e o NVIDIA Container Toolkit instalados).
- Se estiver rodando o Ollama localmente (fora do Docker), certifique-se que a porta `11434` está acessível.

### Passos

1. Na raiz do projeto, construa e inicie os containers executando:
   ```bash
   docker compose up -d --build
   ```

2. O Docker Compose iniciará todos os serviços necessários em segundo plano:
   - **Frontend:** Disponível em [http://localhost:3000](http://localhost:3000)
   - **Gateway (API):** Disponível em [http://localhost:8000](http://localhost:8000)
   - **Banco de Dados (Postgres):** Porta 5432
   - **Mensageria (Redis):** Porta 6379
   - **Engines (AI & Render):** Comunicação interna via filas e APIs locais.

3. Acesse o Frontend pelo navegador e comece a editar.

## 📜 Filosofia do Projeto

A evolução do ClipForge é estritamente ditada pelo documento interno `PROJECT_PRINCIPLES.md`. Entre as regras de ouro estão:

- **Conversacional:** O usuário não deve pensar *"Estou editando vídeos"*, mas sim *"Estou conversando com uma IA que está editando para mim"*.
- **Timeline é secundária:** A fonte de verdade é a lista de operações. A IA atua como um diretor, e qualquer edição manual extraída da visualização deve ser apenas um ajuste, não o foco principal.
- **Escalonável:** Serviços em Go cuidam do tráfego e infraestrutura de alta concorrência; Python é isolado apenas para as tarefas pesadas de Inteligência Artificial.
