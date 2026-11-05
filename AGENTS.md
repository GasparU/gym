## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Reglas de negocio (metabolismo) — 03/11/2026

Detalle y mediciones: `DESFASES-EXCEL-VS-APP.md`.

- **TMB**: Katch-McArdle si hay `% de grasa` (5-60%); si no, Mifflin-St Jeor con **peso REAL**. El peso ajustado se informa pero **no entra** en la TMB.
- **El `% de grasa` JAMÁS se inventa**: o lo medís (DEXA/pliegues/báscula buena) o lo estimás con `estimarGrasaNavy` (cintura + cuello) en la UI. Datos medidos el 03/11/2026: 99 kg · 175 cm · cintura 115 · cuello 44 → **32,5 %**.
- **Proteína en g/kg, nunca por porcentaje**: el MAYOR de `2,3 g/kg de masa libre de grasa` y `1,6 g/kg de peso total` (el piso de 1,6 existe para que en obesidad no quede corta). Techo: 40% de las kcal.
- **La rutina es del dueño**: vive en `src/logic/routines.ts` (fuente única). NO inventar ejercicios ni días; el día 4 está vacío a propósito. Para re-sembrar: `node scripts/sync-routine.mjs --apply` (respalda antes).
- **Grasa**: 0,75 g/kg con **piso del 20%** de las kcal (hormonal) y techo del 35%.
- **Factor de actividad**: nivel explícito (1,2 / 1,375 / 1,55 / 1,725) o derivado de los días de gym, declarando que es un supuesto.
- **Déficit**: 5-35%, por defecto 15%.
- **Carbohidratos de la tabla**: usar `carbohidratosTotales` (medido: 741/927 alimentos cuadran con la energía de la tabla; con `disponibles` solo 647, y 311 filas tienen disponibles = 0).
- **Gate obligatorio tras tocar el núcleo**: `node scripts/verify-metabolism.mjs` (**114 aserciones** que importan el código real) + `node scripts/verify-semanas.mjs` (**54**) + `node scripts/check-supabase.mjs` (las tablas existen). Mutaciones: `py -3 scripts/mutaciones-04nov.py` (9/9 ROJAS por aserción).

## Deploy (Vercel) — la configuración es OBLIGATORIA en el BUILD (04/11/2026)

- **Las 2 variables tienen que existir en la máquina que compila:** `PUBLIC_SUPABASE_URL` y
  `PUBLIC_SUPABASE_ANON_KEY`. El sitio es **estático**, así que Astro **incrusta** los `PUBLIC_*` en el
  JS al compilar: no se leen en el navegador. Tener el `.env` local **no alcanza** para Vercel.
- **Dónde se configuran:** Vercel → Settings → Environment Variables (Production + Preview +
  Development) y después **Redeploy** (cambiar una variable NO reconstruye las builds viejas).
- **Si faltan, el build FALLA a propósito** con:
  `[Supabase no configurado] Faltan las DOS variables en el entorno de BUILD: ... Se configura en Vercel → ...`
  **Falla en el build y no en el navegador**: un sitio publicado sin configurar se ve vacío y confunde.
- **Núcleo puro:** `src/logic/supabase-config.ts` (`configSupabase(url, key)`) valida **presencia Y
  formato** (Project URL vs. URL del panel; `eyJ...`/`sb_publishable_...` vs. pegar la service_role o
  un snippet). `src/lib/supabase.ts` solo lo usa y tira el `Error` si no está ok.
- **Gate:** `node scripts/verify-config-supabase.mjs` (**35 aserciones**, importa el código real).
- **Antes** este archivo hacía `console.warn('⚠️ Variables de Supabase no detectadas')` y **la línea
  siguiente explotaba** con `supabaseUrl is required` + 10 líneas de traza sin decir qué faltaba. Esa fue
  la caída del deploy del 04/11/2026: el aviso era decorativo.
- **`.env` está en `.gitignore:17`** (verificado con `git check-ignore`): no se filtró al repo.
- **⚠️ Seguridad (decisión pendiente del dueño):** la `anon key` viaja en el JS del sitio y las tablas
  tienen RLS `using (true)` → **cualquiera con el link puede leer y borrar los datos**. Opciones:
  aceptarlo · Supabase Auth + RLS por usuario · protección de sitio de Vercel (plan pago).

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## UI: lo que la pantalla dice tiene que ser verdad (03/11/2026)

