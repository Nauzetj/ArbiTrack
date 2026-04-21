import { supabase } from '../lib/supabase';
import type { User, Order, Cycle, PromoCode, PaymentRequest } from '../types';

// ─── Helper: map snake_case DB rows → camelCase types ──────────────────────

function mapProfile(row: any): User {
  return {
    id: row.id,
    username: row.username ?? row.email?.split('@')[0] ?? 'Usuario',
    fullName: row.full_name ?? '',
    // CORRECCIÓN: passwordHash eliminado del tipo User.
    // Supabase Auth gestiona credenciales; nunca las exponemos en el cliente.
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
    counterPartNickName: row.counterpart_nickname,
    orderStatus: row.order_status,
    createTime_utc: row.create_time_utc,
    createTime_local: row.create_time_local,
    cycleId: row.cycle_id ?? null,
    importedAt: row.imported_at,
    userId: row.user_id,
    // Campos del módulo unificado
    operationType: row.operation_type ?? undefined,
    commissionType: row.commission_type ?? undefined,
    originMode: row.origin_mode ?? undefined,
    exchange: row.exchange ?? undefined,
    notas: row.notas ?? undefined,
  };
}

function mapCycle(row: any): Cycle {
  return {
    id: row.id,
    cycleNumber: Number(row.cycle_number),
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? null,
    status: row.status,
    // Fallback a 'p2p' para ciclos existentes sin la columna
    cycleType: (row.cycle_type === 'manual' ? 'manual' : 'p2p') as 'p2p' | 'manual',
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
    .eq('code', codeStr.trim().toUpperCase())
    .is('used_at', null);  // CORRECCIÓN: solo redimir si aún no fue usado (evita race condition)
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
    counterpart_nickname: order.counterPartNickName,
    order_status: order.orderStatus,
    create_time_utc: order.createTime_utc,
    create_time_local: order.createTime_local,
    cycle_id: order.cycleId,
    imported_at: order.importedAt,
    user_id: order.userId,
    // Campos del módulo unificado
    operation_type: order.operationType ?? null,
    commission_type: order.commissionType ?? null,
    origin_mode: order.originMode ?? null,
    exchange: order.exchange ?? null,
    notas: order.notas ?? null,
  });
  if (error) throw error;
};

export const saveOrdersBulk = async (orders: Order[]) => {
  if (orders.length === 0) return;
  const payload = orders.map(order => ({
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
    counterpart_nickname: order.counterPartNickName,
    order_status: order.orderStatus,
    create_time_utc: order.createTime_utc,
    create_time_local: order.createTime_local,
    cycle_id: order.cycleId,
    imported_at: order.importedAt,
    user_id: order.userId,
    operation_type: order.operationType ?? null,
    commission_type: order.commissionType ?? null,
    origin_mode: order.originMode ?? null,
    exchange: order.exchange ?? null,
    notas: order.notas ?? null,
  }));
  const { error } = await supabase.from('orders').upsert(payload);
  if (error) throw error;
};

export const deleteOrder = async (orderId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('orders')
    .update({ order_status: 'DELETED', cycle_id: null })
    .eq('id', orderId)
    .eq('user_id', userId);
  if (error) throw error;
};


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
    .order('opened_at', { ascending: false })
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
    cycle_type: cycle.cycleType ?? 'p2p',
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

export const deleteCycle = async (cycleId: string, userId: string): Promise<void> => {
  const { error } = await supabase.from('cycles').delete().eq('id', cycleId).eq('user_id', userId);
  if (error) throw error;
};

export const recalculateCycleMetrics = async (cycleId: string, userId: string): Promise<void> => {
  // Intentaremos usar el Stored Procedure para máxima velocidad de sincronización.
  // Si el usuario aún no ha actualizado el SQL en Supabase y falla, usamos el fallback.
  const { error } = await supabase.rpc('recalculate_cycle_metrics', {
    p_cycle_id: cycleId,
    p_user_id:  userId,
  });
  
  if (error) {
    console.warn("RPC recalculate_cycle_metrics falló. Usando cálculo local (fallback):", error);
    await recalculateCycleMetrics_local(cycleId, userId);
  }
};

// ─── Fallback local: ganancia_neta = diferencial_tasas - comisiones ───────────
const recalculateCycleMetrics_local = async (cycleId: string, userId: string): Promise<void> => {
  const { data: cycleRows } = await supabase.from('cycles').select('*').eq('id', cycleId).eq('user_id', userId).limit(1);
  if (!cycleRows || cycleRows.length === 0) return;
  const cycle = mapCycle(cycleRows[0]);

  const { data: orderRows } = await supabase.from('orders').select('*').eq('cycle_id', cycleId).eq('user_id', userId);
  const orders = (orderRows ?? []).map(mapOrder);

  let usdt_vendido = 0, usdt_recomprado = 0, ves_recibido = 0, ves_pagado = 0, comision_total = 0;

  orders.forEach(o => {
    if (o.orderStatus?.toUpperCase() !== 'COMPLETED') return;
    const opType = o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT');
    const commission = Math.max(o.commission ?? 0, 0);

    // Usamos el AMOUNT BRUTO para calcular tasas reales (lo que se negoció en el exchange)
    // Las comisiones se restan después como costo explícito
    if (opType === 'VENTA_USDT') {
      usdt_vendido  += o.amount;
      ves_recibido  += o.totalPrice;
    }
    if (opType === 'COMPRA_USDT' || opType === 'RECOMPRA') {
      usdt_recomprado += o.amount;
      ves_pagado      += o.totalPrice;
    }
    if (opType === 'SOBRANTE') {
      usdt_recomprado += o.amount;
      ves_pagado      += o.totalPrice;
    }
    if (opType === 'COMPRA_USD') {
      ves_pagado += o.totalPrice;
    }
    comision_total += commission;
  });

  // Tasas promedio reales (basadas en amount bruto = el tipo de cambio real negociado)
  const tasa_venta_prom  = usdt_vendido    > 0 ? ves_recibido / usdt_vendido    : 0;
  const tasa_compra_prom = usdt_recomprado > 0 ? ves_pagado   / usdt_recomprado : 0;
  const diferencial_tasa = (tasa_venta_prom > 0 && tasa_compra_prom > 0)
    ? tasa_venta_prom - tasa_compra_prom : 0;

  // Volumen emparejado real
  const matched_vol  = Math.min(usdt_vendido, usdt_recomprado);

  // Ganancia VES bruta del diferencial de tasas
  const ganancia_ves = matched_vol * diferencial_tasa;

  // Tasa de referencia para convertir comisiones de USDT a VES y viceversa
  const tasa_ref = tasa_compra_prom > 0 ? tasa_compra_prom
                 : tasa_venta_prom  > 0 ? tasa_venta_prom : 1;

  // ✅ Ganancia USDT NETA = diferencial convertido a USDT - comisiones Binance
  // Esta es la ganancia real que le quedó al usuario
  const ganancia_usdt = matched_vol > 0
    ? (ganancia_ves / tasa_ref) - comision_total
    : -comision_total;

  // ROI neto sobre capital base
  const capitalBase = usdt_vendido > 0 ? usdt_vendido * tasa_venta_prom : ves_pagado;
  const roi_percent = capitalBase > 0
    ? ((ganancia_ves - comision_total * tasa_ref) / capitalBase) * 100
    : 0;

  await saveCycle({
    ...cycle,
    usdt_vendido, usdt_recomprado, ves_recibido, ves_pagado, comision_total,
    tasa_venta_prom, tasa_compra_prom, diferencial_tasa,
    ganancia_ves, ganancia_usdt, roi_percent,
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
