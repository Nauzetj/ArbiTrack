import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, LineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineData, SeriesMarker, Time } from 'lightweight-charts';
import { useAppStore } from '../../store/useAppStore';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SpreadData {
  time: number;
  buy: number;
  sell: number;
  volume: number;
  isGreenVol: boolean;
}

interface SpreadChartProps {
  liveData?: {
    timestamp: number;
    topBuy: number;
    topSell: number;
    spread: number;
    buyVolume: number;
    sellVolume: number;
  } | null;
}

// ─── Timeframes ───────────────────────────────────────────────────────────────

const TIMEFRAMES = [
  { label: '1H', seconds: 3_600 },
  { label: '6H', seconds: 21_600 },
  { label: '1D', seconds: 86_400 },
  { label: '1S', seconds: 604_800 },
  { label: '1M', seconds: 2_592_000 },
] as const;

type TF = (typeof TIMEFRAMES)[number]['label'];

// ─── Componente ───────────────────────────────────────────────────────────────

export const SpreadChart: React.FC<SpreadChartProps> = ({ liveData }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef          = useRef<IChartApi | null>(null);
  const buySeriesRef      = useRef<ISeriesApi<'Line'> | null>(null);
  const sellSeriesRef     = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef   = useRef<ISeriesApi<'Histogram'> | null>(null);
  
  const buyMarkersPluginRef = useRef<any>(null);
  const sellMarkersPluginRef = useRef<any>(null);

  const [legend, setLegend]             = useState({ buy: 0, sell: 0, spread: 0, isLive: false });
  const [selectedTF, setSelectedTF]     = useState<TF>('1D');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const orders = useAppStore(state => state.orders);

  // Genera ~30 días de historial simulado anclado al punto actual
  const generateHistory = useCallback((endBuy: number, endSell: number, anchorTs: number): SpreadData[] => {
    const POINTS   = 8_640; // 30 d × 288 puntos/día (5 min c/u)
    const INTERVAL = 300;
    const data: SpreadData[] = [];
    let b = endBuy;
    let s = endSell;

    for (let i = POINTS; i >= 0; i--) {
      data.push({
        time:       Math.floor(anchorTs / 1000) - i * INTERVAL,
        buy:        +b.toFixed(2),
        sell:       +s.toFixed(2),
        volume:     Math.floor(Math.random() * 90_000) + 10_000,
        isGreenVol: Math.random() > 0.5,
      });
      b = Math.max(610, b + (Math.random() - 0.48) * 0.5);
      s = Math.max(b + 1.5, s + (Math.random() - 0.52) * 0.5);
    }
    return data;
  }, []);

  // Aplica rango visible al timeframe elegido
  const applyTimeframe = useCallback((tf: TF) => {
    if (!chartRef.current) return;
    const now = Math.floor(Date.now() / 1000);
    const sec = TIMEFRAMES.find(t => t.label === tf)!.seconds;
    try {
      chartRef.current.timeScale().setVisibleRange({
        from: (now - sec) as any,
        to:   now as any,
      });
    } catch (_) { /* chart puede no tener datos aún */ }
  }, []);

  // ── Inicializar chart ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42,46,57,0.5)' },
        horzLines: { color: 'rgba(42,46,57,0.5)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(197,203,206,0.8)' },
      timeScale: {
        borderColor: 'rgba(197,203,206,0.8)',
        timeVisible: true,
        shiftVisibleRangeOnNewBar: true,
        fixRightEdge: true,
        rightOffset: 0,
      },
      autoSize: true,
    });

    chartRef.current = chart;

    buySeriesRef.current = chart.addSeries(LineSeries, {
      color: '#089981', lineWidth: 2,
      crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
    });
    buyMarkersPluginRef.current = createSeriesMarkers(buySeriesRef.current, []);

    sellSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#f23645', lineWidth: 2,
      crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
    });
    sellMarkersPluginRef.current = createSeriesMarkers(sellSeriesRef.current, []);

    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    // Crosshair → actualiza leyenda
    chart.subscribeCrosshairMove((param) => {
      const w = chartContainerRef.current;
      if (!param.time || !w || !param.point) return;
      if (param.point.x < 0 || param.point.x > w.clientWidth ||
          param.point.y < 0 || param.point.y > w.clientHeight) return;

      const bp = param.seriesData.get(buySeriesRef.current!)  as LineData | undefined;
      const sp = param.seriesData.get(sellSeriesRef.current!) as LineData | undefined;
      if (bp && sp) {
        setLegend({ buy: bp.value, sell: sp.value, spread: +(sp.value - bp.value).toFixed(2), isLive: false });
      }
    });

    const onResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cargar historial + actualizar datos en vivo ────────────────────────────
  useEffect(() => {
    if (!liveData || !buySeriesRef.current || !sellSeriesRef.current || !volumeSeriesRef.current) return;

    if (!historyLoaded) {
      const hist = generateHistory(liveData.topBuy, liveData.topSell, liveData.timestamp - 15_000);
      buySeriesRef.current.setData(hist.map(d => ({ time: d.time as any, value: d.buy })));
      sellSeriesRef.current.setData(hist.map(d => ({ time: d.time as any, value: d.sell })));
      volumeSeriesRef.current.setData(hist.map(d => ({
        time: d.time as any, value: d.volume,
        color: d.isGreenVol ? 'rgba(8,153,129,0.5)' : 'rgba(242,54,69,0.5)',
      })));
      setHistoryLoaded(true);
      return; // el useEffect de [historyLoaded, selectedTF] aplicará el rango
    }

    // Actualizar punto en vivo
    const time = Math.floor(liveData.timestamp / 1000) as any;
    buySeriesRef.current.update({ time, value: liveData.topBuy });
    sellSeriesRef.current.update({ time, value: liveData.topSell });
    const green = liveData.buyVolume > liveData.sellVolume;
    volumeSeriesRef.current.update({
      time, value: liveData.buyVolume + liveData.sellVolume,
      color: green ? 'rgba(8,153,129,0.8)' : 'rgba(242,54,69,0.8)',
    });

    setLegend({ buy: liveData.topBuy, sell: liveData.topSell, spread: +(liveData.topSell - liveData.topBuy).toFixed(2), isLive: true });
  }, [liveData, historyLoaded, generateHistory]);

  // ── Aplicar timeframe cada vez que cambia (o cuando carga el historial) ────
  useEffect(() => {
    if (!historyLoaded) return;
    applyTimeframe(selectedTF);
  }, [selectedTF, historyLoaded, applyTimeframe]);

  // ── Agregar marcadores de órdenes reales del usuario ─────────────────────────
  useEffect(() => {
    if (!historyLoaded || !buySeriesRef.current || !sellSeriesRef.current) return;

    const buyMarkers: SeriesMarker<Time>[] = [];
    const sellMarkers: SeriesMarker<Time>[] = [];

    // Filtrar órdenes de los últimos 7 días y ordenarlas cronológicamente
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    const validOrders = orders
      .filter(o => o.orderStatus === 'COMPLETED' && new Date(o.createTime_utc).getTime() >= sevenDaysAgo)
      .sort((a, b) => new Date(a.createTime_utc).getTime() - new Date(b.createTime_utc).getTime());

    validOrders.forEach(o => {
      const ts = Math.floor(new Date(o.createTime_utc).getTime() / 1000) as Time;
      // En P2P Binance: 
      // "BUY" = Usuario compra USDT (paga Bs) -> Demanda
      // "SELL" = Usuario vende USDT (recibe Bs) -> Oferta
      const isBuy = o.tradeType === 'BUY';
      
      const marker: SeriesMarker<Time> = {
        time: ts,
        position: isBuy ? 'belowBar' : 'aboveBar',
        color: isBuy ? '#089981' : '#f23645',
        shape: isBuy ? 'arrowUp' : 'arrowDown',
        text: `${isBuy ? 'Compra' : 'Venta'} ${o.amount} U @ ${o.unitPrice.toFixed(2)}`,
        size: 1,
      };

      if (isBuy) {
        buyMarkers.push(marker);
      } else {
        sellMarkers.push(marker);
      }
    });

    try {
      if (buyMarkersPluginRef.current) {
        buyMarkersPluginRef.current.setMarkers(buyMarkers);
      }
      if (sellMarkersPluginRef.current) {
        sellMarkersPluginRef.current.setMarkers(sellMarkers);
      }
    } catch (e) {
      console.warn('No se pudieron establecer los marcadores:', e);
    }
  }, [orders, historyLoaded]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#131722] rounded-[12px] overflow-hidden border border-[var(--border)] shadow-xl flex flex-col">

      {/* ── FILA 1: Título + badge  |  Botones de timeframe ── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0 gap-4">

        {/* Título + badge */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white font-semibold text-[14px] whitespace-nowrap">
            Compra / Venta USDT
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${
            legend.isLive ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-gray-600/30 text-gray-400'
          }`}>
            {legend.isLive ? 'EN VIVO 🔴' : 'Cargando...'}
          </span>
        </div>

        {/* Timeframe buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {TIMEFRAMES.map(({ label }) => (
            <button
              key={label}
              onClick={() => setSelectedTF(label)}
              className={`min-w-[36px] px-2.5 py-1 rounded-[6px] text-[12px] font-semibold transition-all ${
                selectedTF === label
                  ? 'bg-[#ffe400] text-black'
                  : 'text-[#787b86] hover:text-white hover:bg-[#2a2e39]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FILA 2: Valores Compra / Venta / Spread ── */}
      <div className="flex items-center gap-5 px-5 pb-3 shrink-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-[#6b7280]">Compra</span>
          <span className="text-[15px] font-mono font-bold text-[#089981]">
            {legend.buy > 0 ? legend.buy.toFixed(2) : '—'}
          </span>
        </div>
        <div className="w-px h-4 bg-[rgba(197,203,206,0.15)]" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-[#6b7280]">Venta</span>
          <span className="text-[15px] font-mono font-bold text-[#f23645]">
            {legend.sell > 0 ? legend.sell.toFixed(2) : '—'}
          </span>
        </div>
        <div className="w-px h-4 bg-[rgba(197,203,206,0.15)]" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-[#6b7280]">Spread</span>
          <span className="text-[15px] font-mono font-bold text-[#d1d4dc]">
            {legend.spread > 0 ? legend.spread.toFixed(2) : '—'}
            <span className="text-[11px] font-normal text-[#6b7280] ml-1">Bs</span>
          </span>
        </div>
      </div>

      {/* ── CHART ── */}
      <div ref={chartContainerRef} className="flex-1 w-full min-h-0" />
    </div>
  );
};
