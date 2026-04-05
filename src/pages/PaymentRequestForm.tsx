import React, { useState, useRef } from 'react';
import { Upload, ImageIcon, ArrowLeft, Send, Check } from 'lucide-react';
import { createPaymentRequest } from '../services/dbOperations';
import { generateUUID } from '../crypto/auth';

const DURATION_LABELS: Record<string, string> = {
  '15d': '🎁 Promo 15 días',
  '1m':  '⚡ 1 Mes — $8.00',
  '6m':  '🔥 6 Meses — $36.00',
  '12m': '🌟 12 Meses — $48.00',
};

interface PaymentRequestFormProps {
  onBack: () => void;
}

export const PaymentRequestForm: React.FC<PaymentRequestFormProps> = ({ onBack }) => {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [plan, setPlan] = useState('vip_monthly');
  const [duration, setDuration] = useState('1m');
  const [imageData, setImageData] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar los 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImageData(result);
      setImagePreview(result);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Ingresa tu nombre.'); return; }
    if (!contact.trim()) { setError('Ingresa tu contacto (WhatsApp o correo).'); return; }
    if (!imageData) { setError('Adjunta la captura del comprobante de pago.'); return; }

    createPaymentRequest({
      id: generateUUID(),
      name: name.trim(),
      contact: contact.trim(),
      plan,
      duration,
      imageData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewNote: null,
      generatedCode: null,
    });

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-[24px]">
        <div className="text-center flex flex-col items-center gap-[20px] max-w-[400px] animate-fade-in-up">
          <div className="w-[72px] h-[72px] bg-[var(--profit-bg)] rounded-full flex items-center justify-center border border-[rgba(0,229,195,0.3)]">
            <Check size={36} className="text-[var(--profit)]" />
          </div>
          <div>
            <h2 className="text-[22px] font-bold text-[var(--text-primary)]">¡Comprobante enviado!</h2>
            <p className="text-[14px] text-[var(--text-secondary)] mt-[8px]">
              Tu solicitud fue registrada correctamente. El administrador revisará tu pago y te enviará un código de activación al contacto que proporcionaste.
            </p>
          </div>
          <p className="text-[12px] text-[var(--text-tertiary)] bg-[var(--bg-surface-2)] px-[16px] py-[10px] rounded-[8px] border border-[var(--border)]">
            Contacto registrado: <strong className="text-[var(--text-primary)]">{contact}</strong>
          </p>
          <button
            onClick={onBack}
            className="text-[13px] text-[var(--accent)] hover:underline mt-[8px]"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex items-center justify-center p-[24px]">
      <div className="w-full max-w-[480px] bg-[var(--bg-surface-1)] border border-[var(--border)] rounded-[20px] p-[32px] animate-fade-in-up">

        <button onClick={onBack} className="flex items-center gap-[6px] text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-[24px]">
          <ArrowLeft size={14} /> Volver
        </button>

        <div className="mb-[24px]">
          <h1 className="text-[20px] font-bold">Enviar Comprobante de Pago</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-[6px]">
            Adjunta una captura de tu pago y te enviaremos tu código de activación.
          </p>
        </div>

        {error && (
          <div className="bg-[var(--loss-bg)] text-[var(--loss)] border border-[rgba(255,76,106,0.2)] rounded-[8px] px-[12px] py-[8px] text-[13px] mb-[16px]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
          {/* Name */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.5px]">Nombre completo</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tu nombre"
              className="bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[8px] px-[12px] py-[10px] text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.5px]">WhatsApp o correo de contacto</label>
            <input
              type="text"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="+58 412 000 0000 o email@ejemplo.com"
              className="bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[8px] px-[12px] py-[10px] text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* Plan */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.5px]">Plan solicitado</label>
            <div className="grid grid-cols-2 gap-[8px]">
              {Object.entries(DURATION_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setDuration(key);
                    setPlan(key === '12m' ? 'vip_annual' : key === '6m' ? 'vip_semiannual' : 'vip_monthly');
                  }}
                  className={`text-left px-[12px] py-[10px] rounded-[8px] border text-[12px] font-medium transition-all ${
                    duration === key
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--border-strong)] bg-[var(--bg-surface-3)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Image upload */}
          <div className="flex flex-col gap-[8px]">
            <label className="text-[12px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.5px]">Captura del comprobante</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative rounded-[10px] overflow-hidden border border-[var(--border-strong)] group cursor-pointer" onClick={() => fileRef.current?.click()}>
                <img src={imagePreview} alt="Comprobante" className="w-full max-h-[240px] object-contain bg-[var(--bg-surface-3)]" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-[13px] font-medium">Cambiar imagen</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-[12px] w-full py-[32px] border-2 border-dashed border-[var(--border-strong)] rounded-[10px] bg-[var(--bg-surface-3)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all text-[var(--text-tertiary)] hover:text-[var(--accent)]"
              >
                <ImageIcon size={28} />
                <span className="text-[13px] font-medium">Clic para adjuntar imagen</span>
                <span className="text-[11px]">PNG, JPG, WEBP — máx 5MB</span>
              </button>
            )}
          </div>

          <button
            type="submit"
            className="flex items-center justify-center gap-[8px] py-[13px] bg-[var(--accent)] text-white font-bold text-[14px] rounded-[10px] hover:opacity-90 transition-all shadow-[0_4px_16px_var(--accent-muted)] hover:shadow-[0_6px_20px_var(--accent-border)] hover:-translate-y-[1px]"
          >
            <Send size={16} />
            Enviar Comprobante
          </button>
        </form>

        <p className="text-[11px] text-[var(--text-tertiary)] text-center mt-[16px]">
          Tu solicitud será revisada manualmente. Recibirás tu código de activación en máximo 24 horas.
        </p>
      </div>
    </div>
  );
};
