import { createSignal, onMount, createEffect, For, Show, onCleanup as solidOnCleanup } from 'solid-js';
import * as echarts from 'echarts';
import TechnicalAnalysisPanel from '../components/TechnicalAnalysisPanel';
import EntityAdvancedView from '../components/EntityAdvancedView';
import SupplyChainIntel from '../components/institutional/SupplyChainIntel';
import RiskOverlayChart from '../components/institutional/RiskOverlayChart';

// --- CONFIG & CONSTANTS ---
const COMMODITY_API = import.meta.env.VITE_COMMODITY_API;
const GNEWS_API = import.meta.env.VITE_GNEWS_API;

const fmt = (v, d = 2) => (v == null || isNaN(v) || v === 0) ? '---' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (v == null || isNaN(v)) ? '---' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const signColor = (v) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-text_secondary';

function StatBox({ label, value, sub, color }) {
  return (
    <div class="bg-black/40 border-2 border-border_main p-4 flex flex-col gap-1 hover:border-text_accent/40 transition-all group relative overflow-hidden">
      <div class="absolute top-0 left-0 w-1 h-full bg-text_accent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <span class="text-[9px] font-black text-text_secondary uppercase tracking-[0.2em] group-hover:text-text_accent/60 transition-colors">{label}</span>
      <span class={`text-[16px] font-black font-mono ${color || 'text-text_primary'}`}>{value}</span>
      {sub && <span class="text-[9px] text-text_secondary/50 font-mono italic">{sub}</span>}
    </div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div class="px-5 py-3 border-b border-border_main bg-bg_header/40 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-2 h-2 bg-text_accent animate-pulse shadow-[0_0_10px_var(--text-accent)]" />
        <span class="text-[10px] font-black tracking-[0.3em] text-text_primary uppercase font-mono">{title}</span>
      </div>
      {action}
    </div>
  );
}

