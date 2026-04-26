import { createSignal, onMount, createEffect, For, Show, onCleanup as solidOnCleanup } from 'solid-js';
import * as echarts from 'echarts';
import TechnicalAnalysisPanel from '../components/TechnicalAnalysisPanel';
import EntityAdvancedView from '../components/EntityAdvancedView';
import LiveMarketTerminal from '../components/LiveMarketTerminal';
import CryptoOnChainPanel from '../components/crypto/CryptoOnChainPanel';
import CryptoDerivativesPanel from '../components/crypto/CryptoDerivativesPanel';
import CryptoQuantPanel from '../components/crypto/CryptoQuantPanel';
import CryptoMacroPanel from '../components/crypto/CryptoMacroPanel';
import CryptoAssetExplorer from '../components/crypto/CryptoAssetExplorer';

// --- CONFIG & CONSTANTS ---
const CRYPTO_API = import.meta.env.VITE_CRYPTO_API;
const TA_API = import.meta.env.VITE_TA_URL;

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? 'N/A' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (v == null || isNaN(v)) ? 'N/A' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const signColor = (v) => v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-text_secondary';

// --- COMPONENTS ---

function StatBox({ label, value, sub, color }) {
  return (
    <div class="bg-black/40 border border-border_main p-3 flex flex-col gap-1 hover:border-text_accent/40 transition-all group">
      <span class="text-[8px] font-black text-text_secondary uppercase tracking-[0.2em] group-hover:text-text_accent/60 transition-colors">{label}</span>
      <span class={`text-[14px] font-black font-mono ${color || 'text-text_primary'}`}>{value}</span>
      {sub && <span class="text-[9px] text-text_secondary/50 font-mono italic">{sub}</span>}
    </div>
  );
}

function TradingViewHeatmap(props) {
  let containerRef;
  onMount(() => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "dataSource": "Crypto",
      "blockSize": "market_cap_calc",
      "blockColor": "24h_close_change|5",
      "locale": "en",
      "symbolUrl": "",
      "colorTheme": props.theme === 'light' ? 'light' : 'dark',
      "hasTopBar": false,
      "isDataSetEnabled": false,
      "isZoomEnabled": true,
      "hasSymbolTooltip": true,
      "isMonoSize": false,
      "width": "100%",
      "height": "100%"
    });
    if (containerRef) containerRef.appendChild(script);
  });

  return (
    <div class="tradingview-widget-container h-full w-full bg-black/20" ref={containerRef}>
      <div class="tradingview-widget-container__widget h-full w-full"></div>
    </div>
  );
}

function SectionHeader({ title, icon, action }) {
  return (
    <div class="px-4 py-2 border-b border-border_main bg-bg_header/40 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-1.5 h-1.5 bg-text_accent animate-pulse shadow-[0_0_8px_var(--text-accent)]" />
        <span class="text-[9px] font-black tracking-[0.3em] text-text_primary uppercase font-mono">{title}</span>
      </div>
      {action}
    </div>
  );
}

// Monte Carlo Chart Component
function MonteCarloChart({ data, horizon }) {
  let chartRef;
  let chart;

  const updateChart = () => {
    if (!chartRef || !data || !data[horizon]) return;
    if (!chart) chart = echarts.init(chartRef);

    const currentData = data[horizon];
    const paths = currentData.paths || [];
    const timeHorizon = currentData.horizon;
    const xAxis = Array.from({ length: paths[0]?.length || 0 }, (_, i) => `T+${i}`);

    const series = paths.map((path, idx) => ({
      name: `SCENARIO ${idx + 1}`,
      type: 'line',
      data: path,
      smooth: true,
      symbol: 'none',
      lineStyle: {
        width: idx === 0 ? 2 : 1,
        color: idx === 0 ? '#00ff41' : 'rgba(0, 255, 65, 0.1)',
        opacity: idx === 0 ? 1 : 0.3
      },
      z: idx === 0 ? 10 : 1
    }));

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 20, right: 30, bottom: 30, left: 60 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0a0a0a',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 10, fontFamily: 'monospace' }
      },
      xAxis: {
        type: 'category',
        data: xAxis,
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#555', fontSize: 9 }
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
        axisLabel: { color: '#555', fontSize: 9 }
      },
      series: series
    });
  };

  onMount(() => {
    updateChart();
    const handleResize = () => chart?.resize();
    window.addEventListener('resize', handleResize);
    solidOnCleanup(() => {
      window.removeEventListener('resize', handleResize);
      chart?.dispose();
    });
  });

  createEffect(() => {
    data; horizon;
    updateChart();
  });

  return <div ref={chartRef} class="w-full h-full" />;
}

// ECharts Candlestick Component
function CandlestickChart({ data, theme }) {
  let chartRef;
  let chart;

  const updateChart = () => {
    if (!chartRef || !data || data.length === 0) return;
    if (!chart) chart = echarts.init(chartRef, theme === 'light' ? null : 'dark');

    const dates = data.map(d => d.date || d.Date);
    const values = data.map(d => [
      d.open || d.Open,
      d.close || d.Close,
      d.low || d.Low,
      d.high || d.High
    ]);

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: '#0a0a0a',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 10 }
      },
      grid: { left: '10%', right: '10%', bottom: '20%', top: '5%' },
      xAxis: {
        type: 'category',
        data: dates,
        scale: true,
        boundaryGap: false,
        axisLine: { onZero: false, lineStyle: { color: '#333' } },
        splitLine: { show: false },
        axisLabel: { color: '#666', fontSize: 9 }
      },
      yAxis: {
        scale: true,
        splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(0,0,0,0)'] } },
        axisLabel: { color: '#666', fontSize: 9 },
        splitLine: { lineStyle: { color: '#222' } }
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        {
          show: true,
          type: 'slider',
          top: '90%',
          start: 0,
          end: 100,
          backgroundColor: 'rgba(0,0,0,0)',
          borderColor: '#1a1a1a',
          handleIcon: 'path://M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
          handleSize: '80%',
          textStyle: { color: '#666', fontSize: 9 }
        }
      ],
      series: [
        {
          type: 'candlestick',
          data: values,
          itemStyle: {
            color: '#00e676',
            color0: '#ff1744',
            borderColor: '#00e676',
            borderColor0: '#ff1744'
          }
        }
      ]
    });
  };

  onMount(() => {
    updateChart();
    const handleResize = () => chart?.resize();
    window.addEventListener('resize', handleResize);
    solidOnCleanup(() => {
      window.removeEventListener('resize', handleResize);
      chart?.dispose();
    });
  });

  createEffect(() => {
    data; theme;
    updateChart();
  });

  return <div ref={chartRef} class="w-full h-full" />;
}

