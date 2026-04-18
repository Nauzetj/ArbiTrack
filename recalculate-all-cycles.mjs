// Script v3: ganancia_neta_usdt = diferencial_tasas - comisiones_binance
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = {};
fs.readFileSync('.env', 'utf-8').split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function recalculate(orders) {
  let usdt_vendido = 0, usdt_recomprado = 0;
  let ves_recibido = 0, ves_pagado = 0, comision_total = 0;

  for (const o of orders) {
    if (o.order_status?.toUpperCase() !== 'COMPLETED') continue;
    const opType = o.operation_type ?? (o.trade_type === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT');
    const commission = Math.max(Number(o.commission) || 0, 0);
    const amount     = Number(o.amount);
    const totalPrice = Number(o.total_price);

    // Amount BRUTO para calcular tasas reales (el tipo de cambio negociado)
    if (opType === 'VENTA_USDT') {
      usdt_vendido  += amount;
      ves_recibido  += totalPrice;
    }
    if (opType === 'COMPRA_USDT' || opType === 'RECOMPRA') {
      usdt_recomprado += amount;
      ves_pagado      += totalPrice;
    }
    if (opType === 'SOBRANTE') {
      usdt_recomprado += amount;
      ves_pagado      += totalPrice;
    }
    if (opType === 'COMPRA_USD') {
      ves_pagado += totalPrice;
    }
    comision_total += commission;
  }

  const tasa_venta_prom  = usdt_vendido    > 0 ? ves_recibido / usdt_vendido    : 0;
  const tasa_compra_prom = usdt_recomprado > 0 ? ves_pagado   / usdt_recomprado : 0;
  const diferencial_tasa = (tasa_venta_prom > 0 && tasa_compra_prom > 0)
    ? tasa_venta_prom - tasa_compra_prom : 0;

  const matched_vol  = Math.min(usdt_vendido, usdt_recomprado);
  const ganancia_ves = matched_vol * diferencial_tasa;

  const tasa_ref = tasa_compra_prom > 0 ? tasa_compra_prom
                 : tasa_venta_prom  > 0 ? tasa_venta_prom : 1;

  // ✅ GANANCIA NETA = diferencial de tasas convertido a USDT - comisiones Binance
  const ganancia_usdt = matched_vol > 0
    ? (ganancia_ves / tasa_ref) - comision_total
    : -comision_total;

  const capitalBase = usdt_vendido > 0 ? usdt_vendido * tasa_venta_prom : ves_pagado;
  const roi_percent = capitalBase > 0
    ? ((ganancia_ves - comision_total * tasa_ref) / capitalBase) * 100
    : 0;

  return {
    usdt_vendido, usdt_recomprado, ves_recibido, ves_pagado, comision_total,
    tasa_venta_prom, tasa_compra_prom, diferencial_tasa,
    ganancia_ves, ganancia_usdt, roi_percent,
  };
}

async function run() {
  console.log('🔄 Recalculando todos los ciclos (ganancia neta = diferencial - comisiones)...\n');

  const { data: cycles, error: eCycles } = await supabase
    .from('cycles').select('id, cycle_number, user_id, status').order('opened_at', { ascending: true });

  if (eCycles || !cycles) { console.error('❌', eCycles?.message); process.exit(1); }
  console.log(`📋 Total ciclos: ${cycles.length}\n`);

  let updated = 0, errors = 0;
  let totalComisionesDia = 0, totalGananciaBrutaDia = 0, totalGananciaNeta = 0;

  for (const cycle of cycles) {
    const { data: orders, error: eOrders } = await supabase
      .from('orders').select('*').eq('cycle_id', cycle.id).eq('user_id', cycle.user_id);

    if (eOrders) { console.error(`  ❌ #${cycle.cycle_number}:`, eOrders.message); errors++; continue; }

    const m = recalculate(orders || []);

    const { error: eUpdate } = await supabase.from('cycles').update({
      usdt_vendido:     m.usdt_vendido,
      usdt_recomprado:  m.usdt_recomprado,
      ves_recibido:     m.ves_recibido,
      ves_pagado:       m.ves_pagado,
      comision_total:   m.comision_total,
      tasa_venta_prom:  m.tasa_venta_prom,
      tasa_compra_prom: m.tasa_compra_prom,
      diferencial_tasa: m.diferencial_tasa,
      ganancia_ves:     m.ganancia_ves,
      ganancia_usdt:    m.ganancia_usdt,
      roi_percent:      m.roi_percent,
    }).eq('id', cycle.id).eq('user_id', cycle.user_id);

    if (eUpdate) { console.error(`  ❌ #${cycle.cycle_number}:`, eUpdate.message); errors++; }
    else {
      const gBruta = m.ganancia_ves / (m.tasa_compra_prom || 1);
      totalGananciaBrutaDia += gBruta;
      totalComisionesDia    += m.comision_total;
      totalGananciaNeta     += m.ganancia_usdt;
      const ic = m.ganancia_usdt >= 0 ? '✅' : '🔴';
      console.log(
        `  ${ic} Ciclo #${cycle.cycle_number} | ` +
        `Bruta: ${gBruta.toFixed(4)} USDT | ` +
        `Comis: ${m.comision_total.toFixed(4)} USDT | ` +
        `NETA: ${m.ganancia_usdt.toFixed(4)} USDT | ` +
        `ROI: ${m.roi_percent.toFixed(2)}%`
      );
      updated++;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ Ciclos actualizados: ${updated}`);
  if (errors > 0) console.log(`❌ Errores: ${errors}`);
  console.log(`\n📊 SUMA TOTAL:`);
  console.log(`   Ganancia bruta:    ${totalGananciaBrutaDia.toFixed(4)} USDT`);
  console.log(`   Comisiones total:  ${totalComisionesDia.toFixed(4)} USDT`);
  console.log(`   GANANCIA NETA:     ${totalGananciaNeta.toFixed(4)} USDT`);
  console.log(`${'='.repeat(70)}`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