// ECharts Candlestick Component
function CandlestickChart({ data, theme }) {
  let chartRef;
  let chart;

  const updateChart = () => {
    if (!chartRef || !data || data.length === 0) return;
    if (!chart) chart = echarts.init(chartRef, theme === 'light' ? null : 'dark');

    const reversedData = data.slice();
    const dates = reversedData.map(d => d.Date || d.date);
    const values = reversedData.map(d => [
      d.Open || d.open,
      d.Close || d.close,
      d.Low || d.low,
      d.High || d.high
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
      grid: { left: '8%', right: '8%', bottom: '15%', top: '5%' },
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
        splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.01)', 'rgba(0,0,0,0)'] } },
        axisLabel: { color: '#666', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }
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

export default function CommoditiesIntelligenceView(props) {
  const [commodities, setCommodities] = createSignal([]);
  const [selectedSymbol, setSelectedSymbol] = createSignal('CL=F');
  const [detail, setDetail] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [news, setNews] = createSignal([]);
  const [newsLoading, setNewsLoading] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal('overview');
  const [searchTerm, setSearchTerm] = createSignal('');
  const [selectedRange, setSelectedRange] = createSignal('1M');

  const RANGES = ['1W', '1M', '3M', '6M', '1Y', '5Y', 'ALL'];

  const getFilteredHistory = () => {
    return detail()?.history || [];
  };

  // 1. Fetch List
  const fetchList = async () => {
    try {
      const resp = await fetch(`${COMMODITY_API}/api/commodities/highlights`);
      const json = await resp.json();
      if (json.status === 'success') setCommodities(json.data);
    } catch (e) { console.error("Commodity List error:", e); }
  };

  // 2. Fetch News
  const fetchNews = async (symbol, name) => {
    setNewsLoading(true);
    try {
        const query = `${name} Commodity News`;
        const resp = await fetch(`${GNEWS_API}/api/gnews/search?q=${encodeURIComponent(query)}&lang=en`);
        const json = await resp.json();
        
        let data = (json.status === 'success') ? (json.data || []) : [];
        
        // FALLBACK 1: If specific commodity news is thin, search for broader Supply/Demand and Economic impact news
        if (data.length < 3) {
            const fallbackQuery = `${name} Market Supply Demand Economics News`;
            const fbResp = await fetch(`${GNEWS_API}/api/gnews/search?q=${encodeURIComponent(fallbackQuery)}&lang=en`);
            const fbJson = await fbResp.json();
            if (fbJson.status === 'success' && fbJson.data?.length > 0) {
                data = [...data, ...fbJson.data.filter(f => !data.some(d => d.title === f.title))];
            }
        }
        
        // FALLBACK 2: Final fallback to general Commodity Market trends
        if (data.length === 0) {
            const genericQuery = "Global Commodity Markets Economic Outlook Trends";
            const genResp = await fetch(`${GNEWS_API}/api/gnews/search?q=${encodeURIComponent(genericQuery)}&lang=en`);
            const genJson = await genResp.json();
            if (genJson.status === 'success') data = genJson.data || [];
        }

        setNews(data);
    } catch (e) { 
        console.error("News fetch error:", e);
        setNews([]);
    }
    setNewsLoading(false);
  };

  // 3. Fetch Detail
  const fetchDetail = async (symbol, range = '6M') => {
    setLoading(true);
    try {
      const rangeMap = {
        '1W': '5d', '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '5Y': '5y', 'ALL': 'max'
      };
      const period = rangeMap[range] || '6mo';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const resp = await fetch(`${COMMODITY_API}/api/commodities/detail/${symbol}?period=${period}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      const json = await resp.json();
      if (json.status === 'success') {
        setDetail(json.data);
        fetchNews(symbol, json.data.name);
      } else {
        setDetail(null);
      }
    } catch (e) {
      console.error("Commodity Detail fetch error:", e);
      setDetail(null);
    }
    setLoading(false);
  };

  let _mounted = false;
  onMount(() => {
    _mounted = true;
    fetchList();
    fetchDetail(selectedSymbol(), selectedRange());

    const syncItv = setInterval(() => fetchList(), 60000);
    solidOnCleanup(() => {
      _mounted = false;
      clearInterval(syncItv);
    });
  });

  createEffect(() => {
    const sym = selectedSymbol();
    const rng = selectedRange();
    if (_mounted) fetchDetail(sym, rng);
  });

  const TABS = [
    { id: 'overview', label: '01 MARKET OVERVIEW' },
    { id: 'technical', label: '02 TECHNICAL ANALYSIS' },
    { id: 'news', label: '03 NEWS FEED' },
    { id: 'advanced', label: '04 QUANT ANALYTICS' },
  ];

  const filteredCommodities = () => commodities().filter(p =>
    p.name.toLowerCase().includes(searchTerm().toLowerCase()) ||
    p.symbol.toLowerCase().includes(searchTerm().toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm().toLowerCase())
  );

  // --- STATS LOGIC ---
  const [stats, setStats] = createSignal({ seasonality: null });
  let seasChartDom;
  let seasChart;

  const fetchStats = async () => {
    try {
      const sRes = await fetch(`${COMMODITY_API}/api/commodities/stats/seasonality/${selectedSymbol()}`).then(r => r.json());
      setStats({ seasonality: sRes.data });
      renderSeasonality();
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
      grid: { height: '80%', top: '10%' },
      xAxis: { type: 'category', data: stats().seasonality.months, splitArea: { show: true }, axisLabel: { color: '#666', fontSize: 9 } },
      yAxis: { type: 'category', data: stats().seasonality.years.map(String), splitArea: { show: true }, axisLabel: { color: '#666', fontSize: 9 } },
      visualMap: {
        min: -10, max: 10, calculate: true, orient: 'horizontal', left: 'center', bottom: '0%',
        inRange: { color: ['#ff1744', '#121212', '#00e676'] },
        show: false
      },
      series: [{
        name: 'Monthly Return', type: 'heatmap', data: stats().seasonality.matrix,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
      }]
    });
  };

  createEffect(() => {
    if (activeTab() === 'technical') {
      setTimeout(fetchStats, 100);
    }
  });

  return (
    <div class="flex-1 flex overflow-hidden bg-bg_main font-mono text-text_primary transition-colors">

      {/* LEFT SIDEBAR: COMMODITY NAVIGATOR */}
      <aside class="w-64 border-r border-border_main bg-black/20 flex flex-col shrink-0">
        <div class="p-4 border-b border-border_main bg-bg_header/30">
          <input
            type="text"
            placeholder="SEARCH ASSETS..."
            onInput={(e) => setSearchTerm(e.target.value)}
            class="w-full bg-black/40 border border-border_main px-3 py-2 text-[10px] text-text_accent focus:outline-none focus:border-text_accent/50 transition-all font-mono uppercase tracking-widest"
          />
        </div>
        <div class="flex-1 overflow-y-auto win-scroll">
          <For each={filteredCommodities()}>
            {(item) => (
              <button
                onClick={() => setSelectedSymbol(item.symbol)}
                class={`w-full flex items-center justify-between px-4 py-3 border-b border-border_main/10 hover:bg-text_accent/5 transition-all group ${selectedSymbol() === item.symbol ? 'border-l-4 border-l-text_accent bg-text_accent/10' : 'border-l-4 border-l-transparent opacity-70 hover:opacity-100'}`}
              >
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <div class="w-8 h-8 shrink-0 flex items-center justify-center bg-black/40 border border-border_main text-[8px] font-black group-hover:border-text_accent/40 transition-colors uppercase">
                    {item.category.slice(0, 3)}
                  </div>
                  <div class="flex flex-col items-start overflow-hidden lg:pr-2">
                    <span class="text-[10px] font-black tracking-tight truncate w-full">{item.name}</span>
                    <span class="text-[8px] text-text_secondary font-bold group-hover:text-text_accent/60 transition-colors">{item.symbol}</span>
                  </div>
                </div>

                <div class="flex flex-col items-end shrink-0 pl-2">
                  <span class={`text-[11px] font-black font-mono ${selectedSymbol() === item.symbol ? 'text-text_accent' : 'text-text_primary'}`}>
                    {fmt(item.price, 2)}
                  </span>
                  <span class={`text-[8px] font-bold font-mono ${item.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtPct(item.change_pct)}
                  </span>
                </div>
              </button>
            )}
          </For>
        </div>
        <div class="p-3 bg-bg_header/20 border-t border-border_main flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
            <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">LIVE_SURVEILLANCE</span>
          </div>
          <span class="text-[8px] font-mono text-text_secondary/40 uppercase">LATENCY: SYNC</span>
        </div>
      </aside>

      {/* MAIN INTELLIGENCE AREA */}
      <div class="flex-1 flex flex-col min-w-0">

        {/* HEADER: ASSET STATUS */}
        <div class="h-20 border-b border-border_main bg-bg_header/40 shrink-0 flex items-center justify-between px-6">
          <Show when={detail()} fallback={<div class="animate-pulse flex gap-6"><div class="w-12 h-12 bg-white/5 rounded-sm"></div><div class="w-48 h-10 bg-white/5 rounded-sm"></div></div>}>
            <div class="flex items-center gap-6">
              <div class="w-12 h-12 flex items-center justify-center bg-black/40 border-2 border-border_main">
                <div class="text-[14px] font-black text-text_accent">{detail().symbol.slice(0, 3)}</div>
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-3">
                  <h1 class="text-[18px] font-black tracking-tighter text-text_primary leading-none uppercase">{detail().name}</h1>
                  <span class="px-2 py-0.5 bg-text_accent/10 border border-text_accent/30 text-[9px] font-black text-text_accent tracking-widest uppercase">{detail().institutional?.marketState}</span>
                </div>
                <span class="text-[10px] font-bold text-text_secondary opacity-40 mt-1 uppercase tracking-widest">FUTURES CONTRACT // {detail().symbol}</span>
              </div>
            </div>

            <div class="flex items-center gap-10">
              <div class="flex flex-col items-end">
                <span class="text-[26px] font-black font-mono text-text_primary leading-none">${fmt(detail().price, 2)}</span>
                <span class={`text-[10px] font-black mt-1 ${signColor(detail().institutional?.regularMarketChange)}`}>
                  {detail().institutional?.regularMarketChange > 0 ? '+' : ''}{fmt(detail().institutional?.regularMarketChange, 2)} ({fmtPct(detail().institutional?.regularMarketChangePercent)})
                </span>
              </div>
              <div class="h-10 w-px bg-border_main opacity-30"></div>
              <div class="flex flex-col items-end">
                <span class="text-[10px] font-black text-text_secondary/60 uppercase tracking-widest mb-1">VOLUME</span>
                <span class="text-[14px] font-black text-text_primary uppercase font-mono">{Number(detail().institutional?.volume || 0).toLocaleString()}</span>
              </div>
            </div>
          </Show>
        </div>

        {/* TAB NAVIGATION */}
        <div class="h-11 border-b border-border_main flex items-center gap-1 px-4 bg-black/20 shrink-0">
          <For each={TABS}>
            {(tab) => (
              <button
                onClick={() => setActiveTab(tab.id)}
                class={`px-4 h-full text-[9px] font-black tracking-[0.2em] transition-all border-b-2 flex items-center ${activeTab() === tab.id ? 'text-text_accent border-text_accent bg-text_accent/5' : 'text-text_secondary border-transparent opacity-40 hover:opacity-100 hover:bg-white/5'}`}
              >
                {tab.label}
              </button>
            )}
          </For>
        </div>

        {/* CONTENT SWITCHER */}
        <div class="flex-1 overflow-y-auto win-scroll p-6 bg-black/5">

          <Show when={activeTab() === 'overview'}>
            <div class="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">

              <div class="grid grid-cols-12 gap-6">
                {/* Candlestick Chart */}
                <div class="col-span-12 lg:col-span-8 flex flex-col border-2 border-border_main bg-black/40 h-[500px] shrink-0">
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
                          onClick={() => { fetchList(); fetchDetail(selectedSymbol(), selectedRange()); }}
                          class="flex items-center gap-2 px-3 py-0.5 bg-text_accent/10 border border-text_accent/30 text-[8px] font-black text-text_accent hover:bg-text_accent hover:text-bg_main transition-all uppercase"
                        >
                          <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                          RELOAD
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

                {/* Commodity Strategic Dossier */}
                <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40 overflow-hidden">
                  <SectionHeader title="MARKET OVERVIEW" />
                  <div class="flex-1 p-5 flex flex-col gap-4 overflow-y-auto win-scroll">
                    <div class="grid grid-cols-2 gap-4">
                      <StatBox label="BID" value={fmt(detail()?.institutional?.bid, 2)} color="text-emerald-400" />
                      <StatBox label="ASK" value={fmt(detail()?.institutional?.ask, 2)} color="text-red-400" />
                    </div>

                    <div class="grid grid-cols-2 gap-4 pt-2">
                      <div class="flex flex-col gap-1">
                        <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">VOLUME</span>
                        <span class="text-[14px] font-black text-white font-mono">{Number(detail()?.institutional?.volume || 0).toLocaleString()}</span>
                      </div>
                      <div class="flex flex-col gap-1">
                        <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">OPEN INT.</span>
                        <span class="text-[14px] font-black text-blue-400 font-mono">{Number(detail()?.institutional?.openInterest || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div class="space-y-4 pt-4 border-t border-border_main/10">
                      <div class="flex flex-col gap-1.5">
                        <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">DAY RANGE</span>
                        <div class="flex justify-between text-[11px] font-bold text-text_primary font-mono">
                          <span>{fmt(detail()?.institutional?.dayLow, 2)}</span>
                          <span>{fmt(detail()?.institutional?.dayHigh, 2)}</span>
                        </div>
                      </div>

                      <div class="flex flex-col gap-1.5">
                        <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">52 WEEK RANGE</span>
                        <div class="flex justify-between text-[11px] font-bold text-text_primary font-mono">
                          <span>{fmt(detail()?.institutional?.fiftyTwoWeekLow, 2)}</span>
                          <span>{fmt(detail()?.institutional?.fiftyTwoWeekHigh, 2)}</span>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 gap-1">
                        <div class="flex items-center justify-between py-1.5 border-b border-border_main/10 text-[9px]">
                          <span class="font-black text-text_secondary uppercase">MA_50_DAY</span>
                          <span class="font-mono font-bold text-text_primary">{fmt(detail()?.institutional?.fiftyDayAverage, 2)}</span>
                        </div>
                        <div class="flex items-center justify-between py-1.5 border-b border-border_main/10 text-[9px]">
                          <span class="font-black text-text_secondary uppercase">MA_200_DAY</span>
                          <span class="font-mono font-bold text-text_primary">{fmt(detail()?.institutional?.twoHundredDayAverage, 2)}</span>
                        </div>
                        <div class="flex items-center justify-between py-1.5 text-[9px]">
                          <span class="font-black text-text_secondary uppercase">EXCHANGE</span>
                          <span class="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-black tracking-tighter uppercase">{detail()?.institutional?.fullExchangeName || 'NYM'}</span>
                        </div>
                      </div>
                    </div>

                    <div class="mt-auto pt-6 border-t border-border_main/20">
                      <div class="flex items-center gap-2 mb-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-text_accent animate-pulse"></div>
                        <span class="text-[8px] font-black text-text_accent tracking-widest uppercase">MARKET STATUS: {detail()?.institutional?.marketState}</span>
                      </div>
                      <p class="text-[8px] text-text_secondary italic leading-tight opacity-40 uppercase">
                        Institutional Futures Data Feed // Surveillance Active.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Institutional Analytics Integrations */}
              <div class="grid grid-cols-12 gap-6">
                <div class="col-span-12 lg:col-span-6 h-[400px]">
                  <SupplyChainIntel />
                </div>
                <div class="col-span-12 lg:col-span-6 h-[400px]">
                  <RiskOverlayChart symbol={selectedSymbol()} />
                </div>
              </div>

              {/* RECENT NEWS SUMMARY (COMPACT) */}
              <div class="grid grid-cols-12 gap-6">
                <div class="col-span-12 lg:col-span-8 flex flex-col border-2 border-border_main bg-black/40 h-[400px]">
                  <SectionHeader title="LATEST COMMODITY NEWS" />
                  <div class="flex-1 overflow-y-auto p-2 space-y-1 win-scroll">
                    <For each={news().slice(0, 8)}>
                      {(n) => (
                        <a href={n.link} target="_blank" class="flex items-center gap-4 px-4 py-2.5 hover:bg-white/[0.03] transition-all group border-b border-border_main/5 last:border-0">
                          <div class="flex flex-col shrink-0 w-24">
                            <span class="text-[8px] font-black text-text_accent uppercase tracking-tighter opacity-60">{n.publisher}</span>
                            <span class="text-[7px] font-bold text-text_secondary opacity-30 tabular-nums">{new Date(n.time * 1000).toLocaleDateString()}</span>
                          </div>
                          <h4 class="text-[10px] font-black text-text_primary group-hover:text-text_accent transition-colors truncate uppercase tracking-tight">{n.title}</h4>
                          <div class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg class="w-3 h-3 text-text_accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3" /></svg>
                          </div>
                        </a>
                      )}
                    </For>
                    <Show when={news().length === 0 && !newsLoading()}>
                      <div class="flex items-center justify-center h-full text-[9px] text-text_secondary opacity-40 uppercase tracking-widest italic">No recent news found for this commodity.</div>
                    </Show>
                  </div>
                </div>

                <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40 h-[400px]">
                  <SectionHeader title="PRICE DATA MATRIX" />
                  <div class="flex-1 overflow-auto p-0 scrollbar-thin">
                    <table class="w-full text-left text-[10px] border-collapse font-mono">
                      <thead class="bg-bg_header/60 sticky top-0 text-text_secondary opacity-70 uppercase font-black text-[8px] tracking-widest border-b border-border_main">
                        <tr>
                          <th class="p-3">DATE</th>
                          <th class="p-3 text-right">CLOSE</th>
                          <th class="p-3 text-right">DELTA</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-border_main/10">
                        <For each={detail()?.history?.slice().reverse().slice(0, 20)}>
                          {(row, idx) => {
                            const prevRow = detail().history[detail().history.length - 1 - idx() - 1];
                            const delta = prevRow ? row.Close - prevRow.Close : 0;
                            return (
                              <tr class="hover:bg-white/5 transition-colors">
                                <td class="p-3 font-bold opacity-60 uppercase">{row.Date}</td>
                                <td class="p-3 text-right text-text_accent font-black">{fmt(row.Close, 2)}</td>
                                <td class={`p-3 text-right font-black ${signColor(delta)}`}>
                                  {delta > 0 ? '▲' : delta < 0 ? '▼' : ''} {fmt(Math.abs(delta), 2)}
                                </td>
                              </tr>
                            );
                          }}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'technical'}>
            <div class="h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-y-auto win-scroll pr-2">
              <div class="flex flex-col border-2 border-border_main bg-black/40 h-[400px] shrink-0">
                <SectionHeader title={`SEASONALITY HEATMAP (${selectedSymbol()})`} />
                <div ref={seasChartDom} class="flex-1"></div>
              </div>

              <div class="h-[700px] shrink-0 border-2 border-border_main mb-6">
                <TechnicalAnalysisPanel symbol={selectedSymbol()} showToolbar={false} />
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'news'}>
            <div class="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500 h-full">
              <div class="flex flex-col border-2 border-border_main bg-black/40 h-full">
                <SectionHeader title="COMMODITY INTEL FEED // GLOBAL SURVEILLANCE" />
                <div class="flex-1 overflow-y-auto p-4 space-y-1 win-scroll">
                  <For each={news()}>
                    {(item) => (
                      <a href={item.link} target="_blank" class="flex items-center gap-6 px-6 py-4 hover:bg-white/[0.03] transition-all group border-b border-border_main/5 last:border-0 relative overflow-hidden">
                        <div class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-text_accent scale-y-0 group-hover:scale-y-100 transition-transform"></div>
                        <div class="flex flex-col shrink-0 w-32">
                          <div class="flex items-center gap-2">
                            <div class="w-1 h-1 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                            <span class="text-[9px] font-black text-orange-400 uppercase tracking-widest">{item.publisher}</span>
                          </div>
                          <span class="text-[8px] font-black text-text_secondary opacity-30 uppercase mt-0.5 tabular-nums">{new Date(item.time * 1000).toLocaleString()}</span>
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
                  <Show when={news().length === 0 && newsLoading()}>
                    <div class="flex flex-col items-center justify-center h-full gap-4">
                      <div class="w-6 h-6 border-2 border-text_accent border-t-transparent animate-spin rounded-full"></div>
                      <span class="text-[10px] font-black text-text_accent tracking-[0.4em] uppercase">Fetching Intel...</span>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'advanced'}>
            <div class="h-full flex flex-col animate-in zoom-in duration-500 overflow-hidden">
              <EntityAdvancedView
                symbol={selectedSymbol()}
                news={news()}
                newsLoading={newsLoading()}
                fullHistory={(detail()?.history || []).map(h => ({
                  Date: h.Date,
                  Open: h.Open,
                  High: h.High,
                  Low: h.Low,
                  Close: h.Close,
                  Volume: h.Volume
                }))}
              />
            </div>
          </Show>

        </div>

        {/* FOOTER STATUS BAR */}
        <div class="h-10 border-t border-border_main bg-bg_header/20 shrink-0 flex items-center justify-between px-6">
          <div class="flex items-center gap-6 text-[9px] font-black text-text_secondary tracking-widest">
            <div class="flex items-center gap-2 font-mono">
              <div class="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
              <span class="uppercase">STATUS: SYNC_CONNECTED</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="uppercase">FEED: GLOBAL_COMMODITY_DATA</span>
            </div>
          </div>
          <div class="text-[10px] font-black text-text_primary skew-x-[-12deg] tracking-tighter italic font-mono uppercase">
            ENQY TERMINAL // COMMODITY ANALYTICS
          </div>
        </div>

      </div>
    </div>
  );
}
;