- **Prohibido el estado hardcodeado.** La tabla de ejercicios mostraba "● Sincronizado con Supabase"
  **siempre**, aunque el `select` hubiera fallado → el usuario veía una mentira. Ahora es tri-estado:
  `● N ejercicios · M días` / `⚠ Sin conexión con la base: <mensaje real>` + botón ⟳ Recargar.
- **Un error de render NO puede dejar la pantalla muda.** `ErrorBoundary.tsx` envuelve el módulo
  (via `WorkoutPanel.tsx`): si React falla, se lee el mensaje y hay botón de recarga.
- **`loadData()` ya no se traga el error**: si `select` devuelve `error`, corta y lo declara. Antes
  intentaba sembrar y la pantalla quedaba vacía sin explicación.
- **Estados de carga visibles**: mientras `loading` es true se lee "Cargando tus ejercicios…".
- **Cada botón de día lleva su contador** (cuántos ejercicios tiene). Es la forma de saber de un
  vistazo dónde está la rutina y si el día 4 (vacío a propósito) ya tiene contenido.
- **El campo `calentamiento` se rotula "Nota (técnica / descanso)"**: es el único texto libre de la
  tabla y ahí van los rangos, el descanso y la indicación técnica — no un calentamiento.

## Días de entrenamiento EDITABLES (03/11/2026)

- **Los días son DATOS, no una constante.** Vivían en `RUTINA` (`routines.ts`) como lista fija;
  ahora el estado es `dias: DiaGuardado[]` en `WorkoutModule`, con núcleo PURO en
  `src/logic/days.ts` (`normalizarDias`, `siguienteIdDia`, `diasFaltantes`, `validarDia`,
  `puedeEliminarDia`).
- **Se arranca con 3 días** (`DIAS_INICIALES`, derivado de `RUTINA`). El día 4 ya no existe: se
  crea con el botón **➕ Día**.
- **Crear / editar / eliminar**: ➕ Día · ✎ Editar día · 🗑 Eliminar día (con confirmación en
  línea, nunca `window.confirm`). **No se puede quedar sin días** (`puedeEliminarDia`).
- **Borrar un día borra sus ejercicios en Supabase** (`delete().eq('rutina_id', id)`), y la
  confirmación dice cuántos se van a borrar.
- **Persistencia**: los días (id, nombre, cuándo) se guardan en `workout_days` (Supabase) **y** en `localStorage['workout_days_v1']` como caché; los ejercicios viven en `workout_exercises`. Al abrir se **lee la base** y la base manda (04/11/2026). Si el storage se pierde, el efecto `diasFaltantes` **reincorpora** los días que tengan ejercicios, así no queda nada invisible.
- ✅ **Ya NO es un límite**: los días viajan entre dispositivos. Requiere correr **una vez** el SQL `supabase/2026-11-04_rutina_en_la_nube.sql` (la anon key no puede hacer DDL). Si falta esa tabla, la app **no rompe**: muestra un aviso ámbar y sigue con la caché local (`faltaSql`).

## TODO va a la NUBE y se LEE de la nube (04/11/2026)

**Regla del dueño:** un dato no puede vivir solo en `localStorage`. Se escribe en Supabase **y** se
recupera al abrir, para que se vea igual desde cualquier equipo (Render/Vercel incluidos).
`localStorage` queda como **caché de arranque** (pantalla instantánea y modo sin red), nunca como
fuente de verdad.

| Dato | Tabla | Antes |
|---|---|---|
| Días de entrenamiento | `workout_days` | solo localStorage |
| Semanas de la matriz | `workout_weeks` | no existían (números sueltos) |
| Peso por ejercicio y semana | `workout_week_sets` | `workout_matrix_progress` (por número, guardaba VOLUMEN) |
| Perfil metabólico | `body_metrics` | **solo se SUBÍA**: nunca se leía → un equipo nuevo arrancaba con el default |

- **`src/services/workoutSync.ts`** centraliza el ida-y-vuelta y distingue "la tabla no existe"
  (`42P01`/`PGRST205`) de un error de red: en el primer caso devuelve `faltaSql: true` y la UI avisa.
