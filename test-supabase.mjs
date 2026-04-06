import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gyozrlgyzjishmpwjpce.supabase.co",
  "sb_publishable_-FdpQLX1dD3VVnZkXJ0lzQ_S2x5zVbW"
);

async function testSupabase() {
  const dummyCycle = {
    id: "f87a32d1-2351-4048-bbff-69fb8bcbbb8b",
    cycle_number: Date.now(),
    opened_at: new Date().toISOString(),
    status: 'En curso',
    user_id: "00000000-0000-0000-0000-000000000000" // Might fail RLS or FK constraint, but schema cache error should fire first
  };

  console.log("Testing insert with cycle_number...");
  const { data, error } = await supabase.from('cycles').upsert(dummyCycle);
  if (error) {
    console.error("Error from Supabase:", error);
  } else {
    console.log("Success! Data:", data);
  }

  const dummyOldCycle = {
    id: "f87a32d1-2351-4048-bbff-69fb8bcbbb8c",
    cycleNumber: Date.now(),
    opened_at: new Date().toISOString(),
    status: 'En curso',
    user_id: "00000000-0000-0000-0000-000000000000"
  };

  console.log("\nTesting insert with cycleNumber...");
  const { data: d2, error: e2 } = await supabase.from('cycles').upsert(dummyOldCycle);
  if (e2) {
    console.error("Error from Supabase:", e2);
  } else {
    console.log("Success! Data:", d2);
  }
}

testSupabase();
