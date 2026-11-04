import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { PyramidStrengthCalculator } from './PyramidStrengthCalculator';
import { filasParaInsertar, DIAS_INICIALES } from '../logic/routines';
import { resumenProgreso } from '../logic/progress';
import {
  agregarSemana,
  etiquetaSemana,
  fechaLocalISO,
  lunesDe,
  mesesDeSemanas,
  normalizarSemanas,
  quitarSemana,
  volumenDe,
  volumenesPorSemana,
  type PesoDeSemana,
  type SemanaGuardada,
} from '../logic/weeks';
import {
  cargarDias as cargarDiasNube,
  guardarDias as guardarDiasNube,
  borrarDia as borrarDiaNube,
  cargarSemanas as cargarSemanasNube,
  guardarSemana as guardarSemanaNube,
  borrarSemana as borrarSemanaNube,
  guardarCeldas as guardarCeldasNube,
  borrarCelda as borrarCeldaNube,
} from '../services/workoutSync';
import {
  normalizarDias,
  siguienteIdDia,
  diasFaltantes,
  validarDia,
  puedeEliminarDia,
  type DiaGuardado,
} from '../logic/days';

interface ExerciseItem {
  id: string;
  rutina_id: string;
  nombre: string;
  calentamiento: string;
  peso: number;
  series: number;
  reps: number;
}

const CLAVE_DIAS = 'workout_days_v1';
const CLAVE_SEMANAS = 'workout_weeks_v2';
const CLAVE_CELDAS = 'workout_cells_v2';

function cargarDias(): DiaGuardado[] {
  if (typeof window === 'undefined') return DIAS_INICIALES;
  try {
    const raw = window.localStorage.getItem(CLAVE_DIAS);
    if (!raw) return DIAS_INICIALES;
    return normalizarDias(JSON.parse(raw)) ?? DIAS_INICIALES;
  } catch {
    return DIAS_INICIALES;
  }
}

function persistirDias(dias: DiaGuardado[]) {
  try {
    window.localStorage.setItem(CLAVE_DIAS, JSON.stringify(dias));
  } catch {
    /* modo privado: los días viven solo en memoria */
  }
}

// Caché de arranque (la verdad está en Supabase; esto evita una pantalla vacía
// mientras llega la respuesta y cuando no hay red).
function leerSemanasCache(): SemanaGuardada[] {
  if (typeof window === 'undefined') return [];
  try {
    return normalizarSemanas(JSON.parse(window.localStorage.getItem(CLAVE_SEMANAS) ?? '[]'));
  } catch {
    return [];
  }
}

function persistirSemanas(semanas: SemanaGuardada[]) {
  try {
    window.localStorage.setItem(CLAVE_SEMANAS, JSON.stringify(semanas));
  } catch {
    /* modo privado */
  }
}

type Celdas = Record<string, Record<string, PesoDeSemana>>;

function leerCeldasCache(): Celdas {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CLAVE_CELDAS);
    return raw ? (JSON.parse(raw) as Celdas) : {};
  } catch {
    return {};
  }
}

function persistirCeldas(celdas: Celdas) {
  try {
    window.localStorage.setItem(CLAVE_CELDAS, JSON.stringify(celdas));
  } catch {
    /* modo privado */
  }
}

