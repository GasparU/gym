export interface FoodItem {
  id: number;
  codigo: string;
  nombre: string;
  energiaKcal: number;
  agua: number;
  proteinas: number;
  grasaTotal: number;
  carbohidratosTotales: number;
  carbohidratosDisponibles: number;
  fibra: number;
  esCocido: boolean;
}

export interface MealEntry {
  id: string; // uuid o timestamp
  foodId: number;
  nombre: string;
  gramos: number;
  kcal: number;
  proteinas: number;
  grasa: number;
  carbohidratos: number;
  fibra: number;
}

export type MealType = 'desayuno' | 'almuerzo' | 'cena';

export interface DailyLog {
  fecha: string; // YYYY-MM-DD
  desayuno: MealEntry[];
  almuerzo: MealEntry[];
  cena: MealEntry[];
}