// Verificación del núcleo metabólico: importa el código REAL (.ts) y lo mide.
// Correr:  node scripts/verify-metabolism.mjs
// Sale con código 1 si alguna aserción falla.
import {
  calculateMetabolicTargets,
  factorPorDias,
  repartoCalorico,
  clasificarImc,
  estimarGrasaNavy,
} from '../src/logic/metabolism.ts';
import { computeMealTotals } from '../src/logic/auditor.ts';
import { numEs, numEsMax } from '../src/logic/formato.ts';
import { readFileSync } from 'node:fs';
import { RUTINA, DIAS_INICIALES, filasParaInsertar, seriesPorGrupo } from '../src/logic/routines.ts';
import {
  normalizarDias,
  siguienteIdDia,
  diasFaltantes,
  validarDia,
  puedeEliminarDia,
} from '../src/logic/days.ts';
import { resumenProgreso } from '../src/logic/progress.ts';

let ok = 0;
const fallos = [];

function check(nombre, valor, esperado, tol = 0) {
  const bien =
    typeof esperado === 'number'
      ? Math.abs(valor - esperado) <= tol
      : valor === esperado;
  if (bien) {
    ok++;
  } else {
    fallos.push(`${nombre}: obtuve ${JSON.stringify(valor)}, esperaba ${JSON.stringify(esperado)}`);
  }
}

// ---------- Perfil real del dueño (sin % de grasa) ----------
const A = calculateMetabolicTargets({
  peso: 98, talla: 175, edad: 44, sexo: 'H', diasEntrenamiento: 3, deficitPct: 0.15,
});
check('A.imc', A.imc, 32);
check('A.tmb (Mifflin peso real)', A.tmb, 1859);
check('A.tdee', A.tdee, 2556);
check('A.meta', A.metaCalorica, 2173);
check('A.proteina', A.targetProteinaG, 176);
check('A.grasa', A.targetGrasaG, 74);
check('A.carbs', A.targetCarbohidratosG, 201);
check('A.formula', A.formulaTmb, 'MIFFLIN_ST_JEOR');
check('A.base proteína = peso real', A.proteinaBaseG, 98);
check('A.aviso Mifflin', A.avisos.some((a) => a.includes('Mifflin')), true);
check('A.aviso peso ajustado', A.avisos.some((a) => a.includes('peso ajustado')), true);
check('A.aviso factor por días', A.avisos.some((a) => a.includes('asumido por los días')), true);

// ---------- Mismo perfil + 28% de grasa (Katch-McArdle) ----------
const B = calculateMetabolicTargets({
  peso: 98, talla: 175, edad: 44, sexo: 'H', diasEntrenamiento: 3, deficitPct: 0.15, grasaPct: 0.28,
});
check('B.masaLibreGrasa', B.masaLibreGrasa, 70.56, 0.01);
check('B.formula', B.formulaTmb, 'KATCH_MCARDLE');
check('B.tmb', B.tmb, 1894);
check('B.tdee', B.tdee, 2604);
check('B.meta', B.metaCalorica, 2213);
check('B.proteina', B.targetProteinaG, 162);
check('B.grasa', B.targetGrasaG, 53);
check('B.carbs', B.targetCarbohidratosG, 272);

// ---------- Factor de actividad explícito ----------
const C = calculateMetabolicTargets({
  peso: 98, talla: 175, edad: 44, sexo: 'H', diasEntrenamiento: 3,
  deficitPct: 0.15, grasaPct: 0.28, nivelActividad: 'SEDENTARIO',
});
check('C.factor', C.factorActividad, 1.2);
check('C.fuente', C.factorActividadFuente, 'NIVEL');
check('C.tdee', C.tdee, 2273);
check('C.meta', C.metaCalorica, 1932);

// ---------- Déficit ----------
const D = calculateMetabolicTargets({
  peso: 98, talla: 175, edad: 44, sexo: 'H', diasEntrenamiento: 3, grasaPct: 0.28, deficitPct: 0.25,
});
check('D.meta 25%', D.metaCalorica, 1953);

const E = calculateMetabolicTargets({
  peso: 98, talla: 175, edad: 44, sexo: 'H', diasEntrenamiento: 3, grasaPct: 0.28, deficitPct: 0.5,
});
check('E.deficit limitado a 0.35', E.deficitPctUsado, 0.35);
check('E.aviso rango', E.avisos.some((a) => a.includes('fuera de rango')), true);

// ---------- Bordes de la escalera de días ----------
const dias = [[0, 1.2], [1, 1.2], [2, 1.375], [3, 1.375], [4, 1.55], [5, 1.55], [6, 1.725], [7, 1.725], [3.4, 1.375]];
for (const [d, f] of dias) check(`factorPorDias(${d})`, factorPorDias(d), f);

