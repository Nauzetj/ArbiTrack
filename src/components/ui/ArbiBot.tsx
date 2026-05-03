import React from 'react';

interface ArbiBotProps {
  size?: number;
  className?: string;
}

/**
 * ArbiBot — Logotipo visual del asistente IA de ArbiTrack.
 * SVG personalizado con estética futurista: ojo pulsante, antena, circuitos y anillo de energía.
 */
export const ArbiBot: React.FC<ArbiBotProps> = ({ size = 32, className = '' }) => {
  const id = React.useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ArbiTrack AI Bot"
    >
      <defs>
        {/* Glow filter for the eye */}
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Radial gradient for the body */}
        <radialGradient id={`${id}-body`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.05" />
        </radialGradient>
        {/* Accent gradient for the eye */}
        <radialGradient id={`${id}-eye`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#2563eb" />
        </radialGradient>
        {/* Linear gradient for the body outline */}
        <linearGradient id={`${id}-outline`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* ── Outer pulsing ring ── */}
      <circle cx="32" cy="34" r="28" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.25" fill="none" />
      <circle cx="32" cy="34" r="24" stroke="#3b82f6" strokeWidth="0.5" strokeOpacity="0.15" fill="none" />

      {/* ── Antenna ── */}
      <line x1="32" y1="9" x2="32" y2="16" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="7.5" r="2.5" fill="#60a5fa" filter={`url(#${id}-glow)`} />

      {/* ── Bot body ── */}
      <rect
        x="12" y="17" width="40" height="34"
        rx="10" ry="10"
        fill={`url(#${id}-body)`}
        stroke={`url(#${id}-outline)`}
        strokeWidth="1.5"
      />

      {/* ── Eye (single centered lens) ── */}
      <circle cx="32" cy="31" r="9" fill="#0f172a" stroke="#3b82f6" strokeWidth="1" />
      <circle
        cx="32" cy="31" r="5.5"
        fill={`url(#${id}-eye)`}
        filter={`url(#${id}-glow)`}
      />
      {/* Pupil */}
      <circle cx="32" cy="31" r="2.5" fill="#eff6ff" />
      {/* Lens reflection */}
      <circle cx="30.2" cy="29.2" r="1" fill="white" fillOpacity="0.6" />

      {/* ── Mouth / speaker bar ── */}
      <rect x="22" y="44" width="20" height="3" rx="1.5" fill="#3b82f6" fillOpacity="0.5" />
      <rect x="25" y="44" width="4" height="3" rx="1.5" fill="#60a5fa" fillOpacity="0.8" />
      <rect x="31" y="44" width="4" height="3" rx="1.5" fill="#60a5fa" fillOpacity="0.8" />
      <rect x="37" y="44" width="2" height="3" rx="1" fill="#60a5fa" fillOpacity="0.8" />

      {/* ── Side ear-ports ── */}
      <rect x="8" y="26" width="4" height="10" rx="2" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.5" />
      <rect x="52" y="26" width="4" height="10" rx="2" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.5" />

      {/* ── Circuit lines (decorative) ── */}
      <line x1="16" y1="38" x2="20" y2="38" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.6" />
      <circle cx="15.5" cy="38" r="0.8" fill="#60a5fa" fillOpacity="0.7" />
      <line x1="44" y1="38" x2="48" y2="38" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.6" />
      <circle cx="48.5" cy="38" r="0.8" fill="#60a5fa" fillOpacity="0.7" />
    </svg>
  );
};
