-- ============================================================
-- ArbiTrack – Migración: Módulo Unificado de Ciclos
-- Agrega las columnas nuevas a la tabla orders
-- para soportar los 5 tipos de operación y el modo híbrido
-- auto/manual.
--
-- INSTRUCCIONES:
--   1. Abre Supabase Studio → SQL Editor
--   2. Pega todo este script y presiona RUN
--   3. Los datos históricos NO se pierden (columnas opcionales)
-- ============================================================

-- ── 1. Tipo de operación semántico ───────────────────────────
-- VENTA_USDT | COMPRA_USDT | RECOMPRA | COMPRA_USD | TRANSFERENCIA
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT NULL
    CHECK (
      operation_type IS NULL OR
      operation_type IN (
        'VENTA_USDT',
        'COMPRA_USDT',
        'RECOMPRA',
        'COMPRA_USD',
        'TRANSFERENCIA'
      )
    );

-- ── 2. Tipo de comisión ──────────────────────────────────────
-- 'fixed' = monto fijo | 'percent' = porcentaje del monto
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT NULL
    CHECK (commission_type IS NULL OR commission_type IN ('fixed','percent'));

-- ── 3. Modo de origen ────────────────────────────────────────
-- 'auto' = datos del exchange | 'manual' = registro manual
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS origin_mode TEXT DEFAULT NULL
    CHECK (origin_mode IS NULL OR origin_mode IN ('auto','manual'));

-- ── 4. Exchange / Plataforma ─────────────────────────────────
-- Nombre del exchange donde se realizó la operación
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS exchange TEXT DEFAULT NULL;

-- ── 5. Notas libres por operación ───────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT NULL;

-- ── 6. Relajar el CHECK de trade_type ───────────────────────
-- El constraint original solo permitía 'SELL' y 'BUY'.
-- Las órdenes manuales nuevas siguen usando 'SELL'/'BUY' como
-- campo legado — la semántica real viene de operation_type.
-- Si el constraint da problema primero ejecúta esto:
--
--   ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_trade_type_check;
--   ALTER TABLE orders ADD CONSTRAINT orders_trade_type_check
--     CHECK (trade_type IN ('SELL','BUY'));
--
-- (Ya está correcto como está, no requiere acción si no hay error.)

-- ── 7. Índice para consultas por exchange ────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_exchange       ON orders(exchange)       WHERE exchange IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_operation_type ON orders(operation_type) WHERE operation_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_origin_mode    ON orders(origin_mode)    WHERE origin_mode IS NOT NULL;

-- ── 8. VERIFICACIÓN ─────────────────────────────────────────
-- Ejecuta esto para confirmar que las columnas existen:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN (
    'operation_type', 'commission_type',
    'origin_mode', 'exchange', 'notas'
  )
ORDER BY column_name;

-- Resultado esperado: 5 filas, una por columna nueva.
-- ============================================================
