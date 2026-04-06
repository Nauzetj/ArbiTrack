import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, History, ListOrdered, BarChart2, Settings, LogOut, Activity, Shield, Moon, Sun } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const Sidebar: React.FC = () => {
  const { currentUser, logout, isMobileMenuOpen, setMobileMenuOpen } = useAppStore();
  const navigate = useNavigate();

  const [isDark, setIsDark] = React.useState(() => {
    return localStorage.getItem('theme') === 'dark' || document.documentElement.getAttribute('data-theme') === 'dark';
  });

  const toggleTheme = () => {
    const newState = !isDark;
    setIsDark(newState);
    if (newState) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isNauzetj = currentUser?.username === 'Nauzetj' || currentUser?.username?.toLowerCase() === 'henderrtj' || currentUser?.username === 'Admin';
  const isAdmin = isNauzetj || currentUser?.role === 'admin';

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/ciclos', icon: <History size={20} />, label: 'Ciclos' },
    { to: '/ordenes', icon: <ListOrdered size={20} />, label: 'Órdenes' },
    { to: '/reportes', icon: <BarChart2 size={20} />, label: 'Reportes' },
    { to: '/configuracion', icon: <Settings size={20} />, label: 'Configuración' },
    ...(isAdmin ? [{ to: '/admin', icon: <Shield size={20} />, label: 'Admin' }] : []),
  ];

  return (
    <aside className={`w-[220px] h-screen fixed left-0 top-0 bg-[var(--bg-surface-1)] border-r border-[var(--border)] flex flex-col z-50 transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Logo */}
      <div className="h-[64px] flex items-center px-[24px] gap-[12px] flex-shrink-0">
        <div className="w-[32px] h-[32px] bg-[var(--accent)] rounded-[8px] flex items-center justify-center">
          <Activity size={20} color="#020B16" />
        </div>
        <span className="font-bold text-[18px] tracking-tight">ArbiTrack</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-[24px] flex flex-col gap-[8px]">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => 
              `flex items-center gap-[12px] px-[24px] py-[12px] transition-all duration-150 ${
                isActive 
                  ? 'bg-[var(--accent-muted)] border-l-2 border-[var(--accent)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] border-l-2 border-transparent hover:bg-surface-3 hover:text-[var(--text-primary)]'
              }`
            }
          >
            {item.icon}
            <span className="font-medium text-[14px]">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Card */}
      <div className="p-[20px] border-t border-[var(--border)]">
        <div className="bg-surface-2 rounded-[12px] p-[16px] flex flex-col gap-[12px]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[14px] truncate">{isNauzetj ? 'Nauzetj' : (currentUser?.username || 'Usuario')}</span>
            <div className="flex items-center gap-[6px]">
              {isAdmin && (
                <span className="text-[9px] font-bold text-[#020B16] bg-[var(--accent)] px-[5px] py-[1px] rounded-full uppercase">ADMIN</span>
              )}
              <div className="w-[8px] h-[8px] rounded-full bg-[var(--accent)] animate-pulse-green flex-shrink-0" title="API Binance protegida en memoria"></div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-[4px]">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-[6px] text-[12px] text-tertiary hover:text-[var(--loss)] transition-colors"
            >
              <LogOut size={14} />
              Salir
            </button>
            <button
              onClick={toggleTheme}
              className="p-[6px] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--bg-surface-3)] rounded-full transition-colors"
              title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
