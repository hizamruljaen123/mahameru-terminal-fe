import { createSignal, onMount, createEffect, For, Show } from 'solid-js';
import * as echarts from 'echarts';

const MARKET_API = import.meta.env.VITE_MARKET_API;
const NEWS_API   = import.meta.env.VITE_API_BASE;
const ENTITY_API = import.meta.env.VITE_ENTITY_URL;

// ─── SECTOR INDEX ────────────────────────────────────────────────────────────
const SECTORS = [
  { key: 'technology',           name: 'Technology',            etf: 'XLK', color: '#3b82f6' },
  { key: 'financial-services',   name: 'Financial Services',    etf: 'XLF', color: '#10b981' },
  { key: 'communication-services',name:'Communication Services',etf: 'XLC', color: '#8b5cf6' },
  { key: 'consumer-cyclical',    name: 'Consumer Cyclical',     etf: 'XLY', color: '#f59e0b' },
  { key: 'industrials',          name: 'Industrials',           etf: 'XLI', color: '#06b6d4' },
  { key: 'healthcare',           name: 'Healthcare',            etf: 'XLV', color: '#ec4899' },
  { key: 'energy',               name: 'Energy',                etf: 'XLE', color: '#f97316' },
  { key: 'consumer-defensive',   name: 'Consumer Defensive',    etf: 'XLP', color: '#84cc16' },
  { key: 'basic-materials',      name: 'Basic Materials',       etf: 'XLB', color: '#d97706' },
  { key: 'utilities',            name: 'Utilities',             etf: 'XLU', color: '#6366f1' },
  { key: 'real-estate',          name: 'Real Estate',           etf: 'XLRE', color: '#ef4444' },
];

// ─── SPARKLINE MINI CHART ─────────────────────────────────────────────────────
function Sparkline(props) {
  let el;
  let chart;

  onMount(() => {
    chart = echarts.init(el, null, { renderer: 'svg' });
  });

  createEffect(() => {
    const data = props.data;
    if (!chart || !data || data.length === 0) return;
    const first = data[0];
    const last  = data[data.length - 1];
    const color = last >= first ? '#10b981' : '#ef4444';

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 2, bottom: 2, left: 2, right: 2 },
      xAxis: { show: false, type: 'category' },
      yAxis: { show: false, type: 'value', scale: true },
      series: [{
        type: 'line',
        data,
        smooth: true,
        symbol: 'none',
        lineStyle: { color, width: 1.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: color + '44' },
            { offset: 1, color: color + '00' }
          ])
        }
      }]
    });
  });

  return <div ref={el} style={{ width: props.width || '80px', height: props.height || '32px' }} />;
}

// ─── MULTI-SERIES CHART ───────────────────────────────────────────────────────
function SectorChart(props) {
  let el;
  let chart;

  onMount(() => {
    chart = echarts.init(el);
    const handleResize = () => chart && chart.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart?.dispose(); };
  });

  createEffect(() => {
    const data = props.data;
    if (!chart || !data || data.length === 0) return;

    const first = data[0];
    const normalized = data.map(v => ((v - first) / first) * 100);
    const color = normalized[normalized.length - 1] >= 0 ? '#10b981' : '#ef4444';

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#000',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 10 },
        formatter: (params) => `${params[0].dataIndex + 1}d: ${params[0].value >= 0 ? '+' : ''}${params[0].value.toFixed(2)}%`
      },
      grid: { top: 10, bottom: 20, left: 40, right: 10 },
      xAxis: { show: false, type: 'category' },
      yAxis: {
        type: 'value', scale: true,
        axisLabel: { formatter: v => v.toFixed(1) + '%', fontSize: 8, color: '#555' },
        splitLine: { lineStyle: { color: '#1a1a1a' } }
      },
      series: [{
        type: 'line',
        data: normalized,
        smooth: true,
        symbol: 'none',
        lineStyle: { color, width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: color + '33' },
            { offset: 1, color: color + '00' }
          ])
        },
        markLine: {
          silent: true,
          data: [{ yAxis: 0 }],
          lineStyle: { color: '#ffffff22', width: 1, type: 'dashed' },
          label: { show: false },
          symbol: 'none'
        }
      }]
    });
  });

  return <div ref={el} class="w-full h-full" />;
}

