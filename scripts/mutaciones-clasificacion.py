# -*- coding: utf-8 -*-
"""Mutaciones de la CLASIFICACIÓN + AGUA + EDAD + ACTIVIDAD.
Cada una debe poner ROJO alguno de los gates POR SU ASERCIÓN.
Restaura desde el backup y exige verde al final."""
import io
import os
import shutil
import subprocess
import sys

GATES = [["node", "scripts/verify-metabolism.mjs"],
         ["node", "scripts/verify-alimentos.mjs"],
         ["node", "scripts/verify-wiring.mjs"]]

MUTS = [
    ("M1 el agua ignora el peso real", "src/logic/metabolism.ts",
     "      : 0.035 * p;", "      : 0.035 * 100;"),
    ("M2 el agua con sobrepeso usa el peso real", "src/logic/metabolism.ts",
     "      ? (pesoIdeal * 30 + (p - pesoIdeal) * 10) / 1000",
     "      ? (p * 30) / 1000"),
    ("M3 el extra por hora desaparece", "src/logic/metabolism.ts",
     "export const AGUA_ML_POR_HORA_ACTIVIDAD = 500;",
     "export const AGUA_ML_POR_HORA_ACTIVIDAD = 0;"),
    ("M4 el filtro de saciedad no filtra", "src/components/AutocompleteFood.tsx",
     "        if (filtroSaciedad && item.saciedad !== 'Alta') return false;\n", ""),
    ("M5 el selector no muestra los dias", "src/components/UserProfileCard.tsx",
     "DIAS_POR_NIVEL[formData.nivelActividad]", "''"),
    ("M6 la edad vuelve a ser fija", "src/pages/index.astro",
     "<CardioStrengthCalculator client:load />",
     "<CardioStrengthCalculator edad={44} client:load />"),
    ("M7 el panel no muestra el agua", "src/components/DietModule.tsx",
     "{numEsMax(targets.aguaLitros, 1)}", "{numEsMax(0, 1)}"),
]


def correr():
    return [subprocess.run(c, capture_output=True, text=True, encoding="utf-8", errors="replace")
            for c in GATES]


base = correr()
if any(r.returncode != 0 for r in base):
    print("ABORTO: la linea base no esta verde")
    for r in base:
        if r.returncode:
            print(r.stdout[-600:], r.stderr[-600:])
    sys.exit(1)
print("Linea base VERDE\n")

rojas = 0
for nombre, archivo, viejo, nuevo in MUTS:
    shutil.copy2(archivo, archivo + ".bak")
    src = io.open(archivo, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in src else "\n"
    viejo = viejo.replace("\n", nl)
    nuevo = nuevo.replace("\n", nl)
    if src.count(viejo) != 1:
        print("NO-APLICA %-46s (%d ocurrencias)" % (nombre, src.count(viejo)))
        shutil.copy2(archivo + ".bak", archivo)
        os.remove(archivo + ".bak")
        continue
    io.open(archivo, "w", encoding="utf-8", newline="").write(src.replace(viejo, nuevo, 1))
    res = correr()
    shutil.copy2(archivo + ".bak", archivo)
    os.remove(archivo + ".bak")
    cayo = [i for i, r in enumerate(res) if r.returncode != 0]
    if cayo:
        rojas += 1
        print("ROJO  %-46s gates: %s" % (nombre, ", ".join(str(i + 1) for i in cayo)))
    else:
        print("VERDE %-46s <<< LA MUTACION NO SE DETECTO" % nombre)

final = correr()
if any(r.returncode != 0 for r in final):
    print("\nFALLO: el arbol quedo ROJO tras restaurar")
    sys.exit(1)

print("\n%d/%d mutaciones ROJAS + arbol restaurado VERDE" % (rojas, len(MUTS)))
sys.exit(0 if rojas == len(MUTS) else 1)
