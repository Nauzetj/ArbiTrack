import React, { useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import {
  saveCycle, deleteCycle, saveOrder, deleteOrder,
  getOrdersForUser, getCyclesForUser, getActiveCycleForUser,
  recalculateCycleMetrics,
} from '../../services/dbOperations';
import toast from 'react-hot-toast';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { CycleTypeModal } from './CycleTypeModal';
import { generateUUID } from '../../crypto/auth';
import {
  PenLine, Zap, Plus, Trash2, Edit3, X,
  Copy, RotateCcw, TrendingUp, TrendingDown, Minus,
  ArrowUpRight, ArrowDownLeft, RefreshCw, Banknote, CreditCard,
  Bolt, CheckCircle2, Clock,
} from 'lucide-react';
import type { Cycle, Order, OperationType, CommissionType, OriginMode } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAKER_FEES = {
  standard: 0.0025,
  bronze:   0.0020,
  silver:   0.00175,
  gold:     0.00125,
  zero:     0.0000,
};

const OP_TYPES: { value: OperationType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'VENTA_USDT',    label: 'Venta USDT',    icon: <ArrowUpRight size={12}/>,  color: 'var(--loss)' },
  { value: 'COMPRA_USDT',   label: 'Compra USDT',   icon: <ArrowDownLeft size={12}/>, color: 'var(--profit)' },
  { value: 'RECOMPRA',      label: 'Recompra',       icon: <RefreshCw size={12}/>,     color: 'var(--accent)' },
  { value: 'COMPRA_USD',    label: 'Compra USD',     icon: <Banknote size={12}/>,      color: '#f59e0b' },
  { value: 'TRANSFERENCIA', label: 'Transferencia',  icon: <CreditCard size={12}/>,    color: '#a78bfa' },
  { value: 'SOBRANTE',      label: 'Sobrante',       icon: <CheckCircle2 size={12}/>,  color: '#34d399' },
];

function getOpMeta(t?: OperationType) {
  return OP_TYPES.find(o => o.value === t) ?? OP_TYPES[0];
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmt(n: number, digits = 2) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
}

// ─── Inline Unified Form ──────────────────────────────────────────────────────

interface FormData {
  mode: OriginMode;
  opType: OperationType;
  exchange: string;
  rate: string;
  amount: string;
  totalPrice: string;
  orderRef: string;
  counterpart: string;
  commission: string;
  commissionType: CommissionType;
  commissionCalc: string;
  datetime: string;
  notas: string;
}

const defaultForm = (opSeq: number): FormData => ({
  mode: 'manual',
  opType: 'VENTA_USDT',
  exchange: '',
  rate: '',
  amount: '',
  totalPrice: '',
  orderRef: `MAN-${opSeq.toString().padStart(4, '0')}`,
  counterpart: '',
  commission: '',
  commissionType: 'fixed',
  commissionCalc: '',
  datetime: new Date().toISOString().slice(0, 16),
  notas: '',
});

interface UnifiedFormProps {
  cycleId: string;
  userId: string;
  opSeq: number;
  editingOrder?: Order | null;
  onSaved: () => void;
  onCancel: () => void;
  compact?: boolean; // true = modal de venta rápida
}

