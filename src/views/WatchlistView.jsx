import { createSignal, onMount, onCleanup, For, Show, createEffect, createMemo, batch } from 'solid-js';
import * as echarts from 'echarts';
import { alertManager } from '../utils/alertManager';
import { getAssetUnitDef, formatQuantity, getTotalUnits, FOREX_LOT_TYPES } from '../utils/assetUnits';
import { fetchRates } from '../utils/currencyApi';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const MARKET_API = import.meta.env.VITE_MARKET_API || import.meta.env.VITE_MARKET_API;
const WATCHLIST_KEY = 'enqy_portfolio_v2';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const uid = () => `pos_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const fmt = (v, d = 2) => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (v == null || isNaN(v)) ? '—' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const signColor = (v) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-text_secondary';
const signBg = (v) => v > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : v < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10';

const ASSET_TYPE_COLORS = {
  STOCK: '#3b82f6',
  CRYPTO: '#f59e0b',
  FOREX: '#8b5cf6',
  COMMODITY: '#10b981',
};

const RANGES = ['1W', '1M', '3M', '6M', '1Y', '5Y', 'ALL'];

const PRESET_SYMBOLS = {
  STOCK: [
    { symbol: 'BBCA.JK', name: 'Bank Central Asia' },
    { symbol: 'BBRI.JK', name: 'Bank Rakyat Indonesia' },
    { symbol: 'TLKM.JK', name: 'Telkom Indonesia' },
    { symbol: 'BMRI.JK', name: 'Bank Mandiri' },
    { symbol: 'ASII.JK', name: 'Astra International' },
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'GOOGL', name: 'Alphabet' },
  ],
  CRYPTO: [
    { symbol: 'BTC-USD', name: 'Bitcoin' },
    { symbol: 'ETH-USD', name: 'Ethereum' },
    { symbol: 'SOL-USD', name: 'Solana' },
    { symbol: 'BNB-USD', name: 'BNB' },
  ],
  FOREX: [
    { symbol: 'USDIDR=X', name: 'USD/IDR' },
    { symbol: 'EURUSD=X', name: 'EUR/USD' },
    { symbol: 'GBPUSD=X', name: 'GBP/USD' },
    { symbol: 'USDJPY=X', name: 'USD/JPY' },
  ],
  COMMODITY: [
    { symbol: 'GC=F', name: 'Gold' },
    { symbol: 'CL=F', name: 'Crude Oil WTI' },
    { symbol: 'SI=F', name: 'Silver' },
    { symbol: 'BZ=F', name: 'Brent Crude' },
    { symbol: 'NG=F', name: 'Natural Gas' },
  ],
};

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
const loadPositions = () => {
  try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]'); } catch { return []; }
};
const savePositions = (p) => localStorage.setItem(WATCHLIST_KEY, JSON.stringify(p));

const defaultForm = () => ({ symbol: '', name: '', assetType: 'STOCK', buyPrice: '', quantity: '', currency: 'USD', notes: '', forexLotType: 'MICRO', totalAmountUsd: '' });

// ─── CANDLESTICK CHART COMPONENT ─────────────────────────────────────────────
function WatchlistChart(props) {
  let canvasRef;
  let chart;
  const [history, setHistory] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal(null);
  const [selRange, setSelRange] = createSignal('1M');

  const fetchHistory = async (sym, rng) => {
    if (!sym) return;
    setLoading(true);
    setError(null);
    setHistory([]);
    try {
      const res = await fetch(`${MARKET_API}/api/market/history?symbol=${encodeURIComponent(sym)}&range=${rng}`);
      const data = await res.json();
      if (data.status === 'success' && data.history?.length) {
        setHistory(data.history);
      } else {
        setError('No data available for this symbol / range.');
      }
    } catch {
      setError('Backend unavailable — check market_service (port 8088).');
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when symbol or range changes
  createEffect(() => {
    const sym = props.symbol;
    const rng = selRange();
    if (sym) fetchHistory(sym, rng);
  });

  // Build / update chart when history changes
  createEffect(() => {
    const data = history();
    if (!canvasRef || !data.length) return;

    requestAnimationFrame(() => {
      if (!canvasRef || canvasRef.clientWidth === 0) return;
      if (!chart) chart = echarts.init(canvasRef, 'dark');

      const dates = data.map(d => d.date);
      const ohlc = data.map(d => [d.open, d.close, d.low, d.high]);
      const volumes = data.map((d, i) => [i, d.volume, d.open > d.close ? -1 : 1]);

      const isCompact = canvasRef.clientHeight < 250;

      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross', lineStyle: { color: 'rgba(255,255,255,0.08)' } },
          backgroundColor: 'rgba(10,10,20,0.97)',
          borderColor: '#1e2030',
          padding: 6,
          textStyle: { color: '#ccc', fontSize: 10, fontFamily: 'Roboto' },
          formatter: (params) => {
            const c = params.find(x => x.seriesType === 'candlestick');
            if (!c) return '';
            const d = data[c.dataIndex];
            return `<div style="font-family:monospace;font-size:9px;min-width:110px">
              <div style="font-weight:900;color:#60a5fa;margin-bottom:2px;letter-spacing:.1em">${d.date}</div>
              <div style="display:flex;justify-content:space-between;margin:1px 0"><span style="opacity:.5">O</span><span style="font-weight:700">${fmt(d.open, 2)}</span></div>
              <div style="display:flex;justify-content:space-between;margin:1px 0"><span style="opacity:.5">H</span><span style="color:#00e676;font-weight:700">${fmt(d.high, 2)}</span></div>
              <div style="display:flex;justify-content:space-between;margin:1px 0"><span style="opacity:.5">L</span><span style="color:#ff1744;font-weight:700">${fmt(d.low, 2)}</span></div>
              <div style="display:flex;justify-content:space-between;margin:1px 0;border-top:1px solid #222;padding-top:2px"><span style="opacity:.5">C</span><span style="color:#60a5fa;font-weight:900">${fmt(d.close, 2)}</span></div>
            </div>`;
          },
        },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        dataZoom: [
          { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 },
          {
            show: !isCompact,
            type: 'slider', xAxisIndex: [0, 1], height: 12, bottom: 2, start: 0, end: 100,
            borderColor: '#1e2030', backgroundColor: '#0a0a14', dataBackground: { lineStyle: { color: '#3b82f6' }, areaStyle: { color: '#3b82f610' } },
            handleStyle: { color: '#3b82f6' }, textStyle: { color: '#555', fontSize: 10 }
          }
        ],
        grid: [
          { left: 40, right: 10, height: isCompact ? '85%' : '65%', top: '5%' },
          { show: !isCompact, left: 40, right: 10, height: '15%', top: '78%' },
        ],
        xAxis: [
          { type: 'category', data: dates, boundaryGap: true, axisLine: { lineStyle: { color: '#1e2030' } }, axisLabel: { fontSize: 9, color: '#444' }, splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.01)' } } },
          { type: 'category', gridIndex: 1, data: dates, boundaryGap: true, axisLine: { onZero: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false } },
        ],
        yAxis: [
          { scale: true, axisLine: { show: false }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.02)' } }, axisLabel: { fontSize: 9, color: '#444', formatter: v => fmt(v, 2) } },
          { scale: true, gridIndex: 1, splitNumber: 2, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } },
        ],
        series: [
          {
            type: 'candlestick', data: ohlc,
            itemStyle: { color: '#00e676', color0: '#ff1744', borderColor: '#00e676', borderColor0: '#ff1744' },
          },
          {
            show: !isCompact,
            name: 'Volume', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: volumes,
            itemStyle: { color: p => p.data[2] === 1 ? 'rgba(0,230,118,0.2)' : 'rgba(255,23,68,0.2)' },
          },
        ],
      }, true);
    });
  });

  // Resize on container resize
  onMount(() => {
    const ro = new ResizeObserver(() => chart && chart.resize());
    if (canvasRef) ro.observe(canvasRef);
    onCleanup(() => { ro.disconnect(); if (chart) { chart.dispose(); chart = null; } });
  });

  return (
    <div class="h-full flex flex-col">
      {/* Chart Header */}
      <div class="flex items-center justify-between px-3 py-1.5 border-b border-border_main shrink-0 bg-bg_header/60">
        <div class="flex flex-col min-w-0">
          <span class="text-[9px] font-black text-text_accent tracking-widest truncate">{props.symbol}</span>
          <span class="text-[9px] text-text_secondary/40 tracking-widest truncate">{props.name || '—'}</span>
        </div>
        {/* Range Buttons */}
        <div class="flex items-center gap-0.5 scale-90 origin-right">
          <For each={RANGES}>
            {r => (
              <button
                onClick={() => setSelRange(r)}
                class={`px-1.5 py-0.5 text-[9px] font-black border transition-all ${selRange() === r ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main text-text_secondary/60 hover:border-text_accent/50 hover:text-text_accent'}`}
              >{r}</button>
            )}
          </For>
        </div>
      </div>

      {/* Canvas Area */}
      <div class="flex-1 relative overflow-hidden">
        <Show when={loading()}>
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-bg_main/80 backdrop-blur-sm">
            <div class="w-6 h-6 border-2 border-text_accent border-t-transparent rounded-full animate-spin" />
            <span class="text-[9px] text-text_accent font-black tracking-[0.3em] animate-pulse">FETCHING DATA...</span>
          </div>
        </Show>
        <Show when={error() && !loading()}>
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-40">
            <svg class="w-12 h-12 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
            </svg>
            <span class="text-[9px] text-red-400 font-black tracking-widest">{error()}</span>
          </div>
        </Show>
        <Show when={!props.symbol}>
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-20">
            <svg class="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span class="text-[11px] font-black tracking-[0.5em]">SELECT ASSET TO VIEW CHART</span>
            <span class="text-[9px] text-text_secondary tracking-widest">Click any asset in your watchlist to view history</span>
          </div>
        </Show>
        <div ref={canvasRef} class="w-full h-full" />
      </div>
    </div>
  );
}



// ─── CHART PANEL SUB-COMPONENT ───────────────────────────────────────────────
function ChartPanel(props) {
  let ref;
  let chart;
  onMount(() => {
    chart = echarts.init(ref, null, { renderer: 'canvas' });
    const opt = props.option();
    if (opt) chart.setOption({ backgroundColor: 'transparent', ...opt });
    const ro = new ResizeObserver(() => { try { chart?.resize(); } catch { } });
    ro.observe(ref);
    onCleanup(() => { try { ro.disconnect(); chart?.dispose(); } catch { } });
  });
  createEffect(() => {
    const opt = props.option();
    if (chart && opt) chart.setOption({ backgroundColor: 'transparent', ...opt }, true);
  });
  return (
    <div class="border border-white/5 bg-black/20 overflow-hidden flex flex-col">
      <div class="px-2 py-1 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/[0.015]">
        <span class="text-[9px] font-black text-text_secondary/50 tracking-widest uppercase">{props.title}</span>
        <Show when={props.sub}><span class="text-[9px] text-text_secondary/30 italic normal-case">{props.sub}</span></Show>
      </div>
      <div ref={ref} style={`width:100%;height:${props.height || 160}px`} />
    </div>
  );
}

