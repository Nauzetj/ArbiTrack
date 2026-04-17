import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Layers, DollarSign, Clock, BarChart3, ChevronRight, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { MetricCard } from '../components/ui/MetricCard';
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
  const profitTodayVes = completedToday.reduce((sum, c) => sum + c.ganancia_ves, 0);
  console.log('[Dashboard] profitTodayUsdt:', profitTodayUsdt, 'profitTodayVes:', profitTodayVes);

  const ordersToday = orders.filter(o => new Date(o.createTime_utc) >= todayStart && o.orderStatus === 'COMPLETED');
  const usdtTotalOperated = ordersToday.filter(o => o.tradeType === 'SELL').reduce((sum, o) => sum + o.amount, 0);

  const monthStart = new Date(now.getTime());
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(4, 0, 0, 0); // 4 AM UTC = 12 AM Venezuela
  
  const completedMonth = cycles.filter(c => c.status === 'Completado' && c.closedAt && new Date(c.closedAt) >= monthStart);
  const profitMonthUsdt = completedMonth.reduce((sum, c) => sum + c.ganancia_usdt, 0);

  return (
    <div ref={containerRef} className="flex flex-col gap-[10px] md:gap-[14px] max-w-[1400px] mx-auto min-h-[calc(100vh-80px)]">
      {/* Metric cards: 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[10px]">
        <MetricCard
          title="Ganancia Hoy"
          icon={<DollarSign size={14} />}
          mainValue={profitTodayUsdt}
          subValue={`Bs. ${profitTodayVes.toFixed(2)}`}
          delayMs={0}
        />
        <MetricCard
          title="Ciclos Hoy"
          icon={<Layers size={14} />}
          mainValue={completedToday.length}
          subValue="Completados"
          delayMs={60}
        />
        <MetricCard
          title="Mes (USDT)"
          icon={<AreaChart size={14} />}
          mainValue={profitMonthUsdt}
          subValue="Acumulado"
          delayMs={120}
        />
        <MetricCard
          title="Operado Hoy"
          icon={<Clock size={14} />}
          mainValue={usdtTotalOperated}
          subValue="USDT vendido"
          delayMs={180}
        />
      </div>

      {/* Active Cycle Panel */}
      <div className="active-cycle-panel max-w-full">
        <div className="flex flex-col xl:flex-row gap-[10px] md:gap-[14px]">
          <div className="flex-1 min-w-[0]">
            <ActiveCyclePanel />
          </div>
          <div className="xl:w-[320px] shrink-0 flex flex-col gap-[10px] md:gap-[14px] h-full">
            <div className="flex-1 min-h-[0]">
              <UnassignedOrdersPool />
            </div>
            
            <div className="dashboard-security-notice bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[12px] md:p-[16px] shrink-0">
              <h3 className="font-semibold text-[13px]">Seguridad de datos</h3>
              <p className="text-[12px] md:text-[13px] text-[var(--text-secondary)] mt-[8px]">
                Tus datos están sincronizados en la nube. Las credenciales de Binance se mantienen
                exclusivamente en memoria.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Trigger Button */}
      <button 
        onClick={() => setShowChart(true)}
        className="dashboard-chart w-full bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[16px] flex items-center justify-between hover:bg-[var(--bg-surface-3)] transition-colors group"
      >
        <div className="flex items-center gap-[12px] relative z-10">
          <div className="w-[42px] h-[42px] rounded-[10px] bg-[rgba(37,99,235,0.1)] text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/20">
            <BarChart3 size={20} />
          </div>
          <div className="flex flex-col items-start">
            <h3 className="font-bold text-[14px] text-[var(--text-primary)]">Rendimiento</h3>
            <p className="text-[12px] text-[var(--text-secondary)]">Visualizar gráfico de ganancias acumuladas (7 días)</p>
          </div>
        </div>
        <div className="relative z-10 w-[30px] h-[30px] rounded-full bg-[var(--bg-surface-4)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white text-[var(--text-tertiary)] transition-colors">
          <ChevronRight size={16} />
        </div>
      </button>

      {/* Modal / Caja Flotante de la Gráfica */}
      {showChart && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-[16px]"
          style={{ background: 'rgba(10,20,35,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setShowChart(false)}
        >
          <div 
            className="w-full max-w-[600px] bg-[var(--bg-surface-1)] rounded-[20px] shadow-2xl overflow-hidden border border-[#34d399]/20 relative"
            onClick={e => e.stopPropagation()}
            style={{ boxShadow: '0 0 0 1px rgba(52,211,153,0.1), 0 24px 48px rgba(0,0,0,0.55)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #34d399, transparent)' }}/>
            <div className="flex items-center justify-between p-[20px] border-b border-[var(--border)]">
              <div className="flex items-center gap-[10px]">
                <div className="w-[32px] h-[32px] rounded-[8px] flex items-center justify-center bg-[rgba(52,211,153,0.12)] border border-[#34d399]/25 text-[#34d399]">
                  <BarChart3 size={16}/>
                </div>
                <h2 className="font-bold text-[16px]">Gráfica de Rendimiento</h2>
              </div>
              <button 
                onClick={() => setShowChart(false)}
                className="w-[30px] h-[30px] rounded-full flex items-center justify-center hover:bg-[var(--bg-surface-3)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={16}/>
              </button>
            </div>
            <div className="p-[20px]">
              <MiniChart />
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
