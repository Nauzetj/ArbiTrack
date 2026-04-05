import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { initDB } from './db/database';

import { Dashboard } from './pages/Dashboard';
import { Cycles } from './pages/Cycles';
import { Orders } from './pages/Orders';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { AdminPanel } from './pages/AdminPanel';

function App() {
  const [dbStatus, setDbStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    // Theme init
    const t = localStorage.getItem('theme') || 'light';
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

    initDB()
      .then(() => setDbStatus('ready'))
      .catch(e => {
        console.error("DB Init failed", e);
        setDbStatus('error');
      });
  }, []);

  if (dbStatus === 'loading') {
    return <div className="h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex items-center justify-center mono">Iniciando ArbiTrack SQLite...</div>;
  }

  if (dbStatus === 'error') {
    return <div className="h-screen bg-[var(--bg-base)] text-[var(--loss)] flex items-center justify-center mono">Error al cargar la base de datos local SQLite.</div>;
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
