import React, { useState } from 'react';

interface Props {
  edad: number;
}

export const CardioStrengthCalculator: React.FC<Props> = ({ edad }) => {
  // Fórmulas de FC Máxima según tu Excel
  const fcmTanaka = Math.round(208.75 - 0.7 * edad);
  const fcmTradicional = 220 - edad;
  const fcmGulati = Math.round(206 - 0.88 * edad);

  // Estado para la Calculadora de 1RM
  const [pesoTest, setPesoTest] = useState<number>(40);
  const [repsTest, setRepsTest] = useState<number>(14);
  const [porcentajeCarga, setPorcentajeCarga] = useState<number>(0.7); // 70% Hipertrofia por defecto

  // Cálculo de los 7 autores de tu hoja "Fuerza Máxima"
  const r = repsTest;
  const p = pesoTest;

  const rmEpley = r > 0 ? Math.round(p * (1 + 0.033 * r)) : 0;
  const rmLander = r > 0 ? Math.round((100 * p) / (101.3 - 2.67123 * r)) : 0;
  const rmOconner = r > 0 ? Math.round(p * (1 + 0.025 * r)) : 0;
  const rmLombardi = r > 0 ? Math.round(p * Math.pow(r, 0.1)) : 0;
  const rmMayhew = r > 0 ? Math.round((100 * p) / (52.2 + 41.9 * Math.exp(-0.055 * r))) : 0;
  const rmBrzycki = r > 0 ? Math.round(p / (1.0278 - 0.0278 * r)) : 0;
  const rmWathen = r > 0 ? Math.round((100 * p) / (48.8 + 53.8 * Math.exp(-0.075 * r))) : 0;

  const autores = [
    { autor: 'Epley y Welday (1985)', rm: rmEpley, pesoReal: (rmEpley * porcentajeCarga).toFixed(1) },
    { autor: 'Lander', rm: rmLander, pesoReal: (rmLander * porcentajeCarga).toFixed(1) },
    { autor: "O'conner", rm: rmOconner, pesoReal: (rmOconner * porcentajeCarga).toFixed(1) },
    { autor: 'Lombardi', rm: rmLombardi, pesoReal: (rmLombardi * porcentajeCarga).toFixed(1) },
    { autor: 'Mayhew', rm: rmMayhew, pesoReal: (rmMayhew * porcentajeCarga).toFixed(1) },
    { autor: 'Brzycki', rm: rmBrzycki, pesoReal: (rmBrzycki * porcentajeCarga).toFixed(1) },
    { autor: 'Wathen', rm: rmWathen, pesoReal: (rmWathen * porcentajeCarga).toFixed(1) }
  ];

  const rmPromedio = Math.round(
    autores.reduce((acc, curr) => acc + curr.rm, 0) / autores.length
  );
  const cargaRecomendada = (rmPromedio * porcentajeCarga).toFixed(1);

  // Zonas de Frecuencia Cardíaca
  const zonasFC = [
    {
      zona: 'MÁXIMO (90 - 100%)',
      rango: `${Math.round(fcmTanaka * 0.9)} - ${fcmTanaka} ppm`,
      beneficio: 'Mejora velocidad y sistema neuromuscular (Efecto EPOC)',
      combustible: 'Fosfato de creatina',
      actividad: 'Carrera o ciclismo de sprint intenso',
      alerta: 'No apto para hipertensos ni exceso de peso'
    },
    {
      zona: 'INTENSO (80 - 90%)',
      rango: `${Math.round(fcmTanaka * 0.8)} - ${Math.round(fcmTanaka * 0.9)} ppm`,
      beneficio: 'Resistencia anaeróbica en sesiones cortas',
      combustible: 'Glucógeno intramuscular',
      actividad: 'Trote o circuito intenso',
      alerta: 'Máximo 1 a 2 veces por semana intercalado'
    },
    {
      zona: 'MODERADO (70 - 80%)',
      rango: `${Math.round(fcmTanaka * 0.7)} - ${Math.round(fcmTanaka * 0.8)} ppm`,
      beneficio: 'Resistencia aeróbica y capacidad cardiovascular',
      combustible: 'Glucógeno principalmente y Grasa',
      actividad: 'Trote suave continuo, elíptica',
      alerta: 'Base de entrenamiento cardiovascular'
    },
    {
      zona: 'SUAVE (60 - 70%) 🔥',
      rango: `${Math.round(fcmTanaka * 0.6)} - ${Math.round(fcmTanaka * 0.7)} ppm`,
      beneficio: 'Oxidación pura de grasas y desinflamación',
      combustible: 'Grasas libres (Adipocitos)',
      actividad: 'Caminar ligeramente rápido, bici estacionaria suave',
      alerta: 'Zona diana para reducir vientre sin fatiga'
    },
    {
      zona: 'MUY SUAVE (50 - 60%)',
      rango: `${Math.round(fcmTanaka * 0.5)} - ${Math.round(fcmTanaka * 0.6)} ppm`,
      beneficio: 'Recuperación activa y salud regenerativa',
      combustible: 'Grasas',
      actividad: 'Caminata lenta de descanso',
      alerta: 'Post-esfuerzo o días de descanso total'
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. SECCIÓN DE FRECUENCIA CARDÍACA */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>❤️</span> Tabla de Frecuencia Cardíaca & Zonas de Combustible
            </h3>
            <p className="text-xs text-slate-400">
              Cálculo para {edad} años basado en la fórmula oficial Tanaka 2001
            </p>
          </div>
          <div className="flex gap-2">
            <span className="text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-700/60 px-2.5 py-1 rounded font-mono font-bold">
              Tanaka: {fcmTanaka} ppm
            </span>
            <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded font-mono">
              Tradicional: {fcmTradicional} ppm
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Zona / Intensidad</th>
                <th className="py-2.5 px-3 text-emerald-400">Rango Pulso</th>
                <th className="py-2.5 px-3">Combustible Principal</th>
                <th className="py-2.5 px-3">Actividad Sugerida</th>
                <th className="py-2.5 px-3">Criterio Clínico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {zonasFC.map((z, idx) => {
                const isFatBurn = z.zona.includes('SUAVE (60 - 70%)');
                return (
                  <tr key={idx} className={isFatBurn ? 'bg-emerald-950/20 font-medium' : 'hover:bg-slate-800/30'}>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">{z.zona}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{z.rango}</td>
                    <td className="py-2.5 px-3 text-amber-300">{z.combustible}</td>
                    <td className="py-2.5 px-3">{z.actividad}</td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-400">{z.alerta}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. CALCULADORA 1RM CON LOS 7 AUTORES */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>🔺</span> Pirámide de Fuerza Máxima (1RM) según los 7 Autores
            </h3>
            <p className="text-xs text-slate-400">
              Determina la carga exacta en kg según el porcentaje del estímulo objetivo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Objetivo:</label>
            <select
              value={porcentajeCarga}
              onChange={(e) => setPorcentajeCarga(parseFloat(e.target.value))}
              className="bg-slate-950 border border-slate-700 text-brand-400 text-xs rounded px-2 py-1 font-bold focus:outline-none"
            >
              <option value={0.65}>65% - Hipertrofia Ligera / Bombeo</option>
              <option value={0.7}>70% - Hipertrofia Estándar (Tu rango)</option>
              <option value={0.75}>75% - Hipertrofia Densa (8-10 reps)</option>
              <option value={0.85}>85% - Fuerza Máxima (3-5 reps)</option>
            </select>
          </div>
        </div>

        {/* Inputs de Entrada */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <div>
            <label className="text-slate-400 text-xs block mb-1">Peso Cargado en Test (kg)</label>
            <input
              type="number"
              value={pesoTest}
              onChange={(e) => setPesoTest(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded px-3 py-1.5 text-xs font-semibold focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs block mb-1">Reps al Fallo Técnico</label>
            <input
              type="number"
              value={repsTest}
              onChange={(e) => setRepsTest(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded px-3 py-1.5 text-xs font-semibold focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="bg-brand-950/40 border border-brand-800/60 p-2.5 rounded flex flex-col justify-center">
            <span className="text-[10px] text-brand-400 uppercase font-bold tracking-wide">
              Carga Recomendada ({(porcentajeCarga * 100).toFixed(0)}%)
            </span>
            <span className="text-xl font-mono font-bold text-brand-300">
              {cargaRecomendada} kg
            </span>
            <span className="text-[10px] text-slate-400">1RM Promedio: {rmPromedio} kg</span>
          </div>
        </div>

        {/* Tabla Comparativa de Fórmulas */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-2 px-3">Autor de la Fórmula</th>
                <th className="py-2 px-3 text-right">1RM Estimado</th>
                <th className="py-2 px-3 text-right">Porcentaje</th>
                <th className="py-2 px-3 text-right text-brand-400 font-bold">Peso Real a Cargar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {autores.map((a, i) => (
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 font-medium text-slate-200">{a.autor}</td>
                  <td className="py-2 px-3 text-right font-mono">{a.rm} kg</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-400">
                    {(porcentajeCarga * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-brand-400">
                    {a.pesoReal} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};