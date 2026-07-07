# CHECKPOINT - ClipForge AI

Este arquivo é a memória persistente do projeto e a fonte de verdade sobre a arquitetura e estado atual. Deve ser lido antes de qualquer implementação e atualizado ao final da mesma.

---

## 1. Visão Geral do Projeto

* **Objetivo do produto:** Receber vídeos (podcasts, palestras, etc) e usar Inteligência Artificial local para gerar cortes (clips) curtos, dinâmicos e virais, automaticamente em formato vertical (9:16) com legendas.
* **Stack utilizada:** Python 3.12, FastAPI, PostgreSQL (SQLAlchemy), Redis, Celery, Docker.
* **Arquitetura atual:** Monolito Backend (API) acoplado a um Celery Worker Assíncrono com suporte a GPU para processamento pesado de IA (Whisper) e vídeo (FFmpeg).
* **Status geral do projeto:** Backend e Pipeline base funcionais. Falta refinamento e Interface de Usuário (Frontend).

**Estado atual do MVP:**
* Backend: 90%
* Frontend: 100%
* Pipeline IA: 85%
* Produto utilizável: 50% (Acessível apenas via Swagger/API e terminal).

---

## 2. Estrutura Atual

### Árvore Resumida de Diretórios
```text
e:\gerador de cortes\
├── docker-compose.yml
├── backend/
    ├── Dockerfile
    ├── alembic.ini
    ├── requirements.txt
    ├── uploads/
    └── app/
        ├── api/v1/          # Rotas REST
        ├── core/            # Configurações globais
        ├── models/          # Entidades do DB
        ├── services/        # Regras de Negócio
        └── workers/         # Celery Tasks
```

### Principais Módulos / Serviços
* `transcription.py`: Lida com Faster-Whisper para transcrição em nível de palavra.
* `llm.py`: Lida com Ollama (Llama 3) para extrair momentos virais e calcular score.
* `video.py`: Orquestra o FFmpeg para cortar, converter e inserir legendas.
* `subtitle.py`: Gera os arquivos `.ass` a partir da transcrição em nível de palavra.
* `auth.py`: Autenticação JWT.

### Workers Existentes
* `app.workers.tasks.process_video_task`: Pipeline assíncrono completo que une a extração, transcrição, análise e corte.

### Endpoints Existentes
* Rotas de Autenticação (`/api/v1/auth`)
* Rotas de Usuários (`/api/v1/users`)
* Rotas de Projetos/Upload (`/api/v1/projects`)

---

## 3. Banco de Dados

### Tabela: `users`
* **Finalidade:** Gerenciamento de acesso dos usuários.
* **Relacionamentos:** 1:N com `projects` (implícito).
* **Campos Principais:** `id`, `email`, `hashed_password`, `is_active`.

### Tabela: `projects`
* **Finalidade:** Armazenar os projetos de vídeos longos enviados.
* **Relacionamentos:** 1:N com `transcripts`, 1:N com `clips`.
* **Campos Principais:** `id`, `status` (processing, completed, failed), `original_video` (path), `duration`.

### Tabela: `transcripts`
* **Finalidade:** Guardar a transcrição detalhada do projeto para buscas ou uso do LLM.
* **Relacionamentos:** N:1 com `projects`.
* **Campos Principais:** `id`, `project_id`, `start_time`, `end_time`, `text`, `words` (JSON).

### Tabela: `clips`
* **Finalidade:** Armazenar os cortes gerados e seus scores de viralidade.
* **Relacionamentos:** N:1 com `projects`.
* **Campos Principais:** `id`, `project_id`, `start_time`, `end_time`, `viral_score`, `file_path`.

### Tabela: `project_settings`
* **Finalidade:** Armazenar as configurações de edição individuais de cada projeto.
* **Relacionamentos:** 1:1 com `projects`.
* **Campos Principais:** `id`, `project_id`, `remove_silences`, `remove_breaths`, `generate_clips`, `subtitle_style`, `aspect_ratio`, `auto_crop`, `language`.

