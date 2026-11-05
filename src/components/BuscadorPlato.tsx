import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Plato } from '../logic/platos';

interface BuscadorPlatoProps {
  platos: Plato[];
  onElegir: (plato: Plato) => void;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Buscador del recetario: sin texto muestra TODOS los platos, alfabetico. */
export const BuscadorPlato: React.FC<BuscadorPlatoProps> = ({ platos, onElegir }) => {
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  const lista = useMemo(() => {
    const t = norm(q.trim());
    return platos
      .filter((p) => t.length < 2 || norm(p.nombre).includes(t))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [q, platos]);

  if (platos.length === 0) {
    return <p className="text-[11px] text-slate-500">Cargando recetario…</p>;
  }

  return (
    <div ref={ref} className="relative w-full">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setAbierto(true)}
        placeholder="Buscar plato (ej. arroz con pollo, ocopa, seco)..."
        className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 placeholder-slate-500 transition-colors"
      />
      {abierto && (
        <ul className="absolute z-50 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 text-sm divide-y divide-slate-700/50">
          <li className="sticky top-0 z-10 bg-slate-800 px-4 py-1.5 text-[10px] font-medium text-slate-400 border-b border-slate-700">
            {lista.length} platos · recetas caseras
          </li>
          {lista.map((p) => (
            <li
              key={p.id}
              onClick={() => {
                onElegir(p);
                setQ('');
                setAbierto(false);
              }}
              className="px-4 py-2.5 cursor-pointer text-slate-200 hover:bg-slate-700/60 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">🍲 {p.nombre}</span>
                <span className="shrink-0 text-[10px] text-slate-400">{p.grupo}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
