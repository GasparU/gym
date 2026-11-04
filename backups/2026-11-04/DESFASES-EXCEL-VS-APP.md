# Desfases entre el Excel y la app (nutrición) — 03/11/2026

Auditoría de solo lectura primero, corrección después (autorizada por el dueño).
Todo lo que sigue está **medido**, no supuesto. Los números salen de
`formula nutricion.xlsx` y del código de `src/`.

Perfil de referencia: **hombre, 44 años, 98 kg, 175 cm, 3 días de gym, déficit 15%,
28% de grasa corporal** (los datos del Excel, hoja `Objetivos`).

---

## 1. Lo que decía cada lado (antes del cambio)

| | **Excel** | **App (antes)** | Diferencia |
|---|---|---|---|
| TMB | **1.675** (`Objetivos!K16`) | **1.675** | iguales ✅ |
| TDEE | **2.303** (`Objetivos!K20`) | **2.303** | iguales ✅ |
| Meta | **1.958** (`Objetivos!K22`) | **1.958** | iguales ✅ |
| Proteína | **49 g** = 10% de kcal (`Dieta!C6`) | **159 g** = 2,0 g/kg | **3,2×** ❌ |
| Grasa | **65 g** = 30% (`Dieta!C7`) | **60 g** = 0,75 g/kg | 1,08× ≈ |
| Carbohidratos | **294 g** = 60% (`Dieta!C5`) | **196 g** = resto | **1,5×** ❌ |

**La desconexión de fondo:** el Excel reparte por **porcentajes fijos (60/10/30)**;
la app reparte por **gramos por kilo**. Mismas calorías, tres veces más proteína.

Los 1.675 kcal salen de Mifflin-St Jeor con **peso ajustado**
(`Objetivos!X21`: `10 × 79,625 + 6,25 × 175 − 5 × 44 + 5`), no con el peso real.

---

## 2. Desfases encontrados (con celda)

| # | Qué | Evidencia | Estado |
|---|---|---|---|
| D1 | Proteína por % (10%) en vez de g/kg → **49 g** en un hombre de 98 kg (0,5 g/kg) | `Dieta!C6` = 0,1 × 1958 = 195,8 kcal ÷ 4 | ✅ Corregido en la app (g/kg). El Excel queda como legado. |
| D2 | TMB con **peso ajustado** en vez de peso real o masa libre de grasa | `Objetivos!X21` (IMC > 30) | ✅ Corregido en la app (Katch-McArdle si hay % grasa; si no, Mifflin con peso real) |
| D3 | **Katch-McArdle muerto y roto**: `X19` ya multiplica por el factor de actividad; si se conecta a `L17`, `L21` lo multiplica **otra vez** (1.894 × 1,375 × 1,375 = **3.581**) | `Objetivos!X19` y `L21` | ⚠️ Excel: corregir a mano (ver §6) |
| D4 | Factor de actividad con **concatenación** `&` en vez de un IF: con días fraccionarios devuelve el texto `"1.3751.55"` | `Objetivos!L20` | ⚠️ Excel: corregir a mano |
| D5 | Clasificación de IMC **con huecos** en los bordes (IMC exacto 25, 29,9–30, 18,5 → texto vacío) | `Objetivos!L6` y `Historial Dietetico!C44:H44` | ✅ Corregido en la app (`clasificarImc`); Excel: a mano |
| D6 | Carbohidratos: el Excel usa **disponibles** (col. I), la app usa **totales** (col. H) | `Dieta!I16` (VLOOKUP índice 7) vs `DietModule.tsx` | ✅ **La app tenía razón** (ver §3). No se cambió. |
| D7 | El Excel calcula **ETA/TEF** (151,7 kcal = 7,8%), la app no lo mostraba | `Dieta!C10` | ⏳ No implementado (no mueve las metas; es informativo) |
| D8 | La app no dejaba tocar **déficit** (fijo 15%) ni el **% de grasa** ni el **nivel de actividad** | `UserProfileCard.tsx` | ✅ Corregido en la app |

