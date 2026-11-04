// Lectura del historial de progreso (PURO). La base guarda, por ejercicio y por
// semana, el VOLUMEN en kg (peso × series × reps). Acá se resume para mostrar
// si el ejercicio sube, baja o está planchado — sin mentir cuando no hay datos.

export type Tendencia = 'SUBE' | 'BAJA' | 'IGUAL' | 'SIN_DATOS';

export interface ResumenProgreso {
  puntos: number;
  primeraSemana: number | null;
  ultimaSemana: number | null;
  primerVolumen: number | null;
  ultimoVolumen: number | null;
  mejorVolumen: number | null;
  /** % de cambio entre el primero y el último punto de la ventana. */
  deltaPct: number | null;
  tendencia: Tendencia;
}

export const UMBRAL_TENDENCIA_PCT = 2; // menos de 2% es ruido de redondeo

/** Spanish-friendly: "1.234" -> "1.234" (miles) con coma decimal. */
export function formatearVolumen(kg: number): string {
  return kg.toLocaleString('es-PE');
}

export function resumenProgreso(
  historialPorSemana: Record<number, number> | undefined,
  ventana = 4,
): ResumenProgreso {
  const vacio: ResumenProgreso = {
    puntos: 0,
    primeraSemana: null,
    ultimaSemana: null,
    primerVolumen: null,
    ultimoVolumen: null,
    mejorVolumen: null,
    deltaPct: null,
    tendencia: 'SIN_DATOS',
  };
  if (!historialPorSemana) return vacio;

  const pares = Object.entries(historialPorSemana)
    .map(([semana, volumen]) => ({ semana: Number(semana), volumen: Number(volumen) }))
    .filter((p) => Number.isFinite(p.semana) && Number.isFinite(p.volumen) && p.volumen > 0)
    .sort((a, b) => a.semana - b.semana);

  if (pares.length === 0) return vacio;

  const ventanaPares = pares.slice(-Math.max(1, ventana));
  const primero = ventanaPares[0];
  const ultimo = ventanaPares[ventanaPares.length - 1];

  const deltaPct =
    ventanaPares.length >= 2 && primero.volumen > 0
      ? Math.round(((ultimo.volumen - primero.volumen) / primero.volumen) * 1000) / 10
      : null;

  let tendencia: Tendencia = 'SIN_DATOS';
  if (deltaPct !== null) {
    if (deltaPct > UMBRAL_TENDENCIA_PCT) tendencia = 'SUBE';
    else if (deltaPct < -UMBRAL_TENDENCIA_PCT) tendencia = 'BAJA';
    else tendencia = 'IGUAL';
  }

  return {
    puntos: ventanaPares.length,
    primeraSemana: primero.semana,
    ultimaSemana: ultimo.semana,
    primerVolumen: primero.volumen,
    ultimoVolumen: ultimo.volumen,
    mejorVolumen: Math.max(...ventanaPares.map((p) => p.volumen)),
    deltaPct,
    tendencia,
  };
}
