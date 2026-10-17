// Solver determinístico: transcrição de reunião → proposta (proposta, cronograma, riscos, pagamento).
// Implementa as regras 1–37 do README da task. Lê casos/<caso>/*, escreve out/<caso>.json.
//
// Uso (na raiz do workspace):
//   node .opencode/skills/proposta-reuniao/solve.mjs                 # todos os casos
//   node .opencode/skills/proposta-reuniao/solve.mjs exemplo-2       # só um caso
//   node .opencode/skills/proposta-reuniao/solve.mjs --explain exemplo-2   # mostra o raciocínio (stderr)
//   node .opencode/skills/proposta-reuniao/solve.mjs --config /tmp/regras.json   # sobrescreve listas de regras
//   node .opencode/skills/proposta-reuniao/solve.mjs --casos casos --out out
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------- Regras configuráveis (README). Se o README mudar, sobrescreva com --config. ----------
const DEFAULT_CONFIG = {
  papel_cliente: 'Cliente',
  delimitadores: [',', '.', ';', '!', '?'],
  // Regra 6: ordem importa — a primeira classe que casar vence.
  frases_chave: [
    ['remocao', ['esquece', 'pode tirar', 'não precisa', 'não precisam', 'não preciso', 'não quero', 'deixa de fora']],
    ['opcional', ['se sobrar', 'se der tempo']],
    ['desejavel', ['seria bom', 'gostaria']],
    ['obrigatorio', ['precisa', 'precisam', 'preciso', 'precisamos', 'tem que ter', 'obrigatório']],
  ],
  // Regra 9
  numeros_extenso: {
    um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
    onze: 11, doze: 12, treze: 13, quatorze: 14, quinze: 15, dezesseis: 16, vinte: 20,
  },
  unidades_prazo: { semana: 1, semanas: 1, 'mês': 4, meses: 4 },
  // Regra 11
  incertezas: ['não sei', 'vou ver', 'não decidimos'],
  // Regra 33
  pagamento: {
    a_vista: ['à vista'],
    parcela: ['parcela', 'parcelas'],
    sem_entrada: ['sem entrada'],
    entrada: ['entrada'],
  },
};

// ---------- utilidades ----------
const W = '[\\p{L}\\p{N}_]';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nfc = (s) => String(s).normalize('NFC');
const reCache = new Map();
function exprRe(expr) {
  // palavra(s) inteira(s), sem diferenciar maiúsculas; acento conta; espaços internos flexíveis
  const key = expr;
  if (!reCache.has(key)) {
    const body = nfc(expr).trim().split(/\s+/).map(esc).join('\\s+');
    reCache.set(key, new RegExp(`(?<!${W})${body}(?!${W})`, 'giu'));
  }
  const re = reCache.get(key);
  re.lastIndex = 0;
  return re;
}
const casa = (texto, expr) => exprRe(expr).test(texto);
const casaAlguma = (texto, exprs) => exprs.some((e) => casa(texto, e));
function posicoes(texto, expr) {
  const re = exprRe(expr);
  const out = [];
  let m;
  while ((m = re.exec(texto))) { out.push({ idx: m.index, fim: m.index + m[0].length }); if (m[0].length === 0) re.lastIndex++; }
  return out;
}
const lerJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const ceilDiv = (a, b) => (a + b - 1n) / b; // BigInt, a>=0, b>0
const sortStr = (a) => [...a].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));

function mergeConfig(base, over) {
  if (!over) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])
      ? { ...base[k], ...v } : v;
  }
  return out;
}

// ---------- leitura da transcrição (regras 1–3) ----------
function lerOracoes(txt, cfg) {
  const oracoes = [];
  const delims = new Set(cfg.delimitadores);
  for (const bruta of nfc(txt).split(/\r?\n/)) {
    const m = bruta.match(/^\s*\[(\d+)\]\s*([^(:]+?)\s*(?:\(([^)]*)\))?\s*:\s?(.*)$/u);
    if (!m) continue;
    const linha = parseInt(m[1], 10);
    const papel = m[2].trim();
    const cliente = papel.toLowerCase().startsWith(cfg.papel_cliente.toLowerCase());
    const texto = m[4];
    let atual = '';
    let ordem = 0;
    const push = (fimCom) => {
      const t = atual.trim();
      if (t.length) oracoes.push({ linha, ordem: ordem++, cliente, quem: m[3] || papel, texto: t, pergunta: fimCom === '?' });
      atual = '';
    };
    for (const ch of texto) {
      if (delims.has(ch)) push(ch);
      else atual += ch;
    }
    push(null);
  }
  return oracoes;
}

