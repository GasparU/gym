import type { MealEntry } from '../types/nutrition';

export interface AuditTotals {
  energiaTablaKcal: number;
  energiaAtwaterKcal: number;
  diferenciaKcal: number;
  estaCuadrado: boolean;
  proteinasG: number;
  grasaG: number;
  carbohidratosG: number;
  fibraG: number;
}

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

  // Factor de conversión Atwater: (P * 4) + (C * 4) + (G * 9)
  const energiaAtwaterKcal = proteinasG * 4 + carbohidratosG * 4 + grasaG * 9;
  const diferenciaKcal = Math.abs(energiaTablaKcal - energiaAtwaterKcal);

  return {
    energiaTablaKcal: Math.round(energiaTablaKcal),
    energiaAtwaterKcal: Math.round(energiaAtwaterKcal),
    diferenciaKcal: parseFloat(diferenciaKcal.toFixed(1)),
    estaCuadrado: diferenciaKcal <= 25, // Margen habitual por redondeos de fibra
    proteinasG: parseFloat(proteinasG.toFixed(1)),
    grasaG: parseFloat(grasaG.toFixed(1)),
    carbohidratosG: parseFloat(carbohidratosG.toFixed(1)),
    fibraG: parseFloat(fibraG.toFixed(1))
  };
}