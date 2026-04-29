-- ============================================================
-- ArbiTrack – FIX CRÍTICO DE SEGURIDAD: RLS en todas las tablas
-- Ejecuta esto en Supabase → SQL Editor → Run
-- Seguro de ejecutar múltiples veces (IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- ── 1. HABILITAR RLS en TODAS las tablas ────────────────────
-- (Si ya está habilitado, este comando no hace nada dañino)

ALTER TABLE IF EXISTS profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS promo_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cycles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bcv_rates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS p2p_market_history ENABLE ROW LEVEL SECURITY;

-- ── 2. HELPER: función is_admin ──────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 3. POLICIES: profiles ────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select_own') THEN
    CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_update_own') THEN
    CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_insert_self') THEN
    CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- ── 4. POLICIES: promo_codes ─────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_codes' AND policyname='promo_select_auth') THEN
    CREATE POLICY "promo_select_auth" ON promo_codes FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_codes' AND policyname='promo_update_auth') THEN
    CREATE POLICY "promo_update_auth" ON promo_codes FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_codes' AND policyname='promo_insert_admin') THEN
    CREATE POLICY "promo_insert_admin" ON promo_codes FOR INSERT WITH CHECK (public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_codes' AND policyname='promo_delete_admin') THEN
    CREATE POLICY "promo_delete_admin" ON promo_codes FOR DELETE USING (public.is_admin());
  END IF;
END $$;

-- ── 5. POLICIES: payment_requests ───────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_requests' AND policyname='pr_insert_any') THEN
    CREATE POLICY "pr_insert_any" ON payment_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_requests' AND policyname='pr_select_admin') THEN
    CREATE POLICY "pr_select_admin" ON payment_requests FOR SELECT USING (public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_requests' AND policyname='pr_update_admin') THEN
    CREATE POLICY "pr_update_admin" ON payment_requests FOR UPDATE USING (public.is_admin());
  END IF;
END $$;

-- ── 6. POLICIES: cycles ──────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cycles' AND policyname='cycles_select_own') THEN
    CREATE POLICY "cycles_select_own" ON cycles FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cycles' AND policyname='cycles_insert_own') THEN
    CREATE POLICY "cycles_insert_own" ON cycles FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cycles' AND policyname='cycles_update_own') THEN
    CREATE POLICY "cycles_update_own" ON cycles FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cycles' AND policyname='cycles_delete_own') THEN
    CREATE POLICY "cycles_delete_own" ON cycles FOR DELETE USING (user_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- ── 7. POLICIES: orders ──────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='orders_select_own') THEN
    CREATE POLICY "orders_select_own" ON orders FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='orders_insert_own') THEN
    CREATE POLICY "orders_insert_own" ON orders FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='orders_update_own') THEN
    CREATE POLICY "orders_update_own" ON orders FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='orders_delete_own') THEN
    CREATE POLICY "orders_delete_own" ON orders FOR DELETE USING (user_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- ── 8. POLICIES: bcv_rates ───────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bcv_rates' AND policyname='bcv_select_all') THEN
    CREATE POLICY "bcv_select_all" ON bcv_rates FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bcv_rates' AND policyname='bcv_upsert_admin') THEN
    CREATE POLICY "bcv_upsert_admin" ON bcv_rates FOR INSERT WITH CHECK (public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bcv_rates' AND policyname='bcv_update_admin') THEN
    CREATE POLICY "bcv_update_admin" ON bcv_rates FOR UPDATE USING (public.is_admin());
  END IF;
END $$;

-- ── 9. POLICIES: p2p_market_history ─────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='p2p_market_history' AND policyname='p2p_market_select_all') THEN
    CREATE POLICY "p2p_market_select_all" ON p2p_market_history FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='p2p_market_history' AND policyname='p2p_market_insert_admin') THEN
    CREATE POLICY "p2p_market_insert_admin" ON p2p_market_history FOR INSERT WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ── 10. VERIFICACIÓN FINAL ───────────────────────────────────
-- Ejecuta esto para confirmar que todas las tablas tienen RLS activo:
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Todas deben tener rls_enabled = true
