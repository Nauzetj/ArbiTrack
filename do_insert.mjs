import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyozrlgyzjishmpwjpce.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3pybGd5emppc2htcHdqcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODYxODI2NCwiZXhwIjoyMDU0MTk0MjY0fQ.zFv488V3Z8FjFxg9mH4F1Xm26KxS7O706vOh3r_0Otw';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log('🔍 Buscando ciclo activo...');
  
  // Find the most recent active cycle
  const { data: cycles, error: cycleErr } = await supabase
    .from('cycles')
    .select('id, cycle_number, status, opened_at, user_id')
    .in('status', ['En curso', 'Active'])
    .order('opened_at', { ascending: false })
    .limit(1);

  if (cycleErr) {
    console.error('Error fetching cycles:', cycleErr.message);
    process.exit(1);
  }

  if (!cycles || cycles.length === 0) {
    console.error('❌ No se encontró ningún ciclo en curso.');
    process.exit(1);
  }

  const activeCycle = cycles[0];
  console.log(`✅ Ciclo activo: #${activeCycle.cycle_number} (ID: ${activeCycle.id})`);
  
  const orderNumber = 'MANUAL-' + Date.now();
  const amount = 2600;
  const unitPrice = 691.999;
  const totalPrice = amount * unitPrice;
  const commission = 0; // Using "comision plana" / "plata" as 0, or just setting commission_type?

  console.log(`\n🔗 Insertando orden de VENTA (2600 USDT a ${unitPrice})...`);

  const { data: insertResult, error: insertErr } = await supabase
    .from('orders')
    .insert([
      {
        order_number: orderNumber,
        trade_type: 'SELL',
        operation_type: 'VENTA_USDT',
        origin_mode: 'manual',
        commission_type: 'fixed',
        asset: 'USDT',
        fiat: 'VES',
        total_price: totalPrice,
        unit_price: unitPrice,
        amount: amount,
        commission: commission,
        commission_asset: 'USDT',
        order_status: 'COMPLETED',
        create_time_utc: new Date().toISOString(),
        create_time_local: new Date().toISOString(),
        cycle_id: activeCycle.id,
        user_id: activeCycle.user_id,
        notas: 'Comisión plata / plana / plataforma manual'
      }
    ])
    .select();

  if (insertErr) {
    console.error('❌ Error al insertar la orden:', insertErr.message);
    process.exit(1);
  }

  console.log('\n🎉 Orden insertada exitosamente:');
  console.log(JSON.stringify(insertResult[0], null, 2));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
