import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyozrlgyzjishmpwjpce.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Checking orders constraints in database...");
  const { data, error } = await supabase.rpc('exec_sql', { sql: `
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'orders'::regclass;
  `}).catch(() => ({ data: null, error: { message: "No exec_sql" }}));

  if (data) {
    console.log(data);
  } else {
    console.log("Fallback to direct table inspection not possible via REST");
  }
}

main();
