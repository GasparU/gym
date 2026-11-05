// Verificación del RESUMEN DIARIO y del PROGRESO SEMANAL (05/11/2026).
// Importa el núcleo REAL (.ts) y mide el cableado de la UI/servicio/SQL.
// Correr:  node scripts/verify-resumen.mjs
// Sale con código 1 si alguna aserción falla.
import {
  KCAL_POR_KG_GRASA,
  DIAS_VENTANA,
  totalDelDia,
  resumenPorComida,
  deficitRealKcal,
  resumenDelDia,
  filaDesdeResumen,
  resumenDesdeFila,
  fechaMas,
  etiquetaFecha,
  ultimoConDatos,
  promedioSemanal,
  conResumen,
  sinResumen,
  resumenesDesdeDetalle,
  completarResumenes,
} from '../src/logic/resumen.ts';
import { readFileSync } from 'node:fs';

let ok = 0;
const fallos = [];

function check(nombre, obtenido, esperado) {
  const a = JSON.stringify(obtenido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
  } else {
    fallos.push(`${nombre}: obtuve ${a}, esperaba ${b}`);
  }
}

const lector = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const CLOUD_SRC = lector('../src/services/cloudSync.ts');
const COMP_SRC = lector('../src/components/DietModule.tsx');
const SQL_SRC = lector('../supabase/2026-11-05_resumen_diario.sql');
const METAB_SRC = lector('../src/logic/metabolism.ts');

// ---------------------------------------------------------------- núcleo puro
check('1 kg de grasa = 7.700 kcal', KCAL_POR_KG_GRASA, 7700);
check('ventana de 7 días', DIAS_VENTANA, 7);

const MEALS = {
  desayuno: [{ kcal: 181.3, proteinas: 15.6, grasa: 12.4, carbohidratos: 1.1, fibra: 0 }],
  almuerzo: [{ kcal: 357, proteinas: 64.2, grasa: 9.3, carbohidratos: 0, fibra: 0 }],
  cena: [],
};
const VACIO = { desayuno: [], almuerzo: [], cena: [] };

const total = totalDelDia(MEALS);
check('total: kcal', total.kcal, 538);
check('total: proteína (1 decimal)', total.proteina, 79.8);
check('total: entradas', total.entradas, 2);
check('total: comidas con datos', total.comidas, 2);
check('total: día vacío', totalDelDia(VACIO).entradas, 0);

check('por comida: desayuno', resumenPorComida(MEALS)[0], {
  tipo: 'desayuno',
  kcal: 181,
  proteinas: 15.6,
  entradas: 1,
});
check('por comida: cena vacía', resumenPorComida(MEALS)[2], {
  tipo: 'cena',
  kcal: 0,
  proteinas: 0,
  entradas: 0,
});

check('déficit real: 2496 - 538', deficitRealKcal(2496, 538, 2), 1958);
check('déficit real: sin comidas -> null (no 0)', deficitRealKcal(2496, 0, 0), null);
check('déficit real: TDEE 0 -> null', deficitRealKcal(0, 538, 1), null);

const R = resumenDelDia('2026-11-04', MEALS, { metaKcal: 2122, tdeeKcal: 2496 });
check('resumen: fecha', R.fecha, '2026-11-04');
check('resumen: kcal', R.kcal, 538);
check('resumen: déficit planificado', R.deficitPlanificado, 374);
check('resumen: déficit real', R.deficitReal, 1958);
check('resumen: comidas', R.comidas, 2);

const R_VACIO = resumenDelDia('2026-11-05', VACIO, { metaKcal: 2122, tdeeKcal: 2496 });
check('resumen vacío: no inventa déficit 0', R_VACIO.deficitReal, null);
check('resumen vacío: entradas 0', R_VACIO.entradas, 0);

const fila = filaDesdeResumen(R);
check('fila: columna de kcal', fila.kcal_consumidas, 538);
check('fila: columna de déficit real', fila.deficit_real, 1958);
check('fila: columnas de metas', [fila.meta_kcal, fila.tdee_kcal], [2122, 2496]);
check('fila: no manda actualizado_en (lo pone la nube)', 'actualizado_en' in fila, false);

const vuelta = resumenDesdeFila(fila);
check('fila -> resumen: mismo día', vuelta?.fecha, '2026-11-04');
check('fila -> resumen: mismo déficit', vuelta?.deficitReal, 1958);

