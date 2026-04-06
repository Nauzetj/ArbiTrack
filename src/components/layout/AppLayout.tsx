import React, { useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { useAppStore } from '../../store/useAppStore';
import { getOrdersForUser, getCyclesForUser, getActiveCycleForUser } from '../../services/dbOperations';
import { fetchBCVRate } from '../../services/bcv';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';

// ── Plan expiry check ─────────────────────────────────────────────────────────
function isPlanExpired(planExpiresAt: string | null, role: string): boolean {
  if (role === 'admin' || role === 'free') return false;
  if (!planExpiresAt) return false;
  return new Date(planExpiresAt) < new Date();
}

const PLAN_DURATION_LABELS: Record<string, string> = {
  vip_promo: 'prueba de 15 días',
  vip_monthly: 'mensual',
  vip_semiannual: 'semestral',
  vip_annual: 'anual',
};

// ── Expired plan wall ─────────────────────────────────────────────────────────
const ExpiredWall: React.FC<{ role: string; planExpiresAt: string | null; onLogout: () => void }> = ({
  role, planExpiresAt, onLogout,
}) => {
  const expiredDate = planExpiresAt ? new Date(planExpiresAt).toLocaleDateString('es-VE', {
    day: 'numeric', month: 'long', year: 'numeric',
  }) : 'desconocida';

  const planLabel = PLAN_DURATION_LABELS[role] || 'de acceso';

  return (
    <div className="h-screen w-screen bg-[var(--bg-base)] flex items-center justify-center p-[24px]">
      <div className="max-w-[480px] w-full text-center flex flex-col items-center gap-[24px] animate-fade-in-up">
        <div className="w-[80px] h-[80px] rounded-[24px] bg-[var(--warning-bg)] border border-[var(--warning)]/30 flex items-center justify-center">
          <Clock size={40} className="text-[var(--warning)]" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-[var(--text-primary)]">Plan Vencido</h1>
          <p className="text-[15px] text-[var(--text-secondary)] mt-[8px] max-w-[360px] mx-auto">
            Tu período {planLabel} venció el <strong>{expiredDate}</strong>. Para continuar usando ArbiTrack debes renovar tu suscripción.
          </p>
        </div>
        <div className="w-full bg-[var(--warning-bg)] border border-[var(--warning)]/30 rounded-[14px] p-[20px] flex items-start gap-[14px] text-left">
          <AlertTriangle size={18} className="text-[var(--warning)] flex-shrink-0 mt-[1px]" />
          <div>
            <p className="text-[13px] font-semibold text-[var(--warning)]">Acceso suspendido</p>
            <p className="text-[12px] text-[var(--text-secondary)] mt-[4px]">
              Tus datos están seguros. Al renovar, recuperas acceso inmediato a todo tu historial de ciclos y órdenes.
            </p>
          </div>
        </div>
        <div className="w-full flex flex-col gap-[12px]">
          <a
            href="https://wa.me/584121176731?text=Hola,%20quiero%20renovar%20mi%20plan%20de%20ArbiTrack"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-[10px] py-[14px] bg-[var(--accent)] text-white font-bold text-[15px] rounded-[12px] hover:opacity-90 transition-all shadow-[0_4px_20px_var(--accent-muted)]"
          >
            <ArrowRight size={18} />
            Renovar suscripción →
          </a>
          <button
            onClick={onLogout}
            className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)]">ArbiTrack P2P © 2026</p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export const AppLayout: React.FC = () => {
  const { currentUser, binanceKeys, setOrders, setCycles, setActiveCycle, setBcvRate, logout } = useAppStore();
  const navigate = useNavigate();
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (!currentUser || !binanceKeys) {
      navigate('/login');
      return;
    }

    if (isPlanExpired(currentUser.planExpiresAt, currentUser.role)) return;

    if (!hasHydrated.current) {
      hasHydrated.current = true;
      (async () => {
        try {
          const [orders, cycles, activeCycle] = await Promise.all([
            getOrdersForUser(currentUser.id),
            getCyclesForUser(currentUser.id),
            getActiveCycleForUser(currentUser.id),
          ]);
          setOrders(orders);
          setCycles(cycles);
          setActiveCycle(activeCycle);
        } catch (err: any) {
          console.error('Error cargando históricos de Supabase:', err);
          toast.error('Error al sincronizar historial con la nube.', { id: 'hydration-err' });
        }
      })();
    }

    const updateBcv = () => {
      fetchBCVRate()
        .then(rate => setBcvRate(rate))
        .catch(err => console.error('Error cargando tasa BCV:', err));
    };

    updateBcv();
    const bcvInterval = setInterval(updateBcv, 10000);
    return () => clearInterval(bcvInterval);
  }, [currentUser, binanceKeys, navigate, setOrders, setCycles, setActiveCycle, setBcvRate]);

  if (!currentUser || !binanceKeys) return null;

  if (isPlanExpired(currentUser.planExpiresAt, currentUser.role)) {
    return (
      <ExpiredWall
        role={currentUser.role}
        planExpiresAt={currentUser.planExpiresAt}
        onLogout={async () => {
          await logout();
          navigate('/login');
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[var(--bg-base)] text-[var(--text-primary)]">

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* ── Main column ── */}
      <div className="flex-1 md:ml-[220px] flex flex-col w-full min-w-0 overflow-hidden">
        <Topbar />

        {/* Scrollable content area */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
          style={{
            /* Mobile: topbar is 56px. Desktop: 64px but we override in desktop‑only div below */
            paddingTop: '56px',
            /* Space for bottom nav on mobile */
            paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 8px))',
          }}
        >
          <div className="p-[14px] md:p-[32px] md:pt-[16px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <BottomNav />
    </div>
  );
};