- **`loadLatestBodyMetrics()`** (en `cloudSync.ts`) lee la última fila de `body_metrics`. `body_metrics`
  ganó `sexo`, `dias_entrenamiento`, `deficit_pct`, `grasa_pct`, `nivel_actividad` — sin eso el perfil
  subía a medias y al recuperarlo **las metas cambiaban en silencio**.
- **Regla:** al agregar un dato editable, va a la base **y** se lee al abrir. Si no, la próxima sesión
  razona sobre datos falsos.

## Matriz de progreso: semanas con FECHA y celda = PESO (04/11/2026)

- **Cada columna es una semana real**: `Sem 3 · 17–23 nov`, con `id = 'AAAA-MM-DD'` del **lunes**.
  El id es la clave: agregar una semana en el medio **renumera el orden pero no mueve el historial**.
- **La celda guarda el PESO** (lo que se anota en el gimnasio), no el volumen. Antes la etiqueta decía
  "kilos reales" pero guardaba volumen: quien escribía `40` metía 40 kg de volumen en vez de 2.000.
  El volumen (`peso × series × reps`) se **calcula** y se ve en el tooltip y en los totales.
- **Botón "📌 Cerrar semana"**: toma la fecha elegida, crea la columna y **copia el peso actual** de
  cada ejercicio (después se corrige lo que cambió). No es automático a propósito: arriba está el peso
  **actual**, y una foto automática inventaría historia.
- **La fecha es LIBRE y se ve** (04/11/2026): campo con ícono 📅 + **3 atajos** (`Esta semana`,
  `La semana pasada`, `Hace 2 semanas`, calculados con `lunesRelativo()`). El nativo ya abría un
  calendario; el problema no era el calendario, era que **no parecía clickeable**.
- **"Quitar" pide confirmación** y borra **por fecha**, no por número. Y ahora **CUALQUIER columna**
  (✎ / 🗑 en la cabecera de cada semana), no solo la última: una semana creada por error en el medio
  quedaba **atrapada para siempre**.
- **✎ cambia la fecha de una semana ya creada** y se lleva sus pesos. Falla cerrado si ya hay otra
  columna con esa fecha (`ocupada`): dos columnas de la misma semana son el mismo dato dos veces.
  En la nube el orden es **crear la nueva → copiar los pesos → borrar la vieja**: si algo falla queda
  una semana DE MÁS (visible y borrable), nunca una DE MENOS (pesos perdidos sin aviso).
- Núcleo puro: `src/logic/weeks.ts` (`lunesDe`, `agregarSemana`, `quitarSemana`, `volumenDe`,
  `volumenesPorSemana`, `mesesDeSemanas`, `etiquetaSemana`). Sin imports para poder probarlo en Node.
- **Superserie del Día 3 separada** en 2 ejercicios (Curl Martillo / Copa de Tríceps): era UNA fila con
  UN peso y el progreso mezclaba dos cargas. La superserie sigue escrita en la nota de cada uno.
  Se aplicó quirúrgicamente con `node scripts/split-superserie.mjs --apply` (renombra + inserta, **no**
  borra: conserva ids y pesos).

## UI de nutrición — déficit visible, formato es-PE y barras con contenedor (04/11/2026)

- **Renglón "Déficit"**: `MetabolicResult.deficitKcal` (nuevo, `tdee - metaCalorica`) se muestra ANTES de la
  meta, con su % tomado de `deficitPctUsado`. El "-15 %" **ya era dinámico** (no había bug ahí).
- **Formato**: `src/logic/formato.ts` (`numEs`, `numEsMax`) formatea en es-PE sin depender del locale del
  runtime: `1.387`, `2,37`, `95,8`. Aplicado a TMB, TDEE, déficit, meta, consumo, Atwater, proteína g/kg y
  reparto de macros. Antes se imprimía `2.3670053795576806`.
- **Barras**: `BarraMacro` con track VISIBLE (`bg-slate-950 ring-1 ring-slate-600`), marca del 100 %
  (`left-[99.5%]`), texto "faltan X g" y rojo al pasarse. Antes el track era `bg-slate-900` sobre tarjeta
  `bg-slate-800/60`: mismo color, no se veía.
