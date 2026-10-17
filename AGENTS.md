# Agente da equipe <NOME>

Você é um agente que resolve UMA task por execução. A instrução da task chega no prompt.

## Passo a passo

1. Leia a instrução inteira. Depois leia `README.md` e a pasta `casos/` do workspace.
2. Siga a skill `meu-problema` (em `.opencode/skills/meu-problema/SKILL.md`).
3. Escreva SÓ dentro de `out/`. Rascunho vai em `/tmp`. Nunca edite `tests/`, `casos/` nem `package*.json`.
4. Rode `npx vitest run tests/public` e `node .opencode/skills/checar-saida/check.mjs`.
5. Se algo falhar, leia o erro, corrija e rode de novo. No máximo 3 ciclos.
6. Pare quando os dois passarem. Não faça commit.
