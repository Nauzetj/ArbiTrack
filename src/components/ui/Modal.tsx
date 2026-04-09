import React, { useEffect, useRef } from 'react';
import { Button } from './Button';
import { AlertTriangle, Info, X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  confirmVariant?: 'primary' | 'danger';
  /** Icon type to show at the top of the modal */
  icon?: 'danger' | 'info' | 'none';
  /** If true, the confirm button will be disabled (e.g. during loading) */
  loading?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  confirmVariant = 'primary',
  icon = 'none',
  loading = false,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Animate in
      if (overlayRef.current) {
        overlayRef.current.style.opacity = '0';
        overlayRef.current.style.transition = 'opacity 200ms ease';
        requestAnimationFrame(() => {
          if (overlayRef.current) overlayRef.current.style.opacity = '1';
        });
      }
      if (contentRef.current) {
        contentRef.current.style.opacity = '0';
        contentRef.current.style.transform = 'scale(0.94) translateY(12px)';
        contentRef.current.style.transition = 'opacity 250ms cubic-bezier(0.16,1,0.3,1), transform 250ms cubic-bezier(0.16,1,0.3,1)';
        requestAnimationFrame(() => {
          if (contentRef.current) {
            contentRef.current.style.opacity = '1';
            contentRef.current.style.transform = 'scale(1) translateY(0px)';
          }
        });
      }
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDanger = confirmVariant === 'danger';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-[16px]"
      style={{
        background: 'rgba(2, 11, 22, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        ref={contentRef}
        className="relative w-full max-w-[420px] rounded-[20px] border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--bg-surface-2)',
          borderColor: isDanger ? 'rgba(255, 78, 78, 0.25)' : 'var(--border)',
          boxShadow: isDanger
            ? '0 0 0 1px rgba(255,78,78,0.1), 0 24px 48px rgba(0,0,0,0.5), 0 0 80px rgba(255,78,78,0.05)'
            : '0 0 0 1px rgba(0,229,195,0.05), 0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: isDanger
              ? 'linear-gradient(90deg, transparent, #ff4e4e, transparent)'
              : 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-[16px] right-[16px] w-[28px] h-[28px] rounded-full flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-4)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          <X size={14} />
        </button>

        <div className="p-[28px] pb-[24px]">
          {/* Icon */}
          {icon !== 'none' && (
            <div className="mb-[20px] flex">
              <div
                className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center"
                style={{
                  background: isDanger ? 'rgba(255,78,78,0.1)' : 'rgba(0,229,195,0.08)',
                  border: `1px solid ${isDanger ? 'rgba(255,78,78,0.2)' : 'rgba(0,229,195,0.15)'}`,
                }}
              >
                {icon === 'danger' ? (
                  <AlertTriangle size={22} className="text-[#ff4e4e]" />
                ) : (
                  <Info size={22} className="text-[var(--accent)]" />
                )}
              </div>
            </div>
          )}

          {/* Title */}
          <h3 className="text-[17px] font-bold text-[var(--text-primary)] mb-[10px] leading-snug pr-[32px]">
            {title}
          </h3>

          {/* Body */}
          <div className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed mb-[28px]">
            {children}
          </div>

          {/* Actions */}
          <div className="flex gap-[10px] justify-end">
            <Button variant="secondary" onClick={onClose} disabled={loading} magnetic={false}>
              {cancelText}
            </Button>
            {onConfirm && (
              <Button
                variant={confirmVariant}
                onClick={onConfirm}
                disabled={loading}
                magnetic={false}
              >
                {loading ? (
                  <span className="flex items-center gap-[8px]">
                    <span
                      className="inline-block w-[12px] h-[12px] rounded-full border-2 border-current border-t-transparent animate-spin"
                    />
                    Procesando...
                  </span>
                ) : confirmText}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
