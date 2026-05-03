-- 1. Obtenemos el ID del ciclo activo
DO $$
DECLARE
  v_cycle_id UUID;
  v_cycle_number INT;
BEGIN
  -- Buscar el ciclo activo (status 'En curso')
  SELECT id, cycle_number INTO v_cycle_id, v_cycle_number
  FROM public.cycles
  WHERE status = 'En curso'
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún ciclo activo (En curso).';
  END IF;

  -- 2. Asignar la orden a este ciclo
  UPDATE public.orders
  SET cycle_id = v_cycle_id
  WHERE order_number = '22884102536049475584';

  -- 3. Recalcular las métricas del ciclo para reflejar la orden
  PERFORM recalculate_cycle_metrics(v_cycle_id);

  RAISE NOTICE 'Orden 22884102536049475584 asignada al ciclo % (ID: %)', v_cycle_number, v_cycle_id;
END $$;
