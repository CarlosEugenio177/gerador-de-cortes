# ClipForge AI - Future Improvements & Ideas

Este documento guarda ideias arquiteturais e de produto que foram pensadas durante o desenvolvimento, mas adiadas para manter o foco na estabilização da fundação (MVP).

---

## 1. Global Cache Baseado em Hash (Deduplicação de Uploads)
**Problema Atual:**
Se o usuário subir o mesmo vídeo (ex: um podcast de 2 horas) em 5 "Projetos Novos" separados para testar prompts de edição diferentes, o sistema fará upload 5 vezes, criará 5 proxies idênticos e passará o Whisper 5 vezes.

**Solução (Deduplicação Inteligente):**
- Ao fazer o upload, o Gateway calcula o Hash (MD5 ou SHA-256) do arquivo original.
- O arquivo original é salvo como `uploads/{hash_do_video}.mp4`.
- Os projetos no banco de dados terão múltiplos IDs, mas apontarão para o **mesmo** Hash.
- Quando o Worker Python pegar um projeto novo, ele checará se `uploads/{hash_do_video}.transcript.json` já existe.
- **Resultado:** Reuso imediato e global do Proxy e da Transcrição Whisper entre inúmeros projetos. Zero tempo de espera e economia drástica de recursos da máquina.

---

## 2. ... (Adicionar futuras ideias aqui)
