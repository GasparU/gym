-- ============================================================================
-- fitness-saas · 05/11/2026
-- RESUMEN DIARIO: una fila por día con los totales, las metas y el déficit.
--
-- POR QUÉ: `daily_meals` guarda el DETALLE (una fila por alimento). Para ver el
-- historial y el progreso semanal no conviene traer cientos de filas: alcanza
-- con 1 fila por día (≈ 1 KB). El desglose por comida NO se duplica: se deriva
-- de `daily_meals` cuando la pantalla lo necesita.
--
-- QUÉ GUARDA: kcal consumidas, macros, fibra, meta del día, TDEE del día,
-- déficit planificado (TDEE − meta) y déficit REAL (TDEE − consumido).
-- `deficit_real` queda NULL cuando no se cargó nada: un día vacío NO es un día
-- con déficit 0 (sería un dato inventado).
--
-- CÓMO CORRERLO: Supabase -> SQL Editor -> pegar todo -> Run.
-- Es IDEMPOTENTE: se puede correr dos veces sin romper nada.
-- La anon key NO puede hacer DDL: este archivo es el único paso manual.
-- ============================================================================

-- 1) Tabla (1 fila por fecha).
create table if not exists daily_summary (
  fecha               date primary key,
  kcal_consumidas     numeric not null default 0,
  proteina_g          numeric not null default 0,
  grasa_g             numeric not null default 0,
  carbohidratos_g     numeric not null default 0,
  fibra_g             numeric not null default 0,
  meta_kcal           numeric not null default 0,
  tdee_kcal           numeric not null default 0,
  deficit_planificado numeric,
  deficit_real        numeric,
  comidas             int not null default 0,
  entradas            int not null default 0,
  actualizado_en      timestamptz not null default now()
);

-- 2) Acceso: mismo criterio que daily_meals / workout_days (RLS activo + política).
alter table daily_summary enable row level security;
drop policy if exists daily_summary_all on daily_summary;
create policy daily_summary_all on daily_summary
  for all using (true) with check (true);

-- 3) Índice para "los últimos N días" (la PK ya ordena por fecha, pero el
--    índice descendente hace explícita la consulta del panel de progreso).
create index if not exists daily_summary_fecha_idx on daily_summary (fecha desc);

-- 4) Verificación rápida: debe devolver 1 fila con `rowsecurity = true`.
select relname as tabla, relrowsecurity as rls_activo
from pg_class
where relname = 'daily_summary';
