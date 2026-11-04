import React, { useState, useEffect, useRef } from 'react';
import type { FoodItem } from '../types/nutrition';
import { EstadoAlimento } from './EstadoAlimento';

interface AutocompleteProps {
  foods: FoodItem[];
  onSelectFood: (food: FoodItem) => void;
  placeholder?: string;
}

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
  placeholder = 'Buscar alimento (ej. Pollo, Arroz, Lentejas)...'
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [ayuda, setAyuda] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = normalize(query.trim());
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const filtered = foods
      .filter((item) => normalize(item.nombre).includes(q))
      .slice(0, 10); // Límite de 10 resultados para rendimiento visual

    setResults(filtered);
    setIsOpen(filtered.length > 0);
    setHighlightedIndex(-1);
  }, [query, foods]);

  // Cierre al hacer clic fuera del componente
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
    setIsOpen(false);
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
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 placeholder-slate-500 transition-colors"
      />

                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>
              Pesá crudo lo que sale de la bolsa · si el nombre dice COCIDO, pesá el plato
            </span>
            <button
              type="button"
              onClick={() => setAyuda((v) => !v)}
              aria-expanded={ayuda}
              className="shrink-0 underline hover:text-slate-300"
            >
              {ayuda ? "Ocultar guía" : "¿Cómo elijo?"}
            </button>
          </div>
          {ayuda && (
            <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/80 p-3 text-[11px] leading-relaxed text-slate-300 space-y-1.5">
              <p className="font-semibold text-slate-200">Guía rápida</p>
              <p>
                <b>1.</b> ¿Pesás lo que sale de la bolsa? Elegí{" "}
                <span className="text-blue-300 font-semibold">CRUDO</span>.
              </p>
              <p>
                <b>2.</b> ¿Pesás el plato servido? Elegí{" "}
                <span className="text-amber-300 font-semibold">COCIDO</span>.
              </p>
              <p>
                <b>3.</b> Las kcal son por 100 g: 300 o más = crudo; 100-160 = cocido (tiene agua).
              </p>
              <p>
                <b>4.</b> La app tiene <b>ingredientes</b>, no platos. Un guiso = trigo + aceite +
                carne, cada uno por separado.
              </p>
              <p className="border-t border-slate-700 pt-1.5">
                <b>Ejemplo — "segundo de trigo":</b> elegí{" "}
                <i>Trigo, mote de (sancochado)</i> (COCIDO, 154 kcal) y cargá el aceite y la carne
                aparte.
              </p>
            </div>
          )}
          {isOpen && (
        <ul className="absolute z-50 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 text-sm divide-y divide-slate-700/50">
          {results.map((item, idx) => {
            const isSelected = idx === highlightedIndex;
            return (
              <li
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-4 py-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                  isSelected ? 'bg-slate-700 text-emerald-400' : 'text-slate-200 hover:bg-slate-700/60'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{item.nombre}</span>
                  <span className="text-xs text-slate-400">
                    P: {item.proteinas}g | C: {item.carbohidratosTotales}g | G: {item.grasaTotal}g (por 100g)
                  </span>
                </div>
                <div className="flex items-center gap-2">

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