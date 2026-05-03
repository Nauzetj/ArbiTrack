import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Order } from '../../types';
import { Badge } from '../ui/Badge';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { saveOrder, recalculateCycleMetrics, getOrdersForUser, getCyclesForUser, getActiveCycleForUser } from '../../services/dbOperations';


export const UnassignedOrdersPool: React.FC = () => {
  const { orders, activeCycle, setActiveCycle, setOrders, setCycles, currentUser } = useAppStore();
  const [isModalOpen, setIsModalOpen] = React.useState(false);

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

  return (
    <>
      <div 
        className={`bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[16px] flex items-center justify-between transition-colors ${unassigned.length > 0 ? 'cursor-pointer hover:bg-[var(--bg-surface-3)]' : 'opacity-70'}`}
        onClick={() => { if(unassigned.length > 0) setIsModalOpen(true); }}
      >
        <div className="flex items-center gap-[12px]">
          {unassigned.length === 0 ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          ) : null}
          <h3 className="font-semibold text-[14px]">Órdenes sin asignar</h3>
          {unassigned.length > 0 && (
            <span className="bg-[var(--accent)] text-white text-[10px] font-bold px-[6px] py-[2px] rounded-full">{unassigned.length}</span>
          )}
        </div>
        
        {unassigned.length === 0 ? (
          <span className="text-[var(--text-secondary)] text-[13px] font-medium hidden sm:inline">No hay órdenes sin asignar</span>
        ) : (
          <div className="flex items-center gap-[8px] text-[var(--text-secondary)]">
            <span className="text-[12px] font-medium hidden sm:inline">Ver órdenes</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </div>
        )}
      </div>

      {isModalOpen && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-[16px] animate-fade-in-up"
          style={{ background: 'rgba(5, 5, 8, 0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="w-full max-w-[500px] bg-[var(--bg-surface-1)] text-[var(--text-primary)] rounded-[24px] shadow-2xl overflow-hidden border border-[var(--border-strong)] relative"
            onClick={e => e.stopPropagation()}
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}
          >
            <div className="flex items-center justify-between p-[24px] border-b border-[var(--border)]">
              <div className="flex items-center gap-[12px]">
                <h2 className="font-bold text-[18px]">Órdenes sin asignar</h2>
                <span className="bg-[var(--accent)] text-white text-[11px] font-bold px-[8px] py-[2px] rounded-full">{unassigned.length}</span>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-[36px] h-[36px] rounded-full flex items-center justify-center hover:bg-[var(--bg-surface-3)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={18}/>
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-[16px] flex flex-col gap-[8px]">
              {unassigned.map(order => (
                <div key={order.id} className="flex items-center justify-between p-[12px] group bg-[var(--bg-surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-[12px] transition-all">
                  <div className="flex flex-col gap-[4px] min-w-[0]">
                    <div className="flex items-center gap-[8px]">
                      <Badge variant={order.tradeType === 'SELL' ? 'loss' : 'accent'}>
                        {order.tradeType === 'SELL' ? 'VENTA' : 'COMPRA'}
                      </Badge>
                      <span className="mono text-[14px] font-medium text-[var(--text-primary)] truncate">{order.amount.toFixed(2)} USDT</span>
                    </div>
                    <span className="text-[12px] text-[var(--text-tertiary)] truncate mt-[2px]">
                      Tasa: {order.unitPrice.toFixed(2)} VES | {order.counterPartNickName || 'Contraparte'}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => handleAssign(order)}
                    disabled={!activeCycle}
                    className="px-[14px] py-[8px] rounded-[8px] border border-[var(--accent-border)] text-[var(--accent)] text-[12px] font-bold opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--accent-muted)] disabled:opacity-50 disabled:cursor-not-allowed ml-[8px] shrink-0"
                    title={!activeCycle ? 'Debes abrir un ciclo primero' : 'Añadir al ciclo actual'}
                  >
                    Añadir
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
