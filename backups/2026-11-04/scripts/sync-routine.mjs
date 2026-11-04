// Reemplaza la rutina VIEJA de la base (Pecho/Piernas/Hombros, "Lunes y Jueves",
// con sentadilla y peso muerto rumano) por la rutina REAL del dueño que vive en
// src/logic/routines.ts. Dry-run por defecto.
//
//   node scripts/sync-routine.mjs            -> muestra qué haría
//   node scripts/sync-routine.mjs --apply    -> respalda, borra e inserta
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { RUTINA, filasParaInsertar, seriesPorGrupo } from '../src/logic/routines.ts';

const APLICAR = process.argv.includes('--apply');

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

const sb = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY);

const { data: actuales, error } = await sb
  .from('workout_exercises')
  .select('*')
  .order('created_at', { ascending: true });
if (error) {
  console.error('❌ No se pudo leer workout_exercises:', error.message);
  process.exit(1);
}

const nuevas = filasParaInsertar(0);

console.log(`Base: ${actuales.length} ejercicio(s) actuales.`);
const porDia = actuales.reduce((acc, e) => {
  acc[e.rutina_id] = (acc[e.rutina_id] ?? 0) + 1;
  return acc;
}, {});
console.log('  por rutina_id:', JSON.stringify(porDia));
console.log('\nRutina nueva (la tuya):');
for (const d of RUTINA) {
  console.log(`  ${d.id} — ${d.titulo} (${d.dias}) · ${d.ejercicios.length} ejercicios`);
  d.ejercicios.forEach((e) => console.log(`      · ${e.nombre} — ${e.series}×${e.reps}`));
}
console.log('\nSeries por grupo en la semana:', JSON.stringify(seriesPorGrupo()));
console.log(`\nTotal a insertar: ${nuevas.length} filas (peso inicial 0: los cargás con tu última sesión).`);

if (!APLICAR) {
  console.log('\n(dry-run) Corré con --apply para reemplazar. Se respalda lo actual antes de borrar.');
  process.exit(0);
}

const dir = new URL('../backups/2026-11-03/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const archivo = new URL(`rutina-anterior-${Date.now()}.json`, dir);
fs.writeFileSync(archivo, JSON.stringify(actuales, null, 2));
console.log(`\n💾 Respaldo: ${archivo.pathname}`);

if (actuales.length > 0) {
  const { error: delErr } = await sb.from('workout_exercises').delete().in('id', actuales.map((e) => e.id));
  if (delErr) {
    console.error('❌ No se pudo borrar:', delErr.message);
    process.exit(1);
  }
  console.log(`🗑️  Borrados ${actuales.length} filas.`);
}

const { data: insertadas, error: insErr } = await sb.from('workout_exercises').insert(nuevas).select();
if (insErr) {
  console.error('❌ No se pudo insertar:', insErr.message);
  process.exit(1);
}
console.log(`✅ Insertadas ${insertadas.length} filas de la rutina real.`);
