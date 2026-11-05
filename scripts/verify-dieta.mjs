// Verificación de la DIETA PERSISTENTE: importa el núcleo REAL (.ts) y mide el
// cableado de la UI/servicio. Correr:  node scripts/verify-dieta.mjs
// Sale con código 1 si alguna aserción falla.
import {
  claveCache,
  mealsVacio,
  leerCacheDe,
  normalizarEntradas,
  filasDesdeEntradas,
  entradasDesdeFilas,
  contarEntradas,
  MEAL_TYPES,
} from '../src/logic/dieta.ts';
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
const DIETA_SRC = lector('../src/logic/dieta.ts');
const CLOUD_SRC = lector('../src/services/cloudSync.ts');
const COMP_SRC = lector('../src/components/DietModule.tsx');
const SQL_SRC = lector('../supabase/2026-11-04_dieta_persistente.sql');

// ---------------------------------------------------------------- núcleo puro
check('clave: un dia = una clave', claveCache('2026-11-04'), 'user_meals_v1_2026-11-04');
check('vacio: 0 entradas', contarEntradas(mealsVacio()), 0);
check('cache: sin texto -> null', leerCacheDe(null), null);
check('cache: JSON roto -> null', leerCacheDe('{roto'), null);
check('cache: objeto sin comidas -> null', leerCacheDe('{"otra":1}'), null);
check('cache: dias invalidos se descartan', leerCacheDe(JSON.stringify({ desayuno: [{ nombre: 'x' }] })), null);

const cacheOk = {
  desayuno: [
    { id: 'a', foodId: 1, nombre: 'Arroz blanco corriente', gramos: 200, kcal: 716, proteinas: 15.6, grasa: 1.4, carbohidratos: 155.2, fibra: 2.8 },
  ],
  almuerzo: [],
  cena: [],
};
const cacheLeida = leerCacheDe(JSON.stringify(cacheOk));
    check('cache: recupera el dia', cacheLeida ? contarEntradas(cacheLeida) : null, 1);
    check('cache: conserva gramos', cacheLeida?.desayuno[0]?.gramos ?? null, 200);

    // "Mi version" del plato: los ajustes tienen que sobrevivir al guardado, si no
    // el dia se ve bien pero al reabrir el plato vuelve a la receta original.
    const cachePlato = {
      desayuno: [],
      almuerzo: [
        {
          id: 'p',
          foodId: -1,
          nombre: 'Quinua saltada con pollo y verduras',
          gramos: 390,
          kcal: 405.8,
          proteinas: 34.4,
          grasa: 16.8,
          carbohidratos: 42.1,
          fibra: 3.6,
          platoId: 'quinua-saltada-con-pollo',
          ajustes: { 'Quinua cocida': 100 },
        },
      ],
      cena: [],
    };
    const platoLeido = leerCacheDe(JSON.stringify(cachePlato));
    check('cache: conserva el plato de origen', platoLeido?.almuerzo[0]?.platoId ?? null, 'quinua-saltada-con-pollo');
    check('cache: conserva mi version', platoLeido?.almuerzo[0]?.ajustes?.['Quinua cocida'] ?? null, 100);

check(
  'cache: descarta entradas sin nombre (no queda nada valido)',
  leerCacheDe(
    JSON.stringify({ desayuno: [{ id: 'a', nombre: '', gramos: 100, kcal: 1, proteinas: 0, grasa: 0, carbohidratos: 0, fibra: 0 }] }),
  ),
  null,
);

const FOODS = [
  { id: 10, nombre: 'Arroz blanco corriente', energiaKcal: 358, proteinas: 7.8, grasaTotal: 0.7, carbohidratosTotales: 77.6, fibra: 1.4 },
  { id: 20, nombre: 'Pollo, carne pulpa', energiaKcal: 119, proteinas: 21.4, grasaTotal: 3.1, carbohidratosTotales: 0, fibra: 0 },
];
const sinId = {
  desayuno: [
    { id: 'x', foodId: -1, nombre: 'Arroz blanco corriente', gramos: 200, kcal: 0, proteinas: 0, grasa: 0, carbohidratos: 0, fibra: 0 },
    { id: 'y', foodId: -1, nombre: 'Alimento que no esta en la tabla', gramos: 50, kcal: 99, proteinas: 1, grasa: 1, carbohidratos: 1, fibra: 0 },
  ],
  almuerzo: [],
  cena: [],
};
const norm = normalizarEntradas(sinId, FOODS);
check('normalizar: recupera foodId por nombre', norm.desayuno[0].foodId, 10);
check('normalizar: recalcula kcal (200 g)', norm.desayuno[0].kcal, 716);
check('normalizar: recalcula proteinas', norm.desayuno[0].proteinas, 15.6);
check('normalizar: no inventa foodId ajeno', norm.desayuno[1].foodId, -1);
check('normalizar: conserva el no catalogado', norm.desayuno[1].kcal, 99);
check('normalizar: no toca la entrada original', sinId.desayuno[0].foodId, -1);

