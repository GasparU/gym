import { supabase } from '../lib/supabase';
import type { UserProfile, MetabolicResult } from '../logic/metabolism';
import type { MealEntry, MealType } from '../types/nutrition';
import { entradasDesdeFilas, filasDesdeEntradas, type Meals } from '../logic/dieta';
import {
  fechaMas,
  filaDesdeResumen,
  resumenDesdeFila,
  type DaySummary,
  type FilaDetalleDia,
} from '../logic/resumen';
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

// 2. LEER el día completo (04/11/2026). Antes la tabla solo se ESCRIBÍA:
//    `DietModule` arrancaba con `meals` vacío y un refresh borraba desayuno,
//    almuerzo y cena. Devuelve null si la lectura falla: el llamador conserva
//    la caché local y NUNCA borra lo que el usuario cargó.
export async function loadMealsForDate(fecha: string): Promise<Meals | null> {
  const { data, error } = await supabase
    .from('daily_meals')
    .select('*')
    .eq('fecha', fecha)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('No se pudo leer daily_meals:', error.message);
    return null;
  }
  return entradasDesdeFilas(data ?? []);
}

// 3. GUARDAR una comida del día como REEMPLAZO (borra + inserta). Es idempotente
//    y limpia duplicados de sesiones anteriores. Si el insert falla después del
//    delete, la caché local conserva el día y el próximo cambio re-sincroniza.
export async function saveMealDay(
  fecha: string,
  mealType: MealType,
  entradas: MealEntry[],
): Promise<boolean> {
  const borrado = await supabase
    .from('daily_meals')
    .delete()
    .match({ fecha, tipo_comida: mealType });

  if (borrado.error) {
    console.error('Error limpiando daily_meals:', borrado.error.message);
    return false;
  }
  if (entradas.length === 0) return true;

  const { error } = await supabase
    .from('daily_meals')
    .insert(filasDesdeEntradas(fecha, mealType, entradas));

  if (error) {
    console.error('Error guardando el día en Supabase:', error.message);
    return false;
  }
  return true;
}

// 4. RESUMEN DIARIO (05/11/2026)
//    Una fila por dia en `daily_summary`: totales + metas + deficit. El desglose
//    por comida NO se duplica (vive en `daily_meals`). Asi el historial se lee
//    con 1 fila por dia en vez de cientos de filas de alimentos.

export async function saveDailySummary(resumen: DaySummary): Promise<boolean> {
  const { error } = await supabase.from('daily_summary').upsert(
    { ...filaDesdeResumen(resumen), actualizado_en: new Date().toISOString() },
    { onConflict: 'fecha' },
  );
  if (error) {
    console.warn('No se pudo guardar el resumen del dia:', error.message);
    return false;
  }
  return true;
}

/** Borra el resumen de un dia (el usuario vacio todo: no hay dato que mostrar). */
export async function deleteDailySummary(fecha: string): Promise<boolean> {
  const { error } = await supabase.from('daily_summary').delete().eq('fecha', fecha);
  if (error) {
    console.warn('No se pudo borrar el resumen del dia:', error.message);
    return false;
  }
  return true;
}

/** Ultimos `dias` resumenes (incluye hoy). Se usa para el panel de progreso. */
export async function loadSummaries(
  dias = 14,
  hasta = getTodayDateString(),
): Promise<DaySummary[]> {
  const desde = fechaMas(hasta, -(dias - 1));
  const { data, error } = await supabase
    .from('daily_summary')
    .select('*')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true });

  if (error) {
    console.warn('No se pudo leer el resumen diario:', error.message);
    return [];
  }
  return (data ?? [])
    .map((fila) => resumenDesdeFila(fila))
    .filter((r): r is DaySummary => r !== null);
}

/**
 * Ultimo dia CON DATOS antes de `antesDe`. Sirve para el aviso "hoy esta vacio".
 * Filtra en la consulta (`entradas > 0`) para no traer dias en blanco.
 */
export async function loadLatestSummary(
  antesDe = getTodayDateString(),
): Promise<DaySummary | null> {
  const { data, error } = await supabase
    .from('daily_summary')
    .select('*')
    .lt('fecha', antesDe)
    .gt('entradas', 0)
    .order('fecha', { ascending: false })
    .limit(1);

  if (error) {
    console.warn('No se pudo leer el ultimo resumen:', error.message);
    return null;
  }
  return data && data[0] ? resumenDesdeFila(data[0]) : null;
}

/**
 * Filas CRUDAS de `daily_meals` entre dos fechas.
 *
 * Es la FUENTE DE VERDAD del historial: `daily_summary` es un atajo, así que los
 * días cargados antes de que existiera (o que no se pudieron resumir por red)
 * se reconstruyen desde acá. Sin esto, el cuadro semanal mostraba "—" en días
 * que sí tenían comidas guardadas (medido el 05/11/2026: ayer tenía 5 filas y el
 * panel salía vacío porque `daily_summary` estaba en 0).
 */
export async function loadMealsRange(
  desde: string,
  hasta: string,
): Promise<FilaDetalleDia[]> {
  const { data, error } = await supabase
    .from('daily_meals')
    .select('fecha,tipo_comida,kcal,proteinas,grasa,carbohidratos,fibra')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true });

  if (error) {
    console.warn('No se pudo leer el detalle del historial:', error.message);
    return [];
  }

  return (data ?? [])
    .map((fila) => ({
      fecha: String(fila.fecha ?? '').slice(0, 10),
      tipoComida: String(fila.tipo_comida ?? ''),
      kcal: Number(fila.kcal) || 0,
      proteinas: Number(fila.proteinas) || 0,
      grasa: Number(fila.grasa) || 0,
      carbohidratos: Number(fila.carbohidratos) || 0,
      fibra: Number(fila.fibra) || 0,
    }))
    .filter((fila) => /^\d{4}-\d{2}-\d{2}$/.test(fila.fecha));
}

// 5. Guardar serie y volumen de entrenamiento
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