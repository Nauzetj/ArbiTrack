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
  const orderNumbers = ['22884093956911820800', '22884095394053517312'];
  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('id, order_number, cycle_id, order_status, operation_type, amount')
    .in('order_number', orderNumbers);
  
  if (ordErr) console.error("Orders Error:", ordErr);
  else console.log("Orders found:", orders);

  const { data: allCycles, error: cycErr } = await supabase
    .from('cycles')
    .select('id, cycle_number, status, opened_at')
    .order('opened_at', { ascending: false })
    .limit(5);

  if (cycErr) console.error("Cycles Error:", cycErr);
  else console.log("All cycles:", allCycles);
}
main();
