import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { execQuery, exportUserDatabase } from '../db/database';


export const Settings: React.FC = () => {
  const { currentUser, logout } = useAppStore();
  const [showClearModal, setShowClearModal] = useState(false);

  const handleExportData = () => {
    if (!currentUser) return;
    try {
      const data = exportUserDatabase(currentUser.id);
      const blob = new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arbitrack_backup_${currentUser.username}_${new Date().getTime()}.sqlite`;
      a.click();
    } catch(e) {
      alert("Error al exportar la base de datos.");
    }
  };

  const handleClearData = () => {
    if (!currentUser) return;
    execQuery(`DELETE FROM orders WHERE userId = ?`, [currentUser.id]);
    execQuery(`DELETE FROM cycles WHERE userId = ?`, [currentUser.id]);
    setShowClearModal(false);
    logout();
    window.location.reload();
  };

  return (
    <div className="flex flex-col gap-[24px] max-w-[800px] mx-auto pb-[40px] animate-fade-in-up">
      <div>
        <h1 className="text-[24px] font-bold">Configuración</h1>
        <p className="text-[14px] text-[var(--text-secondary)] mt-[4px]">Administra tu perfil local y los datos del sistema.</p>
      </div>

      <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px]">
        <h2 className="text-[16px] font-semibold mb-[16px]">Seguridad Local</h2>
        <p className="text-[13px] text-[var(--text-tertiary)] mb-[24px]">Tus APIs de Binance nunca se almacenan en SQLite ni localStorage. Solo viven temporalmente en RAM durante tu sesión.</p>
        <div className="flex flex-col gap-[16px]">
          <div className="flex items-center justify-between p-[16px] bg-[var(--bg-surface-3)] rounded-[8px] border border-[var(--border-strong)]">
            <div className="flex flex-col">
              <span className="font-medium text-[14px]">Perfil Activo</span>
              <span className="text-[12px] text-[var(--text-secondary)]">{currentUser?.fullName} (@{currentUser?.username})</span>
            </div>
            <Button variant="secondary" onClick={() => logout()}>Cerrar Sesión</Button>
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px]">
        <h2 className="text-[16px] font-semibold mb-[16px]">Datos y Respaldo</h2>
        <div className="flex flex-col gap-[16px]">
          <div className="flex items-center justify-between p-[16px] bg-[var(--bg-surface-3)] rounded-[8px] border border-[var(--border-strong)]">
            <div className="flex flex-col gap-[4px]">
              <span className="font-medium text-[14px]">Exportar Base de Datos SQLite</span>
              <span className="text-[12px] text-[var(--text-secondary)]">Descarga un archivo .sqlite con toda tu contabilidad para respaldos.</span>
            </div>
            <Button variant="secondary" onClick={handleExportData}>Exportar</Button>
          </div>

          <div className="flex items-center justify-between p-[16px] border border-[rgba(255,76,106,0.2)] bg-[var(--loss-bg)] rounded-[8px]">
            <div className="flex flex-col gap-[4px] max-w-[400px]">
              <span className="font-medium text-[14px] text-[var(--loss)]">Limpiar mis datos</span>
              <span className="text-[12px] text-[var(--loss)] opacity-80">Borra todos los ciclos y órdenes asociados a este perfil local ({currentUser?.username}).</span>
            </div>
            <Button variant="danger" onClick={() => setShowClearModal(true)}>Limpiar</Button>
          </div>
        </div>
      </div>


      <Modal  
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="¿Limpiar todos los datos?"
        confirmText="Sí, borrar todo"
        confirmVariant="danger"
        onConfirm={handleClearData}
      >
        Esta acción es irreversible y eliminará todos los ciclos y órdenes atados a <strong>{currentUser?.username}</strong>. 
        Asegúrate de haber exportado un respaldo SQLite antes de continuar.
      </Modal>

    </div>
  );
};
