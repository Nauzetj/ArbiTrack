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
      // Obtener cycle info PRIMERO para filtrar por fecha
      const [existingOrders, activeCycle] = await Promise.all([
        getOrdersForUser(user.id),
        getActiveCycleForUser(user.id),
      ]);
      
      // CLAVE: Usar la orden más reciente del ciclo como punto de partida
      // Esto evita procesar órdenes antiguas en cada sync
      let lastOrderTimeMs: number | null = null;
      if (activeCycle) {
        const cycleOrders = existingOrders.filter(o => o.cycleId === activeCycle.id);
        if (cycleOrders.length > 0) {
          const latestCycleOrder = cycleOrders.reduce((latest, o) => {
            const oTime = new Date(o.createTime_utc).getTime();
            return oTime > latest ? oTime : latest;
          }, 0);
          lastOrderTimeMs = latestCycleOrder;
          console.log('[SYNC] Última orden del ciclo:', new Date(lastOrderTimeMs).toISOString());
        }
      }
      
      const cycleOpenedAtVal = activeCycle ? new Date(activeCycle.openedAt).getTime() : null;
      console.log('[SYNC] Ciclo activo:', activeCycle ? 'sí' : 'no');
      console.log('[SYNC] cycleOpenedAtVal:', cycleOpenedAtVal ? new Date(cycleOpenedAtVal).toISOString() : 'sin ciclo');
      
      // Obtener órdenes de Binance EN PARALELO (más rápido)
      // Con ciclo activo: 5 páginas (100 órdenes por tipo) para no perder nada
      // Sin ciclo activo: 1 página (20 órdenes) para monitoreo ligero
      const maxPages = activeCycle ? 5 : 1;
      const requests = [];
      
      for (let page = 1; page <= maxPages; page++) {
        requests.push(fetchP2POrders(currentState.binanceKeys!.apiKey, currentState.binanceKeys!.secretKey, page, 'BUY'));
        requests.push(fetchP2POrders(currentState.binanceKeys!.apiKey, currentState.binanceKeys!.secretKey, page, 'SELL'));
      }
      
      // Ejecutar TODAS las requests en paralelo
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
      let uniqueBinanceOrders = Array.from(uniqueOrdersMap.values());
      
      // Filtrar órdenes anteriores a la apertura del ciclo (con margen de 60min)
      // para capturar órdenes que se registraron justo antes de abrir formalmente el ciclo.
      const filterStartMs = cycleOpenedAtVal ? cycleOpenedAtVal - (60 * 60 * 1000) : null;
      if (filterStartMs) {
        uniqueBinanceOrders = uniqueBinanceOrders.filter(o => {
          const orderTime = new Date(o.createTime).getTime();
          return orderTime >= filterStartMs;
        });
        console.log('[SYNC] Órdenes desde 60min antes de apertura:', uniqueBinanceOrders.length);
      }
      
      // Debug: contar tipos de órdenes
      const sellCount = uniqueBinanceOrders.filter(o => o.tradeType === 'SELL').length;
      const buyCount = uniqueBinanceOrders.filter(o => o.tradeType === 'BUY').length;
      console.log('[SYNC] SELL:', sellCount, 'BUY:', buyCount);
      
      // Debug: mostrar las 3 órdenes más recientes
      const sortedByTime = [...uniqueBinanceOrders].sort((a, b) => 
        new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
      );
      console.log('[SYNC] Órdenes más recientes:', sortedByTime.slice(0, 3).map(o => ({
        orderNumber: o.orderNumber,
        createTime: new Date(o.createTime).toISOString(),
        createTimeMs: new Date(o.createTime).getTime(),
        tradeType: o.tradeType,
        orderStatus: o.orderStatus,
        amount: o.amount,
      })));
      
      // Debug: mostrar primeras 5 órdenes para verificar estructura
      console.log('[SYNC] Primeras órdenessample:', uniqueBinanceOrders.slice(0, 5).map(o => ({
        orderNumber: o.orderNumber,
        createTime: o.createTime,
        tradeType: o.tradeType,
        orderStatus: o.orderStatus,
        amount: o.amount,
      })));
      
      console.log('[SYNC] Total órdenes de Binance:', allBinanceOrders.length);
      console.log('[SYNC] Órdenes únicas después deduplicar:', uniqueBinanceOrders.length);
      
      if (uniqueBinanceOrders.length > 0) {
        let addedCount = 0;
        const ordersToUpsert: Order[] = [];
        
        console.log('[SYNC] existingOrders:', existingOrders.length);
        console.log('[SYNC] uniqueBinanceOrders filtradas:', uniqueBinanceOrders.length);
        console.log('[SYNC] activeCycle:', activeCycle ? activeCycle.id : 'null');

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

              if (isUpdated) {
                ordersToUpsert.push(updatedOrder);
                addedCount++;
              }
              continue;
            }

            // Nueva orden - asignar al ciclo activo
            existingOrders.push({ ...o, id: generateUUID() } as any);

            let autoAssignedCycleId: string | null = null;
            if (activeCycle && cycleOpenedAtVal) {
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

        if (addedCount > 0) {
          if (activeCycle) {
            await recalculateCycleMetrics(activeCycle.id, user.id);
            console.log('[SYNC] Recálculo completado, actualizando UI...');
            
            // Obtener datos frescos sin vaciar el estado para evitar parpadeos/congelamientos
            const [freshActiveCycle, freshCycles, freshOrders] = await Promise.all([
              getActiveCycleForUser(user.id),
              getCyclesForUser(user.id),
              getOrdersForUser(user.id),
            ]);
            
            setActiveCycle(freshActiveCycle);
            setCycles(freshCycles);
            setOrders(freshOrders);
            console.log('[SYNC] UI actualizada');
          } else {
            const freshOrders = await getOrdersForUser(user.id);
            setOrders(freshOrders);
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
    <header className="h-[56px] md:h-[64px] fixed top-0 right-0 left-0 md:left-[220px] bg-[var(--bg-base)]/80 backdrop-blur-md border-b border-[var(--border)] z-40 flex items-center justify-between px-[16px] md:px-[32px]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Left: Logo (mobile only) */}
      <div className="flex-1 flex items-center">
        <div className="md:hidden flex items-center gap-[8px]">
          <div className="w-[28px] h-[28px] bg-[var(--accent)] rounded-[7px] flex items-center justify-center flex-shrink-0 opacity-90">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Center: Floating Pill */}
      <div className="flex-shrink-0 flex items-center justify-center">
        <div className="flex items-center gap-[8px] bg-[var(--bg-surface-3)]/60 border border-[var(--border-strong)] rounded-full px-[14px] py-[4px] md:py-[6px] shadow-sm">
          <div className="w-[6px] h-[6px] rounded-full bg-[var(--accent)] animate-pulse-green" style={{ backgroundColor: 'var(--accent)' }}></div>
          <span className="font-mono text-[12px] md:text-[13px] font-medium tracking-wide">
            {bcvRate ? `Tasa BCV Bs.S ${bcvRate.tasa_bcv.toFixed(2)}` : 'BCV ---'}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex-1 flex items-center justify-end gap-[12px] md:gap-[20px]">
        {/* Sync Button */}
        <button 
          onClick={() => handleSync(true)}
          disabled={isSyncing}
          title="Sincronizar con Binance"
          className="flex items-center justify-center w-[36px] h-[36px] md:w-auto md:h-auto md:gap-[8px] text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 hover:bg-[var(--bg-surface-3)] md:hover:bg-transparent rounded-full md:rounded-none"
        >
          {syncStatus === 'success' ? (
             <CheckCircle2 size={18} className="text-[var(--profit)]" />
          ) : (
             <RefreshCw size={18} className={isSyncing ? 'animate-spin text-[var(--accent)]' : ''} />
          )}
          {syncStatus === 'success' ? (
            <span className="text-[var(--profit)] hidden md:inline">
              {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          ) : (
            <span className="hidden md:inline">Sincronizar</span>
          )}
        </button>

        {/* Avatar */}
        <div className="w-[32px] h-[32px] md:w-[36px] md:h-[36px] rounded-full bg-[var(--bg-surface-2)] border border-[var(--border-strong)] flex items-center justify-center shadow-sm">
          <User size={16} className="text-[var(--text-secondary)]" />
        </div>
      </div>
    </header>
  );
};
