import React, { useState, useEffect } from 'react';

interface Props {
  exerciseName?: string;
  defaultWeight?: number;
  defaultReps?: number;
}

export const PyramidStrengthCalculator: React.FC<Props> = ({
  exerciseName = 'Press de banca horizontal',
  defaultWeight = 40,
  defaultReps = 10
}) => {
  const [pesoTest, setPesoTest] = useState<number>(defaultWeight);
  const [repsTest, setRepsTest] = useState<number>(defaultReps);
  const [targetPct, setTargetPct] = useState<number>(0.7); // 70% Hipertrofia

  // 🔥 SOLUCIÓN AL BUG: Sincronizar el estado interno cuando cambian las props al dar clic en "Calcular"
  useEffect(() => {
    setPesoTest(defaultWeight);
    setRepsTest(defaultReps);
  }, [defaultWeight, defaultReps, exerciseName]);

  const p = Math.max(0, Number(pesoTest) || 0);
  const r = Math.max(1, Number(repsTest) || 1);

  // Fórmulas oficiales de los 7 autores
  const rmEpley = Math.round(p * (1 + 0.033 * r));
  const rmLander = Math.round((100 * p) / (101.3 - 2.67123 * r));
  const rmOconner = Math.round(p * (1 + 0.025 * r));
  const rmLombardi = Math.round(p * Math.pow(r, 0.1));
  const rmMayhew = Math.round((100 * p) / (52.2 + 41.9 * Math.exp(-0.055 * r)));
  const rmBrzycki = Math.round(p / (1.0278 - 0.0278 * r));
  const rmWathen = Math.round((100 * p) / (48.8 + 53.8 * Math.exp(-0.075 * r)));

  const rmPromedio = Math.round(
    (rmEpley + rmLander + rmOconner + rmLombardi + rmMayhew + rmBrzycki + rmWathen) / 7
  );

  const pesoRealCargar = (rmPromedio * targetPct).toFixed(1);

  return (
    <div className="bg-slate-900 border-2 border-brand-500/40 rounded-xl p-6 shadow-2xl space-y-6">
      {/* Cabecera con datos reactivos destacados */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-4 border-b border-slate-800 gap-3">
        <div>
          <span className="text-[10px] bg-brand-900/60 text-brand-300 border border-brand-700/60 px-2 py-0.5 rounded font-bold uppercase">
            Calculadora Activa
          </span>
          <h3 className="text-lg font-bold text-slate-100 mt-1">
            {exerciseName}
          </h3>
          <p className="text-xs text-slate-400">
            Valores transferidos: <strong className="text-emerald-400">{p} kg</strong> a <strong className="text-emerald-400">{r} repeticiones</strong>
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold">1RM Promedio</span>
            <span className="text-2xl font-mono font-bold text-brand-400">{rmPromedio} kg</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Carga al {(targetPct * 100).toFixed(0)}%</span>
            <span className="text-2xl font-mono font-bold text-emerald-400">{pesoRealCargar} kg</span>
          </div>
        </div>
      </div>

      {/* Inputs sincronizados */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
        <div>
          <label className="text-slate-400 block mb-1 font-semibold">Peso Levantado (kg)</label>
          <input
            type="number"
            value={pesoTest}
            onChange={(e) => setPesoTest(parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-slate-100 font-bold focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-slate-400 block mb-1 font-semibold">Reps al Fallo Técnico</label>
          <input
            type="number"
            value={repsTest}
            onChange={(e) => setRepsTest(parseInt(e.target.value, 10) || 1)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-slate-100 font-bold focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-slate-400 block mb-1 font-semibold">Zona de Estímulo</label>
          <select
            value={targetPct}
            onChange={(e) => setTargetPct(parseFloat(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 text-brand-400 font-bold rounded px-2.5 py-1.5 focus:outline-none"
          >
            <option value={0.9}>90% - Fuerza Máxima (1-5 reps)</option>
            <option value={0.85}>85% - Fuerza Máxima</option>
            <option value={0.8}>80% - Hipertrofia Pesada</option>
            <option value={0.75}>75% - Hipertrofia</option>
            <option value={0.7}>70% - Hipertrofia Estándar (Tu Rango)</option>
            <option value={0.65}>65% - Hipertrofia Ligera</option>
            <option value={0.5}>50% - Fuerza Resistencia (12-25 reps)</option>
          </select>
        </div>
      </div>

      {/* Gráfico SVG de la Pirámide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 flex justify-center">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-inner w-full max-w-[460px]">
            <svg viewBox="0 0 600 520" className="w-full h-auto select-none">
              {/* PORCENTAJES LATERALES */}
              <text x="260" y="38" textAnchor="end" fill="#fca5a5" fontSize="15" fontWeight="bold">100%</text>
              <text x="340" y="38" textAnchor="start" fill="#fca5a5" fontSize="15" fontWeight="bold">100%</text>
              <text x="240" y="78" textAnchor="end" fill="#fca5a5" fontSize="14" fontWeight="600">95%</text>
              <text x="360" y="78" textAnchor="start" fill="#fca5a5" fontSize="14" fontWeight="600">95%</text>
              <text x="220" y="118" textAnchor="end" fill="#fca5a5" fontSize="14" fontWeight="600">90%</text>
              <text x="380" y="118" textAnchor="start" fill="#fca5a5" fontSize="14" fontWeight="600">90%</text>
              <text x="200" y="158" textAnchor="end" fill="#fca5a5" fontSize="14" fontWeight="600">85%</text>
              <text x="400" y="158" textAnchor="start" fill="#fca5a5" fontSize="14" fontWeight="600">85%</text>

              {/* NIVEL 1: FUERZA MÁXIMA */}
              <polygon
                points="300,30 231,160 369,160"
                fill="#EF5350"
                onClick={() => setTargetPct(0.9)}
                className={`cursor-pointer transition-all duration-200 stroke-slate-900 stroke-2 ${
                  targetPct >= 0.85 ? 'filter drop-shadow(0 0 12px rgba(239,83,80,0.9)) brightness-110' : 'opacity-85 hover:opacity-100'
                }`}
              />
              <text x="300" y="85" textAnchor="middle" fill="#ffffff" fontSize="20" fontWeight="bold">Fuerza</text>
              <text x="300" y="112" textAnchor="middle" fill="#ffffff" fontSize="20" fontWeight="bold">Máxima</text>
              <text x="300" y="142" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">1-5 rep    +3 min</text>

              {/* PORCENTAJES LATERALES HIPERTROFIA */}
              <text x="180" y="195" textAnchor="end" fill="#fdba74" fontSize="14" fontWeight="600">80%</text>
              <text x="420" y="195" textAnchor="start" fill="#fdba74" fontSize="14" fontWeight="600">80%</text>
              <text x="160" y="230" textAnchor="end" fill="#fdba74" fontSize="14" fontWeight="600">75%</text>
              <text x="440" y="230" textAnchor="start" fill="#fdba74" fontSize="14" fontWeight="600">75%</text>
              <text x="145" y="265" textAnchor="end" fill="#fdba74" fontSize="14" fontWeight="bold">70%</text>
              <text x="455" y="265" textAnchor="start" fill="#fdba74" fontSize="14" fontWeight="bold">70%</text>
              <text x="130" y="295" textAnchor="end" fill="#fdba74" fontSize="14" fontWeight="600">65%</text>
              <text x="470" y="295" textAnchor="start" fill="#fdba74" fontSize="14" fontWeight="600">65%</text>
              <text x="115" y="325" textAnchor="end" fill="#fdba74" fontSize="14" fontWeight="600">60%</text>
              <text x="485" y="325" textAnchor="start" fill="#fdba74" fontSize="14" fontWeight="600">60%</text>

              {/* NIVEL 2: HIPERTROFIA */}
              <polygon
                points="223,175 377,175 455,320 145,320"
                fill="#FFB74D"
                onClick={() => setTargetPct(0.7)}
                className={`cursor-pointer transition-all duration-200 stroke-slate-900 stroke-2 ${
                  targetPct >= 0.6 && targetPct < 0.85 ? 'filter drop-shadow(0 0 14px rgba(255,183,77,0.95)) brightness-110' : 'opacity-85 hover:opacity-100'
                }`}
              />
              <text x="300" y="245" textAnchor="middle" fill="#000000" fontSize="34" fontWeight="900" letterSpacing="-0.5">
                Hipertrofia
              </text>
              <text x="300" y="285" textAnchor="middle" fill="#1e293b" fontSize="15" fontWeight="bold">
                6-12 repeticiones   1-2 min descanso
              </text>

              {/* PORCENTAJES LATERALES RESISTENCIA */}
              <text x="105" y="360" textAnchor="end" fill="#bef264" fontSize="14" fontWeight="600">55%</text>
              <text x="495" y="360" textAnchor="start" fill="#bef264" fontSize="14" fontWeight="600">55%</text>
              <text x="85" y="400" textAnchor="end" fill="#bef264" fontSize="14" fontWeight="600">50%</text>
              <text x="515" y="400" textAnchor="start" fill="#bef264" fontSize="14" fontWeight="600">50%</text>
              <text x="65" y="440" textAnchor="end" fill="#bef264" fontSize="14" fontWeight="600">45%</text>
              <text x="535" y="440" textAnchor="start" fill="#bef264" fontSize="14" fontWeight="600">45%</text>
              <text x="40" y="480" textAnchor="end" fill="#bef264" fontSize="14" fontWeight="bold">40%</text>
              <text x="560" y="480" textAnchor="start" fill="#bef264" fontSize="14" fontWeight="bold">40%</text>

              {/* NIVEL 3: FUERZA DE RESISTENCIA */}
              <polygon
                points="137,335 463,335 540,480 60,480"
                fill="#D4E157"
                onClick={() => setTargetPct(0.5)}
                className={`cursor-pointer transition-all duration-200 stroke-slate-900 stroke-2 ${
                  targetPct < 0.6 ? 'filter drop-shadow(0 0 12px rgba(212,225,87,0.9)) brightness-110' : 'opacity-85 hover:opacity-100'
                }`}
              />
              <text x="300" y="405" textAnchor="middle" fill="#000000" fontSize="30" fontWeight="900" letterSpacing="-0.5">
                Fuerza de resistencia
              </text>
              <text x="300" y="445" textAnchor="middle" fill="#1e293b" fontSize="15" fontWeight="bold">
                12-25 repeticiones   30-60 seg descanso
              </text>
            </svg>
          </div>
        </div>

        {/* Tabla Oficial de los 7 Autores */}
        <div className="lg:col-span-5 space-y-3 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase font-bold block mb-2">
              Cálculo de los 7 Autores (Carga al {(targetPct * 100).toFixed(0)}%)
            </span>
            <table className="w-full text-left font-mono">
              <thead className="text-slate-500 border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="py-1">Autor</th>
                  <th className="py-1 text-right">1RM</th>
                  <th className="py-1 text-right text-emerald-400">A Cargar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr><td className="py-1.5 font-sans">Epley y Welday</td><td className="text-right">{rmEpley} kg</td><td className="text-right text-emerald-400 font-bold">{(rmEpley * targetPct).toFixed(1)} kg</td></tr>
                <tr><td className="py-1.5 font-sans">Lander</td><td className="text-right">{rmLander} kg</td><td className="text-right text-emerald-400 font-bold">{(rmLander * targetPct).toFixed(1)} kg</td></tr>
                <tr><td className="py-1.5 font-sans">O'conner</td><td className="text-right">{rmOconner} kg</td><td className="text-right text-emerald-400 font-bold">{(rmOconner * targetPct).toFixed(1)} kg</td></tr>
                <tr><td className="py-1.5 font-sans">Lombardi</td><td className="text-right">{rmLombardi} kg</td><td className="text-right text-emerald-400 font-bold">{(rmLombardi * targetPct).toFixed(1)} kg</td></tr>
                <tr><td className="py-1.5 font-sans">Mayhew</td><td className="text-right">{rmMayhew} kg</td><td className="text-right text-emerald-400 font-bold">{(rmMayhew * targetPct).toFixed(1)} kg</td></tr>
                <tr><td className="py-1.5 font-sans">Brzycki</td><td className="text-right">{rmBrzycki} kg</td><td className="text-right text-emerald-400 font-bold">{(rmBrzycki * targetPct).toFixed(1)} kg</td></tr>
                <tr><td className="py-1.5 font-sans">Wathen</td><td className="text-right">{rmWathen} kg</td><td className="text-right text-emerald-400 font-bold">{(rmWathen * targetPct).toFixed(1)} kg</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};