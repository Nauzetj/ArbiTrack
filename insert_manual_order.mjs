#!/usr/bin/env node
const PROJECT_REF = 'gyozrlgyzjishmpwjpce';
const PAT         = 'sbp_7e62b469dfdae29c8563f9365e47428f00792ce7';

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
  console.log('🔍 Buscando ciclos recientes...');
  
  const cyclesResult = await queryMgmt(`
    SELECT id, cycle_number, status, opened_at, user_id
    FROM cycles
    ORDER BY opened_at DESC
    LIMIT 5;
  `);
  
  console.log('\n📋 Últimos ciclos:');
  console.log(JSON.stringify(cyclesResult, null, 2));

  if (!cyclesResult || cyclesResult.length === 0) {
    console.error('No cycles found.');
    process.exit(1);
  }

  const activeCycle = cyclesResult[0]; // Take the most recent one
  
  console.log('Inserting order for cycle_id:', activeCycle.id, 'user_id:', activeCycle.user_id);
  
  const orderNumber = 'MANUAL-' + Date.now();
  
  const amount = 2600;
  const unitPrice = 691.999;
  const totalPrice = amount * unitPrice;

  // Insert VENTA order
  const insertQuery = `
    INSERT INTO orders (
      order_number, 
      trade_type, 
      operation_type,
      origin_mode,
      asset, 
      fiat, 
      total_price, 
      unit_price, 
      amount, 
      commission, 
      commission_asset, 
      order_status, 
      create_time_utc, 
      create_time_local, 
      cycle_id, 
      user_id
    ) VALUES (
      '${orderNumber}', 
      'SELL', 
      'VENTA_USDT',
      'manual',
      'USDT', 
      'VES', 
      ${totalPrice}, 
      ${unitPrice}, 
      ${amount}, 
      0, 
      'USDT', 
      'COMPLETED', 
      NOW(), 
      NOW(), 
      '${activeCycle.id}', 
      '${activeCycle.user_id}'
    )
    RETURNING *;
  `;
  
  const insertResult = await queryMgmt(insertQuery);
  console.log('\n✅ Order inserted:');
  console.log(JSON.stringify(insertResult, null, 2));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
