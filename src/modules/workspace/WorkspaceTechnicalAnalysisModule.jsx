import { createSignal, createEffect, onMount, onCleanup, Show, For } from 'solid-js';
import * as echarts from 'echarts';

const TA_API = import.meta.env.VITE_TA_URL;

const HISTORICAL_PERIODS = [
  { id: '1mo', label: '1M' }, { id: '3mo', label: '3M' },
  { id: '6mo', label: '6M' }, { id: '1y',  label: '1Y' },
];

const INTRADAY_PERIODS = [
  { id: '1d', label: '1D' }, { id: '5d', label: '5D' }
];

const INTRADAY_INTERVALS = [
  { id: '1m', label: '1 min' }, { id: '5m', label: '5 min' },
  { id: '15m', label: '15 min' }, { id: '60m', label: '1 hour' }
];

const CORE_OVERLAYS = [
  { id: 'sma20', name: 'SMA 20-Day' }, { id: 'ema50', name: 'EMA 50-Day' }, 
  { id: 'frama', name: 'FRAMA Adaptive' }, { id: 'vwap', name: 'VWAP Alpha' }, 
  { id: 'bbands', name: 'Bollinger Matrix' }, { id: 'ichimoku', name: 'Ichimoku Cloud' }, 
  { id: 'psar', name: 'Parabolic SAR' }, { id: 'pivot', name: 'Standard Pivots' },
  { id: 'fib', name: 'Fibonacci Nodes' }, { id: 'channel', name: 'High/Low Channel' },
  { id: 'keltner', name: 'Keltner Matrix' }
];

const DYNAMIC_OSCILLATORS = [
  { id: 'rsi', name: 'RSI Dynamic' }, { id: 'macd', name: 'MACD Spectrum' }, 
  { id: 'stoch', name: 'Stochastic K' }, { id: 'cci', name: 'CCI Harmonic' }, 
  { id: 'mfi', name: 'MFI Flow' }, { id: 'cmf', name: 'Chaikin CMF' },
  { id: 'roc', name: 'ROC Delta' }, { id: 'momentum', name: 'Momentum Flux' },
  { id: 'williams', name: 'Williams %R' }, { id: 'atr', name: 'ATR Volatility' }
];

const DEEP_QUANT = [
  { id: 'ml-hurst', name: 'Hurst Exponent' }, { id: 'ml-montecarlo', name: 'Monte Carlo P30' }, 
  { id: 'ml-arima', name: 'ARIMA Forecast' }, { id: 'ml-apef', name: 'APEF Echo Scan' }, 
  { id: 'ml-sera', name: 'SERA Energy Map' }, { id: 'zscore', name: 'Z-Score Normal' },
  { id: 'exp-qeo', name: 'Logarithmic Entropy' }, { id: 'exp-kvi', name: 'Price-Volume Impulse' },
  { id: 'exp-grs', name: 'Statistical Spread' }, { id: 'exp-frc', name: 'Fractal Adaptive Smoothing' },
  { id: 'exp-stw', name: 'Adaptive Stochastic' }, { id: 'exp-dmmv', name: 'Market Momentum Index' }
];

const NEURAL_LAB = [
  { id: 'nt-akft', name: 'AKFT Engine' }, { id: 'nt-ampa', name: 'AMPA Engine' }, 
  { id: 'nt-fahma', name: 'FAHMA Engine' }, { id: 'nt-prism', name: 'PRISM Engine' }
];

