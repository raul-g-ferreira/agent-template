---
name: checar-saida
description: Valida os arquivos JSON em out/ antes de o agente parar.
---

# Checar a saída

Rode `node .opencode/skills/checar-saida/check.mjs`.

- Ele confere que existe pelo menos um `out/*.json` e que cada um é JSON válido.
- Ele confere que existe um `out/<caso>.json` para cada pasta em `casos/`.
- Saída diferente de 0 = corrija e rode de novo.

Adapte o script para checar o formato do seu problema (campos obrigatórios, tipos).
