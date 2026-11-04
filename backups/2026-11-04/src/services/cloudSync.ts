import { supabase } from '../lib/supabase';
import type { UserProfile, MetabolicResult } from '../logic/metabolism';
import type { MealEntry, MealType } from '../types/nutrition';
import type { ExerciseLog } from '../types/workout';

// Obtener fecha actual en formato YYYY-MM-DD local
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 1. Guardar o actualizar métricas corporales del día
export async function syncBodyMetrics(profile: UserProfile, targets: MetabolicResult) {
  const fecha = getTodayDateString();
  const { error } = await supabase.from('body_metrics').upsert(
    {
      fecha,
      peso_kg: profile.peso,
      talla_cm: profile.talla,
      edad: profile.edad,
      imc: targets.imc,
      peso_ajustado: targets.pesoAjustado,
      tmb: targets.tmb,
      tdee: targets.tdee,
      target_kcal: targets.metaCalorica,
      target_proteina_g: targets.targetProteinaG,
      target_grasa_g: targets.targetGrasaG,
      target_carbo_g: targets.targetCarbohidratosG
    },
    { onConflict: 'fecha' }
  );

  if (error) console.error('Error sincronizando métricas con Supabase:', error.message);
}

// 2. Guardar una comida registrada en el día
export async function syncMealEntry(mealType: MealType, entry: MealEntry) {
  const fecha = getTodayDateString();
  const { error } = await supabase.from('daily_meals').insert({
    fecha,
    tipo_comida: mealType,
    alimento_nombre: entry.nombre,
    gramos: entry.gramos,
    kcal: entry.kcal,
    proteinas: entry.proteinas,
    grasa: entry.grasa,
    carbohidratos: entry.carbohidratos,
    fibra: entry.fibra
  });

  if (error) console.error('Error guardando alimento en Supabase:', error.message);
}

// 3. Eliminar alimento en el día
export async function removeCloudMeal(mealType: MealType, alimentoNombre: string) {
  const fecha = getTodayDateString();
  const { error } = await supabase
    .from('daily_meals')
    .delete()
    .match({ fecha, tipo_comida: mealType, alimento_nombre: alimentoNombre });

  if (error) console.error('Error eliminando de Supabase:', error.message);
}

// 4. Guardar serie y volumen de entrenamiento
export async function syncWorkoutLog(
  rutinaId: string,
  ejercicioId: string,
  ejercicioNombre: string,
  log: ExerciseLog
) {
  const fecha = getTodayDateString();
  const { error } = await supabase.from('workout_logs').insert({
    fecha,
    rutina_id: rutinaId,
    ejercicio_id: ejercicioId,
    ejercicio_nombre: ejercicioNombre,
    peso_kg: log.pesoKg,
    series: log.series,
    reps: log.reps,
    volumen_kg: log.volumenParcial,
    completado: log.completado
  });

  if (error) console.error('Error sincronizando entrenamiento en Supabase:', error.message);
}