### Tabela: `edit_operations`
* **Finalidade:** Armazenar a fila de operações de edição (remover silêncio, cortes, crop) do vídeo.
* **Relacionamentos:** N:1 com `projects`.
* **Campos Principais:** `id`, `project_id`, `operation_type`, `parameters`, `start_time`, `end_time`, `status`.

---

## 4. Fluxos de Processamento

**Fluxo Principal (Geração de Cortes):**
Upload de Vídeo
↓
Extração de Áudio (WAV via FFmpeg)
↓
Transcrição Local GPU (Faster-Whisper com timestamps de palavras)
↓
Segmentação da transcrição em blocos de 15 segundos
↓
Cálculo Híbrido (LLM + Heurística) avaliando: hook_score, emotion_score, curiosity_score, llm_score
↓
Mesclagem Inteligente (ClipScoringService) gerando cortes de 30s-60s
↓
Geração de ASS (Legendas)
↓
**Fluxo Secundário (Detecção de Silêncios e Cortes Manuais):**
Upload de Vídeo
↓
Análise de Áudio (silencedetect) ou Input Manual do Usuário
↓
Criação de Operações de Edição (remove_silence, clip, crop) no Banco de Dados
↓
Renderização Background (FastAPI BackgroundTasks ou Celery)
↓
Aplicação das Operações via Timeline Renderer (FFmpeg filter_complex)

---

## 5. Decisões Arquiteturais

* **Utilização de modelos locais (Ollama / Faster-Whisper):**
  * Data: Início do projeto
  * Motivo: Zero custo de API, total privacidade dos dados e independência de internet.
  * Impacto: Requer servidor com GPU (exigência de VRAM para rodar LLM e Whisper), deixando a infraestrutura inicial mais pesada.

* **Utilização de Celery e Redis:**
  * Data: Início do projeto
  * Motivo: Transcrições e renderizações podem demorar vários minutos. Processar isso na requisição HTTP derrubaria a API.
  * Impacto: A API responde rápido e delega ao background, mas adiciona complexidade (dependência do Redis e de Worker isolado).

* **Utilização de FFmpeg e geração de .ass hardcoded:**
  * Data: Início do projeto
  * Motivo: FFmpeg é padrão da indústria, extremamente rápido. Legendas `.ass` permitem customização avançada. Hardcoded pois o destino (Reels/TikTok) exige o vídeo pronto.
  * Impacto: Falta flexibilidade de alterar as legendas depois de geradas; consome processamento para o re-encode.

---

## 6. Funcionalidades Implementadas

