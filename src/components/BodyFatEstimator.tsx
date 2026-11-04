import React, { useState } from 'react';
import { estimarGrasaNavy, type ResultadoNavy } from '../logic/metabolism';

interface Props {
  talla: number;
  sexo: 'H' | 'M';
  onApply: (grasaPct: number) => void;
}

// Calculadora de % de grasa por circunferencias (US Navy). Existe para que el
// dato NO se invente: o lo medís (DEXA/pliegues/báscula buena) o lo estimás acá.
export const BodyFatEstimator: React.FC<Props> = ({ talla, sexo, onApply }) => {
  const [abierto, setAbierto] = useState(false);
  const [cintura, setCintura] = useState<string>('');
  const [cuello, setCuello] = useState<string>('');
  const [cadera, setCadera] = useState<string>('');
  const [resultado, setResultado] = useState<ResultadoNavy | null>(null);
  const [error, setError] = useState<string>('');

  const calcular = () => {
    setError('');
    const r = estimarGrasaNavy({
      cinturaCm: parseFloat(cintura),
      cuelloCm: parseFloat(cuello),
      tallaCm: talla,
      sexo,
      caderaCm: sexo === 'M' ? parseFloat(cadera) : undefined,
    });
    if (!r) {
      setResultado(null);
      setError(
        'Medidas fuera de rango o cintura menor que el cuello. Medí de nuevo: cintura a la altura del ombligo, cuello bajo la nuez.',
      );
      return;
    }
    setResultado(r);
    onApply(r.grasaPct);
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-1 text-[10px] text-brand-400 hover:text-brand-300 underline underline-offset-2"
      >
        No lo sé → calcular con cintura y cuello
      </button>
    );
  }

  return (
    <div className="mt-1.5 p-2 rounded-lg bg-slate-900/80 border border-slate-700 space-y-1.5">
      <div className="flex gap-1.5">
        <label className="flex-1">
          <span className="block text-[9px] text-slate-400">Cintura (cm)</span>
          <input
            type="number"
            inputMode="decimal"
            value={cintura}
            onChange={(e) => setCintura(e.target.value)}
            placeholder="115"
            className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-100 text-[11px] focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="flex-1">
          <span className="block text-[9px] text-slate-400">Cuello (cm)</span>
          <input
            type="number"
            inputMode="decimal"
            value={cuello}
            onChange={(e) => setCuello(e.target.value)}
            placeholder="44"
            className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-100 text-[11px] focus:border-brand-500 focus:outline-none"
          />
        </label>
        {sexo === 'M' && (
          <label className="flex-1">
            <span className="block text-[9px] text-slate-400">Cadera (cm)</span>
            <input
              type="number"
              inputMode="decimal"
              value={cadera}
              onChange={(e) => setCadera(e.target.value)}
              placeholder="105"
              className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-100 text-[11px] focus:border-brand-500 focus:outline-none"
            />
          </label>
        )}
      </div>

      <p className="text-[9px] leading-snug text-slate-500">
        Cintura: de pie, al final de una exhalación, a la altura del ombligo, sin apretar. Cuello: bajo la
        nuez. Repetí 3 veces y usá el promedio.
      </p>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={calcular}
          className="px-2 py-1 rounded bg-brand-500 hover:bg-brand-600 text-white text-[10px] font-semibold"
        >
          Calcular y usar
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError('');
          }}
          className="px-2 py-1 rounded border border-slate-700 text-slate-300 text-[10px]"
        >
          Cerrar
        </button>
      </div>

      {resultado && (
        <p className="text-[10px] text-emerald-400 font-semibold">
          {(resultado.grasaPct * 100).toFixed(1)} % aplicado. {resultado.aviso}
        </p>
      )}
      {error && <p className="text-[10px] text-rose-400">{error}</p>}
    </div>
  );
};
