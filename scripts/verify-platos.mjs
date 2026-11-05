// Verifica el recetario (platos.json) y el nucleo de calculo (src/logic/platos.ts).
// Corre: node scripts/verify-platos.mjs
import fs from 'node:fs';
import {
  calcularPlato,
  factorParaPresupuesto,
  textoPorcion,
  GRUPOS_PLATO,
} from '../src/logic/platos.ts';

const foods = JSON.parse(fs.readFileSync('public/data/foods.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('public/data/platos.json', 'utf8'));

let ok = 0;
const fallos = [];
function check(nombre, valor, esperado) {
  const bien = JSON.stringify(valor) === JSON.stringify(esperado);
  if (bien) ok++;
  else fallos.push(`${nombre}: obtuve ${JSON.stringify(valor)}, esperaba ${JSON.stringify(esperado)}`);
}
function checkCerca(nombre, valor, esperado, tol = 0.15) {
  const bien = typeof valor === 'number' && Math.abs(valor - esperado) <= tol;
  if (bien) ok++;
  else fallos.push(`${nombre}: obtuve ${valor}, esperaba ${esperado} (tol ${tol})`);
}

const platos = data.platos ?? [];
const porNombre = new Map(foods.map((f) => [f.nombre, f]));

// ---- Estructura ----
check('cantidad de platos', platos.length, 23);
check('ids unicos', new Set(platos.map((p) => p.id)).size, platos.length);
check('nombres unicos', new Set(platos.map((p) => p.nombre)).size, platos.length);
check('todos tienen grupo valido', platos.every((p) => GRUPOS_PLATO.includes(p.grupo)), true);
check('todos tienen al menos 5 ingredientes', platos.every((p) => p.ingredientes.length >= 5), true);
check('hay 15 sopas', platos.filter((p) => p.grupo === 'Sopas').length, 15);
check(
  'gramos positivos',
  platos.every((p) => p.ingredientes.every((i) => Number.isFinite(i.gramos) && i.gramos > 0)),
  true,
);

// ---- El nombre del plato NO puede chocar con un alimento ----
// (la fila se guarda por nombre; si chocara, al recargar se recalcularia como alimento de 100 g)
check('ningun plato se llama igual que un alimento', platos.filter((p) => porNombre.has(p.nombre)).map((p) => p.nombre), []);

// ---- Toda referencia existe en foods.json ----
const referencias = [];
for (const p of platos) {
  for (const i of p.ingredientes) referencias.push(i.nombre);
  for (const e of p.extras ?? []) for (const i of e.ingredientes) referencias.push(i.nombre);
  for (const o of p.opciones ?? []) for (const a of o.alternativas) for (const i of a.ingredientes) referencias.push(i.nombre);
}
const inexistentes = [...new Set(referencias.filter((n) => !porNombre.has(n)))];
check('todas las referencias existen en foods.json', inexistentes, []);

// ---- Opciones bien formadas ----
for (const p of platos) {
  for (const o of p.opciones ?? []) {
    check(`opcion ${o.id} de ${p.id} tiene >=2 alternativas`, o.alternativas.length >= 2, true);
    check(`opcion ${o.id} de ${p.id} tiene porDefecto valido`, o.alternativas.some((a) => a.id === o.porDefecto), true);
  }
}

// ---- Observaciones declaradas (ingredientes que NO estan en la tabla) ----
const chaufa = platos.find((p) => p.id === 'arroz-chaufa');
check('chaufa declara el sillao', (chaufa?.observaciones ?? []).some((o) => /sillao/i.test(o.ingrediente)), true);
check(
  'toda observacion tiene kcal y detalle',
  platos.every((p) => (p.observaciones ?? []).every((o) => Number.isFinite(o.aproxKcal) && o.detalle.length > 10)),
  true,
);
check(
  'ninguna observacion es tambien un ingrediente',
  platos.every((p) => (p.observaciones ?? []).every((o) => !p.ingredientes.some((i) => i.nombre === o.ingrediente))),
  true,
);

// ---- Valores dorados (congelados desde foods.json el 05/11/2026) ----
const GOLD = {
  'arroz-con-pollo': { kcal: 536.5, p: 35.4, g: 460 },
  'aji-de-gallina': { kcal: 625.2, p: 39.5, g: 471 },
  'arroz-chaufa': { kcal: 598.5, p: 34.3, g: 452 },
  'seco-de-pollo': { kcal: 526.3, p: 43.3, g: 490 },
  'pollo-al-mani': { kcal: 594.6, p: 44.0, g: 433 },
  carapulcra: { kcal: 563.1, p: 35.2, g: 252 },
  chanfainita: { kcal: 466.7, p: 33.3, g: 460 },
  ocopa: { kcal: 480.5, p: 14.2, g: 300 },
  'aguadito-de-pollo': { kcal: 647.7, p: 34.7, g: 561 },
  'sopa-de-pollo-con-fideos': { kcal: 562.3, p: 32.8, g: 523 },
  'sopa-de-semola-con-pollo': { kcal: 564.8, p: 27.7, g: 491 },
  'sopa-de-lentejas': { kcal: 327.3, p: 16.7, g: 421 },
  menestron: { kcal: 585.2, p: 36.9, g: 540 },
  'caldo-de-gallina': { kcal: 611.4, p: 37.7, g: 523 },
  'sopa-a-la-minuta': { kcal: 508.8, p: 34.4, g: 512 },
  'sopa-de-sustancia': { kcal: 458.5, p: 34.5, g: 536 },
  'sopa-de-quinua': { kcal: 444.5, p: 16.8, g: 428 },
  'sopa-de-moron': { kcal: 370.4, p: 24.6, g: 461 },
  'sopa-de-verduras': { kcal: 384.0, p: 11.5, g: 500 },
  'sopa-de-albondigas': { kcal: 376.1, p: 31.4, g: 512 },
  'chupe-de-pescado': { kcal: 556.7, p: 45.8, g: 602 },
  'sopa-de-zapallo': { kcal: 341.2, p: 11.2, g: 515 },
  'sopa-de-arvejas': { kcal: 481.6, p: 25.8, g: 530 },
};
for (const p of platos) {
  const calc = calcularPlato(p, {}, foods, 1);
  const g = GOLD[p.id];
  checkCerca(`${p.id} kcal`, calc.totales.kcal, g.kcal);
  checkCerca(`${p.id} proteina`, calc.totales.proteinas, g.p);
  checkCerca(`${p.id} gramos`, calc.gramos, g.g, 0.5);
  check(`${p.id} sin faltantes`, calc.faltantes, []);
}

// ---- Variantes cambian el total ----
const seco = platos.find((p) => p.id === 'seco-de-pollo');
checkCerca('seco con frejol', calcularPlato(seco, { opciones: { guarnicion: 'frejol' } }, foods, 1).totales.kcal, 706.3);
const carapulcra = platos.find((p) => p.id === 'carapulcra');
checkCerca('carapulcra con pollo', calcularPlato(carapulcra, { opciones: { carne: 'pollo' } }, foods, 1).totales.kcal, 534.3);
checkCerca('chaufa + hot dog', calcularPlato(chaufa, { extras: ['hotdog'] }, foods, 1).totales.kcal, 780.5);
const chupe = platos.find((p) => p.id === 'chupe-de-pescado');
checkCerca('chupe con merluza', calcularPlato(chupe, { opciones: { pescado: 'merluza' } }, foods, 1).totales.kcal, 470.9);
const aguadito = platos.find((p) => p.id === 'aguadito-de-pollo');
checkCerca('aguadito + mas arroz', calcularPlato(aguadito, { extras: ['mas-arroz'] }, foods, 1).totales.kcal, 719.3);

// ---- Escalado por factor ----
const arroz = platos.find((p) => p.id === 'arroz-con-pollo');
const doble = calcularPlato(arroz, {}, foods, 2);
checkCerca('factor 2 duplica kcal', doble.totales.kcal, 1073.0, 0.3);
checkCerca('factor 2 duplica gramos', doble.gramos, 920, 1);

// ---- Porcion segun presupuesto ----
check('factor ajusta al presupuesto', factorParaPresupuesto(494, 420), 0.85);
check('factor tiene techo 1.5', factorParaPresupuesto(500, 1000), 1.5);
check('factor tiene piso 0.5', factorParaPresupuesto(500, 100), 0.5);
check('factor sin presupuesto -> piso', factorParaPresupuesto(500, 0), 0.5);
check('factor con plato 0 -> 1', factorParaPresupuesto(0, 500), 1);
check('factor con NaN -> 1', factorParaPresupuesto(Number.NaN, 500), 1);
check('texto de 1 porcion', textoPorcion(1), '1 porcion');
check('texto de 0,85', textoPorcion(0.85), '0,85 porciones');

console.log('=== Recetario de platos: verificacion ===');
if (fallos.length) {
  console.log(`\n❌ ${fallos.length} FALLO(S) de ${ok + fallos.length}:`);
  fallos.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`\n✅ ${ok}/${ok} aserciones OK`);
