import React, { useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAppStore } from '../../store/useAppStore';
import { getOrdersForUser, getCyclesForUser, getActiveCycleForUser } from '../../services/dbOperations';
import { fetchBCVRate } from '../../services/bcv';

export const AppLayout: React.FC = () => {
  const { currentUser, binanceKeys, setOrders, setCycles, setActiveCycle, setBcvRate } = useAppStore();
  const navigate = useNavigate();
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (!currentUser || !binanceKeys) {
      navigate('/login');
      return;
    }
    
    if (!hasHydrated.current) {
      setOrders(getOrdersForUser(currentUser.id));
      setCycles(getCyclesForUser(currentUser.id));
      setActiveCycle(getActiveCycleForUser(currentUser.id));
      hasHydrated.current = true;
    }
    
    // BCV Rate Polling every 10 seconds
    const updateBcv = () => {
      fetchBCVRate().then(rate => {
        setBcvRate(rate);
      }).catch(err => console.error("Error cargando tasa BCV:", err));
    };

    updateBcv();
    const bcvInterval = setInterval(updateBcv, 10000);

    return () => clearInterval(bcvInterval);
  }, [currentUser, binanceKeys, navigate, setOrders, setCycles, setActiveCycle, setBcvRate]);

  if (!currentUser || !binanceKeys) return null;

  return (
    <div className="h-screen w-screen overflow-hidden flex text-[var(--text-primary)]">
      <Sidebar />
      <div className="flex-1 ml-[220px] flex flex-col">
        <Topbar />
        <main className="flex-1 mt-[64px] p-[32px] overflow-y-auto custom-scrollbar relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