### Sobre D6 (donde me equivoqué y lo corrijo)

Medí los 927 alimentos de `public/data/foods.json` comparando la energía de la
tabla contra Atwater:

| Fórmula | Error medio | Pasan ≤ 25 kcal |
|---|---|---|
| 4/4/9 con **totales** (app) | **19,4 kcal/100 g** | **741 / 927 (80%)** |
| 4/4/9 con disponibles (Excel) | 50,3 kcal/100 g | 647 / 927 |
| Totales + fibra × 2 | 25,3 kcal/100 g | 678 / 927 |

Además **311 alimentos** tienen `carbohidratosDisponibles = 0` con
`carbohidratosTotales > 1` (columna con huecos). ⟹ **Se mantiene `totales`.**
Lo que sí estaba mal era el **auditor** (tolerancia fija de 25 kcal): ahora usa
`max(25 kcal, 10% de la energía)` y distingue "redondeos" de "dato sospechoso".

---

## 3. Reglas nuevas (implementadas en `src/logic/metabolism.ts`)

1. **TMB**
   - Con `% de grasa` válido (5–60%): **Katch-McArdle** = `370 + 21,6 × masa libre de grasa`.
   - Sin % de grasa: **Mifflin-St Jeor con peso REAL** = `10·peso + 6,25·talla − 5·edad + 5 (H) / −161 (M)`.
   - El **peso ajustado** se sigue calculando, pero **solo como referencia**: no entra en la TMB.
2. **Factor de actividad**
   - Si se elige un nivel (incluye el trabajo/NEAT): `1,2 / 1,375 / 1,55 / 1,725`.
   - Si no, se deriva de los días de entrenamiento (0–1 → 1,2; 2–3 → 1,375; 4–5 → 1,55; 6–7 → 1,725) **y se avisa** que es un supuesto.
3. **Déficit**: 5–35%, por defecto 15%. Fuera de rango se recorta y se avisa.
4. **Proteína en g/kg** (nunca %): `2,3 g/kg` de masa libre de grasa si se conoce; `1,8 g/kg` de peso real si no. Techo: **40%** de las kcal.
5. **Grasa**: `0,75 g/kg` de la misma base, con **piso del 20%** de las kcal y **techo del 35%**.
6. **Carbohidratos**: el resto. Si no alcanza, se declara (no se inventa un negativo).
7. La app **declara** qué fórmula usó, sobre qué base y por qué (lista de `avisos`).

---

## 4. Antes / después (perfil real)

| | **Antes** | **Después sin % grasa** | **Después con 28%** | **Excel** |
|---|---|---|---|---|
| TMB | 1.675 | 1.859 (Mifflin real) | **1.894** (Katch) | 1.675 |
| TDEE | 2.303 | 2.556 | **2.604** | 2.303 |
| Meta (15%) | 1.958 | 2.173 | **2.213** | 1.958 |
| Proteína | 159 g (32%) | 176 g (32%) | **162 g (29%)** | 49 g (10%) |
| Grasa | 60 g (28%) | 74 g (31%) | **53 g (22%)** | 65 g (30%) |
| Carbohidratos | 196 g (40%) | 201 g (37%) | **272 g (49%)** | 294 g (60%) |

**Impacto:** +255 kcal/día y +3 g de proteína respecto de antes (con el % de grasa
cargado). Los carbohidratos suben porque la grasa baja al rango hormonal.
Si además el trabajo es **sedentario**, el factor baja a 1,2 → meta **1.932 kcal**
(−281 kcal respecto de la versión con 1,375).

---

## 5. Archivos tocados

- `src/logic/metabolism.ts` — reescrito (núcleo puro). Se mantienen los nombres
  `UserProfile`, `MetabolicResult` y `calculateMetabolicTargets`; los campos nuevos
  son aditivos.
