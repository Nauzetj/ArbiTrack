import React, { useRef } from 'react';
import { Badge } from './Badge';

interface MetricCardProps {
  title: string;
  icon: React.ReactNode;
  mainValue: string | number;
  subValue?: string;
  badgeText?: string;
  badgeVariant?: 'profit' | 'loss' | 'warning' | 'neutral' | 'accent';
  isActive?: boolean;
  delayMs?: number;
  isProfitValue?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  icon,
  mainValue,
  subValue,
  badgeText,
  badgeVariant,
  isActive = false,
  isProfitValue = false
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // ── 3-D tilt on mouse move ─────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const { left, top, width, height } = card.getBoundingClientRect();
    const x = (e.clientX - left) / width  - 0.5;  // -0.5 → 0.5
    const y = (e.clientY - top)  / height - 0.5;
    card.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.02)`;
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = `perspective(900px) rotateY(0deg) rotateX(0deg) scale(1)`;
  };

  const valToShow  = mainValue;
  const isPositive = typeof mainValue === 'number' ? mainValue >= 0 : isProfitValue;

  let valueClass = 'text-[32px] font-medium mono leading-tight ';
  if (isPositive)                        valueClass += 'text-profit';
  else if (typeof mainValue === 'number') valueClass += 'text-loss';
  else                                   valueClass += 'text-primary';

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ willChange: 'transform', transition: 'transform 0.2s ease-out' }}
      className={[
        'metric-card bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[20px]',
        'flex flex-col gap-[12px] relative overflow-hidden',
        'transition-shadow duration-300 cursor-default',
        'hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]',
        isActive
          ? 'shadow-[0_0_18px_rgba(37,99,235,0.09)] border-[var(--accent-border)]'
          : '',
      ].join(' ')}
    >
      {/* Subtle top accent bar when active */}
      {isActive && (
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
      )}

      {/* Header label */}
      <div className="flex items-center gap-[8px] text-[var(--text-tertiary)] uppercase text-[10px] font-semibold tracking-[1.2px] relative z-10">
        {icon}
        <span>{title}</span>
      </div>

      {/* Value */}
      <div className="flex flex-col relative z-10">
        <div className={valueClass}>
          {typeof valToShow === 'number'
            ? (valToShow > 0 ? '+' : '') + valToShow.toFixed(2)
            : valToShow}
        </div>
        {subValue && (
          <div className="text-[13px] text-[var(--text-secondary)] mt-[4px]">{subValue}</div>
        )}
      </div>

      {badgeText && badgeVariant && (
        <div className="mt-auto pt-[4px] relative z-10">
          <Badge variant={badgeVariant}>{badgeText}</Badge>
        </div>
      )}
    </div>
  );
};
