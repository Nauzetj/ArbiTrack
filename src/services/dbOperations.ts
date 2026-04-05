import { runQuery, execQuery } from '../db/database';
import type { User, Order, Cycle, PromoCode, PaymentRequest } from '../types';

export const getUserByUsername = (username: string): User | null => {
  const res = runQuery<User>(`SELECT * FROM users WHERE username = ?`, [username]);
  return res.length > 0 ? res[0] : null;
};

export const createUser = (user: User) => {
  execQuery(
    `INSERT INTO users (id, username, fullName, passwordHash, createdAt, role, planExpiresAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.username, user.fullName, user.passwordHash, user.createdAt, user.role, user.planExpiresAt]
  );
};

export const getAllUsers = (): User[] => {
  return runQuery<User>(`SELECT * FROM users ORDER BY createdAt ASC`);
};

export const updateUserRole = (userId: string, role: string, planExpiresAt: string | null) => {
  execQuery(`UPDATE users SET role = ?, planExpiresAt = ? WHERE id = ?`, [role, planExpiresAt, userId]);
};

// ─── Promo Codes ───────────────────────────────────────────────
export const createPromoCode = (code: PromoCode) => {
  execQuery(
    `INSERT INTO promo_codes (id, code, plan, createdAt, expiresAt, usedAt, usedBy) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [code.id, code.code, code.plan, code.createdAt, code.expiresAt, code.usedAt, code.usedBy]
  );
};

export const getAllPromoCodes = (): PromoCode[] => {
  return runQuery<PromoCode>(`SELECT * FROM promo_codes ORDER BY createdAt DESC`);
};

export const validatePromoCode = (codeStr: string): { valid: boolean; code?: PromoCode; error?: string } => {
  const rows = runQuery<PromoCode>(`SELECT * FROM promo_codes WHERE code = ? LIMIT 1`, [codeStr.trim().toUpperCase()]);
  if (rows.length === 0) return { valid: false, error: 'Código no encontrado.' };
  const code = rows[0];
  if (code.usedAt) return { valid: false, error: 'Este código ya fue utilizado.' };
  if (new Date(code.expiresAt) < new Date()) return { valid: false, error: 'Este código ha expirado.' };
  return { valid: true, code };
};

export const redeemPromoCode = (codeStr: string, userId: string): void => {
  const now = new Date().toISOString();
  execQuery(`UPDATE promo_codes SET usedAt = ?, usedBy = ? WHERE code = ?`, [now, userId, codeStr.trim().toUpperCase()]);
};

export const deletePromoCode = (codeId: string): void => {
  execQuery(`DELETE FROM promo_codes WHERE id = ?`, [codeId]);
};

export const getOrdersForUser = (userId: string): Order[] => {
  return runQuery<Order>(`SELECT * FROM orders WHERE userId = ? ORDER BY createTime_utc DESC`, [userId]);
};

export const saveOrder = (order: Order) => {
  execQuery(`
    INSERT OR REPLACE INTO orders (
      id, orderNumber, tradeType, asset, fiat, totalPrice, unitPrice, amount, 
      commission, commissionAsset, counterPartNickName, orderStatus, 
      createTime_utc, createTime_local, cycleId, importedAt, userId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    order.id, order.orderNumber, order.tradeType, order.asset, order.fiat, order.totalPrice,
    order.unitPrice, order.amount, order.commission, order.commissionAsset, order.counterPartNickName,
    order.orderStatus, order.createTime_utc, order.createTime_local, order.cycleId, order.importedAt, order.userId
  ]);
};

export const getCyclesForUser = (userId: string): Cycle[] => {
  return runQuery<Cycle>(`SELECT * FROM cycles WHERE userId = ? ORDER BY openedAt DESC`, [userId]);
};

export const saveCycle = (cycle: Cycle) => {
  execQuery(`
    INSERT OR REPLACE INTO cycles (
      id, cycleNumber, openedAt, closedAt, status, usdt_vendido, usdt_recomprado,
      ves_recibido, ves_pagado, comision_total, ganancia_usdt, ganancia_ves,
      tasa_venta_prom, tasa_compra_prom, diferencial_tasa, roi_percent, tasa_bcv_dia, notas, userId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    cycle.id, cycle.cycleNumber, cycle.openedAt, cycle.closedAt, cycle.status,
    cycle.usdt_vendido, cycle.usdt_recomprado, cycle.ves_recibido, cycle.ves_pagado,
    cycle.comision_total, cycle.ganancia_usdt, cycle.ganancia_ves,
    cycle.tasa_venta_prom, cycle.tasa_compra_prom, cycle.diferencial_tasa, cycle.roi_percent,
    cycle.tasa_bcv_dia, cycle.notas, cycle.userId
  ]);
};