- `src/logic/auditor.ts` — tolerancia relativa + `posibleErrorDeOrigen`.
- `src/components/UserProfileCard.tsx` — campos **% grasa**, **actividad/trabajo** y
  **déficit**; muestra la fórmula y la fuente del factor.
- `src/components/DietModule.tsx` — meta dinámica (ya no dice "-15%" fijo), panel
  **"Cómo se calcularon tus metas"** con el reparto real y los avisos, barras a prueba
  de división por cero y el estado del chequeo de Atwater con su tolerancia.
- `scripts/verify-metabolism.mjs` — **62 aserciones** que importan el código real
  (no copias) y una tabla de salida.
- Backups de los 4 archivos originales en `backups/2026-11-03/`.

**No se tocó** `src/services/cloudSync.ts`: las columnas de Supabase
(`body_metrics`) siguen recibiendo los mismos nombres; `peso_ajustado` ahora es
informativo (misma columna, mismo significado clínico).

---

## 6. Lo que queda pendiente (NO se hizo)

1. **El Excel** (no lo reescribí a propósito: SheetJS al guardar pierde estilos,
   formato y puede romper fórmulas). Correcciones a mano, si se quiere:
   - `Objetivos!X19`: quitar el `*L20` (debe devolver TMB, no TDEE).
   - `Objetivos!L20`: reemplazar el `&` por un solo `SI` anidado que devuelva un número.
   - `Objetivos!L6` y `Historial Dietetico!C44:H44`: cerrar los bordes (`>=` / `<=`).
   - `Dieta!C6`: si se quiere alinear con la app, cambiar el 10% por proteína en g/kg.
2. **ETA/TEF** (`Dieta!C10`): no se muestra en la app.
3. **Lado entrenamiento** (`Formato de Ejercicios.xlsx` vs `trainingScience.ts`):
   falta la auditoría (0–7 días, historial con fecha, 1RM duplicado en 2 componentes).
4. **No hay framework de tests** en el proyecto: la red es el script de verificación
   + `astro build`. Si se quiere CI, hay que agregar `vitest` (hoy no está instalado).

---

## 7. Gates corridos (03/11/2026, hora de Lima)

| Gate | Resultado |
|---|---|
| `node scripts/verify-metabolism.mjs` | **62/62 aserciones OK** |
| Mutaciones (6) | **6/6 ROJAS** por su aserción (sin Katch, proteína 0,5 g/kg, sin piso de grasa, escalera de días, tolerancia del auditor, sin techo de proteína) |
| `npx astro build` | **OK** (1 página, 6,89 s) |
| `tsc --noEmit` sobre los 5 archivos tocados | **0 errores propios** (quedan 2 preexistentes en `src/lib/supabase.ts`: falta `astro/client` en el chequeo aislado) |

---

## 8. Actualización 03/11/2026 (segunda pasada) — datos REALES + rutina en la app

### 8.1 El 28 % de grasa era un supuesto
El dueño confirmó que el 28 % del Excel **no se midió** ("lo puse al ojo"). Consecuencia:
**toda la rama Katch calculada antes (1.894 / 2.213 / 53 g) queda invalidada**. Regla nueva:
ningún número de composición corporal entra al cálculo si no viene de una medición.

Datos reales: **99 kg · 175 cm · 44 a · cintura 115 cm · cuello 44 cm** → IMC **32,3**.

### 8.2 Calculadora Navy (nueva)
`estimarGrasaNavy()` en `src/logic/metabolism.ts` (US Navy / Hodgdon-Beckett, versión métrica).
Con 115/44/175 → **32,5 %** (0,325). Valida rangos y devuelve `null` si las medidas no tienen
sentido (cintura ≤ cuello, talla fuera de 120-230, mujer sin cadera). En la UI está en
`BodyFatEstimator.tsx`, debajo del campo "% Grasa".

