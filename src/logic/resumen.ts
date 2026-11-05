import type { MealType } from '../types/nutrition';
import type { Meals } from './dieta';

/**
 * Núcleo PURO del resumen diario y del progreso semanal.
 *
 * Por qué existe: `daily_meals` guarda el DETALLE (una fila por alimento) y la app
 * solo sabía leer HOY. Para poder mostrar el historial sin traer cientos de filas,
 * el día se resume en UNA fila de `daily_summary` (totales + metas + déficit).
 * El desglose por comida NO se duplica: se deriva del detalle cuando hace falta.
 *
 * Sin imports de runtime a propósito: se prueba con `node scripts/verify-resumen.mjs`.
 */

/** 1 kg de grasa corporal ≈ 7.700 kcal. Es una referencia teórica, no una promesa. */
export const KCAL_POR_KG_GRASA = 7700;

/** Días de la ventana de progreso. */
export const DIAS_VENTANA = 7;

const TIPOS: MealType[] = ['desayuno', 'almuerzo', 'cena'];

export interface ObjetivosDelDia {
  metaKcal: number;
  tdeeKcal: number;
}

/** Totales de una comida. Se deriva del detalle, no se guarda. */
export interface ComidaResumen {
  tipo: MealType;
  kcal: number;
  proteinas: number;
  entradas: number;
}

/**
 * Una fila de `daily_summary`: el día entero en números.
 *
 * `deficitReal` es `null` cuando no hay nada cargado o no hay TDEE: un día sin
 * datos NO es un día con déficit 0 (sería un dato inventado).
 */
export interface DaySummary {
  fecha: string;
  kcal: number;
  proteina: number;
  grasa: number;
  carbohidratos: number;
  fibra: number;
  metaKcal: number;
  tdeeKcal: number;
  deficitPlanificado: number | null;
  deficitReal: number | null;
  comidas: number;
  entradas: number;
}

