// Los DÍAS de entrenamiento son datos, no una lista fija: el usuario los crea,
// los renombra y los borra. Núcleo PURO (sin React ni Supabase) para poder
// probarlo en Node.
export interface DiaGuardado {
  id: string;
  titulo: string;
  dias: string;
  orden: number;
}

export function ordenarDias(dias: DiaGuardado[]): DiaGuardado[] {
  return [...dias].sort((a, b) => a.orden - b.orden);
}

/**
 * Valida lo que vino de localStorage (o de la nube): descarta basura, deduplica
 * ids y completa lo que falte. Devuelve null si no queda ni un día válido.
 */
export function normalizarDias(valor: unknown): DiaGuardado[] | null {
  if (!Array.isArray(valor)) return null;
  const salida: DiaGuardado[] = [];
  const vistos = new Set<string>();
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Record<string, unknown>;
    if (typeof d.id !== 'string' || !d.id.trim()) continue;
    const id = d.id.trim();
    if (vistos.has(id)) continue;
    vistos.add(id);
    salida.push({
      id,
      titulo: typeof d.titulo === 'string' && d.titulo.trim() ? d.titulo.trim() : `Día ${salida.length + 1}`,
      dias: typeof d.dias === 'string' ? d.dias.trim() : '',
      orden: Number.isFinite(d.orden) ? Number(d.orden) : salida.length,
    });
  }
  return salida.length ? ordenarDias(salida) : null;
}

/** Próximo id libre: si existen dia-1 y dia-3, devuelve dia-4. */
export function siguienteIdDia(dias: DiaGuardado[]): string {
  let max = 0;
  for (const d of dias) {
    const m = /^dia-(\d+)$/.exec(d.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `dia-${max + 1}`;
}

/**
 * Días que TIENEN ejercicios pero no están en la lista guardada. Sirve para no
 * perder datos si el navegador borra el localStorage: los días reaparecen.
 */
export function diasFaltantes(dias: DiaGuardado[], rutinaIds: string[]): DiaGuardado[] {
  const presentes = new Set(dias.map((d) => d.id));
  const nuevos: DiaGuardado[] = [];
  for (const id of rutinaIds) {
    if (!id || presentes.has(id)) continue;
    presentes.add(id);
    nuevos.push({
      id,
      titulo: `Día ${dias.length + nuevos.length + 1}`,
      dias: '',
      orden: dias.length + nuevos.length,
    });
  }
  return nuevos;
}

/** Devuelve el mensaje de error, o null si está bien. */
export function validarDia(titulo: string, dias: string): string | null {
  if (!titulo.trim()) return 'El nombre del día no puede estar vacío.';
  if (titulo.trim().length > 60) return 'El nombre del día llega a 60 caracteres como máximo.';
  if (dias.trim().length > 40) return 'El día de la semana llega a 40 caracteres como máximo.';
  return null;
}

/** Nunca se puede quedar sin días: siempre tiene que haber uno donde cargar. */
export function puedeEliminarDia(dias: DiaGuardado[]): boolean {
  return dias.length > 1;
}
