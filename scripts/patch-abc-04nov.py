# Patch A+B+C (04/11/2026): fecha visible + atajos, borrar CUALQUIER semana,
# y mover la fecha de una semana ya creada conservando sus pesos.
import io

CRLF = chr(13) + chr(10)
LF = chr(10)
RAIZ = 'D:/Personal Trainer Y Nutricion/fitness-saas/'


def parchear(rel, reemplazos):
    ruta = RAIZ + rel
    raw = io.open(ruta, encoding='utf-8', newline='').read()
    crlf = CRLF in raw
    s = raw.replace(CRLF, LF)
    for viejo, nuevo in reemplazos:
        if viejo not in s:
            raise SystemExit('NO MATCHEA en ' + rel + ':\n' + viejo[:200])
        s = s.replace(viejo, nuevo, 1)
    if crlf:
        s = s.replace(LF, CRLF)
    io.open(ruta, 'w', encoding='utf-8', newline='').write(s)
    print('ok ' + rel)


# ---------------------------------------------------------------- 1) weeks.ts
NUEVO_WEEKS = '''

/** Lunes de la semana que terminó hace N semanas (0 = la de esta semana). */
export function lunesRelativo(hoyISO: string, semanasAtras: number): string {
  const base = esFechaISO(hoyISO) ? hoyISO : fechaLocalISO();
  const n = Math.max(0, Math.trunc(semanasAtras));
  return lunesDe(sumarDias(base, -7 * n));
}

export type MotivoMover = 'ok' | 'no-existe' | 'misma-fecha' | 'ocupada' | 'fecha-invalida';

/**
 * Cambia la fecha de una semana YA creada sin perder sus pesos.
 *
 * Falla cerrado (no adivina) si la fecha es basura, si la semana no existe o si
 * ya hay otra columna con esa fecha: dos columnas para la misma semana serían el
 * mismo dato contado dos veces.
 */
export function moverSemana(
  semanas: SemanaGuardada[],
  id: string,
  fechaISO: string,
): { semanas: SemanaGuardada[]; motivo: MotivoMover } {
  if (!esFechaISO(fechaISO)) return { semanas, motivo: 'fecha-invalida' };
  if (!semanas.some((s) => s.id === id)) return { semanas, motivo: 'no-existe' };
  const nuevoId = lunesDe(fechaISO);
  if (nuevoId === id) return { semanas, motivo: 'misma-fecha' };
  if (semanas.some((s) => s.id === nuevoId)) return { semanas, motivo: 'ocupada' };
  const movidas = semanas.map((s) =>
    s.id === id ? { ...s, id: nuevoId, inicio: nuevoId, fin: sumarDias(nuevoId, 6) } : s,
  );
  return { semanas: normalizarSemanas(movidas), motivo: 'ok' };
}
'''

ruta = RAIZ + 'src/logic/weeks.ts'
raw = io.open(ruta, encoding='utf-8', newline='').read()
crlf = CRLF in raw
s = raw.replace(CRLF, LF).rstrip(LF) + LF + NUEVO_WEEKS
if crlf:
    s = s.replace(LF, CRLF)
io.open(ruta, 'w', encoding='utf-8', newline='').write(s)
print('ok src/logic/weeks.ts')

# ---------------------------------------------------------------- 2) workoutSync.ts
NUEVO_SYNC = '''
/**
 * Cambia la fecha de una semana YA guardada: crea la nueva, copia sus pesos y
 * recién entonces borra la vieja.
 *
 * El orden importa: si algo falla en el medio queda una semana DE MÁS (se ve y
 * se puede borrar) en vez de una DE MENOS (se pierden los pesos sin aviso).
 */
export async function moverSemanaNube(
  viejoId: string,
  nueva: SemanaGuardada,
  celdas: Array<{ ejercicioId: string; celda: PesoDeSemana }>,
): Promise<Resultado<null>> {
  const rSemana = await guardarSemana(nueva);
  if (!rSemana.ok) return rSemana;

  if (celdas.length) {
    const rCeldas = await guardarCeldas(
      celdas.map((c) => ({ ejercicioId: c.ejercicioId, weekId: nueva.id, celda: c.celda })),
    );
    if (!rCeldas.ok) return rCeldas;
  }

  // Las celdas de la semana vieja caen solas por la FK ON DELETE CASCADE.
  return borrarSemana(viejoId);
}
'''

ruta = RAIZ + 'src/services/workoutSync.ts'
raw = io.open(ruta, encoding='utf-8', newline='').read()
crlf = CRLF in raw
s = raw.replace(CRLF, LF).rstrip(LF) + LF + NUEVO_SYNC
if crlf:
    s = s.replace(LF, CRLF)
io.open(ruta, 'w', encoding='utf-8', newline='').write(s)
print('ok src/services/workoutSync.ts')

# ---------------------------------------------------------------- 3) componente
BLOQUE_CABECERA_VIEJO = '''          <div className="flex flex-wrap items-end gap-2">
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
          </div>'''

