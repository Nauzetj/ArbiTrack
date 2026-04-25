import React, { useState, useEffect } from 'react';
import { SpreadChart } from './SpreadChart';
import { X, BarChart3, AlertCircle } from 'lucide-react';

export const LiveMarketPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [liveData, setLiveData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const fetchMarketData = async () => {
      try {
        const response = await fetch('/api/binance_p2p_market');
        if (!response.ok) {
          throw new Error('No se pudo obtener datos del mercado');
        }
        const data = await response.json();
        setLiveData(data);
        setError(null);
      } catch (err: any) {
        console.error('LiveMarket Error:', err);
        setError('Error conectando a Binance P2P. Reintentando...');
      }
    };

    // Primer fetch inmediato
    fetchMarketData();

    // Polling cada 15 segundos
    intervalId = setInterval(fetchMarketData, 15000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-[16px]"
      style={{ background: 'rgba(10,20,35,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[1200px] h-[80vh] flex flex-col bg-[#131722] rounded-[20px] shadow-2xl overflow-hidden border border-[#34d399]/20 relative"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 0 0 1px rgba(52,211,153,0.1), 0 24px 48px rgba(0,0,0,0.55)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #34d399, transparent)' }}/>
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-[16px] md:p-[20px] border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-[10px]">
            <div className="w-[32px] h-[32px] rounded-[8px] flex items-center justify-center bg-[rgba(52,211,153,0.12)] border border-[#34d399]/25 text-[#34d399]">
              <BarChart3 size={16}/>
            </div>
            <div>
                <h2 className="font-bold text-[16px] text-white">Mercado P2P en Vivo (VES/USDT)</h2>
                {error ? (
                    <p className="text-[12px] text-red-400 flex items-center gap-1"><AlertCircle size={12}/> {error}</p>
                ) : (
                    <p className="text-[12px] text-[#34d399] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse"></span>
                        Conectado a Binance - Actualizando cada 15s
                    </p>
                )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center hover:bg-[var(--bg-surface-3)] text-[var(--text-tertiary)] hover:text-white transition-colors"
          >
            <X size={16}/>
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-[0]">
          {/* CHART AREA */}
          <div className="flex-1 p-[16px] md:p-[20px] min-h-[400px]">
             <SpreadChart liveData={liveData} />
          </div>

          {/* ORDER BOOK (Depth Panel) */}
          <div className="w-full lg:w-[350px] border-t lg:border-t-0 lg:border-l border-[var(--border)] bg-[#1a1e29] flex flex-col overflow-y-auto">
            <div className="p-[16px] border-b border-[var(--border)] bg-[#131722]">
                <h3 className="font-semibold text-[14px] text-white">Profundidad de Mercado (Top 5)</h3>
                <p className="text-[12px] text-gray-400">Anuncios reales en Binance P2P</p>
            </div>

            <div className="flex-1 p-[16px] flex flex-col gap-[20px]">
                {/* SELLERS (Venden USDT, compramos nosotros) - RED */}
                <div>
                    <div className="flex justify-between text-[11px] text-gray-500 mb-[8px] px-[4px]">
                        <span>Vendedor (Su Precio)</span>
                        <span>Volumen / Límites</span>
                    </div>
                    <div className="flex flex-col gap-[4px]">
                        {!liveData?.orderBook?.sell ? (
                            <div className="animate-pulse flex flex-col gap-2">
                                {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-[#2a2e39] rounded"></div>)}
                            </div>
                        ) : liveData.orderBook.sell.map((ad: any, i: number) => (
                            <div key={i} className="flex justify-between items-center p-[8px] rounded hover:bg-[#2a2e39] transition-colors relative group">
                                <div className="absolute left-0 top-0 bottom-0 bg-[#f23645]/10 rounded-l" style={{ width: `${Math.min(100, (ad.volume / 5000) * 100)}%`}}></div>
                                <div className="flex flex-col relative z-10">
                                    <span className="text-[#f23645] font-mono font-medium">{ad.price.toFixed(2)} Bs</span>
                                    <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{ad.advertiser}</span>
                                </div>
                                <div className="flex flex-col items-end relative z-10">
                                    <span className="text-white text-[12px]">{ad.volume.toFixed(2)} USDT</span>
                                    <span className="text-[10px] text-gray-500">{ad.minAmount}-{ad.maxAmount} Bs</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="h-[1px] bg-[var(--border)] w-full"></div>

                {/* BUYERS (Compran USDT, vendemos nosotros) - GREEN */}
                <div>
                    <div className="flex justify-between text-[11px] text-gray-500 mb-[8px] px-[4px]">
                        <span>Comprador (Su Precio)</span>
                        <span>Volumen / Límites</span>
                    </div>
                    <div className="flex flex-col gap-[4px]">
                        {!liveData?.orderBook?.buy ? (
                            <div className="animate-pulse flex flex-col gap-2">
                                {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-[#2a2e39] rounded"></div>)}
                            </div>
                        ) : liveData.orderBook.buy.map((ad: any, i: number) => (
                            <div key={i} className="flex justify-between items-center p-[8px] rounded hover:bg-[#2a2e39] transition-colors relative group">
                                <div className="absolute right-0 top-0 bottom-0 bg-[#089981]/10 rounded-r" style={{ width: `${Math.min(100, (ad.volume / 5000) * 100)}%`}}></div>
                                <div className="flex flex-col relative z-10">
                                    <span className="text-[#089981] font-mono font-medium">{ad.price.toFixed(2)} Bs</span>
                                    <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{ad.advertiser}</span>
                                </div>
                                <div className="flex flex-col items-end relative z-10">
                                    <span className="text-white text-[12px]">{ad.volume.toFixed(2)} USDT</span>
                                    <span className="text-[10px] text-gray-500">{ad.minAmount}-{ad.maxAmount} Bs</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
