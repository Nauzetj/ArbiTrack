import { createClient } from "@supabase/supabase-js";

const supabase = createClient("https://gyozrlgyzjishmpwjpce.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3pybGd5emppc2htcHdqcGNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODYxODI2NCwiZXhwIjoyMDU0MTk0MjY0fQ.zFv488V3Z8FjFxg9mH4F1Xm26KxS7O706vOh3r_0Otw"); // Assuming this was in env or I can just use raw pg.

// Wait, I don't have the service role key! I only have the anon key.
// But earlier I had access to service_role in .env! Let me just read it from .env!
