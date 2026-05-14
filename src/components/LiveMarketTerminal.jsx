import { createSignal, onMount, onCleanup, For, Show, createEffect, createMemo } from 'solid-js';
import { createChart, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { TechnicalAnalysis } from '../utils/technicalIndicators';

// Top 50 popular coins with Binance USDT pairs
const TOP_50 = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'TRXUSDT', 'DOTUSDT', 'LINKUSDT',
  'AVAXUSDT', 'MATICUSDT', 'LTCUSDT', 'ATOMUSDT', 'UNIUSDT', 'XLMUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT', 'OPUSDT',
  'ARBUSDT', 'NEARUSDT', 'INJUSDT', 'SUIUSDT', 'STXUSDT', 'RUNEUSDT', 'IMXUSDT', 'LDOUSDT', 'SEIUSDT', 'TIAUSDT',
  'RENDERUSDT', 'FETUSDT', 'ARUSDT', 'ALGOUSDT', 'VETUSDT', 'ICPUSDT', 'HBARUSDT', 'EGLDUSDT', 'SANDUSDT', 'MANAUSDT',
  'AXSUSDT', 'GALAUSDT', 'APEUSDT', 'FTMUSDT', 'JASMYUSDT', 'RNDRUSDT', 'WLDUSDT', 'JUPUSDT', 'PENDLEUSDT', 'ONDOUSDT'
];

const TIMEFRAMES = [
  { label: '1m', value: '1m', description: '1 Minute' },
  { label: '5m', value: '5m', description: '5 Minutes' },
  { label: '15m', value: '15m', description: '15 Minutes' },
  { label: '1h', value: '1h', description: '1 Hour' },
];

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPrice = (v) => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
const fmtVolume = (v) => {
  const n = Number(v);
  if (v == null || isNaN(n)) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
};
const fmtPct = (v) => (v == null || isNaN(v)) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

