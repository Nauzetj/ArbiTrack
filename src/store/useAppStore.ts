import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { User, Order, Cycle, BCVRate } from '../types';
import type { Session } from '@supabase/supabase-js';

interface AppState {
  // Auth State (from Supabase)
  session: Session | null;
  currentUser: User | null;
  // NOTA DE SEGURIDAD: las API Keys de Binance se guardan en localStorage
  // y persisten al cerrar la pestaña. Se borran al hacer logout.
  // El riesgo residual es XSS — mitigar con una CSP estricta.
  binanceKeys: { apiKey: string; secretKey: string } | null;

  // Data State for current user
  orders: Order[];
  cycles: Cycle[];
  activeCycle: Cycle | null;
  bcvRate: BCVRate | null;

  // App UI State
  isSyncing: boolean;
  lastSyncTime: Date | null;
  theme: string;
  isMobileMenuOpen: boolean;

  // Actions
  setSession: (session: Session | null) => void;
  setCurrentUser: (user: User | null) => void;
  login: (user: User, session: Session, apiKey: string, secretKey: string) => void;
  logout: () => Promise<void>;

  setOrders: (orders: Order[]) => void;
  setCycles: (cycles: Cycle[]) => void;
  setActiveCycle: (cycle: Cycle | null) => void;
  setBcvRate: (rate: BCVRate | null) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  setLastSyncTime: (date: Date) => void;
  setTheme: (theme: string) => void;
  setMobileMenuOpen: (isOpen: boolean) => void;
}

const getInitialTheme = () => {
  // Guard: en SSR o tests puede no existir el DOM
  if (typeof document === 'undefined') return 'ocean';
  const t = localStorage.getItem('arbitrack_theme') || 'ocean';
  document.documentElement.setAttribute('data-theme', t);
  return t;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      session: null,
      currentUser: null,
      binanceKeys: null,
      orders: [],
      cycles: [],
      activeCycle: null,
      bcvRate: null,
      isSyncing: false,
      lastSyncTime: null,
      theme: getInitialTheme(),
      isMobileMenuOpen: false,

      setSession: (session) => set({ session }),
      setCurrentUser: (currentUser) => set({ currentUser }),

      login: (user, session, apiKey, secretKey) =>
        set({
          currentUser: user,
          session,
          binanceKeys: { apiKey, secretKey },
        }),

      logout: async () => {
        await supabase.auth.signOut();
        set({
          session: null,
          currentUser: null,
          binanceKeys: null,
          orders: [],
          cycles: [],
          activeCycle: null,
        });
      },

      setOrders: (orders) => set({ orders }),
      setCycles: (cycles) => set({ cycles }),
      setActiveCycle: (activeCycle) => set({ activeCycle }),
      setBcvRate: (bcvRate) => set({ bcvRate }),
      setIsSyncing: (isSyncing) => set({ isSyncing }),
      setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
      setTheme: (theme) => {
        localStorage.setItem('arbitrack_theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },
      setMobileMenuOpen: (isMobileMenuOpen) => set({ isMobileMenuOpen }),
    }),
    {
      name: 'arbitrack-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Las API keys de Binance se guardan en localStorage y persisten al cerrar la pestaña.
        // Se borran automáticamente al hacer logout (ver función logout más abajo).
        // El tema también persiste.
        binanceKeys: state.binanceKeys,
        theme: state.theme,
      }),
    }
  )
);
