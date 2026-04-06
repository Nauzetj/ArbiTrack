import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Order } from '../../types';
import { Search, X, ChevronUp, ChevronDown, ListFilter, Download } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { saveOrder, recalculateCycleMetrics, getCyclesForUser, getOrdersForUser } from '../../services/dbOperations';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type SortField = 'createTime_local' | 'counterPartNickName' | 'tradeType' | 'unitPrice' | 'totalPrice' | 'amount' | 'cycleId';
type SortDirection = 'asc' | 'desc' | null;

export const TransactionsTable: React.FC = () => {
  const { orders, currentUser, activeCycle, setOrders, setCycles, setActiveCycle } = useAppStore();

  // Filtros
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');

  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>('createTime_local');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') setSortDirection(null);
      else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
  };

  // Filtrado reactivo (tiempo real)
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.orderStatus !== 'COMPLETED') return false; // Solo completadas tienen validez contable real en la vista final por defecto
      
      const matchSearch = search ? o.counterPartNickName.toLowerCase().includes(search.toLowerCase()) : true;
      
      // La fecha viene como string "DD/MM/YYYY, HH:MM:SS" o similar desde Binance. Parsear o comparar string.
      // Ya que el guardado local tiene createTime_local. Mejor comparamos la fecha ISO si la tuvieramos.
      // Pero createTime_utc es "ISO string UTC" según el type definition.
      let matchDate = true;
      if (dateFrom || dateTo) {
         try {
           const orderDate = new Date(o.createTime_utc).getTime();
           if (dateFrom) {
             const fromDate = new Date(dateFrom).getTime();
             if (orderDate < fromDate) matchDate = false;
           }
           if (dateTo) {
             const toDate = new Date(dateTo);
             toDate.setHours(23, 59, 59, 999);
             if (orderDate > toDate.getTime()) matchDate = false;
           }
         } catch(e) {}
      }

      const matchType = typeFilter === 'ALL' ? true : o.tradeType === typeFilter;
      const matchStatus = statusFilter === 'ALL' 
        ? true 
        : statusFilter === 'ASSIGNED' 
          ? o.cycleId !== null 
          : o.cycleId === null;

      return matchSearch && matchDate && matchType && matchStatus;
    });
  }, [orders, search, dateFrom, dateTo, typeFilter, statusFilter]);

  // Ordenamiento
  const sortedOrders = useMemo(() => {
    if (!sortDirection) return filteredOrders;

    return [...filteredOrders].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Excepciones de parseo
      if (sortField === 'createTime_local') {
         aVal = new Date(a.createTime_utc).getTime();
         bVal = new Date(b.createTime_utc).getTime();
      }
      if (sortField === 'cycleId') {
         aVal = a.cycleId ? 1 : 0;
         bVal = b.cycleId ? 1 : 0;
      }

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOrders, sortField, sortDirection]);

  const activeTags = [
    search && `Nombre: ${search}`,
    dateFrom && `Desde: ${dateFrom}`,
    dateTo && `Hasta: ${dateTo}`,
    typeFilter !== 'ALL' && `Tipo: ${typeFilter}`,
    statusFilter !== 'ALL' && `Estado: ${statusFilter === 'ASSIGNED' ? 'Asignado' : 'Sin Asignar'}`
  ].filter(Boolean);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field || !sortDirection) return null;
    return sortDirection === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />;
  };

  const getBadgeStyle = (type: string, value: string) => {
    if (type === 'type') {
      return value === 'BUY' ? 'bg-[#00e5c3]/10 text-[#00e5c3] border-[#00e5c3]/20' : 'bg-[#ff4e4e]/10 text-[#ff4e4e] border-[#ff4e4e]/20';
    }
    if (type === 'status') {
      return value === 'ASSIGNED' ? 'bg-[#4e8dff]/10 text-[#4e8dff] border-[#4e8dff]/20' : 'bg-[#ffae4e]/10 text-[#ffae4e] border-[#ffae4e]/20';
    }
    return '';
  };

  // Función de asignación rápida para integrarla en la misma tabla si pones un botón
  const handleAssign = async (order: Order) => {
    if (!activeCycle || !currentUser) return;
    const updatedOrder = { ...order, cycleId: activeCycle.id };
    await saveOrder(updatedOrder);
    
    // Almacenamiento y recalculado global (como en el Topbar/Dashboard)
    await recalculateCycleMetrics(activeCycle.id, currentUser.id);
    const freshOrders = await getOrdersForUser(currentUser.id);
    const freshCycles = await getCyclesForUser(currentUser.id);
    setOrders(freshOrders);
    setCycles(freshCycles);
    setActiveCycle(freshCycles.find((c: any) => c.status === 'En curso') || null);
  };

  const handleUnassign = async (order: Order) => {
    if (!currentUser || !order.cycleId) return;
    const oldCycleId = order.cycleId;
    const updatedOrder = { ...order, cycleId: null };
    await saveOrder(updatedOrder);
    
    await recalculateCycleMetrics(oldCycleId, currentUser.id);
    const freshOrders = await getOrdersForUser(currentUser.id);
    const freshCycles = await getCyclesForUser(currentUser.id);
    setOrders(freshOrders);
    setCycles(freshCycles);
    setActiveCycle(freshCycles.find((c: any) => c.status === 'En curso') || null);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('Reporte de Transacciones Financieras', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);
    
    const tableColumn = ["Fecha", "Nombre", "Tipo", "Tasa", "Precio (Bs)", "Monto (USDT)", "Estado"];
    const tableRows = sortedOrders.map(o => [
      new Date(o.createTime_utc).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
      o.counterPartNickName,
      o.tradeType,
      o.unitPrice.toFixed(2),
      o.totalPrice.toFixed(2),
      o.amount.toFixed(2),
      o.cycleId ? `Asignado (${o.cycleId.slice(0,4)})` : 'Sin Asignar'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 229, 195], textColor: 0 }, // Using primary accent color
    });

    doc.save(`orders_export_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="w-full bg-[var(--bg-surface-2)] rounded-[12px] border border-[var(--border)] overflow-hidden shadow-none flex flex-col font-sans">
      
      {/* Header and Filters */}
      <div className="p-[16px] border-b border-[var(--border)] bg-[var(--bg-surface)] flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--accent)] flex items-center gap-[8px]">
            <ListFilter size={16} />
            Transacciones Financieras
          </h2>
          <div className="flex items-center gap-[12px]">
            {activeTags.length > 0 && (
              <button 
                onClick={resetFilters}
                className="text-[12px] flex items-center gap-[4px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors px-[8px] py-[4px] rounded hover:bg-[var(--bg-surface-3)]"
              >
                <X size={14} /> Limpiar Filtros
              </button>
            )}
            <button onClick={exportPDF} className="text-[12px] flex items-center gap-[6px] bg-[var(--bg-surface-3)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-4)] transition-colors px-[12px] py-[6px] rounded-[6px]">
               <Download size={14} /> Exportar PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-[12px]">
          {/* Search */}
          <div className="relative col-span-1 md:col-span-1 border-[0.5px] border-[var(--border)] rounded-[8px] bg-[var(--bg-surface-3)] focus-within:border-[var(--accent)] transition-colors">
            <Search size={14} className="absolute left-[10px] top-[10px] text-[var(--text-tertiary)]" />
            <input 
              type="text" 
              placeholder="Buscar contraparte..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-[13px]text-[var(--text-primary)] py-[8px] pl-[32px] pr-[12px] outline-none placeholder:text-[var(--text-tertiary)]"
            />
          </div>

          <div className="col-span-1 md:col-span-2 flex items-center gap-[8px]">
             <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="flex-1 bg-[var(--bg-surface-3)] border-[0.5px] border-[var(--border)] rounded-[8px] text-[13px] px-[12px] py-[8px] text-[var(--text-secondary)] outline-none focus:border-[var(--accent)] transition-colors" />
             <span className="text-[var(--text-tertiary)] text-[11px] font-medium uppercase">HASTA</span>
             <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="flex-1 bg-[var(--bg-surface-3)] border-[0.5px] border-[var(--border)] rounded-[8px] text-[13px] px-[12px] py-[8px] text-[var(--text-secondary)] outline-none focus:border-[var(--accent)] transition-colors" />
          </div>

          <div className="col-span-1 border-[0.5px] border-[var(--border)] rounded-[8px] overflow-hidden">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="w-full h-full bg-[var(--bg-surface-3)] text-[13px] text-[var(--text-secondary)] px-[12px] py-[8px] outline-none border-none cursor-pointer">
              <option value="ALL">Tipos: Todos</option>
              <option value="BUY">Compras (BUY)</option>
              <option value="SELL">Ventas (SELL)</option>
            </select>
          </div>

          <div className="col-span-1 border-[0.5px] border-[var(--border)] rounded-[8px] overflow-hidden">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="w-full h-full bg-[var(--bg-surface-3)] text-[13px] text-[var(--text-secondary)] px-[12px] py-[8px] outline-none border-none cursor-pointer">
              <option value="ALL">Estado: Todos</option>
              <option value="ASSIGNED">Asignado a Ciclo</option>
              <option value="UNASSIGNED">Sin Asignar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Virtual Scroll Area - Height Max */}
      <div className="max-h-[380px] overflow-x-auto overflow-y-auto bg-[var(--bg-surface-2)] custom-scrollbar">
        <table className="w-full text-left text-[13px] border-collapse min-w-[900px]">
          <thead className="sticky top-0 bg-[var(--bg-surface-3)] text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] shadow-[0_1px_0_var(--border)] z-10">
            <tr>
              <th className="py-[12px] px-[16px] font-medium cursor-pointer hover:text-[var(--accent)] transition-colors" onClick={() => handleSort('createTime_local')}>Fecha <SortIcon field="createTime_local" /></th>
              <th className="py-[12px] px-[16px] font-medium cursor-pointer hover:text-[var(--accent)] transition-colors" onClick={() => handleSort('counterPartNickName')}>Nombre <SortIcon field="counterPartNickName" /></th>
              <th className="py-[12px] px-[16px] font-medium cursor-pointer hover:text-[var(--accent)] transition-colors" onClick={() => handleSort('tradeType')}>Tipo <SortIcon field="tradeType" /></th>
              <th className="py-[12px] px-[16px] font-medium cursor-pointer hover:text-[var(--accent)] transition-colors" onClick={() => handleSort('unitPrice')}>Tasa <SortIcon field="unitPrice" /></th>
              <th className="py-[12px] px-[16px] font-medium cursor-pointer hover:text-[var(--accent)] transition-colors" onClick={() => handleSort('totalPrice')}>Precio (Bs) <SortIcon field="totalPrice" /></th>
              <th className="py-[12px] px-[16px] font-medium cursor-pointer hover:text-[var(--accent)] transition-colors" onClick={() => handleSort('amount')}>Monto (USDT) <SortIcon field="amount" /></th>
              <th className="py-[12px] px-[16px] font-medium cursor-pointer hover:text-[var(--accent)] transition-colors text-right" onClick={() => handleSort('cycleId')}>Estado <SortIcon field="cycleId" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]/50">
            {sortedOrders.length > 0 ? (
              sortedOrders.map((o) => {
                const assignedText = o.cycleId ? `Asignado (${o.cycleId.slice(0,4)})` : 'Sin Asignar';
                const isAssigned = o.cycleId !== null;
                
                return (
                  <tr key={o.id} className="hover:bg-[var(--bg-surface-3)]/50 transition-colors group">
                    <td className="py-[10px] px-[16px] whitespace-nowrap text-[12px] text-[var(--text-secondary)]">
                      {new Date(o.createTime_utc).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-[10px] px-[16px] text-[var(--text-primary)] font-medium">
                      {o.counterPartNickName}
                    </td>
                    <td className="py-[10px] px-[16px]">
                      <Badge variant="neutral" className={`border text-[10px] uppercase font-bold py-[2px] px-[6px] ${getBadgeStyle('type', o.tradeType)}`}>
                        {o.tradeType}
                      </Badge>
                    </td>
                    <td className="py-[10px] px-[16px] font-mono text-[var(--text-secondary)]">
                      {o.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-[10px] px-[16px] font-mono text-[var(--text-secondary)]">
                      {o.totalPrice.toFixed(2)}
                    </td>
                    <td className="py-[10px] px-[16px] font-mono text-[var(--text-primary)] font-medium">
                      {o.amount.toFixed(2)}
                    </td>
                    <td className="py-[10px] px-[16px] text-right">
                      <div className="flex items-center justify-end gap-[8px]">
                        <span className={`text-[11px] px-[6px] py-[2px] rounded border ${getBadgeStyle('status', isAssigned ? 'ASSIGNED' : 'UNASSIGNED')}`}>
                          {assignedText}
                        </span>
                        
                        {/* Interactive mini-action */}
                        {isAssigned ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleUnassign(o); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[#ffae4e] bg-[#ffae4e]/10 px-[4px] py-[2px] rounded hover:bg-[#ffae4e]/20"
                            title="Desvincular del ciclo actual"
                          >
                            ×
                          </button>
                        ) : (
                          activeCycle && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleAssign(o); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[var(--accent)] bg-[var(--accent)]/10 px-[4px] py-[2px] rounded hover:bg-[var(--accent)]/20"
                              title="Asignar al Ciclo Activo"
                            >
                              +
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-[40px] text-center text-[var(--text-secondary)]">
                  <div className="flex flex-col items-center gap-[8px]">
                    <ListFilter size={24} className="text-[var(--border-strong)]" />
                    <span>No hay transacciones que coincidan con los filtros.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-surface-3)] p-[12px] px-[16px] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
        <div className="flex items-center gap-[6px]">
          <span>Mostrando <strong className="text-[var(--text-primary)]">{sortedOrders.length}</strong> de <strong className="text-[var(--text-primary)]">{orders.filter(o => o.orderStatus==='COMPLETED').length}</strong> registros</span>
        </div>
        <div className="flex items-center gap-[8px] max-w-[50%] overflow-hidden">
           {activeTags.map((tag, i) => (
             <span key={i} className="whitespace-nowrap px-[6px] py-[2px] bg-[var(--bg-surface-4)] border-[0.5px] border-[var(--border-strong)] rounded text-[10px]">
               {tag}
             </span>
           ))}
        </div>
      </div>

    </div>
  );
};
