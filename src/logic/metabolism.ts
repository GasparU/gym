// Núcleo de cálculo metabólico (PURO: sin React, sin Supabase, sin IO).
//
// Decisiones tomadas el 03/11/2026, alineadas con el Excel del dueño y la
// evidencia citada en la auditoría:
//  1. TMB: Katch-McArdle si hay % de grasa (modela masa libre de grasa);
//     si no, Mifflin-St Jeor con PESO REAL. El "peso ajustado" se sigue
//     calculando como referencia clínica pero YA NO entra en la TMB
//     (introducía una subestimación de ~220-250 kcal/día).
//  2. Proteína en g/kg (nunca por porcentaje): 2,3 g/kg de masa libre de grasa
//     si se conoce, o 1,8 g/kg de peso real si no. Techo: 40% de las kcal.
//  3. Grasa: 0,75 g/kg de la misma base, con piso del 20% de las kcal
//     (piso hormonal) y techo del 35%.
//  4. Factor de actividad: explícito si el usuario elige nivel (incluye el
//     trabajo/NEAT); si no, se deriva de los días de entrenamiento y se avisa.

export type NivelActividad = 'SEDENTARIO' | 'LIGERO' | 'MODERADO' | 'INTENSO';
export type FormulaTmb = 'KATCH_MCARDLE' | 'MIFFLIN_ST_JEOR';

export const FACTORES_ACTIVIDAD: Record<NivelActividad, number> = {
  SEDENTARIO: 1.2,
  LIGERO: 1.375,
  MODERADO: 1.55,
  INTENSO: 1.725,
};

export const NOMBRES_ACTIVIDAD: Record<NivelActividad, string> = {
  SEDENTARIO: 'Sedentario',
  LIGERO: 'Ligero',
  MODERADO: 'Moderado',
  INTENSO: 'Intenso',
};

const conComa = (n: number): string => String(n).replace('.', ',');

/** Cuántos días de entrenamiento corresponde a cada nivel (para el selector). */
export const DIAS_POR_NIVEL: Record<NivelActividad, string> = {
  SEDENTARIO: '0 días/sem',
  LIGERO: '2-3 días/sem',
  MODERADO: '4-5 días/sem',
  INTENSO: '6-7 días/sem',
};

/** Etiqueta corta para el <select>: nombre + multiplicador. */
export const ETIQUETAS_ACTIVIDAD: Record<NivelActividad, string> = {
  SEDENTARIO: `${NOMBRES_ACTIVIDAD.SEDENTARIO} ×${conComa(FACTORES_ACTIVIDAD.SEDENTARIO)} · ${DIAS_POR_NIVEL.SEDENTARIO}`,
  LIGERO: `${NOMBRES_ACTIVIDAD.LIGERO} ×${conComa(FACTORES_ACTIVIDAD.LIGERO)} · ${DIAS_POR_NIVEL.LIGERO}`,
  MODERADO: `${NOMBRES_ACTIVIDAD.MODERADO} ×${conComa(FACTORES_ACTIVIDAD.MODERADO)} · ${DIAS_POR_NIVEL.MODERADO}`,
  INTENSO: `${NOMBRES_ACTIVIDAD.INTENSO} ×${conComa(FACTORES_ACTIVIDAD.INTENSO)} · ${DIAS_POR_NIVEL.INTENSO}`,
};

/** Qué significa cada nivel, con unidades medibles (pasos / sesiones / minutos). */
export const DESCRIPCION_ACTIVIDAD: Record<NivelActividad, string> = {
  SEDENTARIO:
    'Escritorio y sentado casi todo el día: menos de 5.000 pasos diarios y sin entrenar.',
  LIGERO:
    'Escritorio + 2 o 3 entrenamientos por semana, de 45 a 60 min cada uno. (Equivale a 5.000-7.500 pasos diarios sin entrenar.)',
  MODERADO:
    'Escritorio + 4 o 5 entrenamientos por semana, de 45 a 60 min cada uno. (Equivale a un trabajo de pie o caminando: 7.500-10.000 pasos diarios, sin entrenar.)',
  INTENSO:
    'Trabajo físico real (obra, almacén, reparto, mudanza) o 6-7 entrenamientos por semana.',
};

