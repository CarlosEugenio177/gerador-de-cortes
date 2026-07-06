# CLIPFORGE AI — PROJECT CONSTITUTION

Este documento é a fonte de verdade sobre a filosofia do produto.

Toda implementação de frontend, backend, banco de dados, arquitetura e IA deve respeitar estas diretrizes.

Se alguma mudança violar estes princípios, ela NÃO deve ser implementada.

---

# 1. MISSÃO

Transformar vídeos longos em conteúdo pronto para redes sociais utilizando Inteligência Artificial.

O usuário deve conseguir gerar vídeos profissionais através de linguagem natural.

O produto não é um editor de vídeo tradicional.

O produto é um copiloto de edição por IA.

---

# 2. VISÃO DE LONGO PRAZO

Queremos construir:

"Cursor para edição de vídeos."

ou

"V0.dev para criação de conteúdo."

A IA deve entender intenções e executar o trabalho de edição.

---

# 3. FILOSOFIA DE PRODUTO

O usuário nunca deve pensar:

"Estou editando vídeos."

O usuário deve pensar:

"Estou conversando com uma IA que está editando vídeos para mim."

---

# 4. O QUE O CLIPFORGE NÃO É

❌ CapCut
❌ Premiere
❌ DaVinci Resolve
❌ Filmora
❌ Editor de vídeo tradicional
❌ Timeline-first
❌ Ferramenta profissional intimidadora

---

# 5. O QUE O CLIPFORGE É

✅ AI First
✅ Conversacional
✅ Automático
✅ Simples
✅ Produtivo
✅ Premium
✅ Criador de conteúdo assistido por IA

---

# 6. PRINCÍPIO FUNDAMENTAL

A IA é o centro do produto.

A Timeline é secundária.

A edição manual é opcional.

Toda nova funcionalidade deve ser avaliada sob esta pergunta:

"Isso deixa a IA mais poderosa ou apenas adiciona complexidade?"

Se apenas adiciona complexidade, não implementar.

---

# 7. FRONTEND PRINCIPLES

## A Home deve possuir apenas:

1. Upload de vídeo
2. Campo de prompt
3. Botão de geração

Nada além disso.

---

# Fluxo principal

Entrar
↓

Arrastar vídeo
↓

Escrever instrução
↓

Processamento
↓

Receber resultados

---

# O Editor Pro não existe mais
Toda edição deve ser resolvida via Chat/Prompt. Não há fallback para edição manual.

---

# Referências Visuais

Inspirar-se em:

- ChatGPT
- Claude
- V0
- Cursor
- Arc Browser
- Linear
- Notion AI
- Perplexity

Não se inspirar em:

- CapCut
- Premiere
- DaVinci
- Filmora
- Vegas

---

# Design System

Background:
#07070A

Surface:
#111118

Primary:
#8B5CF6

Secondary:
#A78BFA

Glow:
rgba(139,92,246,0.35)

Border:
rgba(139,92,246,0.18)

---

# Diretrizes de UX

Menos é mais.

Poucas ações.

Poucos botões.

Pouco ruído visual.

Muito espaço.

Muito foco.

Muito contexto.

---

# Linguagem da Interface

Evitar:

❌ Timeline
❌ Track
❌ Layer
❌ Split
❌ Crop
❌ Inspector

Preferir:

✅ Cortes
✅ Momentos
✅ Sugestões
✅ Ajustes
✅ Galeria

---

# 8. BACKEND PRINCIPLES

O backend é um motor de edição baseado em operações.

Toda edição deve ser representada por:

EditOperation

A Timeline é apenas uma visualização.

A fonte de verdade é a lista de operações.

---

# Não criar lógica de edição acoplada.

Evitar:

if remove_silence:
    ...

if crop:
    ...

if subtitles:
    ...

Preferir:

operations
↓
pipeline
↓
renderer

---

# A arquitetura deve ser orientada por comandos.

Prompt
↓

AI Director
↓

Execution Plan
↓

EditOperations
↓

Timeline Renderer

---

# Todo novo recurso deve poder ser convertido em:

{
  "operation": "...",
  "parameters": {}
}

---

# Exemplos

remove_silence
crop
zoom
subtitle
music
blur
emoji
broll
transition

---

# O LLM NÃO existe apenas para gerar clipes.

O LLM é o cérebro do produto.

Sua responsabilidade futura:

- entender intenções;
- criar planos de edição;
- gerar operações;
- automatizar fluxos;
- agir como diretor de edição.

---

# ARQUITETURA ATUAL (Implementada)

Next.js (Frontend React)
↓
Go Gateway (API, WebSockets, Uploads)
↓
Postgres (Dados) & Redis (Cache e Streams/Lists)
↓
Python AI Engine (Whisper, Ollama, OpenCV) -> Extração Semântica e Visão
↓
Go Render Engine (FFmpeg, NVENC CUDA) -> Renderização Final
↓
Storage (Uploads)

---

# NÃO migrar IA para Go.

Go é utilizado apenas para:

- API Gateway
- Auth
- Billing
- WebSockets
- Analytics
- Notifications

Toda IA permanece em Python.

---

# PRINCÍPIO DE ESCALABILIDADE

O sistema deve crescer em serviços independentes:

clipforge-gateway
clipforge-ai-engine
clipforge-render-engine
clipforge-analytics

Sem reescritas completas.

---

# REGRA FINAL

Antes de implementar qualquer funcionalidade, responder:

1. Isso torna a IA mais poderosa?
2. Isso deixa o produto mais simples?
3. Isso mantém a identidade AI First?
4. Isso evita parecer um clone do CapCut?
5. Isso pode ser representado como operações?

Se qualquer resposta for "não", reavaliar a implementação.

---

# OBJETIVO FINAL

Construir a melhor plataforma de edição de vídeos por linguagem natural.

Não construir mais um editor de vídeo.