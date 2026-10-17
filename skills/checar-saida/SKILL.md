---
name: checar-saida
description: Valida out/<caso>.json (formato exato do README e invariantes entre as etapas) antes de o agente parar.
---

# Checar a saída

Rode `node .opencode/skills/checar-saida/check.mjs` na raiz do workspace.

Ele confere:

- existe um `out/<caso>.json` para cada pasta em `casos/`, e cada um é JSON válido;
- as 4 chaves (`proposta`, `cronograma`, `riscos`, `pagamento`) com exatamente os campos do formato, sem campo extra;
- tipos: inteiros em centavos, `prazo_semanas` inteiro ou `null`, prioridades e tipos de parcela válidos;
- ordem alfabética de `escopo`, `fora_do_escopo`, `perguntas_pendentes`, `riscos.ids`;
- cronograma contínuo (início = fim anterior + 1), `total_semanas` e `estoura_prazo` coerentes com o prazo;
- todo módulo obrigatório/desejável do escopo aparece no cronograma;
- pagamento: soma das linhas = `valor_total_centavos`, entrada primeiro, vencimentos em semanas que são fim de módulo.

Saída diferente de 0 = leia a mensagem, descubra qual regra do README foi violada, corrija e rode de novo.
Passar no checador **não** prova que os valores estão certos; prova só que não há erro grosseiro.
