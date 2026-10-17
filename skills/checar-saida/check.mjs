// Valida out/*.json: existe um arquivo por caso em casos/, e cada arquivo é JSON válido.
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const erros = [];
const casos = existsSync('casos') ? readdirSync('casos', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
if (!existsSync('out')) erros.push('a pasta out/ não existe');
for (const caso of casos) {
  const arquivo = `out/${caso}.json`;
  if (!existsSync(arquivo)) { erros.push(`falta ${arquivo}`); continue; }
  try { JSON.parse(readFileSync(arquivo, 'utf8')); } catch (e) { erros.push(`${arquivo} não é JSON válido: ${e.message}`); }
}
// TODO da equipe: checar aqui os campos obrigatórios do seu problema.
if (erros.length) { console.error(erros.join('\n')); process.exit(1); }
console.log(`ok: ${casos.length} caso(s) com saída válida`);