* **[Concluído]** Setup Docker, Postgres e Redis (Data: Início do projeto | Arquivos: `docker-compose.yml`, `Dockerfile`)
* **[Concluído]** Pipeline de Transcrição Whisper (Data: Início do projeto | Arquivos: `transcription.py`)
* **[Concluído]** Pipeline de Análise Ollama (Data: Início do projeto | Arquivos: `llm.py`)
* **[Concluído]** Renderização e Queima de Legenda via FFmpeg (Data: Início do projeto | Arquivos: `video.py`, `subtitle.py`)
* **[Concluído]** Worker Celery do Pipeline Completo (Data: Início do projeto | Arquivos: `tasks.py`)
* **[Concluído]** Alembic com suporte JSON para `words` em Transcripts (Data: 2026-06-30 | Arquivos: `dc3cc38d0f99_add_words_to_transcripts.py`)
* **[Concluído]** Configurações de Projeto (Funcionalidade 1) (Data: 2026-07-01 | Arquivos: `models/project_settings.py`, `schemas/project_settings.py`, `repositories/project_settings.py`, `services/project_settings.py`, `endpoints/project_settings.py`, `router.py`, `migrations`)
* **[Concluído]** Operações de Edição (Funcionalidade 2) (Data: 2026-07-01 | Arquivos: `models/edit_operation.py`, `schemas/edit_operation.py`, `repositories/edit_operation.py`, `services/edit_operation.py`, `endpoints/edit_operations.py`, `router.py`, `migrations`)
* **[Concluído]** Detecção de Silêncios (Funcionalidade 3) (Data: 2026-07-01 | Arquivos: `services/silence_detection.py`, `schemas/silence_detection.py`, `endpoints/silence_detection.py`, `router.py`)
* **[Concluído]** Timeline Renderer (Funcionalidade 4) (Data: 2026-07-01 | Arquivos: `services/timeline_renderer.py`)
* **[Concluído]** Corte Manual (Funcionalidade 5) (Data: 2026-07-01 | Arquivos: `schemas/manual_clip.py`, `endpoints/manual_clip.py`, `router.py`)
* **[Concluído]** Múltiplos Formatos (Funcionalidade 6) (Data: 2026-07-01 | Arquivos: `services/aspect_ratio_service.py`, `services/timeline_renderer.py`, `endpoints/manual_clip.py`)
* **[Concluído]** Timeline (Funcionalidade 7) (Data: 2026-07-01 | Arquivos: `schemas/timeline.py`, `endpoints/timeline.py`, `router.py`)
* **[Concluído]** Pipeline de Cortes Inteligentes (Funcionalidade 8) (Data: 2026-07-01 | Arquivos: `services/clip_scoring_service.py`, `services/llm.py`, `workers/tasks.py`)
* **[Concluído]** Estrutura de Saída do LLM (Funcionalidade 9) (Data: 2026-07-01 | Arquivos: `schemas/llm_output.py`, `utils/json_parser.py`, `services/llm.py`)
* **[Concluído]** Sistema de Retentativas (Funcionalidade 10) (Data: 2026-07-01 | Arquivos: `services/transcription.py`, `services/video.py`, `services/llm.py`, `services/timeline_renderer.py`)
* **[Concluído]** JSON Determinístico Ollama (Funcionalidade 11) (Data: 2026-07-01 | Arquivos: `services/llm.py`)
* **[Concluído]** WebSockets para Tempo Real (Funcionalidade 12) (Data: 2026-07-01 | Arquivos: `endpoints/ws.py`, `router.py`, `workers/tasks.py`)
* **[Concluído]** Cloud Storage S3 (Funcionalidade 13) (Data: 2026-07-01 | Arquivos: `services/storage.py`, `workers/tasks.py`)
* **[Concluído]** Face Tracking Dinâmico (Funcionalidade 14) (Data: 2026-07-01 | Arquivos: `services/face_tracking.py`, `services/timeline_renderer.py`)
* **[Concluído]** Frontend Dashboard (Funcionalidade 15) (Data: 2026-07-01 | Arquivos: `main.py`, `templates/index.html`, `static/css/styles.css`, `static/js/app.js`)
* **[Concluído]** Galeria de Exportações e Streaming de Mídia (Funcionalidade 16) (Data: 2026-07-01 | Arquivos: `endpoints/media.py`, `templates/index.html`, `static/js/app.js`)
* **[Concluído]** Sistema de Deleção Profunda (Deep Cleanup) (Funcionalidade 17) (Data: 2026-07-01 | Arquivos: `services/project.py`)
* **[Concluído]** Reescrita total do Frontend para Next.js 14 App Router com Zustand (Funcionalidade 18) (Data: 2026-07-02 | Arquivos: `frontend/src/*`)
* **[Concluído]** Interface Grid Editor "Premium/Arc Style" com Timeline Dinâmica (Funcionalidade 19) (Data: 2026-07-02 | Arquivos: `editor/[id]/page.tsx`, `Timeline.tsx`, `Player.tsx`, `Inspector.tsx`)
---

## 7. Funcionalidades Pendentes

* *(Nenhuma)* Todas as funcionalidades críticas, avançadas e arquiteturais foram implementadas. O projeto ClipForge AI alcançou sua versão de produção v1.0.

---

## 8. Dívidas Técnicas

* *(Nenhuma)* As dívidas técnicas em relação ao parser do JSON (resolvido com Structured Outputs), interface de cortes manuais e legendas dinâmicas estilo Hormozi foram solucionadas e integradas à master.

---

## 9. Próximos Passos e Melhorias Contínuas

### 9.1. Backlog de Melhorias
**Frontend:**
- **Sistema Global de Notificações (Toasts):** Substituir os `alert()` nativos por bibliotecas como `sonner` ou `react-hot-toast` para manter o visual "Premium".

