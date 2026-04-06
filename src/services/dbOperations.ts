import { supabase } from '../lib/supabase';
import type { User, Order, Cycle, PromoCode, PaymentRequest } from '../types';

// ─── Helper: map snake_case DB rows → camelCase types ──────────────────────

function mapProfile(row: any): User {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name ?? '',
    passwordHash: '', // not stored — Supabase Auth handles it
    createdAt: row.created_at,
    role: row.role ?? 'free',
    planExpiresAt: row.plan_expires_at ?? null,
  };
}

function mapOrder(row: any): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    tradeType: row.trade_type,
    asset: row.asset,
    fiat: row.fiat,
    totalPrice: Number(row.total_price),
    unitPrice: Number(row.unit_price),
    amount: Number(row.amount),
    commission: Number(row.commission),
    commissionAsset: row.commission_asset,
    counterPartNickName: row.counter_part_nick_name,
    orderStatus: row.order_status,
    createTime_utc: row.create_time_utc,
    createTime_local: row.create_time_local,
    cycleId: row.cycle_id ?? null,
    importedAt: row.imported_at,
    userId: row.user_id,
  };
}

function mapCycle(row: any): Cycle {
  return {
    id: row.id,
    cycleNumber: Number(row.cycle_number),
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? null,
    status: row.status,
    usdt_vendido: Number(row.usdt_vendido),
    usdt_recomprado: Number(row.usdt_recomprado),
    ves_recibido: Number(row.ves_recibido),
    ves_pagado: Number(row.ves_pagado),
    comision_total: Number(row.comision_total),
    ganancia_usdt: Number(row.ganancia_usdt),
    ganancia_ves: Number(row.ganancia_ves),
    tasa_venta_prom: Number(row.tasa_venta_prom),
    tasa_compra_prom: Number(row.tasa_compra_prom),
    diferencial_tasa: Number(row.diferencial_tasa),
    roi_percent: Number(row.roi_percent),
    tasa_bcv_dia: Number(row.tasa_bcv_dia),
    notas: row.notas ?? '',
    userId: row.user_id,
  };
}

function mapPromoCode(row: any): PromoCode {
  return {
    id: row.id,
    code: row.code,
    plan: row.plan,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at ?? null,
    usedBy: row.used_by ?? null,
  };
}

function mapPaymentRequest(row: any): PaymentRequest {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    plan: row.plan,
    duration: row.duration,
    imageData: row.image_data ?? '',
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? null,
    reviewNote: row.review_note ?? null,
    generatedCode: row.generated_code ?? null,
  };
}

// ─── USERS / PROFILES ───────────────────────────────────────────────────────

export const getUserProfile = async (userId: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return mapProfile(data);
};

export const updateUserProfile = async (userId: string, updates: Partial<{ username: string; full_name: string; role: string; plan_expires_at: string | null }>) => {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
};

export const getAllUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapProfile);
};

export const updateUserRole = async (userId: string, role: string, planExpiresAt: string | null) => {
  const { error } = await supabase
    .from('profiles')
    .update({ role, plan_expires_at: planExpiresAt })
    .eq('id', userId);
  if (error) throw error;
};

// ─── PROMO CODES ─────────────────────────────────────────────────────────────

export const createPromoCode = async (code: PromoCode) => {
  const { error } = await supabase.from('promo_codes').insert({
    id: code.id,
    code: code.code,
    plan: code.plan,
    created_at: code.createdAt,
    expires_at: code.expiresAt,
    used_at: code.usedAt,
    used_by: code.usedBy,
  });
  if (error) throw error;
};

export const getAllPromoCodes = async (): Promise<PromoCode[]> => {
  const { data, error } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPromoCode);
};

export const validatePromoCode = async (codeStr: string): Promise<{ valid: boolean; code?: PromoCode; error?: string }> => {
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', codeStr.trim().toUpperCase())
    .limit(1);
  if (error || !data || data.length === 0) return { valid: false, error: 'Código no encontrado.' };
  const code = mapPromoCode(data[0]);
  if (code.usedAt) return { valid: false, error: 'Este código ya fue utilizado.' };
  if (new Date(code.expiresAt) < new Date()) return { valid: false, error: 'Este código ha expirado.' };
  return { valid: true, code };
};

export const redeemPromoCode = async (codeStr: string, userId: string): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('promo_codes')
    .update({ used_at: now, used_by: userId })
    .eq('code', codeStr.trim().toUpperCase());
  if (error) throw error;
};

export const deletePromoCode = async (codeId: string): Promise<void> => {
  const { error } = await supabase.from('promo_codes').delete().eq('id', codeId);
  if (error) throw error;
};

// ─── ORDERS ──────────────────────────────────────────────────────────────────

export const getOrdersForUser = async (userId: string): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('create_time_utc', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapOrder);
};

export const saveOrder = async (order: Order) => {
  const { error } = await supabase.from('orders').upsert({
    id: order.id,
    order_number: order.orderNumber,
    trade_type: order.tradeType,
    asset: order.asset,
    fiat: order.fiat,
    total_price: order.totalPrice,
    unit_price: order.unitPrice,
    amount: order.amount,
    commission: order.commission,
    commission_asset: order.commissionAsset,
    counter_part_nick_name: order.counterPartNickName,
    order_status: order.orderStatus,
    create_time_utc: order.createTime_utc,
    create_time_local: order.createTime_local,
    cycle_id: order.cycleId,
    imported_at: order.importedAt,
    user_id: order.userId,
  });
  if (error) throw error;
};

