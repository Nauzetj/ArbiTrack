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
  const orderNumber = '22881388230651506688';
  
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', orderNumber);
    
  if (error) {
    console.error('Error fetching order:', error);
    return;
  }
  
  console.log('Order found:', order);

  // Also fetch the active cycle to know the cycle_id
  const { data: cycle, error: cycleError } = await supabase
    .from('cycles')
    .select('id, cycle_number, status')
    .eq('status', 'En curso')
    .single();

  if (cycleError) {
      console.error('Error fetching active cycle:', cycleError);
  } else {
      console.log('Active Cycle:', cycle);
  }
}
main();