**Backend:**
- **Contexto Visual para a IA (LLaVA/Vision):** Atualmente o Llama avalia a viralidade *apenas* pelo texto (transcrição). Injetar frames do vídeo para que a IA avalie reações físicas/visuais aumentaria drasticamente a qualidade dos cortes.
- **Limpeza Assíncrona (Cron Jobs):** Implementar um worker para varrer o banco e S3 de tempos em tempos, deletando vídeos órfãos ou abandonados há mais de 30 dias para economizar disco.

### 9.2. Roadmap Principal
## Tarefas Concluídas
- [x] **Frontend SPA (ChatThread):** Interface convertida para formato de chat (semelhante ao ChatGPT/Cursor). A interface de "Editor Pro" foi completamente abortada.
- [x] **Go API Gateway:** Implementado o Gateway em Golang (`backend-go`) usando Fiber + GORM + Redis.
- [x] **Morte do Python Web:** Serviço FastAPI (`web`) removido do `docker-compose.yml`. Todo o código HTTP de Python deletado.
- [x] **Comunicação Celery (ai-engine):** O serviço `worker` agora se chama `ai-engine` e opera de forma totalmente invisível, escutando a fila Celery enviada pelo Go.
- [x] **WebSockets Real-time:** Go gerencia WebSockets, escuta o PubSub do Redis, e notifica o frontend nativamente. Front atualizado para usar `WebSocket` no lugar de polling.
- [x] **Limpeza Geral:** Deletados os endpoints legados no frontend (`api.ts`).

## Próximos Passos (To-Do)
- [ ] **Ligar o pipeline Celery real:** Atualmente, o frontend tem mocks de simulação para os Clipes cortados após o processamento. O Python (Celery worker) precisa ser implementado para rodar a inferência real com Ollama + FFmpeg, criar os clips finais e publicá-los no Redis para o Go enviar ao frontend via WS.
- [ ] **Auth no Go:** Implementar registro e login no novo Go Gateway (atualmente mockado/bypassed).
- [ ] **Global Toasts:** Substituir `alert()` por biblioteca de toast (`sonner`) no front.
* Model, Schema, Repository, Service e Endpoints para `EditOperation` (Funcionalidade 2).
* Migração Alembic `52a1b3c4d9e0` para a tabela `edit_operations`.
* Serviço de Detecção de Silêncios via FFmpeg, Schema e Endpoint criando EditOperations (Funcionalidade 3).
* Serviço TimelineRenderer implementando filter_complex com trim/concat/crop/resize (Funcionalidade 4).
* Schema e Endpoint para Corte Manual processando operações e renderizando em Background (Funcionalidade 5).

---

## 10. Histórico de Alterações

