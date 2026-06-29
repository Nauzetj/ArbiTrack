-- ─────────────────────────────────────────────────────────────────────────────
-- month_snapshots: guarda el resumen mensual de ganancias por usuario
-- Se crea/actualiza automáticamente el primer día de cada mes a las 12 AM VE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.month_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_month      TEXT        NOT NULL,       -- "2026-06" formato
  month_start     TIMESTAMPTZ NOT NULL,       -- inicio del mes (4 AM UTC del día 1)
  month_end       TIMESTAMPTZ NOT NULL,       -- fin del mes (4 AM UTC del día 1 del mes sig.)
  
  -- Totales del mes
  total_cycles    INTEGER     NOT NULL DEFAULT 0,
  profit_usdt     NUMERIC(14,4) NOT NULL DEFAULT 0,
  profit_ves      NUMERIC(18,2) NOT NULL DEFAULT 0,
  volume_usdt     NUMERIC(14,4) NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Solo un snapshot por mes por usuario
  UNIQUE(user_id, year_month)
);

-- Índice para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_month_snapshots_user_id 
  ON public.month_snapshots(user_id, year_month DESC);

-- RLS: cada usuario solo ve sus propios snapshots
ALTER TABLE public.month_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own month snapshots"
  ON public.month_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own month snapshots"
  ON public.month_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own month snapshots"
  ON public.month_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_month_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_month_snapshots_updated_at
  BEFORE UPDATE ON public.month_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_month_snapshots_updated_at();
