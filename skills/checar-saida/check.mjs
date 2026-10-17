// Valida out/<caso>.json: um arquivo por pasta em casos/, formato exato do README e invariantes entre as etapas.
// Uso: node .opencode/skills/checar-saida/check.mjs   (saída 0 = ok; senão lista os problemas)
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const erros = [];
const casos = existsSync('casos') ? readdirSync('casos', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
if (!existsSync('out')) erros.push('a pasta out/ não existe');
if (!casos.length) erros.push('nenhum caso em casos/');

const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const isInt = (v) => Number.isInteger(v);
const ordenado = (a) => a.every((x, i) => i === 0 || a[i - 1] < x);
function chaves(obj, esperadas, onde, e) {
  if (kind(obj) !== 'object') return void e.push(`${onde}: esperado objeto, veio ${kind(obj)}`);
  for (const k of esperadas) if (!(k in obj)) e.push(`${onde}.${k}: campo faltando`);
  for (const k of Object.keys(obj)) if (!esperadas.includes(k)) e.push(`${onde}.${k}: campo que não existe no formato`);
}

for (const caso of casos) {
  const arquivo = `out/${caso}.json`;
  if (!existsSync(arquivo)) { erros.push(`falta ${arquivo}`); continue; }
  let o;
  try { o = JSON.parse(readFileSync(arquivo, 'utf8')); } catch (err) { erros.push(`${arquivo} não é JSON válido: ${err.message}`); continue; }
  const e = [];
  chaves(o, ['proposta', 'cronograma', 'riscos', 'pagamento'], caso, e);
  const catalogo = existsSync(`casos/${caso}/catalogo.json`) ? JSON.parse(readFileSync(`casos/${caso}/catalogo.json`, 'utf8')) : {};
  const ids = new Set(Object.keys(catalogo));

  // proposta
  const p = o.proposta || {};
  chaves(p, ['escopo', 'fora_do_escopo', 'perguntas_pendentes', 'prazo_semanas', 'preco_centavos'], 'proposta', e);
  if (Array.isArray(p.escopo)) {
    p.escopo.forEach((x, i) => {
      chaves(x, ['modulo', 'prioridade', 'linha'], `proposta.escopo[${i}]`, e);
      if (!['obrigatorio', 'desejavel', 'opcional'].includes(x?.prioridade)) e.push(`proposta.escopo[${i}].prioridade inválida: ${x?.prioridade}`);
      if (!isInt(x?.linha)) e.push(`proposta.escopo[${i}].linha não é inteiro`);
      if (ids.size && !ids.has(x?.modulo)) e.push(`proposta.escopo[${i}].modulo desconhecido: ${x?.modulo}`);
    });
    if (!ordenado(p.escopo.map((x) => x?.modulo))) e.push('proposta.escopo fora de ordem alfabética');
    const fora = new Set(p.fora_do_escopo || []);
    for (const x of p.escopo) if (fora.has(x?.modulo)) e.push(`${x.modulo} está no escopo e fora_do_escopo`);
  } else e.push('proposta.escopo não é array');
  for (const k of ['fora_do_escopo', 'perguntas_pendentes']) {
    if (!Array.isArray(p[k]) || !p[k].every((x) => typeof x === 'string')) e.push(`proposta.${k} não é array de strings`);
    else if (!ordenado(p[k])) e.push(`proposta.${k} fora de ordem alfabética (ou com repetição)`);
  }
  if (!(p.prazo_semanas === null || isInt(p.prazo_semanas))) e.push('proposta.prazo_semanas deve ser inteiro ou null');
  chaves(p.preco_centavos, ['essencial', 'recomendado', 'completo'], 'proposta.preco_centavos', e);
  const pc = p.preco_centavos || {};
  for (const k of ['essencial', 'recomendado', 'completo']) if (!isInt(pc[k]) || pc[k] < 0) e.push(`proposta.preco_centavos.${k} deve ser inteiro >= 0`);

  // cronograma
  const c = o.cronograma || {};
  chaves(c, ['modulos', 'total_semanas', 'estoura_prazo'], 'cronograma', e);
  if (Array.isArray(c.modulos)) {
    let ant = 0;
    c.modulos.forEach((m, i) => {
      chaves(m, ['modulo', 'inicio', 'fim'], `cronograma.modulos[${i}]`, e);
      if (!isInt(m?.inicio) || !isInt(m?.fim)) e.push(`cronograma.modulos[${i}] inicio/fim não inteiros`);
      if (m?.inicio !== ant + 1) e.push(`cronograma.modulos[${i}].inicio deveria ser ${ant + 1}`);
      if (m?.fim < m?.inicio) e.push(`cronograma.modulos[${i}] fim < inicio`);
      ant = m?.fim;
    });
    const total = c.modulos.length ? c.modulos[c.modulos.length - 1].fim : 0;
    if (c.total_semanas !== total) e.push(`cronograma.total_semanas deveria ser ${total}`);
    const est = p.prazo_semanas !== null && total > p.prazo_semanas;
    if (c.estoura_prazo !== est) e.push(`cronograma.estoura_prazo deveria ser ${est}`);
    for (const x of p.escopo || []) if (x?.prioridade !== 'opcional' && !c.modulos.some((m) => m?.modulo === x.modulo)) e.push(`${x.modulo} (${x.prioridade}) falta no cronograma`);
    if (!c.modulos.length && pc.recomendado !== 0) e.push('cronograma vazio mas preço recomendado != 0');
  } else e.push('cronograma.modulos não é array');

  // riscos
  const r = o.riscos || {};
  chaves(r, ['ids', 'horas_contingencia', 'preco_recomendado_centavos'], 'riscos', e);
  if (!Array.isArray(r.ids) || !ordenado(r.ids)) e.push('riscos.ids deve ser array em ordem alfabética');
  if (!isInt(r.horas_contingencia)) e.push('riscos.horas_contingencia deve ser inteiro');
  if (!isInt(r.preco_recomendado_centavos)) e.push('riscos.preco_recomendado_centavos deve ser inteiro');
  if (Array.isArray(r.ids) && !r.ids.length && r.horas_contingencia !== 0) e.push('sem riscos ativos mas horas_contingencia != 0');

  // pagamento
  const g = o.pagamento || {};
  chaves(g, ['forma', 'valor_total_centavos', 'parcelas'], 'pagamento', e);
  if (!['a_vista', 'parcelado'].includes(g.forma)) e.push(`pagamento.forma inválida: ${g.forma}`);
  if (Array.isArray(g.parcelas)) {
    g.parcelas.forEach((x, i) => {
      chaves(x, ['tipo', 'semana', 'valor_centavos'], `pagamento.parcelas[${i}]`, e);
      if (!['a_vista', 'entrada', 'parcela'].includes(x?.tipo)) e.push(`pagamento.parcelas[${i}].tipo inválido`);
      if (!isInt(x?.semana) || !isInt(x?.valor_centavos)) e.push(`pagamento.parcelas[${i}] semana/valor não inteiros`);
    });
    const soma = g.parcelas.reduce((s, x) => s + (x?.valor_centavos || 0), 0);
    if (g.parcelas.length && soma !== g.valor_total_centavos) e.push(`soma das parcelas (${soma}) != valor_total_centavos (${g.valor_total_centavos})`);
    if (g.forma === 'parcelado' && g.valor_total_centavos !== r.preco_recomendado_centavos) e.push('parcelado: valor_total_centavos deveria ser riscos.preco_recomendado_centavos');
    if (g.forma === 'a_vista' && g.parcelas.length && (g.parcelas.length !== 1 || g.parcelas[0].tipo !== 'a_vista' || g.parcelas[0].semana !== 0)) e.push('à vista: deve ser uma única linha a_vista na semana 0');
    const fins = new Set((c.modulos || []).map((m) => m?.fim));
    g.parcelas.forEach((x, i) => {
      if (x?.tipo === 'parcela' && fins.size && !fins.has(x.semana)) e.push(`pagamento.parcelas[${i}].semana ${x.semana} não é fim de nenhum módulo`);
      if (x?.tipo !== 'parcela' && x?.semana !== 0) e.push(`pagamento.parcelas[${i}] (${x?.tipo}) deve vencer na semana 0`);
      if (x?.tipo === 'entrada' && i !== 0) e.push('a entrada deve ser a primeira linha');
    });
    for (let i = 1; i < g.parcelas.length; i++) if (g.parcelas[i].semana < g.parcelas[i - 1].semana) e.push('parcelas com semanas fora de ordem');
    if (g.valor_total_centavos === 0 && g.parcelas.length) e.push('valor 0 → parcelas deve ser []');
  } else e.push('pagamento.parcelas não é array');

  for (const x of e) erros.push(`${caso}: ${x}`);
}

if (erros.length) { console.error(erros.join('\n')); process.exit(1); }
console.log(`ok: ${casos.length} caso(s) com formato e invariantes válidos`);
