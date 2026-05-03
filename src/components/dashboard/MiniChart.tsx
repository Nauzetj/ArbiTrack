import React, { useMemo, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';

export const MiniChart: React.FC = () => {
  const { cycles } = useAppStore();

  const chartData = useMemo(() => {
    const daysName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const data = [];
    
    const now = new Date();
    const horaUTC = now.getUTCHours();
    
    let todayStart = new Date(now.getTime());
    if (horaUTC < 4) {
      todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    }
    todayStart.setUTCHours(4, 0, 0, 0);
    todayStart.setUTCMilliseconds(0);
    
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart.getTime());
      dayStart.setUTCDate(dayStart.getUTCDate() - i);
      
      const dayEnd = new Date(dayStart.getTime());
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      
      const localDayRef = new Date(dayStart.getTime() - 4 * 60 * 60 * 1000); 
      const dayLabel = i === 0 ? 'Hoy' : daysName[localDayRef.getUTCDay()];
      
      const dayCycles = cycles.filter(c => {
        if (c.status !== 'Completado' || !c.closedAt) return false;
        const closed = new Date(c.closedAt);
        return closed >= dayStart && closed < dayEnd;
      });
      
      const dailyProfit = dayCycles.reduce((sum, c) => {
        const val = Number(c.ganancia_usdt);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
      
      data.push({ day: dayLabel, profit: isNaN(dailyProfit) ? 0 : dailyProfit });
    }
    
    return data;
  }, [cycles]);

  const rawMax = Math.max(...chartData.map(d => Math.abs(d.profit)));
  const maxVal = (isNaN(rawMax) || rawMax === 0) ? 1 : rawMax * 1.2;
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[20px] flex flex-col min-h-[240px]">
      <h3 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-[16px]">Ganancias últimos 7 días (USDT)</h3>
      <div className="h-[140px] flex items-end justify-between pt-[10px] pb-[4px]">
        {chartData.map((d, i) => {
          let heightVal = (Math.abs(d.profit) / maxVal) * 100;
          if (isNaN(heightVal)) heightVal = 0;
          const finalHeight = Math.max(2, heightVal);
          const isProfit = d.profit >= 0;
          
          return (
            <div key={i} className="flex flex-col items-center gap-[8px] w-[14%] group relative h-full justify-end">
               <div className="absolute top-auto bottom-full mb-[8px] opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-surface-3)] text-[var(--text-primary)] border border-[var(--border-strong)] rounded-[4px] px-[6px] py-[4px] text-[10px] mono whitespace-nowrap z-10 pointer-events-none shadow-sm">
                 {d.profit > 0 ? '+' : ''}{Number(d.profit).toFixed(2)}
               </div>
               <div 
                 className="chart-bar w-[60%] rounded-t-[4px] transition-all duration-300 opacity-80 group-hover:opacity-100"
                 style={{ 
                   height: d.profit === 0 ? '5px' : `${finalHeight}%`,
                   backgroundColor: d.profit === 0 ? 'var(--bg-surface-4)' : isProfit ? 'var(--profit)' : 'var(--loss)'
                 }}
               />
               <span className="text-[10px] text-[var(--text-tertiary)]">{d.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
