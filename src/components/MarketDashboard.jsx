import { createSignal, onMount, For, Show, createEffect } from 'solid-js';
import * as echarts from 'echarts';

// --- SERVICE RECTORS ---
const SENTIMENT_API = import.meta.env.VITE_SENTIMENT_API || `${import.meta.env.VITE_SENTIMENT_URL}/api/sentiment/summary-all`;
const CRYPTO_API = import.meta.env.VITE_CRYPTO_API || import.meta.env.VITE_CRYPTO_API;
const FOREX_API_BASE = import.meta.env.VITE_FOREX_API || import.meta.env.VITE_FOREX_API;
const MACRO_NEWS_API = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE;
const DASHBOARD_API = import.meta.env.VITE_DASHBOARD_API;
const MARKET_API = import.meta.env.VITE_MARKET_API;


// --- TRADINGVIEW WIDGET HELPERS ---
function SentimentHeatmap(props) {
  let chartRef;
  let chart;

  onMount(() => {
    chart = echarts.init(chartRef);
    const handleResize = () => chart && chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart?.dispose();
    };
  });

  createEffect(() => {
    if (props.data && chart) {
      const option = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          formatter: (info) => {
            const d = info.data;
            if (!d || d.positive_pct === undefined) return '';
            return `
              <div style="font-family: 'Roboto', sans-serif; font-size: 10px; color: #fff; background: #0a0a0a; border: 1px solid #333; padding: 10px; border-radius: 4px;">
                <div style="font-weight: 900; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 5px; color: #00ff41;">${d.name}</div>
                <div style="display: flex; justify-content: space-between; gap: 20px;">
                  <span>POSITIVE:</span>
                  <span style="color: #10b981; font-weight: bold;">${d.positive_pct.toFixed(1)}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 20px;">
                  <span>NEUTRAL:</span>
                  <span style="color: #64748b; font-weight: bold;">${d.neutral_pct.toFixed(1)}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 20px;">
                  <span>NEGATIVE:</span>
                  <span style="color: #ef4444; font-weight: bold;">${d.negative_pct.toFixed(1)}%</span>
                </div>
                <div style="margin-top: 8px; border-top: 1px solid #222; padding-top: 5px; font-weight: 900; font-size: 11px; text-align: center; color: ${d.score >= 0 ? '#10b981' : '#ef4444'}">
                  SCORE: ${d.score.toFixed(1)}
                </div>
              </div>
            `;
          }
        },
        series: [{
          type: 'treemap',
          id: 'sentiment',
          data: props.data
            .filter(d => d.category !== 'Indonesia')
            .map(d => ({
              name: d.category,
              value: d.total,
              positive_pct: d.positive_pct,
              neutral_pct: d.neutral_pct,
              negative_pct: d.negative_pct,
              score: d.score,
              itemStyle: {
                color: d.score > 20 ? '#059669' :
                  d.score > 5 ? '#10b981' :
                    d.score > -5 ? '#334155' :
                      d.score > -20 ? '#dc2626' : '#991b1b',
                borderColor: '#000',
                borderWidth: 1
              }
            })),
          label: {
            show: true,
            formatter: (params) => {
              const d = params.data;
              if (!d || d.positive_pct === undefined) return params.name;

              const pcts = [
                { label: 'POS', val: d.positive_pct || 0 },
                { label: 'NEU', val: d.neutral_pct || 0 },
                { label: 'NEG', val: d.negative_pct || 0 }
              ];
              const dominant = pcts.sort((a, b) => b.val - a.val)[0];

              return `${params.name}\n${dominant.label}: ${dominant.val.toFixed(0)}%`;
            },
            fontSize: 9,
            fontWeight: '900',
            color: '#fff',
            lineHeight: 12
          },
          upperLabel: { show: false },
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          width: '100%',
          height: '100%'
        }]
      };
      chart.setOption(option);
    }
  });

  return <div ref={chartRef} class="w-full h-full" />;
}