### 2026-07-01
#### Adicionado
* Arquivo `CHECKPOINT.md` criado para servir como memória e fonte de verdade da arquitetura do projeto.
* Model, Schema, Repository, Service e Endpoints para `ProjectSettings` (Funcionalidade 1).
* Migração Alembic `e4d5e6f7a8b9` para a tabela `project_settings`.
* Model, Schema, Repository, Service e Endpoints para `EditOperation` (Funcionalidade 2).
* Migração Alembic `52a1b3c4d9e0` para a tabela `edit_operations`.
* Serviço de Detecção de Silêncios via FFmpeg, Schema e Endpoint criando EditOperations (Funcionalidade 3).
* Serviço TimelineRenderer implementando filter_complex com trim/concat/crop/resize (Funcionalidade 4).
* Schema e Endpoint para Corte Manual processando operações e renderizando em Background (Funcionalidade 5).
* Serviço de AspectRatioService com suporte universal a 9:16, 16:9, 1:1 e 4:5 integrado nativamente na TimelineRenderer (Funcionalidade 6).
* Endpoint `GET /projects/{id}/timeline` que constrói a estrutura da Timeline agrupando operações de edição (Funcionalidade 7).
* Novo Pipeline de Cortes Inteligentes (`ClipScoringService`) que avalia blocos de 15s usando heurísticas (Hook, Emotion, Curiosity) e LLM_score, evitando sobrecarga de token no Ollama (Funcionalidade 8).
* Parser JSON robusto (`json_parser.py`) com Regex e fallbacks, além de modelos Pydantic estritos para blindar as saídas do Ollama contra alucinações (Funcionalidade 9).
* Implementação da resiliência de alto nível através da biblioteca `tenacity`, aplicando retentativas e *exponential backoff* em todas as pontas críticas: LLM, Whisper e FFmpeg (Funcionalidade 10).
* Migração do motor LLM para inferência determinística utilizando `Structured Outputs` do Ollama e `Pydantic` schemas (Funcionalidade 11).
* Implementação do `ConnectionManager` no FastAPI via Redis Pub/Sub, empurrando logs e status ao vivo dos workers para os clientes em WebSockets (Funcionalidade 12).
* Abstração total da camada de armazenamento introduzindo uploads diretos para buckets AWS S3 gerenciados pelo `boto3` (Funcionalidade 13).
* Introdução de Visão Computacional através do `SmartCropService` que processa Cascade Classifiers no OpenCV para centralizar perfeitamente o rosto detectado nos clipes 9:16 (Funcionalidade 14).
* Desenvolvimento do Portal Front-end `ClipForge Dashboard`, servido ativamente pelo FastAPI via Jinja templates com design Dark Mode moderno, drag-and-drop uploads e WebSockets (Funcionalidade 15).
* Refatoração do Frontend para "Ultra Premium Dark Mode Glassmorphism", adoção do esquema Zinc/Indigo, Modal dividido por Abas (Timeline e Galeria) e Players Nativos carregando arquivos MP4 localmente e permitindo Downloads (Funcionalidade 16).
* Refatoração da Lógica de Deleção Backend ("Deep Cleanup") que varre o disco baseado em prefixos compartilhados, deletando de uma só vez o vídeo original, arquivos de legenda .ass temporários e todos os vídeos de cortes (AI e Manuais) sem deixar órfãos (Funcionalidade 17).

### 2026-07-02
#### Adicionado / Modificado
* Substituição total do Jinja Dashboard por um aplicativo React Next.js 14 robusto (App Router).
* Implementação de UI com padrão estético "Ultra Premium" utilizando TailwindCSS, variáveis de cores personalizadas, e foco em Glassmorphism e Dark Mode avançado.
* Integração nativa do estado global com `Zustand` (`useProjectStore`, `useAuthStore`).
* Construção do Layout de Editor baseado em Grid: `Player`, `Timeline` e `Inspector`.
* Conexão ativa do Frontend com WebSockets do Backend (`useWebSocket.ts`) para renderizar progresso em tempo real através de Toasts de notificação.
* **Hotfixes:** Resolução do bug de renderização de 1 minuto na Timeline (forçando atualização de duração real na montagem), ativação da funcionalidade matemática de Zoom (pixels/segundo) e correções severas na hierarquia de camadas (`z-index`) e performance de blur CSS para evitar gargalos em placas de vídeo.
* Implementação do carregamento preguiçoso (`next/dynamic`) nas partes críticas do editor para baixar drasticamente o TTI (Time to Interactive).
* Otimização da compilação do `lucide-react` no `next.config.mjs` para acelerar o HMR local.
* **Refatoração da Máquina de Estados e Sincronização do DB:** O Python AI Worker (`tasks.py`) e o Go API Gateway (`events.go`) foram sincronizados usando pub/sub atômico (`events:clips_ready`) para persistir todos os metadados ricos no PostgreSQL antes da renderização, assumindo o DB como a verdadeira Source of Truth.
* **Trava de Idempotência no Render Engine:** Implementado Mutex Distribuído (`SetNX`) via Redis no Go Render Engine (`main.go`) sob o lock `project_id:clip_title` para bloquear jobs simultâneos redundantes e proteger a CPU.
* **Aceleração por GPU Obrigatória:** Injeção forçada do encoder `-c:v h264_nvenc` e `-preset fast` no FFmpeg da pipeline Go para derreter o tempo de processamento.
* **Rehidratação Inteligente (Anti-F5):** Blindagem do `<Suspense>` no Next.js (`page.tsx`) forçando um `fetch()` ativo contra a API logo no mount do frontend. Refreshs constantes agora restauram perfeitamente as telas e a porcentagem.
* **Remoção de Mocks de UI:** Títulos estáticos (`ClipForge Edit`) removidos da home. A forja agora herda processualmente os nomes dos arquivos originais pelo `videoFile.name`.

