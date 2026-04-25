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
  const { error } = await supabase
    .from('cycles')
    .delete()
    .eq('id', 'fa4caaac-9e2b-4a58-b2d2-85cf6d51ae2e');

  if (error) {
    console.error('Error deleting empty cycle:', error);
  } else {
    console.log('Empty active cycle deleted successfully.');
  }
}
main();
