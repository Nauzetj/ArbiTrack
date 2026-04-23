import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const envVars = {};
env.split('\n').filter(Boolean).forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/['"]/g, '');
    envVars[key] = val;
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function main() {
  const { data: activeCycles } = await supabase.from('cycles').select('id, cycle_number, opened_at, user_id').eq('status', 'En curso').order('opened_at', { ascending: false });
  console.log('Active Cycles:', activeCycles);

  if (activeCycles && activeCycles.length > 1) {
    // Group by user
    const byUser = {};
    activeCycles.forEach(c => {
      if (!byUser[c.user_id]) byUser[c.user_id] = [];
      byUser[c.user_id].push(c);
    });

    for (const userId in byUser) {
      const userCycles = byUser[userId];
      if (userCycles.length > 1) {
        console.log(`User ${userId} has ${userCycles.length} active cycles. Keeping the newest, closing the others.`);
        const newest = userCycles[0];
        const toClose = userCycles.slice(1);
        
        for (const c of toClose) {
          console.log(`Closing cycle ${c.cycle_number} (${c.id})...`);
          await supabase.from('cycles').update({ status: 'Eliminado', closed_at: new Date().toISOString() }).eq('id', c.id);
        }
      }
    }
  } else {
    console.log('No users with multiple active cycles found.');
  }

}
main();
