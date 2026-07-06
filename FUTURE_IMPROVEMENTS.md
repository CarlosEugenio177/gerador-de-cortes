# ClipForge AI - Review de Arquitetura & Próximas Etapas

Este documento sumariza a evolução recente do sistema e delineia os próximos passos estratégicos para a escalabilidade e qualidade dos cortes gerados.

---

## ✅ Implementações Concluídas (Fundação Estabilizada)

1. **Global Cache & Deduplicação por MD5:** 
   O sistema agora detecta vídeos idênticos já processados no momento do upload. Projetos subsequentes que usam a mesma mídia reaproveitam o upload, o proxy 360p, o áudio extraído e a transcrição do Whisper. Apenas o Scoring (Visão/LLM) é re-executado. O ganho de velocidade em reprocessamentos é exponencial.

2. **Cancelamento Cascata Assíncrono:**
   Implementação de registros no Redis e em Memória (contextos em Go) que permitem abortar a pipeline inteira. Se o usuário deletar/cancelar um projeto, processos pesados (FFmpeg/Whisper) são interrompidos imediatamente, liberando CPU/GPU.

3. **Pipelines Baseados em Redis Streams:**
   Comunicação fluida usando Pub/Sub para eventos de UI, e `Streams/Lists` para divisão de carga (ex: `queue:render` e `stream:analyze`). Frontend reativo com logs granulares.

---

## 🚀 Próximas Etapas & Evolução (Future Improvements)

### 1. Diarização de Locutores (Quem está falando?)
**Problema:** Atualmente a IA gera legendas perfeitamente, mas não entende **quem** está falando.
**Solução:** Integrar o modelo *Pyannote Audio* logo após o Whisper. Isso permitirá separar falas de "Entrevistador" e "Convidado". Com isso, a Render Engine poderá usar layouts automáticos (ex: Tela Dividida, ou focar a câmera no rosto de quem está com a palavra).

### 2. B-Roll e Mídia de Cobertura Automática
**Problema:** Vídeos muito estáticos (apenas uma pessoa falando pra câmera o tempo todo) perdem retenção no TikTok/Shorts.
**Solução:** Usar o LLM para identificar palavras-chave no texto e buscar B-Rolls automáticos (Pexels API) ou Imagens Geradas por IA para sobrepor (overlay) na tela, tornando o corte hiperdinâmico.

### 3. Face Tracking Avançado & Dynamic Cropping
**Problema:** Atualmente, a conversão para `9:16` foca no centro (ou em um rosto principal) de forma estática, mas a pessoa pode andar pela tela.
**Solução:** A etapa de Visão Computacional gerar uma "Trilha de Coordenadas" do rosto e enviar para a Render Engine (Go), que usaria o filtro de crop dinâmico do FFmpeg para acompanhar o rosto do usuário perfeitamente pela tela (estabilização facial).

### 4. Melhoria do LLM (Context Window & Paralelização)
**Problema:** Hoje o LLM roda sequencialmente sobre cada "bloco de 15 segundos", podendo demorar se o vídeo for muito longo (1+ hora).
**Solução:** Enviar todo o texto de uma vez só (Large Context) pedindo pro LLM devolver um JSON com os `timestamps` ideais, usando o modelo `llama3` com suporte a JSON mode, substituindo a iteração manual de blocos e eliminando quase 90% do tempo de processamento semântico.

### 5. Tratamento de Áudio IA
**Problema:** Filtros básicos do FFmpeg nem sempre salvam um microfone ruim.
**Solução:** Incluir modelos de IA de aprimoramento de voz (como `DeepFilterNet`) para deixar a voz com qualidade de estúdio, removendo eco e ruído de fundo automaticamente.
