# -*- coding: utf-8 -*-
"""Mutaciones de la DIETA PERSISTENTE. Cada una debe poner ROJO el gate
`verify-dieta.mjs` POR SU ASERCION (no por un error de sintaxis).
Restaura desde el backup y verifica que el gate vuelva a verde."""
import io
import os
import shutil
import subprocess
import sys

MUTS = [
    ("M1 normalizar no recupera foodId", "src/logic/dieta.ts",
     "if (foods.length === 0) return meals;", "return meals;",
     "normalizar: recupera foodId por nombre"),
    ("M2 la nube acepta nombres vacios", "src/logic/dieta.ts",
     "if (nombre.length === 0) continue;", "",
     "nube: descarta nombre vacio y tipo desconocido"),
    ("M3 la UI no baja el dia al abrir", "src/components/DietModule.tsx",
     "loadMealsForDate(fechaHoy).then", "Promise.resolve(null).then",
     "ui: baja el dia al abrir"),
    ("M4 cambiar gramos no persiste", "src/components/DietModule.tsx",
     "fibra: parseFloat((foodRef.fibra * factor).toFixed(1)),<N>        };<N>      }),<N>    };<N>    cambiosLocales.current = true;<N>    setMeals(siguiente);<N>    persistir(siguiente, mealType);",
     "fibra: parseFloat((foodRef.fibra * factor).toFixed(1)),<N>        };<N>      }),<N>    };<N>    cambiosLocales.current = true;<N>    setMeals(siguiente);",
     "ui: persiste al cambiar gramos y al borrar"),
    ("M5 la cache nunca sirve", "src/logic/dieta.ts",
     "return algo ? salida : null;", "return null;",
     "cache: recupera el dia"),
]


def correr():
    return subprocess.run(
        ["node", "scripts/verify-dieta.mjs"],
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
        print("NO-APLICA %-38s (%d ocurrencias)" % (nombre, src.count(viejo)))
        shutil.copy2(archivo + ".bak", archivo)
        os.remove(archivo + ".bak")
        continue
    io.open(archivo, "w", encoding="utf-8", newline="").write(src.replace(viejo, nuevo, 1))
    r = correr()
    shutil.copy2(archivo + ".bak", archivo)
    os.remove(archivo + ".bak")
    salida = (r.stdout or "") + (r.stderr or "")
    if r.returncode == 0:
        print("VERDE    %-38s (LA MUTACION NO FUE DETECTADA)" % nombre)
    elif esperado in salida:
        rojas += 1
        print("ROJA     %-38s -> %s" % (nombre, esperado))
    else:
        print("ROJA?    %-38s (rojo, pero por otra razon)" % nombre)
        for linea in salida.splitlines():
            if "obtuve" in linea:
                print("           " + linea.strip()[:120])

final = correr()
print("\nGate final:", final.stdout.strip().splitlines()[-1].encode("ascii", "replace").decode("ascii"))
print("Mutaciones rojas por su asercion: %d/%d" % (rojas, len(MUTS)))
sys.exit(0 if rojas == len(MUTS) and final.returncode == 0 else 1)
