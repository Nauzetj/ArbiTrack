-- ============================================================
-- SCRIPT: Asignar órdenes al ciclo activo actual
-- Órdenes: 22884093956911820800 y 22884095394053517312
-- ============================================================

-- PASO 1: Ver el ciclo activo actualmente
SELECT id, cycle_number, status, opened_at
FROM cycles
WHERE status = 'Active'
ORDER BY opened_at DESC
LIMIT 5;

-- ============================================================
-- PASO 2: Ver las órdenes que queremos asignar
SELECT id, order_number, cycle_id, order_status, operation_type, amount
FROM orders
WHERE order_number IN ('22884093956911820800', '22884095394053517312');

-- ============================================================
-- PASO 3 (EJECUTAR DESPUÉS DE CONFIRMAR EL ID DEL CICLO):
-- Reemplaza '<CYCLE_ID_AQUI>' con el UUID del ciclo activo
-- que obtuviste en el PASO 1.

-- UPDATE orders
-- SET cycle_id = '<CYCLE_ID_AQUI>'
-- WHERE order_number IN ('22884093956911820800', '22884095394053517312');

-- ============================================================
-- PASO 4: Verificar que el UPDATE fue exitoso
-- SELECT id, order_number, cycle_id, order_status, operation_type, amount
-- FROM orders
-- WHERE order_number IN ('22884093956911820800', '22884095394053517312');
