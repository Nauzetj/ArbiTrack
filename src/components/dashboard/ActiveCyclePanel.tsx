import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { useAppStore } from '../../store/useAppStore';
import { saveCycle, deleteCycle } from '../../services/dbOperations';
import toast from 'react-hot-toast';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { generateUUID } from '../../crypto/auth';
import type { Cycle } from '../../types';

export const ActiveCyclePanel: React.FC = () => {
  const { activeCycle, setActiveCycle, currentUser, bcvRate, cycles, setCycles } = useAppStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!activeCycle) {
      gsap.to('.pulse-icon', {
        scale: 1.05,
        boxShadow: '0 0 20px rgba(0, 229, 195, 0.4)',
        y: -5,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    } else {
      gsap.fromTo('.cycle-stat-group', 
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power3.out', clearProps: 'all' }
      );
    }
  }, { dependencies: [activeCycle?.id], scope: panelRef });

  const handleOpenCycle = async () => {
    if (!currentUser) return;
    try {
      // Evitar integer overflow en bd: recortamos a 9 dígitos para garantizar < 2,147,483,647 (max int postgres)
      const safeCycleNumber = Number(Date.now().toString().slice(-9));
      
      const newCycle: Cycle = {
        id: generateUUID(),
        cycleNumber: safeCycleNumber, 
        openedAt: new Date().toISOString(),
        closedAt: null,
        status: 'En curso',
        usdt_vendido: 0,
        usdt_recomprado: 0,
        ves_recibido: 0,
        ves_pagado: 0,
        comision_total: 0,
        ganancia_usdt: 0,
        ganancia_ves: 0,
        tasa_venta_prom: 0,
        tasa_compra_prom: 0,
        diferencial_tasa: 0,
        roi_percent: 0,
        tasa_bcv_dia: bcvRate ? bcvRate.tasa_bcv : 0,
        notas: '',
        userId: currentUser.id
      };
      const savePromise = saveCycle(newCycle);
      
      toast.promise(savePromise, {
        loading: 'Abriendo nuevo ciclo...',
        success: '¡Ciclo iniciado exitosamente!',
        error: (err) => `Error: ${err.message || 'No se pudo abrir el ciclo'}`
      });

      await savePromise;
      setActiveCycle(newCycle);
      setCycles([newCycle, ...cycles]);
    } catch (err: any) {
      console.error('Error opening cycle:', err);
    }
  };

  const handleCloseCycle = async () => {
    if (!activeCycle || !currentUser) return;
    try {
      const closedCycle = { 
        ...activeCycle, 
        status: 'Completado' as const, 
        closedAt: new Date().toISOString(),
        tasa_bcv_dia: bcvRate ? bcvRate.tasa_bcv : activeCycle.tasa_bcv_dia
      };
      await saveCycle(closedCycle);
      setActiveCycle(null);
      // Reflect closed status in the cycles[] list immediately
      setCycles(cycles.map(c => c.id === closedCycle.id ? closedCycle : c));
    } catch (err: any) {
      console.error('Error closing cycle:', err);
      toast.error('Error al cerrar ciclo: ' + err.message);
    }
  };

  const handleDeleteCycle = async () => {
    if (!activeCycle || !currentUser) return;
    if (!confirm('¿Estás seguro de que quieres eliminar este ciclo? Esta acción no se puede deshacer.')) return;
    try {
      await deleteCycle(activeCycle.id, currentUser.id);
      setActiveCycle(null);
      setCycles(cycles.filter(c => c.id !== activeCycle.id));
      toast.success('Ciclo eliminado');
    } catch (err: any) {
      console.error('Error deleting cycle:', err);
      toast.error('Error al eliminar ciclo: ' + err.message);
    }
  };

  if (!activeCycle) {
    return (
      <div ref={panelRef} className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[32px] flex flex-col items-center justify-center gap-[20px] h-full shadow-sm relative overflow-hidden transition-all hover:border-[var(--accent-muted)]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="pulse-icon w-[64px] h-[64px] rounded-full border border-[var(--border-strong)] flex items-center justify-center text-[var(--accent)] bg-[var(--accent-muted)] relative z-10 transition-colors hover:bg-[var(--accent)] hover:text-[#020B16]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" y1="5" x2="22" y2="5"/><line x1="19" y1="2" x2="19" y2="8"/></svg>
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-[16px] mb-[4px] text-[var(--text-primary)]">No hay ciclos en curso</h3>
          <p className="text-[var(--text-secondary)] text-[13px] max-w-[280px]">Inicia un nuevo ciclo para comenzar a agrupar tus órdenes de venta y recompra.</p>
        </div>
        <Button onClick={handleOpenCycle} className="mt-[8px] text-[15px] px-[24px] py-[12px]">
          + Abrir nuevo ciclo
        </Button>
      </div>
    );
  }

  const resParcial = activeCycle.ganancia_usdt;
  const isLoss = resParcial < 0;
  
  const liquidezVES = activeCycle.ves_recibido - activeCycle.ves_pagado;

  const percentComplete = activeCycle.usdt_vendido > 0 ? Math.min((activeCycle.usdt_recomprado / activeCycle.usdt_vendido) * 100, 100) : 0;

  return (
    <div ref={panelRef} className="bg-[var(--bg-surface-2)] rounded-[16px] border-t-2 border-[var(--accent)] border-x border-b border-x-[var(--border)] border-b-[var(--border)] p-[24px] flex flex-col gap-[24px] h-full shadow-[0_0_20px_rgba(0,229,195,0.06)] relative overflow-hidden transition-colors hover:border-[var(--accent-border)]">
      <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="flex items-center justify-between relative z-10">
        <h2 className="font-bold text-[18px]">Ciclo #{activeCycle.cycleNumber.toString().slice(-4)}</h2>
        <Badge variant="accent">EN CURSO</Badge>
      </div>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] gap-y-[24px] relative z-10">
        <div className="flex flex-col cycle-stat-group">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">USDT Vendido</span>
          <span className="mono text-[18px] font-medium">{activeCycle.usdt_vendido.toFixed(2)}</span>
        </div>
        
        <div className="flex flex-col cycle-stat-group">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">USDT Recomprado</span>
          <span className="mono text-[18px] font-medium">{activeCycle.usdt_recomprado.toFixed(2)}</span>
        </div>

        <div className="flex flex-col cycle-stat-group">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">Liquidez Neta</span>
          <span className={`mono text-[18px] font-medium ${liquidezVES < 0 ? 'text-loss' : 'text-[var(--text-primary)]'}`}>
            {liquidezVES.toFixed(2)}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] mt-[2px]">Bolívares (VES)</span>
        </div>

        <div className="flex flex-col cycle-stat-group">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">Resultado Parcial</span>
          <span className={`mono text-[18px] font-medium ${isLoss ? 'text-loss' : 'text-profit'}`}>
            {resParcial > 0 ? '+' : ''}<span>{resParcial.toFixed(2)}</span> USDT
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-[8px] mt-[8px]">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-[var(--text-secondary)]">Progreso estimado de recompra</span>
          <span className="mono">{percentComplete.toFixed(0)}%</span>
        </div>
        <div className="w-full h-[6px] bg-[var(--bg-surface-4)] rounded-full relative overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--accent-muted)] to-[var(--accent)] transition-all duration-500 rounded-full"
            style={{ width: `${percentComplete}%` }}
          />
          {percentComplete > 0 && percentComplete < 100 && (
            <div className="animate-shimmer" />
          )}
        </div>
        <div className="text-[11px] text-[var(--text-secondary)] mt-[4px]">
          {percentComplete < 100 
            ? `Faltan ~${Math.max(0, activeCycle.usdt_vendido - activeCycle.usdt_recomprado).toFixed(2)} USDT por recomprar para cerrar neutro.`
            : 'Recompra cubierta. Verifica los diferenciales.'}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-[16px] border-t border-[var(--border-strong)]">
        <span className="text-[12px] text-[var(--text-secondary)]">
          Abierto el {new Date(activeCycle.openedAt).toLocaleDateString()} a las {new Date(activeCycle.openedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </span>
        <div className="flex gap-[12px]">
          <Button variant="danger" onClick={handleDeleteCycle}>
            Eliminar Ciclo
          </Button>
          <Button variant="danger" onClick={handleCloseCycle} disabled={activeCycle.usdt_vendido === 0 || activeCycle.usdt_recomprado === 0}>
            Cerrar Ciclo
          </Button>
        </div>
      </div>
    </div>
  );
};
