import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Badge } from '../components/ui/Badge';
import { CycleCalendar } from '../components/dashboard/CycleCalendar';
import { CalendarDays, TableProperties } from 'lucide-react';

export const Cycles: React.FC = () => {
  const { cycles, orders } = useAppStore();
  const [filter, setFilter] = useState<'Todo' | 'En curso' | 'Completado' | 'Con pérdida'>('Todo');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleDateSelect = (date: string | null) => {
    setSelectedDate(date);
    if (date) setView('table'); // Switch to table automatically when a day is picked
  };

  // Apply date filter + status filter
  const filteredCycles = cycles.filter(c => {
    const matchStatus = filter === 'Todo' || c.status === filter;

    if (!matchStatus) return false;

    if (selectedDate) {
      const openKey = c.openedAt?.slice(0, 10);
      const closeKey = c.closedAt?.slice(0, 10);
      return openKey === selectedDate || closeKey === selectedDate;
    }

    return true;
  });

  const getCycleOrders = (cycleId: string) =>
    orders.filter(o => o.cycleId === cycleId).sort((a, b) =>
      new Date(a.createTime_utc).getTime() - new Date(b.createTime_utc).getTime()
    );

  return (
    <div className="flex flex-col gap-[24px] max-w-[1200px] mx-auto pb-[40px] animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] font-bold">Historial de Ciclos</h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-[4px]">
            {selectedDate
              ? `Mostrando ciclos del ${selectedDate}`
              : 'Todos los ciclos históricos abiertos o cerrados.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-[8px]">
          {/* View toggle */}
          <div className="flex bg-[var(--bg-surface-3)] p-[4px] rounded-[10px] border border-[var(--border-strong)]">
            <button
              onClick={() => setView('table')}
              className={`flex items-center gap-[6px] px-[12px] py-[6px] rounded-[6px] text-[13px] font-medium transition-colors ${
                view === 'table'
                  ? 'bg-[var(--bg-surface-4)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent'
              }`}
            >
              <TableProperties size={14} />
              Tabla
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-[6px] px-[12px] py-[6px] rounded-[6px] text-[13px] font-medium transition-colors ${
                view === 'calendar'
                  ? 'bg-[var(--bg-surface-4)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent'
              }`}
            >
              <CalendarDays size={14} />
              Calendario
              {selectedDate && (
                <span className="w-[6px] h-[6px] rounded-full bg-[var(--accent)] ml-[2px]" />
              )}
            </button>
          </div>

          {/* Status filter (only in table view) */}
          {view === 'table' && (
            <div className="flex flex-wrap bg-[var(--bg-surface-3)] p-[4px] rounded-[10px] border border-[var(--border-strong)] gap-[2px]">
              {(['Todo', 'En curso', 'Completado', 'Con pérdida'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-[12px] py-[6px] rounded-[6px] text-[12px] font-medium transition-colors ${
                    filter === f
                      ? 'bg-[var(--bg-surface-4)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Calendar view */}
      {view === 'calendar' && (
        <CycleCalendar
          cycles={cycles}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />
      )}

      {/* Active date filter pill — shown in table view */}
      {view === 'table' && selectedDate && (
        <div className="flex items-center gap-[8px] text-[13px]">
          <span className="text-[var(--text-tertiary)]">Filtro activo:</span>
          <button
            onClick={() => setSelectedDate(null)}
            className="flex items-center gap-[6px] px-[10px] py-[4px] bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 rounded-[20px] hover:bg-[var(--accent)]/20 transition-colors"
          >
            <CalendarDays size={12} />
            {selectedDate}
            <span className="text-[var(--accent)] font-bold ml-[2px]">×</span>
          </button>
        </div>
      )}

      {/* Table view */}
      {view === 'table' && (
        <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface-3)] text-[10px] uppercase font-semibold text-[var(--text-tertiary)] tracking-[1px]">
                <th className="p-[16px] border-b border-[var(--border-strong)]"># Ciclo</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] min-w-[140px]">Apertura</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] min-w-[140px]">Cierre</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] text-right">USDT Vendido</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] text-right">Ganancia (USDT)</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] text-center">ROI</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredCycles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-[32px] text-center text-[var(--text-secondary)] text-[14px]">
                    {selectedDate
                      ? `No hay ciclos registrados el ${selectedDate}.`
                      : 'No hay ciclos que coincidan con el filtro.'}
                  </td>
                </tr>
              ) : filteredCycles.map((c) => {
                const isExpanded = expandedId === c.id;
                const cycleOrders = isExpanded ? getCycleOrders(c.id) : [];

                return (
                  <React.Fragment key={c.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      className="hover:bg-[var(--bg-surface-4)] transition-colors border-b border-[var(--border)] group cursor-pointer"
                    >
                      <td className="p-[16px] mono text-[13px] font-medium text-[var(--accent)]">
                        {c.cycleNumber.toString().slice(-4)}
                      </td>
                      <td className="p-[16px] text-[13px] text-[var(--text-secondary)]">
                        {new Date(c.openedAt).toLocaleDateString()}
                      </td>
                      <td className="p-[16px] text-[13px] text-[var(--text-secondary)]">
                        {c.closedAt ? new Date(c.closedAt).toLocaleDateString() : '---'}
                      </td>
                      <td className="p-[16px] mono text-[13px] text-right">
                        {c.usdt_vendido.toFixed(2)}
                      </td>
                      <td className={`p-[16px] mono text-[13px] text-right ${c.status === 'En curso' ? 'text-[var(--text-tertiary)]' : c.ganancia_usdt > 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'}`}>
                        {c.status === 'En curso' ? 'Pendiente' : `${c.ganancia_usdt > 0 ? '+' : ''}${c.ganancia_usdt.toFixed(2)}`}
                      </td>
                      <td className="p-[16px] text-center">
                        <Badge variant={c.status === 'En curso' ? 'neutral' : c.roi_percent > 0 ? 'profit' : 'loss'}>
                          {c.status === 'En curso' ? '--' : `${c.roi_percent > 0 ? '+' : ''}${c.roi_percent.toFixed(2)}%`}
                        </Badge>
                      </td>
                      <td className="p-[16px] text-center">
                        <Badge variant={c.status === 'En curso' ? 'warning' : c.status === 'Con pérdida' ? 'loss' : 'accent'}>
                          {c.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[var(--bg-base)]">
                        <td colSpan={7} className="p-[0] border-b border-[var(--border)]">
                          <div className="border-l-2 border-[var(--accent)] ml-[24px] my-[16px] py-[8px] pl-[20px] pr-[24px]">
                            <div className="flex justify-between items-center mb-[12px]">
                              <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-[1px]">Órdenes del Ciclo</h4>
                              {cycleOrders.length > 0 && (
                                <span className="text-[11px] text-[var(--text-tertiary)] bg-[var(--bg-surface-2)] px-[8px] py-[2px] rounded-[100px] border border-[var(--border)]">
                                  <span className="text-[var(--loss)]">{cycleOrders.filter(o => o.tradeType === 'SELL').length}</span> Ventas · <span className="text-[var(--profit)]">{cycleOrders.filter(o => o.tradeType === 'BUY').length}</span> Compras
                                </span>
                              )}
                            </div>
                            {cycleOrders.length === 0 ? (
                              <p className="text-[var(--text-tertiary)] text-[13px]">No hay órdenes asignadas a este ciclo.</p>
                            ) : (
                              <div className="flex flex-col gap-[8px] max-h-[380px] overflow-y-auto pr-[8px] scrollbar-thin">
                                {cycleOrders.map(o => (
                                  <div key={o.id} className="flex flex-col gap-[8px] text-[13px] bg-[var(--bg-surface-1)] p-[12px] rounded-[8px] border border-[var(--border-strong)] transition-all hover:border-[var(--accent-border)]">
                                    <div className="flex flex-wrap items-center justify-between">
                                      <div className="flex items-center gap-[12px]">
                                        <Badge variant={o.tradeType === 'SELL' ? 'loss' : 'accent'}>{o.tradeType}</Badge>
                                        <span className="mono font-medium">{o.amount.toFixed(2)} USDT</span>
                                        <span className="text-[var(--text-tertiary)] px-[8px]">@</span>
                                        <span className="mono font-medium">{o.unitPrice.toFixed(2)} VES/USDT</span>
                                        <span className="text-[var(--text-secondary)] text-[12px] ml-[8px]">&gt; {o.totalPrice.toFixed(2)} Bs.</span>
                                      </div>
                                      <div className="flex items-center gap-[16px] text-[var(--text-secondary)]">
                                        <span className="truncate max-w-[150px]">{o.counterPartNickName}</span>
                                        <span className="mono text-[11px] bg-[var(--bg-surface-2)] px-[6px] py-[2px] rounded-[4px] border border-[var(--border)]">{new Date(o.createTime_utc).toLocaleString()}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-[16px] border-t border-[var(--border)] pt-[8px] mt-[4px] text-[12px] text-[var(--text-secondary)]">
                                      <div className="flex items-center gap-[4px]"><span className="text-[var(--text-primary)] font-mono font-medium cursor-text select-all hover:bg-[var(--bg-surface-3)] px-[4px] py-[2px] rounded transition-colors" title="Doble clic para copiar">🎫 {o.orderNumber}</span></div>
                                      <div className="flex items-center gap-[4px] border-l border-[var(--border)] pl-[16px]"><span className="text-[var(--text-tertiary)]">Comisión:</span> <span className="mono">{o.commission.toFixed(4)} {o.commissionAsset}</span></div>
                                      <div className="flex items-center gap-[4px] border-l border-[var(--border)] pl-[16px]"><span className="text-[var(--text-tertiary)]">Estado:</span> <span className="uppercase text-[10px] bg-[var(--bg-surface-2)] px-[6px] py-[2px] rounded-[4px]">{o.orderStatus}</span></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
