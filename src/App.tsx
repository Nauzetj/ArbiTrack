import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { supabase } from './lib/supabase';
import { useAppStore } from './store/useAppStore';
import { getUserProfile } from './services/dbOperations';

// Dashboard carga eagerly (es la primera pantalla post-login)
import { Dashboard } from './pages/Dashboard';

// Páginas pesadas → lazy (solo se descargan cuando se navega a ellas)
const Cycles     = lazy(() => import('./pages/Cycles').then(m => ({ default: m.Cycles })));
const Orders     = lazy(() => import('./pages/Orders').then(m => ({ default: m.Orders })));
const Reports    = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Settings   = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const AdminPanel = lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })));

import type { Session } from '@supabase/supabase-js';

/** Spinner reutilizable para Suspense fallback */
const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center h-full">
    <div className="w-[32px] h-[32px] border-[3px] border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Construye un perfil de fallback a partir de los metadatos de sesión */
function buildFallbackProfile(session: Session) {
  return {
    id: session.user.id,
    username:
      session.user.user_metadata?.username ||
      session.user.email?.split('@')[0] ||
      'Usuario',
    fullName:
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      '',
    // CORRECCIÓN: eliminado passwordHash del tipo User (siempre era '')
    createdAt: new Date().toISOString(),
    role: 'free' as const,
    planExpiresAt: null,
  };
}

// ── CORRECCIÓN: Guard de ruta para admin ─────────────────────────────────────
// Antes el panel de admin era accesible por URL directa a cualquier usuario
// autenticado — el componente AdminPanel solo protegía visualmente.
// Ahora la ruta rechaza en el router antes de cargar el componente.
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [authStatus, setAuthStatus] = useState<'loading' | 'ready'>('loading');
  const [showRecoveryBtn, setShowRecoveryBtn] = useState(false);
  const { setSession, setCurrentUser } = useAppStore();

  // Usamos ref para evitar duplicados desde onAuthStateChange durante montura inicial
  const initialSessionHandled = useRef(false);

  useEffect(() => {
    // Tema inicial
    const t = localStorage.getItem('arbitrack_theme') || 'ocean';
    document.documentElement.setAttribute('data-theme', t);

    // Botón de recuperación visible a los 2s si la app cuelga
    const recoveryUiTid = setTimeout(() => setShowRecoveryBtn(true), 2000);

    // Timeout de rescate: si en 7s la app no arrancó, borra caché PWA
    const rescueTimeout = setTimeout(() => {
      // Solo actúa si todavía estamos en "loading"
      console.warn('Auth completamente colgado. Limpiando caché PWA...');
      let needsReload = false;

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then(regs => {
            for (const reg of regs) {
              reg.unregister();
              needsReload = true;
            }
            if (needsReload) window.location.reload();
          })
          .catch(() => {});
      }

      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sb-') || k.includes('workbox')) {
          localStorage.removeItem(k);
          needsReload = true;
        }
      });

      if (!needsReload) {
        // No había caché que limpiar, simplemente desbloquear la UI
        setAuthStatus('ready');
      }
    }, 7000);

    /** Carga el perfil de Supabase, con fallback si no existe */
    const loadProfile = async (session: Session) => {
      try {
        let profile = await getUserProfile(session.user.id);
        if (!profile) profile = buildFallbackProfile(session);
        setCurrentUser(profile);
      } catch (err) {
        console.error('Error cargando perfil:', err);
        // Fallback para que la app no se quede bloqueada
        setCurrentUser(buildFallbackProfile(session));
      }
    };

    // Sesión inicial (source-of-truth al arrancar)
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        clearTimeout(rescueTimeout);
        clearTimeout(recoveryUiTid);
        initialSessionHandled.current = true;

        if (session) {
          setSession(session);
          await loadProfile(session);
        }
        setAuthStatus('ready');
      })
      .catch(fatalErr => {
        clearTimeout(rescueTimeout);
        clearTimeout(recoveryUiTid);
        console.error('Fallo masivo de Auth:', fatalErr);
        setAuthStatus('ready');
      });

    // Cambios de sesión posteriores (login, logout, refresh de token)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Ignorar el primer disparo duplicado con la sesión inicial
      if (!initialSessionHandled.current) return;

      setSession(session);
      if (session) {
        await loadProfile(session);
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      clearTimeout(rescueTimeout);
      clearTimeout(recoveryUiTid);
      subscription.unsubscribe();
    };
  }, []);

  if (authStatus === 'loading') {
    return (
      <div className="h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col items-center justify-center relative">
        <div className="flex flex-col items-center gap-[16px]">
          <div className="w-[40px] h-[40px] border-[3px] border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[14px] text-[var(--text-secondary)]">Iniciando ArbiTrack...</span>
        </div>

        {showRecoveryBtn && (
          <div className="absolute bottom-[40px] animate-fade-in-up text-center px-4">
            <p className="text-[12px] text-[var(--text-tertiary)] mb-2">¿Problemas al cargar en escritorio o móvil?</p>
            <button
              onClick={() => {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker
                    .getRegistrations()
                    .then(rs => rs.forEach(r => r.unregister()));
                }
                localStorage.clear();
                window.location.reload();
              }}
              className="px-[16px] py-[8px] bg-[var(--loss-bg)] text-[var(--loss)] rounded-[8px] text-[13px] font-bold shadow-sm"
            >
              Forzar Limpieza y Reiniciar
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          {/* Rutas lazy — se cargan bajo demanda */}
          <Route path="/ciclos"        element={<Suspense fallback={<PageLoader />}><Cycles /></Suspense>} />
          <Route path="/ordenes"       element={<Suspense fallback={<PageLoader />}><Orders /></Suspense>} />
          <Route path="/reportes"      element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
          <Route path="/configuracion" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
          {/* CORRECCIÓN: ruta /admin protegida por AdminRoute — antes era accesible
              para cualquier usuario autenticado por URL directa */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Suspense fallback={<PageLoader />}><AdminPanel /></Suspense>
              </AdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
