import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArbiBot } from '../components/ui/ArbiBot';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [msg, setMsg]                 = useState('');
  const [isError, setIsError]         = useState(false);
  const [ready, setReady]             = useState(false);

  // Supabase mete el access_token en el hash cuando viene de recovery email.
  // onAuthStateChange dispara 'PASSWORD_RECOVERY' — lo usamos para saber
  // que la sesión de recuperación está activa.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // También comprobamos si ya hay sesión activa (por si el evento ya pasó)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setIsError(true);
      setMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setIsError(true);
      setMsg('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setMsg('');
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setIsError(true);
      setMsg('Error al actualizar: ' + error.message);
    } else {
      setIsError(false);
      setMsg('✓ Contraseña actualizada correctamente. Redirigiendo...');
      setTimeout(() => navigate('/login'), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center px-4">
      {/* Glow background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[var(--accent)] rounded-full blur-[120px] opacity-10 pointer-events-none" />

      <div className="relative z-10 w-full max-w-[380px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[20px] p-[28px] shadow-xl flex flex-col gap-[20px]">

        {/* Header */}
        <div className="flex flex-col items-center gap-[12px]">
          <ArbiBot size={52} />
          <div className="text-center">
            <h1 className="text-[20px] font-bold text-[var(--text-primary)]">Nueva contraseña</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-[4px]">
              Elige una contraseña segura para tu cuenta
            </p>
          </div>
        </div>

        {!ready ? (
          /* Esperando el token de Supabase */
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-[28px] h-[28px] border-[3px] border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-[var(--text-secondary)]">Verificando enlace de recuperación…</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="flex flex-col gap-[14px]">
            {/* Nueva contraseña */}
            <div className="flex flex-col gap-[6px]">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                className="bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[12px] px-[16px] py-[13px] text-[14px] font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all"
              />
            </div>

            {/* Confirmar contraseña */}
            <div className="flex flex-col gap-[6px]">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.5px]">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                className="bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-[12px] px-[16px] py-[13px] text-[14px] font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all"
              />
            </div>

            {/* Mensaje de error / éxito */}
            {msg && (
              <div className={`p-[12px] rounded-[8px] text-[13px] border ${
                isError
                  ? 'bg-[var(--loss-bg)] text-[var(--loss)] border-[rgba(255,76,106,0.3)]'
                  : 'bg-[var(--profit-bg)] text-[var(--profit)] border-[rgba(0,229,195,0.3)]'
              }`}>
                {msg}
              </div>
            )}

            {/* Botón submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-[4px] w-full py-[14px] rounded-[12px] bg-[var(--accent)] text-white font-bold text-[15px] shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? 'Actualizando…' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}

        {/* Volver al login */}
        <button
          onClick={() => navigate('/login')}
          className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors text-center"
        >
          ← Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
};