export const WorkoutModule: React.FC = () => {
  const pyramidRef = useRef<HTMLDivElement>(null);

  const [dias, setDias] = useState<DiaGuardado[]>(cargarDias);
  const [selectedDayId, setSelectedDayId] = useState<string>(() => cargarDias()[0]?.id ?? 'dia-1');
  const [editandoDia, setEditandoDia] = useState<{ id: string | null; titulo: string; dias: string } | null>(null);
  const [errorDia, setErrorDia] = useState<string | null>(null);
  const [confirmarBorrarDia, setConfirmarBorrarDia] = useState(false);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorSync, setErrorSync] = useState<string | null>(null);

  // Formulario rápido para añadir ejercicio
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCalentamiento, setNewCalentamiento] = useState('');
  const [newPeso, setNewPeso] = useState<number>(40);
  const [newSeries, setNewSeries] = useState<number>(3);
  const [newReps, setNewReps] = useState<number>(10);

  // Semanas con FECHA REAL y celdas (peso por ejercicio/semana).
  // Todo se lee y se escribe en Supabase; localStorage es solo la caché.
  const [semanas, setSemanas] = useState<SemanaGuardada[]>(leerSemanasCache);
  const [celdas, setCeldas] = useState<Celdas>(leerCeldasCache);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<number, boolean>>({});
  const [fechaSemana, setFechaSemana] = useState<string>(() => fechaLocalISO());
  const [avisoSemana, setAvisoSemana] = useState<string | null>(null);
  const [confirmarQuitarSemana, setConfirmarQuitarSemana] = useState(false);
  const [faltaSql, setFaltaSql] = useState(false);

  // 1RM activo
  const [active1RM, setActive1RM] = useState<{ nombre: string; peso: number; reps: number }>({
    nombre: 'Selecciona un ejercicio',
    peso: 0,
    reps: 10
  });

  // 1. Cargar desde Supabase al iniciar
  useEffect(() => {
    loadData();
  }, []);

  // Los días son DATOS. Si algún ejercicio trae un rutina_id que no está en la
  // lista guardada (localStorage borrado, otro navegador), el día reaparece en
  // vez de quedar invisible.
  useEffect(() => {
    setDias((prev) => {
      const ids = Array.from(new Set(exercises.map((e) => e.rutina_id).filter(Boolean)));
      const faltan = diasFaltantes(prev, ids);
      if (faltan.length === 0) return prev;
      const nuevo = [...prev, ...faltan];
      persistirDias(nuevo);
      return nuevo;
    });
  }, [exercises]);

  const actualizarDias = (nuevos: DiaGuardado[]) => {
    setDias(nuevos);
    persistirDias(nuevos);
    // Se guarda en la NUBE además de la caché: los días tienen que verse en
    // cualquier equipo, no solo en este navegador.
    guardarDiasNube(nuevos).then((r) => {
      if (r.faltaSql) setFaltaSql(true);
      else if (!r.ok && r.error) setErrorSync(`No se pudieron guardar los días en la nube: ${r.error}`);
    });
  };

  const abrirEditorDia = (dia?: DiaGuardado) => {
    setErrorDia(null);
    setConfirmarBorrarDia(false);
    setEditandoDia(
      dia ? { id: dia.id, titulo: dia.titulo, dias: dia.dias } : { id: null, titulo: '', dias: '' },
    );
  };

  const guardarDia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editandoDia) return;
    const err = validarDia(editandoDia.titulo, editandoDia.dias);
    if (err) {
      setErrorDia(err);
      return;
    }
    if (editandoDia.id) {
      actualizarDias(
        dias.map((d) =>
          d.id === editandoDia.id
            ? { ...d, titulo: editandoDia.titulo.trim(), dias: editandoDia.dias.trim() }
            : d,
        ),
      );
    } else {
      const id = siguienteIdDia(dias);
      actualizarDias([
        ...dias,
        { id, titulo: editandoDia.titulo.trim(), dias: editandoDia.dias.trim(), orden: dias.length },
      ]);
      setSelectedDayId(id);
    }
    setEditandoDia(null);
    setErrorDia(null);
  };

  // Borrar un día borra TAMBIÉN sus ejercicios en Supabase (se pide confirmación).
  const eliminarDia = async (dia: DiaGuardado) => {
    if (!puedeEliminarDia(dias)) {
      setErrorDia('Tiene que quedar al menos un día.');
      return;
    }
    const delDia = exercises.filter((e) => e.rutina_id === dia.id);
    if (delDia.length > 0) {
      const { error } = await supabase.from('workout_exercises').delete().eq('rutina_id', dia.id);
      if (error) {
        setErrorSync(error.message);
        return;
      }
      setExercises((prev) => prev.filter((e) => e.rutina_id !== dia.id));
    }
    const resto = dias.filter((d) => d.id !== dia.id);
    actualizarDias(resto);
    borrarDiaNube(dia.id).then((r) => {
      if (r.faltaSql) setFaltaSql(true);
      else if (!r.ok && r.error) setErrorSync(`El día se borró acá pero no en la nube: ${r.error}`);
    });
    if (selectedDayId === dia.id) setSelectedDayId(resto[0]?.id ?? 'dia-1');
    setConfirmarBorrarDia(false);
    setEditandoDia(null);
  };

  async function loadData() {
    setLoading(true);
    setErrorSync(null);
    try {
      const { data: exData, error: exErr } = await supabase
        .from('workout_exercises')
        .select('*')
        .order('created_at', { ascending: true });

      if (exErr) {
        // Antes el error se tragaba y se intentaba sembrar: la pantalla quedaba muda.
        setErrorSync(exErr.message);
        return;
      }

      if (exData && exData.length > 0) {
        setExercises(exData);
        const first = exData.find((e: ExerciseItem) => e.rutina_id === selectedDayId) || exData[0];
        if (first) {
          setActive1RM({ nombre: first.nombre, peso: first.peso, reps: first.reps });
        }
      } else {
        // Semillero por defecto si la base de datos está totalmente vacía
        await seedDefaultExercises();
      }

      // DÍAS: la base manda; localStorage es la caché de arranque.
      const resDias = await cargarDiasNube();
      if (resDias.faltaSql) setFaltaSql(true);
      if (resDias.ok && resDias.data) {
        if (resDias.data.length > 0) {
          const norm = normalizarDias(resDias.data) ?? DIAS_INICIALES;
          setDias(norm);
          persistirDias(norm);
        } else {
          // Tabla nueva y vacía: subimos lo que ya estaba en este equipo.
          const r = await guardarDiasNube(cargarDias());
          if (r.faltaSql) setFaltaSql(true);
        }
      }

      // SEMANAS + pesos por ejercicio: ídem (leer de la nube, caché como respaldo).
      const resSemanas = await cargarSemanasNube();
      if (resSemanas.faltaSql) setFaltaSql(true);
      if (resSemanas.ok && resSemanas.data) {
        const { semanas: deNube, celdas: celdasDeNube } = resSemanas.data;
        if (deNube.length > 0) {
          setSemanas(deNube);
          persistirSemanas(deNube);
          setCeldas(celdasDeNube);
          persistirCeldas(celdasDeNube);
        } else {
          // La nube está vacía: si este equipo ya tenía semanas, las subimos
          // (así no se pierde lo que se anotó sin red o antes de crear las tablas).
          const locales = leerSemanasCache();
          if (locales.length > 0) {
            for (const s of locales) await guardarSemanaNube(s);
            const celdasLocales = leerCeldasCache();
            const filas: Array<{ ejercicioId: string; weekId: string; celda: PesoDeSemana }> = [];
            for (const [ejercicioId, porSemana] of Object.entries(celdasLocales)) {
              for (const [weekId, celda] of Object.entries(porSemana)) {
                filas.push({ ejercicioId, weekId, celda });
              }
            }
            if (filas.length > 0) await guardarCeldasNube(filas);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setErrorSync(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function seedDefaultExercises() {
    // La rutina vive en src/logic/routines.ts (fuente única, transcrita de la del dueño).
    const { data } = await supabase.from('workout_exercises').insert(filasParaInsertar(0)).select();
    if (data) {
      setExercises(data);
      setActive1RM({ nombre: data[0].nombre, peso: data[0].peso, reps: data[0].reps });
    }
  }

  // 2. FUNCIÓN PARA AÑADIR UN NUEVO EJERCICIO A SUPABASE
  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newEx = {
      rutina_id: selectedDayId,
      nombre: newName.trim(),
      calentamiento: newCalentamiento.trim(),
      peso: Number(newPeso) || 0,
      series: Number(newSeries) || 1,
      reps: Number(newReps) || 1
    };

    const { data, error } = await supabase.from('workout_exercises').insert([newEx]).select();

    if (error) {
      alert('Error guardando en Supabase: ' + error.message);
      return;
    }

    if (data && data[0]) {
      setExercises((prev) => [...prev, data[0]]);
      setNewName('');
      setNewCalentamiento('');
      setShowAddForm(false);
    }
  };

  // 3. FUNCIÓN PARA ELIMINAR UN EJERCICIO
  const handleDeleteExercise = async (id: string) => {
    if (!confirm('¿Deseas eliminar este ejercicio de la rutina?')) return;

    setExercises((prev) => prev.filter((e) => e.id !== id));
    await supabase.from('workout_exercises').delete().eq('id', id);
  };

  // 4. MODIFICAR CAMPOS EN TIEMPO REAL
  const handleUpdateField = async (id: string, field: keyof ExerciseItem, value: any) => {
    setExercises((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
    await supabase.from('workout_exercises').update({ [field]: value }).eq('id', id);
  };

  // 5. PESO DE UN EJERCICIO EN UNA SEMANA (la celda de la matriz)
  //    Se guarda el PESO, no el volumen: el volumen = peso × series × reps se calcula.
  //    Un 0 no se guarda: "sin registrar" no es "levanté 0 kg".
  const handlePesoCelda = async (ex: ExerciseItem, semana: SemanaGuardada, peso: number) => {
    const celda: PesoDeSemana = { peso, series: ex.series, reps: ex.reps };
    const deEjercicio = { ...(celdas[ex.id] ?? {}) };
    if (peso > 0) deEjercicio[semana.id] = celda;
    else delete deEjercicio[semana.id];
    const siguiente: Celdas = { ...celdas, [ex.id]: deEjercicio };

    setCeldas(siguiente);
    persistirCeldas(siguiente);

    const r =
      peso > 0
        ? await guardarCeldasNube([{ ejercicioId: ex.id, weekId: semana.id, celda }])
        : await borrarCeldaNube(ex.id, semana.id);
    if (r.faltaSql) setFaltaSql(true);
    else if (!r.ok && r.error)
      setErrorSync(`No se pudo guardar ${ex.nombre} · ${etiquetaSemana(semana)}: ${r.error}`);
  };

  /** Crea la columna de la semana elegida y copia el peso actual de cada ejercicio. */
  const cerrarSemana = async () => {
    setAvisoSemana(null);
    const { semanas: nuevas, creada } = agregarSemana(semanas, fechaSemana);
    const inicio = lunesDe(fechaSemana);

    if (!creada) {
      setAvisoSemana(`La semana del ${inicio} ya está en la matriz: editá sus casillas directamente.`);
      return;
    }

    const semana = nuevas.find((s) => s.inicio === inicio);
    if (!semana) return;

    const filas = exercises.map((ex) => ({
      ejercicioId: ex.id,
      weekId: semana.id,
      celda: { peso: ex.peso, series: ex.series, reps: ex.reps },
    }));
    const siguiente: Celdas = { ...celdas };
    for (const fila of filas) {
      siguiente[fila.ejercicioId] = { ...(siguiente[fila.ejercicioId] ?? {}), [semana.id]: fila.celda };
    }

    setSemanas(nuevas);
    setCeldas(siguiente);
    persistirSemanas(nuevas);
    persistirCeldas(siguiente);

    const rSemana = await guardarSemanaNube(semana);
    const rCeldas = await guardarCeldasNube(filas);
    if (rSemana.faltaSql || rCeldas.faltaSql) setFaltaSql(true);
    if (!rSemana.ok || !rCeldas.ok) {
      setErrorSync(
        `La semana quedó en este equipo pero no en la nube: ${rSemana.error ?? rCeldas.error ?? 'error desconocido'}`,
      );
    }
    setAvisoSemana(
      `Semana cerrada: ${etiquetaSemana(semana)}. Copié el peso actual de los ${exercises.length} ejercicios — corregí lo que cambió.`,
    );
  };

  /** Quita la ÚLTIMA semana (por su fecha) y sus pesos. Pide confirmación. */
  const eliminarUltimaSemana = async () => {
    const ultima = semanas[semanas.length - 1];
    if (!ultima) return;

    const restantes = quitarSemana(semanas, ultima.id);
    const siguientes: Celdas = { ...celdas };
    for (const id of Object.keys(siguientes)) {
      const deEjercicio = { ...siguientes[id] };
      delete deEjercicio[ultima.id];
      siguientes[id] = deEjercicio;
    }

    setSemanas(restantes);
    setCeldas(siguientes);
    persistirSemanas(restantes);
    persistirCeldas(siguientes);
    setConfirmarQuitarSemana(false);
    setAvisoSemana(null);

    const r = await borrarSemanaNube(ultima.id);
    if (r.faltaSql) setFaltaSql(true);
    else if (!r.ok && r.error) setErrorSync(`Se quitó acá pero no en la nube: ${r.error}`);
  };

  const handleTrigger1RM = (nombre: string, peso: number, reps: number) => {
    setActive1RM({ nombre, peso, reps });
    if (pyramidRef.current) {
      pyramidRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const toggleMonthCollapse = (mIdx: number) => {
    setCollapsedMonths((prev) => ({ ...prev, [mIdx]: !prev[mIdx] }));
  };

  const activeCategory =
    dias.find((c) => c.id === selectedDayId) ??
    dias[0] ?? { id: selectedDayId, titulo: 'Sin días', dias: '', orden: 0 };
  const currentCategoryExercises = exercises.filter((e) => e.rutina_id === activeCategory.id);
  const volumenTotalDia = currentCategoryExercises.reduce(
    (acc, ex) => acc + ex.peso * ex.series * ex.reps,
    0
  );

    const conteoPorDia = exercises.reduce<Record<string, number>>((acc, e) => {
      acc[e.rutina_id] = (acc[e.rutina_id] ?? 0) + 1;
      return acc;
    }, {});

  const monthsArray = mesesDeSemanas(semanas, 4);

  /** Volumen por semana (clave = orden) para la columna de Progreso. */
  const historicoDe = (ejercicioId: string) => volumenesPorSemana(celdas[ejercicioId], semanas);

  const ultimaSemana = semanas[semanas.length - 1] ?? null;

  return (
    <div className="space-y-8">
      {/* 1. PIRÁMIDE DE FUERZA MÁXIMA REACTIVA */}
      <div ref={pyramidRef} className="scroll-mt-6">
        <PyramidStrengthCalculator
          exerciseName={active1RM.nombre}
          defaultWeight={active1RM.peso}
        />
      </div>

      {/* 2. TABLA DE SESIÓN DIARIA */}
      <div className="space-y-4">
        {/* Selector de días y botón principal de añadir */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {dias.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedDayId(cat.id);
                  setConfirmarBorrarDia(false);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  cat.id === selectedDayId
                    ? 'bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-900/30'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {cat.titulo}
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    cat.id === selectedDayId ? 'bg-white/20' : 'bg-slate-800'
                  }`}
                >
                  {conteoPorDia[cat.id] ?? 0}
                </span>
              </button>
            ))}
            <button
              onClick={() => abrirEditorDia()}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-dashed border-slate-600 text-slate-300 hover:border-emerald-500 hover:text-emerald-400"
              title="Crear un día nuevo"
            >
              ➕ Día
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-lg shadow-md transition-colors flex items-center gap-1.5"
            >
              <span>➕</span> {showAddForm ? 'Cerrar Formulario' : 'Añadir Ejercicio'}
            </button>
            <span className="text-xs font-mono font-bold text-brand-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
              Volumen Día: {volumenTotalDia.toLocaleString()} kg
            </span>
          </div>
            </div>

            {/* Editar / eliminar el día activo */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>
                Día activo:{' '}
                <span className="text-slate-200 font-semibold">{activeCategory.titulo}</span>
                {activeCategory.dias && <span className="text-slate-500"> · {activeCategory.dias}</span>}
              </span>
              <button
                onClick={() => abrirEditorDia(activeCategory)}
                className="px-2 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                ✎ Editar día
              </button>
              {!confirmarBorrarDia ? (
                <button
                  onClick={() => setConfirmarBorrarDia(true)}
                  disabled={!puedeEliminarDia(dias)}
                  title={puedeEliminarDia(dias) ? 'Eliminar este día' : 'Tiene que quedar al menos un día'}
                  className="px-2 py-1 rounded border border-rose-800/60 text-rose-300 hover:bg-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🗑 Eliminar día
                </button>
              ) : (
                <span className="flex flex-wrap items-center gap-2 px-2 py-1 rounded border border-rose-700 bg-rose-950/40 text-rose-200">
                  ¿Borrar «{activeCategory.titulo}»
                  {(conteoPorDia[activeCategory.id] ?? 0) > 0
                    ? ` y sus ${conteoPorDia[activeCategory.id]} ejercicio(s)`
                    : ''}
                  ?
                  <button
                    onClick={() => eliminarDia(activeCategory)}
                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                  >
                    Sí, borrar
                  </button>
                  <button
                    onClick={() => setConfirmarBorrarDia(false)}
                    className="px-2 py-0.5 rounded bg-slate-700 text-slate-100"
                  >
                    No
                  </button>
                </span>
              )}
            </div>

            {editandoDia && (
              <form
                onSubmit={guardarDia}
                className="bg-slate-900 border border-brand-500/50 p-3 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs items-end"
              >
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Nombre del día *</label>
                  <input
                    type="text"
                    autoFocus
                    value={editandoDia.titulo}
                    onChange={(e) => setEditandoDia({ ...editandoDia, titulo: e.target.value })}
                    placeholder="Ej. Día 4 — Tren inferior"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Cuándo</label>
                  <input
                    type="text"
                    value={editandoDia.dias}
                    onChange={(e) => setEditandoDia({ ...editandoDia, dias: e.target.value })}
                    placeholder="Ej. Sábado"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold"
                  >
                    {editandoDia.id ? 'Guardar' : 'Crear día'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditandoDia(null);
                      setErrorDia(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300"
                  >
                    Cancelar
                  </button>
                </div>
                {errorDia && <p className="sm:col-span-3 text-rose-400">{errorDia}</p>}
              </form>
            )}

            {/* Formulario Desplegable para Agregar Nuevo Ejercicio */}
        {showAddForm && (
          <form
            onSubmit={handleCreateExercise}
            className="bg-slate-900 border border-brand-500/50 p-4 rounded-xl shadow-xl grid grid-cols-1 sm:grid-cols-6 gap-3 text-xs items-end"
          >
            <div className="sm:col-span-2">
              <label className="text-slate-300 block mb-1 font-semibold">Nombre del Ejercicio *</label>
              <input
                type="text"
                required
                placeholder="Ej. Press Banca, Dominadas..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="text-slate-300 block mb-1">Nota (técnica / descanso)</label>
              <input
                type="text"
                placeholder="Ej. Al 50%, 3 reps"
                value={newCalentamiento}
                onChange={(e) => setNewCalentamiento(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="text-slate-300 block mb-1">Peso (kg)</label>
              <input
                type="number"
                value={newPeso}
                onChange={(e) => setNewPeso(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-center font-bold focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="sm:col-span-1 grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-slate-300 block mb-1">Series</label>
                <input
                  type="number"
                  value={newSeries}
                  onChange={(e) => setNewSeries(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1.5 text-slate-100 text-center"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Reps</label>
                <input
                  type="number"
                  value={newReps}
                  onChange={(e) => setNewReps(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1.5 text-slate-100 text-center"
                />
              </div>
            </div>

            <div className="sm:col-span-1">
              <button
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-1.5 px-3 rounded shadow transition-colors"
              >
                Guardar en BD
              </button>
            </div>
          </form>
        )}

        {/* Tabla de Ejercicios */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-3.5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Sesión: {activeCategory.titulo}</h3>
              <span className="text-[11px] text-slate-400">{activeCategory.dias}</span>
            </div>
                {errorSync ? (
                  <span
                    className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/40 px-2 py-1 rounded font-mono max-w-[380px] truncate"
                    title={errorSync}
                  >
                    ⚠ Sin conexión con la base: {errorSync}
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded font-mono">
                    ● {exercises.length} ejercicios · {Object.keys(conteoPorDia).length} días
                  </span>
                )}
                <button
                  onClick={() => loadData()}
                  className="text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700"
                  title="Volver a leer desde Supabase"
                >
                  ⟳
                </button>
          </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Cargando tus ejercicios desde Supabase…
                </div>
              ) : currentCategoryExercises.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-slate-400 text-xs">No hay ejercicios registrados en esta rutina todavía.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors"
              >
                ➕ Añadir el primer ejercicio
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Ejercicio</th>
                    <th className="py-2.5 px-3">Nota (técnica / descanso)</th>
                    <th className="py-2.5 px-3 w-20 text-center">Peso (kg)</th>
                    <th className="py-2.5 px-3 w-16 text-center">Series</th>
                    <th className="py-2.5 px-3 w-16 text-center">Reps</th>
                    <th className="py-2.5 px-3 text-right">Volumen</th>
                    <th className="py-2.5 px-3 text-center">Progreso</th>
                    <th className="py-2.5 px-3 text-center">1RM</th>
                    <th className="py-2.5 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentCategoryExercises.map((ex) => {
                    const vol = ex.peso * ex.series * ex.reps;
                    return (
                      <tr key={ex.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={ex.nombre}
                            onChange={(e) => handleUpdateField(ex.id, 'nombre', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-brand-500 text-slate-100 font-semibold focus:outline-none w-full"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={ex.calentamiento || ''}
                            placeholder="—"
                            onChange={(e) => handleUpdateField(ex.id, 'calentamiento', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-brand-500 text-amber-300/80 italic focus:outline-none text-[11px] w-full"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            value={ex.peso}
                            onChange={(e) => handleUpdateField(ex.id, 'peso', parseFloat(e.target.value) || 0)}
                            className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center text-slate-100 font-bold focus:border-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            value={ex.series}
                            onChange={(e) => handleUpdateField(ex.id, 'series', parseInt(e.target.value, 10) || 0)}
                            className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center text-slate-100 focus:border-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            value={ex.reps}
                            onChange={(e) => handleUpdateField(ex.id, 'reps', parseInt(e.target.value, 10) || 0)}
                            className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center text-slate-100 focus:border-brand-500 focus:outline-none"
                          />
                        </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-brand-400">
                              {vol.toLocaleString()} kg
                            </td>
                            <td className="py-2 px-3 text-center">
                              {(() => {
                                const r = resumenProgreso(historicoDe(ex.id));
                                if (r.tendencia === 'SIN_DATOS') {
                                  return <span className="text-[10px] text-slate-500">—</span>;
                                }
                                const color =
                                  r.tendencia === 'SUBE'
                                    ? 'text-emerald-400'
                                    : r.tendencia === 'BAJA'
                                      ? 'text-rose-400'
                                      : 'text-amber-400';
                                const flecha =
                                  r.tendencia === 'SUBE' ? '▲' : r.tendencia === 'BAJA' ? '▼' : '=';
                                return (
                                  <span
                                    className={`text-[10px] font-semibold ${color}`}
                                    title={`${r.puntos} semana(s) de historial · mejor: ${r.mejorVolumen?.toLocaleString()} kg`}
                                  >
                                    {flecha} {r.deltaPct !== null ? `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct}%` : '—'}
                                  </span>
                                );
                              })()}
                            </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleTrigger1RM(ex.nombre, ex.peso, ex.reps)}
                            className="text-[10px] bg-brand-600 hover:bg-brand-500 text-white px-2.5 py-1 rounded font-semibold transition-transform active:scale-95 shadow-sm"
                          >
                            Calcular
                          </button>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleDeleteExercise(ex.id)}
                            className="text-rose-400 hover:text-rose-300 font-bold px-1"
                            title="Eliminar de Supabase"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

            {/* 3. MATRIZ CRONOLÓGICA — semanas con FECHA REAL */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row justify-between lg:items-end pb-3 border-b border-slate-800 gap-3">
          <div>
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>📈</span> Matriz Cronológica de Progreso
            </h4>
            <p className="text-xs text-slate-400">
              Cada columna es UNA semana con su fecha. Guardás el <strong className="text-slate-300">peso</strong> (los
              kg del ejercicio); el volumen (peso × series × reps) lo calcula la app.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-[10px] text-slate-400 font-semibold">
              Semana que cerraste
              <input
                type="date"
                value={fechaSemana}
                onChange={(e) => setFechaSemana(e.target.value)}
                className="mt-0.5 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:border-brand-500 focus:outline-none"
              />
            </label>
            <button
              onClick={cerrarSemana}
              title="Crea la columna con la fecha de esa semana y copia el peso actual de cada ejercicio"
              className="text-xs bg-brand-600 hover:bg-brand-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-md transition-colors flex items-center gap-1.5"
            >
              <span>📌</span> Cerrar semana
            </button>
            {ultimaSemana && !confirmarQuitarSemana && (
              <button
                onClick={() => setConfirmarQuitarSemana(true)}
                className="text-xs bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <span>🗑</span> Quitar {etiquetaSemana(ultimaSemana)}
              </button>
            )}
            {ultimaSemana && confirmarQuitarSemana && (
              <span className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-lg border border-rose-700 bg-rose-950/40 text-rose-200 text-xs">
                ¿Borrar {etiquetaSemana(ultimaSemana)} y sus pesos?
                <button
                  onClick={eliminarUltimaSemana}
                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                >
                  Sí, borrar
                </button>
                <button
                  onClick={() => setConfirmarQuitarSemana(false)}
                  className="px-2 py-0.5 rounded bg-slate-700 text-slate-100"
                >
                  No
                </button>
              </span>
            )}
          </div>
        </div>

        {avisoSemana && (
          <div
            role="status"
            className="text-xs bg-emerald-950/50 border border-emerald-800 text-emerald-200 rounded-lg px-3 py-2"
          >
            {avisoSemana}
          </div>
        )}

        {faltaSql && (
          <div
            role="alert"
            className="text-xs bg-amber-950/50 border border-amber-800 text-amber-200 rounded-lg px-3 py-2 space-y-1"
          >
            <p>
              <strong>Los días y las semanas todavía no están en la nube.</strong> En este equipo se guardan igual,
              pero no viajan a otro dispositivo.
            </p>
            <p>
              Para activarlo: Supabase → SQL Editor → correr{' '}
              <code className="px-1 bg-slate-950 rounded">supabase/2026-11-04_rutina_en_la_nube.sql</code>
            </p>
          </div>
        )}

        {semanas.length === 0 ? (
          <div className="text-xs text-slate-400 border border-dashed border-slate-700 rounded-lg px-4 py-6 text-center">
            Todavía no cerraste ninguna semana. Elegí la fecha de la semana que terminaste y tocá{' '}
            <span className="text-slate-200 font-semibold">«📌 Cerrar semana»</span>: se crea la columna con su fecha y
            se copia el peso actual de los {exercises.length} ejercicios (después corregís lo que cambió).
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-slate-950 text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-3 sticky left-0 bg-slate-950 min-w-[200px] border-r border-slate-800">
                    Plano Muscular / Ejercicio
                  </th>

                  {monthsArray.map(({ mNum, semanas: delMes }) => {
                    const isCollapsed = !!collapsedMonths[mNum];
                    return (
                      <th
                        key={mNum}
                        colSpan={isCollapsed ? 1 : Math.max(1, delMes.length)}
                        className="py-2 px-3 text-center border-r border-slate-800 bg-slate-950/90 text-brand-400 font-bold"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Mes {mNum}</span>
                          {delMes.length === 4 && (
                            <button
                              onClick={() => toggleMonthCollapse(mNum)}
                              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono"
                            >
                              {isCollapsed ? '⊞ Desplegar' : '⊟ Colapsar'}
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
                <tr className="border-t border-slate-800 text-[11px] text-slate-400 font-mono">
                  <th className="py-1.5 px-3 sticky left-0 bg-slate-950 border-r border-slate-800 font-sans text-xs">
                    Semanas
                  </th>
                  {monthsArray.map(({ mNum, semanas: delMes }) => {
                    const isCollapsed = !!collapsedMonths[mNum];
                    if (isCollapsed) {
                      return (
                        <th
                          key={mNum}
                          className="py-1.5 px-2 text-right border-r border-slate-800 bg-slate-900/60 text-amber-400 min-w-[95px]"
                        >
                          Total Mes
                        </th>
                      );
                    }
                    return delMes.map((s) => (
                      <th
                        key={s.id}
                        title={`${s.inicio} → ${s.fin}`}
                        className="py-1.5 px-2 text-center border-r border-slate-800 min-w-[95px]"
                      >
                        {etiquetaSemana(s)}
                      </th>
                    ));
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {dias.map((cat) => {
                  const catExercises = exercises.filter((e) => e.rutina_id === cat.id);
                  return (
                    <React.Fragment key={cat.id}>
                      {/* Encabezado del bloque + total de volumen de la semana */}
                      <tr className="bg-slate-950/80 font-sans">
                        <td className="py-2 px-3 font-bold text-emerald-400 sticky left-0 bg-slate-950 border-r border-slate-800 uppercase text-[11px] tracking-wide">
                          {cat.titulo}
                        </td>
                        {monthsArray.map(({ mNum, semanas: delMes }) => {
                          const isCollapsed = !!collapsedMonths[mNum];
                          const totalMes = catExercises.reduce(
                            (acc, ex) =>
                              acc +
                              delMes.reduce((wAcc, s) => {
                                const c = celdas[ex.id]?.[s.id];
                                return wAcc + (c ? volumenDe(c.peso, c.series, c.reps) : 0);
                              }, 0),
                            0,
                          );
                          if (isCollapsed) {
                            return (
                              <td
                                key={mNum}
                                className="py-2 px-2 text-right border-r border-slate-800 text-amber-300 font-bold bg-slate-900/30"
                              >
                                {totalMes.toLocaleString()} kg
                              </td>
                            );
                          }
                          return delMes.map((s) => {
                            const totalSemana = catExercises.reduce((acc, ex) => {
                              const c = celdas[ex.id]?.[s.id];
                              return acc + (c ? volumenDe(c.peso, c.series, c.reps) : 0);
                            }, 0);
                            return (
                              <td
                                key={s.id}
                                title={`Volumen de la semana: ${totalSemana.toLocaleString()} kg`}
                                className="py-2 px-2 text-right border-r border-slate-800 text-slate-300 font-bold"
                              >
                                {totalSemana.toLocaleString()}
                              </td>
                            );
                          });
                        })}
                      </tr>

                      {/* Ejercicios individuales: la celda es el PESO (kg) */}
                      {catExercises.map((ex) => (
                        <tr key={ex.id} className="hover:bg-slate-800/30">
                          <td className="py-1.5 px-3 font-sans font-medium text-slate-300 sticky left-0 bg-slate-900 border-r border-slate-800">
                            {ex.nombre}
                          </td>
                          {monthsArray.map(({ mNum, semanas: delMes }) => {
                            const isCollapsed = !!collapsedMonths[mNum];
                            const totalMesEx = delMes.reduce((acc, s) => {
                              const c = celdas[ex.id]?.[s.id];
                              return acc + (c ? volumenDe(c.peso, c.series, c.reps) : 0);
                            }, 0);

                            if (isCollapsed) {
                              return (
                                <td
                                  key={mNum}
                                  className="py-1.5 px-2 text-right border-r border-slate-800 text-amber-300/90 font-semibold bg-slate-900/20"
                                >
                                  {totalMesEx.toLocaleString()} kg
                                </td>
                              );
                            }

                            return delMes.map((s) => {
                              const c = celdas[ex.id]?.[s.id];
                              const peso = c?.peso ?? 0;
                              return (
                                <td key={s.id} className="py-1 px-1.5 border-r border-slate-800 text-center">
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={peso === 0 ? '' : peso}
                                    placeholder="—"
                                    title={
                                      c
                                        ? `${etiquetaSemana(s)} · volumen ${volumenDe(c.peso, c.series, c.reps).toLocaleString()} kg (${c.peso} × ${c.series} × ${c.reps})`
                                        : `${etiquetaSemana(s)} · sin registrar`
                                    }
                                    onChange={(e) => handlePesoCelda(ex, s, parseFloat(e.target.value) || 0)}
                                    className="w-16 bg-slate-950 border border-slate-700/80 rounded px-1.5 py-0.5 text-right font-mono text-xs text-slate-100 focus:border-brand-500 focus:outline-none"
                                  />
                                </td>
                              );
                            });
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
