import { createSignal, createEffect, onMount, onCleanup, Show, For } from 'solid-js';
import * as echarts from 'echarts';

const TA_API = import.meta.env.VITE_TA_URL;
const PERIODS = [
  { id: '1mo', label: '1M' }, { id: '3mo', label: '3M' },
  { id: '6mo', label: '6M' }, { id: '1y',  label: '1Y' },
  { id: '2y',  label: '2Y' }, { id: '5y',  label: '5Y' },
];

// ── Formatters ──────────────────────────────────────────────────────────────
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

// ── ECharts theme defaults ──────────────────────────────────────────────────
const BASE_OPTS = {
  backgroundColor: 'transparent',
  animation: false,
  grid: { left: 8, right: 70, top: 12, bottom: 24, containLabel: false },
  xAxis: {
    type: 'category',
    axisLine:  { lineStyle: { color: '#333' } },
    axisTick:  { lineStyle: { color: '#333' } },
    axisLabel: { color: '#555', fontSize: 9, fontFamily: 'monospace' },
    splitLine: { show: false },
  },
  yAxis: {
    type: 'value',
    position: 'right',
    axisLine:  { show: false },
    axisTick:  { show: false },
    axisLabel: { color: '#555', fontSize: 9, fontFamily: 'monospace' },
    splitLine: { lineStyle: { color: '#1e1e1e' } },
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross', crossStyle: { color: '#555' }, lineStyle: { color: '#333' } },
    backgroundColor: '#111',
    borderColor: '#333',
    textStyle: { color: '#ccc', fontSize: 9, fontFamily: 'monospace' },
  },
  dataZoom: [
    { type: 'inside', xAxisIndex: 'all', start: 0, end: 100 },
    { type: 'slider', xAxisIndex: 'all', height: 16, bottom: 0, borderColor: '#2a2a2a', backgroundColor: '#111', fillerColor: 'rgba(100,200,100,0.08)', dataBackground: { lineStyle: { color: '#333' }, areaStyle: { color: '#1a1a1a' } }, handleStyle: { color: '#444' }, textStyle: { color: '#555', fontSize: 8 } },
  ],
};

// ── useEChart hook ──────────────────────────────────────────────────────────
function useEChart(containerRef, options) {
  let chart = null;

  onMount(() => {
    const el = containerRef();
    if (!el) return;
    chart = echarts.init(el, null, { renderer: 'canvas' });
    if (options()) chart.setOption(options(), true);

    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(el);
    onCleanup(() => { ro.disconnect(); chart?.dispose(); chart = null; });
  });

  createEffect(() => {
    const opts = options();
    if (chart && opts) chart.setOption(opts, true);
  });
}

// ── EChart wrapper component ────────────────────────────────────────────────
function EChart({ options, height = 200, class: cls = '' }) {
  let divRef;
  const [ref, setRef] = createSignal(null);

  onMount(() => setRef(divRef));

  let chart = null;
  createEffect(() => {
    const el = ref();
    if (!el) return;
    if (!chart) {
      chart = echarts.init(el, null, { renderer: 'canvas' });
      const ro = new ResizeObserver(() => chart?.resize());
      ro.observe(el);
      onCleanup(() => { ro.disconnect(); chart?.dispose(); chart = null; });
    }
    const opts = options();
    if (opts) chart.setOption(opts, true);
  });

  return (
    <div
      ref={divRef}
      class={cls}
      style={{ width: '100%', height: `${height}px` }}
    />
  );
}

