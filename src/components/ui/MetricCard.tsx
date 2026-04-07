import React, { useRef, useState } from 'react';
import { Badge } from './Badge';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';

gsap.registerPlugin(useGSAP);

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
  const [displayValue, setDisplayValue] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (typeof mainValue === 'number') {
      const target = { val: 0 };
      gsap.to(target, {
        val: mainValue,
        duration: 1.8,
        ease: 'power3.out',
        onUpdate: () => setDisplayValue(target.val),
      });
    }
  }, [mainValue]);

  // ── 3-D tilt on mouse move ─────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const { left, top, width, height } = card.getBoundingClientRect();
    const x = (e.clientX - left) / width  - 0.5;  // -0.5 → 0.5
    const y = (e.clientY - top)  / height - 0.5;
    gsap.to(card, {
      rotateY:   x * 10,
      rotateX:  -y * 10,
      scale:     1.02,
      duration:  0.3,
      ease:      'power2.out',
      transformPerspective: 900,
    });
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    gsap.to(card, {
      rotateY: 0,
      rotateX: 0,
      scale:   1,
      duration: 0.5,
      ease:    'elastic.out(1, 0.6)',
      transformPerspective: 900,
    });
  };

  const valToShow  = typeof mainValue === 'number' ? displayValue : mainValue;
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
      style={{ willChange: 'transform' }}
      className={[
        'metric-card bg-surface-2 rounded-[16px] border-default p-[20px]',
        'flex flex-col gap-[12px] relative overflow-hidden',
        'transition-shadow duration-300 cursor-default opacity-0',
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

      {/* Shimmer sweep */}
      <div className="animate-shimmer pointer-events-none" />

      {/* Header label */}
      <div className="flex items-center gap-[8px] text-tertiary uppercase text-[10px] font-semibold tracking-[1.2px] relative z-10">
        {icon}
        <span>{title}</span>
      </div>

      {/* Value */}
      <div className="flex flex-col relative z-10">
        <div className={valueClass}>
          {typeof valToShow === 'number' && typeof mainValue === 'number'
            ? (valToShow > 0 ? '+' : '') + valToShow.toFixed(2)
            : valToShow}
        </div>
        {subValue && (
          <div className="text-[13px] text-secondary mt-[4px]">{subValue}</div>
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
