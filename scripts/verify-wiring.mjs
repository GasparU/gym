// Verifica el CABLEADO de la UI (que los controles nuevos estén conectados).
// Ignora comentarios: un texto en un comentario NO cuenta como control (lección F4.1).
// Corre: node scripts/verify-wiring.mjs
import { readFileSync } from 'node:fs';

const limpiar = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
const leer = (p) => limpiar(readFileSync(p, 'utf8'));

let ok = 0;
const fallos = [];
function check(nombre, valor, esperado = true) {
  if (valor === esperado) ok++;
  else fallos.push(`${nombre}: obtuve ${JSON.stringify(valor)}, esperaba ${JSON.stringify(esperado)}`);
}

// ---------- Buscador con filtros de calidad ----------
const autocomplete = leer('src/components/AutocompleteFood.tsx');
check('buscador: estado del filtro de saciedad', autocomplete.includes('filtroSaciedad'));
check('buscador: filtra solo saciedad Alta', autocomplete.includes("item.saciedad !== 'Alta'"));
check('buscador: filtra alto en proteína', autocomplete.includes('filtroProteina && !item.altoProteina'));
check('buscador: filtra alta fibra', autocomplete.includes('filtroFibra && !item.altaFibra'));
check('buscador: chip Llena más', autocomplete.includes('Llena más'));
check('buscador: chip + Proteína', autocomplete.includes('+ Proteína'));
check('buscador: chip + Fibra', autocomplete.includes('+ Fibra'));
check('buscador: pinta el aviso de glucemia alta', autocomplete.includes("item.glucemia === 'Alta'"));

// ---------- Selector de actividad: días de referencia ----------
const perfil = leer('src/components/UserProfileCard.tsx');
check('perfil: usa DIAS_POR_NIVEL', perfil.includes('DIAS_POR_NIVEL['));
check('perfil: importa DIAS_POR_NIVEL', perfil.includes('DIAS_POR_NIVEL,'));

// ---------- Calculadora de FC: edad del perfil, no fija ----------
const calc = leer('src/components/CardioStrengthCalculator.tsx');
check('calculadora: lee el perfil guardado', calc.includes('user_metabolic_profile'));
check('calculadora: actualiza la edad', calc.includes('setEdad('));
check('calculadora: avisa cuando viene del perfil', calc.includes("' (según tu perfil)'"));
const index = leer('src/pages/index.astro');
check('index: sin edad hardcodeada', index.includes('edad={44}'), false);
check('index: monta la calculadora', index.includes('<CardioStrengthCalculator client:load />'));

// ---------- Agua en el panel ----------
const dieta = leer('src/components/DietModule.tsx');
check('dieta: muestra el agua calculada', dieta.includes('targets.aguaLitros'));
check('dieta: declara el extra por hora', dieta.includes('0,5 L por cada hora de entrenamiento'));

// ---------- Núcleo del agua ----------
const meta = leer('src/logic/metabolism.ts');
check('metabolismo: fórmula 35 ml/kg', meta.includes('0.035 * p'));
check('metabolismo: fórmula con peso ideal', meta.includes('pesoIdeal * 30'));
check('metabolismo: devuelve aguaLitros', meta.includes('aguaLitros,'));

console.log('=== Cableado de la UI: verificación ===');
if (fallos.length) {
  console.log(`\n❌ ${fallos.length} FALLO(S) de ${ok + fallos.length}:`);
  fallos.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`\n✅ ${ok}/${ok} aserciones OK`);