BLOQUE_CABECERA_NUEVO = '''          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-semibold">¿Qué semana cerrás?</span>
              <div className="mt-0.5 flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg pl-2 pr-1 py-1 focus-within:border-brand-500">
                <span className="text-sm leading-none" aria-hidden="true">📅</span>
                <input
                  type="date"
                  value={fechaSemana}
                  onChange={(e) => setFechaSemana(e.target.value)}
                  aria-label="Semana que cerraste"
                  className="bg-transparent text-sm text-slate-100 focus:outline-none [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {ATAJOS_SEMANA.map((atajo) => {
                const fecha = lunesRelativo(hoyISO, atajo.semanasAtras);
                const activo = fechaSemana === fecha;
                return (
                  <button
                    key={atajo.etiqueta}
                    onClick={() => setFechaSemana(fecha)}
                    title={`${atajo.etiqueta} (desde el ${fecha})`}
                    className={`text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                      activo
                        ? 'bg-brand-600 border-brand-500 text-white'
                        : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-brand-500'
                    }`}
                  >
                    {atajo.etiqueta}
                  </button>
                );
              })}
            </div>
            <button
              onClick={cerrarSemana}
              title="Crea la columna con la fecha de esa semana y copia el peso actual de cada ejercicio"
              className="text-xs bg-brand-600 hover:bg-brand-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-md transition-colors flex items-center gap-1.5"
            >
              <span>📌</span> Cerrar semana
            </button>
          </div>'''

COLUMNA_VIEJA = '''                    return delMes.map((s) => (
                      <th
                        key={s.id}
                        title={`${s.inicio} → ${s.fin}`}
                        className="py-1.5 px-2 text-center border-r border-slate-800 min-w-[95px]"
                      >
                        {etiquetaSemana(s)}
                      </th>
                    ));'''

COLUMNA_NUEVA = '''                    return delMes.map((s) => {
                      const editando = editandoSemana === s.id;
                      const porBorrar = semanaAQuitar === s.id;
                      return (
                        <th
                          key={s.id}
                          title={`${s.inicio} → ${s.fin}`}
                          className="relative py-1.5 px-2 text-center border-r border-slate-800 min-w-[95px] align-bottom"
                        >
                          <div className="text-[11px]">{etiquetaSemana(s)}</div>
                          <div className="flex items-center justify-center gap-1.5 mt-0.5">
                            <button
                              onClick={() => {
                                setEditandoSemana(editando ? null : s.id);
                                setFechaEdicion(s.inicio);
                                setSemanaAQuitar(null);
                              }}
                              title="Cambiar la fecha de esta semana (conserva los pesos)"
                              className="text-[10px] leading-none text-slate-500 hover:text-brand-400"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => {
                                setSemanaAQuitar(porBorrar ? null : s.id);
                                setEditandoSemana(null);
                              }}
                              title="Borrar esta semana y sus pesos"
                              className="text-[10px] leading-none text-slate-500 hover:text-rose-400"
                            >
                              🗑
                            </button>
                          </div>

                          {editando && (
                            <div className="absolute left-0 top-full z-30 mt-1 w-[235px] bg-slate-900 border border-brand-700 rounded-lg p-2 shadow-xl text-left">
                              <span className="block text-[10px] text-slate-400 font-semibold mb-1">
                                Fecha de esta semana
                              </span>
                              <input
                                type="date"
                                value={fechaEdicion}
                                onChange={(e) => setFechaEdicion(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 [color-scheme:dark] focus:border-brand-500 focus:outline-none"
                              />
                              <div className="flex items-center gap-1 mt-1.5">
                                <button
                                  onClick={() => confirmarMoverSemana(s.id)}
                                  className="px-2 py-0.5 rounded bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-semibold"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={() => setEditandoSemana(null)}
                                  className="px-2 py-0.5 rounded bg-slate-700 text-slate-100 text-[11px]"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}

                          {porBorrar && (
                            <div className="absolute left-0 top-full z-30 mt-1 w-[235px] bg-rose-950 border border-rose-700 rounded-lg p-2 shadow-xl text-left">
                              <span className="block text-[11px] text-rose-100 font-semibold">
                                ¿Borrar {etiquetaSemana(s)} y sus pesos?
                              </span>
                              <div className="flex items-center gap-1 mt-1.5">
                                <button
                                  onClick={() => eliminarSemana(s.id)}
                                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold"
                                >
                                  Sí, borrar
                                </button>
                                <button
                                  onClick={() => setSemanaAQuitar(null)}
                                  className="px-2 py-0.5 rounded bg-slate-700 text-slate-100 text-[11px]"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          )}
                        </th>
                      );
                    });'''

FUNCION_VIEJA = '''  /** Quita la ÚLTIMA semana (por su fecha) y sus pesos. Pide confirmación. */
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
  };'''

