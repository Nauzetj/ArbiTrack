import React from 'react';

type BadgeVariant = 'profit' | 'loss' | 'warning' | 'neutral' | 'accent';

interface BadgeProps {
  children: React.ReactNode;
  variant: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant, className = '' }) => {
  let style: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px'
  };

  switch (variant) {
    case 'profit':
      style.backgroundColor = 'var(--profit-bg)';
      style.color = 'var(--profit)';
      style.border = '1px solid rgba(0, 229, 195, 0.3)';
      break;
    case 'loss':
      style.backgroundColor = 'var(--loss-bg)';
      style.color = 'var(--loss)';
      style.border = '1px solid rgba(255, 76, 106, 0.3)';
      break;
    case 'warning':
      style.backgroundColor = 'var(--warning-bg)';
      style.color = 'var(--warning)';
      style.border = '1px solid rgba(255, 176, 32, 0.3)';
      break;
    case 'accent':
      style.backgroundColor = 'var(--accent-muted)';
      style.color = 'var(--accent)';
      break;
    case 'neutral':
    default:
      style.backgroundColor = 'var(--bg-surface-4)';
      style.color = 'var(--text-secondary)';
      break;
  }

  return (
    <span style={style} className={className}>
      {children}
    </span>
  );
};
