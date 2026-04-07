import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://gyozrlgyzjishmpwjpce.supabase.co", "sb_publishable_-FdpQLX1dD3VVnZkXJ0lzQ_S2x5zVbW");
async function test() {
  const {data: c, error: ce} = await supabase.from("cycles").select("*").limit(2);
  console.log("Cycles error:", ce);
  console.log("Cycles data:", c);
  
  const {data: o, error: oe} = await supabase.from("orders").select("*").limit(2);
  console.log("Orders error:", oe);
  console.log("Orders data:", o);
}
test();
