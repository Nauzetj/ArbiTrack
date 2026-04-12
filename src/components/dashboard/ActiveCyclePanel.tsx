import React, { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { useAppStore } from '../../store/useAppStore';
import { saveCycle, deleteCycle, saveOrder, getOrdersForUser, getCyclesForUser, getActiveCycleForUser, recalculateCycleMetrics } from '../../services/dbOperations';
import toast from 'react-hot-toast';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { CycleTypeModal } from './CycleTypeModal';
import { generateUUID } from '../../crypto/auth';
import { PenLine, Zap, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import type { Cycle, Order } from '../../types';

const MAKER_FEES = {
  standard: 0.0025, // 0.25%
  bronze: 0.0020,   // 0.20%
  silver: 0.00175,  // 0.175%
  gold: 0.00125,    // 0.125%
  zero: 0.0000,     // 0% Promo
  manual: 'manual'  // Ingreso manual
};

const ManualOrderForm: React.FC<{
  cycleId: string;
  userId: string;
  onOrderSaved: () => void;
}> = ({ cycleId, userId, onOrderSaved }) => {
  const [tradeType, setTradeType] = useState<'SELL' | 'BUY'>('SELL');
  const [amount, setAmount] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  
  // Comisión state
  const [tier, setTier] = useState<number | 'manual'>(MAKER_FEES.standard);
  const [commission, setCommission] = useState('');
  const [isCommissionManuallyEdited, setIsCommissionManuallyEdited] = useState(false);
  
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const totalPrice = (parseFloat(amount) || 0) * (parseFloat(unitPrice) || 0);

  // Auto-calcular comisión cuando cambia monto o nivel, a menos que el usuario lo haya editado a mano
  React.useEffect(() => {
    if (tier !== 'manual' && !isCommissionManuallyEdited) {
      const amt = parseFloat(amount) || 0;
      if (amt > 0) {
        // Redondear a 4 decimales
        const calc = amt * (tier as number);
        setCommission(calc.toFixed(4).replace(/\.?0+$/, '')); // trim zeros
      } else {
        setCommission('');
      }
    }
  }, [amount, tier, isCommissionManuallyEdited]);

  const handleSave = async () => {
    const amountN = parseFloat(amount);
    const priceN = parseFloat(unitPrice);
    if (!amountN || amountN <= 0) { toast.error('Ingresa una cantidad válida de USDT.'); return; }
    if (!priceN || priceN <= 0) { toast.error('Ingresa un precio (tasa) válido.'); return; }

    setSaving(true);
    try {
      const order: Order = {
        id: generateUUID(),
        orderNumber: `MAN-${Date.now()}`,
        tradeType,
        asset: 'USDT',
        fiat: 'VES',
        totalPrice,
        unitPrice: priceN,
        amount: amountN,
        commission: parseFloat(commission) || 0,
        commissionAsset: 'USDT',
        counterPartNickName: notes.trim() || (tradeType === 'SELL' ? 'Venta manual' : 'Compra manual'),
        orderStatus: 'COMPLETED',
        createTime_utc: new Date().toISOString(),
        createTime_local: new Date().toLocaleString(),
        cycleId,
        importedAt: new Date().toISOString(),
        userId,
      };
      await saveOrder(order);
      await recalculateCycleMetrics(cycleId, userId);

      // Refresh store
      const { setOrders, setActiveCycle, setCycles } = useAppStore.getState();
      const [freshOrders, freshActiveCycle, freshCycles] = await Promise.all([
        getOrdersForUser(userId),
        getActiveCycleForUser(userId),
        getCyclesForUser(userId),
      ]);
      setOrders(freshOrders);
      setActiveCycle(freshActiveCycle);
      setCycles(freshCycles);

      toast.success(`Orden de ${tradeType === 'SELL' ? 'venta' : 'compra'} registrada.`);
      setAmount('');
      setUnitPrice('');
      setCommission('');
      setIsCommissionManuallyEdited(false);
      setNotes('');
      onOrderSaved();
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--bg-surface-3)] border border-[rgba(124,58,237,0.25)] rounded-[10px] p-[16px] flex flex-col gap-[12px] shadow-sm">
      {/* Header compact */}
      <div className="flex items-center gap-[8px] mb-[4px]">
        <PenLine size={12} className="text-[#a78bfa]" />
        <span className="text-[11px] font-bold text-[#a78bfa] uppercase tracking-wider">Registrar Orden Manual</span>
      </div>

      {/* Trade type toggle (Compacto) */}
      <div className="flex bg-[var(--bg-surface-2)] p-[3px] rounded-[8px] border border-[var(--border-strong)] gap-[2px] max-w-[280px]">
        <button
          onClick={() => setTradeType('SELL')}
          className={`flex-1 flex items-center justify-center gap-[4px] py-[6px] rounded-[6px] text-[12px] font-bold transition-all ${
            tradeType === 'SELL'
              ? 'bg-[var(--loss-bg)] text-[var(--loss)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <ArrowUpRight size={13} />
          Venta
        </button>
        <button
          onClick={() => setTradeType('BUY')}
          className={`flex-1 flex items-center justify-center gap-[4px] py-[6px] rounded-[6px] text-[12px] font-bold transition-all ${
            tradeType === 'BUY'
              ? 'bg-[var(--profit-bg)] text-[var(--profit)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <ArrowDownLeft size={13} />
          Compra
        </button>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px] mt-[4px]">
        
        {/* Monto */}
        <div className="flex flex-col gap-[4px]">
          <label className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            Cant. USDT *
          </label>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Ej: 150"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[8px] px-[10px] py-[7px] text-[12px] font-mono text-[var(--text-primary)] outline-none focus:border-[#7c3aed] transition-colors"
          />
        </div>

        {/* Precio */}
        <div className="flex flex-col gap-[4px]">
          <label className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            Precio (Bs) *
          </label>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Ej: 65.50"
            value={unitPrice}
            onChange={e => setUnitPrice(e.target.value)}
            className="w-full bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[8px] px-[10px] py-[7px] text-[12px] font-mono text-[var(--text-primary)] outline-none focus:border-[#7c3aed] transition-colors"
          />
        </div>

        {/* Comisión auto/manual */}
        <div className="flex flex-col gap-[4px]">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Comisión (USDT)
            </label>
          </div>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Ej: 0.50"
              value={commission}
              onChange={e => {
                setCommission(e.target.value);
                setIsCommissionManuallyEdited(true);
                setTier('manual');
              }}
              className="w-full bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[8px] px-[10px] py-[7px] pb-[16px] text-[12px] font-mono text-[var(--text-primary)] outline-none focus:border-[#7c3aed] transition-colors"
            />
            {/* Tiny selector inside input area for tier */}
            <select 
              className="absolute bottom-[2px] left-0 w-full px-[8px] bg-transparent text-[8.5px] font-bold text-[#a78bfa] outline-none cursor-pointer text-ellipsis overflow-hidden"
              value={tier}
              onChange={(e) => {
                const val = e.target.value;
                setTier(val === 'manual' ? 'manual' : parseFloat(val));
                if (val !== 'manual') setIsCommissionManuallyEdited(false);
              }}
            >
              <option value={MAKER_FEES.standard} className="bg-[var(--bg-surface-2)]">Binance Normal (0.25%)</option>
              <option value={MAKER_FEES.bronze} className="bg-[var(--bg-surface-2)]">🛡️ Bronce (0.20%)</option>
              <option value={MAKER_FEES.silver} className="bg-[var(--bg-surface-2)]">⚔️ Plata (0.175%)</option>
              <option value={MAKER_FEES.gold} className="bg-[var(--bg-surface-2)]">👑 Oro (0.125%)</option>
              <option value={MAKER_FEES.zero} className="bg-[var(--bg-surface-2)]">🎉 Promo (0%)</option>
              <option value="manual" className="bg-[var(--bg-surface-2)]">✍️ Ingreso Manual</option>
            </select>
          </div>
        </div>

        {/* Notas */}
        <div className="flex flex-col gap-[4px]">
          <label className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            Exchange
          </label>
          <input
            type="text"
            placeholder="Ej: Bybit / OKX"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[8px] px-[10px] py-[7px] text-[12px] text-[var(--text-primary)] outline-none focus:border-[#7c3aed] transition-colors"
          />
        </div>

      </div>

      {/* Footer Row: Total + Button */}
      <div className="flex items-center justify-between mt-[6px] gap-[16px] pt-[8px] border-t border-[var(--border)]">
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-secondary)] font-medium">Total a operar:</span>
          {totalPrice > 0 ? (
            <span className="font-mono font-bold text-[13px] text-[var(--text-primary)]">
              Bs. {totalPrice.toFixed(2)}
            </span>
          ) : (
             <span className="text-[13px] text-[var(--text-tertiary)]">-</span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-[6px] px-[24px] py-[8px] rounded-[8px] bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-[12px] transition-all disabled:opacity-60 shadow-[0_2px_10px_rgba(124,58,237,0.2)]"
        >
          {saving ? (
            <span className="animate-spin w-[13px] h-[13px] border-[1.5px] border-white border-t-transparent rounded-full inline-block" />
          ) : (
            <Plus size={13} />
          )}
          {saving ? 'Guardando' : `Registrar ${tradeType === 'SELL' ? 'Venta' : 'Compra'}`}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export const ActiveCyclePanel: React.FC = () => {
  const { activeCycle, setActiveCycle, currentUser, bcvRate, cycles, setCycles } = useAppStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  useGSAP(() => {
    if (!activeCycle) {
      gsap.to('.pulse-icon', {
        scale: 1.05,
        boxShadow: '0 0 20px rgba(0, 229, 195, 0.4)',
        y: -5,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    } else {
      gsap.fromTo('.cycle-stat-group',
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out', clearProps: 'all' }
      );
    }
  }, { dependencies: [activeCycle?.id], scope: panelRef });

  const handleOpenCycle = async (cycleType: 'p2p' | 'manual') => {
    if (!currentUser) return;

    const safeCycleNumber = Number(Date.now().toString().slice(-9));
    const newCycle: Cycle = {
      id: generateUUID(),
      cycleNumber: safeCycleNumber,
      openedAt: new Date().toISOString(),
      closedAt: null,
      status: 'En curso',
      cycleType,
      usdt_vendido: 0,
      usdt_recomprado: 0,
      ves_recibido: 0,
      ves_pagado: 0,
      comision_total: 0,
      ganancia_usdt: 0,
      ganancia_ves: 0,
      tasa_venta_prom: 0,
      tasa_compra_prom: 0,
      diferencial_tasa: 0,
      roi_percent: 0,
      tasa_bcv_dia: bcvRate ? bcvRate.tasa_bcv : 0,
      notas: '',
      userId: currentUser.id,
    };

    setShowTypeModal(false);
    setActiveCycle(newCycle);
    setCycles([newCycle, ...cycles]);

    const label = cycleType === 'p2p' ? 'P2P automático' : 'Multi-Exchange manual';
    toast.success(`¡Ciclo ${label} iniciado!`);

    saveCycle(newCycle).catch((err: any) => {
      console.error('Error saving cycle:', err);
      toast.error(`Error al guardar el ciclo: ${err.message || 'Inténtalo de nuevo'}`);
      setActiveCycle(null);
      setCycles(cycles);
    });
  };

  const handleCloseCycle = async () => {
    if (!activeCycle || !currentUser) return;
    setIsProcessing(true);
    try {
      const closedCycle = {
        ...activeCycle,
        status: 'Completado' as const,
        closedAt: new Date().toISOString(),
        tasa_bcv_dia: bcvRate ? bcvRate.tasa_bcv : activeCycle.tasa_bcv_dia
      };
      await saveCycle(closedCycle);
      setActiveCycle(null);
      setCycles(cycles.map(c => c.id === closedCycle.id ? closedCycle : c));
      setShowCloseModal(false);
      toast.success('Ciclo cerrado correctamente.');
    } catch (err: any) {
      console.error('Error closing cycle:', err);
      toast.error('Error al cerrar ciclo: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCycle = async () => {
    if (!activeCycle || !currentUser) return;
    setIsProcessing(true);
    try {
      await deleteCycle(activeCycle.id, currentUser.id);
      setActiveCycle(null);
      setCycles(cycles.filter(c => c.id !== activeCycle.id));
      setShowDeleteModal(false);
      toast.success('Ciclo eliminado');
    } catch (err: any) {
      console.error('Error deleting cycle:', err);
      toast.error('Error al eliminar ciclo: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!activeCycle) {
    return (
      <>
        <div ref={panelRef} className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[32px] flex flex-col items-center justify-center gap-[20px] h-full shadow-sm relative overflow-hidden transition-all hover:border-[var(--accent-muted)]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="pulse-icon w-[64px] h-[64px] rounded-full border border-[var(--border-strong)] flex items-center justify-center text-[var(--accent)] bg-[var(--accent-muted)] relative z-10 transition-colors hover:bg-[var(--accent)] hover:text-[#020B16]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" y1="5" x2="22" y2="5"/><line x1="19" y1="2" x2="19" y2="8"/></svg>
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-[16px] mb-[4px] text-[var(--text-primary)]">No hay ciclos en curso</h3>
            <p className="text-[var(--text-secondary)] text-[13px] max-w-[280px]">Inicia un nuevo ciclo para comenzar a agrupar tus órdenes de venta y recompra.</p>
          </div>
          <Button onClick={() => setShowTypeModal(true)} className="mt-[8px] text-[15px] px-[24px] py-[12px]">
            + Abrir nuevo ciclo
          </Button>
        </div>

        {/* Modal: Selección de tipo de ciclo */}
        <CycleTypeModal
          isOpen={showTypeModal}
          onClose={() => setShowTypeModal(false)}
          bcvTasa={bcvRate?.tasa_bcv}
          onConfirm={handleOpenCycle}
        />
      </>
    );
  }

  // ── Active cycle ────────────────────────────────────────────────────────────
  const resParcial = activeCycle.ganancia_usdt;
  const isLoss = resParcial < 0;
  const liquidezVES = activeCycle.ves_recibido - activeCycle.ves_pagado;
  const percentComplete = activeCycle.usdt_vendido > 0
    ? Math.min((activeCycle.usdt_recomprado / activeCycle.usdt_vendido) * 100, 100)
    : 0;

  const isManual = activeCycle.cycleType === 'manual';
  const cycleTypeLabel = isManual ? 'Multi-Exchange' : 'P2P Auto';
  const cycleTypeBg = isManual ? 'bg-[rgba(124,58,237,0.15)] text-[#a78bfa] border-[rgba(124,58,237,0.3)]' : 'bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent-border)]';

  return (
    <>
      <div ref={panelRef} className="bg-[var(--bg-surface-2)] rounded-[16px] border-t-2 border-[var(--accent)] border-x border-b border-x-[var(--border)] border-b-[var(--border)] p-[24px] flex flex-col gap-[20px] h-full shadow-[0_0_20px_rgba(0,229,195,0.06)] relative overflow-hidden transition-colors hover:border-[var(--accent-border)]">
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10 flex-wrap gap-[8px]">
          <div className="flex items-center gap-[10px]">
            <h2 className="font-bold text-[18px]">Ciclo #{activeCycle.cycleNumber.toString().slice(-4)}</h2>
            <Badge variant="accent">EN CURSO</Badge>
            {/* Cycle type badge */}
            <span className={`inline-flex items-center gap-[4px] text-[10px] font-bold px-[8px] py-[3px] rounded-full border uppercase tracking-wider ${cycleTypeBg}`}>
              {isManual ? <PenLine size={9} /> : <Zap size={9} />}
              {cycleTypeLabel}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] gap-y-[24px] relative z-10">
          <div className="flex flex-col cycle-stat-group">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">USDT Vendido</span>
            <span className="mono text-[18px] font-medium">{activeCycle.usdt_vendido.toFixed(2)}</span>
          </div>
          <div className="flex flex-col cycle-stat-group">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">USDT Recomprado</span>
            <span className="mono text-[18px] font-medium">{activeCycle.usdt_recomprado.toFixed(2)}</span>
          </div>
          <div className="flex flex-col cycle-stat-group">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">Liquidez Neta</span>
            <span className={`mono text-[18px] font-medium ${liquidezVES < 0 ? 'text-loss' : 'text-[var(--text-primary)]'}`}>
              {liquidezVES.toFixed(2)}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)] mt-[2px]">Bolívares (VES)</span>
          </div>
          <div className="flex flex-col cycle-stat-group">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">Resultado Parcial</span>
            <span className={`mono text-[18px] font-medium ${isLoss ? 'text-loss' : 'text-profit'}`}>
              {resParcial > 0 ? '+' : ''}<span>{resParcial.toFixed(2)}</span> USDT
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--text-secondary)]">Progreso estimado de recompra</span>
            <span className="mono">{percentComplete.toFixed(0)}%</span>
          </div>
          <div className="w-full h-[6px] bg-[var(--bg-surface-4)] rounded-full relative overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--accent-muted)] to-[var(--accent)] transition-all duration-500 rounded-full"
              style={{ width: `${percentComplete}%` }}
            />
            {percentComplete > 0 && percentComplete < 100 && (
              <div className="animate-shimmer" />
            )}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">
            {percentComplete < 100
              ? `Faltan ~${Math.max(0, activeCycle.usdt_vendido - activeCycle.usdt_recomprado).toFixed(2)} USDT por recomprar para cerrar neutro.`
              : 'Recompra cubierta. Verifica los diferenciales.'}
          </div>
        </div>

        {/* Manual form — only for 'manual' cycle type */}
        {isManual && (
          <div className="relative z-10">
            {showManualForm ? (
              <ManualOrderForm
                cycleId={activeCycle.id}
                userId={currentUser!.id}
                onOrderSaved={() => setShowManualForm(false)}
              />
            ) : (
              <button
                onClick={() => setShowManualForm(true)}
                className="w-full flex items-center justify-center gap-[8px] py-[10px] rounded-[12px] border-2 border-dashed border-[rgba(124,58,237,0.4)] text-[#a78bfa] text-[13px] font-semibold hover:border-[#7c3aed] hover:bg-[rgba(124,58,237,0.06)] transition-all"
              >
                <Plus size={15} />
                Registrar orden manualmente
              </button>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-auto flex items-center justify-between pt-[16px] border-t border-[var(--border-strong)]">
          <span className="text-[12px] text-[var(--text-secondary)]">
            Abierto el {new Date(activeCycle.openedAt).toLocaleDateString()} a las {new Date(activeCycle.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex gap-[12px]">
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              Eliminar Ciclo
            </Button>
            <Button
              variant="danger"
              onClick={() => setShowCloseModal(true)}
              disabled={activeCycle.usdt_vendido === 0 || activeCycle.usdt_recomprado === 0}
            >
              Cerrar Ciclo
            </Button>
          </div>
        </div>
      </div>

      {/* Modal: Eliminar Ciclo */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isProcessing && setShowDeleteModal(false)}
        title="Eliminar ciclo permanentemente"
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onConfirm={handleDeleteCycle}
        confirmVariant="danger"
        icon="danger"
        loading={isProcessing}
      >
        <p>
          Estás a punto de eliminar el{' '}
          <strong className="text-[var(--text-primary)]">
            Ciclo #{activeCycle.cycleNumber.toString().slice(-4)}
          </strong>{' '}
          y todas las métricas asociadas a él.
        </p>
        <p className="mt-[8px] text-[#ff4e4e]/80 text-[12.5px] font-medium">
          ⚠️ Esta acción no se puede deshacer.
        </p>
      </Modal>

      {/* Modal: Cerrar Ciclo */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => !isProcessing && setShowCloseModal(false)}
        title="Cerrar ciclo de trading"
        confirmText="Sí, cerrar ciclo"
        cancelText="Seguir operando"
        onConfirm={handleCloseCycle}
        confirmVariant="danger"
        icon="info"
        loading={isProcessing}
      >
        <p>
          El ciclo se marcará como <strong className="text-[var(--text-primary)]">Completado</strong> y ya no podrás agregar más órdenes a él.
        </p>
        <div className="mt-[12px] grid grid-cols-2 gap-[8px]">
          <div className="bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[10px] p-[10px]">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Resultado</span>
            <p className={`mono text-[15px] font-bold mt-[2px] ${isLoss ? 'text-[#ff4e4e]' : 'text-[var(--accent)]'}`}>
              {resParcial >= 0 ? '+' : ''}{resParcial.toFixed(2)} USDT
            </p>
          </div>
          <div className="bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[10px] p-[10px]">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Progreso</span>
            <p className="mono text-[15px] font-bold mt-[2px] text-[var(--text-primary)]">
              {percentComplete.toFixed(0)}%
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};
