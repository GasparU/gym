// Verifica el recetario (platos.json) y el nucleo de calculo (src/logic/platos.ts).
// Corre: node scripts/verify-platos.mjs
import fs from 'node:fs';
import {
  calcularPlato,
  factorParaPresupuesto,
  textoPorcion,
  GRUPOS_PLATO,
  rolDePlato,
  puedeAgregarPlato,
  rolesEnComida,
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
check('cantidad de platos', platos.length, 61);
check('ids unicos', new Set(platos.map((p) => p.id)).size, platos.length);
check('nombres unicos', new Set(platos.map((p) => p.nombre)).size, platos.length);
check('todos tienen grupo valido', platos.every((p) => GRUPOS_PLATO.includes(p.grupo)), true);
check('todos tienen al menos 3 ingredientes', platos.every((p) => p.ingredientes.length >= 3), true);
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
  'pollo-al-mani': { kcal: 594.6, p: 44, g: 433 },
  'carapulcra': { kcal: 563.1, p: 35.2, g: 252 },
  'chanfainita': { kcal: 466.7, p: 33.3, g: 460 },
  'ocopa': { kcal: 480.5, p: 14.2, g: 300 },
  'aguadito-de-pollo': { kcal: 647.7, p: 34.7, g: 561 },
  'sopa-de-pollo-con-fideos': { kcal: 562.3, p: 32.8, g: 523 },
  'sopa-de-semola-con-pollo': { kcal: 564.8, p: 27.7, g: 491 },
  'sopa-de-lentejas': { kcal: 327.3, p: 16.7, g: 421 },
  'menestron': { kcal: 585.2, p: 36.9, g: 540 },
  'caldo-de-gallina': { kcal: 611.4, p: 37.7, g: 523 },
  'sopa-a-la-minuta': { kcal: 508.8, p: 34.4, g: 512 },
  'sopa-de-sustancia': { kcal: 458.5, p: 34.5, g: 536 },
  'sopa-de-quinua': { kcal: 444.5, p: 16.8, g: 428 },
  'sopa-de-moron': { kcal: 370.4, p: 24.6, g: 461 },
  'sopa-de-verduras': { kcal: 384, p: 11.5, g: 500 },
  'sopa-de-albondigas': { kcal: 376.1, p: 31.4, g: 512 },
  'chupe-de-pescado': { kcal: 556.7, p: 45.8, g: 602 },
  'sopa-de-zapallo': { kcal: 341.2, p: 11.2, g: 515 },
  'sopa-de-arvejas': { kcal: 481.6, p: 25.8, g: 530 },
  'pollo-a-la-brasa': { kcal: 556.2, p: 58.1, g: 457 },
  'pollada': { kcal: 545, p: 47.7, g: 406 },
  'chicharron-de-pollo': { kcal: 730, p: 47.4, g: 411 },
  'pollo-al-horno-con-papas': { kcal: 521.7, p: 51.5, g: 428 },
  'milanesa-de-pollo': { kcal: 563.6, p: 41.3, g: 375 },
  'lomo-saltado': { kcal: 676.9, p: 41.4, g: 630 },
  'bistec-a-lo-pobre': { kcal: 717.8, p: 46.6, g: 571 },
  'anticuchos': { kcal: 559.2, p: 34, g: 481 },
  'chicharron-de-cerdo': { kcal: 1084, p: 21.7, g: 340 },
  'albondigas-en-salsa': { kcal: 516.7, p: 35.5, g: 445 },
  'carne-guisada-con-papa': { kcal: 623.2, p: 37.5, g: 605 },
  'pollo-al-sillao': { kcal: 534.5, p: 48, g: 470 },
  'papa-a-la-huancaina': { kcal: 571.2, p: 22.2, g: 405 },
  'causa-limenya': { kcal: 493.1, p: 26, g: 390 },
  'ensalada-rusa': { kcal: 313.5, p: 12.4, g: 290 },
  'papa-camote-y-choclo': { kcal: 429.5, p: 14.5, g: 400 },
  'ensalada-fresca': { kcal: 120.4, p: 1.9, g: 220 },
  'choclo-con-queso': { kcal: 315, p: 13.6, g: 245 },
  'papa-rellena': { kcal: 516.1, p: 31.2, g: 390 },
  'salchipapa': { kcal: 665.8, p: 13.8, g: 295 },
  'ensalada-de-pallares': { kcal: 221.1, p: 13.2, g: 155 },
  'tallarin-saltado': { kcal: 557, p: 36, g: 525 },
  'sopa-seca': { kcal: 503.4, p: 35.3, g: 495 },
  'arroz-tapado': { kcal: 587.4, p: 36.3, g: 490 },
  'arroz-con-huevo-frito': { kcal: 531.9, p: 18.7, g: 360 },
  'tallarin-guisado-con-pollo': { kcal: 573.5, p: 42.8, g: 592 },
  'frejol-guisado': { kcal: 573.7, p: 24.6, g: 385 },
  'segundo-de-pallares': { kcal: 573.6, p: 22.9, g: 385 },
  'lentejas-guisadas': { kcal: 516.3, p: 22.3, g: 366 },
  'tacu-tacu': { kcal: 520.8, p: 19.8, g: 465 },
  'cau-cau': { kcal: 580.4, p: 32.1, g: 515 },
  'locro-de-zapallo': { kcal: 395, p: 12, g: 470 },
  'estofado-de-pollo': { kcal: 686.5, p: 51.9, g: 680 },
  'adobo-de-chancho': { kcal: 604.4, p: 42.7, g: 375 },
  'quinua-saltada-con-pollo': { kcal: 494.8, p: 37.9, g: 490 },
  'pescado-frito-con-arroz': { kcal: 817, p: 76.2, g: 540 },
  'sudado-de-pescado': { kcal: 473.1, p: 47.1, g: 515 },
  'chicharron-de-pescado': { kcal: 655.6, p: 48.2, g: 400 },
};
for (const p of platos) {
  const calc = calcularPlato(p, {}, foods, 1);
  const g = GOLD[p.id];
  checkCerca(`${p.id} kcal`, calc.totales.kcal, g.kcal);
  checkCerca(`${p.id} proteina`, calc.totales.proteinas, g.p);
  checkCerca(`${p.id} gramos`, calc.gramos, g.g, 0.5);
  check(`${p.id} sin faltantes`, calc.faltantes, []);
}

    // ---- El UNICO segundo con quinua (pedido del dueno, 05/11/2026) ----
    // Sin esto, el buscador no lo ofrece y nadie se entera de que existe.
    const quinua = platos.find((p) => p.id === 'quinua-saltada-con-pollo');
    check('existe el segundo de quinua', !!quinua, true);
    check('el segundo de quinua es un SEGUNDO', quinua?.grupo, 'Guisos y segundos');
    check(
      'el segundo de quinua declara la quinua COCIDA',
      /cocida/i.test(quinua?.nota ?? ''),
      true,
    );
    check(
      'hay un solo plato con quinua como segundo',
      platos.filter((p) => p.grupo !== 'Sopas' && /quinua/i.test(p.nombre)).map((p) => p.id),
      ['quinua-saltada-con-pollo'],
    );

    // ---- "Mi version": ajustar los gramos de UN ingrediente (05/11/2026) ----
    // El plato sigue siendo UNA fila: lo que cambia son los gramos que comiste de verdad.
    const conAjuste = calcularPlato(quinua, { ajustes: { 'Quinua cocida': 100 } }, foods, 1);
    check(
      'mi version cambia los gramos',
      conAjuste.lineas.find((l) => l.nombre === 'Quinua cocida')?.gramos,
      100,
    );
    checkCerca('mi version baja el total', conAjuste.totales.kcal, 405.8);
    checkCerca('la receta original NO se toca', calcularPlato(quinua, {}, foods, 1).totales.kcal, 494.8);
    checkCerca(
      'un ajuste negativo se ignora (no borra comida)',
      calcularPlato(quinua, { ajustes: { 'Quinua cocida': -5 } }, foods, 1).totales.kcal,
      494.8,
    );
    checkCerca(
      'un ajuste de otro plato se ignora',
      calcularPlato(quinua, { ajustes: { 'No existe': 50 } }, foods, 1).totales.kcal,
      494.8,
    );
    check(
      'cada linea trae su foodId (para el desglose)',
      calcularPlato(quinua, {}, foods, 1).lineas.every((l) => typeof l.foodId === 'number' && l.foodId > 0),
      true,
    );
    check(
      'el desglose suma lo mismo que el plato',
      Math.round(conAjuste.lineas.reduce((s, l) => s + l.kcal, 0) * 10) / 10,
      conAjuste.totales.kcal,
    );

    // ---- Buscador: NUNCA puede cortar la lista (pedido del dueno, 05/11/2026) ----
    // "pongo quinua y solo sale sopa de quinua": el buscador ya no limita resultados, pero
    // se congela aca para que nadie meta un `.slice(0, N)` sin darse cuenta.
    const buscador = fs.readFileSync('src/components/BuscadorPlato.tsx', 'utf8');
    const diet = fs.readFileSync('src/components/DietModule.tsx', 'utf8');
    check('el buscador no corta la lista', /\.slice\(/.test(buscador), false);
    check('el buscador dibuja la lista completa', /lista\.map\(/.test(buscador), true);
    check('el buscador no hide ningun grupo', /p\.grupo\s*===/.test(buscador), false);
    check('el buscador busca por NOMBRE sin acentos', /normalize\('NFD'\)/.test(buscador), true);
    check('el buscador avisa cuando hay que deslizar', /desliz/i.test(buscador), true);
    check('el recetario se pide sin cache', /cache:\s*['"]no-cache['"]/.test(diet), true);

    // ---- Cableado de "las dos cosas": ajustar gramos + agregar suelto ----
    const modal = fs.readFileSync('src/components/PlatoModal.tsx', 'utf8');
    check('el modal deja ajustar gramos', /ajustar gramos/.test(modal), true);
    check('el modal ofrece el desglose suelto', /onAgregarSuelto/.test(modal), true);
    check('el modal vuelve la porcion a 1 mientras ajustas', /ajustando \? 1 :/.test(modal), true);
    check('el modal puede volver a la receta', /volver a la receta/.test(modal), true);
    check('DietModule guarda el plato de origen', /platoId: plato\.id/.test(diet), true);
    check(
      'DietModule arma las filas sueltas con su foodId',
      /foodId: l\.foodId as number/.test(diet),
      true,
    );

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

// ---- Toda opcion tiene una alternativa que cambia el total ----
const opcionesInutiles = [];
for (const p of platos) {
  for (const o of p.opciones ?? []) {
    const baseKcal = calcularPlato(p, {}, foods, 1).totales.kcal;
    const cambian = o.alternativas.filter((a) => Math.abs(calcularPlato(p, { opciones: { [o.id]: a.id } }, foods, 1).totales.kcal - baseKcal) > 1);
    if (cambian.length === 0) opcionesInutiles.push(p.id + ':' + o.id);
  }
}
check('toda opcion tiene una alternativa que cambia el total', opcionesInutiles, []);

// ---- Escalado por factor ----
const arroz = platos.find((p) => p.id === 'arroz-con-pollo');
const doble = calcularPlato(arroz, {}, foods, 2);
checkCerca('factor 2 duplica kcal', doble.totales.kcal, 1073.0, 0.3);
checkCerca('factor 2 duplica gramos', doble.gramos, 920, 1);

// ---- Porcion segun presupuesto ----
check('factor ajusta al presupuesto', factorParaPresupuesto(494, 420), 0.85);
check('factor NO infla aunque sobre presupuesto', factorParaPresupuesto(500, 1000), 1);
check('factor con 1037 restantes y plato de 611 -> 1', factorParaPresupuesto(611.4, 1037), 1);
check('factor 1.5 solo si se pide explicito', factorParaPresupuesto(500, 1000, 0.5, 1.5), 1.5);
check('factor tiene piso 0.5', factorParaPresupuesto(500, 100), 0.5);
check('factor sin presupuesto -> piso', factorParaPresupuesto(500, 0), 0.5);
check('factor con plato 0 -> 1', factorParaPresupuesto(0, 500), 1);
check('factor con NaN -> 1', factorParaPresupuesto(Number.NaN, 500), 1);
check('texto de 1 porcion', textoPorcion(1), '1 porcion');
check('texto de 0,85', textoPorcion(0.85), '0,85 porciones');

// ---- Caldo con grasa vs desgrasado (opcion por sopa) ----
const caldoGallina = platos.find((p) => p.id === 'caldo-de-gallina');
check('el caldo es una OPCION, no un ingrediente fijo', (caldoGallina.ingredientes ?? []).some((i) => i.nombre.startsWith('Caldo')), false);
check('la opcion de caldo tiene grasa y desgrasado',
  (caldoGallina.opciones ?? []).find((o) => o.id === 'caldo')?.alternativas.map((a) => a.id),
  ['grasa', 'desgrasado']);
check('por defecto el caldo va con grasa',
  Math.round(calcularPlato(caldoGallina, { opciones: { caldo: 'grasa' } }, foods, 1).totales.kcal), 611);
const kcalDesgrasado = Math.round(calcularPlato(caldoGallina, { opciones: { caldo: 'desgrasado' } }, foods, 1).totales.kcal);
check('el desgrasado resta entre 130 y 150 kcal', kcalDesgrasado >= 461 && kcalDesgrasado <= 481, true);
check('las 15 sopas tienen la opcion de caldo',
  platos.filter((p) => p.grupo === 'Sopas').filter((p) => (p.opciones ?? []).some((o) => o.id === 'caldo')).length, 15);

// ---- Regla de la casa: 1 sopa + 1 segundo por comida ----
check('rol: una sopa es sopa', rolDePlato({ grupo: 'Sopas' }), 'sopa');
check('rol: un segundo es segundo', rolDePlato({ grupo: 'Pollos y carnes' }), 'segundo');
check('NO se admiten 2 segundos', puedeAgregarPlato('segundo', ['segundo']), false);
check('sopa + segundo conviven', puedeAgregarPlato('sopa', ['segundo']), true);
check('segundo + sopa conviven', puedeAgregarPlato('segundo', ['sopa']), true);
check('NO se admiten 2 sopas', puedeAgregarPlato('sopa', ['sopa']), false);
check('comida vacia acepta ambos', [puedeAgregarPlato('sopa', []), puedeAgregarPlato('segundo', [])], [true, true]);
check('rolesEnComida resuelve por NOMBRE',
  rolesEnComida([{ nombre: 'Aguadito de pollo' }, { nombre: 'Lomo saltado' }, { nombre: 'huevo' }], platos),
  ['sopa', 'segundo']);
check('hay 15 sopas y 46 segundos',
  platos.filter((p) => rolDePlato(p) === 'sopa').length + '/' + platos.filter((p) => rolDePlato(p) === 'segundo').length,
  '15/46');

console.log('=== Recetario de platos: verificacion ===');
if (fallos.length) {
  console.log(`\n❌ ${fallos.length} FALLO(S) de ${ok + fallos.length}:`);
  fallos.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`\n✅ ${ok}/${ok} aserciones OK`);
