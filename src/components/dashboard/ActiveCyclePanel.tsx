import React, { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { useAppStore } from '../../store/useAppStore';
import { saveCycle, deleteCycle } from '../../services/dbOperations';
import toast from 'react-hot-toast';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { generateUUID } from '../../crypto/auth';
import type { Cycle } from '../../types';

export const ActiveCyclePanel: React.FC = () => {
  const { activeCycle, setActiveCycle, currentUser, bcvRate, cycles, setCycles } = useAppStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
    setIsProcessing(true);
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

      await saveCycle(newCycle);
      setActiveCycle(newCycle);
      setCycles([newCycle, ...cycles]);
      setShowOpenModal(false);
      toast.success('¡Ciclo iniciado exitosamente!');
    } catch (err: any) {
      console.error('Error opening cycle:', err);
      toast.error(`Error: ${err.message || 'No se pudo abrir el ciclo'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseCycle = async () => {
    if (!activeCycle || !currentUser) return;
    setIsProcessing(true);
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
      setShowCloseModal(false);
      toast.success('Ciclo cerrado correctamente.');
    } catch (err: any) {
      console.error('Error closing cycle:', err);
      toast.error('Error al cerrar ciclo: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCycle = async () => {
    if (!activeCycle || !currentUser) return;
    setIsProcessing(true);
    try {
      await deleteCycle(activeCycle.id, currentUser.id);
      setActiveCycle(null);
      setCycles(cycles.filter(c => c.id !== activeCycle.id));
      setShowDeleteModal(false);
      toast.success('Ciclo eliminado');
    } catch (err: any) {
      console.error('Error deleting cycle:', err);
      toast.error('Error al eliminar ciclo: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!activeCycle) {
    return (
      <>
        <div ref={panelRef} className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[32px] flex flex-col items-center justify-center gap-[20px] h-full shadow-sm relative overflow-hidden transition-all hover:border-[var(--accent-muted)]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="pulse-icon w-[64px] h-[64px] rounded-full border border-[var(--border-strong)] flex items-center justify-center text-[var(--accent)] bg-[var(--accent-muted)] relative z-10 transition-colors hover:bg-[var(--accent)] hover:text-[#020B16]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" y1="5" x2="22" y2="5"/><line x1="19" y1="2" x2="19" y2="8"/></svg>
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-[16px] mb-[4px] text-[var(--text-primary)]">No hay ciclos en curso</h3>
            <p className="text-[var(--text-secondary)] text-[13px] max-w-[280px]">Inicia un nuevo ciclo para comenzar a agrupar tus órdenes de venta y recompra.</p>
          </div>
          <Button onClick={() => setShowOpenModal(true)} className="mt-[8px] text-[15px] px-[24px] py-[12px]">
            + Abrir nuevo ciclo
          </Button>
        </div>

        {/* Modal: Abrir Ciclo */}
        <Modal
          isOpen={showOpenModal}
          onClose={() => !isProcessing && setShowOpenModal(false)}
          title="Abrir nuevo ciclo de trading"
          confirmText="Sí, abrir ciclo"
          cancelText="Cancelar"
          onConfirm={handleOpenCycle}
          confirmVariant="primary"
          icon="info"
          loading={isProcessing}
        >
          <p>
            Se creará un nuevo ciclo con la tasa BCV del día{' '}
            <strong className="text-[var(--text-primary)]">
              {bcvRate ? `(${bcvRate.tasa_bcv.toFixed(2)} Bs/USD)` : '(cargando...)'}
            </strong>
            . Podrás asignar órdenes de compra y venta a este ciclo hasta cerrarlo.
          </p>
        </Modal>
      </>
    );
  }

  const resParcial = activeCycle.ganancia_usdt;
  const isLoss = resParcial < 0;
  
  const liquidezVES = activeCycle.ves_recibido - activeCycle.ves_pagado;

  const percentComplete = activeCycle.usdt_vendido > 0 ? Math.min((activeCycle.usdt_recomprado / activeCycle.usdt_vendido) * 100, 100) : 0;

  return (
    <>
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
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              Eliminar Ciclo
            </Button>
            <Button
              variant="danger"
              onClick={() => setShowCloseModal(true)}
              disabled={activeCycle.usdt_vendido === 0 || activeCycle.usdt_recomprado === 0}
            >
              Cerrar Ciclo
            </Button>
          </div>
        </div>
      </div>

      {/* Modal: Eliminar Ciclo */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isProcessing && setShowDeleteModal(false)}
        title="Eliminar ciclo permanentemente"
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onConfirm={handleDeleteCycle}
        confirmVariant="danger"
        icon="danger"
        loading={isProcessing}
      >
        <p>
          Estás a punto de eliminar el{' '}
          <strong className="text-[var(--text-primary)]">
            Ciclo #{activeCycle.cycleNumber.toString().slice(-4)}
          </strong>{' '}
          y todas las métricas asociadas a él.
        </p>
        <p className="mt-[8px] text-[#ff4e4e]/80 text-[12.5px] font-medium">
          ⚠️ Esta acción no se puede deshacer.
        </p>
      </Modal>

      {/* Modal: Cerrar Ciclo */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => !isProcessing && setShowCloseModal(false)}
        title="Cerrar ciclo de trading"
        confirmText="Sí, cerrar ciclo"
        cancelText="Seguir operando"
        onConfirm={handleCloseCycle}
        confirmVariant="danger"
        icon="info"
        loading={isProcessing}
      >
        <p>
          El ciclo se marcará como <strong className="text-[var(--text-primary)]">Completado</strong> y ya no podrás agregar más órdenes a él.
        </p>
        <div className="mt-[12px] grid grid-cols-2 gap-[8px]">
          <div className="bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[10px] p-[10px]">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Resultado</span>
            <p className={`mono text-[15px] font-bold mt-[2px] ${isLoss ? 'text-[#ff4e4e]' : 'text-[var(--accent)]'}`}>
              {resParcial >= 0 ? '+' : ''}{resParcial.toFixed(2)} USDT
            </p>
          </div>
          <div className="bg-[var(--bg-surface-3)] border border-[var(--border)] rounded-[10px] p-[10px]">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Progreso</span>
            <p className="mono text-[15px] font-bold mt-[2px] text-[var(--text-primary)]">
              {percentComplete.toFixed(0)}%
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};
