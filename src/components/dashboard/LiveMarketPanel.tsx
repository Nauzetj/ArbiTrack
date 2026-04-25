import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SpreadChart } from './SpreadChart';
import { X, BarChart3, AlertCircle, RefreshCw, Clock, BotMessageSquare, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Motor de análisis de presión de mercado ─────────────────────────────────

interface MarketAnalysis {
  score: number;          // -1 (bajista fuerte) → +1 (alcista fuerte)
  signal: 'ALCISTA' | 'BAJISTA' | 'NEUTRAL';
  confidence: number;     // 0-100
  volImbalance: number;   // % diferencia volumen
  topConcentration: number;
  spreadPct: number;
  buyVol: number;
  sellVol: number;
  summary: string;
}

function analyzeMarket(buyAds: AdEntry[], sellAds: AdEntry[]): MarketAnalysis | null {
  if (!buyAds.length || !sellAds.length) return null;

  const totalBuy  = buyAds.reduce((s, a) => s + a.volume, 0);
  const totalSell = sellAds.reduce((s, a) => s + a.volume, 0);
  const volImb    = (totalBuy - totalSell) / (totalBuy + totalSell); // -1 a 1

  const topBuyVol  = buyAds[0].volume;
  const topSellVol = sellAds[0].volume;
  const topConc    = (topBuyVol - topSellVol) / (topBuyVol + topSellVol);

  const countImb   = (buyAds.length - sellAds.length) / (buyAds.length + sellAds.length);

  const spreadPct  = sellAds[0].price > 0
    ? ((sellAds[0].price - buyAds[0].price) / buyAds[0].price) * 100
    : 0;

  // Score ponderado
  const score = volImb * 0.45 + topConc * 0.35 + countImb * 0.20;
  const confidence = Math.min(100, Math.round(Math.abs(score) * 100 * 2.2));

  let signal: MarketAnalysis['signal'] = 'NEUTRAL';
  let summary = '';

  if (score > 0.18) {
    signal = 'ALCISTA';
    summary = confidence > 60
      ? `Presión compradora dominante (${(volImb * 100).toFixed(0)}% más vol. de compra). Alta probabilidad de que el precio de compra suba en los próximos minutos.`
      : `Ligera presión compradora. El libro muestra más demanda que oferta, precio podría subir gradualmente.`;
  } else if (score < -0.18) {
    signal = 'BAJISTA';
    summary = confidence > 60
      ? `Exceso de oferta detectado (${(Math.abs(volImb) * 100).toFixed(0)}% más vol. vendedor). El precio podría ceder a la baja pronto.`
      : `Ligera presión vendedora. Más anuncios de venta que de compra activos en este momento.`;
  } else {
    summary = `Mercado equilibrado. Spread del ${spreadPct.toFixed(3)}%. Monitorea el nivel superior del libro para detectar la próxima ruptura.`;
  }

  return { score, signal, confidence, volImbalance: volImb, topConcentration: topConc, spreadPct, buyVol: totalBuy, sellVol: totalSell, summary };
}

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

  // Caso 1: Vercel devuelve array directo (modo proxy con tradeType en body)
  if (Array.isArray(json)) return json;

  // Caso 2: Vercel devuelve objeto legacy {topBuy, orderBook}
  if (json.topBuy !== undefined && json.orderBook) {
    return tradeType === 'BUY' ? json.orderBook.buy : json.orderBook.sell;
  }

  // Caso 3: Proxy Vite en dev — respuesta raw de Binance
  if (json.code === '000000' && Array.isArray(json.data) && json.data.length) {
    return json.data.map((item: any) => ({
      price:      parseFloat(item.adv.price),
      volume:     parseFloat(item.adv.tradableQuantity),
      advertiser: item.advertiser.nickName,
      minAmount:  parseFloat(item.adv.minSingleTransAmount),
      maxAmount:  parseFloat(item.adv.dynamicMaxSingleTransAmount),
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
  const [botOpen,     setBotOpen]     = useState(true);

  // Precios anteriores para indicadores ↑↓
  const prevSell = useRef<Map<string, number>>(new Map());
  const prevBuy  = useRef<Map<string, number>>(new Map());

  // Análisis de mercado recalculado en cada tick
  const analysis = useMemo(() => analyzeMarket(
    liveData?.orderBook?.buy  ?? [],
    liveData?.orderBook?.sell ?? [],
  ), [liveData]);

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

            {/* ── BOT DE ANÁLISIS ── */}
            <div className="border-b border-[var(--border)] bg-[#0d1117] shrink-0">
              <button
                onClick={() => setBotOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BotMessageSquare size={14} className="text-[#a78bfa]" />
                  <span className="text-[12px] font-semibold text-[#a78bfa]">Asistente IA · Presión de Mercado</span>
                  {analysis && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      analysis.signal === 'ALCISTA' ? 'bg-[#089981]/20 text-[#089981]' :
                      analysis.signal === 'BAJISTA' ? 'bg-[#f23645]/20 text-[#f23645]' :
                      'bg-white/10 text-gray-400'
                    }`}>{analysis.signal}</span>
                  )}
                </div>
                <ChevronDown size={13} className={`text-gray-500 transition-transform ${botOpen ? 'rotate-180' : ''}`} />
              </button>

              {botOpen && analysis && (
                <div className="px-3 pb-3 flex flex-col gap-2">

                  {/* Barra de presión */}
                  <div className="relative h-5 rounded-full bg-[#1a1e2a] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-1/2 rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.abs(analysis.score) * 50}%`,
                        background: analysis.signal === 'ALCISTA' ? '#089981' : analysis.signal === 'BAJISTA' ? '#f23645' : '#6b7280',
                        left: analysis.score >= 0 ? '50%' : `${50 - Math.abs(analysis.score) * 50}%`,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                      {analysis.signal === 'ALCISTA' ? '▲' : analysis.signal === 'BAJISTA' ? '▼' : '—'}
                      {' '}{analysis.confidence}% confianza
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Vol. Compra', val: analysis.buyVol.toFixed(0) + ' U', color: '#089981' },
                      { label: 'Vol. Venta',  val: analysis.sellVol.toFixed(0) + ' U', color: '#f23645' },
                      { label: 'Spread %',    val: analysis.spreadPct.toFixed(3) + '%', color: '#d1d4dc' },
                    ].map(m => (
                      <div key={m.label} className="bg-[#131722] rounded p-1.5 text-center">
                        <div className="font-mono font-bold text-[11px]" style={{ color: m.color }}>{m.val}</div>
                        <div className="text-[9px] text-[#6b7280] mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Icono señal + resumen */}
                  <div className="flex items-start gap-2 bg-[#131722] rounded-lg p-2.5">
                    {analysis.signal === 'ALCISTA' ? <TrendingUp  size={14} className="text-[#089981] mt-0.5 shrink-0" /> :
                     analysis.signal === 'BAJISTA' ? <TrendingDown size={14} className="text-[#f23645] mt-0.5 shrink-0" /> :
                                                     <Minus        size={14} className="text-gray-400 mt-0.5 shrink-0" />}
                    <p className="text-[11px] text-[#d1d4dc] leading-relaxed">{analysis.summary}</p>
                  </div>

                  <p className="text-[9px] text-[#4b5563] text-center">Análisis basado en order book en tiempo real · No es asesoramiento financiero</p>
                </div>
              )}
            </div>

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
