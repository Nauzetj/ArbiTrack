import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://gyozrlgyzjishmpwjpce.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3pybGd5emppc2htcHdqcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODYxODI2NCwiZXhwIjoyMDU0MTk0MjY0fQ.zFv488V3Z8FjFxg9mH4F1Xm26KxS7O706vOh3r_0Otw";
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const { data: cycles, error: err1 } = await supabase
    .from('cycles')
    .select('id, cycle_number, status, opened_at')
    .in('status', ['open', 'Active'])
    .order('opened_at', { ascending: false });
    
  if (err1) console.error("Cycles error:", err1);
  else console.log('Active cycles:', cycles);

  const { data: orders, error: err2 } = await supabase
    .from('orders')
    .select('*')
    .order('id', { ascending: false })
    .limit(50);
    
  if (err2) console.error("Orders error:", err2);
  else {
    console.log('Recent orders (last 50):');
    orders.forEach(o => {
      // Find the timestamp field dynamically
      const timeCols = ['created_at', 'timestamp', 'date', 'order_date', 'createdAt'];
      let t = '';
      for (const tc of timeCols) {
        if (o[tc]) { t = o[tc]; break; }
      }
      if (!t) {
         // if not found, use whatever looks like date
         t = o.updated_at || o.opened_at || "unknown";
      }
      console.log(`[${t}] ID: ${o.id} | N: ${o.order_number} | Type: ${o.operation_type} | Amount: ${o.fiat_amount} | Cycle: ${o.cycle_id}`);
    });
  }
}
main();