// ---------- números (regra 9 / 33) ----------
function numeroRe(cfg, unidades) {
  const palavras = Object.keys(cfg.numeros_extenso).sort((a, b) => b.length - a.length).map(esc).join('|');
  const un = [...unidades].sort((a, b) => b.length - a.length).map(esc).join('|');
  return new RegExp(`(?<!${W})(\\d+|${palavras})\\s+(${un})(?!${W})`, 'giu');
}
function valorNumero(tok, cfg) {
  if (/^\d+$/.test(tok)) return parseInt(tok, 10);
  const k = tok.toLowerCase();
  for (const [p, v] of Object.entries(cfg.numeros_extenso)) if (p.toLowerCase() === k) return v;
  return null;
}

// ---------- etapa 1 ----------
function classificar(texto, cfg) {
  for (const [classe, frases] of cfg.frases_chave) if (casaAlguma(texto, frases)) return classe;
  return null;
}
function modulosMencionados(texto, catalogo) {
  return Object.keys(catalogo).filter((id) => casaAlguma(texto, catalogo[id].sinonimos || []));
}
function fecharDependencias(ids, catalogo) {
  const set = new Set();
  const pilha = [...ids];
  while (pilha.length) {
    const id = pilha.pop();
    if (set.has(id) || !catalogo[id]) continue;
    set.add(id);
    for (const r of catalogo[id].requer || []) pilha.push(r);
  }
  return set;
}
function somaHoras(modIds, catalogo, extras = []) {
  const porPapel = {};
  const add = (h) => { for (const [p, n] of Object.entries(h || {})) porPapel[p] = (porPapel[p] || 0) + Number(n); };
  for (const id of modIds) add(catalogo[id].horas);
  for (const h of extras) add(h);
  return porPapel;
}
function precificar(porPapel, vazio, prazo, tabela) {
  if (vazio) return { preco: 0 };
  let base = 0n;
  let horas = 0;
  for (const [p, n] of Object.entries(porPapel)) {
    horas += n;
    base += BigInt(Math.round(n)) * BigInt(tabela.valor_hora_centavos?.[p] ?? 0);
  }
  let pctUrg = 100;
  if (prazo !== null) {
    const faixas = [...(tabela.urgencia || [])].filter((f) => prazo <= f.ate_semanas).sort((a, b) => a.ate_semanas - b.ate_semanas);
    if (faixas.length) pctUrg = faixas[0].pct;
  }
  const dv = tabela.desconto_volume || {};
  const pctDesc = dv.horas_minimas !== undefined && horas >= dv.horas_minimas ? dv.pct : 0;
  const num = base * BigInt(pctUrg) * BigInt(100 - pctDesc);
  const den = 10000n;
  const arred = BigInt(tabela.arredondamento_centavos || 1);
  let valor = ceilDiv(num, den * arred) * arred;
  const minimo = BigInt(tabela.minimo_centavos || 0);
  if (valor < minimo) valor = minimo;
  return { preco: Number(valor), base: Number(base), horas, pctUrg, pctDesc };
}

