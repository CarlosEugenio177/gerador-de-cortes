# CLIPFORGE AI — AUDITORIA DE ARQUITETURA E PLANO DE ESTABILIZAÇÃO

## 1. Contexto Executivo
A ativação da renderização via hardware (NVENC) no Go Render Engine reduziu o tempo de processamento de vídeos finais de minutos para segundos. Esta melhoria massiva alterou fundamentalmente o perfil de performance do sistema: o gargalo principal deixou de ser a renderização (I/O e CPU) e migrou para a camada de I/O de disco inicial e as etapas de Inteligência Artificial (VRAM e Compute da GPU no Python AI Engine). 

Esta auditoria técnica documenta a análise pós-NVENC, com foco em previsibilidade, observabilidade e escala do pipeline (Go, Python, Redis, NVENC, PostgreSQL), alinhado aos princípios estritos do projeto.

---

## 2. Análise Completa do Pipeline

### 2.1. Upload (Go Gateway)
- **Tamanho médio dos vídeos:** Alto (50MB a múltiplos GBs, comum em podcasts).
- **Tempo de upload e Gargalos de IO:** Fortemente limitado pela banda do servidor e, principalmente, por I/O e IOPS de disco local na gravação.
- **Cópias desnecessárias de arquivos:** O gateway atualmente faz bypass ou cache local, forçando disco; o AI Engine (Python) e o Render (Go) posteriormente lêem o mesmo disco repetidas vezes. 
- **Conclusão de Auditoria:** O upload inicial deve parar de tocar no disco do servidor Go local. A rota precisa migrar para *Direct Upload* (S3 Presigned URLs via frontend).

### 2.2. Extração de Áudio (Python / FFmpeg)
- **Tempo e Uso:** Extremamente rápido. CPU-bound moderado (ffmpeg demux).
- **Uso de GPU:** Zero (desnecessário para recode de áudio).
- **Arquivos temporários:** O sistema gera um `.wav` físico temporário para o Whisper. Trata-se de lixo de disco e I/O que pode falhar em limpezas de erro hard.
- **Conclusão de Auditoria:** Pode ser otimizado transferindo por *pipe (`|`)* direto para memória ou usando disco virtual (`/dev/shm`), mitigando uso de SSD físico em larga escala.

### 2.3. Whisper (Python AI Engine)
- **Tempo Médio:** Mapeado em escala de tempo moderada. Transcrições de long-form demandam alto compute.
- **VRAM utilizada e Paralelização:** Consome altíssima VRAM. A paralelização (múltiplas transcrições simultâneas na mesma placa) quase inevitavelmente resulta em `CUDA Out of Memory`.
- **Tamanho de Lotes / Segmentos:** Opera sobre chunks padrão da biblioteca (`faster-whisper`), mas a divisão impõe overhead se a placa também estiver carregando outros modelos.
- **Possibilidade de Cache:** Ótimo estado atual graças à deduplicação via `MD5` já implementada.
- **Conclusão de Auditoria:** Whisper e Ollama lutando pela mesma VRAM é um dos maiores pontos de risco atuais. Um *Lock Global de VRAM* ou arquitetura Serverless externa focada para modelos é necessária para estabilidade.

### 2.4. Ollama (Python AI Engine)
- **Tempo Médio / Gargalos:** **É o novo gargalo principal do sistema.** O processo de inteligência semântica consome tempo massivo por inferência.
- **Contexto, Tokens e Chamadas:** Conforme evidenciado na arquitetura atual (`blocos sequenciais de 15s`), o LLM processa o conteúdo fragmentado. Múltiplas chamadas (uma por bloco) criam latência aditiva irreal.
- **Possibilidade de Reduzir Chamadas:** Gigantesca. A substituição por *Large Context Prompting* enviando todo o script de uma vez, solicitando um JSON estruturado com timestamps de todos os cortes virais em *apenas uma* iteração.

### 2.5. Render (Go + NVENC)
- **Throughput e Utilização:** Throughput incrivelmente veloz. CPU baixa (apenas coordenação FFmpeg). Disco I/O intenso (escrita do .mp4).
- **Utilização de GPU (NVENC):** NVENC usa os encoders/decoders físicos do chip, aliviando CUDA cores.
- **Gargalo / Risco:** Limite de Sessões da NVIDIA. GPUs da linha GeForce (não-Quadro) possuem um hard-limit de conexões NVENC simultâneas (geralmente 3 a 8).
- **Conclusão de Auditoria:** Se o motor receber um *burst* de operações na fila, o FFmpeg falhará silenciosamente devolvendo erros. É mandatório aplicar *Semaphore Lock* no Go para segurar a fila local.

