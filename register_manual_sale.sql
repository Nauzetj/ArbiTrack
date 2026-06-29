-- ============================================================
-- Registrar Venta Manual (2600 USDT a 691.999) en el ciclo activo
-- INSTRUCCIONES:
-- 1. Abre Supabase Studio → SQL Editor
-- 2. Pega este script y ejecútalo
-- ============================================================

DO $$
DECLARE
  v_cycle_id UUID;
  v_cycle_number INT;
  v_user_id UUID;
  v_order_id UUID := gen_random_uuid();
  v_order_number TEXT := 'MANUAL-VENTA-' || floor(extract(epoch from now()))::text;
  v_amount NUMERIC := 2600;
  v_rate NUMERIC := 691.999;
  v_total NUMERIC := v_amount * v_rate;
BEGIN
  -- 1. Buscar el ciclo activo (status 'En curso')
  SELECT id, cycle_number, user_id INTO v_cycle_id, v_cycle_number, v_user_id
  FROM public.cycles
  WHERE status = 'En curso'
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RAISE EXCEPTION '❌ No se encontró ningún ciclo activo (En curso).';
  END IF;

  -- 2. Insertar la orden manual de venta
  INSERT INTO public.orders (
    id, order_number, trade_type, operation_type, origin_mode, commission_type,
    asset, fiat, total_price, unit_price, amount, commission, commission_asset,
    order_status, create_time_utc, create_time_local, cycle_id, user_id, notas
  ) VALUES (
    v_order_id,
    v_order_number,
    'SELL',
    'VENTA_USDT',
    'manual',
    'fixed',
    'USDT',
    'VES',
    v_total,
    v_rate,
    v_amount,
    0, -- Comisión plata/plana 0 por defecto, ajústala si tiene otro valor
    'USDT',
    'COMPLETED',
    now(),
    now()::text,
    v_cycle_id,
    v_user_id,
    'Registro manual: Venta de 2600 USDT a tasa 691.999 (comisión plata/plana)'
  );

  RAISE NOTICE '✅ Venta insertada correctamente (Order Number: %) en el ciclo % (ID: %)', v_order_number, v_cycle_number, v_cycle_id;

  -- 3. Recalcular las métricas del ciclo para reflejar la orden (si la función existe)
  BEGIN
    PERFORM recalculate_cycle_metrics(v_cycle_id);
    RAISE NOTICE '🔄 Métricas del ciclo recalculadas exitosamente.';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE '⚠️ La función recalculate_cycle_metrics no existe en esta DB, ignorando recálculo automático.';
  END;

END $$;
