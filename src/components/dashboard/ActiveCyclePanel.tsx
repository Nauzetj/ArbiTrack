import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { saveCycle } from '../../services/dbOperations';
import { generateUUID } from '../../crypto/auth';
import type { Cycle } from '../../types';

export const ActiveCyclePanel: React.FC = () => {
  const { activeCycle, setActiveCycle, currentUser, bcvRate, cycles, setCycles } = useAppStore();

  const handleOpenCycle = () => {
    if (!currentUser) return;
    const newCycle: Cycle = {
      id: generateUUID(),
      cycleNumber: Date.now(), 
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
      tasa_bcv_dia: 0,
      notas: '',
      userId: currentUser.id
    };
    saveCycle(newCycle);
    setActiveCycle(newCycle);
    setCycles([newCycle, ...cycles]);
  };

  const handleCloseCycle = () => {
    if (!activeCycle || !currentUser) return;
    const closedCycle = { 
      ...activeCycle, 
      status: 'Completado' as const, 
      closedAt: new Date().toISOString(),
      tasa_bcv_dia: bcvRate ? bcvRate.tasa_bcv : activeCycle.tasa_bcv_dia
    };
    saveCycle(closedCycle);
    setActiveCycle(null);
    // Reflect closed status in the cycles[] list immediately
    setCycles(cycles.map(c => c.id === closedCycle.id ? closedCycle : c));
  };

  if (!activeCycle) {
    return (
      <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[32px] flex flex-col items-center justify-center gap-[20px] h-full shadow-sm animate-fade-in-up">
        <div className="w-[64px] h-[64px] rounded-full border border-[var(--border-strong)] flex items-center justify-center text-[var(--accent)] bg-[var(--accent-muted)]">
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
    <div className="bg-[var(--bg-surface-2)] rounded-[16px] border-t-2 border-[var(--accent)] border-x border-b border-x-[var(--border)] border-b-[var(--border)] p-[24px] flex flex-col gap-[24px] h-full shadow-[0_0_20px_rgba(0,229,195,0.06)] animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-[18px]">Ciclo #{activeCycle.cycleNumber.toString().slice(-4)}</h2>
        <Badge variant="accent">EN CURSO</Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] gap-y-[24px]">
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">USDT Vendido</span>
          <span className="mono text-[18px] font-medium">{activeCycle.usdt_vendido.toFixed(2)}</span>
        </div>
        <div className="flex flex-col pl-[16px] border-l border-[var(--border-strong)]">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">USDT Recomprado</span>
          <span className="mono text-[18px] font-medium">{activeCycle.usdt_recomprado.toFixed(2)}</span>
        </div>
        <div className="flex flex-col lg:pl-[16px] lg:border-l border-[var(--border-strong)]">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">Liquidez Neta (Bs.)</span>
          <span className={`mono text-[18px] font-medium ${liquidezVES < 0 ? 'text-loss' : 'text-[var(--text-primary)]'}`}>
            {liquidezVES.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col pl-[16px] border-l border-[var(--border-strong)]">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold tracking-[1.2px] mb-[4px]">Ganancia Parcial</span>
          <span className={`mono text-[18px] font-medium ${isLoss ? 'text-loss' : 'text-profit'}`}>
            {resParcial > 0 ? '+' : ''}{resParcial.toFixed(2)} USDT
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
          Abierto a las {new Date(activeCycle.openedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </span>
        <div className="flex gap-[12px]">
          <Button variant="danger" onClick={handleCloseCycle} disabled={activeCycle.usdt_vendido === 0 || activeCycle.usdt_recomprado === 0}>
            Cerrar Ciclo
          </Button>
        </div>
      </div>
    </div>
  );
};
