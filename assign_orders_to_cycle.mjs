#!/usr/bin/env node
// ============================================================
// Asignar órdenes al ciclo activo actual via Supabase Mgmt API
// Órdenes: 22884093956911820800 y 22884095394053517312
// ============================================================

const PROJECT_REF = 'gyozrlgyzjishmpwjpce';
const PAT         = 'sbp_7e62b469dfdae29c8563f9365e47428f00792ce7';

const ORDER_NUMBERS = ['22884093956911820800', '22884095394053517312'];

async function queryMgmt(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PAT}` },
    body: JSON.stringify({ query: sql }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API error ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  console.log('🔍 Buscando ciclo activo...');
  
  // PASO 1: Obtener el ciclo activo
  const cyclesResult = await queryMgmt(`
    SELECT id, cycle_number, status, opened_at
    FROM cycles
    WHERE status = 'Active'
    ORDER BY opened_at DESC
    LIMIT 5;
  `);
  
  console.log('\n📋 Ciclos activos encontrados:');
  console.log(JSON.stringify(cyclesResult, null, 2));
  
  if (!cyclesResult || cyclesResult.length === 0) {
    console.error('❌ No se encontró ningún ciclo activo.');
    process.exit(1);
  }
  
  const activeCycle = cyclesResult[0];
  const cycleId = activeCycle.id;
  console.log(`\n✅ Ciclo activo: #${activeCycle.cycle_number} (ID: ${cycleId})`);
  console.log(`   Abierto: ${activeCycle.opened_at}`);
  
  // PASO 2: Ver el estado actual de las órdenes
  console.log('\n🔍 Buscando las órdenes que queremos asignar...');
  const ordersCheck = await queryMgmt(`
    SELECT id, order_number, cycle_id, order_status, operation_type, amount
    FROM orders
    WHERE order_number IN ('${ORDER_NUMBERS[0]}', '${ORDER_NUMBERS[1]}');
  `);
  
  console.log('\n📦 Estado actual de las órdenes:');
  console.log(JSON.stringify(ordersCheck, null, 2));
  
  if (!ordersCheck || ordersCheck.length === 0) {
    console.error('❌ No se encontraron las órdenes en la base de datos.');
    process.exit(1);
  }
  
  // PASO 3: Asignar las órdenes al ciclo activo
  console.log(`\n🔗 Asignando órdenes al ciclo #${activeCycle.cycle_number}...`);
  const updateResult = await queryMgmt(`
    UPDATE orders
    SET cycle_id = '${cycleId}'
    WHERE order_number IN ('${ORDER_NUMBERS[0]}', '${ORDER_NUMBERS[1]}')
    RETURNING id, order_number, cycle_id, order_status;
  `);
  
  console.log('\n✅ Resultado del UPDATE:');
  console.log(JSON.stringify(updateResult, null, 2));
  
  if (!updateResult || updateResult.length === 0) {
    console.warn('⚠️  El UPDATE no afectó ninguna fila. Las órdenes puede que ya estaban asignadas o no existen.');
    process.exit(1);
  }
  
  console.log(`\n🎉 ¡Listo! ${updateResult.length} orden(es) asignadas al ciclo #${activeCycle.cycle_number}`);
  console.log('   Las órdenes ahora deberían aparecer en el dashboard.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
