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
  const { data: cycles, error: err1 } = await supabase
    .from('cycles')
    .select('*')
    .gte('opened_at', '2026-04-28T00:00:00Z')
    .order('opened_at', { ascending: false });
    
  if (err1) console.error(err1);
  else console.log('Recent cycles:', cycles.map(c => ({ id: c.id, cycle_number: c.cycle_number, opened_at: c.opened_at, closed_at: c.closed_at })));

  const { data: orders, error: err2 } = await supabase
    .from('orders')
    .select('id, order_number, timestamp, cycle_id')
    .gte('timestamp', '2026-04-28T00:00:00Z')
    .order('timestamp', { ascending: false });
    
  if (err2) console.error(err2);
  else console.log('Recent orders:', orders.map(o => ({ id: o.id, order_number: o.order_number, timestamp: o.timestamp, cycle_id: o.cycle_id })));
}
main();
