import { createSignal, onMount, For, Show } from 'solid-js';
import { DeepAnalysisAPI, EChartsDeepAnalyzer } from '../components/echarts_analyzer';

const AdvancedDeepAnalyticsView = () => {
    const [query, setQuery] = createSignal("");
    const [sidebarOpen, setSidebarOpen] = createSignal(true);
    const [searchResults, setSearchResults] = createSignal([]);
    const [selectedAsset, setSelectedAsset] = createSignal(null);
    const [loading, setLoading] = createSignal(false);
    const [searching, setSearching] = createSignal(false);
    const [currentTask, setCurrentTask] = createSignal("");
    const [sessionStatus, setSessionStatus] = createSignal(null);
    const [functionsList, setFunctionsList] = createSignal([]);
    const [selectedFunctions, setSelectedFunctions] = createSignal([]);
    const [activeTab, setActiveTab] = createSignal("core");
    const [timeframe, setTimeframe] = createSignal("1Y");
    const [error, setError] = createSignal(null);
    const [moduleStatus, setModuleStatus] = createSignal({}); // { funcId: 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR' }
    const [summaryData, setSummaryData] = createSignal(null);
    const [signalsData, setSignalsData] = createSignal([]);
    const [chartsData, setChartsData] = createSignal({}); // { funcId: chartData }
    const [ohlcvData, setOhlcvData] = createSignal([]); // Raw historical records
    const [viewMode, setViewMode] = createSignal("chart"); // 'chart' | 'table'
    const [shouldStop, setShouldStop] = createSignal(false);

    const api = new DeepAnalysisAPI(`${import.meta.env.VITE_DEEP_TA_API}/api`);
    let analyzer;

    const categories = [
        { id: 'core', name: 'CORE METRICS' },
        { id: 'smart_money', name: 'INSTITUTIONAL FLOW' },
        { id: 'scoring', name: 'QUANT SCORING' },
        { id: 'spectral', name: 'CYCLE ANALYSIS' },
        { id: 'complexity', name: 'MARKET DYNAMICS' },
        { id: 'risk', name: 'RISK METRICS' },
        { id: 'oscillator', name: 'DIVERGENCE' },
        { id: 'summary', name: 'SUMMARY DASHBOARD' },
    ];

    // Unified Search Logic
    const performSearch = async (val) => {
        setQuery(val);
        if (val.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            // Parallel search on Entity (Stocks/Forex) and Crypto services
            const [stockRes, cryptoRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/search?q=${val}`).then(r => r.json()).catch(() => ({ quotes: [] })),
                fetch(`${import.meta.env.VITE_CRYPTO_API}/api/crypto/search?q=${val}`).then(r => r.json()).catch(() => ({ data: [] }))
            ]);

            const stocks = (stockRes.quotes || []).map(q => ({
                id: q.symbol,
                symbol: q.symbol,
                name: q.shortname || q.longname,
                type: q.quoteType || 'STOCK',
                exch: q.exchDisp || q.exchange
            }));

            const cryptos = (cryptoRes.data || []).map(c => ({
                id: c.symbol,
                symbol: c.symbol,
                name: c.name,
                type: 'CRYPTO',
                exch: 'CoinMarketCap'
            }));

            setSearchResults([...stocks, ...cryptos].slice(0, 15));
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setSearching(false);
        }
    };

    const selectAsset = async (asset, tf = timeframe()) => {
        setQuery(asset.symbol);
        setSearchResults([]);
        setSelectedAsset(asset);
        setTimeframe(tf);
        setError(null);
        setLoading(true);
        setCurrentTask("FETCHING HISTORICAL DATA...");
        setSessionStatus(null);
        setFunctionsList([]);
        setSelectedFunctions([]);
        setChartsData({});
        setModuleStatus({});
        setOhlcvData([]);

        if (analyzer) analyzer.clear();

        try {
            // 1. Fetch Raw OHLCV from specialized services
            let history = [];
            if (asset.type === 'CRYPTO') {
                const res = await fetch(`${import.meta.env.VITE_CRYPTO_API}/api/crypto/detail/${asset.symbol}`).then(r => r.json());
                if (res.status === 'success') {
                    history = res.data.history || [];
                }
            } else {
                const res = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/history/${asset.symbol}?period=${tf}`).then(r => r.json());
                history = res.history || [];
            }
            
            if (history.length > 0) {
                const normalized = history.map(h => ({
                    date: h.Date || h.date,
                    open: h.Open || h.open,
                    high: h.High || h.high,
                    low: h.Low || h.low,
                    close: h.Close || h.close,
                    volume: h.Volume || h.volume
                })).sort((a,b) => new Date(a.date) - new Date(b.date));
                setOhlcvData(normalized);
                
                // Initialize engine with this data
                await initAnalysisEngine(asset, tf, normalized);
            }
        } catch (err) {
            console.error("Asset selection failed:", err);
            setError("Failed to load historical data.");
        } finally {
            setLoading(false);
        }
    };

    const initAnalysisEngine = async (asset, tf, history) => {
        try {
            setCurrentTask("INITIALIZING ANALYSIS ENGINE...");
            const initRes = await api.init(asset.symbol, null, null, history, tf);
            if (initRes.status !== 'success') throw new Error(initRes.error);

            const sid = initRes.session_id;
            const functions = initRes.available_functions_details || [];
            setFunctionsList(functions);
            setSelectedFunctions(functions.map(f => f.id));

            setSessionStatus({
                id: sid,
                entity: asset.symbol,
                total: functions.length,
                completed: 0
            });

            // Initial PREVIEW Chart (Candlestick)
            if (!analyzer) analyzer = new EChartsDeepAnalyzer('deep-charts-content');

            const chartData = {
                chartType: 'candlestick',
                title: `${asset.symbol} Historical Preview`,
                xAxis: history.map(h => h.date),
                series: [{
                    name: "Price",
                    type: 'candlestick',
                    data: history.map(h => [h.open, h.close, h.low, h.high])
                }]
            };
            
            setTimeout(() => {
                analyzer._renderSingle('preview-ohlcv-chart', chartData);
            }, 100);
        } catch (err) {
            console.error("Init failed:", err);
            setError("Engine initialization failed.");
        }
    };

    const runAnalysis = async (mode = 'all') => {
        if (!sessionStatus() || loading()) return;
        
        setLoading(true);
        setShouldStop(false);
        setError(null);
        
        const toRun = mode === 'all' 
            ? functionsList() 
            : functionsList().filter(f => selectedFunctions().includes(f.id));

        // SEQUENTIAL EXECUTION
        for (const f of toRun) {
            if (shouldStop()) {
                setCurrentTask("ANALYSIS HALTED BY USER.");
                break;
            }
            if (moduleStatus()[f.id] === 'DONE') continue; 

            setModuleStatus(prev => ({ ...prev, [f.id]: 'RUNNING' }));
            setCurrentTask(`ANALYZING: ${f.name}...`);
            
            try {
                const res = await api.runFunction(f.id);
                if (res.status === 'success') {
                    setModuleStatus(prev => ({ ...prev, [f.id]: 'DONE' }));
                    setSessionStatus(prev => ({ ...prev, completed: prev.completed + 1 }));

                    // Fetch chart SECARA SINGLE sesuai instruksi "jangan panggil all charts"
                    const cRes = await api.getSingleChart(f.id);
                    if (cRes.status === 'success' && Array.isArray(cRes.charts)) {
                        setChartsData(prev => ({ ...prev, [f.id]: cRes.charts }));
                        
                        // Render ke container jika tab aktif
                        if (f.category === activeTab()) {
                            setTimeout(() => renderModuleCharts(f.id, cRes.charts), 50);
                        }
                    }
                } else {
                    if (res.error?.includes("Sesi tidak ditemukan")) {
                         setError("Session expired. Please re-select the asset.");
                         setShouldStop(true);
                         break;
                    }
                    setModuleStatus(prev => ({ ...prev, [f.id]: 'ERROR' }));
                }
            } catch (err) {
                console.warn(`Task ${f.id} failed:`, err);
                setModuleStatus(prev => ({ ...prev, [f.id]: 'ERROR' }));
            }
            
            await new Promise(r => setTimeout(r, 100)); // Cool-off period
        }

        // AUTO-COMPILE SUMMARY if required modules are done
        if (moduleStatus()['lib2_pipeline'] === 'DONE' || moduleStatus()['master_signal'] === 'DONE') {
            await compileSummary();
        }

        setCurrentTask("ANALYSIS COMPLETED.");
        setLoading(false);
    };

    const compileSummary = async () => {
        setCurrentTask("COMPILING SUMMARY TABLES...");
        try {
            // Fetch specialized summary data
            const [pRes, sRes] = await Promise.all([
                api.runFunction('lib2_pipeline'),
                api.runFunction('lib2_signals')
            ]);

            if (pRes.status === 'success') {
                // Ensure pRes.data is an array and clean it
                const cleaned = Array.isArray(pRes.data) ? pRes.data : [];
                setSummaryData(cleaned);
            }
            if (sRes.status === 'success') setSignalsData(sRes.data);

            // Automatically switch to summary tab on completion
            setActiveTab('summary');

        } catch (err) {
            console.error("Summary compilation failed:", err);
        }
    };

    const SUMMARY_GROUPS = [
        { id: 'price', name: 'PRICE ACTION STRUCTURE', keys: ['open', 'high', 'low', 'close', 'volume', 'ret_1', 'hl_range', 'gap', 'typical_price', 'pivot_high', 'pivot_low', 'resistance_1', 'support_1'] },
        { id: 'trend', name: 'TREND & VOLATILITY', keys: ['sma_fast', 'sma_slow', 'ema_fast', 'ema_slow', 'ema_trend', 'ema_long', 'adx', 'adxr', 'plus_di', 'minus_di', 'atr', 'natr', 'sar', 'volatility'] },
        { id: 'momentum', name: 'MOMENTUM OSCILLATORS', keys: ['macd', 'macdhist', 'rsi', 'stoch_k', 'stoch_d', 'willr', 'cci', 'mfi', 'ultosc', 'roc', 'mom', 'stochrsi_k'] },
        { id: 'volume', name: 'VOLUME & LIQUIDITY FLOW', keys: ['obv', 'adosc', 'chaikin_osc', 'volume_sma', 'volume_z', 'volume_ratio', 'price_volume_force', 'ad'] },
        { id: 'stats', name: 'STATISTICAL METRICS', keys: ['z_close', 'z_volume', 'rolling_skew', 'rolling_kurt', 'sharpe_like', 'fractal_efficiency', 'trend_strength_score', 'ht_dcperiod', 'ht_dcphase'] },
    ];

    const renderModuleCharts = (funcId, charts) => {
        if (!analyzer || !charts) return;
        charts.forEach((cData, i) => {
            const elId = `chart-${funcId}-${i}`;
            if (document.getElementById(elId)) {
                analyzer._renderSingle(elId, cData);
            }
        });
    };

    const selectAll = () => setSelectedFunctions(functionsList().map(f => f.id));
    const unselectAll = () => setSelectedFunctions([]);

    const toggleFunc = (id) => {
        setSelectedFunctions(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const switchTab = async (tabId) => {
        setActiveTab(tabId);
        if (sessionStatus() && analyzer) {
            // Re-render all charts for the current tab from cache
            setTimeout(() => {
                functionsList().forEach(f => {
                    if (f.category === tabId && chartsData()[f.id]) {
                        renderModuleCharts(f.id, chartsData()[f.id]);
                    }
                });
            }, 100);
        }
    };

    return (
         <div class="flex-1 flex overflow-hidden bg-bg_main" style={{ "font-family": "'Roboto', sans-serif" }}>
            {/* Left Sidebar - Collapsible */}
            <aside 
                class={`sidebar-terminal p-8 space-y-8 overflow-hidden z-10 relative transition-all duration-500 ease-in-out ${sidebarOpen() ? 'w-80 opacity-100' : 'w-0 p-0 opacity-0 border-none'}`}
            >
                {/* Toggle Button Inside Sidebar (top right) */}
                <button 
                    onClick={() => setSidebarOpen(false)}
                    class="absolute top-4 right-4 text-text_secondary hover:text-text_accent transition-colors"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                </button>

                <div class="border-l-4 border-text_accent pl-4 shrink-0">
                    <h1 class="text-lg font-black text-white tracking-[0.2em] uppercase leading-tight">ADVANCED ANALYTICS TERMINAL</h1>
                    <p class="text-[11px] text-text_accent font-bold opacity-80 mt-1 uppercase tracking-widest">QUANTITATIVE ANALYTICS ENGINE v4.2</p>
                </div>

                {/* Search Interface */}
                <div class="space-y-2 relative">
                    <div class="relative">
                        <input
                            type="text"
                            value={query()}
                            onInput={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && performSearch(query())}
                            placeholder="SEARCH TICKER/NAME..."
                            class="w-full bg-bg_main border border-border_main/50 p-3 pl-10 rounded text-text_primary placeholder:text-text_secondary/30 outline-none focus:border-text_accent transition-all font-mono uppercase text-[11px]"
                        />
                        <div class="absolute left-3 top-1/2 -translate-y-1/2 text-text_accent opacity-40">
                            <Show when={!searching()} fallback={<div class="w-3 h-3 border-2 border-text_accent border-t-transparent rounded-full animate-spin"></div>}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                            </Show>
                        </div>
                    </div>

                    {/* Search Results Dropdown */}
                    <Show when={searchResults().length > 0}>
                        <div class="absolute top-full left-0 w-full bg-bg_sidebar border border-border_main rounded-lg mt-2 shadow-2xl z-[100] max-h-[400px] overflow-y-auto win-scroll backdrop-blur-xl">
                            <For each={searchResults()}>
                                {(item) => (
                                    <button
                                        onClick={() => selectAsset(item)}
                                        class="w-full p-4 flex flex-col items-start hover:bg-text_accent/10 border-b border-white/5 transition-all text-left group"
                                    >
                                        <div class="flex justify-between w-full mb-1">
                                            <span class="text-[13px] font-black text-text_accent group-hover:text-white">{item.symbol}</span>
                                            <span class="text-[10px] text-text_secondary opacity-60">{item.type}</span>
                                        </div>
                                        <span class="text-[11px] text-text_secondary truncate w-full opacity-80">{item.name}</span>
                                    </button>
                                )}
                            </For>
                        </div>
                    </Show>
                </div>

                {/* Analysis Selection Checklist */}
                <Show when={functionsList().length > 0}>
                    <div class="flex-1 flex flex-col min-h-0 pt-6 border-t border-border_main/30 overflow-hidden">
                        <div class="flex flex-col gap-4 mb-6">
                            <h3 class="text-[11px] font-black text-text_secondary opacity-60 uppercase tracking-[0.2em]">ANALYSIS MODULES</h3>
                            <div class="flex flex-wrap gap-2">
                                <Show when={!loading()} fallback={
                                    <button onClick={() => setShouldStop(true)} class="btn-terminal border-red-500/50 text-red-500 animate-pulse w-full">STOP ANALYSIS</button>
                                }>
                                    <button onClick={() => runAnalysis('selected')} disabled={selectedFunctions().length === 0} class={`btn-terminal flex-1 ${selectedFunctions().length > 0 ? 'btn-terminal-active' : 'opacity-50'}`}>RUN SELECTED</button>
                                    <button onClick={selectAll} class="btn-terminal px-3">ALL</button>
                                    <button onClick={unselectAll} class="btn-terminal px-3">NONE</button>
                                </Show>
                            </div>
                        </div>

                        <div class="flex-1 overflow-y-auto win-scroll space-y-5 pr-2">
                            <For each={categories}>
                                {(cat) => (
                                    <div class="space-y-3">
                                        <div class="text-[11px] font-black text-text_accent flex items-center justify-between">
                                            <div class="flex items-center gap-3">
                                                <div class="w-1.5 h-4 bg-text_accent/40 rounded-full"></div>
                                                {cat.name}
                                            </div>
                                            <span class="text-[9px] opacity-30 font-mono tracking-tighter">{functionsList().filter(f => f.category === cat.id).length} MODULES</span>
                                        </div>
                                            <div class="space-y-2 ml-1 pl-4 border-l-2 border-white/5">
                                                <For each={functionsList().filter(f => f.category === cat.id)}>
                                                    {(f) => (
                                                        <label class="flex items-center gap-4 group cursor-pointer py-1.5 hover:translate-x-1 transition-transform">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedFunctions().includes(f.id)}
                                                                onChange={() => toggleFunc(f.id)}
                                                                class="w-3.5 h-3.5 rounded bg-bg_main border-white/10 accent-text_accent"
                                                            />
                                                            <div class="flex flex-col">
                                                                <span class={`text-[12px] font-medium tracking-tight transition-all ${selectedFunctions().includes(f.id) ? 'text-white' : 'text-text_secondary/40'}`}>{f.name}</span>
                                                            </div>
                                                            <Show when={moduleStatus()[f.id] === 'DONE'}>
                                                                <div class="ml-auto w-2 h-2 rounded-full bg-text_accent shadow-[0_0_12px_var(--text-accent)]"></div>
                                                            </Show>
                                                            <Show when={moduleStatus()[f.id] === 'RUNNING'}>
                                                                <div class="ml-auto w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                                                            </Show>
                                                            <Show when={moduleStatus()[f.id] === 'ERROR'}>
                                                                <div class="ml-auto text-[10px] text-red-500 font-bold">FAIL</div>
                                                            </Show>
                                                        </label>
                                                    )}
                                                </For>
                                            </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>

                <Show when={error()}>
                    <div class="bg-red-500/10 border border-red-500/30 p-3 rounded text-[9px] text-red-400 font-bold uppercase">
                        {error()}
                    </div>
                </Show>

                {/* Global Progress */}
                <Show when={sessionStatus()}>
                    <div class="pt-6 border-t border-white/5">
                        <div class="flex justify-between items-end mb-3">
                            <span class="text-[11px] font-black text-text_accent animate-pulse truncate max-w-[200px] uppercase tracking-wider">{currentTask()}</span>
                            <span class="text-[10px] text-text_secondary font-mono opacity-50">{sessionStatus().completed}/{sessionStatus().total}</span>
                        </div>
                        <div class="w-full h-1 bg-border_main rounded-full overflow-hidden">
                            <div
                                class={`h-full transition-all duration-300 ${currentTask() === 'ANALYSIS COMPLETED.' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-text_accent shadow-[0_0_8px_var(--text-accent)]'}`}
                                style={{ width: `${currentTask() === 'ANALYSIS COMPLETED.' ? '100' : (sessionStatus().completed / sessionStatus().total) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </Show>
            </aside>

            {/* Main Content */}
            <main class="flex-1 flex flex-col overflow-hidden bg-bg_main relative">
                {/* Global Sidebar Toggle (visible when sidebar is closed) */}
                <Show when={!sidebarOpen()}>
                    <button 
                        onClick={() => setSidebarOpen(true)}
                        class="absolute top-4 left-4 z-[100] bg-bg_header/80 border border-text_accent/20 p-2 rounded-lg text-text_accent hover:bg-text_accent hover:text-bg_main transition-all shadow-xl"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                </Show>

                {/* Dynamic Tab Bar */}
                <div class="flex items-center gap-2 bg-bg_header/60 px-8 py-3 border-b border-border_main overflow-x-auto no-scrollbar backdrop-blur-md">
                    <For each={categories}>
                        {(cat) => (
                            <Show when={cat.id !== 'summary' || currentTask() === 'ANALYSIS COMPLETED.' || (sessionStatus() && sessionStatus().completed === sessionStatus().total && sessionStatus().total > 0)}>
                                <button
                                    onClick={() => switchTab(cat.id)}
                                    class={`px-6 py-2 text-[12px] font-black tracking-[0.15em] transition-all border-b-2 relative shrink-0 ${activeTab() === cat.id ? 'border-text_accent text-text_accent bg-text_accent/5' : 'border-transparent text-text_secondary opacity-40 hover:opacity-100'}`}
                                >
                                    {cat.name}
                                </button>
                            </Show>
                        )}
                    </For>
                </div>

                <div class="flex-1 overflow-y-auto win-scroll p-8 space-y-12">
                    {/* Selected Asset Header */}
                    <Show when={selectedAsset()}>
                        <div class="flex items-center justify-between border-b border-border_main/30 pb-6">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-text_accent/10 border border-text_accent/20 rounded-lg flex items-center justify-center text-text_accent font-black text-xl">
                                    {selectedAsset().symbol[0]}
                                </div>
                                <div>
                                    <h2 class="text-xl font-black text-white">{selectedAsset().name}</h2>
                                    <div class="flex items-center gap-3 mt-1">
                                        <span class="text-xs font-mono text-text_accent">{selectedAsset().symbol}</span>
                                        <span class="px-2 py-0.5 bg-white/5 rounded text-[8px] text-text_secondary uppercase">{selectedAsset().exch}</span>
                                        <span class="px-2 py-0.5 bg-white/5 rounded text-[8px] text-text_secondary uppercase">{selectedAsset().type}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Timeframe Selectors */}
                            <div class="flex bg-bg_sidebar/50 p-1 rounded-lg border border-white/5">
                                <For each={['1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y']}>
                                    {(tf) => (
                                        <button
                                            onClick={() => selectAsset(selectedAsset(), tf)}
                                            class={`px-3 py-1 text-[10px] font-bold transition-all rounded ${timeframe() === tf ? 'bg-text_accent text-bg_main shadow-[0_0_10px_var(--text-accent)]' : 'text-text_secondary hover:text-white'}`}
                                        >
                                            {tf}
                                        </button>
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>

                    {/* Main Analysis Container */}
                    <div class="space-y-6">
                        <div class="flex items-center gap-6">
                            <span class="text-[9px] font-black text-text_accent uppercase tracking-[0.4em]">{activeTab()} ANALYTICS</span>
                            <div class="h-px bg-gradient-to-r from-text_accent/30 to-transparent flex-1"></div>
                        </div>
                        <div id="deep-charts-content" class="min-h-[600px] w-full relative">
                            <Show 
                                when={sessionStatus()} 
                                fallback={
                                    <div class="absolute inset-0 flex flex-col items-center justify-center opacity-20">
                                        <div class="w-32 h-32 border-2 border-dashed border-text_accent/30 rounded-full animate-[spin_10s_linear_infinite] flex items-center justify-center">
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
                                        </div>
                                        <span class="text-[9px] font-bold tracking-[0.5em] uppercase mt-6 ml-4">WAITING FOR TARGET SELECTION</span>
                                    </div>
                                }
                            >
                                <div class="space-y-12">
                                    {/* OHLCV PREVIEW */}
                                    <div class="bg-bg_sidebar/20 border border-white/5 rounded-lg overflow-hidden flex flex-col">
                                        <div class="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.03]">
                                            <div class="flex items-center gap-8">
                                                <span class="text-[11px] font-black text-text_accent tracking-[0.2em] uppercase">MARKET DATA PREVIEW</span>
                                                <div class="flex gap-2 p-1 bg-black/50 rounded-lg">
                                                    <button onClick={() => setViewMode('chart')} class={`px-4 py-1.5 text-[10px] font-black tracking-widest rounded transition-all ${viewMode() === 'chart' ? 'bg-text_accent text-bg_main' : 'text-text_secondary hover:text-white'}`}>CANDLESTICK</button>
                                                    <button onClick={() => setViewMode('table')} class={`px-4 py-1.5 text-[10px] font-black tracking-widest rounded transition-all ${viewMode() === 'table' ? 'bg-text_accent text-bg_main' : 'text-text_secondary hover:text-white'}`}>HISTORICAL DATA</button>
                                                </div>
                                            </div>
                                            <div class="flex gap-4">
                                                <div class="flex flex-col items-end border-r border-white/10 pr-4">
                                                    <span class="text-[10px] text-text_secondary opacity-40 uppercase tracking-widest">Data Points</span>
                                                    <span class="text-[13px] font-black font-mono text-white">{ohlcvData().length}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="p-4 min-h-[450px]">
                                            <div 
                                                id="preview-ohlcv-chart" 
                                                style={{ 
                                                    height: '450px', 
                                                    width: '100%',
                                                    display: viewMode() === 'chart' ? 'block' : 'none' 
                                                }}
                                            ></div>
                                            
                                            <div 
                                                style={{ 
                                                    display: viewMode() === 'table' ? 'block' : 'none' 
                                                }}
                                                class="max-h-[450px] overflow-auto win-scroll"
                                            >
                                                <table class="w-full text-left font-mono text-[11px]">
                                                    <thead class="sticky top-0 bg-bg_main border-b border-white/10 text-text_accent uppercase font-black">
                                                        <tr>
                                                            <th class="p-3">Date</th>
                                                            <th class="p-3">Open</th>
                                                            <th class="p-3">High</th>
                                                            <th class="p-3">Low</th>
                                                            <th class="p-3">Close</th>
                                                            <th class="p-3 text-right">Volume</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody class="divide-y divide-white/5">
                                                        <For each={[...ohlcvData()].reverse().slice(0, 100)}>
                                                            {(h) => (
                                                                <tr class="hover:bg-white/5 transition-colors">
                                                                    <td class="p-2 opacity-60">{h.date}</td>
                                                                    <td class="p-2 text-white">{h.open?.toFixed(2)}</td>
                                                                    <td class="p-2 text-green-400">{h.high?.toFixed(2)}</td>
                                                                    <td class="p-2 text-red-400">{h.low?.toFixed(2)}</td>
                                                                    <td class="p-2 font-bold text-text_accent">{h.close?.toFixed(2)}</td>
                                                                    <td class="p-2 text-right opacity-40">{h.volume?.toLocaleString()}</td>
                                                                </tr>
                                                            )}
                                                        </For>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>


                                    {/* SUMMARY TABLE VIEW */}
                                    <Show when={activeTab() === 'summary'}>
                                        <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            {/* Header Metrics */}
                                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div class="bg-bg_sidebar/40 border border-white/5 p-6 rounded-lg flex flex-col items-center">
                                                    <span class="text-[8px] font-black text-text_accent uppercase tracking-[0.2em] mb-2">Market Health</span>
                                                    <div class="text-3xl font-black text-white">
                                                         {summaryData()?.find(d => d.index === 'composite_long_score')?.['0']?.toFixed(2) || '0.00'}
                                                    </div>
                                                    <div class="w-full h-1 bg-white/5 mt-4 rounded-full overflow-hidden">
                                                        <div class="h-full bg-text_accent" style={{ width: `${Math.min(100, (summaryData()?.find(d => d.index === 'composite_long_score')?.['0'] || 0) * 100)}%` }}></div>
                                                    </div>
                                                </div>
                                                <div class="bg-bg_sidebar/40 border border-white/5 p-6 rounded-lg flex flex-col items-center">
                                                    <span class="text-[8px] font-black text-text_accent uppercase tracking-[0.2em] mb-2">Trend Strength Index</span>
                                                    <div class="text-3xl font-black text-white">
                                                         {summaryData()?.find(d => d.index === 'trend_score')?.['0']?.toFixed(2) || '0.00'}
                                                    </div>
                                                    <div class="w-full h-1 bg-white/5 mt-4 rounded-full overflow-hidden">
                                                        <div class="h-full bg-blue-500" style={{ width: `${Math.min(100, (summaryData()?.find(d => d.index === 'trend_score')?.['0'] || 0) * 100)}%` }}></div>
                                                    </div>
                                                </div>
                                                <div class="bg-bg_sidebar/40 border border-white/5 p-6 rounded-lg flex flex-col items-center">
                                                    <span class="text-[8px] font-black text-text_accent uppercase tracking-[0.2em] mb-2">Signal Conviction</span>
                                                    <div class="text-3xl font-black text-white">
                                                         {chartsData()['master_signal']?.[0]?.series?.[0]?.data?.slice(-1)[0]?.value?.toFixed(2) || 'N/A'}
                                                    </div>
                                                    <div class="w-full h-1 bg-white/5 mt-4 rounded-full overflow-hidden">
                                                        <div class="h-full bg-green-500" style={{ width: `${Math.min(100, Math.abs(chartsData()['master_signal']?.[0]?.series?.[0]?.data?.slice(-1)[0]?.value || 0) * 10)}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Data Tables */}
                                            <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                                {/* Institutional Score Matrix */}
                                                <div class="bg-bg_sidebar/40 border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                                                    <div class="px-6 py-5 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
                                                        <span class="text-[12px] font-black text-white tracking-[0.2em] uppercase">ANALYSIS RECORDS</span>
                                                        <span class="text-[10px] text-text_accent font-bold font-mono opacity-60">SOURCE: ANALYTIC ENGINE</span>
                                                    </div>
                                                    <div class="p-8 overflow-x-auto">
                                                        <table class="w-full text-left font-mono text-[11px]">
                                                            <thead>
                                                                <tr class="text-text_secondary uppercase opacity-40 border-b border-white/5">
                                                                    <th class="pb-4">Analysis Metric</th>
                                                                    <th class="pb-4 text-right">Score</th>
                                                                    <th class="pb-4 text-center">Market Sentiment</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody class="divide-y divide-white/5">
                                                                <For each={summaryData()?.filter(d => d.index.includes('_score'))}>
                                                                    {(row) => (
                                                                        <tr class="hover:bg-white/5 transition-colors group">
                                                                            <td class="py-3 text-white font-bold">{row.index.replace('_score', '').toUpperCase()}</td>
                                                                            <td class="py-3 text-right font-mono text-text_accent">{row['0']?.toFixed(4)}</td>
                                                                            <td class="py-3 text-center">
                                                                                <span class={`px-2 py-0.5 rounded-sm ${row['0'] > 0.5 ? 'bg-green-500/10 text-green-400' : row['0'] < -0.5 ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-text_secondary'}`}>
                                                                                    {row['0'] > 0.5 ? 'OVERBOUGHT' : row['0'] < -0.5 ? 'OVERSOLD' : 'NEUTRAL'}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </For>
                                                            </tbody>
                                                        </table>
                                                        <Show when={!summaryData()}>
                                                            <div class="flex flex-col items-center py-12 opacity-20">
                                                                <div class="w-8 h-8 border-2 border-t-text_accent rounded-full animate-spin"></div>
                                                                <span class="text-[8px] mt-4 uppercase">COMPUTING DATA...</span>
                                                            </div>
                                                        </Show>
                                                    </div>
                                                </div>

                                                {/* Advanced Signal Events */}
                                                <div class="bg-bg_sidebar/40 border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                                                    <div class="px-6 py-5 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
                                                        <span class="text-[12px] font-black text-white tracking-[0.2em] uppercase">RECENT SIGNAL EVENTS</span>
                                                        <span class="text-[10px] text-text_accent font-bold font-mono opacity-60">ENGINE: ANALYTIC ENGINE</span>
                                                    </div>
                                                    <div class="p-8 overflow-x-auto">
                                                        <table class="w-full text-left font-mono text-[11px]">
                                                            <thead>
                                                                <tr class="text-text_secondary uppercase opacity-40 border-b border-white/5">
                                                                    <th class="pb-4">Timeline</th>
                                                                    <th class="pb-4">Market Bias</th>
                                                                    <th class="pb-4 text-right">Conviction</th>
                                                                    <th class="pb-4 text-right">Price</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody class="divide-y divide-white/5">
                                                                <For each={[...(signalsData() || [])].reverse().slice(0, 10)}>
                                                                    {(sig) => (
                                                                        <tr class="hover:bg-white/5 transition-colors">
                                                                            <td class="py-3 opacity-40">#{sig.index}</td>
                                                                            <td class="py-3">
                                                                                <span class={`font-black uppercase ${sig.type === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                                                                                    {sig.type === 'long' ? '⚡ BULLISH' : '🔥 BEARISH'}
                                                                                </span>
                                                                            </td>
                                                                            <td class="py-3 text-right">{(sig.long_score || sig.short_score)?.toFixed(2)}</td>
                                                                            <td class="py-3 text-right text-white font-black">{sig.close?.toFixed(2)}</td>
                                                                        </tr>
                                                                    )}
                                                                </For>
                                                            </tbody>
                                                        </table>
                                                        <Show when={signalsData()?.length === 0}>
                                                            <div class="flex flex-col items-center py-12 opacity-20">
                                                                <span class="text-[8px] uppercase tracking-widest">No_Trade_Signals_Detected</span>
                                                            </div>
                                                        </Show>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Detailed Price & Structure Table Groups */}
                                            <div class="space-y-6">
                                                <div class="flex items-center justify-between">
                                                    <span class="text-[12px] font-black text-white tracking-[0.3em] uppercase">DETAILED MARKET METRICS</span>
                                                    <button onClick={compileSummary} class="text-[8px] font-black text-text_accent hover:underline uppercase">REFRESH ALL</button>
                                                </div>

                                                <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                                                    <For each={SUMMARY_GROUPS}>
                                                        {(group) => (
                                                            <div class="bg-bg_sidebar/40 border border-white/5 rounded-lg overflow-hidden flex flex-col max-h-[400px]">
                                                                <div class="px-5 py-4 border-b border-white/5 bg-white/[0.03] flex items-center justify-between shrink-0">
                                                                    <span class="text-[10px] font-black text-text_accent tracking-widest uppercase">{group.name}</span>
                                                                    <span class="text-[9px] opacity-30 font-bold font-mono uppercase tracking-tighter">{group.keys.length} Metrics</span>
                                                                </div>
                                                                <div class="overflow-y-auto win-scroll p-6">
                                                                    <table class="w-full text-left font-mono text-[11px]">
                                                                        <tbody class="divide-y divide-white/5">
                                                                            <For each={group.keys}>
                                                                                {(key) => {
                                                                                    const item = summaryData()?.find(d => d.index.toLowerCase() === key.toLowerCase());
                                                                                    if (!item) return null;
                                                                                    return (
                                                                                        <tr class="hover:bg-white/5 transition-colors">
                                                                                            <td class="py-2 text-white/50 text-[8px] uppercase">{key.replace(/_/g, ' ')}</td>
                                                                                            <td class="py-2 text-right font-bold text-white">
                                                                                                {typeof item['0'] === 'number' ? item['0'].toFixed(4) : (typeof item['0'] === 'string' ? item['0'].toUpperCase() : '-')}
                                                                                            </td>
                                                                                            <td class="py-2 pl-4 text-right">
                                                                                                <div class="inline-block w-8 h-1 bg-white/5 rounded-full overflow-hidden">
                                                                                                    <div class={`h-full ${Math.abs(item['0']||0) > 1 ? 'bg-text_accent' : 'bg-white/20'}`} 
                                                                                                         style={{ width: `${Math.min(100, Math.abs(item['0']||0) * 10)}%` }}></div>
                                                                                                </div>
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                }}
                                                                            </For>
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>
                                        </div>
                                    </Show>

                                    {/* ANALYSIS GRID */}
                                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
                                            <For each={functionsList().filter(f => 
                                                f.category === activeTab() && 
                                                moduleStatus()[f.id] && 
                                                (moduleStatus()[f.id] !== "DONE" || (chartsData()[f.id] && chartsData()[f.id].length > 0))
                                            )}>
                                                {(f) => (
                                                    <div 
                                                        class={`flex flex-col bg-bg_sidebar/40 border border-white/5 rounded-lg overflow-hidden min-h-[400px] ${
                                                            (chartsData()[f.id]?.length > 1) ? 'xl:col-span-2' : ''
                                                        }`}
                                                    >
                                                        <div class="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                                                            <span class="text-[9px] font-black text-white tracking-widest uppercase">{f.name}</span>
                                                            <div class="flex items-center gap-2">
                                                                <Show when={moduleStatus()[f.id] === 'RUNNING'}>
                                                                    <div class="flex items-center gap-2">
                                                                        <div class="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                                                                        <span class="text-[7px] text-yellow-500 font-bold uppercase animate-pulse">COMPUTING</span>
                                                                    </div>
                                                                </Show>
                                                                <Show when={moduleStatus()[f.id] === 'DONE'}>
                                                                    <div class="w-1.5 h-1.5 bg-text_accent rounded-full shadow-[0_0_8px_var(--text-accent)]"></div>
                                                                </Show>
                                                                <Show when={moduleStatus()[f.id] === 'ERROR'}>
                                                                    <div class="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                                                                </Show>
                                                            </div>
                                                        </div>
                                                        
                                                        <div class="flex-1 relative flex flex-col p-4">
                                                            {/* Placeholders */}
                                                            <Show when={!moduleStatus()[f.id] || moduleStatus()[f.id] === 'PENDING' || moduleStatus()[f.id] === 'RUNNING'}>
                                                                <div class="absolute inset-0 flex flex-col items-center justify-center p-12 space-y-4">
                                                                    <div class="w-full h-2 bg-white/5 rounded animate-pulse"></div>
                                                                    <div class="w-3/4 h-2 bg-white/5 rounded animate-pulse delay-75"></div>
                                                                    <div class="w-1/2 h-2 bg-white/5 rounded animate-pulse delay-150"></div>
                                                                    
                                                                    <div class="mt-8 flex flex-col items-center">
                                                                        <div class="w-10 h-10 border-2 border-t-text_accent border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                                                                        <span class="text-[8px] font-mono text-text_secondary mt-4 opacity-40 uppercase">AWAITING COMPUTE RESOURCES...</span>
                                                                    </div>
                                                                </div>
                                                            </Show>

                                                            {/* Chart Content Area - Adaptive Grid */}
                                                            <div 
                                                                class={`flex-1 grid gap-4 ${
                                                                    chartsData()[f.id]?.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                                                                }`}
                                                            >
                                                                <For each={chartsData()[f.id] || []}>
                                                                    {(cData, i) => (
                                                                        <div 
                                                                            id={`chart-${f.id}-${i()}`} 
                                                                            style={{ 
                                                                                height: (chartsData()[f.id]?.length > 2) ? '350px' : '450px', 
                                                                                width: '100%' 
                                                                            }}
                                                                            class="rounded-md border border-white/5 bg-bg_main/20 relative"
                                                                        >
                                                                            {/* Native Title Overlay for Grid Layout */}
                                                                            <div class="absolute top-2 left-4 z-10">
                                                                                <span class="text-[8px] font-mono text-text_secondary opacity-30 uppercase">{cData.title}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </For>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </div>
                             </Show>
                        </div>
                    </div>
                </div>
                {/* Init Loading Overlay */}
                <Show when={loading() && !sessionStatus()?.completed}>
                    <div class="absolute inset-0 bg-bg_main/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center space-y-6">
                        <div class="w-16 h-16 border-t-2 border-r-2 border-text_accent rounded-full animate-spin"></div>
                        <div class="flex flex-col items-center">
                            <span class="text-[11px] font-black tracking-[1em] text-text_accent animate-pulse uppercase">INITIALIZING ENGINE</span>
                            <span class="text-[9px] text-text_secondary mt-2 font-mono uppercase">PARSING MARKET DEPTH // {currentTask()}</span>
                        </div>
                    </div>
                </Show>
            </main>
        </div>
    );
};

export default AdvancedDeepAnalyticsView;
