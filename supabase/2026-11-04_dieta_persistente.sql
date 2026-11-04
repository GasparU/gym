-- ============================================================================
-- fitness-saas · 04/11/2026
-- DIETA PERSISTENTE: el registro de comidas se borraba al refrescar.
--
-- Dos causas, las dos de la BASE:
--   1) `daily_meals` tenía RLS ACTIVO y NINGUNA política -> todo insert fallaba
--      con 42501 y la app solo lo escribía en la consola del navegador.
--   2) Nadie leía la tabla: la UI arrancaba con el día vacío.
--      (La lectura se arregló en el código; esta política habilita la escritura.)
--
-- CÓMO CORRERLO: Supabase -> SQL Editor -> pegar todo -> Run.
-- Es IDEMPOTENTE: se puede correr dos veces sin romper nada.
--
-- NOTA: la app usa la anon key, que NO puede hacer DDL. Este archivo es el
-- único paso manual.
-- ============================================================================

-- 1) Política de acceso (mismo criterio que workout_days / workout_weeks).
alter table daily_meals enable row level security;
drop policy if exists daily_meals_all on daily_meals;
create policy daily_meals_all on daily_meals
  for all using (true) with check (true);

-- 2) Índice para leer un día (la consulta filtra por fecha y ordena por created_at).
create index if not exists daily_meals_fecha_idx on daily_meals (fecha);

-- 3) Verificación rápida: debe devolver 1 fila con `rowsecurity = true`.
select relname as tabla, relrowsecurity as rls_activo
from pg_class
where relname = 'daily_meals';
