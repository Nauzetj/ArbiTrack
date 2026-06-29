import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyozrlgyzjishmpwjpce.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3pybGd5emppc2htcHdqcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODYxODI2NCwiZXhwIjoyMDU0MTk0MjY0fQ.zFv488V3Z8FjFxg9mH4F1Xm26KxS7O706vOh3r_0Otw';
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  const { data: cycles, error } = await supabase
    .from('cycles')
    .select('*');

  if (error) {
    console.error('Error fetching cycles:', error);
    return;
  }

  const target = cycles.find(c => c.cycle_number.toString().slice(-4) === '6616');
  if (!target) {
    console.log('Cycle ending in 6616 not found.');
    console.log('Available cycles in DB:', cycles.map(c => ({ id: c.id, num: c.cycle_number, status: c.status })));
    return;
  }

  console.log('Target Cycle found:', JSON.stringify(target, null, 2));
}

main().catch(console.error);
