import React, { useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, History, ListOrdered, BarChart2, Settings,
  LogOut, Activity, Shield, Moon, Sun,
} from 'lucide-react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAppStore } from '../../store/useAppStore';

const NAV_ITEMS = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard',     end: true  },
  { to: '/ciclos',        icon: History,         label: 'Ciclos',        end: false },
  { to: '/ordenes',       icon: ListOrdered,     label: 'Órdenes',       end: false },
  { to: '/reportes',      icon: BarChart2,       label: 'Reportes',      end: false },
  { to: '/configuracion', icon: Settings,        label: 'Configuración', end: false },
];

export const Sidebar: React.FC = () => {
  const { currentUser, logout, isMobileMenuOpen, setMobileMenuOpen } = useAppStore();
  const location   = useLocation();
  const sidebarRef = useRef<HTMLElement>(null);
  const logoRef    = useRef<HTMLDivElement>(null);
  const themeRef   = useRef<HTMLButtonElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const navRefs    = useRef<(HTMLAnchorElement | null)[]>([]);

  const [isDark, setIsDark] = React.useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
      document.documentElement.getAttribute('data-theme') === 'dark';
  });

  // ── Logo heartbeat ──────────────────────────────────────────────────────────
  useGSAP(() => {
    if (!logoRef.current) return;
    gsap.to(logoRef.current, {
      scale: 1.08,
      boxShadow: '0 0 18px rgba(37,99,235,0.45)',
      y: -3,
      duration: 1.6,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }, { scope: sidebarRef });

  // ── Sidebar entrance ───────────────────────────────────────────────────────
  useGSAP(() => {
    gsap.fromTo(sidebarRef.current,
      { x: -30, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.55, ease: 'power3.out', clearProps: 'all' }
    );
  }, {});

  // ── Logo hover ─────────────────────────────────────────────────────────────
  const handleLogoEnter = () => {
    if (!logoRef.current) return;
    gsap.to(logoRef.current, { rotate: 15, scale: 1.15, duration: 0.3, ease: 'back.out(2)' });
  };
  const handleLogoLeave = () => {
    if (!logoRef.current) return;
    gsap.to(logoRef.current, { rotate: 0, scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
  };

  // ── Sliding nav indicator ──────────────────────────────────────────────────
  const visibleItems = [
    ...NAV_ITEMS,
    ...(currentUser?.role === 'admin' ||
        currentUser?.username === 'Nauzetj' ||
        currentUser?.username?.toLowerCase() === 'henderrtj'
      ? [{ to: '/admin', icon: Shield, label: 'Admin', end: false }]
      : []),
  ];

  useEffect(() => {
    const idx = visibleItems.findIndex(item =>
      item.end
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to)
    );
    const el = navRefs.current[idx];
    if (!el || !indicatorRef.current) return;
    const rect = el.getBoundingClientRect();
    const parentRect = el.parentElement!.getBoundingClientRect();
    gsap.to(indicatorRef.current, {
      y: rect.top - parentRect.top,
      height: rect.height,
      opacity: 1,
      duration: 0.4,
      ease: 'power3.inOut',
    });
  }, [location.pathname, visibleItems.length]);

  // ── Theme toggle with spin ─────────────────────────────────────────────────
  const toggleTheme = () => {
    const newState = !isDark;
    const el = themeRef.current;
    if (el) {
      gsap.to(el, {
        rotate: newState ? 360 : -360,
        scale: 1.3,
        duration: 0.45,
        ease: 'back.out(1.7)',
        onComplete: () => { gsap.set(el, { rotate: 0, scale: 1 }); },
      });
    }
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
    // El store.logout() ya hace limpieza síncrona inmediata y redirige
    logout();
  };

  const isNauzetj = currentUser?.username === 'Nauzetj' ||
    currentUser?.username?.toLowerCase() === 'henderrtj' ||
    currentUser?.username === 'Admin';
  const isAdmin = isNauzetj || currentUser?.role === 'admin';

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

      <aside
        ref={sidebarRef}
        className={`w-[220px] h-screen fixed left-0 top-0 bg-[var(--bg-surface-1)] border-r border-[var(--border)] flex flex-col z-50 transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="h-[64px] flex items-center px-[24px] gap-[12px] flex-shrink-0">
          <div
            ref={logoRef}
            onMouseEnter={handleLogoEnter}
            onMouseLeave={handleLogoLeave}
            className="w-[32px] h-[32px] bg-[var(--accent)] rounded-[9px] flex items-center justify-center shadow-[0_4px_12px_var(--accent-muted)] cursor-pointer"
            style={{ willChange: 'transform' }}
          >
            <Activity size={18} color="#ffffff" />
          </div>
          <span className="font-bold text-[17px] tracking-tight">ArbiTrack</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-[16px] flex flex-col gap-[2px] px-[10px] relative">
          {/* Sliding background indicator */}
          <div
            ref={indicatorRef}
            className="absolute left-[10px] right-[10px] rounded-[10px] bg-[var(--accent-muted)] pointer-events-none opacity-0"
            style={{ top: 0, height: 40, willChange: 'transform, height' }}
          />

          {visibleItems.map((item, idx) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              ref={(el) => { navRefs.current[idx] = el; }}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                [
                  'flex items-center gap-[10px] px-[12px] py-[10px] rounded-[10px]',
                  'text-[13.5px] font-medium relative z-10 transition-colors duration-200',
                  isActive
                    ? 'text-[var(--accent)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {/* Left accent bar for active item */}
                  {isActive && (
                    <div className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full bg-[var(--accent)]" />
                  )}
                </>
              )}
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
                <div className="w-[7px] h-[7px] rounded-full bg-[var(--profit)]" title="Online" />
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
                ref={themeRef}
                onClick={toggleTheme}
                className="p-[5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--bg-surface-3)] rounded-full transition-colors"
                title={isDark ? 'Modo claro' : 'Modo oscuro'}
                style={{ willChange: 'transform' }}
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