function etapaProposta(ctx) {
  const { oracoes, catalogo, checklist, tabela, cfg, log } = ctx;
  const estado = {};
  let prazo = null;
  const reNum = numeroRe(cfg, Object.keys(cfg.unidades_prazo));
  for (const o of oracoes) {
    if (!o.cliente || o.pergunta) continue;
    const classe = classificar(o.texto, cfg);
    const mods = modulosMencionados(o.texto, catalogo);
    if (classe && mods.length) {
      for (const id of mods) estado[id] = { prioridade: classe, linha: o.linha };
      log(`  [${String(o.linha).padStart(3, '0')}] ${classe.padEnd(11)} ${mods.join(', ')}  ← "${o.texto}"`);
    } else if (mods.length) {
      log(`  [${String(o.linha).padStart(3, '0')}] (sem frase-chave, ignora) ${mods.join(', ')}  ← "${o.texto}"`);
    }
    reNum.lastIndex = 0;
    let m;
    while ((m = reNum.exec(o.texto))) {
      const n = valorNumero(m[1], cfg);
      const un = Object.entries(cfg.unidades_prazo).find(([u]) => u.toLowerCase() === m[2].toLowerCase());
      if (n !== null && un) { prazo = n * un[1]; log(`  [${String(o.linha).padStart(3, '0')}] prazo = ${prazo} semanas  ← "${m[0]}"`); }
    }
  }
  const escopo = [];
  const fora = [];
  for (const id of sortStr(Object.keys(estado))) {
    const e = estado[id];
    if (e.prioridade === 'remocao') fora.push(id);
    else escopo.push({ modulo: id, prioridade: e.prioridade, linha: e.linha });
  }
  const pendentes = [];
  for (const q of checklist) {
    const ok = oracoes.some((o) => o.cliente && !o.pergunta && casaAlguma(o.texto, q.palavras || []) && !casaAlguma(o.texto, cfg.incertezas));
    if (!ok) pendentes.push(q.id);
  }
  const prio = (p) => escopo.filter((e) => p.includes(e.prioridade)).map((e) => e.modulo);
  const pacotes = {
    essencial: fecharDependencias(prio(['obrigatorio']), catalogo),
    recomendado: fecharDependencias(prio(['obrigatorio', 'desejavel']), catalogo),
    completo: fecharDependencias(prio(['obrigatorio', 'desejavel', 'opcional']), catalogo),
  };
  const preco = {};
  for (const [nome, set] of Object.entries(pacotes)) {
    const r = precificar(somaHoras(set, catalogo), set.size === 0, prazo, tabela);
    preco[nome] = r.preco;
    log(`  pacote ${nome}: [${sortStr(set).join(', ')}] horas=${r.horas ?? 0} base=${r.base ?? 0} urg=${r.pctUrg ?? '-'}% desc=${r.pctDesc ?? '-'}% → ${r.preco}`);
  }
  return {
    saida: { escopo, fora_do_escopo: fora, perguntas_pendentes: sortStr(pendentes), prazo_semanas: prazo, preco_centavos: preco },
    pacotes,
  };
}

// ---------- etapa 2 ----------
function etapaCronograma(ctx, prop) {
  const { catalogo, equipe, log } = ctx;
  const pacote = prop.pacotes.recomendado;
  const prioridade = Object.fromEntries(prop.saida.escopo.map((e) => [e.modulo, e.prioridade]));
  const grupo = (id) => (prioridade[id] === 'obrigatorio' ? 1 : prioridade[id] === 'desejavel' ? 2 : 0);
  const cap = (p) => (equipe[p] ? Number(equipe[p].pessoas) * Number(equipe[p].horas_semana) : 0);
  const duracao = (id) => {
    let d = 0;
    for (const [p, h] of Object.entries(catalogo[id].horas || {})) {
      if (!(h > 0)) continue;
      const c = cap(p);
      if (!(c > 0)) { log(`  AVISO: papel ${p} sem capacidade em equipe.json (módulo ${id})`); continue; }
      d = Math.max(d, Math.ceil(h / c));
    }
    return d;
  };
  const feitos = new Set();
  const restantes = new Set(pacote);
  const modulos = [];
  let semana = 0;
  while (restantes.size) {
    const prontos = [...restantes].filter((id) => (catalogo[id].requer || []).every((r) => feitos.has(r) || !pacote.has(r)));
    if (!prontos.length) { log('  ERRO: dependência circular; resto em ordem alfabética'); prontos.push(...restantes); }
    prontos.sort((a, b) => grupo(a) - grupo(b) || (a < b ? -1 : a > b ? 1 : 0));
    const id = prontos[0];
    const d = duracao(id);
    const inicio = semana + 1;
    const fim = inicio + d - 1;
    modulos.push({ modulo: id, inicio, fim });
    log(`  ${id} (grupo ${grupo(id)}, ${d} sem): ${inicio}–${fim}`);
    semana = fim;
    feitos.add(id);
    restantes.delete(id);
  }
  const total = modulos.length ? modulos[modulos.length - 1].fim : 0;
  const prazo = prop.saida.prazo_semanas;
  return { modulos, total_semanas: total, estoura_prazo: prazo !== null && total > prazo };
}

