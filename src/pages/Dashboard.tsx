import React, { useEffect } from 'react';
import { AreaChart, Layers, DollarSign, Clock } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { MetricCard } from '../components/ui/MetricCard';
import { ActiveCyclePanel } from '../components/dashboard/ActiveCyclePanel';
import { MiniChart } from '../components/dashboard/MiniChart';
import { RecentCyclesTable } from '../components/dashboard/RecentCyclesTable';
import { getCyclesForUser, recalculateCycleMetrics } from '../services/dbOperations';

export const Dashboard: React.FC = () => {
  const { currentUser, orders, setCycles, setActiveCycle, cycles, activeCycle } = useAppStore();

  useEffect(() => {
    // AppLayout ya hidrata orders y cycles al montar. Aquí solo recalculamos
    // el ciclo activo si existe (por si llegaron órdenes nuevas desde el sync).
    if (!currentUser || !activeCycle) return;

    const refreshActiveCycle = async () => {
      try {
        await recalculateCycleMetrics(activeCycle.id, currentUser.id);
        const updatedCycles = await getCyclesForUser(currentUser.id);
        setCycles(updatedCycles);
        setActiveCycle(updatedCycles.find(c => c.status === 'En curso') || null);
      } catch (err) {
        console.error('Error recalculando ciclo activo:', err);
      }
    };

    refreshActiveCycle();
  // Solo se ejecuta cuando cambia el ciclo activo (nuevo ciclo abierto, etc.)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, activeCycle?.id]);

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
    <div className="flex flex-col gap-[12px] md:gap-[20px] max-w-[1400px] mx-auto">
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
      <ActiveCyclePanel />

      {/* Chart + Info: side by side on XL, stacked on mobile */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-[12px] md:gap-[20px]">
        <div className="xl:col-span-7">
          <MiniChart />
        </div>
        <div className="xl:col-span-5 bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[16px] md:p-[24px] animate-fade-in-up">
          <h3 className="font-semibold text-[13px] md:text-[14px]">Seguridad de datos</h3>
          <p className="text-[12px] md:text-[13px] text-[var(--text-secondary)] mt-[8px]">
            Tus datos están sincronizados en la nube. Las credenciales de Binance se mantienen
            exclusivamente en memoria durante la sesión y nunca se almacenan en el servidor.
          </p>
        </div>
      </div>

      {/* Recent cycles table */}
      <RecentCyclesTable />
    </div>
  );
};
