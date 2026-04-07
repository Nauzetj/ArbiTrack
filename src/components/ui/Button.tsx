import React, { useRef } from 'react';
import { gsap } from 'gsap';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
  /** Enable the GSAP magnetic follow effect. Default true for primary, false for others. */
  magnetic?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = false,
  className = '',
  magnetic,
  disabled,
  ...props
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const isMagnetic = magnetic ?? variant === 'primary';

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isMagnetic || disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    const dx = (e.clientX - cx) * 0.3;
    const dy = (e.clientY - cy) * 0.3;
    gsap.to(ref.current, { x: dx, y: dy, duration: 0.28, ease: 'power2.out' });
  };

  const handleMouseLeave = () => {
    if (!isMagnetic || !ref.current) return;
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.65, ease: 'elastic.out(1, 0.45)' });
  };

  const handleMouseDown = () => {
    if (!ref.current) return;
    gsap.to(ref.current, { scale: 0.94, duration: 0.1, ease: 'power2.in' });
  };

  const handleMouseUp = () => {
    if (!ref.current) return;
    gsap.to(ref.current, { scale: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.5)' });
  };

  return (
    <button
      ref={ref}
      className={`btn btn-${variant} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      style={{ willChange: 'transform' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      {...props}
    >
      {children}
    </button>
  );
};