// ---------- etapa 3 ----------
function etapaRiscos(ctx, prop, crono) {
  const { oracoes, riscos, catalogo, tabela, log } = ctx;
  const pacote = prop.pacotes.recomendado;
  const validas = oracoes.filter((o) => o.cliente && !o.pergunta);
  const ativos = [];
  for (const r of riscos) {
    let ativo = false;
    if (Array.isArray(r.sinais)) {
      const o = validas.find((x) => casaAlguma(x.texto, r.sinais));
      ativo = !!o;
      if (o) log(`  ${r.id}: sinal na linha ${o.linha} ← "${o.texto}"`);
    } else if (r.gatilho === 'estoura_prazo') {
      ativo = crono.estoura_prazo;
      log(`  ${r.id}: gatilho estoura_prazo = ${crono.estoura_prazo}`);
    } else if (r.gatilho) log(`  AVISO: gatilho desconhecido ${r.gatilho} (${r.id})`);
    if (ativo && r.modulo && !pacote.has(r.modulo)) { log(`  ${r.id}: módulo ${r.modulo} fora do recomendado → inativo`); ativo = false; }
    if (ativo) ativos.push(r);
  }
  const horas = ativos.reduce((s, r) => s + Object.values(r.horas || {}).reduce((a, b) => a + Number(b), 0), 0);
  const res = precificar(somaHoras(pacote, catalogo, ativos.map((r) => r.horas)), pacote.size === 0, prop.saida.prazo_semanas, tabela);
  log(`  contingência ${horas} h → recomendado ${res.preco} (horas=${res.horas ?? 0} urg=${res.pctUrg ?? '-'}% desc=${res.pctDesc ?? '-'}%)`);
  return { ids: sortStr(ativos.map((r) => r.id)), horas_contingencia: horas, preco_recomendado_centavos: res.preco };
}

// ---------- etapa 4 ----------
function etapaPagamento(ctx, crono, risc) {
  const { oracoes, tabela, cfg, log } = ctx;
  const pg = tabela.pagamento || {};
  const termos = cfg.pagamento;
  const reParc = numeroRe(cfg, termos.parcela);
  let forma = null;
  let nPedido = null;
  let entradaPct = null;
  for (const o of oracoes) {
    if (!o.cliente || o.pergunta) continue;
    const ev = [];
    for (const e of termos.a_vista) for (const p of posicoes(o.texto, e)) ev.push({ idx: p.idx, tipo: 'a_vista' });
    reParc.lastIndex = 0;
    let m;
    while ((m = reParc.exec(o.texto))) {
      const n = valorNumero(m[1], cfg);
      if (n !== null) ev.push({ idx: m.index, tipo: 'parcelado', n });
    }
    for (const e of termos.sem_entrada) for (const p of posicoes(o.texto, e)) ev.push({ idx: p.idx, tipo: 'entrada', pct: 0 });
    if (casaAlguma(o.texto, termos.entrada)) {
      const rePct = new RegExp(`(?<!${W})(\\d+)%`, 'gu');
      while ((m = rePct.exec(o.texto))) ev.push({ idx: m.index, tipo: 'entrada', pct: parseInt(m[1], 10) });
    }
    ev.sort((a, b) => a.idx - b.idx);
    for (const e of ev) {
      if (e.tipo === 'a_vista') { forma = 'a_vista'; nPedido = null; }
      else if (e.tipo === 'parcelado') { forma = 'parcelado'; nPedido = e.n; }
      else entradaPct = e.pct;
      log(`  [${String(o.linha).padStart(3, '0')}] ${e.tipo}${e.n !== undefined ? ' ' + e.n : ''}${e.pct !== undefined ? ' ' + e.pct + '%' : ''}  ← "${o.texto}"`);
    }
  }
  if (forma === null) { forma = 'parcelado'; nPedido = pg.parcelas_padrao; }
  if (entradaPct === null) entradaPct = pg.entrada_pct_padrao ?? 0;

  const valor = BigInt(risc.preco_recomendado_centavos);
  if (forma === 'a_vista') {
    const total = (valor * BigInt(100 - (pg.desconto_a_vista_pct || 0))) / 100n;
    const parcelas = valor === 0n ? [] : [{ tipo: 'a_vista', semana: 0, valor_centavos: Number(total) }];
    log(`  à vista: ${valor} − ${pg.desconto_a_vista_pct}% = ${total}`);
    return { forma, valor_total_centavos: Number(total), parcelas };
  }
  if (valor === 0n) return { forma, valor_total_centavos: 0, parcelas: [] };
  const entrada = (valor * BigInt(entradaPct)) / 100n;
  const resto = valor - entrada;
  let n = Math.max(1, Math.min(Number(nPedido) || 1, pg.max_parcelas ?? Infinity));
  const minimo = BigInt(pg.parcela_minima_centavos || 0);
  if (resto / BigInt(n) < minimo) n = Math.max(1, Number(minimo > 0n ? resto / minimo : BigInt(n)));
  const parcelas = [];
  if (entrada > 0n) parcelas.push({ tipo: 'entrada', semana: 0, valor_centavos: Number(entrada) });
  const cada = resto / BigInt(n);
  const mods = crono.modulos;
  const mm = mods.length;
  for (let i = 1; i <= n; i++) {
    const v = i < n ? cada : resto - cada * BigInt(n - 1);
    const pos = Math.ceil((mm * i) / n);
    const semana = mm ? mods[pos - 1].fim : 0;
    parcelas.push({ tipo: 'parcela', semana, valor_centavos: Number(v) });
  }
  log(`  parcelado: entrada ${entradaPct}% = ${entrada}, resto ${resto}, pedido ${nPedido} → n=${n}`);
  return { forma, valor_total_centavos: Number(valor), parcelas };
}

