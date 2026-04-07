import React, { useRef } from 'react';
import { gsap } from 'gsap';

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Attraction strength 0–1. Default 0.35 */
  strength?: number;
  tag?: 'button' | 'a';
  href?: string;
  target?: string;
  rel?: string;
  type?: 'button' | 'submit' | 'reset';
  id?: string;
}

/**
 * MagneticButton — the button follows your cursor slightly on hover
 * and does a premium elastic bounce when you leave. Powered by GSAP.
 */
export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className = '',
  onClick,
  disabled,
  strength = 0.35,
  tag = 'button',
  href,
  target,
  rel,
  type = 'button',
  id,
}) => {
  const elRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (disabled || !elRef.current) return;
    const rect = elRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * strength;
    const dy = (e.clientY - cy) * strength;
    gsap.to(elRef.current, { x: dx, y: dy, duration: 0.3, ease: 'power2.out' });
  };

  const handleMouseLeave = () => {
    if (!elRef.current) return;
    gsap.to(elRef.current, { x: 0, y: 0, duration: 0.75, ease: 'elastic.out(1, 0.4)' });
  };

  const handleMouseDown = () => {
    if (!elRef.current) return;
    gsap.to(elRef.current, { scale: 0.93, duration: 0.1, ease: 'power2.in' });
  };

  const handleMouseUp = () => {
    if (!elRef.current) return;
    gsap.to(elRef.current, { scale: 1, duration: 0.55, ease: 'elastic.out(1.2, 0.5)' });
  };

  const sharedEvents = {
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onClick,
  };

  const style: React.CSSProperties = { display: 'inline-block', willChange: 'transform' };

  if (tag === 'a') {
    return (
      <a ref={elRef as React.Ref<HTMLAnchorElement>} id={id} className={className} href={href} target={target} rel={rel} style={style} {...sharedEvents}>
        {children}
      </a>
    );
  }

  return (
    <button ref={elRef as React.Ref<HTMLButtonElement>} id={id} type={type} disabled={disabled} className={className} style={style} {...sharedEvents}>
      {children}
    </button>
  );
};
