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
