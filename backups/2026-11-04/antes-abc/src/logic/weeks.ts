// SEMANAS CON FECHA REAL (núcleo PURO: sin React, sin Supabase, SIN imports para
// que Node ESM lo pueda importar directo en los scripts de verificación).
//
// Regla de la casa: una columna de la matriz = una semana con su lunes y su domingo.
// El id es la fecha del lunes ('AAAA-MM-DD'), NO un número de orden: así renumerar
// (agregar una semana en el medio) no mueve ni un kilo del historial.
//
// La celda guarda el PESO (lo que el dueño recuerda del gimnasio); el VOLUMEN
// (peso × series × reps) se calcula. Antes la etiqueta pedía "kilos reales" pero
// guardaba volumen: un número que nadie escribe a mano sin equivocarse.

export interface SemanaGuardada {
  /** 'AAAA-MM-DD' del lunes. Estable: es la clave en la base. */
  id: string;
  inicio: string;
  fin: string;
  /** 1..N, derivado del orden cronológico (no se guarda como verdad). */
  orden: number;
}

export interface PesoDeSemana {
  peso: number;
  series: number;
  reps: number;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Fecha local del equipo (NO UTC: a las 20:00 de Lima, toISOString() ya es mañana). */
export function fechaLocalISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function esFechaISO(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const f = new Date(y, m - 1, d);
  return f.getFullYear() === y && f.getMonth() === m - 1 && f.getDate() === d;
}

function aFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function sumarDias(iso: string, dias: number): string {
  const f = aFecha(iso);
  f.setDate(f.getDate() + dias);
  return fechaLocalISO(f);
}

/** Lunes de la semana que contiene esa fecha (semana lunes→domingo). */
export function lunesDe(iso: string): string {
  const f = aFecha(iso);
  const corrimiento = (f.getDay() + 6) % 7; // lunes=0 ... domingo=6
  f.setDate(f.getDate() - corrimiento);
  return fechaLocalISO(f);
}

/** Ordena por fecha, deduplica por id y renumera 1..N. Descarta basura. */
export function normalizarSemanas(valor: unknown): SemanaGuardada[] {
  if (!Array.isArray(valor)) return [];
  const vistas = new Set<string>();
  const limpias: SemanaGuardada[] = [];
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    const inicio = esFechaISO(s.inicio) ? s.inicio : esFechaISO(s.id) ? s.id : null;
    if (!inicio || vistas.has(inicio)) continue;
    vistas.add(inicio);
    limpias.push({
      id: inicio,
      inicio,
      fin: esFechaISO(s.fin) ? s.fin : sumarDias(inicio, 6),
      orden: 0,
    });
  }
  limpias.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return limpias.map((s, i) => ({ ...s, orden: i + 1 }));
}

/**
 * Agrega la semana que contiene `fechaISO`. Si ya existe, NO la duplica.
 * Si se agrega en el medio (una semana pasada que faltaba), renumera.
 */
export function agregarSemana(
  semanas: SemanaGuardada[],
  fechaISO: string,
): { semanas: SemanaGuardada[]; creada: boolean } {
  // Falla cerrado: una fecha vacía o basura NO crea una semana "NaN-NaN-NaN".
  if (!esFechaISO(fechaISO)) return { semanas, creada: false };
  const inicio = lunesDe(fechaISO);
  if (semanas.some((s) => s.inicio === inicio)) {
    return { semanas, creada: false };
  }
  const nuevas = [
    ...semanas,
    { id: inicio, inicio, fin: sumarDias(inicio, 6), orden: 0 },
  ];
  return { semanas: normalizarSemanas(nuevas), creada: true };
}

/** Quita UNA semana por id (fecha). Si no existe, devuelve la misma lista. */
export function quitarSemana(semanas: SemanaGuardada[], id: string): SemanaGuardada[] {
  if (!semanas.some((s) => s.id === id)) return semanas;
  return normalizarSemanas(semanas.filter((s) => s.id !== id));
}

/**
 * "02–08 nov" (mismo mes) o "26 oct – 01 nov" (cuando la semana cruza de mes;
 * sin esto la etiqueta mentía: decía "26–01 nov" y el 26 era de octubre).
 */
export function etiquetaRango(semana: SemanaGuardada): string {
  const a = aFecha(semana.inicio);
  const b = aFecha(semana.fin);
  const dd = (n: number) => String(n).padStart(2, '0');
  if (a.getMonth() === b.getMonth()) {
    return `${dd(a.getDate())}–${dd(b.getDate())} ${MESES[a.getMonth()]}`;
  }
  return `${dd(a.getDate())} ${MESES[a.getMonth()]} – ${dd(b.getDate())} ${MESES[b.getMonth()]}`;
}

/** "Sem 3 · 17–23 nov" */
export function etiquetaSemana(semana: SemanaGuardada): string {
  return `Sem ${semana.orden} · ${etiquetaRango(semana)}`;
}

export function volumenDe(peso: number, series: number, reps: number): number {
  const p = Number(peso) || 0;
  const s = Number(series) || 0;
  const r = Number(reps) || 0;
  if (p <= 0 || s <= 0 || r <= 0) return 0;
  return Math.round(p * s * r);
}

/**
 * Volumen por semana (clave = orden) para la columna de Progreso.
 * Solo incluye semanas con peso registrado: un 0 no es "bajé", es "no lo anoté".
 */
export function volumenesPorSemana(
  celdas: Record<string, PesoDeSemana> | undefined,
  semanas: SemanaGuardada[],
): Record<number, number> {
  const salida: Record<number, number> = {};
  if (!celdas) return salida;
  for (const semana of semanas) {
    const c = celdas[semana.id];
    if (!c) continue;
    const vol = volumenDe(c.peso, c.series, c.reps);
    if (vol > 0) salida[semana.orden] = vol;
  }
  return salida;
}

/** Agrupa en "meses" de N semanas para el acordeón (4 por defecto). */
export function mesesDeSemanas(
  semanas: SemanaGuardada[],
  porMes = 4,
): Array<{ mNum: number; semanas: SemanaGuardada[] }> {
  const paso = Math.max(1, porMes);
  const total = Math.max(1, Math.ceil(semanas.length / paso));
  const salida: Array<{ mNum: number; semanas: SemanaGuardada[] }> = [];
  for (let i = 0; i < total; i++) {
    salida.push({ mNum: i + 1, semanas: semanas.slice(i * paso, i * paso + paso) });
  }
  return salida;
}