export interface ResumenSemanal {
  desde: string;
  hasta: string;
  diasVentana: number;
  diasConDatos: number;
  promedioDeficit: number | null;
  totalDeficit: number;
  kcalPromedio: number | null;
  kgTeoricos: number | null;
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function redondear(valor: number, decimales = 0): number {
  if (!Number.isFinite(valor)) return 0;
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/** Suma las entradas de las 3 comidas. */
export function totalDelDia(meals: Meals): {
  kcal: number;
  proteina: number;
  grasa: number;
  carbohidratos: number;
  fibra: number;
  entradas: number;
  comidas: number;
} {
  let kcal = 0;
  let proteina = 0;
  let grasa = 0;
  let carbohidratos = 0;
  let fibra = 0;
  let entradas = 0;
  let comidas = 0;

  for (const tipo of TIPOS) {
    const lista = meals?.[tipo] ?? [];
    if (lista.length > 0) comidas++;
    for (const e of lista) {
      kcal += numero(e.kcal);
      proteina += numero(e.proteinas);
      grasa += numero(e.grasa);
      carbohidratos += numero(e.carbohidratos);
      fibra += numero(e.fibra);
      entradas++;
    }
  }

  return {
    kcal: Math.round(kcal),
    proteina: redondear(proteina, 1),
    grasa: redondear(grasa, 1),
    carbohidratos: redondear(carbohidratos, 1),
    fibra: redondear(fibra, 1),
    entradas,
    comidas,
  };
}

/** Desglose por comida (para mostrar "almuerzo: 812 kcal"), derivado del detalle. */
export function resumenPorComida(meals: Meals): ComidaResumen[] {
  return TIPOS.map((tipo) => {
    const lista = meals?.[tipo] ?? [];
    return {
      tipo,
      kcal: Math.round(lista.reduce((acc, e) => acc + numero(e.kcal), 0)),
      proteinas: redondear(
        lista.reduce((acc, e) => acc + numero(e.proteinas), 0),
        1,
      ),
      entradas: lista.length,
    };
  });
}

/**
 * Déficit REAL del día = TDEE − lo que comiste.
 *
 * Devolvera `null` (nunca 0) si no hay nada cargado o si no hay TDEE válido:
 * un cero sobre una base vacía es la ausencia de dato, no un dato.
 */
export function deficitRealKcal(
  tdeeKcal: number,
  consumidoKcal: number,
  entradas: number,
): number | null {
  if (!(entradas > 0)) return null;
  if (!Number.isFinite(tdeeKcal) || tdeeKcal <= 0) return null;
  return Math.round(tdeeKcal - consumidoKcal);
}

/** Arma la fila del día a partir del detalle y de las metas vigentes. */
export function resumenDelDia(
  fecha: string,
  meals: Meals,
  objetivos: ObjetivosDelDia,
): DaySummary {
  const total = totalDelDia(meals);
  const tdee = numero(objetivos.tdeeKcal);
  const meta = numero(objetivos.metaKcal);
  return {
    fecha,
    kcal: total.kcal,
    proteina: total.proteina,
    grasa: total.grasa,
    carbohidratos: total.carbohidratos,
    fibra: total.fibra,
    metaKcal: Math.round(meta),
    tdeeKcal: Math.round(tdee),
    deficitPlanificado: tdee > 0 && meta > 0 ? Math.round(tdee - meta) : null,
    deficitReal: deficitRealKcal(tdee, total.kcal, total.entradas),
    comidas: total.comidas,
    entradas: total.entradas,
  };
}

/** Fila para Supabase (nombres reales de las columnas). */
export function filaDesdeResumen(r: DaySummary): Record<string, unknown> {
  return {
    fecha: r.fecha,
    kcal_consumidas: r.kcal,
    proteina_g: r.proteina,
    grasa_g: r.grasa,
    carbohidratos_g: r.carbohidratos,
    fibra_g: r.fibra,
    meta_kcal: r.metaKcal,
    tdee_kcal: r.tdeeKcal,
    deficit_planificado: r.deficitPlanificado,
    deficit_real: r.deficitReal,
    comidas: r.comidas,
    entradas: r.entradas,
  };
}

function fechaValida(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpia = valor.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(limpia) ? limpia : null;
}

/** Fila de Supabase -> resumen. Tolera `numeric` como string y descarta basura. */
export function resumenDesdeFila(fila: unknown): DaySummary | null {
  if (!fila || typeof fila !== 'object') return null;
  const f = fila as Record<string, unknown>;
  const fecha = fechaValida(f.fecha);
  if (!fecha) return null;
  const deficit = (valor: unknown): number | null =>
    valor === null || valor === undefined || valor === '' ? null : numero(valor);
  return {
    fecha,
    kcal: Math.round(numero(f.kcal_consumidas)),
    proteina: redondear(numero(f.proteina_g), 1),
    grasa: redondear(numero(f.grasa_g), 1),
    carbohidratos: redondear(numero(f.carbohidratos_g), 1),
    fibra: redondear(numero(f.fibra_g), 1),
    metaKcal: Math.round(numero(f.meta_kcal)),
    tdeeKcal: Math.round(numero(f.tdee_kcal)),
    deficitPlanificado: deficit(f.deficit_planificado),
    deficitReal: deficit(f.deficit_real),
    comidas: Math.round(numero(f.comidas)),
    entradas: Math.round(numero(f.entradas)),
  };
}

/** Suma días a una fecha `AAAA-MM-DD` (en UTC para no depender del huso). */
export function fechaMas(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  if (!y || !m || !d) return fecha;
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Etiqueta corta para la UI: "Hoy", "Ayer" o "04/11". */
export function etiquetaFecha(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === fechaMas(hoy, -1)) return 'Ayer';
  const [y, m, d] = fecha.split('-');
  if (!y || !m || !d) return fecha;
  return y === hoy.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
}

/**
 * Último día CON DATOS estrictamente anterior a `fecha`.
 * Sirve para el aviso "hoy está vacío, lo último que cargaste fue…".
 */
export function ultimoConDatos(
  resumenes: DaySummary[],
  fecha: string,
): DaySummary | null {
  let ultimo: DaySummary | null = null;
  for (const r of resumenes) {
    if (r.entradas <= 0) continue;
    if (r.fecha >= fecha) continue;
    if (!ultimo || r.fecha > ultimo.fecha) ultimo = r;
  }
  return ultimo;
}

/**
 * Ventana de `dias` que termina en `hasta`.
 *
 * Los días SIN cargar no entran: promediar ceros convertiría una semana a medias
 * en "déficit promedio 0", que es falso. `diasConDatos` lo declara.
 */
export function promedioSemanal(
  resumenes: DaySummary[],
  hasta: string,
  dias: number = DIAS_VENTANA,
): ResumenSemanal {
  const desde = fechaMas(hasta, -(dias - 1));
  const porFecha = new Map<string, DaySummary>();
  for (const r of resumenes) porFecha.set(r.fecha, r);

  let diasConDatos = 0;
  let totalDeficit = 0;
  let totalKcal = 0;
  let conDeficit = 0;

  for (let i = 0; i < dias; i++) {
    const fecha = fechaMas(desde, i);
    const r = porFecha.get(fecha);
    if (!r || r.entradas <= 0) continue;
    diasConDatos++;
    totalKcal += r.kcal;
    if (r.deficitReal !== null) {
      totalDeficit += r.deficitReal;
      conDeficit++;
    }
  }

  return {
    desde,
    hasta,
    diasVentana: dias,
    diasConDatos,
    promedioDeficit: conDeficit > 0 ? Math.round(totalDeficit / conDeficit) : null,
    totalDeficit,
    kcalPromedio: diasConDatos > 0 ? Math.round(totalKcal / diasConDatos) : null,
    kgTeoricos:
      conDeficit > 0 ? redondear(totalDeficit / KCAL_POR_KG_GRASA, 2) : null,
  };
}

/** Inserta o reemplaza el resumen de un día y devuelve la lista ordenada. */
export function conResumen(lista: DaySummary[], r: DaySummary): DaySummary[] {
  const salida = lista.filter((x) => x.fecha !== r.fecha);
  salida.push(r);
  salida.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  return salida;
}

/** Saca el resumen de un día (cuando el usuario borró todo lo cargado). */
export function sinResumen(lista: DaySummary[], fecha: string): DaySummary[] {
  return lista.filter((x) => x.fecha !== fecha);
}
