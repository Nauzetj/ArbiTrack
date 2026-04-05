import React from 'react';
import { TransactionsTable } from '../components/dashboard/TransactionsTable';

export const Orders: React.FC = () => {
  return (
    <div className="flex flex-col gap-[24px] max-w-[1400px] mx-auto pb-[40px] animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold">Listado de Órdenes</h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-[4px]">Todas las transacciones de P2P sincronizadas de Binance.</p>
        </div>
      </div>

      <div className="w-full relative">
         <TransactionsTable />
      </div>
      
    </div>
  );
};