// ─── GLOBAL SECTOR HEATMAP ────────────────────────────────────────────────────
function GlobalSectorHeatmap(props) {
  let el;
  let chart;

  onMount(() => {
    chart = echarts.init(el);
    const handleResize = () => chart && chart.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart?.dispose(); };
  });

  createEffect(() => {
    const data = props.data;
    if (!chart || !data || data.length === 0) return;

    const heatmapData = data.map(s => {
      const ret = s.sector_return_ytd || 0;
      return {
        name: s.sector,
        value: 10,
        return: ret,
        movers: s.top_movers || [],
        losers: s.top_losers || [],
        itemStyle: {
          color: ret >= 0 ? (ret > 5 ? '#064e3b' : '#059669') : (ret < -5 ? '#450a0a' : '#991b1b'),
          borderColor: '#000',
          borderWidth: 2,
          gapWidth: 1
        }
      };
    });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#000',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 10 },
        formatter: (params) => {
          const d = params.data;
          return `${d.name}: ${d.return >= 0 ? '+' : ''}${d.return.toFixed(2)}%`;
        }
      },
      series: [{
        type: 'treemap',
        breadcrumb: { show: false },
        roam: false,
        nodeClick: false,
        width: '100%',
        height: '100%',
        top: 0, left: 0, right: 0, bottom: 0,
        data: heatmapData,
        label: {
          show: true,
          position: 'inside',
          formatter: (params) => {
            const d = params.data;
            const movers = d.movers.slice(0, 2);
            const losers = d.losers.slice(0, 2);
            
            let lines = [
              `{name|${d.name.toUpperCase()}}`,
              `{ret|${d.return >= 0 ? '+' : ''}${d.return.toFixed(2)}%}`,
              `{hr|}`
            ];

            if (movers.length > 0) {
              lines.push(`{label|TOP_GAINER}`);
              movers.forEach(m => lines.push(`{m|${m.symbol}} {p|${m.ytd_return >= 0 ? '+' : ''}${m.ytd_return}%}`));
            }
            if (losers.length > 0) {
              lines.push(`{label|TOP_LOSER}`);
              losers.forEach(l => lines.push(`{l|${l.symbol}} {p|${l.ytd_return >= 0 ? '+' : ''}${l.ytd_return}%}`));
            }

            return lines.join('\n');
          },
          rich: {
            name: { fontSize: 12, fontWeight: '900', color: '#fff', padding: [10, 0, 4, 0], align: 'center', textBorderColor: '#000', textBorderWidth: 2 },
            ret: { fontSize: 18, fontWeight: '900', color: '#fff', align: 'center', padding: [0, 0, 10, 0], fontFamily: 'monospace', textBorderColor: '#000', textBorderWidth: 2 },
            hr: { borderColor: '#ffffff33', width: '100%', borderWidth: 1, height: 0, margin: [5, 0] },
            label: { fontSize: 8, fontWeight: '900', color: '#fff', backgroundColor: 'rgba(0,0,0,0.4)', padding: [2, 6], borderRadius: 2, align: 'left' },
            m: { fontSize: 10, fontWeight: 'bold', color: '#4ade80', align: 'left', padding: [4, 0, 0, 0] },
            l: { fontSize: 10, fontWeight: 'bold', color: '#f87171', align: 'left', padding: [4, 0, 0, 0] },
            p: { fontSize: 9, fontWeight: 'bold', color: '#fff', align: 'right', fontFamily: 'monospace', padding: [4, 0, 0, 0] }
          }
        }
      }]
    });
  });

  return <div ref={el} class="w-full h-full" />;
}

// ─── INDUSTRY PERFORMANCE HEATMAP ─────────────────────────────────────────────
function IndustryPerformanceHeatmap(props) {
  let el;
  let chart;

  onMount(() => {
    chart = echarts.init(el);
    const handleResize = () => chart && chart.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart?.dispose(); };
  });

  createEffect(() => {
    const industries = props.data;
    if (!chart || !industries || industries.length === 0) return;

    const heatmapData = industries.map(ind => {
      const ret = ind.industry_return_ytd || 0;
      const comps = ind.companies || [];
      const sorted = [...comps].filter(c => c.ytd_return != null).sort((a, b) => b.ytd_return - a.ytd_return);
      
      return {
        name: ind.industry_name,
        value: Math.max(Math.abs(ret), 1),
        return: ret,
        movers: sorted.slice(0, 2),
        losers: sorted.slice(-2).reverse(),
        itemStyle: {
          color: ret >= 0 ? (ret > 15 ? '#064e3b' : '#059669') : (ret < -15 ? '#450a0a' : '#991b1b'),
          borderColor: '#000',
          borderWidth: 2
        }
      };
    });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#000',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 10 },
        formatter: (p) => `${p.data.name}: ${p.data.return >= 0 ? '+' : ''}${p.data.return.toFixed(2)}%`
      },
      series: [{
        type: 'treemap',
        breadcrumb: { show: false },
        roam: false,
        nodeClick: false,
        width: '100%',
        height: '100%',
        top: 0, left: 0, right: 0, bottom: 0,
        data: heatmapData,
        label: {
          show: true,
          position: 'inside',
          formatter: (params) => {
            const d = params.data;
            let lines = [
              `{name|${d.name.toUpperCase()}}`,
              `{ret|${d.return >= 0 ? '+' : ''}${d.return.toFixed(2)}%}`,
              `{hr|}`
            ];
            if (d.movers.length > 0) {
              lines.push(`{label|TOP_GAINER}`);
              d.movers.forEach(m => lines.push(`{m|${m.symbol}} {p|${m.ytd_return >= 0 ? '+' : ''}${m.ytd_return.toFixed(2)}%}`));
            }
            if (d.losers.length > 0) {
              lines.push(`{label|TOP_LOSER}`);
              d.losers.forEach(l => lines.push(`{l|${l.symbol}} {p|${l.ytd_return >= 0 ? '+' : ''}${l.ytd_return.toFixed(2)}%}`));
            }
            return lines.join('\n');
          },
          rich: {
            name: { fontSize: 10, fontWeight: '900', color: '#fff', padding: [4, 0], align: 'center', textBorderColor: '#000', textBorderWidth: 1 },
            ret: { fontSize: 14, fontWeight: '900', color: '#fff', align: 'center', padding: [0, 0, 6, 0], fontFamily: 'monospace' },
            hr: { borderColor: '#ffffff22', width: '100%', borderWidth: 0.5, height: 0, margin: [2, 0] },
            label: { fontSize: 7, fontWeight: '900', color: '#fff', backgroundColor: 'rgba(0,0,0,0.3)', padding: [1, 4], align: 'left' },
            m: { fontSize: 8, fontWeight: 'bold', color: '#4ade80', align: 'left' },
            l: { fontSize: 8, fontWeight: 'bold', color: '#fca5a5', align: 'left' },
            p: { fontSize: 7, color: '#fff', align: 'right', fontFamily: 'monospace' }
          }
        }
      }]
    });
  });

  return <div ref={el} class="w-full h-full" />;
}

