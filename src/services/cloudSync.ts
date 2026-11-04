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
      target_carbo_g: targets.targetCarbohidratosG,
      // Columnas nuevas (04/11/2026): sin esto el perfil subía a medias y no se
      // podía RECUPERAR en otro dispositivo (sexo, días y déficit se perdían).
      sexo: profile.sexo,
      dias_entrenamiento: profile.diasEntrenamiento,
      deficit_pct: profile.deficitPct ?? null,
      grasa_pct: profile.grasaPct ?? null,
      nivel_actividad: profile.nivelActividad ?? null,
    },
    { onConflict: 'fecha' }
  );

  if (error) console.error('Error sincronizando métricas con Supabase:', error.message);
}

/**
 * BAJAR el perfil desde la nube (04/11/2026). Antes solo se SUBÍA: `body_metrics`
 * se escribía y nunca se leía, así que un navegador nuevo arrancaba con el default
 * del código en vez de con los datos reales.
 *
 * Devuelve SOLO los campos que la fila trae; null si no hay fila o si la lectura
 * falla (en ese caso el llamador conserva el perfil que tenía).
 */
export async function loadLatestBodyMetrics(): Promise<Partial<UserProfile> | null> {
  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(1);

  if (error) {
    console.warn('No se pudo leer body_metrics:', error.message);
    return null;
  }

  const fila = data?.[0] as Record<string, unknown> | undefined;
  if (!fila) return null;

  const numero = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const perfil: Partial<UserProfile> = {};
  const peso = numero(fila.peso_kg);
  const talla = numero(fila.talla_cm);
  const edad = numero(fila.edad);
  if (peso) perfil.peso = peso;
  if (talla) perfil.talla = talla;
  if (edad) perfil.edad = edad;
  if (fila.sexo === 'H' || fila.sexo === 'M') perfil.sexo = fila.sexo;

  const dias = numero(fila.dias_entrenamiento);
  if (dias !== undefined) perfil.diasEntrenamiento = dias;

  const deficit = Number(fila.deficit_pct);
  if (Number.isFinite(deficit) && deficit > 0 && deficit < 1) perfil.deficitPct = deficit;

  const grasa = Number(fila.grasa_pct);
  if (Number.isFinite(grasa) && grasa > 0 && grasa < 1) perfil.grasaPct = grasa;

  const nivel = fila.nivel_actividad;
  if (nivel === 'SEDENTARIO' || nivel === 'LIGERO' || nivel === 'MODERADO' || nivel === 'INTENSO') {
    perfil.nivelActividad = nivel;
  }

  // Sin estos tres campos la fila no sirve como perfil: no devolvemos medias verdades.
  if (!perfil.peso || !perfil.talla || !perfil.edad) return null;
  return perfil;
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