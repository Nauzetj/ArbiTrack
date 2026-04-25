import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SpreadChart } from './SpreadChart';
import { X, BarChart3, AlertCircle, RefreshCw, Clock } from 'lucide-react';

// ─── Bancos venezolanos soportados por Binance P2P ────────────────────────────

const BANKS = [
  { id: 'BancoDeVenezuela', label: 'BDV' },
  { id: 'Banesco',          label: 'Banesco' },
  { id: 'Mercantil',        label: 'Mercantil' },
  { id: 'Provincial',       label: 'Provincial' },
  { id: 'BancoPlaza',       label: 'Bco. Plaza' },
  { id: 'Bicentenario',     label: 'Bicentenario' },
  { id: 'Bancaribe',        label: 'Bancaribe' },
  { id: 'BFC',              label: 'BFC' },
] as const;

// ─── Payload para Binance P2P ────────────────────────────────────────────────

const buildPayload = (tradeType: 'BUY' | 'SELL', payTypes: string[]) => ({
  fiat: 'VES',
  page: 1,
  rows: 10,
  tradeType,
  asset: 'USDT',
  countries: [],
  proMerchantAds: false,
  shieldMerchantAds: false,
  filterType: 'all',
  periods: [],
  additionalKycVerifyFilter: 0,
  publisherType: null,
  payTypes,
  classifies: ['mass', 'profession', 'merchant'],
});

// ─── Fetch de un lado del libro (BUY o SELL) ─────────────────────────────────

interface AdEntry {
  price: number;
  volume: number;
  advertiser: string;
  minAmount: number;
  maxAmount: number;
}

