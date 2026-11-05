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
check('buscador: filtros muestran TODOS (no 10)', autocomplete.includes('MAX_SOLO_FILTROS'));
check('buscador: ordena alfabetico con filtros', autocomplete.includes("a.nombre.localeCompare(b.nombre, 'es')"));
check('buscador: no recorta la lista con filtros', autocomplete.includes('ordenados.slice(0, MAX_SOLO_FILTROS)'));
check('buscador: avisa el orden y el total', autocomplete.includes('orden alfabético'));
check('buscador: muestra cuanto llena', autocomplete.includes('Llena:'));
check('buscador: muestra la fibra por 100 g', autocomplete.includes('fibra {numEsMax(item.fibra, 1)} g'));

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

// ---------- Recetario de platos ----------
const dietaPlatos = leer('src/components/DietModule.tsx');
check('dieta: importa el buscador de platos', dietaPlatos.includes('BuscadorPlato'));
check('dieta: importa el modal de receta', dietaPlatos.includes('PlatoModal'));
check('dieta: carga platos.json', dietaPlatos.includes('/data/platos.json'));
check('dieta: agrega el plato a la comida elegida', dietaPlatos.includes('addPlatoToMeal(mealType, plato, calc);'));
check('dieta: el recetario esta siempre a la vista', dietaPlatos.includes('Recetario criollo'));
check('dieta: sugiere la comida segun la hora', dietaPlatos.includes('comidaPorHora'));
check('dieta: pasa la comida inicial al modal', dietaPlatos.includes('mealTypeInicial={platoAbierto.mealType}'));
check('dieta: el modal puede cambiar de comida', leer('src/components/PlatoModal.tsx').includes('¿A qué comida lo sumás?'));
check('dieta: calcula sopa/segundo por comida', dietaPlatos.includes('rolesPorComida'));
check('dieta: sabe que comidas ya tienen ese rol', dietaPlatos.includes('comidasOcupadasPara'));
check('dieta: doble candado al agregar', dietaPlatos.includes('puedeAgregarPlato(rolDePlato(plato)'));
check('dieta: marca la fila como SOPA o 2do', dietaPlatos.includes('"SOPA" : "2º"'));
check('modal: deshabilita la comida ocupada', leer('src/components/PlatoModal.tsx').includes('disabled={ocupada}'));
check('modal: explica por que no se puede', leer('src/components/PlatoModal.tsx').includes('MENSAJE_YA_HAY'));
check('dieta: la fila del plato no tiene foodId', dietaPlatos.includes('foodId: -1'));
check('dieta: toggle Plato criollo', dietaPlatos.includes('"Plato criollo"'));
check('dieta: pasa las kcal restantes al modal', dietaPlatos.includes('kcalRestantes={targets.metaCalorica - totalAudit.energiaTablaKcal}'));

const modal = leer('src/components/PlatoModal.tsx');
check('modal: ajusta la porcion al presupuesto', modal.includes('factorParaPresupuesto(base.totales.kcal, kcalRestantes)'));
check('modal: declara los ingredientes sin dato', modal.includes('Ingrediente sin dato en la tabla'));
check('modal: lista las observaciones', modal.includes('plato.observaciones'));
check('modal: cierra con Escape', modal.includes("e.key === 'Escape'"));
check('modal: usa el texto de porcion', modal.includes('textoPorcion(factor)'));

const buscador = leer('src/components/BuscadorPlato.tsx');
check('buscador de platos: avisa las recetas caseras', buscador.includes('recetas caseras'));
check('buscador de platos: ordena alfabetico', buscador.includes("a.nombre.localeCompare(b.nombre, 'es')"));
check('buscador de platos: no recorta la lista', buscador.includes('.slice(0'), false);

console.log('=== Cableado de la UI: verificación ===');
if (fallos.length) {
  console.log(`\n❌ ${fallos.length} FALLO(S) de ${ok + fallos.length}:`);
  fallos.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(`\n✅ ${ok}/${ok} aserciones OK`);