const desdeTexto = resumenDesdeFila({
  fecha: '2026-11-04T00:00:00',
  kcal_consumidas: '538.0',
  proteina_g: '79.8',
  grasa_g: '21.7',
  carbohidratos_g: '1.1',
  fibra_g: '0',
  meta_kcal: '2122',
  tdee_kcal: '2496',
  deficit_planificado: '374',
  deficit_real: '1958',
  comidas: '2',
  entradas: '2',
});
check('fila con numeric como string: kcal', desdeTexto?.kcal, 538);
check('fila con fecha ISO: se queda con el día', desdeTexto?.fecha, '2026-11-04');
check('fila con déficit null: queda null', resumenDesdeFila({ ...fila, deficit_real: null })?.deficitReal, null);
check('fila basura: fecha inválida -> null', resumenDesdeFila({ fecha: 'x', kcal_consumidas: 10 }), null);
check('fila basura: null -> null', resumenDesdeFila(null), null);

check('fecha + 1 (fin de mes)', fechaMas('2026-11-30', 1), '2026-12-01');
check('fecha - 1 (fin de año)', fechaMas('2026-01-01', -1), '2025-12-31');
check('fecha - 6', fechaMas('2026-11-05', -6), '2026-10-30');

check('etiqueta: hoy', etiquetaFecha('2026-11-05', '2026-11-05'), 'Hoy');
check('etiqueta: ayer', etiquetaFecha('2026-11-04', '2026-11-05'), 'Ayer');
check('etiqueta: otro día', etiquetaFecha('2026-10-30', '2026-11-05'), '30/10');

const dia = (fecha, kcal, deficitReal, entradas = 1) => ({
  fecha,
  kcal,
  proteina: 100,
  grasa: 40,
  carbohidratos: 200,
  fibra: 10,
  metaKcal: 2122,
  tdeeKcal: 2496,
  deficitPlanificado: 374,
  deficitReal,
  comidas: entradas > 0 ? 2 : 0,
  entradas,
});

const HISTORIAL = [
  dia('2026-10-29', 2000, 400), // fuera de la ventana
  dia('2026-11-01', 1300, 1196),
  dia('2026-11-02', 0, null, 0), // día vacío: NO cuenta
  dia('2026-11-03', 1500, 996),
  dia('2026-11-04', 1400, 1096),
  dia('2026-11-05', 0, null, 0), // hoy todavía vacío: NO cuenta
];

check('último con datos: salta el día vacío', ultimoConDatos(HISTORIAL, '2026-11-05')?.fecha, '2026-11-04');
check('último con datos: nunca devuelve hoy', ultimoConDatos([dia('2026-11-05', 900, 1500)], '2026-11-05'), null);
check('último con datos: sin historial -> null', ultimoConDatos([], '2026-11-05'), null);

const SEMANA = promedioSemanal(HISTORIAL, '2026-11-05', 7);
check('semana: desde', SEMANA.desde, '2026-10-30');
check('semana: hasta', SEMANA.hasta, '2026-11-05');
check('semana: días con datos (no cuenta vacíos ni fuera)', SEMANA.diasConDatos, 3);
check('semana: total de déficit', SEMANA.totalDeficit, 3288);
check('semana: promedio', SEMANA.promedioDeficit, 1096);
check('semana: kcal promedio', SEMANA.kcalPromedio, 1400);
check('semana: kg teóricos', SEMANA.kgTeoricos, 0.43);
check('semana vacía: promedio null (no 0)', promedioSemanal([], '2026-11-05', 7).promedioDeficit, null);
check('semana vacía: kg null (no 0)', promedioSemanal([], '2026-11-05', 7).kgTeoricos, null);

const LISTA = [dia('2026-11-03', 1500, 996), dia('2026-11-04', 1400, 1096)];
check('conResumen: reemplaza el mismo día', conResumen(LISTA, dia('2026-11-04', 1200, 1296)).length, 2);
check('conResumen: el día reemplazado manda', conResumen(LISTA, dia('2026-11-04', 1200, 1296))[1].kcal, 1200);
check('conResumen: ordena por fecha', conResumen([dia('2026-11-04', 1, 1)], dia('2026-11-02', 2, 2))[0].fecha, '2026-11-02');
check('sinResumen: saca el día', sinResumen(LISTA, '2026-11-04').length, 1);

