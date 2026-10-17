---
name: proposta-reuniao
description: Transforma a transcrição de uma reunião de descoberta numa proposta comercial em 4 etapas encadeadas (proposta, cronograma, riscos, pagamento), usando o solver determinístico solve.mjs. Use em qualquer task com casos/<caso>/transcricao.txt + catalogo/tabela/checklist/equipe/riscos.
---

# Reunião → proposta que o cliente assina

O problema é **aplicar regras à risca**, não interpretar a intenção do cliente. Contas e leitura de orações feitas
"de cabeça" erram; por isso existe um solver determinístico que implementa as regras 1–37 do `README.md`.
O seu trabalho é: conferir que o README bate com o solver, rodar, auditar e só então parar.

## 1. Entrada e saída

- Entrada: `casos/<caso>/transcricao.txt`, `catalogo.json`, `tabela.json`, `checklist.json`, `equipe.json`, `riscos.json`.
- Saída: `out/<caso>.json` com as chaves `proposta`, `cronograma`, `riscos`, `pagamento` (formato no README).

## 2. Rodar o solver

```bash
node .opencode/skills/proposta-reuniao/solve.mjs              # resolve todos os casos → out/<caso>.json
node .opencode/skills/proposta-reuniao/solve.mjs --explain exemplo-2 2> /tmp/explain-exemplo-2.txt
```

`--explain` imprime (em stderr) cada oração classificada, o prazo achado, os módulos de cada pacote com base/horas/
urgência/desconto, a ordem do cronograma com o grupo de cada módulo, o sinal que ativou cada risco e cada expressão
de pagamento. Use isso para auditar, não para refazer as contas.

## 3. Conferir que o README é o que o solver assume

Antes de confiar no resultado, compare o `README.md` do workspace com a lista abaixo. Se algo mudou (outra lista de
frases-chave, outro número por extenso, outro termo de pagamento, outro rótulo de falante), **não edite o solver no
lugar**: escreva um JSON de override em `/tmp/regras.json` e rode com `--config /tmp/regras.json`. Só as chaves
presentes são trocadas:

```json
{
  "papel_cliente": "Cliente",
  "delimitadores": [",", ".", ";", "!", "?"],
  "frases_chave": [
    ["remocao", ["esquece", "pode tirar", "não precisa", "não precisam", "não preciso", "não quero", "deixa de fora"]],
    ["opcional", ["se sobrar", "se der tempo"]],
    ["desejavel", ["seria bom", "gostaria"]],
    ["obrigatorio", ["precisa", "precisam", "preciso", "precisamos", "tem que ter", "obrigatório"]]
  ],
  "numeros_extenso": { "um": 1, "uma": 1, "dois": 2, "duas": 2, "três": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7, "oito": 8, "nove": 9, "dez": 10, "onze": 11, "doze": 12, "treze": 13, "quatorze": 14, "quinze": 15, "dezesseis": 16, "vinte": 20 },
  "unidades_prazo": { "semana": 1, "semanas": 1, "mês": 4, "meses": 4 },
  "incertezas": ["não sei", "vou ver", "não decidimos"],
  "pagamento": { "a_vista": ["à vista"], "parcela": ["parcela", "parcelas"], "sem_entrada": ["sem entrada"], "entrada": ["entrada"] }
}
```

Se a mudança for de **lógica** (não de lista), copie o solver para `/tmp/solve.mjs`, ajuste a função da etapa afetada
e rode `node /tmp/solve.mjs` (ele grava em `out/` do diretório atual). Nunca grave nada fora de `out/` e `/tmp`.

## 4. As regras, resumidas (para auditar o `--explain`)

Leitura (vale para TODAS as etapas):
- Só falas `Cliente` contam (qualquer nome). Fala da `Agência` nunca decide nada, mesmo sugerindo módulo/prazo/pagamento.
- Oração = trecho entre `, . ; ! ?`. Oração que termina em `?` é ignorada para tudo.
- Casar = palavra(s) inteira(s), sem diferenciar maiúscula, **acento conta**. `app` não casa com `apps`.
- O id do módulo não é sinônimo; só a lista `sinonimos` do catálogo.

