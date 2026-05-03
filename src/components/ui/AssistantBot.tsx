import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Bot, X, Send, ChevronDown, Sparkles, Zap, FilePen, HelpCircle } from 'lucide-react';
import type { OperationType } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'bot';
  text: string;
  action?: FormFillAction; // optional action card
  ts: number;
}

interface FormFillAction {
  type: 'fill_form';
  label: string;
  fields: Partial<{
    opType: OperationType;
    mode: 'auto' | 'manual';
    exchange: string;
    rate: string;
    amount: string;
    counterpart: string;
    commission: string;
    commissionType: 'fixed' | 'percent';
    notas: string;
  }>;
}

type StoreCtx = {
  cycles: ReturnType<typeof useAppStore.getState>['cycles'];
  orders: ReturnType<typeof useAppStore.getState>['orders'];
  activeCycle: ReturnType<typeof useAppStore.getState>['activeCycle'];
  bcvRate: ReturnType<typeof useAppStore.getState>['bcvRate'];
  currentUser: ReturnType<typeof useAppStore.getState>['currentUser'];
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtN(n: number, decimals = 2) {
  return (n >= 0 ? '+' : '') + n.toFixed(decimals);
}
function fmtAbs(n: number, decimals = 2) {
  return n.toFixed(decimals);
}
function localDate(iso: string) {
  return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
}

// ── Sistema de conocimiento del módulo unificado ──────────────────────────────
const SYSTEM_KNOWLEDGE = `
ARBI es el asistente de ArbiTrack, un sistema P2P de trading de USDT en Venezuela.

TIPOS DE OPERACIÓN (5):
• VENTA_USDT — Vender USDT en un exchange P2P (ingresas Bs, recibes USDT del comprador)
• COMPRA_USDT — Comprar USDT en un exchange P2P
• RECOMPRA — Recomprar USDT en otro exchange P2P (para cerrar el diferencial de tasa)
• COMPRA_USD — Comprar dólares físicos o bancarios directamente
• TRANSFERENCIA — Paso por tarjeta u otro canal con comisión (solo fee, no volumen)

CICLOS:
• Un ciclo agrupa todas las operaciones de una ronda de trading
• Abre con la primera operación y cierra cuando el usuario decide
• Puede mezclar cualquier tipo de operación en cualquier combinación
• GANANCIA NETA = Total recuperado (VENTA_USDT + RECOMPRA) - Total invertido (COMPRA_USDT + COMPRA_USD) - Todas las comisiones

MODOS DE REGISTRO:
• AUTOMÁTICO — Datos pre-cargados del exchange (badge azul [Exchange])
• MANUAL — Usuario ingresa a mano; N° operación y fecha se asignan automáticamente (badge gris [Manual])
• En ambos modos, TODOS los campos son siempre editables

COMISIONES:
• Tipo FIJA — monto fijo en USDT (ej: 0.5 USDT)
• Tipo PORCENTUAL — % del monto operado (ej: 0.25% = nivel normal Binance)
• Niveles Binance: Normal 0.25%, Bronce 0.20%, Plata 0.175%, Oro 0.125%, Promo 0%

VENTA RÁPIDA DE EMERGENCIA:
• Botón amarillo "Venta rápida" en el panel del ciclo activo
• Modal compacto para registrar una operación urgente
• Se puede completar o editar después con todos los detalles

PARA LLENAR EL FORMULARIO:
• Di "llena el formulario con:" o "registra una venta de X USDT a tasa Y en Z exchange"
• ARBI pre-llenará los campos automáticamente
• Solo tienes que revisar y presionar Registrar
`;

// ── Intent Engine ────────────────────────────────────────────────────────────
function buildResponse(input: string, ctx: StoreCtx): { text: string; action?: FormFillAction } {
  const q = input.toLowerCase().trim();
  const { cycles, orders, activeCycle, bcvRate, currentUser } = ctx;

  const completed  = cycles.filter(c => c.status === 'Completado');
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const weekStart  = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
  const doneOrders = orders.filter(o => o.orderStatus?.toUpperCase() === 'COMPLETED');
  const unassigned = orders.filter(o => !o.cycleId && o.orderStatus?.toUpperCase() !== 'DELETED');
  const fmtVes = (n: number) => 'Bs. ' + n.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct = (a: number, b: number) => b > 0 ? ((a/b)*100).toFixed(1)+'%' : '—';

  // ── 0. Llenar formulario ────────────────────────────────────────────────────
  const fillMatch = q.match(/(?:llena|rellena|registra|anota|agrega)\s+(?:el\s+formulario\s+con\s*:?\s*)?(?:una?\s+)?(venta|compra|recompra|transferencia)(?:\s+de)?\s*([\d.,]+)?\s*(?:usdt|usd|usdt)?\s*(?:a\s+(?:tasa\s+)?)?([\d.,]+)?\s*(?:en\s+(.+))?/i);

  if (fillMatch || /llena|rellena|formulario con|pre.?llena|autocompleta/.test(q)) {
    // Detectar tipo de operación
    let opType: OperationType = 'VENTA_USDT';
    if (/recompra/.test(q)) opType = 'RECOMPRA';
    else if (/compra usdt|comprar usdt/.test(q)) opType = 'COMPRA_USDT';
    else if (/compra usd|comprar usd|dolar/.test(q)) opType = 'COMPRA_USD';
    else if (/transferencia|transfer/.test(q)) opType = 'TRANSFERENCIA';
    else if (/venta|vender|sell/.test(q)) opType = 'VENTA_USDT';

    // Extraer cantidad
    const amountMatch = q.match(/\b([\d]+(?:[.,][\d]+)?)\s*(?:usdt|usd)?\b/);
    const amount = amountMatch ? amountMatch[1].replace(',', '.') : '';

    // Extraer tasa
    const rateMatch = q.match(/(?:tasa|precio|rate|a)\s+([\d]+(?:[.,][\d]+)?)/i);
    const rate = rateMatch ? rateMatch[1].replace(',', '.') : '';

    // Extraer exchange
    const exchangeMatch = q.match(/(?:en|exchange|plataforma)\s+([a-z0-9]+(?:\s+[a-z0-9]+)?)/i);
    const exchange = exchangeMatch ? exchangeMatch[1].trim() : '';

    const labels: Record<OperationType, string> = {
      VENTA_USDT: 'Venta USDT',
      COMPRA_USDT: 'Compra USDT',
      RECOMPRA: 'Recompra',
      COMPRA_USD: 'Compra USD',
      TRANSFERENCIA: 'Transferencia',
      SOBRANTE: 'Sobrante',
    };

    return {
      text: `✏️ **Llenando formulario: ${labels[opType]}**\n\n${amount ? `• Cantidad: ${amount} USDT\n` : ''}${rate ? `• Tasa: ${rate} Bs\n` : ''}${exchange ? `• Exchange: ${exchange}\n` : ''}\nHaz clic en **"Aplicar al formulario"** para pre-llenar los campos. Luego revisa y registra.`,
      action: {
        type: 'fill_form',
        label: `Aplicar: ${labels[opType]}${amount ? ` · ${amount}` : ''}${rate ? ` @ ${rate}` : ''}`,
        fields: {
          opType,
          mode: 'manual',
          ...(amount && { amount }),
          ...(rate && { rate }),
          ...(exchange && { exchange }),
        },
      },
    };
  }

  // ── 1. Preguntas sobre el sistema ──────────────────────────────────────────
  if (/cómo funciona|como funciona|qué es|que es|para qué|para que|sistema|manual|automático|automatico/.test(q) && !/orden|ciclo específico/.test(q)) {
    if (/modo|automático|automatico|manual/.test(q)) {
      return { text: `🔄 **Modos de registro:**\n\n**Automático** → Los campos llegan pre-cargados del exchange. Badge azul [Exchange]. Todos editables.\n\n**Manual** → Tú ingresas todos los datos. N° operación y fecha/hora se asignan solos. Badge gris [Manual].\n\n💡 Cambiar de modo NO borra los datos ya ingresados, solo cambia el badge de origen.` };
    }
    if (/tipo|operación|compra|venta|recompra|transferencia/.test(q)) {
      return { text: `📋 **Tipos de operación disponibles:**\n\n🔴 **VENTA_USDT** — Vendes USDT en exchange P2P\n🟢 **COMPRA_USDT** — Compras USDT en exchange P2P\n🔵 **RECOMPRA** — Recompras USDT en otro exchange\n🟡 **COMPRA_USD** — Compras dólares físicos/bancarios\n🟣 **TRANSFERENCIA** — Canal con comisión (tarjeta/banco)\n\nPuedes mezclar cualquier combinación en un mismo ciclo.` };
    }
    if (/comisión|comision|fee|nivel/.test(q)) {
      return { text: `💰 **Tipos de comisión:**\n\n**Fija** — Monto USDT fijo (ej: 0.50 USDT)\n**Porcentual** — % del monto operado\n\n**Niveles Binance P2P:**\n• Normal: 0.25%\n• 🛡 Bronce: 0.20%\n• ⚔ Plata: 0.175%\n• 👑 Oro: 0.125%\n• 🎉 Promo: 0%\n\nEl sistema calcula la comisión en tiempo real y el resultado es editable.` };
    }
    if (/ganancia|calcul|formula/.test(q)) {
      return { text: `📐 **Fórmula de ganancia:**\n\n**Total invertido** = COMPRA_USDT + COMPRA_USD\n**Total recuperado** = VENTA_USDT + RECOMPRA\n**Total comisiones** = Σ comisiones de todas las ops\n\n**Ganancia neta = Recuperado − Invertido − Comisiones**\n\nSe calcula en tiempo real con cada operación que agregas.` };
    }
    if (/ciclo|abrir|cerrar/.test(q)) {
      return { text: `🔄 **¿Cómo funciona un ciclo?**\n\n1. Abre un ciclo nuevo desde el Dashboard\n2. Registra operaciones (usando el formulario inline o Venta Rápida)\n3. Las métricas se actualizan en tiempo real\n4. Cuando termines, presiona "Cerrar ciclo"\n5. Se genera el resumen financiero completo\n6. Puedes reabrir el ciclo si necesitas corregir algo\n\n💡 Un ciclo puede tener cualquier combinación de los 5 tipos de operación.` };
    }
    if (/venta rápida|emergencia|rapida/.test(q)) {
      return { text: `⚡ **Venta Rápida de Emergencia**\n\nBotón amarillo "Venta rápida" en el panel del ciclo activo.\n\nÚsalo cuando necesites registrar una operación urgentemente sin pasar por el formulario completo. Puedes editarla después con todos los detalles.\n\n💡 También puedes decirme "registra una venta de 200 USDT a tasa 38.50 en Binance" y yo pre-lleno el formulario por ti.` };
    }
    return { text: `ℹ️ **¿Cómo funciona ArbiTrack?**\n\nArbiTrack registra tus operaciones de trading P2P en Venezuela.\n\n**Pregúntame sobre:**\n• "¿Cómo funciona el modo automático?"\n• "¿Qué tipos de operación existen?"\n• "¿Cómo se calculan las ganancias?"\n• "¿Cómo funciona un ciclo?"\n• "¿Cómo funciona la venta rápida?"\n• "¿Cuáles son los niveles de comisión?"\n\nO pídeme que llene el formulario: "Registra una venta de 200 USDT a tasa 38.50 en Binance"` };
  }

  // ── 2. BCV rate ────────────────────────────────────────────────────────────
  if (/bcv|tasa|cambio|dolar|bolívar|bolivar/.test(q) && !/orden|ciclo|transac/.test(q)) {
    if (!bcvRate) return { text: '💱 Tasa BCV aún no sincronizada. Espera unos segundos.' };
    return { text: `💱 **Tasa BCV actual:** ${fmtAbs(bcvRate.tasa_bcv)} Bs/USD` };
  }

  // ── 3. Buscar orden por número ────────────────────────────────────────────
  const orderNumMatch = input.match(/(?:orden|order|#)\s*([A-Z0-9]{8,})/i)
    || input.match(/\b([0-9]{10,})\b/);
  if (orderNumMatch) {
    const term = orderNumMatch[1].toUpperCase();
    const found = orders.find(o => o.orderNumber?.toUpperCase().includes(term));
    if (!found) return { text: `🔍 No encontré ninguna orden con **"${term}"**.` };
    const cycle = found.cycleId ? cycles.find(c => c.id === found.cycleId) : null;
    const opType = found.operationType ?? (found.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT');
    return { text: `📋 **Orden ${found.orderNumber}**\n• Tipo: ${opType}\n• Monto: ${fmtAbs(found.amount, 4)} USDT\n• Total: ${fmtAbs(found.totalPrice, 2)} Bs\n• Tasa: ${fmtAbs(found.unitPrice, 4)} Bs/USDT\n• Exchange: ${found.exchange || '—'}\n• Contraparte: ${found.counterPartNickName || '—'}\n• Comisión: ${fmtAbs(found.commission, 4)}\n• Origen: ${found.originMode === 'auto' ? '[Exchange]' : '[Manual]'}\n• Fecha: ${localDate(found.createTime_utc)}\n• Ciclo: ${cycle ? '#' + cycle.cycleNumber.toString().slice(-4) : 'Sin asignar'}` };
  }

  // ── 4. Buscar por contraparte ─────────────────────────────────────────────
  const contraMatch = q.match(/(?:contraparte|usuario|nick|trader)\s+(.{3,})/);
  if (contraMatch || /busca|buscar|busco/.test(q)) {
    const nameTerm = contraMatch?.[1] || q.replace(/busca[r]?\s+/i, '').trim();
    if (nameTerm.length >= 3) {
      const hits = orders.filter(o => o.counterPartNickName?.toLowerCase().includes(nameTerm)).slice(0, 5);
      if (hits.length === 0) return { text: `🔍 Sin órdenes de **"${nameTerm}"**.` };
      const lines = hits.map(o => `• ${o.tradeType === 'BUY' ? '🟢' : '🔴'} ${o.orderNumber} — ${fmtAbs(o.amount, 2)} USDT — ${localDate(o.createTime_utc)}`);
      return { text: `🔍 **${hits.length} orden(es) de "${nameTerm}":**\n${lines.join('\n')}` };
    }
  }

  // ── 5. Órdenes de hoy ────────────────────────────────────────────────────
  if (/órdenes de hoy|ordenes de hoy|transacciones de hoy/.test(q)) {
    const todays = orders.filter(o => new Date(o.createTime_utc) >= todayStart);
    if (todays.length === 0) return { text: '📅 No hay órdenes registradas hoy todavía.' };
    const ventas = todays.filter(o => (o.operationType ?? o.tradeType) === 'VENTA_USDT' || o.tradeType === 'SELL');
    const compras = todays.filter(o => (o.operationType ?? o.tradeType) === 'COMPRA_USDT' || o.tradeType === 'BUY');
    return { text: `📅 **Órdenes de hoy (${todays.length}):**\n• 🔴 Ventas: ${ventas.length}\n• 🟢 Compras: ${compras.length}` };
  }

  // ── 6. Ciclo activo ───────────────────────────────────────────────────────
  if (/ciclo activo|en curso|abierto|ciclo actual/.test(q)) {
    if (!activeCycle) return { text: '📭 No hay ningún ciclo activo. Puedes abrir uno desde el Dashboard.' };
    const cycleOrders = orders.filter(o => o.cycleId === activeCycle.id);
    let totalInv = 0, totalRec = 0, totalComm = 0;
    cycleOrders.filter(o => o.orderStatus?.toUpperCase() === 'COMPLETED').forEach(o => {
      const t = o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT');
      totalComm += o.commission ?? 0;
      if (['COMPRA_USDT','COMPRA_USD'].includes(t)) totalInv += o.totalPrice;
      if (['VENTA_USDT','RECOMPRA'].includes(t)) totalRec += o.totalPrice;
    });
    const ganancia = totalRec - totalInv - totalComm;
    return { text: `🔄 **Ciclo #${activeCycle.cycleNumber.toString().slice(-4)} en curso**\n• Operaciones: ${cycleOrders.length}\n• Invertido: Bs. ${fmtAbs(totalInv)}\n• Recuperado: Bs. ${fmtAbs(totalRec)}\n• Comisiones: ${fmtAbs(totalComm, 4)}\n• Ganancia neta: Bs. ${fmtN(ganancia)}\n• Modo: ${activeCycle.cycleType === 'manual' ? 'Multi-Exchange' : 'P2P Auto'}\n• Abierto: ${localDate(activeCycle.openedAt)}` };
  }

  // ── 7. Ganancia total ────────────────────────────────────────────────────
  if (/ganancia total|utilidad total|cuánto gané|cuanto gane|profit total/.test(q)) {
    const total    = completed.reduce((s, c) => s + c.ganancia_usdt, 0);
    const totalVes = completed.reduce((s, c) => s + c.ganancia_ves, 0);
    return { text: `💰 **Ganancia acumulada (${completed.length} ciclos):**\n• ${fmtN(total, 4)} USDT\n• Bs. ${fmtN(totalVes, 2)}` };
  }

  // ── 8. Ganancia del mes ──────────────────────────────────────────────────
  if (/mes|mensual|este mes/.test(q) && !/bcv|tasa/.test(q)) {
    const monthCycles = completed.filter(c => c.closedAt && new Date(c.closedAt) >= monthStart);
    const gainMonth = monthCycles.reduce((s, c) => s + c.ganancia_usdt, 0);
    return { text: `📆 **Este mes (${monthCycles.length} ciclos):**\n• USDT: ${fmtN(gainMonth, 4)}\n• Bs.: ${fmtN(monthCycles.reduce((s,c) => s + c.ganancia_ves, 0), 2)}` };
  }

  // ── 9. Ganancia hoy ──────────────────────────────────────────────────────
  if (/hoy|ganancia de hoy/.test(q) && !/orden/.test(q)) {
    const todayCycles = completed.filter(c => c.closedAt && new Date(c.closedAt) >= todayStart);
    const gain = todayCycles.reduce((s, c) => s + c.ganancia_usdt, 0);
    return { text: `📅 **Hoy (${todayCycles.length} ciclo${todayCycles.length !== 1 ? 's' : ''}):**\n• Ganancia: ${fmtN(gain, 4)} USDT` };
  }

  // ── 10. Mejor ciclo ──────────────────────────────────────────────────────
  if (/mejor ciclo|más rentable|mayor ganancia|top ciclo/.test(q)) {
    if (completed.length === 0) return { text: '📭 Sin ciclos completados aún.' };
    const best = completed.reduce((a, b) => a.ganancia_usdt > b.ganancia_usdt ? a : b);
    return { text: `🏆 **Mejor ciclo: #${best.cycleNumber.toString().slice(-4)}**\n• Ganancia: ${fmtN(best.ganancia_usdt, 4)} USDT\n• ROI: ${fmtAbs(best.roi_percent, 2)}%\n• Fecha: ${best.closedAt ? localDate(best.closedAt) : '—'}` };
  }

  // ── 11. Peor ciclo ───────────────────────────────────────────────────────
  if (/peor ciclo|menor ganancia|pérdida|perdida|ciclo negativo/.test(q)) {
    if (completed.length === 0) return { text: '📭 Sin ciclos completados aún.' };
    const worst = completed.reduce((a, b) => a.ganancia_usdt < b.ganancia_usdt ? a : b);
    return { text: `📉 **Ciclo menos rentable: #${worst.cycleNumber.toString().slice(-4)}**\n• Resultado: ${fmtN(worst.ganancia_usdt, 4)} USDT\n• ROI: ${fmtAbs(worst.roi_percent, 2)}%` };
  }

  // ── 12. Ciclo específico ─────────────────────────────────────────────────
  const cycleNumMatch = q.match(/ciclo\s*#?(\d+)/i);
  if (cycleNumMatch) {
    const num = cycleNumMatch[1];
    const c = cycles.find(cy => cy.cycleNumber.toString().slice(-4) === num || cy.cycleNumber.toString() === num);
    if (!c) return { text: `🔍 No encontré el ciclo **#${num}**.` };
    return { text: `📊 **Ciclo #${c.cycleNumber.toString().slice(-4)} (${c.status})**\n• USDT vendido: ${fmtAbs(c.usdt_vendido, 2)}\n• USDT recomprado: ${fmtAbs(c.usdt_recomprado, 2)}\n• Ganancia USDT: ${fmtN(c.ganancia_usdt, 4)}\n• Ganancia Bs: ${fmtN(c.ganancia_ves, 2)}\n• ROI: ${fmtAbs(c.roi_percent, 2)}%\n• Tasa venta: ${fmtAbs(c.tasa_venta_prom, 2)} | Compra: ${fmtAbs(c.tasa_compra_prom, 2)}\n• Abierto: ${localDate(c.openedAt)}\n• Cerrado: ${c.closedAt ? localDate(c.closedAt) : 'En curso'}` };
  }

  // ── 13. Conteos ──────────────────────────────────────────────────────────
  if (/cuántas órdenes|cuantas ordenes|total de órdenes/.test(q)) {
    const unassigned = orders.filter(o => !o.cycleId).length;
    return { text: `📋 **Órdenes registradas: ${orders.length}**\n• Sin asignar a ciclo: ${unassigned}` };
  }
  if (/cuántos ciclos|cuantos ciclos|total ciclos|ciclos completados/.test(q)) {
    const enCurso = cycles.filter(c => c.status === 'En curso').length;
    return { text: `📊 **Ciclos: ${cycles.length} total**\n• Completados: ${completed.length}\n• En curso: ${enCurso}` };
  }

  // ── 14. ROI ──────────────────────────────────────────────────────────────
  if (/roi|rendimiento|rentabilidad/.test(q)) {
    if (completed.length === 0) return { text: '📭 Sin ciclos completados para calcular ROI.' };
    const avgRoi = completed.reduce((s, c) => s + c.roi_percent, 0) / completed.length;
    const best   = completed.reduce((a, b) => a.roi_percent > b.roi_percent ? a : b);
    return { text: `📈 **ROI promedio: ${fmtAbs(avgRoi, 2)}%**\n• Mejor: ${fmtAbs(best.roi_percent, 2)}% (Ciclo #${best.cycleNumber.toString().slice(-4)})\n• Basado en ${completed.length} ciclos` };
  }

  // ── 15. Volumen ──────────────────────────────────────────────────────────
  if (/volumen|operado|cuánto usdt|cuanto usdt/.test(q)) {
    const sold   = orders.filter(o => ['VENTA_USDT','SELL'].includes(o.operationType ?? o.tradeType) && o.orderStatus === 'COMPLETED').reduce((s, o) => s + o.amount, 0);
    const bought = orders.filter(o => ['COMPRA_USDT','BUY'].includes(o.operationType ?? o.tradeType) && o.orderStatus === 'COMPLETED').reduce((s, o) => s + o.amount, 0);
    return { text: `📊 **Volumen total:**\n• Vendido: ${fmtAbs(sold, 2)} USDT\n• Comprado: ${fmtAbs(bought, 2)} USDT` };
  }

  // ── 16. Última orden ────────────────────────────────────────────────────
  if (/última orden|ultima orden|orden reciente/.test(q)) {
    if (orders.length === 0) return { text: '📭 No hay órdenes registradas.' };
    const last = [...orders].sort((a, b) => new Date(b.createTime_utc).getTime() - new Date(a.createTime_utc).getTime())[0];
    const opType = last.operationType ?? (last.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT');
    return { text: `🕐 **Última orden:**\n• Tipo: ${opType}\n• Monto: ${fmtAbs(last.amount, 4)} USDT\n• Exchange: ${last.exchange || '—'}\n• Contraparte: ${last.counterPartNickName || '—'}\n• Tasa: ${fmtAbs(last.unitPrice, 4)} Bs/USDT\n• Origen: ${last.originMode === 'auto' ? '[Exchange]' : '[Manual]'}\n• Fecha: ${localDate(last.createTime_utc)}` };
  }

  // ── 17. Saludo ───────────────────────────────────────────────────────────
  if (/hola|hey|buenas|hello|buenos/.test(q)) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    return { text: `👋 **${greeting}${currentUser ? ', ' + currentUser.username : ''}!** Soy ARBI.\n\nPuedo consultar tus datos Y pre-llenar el formulario por ti.\n\nEscribe **"ayuda"** para ver todo lo que sé hacer, o dime algo como:\n_"Registra una venta de 200 USDT a tasa 38.50 en Binance"_` };
  }

  // ── 18. Ayuda ────────────────────────────────────────────────────────────
  if (/ayuda|help|qué puedes|que puedes|comandos/.test(q)) {
    return { text: `🤖 **ARBI — Superbot ArbiTrack**\n\n✏️ **Formularios:**\n• "Registra una venta de 200 USDT a 38.50 en Binance"\n• "Llena recompra 150 USDT en Bybit"\n\n📊 **Análisis inteligente:**\n• "Dame un resumen" — estado general\n• "Diagnosticar ciclo" — por qué gana/pierde\n• "Spread histórico" — análisis de tasas\n• "Top contrapartes" — traders frecuentes\n• "Proyección mensual" — estimado de ganancias\n• "Comparar últimos 5 ciclos"\n\n📅 **Por período:**\n• "Ganancia hoy / semana / mes / total"\n• "Esta semana" · "Órdenes de hoy"\n\n🔍 **Búsqueda:**\n• "Orden #12345" · "Contraparte [nombre]"\n• "Órdenes sin asignar" · "Tasa BCV"\n• "Liquidez disponible" · "ROI promedio"` };
  }

  // ── SEMANA ──────────────────────────────────────────────────────────────
  if (/semana|semanal|esta semana/.test(q) && !/bcv|tasa/.test(q)) {
    const wc = completed.filter(c => c.closedAt && new Date(c.closedAt) >= weekStart);
    const wg = wc.reduce((s,c)=>s+c.ganancia_usdt,0);
    const wo = orders.filter(o=>new Date(o.createTime_utc)>=weekStart).length;
    return { text: `📅 **Esta semana:**\n• Ciclos completados: ${wc.length}\n• Ganancia: ${fmtN(wg,4)} USDT\n• En Bs: ${fmtN(wc.reduce((s,c)=>s+c.ganancia_ves,0),2)}\n• Órdenes procesadas: ${wo}` };
  }

  // ── RESUMEN GENERAL ──────────────────────────────────────────────────────
  if (/resumen|status|cómo voy|como voy|dame un resumen/.test(q)) {
    const mc = completed.filter(c=>c.closedAt&&new Date(c.closedAt)>=monthStart);
    const mg = mc.reduce((s,c)=>s+c.ganancia_usdt,0);
    const prog = activeCycle && activeCycle.usdt_vendido>0 ? pct(activeCycle.usdt_recomprado,activeCycle.usdt_vendido) : null;
    return { text: `📊 **Resumen ArbiTrack**\n\n🔄 Ciclo activo: ${activeCycle?'#'+activeCycle.cycleNumber.toString().slice(-4)+' en curso'+(prog?` (${prog} recomprado)`:''): 'Ninguno'}\n📆 Este mes: ${fmtN(mg,4)} USDT (${mc.length} ciclos)\n💰 Ganancia total: ${fmtN(completed.reduce((s,c)=>s+c.ganancia_usdt,0),4)} USDT\n📋 Órdenes: ${orders.length} total · ${unassigned.length} sin asignar\n💱 BCV: ${bcvRate?fmtAbs(bcvRate.tasa_bcv,2)+' Bs/USD':'No disponible'}` };
  }

  // ── DIAGNÓSTICO DEL CICLO ────────────────────────────────────────────────
  if (/diagnost|por.?qu[eé].*(negat|baj|poca ganancia|mal)|analiz[a]? ciclo/.test(q)) {
    if (!activeCycle) return { text: '📭 No hay ciclo activo para diagnosticar.' };
    const co = orders.filter(o=>o.cycleId===activeCycle.id&&o.orderStatus?.toUpperCase()==='COMPLETED');
    const ventas = co.filter(o=>(o.operationType??(o.tradeType==='SELL'?'VENTA_USDT':''))==='VENTA_USDT');
    const compras = co.filter(o=>['COMPRA_USDT','RECOMPRA','SOBRANTE'].includes(o.operationType??(o.tradeType==='BUY'?'COMPRA_USDT':'')));
    const uV=ventas.reduce((s,o)=>s+o.amount,0), uC=compras.reduce((s,o)=>s+o.amount,0);
    const tV=ventas.reduce((s,o)=>s+o.totalPrice,0)/(uV||1), tC=compras.reduce((s,o)=>s+o.totalPrice,0)/(uC||1);
    const comm=co.reduce((s,o)=>s+(o.commission??0),0);
    const issues:string[]=[];
    if (tV-tC < 2) issues.push(`⚠️ Spread bajo (${(tV-tC).toFixed(2)} Bs/USDT). Busca tasas de venta más altas.`);
    if (comm > uV*0.003) issues.push(`⚠️ Comisiones altas (${comm.toFixed(4)} USDT = ${pct(comm,uV)} del capital). Considera nivel Oro.`);
    if (uC < uV*0.3) issues.push(`⚠️ Solo ${pct(uC,uV)} recomprado. La ganancia parcial puede ser negativa.`);
    if (tC > tV && uC>0) issues.push(`🚨 Compras más caras que ventas (${tC.toFixed(2)} > ${tV.toFixed(2)} Bs/USDT).`);
    return { text: `🔬 **Diagnóstico #${activeCycle.cycleNumber.toString().slice(-4)}**\n• Spread: ${(tV-tC).toFixed(2)} Bs/USDT\n• Recompra: ${pct(uC,uV)}\n• Comisiones: ${comm.toFixed(4)} USDT\n\n${issues.length?issues.join('\n'):'✅ Todo bien. La ganancia mejorará al completar la recompra.'}` };
  }

  // ── ÓRDENES SIN ASIGNAR ──────────────────────────────────────────────────
  if (/sin asignar|no asignadas|sueltas|huérfanas|flotantes/.test(q)) {
    if (unassigned.length===0) return { text: '✅ Todas las órdenes están asignadas a un ciclo.' };
    const uV=unassigned.filter(o=>o.tradeType==='SELL'||o.operationType==='VENTA_USDT');
    const uC=unassigned.filter(o=>o.tradeType==='BUY'||o.operationType==='COMPRA_USDT');
    return { text: `🔍 **${unassigned.length} órdenes sin asignar:**\n• 🔴 Ventas: ${uV.length}\n• 🟢 Compras: ${uC.length}\n• Volumen: ${fmtAbs(unassigned.reduce((s,o)=>s+o.amount,0),2)} USDT\n\n💡 Asígnalas desde el panel del ciclo activo.` };
  }

  // ── PROYECCIÓN ───────────────────────────────────────────────────────────
  if (/proyecc|cuánto ganaría|cuanto ganaria|si hago|al mes ganaría|estimado/.test(q)) {
    if (completed.length===0) return { text: '📭 Necesito ciclos completados para proyectar.' };
    const avg=completed.reduce((s,c)=>s+c.ganancia_usdt,0)/completed.length;
    const days=Math.max(1,Math.ceil((Date.now()-new Date(completed[completed.length-1].openedAt).getTime())/86400000));
    const cpd=completed.length/days;
    const p30=avg*cpd*30;
    const nm=q.match(/(\d+)\s*(?:ciclos?|al día)?/);
    const cc=nm?parseInt(nm[1]):null;
    return { text: `📈 **Proyección (${completed.length} ciclos base):**\n• Ganancia promedio/ciclo: ${fmtN(avg,4)} USDT\n• Tu ritmo: ~${cpd.toFixed(1)} ciclos/día\n• **Proyección mensual: ${fmtN(p30,2)} USDT**${cc?`\n• Con ${cc} ciclos/día: ${fmtN(avg*cc*30,2)} USDT/mes`:''}\n\n💡 Di "proyección si hago 3 ciclos" para simular.` };
  }

  // ── TOP CONTRAPARTES ─────────────────────────────────────────────────────
  if (/top contraparte|mejores trader|contrapartes frecuentes|con quien m[aá]s/.test(q)) {
    if (doneOrders.length===0) return { text: '📭 Sin órdenes para analizar.' };
    const map:{[k:string]:{count:number;vol:number}}={};
    doneOrders.forEach(o=>{const k=o.counterPartNickName||'Anónimo';if(!map[k])map[k]={count:0,vol:0};map[k].count++;map[k].vol+=o.amount;});
    const top=Object.entries(map).sort((a,b)=>b[1].count-a[1].count).slice(0,5);
    return { text: `👥 **Top 5 contrapartes:**\n${top.map(([n,d],i)=>`${i+1}. **${n}** — ${d.count} ops · ${fmtAbs(d.vol,2)} USDT`).join('\n')}` };
  }

  // ── SPREAD / ANÁLISIS DE TASAS ───────────────────────────────────────────
  if (/spread|diferencial de tasa|análisis de tasas|analisis de tasas/.test(q)) {
    const vs=doneOrders.filter(o=>o.operationType==='VENTA_USDT'||o.tradeType==='SELL');
    const cs=doneOrders.filter(o=>['COMPRA_USDT','RECOMPRA'].includes(o.operationType??'')||o.tradeType==='BUY');
    if (!vs.length||!cs.length) return { text: '📭 Necesito ventas Y compras para calcular spread.' };
    const aV=vs.reduce((s,o)=>s+o.unitPrice,0)/vs.length;
    const aC=cs.reduce((s,o)=>s+o.unitPrice,0)/cs.length;
    const mxV=Math.max(...vs.map(o=>o.unitPrice)), mnC=Math.min(...cs.map(o=>o.unitPrice));
    return { text: `📊 **Spread histórico:**\n• Tasa venta prom: ${fmtAbs(aV,2)} Bs/USDT\n• Tasa compra prom: ${fmtAbs(aC,2)} Bs/USDT\n• **Spread prom: ${fmtAbs(aV-aC,2)} Bs/USDT**\n\n🏆 Mejor venta: ${fmtAbs(mxV,2)} · Mejor compra: ${fmtAbs(mnC,2)}\n\n💡 Spread > 5 Bs/USDT es generalmente rentable.` };
  }

  // ── LIQUIDEZ ─────────────────────────────────────────────────────────────
  if (/liquidez|fondos disponibles|cuánto tengo|cuanto tengo en banco/.test(q)) {
    if (!activeCycle) return { text: '📭 No hay ciclo activo.' };
    const liq=activeCycle.ves_recibido-activeCycle.ves_pagado;
    const falt=Math.max(activeCycle.usdt_vendido-activeCycle.usdt_recomprado,0);
    return { text: `💧 **Liquidez Ciclo #${activeCycle.cycleNumber.toString().slice(-4)}:**\n• En banco: ${fmtVes(liq)}\n• USDT por recomprar: ${fmtAbs(falt,2)} USDT\n• Costo estimado: ${fmtVes(falt*(activeCycle.tasa_compra_prom||activeCycle.tasa_venta_prom||1))}` };
  }

  // ── COMPARAR ÚLTIMOS CICLOS ───────────────────────────────────────────────
  if (/comparar|últimos \d+ ciclos|ultimos \d+ ciclos/.test(q)) {
    const nm=q.match(/(\d+)/); const n=Math.min(parseInt(nm?.[1]||'5'),10);
    const rec=completed.slice(0,n);
    if (!rec.length) return { text: '📭 Sin ciclos completados.' };
    const avg=rec.reduce((s,c)=>s+c.ganancia_usdt,0)/rec.length;
    return { text: `📊 **Últimos ${rec.length} ciclos:**\n${rec.map((c,i)=>`${i+1}. #${c.cycleNumber.toString().slice(-4)} · ${fmtN(c.ganancia_usdt,4)} USDT · ROI ${fmtAbs(c.roi_percent,2)}%`).join('\n')}\n\n📈 Promedio: ${fmtN(avg,4)} USDT/ciclo` };
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  return { text: `🤔 No entendí eso. Escribe **"ayuda"** para ver todo lo que puedo hacer.\n\nO dime algo como:\n_"Registra una venta de 200 USDT a tasa 38.50 en Binance P2P"_` };
}

// ── Evento personalizado para comunicar con ActiveCyclePanel ─────────────────
export function dispatchFillForm(fields: FormFillAction['fields']) {
  window.dispatchEvent(new CustomEvent('arbi:fill-form', { detail: fields }));
}

// ── Component ─────────────────────────────────────────────────────────────────
export const AssistantBot: React.FC = () => {
  const { cycles, orders, activeCycle, bcvRate, currentUser } = useAppStore();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'help'>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([{
    role: 'bot',
    text: `👋 ¡Hola${currentUser ? ', ' + currentUser.username : ''}! Soy **ARBI**.\n\nPuedo consultar tus datos y también **pre-llenar el formulario** por ti.\n\nEscribe **"ayuda"** o prueba:\n_"Registra una venta de 200 USDT a tasa 38.50 en Binance"_`,
    ts: Date.now(),
  }]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150); }, [open]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMsg: Message = { role: 'user', text: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      const result = buildResponse(trimmed, { cycles, orders, activeCycle, bcvRate, currentUser });
      setMessages(prev => [...prev, { role: 'bot', text: result.text, action: result.action, ts: Date.now() }]);
      setIsTyping(false);
    }, 400 + Math.random() * 300);
  }, [input, cycles, orders, activeCycle, bcvRate, currentUser]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleQuickSend = (text: string) => {
    setInput(text);
    setTimeout(() => {
      const userMsg: Message = { role: 'user', text, ts: Date.now() };
      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);
      setTimeout(() => {
        const result = buildResponse(text, { cycles, orders, activeCycle, bcvRate, currentUser });
        setMessages(prev => [...prev, { role: 'bot', text: result.text, action: result.action, ts: Date.now() }]);
        setIsTyping(false);
      }, 400);
      setInput('');
    }, 10);
  };

  const handleFillForm = (fields: FormFillAction['fields']) => {
    dispatchFillForm(fields);
    setOpen(false);
    // Show confirmation
    const confirmMsg: Message = {
      role: 'bot',
      text: '✅ **¡Formulario pre-llenado!** Revisa los campos y presiona Registrar cuando estés listo.',
      ts: Date.now(),
    };
    setTimeout(() => setMessages(prev => [...prev, confirmMsg]), 200);
  };

  // Render markdown (**bold** and \n)
  const renderText = (text: string) =>
    text.split('\n').map((line, i, arr) => (
      <span key={i}>
        {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part.startsWith('_') && part.endsWith('_')
            ? <em key={j}>{part.slice(1, -1)}</em>
            : part
        )}
        {i < arr.length - 1 && <br />}
      </span>
    ));

  const quickPrompts = activeCycle ? [
    { label: '📊 Resumen', text: 'Dame un resumen' },
    { label: '🔬 Diagnosticar', text: 'Diagnosticar ciclo activo' },
    { label: '💧 Liquidez', text: 'Liquidez disponible' },
    { label: '📅 Esta semana', text: 'Esta semana' },
    { label: '📈 Proyección', text: 'Proyección mensual' },
  ] : [
    { label: '📊 Resumen', text: 'Dame un resumen' },
    { label: '📅 Esta semana', text: 'Esta semana' },
    { label: '📈 Proyección', text: 'Proyección mensual' },
    { label: '🏆 Mejor ciclo', text: 'Mejor ciclo' },
    { label: '👥 Contrapartes', text: 'Top contrapartes' },
  ];

  const hasAlert = unassigned.length > 0;

  return (
    <>
      {/* Trigger */}
      <button
        id="assistant-bot-trigger"
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-[80px] md:bottom-[28px] right-[20px] z-[200] w-[52px] h-[52px] rounded-full
          flex items-center justify-center shadow-lg transition-all duration-300 relative
          ${open ? 'bg-[var(--bg-surface-3)] border border-[var(--border-strong)] scale-95' : 'bg-[var(--accent)] hover:scale-110 animate-bot-bounce'}`}
        title="Asistente ARBI"
        aria-label="Abrir asistente"
      >
        {open ? <X size={22} className="text-[var(--text-primary)]"/> : <Bot size={22} className="text-white"/>}
        {!open && hasAlert && (
          <span className="absolute top-[8px] right-[8px] w-[10px] h-[10px] rounded-full bg-[var(--warning)] border-2 border-[var(--accent)] animate-pulse"/>
        )}
      </button>

      {/* Panel */}
      <div className={`fixed bottom-[144px] md:bottom-[90px] right-[20px] z-[199]
        w-[360px] max-h-[540px] rounded-[18px] flex flex-col overflow-hidden
        border border-[var(--border-strong)] shadow-[0_20px_60px_rgba(0,0,0,0.3)]
        bg-[var(--bg-surface-1)]
        transition-all duration-300 origin-bottom-right
        ${open ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-[16px] py-[12px] border-b border-[var(--border)] bg-[var(--bg-surface-2)] flex-shrink-0">
          <div className="flex items-center gap-[10px]">
            <div className="w-[32px] h-[32px] rounded-full bg-[var(--accent)] flex items-center justify-center">
              <Sparkles size={15} className="text-white"/>
            </div>
            <div>
              <p className="font-bold text-[13px] leading-tight">ARBI</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">Asistente · Pre-llena formularios</p>
            </div>
          </div>
          <div className="flex items-center gap-[4px]">
            <button
              onClick={() => setTab(t => t === 'help' ? 'chat' : 'help')}
              className={`p-[5px] rounded-full transition-colors ${tab === 'help' ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              title="Ayuda del sistema"
            >
              <HelpCircle size={16}/>
            </button>
            <button onClick={() => setOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-[4px] rounded-full hover:bg-[var(--bg-surface-3)]">
              <ChevronDown size={18}/>
            </button>
          </div>
        </div>

        {/* Help tab */}
        {tab === 'help' && (
          <div className="flex-1 overflow-y-auto p-[14px] flex flex-col gap-[10px] custom-scrollbar">
            <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Comandos rápidos</p>

            {[
              { icon: <FilePen size={11}/>, label: 'Formulario', prompts: [
                'Registra una venta de 200 USDT a tasa 38.50 en Binance',
                'Llena recompra 100 USDT en Bybit',
                'Agrega una transferencia de 50 USD',
              ]},
              { icon: <Zap size={11}/>, label: 'Datos', prompts: [
                'Ciclo activo', 'Ganancia total', 'ROI promedio',
                'Mejor ciclo', 'Volumen operado', 'Tasa BCV',
              ]},
              { icon: <HelpCircle size={11}/>, label: 'Sistema', prompts: [
                '¿Cómo funciona el modo automático?',
                '¿Qué tipos de operación existen?',
                '¿Cómo se calculan las ganancias?',
                '¿Qué son los niveles de comisión?',
              ]},
            ].map(group => (
              <div key={group.label}>
                <div className="flex items-center gap-[5px] mb-[6px] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  {group.icon} {group.label}
                </div>
                <div className="flex flex-col gap-[3px]">
                  {group.prompts.map(p => (
                    <button
                      key={p}
                      onClick={() => { setTab('chat'); handleQuickSend(p); }}
                      className="text-left text-[11.5px] px-[10px] py-[6px] rounded-[7px] bg-[var(--bg-surface-2)] hover:bg-[var(--accent-muted)] hover:text-[var(--accent)] text-[var(--text-secondary)] transition-all border border-transparent hover:border-[var(--accent-border)]"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat tab */}
        {tab === 'chat' && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-[14px] flex flex-col gap-[10px] custom-scrollbar">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-[6px]`}>
                  <div className={`max-w-[90%] rounded-[14px] px-[12px] py-[9px] text-[12.5px] leading-[1.6]
                    ${msg.role === 'user'
                      ? 'bg-[var(--accent)] text-white rounded-br-[3px]'
                      : 'bg-[var(--bg-surface-2)] text-[var(--text-primary)] border border-[var(--border)] rounded-bl-[3px]'}`}>
                    {renderText(msg.text)}
                  </div>
                  {/* Action card */}
                  {msg.action?.type === 'fill_form' && (
                    <button
                      onClick={() => handleFillForm(msg.action!.fields)}
                      className="flex items-center gap-[6px] px-[12px] py-[7px] rounded-[10px] bg-[var(--accent)] hover:brightness-110 text-white text-[11px] font-bold transition-all shadow-[0_2px_8px_rgba(37,99,235,0.3)] animate-fade-in-up"
                    >
                      <FilePen size={11}/>
                      {msg.action.label}
                    </button>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[14px] rounded-bl-[3px] px-[14px] py-[12px] flex gap-[5px] items-center">
                    <span className="bot-dot w-[6px] h-[6px] bg-[var(--text-tertiary)] rounded-full"/>
                    <span className="bot-dot w-[6px] h-[6px] bg-[var(--text-tertiary)] rounded-full"/>
                    <span className="bot-dot w-[6px] h-[6px] bg-[var(--text-tertiary)] rounded-full"/>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>

            {/* Quick suggestions */}
            <div className="px-[12px] pt-[8px] pb-[4px] flex gap-[5px] flex-wrap border-t border-[var(--border)] bg-[var(--bg-surface-2)] flex-shrink-0">
              {quickPrompts.map(({ label, text }) => (
                <button
                  key={label}
                  onClick={() => handleQuickSend(text)}
                  className="text-[10px] font-medium px-[8px] py-[4px] rounded-full bg-[var(--bg-surface-3)] text-[var(--text-secondary)] hover:bg-[var(--accent-muted)] hover:text-[var(--accent)] transition-all border border-[var(--border)]"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex items-center gap-[8px] px-[12px] py-[10px] bg-[var(--bg-surface-2)] flex-shrink-0">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder='"Registra venta 200 USDT @ 38.50"'
                className="flex-1 bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[10px] text-[12px] px-[12px] py-[8px] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-[36px] h-[36px] rounded-[10px] bg-[var(--accent)] text-white flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
              >
                <Send size={15}/>
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

// ── Re-export knowledge for potential future use ──────────────────────────────
export { SYSTEM_KNOWLEDGE };
