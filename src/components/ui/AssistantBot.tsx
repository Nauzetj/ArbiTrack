import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Bot, X, Send, ChevronDown, Sparkles } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'bot';
  text: string;
  ts: number;
}

// ── Intent engine — pure client-side, queries Zustand store ─────────────────
function buildResponse(input: string, ctx: {
  cycles: ReturnType<typeof useAppStore.getState>['cycles'];
  orders: ReturnType<typeof useAppStore.getState>['orders'];
  activeCycle: ReturnType<typeof useAppStore.getState>['activeCycle'];
  bcvRate: ReturnType<typeof useAppStore.getState>['bcvRate'];
  currentUser: ReturnType<typeof useAppStore.getState>['currentUser'];
}): string {
  const q = input.toLowerCase().trim();
  const { cycles, orders, activeCycle, bcvRate, currentUser } = ctx;

  const completed = cycles.filter(c => c.status === 'Completado');
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  // ── BCV rate ────────────────────────────────────────────────────────────
  if (/bcv|tasa|cambio|dolar|bolívar|bolivar|ves/.test(q)) {
    if (!bcvRate) return '💱 No tengo la tasa BCV disponible aún. Espera unos segundos mientras se sincroniza.';
    return `💱 **Tasa BCV actual:** ${bcvRate.tasa_bcv.toFixed(2)} Bs/USD\nFecha: ${new Date(bcvRate.fecha || Date.now()).toLocaleDateString('es-VE')}`;
  }

  // ── Active cycle ─────────────────────────────────────────────────────────
  if (/ciclo activo|ciclo en curso|abierto|actual|activo/.test(q)) {
    if (!activeCycle) return '📭 No hay ningún ciclo activo en este momento. Puedes abrir uno desde el Dashboard.';
    const gain = activeCycle.ganancia_usdt;
    const sign = gain >= 0 ? '+' : '';
    return `🔄 **Ciclo #${activeCycle.cycleNumber.toString().slice(-4)} en curso**\n• USDT vendido: ${activeCycle.usdt_vendido.toFixed(2)}\n• USDT recomprado: ${activeCycle.usdt_recomprado.toFixed(2)}\n• Resultado parcial: ${sign}${gain.toFixed(4)} USDT\n• Abierto: ${new Date(activeCycle.openedAt).toLocaleString('es-VE')}`;
  }

  // ── Total profit ─────────────────────────────────────────────────────────
  if (/ganancia total|utilidad total|beneficio total|cuánto gané|cuanto gane|profit total/.test(q)) {
    const total = completed.reduce((s, c) => s + c.ganancia_usdt, 0);
    const totalVes = completed.reduce((s, c) => s + c.ganancia_ves, 0);
    return `💰 **Ganancia total acumulada:**\n• ${total >= 0 ? '+' : ''}${total.toFixed(4)} USDT\n• ${totalVes >= 0 ? '+' : ''}${totalVes.toFixed(2)} Bs (VES)`;
  }

  // ── Today's profit ───────────────────────────────────────────────────────
  if (/hoy|día de hoy|today|ganancia de hoy/.test(q)) {
    const todayCycles = completed.filter(c => c.closedAt && new Date(c.closedAt) >= todayStart);
    const todayGain = todayCycles.reduce((s, c) => s + c.ganancia_usdt, 0);
    return `📅 **Hoy (${todayCycles.length} ciclo${todayCycles.length !== 1 ? 's' : ''} completado${todayCycles.length !== 1 ? 's' : ''}):**\n• Ganancia: ${todayGain >= 0 ? '+' : ''}${todayGain.toFixed(4)} USDT`;
  }

  // ── Number of cycles ─────────────────────────────────────────────────────
  if (/cuántos ciclos|cuantos ciclos|total ciclos|ciclos completados|historial de ciclos/.test(q)) {
    return `📊 **Ciclos registrados:** ${cycles.length}\n• Completados: ${completed.length}\n• En curso: ${cycles.filter(c => c.status === 'En curso').length}`;
  }

  // ── Best cycle ───────────────────────────────────────────────────────────
  if (/mejor ciclo|ciclo más rentable|mayor ganancia|top ciclo/.test(q)) {
    if (completed.length === 0) return '📭 Aún no tienes ciclos completados para comparar.';
    const best = completed.reduce((a, b) => a.ganancia_usdt > b.ganancia_usdt ? a : b);
    return `🏆 **Mejor ciclo:** #${best.cycleNumber.toString().slice(-4)}\n• Ganancia: +${best.ganancia_usdt.toFixed(4)} USDT\n• ROI: ${best.roi_percent.toFixed(2)}%\n• Fecha: ${best.closedAt ? new Date(best.closedAt).toLocaleDateString('es-VE') : '—'}`;
  }

  // ── Orders count ─────────────────────────────────────────────────────────
  if (/órdenes|ordenes|transacciones|cuántas|cuantas/.test(q)) {
    const buys = orders.filter(o => o.tradeType === 'BUY').length;
    const sells = orders.filter(o => o.tradeType === 'SELL').length;
    return `📋 **Órdenes registradas:** ${orders.length}\n• Compras (BUY): ${buys}\n• Ventas (SELL): ${sells}`;
  }

  // ── ROI ──────────────────────────────────────────────────────────────────
  if (/roi|rendimiento|rentabilidad|porcentaje/.test(q)) {
    if (completed.length === 0) return '📭 Sin ciclos completados para calcular ROI.';
    const avgRoi = completed.reduce((s, c) => s + c.roi_percent, 0) / completed.length;
    return `📈 **ROI promedio:** ${avgRoi.toFixed(2)}%\nBasado en ${completed.length} ciclo${completed.length !== 1 ? 's' : ''} completado${completed.length !== 1 ? 's' : ''}.`;
  }

  // ── Username / greeting ──────────────────────────────────────────────────
  if (/hola|hey|buenas|saludo|como estas|hello/.test(q)) {
    return `👋 ¡Hola${currentUser ? ', ' + currentUser.username : ''}! Soy tu asistente ArbiTrack.\nPuedo ayudarte a consultar información como:\n• Ganancia de hoy o acumulada\n• Ciclo activo\n• Mejor ciclo\n• Tasa BCV\n• Estadísticas de órdenes\n\n¿Qué quieres saber?`;
  }

  // ── Help / commands ──────────────────────────────────────────────────────
  if (/ayuda|help|qué puedes|que puedes|comandos|opciones/.test(q)) {
    return `🤖 **Comandos disponibles:**\n• "¿Cuánto gané hoy?"\n• "Ciclo activo"\n• "Ganancia total"\n• "Mejor ciclo"\n• "¿Cuántas órdenes tengo?"\n• "Tasa BCV"\n• "ROI promedio"\n• "¿Cuántos ciclos completados?"`;
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  return `🤔 No entendí tu consulta. Intenta con:\n• "Ganancia de hoy"\n• "Ciclo activo"\n• "Mejor ciclo"\n• "Tasa BCV"\n\nO escribe **"ayuda"** para ver todos los comandos.`;
}

// ── Component ────────────────────────────────────────────────────────────────
export const AssistantBot: React.FC = () => {
  const { cycles, orders, activeCycle, bcvRate, currentUser } = useAppStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([{
    role: 'bot',
    text: `👋 ¡Hola${currentUser ? ', ' + currentUser.username : ''}! Soy ARBI, tu asistente de datos.\n\nEscribe "ayuda" para ver qué puedo consultar por ti.`,
    ts: Date.now()
  }]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: Message = { role: 'user', text: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const botResponse = buildResponse(trimmed, { cycles, orders, activeCycle, bcvRate, currentUser });
      setMessages(prev => [...prev, { role: 'bot', text: botResponse, ts: Date.now() }]);
      setIsTyping(false);
    }, 650 + Math.random() * 400);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Format bot text to support **bold**, \n newlines
  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        id="assistant-bot-trigger"
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-[80px] md:bottom-[28px] right-[20px] z-[200] w-[52px] h-[52px] rounded-full
          flex items-center justify-center shadow-lg transition-all duration-300
          ${open
            ? 'bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rotate-[8deg]'
            : 'bg-[var(--accent)] hover:scale-110 animate-bot-bounce'}
        `}
        title="Asistente ArbiTrack"
        aria-label="Abrir asistente"
      >
        {open
          ? <X size={22} className="text-[var(--text-primary)]" />
          : <Bot size={22} className="text-white" />
        }
      </button>

      {/* ── Chat panel ── */}
      <div
        className={`fixed bottom-[140px] md:bottom-[90px] right-[20px] z-[199]
          w-[340px] max-h-[480px] rounded-[18px] flex flex-col overflow-hidden
          border border-[var(--border-strong)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]
          bg-[var(--bg-surface-1)] backdrop-blur-[12px]
          transition-all duration-300 origin-bottom-right
          ${open ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[16px] py-[12px] border-b border-[var(--border)] bg-[var(--bg-surface-2)] flex-shrink-0">
          <div className="flex items-center gap-[10px]">
            <div className="w-[32px] h-[32px] rounded-full bg-[var(--accent)] flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-[13px] leading-tight">ARBI</p>
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
              <div className={`
                max-w-[85%] rounded-[14px] px-[12px] py-[10px] text-[12.5px] leading-[1.55]
                ${msg.role === 'user'
                  ? 'bg-[var(--accent)] text-white rounded-br-[4px]'
                  : 'bg-[var(--bg-surface-2)] text-[var(--text-primary)] border border-[var(--border)] rounded-bl-[4px]'
                }
              `}>
                {formatText(msg.text)}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[14px] rounded-bl-[4px] px-[14px] py-[12px] flex gap-[5px] items-center">
                <span className="bot-dot w-[6px] h-[6px] bg-[var(--text-tertiary)] rounded-full" />
                <span className="bot-dot w-[6px] h-[6px] bg-[var(--text-tertiary)] rounded-full" />
                <span className="bot-dot w-[6px] h-[6px] bg-[var(--text-tertiary)] rounded-full" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-[8px] px-[12px] py-[10px] border-t border-[var(--border)] bg-[var(--bg-surface-2)] flex-shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pregunta algo..."
            className="flex-1 bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[10px] text-[13px] px-[12px] py-[8px] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-[36px] h-[36px] rounded-[10px] bg-[var(--accent)] text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </>
  );
};
