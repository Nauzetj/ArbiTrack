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
  const { data: sampleSell } = await supabase
    .from('orders')
    .select('id, trade_type, operation_type, origin_mode, order_status')
    .eq('cycle_id', '29fbfb0b-42a1-4294-a700-0df131cbfa8d')
    .eq('trade_type', 'SELL')
    .eq('order_status', 'COMPLETED')
    .limit(1);

  console.log('Sample Sell Order:', sampleSell[0]);
}
main();