### 8.3 Proteína: dos pisos, se toma el mayor
En obesidad, `2,3 g/kg × masa magra` da 154 g = **1,56 g/kg de peso total**: corto para un
déficit. Ahora: `max(2,3 g/kg MLG, 1,6 g/kg peso)` (Helms 2014 + Morton 2018). Para el perfil
real → **158 g** (1,6 g/kg peso · 2,36 g/kg MLG). Los perfiles A y B (sin obesidad) no cambian.

### 8.4 Perfil real calculado

| | Valor |
|---|---|
| TMB (Katch, MLG 66,92 kg) | **1.815** |
| TDEE (×1,375, elegido) | **2.496** |
| Meta −15 % | **2.122** |
| Proteína / Grasa / Carbos | **158 g / 50 g / 260 g** |

### 8.5 La rutina vieja estaba en la base
`workout_exercises` tenía **12 filas** con un split que **no es el del dueño** (Pecho-Piernas-
Hombros, "Lunes y Jueves") e incluía **sentadilla y peso muerto rumano**, justo lo que su
programa evita ("cero carga lumbar"). Ahora la rutina vive en **`src/logic/routines.ts`**
(fuente única, 3 días / 15 ejercicios / series / técnica y descanso en la nota) y
`scripts/sync-routine.mjs` (**dry-run por defecto**, `--apply` respalda y reemplaza) dejó la
base con **15 filas correctas**. El **día 4 queda vacío a propósito**: lo define el dueño en
el mes 2 (no lo inventamos).

### 8.6 Progreso de ejercicios
`src/logic/progress.ts` (`resumenProgreso`) lee la matriz `workout_matrix_progress`
(semana → volumen kg) y devuelve última/mejor/Δ %/tendencia. La tabla de ejercicios muestra
una columna **Progreso** (▲ / ▼ / =, con el Δ % de las últimas 4 semanas). Sin datos muestra
"—", nunca un 0 disfrazado.

### 8.7 Gates de esta pasada
| Gate | Resultado |
|---|---|
| `node scripts/verify-metabolism.mjs` | **94/94** (antes 62) |
| Mutaciones | **10/10 ROJAS** por su aserción |
| `npx astro build` | **OK** |
| `tsc --noEmit` (16 archivos) | **0 errores propios** |
| `node scripts/check-supabase.mjs` | 5/5 tablas OK · `workout_exercises` **15 filas** |
| `sync-routine.mjs --apply` | respaldo + 12 borradas + 15 insertadas |

**Bug propio cazado antes de verificar:** `estimarGrasaNavy` dividía por 100 en vez de 1000
y habría devuelto **3,25** en lugar de **0,325**. Está cubierto por dos aserciones y la
mutación M7.

---

## 9. Días editables (03/11/2026, tercera pasada)

- Quedan **3 días** (Lunes torso / Miércoles inferior + abdomen / Viernes full body). El día 4 se
  **crea** con ➕ y se puede **renombrar** (✎) o **borrar** (🗑).
- 🔴 **Bug propio cazado por la mutación:** `siguienteIdDia` usaba `max = parseInt(...)` en vez de
  `Math.max`, así que con los días en orden invertido (`dia-3`, `dia-1`) proponía **`dia-2`** —
  un id que ya existía → el día nuevo se **fusionaba** con el 2. Ahora usa `Math.max` y hay una
  aserción con el orden invertido (M3 roja).
- **Trampa de proceso repetida:** un script de mutación se cayó por encoding y dejó `days.ts`
  **mutado**. Se detectó porque el gate final seguía en rojo. El runner ahora restaura en `finally`
  y **siempre** re-corre el gate al terminar.

| Gate | Resultado |
|---|---|
| `node scripts/verify-metabolism.mjs` | **111/111** (antes 94) |
| Mutaciones (días) | **7/7 ROJAS** por su aserción |
| `npx astro build` | **OK** |
| `tsc --noEmit` | **0 errores propios** |
| HTML servido (4321) | 3 días + ➕ Día + ✎ Editar día + 🗑 Eliminar día |
