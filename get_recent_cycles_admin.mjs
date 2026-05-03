import { createClient } from '@supabase/supabase-js';

const supabase = createClient("https://gyozrlgyzjishmpwjpce.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3pybGd5emppc2htcHdqcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODYxODI2NCwiZXhwIjoyMDU0MTk0MjY0fQ.zFv488V3Z8FjFxg9mH4F1Xm26KxS7O706vOh3r_0Otw");

async function main() {
  const { data: cycles, error } = await supabase
    .from('cycles')
    .select('id, cycle_number, opened_at, closed_at')
    .order('opened_at', { ascending: false })
    .limit(10);
    
  if (error) console.error(error);
  else console.log('Recent 10 cycles:', cycles);
}
main();
