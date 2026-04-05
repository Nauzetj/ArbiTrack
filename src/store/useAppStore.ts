import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Order, Cycle, BCVRate } from '../types';

interface AppState {
  // Ephemeral Auth State
  currentUser: User | null;
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

  // Computed state conceptually
  // unassignedOrders = orders.filter(o => !o.cycleId)

  // Actions
  login: (user: User, apiKey: string, secretKey: string) => void;
  logout: () => void;
  
  setOrders: (orders: Order[]) => void;
  setCycles: (cycles: Cycle[]) => void;
  setActiveCycle: (cycle: Cycle | null) => void;
  setBcvRate: (rate: BCVRate | null) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  setLastSyncTime: (date: Date) => void;
  setTheme: (theme: string) => void;
}

const getInitialTheme = () => {
  const t = localStorage.getItem('arbitrack_theme') || 'ocean';
  document.documentElement.setAttribute('data-theme', t);
  return t;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
  binanceKeys: null,
  orders: [],
  cycles: [],
  activeCycle: null,
  bcvRate: null,
  isSyncing: false,
  lastSyncTime: null,
  theme: getInitialTheme(),

  login: (user, apiKey, secretKey) => set({ 
    currentUser: user, 
    binanceKeys: { apiKey, secretKey } 
  }),
  
  logout: () => set({ 
    currentUser: null, 
    binanceKeys: null,     // NEVER SAVED TO DISK
    orders: [],
    cycles: [],
    activeCycle: null
  }),

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
    }),
    {
      name: 'arbitrack-session',
      partialize: (state) => ({
        currentUser: state.currentUser,
        binanceKeys: state.binanceKeys
      })
    }
  )
);
