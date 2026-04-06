import React, { useState } from 'react';
import { Activity, Check, Zap, Crown, Tag, ArrowRight, Lock } from 'lucide-react';
import { validatePromoCode } from '../services/dbOperations';
import type { PromoCode } from '../types';

interface PricingPageProps {
  onPromoValidated: (code: PromoCode, plan: string) => void;
  onRequestPayment: () => void;
  onBack: () => void;
}

const MONTHLY_PRICE = 8;
const SEMIANNUAL_PRICE = 36; // 6/mo, 25% off
const ANNUAL_PRICE = 48;     // 4/mo, 50% off

const FEATURES = [
  'Sincronización automática con Binance P2P',
  'Historial completo de ciclos operativos',
  'Calendario de actividad diaria',
  'Exportación de reportes en PDF',
  'Dashboard con métricas en tiempo real',
  'Cálculo automático de comisiones y ROI',
  'Tasa BCV actualizada cada 10 segundos',
  'Base de datos local cifrada (SQLite)',
];

export const PricingPage: React.FC<PricingPageProps> = ({ onPromoValidated, onRequestPayment, onBack }) => {
  const [selectedPlan, setSelectedPlan] = useState<'vip_monthly' | 'vip_semiannual' | 'vip_annual'>('vip_annual');
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  const handleValidatePromo = async () => {
    setPromoError('');
    setPromoSuccess('');
    if (!promoCode.trim()) { setPromoError('Ingresa un código.'); return; }

    const result = await validatePromoCode(promoCode);
    if (!result.valid || !result.code) {
      setPromoError(result.error || 'Código inválido.');
      return;
    }
    setPromoSuccess(`✓ Código válido — Plan ${result.code!.plan === 'vip_annual' ? 'Anual' : result.code!.plan === 'vip_semiannual' ? 'Semestral' : 'Mensual'} activado.`);
    setTimeout(() => onPromoValidated(result.code!, result.code!.plan), 900);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col items-center justify-center p-[24px] animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col items-center gap-[16px] mb-[48px] text-center">
        <div className="w-[56px] h-[56px] bg-[var(--accent)] rounded-[16px] flex items-center justify-center shadow-[var(--shadow-md)]">
          <Activity size={32} className="text-white" />
        </div>
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">
            ArbiTrack <span className="text-[var(--accent)] font-mono">P2P</span>
          </h1>
          <p className="text-[16px] text-[var(--text-secondary)] mt-[8px] max-w-[480px]">
            El sistema profesional de contabilidad y seguimiento para operadores P2P de Binance en Venezuela.
          </p>
        </div>
      </div>

      <div className="w-full max-w-[900px] flex flex-col lg:flex-row gap-[24px]">
        {/* Left: Pricing Cards */}
        <div className="flex-1 flex flex-col gap-[16px]">
          {/* Monthly Plan */}
          <button
            onClick={() => setSelectedPlan('vip_monthly')}
            className={`w-full text-left p-[24px] rounded-[16px] border-2 transition-all ${
              selectedPlan === 'vip_monthly'
                ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-[0_0_20px_rgba(0,229,195,0.1)]'
                : 'border-[var(--border)] bg-[var(--bg-surface-1)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[12px]">
                <div className={`w-[40px] h-[40px] rounded-[10px] flex items-center justify-center ${selectedPlan === 'vip_monthly' ? 'bg-[var(--accent)]/20' : 'bg-[var(--bg-surface-3)]'}`}>
                  <Zap size={20} className={selectedPlan === 'vip_monthly' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                </div>
                <div>
                  <div className="font-bold text-[16px]">Plan Mensual</div>
                  <div className="text-[13px] text-[var(--text-tertiary)]">Flexibilidad total, cancela cuando quieras.</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[28px] font-bold text-[var(--text-primary)]">${MONTHLY_PRICE}</div>
                <div className="text-[12px] text-[var(--text-tertiary)]">/ mes</div>
              </div>
            </div>
          </button>

          {/* Semiannual Plan */}
          <button
            onClick={() => setSelectedPlan('vip_semiannual')}
            className={`w-full text-left p-[24px] rounded-[16px] border-2 transition-all relative ${
              selectedPlan === 'vip_semiannual'
                ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-[0_0_20px_rgba(0,229,195,0.1)]'
                : 'border-[var(--border)] bg-[var(--bg-surface-1)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[12px]">
                <div className={`w-[40px] h-[40px] rounded-[10px] flex items-center justify-center ${selectedPlan === 'vip_semiannual' ? 'bg-[var(--accent)]/20' : 'bg-[var(--bg-surface-3)]'}`}>
                  <Zap size={20} className={selectedPlan === 'vip_semiannual' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                </div>
                <div>
                  <div className="font-bold text-[16px]">Plan Semestral (6 Meses)</div>
                  <div className="text-[13px] text-[var(--text-tertiary)]">
                    Ahorra <span className="text-[var(--profit)] font-semibold">25%</span> vs plan mensual.
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[28px] font-bold text-[var(--text-primary)]">${SEMIANNUAL_PRICE}</div>
                <div className="flex items-center gap-[6px] justify-end">
                  <span className="text-[12px] text-[var(--text-tertiary)] line-through">${(MONTHLY_PRICE * 6).toFixed(2)}</span>
                  <span className="text-[12px] text-[var(--text-tertiary)]">/ 6 mes</span>
                </div>
              </div>
            </div>
          </button>

          {/* Annual Plan */}
          <button
            onClick={() => setSelectedPlan('vip_annual')}
            className={`w-full text-left p-[24px] rounded-[16px] border-2 transition-all relative overflow-hidden ${
              selectedPlan === 'vip_annual'
                ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-[0_0_20px_rgba(0,229,195,0.1)]'
                : 'border-[var(--border)] bg-[var(--bg-surface-1)] hover:border-[var(--border-strong)]'
            }`}
          >
            {/* Best Value badge */}
            <div className="absolute top-[12px] right-[12px] bg-[var(--accent)] text-[#020B16] text-[10px] font-bold px-[8px] py-[3px] rounded-full uppercase tracking-[0.5px]">
              Mejor Valor
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[12px]">
                <div className={`w-[40px] h-[40px] rounded-[10px] flex items-center justify-center ${selectedPlan === 'vip_annual' ? 'bg-[var(--accent)]/20' : 'bg-[var(--bg-surface-3)]'}`}>
                  <Crown size={20} className={selectedPlan === 'vip_annual' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                </div>
                <div>
                  <div className="font-bold text-[16px]">Plan Anual (12 Meses)</div>
                  <div className="text-[13px] text-[var(--text-tertiary)]">
                    Ahorra <span className="text-[var(--profit)] font-semibold">50%</span> vs plan mensual.
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 mr-[60px]">
                <div className="text-[28px] font-bold text-[var(--accent)]">${ANNUAL_PRICE}</div>
                <div className="flex items-center gap-[6px] justify-end">
                  <span className="text-[12px] text-[var(--text-tertiary)] line-through">${(MONTHLY_PRICE * 12).toFixed(2)}</span>
                  <span className="text-[12px] text-[var(--text-tertiary)]">/ año</span>
                </div>
              </div>
            </div>
          </button>

          {/* CTA Button */}
          <button
            onClick={onRequestPayment}
            className="w-full flex items-center justify-center gap-[10px] py-[16px] bg-[var(--accent)] text-white font-bold text-[16px] rounded-[12px] hover:opacity-90 transition-all shadow-[0_4px_24px_var(--accent-muted)] hover:shadow-[0_8px_32px_var(--accent-border)] hover:-translate-y-1"
          >
            <ArrowRight size={18} />
            Ya pagué — Subir comprobante →
          </button>

          <div className="text-center text-[12px] text-[var(--text-tertiary)] bg-[var(--bg-surface-2)] p-[12px] rounded-[8px] border border-[var(--border)] mt-[10px]">
            Para adquirir un plan, haz el pago a través de Binance Pay y envía la captura de pantalla usando el botón de arriba.
          </div>
        </div>

        {/* Right: Features + Promo */}
        <div className="lg:w-[320px] flex flex-col gap-[20px]">
          {/* Features */}
          <div className="bg-[var(--bg-surface-1)] rounded-[16px] border border-[var(--border)] p-[24px]">
            <h3 className="font-bold text-[14px] mb-[16px] text-[var(--text-secondary)] uppercase tracking-[1px]">Todo incluido</h3>
            <ul className="flex flex-col gap-[10px]">
              {FEATURES.map(f => (
                <li key={f} className="flex items-start gap-[10px] text-[13px] text-[var(--text-secondary)]">
                  <Check size={14} className="text-[var(--accent)] mt-[2px] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Promo Code */}
          <div className="bg-[var(--bg-surface-1)] rounded-[16px] border border-[var(--border)] p-[24px]">
            <div className="flex items-center gap-[8px] mb-[16px]">
              <Tag size={16} className="text-[var(--accent)]" />
              <h3 className="font-bold text-[14px]">Código Promocional</h3>
            </div>
            <div className="flex flex-col gap-[10px]">
              <input
                type="text"
                placeholder="XXXXXX"
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); setPromoSuccess(''); }}
                onKeyDown={e => e.key === 'Enter' && handleValidatePromo()}
                className="w-full bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[8px] px-[12px] py-[10px] text-[14px] font-mono tracking-[2px] text-center text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors uppercase"
              />
              {promoError && (
                <div className="text-[12px] text-[var(--loss)] bg-[var(--loss-bg)] px-[10px] py-[6px] rounded-[6px] border border-[rgba(255,76,106,0.2)]">
                  {promoError}
                </div>
              )}
              {promoSuccess && (
                <div className="text-[12px] text-[var(--profit)] bg-[var(--profit-bg)] px-[10px] py-[6px] rounded-[6px] border border-[rgba(0,229,195,0.2)]">
                  {promoSuccess}
                </div>
              )}
              <button
                onClick={handleValidatePromo}
                className="w-full flex items-center justify-center gap-[8px] py-[10px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[8px] text-[13px] font-medium hover:bg-[var(--bg-surface-4)] hover:border-[var(--accent)] transition-all text-[var(--text-primary)]"
              >
                <Lock size={14} />
                Validar y Activar
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-[12px]">Los códigos expiran 15 días después de su emisión.</p>
          </div>

          {/* Back to login */}
          <button
            onClick={onBack}
            className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors text-center"
          >
            ← Volver al inicio de sesión
          </button>
        </div>
      </div>
    </div>
  );
};