// ---------- Piso hormonal de grasa ----------
const G = calculateMetabolicTargets({
  peso: 60, talla: 175, edad: 30, sexo: 'H', diasEntrenamiento: 4,
  deficitPct: 0.15, grasaPct: 0.15, nivelActividad: 'LIGERO',
});
check('G.grasa en el piso', G.targetGrasaG, 39);
check('G.aviso piso', G.avisos.some((a) => a.includes('piso hormonal')), true);

// ---------- Techo de proteína ----------
const H = calculateMetabolicTargets({
  peso: 120, talla: 150, edad: 40, sexo: 'H', diasEntrenamiento: 0,
  deficitPct: 0.35, grasaPct: 0.05,
});
check('H.proteina recortada', H.targetProteinaG, 220);
check('H.aviso techo proteína', H.avisos.some((a) => a.includes('techo es 40%')), true);
check('H.grasa recortada', H.targetGrasaG, 85);
check('H.aviso techo grasa', H.avisos.some((a) => a.includes('techo del 35%')), true);

// ---------- Cierre de macros ----------
for (const [nombre, r] of [['A', A], ['B', B], ['G', G], ['H', H]]) {
  const suma = r.targetProteinaG * 4 + r.targetGrasaG * 9 + r.targetCarbohidratosG * 4;
  check(`${nombre}: macros cierran (±5 kcal)`, Math.abs(suma - r.metaCalorica) <= 5, true);
  const pct = repartoCalorico(r);
  check(`${nombre}: reparto suma 100`, Math.abs(pct.proteina + pct.grasa + pct.carbohidratos - 100) < 1, true);
}
check('B: proteína 29% de kcal', Math.round((B.targetProteinaG * 4 * 100) / B.metaCalorica), 29);
check('B: grasa 22% de kcal', Math.round((B.targetGrasaG * 9 * 100) / B.metaCalorica), 22);

// ---------- Clasificación sin huecos ----------
check('IMC 18.5', clasificarImc(18.5), 'Peso Ideal');
check('IMC 25 exacto', clasificarImc(25), 'Sobrepeso');
check('IMC 30 exacto', clasificarImc(30), 'Obesidad Tipo I');

// ---------- Auditor: tolerancia relativa ----------
const comida = (kcal, p, f, c) =>
  computeMealTotals([{ id: '1', foodId: 1, nombre: 'x', gramos: 100, kcal, proteinas: p, grasa: f, carbohidratos: c, fibra: 0 }]);

const aud1 = comida(100, 10, 2, 10); // Atwater 98 -> diff 2
check('auditor: comida chica cuadra', aud1.estaCuadrado, true);
check('auditor: tolerancia 25', aud1.toleranciaKcal, 25);

const aud2 = comida(500, 30, 10, 70); // Atwater 490 -> diff 10
check('auditor: comida grande cuadra', aud2.estaCuadrado, true);
check('auditor: tolerancia 50', aud2.toleranciaKcal, 50);

const aud3 = comida(900, 20, 40, 60); // Atwater 680 -> diff 220 (24%)
check('auditor: descuadre real', aud3.estaCuadrado, false);
check('auditor: marca origen', aud3.posibleErrorDeOrigen, true);
check('auditor: tolerancia 90', aud3.toleranciaKcal, 90);

// ---------- Perfil REAL del dueño (99 kg, cintura 115, cuello 44 -> 32,4%) ----------
const R = calculateMetabolicTargets({
  peso: 99, talla: 175, edad: 44, sexo: 'H', diasEntrenamiento: 3,
  deficitPct: 0.15, grasaPct: 0.324, nivelActividad: 'LIGERO',
});
check('R.masaLibreGrasa', R.masaLibreGrasa, 66.92, 0.02);
check('R.formula', R.formulaTmb, 'KATCH_MCARDLE');
check('R.tmb', R.tmb, 1815);
check('R.tdee', R.tdee, 2496);
check('R.meta', R.metaCalorica, 2122);
check('R.proteina (1,6 g/kg peso manda sobre 2,3 g/kg MLG)', R.targetProteinaG, 158);
check('R.grasa', R.targetGrasaG, 50);
check('R.carbs', R.targetCarbohidratosG, 260);
check('R.factor elegido', R.factorActividadFuente, 'NIVEL');

