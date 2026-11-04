// 1. FRECUENCIA CARDÍACA (Tanaka 2001)
export interface HeartRateZones {
  fcMax: number;
  zonaQuemaGrasa: { min: number; max: number; label: string };
  zonaAerobica: { min: number; max: number; label: string };
  zonaAnaerobica: { min: number; max: number; label: string };
}

export function calculateHeartRateZones(edad: number): HeartRateZones {
  const fcMax = Math.round(208.75 - 0.7 * edad);
  return {
    fcMax,
    zonaQuemaGrasa: {
      min: Math.round(fcMax * 0.6),
      max: Math.round(fcMax * 0.7),
      label: 'Zona 2: Oxidación de Grasas (107-125 ppm)'
    },
    zonaAerobica: {
      min: Math.round(fcMax * 0.7),
      max: Math.round(fcMax * 0.8),
      label: 'Zona 3: Capacidad Cardiovascular'
    },
    zonaAnaerobica: {
      min: Math.round(fcMax * 0.8),
      max: Math.round(fcMax * 0.9),
      label: 'Zona 4: Umbral Anaeróbico / Lactato'
    }
  };
}

// 2. FUERZA MÁXIMA (1RM) Y CARGA DE HIPERTROFIA
export interface OneRepMaxResult {
  rmEpley: number;
  rmBrzycki: number;
  rmLander: number;
  rmPromedio: number;
  pesoHipertrofia70Pct: number; // Carga óptima al 70%
}

export function calculateOneRepMax(pesoKg: number, repsFallo: number): OneRepMaxResult {
  if (repsFallo <= 0 || pesoKg <= 0) {
    return { rmEpley: 0, rmBrzycki: 0, rmLander: 0, rmPromedio: 0, pesoHipertrofia70Pct: 0 };
  }
  if (repsFallo === 1) {
    return { rmEpley: pesoKg, rmBrzycki: pesoKg, rmLander: pesoKg, rmPromedio: pesoKg, pesoHipertrofia70Pct: Math.round(pesoKg * 0.7) };
  }

  const rmEpley = Math.round(pesoKg * (1 + 0.033 * repsFallo));
  const rmBrzycki = Math.round(pesoKg / (1.0278 - 0.0278 * repsFallo));
  const rmLander = Math.round((100 * pesoKg) / (101.3 - 2.67123 * repsFallo));
  const rmPromedio = Math.round((rmEpley + rmBrzycki + rmLander) / 3);

  return {
    rmEpley,
    rmBrzycki,
    rmLander,
    rmPromedio,
    pesoHipertrofia70Pct: parseFloat((rmPromedio * 0.7).toFixed(1))
  };
}