import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://gyozrlgyzjishmpwjpce.supabase.co", "sb_publishable_-FdpQLX1dD3VVnZkXJ0lzQ_S2x5zVbW");
async function test() {
  const {data: p, error: pe} = await supabase.from("profiles").select("*");
  console.log("Profiles:", p);
  
  const {data: c} = await supabase.from("cycles").select("user_id");
  console.log("Cycle user IDs:", c);
}
test();