### 2.6. Redis
- **Tamanho das Filas e Retries:** O Redis lida bem com Pub/Sub instantâneo, mas workers da IA costumam travar via Kill Signal (OOM) e abandonar o Job em estado "processando".
- **Cancelamentos:** *Graceful Cancellation* está operacional (conforme documentação), mas jobs "mortos" pelo SO (crash físico de VRAM) não são limpos por ele.
- **Conclusão de Auditoria:** Faltam políticas de *Visibility Timeout* e *Dead Letter Queue* robustas para re-encaminhamento de jobs em caso de queda hard de nó Python.

### 2.7. Banco de Dados (Postgres)
- **Quantidades de Escrita:** Excessivas. Atualmente, pipelines costumam gravar o estado de progresso granular (% em %) no banco. 
- **Leituras e Índices:** Requer atenção nos índices das tabelas de `edit_operations` e `clips` por project_id para acelerar joins.
- **Conclusão de Auditoria:** Atualizações em tempo de execução (percentual de progresso, logs transitórios) pertencem APENAS ao Redis e ao WebSocket. O Postgres só deve sofrer `UPDATE` em transições atômicas absolutas de estado final (Ex: de IN_PROGRESS para COMPLETED).

---

## 3. Identificação de Problemas

| Problema | Impacto | Severidade | Solução Arquitetural | Prioridade |
|-----------|----------|------------|----------------------|-------------|
| **Disputa Severa de VRAM (OOM)**: Whisper, Ollama e FFmpeg rodando juntos na mesma placa estouram a memória, quebrando containers. | Queda de Workers, jobs perdidos | **Crítica** | Implementar `Mutex/Lock` na fila, forçando execução sequencial estrita entre Whisper e Ollama. Fazer "unload" agressivo de modelo da RAM. | P0 |
| **Limitação Oculta do NVENC**: Exceder limite de chips de sessão paralela da GPU gerará *fail cascade* na Render Engine. | Vídeos não renderizam | **Alta** | Criar Worker Pool limitado via *Semaphore* (`golang.org/x/sync/semaphore`) no Go (ex: lock max 3/5 workers). Fallback para libx264. | P0 |
| **Orphan Jobs por Hard Kill**: Se o Worker AI sofre *OOM Kill*, o frontend exibe "Processando" eternamente (Zombie State). | Péssima UX e trava a UI | **Alta** | Implementar `Dead Letter Queues` (DLQ), heartbeats, *visibility timeouts* nativos com re-queue de resgate. | P1 |
| **Ollama Sequencial (Blocos de 15s)**: Fragmenta contexto e multiplica o tempo total de geração na API. | Tempo inaceitável em vídeos longos | **Alta** | Transição iminente para *Large Context Windows* via Llama-3 enviando um array JSON unificado num *single shot*. | P1 |
| **Saturação de IOPS no Disco Local**: Cópias múltiplas do vídeo na triagem Gateway -> Worker -> Render destrói performance em picos. | Lentidão Global e Storage cheio | **Média** | Mudar uploads para AWS S3 Presigned URLs diretamente do Next.js. O sistema lê os arquivos via streams (cloud). | P2 |

---

## 4. Identificação de Gargalos

| Serviço | Tempo Médio | CPU | GPU | Memória RAM | Escalabilidade |
|----------|-------------|-----|-----|-------------|----------------|
| **Ollama (AI Engine)** | **Lento** (Novo Gargalo Principal) | Moderada | **Altíssima** (VRAM Limitada) | Alta | Baixa (Requer hardware premium) |
| **Whisper (AI Engine)**| Moderado | Moderada| Alta | Média | Baixa (Concorre por HW limitante)|
| **Render Engine (NVENC)**| Extremamente Rápido | Baixa | Média (Chip Limit/Sessões) | Baixa | Média (Concorrência baseada no limite NVENC) |
| **Upload Gateway** | Limitado por banda | Baixa | Zero | Alta | Alta (Pode ser aliviado usando nuvem/S3 direct) |
| **Mensageria (Redis)** | Milissegundos | Baixa | Zero | Baixa | Altíssima |

---

## 5. Riscos Iminentes de Produção

