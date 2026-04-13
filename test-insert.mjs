const SUPABASE_URL = 'https://gyozrlgyzjishmpwjpce.supabase.co';
const ANON_KEY = 'sb_publishable_-FdpQLX1dD3VVnZkXJ0lzQ_S2x5zVbW';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});

async function run() {
  const { data: { session }, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'nauzetjcortez@yopmail.com', // I don't know the password, maybe I can just test with anonymous?
    password: '...'
  });
  
  // Wait, I can't insert into orders without RLS.
  // I need to use the token.
}
run();
