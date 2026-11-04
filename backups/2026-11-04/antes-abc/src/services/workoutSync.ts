// SINCRONIZACIÓN DE LA RUTINA CON SUPABASE (días + semanas + pesos).
//
// Regla de la casa (04/11/2026): lo que se guarda NO puede vivir solo en
// localStorage. Todo se escribe en la base y se LEE de la base al abrir, así el
// mismo dato aparece en cualquier equipo. localStorage queda como caché para que
// la pantalla abra rápido y no quede vacía si no hay red.
//
// Si las tablas todavía no existen (falta correr el SQL), estas funciones NO
// explotan: devuelven `faltaSql: true` y el componente sigue con la caché local
// mostrando el aviso. Un error de red tampoco rompe la pantalla.

import { supabase } from '../lib/supabase';
import { normalizarDias, type DiaGuardado } from '../logic/days';
import {
  normalizarSemanas,
  type PesoDeSemana,
  type SemanaGuardada,
} from '../logic/weeks';

/** Códigos de PostgREST/Postgres cuando la tabla no existe. */
const CODIGOS_FALTA_SQL = new Set(['42P01', 'PGRST205', 'PGRST202']);

export interface Resultado<T> {
  ok: boolean;
  data: T | null;
  faltaSql: boolean;
  error?: string;
}

function analizar(error: { code?: string; message?: string } | null): {
  faltaSql: boolean;
  mensaje?: string;
} {
  if (!error) return { faltaSql: false };
  const mensaje = error.message ?? 'Error desconocido';
  const faltaSql =
    (error.code ? CODIGOS_FALTA_SQL.has(error.code) : false) ||
    /does not exist|no existe|Could not find the table|schema cache/i.test(mensaje);
  return { faltaSql, mensaje };
}

function fallo<T>(error: { code?: string; message?: string } | null): Resultado<T> {
  const { faltaSql, mensaje } = analizar(error);
  return { ok: false, data: null, faltaSql, error: mensaje };
}

// ---------------------------------------------------------------- DÍAS

export async function cargarDias(): Promise<Resultado<DiaGuardado[]>> {
  const { data, error } = await supabase
    .from('workout_days')
    .select('id, titulo, dias, orden')
    .order('orden', { ascending: true });

  if (error) return fallo<DiaGuardado[]>(error);
  return { ok: true, data: normalizarDias(data) ?? [], faltaSql: false };
}

export async function guardarDias(dias: DiaGuardado[]): Promise<Resultado<null>> {
  if (!dias.length) return { ok: true, data: null, faltaSql: false };
  const { error } = await supabase.from('workout_days').upsert(
    dias.map((d) => ({ id: d.id, titulo: d.titulo, dias: d.dias, orden: d.orden })),
    { onConflict: 'id' },
  );
  if (error) return fallo<null>(error);
  return { ok: true, data: null, faltaSql: false };
}

export async function borrarDia(id: string): Promise<Resultado<null>> {
  const { error } = await supabase.from('workout_days').delete().eq('id', id);
  if (error) return fallo<null>(error);
  return { ok: true, data: null, faltaSql: false };
}

// ---------------------------------------------------------------- SEMANAS

export interface DatosSemanas {
  semanas: SemanaGuardada[];
  celdas: Record<string, Record<string, PesoDeSemana>>;
}

export async function cargarSemanas(): Promise<Resultado<DatosSemanas>> {
  const [{ data: semanasRaw, error: errSemanas }, { data: celdasRaw, error: errCeldas }] =
    await Promise.all([
      supabase.from('workout_weeks').select('id, inicio, fin, orden').order('inicio', { ascending: true }),
      supabase.from('workout_week_sets').select('ejercicio_id, week_id, peso_kg, series, reps'),
    ]);

  if (errSemanas) return fallo<DatosSemanas>(errSemanas);
  if (errCeldas) return fallo<DatosSemanas>(errCeldas);

  const celdas: Record<string, Record<string, PesoDeSemana>> = {};
  for (const fila of celdasRaw ?? []) {
    const ejercicio = String(fila.ejercicio_id);
    const semana = String(fila.week_id);
    if (!celdas[ejercicio]) celdas[ejercicio] = {};
    celdas[ejercicio][semana] = {
      peso: Number(fila.peso_kg) || 0,
      series: Number(fila.series) || 0,
      reps: Number(fila.reps) || 0,
    };
  }

  return {
    ok: true,
    data: { semanas: normalizarSemanas(semanasRaw), celdas },
    faltaSql: false,
  };
}

export async function guardarSemana(semana: SemanaGuardada): Promise<Resultado<null>> {
  const { error } = await supabase
    .from('workout_weeks')
    .upsert(
      { id: semana.id, inicio: semana.inicio, fin: semana.fin, orden: semana.orden },
      { onConflict: 'id' },
    );
  if (error) return fallo<null>(error);
  return { ok: true, data: null, faltaSql: false };
}

export async function borrarSemana(id: string): Promise<Resultado<null>> {
  // Las celdas caen solas por la FK ON DELETE CASCADE (si la tabla es nueva).
  const { error } = await supabase.from('workout_weeks').delete().eq('id', id);
  if (error) return fallo<null>(error);
  return { ok: true, data: null, faltaSql: false };
}

export async function guardarCeldas(
  filas: Array<{ ejercicioId: string; weekId: string; celda: PesoDeSemana }>,
): Promise<Resultado<null>> {
  if (!filas.length) return { ok: true, data: null, faltaSql: false };
  const { error } = await supabase.from('workout_week_sets').upsert(
    filas.map((f) => ({
      ejercicio_id: f.ejercicioId,
      week_id: f.weekId,
      peso_kg: f.celda.peso,
      series: f.celda.series,
      reps: f.celda.reps,
    })),
    { onConflict: 'ejercicio_id,week_id' },
  );
  if (error) return fallo<null>(error);
  return { ok: true, data: null, faltaSql: false };
}

/** Borra la celda (no guarda un 0: "sin registrar" no es "levanté 0 kg"). */
export async function borrarCelda(ejercicioId: string, weekId: string): Promise<Resultado<null>> {
  const { error } = await supabase
    .from('workout_week_sets')
    .delete()
    .eq('ejercicio_id', ejercicioId)
    .eq('week_id', weekId);
  if (error) return fallo<null>(error);
  return { ok: true, data: null, faltaSql: false };
}
