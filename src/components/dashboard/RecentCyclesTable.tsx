import React, { useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { Badge } from '../ui/Badge';
import { Link } from 'react-router-dom';

export const RecentCyclesTable: React.FC = () => {
  const { cycles } = useAppStore();
  const recent = cycles.slice(0, 10); // show up to 10 recent cycles

  const tableRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (recent.length > 0) {
      gsap.fromTo('.recent-row', 
        { opacity: 0, x: -15 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', delay: 0.8, clearProps: 'all' }
      );
    }
  }, { scope: tableRef, dependencies: [recent] });

  if (recent.length === 0) {
    return (
      <div className="h-full bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] p-[32px] flex items-center justify-center">
        <p className="text-[var(--text-secondary)] text-[14px]">No hay ciclos registrados aún.</p>
      </div>
    );
  }

  return (
    /**
     * h-full + flex-col → card stretches to fill parent (flex-1 min-h-0 div in Dashboard)
     * The header row (title + link) is flex-none.
     * The table wrapper is flex-1 min-h-0 overflow-y-auto → only the rows scroll.
     */
    <div ref={tableRef} className="h-full flex flex-col bg-[var(--bg-surface-2)] rounded-[16px] border border-[var(--border)] overflow-hidden">

      {/* Card header — pinned */}
      <div className="flex-none flex items-center justify-between px-[20px] py-[16px] border-b border-[var(--border-strong)] bg-[var(--bg-surface-2)]">
        <h3 className="font-semibold text-[16px] text-[var(--text-primary)]">Últimos Ciclos</h3>
        <Link to="/ciclos" className="text-[13px] text-[var(--accent)] hover:underline font-medium">
          Ver todos &rarr;
        </Link>
      </div>

      {/* Sticky thead + scrollable tbody */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto custom-scrollbar w-full">
        <table className="w-full min-w-[700px] text-left border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--bg-surface-3)] text-[10px] uppercase font-semibold text-[var(--text-tertiary)] tracking-[1px]">
              <th className="p-[14px] border-b border-[var(--border-strong)] font-semibold"># Ciclo</th>
              <th className="p-[14px] border-b border-[var(--border-strong)] font-semibold min-w-[140px]">Apertura</th>
              <th className="p-[14px] border-b border-[var(--border-strong)] font-semibold text-right">USDT Vendido</th>
              <th className="p-[14px] border-b border-[var(--border-strong)] font-semibold text-right">Ganancia</th>
              <th className="p-[14px] border-b border-[var(--border-strong)] font-semibold text-center">ROI</th>
              <th className="p-[14px] border-b border-[var(--border-strong)] font-semibold text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((c) => (
              <tr
                key={c.id}
                className="recent-row table-glass-row border-b border-[var(--border)] last:border-none opacity-0"
              >
                <td className="p-[14px] mono text-[13px] text-[var(--text-primary)] font-medium">
                  {c.cycleNumber.toString().slice(-4)}
                </td>
                <td className="p-[14px] text-[13px] text-[var(--text-secondary)]">
                  {new Date(c.openedAt).toLocaleDateString()}{' '}
                  {new Date(c.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="p-[14px] mono text-[13px] text-right">
                  {c.usdt_vendido.toFixed(2)}
                </td>
                <td
                  className={`p-[14px] mono text-[13px] text-right ${
                    c.ganancia_usdt > 0
                      ? 'text-[var(--profit)]'
                      : c.ganancia_usdt < 0
                      ? 'text-[var(--loss)]'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  {c.ganancia_usdt > 0 ? '+' : ''}
                  {c.ganancia_usdt.toFixed(2)}
                </td>
                <td className="p-[14px] text-center">
                  <Badge variant={c.roi_percent > 0 ? 'profit' : c.roi_percent < 0 ? 'loss' : 'neutral'}>
                    {c.roi_percent > 0 ? '+' : ''}{c.roi_percent.toFixed(2)}%
                  </Badge>
                </td>
                <td className="p-[14px] text-center">
                  <Badge
                    variant={
                      c.status === 'En curso'
                        ? 'warning'
                        : c.status === 'Con pérdida'
                        ? 'loss'
                        : 'accent'
                    }
                  >
                    {c.status.toUpperCase()}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
