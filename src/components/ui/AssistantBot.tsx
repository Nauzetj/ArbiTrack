import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Bot, X, Send, ChevronDown, Sparkles } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'bot';
  text: string;
  ts: number;
}

type StoreCtx = {
  cycles: ReturnType<typeof useAppStore.getState>['cycles'];
  orders: ReturnType<typeof useAppStore.getState>['orders'];
  activeCycle: ReturnType<typeof useAppStore.getState>['activeCycle'];
  bcvRate: ReturnType<typeof useAppStore.getState>['bcvRate'];
  currentUser: ReturnType<typeof useAppStore.getState>['currentUser'];
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2) {
  return (n >= 0 ? '+' : '') + n.toFixed(decimals);
}
function fmtAbs(n: number, decimals = 2) {
  return n.toFixed(decimals);
}
function localDate(iso: string) {
  return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
}

// ── Intent Engine ─────────────────────────────────────────────────────────────
function buildResponse(input: string, ctx: StoreCtx): string {
  const q = input.toLowerCase().trim();
  const { cycles, orders, activeCycle, bcvRate, currentUser } = ctx;

  const completed  = cycles.filter(c => c.status === 'Completado');
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  // ── 1. BCV rate ─────────────────────────────────────────────────────────────
  if (/bcv|tasa|cambio|dolar|bolívar|bolivar/.test(q) && !/orden|ciclo|transac/.test(q)) {
    if (!bcvRate) return '💱 Tasa BCV aún no sincronizada. Espera unos segundos.';
    return `💱 **Tasa BCV actual:** ${fmtAbs(bcvRate.tasa_bcv)} Bs/USD`;
  }

  // ── 2. Buscar orden por número de orden ─────────────────────────────────────
  const orderNumMatch = input.match(/(?:orden|order|#)\s*([A-Z0-9]{8,})/i)
    || input.match(/\b([0-9]{10,})\b/);
  if (orderNumMatch) {
    const term = orderNumMatch[1].toUpperCase();
    const found = orders.find(o => o.orderNumber?.toUpperCase().includes(term));
    if (!found) return `🔍 No encontré ninguna orden que contenga **"${term}"**.\nVerifica el número e intenta de nuevo.`;
    const cycle = found.cycleId ? cycles.find(c => c.id === found.cycleId) : null;
    return `📋 **Orden encontrada:**\n• Número: ${found.orderNumber}\n• Tipo: ${found.tradeType === 'BUY' ? '🟢 COMPRA' : '🔴 VENTA'}\n• Monto: ${fmtAbs(found.amount, 4)} USDT\n• Precio total: ${fmtAbs(found.totalPrice, 2)} Bs\n• Tasa: ${fmtAbs(found.unitPrice, 4)} Bs/USDT\n• Contraparte: ${found.counterPartNickName || '—'}\n• Estado: ${found.orderStatus}\n• Fecha: ${localDate(found.createTime_utc)}\n• Ciclo: ${cycle ? '#' + cycle.cycleNumber.toString().slice(-4) : 'Sin asignar'}`;
  }

  // ── 3. Buscar por contraparte ────────────────────────────────────────────────
  const contraMatch = q.match(/(?:contraparte|usuario|nick|trader)\s+(.{3,})/);
  if (contraMatch || /busca|buscar|busco/.test(q)) {
    const nameTerm = contraMatch?.[1] || q.replace(/busca[r]?\s+/i, '').trim();
    if (nameTerm.length >= 3) {
      const hits = orders.filter(o =>
        o.counterPartNickName?.toLowerCase().includes(nameTerm)
      ).slice(0, 5);
      if (hits.length === 0) return `🔍 No encontré órdenes con contraparte **"${nameTerm}"**.`;
      const lines = hits.map(o =>
        `• ${o.tradeType === 'BUY' ? '🟢' : '🔴'} ${o.orderNumber} — ${fmtAbs(o.amount, 2)} USDT — ${localDate(o.createTime_utc)}`
      );
      return `🔍 **${hits.length} orden(es) de "${nameTerm}":**\n${lines.join('\n')}`;
    }
  }

  // ── 4. Órdenes de hoy ────────────────────────────────────────────────────────
  if (/órdenes de hoy|ordenes de hoy|transacciones de hoy/.test(q)) {
    const todays = orders.filter(o => new Date(o.createTime_utc) >= todayStart);
    if (todays.length === 0) return '📅 No hay órdenes registradas hoy todavía.';
    const buys  = todays.filter(o => o.tradeType === 'BUY');
    const sells = todays.filter(o => o.tradeType === 'SELL');
    const vol   = todays.filter(o => o.orderStatus === 'COMPLETED' && o.tradeType === 'SELL').reduce((s, o) => s + o.amount, 0);
    return `📅 **Órdenes de hoy (${todays.length}):**\n• 🟢 Compras: ${buys.length}\n• 🔴 Ventas: ${sells.length}\n• Volumen vendido: ${fmtAbs(vol, 2)} USDT`;
  }

  // ── 5. Activo actual / ciclo activo ──────────────────────────────────────────
  if (/ciclo activo|en curso|abierto|ciclo actual/.test(q)) {
    if (!activeCycle) return '📭 No hay ningún ciclo activo. Puedes abrir uno desde el Dashboard.';
    const gain = activeCycle.ganancia_usdt;
    const assignedOrders = orders.filter(o => o.cycleId === activeCycle.id);
    return `🔄 **Ciclo #${activeCycle.cycleNumber.toString().slice(-4)} en curso**\n• USDT vendido: ${fmtAbs(activeCycle.usdt_vendido, 2)}\n• USDT recomprado: ${fmtAbs(activeCycle.usdt_recomprado, 2)}\n• Ganancia parcial: ${fmt(gain, 4)} USDT\n• Órdenes asignadas: ${assignedOrders.length}\n• Abierto: ${localDate(activeCycle.openedAt)}`;
  }

  // ── 6. Ganancia total ────────────────────────────────────────────────────────
  if (/ganancia total|utilidad total|beneficio total|cuánto gané|cuanto gane|profit total/.test(q)) {
    const total    = completed.reduce((s, c) => s + c.ganancia_usdt, 0);
    const totalVes = completed.reduce((s, c) => s + c.ganancia_ves, 0);
    return `💰 **Ganancia acumulada (${completed.length} ciclos):**\n• ${fmt(total, 4)} USDT\n• ${fmt(totalVes, 2)} Bs`;
  }

  // ── 7. Ganancia del mes ──────────────────────────────────────────────────────
  if (/mes|mensual|este mes/.test(q) && !/bcv|tasa/.test(q)) {
    const monthCycles = completed.filter(c => c.closedAt && new Date(c.closedAt) >= monthStart);
    const gainMonth = monthCycles.reduce((s, c) => s + c.ganancia_usdt, 0);
    return `📆 **Este mes (${monthCycles.length} ciclos):**\n• Ganancia: ${fmt(gainMonth, 4)} USDT\n• Bs.: ${fmt(monthCycles.reduce((s,c) => s + c.ganancia_ves, 0), 2)}`;
  }

  // ── 8. Ganancia de hoy ───────────────────────────────────────────────────────
  if (/hoy|día de hoy|ganancia de hoy/.test(q)) {
    const todayCycles = completed.filter(c => c.closedAt && new Date(c.closedAt) >= todayStart);
    const gain = todayCycles.reduce((s, c) => s + c.ganancia_usdt, 0);
    return `📅 **Hoy (${todayCycles.length} ciclo${todayCycles.length !== 1 ? 's' : ''}):**\n• Ganancia: ${fmt(gain, 4)} USDT`;
  }

  // ── 9. Mejor ciclo ───────────────────────────────────────────────────────────
  if (/mejor ciclo|más rentable|mayor ganancia|top ciclo/.test(q)) {
    if (completed.length === 0) return '📭 Sin ciclos completados aún.';
    const best = completed.reduce((a, b) => a.ganancia_usdt > b.ganancia_usdt ? a : b);
    return `🏆 **Mejor ciclo: #${best.cycleNumber.toString().slice(-4)}**\n• Ganancia: ${fmt(best.ganancia_usdt, 4)} USDT\n• ROI: ${fmtAbs(best.roi_percent, 2)}%\n• Tasa promedio venta: ${fmtAbs(best.tasa_venta_prom, 2)} Bs/USDT\n• Fecha: ${best.closedAt ? localDate(best.closedAt) : '—'}`;
  }

  // ── 10. Peor ciclo ───────────────────────────────────────────────────────────
  if (/peor ciclo|menor ganancia|pérdida|perdida|ciclo negativo/.test(q)) {
    if (completed.length === 0) return '📭 Sin ciclos completados aún.';
    const worst = completed.reduce((a, b) => a.ganancia_usdt < b.ganancia_usdt ? a : b);
    return `📉 **Ciclo menos rentable: #${worst.cycleNumber.toString().slice(-4)}**\n• Resultado: ${fmt(worst.ganancia_usdt, 4)} USDT\n• ROI: ${fmtAbs(worst.roi_percent, 2)}%\n• Fecha: ${worst.closedAt ? localDate(worst.closedAt) : '—'}`;
  }

  // ── 11. Resumen de ciclo específico por número ───────────────────────────────
  const cycleNumMatch = q.match(/ciclo\s*#?(\d+)/i);
  if (cycleNumMatch) {
    const num = cycleNumMatch[1];
    const c = cycles.find(cy => cy.cycleNumber.toString().slice(-4) === num || cy.cycleNumber.toString() === num);
    if (!c) return `🔍 No encontré el ciclo **#${num}**. Prueba con los últimos 4 dígitos.`;
    return `📊 **Ciclo #${c.cycleNumber.toString().slice(-4)} (${c.status})**\n• USDT vendido: ${fmtAbs(c.usdt_vendido, 2)}\n• USDT recomprado: ${fmtAbs(c.usdt_recomprado, 2)}\n• Ganancia USDT: ${fmt(c.ganancia_usdt, 4)}\n• Ganancia Bs: ${fmt(c.ganancia_ves, 2)}\n• ROI: ${fmtAbs(c.roi_percent, 2)}%\n• Tasa venta: ${fmtAbs(c.tasa_venta_prom, 2)} | Compra: ${fmtAbs(c.tasa_compra_prom, 2)}\n• Abierto: ${localDate(c.openedAt)}\n• Cerrado: ${c.closedAt ? localDate(c.closedAt) : 'En curso'}`;
  }

  // ── 12. Conteo de órdenes ────────────────────────────────────────────────────
  if (/cuántas órdenes|cuantas ordenes|total de órdenes|transacciones/.test(q)) {
    const buys  = orders.filter(o => o.tradeType === 'BUY').length;
    const sells = orders.filter(o => o.tradeType === 'SELL').length;
    const unassigned = orders.filter(o => !o.cycleId).length;
    return `📋 **Órdenes registradas: ${orders.length}**\n• 🟢 Compras (BUY): ${buys}\n• 🔴 Ventas (SELL): ${sells}\n• Sin asignar: ${unassigned}`;
  }

  // ── 13. Conteo de ciclos ─────────────────────────────────────────────────────
  if (/cuántos ciclos|cuantos ciclos|total ciclos|ciclos completados/.test(q)) {
    const enCurso = cycles.filter(c => c.status === 'En curso').length;
    return `📊 **Ciclos registrados: ${cycles.length}**\n• Completados: ${completed.length}\n• En curso: ${enCurso}`;
  }

  // ── 14. ROI / Rendimiento ────────────────────────────────────────────────────
  if (/roi|rendimiento|rentabilidad|porcentaje/.test(q)) {
    if (completed.length === 0) return '📭 Sin ciclos completados para calcular ROI.';
    const avgRoi = completed.reduce((s, c) => s + c.roi_percent, 0) / completed.length;
    const best   = completed.reduce((a, b) => a.roi_percent > b.roi_percent ? a : b);
    return `📈 **ROI promedio: ${fmtAbs(avgRoi, 2)}%**\n• Mejor ROI: ${fmtAbs(best.roi_percent, 2)}% (Ciclo #${best.cycleNumber.toString().slice(-4)})\n• Basado en ${completed.length} ciclos`;
  }

  // ── 15. Volumen operado ──────────────────────────────────────────────────────
  if (/volumen|operado|cuánto usdt|cuanto usdt/.test(q)) {
    const totalSold    = orders.filter(o => o.tradeType === 'SELL' && o.orderStatus === 'COMPLETED').reduce((s, o) => s + o.amount, 0);
    const totalBought  = orders.filter(o => o.tradeType === 'BUY'  && o.orderStatus === 'COMPLETED').reduce((s, o) => s + o.amount, 0);
    return `📊 **Volumen total operado:**\n• Vendido: ${fmtAbs(totalSold, 2)} USDT\n• Recomprado: ${fmtAbs(totalBought, 2)} USDT`;
  }

  // ── 16. Última orden ─────────────────────────────────────────────────────────
  if (/última orden|ultima orden|orden más reciente|orden reciente/.test(q)) {
    if (orders.length === 0) return '📭 No tienes órdenes registradas aún.';
    const last = [...orders].sort((a, b) => new Date(b.createTime_utc).getTime() - new Date(a.createTime_utc).getTime())[0];
    return `🕐 **Última orden:**\n• ${last.tradeType === 'BUY' ? '🟢 COMPRA' : '🔴 VENTA'} — ${fmtAbs(last.amount, 4)} USDT\n• Contraparte: ${last.counterPartNickName || '—'}\n• Tasa: ${fmtAbs(last.unitPrice, 4)} Bs/USDT\n• Fecha: ${localDate(last.createTime_utc)}\n• Número: ${last.orderNumber}`;
  }

  // ── 17. Último ciclo cerrado ─────────────────────────────────────────────────
  if (/último ciclo|ultimo ciclo|ciclo reciente|ciclo anterior/.test(q)) {
    if (completed.length === 0) return '📭 No hay ciclos completados aún.';
    const last = [...completed].sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())[0];
    return `🔁 **Último ciclo cerrado: #${last.cycleNumber.toString().slice(-4)}**\n• Ganancia: ${fmt(last.ganancia_usdt, 4)} USDT\n• ROI: ${fmtAbs(last.roi_percent, 2)}%\n• Cerrado: ${localDate(last.closedAt!)}`;
  }

  // ── 18. Mi usuario / saludo ──────────────────────────────────────────────────
  if (/hola|hey|buenas|saludo|hello|buenos días|buenas noches/.test(q)) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    return `👋 **${greeting}${currentUser ? ', ' + currentUser.username : ''}!** Soy ARBI, tu asistente de datos.\n\nEscribe **"ayuda"** para ver todo lo que puedo consultar por ti.`;
  }

  // ── 19. Ayuda ────────────────────────────────────────────────────────────────
  if (/ayuda|help|qué puedes|que puedes|comandos/.test(q)) {
    return `🤖 **Comandos disponibles:**\n\n📦 **Órdenes:**\n• "Orden #12345678"\n• "Última orden"\n• "Órdenes de hoy"\n• "Buscar contraparte NombreNick"\n• "¿Cuántas órdenes tengo?"\n• "Volumen operado"\n\n📊 **Ciclos:**\n• "Ciclo activo"\n• "Ciclo #1234"\n• "Último ciclo"\n• "Mejor ciclo" / "Peor ciclo"\n• "¿Cuántos ciclos completados?"\n\n💰 **Ganancias:**\n• "Ganancia de hoy"\n• "Ganancia del mes"\n• "Ganancia total"\n• "ROI promedio"\n\n💱 **Otro:**\n• "Tasa BCV"`;
  }

  // ── Fallback ─────────────────────────────────────────────────────────────────
  return `🤔 No entendí eso. Escribe **"ayuda"** para ver los comandos disponibles.\n\nTambién puedes buscar directamente:\n• Un número de orden: **"Orden 12345678"**\n• Una contraparte: **"Buscar NombreNick"**\n• Un ciclo: **"Ciclo #1234"**`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const AssistantBot: React.FC = () => {
  const { cycles, orders, activeCycle, bcvRate, currentUser } = useAppStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([{
    role: 'bot',
    text: `👋 ¡Hola${currentUser ? ', ' + currentUser.username : ''}! Soy **ARBI**, tu asistente de datos.\n\nPuedo buscar órdenes, ciclos, ganancias y mucho más. Escribe **"ayuda"** para ver todo lo que sé hacer.`,
    ts: Date.now()
  }]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMsg: Message = { role: 'user', text: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      const text = buildResponse(trimmed, { cycles, orders, activeCycle, bcvRate, currentUser });
      setMessages(prev => [...prev, { role: 'bot', text, ts: Date.now() }]);
      setIsTyping(false);
    }, 500 + Math.random() * 400);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Render **bold** and \n
  const fmt = (text: string) =>
    text.split('\n').map((line, i, arr) => (
      <span key={i}>
        {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
        {i < arr.length - 1 && <br />}
      </span>
    ));

  return (
    <>
      {/* Trigger button */}
      <button
        id="assistant-bot-trigger"
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-[80px] md:bottom-[28px] right-[20px] z-[200] w-[52px] h-[52px] rounded-full
          flex items-center justify-center shadow-lg transition-all duration-300
          ${open ? 'bg-[var(--bg-surface-3)] border border-[var(--border-strong)] scale-95' : 'bg-[var(--accent)] hover:scale-110 animate-bot-bounce'}
        `}
        title="Asistente ARBI"
        aria-label="Abrir asistente"
      >
        {open ? <X size={22} className="text-[var(--text-primary)]" /> : <Bot size={22} className="text-white" />}
      </button>

      {/* Chat panel */}
      <div className={`fixed bottom-[144px] md:bottom-[90px] right-[20px] z-[199]
        w-[340px] max-h-[500px] rounded-[18px] flex flex-col overflow-hidden
        border border-[var(--border-strong)] shadow-[0_20px_60px_rgba(0,0,0,0.3)]
        bg-[var(--bg-surface-1)]
        transition-all duration-300 origin-bottom-right
        ${open ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-[16px] py-[12px] border-b border-[var(--border)] bg-[var(--bg-surface-2)] flex-shrink-0">
          <div className="flex items-center gap-[10px]">
            <div className="w-[32px] h-[32px] rounded-full bg-[var(--accent)] flex items-center justify-center">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-[13px] leading-tight">ARBI</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">Asistente de datos</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-[4px] rounded-full hover:bg-[var(--bg-surface-3)]">
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-[14px] flex flex-col gap-[10px] custom-scrollbar">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-[14px] px-[12px] py-[9px] text-[12.5px] leading-[1.6]
                ${msg.role === 'user'
                  ? 'bg-[var(--accent)] text-white rounded-br-[3px]'
                  : 'bg-[var(--bg-surface-2)] text-[var(--text-primary)] border border-[var(--border)] rounded-bl-[3px]'}`}>
                {fmt(msg.text)}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[14px] rounded-bl-[3px] px-[14px] py-[12px] flex gap-[5px] items-center">
                <span className="bot-dot w-[6px] h-[6px] bg-[var(--text-tertiary)] rounded-full" />
                <span className="bot-dot w-[6px] h-[6px] bg-[var(--text-tertiary)] rounded-full" />
                <span className="bot-dot w-[6px] h-[6px] bg-[var(--text-tertiary)] rounded-full" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick suggestions */}
        <div className="px-[12px] pt-[8px] pb-[4px] flex gap-[6px] flex-wrap border-t border-[var(--border)] bg-[var(--bg-surface-2)] flex-shrink-0">
          {['Ganancia hoy', 'Última orden', 'Ciclo activo', 'Tasa BCV'].map(s => (
            <button key={s} onClick={() => {
              setInput(s);
              setTimeout(() => handleSend(), 10);
            }}
              className="text-[10.5px] font-medium px-[9px] py-[4px] rounded-full bg-[var(--bg-surface-3)] text-[var(--text-secondary)] hover:bg-[var(--accent-muted)] hover:text-[var(--accent)] transition-all border border-[var(--border)]">
              {s}
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
            placeholder='Ej: "Orden #123456" o "Mejor ciclo"'
            className="flex-1 bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[10px] text-[12.5px] px-[12px] py-[8px] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] transition-colors"
          />
          <button onClick={handleSend} disabled={!input.trim()}
            className="w-[36px] h-[36px] rounded-[10px] bg-[var(--accent)] text-white flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-all hover:scale-105 active:scale-95 flex-shrink-0">
            <Send size={15} />
          </button>
        </div>
      </div>
    </>
  );
};
