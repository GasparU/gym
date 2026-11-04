/**
 * Formato de numeros en es-PE sin depender del locale del runtime.
 * numEs(1387) -> "1.387"      numEs(2.367005, 2) -> "2,37"
 * numEsMax(95.8, 1) -> "95,8" numEsMax(300, 1) -> "300"
 */
export function numEs(valor: number, decimales = 0): string {
  const n = Number.isFinite(valor) ? valor : 0;
  const fijo = n.toFixed(decimales);
  const negativo = fijo.startsWith('-');
  const [entera, frac] = (negativo ? fijo.slice(1) : fijo).split('.');
  const conMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cuerpo = decimales > 0 && frac ? `${conMiles},${frac}` : conMiles;
  return negativo ? `-${cuerpo}` : cuerpo;
}

/** Igual que numEs, pero recorta los ceros de cola ("95,80" -> "95,8"). */
export function numEsMax(valor: number, maxDecimales = 2): string {
  const fijo = numEs(valor, maxDecimales);
  if (!fijo.includes(',')) return fijo;
  return fijo.replace(/0+$/, '').replace(/,$/, '');
}
