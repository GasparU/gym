# -*- coding: utf-8 -*-
"""Parche de UI del 04/11/2026: deficit visible, formato es-PE, barras con contenedor.
Falla fuerte si un reemplazo no matchea exactamente 1 vez.
"""
import io
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def leer(rel):
    with io.open(os.path.join(BASE, rel), "r", encoding="utf-8", newline="") as f:
        return f.read()


def escribir(rel, txt):
    with io.open(os.path.join(BASE, rel), "w", encoding="utf-8", newline="") as f:
        f.write(txt)


def nl_de(txt):
    return "\r\n" if "\r\n" in txt else "\n"


def rep(txt, viejo, nuevo, veces=1, nombre=""):
    n = txt.count(viejo)
    if n != veces:
        raise SystemExit(
            "FALLO %s: encontre %d ocurrencias, esperaba %d\n>>> %r"
            % (nombre or viejo[:60], n, veces, viejo[:160])
        )
    return txt.replace(viejo, nuevo)


# ---------------- 1. metabolism.ts: deficitKcal ----------------
met = leer("src/logic/metabolism.ts")
NL = nl_de(met)
met = rep(
    met,
    "  metaCalorica: number;",
    "  metaCalorica: number;" + NL + "  deficitKcal: number; // tdee - meta (positivo = lo que recortas)",
    nombre="interface.deficitKcal",
)
met = rep(
    met,
    "  const metaCalorica = redondear(tdee * (1 - deficitPctUsado));",
    "  const metaCalorica = redondear(tdee * (1 - deficitPctUsado));"
    + NL
    + "  const deficitKcal = Math.round(tdee - metaCalorica);",
    nombre="const.deficitKcal",
)
met = rep(
    met,
    "    metaCalorica,",
    "    metaCalorica," + NL + "    deficitKcal,",
    nombre="return.deficitKcal",
)
escribir("src/logic/metabolism.ts", met)

# ---------------- 2. formato.ts (nuevo, puro) ----------------
formato = """/**
 * Formato de numeros en es-PE sin depender del locale del runtime.
 * numEs(1387) -> "1.387"      numEs(2.367005, 2) -> "2,37"
 * numEsMax(95.8, 1) -> "95,8" numEsMax(300, 1) -> "300"
 */
export function numEs(valor: number, decimales = 0): string {
  const n = Number.isFinite(valor) ? valor : 0;
  const fijo = n.toFixed(decimales);
  const negativo = fijo.startsWith('-');
  const [entera, frac] = (negativo ? fijo.slice(1) : fijo).split('.');
  const conMiles = entera.replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
  const cuerpo = decimales > 0 && frac ? `${conMiles},${frac}` : conMiles;
  return negativo ? `-${cuerpo}` : cuerpo;
}

/** Igual que numEs, pero recorta los ceros de cola ("95,80" -> "95,8"). */
export function numEsMax(valor: number, maxDecimales = 2): string {
  const fijo = numEs(valor, maxDecimales);
  if (!fijo.includes(',')) return fijo;
  return fijo.replace(/0+$/, '').replace(/,$/, '');
}
"""
escribir("src/logic/formato.ts", formato)

# ---------------- 3. DietModule.tsx ----------------
src = leer("src/components/DietModule.tsx")
NL = nl_de(src)


def nl(txt):
    return txt.replace("\n", NL)


# 3.1 import
src = rep(
    src,
    'import { computeMealTotals } from "../logic/auditor";',
    'import { computeMealTotals } from "../logic/auditor";'
    + NL
    + 'import { numEs, numEsMax } from "../logic/formato";',
    nombre="import.formato",
)

# 3.2 componente BarraMacro (despues de pctBarra)
barra = """

const BarraMacro: React.FC<{
  nombre: string;
  valor: number;
  objetivo: number;
  unidad: string;
  colorTexto: string;
  colorBarra: string;
}> = ({ nombre, valor, objetivo, unidad, colorTexto, colorBarra }) => {
  const pct = objetivo > 0 ? (valor / objetivo) * 100 : 0;
  const lleno = pctBarra(valor, objetivo);
  const excedido = pct > 100.5;
  const falta = Math.max(0, objetivo - valor);
  const sobra = Math.max(0, valor - objetivo);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={`${colorTexto} font-medium`}>{nombre}</span>
        <span className="text-slate-300">
          {numEsMax(valor, 1)} / {numEs(objetivo)} {unidad}
        </span>
      </div>
      <div
        className="relative w-full bg-slate-950 ring-1 ring-slate-600 rounded-full h-2.5 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.min(100, Math.round(pct))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${nombre}: ${numEsMax(valor, 1)} de ${numEs(objetivo)} ${unidad}`}
      >
        <div
          className={`${
            excedido ? "bg-rose-500" : colorBarra
          } h-2.5 rounded-full transition-all`}
          style={{ width: `${lleno}%` }}
        />
        <span
          className="absolute inset-y-0 left-[99.5%] w-px bg-slate-300/80"
          aria-hidden="true"
        />
      </div>
      <div className="flex justify-between text-[10px] mt-1">
        <span className={excedido ? "text-rose-400" : "text-slate-500"}>
          {excedido
            ? `+${numEsMax(sobra, 1)} ${unidad} sobre el objetivo`
            : `faltan ${numEsMax(falta, 1)} ${unidad}`}
        </span>
        <span className={excedido ? "text-rose-400" : "text-slate-500"}>
          {numEs(pct)} %
        </span>
      </div>
    </div>
  );
};
"""
src = rep(
    src,
    "  objetivo > 0 ? Math.min(100, (valor / objetivo) * 100) : 0;",
    "  objetivo > 0 ? Math.min(100, (valor / objetivo) * 100) : 0;" + nl(barra),
    nombre="BarraMacro",
)

