import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { supabase } from '../lib/supabase';
import { KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';


export const Settings: React.FC = () => {
  const { currentUser, logout, orders, cycles, binanceKeys, login } = useAppStore();
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Binance keys state
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  const handleSaveKeys = () => {
    if (!apiKey.trim() || !secretKey.trim()) {
      toast.error('Debes ingresar ambas claves (API Key y Secret Key).');
      return;
    }
    if (!currentUser) return;
    setIsSavingKeys(true);
    // Re-use the login action just to update the binanceKeys in the store
    const { session } = useAppStore.getState();
    if (!session) { toast.error('Sesión no encontrada. Inicia sesión de nuevo.'); setIsSavingKeys(false); return; }
    login(currentUser, session, apiKey.trim(), secretKey.trim());
    setApiKey('');
    setSecretKey('');
    toast.success('¡Claves de Binance actualizadas! La sincronización comenzará en breve.');
    setIsSavingKeys(false);
  };

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
      const { error: ordersErr } = await supabase.from('orders').delete().eq('user_id', currentUser.id);
      if (ordersErr) throw new Error(`Error al borrar órdenes: ${ordersErr.message}`);

      const { error: cyclesErr } = await supabase.from('cycles').delete().eq('user_id', currentUser.id);
      if (cyclesErr) throw new Error(`Error al borrar ciclos: ${cyclesErr.message}`);

      // Clear the pin/cache in Zustand immediately so UI updates
      const store = useAppStore.getState();
      if (store.setOrders) store.setOrders([]);
      if (store.setCycles) store.setCycles([]);

      toast.success('Toda tu información ha sido reseteada. Claves intactas.');
      setShowClearModal(false);
    } catch (e: any) {
      toast.error(e.message || 'Error al limpiar los datos.');
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

      {/* ── Binance API Keys ── */}
      <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px]">
        <div className="flex items-center gap-[10px] mb-[4px]">
          <KeyRound size={16} className="text-[var(--accent)]" />
          <h2 className="text-[16px] font-semibold">Claves de Binance API</h2>
        </div>
        <p className="text-[13px] text-[var(--text-tertiary)] mb-[20px]">
          Las claves solo se guardan en memoria durante la sesión. Si la app fue limpiada o recargada, actualízalas aquí sin cerrar sesión.
        </p>

        {/* Status pill */}
        <div className={`flex items-center gap-[8px] px-[14px] py-[10px] rounded-[10px] border mb-[20px] text-[13px] font-medium ${
          binanceKeys
            ? 'bg-[var(--profit-bg)] border-[rgba(0,229,195,0.25)] text-[var(--profit)]'
            : 'bg-[var(--warning-bg)] border-[rgba(255,183,77,0.25)] text-[var(--warning)]'
        }`}>
          {binanceKeys
            ? <><CheckCircle2 size={15} /> Claves activas — sincronización habilitada</>
            : <><AlertTriangle size={15} /> Sin claves — sincronización con Binance desactivada</>
          }
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Nueva API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Clave pública de Binance"
              autoComplete="off"
              className="bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[10px] px-[14px] py-[11px] text-[13px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">Nueva Secret Key</label>
            <input
              type="password"
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
              placeholder="Clave secreta de Binance"
              autoComplete="off"
              className="bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[10px] px-[14px] py-[11px] text-[13px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
          <Button onClick={handleSaveKeys} disabled={isSavingKeys || !apiKey.trim() || !secretKey.trim()} className="self-start mt-[4px]">
            {isSavingKeys ? 'Guardando...' : 'Actualizar Claves'}
          </Button>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px]">
        <h2 className="text-[16px] font-semibold mb-[16px]">Seguridad</h2>
        <p className="text-[13px] text-[var(--text-tertiary)] mb-[24px]">
          Tus APIs de Binance nunca se almacenan en la nube. Solo viven temporalmente en RAM durante tu sesión activa.
        </p>
        <div className="flex flex-col gap-[16px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[12px] p-[16px] bg-[var(--bg-surface-3)] rounded-[8px] border border-[var(--border-strong)]">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[12px] p-[16px] bg-[var(--bg-surface-3)] rounded-[8px] border border-[var(--border-strong)]">
            <div className="flex flex-col gap-[4px]">
              <span className="font-medium text-[14px]">Exportar Datos (JSON)</span>
              <span className="text-[12px] text-[var(--text-secondary)]">Descarga un archivo JSON con todos tus ciclos y órdenes como respaldo local.</span>
            </div>
            <Button variant="secondary" onClick={handleExportData}>Exportar</Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[12px] p-[16px] border border-[rgba(255,76,106,0.2)] bg-[var(--loss-bg)] rounded-[8px]">
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
