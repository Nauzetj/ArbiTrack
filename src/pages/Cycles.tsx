import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Badge } from '../components/ui/Badge';
import { CycleCalendar } from '../components/dashboard/CycleCalendar';
import { CalendarDays, TableProperties, Zap, PenLine, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { 
  recalculateCycleMetrics, 
  getCyclesForUser, 
  getOrdersForUser, 
  getActiveCycleForUser 
} from '../services/dbOperations';
import toast from 'react-hot-toast';
import type { OperationType } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, digits = 2) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
}

const OP_LABELS: Record<OperationType | string, { label: string; color: string }> = {
  VENTA_USDT:    { label: 'Venta USDT',   color: 'var(--loss)' },
  COMPRA_USDT:   { label: 'Compra USDT',  color: 'var(--profit)' },
  RECOMPRA:      { label: 'Recompra',      color: 'var(--accent)' },
  COMPRA_USD:    { label: 'Compra USD',    color: '#f59e0b' },
  TRANSFERENCIA: { label: 'Transferencia', color: '#a78bfa' },
  SELL:          { label: 'Venta',         color: 'var(--loss)' },
  BUY:           { label: 'Compra',        color: 'var(--profit)' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const Cycles: React.FC = () => {
  const { cycles, orders, currentUser } = useAppStore();
  const [filter, setFilter] = useState<'Todo' | 'En curso' | 'Completado' | 'Con pérdida'>('Todo');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleDateSelect = (date: string | null) => {
    setSelectedDate(date);
    if (date) setView('table');
  };

  const filteredCycles = useMemo(() => cycles.filter(c => {
    const matchStatus = filter === 'Todo' || c.status === filter;
    if (!matchStatus) return false;
    if (selectedDate) {
      return c.openedAt?.slice(0, 10) === selectedDate || c.closedAt?.slice(0, 10) === selectedDate;
    }
    return true;
  }), [cycles, filter, selectedDate]);

  const getCycleOrders = (cycleId: string) =>
    orders
      .filter(o => o.cycleId === cycleId && o.orderStatus?.toUpperCase() === 'COMPLETED')
      .sort((a, b) => new Date(a.createTime_utc).getTime() - new Date(b.createTime_utc).getTime());

  // @ts-ignore - reservado para uso futuro
  const getCycleMetrics = (cycleId: string) => {
    const ops = orders.filter(o => o.cycleId === cycleId && o.orderStatus?.toUpperCase() === 'COMPLETED');
    let totalInvertido = 0, totalRecuperado = 0, totalComisiones = 0;
    ops.forEach(o => {
      const opType = o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT');
      totalComisiones += o.commission ?? 0;
      if (opType === 'COMPRA_USDT' || opType === 'COMPRA_USD') totalInvertido += o.totalPrice;
      if (opType === 'VENTA_USDT' || opType === 'RECOMPRA') totalRecuperado += o.totalPrice;
    });
    const gananciaNeta = totalRecuperado - totalInvertido - totalComisiones;
    return { totalInvertido, totalRecuperado, totalComisiones, gananciaNeta };
  };

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
          <button
            onClick={async () => {
              if (!currentUser) return;
              if (!confirm('¿Recalcular TODOS los ciclos? Esto corregirá las ganancias.')) return;
              toast.loading('Recalculando ciclos...', { id: 'recalc' });
              try {
                for (const c of cycles) {
                  await recalculateCycleMetrics(c.id, currentUser.id);
                }
                // Refresh data after recalculate
                const { setCycles, setOrders, setActiveCycle } = useAppStore.getState();
                const [fc, fo, fa] = await Promise.all([
                  getCyclesForUser(currentUser.id),
                  getOrdersForUser(currentUser.id),
                  getActiveCycleForUser(currentUser.id)
                ]);
                setCycles(fc);
                setOrders(fo);
                setActiveCycle(fa);
                toast.success('Ciclos recalculados', { id: 'recalc' });
              } catch (e: any) {
                toast.error('Error: ' + e.message, { id: 'recalc' });
              }
            }}
            className="flex items-center gap-[6px] px-[12px] py-[6px] rounded-[8px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] text-[var(--text-secondary)] text-[12px] font-medium hover:bg-[var(--bg-surface-2)] transition-all"
          >
            <RefreshCw size={14}/> Recalcular
          </button>
          
          {/* View toggle */}
          <div className="flex bg-[var(--bg-surface-3)] p-[4px] rounded-[10px] border border-[var(--border-strong)]">
            {(['table', 'calendar'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-[6px] px-[12px] py-[6px] rounded-[6px] text-[13px] font-medium transition-colors ${
                  view === v
                    ? 'bg-[var(--bg-surface-4)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent'
                }`}
              >
                {v === 'table' ? <TableProperties size={14}/> : <CalendarDays size={14}/>}
                {v === 'table' ? 'Tabla' : 'Calendario'}
                {v === 'calendar' && selectedDate && (
                  <span className="w-[6px] h-[6px] rounded-full bg-[var(--accent)] ml-[2px]"/>
                )}
              </button>
            ))}
          </div>

          {/* Status filter */}
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

      {/* Calendar */}
      {view === 'calendar' && (
        <CycleCalendar
          cycles={cycles}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />
      )}

      {/* Active date pill */}
      {view === 'table' && selectedDate && (
        <div className="flex items-center gap-[8px] text-[13px]">
          <span className="text-[var(--text-tertiary)]">Filtro activo:</span>
          <button
            onClick={() => setSelectedDate(null)}
            className="flex items-center gap-[6px] px-[10px] py-[4px] bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 rounded-[20px] hover:bg-[var(--accent)]/20 transition-colors"
          >
            <CalendarDays size={12}/>
            {selectedDate}
            <span className="font-bold ml-[2px]">×</span>
          </button>
        </div>
      )}

      {/* Table */}
      {view === 'table' && (
        <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface-3)] text-[10px] uppercase font-semibold text-[var(--text-tertiary)] tracking-[1px]">
                <th className="p-[16px] border-b border-[var(--border-strong)]">Tipo</th>
                <th className="p-[16px] border-b border-[var(--border-strong)]"># Ciclo</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] min-w-[120px]">Apertura</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] min-w-[120px]">Cierre</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] text-right">Liquidez (Inv.)</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] text-right">Costo Recomp.</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] text-right">Comisiones</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] text-right">Ganancia (USDT)</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] text-center">ROI</th>
                <th className="p-[16px] border-b border-[var(--border-strong)] text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredCycles.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-[32px] text-center text-[var(--text-secondary)] text-[14px]">
                    {selectedDate
                      ? `No hay ciclos registrados el ${selectedDate}.`
                      : 'No hay ciclos que coincidan con el filtro.'}
                  </td>
                </tr>
              ) : filteredCycles.map(c => {
                const isExpanded = expandedId === c.id;
                const cycleOrders = isExpanded ? getCycleOrders(c.id) : [];

                return (
                  <React.Fragment key={c.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      className="table-glass-row border-b border-[var(--border)] cursor-pointer"
                    >
                      {/* Type badge */}
                      <td className="p-[16px]">
                        {c.cycleType === 'manual' ? (
                          <span className="inline-flex items-center gap-[4px] text-[9px] font-bold px-[7px] py-[3px] rounded-full bg-[rgba(124,58,237,0.15)] text-[#a78bfa] border border-[rgba(124,58,237,0.3)] uppercase tracking-wider">
                            <PenLine size={8}/> Manual
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-[4px] text-[9px] font-bold px-[7px] py-[3px] rounded-full bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent-border)] uppercase tracking-wider">
                            <Zap size={8}/> P2P
                          </span>
                        )}
                      </td>

                      <td className="p-[16px] mono text-[13px] font-medium text-[var(--accent)]">
                        #{c.cycleNumber.toString().slice(-4)}
                      </td>
                      <td className="p-[16px] text-[13px] text-[var(--text-secondary)]">
                        {fmtDate(c.openedAt)}
                      </td>
                      <td className="p-[16px] text-[13px] text-[var(--text-secondary)]">
                        {c.closedAt ? fmtDate(c.closedAt) : '—'}
                      </td>

                      <td className="p-[16px] mono text-[12px] text-right text-[var(--text-secondary)]">
                        {c.status === 'En curso' ? '—' : `Bs. ${fmt(c.ves_recibido)}`}
                      </td>
                      <td className="p-[16px] mono text-[12px] text-right text-[var(--profit)]">
                        {c.status === 'En curso' ? '—' : `Bs. ${fmt(c.ves_pagado)}`}
                      </td>
                      <td className="p-[16px] mono text-[12px] text-right text-[var(--warning)]">
                        {fmt(c.comision_total, 4)}
                      </td>
                      <td className={`p-[16px] mono text-[13px] text-right font-medium ${
                        c.status === 'En curso'
                          ? 'text-[var(--text-tertiary)]'
                          : c.ganancia_usdt > 0 ? 'text-[var(--profit)]'
                          : c.ganancia_usdt < 0 ? 'text-[var(--loss)]'
                          : 'text-[var(--text-secondary)]'
                      }`}>
                        {c.status === 'En curso' ? 'Pendiente' : (
                          <>
                            {c.ganancia_usdt > 0
                              ? <TrendingUp size={10} className="inline mr-[2px]"/>
                              : c.ganancia_usdt < 0
                              ? <TrendingDown size={10} className="inline mr-[2px]"/>
                              : <Minus size={10} className="inline mr-[2px]"/>}
                            {c.ganancia_usdt > 0 ? '+' : ''}{c.ganancia_usdt.toFixed(2)} USDT
                          </>
                        )}
                      </td>
                      <td className="p-[16px] text-center">
                        <Badge variant={c.status === 'En curso' ? 'neutral' : c.roi_percent > 0 ? 'profit' : 'loss'}>
                          {c.status === 'En curso' ? '—' : `${c.roi_percent > 0 ? '+' : ''}${c.roi_percent.toFixed(2)}%`}
                        </Badge>
                      </td>
                      <td className="p-[16px] text-center">
                        <Badge variant={c.status === 'En curso' ? 'warning' : c.status === 'Con pérdida' ? 'loss' : 'accent'}>
                          {c.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr className="bg-[var(--bg-base)]">
                        <td colSpan={10} className="p-[0] border-b border-[var(--border)]">
                          <div className="border-l-2 border-[var(--accent)] ml-[24px] my-[16px] py-[8px] pl-[20px] pr-[24px] flex flex-col gap-[14px]">

                            {/* Financial summary mini */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-[8px]">
                              {[
                                { label: 'Total Invertido (Liquidez)',  val: c.ves_pagado,  color: 'text-[var(--text-primary)]' },
                                { label: 'Costo Recompra', val: c.ves_recibido,   color: 'text-[var(--text-secondary)]' },
                                { label: 'Comisiones',       val: c.comision_total,  color: 'text-[var(--warning)]' },
                                { label: 'Ganancia USDT',    val: c.ganancia_usdt,     color: c.ganancia_usdt > 0 ? 'text-[var(--profit)]' : c.ganancia_usdt < 0 ? 'text-[var(--loss)]' : 'text-[var(--text-secondary)]' },
                              ].map(({ label, val, color }) => (
                                <div key={label} className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[8px] px-[12px] py-[8px]">
                                  <span className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider block">{label}</span>
                                  <span className={`font-mono font-bold text-[13px] ${color}`}>
                                    {label.includes('USD') 
                                      ? (val > 0 ? '+' : '') + val.toFixed(4) + ' USDT'
                                      : 'Bs. ' + fmt(val, 2)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Orders list */}
                            <div className="flex justify-between items-center">
                              <h4 className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-[1px]">
                                Órdenes del ciclo
                              </h4>
                              {cycleOrders.length > 0 && (
                                <span className="text-[11px] text-[var(--text-tertiary)] bg-[var(--bg-surface-2)] px-[8px] py-[2px] rounded-[100px] border border-[var(--border)]">
                                  {cycleOrders.length} op{cycleOrders.length !== 1 ? 's' : '.'}
                                </span>
                              )}
                            </div>

                            {cycleOrders.length === 0 ? (
                              <p className="text-[var(--text-tertiary)] text-[13px]">No hay órdenes asignadas a este ciclo.</p>
                            ) : (
                              <div className="flex flex-col gap-[6px] max-h-[360px] overflow-y-auto pr-[4px] custom-scrollbar">
                                {cycleOrders.map((o, idx) => {
                                  const opType = o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT');
                                  const opLabel = OP_LABELS[opType] ?? { label: opType, color: 'var(--text-primary)' };
                                  return (
                                    <div key={o.id} className="flex flex-col gap-[6px] text-[12px] bg-[var(--bg-surface-1)] p-[10px] rounded-[8px] border border-[var(--border-strong)] hover:border-[var(--accent-border)] transition-all">
                                      <div className="flex flex-wrap items-center justify-between gap-[8px]">
                                        <div className="flex items-center gap-[10px]">
                                          <span className="text-[9px] font-bold text-[var(--text-tertiary)]">{idx + 1}</span>
                                          <span className="text-[10px] font-bold" style={{ color: opLabel.color }}>{opLabel.label}</span>
                                          {o.exchange && <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-surface-2)] px-[6px] py-[2px] rounded-[4px]">{o.exchange}</span>}
                                          <span className="mono font-medium">{fmt(o.amount, 4)}</span>
                                          {o.unitPrice > 0 && (
                                            <><span className="text-[var(--text-tertiary)]">@</span>
                                            <span className="mono">{fmt(o.unitPrice)}</span></>
                                          )}
                                          <span className="text-[var(--text-secondary)]">→ Bs. {fmt(o.totalPrice)}</span>
                                        </div>
                                        <div className="flex items-center gap-[8px] text-[var(--text-secondary)]">
                                          {o.counterPartNickName && (
                                            <span className="truncate max-w-[120px] text-[11px]">{o.counterPartNickName}</span>
                                          )}
                                          <span className="mono text-[10px] bg-[var(--bg-surface-2)] px-[6px] py-[2px] rounded-[4px] border border-[var(--border)]">
                                            {fmtDateTime(o.createTime_utc)}
                                          </span>
                                          <span className={`inline-flex items-center gap-[3px] text-[9px] font-bold px-[6px] py-[2px] rounded-full uppercase ${
                                            o.originMode === 'auto'
                                              ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                                              : 'bg-[rgba(124,58,237,0.1)] text-[#a78bfa]'
                                          }`}>
                                            {o.originMode === 'auto' ? <><Zap size={7}/> Exchange</> : <><PenLine size={7}/> Manual</>}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-[12px] border-t border-[var(--border)] pt-[6px] text-[11px] text-[var(--text-secondary)]">
                                        <span className="font-mono text-[var(--text-primary)] select-all cursor-text hover:bg-[var(--bg-surface-2)] px-[4px] py-[1px] rounded transition-colors" title="Ref. de orden">
                                          🎫 {o.orderNumber}
                                        </span>
                                        <span className="border-l border-[var(--border)] pl-[12px]">
                                          <span className="text-[var(--text-tertiary)]">Com:</span>{' '}
                                          <span className="mono text-[var(--warning)]">{fmt(o.commission, 4)}</span>
                                        </span>
                                        {o.notas && (
                                          <span className="border-l border-[var(--border)] pl-[12px] italic text-[var(--text-tertiary)]">
                                            {o.notas}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
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
