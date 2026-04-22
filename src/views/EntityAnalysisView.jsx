import { createSignal, onMount, createEffect, onCleanup, For, Show } from 'solid-js';
import * as echarts from 'echarts';
import { io } from "socket.io-client";
import EntityAnalysisCharts from '../components/EntityAnalysisCharts';
import EntityAdvancedView from '../components/EntityAdvancedView';
import EntityFullReport from '../components/EntityFullReport';
import TechnicalAnalysisPanel from '../components/TechnicalAnalysisPanel';
import IndexAnalysisView from './IndexAnalysisView';
import MarketDashboard from '../components/MarketDashboard';

// --- SHARED COMPONENTS ---

function EntityRealTimeChart(props) {
    let chartRef;
    let chart;
    let socket;
    const [rtData, setRtData] = createSignal(null);
    const [loading, setLoading] = createSignal(true);
    const [tickerPulse, setTickerPulse] = createSignal(false);
    const [marketOpen, setMarketOpen] = createSignal(true);

    // PHASE 1: Deep Intraday Load / Periodic Reconciliation
    // Fetches the full historical minute series to ensure data integrity
    const fetchFullIntraday = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/realtime/${props.symbol}`);
            const data = await res.json();
            
            setMarketOpen(data.isStreaming !== false);
            
            if (data.intraday) {
                setRtData(prev => {
                    if (!prev || !prev.intraday) return data;
                    
                    // Intelligent Merge Logic:
                    // We trust the history fetch for finalized bars, 
                    // but we 'patch' it with the latest live data if needed.
                    const freshIntraday = [...data.intraday];
                    const lastHist = freshIntraday[freshIntraday.length - 1];
                    
                    // If the current live state has a newer price/tick 
                    // and it's within the same minute as the last historical bar, 
                    // we allow the live tick to overwrite the historical 'close' 
                    // since history might be slightly lagged.
                    if (prev.price && lastHist) {
                        const timeNow = prev.timestamp?.split(':').slice(0, 2).join(':');
                        if (lastHist.time === timeNow) {
                             lastHist.close = prev.price;
                             if (prev.price > lastHist.high) lastHist.high = prev.price;
                             if (prev.price < lastHist.low) lastHist.low = prev.price;
                        }
                    }
                    
                    updateChart(freshIntraday);
                    return { ...data, intraday: freshIntraday };
                });
            }
        } catch (e) {
            console.error("RT Recon Error", e);
        } finally {
            setLoading(false);
        }
    };

    const updateChart = (intraday) => {
        if (!chartRef || !intraday || intraday.length === 0) return;
        if (!chart) {
            const currentTheme = props.theme === 'light' ? null : 'dark';
            chart = echarts.init(chartRef, currentTheme);
        }

        const times = intraday.map(d => d.time);
        const values = intraday.map(d => [d.open, d.close, d.low, d.high]);
        const volumes = intraday.map((d, i) => [i, d.volume, d.open > d.close ? -1 : 1]);

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross', lineStyle: { color: 'rgba(255,255,255,0.1)', width: 1 } },
                backgroundColor: 'rgba(10, 10, 10, 0.95)',
                borderColor: '#333',
                padding: 10,
                textStyle: { color: '#ccc', fontSize: 10, fontFamily: 'monospace' },
                formatter: (params) => {
                    const p = params.find(x => x.seriesType === 'candlestick');
                    if (!p) return "";
                    const data = intraday[p.dataIndex];
                    return `
                        <div class="border-b border-white/10 pb-2 mb-2 font-black text-text_accent uppercase text-[10px] tracking-widest">TIMESTAMP: ${data.time}</div>
                        <div class="flex flex-col gap-1.5 text-[9px] min-w-[120px]">
                            <div class="flex justify-between items-center"><span class="opacity-40 uppercase">Open:</span> <span class="text-white font-bold">${data.open.toFixed(2)}</span></div>
                            <div class="flex justify-between items-center"><span class="opacity-40 uppercase">High:</span> <span class="text-white font-bold">${data.high.toFixed(2)}</span></div>
                            <div class="flex justify-between items-center"><span class="opacity-40 uppercase">Low:</span> <span class="text-white font-bold">${data.low.toFixed(2)}</span></div>
                            <div class="flex justify-between items-center"><span class="opacity-40 uppercase">Close:</span> <span class="text-text_accent font-black">${data.close.toFixed(2)}</span></div>
                            <div class="flex justify-between items-center mt-1 pt-1 border-t border-white/5"><span class="opacity-40 uppercase">Volume:</span> <span class="text-white font-bold">${data.volume.toLocaleString()}</span></div>
                        </div>
                    `;
                }
            },
            axisPointer: { link: [{ xAxisIndex: 'all' }] },
            grid: [
                { left: '40', right: '20', height: '65%', top: '10%' },
                { left: '40', right: '20', height: '15%', top: '78%' }
            ],
            xAxis: [
                {
                    type: 'category',
                    data: times,
                    boundaryGap: true,
                    axisLine: { lineStyle: { color: '#333' } },
                    axisLabel: { fontSize: 8, color: '#666' },
                    splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.02)' } }
                },
                {
                    type: 'category',
                    gridIndex: 1,
                    data: times,
                    boundaryGap: true,
                    axisLine: { onZero: false },
                    axisTick: { show: false },
                    splitLine: { show: false },
                    axisLabel: { show: false }
                }
            ],
            yAxis: [
                {
                    scale: true,
                    axisLine: { show: false },
                    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
                    axisLabel: { fontSize: 8, color: '#666', formatter: (v) => v.toFixed(2) }
                },
                {
                    scale: true,
                    gridIndex: 1,
                    splitNumber: 2,
                    axisLabel: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { show: false }
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
                },
                {
                    name: 'Volume',
                    type: 'bar',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: volumes,
                    itemStyle: {
                        color: (params) => params.data[2] === 1 ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 23, 68, 0.4)'
                    }
                }
            ]
        };
        chart.setOption(option);
    };

    onMount(() => {
        setLoading(true);
        fetchFullIntraday();
        
        // --- WEBSOCKET HEARTBEAT ---
        socket = io(import.meta.env.VITE_ENTITY_URL);
        
        socket.on("connect", () => {
            console.log("[WS] CONNECTED TO DATA STREAM.");
            if (props.symbol) socket.emit("subscribe", { symbol: props.symbol });
        });

        socket.on("ticker_update", (data) => {
            if (data.symbol === props.symbol) {
                setMarketOpen(data.isStreaming !== false);
                
                if (data.isStreaming === false) {
                    setTickerPulse(false);
                    return;
                }

                setTickerPulse(true);
                setRtData(prev => {
                    if (!prev || !prev.intraday) return prev;
                    
                    const newIntraday = [...prev.intraday];
                    const lastEntry = newIntraday[newIntraday.length - 1];
                    // Extract HH:MM from timestamp (e.g. "16:35:01" -> "16:35")
                    const timeNow = data.timestamp.split(':').slice(0, 2).join(':');
                    
                    if (lastEntry && lastEntry.time === timeNow) {
                        // Update the current minute candlestick
                        lastEntry.close = data.price;
                        if (data.price > lastEntry.high) lastEntry.high = data.price;
                        if (data.price < lastEntry.low) lastEntry.low = data.price;
                    } else {
                        // Initialize a new minute bar
                        newIntraday.push({
                            time: timeNow,
                            open: lastEntry ? lastEntry.close : data.price,
                            high: data.price,
                            low: data.price,
                            close: data.price,
                            volume: 0 
                        });
                        // Manage memory for long-running sessions
                        if (newIntraday.length > 1000) newIntraday.shift();
                    }

                    // Synchronize the visualization engine
                    updateChart(newIntraday);

                    return {
                        ...prev,
                        price: data.price,
                        change: data.change,
                        change_pct: data.change_pct,
                        timestamp: data.timestamp,
                        intraday: newIntraday
                    };
                });
                setTimeout(() => setTickerPulse(false), 2000);
            }
        });

        // We rely on WebSocket streaming for updates. 
        // Interval polling removed to reduce backend load.
        
        const handleResize = () => chart && chart.resize();
        window.addEventListener('resize', handleResize);
        
        onCleanup(() => {
            if (socket) {
                if (props.symbol) socket.emit("unsubscribe", { symbol: props.symbol });
                socket.disconnect();
            }
            window.removeEventListener('resize', handleResize);
            if (chart) chart.dispose();
        });
    });

    createEffect(() => {
        const symbol = props.symbol;
        if (symbol) {
            setLoading(true);
            fetchFullIntraday();
            if (socket && socket.connected) {
                socket.emit("subscribe", { symbol });
            }
        }
        
        onCleanup(() => {
            if (socket && socket.connected && symbol) {
                socket.emit("unsubscribe", { symbol });
            }
        });
    });

    return (
        <div class="h-full flex flex-col md:flex-row gap-6 animate-in fade-in duration-500">
            {/* Chart Area */}
            <div class="flex-1 min-h-[400px] flex flex-col p-4 bg-bg_header/20 rounded border border-border_main/30 group relative">
                <div class="flex justify-between items-center mb-4">
                    <div class="flex flex-col">
                        <div class="flex items-center gap-2">
                            <div class={`w-1.5 h-1.5 rounded-full ${!marketOpen() ? 'bg-amber-500' : tickerPulse() ? 'bg-blue-400 rotate-180 scale-150' : 'bg-emerald-500'} animate-pulse shadow-[0_0_8px_currentColor] transition-all duration-500`}></div>
                            <span class={`text-[9px] font-black uppercase tracking-[0.3em] ${!marketOpen() ? 'text-amber-500' : tickerPulse() ? 'text-blue-400' : 'text-text_accent'}`}>
                                {!marketOpen() ? 'MARKET HALTED / INTRADAY DATA' : tickerPulse() ? 'RECEIVING DATA...' : 'INSTITUTIONAL DATA STREAM'}
                            </span>
                        </div>
                        <span class="text-[7px] text-text_secondary/40 font-bold uppercase mt-1 tracking-widest">Symbol: {props.symbol} // {!marketOpen() ? 'SYNC HALTED' : tickerPulse() ? 'SYNC ACTIVE' : 'READY'}</span>
                    </div>
                    <Show when={rtData()}>
                        <div class="flex items-center gap-6">
                            <div class="flex flex-col items-end">
                                <span class="text-[8px] text-text_secondary opacity-40 uppercase font-black tracking-widest mb-0.5">PRICE (USD)</span>
                                <span class="text-[18px] font-black text-text_primary leading-none font-mono animate-pulse shadow-glow">${rtData().price.toFixed(2)}</span>
                            </div>
                            <div class="flex flex-col items-end">
                                <span class="text-[8px] text-text_secondary opacity-40 uppercase font-black tracking-widest mb-0.5">CHANGE (24H)</span>
                                <span class={`text-[12px] font-black leading-none font-mono px-1.5 py-0.5 rounded ${rtData().change >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {rtData().change >= 0 ? '▲' : '▼'}{Math.abs(rtData().change).toFixed(2)} ({rtData().change_pct}%)
                                </span>
                            </div>
                        </div>
                    </Show>
                </div>
                
                <div class="flex-1 relative">
                    <Show when={loading()}>
                        <div class="absolute inset-0 flex items-center justify-center z-10 bg-bg_main/10 backdrop-blur-[1px]">
                            <div class="w-4 h-4 border-2 border-text_accent border-t-transparent animate-spin rounded-full"></div>
                        </div>
                    </Show>
                    <div ref={chartRef} class="w-full h-full"></div>
                </div>

                <div class="mt-4 pt-3 border-t border-border_main/10 flex justify-between items-center gap-4">
                    <div class="flex gap-4">
                         <div class="flex flex-col">
                             <span class="text-[7px] font-black text-text_secondary uppercase opacity-30">Open</span>
                             <span class="text-[9px] font-mono font-bold text-text_primary/80">{rtData()?.open?.toFixed(2)}</span>
                         </div>
                         <div class="flex flex-col">
                             <span class="text-[7px] font-black text-text_secondary uppercase opacity-30">High</span>
                             <span class="text-[9px] font-mono font-bold text-emerald-400">{rtData()?.high?.toFixed(2)}</span>
                         </div>
                         <div class="flex flex-col">
                             <span class="text-[7px] font-black text-text_secondary uppercase opacity-30">Low</span>
                             <span class="text-[9px] font-mono font-bold text-red-400">{rtData()?.low?.toFixed(2)}</span>
                         </div>
                         <div class="flex flex-col">
                             <span class="text-[7px] font-black text-text_secondary uppercase opacity-30">Vol</span>
                             <span class="text-[9px] font-mono font-bold text-blue-400">{(rtData()?.volume / 1000).toFixed(1)}K</span>
                         </div>
                    </div>
                    <span class="text-[7px] font-mono text-text_secondary/40 uppercase">NODE: {rtData()?.timestamp || 'CONNECTING...'}</span>
                </div>
            </div>

            {/* Table Area */}
            <div class="w-full md:w-80 shrink-0 flex flex-col bg-bg_header/20 border border-border_main/30 rounded overflow-hidden">
                <div class="px-4 py-2 border-b border-border_main/30 bg-bg_main/40 flex justify-between items-center">
                    <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">INTRADAY DATA</span>
                    <span class="text-[7px] font-bold text-text_accent opacity-60">LIVE STREAM</span>
                </div>
                <div class="flex-1 overflow-y-auto scrollbar-hide">
                    <table class="w-full text-left text-[9px] border-collapse font-mono">
                        <thead class="bg-bg_header/60 sticky top-0 text-text_secondary/60 uppercase font-black text-[7px] tracking-widest border-b border-border_main/20">
                            <tr>
                                <th class="p-2 pl-3">TIME</th>
                                <th class="p-2 text-right">PRICE</th>
                                <th class="p-2 text-right pr-3">CHG</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border_main/10">
                            <For each={[...(rtData()?.intraday || [])].reverse().slice(0, 30)}>
                                {(tick, idx) => {
                                    const next = rtData().intraday[rtData().intraday.length - 1 - idx() - 1];
                                    const diff = next ? tick.close - next.close : 0;
                                    return (
                                        <tr class="hover:bg-bg_main/40 group/row transition-colors">
                                            <td class="p-2 pl-3 font-bold opacity-60">{tick.time}</td>
                                            <td class="p-2 text-right font-black text-text_primary">{tick.close.toFixed(2)}</td>
                                            <td class={`p-2 text-right pr-3 font-black ${diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-text_secondary/40'}`}>
                                                {diff > 0 ? '▲' : diff < 0 ? '▼' : '='}
                                            </td>
                                        </tr>
                                    );
                                }}
                            </For>
                        </tbody>
                    </table>
                </div>
                <div class="p-2 bg-text_accent/5 border-t border-border_main/20">
                    <div class="flex justify-between items-center">
                          <span class="text-[7px] font-black text-text_accent/40 uppercase tracking-tighter">DATA FEED: CLOUD STREAM</span>
                          <span class={`text-[7px] font-black uppercase ${marketOpen() ? 'text-emerald-500/60' : 'text-amber-500/60'}`}>
                              {marketOpen() ? 'ONLINE' : 'STOPPED'}
                          </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

const EntityAnalysisView = (props) => {
    let searchController = null;
    let detailController = null;

    const [searchQuery, setSearchQuery] = createSignal("");
    const [searchResults, setSearchResults] = createSignal([]);
    const [selectedEntity, setSelectedEntity] = createSignal(null);
    const [loading, setLoading] = createSignal(false);
    const [profile, setProfile] = createSignal(null);
    const [activeTab, setActiveTab] = createSignal("profile");
    const [marketIndices, setMarketIndices] = createSignal([]);
    const [marketLoading, setMarketLoading] = createSignal(false);
    const [selectedRange, setSelectedRange] = createSignal('1M');

    const RANGES = ['1W', '1M', '3M', '6M', '1Y', '5Y', 'ALL'];
    const rangeMap = {
        '1W': '5d',
        '1M': '1mo',
        '3M': '3mo',
        '6M': '6mo',
        '1Y': '1y',
        '5Y': '5y',
        'ALL': 'max'
    };

    onMount(() => {
        fetchMarketIndices();

        // Handle cross-view drill-through from SectorDetailView
        const onSectorDrill = (e) => {
            const symbol = e?.detail?.symbol || window.__sectorDrillSymbol;
            if (symbol) {
                window.__sectorDrillSymbol = null;
                selectEntity(symbol);
                setActiveTab('profile');
            }
        };
        window.addEventListener('sector-drill-symbol', onSectorDrill);
        // Also check if symbol was set before this component mounted
        if (window.__sectorDrillSymbol) onSectorDrill(null);
        return () => window.removeEventListener('sector-drill-symbol', onSectorDrill);
    });

    const fetchMarketIndices = async () => {
        setMarketLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/market-indices`);
            const data = await res.json();
            setMarketIndices(data);
        } catch (err) {
            console.error("Market indices fetch failed", err);
        } finally {
            setMarketLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery()) return;
        
        if (searchController) searchController.abort();
        searchController = new AbortController();
        
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/search?q=${encodeURIComponent(searchQuery())}`, { signal: searchController.signal });
            const data = await res.json();
            setSearchResults(data.quotes || []);
        } catch (err) {
            if (err.name !== 'AbortError') console.error("Search failed", err);
        } finally {
            setLoading(false);
        }
    };

    const [newsLoading, setNewsLoading] = createSignal(false);

    const selectEntity = async (symbol) => {
        if (detailController) detailController.abort();
        detailController = new AbortController();
        const signal = detailController.signal;

        setLoading(true);
        setSearchResults([]);
        setProfile(null);

        try {
            // 1. PHASE 1: Fetch Core Profile Data (Fast)
            const period = rangeMap[selectedRange()] || '1mo';
            const res = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/profile/${symbol}?period=${period}`, { signal });
            const data = await res.json();

            // Immediately show profile with initial news (if any)
            setProfile(data);
            setSelectedEntity(symbol);
            setLoading(false); // Done with main page loading

            const companyName = data.name || symbol;

            // 2. PHASE 2: Fetch Deep Intel (Background/Concurrent)
            setNewsLoading(true);

            // Helper to process news from any source
            const processNews = (rawNews, currentProfile) => {
                const allNews = [
                    ...(currentProfile.news || []),
                    ...rawNews
                ];
                const seen = new Set();
                const unique = [];
                for (const item of allNews) {
                    const link = item.link || item.url;
                    if (link && !seen.has(link)) {
                        seen.add(link);
                        unique.push({
                            ...item,
                            link,
                            title: item.title || "No Title",
                            publisher: item.publisher || item.source || "GNews Intel",
                            time: item.time || item.timestamp
                        });
                    }
                }
                unique.sort((a, b) => (b.time || b.timestamp) - (a.time || a.timestamp));
                return unique;
            };

            // Trigger fetches concurrently with progressive UI updates
            const updateNews = (rawNews) => {
                setProfile(prev => ({
                    ...prev,
                    news: processNews(rawNews, prev)
                }));
            };

            const fetchSources = [
                { url: `${import.meta.env.VITE_API_BASE}/api/news/search?q=${encodeURIComponent(companyName)}`, key: 'results' },
                { url: `${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(symbol)}`, key: 'news' },
                { url: `${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(companyName)}`, key: 'news' }
            ];

            let pending = fetchSources.length;
            fetchSources.forEach(src => {
                fetch(src.url, { signal })
                    .then(r => r.json())
                    .then(data => {
                        if (data[src.key]) updateNews(data[src.key]);
                    })
                    .catch(() => {})
                    .finally(() => {
                        pending--;
                        if (pending === 0 && !signal.aborted) setNewsLoading(false);
                    });
            });

        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Fetch profile failed", err);
                setLoading(false);
            }
        }
    };

    createEffect(() => {
        const symbol = selectedEntity();
        if (symbol) {
            selectEntity(symbol);
        }
    });

    const formatNumber = (num) => {
        if (num == null) return "N/A";
        if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
        if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
        if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
        return num.toLocaleString();
    };

    return (
        <div class="flex-1 flex flex-col overflow-y-auto win-scroll bg-bg_main p-6 space-y-6">
            {/* Search Header - Always Persistent */}
            <div class="flex flex-col space-y-4 shrink-0 bg-bg_header/40 p-4 rounded-lg border border-border_main/30 shadow-2xl relative z-40 group">
                <div class="absolute top-0 left-0 w-1 h-full bg-text_accent opacity-50"></div>
                <div class="flex justify-between items-center mb-1">
                    <h1 class="text-xs font-black text-text_accent tracking-[0.4em] uppercase">ENTITY INTELLIGENCE ANALYSIS</h1>
                    <Show when={selectedEntity()}>
                        <button 
                            onClick={() => { setSelectedEntity(null); setProfile(null); setSearchQuery(""); }}
                            class="text-[9px] font-black text-text_secondary/60 hover:text-text_accent transition-colors flex items-center gap-1 uppercase tracking-widest"
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                            BACK TO DASHBOARD
                        </button>
                    </Show>
                </div>
                <form onSubmit={handleSearch} class="flex gap-2 relative z-10">
                    <div class="relative flex-1">
                        <input
                            type="text"
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.target.value)}
                            placeholder="SEARCH ENTITY (E.G. AAPL, IDX:BBCA, ^JKSE, CRUDE)..."
                            class="w-full bg-bg_main border border-border_main p-3 pl-10 rounded text-text_primary placeholder:text-text_secondary/40 outline-none focus:border-text_accent transition-all font-mono uppercase text-sm shadow-inner"
                        />
                        <div class="absolute left-3 top-1/2 -translate-y-1/2 text-text_secondary opacity-40">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                        </div>
                    </div>
                    <button type="submit" class="bg-text_accent text-bg_main px-8 font-black rounded hover:bg-bg_header transition-all uppercase tracking-widest text-xs hidden md:block">EXECUTE</button>
                    <button type="button" onClick={fetchMarketIndices} class="bg-bg_header border border-border_main text-text_accent px-4 rounded hover:bg-bg_main transition-all group/ref">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class={`${marketLoading() ? 'animate-spin' : ''} group-hover/ref:rotate-180 transition-transform duration-500`}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </form>

                {/* Search Results Dropdown-style */}
                <Show when={searchResults().length > 0}>
                    <div class="absolute top-[calc(100%+8px)] left-0 w-full bg-bg_header border border-border_main p-2 rounded shadow-2xl z-[100] animate-in slide-in-from-top-2 duration-200 backdrop-blur-md">
                        <For each={searchResults()}>
                            {(item) => (
                                <div
                                    onClick={() => selectEntity(item.symbol)}
                                    class="p-3 hover:bg-bg_main cursor-pointer border-b border-border_main last:border-0 flex justify-between items-center group/item"
                                >
                                    <div class="flex flex-col">
                                        <span class="font-black text-text_accent group-hover/item:text-text_primary transition-colors">{item.symbol}</span>
                                        <span class="text-[9px] text-text_secondary opacity-40 uppercase tracking-widest">{item.exchDisp}</span>
                                    </div>
                                    <span class="text-text_primary font-bold text-xs truncate ml-4 flex-1 text-right">{item.longname || item.shortname}</span>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </div>

            {/* Global Context Loading Indicator */}
            <Show when={loading()}>
                <div class="flex flex-col items-center justify-center py-10 space-y-4 animate-in fade-in duration-300">
                    <div class="w-24 h-0.5 bg-text_accent/10 rounded-full overflow-hidden">
                        <div class="h-full bg-text_accent animate-progress-indefinite" style="width: 40%"></div>
                    </div>
                    <span class="text-text_accent animate-pulse font-black tracking-[0.4em] uppercase text-[9px]">PROCESSING DATA...</span>
                </div>
            </Show>

            {/* View Switching Logic */}
            <Show when={!selectedEntity()}>
                <div class="space-y-10 animate-in fade-in zoom-in-95 duration-700">
                    {/* 1. Global Indices High-Density Cluster */}
                    <div class="space-y-4">
                        <div class="flex items-center gap-4">
                            <div class="h-px bg-border_main flex-1"></div>
                            <h2 class="text-[10px] font-black text-text_accent uppercase tracking-[0.5em] whitespace-nowrap">GLOBAL INDICES</h2>
                            <div class="h-px bg-border_main flex-1"></div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                            <For each={marketIndices()}>
                                {(category) => (
                                    <div class="bg-bg_header border border-border_main rounded overflow-hidden flex flex-col shadow-lg hover:border-text_accent/30 transition-colors">
                                        <div class="bg-bg_main/50 px-3 py-1.5 border-b border-border_main flex justify-between items-center">
                                            <span class="text-[8px] font-black text-text_secondary opacity-60 uppercase">{category.category}</span>
                                        </div>
                                        <div class="overflow-y-auto max-h-[220px] scrollbar-hide">
                                            <table class="w-full text-left text-[9px]">
                                                <tbody class="divide-y divide-border_main/10 font-mono">
                                                    <For each={category.data.slice(0, 5)}>
                                                        {(row) => (
                                                            <tr 
                                                                onClick={() => { selectEntity(row.symbol); setActiveTab('profile'); }}
                                                                class="hover:bg-bg_main/60 cursor-pointer group/row transition-colors"
                                                            >
                                                                <td class="p-2 pl-3">
                                                                     <div class="flex items-center gap-2">
                                                                        <img src={`https://flagcdn.com/w20/${row.country.toLowerCase()}.png`} width="12" class="opacity-80 group-hover/row:opacity-100" />
                                                                        <span class={`whitespace-normal font-bold ${row.name.includes('IDX') ? 'text-blue-400' : 'text-text_primary'}`}>{row.name}</span>
                                                                     </div>
                                                                </td>
                                                                <td class="p-2 text-right">
                                                                    <div class="flex flex-col items-end">
                                                                        <span class="font-black text-text_primary/80">{row.close?.toFixed(0)}</span>
                                                                        <span class={`text-[7px] font-black ${row.change_pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                            {row.change_pct >= 0 ? '+' : ''}{row.change_pct?.toFixed(2)}%
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </For>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* 2. Full Market Overview Command Center */}
                    <div class="border-t border-border_main pt-8">
                        <MarketDashboard theme={props.theme} />
                    </div>
                </div>
            </Show>

            <Show when={selectedEntity()}>
                <div class="flex-1 flex flex-col space-y-4 min-h-0 animate-in slide-in-from-bottom-4 duration-500">
                    
                    {/* ASSET IDENTIFICATION HEADER */}
                    <Show when={profile()}>
                        <div class="px-5 py-4 bg-bg_header/30 border border-border_main/50 rounded-lg flex justify-between items-center shadow-2xl relative overflow-hidden group">
                            <div class="absolute top-0 left-0 w-1.5 h-full bg-text_accent opacity-80" />
                            <div class="flex flex-col relative z-10 flex-1 min-w-0">
                                <div class="flex items-center gap-3 mb-1">
                                    <span class="text-[9px] font-black text-text_accent tracking-[0.4em] uppercase opacity-70">ASSET LOADED</span>
                                    <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                                <div class="flex items-center gap-6 min-w-0">
                                    <h2 class="text-4xl font-black text-white italic tracking-tighter uppercase leading-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.1)] truncate" title={profile().name}>
                                        {profile().name}
                                    </h2>
                                    <div class="flex items-baseline gap-2 shrink-0">
                                        <span class="text-2xl font-mono font-black text-text_accent tracking-widest">{selectedEntity()}</span>
                                        <span class="text-[10px] font-black text-text_secondary/40 uppercase tracking-[0.2em] mb-1">{profile().exchange}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-center gap-12 pr-4 relative z-10 shrink-0">
                                <div class="flex flex-col items-end gap-1">
                                    <span class="text-[8px] font-black text-text_secondary/30 uppercase tracking-[0.3em]">SECTOR</span>
                                    <span class="px-3 py-1 bg-white/[0.03] border border-white/5 text-[11px] font-black text-text_primary uppercase tracking-tight">
                                        {profile().sector || 'DATA UNAVAILABLE'}
                                    </span>
                                </div>
                                <div class="flex flex-col items-end gap-1">
                                    <span class="text-[8px] font-black text-text_secondary/30 uppercase tracking-[0.3em]">INDUSTRY</span>
                                    <span class="px-3 py-1 bg-white/[0.03] border border-white/5 text-[11px] font-black text-text_primary uppercase tracking-tight">
                                        {profile().industry || 'UNAVAILABLE'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Decorative background grid */}
                            <div class="absolute inset-0 opacity-[0.03] pointer-events-none" style="background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 20px 20px;"></div>
                        </div>
                    </Show>

                    {/* Entity Sub-Navigation Tabs */}
                    <div class="flex gap-1 border-b border-border_main/50 shrink-0 p-1 bg-bg_header/20 rounded-t-lg">
                        <button
                            onClick={() => setActiveTab('profile')}
                            class={`px-6 py-2 font-black uppercase tracking-widest text-[10px] transition-all rounded ${activeTab() === 'profile' ? 'bg-text_accent text-bg_main' : 'text-text_secondary hover:bg-bg_main/10'}`}
                        >
                            ASSET PROFILE
                        </button>
                        <button
                            onClick={() => setActiveTab('technical')}
                            class={`px-6 py-2 font-black uppercase tracking-widest text-[10px] transition-all rounded ${activeTab() === 'technical' ? 'bg-cyan-500 text-bg_main' : 'text-text_secondary hover:bg-bg_main/10'}`}
                        >
                            TECHNICAL ANALYSIS
                        </button>
                        <button
                            onClick={() => setActiveTab('report')}
                            class={`px-6 py-2 font-black uppercase tracking-widest text-[10px] transition-all rounded ${activeTab() === 'report' ? 'bg-emerald-500 text-bg_main' : 'text-text_secondary hover:bg-bg_main/10'}`}
                        >
                            RESEARCH REPORT
                        </button>
                        <button
                            onClick={() => setActiveTab('advanced')}
                            class={`px-6 py-2 font-black uppercase tracking-widest text-[10px] transition-all rounded ${activeTab() === 'advanced' ? 'bg-amber-500 text-bg_main' : 'text-text_secondary hover:bg-bg_main/10'}`}
                        >
                            QUANTITATIVE ANALYSIS
                        </button>
                    </div>


            <Show when={profile()}>
                <Show 
                    when={selectedEntity()?.startsWith('^') || selectedEntity() === '000001.SS' || selectedEntity() === 'VNI.HM' || selectedEntity() === 'VNINDEX.VN'} 
                    fallback={
                        <>
                            <Show when={activeTab() === 'profile'}>
                                <div class="flex-1 overflow-auto space-y-6 scrollbar-thin pr-2">
                                    {/* Real-Time Pulse Monitoring Node */}
                                    <div class="grid grid-cols-1 gap-4">
                                        <div class="min-h-[450px] shrink-0">
                                            <EntityRealTimeChart symbol={selectedEntity()} theme={props.theme} />
                                        </div>
                                    </div>

                                    {/* Top Stats Cards */}
                                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div class="bg-bg_header border-l-4 border-text_accent p-4 rounded shadow-lg">
                                            <p class="text-[10px] text-text_secondary opacity-60 uppercase font-bold tracking-widest mb-1">Market Capitalization</p>
                                            <p class="text-xl font-black text-text_primary">{formatNumber(profile().metrics.marketCap)}</p>
                                        </div>
                                        <div class="bg-bg_header border-l-4 border-amber-500 p-4 rounded shadow-lg">
                                            <p class="text-[10px] text-text_secondary opacity-60 uppercase font-bold tracking-widest mb-1">Trailing PE Ratio</p>
                                            <p class="text-xl font-black text-amber-500">{profile().metrics.trailingPE?.toFixed(2) || "N/A"}</p>
                                        </div>
                                        <div class="bg-bg_header border-l-4 border-blue-400 p-4 rounded shadow-lg">
                                            <p class="text-[10px] text-text_secondary opacity-60 uppercase font-bold tracking-widest mb-1">Dividend Yield</p>
                                            <p class="text-xl font-black text-blue-400">{(profile().metrics.dividendYield * 100)?.toFixed(2)}%</p>
                                        </div>
                                        <div class="bg-bg_header border-l-4 border-emerald-500 p-4 rounded shadow-lg">
                                            <p class="text-[10px] text-text_secondary opacity-60 uppercase font-bold tracking-widest mb-1">Total Revenue (TTM)</p>
                                            <p class="text-xl font-black text-emerald-500">{formatNumber(profile().metrics.totalRevenue)}</p>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                        {/* Main Analysis Pane */}
                                        <div class="lg:col-span-8 space-y-6">
                                            {/* Historical Table */}
                                            <div class="bg-bg_header border border-border_main rounded overflow-hidden flex flex-col h-[400px]">
                                                <div class="bg-bg_main px-4 py-2 border-b border-border_main flex justify-between items-center gap-4">
                                                    <h3 class="text-[11px] font-black text-text_accent uppercase tracking-widest whitespace-nowrap">Historical Quote Matrix [{selectedRange()}]</h3>
                                                    <div class="flex items-center gap-3">
                                                        <div class="flex gap-1">
                                                            {RANGES.map(r => (
                                                                <button 
                                                                    onClick={() => setSelectedRange(r)}
                                                                    class={`px-2 py-0.5 text-[8px] font-black border transition-all ${selectedRange() === r ? 'bg-text_accent text-bg_main border-text_accent' : 'border-border_main/30 text-text_secondary opacity-60 hover:opacity-100 hover:border-text_accent/30'}`}
                                                                >{r}</button>
                                                            ))}
                                                        </div>
                                                        <button 
                                                            onClick={() => selectEntity(selectedEntity())}
                                                            class="flex items-center gap-1.5 px-3 py-0.5 bg-text_accent/10 border border-text_accent/30 text-[8px] font-black text-text_accent hover:bg-text_accent hover:text-bg_main transition-all uppercase"
                                                        >
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                                            RELOAD
                                                        </button>
                                                    </div>
                                                </div>
                                                <div class="flex-1 overflow-auto scrollbar-thin">
                                                    <table class="w-full text-left text-[11px] border-collapse">
                                                        <thead class="bg-bg_main sticky top-0 text-text_secondary opacity-60 uppercase font-bold">
                                                            <tr>
                                                                <th class="p-3 border-b border-border_main">Date</th>
                                                                <th class="p-3 border-b border-border_main text-right">Open</th>
                                                                <th class="p-3 border-b border-border_main text-right">High</th>
                                                                <th class="p-3 border-b border-border_main text-right">Low</th>
                                                                <th class="p-3 border-b border-border_main text-right text-text_accent">Close</th>
                                                                <th class="p-3 border-b border-border_main text-right">Volume</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody class="divide-y divide-border_main/30 font-mono">
                                                            <For each={profile().history.slice().reverse()}>
                                                                {(row) => (
                                                                    <tr class="hover:bg-bg_main/50">
                                                                        <td class="p-3">{row.Date}</td>
                                                                        <td class="p-3 text-right">{row.Open.toFixed(2)}</td>
                                                                        <td class="p-3 text-right">{row.High.toFixed(2)}</td>
                                                                        <td class="p-3 text-right">{row.Low.toFixed(2)}</td>
                                                                        <td class="p-3 text-right text-text_accent font-bold">{row.Close.toFixed(2)}</td>
                                                                        <td class="p-3 text-right">{formatNumber(row.Volume)}</td>
                                                                    </tr>
                                                                )}
                                                            </For>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Institutional Matrix */}
                                            <div class="bg-bg_header border border-border_main rounded overflow-hidden flex flex-col min-h-[400px]">
                                                <div class="bg-bg_main px-4 py-2 border-b border-border_main flex justify-between items-center text-text_accent">
                                                    <h3 class="text-[11px] font-black uppercase tracking-widest text-text_accent">INSTITUTIONAL METRICS</h3>
                                                </div>
                                                <div class="flex-1 overflow-auto scrollbar-thin p-4 space-y-4">
                                                    {(() => {
                                                        const categories = {
                                                            "Valuation Measures": ["marketCap", "enterpriseValue", "trailingPE", "forwardPE", "pegRatio", "priceToSalesTrailing12Months", "priceToBook", "enterpriseToRevenue", "enterpriseToEbitda"],
                                                            "Financial Highlights": ["profitMargins", "operatingMargins", "returnOnAssets", "returnOnEquity"],
                                                            "Income Statement": ["totalRevenue", "revenuePerShare", "quarterlyRevenueGrowth", "grossProfits", "ebitda", "netIncomeToCommon", "trailingEps", "forwardEps", "earningsQuarterlyGrowth", "revenueGrowth", "earningsGrowth"],
                                                            "Balance Sheet": ["totalCash", "totalCashPerShare", "totalDebt", "quickRatio", "currentRatio", "debtToEquity", "bookValue"],
                                                            "Cash Flow": ["operatingCashflow", "leveredFreeCashflow"],
                                                            "Stock Price History": ["fiftyTwoWeekHigh", "fiftyTwoWeekLow", "fiftyDayAverage", "twoHundredDayAverage"],
                                                            "Share Statistics": ["floatShares", "sharesOutstanding", "shortRatio", "shortPercentOfFloat", "beta"],
                                                            "Dividends": ["dividendYield", "dividendRate", "payoutRatio", "trailingAnnualDividendYield"]
                                                        };

                                                        return (
                                                            <div class="space-y-2">
                                                                {Object.entries(categories).map(([catName, keys]) => {
                                                                    const [isOpen, setIsOpen] = createSignal(catName === "Valuation Measures");
                                                                    return (
                                                                        <div class="border border-border_main/30 rounded overflow-hidden">
                                                                            <button
                                                                                onClick={() => setIsOpen(!isOpen())}
                                                                                class="w-full bg-bg_main/50 px-3 py-2 flex justify-between items-center hover:bg-bg_main transition-colors"
                                                                            >
                                                                                <span class="text-[10px] font-black uppercase tracking-widest text-text_secondary opacity-80">{catName}</span>
                                                                                <span class="text-[10px] text-text_accent">{isOpen() ? "-" : "+"}</span>
                                                                            </button>
                                                                            <Show when={isOpen()}>
                                                                                <div class="max-h-48 overflow-y-auto scrollbar-thin divide-y divide-border_main/10 bg-bg_header/30">
                                                                                    <For each={keys}>
                                                                                        {(key) => {
                                                                                            const value = profile()?.institutional?.[key];
                                                                                            if (value === undefined) return null;
                                                                                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                                                                            return (
                                                                                                <div class="flex justify-between items-center p-2 px-3 text-[10px] font-mono hover:bg-bg_main/20">
                                                                                                    <span class="text-text_secondary opacity-60 uppercase">{label}</span>
                                                                                                    <span class="text-text_primary font-bold">
                                                                                                        {typeof value === 'number' ?
                                                                                                            (Math.abs(value) > 1000 ? formatNumber(value) : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) :
                                                                                                            (value || "N/A")}
                                                                                                    </span>
                                                                                                </div>
                                                                                            );
                                                                                        }}
                                                                                    </For>
                                                                                </div>
                                                                            </Show>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* News Stream */}
                                            <div class="bg-bg_header border border-border_main rounded overflow-hidden flex flex-col h-[400px]">
                                                <div class="bg-bg_main px-4 py-2 border-b border-border_main flex justify-between items-center text-text_accent">
                                                    <h3 class="text-[11px] font-black uppercase tracking-widest text-amber-500">STRATEGIC NEWS FEED</h3>
                                                    <Show when={newsLoading()}>
                                                        <span class="text-[8px] animate-pulse font-mono font-black uppercase">STREAM ACTIVE...</span>
                                                    </Show>
                                                </div>
                                                <div class="flex-1 overflow-auto scrollbar-thin p-4 space-y-4">
                                                    <Show when={newsLoading() && (!profile().news || profile().news.length === 0)}>
                                                        <For each={[1, 2, 3, 4, 5]}>
                                                            {() => (
                                                                <div class="border-l-2 border-border_main/30 pl-4 py-2 animate-pulse">
                                                                    <div class="h-4 bg-border_main/50 rounded w-3/4 mb-2"></div>
                                                                    <div class="flex gap-4">
                                                                        <div class="h-2 bg-border_main/30 rounded w-20"></div>
                                                                        <div class="h-2 bg-border_main/30 rounded w-24"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </For>
                                                    </Show>

                                                    <For each={profile()?.news}>
                                                        {(item) => (
                                                            <a href={item.link} target="_blank" class="block group">
                                                                <div class="border-l-2 border-border_main group-hover:border-amber-500 pl-4 py-1 transition-all">
                                                                    <h4 class="text-[13px] font-bold text-text_primary group-hover:text-amber-500 transition-colors uppercase leading-tight">{item.title}</h4>
                                                                    <div class="flex gap-4 mt-1">
                                                                        <span class="text-[9px] text-text_secondary opacity-60 font-black uppercase">{item.publisher}</span>
                                                                        <span class="text-[9px] text-text_secondary opacity-40 font-mono">{new Date(item.time * 1000).toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                            </a>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sidebar Intel Pane */}
                                        <div class="lg:col-span-4 space-y-6">
                                            {/* Strategic Profile */}
                                            <div class="bg-bg_header border border-border_main p-6 rounded shadow-xl">
                                                <h3 class="text-[12px] font-black text-text_accent uppercase tracking-[0.2em] mb-4 border-l-2 border-text_accent pl-4">STRATEGIC PROFILE</h3>
                                                <p class="text-[14px] text-text_secondary leading-relaxed mb-6 font-medium line-clamp-6 hover:line-clamp-none transition-all">
                                                    {profile().metrics.longBusinessSummary || "No strategic overview available in current intelligence node."}
                                                </p>
                                                <div class="space-y-3 pt-4 border-t border-border_main">
                                                    <div class="flex justify-between items-center">
                                                        <span class="text-[10px] text-text_secondary opacity-60 font-black uppercase">Sector</span>
                                                        <span class="text-[11px] font-bold text-text_primary">{profile().metrics.sector || "N/A"}</span>
                                                    </div>
                                                    <div class="flex justify-between items-center">
                                                        <span class="text-[10px] text-text_secondary opacity-60 font-black uppercase">Industry</span>
                                                        <span class="text-[11px] font-bold text-text_primary">{profile().metrics.industry || "N/A"}</span>
                                                    </div>
                                                    <div class="flex justify-between items-center">
                                                        <span class="text-[10px] text-text_secondary opacity-60 font-black uppercase">Employees</span>
                                                        <span class="text-[11px] font-bold text-text_primary">{formatNumber(profile().metrics.fullTimeEmployees)}</span>
                                                    </div>
                                                    <div class="flex justify-between items-center">
                                                        <span class="text-[10px] text-text_secondary opacity-60 font-black uppercase">LOCATION</span>
                                                        <span class="text-[11px] font-bold text-text_primary">{profile().metrics.city}, {profile().metrics.country}</span>
                                                    </div>
                                                    <div class="mt-4">
                                                        <a href={profile().metrics.website} target="_blank" class="block w-full text-center bg-bg_main border border-text_accent text-text_accent py-2 text-[10px] font-black rounded hover:bg-text_accent hover:text-bg_main transition-all uppercase tracking-widest">LAUNCH PORTAL</a>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Management */}
                                            <div class="bg-bg_header border border-border_main rounded overflow-hidden">
                                                <div class="bg-bg_main px-4 py-2 border-b border-border_main">
                                                    <h3 class="text-[11px] font-black text-blue-400 uppercase tracking-widest">LEADERSHIP</h3>
                                                </div>
                                                <div class="p-4 space-y-4 max-h-[300px] overflow-auto scrollbar-thin">
                                                    <For each={profile().management}>
                                                        {(person) => (
                                                            <div class="border-b border-border_main/30 pb-2 last:border-0 last:pb-0">
                                                                <p class="text-[11px] font-bold text-text_primary uppercase">{person.name}</p>
                                                                <p class="text-[9px] text-text_secondary opacity-60 uppercase">{person.title}</p>
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Show>

                            <Show when={activeTab() === 'analysis'}>
                                <div class="flex-1 flex flex-col h-[800px] border border-border_main rounded overflow-hidden">
                                    <EntityAnalysisCharts symbol={selectedEntity()} />
                                </div>
                            </Show>

                            <Show when={activeTab() === 'advanced'}>
                                <EntityAdvancedView symbol={selectedEntity()} fullHistory={profile()?.history} />
                            </Show>

                            <Show when={activeTab() === 'report'}>
                                <EntityFullReport symbol={selectedEntity()} />
                            </Show>

                            <Show when={activeTab() === 'technical'}>
                                <div class="h-[calc(100vh-320px)] min-h-[600px] border border-border_main rounded overflow-hidden">
                                    <TechnicalAnalysisPanel symbol={selectedEntity()} showToolbar={false} />
                                </div>
                            </Show>
                        </>
                    }
                >
                    <IndexAnalysisView symbol={selectedEntity()} />
                </Show>
            </Show>
        </div>
    </Show>
</div>
    );
};

export default EntityAnalysisView;