/** Texto que aparece cuando no se eligió nivel y el factor se deriva de los días. */
export function descripcionActividadAutomatica(dias: number, factor: number): string {
  return `Sin elegir nivel: se usa ×${conComa(factor)} por tus ${dias} día(s) de entrenamiento. OJO: así NO se cuenta tu trabajo; si pasás el día sentado, elegí "Sedentario".`;
}

// Límites de cordura: fuera de acá, el dato se descarta (fail-closed).
export const GRASA_PCT_MIN = 0.05;
export const GRASA_PCT_MAX = 0.6;
export const DEFICIT_MIN = 0.05;
export const DEFICIT_MAX = 0.35;
export const IMC_IDEAL_POR_DEFECTO = 24;

export const FACTOR_PROTEINA_MLG = 2.3; // g/kg de masa libre de grasa
export const FACTOR_PROTEINA_PESO = 1.8; // g/kg de peso real (sin % de grasa)
export const FACTOR_PROTEINA_PESO_MIN = 1.6; // piso cuando hay % de grasa (evita subestimar en obesidad)
export const FACTOR_GRASA_GKG = 0.75; // g/kg de la base usada
export const PISO_GRASA_PCT_KCAL = 0.2;
export const TECHO_GRASA_PCT_KCAL = 0.35;
export const TECHO_PROTEINA_PCT_KCAL = 0.4;

export interface UserProfile {
  peso: number; // kg (ej. 98)
  talla: number; // cm (ej. 175)
  edad: number; // años (ej. 44)
  sexo: 'H' | 'M';
  diasEntrenamiento: number; // 0..7
  imcIdeal?: number; // 24
  deficitPct?: number; // 0.15 (15%)
  grasaPct?: number; // 0.28 (28%) — opcional; si está, se usa Katch-McArdle
  nivelActividad?: NivelActividad; // opcional; si no, se deriva de los días
}

export interface MetabolicResult {
  imc: number;
  clasificacionIMC: string;
  pesoIdeal: number;
  pesoAjustado: number; // informativo: NO se usa para la TMB
  aplicaPesoAjustado: boolean;
  masaLibreGrasa: number | null;
  formulaTmb: FormulaTmb;
  tmb: number;
  tdee: number;
  factorActividad: number;
  factorActividadFuente: 'NIVEL' | 'DIAS';
  deficitPctUsado: number;
  metaCalorica: number;
  deficitKcal: number; // tdee - meta (positivo = lo que recortas)
  proteinaBaseG: number; // base sobre la que se calculó la proteína
  proteinaFactorGkg: number;
  targetProteinaG: number;
  targetGrasaG: number;
  targetCarbohidratosG: number;
  /** Agua diaria recomendada en litros (SIN contar las horas de entrenamiento). */
  aguaLitros: number;
  avisos: string[];
}

/** Factor de actividad derivado SOLO de los días de entrenamiento. */
export function factorPorDias(dias: number): number {
  const d = Number.isFinite(dias) ? Math.max(0, Math.min(7, Math.round(dias))) : 0;
  if (d <= 1) return 1.2;
  if (d <= 3) return 1.375;
  if (d <= 5) return 1.55;
  return 1.725;
}

/** Agua extra por cada hora de entrenamiento (500 ml), igual que el Excel. */
export const AGUA_ML_POR_HORA_ACTIVIDAD = 500;

/**
 * Agua diaria en litros, con la fórmula del Excel (Objetivos!X26 y X27):
 *  - IMC < 30: 35 ml × kg de peso real.
 *  - IMC ≥ 30: (peso ideal × 30 ml) + [(peso real − peso ideal) × 10 ml].
 * Redondea a 1 decimal, como el Excel. NO incluye las horas de entrenamiento.
 */
