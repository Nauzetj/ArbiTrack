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
  const {data: o1} = await supabase.from('orders').select('id, amount').eq('cycle_id', '59bb3b2e-7ecd-4acd-a40b-5d86d061c307');
  const {data: o2} = await supabase.from('orders').select('id, amount').eq('cycle_id', '8f33f483-794c-4aaf-b870-0381be4ac807');
  console.log('Orders in #2391 (kept):', o1.length);
  console.log('Orders in #2798 (closed):', o2.length);

  // If we closed 2798 but it had all the orders, let's reopen it and close 2391 instead.
  if (o2.length > 0 && o1.length === 0) {
     console.log('Fixing the cycle statuses: Opening 2798 and Closing 2391...');
     await supabase.from('cycles').update({ status: 'En curso', closed_at: null }).eq('id', '8f33f483-794c-4aaf-b870-0381be4ac807');
     await supabase.from('cycles').update({ status: 'Eliminado', closed_at: new Date().toISOString() }).eq('id', '59bb3b2e-7ecd-4acd-a40b-5d86d061c307');
  } else if (o1.length > 0 && o2.length > 0) {
     console.log('Both have orders! Merging 2798 to 2391...');
     await supabase.from('orders').update({ cycle_id: '59bb3b2e-7ecd-4acd-a40b-5d86d061c307' }).eq('cycle_id', '8f33f483-794c-4aaf-b870-0381be4ac807');
     await supabase.rpc('recalculate_cycle_metrics', { p_cycle_id: '59bb3b2e-7ecd-4acd-a40b-5d86d061c307', p_user_id: '480be850-ea85-4a8c-acf6-72947bfc3eb7' });
  }

}
main();
