import type { FoodItem } from '../types/nutrition';

/** Modelo de un plato: receta declarada con gramos POR PORCION. */
export interface IngredientePlato {
  nombre: string;
  gramos: number;
}

export interface ExtraPlato {
  id: string;
  etiqueta: string;
  ingredientes: IngredientePlato[];
}

export interface AlternativaPlato {
  id: string;
  etiqueta: string;
  ingredientes: IngredientePlato[];
}

export interface OpcionPlato {
  id: string;
  etiqueta: string;
  porDefecto: string;
  alternativas: AlternativaPlato[];
}

export interface ObservacionPlato {
  ingrediente: string;
  detalle: string;
  aproxKcal: number;
}

export interface Plato {
  id: string;
  nombre: string;
  grupo: string;
  nota?: string;
  ingredientes: IngredientePlato[];
  extras?: ExtraPlato[];
  opciones?: OpcionPlato[];
  observaciones?: ObservacionPlato[];
}

export interface PlatoData {
  version: number;
  actualizado: string;
  nota?: string;
  platos: Plato[];
}

export interface SeleccionPlato {
  extras?: string[];
  opciones?: Record<string, string>;
}

export interface LineaPlato {
  nombre: string;
  gramos: number;
  kcal: number;
  proteinas: number;
  grasa: number;
  carbohidratos: number;
  fibra: number;
}

export interface TotalesPlato {
  kcal: number;
  proteinas: number;
  grasa: number;
  carbohidratos: number;
  fibra: number;
}

export interface PlatoCalculado {
  lineas: LineaPlato[];
  totales: TotalesPlato;
  gramos: number;
  /** Nombres que no existen en foods.json (nunca deberian aparecer: el gate lo impide). */
  faltantes: string[];
}

export const GRUPOS_PLATO = [
  'Arroces y fideos',
  'Guisos y segundos',
  'Menestras',
  'Pollos y carnes',
  'Entradas y guarniciones',
  'Sopas',
  'Pescados',
];

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Ingredientes efectivos = base + opcion elegida (o su defecto) + extras tildados. */
export function ingredientesDe(plato: Plato, sel: SeleccionPlato = {}): IngredientePlato[] {
  const out: IngredientePlato[] = [...plato.ingredientes];

  for (const opcion of plato.opciones ?? []) {
    const elegida = sel.opciones?.[opcion.id] ?? opcion.porDefecto;
    const alt = opcion.alternativas.find((a) => a.id === elegida) ?? opcion.alternativas[0];
    if (alt) out.push(...alt.ingredientes);
  }

  for (const extra of plato.extras ?? []) {
    if (sel.extras?.includes(extra.id)) out.push(...extra.ingredientes);
  }

  return out;
}

/** Calcula lineas y totales. `factor` escala la porcion (1 = receta tal cual). */
export function calcularPlato(
  plato: Plato,
  sel: SeleccionPlato,
  foods: FoodItem[],
  factor = 1,
): PlatoCalculado {
  const porNombre = new Map<string, FoodItem>();
  for (const f of foods) porNombre.set(f.nombre, f);

  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const lineas: LineaPlato[] = [];
  const faltantes: string[] = [];

  for (const ing of ingredientesDe(plato, sel)) {
    const food = porNombre.get(ing.nombre);
    if (!food) {
      faltantes.push(ing.nombre);
      continue;
    }
    const k = (Math.max(0, ing.gramos) * f) / 100;
    lineas.push({
      nombre: ing.nombre,
      gramos: r1(Math.max(0, ing.gramos) * f),
      kcal: r1(food.energiaKcal * k),
      proteinas: r1(food.proteinas * k),
      grasa: r1(food.grasaTotal * k),
      carbohidratos: r1(food.carbohidratosTotales * k),
      fibra: r1(food.fibra * k),
    });
  }

  const totales = lineas.reduce<TotalesPlato>(
    (a, l) => ({
      kcal: a.kcal + l.kcal,
      proteinas: a.proteinas + l.proteinas,
      grasa: a.grasa + l.grasa,
      carbohidratos: a.carbohidratos + l.carbohidratos,
      fibra: a.fibra + l.fibra,
    }),
    { kcal: 0, proteinas: 0, grasa: 0, carbohidratos: 0, fibra: 0 },
  );

  return {
    lineas,
    totales: {
      kcal: r1(totales.kcal),
      proteinas: r1(totales.proteinas),
      grasa: r1(totales.grasa),
      carbohidratos: r1(totales.carbohidratos),
      fibra: r1(totales.fibra),
    },
    gramos: r1(lineas.reduce((s, l) => s + l.gramos, 0)),
    faltantes,
  };
}

/**
 * Porcion que entra en el presupuesto restante.
 * - Nunca menos de 0,5 (no sugerimos medio plato).
 * - NUNCA mas de 1: si te sobran calorias, el plato NO se infla solo.
 *   Subir a 1,25 / 1,5 es decision del usuario (botones del modal).
 * - Sin presupuesto (0 o negativo) -> el minimo.
 */
export function factorParaPresupuesto(kcalPlato: number, kcalRestantes: number, min = 0.5, max = 1): number {
  if (!Number.isFinite(kcalPlato) || kcalPlato <= 0) return 1;
  if (!Number.isFinite(kcalRestantes)) return 1;
  if (kcalRestantes <= 0) return min;
  const crudo = kcalRestantes / kcalPlato;
  const acotado = Math.min(max, Math.max(min, crudo));
  return Math.round(acotado * 100) / 100;
}

/** "1 porcion" | "0,85 porciones" */
export function textoPorcion(factor: number): string {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  if (Math.abs(f - 1) < 0.005) return '1 porcion';
  const n = (Math.round(f * 100) / 100).toString().replace('.', ',');
  return `${n} porciones`;
}

export type RolPlato = 'sopa' | 'segundo';

/** Un plato es SOPA si su grupo es Sopas; todo lo demas es SEGUNDO. */
export function rolDePlato(plato: Pick<Plato, 'grupo'>): RolPlato {
  return plato.grupo === 'Sopas' ? 'sopa' : 'segundo';
}

/**
 * Regla de la casa: en una comida va UNA sopa y UN segundo.
 * Nunca dos segundos (ni dos sopas): se suman, no se reemplazan.
 */
export function puedeAgregarPlato(rol: RolPlato, rolesYaEnComida: RolPlato[]): boolean {
  return rolesYaEnComida.filter((r) => r === rol).length === 0;
}

/** Roles de plato ya presentes en una comida, resueltos por NOMBRE contra el recetario. */
export function rolesEnComida(entradas: { nombre: string }[], platos: Plato[]): RolPlato[] {
  const porNombre = new Map(platos.map((p) => [p.nombre, rolDePlato(p)]));
  const out: RolPlato[] = [];
  for (const e of entradas) {
    const rol = porNombre.get(e.nombre);
    if (rol) out.push(rol);
  }
  return out;
}

export const MENSAJE_YA_HAY: Record<RolPlato, string> = {
  sopa: 'Esta comida ya tiene sopa. Podés añadir el segundo o quitar la sopa.',
  segundo: 'Esta comida ya tiene segundo. Podés añadir la sopa o quitar el segundo.',
};
