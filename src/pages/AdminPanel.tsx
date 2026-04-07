import React, { useState, useEffect } from 'react';
import { Shield, Users, Tag, Plus, Trash2, Copy, Check, RefreshCw, FileImage, X, CheckCircle, XCircle } from 'lucide-react';
import {
  getAllUsers, getAllPromoCodes, createPromoCode, deletePromoCode,
  updateUserRole, getAllPaymentRequests, updatePaymentRequestStatus
} from '../services/dbOperations';
import type { User, PromoCode, UserRole, PaymentRequest } from '../types';
import { generateUUID } from '../crypto/auth';
import { Badge } from '../components/ui/Badge';

const ADMIN_USERNAME = 'Nauzetj';

const PLAN_LABELS: Record<string, string> = {
  admin: '👑 Admin', vip_annual: '🌟 VIP Anual',
  vip_semiannual: '🔥 VIP Semestral', vip_monthly: '⚡ VIP Mensual',
  vip_promo: '🎁 Promo 15 días', free: '🆓 Gratuito',
};
const PLAN_BADGE_VARIANT: Record<string, any> = {
  admin: 'accent', vip_annual: 'profit', vip_semiannual: 'profit',
  vip_monthly: 'profit', vip_promo: 'accent', free: 'neutral',
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [newCodeDuration, setNewCodeDuration] = useState<'15d' | '1m' | '6m' | '12m'>('12m');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'users' | 'codes' | 'requests'>('requests');
  const [reviewingReq, setReviewingReq] = useState<PaymentRequest | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [approvedCode, setApprovedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const reload = async () => {
    setIsLoading(true);
    try {
      const [u, c, r] = await Promise.all([getAllUsers(), getAllPromoCodes(), getAllPaymentRequests()]);
      setUsers(u); setCodes(c); setRequests(r);
    } catch (err) { console.error('Admin reload error:', err); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { reload(); }, []);

  const handleGenerateCode = async () => {
    const now = new Date();
    const expires = new Date(now);
    if (newCodeDuration === '15d') expires.setDate(expires.getDate() + 15);
    else if (newCodeDuration === '1m') expires.setMonth(expires.getMonth() + 1);
    else if (newCodeDuration === '6m') expires.setMonth(expires.getMonth() + 6);
    else expires.setFullYear(expires.getFullYear() + 1);

    const newCode: PromoCode = {
      id: generateUUID(),
      code: generateCode(),
      plan: newCodeDuration === '12m' ? 'vip_annual' : newCodeDuration === '6m' ? 'vip_semiannual' : newCodeDuration === '1m' ? 'vip_monthly' : 'vip_promo',
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      usedAt: null, usedBy: null,
    };
    await createPromoCode(newCode);
    await reload();
  };

  const handleApproveRequest = async (req: PaymentRequest) => {
    const now = new Date();
    const expires = new Date(now);
    expires.setDate(expires.getDate() + 15);
    const code = generateCode();
    const plan = req.duration === '12m' ? 'vip_annual' : req.duration === '6m' ? 'vip_semiannual' : req.duration === '1m' ? 'vip_monthly' : 'vip_promo';

    await createPromoCode({
      id: generateUUID(), code, plan: plan as any,
      createdAt: now.toISOString(), expiresAt: expires.toISOString(),
      usedAt: null, usedBy: null,
    });
    await updatePaymentRequestStatus(req.id, 'approved', reviewNote || null, code);
    setApprovedCode(code);
    await reload();
    setReviewingReq({ ...req, status: 'approved', generatedCode: code });
  };

  const handleRejectRequest = async (req: PaymentRequest) => {
    await updatePaymentRequestStatus(req.id, 'rejected', reviewNote || null, null);
    setReviewingReq(null);
    setReviewNote('');
    await reload();
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteCode = async (id: string) => {
    await deletePromoCode(id);
    await reload();
  };

  const handleChangeRole = async (userId: string, role: UserRole) => {
    let planExpiresAt: string | null = null;
    if (role === 'vip_monthly') { const d = new Date(); d.setMonth(d.getMonth() + 1); planExpiresAt = d.toISOString(); }
    else if (role === 'vip_semiannual') { const d = new Date(); d.setMonth(d.getMonth() + 6); planExpiresAt = d.toISOString(); }
    else if (role === 'vip_annual') { const d = new Date(); d.setFullYear(d.getFullYear() + 1); planExpiresAt = d.toISOString(); }
    await updateUserRole(userId, role, planExpiresAt);
    await reload();
  };

  const codeStatus = (c: PromoCode) => {
    if (c.usedAt) return { label: 'Usado', color: 'text-[var(--text-tertiary)]', bg: 'bg-[var(--bg-surface-4)]' };
    if (new Date(c.expiresAt) < new Date()) return { label: 'Expirado', color: 'text-[var(--loss)]', bg: 'bg-[var(--loss-bg)]' };
    return { label: 'Activo', color: 'text-[var(--profit)]', bg: 'bg-[var(--profit-bg)]' };
  };

  return (
    <div className="flex flex-col gap-[24px] max-w-[1100px] mx-auto pb-[40px] animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[14px]">
          <div className="w-[44px] h-[44px] bg-[var(--accent)]/15 rounded-[12px] flex items-center justify-center border border-[var(--accent)]/30">
            <Shield size={22} className="text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold">Panel de Administración</h1>
            <p className="text-[13px] text-[var(--text-tertiary)]">Acceso exclusivo — {ADMIN_USERNAME}</p>
          </div>
        </div>
        <button onClick={reload} disabled={isLoading}
          className="flex items-center gap-[6px] px-[12px] py-[7px] text-[13px] text-[var(--text-secondary)] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[8px] hover:bg-[var(--bg-surface-4)] transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-[var(--bg-surface-3)] p-[4px] rounded-[10px] border border-[var(--border-strong)] w-fit">
        {[
          { id: 'requests', icon: <FileImage size={14} />, label: `Solicitudes${requests.filter(r => r.status === 'pending').length > 0 ? ` (${requests.filter(r => r.status === 'pending').length} pendientes)` : ''}` },
          { id: 'users', icon: <Users size={14} />, label: `Usuarios (${users.length})` },
          { id: 'codes', icon: <Tag size={14} />, label: `Códigos Promo (${codes.filter(c => !c.usedAt && new Date(c.expiresAt) >= new Date()).length} activos)` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-[8px] px-[16px] py-[7px] rounded-[6px] text-[13px] font-medium transition-colors ${
              tab === t.id
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface-3)] text-[10px] uppercase font-semibold text-[var(--text-tertiary)] tracking-[1px]">
                <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)]">Usuario</th>
                <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)]">Nombre</th>
                <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)]">Rol / Plan</th>
                <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)]">Vence</th>
                <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)]">Registrado</th>
                <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)] text-center">Cambiar Plan</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} className="py-[32px] text-center text-[var(--text-secondary)]">Sin usuarios registrados.</td></tr>
              ) : users.map(u => {
                const isExpired = u.planExpiresAt && new Date(u.planExpiresAt) < new Date();
                return (
                  <tr key={u.id} className="table-glass-row border-b border-[var(--border)]">
                    <td className="py-[14px] px-[20px] font-mono text-[13px] font-semibold text-[var(--text-primary)]">@{u.username}</td>
                    <td className="py-[14px] px-[20px] text-[13px] text-[var(--text-secondary)]">{u.fullName}</td>
                    <td className="py-[14px] px-[20px]">
                      <Badge variant={PLAN_BADGE_VARIANT[u.role] || 'neutral'}>{PLAN_LABELS[u.role] || u.role}</Badge>
                    </td>
                    <td className="py-[14px] px-[20px] text-[12px]">
                      {u.planExpiresAt ? (
                        <span className={isExpired ? 'text-[var(--loss)]' : 'text-[var(--text-secondary)]'}>
                          {new Date(u.planExpiresAt).toLocaleDateString()}{isExpired && ' (vencido)'}
                        </span>
                      ) : <span className="text-[var(--text-tertiary)]">—</span>}
                    </td>
                    <td className="py-[14px] px-[20px] text-[12px] text-[var(--text-tertiary)]">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-[14px] px-[20px]">
                      {u.username !== ADMIN_USERNAME ? (
                        <select value={u.role} onChange={e => handleChangeRole(u.id, e.target.value as UserRole)}
                          className="bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[6px] text-[12px] px-[8px] py-[5px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors cursor-pointer">
                          <option value="free">🆓 Gratuito</option>
                          <option value="vip_promo">🎁 Promo 15 días</option>
                          <option value="vip_monthly">⚡ VIP Mensual</option>
                          <option value="vip_semiannual">🔥 VIP Semestral</option>
                          <option value="vip_annual">🌟 VIP Anual</option>
                          <option value="admin">👑 Admin</option>
                        </select>
                      ) : (
                        <span className="text-[11px] text-[var(--text-tertiary)] italic">Admin protegido</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CODES TAB */}
      {tab === 'codes' && (
        <div className="flex flex-col gap-[16px]">
          <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[24px]">
            <h3 className="text-[14px] font-semibold mb-[16px] flex items-center gap-[8px]">
              <Plus size={16} className="text-[var(--accent)]" /> Generar nuevo código
            </h3>
            <div className="flex flex-wrap items-end gap-[12px]">
              <div className="flex flex-col gap-[6px]">
                <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-[0.5px] font-medium">Duración del código</span>
                <div className="flex gap-[8px]">
                  {([
                    { id: '15d', label: '🎁 Promo 15 días', desc: 'Acceso de prueba' },
                    { id: '1m', label: '⚡ 1 Mes', desc: 'Mensual' },
                    { id: '6m', label: '🔥 6 Meses', desc: 'Semestral' },
                    { id: '12m', label: '🌟 12 Meses', desc: 'Anual' },
                  ] as const).map(d => (
                    <button key={d.id} onClick={() => setNewCodeDuration(d.id)}
                      className={`flex flex-col items-center px-[14px] py-[8px] rounded-[8px] border text-[12px] font-medium transition-all ${
                        newCodeDuration === d.id
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'border-[var(--border-strong)] bg-[var(--bg-surface-3)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'
                      }`}>
                      <span>{d.label}</span>
                      <span className="text-[10px] opacity-70 font-normal">{d.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleGenerateCode}
                className="flex items-center gap-[8px] px-[20px] py-[9px] bg-[var(--accent)] text-white font-semibold text-[13px] rounded-[8px] hover:opacity-90 transition-all hover:-translate-y-[1px] shadow-[0_2px_8px_var(--accent-muted)] self-end">
                <Plus size={14} /> Generar Código
              </button>
            </div>
          </div>

          <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[700px] text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-surface-3)] text-[10px] uppercase font-semibold text-[var(--text-tertiary)] tracking-[1px]">
                  <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)]">Código</th>
                  <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)]">Plan</th>
                  <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)]">Estado</th>
                  <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)]">Creado</th>
                  <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)]">Expira</th>
                  <th className="py-[12px] px-[20px] border-b border-[var(--border-strong)] text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {codes.length === 0 ? (
                  <tr><td colSpan={6} className="py-[32px] text-center text-[var(--text-secondary)]">No hay códigos generados aún.</td></tr>
                ) : codes.map(c => {
                  const s = codeStatus(c);
                  return (
                    <tr key={c.id} className={`table-glass-row border-b border-[var(--border)] ${c.usedAt || new Date(c.expiresAt) < new Date() ? 'opacity-50' : ''}`}>
                      <td className="py-[14px] px-[20px]"><span className="font-mono text-[15px] font-bold tracking-[2px] text-[var(--text-primary)]">{c.code}</span></td>
                      <td className="py-[14px] px-[20px]">
                        <Badge variant={c.plan === 'vip_annual' ? 'profit' : 'accent'}>
                          {(() => {
                            const diffDays = Math.round((new Date(c.expiresAt).getTime() - new Date(c.createdAt).getTime()) / 86400000);
                            if (diffDays <= 16) return '🎁 Promo 15 días';
                            if (diffDays <= 35) return '⚡ 1 Mes';
                            if (diffDays <= 185) return '🔥 6 Meses';
                            return '🌟 12 Meses';
                          })()}
                        </Badge>
                      </td>
                      <td className="py-[14px] px-[20px]">
                        <span className={`text-[11px] font-medium px-[8px] py-[3px] rounded-full ${s.bg} ${s.color}`}>{s.label}</span>
                      </td>
                      <td className="py-[14px] px-[20px] text-[12px] text-[var(--text-tertiary)]">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="py-[14px] px-[20px] text-[12px] text-[var(--text-tertiary)]">{new Date(c.expiresAt).toLocaleDateString()}</td>
                      <td className="py-[14px] px-[20px]">
                        <div className="flex items-center justify-center gap-[8px]">
                          {!c.usedAt && new Date(c.expiresAt) >= new Date() && (
                            <button onClick={() => handleCopyCode(c.code, c.id)} title="Copiar código"
                              className="p-[6px] rounded-[6px] bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-4)] transition-colors text-[var(--text-secondary)] hover:text-[var(--accent)]">
                              {copiedId === c.id ? <Check size={13} className="text-[var(--profit)]" /> : <Copy size={13} />}
                            </button>
                          )}
                          <button onClick={() => handleDeleteCode(c.id)} title="Eliminar"
                            className="p-[6px] rounded-[6px] bg-[var(--bg-surface-3)] hover:bg-[var(--loss-bg)] transition-colors text-[var(--text-secondary)] hover:text-[var(--loss)]">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REQUESTS TAB */}
      {tab === 'requests' && (
        <div className="flex flex-col gap-[16px]">
          {requests.length === 0 ? (
            <div className="bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[48px] text-center text-[var(--text-secondary)] text-[14px]">No hay solicitudes de pago aún.</div>
          ) : (
            <div className="grid grid-cols-1 gap-[16px]">
              {requests.map(req => {
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                return (
                  <div key={req.id} className={`bg-[var(--bg-surface-2)] rounded-[16px] border transition-all ${isPending ? 'border-[var(--warning)]/40' : isApproved ? 'border-[var(--profit)]/30' : 'border-[var(--border)] opacity-60'}`}>
                    <div className="flex items-start gap-[20px] p-[20px]">
                      <button onClick={() => { setReviewingReq(req); setReviewNote(''); setApprovedCode(req.generatedCode); }}
                        className="flex-shrink-0 w-[100px] h-[80px] rounded-[10px] overflow-hidden border border-[var(--border-strong)] hover:border-[var(--accent)] transition-colors group relative">
                        <img src={req.imageData} alt="Comprobante" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-[10px] font-medium">Ver</span>
                        </div>
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-[12px]">
                          <div>
                            <span className="font-semibold text-[15px] text-[var(--text-primary)]">{req.name}</span>
                            <span className="ml-[10px] text-[12px] text-[var(--text-tertiary)]">{req.contact}</span>
                          </div>
                          <span className={`text-[11px] font-bold px-[8px] py-[3px] rounded-full flex-shrink-0 ${isPending ? 'bg-[var(--warning-bg)] text-[var(--warning)]' : isApproved ? 'bg-[var(--profit-bg)] text-[var(--profit)]' : 'bg-[var(--bg-surface-4)] text-[var(--text-tertiary)]'}`}>
                            {isPending ? '⏳ Pendiente' : isApproved ? '✅ Aprobado' : '❌ Rechazado'}
                          </span>
                        </div>
                        <div className="flex items-center gap-[12px] mt-[6px] flex-wrap">
                          <span className="text-[12px] text-[var(--text-secondary)]">
                            {req.duration === '15d' ? '🎁 Promo 15 días' : req.duration === '1m' ? '⚡ 1 Mes' : req.duration === '6m' ? '🔥 6 Meses' : '🌟 12 Meses'}
                          </span>
                          <span className="text-[var(--text-tertiary)] text-[11px]">{new Date(req.createdAt).toLocaleString()}</span>
                        </div>
                        {isApproved && req.generatedCode && (
                          <div className="mt-[10px] flex items-center gap-[8px]">
                            <span className="text-[11px] text-[var(--text-tertiary)]">Código generado:</span>
                            <code className="font-mono text-[13px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-[8px] py-[2px] rounded">{req.generatedCode}</code>
                            <button onClick={() => { navigator.clipboard.writeText(req.generatedCode!); }} className="p-[4px] rounded hover:bg-[var(--bg-surface-4)] transition-colors text-[var(--text-tertiary)] hover:text-[var(--accent)]">
                              <Copy size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      {isPending && (
                        <div className="flex flex-col gap-[6px] flex-shrink-0">
                          <button onClick={() => { setReviewingReq(req); setReviewNote(''); setApprovedCode(null); }}
                            className="flex items-center gap-[6px] px-[12px] py-[7px] bg-[var(--profit-bg)] border border-[var(--profit)]/30 text-[var(--profit)] text-[12px] font-semibold rounded-[8px] hover:opacity-80 transition-opacity">
                            <CheckCircle size={14} /> Aprobar
                          </button>
                          <button onClick={() => handleRejectRequest(req)}
                            className="flex items-center gap-[6px] px-[12px] py-[7px] bg-[var(--loss-bg)] border border-[var(--loss)]/30 text-[var(--loss)] text-[12px] font-semibold rounded-[8px] hover:opacity-80 transition-opacity">
                            <XCircle size={14} /> Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* REVIEW MODAL */}
      {reviewingReq && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-[24px]" onClick={() => { setReviewingReq(null); setApprovedCode(null); }}>
          <div className="bg-[var(--bg-surface-1)] rounded-[20px] border border-[var(--border)] max-w-[700px] w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-[24px] border-b border-[var(--border)]">
              <div>
                <h3 className="font-bold text-[16px]">Comprobante de {reviewingReq.name}</h3>
                <p className="text-[12px] text-[var(--text-tertiary)] mt-[2px]">{reviewingReq.contact}</p>
              </div>
              <button onClick={() => { setReviewingReq(null); setApprovedCode(null); }} className="p-[8px] rounded-[8px] hover:bg-[var(--bg-surface-3)] text-[var(--text-secondary)] transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-[24px] flex flex-col gap-[20px]">
              <img src={reviewingReq.imageData} alt="Comprobante" className="w-full rounded-[12px] border border-[var(--border-strong)] object-contain max-h-[400px] bg-[var(--bg-surface-3)]" />
              {approvedCode ? (
                <div className="bg-[var(--profit-bg)] border border-[var(--profit)]/30 rounded-[12px] p-[20px] text-center">
                  <p className="text-[13px] text-[var(--text-secondary)] mb-[10px]">✅ Solicitud aprobada. Código generado:</p>
                  <code className="font-mono text-[24px] font-bold text-[var(--accent)] tracking-[4px]">{approvedCode}</code>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-[8px]">Envía este código al usuario: <strong>{reviewingReq.contact}</strong></p>
                  <button onClick={() => { navigator.clipboard.writeText(approvedCode); }}
                    className="mt-[12px] flex items-center gap-[6px] mx-auto px-[16px] py-[8px] bg-[var(--accent)] text-white font-semibold text-[13px] rounded-[8px] hover:opacity-90 transition-opacity">
                    <Copy size={14} /> Copiar código
                  </button>
                </div>
              ) : reviewingReq.status === 'pending' ? (
                <div className="flex flex-col gap-[12px]">
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[12px] text-[var(--text-secondary)] font-medium">Nota (opcional)</label>
                    <input type="text" value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Ej: Pago verificado por Binance Pay"
                      className="bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[8px] px-[12px] py-[9px] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors" />
                  </div>
                  <div className="flex gap-[10px]">
                    <button onClick={() => handleApproveRequest(reviewingReq)}
                      className="flex-1 flex items-center justify-center gap-[8px] py-[11px] bg-[var(--profit-bg)] border border-[var(--profit)]/40 text-[var(--profit)] font-bold text-[14px] rounded-[10px] hover:opacity-80 transition-opacity">
                      <CheckCircle size={16} /> Aprobar y Generar Código
                    </button>
                    <button onClick={() => handleRejectRequest(reviewingReq)}
                      className="flex-1 flex items-center justify-center gap-[8px] py-[11px] bg-[var(--loss-bg)] border border-[var(--loss)]/40 text-[var(--loss)] font-bold text-[14px] rounded-[10px] hover:opacity-80 transition-opacity">
                      <XCircle size={16} /> Rechazar Solicitud
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
