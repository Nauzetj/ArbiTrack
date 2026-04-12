export type TradeType = "SELL" | "BUY";

/** 5 tipos de operación del módulo unificado */
export type OperationType =
  | 'COMPRA_USDT'   // Compra de USDT en un exchange P2P
  | 'VENTA_USDT'    // Venta de USDT en un exchange P2P
  | 'RECOMPRA'      // Recompra de USDT en otro exchange P2P
  | 'COMPRA_USD'    // Compra de dólares físicos/bancarios
  | 'TRANSFERENCIA' // Paso por tarjeta u otro canal con comisión
  | 'SOBRANTE';     // Saldo residual en banco → ganancia directa en VES

/** Tipo de comisión */
export type CommissionType = 'fixed' | 'percent';

/** Modo de origen de la operación */
export type OriginMode = 'auto' | 'manual';

export type CycleStatus = "En curso" | "Completado" | "Con pérdida" | "Neutral";

export type UserRole = 'admin' | 'vip_annual' | 'vip_semiannual' | 'vip_monthly' | 'vip_promo' | 'free';

export interface User {
  id: string;           // uuid — Supabase Auth UID
  username: string;     // único, visible en app
  fullName: string;
  // CORRECCIÓN: se eliminó passwordHash. Supabase Auth gestiona credenciales;
  // nunca debemos almacenar ni transportar hashes de contraseña en el cliente.
  createdAt: string;    // ISO string
  role: UserRole;
  planExpiresAt: string | null; // null = nunca expira (admin/free)
}

export interface PromoCode {
  id: string;
  code: string;
  plan: 'vip_promo' | 'vip_monthly' | 'vip_semiannual' | 'vip_annual';
  createdAt: string; // ISO
  expiresAt: string;  // ISO (+15 days)
  usedAt: string | null;
  usedBy: string | null; // userId
}

export interface Config {
  userId: string;
  bcvAutoSync: boolean;
  theme: "dark"; 
  currency: "VES";
}

export interface Order {
  id: string; // Our internal UUID
  orderNumber: string; // Binance unique order number / referencia manual
  tradeType: TradeType;
  // ── Campos del módulo unificado (opcionales para retrocompatibilidad) ────
  operationType?: OperationType;    // Tipo semántico de la operación
  commissionType?: CommissionType;  // fixed | percent
  originMode?: OriginMode;          // auto = exchange | manual = usuario
  exchange?: string;                // Exchange / plataforma de la operación
  // ────────────────────────────────────────────────────────────────────────
  asset: string; // 'USDT'
  fiat: string; // 'VES'
  totalPrice: number; // total in VES (o USD para COMPRA_USD)
  unitPrice: number; // rate used
  amount: number; // amount in USDT or USD
  commission: number; // calculated commission
  commissionAsset: string; // 'USDT' | 'USD' | '%'
  counterPartNickName: string;
  orderStatus: string; // usually 'COMPLETED'
  createTime_utc: string; // ISO string UTC
  createTime_local: string; // ISO string locale
  cycleId: string | null; // null if unassigned
  importedAt: string; // ISO string
  userId: string;
  notas?: string; // Notas libres de la operación
}

export interface Cycle {
  id: string;
  cycleNumber: number;
  openedAt: string; // ISO
  closedAt: string | null; // ISO
  status: CycleStatus;
  /** 'p2p' = órdenes auto-sincronizadas desde Binance | 'manual' = registro manual multi-exchange */
  cycleType: 'p2p' | 'manual';
  usdt_vendido: number;
  usdt_recomprado: number;
  ves_recibido: number;
  ves_pagado: number;
  comision_total: number;
  ganancia_usdt: number;
  ganancia_ves: number; // calculated using BCV of closed date
  tasa_venta_prom: number;
  tasa_compra_prom: number;
  diferencial_tasa: number;
  roi_percent: number;
  tasa_bcv_dia: number; // rate at the moment of closing
  notas: string;
  userId: string;
}

export interface BCVRate {
  fecha: string; // YYYY-MM-DD
  tasa_bcv: number;
  fuente: "auto" | "manual";
}

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface PaymentRequest {
  id: string;
  name: string;
  contact: string;
  plan: string;
  duration: string;
  imageData: string; // base64
  status: PaymentStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  generatedCode: string | null;
}
