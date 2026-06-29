import React, { useRef, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { createPortal } from 'react-dom';
import { AreaChart, Layers, Clock, BarChart3, X, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ActiveCyclePanel } from '../components/dashboard/ActiveCyclePanel';
import { MiniChart } from '../components/dashboard/MiniChart';
import { UnassignedOrdersPool } from '../components/dashboard/UnassignedOrdersPool';
import {
  getVenezuelaToday,
  getVenezuelaWeekStart,
  getVenezuelaMonthStart,
  isNewVenezuelaDay,
  isFirstDayOfVenezuelaMonth,
} from '../utils/timeUtils';
import { saveMonthSnapshot, monthSnapshotExists } from '../services/monthSnapshots';
import { getCyclesForUser, getOrdersForUser, getActiveCycleForUser } from '../services/dbOperations';
import toast from 'react-hot-toast';

// ─── Constante: clave localStorage para saber el último día procesado ─────────
const LS_LAST_RESET_DAY = 'arbitrack_last_reset_day';
const LS_LAST_MONTH_SNAP = 'arbitrack_last_month_snap';

export const Dashboard: React.FC = () => {
  const { orders, cycles, currentUser, setCycles, setOrders, setActiveCycle } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [showChart, setShowChart] = useState(false);

  // ─── Estado reactivo del "ahora" — se actualiza cada minuto ────────────────
  const [now, setNow] = useState(() => new Date());

  // ─── Fix puntual del ciclo 2425 ────────────────────────────────────────────
  useEffect(() => {
    const forceFix2425 = async () => {
      const match = cycles.find(c => String(c.cycleNumber).endsWith('2425'));
      if (match && match.closedAt && !match.closedAt.startsWith('2026-05-22')) {
        console.log('Forzando actualización del ciclo 2425 al 22 de mayo...');
        const newClosed = '2026-05-22T23:59:00.000Z';
        const { error } = await supabase.from('cycles').update({ closed_at: newClosed }).eq('id', match.id);
        if (error) {
           alert("ERROR ACTUALIZANDO: " + error.message + " -> Por favor, ejecuta el script en Supabase manualmente.");
        } else {
           window.location.reload();
        }
      }
    };
    if (cycles.length > 0) forceFix2425();
  }, [cycles]);

  // ─── Función para refrescar los datos desde Supabase ──────────────────────
  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [fc, fo, fa] = await Promise.all([
        getCyclesForUser(currentUser.id),
        getOrdersForUser(currentUser.id),
        getActiveCycleForUser(currentUser.id),
      ]);
      setCycles(fc);
      setOrders(fo);
      setActiveCycle(fa);
    } catch (e) {
      console.error('[Dashboard] Error al refrescar datos:', e);
    }
  }, [currentUser, setCycles, setOrders, setActiveCycle]);

  // ─── Lógica de cierre de mes ───────────────────────────────────────────────
  const checkAndSaveMonthSnapshot = useCallback(async (currentNow: Date) => {
    if (!currentUser || cycles.length === 0) return;

    // Solo se ejecuta si es el primer día del mes
    if (!isFirstDayOfVenezuelaMonth(currentNow)) return;

    const { getPrevVenezuelaYearMonth } = await import('../utils/timeUtils');
    const prevYearMonth = getPrevVenezuelaYearMonth(currentNow);

    // Evitar guardar duplicados (verificamos localStorage + DB)
    const lsKey = `${LS_LAST_MONTH_SNAP}_${currentUser.id}`;
    const lastSnap = localStorage.getItem(lsKey);
    if (lastSnap === prevYearMonth) {
      console.log(`[MonthSnapshot] Snapshot ${prevYearMonth} ya procesado localmente.`);
      return;
    }

    // Verificar en DB si ya existe
    const alreadyExists = await monthSnapshotExists(currentUser.id, prevYearMonth);
    if (alreadyExists) {
      localStorage.setItem(lsKey, prevYearMonth);
      console.log(`[MonthSnapshot] Snapshot ${prevYearMonth} ya existe en DB.`);
      return;
    }

    // ¡Nuevo mes! Guardar snapshot del mes anterior
    console.log(`[MonthSnapshot] 🗓️ Primer día del mes. Guardando snapshot de ${prevYearMonth}...`);
    toast.loading(`Guardando resumen de ${prevYearMonth}...`, { id: 'month-snap' });

    const result = await saveMonthSnapshot(currentUser.id, cycles, currentNow);

    if (result.saved) {
      localStorage.setItem(lsKey, prevYearMonth);
      toast.success(
        `✅ Resumen de ${prevYearMonth} guardado: +${result.snapshot.profitUsdt?.toFixed(2)} USDT en ${result.snapshot.totalCycles} ciclos`,
        { id: 'month-snap', duration: 6000 }
      );
    } else {
      toast.error(`Error guardando resumen de ${prevYearMonth}`, { id: 'month-snap' });
    }
  }, [currentUser, cycles]);

  // ─── Lógica de reset diario a las 12 AM Venezuela ─────────────────────────
  const checkDailyReset = useCallback(async (currentNow: Date) => {
    if (!currentUser) return;

    if (!isNewVenezuelaDay(currentNow)) return;

    // Evitar resetear múltiples veces el mismo día
    const todayKey = getVenezuelaToday(currentNow).toISOString().slice(0, 10);
    const lsKey = `${LS_LAST_RESET_DAY}_${currentUser.id}`;
    const lastReset = localStorage.getItem(lsKey);

    if (lastReset === todayKey) {
      console.log(`[DailyReset] Reset del ${todayKey} ya procesado.`);
      return;
    }

    // Primero verificar si hay que guardar snapshot de fin de mes
    await checkAndSaveMonthSnapshot(currentNow);

    // Marcar el reset como procesado
    localStorage.setItem(lsKey, todayKey);
    console.log(`[DailyReset] 🌅 Nuevo día Venezuela (${todayKey}). Refrescando datos...`);

    // Refrescar datos desde Supabase para mostrar el nuevo día limpio
    await refreshData();

    toast.success('¡Nuevo día! Contadores reiniciados a las 12:00 AM 🌅', { duration: 4000 });
  }, [currentUser, checkAndSaveMonthSnapshot, refreshData]);

  // ─── Intervalo cada 30 segundos: actualizar `now` y chequear reset ─────────
  useEffect(() => {
    const tick = async () => {
      const currentNow = new Date();
      setNow(currentNow);
      await checkDailyReset(currentNow);
    };

    // Ejecutar inmediatamente al montar
    tick();

    // Luego cada 30 segundos
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [checkDailyReset]);

  // ─── Verificar cierre de mes al cargar (si la app estuvo cerrada) ──────────
  useEffect(() => {
    if (!currentUser || cycles.length === 0) return;

    const currentNow = new Date();
    // Si es el primer día del mes, verificar snapshot independientemente del horario
    if (isFirstDayOfVenezuelaMonth(currentNow)) {
      checkAndSaveMonthSnapshot(currentNow);
    }
  }, [currentUser, cycles.length, checkAndSaveMonthSnapshot]);

  // ─── Cálculos del Dashboard usando `now` reactivo ─────────────────────────

  const todayStart = getVenezuelaToday(now);
  const weekStart  = getVenezuelaWeekStart(now);
  const monthStart = getVenezuelaMonthStart(now);

  console.log('[Dashboard] todayStart UTC:', todayStart.toISOString());

  // Ciclos completados hoy (closedAt >= inicio del día Venezuela)
  const completedToday = cycles.filter(c =>
    c.status && c.status.toLowerCase() !== 'en curso' &&
    c.closedAt && new Date(c.closedAt) >= todayStart
  );
  console.log('[Dashboard] Ciclos completados hoy:', completedToday.length);

  const profitTodayUsdt = completedToday.reduce((sum, c) => sum + (c.ganancia_usdt ?? 0), 0);
  const profitTodayVes  = completedToday.reduce((sum, c) => sum + (c.ganancia_usdt * (c.tasa_compra_prom || 1)), 0);

  // Órdenes de hoy
  const ordersToday = orders.filter(o => {
    if (o.orderStatus !== 'COMPLETED') return false;
    return new Date(o.createTime_utc) >= todayStart;
  });

  // Volumen USDT operado hoy (ventas)
  const usdtTotalOperated = ordersToday
    .filter(o => o.tradeType === 'SELL')
    .reduce((sum, o) => sum + Math.max(o.amount - (o.commission ?? 0), 0), 0);

  // Semana
  const completedWeek = cycles.filter(c =>
    c.status && c.status.toLowerCase() !== 'en curso' &&
    c.closedAt && new Date(c.closedAt) >= weekStart
  );
  const profitWeekUsdt = completedWeek.reduce((sum, c) => sum + (c.ganancia_usdt ?? 0), 0);

  // Mes
  const completedMonth = cycles.filter(c =>
    c.status && c.status.toLowerCase() !== 'en curso' &&
    c.closedAt && new Date(c.closedAt) >= monthStart
  );
  const profitMonthUsdt = completedMonth.reduce((sum, c) => sum + (c.ganancia_usdt ?? 0), 0);

  return (
    <div ref={containerRef} className="flex flex-col lg:flex-row gap-[24px] lg:gap-[32px] max-w-[1200px] mx-auto min-h-[calc(100vh-80px)] pb-[80px]">
      
      {/* ── COLUMNA IZQUIERDA (Balance & Métricas) ── */}
      <div className="w-full lg:w-[35%] flex flex-col gap-[24px]">
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
        <div className="flex items-start justify-center gap-[24px] md:gap-[32px] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
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

        {/* ── 3. MÉTRICAS SECUNDARIAS (Flat Dark Cards) ── */}
        <div className="grid grid-cols-2 gap-[12px] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="bg-[var(--bg-surface-2)] rounded-[20px] p-[20px] border border-[var(--border-strong)] flex flex-col gap-[8px]">
             <div className="flex items-center gap-[8px] text-[var(--text-tertiary)]">
               <Layers size={16} />
               <span className="text-[13px] font-medium">Ciclos Hoy</span>
             </div>
             <p className="text-[24px] font-bold text-[var(--text-primary)]">
               {completedToday.length}
               <span className="text-[10px] text-[var(--text-tertiary)] ml-2">({completedToday.map(c => c.cycleNumber).join(', ')})</span>
             </p>
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
      </div>

      {/* ── COLUMNA DERECHA (Ciclo Activo & Órdenes) ── */}
      <div className="w-full lg:w-[65%] flex flex-col gap-[24px] mt-[16px] lg:mt-[24px]">
        {/* ── 4. CICLO ACTIVO (Banner Central) ── */}
        <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <ActiveCyclePanel />
        </div>

        {/* ── 5. ÓRDENES SIN ASIGNAR ── */}
        <div className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <UnassignedOrdersPool />
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
            className="w-full max-w-[600px] bg-[var(--bg-surface-1)] text-[var(--text-primary)] rounded-[24px] shadow-2xl overflow-hidden border border-[var(--border-strong)] relative"
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
