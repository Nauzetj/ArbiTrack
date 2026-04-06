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
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: 'var(--bg-surface-1)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
      }}
    >
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-[4px] py-[10px] transition-all duration-200 relative ${
              isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  className="absolute top-0 left-[50%] -translate-x-1/2 w-[32px] h-[2px] rounded-b-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <div
                className={`flex items-center justify-center w-[40px] h-[28px] rounded-[10px] transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--accent-muted)]'
                    : 'bg-transparent'
                }`}
              >
                <Icon size={isActive ? 20 : 18} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span
                className={`text-[10px] font-semibold tracking-wide transition-all ${
                  isActive ? 'opacity-100' : 'opacity-60'
                }`}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};
