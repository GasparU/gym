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
  /** Clasificación de calidad (AlimentosClasificados.xlsx). Opcional: no rompe objetos viejos. */
  saciedad?: 'Alta' | 'Media' | 'Baja';
  glucemia?: 'Alta' | 'Media' | 'Baja' | null;
  cargaGlucemica?: number | null;
  altoProteina?: boolean;
  altaFibra?: boolean;
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