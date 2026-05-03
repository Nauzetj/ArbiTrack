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
  auth: { persistSession: false }
});

async function main() {
  const { data: cycles, error } = await supabase
    .from('cycles')
    .select('id, cycle_number, opened_at, closed_at')
    .order('opened_at', { ascending: false })
    .limit(10);
    
  if (error) console.error(error);
  else console.log('Recent 10 cycles:', cycles);
}
main();