export default function CryptoIntelligenceView(props) {
  const [coins, setCoins] = createSignal([]);
  const [selectedSymbol, setSelectedSymbol] = createSignal('BTC');
  const [detail, setDetail] = createSignal(null);
  const [aiVerdict, setAiVerdict] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [aiLoading, setAiLoading] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal('overview');
  const [liveWatchlist, setLiveWatchlist] = createSignal(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']);
  const [horizon, setHorizon] = createSignal('30d');
  const [searchTerm, setSearchTerm] = createSignal('');
  const [selectedRange, setSelectedRange] = createSignal('1M');

  const RANGES = ['1W', '1M', '3M', '6M', '1Y', '5Y', 'ALL'];

  const getFilteredHistory = () => {
    return detail()?.history || [];
  };

  // --- STATS LOGIC ---
  const [stats, setStats] = createSignal({ seasonality: null });
  let seasChartDom;
  let seasChart;

  const fetchStats = async () => {
    try {
      const sRes = await fetch(`${CRYPTO_API}/api/crypto/stats/seasonality/${selectedSymbol()}`).then(r => r.json());
      if (sRes.status === 'success') {
        setStats({ seasonality: sRes.data });
        renderSeasonality();
      }
    } catch (e) { console.error("Stats fetch error:", e); }
  };

  const renderSeasonality = () => {
    if (!stats().seasonality || !seasChartDom) return;

    if (seasChart) seasChart.dispose();
    const currentTheme = props.theme?.() === 'light' ? null : 'dark';
    seasChart = echarts.init(seasChartDom, currentTheme);
    seasChart.setOption({
      backgroundColor: 'transparent',
      tooltip: { position: 'top', formatter: (params) => `${stats().seasonality.years[params.value[1]]} ${stats().seasonality.months[params.value[0]]}: <b>${params.value[2].toFixed(2)}%</b>` },
      grid: { height: '80%', top: '10%', left: '10%', right: '5%' },
      xAxis: { type: 'category', data: stats().seasonality.months, splitArea: { show: true }, axisLabel: { color: '#666', fontSize: 9 } },
      yAxis: { type: 'category', data: stats().seasonality.years.map(String), splitArea: { show: true }, axisLabel: { color: '#666', fontSize: 9 } },
      visualMap: {
        min: -20, max: 20, calculate: true, orient: 'horizontal', left: 'center', bottom: '0%',
        inRange: { color: ['#ff1744', '#121212', '#00e676'] },
        show: false
      },
      series: [{
        name: 'MONTHLY RETURN', type: 'heatmap', data: stats().seasonality.matrix,
        label: { 
          show: true, 
          fontSize: 8, 
          fontWeight: 'black',
          color: '#fff',
          formatter: (p) => p.value[2].toFixed(1) + '%'
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
      }]
    });
  };

  createEffect(() => {
    const s = selectedSymbol();
    if (activeTab() === 'technical' && s) {
      setTimeout(fetchStats, 100);
    }
  });

  // NOTE: resize listener for seasChart is handled inside createEffect lifecycle below

  // 1. Fetch Top Coins List
  const fetchCoins = async () => {
    try {
      const resp = await fetch(`${CRYPTO_API}/api/crypto/top?top=50`);
      const json = await resp.json();
      if (json.status === 'success') setCoins(json.data);
    } catch (e) { console.error("Coins fetch error:", e); }
  };

  // 2. Fetch Detail for selected coin
  const fetchDetail = async (symbol, range = '1M') => {
    setLoading(true);
    try {
      const rangeMap = {
        '1W': '5d',
        '1M': '1mo',
        '3M': '3mo',
        '6M': '6mo',
        '1Y': '1y',
        '5Y': '5y',
        'ALL': 'max'
      };
      const period = rangeMap[range] || '1mo';
      const resp = await fetch(`${CRYPTO_API}/api/crypto/detail/${symbol}?period=${period}`);
      const json = await resp.json();
      if (json.status === 'success') setDetail(json.data);
    } catch (e) { console.error("Detail fetch error:", e); }
    setLoading(false);
  };

  // 3. Fetch AI Analysis (10-Agent System)
  const fetchAIAnalysis = async (symbol) => {
    setAiLoading(true);
    try {
      const resp = await fetch(`${CRYPTO_API}/api/ai/analyze?symbol=${symbol}`);
      const json = await resp.json();
      if (json.status === 'success') setAiVerdict(json.data);
    } catch (e) { console.error("AI Analysis error:", e); }
    setAiLoading(false);
  };

  // 4. Handle Search (Backend search on Enter)
  const handleSearch = async (e) => {
    if (e.key !== 'Enter') return;

    const query = searchTerm().trim();
    if (!query) {
      fetchCoins();
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${CRYPTO_API}/api/crypto/search?q=${query}`);
      const json = await resp.json();
      if (json.status === 'success') setCoins(json.data);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setLoading(false);
    }
  };

  let _mounted = false;
  onMount(() => {
    _mounted = true;
    fetchCoins();
    fetchDetail(selectedSymbol(), selectedRange());
    fetchAIAnalysis(selectedSymbol());

    // Resize listener for seasonality chart
    const handleResize = () => { if (seasChart) seasChart.resize(); };
    window.addEventListener('resize', handleResize);

    // INTEGRATE LIVE STREAMING FOR SIDEBAR & HEADER
    const wsUrl = import.meta.env.VITE_CRYPTO_STREAM_WS || 'wss://api.asetpedia.online/ws/crypto';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'kline' || msg.type === 'trade') {
        const symbol = msg.symbol; // e.g. BTCUSDT or BTC-USD
        const baseSymbol = symbol.replace('USDT', '').replace('-USD', '');
        const newPrice = msg.type === 'kline' ? msg.data.close : msg.data.p;

        // 1. Update Sidebar List
        setCoins(prev => prev.map(c => {
          if (c.symbol === baseSymbol || c.symbol === symbol) {
            const sentiment = msg.type === 'kline' 
              ? (msg.data.close >= msg.data.open ? 'BULLISH' : 'BEARISH')
              : c.sentiment; // Keep existing for trade updates
            return { ...c, price: newPrice, sentiment };
          }
          return c;
        }));

        // 2. Update Header Detail (if active)
        if (selectedSymbol() === baseSymbol || selectedSymbol() === symbol) {
           setDetail(prev => {
             if (!prev) return prev;
             return { ...prev, price: newPrice };
           });
        }
      }
    };

    solidOnCleanup(() => {
      _mounted = false;
      window.removeEventListener('resize', handleResize);
      ws.close();
    });
  });

  createEffect(() => {
    const s = selectedSymbol();
    const r = selectedRange();
    if (_mounted) {
      fetchDetail(s, r);
      fetchAIAnalysis(s);
    }
  });

  const displayCoins = () => coins();

  const TABS = [
    { id: 'overview', label: '01 OVERVIEW' },
    { id: 'technical', label: '02 TECHNICAL' },
    { id: 'risk', label: '03 RISK' },
    { id: 'onchain', label: '04 ON-CHAIN' },
    { id: 'derivatives', label: '05 DERIVATIVES' },
    { id: 'quant', label: '06 QUANT' },
    { id: 'macro', label: '07 MACRO' },
    { id: 'news', label: '08 NEWS' },
    { id: 'advanced', label: '09 ADVANCED' },
    { id: 'live', label: '10 LIVE' },
    { id: 'explorer', label: '11 EXPLORER' }
  ];

  return (
    <div class="flex-1 flex overflow-hidden bg-bg_main font-mono text-text_primary transition-colors">

      {/* LEFT SIDEBAR: ASSET NAVIGATOR */}
      <aside class="w-64 border-r border-border_main bg-black/20 flex flex-col shrink-0">
        <div class="p-4 border-b border-border_main bg-bg_header/30">
          <input
            type="text"
            placeholder="SEARCH ASSETS..."
            onInput={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearch}
            class="w-full bg-black/40 border border-border_main px-3 py-2 text-[10px] text-text_accent focus:outline-none focus:border-text_accent/50 transition-all font-mono uppercase tracking-widest"
          />
        </div>
        <div class="flex-1 overflow-y-auto win-scroll">
          <For each={displayCoins()}>
            {(coin) => (
              <button
                onClick={() => {
                  setSelectedSymbol(coin.symbol);
                  if (activeTab() === 'explorer' || activeTab() === 'live') {
                    setActiveTab('overview');
                  }
                }}
                class={`w-full flex items-center justify-between px-4 py-3 border-b border-border_main/10 hover:bg-text_accent/5 transition-all group ${selectedSymbol() === coin.symbol ? 'border-l-4 border-l-text_accent bg-text_accent/10' : 'border-l-4 border-l-transparent opacity-70 hover:opacity-100'}`}
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 flex items-center justify-center bg-black/40 border border-border_main text-[10px] font-black group-hover:border-text_accent/40 transition-colors">
                    {coin.symbol.slice(0, 3)}
                  </div>
                  <div class="flex flex-col items-start">
                    <span class="text-[10px] font-black tracking-tight">{coin.name}</span>
                    <span class="text-[8px] text-text_secondary font-bold group-hover:text-text_accent/60 transition-colors">{coin.symbol}</span>
                  </div>
                </div>
                  <div class="flex flex-col items-end shrink-0">
                    <div class="flex items-center gap-1.5">
                      <span class={`text-[7px] font-black px-1 rounded-[1px] ${coins().find(x=>x.symbol === coin.symbol)?.sentiment === 'BEARISH' ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                        {coins().find(x=>x.symbol === coin.symbol)?.sentiment || 'BULL'}
                      </span>
                      <span class="text-[10px] font-bold font-mono">
                        ${fmt(coin.price || coin.quote?.USD?.price, (coin.price || coin.quote?.USD?.price) < 1 ? 4 : 2)}
                      </span>
                    </div>
                    <span class={`text-[8px] font-black ${signColor(coin.change_24h || coin.quote?.USD?.percent_change_24h)}`}>
                      {fmtPct(coin.change_24h || coin.quote?.USD?.percent_change_24h)}
                    </span>
                  </div>
              </button>
            )}
          </For>
        </div>
        <div class="px-4 py-2.5 bg-bg_header/20 border-t border-border_main flex items-center justify-between">
          <div class="flex items-center gap-3">
             <div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
             <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">LIVE FEED: BINANCE CLOUD</span>
          </div>
          <span class="text-[8px] font-mono text-text_secondary/40">LATENCY: <span class="text-text_accent">SYNC</span></span>
        </div>
      </aside>

      {/* MAIN INTELLIGENCE AREA */}
      <div class="flex-1 flex flex-col min-w-0">


        {/* TAB NAVIGATION */}
        <div class="h-11 border-b border-border_main flex items-center gap-0 px-2 bg-black/20 shrink-0 overflow-x-auto win-scroll">
          <For each={TABS}>
            {(tab) => (
              <button
                onClick={() => setActiveTab(tab.id)}
                class={`px-3 h-full text-[8px] font-black tracking-[0.15em] transition-all border-b-2 flex items-center shrink-0 whitespace-nowrap ${activeTab() === tab.id ? 'text-text_accent border-text_accent bg-text_accent/5' : 'text-text_secondary border-transparent opacity-40 hover:opacity-100 hover:bg-white/5'}`}
              >
                {tab.label}
              </button>
            )}
          </For>
        </div>

          {/* CONTENT SWITCHER */}
          <div class="flex-1 overflow-y-auto win-scroll p-6 bg-black/5">

            <Show when={activeTab() === 'live'}>
              <LiveMarketTerminal watchlist={liveWatchlist()} setWatchlist={setLiveWatchlist} />
            </Show>

            <Show when={activeTab() === 'explorer'}>
              <CryptoAssetExplorer 
                onSelect={(sym) => {
                  setSelectedSymbol(sym);
                  setActiveTab('overview');
                }}
                onAddToLive={(sym) => {
                  const pair = sym.includes('USDT') ? sym : `${sym}USDT`;
                  setLiveWatchlist(prev => {
                    if (prev.includes(pair)) return prev;
                    if (prev.length >= 10) return [pair, ...prev.slice(0, 9)];
                    return [pair, ...prev];
                  });
                  setActiveTab('live');
                }}
              />
            </Show>

            <Show when={activeTab() === 'overview'}>
            <div class="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">

              {/* HISTORICAL CANDLESTICK AREA (MOVED TO TOP) */}
              <div class="grid grid-cols-12 gap-6">
                {/* Candlestick Chart */}
                <div class="col-span-12 lg:col-span-8 flex flex-col border-2 border_main bg-black/40 h-[500px] shrink-0">
                  <SectionHeader
                    title={`PRICE HISTORY (${selectedSymbol()}) // ${selectedRange()}`}
                    action={
                      <div class="flex items-center gap-4 mr-2">
                        <div class="flex gap-1">
                          {RANGES.map(r => (
                            <button
                              onClick={() => setSelectedRange(r)}
                              class={`px-2 py-0.5 text-[8px] font-black border transition-all ${selectedRange() === r ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main/30 text-text_secondary opacity-60 hover:opacity-100 hover:border-text_accent/30'}`}
                            >{r}</button>
                          ))}
                        </div>
                        <button
                          onClick={() => { fetchCoins(); fetchDetail(selectedSymbol(), selectedRange()); }}
                          class="flex items-center gap-2 px-3 py-0.5 bg-text_accent/10 border border-text_accent/30 text-[8px] font-black text-text_accent hover:bg-text_accent hover:text-bg_main transition-all uppercase"
                        >
                          <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                          RELOAD DATA
                        </button>
                      </div>
                    }
                  />
                  <div class="flex-1 p-4 relative min-h-0">
                    <Show when={!loading() && getFilteredHistory().length > 0} fallback={
                      <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg_header/5">
                        <div class={`w-8 h-8 border-2 border-text_accent border-t-transparent animate-spin rounded-full ${loading() ? 'opacity-100' : 'opacity-0'}`}></div>
                        <span class="text-[10px] font-black text-text_accent tracking-[0.4em] uppercase">
                          {loading() ? 'FETCHING DATA...' : 'NO DATA AVAILABLE'}
                        </span>
                      </div>
                    }>
                      <CandlestickChart data={getFilteredHistory()} theme={props.theme?.()} />
                    </Show>
                  </div>
                </div>

                {/* Crypto Strategic Dossier */}
                <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border_main bg-bg_header/20 overflow-hidden">
                  <SectionHeader title="MARKET OVERVIEW" />
                  <div class="flex-1 p-5 flex flex-col gap-4 overflow-y-auto win-scroll">
                    {/* Header Info */}
                    <div class="flex items-center gap-4 pb-4 border-b border-white/5">
                      <Show when={detail()?.metadata?.logo}>
                        <img src={detail().metadata.logo} alt="logo" class="w-10 h-10 rounded-full border border-border_main p-1" />
                      </Show>
                      <div class="flex flex-col">
                        <span class="text-[16px] font-black text-white">{detail()?.name || 'ASSET'}</span>
                        <span class="text-[9px] font-bold text-text_accent tracking-widest">{detail()?.symbol}/USD</span>
                      </div>
                      <div class="ml-auto flex flex-col items-end">
                        <span class={`text-[12px] font-black ${detail()?.percent_change_24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtPct(detail()?.percent_change_24h)}
                        </span>
                        <span class="text-[8px] font-black text-text_secondary uppercase">24H CHANGE</span>
                      </div>
                    </div>

                    {/* Market Cap & Volume */}
                    <div class="grid grid-cols-2 gap-4">
                      <div class="flex flex-col gap-1">
                        <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">MARKET CAP</span>
                        <span class="text-[12px] font-black text-white font-mono">${(Number(detail()?.market_cap || 0) / 1e9).toFixed(2)}B</span>
                      </div>
                      <div class="flex flex-col gap-1">
                        <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">VOLUME 24H</span>
                        <span class="text-[12px] font-black text-white font-mono">${(Number(detail()?.volume_24h || 0) / 1e9).toFixed(2)}B</span>
                      </div>
                    </div>

                    {/* Technical Analysis Summary */}
                    <div class="space-y-4 pt-4 border-t border-border_main/10">
                      <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">TECHNICAL OVERVIEW</span>
                      <div class="grid grid-cols-2 gap-3">
                        <div class="bg-black/20 p-2 border border-border_main/20 flex flex-col gap-1">
                          <span class="text-[7px] font-black text-text_secondary">1H SUMMARY</span>
                          <span class={`text-[9px] font-black uppercase ${(detail()?.ta_report?.['1h']?.summary || '').includes('BUY') ? 'text-emerald-400' : 'text-red-400'}`}>
                            {detail()?.ta_report?.['1h']?.summary || 'N/A'}
                          </span>
                        </div>
                        <div class="bg-black/20 p-2 border border-border_main/20 flex flex-col gap-1">
                          <span class="text-[7px] font-black text-text_secondary">1D SUMMARY</span>
                          <span class={`text-[9px] font-black uppercase ${(detail()?.ta_report?.['1d']?.summary || '').includes('BUY') ? 'text-emerald-400' : 'text-red-400'}`}>
                            {detail()?.ta_report?.['1d']?.summary || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Monte Carlo Risk Metrics */}
                    <div class="space-y-3 pt-4 border-t border-border_main/10">
                      <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">RISK ANALYSIS (MC 30D)</span>
                      <div class="flex items-center justify-between py-1.5 border-b border-white/5">
                        <span class="text-[9px] font-black text-text_secondary uppercase">VaR 95%</span>
                        <span class="text-[10px] font-mono font-bold text-red-500">{detail()?.monte_carlo?.['30d']?.var_95 || '0.00'}%</span>
                      </div>
                      <div class="flex items-center justify-between py-1.5 border-b border-white/5">
                        <span class="text-[9px] font-black text-text_secondary uppercase">CVaR 95%</span>
                        <span class="text-[10px] font-mono font-bold text-red-600">{detail()?.monte_carlo?.['30d']?.cvar_95 || '0.00'}%</span>
                      </div>
                      <div class="flex items-center justify-between py-1.5">
                        <span class="text-[9px] font-black text-emerald-400 uppercase">BEST CASE</span>
                        <span class="text-[10px] font-mono font-bold text-emerald-400">+{detail()?.monte_carlo?.['30d']?.best_case || '0.00'}%</span>
                      </div>
                      <div class="flex items-center justify-between py-1.5">
                        <span class="text-[9px] font-black text-red-400 uppercase">WORST CASE</span>
                        <span class="text-[10px] font-mono font-bold text-red-400">{detail()?.monte_carlo?.['30d']?.worst_case || '0.00'}%</span>
                      </div>
                    </div>

                    <div class="mt-auto pt-6 border-t border-border_main/20">
                      <div class="flex items-center gap-2 mb-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-text_accent animate-pulse"></div>
                        <span class="text-[8px] font-black text-text_accent tracking-widest uppercase text-xs">SOURCE VERIFIED</span>
                      </div>
                      <p class="text-[8px] text-text_secondary italic leading-tight overflow-hidden line-clamp-2 opacity-40">
                        {detail()?.metadata?.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI MULTI-AGENT DOSSIER (HIGH DENSITY) */}
              <div class="grid grid-cols-12 gap-6">

                {/* COMPACT AI DOSSIER */}
                <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40 overflow-hidden">
                  <SectionHeader title="ANALYTICS SUMMARY" />
                  <div class="p-5 flex flex-col gap-4">
                    <Show when={!aiLoading()} fallback={<div class="py-8 flex flex-col items-center gap-3"><div class="w-6 h-6 border-2 border-text_accent border-t-transparent animate-spin rounded-full"></div><span class="text-[8px] font-black text-text_accent uppercase tracking-[0.2em]">ANALYZING...</span></div>}>
                      <div class="flex items-center gap-2 mb-2">
                        <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        <span class="text-[9px] font-black text-green-500 tracking-widest uppercase">SYSTEM: STABLE</span>
                      </div>
                      <p class="text-[12px] font-bold text-text_primary leading-tight italic border-l-2 border-text_accent pl-4 py-2 mb-4 bg-text_accent/5">
                        "{aiVerdict()?.summary}"
                      </p>
                      <div class="flex flex-col gap-4">
                        <div class="flex flex-col gap-2">
                          <div class="flex justify-between items-end">
                            <span class="text-[8px] font-black text-blue-400 uppercase tracking-widest">SENTIMENT ALPHA</span>
                            <span class="text-[10px] font-black text-white font-mono">{fmtPct((aiVerdict()?.agents?.sentiment?.score + 1) * 50)}</span>
                          </div>
                          <div class="h-1.5 bg-white/5 rounded-full overflow-hidden"><div class="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(aiVerdict()?.agents?.sentiment?.score + 1) * 50}%` }}></div></div>
                        </div>
                        <div class="flex flex-col gap-2">
                          <div class="flex justify-between items-end">
                            <span class="text-[8px] font-black text-red-500 uppercase tracking-widest">VOLATILITY RISK</span>
                            <span class="text-[10px] font-black text-white font-mono">{aiVerdict()?.agents?.risk?.volatility_annual}%</span>
                          </div>
                          <div class="h-1.5 bg-white/5 rounded-full overflow-hidden"><div class="h-full bg-red-500 transition-all duration-1000" style={{ width: `${Math.min(100, aiVerdict()?.agents?.risk?.volatility_annual)}%` }}></div></div>
                        </div>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* AGENT FEEDS (Scrollable) */}
                <div class="col-span-12 lg:col-span-8 flex flex-col border-2 border-border_main bg-black/40 overflow-hidden">
                  <SectionHeader title="AI MULTI-AGENT ANALYSIS FEED" />
                  <div class="flex-1 overflow-y-auto max-h-[300px] win-scroll">
                    <div class="grid grid-cols-2 divide-x divide-y divide-border_main/10">
                      <For each={Object.entries(aiVerdict()?.agents || {})}>
                        {([name, val]) => (
                          <div class="px-5 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-all group">
                            <span class="text-[9px] font-black text-text_secondary group-hover:text-text_primary uppercase tracking-tighter">{name}</span>
                            <span class={`text-[10px] font-black tabular-nums ${val.signal === 'BULLISH' ? 'text-green-400' : val.signal === 'BEARISH' ? 'text-red-400' : 'text-text_accent'}`}>
                              {val.signal || val.status || val.pressure || val.action || val.verdict || val.next_move || 'NEUTRAL'}
                            </span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              </div>


              {/* NEWS & IMPACT (HIGH DENSITY) */}
              <div class="grid grid-cols-12 gap-6 h-[400px]">
                <div class="col-span-12 lg:col-span-8 flex flex-col border-2 border-border_main bg-black/40 overflow-hidden">
                  <SectionHeader title="MARKET NEWS INTELLIGENCE" />
                  <div class="flex-1 overflow-y-auto p-2 space-y-1 win-scroll">
                    <For each={detail()?.news?.slice(0, 12)}>
                      {(n) => (
                        <a href={n.url} target="_blank" class="flex items-center gap-6 px-5 py-3 hover:bg-white/[0.04] transition-all group border-b border-white/[0.02] last:border-0">
                          <div class="flex flex-col shrink-0 w-28">
                            <span class="text-[9px] font-black text-text_accent uppercase tracking-tighter opacity-70 group-hover:opacity-100">{n.source}</span>
                            <span class="text-[8px] font-bold text-text_secondary opacity-30 tabular-nums">{n.date}</span>
                          </div>
                          <h4 class="text-[11px] font-black text-text_primary group-hover:text-text_accent transition-colors truncate uppercase tracking-tight flex-1">{n.title}</h4>
                          <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg class="w-3.5 h-3.5 text-text_accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3" /></svg>
                          </div>
                        </a>
                      )}
                    </For>
                  </div>
                </div>
                <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40 overflow-hidden">
                  <SectionHeader title="GLOBAL IMPACT & METADATA" />
                  <div class="flex-1 overflow-y-auto p-5 space-y-4 win-scroll bg-black/20">
                    <div class="flex flex-wrap gap-2">
                      <For each={detail()?.metadata?.tags?.slice(0, 8)}>
                        {(tag) => (
                          <div class="px-2 py-1 bg-text_accent/5 border border-text_accent/20 text-[8px] font-black text-text_accent tracking-widest uppercase hover:bg-text_accent hover:text-bg_main transition-all cursor-default">
                            # {tag}
                          </div>
                        )}
                      </For>
                    </div>
                    <div class="p-4 border border-border_main/10 bg-black/40 relative">
                      <div class="absolute top-0 left-0 w-1 h-full bg-text_accent/30" />
                      <h5 class="text-[9px] font-black text-text_accent/50 uppercase mb-3 tracking-widest">DOSSIER_DESC</h5>
                      <p class="text-[10px] text-text_secondary leading-relaxed text-justify opacity-80 line-clamp-[10]">
                        {detail()?.metadata?.description || 'No additional data available for this asset.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'technical'}>
            <div class="h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-y-auto win-scroll pr-2 pb-10">
              
              {/* TOP ROW: HEATMAPS (SIDE-BY-SIDE) */}
              <div class="grid grid-cols-12 gap-6 h-[450px] shrink-0">
                {/* SEASONALITY */}
                <div class="col-span-12 lg:col-span-5 flex flex-col border-2 border-border_main bg-black/40 overflow-hidden">
                  <SectionHeader title={`SEASONALITY HEATMAP (${selectedSymbol()})`} />
                  <div ref={seasChartDom} class="flex-1 min-h-0"></div>
                </div>

                {/* GLOBAL MARKET HEATMAP */}
                <div class="col-span-12 lg:col-span-7 flex flex-col border-2 border-border_main bg-black/40 group overflow-hidden">
                  <SectionHeader title="GLOBAL MARKET HEATMAP (TV)" />
                  <div class="flex-1 relative overflow-hidden min-h-0">
                    <TradingViewHeatmap theme={props.theme?.()} />
                  </div>
                </div>
              </div>

              {/* BOTTOM ROW: FULL WIDTH TECHNICAL ANALYSIS */}
              <div class="h-[800px] shrink-0 border border-border_main">
                <TechnicalAnalysisPanel symbol={selectedSymbol() + '-USD'} showToolbar={false} />
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'risk'}>
            <div class="flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-500">
              <div class="grid grid-cols-12 gap-6 h-[500px]">
                {/* MONTE CARLO GRAPH */}
                <div class="col-span-1 lg:col-span-8 flex flex-col border-2 border-border_main bg-black/40 overflow-hidden">
                  <SectionHeader title="PRICE SIMULATION (MONTE CARLO)" action={
                    <div class="flex gap-1">
                      {['7d', '30d', '90d'].map((h) => (
                        <button
                          onClick={() => setHorizon(h)}
                          class={`px-3 py-0.5 text-[8px] font-black border transition-all ${horizon() === h ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main text-text_secondary opacity-40 hover:opacity-100'}`}
                        >{h.toUpperCase()}</button>
                      ))}
                    </div>
                  } />
                  <div class="flex-1 p-4 relative">
                    <Show when={detail()?.monte_carlo} fallback={<div class="h-full flex flex-col items-center justify-center gap-4"><div class="w-8 h-8 border-2 border-text_accent border-t-transparent animate-spin rounded-full"></div><span class="text-[9px] font-black text-text_accent tracking-[0.4em]">RUNNING SIMULATION...</span></div>}>
                      <MonteCarloChart data={detail().monte_carlo} horizon={horizon()} />
                    </Show>
                  </div>
                </div>

                {/* PROBABILITY MATRIX */}
                <div class="col-span-1 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40 overflow-hidden">
                  <SectionHeader title="ANALYSIS MATRIX" />
                  <div class="flex-1 p-0">
                    <Show when={detail()?.monte_carlo?.[horizon()]}>
                      {(mc) => (
                        <div class="flex flex-col divide-y divide-border_main/30 h-full">
                          <div class="p-6 flex flex-col gap-1 bg-text_accent/5 border-b border-text_accent/20">
                            <span class="text-[10px] font-black text-text_secondary uppercase tracking-widest opacity-50">EXPECTED FINAL PRICE</span>
                            <span class="text-[28px] font-black text-white font-mono leading-none">${fmt(mc.expected_final, 2)}</span>
                          </div>
                          <div class="grid grid-cols-2 flex-1">
                            <div class="p-5 flex flex-col gap-2 border-r border-border_main/20">
                              <span class="text-[9px] font-black text-red-500/60 uppercase tracking-widest">VaR (95%)</span>
                              <span class="text-[18px] font-black text-red-500">{mc.var_95}%</span>
                              <span class="text-[8px] text-text_secondary opacity-40 uppercase leading-tight font-bold italic">Value at Risk</span>
                            </div>
                            <div class="p-5 flex flex-col gap-2">
                              <span class="text-[9px] font-black text-red-400/60 uppercase tracking-widest">CVaR (95%)</span>
                              <span class="text-[18px] font-black text-red-400">{mc.cvar_95}%</span>
                              <span class="text-[8px] text-text_secondary opacity-40 uppercase leading-tight font-bold italic">Conditional VaR</span>
                            </div>
                            <div class="p-5 flex flex-col gap-2 border-t border-r border-border_main/20 bg-green-500/5">
                              <span class="text-[9px] font-black text-green-500/60 uppercase tracking-widest">MAX UPSIDE</span>
                              <span class="text-[18px] font-black text-green-500">+{mc.best_case}%</span>
                            </div>
                            <div class="p-5 flex flex-col gap-2 border-t border-border_main/20 bg-red-500/5">
                              <span class="text-[9px] font-black text-red-600/60 uppercase tracking-widest">MAX DOWNSIDE</span>
                              <span class="text-[18px] font-black text-red-600">{mc.worst_case}%</span>
                            </div>
                          </div>
                          <div class="p-6 bg-black/60 flex flex-col gap-2">
                            <div class="flex items-center gap-2 mb-2">
                              <div class="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                              <span class="text-[10px] font-black text-white tracking-widest uppercase">SIMULATION MODEL: GBM DIFFUSION</span>
                            </div>
                            <p class="text-[9px] text-text_secondary leading-relaxed opacity-60 uppercase italic">
                              SCENARIOS GENERATED USING GEOMETRIC BROWNIAN MOTION MODEL WITH 5000 ITERATIONS BASED ON 365-DAY LOCALIZED ASSET VOLATILITY PARAMETERS.
                            </p>
                          </div>
                        </div>
                      )}
                    </Show>
                  </div>
                </div>
              </div>

              {/* HISTORICAL TABLE */}
              <div class="flex flex-col border-2 border-border_main bg-black/40 h-[500px]">
                <SectionHeader title="PRICE HISTORY DATA" />
                <div class="flex-1 overflow-y-auto win-scroll relative">
                  <table class="w-full text-left text-[10px] font-mono border-collapse">
                    <thead class="bg-bg_header/60 sticky top-0 z-10 border-b border-border_main">
                      <tr>
                        <th class="p-4 border-r border-border_main/30 text-text_accent font-black tracking-widest">TIMESTAMP</th>
                        <th class="p-4 border-r border-border_main/30 text-white font-black tracking-widest">OPEN ($)</th>
                        <th class="p-4 border-r border-border_main/30 text-white font-black tracking-widest">HIGH ($)</th>
                        <th class="p-4 border-r border-border_main/30 text-white font-black tracking-widest">LOW ($)</th>
                        <th class="p-4 border-r border-border_main/30 text-white font-black tracking-widest">CLOSE ($)</th>
                        <th class="p-4 text-right text-white font-black tracking-widest">VOLUME (M)</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border_main/10">
                      <For each={detail()?.history}>
                        {(row) => (
                          <tr class="hover:bg-white/5 transition-colors group">
                            <td class="p-4 border-r border-border_main/30 text-text_accent font-bold group-hover:text-white transition-colors">{row.date}</td>
                            <td class="p-4 border-r border-border_main/30 text-text_primary opacity-80">{fmt(row.open, row.open < 1 ? 4 : 2)}</td>
                            <td class="p-4 border-r border-border_main/30 text-green-400/80 font-bold">{fmt(row.high, row.high < 1 ? 4 : 2)}</td>
                            <td class="p-4 border-r border-border_main/30 text-red-400/80 font-bold">{fmt(row.low, row.low < 1 ? 4 : 2)}</td>
                            <td class={`p-4 border-r border-border_main/30 font-black ${row.close >= row.open ? 'text-green-400' : 'text-red-400'}`}>
                              {fmt(row.close, row.close < 1 ? 4 : 2)}
                            </td>
                            <td class="p-4 text-right text-text_primary opacity-80">{(row.volume / 1e6).toFixed(2)}M</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'onchain'}>
            <div class="h-full overflow-y-auto win-scroll pr-2">
              <CryptoOnChainPanel symbol={selectedSymbol()} />
            </div>
          </Show>

          <Show when={activeTab() === 'derivatives'}>
            <div class="h-full overflow-y-auto win-scroll pr-2">
              <CryptoDerivativesPanel symbol={selectedSymbol()} />
            </div>
          </Show>

          <Show when={activeTab() === 'quant'}>
            <div class="h-full overflow-y-auto win-scroll pr-2">
              <CryptoQuantPanel symbol={selectedSymbol()} />
            </div>
          </Show>

          <Show when={activeTab() === 'macro'}>
            <div class="h-full overflow-y-auto win-scroll pr-2">
              <CryptoMacroPanel symbol={selectedSymbol()} />
            </div>
          </Show>

          <Show when={activeTab() === 'news'}>
            <div class="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
              <div class="grid grid-cols-12 gap-6">
                {/* LIVE INTEL STREAM */}
                <div class="col-span-12 xl:col-span-8 flex flex-col border-2 border-border_main bg-black/40 max-h-[800px]">
                  <SectionHeader title="LIVE NEWS FEED // RSS FEED" />
                  <div class="flex-1 overflow-y-auto p-4 space-y-1 win-scroll">
                    <For each={detail()?.news}>
                      {(item) => (
                        <a href={item.url} target="_blank" class="flex items-center gap-6 px-6 py-3.5 hover:bg-white/[0.03] transition-all group border-b border-border_main/5 last:border-0 relative overflow-hidden">
                          <div class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-text_accent scale-y-0 group-hover:scale-y-100 transition-transform"></div>
                          <div class="flex flex-col shrink-0 w-32">
                            <div class="flex items-center gap-2">
                               <div class="w-1 h-1 rounded-full bg-blue-500"></div>
                               <span class="text-[9px] font-black text-blue-400 uppercase tracking-widest">{item.source}</span>
                            </div>
                            <span class="text-[8px] font-black text-text_secondary opacity-30 uppercase mt-0.5 tabular-nums">{item.date}</span>
                          </div>
                          <div class="flex-1 min-w-0">
                            <h3 class="text-[13px] font-black text-text_primary group-hover:text-text_accent transition-colors leading-tight tracking-tight uppercase truncate">{item.title}</h3>
                          </div>
                          <div class="shrink-0 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                             <span class="text-[8px] font-black text-text_accent tracking-[0.2em]">ACCESS_INTEL</span>
                             <svg class="w-3.5 h-3.5 text-text_accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3" /></svg>
                          </div>
                        </a>
                      )}
                    </For>
                  </div>
                </div>

                {/* MACRO CONTEXT SIDEBAR */}
                <div class="col-span-12 xl:col-span-4 flex flex-col gap-6">
                  <div class="flex flex-col border-2 border-border_main bg-black/40 overflow-hidden">
                    <SectionHeader title="MARKET CONTEXT" />
                    <div class="p-6 space-y-6 overflow-y-auto max-h-[700px]">
                      <div class="flex flex-col gap-3">
                        <span class="text-[9px] font-black text-text_secondary uppercase tracking-widest opacity-50 border-b border-border_main/20 pb-2">MARKET TAGS</span>
                        <div class="flex flex-wrap gap-2">
                          <For each={detail()?.metadata?.tags}>
                            {(tag) => <span class="px-2 py-1 bg-text_accent/10 border border-text_accent/20 text-[8px] font-black text-text_accent tracking-widest uppercase mb-1"># {tag}</span>}
                          </For>
                        </div>
                      </div>

                      <div class="flex flex-col gap-3">
                        <span class="text-[9px] font-black text-text_secondary uppercase tracking-widest opacity-50 border-b border-border_main/20 pb-2">RESOURCES</span>
                        <div class="flex flex-col gap-2">
                          <For each={Object.entries(detail()?.metadata?.urls || {})}>
                            {([key, url]) => (
                              <a href={Array.isArray(url) ? url[0] : url} target="_blank" class="px-4 py-2 bg-white/5 border border-border_main/20 text-[9px] font-black text-text_primary hover:bg-text_accent hover:text-bg_main transition-all flex items-center justify-between group">
                                <span class="uppercase tracking-widest">{key}</span>
                                <svg class="w-3 h-3 opacity-30 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3" /></svg>
                              </a>
                            )}
                          </For>
                        </div>
                      </div>

                      <div class="bg-bg_header/30 border border-border_main/30 p-5 flex flex-col gap-3 relative overflow-hidden">
                        <div class="absolute -bottom-4 -left-4 w-20 h-20 border-4 border-text_accent/5 rounded-full" />
                        <h5 class="text-[9px] font-black text-text_accent tracking-[0.3em] uppercase">NOTICE</h5>
                        <p class="text-[9px] text-text_secondary leading-relaxed uppercase italic">
                          Live feeds are aggregated from various macro-economic RSS streams. Accuracy of external data varies based on source availability.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'advanced'}>
            <div class="h-full flex flex-col animate-in zoom-in duration-500 overflow-hidden">
              <EntityAdvancedView
                symbol={selectedSymbol() + (selectedSymbol().includes('-') ? '' : '-USD')}
                fullHistory={(detail()?.history || []).map(h => ({
                  Date: h.date,
                  Open: h.open,
                  High: h.high,
                  Low: h.low,
                  Close: h.close,
                  Volume: h.volume
                }))}
              />
            </div>
          </Show>


        </div>

        {/* FOOTER STATUS BAR */}
        <div class="h-10 border-t border-border_main bg-bg_header/20 shrink-0 flex items-center justify-between px-6">
          <div class="flex items-center gap-6 text-[9px] font-black text-text_secondary tracking-widest">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-text_accent animate-pulse" />
              <span class="uppercase">LINK: STABLE</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="uppercase">LATENCY: 42ms</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="uppercase">SOURCE: CMC DATA</span>
            </div>
          </div>
          <div class="text-[10px] font-black text-text_primary skew-x-[-12deg] tracking-tighter italic">
          ENQY TERMINAL // INSTITUTIONAL CRYPTO ANALYTICS v10
          </div>
        </div>

      </div>
    </div>
  );
}
