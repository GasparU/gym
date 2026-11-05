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
  onAgregar: (
plato: Plato,
calculado: PlatoCalculado,
mealType: MealType,
ajustes?: Record<string, number>,
  ) => void;
  /** Desglose: el plato entra como N alimentos independientes. */
  onAgregarSuelto: (calculado: PlatoCalculado, mealType: MealType) => void;
}

export const PlatoModal: React.FC<PlatoModalProps> = ({
  plato,
  foods,
  kcalRestantes,
  mealTypeInicial,
  comidasOcupadas = [],
  onCerrar,
  onAgregar,
  onAgregarSuelto,
}) => {
  const [extras, setExtras] = useState<string[]>([]);
  const [factorManual, setFactorManual] = useState<number | null>(null);
  const [comida, setComida] = useState<MealType>(mealTypeInicial);
  // "Mi version": gramos propios por ingrediente. Vacio = la receta tal cual.
  const [ajustes, setAjustes] = useState<Record<string, number>>({});
  const [ajustando, setAjustando] = useState(false);
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

      const hayAjustes = Object.keys(ajustes).length > 0;
      const seleccion: SeleccionPlato = { extras, opciones, ajustes };

      const base = useMemo(
        () => calcularPlato(plato, seleccion, foods, 1),
        [plato, extras, opciones, ajustes, foods],
      );
      // NUNCA se infla sola: el ajuste automatico solo puede BAJAR la porcion. Subir es decision del usuario.
      const sugerido = factorParaPresupuesto(base.totales.kcal, kcalRestantes);
      // Mientras ajustas gramos, la porcion queda en 1: lo que editas son los gramos REALES de la receta.
      const factor = ajustando ? 1 : (factorManual ?? sugerido);
      const calc = useMemo(
        () => calcularPlato(plato, seleccion, foods, factor),
        [plato, extras, opciones, ajustes, foods, factor],
      );
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

              {/* Ingredientes (con "mi version": los gramos se pueden editar) */}
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-slate-300">Ingredientes de la receta</p>
                  <div className="flex items-center gap-2">
                    {hayAjustes && !ajustando && (
                      <button
                        type="button"
                        onClick={() => setAjustes({})}
                        className="text-[10px] text-sky-300 underline"
                      >
                        volver a la receta
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAjustando((v) => !v);
                        setFactorManual(1);
                      }}
                      aria-pressed={ajustando}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                        ajustando
                          ? 'border-emerald-600 bg-emerald-900/40 text-emerald-300'
                          : 'border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {ajustando ? '✓ listo' : '✏️ ajustar gramos'}
                    </button>
                  </div>
                </div>
                {ajustando && (
                  <p className="mb-1 text-[10px] leading-snug text-emerald-300/90">
                    Poné los gramos que comiste de verdad. Mientras ajustás, la porción está en 1.
                  </p>
                )}
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
                          <td className="px-2 py-1.5 text-right">
                            {ajustando ? (
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={2000}
                                step={5}
                                aria-label={`Gramos de ${l.nombre}`}
                                value={String(Math.round(l.gramos * 10) / 10)}
                                onChange={(e) => {
                                  const crudo = e.target.value;
                                  const v = Number(crudo);
                                  setAjustes((prev) => {
                                    const siguiente = { ...prev };
                                    // Campo vacio o invalido = se cae el ajuste y vuelve la receta.
                                    if (crudo.trim() === '' || !Number.isFinite(v) || v < 0) delete siguiente[l.nombre];
                                    else siguiente[l.nombre] = v;
                                    return siguiente;
                                  });
                                }}
                                className="w-16 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-right text-[11px] text-slate-100"
                              />
                            ) : (
                              numEsMax(l.gramos, 1)
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right">{numEs(l.kcal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-slate-400">Porcion:</span>
                  {[0.5, 0.75, 1, 1.25, 1.5].map((f) => {
                    const activo = Math.abs(factor - f) < 0.005;
                    return (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setFactorManual(f)}
                            aria-pressed={activo}
                            disabled={ajustando}
                            title={ajustando ? 'Terminá de ajustar los gramos para escalar la porción' : undefined}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                              ajustando
                                ? 'cursor-not-allowed bg-slate-800 text-slate-600'
                                : activo
                                  ? 'bg-brand-500 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                        {String(f).replace('.', ',')}
                      </button>
                    );
                  })}
                  {factorManual !== null && (
                    <button
                      type="button"
                      onClick={() => setFactorManual(null)}
                      className="text-[10px] text-sky-300 underline"
                    >
                      auto
                    </button>
                  )}
                  <span className="ml-1 text-[10px] text-slate-500">
                    1 porcion = {numEs(base.totales.kcal)} kcal
                  </span>
                </div>
                {Math.abs(factor - 1) > 0.005 && (
                  <p className="mt-1 text-[10px] text-sky-300/90">
                    {factorManual === null
                      ? `Porcion sugerida para lo que te queda hoy (${numEs(Math.max(0, kcalRestantes))} kcal).`
                      : `Porcion elegida por vos. La base (1 porcion) son ${numEs(base.totales.kcal)} kcal.`}
                  </p>
                )}
          </div>
        </div>

        <div className="sticky bottom-0 space-y-2 border-t border-slate-700 bg-slate-900/95 px-4 py-3">
          <button
            type="button"
            disabled={bloqueado}
            onClick={() => onAgregar(plato, calc, comida, hayAjustes ? ajustes : undefined)}
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
          <button
            type="button"
            onClick={() => onAgregarSuelto(calc, comida)}
            className="w-full rounded-lg border border-slate-600 px-4 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
          >
            ⤵ Agregar suelto a {comida} · {calc.lineas.length} ingredientes
          </button>
          <p className="text-center text-[10px] leading-snug text-slate-500">
            Suelto = cada ingrediente como fila propia (el plato deja de contar como {rol}).
          </p>
        </div>
      </div>
    </div>
  );
};
