import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, ListOrdered, BarChart2, Settings, Shield } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const BottomNav: React.FC = () => {
  const { currentUser } = useAppStore();

  const isNauzetj = currentUser?.username === 'Nauzetj' || currentUser?.username?.toLowerCase() === 'henderrtj' || currentUser?.username === 'Admin';
  const isAdmin = isNauzetj || currentUser?.role === 'admin';

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Inicio' },
    { to: '/ciclos', icon: History, label: 'Ciclos' },
    { to: '/ordenes', icon: ListOrdered, label: 'Órdenes' },
    { to: '/reportes', icon: BarChart2, label: 'Reportes' },
    ...(isAdmin
      ? [{ to: '/admin', icon: Shield, label: 'Admin' }]
      : [{ to: '/configuracion', icon: Settings, label: 'Config.' }]
    ),
  ];

  return (
    <nav className="md:hidden fixed bottom-[16px] left-[16px] right-[16px] z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="bg-[var(--bg-surface-2)]/80 backdrop-blur-xl border border-[var(--border-strong)] rounded-full flex items-center justify-between px-[8px] py-[8px] shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-[4px] py-[6px] transition-all duration-200 relative ${
                isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`flex items-center justify-center w-[40px] h-[32px] rounded-full transition-all duration-200 ${
                    isActive
                      ? 'bg-[var(--accent)] text-white shadow-[0_4px_12px_var(--accent-muted)]'
                      : 'bg-transparent hover:bg-[var(--bg-surface-3)]'
                  }`}
                >
                  <Icon size={isActive ? 18 : 20} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span
                  className={`text-[10px] font-semibold tracking-tight transition-all ${
                    isActive ? 'opacity-100 text-[var(--accent)]' : 'opacity-60'
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
