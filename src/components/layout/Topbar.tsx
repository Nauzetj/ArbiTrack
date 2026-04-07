import React, { useState, useEffect } from 'react';
import { RefreshCw, User, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { fetchP2POrders } from '../../services/binance';
import { saveOrder, getOrdersForUser, getActiveCycleForUser, recalculateCycleMetrics } from '../../services/dbOperations';
import { generateUUID } from '../../crypto/auth';
import type { Order } from '../../types';

export const Topbar: React.FC = () => {
  const { bcvRate, isSyncing, setIsSyncing, setLastSyncTime, binanceKeys, currentUser, setOrders, setActiveCycle } = useAppStore();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const handleSync = async (isManual: boolean = false) => {
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
        fetchP2POrders(currentState.binanceKeys!.apiKey, currentState.binanceKeys!.secretKey, page)
      );
      
      const responses = await Promise.all(requests);
      let allBinanceOrders: any[] = [];
      responses.forEach(res => {
         if (res && res.data) {
            allBinanceOrders = allBinanceOrders.concat(res.data);
         }
      });
      
      if (allBinanceOrders.length > 0) {
        const existingOrders = await getOrdersForUser(user.id);
        let addedCount = 0;
        let requiresRecalc = false;

        const activeCycle = await getActiveCycleForUser(user.id);
        const cycleOpenedAt = activeCycle ? new Date(activeCycle.openedAt).getTime() : null;

        for (const o of allBinanceOrders) {
          const existingOrder = existingOrders.find(ex => ex.orderNumber === o.orderNumber);
          
          if (existingOrder) {
            // Check if status changed (e.g., from TRADING to COMPLETED)
            if (existingOrder.orderStatus !== o.orderStatus) {
              const updatedOrder = { ...existingOrder, orderStatus: o.orderStatus };
              await saveOrder(updatedOrder);
              requiresRecalc = true;
              addedCount++; // Forces the refresh block below
            }
            continue;
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
          await saveOrder(importedOrder);
          addedCount++;
        }

        if (addedCount > 0) {
          if (requiresRecalc && activeCycle) {
            await recalculateCycleMetrics(activeCycle.id, user.id);
            setActiveCycle(await getActiveCycleForUser(user.id));
          }
          setOrders(await getOrdersForUser(user.id));
        }
      }

      setSyncStatus('success');
      setLastSyncTime(new Date());
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3000);
      if (isManual && allBinanceOrders.length > 0) {
        toast.success(`Sincronización exitosa. Se actualizaron las órdenes.`);
      } else if (isManual) {
        toast.success('Sincronización exitosa. No hay órdenes nuevas.');
      }
    } catch (e: any) {
      console.error(e);
      setSyncStatus('error');
      setIsSyncing(false);
      if (isManual) {
        toast.error(`Error de conexión con Binance Proxy o base de datos.`);
      }
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  useEffect(() => {
    if (!currentUser || !binanceKeys) return;

    // Auto-sync en background cada 10s
    const interval = setInterval(() => {
      handleSync(false);
    }, 10_000);

    return () => clearInterval(interval);
  }, [currentUser, binanceKeys]);

  return (
    <header className="h-[56px] md:h-[64px] fixed top-0 right-0 left-0 md:left-[220px] bg-[var(--bg-surface-1)] border-b border-[var(--border)] z-40 flex items-center justify-between px-[16px] md:px-[32px]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Left: Logo (mobile only) */}
      <div className="flex items-center gap-[10px]">
        <div className="md:hidden flex items-center gap-[8px]">
          <div className="w-[28px] h-[28px] bg-[var(--accent)] rounded-[7px] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <span className="font-bold text-[15px] tracking-tight">ArbiTrack</span>
        </div>

        {/* BCV on mobile — shown prominently next to logo */}
        <div className="md:hidden flex items-center gap-[5px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-full px-[10px] py-[4px]">
          <div className="w-[5px] h-[5px] rounded-full bg-[var(--accent)] animate-pulse-green flex-shrink-0" />
          <span className="font-mono text-[11px] font-semibold tracking-wide">
            {bcvRate ? `Bs. ${bcvRate.tasa_bcv.toFixed(2)}` : 'BCV ---'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-[12px] md:gap-[20px]">
        {/* BCV Pill - Desktop only */}
        <div className="hidden md:flex items-center gap-[8px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-full px-[16px] py-[6px]">
          <div className="w-[6px] h-[6px] rounded-full bg-[var(--accent)] animate-pulse-green"></div>
          <span className="font-mono text-[13px] font-medium tracking-wide">
            BCV: Bs. {bcvRate ? bcvRate.tasa_bcv.toFixed(2) : '---'}
          </span>
        </div>

        {/* Sync Button */}
        <button 
          onClick={() => handleSync(true)}
          disabled={isSyncing}
          title="Sincronizar con Binance"
          className="flex items-center gap-[8px] text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 p-[6px] md:p-0 hover:bg-[var(--bg-surface-3)] md:hover:bg-transparent rounded-[8px] md:rounded-none"
        >
          {syncStatus === 'success' ? (
             <CheckCircle2 size={18} className="text-[var(--profit)]" />
          ) : (
             <RefreshCw size={18} className={isSyncing ? 'animate-spin text-[var(--accent)]' : ''} />
          )}
          {syncStatus === 'success' ? (
            <span className="text-[var(--profit)] hidden md:inline">
              Actualizado {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          ) : (
            <span className="hidden md:inline">Sincronizar</span>
          )}
        </button>

        {/* Avatar */}
        <div className="w-[32px] h-[32px] md:w-[36px] md:h-[36px] rounded-full bg-[var(--bg-surface-3)] border border-[var(--border-strong)] flex items-center justify-center">
          <User size={16} className="text-[var(--text-secondary)]" />
        </div>
      </div>
    </header>
  );
};
