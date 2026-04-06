import React, { useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAppStore } from '../../store/useAppStore';
import { getOrdersForUser, getCyclesForUser, getActiveCycleForUser } from '../../services/dbOperations';
import { fetchBCVRate } from '../../services/bcv';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';

// ── Plan expiry check ─────────────────────────────────────────────────────────
function isPlanExpired(planExpiresAt: string | null, role: string): boolean {
  if (role === 'admin' || role === 'free') return false; // admin y free nunca expiran
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
        {/* Icon */}
        <div className="w-[80px] h-[80px] rounded-[24px] bg-[var(--warning-bg)] border border-[var(--warning)]/30 flex items-center justify-center">
          <Clock size={40} className="text-[var(--warning)]" />
        </div>

        {/* Title */}
        <div>
          <h1 className="text-[28px] font-bold text-[var(--text-primary)]">Plan Vencido</h1>
          <p className="text-[15px] text-[var(--text-secondary)] mt-[8px] max-w-[360px] mx-auto">
            Tu período {planLabel} venció el <strong>{expiredDate}</strong>. Para continuar usando ArbiTrack debes renovar tu suscripción.
          </p>
        </div>

        {/* Warning box */}
        <div className="w-full bg-[var(--warning-bg)] border border-[var(--warning)]/30 rounded-[14px] p-[20px] flex items-start gap-[14px] text-left">
          <AlertTriangle size={18} className="text-[var(--warning)] flex-shrink-0 mt-[1px]" />
          <div>
            <p className="text-[13px] font-semibold text-[var(--warning)]">Acceso suspendido</p>
            <p className="text-[12px] text-[var(--text-secondary)] mt-[4px]">
              Tus datos están seguros. Al renovar, recuperas acceso inmediato a todo tu historial de ciclos y órdenes.
            </p>
          </div>
        </div>

        {/* CTA — contact admin */}
        <div className="w-full flex flex-col gap-[12px]">
          <a
            href="https://wa.me/584121176731?text=Hola,%20quiero%20renovar%20mi%20plan%20de%20ArbiTrack"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-[10px] py-[14px] bg-[var(--accent)] text-white font-bold text-[15px] rounded-[12px] hover:opacity-90 transition-all shadow-[0_4px_20px_var(--accent-muted)] hover:-translate-y-[1px]"
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
  const { currentUser, binanceKeys, setOrders, setCycles, setActiveCycle, setBcvRate, logout, isMobileMenuOpen, setMobileMenuOpen } = useAppStore();
  const navigate = useNavigate();
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (!currentUser || !binanceKeys) {
      navigate('/login');
      return;
    }

    // Si el plan está vencido, no cargamos datos (ahorramos queries)
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

    // BCV Rate Polling every 10 seconds
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

  // ── Plan vencido → mostrar pared de bloqueo ───────────────────────────────
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
    <div className="h-screen w-screen overflow-hidden flex text-[var(--text-primary)]">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Reemplacé mr-[220px] y relative para asegurar Sidebar responsivo */}
      <Sidebar />
      <div className="flex-1 md:ml-[220px] flex flex-col w-full">
        <Topbar />
        <main className="flex-1 mt-[64px] p-[16px] md:p-[32px] overflow-y-auto custom-scrollbar relative w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
