// Verificación de las SEMANAS de la matriz (fechas reales + pesos) y del
// contrato "la nube manda, localStorage es caché".
//
//   node scripts/verify-semanas.mjs
//
// Importa el código REAL (.ts) — Node 24 hace type-stripping — así que no hay
// copias que puedan divergir. Sale con código 1 si algo falla.

import {
  fechaLocalISO,
  esFechaISO,
  lunesDe,
  sumarDias,
  normalizarSemanas,
  agregarSemana,
  quitarSemana,
  etiquetaRango,
  etiquetaSemana,
  volumenDe,
  volumenesPorSemana,
  mesesDeSemanas,
} from '../src/logic/weeks.ts';

let ok = 0;
const fallos = [];

function check(nombre, valor, esperado, tol = 0) {
  const bien =
    typeof esperado === 'number' ? Math.abs(valor - esperado) <= tol : valor === esperado;
  if (bien) ok++;
  else fallos.push(`${nombre}: obtuve ${JSON.stringify(valor)}, esperaba ${JSON.stringify(esperado)}`);
}

// ---------- Fechas ----------
// 2026-11-04 es MIÉRCOLES (verificado a mano en el calendario).
check('lunes de miércoles', lunesDe('2026-11-04'), '2026-11-02');
check('lunes de lunes es él mismo', lunesDe('2026-11-02'), '2026-11-02');
check('lunes de domingo es el lunes anterior', lunesDe('2026-11-08'), '2026-11-02');
check('domingo = lunes + 6', sumarDias('2026-11-02', 6), '2026-11-08');
check('cruce de mes', sumarDias('2026-11-30', 1), '2026-12-01');
check('cruce de año', sumarDias('2026-12-31', 1), '2027-01-01');
check('fecha válida', esFechaISO('2026-11-04'), true);
check('fecha inexistente (31 de febrero)', esFechaISO('2026-02-31'), false);
check('basura no es fecha', esFechaISO('04/11/2026'), false);
check('fecha local NO se corre a UTC', fechaLocalISO(new Date(2026, 10, 4, 23, 30)), '2026-11-04');

// ---------- Normalizar ----------
const desordenadas = normalizarSemanas([
  { inicio: '2026-11-16', fin: '2026-11-22' },
  { inicio: '2026-11-02', fin: '2026-11-08' },
  null,
  { inicio: '2026-11-16', fin: '2026-11-22' }, // duplicada
  { inicio: 'basura' },
]);
check('normaliza: 2 válidas y ordenadas', desordenadas.map((s) => s.inicio).join(','), '2026-11-02,2026-11-16');
check('normaliza: renumera 1..N', desordenadas.map((s) => s.orden).join(','), '1,2');
check('normaliza: id = inicio (clave estable)', desordenadas[0].id, '2026-11-02');
check('normaliza: completa fin si falta', normalizarSemanas([{ inicio: '2026-11-02' }])[0].fin, '2026-11-08');
check('normaliza: no-array -> []', normalizarSemanas('x').length, 0);

// ---------- Agregar ----------
const base = normalizarSemanas([{ inicio: '2026-11-02' }]);
const a1 = agregarSemana(base, '2026-11-04'); // misma semana -> NO duplica
check('agregar: la misma semana no se duplica', a1.creada, false);
check('agregar: no cambia la lista', a1.semanas.length, 1);

const a2 = agregarSemana(base, '2026-11-10'); // martes de la semana siguiente
check('agregar: semana nueva', a2.creada, true);
check('agregar: queda como orden 2', a2.semanas[1].orden, 2);
check('agregar: id = lunes', a2.semanas[1].id, '2026-11-09');

// Agregar una semana PASADA en el medio: renombra orden, NO los ids.
const a3 = agregarSemana(a2.semanas, '2026-10-28');
check('agregar en el medio: 3 semanas', a3.semanas.length, 3);
check('agregar en el medio: orden cronológico', a3.semanas.map((s) => s.inicio).join(','), '2026-10-26,2026-11-02,2026-11-09');
check('agregar en el medio: la del medio pasa a orden 2', a3.semanas[1].orden, 2);

