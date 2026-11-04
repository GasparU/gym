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
- **Gate obligatorio tras tocar el núcleo**: `node scripts/verify-metabolism.mjs` (94 aserciones que importan el código real) + `node scripts/check-supabase.mjs` (las 5 tablas existen).

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
- **Persistencia**: los días (id, nombre, cuándo) viven en `localStorage['workout_days_v1']`;
  los ejercicios viven en `workout_exercises` (Supabase). Si el storage se pierde, el efecto
  `diasFaltantes` **reincorpora** los días que tengan ejercicios, así no queda nada invisible.
- ⚠️ **Límite declarado**: los NOMBRES de los días no viajan entre dispositivos (no hay tabla y
  la anon key no puede crear tablas). Para sincronizarlos hace falta crear `workout_days` por SQL.