// --- INDUSTRY PERFORMANCE HEATMAP ---
function IndustryHeatmap(props) {
  let chartRef;
  let chart;

  onMount(() => {
    chart = echarts.init(chartRef);
    const handleResize = () => chart && chart.resize();
    
    chart.on('click', (params) => {
      if (params.data && params.data.sector && props.onSelect) {
        props.onSelect(params.data.sector);
      }
    });

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart?.dispose();
    };
  });

  createEffect(() => {
    if (props.data && chart) {
      const option = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          formatter: (info) => {
            const d = info.data;
            return `
              <div style="font-family: 'Inter', sans-serif; font-size: 11px; color: #fff; background: #000; border: 1px solid #333; padding: 8px; border-radius: 2px;">
                <div style="font-weight: 900; color: #aaa; margin-bottom: 4px; font-size: 9px; letter-spacing: 0.1em; border-bottom: 1px solid #222; padding-bottom: 4px;">${d.isSector ? 'SECTOR' : d.sector}</div>
                <div style="font-weight: bold; color: #fff; margin-bottom: 8px;">${d.name}</div>
                <div style="display: flex; justify-content: space-between; gap: 20px;">
                  <span style="opacity: 0.6">YTD PERFORMANCE:</span>
                  <span style="color: ${d.return >= 0 ? '#10b981' : '#ef4444'}; font-weight: 900;">${d.return >= 0 ? '+' : ''}${d.return.toFixed(2)}%</span>
                </div>
                ${d.isSector ? '<div style="margin-top: 5px; font-size: 8px; color: #text_accent; opacity: 0.6;">CLICK FOR DETAILS</div>' : ''}
              </div>
            `;
          }
        },
        series: [{
          type: 'treemap',
          breadcrumb: { show: false },
          roam: false,
          nodeClick: false, // We handle click manually
          data: props.data.map(d => {
            const ret = d.industry_return_ytd !== undefined ? d.industry_return_ytd : d.sector_return_ytd;
            return {
              name: d.industry && d.industry !== 'N/A' ? d.industry : d.sector,
              value: Math.abs(ret) || 1,
              return: ret || 0,
              sector: d.sector,
              isSector: !d.industry || d.industry === 'N/A',
              itemStyle: {
                color: (ret > 0) ? (
                  ret > 5 ? '#064e3b' :
                  ret > 2 ? '#065f46' : '#059669'
                ) : (ret < 0) ? (
                  ret < -5 ? '#450a0a' :
                  ret < -2 ? '#7f1d1d' : '#991b1b'
                ) : '#334155',
                borderColor: '#000',
                borderWidth: 2,
                gapWidth: 1
              },
              label: {
                show: true,
                formatter: (params) => {
                  const r = params.data.return;
                  return `${params.name}\n${r >= 0 ? '+' : ''}${r.toFixed(2)}%`;
                },
                fontSize: 10,
                fontWeight: '900',
                fontFamily: 'Inter',
                lineHeight: 14
              }
            };
          }),
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }]
      };
      chart.setOption(option);
    }
  });

  return <div ref={chartRef} class="w-full h-full" />;
}

