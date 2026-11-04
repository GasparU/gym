// Rutina REAL del dueño (cargada el 03/11/2026). Datos PUROS: sin React, sin Supabase.
//
// Regla de la casa: el programa es SUYO. Esta lista no inventa ejercicios ni
// cambia volúmenes; solo transcribe lo que ya estaba entrenando, con la técnica
// y el descanso que él indicó. El día 4 queda VACÍO a propósito: se activa en el
// mes 2 y lo define él (no lo inventamos nosotros).

export interface EjercicioRutina {
  id: string;
  nombre: string;
  series: number;
  reps: number; // tope del rango (cuando llegás al tope, subís peso)
  nota: string; // rango · descanso · indicación técnica
  grupo: string;
}

export interface DiaRutina {
  id: string;
  titulo: string;
  dias: string;
  ejercicios: EjercicioRutina[];
}

export const RUTINA: DiaRutina[] = [
  {
    id: 'dia-1',
    titulo: 'Día 1 — Tren superior (empuje y tirón)',
    dias: 'Lunes',
    ejercicios: [
      {
        id: 'd1-1',
        nombre: 'Press de Banca Plano en Máquina Smith',
        series: 5,
        reps: 10,
        nota: '8-10 reps · 2,5-3 min · codos ~45°, la barra guiada da topes de seguridad',
        grupo: 'Pecho',
      },
      {
        id: 'd1-2',
        nombre: 'Jalón al Pecho en Polea Alta',
        series: 5,
        reps: 10,
        nota: '8-10 reps · 2,5-3 min · muslos fijos, tronco apenas hacia atrás',
        grupo: 'Espalda',
      },
      {
        id: 'd1-3',
        nombre: 'Press Militar Sentado con Mancuernas',
        series: 3,
        reps: 12,
        nota: '8-12 reps · 2 min · respaldo a 90° para no cargar la lumbar',
        grupo: 'Hombros',
      },
      {
        id: 'd1-4',
        nombre: 'Curl con Barra o Polea Baja',
        series: 3,
        reps: 12,
        nota: '10-12 reps · 2 min · de pie, sin balancear la espalda',
        grupo: 'Bíceps',
      },
      {
        id: 'd1-5',
        nombre: 'Extensión en Polea Alta con Cuerda',
        series: 3,
        reps: 12,
        nota: '10-12 reps · 2 min · codos pegados, abrir la cuerda al final',
        grupo: 'Tríceps',
      },
    ],
  },
  {
    id: 'dia-2',
    titulo: 'Día 2 — Tren inferior y abdomen (cero carga lumbar)',
    dias: 'Miércoles',
    ejercicios: [
      {
        id: 'd2-1',
        nombre: 'Prensa Inclinada de Piernas',
        series: 4,
        reps: 12,
        nota: '10-12 reps · 3 min · pies medios-altos, cadera apoyada',
        grupo: 'Piernas / Glúteos',
      },
      {
        id: 'd2-2',
        nombre: 'Curl Femoral en Máquina',
        series: 4,
        reps: 12,
        nota: '10-12 reps · 3 min · reemplaza al peso muerto: cero tensión en discos',
        grupo: 'Isquiotibiales',
      },
      {
        id: 'd2-3',
        nombre: 'Extensión de Piernas en Sillón',
        series: 3,
        reps: 15,
        nota: '12-15 reps · 2 min · bajada excéntrica de 3-4 s',
        grupo: 'Cuádriceps',
      },
      {
        id: 'd2-4',
        nombre: 'Elevación de Talones en Prensa Inclinada',
        series: 3,
        reps: 20,
        nota: '15-20 reps · 1,5 min · rango completo, sin comprimir la columna',
        grupo: 'Gemelos',
      },
      {
        id: 'd2-5',
        nombre: 'Crunch en Polea Alta de Rodillas',
        series: 3,
        reps: 20,
        nota: '15-20 reps · 1 min · vaciar el aire al contraer',
        grupo: 'Abdomen',
      },
    ],
  },
  {
    id: 'dia-3',
    titulo: 'Día 3 — Cuerpo completo (multiangular)',
    dias: 'Viernes',
    ejercicios: [
      {
        id: 'd3-1',
        nombre: 'Press Inclinado en Máquina o Mancuernas',
        series: 5,
        reps: 12,
        nota: '8-12 reps · 2,5-3 min · banco 30-45° (fibras claviculares)',
        grupo: 'Pecho',
      },
      {
        id: 'd3-2',
        nombre: 'Remo con Soporte de Pecho en Máquina',
        series: 5,
        reps: 12,
        nota: '8-12 reps · 2,5-3 min · pecho apoyado: anula la lumbar',
        grupo: 'Espalda',
      },
      {
        id: 'd3-3',
        nombre: 'Prensa Inclinada de Piernas (repetición)',
        series: 3,
        reps: 15,
        nota: '12-15 reps · 3 min · volumen extra de tren inferior con estabilidad',
        grupo: 'Piernas',
      },
      {
        id: 'd3-4',
        nombre: 'Elevaciones Laterales con Mancuernas',
        series: 3,
        reps: 15,
        nota: '12-15 reps · 1,5 min · hasta la altura del hombro, codos suaves',
        grupo: 'Hombros',
      },
      // Antes era UNA fila "Superserie: Curl Martillo + Copa de Tríceps" con un solo
      // campo de peso: no se podían anotar las DOS cargas y el progreso mezclaba dos
      // ejercicios distintos. Separada el 04/11/2026 — la superserie sigue existiendo,
      // ahora escrita en la nota de cada uno.
      {
        id: 'd3-5',
        nombre: 'Curl Martillo con Mancuernas',
        series: 3,
        reps: 12,
        nota: '10-12 reps · superserie con "Copa de Tríceps": sin descanso entre los dos · 1,5-2 min al terminar la pareja',
        grupo: 'Bíceps',
      },
      {
        id: 'd3-6',
        nombre: 'Copa de Tríceps sobre la Cabeza',
        series: 3,
        reps: 12,
        nota: '10-12 reps · superserie con "Curl Martillo": sin descanso entre los dos · 1,5-2 min al terminar la pareja',
        grupo: 'Tríceps',
      },
    ],
  },
];

/** Los días con los que arranca la app (se derivan de RUTINA). */
export const DIAS_INICIALES = RUTINA.map((d, i) => ({
  id: d.id,
  titulo: d.titulo,
  dias: d.dias,
  orden: i,
}));

/** Filas listas para insertar en la tabla `workout_exercises`. */
export function filasParaInsertar(pesoInicial = 0) {
  return RUTINA.flatMap((dia) =>
    dia.ejercicios.map((e) => ({
      rutina_id: dia.id,
      nombre: e.nombre,
      calentamiento: e.nota,
      peso: pesoInicial,
      series: e.series,
      reps: e.reps,
    })),
  );
}

/** Series totales por grupo muscular en la semana (para controlar el volumen). */
export function seriesPorGrupo(): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const dia of RUTINA) {
    for (const e of dia.ejercicios) {
      // Ya no hay fila "Brazos": la superserie se separó en Bíceps y Tríceps, así
      // que cada ejercicio cuenta sus propias series (antes se multiplicaba ×2).
      acc[e.grupo] = (acc[e.grupo] ?? 0) + e.series;
    }
  }
  return acc;
}
