// Diagnóstico: ¿existen las tablas que la app usa en Supabase?
// Uso:  node scripts/check-supabase.mjs
// No imprime las claves. Sale con 1 si falta alguna tabla.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const url = env.PUBLIC_SUPABASE_URL;
const key = env.PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('❌ Faltan PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

const TABLAS = [
  'body_metrics',
  'daily_meals',
  'workout_exercises',
  'workout_matrix_progress',
  'workout_logs',
];

const sb = createClient(url, key);
let faltan = 0;

for (const t of TABLAS) {
  const { data, error, count } = await sb.from(t).select('*', { count: 'exact' }).limit(1);
  if (error) {
    faltan++;
    console.log(`❌ ${t.padEnd(26)} ${error.code} — ${error.message.slice(0, 80)}`);
  } else {
    const cols = data && data[0] ? Object.keys(data[0]).join(', ') : '(tabla vacía)';
    console.log(`✅ ${t.padEnd(26)} filas: ${String(count).padStart(4)}  |  ${cols}`);
  }
}

console.log(
  faltan === 0
    ? '\n✅ Todas las tablas existen.'
    : `\n❌ Faltan ${faltan} tabla(s): crear con scripts/sql-tablas-faltantes.sql`,
);
process.exit(faltan === 0 ? 0 : 1);
