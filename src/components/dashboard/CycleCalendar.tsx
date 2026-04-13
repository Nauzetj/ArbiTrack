import React, { useMemo, useState, useEffect } from 'react';
import type { Cycle, Order } from '../../types';
import { ChevronLeft, ChevronRight, ListFilter, Activity, TrendingUp, TrendingDown, DollarSign, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface CycleCalendarProps {
  cycles: Cycle[];
  onDateSelect: (date: string | null) => void;
  selectedDate: string | null;
}

// Returns "YYYY-MM-DD" adjusted to the user's local time zone
const toDateKey = (val: string | number | null | Date): string | null => {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];
const DAY_NAMES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

interface DayInfo {
  profitSum: number;
  orders: Order[];
  cyclesOpened: Cycle[];
  cyclesClosed: Cycle[];
}

export const CycleCalendar: React.FC<CycleCalendarProps> = ({ cycles, onDateSelect: _onDateSelect, selectedDate: _selectedDate }) => {
  const { orders } = useAppStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const [detailsDate, setDetailsDate] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Keyboard escape handler for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailsDate(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Build a map of date -> DayInfo
  const dayMap = useMemo(() => {
    const map: Record<string, DayInfo> = {};
    const ensureDay = (d: string) => {
      if (!map[d]) map[d] = { profitSum: 0, orders: [], cyclesOpened: [], cyclesClosed: [] };
    };

    // Process Cycles
    cycles.forEach(c => {
      const openKey = toDateKey(c.openedAt);
      const closeKey = toDateKey(c.closedAt);
      
      if (openKey) {
        ensureDay(openKey);
        map[openKey].cyclesOpened.push(c);
      }
      
      if (closeKey && c.status !== 'En curso') {
        ensureDay(closeKey);
        // Avoid duplicate counting if opening and closing are same day (though cycles arrays can have duplicates, that's fine, profitSum is what matters)
        map[closeKey].cyclesClosed.push(c);
        map[closeKey].profitSum += c.ganancia_usdt;
      }
    });

    // Process Orders
    orders.filter(o => o.orderStatus === 'COMPLETED').forEach(o => {
      const oKey = toDateKey(o.createTime_utc);
      if (oKey) {
        ensureDay(oKey);
        map[oKey].orders.push(o);
      }
    });

    return map;
  }, [cycles, orders]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const closeDetailsModal = () => {
    setDetailsDate(null);
    setExpandedOrderId(null);
  };

  const renderDayDetailsModal = () => {
    if (!detailsDate) return null;
    const info = dayMap[detailsDate];
    if (!info) return null;

    // Localized date formatting for the header
    const dateObj = new Date(`${detailsDate}T12:00:00Z`); // Mock time to avoid timezone shift
    const displayDate = dateObj.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
      <div className="fixed inset-0 bg-transparent flex justify-center z-[100] pt-[60px] sm:pt-[8vh] px-[16px]" onClick={closeDetailsModal}>
        <div className="bg-[var(--bg-surface-1)] rounded-[20px] border border-[var(--border-strong)] max-w-[600px] w-full max-h-[85vh] overflow-hidden flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
          
          {/* Header */}
          <div className="p-[24px] border-b border-[var(--border)] relative bg-[var(--bg-surface-2)] shrink-0">
            <button onClick={closeDetailsModal} className="absolute top-[20px] right-[20px] p-[8px] rounded-[8px] hover:bg-[var(--bg-surface-3)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
              <X size={18} />
            </button>
            <h3 className="text-[18px] font-bold text-[var(--text-primary)] capitalize">{displayDate}</h3>
            
            <div className="flex gap-[16px] mt-[16px]">
              <div className="flex flex-col bg-[var(--bg-surface-1)] px-[16px] py-[10px] rounded-[10px] border border-[var(--border-strong)] shadow-sm">
                <span className="text-[11px] text-[var(--text-tertiary)] uppercase font-semibold">Resumen P&L</span>
                <div className={`text-[18px] font-bold mono flex items-center gap-[4px] ${info.profitSum > 0 ? 'text-[var(--profit)]' : info.profitSum < 0 ? 'text-[var(--loss)]' : 'text-[var(--text-primary)]'}`}>
                  {info.profitSum > 0 ? <TrendingUp size={16} /> : info.profitSum < 0 ? <TrendingDown size={16} /> : <DollarSign size={16} />}
                  {info.profitSum > 0 ? '+' : ''}{info.profitSum.toFixed(2)} USDT
                </div>
              </div>
              <div className="flex flex-col bg-[var(--bg-surface-1)] px-[16px] py-[10px] rounded-[10px] border border-[var(--border-strong)] shadow-sm">
                <span className="text-[11px] text-[var(--text-tertiary)] uppercase font-semibold">Órdenes</span>
                <div className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-[6px]">
                  <Activity size={16} className="text-[var(--text-tertiary)]" />
                  {info.orders.length}
                </div>
              </div>
            </div>
          </div>

          {/* List Area */}
          <div className="p-[20px] overflow-y-auto custom-scrollbar bg-[var(--bg-surface-1)] relative flex-1 min-h-0">
            <h4 className="text-[13px] font-bold text-[var(--text-secondary)] mb-[12px] flex items-center gap-[8px]">
              <ListFilter size={14} /> Operaciones del Día
            </h4>
            
            {info.orders.length === 0 ? (
              <div className="text-center py-[40px] text-[var(--text-tertiary)] text-[13px]">
                No hubo transacciones completadas este día.
              </div>
            ) : (
              <div className="flex flex-col gap-[8px]">
                {info.orders.sort((a,b) => new Date(b.createTime_utc).getTime() - new Date(a.createTime_utc).getTime()).map(o => (
                  <div key={o.id} className="flex flex-col bg-[var(--bg-surface-2)] rounded-[10px] border border-[var(--border)] transition-colors hover:border-[var(--accent-border)] overflow-hidden">
                    <button 
                      onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}
                      className="flex items-center justify-between p-[12px] w-full text-left"
                    >
                      <div className="flex items-center gap-[12px]">
                        <div className={`w-[6px] h-[36px] rounded-full shrink-0 ${o.tradeType === 'BUY' ? 'bg-[var(--profit)]' : 'bg-[var(--loss)]'}`} />
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-[var(--text-primary)]">{o.tradeType === 'BUY' ? 'Compra' : 'Venta'} a {o.counterPartNickName}</span>
                          <span className="text-[11px] text-[var(--text-tertiary)] mono">{new Date(o.createTime_utc).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 ml-[8px]">
                        <span className="font-mono font-bold text-[14px] text-[var(--text-primary)]">{o.amount.toFixed(2)} USDT</span>
                        <span className="text-[11px] text-[var(--text-secondary)]">@ {o.unitPrice.toFixed(2)} VES</span>
                      </div>
                    </button>
                    {expandedOrderId === o.id && (
                      <div className="p-[12px] pt-[4px] border-t border-[var(--border)] bg-[var(--bg-surface-2)]">
                        <div className="grid grid-cols-2 gap-y-[12px] gap-x-[8px] mt-[4px]">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-wider">N° Orden</span>
                            <span className="text-[12px] font-mono text-[var(--text-secondary)] break-all mt-[2px]">{o.orderNumber || 'N/A'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-wider">Total Fiat</span>
                            <span className="text-[12px] font-mono text-[var(--text-secondary)] mt-[2px]">{o.totalPrice.toFixed(2)} {o.fiat}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-wider">Comisión</span>
                            <span className="text-[12px] font-mono text-[var(--text-secondary)] mt-[2px]">{o.commission.toFixed(4)} {o.commissionAsset}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-wider">Plataforma</span>
                            <span className="text-[12px] font-mono text-[var(--text-secondary)] capitalize mt-[2px]">{o.exchange || 'Binance'}</span>
                          </div>
                        </div>
                        {o.notas && (
                          <div className="mt-[12px] flex flex-col pt-[8px] border-t border-[var(--border)]">
                            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-wider">Notas</span>
                            <span className="text-[12px] text-[var(--text-secondary)] italic mt-[4px] leading-relaxed">{o.notas}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-[16px] gap-[16px]">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Calendario de Actividad Opeartiva</h2>
            <p className="text-[12px] text-[var(--text-tertiary)] mt-[2px]">Vista de ganancias y operaciones diarias</p>
          </div>
          <div className="flex items-center gap-[8px]">
            <div className="flex items-center gap-[4px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[10px] p-[4px] shadow-sm">
              <button onClick={() => setYear(y => y - 1)} className="p-[6px] rounded-[6px] hover:bg-[var(--bg-surface-4)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-[14px] font-extrabold px-[12px] text-[var(--text-primary)] tracking-[1px] text-center">{year}</span>
              <button onClick={() => setYear(y => y + 1)} className="p-[6px] rounded-[6px] hover:bg-[var(--bg-surface-4)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* 12-month grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[12px] max-h-[480px] overflow-y-auto custom-scrollbar pr-[8px]">
          {MONTH_NAMES.map((monthName, monthIndex) => {
            const firstDay = new Date(year, monthIndex, 1).getDay(); // 0=Sun
            const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

            // Count activity in this month
            const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            const activityCount = Object.keys(dayMap).filter(k => k.startsWith(monthPrefix)).length;

            return (
              <div key={monthIndex} className="bg-[var(--bg-surface-1)] rounded-[12px] p-[12px] border border-[var(--border-strong)] shadow-sm">
                {/* Month header */}
                <div className="flex items-center justify-between mb-[12px]">
                  <span className="text-[11px] font-extrabold text-[var(--text-primary)] uppercase tracking-[1.5px]">{monthName}</span>
                  {activityCount > 0 && (
                    <span className="text-[9px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-[6px] py-[2px] rounded-full border border-[var(--accent)]/20">
                      {activityCount} {activityCount === 1 ? 'DÍA' : 'DÍAS'}
                    </span>
                  )}
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 mb-[8px]">
                  {DAY_NAMES.map(d => (
                    <span key={d} className="text-[10px] text-[var(--text-tertiary)] font-bold text-center py-[2px]">{d}</span>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-y-[4px] gap-x-[2px]">
                  {/* Empty cells before first day */}
                  {Array.from({ length: firstDay }).map((_, i) => (
                     <div key={`empty-${i}`} className="h-[28px]" />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, dayIndex) => {
                    const day = dayIndex + 1;
                    const dayKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const info = dayMap[dayKey];
                    const isToday = dayKey === todayKey;
                    const hasActivity = !!info && (info.orders.length > 0 || info.cyclesClosed.length > 0 || info.cyclesOpened.length > 0);
                    
                    let pnlColor = '';
                    if (info?.profitSum > 0) pnlColor = 'text-[var(--profit)]';
                    else if (info?.profitSum < 0) pnlColor = 'text-[var(--loss)]';
                    else pnlColor = 'text-[var(--text-tertiary)]';

                    // Simplified style for the day number button
                    return (
                      <button
                        key={dayKey}
                        onClick={() => { if(hasActivity) setDetailsDate(dayKey); }}
                        disabled={!hasActivity}
                        className={`
                          group relative flex flex-col items-center justify-start rounded-[6px] h-[28px] pt-[2px] transition-all
                          ${isToday ? 'bg-[var(--bg-surface-3)] ring-1 ring-[var(--accent)]/40 font-bold' : ''}
                          ${hasActivity ? 'hover:bg-[var(--bg-surface-4)] cursor-pointer shadow-sm border border-[var(--border)]' : 'cursor-default opacity-60 hover:opacity-100 border border-transparent'}
                        `}
                      >
                        <span className={`text-[11px] leading-none ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'} ${hasActivity ? 'font-semibold' : 'font-medium text-[var(--text-secondary)]'}`}>
                          {day}
                        </span>
                        
                        {/* PnL micro text or indicator dot */}
                        {hasActivity && (
                          <div className="mt-[2px] flex flex-col items-center justify-center h-[12px] w-full">
                            {info.profitSum !== 0 ? (
                              <span className={`text-[7px] font-extrabold mono leading-none tracking-tight ${pnlColor}`}>
                                {info.profitSum > 0 ? '+' : ''}{info.profitSum.toFixed(0)}
                              </span>
                            ) : (
                              <span className="w-[3px] h-[3px] bg-[var(--text-tertiary)] rounded-full block" />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {renderDayDetailsModal()}
    </>
  );
};
