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
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', '22881388230651506688')
    .single();

  console.log('Target Order:', order);

  const { data: cycleOrders } = await supabase
    .from('orders')
    .select('id, trade_type, operation_type, order_status')
    .eq('cycle_id', '29fbfb0b-42a1-4294-a700-0df131cbfa8d');
  
  console.log(`Total orders in cycle: ${cycleOrders?.length}`);
  console.log('Status breakdown:');
  const statuses = cycleOrders?.reduce((acc, o) => {
      acc[o.order_status] = (acc[o.order_status] || 0) + 1;
      return acc;
  }, {});
  console.log(statuses);

  // Check what "COMPLETED" orders look like
  const { data: sampleCompleted } = await supabase
    .from('orders')
    .select('*')
    .eq('cycle_id', '29fbfb0b-42a1-4294-a700-0df131cbfa8d')
    .eq('order_status', 'COMPLETED')
    .limit(1);

  console.log('Sample Completed Order:', sampleCompleted[0]);
}
main();
