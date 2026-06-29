import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const envVars = {};
env.split('\n').filter(Boolean).forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"]/g, '');
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false }});
supabase.from('cycles').select('cycle_number, opened_at, closed_at, ganancia_usdt').order('opened_at', { ascending: false }).limit(5).then(res => {
  console.log("Últimos 5 ciclos:");
  console.log(res.data);
});
