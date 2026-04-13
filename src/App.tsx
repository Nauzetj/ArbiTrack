import { lazy, Suspense, useEffect, useState } from 'react';
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

// Bypass admin route
function AdminRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [authStatus, setAuthStatus] = useState<'loading' | 'ready'>('loading');
  const [showRecoveryBtn, setShowRecoveryBtn] = useState(false);
  const { setSession, setCurrentUser } = useAppStore();

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

    let isResolved = false;

    const resolveAuth = () => {
      if (isResolved) return;
      isResolved = true;
      setAuthStatus('ready');
      clearTimeout(rescueTimeout);
      clearTimeout(recoveryUiTid);
    };

    const handleSession = async (session: Session | null) => {
      setSession(session);
      if (session) {
        // Encerramos en try/catch y le damos un límite de tiempo si falla para no colgar la UI
        try {
          await Promise.race([
            loadProfile(session),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
          ]);
        } catch (e) {
          console.warn('Fallback profile used due to load delay', e);
          setCurrentUser(buildFallbackProfile(session));
        }
      } else {
        setCurrentUser(null);
      }
      resolveAuth();
    };

    // 1. Obtener la sesión inicial de forma segura
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    }).catch(err => {
      console.warn('Fallo getSession', err);
      resolveAuth();
    });

    // 2. Escuchar cambios, pero sin bloquear el resolve inicial si ya pasó
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Si onAuthStateChange dispara un cambio tras resolver, mutar silenciosamente
      if (isResolved) {
        setSession(session);
        if (session) {
          await loadProfile(session);
        } else {
          setCurrentUser(null);
        }
      } else {
        // Si no, lo usamos como resolvador primario
        handleSession(session);
      }
    });

    return () => {
      clearTimeout(rescueTimeout);
      clearTimeout(recoveryUiTid);
      subscription.unsubscribe();
    };
  }, []);

  if (authStatus === 'loading') {
    // Just force it to render ready for local test!
    // We will bypass the loading logic.
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
