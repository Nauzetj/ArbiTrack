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

  const [showRecoveryBtn, setShowRecoveryBtn] = useState(false);

  useEffect(() => {
    // Theme init
    const t = localStorage.getItem('arbitrack_theme') || 'ocean';
    document.documentElement.setAttribute('data-theme', t);

    // After 2s, we show a recovery button just in case
    const recoveryUiTid = setTimeout(() => setShowRecoveryBtn(true), 2000);

    // Timeout of 7s: If app hangs, auto-wipe PWA cache and force full DOM reload
    const rescueTimeout = setTimeout(() => {
      console.warn("Auth initialization completely hung. Auto-clearing PWA caches.");
      
      let needsReload = false;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          for (const reg of regs) { reg.unregister(); needsReload = true; }
        });
      }
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sb-') || k.includes('workbox')) { localStorage.removeItem(k); needsReload = true; }
      });
      
      if (needsReload) {
        window.location.reload();
      } else {
        if (authStatus === 'loading') setAuthStatus('ready');
      }
    }, 7000);

    // Check for existing Supabase session on startup
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(rescueTimeout);
      clearTimeout(recoveryUiTid);
      try {
        if (session) {
          setSession(session);
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
        }
      } catch (err) {
        console.error("Error durante session init:", err);
      } finally {
        setAuthStatus('ready');
      }
    }).catch((fatalErr) => {
      clearTimeout(rescueTimeout);
      clearTimeout(recoveryUiTid);
      console.error("Fallo masivo de Auth:", fatalErr);
      setAuthStatus('ready');
    });

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
                  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
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