// ============================================
// PROFESSIONAL CANDLESTICK CHART COMPONENT
// ============================================
function ProfessionalChart(props) {
  let containerRef;
  let chart;
  let candlestickSeries;
  let volumeSeries;
  let ma7Series;
  let ma25Series;
  let rsiSeries;
  let bbUpperSeries;
  let bbMiddleSeries;
  let bbLowerSeries;

  const updateData = () => {
    if (!candlestickSeries || !props.klines || props.klines.length === 0) return;

    // Deduplicate and format candlestick data
    const seenTimes = new Set();
    const candleData = [];
    const volumeData = [];

    // Sort klines first to ensure we keep the latest version of any duplicate timestamp
    const sortedKlines = [...props.klines].sort((a, b) => a.time - b.time);

    for (const d of sortedKlines) {
      if (!seenTimes.has(d.time)) {
        seenTimes.add(d.time);
        candleData.push({
          time: d.time,
          open: Number(d.open),
          high: Number(d.high),
          low: Number(d.low),
          close: Number(d.close),
        });
        volumeData.push({
          time: d.time,
          value: Number(d.volume),
          color: d.close >= d.open ? 'rgba(14,203,129,0.5)' : 'rgba(246,70,93,0.5)'
        });
      }
    }

    // Calculate Moving Averages
    const calculateMA = (data, period) => {
      const ma = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period - 1) continue;
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close;
        }
        ma.push({ time: data[i].time, value: sum / period });
      }
      return ma;
    };

    const ma7 = TechnicalAnalysis.ema(candleData, 7);
    const ma25 = TechnicalAnalysis.ema(candleData, 25);

    candlestickSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    ma7Series.setData(ma7);
    ma25Series.setData(ma25);

    // Dynamic Indicators
    if (props.indicators?.rsi) {
      const rsiData = TechnicalAnalysis.rsi(candleData, 14);
      if (!rsiSeries) {
        rsiSeries = chart.addSeries(LineSeries, {
          color: '#e91e63',
          lineWidth: 1,
          priceScaleId: 'rsi',
          title: 'RSI(14)',
        });
        chart.priceScale('rsi').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0.1 },
          borderVisible: false,
        });
      }
      rsiSeries.setData(rsiData);
    } else if (rsiSeries) {
      chart.removeSeries(rsiSeries);
      rsiSeries = null;
    }

    if (props.indicators?.bollinger) {
      const bbData = TechnicalAnalysis.bollinger(candleData, 20, 2);
      if (!bbUpperSeries) {
        bbUpperSeries = chart.addSeries(LineSeries, { color: 'rgba(33, 150, 243, 0.4)', lineWidth: 1, lastValueVisible: false });
        bbMiddleSeries = chart.addSeries(LineSeries, { color: 'rgba(33, 150, 243, 0.2)', lineWidth: 1, lastValueVisible: false, lineStyle: 2 });
        bbLowerSeries = chart.addSeries(LineSeries, { color: 'rgba(33, 150, 243, 0.4)', lineWidth: 1, lastValueVisible: false });
      }
      bbUpperSeries.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
      bbMiddleSeries.setData(bbData.map(d => ({ time: d.time, value: d.middle })));
      bbLowerSeries.setData(bbData.map(d => ({ time: d.time, value: d.lower })));
    } else if (bbUpperSeries) {
      chart.removeSeries(bbUpperSeries);
      chart.removeSeries(bbMiddleSeries);
      chart.removeSeries(bbLowerSeries);
      bbUpperSeries = bbMiddleSeries = bbLowerSeries = null;
    }

    // Fit content
    chart.timeScale().fitContent();
  };

  onMount(() => {
    if (!containerRef) return;

    chart = createChart(containerRef, {
      layout: {
        background: { color: '#0a0a0a' },
        textColor: 'rgba(255, 255, 255, 0.6)',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(255, 255, 255, 0.2)',
          labelBackgroundColor: '#1a1a1a',
          labelVisible: true,
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.2)',
          labelBackgroundColor: '#1a1a1a',
          labelVisible: true,
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.2 },
        alignLabels: true,
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: props.timeframe === '1m',
        fixLeftEdge: true,
        fixRightEdge: true,
        barSpacing: 8,
        minBarSpacing: 4,
      },
      handleScroll: {
        vertTouchDrag: false,
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Volume series (histogram at bottom)
    volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
      visible: false,
    });

    // Candlestick series
    candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderUpColor: '#0ecb81',
      borderDownColor: '#f6465d',
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
      priceLineVisible: true,
      priceLineColor: 'rgba(255, 255, 255, 0.3)',
      priceLineStyle: 2,
      lastValueVisible: true,
    });

    // Moving Average 7
    ma7Series = chart.addSeries(LineSeries, {
      color: 'rgba(255, 193, 7, 0.8)',
      lineWidth: 1,
      title: 'MA7',
      lastValueVisible: false,
    });

    // Moving Average 25
    ma25Series = chart.addSeries(LineSeries, {
      color: 'rgba(33, 150, 243, 0.8)',
      lineWidth: 1,
      title: 'MA25',
      lastValueVisible: false,
    });

    updateData();

    // LIVE TICK UPDATE EFFECT
    // This makes the candle move instantly per trade tick
    createEffect(() => {
      const lp = props.lastPrice;
      if (!candlestickSeries || !lp || !props.klines || props.klines.length === 0) return;
      
      const lastK = props.klines[props.klines.length - 1];
      const price = Number(lp.price);
      
      // Update the current candle with the latest tick
      candlestickSeries.update({
        time: lastK.time,
        open: Number(lastK.open),
        high: Math.max(Number(lastK.high), price),
        low: Math.min(Number(lastK.low), price),
        close: price,
      });

      // Also update the volume series for the current tick
      volumeSeries.update({
        time: lastK.time,
        value: Number(lastK.volume),
      });
    });

    const handleResize = () => {
      if (containerRef && chart) {
        chart.applyOptions({
          width: containerRef.clientWidth,
          height: containerRef.clientHeight,
        });
      }
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef);

    onCleanup(() => {
      ro.disconnect();
      if (chart) chart.remove();
    });
  });

  createEffect(() => {
    props.klines;
    props.timeframe;
    updateData();
  });

  return <div ref={containerRef} class="w-full h-full" />;
}

// ============================================
// CANVAS-BASED HIGH PERFORMANCE ORDER BOOK
// ============================================
function OrderBook(props) {
  let canvasRef;
  
  const bids = () => props.fullDepth?.b || [];
  const asks = () => props.fullDepth?.a || [];

  createEffect(() => {
    const ctx = canvasRef.getContext('2d');
    const width = canvasRef.clientWidth;
    const height = canvasRef.clientHeight;
    
    // Set internal resolution for high-DPI screens
    const dpr = window.devicePixelRatio || 1;
    canvasRef.width = width * dpr;
    canvasRef.height = height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      const bData = bids().slice(0, 8);
      const aData = asks().slice(0, 8);
      const all = [...bData, ...aData];
      const maxQty = all.length > 0 ? Math.max(...all.map(x => x[1])) : 1;
      
      const rowH = 18;
      const midY = height / 2;
      
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      
      // Draw Asks (Top, Red)
      aData.reverse().forEach((ask, i) => {
        const y = midY - (i + 1) * rowH;
        const barW = (ask[1] / maxQty) * width;
        ctx.fillStyle = 'rgba(246, 70, 93, 0.15)';
        ctx.fillRect(width - barW, y, barW, rowH - 1);
        
        ctx.fillStyle = '#f6465d';
        ctx.fillText(fmtPrice(ask[0]), 5, y + 12);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.textAlign = 'right';
        ctx.fillText(fmtVolume(ask[1]), width / 2 + 20, y + 12);
        ctx.fillText('$' + fmtVolume(ask[0] * ask[1]), width - 5, y + 12);
        ctx.textAlign = 'left';
      });

      // Price Pivot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, midY - 12, width, 24);
      ctx.fillStyle = '#f0b90b';
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$' + fmtPrice(props.lastPrice), width / 2, midY + 5);
      ctx.textAlign = 'left';

      // Draw Bids (Bottom, Green)
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      bData.forEach((bid, i) => {
        const y = midY + 12 + i * rowH;
        const barW = (bid[1] / maxQty) * width;
        ctx.fillStyle = 'rgba(14, 203, 129, 0.15)';
        ctx.fillRect(width - barW, y, barW, rowH - 1);
        
        ctx.fillStyle = '#0ecb81';
        ctx.fillText(fmtPrice(bid[0]), 5, y + 12);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.textAlign = 'right';
        ctx.fillText(fmtVolume(bid[1]), width / 2 + 20, y + 12);
        ctx.fillText('$' + fmtVolume(bid[0] * bid[1]), width - 5, y + 12);
        ctx.textAlign = 'left';
      });
    };

    draw();
  });

  return <canvas ref={canvasRef} class="w-full h-full" />;
}