1. **Vazamentos de Memória de IA (VRAM Leak):** Modelos não sendo devidamente descarregados da VRAM pós-transcrição, impedindo renderização NVENC posterior.
2. **Filas Infinitas e Deadlocks:** Jobs paralisados em instâncias zumbis impedem o progresso de novos uploads.
3. **Escritas Abusivas no Postgres:** Fazer commits repetitivos de `10%, 20%, 30%` cria overhead de transação inútil.
4. **Armazenamento (Storage Blood):** Uploads de 2GB multiplicados em diretórios temporários para extração `.wav` e proxy que falham em ser removidos com OOM Kills.

---

## 6. Plano de Observabilidade

Para suportar métricas de alta frequência sem dependência massiva de prints e debug solto, o sistema precisa dos seguintes pilares:

### 6.1. Métricas (Prometheus / StatsD Standard)

`project_metrics` padrão da plataforma:

*   `clipforge_upload_ms`
*   `clipforge_audio_extract_ms`
*   `clipforge_whisper_ms`
*   `clipforge_llm_inference_ms`
*   `clipforge_render_ms`
*   `clipforge_total_pipeline_ms`
*   `clipforge_video_size_mb`
*   `clipforge_video_duration_sec`
*   `clipforge_gpu_used_percent`
*   `clipforge_vram_used_mb`
*   `clipforge_cache_hit_total` (Deduplicação MD5)
*   `clipforge_orphaned_jobs_total`

### 6.2. Logs Estruturados Globais (JSON Stdout)

Toda linha de print nas engrenagens (Go e Python) deverá seguir formato centralizado. Isso permitirá ingestão crua no Grafana Loki / Elastic:

```json
{
  "timestamp": "2026-07-07T14:35:10.000Z",
  "project_id": "cfae-4f11-92b0-8c9e54a9d7b2",
  "service": "ai-engine",
  "stage": "whisper_transcription",
  "duration_ms": 14350,
  "cpu_percent": 12.5,
  "gpu_percent": 88.0,
  "vram_mb": 4200,
  "status": "success",
  "error_msg": null,
  "metadata": {
    "original_duration_s": 600,
    "model": "large-v3"
  }
}
```

---

## 7. Roadmap Estratégico

### Sprint 1: Proteção e Estabilidade Básica
*Foco: Impedir o sistema de cair por conta própria e corrigir os hard kills silenciosos.*
- Implementar **Global GPU Lock (Mutex Redis)** garantindo que Whisper e Ollama e NVENC respeitem as limitações físicas da placa, rodando estritamente segmentados na VRAM.
- Criar **Render Concurrency Limiter (Semaphore)** em Go limitando simultaneidade do FFmpeg NVENC (ex: Max 3 jobs). Fallback mapeado para x264 (CPU) em picos.
- Ativar **Dead Letter Queue (DLQ)** e heartbeats de workers celestiais para resgatar/notificar o falecimento de containers AI.

### Sprint 2: Otimização Radical do Cérebro (Escalabilidade AI)
*Foco: Derreter os tempos mortos e multiplicar a velocidade da IA.*
- Substituir blocos "Ollama de 15s" por iteração **Single-Shot (Large Context)** com `Structured Output JSON`.
- Finalizar a camada de logs em formato JSON e injetar o middleware de `Prometheus` nos endpoints do Go para rastrear latências granulares por rotas de websocket e serviços de edição.
- Redirecionar atualizações progressivas (`progress_percentage`) e logs em tempo real estritamente para Redis Pub/Sub; DB reserva-se apenas a Status finais.

### Sprint 3: Alívio Estrutural I/O (Otimização de Disco)
*Foco: Prevenir o SSD do servidor de afogar em gravação e extração.*
- Converter Next.js para fazer uploads puramente via AWS S3 (Presigned URLs) – Go Gateway atua apenas de intermediador sem tocar no vídeo físico pesado.
- Redirecionar extração de arquivo temporário `.wav` do FFmpeg para bufferização direta em memória ou uso nativo do `/dev/shm` virtual do Linux para o Whisper.
- Deploy de Garbage Collector assíncrono final ("Deep Cleanup Cron") com sweep diário.

### Sprint 4: Produção e Feature Parity
*Foco: Resguardar operações com observabilidade clara e entregar inovações.*
- Conectar Dashboards no Grafana monitorando ativamente os gargalos traçados nas métricas `clipforge_*`.
- Implementação gradual de *B-Roll Overlay* semântico.
- Suporte experimental a **Diarização (Pyannote)** logo após o Whisper para multi-câmeras em podcasts.
