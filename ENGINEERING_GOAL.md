# CLIPFORGE AI — ENGINEERING GOAL 

> Este documento é a fonte de verdade das prioridades de engenharia do ClipForge AI.
> Deve ser lido antes de qualquer implementação e atualizado sempre que uma grande decisão arquitetural for tomada.

---

# 🎯 VISÃO DO PRODUTO

ClipForge AI NÃO é um editor de vídeo tradicional.

Não estamos construindo:

- CapCut;
- Premiere;
- DaVinci.

Estamos construindo:

> O Cursor/V0 para edição de vídeos.

A edição acontece através de linguagem natural.

O usuário descreve o resultado desejado.

A IA traduz a intenção para uma sequência de EditOperations.

A Timeline é apenas uma representação visual das operações executadas.

---

# PRINCÍPIOS INEGOCIÁVEIS

## AI-First

O chat é a interface principal.

A timeline é secundária.

---

## Determinístico

A IA nunca modifica o vídeo diretamente.

Ela apenas gera instruções.

Exemplo:

```json
[
  {
    "operation": "remove_silence"
  },
  {
    "operation": "generate_clips"
  },
  {
    "operation": "crop",
    "parameters": {
      "aspect_ratio": "9:16"
    }
  }
]
```

O backend executa essas operações de maneira determinística.

---

## Escalabilidade primeiro.

Não implementar novas features antes de resolver:

- performance;
- filas;
- renderização;
- estado;
- observabilidade.

---

# ROADMAP DOS PRÓXIMOS 60 DIAS

Toda implementação deve priorizar exclusivamente estes objetivos.

---

# PRIORIDADE 1 — PROXY MEDIA

## Objetivo

Evitar que o sistema processe e edite vídeos gigantes durante a experiência de usuário.

---

## Implementar

```text
original.mp4
proxy_720.mp4
proxy_480.mp4
thumbnail.webp
audio.wav
```

---

## Fluxo

Upload
↓
Gerar Proxies
↓
Extrair Áudio
↓
IA
↓
Render Final usando Original

---

## Regras

- Editor utiliza proxies.
- Render final utiliza original.
- Nunca reprocessar o original desnecessariamente.

---

# PRIORIDADE 2 — CACHE DE IA

## Objetivo

Evitar rodar Whisper e LLM novamente.

---

## Persistir:

- transcript
- moments
- scores
- face coordinates
- generated clips

---

## Regras

Mudou:

- legenda
- crop
- aspect ratio
- efeitos

↓

Apenas re-renderizar.

Nunca rodar IA novamente.

---

# PRIORIDADE 3 — REDIS STREAMS

## Objetivo

Substituir filas simples.

---

## Criar:

```text
upload_stream
preprocessing_stream
transcription_stream
analysis_stream
render_stream
delivery_stream
```

---

## Implementar:

- consumer groups
- retries
- dead letter queue
- idempotência

---

# PRIORIDADE 4 — STATE MACHINE

## Objetivo

Persistir todo o ciclo de vida do projeto.

---

## Estados:

```text
UPLOADING
PREPROCESSING
TRANSCRIBING
ANALYZING
RENDERING
EXPORTING
COMPLETED
FAILED
```

---

## Regras

O PostgreSQL é a única fonte de verdade.

Nunca confiar em:

- memória;
- websocket;
- frontend.

---

# PRIORIDADE 5 — ELIMINAR MOCKS

## Objetivo

Todo o fluxo deve ser real.

---

## Fluxo:

Frontend
↓
Gateway Go
↓
Redis
↓
Python Worker
↓
Render Worker
↓
Storage
↓
WebSocket
↓
Frontend

---

Nenhum dado mockado.

Nenhum vídeo fake.

Nenhum progresso fake.

---

# PRIORIDADE 6 — OBSERVABILIDADE

## Objetivo

Transformar o sistema em produção real.

---

## Implementar

### Logging estruturado

- request_id
- project_id
- worker_id

### Metrics

- tempo de transcrição
- tempo de render
- uso de GPU
- tamanho das filas
- falhas

### Tracing

- upload
- preprocess
- transcription
- llm
- render

---

# NÃO IMPLEMENTAR AGORA

❌ YOLO

❌ Visão Computacional avançada

❌ Mobile

❌ Integrações com TikTok

❌ Design extra

❌ Novas features de IA

---

# DEFINIÇÃO DE SUCESSO

Ao final destes 60 dias o ClipForge deve:

✅ Processar vídeos de forma confiável.

✅ Suportar crescimento de usuários.

✅ Possuir filas resilientes.

✅ Persistir estado corretamente.

✅ Re-renderizar sem reprocessar IA.

✅ Utilizar GPU de forma eficiente.

✅ Possuir observabilidade completa.

✅ Funcionar como um produto real e escalável.

---

# REGRA ABSOLUTA

Antes de qualquer nova feature, pergunte:

> "Isso melhora a escalabilidade, robustez ou experiência principal do usuário?"

Se a resposta for NÃO:

Não implementar agora.

---

# MEMÓRIA PERMANENTE

Este documento deve ser tratado como:

```text
Fonte de Verdade Arquitetural
+
Meta de Engenharia dos próximos 60 dias
+
Guia de Prioridades do Projeto
```

Toda IA, desenvolvedor ou agente que trabalhar no projeto deve ler:

1. CHECKPOINT.md
2. PROJECT_PRINCIPLES.md
3. ENGINEERING_GOAL.md

antes de iniciar qualquer implementação.
