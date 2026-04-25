import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, LineSeries, HistogramSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineData } from 'lightweight-charts';

interface SpreadData {
  time: number;
  buy: number;
  sell: number;
  spread: number;
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

export const SpreadChart: React.FC<SpreadChartProps> = ({ liveData }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  const buySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sellSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [legendData, setLegendData] = useState({
    buy: 0,
    sell: 0,
    spread: 0,
    status: 'Simulado (Histórico)'
  });

  const [historyGenerated, setHistoryGenerated] = useState(false);

  const generateHistory = useCallback((endBuy: number, endSell: number, endTimestamp: number) => {
    const data: SpreadData[] = [];
    let currentBuy = endBuy;
    let currentSell = endSell;
    
    // Generar hacia atrás, así el punto más reciente es exactamente el liveData actual
    for (let i = 0; i <= 288; i++) {
      const time = Math.floor(endTimestamp / 1000) - (i * 300); // Hacia atrás en el tiempo
      
      const isGreenVol = Math.random() > 0.5;
      const volume = Math.floor(Math.random() * 100000) + 10000;

      data.unshift({
        time,
        buy: Number(currentBuy.toFixed(2)),
        sell: Number(currentSell.toFixed(2)),
        spread: Number((currentSell - currentBuy).toFixed(2)),
        volume,
        isGreenVol
      });

      // Variar el precio para el siguiente punto (más atrás en el tiempo)
      const buyChange = (Math.random() - 0.48) * 0.5; 
      const sellChange = (Math.random() - 0.52) * 0.5;
      
      currentBuy = Math.max(620, currentBuy - buyChange);
      currentSell = Math.max(currentBuy + 1.5, currentSell - sellChange);
    }
    return data;
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(197, 203, 206, 0.8)' },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.8)',
        timeVisible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
        shiftVisibleRangeOnNewBar: true,
      },
      autoSize: true,
    });

    chartRef.current = chart;

    const buySeries = chart.addSeries(LineSeries, {
      color: '#089981',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });
    buySeriesRef.current = buySeries;

    const sellSeries = chart.addSeries(LineSeries, {
      color: '#f23645',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });
    sellSeriesRef.current = sellSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });
    volumeSeriesRef.current = volumeSeries;

    chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current!.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current!.clientHeight
      ) {
        // Fuera del gráfico, mantenemos el último dato en vivo si existe
        if (liveData) {
            setLegendData({
                buy: liveData.topBuy,
                sell: liveData.topSell,
                spread: liveData.spread,
                status: 'EN VIVO 🔴'
            });
        }
      } else {
        const buyPrice = param.seriesData.get(buySeries) as LineData | undefined;
        const sellPrice = param.seriesData.get(sellSeries) as LineData | undefined;
        
        if (buyPrice && sellPrice) {
          setLegendData({
            buy: buyPrice.value,
            sell: sellPrice.value,
            spread: Number((sellPrice.value - buyPrice.value).toFixed(2)),
            status: 'Datos Históricos'
          });
        }
      }
    });

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [generateHistory]);

  // Actualizar con datos en VIVO
  useEffect(() => {
    if (!liveData || !buySeriesRef.current || !sellSeriesRef.current || !volumeSeriesRef.current) return;

    // Si no hemos generado el historial, lo generamos primero conectando con el punto actual
    if (!historyGenerated) {
        const mockData = generateHistory(liveData.topBuy, liveData.topSell, liveData.timestamp - 15000); // El historial termina 15s antes del punto actual
        
        buySeriesRef.current.setData(mockData.map(d => ({ time: d.time as any, value: d.buy })));
        sellSeriesRef.current.setData(mockData.map(d => ({ time: d.time as any, value: d.sell })));
        volumeSeriesRef.current.setData(mockData.map(d => ({
          time: d.time as any,
          value: d.volume,
          color: d.isGreenVol ? 'rgba(8, 153, 129, 0.5)' : 'rgba(242, 54, 69, 0.5)'
        })));
        
        setHistoryGenerated(true);
    }

    const time = Math.floor(liveData.timestamp / 1000) as any;

    buySeriesRef.current.update({ time, value: liveData.topBuy });
    sellSeriesRef.current.update({ time, value: liveData.topSell });
    
    // Volumen combinado para el indicador (o el que queramos resaltar)
    const isGreenVol = liveData.buyVolume > liveData.sellVolume;
    volumeSeriesRef.current.update({
        time,
        value: liveData.buyVolume + liveData.sellVolume,
        color: isGreenVol ? 'rgba(8, 153, 129, 0.8)' : 'rgba(242, 54, 69, 0.8)'
    });

    setLegendData({
        buy: liveData.topBuy,
        sell: liveData.topSell,
        spread: Number((liveData.topSell - liveData.topBuy).toFixed(2)),
        status: 'EN VIVO 🔴'
    });

  }, [liveData, historyGenerated, generateHistory]);

  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#131722] rounded-[12px] overflow-hidden border border-[var(--border)] shadow-xl flex flex-col">
      <div className="absolute top-[16px] left-[20px] z-10 flex flex-col pointer-events-none">
        <div className="flex items-center gap-[16px] text-[14px] font-semibold">
          <span className="text-white flex items-center gap-2">
            Compra / Venta USDT
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${legendData.status.includes('VIVO') ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-gray-500/20 text-gray-400'}`}>
                {legendData.status}
            </span>
          </span>
          
          <div className="flex items-center gap-[6px]">
            <span className="text-[#089981]">Compra</span>
            <span className="text-[#089981]">{legendData.buy.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-[6px]">
            <span className="text-[#f23645]">Venta</span>
            <span className="text-[#f23645]">{legendData.sell.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-[6px] ml-[8px]">
            <span className="text-[#787b86]">Spread</span>
            <span className="text-[#787b86]">{legendData.spread.toFixed(2)} Bs</span>
          </div>
        </div>
      </div>

      <div className="absolute top-[12px] right-[20px] z-10 flex gap-[6px]">
        {['1H', '6h', '1D', '1S'].map((tf) => (
          <button 
            key={tf}
            className={`px-[12px] py-[4px] rounded-[6px] text-[12px] font-medium transition-colors pointer-events-auto
              ${tf === '1D' 
                ? 'bg-[#ffe400] text-black hover:bg-[#ffed4a]' 
                : 'text-[#d1d4dc] hover:bg-[#2a2e39]'}`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div ref={chartContainerRef} className="flex-1 w-full" />
    </div>
  );
};