// --- SECTOR PERFORMANCE COMPONENT ---
function SectorPerformanceView() {
  const [data, setData] = createSignal([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [expandedSectors, setExpandedSectors] = createSignal(new Set());
  const [selectedSector, setSelectedSector] = createSignal(null);

  onMount(async () => {
    try {
      const res = await fetch(`${MARKET_API}/api/market/sectors`).then(r => r.json());
      if (res.status === 'success') {
        setData(res.data);
      }
    } catch (e) {
      console.error("Sector fetch failed", e);
    } finally {
      setIsLoading(false);
    }
  });

  const grouped = () => {
    const map = {};
    data().forEach(item => {
      if (!map[item.sector]) {
        map[item.sector] = { 
          name: item.sector, 
          return: item.sector_return_ytd, 
          industries: [] 
        };
      }
      map[item.sector].industries.push(item);
    });
    return Object.values(map).sort((a, b) => b.return - a.return);
  };

  const toggleExpand = (sectName) => {
    const next = new Set(expandedSectors());
    if (next.has(sectName)) next.delete(sectName);
    else next.add(sectName);
    setExpandedSectors(next);
  };

  const heatmapData = () => {
    if (!selectedSector()) {
      // Aggregate by sector for top-level view
      const map = {};
      data().forEach(d => {
        if (!map[d.sector]) {
          map[d.sector] = {
            sector: d.sector,
            industry: 'N/A',
            sector_return_ytd: d.sector_return_ytd
          };
        }
      });
      return Object.values(map);
    }
    return data().filter(d => d.sector === selectedSector());
  };

  return (
    <div class="flex flex-col h-full bg-black/20 p-4 gap-4 animate-in fade-in duration-500">
      <div class="grid grid-cols-12 gap-4 h-full">
        {/* Master Table */}
        <div class="col-span-12 lg:col-span-7 bg-bg_header/30 border border-border_main flex flex-col overflow-hidden">
          <div class="px-3 py-2 border-b border-border_main bg-bg_main/5 flex justify-between items-center">
            <span class="text-[9px] font-black tracking-widest text-text_accent uppercase">SECTOR OVERVIEW</span>
            <div class="flex gap-2">
               <span class="text-[7px] text-text_secondary/40 font-bold uppercase">11 SECTORS</span>
               <div class="w-1 h-3 bg-text_accent"></div>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto scrollbar-thin">
            <table class="w-full border-collapse text-left">
              <thead class="sticky top-0 bg-bg_header z-10 border-b border-border_main">
                <tr class="text-[8px] font-black text-text_secondary opacity-40 uppercase">
                  <th class="p-3 pl-6">SECTOR / INDUSTRY</th>
                  <th class="p-3 text-right pr-6">PERFORMANCE (YTD)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border_main/10">
                <For each={grouped()}>
                  {(sect) => (
                    <>
                      <tr 
                        onClick={() => { toggleExpand(sect.name); setSelectedSector(sect.name); }}
                        class={`cursor-pointer hover:bg-white/5 transition-all group ${selectedSector() === sect.name ? 'bg-text_accent/5 border-l-2 border-l-text_accent' : ''}`}
                      >
                        <td class="p-4 pl-6 flex items-center gap-3">
                          <div class={`w-1.5 h-1.5 rounded-full ${sect.return >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                          <span class="text-[11px] font-black text-text_primary uppercase tracking-wider">{sect.name}</span>
                          <span class={`text-[8px] font-bold ${expandedSectors().has(sect.name) ? 'rotate-90' : ''} transition-transform opacity-30`}>▶</span>
                        </td>
                        <td class={`p-4 text-right pr-6 text-[12px] font-black font-mono ${sect.return >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {sect.return >= 0 ? '+' : ''}{sect.return.toFixed(2)}%
                        </td>
                      </tr>
                      <Show when={expandedSectors().has(sect.name)}>
                        <For each={sect.industries.sort((a,b) => (b.industry_return_ytd || 0) - (a.industry_return_ytd || 0))}>
                          {(ind) => {
                            const iRet = ind.industry_return_ytd || 0;
                            const sRet = ind.sector_return_ytd || 0;
                            // Fallback to sector return only if industry return is precisely 0 and we want to show 'something' 
                            // though with the backend fix this is less needed now.
                            const displayRet = (iRet === 0 && sRet !== 0) ? sRet : iRet;
                            
                            return (
                              <tr class="bg-black/40 border-l-2 border-border_main/10 hover:bg-white/[0.03] transition-colors group/ind animate-in slide-in-from-left-2 duration-300">
                                <td class="p-3 pl-12 flex items-center gap-3">
                                  <div class="w-1 h-3 bg-border_main/20"></div>
                                  <span class="text-[10px] text-text_secondary/60 font-black uppercase tracking-tighter group-hover/ind:text-text_secondary transition-colors truncate">
                                    {ind.industry}
                                  </span>
                                </td>
                                <td class="p-3 text-right pr-6">
                                  <div class="flex items-center justify-end gap-3">
                                    <div class="w-16 h-1 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                                      <div 
                                        class={`h-full ${displayRet >= 0 ? 'bg-emerald-500/40' : 'bg-red-500/40'}`}
                                        style={{ width: `${Math.min(Math.abs(displayRet) * 4, 100)}%` }}
                                      />
                                    </div>
                                    <span class={`text-[10px] font-mono font-black ${displayRet >= 0 ? 'text-emerald-500/70' : 'text-red-400/70'}`}>
                                      {displayRet >= 0 ? '+' : ''}{displayRet.toFixed(2)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          }}
                        </For>
                      </Show>
                    </>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Heatmap */}
        <div class="col-span-12 lg:col-span-5 flex flex-col gap-4">
          <div class="flex-1 bg-bg_header/30 border border-border_main flex flex-col overflow-hidden relative group">
            <div class="px-4 py-2 border-b border-border_main flex justify-between items-center bg-bg_main/5">
              <span class="text-[9px] font-black tracking-widest text-text_secondary uppercase">MARKET HEATMAP</span>
              <Show when={selectedSector()}>
                <span class="text-[8px] bg-text_accent/10 border border-text_accent/30 text-text_accent px-2 py-0.5 rounded font-black uppercase tracking-widest animate-pulse">
                  FOCUS: {selectedSector()}
                </span>
                <button 
                  onClick={() => setSelectedSector(null)}
                  class="text-[7px] text-text_secondary hover:text-text_accent border border-border_main px-2 py-0.5 uppercase font-bold transition-colors"
                >
                  [Reset View]
                </button>
              </Show>
            </div>
            <div class="flex-1 p-2">
              <IndustryHeatmap data={heatmapData()} onSelect={(s) => setSelectedSector(s)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// --- TRADINGVIEW WIDGET HELPERS ---
function TradingViewWidget(props) {
  let containerRef;
  const uniqueId = `tv-widget-${Math.random().toString(36).substr(2, 9)}`;

  createEffect(() => {
    if (containerRef) {
      // Clear existing content safely
      containerRef.innerHTML = '';

      // Create a dedicated div for TV
      const widgetDiv = document.createElement('div');
      widgetDiv.id = uniqueId;
      widgetDiv.className = 'tradingview-widget-container__widget';
      containerRef.appendChild(widgetDiv);

      const script = document.createElement('script');
      script.src = props.scriptSrc;
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = JSON.stringify({
        ...props.config,
        container_id: uniqueId
      });

      // Error handling for script loading
      script.onerror = () => console.error(`[TV_RECOGNITION_ERR] Failed to load widget: ${props.scriptSrc}`);

      containerRef.appendChild(script);
    }
  });

  return (
    <div ref={containerRef} class="tradingview-widget-container w-full h-full">
      <div class="tradingview-widget-copyright invisible absolute">TradingView Widgets</div>
    </div>
  );
}

export default function MarketDashboard(props) {
  const [activeTab, setActiveTab] = createSignal('OVERVIEW');
  const [activeHeatmap, setActiveHeatmap] = createSignal('AllID');
  const [currentTime, setCurrentTime] = createSignal(new Date());

  const [cryptoMovers, setCryptoMovers] = createSignal([]);
  const [forexMovers, setForexMovers] = createSignal([]);
  const [macroNews, setMacroNews] = createSignal([]);
  const [sentimentSummary, setSentimentSummary] = createSignal([]);
  const [aiVerdicts, setAiVerdicts] = createSignal([]);
  const [isLoading, setIsLoading] = createSignal(true);


  onMount(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchGlobalIntelligence();
    return () => clearInterval(timer);
  });

  const fetchGlobalIntelligence = async () => {
    setIsLoading(true);
    try {
      console.log("%c[SYSTEM] Syncing Market Data...", 'color: #10b981; font-weight: bold');
      const [cRes, fRes, nRes, sRes] = await Promise.all([
        fetch(`${CRYPTO_API}/api/crypto/top?top=15`).then(r => r.json()).catch(e => { console.error("Crypto Fetch Failed:", e); return { status: 'error' }; }),
        fetch(`${FOREX_API_BASE}/api/forex/list`).then(r => r.json()).catch(e => { console.error("Forex Fetch Failed:", e); return { status: 'error' }; }),
        // Using ultra-fast SQLite preload for Economy category
        fetch(`${DASHBOARD_API}/api/dashboard/news-preload?category=INVESTASI`).then(r => r.json()).catch(e => { console.error("Macro Fetch Failed:", e); return { status: 'error' }; }),
        fetch(SENTIMENT_API).then(r => r.json()).catch(e => { console.error("Sentiment Fetch Failed:", e); return { status: 'error' }; })
      ]);

      const freshData = {
        crypto: [],
        forex: [],
        macro: [],
        ai: []
      };

      if (cRes.status === 'success') {
        freshData.crypto = cRes.data.slice(0, 15);
        setCryptoMovers(freshData.crypto);

        const topSymbols = cRes.data.slice(0, 5).map(c => c.symbol);
        const aiResults = await Promise.all(topSymbols.map(s =>
          fetch(`${import.meta.env.VITE_CRYPTO_API}/api/ai/analyze?symbol=${s}`).then(r => r.json()).catch(() => null)
        ));

        freshData.ai = aiResults.filter(r => r && r.status === 'success').map(r => ({
          symbol: r.data.symbol,
          action: r.data.agents.strategy.action,
          summary: r.data.summary.slice(0, 80) + "..."
        }));
        setAiVerdicts(freshData.ai);
      }

      // Handle forex status=loading (cache warming up)
      if (fRes.status === 'success') {
        freshData.forex = fRes.data.slice(0, 15);
        setForexMovers(freshData.forex);
      } else if (fRes.status === 'loading') {
        console.info('[MARKET_FE] Forex cache warming up...');
      }

      if (nRes.status === 'success') {
        freshData.macro = (nRes.data || nRes.results || []).slice(0, 5);
        setMacroNews(freshData.macro);
      }

      if (sRes.status === 'success') {
        setSentimentSummary(sRes.data);
      }

    } catch (err) {
      console.error("Critical Intelligence Sync Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const worldClocks = [
    { city: 'NEW YORK', zone: 'America/New_York', market: 'NYSE' },
    { city: 'LONDON', zone: 'Europe/London', market: 'LSE' },
    { city: 'TOKYO', zone: 'Asia/Tokyo', market: 'TSE' },
    { city: 'SYDNEY', zone: 'Australia/Sydney', market: 'ASX' },
    { city: 'FRANKFURT', zone: 'Europe/Berlin', market: 'DAX' },
    { city: 'HONG KONG', zone: 'Asia/Hong_Kong', market: 'HKEX' },
    { city: 'SINGAPORE', zone: 'Asia/Singapore', market: 'SGX' },
    { city: 'JAKARTA', zone: 'Asia/Jakarta', market: 'IDX' }
  ];

  const formatZoneTime = (zone) => currentTime().toLocaleTimeString('en-US', { timeZone: zone, hour12: false, hour: '2-digit', minute: '2-digit' });

  return (
    <div class="flex flex-col space-y-6">
      <div class="h-10 border-b border-border_main bg-bg_header/50 flex items-center justify-between px-4 shrink-0 rounded">
        <div class="flex items-center gap-4">
          <nav class="flex items-center gap-1">
            {['OVERVIEW', 'HEATMAPS', 'INTELLIGENCE'].map((tab, idx) => (
              <button
                onClick={() => setActiveTab(tab)}
                class={`px-3 py-1 text-[8px] font-black tracking-widest border transition-all ${activeTab() === tab ? 'bg-text_accent text-bg_main border-text_accent' : 'border-transparent text-text_secondary opacity-40 hover:opacity-100'}`}
              >
                0{idx + 1} {tab}
              </button>
            ))}
          </nav>
        </div>
        <div class="flex items-center gap-4">
          <marquee class="text-[9px] text-text_secondary/40 font-bold uppercase tracking-tighter w-64">
            <For each={aiVerdicts()}>
              {(v) => <span class="mr-10 text-emerald-400">[{v.symbol}]: {v.action} // {v.summary}</span>}
            </For>
          </marquee>
          <button onClick={() => fetchGlobalIntelligence(true)} class="p-1 hover:bg-bg_main/5 rounded transition-colors" title="Force Refresh Deep Intel">
            <svg class={`w-3 h-3 text-text_secondary ${isLoading() ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
          </button>
        </div>
      </div>

      {/* MAIN VIEWPORT */}
      <div class="flex-1 overflow-y-auto win-scroll">

        {/* OVERVIEW TAB: THE UNIFIED COMMAND CENTER */}
        <Show when={activeTab() === 'OVERVIEW'}>
          <div class="p-4 flex flex-col gap-4 animate-in zoom-in-95 duration-700">

            {/* ROW 1: MISSION CONTROL */}
            <div class="grid grid-cols-12 gap-4 h-[350px]">

              {/* COMPONENT: WORLD CLOCK CLUSTER (3/12) */}
              <div class="col-span-12 xl:col-span-3 bg-bg_header/30 border border-border_main flex flex-col overflow-hidden">
                <div class="bg-bg_main/5 px-3 py-2 border-b border-border_main flex items-center justify-between">
                  <span class="text-[8px] font-black tracking-widest text-[#555] uppercase">WORLD CLOCKS</span>
                  <div class="w-1 h-3 bg-blue-500"></div>
                </div>
                <div class="flex-1 overflow-y-auto scrollbar-hide p-2 flex flex-col gap-1">
                  <For each={worldClocks}>
                    {(clock) => (
                      <div class="flex justify-between items-center py-1.5 border-b border-border_main/10 px-1 hover:bg-bg_main/5 transition-colors">
                        <span class="text-[7px] text-text_secondary/80 font-black uppercase tracking-tighter">{clock.city}</span>
                        <span class="text-[10px] text-text_primary font-mono font-bold">{formatZoneTime(clock.zone)}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* COMPONENT: SENTIMENT HEATMAP (5/12) - NEW */}
              <div class="col-span-12 xl:col-span-5 bg-bg_header/30 border border-border_main flex flex-col overflow-hidden">
                <div class="bg-bg_main/5 px-4 py-2 border-b border-border_main flex justify-between items-center">
                  <span class="text-[9px] font-black tracking-widest text-text_accent uppercase">SENTIMENT ANALYSIS</span>
                  <div class="w-1 h-3 bg-text_accent shadow-[0_0_10px_rgba(0,255,65,0.4)]"></div>
                </div>
                <div class="flex-1">
                  <SentimentHeatmap data={sentimentSummary()} />
                </div>
              </div>

              {/* COMPONENT: MACRO NEWS FEED (4/12) */}
              <div class="col-span-12 xl:col-span-4 bg-bg_header/30 border border-border_main flex flex-col overflow-hidden">
                <div class="bg-bg_main/5 px-4 py-2 border-b border-border_main flex justify-between items-center">
                  <span class="text-[9px] font-black tracking-widest text-[#666] uppercase">RECENT NEWS</span>
                  <div class="w-1 h-3 bg-amber-500"></div>
                </div>
                <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin">
                  <For each={macroNews()}>
                    {(news) => (
                      <div class="flex flex-col gap-1 group cursor-pointer border-l border-amber-500/20 pl-3 hover:border-amber-500 transition-all">
                        <span class="text-[7px] text-amber-500 font-black uppercase tracking-widest">{news.source}</span>
                        <h4 class="text-[10px] text-text_primary font-bold leading-tight group-hover:text-amber-200 transition-colors uppercase">{news.title}</h4>
                      </div>
                    )}
                  </For>
                  <Show when={macroNews().length === 0 && !isLoading()}>
                    <div class="text-[9px] text-text_secondary/40 italic p-10 text-center">AWAITING DATA FEED...</div>
                  </Show>
                </div>
              </div>
            </div>

            {/* ROW 2: SECTOR & INDUSTRY ANALYTICS */}
            <div class="h-[550px] border border-border_main bg-bg_header/20">
              <div class="bg-bg_main/5 px-4 py-2 border-b border-border_main flex items-center justify-between">
                <span class="text-[10px] font-black tracking-[0.4em] text-text_accent uppercase">SECTOR PERFORMANCE</span>
                <div class="flex gap-1">
                  <div class="w-1 h-3 bg-text_accent animate-pulse"></div>
                  <div class="w-1 h-3 bg-text_accent opacity-50"></div>
                </div>
              </div>
              <div class="flex-1 h-[calc(100%-35px)]">
                <SectorPerformanceView />
              </div>
            </div>

            {/* ROW 3: CRYPTO & FOREX MARKET GRIDS */}
            <div class="grid grid-cols-12 gap-4">

              <div class="col-span-12 lg:col-span-6 bg-bg_header/40 border border-border_main flex flex-col h-[500px]">
                <div class="bg-bg_main/5 px-4 py-3 border-b border-border_main flex justify-between items-center">
                  <div class="flex items-center gap-3">
                    <div class="w-1 h-3 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
                    <span class="text-[10px] font-black tracking-[0.3em] text-text_primary uppercase">CRYPTO MARKETS</span>
                  </div>
                </div>
                <div class="flex-1 overflow-y-auto scrollbar-thin">
                  <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-bg_header z-10 border-b border-border_main">
                      <tr class="text-[8px] font-black text-text_secondary opacity-40 uppercase">
                        <th class="p-3 pl-6">ASSET</th>
                        <th class="p-3 text-right">PRICE</th>
                        <th class="p-3 text-right">24H CHANGE</th>
                        <th class="p-3 text-right pr-6">MARKET CAP</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border_main/10">
                      <For each={cryptoMovers()}>
                        {(coin) => (
                          <tr class="hover:bg-bg_main/5 transition-colors group">
                            <td class="p-3 pl-6">
                              <div class="flex flex-col">
                                <span class="text-[11px] text-text_primary font-black group-hover:text-orange-400 transition-colors">{coin.symbol}</span>
                                <span class="text-[7px] text-text_secondary/40 font-bold uppercase tracking-widest">{coin.name}</span>
                              </div>
                            </td>
                            <td class="p-3 text-right">
                              <span class="text-[10px] text-text_primary font-mono font-bold">${coin.price < 1 ? coin.price.toFixed(6) : coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </td>
                            <td class={`p-3 text-right text-[10px] font-black ${coin.change_24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {coin.change_24h >= 0 ? '+' : ''}{coin.change_24h.toFixed(2)}%
                            </td>
                            <td class="p-3 text-right pr-6">
                              <span class="text-[9px] text-text_secondary/40 font-mono">${(coin.market_cap / 1e9).toFixed(2)}B</span>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="col-span-12 lg:col-span-6 bg-bg_header/40 border border-border_main flex flex-col h-[500px]">
                <div class="bg-bg_main/5 px-4 py-3 border-b border-border_main flex justify-between items-center">
                  <div class="flex items-center gap-3">
                    <div class="w-1 h-3 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                    <span class="text-[10px] font-black tracking-[0.3em] text-text_primary uppercase">FOREX MARKETS</span>
                  </div>
                </div>
                <div class="flex-1 overflow-y-auto scrollbar-thin">
                  <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-bg_header z-10 border-b border-border_main">
                      <tr class="text-[8px] font-black text-text_secondary opacity-40 uppercase">
                        <th class="p-3 pl-6">PAIR</th>
                        <th class="p-3 text-right">RATE</th>
                        <th class="p-3 text-right pr-6">CHANGE %</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border_main/10">
                      <For each={forexMovers()}>
                        {(fx) => (
                          <tr class="hover:bg-bg_main/5 transition-colors group">
                            <td class="p-3 pl-6">
                              <div class="flex flex-col">
                                <span class="text-[11px] text-text_primary font-black group-hover:text-indigo-400 transition-colors">{fx.name}</span>
                                <span class="text-[7px] text-text_secondary/40 font-bold uppercase tracking-widest">{fx.symbol}</span>
                              </div>
                            </td>
                            <td class="p-3 text-right">
                              <span class="text-[10px] text-text_primary font-mono font-bold">{fx.price?.toFixed(4) || '---'}</span>
                            </td>
                            <td class={`p-3 text-right text-[10px] pr-6 font-black ${fx.change_pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {fx.change_pct >= 0 ? '+' : ''}{fx.change_pct?.toFixed(3) || '0.000'}%
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ROW 4: MARKET BULLETINS & MACRO CHART */}
            <div class="grid grid-cols-12 gap-4">
              {/* MARKET NEWS BULLETINS */}
              <div class="col-span-12 xl:col-span-3 bg-bg_header/30 border border-border_main flex flex-col h-[400px]">
                <div class="bg-bg_main/5 px-4 py-2 border-b border-border_main flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                  <span class="text-[9px] font-black tracking-widest text-text_primary uppercase">MARKET BULLETINS</span>
                </div>
                <div class="flex-1 p-4 overflow-y-auto scrollbar-thin">
                  <div class="space-y-4">
                    <div class="border-l-2 border-orange-500 pl-3 py-1">
                      <span class="text-[7px] text-orange-400 font-bold uppercase tracking-[0.2em] mb-1 block italic">CRYPTO UPDATE</span>
                      <p class="text-[9px] text-text_primary font-medium uppercase leading-tight font-mono">
                        {cryptoMovers()[0] ? `${cryptoMovers()[0].symbol} LEADING VOLUMETRIC MOVEMENT WITH ${cryptoMovers()[0].change_24h.toFixed(2)}% DELTA.` : 'FETCHING DATA...'}
                      </p>
                    </div>
                    <div class="border-l-2 border-indigo-400 pl-3 py-1">
                      <span class="text-[7px] text-indigo-400 font-bold uppercase tracking-[0.2em] mb-1 block italic">FOREX UPDATE</span>
                      <p class="text-[9px] text-text_primary font-medium uppercase leading-tight font-mono">
                        USD/IDR STABILITY OBSERVED. MAJOR PAIRS REFLECT SYNCED MACRO VOLATILITY.
                      </p>
                    </div>
                    <div class="border-l-2 border-border_main pl-3 py-1 opacity-40">
                      <span class="text-[7px] text-text_secondary font-bold uppercase tracking-[0.2em] mb-1 block italic">STATUS</span>
                      <p class="text-[9px] text-text_secondary font-medium uppercase leading-tight font-mono">
                        ALL MARKET DATA STREAMS OPERATIONAL. SYSTEM INTEGRITY OPTIMAL.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="p-3 bg-bg_main/5 border-t border-border_main flex items-center justify-center">
                  <span class="text-[8px] font-black text-text_accent tracking-[0.5em]">CONNECTED</span>
                </div>
              </div>

              <div class="col-span-12 xl:col-span-6 h-[400px] border border-border_main bg-bg_header/20 relative group">
                <div class="absolute top-2 left-2 z-10 px-2 py-0.5 bg-bg_header border border-border_main text-[7px] font-black text-text_primary uppercase tracking-widest">MARKET OVERVIEW</div>
                <TradingViewWidget
                  scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"
                  config={{
                    "colorTheme": "dark",
                    "dateRange": "12M",
                    "showChart": true,
                    "locale": "en",
                    "width": "100%",
                    "height": "100%",
                    "largeChartHeight": "100%",
                    "isTransparent": true,
                    "showSymbolLogo": true,
                    "showFloatingTooltip": false,
                    "plotLineColorGrowing": "rgba(41, 98, 255, 1)",
                    "plotLineColorFalling": "rgba(41, 98, 255, 1)",
                    "gridLineColor": "rgba(42, 46, 57, 0)",
                    "scaleFontColor": "rgba(134, 137, 147, 1)",
                    "belowLineFillColorGrowingBottom": "rgba(41, 98, 255, 0)",
                    "belowLineFillColorFallingBottom": "rgba(41, 98, 255, 0)",
                    "symbolActive": "FOREXCOM:SPX500",
                    "tabs": [
                      {
                        "title": "INDICES",
                        "symbols": [
                          { "s": "FOREXCOM:SPX500", "d": "S&P 500" },
                          { "s": "FOREXCOM:NSXUSD", "d": "NASDAQ 100" },
                          { "s": "FOREXCOM:DJI", "d": "DOW 30" },
                          { "s": "INDEX:NKY", "d": "NIKKEI 225" }
                        ]
                      },
                      {
                        "title": "FUTURES",
                        "symbols": [
                          { "s": "COMEX:GC1!", "d": "GOLD" },
                          { "s": "NYMEX:CL1!", "d": "CRUDE OIL" }
                        ]
                      }
                    ]
                  }}
                />
              </div>

              <div class="col-span-12 xl:col-span-3 h-[400px] border border-border_main bg-bg_header/30 overflow-hidden group">
                <div class="bg-bg_main/5 px-4 py-2 border-b border-border_main flex justify-between items-center">
                  <span class="text-[9px] font-black tracking-widest text-blue-500 uppercase">ECONOMIC CALENDAR</span>
                </div>
                <iframe
                  src="https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&category=_employment,_economicActivity,_inflation,_centralBanks,_confidenceIndex,_balance,_Bonds&features=datepicker,timezone,filters&countries=25,32,6,37,72,22,17,39,14,48,23,10,35,42,43,56,52,36,110,11,26,12,46,4,5&calType=day&timeZone=27&lang=1"
                  class="w-full h-[calc(100%-36px)] border-none grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all invert-[0.05]"
                />
              </div>
            </div>

          </div>
        </Show>

        {/* HEATMAP TAB */}
        <Show when={activeTab() === 'HEATMAPS'}>
          <div class="p-6 flex flex-col gap-6 animate-in fade-in duration-500 pb-20">
            <div class="grid grid-cols-12 gap-6 h-[600px]">
              <div class="col-span-2 flex flex-col gap-2">
                <h3 class="text-[10px] font-black text-text_accent mb-4 border-b border-text_accent/20 pb-2 uppercase tracking-widest">DATA CATEGORY</h3>
                <For each={[
                  { id: 'AllID', name: 'IDX COMPOSITE', source: 'AllID' },
                  { id: 'SPX500', name: 'S&P 500', source: 'SPX500' },
                  { id: 'Nasdaq100', name: 'NASDAQ 100', source: 'Nasdaq100' },
                  { id: 'HSI', name: 'HANG SENG', source: 'HSI' },
                  { id: 'DAX', name: 'DAX INDEX', source: 'DAX' },
                  { id: 'SECTORS', name: 'SECTOR PERFORMANCE', source: 'SECTORS' },
                  { id: 'SENTIMENT', name: 'GLOBAL SENTIMENT', source: 'SENTIMENT' }
                ]}>
                  {(item) => (
                    <button
                      onClick={() => setActiveHeatmap(item.source)}
                      class={`text-left px-3 py-2 border transition-all text-[10px] font-bold tracking-tighter uppercase ${activeHeatmap() === item.source ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main text-text_primary opacity-80 hover:opacity-100'}`}
                    >
                      {item.name}
                    </button>
                  )}
                </For>
              </div>
              <div class="col-span-10 border-2 border-border_main bg-black/40 overflow-hidden relative group">
                <Show
                  when={activeHeatmap() === 'SENTIMENT'}
                  fallback={
                    <TradingViewWidget
                      key={activeHeatmap()}
                      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
                      config={{
                        "dataSource": activeHeatmap(),
                        "blockSize": "market_cap_basic",
                        "blockColor": "change",
                        "grouping": "sector",
                        "locale": "en",
                        "symbolUrl": "",
                        "colorTheme": "dark",
                        "hasTopBar": false,
                        "isDataSetEnabled": false,
                        "isZoomEnabled": true,
                        "hasSymbolTooltip": true,
                        "width": "100%",
                        "height": "100%",
                        "backgroundColor": "#020202"
                      }}
                    />
                  }
                >
                  <div class="w-full h-full p-2">
                    <SentimentHeatmap data={sentimentSummary()} />
                  </div>
                </Show>

                <Show when={activeHeatmap() === 'SECTORS'}>
                  <SectorPerformanceView />
                </Show>
              </div>
            </div>
          </div>
        </Show>

        {/* INTELLIGENCE TAB */}
        <Show when={activeTab() === 'INTELLIGENCE'}>
          <div class="animate-in slide-in-from-right-4 duration-700 pb-20 p-4">
            <div class="grid grid-cols-12 gap-4 h-[580px] mb-4">
              <div class="col-span-12 xl:col-span-4 bg-black/60 border border-border_main h-full">
                <TradingViewWidget
                  scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-timeline.js"
                  config={{ "displayMode": "adaptive", "feedMode": "all_symbols", "colorTheme": "dark", "isTransparent": true, "locale": "en", "width": "100%", "height": "100%" }}
                />
              </div>
              <div class="col-span-12 xl:col-span-8 bg-black/60 border border-border_main h-full grid grid-cols-2 gap-4 p-4">
                <div class="bg-bg_header border border-border_main">
                  <TradingViewWidget
                    scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-etf-heatmap.js"
                    config={{ "dataSource": "AllUSEtf", "blockSize": "volume", "blockColor": "change", "grouping": "asset_class", "locale": "en", "colorTheme": "dark", "width": "100%", "height": "100%" }}
                  />
                </div>
                <div class="bg-bg_header border border-border_main">
                  <TradingViewWidget
                    scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-forex-heat-map.js"
                    config={{ "colorTheme": "dark", "isTransparent": true, "locale": "en", "currencies": ["EUR", "USD", "JPY", "GBP", "CHF", "AUD", "CAD", "NZD", "CNY", "IDR"], "width": "100%", "height": "100%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Show>

      </div>

      {/* FOOTER STATUS */}
      <footer class="h-6 border-t border-border_main bg-bg_header/80 px-4 flex items-center justify-between shrink-0 text-[8px] font-black text-text_dim uppercase tracking-[0.2em] z-20">
        <div class="flex items-center gap-4">
          <span class="text-text_accent opacity-50">LATENCY: 42MS</span>
          <span class="text-text_accent opacity-50">SOCKET: STABLE</span>
        </div>
        <div class="flex items-center gap-4">
          <span>DATABASE STATUS: CONNECTED (RDS)</span>
          <span class="text-text_accent animate-pulse uppercase">TERMINAL READY</span>
        </div>
      </footer>
    </div>
  );
}

