import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, User, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { fetchP2POrders } from '../../services/binance';
import { saveOrdersBulk, getOrdersForUser, getCyclesForUser, getActiveCycleForUser, recalculateCycleMetrics } from '../../services/dbOperations';
import { generateUUID } from '../../crypto/auth';
import type { Order } from '../../types';

export const Topbar: React.FC = () => {
  const { bcvRate, isSyncing, setIsSyncing, setLastSyncTime, binanceKeys, currentUser, setOrders, setActiveCycle, setCycles } = useAppStore();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const syncInProgress = useRef(false);

  const handleSync = async (isManual: boolean = false) => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    
    const currentState = useAppStore.getState();
    const user = currentState.currentUser;
    if (!currentState.binanceKeys || !user) {
      if (isManual) toast.error('Sesión de Binance expirada. Por favor cierra sesión y vuelve a entrar.');
      syncInProgress.current = false;
      return;
    }

    if (currentState.isSyncing) {
      syncInProgress.current = false;
      return;
    }

    setIsSyncing(true);
    setSyncStatus('syncing');

    try {
      // Optimización: páginas ajustables para obtener más órdenes históricas
      const requests = [];
      const tradeTypes = ['BUY', 'SELL'];
      const maxPages = 3;
      for (const t of tradeTypes) {
        for (let page = 1; page <= maxPages; page++) {
          requests.push(fetchP2POrders(currentState.binanceKeys!.apiKey, currentState.binanceKeys!.secretKey, page, t));
        }
      }
      
      const responses = await Promise.all(requests);
      let allBinanceOrders: any[] = [];
      responses.forEach(res => {
         if (res && res.data) {
            allBinanceOrders = allBinanceOrders.concat(res.data);
         }
      });
      
      // Deduplicate orders
      const uniqueOrdersMap = new Map();
      allBinanceOrders.forEach(o => {
        if (!uniqueOrdersMap.has(o.orderNumber)) {
          uniqueOrdersMap.set(o.orderNumber, o);
        }
      });
      const uniqueBinanceOrders = Array.from(uniqueOrdersMap.values());
      
      // Debug: contar tipos de órdenes
      const sellCount = uniqueBinanceOrders.filter(o => o.tradeType === 'SELL').length;
      const buyCount = uniqueBinanceOrders.filter(o => o.tradeType === 'BUY').length;
      console.log('[SYNC] SELL:', sellCount, 'BUY:', buyCount);
      
      console.log('[SYNC] Total órdenes de Binance:', allBinanceOrders.length);
      console.log('[SYNC] Órdenes únicas después deduplicar:', uniqueBinanceOrders.length);
      
      if (uniqueBinanceOrders.length > 0) {
        const existingOrders = await getOrdersForUser(user.id);
        const activeCycle = await getActiveCycleForUser(user.id);
        const cycleOpenedAt = activeCycle ? new Date(activeCycle.openedAt).getTime() : null;
        
        let addedCount = 0;
        const ordersToUpsert: Order[] = [];
        
        console.log('[SYNC] existingOrders:', existingOrders.length);
        console.log('[SYNC] uniqueBinanceOrders:', uniqueBinanceOrders.length);
        console.log('[SYNC] activeCycle:', activeCycle ? activeCycle.id : 'null');
        console.log('[SYNC] cycleOpenedAt:', cycleOpenedAt);

        for (const o of uniqueBinanceOrders) {
          try {
            const existingOrder = existingOrders.find(ex => ex.orderNumber === o.orderNumber);

            if (existingOrder) {
              if (existingOrder.orderStatus === 'DELETED') {
                continue;
              }

              let isUpdated = false;
              let updatedOrder = { ...existingOrder };

              // Check if status changed (e.g., from TRADING to COMPLETED)
              if (existingOrder.orderStatus !== o.orderStatus) {
                updatedOrder.orderStatus = o.orderStatus;
                isUpdated = true;
              }

              // Retroactive assignment: Si la orden existe, pero estaba huérfana, y ocurrió después de abrir el ciclo actual, la anexamos.
              if (!updatedOrder.cycleId && activeCycle && cycleOpenedAt) {
                const orderTime = new Date(o.createTime).getTime();
                if (orderTime >= cycleOpenedAt) {
                  updatedOrder.cycleId = activeCycle.id;
                  isUpdated = true;
                }
              }

              if (isUpdated) {
                ordersToUpsert.push(updatedOrder);
                addedCount++;
              }
              continue;
            }

            // Also update the existingOrders array locally so subsequent duplicates (if any bypassed map) are caught
            existingOrders.push({ ...o, id: generateUUID() } as any);

            let autoAssignedCycleId = null;
            const orderTime = new Date(o.createTime).getTime();

            // Auto-assign: If cycle is active and order occurred at or after cycle was opened
            if (activeCycle && cycleOpenedAt && orderTime >= cycleOpenedAt) {
              autoAssignedCycleId = activeCycle.id;
            }

            const importedOrder: Order = {
              id: generateUUID(),
              orderNumber: String(o.orderNumber || ''),
              tradeType: String(o.tradeType || '') as 'BUY' | 'SELL',
              asset: String(o.asset || ''),
              fiat: String(o.fiat || ''),
              totalPrice: parseFloat(o.totalPrice) || 0,
              unitPrice: parseFloat(o.unitPrice) || 0,
              amount: parseFloat(o.amount) || 0,
              commission: parseFloat(o.commission) || 0,
              commissionAsset: String(o.commissionAsset || o.asset || ''),
              counterPartNickName: String(o.counterPartNickName || 'Desconocido'),
              orderStatus: String(o.orderStatus || ''),
              createTime_utc: new Date(o.createTime).toISOString(),
              createTime_local: new Date(o.createTime).toLocaleString(),
              cycleId: autoAssignedCycleId,
              importedAt: new Date().toISOString(),
              userId: user.id
            };
            ordersToUpsert.push(importedOrder);
            addedCount++;
          } catch (rowError: any) {
             console.error('Error calculando orden en memoria:', o.orderNumber, rowError);
             throw new Error(`Error en orden ${o.orderNumber}: ${rowError.message}`);
          }
        }

        if (ordersToUpsert.length > 0) {
          try {
            await saveOrdersBulk(ordersToUpsert);
          } catch (bulkErr: any) {
            console.error('Error en saveOrdersBulk:', bulkErr);
            throw new Error(`Error guardando en BD: ${bulkErr.message}`);
          }
        }

        if (addedCount > 0 || (activeCycle && existingOrders.some(o => o.cycleId === activeCycle.id))) {
          if (activeCycle) {
            await recalculateCycleMetrics(activeCycle.id, user.id);
            console.log('[SYNC] Recálculo completado, obteniendo datos frescos...');
            // Refresh both activeCycle AND the full cycles array so all views stay in sync
            const [freshActiveCycle, freshCycles, freshOrders] = await Promise.all([
              getActiveCycleForUser(user.id),
              getCyclesForUser(user.id),
              getOrdersForUser(user.id),
            ]);
            console.log('[SYNC] freshActiveCycle:', freshActiveCycle ? `usdt_vendido=${freshActiveCycle.usdt_vendido}, usdt_recomprado=${freshActiveCycle.usdt_recomprado}` : 'null');
            setActiveCycle(freshActiveCycle);
            setCycles(freshCycles);
            setOrders(freshOrders);
          } else {
            setOrders(await getOrdersForUser(user.id));
          }
        }
      }

      setSyncStatus('success');
      setLastSyncTime(new Date());
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3000);
      
      console.log('[SYNC] Resumen:', {
        totalBinance: allBinanceOrders.length,
        unique: uniqueBinanceOrders.length,
      });
      
      if (isManual && uniqueBinanceOrders.length > 0) {
        toast.success(`Sincronización exitosa. Órdenes sincronizadas.`);
      } else if (isManual) {
        toast.success(`Sincronización exitosa. Cero órdenes retornadas usando tus llaves API: revisa si están activas o si tienen permisos.`);
      }
    } catch (e: any) {
      console.error('Excepción global en Sync:', e);
      setSyncStatus('error');
      setIsSyncing(false);
      if (isManual) {
        toast.error(`ERROR CRÍTICO: ${e.message}`, { duration: 6000 });
      }
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      syncInProgress.current = false;
    }
  };

  useEffect(() => {
    if (!currentUser || !binanceKeys) return;

    // Sync inmediato al montar
    handleSync(false);

    // OPTIMIZACIÓN FASE 1: Intervalo reducido de 20s a 15s
    // Con ciclo activo → cada 15s (más rápido sin saturar la API)
    // Sin ciclo activo → cada 45s (monitoreo más espaciado)
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = async () => {
      const { activeCycle } = useAppStore.getState();
      const delay = activeCycle ? 15_000 : 45_000;
      timeoutId = setTimeout(async () => {
        await handleSync(false);
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [currentUser?.id, binanceKeys?.apiKey]);

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
          <div className="w-[5px] h-[5px] rounded-full bg-[var(--accent)] flex-shrink-0" />
          <span className="font-mono text-[11px] font-semibold tracking-wide">
            {bcvRate ? `Bs. ${bcvRate.tasa_bcv.toFixed(2)}` : 'BCV ---'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-[12px] md:gap-[20px]">
        {/* BCV Pill - Desktop only */}
        <div className="hidden md:flex items-center gap-[8px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-full px-[16px] py-[6px]">
          <div className="w-[6px] h-[6px] rounded-full bg-[var(--accent)]"></div>
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
