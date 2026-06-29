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
  // Get columns for orders
  const cols = await queryMgmt(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'orders';
  `);
  console.log("Columns:", cols);
  
  // Find recent orders
  const orders = await queryMgmt(`
    SELECT *
    FROM orders
    ORDER BY id DESC
    LIMIT 20;
  `);
  
  console.log("Recent Orders:");
  orders.forEach(o => {
    // guess timestamp columns
    const timeCols = ['created_at', 'timestamp', 'date', 'order_date', 'createdAt'];
    let t = '';
    for (const tc of timeCols) {
      if (o[tc]) { t = o[tc]; break; }
    }
    console.log(`ID: ${o.id} | N: ${o.order_number} | Time: ${t} | Type: ${o.operation_type} | Status: ${o.order_status} | Cycle: ${o.cycle_id}`);
  });

  // Find active cycle
  const cycles = await queryMgmt(`
    SELECT id, cycle_number, status, opened_at
    FROM cycles
    WHERE status = 'Active' OR status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;
  `);
  console.log("\nActive Cycle:");
  console.log(cycles);
}

main().catch(err => console.error(err));