// ------------------------------------------------- detalle -> resumen (bug 05/11)
// El cuadro semanal salia vacio con dias que SI tenian comidas: el resumen solo
// se escribia al editar, asi que lo cargado antes no existia en `daily_summary`.
const DETALLE = [
  { fecha: '2026-11-04', tipoComida: 'desayuno', kcal: 300, proteinas: 20, grasa: 10, carbohidratos: 30, fibra: 5 },
  { fecha: '2026-11-04', tipoComida: 'almuerzo', kcal: 500, proteinas: 40, grasa: 20, carbohidratos: 40, fibra: 8 },
  { fecha: '2026-11-04', tipoComida: 'almuerzo', kcal: 285, proteinas: 33.8, grasa: 5, carbohidratos: 0, fibra: 0 },
  { fecha: '2026-11-03', tipoComida: 'cena', kcal: 400, proteinas: 30, grasa: 15, carbohidratos: 20, fibra: 4 },
  { fecha: '2026-11-04T00:00:00', tipoComida: 'cena', kcal: 100, proteinas: 5, grasa: 2, carbohidratos: 10, fibra: 1 },
  { fecha: 'basura', tipoComida: 'cena', kcal: 999, proteinas: 0, grasa: 0, carbohidratos: 0, fibra: 0 },
];
const METAS = { metaKcal: 2122, tdeeKcal: 2496 };
const DER = resumenesDesdeDetalle(DETALLE, METAS);
check('detalle: dos dias (ignora la fecha basura y la ISO)', DER.length, 2);
check('detalle: ordenado', DER[0].fecha, '2026-11-03');
check('detalle: kcal del dia', DER[1].kcal, 1185);
check('detalle: proteina', DER[1].proteina, 98.8);
check('detalle: comidas DISTINTAS (no entradas)', DER[1].comidas, 3);
check('detalle: entradas', DER[1].entradas, 4);
check('detalle: deficit real', DER[1].deficitReal, 1311);
check('detalle: sin filas -> []', resumenesDesdeDetalle([], METAS), []);

const UNION = completarResumenes([dia('2026-11-04', 999, 1497)], DER);
check('union: dos dias', UNION.length, 2);
check('union: el resumen guardado manda', UNION[1].kcal, 999);
check('union: el detalle completa el dia que falta', UNION[0].fecha, '2026-11-03');
check('union: sin base queda lo derivado', completarResumenes([], DER).length, 2);
check('union: sin derivados queda la base', completarResumenes([dia('2026-11-04', 1, 1)], []).length, 1);
check('union: ordena por fecha', completarResumenes([dia('2026-11-05', 1, 1)], [dia('2026-11-01', 2, 2)])[0].fecha, '2026-11-01');

