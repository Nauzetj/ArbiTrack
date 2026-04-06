import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { supabase } from './lib/supabase';
import { useAppStore } from './store/useAppStore';
import { getUserProfile } from './services/dbOperations';

import { Dashboard } from './pages/Dashboard';
import { Cycles } from './pages/Cycles';
import { Orders } from './pages/Orders';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { AdminPanel } from './pages/AdminPanel';

function App() {
  const [authStatus, setAuthStatus] = useState<'loading' | 'ready'>('loading');
  const { setSession, setCurrentUser } = useAppStore();

  useEffect(() => {
    // Theme init
    const t = localStorage.getItem('arbitrack_theme') || 'ocean';
    document.documentElement.setAttribute('data-theme', t);

    // Check for existing Supabase session on startup
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        if (session) {
          setSession(session);
          let profile = await getUserProfile(session.user.id);
          if (!profile) {
            // Nuevo usuario vía OAuth (Google) — perfil aún no creado por trigger
            // Se guarda como 'free'; el admin puede elevar su rol desde el panel
            profile = {
              id: session.user.id,
              username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Usuario',
              fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
              passwordHash: '',
              createdAt: new Date().toISOString(),
              role: 'free',
              planExpiresAt: null,
            };
          }
          setCurrentUser(profile);
        }
      } catch (err) {
        console.error("Error durante session init:", err);
      } finally {
        setAuthStatus('ready');
      }
    }).catch((fatalErr) => {
      console.error("Fallo masivo de Auth:", fatalErr);
      setAuthStatus('ready');
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        try {
          let profile = await getUserProfile(session.user.id);
          if (!profile) {
            profile = {
              id: session.user.id,
              username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Usuario',
              fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
              passwordHash: '',
              createdAt: new Date().toISOString(),
              role: 'free',
              planExpiresAt: null,
            };
          }
          setCurrentUser(profile);
        } catch (err) {
          console.error("Error on auth state change:", err);
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authStatus === 'loading') {
    return (
      <div className="h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-[16px]">
          <div className="w-[40px] h-[40px] border-[3px] border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[14px] text-[var(--text-secondary)]">Iniciando ArbiTrack...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ciclos" element={<Cycles />} />
          <Route path="/ordenes" element={<Orders />} />
          <Route path="/reportes" element={<Reports />} />
          <Route path="/configuracion" element={<Settings />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