// ─── CYCLES ──────────────────────────────────────────────────────────────────

export const getCyclesForUser = async (userId: string): Promise<Cycle[]> => {
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .eq('user_id', userId)
    .order('opened_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCycle);
};

export const getActiveCycleForUser = async (userId: string): Promise<Cycle | null> => {
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'En curso')
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return mapCycle(data[0]);
};

export const saveCycle = async (cycle: Cycle) => {
  const { error } = await supabase.from('cycles').upsert({
    id: cycle.id,
    cycle_number: cycle.cycleNumber,
    opened_at: cycle.openedAt,
    closed_at: cycle.closedAt,
    status: cycle.status,
    usdt_vendido: cycle.usdt_vendido,
    usdt_recomprado: cycle.usdt_recomprado,
    ves_recibido: cycle.ves_recibido,
    ves_pagado: cycle.ves_pagado,
    comision_total: cycle.comision_total,
    ganancia_usdt: cycle.ganancia_usdt,
    ganancia_ves: cycle.ganancia_ves,
    tasa_venta_prom: cycle.tasa_venta_prom,
    tasa_compra_prom: cycle.tasa_compra_prom,
    diferencial_tasa: cycle.diferencial_tasa,
    roi_percent: cycle.roi_percent,
    tasa_bcv_dia: cycle.tasa_bcv_dia,
    notas: cycle.notas,
    user_id: cycle.userId,
  });
  if (error) throw error;
};

export const recalculateCycleMetrics = async (cycleId: string, userId: string): Promise<void> => {
  // Get cycle
  const { data: cycleRows } = await supabase.from('cycles').select('*').eq('id', cycleId).eq('user_id', userId).limit(1);
  if (!cycleRows || cycleRows.length === 0) return;
  const cycle = mapCycle(cycleRows[0]);

  // Get orders for this cycle
  const { data: orderRows } = await supabase.from('orders').select('*').eq('cycle_id', cycleId).eq('user_id', userId);
  const orders = (orderRows ?? []).map(mapOrder);

  let usdt_vendido = 0, usdt_recomprado = 0, ves_recibido = 0, ves_pagado = 0, comision_total = 0;

  orders.forEach(o => {
    if (o.orderStatus !== 'COMPLETED') return;
    comision_total += o.commission;
    if (o.tradeType === 'SELL') { usdt_vendido += o.amount; ves_recibido += o.totalPrice; }
    else if (o.tradeType === 'BUY') { usdt_recomprado += o.amount; ves_pagado += o.totalPrice; }
  });

  const tasa_venta_prom = usdt_vendido > 0 ? ves_recibido / usdt_vendido : 0;
  const tasa_compra_prom = usdt_recomprado > 0 ? ves_pagado / usdt_recomprado : 0;
  const diferencial_tasa = tasa_venta_prom > 0 && tasa_compra_prom > 0 ? tasa_venta_prom - tasa_compra_prom : 0;
  const matchedVolume = Math.min(usdt_vendido, usdt_recomprado);
  const ganancia_ves_bruta = matchedVolume * diferencial_tasa;
  const ganancia_ves = ganancia_ves_bruta - (comision_total * tasa_compra_prom);
  const ganancia_usdt = tasa_compra_prom > 0 ? (ganancia_ves_bruta / tasa_compra_prom) - comision_total : -comision_total;

  await saveCycle({
    ...cycle,
    usdt_vendido, usdt_recomprado, ves_recibido, ves_pagado,
    comision_total, tasa_venta_prom, tasa_compra_prom,
    diferencial_tasa, ganancia_ves, ganancia_usdt,
  });
};

export const recalculateAllCyclesMetrics = async (userId: string): Promise<void> => {
  const cycles = await getCyclesForUser(userId);
  for (const c of cycles) {
    await recalculateCycleMetrics(c.id, userId);
  }
};

// ─── PAYMENT REQUESTS ────────────────────────────────────────────────────────

export const createPaymentRequest = async (req: PaymentRequest): Promise<void> => {
  const { error } = await supabase.from('payment_requests').insert({
    id: req.id,
    name: req.name,
    contact: req.contact,
    plan: req.plan,
    duration: req.duration,
    image_data: req.imageData,
    status: req.status,
    created_at: req.createdAt,
    reviewed_at: req.reviewedAt,
    review_note: req.reviewNote,
    generated_code: req.generatedCode,
  });
  if (error) throw error;
};

export const getAllPaymentRequests = async (): Promise<PaymentRequest[]> => {
  const { data, error } = await supabase.from('payment_requests').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPaymentRequest);
};

export const updatePaymentRequestStatus = async (
  id: string,
  status: 'approved' | 'rejected',
  reviewNote: string | null,
  generatedCode: string | null
): Promise<void> => {
  const { error } = await supabase.from('payment_requests').update({
    status,
    reviewed_at: new Date().toISOString(),
    review_note: reviewNote,
    generated_code: generatedCode,
  }).eq('id', id);
  if (error) throw error;
};