// ── Candlestick + Volume + Overlays chart ────────────────────────────────────
function CandlestickChart({ data }) {
  const options = () => {
    if (!data()) return null;
    const d = data();
    const dates  = d.dates || [];
    const ohlcv  = d.ohlcv || {};
    const ind    = d.indicators || {};
    const n = dates.length;

    const ohlcData = dates.map((_, i) => [
      ohlcv.open?.[i], ohlcv.close?.[i], ohlcv.low?.[i], ohlcv.high?.[i]
    ]);
    const volData = (ohlcv.volume || []).map((v, i) => ({
      value: v,
      itemStyle: { color: (ohlcv.close?.[i] ?? 0) >= (ohlcv.open?.[i] ?? 0) ? '#00c85366' : '#ff174466' }
    }));

    const makeLine = (arr, name, color, width = 1, dash = null) => ({
      name, type: 'line', data: arr, smooth: false,
      lineStyle: { color, width, type: dash || 'solid' },
      symbol: 'none', z: 3,
    });

    const volumes   = ohlcv.volume || [];
    const maxVol    = Math.max(...volumes.filter(Number.isFinite));

    return {
      backgroundColor: 'transparent',
      animation: false,
      legend: {
        data: ['Price', 'SMA20', 'SMA50', 'EMA9', 'BB Upper', 'BB Lower'],
        inactiveColor: '#333',
        textStyle: { color: '#555', fontSize: 8, fontFamily: 'monospace' },
        top: 2, right: 70,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: '#111', borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 9, fontFamily: 'monospace' },
        formatter: (params) => {
          const p = params.find(x => x.seriesName === 'Price') || params[0];
          if (!p) return '';
          const vals = Array.isArray(p.value) ? p.value : [];
          // ECharts candlestick value is [index, open, close, low, high]
          const [open, close, low, high] = vals.length >= 5 ? vals.slice(1) : vals;
          const vol = volumes[p.dataIndex];
          return `<b>${p.axisValue}</b><br/>O:${fmt(open)} H:${fmt(high)} L:${fmt(low)} C:${fmt(close)}<br/>Vol:${fmtBig(vol)}`;
        },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 },
        { type: 'slider', xAxisIndex: [0, 1], height: 14, bottom: 0, borderColor: '#222', backgroundColor: '#0d0d0d', fillerColor: 'rgba(100,180,100,0.07)', handleStyle: { color: '#333' }, textStyle: { color: '#444', fontSize: 8 } },
      ],
      grid: [
        { left: 8, right: 70, top: 28, bottom: 60, containLabel: false },     // price
        { left: 8, right: 70, top: '82%', bottom: 40, containLabel: false },  // volume
      ],
      xAxis: [
        { type: 'category', data: dates, gridIndex: 0, axisLine: { lineStyle: { color: '#2a2a2a' } }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
        { type: 'category', data: dates, gridIndex: 1, axisLine: { lineStyle: { color: '#2a2a2a' } }, axisTick: { show: false }, axisLabel: { color: '#444', fontSize: 8, fontFamily: 'monospace', interval: Math.ceil(n / 8), formatter: v => v.slice(5) }, splitLine: { show: false } },
      ],
      yAxis: [
        { type: 'value', scale: true, gridIndex: 0, position: 'right', splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { color: '#555', fontSize: 9, fontFamily: 'monospace' }, axisLine: { show: false }, axisTick: { show: false } },
        { type: 'value', gridIndex: 1, max: maxVol * 4, show: false },
      ],
      series: [
        {
          name: 'Price', type: 'candlestick', data: ohlcData, xAxisIndex: 0, yAxisIndex: 0,
          itemStyle: { color: '#00c853', color0: '#ff1744', borderColor: '#00c853', borderColor0: '#ff1744' },
        },
        { name: 'Volume', type: 'bar', data: volData, xAxisIndex: 1, yAxisIndex: 1, barMaxWidth: 6 },
        makeLine(ind?.sma?.sma20, 'SMA20',    '#ffeb3b', 1.2),
        makeLine(ind?.sma?.sma50, 'SMA50',    '#f97316', 1.0, 'dashed'),
        makeLine(ind?.ema?.ema9,  'EMA9',     '#e040fb', 0.9, 'dotted'),
        makeLine(ind?.bb?.upper,  'BB Upper', '#607d8b80', 0.8),
        makeLine(ind?.bb?.lower,  'BB Lower', '#607d8b80', 0.8),
        // BB area
        {
          name: 'BB Area', type: 'line', data: ind?.bb?.upper || [], symbol: 'none',
          lineStyle: { opacity: 0 }, z: 1,
          areaStyle: { color: 'rgba(96,125,139,0.05)', origin: 'auto' }, stack: null,
        },
      ],
    };
  };
  return <EChart options={options} height={380} />;
}

// ── MACD chart ───────────────────────────────────────────────────────────────
function MACDChart({ data }) {
  const options = () => {
    if (!data()) return null;
    const d = data();
    const dates = d.dates || [];
    const macd  = d.indicators?.macd || {};
    const hist  = (macd.hist || []).map((v, i) => ({
      value: v,
      itemStyle: { color: (v ?? 0) >= 0 ? '#00c85399' : '#ff174499' },
    }));
    return {
      ...BASE_OPTS,
      legend: { data: ['MACD', 'Signal'], textStyle: { color: '#555', fontSize: 8 }, top: 2, right: 70, inactiveColor: '#333' },
      tooltip: { ...BASE_OPTS.tooltip, trigger: 'axis' },
      grid: { left: 8, right: 70, top: 22, bottom: 28, containLabel: false },
      xAxis: { ...BASE_OPTS.xAxis, data: dates, axisLabel: { ...BASE_OPTS.xAxis.axisLabel, interval: Math.ceil(dates.length / 8), formatter: v => v.slice(5) } },
      series: [
        { name: 'Histogram', type: 'bar', data: hist, barMaxWidth: 4, z: 1 },
        { name: 'MACD',   type: 'line', data: macd.line   || [], symbol: 'none', smooth: false, lineStyle: { color: '#2196f3', width: 1.5 }, z: 3 },
        { name: 'Signal', type: 'line', data: macd.signal || [], symbol: 'none', smooth: false, lineStyle: { color: '#ff9800', width: 1.2 }, z: 3 },
        { name: 'Zero',   type: 'line', data: dates.map(() => 0), symbol: 'none', lineStyle: { color: '#ffffff15', width: 0.5, type: 'dashed' } },
      ],
    };
  };
  return <EChart options={options} height={180} />;
}

// ── Generic single-line indicator chart ────────────────────────────────────
function LineChart({ data, name, color, overbought, oversold, height = 90 }) {
  const options = () => {
    if (!data()) return null;
    const d = data();
    const dates = d.dates || [];
    const series = [
      {
        name, type: 'line',
        data: (d.values || []),
        symbol: 'none', smooth: false,
        lineStyle: { color, width: 1.5 },
        areaStyle: { color: color + '18', origin: 'auto' },
      },
    ];
    const markLines = [];
    if (overbought != null) markLines.push({ yAxis: overbought, lineStyle: { color: '#ff174430', type: 'dashed', width: 0.8 }, label: { formatter: String(overbought), color: '#ff1744', fontSize: 8 } });
    if (oversold   != null) markLines.push({ yAxis: oversold,   lineStyle: { color: '#00c85330', type: 'dashed', width: 0.8 }, label: { formatter: String(oversold),   color: '#00c853', fontSize: 8 } });
    if (markLines.length) series[0].markLine = { silent: true, symbol: 'none', data: markLines };

    return {
      ...BASE_OPTS,
      grid: { left: 8, right: 70, top: 8, bottom: 24, containLabel: false },
      xAxis: { ...BASE_OPTS.xAxis, data: dates, axisLabel: { ...BASE_OPTS.xAxis.axisLabel, interval: Math.ceil(dates.length / 8), formatter: v => v.slice(5) } },
      series,
    };
  };
  return <EChart options={options} height={height} />;
}