// ---------- main ----------
function resolverCaso(dir, cfg, explain) {
  const log = explain ? (s) => process.stderr.write(s + '\n') : () => {};
  const ctx = {
    cfg,
    log,
    oracoes: lerOracoes(readFileSync(join(dir, 'transcricao.txt'), 'utf8'), cfg),
    catalogo: lerJson(join(dir, 'catalogo.json')),
    tabela: lerJson(join(dir, 'tabela.json')),
    checklist: existsSync(join(dir, 'checklist.json')) ? lerJson(join(dir, 'checklist.json')) : [],
    equipe: lerJson(join(dir, 'equipe.json')),
    riscos: existsSync(join(dir, 'riscos.json')) ? lerJson(join(dir, 'riscos.json')) : [],
  };
  log('# etapa 1 — proposta');
  const prop = etapaProposta(ctx);
  log('# etapa 2 — cronograma');
  const crono = etapaCronograma(ctx, prop);
  log('# etapa 3 — riscos');
  const risc = etapaRiscos(ctx, prop, crono);
  log('# etapa 4 — pagamento');
  const pag = etapaPagamento(ctx, crono, risc);
  return { proposta: prop.saida, cronograma: crono, riscos: risc, pagamento: pag };
}

const args = process.argv.slice(2);
let casosDir = 'casos';
let outDir = 'out';
let explain = false;
let cfg = DEFAULT_CONFIG;
const so = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--explain') explain = true;
  else if (a === '--casos') casosDir = args[++i];
  else if (a === '--out') outDir = args[++i];
  else if (a === '--config') cfg = mergeConfig(DEFAULT_CONFIG, lerJson(args[++i]));
  else so.push(a);
}
const casos = so.length ? so : readdirSync(casosDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
mkdirSync(outDir, { recursive: true });
let falhas = 0;
for (const caso of casos) {
  try {
    if (explain) process.stderr.write(`\n=========== ${caso} ===========\n`);
    const r = resolverCaso(join(casosDir, caso), cfg, explain);
    writeFileSync(join(outDir, `${caso}.json`), JSON.stringify(r, null, 2) + '\n');
    console.log(`ok ${caso}: ${r.proposta.escopo.length} no escopo, recomendado ${r.proposta.preco_centavos.recomendado} → ${r.riscos.preco_recomendado_centavos}, ${r.cronograma.total_semanas} sem, ${r.pagamento.forma} (${r.pagamento.parcelas.length} linhas)`);
  } catch (e) {
    falhas++;
    console.error(`ERRO ${caso}: ${e.stack || e}`);
  }
}
process.exit(falhas ? 1 : 0);