// ─── COMPANY ASSET HEATMAP ────────────────────────────────────────────────────
function CompanyHeatmap(props) {
  let el;
  let chart;

  onMount(() => {
    chart = echarts.init(el);
    const handleResize = () => chart && chart.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart?.dispose(); };
  });

  createEffect(() => {
    const list = props.data;
    if (!chart || !list || list.length === 0) return;

    const heatmapData = list.map(c => {
      const ret = c.ytd_return || 0;
      return {
        name: c.symbol,
        value: c.market_weight || 1,
        return: ret,
        companyName: c.name,
        price: c.last_price,
        itemStyle: {
          color: ret >= 0 ? (ret > 20 ? '#065f46' : '#10b98144') : (ret < -20 ? '#7f1d1d' : '#ef444444'),
          borderColor: '#000',
          borderWidth: 1,
          opacity: Math.min(0.2 + (Math.abs(ret) / 30), 1)
        }
      };
    });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: '#000',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 10 },
        formatter: (p) => {
          const d = p.data;
          return `${d.name}: ${d.return >= 0 ? '+' : ''}${d.return.toFixed(2)}%<br/>${d.companyName}`;
        }
      },
      series: [{
        type: 'treemap',
        breadcrumb: { show: false },
        roam: false,
        width: '100%', height: '100%',
        top: 0, left: 0, right: 0, bottom: 0,
        data: heatmapData,
        label: {
          show: true,
          formatter: (p) => `{s|${p.data.name}}\n{r|${p.data.return >= 0 ? '+' : ''}${p.data.return.toFixed(1)}%}`,
          rich: {
            s: { fontSize: 9, fontWeight: 'bold', color: '#fff', align: 'center' },
            r: { fontSize: 7, fontWeight: 'bold', color: '#fff', align: 'center', backgroundColor: 'rgba(0,0,0,0.3)', padding: [1, 2], borderRadius: 1 }
          }
        }
      }]
    });
  });

  return <div ref={el} class="w-full h-full" />;
}

// ─── PERFORMANCE BAR ────────────────────────────────────────────────────────
function PerfBar(props) {
  const val = props.value || 0;
  const pct = Math.min(Math.abs(val) * 4, 100);
  const isPos = val >= 0;
  return (
    <div class="flex items-center gap-2">
      <div class="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          class={`h-full rounded-full ${isPos ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span class={`text-[10px] font-black font-mono ${isPos ? 'text-emerald-500' : 'text-red-500'}`}>
        {isPos ? '+' : ''}{val.toFixed(2)}%
      </span>
    </div>
  );
}

// ─── FORMAT HELPERS ──────────────────────────────────────────────────────────
function fmtCap(n) {
  if (!n) return '—';
  if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return '$' + (n/1e6).toFixed(2) + 'M';
  return '$' + n;
}
// Guard against yfinance returning the string "None" instead of null
const fmtName   = (n, sym) => (!n || n === 'None' || n === 'null') ? sym : n;
const fmtRating = (r) => (!r || r === 'None' || r === 'null') ? '—' : r;
const fmtPct    = (v) => v != null ? (Number(v) >= 0 ? '+' : '') + Number(v).toFixed(2) + '%' : '—';
const fmtPrice  = (v) => v != null ? `$${Number(v).toFixed(2)}` : '—';
const fmtWeight = (w) => w != null ? `${(Number(w) * 100).toFixed(2)}%` : '—';
const ratingCls = (r) => {
  if (!r || r === 'None') return 'text-text_secondary/30';
  if (r.includes('Strong Buy')) return 'text-emerald-400';
  if (r.includes('Buy'))       return 'text-emerald-600';
  if (r.includes('Underperform') || r.includes('Sell')) return 'text-red-500';
  return 'text-text_secondary/40';
};

