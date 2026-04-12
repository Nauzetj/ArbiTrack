import React, { useState } from 'react';
import { Activity, PenLine, X, ArrowRight, Zap, ChevronRight } from 'lucide-react';

type CycleType = 'p2p' | 'manual';

interface CycleTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** bcvRate para mostrarla en el modal */
  bcvTasa?: number | null;
  onConfirm: (type: CycleType) => void;
}

export const CycleTypeModal: React.FC<CycleTypeModalProps> = ({
  isOpen,
  onClose,
  bcvTasa,
  onConfirm,
}) => {
  const [selected, setSelected] = useState<CycleType>('p2p');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(2,11,22,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-full sm:max-w-[520px] bg-[var(--bg-surface-1)] rounded-t-[24px] sm:rounded-[24px] border border-[var(--border)] shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Glow top */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[var(--accent)] via-[#7c3aed] to-[var(--accent)]" />

        {/* Header */}
        <div className="flex items-center justify-between px-[24px] pt-[22px] pb-[4px]">
          <div>
            <h2 className="text-[18px] font-bold text-[var(--text-primary)]">
              Nuevo Ciclo de Arbitraje
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-[2px]">
              Selecciona cómo registrarás las órdenes de este ciclo.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-3)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* BCV pill */}
        {bcvTasa && (
          <div className="mx-[24px] mt-[12px] inline-flex items-center gap-[6px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-full px-[12px] py-[5px]">
            <div className="w-[5px] h-[5px] rounded-full bg-[var(--accent)] animate-pulse-green" />
            <span className="text-[11px] font-mono font-semibold text-[var(--text-secondary)]">
              Tasa BCV: <span className="text-[var(--text-primary)]">Bs. {bcvTasa.toFixed(2)}</span>
            </span>
          </div>
        )}

        {/* Cards */}
        <div className="px-[24px] pt-[16px] pb-[8px] flex flex-col gap-[12px]">

          {/* Card P2P Automático */}
          <button
            onClick={() => setSelected('p2p')}
            className={`w-full text-left rounded-[16px] border-2 p-[16px] flex items-start gap-[14px] transition-all duration-200 ${
              selected === 'p2p'
                ? 'border-[var(--accent)] bg-[var(--accent-muted)] shadow-[0_0_20px_rgba(0,229,195,0.12)]'
                : 'border-[var(--border)] bg-[var(--bg-surface-2)] hover:border-[var(--border-strong)]'
            }`}
          >
            {/* Icon */}
            <div className={`w-[42px] h-[42px] flex-shrink-0 rounded-[12px] flex items-center justify-center transition-colors ${
              selected === 'p2p' ? 'bg-[var(--accent)] text-[#020B16]' : 'bg-[var(--bg-surface-3)] text-[var(--text-secondary)]'
            }`}>
              <Zap size={20} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-[8px] flex-wrap">
                <span className={`font-bold text-[15px] ${selected === 'p2p' ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                  Arbitraje P2P
                </span>
                <span className="text-[10px] font-bold bg-[var(--accent)]/15 text-[var(--accent)] px-[7px] py-[2px] rounded-full border border-[var(--accent)]/30 uppercase tracking-wider">
                  Automático
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)] mt-[4px] leading-relaxed">
                Las órdenes de <strong className="text-[var(--text-primary)]">venta y compra de USDT</strong> se sincronizan automáticamente desde tu cuenta de Binance. Ideal para operaciones 100% dentro de Binance P2P.
              </p>
              <div className="flex items-center gap-[4px] mt-[8px]">
                <Activity size={11} className="text-[var(--profit)]" />
                <span className="text-[11px] text-[var(--profit)] font-medium">Auto-sync cada 10 segundos</span>
              </div>
            </div>

            {/* Radio */}
            <div className={`w-[18px] h-[18px] flex-shrink-0 rounded-full border-2 flex items-center justify-center mt-[1px] transition-colors ${
              selected === 'p2p' ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)]'
            }`}>
              {selected === 'p2p' && <div className="w-[6px] h-[6px] rounded-full bg-[#020B16]" />}
            </div>
          </button>

          {/* Card Manual Multi-Exchange */}
          <button
            onClick={() => setSelected('manual')}
            className={`w-full text-left rounded-[16px] border-2 p-[16px] flex items-start gap-[14px] transition-all duration-200 ${
              selected === 'manual'
                ? 'border-[#7c3aed] bg-[rgba(124,58,237,0.08)] shadow-[0_0_20px_rgba(124,58,237,0.12)]'
                : 'border-[var(--border)] bg-[var(--bg-surface-2)] hover:border-[var(--border-strong)]'
            }`}
          >
            {/* Icon */}
            <div className={`w-[42px] h-[42px] flex-shrink-0 rounded-[12px] flex items-center justify-center transition-colors ${
              selected === 'manual' ? 'bg-[#7c3aed] text-white' : 'bg-[var(--bg-surface-3)] text-[var(--text-secondary)]'
            }`}>
              <PenLine size={20} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-[8px] flex-wrap">
                <span className={`font-bold text-[15px] ${selected === 'manual' ? 'text-[#a78bfa]' : 'text-[var(--text-primary)]'}`}>
                  Multi-Exchange / Manual
                </span>
                <span className="text-[10px] font-bold bg-[rgba(124,58,237,0.15)] text-[#a78bfa] px-[7px] py-[2px] rounded-full border border-[rgba(124,58,237,0.3)] uppercase tracking-wider">
                  Manual
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)] mt-[4px] leading-relaxed">
                Tú ingresas cada orden manualmente: <strong className="text-[var(--text-primary)]">precio de compra, comisión, cantidad</strong>. Perfecto para cross-exchange (ej: vender en Binance, comprar en otro exchange).
              </p>
              <div className="flex items-center gap-[4px] mt-[8px]">
                <PenLine size={11} className="text-[#a78bfa]" />
                <span className="text-[11px] text-[#a78bfa] font-medium">El sistema calcula ganancia al cerrar el ciclo</span>
              </div>
            </div>

            {/* Radio */}
            <div className={`w-[18px] h-[18px] flex-shrink-0 rounded-full border-2 flex items-center justify-center mt-[1px] transition-colors ${
              selected === 'manual' ? 'border-[#7c3aed] bg-[#7c3aed]' : 'border-[var(--border-strong)]'
            }`}>
              {selected === 'manual' && <div className="w-[6px] h-[6px] rounded-full bg-white" />}
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-[24px] pt-[8px] pb-[24px] flex gap-[10px]">
          <button
            onClick={onClose}
            className="flex-1 py-[12px] rounded-[12px] border border-[var(--border)] text-[13px] font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className={`flex-[2] py-[12px] rounded-[12px] font-bold text-[14px] flex items-center justify-center gap-[8px] transition-all shadow-lg ${
              selected === 'p2p'
                ? 'bg-[var(--accent)] text-[#020B16] hover:opacity-90 shadow-[0_4px_20px_var(--accent-muted)]'
                : 'bg-[#7c3aed] text-white hover:opacity-90 shadow-[0_4px_20px_rgba(124,58,237,0.35)]'
            }`}
          >
            Confirmar y Abrir Ciclo
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
