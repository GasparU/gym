export interface UserProfile {
  peso: number; // kg (ej. 98)
  talla: number; // cm (ej. 175)
  edad: number; // años (ej. 44)
  sexo: 'H' | 'M';
  diasEntrenamiento: number; // 3
  imcIdeal?: number; // 24
  deficitPct?: number; // 0.15 (15%)
}

export interface MetabolicResult {
  imc: number;
  clasificacionIMC: string;
  pesoIdeal: number;
  pesoAjustado: number;
  aplicaPesoAjustado: boolean;
  tmb: number;
  tdee: number;
  factorActividad: number;
  metaCalorica: number;
  targetProteinaG: number;
  targetGrasaG: number;
  targetCarbohidratosG: number;
}

export function calculateMetabolicTargets(u: UserProfile): MetabolicResult {
  const tallaM = u.talla / 100;
  const imc = parseFloat((u.peso / (tallaM * tallaM)).toFixed(2));
  const imcIdeal = u.imcIdeal || 24;
  const pesoIdeal = parseFloat((imcIdeal * (tallaM * tallaM)).toFixed(2));

  // Clasificación clínica
  let clasificacionIMC = 'Normal';
  if (imc < 18.5) clasificacionIMC = 'Bajo Peso';
  else if (imc < 25) clasificacionIMC = 'Peso Ideal';
  else if (imc < 30) clasificacionIMC = 'Sobrepeso';
  else if (imc < 35) clasificacionIMC = 'Obesidad Tipo I';
  else clasificacionIMC = 'Obesidad Tipo II';

  // Decisión clínica: IMC >= 30 utiliza Peso Ajustado para no sobreestimar la grasa inactiva
  const aplicaPesoAjustado = imc >= 30;
  const pesoAjustado = parseFloat((pesoIdeal + 0.25 * (u.peso - pesoIdeal)).toFixed(2));
  const pesoCalculo = aplicaPesoAjustado ? pesoAjustado : u.peso;

  // Mifflin-St Jeor
  const constSexo = u.sexo === 'H' ? 5 : -161;
  const tmb = Math.round(10 * pesoCalculo + 6.25 * u.talla - 5 * u.edad + constSexo);

  // Factor de Actividad (PAL) según días de entrenamiento
  let factorActividad = 1.2;
  if (u.diasEntrenamiento >= 2 && u.diasEntrenamiento <= 3) factorActividad = 1.375;
  else if (u.diasEntrenamiento >= 4 && u.diasEntrenamiento <= 5) factorActividad = 1.55;
  else if (u.diasEntrenamiento > 5) factorActividad = 1.725;

  const tdee = Math.round(tmb * factorActividad);
  const deficit = u.deficitPct !== undefined ? u.deficitPct : 0.15;
  const metaCalorica = Math.round(tdee * (1 - deficit));

  // Distribución coherente para Recomposición Corporal:
  // Proteína: 2.0 g/kg de peso ajustado
  const targetProteinaG = Math.round(pesoCalculo * 2.0);
  // Grasas: 0.75 g/kg de peso ajustado
  const targetGrasaG = Math.round(pesoCalculo * 0.75);
  // Carbohidratos: el resto calórico dividido por 4
  const targetCarbohidratosG = Math.round((metaCalorica - (targetProteinaG * 4 + targetGrasaG * 9)) / 4);

  return {
    imc,
    clasificacionIMC,
    pesoIdeal,
    pesoAjustado,
    aplicaPesoAjustado,
    tmb,
    tdee,
    factorActividad,
    metaCalorica,
    targetProteinaG,
    targetGrasaG,
    targetCarbohidratosG
  };
}