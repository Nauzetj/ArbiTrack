import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { Download, Folder, FolderOpen, FileCheck, ChevronRight, ChevronDown, Calendar, Database } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Cycle } from '../types';
import { getMonthSnapshots, type MonthSnapshot } from '../services/monthSnapshots';
import toast from 'react-hot-toast';

type TreeNode = {
  name: string;
  type: 'YEAR' | 'MONTH' | 'DAY';
  label: string;
  cycles: Cycle[];
  children?: Record<string, TreeNode>;
};

export const Reports: React.FC = () => {
  const { cycles, currentUser } = useAppStore();
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = useState<{ type: string; title: string; cycles: Cycle[] } | null>(null);
  
  // Nuevo estado para los snapshots históricos
  const [snapshots, setSnapshots] = useState<MonthSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [viewMode, setViewMode] = useState<'explorer' | 'history'>('explorer');

  // Incluir todos los ciclos que tengan estado cerrado
  const completedCycles = cycles.filter(c => 
    c.status && c.status.toLowerCase() !== 'en curso' && c.closedAt
  );

  // Cargar snapshots al montar o al cambiar pestaña
  useEffect(() => {
    const fetchSnaps = async () => {
      if (!currentUser || viewMode !== 'history') return;
      setLoadingSnapshots(true);
      try {
        const data = await getMonthSnapshots(currentUser.id);
        setSnapshots(data);
      } catch (err) {
        toast.error('Error cargando el historial mensual guardado.');
      } finally {
        setLoadingSnapshots(false);
      }
    };
    fetchSnaps();
  }, [currentUser, viewMode]);

  // Build Tree
  const treeData = useMemo(() => {
    const root: Record<string, TreeNode> = {};
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    completedCycles.forEach(c => {
      if (!c.closedAt || typeof c.closedAt !== 'string') return;
      
      const rawDate = c.closedAt.trim();
      if (!rawDate) return;
      
      let dateStr = '';
      try {
        if (rawDate.length <= 10) {
          dateStr = rawDate;
        } else {
          let isoStr = rawDate;
          if (!isoStr.includes('T') && isoStr.includes(' ')) {
            isoStr = isoStr.replace(' ', 'T');
          }
          const utcDate = new Date(isoStr);
          if (isNaN(utcDate.getTime())) return;
          
          const venTime = new Date(utcDate.getTime() - (4 * 60 * 60 * 1000));
          dateStr = venTime.toISOString().split('T')[0];
        }
        if (!dateStr || dateStr.length < 10) return;
      } catch {
        return;
      }
      
      const [y, m, d] = dateStr.split('-');
      if (!y || !m || !d) return;
      
      const monthLabel = monthNames[parseInt(m) - 1];

      if (!root[y]) root[y] = { name: y, type: 'YEAR', label: `Año ${y}`, cycles: [], children: {} };
      root[y].cycles.push(c);

      const mKey = `${y}-${m}`;
      if (!root[y].children![mKey]) root[y].children![mKey] = { name: mKey, type: 'MONTH', label: monthLabel, cycles: [], children: {} };
      root[y].children![mKey].cycles.push(c);

      const dKey = dateStr;
      if (!root[y].children![mKey].children![dKey]) root[y].children![mKey].children![dKey] = { name: dKey, type: 'DAY', label: `${d} de ${monthLabel}`, cycles: [] };
      root[y].children![mKey].children![dKey].cycles.push(c);
    });

    return root;
  }, [completedCycles]);

  const toggleNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelect = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ type: node.type, title: node.label, cycles: node.cycles });
  };

  const renderTree = (nodes: Record<string, TreeNode>, level = 0) => {
    return Object.entries(nodes)
      .sort(([a], [b]) => b.localeCompare(a)) // Sort desc
      .map(([id, node]) => {
        const isExpanded = !!expandedNodes[id];
        const isSelected = selectedNode?.title === node.label;
        const hasChildren = node.children && Object.keys(node.children).length > 0;

        return (
          <div key={id} className="flex flex-col ml-[16px] border-l border-[var(--border-strong)] pl-[8px] animate-fade-in-up">
            <div 
              className={`flex items-center gap-[8px] py-[6px] px-[12px] rounded-[8px] cursor-pointer transition-all ${
                isSelected ? 'bg-[var(--accent-muted)] border border-[var(--accent-border)]' : 'hover:bg-[var(--bg-surface-3)] border border-transparent'
              }`}
              onClick={(e) => handleSelect(node, e)}
            >
              {hasChildren ? (
                <div onClick={(e) => toggleNode(id, e)} className="p-[2px] bg-[var(--bg-surface-3)] rounded-[4px] hover:bg-[var(--bg-surface-4)] text-[var(--text-secondary)] transition-colors">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              ) : (
                <div className="w-[18px]" />
              )}
              
              {node.type !== 'DAY' ? (
                isExpanded ? <FolderOpen size={18} className="text-[#00e5c3]" /> : <Folder size={18} className="text-[#00e5c3]" />
              ) : (
                <FileCheck size={18} className="text-[#00e5c3]" />
              )}
              
              <span className={`text-[14px] ${isSelected ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                {node.label}
              </span>
              <span className="ml-auto text-[11px] bg-[var(--bg-surface-3)] px-[6px] py-[2px] rounded-[4px] text-[var(--text-tertiary)] mono">
                {node.cycles.length} op.
              </span>
            </div>
            
            {hasChildren && isExpanded && (
              <div className="mt-[4px] mb-[8px]">
                {renderTree(node.children!, level + 1)}
              </div>
            )}
          </div>
        );
      });
  };

  const generatePDF = () => {
    if (!selectedNode || selectedNode.cycles.length === 0) return;
    
    // Configuración base de pre-títulos
    const prefix = selectedNode.type === 'YEAR' ? 'Fiscal Anual' : selectedNode.type === 'MONTH' ? 'Cierre Mensual' : 'Operativo Diario';
    const periodTitle = `Reporte ${prefix} - ${selectedNode.title}`;
    
    const periodCycles = selectedNode.cycles;
    const profitUsdt = periodCycles.reduce((sum, c) => sum + (c.ganancia_usdt || 0), 0);
    const profitVes = periodCycles.reduce((sum, c) => sum + (c.ganancia_ves || 0), 0);
    const avgBcvRate = periodCycles.length > 0 ? (periodCycles.reduce((sum, c) => sum + (c.tasa_bcv_dia || 0), 0) / periodCycles.length) : 0;

    const doc = new jsPDF('l'); 
    doc.setFont("helvetica", "bold");
    doc.text(periodTitle, 14, 20);
    
    const ingresosVentasVES = periodCycles.reduce((sum, c) => sum + (c.ves_recibido || 0), 0);
    const egresosComprasVES = periodCycles.reduce((sum, c) => sum + (c.ves_pagado || 0), 0);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Ingresos Brutos por Ventas: Bs. ${ingresosVentasVES.toFixed(2)} VES`, 14, 40);
    doc.text(`Costo de Ventas (Recompras): Bs. ${egresosComprasVES.toFixed(2)} VES`, 100, 40);
    doc.text(`Ganancia Operativa Neta: Bs. ${profitVes.toFixed(2)} VES`, 14, 50);
    doc.text(`Ganancia Equivalente en USD: ${profitUsdt.toFixed(2)} USDT`, 100, 50);
    doc.text(`Tasa BCV del Periodo (Referencial): Bs. ${avgBcvRate.toFixed(2)} VES/USD`, 14, 60);

    const getDateStr = (c: Cycle) => {
      if (!c.closedAt || typeof c.closedAt !== 'string') return '—';
      try {
        const rawDate = c.closedAt.trim();
        if (!rawDate) return '—';
        if (rawDate.length <= 10) return rawDate;
        let isoStr = rawDate;
        if (!isoStr.includes('T') && isoStr.includes(' ')) isoStr = isoStr.replace(' ', 'T');
        const utcDate = new Date(isoStr);
        if (isNaN(utcDate.getTime())) return '—';
        const venTime = new Date(utcDate.getTime() - (4 * 60 * 60 * 1000));
        return venTime.toISOString().split('T')[0];
      } catch {
        return '—';
      }
    };
    
    const tableData = periodCycles.map(c => [
      `${getDateStr(c)} (#${c.cycleNumber.toString().slice(-4)})`,
      `${(c.usdt_vendido || 0).toFixed(2)} USDT`,
      `${(c.tasa_venta_prom || 0).toFixed(2)} Bs`,
      `${(c.tasa_compra_prom || 0).toFixed(2)} Bs`,
      `${(c.ganancia_usdt || 0).toFixed(2)} USDT`,
      `${(c.ganancia_ves || 0).toFixed(2)} Bs`,
      `${(c.tasa_bcv_dia || 0).toFixed(2)} Bs`
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['Fecha / Ciclo', 'Volumen', 'Tasa Venta', 'Tasa Compra', 'Utilidad (USDT)', 'Utilidad (VES)', 'Ref. BCV']],
      body: tableData,
    });

    const finalY = (doc as any).lastAutoTable.finalY || 70;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      "Generado automáticamente por el Sistema ArbiTrack de control P2P - Cifras expresadas en Bolívares.",
      14,
      finalY + 20
    );

    const safeTitle = periodTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`${safeTitle}.pdf`);
  };

  return (
    <div className="flex flex-col gap-[24px] max-w-[1200px] mx-auto pb-[40px] animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold">Reportes de Contabilidad</h1>
        
        {/* Toggle Pestañas */}
        <div className="flex bg-[var(--bg-surface-3)] p-[4px] rounded-[10px] border border-[var(--border-strong)]">
          <button
            onClick={() => setViewMode('explorer')}
            className={`flex items-center gap-[6px] px-[16px] py-[8px] rounded-[6px] text-[13px] font-medium transition-colors ${
              viewMode === 'explorer'
                ? 'bg-[var(--bg-surface-4)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent'
            }`}
          >
            <FolderOpen size={16}/> Explorador
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`flex items-center gap-[6px] px-[16px] py-[8px] rounded-[6px] text-[13px] font-medium transition-colors ${
              viewMode === 'history'
                ? 'bg-[var(--bg-surface-4)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent'
            }`}
          >
            <Database size={16}/> Historial Mensual
          </button>
        </div>
      </div>

      {viewMode === 'explorer' ? (
        <div className="flex flex-col lg:flex-row gap-[24px]">
          {/* Explorador de Archivos (Izquierda) */}
          <div className="w-full lg:w-[350px] bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[16px] flex flex-col overflow-hidden h-fit max-h-[70vh]">
            <div className="px-[20px] py-[16px] border-b border-[var(--border)] bg-[var(--bg-surface-3)]">
              <h2 className="text-[14px] font-medium text-[var(--text-secondary)] tracking-wide uppercase">Tus Archivos</h2>
            </div>
            <div className="p-[12px] overflow-y-auto">
              {Object.keys(treeData).length === 0 ? (
                <p className="text-[13px] text-[var(--text-tertiary)] p-[12px] text-center">No hay reportes generados aún. Completa ciclos para visualizarlos aquí.</p>
              ) : (
                <div className="-ml-[16px]">{renderTree(treeData)}</div>
              )}
            </div>
          </div>

          {/* Panel Resumen (Derecha) */}
          <div className="flex-1 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[16px] p-[24px] md:p-[32px] flex flex-col justify-center gap-[24px] min-h-[300px]">
            {!selectedNode ? (
              <div className="flex flex-col items-center justify-center opacity-40 text-center gap-[12px] my-auto">
                <FolderOpen size={48} />
                <p className="text-[14px]">Selecciona una carpeta o archivo a la izquierda<br/>para previsualizar las finanzas.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full animate-fade-in-up">
                <div className="flex items-center gap-[12px] mb-[24px]">
                  {selectedNode.type !== 'DAY' ? <FolderOpen className="text-[var(--accent)]" size={24} /> : <FileCheck className="text-[var(--accent)]" size={24} />}
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)]">{selectedNode.title}</h2>
                  <span className="ml-auto bg-[var(--accent-muted)] border border-[var(--accent-border)] px-[12px] py-[4px] rounded-full text-[12px] text-[var(--accent)] font-medium">
                    {selectedNode.type === 'YEAR' ? 'Reporte Anual' : selectedNode.type === 'MONTH' ? 'Reporte Mensual' : 'Cierre Diario'}
                  </span>
                </div>

                <div className="bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[12px] p-[20px] grid grid-cols-1 md:grid-cols-2 gap-[20px]">
                  <div className="flex flex-col">
                    <span className="text-[12px] text-[var(--text-secondary)] uppercase">Operaciones Cubiertas</span>
                    <span className="text-[20px] font-medium mt-[4px]">{selectedNode.cycles.length} Ciclos</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] text-[var(--text-secondary)] uppercase">Volumen Movido (Venta)</span>
                    <span className="text-[20px] font-medium text-[var(--text-primary)] mt-[4px]">
                      {selectedNode.cycles.reduce((acc, c) => acc + (c.usdt_vendido || 0), 0).toFixed(2)} USDT
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] text-[var(--text-secondary)] uppercase">Ganancia Consolidada VES</span>
                    <span className="text-[24px] font-bold text-[var(--accent)] mt-[4px]">
                      Bs. {selectedNode.cycles.reduce((acc, c) => acc + (c.ganancia_ves || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] text-[var(--text-secondary)] uppercase">Ganancia Consolidada USDT</span>
                    <span className="text-[24px] font-bold text-[#f5b800] mt-[4px]">
                      {selectedNode.cycles.reduce((acc, c) => acc + (c.ganancia_usdt || 0), 0).toFixed(2)} USDT
                    </span>
                  </div>
                </div>

                <div className="mt-auto pt-[32px] flex justify-end border-t border-[var(--border-strong)]">
                  <Button onClick={generatePDF} className="px-[32px] py-[16px] text-[15px] shadow-[0_0_20px_rgba(37,99,235,0.15)] btn-primary">
                    <Download size={20} />
                    Descargar Modelo PDF
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Vista Historial Mensual Guardado en BD */
        <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[16px] flex flex-col overflow-hidden animate-fade-in-up">
          <div className="px-[24px] py-[20px] border-b border-[var(--border)] bg-[var(--bg-surface-3)] flex items-center gap-[12px]">
            <Database className="text-[var(--accent)]" size={24} />
            <div>
              <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Registros de Cierre Mensual</h2>
              <p className="text-[13px] text-[var(--text-secondary)] mt-[2px]">Capturas automáticas del rendimiento de cada mes.</p>
            </div>
          </div>
          
          <div className="p-[24px]">
            {loadingSnapshots ? (
              <div className="flex items-center justify-center py-[60px] text-[var(--text-tertiary)] gap-[12px]">
                <div className="w-[20px] h-[20px] border-[2px] border-[var(--text-tertiary)] border-t-transparent rounded-full animate-spin" />
                <span>Cargando base de datos...</span>
              </div>
            ) : snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-[60px] text-center gap-[12px]">
                <Calendar size={48} className="text-[var(--text-tertiary)] opacity-50" />
                <p className="text-[14px] text-[var(--text-secondary)]">No se han generado cierres de mes automáticos aún.<br/>El primer cierre se guardará el día 1 del próximo mes.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[16px]">
                {snapshots.map(snap => {
                  const [y, m] = snap.yearMonth.split('-');
                  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                  const monthLabel = monthNames[parseInt(m) - 1];
                  
                  return (
                    <div key={snap.id} className="bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[12px] p-[20px] flex flex-col gap-[16px] hover:border-[var(--accent-border)] transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-[8px]">
                          <Calendar size={18} className="text-[var(--accent)]" />
                          <h3 className="text-[16px] font-bold">{monthLabel} {y}</h3>
                        </div>
                        <span className="text-[11px] font-mono text-[var(--text-tertiary)] bg-[var(--bg-surface-1)] px-[6px] py-[2px] rounded border border-[var(--border)]">
                          {snap.totalCycles} Ciclos
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-[12px]">
                        <div className="flex justify-between items-center border-b border-[var(--border)] pb-[8px]">
                          <span className="text-[13px] text-[var(--text-secondary)]">Ganancia USDT</span>
                          <span className={`text-[15px] font-bold ${snap.profitUsdt > 0 ? 'text-[var(--profit)]' : snap.profitUsdt < 0 ? 'text-[var(--loss)]' : 'text-[var(--text-primary)]'}`}>
                            {snap.profitUsdt > 0 ? '+' : ''}{snap.profitUsdt.toFixed(2)} USDT
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center border-b border-[var(--border)] pb-[8px]">
                          <span className="text-[13px] text-[var(--text-secondary)]">Ganancia VES</span>
                          <span className="text-[14px] font-medium">Bs. {snap.profitVes.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] text-[var(--text-secondary)]">Volumen Manejado</span>
                          <span className="text-[14px] font-medium text-[var(--text-tertiary)]">{snap.volumeUsdt.toFixed(2)} USDT</span>
                        </div>
                      </div>
                      
                      <div className="mt-auto pt-[12px] text-[10px] text-[var(--text-tertiary)] text-right">
                        Guardado el: {new Date(snap.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
