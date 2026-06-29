import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gyozrlgyzjishmpwjpce.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3pybGd5emppc2htcHdqcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODYxODI2NCwiZXhwIjoyMDU0MTk0MjY0fQ.zFv488V3Z8FjFxg9mH4F1Xm26KxS7O706vOh3r_0Otw";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log("Fetching cycles grouped by month...");
  const { data: cycles, error } = await supabase
    .from("cycles")
    .select("id, cycle_number, status, opened_at, closed_at, user_id")
    .order("opened_at", { ascending: false });

  if (error) {
    console.error("Error fetching cycles:", error);
    return;
  }

  console.log(`Total cycles fetched: ${cycles.length}`);
  
  // Count by status
  const statusCounts = {};
  cycles.forEach(c => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });
  console.log("Status counts:", statusCounts);

  // Group by closed_at month
  const closedMonthCounts = {};
  cycles.forEach(c => {
    if (c.closed_at) {
      const month = c.closed_at.slice(0, 7); // YYYY-MM
      closedMonthCounts[month] = (closedMonthCounts[month] || 0) + 1;
    } else {
      closedMonthCounts["null"] = (closedMonthCounts["null"] || 0) + 1;
    }
  });
  console.log("Cycles by closed month:", closedMonthCounts);

  // Group by opened_at month
  const openedMonthCounts = {};
  cycles.forEach(c => {
    if (c.opened_at) {
      const month = c.opened_at.slice(0, 7); // YYYY-MM
      openedMonthCounts[month] = (openedMonthCounts[month] || 0) + 1;
    } else {
      openedMonthCounts["null"] = (openedMonthCounts["null"] || 0) + 1;
    }
  });
  console.log("Cycles by opened month:", openedMonthCounts);

  // Print first 5 cycles
  console.log("Most recent 5 cycles:", cycles.slice(0, 5));
}

main();
