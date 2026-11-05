// Anexa a foods.json las 5 columnas de calidad de AlimentosClasificados.xlsx.
// Corre: node scripts/merge-clasificados.mjs   (idempotente)
// Une por NOMBRE (927/927 verificados, sin duplicados) y valida antes de escribir.
import XLSX from 'xlsx';
import fs from 'node:fs';

const XLSX_PATH = 'D:/Personal Trainer Y Nutricion/AlimentosClasificados.xlsx';
const JSON_PATH = 'public/data/foods.json';
const ALLOW = new Set(['Alta', 'Media', 'Baja']);
const SIN_DEFINIR = 'No definido';

const foods = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const wb = XLSX.readFile(XLSX_PATH);
const filas = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { defval: '' });

const porNombre = new Map();
for (const f of filas) {
  const nombre = String(f.NOMBRE_ALIMENTO ?? '').trim();
  if (!nombre) continue;
  if (porNombre.has(nombre)) throw new Error(`Nombre duplicado en el Excel: ${nombre}`);
  porNombre.set(nombre, f);
}

const faltantes = [];
const invalidos = [];
for (const f of foods) {
  const src = porNombre.get(String(f.nombre).trim());
  if (!src) { faltantes.push(f.nombre); continue; }
  const saciedad = String(src.Saciedad ?? '').trim();
  const glucemiaCruda = String(src.Glucemia ?? '').trim();
  const glucemia = glucemiaCruda === SIN_DEFINIR ? null : glucemiaCruda;
  if (!ALLOW.has(saciedad) || (glucemia !== null && !ALLOW.has(glucemia))) {
    invalidos.push(`${f.nombre}: saciedad=${saciedad} glucemia=${glucemiaCruda}`);
    continue;
  }
  const carga = String(src.Carga_Glucemica ?? '').replace(',', '.').trim();
  const cargaNum = carga === '' ? null : Number(carga);
  if (cargaNum !== null && (!Number.isFinite(cargaNum) || cargaNum < 0)) {
    invalidos.push(`${f.nombre}: carga glucémica inválida (${src.Carga_Glucemica})`);
    continue;
  }
  f.saciedad = saciedad;
  f.glucemia = glucemia;
  f.cargaGlucemica = cargaNum === null ? null : Math.round(cargaNum * 100) / 100;
  f.altoProteina = Number(src.Proteina) === 1;
  f.altaFibra = Number(src.Fibra) === 1;
}

if (faltantes.length) throw new Error(`Sin datos en el Excel (${faltantes.length}): ${faltantes.slice(0, 3).join(' | ')}`);
if (invalidos.length) throw new Error(`Valores inválidos (${invalidos.length}): ${invalidos.slice(0, 3).join(' | ')}`);
if (foods.length !== 927) throw new Error(`Se esperaban 927 alimentos, hay ${foods.length}`);

fs.writeFileSync(JSON_PATH, JSON.stringify(foods, null, 2) + '\n', 'utf8');

const cuenta = (k) => foods.reduce((acc, f) => { acc[f[k]] = (acc[f[k]] ?? 0) + 1; return acc; }, {});
console.log(`OK ${foods.length} alimentos escritos en ${JSON_PATH}`);
console.log('  saciedad:', JSON.stringify(cuenta('saciedad')));
console.log('  glucemia:', JSON.stringify(cuenta('glucemia')));
console.log('  altoProteina:', foods.filter((f) => f.altoProteina).length);
console.log('  altaFibra:', foods.filter((f) => f.altaFibra).length);
console.log('  cargaGlucemica con dato:', foods.filter((f) => f.cargaGlucemica !== null).length);
