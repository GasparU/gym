import { createClient } from '@supabase/supabase-js';
import { configSupabase } from '../logic/supabase-config';

// Las variables PUBLIC_* se INCRUSTAN en el JS al momento de COMPILAR (el sitio
// es estático), así que tienen que existir en la máquina que hace el build:
// Vercel las necesita configuradas, no alcanza con tener el .env local.
const config = configSupabase(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
);

// Se falla ACÁ (en el build) y no en el navegador: un sitio publicado sin
// configuración se ve "vacío" y confunde. Antes este archivo imprimía un
// console.warn y la línea siguiente explotaba con "supabaseUrl is required",
// que fue justo lo que pasó en el deploy del 04/11/2026: 10 líneas de traza y
// ni una pista de qué variable faltaba.
if (!config.ok) {
  throw new Error(`[Supabase no configurado] ${config.mensaje}`);
}

export const supabase = createClient(config.url, config.key);
