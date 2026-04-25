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
  const { data: cycle1Orders, error: error1 } = await supabase
    .from('orders')
    .select('id')
    .eq('cycle_id', 'fa4caaac-9e2b-4a58-b2d2-85cf6d51ae2e');

  const { data: cycle2Orders, error: error2 } = await supabase
    .from('orders')
    .select('id')
    .eq('cycle_id', '29fbfb0b-42a1-4294-a700-0df131cbfa8d');

  console.log('Cycle 598062178 (fa4caaac) orders:', cycle1Orders?.length);
  console.log('Cycle 125435067 (29fbfb0b) orders:', cycle2Orders?.length);
}
main();
