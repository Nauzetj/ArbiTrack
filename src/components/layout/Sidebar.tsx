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
    { to: '/',             icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/ciclos',       icon: <History size={18} />,         label: 'Ciclos' },
    { to: '/ordenes',      icon: <ListOrdered size={18} />,     label: 'Órdenes' },
    { to: '/reportes',     icon: <BarChart2 size={18} />,       label: 'Reportes' },
    { to: '/configuracion',icon: <Settings size={18} />,        label: 'Configuración' },
    ...(isAdmin ? [{ to: '/admin', icon: <Shield size={18} />,  label: 'Admin' }] : []),
  ];

  const userInitial = (currentUser?.username || 'U')[0].toUpperCase();

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`w-[220px] h-screen fixed left-0 top-0 bg-[var(--bg-surface-1)] border-r border-[var(--border)] flex flex-col z-50 transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Logo */}
        <div className="h-[64px] flex items-center px-[24px] gap-[12px] flex-shrink-0">
          <div className="w-[32px] h-[32px] bg-[var(--accent)] rounded-[9px] flex items-center justify-center shadow-[0_4px_12px_var(--accent-muted)] animate-float-y">
            <Activity size={18} color="#ffffff" />
          </div>
          <span className="font-bold text-[17px] tracking-tight">ArbiTrack</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-[16px] flex flex-col gap-[2px] px-[10px]">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                [
                  'flex items-center gap-[10px] px-[12px] py-[10px] rounded-[10px]',
                  'transition-all duration-200 text-[13.5px] font-medium relative',
                  'hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]',
                  isActive
                    ? 'bg-[var(--accent-muted)] text-[var(--accent)] font-semibold border-l-[3px] border-[var(--accent)] pl-[9px]'
                    : 'text-[var(--text-secondary)] border-l-[3px] border-transparent',
                ].join(' ')
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Card */}
        <div className="p-[16px] border-t border-[var(--border)] flex-shrink-0">
          <div className="bg-[var(--bg-surface-2)] rounded-[12px] p-[14px] flex flex-col gap-[10px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[8px] min-w-0">
                <div className="w-[28px] h-[28px] rounded-full bg-[var(--accent-muted)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-[var(--accent)]">{userInitial}</span>
                </div>
                <span className="font-semibold text-[13px] truncate">
                  {isNauzetj ? 'Nauzetj' : (currentUser?.username || 'Usuario')}
                </span>
              </div>
              <div className="flex items-center gap-[4px] flex-shrink-0">
                {isAdmin && (
                  <span className="text-[9px] font-bold text-white bg-[var(--accent)] px-[5px] py-[1px] rounded-full uppercase">ADM</span>
                )}
                <div className="w-[7px] h-[7px] rounded-full bg-[var(--profit)] animate-pulse-green" title="Online" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={handleLogout}
                className="flex items-center gap-[5px] text-[11px] text-[var(--text-tertiary)] hover:text-[var(--loss)] transition-colors"
              >
                <LogOut size={12} />
                Salir
              </button>
              <button
                onClick={toggleTheme}
                className="p-[5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--bg-surface-3)] rounded-full transition-all hover:rotate-[30deg]"
                title={isDark ? 'Modo claro' : 'Modo oscuro'}
              >
                {isDark ? <Sun size={13} /> : <Moon size={13} />}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
