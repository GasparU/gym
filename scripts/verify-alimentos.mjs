// Verifica la clasificación de calidad anexada a foods.json (desde AlimentosClasificados.xlsx).
// Corre: node scripts/verify-alimentos.mjs
// Sale con código 1 si alguna aserción falla.
import { readFileSync } from 'node:fs';

const alimentos = JSON.parse(readFileSync('public/data/foods.json', 'utf8'));

let ok = 0;
const fallos = [];
function check(nombre, valor, esperado) {
  const bien = JSON.stringify(valor) === JSON.stringify(esperado);
  if (bien) ok++;
  else fallos.push(`${nombre}: obtuve ${JSON.stringify(valor)}, esperaba ${JSON.stringify(esperado)}`);
}

const SACIEDAD = new Set(['Alta', 'Media', 'Baja']);
const GLUCEMIA = new Set(['Alta', 'Media', 'Baja']);
const contar = (fn) => alimentos.filter(fn).length;

// 1) Integridad de la base
check('cantidad de alimentos', alimentos.length, 927);
check('ids únicos', new Set(alimentos.map((f) => f.id)).size, 927);
check('nombres únicos', new Set(alimentos.map((f) => f.nombre)).size, 927);

// 2) Campos originales intactos (ninguno vacío)
for (const campo of ['energiaKcal', 'agua', 'proteinas', 'grasaTotal', 'carbohidratosTotales', 'fibra']) {
  check(`${campo} presente en todos`, alimentos.every((f) => Number.isFinite(f[campo])), true);
}

// 3) Clasificación: valores permitidos
check('saciedad válida en todos', alimentos.every((f) => SACIEDAD.has(f.saciedad)), true);
check('glucemia válida o nula en todos', alimentos.every((f) => f.glucemia === null || GLUCEMIA.has(f.glucemia)), true);
check('altoProteina booleano', alimentos.every((f) => typeof f.altoProteina === 'boolean'), true);
check('altaFibra booleano', alimentos.every((f) => typeof f.altaFibra === 'boolean'), true);
check(
  'carga glucémica nula o número ≥ 0',
  alimentos.every((f) => f.cargaGlucemica === null || (Number.isFinite(f.cargaGlucemica) && f.cargaGlucemica >= 0)),
  true,
);

// 4) Conteos exactos (los del Excel, medidos el 04/11/2026)
check('saciedad Alta', contar((f) => f.saciedad === 'Alta'), 240);
check('saciedad Media', contar((f) => f.saciedad === 'Media'), 498);
check('saciedad Baja', contar((f) => f.saciedad === 'Baja'), 189);
check('glucemia Alta', contar((f) => f.glucemia === 'Alta'), 65);
check('glucemia Media', contar((f) => f.glucemia === 'Media'), 223);
check('glucemia Baja', contar((f) => f.glucemia === 'Baja'), 589);
check('glucemia sin definir', contar((f) => f.glucemia === null), 50);
check('altoProteina', contar((f) => f.altoProteina), 376);
check('altaFibra', contar((f) => f.altaFibra), 165);
check('carga glucémica con dato', contar((f) => f.cargaGlucemica !== null), 139);

// 5) Puntos de control (si un valor se corre de fila, esto lo delata)
const porNombre = (n) => alimentos.find((f) => f.nombre === n);
check('pollo pulpa: saciedad Alta', porNombre('Pollo, carne pulpa')?.saciedad, 'Alta');
check('pollo pulpa: altoProteina', porNombre('Pollo, carne pulpa')?.altoProteina, true);
check('aceite de soya: saciedad Baja', porNombre('Aceite vegetal de soya')?.saciedad, 'Baja');
check('arroz blanco: glucemia Alta', porNombre('Arroz blanco corriente')?.glucemia, 'Alta');
check('arroz blanco: carga glucémica 14', porNombre('Arroz blanco corriente')?.cargaGlucemica, 14);
check('lentejas: altaFibra', porNombre('Lentejas chicas')?.altaFibra, true);
check('camote: saciedad Media', porNombre('Camote amarillo sin cáscara')?.saciedad, 'Media');
check('papa blanca: carga nula', porNombre('Papa blanca')?.cargaGlucemica, null);

// 6) La clasificación NO puede haber tocado las kcal (control de regresión)
check('arroz blanco 358 kcal', porNombre('Arroz blanco corriente')?.energiaKcal, 358);
check('pollo pulpa 119 kcal', porNombre('Pollo, carne pulpa')?.energiaKcal, 119);

console.log('=== Clasificación de alimentos: verificación ===');
if (fallos.length) {
  console.log(`\n❌ ${fallos.length} FALLO(S) de ${ok + fallos.length}:`);
  fallos.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`\n✅ ${ok}/${ok} aserciones OK`);
