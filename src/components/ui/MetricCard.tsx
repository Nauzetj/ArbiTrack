import React, { useState } from 'react';
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

import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';

gsap.registerPlugin(useGSAP);

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

  useGSAP(() => {
    if (typeof mainValue === 'number') {
      const target = { val: displayValue };
      gsap.to(target, {
        val: mainValue,
        duration: 2,
        ease: "power3.out",
        onUpdate: () => {
          setDisplayValue(target.val);
        }
      });
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
      className={`metric-card bg-surface-2 rounded-[16px] border-default p-[20px] flex flex-col gap-[12px] relative overflow-hidden transition-all duration-300 hover:border-[var(--border-strong)] opacity-0 ${isActive ? 'shadow-[0_0_20px_rgba(0,229,195,0.06)] border-[var(--accent-border)] hover:border-[var(--accent-border)]' : ''}`}
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