- **Fila "Te queda hoy"**: kcal y g de proteína restantes (o "te pasaste por X").
- **Gate**: `verify-metabolism.mjs` **129/129** (+15). **5 mutaciones ROJAS por aserción** (déficit,
  separador de miles, recorte de ceros, track, marca del 100 %). Parche: `scripts/patch-ui-04nov.py`;
  mutaciones: `scripts/mutaciones-ui-04nov.py`. Respaldo: `backups/2026-11-04/`.
- **Límite declarado**: verificado por gate + `tsc` (0 errores propios) + `astro build`; el panel es
  `client:load`, así que no hay clic real ni captura.
- **Factor de actividad (decisión)**: 3 sesiones de 45-75 min + bici/caminata + trabajo sentado = **1,375
  (Ligero)**, que es lo que dice `DESCRIPCION_ACTIVIDAD.LIGERO`. 1,55 (Moderado) pide 4-5 sesiones.
  **No se cambió ningún default.** La calibración real es el promedio de peso semanal, no la tabla.

### Ayuda para elegir el alimento correcto — TDAH (04/11/2026)

- El badge **CRUDO / COCIDO** ya existía en el buscador; se extrajo a `src/components/EstadoAlimento.tsx`
  y ahora también aparece en la **tabla de comidas** (antes no se veía el estado de lo cargado).