// ============================================
// CANVAS-BASED HIGH PERFORMANCE TRADE TAPE
// ============================================
function TradeTape(props) {
  let canvasRef;
  const [filter, setFilter] = createSignal('all');

  const filteredTrades = createMemo(() => {
    if (!props.trades) return [];
    switch (filter()) {
      case 'whale': return props.trades.filter(t => t.w);
      case 'buy': return props.trades.filter(t => !t.m);
      case 'sell': return props.trades.filter(t => t.m);
      default: return props.trades;
    }
  });

  createEffect(() => {
    const ctx = canvasRef.getContext('2d');
    const width = canvasRef.clientWidth;
    const height = canvasRef.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvasRef.width = width * dpr;
    canvasRef.height = height * dpr;
    ctx.scale(dpr, dpr);

    const trades = filteredTrades().slice(0, 15);
    const rowH = 16;
    
    ctx.clearRect(0, 0, width, height);
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    
    trades.forEach((t, i) => {
      const y = i * rowH;
      const isBuy = !t.m;
      
      if (t.w) {
        ctx.fillStyle = 'rgba(240, 185, 11, 0.05)';
        ctx.fillRect(0, y, width, rowH - 1);
      }

      ctx.fillStyle = isBuy ? '#0ecb81' : '#f6465d';
      ctx.fillText(fmtPrice(t.p), 5, y + 11);
      
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'right';
      ctx.fillText(fmtVolume(t.q), width - 75, y + 11); // More space for date
      
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      const timeStr = new Date(t.T).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      ctx.fillText(timeStr, width - 5, y + 11);
      
      if (t.w) {
        ctx.fillStyle = '#f0b90b';
        ctx.fillText('🐋', width / 2 + 5, y + 11);
      }
      ctx.textAlign = 'left';
    });
  });

  return (
    <div class="flex flex-col h-full bg-black/40">
      <div class="flex items-center justify-between px-2 py-1 border-b border-white/5 bg-black/20 shrink-0">
        <span class="text-[8px] font-black text-text_secondary/40 uppercase tracking-widest">Live Tape</span>
        <div class="flex gap-1">
          {['all', 'whale', 'buy', 'sell'].map(f => (
            <button 
              onClick={() => setFilter(f)} 
              class={`text-[7px] px-1.5 py-0.5 rounded ${filter() === f ? 'bg-text_accent text-black font-bold' : 'text-text_secondary/30'}`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div class="flex-1 min-h-0">
        <canvas ref={canvasRef} class="w-full h-full" />
      </div>
    </div>
  );
}

// ============================================
// MARKET STATS PANEL
// ============================================
function MarketStats({ klines, stats24h, markPrice, fundingRate }) {
  const ohlc = createMemo(() => {
    if (!klines || klines.length === 0) return null;
    const last = klines[klines.length - 1];
    const prev = klines.length > 1 ? klines[klines.length - 2] : last;
    return {
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      volume: last.volume,
      change: ((last.close - prev.close) / prev.close * 100),
      changeValue: last.close - prev.close,
    };
  });

  const dayRange = createMemo(() => {
    if (!stats24h) return { high: 0, low: 0, range: 0 };
    const high = stats24h.high || 0;
    const low = stats24h.low || 0;
    return { high, low, range: high - low };
  });

  const positionInRange = createMemo(() => {
    if (!ohlc() || dayRange().range === 0) return 50;
    return ((ohlc().close - dayRange().low) / dayRange().range) * 100;
  });

  return (
    <div class="flex flex-col h-full bg-black/40">
      {/* Header */}
      <div class="flex items-center justify-between px-2 py-1 border-b border-white/5 bg-black/20">
        <span class="text-[9px] font-bold text-text_secondary uppercase tracking-wider">Market Stats</span>
      </div>

      <div class="flex-1 overflow-y-auto p-2 space-y-2">
        {/* OHLC */}
        <Show when={ohlc()}>
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-black/30 rounded p-1.5">
              <div class="text-[7px] text-text_secondary/50 uppercase">Open</div>
              <div class="text-[10px] font-mono text-text_primary">${fmtPrice(ohlc().open)}</div>
            </div>
            <div class="bg-black/30 rounded p-1.5">
              <div class="text-[7px] text-text_secondary/50 uppercase">Close</div>
              <div class={`text-[10px] font-mono ${ohlc().change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${fmtPrice(ohlc().close)}
              </div>
            </div>
            <div class="bg-black/30 rounded p-1.5">
              <div class="text-[7px] text-text_secondary/50 uppercase">High</div>
              <div class="text-[10px] font-mono text-green-400">${fmtPrice(ohlc().high)}</div>
            </div>
            <div class="bg-black/30 rounded p-1.5">
              <div class="text-[7px] text-text_secondary/50 uppercase">Low</div>
              <div class="text-[10px] font-mono text-red-400">${fmtPrice(ohlc().low)}</div>
            </div>
          </div>

          {/* Change */}
          <div class="bg-black/30 rounded p-2">
            <div class="flex justify-between items-center">
              <span class="text-[8px] text-text_secondary/50 uppercase">24h Change</span>
              <span class={`text-[12px] font-black font-mono ${ohlc().change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {ohlc().change >= 0 ? '+' : ''}{ohlc().change.toFixed(2)}%
              </span>
            </div>
            <div class={`text-[9px] font-mono ${ohlc().change >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
              {ohlc().change >= 0 ? '+' : ''}${fmt(ohlc().changeValue, 4)}
            </div>
          </div>

          {/* Volume */}
          <div class="bg-black/30 rounded p-2">
            <div class="flex justify-between items-center">
              <span class="text-[8px] text-text_secondary/50 uppercase">Volume</span>
              <span class="text-[10px] font-mono text-text_accent">{fmtVolume(ohlc().volume)}</span>
            </div>
          </div>
        </Show>

        {/* 24h Range */}
        <Show when={stats24h}>
          <div class="bg-black/30 rounded p-2">
            <div class="flex justify-between text-[8px] mb-1">
              <span class="text-text_secondary/50">24h Low</span>
              <span class="text-text_secondary/50">24h High</span>
            </div>
            <div class="relative h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                class="absolute w-1 h-full bg-text_accent rounded-full transition-all duration-500"
                style={{ left: `${positionInRange()}%` }}
              />
            </div>
            <div class="flex justify-between text-[9px] font-mono mt-1">
              <span class="text-red-400">${fmtPrice(dayRange().low)}</span>
              <span class="text-green-400">${fmtPrice(dayRange().high)}</span>
            </div>
          </div>
        </Show>

        {/* Mark Price & Funding */}
        <Show when={markPrice}>
          <div class="bg-black/30 rounded p-2 space-y-1">
            <div class="flex justify-between items-center">
              <span class="text-[8px] text-text_secondary/50 uppercase">Mark Price</span>
              <span class="text-[10px] font-mono text-text_primary">${fmtPrice(markPrice)}</span>
            </div>
            <Show when={fundingRate !== undefined}>
              <div class="flex justify-between items-center">
                <span class="text-[8px] text-text_secondary/50 uppercase">Funding Rate</span>
                <span class={`text-[10px] font-mono ${fundingRate > 0 ? 'text-green-400' : fundingRate < 0 ? 'text-red-400' : 'text-text_secondary'}`}>
                  {(fundingRate * 100).toFixed(4)}%
                </span>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default function LiveMarketTerminal(props) {
  // Tab-based State Management
  const [tabs, setTabs] = createSignal([
    { id: 'tab1', name: 'CORE_ASSETS', symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] },
    { id: 'tab2', name: 'ALT_TIER_1', symbols: ['BNBUSDT', 'XRPUSDT', 'ADAUSDT'] },
  ]);
  const [activeTabId, setActiveTabId] = createSignal('tab1');
  
  const activeTab = createMemo(() => tabs().find(t => t.id === activeTabId()));
  const activeSymbols = () => activeTab()?.symbols || [];
  
  // Collect all unique symbols from all tabs for WS subscription
  const allSymbols = createMemo(() => {
    const syms = new Set();
    tabs().forEach(t => t.symbols.forEach(s => syms.add(s)));
    return Array.from(syms);
  });

  const [prices, setPrices] = createSignal({});
  const [klineStore, setKlineStore] = createSignal({});
  const [trades, setTrades] = createSignal({});
  const [depths, setDepths] = createSignal({});
  const [fullDepths, setFullDepths] = createSignal({});
  const [sentiment, setSentiment] = createSignal({});
  const [stats24h, setStats24h] = createSignal({});
  const [markPrices, setMarkPrices] = createSignal({});
  const [fundingRates, setFundingRates] = createSignal({});
  const [timeframes, setTimeframes] = createSignal({});
  const [activeIndicators, setActiveIndicators] = createSignal({});
  const [showIndicatorMenu, setShowIndicatorMenu] = createSignal({});
  const [wsStatus, setWsStatus] = createSignal('CONNECTING');
  const [showSelector, setShowSelector] = createSignal(false);
  const [selectorSearch, setSelectorSearch] = createSignal('');

  // Internal refs
  const assetKlines = {};
  const assetLastPrice = {};
  const chartThrottles = {};
  let ws = null;

  const setTimeframe = (sym, tf) => {
    setTimeframes(prev => ({ ...prev, [sym]: tf }));
  };

  const connectWS = () => {
    if (ws) ws.close();
    const wsUrl = import.meta.env.VITE_CRYPTO_STREAM_WS;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => setWsStatus('LIVE');
    ws.onclose = () => { setWsStatus('RECONNECTING'); setTimeout(connectWS, 4000); };
    ws.onerror = () => setWsStatus('ERROR');

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'snapshot') {
        const newKlines = {};
        const newTrades = {};
        const newDepths = {};
        const newFullDepths = {};
        const newPrices = {};
        const newSentiment = {};
        const newStats24h = {};
        const newMarkPrices = {};
        const newFundingRates = {};

        Object.entries(msg.data).forEach(([s, data]) => {
          // Handle nested timeframe object from backend
          const rawKlines = (data.klines && !Array.isArray(data.klines))
            ? (data.klines['1m'] || [])
            : (Array.isArray(data.klines) ? data.klines : []);

          const klines = rawKlines.sort((a, b) => a.time - b.time);
          assetKlines[s] = { '1m': klines, '5m': [], '15m': [], '1h': [] };

          // Store all timeframes
          if (data.klines && !Array.isArray(data.klines)) {
            Object.entries(data.klines).forEach(([tf, candles]) => {
              assetKlines[s][tf] = (candles || []).sort((a, b) => a.time - b.time);
            });
          }

          if (klines.length > 0) {
            const last = klines[klines.length - 1];
            assetLastPrice[s] = last.close;
            newPrices[s] = { price: last.close, side: 'neutral' };
            newSentiment[s] = last.close >= last.open ? 'BULLISH' : 'BEARISH';
          }

          newKlines[s] = assetKlines[s];
          newTrades[s] = (Array.isArray(data.trades) ? data.trades : []).slice(0, 50);
          if (data.depth) newDepths[s] = data.depth;
          if (data.depth_full) newFullDepths[s] = data.depth_full;
          if (data['24hr']) newStats24h[s] = data['24hr'];
          if (data.mark_price) newMarkPrices[s] = data.mark_price;
          if (data.funding_rate !== undefined) newFundingRates[s] = data.funding_rate;
        });

        setKlineStore(prev => ({ ...prev, ...newKlines }));
        setTrades(prev => ({ ...prev, ...newTrades }));
        setDepths(prev => ({ ...prev, ...newDepths }));
        setFullDepths(prev => ({ ...prev, ...newFullDepths }));
        setPrices(prev => ({ ...prev, ...newPrices }));
        setSentiment(prev => ({ ...prev, ...newSentiment }));
        setStats24h(prev => ({ ...prev, ...newStats24h }));
        setMarkPrices(prev => ({ ...prev, ...newMarkPrices }));
        setFundingRates(prev => ({ ...prev, ...newFundingRates }));

        // Initialize default timeframes
        const defaultTFs = {};
        Object.keys(msg.data).forEach(s => { defaultTFs[s] = '1m'; });
        setTimeframes(defaultTFs);

      } else if (msg.type === 'kline') {
        const s = msg.symbol;
        const d = msg.data;
        const tf = msg.timeframe || '1m';

        if (!assetKlines[s]) assetKlines[s] = { '1m': [], '5m': [], '15m': [], '1h': [] };
        if (!assetKlines[s][tf]) assetKlines[s][tf] = [];

        const idx = assetKlines[s][tf].findIndex(k => k.time === d.time);
        if (idx !== -1) {
          assetKlines[s][tf][idx] = d;
        } else {
          assetKlines[s][tf].push(d);
          if (assetKlines[s][tf].length > 300) assetKlines[s][tf].shift();
        }

        // Update current timeframe display
        const currentTF = timeframes()[s] || '1m';
        if (tf === currentTF) {
          setKlineStore(prev => ({ ...prev, [s]: { ...assetKlines[s] } }));
        }

        const side = d.close >= (assetLastPrice[s] || d.close) ? 'up' : 'down';
        assetLastPrice[s] = d.close;
        setPrices(prev => ({ ...prev, [s]: { price: d.close, side } }));
        setSentiment(prev => ({ ...prev, [s]: d.close >= d.open ? 'BULLISH' : 'BEARISH' }));

      } else if (msg.type === 'trade') {
        const s = msg.symbol;
        const d = msg.data;
        const price = d.p;
        const qty = d.q;

        const side = price >= (assetLastPrice[s] || price) ? 'up' : 'down';
        assetLastPrice[s] = price;
        setPrices(prev => ({ ...prev, [s]: { price, side } }));

        // Update current kline candle
        const currentTF = timeframes()[s] || '1m';
        if (assetKlines[s] && assetKlines[s][currentTF] && assetKlines[s][currentTF].length > 0) {
          const lastIdx = assetKlines[s][currentTF].length - 1;
          const k = assetKlines[s][currentTF][lastIdx];
          k.close = price;
          if (price > k.high) k.high = price;
          if (price < k.low) k.low = price;

          if (!chartThrottles[s]) {
            chartThrottles[s] = setTimeout(() => {
              setKlineStore(prev => ({ ...prev, [s]: { ...assetKlines[s] } }));
              delete chartThrottles[s];
            }, 16); // High Trade Activity Class: 60FPS (16ms) refresh
          }
        }

        const isWhale = (price * qty) > 10000;
        const trade = {
          p: price.toFixed(s.includes('DOGE') || s.includes('SHIB') ? 6 : 2),
          q: qty.toFixed(3),
          m: d.m,
          w: isWhale,
          T: d.T
        };
        setTrades(prev => ({ ...prev, [s]: [trade, ...(prev[s] || [])].slice(0, 50) }));

      } else if (msg.type === 'depth') {
        setDepths(prev => ({ ...prev, [msg.symbol]: msg.data }));
      } else if (msg.type === 'depth_full') {
        setFullDepths(prev => ({ ...prev, [msg.symbol]: msg.data }));
      } else if (msg.type === 'mark_price') {
        setMarkPrices(prev => ({ ...prev, [msg.symbol]: msg.data.mark_price }));
        setFundingRates(prev => ({ ...prev, [msg.symbol]: msg.data.funding_rate }));
      }
    };
  };

  onMount(() => {
    connectWS();
    onCleanup(() => { if (ws) ws.close(); });
  });

  const filteredTop50 = () =>
    TOP_50.filter(s => s.toLowerCase().includes(selectorSearch().toLowerCase()));

  const priceColor = (sym) => {
    const s = prices()[sym]?.side;
    return s === 'up' ? 'text-green-400' : s === 'down' ? 'text-red-400' : 'text-text_primary';
  };

  return (
    <div class="flex flex-col h-full bg-black font-mono overflow-hidden">
      {/* Professional Tab Bar & Toolbar */}
      <div class="h-10 bg-bg_header border-b border-border_main flex items-center justify-between px-2 shrink-0">
        <div class="flex items-center gap-1 overflow-x-auto win-scroll no-scrollbar max-w-[70%]">
          <For each={tabs()}>
            {(tab) => (
              <div 
                class={`flex items-center h-7 px-3 gap-2 cursor-pointer transition-all border-x border-t rounded-t-sm ${
                  activeTabId() === tab.id 
                    ? 'bg-bg_main border-border_main text-text_accent' 
                    : 'bg-black/40 border-transparent text-text_secondary/40 hover:text-text_secondary'
                }`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span class="text-[9px] font-black uppercase tracking-widest">{tab.name}</span>
                <span class="text-[8px] bg-white/5 px-1 rounded">{tab.symbols.length}</span>
              </div>
            )}
          </For>
          <button 
            onClick={() => {
              const newId = `tab${Date.now()}`;
              setTabs(prev => [...prev, { id: newId, name: `TAB_${prev.length + 1}`, symbols: [] }]);
              setActiveTabId(newId);
            }}
            class="h-7 w-7 flex items-center justify-center hover:bg-white/5 text-text_secondary/30 hover:text-text_accent transition-colors"
          >
            +
          </button>
        </div>

        <div class="flex items-center gap-4 px-2">
          <div class="flex items-center gap-2">
            <div class={`w-1.5 h-1.5 rounded-full animate-pulse ${wsStatus() === 'LIVE' ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span class="text-[8px] font-black text-text_secondary/60 uppercase">{wsStatus()}</span>
          </div>
          <button
            onClick={() => setShowSelector(true)}
            class="text-[8px] bg-text_accent/10 hover:bg-text_accent/20 text-text_accent px-2 py-1 rounded border border-text_accent/30 font-black"
          >
            + ASSETS
          </button>
        </div>
      </div>

      {/* Asset Selector Modal */}
      <Show when={showSelector()}>
        <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={() => setShowSelector(false)}>
          <div class="bg-bg_main border border-border_main rounded-lg w-96 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div class="p-4 border-b border-border_main">
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-xs font-bold text-text_primary uppercase tracking-widest">Add to {activeTab()?.name}</h3>
                <span class="text-[9px] text-text_accent/60">{activeSymbols().length}/3 SLOTS USED</span>
              </div>
              <input
                type="text"
                placeholder="Search Symbol..."
                value={selectorSearch()}
                onInput={e => setSelectorSearch(e.target.value)}
                class="w-full bg-black/50 border border-border_main rounded px-3 py-2 text-xs text-text_primary focus:outline-none focus:border-text_accent"
              />
            </div>
            <div class="flex-1 overflow-y-auto p-2">
              <div class="grid grid-cols-2 gap-1">
                <For each={filteredTop50()}>
                  {sym => {
                    const isSelected = () => activeSymbols().includes(sym);
                    const isFull = () => activeSymbols().length >= 3 && !isSelected();
                    return (
                      <button
                        disabled={isFull()}
                        onClick={() => {
                          setTabs(prev => prev.map(t => {
                            if (t.id === activeTabId()) {
                              const newSymbols = t.symbols.includes(sym) 
                                ? t.symbols.filter(s => s !== sym)
                                : [...t.symbols, sym].slice(0, 3);
                              return { ...t, symbols: newSymbols };
                            }
                            return t;
                          }));
                        }}
                        class={`text-[10px] px-3 py-2 rounded text-left transition-all ${isSelected()
                            ? 'bg-text_accent/20 text-text_accent border border-text_accent/50'
                            : isFull() ? 'opacity-20 cursor-not-allowed' : 'bg-black/30 text-text_secondary hover:bg-black/50 border border-transparent'
                          }`}
                      >
                        {sym.replace('USDT', '')}/USDT
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
            <div class="p-4 border-t border-border_main flex justify-end">
              <button
                onClick={() => setShowSelector(false)}
                class="text-[10px] bg-text_accent text-black px-4 py-1.5 rounded font-bold uppercase"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Professional Trading Grid - Filtered by Active Tab */}
      <div class="flex-1 min-h-0 overflow-hidden p-2">
        <div class={`grid h-full gap-2 ${activeSymbols().length === 1 ? 'grid-cols-1' :
            activeSymbols().length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 xl:grid-cols-3'
          }`}>
          <For each={activeSymbols()}>
            {(sym) => {
              const tf = () => timeframes()[sym] || '1m';
              const klines = () => (klineStore()[sym] && klineStore()[sym][tf()]) || [];
              const depth = () => depths()[sym] || {};
              const tradeList = () => trades()[sym] || [];
              const price = () => prices()[sym];
              const sent = () => sentiment()[sym];
              const stats = () => stats24h()[sym] || {};
              const markP = () => markPrices()[sym];
              const fundR = () => fundingRates()[sym];

              return (
                <div class="flex flex-col bg-bg_main border border-border_main rounded overflow-hidden h-full">
                  {/* Professional Header */}
                  <div class="bg-black/60 border-b border-border_main px-3 py-2 flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-text_accent/20 to-text_accent/5 border border-text_accent/30 rounded">
                        <span class="text-xs font-black text-text_accent">{sym.replace('USDT', '').slice(0, 3)}</span>
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-black text-text_primary">{sym.replace('USDT', '')}</span>
                          <span class="text-[10px] text-text_secondary/50">/USDT</span>
                          
                          {/* LIVE PREDICTION SIGNAL (High Performance Memoized) */}
                          {(() => {
                            const data = klines();
                            if (data.length === 0) return null;
                            const sig = TechnicalAnalysis.getSignal(data);
                            return (
                              <div class={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter transition-colors duration-75 ${
                                sig.action.includes('BUY') ? 'bg-green-500/20 text-green-400' : 
                                sig.action.includes('SELL') ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-text_secondary'
                              }`}>
                                <div class={`w-1 h-1 rounded-full animate-pulse ${sig.action.includes('BUY') ? 'bg-green-400' : sig.action.includes('SELL') ? 'bg-red-400' : 'bg-white'}`} />
                                {sig.action}
                              </div>
                            );
                          })()}
                        </div>
                        <div class="flex items-center gap-2 mt-0.5">
                          <span class={`text-lg font-black font-mono tabular-nums ${priceColor(sym)}`}>
                            ${fmtPrice(price()?.price)}
                          </span>
                          <Show when={stats()?.price_change_pct !== undefined}>
                            <span class={`text-[10px] font-mono ${stats()?.price_change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {stats()?.price_change_pct >= 0 ? '+' : ''}{stats()?.price_change_pct?.toFixed(2)}%
                            </span>
                          </Show>
                        </div>
                      </div>
                    </div>

                    {/* Timeframe & Tools Selector */}
                    <div class="flex items-center gap-2">
                      <div class="flex items-center gap-1">
                        <For each={TIMEFRAMES}>
                          {({ label, value }) => (
                            <button
                              onClick={() => setTimeframe(sym, value)}
                              class={`text-[9px] px-2 py-1 rounded transition-all ${tf() === value
                                  ? 'bg-text_accent text-black font-bold'
                                  : 'bg-black/50 text-text_secondary hover:text-text_primary'
                                }`}
                            >
                              {label}
                            </button>
                          )}
                        </For>
                      </div>

                      {/* INDICATOR SELECTOR */}
                      <div class="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowIndicatorMenu(prev => ({ ...prev, [sym]: !prev[sym] }));
                          }}
                          class="bg-black/40 hover:bg-black/60 border border-white/10 text-[9px] px-2 py-1 rounded flex items-center gap-1"
                        >
                          ⚙️ INDICATORS
                        </button>
                        
                        <Show when={showIndicatorMenu()[sym]}>
                          <div class="absolute right-0 top-full mt-1 bg-bg_main border border-border_main p-2 rounded shadow-xl z-50 w-32 flex flex-col gap-1">
                            {[
                              { id: 'rsi', label: 'RSI' },
                              { id: 'bollinger', label: 'Bollinger' },
                            ].map(ind => (
                              <label class="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded">
                                <input 
                                  type="checkbox" 
                                  checked={activeIndicators()[sym]?.[ind.id]} 
                                  onChange={() => {
                                    setActiveIndicators(prev => ({
                                      ...prev,
                                      [sym]: { ...prev[sym], [ind.id]: !prev[sym]?.[ind.id] }
                                    }));
                                  }}
                                  class="w-3 h-3 accent-text_accent"
                                />
                                <span class="text-[9px] text-text_secondary uppercase">{ind.label}</span>
                              </label>
                            ))}
                          </div>
                        </Show>
                      </div>
                    </div>
                  </div>

                  {/* High-Density Professional Layout */}
                  <div class="flex-1 flex flex-col min-h-0 bg-border_main/30 gap-px">
                    
                    {/* Top Section: Full-Width Advanced Chart */}
                    <div class="flex-[1.5] bg-black/40 relative min-h-[300px]">
                      <Show when={klines().length > 0} fallback={
                        <div class="absolute inset-0 flex items-center justify-center">
                          <div class="flex flex-col items-center gap-2">
                            <div class="w-6 h-6 border-2 border-text_accent/40 border-t-text_accent animate-spin rounded-full" />
                            <span class="text-[10px] text-text_secondary/50 uppercase tracking-tighter">Initializing Chart Engine...</span>
                          </div>
                        </div>
                      }>
                        <ProfessionalChart
                          klines={klines()}
                          timeframe={tf()}
                          symbol={sym}
                          lastPrice={price()}
                          indicators={activeIndicators()[sym] || {}}
                        />
                      </Show>
                    </div>

                     {/* Bottom Section: Compact Intelligence Row */}
                     <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-px bg-border_main/30 min-h-[220px]">
                       {/* Order Book */}
                       <div class="bg-black/60 overflow-hidden">
                         <OrderBook 
                           l1Depth={depth()} 
                           fullDepth={fullDepths()[sym]} 
                           lastPrice={price()?.price} 
                         />
                       </div>

                       {/* Trade Tape */}
                       <div class="bg-black/60 overflow-hidden">
                         <TradeTape trades={tradeList()} symbol={sym} />
                       </div>

                       {/* Market Stats */}
                       <div class="bg-black/60 overflow-hidden">
                         <MarketStats
                           klines={klines()}
                           stats24h={stats()}
                           markPrice={markP()}
                           fundingRate={fundR()}
                         />
                       </div>
                     </div>
                   </div>
                 </div>
               );
             }}
           </For>
         </div>
       </div>



       {/* Professional Footer */}
      <div class="h-8 bg-black border-t border-border_main flex items-center justify-between px-4 shrink-0">
        <div class="flex items-center gap-6 text-[9px]">
          <span class="font-black text-text_secondary tracking-[0.15em] uppercase">Mahameru Terminal</span>
          <span class="text-text_secondary/40">|</span>
          <span class="text-text_secondary/50">Lightweight Charts Pro</span>
          <span class="text-text_secondary/40">|</span>
          <span class="text-text_secondary/50">Binance WebSocket</span>
        </div>
        <div class="flex items-center gap-4 text-[9px]">
          <span class="text-text_secondary/50">Data delayed ~100ms</span>
          <span class="font-black text-text_accent italic animate-pulse">LIVE</span>
        </div>
      </div>
    </div>
  );
}
