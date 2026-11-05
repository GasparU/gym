import React, { useState, useEffect, useRef } from 'react';
import type { FoodItem } from '../types/nutrition';
import { EstadoAlimento } from './EstadoAlimento';
import { numEs, numEsMax } from '../logic/formato';

interface AutocompleteProps {
  foods: FoodItem[];
  onSelectFood: (food: FoodItem) => void;
  placeholder?: string;
}

// Con texto: sugerencias acotadas (no saturar). Solo con filtros: TODOS.
const MAX_CON_TEXTO = 10;
const MAX_SOLO_FILTROS = 500;

// Normaliza texto para búsqueda sin tildes ni mayúsculas
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const AutocompleteFood: React.FC<AutocompleteProps> = ({
  foods,
  onSelectFood,
  placeholder = 'Buscar alimento (ej. Pollo, Arroz, Lentejas)...',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [ayuda, setAyuda] = useState(false);
  const [filtroSaciedad, setFiltroSaciedad] = useState(false);
  const [filtroProteina, setFiltroProteina] = useState(false);
  const [filtroFibra, setFiltroFibra] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hayFiltro = filtroSaciedad || filtroProteina || filtroFibra;
  const soloFiltros = hayFiltro && query.trim().length < 2;

  useEffect(() => {
    const q = normalize(query.trim());

    if (q.length < 2 && !hayFiltro) {
      setResults([]);
      setTotal(0);
      setIsOpen(false);
      return;
    }

    const coincide = foods.filter((item) => {
      if (q.length >= 2 && !normalize(item.nombre).includes(q)) return false;
      if (filtroSaciedad && item.saciedad !== 'Alta') return false;
      if (filtroProteina && !item.altoProteina) return false;
      if (filtroFibra && !item.altaFibra) return false;
      return true;
    });

    // Con texto: el orden del catálogo. Solo con filtros: TODO, alfabético.
    const ordenados =
      q.length >= 2 ? coincide : [...coincide].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const visibles = q.length >= 2 ? ordenados.slice(0, MAX_CON_TEXTO) : ordenados.slice(0, MAX_SOLO_FILTROS);

    setResults(visibles);
    setTotal(ordenados.length);
    setIsOpen(visibles.length > 0);
    setHighlightedIndex(-1);
  }, [query, foods, hayFiltro, filtroSaciedad, filtroProteina, filtroFibra]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: FoodItem) => {
    onSelectFood(item);
    setQuery('');
    setIsOpen(hayFiltro); // si estás filtrando, dejá la lista abierta para seguir cargando
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        handleSelect(results[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {[
          { on: filtroSaciedad, set: setFiltroSaciedad, label: 'Llena más' },
          { on: filtroProteina, set: setFiltroProteina, label: '+ Proteína' },
          { on: filtroFibra, set: setFiltroFibra, label: '+ Fibra' },
        ].map(({ on, set, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => set((v) => !v)}
            aria-pressed={on}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              on
                ? 'border-emerald-600 bg-emerald-900/40 text-emerald-300'
                : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
        {hayFiltro && (
          <span className="self-center text-[10px] text-slate-400">
            {numEs(total)} {total === 1 ? 'alimento' : 'alimentos'}
          </span>
        )}
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (hayFiltro && results.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 placeholder-slate-500 transition-colors"
      />

      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span>Pesá crudo lo que sale de la bolsa · si el nombre dice COCIDO, pesá el plato</span>
        <button
          type="button"
          onClick={() => setAyuda((v) => !v)}
          aria-expanded={ayuda}
          className="shrink-0 underline hover:text-slate-300"
        >
          {ayuda ? 'Ocultar guía' : '¿Cómo elijo?'}
        </button>
      </div>

      {ayuda && (
        <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/80 p-3 text-[11px] leading-relaxed text-slate-300 space-y-1.5">
          <p className="font-semibold text-slate-200">Guía rápida</p>
          <p>
            <b>1.</b> ¿Pesás lo que sale de la bolsa? Elegí{' '}
            <span className="text-blue-300 font-semibold">CRUDO</span>.
          </p>
          <p>
            <b>2.</b> ¿Pesás el plato servido? Elegí{' '}
            <span className="text-amber-300 font-semibold">COCIDO</span>.
          </p>
          <p>
            <b>3.</b> Las kcal son por 100 g: 300 o más = crudo; 100-160 = cocido (tiene agua).
          </p>
          <p>
            <b>4.</b> La app tiene <b>ingredientes</b>, no platos. Un guiso = trigo + aceite + carne,
            cada uno por separado.
          </p>
          <p className="border-t border-slate-700 pt-1.5">
            <b>Ejemplo — "segundo de trigo":</b> elegí <i>Trigo, mote de (sancochado)</i> (COCIDO, 154
            kcal) y cargá el aceite y la carne aparte.
          </p>
        </div>
      )}

      {isOpen && (
        <ul className="absolute z-50 left-0 right-0 mt-1.5 max-h-72 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 text-sm divide-y divide-slate-700/50">
          {soloFiltros && (
            <li className="sticky top-0 z-10 bg-slate-800 px-4 py-1.5 text-[10px] font-medium text-slate-400 border-b border-slate-700">
              {numEs(total)} alimentos con ese filtro · orden alfabético
            </li>
          )}
          {results.map((item, idx) => {
            const isSelected = idx === highlightedIndex;
            return (
              <li
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-4 py-2.5 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                  isSelected ? 'bg-slate-700 text-emerald-400' : 'text-slate-200 hover:bg-slate-700/60'
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-medium">{item.nombre}</span>
                  <span className="text-xs text-slate-400">
                    P: {numEsMax(item.proteinas, 1)}g | C: {numEsMax(item.carbohidratosTotales, 1)}g | G:{' '}
                    {numEsMax(item.grasaTotal, 1)}g (por 100 g)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Llena:{' '}
                    <b
                      className={
                        item.saciedad === 'Alta'
                          ? 'text-emerald-300'
                          : item.saciedad === 'Baja'
                            ? 'text-slate-400'
                            : 'text-slate-200'
                      }
                    >
                      {item.saciedad ?? 'sin dato'}
                    </b>{' '}
                    · fibra {numEsMax(item.fibra, 1)} g · {numEs(item.energiaKcal)} kcal/100 g
                  </span>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {item.glucemia === 'Alta' && (
                      <span className="rounded bg-amber-900/50 px-1 py-px text-[9px] font-semibold text-amber-300">
                        Sube azúcar
                      </span>
                    )}
                    {item.altoProteina && (
                      <span className="rounded bg-sky-900/50 px-1 py-px text-[9px] font-semibold text-sky-300">
                        Prot.
                      </span>
                    )}
                    {item.altaFibra && (
                      <span className="rounded bg-teal-900/50 px-1 py-px text-[9px] font-semibold text-teal-300">
                        Fibra
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <EstadoAlimento esCocido={item.esCocido} />
                  <span className="text-xs font-semibold text-slate-300">{item.energiaKcal} kcal</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
