// Script para ejecutar el fix de recálculo de ciclos directamente en Supabase
// Usa el cliente JS en lugar de SQL puro para mayor compatibilidad
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Leer variables de entorno
const envContent = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) {
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val) envVars[key] = val;
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

// ─── Lógica exacta de recálculo ───────────────────────────────────────────────
// USDT_real = amount - commission  (neto real, no el bruto de Binance)
function recalculate(orders) {
  let usdt_vendido = 0, usdt_recomprado = 0;
  let ves_recibido = 0, ves_pagado = 0, comision_total = 0;

  for (const o of orders) {
    if (o.order_status?.toUpperCase() !== 'COMPLETED') continue;

    // Inferir tipo de operación si no está explícito
    const opType = o.operation_type ?? (o.trade_type === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT');
    const commission = Math.max(Number(o.commission) || 0, 0);
    // ✅ Monto neto real: amount - commission
    const amountNeto = Math.max(Number(o.amount) - commission, 0);
    const totalPrice = Number(o.total_price);

    if (opType === 'VENTA_USDT') {
      usdt_vendido += amountNeto;
      ves_recibido += totalPrice;
    }
    if (opType === 'COMPRA_USDT' || opType === 'RECOMPRA') {
      usdt_recomprado += amountNeto;
      ves_pagado      += totalPrice;
    }
    if (opType === 'SOBRANTE') {
      usdt_recomprado += amountNeto;
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
  const tasa_ref     = tasa_compra_prom > 0 ? tasa_compra_prom
                     : tasa_venta_prom  > 0 ? tasa_venta_prom : 1;
  const ganancia_usdt = matched_vol > 0 ? ganancia_ves / tasa_ref : 0;

  const capitalBase = usdt_vendido > 0
    ? usdt_vendido * tasa_venta_prom
    : ves_pagado;
  const roi_percent = capitalBase > 0 ? (ganancia_ves / capitalBase) * 100 : 0;

  return {
    usdt_vendido, usdt_recomprado, ves_recibido, ves_pagado, comision_total,
    tasa_venta_prom, tasa_compra_prom, diferencial_tasa,
    ganancia_ves, ganancia_usdt, roi_percent,
  };
}

async function run() {
  console.log('🔄 Iniciando recálculo de todos los ciclos...\n');

  // 1. Obtener todos los ciclos
  const { data: cycles, error: eCycles } = await supabase
    .from('cycles')
    .select('id, cycle_number, user_id, status')
    .order('opened_at', { ascending: true });

  if (eCycles || !cycles) {
    console.error('❌ Error obteniendo ciclos:', eCycles?.message);
    process.exit(1);
  }

  console.log(`📋 Total ciclos encontrados: ${cycles.length}\n`);

  let updated = 0, errors = 0;

  for (const cycle of cycles) {
    // 2. Obtener órdenes del ciclo
    const { data: orders, error: eOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('cycle_id', cycle.id)
      .eq('user_id', cycle.user_id);

    if (eOrders) {
      console.error(`  ❌ Ciclo #${cycle.cycle_number}: error leyendo órdenes - ${eOrders.message}`);
      errors++;
      continue;
    }

    const completedOrders = (orders || []).filter(o => o.order_status?.toUpperCase() === 'COMPLETED');
    if (completedOrders.length === 0 && cycle.status === 'En curso') {
      console.log(`  ⏭️  Ciclo #${cycle.cycle_number}: sin órdenes completadas (en curso), saltando.`);
      continue;
    }

    // 3. Calcular métricas
    const metrics = recalculate(orders || []);

    // 4. Actualizar ciclo en Supabase
    const { error: eUpdate } = await supabase
      .from('cycles')
      .update({
        usdt_vendido:     metrics.usdt_vendido,
        usdt_recomprado:  metrics.usdt_recomprado,
        ves_recibido:     metrics.ves_recibido,
        ves_pagado:       metrics.ves_pagado,
        comision_total:   metrics.comision_total,
        tasa_venta_prom:  metrics.tasa_venta_prom,
        tasa_compra_prom: metrics.tasa_compra_prom,
        diferencial_tasa: metrics.diferencial_tasa,
        ganancia_ves:     metrics.ganancia_ves,
        ganancia_usdt:    metrics.ganancia_usdt,
        roi_percent:      metrics.roi_percent,
      })
      .eq('id', cycle.id)
      .eq('user_id', cycle.user_id);

    if (eUpdate) {
      console.error(`  ❌ Ciclo #${cycle.cycle_number}: error actualizando - ${eUpdate.message}`);
      errors++;
    } else {
      const status = metrics.ganancia_usdt > 0 ? '✅' : metrics.ganancia_usdt < 0 ? '🔴' : '➖';
      console.log(
        `  ${status} Ciclo #${cycle.cycle_number} | ` +
        `Vendido: ${metrics.usdt_vendido.toFixed(4)} USDT | ` +
        `Recomprado: ${metrics.usdt_recomprado.toFixed(4)} USDT | ` +
        `Ganancia: ${metrics.ganancia_usdt.toFixed(4)} USDT | ` +
        `ROI: ${metrics.roi_percent.toFixed(2)}%`
      );
      updated++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Ciclos recalculados: ${updated}`);
  if (errors > 0) console.log(`❌ Ciclos con error:    ${errors}`);
  console.log(`${'='.repeat(60)}`);
}

run().catch(e => {
  console.error('Error fatal:', e);
  process.exit(1);
});
