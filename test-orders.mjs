import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://gyozrlgyzjishmpwjpce.supabase.co", "sb_publishable_-FdpQLX1dD3VVnZkXJ0lzQ_S2x5zVbW");
async function test() {
  const {data: o, error: oe} = await supabase.from("orders").select("*");
  console.log("Orders count:", o ? o.length : oe);
}
test();
