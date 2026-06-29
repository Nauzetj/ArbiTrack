import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('cycles').select('*').order('opened_at', { ascending: false }).limit(5);
  console.log("Recent cycles:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
}
main();
