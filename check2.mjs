import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const envVars = {};
env.split('\n').filter(Boolean).forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"]/g, '');
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false }});

async function main() {
  const { data, error } = await supabase.from('cycles').select('*').order('opened_at', { ascending: false }).limit(50);
  if (error) {
    console.error(error);
    return;
  }
  const match = data.find(c => String(c.cycle_number).endsWith('2425'));
  if (match) {
    console.log("Found cycle:", match.id, match.cycle_number, match.opened_at, match.closed_at);
  } else {
    console.log("Cycle 2425 not found in the last 50 cycles.");
    console.log("Here are the cycle numbers found:", data.map(c => String(c.cycle_number).slice(-4)).join(', '));
  }
}
main();