export const getActiveCycleForUser = (userId: string): Cycle | null => {
  const res = runQuery<Cycle>(`SELECT * FROM cycles WHERE userId = ? AND status = 'En curso' LIMIT 1`, [userId]);
  return res.length > 0 ? res[0] : null;
};

export const recalculateCycleMetrics = (cycleId: string, userId: string): void => {
  const cycles = getCyclesForUser(userId);
  const cycle = cycles.find(c => c.id === cycleId);
  if (!cycle) return;

  const orders = runQuery<Order>(`SELECT * FROM orders WHERE cycleId = ? AND userId = ?`, [cycleId, userId]);

  let usdt_vendido = 0;
  let usdt_recomprado = 0;
  let ves_recibido = 0;
  let ves_pagado = 0;
  let comision_total = 0;

  orders.forEach(o => {
    // Solo contamos órdenes COMPLETADAS — las TRADING/PENDING aún no han
    // movido fondos reales en la cuenta bancaria, por lo tanto no afectan
    // la liquidez ni el USDT recomprado real.
    if (o.orderStatus !== 'COMPLETED') return;

    comision_total += o.commission;
    if (o.tradeType === 'SELL') {
      usdt_vendido += o.amount;
      ves_recibido += o.totalPrice;
    } else if (o.tradeType === 'BUY') {
      usdt_recomprado += o.amount;
      ves_pagado += o.totalPrice;
    }
  });

  const tasa_venta_prom = usdt_vendido > 0 ? ves_recibido / usdt_vendido : 0;
  const tasa_compra_prom = usdt_recomprado > 0 ? ves_pagado / usdt_recomprado : 0;
  const diferencial_tasa = tasa_venta_prom > 0 && tasa_compra_prom > 0 ? tasa_venta_prom - tasa_compra_prom : 0;

  const matchedVolume = Math.min(usdt_vendido, usdt_recomprado);
  const ganancia_ves_bruta = matchedVolume * diferencial_tasa;
  const ganancia_ves = ganancia_ves_bruta - (comision_total * tasa_compra_prom);
  const ganancia_usdt = tasa_compra_prom > 0 ? (ganancia_ves_bruta / tasa_compra_prom) - comision_total : -comision_total;

  cycle.usdt_vendido = usdt_vendido;
  cycle.usdt_recomprado = usdt_recomprado;
  cycle.ves_recibido = ves_recibido;
  cycle.ves_pagado = ves_pagado;
  cycle.comision_total = comision_total;
  cycle.tasa_venta_prom = tasa_venta_prom;
  cycle.tasa_compra_prom = tasa_compra_prom;
  cycle.diferencial_tasa = diferencial_tasa;
  cycle.ganancia_ves = ganancia_ves;
  cycle.ganancia_usdt = ganancia_usdt;

  saveCycle(cycle);
};

export const recalculateAllCyclesMetrics = (userId: string): void => {
  const cycles = getCyclesForUser(userId);
  cycles.forEach(c => {
    recalculateCycleMetrics(c.id, userId);
  });
};

// ─── Payment Requests ───────────────────────────────────────────
export const createPaymentRequest = (req: PaymentRequest): void => {
  execQuery(
    `INSERT INTO payment_requests (id, name, contact, plan, duration, imageData, status, createdAt, reviewedAt, reviewNote, generatedCode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.id, req.name, req.contact, req.plan, req.duration, req.imageData,
     req.status, req.createdAt, req.reviewedAt, req.reviewNote, req.generatedCode]
  );
};

export const getAllPaymentRequests = (): PaymentRequest[] => {
  return runQuery<PaymentRequest>(`SELECT * FROM payment_requests ORDER BY createdAt DESC`);
};

export const updatePaymentRequestStatus = (
  id: string,
  status: 'approved' | 'rejected',
  reviewNote: string | null,
  generatedCode: string | null
): void => {
  execQuery(
    `UPDATE payment_requests SET status = ?, reviewedAt = ?, reviewNote = ?, generatedCode = ? WHERE id = ?`,
    [status, new Date().toISOString(), reviewNote, generatedCode, id]
  );
};

