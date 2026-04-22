import React, { useMemo, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';

export const MiniChart: React.FC = () => {
  const { cycles } = useAppStore();

  const chartData = useMemo(() => {
    const daysName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const data = [];
    
    // Calcular "Hoy" inicio del día en UTC (4 AM = 12 AM Venezuela)
    const now = new Date();
    const horaUTC = now.getUTCHours();
    
    let todayStart = new Date(now.getTime());
    if (horaUTC < 4) {
      todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    }
    todayStart.setUTCHours(4, 0, 0, 0);
    todayStart.setUTCMilliseconds(0);
    
    // Generamos los últimos 7 días terminando en "Hoy"
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart.getTime());
      dayStart.setUTCDate(dayStart.getUTCDate() - i);
      
      const dayEnd = new Date(dayStart.getTime());
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      
      // Obtener nombre del día ajustado a zona local (restando offset)
      const localDayRef = new Date(dayStart.getTime() - 4 * 60 * 60 * 1000); 
      const dayLabel = i === 0 ? 'Hoy' : daysName[localDayRef.getUTCDay()];
      
      const dayCycles = cycles.filter(c => {
        if (c.status !== 'Completado' || !c.closedAt) return false;
        const closed = new Date(c.closedAt);
        return closed >= dayStart && closed < dayEnd;
      });
      
      // Aseguramos que sea un número válido y no devuelva NaN
      const dailyProfit = dayCycles.reduce((sum, c) => sum + (Number(c.ganancia_usdt) || 0), 0);
      
      data.push({ day: dayLabel, profit: dailyProfit });
    }
    
    return data;
  }, [cycles]);

  // Si no hay datos, prevé que maxVal no sea NaN (0 || 1)
  const maxVal = Math.max(...chartData.map(d => Math.abs(Number(d.profit) || 0))) * 1.2 || 1;
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[20px] flex flex-col h-full min-h-[220px]">
      <h3 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-[16px]">Ganancias últimos 7 días (USDT)</h3>
      <div className="flex-1 flex items-end justify-between pt-[10px] pb-[4px]">
        {chartData.map((d, i) => {
          const height = Math.max(2, (Math.abs(d.profit) / maxVal) * 100);
          const isProfit = d.profit >= 0;
          return (
            <div key={i} className="flex flex-col items-center gap-[8px] w-[14%] group relative h-full justify-end">
               {/* Tooltip */}
               <div className="absolute top-[calc(100%-10px)] -translate-y-full mb-[100%] opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[4px] px-[6px] py-[4px] text-[10px] mono whitespace-nowrap z-10 pointer-events-none shadow-sm">
                 {d.profit > 0 ? '+' : ''}{Number(d.profit).toFixed(2)}
               </div>
               {/* Bar */}
               <div 
                 className={`chart-bar w-[60%] rounded-t-[4px] transition-all duration-300 opacity-80 group-hover:opacity-100 ${d.profit === 0 ? 'bg-[var(--bg-surface-4)]' : isProfit ? 'bg-[var(--profit)]' : 'bg-[var(--loss)]'}`}
                 style={{ height: d.profit === 0 ? '5px' : `${height}%` }}
               />
               <span className="text-[10px] text-[var(--text-tertiary)]">{d.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
