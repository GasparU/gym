export interface ExerciseConfig {
  id: string;
  nombre: string;
  calentamiento?: string;
  pesoDefault: number;
  seriesDefault: number;
  repsDefault: number;
  descansoSeg: number;
}

export interface DayRoutine {
  id: string;
  titulo: string;
  diasSugeridos: string;
  ejercicios: ExerciseConfig[];
}

export interface ExerciseLog {
  exerciseId: string;
  pesoKg: number;
  series: number;
  reps: number;
  volumenParcial: number; // pesoKg * series * reps
  completado: boolean;
}