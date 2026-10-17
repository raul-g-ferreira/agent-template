# Task de exemplo: Biblioteca — multas e reservas

Uma task no formato do TestMyAgent para treinar o harness. Ela **não** é um dos problemas do sábado.

```bash
export OPENROUTER_API_KEY=...      # chave compartilhada do evento (link no README principal) ou a sua
evals/run-local.sh examples/biblioteca 3
```

| Pasta | O que é |
|---|---|
| `instruction.md` | o prompt que o agente recebe |
| `environment/` | o workspace: `README.md` com as regras, `casos/exemplo-1` (simples) e `casos/exemplo-2` (médio) |
| `tests/public/` | 2 testes, um por caso |
| `tests/hidden/` | no TestMyAgent, os casos ocultos ficam aqui; neste exemplo é a cópia dos públicos |
| `solution/` | solução de referência (`solution.patch`) e o gerador (`ref.mjs`). **Não leia antes de tentar** |
| `task.json` | o contrato da task (valida no schema do TestMyAgent) |

O caso médio tem as armadilhas: feriado, renovação recusada por reserva de outro usuário, reserva do próprio usuário (não recusa), empréstimo não devolvido, teto por empréstimo e o limite de bloqueio (> 1000, não ≥).
