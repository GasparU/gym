// Verifica la validación de la configuración de Supabase (núcleo puro).
// Origen: el deploy a Vercel del 04/11/2026 se cayó con "supabaseUrl is required"
// y una traza que no decía qué variable faltaba ni dónde se configura.
//
//   node scripts/verify-config-supabase.mjs
import { configSupabase, DONDE_SE_CONFIGURA } from '../src/logic/supabase-config.ts';

let ok = 0;
const fallos = [];

function check(nombre, valor, esperado) {
  const bien = JSON.stringify(valor) === JSON.stringify(esperado);
  if (bien) ok++;
  else fallos.push(`${nombre}: obtuve ${JSON.stringify(valor)}, esperaba ${JSON.stringify(esperado)}`);
}

// Un JWT de juguete con la forma correcta (no es una key real).
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIn0.abcdefghijklmnopqrstuv';
const URL_OK = 'https://abcdefghijklmnop.supabase.co';

// ---------- Lo que NO tiene que romper ----------
const bueno = configSupabase(URL_OK, KEY);
check('config válida: ok', bueno.ok, true);
check('config válida: sin faltantes', bueno.faltantes, []);
check('config válida: sin mensaje', bueno.mensaje, '');
check('config válida: conserva la url', bueno.url, URL_OK);
check('config válida: conserva la key', bueno.key, KEY);

check('key nueva sb_publishable_', configSupabase(URL_OK, 'sb_publishable_' + 'a'.repeat(30)).ok, true);
check('http:// se rechaza (la key viajaria sin cifrar)', configSupabase('http://localhost:54321', KEY).ok, false);
check('localhost https', configSupabase('https://localhost:54321', KEY).ok, true);
check('limpia comillas y espacios', configSupabase(`  "${URL_OK}"  `, ` '${KEY}' `).ok, true);
check('limpia la barra final', configSupabase(URL_OK + '/', KEY).url, URL_OK);
check('acepta supabase.in', configSupabase('https://miproyecto.supabase.in', KEY).ok, true);

// ---------- Lo que SÍ tiene que romper (y decir por qué) ----------
const vacio = configSupabase('', '');
check('vacío: no ok', vacio.ok, false);
check('vacío: nombra las DOS variables', vacio.faltantes, [
  'PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_ANON_KEY',
]);
check('vacío: dice "Faltan las DOS"', /Faltan las DOS variables/.test(vacio.mensaje), true);
check('vacío: nombra cada variable en el mensaje', [
  /PUBLIC_SUPABASE_URL/.test(vacio.mensaje),
  /PUBLIC_SUPABASE_ANON_KEY/.test(vacio.mensaje),
], [true, true]);
check('vacío: dice DÓNDE se configura', vacio.mensaje.includes(DONDE_SE_CONFIGURA), true);
check('vacío: menciona Vercel', /Vercel/.test(vacio.mensaje), true);
check('vacío: menciona Redeploy', /Redeploy/.test(vacio.mensaje), true);

const sinKey = configSupabase(URL_OK, '');
check('solo falta la key: 1 faltante', sinKey.faltantes, ['PUBLIC_SUPABASE_ANON_KEY']);
check('solo falta la key: singular', /^Falta la variable PUBLIC_SUPABASE_ANON_KEY/.test(sinKey.mensaje), true);

const sinUrl = configSupabase(undefined, KEY);
check('solo falta la url', sinUrl.faltantes, ['PUBLIC_SUPABASE_URL']);
check('undefined no explota', sinUrl.ok, false);

const urlMala = configSupabase('https://supabase.com/dashboard/project/abc', KEY);
check('URL del panel: no ok', urlMala.ok, false);
check('URL del panel: dice Project URL', /Project URL/.test(urlMala.mensaje), true);
check('URL del panel: muestra lo recibido', /dashboard/.test(urlMala.mensaje), true);
check('sin https: no ok', configSupabase('abcdefgh.supabase.co', KEY).ok, false);

const keyMala = configSupabase(URL_OK, 'no-es-una-key');
check('key basura: no ok', keyMala.ok, false);
check('key basura: explica el formato', /eyJ|sb_publishable_/.test(keyMala.mensaje), true);
check('key basura: avisa de la service_role', /service_role/.test(keyMala.mensaje), true);

// ---------- El mensaje NO puede ser el viejo ----------
const todos = [vacio.mensaje, sinKey.mensaje, urlMala.mensaje, keyMala.mensaje];
check('ningún mensaje repite "supabaseUrl is required"', todos.some((m) => /supabaseUrl is required/.test(m)), false);
check('todos dicen dónde se configura', todos.every((m) => m.includes(DONDE_SE_CONFIGURA)), true);

// ---------- Cableado: lib/supabase.ts tiene que USAR esto ----------
import { readFileSync } from 'node:fs';
const lib = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
// Se ignoran los COMENTARIOS: el archivo DOCUMENTA el console.warn viejo para
// explicar por qué se fue, y buscarlo en crudo daría rojo por el propio texto
// que documenta el arreglo (lección F4.1 del 18/09).
const libCodigo = lib
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
check('lib usa configSupabase', /configSupabase\(/.test(libCodigo), true);
check('lib tira Error si no está ok', /if \(!config\.ok\)[\s\S]{0,120}throw new Error/.test(lib), true);
check('lib ya no se traga el problema con console.warn', /console\.warn/.test(libCodigo), false);
check('el mensaje del Error empieza con [Supabase no configurado]', /\[Supabase no configurado\]/.test(lib), true);

if (fallos.length) {
  console.log(`\n❌ ${fallos.length} FALLO(S) de ${ok + fallos.length}:`);
  fallos.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`\n✅ ${ok}/${ok} aserciones OK (config de Supabase)`);