// ─── MAIN VIEW ───────────────────────────────────────────────────────────────
export default function SectorDetailView(props) {
  const [selectedSector, setSelectedSector] = createSignal(null);
  const [data, setData]                     = createSignal(null);
  const [isLoading, setIsLoading]           = createSignal(false);
  const [error, setError]                   = createSignal(null);
  const [activeIndustry, setActiveIndustry] = createSignal(null);
  const [activeTab, setActiveTab]           = createSignal('overview');
  const [searchQ, setSearchQ]               = createSignal('');
  const [sortBy, setSortBy]                 = createSignal('ytd_return');
  const [sortDir, setSortDir]               = createSignal(-1);
  const [sectorNews, setSectorNews]         = createSignal([]);
  const [expandedNews, setExpandedNews]     = createSignal(null);
  const [overviewData, setOverviewData]     = createSignal([]);
  const [overviewLoading, setOverviewLoading] = createSignal(true);


  // Load sector overview (all sectors YTD) on mount
  onMount(async () => {
    try {
      const r = await fetch(`${MARKET_API}/api/market/sectors`);
      const j = await r.json();
      if (j.status === 'success') {
        const grouped = {};
        j.data.forEach(d => {
          if (!grouped[d.sector]) grouped[d.sector] = { ...d, industries: [] };
          if (d.industry && d.industry !== 'N/A') grouped[d.sector].industries.push(d);
        });
        setOverviewData(Object.values(grouped).sort((a,b) => b.sector_return_ytd - a.sector_return_ytd));
      }
    } catch {/* silent */}
    setOverviewLoading(false);
  });

  // Fetch detailed sector data when sector is selected
  createEffect(async () => {
    const sector = selectedSector();
    if (!sector) return;

    setIsLoading(true);
    setError(null);
    setData(null);
    setActiveIndustry(null);
    setSectorNews([]);

    try {
      const r = await fetch(`${MARKET_API}/api/market/sector-detail/${sector.key}`);
      const j = await r.json();
      if (j.status === 'success') {
        setData(j.data);
      } else {
        setError('Failed to fetch sector data');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }

    // Fetch related news concurrently
    try {
      const r = await fetch(`${NEWS_API}/api/news/search?q=${encodeURIComponent(sector.name)}`);
      const j = await r.json();
      if (j.success) setSectorNews((j.results || []).slice(0, 20));
    } catch {/* silent */}
  });

  // Sorted company list
  const visibleCompanies = () => {
    let list = [];
    if (activeIndustry()) {
      const ind = data()?.industries?.find(i => i.industry_name === activeIndustry());
      list = ind?.companies || [];
    } else {
      list = data()?.all_companies || [];
    }

    const q = searchQ().toLowerCase();
    if (q) list = list.filter(c => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q));

    const key = sortBy();
    return [...list].sort((a, b) => {
      const av = a[key] ?? -Infinity;
      const bv = b[key] ?? -Infinity;
      return sortDir() * (typeof bv === 'string' ? bv.localeCompare(av) : bv - av);
    });
  };

  const toggleSort = (col) => {
    if (sortBy() === col) setSortDir(d => d * -1);
    else { setSortBy(col); setSortDir(-1); }
  };

  const navigateToEntity = (symbol) => {
    if (props.onNavigateToEntity) props.onNavigateToEntity(symbol);
  };

  // ─── OVERVIEW MODE ────────────────────────────────────────────────────────
  const OverviewPanel = () => (
    <div class="flex-1 overflow-y-auto win-scroll p-4 space-y-4 animate-in fade-in duration-500">

      {/* GLOBAL HEATMAP SECTION */}
      <div class="h-[380px] w-full bg-bg_header/20 border border-border_main flex flex-col overflow-hidden">
        <div class="px-4 py-2 border-b border-border_main bg-bg_main/5 flex justify-between items-center shrink-0">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 bg-text_accent animate-pulse"></div>
            <span class="text-[10px] font-black tracking-[0.3em] text-text_primary uppercase italic">MARKET_SECTOR_TRAFFIC_CONTROL</span>
          </div>
          <div class="flex gap-4 items-center">
             <span class="text-[8px] text-text_secondary/40 font-bold uppercase tracking-widest">LIVE_ASSET_FLOW</span>
             <div class="text-[8px] px-2 py-0.5 border border-emerald-500/30 text-emerald-500 font-black">SYNC_OK</div>
          </div>
        </div>
        <div class="flex-1 p-2">
          <GlobalSectorHeatmap data={overviewData()} />
        </div>
      </div>

      {/* HEADER */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-1 h-10 bg-text_accent shadow-[0_0_15px_rgba(0,255,65,0.5)]" />
          <div>
            <h1 class="text-[16px] font-black tracking-[0.3em] text-text_primary uppercase">SECTOR_INTELLIGENCE_HUB</h1>
            <p class="text-[9px] text-text_secondary/40 font-mono uppercase tracking-widest">US EQUITY MARKET // 11 GICS SECTORS // YTD PERFORMANCE ANALYSIS</p>
          </div>
        </div>
        <div class="text-[8px] text-text_secondary/30 font-mono uppercase">DATASOURCE: YFINANCE / ETF PROXY</div>
      </div>

      {/* SECTOR GRID */}
      <Show when={!overviewLoading()} fallback={
        <div class="flex items-center justify-center py-20">
          <div class="flex flex-col items-center gap-3">
            <div class="w-6 h-6 border-2 border-text_accent border-t-transparent animate-spin rounded-full" />
            <span class="text-[9px] text-text_accent font-black uppercase tracking-widest animate-pulse">INGESTING_SECTOR_DATA...</span>
          </div>
        </div>
      }>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <For each={overviewData()}>
            {(s) => {
              const sector = SECTORS.find(sx => sx.name === s.sector) || SECTORS[0];
              const isPos = s.sector_return_ytd >= 0;
              return (
                <div
                  onClick={() => setSelectedSector(sector)}
                  class="group cursor-pointer bg-bg_header/30 border border-border_main hover:border-text_accent/40 transition-all duration-300 overflow-hidden relative"
                  style={{ 'border-left': `3px solid ${sector.color}` }}
                >
                  <div class={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                    style={{ background: `radial-gradient(circle at top left, ${sector.color}08, transparent 60%)` }}
                  />
                  <div class="p-4 relative z-10">
                    <div class="flex justify-between items-start mb-3">
                      <div>
                        <div class="text-[8px] font-black text-text_secondary/40 uppercase tracking-widest">{sector.etf}</div>
                        <h3 class="text-[13px] font-black text-text_primary uppercase tracking-tight">{s.sector}</h3>
                        <div class="text-[8px] text-text_secondary/30 font-mono">{s.industries?.length || 0} INDUSTRIES</div>
                      </div>
                      <div class="flex flex-col items-end gap-1">
                        <span class={`text-[22px] font-black font-mono leading-none ${isPos ? 'text-emerald-500' : 'text-red-500'}`}>
                          {isPos ? '+' : ''}{s.sector_return_ytd?.toFixed(2)}%
                        </span>
                        <span class="text-[7px] text-text_secondary/30 uppercase tracking-widest">YTD RETURN</span>
                      </div>
                    </div>

                    {/* Top 3 industries preview */}
                    <div class="flex flex-col gap-0.5 mt-2">
                      <For each={(s.industries || []).sort((a,b) => b.industry_return_ytd - a.industry_return_ytd).slice(0, 3)}>
                        {(ind) => (
                          <div class="flex justify-between items-center px-1.5 py-1 bg-white/[0.02] rounded">
                            <span class="text-[8px] text-text_secondary/50 font-bold uppercase truncate max-w-[160px]">{ind.industry}</span>
                            <span class={`text-[8px] font-black font-mono ${(ind.industry_return_ytd || 0) >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                              {(ind.industry_return_ytd || 0) >= 0 ? '+' : ''}{(ind.industry_return_ytd || 0).toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </For>
                    </div>

                    <div class="mt-3 pt-2 border-t border-border_main/10 flex items-center justify-between">
                      <span class="text-[7px] text-text_secondary/30 font-mono uppercase">CLICK FOR DEEP INTEL ▶</span>
                      <div class={`w-2 h-2 rounded-full ${isPos ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );

  // ─── DETAIL MODE ──────────────────────────────────────────────────────────
  const DetailPanel = () => {
    return (
      <div class="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">

        {/* TOP BAR */}
        <div class="px-4 py-3 border-b border-border_main bg-bg_header/60 flex items-center gap-4 shrink-0">
          <button
            onClick={() => { setSelectedSector(null); setData(null); }}
            class="flex items-center gap-2 text-[9px] font-black text-text_secondary hover:text-text_accent transition-colors uppercase tracking-wider"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            SECTOR_OVERVIEW
          </button>
          <div class="w-px h-4 bg-border_main" />
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full animate-pulse" style={{ background: selectedSector()?.color }} />
            <span class="text-[12px] font-black text-text_primary uppercase tracking-widest">{selectedSector()?.name}</span>
            <span class="text-[9px] text-text_secondary/40 font-mono">{selectedSector()?.etf}</span>
          </div>

          {/* TABS */}
          <div class="ml-auto flex gap-1">
            <For each={['overview', 'industries', 'companies', 'movers', 'news']}>
              {(tab) => (
                <button
                  onClick={() => setActiveTab(tab)}
                  class={`px-3 py-1 text-[8px] font-black tracking-widest uppercase border transition-all ${activeTab() === tab ? 'text-text_accent border-text_accent bg-text_accent/10' : 'text-text_secondary border-border_main hover:border-text_accent/50'}`}
                >
                  {tab}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* LOADING */}
        <Show when={isLoading()}>
          <div class="flex-1 flex flex-col items-center justify-center gap-4">
            <div class="w-8 h-8 border-2 border-text_accent border-t-transparent animate-spin rounded-full" />
            <span class="text-[10px] text-text_accent font-black tracking-widest uppercase animate-pulse">FETCHING SECTOR INTELLIGENCE...</span>
            <span class="text-[8px] text-text_secondary/40 font-mono">This may take 30-60 seconds on first load</span>
          </div>
        </Show>

        <Show when={!isLoading() && data()}>
          <div class="flex-1 overflow-y-auto win-scroll">

            {/* ── TAB: OVERVIEW ── */}
            <Show when={activeTab() === 'overview'}>
              <div class="p-4 space-y-4">

                {/* STAT CARDS */}
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <For each={[
                    { label: 'YTD RETURN', value: fmtPct(data().sector_return_ytd), color: Number(data().sector_return_ytd) >= 0 ? 'text-emerald-500' : 'text-red-500', border: Number(data().sector_return_ytd) >= 0 ? 'border-emerald-500' : 'border-red-500' },
                    { label: '1M RETURN',  value: fmtPct(data().sector_return_1m),  color: Number(data().sector_return_1m)  >= 0 ? 'text-emerald-500' : 'text-red-500', border: Number(data().sector_return_1m)  >= 0 ? 'border-emerald-500' : 'border-red-500' },
                    { label: '3M RETURN',  value: fmtPct(data().sector_return_3m),  color: Number(data().sector_return_3m)  >= 0 ? 'text-emerald-500' : 'text-red-500', border: Number(data().sector_return_3m)  >= 0 ? 'border-emerald-500' : 'border-red-500' },
                    { label: '6M RETURN',  value: fmtPct(data().sector_return_6m),  color: Number(data().sector_return_6m)  >= 0 ? 'text-emerald-500' : 'text-red-500', border: Number(data().sector_return_6m)  >= 0 ? 'border-emerald-500' : 'border-red-500' },
                    { label: 'P/E RATIO',  value: data().pe_ratio ? Number(data().pe_ratio).toFixed(2) : '—', color: 'text-text_accent',    border: 'border-text_accent/30' },
                    { label: 'INDUSTRIES', value: `${data().industries?.length || 0}`,                   color: 'text-text_accent',    border: 'border-text_accent/30' },
                  ]}>
                    {(card) => (
                      <div class={`bg-bg_header/30 border-l-2 ${card.border} p-4`}>
                        <div class="text-[8px] text-text_secondary/40 font-black uppercase tracking-widest mb-1">{card.label}</div>
                        <div class={`text-[22px] font-black font-mono leading-none ${card.color}`}>{card.value}</div>
                      </div>
                    )}
                  </For>
                </div>

                {/* SPARKLINE CHART */}
                <div class="bg-bg_header/20 border border-border_main p-4">
                  <div class="flex justify-between items-center mb-2">
                    <span class="text-[9px] font-black text-text_accent uppercase tracking-widest">6M PERFORMANCE TRAJECTORY // {selectedSector()?.etf} ETF PROXY</span>
                    <span class={`text-[10px] font-black font-mono ${data().sector_return_3m >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      3M: {data().sector_return_3m >= 0 ? '+' : ''}{data().sector_return_3m?.toFixed(2)}%
                    </span>
                  </div>
                  <div class="h-[200px]">
                    <SectorChart data={data().sparkline || []} />
                  </div>
                </div>

                {/* INDUSTRY HEATMAP OVERVIEW */}
                <div class="bg-bg_header/20 border border-border_main p-4 flex flex-col h-[450px]">
                  <div class="flex justify-between items-center mb-3">
                    <span class="text-[9px] font-black text-text_accent uppercase tracking-widest">INDUSTRY PERFORMANCE MATRIX</span>
                    <span class="text-[7px] text-text_secondary/30 font-mono uppercase tracking-[0.2em]">INTRA-SECTOR_NODE_ANALYSIS</span>
                  </div>
                  <div class="flex-1">
                    <IndustryPerformanceHeatmap data={data().industries || []} />
                  </div>
                </div>
              </div>
            </Show>

            {/* ── TAB: INDUSTRIES ── */}
            <Show when={activeTab() === 'industries'}>
              <div class="p-4 space-y-2">
                <For each={(data().industries || []).sort((a,b) => b.industry_return_ytd - a.industry_return_ytd)}>
                  {(ind) => (
                    <div class="bg-bg_header/20 border border-border_main overflow-hidden">
                      <div
                        onClick={() => setActiveIndustry(activeIndustry() === ind.industry_name ? null : ind.industry_name)}
                        class="flex items-center gap-4 p-3 cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <div class={`w-1.5 h-1.5 rounded-full ${ind.industry_return_ytd >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <div class="flex-1">
                          <div class="text-[11px] font-black text-text_primary uppercase">{ind.industry_name}</div>
                          <div class="text-[8px] text-text_secondary/40 font-mono uppercase">{ind.companies?.length || 0} LISTED COMPANIES</div>
                        </div>
                        <PerfBar value={ind.industry_return_ytd} />
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveIndustry(ind.industry_name); setActiveTab('companies'); }}
                          class="text-[7px] font-black text-text_secondary/30 hover:text-text_accent border border-border_main/20 hover:border-text_accent/30 px-2 py-1 uppercase transition-all"
                        >
                          VIEW_COMPANIES ▶
                        </button>
                        <span class={`text-[9px] font-black opacity-30 transition-transform ${activeIndustry() === ind.industry_name ? 'rotate-90' : ''}`}>▶</span>
                      </div>

                      <Show when={activeIndustry() === ind.industry_name && ind.companies?.length > 0}>
                        <div class="border-t border-border_main/10 flex flex-col">
                          {/* Intra-industry company heatmap */}
                          <div class="h-[150px] w-full border-b border-border_main/10 p-1">
                            <CompanyHeatmap data={ind.companies || []} />
                          </div>
                          
                          <table class="w-full text-left border-collapse">
                            <thead class="bg-black/20 text-[7px] font-black text-text_secondary/30 uppercase tracking-widest">
                              <tr>
                                <th class="p-2 pl-8">COMPANY</th>
                                <th class="p-2 text-right">WEIGHT</th>
                                <th class="p-2 text-right">LAST_PRICE</th>
                                <th class="p-2 text-right">YTD</th>
                                <th class="p-2 text-right">TARGET</th>
                                <th class="p-2 text-right">RATING</th>
                                <th class="p-2"></th>
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-border_main/5">
                              <For each={ind.companies.slice(0, 15)}>
                                {(c) => (
                                  <tr
                                    onClick={() => navigateToEntity(c.symbol)}
                                    class="hover:bg-white/5 cursor-pointer transition-colors group"
                                  >
                                    <td class="p-2 pl-8">
                                      <div class="flex flex-col">
                                        <span class="text-[10px] font-black text-text_accent group-hover:text-white transition-colors">{c.symbol}</span>
                                        <span class="text-[8px] text-text_secondary/40 truncate max-w-[200px]">{fmtName(c.name, c.symbol)}</span>
                                      </div>
                                    </td>
                                    <td class="p-2 text-right text-[8px] font-mono text-text_secondary/40">{fmtWeight(c.market_weight)}</td>
                                    <td class="p-2 text-right text-[9px] font-mono text-text_primary/70">{fmtPrice(c.last_price)}</td>
                                    <td class={`p-2 text-right text-[10px] font-black font-mono ${c.ytd_return > 0 ? 'text-emerald-500' : c.ytd_return < 0 ? 'text-red-500' : 'text-text_secondary/40'}`}>
                                      {c.ytd_return != null ? fmtPct(c.ytd_return) : '—'}
                                    </td>
                                    <td class="p-2 text-right text-[9px] font-mono text-blue-400/70">{fmtPrice(c.target_price)}</td>
                                    <td class={`p-2 text-right text-[7px] font-black uppercase tracking-wide ${ratingCls(c.rating)}`}>{fmtRating(c.rating)}</td>
                                    <td class="p-2 pr-4 text-right">
                                      <span class="text-[7px] text-text_accent/0 group-hover:text-text_accent/60 font-black uppercase tracking-widest transition-colors">INTEL ▶</span>
                                    </td>
                                  </tr>
                                )}
                              </For>
                            </tbody>
                          </table>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* ── TAB: COMPANIES ── */}
            <Show when={activeTab() === 'companies'}>
              <div class="p-4 space-y-3">
                {/* Heatmap Visualizer */}
                <div class="h-[300px] w-full bg-bg_header/20 border border-border_main overflow-hidden flex flex-col">
                  <div class="px-3 py-1.5 border-b border-border_main bg-bg_main/5 flex justify-between items-center">
                    <span class="text-[8px] font-black tracking-widest text-text_accent uppercase">ASSET_CONCENTRATION_HEATMAP</span>
                    <span class="text-[7px] text-text_secondary/30 font-bold uppercase tracking-tighter">NODE_COUNT: {visibleCompanies().length} ENTITIES</span>
                  </div>
                  <div class="flex-1 p-1">
                    <CompanyHeatmap data={visibleCompanies()} />
                  </div>
                </div>

                {/* Filters */}
                <div class="flex flex-wrap gap-2 items-center">
                  <div class="relative">
                    <input
                      type="text"
                      value={searchQ()}
                      onInput={e => setSearchQ(e.target.value)}
                      placeholder="SEARCH_SYMBOL / COMPANY..."
                      class="bg-bg_header border border-border_main pl-8 pr-4 py-2 text-[9px] font-mono text-text_primary placeholder:text-text_secondary/30 outline-none focus:border-text_accent/50 w-64 uppercase transition-all"
                    />
                    <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text_secondary/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                    </svg>
                  </div>

                  {/* Industry filter pills */}
                  <div class="flex gap-1 flex-wrap">
                    <button
                      onClick={() => setActiveIndustry(null)}
                      class={`px-2 py-1 text-[7px] font-black uppercase border transition-all ${!activeIndustry() ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main/30 text-text_secondary/40 hover:text-text_primary'}`}
                    >
                      ALL ({data().all_companies?.length || 0})
                    </button>
                    <For each={data().industries || []}>
                      {(ind) => (
                        <button
                          onClick={() => setActiveIndustry(ind.industry_name)}
                          class={`px-2 py-1 text-[7px] font-black uppercase border transition-all ${activeIndustry() === ind.industry_name ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main/30 text-text_secondary/40 hover:text-text_primary'}`}
                        >
                          {ind.industry_name.split(' ').slice(0,2).join(' ')} ({ind.companies?.length || 0})
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Company Table */}
                <div class="bg-bg_header/20 border border-border_main overflow-hidden">
                  <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-bg_header z-10 border-b border-border_main">
                      <tr class="text-[8px] font-black text-text_secondary/40 uppercase tracking-widest">
                        <th class="p-3 pl-4">COMPANY</th>
                        <th class="p-3">INDUSTRY</th>
                        <th class="p-3 text-right">WEIGHT</th>
                        <th class="p-3 text-right">LAST_PRICE</th>
                        <th
                          onClick={() => toggleSort('ytd_return')}
                          class="p-3 text-right cursor-pointer hover:text-text_accent transition-colors select-none"
                        >
                          YTD_RTN {sortBy() === 'ytd_return' ? (sortDir() > 0 ? '▲' : '▼') : '↕'}
                        </th>
                        <th class="p-3 text-right">TARGET</th>
                        <th
                          onClick={() => toggleSort('rating')}
                          class="p-3 text-right cursor-pointer hover:text-text_accent transition-colors select-none"
                        >
                          RATING {sortBy() === 'rating' ? (sortDir() > 0 ? '▲' : '▼') : ''}
                        </th>
                        <th class="p-3 pr-4"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border_main/10">
                      <For each={visibleCompanies()}>
                        {(c) => (
                          <tr
                            onClick={() => navigateToEntity(c.symbol)}
                            class="hover:bg-white/5 cursor-pointer transition-colors group"
                          >
                            <td class="p-3 pl-4">
                              <div class="flex flex-col">
                                <span class="text-[11px] font-black text-text_accent group-hover:text-white transition-colors">{c.symbol}</span>
                                <span class="text-[8px] text-text_secondary/40 truncate max-w-[200px]">{fmtName(c.name, c.symbol)}</span>
                              </div>
                            </td>
                            <td class="p-3 text-[8px] text-text_secondary/40 font-bold uppercase truncate max-w-[120px]">{c.industry}</td>
                            <td class="p-3 text-right text-[8px] font-mono text-text_secondary/40">{fmtWeight(c.market_weight)}</td>
                            <td class="p-3 text-right text-[9px] font-mono text-text_primary/70">{fmtPrice(c.last_price)}</td>
                            <td class={`p-3 text-right text-[11px] font-black font-mono ${c.ytd_return > 0 ? 'text-emerald-500' : c.ytd_return < 0 ? 'text-red-500' : 'text-text_secondary/40'}`}>
                              {c.ytd_return != null ? fmtPct(c.ytd_return) : '—'}
                            </td>
                            <td class="p-3 text-right text-[9px] font-mono text-blue-400/60">{fmtPrice(c.target_price)}</td>
                            <td class={`p-3 text-right text-[8px] font-black uppercase tracking-wide ${ratingCls(c.rating)}`}>{fmtRating(c.rating)}</td>
                            <td class="p-3 pr-4 text-right">
                              <span class="text-[7px] font-black text-text_accent/0 group-hover:text-text_accent/60 uppercase tracking-widest transition-all">DEEP_INTEL ▶</span>
                            </td>
                          </tr>
                        )}
                      </For>
                      <Show when={visibleCompanies().length === 0}>
                        <tr><td colspan="8" class="p-10 text-center text-[9px] text-text_secondary/30 uppercase">NO_ENTITIES_MATCHING_FILTER</td></tr>
                      </Show>
                    </tbody>
                  </table>
                </div>
              </div>
            </Show>

            {/* ── TAB: MOVERS ── */}
            <Show when={activeTab() === 'movers'}>
              <div class="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Top Gainers */}
                <div class="bg-bg_header/20 border border-border_main overflow-hidden">
                  <div class="bg-emerald-900/20 border-b border-emerald-500/20 px-4 py-2 flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span class="text-[9px] font-black text-emerald-400 uppercase tracking-widest">TOP_GAINERS // YTD</span>
                  </div>
                  <table class="w-full border-collapse">
                    <thead class="text-[7px] font-black text-text_secondary/30 uppercase tracking-widest">
                      <tr>
                        <th class="p-2 pl-4 text-left">#</th>
                        <th class="p-2 text-left">COMPANY</th>
                        <th class="p-2 text-left">INDUSTRY</th>
                        <th class="p-2 text-right">LAST</th>
                        <th class="p-2 text-right">RATING</th>
                        <th class="p-2 text-right pr-4">YTD</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border_main/10">
                      <For each={data().top_movers || []}>
                        {(c, i) => (
                          <tr
                            onClick={() => navigateToEntity(c.symbol)}
                            class="hover:bg-emerald-500/5 cursor-pointer transition-colors group"
                          >
                            <td class="p-2 pl-4 text-[9px] font-black text-text_secondary/40">{i() + 1}</td>
                            <td class="p-2">
                              <div class="flex flex-col">
                                <span class="text-[10px] font-black text-emerald-400 group-hover:text-emerald-300">{c.symbol}</span>
                                <span class="text-[7px] text-text_secondary/30 truncate max-w-[140px]">{fmtName(c.name, c.symbol)}</span>
                              </div>
                            </td>
                            <td class="p-2 text-[7px] text-text_secondary/30 uppercase truncate max-w-[100px]">{c.industry}</td>
                            <td class="p-2 text-right text-[8px] font-mono text-text_primary/60">{fmtPrice(c.last_price)}</td>
                            <td class={`p-2 text-right text-[7px] font-black uppercase ${ratingCls(c.rating)}`}>{fmtRating(c.rating)}</td>
                            <td class="p-2 text-right pr-4 text-[12px] font-black font-mono text-emerald-500">
                              {fmtPct(c.ytd_return)}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>

                {/* Top Losers */}
                <div class="bg-bg_header/20 border border-border_main overflow-hidden">
                  <div class="bg-red-900/20 border-b border-red-500/20 px-4 py-2 flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span class="text-[9px] font-black text-red-400 uppercase tracking-widest">TOP_LOSERS // YTD</span>
                  </div>
                  <table class="w-full border-collapse">
                    <thead class="text-[7px] font-black text-text_secondary/30 uppercase tracking-widest">
                      <tr>
                        <th class="p-2 pl-4 text-left">#</th>
                        <th class="p-2 text-left">COMPANY</th>
                        <th class="p-2 text-left">INDUSTRY</th>
                        <th class="p-2 text-right">LAST</th>
                        <th class="p-2 text-right">RATING</th>
                        <th class="p-2 text-right pr-4">YTD</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border_main/10">
                      <For each={data().top_losers || []}>
                        {(c, i) => (
                          <tr
                            onClick={() => navigateToEntity(c.symbol)}
                            class="hover:bg-red-500/5 cursor-pointer transition-colors group"
                          >
                            <td class="p-2 pl-4 text-[9px] font-black text-text_secondary/40">{i() + 1}</td>
                            <td class="p-2">
                              <div class="flex flex-col">
                                <span class="text-[10px] font-black text-red-400 group-hover:text-red-300">{c.symbol}</span>
                                <span class="text-[7px] text-text_secondary/30 truncate max-w-[140px]">{fmtName(c.name, c.symbol)}</span>
                              </div>
                            </td>
                            <td class="p-2 text-[7px] text-text_secondary/30 uppercase truncate max-w-[100px]">{c.industry}</td>
                            <td class="p-2 text-right text-[8px] font-mono text-text_primary/60">{fmtPrice(c.last_price)}</td>
                            <td class={`p-2 text-right text-[7px] font-black uppercase ${ratingCls(c.rating)}`}>{fmtRating(c.rating)}</td>
                            <td class={`p-2 text-right pr-4 text-[12px] font-black font-mono ${c.ytd_return >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {fmtPct(c.ytd_return)}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>
            </Show>

            {/* ── TAB: NEWS ── */}
            <Show when={activeTab() === 'news'}>
              <div class="p-4">
                <div class="bg-bg_header/20 border border-border_main overflow-hidden">
                  <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-bg_header z-10 border-b border-border_main">
                      <tr class="text-[8px] font-black text-text_secondary/40 uppercase tracking-widest">
                        <th class="p-3 pl-4 w-24">DATE</th>
                        <th class="p-3">NEWS_TITLE</th>
                        <th class="p-3 w-32">SOURCE</th>
                        <th class="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border_main/10">
                      <Show when={sectorNews().length === 0}>
                        <tr>
                          <td colspan="4" class="p-10 text-center">
                            <span class="text-[9px] text-text_secondary/30 font-mono uppercase animate-pulse">INGESTING_SECTOR_INTELLIGENCE_STREAM...</span>
                          </td>
                        </tr>
                      </Show>
                      <For each={sectorNews()}>
                        {(article, i) => (
                          <>
                            <tr
                              onClick={() => setExpandedNews(expandedNews() === i() ? null : i())}
                              class="hover:bg-white/[0.03] cursor-pointer transition-colors group border-l-2 border-transparent hover:border-text_accent"
                            >
                              <td class="p-3 pl-4 text-[9px] font-mono text-text_secondary/50">
                                {article.timestamp ? new Date(article.timestamp * 1000).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) : '—'}
                              </td>
                              <td class="p-3">
                                <div class="text-[11px] font-bold text-text_primary leading-snug group-hover:text-text_accent transition-colors py-1">
                                  {article.title}
                                </div>
                              </td>
                              <td class="p-3">
                                <span class="text-[7px] font-black text-text_accent/60 uppercase tracking-widest border border-text_accent/20 px-1.5 py-0.5 rounded-sm bg-text_accent/5 whitespace-nowrap">
                                  {article.source || article.publisher || 'INTEL'}
                                </span>
                              </td>
                              <td class="p-3 text-right pr-4">
                                <span class={`inline-block text-[8px] transition-transform duration-300 ${expandedNews() === i() ? 'rotate-90 text-text_accent' : 'text-text_secondary/20'}`}>▶</span>
                              </td>
                            </tr>
                            {/* EXPANDABLE SUB-ROW */}
                            <Show when={expandedNews() === i()}>
                              <tr class="bg-black/40">
                                <td colspan="4" class="p-0">
                                  <div class="px-16 py-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                    <div class="max-w-4xl">
                                      <div class="flex items-center gap-2 mb-3">
                                        <div class="w-1 h-3 bg-text_accent" />
                                        <span class="text-[8px] font-black text-text_accent uppercase tracking-[0.2em]">INTEL_SUMMARY_REPORT</span>
                                      </div>
                                      <p
                                        class="text-[11px] text-text_secondary/70 leading-relaxed font-medium"
                                        innerHTML={article.summary || article.description || 'No detailed intelligence summary available for this entry. Please refer to the source document for full details.'}
                                      />
                                    </div>
                                    <div class="flex items-center gap-4">
                                      <a
                                        href={article.link || article.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="flex items-center gap-2 px-3 py-1.5 bg-text_accent/10 border border-text_accent/30 hover:bg-text_accent/20 text-text_accent text-[8px] font-black uppercase tracking-widest transition-all no-underline"
                                      >
                                        ACCESS_ORIGINAL_DOCUMENT
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                                        </svg>
                                      </a>
                                      <span class="text-[8px] text-text_secondary/20 font-mono tracking-tighter">SOURCE_UUID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </Show>
                          </>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>
            </Show>


          </div>
        </Show>
      </div>
    );
  };

  return (
    <div class="flex-1 flex flex-col overflow-hidden bg-bg_main">
      <Show when={selectedSector()} fallback={<OverviewPanel />}>
        <DetailPanel />
      </Show>
    </div>
  );
}
