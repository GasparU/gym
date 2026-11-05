import React, { useEffect, useMemo, useState } from 'react';
import type { FoodItem, MealType } from '../types/nutrition';
import {
  calcularPlato,
  factorParaPresupuesto,
  textoPorcion,
  MENSAJE_YA_HAY,
  type Plato,
  type PlatoCalculado,
  type RolPlato,
  type SeleccionPlato,
} from '../logic/platos';
import { numEs, numEsMax } from '../logic/formato';

interface PlatoModalProps {
  plato: Plato;
  foods: FoodItem[];
  kcalRestantes: number;
  mealTypeInicial: MealType;
  /** Comidas donde este rol (sopa / segundo) ya esta ocupado: no se puede repetir. */
  comidasOcupadas?: MealType[];
  onCerrar: () => void;
  onAgregar: (plato: Plato, calculado: PlatoCalculado, mealType: MealType) => void;
}

export const PlatoModal: React.FC<PlatoModalProps> = ({
  plato,
  foods,
  kcalRestantes,
  mealTypeInicial,
  comidasOcupadas = [],
  onCerrar,
  onAgregar,
}) => {
  const [extras, setExtras] = useState<string[]>([]);
  const [comida, setComida] = useState<MealType>(mealTypeInicial);
  const [opciones, setOpciones] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const o of plato.opciones ?? []) inicial[o.id] = o.porDefecto;
    return inicial;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCerrar]);

  const seleccion: SeleccionPlato = { extras, opciones };

  const base = useMemo(() => calcularPlato(plato, seleccion, foods, 1), [plato, extras, opciones, foods]);
  const factor = factorParaPresupuesto(base.totales.kcal, kcalRestantes);
  const calc = useMemo(() => calcularPlato(plato, seleccion, foods, factor), [plato, extras, opciones, foods, factor]);
  const rol: RolPlato = plato.grupo === 'Sopas' ? 'sopa' : 'segundo';
  const bloqueado = comidasOcupadas.includes(comida);

  const toggleExtra = (id: string) =>
    setExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Receta: ${plato.nombre}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-700 bg-slate-900/95 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-100 truncate">🍲 {plato.nombre}</h3>
            <p className="text-[10px] text-slate-400">{plato.grupo}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-4 py-3">
          {plato.nota && <p className="text-[11px] leading-snug text-slate-400">{plato.nota}</p>}

          {/* A que comida va */}
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-300">¿A qué comida lo sumás?</p>
            <div className="flex gap-1.5">
              {(['desayuno', 'almuerzo', 'cena'] as const).map((m) => {
                const ocupada = comidasOcupadas.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setComida(m)}
                    aria-pressed={comida === m}
                    disabled={ocupada}
                    title={ocupada ? MENSAJE_YA_HAY[rol] : undefined}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      ocupada
                        ? 'cursor-not-allowed border-slate-800 text-slate-600 line-through'
                        : comida === m
                          ? 'border-brand-500 bg-brand-500/20 text-brand-300'
                          : 'border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            {bloqueado && (
              <p role="status" className="mt-1.5 text-[10px] leading-snug text-amber-300">
                {MENSAJE_YA_HAY[rol]}
              </p>
            )}
          </div>

          {/* Opciones (sustituciones) */}
          {(plato.opciones ?? []).map((opcion) => (
            <div key={opcion.id}>
              <p className="mb-1 text-[11px] font-semibold text-slate-300">{opcion.etiqueta}</p>
              <div className="flex flex-wrap gap-1.5">
                {opcion.alternativas.map((alt) => {
                  const activa = opciones[opcion.id] === alt.id;
                  return (
                    <button
                      key={alt.id}
                      type="button"
                      onClick={() => setOpciones((p) => ({ ...p, [opcion.id]: alt.id }))}
                      aria-pressed={activa}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                        activa
                          ? 'border-emerald-600 bg-emerald-900/40 text-emerald-300'
                          : 'border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {alt.etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Ingredientes */}
          <div className="overflow-hidden rounded-lg border border-slate-700">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-800 text-slate-400">
                <tr>
                  <th className="px-2 py-1.5">Ingrediente</th>
                  <th className="px-2 py-1.5 text-right w-16">Gramos</th>
                  <th className="px-2 py-1.5 text-right w-16">Kcal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {calc.lineas.map((l, i) => (
                  <tr key={`${l.nombre}-${i}`} className="text-slate-300">
                    <td className="px-2 py-1.5">{l.nombre}</td>
                    <td className="px-2 py-1.5 text-right">{numEsMax(l.gramos, 1)}</td>
                    <td className="px-2 py-1.5 text-right">{numEs(l.kcal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Extras */}
          {(plato.extras ?? []).length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-300">¿Le pusiste algo más?</p>
              <div className="flex flex-wrap gap-1.5">
                {(plato.extras ?? []).map((extra) => {
                  const activo = extras.includes(extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      onClick={() => toggleExtra(extra.id)}
                      aria-pressed={activo}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                        activo
                          ? 'border-sky-600 bg-sky-900/40 text-sky-300'
                          : 'border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {activo ? '✓ ' : '+ '}
                      {extra.etiqueta.replace(/^\+\s*/, '')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observaciones: ingredientes que NO estan en la tabla */}
          {(plato.observaciones ?? []).length > 0 && (
            <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 p-2.5">
              <p className="text-[11px] font-semibold text-amber-300">⚠️ Ingrediente sin dato en la tabla</p>
              <ul className="mt-1 space-y-1">
                {(plato.observaciones ?? []).map((o) => (
                  <li key={o.ingrediente} className="text-[10px] leading-snug text-amber-200/90">
                    <b>{o.ingrediente}</b> ≈ {numEs(o.aproxKcal)} kcal · {o.detalle}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[10px] text-amber-200/70">
                No entra al total: pesalo aparte y agregalo como alimento.
              </p>
            </div>
          )}

          {/* Totales */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-slate-400">
                {textoPorcion(factor)} · {numEsMax(calc.gramos, 0)} g
              </span>
              <span className="text-lg font-bold text-emerald-300">{numEs(calc.totales.kcal)} kcal</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              P {numEsMax(calc.totales.proteinas, 1)} g · G {numEsMax(calc.totales.grasa, 1)} g · C{' '}
              {numEsMax(calc.totales.carbohidratos, 1)} g · fibra {numEsMax(calc.totales.fibra, 1)} g
            </p>
            {Math.abs(factor - 1) > 0.005 && (
              <p className="mt-1 text-[10px] text-sky-300/90">
                Porcion ajustada a lo que te queda hoy ({numEs(Math.max(0, kcalRestantes))} kcal).
              </p>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-slate-700 bg-slate-900/95 px-4 py-3">
          <button
            type="button"
            disabled={bloqueado}
            onClick={() => onAgregar(plato, calc, comida)}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              bloqueado
                ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                : 'bg-brand-500 text-white hover:bg-brand-600'
            }`}
          >
            {bloqueado
              ? `${comida} ya tiene ${rol}`
              : `Agregar a ${comida} · ${textoPorcion(factor)} · ${numEs(calc.totales.kcal)} kcal`}
          </button>
        </div>
      </div>
    </div>
  );
};