const fetchSide = async (tradeType: 'BUY' | 'SELL', payTypes: string[]): Promise<AdEntry[]> => {
  const res = await fetch('/api/binance_p2p_market', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(tradeType, payTypes)),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  // Respuesta de Vercel serverless (objeto con topBuy)
  if (json.topBuy !== undefined) {
    return tradeType === 'BUY' ? json.orderBook.buy : json.orderBook.sell;
  }

  // Respuesta cruda de Binance via proxy Vite
  if (json.code === '000000' && Array.isArray(json.data) && json.data.length) {
    return json.data.map((item: any) => ({
      price:       parseFloat(item.adv.price),
      volume:      parseFloat(item.adv.tradableQuantity),
      advertiser:  item.advertiser.nickName,
      minAmount:   parseFloat(item.adv.minSingleTransAmount),
      maxAmount:   parseFloat(item.adv.dynamicMaxSingleTransAmount),
    }));
  }
  return [];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtTime = (d: Date) =>
  d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ─── Componente ───────────────────────────────────────────────────────────────

export const LiveMarketPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [liveData,    setLiveData]    = useState<any>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdate,  setLastUpdate]  = useState<Date | null>(null);
  const [ticking,     setTicking]     = useState(false);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);

  // Precios anteriores para indicadores ↑↓
  const prevSell = useRef<Map<string, number>>(new Map());
  const prevBuy  = useRef<Map<string, number>>(new Map());

  const fetchData = useCallback(async () => {
    setTicking(true);
    try {
      const [buyAds, sellAds] = await Promise.all([
        fetchSide('BUY',  selectedBanks),
        fetchSide('SELL', selectedBanks),
      ]);

      if (!buyAds.length || !sellAds.length) {
        setError('Sin anuncios con ese filtro. Prueba otro banco.');
        setTicking(false);
        return;
      }

      // Guardar snapshot anterior para flechas
      prevBuy.current  = new Map(liveData?.orderBook?.buy?.map((a: AdEntry) => [a.advertiser, a.price]) ?? []);
      prevSell.current = new Map(liveData?.orderBook?.sell?.map((a: AdEntry) => [a.advertiser, a.price]) ?? []);

      const topBuy  = buyAds[0];
      const topSell = sellAds[0];

      setLiveData({
        timestamp: Date.now(),
        topBuy:    topBuy.price,
        topSell:   topSell.price,
        spread:    topSell.price - topBuy.price,
        buyVolume: topBuy.volume,
        sellVolume: topSell.volume,
        orderBook: { buy: buyAds, sell: sellAds },
      });
      setLastUpdate(new Date());
      setError(null);
    } catch (err: any) {
      console.error('LiveMarket Error:', err);
      setError('Error conectando a Binance P2P. Reintentando...');
    } finally {
      setTicking(false);
    }
  }, [selectedBanks, liveData]);

  // Polling cada 5 segundos — milimétrico en tiempo real
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBanks]);

  const toggleBank = (bankId: string) => {
    setSelectedBanks(prev =>
      prev.includes(bankId) ? prev.filter(b => b !== bankId) : [...prev, bankId]
    );
  };

  // ─── Render de cada fila del order book ───────────────────────────────────
  const renderRow = (ad: AdEntry, side: 'buy' | 'sell', maxVol: number, i: number) => {
    const prevMap  = side === 'buy' ? prevBuy.current : prevSell.current;
    const prev     = prevMap.get(ad.advertiser);
    const delta    = prev !== undefined ? ad.price - prev : 0;
    const barColor = side === 'sell' ? 'rgba(242,54,69,0.12)' : 'rgba(8,153,129,0.12)';
    const priceColor = side === 'sell' ? '#f23645' : '#089981';
    const barPct   = Math.min(100, (ad.volume / maxVol) * 100);

    return (
      <div
        key={`${side}-${i}`}
        className="relative flex justify-between items-center py-[6px] px-[10px] rounded hover:bg-white/5 transition-colors text-[12px]"
      >
        {/* Barra de volumen de fondo */}
        <div
          className={`absolute inset-y-0 ${side === 'sell' ? 'left-0' : 'right-0'} rounded`}
          style={{ width: `${barPct}%`, background: barColor }}
        />

        {/* Precio + flecha + nickname */}
        <div className="flex flex-col z-10">
          <div className="flex items-center gap-1">
            <span className="font-mono font-bold" style={{ color: priceColor }}>
              {fmt(ad.price)}
            </span>
            {delta > 0.001 && <span className="text-[10px] text-[#089981]">▲</span>}
            {delta < -0.001 && <span className="text-[10px] text-[#f23645]">▼</span>}
          </div>
          <span className="text-[10px] text-[#6b7280] truncate max-w-[110px]">{ad.advertiser}</span>
        </div>

        {/* Volumen + límites */}
        <div className="flex flex-col items-end z-10">
          <span className="font-mono text-white">{fmt(ad.volume)}<span className="text-[#6b7280] ml-0.5 text-[10px]">USDT</span></span>
          <span className="text-[10px] text-[#6b7280]">
            {(ad.minAmount / 1_000_000 >= 1
              ? (ad.minAmount / 1_000_000).toFixed(1) + 'M'
              : (ad.minAmount / 1_000).toFixed(0) + 'K')} –{' '}
            {(ad.maxAmount / 1_000_000 >= 1
              ? (ad.maxAmount / 1_000_000).toFixed(1) + 'M'
              : (ad.maxAmount / 1_000).toFixed(0) + 'K')} Bs
          </span>
        </div>
      </div>
    );
  };

  const sellAds: AdEntry[] = liveData?.orderBook?.sell ?? [];
  const buyAds:  AdEntry[] = liveData?.orderBook?.buy  ?? [];
  const maxSellVol = Math.max(...sellAds.map(a => a.volume), 1);
  const maxBuyVol  = Math.max(...buyAds.map(a => a.volume),  1);

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,14,26,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1260px] h-[85vh] flex flex-col bg-[#131722] rounded-[20px] shadow-2xl overflow-hidden border border-[#34d399]/20 relative"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 0 0 1px rgba(52,211,153,0.08), 0 28px 56px rgba(0,0,0,0.6)' }}
      >
        {/* Línea superior decorativa */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,#34d399,transparent)' }} />

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] shrink-0 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(52,211,153,0.1)] border border-[#34d399]/20 text-[#34d399]">
              <BarChart3 size={15} />
            </div>
            <div>
              <h2 className="font-bold text-[15px] text-white leading-tight">Mercado P2P en Vivo · VES/USDT</h2>
              {error ? (
                <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle size={11} />{error}</p>
              ) : (
                <p className="text-[11px] text-[#34d399] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
                  Actualizando cada 5s
                  {lastUpdate && (
                    <span className="text-[#6b7280] flex items-center gap-0.5 ml-1">
                      <Clock size={10} /> {fmtTime(lastUpdate)}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={ticking}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#34d399] hover:bg-[#34d399]/10 border border-[#34d399]/20 transition-all disabled:opacity-40"
            >
              <RefreshCw size={12} className={ticking ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-[#6b7280] hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">

          {/* ── CHART ── */}
          <div className="flex-1 p-4 min-h-[400px] min-w-0">
            <SpreadChart liveData={liveData} />
          </div>

          {/* ── ORDER BOOK ── */}
          <div className="w-full lg:w-[360px] border-t lg:border-t-0 lg:border-l border-[var(--border)] flex flex-col overflow-hidden bg-[#0f131e]">

            {/* Filtros por banco */}
            <div className="p-3 border-b border-[var(--border)] bg-[#131722] shrink-0">
              <p className="text-[11px] text-[#6b7280] mb-2 font-medium uppercase tracking-wide">Filtrar por banco</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedBanks([])}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all border ${
                    selectedBanks.length === 0
                      ? 'bg-white/10 text-white border-white/20'
                      : 'text-[#6b7280] border-[#2a2e39] hover:border-white/20 hover:text-white'
                  }`}
                >
                  Todos
                </button>
                {BANKS.map(bank => (
                  <button
                    key={bank.id}
                    onClick={() => toggleBank(bank.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all border ${
                      selectedBanks.includes(bank.id)
                        ? 'bg-[#34d399]/15 text-[#34d399] border-[#34d399]/30'
                        : 'text-[#6b7280] border-[#2a2e39] hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {bank.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Libro de órdenes scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* Cabecera columnas */}
              <div className="flex justify-between text-[10px] text-[#4b5563] font-medium uppercase tracking-wide px-3 pt-3 pb-1 sticky top-0 bg-[#0f131e] z-10">
                <span>Precio · Trader</span>
                <span>Vol. · Límites</span>
              </div>

              {/* VENDEDORES (SELL) */}
              <div className="px-1.5">
                <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                  <div className="w-2 h-2 rounded-full bg-[#f23645]" />
                  <span className="text-[11px] font-bold text-[#f23645]">Vendedores — Tú compras USDT</span>
                </div>
                {!sellAds.length ? (
                  <div className="flex flex-col gap-1.5 px-2 pb-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-9 bg-[#1a1e2a] rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  sellAds.map((ad, i) => renderRow(ad, 'sell', maxSellVol, i))
                )}
              </div>

              {/* Spread central */}
              {liveData && (
                <div className="mx-3 my-2 py-2 px-3 rounded-lg bg-[#1a1e2a] border border-[#2a2e39] flex justify-between items-center">
                  <span className="text-[11px] text-[#6b7280]">Spread mercado</span>
                  <span className="font-mono font-bold text-white text-[13px]">
                    {fmt(liveData.spread)}
                    <span className="text-[10px] text-[#6b7280] ml-1">Bs</span>
                  </span>
                </div>
              )}

              {/* COMPRADORES (BUY) */}
              <div className="px-1.5 pb-3">
                <div className="flex items-center gap-1.5 px-2 pb-1">
                  <div className="w-2 h-2 rounded-full bg-[#089981]" />
                  <span className="text-[11px] font-bold text-[#089981]">Compradores — Tú vendes USDT</span>
                </div>
                {!buyAds.length ? (
                  <div className="flex flex-col gap-1.5 px-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-9 bg-[#1a1e2a] rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  buyAds.map((ad, i) => renderRow(ad, 'buy', maxBuyVol, i))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
