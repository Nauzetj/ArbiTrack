import React, { useEffect, useState } from 'react';
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
  delayMs = 0,
  isProfitValue = false
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof mainValue === 'number') {
      let start = 0;
      const end = mainValue;
      const duration = 1200;
      const startTime = performance.now();

      const step = (currentTime: number) => {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 5);
        setDisplayValue(start + (end - start) * easeOut);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          setDisplayValue(end);
        }
      };

      requestAnimationFrame(step);
    }
  }, [mainValue]);

  const valToShow = typeof mainValue === 'number' ? displayValue : mainValue;
  const isPositive = typeof mainValue === 'number' ? mainValue >= 0 : isProfitValue;

  let valueClass = 'text-[36px] font-medium mono leading-tight ';
  if (isPositive) valueClass += 'text-profit';
  else if (typeof mainValue === 'number') valueClass += 'text-loss';
  else valueClass += 'text-primary';

  return (
    <div 
      className={`bg-surface-2 rounded-[16px] border-default p-[20px] animate-fade-in-up flex flex-col gap-[12px] relative overflow-hidden transition-all duration-200 hover:border-[var(--border-strong)] ${isActive ? 'shadow-[0_0_20px_rgba(0,229,195,0.06)] border-[var(--accent-border)] hover:border-[var(--accent-border)]' : ''}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {isActive && (
         <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--accent)]" />
      )}
      
      <div className="flex items-center gap-[8px] text-tertiary uppercase text-[10px] font-semibold tracking-[1.2px]">
        {icon}
        <span>{title}</span>
      </div>

      <div className="flex flex-col">
        <div className={valueClass}>
          {typeof valToShow === 'number' && typeof mainValue === 'number' 
             ? (valToShow > 0 ? '+' : '') + valToShow.toFixed(2)
             : valToShow}
        </div>
        {subValue && (
          <div className="text-[13px] text-secondary mt-[4px]">
            {subValue}
          </div>
        )}
      </div>

      {badgeText && badgeVariant && (
        <div className="mt-auto pt-[4px]">
          <Badge variant={badgeVariant}>{badgeText}</Badge>
        </div>
      )}
    </div>
  );
};