### 2026-07-03
#### Adicionado / Modificado
* **Modo Edição (Advanced Subtitle Editor):** Implementação de um editor completo no frontend (`TranscriptEditor.tsx` e `StyleEditor.tsx`) permitindo edição palavra-por-palavra e parametrização de estilos (Cor, Fonte, Animações Pop/Karaoke, Preset Hormozi/Netflix).
* **Desacoplamento do Pipeline de IA:** O fluxo de legenda agora é separado em duas etapas manuais controláveis pelo usuário via Go Gateway e Celery: `POST /transcribe` (gera o texto base) e `POST /render-custom` (aplica estilos e renderiza o `.ass` hardcoded).
* **Eventos WebSockets Bi-Direcionais:** O Gateway Go e Frontend foram atualizados para trafegar ativamente a string completa da transcrição pelo socket quando o Python emite `events:transcript_ready`, preenchendo o Zustand instantaneamente.
* **Refatoração do EditorLayout:** O arquivo principal do editor de estúdio dividiu seu Layout Central em "Modo Cortes" (visualizar os 3 highlights de IA extraídos) e "Modo Edição" (Editor UI Pro com três painéis: ferramentas, player central, corretor semântico de palavras).

### 2026-07-07
#### Adicionado / Modificado
* **Implementação Massiva - FASE 1 (Estabilidade e Escalabilidade):**
* **Máquina de Estados Absoluta:** Go Gateway (`project.go`) atualizado para rastrear granularmente `QUEUED_AI`, `TRANSCRIBING`, `ANALYZING`, `BUILDING_TIMELINE`, `QUEUED_RENDER`, etc. O Go é a única fonte de verdade de estado.
* **Sistema de Auditoria Global (AuditLog):** Criada e migrada tabela `audit_logs` no PostgreSQL. `events.go` modificado para gravar logs imutáveis detalhando WorkerID, Stage, Status, Duração e Timestamp para toda transição.
* **Recuperação Automática e Idempotência (Python):** `tasks.py` refatorado para ler checkpoints de disco (`transcript.json`, `moments.json`) antes de realizar o trabalho, evitando desperdício e perdas num reinício.
* **Retentativas Inteligentes:** Introduzido `tenacity` com decorators de exponential backoff nas inferências do Whisper e LLM.
* **Logs Estruturados:** Python AI Engine padronizado com `utils/logger.py` forçando output no formato JSON (`{"stage": "...", "duration_ms": ...}`) para análise semântica em logs.
* **Refatoração de Recovery do Render Engine (Go):** Migrada a comunicação de redis `Lists (BLPop)` para `Streams (XReadGroup)` permitindo `XAck` atômico. Containers do Render que sofrerem hard kill não perdem a task, resgatando automaticamente da PEL (Pending Entries List).
* **Fase 2 (Proxy e Fingerprint):** Implementado cálculo de SHA256 em Go para garantir deduplicação criptograficamente segura na entrada. Adicionado paralelismo usando `asyncio.gather` no AI Engine para gerar assets visuais (waveforms, thumbnails) simultaneamente enquanto o processador GPU extrai o áudio principal, eliminando tempo ocioso.
* **Fase 3 (GPU HWAccel e Fallbacks):** `backend-render` forçado a injetar flag nativa `-hwaccel cuda` antes das streams de input para decodificar vídeos via GPU, livrando a CPU completamente. Também injetado pipeline defensivo que aplica um Fallback de transcode para CPU (`libx264`) de modo automático em caso de esgotamento repentino de VRAM da NVENC, impossibilitando que a API devolva erro para o cliente.
* **Fase 4 (Escalabilidade Horizontal Completa):** Os três motores do sistema (Gateway Go, Python Celery Worker, Render Engine) foram adaptados para ler Redis Streams utilizando `Consumer Names` dinâmicos baseados no Hostname (`os.Hostname()`). Agora, é possível rodar `docker-compose up --scale render-worker=5` ou escalar via Kubernetes sem nenhum collision de ID nas listagens de pendências (PEL) do Redis.