// ── Volume OBV chart (bar) ────────────────────────────────────────────────
function OBVChart({ data }) {
  const options = () => {
    if (!data()) return null;
    const d = data();
    const dates = d.dates || [];
    const obv   = d.indicators?.obv || [];
    const obvEma = (d.indicators?.obv_ema || []);
    return {
      ...BASE_OPTS,
      grid: { left: 8, right: 70, top: 8, bottom: 24, containLabel: false },
      xAxis: { ...BASE_OPTS.xAxis, data: dates, axisLabel: { ...BASE_OPTS.xAxis.axisLabel, interval: Math.ceil(dates.length / 8), formatter: v => v.slice(5) } },
      tooltip: { ...BASE_OPTS.tooltip, trigger: 'axis' },
      series: [
        {
          name: 'OBV', type: 'line', data: obv, symbol: 'none',
          lineStyle: { color: '#00bcd4', width: 1.5 },
          areaStyle: { color: '#00bcd418', origin: 'auto' },
        },
        { name: 'OBV EMA', type: 'line', data: obvEma, symbol: 'none', lineStyle: { color: '#888', width: 1, type: 'dashed' } },
      ],
    };
  };
  return <EChart options={options} height={200} />;
}

// ── Data Table ──────────────────────────────────────────────────────────────
function DataTable({ title, color = '#60a5fa', headers, rows, compact = false }) {
  return (
    <div class="bg-black/30 border border-border_main overflow-hidden">
      <div class="px-4 py-2 border-b border-border_main flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div class="w-1 h-4" style={{ background: color }} />
        <span class="text-[9px] font-black tracking-[0.2em] uppercase text-white">{title}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-[9px] font-mono">
          <thead>
            <tr class="border-b border-border_main/30">
              {headers.map(h => <th class="px-3 py-1.5 text-left text-text_secondary/50 font-black uppercase tracking-wider">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr class={`border-b border-border_main/10 hover:bg-white/3 transition-colors ${i % 2 === 0 ? 'bg-black/10' : ''}`}>
                {row.map((cell, ci) => (
                  <td class={`px-3 ${compact ? 'py-1' : 'py-1.5'} ${ci === 0 ? 'text-text_secondary font-bold' : 'text-text_primary'}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Chart Panel wrapper ─────────────────────────────────────────────────────
function ChartPanel({ label, color, children }) {
  return (
    <div class="bg-black/40 border border-border_main">
      <div class="px-3 py-1.5 border-b border-border_main/40 flex items-center gap-2">
        <div class="w-1 h-3" style={{ background: color }} />
        <span class="text-[8px] font-black text-white/60 tracking-[0.2em] uppercase">{label}</span>
      </div>
      <div class="p-1">{children}</div>
    </div>
  );
}

// ── Score Gauge ─────────────────────────────────────────────────────────────
function ScoreGauge({ pct, verdict }) {
  const color = verdict?.includes('BUY') ? '#00c853' : verdict?.includes('SELL') ? '#ff1744' : '#ffeb3b';
  return (
    <div class="flex flex-col items-center gap-1">
      <div class="relative w-20 h-20">
        <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1a1a1a" stroke-width="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} stroke-width="3"
            stroke-dasharray={`${pct || 0} 100`} stroke-linecap="round" />
        </svg>
        <span class="absolute inset-0 flex items-center justify-center text-[11px] font-black" style={{ color }}>{fmt(pct, 0)}%</span>
      </div>
      <span class="text-[10px] font-black tracking-widest" style={{ color }}>{verdict}</span>
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div class="bg-black/40 border border-border_main p-3 flex flex-col gap-1 hover:border-text_accent/40 transition-all">
      <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">{label}</span>
      <span class={`text-[14px] font-black font-mono ${color || 'text-text_primary'}`}>{value}</span>
      {sub && <span class="text-[9px] text-text_secondary/50 font-mono">{sub}</span>}
    </div>
  );
}

// ── Signal Badge ─────────────────────────────────────────────────────────────
function SignalBadge({ val }) {
  const txt = val === 1 ? 'BUY' : val === -1 ? 'SELL' : 'NEUTRAL';
  const cls = val === 1 ? 'bg-green-500/20 text-green-400 border-green-500/40'
    : val === -1 ? 'bg-red-500/20 text-red-400 border-red-500/40'
    : 'bg-white/5 text-text_secondary border-white/10';
  return <span class={`px-2 py-0.5 text-[8px] font-black tracking-widest border uppercase ${cls}`}>{txt}</span>;
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PANEL
// ══════════════════════════════════════════════════════════════════════════════
export default function TechnicalAnalysisPanel({ symbol: symbolProp, showToolbar = true }) {
  const [symbol,   setSymbol]   = createSignal(symbolProp || 'MSFT');
  const [inputVal, setInputVal] = createSignal(symbolProp || 'MSFT');
  const [period,   setPeriod]   = createSignal('6mo');
  const [data,     setData]     = createSignal(null);
  const [loading,  setLoading]  = createSignal(false);
  const [error,    setError]    = createSignal(null);
  const [activeTab, setActiveTab] = createSignal('charts');

  const fetchData = async () => {
    if (!symbol()) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${TA_API}/api/ta/analyze/${symbol()}?period=${period()}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Sync external symbol prop (entity view)
  createEffect(() => {
    const s = symbolProp;
    if (s && s !== symbol()) { setSymbol(s); setInputVal(s); }
  });

  onMount(fetchData);
  createEffect(() => { symbol(); period(); fetchData(); });

  const d   = () => data();
  const cur = () => d()?.current || {};
  const sig = () => d()?.signals || {};
  const inf = () => d()?.info || {};
  const fib = () => d()?.fibonacci || {};
  const sr  = () => d()?.support_resistance || {};
  const ret = () => d()?.returns || {};
  const ma  = () => d()?.ma_table || {};
  const ind = () => d()?.indicators || {};

  const TABS = [
    { id: 'charts',      label: 'Charts' },
    { id: 'overview',    label: 'Overview' },
    { id: 'oscillators', label: 'Oscillators' },
    { id: 'trend',       label: 'Trend & Vol' },
    { id: 'volume',      label: 'Volume & Flow' },
    { id: 'ichimoku',    label: 'Ichimoku' },
    { id: 'levels',      label: 'S/R & Fib' },
    { id: 'signals',     label: 'Signals' },
  ];

  return (
    <div class="flex flex-col h-full overflow-hidden bg-bg_main font-mono text-text_primary">

      {/* Toolbar (standalone mode) */}
      <Show when={showToolbar}>
        <div class="h-11 border-b border-border_main bg-bg_header/60 shrink-0 flex items-center gap-4 px-4">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-text_accent animate-pulse shadow-[0_0_6px_var(--text-accent)]" />
            <span class="text-[9px] font-black tracking-[0.3em] text-text_primary">TECHNICAL_ANALYSIS</span>
          </div>
          <div class="h-4 w-px bg-border_main" />
          <div class="flex items-center gap-2">
            <input
              value={inputVal()}
              onInput={(e) => setInputVal(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') setSymbol(inputVal()); }}
              class="bg-black/60 border border-border_main px-3 py-1 text-[10px] font-mono text-text_accent w-28 focus:outline-none focus:border-text_accent uppercase"
              placeholder="TICKER..."
            />
            <button
              onClick={() => setSymbol(inputVal())}
              class="px-3 py-1 bg-text_accent text-bg_main font-black text-[9px] tracking-widest hover:opacity-80 transition-all"
            >ANALYZE</button>
          </div>
          <div class="h-4 w-px bg-border_main" />
          <div class="flex items-center gap-1">
            <For each={PERIODS}>{(p) => (
              <button
                onClick={() => setPeriod(p.id)}
                class={`px-2 py-1 text-[8px] font-black tracking-widest border transition-all ${period() === p.id ? 'bg-text_accent text-bg_main border-text_accent' : 'border-transparent text-text_secondary opacity-40 hover:opacity-100'}`}
              >{p.label}</button>
            )}</For>
          </div>
          <Show when={d()}>
            <div class="ml-auto text-[8px] text-text_secondary opacity-40">{d().period_start} → {d().period_end} // {d().trading_days}D</div>
          </Show>
        </div>
      </Show>

      {/* Compact bar (embedded mode) */}
      <Show when={!showToolbar}>
        <div class="h-10 border-b border-border_main bg-bg_header/60 shrink-0 flex items-center gap-3 px-3">
          <Show when={d()}>
            <span class="text-[10px] font-black text-text_accent">{d().symbol}</span>
            <span class={`text-[10px] font-bold ${signColor(ret()?.r1d)}`}>{fmtPct(ret()?.r1d)}</span>
            <span class="text-[8px] text-text_secondary">{d().period_start} → {d().period_end}</span>
          </Show>
          <div class="ml-auto flex items-center gap-1">
            <For each={PERIODS}>{(p) => (
              <button
                onClick={() => setPeriod(p.id)}
                class={`px-2 py-0.5 text-[8px] font-black tracking-wider border transition-all ${period() === p.id ? 'bg-text_accent text-bg_main border-text_accent' : 'border-transparent text-text_secondary opacity-40 hover:opacity-100'}`}
              >{p.label}</button>
            )}</For>
          </div>
        </div>
      </Show>

      {/* Loading */}
      <Show when={loading()}>
        <div class="flex-1 flex flex-col items-center justify-center gap-3">
          <div class="w-8 h-8 border-2 border-text_accent border-t-transparent rounded-full animate-spin" />
          <span class="text-[9px] font-black text-text_accent animate-pulse tracking-[0.4em]">COMPUTING_MATRIX...</span>
        </div>
      </Show>

      {/* Error */}
      <Show when={error() && !loading()}>
        <div class="flex-1 flex items-center justify-center">
          <div class="border border-red-500/40 bg-red-500/10 px-8 py-5 text-center">
            <div class="text-red-400 font-black text-[10px] tracking-widest">SIGNAL_ERROR</div>
            <div class="text-red-400/60 text-[9px] mt-2">{error()}</div>
            <button onClick={fetchData} class="mt-3 px-4 py-1 border border-red-500/40 text-red-400 text-[9px] hover:bg-red-500 hover:text-white transition-all">RETRY</button>
          </div>
        </div>
      </Show>

      <Show when={d() && !loading()}>
        {/* Hero bar */}
        <div class="shrink-0 border-b border-border_main bg-black/20 px-4 py-2 flex items-center gap-4">
          <div class="flex flex-col">
            <span class="text-[16px] font-black text-text_accent">{d().symbol}</span>
            <span class="text-[8px] text-text_secondary truncate max-w-[140px]">{inf().name}</span>
          </div>
          <div class="h-8 w-px bg-border_main" />
          <div class="flex flex-col">
            <span class="text-[20px] font-black text-text_primary">{fmt(cur().price, 2)}</span>
            <span class={`text-[9px] font-bold ${signColor(ret()?.r1d)}`}>{fmtPct(ret()?.r1d)} TODAY</span>
          </div>
          <div class="grid grid-cols-4 gap-2 ml-3">
            <StatCard label="MARKET_CAP" value={fmtBig(inf().market_cap)} />
            <StatCard label="ATR(14)"    value={fmt(cur().atr)} sub={`${fmt(cur().atr_pct)}%`} />
            <StatCard label="HV_20D"     value={`${fmt(cur().hv20)}%`} />
            <StatCard label="SECTOR"     value={inf().sector || 'N/A'} />
          </div>
          <div class="ml-auto"><ScoreGauge pct={sig().pct} verdict={sig().verdict} /></div>
        </div>

        {/* Tab Nav */}
        <div class="shrink-0 border-b border-border_main flex items-center gap-0.5 px-3 bg-bg_header/30">
          <For each={TABS}>{(t) => (
            <button
              onClick={() => setActiveTab(t.id)}
              class={`px-3 py-2 text-[8px] font-black tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab() === t.id ? 'text-text_accent border-text_accent' : 'text-text_secondary border-transparent opacity-40 hover:opacity-80'}`}
            >{t.label.toUpperCase()}</button>
          )}</For>
        </div>

        {/* Tab content */}
        <div class="flex-1 overflow-y-auto win-scroll">

          {/* ═══ CHARTS ═════════════════════════════════════════════ */}
          <Show when={activeTab() === 'charts'}>
            <div class="p-3 space-y-2">
              <ChartPanel label={`PRICE ACTION — ${d().symbol} // SMA20 · SMA50 · EMA9 · Bollinger Bands`} color="#00c853">
                <CandlestickChart data={d} />
              </ChartPanel>
              <ChartPanel label="MACD — Histogram + Signal + Line" color="#2196f3">
                <MACDChart data={d} />
              </ChartPanel>
              <div class="grid grid-cols-2 gap-2">
                <ChartPanel label="RSI (14) — 70 / 30 zones" color="#ab47bc">
                  <LineChart
                    data={() => ({ dates: d().dates, values: ind()?.rsi?.rsi14 })}
                    name="RSI(14)" color="#ab47bc" overbought={70} oversold={30} height={150}
                  />
                </ChartPanel>
                <ChartPanel label="Stochastic %K — 80 / 20 zones" color="#2196f3">
                  <LineChart
                    data={() => ({ dates: d().dates, values: ind()?.stoch?.k })}
                    name="Stoch%K" color="#2196f3" overbought={80} oversold={20} height={150}
                  />
                </ChartPanel>
                <ChartPanel label="ADX (14) — threshold 25" color="#ffeb3b">
                  <LineChart
                    data={() => ({ dates: d().dates, values: ind()?.adx?.adx })}
                    name="ADX(14)" color="#ffeb3b" overbought={40} oversold={25} height={150}
                  />
                </ChartPanel>
                <ChartPanel label="CCI (20) — ±100 zones" color="#e040fb">
                  <LineChart
                    data={() => ({ dates: d().dates, values: ind()?.cci })}
                    name="CCI(20)" color="#e040fb" overbought={100} oversold={-100} height={150}
                  />
                </ChartPanel>
              </div>
            </div>
          </Show>

          {/* ═══ OVERVIEW ════════════════════════════════════════════ */}
          <Show when={activeTab() === 'overview'}>
            <div class="p-3 space-y-3">
              <div class="grid grid-cols-6 gap-2">
                <StatCard label="OPEN"   value={fmt(cur().open)} />
                <StatCard label="HIGH"   value={fmt(cur().high)} color="text-green-400" />
                <StatCard label="LOW"    value={fmt(cur().low)}  color="text-red-400" />
                <StatCard label="VOLUME" value={fmtBig(cur().volume)} />
                <StatCard label="VWAP"   value={fmt(cur().vwap)} />
                <StatCard label="SAR"    value={fmt(cur().sar)}  sub={cur().price > cur().sar ? 'BULLISH' : 'BEARISH'} color={cur().price > cur().sar ? 'text-green-400' : 'text-red-400'} />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <DataTable title="01 // STOCK_OVERVIEW" color="#60a5fa" headers={['Parameter', 'Value']} rows={[
                  ['Symbol',      d().symbol],
                  ['Company',     inf().name || 'N/A'],
                  ['Sector',      inf().sector || 'N/A'],
                  ['Industry',    inf().industry || 'N/A'],
                  ['Market Cap',  fmtBig(inf().market_cap)],
                  ['Period',      `${d().period_start} → ${d().period_end}`],
                  ['Trading Days',`${d().trading_days} days`],
                  ['Period High', fmt(Math.max(...(d().ohlcv?.high||[])))],
                  ['Period Low',  fmt(Math.min(...(d().ohlcv?.low||[])))],
                ]} />
                <DataTable title="02 // PRICE_PERFORMANCE" color="#34d399" headers={['Period', 'Return', '']} rows={[
                  ['1 Day',   <span class={signColor(ret()?.r1d)}>{fmtPct(ret()?.r1d)}</span>,   ret()?.r1d >= 0 ? '🟢' : '🔴'],
                  ['5 Days',  <span class={signColor(ret()?.r5d)}>{fmtPct(ret()?.r5d)}</span>,   ret()?.r5d >= 0 ? '🟢' : '🔴'],
                  ['20 Days', <span class={signColor(ret()?.r20d)}>{fmtPct(ret()?.r20d)}</span>, ret()?.r20d >= 0 ? '🟢' : '🔴'],
                  ['60 Days', <span class={signColor(ret()?.r60d)}>{fmtPct(ret()?.r60d)}</span>, ret()?.r60d >= 0 ? '🟢' : '🔴'],
                  ['Period',  <span class={signColor(ret()?.r6mo)}>{fmtPct(ret()?.r6mo)}</span>, ret()?.r6mo >= 0 ? '🟢' : '🔴'],
                  ['HV 20D',  `${fmt(cur().hv20)}%`, '📊'],
                  ['ATR (14)', fmt(cur().atr), '📊'],
                ]} />
              </div>
              <DataTable title="03 // MOVING_AVERAGES_ANALYSIS" color="#fbbf24"
                headers={['MA Type', 'Value', 'Distance', '% Diff', 'Status']}
                rows={Object.entries(ma()).map(([k, v]) => [
                  k.toUpperCase(),
                  v ? fmt(v.value) : 'N/A',
                  v ? <span class={signColor(v.diff)}>{fmt(v.diff, 2)}</span> : '-',
                  v ? <span class={signColor(v.pct)}>{fmtPct(v.pct)}</span> : '-',
                  v ? (v.above ? <span class="text-green-400">ABOVE ✅</span> : <span class="text-red-400">BELOW ❌</span>) : '-',
                ])}
              />
            </div>
          </Show>

          {/* ═══ OSCILLATORS ══════════════════════════════════════════ */}
          <Show when={activeTab() === 'oscillators'}>
            <div class="p-3 space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <DataTable title="04 // OSCILLATOR_INDICATORS" color="#a78bfa"
                  headers={['Indicator', 'Value', 'Status']}
                  rows={[
                    ['RSI (14)',     fmt(cur().rsi14),   cur().rsi14 > 70 ? '⚠️ OVERBOUGHT' : cur().rsi14 < 30 ? '🟢 OVERSOLD' : '⚪ NEUTRAL'],
                    ['Stoch %K',    fmt(cur().stoch_k), cur().stoch_k > 80 ? '⚠️ OVERBOUGHT' : cur().stoch_k < 20 ? '🟢 OVERSOLD' : '⚪'],
                    ['CCI (20)',     fmt(cur().cci),     cur().cci > 100 ? '⚠️ OB' : cur().cci < -100 ? '🟢 OS' : '⚪'],
                    ['Williams %R', fmt(cur().willr),   cur().willr > -20 ? '⚠️ OB' : cur().willr < -80 ? '🟢 OS' : '⚪'],
                    ['MFI (14)',     fmt(cur().mfi),     cur().mfi > 80 ? '⚠️ OB' : cur().mfi < 20 ? '🟢 OS' : '⚪'],
                  ]}
                />
                <div class="space-y-2">
                  <ChartPanel label="RSI (14)" color="#ab47bc">
                    <LineChart data={() => ({ dates: d().dates, values: ind()?.rsi?.rsi14 })} name="RSI" color="#ab47bc" overbought={70} oversold={30} height={150} />
                  </ChartPanel>
                  <ChartPanel label="Stochastic %K" color="#2196f3">
                    <LineChart data={() => ({ dates: d().dates, values: ind()?.stoch?.k })} name="Stoch%K" color="#2196f3" overbought={80} oversold={20} height={150} />
                  </ChartPanel>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <ChartPanel label="CCI (20)" color="#e040fb">
                  <LineChart data={() => ({ dates: d().dates, values: ind()?.cci })} name="CCI" color="#e040fb" overbought={100} oversold={-100} height={150} />
                </ChartPanel>
                <ChartPanel label="Williams %R" color="#f97316">
                  <LineChart data={() => ({ dates: d().dates, values: ind()?.willr })} name="WillR" color="#f97316" overbought={-20} oversold={-80} height={150} />
                </ChartPanel>
              </div>
            </div>
          </Show>

          {/* ═══ TREND & VOLATILITY ════════════════════════════════ */}
          <Show when={activeTab() === 'trend'}>
            <div class="p-3 space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <DataTable title="05 // MOMENTUM_&_TREND" color="#fbbf24"
                  headers={['Indicator', 'Value', 'Signal']}
                  rows={[
                    ['MACD Line',   fmt(cur().macd, 4),      cur().macd > cur().macd_sig ? '🟢 BULLISH' : '🔴 BEARISH'],
                    ['MACD Signal', fmt(cur().macd_sig, 4),  '—'],
                    ['MACD Hist',   fmt(cur().macd_hist, 4), cur().macd_hist > 0 ? '🟢 POSITIVE' : '🔴 NEGATIVE'],
                    ['ADX (14)',    fmt(cur().adx),           cur().adx > 25 ? '💪 STRONG' : '➡️ WEAK'],
                    ['+DI',        fmt(cur().plus_di),       cur().plus_di > cur().minus_di ? '🟢 BULL' : '🔴 BEAR'],
                    ['-DI',        fmt(cur().minus_di),      '—'],
                    ['SAR',        fmt(cur().sar),            cur().price > cur().sar ? '🟢 BULLISH' : '🔴 BEARISH'],
                    ['VWAP',       fmt(cur().vwap),           cur().price > cur().vwap ? '🟢 ABOVE' : '🔴 BELOW'],
                  ]}
                />
                <DataTable title="06 // VOLATILITY" color="#f87171"
                  headers={['Indicator', 'Value', 'Notes']}
                  rows={[
                    ['ATR (14)',  fmt(cur().atr, 4),      'Daily range'],
                    ['ATR %',    `${fmt(cur().atr_pct)}%`,'% of price'],
                    ['HV 20D',   `${fmt(cur().hv20)}%`,   'Annualized'],
                    ['BB Width', fmt(cur().bb_width, 4),  'Squeeze indicator'],
                    ['BB %B',    fmt(cur().bb_pct, 4),    cur().bb_pct > 0.8 ? '⚠️ NEAR UPPER' : cur().bb_pct < 0.2 ? '🟢 NEAR LOWER' : '—'],
                    ['BB Upper', fmt(cur().bb_upper),     'Resistance'],
                    ['BB Lower', fmt(cur().bb_lower),     'Support'],
                  ]}
                />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <ChartPanel label="MACD — Line + Signal + Histogram" color="#2196f3">
                  <MACDChart data={d} />
                </ChartPanel>
                <ChartPanel label="ADX (14) — trend strength" color="#ffeb3b">
                  <LineChart data={() => ({ dates: d().dates, values: ind()?.adx?.adx })} name="ADX" color="#ffeb3b" oversold={25} overbought={40} height={150} />
                </ChartPanel>
              </div>
            </div>
          </Show>

          {/* ═══ VOLUME & FLOW ════════════════════════════════════ */}
          <Show when={activeTab() === 'volume'}>
            <div class="p-3 space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <DataTable title="07 // VOLUME_INDICATORS" color="#00bcd4"
                  headers={['Indicator', 'Value', 'Signal']}
                  rows={[
                    ['Volume',      fmtN(cur().volume),    '—'],
                    ['Vol SMA(20)', fmtN(cur().vol_sma20), '—'],
                    ['Vol Ratio',   `${fmt(cur().vol_ratio, 2)}x`, cur().vol_ratio > 1.5 ? '⚡ HIGH' : cur().vol_ratio < 0.7 ? '💤 LOW' : 'NORMAL'],
                    ['OBV',         fmtN(cur().obv),        cur().obv > cur().obv_ema ? '🟢 ACCUMULATION' : '🔴 DISTRIBUTION'],
                    ['MFI (14)',    fmt(cur().mfi),          cur().mfi > 80 ? '⚠️ OB' : cur().mfi < 20 ? '🟢 OS' : '⚪'],
                  ]}
                />
                <ChartPanel label="VOLUME BAR + SMA20" color="#00bcd4">
                  {/* using dedicated volume panel from main candlestick */}
                  <LineChart data={() => ({ dates: d().dates, values: ind()?.volume?.sma20 })} name="Vol SMA20" color="#00bcd480" height={250} />
                </ChartPanel>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <ChartPanel label="OBV — On-Balance Volume" color="#00bcd4">
                  <OBVChart data={d} />
                </ChartPanel>
                <ChartPanel label="MFI (14) — Money Flow Index" color="#e040fb">
                  <LineChart data={() => ({ dates: d().dates, values: ind()?.mfi })} name="MFI" color="#e040fb" overbought={80} oversold={20} height={200} />
                </ChartPanel>
              </div>
            </div>
          </Show>

          {/* ═══ ICHIMOKU ════════════════════════════════════════ */}
          <Show when={activeTab() === 'ichimoku'}>
            <div class="p-3 space-y-3">
              <DataTable title="08 // ICHIMOKU_CLOUD_ANALYSIS" color="#38bdf8"
                headers={['Component', 'Value', 'Signal']}
                rows={[
                  ['Tenkan-sen (9)',  fmt(cur().tenkan),   cur().tenkan > cur().kijun ? '🟢 BULLISH TK' : '🔴 BEARISH TK'],
                  ['Kijun-sen (26)', fmt(cur().kijun),    '—'],
                  ['Senkou Span A',  fmt(cur().senkou_a), '—'],
                  ['Senkou Span B',  fmt(cur().senkou_b), '—'],
                  ['Cloud Color',   cur().senkou_a > cur().senkou_b ? '🟢 GREEN (Bullish)' : '🔴 RED (Bearish)', ''],
                  ['Price vs Cloud', cur().price > cur().senkou_a && cur().price > cur().senkou_b ? '🟢 ABOVE CLOUD'
                    : cur().price < cur().senkou_a && cur().price < cur().senkou_b ? '🔴 BELOW CLOUD' : '⚪ INSIDE', ''],
                ]}
              />
              <ChartPanel label="PRICE ACTION — Candles + SMA20 + SMA50 (Ichimoku reference)" color="#38bdf8">
                <CandlestickChart data={d} />
              </ChartPanel>
            </div>
          </Show>

          {/* ═══ S/R & FIBONACCI ════════════════════════════════ */}
          <Show when={activeTab() === 'levels'}>
            <div class="p-3 space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <DataTable title="09 // SUPPORT_&_RESISTANCE" color="#f87171"
                  headers={['Level', 'Price', 'Distance', 'Type']}
                  rows={[
                    ...(sr().resistances || []).map(r => ['🔴 Resistance', fmt(r), <span class="text-green-400">{fmtPct((r - cur().price)/cur().price*100)}</span>, 'OVERHEAD']),
                    ['⚡ CURRENT', <span class="text-text_accent font-black">{fmt(cur().price)}</span>, '—', '—'],
                    ...(sr().supports || []).map(s => ['🟢 Support', fmt(s), <span class="text-red-400">{fmtPct((s - cur().price)/cur().price*100)}</span>, 'FLOOR']),
                  ]}
                />
                <DataTable title="10 // FIBONACCI_RETRACEMENT" color="#fbbf24"
                  headers={['Level', 'Price', 'Distance', '']}
                  rows={Object.entries(fib()?.levels || {}).map(([lvl, price]) => {
                    const dist = (price - cur().price) / cur().price * 100;
                    return [`Fib ${lvl}`, fmt(price), <span class={signColor(dist)}>{fmtPct(dist)}</span>, Math.abs(dist) < 1.5 ? <span class="text-text_accent">◄ NEAR</span> : '—'];
                  })}
                />
              </div>
              <div class="bg-black/30 border border-border_main p-2 flex gap-6 text-[9px]">
                <div><span class="text-text_secondary">Period High: </span><span class="text-red-400 font-bold">{fmt(fib()?.high)}</span></div>
                <div><span class="text-text_secondary">Period Low: </span><span class="text-green-400 font-bold">{fmt(fib()?.low)}</span></div>
                <div><span class="text-text_secondary">Range: </span><span class="font-bold">{fmt((fib()?.high||0) - (fib()?.low||0))}</span></div>
                <div><span class="text-text_secondary">Current: </span><span class="text-text_accent font-bold">{fmt(cur().price)}</span></div>
              </div>
            </div>
          </Show>

          {/* ═══ SIGNALS ═════════════════════════════════════════ */}
          <Show when={activeTab() === 'signals'}>
            <div class="p-3 space-y-3">
              <div class="border border-border_main bg-black/40 p-4 flex items-center gap-8">
                <ScoreGauge pct={sig().pct} verdict={sig().verdict} />
                <div class="flex flex-col gap-1">
                  <div class="text-[11px] font-black">COMPOSITE SIGNAL SCORE</div>
                  <div class="text-[9px] text-text_secondary">Total: <span class="text-text_accent font-black">{sig().total} / {sig().max}</span></div>
                  <div class="text-[9px] text-text_secondary">Strength: <span class="font-black">{fmt(sig().pct, 1)}%</span></div>
                </div>
                <div class="flex gap-6 ml-6">
                  {[['BUY', 1, 'text-green-400'], ['NEUTRAL', 0, 'text-text_secondary'], ['SELL', -1, 'text-red-400']].map(([lbl, v, cls]) => (
                    <div class="flex flex-col items-center gap-1">
                      <span class={`text-[18px] font-black ${cls}`}>{Object.values(sig().signals||{}).filter(x=>x===v).length}</span>
                      <span class={`text-[8px] ${cls} font-black`}>{lbl}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <DataTable title="11 // TRADING_SIGNALS_SUMMARY" color="#00c853"
                  headers={['Indicator', 'Signal', 'Score']}
                  rows={Object.entries(sig().signals || {}).map(([name, val]) => [
                    name,
                    <SignalBadge val={val} />,
                    <span class={`font-black ${signColor(val)}`}>{val > 0 ? '+1' : val < 0 ? '-1' : '0'}</span>
                  ])}
                />
                <DataTable title="12 // PROFESSIONAL_ANALYSIS_NOTES" color="#f59e0b"
                  headers={['Category', 'Observation']}
                  rows={[
                    ['TREND',     cur().price > (ma()?.sma50?.value||0) && (ma()?.sma20?.value||0) > (ma()?.sma50?.value||0) ? '📈 Uptrend — above key MAs' : cur().price < (ma()?.sma50?.value||0) ? '📉 Downtrend — below MAs' : '➡️ Consolidation'],
                    ['RSI',       cur().rsi14 > 70 ? `⚠️ RSI ${fmt(cur().rsi14)} Overbought` : cur().rsi14 < 30 ? `🟢 RSI ${fmt(cur().rsi14)} Oversold` : `⚪ RSI ${fmt(cur().rsi14)} Neutral`],
                    ['MACD',      cur().macd > cur().macd_sig ? '🟢 MACD Bullish — Above signal' : '🔴 MACD Bearish — Below signal'],
                    ['ADX',       cur().adx > 40 ? `💪 Very strong(${fmt(cur().adx)})` : cur().adx > 25 ? `📊 Moderate(${fmt(cur().adx)})` : `➡️ Weak(${fmt(cur().adx)})`],
                    ['VOLUME',    cur().vol_ratio > 1.5 ? `⚡ High ${fmt(cur().vol_ratio,1)}x avg` : cur().vol_ratio < 0.7 ? '💤 Low volume' : '📊 Normal'],
                    ['BOLLINGER', cur().bb_pct > 0.9 ? '⚠️ Near upper band' : cur().bb_pct < 0.1 ? '🟢 Near lower band' : '📊 Within bands'],
                    ['VWAP',      cur().price > cur().vwap ? `🟢 Above VWAP (${fmt(cur().vwap)})` : `🔴 Below VWAP (${fmt(cur().vwap)})`],
                    ['ATR RISK',  `Daily move: ${fmt(cur().atr_pct)}% | 2x ATR stop: ${fmt((cur().atr_pct||0)*2)}%`],
                  ]}
                />
              </div>
            </div>
          </Show>

        </div>
      </Show>
    </div>
  );
}
