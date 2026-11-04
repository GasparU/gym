# Runner de mutaciones (04/11/2026).
# Rompe a proposito, exige ROJO, y restaura SIEMPRE. Al final vuelve a correr
# los gates verdes: si un archivo quedo mutado, el gate lo canta.
import io
import subprocess
import sys

RAIZ = 'D:/Personal Trainer Y Nutricion/fitness-saas/'
SEMANAS = 'scripts/verify-semanas.mjs'
METAB = 'scripts/verify-metabolism.mjs'
CONFIG = 'scripts/verify-config-supabase.mjs'

CRLF = chr(13) + chr(10)
LF = chr(10)

MUTACIONES = [
    ('M1 lunesDe sin corrimiento', 'src/logic/weeks.ts',
     'const corrimiento = (f.getDay() + 6) % 7;', 'const corrimiento = f.getDay();', SEMANAS),
    ('M2 agregarSemana duplica', 'src/logic/weeks.ts',
     'if (semanas.some((s) => s.inicio === inicio)) {', 'if (false) {', SEMANAS),
    ('M3 volumenDe sin guarda', 'src/logic/weeks.ts',
     'if (p <= 0 || s <= 0 || r <= 0) return 0;', 'if (false) return 0;', SEMANAS),
    ('M4 quitarSemana no renumera', 'src/logic/weeks.ts',
     'return normalizarSemanas(semanas.filter((s) => s.id !== id));',
     'return semanas.filter((s) => s.id !== id);', SEMANAS),
    ('M5 volumenesPorSemana cuenta el 0', 'src/logic/weeks.ts',
     'if (vol > 0) salida[semana.orden] = vol;', 'salida[semana.orden] = vol;', SEMANAS),
    ('M6 volver a la fila unica de superserie', 'src/logic/routines.ts',
     "nombre: 'Curl Martillo con Mancuernas',", "nombre: 'Superserie: Curl Martillo + Copa',", METAB),
    ('M7 UI deja de leer las semanas de la nube', 'src/components/WorkoutModule.tsx',
     'cargarSemanas as cargarSemanasNube,', 'cargarSemanas as cargarSemanasLocal,', SEMANAS),
    ('M8 perfil deja de bajarse de la nube', 'src/components/DietModule.tsx',
     'loadLatestBodyMetrics().then((remoto) => {', 'Promise.resolve(null).then((remoto) => {', SEMANAS),
    ('M9 la tabla de semanas cambia de nombre', 'src/services/workoutSync.ts',
     "from('workout_weeks')", "from('workout_week')", SEMANAS),
    ('M10 atajos sin lunesRelativo', 'src/components/WorkoutModule.tsx',
     'lunesRelativo(hoyISO, atajo.semanasAtras)', 'hoyISO', SEMANAS),
    ('M11 borrar semana no toca la nube', 'src/components/WorkoutModule.tsx',
     'const r = await borrarSemanaNube(id);', 'const r = { ok: true, data: null, faltaSql: false };', SEMANAS),
    ('M12 mover permite duplicar fecha', 'src/logic/weeks.ts',
     "  if (semanas.some((s) => s.id === nuevoId)) return { semanas, motivo: 'ocupada' };",
     "", SEMANAS),
    ('M13 mover no renumera', 'src/logic/weeks.ts',
     'return { semanas: normalizarSemanas(movidas), motivo:', 'return { semanas: movidas, motivo:', SEMANAS),
    ('M14 el mensaje no dice donde se configura', 'src/logic/supabase-config.ts',
     "'Se configura en Vercel", "'Se configura", CONFIG),
    ('M15 no reporta que falta la URL', 'src/logic/supabase-config.ts',
     "if (!url) faltantes.push('PUBLIC_SUPABASE_URL');", '', CONFIG),
    ('M16 no valida el formato de la URL', 'src/logic/supabase-config.ts',
     'if (!urlValida(url)) {', 'if (false) {', CONFIG),
    ('M17 acepta cualquier key', 'src/logic/supabase-config.ts',
     '} else if (!keyValida(key)) {', '} else if (false) {', CONFIG),
]


def leer(rel):
    return io.open(RAIZ + rel, encoding='utf-8', newline='').read()


def escribir(rel, texto):
    io.open(RAIZ + rel, 'w', encoding='utf-8', newline='').write(texto)


def mutar(original, viejo, nuevo):
    """Busca y reescribe respetando los finales de linea (CRLF o LF)."""
    tiene_crlf = CRLF in original
    plano = original.replace(CRLF, LF)
    if viejo not in plano:
        return None
    mutado = plano.replace(viejo, nuevo)
    return mutado.replace(LF, CRLF) if tiene_crlf else mutado


def correr(script):
    r = subprocess.run(['node', script], cwd=RAIZ, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    return r.returncode, (r.stdout or '') + (r.stderr or '')


rojas = 0
verdes = []
try:
    if correr(SEMANAS)[0] != 0:
        print('ABORTO: verify-semanas no esta verde de base.')
        sys.exit(2)
    if correr(METAB)[0] != 0:
        print('ABORTO: verify-metabolism no esta verde de base.')
        sys.exit(2)
    if correr(CONFIG)[0] != 0:
        print('ABORTO: verify-config-supabase no esta verde de base.')
        sys.exit(2)

    for nombre, archivo, viejo, nuevo, script in MUTACIONES:
        original = leer(archivo)
        mutado = mutar(original, viejo, nuevo)
        if mutado is None:
            print('NO-APLICA  ' + nombre)
            continue
        try:
            escribir(archivo, mutado)
            codigo, salida = correr(script)
        finally:
            escribir(archivo, original)

        if codigo != 0:
            motivo = [l.strip() for l in salida.splitlines() if l.strip().startswith('-')][:2]
            print('ROJO       ' + nombre + '  ->  ' + (' | '.join(motivo) if motivo else 'fallo sin asercion'))
            rojas += 1
        else:
            print('VERDE      ' + nombre + '  (la asercion no lo caza)')
            verdes.append(nombre)
finally:
    print('')
    cs, _ = correr(SEMANAS)
    cm, _ = correr(METAB)
    cc, _ = correr(CONFIG)
    print('gate final verify-semanas    : ' + ('VERDE' if cs == 0 else 'ROJO'))
    print('gate final verify-metabolism : ' + ('VERDE' if cm == 0 else 'ROJO'))
    print('gate final verify-config     : ' + ('VERDE' if cc == 0 else 'ROJO'))
    print('mutaciones ROJAS: %d de %d' % (rojas, len(MUTACIONES)))

if verdes:
    print('declaradas VERDES: ' + ', '.join(verdes))
sys.exit(0)