// ---------- Navy ----------
const navy = estimarGrasaNavy({ cinturaCm: 115, cuelloCm: 44, tallaCm: 175, sexo: 'H' });
check('Navy %grasa', navy.grasaPct, 0.325, 0.004);
check('Navy metodo', navy.metodo, 'NAVY');
check('Navy cintura <= cuello -> null', estimarGrasaNavy({ cinturaCm: 46, cuelloCm: 44, tallaCm: 175, sexo: 'H' }), null);
check('Navy talla absurda -> null', estimarGrasaNavy({ cinturaCm: 115, cuelloCm: 44, tallaCm: 400, sexo: 'H' }), null);
check('Navy mujer sin cadera -> null', estimarGrasaNavy({ cinturaCm: 90, cuelloCm: 33, tallaCm: 165, sexo: 'M' }), null);
check('Navy mujer con cadera', estimarGrasaNavy({ cinturaCm: 90, cuelloCm: 33, tallaCm: 165, sexo: 'M', caderaCm: 105 }) !== null, true);
check('Navy no devuelve escala 0-100', navy.grasaPct < 1, true);

// ---------- Rutina real ----------
check('rutina: 3 dias con ejercicios', RUTINA.filter((d) => d.ejercicios.length > 0).length, 3);
check('rutina: 16 ejercicios (superserie separada en 2)', filasParaInsertar().length, 16);
check('rutina: la superserie son 2 filas (martillo + copa)',
  RUTINA.flatMap((d) => d.ejercicios).filter((e) => /martillo|copa de tríceps/i.test(e.nombre)).length, 2);
check('rutina: ya no hay fila unica "Superserie"',
  RUTINA.some((d) => d.ejercicios.some((e) => /superserie/i.test(e.nombre))), false);
check('rutina: biceps 6 series (dia 1 + dia 3) / triceps 6',
  `${seriesPorGrupo()['Bíceps']}/${seriesPorGrupo()['Tríceps']}`, '6/6');
check('rutina: pecho 10 series', seriesPorGrupo()['Pecho'], 10);
check('rutina: espalda 10 series', seriesPorGrupo()['Espalda'], 10);
check('rutina: sin sentadilla ni peso muerto', RUTINA.some((d) => d.ejercicios.some((e) => /sentadilla|peso muerto/i.test(e.nombre))), false);
check('rutina: 3 dias (el 4 lo crea el usuario)', RUTINA.length, 3);

// ---------- Días editables ----------
check('dias: 3 iniciales', DIAS_INICIALES.length, 3);
check('dias: ids iniciales', DIAS_INICIALES.map((d) => d.id).join(','), 'dia-1,dia-2,dia-3');
check('dias: normaliza basura', normalizarDias([null, { id: '' }, { id: 'dia-1', titulo: 'X' }]).length, 1);
check('dias: normaliza no-array -> null', normalizarDias('no'), null);
check('dias: dedupe por id', normalizarDias([{ id: 'a' }, { id: 'a' }]).length, 1);
check('dias: ordena por orden', normalizarDias([{ id: 'b', orden: 2 }, { id: 'a', orden: 1 }]).map((d) => d.id).join(','), 'a,b');
check('dias: titulo vacio se rellena', normalizarDias([{ id: 'x', titulo: '   ' }])[0].titulo, 'Día 1');
check('dias: siguiente id', siguienteIdDia([{ id: 'dia-1' }, { id: 'dia-3' }]), 'dia-4');
check('dias: siguiente id con orden invertido', siguienteIdDia([{ id: 'dia-3' }, { id: 'dia-1' }]), 'dia-4');
check('dias: siguiente id sin numericos', siguienteIdDia([{ id: 'abc' }]), 'dia-1');
check('dias: faltantes detecta huerfano', diasFaltantes([{ id: 'dia-1', titulo: 'A', dias: '', orden: 0 }], ['dia-1', 'dia-9']).map((d) => d.id).join(','), 'dia-9');
check('dias: faltantes titula', diasFaltantes([{ id: 'dia-1', titulo: 'A', dias: '', orden: 0 }], ['dia-9'])[0]?.titulo ?? 'N/A', 'Día 2');
check('dias: validar vacio', validarDia('  ', ''), 'El nombre del día no puede estar vacío.');
check('dias: validar ok', validarDia('Día 4', 'Sábado'), null);
check('dias: validar largo', validarDia('x'.repeat(61), ''), 'El nombre del día llega a 60 caracteres como máximo.');
check('dias: puede eliminar con 2', puedeEliminarDia([{ id: 'a' }, { id: 'b' }]), true);
check('dias: no puede con 1', puedeEliminarDia([{ id: 'a' }]), false);

