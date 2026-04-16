import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { Download, Folder, FolderOpen, FileCheck, ChevronRight, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Cycle } from '../types';

type TreeNode = {
  name: string;
  type: 'YEAR' | 'MONTH' | 'DAY';
  label: string;
  cycles: Cycle[];
  children?: Record<string, TreeNode>;
};

export const Reports: React.FC = () => {
  const { cycles } = useAppStore();
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = useState<{ type: string; title: string; cycles: Cycle[] } | null>(null);

  const completedCycles = cycles.filter(c => c.status === 'Completado');

  // Build Tree
  const treeData = useMemo(() => {
    const root: Record<string, TreeNode> = {};
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    completedCycles.forEach(c => {
      // Usar closedAt (fecha de cierre) - mantener como estaba
      const dateStr = c.closedAt!.split('T')[0];
      const [y, m, d] = dateStr.split('-');
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
    const profitUsdt = periodCycles.reduce((sum, c) => sum + c.ganancia_usdt, 0);
    const profitVes = periodCycles.reduce((sum, c) => sum + c.ganancia_ves, 0);
    const avgBcvRate = periodCycles.length > 0 ? (periodCycles.reduce((sum, c) => sum + c.tasa_bcv_dia, 0) / periodCycles.length) : 0;

    const doc = new jsPDF('l'); 
    doc.setFont("helvetica", "bold");
    doc.text(periodTitle, 14, 20);
    
    const ingresosVentasVES = periodCycles.reduce((sum, c) => sum + c.ves_recibido, 0);
    const egresosComprasVES = periodCycles.reduce((sum, c) => sum + c.ves_pagado, 0);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Ingresos Brutos por Ventas: Bs. ${ingresosVentasVES.toFixed(2)} VES`, 14, 40);
    doc.text(`Costo de Ventas (Recompras): Bs. ${egresosComprasVES.toFixed(2)} VES`, 100, 40);
    doc.text(`Ganancia Operativa Neta: Bs. ${profitVes.toFixed(2)} VES`, 14, 50);
    doc.text(`Ganancia Equivalente en USD: ${profitUsdt.toFixed(2)} USDT`, 100, 50);
    doc.text(`Tasa BCV del Periodo (Referencial): Bs. ${avgBcvRate.toFixed(2)} VES/USD`, 14, 60);

    const tableData = periodCycles.map(c => [
      `${new Date(c.closedAt!).toLocaleDateString()} (#${c.cycleNumber.toString().slice(-4)})`,
      `${c.usdt_vendido.toFixed(2)} USDT`,
      `${c.tasa_venta_prom.toFixed(2)} Bs`,
      `${c.tasa_compra_prom.toFixed(2)} Bs`,
      `${c.ganancia_usdt.toFixed(2)} USDT`,
      `${c.ganancia_ves.toFixed(2)} Bs`,
      `${c.tasa_bcv_dia.toFixed(2)} Bs`
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
      </div>

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
                    {selectedNode.cycles.reduce((acc, c) => acc + c.usdt_vendido, 0).toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] text-[var(--text-secondary)] uppercase">Ganancia Consolidada VES</span>
                  <span className="text-[24px] font-bold text-[var(--accent)] mt-[4px]">
                    Bs. {selectedNode.cycles.reduce((acc, c) => acc + c.ganancia_ves, 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] text-[var(--text-secondary)] uppercase">Ganancia Consolidada USDT</span>
                  <span className="text-[24px] font-bold text-[#f5b800] mt-[4px]">
                    {selectedNode.cycles.reduce((acc, c) => acc + c.ganancia_usdt, 0).toFixed(2)} USDT
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
    </div>
  );
};
