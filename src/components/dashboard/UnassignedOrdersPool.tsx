import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Order } from '../../types';
import { Badge } from '../ui/Badge';
import { saveOrder, saveCycle } from '../../services/dbOperations';
import toast from 'react-hot-toast';

export const UnassignedOrdersPool: React.FC = () => {
  const { orders, cycles, activeCycle, setActiveCycle, setOrders, setCycles } = useAppStore();

  const unassigned = orders.filter(o => !o.cycleId && o.orderStatus === 'COMPLETED');

  const handleAssign = async (order: Order) => {
    if (!activeCycle) return;
    
    try {
      const updatedOrder = { ...order, cycleId: activeCycle.id };
      await saveOrder(updatedOrder);
      
      const updatedOrders = orders.map(o => o.id === order.id ? updatedOrder : o);
      setOrders(updatedOrders);

      // Update raw totals
      const newCycle = { ...activeCycle };
      if (order.tradeType === 'SELL') {
         newCycle.usdt_vendido += order.amount;
         newCycle.ves_recibido += order.totalPrice;
      } else {
         newCycle.usdt_recomprado += order.amount;
         newCycle.ves_pagado += order.totalPrice;
      }
      newCycle.comision_total += order.commission;

      // --- Recalculate all derived metrics ---
      const tasa_venta_prom = newCycle.usdt_vendido > 0
        ? newCycle.ves_recibido / newCycle.usdt_vendido
        : 0;
      const tasa_compra_prom = newCycle.usdt_recomprado > 0
        ? newCycle.ves_pagado / newCycle.usdt_recomprado
        : 0;
      const diferencial_tasa =
        tasa_venta_prom > 0 && tasa_compra_prom > 0
          ? tasa_venta_prom - tasa_compra_prom
          : 0;
      const matchedVolume = Math.min(newCycle.usdt_vendido, newCycle.usdt_recomprado);
      const ganancia_ves = matchedVolume * diferencial_tasa;
      const ganancia_usdt =
        tasa_compra_prom > 0
          ? ganancia_ves / tasa_compra_prom - newCycle.comision_total
          : -newCycle.comision_total;
      const roi_percent =
        newCycle.usdt_vendido > 0
          ? (ganancia_usdt / newCycle.usdt_vendido) * 100
          : 0;

      newCycle.tasa_venta_prom  = tasa_venta_prom;
      newCycle.tasa_compra_prom = tasa_compra_prom;
      newCycle.diferencial_tasa = diferencial_tasa;
      newCycle.ganancia_ves     = ganancia_ves;
      newCycle.ganancia_usdt    = ganancia_usdt;
      newCycle.roi_percent      = roi_percent;
      // ----------------------------------------

      await saveCycle(newCycle);
      setActiveCycle(newCycle);
      // Sync the cycles[] array in the store so all consumers see fresh data
      setCycles(cycles.map(c => c.id === newCycle.id ? newCycle : c));
      toast.success('Orden asignada con éxito');
    } catch (e: any) {
      console.error(e);
      toast.error('Error de red al asignar: ' + e.message);
    }
  };

  if (unassigned.length === 0) {
    return (
      <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px] h-full flex flex-col items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <p className="text-[var(--text-secondary)] text-[13px] mt-[12px]">No hay órdenes sin asignar.</p>
        <p className="text-[var(--text-tertiary)] text-[12px] text-center mt-[4px]">Haz click en "Sincronizar" para buscar nuevas órdenes en Binance.</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] flex flex-col h-full overflow-hidden max-h-[350px]">
      <div className="p-[16px] border-b border-[var(--border-strong)] bg-[var(--bg-surface-3)]">
        <h3 className="font-semibold text-[14px]">Órdenes sin asignar</h3>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-[8px]">
        {unassigned.map(order => (
          <div key={order.id} className="flex items-center justify-between p-[12px] group hover:bg-[var(--bg-surface-4)] rounded-[8px] transition-colors">
            <div className="flex flex-col gap-[4px] min-w-[0]">
              <div className="flex items-center gap-[8px]">
                <Badge variant={order.tradeType === 'SELL' ? 'loss' : 'accent'}>
                  {order.tradeType === 'SELL' ? 'VENTA' : 'COMPRA'}
                </Badge>
                <span className="mono text-[13px] font-medium text-[var(--text-primary)] truncate">{order.amount.toFixed(2)} USDT</span>
              </div>
              <span className="text-[11px] text-[var(--text-tertiary)] truncate">
                Tasa: {order.unitPrice.toFixed(2)} VES | {order.counterPartNickName || 'Contraparte'}
              </span>
            </div>
            
            <button 
              onClick={() => handleAssign(order)}
              disabled={!activeCycle}
              className="px-[12px] py-[6px] rounded-[6px] border border-[var(--accent-border)] text-[var(--accent)] text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--accent-muted)] disabled:opacity-50 disabled:cursor-not-allowed ml-[8px] shrink-0"
              title={!activeCycle ? 'Debes abrir un ciclo primero' : 'Añadir al ciclo actual'}
            >
              Añadir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