# 3.3 grid de 5 columnas
src = rep(
    src,
    "grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-800/80",
    "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 bg-slate-800/80",
    nombre="grid-5",
)

# 3.4 bloque Meta -> Deficit + Meta
pat_meta = re.compile(
    r"<div>\s*<span className=\"text-xs text-slate-400 block\">\s*Meta \{objetivoEtiqueta\(targets\.deficitPctUsado\)\} \(−\s*\{Math\.round\(targets\.deficitPctUsado \* 100\)\}%\)\s*</span>\s*<span className=\"text-xl font-bold text-amber-400\">\s*\{targets\.metaCalorica\} kcal\s*</span>\s*<span className=\"text-\[10px\] text-slate-400 block\">\s*Presupuesto diario\s*</span>\s*</div>",
    re.S,
)
m = pat_meta.search(src)
if not m:
    raise SystemExit("FALLO bloque Meta: no matcheo")
indent = src[: m.start()].split("\n")[-1]
if indent.strip():
    raise SystemExit("FALLO bloque Meta: indent raro %r" % indent)
nuevo_meta = (
    "<div>{NL}"
    "{i}  <span className=\"text-xs text-slate-400 block\">Déficit</span>{NL}"
    "{i}  <span className=\"text-xl font-bold text-rose-400\">{NL}"
    "{i}    −{numEs(targets.deficitKcal)} kcal{NL}"
    "{i}  </span>{NL}"
    "{i}  <span className=\"text-[10px] text-slate-400 block\">{NL}"
    "{i}    −{numEs(targets.deficitPctUsado * 100)} % del gasto total{NL}"
    "{i}  </span>{NL}"
    "{i}</div>{NL}"
    "{i}<div>{NL}"
    "{i}  <span className=\"text-xs text-slate-400 block\">{NL}"
    "{i}    Meta {objetivoEtiqueta(targets.deficitPctUsado)} (−{NL}"
    "{i}    {numEs(targets.deficitPctUsado * 100)} %){NL}"
    "{i}  </span>{NL}"
    "{i}  <span className=\"text-xl font-bold text-amber-400\">{NL}"
    "{i}    {numEs(targets.metaCalorica)} kcal{NL}"
    "{i}  </span>{NL}"
    "{i}  <span className=\"text-[10px] text-slate-400 block\">{NL}"
    "{i}    Presupuesto diario{NL}"
    "{i}  </span>{NL}"
    "{i}</div>"
).replace("{NL}", NL).replace("{i}", indent)
src = src[: m.start()] + nuevo_meta + src[m.end() :]

# 3.5 numeros del panel
pares = [
    ("{targets.tmb} kcal", "{numEs(targets.tmb)} kcal"),
    ("{targets.tdee} kcal", "{numEs(targets.tdee)} kcal"),
    (
        "`Katch-McArdle · MLG ${targets.masaLibreGrasa} kg`",
        '`Katch-McArdle · MLG ${\n                        targets.masaLibreGrasa !== null\n                          ? numEsMax(targets.masaLibreGrasa, 2)\n                          : "—"\n                      } kg`',
    ),
    (
        "`Mifflin-St Jeor · ${profile.peso} kg (peso real)`",
        "`Mifflin-St Jeor · ${numEsMax(profile.peso, 1)} kg (peso real)`",
    ),
    ("{totalAudit.energiaTablaKcal} kcal", "{numEs(totalAudit.energiaTablaKcal)} kcal"),
    ("{totalAudit.energiaAtwaterKcal}", "{numEs(totalAudit.energiaAtwaterKcal)}"),
    ("{totalAudit.diferenciaKcal}", "{numEs(totalAudit.diferenciaKcal)}"),
    ("{totalAudit.toleranciaKcal}", "{numEs(totalAudit.toleranciaKcal)}"),
    ("{targets.proteinaFactorGkg} g/kg", "{numEs(targets.proteinaFactorGkg, 2)} g/kg"),
    (
        "{reparto.proteina}% proteína · {reparto.grasa}% grasa ·{\" \"}",
        "{numEsMax(reparto.proteina, 1)} % proteína · {numEsMax(reparto.grasa, 1)} % grasa ·{\" \"}",
    ),
    (
        "{reparto.carbohidratos}% carbohidratos",
        "{numEsMax(reparto.carbohidratos, 1)} % carbohidratos",
    ),
]
for viejo, nuevo in pares:
    src = rep(src, viejo, nuevo.replace("\n", NL), nombre="num:" + viejo[:40])

