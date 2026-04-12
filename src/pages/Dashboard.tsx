import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { AreaChart, Layers, DollarSign, Clock } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { MetricCard } from '../components/ui/MetricCard';
import { ActiveCyclePanel } from '../components/dashboard/ActiveCyclePanel';
import { MiniChart } from '../components/dashboard/MiniChart';
import { RecentCyclesTable } from '../components/dashboard/RecentCyclesTable';
import { UnassignedOrdersPool } from '../components/dashboard/UnassignedOrdersPool';

export const Dashboard: React.FC = () => {
  const { orders, cycles } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.set('.metric-card', { opacity: 0, y: 20 });
    gsap.set('.active-cycle-panel', { opacity: 0, y: 20 });
    gsap.set('.dashboard-chart, .dashboard-security-notice', { opacity: 0, y: 20 });
    gsap.set('.recent-cycles-table', { opacity: 0, y: 20 });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to('.metric-card', { y: 0, opacity: 1, duration: 0.6, stagger: 0.08 })
      .to('.active-cycle-panel', { y: 0, opacity: 1, duration: 0.5 }, '-=0.3')
      .to('.dashboard-chart, .dashboard-security-notice', { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 }, '-=0.3')
      .to('.recent-cycles-table', { y: 0, opacity: 1, duration: 0.5 }, '-=0.2');
  }, { scope: containerRef });


  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const completedToday = cycles.filter(c => c.status === 'Completado' && c.closedAt && new Date(c.closedAt) >= todayStart);
  const profitTodayUsdt = completedToday.reduce((sum, c) => sum + c.ganancia_usdt, 0);
  const profitTodayVes = completedToday.reduce((sum, c) => sum + c.ganancia_ves, 0);

  const ordersToday = orders.filter(o => new Date(o.createTime_utc) >= todayStart && o.orderStatus === 'COMPLETED');
  const usdtTotalOperated = ordersToday.filter(o => o.tradeType === 'SELL').reduce((sum, o) => sum + o.amount, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const completedMonth = cycles.filter(c => c.status === 'Completado' && c.closedAt && new Date(c.closedAt) >= monthStart);
  const profitMonthUsdt = completedMonth.reduce((sum, c) => sum + c.ganancia_usdt, 0);

  return (
    <div ref={containerRef} className="flex flex-col gap-[12px] md:gap-[20px] max-w-[1400px] mx-auto">
      {/* Metric cards: 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[10px] md:gap-[16px]">
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
        <div className="flex flex-col xl:flex-row gap-[12px] md:gap-[20px]">
          <div className="flex-1 min-w-[0]">
            <ActiveCyclePanel />
          </div>
          <div className="xl:w-[320px] shrink-0 h-full">
            <UnassignedOrdersPool />
          </div>
        </div>
      </div>

      {/* Chart + Info: side by side on XL, stacked on mobile */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-[12px] md:gap-[20px]">
        <div className="xl:col-span-7 dashboard-chart">
          <MiniChart />
        </div>
        <div className="xl:col-span-5 dashboard-security-notice bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[16px] md:p-[24px]">
          <h3 className="font-semibold text-[13px] md:text-[14px]">Seguridad de datos</h3>
          <p className="text-[12px] md:text-[13px] text-[var(--text-secondary)] mt-[8px]">
            Tus datos están sincronizados en la nube. Las credenciales de Binance se mantienen
            exclusivamente en memoria durante la sesión y nunca se almacenan en el servidor.
          </p>
        </div>
      </div>

      {/* Recent cycles table */}
      <div className="recent-cycles-table">
        <RecentCyclesTable />
      </div>
    </div>
  );
};