const filas = filasDesdeEntradas('2026-11-04', 'desayuno', [
  { id: 'a', foodId: 10, nombre: 'Arroz blanco corriente', gramos: 200, kcal: 716, proteinas: 15.6, grasa: 1.4, carbohidratos: 155.2, fibra: 2.8 },
]);
check('filas: 1 fila', filas.length, 1);
check('filas: fecha', filas[0].fecha, '2026-11-04');
check('filas: tipo', filas[0].tipo_comida, 'desayuno');
check('filas: nombre', filas[0].alimento_nombre, 'Arroz blanco corriente');
check('filas: gramos', filas[0].gramos, 200);
check('filas: NO manda foodId (la columna no existe)', 'food_id' in filas[0], false);

const desdeNube = entradasDesdeFilas([
  { id: 'db-1', tipo_comida: 'almuerzo', alimento_nombre: 'Pollo, carne pulpa', gramos: 300, kcal: 357, proteinas: 64.2, grasa: 9.3, carbohidratos: 0, fibra: 0 },
  { id: 'db-2', tipo_comida: 'cena', alimento_nombre: '', gramos: 100, kcal: 10, proteinas: 0, grasa: 0, carbohidratos: 0, fibra: 0 },
  { id: 'db-3', tipo_comida: 'merienda', alimento_nombre: 'Basura', gramos: 100, kcal: 10, proteinas: 0, grasa: 0, carbohidratos: 0, fibra: 0 },
  { id: 'db-4', tipo_comida: 'desayuno', alimento_nombre: 'Arroz blanco corriente', gramos: 200, kcal: 716, proteinas: 15.6, grasa: 1.4, carbohidratos: 155.2, fibra: 2.8 },
]);
check('nube: agrupa por comida', [desdeNube.desayuno.length, desdeNube.almuerzo.length, desdeNube.cena.length], [1, 1, 0]);
check('nube: conserva el id de la base', desdeNube.almuerzo[0].id, 'db-1');
check('nube: descarta nombre vacio y tipo desconocido', contarEntradas(desdeNube), 2);
check('nube: entra sin foodId (se recupera al llegar el catalogo)', desdeNube.almuerzo[0].foodId, -1);
check('nube: conserva los macros guardados', desdeNube.almuerzo[0].proteinas, 64.2);

const ida = filasDesdeEntradas('2026-11-04', 'cena', [
  { id: 'z', foodId: 20, nombre: 'Pollo, carne pulpa', gramos: 300, kcal: 357, proteinas: 64.2, grasa: 9.3, carbohidratos: 0, fibra: 0 },
]);
const vuelta = entradasDesdeFilas([{ id: 'z', ...ida[0] }]);
check('ida y vuelta: gramos', vuelta.cena[0].gramos, 300);
check('ida y vuelta: kcal', vuelta.cena[0].kcal, 357);
check('MEAL_TYPES: las 3 comidas', MEAL_TYPES, ['desayuno', 'almuerzo', 'cena']);

// ---------------------------------------------------------------- cableado
check('cloud: exporta loadMealsForDate', /export async function loadMealsForDate/.test(CLOUD_SRC), true);
check('cloud: exporta saveMealDay', /export async function saveMealDay/.test(CLOUD_SRC), true);
check('cloud: LEE daily_meals con la fecha', /from\('daily_meals'\)[\s\S]{0,200}\.eq\('fecha'/.test(CLOUD_SRC), true);
check('cloud: ya NO usa el insert suelto', /export async function syncMealEntry/.test(CLOUD_SRC), false);
check('cloud: borra antes de insertar (reemplazo)', /\.delete\(\)[\s\S]{0,600}\.insert\(/.test(CLOUD_SRC), true);

check('ui: baja el dia al abrir', /loadMealsForDate\(fechaActiva\)/.test(COMP_SRC), true);
check('ui: escribe la cache local', /localStorage\.setItem\(claveCache\(fecha\)/.test(COMP_SRC), true);
check('ui: persiste al agregar', /persistir\(siguiente, mealType\);[\s\S]*?persistir\(siguiente, mealType\);/.test(COMP_SRC), true);
check('ui: persiste al cambiar gramos, al borrar y al agregar (plato o suelto)', (COMP_SRC.match(/persistir\(siguiente, mealType\);/g) || []).length, 5);
check('ui: el plato tambien persiste', /addPlatoToMeal[\s\S]{0,1400}?persistir\(siguiente, mealType\);/.test(COMP_SRC), true);
check('ui: el desglose suelto tambien persiste', /addPlatoSuelto[\s\S]{0,1400}?persistir\(siguiente, mealType\);/.test(COMP_SRC), true);
check('ui: normaliza cuando llega el catalogo', /normalizarEntradas\(prev, foods\)/.test(COMP_SRC), true);
check('ui: ya NO llama al insert suelto', /syncMealEntry\(/.test(COMP_SRC), false);

check('sql: habilita RLS con politica', /create policy daily_meals_all on daily_meals/.test(SQL_SRC), true);
check('sql: indice por fecha', /create index if not exists daily_meals_fecha_idx/.test(SQL_SRC), true);

// ---------------------------------------------------------------- resumen
if (fallos.length > 0) {
  console.error(`\n❌ ${fallos.length} FALLO(S) de ${ok + fallos.length}:`);
  for (const f of fallos) console.error('  - ' + f);
  process.exit(1);
}
console.log(`\n✅ ${ok}/${ok} aserciones OK`);
