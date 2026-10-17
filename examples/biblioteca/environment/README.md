# Biblioteca: multas e reservas

Você calcula a multa de cada usuário da biblioteca e diz quem fica bloqueado, na data de corte.

## Entrada: `casos/<caso>/`

| Arquivo | Conteúdo |
|---|---|
| `usuarios.json` | `{ "<usuario>": "graduacao" \| "pos" \| "servidor" }` |
| `emprestimos.json` | `[{ "id", "usuario", "livro", "retirada": "AAAA-MM-DD", "renovacoes": n }]` |
| `devolucoes.json` | `[{ "emprestimo": "<id>", "data": "AAAA-MM-DD" }]` — empréstimo sem linha aqui não foi devolvido |
| `reservas.json` | `[{ "livro", "usuario", "data": "AAAA-MM-DD" }]` |
| `calendario.json` | `{ "corte": "AAAA-MM-DD", "feriados": ["AAAA-MM-DD", ...] }` |

## Regras

1. **Dia útil** = segunda a sexta que não está em `feriados`.
2. **Prazo** em dias úteis: `graduacao` = 5, `pos` = 10, `servidor` = 10.
3. **Vencimento** = o N-ésimo dia útil **depois** da retirada (o dia da retirada não conta).
4. **Renovação:** cada renovação soma mais N dias úteis ao vencimento atual. Uma renovação é **recusada** (não soma nada) quando existe reserva do **mesmo livro** feita por **outro usuário** com `data` menor ou igual ao vencimento atual. Recusada uma renovação, as seguintes daquele empréstimo também são recusadas.
5. **Dias de atraso** = dias úteis depois do vencimento, até a data de devolução **inclusive**. Sem devolução, conte até a data de `corte` inclusive. Devolveu no vencimento ou antes = 0.
6. **Multa** = 150 centavos por dia de atraso, com **teto de 3000 centavos por empréstimo**.
7. **Bloqueado** = multa total do usuário maior que 1000 centavos, **ou** o usuário tem algum empréstimo não devolvido que já venceu na data de corte (vencimento < corte).

## Saída: `out/<caso>.json`

Um objeto com **todos** os usuários de `usuarios.json`, inclusive quem não pegou livro:

```json
{ "ana": { "multa_centavos": 450, "bloqueado": false } }
```

`multa_centavos` é um inteiro (soma de todos os empréstimos do usuário).