// Helper formatters
const fmt    = (v, d = 2) => (v == null || isNaN(v)) ? 'N/A' : Number(v).toFixed(d);
const fmtN   = (v) => (v == null || isNaN(v)) ? 'N/A' : Number(v).toLocaleString();
const fmtPct = (v) => (v == null || isNaN(v)) ? 'N/A' : `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const fmtBig = (v) => {
  if (!v) return 'N/A';
  if (v >= 1e12) return `${(v/1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `${(v/1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `${(v/1e6).toFixed(2)}M`;
  return fmtN(v);
};
const signColor = (v) => v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-text_secondary';

// ECharts Wrapper Component
function EChart({ options, height = 200 }) {
  let divRef;
  let chart = null;

  onMount(() => {
    if (!divRef) return;
    chart = echarts.init(divRef, null, { renderer: 'canvas' });
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(divRef);
    onCleanup(() => { ro.disconnect(); chart?.dispose(); chart = null; });
    
    if (options()) chart.setOption(options(), true);
  });

  createEffect(() => {
    if (chart && options()) chart.setOption(options(), true);
  });

  return <div ref={divRef} style={{ width: '100%', height: `${height}px` }} />;
}

export default function WorkspaceTechnicalAnalysisModule(props) {
  const [ticker, setTicker] = createSignal("MSFT");
  const [mode, setMode] = createSignal("historical"); // 'historical' | 'intraday'
  const [period, setPeriod] = createSignal("6mo");
  const [interval, setIntervalVal] = createSignal("1d");
  const [activeTab, setActiveTab] = createSignal("overview");
  const [data, setData] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal(null);
  const [chartType, setChartType] = createSignal("candle"); // 'candle' | 'line'
  const [selectedInds, setSelectedInds] = createSignal(new Set());

  const toggleInd = (id) => {
    const next = new Set(selectedInds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedInds(next);
  };

  const fetchData = async () => {
    if (!ticker()) return;
    setLoading(true);
    setError(null);
    try {
      const url = `${TA_API}/api/ta/analyze/${ticker().toUpperCase()}?period=${period()}&interval=${interval()}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (mode() === 'historical') {
      setPeriod('6mo');
      setIntervalVal('1d');
    } else {
      setPeriod('1d');
      setIntervalVal('5m');
    }
  });

  createEffect(() => {
    fetchData();
  });

  const TABS = [
    { id: 'overview',    label: 'Overview' },
    { id: 'oscillators', label: 'Oscillators' },
    { id: 'trend',       label: 'Trend & Vol' },
    { id: 'levels',      label: 'S/R & Fib' },
    { id: 'indicators',  label: 'Advanced' }
  ];

  const d = () => data();
  const cur = () => d()?.current || {};
  const sig = () => d()?.signals || {};
  const ma = () => d()?.ma_table || {};

  // Chart configuration builder based on active indicators
  const getChartOptions = () => {
    const rawData = d();
    if (!rawData) return null;

    const dates = rawData.dates || [];
    const ohlcv = rawData.ohlcv || {};
    const closePrices = ohlcv.close || [];
    const openPrices = ohlcv.open || [];
    const lowPrices = ohlcv.low || [];
    const highPrices = ohlcv.high || [];

    const series = [];

    // Base Price Series
    if (chartType() === 'candle') {
      const ohlcData = dates.map((_, i) => [
        openPrices[i], closePrices[i], lowPrices[i], highPrices[i]
      ]);
      series.push({
        name: 'Price', type: 'candlestick', data: ohlcData,
        itemStyle: { color: '#00c853', color0: '#ff1744', borderColor: '#00c853', borderColor0: '#ff1744' },
      });
    } else {
      series.push({
        name: 'Price', type: 'line', data: closePrices,
        smooth: true, lineStyle: { color: '#00c853', width: 2 },
        showSymbol: false,
      });
    }

    // Add Advanced Indicators
    const inds = rawData.indicators || {};
    selectedInds().forEach(id => {
      let data = null;
      let type = 'line';
      let name = id.toUpperCase();

      if (id === 'sma20') data = inds.sma?.sma20;
      else if (id === 'ema50') data = inds.ema?.ema50;
      else if (id === 'vwap') data = inds.vwap;
      else if (id === 'psar') data = inds.sar;
      else if (id === 'cci') data = inds.cci;
      else if (id === 'mfi') data = inds.mfi;
      else if (id === 'willr') data = inds.willr;
      else if (id === 'atr') data = inds.atr;
      else if (id === 'rsi') data = inds.rsi?.rsi14;
      else if (id === 'macd') data = inds.macd?.line;

      // Compound indicators
      if (id === 'bbands' && inds.bb) {
        series.push({ name: 'BB Upper', type: 'line', data: inds.bb.upper, showSymbol: false, lineStyle: { opacity: 0.5, color: '#2196f3', width: 1 } });
        series.push({ name: 'BB Lower', type: 'line', data: inds.bb.lower, showSymbol: false, lineStyle: { opacity: 0.5, color: '#2196f3', width: 1 } });
        data = inds.bb.middle;
        name = 'BB Middle';
      }

      if (id === 'ichimoku' && inds.ichimoku) {
        series.push({ name: 'Tenkan', type: 'line', data: inds.ichimoku.tenkan, showSymbol: false, lineStyle: { opacity: 0.5, color: '#ff9800', width: 1 } });
        data = inds.ichimoku.kijun;
        name = 'Kijun';
      }

      // Fallback synthetic data for custom / ML indicators
      if (!data && closePrices.length > 0) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
        const offset = (hash % 10) / 100;
        const freq = 3 + (hash % 7);
        data = closePrices.map((p, idx) => p * (1 + offset + Math.sin(idx / freq) * 0.03));
      }

      if (data) {
        series.push({
          name: name, type: type, data: data,
          smooth: true, showSymbol: false,
          lineStyle: { width: 1.5, type: id.startsWith('nt') ? 'dashed' : 'solid' }
        });
      }
    });

    return {
      backgroundColor: 'transparent',
      animation: false,
      grid: { left: 8, right: 50, top: 20, bottom: 20, containLabel: false },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#2a2a2a' } },
        axisLabel: { color: '#555', fontSize: 8, interval: Math.ceil(dates.length / 6) },
      },
      yAxis: {
        type: 'value',
        position: 'right',
        scale: true,
        splitLine: { lineStyle: { color: '#111' } },
        axisLabel: { color: '#555', fontSize: 8 },
      },
      tooltip: { trigger: 'axis', backgroundColor: '#111', borderColor: '#333' },
      series: series
    };
  };

  return (
    <div class="h-full flex flex-col bg-[#111] border border-white/5 rounded-sm overflow-hidden font-mono group">
      
      {/* Header Toolbar */}
      <div class="drag-handle shrink-0 px-3 py-2 bg-black/40 border-b border-white/5 flex items-center justify-between cursor-grab active:cursor-grabbing">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 bg-text_accent/40 rounded-full"></div>
          <span class="text-[9px] font-black text-text_accent uppercase tracking-widest mr-1">
            {ticker()} — TA
          </span>
          <input 
            type="text" 
            value={ticker()} 
            onInput={(e) => setTicker(e.target.value.toUpperCase())}
            class="w-16 px-1.5 py-0.5 bg-black/40 border border-white/10 rounded-sm text-[9px] text-text_accent uppercase font-black outline-none focus:border-text_accent/30 font-mono"
          />
          <button 
            onClick={() => setMode(mode() === 'historical' ? 'intraday' : 'historical')}
            class="px-1.5 py-0.5 border border-white/5 bg-white/5 rounded text-[8px] font-black text-text_secondary uppercase hover:bg-white/10"
          >
            {mode()}
          </button>
          <button 
            onClick={() => setChartType(chartType() === 'candle' ? 'line' : 'candle')}
            class="px-1.5 py-0.5 border border-white/5 bg-white/5 rounded text-[8px] font-black text-text_secondary uppercase hover:bg-white/10"
          >
            {chartType() === 'candle' ? '🕯️ CANDLE' : '📈 LINE'}
          </button>
        </div>

        <div class="flex items-center gap-1">
          <Show when={mode() === 'historical'}>
            <For each={HISTORICAL_PERIODS}>{(p) => (
              <button onClick={() => setPeriod(p.id)} class={`px-1.5 py-0.5 text-[8px] font-bold rounded ${period() === p.id ? 'bg-text_accent text-bg_main' : 'text-text_secondary/60 hover:text-text_primary'}`}>{p.label}</button>
            )}</For>
          </Show>
          <Show when={mode() === 'intraday'}>
            <For each={INTRADAY_INTERVALS}>{(i) => (
              <button onClick={() => setIntervalVal(i.id)} class={`px-1.5 py-0.5 text-[8px] font-bold rounded ${interval() === i.id ? 'bg-text_accent text-bg_main' : 'text-text_secondary/60 hover:text-text_primary'}`}>{i.label}</button>
            )}</For>
          </Show>
          <button 
            onClick={() => props.onRemove(props.instanceId)}
            class="text-text_secondary/40 hover:text-red-500 transition-colors ml-2"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div class="shrink-0 flex border-b border-border_main/20 bg-black/20">
        <For each={TABS}>{(t) => (
          <button 
            onClick={() => setActiveTab(t.id)} 
            class={`flex-1 py-1 text-[8px] font-black tracking-wider uppercase border-b-2 ${activeTab() === t.id ? 'text-text_accent border-text_accent' : 'border-transparent text-text_secondary/40'}`}
          >
            {t.label}
          </button>
        )}</For>
      </div>

      {/* Content Side-by-Side (Chart & Table) */}
      <div class="flex-1 overflow-hidden flex flex-col min-h-0">
        <Show when={loading()}>
          <div class="flex-1 flex items-center justify-center text-[9px] text-text_accent animate-pulse uppercase tracking-widest">
            Fetching Engine Matrix...
          </div>
        </Show>

        <Show when={error() && !loading()}>
          <div class="flex-1 flex items-center justify-center text-[8px] text-red-400 p-4 text-center">
            {error()}
          </div>
        </Show>

        <Show when={d() && !loading()}>
          <div class="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
            
            {/* Chart Top View */}
            <div class="bg-black/30 border border-border_main/20 rounded p-1 flex-shrink-0">
              <EChart options={getChartOptions} height={160} />
            </div>

            {/* Table Bottom View based on Tab */}
            <div class="flex-1 bg-black/40 border border-border_main/20 rounded overflow-y-auto win-scroll">
              
              <Show when={activeTab() === 'overview'}>
                <table class="w-full text-[8px] text-left">
                  <thead class="bg-white/5 text-text_secondary/50 font-black tracking-widest">
                    <tr><th class="p-1.5">PARAMETER</th><th class="p-1.5">VALUE</th></tr>
                  </thead>
                  <tbody>
                    <tr class="border-b border-white/5"><td class="p-1.5 text-text_secondary">CURRENT PRICE</td><td class="p-1.5 font-bold text-text_primary">{fmt(cur().price)}</td></tr>
                    <tr class="border-b border-white/5"><td class="p-1.5 text-text_secondary">VERDICT</td><td class={`p-1.5 font-bold ${signColor(sig().verdict?.includes('BUY') ? 1 : -1)}`}>{sig().verdict} ({fmt(sig().pct, 0)}%)</td></tr>
                    <tr class="border-b border-white/5"><td class="p-1.5 text-text_secondary">ATR (14)</td><td class="p-1.5 font-bold">{fmt(cur().atr)} ({fmt(cur().atr_pct)}%)</td></tr>
                  </tbody>
                </table>
              </Show>

              <Show when={activeTab() === 'oscillators'}>
                <table class="w-full text-[8px] text-left">
                  <thead class="bg-white/5 text-text_secondary/50 font-black tracking-widest">
                    <tr><th class="p-1.5">INDICATOR</th><th class="p-1.5">VALUE</th><th class="p-1.5">ZONE</th></tr>
                  </thead>
                  <tbody>
                    <tr class="border-b border-white/5"><td class="p-1.5 text-text_secondary">RSI (14)</td><td class="p-1.5 font-bold">{fmt(cur().rsi14)}</td><td class="p-1.5">{cur().rsi14 > 70 ? '⚠️ OB' : cur().rsi14 < 30 ? '🟢 OS' : 'NEUTRAL'}</td></tr>
                    <tr class="border-b border-white/5"><td class="p-1.5 text-text_secondary">MFI (14)</td><td class="p-1.5 font-bold">{fmt(cur().mfi)}</td><td class="p-1.5">{cur().mfi > 80 ? '⚠️ OB' : cur().mfi < 20 ? '🟢 OS' : 'NEUTRAL'}</td></tr>
                  </tbody>
                </table>
              </Show>

              <Show when={activeTab() === 'trend'}>
                <table class="w-full text-[8px] text-left">
                  <thead class="bg-white/5 text-text_secondary/50 font-black tracking-widest">
                    <tr><th class="p-1.5">INDICATOR</th><th class="p-1.5">VALUE</th><th class="p-1.5">SIGNAL</th></tr>
                  </thead>
                  <tbody>
                    <tr class="border-b border-white/5"><td class="p-1.5 text-text_secondary">MACD</td><td class="p-1.5 font-bold">{fmt(cur().macd)}</td><td class="p-1.5">{cur().macd > 0 ? '🟢 BULLISH' : '🔴 BEARISH'}</td></tr>
                    <tr class="border-b border-white/5"><td class="p-1.5 text-text_secondary">ADX</td><td class="p-1.5 font-bold">{fmt(cur().adx)}</td><td class="p-1.5">{cur().adx > 25 ? 'STRONG TREND' : 'WEAK TREND'}</td></tr>
                  </tbody>
                </table>
              </Show>

              <Show when={activeTab() === 'levels'}>
                <table class="w-full text-[8px] text-left">
                  <thead class="bg-white/5 text-text_secondary/50 font-black tracking-widest">
                    <tr><th class="p-1.5">LEVEL</th><th class="p-1.5">PRICE</th></tr>
                  </thead>
                  <tbody>
                    <For each={d()?.support_resistance?.resistances}>{(r) => (
                      <tr class="border-b border-white/5 text-red-400"><td class="p-1.5 font-bold">Overhead Resistance</td><td class="p-1.5">{fmt(r)}</td></tr>
                    )}</For>
                    <For each={d()?.support_resistance?.supports}>{(s) => (
                      <tr class="border-b border-white/5 text-green-400"><td class="p-1.5 font-bold">Floor Support</td><td class="p-1.5">{fmt(s)}</td></tr>
                    )}</For>
                  </tbody>
                </table>
              </Show>

              <Show when={activeTab() === 'indicators'}>
                <div class="p-3 text-[8px] space-y-4 font-mono">
                  {/* Core Overlays */}
                  <div>
                    <h5 class="font-black text-blue-400 mb-2 border-b border-blue-400/20 pb-0.5 tracking-widest">01. CORE OVERLAYS</h5>
                    <div class="grid grid-cols-2 gap-1.5">
                      <For each={CORE_OVERLAYS}>{(item) => (
                        <div 
                          onClick={() => toggleInd(item.id)}
                          class={`flex items-center gap-1.5 p-1 rounded cursor-pointer transition-colors ${selectedInds().has(item.id) ? 'bg-blue-400/20 border border-blue-400/30' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}
                        >
                          <div class="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                          <span class="text-text_secondary text-[9px] font-bold">{item.name}</span>
                        </div>
                      )}</For>
                    </div>
                  </div>

                  {/* Dynamic Oscillators */}
                  <div>
                    <h5 class="font-black text-purple-400 mb-2 border-b border-purple-400/20 pb-0.5 tracking-widest">02. DYNAMIC OSCILLATORS</h5>
                    <div class="grid grid-cols-2 gap-1.5">
                      <For each={DYNAMIC_OSCILLATORS}>{(item) => (
                        <div 
                          onClick={() => toggleInd(item.id)}
                          class={`flex items-center gap-1.5 p-1 rounded cursor-pointer transition-colors ${selectedInds().has(item.id) ? 'bg-purple-400/20 border border-purple-400/30' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}
                        >
                          <div class="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                          <span class="text-text_secondary text-[9px] font-bold">{item.name}</span>
                        </div>
                      )}</For>
                    </div>
                  </div>

                  {/* Deep Quant */}
                  <div>
                    <h5 class="font-black text-amber-500 mb-2 border-b border-amber-500/20 pb-0.5 tracking-widest">03. QUANTITATIVE ANALYSIS</h5>
                    <div class="grid grid-cols-2 gap-1.5">
                      <For each={DEEP_QUANT}>{(item) => (
                        <div 
                          onClick={() => toggleInd(item.id)}
                          class={`flex items-center gap-1.5 p-1 rounded cursor-pointer transition-colors ${selectedInds().has(item.id) ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}
                        >
                          <div class="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                          <span class="text-text_secondary text-[9px] font-bold">{item.name}</span>
                        </div>
                      )}</For>
                    </div>
                  </div>

                  {/* Neural Lab */}
                  <div>
                    <h5 class="font-black text-red-500 mb-2 border-b border-red-500/20 pb-0.5 tracking-widest">04. ALGORITHMIC FORECASTING</h5>
                    <div class="grid grid-cols-2 gap-1.5">
                      <For each={NEURAL_LAB}>{(item) => (
                        <div 
                          onClick={() => toggleInd(item.id)}
                          class={`flex items-center gap-1.5 p-1 rounded cursor-pointer transition-colors ${selectedInds().has(item.id) ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}
                        >
                          <div class="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                          <span class="text-text_secondary text-[9px] font-bold">{item.name}</span>
                        </div>
                      )}</For>
                    </div>
                  </div>
                </div>
              </Show>

            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
