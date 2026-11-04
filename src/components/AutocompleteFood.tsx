import React, { useState, useEffect, useRef } from 'react';
import type { FoodItem } from '../types/nutrition';

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
                  {item.esCocido ? (
                    <span className="text-[10px] bg-amber-900/60 text-amber-300 border border-amber-700/50 px-1.5 py-0.5 rounded uppercase font-semibold">
                      Cocido
                    </span>
                  ) : (
                    <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded uppercase font-semibold">
                      Crudo
                    </span>
                  )}
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