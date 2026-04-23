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
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, cycle_id, created_at, updated_at, timestamp')
    .eq('cycle_id', targetId);
    
  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }
  
  console.log('Orders for cycle 0202:', orders.length);
  
  const todayOrders = orders.filter(o => new Date(o.created_at) > new Date('2026-04-23T00:00:00Z') || new Date(o.timestamp) > new Date('2026-04-23T00:00:00Z'));
  console.log('Orders placed today:', todayOrders.length);
  if (todayOrders.length > 0) {
    console.log('Sample today order:', todayOrders[0]);
  }
}
main();
