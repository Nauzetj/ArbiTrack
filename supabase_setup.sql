-- 1. Crear tabla de Perfiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  plan TEXT DEFAULT 'vip_annual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear tabla de Códigos Promocionales
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES auth.users(id)
);

-- 3. Crear tabla de Solicitudes de Pago
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  plan TEXT NOT NULL,
  duration TEXT NOT NULL,
  image_data TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_note TEXT,
  generated_code UUID REFERENCES promo_codes(id)
);

-- 4. Crear tabla de Ciclos
CREATE TABLE IF NOT EXISTS cycles (
  id UUID PRIMARY KEY,
  "cycleNumber" BIGINT NOT NULL,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL,
  usdt_vendido NUMERIC DEFAULT 0,
  usdt_recomprado NUMERIC DEFAULT 0,
  ves_recibido NUMERIC DEFAULT 0,
  ves_pagado NUMERIC DEFAULT 0,
  comision_total NUMERIC DEFAULT 0,
  ganancia_usdt NUMERIC DEFAULT 0,
  ganancia_ves NUMERIC DEFAULT 0,
  tasa_venta_prom NUMERIC DEFAULT 0,
  tasa_compra_prom NUMERIC DEFAULT 0,
  diferencial_tasa NUMERIC DEFAULT 0,
  roi_percent NUMERIC DEFAULT 0,
  tasa_bcv_dia NUMERIC DEFAULT 0,
  notas TEXT,
  user_id UUID REFERENCES auth.users(id) NOT NULL
);

-- 5. Crear tabla de Órdenes Financieras
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  "orderNumber" TEXT UNIQUE NOT NULL,
  "tradeType" TEXT NOT NULL,
  asset TEXT NOT NULL,
  fiat TEXT NOT NULL,
  "totalPrice" NUMERIC NOT NULL,
  "unitPrice" NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  commission NUMERIC NOT NULL,
  "commissionAsset" TEXT NOT NULL,
  "counterPartNickName" TEXT,
  "orderStatus" TEXT NOT NULL,
  create_time_utc TIMESTAMP WITH TIME ZONE NOT NULL,
  create_time_local TEXT NOT NULL,
  cycle_id UUID REFERENCES cycles(id),
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) NOT NULL
);

-- 6. Trigger automático
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, plan)
  VALUES (new.id, new.email, 'user', 'vip_annual');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop first in case it exists from a partial run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Desactivar temporalmente RLS
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE cycles DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- 7. Insertar el perfil retroactivo para henderrtj@gmail.com
INSERT INTO profiles (id, email, role, plan)
SELECT id, email, 'admin', 'vip_annual'
FROM auth.users
WHERE email = 'henderrtj@gmail.com'
ON CONFLICT (id) DO NOTHING;
