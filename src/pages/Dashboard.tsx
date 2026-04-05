import React, { useEffect } from 'react';
import { AreaChart, Layers, DollarSign, Clock } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { MetricCard } from '../components/ui/MetricCard';
import { ActiveCyclePanel } from '../components/dashboard/ActiveCyclePanel';
import { MiniChart } from '../components/dashboard/MiniChart';
import { RecentCyclesTable } from '../components/dashboard/RecentCyclesTable';
import { getOrdersForUser, getCyclesForUser, recalculateCycleMetrics } from '../services/dbOperations';

export const Dashboard: React.FC = () => {
  const { currentUser, setOrders, orders, setCycles, setActiveCycle, cycles } = useAppStore();

  useEffect(() => {
    if (currentUser) {
      const userOrders = getOrdersForUser(currentUser.id);
      let userCycles = getCyclesForUser(currentUser.id);
      
      const active = userCycles.find(c => c.status === 'En curso');
      if (active) {
         // Forzamos un recálculo para limpiar errores pasados de la BD local (órdenes TRADING/PENDING contadas)
         // usando la nueva lógica que solo suma órdenes 'COMPLETED'.
         recalculateCycleMetrics(active.id, currentUser.id);
         
         // Fetch fresh after recalc
         userCycles = getCyclesForUser(currentUser.id);
      }
      
      setOrders(userOrders);
      setCycles(userCycles);
      
      const updatedActive = userCycles.find(c => c.status === 'En curso');
      setActiveCycle(updatedActive || null);
    }
  }, [currentUser]);

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  
  const completedToday = cycles.filter(c => c.status === 'Completado' && c.closedAt && new Date(c.closedAt) >= todayStart);
  
  const profitTodayUsdt = completedToday.reduce((sum, c) => sum + c.ganancia_usdt, 0);
  const profitTodayVes = completedToday.reduce((sum, c) => sum + c.ganancia_ves, 0);
  
  const ordersToday = orders.filter(o => new Date(o.createTime_utc) >= todayStart && o.orderStatus === 'COMPLETED');
  const usdtTotalOperated = ordersToday.filter(o => o.tradeType === 'SELL').reduce((sum, o) => sum + o.amount, 0);
  
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0,0,0,0);
  const completedMonth = cycles.filter(c => c.status === 'Completado' && c.closedAt && new Date(c.closedAt) >= monthStart);
  const profitMonthUsdt = completedMonth.reduce((sum, c) => sum + c.ganancia_usdt, 0);

  return (
    <div className="flex flex-col gap-[20px] max-w-[1400px] mx-auto pb-[40px]">
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-[16px]">
        <MetricCard 
          title="Ganancia Hoy (USDT)" 
          icon={<DollarSign size={16} />}
          mainValue={profitTodayUsdt}
          subValue={`Bs. ${profitTodayVes.toFixed(2)} VES`}
          delayMs={0}
        />
        <MetricCard 
          title="Ciclos Completados (Hoy)" 
          icon={<Layers size={16} />}
          mainValue={completedToday.length}
          subValue="En este dispositivo"
          delayMs={80}
        />
        <MetricCard 
          title="Ganancia del Mes" 
          icon={<AreaChart size={16} />}
          mainValue={profitMonthUsdt}
          subValue="Días acumulados"
          delayMs={160}
        />
        <MetricCard 
          title="USDT Total Operado Hoy" 
          icon={<Clock size={16} />}
          mainValue={usdtTotalOperated}
          delayMs={240}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-[20px]">
        <div className="xl:col-span-7 flex flex-col gap-[20px] min-h-[0]">
          <div className="flex-none">
             <ActiveCyclePanel />
          </div>
        </div>

        <div className="xl:col-span-5 flex flex-col gap-[20px] min-h-[0]">
          <div className="flex-none">
            <MiniChart />
          </div>
          
          <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px] flex-1 animate-fade-in-up delay-200 min-h-[120px]">
            <h3 className="font-semibold text-[14px]">Información Adicional</h3>
            <p className="text-[13px] text-[var(--text-secondary)] mt-[8px]">
              Tus credenciales de Binance están aisladas en memoria y el procesamiento ocurre localmente. Recuerda hacer "Sincronizar" al completar tus últimas órdenes para mantener los números del panel en tiempo real.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full flex-none block">
        <RecentCyclesTable />
      </div>

    </div>
  );
};
