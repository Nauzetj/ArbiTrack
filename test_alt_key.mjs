#!/usr/bin/env node
// Intento con el anon key alternativo encontrado en test-insert.mjs

const SUPABASE_URL = 'https://gyozrlgyzjishmpwjpce.supabase.co';
const ANON_KEY = 'sb_publishable_-FdpQLX1dD3VVnZkXJ0lzQ_S2x5zVbW';
const ORDER_NUMBERS = ['22884093956911820800', '22884095394053517312'];

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log('🔍 Buscando ciclo activo (sin autenticación)...');

  const { data: cycles, error: cycErr } = await supabase
    .from('cycles')
    .select('id, cycle_number, status, opened_at')
    .eq('status', 'Active')
    .order('opened_at', { ascending: false })
    .limit(5);

  if (cycErr) {
    console.error('❌ Error leyendo ciclos:', cycErr.message, cycErr.code);
  } else {
    console.log('Ciclos activos:', cycles);
  }

  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('id, order_number, cycle_id, order_status, operation_type, amount')
    .in('order_number', ORDER_NUMBERS);

  if (ordErr) {
    console.error('❌ Error leyendo órdenes:', ordErr.message, ordErr.code);
  } else {
    console.log('Órdenes:', orders);
  }
}
main().catch(err => { console.error('Fatal:', err); process.exit(1); });