// ---------- Progreso ----------
check('progreso: sube', resumenProgreso({ 1: 1000, 2: 1100, 3: 1200 }).tendencia, 'SUBE');
check('progreso: delta 20%', resumenProgreso({ 1: 1000, 2: 1100, 3: 1200 }).deltaPct, 20);
check('progreso: mejor volumen', resumenProgreso({ 1: 1000, 2: 1100, 3: 1200 }).mejorVolumen, 1200);
check('progreso: baja', resumenProgreso({ 1: 1000, 2: 900 }).tendencia, 'BAJA');
check('progreso: igual dentro del 2%', resumenProgreso({ 1: 1000, 2: 1005 }).tendencia, 'IGUAL');
check('progreso: sin datos', resumenProgreso({}).tendencia, 'SIN_DATOS');
check('progreso: ignora ceros', resumenProgreso({ 1: 0, 2: 0 }).tendencia, 'SIN_DATOS');
check('progreso: un solo punto no inventa tendencia', resumenProgreso({ 1: 1200 }).tendencia, 'SIN_DATOS');
const pv = resumenProgreso({ 1: 100, 2: 200, 3: 300, 4: 400, 5: 500, 6: 600 }, 3);
check('progreso: ventana de 3', pv.puntos, 3);
check('progreso: ventana delta 50%', pv.deltaPct, 50);

// ---------- Resumen ----------
const filas = [A, B, C, D, R].map((r, i) => {
  const p = repartoCalorico(r);
  return `  ${['A sin grasa', 'B 28% grasa', 'C sedentario', 'D déficit 25%', 'R perfil real'][i].padEnd(15)} ` +
    `TMB ${String(r.tmb).padStart(5)}  TDEE ${String(r.tdee).padStart(5)}  meta ${String(r.metaCalorica).padStart(5)}  ` +
    `P ${String(r.targetProteinaG).padStart(3)}g (${p.proteina}%)  G ${String(r.targetGrasaG).padStart(3)}g (${p.grasa}%)  C ${String(r.targetCarbohidratosG).padStart(3)}g (${p.carbohidratos}%)  [${r.formulaTmb}]`;
});

// ---------- Formato es-PE y deficit visible (04/11/2026) ----------
check('formato: 1.387 con separador de miles', numEs(1387), '1.387');
check('formato: 2,37 con 2 decimales', numEs(2.3670053795576806, 2), '2,37');
check('formato: negativo', numEs(-374), '-374');
check('formato: redondeo de 1386,9', numEs(1386.9), '1.387');
check('formato: 95,8 sin cero de cola', numEsMax(95.8, 1), '95,8');
check('formato: 95,8 recorta el cero con 2 decimales', numEsMax(95.8, 2), '95,8');
check('formato: 300 entero sin coma', numEsMax(300, 1), '300');
check('formato: los ceros de miles no se recortan', numEsMax(1000, 1), '1.000');
check('deficit: tdee - meta', A.deficitKcal, A.tdee - A.metaCalorica);
check('deficit: perfil real', R.deficitKcal, R.tdee - R.metaCalorica);

const DIET_SRC = readFileSync(new URL('../src/components/DietModule.tsx', import.meta.url), 'utf8');
check('wiring: barra con contenedor visible', DIET_SRC.includes('bg-slate-950 ring-1 ring-slate-600'), true);
check('wiring: marca del 100%', DIET_SRC.includes('left-[99.5%]'), true);
check('wiring: fila de deficit', DIET_SRC.includes('>Déficit</span>'), true);
check('wiring: fila Te queda', DIET_SRC.includes('Te queda hoy'), true);
check('wiring: 3 barras montadas', (DIET_SRC.match(/<BarraMacro/g) || []).length, 3);
const AUTO_SRC = readFileSync(new URL('../src/components/AutocompleteFood.tsx', import.meta.url), 'utf8');
const ESTADO_SRC = readFileSync(new URL('../src/components/EstadoAlimento.tsx', import.meta.url), 'utf8');
check('wiring: badge unico CRUDO/COCIDO', ESTADO_SRC.includes("'Cocido' : 'Crudo'"), true);
check('wiring: badge en el buscador', AUTO_SRC.includes('<EstadoAlimento esCocido={item.esCocido} />'), true);
check('wiring: guia Como elijo', AUTO_SRC.includes('¿Cómo elijo?'), true);
check('wiring: guia explica ingredientes', AUTO_SRC.includes('ingredientes'), true);
check('wiring: guia con ejemplo del trigo', AUTO_SRC.includes('segundo de trigo'), true);
check('wiring: badge tambien en la tabla', DIET_SRC.includes('<EstadoAlimento esCocido={f.esCocido} />'), true);


console.log('=== Núcleo metabólico: verificación ===');
console.log(filas.join('\n'));
console.log(`\nAvisos del perfil A (${A.avisos.length}):`);
A.avisos.forEach((a) => console.log('  · ' + a));
console.log(`\nAvisos del perfil B (${B.avisos.length}):`);
B.avisos.forEach((a) => console.log('  · ' + a));

if (fallos.length) {
  console.log(`\n❌ ${fallos.length} FALLO(S) de ${ok + fallos.length}:`);
  fallos.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`\n✅ ${ok}/${ok} aserciones OK`);
