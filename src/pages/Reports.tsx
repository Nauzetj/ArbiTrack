import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const Reports: React.FC = () => {
  const { cycles } = useAppStore();
  const [activeTab, setActiveTab] = useState<'DIARIO' | 'MENSUAL' | 'ANUAL'>('ANUAL');
  
  const todayISO = new Date().toISOString().split('T')[0];
  const thisMonthStr = todayISO.slice(0, 7); // YYYY-MM
  const thisYearStr = todayISO.slice(0, 4);

  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [selectedMonth, setSelectedMonth] = useState(thisMonthStr);
  const [selectedYear, setSelectedYear] = useState(thisYearStr);

  const completedCycles = cycles.filter(c => c.status === 'Completado');

  // Derive available options from data
  const years = Array.from(new Set(completedCycles.map(c => new Date(c.closedAt!).getFullYear().toString()))).sort().reverse();
  if (years.length === 0) years.push(thisYearStr);

  const months = Array.from(new Set(completedCycles.map(c => c.closedAt!.slice(0, 7)))).sort().reverse();
  if (months.length === 0) months.push(thisMonthStr);

  // Filter cycles based on active tab
  let periodCycles: typeof completedCycles = [];
  let periodTitle = '';
  
  if (activeTab === 'DIARIO') {
    periodCycles = completedCycles.filter(c => c.closedAt!.startsWith(selectedDate));
    periodTitle = `Reporte de Caja Diario - ${selectedDate}`;
  } else if (activeTab === 'MENSUAL') {
    periodCycles = completedCycles.filter(c => c.closedAt!.startsWith(selectedMonth));
    periodTitle = `Cierre Contable Mensual - ${selectedMonth}`;
  } else if (activeTab === 'ANUAL') {
    periodCycles = completedCycles.filter(c => c.closedAt!.startsWith(selectedYear));
    periodTitle = `Reporte Fiscal ISLR - Ejercicio ${selectedYear}`;
  }

  const profitUsdt = periodCycles.reduce((sum, c) => sum + c.ganancia_usdt, 0);
  const profitVes = periodCycles.reduce((sum, c) => sum + c.ganancia_ves, 0);
  const avgBcvRate = periodCycles.length > 0 ? (periodCycles.reduce((sum, c) => sum + c.tasa_bcv_dia, 0) / periodCycles.length) : 0;

  const generatePDF = () => {
    // Modo Apaisado (Landscape) para que quepan bien todas las columnas financieras
    const doc = new jsPDF('l'); 
    doc.setFont("helvetica", "bold");
    doc.text(periodTitle, 14, 20);
    
    // Ingresos y Costos extraidos de los ciclos completados
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
      `${new Date(c.closedAt!).toLocaleDateString()} (#${c.cycleNumber})`,
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
      "Generado automáticamente por el Sistema ArbiTrack de control P2P - Cifras expresadas en Bolívares, calculadas en base al Volumen Emparejado Operativo.",
      14,
      finalY + 20
    );

    const safeTitle = periodTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`${safeTitle}.pdf`);
  };

  return (
    <div className="flex flex-col gap-[24px] max-w-[1200px] mx-auto pb-[40px] animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold">Reportes y Analíticas</h1>
      </div>

      <div className="flex border-b border-[var(--border)]">
        {['DIARIO', 'MENSUAL', 'ANUAL'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t as any)}
            className={`px-[24px] py-[12px] text-[14px] font-medium transition-colors border-b-[3px] ${
              activeTab === t 
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-muted)]' 
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-3)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-[24px] animate-fade-in-up">
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[12px]">
           <div className="flex flex-wrap items-center gap-[12px]">
             {activeTab === 'DIARIO' && (
               <>
                 <label className="text-[13px] text-[var(--text-secondary)] font-medium">Seleccionar Día:</label>
                 <input 
                   type="date" 
                   value={selectedDate}
                   onChange={e => setSelectedDate(e.target.value)}
                   className="bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[8px] px-[12px] py-[6px] text-[14px] outline-none text-[var(--text-primary)]"
                 />
               </>
             )}
             {activeTab === 'MENSUAL' && (
               <>
                 <label className="text-[13px] text-[var(--text-secondary)] font-medium">Seleccionar Mes:</label>
                 <select 
                   value={selectedMonth}
                   onChange={e => setSelectedMonth(e.target.value)}
                   className="bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[8px] px-[12px] py-[6px] text-[14px] outline-none text-[var(--text-primary)]"
                 >
                   {months.map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
               </>
             )}
             {activeTab === 'ANUAL' && (
               <>
                 <label className="text-[13px] text-[var(--text-secondary)] font-medium">Ejercicio Fiscal:</label>
                 <select 
                   value={selectedYear}
                   onChange={e => setSelectedYear(e.target.value)}
                   className="bg-[var(--bg-surface-3)] border border-[var(--border-strong)] rounded-[8px] px-[12px] py-[6px] text-[14px] outline-none text-[var(--text-primary)]"
                 >
                   {years.map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
               </>
             )}
           </div>
         </div>

         <div className="bg-[var(--accent-muted)] border border-[var(--accent-border)] rounded-[16px] p-[24px] md:p-[32px] flex flex-col sm:flex-row sm:items-center justify-between shadow-[0_0_20px_rgba(0,229,195,0.06)] gap-[20px]">
           <div className="flex flex-col gap-[16px]">
             <h2 className="text-[14px] text-[var(--accent)] font-bold uppercase tracking-[1px]">Resumen ({activeTab})</h2>
             <div className="flex items-end gap-[40px] flex-wrap">
               <div className="flex flex-col">
                 <span className="text-[11px] text-[var(--text-secondary)] uppercase">Ganancia Bruta VES</span>
                 <span className="mono text-[28px] md:text-[36px] font-medium text-[var(--text-primary)] leading-none">Bs. {profitVes.toFixed(2)}</span>
               </div>
               <div className="flex flex-col pb-[4px]">
                 <span className="text-[11px] text-[var(--text-secondary)] uppercase">Equivalencia USDT</span>
                 <span className="mono text-[20px] font-medium text-[var(--text-tertiary)]">{profitUsdt.toFixed(2)} USDT</span>
               </div>
             </div>
             <p className="text-[12px] text-[var(--text-secondary)] mt-[8px]">Basado en {periodCycles.length} ciclos cerrados. Tasa BCV ponderada del periodo: Bs. {avgBcvRate.toFixed(2)}.</p>
           </div>
           
           <Button onClick={generatePDF} className="h-fit px-[24px] py-[12px] w-full sm:w-auto">
             <Download size={18} />
             Generar PDF
           </Button>
         </div>
         
         <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[16px] p-[32px] flex flex-col gap-[16px] items-center justify-center min-h-[200px]">
           {periodCycles.length > 0 ? (
             <p className="text-[var(--text-secondary)] text-[14px]">Se han encontrado {periodCycles.length} ciclos cerrados en este periodo. Exporta el PDF para ver el desglose detallado.</p>
           ) : (
             <p className="text-[var(--text-tertiary)] text-[14px]">No hay operaciones registradas en este periodo.</p>
           )}
         </div>
      </div>
    </div>

  );
};
