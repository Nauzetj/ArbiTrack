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
  console.log('🔍 Buscando ciclo activo...');
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .in('status', ['En curso', 'Active'])
    .order('opened_at', { ascending: false })
    .limit(1);

  if (error) { console.error('Error:', error.message); process.exit(1); }
  
  console.log(data);
  
  if (data && data.length > 0) {
     const cycle = data[0];
     console.log('Active Cycle ID:', cycle.id, 'User ID:', cycle.user_id);
     
     console.log('\nChecking order columns...');
     const { data: cols, error: colErr } = await supabase.from('orders').select('*').limit(1);
     if (cols) {
       console.log('Order columns:', Object.keys(cols[0]));
     }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
