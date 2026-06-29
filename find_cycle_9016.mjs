import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const envVars = {};
env.split('\n').filter(Boolean).forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/['"]/g, '');
    envVars[key] = val;
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) })
  }
});

async function main() {
  console.log('🔍 Buscando ciclos recientes (últimos 10)...\n');

  const { data, error } = await supabase
    .from('cycles')
    .select('id, cycle_number, opened_at, closed_at, status')
    .order('opened_at', { ascending: false })
    .limit(10);

  if (error) { console.error('Error:', error.message); process.exit(1); }

  data?.forEach(c => {
    console.log(`Ciclo #${c.cycle_number}  |  ${c.opened_at}  →  ${c.closed_at}  |  ${c.status}  |  ID: ${c.id}`);
  });
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
