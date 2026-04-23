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
    .select('*')
    .order('opened_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('Error fetching cycles:', error);
    return;
  }
  
  console.log('Recent 10 cycles:', cycles.map(c => ({ id: c.id, cycle_number: c.cycle_number, status: c.status, opened_at: c.opened_at, closed_at: c.closed_at })));
}
main();
