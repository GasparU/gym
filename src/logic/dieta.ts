import type { FoodItem, MealEntry, MealType } from '../types/nutrition';

/**
 * Núcleo PURO del registro diario de comidas.
 *
 * Por qué existe: `DietModule` guardaba el día en un `useState` que nacía vacío y
 * `cloudSync` solo INSERTABA en `daily_meals` sin que nadie leyera la tabla. Un
 * refresh borraba todo. Acá vive el mapeo (fila de base <-> entrada de UI) y la
 * normalización, para poder probarlo sin navegador ni Supabase.
 */

export type Meals = Record<MealType, MealEntry[]>;

export const MEAL_TYPES: MealType[] = ['desayuno', 'almuerzo', 'cena'];

export const CLAVE_CACHE_DIETA = 'user_meals_v1';

/** Clave de localStorage por día: el registro es diario, no una lista única. */
export function claveCache(fecha: string): string {
  return `${CLAVE_CACHE_DIETA}_${fecha}`;
}

export function mealsVacio(): Meals {
  return { desayuno: [], almuerzo: [], cena: [] };
}

export function esMealType(valor: unknown): valor is MealType {
  return valor === 'desayuno' || valor === 'almuerzo' || valor === 'cena';
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function redondear1(valor: number): number {
  return Number.isFinite(valor) ? Math.round(valor * 10) / 10 : 0;
}

function esEntradaValida(valor: unknown): valor is MealEntry {
  if (!valor || typeof valor !== 'object') return false;
  const e = valor as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.nombre === 'string' &&
    e.nombre.length > 0 &&
    Number.isFinite(Number(e.gramos))
  );
}

/**
 * "Mi version" del plato: gramos por ingrediente. Se valida uno por uno.
 * Un valor roto NO tumba la entrada: se descarta ese ajuste (vuelve la receta).
 */
function ajustesValidos(valor: unknown): Record<string, number> | undefined {
  if (!valor || typeof valor !== 'object') return undefined;
  const salida: Record<string, number> = {};
  for (const [nombre, gramos] of Object.entries(valor as Record<string, unknown>)) {
    const n = Number(gramos);
    if (nombre.length > 0 && Number.isFinite(n) && n >= 0) salida[nombre] = n;
  }
  return Object.keys(salida).length > 0 ? salida : undefined;
}

/**
 * Lee el texto del localStorage SIN confiar en su forma.
 * Devuelve `null` si no hay nada o si el JSON está roto (se descarta, no se inventa).
 */
export function leerCacheDe(raw: string | null): Meals | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const salida = mealsVacio();
    let algo = false;
    for (const tipo of MEAL_TYPES) {
      const lista = obj[tipo];
      if (!Array.isArray(lista)) continue;
          salida[tipo] = lista.filter(esEntradaValida).map((e) => {
            const platoId = typeof e.platoId === 'string' && e.platoId.length > 0 ? e.platoId : undefined;
            const ajustes = ajustesValidos(e.ajustes);
            return {
              id: e.id,
              foodId: Number.isFinite(Number(e.foodId)) ? Number(e.foodId) : -1,
              nombre: e.nombre,
              gramos: numero(e.gramos),
              kcal: numero(e.kcal),
              proteinas: numero(e.proteinas),
              grasa: numero(e.grasa),
              carbohidratos: numero(e.carbohidratos),
              fibra: numero(e.fibra),
              // Sin estas dos, al reabrir el dia el plato volvia a la receta original.
              ...(platoId ? { platoId } : {}),
              ...(ajustes ? { ajustes } : {}),
            };
          });
      if (salida[tipo].length > 0) algo = true;
    }
    return algo ? salida : null;
  } catch {
    return null;
  }
}

/**
 * Recupera el `foodId` por NOMBRE y recalcula los macros con el catálogo real.
 * Las filas de la nube no guardan `foodId`, así que sin esto el badge CRUDO/COCIDO
 * y el recálculo al cambiar gramos se perdían al refrescar.
 */
export function normalizarEntradas(meals: Meals, foods: FoodItem[]): Meals {
  if (foods.length === 0) return meals;
  const porNombre = new Map<string, FoodItem>();
  for (const f of foods) porNombre.set(f.nombre, f);

  const salida = mealsVacio();
  for (const tipo of MEAL_TYPES) {
    salida[tipo] = meals[tipo].map((entrada) => {
      const food = porNombre.get(entrada.nombre);
      if (!food) return entrada;
      const factor = Math.max(0, entrada.gramos) / 100;
      return {
        ...entrada,
        foodId: food.id,
        kcal: redondear1(food.energiaKcal * factor),
        proteinas: redondear1(food.proteinas * factor),
        grasa: redondear1(food.grasaTotal * factor),
        carbohidratos: redondear1(food.carbohidratosTotales * factor),
        fibra: redondear1(food.fibra * factor),
      };
    });
  }
  return salida;
}

/** Filas para `daily_meals` (las columnas que existen en la tabla). */
export function filasDesdeEntradas(
  fecha: string,
  mealType: MealType,
  entradas: MealEntry[],
): Array<Record<string, unknown>> {
  return entradas.map((e) => ({
    fecha,
    tipo_comida: mealType,
    alimento_nombre: e.nombre,
    gramos: e.gramos,
    kcal: e.kcal,
    proteinas: e.proteinas,
    grasa: e.grasa,
    carbohidratos: e.carbohidratos,
    fibra: e.fibra,
  }));
}

/**
 * Filas de `daily_meals` -> entradas de UI.
 * Descarta basura (nombre vacío, tipo desconocido) en vez de fabricar comidas.
 */
export function entradasDesdeFilas(filas: unknown[]): Meals {
  const salida = mealsVacio();
  for (const cruda of filas) {
    if (!cruda || typeof cruda !== 'object') continue;
    const fila = cruda as Record<string, unknown>;
    const tipo = fila.tipo_comida;
    if (!esMealType(tipo)) continue;
    const nombre = typeof fila.alimento_nombre === 'string' ? fila.alimento_nombre : '';
    if (nombre.length === 0) continue;
    salida[tipo].push({
      id: typeof fila.id === 'string' ? fila.id : crypto.randomUUID(),
      foodId: -1,
      nombre,
      gramos: numero(fila.gramos),
      kcal: numero(fila.kcal),
      proteinas: numero(fila.proteinas),
      grasa: numero(fila.grasa),
      carbohidratos: numero(fila.carbohidratos),
      fibra: numero(fila.fibra),
    });
  }
  return salida;
}

/** Cuenta total de entradas: sirve para decidir si la caché tiene algo útil. */
export function contarEntradas(meals: Meals): number {
  return MEAL_TYPES.reduce((acc, tipo) => acc + meals[tipo].length, 0);
}