Etapa 1 — proposta:
- Classe da oração: a primeira que casar em `remocao` → `opcional` → `desejavel` → `obrigatorio`.
  "não precisa de app" é remoção; "gostaria … se der tempo" é opcional. Sem frase-chave a oração não muda nada.
- A classe vale para todos os módulos mencionados naquela oração. A última oração classificada vence; `linha` = linha dela.
- `remocao` final → `fora_do_escopo` (mesmo se nunca pedido). Nunca classificado → em nenhuma lista.
- Prazo: número (algarismo ou extenso da tabela) **imediatamente** antes de semana/semanas/mês/meses; mês = 4 semanas;
  vale a última ocorrência; nenhuma → `null`. "semana que vem", "por mês" não são prazo.
- Checklist respondida: alguma oração do cliente (não pergunta) casa uma das `palavras` e **não** contém
  `não sei`/`vou ver`/`não decidimos`. `perguntas_pendentes` = as não respondidas, em ordem alfabética.
- Pacotes: essencial = obrigatório; recomendado = + desejável; completo = + opcional. Adicione o fecho de `requer`
  (recursivo, mesmo módulo removido ou nunca citado) só para preço/cronograma.
- Preço: base = Σ horas×valor_hora; urgência = faixa de **menor** `ate_semanas` com prazo ≤ ate (senão 100);
  desconto se horas ≥ `horas_minimas`; valor = base×urg/100×(100−desc)/100 sem arredondar no meio; arredonda
  **para cima** ao múltiplo de `arredondamento_centavos`; mínimo `minimo_centavos`; pacote vazio = 0.

Etapa 2 — cronograma (pacote recomendado com dependências):
- Capacidade = pessoas × horas_semana. Duração = máx por papel de ⌈horas/capacidade⌉.
- Um módulo por vez; início = fim anterior + 1. Só começa com todos os `requer` prontos.
- Entre os prontos: grupo 0 (entrou só por dependência: opcional, removido ou nunca citado) < grupo 1 (obrigatório)
  < grupo 2 (desejável); empate → alfabético.
- `estoura_prazo` = prazo não nulo e total > prazo.

Etapa 3 — riscos:
- Sinal casado em qualquer oração do cliente (não pergunta) ativa; `não sei`/`vou ver` não importam aqui.
- `gatilho: estoura_prazo` ativa com `cronograma.estoura_prazo`. Risco com `modulo` só se esse módulo está no recomendado (com dependências).
- Preço: refaça o preço do recomendado somando as horas dos riscos como um módulo extra (pode alcançar o desconto
  de volume e ficar **menor** — está certo).

Etapa 4 — pagamento:
- Varre orações do cliente (não pergunta) da esquerda p/ direita: `à vista`; número + `parcela(s)`; `sem entrada` = 0%;
  `N%` só em oração que contém `entrada`. Para forma e entrada vale a última expressão. Sem forma → parcelado com
  `parcelas_padrao`; sem entrada → `entrada_pct_padrao`. Desconto à vista é sempre o da tabela.
- À vista: total = ⌊valor×(100−desc)/100⌋, uma linha `a_vista` semana 0.
- Parcelado: entrada = ⌊valor×pct/100⌋ (0 não aparece); n = min(pedido, max_parcelas); se ⌊resto/n⌋ < mínima,
  n = max(1, ⌊resto/mínima⌋); parcelas iguais ⌊resto/n⌋ e a última leva a sobra.
- Parcela i vence no `fim` do módulo na posição ⌈m×i/n⌉ do cronograma. Valor 0 → `parcelas: []`.

## 5. Armadilhas que o `--explain` ajuda a pegar

- Pergunta do cliente ("tem que ter login com Google?") não conta, nem para prazo, risco ou pagamento.
- Oração sem frase-chave que menciona módulo ("Usamos o TOTVS") não muda estado.
- Sinal de risco dentro de uma pergunta não ativa o risco.
- `10%` numa oração sem `entrada` (ex.: "à vista com 10% de desconto") não é entrada.
- Número + `parcelas` dentro de pergunta ("dá para fazer em seis parcelas?") não conta.
- Dependência removida pelo cliente (painel removido, ERP mantido) continua no preço e no cronograma, no grupo 0.
