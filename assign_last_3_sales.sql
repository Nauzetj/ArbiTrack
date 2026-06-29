-- ============================================================
-- Asignar las últimas 3 ventas (sin ciclo) al ciclo activo
-- INSTRUCCIONES:
-- 1. Abre Supabase Studio → SQL Editor
-- 2. Pega este script y ejecútalo
-- ============================================================

DO $$
DECLARE
  v_cycle_id UUID;
  v_cycle_number INT;
  v_assigned_count INT;
BEGIN
  -- 1. Buscar el ciclo activo (status 'En curso')
  SELECT id, cycle_number INTO v_cycle_id, v_cycle_number
  FROM public.cycles
  WHERE status = 'En curso'
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RAISE EXCEPTION '❌ No se encontró ningún ciclo activo (En curso).';
  END IF;

  -- 2. Asignar las últimas 3 órdenes de venta (SELL) que no tienen ciclo
  WITH last_3_sales AS (
    SELECT id
    FROM public.orders
    WHERE trade_type = 'SELL' 
      AND cycle_id IS NULL
    ORDER BY create_time_utc DESC
    LIMIT 3
  )
  UPDATE public.orders
  SET cycle_id = v_cycle_id
  WHERE id IN (SELECT id FROM last_3_sales);

  GET DIAGNOSTICS v_assigned_count = ROW_COUNT;

  IF v_assigned_count > 0 THEN
    RAISE NOTICE '✅ Se asignaron % ventas al ciclo % (ID: %)', v_assigned_count, v_cycle_number, v_cycle_id;
    
    -- 3. Recalcular métricas
    BEGIN
      PERFORM recalculate_cycle_metrics(v_cycle_id);
      RAISE NOTICE '🔄 Métricas del ciclo recalculadas exitosamente.';
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE '⚠️ La función recalculate_cycle_metrics no existe, ignorando recálculo automático.';
    END;
  ELSE
    RAISE NOTICE '⚠️ No se encontraron ventas recientes sin ciclo para asignar.';
  END IF;

END $$;
