import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { Activity } from 'lucide-react';
import { getUserByUsername, createUser, redeemPromoCode } from '../services/dbOperations';
import { hashPassword, verifyPassword, generateUUID } from '../crypto/auth';
import { PricingPage } from './PricingPage';
import { PaymentRequestForm } from './PaymentRequestForm';
import type { PromoCode, UserRole } from '../types';

const ADMIN_USERNAME = 'Nauzetj';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'pricing' | 'register' | 'payment_request'>('login');
  const [validatedPromo, setValidatedPromo] = useState<PromoCode | null>(null);
  const [validatedPlan, setValidatedPlan] = useState<UserRole>('free');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAppStore();
  const navigate = useNavigate();

  const handlePromoValidated = (code: PromoCode, plan: string) => {
    setValidatedPromo(code);
    setValidatedPlan(plan as UserRole);
    setMode('register');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!username || !password || !fullName) throw new Error('Todos los campos son requeridos.');
      const existing = getUserByUsername(username);
      if (existing) throw new Error('El usuario ya existe.');

      // Determine role: admin if Nauzetj, else use promo plan
      const role: UserRole = username === ADMIN_USERNAME ? 'admin' : validatedPlan;
      let planExpiresAt: string | null = null;
      if (role === 'vip_monthly') {
        const d = new Date(); d.setMonth(d.getMonth() + 1);
        planExpiresAt = d.toISOString();
      } else if (role === 'vip_semiannual') {
        const d = new Date(); d.setMonth(d.getMonth() + 6);
        planExpiresAt = d.toISOString();
      } else if (role === 'vip_annual') {
        const d = new Date(); d.setFullYear(d.getFullYear() + 1);
        planExpiresAt = d.toISOString();
      }

      const newUser = {
        id: generateUUID(),
        username,
        fullName,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        role,
        planExpiresAt,
      };
      createUser(newUser);

      // Mark promo code as used
      if (validatedPromo) {
        redeemPromoCode(validatedPromo.code, newUser.id);
      }

      setMode('login');
      setPassword('');
      setError('¡Perfil creado exitosamente! Inicia sesión con tus credenciales.');
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
      if (!apiKey || !secretKey) throw new Error('API Key y Secret Key son requeridos.');
      const user = getUserByUsername(username);
      if (!user) throw new Error('Credenciales incorrectas.');
      if (!verifyPassword(password, user.passwordHash)) throw new Error('Credenciales incorrectas.');
      login(user, apiKey, secretKey);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Pricing gate ────────────────────────────────────────────────
  if (mode === 'pricing') {
    return (
      <PricingPage
        onPromoValidated={handlePromoValidated}
        onRequestPayment={() => setMode('payment_request')}
        onBack={() => setMode('login')}
      />
    );
  }

  // ── Payment Request Form ────────────────────────────────────────
  if (mode === 'payment_request') {
    return <PaymentRequestForm onBack={() => setMode('pricing')} />;
  }

  // ── Register form (after promo validation) ──────────────────────
  if (mode === 'register') {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-[20px] md:p-[40px] lg:p-[40px]">
        <div className="w-full max-w-[1000px] bg-[var(--bg-surface-1)] rounded-[24px] overflow-hidden flex flex-col md:flex-row shadow-[var(--shadow-xl)] animate-fade-in-up border border-[var(--border)] min-h-[600px]">
          
          {/* Left Side: Brand Promo / Gradient */}
          <div className="md:w-1/2 bg-gradient-to-br from-[#1e293b] to-[#0f172a] relative flex flex-col p-[40px] text-white justify-between overflow-hidden">
            {/* Abstract Elements */}
            <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-[var(--accent)]/15 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[var(--profit)]/10 blur-[100px] rounded-full pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center justify-center h-full gap-[32px] text-center">
              <div className="w-[72px] h-[72px] bg-[var(--accent)] rounded-[20px] flex items-center justify-center shadow-[var(--shadow-lg)]">
                <Activity size={40} className="text-white" />
              </div>
              <div>
                <h1 className="text-[40px] font-bold tracking-tight text-white">ArbiTrack <span className="text-[var(--accent)] font-mono">P2P</span></h1>
                <p className="text-[16px] text-white/70 mt-[12px] max-w-[280px] mx-auto">
                  El sistema contable profesional para operadores en Venezuela.
                </p>
              </div>
              
              <div className="mt-[20px] text-center">
                <h2 className="text-[28px] font-light leading-tight text-white">Auditoría<br/><span className="font-bold">Inteligente</span></h2>
              </div>
            </div>
            
            <div className="relative z-10 pt-[20px] border-t border-white/10 w-full text-center mt-[40px]">
              <p className="text-[12px] text-white/50 tracking-[1px] uppercase">ArbiTrack P2P © 2026</p>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="md:w-1/2 p-[40px] lg:p-[48px] bg-[var(--bg-surface-1)] flex flex-col justify-center">
            <div className="mb-[32px]">
              <h2 className="text-[20px] font-bold text-[var(--text-primary)]">Crear Perfil Seguro</h2>
              
              {validatedPromo && (
                <div className="mt-[8px] inline-block text-[12px] font-bold text-[var(--profit)] bg-[var(--profit-bg)] px-[12px] py-[6px] rounded-[8px] border border-transparent">
                  ✓ Plan {validatedPlan === 'vip_annual' ? 'Anual' : validatedPlan === 'vip_semiannual' ? 'Semestral' : 'Mensual'} verificado
                </div>
              )}
            </div>

            {error && (
              <div className={`p-[12px] mb-[24px] rounded-[8px] text-[13px] border ${
                error.includes('exitosamente')
                  ? 'bg-[var(--profit-bg)] text-[var(--profit)] border-[rgba(0,229,195,0.3)]'
                  : 'bg-[var(--loss-bg)] text-[var(--loss)] border-[rgba(255,76,106,0.3)]'
              }`}>{error}</div>
            )}

            <form onSubmit={handleRegister} className="flex flex-col gap-[16px]">
              {[
                { label: 'Nombre Completo', val: fullName, set: setFullName, type: 'text', ph: 'Tu nombre' },
                { label: 'Usuario', val: username, set: setUsername, type: 'text', ph: 'Crea tu usuario' },
                { label: 'Contraseña (Local)', val: password, set: setPassword, type: 'password', ph: 'Crea una contraseña' },
              ].map(f => (
                <div key={f.label} className="flex flex-col gap-[6px]">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.5px]">{f.label}</label>
                  <input
                    type={f.type}
                    value={f.val}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.ph}
                    className="bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[12px] px-[16px] py-[12px] text-[14px] font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all focus:bg-[var(--bg-surface-1)] focus:shadow-sm"
                  />
                </div>
              ))}
              
              <Button type="submit" fullWidth className="mt-[12px] py-[14px] rounded-[12px] shadow-[0_4px_16px_var(--accent-muted)] hover:-translate-y-1 hover:shadow-[0_8px_24px_var(--accent-border)]" disabled={isLoading}>
                {isLoading ? 'Creando...' : 'CREAR PERFIL →'}
              </Button>
            </form>

            <div className="mt-[32px] pt-[24px] border-t border-[var(--border)] text-center">
              <button
                onClick={() => setMode('pricing')}
                className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors inline-flex items-center gap-[6px]"
              >
                ← Volver a ver los planes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Login form ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-[20px] md:p-[40px] lg:p-[40px]">
      <div className="w-full max-w-[1000px] bg-[var(--bg-surface-1)] rounded-[24px] overflow-hidden flex flex-col md:flex-row shadow-[var(--shadow-xl)] animate-fade-in-up border border-[var(--border)] min-h-[600px]">
        
        {/* Left Side: Brand Promo / Gradient */}
        <div className="md:w-1/2 bg-gradient-to-br from-[#1e293b] to-[#0f172a] relative flex flex-col p-[40px] text-white justify-between overflow-hidden">
          {/* Abstract Elements */}
          <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-[var(--accent)]/15 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[var(--profit)]/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center justify-center h-full gap-[32px] text-center">
            <div className="w-[72px] h-[72px] bg-[var(--accent)] rounded-[20px] flex items-center justify-center shadow-[var(--shadow-lg)]">
              <Activity size={40} className="text-white" />
            </div>
            <div>
              <h1 className="text-[40px] font-bold tracking-tight text-white">ArbiTrack <span className="text-[var(--accent)] font-mono">P2P</span></h1>
              <p className="text-[16px] text-white/70 mt-[12px] max-w-[280px] mx-auto">
                El sistema contable profesional para operadores en Venezuela.
              </p>
            </div>
            
            <div className="mt-[20px] text-center">
              <h2 className="text-[28px] font-light leading-tight text-white">Auditoría<br/><span className="font-bold">Inteligente</span></h2>
            </div>
          </div>
          
          <div className="relative z-10 pt-[20px] border-t border-white/10 w-full text-center mt-[40px]">
            <p className="text-[12px] text-white/50 tracking-[1px] uppercase">ArbiTrack P2P © 2026</p>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="md:w-1/2 p-[40px] lg:p-[48px] bg-[var(--bg-surface-1)] flex flex-col justify-center">
          <div className="mb-[32px]">
            <h2 className="text-[20px] font-bold text-[var(--text-primary)]">Iniciar Sesión</h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-[4px]">Ingresa tus credenciales para acceder.</p>
          </div>

          {error && (
            <div className={`p-[12px] mb-[24px] rounded-[8px] text-[13px] border ${
              error.includes('exitosamente')
                ? 'bg-[var(--profit-bg)] text-[var(--profit)] border-[rgba(0,229,195,0.3)]'
                : 'bg-[var(--loss-bg)] text-[var(--loss)] border-[rgba(255,76,106,0.3)]'
            }`}>{error}</div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-[16px]">
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.5px]">Usuario local</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="TU USUARIO"
                className="bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[12px] px-[16px] py-[12px] text-[14px] font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all focus:bg-[var(--bg-surface-1)] focus:shadow-sm" />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.5px]">Contraseña local</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className="bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[12px] px-[16px] py-[12px] text-[14px] font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all focus:bg-[var(--bg-surface-1)] focus:shadow-sm" />
            </div>

            <div className="h-[1px] bg-[var(--border)] my-[8px]" />
            <div className="text-[12px] text-[var(--warning)] bg-[var(--warning-bg)] p-[12px] rounded-[10px] border border-transparent">
              <strong>Sesión Efímera.</strong> Las API Keys se borran al salir.
            </div>
            
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.5px]">Binance API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Clave pública"
                className="bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[12px] px-[16px] py-[12px] text-[13px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all focus:bg-[var(--bg-surface-1)] focus:shadow-sm" />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.5px]">Binance Secret Key</label>
              <input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder="Clave secreta"
                className="bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[12px] px-[16px] py-[12px] text-[13px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all focus:bg-[var(--bg-surface-1)] focus:shadow-sm" />
            </div>

            <Button type="submit" fullWidth className="mt-[12px] py-[14px] rounded-[12px] shadow-[0_4px_16px_var(--accent-muted)] hover:-translate-y-1 hover:shadow-[0_8px_24px_var(--accent-border)]" disabled={isLoading}>
              {isLoading ? 'Conectando...' : 'ENTRAR Y CONECTAR →'}
            </Button>
          </form>

          <div className="mt-[32px] pt-[24px] border-t border-[var(--border)] text-center">
            <button
              type="button"
              onClick={() => { setMode('pricing'); setError(''); }}
              className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors inline-flex items-center gap-[6px]"
            >
              ¿Nuevo usuario? <span className="text-[var(--accent)]">Ver planes y registrarse</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
