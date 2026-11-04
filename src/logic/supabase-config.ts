// VALIDACIÓN DE LA CONFIGURACIÓN DE SUPABASE (núcleo puro, sin imports).
//
// Por qué existe: el 04/11/2026 el deploy a Vercel se cayó con
// "supabaseUrl is required" y una traza de 10 líneas que no decía NADA útil.
// El archivo avisaba con un `console.warn` y acto seguido explotaba igual.
//
// Regla: si falta configuración, el que falla es el BUILT (no un deploy roto que
// se cae en el navegador), y el mensaje tiene que decir TRES cosas:
//   1) QUÉ variable falta (con su nombre exacto)
//   2) POR QUÉ está vacía (no está en el entorno de BUILD)
//   3) DÓNDE se arregla (Vercel → Settings → Environment Variables → Redeploy)
//
// Se valida el FORMATO además de la presencia porque el error más común no es
// "falta", es "pegaste otra cosa" (la URL del panel, la service_role key, el
// snippet de JS de la documentación).

export interface ConfigSupabase {
  ok: boolean;
  /** Nombres exactos de las variables que están vacías. */
  faltantes: string[];
  /** Problema de formato (no de presencia), o null. */
  problema: string | null;
  /** Mensaje listo para tirar en un Error. Vacío si está todo bien. */
  mensaje: string;
  /** Valores ya limpios (sin espacios ni barra final). */
  url: string;
  key: string;
}

/** Dónde se arregla. Va en el mensaje para que nadie tenga que adivinar. */
export const DONDE_SE_CONFIGURA =
  'Se configura en Vercel → Settings → Environment Variables (marcá Production, Preview y Development) y después Redeploy; en local, en el archivo .env';

function limpiar(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

/** La URL tiene que ser la Project URL (https://<ref>.supabase.co). */
function urlValida(url: string): boolean {
  if (!/^https:\/\//i.test(url)) return false;
  if (/^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) return true;
  // .co, .in y variantes: lo importante es que el host sea de Supabase.
  return /^https:\/\/[^\s/]+\.[^\s/]*supabase\.[^\s/]+$/i.test(url);
}

/**
 * La key pública puede venir en dos formatos: el JWT clásico (`eyJ...`) o el
 * nuevo `sb_publishable_...`. NO se valida como JWT de verdad: solo se descarta
 * lo que claramente no es una key (vacío, texto suelto, el snippet copiado mal).
 */
function keyValida(key: string): boolean {
  if (key.length < 40) return false;
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) return true;
  return /^sb_publishable_[\w-]{20,}$/.test(key);
}

export function configSupabase(urlCruda: unknown, keyCruda: unknown): ConfigSupabase {
  const url = limpiar(urlCruda).replace(/\/+$/, '');
  const key = limpiar(keyCruda);

  const faltantes: string[] = [];
  if (!url) faltantes.push('PUBLIC_SUPABASE_URL');
  if (!key) faltantes.push('PUBLIC_SUPABASE_ANON_KEY');

  let problema: string | null = null;
  if (!faltantes.length) {
    if (!urlValida(url)) {
      problema = `PUBLIC_SUPABASE_URL no parece la Project URL de Supabase (se esperaba algo como https://tuproyecto.supabase.co). Valor recibido: "${url.slice(0, 80)}"`;
    } else if (!keyValida(key)) {
      problema =
        'PUBLIC_SUPABASE_ANON_KEY no parece la anon/public key: tiene que empezar con "eyJ" o "sb_publishable_". Ojo con pegar la service_role o el snippet de JS de la documentación';
    }
  }

  const ok = faltantes.length === 0 && !problema;

  const partes: string[] = [];
  if (faltantes.length === 1) {
    partes.push(`Falta la variable ${faltantes[0]} en el entorno de BUILD`);
  } else if (faltantes.length === 2) {
    partes.push('Faltan las DOS variables en el entorno de BUILD: PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY');
  }
  if (problema) partes.push(problema);

  return {
    ok,
    faltantes,
    problema,
    mensaje: ok ? '' : `${partes.join('. ')}. ${DONDE_SE_CONFIGURA}.`,
    url,
    key,
  };
}
