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
  const targetId = 'f05ef10a-88a0-4308-81ed-df91573d1c3e'; // Cycle 896450202
  const newClosedAt = '2026-04-22T23:59:59.999Z';
  
  const { data, error } = await supabase
    .from('cycles')
    .update({ closed_at: newClosedAt })
    .eq('id', targetId)
    .select();
    
  if (error) {
    console.error('Error updating cycle:', error);
    return;
  }
  
  console.log('Successfully updated cycle:', data);
}
main();