// ---------- Quitar ----------
const q1 = quitarSemana(a3.semanas, '2026-11-02');
check('agregar: fecha vacia no crea nada', agregarSemana(base, '').creada, false);
check('agregar: fecha basura no crea nada', agregarSemana(base, 'hoy').semanas.length, 1);
check('quitar: quedan 2', q1.length, 2);
check('quitar: renumera', q1.map((s) => s.orden).join(','), '1,2');
check('quitar: id inexistente no rompe', quitarSemana(a3.semanas, '2026-01-01').length, 3);

// ---------- Etiquetas ----------
check('etiqueta rango mismo mes', etiquetaRango(base[0]), '02–08 nov');
check('etiqueta rango cruza de mes', etiquetaRango(normalizarSemanas([{ inicio: '2026-10-26' }])[0]), '26 oct – 01 nov');
check('etiqueta semana', etiquetaSemana(base[0]), 'Sem 1 · 02–08 nov');

// ---------- Volumen ----------
check('volumen 40x5x10', volumenDe(40, 5, 10), 2000);
check('volumen con 0 no inventa', volumenDe(0, 5, 10), 0);
check('volumen con negativo es 0', volumenDe(-5, 3, 3), 0);
check('volumen redondea', volumenDe(42.5, 5, 10), 2125);

// ---------- Volumen por semana -> Progreso ----------
const celdas = {
  '2026-11-02': { peso: 40, series: 5, reps: 10 }, // 2000
  '2026-11-09': { peso: 42.5, series: 5, reps: 10 }, // 2125
  '2026-10-26': { peso: 0, series: 5, reps: 10 }, // sin registrar (semana 1)
};
const vol = volumenesPorSemana(celdas, a3.semanas);
check('volumen por semana: 2 puntos (el 0 no cuenta)', Object.keys(vol).length, 2);
check('volumen por semana: clave = orden (la 1.ª semana del historial es orden 2)', vol['2'], 2000);
check('volumen por semana: segunda', vol['3'], 2125);
check('volumen por semana: sin celdas -> {}', Object.keys(volumenesPorSemana(undefined, a3.semanas)).length, 0);

// ---------- Meses (acordeón) ----------
const cinco = normalizarSemanas(
  ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'].map((inicio) => ({ inicio })),
);
const meses = mesesDeSemanas(cinco, 4);
check('meses: 2 grupos con 5 semanas', meses.length, 2);
check('meses: el primero trae 4', meses[0].semanas.length, 4);
check('meses: el segundo trae 1', meses[1].semanas.length, 1);
check('meses: sin semanas -> 1 grupo vacío', mesesDeSemanas([], 4).length, 1);

// ---------- Cableado (la UI tiene que usar la NUBE, no solo localStorage) ----------
import { readFileSync } from 'node:fs';
const ui = readFileSync(new URL('../src/components/WorkoutModule.tsx', import.meta.url), 'utf8');
const dieta = readFileSync(new URL('../src/components/DietModule.tsx', import.meta.url), 'utf8');
const sync = readFileSync(new URL('../src/services/workoutSync.ts', import.meta.url), 'utf8');
check('ui: lee los días de la base', /cargarDias as cargarDiasNube/.test(ui), true);
check('ui: lee las semanas de la base', /cargarSemanas as cargarSemanasNube/.test(ui), true);
check('ui: guarda los días en la base', /guardarDiasNube\(nuevos\)/.test(ui), true);
check('ui: tiene el botón de cerrar semana', /📌<\/span> Cerrar semana|Cerrar semana/.test(ui), true);
check('ui: guarda el peso de la celda en la base', /guardarCeldasNube\(/.test(ui), true);
check('ui: ya no usa la matriz vieja por volumen', /historyMatrix|workout_matrix_progress/.test(ui), false);
check('sync: las semanas viven en workout_weeks', /from\('workout_weeks'\)/.test(sync), true);
check('sync: las celdas viven en workout_week_sets', /from\('workout_week_sets'\)/.test(sync), true);
check('sync: los días viven en workout_days', /from\('workout_days'\)/.test(sync), true);
check('sync: distingue "falta correr el SQL"', /42P01/.test(sync), true);
check('dieta: BAJA el perfil de la base al abrir', /loadLatestBodyMetrics\(\)\s*\.then\(/.test(dieta), true);

// ---------- Resumen ----------
if (fallos.length) {
  console.log(`\n❌ ${fallos.length} FALLO(S) de ${ok + fallos.length}:`);
  fallos.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`\n✅ ${ok}/${ok} aserciones OK (semanas)`);
