-- ============================================================
-- DIAGNÓSTICO Y FIX COMPLETO
-- ============================================================

-- PASO 1: Ver todos los ciclos activos (con distintos posibles status)
SELECT id, cycle_number, status, opened_at, usdt_vendido, ves_recibido
FROM cycles
WHERE status IN ('Active', 'En curso', 'active', 'en curso', 'ACTIVE')
ORDER BY opened_at DESC
LIMIT 5;

-- ============================================================
-- PASO 2: Ver estado actual de las órdenes (con qué ciclo_id quedaron)
SELECT id, order_number, cycle_id, order_status, operation_type, amount, total_price
FROM orders
WHERE order_number IN ('22884093956911820800', '22884095394053517312');

-- ============================================================
-- PASO 3: Ver el ciclo al que quedaron asignadas
-- (reemplaza con el cycle_id que viste en los resultados anteriores)
-- SELECT id, cycle_number, status, usdt_vendido, ves_recibido, usdt_recomprado
-- FROM cycles
-- WHERE id = '<cycle_id_de_las_ordenes>';

-- ============================================================
-- PASO 4: Si el ciclo activo real tiene status 'En curso' diferente
-- al que se asignaron, reasignar las órdenes:

-- UPDATE orders
-- SET cycle_id = '<ID_DEL_CICLO_EN_CURSO>'
-- WHERE order_number IN ('22884093956911820800', '22884095394053517312');

-- ============================================================
-- PASO 5: Recalcular métricas del ciclo activo
-- (Llama al RPC recalculate_cycle_metrics con el cycle_id correcto)
-- SELECT recalculate_cycle_metrics('<ID_DEL_CICLO_EN_CURSO>', '<USER_ID>');
