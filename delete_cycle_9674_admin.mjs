#!/usr/bin/env node
/**
 * delete_cycle_9674_admin.mjs
 * Busca y elimina el ciclo #9674 usando service role (acceso total).
 */

import { createClient } from '@supabase/supabase-js';

// Usamos la service role del archivo get_recent_cycles_admin.mjs del proyecto
const SUPABASE_URL     = 'https://gyozrlgyzjishmpwjpce.supabase.co';
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error('Uso: node delete_cycle_9674_admin.mjs <service_role_key>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  // 1. Buscar por cycle_number terminado en 9674 usando REST directo
  console.log('Buscando ciclo #9674...');
  const { data: cycles, error: cErr } = await supabase
    .from('cycles')
    .select('id, cycle_number, status, opened_at, closed_at, ganancia_usdt, user_id')
    .eq('cycle_number', 9674);

  if (cErr) { console.error('Error:', cErr.message); return; }

  // También buscar por números que terminen en 9674 (timestamp-based)
  let allCycles = cycles || [];
  
  if (allCycles.length === 0) {
    // El cycle_number es un timestamp recortado, buscar en rango
    const { data: c2 } = await supabase
      .from('cycles')
      .select('id, cycle_number, status, opened_at, closed_at, ganancia_usdt, user_id')
      .gte('opened_at', '2026-05-17')
      .lte('opened_at', '2026-05-20')
      .eq('status', 'Con pérdida');
    
    allCycles = c2 || [];
  }

  if (allCycles.length === 0) {
    console.error('❌ No se encontró el ciclo.');
    return;
  }

  console.log(`Ciclos encontrados (${allCycles.length}):`);
  allCycles.forEach(c => {
    const num = c.cycle_number.toString();
    const last4 = num.slice(-4);
    console.log(`  - #${num} (últimos 4: ${last4}) | Status: ${c.status} | Apertura: ${c.opened_at} | Cierre: ${c.closed_at} | Ganancia: ${c.ganancia_usdt} USDT | UserID: ${c.user_id}`);
  });

  // Filtrar el que termina en 9674
  const target = allCycles.find(c => c.cycle_number.toString().slice(-4) === '9674');
  if (!target) {
    console.log('\n⚠️  Ninguno termina en 9674. Mostrando todos los encontrados arriba para revisión manual.');
    return;
  }

  console.log(`\n🎯 Eliminando: #${target.cycle_number} (ID: ${target.id})`);

  // Desasignar órdenes
  const { data: orders } = await supabase.from('orders').select('id, order_number').eq('cycle_id', target.id);
  if (orders && orders.length > 0) {
    console.log(`📋 Desasignando ${orders.length} órdenes...`);
    await supabase.from('orders').update({ cycle_id: null }).eq('cycle_id', target.id);
    console.log('✅ Órdenes desasignadas.');
  } else {
    console.log('📋 Sin órdenes asociadas.');
  }

  // Eliminar ciclo
  const { error: delErr } = await supabase.from('cycles').delete().eq('id', target.id);
  if (delErr) { console.error('Error eliminando:', delErr.message); return; }
  console.log(`\n✅ ¡Ciclo #${target.cycle_number.toString().slice(-4)} eliminado exitosamente!`);
}

main().catch(console.error);
