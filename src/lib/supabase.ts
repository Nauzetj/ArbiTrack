import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Lee la sesión de localStorage sin roundtrip al servidor en cada mount
    persistSession: true,
    autoRefreshToken: true,
    // No es OAuth con redirect → evita parsear la URL en cada carga
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'X-Client-Info': 'arbitrack-spa/1.0' },
  },
  db: { schema: 'public' },
  realtime: {
    // Sin suscripciones activas → no abrir WebSocket innecesariamente
    params: { eventsPerSecond: 10 },
  },
});