# 3.6 seccion 3: "te queda" + barras nuevas
m3 = re.search(r"[ \t]*\{/\* 3\. Barras de Progreso de Macronutrientes \*/\}", src)
m4 = re.search(r"[ \t]*\{/\* 4\. Tablas por Comida \*/\}", src)
if not m3 or not m4 or m3.start() >= m4.start():
    raise SystemExit("FALLO seccion 3: marcadores no encontrados")
ind3 = m3.group()[: m3.group().index("{")]

bloque3 = """{i}{/* 3. Balance de macronutrientes: barra contenedora + cuanto falta */}
{i}{(() => {
{i}  const restanteKcal = targets.metaCalorica - totalAudit.energiaTablaKcal;
{i}  const restanteProteina = targets.targetProteinaG - totalAudit.proteinasG;
{i}  const pasado = restanteKcal < 0;
{i}  return (
{i}    <div
{i}      className={`rounded-xl border p-3 text-sm ${
{i}        pasado
{i}          ? "border-rose-700 bg-rose-950/40 text-rose-300"
{i}          : "border-emerald-700 bg-emerald-950/40 text-emerald-300"
{i}      }`}
{i}    >
{i}      {pasado ? (
{i}        <>
{i}          Te pasaste del presupuesto por{" "}
{i}          <b>{numEs(-restanteKcal)} kcal</b>.
{i}        </>
{i}      ) : (
{i}        <>
{i}          Te queda hoy: <b>{numEs(restanteKcal)} kcal</b> ·{" "}
{i}          <b>{numEsMax(Math.max(0, restanteProteina), 1)} g de proteína</b>.
{i}        </>
{i}      )}
{i}    </div>
{i}  );
{i}  })()}
{i}<div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
{i}  <h3 className="text-sm font-semibold text-slate-200">
{i}    Balance de Macronutrientes del Día
{i}  </h3>
{i}  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
{i}    <BarraMacro
{i}      nombre="Proteínas"
{i}      valor={totalAudit.proteinasG}
{i}      objetivo={targets.targetProteinaG}
{i}      unidad="g"
{i}      colorTexto="text-blue-400"
{i}      colorBarra="bg-blue-500"
{i}    />
{i}    <BarraMacro
{i}      nombre="Grasas"
{i}      valor={totalAudit.grasaG}
{i}      objetivo={targets.targetGrasaG}
{i}      unidad="g"
{i}      colorTexto="text-amber-400"
{i}      colorBarra="bg-amber-500"
{i}    />
{i}    <BarraMacro
{i}      nombre="Carbohidratos"
{i}      valor={totalAudit.carbohidratosG}
{i}      objetivo={targets.targetCarbohidratosG}
{i}      unidad="g"
{i}      colorTexto="text-emerald-400"
{i}      colorBarra="bg-emerald-500"
{i}    />
{i}  </div>
{i}</div>
"""
bloque3 = bloque3.replace("{i}", ind3).replace("\n", NL)
src = src[: m3.start()] + bloque3 + src[m4.start() :]

escribir("src/components/DietModule.tsx", src)

# ---------------- 4. gate: assertions nuevas ----------------
gate = leer("scripts/verify-metabolism.mjs")
NLg = nl_de(gate)
gate = rep(
    gate,
    "import { computeMealTotals } from '../src/logic/auditor.ts';",
    "import { computeMealTotals } from '../src/logic/auditor.ts';"
    + NLg
    + "import { numEs, numEsMax } from '../src/logic/formato.ts';",
    nombre="gate.import",
)
checks = """// ---------- Formato es-PE y deficit visible (04/11/2026) ----------
check('formato: 1.387 con separador de miles', numEs(1387), '1.387');
check('formato: 2,37 con 2 decimales', numEs(2.3670053795576806, 2), '2,37');
check('formato: negativo', numEs(-374), '-374');
check('formato: redondeo de 1386,9', numEs(1386.9), '1.387');
check('formato: 95,8 sin cero de cola', numEsMax(95.8, 1), '95,8');
check('formato: 300 entero sin coma', numEsMax(300, 1), '300');
check('formato: los ceros de miles no se recortan', numEsMax(1000, 1), '1.000');
check('deficit: tdee - meta', A.deficitKcal, A.tdee - A.metaCalorica);
check('deficit: perfil real', R.deficitKcal, R.tdee - R.metaCalorica);

"""
gate = rep(
    gate,
    "console.log('=== Núcleo metabólico: verificación ===');",
    checks.replace("\n", NLg) + "console.log('=== Núcleo metabólico: verificación ===');",
    nombre="gate.checks",
)
escribir("scripts/verify-metabolism.mjs", gate)

print("OK: metabolism.ts + formato.ts + DietModule.tsx + verify-metabolism.mjs")
