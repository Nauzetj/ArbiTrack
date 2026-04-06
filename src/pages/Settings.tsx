import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { supabase } from '../lib/supabase';


export const Settings: React.FC = () => {
  const { currentUser, logout, orders, cycles } = useAppStore();
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleExportData = () => {
    if (!currentUser) return;
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        user: {
          id: currentUser.id,
          username: currentUser.username,
          fullName: currentUser.fullName,
          role: currentUser.role,
          planExpiresAt: currentUser.planExpiresAt,
          createdAt: currentUser.createdAt,
        },
        orders,
        cycles,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arbitrack_backup_${currentUser.username}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error al exportar los datos.');
    }
  };

  const handleClearData = async () => {
    if (!currentUser) return;
    setIsClearing(true);
    try {
      // Delete all orders and cycles for this user from Supabase
      await supabase.from('orders').delete().eq('user_id', currentUser.id);
      await supabase.from('cycles').delete().eq('user_id', currentUser.id);
      setShowClearModal(false);
      await logout();
    } catch (e) {
      alert('Error al limpiar los datos.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex flex-col gap-[24px] max-w-[800px] mx-auto pb-[40px] animate-fade-in-up">
      <div>
        <h1 className="text-[24px] font-bold">Configuración</h1>
        <p className="text-[14px] text-[var(--text-secondary)] mt-[4px]">Administra tu perfil y los datos de tu cuenta en la nube.</p>
      </div>

      {/* Account Info */}
      <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px]">
        <h2 className="text-[16px] font-semibold mb-[16px]">Seguridad</h2>
        <p className="text-[13px] text-[var(--text-tertiary)] mb-[24px]">
          Tus APIs de Binance nunca se almacenan en la nube. Solo viven temporalmente en RAM durante tu sesión activa.
        </p>
        <div className="flex flex-col gap-[16px]">
          <div className="flex items-center justify-between p-[16px] bg-[var(--bg-surface-3)] rounded-[8px] border border-[var(--border-strong)]">
            <div className="flex flex-col">
              <span className="font-medium text-[14px]">Perfil Activo</span>
              <span className="text-[12px] text-[var(--text-secondary)]">{currentUser?.fullName} (@{currentUser?.username})</span>
              <span className="text-[11px] text-[var(--text-tertiary)] mt-[2px]">Plan: {currentUser?.role}</span>
            </div>
            <Button variant="secondary" onClick={() => logout()}>Cerrar Sesión</Button>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px]">
        <h2 className="text-[16px] font-semibold mb-[16px]">Datos y Respaldo</h2>
        <div className="flex flex-col gap-[16px]">
          <div className="flex items-center justify-between p-[16px] bg-[var(--bg-surface-3)] rounded-[8px] border border-[var(--border-strong)]">
            <div className="flex flex-col gap-[4px]">
              <span className="font-medium text-[14px]">Exportar Datos (JSON)</span>
              <span className="text-[12px] text-[var(--text-secondary)]">Descarga un archivo JSON con todos tus ciclos y órdenes como respaldo local.</span>
            </div>
            <Button variant="secondary" onClick={handleExportData}>Exportar</Button>
          </div>

          <div className="flex items-center justify-between p-[16px] border border-[rgba(255,76,106,0.2)] bg-[var(--loss-bg)] rounded-[8px]">
            <div className="flex flex-col gap-[4px] max-w-[400px]">
              <span className="font-medium text-[14px] text-[var(--loss)]">Limpiar mis datos</span>
              <span className="text-[12px] text-[var(--loss)] opacity-80">Borra TODOS los ciclos y órdenes de tu cuenta en la nube. Esta acción es irreversible.</span>
            </div>
            <Button variant="danger" onClick={() => setShowClearModal(true)}>Limpiar</Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="¿Limpiar todos los datos?"
        confirmText={isClearing ? 'Borrando...' : 'Sí, borrar todo'}
        confirmVariant="danger"
        onConfirm={handleClearData}
      >
        Esta acción es irreversible y eliminará todos los ciclos y órdenes de <strong>{currentUser?.username}</strong> de la base de datos en la nube.
        Asegúrate de haber exportado un respaldo JSON antes de continuar.
      </Modal>
    </div>
  );
};
