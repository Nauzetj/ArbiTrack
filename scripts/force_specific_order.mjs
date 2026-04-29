import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const envVars = Object.fromEntries(
  env.split('\n')
    .filter(Boolean)
    .map(l => l.split('='))
    .filter(p => p.length >= 2)
    .map(([k, ...v]) => [k.trim(), v.join('=').trim().replace(/['"]/g, '')])
);

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function main() {
  const { data: cycle } = await supabase
    .from('cycles')
    .select('id, cycle_number, user_id, status')
    .order('opened_at', { ascending: false })
    .limit(1);
    
  if (!cycle || cycle.length === 0) {
    console.log('No active cycle found');
    return;
  }
  
  const cycleId = cycle[0].id;
  const userId = cycle[0].user_id;
  console.log('Active cycle ID:', cycleId, 'Cycle number:', cycle[0].cycle_number);
  
  const orderNum = '22882068752786927616';
  const { data: order } = await supabase.from('orders').select('*').eq('order_number', orderNum);
  
  console.log('Order found in DB:', order ? order.length : 0);
  
  if (order && order.length > 0) {
    const { data: updated, error } = await supabase
      .from('orders')
      .update({ order_status: 'COMPLETED', cycle_id: cycleId })
      .eq('order_number', orderNum)
      .select();
      
    if (error) console.error('Update error:', error);
    else console.log('Updated order:', updated[0].order_number, 'to COMPLETED and assigned to cycle', cycle[0].cycle_number);
    
    // Now call recalculate_cycle_metrics RPC
    console.log('Triggering RPC recalculate_cycle_metrics...');
    const { error: rpcError } = await supabase.rpc('recalculate_cycle_metrics', {
      p_cycle_id: cycleId,
      p_user_id: userId,
    });
    
    if (rpcError) console.error('RPC Error:', rpcError);
    else console.log('Cycle metrics recalculated successfully.');
    
  } else {
    console.log('Order not found in DB! You need to fetch it first from Binance.');
  }
}

main();
