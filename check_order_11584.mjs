import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkOrder() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, amount, cycle_id')
    .ilike('order_number', '%11584%');
    
  console.log('Result for %11584%:', JSON.stringify(data, null, 2));
  console.log('Error:', error);
}

checkOrder();
