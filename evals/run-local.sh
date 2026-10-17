#!/usr/bin/env bash
# Roda o agente desta pasta numa task de exemplo, N vezes, e conta quantas passam.
# Uso: OPENROUTER_API_KEY=... evals/run-local.sh <pasta-da-task-exemplo> [vezes]
# Modelo padrão: um modelo GRÁTIS do OpenRouter (conta grátis, sem crédito). Troque com MODEL=openrouter/<id>.
# A avaliação final usa deepseek/deepseek-v4.1-flash (paga pela DFL).
# Precisa de: node 22+, npm, git e opencode (https://opencode.ai).
set -euo pipefail
TASK="$(cd "$1" && pwd)"; N="${2:-1}"
AGENT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL="${MODEL:-openrouter/nvidia/nemotron-3-super-120b-a12b:free}"
TIMEOUT="${TIMEOUT:-600}"
pass=0
for i in $(seq 1 "$N"); do
  WS="$(mktemp -d)"
  cp -r "$TASK/environment/." "$WS/"
  mkdir -p "$WS/tests" "$WS/.opencode"
  cp -r "$TASK/tests/public" "$WS/tests/public"
  [ -f "$AGENT/AGENTS.md" ] && cp "$AGENT/AGENTS.md" "$WS/"
  [ -f "$AGENT/CLAUDE.md" ] && cp "$AGENT/CLAUDE.md" "$WS/"
  [ -d "$AGENT/skills" ] && cp -r "$AGENT/skills" "$WS/.opencode/skills"
  (cd "$WS" && npm ci --ignore-scripts --no-audit --no-fund >/dev/null \
    && git init -q && git add -A && git -c user.email=eval@local -c user.name=eval commit -qm base)
  start=$(date +%s)
  (cd "$WS" && timeout "$TIMEOUT" opencode run --pure --format json -m "$MODEL" "$(cat "$TASK/instruction.md")" > /tmp/trace-$i.jsonl 2>&1) || true
  secs=$(( $(date +%s) - start ))
  ok=0; (cd "$WS" && npx vitest run tests/public >/dev/null 2>&1) && ok=1
  fora="$(cd "$WS" && git status --porcelain | grep -v -E '^.. (out/|node_modules/)' || true)"
  if [ -n "$fora" ]; then ok=0; echo "  run $i: escreveu fora de out/ (na final isso zera):"; echo "$fora" | sed 's/^/    /'; fi
  pass=$((pass + ok))
  echo "run $i: $([ $ok = 1 ] && echo PASS || echo FAIL) em ${secs}s · trace: /tmp/trace-$i.jsonl · workspace: $WS"
done
echo "resultado: $pass/$N"
