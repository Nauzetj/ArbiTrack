-- ============================================================
-- EJECUTAR EN: Supabase Dashboard → SQL Editor → Run
-- PASO 1: Actualiza la función con ganancia NETA (diferencial - comisiones)
-- PASO 2: Recalcula TODOS los ciclos automáticamente
-- ============================================================

-- PASO 1: Función corregida
CREATE OR REPLACE FUNCTION recalculate_cycle_metrics(
  p_cycle_id UUID,
  p_user_id  UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usdt_vendido    NUMERIC := 0;
  v_usdt_recomprado NUMERIC := 0;
  v_ves_recibido    NUMERIC := 0;
  v_ves_pagado      NUMERIC := 0;
  v_comision_total  NUMERIC := 0;
  v_tasa_venta      NUMERIC := 0;
  v_tasa_compra     NUMERIC := 0;
  v_diferencial     NUMERIC := 0;
  v_ganancia_ves    NUMERIC := 0;
  v_ganancia_usdt   NUMERIC := 0;
  v_roi             NUMERIC := 0;
  v_tasa_ref        NUMERIC := 1;
  v_capital_base    NUMERIC := 0;
  v_matched_vol     NUMERIC := 0;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN operation_type = 'VENTA_USDT' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN operation_type IN ('COMPRA_USDT','RECOMPRA','SOBRANTE') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN operation_type IN ('VENTA_USDT','RECOMPRA') THEN total_price ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN operation_type IN ('COMPRA_USDT','COMPRA_USD','RECOMPRA','SOBRANTE') THEN total_price ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(commission, 0)), 0)
  INTO v_usdt_vendido, v_usdt_recomprado, v_ves_recibido, v_ves_pagado, v_comision_total
  FROM orders
  WHERE cycle_id = p_cycle_id AND user_id = p_user_id AND order_status = 'COMPLETED';

  IF v_usdt_vendido    > 0 THEN v_tasa_venta  := v_ves_recibido / v_usdt_vendido;    END IF;
  IF v_usdt_recomprado > 0 THEN v_tasa_compra := v_ves_pagado   / v_usdt_recomprado; END IF;
  IF v_tasa_venta > 0 AND v_tasa_compra > 0 THEN v_diferencial := v_tasa_venta - v_tasa_compra; END IF;

  v_tasa_ref    := CASE WHEN v_tasa_compra > 0 THEN v_tasa_compra WHEN v_tasa_venta > 0 THEN v_tasa_venta ELSE 1 END;
  v_matched_vol := LEAST(v_usdt_vendido, v_usdt_recomprado);
  v_ganancia_ves := v_matched_vol * v_diferencial;

  -- GANANCIA NETA = diferencial convertido a USDT - comisiones Binance
  v_ganancia_usdt := CASE
    WHEN v_tasa_ref > 0 THEN (v_ganancia_ves / v_tasa_ref) - v_comision_total
    ELSE -v_comision_total
  END;

  v_capital_base := CASE WHEN v_usdt_vendido > 0 THEN v_usdt_vendido * NULLIF(v_tasa_venta, 0) ELSE v_ves_pagado END;
  IF v_capital_base > 0 THEN
    v_roi := ((v_ganancia_ves - v_comision_total * v_tasa_ref) / v_capital_base) * 100;
  END IF;

  UPDATE cycles SET
    usdt_vendido = v_usdt_vendido, usdt_recomprado = v_usdt_recomprado,
    ves_recibido = v_ves_recibido, ves_pagado = v_ves_pagado,
    comision_total = v_comision_total,
    tasa_venta_prom = v_tasa_venta, tasa_compra_prom = v_tasa_compra,
    diferencial_tasa = v_diferencial,
    ganancia_ves = v_ganancia_ves, ganancia_usdt = v_ganancia_usdt, roi_percent = v_roi
  WHERE id = p_cycle_id AND user_id = p_user_id;
END;
$$;

-- PASO 2: Recalcular TODOS los ciclos existentes
DO $$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN SELECT id, user_id, cycle_number FROM cycles ORDER BY opened_at ASC
  LOOP
    PERFORM recalculate_cycle_metrics(r.id, r.user_id);
    n := n + 1;
    RAISE NOTICE 'Ciclo #% recalculado', r.cycle_number;
  END LOOP;
  RAISE NOTICE '✅ Total: % ciclos con ganancia NETA actualizada', n;
END;
$$;