export function aguaDiariaLitros(peso: number, imc: number, pesoIdeal: number): number {
  const p = Number.isFinite(peso) && peso > 0 ? peso : 0;
  if (p === 0) return 0;
  const litros =
    imc >= 30 && pesoIdeal > 0
      ? (pesoIdeal * 30 + (p - pesoIdeal) * 10) / 1000
      : 0.035 * p;
  return Math.round(litros * 10) / 10;
}

/** Clasificación clínica del IMC, sin huecos en los bordes. */
export function clasificarImc(imc: number): string {
  if (imc < 18.5) return 'Bajo Peso';
  if (imc < 25) return 'Peso Ideal';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidad Tipo I';
  return 'Obesidad Tipo II';
}

function redondear(n: number): number {
  return Math.round(n);
}

function limitar(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function calculateMetabolicTargets(u: UserProfile): MetabolicResult {
  const avisos: string[] = [];

  const tallaM = u.talla / 100;
  const alturaValida = tallaM > 0.5 && tallaM < 2.6;
  const imc = alturaValida ? parseFloat((u.peso / (tallaM * tallaM)).toFixed(2)) : 0;
  const clasificacionIMC = clasificarImc(imc);

  const imcIdeal = u.imcIdeal && u.imcIdeal > 0 ? u.imcIdeal : IMC_IDEAL_POR_DEFECTO;
  const pesoIdeal = alturaValida ? parseFloat((imcIdeal * tallaM * tallaM).toFixed(2)) : 0;

  // Referencia clínica: se informa, NO se usa en la TMB.
  const aplicaPesoAjustado = imc >= 30;
  const pesoAjustado = parseFloat(
    (pesoIdeal + 0.25 * (u.peso - pesoIdeal)).toFixed(2),
  );

  // Agua: fórmula del Excel. Con IMC ≥ 30 usa el peso ideal, no 35 ml/kg.
  const aguaLitros = aguaDiariaLitros(u.peso, imc, pesoIdeal);
  if (imc >= 30 && pesoIdeal > 0) {
    avisos.push(
      `Agua calculada con la fórmula de sobrepeso (peso ideal ${pesoIdeal} kg), no 35 ml/kg.`,
    );
  }

  // % de grasa válido -> masa libre de grasa.
  const grasaValida =
    typeof u.grasaPct === 'number' &&
    Number.isFinite(u.grasaPct) &&
    u.grasaPct >= GRASA_PCT_MIN &&
    u.grasaPct <= GRASA_PCT_MAX;
  const masaLibreGrasa = grasaValida
    ? parseFloat((u.peso * (1 - (u.grasaPct as number))).toFixed(2))
    : null;

  if (u.grasaPct !== undefined && !grasaValida) {
    avisos.push(
      `El % de grasa (${u.grasaPct}) está fuera del rango ${GRASA_PCT_MIN * 100}-${GRASA_PCT_MAX * 100}%: se ignoró.`,
    );
  }

  // 1) TMB
  const constSexo = u.sexo === 'H' ? 5 : -161;
  let tmb: number;
  let formulaTmb: FormulaTmb;
  if (masaLibreGrasa !== null) {
    tmb = redondear(370 + 21.6 * masaLibreGrasa);
    formulaTmb = 'KATCH_MCARDLE';
    avisos.push(
      `TMB con Katch-McArdle sobre ${masaLibreGrasa} kg de masa libre de grasa.`,
    );
  } else {
    tmb = redondear(10 * u.peso + 6.25 * u.talla - 5 * u.edad + constSexo);
    formulaTmb = 'MIFFLIN_ST_JEOR';
    avisos.push(
      'TMB con Mifflin-St Jeor sobre el peso real (cargá el % de grasa para usar Katch-McArdle).',
    );
  }
  if (aplicaPesoAjustado) {
    avisos.push(
      `El peso ajustado (${pesoAjustado} kg) queda como referencia: no se usa para la TMB.`,
    );
  }

  // 2) Factor de actividad
  let factorActividad: number;
  let factorActividadFuente: 'NIVEL' | 'DIAS';
  if (u.nivelActividad && FACTORES_ACTIVIDAD[u.nivelActividad]) {
    factorActividad = FACTORES_ACTIVIDAD[u.nivelActividad];
    factorActividadFuente = 'NIVEL';
  } else {
    factorActividad = factorPorDias(u.diasEntrenamiento);
    factorActividadFuente = 'DIAS';
    avisos.push(
      `Factor de actividad ${factorActividad} asumido por los días de entrenamiento. Si tu trabajo es sedentario, elegí "Sedentario" (1,2): puede mover ~250 kcal/día.`,
    );
  }

  const tdee = redondear(tmb * factorActividad);

  // 3) Déficit
  const deficitPedido = typeof u.deficitPct === 'number' ? u.deficitPct : 0.15;
  const deficitPctUsado = limitar(
    Number.isFinite(deficitPedido) ? deficitPedido : 0.15,
    DEFICIT_MIN,
    DEFICIT_MAX,
  );
  if (Math.abs(deficitPctUsado - deficitPedido) > 1e-9) {
    avisos.push(
      `Déficit ${(deficitPedido * 100).toFixed(0)}% fuera de rango ${DEFICIT_MIN * 100}-${DEFICIT_MAX * 100}%: se usó ${(deficitPctUsado * 100).toFixed(0)}%.`,
    );
  }

  const metaCalorica = redondear(tdee * (1 - deficitPctUsado));
  const deficitKcal = Math.round(tdee - metaCalorica);

  // 4) Proteína en g/kg (nunca %). Dos pisos y se toma el mayor:
  //    - 2,3 g/kg de masa libre de grasa (Helms 2014: 2,3-3,1 en déficit)
  //    - 1,6 g/kg de peso total (Morton 2018: 1,6 es el mínimo útil)
  //    En obesidad el peso total incluye grasa, así que sin el piso de 1,6
  //    la proteína quedaría corta (1,5 g/kg o menos).
  const proteinaBaseG = masaLibreGrasa !== null ? masaLibreGrasa : u.peso;
  const porMasaMagra = masaLibreGrasa !== null ? masaLibreGrasa * FACTOR_PROTEINA_MLG : 0;
  const porPesoTotal = u.peso * Math.max(FACTOR_PROTEINA_PESO_MIN, masaLibreGrasa !== null ? 0 : FACTOR_PROTEINA_PESO);
  const proteinaObjetivo = Math.max(porMasaMagra, porPesoTotal);
  const proteinaFactorGkg = proteinaObjetivo / proteinaBaseG;

  let targetProteinaG = redondear(proteinaObjetivo);
  const techoProteinaG = Math.floor((metaCalorica * TECHO_PROTEINA_PCT_KCAL) / 4);
  if (targetProteinaG > techoProteinaG) {
    avisos.push(
      `Proteína recortada de ${targetProteinaG} a ${techoProteinaG} g: el techo es ${TECHO_PROTEINA_PCT_KCAL * 100}% de las calorías.`,
    );
    targetProteinaG = techoProteinaG;
  }

  // 5) Grasa con piso hormonal
  let targetGrasaG = redondear(proteinaBaseG * FACTOR_GRASA_GKG);
  const pisoGrasaG = Math.ceil((metaCalorica * PISO_GRASA_PCT_KCAL) / 9);
  const techoGrasaG = Math.floor((metaCalorica * TECHO_GRASA_PCT_KCAL) / 9);
  if (targetGrasaG < pisoGrasaG) {
    avisos.push(
      `Grasa subida de ${targetGrasaG} a ${pisoGrasaG} g: piso hormonal del ${PISO_GRASA_PCT_KCAL * 100}% de las calorías.`,
    );
    targetGrasaG = pisoGrasaG;
  } else if (targetGrasaG > techoGrasaG) {
    avisos.push(
      `Grasa bajada de ${targetGrasaG} a ${techoGrasaG} g: techo del ${TECHO_GRASA_PCT_KCAL * 100}% de las calorías.`,
    );
    targetGrasaG = techoGrasaG;
  }

  // 6) Carbohidratos = resto
  const kcalRestantes = metaCalorica - targetProteinaG * 4 - targetGrasaG * 9;
  let targetCarbohidratosG = redondear(kcalRestantes / 4);
  if (targetCarbohidratosG < 0) {
    avisos.push(
      'Las calorías no alcanzan para proteína + grasa: revisá el déficit o el peso.',
    );
    targetCarbohidratosG = 0;
  }

  return {
    imc,
    clasificacionIMC,
    pesoIdeal,
    pesoAjustado,
    aplicaPesoAjustado,
    masaLibreGrasa,
    formulaTmb,
    tmb,
    tdee,
    factorActividad,
    factorActividadFuente,
    deficitPctUsado,
    metaCalorica,
    deficitKcal,
    proteinaBaseG,
    proteinaFactorGkg,
    targetProteinaG,
    targetGrasaG,
    targetCarbohidratosG,
    aguaLitros,
    avisos,
  };
}

/**
 * Estimación del % de grasa corporal por circunferencias (US Navy / Hodgdon-Beckett).
 * Sirve para NO inventar el dato: es el método gratuito más usado cuando no hay
 * DEXA ni pliegues. Error típico ±3-5 puntos.
 */
export interface EntradaNavy {
  cinturaCm: number;
  cuelloCm: number;
  tallaCm: number;
  sexo: 'H' | 'M';
  caderaCm?: number; // solo mujeres
}

export interface ResultadoNavy {
  grasaPct: number; // 0..1
  metodo: 'NAVY';
  aviso?: string;
}

export function estimarGrasaNavy(e: EntradaNavy): ResultadoNavy | null {
  const { cinturaCm, cuelloCm, tallaCm } = e;
  if (!Number.isFinite(cinturaCm) || !Number.isFinite(cuelloCm) || !Number.isFinite(tallaCm)) return null;
  if (tallaCm < 120 || tallaCm > 230) return null;
  if (cinturaCm < 50 || cinturaCm > 200) return null;
  if (cuelloCm < 20 || cuelloCm > 60) return null;
  if (cinturaCm <= cuelloCm + 5) return null;

  const log = Math.log10;
  let pct: number;
  if (e.sexo === 'H') {
    pct =
      495 / (1.0324 - 0.19077 * log(cinturaCm - cuelloCm) + 0.15456 * log(tallaCm)) - 450;
  } else {
    const cadera = e.caderaCm;
    if (!Number.isFinite(cadera as number)) return null;
    const c = cinturaCm + (cadera as number) - cuelloCm;
    if (c <= 5) return null;
    pct = 495 / (1.29579 - 0.35004 * log(c) + 0.221 * log(tallaCm)) - 450;
  }

  // pct viene en escala 0-100 -> se guarda como fracción 0-1 con 1 decimal de %.
  const grasaPct = Math.round(pct * 10) / 1000;
  return {
    grasaPct,
    metodo: 'NAVY',
    aviso:
      'Estimado por circunferencias (US Navy), no medido con DEXA: ±3-5 puntos de error.',
  };
}

/** Reparto calórico resultante, en % (para declararlo en la UI). */
export function repartoCalorico(t: MetabolicResult): {
  proteina: number;
  grasa: number;
  carbohidratos: number;
} {
  const total = t.targetProteinaG * 4 + t.targetGrasaG * 9 + t.targetCarbohidratosG * 4;
  if (total <= 0) return { proteina: 0, grasa: 0, carbohidratos: 0 };
  const pct = (n: number) => Math.round((n / total) * 1000) / 10;
  return {
    proteina: pct(t.targetProteinaG * 4),
    grasa: pct(t.targetGrasaG * 9),
    carbohidratos: pct(t.targetCarbohidratosG * 4),
  };
}
