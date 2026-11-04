# -*- coding: utf-8 -*-
import io, os, shutil, subprocess, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BAK = os.path.join(BASE, 'backups', '2026-11-04', 'post-ui')

MUTS = [
    ("M1 deficitKcal = meta", "src/logic/metabolism.ts",
     "const deficitKcal = Math.round(tdee - metaCalorica);",
     "const deficitKcal = Math.round(metaCalorica);",
     "deficit: tdee - meta"),
    ("M2 sin separador de miles", "src/logic/formato.ts",
     r"const conMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');",
     "const conMiles = entera;",
     "formato: 1.387"),
    ("M3 numEsMax no recorta ceros", "src/logic/formato.ts",
     r"return fijo.replace(/0+$/, '').replace(/,$/, '');",
     "return fijo;",
     "formato: 95,8 recorta el cero con 2 decimales"),
    ("M4 track invisible", "src/components/DietModule.tsx",
     "bg-slate-950 ring-1 ring-slate-600",
     "bg-slate-900",
     "wiring: barra con contenedor"),
    ("M5 marca al borde", "src/components/DietModule.tsx",
     "left-[99.5%]",
     "left-[100%]",
     "wiring: marca del 100%"),
]

def restaurar(rel):
    shutil.copyfile(os.path.join(BAK, os.path.basename(rel)), os.path.join(BASE, rel))

def correr():
    return subprocess.run([('node.exe' if os.name == 'nt' else 'node'), 'scripts/verify-metabolism.mjs'],
                          cwd=BASE, capture_output=True, text=True, encoding='utf-8', errors='replace')

rojas = 0
for nombre, rel, viejo, nuevo, esperado in MUTS:
    restaurar(rel)
    p = os.path.join(BASE, rel)
    s = io.open(p, encoding='utf-8', newline='').read()
    if s.count(viejo) != 1:
        print("NO-APLICA %s: %d ocurrencias" % (nombre, s.count(viejo)))
        restaurar(rel)
        continue
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(viejo, nuevo))
    r = correr()
    texto = (r.stdout or '') + (r.stderr or '')
    ok = r.returncode != 0 and esperado in texto
    rojas += 1 if ok else 0
    linea = next((l.strip() for l in texto.splitlines() if esperado in l), '(no aparece la asercion)')
    print(("ROJA  " if ok else "VERDE!") + " " + nombre + " -> " + linea[:120])
    restaurar(rel)

final = correr()
print("\nGate final: " + final.stdout.strip().splitlines()[-1])
print("Mutaciones rojas: %d/%d" % (rojas, len(MUTS)))
sys.exit(0 if rojas == len(MUTS) and final.returncode == 0 else 1)
