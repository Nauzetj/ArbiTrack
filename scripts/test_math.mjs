import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, val] = line.split('=');
  if (key && val) envVars[key.trim()] = val.trim();
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('orders').select('*').order('create_time_utc', { ascending: false }).limit(20);
  
  const localTodayStart = new Date();
  localTodayStart.setHours(0, 0, 0, 0);

  const utcTodayStart = new Date();
  utcTodayStart.setUTCHours(0, 0, 0, 0);

  let localSum = 0;
  let utcSum = 0;

  data.forEach(o => {
      if(o.trade_type === 'SELL' && o.order_status === 'COMPLETED') {
         const t = new Date(o.create_time_utc);
         if(t >= localTodayStart) localSum += Number(o.amount);
         if(t >= utcTodayStart) utcSum += Number(o.amount);
      }
  });

  console.log('localTodayStart', localTodayStart.toISOString());
  console.log('utcTodayStart', utcTodayStart.toISOString());
  console.log('Sum using Local Midnight:', localSum);
  console.log('Sum using UTC Midnight:', utcSum);
}

run();
