-- ============================================================================
-- fitness-saas · 04/11/2026
-- Pone en la NUBE lo que vivía solo en localStorage: DÍAS y SEMANAS (con fecha
-- real y el peso de cada ejercicio). Y completa `body_metrics` para que el
-- PERFIL viaje de verdad entre dispositivos.
--
-- CÓMO CORRERLO: Supabase → SQL Editor → pegar todo → Run.
-- Es IDEMPOTENTE: podés correrlo dos veces sin romper nada.
--
-- NOTA: la app usa la anon key, que NO puede crear tablas (no hace DDL).
-- Este archivo es el único paso manual.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) DÍAS de entrenamiento (antes: localStorage['workout_days_v1'])
-- ---------------------------------------------------------------------------
create table if not exists workout_days (
  id         text primary key,
  titulo     text not null,
  dias       text not null default '',
  orden      int  not null default 0,
  updated_at timestamptz not null default now()
);

alter table workout_days enable row level security;
drop policy if exists workout_days_all on workout_days;
create policy workout_days_all on workout_days
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 2) SEMANAS de la matriz (una columna = una semana con su lunes y su domingo)
--    id = 'AAAA-MM-DD' del LUNES  ->  estable, renumerar no mueve el historial
-- ---------------------------------------------------------------------------
create table if not exists workout_weeks (
  id         text primary key,
  inicio     date not null,
  fin        date not null,
  orden      int  not null default 0,
  created_at timestamptz not null default now()
);

alter table workout_weeks enable row level security;
drop policy if exists workout_weeks_all on workout_weeks;
create policy workout_weeks_all on workout_weeks
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 3) PESO por EJERCICIO y SEMANA (la celda de la matriz)
--    Se guarda el PESO (lo que se anota en el gimnasio), no el volumen:
--    el volumen = peso × series × reps se calcula en la app.
-- ---------------------------------------------------------------------------
create table if not exists workout_week_sets (
  id          uuid primary key default gen_random_uuid(),
  ejercicio_id uuid not null references workout_exercises(id) on delete cascade,
  week_id     text not null references workout_weeks(id) on delete cascade,
  peso_kg     numeric not null default 0,
  series      int not null default 0,
  reps        int not null default 0,
  updated_at  timestamptz not null default now(),
  unique (ejercicio_id, week_id)
);

alter table workout_week_sets enable row level security;
drop policy if exists workout_week_sets_all on workout_week_sets;
create policy workout_week_sets_all on workout_week_sets
  for all using (true) with check (true);

create index if not exists workout_week_sets_week
  on workout_week_sets (week_id);

-- ---------------------------------------------------------------------------
-- 4) PERFIL completo en body_metrics
--    Antes solo se guardaban peso/talla/edad/IMC/objetivos: al recuperar el
--    perfil en otro equipo se perdían sexo, días de entrenamiento, déficit,
--    % de grasa y nivel de actividad -> las metas cambiaban en silencio.
-- ---------------------------------------------------------------------------
alter table body_metrics add column if not exists sexo              text;
alter table body_metrics add column if not exists dias_entrenamiento int;
alter table body_metrics add column if not exists deficit_pct        numeric;
alter table body_metrics add column if not exists grasa_pct          numeric;
alter table body_metrics add column if not exists nivel_actividad    text;

-- ---------------------------------------------------------------------------
-- 5) `workout_matrix_progress` (la matriz vieja, por número de semana y en
--    VOLUMEN) queda sin uso. No se borra para no tocar datos sin permiso.
--    Si querés limpiarla y estás seguro de que está vacía:
--        select count(*) from workout_matrix_progress;
--        -- si da 0:
--        -- drop table workout_matrix_progress;
-- ---------------------------------------------------------------------------