// ---------------------------------------------------------------- cableado
check('cloud: guarda el resumen', /export async function saveDailySummary/.test(CLOUD_SRC), true);
check('cloud: borra el resumen de un día vacío', /export async function deleteDailySummary/.test(CLOUD_SRC), true);
check('cloud: lee los últimos días', /export async function loadSummaries/.test(CLOUD_SRC), true);
check('cloud: lee el último día con datos', /export async function loadLatestSummary/.test(CLOUD_SRC), true);
check('cloud: escribe en daily_summary', /\.from\('daily_summary'\)\.upsert\(/.test(CLOUD_SRC), true);
check('cloud: upsert por fecha', /onConflict: 'fecha'/.test(CLOUD_SRC), true);
check('cloud: el último día excluye los vacíos', /\.gt\('entradas', 0\)/.test(CLOUD_SRC), true);
check('cloud: la ventana es por rango de fechas', /\.gte\('fecha', desde\)[\s\S]{0,200}\.lte\('fecha', hasta\)/.test(CLOUD_SRC), true);
check('cloud: lee el DETALLE por rango', /export async function loadMealsRange/.test(CLOUD_SRC), true);
check('cloud: el detalle sale de daily_meals', /\.from\('daily_meals'\)[\s\S]{0,120}select\('fecha,tipo_comida/.test(CLOUD_SRC), true);
check('cloud: el detalle filtra por fecha', /\.gte\('fecha', desde\)/.test(CLOUD_SRC), true);

check('ui: hay fecha activa', /fechaActiva/.test(COMP_SRC), true);
check('ui: hay reloj de día real', /setInterval\(revisar, 30_000\)/.test(COMP_SRC), true);
check('ui: cambiar de día es una función', /const cambiarDia =/.test(COMP_SRC), true);
check('ui: cambiar de día mueve la fecha activa', /setFechaActiva\(destino\)/.test(COMP_SRC), true);
check('ui: al cambiar de día se cierra el día que se deja', /void guardarResumenDe\(meals, fechaActiva\)/.test(COMP_SRC), true);
check('ui: el cambio de fecha real salta al día nuevo', /setFechaActiva\(hoyReal\)/.test(COMP_SRC), true);
check('ui: el día pasado arranca en solo lectura', /const soloLectura = !esHoy && !editandoPasado/.test(COMP_SRC), true);
check('ui: 4 acciones bloqueadas en solo lectura', (COMP_SRC.match(/if \(soloLectura\) return;/g) || []).length, 4);
check('ui: el input de gramos se deshabilita', /value={item\.gramos}[\s\S]{0,120}disabled={soloLectura}/.test(COMP_SRC), true);
check('ui: arma el resumen del día', /resumenDelDia\(fecha, m, \{/.test(COMP_SRC), true);
check('ui: guarda el resumen', /saveDailySummary\(r\)/.test(COMP_SRC), true);
check('ui: borra el resumen si el día quedó vacío', /deleteDailySummary\(fecha\)/.test(COMP_SRC), true);
check('ui: carga el historial', /loadSummaries\(14, hoyReal\)/.test(COMP_SRC), true);
check('ui: busca el último día con datos', /loadLatestSummary\(hoyReal\)/.test(COMP_SRC), true);
check('ui: avisa cuando hoy está vacío', /Hoy todavía no cargaste nada/.test(COMP_SRC), true);
check('ui: ya NO lee solo la fecha de hoy', /claveCache\(fechaHoy\)/.test(COMP_SRC), false);
check('ui: ya NO carga solo la fecha de hoy', /loadMealsForDate\(fechaHoy\)/.test(COMP_SRC), false);
check('ui: el mínimo de peso va con coma decimal', /numEsMax\(targets\.proteinaBaseG, 1\)/.test(COMP_SRC), true);

check('ui: el historial pide tambien el detalle', /loadMealsRange\(desde, hoyReal\)/.test(COMP_SRC), true);
check('ui: el detalle se convierte en resumenes', /resumenesDesdeDetalle\(filas,/.test(COMP_SRC), true);
check('ui: el panel UNE resumen guardado + detalle', /completarResumenes\(resumenes, detalleSemana\)/.test(COMP_SRC), true);
check('ui: la semana usa la union', /promedioSemanal\(resumenesEfectivos/.test(COMP_SRC), true);
check('ui: la semana ya no usa solo el resumen guardado', /promedioSemanal\(resumenes,/.test(COMP_SRC), false);
check('ui: la tabla usa la union', /resumenesEfectivos\.find\(/.test(COMP_SRC), true);
check('ui: el aviso cae al detalle si no hay resumen', /ultimoConDatos\(resumenesEfectivos, hoyReal\) \?\? ultimoDia/.test(COMP_SRC), true);
check('ui: el aviso abre el dia con datos', /cambiarDia\(ultimoDiaEfectivo\.fecha\)/.test(COMP_SRC), true);
check('ui: guardar el resumen actualiza las dos listas', /setDetalleSemana\(\(prev\) => conResumen\(prev, r\)\)/.test(COMP_SRC), true);
check('ui: borrar el resumen limpia las dos listas', /setDetalleSemana\(\(prev\) => sinResumen\(prev, fecha\)\)/.test(COMP_SRC), true);

check('sql: crea la tabla', /create table if not exists daily_summary/.test(SQL_SRC), true);
check('sql: una fila por fecha', /fecha\s+date primary key/.test(SQL_SRC), true);
check('sql: RLS activo', /alter table daily_summary enable row level security/.test(SQL_SRC), true);
check('sql: política de acceso', /^create policy daily_summary_all on daily_summary/m.test(SQL_SRC), true);
check('sql: índice por fecha', /create index if not exists daily_summary_fecha_idx/.test(SQL_SRC), true);

check('metabolismo: peso ideal con formato es-PE', /formatoEs\(pesoIdeal, 1\)/.test(METAB_SRC), true);
check('metabolismo: masa magra con formato es-PE', /formatoEs\(masaLibreGrasa, 1\)/.test(METAB_SRC), true);
check('metabolismo: peso ajustado con formato es-PE', /formatoEs\(pesoAjustado, 1\)/.test(METAB_SRC), true);
check('metabolismo: ya no imprime 73.5 crudo', /\$\{pesoIdeal\} kg/.test(METAB_SRC), false);
check('metabolismo: ya no imprime 66.92 crudo', /\$\{masaLibreGrasa\} kg/.test(METAB_SRC), false);
check('metabolismo: ya no imprime 79.88 crudo', /\$\{pesoAjustado\} kg/.test(METAB_SRC), false);

// ---------------------------------------------------------------- resumen
if (fallos.length > 0) {
  console.error(`\n❌ ${fallos.length} FALLO(S) de ${ok + fallos.length}:`);
  for (const f of fallos) console.error('  - ' + f);
  process.exit(1);
}
console.log(`\n✅ ${ok}/${ok} aserciones OK`);