- `AutocompleteFood` gana una **micro-línea fija** ("Pesá crudo lo que sale de la bolsa · si el nombre dice
  COCIDO, pesá el plato") y el botón **"¿Cómo elijo?"** con una guía de 4 pasos + el ejemplo del
  "segundo de trigo": **la app tiene INGREDIENTES, no platos**.
- Regla de oro: **el peso y la entrada tienen que hablar el mismo idioma**.
- Truco de 5 segundos: los carbos por 100 g delatan el estado (trigo ~75 g = crudo; 15-37 g = cocido).
- Gate **135/135**; **9 mutaciones ROJAS** (déficit, formato ×3, track, marca del 100 %, badge, guía, tabla).

### Dieta persistente — el día ya no se borra al refrescar (04/11/2026)

- **El bug (medido)**: `DietModule` nacía con `meals` vacío y `cloudSync` solo INSERTABA en
  `daily_meals`; **nadie leía la tabla**. Además `daily_meals` tenía **RLS activo SIN política**:
  el insert fallaba con `42501` y solo se logueaba en consola. Resultado medido: **0 filas**.
- **3 capas** (mismo criterio que la rutina): `src/logic/dieta.ts` (núcleo PURO: mapeo fila↔entrada,
  caché y normalización) + `loadMealsForDate`/`saveMealDay` en `cloudSync.ts` (lee la fecha y guarda
  por **REEMPLAZO**: borra + inserta) + `DietModule` (localStorage por día `user_meals_v1_<fecha>`,
  debounce **600 ms** y **cola por comida** para que dos guardados no se pisen).
- **Regla**: la caché de ESTE equipo manda para hoy; la nube es el respaldo multi-equipo. Sin caché,
  al abrir se baja de la nube. Las filas no guardan `foodId`: se recupera por **NOMBRE** al llegar el
  catálogo (también recalcula los macros con la tabla real).
- **PASO MANUAL**: correr `supabase/2026-11-04_dieta_persistente.sql` (política RLS + índice).
  Sin él la nube sigue rechazando escrituras, pero el navegador **igual conserva el día**.
- Gate nuevo `scripts/verify-dieta.mjs` (**42 aserciones**) + `verify-metabolism.mjs` (**135**);
  mutaciones `scripts/mutaciones-dieta.py` (**5/5 ROJAS por aserción**).

## Historial diario y progreso semanal — el día ya no "desaparece" (05/11/2026)

- **El bug (medido)**: el registro estaba bien guardado por fecha (`daily_meals` +
`user_meals_v1_<fecha>`), pero la app leía y escribía **solo la fecha de HOY** (`fechaHoy` calculada una
vez). Al cambiar el día la pantalla aparecía vacía: el dato existía y no había forma de verlo.
- **Fecha ACTIVA con navegación**: ◀ / 📅 / ▶ / Hoy. Un día pasado abre en **SOLO LECTURA**; el botón
"✏️ Editar este día" lo habilita de forma explícita (así no se reescribe el historial por accidente).
- **Si HOY está vacío no queda una pantalla muda**: un aviso muestra el **último día con datos**
(`loadLatestSummary`) con sus kcal y su déficit, y un botón para abrirlo.
- **Cambio de fecha automático**: cada 30 s (y al volver a la pestaña) se compara la fecha real. Si cambió,
se **cierra el día anterior guardando su resumen** y, si estabas parado ahí, se salta al día nuevo.
Si estabas mirando un día pasado, NO te mueve de lugar.
- **Resumen por día (`daily_summary`, 1 fila por fecha)**: kcal, macros, fibra, meta, TDEE, déficit
planificado (TDEE − meta) y **déficit real (TDEE − consumido)**. El desglose por comida NO se duplica:
se deriva de `daily_meals` (`resumenPorComida`). Peso: ~1 KB por día.
- **Núcleo puro** `src/logic/resumen.ts`: `totalDelDia`, `resumenPorComida`, `deficitRealKcal`,
`resumenDelDia`, `filaDesdeResumen`/`resumenDesdeFila`, `fechaMas`, `etiquetaFecha`, `ultimoConDatos`,
`promedioSemanal`, `conResumen`/`sinResumen`. **Sin imports** (se corre directo desde el gate de Node).
- **Regla dura**: un día **sin cargar NO es un día con déficit 0**. `deficitReal` queda `null`, la semana
solo promedia los días con datos (`diasConDatos`) y si no hay ninguno el promedio es `null`. Un día que
se queda vacío **borra su fila** (`deleteDailySummary`).
- **Panel "Progreso · déficit"**: consumido y déficit del **día activo**, promedio y kg teóricos de los
últimos 7 días, y la tabla día por día. 7.700 kcal ≈ 1 kg de grasa se declara como referencia teórica.
- **Formato es-PE también en los avisos**: `metabolism.ts` gana `formatoEs` (local, para no romper el
"sin imports" del módulo) → `73,5 kg`, `66,9 kg`, `79,9 kg`, `1,375`. Antes salían `73.5`, `66.92`,
`79.88`. `DietModule` usa `numEsMax(proteinaBaseG, 1)`.
- **PASO MANUAL**: correr `supabase/2026-11-05_resumen_diario.sql` (tabla + RLS + índice). Sin él la app
sigue funcionando (el historial del navegador se ve), pero el resumen **no viaja entre equipos**.
- Gate nuevo `scripts/verify-resumen.mjs` (**89**) + `verify-dieta.mjs` actualizado; mutaciones
`scripts/mutaciones-resumen.py` (**13/13 ROJAS por aserción**). `npm run verify` suma el gate.
- **Límites declarados**: no hay clic real (gate + `tsc` + `astro build`); al editar un día pasado el
resumen usa las metas **vigentes** (no se versiona el histórico de metas); el panel muestra 7 días pero
se cargan 14; un día sin datos fuera de la ventana no entra.

## Clasificación de alimentos, agua y actividad (04/11/2026)

- **La "mina de oro" es `AlimentosClasificados.xlsx`, NO el PDF.** Aporta **5 columnas que el JSON no tenia**:
  `saciedad` (Alta/Media/Baja), `glucemia` (Alta/Media/Baja/`null` = "No definido"), `cargaGlucemica`
  (139/927 con dato), `altoProteina` y `altaFibra` (booleanos). **NO trae micronutrientes**: esos solo
  existen en `tablas-peruanas-QR.pdf` (22 columnas, la tabla va partida en **2 paginas** y se une por
  **CODIGO**, nunca por posicion).
  - `scripts/merge-clasificados.mjs` (idempotente) une por **NOMBRE** (927/927, sin duplicados), valida
    allowlists y **no toca** los 9 campos originales (medido: 0 alterados). Backup:
    `backups/2026-11-04/foods.json.bak`.
  - **Buscador**: 3 chips (`Llena mas`, `+ Proteina`, `+ Fibra`) + badges por resultado (`Llena`,
    `Sube azucar`, `Prot.`, `Fibra`). Con un chip activo y sin texto, muestra los primeros 10.
  - Gates `scripts/verify-alimentos.mjs` (**34**) + `scripts/verify-wiring.mjs` (**20**);
    `scripts/mutaciones-clasificacion.py` (**7/7 ROJAS por asercion**).
- **Agua diaria (formula del Excel `Objetivos!X26/X27`)**: IMC < 30 -> `35 ml x kg`; IMC >= 30 ->
  `(peso ideal x 30 + (peso real - peso ideal) x 10) / 1000`. Redondeo a **1 decimal**. El
  **+0,5 L por hora de entrenamiento** se declara aparte (`AGUA_ML_POR_HORA_ACTIVIDAD = 500`) y NO se suma
  solo. Cuando se usa la formula de sobrepeso, se agrega un **aviso** (trazabilidad). **No hay contador de
  vasos** (pendiente declarado).
- **Selector "Actividad total (trabajo + gym)"**: cada opcion ahora muestra **los dias**
  (`Ligero x1,375 - 2-3 dias/sem`) y debajo un recuadro con el badge de dias + la descripcion.
  `DIAS_POR_NIVEL` en `metabolism.ts` es la fuente unica.
- **BUG corregido**: `CardioStrengthCalculator` recibia `edad={44}` **fija** desde `index.astro` (las
  zonas cardiacas no seguian al perfil). Ahora lee `user_metabolic_profile` de `localStorage` y declara
  "segun tu perfil"; el prop queda solo como respaldo.
- **Pendientes declarados** (estaban en los Excel, NO implementados): **ETA/TEF** (~7,8 %, informativo),
  **antropometria** (12 pliegues/perimetros del `Historial Dietetico`), **contador de agua** y **platos
  peruanos** (propuesta: recetas con ingredientes reales + porcion ajustada al presupuesto restante).

### Buscador con filtros: TODOS los resultados (05/11/2026)

- **BUG corregido**: con un chip activo (`Llena mas` / `+ Proteina` / `+ Fibra`) la lista se cortaba
  en **10** (`slice(0, 10)`), asi que solo se veian los primeros del catalogo (**la letra "A"**).
  Ahora: **con texto** -> 10 sugerencias; **solo con filtros** -> **TODOS**, en **orden alfabetico**
  (`localeCompare(es)`), con contador (`N alimentos`) y el tope de seguridad `MAX_SOLO_FILTROS = 500`.
  Los chips pasaron **arriba del input** (antes el desplegable los tapaba).
- **Se muestra "cuanto llena"**: cada fila dice `Llena: Alta | Media | Baja - fibra X g - Y kcal/100 g`.
  La categoria sola no alcanza para comparar; los numeros reales (fibra + densidad energetica) si.
- Gate `scripts/verify-wiring.mjs` (**26**) con 6 aserciones nuevas; mutaciones **9/9 ROJAS**
  (M8 vuelve a cortar en 10, M9 pierde el orden alfabetico).

### Platos peruanos: decision de alcance (05/11/2026)

- **60 platos** (no 40). Cada plato = **receta declarada** (ingredientes + gramos), nunca un numero
  inventado; el usuario ajusta una vez y queda su **"mi version"**.
- **Variantes** se modelan como **extras/sustituciones** (`+ hot dog`, `con papa | con frejol`), no como
  sub-recetas.
- **Ingredientes fuera de la tabla** (medido: **sillao 0, mayonesa 0, vinagre 0, harina de trigo 0**):
  la receta lleva una **observacion visible** ("no esta en la tabla: pesalo aparte, 1 cda de mayonesa
  ~90 kcal") y ese ingrediente **NO** entra al total calculado. **Regla: nunca inventar el valor.**

## Recetario de platos — **60 platos** (8 criollos + 15 sopas + 37 platos) — 05/11/2026

- **Modelo**: `public/data/platos.json` (60 platos) = recetas con **gramos POR PORCION**. Los valores
  NO se guardan: se calculan desde `foods.json` por **NOMBRE exacto** (`src/logic/platos.ts`, nucleo PURO).
  **Grupos**: Arroces y fideos · Guisos y segundos · Menestras · Pollos y carnes · Entradas y
  guarniciones · Sopas · Pescados.
- **REGLA DE LA CASA (pedido del dueno): UNA sopa + UN segundo por comida, se SUMAN, no se reemplazan.**
  Núcleo puro: `rolDePlato` (grupo `Sopas` -> `sopa`; todo lo demas -> `segundo`),
  `rolesEnComida(entradas, platos)` (resuelve por **NOMBRE** contra el recetario: las filas guardadas
  no llevan rol, no hace falta migrar) y `puedeAgregarPlato(rol, rolesYaEnComida)` (**nunca 2 del mismo**).
  `MENSAJE_YA_HAY` explica el porque. **Doble candado**: el `PlatoModal` deshabilita la comida ocupada
  (`disabled={ocupada}` + tachado + mensaje) **y** `addPlatoToMeal` vuelve a validar antes de escribir.
  La tabla de cada comida marca la fila con **`SOPA` / `2º`**.
- **UI (2 puertas)**: tarjeta **"🍲 Recetario criollo"** arriba de las comidas (contador + buscador, toma
  la comida segun la hora con `comidaPorHora`) y el toggle **`Alimento | Plato criollo`** en cada comida.
  El modal deja **cambiar la comida** sin cerrar.
- **Porcion: NUNCA se infla sola (05/11/2026).** `factorParaPresupuesto(kcalPlato, kcalRestantes)`
  tiene **techo 1**: si te sobran calorias NO te sirve "sopa y media" (antes multiplicaba por 1,5 y un
  caldo de gallina de **611** se mostraba como **917**). El modal deja elegir **0,5 / 0,75 / 1 / 1,25 / 1,5**
  a mano (boton `auto` para volver al sugerido) y muestra siempre **"1 porcion = X kcal"**.
- **Caldo con grasa / desgrasado (opcion por sopa).** Las **15 sopas** llevan el caldo como
  `opciones.caldo` (porDefecto **grasa**), no como ingrediente fijo: *Con grasa* = los gramos de la receta
  (200 g = 178 kcal); *Desgrasado* = **45 g del MISMO caldo** (~40 kcal) porque la tabla no tiene una fila
  desgrasada y **no se invento un valor**. Efecto medido: caldo de gallina **611 -> 474** (-137).
- **Persistencia**: el plato se agrega como **UNA fila** con `foodId: -1`; como su nombre no existe en
  `foods.json`, `normalizarEntradas` la deja intacta -> sobrevive al refresh y a la nube.
- **Variantes**: `opciones` (seco papa/frejol · carapulcra cerdo/pollo · chupe bonito/merluza ·
  chicharron papas/yuca/ensalada · pescado frito bonito/merluza) y `extras` (+huevo, +arroz, +hot dog,
  +chancho, +mas arroz, +cremas, +aceituna, +mas papa).
- **Ingredientes que NO estan en la tabla** -> `observaciones` con `aproxKcal` (sillao 5-10, kion 2,
  pan molido 28, mayonesa 90, vinagre 3, sal 0). **Nunca entran al total.** Verificado que **si existen**:
  harina de trigo, semola de trigo, quinua, cebada, pescado bonito/merluza, gallina, caldos, yuca,
  chicharron de cerdo, palta, lechuga, limon, salchicha, chicha de jora, aji panca, galleta de soda.
- **El caldo de la tabla trae grasa** (89 kcal/100 g): la nota de cada sopa avisa que si se desgrasa
  resta ~150 kcal. **No se descuenta solo.**
- **Valores dorados congelados** en `scripts/verify-platos.mjs` (**287 aserciones**): 60 platos base +
  variantes + escalado por factor + porcion por presupuesto + la regla sopa/segundo.
- **Gates**: `npm run verify` (metabolismo 146 · alimentos 34 · platos 324 · cableado 55 · dieta 43 ·
  resumen 89) y
  `npm run verify:types` (`tsc -p tsconfig.check.json`, excluye `backups/`).
  Mutaciones `scripts/mutaciones-clasificacion.py`: **18/18 ROJAS**. El runner ahora aplica **todas** las
  apariciones del patron (antes exigia 1 y las anclas fragiles dejaban mutaciones sin aplicar).
- **Pendiente declarado**: ampliar a mas platos cuando el dueno lo pida; `tamal` y `patasca` **no se
  pueden** modelar (no hay mote ni maiz molido en la tabla).
