import { createSignal, Show, For, onMount } from 'solid-js';
import { DeepAnalysisAPI, EChartsDeepAnalyzer } from '../../components/echarts_analyzer';

export default function DeepAnalyticsModule(props) {
  const [query, setQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal([]);
  const [selectedAsset, setSelectedAsset] = createSignal({ symbol: "MSFT", type: "STOCK", name: "Microsoft Corporation" });
  const [loading, setLoading] = createSignal(false);
  const [searching, setSearching] = createSignal(false);
  const [currentTask, setCurrentTask] = createSignal("IDLE");
  const [functionsList, setFunctionsList] = createSignal([]);
  const [activeTab, setActiveTab] = createSignal("core");
  const [activeMethodId, setActiveMethodId] = createSignal("");
  const [timeframe, setTimeframe] = createSignal("1Y");
  const [error, setError] = createSignal(null);
  const [moduleStatus, setModuleStatus] = createSignal({}); 
  const [chartsData, setChartsData] = createSignal({}); 
  const [sidebarOpen, setSidebarOpen] = createSignal(true); 
  const [isEditingAsset, setIsEditingAsset] = createSignal(false); 

  const api = new DeepAnalysisAPI(`${import.meta.env.VITE_DEEP_TA_API}/api`);
  let analyzer;

  const categories = [
    { id: 'core', name: 'CORE METRICS' },
    { id: 'smart_money', name: 'INSTITUTIONAL FLOW' },
    { id: 'scoring', name: 'QUANT SCORING' },
    { id: 'spectral', name: 'CYCLE ANALYSIS' },
    { id: 'complexity', name: 'MARKET DYNAMICS' },
    { id: 'risk', name: 'RISK METRICS' },
    { id: 'oscillator', name: 'DIVERGENCE' }
  ];

  onMount(() => {
    analyzer = new EChartsDeepAnalyzer(`deep-charts-${props.id}`);
    if (selectedAsset()) {
      selectAsset(selectedAsset());
    }
  });

  const performSearch = async (val) => {
    setQuery(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const [stockRes, cryptoRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/search?q=${encodeURIComponent(val)}`).then(r => r.json()).catch(() => ({ quotes: [] })),
        fetch(`${import.meta.env.VITE_CRYPTO_API}/api/crypto/search?q=${encodeURIComponent(val)}`).then(r => r.json()).catch(() => ({ data: [] }))
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

      setSearchResults([...stocks, ...cryptos].slice(0, 10));
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
    setFunctionsList([]);
    setActiveMethodId("");
    setChartsData({});
    setModuleStatus({});

    try {
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
        await initAnalysisEngine(asset, tf, normalized);
      } else {
        setError("No historical data found.");
      }
    } catch (err) {
      setError("Failed to load historical data.");
    } finally {
      setLoading(false);
    }
  };

  const initAnalysisEngine = async (asset, tf, history) => {
    try {
      setCurrentTask("INITIALIZING ENGINE...");
      const initRes = await api.init(asset.symbol, null, null, history, tf);
      if (initRes.status !== 'success') throw new Error(initRes.error);

      const functions = initRes.available_functions_details || [];
      setFunctionsList(functions);
      setCurrentTask("READY: SELECT CATEGORY & METHOD");
    } catch (err) {
      setError("Engine initialization failed.");
    }
  };

  const runSingleAnalysis = async (methodId) => {
    if (!methodId || loading()) return;
    setLoading(true);
    setError(null);

    const f = functionsList().find(m => m.id === methodId);
    if (!f) {
      setLoading(false);
      return;
    }

    setModuleStatus(prev => ({ ...prev, [methodId]: 'RUNNING' }));
    setCurrentTask(`RUNNING: ${f.name}`);
    
    try {
      const res = await api.runFunction(methodId);
      if (res.status === 'success') {
        setModuleStatus(prev => ({ ...prev, [methodId]: 'DONE' }));
        const cRes = await api.getSingleChart(methodId);
        if (cRes.status === 'success' && Array.isArray(cRes.charts)) {
          setChartsData(prev => ({ ...prev, [methodId]: cRes.charts }));
          setTimeout(() => renderModuleCharts(methodId, cRes.charts), 50);
        }
      } else {
        setModuleStatus(prev => ({ ...prev, [methodId]: 'ERROR' }));
        setError(`Failed to compute ${f.name}`);
      }
    } catch (err) {
      setModuleStatus(prev => ({ ...prev, [methodId]: 'ERROR' }));
      setError(`Error executing ${f.name}`);
    } finally {
      setCurrentTask("COMPLETED");
      setLoading(false);
    }
  };

  const renderModuleCharts = (funcId, charts) => {
    if (!analyzer || !charts) return;
    charts.forEach((cData, i) => {
      const elId = `chart-${props.id}-${funcId}-${i}`;
      if (document.getElementById(elId)) {
        analyzer._renderSingle(elId, cData);
      }
    });
  };

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    setActiveMethodId(""); // Clear method on category swap
  };

  return (
    <div class="h-full flex flex-col bg-[#050505] text-text_primary font-mono text-[10px] relative p-3">
      {/* Step 1: Input Entity & Timeframe */}
      <div class="flex items-center gap-3 border-b border-white/5 pb-2 shrink-0">
        <div class="relative flex-1">
          <Show when={selectedAsset() && !isEditingAsset()} fallback={
            <>
              <input
                type="text"
                value={query()}
                onInput={(e) => performSearch(e.target.value)}
                placeholder="[1] SEARCH & SELECT ASSET..."
                class="w-full bg-[#111] border border-white/10 px-2 py-1 text-text_accent text-[10px] font-mono outline-none focus:border-text_accent/50 rounded-sm"
              />
              <Show when={searchResults().length > 0}>
                <div class="absolute top-full left-0 w-full bg-[#0a0a0a] border border-white/10 shadow-2xl z-[100] max-h-48 overflow-y-auto mt-1 rounded-sm">
                  <For each={searchResults()}>
                    {(item) => (
                      <button
                        onClick={() => {
                          selectAsset(item);
                          setIsEditingAsset(false);
                        }}
                        class="w-full text-left px-3 py-1.5 hover:bg-text_accent hover:text-black border-b border-white/5 last:border-none"
                      >
                        <div class="flex justify-between font-bold">
                          <span>{item.symbol}</span>
                          <span class="opacity-50 text-[8px]">{item.type}</span>
                        </div>
                        <div class="text-[8px] opacity-70 truncate">{item.name}</div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </>
          }>
            <div class="flex items-center justify-between bg-[#111] border border-white/10 px-3 py-1 rounded-sm text-text_accent font-mono">
              <span class="font-bold text-[9px] truncate pr-2">{selectedAsset().symbol} - <span class="text-white/60 font-normal">{selectedAsset().name}</span></span>
              <button 
                onClick={() => setIsEditingAsset(true)} 
                class="text-[7px] font-bold border border-white/10 px-1.5 py-0.5 rounded-sm hover:bg-text_accent hover:text-black text-white/50 transition-all"
              >
                CHANGE
              </button>
            </div>
          </Show>
        </div>

        <div class="flex gap-1">
          <For each={['1M', '3M', '1Y', '3Y']}>
            {(tf) => (
              <button
                onClick={() => selectAsset(selectedAsset(), tf)}
                class={`px-2 py-1 border rounded-sm text-[8px] font-bold ${timeframe() === tf ? 'bg-text_accent text-black border-text_accent' : 'border-white/10 text-text_secondary hover:border-text_accent/50'}`}
              >
                {tf}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="text-[8px] opacity-40 py-1 border-b border-white/5 shrink-0">
        STATUS: {currentTask()} | ASSET: {selectedAsset().symbol} ({selectedAsset().name})
      </div>

      {/* Main Grid */}
      <div class="flex-1 flex min-h-0 pt-2 gap-3 overflow-hidden">
        {/* Step 2 & 3: Choose Analysis & Method in One Sidebar */}
        <div class={`transition-all duration-300 ease-in-out shrink-0 border-r border-white/5 flex flex-col pr-2 overflow-y-auto no-scrollbar font-mono relative ${sidebarOpen() ? 'w-48 opacity-100 gap-3' : 'w-0 opacity-0 border-none px-0 overflow-hidden'}`}>
          <div class="text-[7px] opacity-30 font-black tracking-widest px-1">[2] ANALYSIS & METHODS</div>
          <For each={categories}>
            {(cat) => (
              <div class="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-b-0">
                <button
                  onClick={() => setActiveTab(cat.id)}
                  class={`text-left px-2 py-1 rounded-sm text-[8px] font-black tracking-wide uppercase border transition-all ${activeTab() === cat.id ? 'bg-text_accent/10 border-text_accent/20 text-text_accent' : 'border-transparent text-text_secondary/80 hover:text-white'}`}
                >
                  {cat.name}
                </button>
                
                {/* Render sub methods IF active category */}
                <Show when={activeTab() === cat.id}>
                  <div class="flex flex-col gap-0.5 pl-1.5 mt-0.5 border-l border-white/5 ml-2">
                    <For each={functionsList().filter(f => f.category === cat.id)}>
                      {(f) => (
                        <button
                          onClick={() => {
                            setActiveMethodId(f.id);
                            if (chartsData()[f.id]) {
                              setTimeout(() => renderModuleCharts(f.id, chartsData()[f.id]), 50);
                            }
                          }}
                          class={`text-left px-2 py-1 rounded-sm text-[8px] font-bold tracking-tight uppercase border transition-all ${activeMethodId() === f.id ? 'bg-text_accent/20 border-text_accent text-text_accent' : 'border-transparent text-text_secondary/50 hover:text-text_secondary'}`}
                        >
                          <div class="flex justify-between items-center w-full">
                            <span class="truncate pr-1 text-[8px]">{f.name}</span>
                            <Show when={moduleStatus()[f.id] === 'DONE'}>
                              <div class="w-1 h-1 bg-green-500 rounded-full shadow-[0_0_4px_#22c55e] shrink-0"></div>
                            </Show>
                            <Show when={moduleStatus()[f.id] === 'RUNNING'}>
                              <div class="w-1 h-1 bg-yellow-500 rounded-full animate-pulse shrink-0"></div>
                            </Show>
                          </div>
                        </button>
                      )}
                    </For>
                    <Show when={functionsList().filter(f => f.category === cat.id).length === 0}>
                      <span class="text-[7px] text-white/20 italic pl-2 py-1">No methods loaded</span>
                    </Show>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>

        {/* Column 4: Step 4: Display Output results */}
        <div class="flex-1 flex flex-col min-h-0 overflow-y-auto win-scroll pr-1 relative">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen())}
            title={sidebarOpen() ? "Collapse Sidebar" : "Expand Sidebar"}
            class="absolute top-2 left-2 z-[100] bg-[#111]/80 backdrop-blur-sm border border-white/10 p-1.5 rounded-sm hover:border-text_accent/50 text-text_accent transition-all shadow-md"
          >
            <svg class="w-3.5 h-3.5 transition-transform duration-300" style={{ transform: sidebarOpen() ? 'rotate(0deg)' : 'rotate(180deg)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <Show when={error()}>
            <div class="p-4 text-red-500 bg-red-500/10 border border-red-500/20 text-center uppercase font-bold text-[8px]">
              {error()}
            </div>
          </Show>

          <Show when={activeMethodId()} fallback={
            <div class="flex-1 border border-white/5 bg-[#0a0a0a]/30 rounded-sm flex items-center justify-center text-[8px] opacity-25 uppercase tracking-widest select-none">
              Please Select a Method to Start
            </div>
          }>
            {(() => {
              const f = functionsList().find(m => m.id === activeMethodId());
              if (!f) return null;
              return (
                <div class="border border-white/5 bg-[#0a0a0a] rounded-sm flex-1 flex flex-col">
                  <div class="px-3 py-1 bg-white/5 flex justify-between items-center border-b border-white/5 shrink-0">
                    <span class="text-[9px] font-black uppercase tracking-wider text-white">{f.name}</span>
                    <Show when={moduleStatus()[f.id] === 'RUNNING'}>
                      <div class="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                    </Show>
                    <Show when={moduleStatus()[f.id] === 'DONE'}>
                      <div class="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                    </Show>
                  </div>
                  
                  <div class="flex-1 p-3 relative flex flex-col justify-center">
                    <Show when={!moduleStatus()[f.id]}>
                      <div class="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-3">
                        <span class="text-[8px] opacity-40 uppercase tracking-widest text-center">Ready to analyze {f.name}</span>
                        <button
                          onClick={() => runSingleAnalysis(f.id)}
                          class="px-4 py-2 border border-text_accent/30 bg-text_accent/10 hover:bg-text_accent hover:text-black text-text_accent font-bold rounded-sm text-[9px] uppercase tracking-widest transition-all"
                        >
                          ⚡ Execute {f.name}
                        </button>
                      </div>
                    </Show>
                    
                    <Show when={moduleStatus()[f.id] === 'RUNNING'}>
                      <div class="absolute inset-0 flex items-center justify-center text-[8px] text-yellow-500/70 animate-pulse">PROCESSING DATA...</div>
                    </Show>
                    
                    <Show when={moduleStatus()[f.id] === 'DONE' && (!chartsData()[f.id] || chartsData()[f.id].length === 0)}>
                      <div class="absolute inset-0 flex items-center justify-center text-[8px] opacity-40">CALCULATION SUCCESS (NO CHART)</div>
                    </Show>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                      <For each={chartsData()[f.id] || []}>
                        {(_, i) => (
                          <div class="border border-white/5 bg-[#080808] p-2 rounded-sm">
                            <div id={`chart-${props.id}-${f.id}-${i()}`} style={{ height: '260px', width: '100%' }}></div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Show>
        </div>
      </div>
    </div>
  );
}
