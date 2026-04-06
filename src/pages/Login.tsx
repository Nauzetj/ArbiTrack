import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { Activity, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { redeemPromoCode } from '../services/dbOperations';
import { PricingPage } from './PricingPage';
import { PaymentRequestForm } from './PaymentRequestForm';
import type { PromoCode, UserRole } from '../types';

// ── Input field helper ────────────────────────────────────────────────────────
const Field: React.FC<{
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  mono?: boolean;
}> = ({ label, type, value, onChange, placeholder, mono }) => (
  <div className="flex flex-col gap-[6px]">
    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className={`bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[12px] px-[16px] py-[13px] text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all ${mono ? 'font-mono text-[13px]' : 'font-semibold'}`}
    />
  </div>
);

// ── Message box ───────────────────────────────────────────────────────────────
const MsgBox: React.FC<{ msg: string }> = ({ msg }) => {
  const isGood = msg.includes('exitosamente') || msg.includes('válido') || msg.startsWith('✓');
  return (
    <div className={`p-[12px] rounded-[8px] text-[13px] border ${
      isGood
        ? 'bg-[var(--profit-bg)] text-[var(--profit)] border-[rgba(0,229,195,0.3)]'
        : 'bg-[var(--loss-bg)] text-[var(--loss)] border-[rgba(255,76,106,0.3)]'
    }`}>{msg}</div>
  );
};

// ── Mobile-optimized page wrapper ─────────────────────────────────────────────
// On mobile: scrollable single-column.
const MobilePage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="min-h-[100dvh] w-full bg-[var(--bg-base)] flex flex-col md:hidden overflow-y-auto"
  >
    {children}
  </div>
);

// ── Compact mobile header (replaces the full-screen brand panel on mobile) ────
const MobileHeader: React.FC = () => (
  <div
    className="md:hidden flex-shrink-0 relative overflow-hidden"
    style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '28px 24px 32px',
    }}
  >
    {/* Glow effect */}
    <div className="absolute top-[-40px] right-[-40px] w-[160px] h-[160px] rounded-full opacity-20 pointer-events-none"
      style={{ background: 'var(--accent)', filter: 'blur(60px)' }} />

    <div className="relative z-10 flex items-center gap-[14px]">
      <div className="w-[48px] h-[48px] bg-[var(--accent)] rounded-[14px] flex items-center justify-center flex-shrink-0 shadow-lg">
        <Activity size={26} className="text-white" />
      </div>
      <div>
        <h1 className="font-bold text-[22px] tracking-tight text-white leading-tight">
          ArbiTrack <span className="text-[var(--accent)] font-mono">P2P</span>
        </h1>
        <p className="text-[12px] text-white/60 mt-[1px]">
          Sistema contable para operadores P2P
        </p>
      </div>
    </div>
  </div>
);

// ── Desktop brand panel ───────────────────────────────────────────────────────
const DesktopBrand: React.FC = () => (
  <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#1e293b] to-[#0f172a] relative flex-col p-[40px] text-white justify-between overflow-hidden">
    <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-[var(--accent)]/15 blur-[120px] rounded-full pointer-events-none" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[var(--profit)]/10 blur-[100px] rounded-full pointer-events-none" />
    <div className="relative z-10 flex flex-col items-center justify-center h-full gap-[32px] text-center">
      <div className="w-[72px] h-[72px] bg-[var(--accent)] rounded-[20px] flex items-center justify-center">
        <Activity size={40} className="text-white" />
      </div>
      <div>
        <h1 className="text-[40px] font-bold tracking-tight text-white">
          ArbiTrack <span className="text-[var(--accent)] font-mono">P2P</span>
        </h1>
        <p className="text-[16px] text-white/70 mt-[12px] max-w-[280px] mx-auto">
          El sistema contable profesional para operadores en Venezuela.
        </p>
      </div>
      <div className="mt-[20px] text-center">
        <h2 className="text-[28px] font-light leading-tight text-white">
          Auditoría<br /><span className="font-bold">Inteligente</span>
        </h2>
      </div>
    </div>
    <div className="relative z-10 pt-[20px] border-t border-white/10 w-full text-center mt-[40px]">
      <p className="text-[12px] text-white/50 tracking-[1px] uppercase">ArbiTrack P2P © 2026</p>
    </div>
  </div>
);

// ── Desktop shell (only used on md+) ─────────────────────────────────────────
const DesktopShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="hidden md:flex min-h-screen bg-[var(--bg-base)] items-center justify-center p-[40px]">
    <div className="w-full max-w-[1000px] bg-[var(--bg-surface-1)] rounded-[24px] overflow-hidden flex flex-row shadow-2xl animate-fade-in-up border border-[var(--border)] min-h-[600px]">
      <DesktopBrand />
      <div className="flex-1 p-[48px] flex flex-col justify-center overflow-y-auto">
        {children}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
