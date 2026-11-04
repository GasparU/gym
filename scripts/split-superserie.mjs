// Separa la SUPERSERIE del Día 3 en dos ejercicios (04/11/2026).
//
// Por qué: era UNA fila con UN solo campo de peso ("Curl Martillo + Copa de
// Tríceps"). No se podían anotar las dos cargas y el progreso mezclaba dos
// ejercicios distintos. Ahora son dos filas, y la superserie sigue escrita en
// la nota de cada una.
//
// Es QUIRÚRGICO a propósito (no se usa sync-routine.mjs): renombra la fila
// existente y agrega la nueva. Así NO se pierde ningún id ni los pesos que ya
// estén cargados.
//
//   node scripts/split-superserie.mjs            -> muestra qué haría
//   node scripts/split-superserie.mjs --apply    -> aplica (respalda antes)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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

const NOTA_MARTILLO =
  '10-12 reps · superserie con "Copa de Tríceps": sin descanso entre los dos · 1,5-2 min al terminar la pareja';
const NOTA_COPA =
  '10-12 reps · superserie con "Curl Martillo": sin descanso entre los dos · 1,5-2 min al terminar la pareja';

const { data: filas, error } = await sb
  .from('workout_exercises')
  .select('*')
  .eq('rutina_id', 'dia-3')
  .order('created_at', { ascending: true });

if (error) {
  console.error('❌ No se pudo leer workout_exercises:', error.message);
  process.exit(1);
}

const superserie = filas.find((f) => /superserie/i.test(f.nombre));
// La fila VIEJA se llama 'Superserie: Curl Martillo + Copa de Tríceps', asi que
// hay que excluirla: si no, la propia fila a separar parece 'ya separada'.
const yaSeparada = filas.some(
  (f) => /copa de tríceps/i.test(f.nombre) && !/superserie/i.test(f.nombre),
);

console.log(`Día 3: ${filas.length} ejercicio(s).`);
filas.forEach((f) => console.log(`  · ${f.nombre} — ${f.series}×${f.reps} · peso ${f.peso}`));

if (!superserie) {
  console.log(yaSeparada ? '\n✅ Ya está separada: no hay nada que hacer.' : '\n⚠️ No encontré la fila "Superserie".');
  process.exit(yaSeparada ? 0 : 1);
}
if (yaSeparada) {
  console.log('\n⚠️ Ya existe "Copa de Tríceps": parece separada a medias. Revisar a mano.');
  process.exit(1);
}

console.log('\nPlan:');
console.log(`  1) renombrar «${superserie.nombre}» -> «Curl Martillo con Mancuernas» (conserva id, series, reps y peso)`);
console.log('  2) insertar «Copa de Tríceps sobre la Cabeza» — 3×12, peso 0');
console.log('  3) actualizar la nota de las dos (la superserie queda escrita ahí)');

if (!APLICAR) {
  console.log('\n(dry-run) Corré con --apply para aplicarlo.');
  process.exit(0);
}

const dir = new URL('../backups/2026-11-04/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const archivo = new URL(`dia-3-antes-de-separar-${Date.now()}.json`, dir);
fs.writeFileSync(archivo, JSON.stringify(filas, null, 2));
console.log(`\n💾 Respaldo: ${decodeURIComponent(archivo.pathname)}`);

const { error: errUpd } = await sb
  .from('workout_exercises')
  .update({ nombre: 'Curl Martillo con Mancuernas', calentamiento: NOTA_MARTILLO })
  .eq('id', superserie.id);
if (errUpd) {
  console.error('❌ No se pudo renombrar:', errUpd.message);
  process.exit(1);
}
console.log('✅ Renombrada la fila existente.');

const { error: errIns } = await sb.from('workout_exercises').insert([
  {
    rutina_id: 'dia-3',
    nombre: 'Copa de Tríceps sobre la Cabeza',
    calentamiento: NOTA_COPA,
    peso: 0,
    series: 3,
    reps: 12,
  },
]);
if (errIns) {
  console.error('❌ No se pudo insertar la copa de tríceps:', errIns.message);
  process.exit(1);
}
console.log('✅ Insertada «Copa de Tríceps sobre la Cabeza».');

const { data: final } = await sb
  .from('workout_exercises')
  .select('nombre, series, reps')
  .eq('rutina_id', 'dia-3')
  .order('created_at', { ascending: true });
console.log(`\nDía 3 ahora: ${final.length} ejercicios.`);
final.forEach((f) => console.log(`  · ${f.nombre} — ${f.series}×${f.reps}`));
