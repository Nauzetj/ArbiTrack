import React, { useMemo, useState } from 'react';
import type { Cycle } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CycleCalendarProps {
  cycles: Cycle[];
  onDateSelect: (date: string | null) => void;
  selectedDate: string | null;
}

// Returns "YYYY-MM-DD" from an ISO string
const toDateKey = (iso: string | null): string | null => {
  if (!iso) return null;
  return iso.slice(0, 10);
};

const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];
const DAY_NAMES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export const CycleCalendar: React.FC<CycleCalendarProps> = ({ cycles, onDateSelect, selectedDate }) => {
  const [year, setYear] = useState(new Date().getFullYear());

  // Build a map of date -> { profit, loss, pending }
  const dayMap = useMemo(() => {
    const map: Record<string, { profit: boolean; loss: boolean; pending: boolean; count: number }> = {};

    cycles.forEach(c => {
      const openKey = toDateKey(c.openedAt);
      const closeKey = toDateKey(c.closedAt);

      const affectedDays = new Set<string>();
      if (openKey) affectedDays.add(openKey);
      if (closeKey) affectedDays.add(closeKey);

      affectedDays.forEach(day => {
        if (!map[day]) map[day] = { profit: false, loss: false, pending: false, count: 0 };
        map[day].count += 1;
        if (c.status === 'En curso') map[day].pending = true;
        else if (c.status === 'Completado') map[day].profit = true;
        else if (c.status === 'Con pérdida') map[day].loss = true;
      });
    });

    return map;
  }, [cycles]);

  const getDotColor = (info: { profit: boolean; loss: boolean; pending: boolean }) => {
    if (info.profit && info.loss) return '#a78bfa'; // mixed: purple
    if (info.profit) return '#00e5c3';
    if (info.loss) return '#ff4c6a';
    if (info.pending) return '#f59e0b';
    return '';
  };

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[24px]">
        <div>
          <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Calendario de Ciclos</h2>
          <p className="text-[12px] text-[var(--text-tertiary)] mt-[2px]">Días con actividad operativa registrada</p>
        </div>
        <div className="flex items-center gap-[8px]">
          {selectedDate && (
            <button
              onClick={() => onDateSelect(null)}
              className="text-[12px] px-[10px] py-[5px] rounded-[6px] bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)]/20 transition-colors"
            >
              ✕ Filtro: {selectedDate}
            </button>
          )}
          <div className="flex items-center gap-[4px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[8px] px-[4px]">
            <button
              onClick={() => setYear(y => y - 1)}
              className="p-[6px] rounded hover:bg-[var(--bg-surface-4)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[14px] font-semibold px-[8px] text-[var(--text-primary)] min-w-[48px] text-center">{year}</span>
            <button
              onClick={() => setYear(y => y + 1)}
              className="p-[6px] rounded hover:bg-[var(--bg-surface-4)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 12-month grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[16px]">
        {MONTH_NAMES.map((monthName, monthIndex) => {
          const firstDay = new Date(year, monthIndex, 1).getDay(); // 0=Sun
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

          // Count activity in this month
          const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
          const activityCount = Object.keys(dayMap).filter(k => k.startsWith(monthPrefix)).length;

          return (
            <div key={monthIndex} className="bg-[var(--bg-surface-3)] rounded-[10px] p-[12px] border border-[var(--border)]">
              {/* Month header */}
              <div className="flex items-center justify-between mb-[8px]">
                <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-[1px]">{monthName}</span>
                {activityCount > 0 && (
                  <span className="text-[10px] font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-[5px] py-[1px] rounded-full">
                    {activityCount}
                  </span>
                )}
              </div>

              {/* Day labels */}
              <div className="grid grid-cols-7 mb-[4px]">
                {DAY_NAMES.map(d => (
                  <span key={d} className="text-[9px] text-[var(--text-tertiary)] font-medium text-center py-[2px]">{d}</span>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-y-[2px]">
                {/* Empty cells before first day */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, dayIndex) => {
                  const day = dayIndex + 1;
                  const dayKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const info = dayMap[dayKey];
                  const isToday = dayKey === todayKey;
                  const isSelected = dayKey === selectedDate;
                  const hasActivity = !!info;
                  const dotColor = hasActivity ? getDotColor(info) : '';

                  return (
                    <button
                      key={dayKey}
                      onClick={() => hasActivity ? onDateSelect(isSelected ? null : dayKey) : undefined}
                      disabled={!hasActivity}
                      title={hasActivity ? `${info.count} ciclo(s)` : undefined}
                      className={`
                        relative flex flex-col items-center justify-center rounded-[4px] py-[3px] text-[10px] font-medium leading-none transition-all
                        ${isSelected ? 'ring-1 ring-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] scale-110' : ''}
                        ${isToday && !isSelected ? 'ring-1 ring-[var(--text-tertiary)]/50 text-[var(--text-primary)] font-bold' : ''}
                        ${hasActivity && !isSelected ? 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-4)] cursor-pointer' : ''}
                        ${!hasActivity ? 'text-[var(--text-tertiary)] cursor-default' : ''}
                      `}
                    >
                      {day}
                      {hasActivity && (
                        <span
                          className="w-[4px] h-[4px] rounded-full mt-[2px] flex-shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-[20px] mt-[16px] pt-[12px] border-t border-[var(--border)]">
        {[
          { color: '#00e5c3', label: 'Completado con ganancia' },
          { color: '#ff4c6a', label: 'Con pérdida' },
          { color: '#f59e0b', label: 'En curso' },
          { color: '#a78bfa', label: 'Mixto (ganancia + pérdida)' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-[6px]">
            <span className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-[var(--text-tertiary)]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