export const Login: React.FC = () => {
  type Mode = 'login' | 'register' | 'pricing' | 'payment_request';
  const [mode, setMode] = useState<Mode>('login');

  const [validatedPromo, setValidatedPromo] = useState<PromoCode | null>(null);
  const [validatedPlan, setValidatedPlan] = useState<UserRole>('free');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginApiKey, setLoginApiKey] = useState('');
  const [loginSecretKey, setLoginSecretKey] = useState('');

  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login: storeLogin } = useAppStore();
  const navigate = useNavigate();

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (!regEmail || !regPassword || !regUsername || !regFullName)
        throw new Error('Todos los campos son requeridos.');

      const role: UserRole = validatedPlan || 'free';
      let planExpiresAt: string | null = null;
      if (role === 'vip_promo') { const d = new Date(); d.setDate(d.getDate() + 15); planExpiresAt = d.toISOString(); }
      else if (role === 'vip_monthly') { const d = new Date(); d.setMonth(d.getMonth() + 1); planExpiresAt = d.toISOString(); }
      else if (role === 'vip_semiannual') { const d = new Date(); d.setMonth(d.getMonth() + 6); planExpiresAt = d.toISOString(); }
      else if (role === 'vip_annual') { const d = new Date(); d.setFullYear(d.getFullYear() + 1); planExpiresAt = d.toISOString(); }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        options: { data: { username: regUsername.trim(), full_name: regFullName.trim(), role } },
      });
      if (signUpError) throw new Error(signUpError.message);
      if (!data.user) throw new Error('No se pudo crear el usuario.');

      if (planExpiresAt || role !== 'free') {
        await supabase.from('profiles').update({ role, plan_expires_at: planExpiresAt }).eq('id', data.user.id);
      }
      if (validatedPromo) await redeemPromoCode(validatedPromo.code, data.user.id);

      setLoginEmail(regEmail.trim().toLowerCase());
      setError('¡Cuenta creada exitosamente! Revisa tu email para confirmar, luego inicia sesión.');
      setMode('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (!loginApiKey || !loginSecretKey) throw new Error('API Key y Secret Key son requeridos.');
      if (!loginEmail || !loginPassword) throw new Error('Email y contraseña son requeridos.');

      const signInPromise = supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      const timeoutPromise = new Promise<{data: any, error: any}>((_, reject) => 
        setTimeout(() => reject(new Error('Súper demora de Red. Tu conexión local o PWA está bloqueando la app. ¡Por favor intenta otra vez!')), 5000)
      );

      const { data, error: signInError } = await Promise.race([signInPromise, timeoutPromise]);

      if (signInError) throw new Error('Credenciales incorrectas o problema de red.');
      if (!data.session || !data.user) throw new Error('Error al iniciar sesión.');

      const profilePromise = supabase.from('profiles').select('*').eq('id', data.user.id).single();
      const profileTimeout = new Promise<{data: any}>((_, reject) => setTimeout(() => reject(new Error('Tiempo agotado al cargar perfil.')), 5000));
      
      const { data: profileData } = await Promise.race([profilePromise, profileTimeout]).catch(() => ({ data: null })) as any;
      
      const profile = profileData || {
        role: 'free', created_at: new Date().toISOString(),
        username: data.user.email?.split('@')[0], full_name: '',
      };

      storeLogin({
        id: data.user.id,
        username: profile.username || data.user.email?.split('@')[0] || 'Usuario',
        fullName: profile.full_name ?? '',
        passwordHash: '',
        createdAt: profile.created_at,
        role: profile.role ?? 'free',
        planExpiresAt: profile.plan_expires_at ?? null,
      }, data.session, loginApiKey, loginSecretKey);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Pricing / Payment ─────────────────────────────────────────────────────
  if (mode === 'pricing') {
    return (
      <PricingPage
        onPromoValidated={(code, plan) => {
          setValidatedPromo(code);
          setValidatedPlan(plan as UserRole);
          setMode('register');
        }}
        onRequestPayment={() => setMode('payment_request')}
        onBack={() => setMode('login')}
      />
    );
  }
  if (mode === 'payment_request') {
    return <PaymentRequestForm onBack={() => setMode('pricing')} />;
  }

  // ── The shared form content (used on both mobile and desktop) ─────────────
  const LoginFormContent = (
    <>
      <div className="mb-[28px]">
        <h2 className="text-[22px] font-bold text-[var(--text-primary)]">Iniciar Sesión</h2>
        <p className="text-[13px] text-[var(--text-secondary)] mt-[4px]">
          Ingresa tus credenciales para acceder.
        </p>
      </div>

      {error && <MsgBox msg={error} />}

      <form onSubmit={handleLogin} className="flex flex-col gap-[14px] mt-[4px]">
        <Field label="Correo Electrónico" type="email" value={loginEmail} onChange={setLoginEmail} placeholder="tu@email.com" />
        <Field label="Contraseña" type="password" value={loginPassword} onChange={setLoginPassword} placeholder="••••••••" />

        <div className="h-[1px] bg-[var(--border)] my-[2px]" />
        <div className="text-[12px] text-[var(--warning)] bg-[var(--warning-bg)] p-[12px] rounded-[10px]">
          <strong>Sesión Efímera.</strong> Las API Keys de Binance se borran al cerrar sesión.
        </div>

        <Field label="Binance API Key" type="password" value={loginApiKey} onChange={setLoginApiKey} placeholder="Clave pública" mono />
        <Field label="Binance Secret Key" type="password" value={loginSecretKey} onChange={setLoginSecretKey} placeholder="Clave secreta" mono />

        <Button type="submit" fullWidth className="mt-[8px] py-[14px] rounded-[12px]" disabled={isLoading}>
          {isLoading ? 'Conectando...' : 'ENTRAR Y CONECTAR →'}
        </Button>
      </form>

      <div className="mt-[24px] pt-[20px] border-t border-[var(--border)] text-center">
        <button type="button"
          onClick={() => { setMode('pricing'); setError(''); }}
          className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
          ¿Nuevo usuario? <span className="text-[var(--accent)]">Ver planes y registrarse</span>
        </button>
      </div>
    </>
  );

  // ── REGISTER ──────────────────────────────────────────────────────────────
  if (mode === 'register') {
    const planLabel =
      validatedPlan === 'vip_annual' ? 'Anual' :
      validatedPlan === 'vip_semiannual' ? 'Semestral' :
      validatedPlan === 'vip_monthly' ? 'Mensual' :
      validatedPlan === 'vip_promo' ? 'Promo 15 días' : 'Activo';

    const RegisterFormContent = (
      <>
        <div className="mb-[28px]">
          <h2 className="text-[22px] font-bold text-[var(--text-primary)]">Crear Cuenta</h2>
          <div className="mt-[10px] inline-flex items-center gap-[6px] text-[12px] font-bold text-[var(--profit)] bg-[var(--profit-bg)] px-[12px] py-[6px] rounded-[8px]">
            <CheckCircle size={13} />
            Plan {planLabel} verificado
          </div>
        </div>

        {error && <MsgBox msg={error} />}

        <form onSubmit={handleRegister} className="flex flex-col gap-[14px] mt-[4px]">
          <Field label="Nombre Completo" type="text" value={regFullName} onChange={setRegFullName} placeholder="Tu nombre completo" />
          <Field label="Usuario (visible en la app)" type="text" value={regUsername} onChange={setRegUsername} placeholder="Ej: Nauzetj" />
          <Field label="Correo Electrónico" type="email" value={regEmail} onChange={setRegEmail} placeholder="tu@email.com" />
          <Field label="Contraseña" type="password" value={regPassword} onChange={setRegPassword} placeholder="Mínimo 6 caracteres" />

          <Button type="submit" fullWidth className="mt-[8px] py-[14px] rounded-[12px]" disabled={isLoading}>
            {isLoading ? 'Creando cuenta...' : 'CREAR CUENTA →'}
          </Button>
        </form>

        <div className="mt-[20px] text-center">
          <button type="button" onClick={() => setMode('pricing')}
            className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
            ← Volver
          </button>
        </div>
      </>
    );

    return (
      <>
        {/* ── Mobile version ── */}
        <MobilePage>
          <MobileHeader />
          <div className="flex-1 bg-[var(--bg-surface-1)] p-[24px] pb-[40px] flex flex-col justify-start">
            {RegisterFormContent}
          </div>
        </MobilePage>

        {/* ── Desktop version ── */}
        <DesktopShell>
          {RegisterFormContent}
        </DesktopShell>
      </>
    );
  }

  // ── LOGIN (default) ───────────────────────────────────────────────────────
  return (
    <>
      {/* ── Mobile version: header + scrollable form ── */}
      <MobilePage>
        <MobileHeader />
        <div className="flex-1 bg-[var(--bg-surface-1)] p-[24px] pb-[40px] flex flex-col justify-start">
          {LoginFormContent}
        </div>
      </MobilePage>

      {/* ── Desktop version: split card ── */}
      <DesktopShell>
        {LoginFormContent}
      </DesktopShell>
    </>
  );
};
