-- ============================================================
-- SCRIPT: Asignar la orden específica al ciclo actual
-- Orden: 22886636424295526400
-- ============================================================

WITH active_cycle AS (
    SELECT id
    FROM cycles
    WHERE status IN ('En curso', 'Active', 'open')
    ORDER BY opened_at DESC
    LIMIT 1
)
UPDATE orders
SET cycle_id = (SELECT id FROM active_cycle)
WHERE order_number = '22886636424295526400'
RETURNING id, order_number, cycle_id, create_time_local;