FUNCION_NUEVA = '''  /**
   * Quita CUALQUIER semana (por su fecha) y sus pesos. La confirmación vive en la
   * propia columna: antes solo se podía borrar la última, así que una semana
   * creada por error en el medio quedaba atrapada para siempre.
   */
  const eliminarSemana = async (id: string) => {
    const victima = semanas.find((s) => s.id === id);
    if (!victima) return;

    const restantes = quitarSemana(semanas, id);
    const siguientes: Celdas = { ...celdas };
    for (const exId of Object.keys(siguientes)) {
      const deEjercicio = { ...siguientes[exId] };
      delete deEjercicio[id];
      siguientes[exId] = deEjercicio;
    }

    setSemanas(restantes);
    setCeldas(siguientes);
    persistirSemanas(restantes);
    persistirCeldas(siguientes);
    setSemanaAQuitar(null);
    setAvisoSemana(`Quité ${etiquetaSemana(victima)}.`);

    const r = await borrarSemanaNube(id);
    if (r.faltaSql) setFaltaSql(true);
    else if (!r.ok && r.error) setErrorSync(`Se quitó acá pero no en la nube: ${r.error}`);
  };

  /**
   * Cambia la fecha de una semana ya creada y se lleva sus pesos.
   * En la nube: crea la nueva, copia los pesos y recién ahí borra la vieja.
   */
  const confirmarMoverSemana = async (id: string) => {
    const antes = semanas.find((s) => s.id === id);
    if (!antes) return;

    const { semanas: movidas, motivo } = moverSemana(semanas, id, fechaEdicion);
    if (motivo === 'fecha-invalida') {
      setErrorSync('Elegí una fecha válida para la semana.');
      return;
    }
    if (motivo === 'ocupada') {
      setErrorSync(`Ya hay una semana con la fecha del ${lunesDe(fechaEdicion)}: no se puede repetir.`);
      return;
    }
    if (motivo === 'misma-fecha') {
      setEditandoSemana(null);
      return;
    }
    if (motivo !== 'ok') {
      setErrorSync('No encontré esa semana: recargá la pantalla.');
      return;
    }

    const nueva = movidas.find((s) => s.inicio === lunesDe(fechaEdicion));
    if (!nueva) return;

    const siguientes: Celdas = {};
    const celdasDeLaSemana: Array<{ ejercicioId: string; celda: PesoDeSemana }> = [];
    for (const exId of Object.keys(celdas)) {
      const deEjercicio = { ...celdas[exId] };
      const celda = deEjercicio[id];
      if (celda) {
        deEjercicio[nueva.id] = celda;
        delete deEjercicio[id];
        celdasDeLaSemana.push({ ejercicioId: exId, celda });
      }
      siguientes[exId] = deEjercicio;
    }

    setSemanas(movidas);
    setCeldas(siguientes);
    persistirSemanas(movidas);
    persistirCeldas(siguientes);
    setEditandoSemana(null);
    setAvisoSemana(`Moví ${etiquetaSemana(antes)} a ${etiquetaSemana(nueva)} — los pesos se conservan.`);

    const r = await moverSemanaNube(id, nueva, celdasDeLaSemana);
    if (r.faltaSql) setFaltaSql(true);
    else if (!r.ok && r.error) setErrorSync(`Se movió acá pero no en la nube: ${r.error}`);
  };'''

parchear(
    'src/components/WorkoutModule.tsx',
    [
        # imports de weeks
        ('  lunesDe,\n  mesesDeSemanas,', '  lunesDe,\n  lunesRelativo,\n  mesesDeSemanas,\n  moverSemana,'),
        # imports de workoutSync
        ('  borrarCelda as borrarCeldaNube,\n} from', '  borrarCelda as borrarCeldaNube,\n  moverSemanaNube,\n} from'),
        # atajos (constante de módulo, junto al tipo Celdas)
        (
            'type Celdas = Record<string, Record<string, PesoDeSemana>>;',
            'type Celdas = Record<string, Record<string, PesoDeSemana>>;\n\n'
            '/** Atajos del selector de semana: la de hoy y las dos anteriores. */\n'
            'const ATAJOS_SEMANA = [\n'
            "  { etiqueta: 'Esta semana', semanasAtras: 0 },\n"
            "  { etiqueta: 'La semana pasada', semanasAtras: 1 },\n"
            "  { etiqueta: 'Hace 2 semanas', semanasAtras: 2 },\n"
            '] as const;',
        ),
        # estado
        (
            '  const [confirmarQuitarSemana, setConfirmarQuitarSemana] = useState(false);',
            '  const [semanaAQuitar, setSemanaAQuitar] = useState<string | null>(null);\n'
            '  const [editandoSemana, setEditandoSemana] = useState<string | null>(null);\n'
            '  const [fechaEdicion, setFechaEdicion] = useState<string>(() => fechaLocalISO());',
        ),
        # funciones
        (FUNCION_VIEJA, FUNCION_NUEVA),
        # hoyISO en lugar de ultimaSemana
        (
            '  const ultimaSemana = semanas[semanas.length - 1] ?? null;',
            '  // Fecha de HOY en hora local: la usan los atajos del selector de semana.\n'
            '  const hoyISO = fechaLocalISO();',
        ),
        # cabecera
        (BLOQUE_CABECERA_VIEJO, BLOQUE_CABECERA_NUEVO),
        # columna
        (COLUMNA_VIEJA, COLUMNA_NUEVA),
    ],
)
