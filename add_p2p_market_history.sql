CREATE TABLE IF NOT EXISTS p2p_market_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  buy_price NUMERIC NOT NULL,
  sell_price NUMERIC NOT NULL,
  spread NUMERIC NOT NULL,
  volume NUMERIC NOT NULL DEFAULT 0
);

-- Index for fast time-series queries
CREATE INDEX IF NOT EXISTS idx_p2p_market_timestamp ON p2p_market_history(timestamp DESC);

-- RLS: Public can read, only admin can insert/update
ALTER TABLE p2p_market_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p2p_market_select_all" ON p2p_market_history FOR SELECT USING (true);
CREATE POLICY "p2p_market_insert_admin" ON p2p_market_history FOR INSERT WITH CHECK (public.is_admin());
