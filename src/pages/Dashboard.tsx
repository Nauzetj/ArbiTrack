import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Layers, Clock, BarChart3, X, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ActiveCyclePanel } from '../components/dashboard/ActiveCyclePanel';
import { MiniChart } from '../components/dashboard/MiniChart';
import { UnassignedOrdersPool } from '../components/dashboard/UnassignedOrdersPool';

export const Dashboard: React.FC = () => {
  const { orders, cycles } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [showChart, setShowChart] = useState(false);



// FIX: "Hoy" empieza a las 12 AM Venezuela = 4 AM UTC
  const now = new Date(); 
  const horaUTC = now.getUTCHours(); // Usar getUTCHours() para evitar problemas de timezone
  console.log('[Dashboard] Hora UTC:', horaUTC, 'now:', now.toISOString());
  
  // Calcular inicio del día en UTC (4 AM = 12 AM Venezuela)
  let todayStart = new Date(now.getTime());
  
  // Si son las 00-03 UTC (8 PM - 11:59 PM Venezuela del día anterior)
  if (horaUTC < 4) {
    todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    todayStart.setUTCHours(4, 0, 0, 0);
  } else {
    todayStart.setUTCHours(4, 0, 0, 0);
  }
  
  console.log('[Dashboard] todayStart UTC:', todayStart.toISOString());
  
  // Filtrar ciclos de hoy
  const completedToday = cycles.filter(c => c.status === 'Completado' && c.closedAt && new Date(c.closedAt) >= todayStart);
  console.log('[Dashboard] Ciclos completados hoy:', completedToday.length);
  console.log('[Dashboard] Detalles ciclos:', completedToday.map(c => ({
    num: c.cycleNumber,
    closedAt: c.closedAt,
    ganancia_usdt: c.ganancia_usdt,
    ganancia_ves: c.ganancia_ves,
    tasa_venta: c.tasa_venta_prom,
    tasa_compra: c.tasa_compra_prom
  })));
  
  const profitTodayUsdt = completedToday.reduce((sum, c) => sum + c.ganancia_usdt, 0);
  const profitTodayVes = completedToday.reduce((sum, c) => sum + (c.ganancia_usdt * (c.tasa_compra_prom || 1)), 0);
  console.log('[Dashboard] profitTodayUsdt:', profitTodayUsdt, 'profitTodayVes:', profitTodayVes);

  const ordersToday = orders.filter(o => new Date(o.createTime_utc) >= todayStart && o.orderStatus === 'COMPLETED');
  // ✅ USDT neto real = amount - commission (lo que realmente se entregó/recibió)
  const usdtTotalOperated = ordersToday.filter(o => o.tradeType === 'SELL').reduce((sum, o) => sum + Math.max(o.amount - (o.commission ?? 0), 0), 0);

  const monthStart = new Date(todayStart.getTime());
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(4, 0, 0, 0); // 4 AM UTC = 12 AM Venezuela
  
  const completedMonth = cycles.filter(c => c.status === 'Completado' && c.closedAt && new Date(c.closedAt) >= monthStart);
  const profitMonthUsdt = completedMonth.reduce((sum, c) => sum + c.ganancia_usdt, 0);

  // Semana
  const currentDayOfWeek = todayStart.getUTCDay(); // 0 es Domingo
  const weekStart = new Date(todayStart.getTime());
  weekStart.setUTCDate(weekStart.getUTCDate() - currentDayOfWeek);
  
  const completedWeek = cycles.filter(c => c.status === 'Completado' && c.closedAt && new Date(c.closedAt) >= weekStart);
  const profitWeekUsdt = completedWeek.reduce((sum, c) => sum + c.ganancia_usdt, 0);

  return (
    <div ref={containerRef} className="flex flex-col gap-[20px] md:gap-[24px] max-w-[800px] mx-auto min-h-[calc(100vh-80px)] pb-[80px]">
      
      {/* ── 1. HERO: Saldo Principal (Ganancia Hoy) ── */}
      <div className="flex flex-col items-center justify-center pt-[24px] pb-[16px] animate-fade-in-up">
        <p className="text-[14px] text-[var(--text-secondary)] font-medium mb-[8px]">Ganancia Hoy</p>
        <h1 className="text-[52px] md:text-[64px] font-bold text-[var(--text-primary)] leading-none tracking-tighter flex items-center gap-[4px]">
          {profitTodayUsdt > 0 && <span className="text-[36px] md:text-[44px] text-[var(--profit)]">+</span>}
          {profitTodayUsdt === 0 ? '$0.00' : `${profitTodayUsdt.toFixed(2)}`}
        </h1>
        <p className="text-[14px] text-[var(--text-tertiary)] font-mono mt-[8px]">
          ≈ Bs.S {profitTodayVes.toFixed(2)}
        </p>
      </div>

      {/* ── 2. ACCIONES RÁPIDAS (Quick Actions Grid) ── */}
      <div className="flex items-start justify-center gap-[24px] md:gap-[48px] mb-[24px] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <button 
          onClick={() => {
            const btn = document.querySelector('button[title="Sincronizar con Binance"]') as HTMLButtonElement;
            if (btn) btn.click();
          }}
          className="flex flex-col items-center gap-[10px] group"
        >
          <div className="w-[56px] h-[56px] rounded-[18px] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] flex items-center justify-center group-hover:bg-[var(--bg-surface-3)] group-hover:border-[var(--accent)] transition-all">
             <RefreshCw size={22} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
          </div>
          <span className="text-[12px] font-medium text-[var(--text-secondary)]">Sincronizar</span>
        </button>

        <button 
          onClick={() => {
            const botBtn = document.getElementById('assistant-bot-trigger');
            if (botBtn) botBtn.click();
          }}
          className="flex flex-col items-center gap-[10px] group"
        >
          <div className="w-[56px] h-[56px] rounded-[18px] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] flex items-center justify-center group-hover:bg-[var(--bg-surface-3)] group-hover:text-[var(--accent)] transition-all">
             <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
          </div>
          <span className="text-[12px] font-medium text-[var(--text-secondary)]">Soporte</span>
        </button>

        <button 
          onClick={() => setShowChart(true)}
          className="flex flex-col items-center gap-[10px] group"
        >
          <div className="w-[56px] h-[56px] rounded-[18px] border border-[var(--border-strong)] bg-[var(--bg-surface-2)] flex items-center justify-center group-hover:bg-[var(--bg-surface-3)] group-hover:border-[var(--accent)] transition-all">
             <BarChart3 size={22} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
          </div>
          <span className="text-[12px] font-medium text-[var(--text-secondary)]">Rendimiento</span>
        </button>

      </div>

      {/* ── 3. CICLO ACTIVO (Banner Central) ── */}
      <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <ActiveCyclePanel />
      </div>

      {/* ── 4. ÓRDENES SIN ASIGNAR ── */}
      <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <UnassignedOrdersPool />
      </div>

      {/* ── 5. MÉTRICAS SECUNDARIAS (Flat Dark Cards) ── */}
      <div className="grid grid-cols-2 gap-[12px] mt-[16px] animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <div className="bg-[var(--bg-surface-2)] rounded-[20px] p-[20px] border border-[var(--border-strong)] flex flex-col gap-[8px]">
           <div className="flex items-center gap-[8px] text-[var(--text-tertiary)]">
             <Layers size={16} />
             <span className="text-[13px] font-medium">Ciclos Hoy</span>
           </div>
           <p className="text-[24px] font-bold text-[var(--text-primary)]">{completedToday.length}</p>
        </div>
        <div className="bg-[var(--bg-surface-2)] rounded-[20px] p-[20px] border border-[var(--border-strong)] flex flex-col gap-[8px]">
           <div className="flex items-center gap-[8px] text-[var(--text-tertiary)]">
             <BarChart3 size={16} />
             <span className="text-[13px] font-medium">Semana</span>
           </div>
           <p className="text-[24px] font-bold text-[var(--text-primary)] text-[var(--profit)]">+{profitWeekUsdt.toFixed(2)}</p>
        </div>
        <div className="bg-[var(--bg-surface-2)] rounded-[20px] p-[20px] border border-[var(--border-strong)] flex flex-col gap-[8px]">
           <div className="flex items-center gap-[8px] text-[var(--text-tertiary)]">
             <AreaChart size={16} />
             <span className="text-[13px] font-medium">Mes Actual</span>
           </div>
           <p className="text-[24px] font-bold text-[var(--text-primary)] text-[var(--profit)]">+{profitMonthUsdt.toFixed(2)}</p>
        </div>
        <div className="bg-[var(--bg-surface-2)] rounded-[20px] p-[20px] border border-[var(--border-strong)] flex flex-col gap-[8px]">
           <div className="flex items-center gap-[8px] text-[var(--text-tertiary)]">
             <Clock size={16} />
             <span className="text-[13px] font-medium">Vol. Diario</span>
           </div>
           <p className="text-[24px] font-bold text-[var(--text-primary)]">{usdtTotalOperated.toFixed(2)} <span className="text-[14px] text-[var(--text-secondary)] font-normal">USDT</span></p>
        </div>
      </div>

      {/* Modal / Caja Flotante de la Gráfica */}
      {showChart && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-[16px] animate-fade-in-up"
          style={{ background: 'rgba(5, 5, 8, 0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setShowChart(false)}
        >
          <div 
            className="w-full max-w-[600px] bg-[var(--bg-surface-1)] rounded-[24px] shadow-2xl overflow-hidden border border-[var(--border-strong)] relative"
            onClick={e => e.stopPropagation()}
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }}/>
            <div className="flex items-center justify-between p-[24px] border-b border-[var(--border)]">
              <div className="flex items-center gap-[12px]">
                <div className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center bg-[var(--accent-muted)] text-[var(--accent)]">
                  <BarChart3 size={18}/>
                </div>
                <h2 className="font-bold text-[18px]">Gráfica de Rendimiento</h2>
              </div>
              <button 
                onClick={() => setShowChart(false)}
                className="w-[36px] h-[36px] rounded-full flex items-center justify-center hover:bg-[var(--bg-surface-3)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={18}/>
              </button>
            </div>
            <div className="p-[24px]">
              <MiniChart />
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
