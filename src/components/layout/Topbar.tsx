import React, { useState, useEffect } from 'react';
import { RefreshCw, User, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { fetchP2POrders } from '../../services/binance';
import { saveOrder, getOrdersForUser, getActiveCycleForUser, recalculateCycleMetrics } from '../../services/dbOperations';
import { generateUUID } from '../../crypto/auth';
import type { Order } from '../../types';

export const Topbar: React.FC = () => {
  const { bcvRate, isSyncing, setIsSyncing, setLastSyncTime, binanceKeys, currentUser, setOrders, setActiveCycle } = useAppStore();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const handleSync = async () => {
    const currentState = useAppStore.getState();
    const user = currentState.currentUser;
    if (!currentState.binanceKeys || !user) {
      return;
    }

    if (currentState.isSyncing) return;

    setIsSyncing(true);
    setSyncStatus('syncing');

    try {
      // Fetch the last 30 orders (pages 1, 2, 3) to ensure we catch updates for orders that got pushed off page 1
      const requests = [1, 2, 3].map(page => 
        fetchP2POrders(currentState.binanceKeys.apiKey, currentState.binanceKeys.secretKey, page)
      );
      
      const responses = await Promise.all(requests);
      let allBinanceOrders: any[] = [];
      responses.forEach(res => {
         if (res && res.data) {
            allBinanceOrders = allBinanceOrders.concat(res.data);
         }
      });
      
      if (allBinanceOrders.length > 0) {
        const existingOrders = getOrdersForUser(user.id);
        let addedCount = 0;
        let requiresRecalc = false;

        const activeCycle = getActiveCycleForUser(user.id);
        const cycleOpenedAt = activeCycle ? new Date(activeCycle.openedAt).getTime() : null;

        allBinanceOrders.forEach((o: any) => {
          const existingOrder = existingOrders.find(ex => ex.orderNumber === o.orderNumber);
          
          if (existingOrder) {
            // Check if status changed (e.g., from TRADING to COMPLETED)
            if (existingOrder.orderStatus !== o.orderStatus) {
              const updatedOrder = { ...existingOrder, orderStatus: o.orderStatus };
              saveOrder(updatedOrder);
              requiresRecalc = true;
              addedCount++; // Forces the refresh block below
            }
            return;
          }

          let autoAssignedCycleId = null;
          const orderTime = new Date(o.createTime).getTime();

          // Auto-assign: If cycle is active and order occurred at or after cycle was opened
          if (activeCycle && cycleOpenedAt && orderTime >= cycleOpenedAt) {
            autoAssignedCycleId = activeCycle.id;
            requiresRecalc = true;
          }

          const importedOrder: Order = {
            id: generateUUID(),
            orderNumber: o.orderNumber,
            tradeType: o.tradeType,
            asset: o.asset,
            fiat: o.fiat,
            totalPrice: parseFloat(o.totalPrice),
            unitPrice: parseFloat(o.unitPrice),
            amount: parseFloat(o.amount),
            commission: parseFloat(o.commission),
            commissionAsset: o.asset,
            counterPartNickName: o.counterPartNickName,
            orderStatus: o.orderStatus,
            createTime_utc: new Date(o.createTime).toISOString(),
            createTime_local: new Date(o.createTime).toLocaleString(),
            cycleId: autoAssignedCycleId,
            importedAt: new Date().toISOString(),
            userId: user.id
          };
          saveOrder(importedOrder);
          addedCount++;
        });

        if (addedCount > 0) {
          if (requiresRecalc && activeCycle) {
            recalculateCycleMetrics(activeCycle.id, user.id);
            setActiveCycle(getActiveCycleForUser(user.id));
          }
          setOrders(getOrdersForUser(user.id));
        }
      }

      setSyncStatus('success');
      setLastSyncTime(new Date());
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e: any) {
      console.error(e);
      setSyncStatus('error');
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  useEffect(() => {
    if (!currentUser || !binanceKeys) return;

    const interval = setInterval(() => {
      handleSync();
    }, 7000); // 7 segundos es un límite balanceado para evitar baneos IP de Binance.

    return () => clearInterval(interval);
  }, [currentUser, binanceKeys]);

  return (
    <header className="h-[64px] fixed top-0 right-0 left-[220px] bg-surface-1 border-b border-[var(--border)] z-40 flex items-center justify-between px-[32px]">
      <div>
        {/* Placeholder breadcrumb/dynamic title space based on route */}
      </div>

      <div className="flex items-center gap-[20px]">
        {/* BCV Pill */}
        <div className="flex items-center gap-[8px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-full px-[16px] py-[6px]">
          <div className="w-[6px] h-[6px] rounded-full bg-[var(--accent)] animate-pulse-green"></div>
          <span className="mono text-[13px] font-medium tracking-wide">
            BCV: Bs. {bcvRate ? bcvRate.tasa_bcv.toFixed(2) : '---'}
          </span>
        </div>

        {/* Sync Button */}
        <button 
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-[8px] text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          {syncStatus === 'success' ? (
             <CheckCircle2 size={16} className="text-profit" />
          ) : (
             <RefreshCw size={16} className={isSyncing ? 'animate-spin text-[var(--accent)]' : ''} />
          )}
          {syncStatus === 'success' ? (
            <span className="text-profit">
              Actualizado {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          ) : (
            <span>Sincronizar</span>
          )}
        </button>

        {/* Avatar */}
        <div className="w-[36px] h-[36px] rounded-full bg-[var(--bg-surface-3)] border border-[var(--border-strong)] flex items-center justify-center ml-[8px]">
          <User size={18} className="text-[var(--text-secondary)]" />
        </div>
      </div>
    </header>
  );
};
