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
  const { data: records, error } = await supabase
    .from('orders')
    .select('*');
    
  if (error) {
    console.error('Error finding records:', error);
    return;
  }
  
  const found = records.filter(c => c.order_number?.toString().endsWith('0316') || c.id?.toString().endsWith('0316'));
  console.log('Found records:', JSON.stringify(found, null, 2));
}
main();
