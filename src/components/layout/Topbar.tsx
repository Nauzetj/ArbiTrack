import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, User, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { fetchP2POrders } from '../../services/binance';
import { saveOrdersBulk, getOrdersForUser, getCyclesForUser, getActiveCycleForUser, recalculateCycleMetrics } from '../../services/dbOperations';
import { generateUUID } from '../../crypto/auth';
import { ArbiBot } from '../ui/ArbiBot';
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
      setIsSyncing(false);
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
      
      // Obtener órdenes de Binance con carga inteligente y resiliente
      let allBinanceOrders: any[] = [];
      const apiKey = currentState.binanceKeys!.apiKey;
      const secretKey = currentState.binanceKeys!.secretKey;

      if (!isManual) {
        // En auto-sync de fondo: solo página 1 (las 100 más recientes de BUY y SELL)
        const [buyRes, sellRes] = await Promise.allSettled([
          fetchP2POrders(apiKey, secretKey, 1, 'BUY'),
          fetchP2POrders(apiKey, secretKey, 1, 'SELL'),
        ]);

        if (buyRes.status === 'fulfilled' && Array.isArray(buyRes.value?.data)) {
          allBinanceOrders.push(...buyRes.value.data);
        }
        if (sellRes.status === 'fulfilled' && Array.isArray(sellRes.value?.data)) {
          allBinanceOrders.push(...sellRes.value.data);
        }
      } else {
        // En sync manual: recorrer hasta 5 páginas de forma controlada y con parada temprana
        let hasMoreBuy = true;
        let hasMoreSell = true;
        const maxPages = 5;

        for (let page = 1; page <= maxPages; page++) {
          if (!hasMoreBuy && !hasMoreSell) break;

          const batchPromises: Promise<any>[] = [];
          if (hasMoreBuy) batchPromises.push(fetchP2POrders(apiKey, secretKey, page, 'BUY'));
          if (hasMoreSell) batchPromises.push(fetchP2POrders(apiKey, secretKey, page, 'SELL'));

          const results = await Promise.allSettled(batchPromises);
          let resultIdx = 0;

          if (hasMoreBuy) {
            const r = results[resultIdx++];
            if (r.status === 'fulfilled' && Array.isArray(r.value?.data)) {
              allBinanceOrders.push(...r.value.data);
              if (r.value.data.length < 100) hasMoreBuy = false;
            } else {
              hasMoreBuy = false;
            }
          }

          if (hasMoreSell) {
            const r = results[resultIdx++];
            if (r.status === 'fulfilled' && Array.isArray(r.value?.data)) {
              allBinanceOrders.push(...r.value.data);
              if (r.value.data.length < 100) hasMoreSell = false;
            } else {
              hasMoreSell = false;
            }
          }
        }
      }

      // Deduplicate orders
      const uniqueOrdersMap = new Map();
      allBinanceOrders.forEach(o => {
        if (!uniqueOrdersMap.has(o.orderNumber)) {
          uniqueOrdersMap.set(o.orderNumber, o);
        }
      });
      let uniqueBinanceOrders = Array.from(uniqueOrdersMap.values());
      
      // Se eliminó filterStartMs para permitir que órdenes antiguas se actualicen 
      // a COMPLETED en la base de datos sin ser descartadas prematuramente.
      
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

              // FIX: Auto-assign if it was saved without cycle but belongs to the active cycle's timeframe
              // Margen amplio (15 días) porque las órdenes en Binance pueden dejarse abiertas varios días.
              if (!existingOrder.cycleId && activeCycle && cycleOpenedAtVal) {
                const orderTime = new Date(o.createTime).getTime();
                const margin15Days = 15 * 24 * 60 * 60 * 1000;
                if (orderTime >= cycleOpenedAtVal - margin15Days) {
                  updatedOrder.cycleId = activeCycle.id;
                  isUpdated = true;
                }
              }

              // FIX: Ensure operationType is set for older orders that might have it as null
              if (!existingOrder.operationType) {
                updatedOrder.operationType = o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT';
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
              const orderTime = new Date(o.createTime).getTime();
              const margin15Days = 15 * 24 * 60 * 60 * 1000;
              if (orderTime >= cycleOpenedAtVal - margin15Days) {
                autoAssignedCycleId = activeCycle.id;
              }
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
              userId: user.id,
              operationType: o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT'
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
            
            if (activeCycle) {
              // Obtener todos los cycleIds únicos que fueron afectados por esta actualización
              const affectedCycleIds = new Set<string>();
              affectedCycleIds.add(activeCycle.id); // Siempre recalculamos el activo por si acaso
              
              ordersToUpsert.forEach(o => {
                if (o.cycleId) affectedCycleIds.add(o.cycleId);
              });

              // Recalcular todos los ciclos afectados
              const recalculatePromises = Array.from(affectedCycleIds).map(cId => 
                recalculateCycleMetrics(cId, user.id)
              );
              await Promise.all(recalculatePromises);
            }
          } catch (bulkErr: any) {
            console.error('Error en saveOrdersBulk:', bulkErr);
            throw new Error(`Error guardando en BD: ${bulkErr.message}`);
          }
        }

        // Si se agregaron/actualizaron órdenes O si el usuario presionó el botón Sync manual,
        // SIEMPRE refrescamos desde Supabase para garantizar que la UI muestre todo actualizado.
        if (addedCount > 0 || isManual) {
          if (activeCycle) {
            console.log('[SYNC] Recálculo completado, actualizando UI...');
            const [freshActiveCycle, freshCycles, freshOrders] = await Promise.all([
              getActiveCycleForUser(user.id),
              getCyclesForUser(user.id),
              getOrdersForUser(user.id),
            ]);
            
            setActiveCycle(freshActiveCycle);
            setCycles(freshCycles);
            setOrders(freshOrders);
            console.log('[SYNC] UI actualizada con ciclo activo');
          } else {
            const [freshCycles, freshOrders] = await Promise.all([
              getCyclesForUser(user.id),
              getOrdersForUser(user.id),
            ]);
            setCycles(freshCycles);
            setOrders(freshOrders);
          }
        }
      } else if (isManual) {
        // Aunque Binance no haya devuelto órdenes nuevas en este instante,
        // en sync manual refrescamos la UI desde Supabase
        const [freshActiveCycle, freshCycles, freshOrders] = await Promise.all([
          getActiveCycleForUser(user.id),
          getCyclesForUser(user.id),
          getOrdersForUser(user.id),
        ]);
        setActiveCycle(freshActiveCycle);
        setCycles(freshCycles);
        setOrders(freshOrders);
      }

      setSyncStatus('success');
      setLastSyncTime(new Date());
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3000);
      
      console.log('[SYNC] Resumen:', {
        totalBinance: allBinanceOrders.length,
        unique: uniqueBinanceOrders.length,
      });
      
      if (isManual) {
        if (uniqueBinanceOrders.length > 0) {
          toast.success(`Sincronización completa. Datos actualizados.`);
        } else {
          toast('Todo al día. No hay órdenes nuevas en Binance.', { icon: '✅' });
        }
      }
    } catch (e: any) {
      console.error('Excepción global en Sync:', e);
      setSyncStatus('error');
      setIsSyncing(false);
      if (isManual) {
        toast.error(`Error al sincronizar: ${e.message}`, { duration: 6000 });
      }
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  };

  useEffect(() => {
    if (!currentUser || !binanceKeys) return;

    // Sync inicial al montar la vista
    handleSync(false);

    // Intervalo de auto-sync seguro para evitar rate limits de Binance C2C:
    // Con ciclo activo: cada 35 segundos.
    // Sin ciclo activo: cada 60 segundos.
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const { activeCycle } = useAppStore.getState();
      const delay = activeCycle ? 35_000 : 60_000;
      timeoutId = setTimeout(async () => {
        // Si la pestaña no está visible (minimizada o en segundo plano),
        // no gastamos cuota de peticiones de Binance.
        if (typeof document !== 'undefined' && document.hidden) {
          scheduleNext();
          return;
        }
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
        <div className="md:hidden flex items-center gap-[7px]">
          {/* ArbiBot with glow ring */}
          <div className="relative flex items-center justify-center w-[34px] h-[34px]">
            <div className="absolute inset-0 rounded-full opacity-40"
              style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.6) 0%, transparent 70%)' }} />
            <ArbiBot size={30} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-[14px] tracking-tight text-[var(--text-primary)]">ArbiTrack</span>
            <span className="text-[8px] font-semibold text-[var(--accent)] uppercase tracking-[1.2px] opacity-80">AI P2P</span>
          </div>
        </div>
      </div>

      {/* Center: Floating Pill — compact on mobile, full on desktop */}
      <div className="flex-shrink-0 flex items-center justify-center">
        <div
          className="flex items-center gap-[5px] md:gap-[8px] border rounded-full shadow-sm relative overflow-hidden"
          style={{
            background: 'var(--bg-surface-3)',
            borderColor: 'var(--border-strong)',
            padding: '3px 10px 3px 8px',
          }}
        >
          {/* Shimmer sweep */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.12) 50%, transparent 100%)',
              animation: 'bcv-shimmer 2.4s ease-in-out infinite',
            }}
          />
          {/* Live dot */}
          <div
            className="relative flex-shrink-0"
            style={{
              width: 6, height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--accent)',
              boxShadow: '0 0 0 0 rgba(59,130,246,0.6)',
              animation: 'bcv-dot-pulse 1.8s ease-out infinite',
            }}
          />
          {/* Mobile: short label */}
          <span className="font-mono font-semibold tracking-wide md:hidden" style={{ fontSize: 10, color: 'var(--text-primary)' }}>
            {bcvRate ? `${bcvRate.tasa_bcv.toFixed(0)} Bs` : '---'}
          </span>
          {/* Desktop: full label */}
          <span className="font-mono font-medium tracking-wide hidden md:inline" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
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