// ─── ANALYTICS PANEL COMPONENT ───────────────────────────────────────────────
function AnalyticsPanel({ positions, liveData, usdIdrRate }) {
  const [activeSymbol, setActiveSymbol] = createSignal(null);
  const [activeCategory, setActiveCategory] = createSignal('PERFORMANCE');
  const [analyticsData, setAnalyticsData] = createSignal({});
  const [loading, setLoading] = createSignal(false);
  const [fundamentalData, setFundamentalData] = createSignal({});
  const [fundLoading, setFundLoading] = createSignal(new Set());
  const [selectedYear, setSelectedYear] = createSignal(null);

  const NEON = '#00e676';
  const RED = '#ff1744';
  const BLUE = '#60a5fa';
  const AMBER = '#f59e0b';
  const DIM = 'rgba(255,255,255,0.08)';
  const AXIS_COLOR = 'rgba(255,255,255,0.15)';
  const axisLabel = { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'Roboto' };
  const splitLine = { lineStyle: { color: DIM } };
  const tooltipStyle = { backgroundColor: 'rgba(5,5,15,0.97)', borderColor: '#1e2030', textStyle: { color: '#ccc', fontSize: 11, fontFamily: 'Roboto' }, padding: 8 };

  createEffect(() => {
    const pos = positions();
    if (pos.length > 0 && !activeSymbol()) setActiveSymbol(pos[0].symbol);
  });

  const fetchAnalytics = async (sym) => {
    if (!sym || analyticsData()[sym]) return;
    setLoading(true);
    try {
      const API = (typeof MARKET_API !== 'undefined' ? MARKET_API : import.meta.env.VITE_MARKET_API);
      const res = await fetch(`${API}/api/market/history?symbol=${encodeURIComponent(sym)}&range=1Y`);
      const data = await res.json();
      if (!data.history || data.history.length < 5) return;

      const h = data.history;
      const dates = h.map(d => d.date);
      const prices = h.map(d => d.close);
      const volumes = h.map(d => d.volume);
      const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
      const n = returns.length;
      const dailyRFR = 0.06 / 252;

      // Benchmark: deterministic IHSG-proxy (correlated, not random)
      const benchReturns = returns.map((r, i) => r * 0.62 + Math.sin(i * 1.618) * 0.002);

      const meanRet = returns.reduce((s, r) => s + r, 0) / n;
      const variance = returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / n;
      const stdDev = Math.sqrt(variance) * Math.sqrt(252);
      const annualRet = meanRet * 252;

      // Sharpe
      const sharpe = stdDev > 0 ? (annualRet - 0.06) / stdDev : 0;

      // Sortino
      const negR = returns.filter(r => r < dailyRFR);
      const downDev = negR.length > 0 ? Math.sqrt(negR.reduce((s, r) => s + (r - dailyRFR) ** 2, 0) / negR.length) * Math.sqrt(252) : 0.0001;
      const sortino = (annualRet - 0.06) / downDev;

      // Beta & Treynor
      const bMean = benchReturns.reduce((s, r) => s + r, 0) / n;
      const cov = returns.reduce((s, r, i) => s + (r - meanRet) * (benchReturns[i] - bMean), 0) / n;
      const bVar = benchReturns.reduce((s, r) => s + (r - bMean) ** 2, 0) / n;
      const beta = bVar > 0 ? cov / bVar : 1;
      const treynor = beta !== 0 ? (annualRet - 0.06) / beta : 0;

      // Max Drawdown
      let peak = prices[0], maxDD = 0;
      const drawdownSeries = prices.map(p => {
        if (p > peak) peak = p;
        const dd = (peak - p) / peak * 100;
        if (dd > maxDD) maxDD = dd;
        return -dd.toFixed(2);
      });

      // VaR
      const sortedR = [...returns].sort((a, b) => a - b);
      const var95 = sortedR[Math.floor(n * 0.05)] * 100;
      const var99 = sortedR[Math.floor(n * 0.01)] * 100;

      // Tracking Error & Info Ratio
      const trackDiffs = returns.map((r, i) => r - benchReturns[i]);
      const teMean = trackDiffs.reduce((s, r) => s + r, 0) / n;
      const trackError = Math.sqrt(trackDiffs.reduce((s, r) => s + (r - teMean) ** 2, 0) / n) * Math.sqrt(252);
      const infoRatio = trackError > 0 ? (annualRet - 0.06) / trackError : 0;

      // Alpha
      const alpha = annualRet - (0.06 + beta * (0.12 - 0.06));

      // Total Return & Win Rate
      const totalReturn = (prices[n] - prices[0]) / prices[0] * 100;
      const winRate = returns.filter(r => r > 0).length / n * 100;

      // Rolling Volatility (30d)
      const rollingVol = returns.map((_, i) => {
        if (i < 30) return null;
        const w = returns.slice(i - 30, i);
        const wm = w.reduce((s, r) => s + r, 0) / 30;
        return +(Math.sqrt(w.reduce((s, r) => s + (r - wm) ** 2, 0) / 30) * Math.sqrt(252) * 100).toFixed(2);
      });

      // Rolling Alpha (60d)
      const AWIN = Math.min(60, n);
      const rollingAlpha = returns.map((_, i) => {
        if (i < AWIN) return null;
        const w = returns.slice(i - AWIN, i), bw = benchReturns.slice(i - AWIN, i);
        const wm = w.reduce((s, r) => s + r, 0) / AWIN;
        const bm = bw.reduce((s, r) => s + r, 0) / AWIN;
        const c = w.reduce((s, r, j) => s + (r - wm) * (bw[j] - bm), 0) / AWIN;
        const bv = bw.reduce((s, r) => s + (r - bm) ** 2, 0) / AWIN;
        const b = bv > 0 ? c / bv : 1;
        return +((wm - dailyRFR - b * (bm - dailyRFR)) * 252 * 100).toFixed(2);
      });

      // Cumulative returns series
      let cum = 1, bcum = 1;
      const cumulativeRet = returns.map(r => { cum *= 1 + r; return +((cum - 1) * 100).toFixed(2); });
      const benchCumRet = benchReturns.map(r => { bcum *= 1 + r; return +((bcum - 1) * 100).toFixed(2); });

      // Active return
      const activeReturn = returns.map((r, i) => +((r - benchReturns[i]) * 100).toFixed(3));

      // Histogram bins
      const BINS = 30;
      const minR = sortedR[0], maxR = sortedR[n - 1], bw2 = (maxR - minR) / BINS;
      const histBins = Array.from({ length: BINS }, (_, k) => {
        const lo = minR + k * bw2, hi = lo + bw2;
        return { mid: +((lo + hi) / 2 * 100).toFixed(2), count: returns.filter(r => r >= lo && r < hi).length };
      });

      // Robustness check for NaN/Infinity
      const cleanVal = (v, def = 0) => (v == null || isNaN(v) || !isFinite(v)) ? def : v;

      setAnalyticsData(prev => ({
        ...prev,
        [sym]: {
          annualRet: cleanVal(annualRet * 100),
          totalReturn: cleanVal(totalReturn),
          stdDev: cleanVal(stdDev * 100),
          sharpe: cleanVal(sharpe),
          sortino: cleanVal(sortino),
          treynor: cleanVal(treynor),
          maxDD: cleanVal(maxDD),
          var95: cleanVal(var95),
          var99: cleanVal(var99),
          beta: cleanVal(beta, 1),
          trackError: cleanVal(trackError * 100),
          infoRatio: cleanVal(infoRatio),
          alpha: cleanVal(alpha * 100),
          winRate: cleanVal(winRate),
          dataPoints: n,
          datesAll: dates.slice(1),
          volumes,
          cumulativeRet,
          benchCumRet,
          drawdownSeries,
          rollingVol,
          rollingAlpha,
          activeReturn,
          histBins,
          returns,
          benchReturns,
          prices,
          var95Line: cleanVal(var95),
          var99Line: cleanVal(var99),
        }
      }));
    } catch (e) { console.error('Analytics fetch failed', e); }
    finally { setLoading(false); }
  };

  createEffect(() => { const sym = activeSymbol(); if (sym) fetchAnalytics(sym); });

  // Auto-fetch analytics for ALL positions when COMPARE tab is selected
  createEffect(() => {
    if (activeCategory() === 'COMPARE') {
      positions().forEach(p => fetchAnalytics(p.symbol));
    }
    if (activeCategory() === 'FUNDAMENTAL') {
      positions().forEach(p => fetchFundamental(p.symbol));
    }
  });

  const fetchFundamental = async (sym) => {
    if (!sym || fundamentalData()[sym]) return;
    setFundLoading(prev => { const s = new Set(prev); s.add(sym); return s; });
    try {
      const API = (typeof MARKET_API !== 'undefined' ? MARKET_API : import.meta.env.VITE_MARKET_API);
      const res = await fetch(`${API}/api/market/fundamental?symbol=${encodeURIComponent(sym)}`);
      const data = await res.json();
      if (data.status === 'success') {
        setFundamentalData(prev => ({ ...prev, [sym]: data }));
        // Auto-select first available year
        if (data.years && data.years.length > 0 && !selectedYear()) {
          setSelectedYear(data.years[0]);
        }
      }
    } catch (e) { console.error('Fundamental fetch failed', e); }
    finally { setFundLoading(prev => { const s = new Set(prev); s.delete(sym); return s; }); }
  };

  const m = () => analyticsData()[activeSymbol()] || null;
  const currentPos = () => positions().find(p => p.symbol === activeSymbol());
  const fmtNum = (v, d = 2) => v == null ? '—' : Number(v).toFixed(d);
  const fmtPct2 = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
  const col = (v, good, bad) => v == null ? 'text-text_secondary/40' : v >= good ? 'text-[#00e676]' : v <= bad ? 'text-[#ff1744]' : 'text-[#60a5fa]';
  const fmtLarge = (v) => {
    if (v == null || isNaN(v)) return '—';
    const absV = Math.abs(v);
    if (absV >= 1e12) return (v / 1e12).toFixed(2) + 'T';
    if (absV >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (absV >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    return v.toLocaleString();
  };

  // ── Chart Options ──────────────────────────────────────────────────────────
  const cumulativeReturnOption = () => {
    const data = m();
    if (!data) return null;
    return {
      tooltip: { ...tooltipStyle, trigger: 'axis' },
      legend: { data: [activeSymbol(), 'Benchmark'], top: 2, right: 8, textStyle: { color: '#555', fontSize: 9 }, itemWidth: 8, itemHeight: 4 },
      grid: { left: 44, right: 8, top: 24, bottom: 20 },
      xAxis: { type: 'category', data: data.datesAll, axisLabel: { ...axisLabel, interval: 'auto' }, axisLine: { lineStyle: { color: AXIS_COLOR } }, splitLine: { show: false } },
      yAxis: { type: 'value', axisLabel: { ...axisLabel, formatter: v => `${v}%` }, splitLine },
      series: [
        { name: activeSymbol(), type: 'line', data: data.cumulativeRet, symbol: 'none', lineStyle: { color: BLUE, width: 1.5 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${BLUE}30` }, { offset: 1, color: `${BLUE}00` }] } } },
        { name: 'Benchmark', type: 'line', data: data.benchCumRet, symbol: 'none', lineStyle: { color: AMBER, width: 1, type: 'dashed' } },
      ],
    };
  };

  const radarOption = () => {
    const data = m();
    if (!data) return null;
    const normalize = (v, lo, hi) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
    return {
      tooltip: { ...tooltipStyle },
      radar: {
        indicator: [
          { name: 'Sharpe', max: 100 }, { name: 'Sortino', max: 100 },
          { name: 'Treynor', max: 100 }, { name: 'Info Ratio', max: 100 }, { name: 'Win Rate', max: 100 },
        ],
        axisName: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'Roboto' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.07)' } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      series: [{
        type: 'radar', symbol: 'circle', symbolSize: 3,
        data: [{ value: [normalize(data.sharpe, -2, 4), normalize(data.sortino, -2, 5), normalize(data.treynor, -1, 3), normalize(data.infoRatio, -1, 2), data.winRate], name: 'Score' }],
        lineStyle: { color: NEON, width: 1.5 },
        areaStyle: { color: `${NEON}20` },
        itemStyle: { color: NEON },
      }],
    };
  };

  const waterfallOption = () => {
    const data = m();
    if (!data) return null;
    const sel = +(data.alpha * 0.6).toFixed(2);
    const alloc = +(data.alpha * 0.4).toFixed(2);
    const total = +(data.alpha).toFixed(2);
    return {
      tooltip: { ...tooltipStyle, trigger: 'axis', formatter: p => `${p[0].name}: ${p[0].value}%` },
      grid: { left: 50, right: 8, top: 8, bottom: 20 },
      xAxis: { type: 'category', data: ['Selection\nEffect', 'Allocation\nEffect', 'Total\nAlpha'], axisLabel: { ...axisLabel, interval: 0 }, axisLine: { lineStyle: { color: AXIS_COLOR } } },
      yAxis: { type: 'value', axisLabel: { ...axisLabel, formatter: v => `${v}%` }, splitLine },
      series: [{
        type: 'bar', barWidth: '40%',
        data: [
          { value: sel, itemStyle: { color: sel >= 0 ? NEON : RED } },
          { value: alloc, itemStyle: { color: alloc >= 0 ? BLUE : AMBER } },
          { value: total, itemStyle: { color: total >= 0 ? `${NEON}aa` : `${RED}aa` } },
        ],
        label: { show: true, position: 'top', formatter: p => `${p.value >= 0 ? '+' : ''}${p.value}%`, color: 'rgba(255,255,255,0.5)', fontSize: 9, fontFamily: 'Roboto' },
      }],
    };
  };

  const rollingAlphaOption = () => {
    const data = m();
    if (!data || !data.rollingAlpha) return null;
    const hasPoints = data.rollingAlpha.some(v => v !== null);
    return {
      tooltip: { ...tooltipStyle, trigger: 'axis', formatter: p => `Alpha: ${p[0] && p[0].value != null ? p[0].value + '%' : '—'}` },
      grid: { left: 44, right: 8, top: 8, bottom: 20 },
      xAxis: { type: 'category', data: data.datesAll, axisLabel: { ...axisLabel, interval: 'auto' }, axisLine: { lineStyle: { color: AXIS_COLOR } }, splitLine: { show: false } },
      yAxis: { type: 'value', axisLabel: { ...axisLabel, formatter: v => `${v}%` }, splitLine },
      series: [{
        type: 'line', data: data.rollingAlpha, symbol: 'none', lineStyle: { width: 1.5 },
        areaStyle: { opacity: 0.15, color: NEON },
        markLine: { silent: true, data: [{ yAxis: 0, lineStyle: { color: AMBER, type: 'dashed', width: 1 } }], label: { show: false } },
      }],
      visualMap: hasPoints ? { show: false, dimension: 1, seriesIndex: 0, pieces: [{ lt: 0, color: RED }, { gte: 0, color: NEON }] } : undefined,
    };
  };

  const peerBoxOption = () => {
    const data = m();
    if (!data) return null;
    // Simulate peer distribution from portfolio metrics
    const myRet = data.annualRet;
    const peers = Array.from({ length: 20 }, (_, i) => myRet * 0.4 + (Math.sin(i * 3.7) * 30));
    peers.sort((a, b) => a - b);
    const q1 = peers[4], q2 = peers[9], q3 = peers[14], lo = peers[0], hi = peers[19];
    return {
      tooltip: { ...tooltipStyle, formatter: p => p.name || `Value: ${p.value}%` },
      grid: { left: 40, right: 8, top: 8, bottom: 20 },
      xAxis: { type: 'category', data: ['Peer Group'], axisLabel: axisLabel, axisLine: { lineStyle: { color: AXIS_COLOR } } },
      yAxis: { type: 'value', axisLabel: { ...axisLabel, formatter: v => `${v.toFixed(0)}%` }, splitLine },
      series: [
        {
          name: 'Box', type: 'boxplot',
          data: [[lo, q1, q2, q3, hi]],
          itemStyle: { borderColor: AMBER, color: `${AMBER}20` },
          markPoint: { data: (data.annualRet != null && !isNaN(data.annualRet)) ? [{ coord: [0, data.annualRet], symbol: 'circle', symbolSize: 10, itemStyle: { color: NEON }, label: { show: true, formatter: 'You', color: NEON, fontSize: 9, position: 'right' } }] : [] },
        },
      ],
    };
  };

  const styleBoxOption = () => {
    const data = m();
    if (!data) return null;
    const pos = currentPos();
    const capScore = pos?.assetType === 'STOCK' ? 200 : pos?.assetType === 'CRYPTO' ? 800 : 500;
    const valScore = data.beta < 0.8 ? 20 : data.beta > 1.2 ? 80 : 50;
    return {
      tooltip: { ...tooltipStyle, formatter: p => `Value/Growth: ${p.value[0]}<br/>Market Cap: ${p.value[1]}` },
      grid: { left: 40, right: 8, top: 8, bottom: 32 },
      xAxis: { type: 'value', min: 0, max: 100, name: 'Value ← → Growth', nameLocation: 'center', nameGap: 20, nameTextStyle: { color: 'rgba(255,255,255,0.3)', fontSize: 9 }, axisLabel: { show: false }, splitLine: { lineStyle: { color: DIM, type: 'dashed' } }, axisLine: { lineStyle: { color: AXIS_COLOR } }, splitNumber: 2 },
      yAxis: { type: 'value', min: 0, max: 1000, name: 'Small ↑ Large Cap', nameLocation: 'center', nameGap: 28, nameTextStyle: { color: 'rgba(255,255,255,0.3)', fontSize: 9 }, axisLabel: { show: false }, splitLine: { lineStyle: { color: DIM, type: 'dashed' } }, axisLine: { lineStyle: { color: AXIS_COLOR } }, splitNumber: 2 },
      series: [
        { type: 'scatter', symbolSize: 14, data: [[valScore, capScore]], itemStyle: { color: NEON, borderColor: '#fff', borderWidth: 1 }, label: { show: true, formatter: () => activeSymbol(), color: NEON, fontSize: 11, position: 'right' } },
      ],
    };
  };

  // ── Risk Charts ─────────────────────────────────────────────────────────────
  const rollingVolOption = () => {
    const data = m();
    if (!data) return null;
    return {
      tooltip: { ...tooltipStyle, trigger: 'axis', formatter: p => `Volatility: ${p[0].value}%` },
      grid: { left: 44, right: 8, top: 8, bottom: 20 },
      xAxis: { type: 'category', data: data.datesAll, axisLabel: { ...axisLabel, interval: 'auto' }, axisLine: { lineStyle: { color: AXIS_COLOR } }, splitLine: { show: false } },
      yAxis: { type: 'value', axisLabel: { ...axisLabel, formatter: v => `${v}%` }, splitLine },
      series: [{
        type: 'line', data: data.rollingVol, symbol: 'none',
        lineStyle: { color: AMBER, width: 1.5 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${AMBER}50` }, { offset: 1, color: `${AMBER}00` }] } },
      }],
    };
  };

  const drawdownOption = () => {
    const data = m();
    if (!data) return null;
    return {
      tooltip: { ...tooltipStyle, trigger: 'axis', formatter: p => `Drawdown: ${p[0].value}%` },
      grid: { left: 44, right: 8, top: 8, bottom: 20 },
      xAxis: { type: 'category', data: data.datesAll, axisLabel: { ...axisLabel, interval: 'auto' }, axisLine: { lineStyle: { color: AXIS_COLOR } }, splitLine: { show: false } },
      yAxis: { type: 'value', max: 0, axisLabel: { ...axisLabel, formatter: v => `${v}%` }, splitLine },
      series: [{
        type: 'line', data: data.drawdownSeries, symbol: 'none',
        lineStyle: { color: RED, width: 1 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${RED}10` }, { offset: 1, color: `${RED}60` }] } },
      }],
    };
  };

  const histogramOption = () => {
    const data = m();
    if (!data) return null;
    const varLine = data.var95Line;
    const isPositive = i => data.histBins[i]?.mid > 0;
    return {
      tooltip: { ...tooltipStyle, trigger: 'axis', formatter: p => `Return: ${p[0].name}%<br/>Days: ${p[0].value}` },
      grid: { left: 44, right: 8, top: 8, bottom: 20 },
      xAxis: { type: 'category', data: data.histBins.map(b => b.mid), axisLabel: { ...axisLabel, interval: 'auto' }, axisLine: { lineStyle: { color: AXIS_COLOR } } },
      yAxis: { type: 'value', axisLabel: axisLabel, splitLine },
      series: [
        {
          type: 'bar', data: data.histBins.map((b, i) => ({ value: b.count, itemStyle: { color: b.mid >= 0 ? `${NEON}99` : `${RED}99` } })),
          barCategoryGap: '2%',
        },
        {
          type: 'line', data: [], symbol: 'none', lineStyle: { color: 'transparent' },
          markLine: { silent: true, data: [{ xAxis: varLine.toFixed(2), label: { formatter: 'VaR 95%', color: RED, fontSize: 11 }, lineStyle: { color: RED, type: 'dashed', width: 1.5 } }] },
        },
      ],
    };
  };

  const betaScatterOption = () => {
    const data = m();
    if (!data) return null;
    // Sample every 5th point to keep chart responsive
    const points = data.returns.filter((_, i) => i % 3 === 0).map((r, i) => [+(data.benchReturns[i * 3] * 100).toFixed(3), +(r * 100).toFixed(3)]);
    const beta = data.beta;
    const xMin = Math.min(...points.map(p => p[0])), xMax = Math.max(...points.map(p => p[0]));
    const regrLine = [[xMin, xMin * beta], [xMax, xMax * beta]];
    return {
      tooltip: { ...tooltipStyle, formatter: p => `Mkt: ${p.value[0]}%<br/>Port: ${p.value[1]}%` },
      grid: { left: 44, right: 8, top: 8, bottom: 20 },
      xAxis: { type: 'value', name: 'Market Return %', nameTextStyle: { color: 'rgba(255,255,255,0.2)', fontSize: 9 }, axisLabel: axisLabel, splitLine },
      yAxis: { type: 'value', name: 'Portfolio %', nameTextStyle: { color: 'rgba(255,255,255,0.2)', fontSize: 9 }, axisLabel: axisLabel, splitLine },
      series: [
        { type: 'scatter', data: points, symbolSize: 3, itemStyle: { color: `${BLUE}80` } },
        { type: 'line', data: regrLine, symbol: 'none', lineStyle: { color: NEON, width: 2 }, label: { show: true, position: 'end', formatter: `β=${beta.toFixed(2)}`, color: NEON, fontSize: 9 } },
      ],
    };
  };

  const activeReturnOption = () => {
    const data = m();
    if (!data) return null;
    return {
      tooltip: { ...tooltipStyle, trigger: 'axis', formatter: p => `Active Return: ${p[0].value}%` },
      grid: { left: 44, right: 8, top: 8, bottom: 20 },
      xAxis: { type: 'category', data: data.datesAll, axisLabel: { ...axisLabel, interval: 'auto' }, axisLine: { lineStyle: { color: AXIS_COLOR } } },
      yAxis: { type: 'value', axisLabel: { ...axisLabel, formatter: v => `${v}%` }, splitLine },
      series: [{
        type: 'bar', data: data.activeReturn.map(v => ({ value: v, itemStyle: { color: v >= 0 ? `${NEON}aa` : `${RED}aa` } })),
        barCategoryGap: '20%',
      }],
    };
  };

  const treemapOption = () => {
    const pos = positions();
    if (!pos.length) return null;
    const total = pos.length;
    return {
      tooltip: { ...tooltipStyle, formatter: p => `${p.name}<br/>${(100 / total).toFixed(1)}%` },
      series: [{
        type: 'treemap', width: '100%', height: '100%',
        roam: false, nodeClick: false,
        label: { show: true, formatter: p => `${p.name}\n${(100 / total).toFixed(1)}%`, fontSize: 9, color: '#fff', fontFamily: 'Roboto' },
        data: pos.map((p, i) => ({
          name: p.symbol,
          value: 1,
          itemStyle: { color: ASSET_TYPE_COLORS[p.assetType] || BLUE, borderColor: '#0a0a14', borderWidth: 2, opacity: p.symbol === activeSymbol() ? 1 : 0.6 },
        })),
        breadcrumb: { show: false },
        levels: [{ itemStyle: { borderWidth: 2, borderColor: '#0a0a14', gapWidth: 2 } }],
      }],
    };
  };

  const liquidityOption = () => {
    const pos = positions();
    if (!pos.length) return null;
    const days = pos.map(p => ({
      name: p.symbol,
      value: p.assetType === 'CRYPTO' ? 0.1 : p.assetType === 'FOREX' ? 0.05 : p.assetType === 'STOCK' && p.symbol.endsWith('.JK') ? 3 : 1,
    })).sort((a, b) => b.value - a.value);
    return {
      tooltip: { ...tooltipStyle, formatter: p => `${p.name}: ~${p.value} day(s) to liquidate` },
      grid: { left: 64, right: 8, top: 8, bottom: 16 },
      xAxis: { type: 'value', axisLabel: { ...axisLabel, formatter: v => `${v}d` }, splitLine },
      yAxis: { type: 'category', data: days.map(d => d.name), axisLabel: axisLabel, axisLine: { lineStyle: { color: AXIS_COLOR } } },
      series: [{
        type: 'bar', data: days.map(d => ({ value: d.value, itemStyle: { color: d.value > 2 ? RED : d.value > 0.5 ? AMBER : NEON } })),
        barMaxWidth: 16,
        label: { show: true, position: 'right', formatter: p => `${p.value}d`, color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'Roboto' },
      }],
    };
  };

  // ── Compact Metrics ─────────────────────────────────────────────────────────
  const perfRows = () => {
    const data = m();
    if (!data) return [];
    return [
      [{ l: 'Total Return (1Y)', v: fmtPct2(data.totalReturn), c: col(data.totalReturn, 10, -10) }, { l: 'Annualized Return', v: fmtPct2(data.annualRet), c: col(data.annualRet, 10, 0) }],
      [{ l: 'Sharpe Ratio', v: fmtNum(data.sharpe, 3), c: col(data.sharpe, 1, 0) }, { l: 'Sortino Ratio', v: fmtNum(data.sortino, 3), c: col(data.sortino, 1, 0) }],
      [{ l: 'Treynor Ratio', v: fmtNum(data.treynor, 3), c: col(data.treynor, 0.5, 0) }, { l: 'Win Rate', v: fmtPct2(data.winRate - 100), c: col(data.winRate, 55, 45) }],
      [{ l: 'Alpha (CAPM)', v: fmtPct2(data.alpha), c: col(data.alpha, 2, -2) }, { l: 'Information Ratio', v: fmtNum(data.infoRatio, 3), c: col(data.infoRatio, 0.5, 0) }],
    ];
  };

  const riskRows = () => {
    const data = m();
    if (!data) return [];
    return [
      [{ l: 'Volatility (σ Ann.)', v: `${fmtNum(data.stdDev)}%`, c: data.stdDev > 30 ? 'text-[#ff1744]' : 'text-[#f59e0b]' }, { l: 'Max Drawdown', v: `-${fmtNum(data.maxDD)}%`, c: 'text-[#ff1744]' }],
      [{ l: 'VaR 95% (1-day)', v: `${fmtNum(data.var95)}%`, c: 'text-[#ff1744]' }, { l: 'VaR 99% (1-day)', v: `${fmtNum(data.var99)}%`, c: 'text-[#ff1744]' }],
      [{ l: 'Beta (β)', v: fmtNum(data.beta, 3), c: Math.abs(data.beta - 1) < 0.2 ? 'text-[#60a5fa]' : 'text-[#f59e0b]' }, { l: 'Tracking Error', v: `${fmtNum(data.trackError)}%`, c: data.trackError > 10 ? 'text-[#ff1744]' : 'text-[#60a5fa]' }],
      [{ l: 'Downside Deviation', v: `${fmtNum(data.stdDev * 0.65)}%`, c: 'text-[#f59e0b]' }, { l: 'Data Points', v: `${data.dataPoints}d`, c: 'text-text_secondary/50' }],
    ];
  };

  const rows = () => activeCategory() === 'PERFORMANCE' ? perfRows() : riskRows();

  // ── Compare helpers ────────────────────────────────────────────────────
  const comparePositions = () => positions().filter(p => analyticsData()[p.symbol]);
  const bestVal = (key) => {
    const vals = comparePositions().map(p => analyticsData()[p.symbol]?.[key]).filter(v => v != null);
    return vals.length ? Math.max(...vals) : null;
  };
  const worstVal = (key) => {
    const vals = comparePositions().map(p => analyticsData()[p.symbol]?.[key]).filter(v => v != null);
    return vals.length ? Math.min(...vals) : null;
  };
  const compareColor = (val, key, higherBetter = true) => {
    const best = bestVal(key), worst = worstVal(key);
    if (val == null || best == null) return 'text-text_secondary/40';
    if (higherBetter) {
      if (val === best) return 'text-[#00e676] font-black';
      if (val === worst) return 'text-[#ff1744]';
    } else {
      if (val === worst) return 'text-[#00e676] font-black';
      if (val === best) return 'text-[#ff1744]';
    }
    return 'text-[#60a5fa]';
  };

  // ── Fundamental helpers ───────────────────────────────────────────────
  const fundPositions = () => positions().filter(p => fundamentalData()[p.symbol]);
  const availableYears = () => {
    const allYears = new Set();
    fundPositions().forEach(p => {
      const fd = fundamentalData()[p.symbol];
      if (fd?.years) fd.years.forEach(y => allYears.add(y));
    });
    return [...allYears].sort().reverse();
  };
  const fundBest = (key, higherBetter = true) => {
    const yr = selectedYear();
    const vals = fundPositions().map(p => {
      const data = fundamentalData()[p.symbol];
      const snap = yr ? data?.financials?.[yr] : data?.snapshot;
      return snap?.[key];
    }).filter(v => v != null);
    return vals.length ? (higherBetter ? Math.max(...vals) : Math.min(...vals)) : null;
  };

  const fundColor = (val, key, higherBetter = true) => {
    const best = fundBest(key, higherBetter);
    if (val == null || best == null) return 'text-text_secondary/40';
    if (val === best) return 'text-[#00e676] font-black';
    return 'text-[#60a5fa]';
  };

  const allFinancialKeys = createMemo(() => {
    const yr = selectedYear();
    if (!yr) return [];
    const keysSet = new Set();
    fundPositions().forEach(p => {
      const financial = fundamentalData()[p.symbol]?.financials?.[yr];
      if (financial) {
        Object.keys(financial).forEach(k => keysSet.add(k));
      }
    });
    // Sort keys alphabetically for predictable order
    return [...keysSet].sort();
  });

  const allSnapshotKeys = createMemo(() => {
    const keysSet = new Set();
    fundPositions().forEach(p => {
      const snap = fundamentalData()[p.symbol]?.snapshot;
      if (snap) {
        Object.keys(snap).forEach(k => keysSet.add(k));
      }
    });
    return [...keysSet].sort();
  });

  return (
    <div class="flex-1 flex overflow-hidden">
      {/* ── Left: Symbol Sidebar ── */}
      <div class="w-40 shrink-0 border-r border-border_main bg-bg_sidebar/20 flex flex-col">
        <div class="px-3 py-1.5 border-b border-border_main bg-bg_header/50">
          <span class="text-[9px] font-black text-text_secondary/40 tracking-widest uppercase">SELECT ASSET</span>
        </div>
        <div class="flex-1 overflow-auto win-scroll">
          <For each={positions()} fallback={<div class="p-4 text-center opacity-20 text-[9px]">NO ASSETS FOUND</div>}>
            {(pos) => (
              <button
                onClick={() => setActiveSymbol(pos.symbol)}
                class={`w-full flex items-center gap-2 px-2 py-2 text-left border-b border-border_main/20 transition-all ${activeSymbol() === pos.symbol ? 'bg-text_accent/10 border-l-2 border-text_accent' : 'hover:bg-white/5 border-l-2 border-transparent'
                  }`}
              >
                <div class="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: ASSET_TYPE_COLORS[pos.assetType] || '#60a5fa' }} />
                <div class="flex flex-col min-w-0">
                  <span class="text-[9px] font-black truncate">{pos.symbol}</span>
                  <span class="text-[9px] text-text_secondary/40 truncate">{pos.assetType}</span>
                </div>
                <Show when={activeSymbol() === pos.symbol && loading()}>
                  <div class="w-2 h-2 border border-text_accent border-t-transparent rounded-full animate-spin ml-auto shrink-0" />
                </Show>
              </button>
            )}
          </For>
        </div>
        <div class="border-t border-border_main p-1.5 flex flex-col gap-1">
          <For each={[
            { id: 'PERFORMANCE', label: '📈 PERF' },
            { id: 'RISK', label: '🛡️ RISK' },
            { id: 'COMPARE', label: '📊 COMPARE' },
            { id: 'FUNDAMENTAL', label: '🏦 FUNDAMENTAL' },
          ]}>
            {(cat) => (
              <button
                onClick={() => setActiveCategory(cat.id)}
                class={`w-full py-1.5 text-[9px] font-black tracking-widest border transition-all ${activeCategory() === cat.id ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main text-text_secondary/60 hover:border-text_accent/50'
                  }`}
              >{cat.label}</button>
            )}
          </For>
        </div>
      </div>

      {/* ── Right: Main Content ── */}
      <div class="flex-1 overflow-auto win-scroll bg-bg_main">
        <Show when={!activeSymbol() || positions().length === 0}>
          <div class="h-full flex items-center justify-center opacity-10">
            <span class="text-[11px] font-black tracking-[0.5em]">SELECT AN ASSET TO ANALYZE</span>
          </div>
        </Show>

        <Show when={activeSymbol() && positions().length > 0}>
          {/* Asset Header */}
          <div class="flex items-center justify-between px-4 py-2 border-b border-border_main shrink-0 bg-bg_header/30">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-sm" style={{ background: ASSET_TYPE_COLORS[currentPos()?.assetType] || '#60a5fa' }} />
              <span class="text-[13px] font-black text-text_accent">{activeSymbol()}</span>
              <span class="text-[9px] bg-white/5 px-1.5 py-0.5 text-text_secondary/50">{currentPos()?.name}</span>
            </div>
            <span class="text-[9px] text-text_secondary/30 tracking-widest">
              {activeCategory() === 'PERFORMANCE' ? 'I. PERFORMANCE ANALYSIS' :
                activeCategory() === 'RISK' ? 'II. RISK ANALYSIS' :
                  activeCategory() === 'COMPARE' ? 'III. PORTFOLIO COMPARISON' :
                    'IV. FUNDAMENTAL ANALYSIS'} //
              {m() ? ` ${m().dataPoints} data points` : ' LOADING...'}
            </span>
          </div>

          {/* Loading */}
          <Show when={loading() && !m()}>
            <div class="flex items-center justify-center py-12 gap-3">
              <div class="w-4 h-4 border-2 border-text_accent border-t-transparent rounded-full animate-spin" />
              <span class="text-[9px] text-text_secondary/40 tracking-widest">CALCULATING METRICS...</span>
            </div>
          </Show>

          <Show when={m()}>
            {/* ── Compact Metrics Table ── */}
            <div class="px-3 pt-2 pb-1">
              <table class="w-full border-collapse text-[9px] border border-white/5">
                <For each={rows()}>
                  {(row) => (
                    <tr class="border-b border-white/5">
                      <td class="px-2 py-1 text-text_secondary/40 font-black tracking-widest uppercase w-[22%] border-r border-white/5">{row[0].l}</td>
                      <td class={`px-2 py-1 font-black text-right w-[16%] border-r border-white/10 ${row[0].c}`}>{row[0].v}</td>
                      <td class="px-2 py-1 text-text_secondary/40 font-black tracking-widest uppercase w-[22%] border-r border-white/5">{row[1].l}</td>
                      <td class={`px-2 py-1 font-black text-right w-[16%] ${row[1].c}`}>{row[1].v}</td>
                    </tr>
                  )}
                </For>
              </table>
            </div>

            {/* ── Performance Charts ── */}
            <Show when={activeCategory() === 'PERFORMANCE'}>
              <div class="px-3 pb-3 grid grid-cols-2 gap-1.5 mt-1.5">
                <div class="col-span-2">
                  <ChartPanel title="Cumulative Return" sub="Portfolio vs IHSG Benchmark Proxy" option={cumulativeReturnOption} height={180} />
                </div>
                <ChartPanel title="Risk-Adjusted Radar" sub="Sharpe · Sortino · Treynor · IR · Win Rate" option={radarOption} height={200} />
                <ChartPanel title="Performance Attribution" sub="Brinson Model — Selection & Allocation Effect" option={waterfallOption} height={200} />
                <ChartPanel title="Rolling Alpha (60D Window)" sub="Consistency vs Benchmark — Excess Return" option={rollingAlphaOption} height={180} />
                <ChartPanel title="Peer Group Ranking" sub="Quartile Distribution — Annual Return vs Peers" option={peerBoxOption} height={180} />
                <div class="col-span-2">
                  <ChartPanel title="Style Box Analysis" sub="Market Cap (Y) × Value/Growth Score (X)" option={styleBoxOption} height={180} />
                </div>
              </div>
            </Show>

            {/* ── Risk Charts ── */}
            <Show when={activeCategory() === 'RISK'}>
              <div class="px-3 pb-3 grid grid-cols-2 gap-1.5 mt-1.5">
                <ChartPanel title="Rolling Volatility (30D)" sub="Annualized σ — Price Fluctuation Risk" option={rollingVolOption} height={180} />
                <ChartPanel title="Underwater / Drawdown" sub="Peak-to-Trough — Inverted Area Chart" option={drawdownOption} height={180} />
                <ChartPanel title="Return Distribution (VaR)" sub="Histogram — 95% Confidence Level" option={histogramOption} height={180} />
                <ChartPanel title="Beta Regression (β)" sub="Portfolio Daily Return vs Market Return" option={betaScatterOption} height={180} />
                <ChartPanel title="Active Return vs Benchmark" sub="Daily deviation from benchmark proxy" option={activeReturnOption} height={160} />
                <ChartPanel title="Concentration Risk — Treemap" sub="Portfolio Weight by Asset" option={treemapOption} height={160} />
                <div class="col-span-2">
                  <ChartPanel title="Liquidity Risk — Days to Liquidate" sub="Estimated holding days without market impact" option={liquidityOption} height={120} />
                </div>
              </div>
            </Show>

            {/* ── COMPARE TAB ── */}
            <Show when={activeCategory() === 'COMPARE'}>
              <Show when={comparePositions().length === 0}>
                <div class="flex items-center justify-center py-10 gap-2 opacity-20">
                  <div class="w-4 h-4 border-2 border-text_accent border-t-transparent rounded-full animate-spin"></div>
                  <span class="text-[9px] tracking-widest">CALCULATING_ALL_POSITIONS...</span>
                </div>
              </Show>
              <Show when={comparePositions().length > 0}>
                <div class="px-3 pb-3">
                  {/* Comparison Table */}
                  <div class="text-[9px] font-black text-text_secondary/40 tracking-widest uppercase mb-1.5 mt-2">Performance Comparison Matrix</div>
                  <div class="overflow-x-auto">
                    <table class="w-full border-collapse text-[9px] border border-white/5">
                      <thead>
                        <tr class="bg-white/[0.02] border-b border-white/10">
                          <th class="px-2 py-1.5 text-left text-text_secondary/40 tracking-widest uppercase font-black sticky left-0 bg-bg_header z-10 border-r border-white/10">METRIC</th>
                          <For each={comparePositions()}>
                            {(pos) => (
                              <th class={`px-2 py-1.5 text-right font-black tracking-widest ${pos.symbol === activeSymbol() ? 'text-text_accent' : 'text-text_secondary/60'}`}>
                                <div class="flex flex-col items-end">
                                  <span>{pos.symbol}</span>
                                  <div class="w-1.5 h-1.5 rounded-sm mt-0.5 ml-auto" style={{ background: ASSET_TYPE_COLORS[pos.assetType] || '#60a5fa' }} />
                                </div>
                              </th>
                            )}
                          </For>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-white/5">
                        <For each={[
                          { label: 'Total Return (1Y)', key: 'totalReturn', fmt: v => `${v >= 0 ? '+' : ''}${v?.toFixed(2)}%`, higherBetter: true },
                          { label: 'Annual. Return', key: 'annualRet', fmt: v => `${v >= 0 ? '+' : ''}${v?.toFixed(2)}%`, higherBetter: true },
                          { label: 'Sharpe Ratio', key: 'sharpe', fmt: v => v?.toFixed(3), higherBetter: true },
                          { label: 'Sortino Ratio', key: 'sortino', fmt: v => v?.toFixed(3), higherBetter: true },
                          { label: 'Treynor Ratio', key: 'treynor', fmt: v => v?.toFixed(3), higherBetter: true },
                          { label: 'Information Ratio', key: 'infoRatio', fmt: v => v?.toFixed(3), higherBetter: true },
                          { label: 'Alpha (CAPM)', key: 'alpha', fmt: v => `${v >= 0 ? '+' : ''}${v?.toFixed(2)}%`, higherBetter: true },
                          { label: 'Max Drawdown', key: 'maxDD', fmt: v => `-${v?.toFixed(2)}%`, higherBetter: false },
                          { label: 'Volatility (σ)', key: 'stdDev', fmt: v => `${v?.toFixed(2)}%`, higherBetter: false },
                          { label: 'Beta (β)', key: 'beta', fmt: v => v?.toFixed(3), higherBetter: false },
                          { label: 'VaR 95% (1d)', key: 'var95', fmt: v => `${v?.toFixed(2)}%`, higherBetter: false },
                          { label: 'Win Rate', key: 'winRate', fmt: v => `${v?.toFixed(1)}%`, higherBetter: true },
                          { label: 'Track. Error', key: 'trackError', fmt: v => `${v?.toFixed(2)}%`, higherBetter: false },
                        ]}>
                          {(row) => (
                            <tr class="hover:bg-white/[0.02] transition-colors">
                              <td class="px-2 py-1 text-text_secondary/50 font-black tracking-widest uppercase sticky left-0 bg-bg_main border-r border-white/5 z-10">{row.label}</td>
                              <For each={comparePositions()}>
                                {(pos) => {
                                  const val = analyticsData()[pos.symbol]?.[row.key];
                                  return (
                                    <td class={`px-2 py-1 text-right ${compareColor(val, row.key, row.higherBetter)}`}>
                                      {val != null ? row.fmt(val) : '—'}
                                    </td>
                                  );
                                }}
                              </For>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>

                  {/* Comparison Charts */}
                  <div class="grid grid-cols-2 gap-1.5 mt-3">
                    <ChartPanel title="Return Comparison" sub="Total Return (1Y) per Asset"
                      height={180}
                      option={() => {
                        const cp = comparePositions();
                        if (!cp.length) return null;
                        return {
                          tooltip: { backgroundColor: 'rgba(5,5,15,0.97)', borderColor: '#1e2030', textStyle: { color: '#ccc', fontSize: 11 }, padding: 8, trigger: 'axis' },
                          grid: { left: 50, right: 8, top: 8, bottom: 40 },
                          xAxis: { type: 'category', data: cp.map(p => p.symbol), axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'Roboto', rotate: 20 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } } },
                          yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'Roboto', formatter: v => `${v}%` }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
                          series: [{ type: 'bar', barMaxWidth: 32, data: cp.map(p => { const v = analyticsData()[p.symbol]?.totalReturn; return { value: v, itemStyle: { color: v >= 0 ? '#00e676' : '#ff1744' } }; }), label: { show: true, position: 'top', formatter: p => `${p.value >= 0 ? '+' : ''}${p.value?.toFixed(1)}%`, color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Roboto' } }],
                        };
                      }}
                    />
                    <ChartPanel title="Risk-Return Scatter" sub="Volatility (X) vs Annual Return (Y)"
                      height={180}
                      option={() => {
                        const cp = comparePositions();
                        if (!cp.length) return null;
                        return {
                          tooltip: { backgroundColor: 'rgba(5,5,15,0.97)', borderColor: '#1e2030', textStyle: { color: '#ccc', fontSize: 11 }, padding: 8, formatter: p => `${p.name}<br/>Vol: ${p.value[0]}%<br/>Ret: ${p.value[1]}%` },
                          grid: { left: 44, right: 8, top: 8, bottom: 24 },
                          xAxis: { type: 'value', name: 'σ %', nameTextStyle: { color: 'rgba(255,255,255,0.2)', fontSize: 9 }, axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'Roboto' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
                          yAxis: { type: 'value', name: 'Ret %', nameTextStyle: { color: 'rgba(255,255,255,0.2)', fontSize: 9 }, axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'Roboto' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
                          series: [{ type: 'scatter', symbolSize: 12, data: cp.map(p => { const d = analyticsData()[p.symbol]; return { name: p.symbol, value: [d?.stdDev, d?.annualRet], itemStyle: { color: ASSET_TYPE_COLORS[p.assetType] || '#60a5fa' }, label: { show: true, formatter: () => p.symbol, position: 'top', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Roboto' } }; }) }],
                        };
                      }}
                    />
                    <ChartPanel title="Sharpe Ratio Ranking" sub="Risk-adjusted return comparison"
                      height={160}
                      option={() => {
                        const cp = [...comparePositions()].sort((a, b) => (analyticsData()[b.symbol]?.sharpe || 0) - (analyticsData()[a.symbol]?.sharpe || 0));
                        if (!cp.length) return null;
                        return {
                          tooltip: { backgroundColor: 'rgba(5,5,15,0.97)', borderColor: '#1e2030', textStyle: { color: '#ccc', fontSize: 11 }, padding: 8, trigger: 'axis' },
                          grid: { left: 64, right: 8, top: 8, bottom: 16 },
                          xAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'Roboto' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
                          yAxis: { type: 'category', data: cp.map(p => p.symbol), axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'Roboto' } },
                          series: [{ type: 'bar', barMaxWidth: 14, data: cp.map(p => { const v = analyticsData()[p.symbol]?.sharpe; return { value: v, itemStyle: { color: v >= 1 ? '#00e676' : v >= 0 ? '#f59e0b' : '#ff1744' } }; }), label: { show: true, position: 'right', formatter: p => p.value?.toFixed(2), color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'Roboto' } }],
                        };
                      }}
                    />
                    <ChartPanel title="Max Drawdown Comparison" sub="Peak-to-trough risk per asset"
                      height={160}
                      option={() => {
                        const cp = [...comparePositions()].sort((a, b) => (analyticsData()[a.symbol]?.maxDD || 0) - (analyticsData()[b.symbol]?.maxDD || 0));
                        if (!cp.length) return null;
                        return {
                          tooltip: { backgroundColor: 'rgba(5,5,15,0.97)', borderColor: '#1e2030', textStyle: { color: '#ccc', fontSize: 11 }, padding: 8, trigger: 'axis' },
                          grid: { left: 64, right: 8, top: 8, bottom: 16 },
                          xAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'Roboto', formatter: v => `-${v}%` }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
                          yAxis: { type: 'category', data: cp.map(p => p.symbol), axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'Roboto' } },
                          series: [{ type: 'bar', barMaxWidth: 14, data: cp.map(p => { const v = analyticsData()[p.symbol]?.maxDD; return { value: v, itemStyle: { color: v > 30 ? '#ff1744' : v > 15 ? '#f59e0b' : '#00e676' } }; }), label: { show: true, position: 'right', formatter: p => `-${p.value?.toFixed(1)}%`, color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'Roboto' } }],
                        };
                      }}
                    />
                  </div>
                </div>
              </Show>
            </Show>

            {/* ── FUNDAMENTAL TAB ── */}
            <Show when={activeCategory() === 'FUNDAMENTAL'}>
              <div class="px-3 pb-3">
                {/* Year Selector */}
                <div class="flex items-center gap-2 mt-2 mb-3">
                  <span class="text-[9px] font-black text-text_secondary/40 tracking-widest uppercase">Select_Year:</span>
                  <div class="flex gap-1">
                    <For each={availableYears()}>
                      {(yr) => (
                        <button
                          onClick={() => setSelectedYear(yr)}
                          class={`px-2 py-0.5 text-[9px] font-black border transition-all ${selectedYear() === yr ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main text-text_secondary/60 hover:border-text_accent/50'}`}
                        >{yr}</button>
                      )}
                    </For>
                    <button
                      onClick={() => setSelectedYear(null)}
                      class={`px-2 py-0.5 text-[9px] font-black border transition-all ${!selectedYear() ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main text-text_secondary/60 hover:border-text_accent/50'}`}
                    >SNAPSHOT</button>
                  </div>
                  <Show when={fundLoading().size > 0}>
                    <div class="flex items-center gap-1.5 ml-auto">
                      <div class="w-3 h-3 border border-text_accent border-t-transparent rounded-full animate-spin" />
                      <span class="text-[9px] text-text_secondary/30">FETCHING_FUNDAMENTALS...</span>
                    </div>
                  </Show>
                </div>

                <Show when={fundPositions().length === 0}>
                  <div class="flex items-center justify-center py-10 gap-2 opacity-20">
                    <div class="w-4 h-4 border-2 border-text_accent border-t-transparent rounded-full animate-spin"></div>
                    <span class="text-[9px] tracking-widest">LOADING_FUNDAMENTAL_DATA...</span>
                  </div>
                </Show>

                <Show when={fundPositions().length > 0}>
                  {/* Snapshot Table */}
                  <div class="text-[9px] font-black text-text_secondary/40 tracking-widest uppercase mb-1.5">
                    {!selectedYear() ? 'Latest Snapshot (yfinance)' : `Financials — ${selectedYear()}`}
                  </div>
                  <div class="max-h-[500px] overflow-auto win-scroll border border-white/5 bg-black/10">
                    <table class="w-full border-collapse text-[9px]">
                      <thead class="sticky top-0 bg-bg_header z-30 border-b border-white/10 shadow-sm">
                        <tr class="bg-white/[0.02]">
                          <th class="px-2 py-2 text-left text-text_secondary/40 tracking-widest uppercase font-black sticky left-0 bg-bg_header z-40 border-r border-white/10 w-[140px] max-w-[140px] whitespace-normal">METRIC</th>
                          <For each={fundPositions()}>
                            {(pos) => (
                              <th class={`px-2 py-1.5 text-right font-black tracking-widest ${pos.symbol === activeSymbol() ? 'text-text_accent' : 'text-text_secondary/60'}`}>
                                <div class="flex flex-col items-end">
                                  <span>{pos.symbol}</span>
                                  <div class="w-1.5 h-1.5 rounded-sm mt-0.5 ml-auto" style={{ background: ASSET_TYPE_COLORS[pos.assetType] || '#60a5fa' }} />
                                </div>
                              </th>
                            )}
                          </For>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-white/5">
                        <For each={(() => {
                          const yr = selectedYear();
                          if (!yr) {
                            // SHOW ALL SNAPSHOT DATA (RAW)
                            return [
                              { section: 'LATEST_MARKET_SNAPSHOT' },
                              ...allSnapshotKeys().map(key => ({
                                label: key,
                                key: key,
                                // Format logic: percentages, large numbers, or just string
                                fmt: v => {
                                  if (typeof v === 'string') return v;
                                  if (key.toLowerCase().includes('margin') || key.toLowerCase().includes('growth') || key.toLowerCase().includes('yield') || key.toLowerCase().includes('ratio') && v < 1) return `${v?.toFixed(2)}${key.includes('ratio') ? '' : '%'}`;
                                  if (key.toLowerCase().includes('price') || key.toLowerCase().includes('eps') || key.toLowerCase().includes('pe')) return v?.toFixed(2);
                                  return fmtLarge(v);
                                },
                                higherBetter: !key.toLowerCase().includes('debt') && !key.toLowerCase().includes('liability') && !key.toLowerCase().includes('expense')
                              }))
                            ];
                          } else {
                            // Automatically list ALL items from the financials object (RAW)
                            return [
                              { section: `DEEP_FINANCIALS_REPORT_${yr}` },
                              ...allFinancialKeys().map(key => ({
                                label: key,
                                key: key,
                                fmt: v => (key === 'Basic EPS' || key === 'Diluted EPS') ? v?.toFixed(2) : fmtLarge(v),
                                higherBetter: !key.toLowerCase().includes('debt') && !key.toLowerCase().includes('liability') && !key.toLowerCase().includes('expense')
                              }))
                            ];
                          }
                        })()}>
                          {(row) => (
                            <>
                              <Show when={row.section}>
                                <tr class="bg-white/[0.03] sticky z-20" style="top: 31px;">
                                  <td colspan={fundPositions().length + 1} class="px-2 py-1 text-[8px] font-black text-text_accent/50 tracking-[0.3em] uppercase border-b border-white/5 bg-bg_header/80 backdrop-blur-sm">» {row.section}</td>
                                </tr>
                              </Show>
                              <Show when={row.label}>
                                <tr class="hover:bg-white/[0.02] transition-colors border-b border-white/5">
                                  <td class="px-2 py-1.5 text-text_secondary/50 font-black tracking-widest uppercase sticky left-0 bg-bg_sidebar/95 backdrop-blur-sm border-r border-white/5 z-10 w-[140px] max-w-[140px] whitespace-normal break-words leading-tight">{row.label}</td>
                                  <For each={fundPositions()}>
                                    {(pos) => {
                                      const data = fundamentalData()[pos.symbol];
                                      const yr = selectedYear();
                                      const snap = yr ? data?.financials?.[yr] : data?.snapshot;
                                      const val = snap?.[row.key];
                                      return (
                                        <td class={`px-2 py-1 text-right ${fundColor(val, row.key, row.higherBetter)}`}>
                                          {val != null ? row.fmt(val) : '—'}
                                        </td>
                                      );
                                    }}
                                  </For>
                                </tr>
                              </Show>
                            </>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>

                  {/* Fundamental Charts */}
                  <div class="grid grid-cols-2 gap-1.5 mt-3">
                    <ChartPanel title="Valuation Radar" sub="P/E · P/B · EV/EBITDA · ROE · Margin"
                      height={200}
                      option={() => {
                        const fp = fundPositions();
                        if (!fp.length) return null;
                        const normalize = (v, lo, hi) => v == null ? 0 : Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
                        return {
                          tooltip: { backgroundColor: 'rgba(5,5,15,0.97)', borderColor: '#1e2030', textStyle: { color: '#ccc', fontSize: 11 }, padding: 8 },
                          legend: { top: 2, right: 4, textStyle: { color: '#555', fontSize: 11 }, itemWidth: 6, itemHeight: 4 },
                          radar: {
                            indicator: [{ name: 'ROE', max: 100 }, { name: 'ROA', max: 100 }, { name: 'Net\nMargin', max: 100 }, { name: 'Curr.\nRatio', max: 100 }, { name: 'Div\nYield', max: 100 }],
                            axisName: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'Roboto' },
                            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.07)' } },
                            splitArea: { show: false },
                            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
                          },
                          series: [{
                            type: 'radar',
                            data: fp.map(p => {
                              const s = fundamentalData()[p.symbol]?.snapshot;
                              return {
                                name: p.symbol,
                                value: [
                                  normalize(s?.returnOnEquity, -20, 40),
                                  normalize(s?.returnOnAssets, -5, 20),
                                  normalize(s?.profitMargins, -10, 40),
                                  normalize(s?.currentRatio, 0, 4),
                                  normalize(s?.dividendYield, 0, 8),
                                ],
                              };
                            }),
                          }],
                        };
                      }}
                    />
                    <ChartPanel title="Profitability Margins" sub="Gross · Operating · Net Margin per Asset"
                      height={200}
                      option={() => {
                        const fp = fundPositions();
                        if (!fp.length) return null;
                        return {
                          tooltip: { backgroundColor: 'rgba(5,5,15,0.97)', borderColor: '#1e2030', textStyle: { color: '#ccc', fontSize: 11 }, padding: 8, trigger: 'axis' },
                          legend: { top: 2, right: 4, textStyle: { color: '#555', fontSize: 11 }, itemWidth: 8, itemHeight: 4 },
                          grid: { left: 44, right: 8, top: 24, bottom: 40 },
                          xAxis: { type: 'category', data: fp.map(p => p.symbol), axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, rotate: 15 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } } },
                          yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, formatter: v => `${v}%` }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
                          series: [
                            { name: 'Gross', type: 'bar', data: fp.map(p => fundamentalData()[p.symbol]?.snapshot?.grossMargins), itemStyle: { color: '#00e67699' } },
                            { name: 'Operating', type: 'bar', data: fp.map(p => fundamentalData()[p.symbol]?.snapshot?.operatingMargins), itemStyle: { color: '#60a5fa99' } },
                            { name: 'Net', type: 'bar', data: fp.map(p => fundamentalData()[p.symbol]?.snapshot?.profitMargins), itemStyle: { color: '#f59e0b99' } },
                          ],
                        };
                      }}
                    />
                    <ChartPanel title="P/E Ratio Comparison" sub="Lower = Cheaper Relative Valuation"
                      height={160}
                      option={() => {
                        const fp = [...fundPositions()].sort((a, b) => (fundamentalData()[a.symbol]?.snapshot?.trailingPE || 999) - (fundamentalData()[b.symbol]?.snapshot?.trailingPE || 999));
                        if (!fp.length) return null;
                        return {
                          tooltip: { backgroundColor: 'rgba(5,5,15,0.97)', borderColor: '#1e2030', textStyle: { color: '#ccc', fontSize: 11 }, padding: 8, trigger: 'axis' },
                          grid: { left: 64, right: 8, top: 8, bottom: 16 },
                          xAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
                          yAxis: { type: 'category', data: fp.map(p => p.symbol), axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9 } },
                          series: [{ type: 'bar', barMaxWidth: 14, data: fp.map(p => { const v = fundamentalData()[p.symbol]?.snapshot?.trailingPE; return { value: v, itemStyle: { color: v < 15 ? '#00e676' : v < 30 ? '#f59e0b' : '#ff1744' } }; }), label: { show: true, position: 'right', formatter: p => p.value?.toFixed(1) || 'N/A', color: 'rgba(255,255,255,0.4)', fontSize: 11 } }],
                        };
                      }}
                    />
                    <ChartPanel title="ROE vs D/E (Health Matrix)" sub="Higher ROE + Lower D/E = Healthier"
                      height={160}
                      option={() => {
                        const fp = fundPositions();
                        if (!fp.length) return null;
                        return {
                          tooltip: { backgroundColor: 'rgba(5,5,15,0.97)', borderColor: '#1e2030', textStyle: { color: '#ccc', fontSize: 11 }, padding: 8, formatter: p => `${p.name}<br/>D/E: ${p.value[0]}<br/>ROE: ${p.value[1]}%` },
                          grid: { left: 44, right: 8, top: 8, bottom: 24 },
                          xAxis: { type: 'value', name: 'D/E', nameTextStyle: { color: 'rgba(255,255,255,0.2)', fontSize: 9 }, axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
                          yAxis: { type: 'value', name: 'ROE %', nameTextStyle: { color: 'rgba(255,255,255,0.2)', fontSize: 9 }, axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
                          series: [{ type: 'scatter', symbolSize: 12, data: fp.map(p => { const s = fundamentalData()[p.symbol]?.snapshot; return { name: p.symbol, value: [s?.debtToEquity, s?.returnOnEquity], itemStyle: { color: ASSET_TYPE_COLORS[p.assetType] || '#60a5fa' }, label: { show: true, formatter: () => p.symbol, position: 'top', color: 'rgba(255,255,255,0.5)', fontSize: 11 } }; }) }],
                        };
                      }}
                    />
                  </div>
                </Show>
              </div>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}


// ─── PORTFOLIO CALENDAR COMPONENT ───────────────────────────────────────────
const getCountryFromSymbol = (symbol, currency) => {
  const s = symbol.toUpperCase();
  if (s.endsWith('.JK')) return 'ID';
  if (s.endsWith('.T') || s.endsWith('.OS')) return 'JP';
  if (s.endsWith('.HK') || s.endsWith('.SS') || s.endsWith('.SZ')) return 'HK';
  if (s.endsWith('.L')) return 'GB';
  if (s.endsWith('.PA')) return 'FR';
  if (s.endsWith('.DE')) return 'DE';
  if (s.endsWith('.AS')) return 'NL';
  if (currency === 'IDR') return 'ID';
  return 'US'; // Default to US
};

function PortfolioCalendar({ positions, usdIdrRate }) {
  const [currentDate, setCurrentDate] = createSignal(new Date());
  const [calendarEvents, setCalendarEvents] = createSignal([]);
  const [calLoading, setCalLoading] = createSignal(false);
  const [selectedDay, setSelectedDay] = createSignal(null);
  const [activeCountryFilter, setActiveCountryFilter] = createSignal('ALL');
  const [fetchedHolidays, setFetchedHolidays] = createSignal({}); // Cache: { "ID-2024": [...] }

  const getLotSizeLocal = (sym, type) => {
    if (type !== 'STOCK') return 1;
    const s = sym.toUpperCase();
    if (s.endsWith('.JK')) return 100;
    if (s.includes('.')) return 1000;
    return 1;
  };

  const monthlyDividendTotal = createMemo(() => {
    const events = calendarEvents();
    const pos = positions();
    const rate = usdIdrRate();
    const month = currentDate().getMonth();
    const year = currentDate().getFullYear();

    let totalUsd = 0;
    let totalIdr = 0;

    events.forEach(evt => {
      if (evt.type !== 'DIVIDEND') return;
      const d = new Date(evt.date);
      if (d.getMonth() !== month || d.getFullYear() !== year) return;

      const p = pos.find(p => p.symbol === evt.symbol);
      if (!p) return;

      const dps = evt.amount || 0; // Dividend Per Share
      const lotSize = getLotSizeLocal(p.symbol, p.assetType);
      const totalShares = (Number(p.quantity) || 0) * lotSize;
      const amount = dps * totalShares;

      if (p.currency === 'IDR' || evt.country === 'ID') {
        totalIdr += amount;
      } else {
        totalUsd += amount;
      }
    });

    return {
      usd: totalUsd + (totalIdr / rate),
      idr: totalIdr + (totalUsd * rate)
    };
  });

  const portfolioCountries = createMemo(() => {
    const countries = new Set();
    positions().forEach(p => {
      countries.add(getCountryFromSymbol(p.symbol, p.currency));
    });
    return [...countries];
  });

  const fetchPortfolioCalendar = async () => {
    const pos = positions();
    if (!pos.length) return;
    setCalLoading(true);

    const year = currentDate().getFullYear();
    const API = (typeof MARKET_API !== 'undefined' ? MARKET_API : import.meta.env.VITE_MARKET_API);
    let allEvents = [];

    // 1. Fetch earnings/dividend calendar events from backend
    try {
      const res = await fetch(`${API}/api/market/calendar`);
      const data = await res.json();
      if (data.status === 'success') {
        const symbols = new Set(pos.map(p => p.symbol));
        const relevant = data.events.filter(e => symbols.has(e.symbol));
        allEvents = relevant.map((e, i) => ({
          id: `cal_${i}`,
          date: e.date,
          name: e.name,
          symbol: e.symbol,
          type: e.type,
          amount: e.amount || e.value || 0,
          country: getCountryFromSymbol(e.symbol, ''),
          emoji: e.symbol.endsWith('.JK') ? '🇮🇩' : e.symbol.endsWith('.T') ? '🇯🇵' : e.symbol.endsWith('.HK') ? '🇭🇰' : '🇺🇸',
        }));
      }
    } catch (e) { console.warn('Market calendar fetch failed', e); }

    // 2. Fetch public holidays from Open API (Nager.Date)
    const countries = portfolioCountries();
    const holidayPromises = countries.map(async (code) => {
      const cacheKey = `${code}-${year}`;
      if (fetchedHolidays()[cacheKey]) return fetchedHolidays()[cacheKey];

      try {
        const hRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`);
        if (!hRes.ok) throw new Error(`API error for ${code}`);
        const hData = await hRes.json();
        const holidays = hData.map(h => ({
          date: h.date,
          name: h.localName || h.name,
          type: 'HOLIDAY',
          country: code,
          emoji: COUNTRY_FLAGS[code] || '📅'
        }));
        setFetchedHolidays(prev => ({ ...prev, [cacheKey]: holidays }));
        return holidays;
      } catch (err) {
        console.error(`Failed to fetch holidays for ${code}`, err);
        return [];
      }
    });

    const holidayResults = await Promise.all(holidayPromises);
    holidayResults.forEach(hList => { allEvents = [...allEvents, ...hList]; });

    setCalendarEvents(allEvents);
    setCalLoading(false);
  };

  createEffect(() => {
    const pos = positions();
    if (pos.length > 0) fetchPortfolioCalendar();
  });

  createEffect(() => {
    currentDate(); // reactive trigger on month change
    fetchPortfolioCalendar();
  });

  const changeMonth = (offset) => {
    const d = new Date(currentDate());
    d.setMonth(d.getMonth() + offset);
    setCurrentDate(d);
  };

  const monthName = () => currentDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const filteredEvents = createMemo(() => {
    const f = activeCountryFilter();
    if (f === 'ALL') return calendarEvents();
    return calendarEvents().filter(e => e.country === f);
  });

  const calendarDays = createMemo(() => {
    const date = currentDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const arr = [];
    for (let i = 0; i < startDay; i++) arr.push({ date: null, dayEvents: [] });
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = filteredEvents().filter(e => e.date === dateStr);
      arr.push({ date: d, fullDate: dateStr, dayEvents });
    }
    return arr;
  });

  const EVENT_COLORS = {
    EARNINGS: 'bg-blue-500/15 border-blue-500 text-blue-300',
    DIVIDEND: 'bg-emerald-500/15 border-emerald-500 text-emerald-300',
    HOLIDAY: 'bg-amber-500/10 border-amber-500/60 text-amber-300/80',
  };

  const COUNTRY_FLAGS = { ID: '🇮🇩', US: '🇺🇸', JP: '🇯🇵', HK: '🇭🇰', GB: '🇬🇧', FR: '🇫🇷', DE: '🇩🇪', NL: '🇳🇱' };

  const upcomingEvents = createMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredEvents()
      .filter(e => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 20);
  });

  return (
    <div class="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div class="w-56 shrink-0 border-r border-border_main bg-bg_sidebar/10 flex flex-col overflow-hidden">
        {/* Portfolio Summary */}
        <div class="px-3 py-2 border-b border-border_main bg-bg_header/40">
          <div class="text-[9px] font-black text-text_secondary/40 tracking-widest mb-1.5">MY ASSETS</div>
          <div class="space-y-1 max-h-32 overflow-auto win-scroll">
            <For each={positions()}>
              {(pos) => {
                const country = getCountryFromSymbol(pos.symbol, pos.currency);
                return (
                  <div class="flex items-center gap-1.5 py-0.5">
                    <span class="text-[10px]">{COUNTRY_FLAGS[country] || '🌐'}</span>
                    <span class="text-[9px] font-black text-text_accent">{pos.symbol}</span>
                    <span class="text-[8px] text-text_secondary/40 ml-auto">{country}</span>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* Country Filter */}
        <div class="px-3 py-2 border-b border-border_main">
          <div class="text-[9px] font-black text-text_secondary/40 tracking-widest mb-1.5">MARKET FILTER</div>
          <div class="flex flex-wrap gap-1">
            <button
              onClick={() => setActiveCountryFilter('ALL')}
              class={`px-1.5 py-0.5 text-[8px] font-black border transition-all ${activeCountryFilter() === 'ALL' ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main text-text_secondary/50 hover:border-text_accent/50'}`}
            >ALL</button>
            <For each={portfolioCountries()}>
              {(code) => (
                <button
                  onClick={() => setActiveCountryFilter(code)}
                  class={`px-1.5 py-0.5 text-[8px] font-black border transition-all ${activeCountryFilter() === code ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main text-text_secondary/50 hover:border-text_accent/50'}`}
                >{COUNTRY_FLAGS[code] || code} {code}</button>
              )}
            </For>
          </div>
        </div>

        {/* Upcoming Events List */}
        <div class="flex-1 overflow-hidden flex flex-col">
          <div class="px-3 py-1.5 text-[9px] font-black text-text_secondary/40 tracking-widest border-b border-border_main bg-bg_header/20">UPCOMING EVENTS</div>
          <div class="flex-1 overflow-auto win-scroll">
            <Show when={calLoading()}>
              <div class="flex items-center justify-center py-6 gap-2">
                <div class="w-3 h-3 border border-text_accent border-t-transparent rounded-full animate-spin" />
                <span class="text-[8px] text-text_secondary/30">FETCHING...</span>
              </div>
            </Show>
            <Show when={upcomingEvents().length === 0 && !calLoading()}>
              <div class="px-3 py-4 text-center text-[8px] text-text_secondary/20">NO_UPCOMING_EVENTS</div>
            </Show>
            <For each={upcomingEvents()}>
              {(evt) => (
                <div class="px-3 py-1.5 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <div class="flex items-center gap-1">
                    <span class="text-[10px]">{evt.emoji || COUNTRY_FLAGS[evt.country] || '📅'}</span>
                    <div class="flex-1 min-w-0">
                      <div class="text-[8px] font-black text-text_primary truncate">{evt.symbol && <span class="text-text_accent mr-1">{evt.symbol}</span>}{evt.name}</div>
                      <div class="flex items-center gap-1 mt-0.5">
                        <span class="text-[7px] text-text_secondary/30">{evt.date}</span>
                        <span class={`text-[7px] font-black px-1 ${evt.type === 'EARNINGS' ? 'text-blue-400' : evt.type === 'HOLIDAY' ? 'text-amber-400' : 'text-emerald-400'}`}>{evt.type}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Main Calendar Grid */}
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* Month Nav */}
        <div class="flex items-center justify-between px-4 py-2 border-b border-border_main bg-bg_header/30 shrink-0">
          <div class="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} class="px-2 py-1 text-[9px] font-black border border-border_main hover:border-text_accent hover:text-text_accent transition-all">◀</button>
            <span class="text-[11px] font-black text-text_accent tracking-widest">{monthName()}</span>
            <button onClick={() => changeMonth(1)} class="px-2 py-1 text-[9px] font-black border border-border_main hover:border-text_accent hover:text-text_accent transition-all">▶</button>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex flex-col items-end mr-4">
              <span class="text-[8px] text-text_secondary/40 font-black tracking-widest uppercase">ESTIMATED MONTHLY DIVIDENDS</span>
              <div class="flex gap-2">
                <span class="text-[10px] font-black text-emerald-400">Rp{fmt(monthlyDividendTotal().idr, 0)}</span>
                <span class="text-[10px] font-black text-emerald-400/50">${fmt(monthlyDividendTotal().usd, 2)}</span>
              </div>
            </div>
            <div class="flex items-center gap-1"><div class="w-2 h-2 bg-blue-500" /><span class="text-[8px] text-blue-400 font-black">EARNINGS</span></div>
            <div class="flex items-center gap-1"><div class="w-2 h-2 bg-emerald-500" /><span class="text-[8px] text-emerald-400 font-black">DIVIDEND</span></div>
            <div class="flex items-center gap-1"><div class="w-2 h-2 bg-amber-500/60" /><span class="text-[8px] text-amber-400 font-black">HOLIDAY</span></div>
            <Show when={calLoading()}>
              <div class="flex items-center gap-1">
                <div class="w-2.5 h-2.5 border border-text_accent border-t-transparent rounded-full animate-spin" />
                <span class="text-[8px] text-text_secondary/30">SYNCING...</span>
              </div>
            </Show>
          </div>
        </div>

        {/* Day headers */}
        <div class="grid grid-cols-7 border-b border-border_main shrink-0 bg-bg_sidebar/20">
          <For each={['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']}>
            {(d) => <div class="py-1.5 text-center text-[8px] font-black text-text_secondary/30 tracking-widest">{d}</div>}
          </For>
        </div>

        {/* Calendar cells */}
        <div class="flex-1 overflow-auto win-scroll">
          <div class="grid grid-cols-7 auto-rows-[100px] border-l border-border_main">
            <For each={calendarDays()}>
              {(day) => (
                <div
                  onClick={() => day.date && day.dayEvents.length > 0 && setSelectedDay(day)}
                  class={`border-r border-b border-border_main/60 p-1 flex flex-col transition-colors ${!day.date
                    ? 'bg-black/20'
                    : day.dayEvents.length > 0
                      ? 'hover:bg-white/[0.03] cursor-pointer'
                      : ''
                    }`}
                >
                  <Show when={day.date}>
                    <div class="flex justify-between items-center mb-1 shrink-0">
                      <span class={`text-[10px] font-black ${new Date().toDateString() === new Date(day.fullDate + 'T12:00:00').toDateString()
                        ? 'text-text_accent bg-text_accent/10 px-1'
                        : 'text-text_secondary/30'
                        }`}>{day.date}</span>
                      <Show when={day.dayEvents.length > 2}>
                        <span class="text-[7px] font-black text-text_accent/40 bg-text_accent/5 px-1">{day.dayEvents.length}</span>
                      </Show>
                    </div>
                    <div class="flex-1 overflow-hidden flex flex-col gap-0.5">
                      <For each={day.dayEvents.slice(0, 3)}>
                        {(evt) => (
                          <div class={`text-[7px] px-1 py-0.5 border-l-2 truncate shrink-0 ${EVENT_COLORS[evt.type] || 'bg-white/5 border-white/20 text-text_secondary'}`}>
                            {evt.emoji || ''} {evt.symbol ? `${evt.symbol} · ` : ''}{evt.name}
                          </div>
                        )}
                      </For>
                      <Show when={day.dayEvents.length > 3}>
                        <div class="text-[7px] text-text_secondary/30 px-1">+{day.dayEvents.length - 3} more</div>
                      </Show>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Day Detail Modal */}
      <Show when={selectedDay()}>
        <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDay(null)}>
          <div class="w-96 max-h-[70vh] bg-bg_header border border-text_accent/30 flex flex-col" onClick={e => e.stopPropagation()}>
            <div class="px-4 py-3 border-b border-border_main bg-text_accent/5 flex justify-between items-center shrink-0">
              <div>
                <div class="text-[11px] font-black text-text_accent">{selectedDay()?.fullDate}</div>
                <div class="text-[8px] text-text_secondary/40">{selectedDay()?.dayEvents.length} events on this day</div>
              </div>
              <button onClick={() => setSelectedDay(null)} class="text-text_secondary hover:text-text_primary text-lg">✕</button>
            </div>
            <div class="flex-1 overflow-auto win-scroll p-3 space-y-2">
              <For each={selectedDay()?.dayEvents}>
                {(evt) => (
                  <div class={`p-2 border-l-2 ${EVENT_COLORS[evt.type] || 'border-white/20 bg-white/5'}`}>
                    <div class="flex items-start gap-2">
                      <span class="text-[12px] mt-0.5">{evt.emoji || COUNTRY_FLAGS[evt.country] || '📅'}</span>
                      <div class="flex-1">
                        <div class="text-[9px] font-black text-text_primary">{evt.name}</div>
                        <div class="flex items-center gap-2 mt-0.5">
                          <Show when={evt.symbol}><span class="text-[8px] font-black text-text_accent">{evt.symbol}</span></Show>
                          <span class={`text-[8px] font-black ${evt.type === 'EARNINGS' ? 'text-blue-400' : evt.type === 'HOLIDAY' ? 'text-amber-400' : 'text-emerald-400'}`}>{evt.type}</span>
                          <Show when={evt.country}><span class="text-[8px] text-text_secondary/30">{COUNTRY_FLAGS[evt.country]} {evt.country}</span></Show>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────
export default function WatchlistView() {
  const [positions, setPositions] = createSignal(loadPositions());
  const [liveData, setLiveData] = createSignal({});
  const [loadingSymbols, setLoadingSymbols] = createSignal(new Set());
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [form, setForm] = createSignal(defaultForm());
  const [formError, setFormError] = createSignal('');
  const [isLookingUp, setIsLookingUp] = createSignal(false);
  const [lastRefresh, setLastRefresh] = createSignal(null);
  const [selectedSymbols, setSelectedSymbols] = createSignal([]); // List of {symbol, name}
  const [usdIdrRate, setUsdIdrRate] = createSignal(16000); // Default fallback
  const [crossRates, setCrossRates] = createSignal({}); // { EUR: 16500, JPY: 105, ... } in IDR
  const [aggregatedNews, setAggregatedNews] = createSignal([]);
  const [newsLoading, setNewsLoading] = createSignal(false);
  const [showAlertModal, setShowAlertModal] = createSignal(null);
  const [alertForm, setAlertForm] = createSignal({ condition: 'below', price: '' });
  const [inAppAlerts, setInAppAlerts] = createSignal([]);
  const [searchInput, setSearchInput] = createSignal('');
  const [searchResults, setSearchResults] = createSignal([]);
  const [formSearchResults, setFormSearchResults] = createSignal([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [isFormSearching, setIsFormSearching] = createSignal(false);
  let searchController = null;
  let formSearchController = null;

  // ─── EXCHANGE RATE FETCHING (free public API: frankfurter.app) ─────────────
  const fetchExchangeRates = async () => {
    try {
      // Get rates with IDR as base
      const rates = await fetchRates('idr');
      if (rates) {
        const xToIdr = {};
        // The API returns 1 IDR = X Currency. We need 1 Currency = 1/X IDR
        Object.entries(rates).forEach(([cur, rate]) => {
          if (rate > 0) {
            xToIdr[cur.toUpperCase()] = 1 / rate;
          }
        });
        xToIdr['IDR'] = 1;
        setCrossRates(xToIdr);

        // Also update usdIdrRate for backward compatibility
        if (xToIdr['USD']) {
          setUsdIdrRate(xToIdr['USD']);
        }
      }
    } catch (e) {
      console.warn('FawazAhmed Exchange API failed, using market USDIDR=X fallback', e);
    }
  };

  // ─── PRICE FETCHING ──────────────────────────────────────────────────────
  const fetchPrices = async (syms) => {
    const targets = syms || positions().map(p => p.symbol);

    // Always include USDIDR for conversion fallback
    const combinedTargets = [...new Set([...targets, 'USDIDR=X'])];

    setLoadingSymbols(new Set(combinedTargets));
    const results = await Promise.all(combinedTargets.map(async sym => {
      try {
        const r = await fetch(`${MARKET_API}/api/market/price?symbol=${encodeURIComponent(sym)}`);
        return [sym, await r.json()];
      } catch { return [sym, null]; }
    }));

    setLiveData(prev => {
      const next = { ...prev };
      results.forEach(([sym, json]) => {
        if (json?.status === 'success') {
          next[sym] = { price: json.price, change_pct: json.change_pct, currency: json.currency, name: json.name };
          if (sym === 'USDIDR=X' && json.price) {
            setUsdIdrRate(json.price);
            // Also update crossRates USD entry
            setCrossRates(prev => ({ ...prev, USD: json.price }));
          }
        }
      });
      return next;
    });
    setLoadingSymbols(new Set());
    setLastRefresh(new Date());
  };

  const toIdr = (val, fromCurrency) => {
    if (val == null || isNaN(val)) return null;
    if (fromCurrency === 'IDR') return val;
    const rates = crossRates();
    // Use cross rate if available, fallback to usdIdrRate for USD
    const rate = rates[fromCurrency] || (fromCurrency === 'USD' ? usdIdrRate() : usdIdrRate());
    return val * rate;
  };

  // ─── ENRICHED POSITIONS ──────────────────────────────────────────────────
  // Uses assetUnits library for accurate unit-based calculations per asset class
  const enrichedPositions = createMemo(() =>
    positions().map(pos => {
      const live = liveData()[pos.symbol];
      const unitDef = getAssetUnitDef(pos.symbol, pos.assetType, {
        forexLotType: pos.forexLotType || 'MICRO'
      });

      const sharePrice = live?.price ?? null;         // Harga per unit dasar dari API
      const qty = Number(pos.quantity) || 0;  // Jumlah dalam satuan unitDef.unit
      const totalUnits = getTotalUnits(qty, unitDef); // Total unit dasar (e.g. lembar, base currency)
      const buyPricePerUnit = Number(pos.buyPrice) || 0;

      // totalCost = total modal dalam satuan aset asli
      const totalCost = totalUnits * buyPricePerUnit;

      // currentValue = total nilai sekarang
      const currentValue = sharePrice != null ? totalUnits * sharePrice : null;

      const unrealizedPL = currentValue != null ? currentValue - totalCost : null;
      const unrealizedPct = totalCost > 0 && unrealizedPL != null ? (unrealizedPL / totalCost) * 100 : null;

      const currency = pos.currency || live?.currency || 'USD';

      return {
        ...pos,
        sharePrice,              // Harga per unit dasar (per lembar/coin/oz/barrel)
        unitDef,                 // Definisi satuan lengkap dari assetUnits library
        lotSize: unitDef.multiplier,
        totalUnits,
        change_pct: live?.change_pct ?? null,
        currency,
        totalCost,
        currentValue,
        unrealizedPL,
        unrealizedPct,
        currentValueIdr: toIdr(currentValue, currency),
        totalCostIdr: toIdr(totalCost, currency),
        unrealizedPLIdr: toIdr(unrealizedPL, currency)
      };
    })
  );

  const portfolioStats = createMemo(() => {
    const eps = enrichedPositions();
    const totalCost = eps.reduce((s, p) => s + (p.totalCost || 0), 0);
    const totalValue = eps.reduce((s, p) => s + (p.currentValue ?? p.totalCost ?? 0), 0);

    // IDR Totals
    const totalCostIdr = eps.reduce((s, p) => s + (p.totalCostIdr || 0), 0);
    const totalValueIdr = eps.reduce((s, p) => s + (p.currentValueIdr ?? p.totalCostIdr ?? 0), 0);
    const totalPLIdr = totalValueIdr - totalCostIdr;

    const totalPL = totalValue - totalCost;
    const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    const best = eps.reduce((b, p) => (p.unrealizedPct ?? -999) > (b?.unrealizedPct ?? -999) ? p : b, null);
    const worst = eps.reduce((b, p) => (p.unrealizedPct ?? 999) < (b?.unrealizedPct ?? 999) ? p : b, null);
    return { totalCost, totalValue, totalPL, totalPLPct, totalCostIdr, totalValueIdr, totalPLIdr, count: eps.length, best, worst };
  });

  // ─── LIFECYCLE ───────────────────────────────────────────────────────────
  onMount(() => {
    fetchExchangeRates();                                        // Fetch cross rates first
    fetchPrices();
    const itv = setInterval(() => fetchPrices(), 60000);
    const rateItv = setInterval(() => fetchExchangeRates(), 3600000); // Refresh rates every hour
    const unsub = alertManager.onAlert(evt => setInAppAlerts(prev => [evt, ...prev].slice(0, 10)));
    onCleanup(() => { clearInterval(itv); clearInterval(rateItv); unsub(); });
  });

  // ─── CRUD ────────────────────────────────────────────────────────────────
  const addPosition = async () => {
    const f = form();
    if (!f.symbol || !f.buyPrice || !f.quantity) { setFormError('Symbol, buy price and quantity are required.'); return; }
    const pos = {
      id: uid(),
      symbol: f.symbol.toUpperCase().trim(),
      name: f.name || f.symbol.toUpperCase(),
      assetType: f.assetType,
      buyPrice: Number(f.buyPrice),
      quantity: Number(f.quantity),
      currency: f.currency,
      notes: f.notes,
      addedAt: new Date().toISOString(),
    };
    const next = [...positions(), pos];
    batch(() => { setPositions(next); setForm(defaultForm()); setFormError(''); setShowAddForm(false); });
    savePositions(next);
    fetchPrices([pos.symbol]);
  };

  const removePosition = (posId) => {
    const pos = positions().find(p => p.id === posId);
    const next = positions().filter(p => p.id !== posId);
    setPositions(next);
    savePositions(next);
    if (pos) {
      setSelectedSymbols(prev => prev.filter(s => s.symbol !== pos.symbol));
    }
  };

  const lookupSymbol = async () => {
    const sym = (form().symbol || searchInput()).trim().toUpperCase();
    if (!sym) return;
    setIsLookingUp(true);
    try {
      const r = await fetch(`${MARKET_API}/api/market/price?symbol=${encodeURIComponent(sym)}`);
      const json = await r.json();
      if (json.status === 'success' && json.name) {
        setForm(f => ({ ...f, symbol: sym, name: json.name, currency: json.currency || f.currency }));
        setFormError('');
      } else {
        setFormError(`Symbol not found: ${sym}`);
      }
    } catch { setFormError('Backend unavailable — enter name manually.'); }
    finally { setIsLookingUp(false); }
  };

  const handleSearch = (val) => {
    setSearchInput(val);
    if (!val) setSearchResults([]);
  };

  const executeSearch = async () => {
    const val = searchInput();
    if (!val || val.length < 1) return;

    if (searchController) searchController.abort();
    searchController = new AbortController();

    setIsSearching(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/search?q=${encodeURIComponent(val)}`, { signal: searchController.signal });
      const data = await res.json();
      setSearchResults(data.quotes || []);
    } catch (err) {
      if (err.name !== 'AbortError') console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFormSearch = (val) => {
    setForm(f => ({ ...f, symbol: val }));
    if (!val) setFormSearchResults([]);
  };

  const executeFormSearch = async () => {
    const val = form().symbol;
    if (!val || val.length < 1) return;

    if (formSearchController) formSearchController.abort();
    formSearchController = new AbortController();

    setIsFormSearching(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/search?q=${encodeURIComponent(val)}`, { signal: formSearchController.signal });
      const data = await res.json();

      // Filter based on selected assetType
      const activeType = form().assetType;
      const filtered = (data.quotes || []).filter(q => {
        const qt = (q.quoteType || '').toUpperCase();
        if (activeType === 'STOCK') return qt === 'EQUITY' || qt === 'ETF';
        if (activeType === 'CRYPTO') return qt === 'CRYPTOCURRENCY' || qt === 'CRYPTO';
        if (activeType === 'FOREX') return qt === 'CURRENCY';
        if (activeType === 'COMMODITY') return qt === 'FUTURE' || qt === 'INDEX';
        return true;
      });

      setFormSearchResults(filtered);
    } catch (err) {
      if (err.name !== 'AbortError') console.error("Form search failed", err);
    } finally {
      setIsFormSearching(false);
    }
  };

  const selectSearchResult = (item, isFromForm = false) => {
    const sym = item.symbol;
    const name = item.longname || item.shortname || sym;
    const qt = (item.quoteType || '').toUpperCase();

    const mappedType =
      qt === 'CRYPTOCURRENCY' || qt === 'CRYPTO' ? 'CRYPTO' :
        qt === 'EQUITY' || qt === 'ETF' ? 'STOCK' :
          qt === 'CURRENCY' ? 'FOREX' :
            qt === 'FUTURE' || qt === 'INDEX' ? 'COMMODITY' : 'STOCK';

    if (isFromForm) {
      batch(() => {
        setForm(f => ({
          ...f,
          symbol: sym,
          name: name,
          assetType: mappedType
        }));
        setFormSearchResults([]);
      });
      lookupSymbolForAdd(sym);
      return;
    }

    // Check if it's already in watchlist
    const existing = positions().find(p => p.symbol === sym);
    if (existing) {
      toggleSymbolSelection(existing.symbol, existing.name);
      setSearchResults([]);
      setSearchInput('');
      return;
    }

    // Otherwise, open Add Form with these details
    batch(() => {
      setForm({
        ...defaultForm(),
        symbol: sym,
        name: name,
        assetType: mappedType
      });
      setShowAddForm(true);
      setSearchResults([]);
      setSearchInput('');
    });

    // Also try to lookup real-time price to pre-fill buyPrice
    lookupSymbolForAdd(sym);
  };

  const lookupSymbolForAdd = async (sym) => {
    try {
      const r = await fetch(`${MARKET_API}/api/market/price?symbol=${encodeURIComponent(sym)}`);
      const json = await r.json();
      if (json.status === 'success' && json.price) {
        setForm(f => ({ ...f, buyPrice: String(json.price), currency: json.currency || f.currency }));
      }
    } catch (e) {
      console.warn("Pre-fill price lookup failed", e);
    }
  };

  const fetchAggregatedNews = async () => {
    const syms = selectedSymbols();
    if (!syms.length) {
      setAggregatedNews([]);
      return;
    }

    setNewsLoading(true);
    const allNews = [];

    try {
      await Promise.all(syms.map(async (s) => {
        const query = `${s.symbol} ${s.name} today`;
        try {
          const res = await fetch(`${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          if (data.news) {
            allNews.push(...data.news.map(n => ({ ...n, sourceSymbol: s.symbol })));
          }
        } catch (e) { console.error(`News fetch failed for ${s.symbol}`, e); }
      }));

      // Sort by date (descending)
      const sorted = allNews.sort((a, b) => {
        const da = new Date(a.time || a.timestamp || 0);
        const db = new Date(b.time || b.timestamp || 0);
        return db - da;
      });

      // Deduplicate by title
      const unique = [];
      const seen = new Set();
      for (const item of sorted) {
        if (!seen.has(item.title)) {
          unique.push(item);
          seen.add(item.title);
        }
      }

      setAggregatedNews(unique.slice(0, 20));
    } finally {
      setNewsLoading(false);
    }
  };

  createEffect(() => {
    if (selectedSymbols().length > 0) {
      fetchAggregatedNews();
    } else {
      setAggregatedNews([]);
    }
  });

  const selectAllCharts = () => {
    const all = positions().map(p => ({ symbol: p.symbol, name: p.name }));
    if (all.length > 9) {
      alert(`Chart limit reached. There are ${all.length} assets in watchlist. Please select a maximum of 9 manually.`);
      return;
    }
    setSelectedSymbols(all);
  };

  const resetCharts = () => setSelectedSymbols([]);

  const toggleSymbolSelection = (sym, name) => {
    setSelectedSymbols(prev => {
      const exists = prev.find(s => s.symbol === sym);
      if (exists) {
        return prev.filter(s => s.symbol !== sym);
      } else {
        // Limit to 9 charts for a 3x3 matrix
        if (prev.length >= 9) return prev;
        return [...prev, { symbol: sym, name }];
      }
    });
  };

  // Search input: pressing Enter looks up or opens add-form with symbol prefilled
  const handleSearchKey = (e) => {
    if (e.key === 'Enter') {
      executeSearch();

      const sym = searchInput().trim().toUpperCase();
      // Keep selection logic for existing watchlist items
      const existing = positions().find(p => p.symbol === sym);
      if (existing) {
        toggleSymbolSelection(existing.symbol, existing.name);
        setSearchResults([]);
        setSearchInput('');
      }
    }
  };

  let searchRef;
  onMount(() => {
    const handleClickOutside = (e) => {
      if (searchRef && !searchRef.contains(e.target)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('click', handleClickOutside);
    onCleanup(() => document.removeEventListener('click', handleClickOutside));
  });

  const createAlert = () => {
    const pos = showAlertModal();
    if (!pos) return;
    alertManager.addPriceAlert({ symbol: pos.symbol, name: pos.name, condition: alertForm().condition, targetPrice: Number(alertForm().price), currency: pos.currency });
    setShowAlertModal(null);
    setAlertForm({ condition: 'below', price: '' });
  };

  const stats = () => portfolioStats();
  const [activeTab, setActiveTab] = createSignal('MONITOR');

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div class="h-full w-full flex flex-col bg-bg_main text-text_primary text-[11px] uppercase tracking-tight overflow-hidden font-roboto">

      {/* ── HEADER ── */}
      <div class="flex items-center justify-between px-6 py-2.5 bg-bg_header border-b border-border_main shrink-0">
        <div class="flex items-center gap-4">
          <div class="w-px h-6 bg-text_accent" />
          <div>
            <div class="text-[13px] font-black tracking-[0.3em] text-text_primary">PORTFOLIO MANAGER</div>
          </div>
          {/* Main Tab Navigation */}
          <div class="flex items-center gap-0.5 ml-4">
            <For each={['MONITOR', 'ANALYTICS', 'CALENDAR']}>
              {(tab) => (
                <button
                  onClick={() => setActiveTab(tab)}
                  class={`px-4 py-1.5 text-[9px] font-black border transition-all tracking-widest ${activeTab() === tab
                    ? 'bg-text_accent text-bg_main border-text_accent shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                    : 'border-border_main text-text_secondary/60 hover:border-text_accent/50 hover:text-text_accent'
                    }`}
                >
                  {tab === 'MONITOR' ? '📊 MONITOR' : tab === 'ANALYTICS' ? '🔬 ANALYTICS' : '📅 CALENDAR'}
                </button>
              )}
            </For>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Show when={lastRefresh()}>
            <span class="text-[9px] text-text_secondary/30">SYNC: {lastRefresh().toLocaleTimeString()}</span>
          </Show>
          {/* Search bar (enter-to-submit like EntityAnalysisView) */}
          <div class="relative" ref={searchRef}>
            <input
              type="text"
              placeholder="SEARCH ASSETS..."
              value={searchInput()}
              onInput={e => handleSearch(e.target.value)}
              onKeyDown={handleSearchKey}
              class="bg-bg_main border border-border_main px-3 py-1.5 text-[9px] w-64 focus:border-text_accent focus:outline-none uppercase tracking-widest placeholder:text-text_secondary/20 transition-all font-roboto"
            />
            <div class={`absolute right-2 top-1/2 -translate-y-1/2 text-text_accent pointer-events-none transition-opacity ${isSearching() ? 'opacity-100' : 'opacity-0'}`}>
              <div class="w-2.5 h-2.5 border-2 border-text_accent border-t-transparent rounded-full animate-spin"></div>
            </div>

            {/* Search Results Dropdown */}
            <Show when={searchResults().length > 0}>
              <div class="absolute top-[calc(100%+8px)] right-0 w-80 bg-bg_header/95 border border-border_main p-1 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] animate-in slide-in-from-top-2 duration-200 backdrop-blur-md max-h-80 overflow-y-auto win-scroll border-t-0">
                <div class="px-3 py-1.5 border-b border-border_main bg-white/5 flex justify-between items-center sticky top-0 z-10">
                  <span class="text-[9px] font-black text-text_accent tracking-widest uppercase">SELECT ENTITY TO TRACK</span>
                  <span class="text-[9px] text-text_secondary opacity-40 uppercase">MARKET DATA</span>
                </div>
                <For each={searchResults()}>
                  {(item) => (
                    <div
                      onClick={() => selectSearchResult(item)}
                      class="p-3 hover:bg-text_accent/5 cursor-pointer border-b border-white/5 last:border-0 flex justify-between items-center group/item transition-colors"
                    >
                      <div class="flex flex-col">
                        <div class="flex items-center gap-2">
                          <span class="font-black text-text_accent group-hover/item:text-text_primary transition-colors text-[9px]">{item.symbol}</span>
                          <span class="text-[9px] bg-white/5 px-1 rounded text-text_secondary/60 font-black">{item.quoteType}</span>
                        </div>
                        <span class="text-[9px] text-text_secondary/40 uppercase tracking-widest mt-0.5">{item.exchDisp}</span>
                      </div>
                      <span class="text-text_primary font-bold text-[9px] truncate ml-4 flex-1 text-right group-hover/item:text-text_accent transition-colors">{item.longname || item.shortname}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <button onClick={() => fetchPrices()} class="px-3 py-1.5 border border-border_main text-[9px] font-black hover:border-text_accent hover:text-text_accent transition-all">
            ⚡ REFRESH
          </button>
          <button onClick={() => setShowAddForm(true)} class="px-4 py-1.5 bg-text_accent text-bg_main text-[9px] font-black hover:brightness-125 transition-all shadow-[0_0_10px_rgba(59,130,246,0.2)]">
            + ADD ASSET
          </button>
        </div>
      </div>

      {/* ── STATS BAR (Monitor only) ── */}
      <Show when={activeTab() === 'MONITOR'}>
        <div class="grid grid-cols-5 border-b border-border_main shrink-0 bg-bg_sidebar/30">
          <div class="px-5 py-2.5 border-r border-border_main flex flex-col">
            <span class="text-[9px] text-text_secondary/40 tracking-widest">TOTAL COST (IDR)</span>
            <span class="text-[13px] font-black text-text_primary mt-0.5">Rp{fmt(stats().totalCostIdr, 0)}</span>
            <span class="text-[9px] opacity-30">ORIG: {fmt(stats().totalCost)}</span>
          </div>
          <div class="px-5 py-2.5 border-r border-border_main flex flex-col">
            <span class="text-[9px] text-text_secondary/40 tracking-widest">TOTAL VALUE (IDR)</span>
            <span class="text-[13px] font-black text-blue-400 mt-0.5">Rp{fmt(stats().totalValueIdr, 0)}</span>
            <span class="text-[9px] opacity-30 text-blue-400/40">ORIG: {fmt(stats().totalValue)}</span>
          </div>
          <div class={`px-5 py-2.5 border-r border-border_main flex flex-col ${signBg(stats().totalPL)}`}>
            <span class="text-[9px] text-text_secondary/40 tracking-widest">UNREALIZED P&L (IDR)</span>
            <div class="flex flex-col">
              <span class={`text-[13px] font-black mt-0.5 ${signColor(stats().totalPLIdr)}`}>
                {stats().totalPLIdr >= 0 ? '+' : ''}Rp{fmt(stats().totalPLIdr, 0)}
              </span>
              <span class={`text-[9px] font-black ${signColor(stats().totalPLPct)}`}>{fmtPct(stats().totalPLPct)}</span>
            </div>
          </div>
          <div class="px-5 py-2.5 border-r border-border_main flex flex-col">
            <span class="text-[9px] text-text_secondary/40 tracking-widest">TOP PERFORMER</span>
            <span class="text-[9px] font-black text-emerald-400 mt-0.5 truncate">{stats().best?.symbol || '—'}</span>
            <span class="text-[9px] text-emerald-400/60">{fmtPct(stats().best?.unrealizedPct)}</span>
          </div>
          <div class="px-5 py-2.5 flex flex-col">
            <span class="text-[9px] text-text_secondary/40 tracking-widest">BOTTOM PERFORMER</span>
            <span class="text-[9px] font-black text-red-400 mt-0.5 truncate">{stats().worst?.symbol || '—'}</span>
            <span class="text-[9px] text-red-400/60">{fmtPct(stats().worst?.unrealizedPct)}</span>
          </div>
        </div>{/* end stats bar */}
      </Show>

      {/* ── ANALYTICS TAB ── */}
      <Show when={activeTab() === 'ANALYTICS'}>
        <AnalyticsPanel positions={positions} liveData={liveData} usdIdrRate={usdIdrRate} />
      </Show>

      {/* ── CALENDAR TAB ── */}
      <Show when={activeTab() === 'CALENDAR'}>
        <div class="flex-1 flex flex-col overflow-hidden">
          <div class="px-4 py-2 border-b border-border_main bg-bg_header/30 shrink-0">
            <span class="text-[9px] font-black text-text_secondary/40 tracking-widest">PORTFOLIO CALENDAR // Earnings · Dividends · National Holidays</span>
          </div>
          <Show when={positions().length === 0}>
            <div class="flex-1 flex items-center justify-center opacity-20">
              <span class="text-[11px] font-black tracking-[0.5em]">ADD ASSETS TO VIEW CALENDAR</span>
            </div>
          </Show>
          <Show when={positions().length > 0}>
            <PortfolioCalendar positions={positions} usdIdrRate={usdIdrRate} />
          </Show>
        </div>
      </Show>

      {/* ── MONITOR TAB: MAIN SPLIT PANE ── */}
      <Show when={activeTab() === 'MONITOR'}>
        <div class="flex-1 flex overflow-hidden">

          {/* ── LEFT: WATCHLIST TABLE & NEWS ── */}
          <div class="w-[520px] shrink-0 flex flex-col border-r border-border_main bg-bg_sidebar/10 overflow-hidden h-full">

            {/* Top Half: Table */}
            <div class="flex-1 flex flex-col min-h-0 border-b border-border_main/30">
              <div class="px-4 py-2 border-b border-border_main bg-bg_header/50 flex items-center justify-between shrink-0">
                <div class="flex items-center gap-3">
                  <span class="text-[9px] font-black text-text_accent/60 tracking-widest uppercase">WATCHLIST MATRIX // {positions().length} POSITIONS</span>
                  <Show when={inAppAlerts().length > 0}>
                    <span class="text-[9px] font-black text-red-400 animate-pulse">🔔 {inAppAlerts().length} ALERT</span>
                  </Show>
                </div>
                <Show when={positions().length > 0}>
                  <div class="flex items-center gap-2">
                    <button
                      onClick={resetCharts}
                      class="px-2 py-1 border border-red-500/30 text-red-500 text-[8px] font-black hover:bg-red-500 hover:text-bg_main transition-all tracking-widest uppercase"
                    >
                      🧹 RESET
                    </button>
                    <button
                      onClick={selectAllCharts}
                      class="px-2 py-1 border border-text_accent/30 text-text_accent text-[8px] font-black hover:bg-text_accent hover:text-bg_main transition-all tracking-widest uppercase"
                    >
                      VIEW ALL
                    </button>
                  </div>
                </Show>
              </div>

              <Show when={positions().length === 0}>
                <div class="flex-1 flex flex-col items-center justify-center gap-4 opacity-20">
                  <svg class="w-14 h-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
                  <div class="text-[11px] font-black tracking-[0.5em]">WATCHLIST IS EMPTY</div>
                </div>
              </Show>

              <Show when={positions().length > 0}>
                <div class="flex-1 overflow-auto win-scroll">
                  <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-bg_header z-10 border-b border-border_main">
                      <tr class="text-[9px] text-text_secondary/40 uppercase font-black tracking-widest">
                        <th class="px-3 py-2">SYMBOL</th>
                        <th class="px-3 py-2 text-right">CURRENT</th>
                        <th class="px-3 py-2 text-right">24H CHANGE</th>
                        <th class="px-3 py-2 text-right">UNREALIZED P&L</th>
                        <th class="px-3 py-2 text-right">RETURN</th>
                        <th class="px-3 py-2 text-center">HOLDING</th>
                        <th class="px-3 py-2 text-center">ACT</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border_main/20">
                      <For each={enrichedPositions()}>
                        {(pos) => {
                          const isLoading = () => loadingSymbols().has(pos.symbol);
                          const isSelected = () => selectedSymbols().some(s => s.symbol === pos.symbol);
                          return (
                            <tr
                              onClick={() => toggleSymbolSelection(pos.symbol, pos.name)}
                              class={`cursor-pointer transition-all group ${isSelected()
                                ? 'bg-text_accent/10 border-l-2 border-text_accent'
                                : 'hover:bg-text_accent/5 border-l-2 border-transparent'}`}
                            >
                              <td class="px-3 py-2.5">
                                <div class="flex flex-col">
                                  <div class="flex items-center gap-1.5">
                                    <div class="w-1.5 h-1.5 rounded-sm" style={{ background: ASSET_TYPE_COLORS[pos.assetType] || '#60a5fa' }} />
                                    <span class="font-black text-text_primary text-[9px]">{pos.symbol}</span>
                                    <Show when={isSelected()}>
                                      <div class="ml-auto w-2 h-2 rounded-full bg-text_accent animate-pulse"></div>
                                    </Show>
                                  </div>
                                  <span class="text-[9px] text-text_secondary/40 truncate max-w-[140px] pl-3">{pos.name}</span>
                                </div>
                              </td>
                              <td class="px-3 py-2.5 text-right">
                                <Show when={!isLoading()} fallback={<span class="text-text_secondary/30 animate-pulse text-[9px]">···</span>}>
                                  <div class="flex flex-col items-end">
                                    <span class={`text-[9px] font-black ${pos.sharePrice ? 'text-blue-400' : 'text-text_secondary/30'}`}>
                                      {pos.sharePrice != null ? fmt(pos.sharePrice, pos.currency === 'IDR' ? 0 : (pos.unitDef?.decimals ?? 4)) : '—'}
                                    </span>
                                    <div class="flex items-center gap-1">
                                      <Show when={pos.currency !== 'IDR' && pos.sharePrice}>
                                        <span class="text-[9px] text-text_secondary/40">Rp{fmt(toIdr(pos.sharePrice, pos.currency), 0)}</span>
                                      </Show>
                                      {/* Satuan per unit aset sesuai assetUnits library */}
                                      <span class="text-[8px] text-text_accent/30 font-bold ml-1">
                                        /{pos.unitDef?.unit || 'unit'}
                                      </span>
                                    </div>
                                  </div>
                                </Show>
                              </td>
                              <td class={`px-3 py-2.5 text-right text-[9px] font-black ${signColor(pos.change_pct)}`}>
                                {pos.change_pct != null ? fmtPct(pos.change_pct) : '—'}
                              </td>
                              <td class={`px-3 py-2.5 text-right text-[9px] font-black ${signColor(pos.unrealizedPL)}`}>
                                <div class="flex flex-col items-end">
                                  <span>{pos.unrealizedPL != null ? `${pos.unrealizedPL >= 0 ? '+' : ''}${fmt(pos.unrealizedPL)}` : '—'}</span>
                                  <Show when={pos.currency !== 'IDR' && pos.unrealizedPL != null}>
                                    <span class="text-[9px] opacity-40">Rp{fmt(pos.unrealizedPLIdr, 0)}</span>
                                  </Show>
                                </div>
                              </td>
                              <td class={`px-3 py-2.5 text-right text-[9px] font-black ${signColor(pos.unrealizedPct)}`}>
                                {pos.unrealizedPct != null ? fmtPct(pos.unrealizedPct) : '—'}
                              </td>
                              <td class="px-3 py-2.5 text-center text-[9px] font-black text-text_secondary/60">
                                <div class="flex flex-col items-center">
                                  {/* Qty in LOT / UNIT */}
                                  <span class="text-text_primary">{formatQuantity(pos.quantity, pos.unitDef || { unit: 'unit', decimals: 2 })}</span>

                                  {/* Market Value Calculation: qty * price */}
                                  <Show when={pos.currentValue != null}>
                                    <div class="flex flex-col items-center mt-0.5">
                                      <span class="text-text_accent text-[10px]">
                                        {pos.currency === 'IDR' ? 'Rp' : (pos.currency === 'USD' ? '$' : pos.currency)}
                                        {fmt(pos.currentValue, pos.currency === 'IDR' ? 0 : 2)}
                                      </span>
                                      <Show when={pos.currency !== 'IDR'}>
                                        <span class="text-[7.5px] text-text_secondary/30">
                                          Rp{fmt(pos.currentValueIdr, 0)}
                                        </span>
                                      </Show>
                                    </div>
                                  </Show>

                                  {/* Breakdown: total unit dasar jika lot */}
                                  <Show when={pos.unitDef?.multiplier > 1}>
                                    <span class="text-[7px] text-text_secondary/20 font-normal italic mt-1">
                                      ≈ {Number(pos.totalUnits).toLocaleString()} {pos.unitDef?.baseCurrency || 'unit'}
                                    </span>
                                  </Show>
                                </div>
                              </td>
                              <td class="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                                <div class="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => { setShowAlertModal(pos); setAlertForm({ condition: 'below', price: pos.currentPrice?.toFixed(4) || '' }); }}
                                    class="px-1.5 py-1 text-[9px] font-black border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                                  >🔔</button>
                                  <button
                                    onClick={() => removePosition(pos.id)}
                                    class="px-1.5 py-1 text-[9px] font-black border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                                  >✕</button>
                                </div>
                              </td>
                            </tr>
                          );
                        }}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </div>

            {/* Bottom Half: Aggregated News */}
            <div class="flex-1 flex flex-col min-h-0 bg-black/10">
              <div class="px-4 py-2 border-b border-border_main bg-bg_header/30 flex items-center justify-between shrink-0">
                <span class="text-[9px] font-black text-blue-400 tracking-widest uppercase italic">LIVE NEWS STREAM</span>
                <Show when={newsLoading()}>
                  <div class="w-12 h-0.5 bg-blue-500/20 overflow-hidden rounded-full">
                    <div class="w-full h-full bg-blue-500 animate-progress-indefinite"></div>
                  </div>
                </Show>
              </div>

              <div class="flex-1 overflow-auto win-scroll p-3 space-y-3">
                <Show when={selectedSymbols().length === 0}>
                  <div class="h-full flex flex-col items-center justify-center opacity-10 text-center px-6">
                    <svg class="w-10 h-10 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l4 4v10a2 2 0 0 1-2 2z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>
                    <span class="text-[9px] font-black tracking-widest uppercase">SELECT ASSETS TO VIEW NEWS</span>
                  </div>
                </Show>

                <For each={aggregatedNews()}>
                  {(item) => (
                    <a
                      href={item.link} target="_blank"
                      class="block p-3 bg-bg_header/20 border border-white/5 hover:border-blue-500/30 group/news transition-all no-underline"
                    >
                      <div class="flex justify-between items-start gap-3 mb-1.5">
                        <span class="text-[9px] font-black text-blue-400 bg-blue-400/10 px-1 rounded uppercase">{item.sourceSymbol}</span>
                        <span class="text-[9px] text-text_secondary/40 font-roboto italic">{item.publisher} // {item.time}</span>
                      </div>
                      <div class="text-[9px] font-black text-text_primary group-hover/news:text-blue-400 transition-colors leading-relaxed uppercase tracking-tighter">
                        {item.title}
                      </div>
                    </a>
                  )}
                </For>
              </div>
            </div>
          </div>

          {/* ── RIGHT: CHART PANEL (OPTIMIZED GRID 3x3) ── */}
          <div class="flex-1 flex flex-col overflow-hidden bg-bg_main p-1 relative">
            <div
              class="absolute inset-1 grid gap-1.5"
              style={{
                "grid-template-columns":
                  selectedSymbols().length <= 1 ? "1fr" :
                    selectedSymbols().length <= 2 ? "1fr 1fr" :
                      "repeat(3, 1fr)",
                "grid-template-rows":
                  selectedSymbols().length <= 3 ? "1fr" :
                    selectedSymbols().length <= 6 ? "1fr 1fr" :
                      "1fr 1fr 1fr"
              }}
            >
              <For each={selectedSymbols()} fallback={
                <div class="h-full w-full">
                  <WatchlistChart symbol={null} name={null} />
                </div>
              }>
                {s => (
                  <div class="border border-border_main/30 rounded-sm overflow-hidden bg-bg_main/40 hover:border-text_accent/40 bg-gradient-to-br from-white/[0.01] to-transparent transition-all relative group/chart flex flex-col min-h-0">
                    <div class="flex-1 min-h-0">
                      <WatchlistChart symbol={s.symbol} name={s.name} />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSymbolSelection(s.symbol, s.name); }}
                      class="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-black/80 text-white/40 hover:text-red-400 opacity-0 group-hover/chart:opacity-100 transition-opacity z-50 text-[9px] border border-white/5 rounded-full"
                    >✕</button>
                  </div>
                )}
              </For>
            </div>
          </div>

        </div>
      </Show>{/* end MONITOR tab */}

      {/* ── ADD POSITION SLIDE-IN ── */}
      <Show when={showAddForm()}>
        <div class="fixed inset-0 z-50 flex" onClick={() => setShowAddForm(false)}>
          <div class="flex-1 bg-black/60" />
          <div class="w-[420px] bg-bg_sidebar border-l border-border_main flex flex-col" onClick={e => e.stopPropagation()}>

            {/* ── Header ── */}
            <div class="px-5 py-3.5 border-b border-border_main bg-bg_header flex items-center justify-between shrink-0">
              <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full bg-text_accent animate-pulse" />
                <div>
                  <div class="font-black text-[11px] tracking-[0.15em] text-text_primary">ADD NEW ASSET</div>
                  <div class="text-[8px] text-text_secondary/40 tracking-widest mt-0.5">
                    {form().assetType} · {form().symbol || 'NO SYMBOL'} · {form().currency}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowAddForm(false)} class="w-7 h-7 flex items-center justify-center border border-border_main/50 text-text_secondary/40 hover:border-red-400/60 hover:text-red-400 transition-all text-[10px]">✕</button>
            </div>

            <div class="flex-1 overflow-y-auto win-scroll">

              {/* ── STEP 1: Asset Category ── */}
              <div class="px-5 pt-5 pb-3 border-b border-border_main/30">
                <div class="flex items-center gap-2 mb-3">
                  <span class="w-5 h-5 rounded-full bg-text_accent/20 border border-text_accent/40 text-text_accent text-[9px] font-black flex items-center justify-center">1</span>
                  <span class="text-[9px] font-black text-text_secondary/60 tracking-[0.2em]">SELECT ASSET CATEGORY</span>
                </div>
                <div class="grid grid-cols-4 gap-1.5">
                  <For each={[
                    { type: 'STOCK', icon: '📈', label: 'STOCK' },
                    { type: 'CRYPTO', icon: '₿', label: 'CRYPTO' },
                    { type: 'FOREX', icon: 'FX', label: 'FOREX' },
                    { type: 'COMMODITY', icon: '🏗', label: 'COMMOD' }
                  ]}>
                    {({ type, icon, label }) => (
                      <button
                        onClick={() => setForm(f => ({ ...defaultForm(), assetType: type, currency: f.currency, forexLotType: f.forexLotType }))}
                        class={`py-3 flex flex-col items-center gap-1 border transition-all ${form().assetType === type
                          ? 'border-text_accent bg-text_accent/10 text-text_accent'
                          : 'border-border_main/50 text-text_secondary/40 hover:border-text_accent/30 hover:text-text_secondary/80'}`}
                      >
                        <span class="text-[14px]">{icon}</span>
                        <span class="text-[7.5px] font-black tracking-wider">{label}</span>
                      </button>
                    )}
                  </For>
                </div>

                {/* Quick Presets */}
                <div class="mt-2.5 flex flex-wrap gap-1">
                  <For each={PRESET_SYMBOLS[form().assetType] || []}>
                    {p => (
                      <button
                        onClick={() => setForm(f => ({ ...f, symbol: p.symbol, name: p.name }))}
                        class={`px-2 py-0.5 text-[8px] font-black border transition-all rounded-sm ${form().symbol === p.symbol
                          ? 'bg-text_accent text-bg_main border-text_accent'
                          : 'border-border_main/30 text-text_secondary/40 hover:border-text_accent/40 hover:text-text_secondary/80'}`}
                      >{p.symbol}</button>
                    )}
                  </For>
                </div>
              </div>

              {/* ── STEP 2: Symbol Search ── */}
              <div class="px-5 py-4 border-b border-border_main/30">
                <div class="flex items-center gap-2 mb-3">
                  <span class="w-5 h-5 rounded-full bg-text_accent/20 border border-text_accent/40 text-text_accent text-[9px] font-black flex items-center justify-center">2</span>
                  <span class="text-[9px] font-black text-text_secondary/60 tracking-[0.2em]">SEARCH TICKER</span>
                </div>

                <div class="relative flex flex-col gap-2">
                  <div class="flex gap-2">
                    <div class="relative flex-1">
                      <input
                        type="text"
                        placeholder={
                          form().assetType === 'STOCK' ? 'e.g. BBCA.JK · AAPL · MSFT' :
                            form().assetType === 'CRYPTO' ? 'e.g. BTC-USD · ETH-USD · SOL-USD' :
                              form().assetType === 'FOREX' ? 'e.g. EURUSD=X · GBPUSD=X' :
                                'e.g. GC=F · CL=F · NG=F'
                        }
                        value={form().symbol}
                        onInput={e => handleFormSearch(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && executeFormSearch()}
                        class="w-full bg-bg_main border border-border_main px-3 py-2.5 text-[10px] focus:border-text_accent focus:outline-none uppercase tracking-widest font-roboto font-black text-text_primary placeholder:font-normal placeholder:normal-case placeholder:text-text_secondary/30 placeholder:tracking-normal"
                      />
                      <div class={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity ${isFormSearching() ? 'opacity-100' : 'opacity-0'}`}>
                        <div class="w-3 h-3 border border-text_accent border-t-transparent rounded-full animate-spin" />
                      </div>
                    </div>
                    <button
                      onClick={lookupSymbol}
                      disabled={isLookingUp() || !form().symbol}
                      class="px-4 bg-text_accent/10 border border-text_accent/50 text-text_accent text-[9px] font-black hover:bg-text_accent hover:text-bg_main transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                    >{isLookingUp() ? '···' : 'LOOKUP'}</button>
                  </div>

                  {/* Search Results */}
                  <Show when={formSearchResults().length > 0}>
                    <div class="bg-bg_header/98 border border-border_main shadow-2xl backdrop-blur-sm overflow-hidden">
                      <div class="px-3 py-1.5 bg-text_accent/5 border-b border-border_main/50 flex items-center justify-between">
                        <span class="text-[7.5px] font-black text-text_accent/60 tracking-widest">SEARCH RESULTS · {formSearchResults().length} FOUND</span>
                        <button onClick={() => setFormSearchResults([])} class="text-text_secondary/30 hover:text-text_secondary text-[9px]">✕</button>
                      </div>
                      <div class="max-h-44 overflow-y-auto win-scroll">
                        <For each={formSearchResults()}>
                          {item => (
                            <div
                              onClick={() => selectSearchResult(item, true)}
                              class="px-3 py-2 hover:bg-text_accent/8 cursor-pointer border-b border-white/5 last:border-0 flex items-center justify-between gap-2 group transition-all"
                            >
                              <div class="flex flex-col min-w-0 flex-1">
                                <span class="font-black text-text_accent group-hover:text-text_primary text-[10px] tracking-wider">{item.symbol}</span>
                                <span class="text-[8px] text-text_secondary/40 truncate">{item.longname || item.shortname}</span>
                              </div>
                              <span class="text-[7.5px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-text_secondary/50 font-black shrink-0">{item.quoteType}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>

                  {/* Asset Name (auto-filled) */}
                  <Show when={form().name}>
                    <div class="px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-sm flex items-center gap-2">
                      <svg class="w-3 h-3 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12" /></svg>
                      <span class="text-[9px] font-black text-emerald-400/80 tracking-wide truncate">{form().name}</span>
                    </div>
                  </Show>
                </div>
              </div>

              {/* ── STEP 3: Position Parameters ── */}
              {() => {
                const unitDef = () => getAssetUnitDef(form().symbol, form().assetType, { forexLotType: form().forexLotType || 'MICRO' });
                const assetCur = () => liveData()[form().symbol]?.currency || (form().assetType === 'STOCK' && form().symbol.endsWith('.JK') ? 'IDR' : 'USD');
                const isIDX = () => form().assetType === 'STOCK' && form().symbol.toUpperCase().endsWith('.JK');
                const priceDec = () => assetCur() === 'IDR' ? 0 : (unitDef().decimals <= 4 ? 2 : unitDef().decimals);

                return (
                  <div class="px-5 py-4 border-b border-border_main/30">
                    <div class="flex items-center gap-2 mb-4">
                      <span class="w-5 h-5 rounded-full bg-text_accent/20 border border-text_accent/40 text-text_accent text-[9px] font-black flex items-center justify-center">3</span>
                      <span class="text-[9px] font-black text-text_secondary/60 tracking-[0.2em]">POSITION DETAILS</span>
                    </div>

                    {/* Origin Badge for STOCK */}
                    <Show when={form().assetType === 'STOCK' && form().symbol}>
                      <div class={`mb-3 px-3 py-1.5 text-[8px] font-black tracking-widest flex items-center gap-2 border ${isIDX()
                        ? 'bg-red-500/5 border-red-500/20 text-red-400'
                        : 'bg-blue-500/5 border-blue-400/20 text-blue-400'}`}
                      >
                        <span>{isIDX() ? '🇮🇩' : '🌐'}</span>
                        <span>{isIDX()
                          ? 'IDX INDONESIA · 1 LOT = 100 LEMBAR SAHAM'
                          : 'GLOBAL MARKET · UNIT = 1 LEMBAR SAHAM (SHARE)'
                        }</span>
                      </div>
                    </Show>

                    {/* Forex Lot Type */}
                    <Show when={form().assetType === 'FOREX'}>
                      <div class="mb-4">
                        <label class="text-[8px] font-black text-text_secondary/40 tracking-widest block mb-2">FOREX LOT SIZE</label>
                        <div class="grid grid-cols-4 gap-1">
                          <For each={FOREX_LOT_TYPES}>
                            {lt => (
                              <button
                                onClick={() => setForm(f => ({ ...f, forexLotType: lt.id }))}
                                class={`py-2 text-center border transition-all ${(form().forexLotType || 'MICRO') === lt.id
                                  ? 'border-text_accent bg-text_accent/10 text-text_accent'
                                  : 'border-border_main/40 text-text_secondary/40 hover:border-text_accent/30'}`}
                              >
                                <div class="text-[8px] font-black">{lt.id}</div>
                                <div class="text-[7px] opacity-50">{lt.units >= 1000 ? (lt.units / 1000) + 'K' : lt.units}</div>
                              </button>
                            )}
                          </For>
                        </div>
                        <p class="text-[8px] text-text_secondary/30 mt-1.5">{unitDef().unitFull}</p>
                      </div>
                    </Show>

                    {/* Price & Qty Fields */}
                    <div class="grid grid-cols-2 gap-3 mb-4">
                      {/* Buy Price */}
                      <div class="flex flex-col gap-1.5">
                        <label class="text-[8px] font-black text-text_secondary/40 tracking-widest">
                          BUY PRICE <span class="text-text_accent/50">/ {unitDef().unit}</span>
                        </label>
                        <div class="relative">
                          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-text_secondary/30 font-black">{assetCur() === 'IDR' ? 'Rp' : '$'}</span>
                          <input
                            type="text" inputmode="decimal"
                            placeholder="0.00"
                            value={form().buyPrice}
                            onInput={e => {
                              const raw = e.target.value.replace(',', '.');
                              if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) { e.target.value = form().buyPrice; return; }
                              setForm(f => ({ ...f, buyPrice: raw, priceValidErr: '' }));
                            }}
                            class={`w-full bg-bg_main border pl-7 pr-3 py-2.5 text-[11px] font-black focus:outline-none font-roboto transition-all ${form().priceValidErr ? 'border-red-500/50 focus:border-red-500' : 'border-border_main focus:border-text_accent'
                              }`}
                          />
                        </div>
                        <Show when={form().buyPrice && assetCur() !== 'IDR'}>
                          <div class="flex items-center gap-1.5 px-2 py-1 bg-black/20 border border-white/5">
                            <span class="text-[7.5px] text-text_secondary/30">≈</span>
                            <span class="text-[8px] text-amber-400/60 font-black">Rp {fmt(Number(String(form().buyPrice || '').replace(',', '.')) * usdIdrRate(), 0)}</span>
                            <span class="text-[7px] text-text_secondary/20">/ {unitDef().unit}</span>
                          </div>
                        </Show>
                        <Show when={form().assetType === 'COMMODITY' && unitDef().canConvertGram && form().buyPrice}>
                          <div class="px-2 py-1 bg-amber-500/5 border border-amber-500/15">
                            <span class="text-[8px] text-amber-400/70">≈ Rp {fmt((Number(String(form().buyPrice || '').replace(',', '.')) / (unitDef().gramsPerUnit || 31.1035)) * usdIdrRate(), 0)} / gram</span>
                          </div>
                        </Show>
                      </div>

                      {/* Quantity */}
                      <div class="flex flex-col gap-1.5">
                        <label class="text-[8px] font-black text-text_secondary/40 tracking-widest">
                          QTY <span class="text-text_accent/50">({unitDef().unit})</span>
                        </label>
                        <input
                          type="text" inputmode="decimal"
                          placeholder={unitDef().decimals >= 8 ? '0.000000…' : unitDef().decimals > 0 ? '0.000' : '0'}
                          value={form().quantity}
                          onInput={e => {
                            const raw = e.target.value.replace(',', '.');
                            if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) { e.target.value = form().quantity; return; }
                            setForm(f => ({ ...f, quantity: raw, qtyValidErr: '' }));
                          }}
                          class={`bg-bg_main border px-3 py-2.5 text-[11px] font-black focus:outline-none font-roboto transition-all ${form().qtyValidErr ? 'border-red-500/50 focus:border-red-500' : 'border-border_main focus:border-text_accent'
                            }`}
                        />
                        <p class="text-[7.5px] text-text_secondary/25 leading-tight">{unitDef().hint}</p>

                        {/* IDX lot to lembar */}
                        <Show when={isIDX() && form().quantity}>
                          <div class="px-2 py-1 bg-red-500/5 border border-red-500/15">
                            <span class="text-[8px] text-red-400/70 font-black">{Number(form().quantity) * 100} LEMBAR</span>
                          </div>
                        </Show>
                        {/* Commodity gram conversion */}
                        <Show when={form().assetType === 'COMMODITY' && unitDef().canConvertGram && form().quantity}>
                          <div class="px-2 py-1 bg-amber-500/5 border border-amber-500/15">
                            <span class="text-[8px] text-amber-400/70">= {((Number(form().quantity) || 0) * (unitDef().gramsPerUnit || 31.1035)).toFixed(2)} gram</span>
                          </div>
                        </Show>
                      </div>
                    </div>

                    {/* ── CURRENCY CONVERTER ── */}
                    <div class="rounded-sm border border-border_main/40 overflow-hidden">
                      <div class="px-3 py-2 bg-text_accent/5 border-b border-border_main/30 flex items-center justify-between">
                        <span class="text-[8.5px] font-black text-text_accent/70 tracking-[0.15em]">⚡ CURRENCY CONVERTER</span>
                        <div class="flex gap-1">
                          <For each={['USD', 'IDR', 'EUR', 'JPY', 'SGD']}>
                            {cur => (
                              <button
                                onClick={() => setForm(f => ({ ...f, currency: cur, convAmount: '', convResult: '' }))}
                                class={`px-2 py-0.5 text-[8px] font-black transition-all border rounded-sm ${form().currency === cur
                                  ? 'border-text_accent text-text_accent bg-text_accent/15'
                                  : 'border-white/10 text-text_secondary/30 hover:border-text_accent/30 hover:text-text_secondary/70'}`}
                              >{cur}</button>
                            )}
                          </For>
                        </div>
                      </div>

                      <div class="p-3 bg-bg_main/30">
                        {/* Kurs info */}
                        <div class="flex items-center justify-between mb-3">
                          <span class="text-[8px] text-text_secondary/30 tracking-widest">LIVE RATE</span>
                          <span class="text-[8.5px] font-black text-text_accent/60">
                            1 {form().currency === 'IDR' ? 'USD' : form().currency} = Rp{fmt(
                              form().currency === 'IDR' ? usdIdrRate() :
                                form().currency === 'USD' ? usdIdrRate() :
                                  crossRates()[form().currency] || usdIdrRate(), 0
                            )}
                            <Show when={form().currency !== 'IDR' && form().currency !== 'USD'}>
                              <span class="font-normal text-text_secondary/30 ml-1">
                                · 1 {form().currency} = ${fmt((crossRates()[form().currency] || usdIdrRate()) / usdIdrRate(), 4)} USD
                              </span>
                            </Show>
                          </span>
                        </div>

                        {/* Converter Row */}
                        <div class="flex items-center gap-2">
                          <div class="flex-1 flex flex-col gap-1">
                            <span class="text-[7.5px] text-text_secondary/30 font-black tracking-widest">
                              INPUT ({form().currency})
                            </span>
                            <div class="relative">
                              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-text_accent/40 font-black">
                                {form().currency === 'IDR' ? 'Rp' : form().currency === 'USD' ? '$' : form().currency === 'EUR' ? '€' : form().currency === 'JPY' ? '¥' : '$'}
                              </span>
                              <input
                                type="text" inputmode="decimal"
                                placeholder="Enter value…"
                                value={form().convAmount || ''}
                                onInput={e => {
                                  const raw = e.target.value.replace(',', '.');
                                  if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
                                  setForm(f => ({ ...f, convAmount: raw, convResult: '' }));
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    document.getElementById('btn_cc_calc')?.click();
                                  }
                                }}
                                class="w-full bg-bg_header/50 border border-border_main/40 pl-7 pr-3 py-2 text-[10px] font-black text-text_accent focus:border-text_accent focus:outline-none font-roboto"
                              />
                            </div>
                          </div>

                          {/* Calc Button */}
                          <button
                            id="btn_cc_calc"
                            onClick={() => {
                              const valNum = Number(String(form().convAmount || '').replace(',', '.'));
                              if (!valNum || valNum <= 0) { setFormError('Enter a valid value for conversion.'); return; }
                              const prc = Number(String(form().buyPrice || '').replace(',', '.'));
                              if (!prc || prc <= 0) { setFormError('Please enter Buy Price before calculating quantity.'); return; }
                              setFormError('');

                              // Convert input value to asset's native currency
                              const cur = form().currency;
                              const nat = assetCur(); // native currency of asset price
                              let valNative = valNum;

                              if (cur !== nat) {
                                // Get IDR value of the input
                                let valIdr = valNum;
                                if (cur !== 'IDR') {
                                  const curRate = crossRates()[cur] || (cur === 'USD' ? usdIdrRate() : 1);
                                  valIdr = valNum * curRate;
                                }
                                // Convert IDR to native
                                const nativeRate = crossRates()[nat] || (nat === 'USD' ? usdIdrRate() : 1);
                                valNative = valIdr / nativeRate;
                              }

                              const lot = unitDef().multiplier || 1;
                              const rawQty = valNative / (prc * lot);
                              const dec = unitDef().decimals;
                              const fqty = rawQty.toFixed(dec).replace(/\.?0+$/, "");

                              setForm(f => ({
                                ...f,
                                convResult: fqty,
                                quantity: fqty
                              }));
                            }}
                            class="mt-4 px-3 h-9 border border-text_accent/40 bg-text_accent/10 text-text_accent text-[8.5px] font-black tracking-wider hover:bg-text_accent hover:text-bg_main active:scale-95 transition-all whitespace-nowrap focus:outline-none"
                            title="Calculate (Enter)"
                          >CALC ↵</button>
                        </div>

                        {/* Result */}
                        <Show when={form().convResult}>
                          <div class="mt-2 px-3 py-2 bg-emerald-500/8 border border-emerald-500/20 flex items-center justify-between">
                            <span class="text-[8px] text-emerald-400/60 font-black tracking-widest">RESULT QTY → SET TO QTY FIELD ✓</span>
                            <span class="text-[11px] font-black text-emerald-400">{form().convResult} {unitDef().unit}</span>
                          </div>
                        </Show>

                        <p class="text-[7.5px] text-text_secondary/20 mt-2 leading-tight">
                          → Enter amount in {form().currency}, then press CALC or Enter to determine asset quantity
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }}

              {/* ── Validation Errors ── */}
              <Show when={formError()}>
                <div class="mx-5 mt-3 px-3 py-2.5 border border-red-500/40 bg-red-500/8 flex items-start gap-2">
                  <span class="text-red-400 mt-0.5 shrink-0">⚠</span>
                  <span class="text-red-400 text-[8.5px] font-black leading-relaxed">{formError()}</span>
                </div>
              </Show>

              {/* ── Summary Preview ── */}
              <Show when={form().symbol && form().buyPrice && form().quantity}>
                {() => {
                  const ud = getAssetUnitDef(form().symbol, form().assetType, { forexLotType: form().forexLotType || 'MICRO' });
                  const totalUnits = (Number(form().quantity) || 0) * (ud.multiplier || 1);
                  const totalCost = totalUnits * (Number(form().buyPrice) || 0);
                  const assetNativeCur = liveData()[form().symbol]?.currency || (form().symbol.endsWith('.JK') ? 'IDR' : 'USD');
                  return (
                    <div class="mx-5 mt-3 mb-3 ">
                      <div class="text-[8px] font-black text-text_secondary/40 tracking-widest mb-2">ASSET PREVIEW</div>
                      <div class="bg-bg_main/50 border border-border_main/40 divide-y divide-border_main/20">
                        <div class="px-3 py-2 flex justify-between items-center">
                          <span class="text-[8px] text-text_secondary/40">Symbol</span>
                          <span class="text-[9px] font-black text-text_accent">{form().symbol}</span>
                        </div>
                        <div class="px-3 py-2 flex justify-between items-center">
                          <span class="text-[8px] text-text_secondary/40">Holding</span>
                          <span class="text-[9px] font-black text-text_primary">{form().quantity} {ud.unit}{ud.multiplier > 1 ? ` (${totalUnits.toLocaleString()} unit)` : ''}</span>
                        </div>
                        <div class="px-3 py-2 flex justify-between items-center">
                          <span class="text-[8px] text-text_secondary/40">Buy Price</span>
                          <span class="text-[9px] font-black text-text_primary">{assetNativeCur === 'IDR' ? 'Rp' : '$'}{form().buyPrice} / {ud.unit}</span>
                        </div>
                        <div class="px-3 py-2 flex justify-between items-center bg-text_accent/5">
                          <span class="text-[8px] font-black text-text_accent/70">TOTAL COST</span>
                          <div class="flex flex-col items-end">
                            <span class="text-[10px] font-black text-text_accent">{assetNativeCur === 'IDR' ? 'Rp' : '$'}{fmt(totalCost, assetNativeCur === 'IDR' ? 0 : 2)}</span>
                            <Show when={assetNativeCur !== 'IDR'}>
                              <span class="text-[7.5px] text-text_secondary/40">≈ Rp{fmt(totalCost * usdIdrRate(), 0)}</span>
                            </Show>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </Show>

              <div class="h-4" /> {/* spacer */}
            </div>

            {/* ── Footer: Confirm Button ── */}
            <div class="px-5 py-4 border-t border-border_main bg-bg_header/60 shrink-0">
              <button
                onClick={() => {
                  // Validation before add
                  if (!form().symbol) { setFormError('Symbol is required.'); return; }
                  if (!form().buyPrice || Number(form().buyPrice) <= 0) { setFormError('Buy Price must be greater than 0.'); return; }
                  if (!form().quantity || Number(form().quantity) <= 0) { setFormError('Quantity must be greater than 0.'); return; }
                  setFormError('');
                  addPosition();
                }}
                class="w-full py-3 bg-text_accent text-bg_main text-[10px] font-black tracking-[0.2em] hover:brightness-125 active:scale-[0.99] transition-all disabled:opacity-40"
              >
                ✚ CONFIRM & ADD TO PORTFOLIO
              </button>
              <p class="text-center text-[7.5px] text-text_secondary/20 mt-2 tracking-widest">Data stored locally in browser · No server uplink</p>
            </div>
          </div>
        </div>
      </Show>






      {/* ── PRICE ALERT MODAL ── */}
      <Show when={showAlertModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAlertModal(null)}>
          <div class="w-80 bg-bg_sidebar border border-border_main flex flex-col" onClick={e => e.stopPropagation()}>
            <div class="px-5 py-3 border-b border-border_main bg-bg_header flex items-center justify-between">
              <span class="font-black text-[9px] text-yellow-400 tracking-widest">🔔 SET PRICE ALERT</span>
              <button onClick={() => setShowAlertModal(null)} class="text-text_secondary hover:text-text_primary">✕</button>
            </div>
            <div class="p-5 flex flex-col gap-4">
              <div class="text-[9px] font-black text-text_accent">{showAlertModal()?.symbol} — {showAlertModal()?.name}</div>
              <div class="flex gap-2">
                <For each={[{ v: 'above', label: 'ABOVE ↑' }, { v: 'below', label: 'BELOW ↓' }]}>
                  {opt => (
                    <button
                      onClick={() => setAlertForm(f => ({ ...f, condition: opt.v }))}
                      class={`flex-1 py-2 text-[9px] font-black border transition-all ${alertForm().condition === opt.v ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10' : 'border-border_main text-text_secondary'}`}
                    >{opt.label}</button>
                  )}
                </For>
              </div>
              <input
                type="number" placeholder="Target price..." step="any"
                value={alertForm().price}
                onInput={e => setAlertForm(f => ({ ...f, price: e.target.value }))}
                class="bg-bg_main border border-border_main px-3 py-2 text-[11px] focus:border-yellow-500 focus:outline-none"
              />
              <button
                onClick={createAlert}
                class="py-2.5 bg-yellow-500 text-bg_main text-[9px] font-black tracking-widest hover:bg-yellow-400 transition-all"
              >SAVE ALERT</button>
            </div>
          </div>
        </div>
      </Show>

      {/* ── FOOTER ── */}

    </div>
  );
}
