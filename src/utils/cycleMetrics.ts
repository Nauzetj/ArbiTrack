export function calculateCycleMetrics(
  usdt_vendido: number, ves_recibido: number,
  usdt_recomprado: number, ves_pagado: number,
  comision_total: number
) {
  const tasa_venta_prom = usdt_vendido > 0 ? ves_recibido / usdt_vendido : 0;
  const tasa_compra_prom = usdt_recomprado > 0 ? ves_pagado / usdt_recomprado : 0;
  const diferencial_tasa = tasa_venta_prom > 0 && tasa_compra_prom > 0
    ? tasa_venta_prom - tasa_compra_prom : 0;
  const matchedVolume = Math.min(usdt_vendido, usdt_recomprado);
  const ganancia_ves_bruta = matchedVolume * diferencial_tasa;
  const ganancia_ves = ganancia_ves_bruta - (comision_total * tasa_compra_prom);
  const ganancia_usdt = tasa_compra_prom > 0
    ? (ganancia_ves_bruta / tasa_compra_prom) - comision_total
    : -comision_total;
  const roi_percent = usdt_vendido > 0 ? (ganancia_usdt / usdt_vendido) * 100 : 0;
  return { tasa_venta_prom, tasa_compra_prom, diferencial_tasa,
           ganancia_ves, ganancia_usdt, roi_percent };
}
