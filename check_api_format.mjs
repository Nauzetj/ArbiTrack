import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
// fallback to .env if needed
const envFile = fs.readFileSync('.env', 'utf-8');

const getEnvVars = (content) => {
  const vars = {};
  content.split('\n').filter(Boolean).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/['"]/g, '');
      vars[key] = val;
    }
  });
  return vars;
}

const envVars = { ...getEnvVars(envFile), ...getEnvVars(env) };

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const { data, error } = await supabase
    .from('cycles')
    .select('id, cycle_number, opened_at, closed_at')
    .eq('id', 'e4cb638a-9b25-4f4d-85a0-3f3c8c1a423c')
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log("Cycle data fetched via API:", data);
  console.log("Type of closed_at:", typeof data.closed_at);
  console.log("Includes 'T'?:", data.closed_at ? data.closed_at.includes('T') : false);
}

main();
