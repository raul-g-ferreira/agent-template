# Template de agente — Hackathon DFL Day 4 (UEM)

Este repositório é o ponto de partida do agente da sua equipe (3 a 5 pessoas, ou solo). O agente é avaliado no
[TestMyAgent](https://testmyagent.devfellowship.com) na rodada final, nos 5 casos (2 exemplos públicos, um simples e um médio, + 3 ocultos)
do problema que a sua equipe escolheu.

## 1. Crie o repo da equipe

1. Clique em **Use this template** → **Create a new repository**.
2. Deixe o repositório **público**. A produção clona o seu repo no commit entregue.

## 2. O que entra na avaliação

O runner do TestMyAgent copia **só** estes arquivos. O resto do repo não entra.

```text
AGENTS.md            obrigatório (ou CLAUDE.md): o prompt de sistema do agente
CLAUDE.md            opcional
skills/<nome>/SKILL.md   procedimentos; scripts auxiliares podem ficar junto (ex.: check.mjs)
```

- Tamanho máximo: 200 KB no total. Sem symlinks. Use só arquivos de texto em `skills/`.
- As skills ficam em `.opencode/skills/` dentro do workspace. O agente roda os scripts com `bash`.
- O modelo é fixo para todos: `deepseek-v4.1-flash`. O que muda é o harness.
- O agente roda sem internet (só a API do modelo), com limite de tempo da task (600 s) e de custo (US$ 0,50).
- O agente escreve **só** em `out/`. Um arquivo fora de `out/` zera a nota. Rascunho vai em `/tmp`.

`evals/` e `SUBMISSAO.md` são só para vocês. Eles não vão para o runner.

## 3. Teste local (o TestMyAgent roda só a final)

Precisa de Node 22+, git, [opencode](https://opencode.ai) e uma chave OpenRouter.

**Chave compartilhada do evento:** pegue a chave aqui → https://share.1password.com/s#o_lbfMaP8vWn37Nt5c-ue1qax0wh8Cy__37g8FG4jl0 (limite de US$ 5 para todos, válida por 7 dias). Use a chave só no seu terminal (`export OPENROUTER_API_KEY=...`). **Nunca** coloque a chave no repo, num commit ou num print: o GitHub detecta e a chave é revogada para todos. Também funciona com uma chave de conta grátis sua.
Modelos grátis para testar: [artigo na wiki DFL](https://wiki.devfellowship.com/a/hackathon-dfl-day4-modelos-ia-gratuitos).

- O `evals/run-local.sh` usa por padrão um modelo grátis: `openrouter/nvidia/nemotron-3-super-120b-a12b:free` (tem tool calling).
- Troque com `MODEL=openrouter/<id>` (qualquer id `:free` da lista do OpenRouter).
- **A avaliação final usa `deepseek-v4.1-flash`**, paga pela DFL. Não há versão `:free` dele no OpenRouter hoje, então o modelo grátis é só um substituto local. Modelos grátis têm limite de requisições (erro 429): espere e rode de novo.
- Se o seu agente passa com um modelo grátis menor, ele tende a passar com o `deepseek-v4.1-flash`. O inverso não é garantido.

```bash
export OPENROUTER_API_KEY=...
evals/run-local.sh examples/biblioteca 3     # task de exemplo deste repo: roda 3 vezes e conta os PASS
```

`examples/biblioteca` é uma task de treino (multas e reservas de biblioteca, 2 casos: simples e médio).
No sábado, a produção publica as tasks de exemplo dos 3 problemas votados; rode o mesmo comando apontando para a pasta delas.

O script monta o workspace igual ao runner (environment + tests/public + seu AGENTS.md e skills/),
roda o opencode, roda os testes públicos e avisa se o agente escreveu fora de `out/`.

Dicas de harness:

- Rode 3 vezes: 3/3 é estável, 1/3 é sorte.
- Crie casos parecidos com o exemplo: os 3 casos ocultos não são os exemplos.
- Mude UMA coisa por vez (prompt, skill, script de checagem) e compare.
- Leia o trace (`/tmp/trace-N.jsonl`) para ver onde o agente se perde.

## 4. Entrega

No slot da sua equipe no board do evento (seção SOLUÇÕES), preencha:

- Problema escolhido (P1, P2 ou P3)
- URL do repo público
- Commit SHA final (40 caracteres: `git rev-parse HEAD`)

A produção roda a final no TestMyAgent no commit entregue; a DFL paga essa execução.
