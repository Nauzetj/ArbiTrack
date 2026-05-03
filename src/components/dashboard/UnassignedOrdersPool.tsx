import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Order } from '../../types';
import { Badge } from '../ui/Badge';
import toast from 'react-hot-toast';
import { saveOrder, recalculateCycleMetrics, getOrdersForUser, getCyclesForUser, getActiveCycleForUser } from '../../services/dbOperations';

export const UnassignedOrdersPool: React.FC = () => {
  const { orders, activeCycle, setActiveCycle, setOrders, setCycles, currentUser } = useAppStore();

  const unassigned = orders.filter(o => !o.cycleId && o.orderStatus === 'COMPLETED');

  const handleAssign = async (order: Order) => {
    if (!activeCycle || !currentUser) return;
    
    try {
      const updatedOrder = { ...order, cycleId: activeCycle.id };
      await saveOrder(updatedOrder);
      
      // Recalculate metrics on backend/local fallback
      await recalculateCycleMetrics(activeCycle.id, currentUser.id);

      // Fetch fresh state to guarantee strict consistency
      const [freshOrders, freshActiveCycle, freshCycles] = await Promise.all([
        getOrdersForUser(currentUser.id),
        getActiveCycleForUser(currentUser.id),
        getCyclesForUser(currentUser.id),
      ]);

      setOrders(freshOrders);
      setActiveCycle(freshActiveCycle);
      setCycles(freshCycles);

      toast.success('Orden asignada al ciclo correctamente');
    } catch (e: any) {
      console.error('Error al asignar:', e);
      toast.error('Error al asignar: ' + e.message);
    }
  };

  const [isExpanded, setIsExpanded] = React.useState(false);

  if (unassigned.length === 0) {
    return (
      <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[20px] flex items-center justify-between opacity-70">
        <div className="flex items-center gap-[12px]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span className="text-[var(--text-secondary)] text-[13px] font-medium">No hay órdenes sin asignar</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] flex flex-col overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px]' : 'max-h-[56px]'}`}>
      <div 
        className="p-[16px] border-b border-[var(--border-strong)] bg-[var(--bg-surface-3)] flex items-center justify-between cursor-pointer hover:bg-[var(--bg-surface-4)] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-[8px]">
          <h3 className="font-semibold text-[14px]">Órdenes sin asignar</h3>
          <span className="bg-[var(--accent)] text-white text-[10px] font-bold px-[6px] py-[2px] rounded-full">{unassigned.length}</span>
        </div>
        <svg 
          className={`transition-transform duration-300 text-[var(--text-secondary)] ${isExpanded ? 'rotate-180' : ''}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
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
              onClick={(e) => { e.stopPropagation(); handleAssign(order); }}
              disabled={!activeCycle}
              className="px-[12px] py-[6px] rounded-[6px] border border-[var(--accent-border)] text-[var(--accent)] text-[11px] font-semibold opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--accent-muted)] disabled:opacity-50 disabled:cursor-not-allowed ml-[8px] shrink-0"
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
