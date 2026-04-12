-- ============================================================
-- ArbiTrack P2P – Schema completo y seguro
-- Versión corregida por auditoría
-- ============================================================

-- ── 1. PERFILES ─────────────────────────────────────────────
-- CORRECCIÓN: tabla original solo tenía id/email/role/plan/created_at.
-- Faltaban: username, full_name, plan_expires_at (campos que el código lee).
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email           TEXT NOT NULL,
  username        TEXT NOT NULL DEFAULT '',
  full_name       TEXT NOT NULL DEFAULT '',
  role            TEXT NOT NULL DEFAULT 'free'
                    CHECK (role IN ('admin','vip_annual','vip_semiannual',
                                    'vip_monthly','vip_promo','free')),
  plan_expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. CÓDIGOS PROMOCIONALES ─────────────────────────────────
-- CORRECCIÓN: tabla original tenía duration_days INTEGER y used BOOLEAN,
-- pero el código lee expires_at, used_at y used_by (columns que no existían).
CREATE TABLE IF NOT EXISTS promo_codes (
  id         UUID PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
  plan       TEXT NOT NULL
               CHECK (plan IN ('vip_promo','vip_monthly','vip_semiannual','vip_annual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ DEFAULT NULL,
  used_by    UUID REFERENCES auth.users(id) DEFAULT NULL
);

-- ── 3. SOLICITUDES DE PAGO ───────────────────────────────────
-- CORRECCIÓN: generated_code era UUID → promo_codes(id), pero el código
-- lo trata como TEXT (el código alfanumérico del promo, no su UUID).
CREATE TABLE IF NOT EXISTS payment_requests (
  id             UUID PRIMARY KEY,
  name           TEXT NOT NULL,
  contact        TEXT NOT NULL,
  plan           TEXT NOT NULL,
  duration       TEXT NOT NULL,
  image_data     TEXT NOT NULL,          -- base64; migrar a Supabase Storage en v2
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ DEFAULT NULL,
  review_note    TEXT DEFAULT NULL,
  generated_code TEXT DEFAULT NULL       -- código alfanumérico generado al aprobar
);

-- ── 4. CICLOS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cycles (
  id               UUID PRIMARY KEY,
  cycle_number     BIGINT NOT NULL,
  opened_at        TIMESTAMPTZ NOT NULL,
  closed_at        TIMESTAMPTZ DEFAULT NULL,
  status           TEXT NOT NULL
                     CHECK (status IN ('En curso','Completado','Con pérdida','Neutral')),
  cycle_type       TEXT NOT NULL DEFAULT 'p2p'
                     CHECK (cycle_type IN ('p2p','manual')),
  usdt_vendido     NUMERIC DEFAULT 0,
  usdt_recomprado  NUMERIC DEFAULT 0,
  ves_recibido     NUMERIC DEFAULT 0,
  ves_pagado       NUMERIC DEFAULT 0,
  comision_total   NUMERIC DEFAULT 0,
  ganancia_usdt    NUMERIC DEFAULT 0,
  ganancia_ves     NUMERIC DEFAULT 0,
  tasa_venta_prom  NUMERIC DEFAULT 0,
  tasa_compra_prom NUMERIC DEFAULT 0,
  diferencial_tasa NUMERIC DEFAULT 0,
  roi_percent      NUMERIC DEFAULT 0,
  tasa_bcv_dia     NUMERIC DEFAULT 0,
  notas            TEXT DEFAULT '',
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- ── 5. ÓRDENES ──────────────────────────────────────────────
-- CORRECCIÓN CRÍTICA: la tabla original usaba columnas con comillas y camelCase
-- ("orderNumber", "tradeType", etc.) pero dbOperations.ts lee snake_case
-- (order_number, trade_type...). Esto causaba que TODOS los campos vinieran NULL.
CREATE TABLE IF NOT EXISTS orders (
  id                   UUID PRIMARY KEY,
  order_number         TEXT UNIQUE NOT NULL,
  trade_type           TEXT NOT NULL CHECK (trade_type IN ('SELL','BUY')),
  asset                TEXT NOT NULL,
  fiat                 TEXT NOT NULL,
  total_price          NUMERIC NOT NULL,
  unit_price           NUMERIC NOT NULL,
  amount               NUMERIC NOT NULL,
  commission           NUMERIC NOT NULL DEFAULT 0,
  commission_asset     TEXT NOT NULL,
  counterpart_nickname TEXT,
  order_status         TEXT NOT NULL,
  create_time_utc      TIMESTAMPTZ NOT NULL,
  create_time_local    TEXT NOT NULL,
  cycle_id             UUID REFERENCES cycles(id) ON DELETE SET NULL DEFAULT NULL,
  imported_at          TIMESTAMPTZ DEFAULT NOW(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- ── 6. TASAS BCV (historial) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS bcv_rates (
  fecha      DATE PRIMARY KEY,
  tasa_bcv   NUMERIC NOT NULL,
  fuente     TEXT NOT NULL DEFAULT 'auto' CHECK (fuente IN ('auto','manual'))
);

-- ── 7. TRIGGER: crear perfil al registrarse ──────────────────
-- CORRECCIÓN: trigger original ponía role='user' (no existe en el enum)
-- y plan='vip_annual' (todos los nuevos usuarios eran VIP gratis por default).
-- Correcto: role='free', plan_expires_at=NULL.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name, role, plan_expires_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'free',
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 8. ROW LEVEL SECURITY ────────────────────────────────────
-- CORRECCIÓN CRÍTICA: la tabla original deshabilitaba RLS en TODAS las tablas,
-- exponiendo los datos de todos los usuarios entre sí.

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bcv_rates       ENABLE ROW LEVEL SECURITY;

-- Helper: ¿es admin el usuario actual?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles: cada usuario ve/edita solo el suyo; admins ven todos
CREATE POLICY "profiles_select_own"   ON profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_own"   ON profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert_self"  ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- promo_codes: cualquier autenticado puede leer (para validar); solo admins insertan/borran
CREATE POLICY "promo_select_auth"  ON promo_codes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "promo_update_auth"  ON promo_codes FOR UPDATE USING (auth.role() = 'authenticated');  -- para marcar como usado
CREATE POLICY "promo_insert_admin" ON promo_codes FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "promo_delete_admin" ON promo_codes FOR DELETE USING (public.is_admin());

-- payment_requests: cualquiera puede crear; solo admins ven todas; creador ve la suya (sin user_id, se filtra por name+contact)
CREATE POLICY "pr_insert_any"      ON payment_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "pr_select_admin"    ON payment_requests FOR SELECT USING (public.is_admin());
CREATE POLICY "pr_update_admin"    ON payment_requests FOR UPDATE USING (public.is_admin());

-- cycles: solo el propietario o admin
CREATE POLICY "cycles_select_own"  ON cycles FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "cycles_insert_own"  ON cycles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "cycles_update_own"  ON cycles FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "cycles_delete_own"  ON cycles FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

-- orders: solo el propietario o admin
CREATE POLICY "orders_select_own"  ON orders FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "orders_insert_own"  ON orders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "orders_update_own"  ON orders FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "orders_delete_own"  ON orders FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

-- bcv_rates: lectura pública; escritura solo admin
CREATE POLICY "bcv_select_all"    ON bcv_rates FOR SELECT USING (true);
CREATE POLICY "bcv_upsert_admin"  ON bcv_rates FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "bcv_update_admin"  ON bcv_rates FOR UPDATE USING (public.is_admin());

-- ── 9. ÍNDICES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_user_id   ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_cycle_id  ON orders(cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycles_user_id   ON cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_cycles_status    ON cycles(status);

-- ── 10. ADMIN INICIAL ────────────────────────────────────────
-- NOTA: No hardcodeamos el email aquí. Ejecuta este UPDATE manualmente
-- en el Dashboard de Supabase tras confirmar el email del admin:
--
--   UPDATE profiles
--   SET role = 'admin'
--   WHERE email = 'TU_EMAIL_ADMIN@ejemplo.com';

-- ── 11. MIGRACIÓN: agregar cycle_type a bases existentes ─────────────────────
-- Si la tabla cycles ya existe sin la columna cycle_type, ejecuta este bloque:
--
--   ALTER TABLE cycles
--     ADD COLUMN IF NOT EXISTS cycle_type TEXT NOT NULL DEFAULT 'p2p'
--       CHECK (cycle_type IN ('p2p','manual'));
--
-- Si ya tienes registros anteriores, todos quedarán como 'p2p' (correcto).