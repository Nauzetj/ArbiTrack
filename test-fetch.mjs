const SUPABASE_URL = 'https://gyozrlgyzjishmpwjpce.supabase.co';
const ANON_KEY = 'sb_publishable_-FdpQLX1dD3VVnZkXJ0lzQ_S2x5zVbW';

async function check() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?operation_type=eq.SOBRANTE`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`
    }
  });
  console.log(await res.json());
}
check();
