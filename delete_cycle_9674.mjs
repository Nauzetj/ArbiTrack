#!/usr/bin/env node
/**
 * delete_cycle_9674.mjs
 * Busca y elimina el ciclo cuyo cycle_number termina en 9674
 * junto con todas sus órdenes asociadas.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyozrlgyzjishmpwjpce.supabase.co';
const EMAIL    = process.argv[2];
const PASSWORD = process.argv[3];

if (!EMAIL || !PASSWORD) {
  console.error('Uso: node delete_cycle_9674.mjs <email> <password>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, 'sb_publishable_-FdpQLX1dD3VVnZkXJ0lzQ_S2x5zVbW', {
  auth: { persistSession: false }
});

async function main() {
  // 1. Autenticar
  console.log(`Autenticando como ${EMAIL}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authError) { console.error('Error auth:', authError.message); return; }
  console.log('✅ Autenticado.\n');

  // 2. Buscar el ciclo por los últimos 4 dígitos del cycle_number (9674)
  // cycle_number es entero, así que filtramos con módulo: cycle_number % 10000 = 9674
  const { data: cycles, error: cErr } = await supabase
    .from('cycles')
    .select('id, cycle_number, status, opened_at, closed_at, ganancia_usdt, ganancia_ves')
    .gte('cycle_number', 9674)
    .filter('cycle_number', 'in', '(9674,19674,29674,39674,49674,59674,69674,79674,89674,99674,109674,119674,209674,319674,419674,519674,619674,719674,819674,919674)');

  if (cErr) { console.error('Error buscando ciclo:', cErr.message); return; }
  if (!cycles || cycles.length === 0) {
    console.error('❌ No se encontró ningún ciclo con número terminado en 9674.');
    return;
  }

  console.log('Ciclos encontrados:');
  cycles.forEach(c => console.log(`  - ID: ${c.id} | #${c.cycle_number} | Status: ${c.status} | Apertura: ${c.opened_at} | Cierre: ${c.closed_at} | Ganancia: ${c.ganancia_usdt} USDT`));

  if (cycles.length > 1) {
    console.error('\n⚠️  Se encontraron múltiples ciclos. Especifica el ID exacto.');
    return;
  }

  const cycle = cycles[0];
  console.log(`\n🎯 Ciclo a eliminar: #${cycle.cycle_number} (ID: ${cycle.id})`);

  // 3. Buscar órdenes del ciclo
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('id, order_number, operation_type, amount')
    .eq('cycle_id', cycle.id);

  if (oErr) { console.error('Error buscando órdenes:', oErr.message); return; }
  console.log(`📋 Órdenes asociadas: ${orders?.length ?? 0}`);
  orders?.forEach(o => console.log(`   - ${o.order_number} | ${o.operation_type} | ${o.amount} USDT`));

  // 4. Desasignar órdenes del ciclo (cycle_id = null)
  if (orders && orders.length > 0) {
    console.log('\n🔓 Desasignando órdenes del ciclo...');
    const { error: unassignErr } = await supabase
      .from('orders')
      .update({ cycle_id: null })
      .eq('cycle_id', cycle.id);
    if (unassignErr) { console.error('Error desasignando órdenes:', unassignErr.message); return; }
    console.log(`✅ ${orders.length} órdenes desasignadas.`);
  }

  // 5. Eliminar el ciclo
  console.log('\n🗑️  Eliminando ciclo...');
  const { error: delErr } = await supabase
    .from('cycles')
    .delete()
    .eq('id', cycle.id);

  if (delErr) { console.error('Error eliminando ciclo:', delErr.message); return; }
  console.log(`✅ Ciclo #${cycle.cycle_number} eliminado exitosamente.`);

  await supabase.auth.signOut();
}

main().catch(console.error);
