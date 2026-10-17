// Implementação de referência (fica fora do workspace do agente).
// Uso: node solution/ref.mjs environment/casos  -> imprime { <caso>: <saida> }
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRAZO = { graduacao: 5, pos: 10, servidor: 10 };
const read = (dir, f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const iso = (d) => d.toISOString().slice(0, 10);
const next = (s) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return iso(d); };

export function resolver(dir) {
  const usuarios = read(dir, 'usuarios.json');
  const emprestimos = read(dir, 'emprestimos.json');
  const devolucoes = Object.fromEntries(read(dir, 'devolucoes.json').map((d) => [d.emprestimo, d.data]));
  const reservas = read(dir, 'reservas.json');
  const { corte, feriados } = read(dir, 'calendario.json');
  const util = (s) => { const w = new Date(`${s}T00:00:00Z`).getUTCDay(); return w !== 0 && w !== 6 && !feriados.includes(s); };
  const somar = (s, n) => { let d = s; while (n > 0) { d = next(d); if (util(d)) n--; } return d; };
  const uteisEntre = (a, b) => { let n = 0; let d = a; while (d < b) { d = next(d); if (util(d)) n++; } return n; }; // (a, b]
  const out = Object.fromEntries(Object.keys(usuarios).map((u) => [u, { multa_centavos: 0, bloqueado: false }]));
  for (const e of emprestimos) {
    const n = PRAZO[usuarios[e.usuario]];
    let venc = somar(e.retirada, n);
    for (let i = 0; i < e.renovacoes; i++) {
      const bloqueia = reservas.some((r) => r.livro === e.livro && r.usuario !== e.usuario && r.data <= venc);
      if (bloqueia) break;
      venc = somar(venc, n);
    }
    const fim = devolucoes[e.id] ?? corte;
    const atraso = fim > venc ? uteisEntre(venc, fim) : 0;
    out[e.usuario].multa_centavos += Math.min(atraso * 150, 3000);
    if (!devolucoes[e.id] && venc < corte) out[e.usuario].bloqueado = true;
  }
  for (const u of Object.values(out)) if (u.multa_centavos > 1000) u.bloqueado = true;
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.argv[2];
  const all = {};
  for (const c of readdirSync(base).sort()) all[c] = resolver(join(base, c));
  console.log(JSON.stringify(all, null, 2));
}
