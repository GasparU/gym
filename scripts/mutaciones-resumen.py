# -*- coding: utf-8 -*-
"""Mutaciones del RESUMEN DIARIO / PROGRESO SEMANAL. Cada una debe poner ROJO el
gate `verify-resumen.mjs` POR SU ASERCION (no por un error de sintaxis).
Restaura desde el backup y verifica que el gate vuelva a verde."""

import io
import os
import shutil
import subprocess
import sys

MUTS = [
    ("M1 un dia sin comidas tiene deficit 0", "src/logic/resumen.ts",
     "if (!(entradas > 0)) return null;", "",
     "déficit real: sin comidas -> null"),

    ("M2 la semana cuenta los dias vacios", "src/logic/resumen.ts",
     "if (!r || r.entradas <= 0) continue;", "if (!r) continue;",
     "semana: días con datos"),

    ("M3 el ultimo dia puede ser hoy", "src/logic/resumen.ts",
     "if (r.fecha >= fecha) continue;", "if (r.fecha > fecha) continue;",
     "último con datos: nunca devuelve hoy"),

    ("M4 fechaMas no suma dias", "src/logic/resumen.ts",
     "base.setUTCDate(base.getUTCDate() + dias);", "base.setUTCDate(base.getUTCDate());",
     "fecha + 1 (fin de mes)"),

    ("M5 kg teoricos sin dividir por 7700", "src/logic/resumen.ts",
     "redondear(totalDeficit / KCAL_POR_KG_GRASA, 2)", "redondear(totalDeficit, 2)",
     "semana: kg teóricos"),

    ("M6 conResumen no reemplaza el dia", "src/logic/resumen.ts",
     "const salida = lista.filter((x) => x.fecha !== r.fecha);",
     "const salida = lista.filter(() => true);",
     "conResumen: reemplaza el mismo día"),

    ("M7 el resumen se guarda en la tabla del detalle", "src/services/cloudSync.ts",
     ".from('daily_summary').upsert(", ".from('daily_meals').upsert(",
     "cloud: escribe en daily_summary"),

    ("M8 cambiar de dia no mueve la fecha", "src/components/DietModule.tsx",
     "setFechaActiva(destino);", "setFechaActiva(fechaActiva);",
     "ui: cambiar de día mueve la fecha activa"),

    ("M9 cambiar de dia no cierra el dia que se deja", "src/components/DietModule.tsx",
     "void guardarResumenDe(meals, fechaActiva);", "void Promise.resolve();",
     "ui: al cambiar de día se cierra el día que se deja"),

    ("M10 el dia pasado se puede editar solo", "src/components/DietModule.tsx",
     "const soloLectura = !esHoy && !editandoPasado;", "const soloLectura = false;",
     "ui: el día pasado arranca en solo lectura"),

    ("M11 los gramos se editan en un dia cerrado", "src/components/DietModule.tsx",
     "disabled={soloLectura}", "disabled={false}",
     "ui: el input de gramos se deshabilita"),

    ("M12 el peso ideal vuelve a salir con punto", "src/logic/metabolism.ts",
     "${formatoEs(pesoIdeal, 1)} kg", "${pesoIdeal} kg",
     "metabolismo: peso ideal con formato es-PE"),

    ("M13 el SQL no habilita la politica", "supabase/2026-11-05_resumen_diario.sql",
     "create policy daily_summary_all on daily_summary",
     "-- create policy daily_summary_all on daily_summary",
     "sql: política de acceso"),

    ("M14 comidas = entradas (no tipos distintos)", "src/logic/resumen.ts",
     "if (fila.tipoComida) acc.comidas.add(fila.tipoComida);", "acc.comidas.add('x');",
     "detalle: comidas DISTINTAS"),

    ("M15 el derivado pisa al resumen guardado", "src/logic/resumen.ts",
     "for (const b of base ?? []) porFecha.set(b.fecha, b);",
     "for (const d of derivados ?? []) porFecha.set(d.fecha, d);",
     "union: el resumen guardado manda"),

    ("M16 el detalle acepta fechas basura", "src/logic/resumen.ts",
     "const fecha = fechaValida(fila?.fecha);", "const fecha = fila?.fecha as string;",
     "detalle: dos dias"),

    ("M17 el panel ignora el detalle", "src/components/DietModule.tsx",
     "() => completarResumenes(resumenes, detalleSemana),", "() => resumenes,",
     "ui: el panel UNE resumen guardado + detalle"),

    ("M18 el detalle no trae el tipo de comida", "src/services/cloudSync.ts",
     "select('fecha,tipo_comida,kcal,proteinas,grasa,carbohidratos,fibra')",
     "select('fecha,kcal,proteinas,grasa,carbohidratos,fibra')",
     "cloud: el detalle sale de daily_meals"),

    ("M19 el aviso no cae al detalle", "src/components/DietModule.tsx",
     "const ultimoDiaEfectivo = ultimoConDatos(resumenesEfectivos, hoyReal) ?? ultimoDia;",
     "const ultimoDiaEfectivo = ultimoDia;",
     "ui: el aviso cae al detalle si no hay resumen"),
]


def correr():
    return subprocess.run(
        ["node", "scripts/verify-resumen.mjs"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )


base = correr()
if base.returncode != 0:
    print("ABORTO: la linea base no esta verde")
    print(base.stdout[-800:], base.stderr[-800:])
    sys.exit(1)
print("Linea base VERDE\n")

rojas = 0
for nombre, archivo, viejo, nuevo, esperado in MUTS:
    shutil.copy2(archivo, archivo + ".bak")
    src = io.open(archivo, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in src else "\n"
    viejo = viejo.replace("<N>", nl)
    nuevo = nuevo.replace("<N>", nl)
    if src.count(viejo) != 1:
        print("NO-APLICA %-46s (%d ocurrencias)" % (nombre, src.count(viejo)))
        shutil.copy2(archivo + ".bak", archivo)
        os.remove(archivo + ".bak")
        continue
    io.open(archivo, "w", encoding="utf-8", newline="").write(src.replace(viejo, nuevo, 1))
    r = correr()
    shutil.copy2(archivo + ".bak", archivo)
    os.remove(archivo + ".bak")
    salida = (r.stdout or "") + (r.stderr or "")
    if r.returncode == 0:
        print("VERDE    %-46s (LA MUTACION NO FUE DETECTADA)" % nombre)
    elif esperado in salida:
        rojas += 1
        print("ROJA     %-46s -> %s" % (nombre, esperado.encode("ascii", "replace").decode("ascii")))
    else:
        print("ROJA?    %-46s (rojo, pero por otra razon)" % nombre)
        for linea in salida.splitlines():
            if "obtuve" in linea:
                print("           " + linea.strip()[:120])

final = correr()
print("\nGate final:", final.stdout.strip().splitlines()[-1].encode("ascii", "replace").decode("ascii"))
print("Mutaciones rojas por su asercion: %d/%d" % (rojas, len(MUTS)))
sys.exit(0 if rojas == len(MUTS) and final.returncode == 0 else 1)
