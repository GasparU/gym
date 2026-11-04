const fs = require('fs');
const path = require('path');

// Asegúrate de tener instalada la librería xlsx: npm install -D xlsx
const XLSX = require('xlsx');

// 1. Ruta de tu archivo excel original
const excelPath = path.join(__dirname, 'formula nutricion.xlsx');

if (!fs.existsSync(excelPath)) {
  console.error('❌ No se encontró el archivo "formula nutricion.xlsx" en la raíz del proyecto.');
  console.log('👉 Copia tu archivo Excel en esta carpeta y vuelve a ejecutar: node convert.cjs');
  process.exit(1);
}

const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets['Datos'];

if (!sheet) {
  console.error('❌ No se encontró la hoja "Datos" en el Excel.');
  process.exit(1);
}

const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

function cleanNum(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).trim().replace(/•/g, '0').replace(/,/g, '.');
  const match = s.match(/[-+]?\d*\.?\d+/);
  return match ? parseFloat(match[0]) : 0;
}

const foods = [];

// Empezamos en la fila 1 (la fila 0 son los encabezados)
for (let i = 1; i < rawRows.length; i++) {
  const row = rawRows[i];
  if (!row || !row[2]) continue;

  const nombre = String(row[2]).trim();
  const nombreLower = nombre.toLowerCase();
  const esCocido = ['cocid', 'sancochad', 'frit', 'asado', 'hornead'].some(w => nombreLower.includes(w));

  foods.push({
    id: typeof row[1] === 'number' ? row[1] : foods.length + 1,
    codigo: row[0] ? String(row[0]).trim() : '',
    nombre: nombre,
    energiaKcal: cleanNum(row[3]),
    agua: cleanNum(row[4]),
    proteinas: cleanNum(row[5]),
    grasaTotal: cleanNum(row[6]),
    carbohidratosTotales: cleanNum(row[7]),
    carbohidratosDisponibles: cleanNum(row[8]),
    fibra: cleanNum(row[9]),
    esCocido: esCocido
  });
}

// 2. Crear carpeta public/data si no existe y guardar
const outputDir = path.join(__dirname, 'public', 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'foods.json');
fs.writeFileSync(outputPath, JSON.stringify(foods, null, 2), 'utf-8');

console.log(`✅ ¡Éxito! Se exportaron ${foods.length} alimentos peruanos limpios en:`);
console.log(`📁 ${outputPath}`);