# -*- coding: utf-8 -*-
"""Mutaciones del RECETARIO (plato nuevo: segundo de quinua).
Cada una debe poner ROJO `verify-platos.mjs` POR SU ASERCION, no por un crash."""

import io
import os
import shutil
import subprocess
import sys

ARCH = "public/data/platos.json"

MUTS = [
    ("P1 el segundo de quinua pasa a ser sopa", ARCH,
     '"grupo": "Guisos y segundos",<N>      "nota": "Porcion de 1 plato (~490 g)',
     '"grupo": "Sopas",<N>      "nota": "Porcion de 1 plato (~490 g)',
     "el segundo de quinua es un SEGUNDO"),

    ("P2 la porcion de quinua se multiplica por 10", ARCH,
     '{ "nombre": "Quinua cocida", "gramos": 200 }',
     '{ "nombre": "Quinua cocida", "gramos": 20 }',
     "quinua-saltada-con-pollo kcal"),

    ("P3 la nota deja de avisar que va cocida", ARCH,
     "La quinua va COCIDA: pesala ya cocida, no cruda.",
     "La quinua va al gusto.",
     "declara la quinua COCIDA"),

    ("P4 el buscador corta la lista en 8", "src/components/BuscadorPlato.tsx",
     ".sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));",
     ".sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).slice(0, 8);",
     "el buscador no corta la lista"),

    ("P5 el buscador deja de avisar que hay que deslizar", "src/components/BuscadorPlato.tsx",
     '{lista.length > 8 ? " · deslizá para ver todos" : ""}',
     '""',
     "el buscador avisa cuando hay que deslizar"),

    ("P6 el recetario se pide con cache", "src/components/DietModule.tsx",
     'fetch("/data/platos.json", { cache: "no-cache" })',
     'fetch("/data/platos.json")',
     "el recetario se pide sin cache"),
]


def correr():
    return subprocess.run(
        ["node", "scripts/verify-platos.mjs"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )


def limpio(txt):
    return (txt or "").encode("ascii", "replace").decode("ascii")


base = correr()
if base.returncode != 0:
    print("ABORTO: la linea base no esta verde")
    print(limpio(base.stdout[-600:]))
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
        print("NO-APLICA %-44s (%d ocurrencias)" % (nombre, src.count(viejo)))
        shutil.copy2(archivo + ".bak", archivo)
        os.remove(archivo + ".bak")
        continue
    io.open(archivo, "w", encoding="utf-8", newline="").write(src.replace(viejo, nuevo, 1))
    r = correr()
    shutil.copy2(archivo + ".bak", archivo)
    os.remove(archivo + ".bak")
    salida = (r.stdout or "") + (r.stderr or "")
    if r.returncode == 0:
        print("VERDE    %-44s (LA MUTACION NO FUE DETECTADA)" % nombre)
    elif esperado in salida:
        rojas += 1
        print("ROJA     %-44s -> %s" % (nombre, limpio(esperado)))
    else:
        print("ROJA?    %-44s (rojo, pero por otra razon)" % nombre)
        for linea in salida.splitlines():
            if "obtuve" in linea:
                print("           " + limpio(linea.strip())[:110])

final = correr()
print("\nGate final:", limpio(final.stdout.strip().splitlines()[-1]))
print("Mutaciones rojas por su asercion: %d/%d" % (rojas, len(MUTS)))
sys.exit(0 if rojas == len(MUTS) and final.returncode == 0 else 1)