const UnifiedForm: React.FC<UnifiedFormProps> = React.memo(({
  cycleId, userId, opSeq, editingOrder, onSaved, onCancel, compact = false,
}) => {
  const [form, setForm] = useState<FormData>(() => {
    if (editingOrder) {
      const commCalc = editingOrder.commissionType === 'percent'
        ? ((parseFloat('0') || 0) * ((parseFloat(editingOrder.commission.toString()) || 0) / 100)).toFixed(4)
        : editingOrder.commission.toFixed(4);
      return {
        mode: editingOrder.originMode ?? 'manual',
        opType: editingOrder.operationType ?? 'VENTA_USDT',
        exchange: editingOrder.exchange ?? '',
        rate: editingOrder.unitPrice.toString(),
        amount: editingOrder.amount.toString(),
        totalPrice: editingOrder.totalPrice.toString(),
        orderRef: editingOrder.orderNumber,
        counterpart: editingOrder.counterPartNickName,
        commission: editingOrder.commission.toString(),
        commissionType: editingOrder.commissionType ?? 'fixed',
        commissionCalc: commCalc,
        datetime: editingOrder.createTime_utc.slice(0, 16),
        notas: editingOrder.notas ?? '',
      };
    }
    return defaultForm(opSeq);
  });

  const [saving, setSaving] = useState(false);
  const [totalEdited, setTotalEdited] = useState(false);
  const [commEdited, setCommEdited] = useState(false);

  const set = useCallback((k: keyof FormData, v: string) =>
    setForm(prev => ({ ...prev, [k]: v })), []);

  React.useEffect(() => {
    const handleFill = (e: CustomEvent<any>) => {
      const data = e.detail;
      setForm(prev => ({
        ...prev,
        ...(data.opType && { opType: data.opType }),
        ...(data.mode && { mode: data.mode }),
        ...(data.amount && { amount: data.amount }),
        ...(data.rate && { rate: data.rate }),
        ...(data.exchange && { exchange: data.exchange }),
        ...(data.counterpart && { counterpart: data.counterpart }),
      }));
      setTotalEdited(false);
      setCommEdited(false);
    };
    window.addEventListener('arbi:fill-form', handleFill as EventListener);
    return () => window.removeEventListener('arbi:fill-form', handleFill as EventListener);
  }, []);

  // Auto-calc total
  const rate = parseFloat(form.rate) || 0;
  const amount = parseFloat(form.amount) || 0;
  const autoTotal = rate * amount;

  React.useEffect(() => {
    if (!totalEdited && rate > 0 && amount > 0) {
      setForm(prev => ({ ...prev, totalPrice: autoTotal.toFixed(2) }));
    }
  }, [rate, amount, totalEdited]);

  // Auto-calc commission
  const commissionRate = parseFloat(form.commission) || 0;
  React.useEffect(() => {
    if (!commEdited) {
      if (form.commissionType === 'percent' && amount > 0 && commissionRate > 0) {
        const calc = (amount * (commissionRate / 100)).toFixed(4);
        setForm(prev => ({ ...prev, commissionCalc: calc }));
      } else if (form.commissionType === 'fixed') {
        setForm(prev => ({ ...prev, commissionCalc: form.commission }));
      }
    }
  }, [form.commission, form.commissionType, amount, commEdited]);

  const opMeta = getOpMeta(form.opType);

  const handleSave = async () => {
    const amountN = parseFloat(form.amount);
    const totalN = parseFloat(form.totalPrice);

    if (!amountN || amountN <= 0) { toast.error('Ingresa una cantidad válida.'); return; }
    if (!['TRANSFERENCIA', 'SOBRANTE'].includes(form.opType) && (!totalN || totalN <= 0)) {
      toast.error('Ingresa el valor total.'); return;
    }

    const commFinal = parseFloat(form.commissionCalc || form.commission) || 0;
    // Map operationType to legacy tradeType for compatibility
    const legacyTradeType = ['VENTA_USDT', 'RECOMPRA', 'SOBRANTE'].includes(form.opType) ? 'SELL' : 'BUY';

    const order: Order = {
      id: editingOrder?.id ?? generateUUID(),
      orderNumber: form.orderRef.trim() || `MAN-${Date.now()}`,
      tradeType: legacyTradeType,
      operationType: form.opType,
      commissionType: form.commissionType,
      originMode: form.mode,
      exchange: form.exchange.trim() || undefined,
      asset: 'USDT',
      fiat: 'VES',
      totalPrice: totalN || 0,
      unitPrice: parseFloat(form.rate) || 0,
      amount: amountN,
      commission: commFinal,
      commissionAsset: form.commissionType === 'percent' ? '%' : 'USDT',
      counterPartNickName: form.counterpart.trim() || opMeta.label,
      orderStatus: 'COMPLETED',
      createTime_utc: new Date(form.datetime).toISOString(),
      createTime_local: new Date(form.datetime).toLocaleString(),
      cycleId,
      importedAt: new Date().toISOString(),
      userId,
      notas: form.notas.trim() || undefined,
    };

    setSaving(true);
    try {
      await saveOrder(order);
      await recalculateCycleMetrics(cycleId, userId);
      const { setOrders, setActiveCycle, setCycles } = useAppStore.getState();
      const [freshOrders, freshActiveCycle, freshCycles] = await Promise.all([
        getOrdersForUser(userId),
        getActiveCycleForUser(userId),
        getCyclesForUser(userId),
      ]);
      setOrders(freshOrders);
      setActiveCycle(freshActiveCycle);
      setCycles(freshCycles);
      toast.success(editingOrder ? 'Operación actualizada.' : `${opMeta.label} registrada.`);
      onSaved();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = `w-full bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[8px]
    px-[10px] py-[7px] text-[12px] font-mono text-[var(--text-primary)] outline-none
    focus:border-[var(--accent)] transition-colors placeholder-[var(--text-tertiary)]`;
  const labelCls = `text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-[3px] block`;

  return (
    <div className={`flex flex-col gap-[14px] ${compact ? '' : 'bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[12px] p-[18px]'}`}>

      {/* ── Row 0: Header + Mode toggle ── */}
      <div className="flex items-center justify-between flex-wrap gap-[10px]">
        <div className="flex items-center gap-[8px]">
          {compact ? <Bolt size={14} className="text-[var(--warning)]"/> : <PenLine size={13} className="text-[var(--accent)]"/>}
          <span className="text-[12px] font-bold text-[var(--text-primary)]">
            {editingOrder ? 'Editar Operación' : compact ? 'Venta Rápida' : 'Registrar Operación'}
          </span>
        </div>

        {/* Mode selector */}
        <div className="flex bg-[var(--bg-surface-2)] p-[3px] rounded-[8px] border border-[var(--border-strong)] gap-[2px]">
          {(['auto', 'manual'] as OriginMode[]).map(m => (
            <button
              key={m}
              onClick={() => set('mode', m)}
              className={`flex items-center gap-[5px] px-[10px] py-[5px] rounded-[6px] text-[11px] font-bold transition-all ${
                form.mode === m
                  ? m === 'auto'
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'bg-[rgba(124,58,237,0.2)] text-[#a78bfa] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {m === 'auto' ? <Zap size={10}/> : <PenLine size={10}/>}
              {m === 'auto' ? 'Automático' : 'Manual'}
            </button>
          ))}
        </div>
      </div>

      {/* Mode hint */}
      <div className={`flex items-center gap-[6px] px-[10px] py-[6px] rounded-[8px] text-[11px] ${
        form.mode === 'auto'
          ? 'bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent-border)]'
          : 'bg-[rgba(124,58,237,0.08)] text-[#a78bfa] border border-[rgba(124,58,237,0.2)]'
      }`}>
        {form.mode === 'auto'
          ? <><Zap size={10}/> Los campos reflejan los datos de la orden en el exchange. Edita si necesitas corregir.</>
          : <><PenLine size={10}/> N° operación y fecha asignados automáticamente. Ingresa los datos de tu operación.</>
        }
      </div>

      {/* ── Row 1: Op type + Exchange + Order ref ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-[10px]">
        {/* Tipo de operación */}
        <div className="flex flex-col">
          <label className={labelCls}>Tipo de operación *</label>
          <select
            value={form.opType}
            onChange={e => set('opType', e.target.value as OperationType)}
            className={inputCls}
            style={{ color: opMeta.color }}
          >
            {OP_TYPES.map(t => (
              <option key={t.value} value={t.value} className="bg-[var(--bg-surface-2)] text-[var(--text-primary)]">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Exchange */}
        <div className="flex flex-col">
          <label className={labelCls}>Exchange / Plataforma</label>
          <input
            type="text"
            placeholder={form.mode === 'auto' ? 'Ej: Binance P2P' : 'Ej: Bybit, OKX…'}
            value={form.exchange}
            onChange={e => set('exchange', e.target.value)}
            className={inputCls}
          />
        </div>

        {/* N° Orden */}
        <div className="flex flex-col">
          <label className={labelCls}>N° Orden / Referencia</label>
          <input
            type="text"
            placeholder={form.mode === 'auto' ? 'Desde el exchange' : form.orderRef}
            value={form.orderRef}
            onChange={e => set('orderRef', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* ── Row 2: Rate + Amount + Total ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-[10px]">
        {/* Tasa */}
        <div className="flex flex-col">
          <label className={labelCls}>Tasa de cambio</label>
          <input
            type="number" min="0" step="any"
            placeholder="Ej: 38.50"
            value={form.rate}
            onChange={e => set('rate', e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Cantidad */}
        <div className="flex flex-col">
          <label className={labelCls}>
            Cantidad {form.opType === 'COMPRA_USD' ? '(USD)' : '(USDT)'} *
          </label>
          <input
            type="number" min="0" step="any"
            placeholder="Ej: 200"
            value={form.amount}
            onChange={e => set('amount', e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Valor total — calculado, editable */}
        <div className="flex flex-col">
          <label className={labelCls}>
            Valor total {form.opType === 'COMPRA_USD' ? '(VES)' : '(Bs.)'}
            <span className="ml-[4px] text-[var(--accent)] normal-case tracking-normal font-normal">auto</span>
          </label>
          <input
            type="number" min="0" step="any"
            placeholder="Calculado auto"
            value={form.totalPrice}
            onChange={e => { setTotalEdited(true); set('totalPrice', e.target.value); }}
            onFocus={() => setTotalEdited(true)}
            className={`${inputCls} ${!totalEdited && autoTotal > 0 ? 'text-[var(--accent)]' : ''}`}
          />
        </div>
      </div>

      {/* ── Row 3: Counterpart + Datetime ── */}
      <div className="grid grid-cols-2 gap-[10px]">
        <div className="flex flex-col">
          <label className={labelCls}>Usuario / Contraparte</label>
          <input
            type="text"
            placeholder={form.mode === 'auto' ? 'Nickname del exchange' : 'Opcional'}
            value={form.counterpart}
            onChange={e => set('counterpart', e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col">
          <label className={labelCls}>
            Fecha y hora
            {form.mode === 'manual' && (
              <span className="ml-[4px] text-[#a78bfa] normal-case tracking-normal font-normal">· fecha auto</span>
            )}
          </label>
          <input
            type="datetime-local"
            value={form.datetime}
            onChange={e => set('datetime', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* ── Row 4: Commission ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-[10px]">
        {/* Tipo comisión */}
        <div className="flex flex-col">
          <label className={labelCls}>Tipo de comisión</label>
          <div className="flex bg-[var(--bg-surface-2)] p-[3px] rounded-[8px] border border-[var(--border-strong)] gap-[2px]">
            {(['fixed', 'percent'] as CommissionType[]).map(ct => (
              <button
                key={ct}
                onClick={() => { set('commissionType', ct); setCommEdited(false); }}
                className={`flex-1 py-[5px] rounded-[6px] text-[10px] font-bold transition-all ${
                  form.commissionType === ct
                    ? 'bg-[var(--bg-surface-4)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)]'
                }`}
              >
                {ct === 'fixed' ? 'Fija' : 'Porcentual'}
              </button>
            ))}
          </div>
        </div>

        {/* Comisión valor */}
        <div className="flex flex-col">
          <label className={labelCls}>
            Comisión {form.commissionType === 'percent' ? '(%)' : '(USDT)'}
          </label>
          <div className="relative">
            <input
              type="number" min="0" step="any"
              placeholder={form.commissionType === 'percent' ? 'Ej: 0.25' : 'Ej: 0.50'}
              value={form.commission}
              onChange={e => { set('commission', e.target.value); setCommEdited(false); }}
              className={`${inputCls} pr-[60px]`}
            />
            {form.commissionType === 'fixed' && (
              <select
                className="absolute right-[2px] top-[2px] bottom-[2px] bg-[var(--bg-surface-3)] text-[9px] font-bold text-[#a78bfa] rounded-[6px] px-[4px] outline-none cursor-pointer border-l border-[var(--border)]"
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) {
                    const calc = (amount * v).toFixed(4);
                    set('commission', calc);
                    setCommEdited(false);
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Nivel</option>
                <option value={MAKER_FEES.standard}>Normal 0.25%</option>
                <option value={MAKER_FEES.bronze}>🛡 Bronce 0.20%</option>
                <option value={MAKER_FEES.silver}>⚔ Plata 0.175%</option>
                <option value={MAKER_FEES.gold}>👑 Oro 0.125%</option>
                <option value={MAKER_FEES.zero}>🎉 Promo 0%</option>
              </select>
            )}
          </div>
        </div>

        {/* Comisión calculada — editable */}
        <div className="flex flex-col">
          <label className={labelCls}>
            Comisión calculada
            <span className="ml-[4px] text-[var(--warning)] normal-case tracking-normal font-normal">auto</span>
          </label>
          <input
            type="number" min="0" step="any"
            placeholder="0.0000"
            value={form.commissionCalc}
            onChange={e => { setCommEdited(true); set('commissionCalc', e.target.value); }}
            className={`${inputCls} text-[var(--warning)]`}
          />
        </div>
      </div>

      {/* ── Row 5: Notes ── */}
      {!compact && (
        <div className="flex flex-col">
          <label className={labelCls}>Notas</label>
          <input
            type="text"
            placeholder="Observaciones opcionales…"
            value={form.notas}
            onChange={e => set('notas', e.target.value)}
            className={inputCls}
          />
        </div>
      )}

      {/* ── Footer: Preview + Actions ── */}
      <div className="flex items-center justify-between pt-[10px] border-t border-[var(--border)] gap-[12px] flex-wrap">
        {/* Preview */}
        <div className="flex items-center gap-[16px]">
          {/* Origin badge */}
          <span className={`inline-flex items-center gap-[4px] text-[9px] font-bold px-[8px] py-[3px] rounded-full border uppercase tracking-wider ${
            form.mode === 'auto'
              ? 'bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent-border)]'
              : 'bg-[rgba(124,58,237,0.1)] text-[#a78bfa] border-[rgba(124,58,237,0.3)]'
          }`}>
            {form.mode === 'auto' ? <Zap size={8}/> : <PenLine size={8}/>}
            {form.mode === 'auto' ? 'Exchange' : 'Manual'}
          </span>

          {parseFloat(form.totalPrice) > 0 && (
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] text-[var(--text-secondary)]">Total</span>
              <span className="font-mono font-bold text-[13px] text-[var(--text-primary)]">
                Bs. {fmt(parseFloat(form.totalPrice))}
              </span>
            </div>
          )}
          {parseFloat(form.commissionCalc || form.commission) > 0 && (
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] text-[var(--text-secondary)]">Comisión</span>
              <span className="font-mono font-bold text-[13px] text-[var(--warning)]">
                {fmt(parseFloat(form.commissionCalc || form.commission), 4)}
              </span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-[8px]">
          <button
            onClick={onCancel}
            className="flex items-center gap-[5px] px-[14px] py-[7px] rounded-[8px] border border-[var(--border-strong)] text-[var(--text-secondary)] text-[12px] font-medium hover:bg-[var(--bg-surface-2)] transition-all"
          >
            <X size={12}/> Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-[6px] px-[20px] py-[7px] rounded-[8px] bg-[var(--accent)] hover:brightness-110 text-white font-bold text-[12px] transition-all disabled:opacity-60 shadow-[0_2px_10px_rgba(37,99,235,0.25)]"
          >
            {saving
              ? <span className="w-[12px] h-[12px] border-[1.5px] border-white border-t-transparent rounded-full animate-spin"/>
              : <CheckCircle2 size={13}/>}
            {saving ? 'Guardando…' : editingOrder ? 'Guardar cambios' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Cycle Summary Panel ──────────────────────────────────────────────────────

const CycleSummary: React.FC<{
  cycle: Cycle;
  orders: Order[];
  onReopen: () => void;
  onCopy: () => void;
}> = ({ cycle, orders, onReopen, onCopy }) => {
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(a.createTime_utc).getTime() - new Date(b.createTime_utc).getTime()
  );

  // Compute totals
  let totalInvertido = 0, totalRecuperado = 0, totalComisiones = 0;
  sortedOrders.forEach(o => {
    const opType = o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT');
    totalComisiones += o.commission ?? 0;
    if (opType === 'COMPRA_USDT' || opType === 'COMPRA_USD') totalInvertido += o.totalPrice;
    if (opType === 'VENTA_USDT' || opType === 'RECOMPRA') totalRecuperado += o.totalPrice;
  });
  const gananciaBruta = totalRecuperado - totalInvertido;
  const gananciaNeta = gananciaBruta - totalComisiones;
  const isPositive = gananciaNeta > 0;
  const isNeutral = Math.abs(gananciaNeta) < 0.01;

  return (
    <div className="flex flex-col gap-[20px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-[8px]">
        <div className="flex items-center gap-[10px]">
          <h3 className="font-bold text-[16px]">
            Resumen — Ciclo #{cycle.cycleNumber.toString().slice(-4)}
          </h3>
          {isNeutral ? (
            <span className="inline-flex items-center gap-[4px] text-[10px] font-bold px-[8px] py-[3px] rounded-full bg-[var(--bg-surface-4)] text-[var(--text-secondary)] uppercase">
              <Minus size={9}/> Neutro
            </span>
          ) : isPositive ? (
            <span className="inline-flex items-center gap-[4px] text-[10px] font-bold px-[8px] py-[3px] rounded-full bg-[var(--profit-bg)] text-[var(--profit)] border border-[var(--profit)]/30 uppercase">
              <TrendingUp size={9}/> Positivo
            </span>
          ) : (
            <span className="inline-flex items-center gap-[4px] text-[10px] font-bold px-[8px] py-[3px] rounded-full bg-[var(--loss-bg)] text-[var(--loss)] border border-[var(--loss)]/30 uppercase">
              <TrendingDown size={9}/> Negativo
            </span>
          )}
        </div>
        <div className="flex items-center gap-[8px]">
          <button
            onClick={onCopy}
            className="flex items-center gap-[6px] px-[12px] py-[6px] rounded-[8px] border border-[var(--border-strong)] text-[var(--text-secondary)] text-[12px] font-medium hover:bg-[var(--bg-surface-2)] transition-all"
          >
            <Copy size={12}/> Copiar resumen
          </button>
          <button
            onClick={onReopen}
            className="flex items-center gap-[6px] px-[12px] py-[6px] rounded-[8px] border border-[var(--accent-border)] text-[var(--accent)] text-[12px] font-medium hover:bg-[var(--accent-muted)] transition-all"
          >
            <RotateCcw size={12}/> Reabrir ciclo
          </button>
        </div>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-[16px] text-[12px] text-[var(--text-secondary)]">
        <span><span className="text-[var(--text-tertiary)]">Apertura:</span> {fmtDate(cycle.openedAt)}</span>
        {cycle.closedAt && (
          <span><span className="text-[var(--text-tertiary)]">Cierre:</span> {fmtDate(cycle.closedAt)}</span>
        )}
      </div>

      {/* Financial summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px]">
        {[
          { label: 'Total Invertido (Liquidez)', val: totalRecuperado, color: 'text-[var(--text-primary)]' },
          { label: 'Costo Recompra', val: totalInvertido, color: 'text-[var(--text-secondary)]' },
          { label: 'Total comisiones', val: totalComisiones, color: 'text-[var(--warning)]' },
          { label: 'Ganancia neta', val: gananciaNeta, color: isNeutral ? 'text-[var(--text-secondary)]' : isPositive ? 'text-[var(--profit)]' : 'text-[var(--loss)]' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[10px] p-[12px] flex flex-col gap-[3px]">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
            <span className={`font-mono font-bold text-[15px] ${color}`}>
              {val >= 0 ? '' : '-'}Bs. {fmt(Math.abs(val))}
            </span>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div className="overflow-x-auto custom-scrollbar rounded-[10px] border border-[var(--border)]">
        <table className="w-full min-w-[900px] text-left border-collapse text-[12px]">
          <thead>
            <tr className="bg-[var(--bg-surface-3)] text-[9px] uppercase font-bold text-[var(--text-tertiary)] tracking-[1px]">
              {['#','Tipo','Exchange','Tasa','Cantidad','Valor Total','Contraparte','Ref. Orden','Comisión','Fecha','Origen'].map(h => (
                <th key={h} className="px-[12px] py-[10px] border-b border-[var(--border-strong)] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((o, i) => {
              const opMeta = getOpMeta(o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT'));
              return (
                <tr key={o.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-surface-2)] transition-colors">
                  <td className="px-[12px] py-[9px] font-mono text-[var(--text-tertiary)]">{i + 1}</td>
                  <td className="px-[12px] py-[9px]">
                    <span className="inline-flex items-center gap-[4px] font-bold text-[10px] whitespace-nowrap" style={{ color: opMeta.color }}>
                      {opMeta.icon} {opMeta.label}
                    </span>
                  </td>
                  <td className="px-[12px] py-[9px] text-[var(--text-secondary)]">{o.exchange || '—'}</td>
                  <td className="px-[12px] py-[9px] font-mono">{o.unitPrice > 0 ? fmt(o.unitPrice) : '—'}</td>
                  <td className="px-[12px] py-[9px] font-mono">$ {fmt(o.amount, 4)}</td>
                  <td className="px-[12px] py-[9px] font-mono font-medium">Bs. {fmt(o.totalPrice)}</td>
                  <td className="px-[12px] py-[9px] text-[var(--text-secondary)] max-w-[120px] truncate">{o.counterPartNickName || '—'}</td>
                  <td className="px-[12px] py-[9px] font-mono text-[10px] text-[var(--text-secondary)]">{o.orderNumber}</td>
                  <td className="px-[12px] py-[9px] font-mono text-[var(--warning)]">{fmt(o.commission, 4)}</td>
                  <td className="px-[12px] py-[9px] text-[var(--text-secondary)] whitespace-nowrap">{fmtDate(o.createTime_utc)}</td>
                  <td className="px-[12px] py-[9px]">
                    <span className={`inline-flex items-center gap-[3px] text-[9px] font-bold px-[6px] py-[2px] rounded-full border uppercase ${
                      (o.originMode === 'auto' || (!o.originMode && !o.orderNumber.startsWith('MAN-')))
                        ? 'bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent-border)]'
                        : 'bg-[rgba(124,58,237,0.1)] text-[#a78bfa] border-[rgba(124,58,237,0.2)]'
                    }`}>
                      {(o.originMode === 'auto' || (!o.originMode && !o.orderNumber.startsWith('MAN-'))) ? <><Zap size={7}/> Exchange</> : <><PenLine size={7}/> Manual</>}
                    </span>
                  </td>
                </tr>
              );
            })}
            {sortedOrders.length === 0 && (
              <tr>
                <td colSpan={11} className="px-[12px] py-[24px] text-center text-[var(--text-tertiary)]">
                  No hay operaciones registradas en este ciclo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Subtotals by type */}
      <div className="flex flex-col gap-[8px]">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[1px]">Desglose por tipo</span>
        <div className="flex flex-wrap gap-[8px]">
          {OP_TYPES.map(ot => {
            const ops = sortedOrders.filter(o =>
              (o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT')) === ot.value
            );
            if (!ops.length) return null;
            const subTotal = ops.reduce((s, o) => s + o.totalPrice, 0);
            const subComm = ops.reduce((s, o) => s + (o.commission ?? 0), 0);
            return (
              <div key={ot.value} className="bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[8px] px-[12px] py-[8px] flex items-center gap-[10px]">
                <span className="text-[10px] font-bold" style={{ color: ot.color }}>
                  {ot.icon} {ot.label}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">×{ops.length}</span>
                <span className="font-mono text-[11px] font-medium">Bs. {fmt(subTotal)}</span>
                {subComm > 0 && (
                  <span className="font-mono text-[10px] text-[var(--warning)]">com:{fmt(subComm, 4)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Operations Table ─────────────────────────────────────────────────────────

const OpsTable: React.FC<{
  orders: Order[];
  cycleId: string;
  userId: string;
  onEdit: (order: Order) => void;
  onDeleted: () => void;
}> = ({ orders, cycleId: _cId, userId: _uId, onEdit, onDeleted }) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = useMemo(() =>
    [...orders].sort((a, b) => new Date(a.createTime_utc).getTime() - new Date(b.createTime_utc).getTime()),
    [orders]
  );

  const handleDelete = async (order: Order) => {
    if (deletingId) return;
    setDeletingId(order.id);
    try {
      await deleteOrder(order.id, order.userId);
      await recalculateCycleMetrics(order.cycleId!, order.userId);
      const { setOrders, setActiveCycle, setCycles } = useAppStore.getState();
      const [freshOrders, freshActiveCycle, freshCycles] = await Promise.all([
        getOrdersForUser(order.userId),
        getActiveCycleForUser(order.userId),
        getCyclesForUser(order.userId),
      ]);
      setOrders(freshOrders);
      setActiveCycle(freshActiveCycle);
      setCycles(freshCycles);
      toast.success('Operación eliminada.');
      onDeleted();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center justify-center py-[24px] gap-[8px] text-center">
        <Clock size={24} className="text-[var(--text-tertiary)]"/>
        <p className="text-[13px] text-[var(--text-secondary)]">Aún no hay operaciones en este ciclo.</p>
        <p className="text-[11px] text-[var(--text-tertiary)]">Registra la primera usando el formulario de abajo.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-[10px] border border-[var(--border)]">
      <table className="w-full min-w-[800px] text-left border-collapse text-[12px]">
        <thead>
          <tr className="bg-[var(--bg-surface-3)] text-[9px] uppercase font-bold text-[var(--text-tertiary)] tracking-[1px]">
            <th className="px-[12px] py-[10px] border-b border-[var(--border-strong)]">#</th>
            <th className="px-[12px] py-[10px] border-b border-[var(--border-strong)]">Tipo</th>
            <th className="px-[12px] py-[10px] border-b border-[var(--border-strong)]">Exchange</th>
            <th className="px-[12px] py-[10px] border-b border-[var(--border-strong)]">Tasa</th>
            <th className="px-[12px] py-[10px] border-b border-[var(--border-strong)]">Cantidad</th>
            <th className="px-[12px] py-[10px] border-b border-[var(--border-strong)]">Valor</th>
            <th className="px-[12px] py-[10px] border-b border-[var(--border-strong)]">Contraparte</th>
            <th className="px-[12px] py-[10px] border-b border-[var(--border-strong)]">Comisión</th>
            <th className="px-[12px] py-[10px] border-b border-[var(--border-strong)]">Fecha</th>
            <th className="px-[12px] py-[10px] border-b border-[var(--border-strong)]">Origen</th>
            <th className="px-[12px] py-[10px] border-b border-[var(--border-strong)]">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((o, i) => {
            const opMeta = getOpMeta(o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT'));
            const isDeleting = deletingId === o.id;
            return (
              <tr key={o.id} className={`border-b border-[var(--border)] ${isDeleting ? 'opacity-40' : ''}`}>
                <td className="px-[12px] py-[9px] font-mono text-[10px] text-[var(--text-tertiary)]">{i + 1}</td>
                <td className="px-[12px] py-[9px]">
                  <span className="inline-flex items-center gap-[4px] font-bold text-[10px] whitespace-nowrap" style={{ color: opMeta.color }}>
                    {opMeta.icon} {opMeta.label}
                  </span>
                </td>
                <td className="px-[12px] py-[9px] text-[var(--text-secondary)]">{o.exchange || '—'}</td>
                <td className="px-[12px] py-[9px] font-mono">{o.unitPrice > 0 ? fmt(o.unitPrice) : '—'}</td>
                <td className="px-[12px] py-[9px] font-mono">$ {fmt(o.amount, 4)}</td>
                <td className="px-[12px] py-[9px] font-mono font-medium">Bs. {fmt(o.totalPrice)}</td>
                <td className="px-[12px] py-[9px] text-[var(--text-secondary)] max-w-[100px] truncate">{o.counterPartNickName || '—'}</td>
                <td className="px-[12px] py-[9px] font-mono text-[var(--warning)] text-[10px]">{fmt(o.commission, 4)}</td>
                <td className="px-[12px] py-[9px] text-[var(--text-secondary)] whitespace-nowrap text-[10px]">{fmtDate(o.createTime_utc)}</td>
                <td className="px-[12px] py-[9px]">
                  <span className={`inline-flex items-center gap-[3px] text-[9px] font-bold px-[6px] py-[2px] rounded-full uppercase ${
                    o.originMode === 'auto'
                      ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                      : 'bg-[rgba(124,58,237,0.1)] text-[#a78bfa]'
                  }`}>
                    {o.originMode === 'auto' ? <><Zap size={7}/> Exchange</> : <><PenLine size={7}/> Manual</>}
                  </span>
                </td>
                <td className="px-[12px] py-[9px]">
                  <div className="flex items-center gap-[4px]">
                    <button
                      onClick={() => onEdit(o)}
                      className="p-[5px] rounded-[6px] hover:bg-[var(--accent-muted)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-all"
                      title="Editar"
                    >
                      <Edit3 size={12}/>
                    </button>
                    <button
                      onClick={() => handleDelete(o)}
                      disabled={isDeleting}
                      className="p-[5px] rounded-[6px] hover:bg-[var(--loss-bg)] text-[var(--text-tertiary)] hover:text-[var(--loss)] transition-all disabled:opacity-40"
                      title="Eliminar"
                    >
                      {isDeleting
                        ? <span className="w-[12px] h-[12px] border border-[var(--loss)] border-t-transparent rounded-full animate-spin block"/>
                        : <Trash2 size={12}/>}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Metrics Bar ──────────────────────────────────────────────────────────────

const MetricsBar: React.FC<{ activeCycle?: Cycle; orders: Order[] }> = ({ orders }) => {
  // ── Recalculate LIVE from orders — never trust stale DB value ──
  let usdt_vendido    = 0;
  let usdt_recomprado = 0;
  let ves_recibido    = 0;
  let ves_pagado      = 0;
  let comision_total  = 0;
  orders.forEach(o => {
    const opType = o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT');
    comision_total += o.commission ?? 0;
    switch (opType) {
      case 'VENTA_USDT':  usdt_vendido    += o.amount;     ves_recibido += o.totalPrice; break;
      case 'COMPRA_USDT': usdt_recomprado += o.amount;     ves_pagado   += o.totalPrice; break;
      case 'RECOMPRA':    usdt_recomprado += o.amount;     ves_pagado   += o.totalPrice; ves_recibido += o.totalPrice; break;
      case 'COMPRA_USD':  ves_pagado      += o.totalPrice; break;
      case 'SOBRANTE':    ves_recibido    += o.totalPrice; break;
    }
  });
  const tasa_venta_prom  = usdt_vendido    > 0 ? ves_recibido / usdt_vendido    : 0;
  const tasa_compra_prom = usdt_recomprado > 0 ? ves_pagado   / usdt_recomprado : 0;
  const diferencial_tasa = tasa_venta_prom > 0 && tasa_compra_prom > 0 ? tasa_venta_prom - tasa_compra_prom : 0;
  const matched_vol      = Math.min(usdt_vendido, usdt_recomprado);
  const ganancia_ves     = matched_vol * diferencial_tasa;
  const ganancia_usdt    = tasa_compra_prom > 0 ? (ganancia_ves / tasa_compra_prom) - comision_total : -comision_total;

  const liquidezDisponible = ves_recibido - ves_pagado;
  const pct_recomprado     = usdt_vendido > 0 ? Math.min((usdt_recomprado / usdt_vendido) * 100, 100) : 0;
  const usdt_faltante      = Math.max(usdt_vendido - usdt_recomprado, 0);

  const isPos     = ganancia_usdt > 0;
  const isNeutral = usdt_recomprado === 0 || Math.abs(ganancia_usdt) < 0.001;
  const ganColor  = isNeutral ? 'text-[var(--text-secondary)]' : isPos ? 'text-[var(--profit)]' : 'text-[var(--loss)]';
  const sign = (n: number) => (n >= 0 ? '+' : '');

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-[12px]">
      {/* Col 1 */}
      <div className="cycle-stat-group bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[12px] p-[14px] flex flex-col gap-[4px]">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[1px]">Capital / Liquidez (VES)</span>
        <span className="font-mono font-bold text-[15px] text-[var(--text-primary)]">Bs. {fmt(ves_recibido)}</span>
        <span className="font-mono text-[11px] text-[var(--text-secondary)] mt-[2px]">$ {fmt(usdt_vendido, 4)} USDT vendidos</span>
      </div>

      {/* Col 2 */}
      <div className="cycle-stat-group bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[12px] p-[14px] flex flex-col gap-[4px]">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[1px]">USDT Recomprado</span>
        <span className="font-mono font-bold text-[15px] text-[var(--profit)]">$ {fmt(usdt_recomprado, 4)} USDT</span>
        <span className="font-mono text-[11px] text-[var(--text-secondary)] mt-[2px]">Bs. {fmt(ves_pagado)} costo recom.</span>
      </div>

      {/* Liquidez Restante */}
      <div className="cycle-stat-group bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[12px] p-[14px] flex flex-col gap-[4px] shadow-[inset_0_0_20px_rgba(52,211,153,0.02)]">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[1px]">Liquidez Restante</span>
        <span className={`font-mono font-bold text-[15px] ${liquidezDisponible > 0 ? 'text-[#34d399]' : liquidezDisponible < 0 ? 'text-[var(--loss)]' : 'text-[var(--text-secondary)]'}`}>
          Bs. {fmt(liquidezDisponible)}
        </span>
        <span className="font-mono text-[11px] text-[var(--text-secondary)] mt-[2px]">
           Fondo disp. en banco
        </span>
      </div>

      {/* Comisiones */}
      <div className="cycle-stat-group bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[12px] p-[14px] flex flex-col gap-[4px]">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[1px]">Total Comisiones</span>
        <span className="font-mono font-bold text-[15px] text-[var(--warning)]">{fmt(comision_total, 2)} USDT</span>
        <span className="font-mono text-[11px] text-[var(--text-secondary)] mt-[2px]">
          ≈ Bs. {fmt(comision_total * (tasa_compra_prom || tasa_venta_prom || 1))}
        </span>
      </div>

      {/* Ganancia Neta */}
      <div className="cycle-stat-group bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[12px] p-[14px] flex flex-col gap-[4px] relative overflow-hidden">
        {!isNeutral && usdt_recomprado > 0 && (
          <div className={`absolute top-0 right-0 w-[40px] h-[40px] opacity-10 rounded-bl-full ${isPos ? 'bg-[var(--profit)]' : 'bg-[var(--loss)]'}`} />
        )}
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[1px] flex gap-1 items-center">
          Ganancia Neta
          {usdt_recomprado > 0 && usdt_recomprado < usdt_vendido && (
             <span className="text-[9px] bg-[var(--bg-surface-1)] px-1 rounded normal-case tracking-normal">(Parcial)</span>
          )}
        </span>

        {usdt_recomprado === 0 ? (
          <span className="font-mono font-bold text-[13px] text-[var(--text-tertiary)] mt-[4px]">Esperando compras...</span>
        ) : (
          <>
            <span className={`font-mono font-bold text-[15px] ${ganColor} flex items-center gap-[6px]`}>
              {sign(ganancia_usdt)}{fmt(Math.abs(ganancia_usdt), 2)} USDT
              {!isNeutral && <span className="text-[11px]">{isPos ? '▲' : '▼'}</span>}
            </span>
            <span className={`font-mono text-[11px] mt-[2px] opacity-80 ${ganColor}`}>
              ≈ {sign(ganancia_ves)}Bs. {fmt(Math.abs(ganancia_ves))}
            </span>
          </>
        )}
      </div>
      </div>

      {/* ── Barra de progreso de recompra ── */}
      {usdt_vendido > 0 && (
        <div className="bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[12px] p-[14px] flex flex-col gap-[8px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[1px]">Progreso de Recompra</span>
            <div className="flex items-center gap-[12px]">
              <span className="font-mono text-[11px] text-[var(--text-secondary)]">{fmt(usdt_recomprado, 2)} / {fmt(usdt_vendido, 2)} USDT</span>
              <span className={`font-mono text-[12px] font-bold ${pct_recomprado >= 100 ? 'text-[var(--profit)]' : 'text-[var(--accent)]'}`}>{pct_recomprado.toFixed(1)}%</span>
            </div>
          </div>
          <div className="w-full h-[8px] bg-[var(--bg-surface-1)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct_recomprado}%`,
                background: pct_recomprado >= 100 ? 'var(--profit)' : 'linear-gradient(90deg,#6366f1,#34d399)',
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[var(--text-tertiary)">Bs. {fmt(ves_pagado)} gastados</span>
            {usdt_faltante > 0 ? (
              <span className="font-mono text-[10px] text-[var(--warning)]">Faltan ${fmt(usdt_faltante, 2)} USDT · Bs. {fmt(usdt_faltante * tasa_venta_prom)} aprox.</span>
            ) : (
              <span className="font-mono text-[10px] text-[var(--profit)] font-bold">✓ Recompra completa</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// ─── Main Component ───────────────────────────────────────────────────────────

export const ActiveCyclePanel: React.FC = () => {
  const { activeCycle, setActiveCycle, setOrders, currentUser, bcvRate, cycles, setCycles, orders } = useAppStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // UI state
  const [showDeleteModal, setShowDeleteModal]   = useState(false);
  const [showCloseModal, setShowCloseModal]     = useState(false);
  const [showTypeModal, setShowTypeModal]       = useState(false);
  const [showForm, setShowForm]                 = useState(false);
  const [showQuickSale, setShowQuickSale]       = useState(false); // emergent modal
  const [showSummary, setShowSummary]           = useState(false);
  const [showSobrante, setShowSobrante]         = useState(false);
  const [sobraVes, setSobraVes]                 = useState('');
  const [sobraSaving, setSobraSaving]           = useState(false);
  const [editingOrder, setEditingOrder]         = useState<Order | null>(null);
  const [isProcessing, setIsProcessing]         = useState(false);
  const [closedCycleOrders, setClosedCycleOrders] = useState<Order[]>([]);

  // Orders for active cycle
  const cycleOrders = useMemo(
    () => orders.filter(o => o.cycleId === activeCycle?.id && o.orderStatus?.toUpperCase() === 'COMPLETED'),
    [orders, activeCycle?.id]
  );

  // Next operation sequence number
  const opSeq = cycleOrders.length + 1;


  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOpenCycle = async (cycleType: 'p2p' | 'manual') => {
    if (!currentUser) return;
    setIsProcessing(true);
    const safeCycleNumber = Number(Date.now().toString().slice(-9));
    const newCycle: Cycle = {
      id: generateUUID(),
      cycleNumber: safeCycleNumber,
      openedAt: new Date().toISOString(),
      closedAt: null,
      status: 'En curso',
      cycleType,
      usdt_vendido: 0, usdt_recomprado: 0,
      ves_recibido: 0, ves_pagado: 0,
      comision_total: 0,
      ganancia_usdt: 0, ganancia_ves: 0,
      tasa_venta_prom: 0, tasa_compra_prom: 0,
      diferencial_tasa: 0, roi_percent: 0,
      tasa_bcv_dia: bcvRate?.tasa_bcv ?? 0,
      notas: '',
      userId: currentUser.id,
    };
    setShowTypeModal(false);
    try {
      // IMPORTANTE: Esperar confirmación de la DB ANTES de actualizar el store local.
      // Esto evita el race condition donde el ciclo aparecía y luego desaparecía
      // si saveCycle fallaba después de setActiveCycle(newCycle).
      await saveCycle(newCycle);

      // Fetch fresco para garantizar que lo que está en el store == lo que está en DB
      const [freshOrders, freshActiveCycle, freshCycles] = await Promise.all([
        getOrdersForUser(currentUser.id),
        getActiveCycleForUser(currentUser.id),
        getCyclesForUser(currentUser.id),
      ]);
      setOrders(freshOrders);
      setActiveCycle(freshActiveCycle ?? newCycle); // fallback al objeto local si la query falla
      setCycles(freshCycles.length > 0 ? freshCycles : [newCycle, ...cycles]);
      toast.success(`Ciclo ${cycleType === 'p2p' ? 'P2P' : 'Multi-Exchange'} iniciado.`);
    } catch (err: any) {
      toast.error(`Error al crear ciclo: ${err.message}`);
      // No actualizamos el store local si la DB falló → el estado queda limpio
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseCycle = async () => {
    if (!activeCycle || !currentUser) return;
    setIsProcessing(true);
    try {
      const closed: Cycle = {
        ...activeCycle,
        status: activeCycle.ganancia_ves < 0 ? 'Con pérdida' : 'Completado',
        closedAt: new Date().toISOString(),
        tasa_bcv_dia: bcvRate?.tasa_bcv ?? activeCycle.tasa_bcv_dia,
      };
      await saveCycle(closed);
      setClosedCycleOrders(cycleOrders);
      setActiveCycle(null);
      setCycles(cycles.map(c => c.id === closed.id ? closed : c));
      setShowCloseModal(false);
      setShowSummary(true);
      setShowForm(false);
      toast.success('Ciclo cerrado. Revisa el resumen abajo.');
    } catch (err: any) {
      toast.error('Error al cerrar: ' + err.message);
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
      toast.success('Ciclo eliminado.');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReopenCycle = async () => {
    const lastClosed = cycles.find(c => c.closedAt && cycleOrders.length > 0) ??
      cycles.find(c => closedCycleOrders.some(o => o.cycleId === c.id));
    if (!lastClosed || !currentUser) {
      toast.error('No se encontró el ciclo para reabrir.');
      return;
    }
    const reopened: Cycle = { ...lastClosed, status: 'En curso', closedAt: null };
    try {
      await saveCycle(reopened);
      setActiveCycle(reopened);
      setCycles(cycles.map(c => c.id === reopened.id ? reopened : c));
      setShowSummary(false);
      toast.success('Ciclo reabierto.');
    } catch (err: any) {
      toast.error('Error al reabrir: ' + err.message);
    }
  };

  const handleCopySummary = useCallback(() => {
    const cycle = cycles.find(c => closedCycleOrders.some(o => o.cycleId === c.id)) ?? activeCycle;
    if (!cycle) return;
    const lines: string[] = [
      `===== CICLO #${cycle.cycleNumber.toString().slice(-4)} =====`,
      `Apertura: ${fmtDate(cycle.openedAt)}`,
      cycle.closedAt ? `Cierre:   ${fmtDate(cycle.closedAt)}` : '',
      '',
      'OPERACIONES:',
      ...closedCycleOrders.map((o, i) => {
        const opMeta = getOpMeta(o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT'));
        return `  ${i + 1}. ${opMeta.label.padEnd(16)} | ${fmt(o.amount, 4)} | Bs.${fmt(o.totalPrice)} | com:${fmt(o.commission, 4)} | ${fmtDate(o.createTime_utc)}`;
      }),
      '',
      `Total invertido:   Bs. ${fmt(cycleOrders.reduce((s, o) => { const t = o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT'); return s + (['COMPRA_USDT','COMPRA_USD'].includes(t) ? o.totalPrice : 0); }, 0))}`,
      `Total recuperado:  Bs. ${fmt(cycleOrders.reduce((s, o) => { const t = o.operationType ?? (o.tradeType === 'SELL' ? 'VENTA_USDT' : 'COMPRA_USDT'); return s + (['VENTA_USDT','RECOMPRA'].includes(t) ? o.totalPrice : 0); }, 0))}`,
      `Total comisiones:  ${fmt(cycleOrders.reduce((s, o) => s + (o.commission ?? 0), 0), 4)}`,
      `Ganancia neta:     Bs. ${fmt(cycle.ganancia_ves)}`,
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => toast.success('Resumen copiado al portapapeles.'))
      .catch(() => toast.error('No se pudo copiar.'));
  }, [cycles, closedCycleOrders, cycleOrders, activeCycle]);

  const handleFormSaved = () => {
    setShowForm(false);
    setEditingOrder(null);
    setShowQuickSale(false);
  };

  // ── Sobrante handler ─────────────────────────────────────────────────────────
  const handleSaveSobrante = async () => {
    const vesN = parseFloat(sobraVes.replace(',', '.'));
    if (!vesN || vesN <= 0) { toast.error('Ingresa un monto válido en Bs.'); return; }
    if (!currentUser || !activeCycle) return;

    // Use the unit price of the LAST COMPRA/RECOMPRA order in the cycle.
    // This is the actual rate charged, not the average.
    const lastBuyOrder = [...cycleOrders]
      .filter(o => ['COMPRA_USDT', 'COMPRA_USD', 'RECOMPRA'].includes(o.operationType ?? '') && o.unitPrice > 0)
      .sort((a, b) => new Date(b.createTime_utc).getTime() - new Date(a.createTime_utc).getTime())[0];

    const tasaRef = lastBuyOrder?.unitPrice ?? (
      activeCycle.tasa_compra_prom > 0
        ? activeCycle.tasa_compra_prom
        : activeCycle.tasa_venta_prom > 0
          ? activeCycle.tasa_venta_prom
          : 1
    );

    const usdtEquiv = vesN / tasaRef;

    const order: Order = {
      id: generateUUID(),
      orderNumber: `MAN-SOB-${Date.now()}`,
      tradeType: 'SELL',
      operationType: 'SOBRANTE',
      commissionType: 'fixed',
      originMode: 'manual',
      asset: 'VES',
      fiat: 'VES',
      totalPrice: vesN,
      unitPrice: tasaRef,
      amount: usdtEquiv,
      commission: 0,
      commissionAsset: 'USDT',
      counterPartNickName: 'Sobrante bancario',
      orderStatus: 'COMPLETED',
      createTime_utc: new Date().toISOString(),
      createTime_local: new Date().toLocaleString(),
      cycleId: activeCycle.id,
      importedAt: new Date().toISOString(),
      userId: currentUser.id,
      notas: `Sobrante: Bs. ${vesN.toFixed(2)} ÷ tasa ${tasaRef.toFixed(2)} = ${usdtEquiv.toFixed(4)} USDT`,
    };

    setSobraSaving(true);
    try {
      await saveOrder(order);
      await recalculateCycleMetrics(activeCycle.id, currentUser.id);
      const { setOrders, setActiveCycle: sAC, setCycles } = useAppStore.getState();
      const [freshOrders, freshActive, freshCycles] = await Promise.all([
        getOrdersForUser(currentUser.id),
        getActiveCycleForUser(currentUser.id),
        getCyclesForUser(currentUser.id),
      ]);
      setOrders(freshOrders);
      sAC(freshActive);
      setCycles(freshCycles);
      toast.success(`Sobrante registrado: Bs. ${vesN.toFixed(2)} ≈ ${usdtEquiv.toFixed(4)} USDT`);
      setSobraVes('');
      setShowSobrante(false);
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSobraSaving(false);
    }
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!activeCycle) {
    return (
      <>
        <div ref={panelRef} className="flex flex-col gap-[20px]">
          {/* Summary panel after close */}
          {showSummary && closedCycleOrders.length >= 0 && (() => {
            const closedCycle = cycles.find(c => closedCycleOrders.some(o => o.cycleId === c.id));
            if (!closedCycle) return null;
            return (
              <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px]">
                <CycleSummary
                  cycle={closedCycle}
                  orders={closedCycleOrders}
                  onReopen={handleReopenCycle}
                  onCopy={handleCopySummary}
                />
              </div>
            );
          })()}

          {/* Empty / new cycle CTA */}
          <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[32px] flex flex-col items-center justify-center gap-[20px] shadow-sm relative overflow-hidden hover:border-[var(--accent-border)] transition-all">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none"/>
            <div className="pulse-icon w-[64px] h-[64px] rounded-full border border-[var(--border-strong)] flex items-center justify-center text-[var(--accent)] bg-[var(--accent-muted)] relative z-10 hover:bg-[var(--accent)] hover:text-white transition-colors">
              <Plus size={28}/>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-[16px] mb-[4px]">No hay ciclos en curso</h3>
              <p className="text-[var(--text-secondary)] text-[13px] max-w-[280px]">
                Inicia un nuevo ciclo para comenzar a registrar tus operaciones de trading.
              </p>
            </div>
            <Button onClick={() => setShowTypeModal(true)} className="mt-[8px] text-[15px] px-[24px] py-[12px]">
              + Abrir nuevo ciclo
            </Button>
          </div>
        </div>

        <CycleTypeModal
          isOpen={showTypeModal}
          onClose={() => setShowTypeModal(false)}
          bcvTasa={bcvRate?.tasa_bcv}
          onConfirm={handleOpenCycle}
        />
      </>
    );
  }

  const isManual = activeCycle.cycleType === 'manual';
  const cycleTypeBg = isManual
    ? 'bg-[rgba(124,58,237,0.15)] text-[#a78bfa] border-[rgba(124,58,237,0.3)]'
    : 'bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent-border)]';
  const hasOps = cycleOrders.length > 0;

  return (
    <>
      <div ref={panelRef} className="flex flex-col gap-[16px]">

        {/* ── Header ── */}
        <div className="bg-[var(--bg-surface-2)] rounded-[16px] border-t-2 border-[var(--accent)] border-x border-b border-x-[var(--border)] border-b-[var(--border)] p-[12px] md:p-[16px] flex flex-col gap-[10px] relative overflow-hidden">
          {/* Top row */}
          <div className="flex items-center justify-between flex-wrap gap-[8px] relative z-10">
            <div className="flex items-center gap-[10px]">
              <h2 className="font-bold text-[18px]">Ciclo #{activeCycle.cycleNumber.toString().slice(-4)}</h2>
              <Badge variant="accent">EN CURSO</Badge>
              <span className={`inline-flex items-center gap-[4px] text-[10px] font-bold px-[8px] py-[3px] rounded-full border uppercase tracking-wider ${cycleTypeBg}`}>
                {isManual ? <PenLine size={9}/> : <Zap size={9}/>}
                {isManual ? 'Multi-Exchange' : 'P2P Auto'}
              </span>
            </div>
            <div className="flex items-center gap-[8px]">

              <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
                Eliminar
              </Button>
              <Button
                variant="danger"
                onClick={() => setShowCloseModal(true)}
                disabled={!hasOps}
              >
                Cerrar ciclo
              </Button>
            </div>
          </div>

          {/* Metrics */}
          <div className="relative z-10">
            <MetricsBar activeCycle={activeCycle} orders={cycleOrders}/>
          </div>

          {/* Opened at */}
          <div className="flex items-center gap-[6px] text-[11px] text-[var(--text-secondary)] border-t border-[var(--border)] pt-[8px] relative z-10">
            <Clock size={11}/>
            Abierto el {fmtDate(activeCycle.openedAt)}
          </div>
        </div>

        {/* ── Operations table ── */}
        <div className="bg-[var(--bg-surface-2)] rounded-[14px] border border-[var(--border)] p-[12px] flex flex-col gap-[10px]">
          <div className="flex items-center justify-between flex-wrap gap-[8px]">
            <div className="flex items-center gap-[8px]">
              <span className="text-[12px] font-bold text-[var(--text-primary)]">Operaciones</span>
              {cycleOrders.length > 0 && (
                <span className="text-[10px] font-bold px-[8px] py-[2px] bg-[var(--bg-surface-3)] text-[var(--text-secondary)] rounded-full border border-[var(--border)]">
                  {cycleOrders.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-[8px]">
              {/* Sobrante button */}
              <button
                onClick={() => { setShowSobrante(true); }}
                className="flex items-center gap-[6px] px-[12px] py-[7px] rounded-[8px] font-bold text-[12px] transition-all border bg-[var(--bg-surface-3)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[#34d399] hover:text-[#34d399]"
                title="Registrar saldo residual bancario como ganancia directa"
              >
                <CheckCircle2 size={13}/> Sobrante
              </button>
              {/* Registrar operación */}
              <button
                onClick={() => { setShowForm(true); setEditingOrder(null); }}
                className="flex items-center gap-[6px] px-[14px] py-[7px] rounded-[8px] bg-[var(--accent)] hover:brightness-110 text-white font-bold text-[12px] transition-all shadow-[0_2px_8px_rgba(37,99,235,0.2)]"
              >
                <Plus size={13}/> Registrar operación
              </button>
            </div>
          </div>

          {/* Sobrante and form modals are rendered as portals below */}

          {/* Contenedor con scroll para la tabla de operaciones - Muy compacto y ESTÁTICO */}
          <div className="h-[220px] overflow-y-scroll pr-1 scrollbar-thin scrollbar-thumb-[var(--border-strong)] scrollbar-track-transparent rounded-[8px]">
            <OpsTable
              orders={cycleOrders}
              cycleId={activeCycle.id}
              userId={currentUser!.id}
              onEdit={(order) => { setEditingOrder(order); setShowForm(true); setShowQuickSale(false); setShowSobrante(false); }}
              onDeleted={() => {}}
            />
          </div>
        </div>

        {/* Quick-add row when no ops */}
        {!hasOps && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-[8px] py-[12px] rounded-[12px] border-2 border-dashed border-[var(--border-strong)] text-[var(--text-tertiary)] text-[13px] font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-muted)] transition-all"
          >
            <Plus size={15}/> Registrar primera operación
          </button>
        )}
      </div>

      {/* ── Sobrante Floating Modal ── */}
      {showSobrante && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-[16px]"
          style={{ background: 'rgba(10,20,35,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowSobrante(false); setSobraVes(''); }}
        >
          <div
            className="relative w-full max-w-[460px] rounded-[20px] border border-[#34d399]/30 shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-surface-2)', boxShadow: '0 0 0 1px rgba(52,211,153,0.1), 0 24px 48px rgba(0,0,0,0.55)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #34d399, transparent)' }}/>
            {/* Close */}
            <button
              onClick={() => { setShowSobrante(false); setSobraVes(''); }}
              className="absolute top-[14px] right-[14px] w-[28px] h-[28px] rounded-full flex items-center justify-center hover:bg-[var(--bg-surface-4)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={14}/>
            </button>
            <div className="p-[28px] flex flex-col gap-[18px]">
              <div className="flex items-center gap-[10px]">
                <div className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center bg-[rgba(52,211,153,0.12)] border border-[#34d399]/25">
                  <CheckCircle2 size={22} className="text-[#34d399]"/>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[var(--text-primary)]">Registrar sobrante bancario</h3>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-[2px]">Saldo residual → ganancia directa</p>
                </div>
              </div>
              {(() => {
                const lastBuy = [...cycleOrders]
                  .filter(o => ['COMPRA_USDT', 'COMPRA_USD', 'RECOMPRA'].includes(o.operationType ?? '') && o.unitPrice > 0)
                  .sort((a, b) => new Date(b.createTime_utc).getTime() - new Date(a.createTime_utc).getTime())[0];
                const tasaDisplay = lastBuy?.unitPrice ?? (activeCycle.tasa_compra_prom > 0 ? activeCycle.tasa_compra_prom : activeCycle.tasa_venta_prom);
                return (
                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    Ingresa el monto en Bs. que te sobró en el banco. Se dividirá entre la
                    {' '}<span className="text-[var(--text-primary)] font-semibold">tasa de la última recompra</span>:{' '}
                    <span className="font-mono font-bold text-[#34d399]">{fmt(tasaDisplay)} Bs/USDT</span>
                    {lastBuy && <span className="text-[var(--text-tertiary)]"> · {new Date(lastBuy.createTime_utc).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </p>
                );
              })()}
              <div className="flex items-end gap-[12px] flex-wrap">
                <div className="flex flex-col gap-[6px] flex-1 min-w-[160px]">
                  <label className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Monto sobrante (Bs.)</label>
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    min="0"
                    value={sobraVes}
                    onChange={e => setSobraVes(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveSobrante()}
                    placeholder="Ej: 450.00"
                    className="bg-[var(--bg-surface-3)] border border-[#34d399]/40 rounded-[10px] px-[14px] py-[10px] text-[14px] font-mono text-[var(--text-primary)] outline-none focus:border-[#34d399] transition-colors"
                  />
                </div>
                {sobraVes && parseFloat(sobraVes.replace(',','.')) > 0 && (() => {
                  const lastBuy = [...cycleOrders]
                    .filter(o => ['COMPRA_USDT', 'COMPRA_USD', 'RECOMPRA'].includes(o.operationType ?? '') && o.unitPrice > 0)
                    .sort((a, b) => new Date(b.createTime_utc).getTime() - new Date(a.createTime_utc).getTime())[0];
                  const tasaCalc = lastBuy?.unitPrice ?? (activeCycle.tasa_compra_prom > 0 ? activeCycle.tasa_compra_prom : activeCycle.tasa_venta_prom > 0 ? activeCycle.tasa_venta_prom : 1);
                  return (
                    <div className="flex flex-col gap-[4px]">
                      <label className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Equivale a</label>
                      <span className="text-[18px] font-mono font-bold text-[#34d399]">
                        $ {fmt(parseFloat(sobraVes.replace(',','.')) / tasaCalc, 4)} USDT
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-[10px] pt-[4px] border-t border-[var(--border)]">
                <button
                  onClick={handleSaveSobrante}
                  disabled={sobraSaving || !sobraVes}
                  className="flex-1 flex items-center justify-center gap-[8px] py-[10px] rounded-[10px] bg-[#34d399] hover:brightness-110 text-white font-bold text-[13px] transition-all disabled:opacity-40"
                >
                  {sobraSaving ? <span className="w-[14px] h-[14px] border-2 border-white border-t-transparent rounded-full animate-spin"/> : <CheckCircle2 size={15}/>}
                  Registrar sobrante
                </button>
                <button
                  onClick={() => { setShowSobrante(false); setSobraVes(''); }}
                  className="px-[16px] py-[10px] rounded-[10px] text-[var(--text-secondary)] text-[13px] border border-[var(--border-strong)] hover:bg-[var(--bg-surface-3)] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Registrar Operación Floating Modal ── */}
      {showForm && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-[16px]"
          style={{ background: 'rgba(10,20,35,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowForm(false); setEditingOrder(null); }}
        >
          <div
            className="relative w-full max-w-[720px] max-h-[90vh] rounded-[20px] border border-[var(--accent-border)] shadow-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-surface-2)', boxShadow: '0 0 0 1px rgba(37,99,235,0.1), 0 24px 48px rgba(0,0,0,0.55)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }}/>
            {/* Header */}
            <div className="flex items-center justify-between px-[24px] pt-[22px] pb-[14px] border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-[10px]">
                <div className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center bg-[var(--accent-muted)] border border-[var(--accent-border)]">
                  <PenLine size={16} className="text-[var(--accent)]"/>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                    {editingOrder ? 'Editar operación' : 'Registrar operación'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-tertiary)]">Ciclo #{activeCycle.cycleNumber.toString().slice(-4)}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditingOrder(null); }}
                className="w-[28px] h-[28px] rounded-full flex items-center justify-center hover:bg-[var(--bg-surface-4)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={14}/>
              </button>
            </div>
            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-[24px]">
              <UnifiedForm
                cycleId={activeCycle.id}
                userId={currentUser!.id}
                opSeq={opSeq}
                editingOrder={editingOrder}
                onSaved={handleFormSaved}
                onCancel={() => { setShowForm(false); setEditingOrder(null); }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Emergency Quick-Sale Modal ── */}
      <Modal
        isOpen={showQuickSale}
        onClose={() => setShowQuickSale(false)}
        title=""
        confirmText=""
        cancelText=""
        onConfirm={() => {}}
        icon="info"
        maxWidth="680px"
      >
        <div className="flex flex-col gap-[16px] mt-[-10px]">
          <div className="flex items-center gap-[8px] mb-[4px]">
            <Bolt size={18} className="text-[var(--warning)]"/>
            <span className="text-[16px] font-bold text-[var(--text-primary)]">Venta Rápida de Emergencia</span>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] -mt-[12px] mb-[8px]">
            Registra una operación urgente. Puedes editarla después con todos los detalles.
          </p>
          <UnifiedForm
            cycleId={activeCycle.id}
            userId={currentUser!.id}
            opSeq={opSeq}
            onSaved={handleFormSaved}
            onCancel={() => setShowQuickSale(false)}
            compact={false}
          />
        </div>
      </Modal>

      {/* ── Confirm Delete Modal ── */}
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
          y todas sus operaciones.
        </p>
        <p className="mt-[8px] text-[var(--loss)]/80 text-[12.5px] font-medium">
          ⚠️ Esta acción no se puede deshacer.
        </p>
      </Modal>

      {/* ── Confirm Close Modal ── */}
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
          El ciclo se marcará como <strong className="text-[var(--text-primary)]">Completado</strong> y
          se generará el resumen financiero completo.
        </p>
        <div className="mt-[12px] grid grid-cols-2 gap-[8px]">
          <div className="bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[10px] p-[10px]">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Operaciones</span>
            <p className="mono text-[15px] font-bold mt-[2px]">{cycleOrders.length}</p>
          </div>
          <div className="bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[10px] p-[10px]">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Resultado</span>
            <p className={`mono text-[15px] font-bold mt-[2px] ${activeCycle.ganancia_ves >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'}`}>
              {activeCycle.ganancia_ves >= 0 ? '+' : ''}Bs. {fmt(activeCycle.ganancia_ves)}
            </p>
          </div>
        </div>
      </Modal>

      {/* ── Cycle Type Modal ── */}
      <CycleTypeModal
        isOpen={showTypeModal}
        onClose={() => setShowTypeModal(false)}
        bcvTasa={bcvRate?.tasa_bcv}
        onConfirm={handleOpenCycle}
      />
    </>
  );
};
