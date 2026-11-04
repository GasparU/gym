import type { MealEntry } from '../types/nutrition';

export interface AuditTotals {
  energiaTablaKcal: number;
  energiaAtwaterKcal: number;
  diferenciaKcal: number;
  toleranciaKcal: number;
  diferenciaPct: number;
  estaCuadrado: boolean;
  /** La diferencia es tan grande que el dato del alimento es sospechoso. */
  posibleErrorDeOrigen: boolean;
  proteinasG: number;
  grasaG: number;
  carbohidratosG: number;
  fibraG: number;
}

// Atwater: proteína 4, carbohidratos 4, grasa 9 kcal/g.
// Se usan los carbohidratos TOTALES porque es la columna con la que la tabla
// de origen calculó su propia columna de energía (medido 03/11/2026 sobre los
// 927 alimentos: 741 dentro de 25 kcal con totales vs 647 con disponibles).
export const ATWATER = { proteina: 4, carbohidrato: 4, grasa: 9 } as const;

export const TOLERANCIA_ABS_KCAL = 25;
export const TOLERANCIA_REL = 0.1; // 10% de la energía declarada
export const UMBRAL_ERROR_ORIGEN_REL = 0.2; // 20% = dato sospechoso

export function computeMealTotals(entries: MealEntry[]): AuditTotals {
  let energiaTablaKcal = 0;
  let proteinasG = 0;
  let grasaG = 0;
  let carbohidratosG = 0;
  let fibraG = 0;

  for (const item of entries) {
    energiaTablaKcal += item.kcal;
    proteinasG += item.proteinas;
    grasaG += item.grasa;
    carbohidratosG += item.carbohidratos;
    fibraG += item.fibra;
  }

  const energiaAtwaterKcal =
    proteinasG * ATWATER.proteina +
    carbohidratosG * ATWATER.carbohidrato +
    grasaG * ATWATER.grasa;

  const diferenciaKcal = Math.abs(energiaTablaKcal - energiaAtwaterKcal);
  const diferenciaPct =
    energiaTablaKcal > 0
      ? parseFloat(((diferenciaKcal / energiaTablaKcal) * 100).toFixed(1))
      : 0;

  // Tolerancia relativa: una comida de 900 kcal no puede exigir el mismo
  // margen absoluto que una de 100 kcal.
  const toleranciaKcal = Math.max(
    TOLERANCIA_ABS_KCAL,
    Math.round(energiaTablaKcal * TOLERANCIA_REL),
  );

  return {
    energiaTablaKcal: Math.round(energiaTablaKcal),
    energiaAtwaterKcal: Math.round(energiaAtwaterKcal),
    diferenciaKcal: parseFloat(diferenciaKcal.toFixed(1)),
    toleranciaKcal,
    diferenciaPct,
    estaCuadrado: diferenciaKcal <= toleranciaKcal,
    posibleErrorDeOrigen:
      energiaTablaKcal > 0 && diferenciaKcal / energiaTablaKcal > UMBRAL_ERROR_ORIGEN_REL,
    proteinasG: parseFloat(proteinasG.toFixed(1)),
    grasaG: parseFloat(grasaG.toFixed(1)),
    carbohidratosG: parseFloat(carbohidratosG.toFixed(1)),
    fibraG: parseFloat(fibraG.toFixed(1)),
  };
}
