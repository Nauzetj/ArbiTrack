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
  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('id, order_number, cycle_id, order_status, operation_type, amount, trade_type, user_id')
    .or('amount.eq.700.06,amount.eq.287.02,order_number.ilike.%11584%');
  
  if (ordErr) console.error("Orders Error:", ordErr);
  else console.log("Orders found:", orders);
}
main();
