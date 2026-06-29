import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyozrlgyzjishmpwjpce.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3pybGd5emppc2htcHdqcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODYxODI2NCwiZXhwIjoyMDU0MTk0MjY0fQ.zFv488V3Z8FjFxg9mH4F1Xm26KxS7O706vOh3r_0Otw';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const targetCycleId = 'd67aff6c-b044-49f2-96a5-1ecad19e844c';

  console.log('Buscando las órdenes faltantes en la DB...');
  const { data: foundOrders, error: findErr } = await supabase
    .from('orders')
    .select('id, order_number, amount, cycle_id, user_id')
    .or('amount.eq.700.06,amount.eq.287.02,order_number.ilike.%11584%');

  if (findErr) {
    console.error('Error buscando órdenes:', findErr);
    return;
  }

  console.log('Órdenes encontradas:', foundOrders);

  if (!foundOrders || foundOrders.length === 0) {
    console.log('❌ ¡Las órdenes definitivamente no existen en la tabla orders!');
    return;
  }

  console.log(`\nAsignando ${foundOrders.length} órdenes al ciclo ${targetCycleId}...`);

  for (const o of foundOrders) {
    const { error: updErr } = await supabase
      .from('orders')
      .update({ cycle_id: targetCycleId })
      .eq('id', o.id);
      
    if (updErr) console.error(`Error actualizando ${o.order_number}:`, updErr);
    else console.log(`✅ Orden ${o.order_number} asignada.`);
  }

  const userId = foundOrders[0].user_id;
  
  console.log('\nRecalculando métricas del ciclo...');
  const { error: rpcErr } = await supabase.rpc('recalculate_cycle_metrics', {
    p_cycle_id: targetCycleId,
    p_user_id: userId,
  });

  if (rpcErr) console.error('Error al recalcular (RPC):', rpcErr);
  else console.log('🔄 Métricas recalculadas con éxito.');
}

main().catch(console.error);
