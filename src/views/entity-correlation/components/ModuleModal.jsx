import { Show, createSignal, For } from 'solid-js';

const ModuleModal = (props) => {
  const [step, setStep] = createSignal('select'); // 'select', 'keyword', 'preview', 'mgmt_preview', 'chart_setup', 'manual_entry'
  const [localKeyword, setLocalKeyword] = createSignal("");
  const [previewNews, setPreviewNews] = createSignal([]);
  const [previewMgmt, setPreviewMgmt] = createSignal([]);
  const [selectedMgmt, setSelectedMgmt] = createSignal([]); 
  const [loading, setLoading] = createSignal(false);
  const [selectedPeriod, setSelectedPeriod] = createSignal("1mo");
  
  const [manualType, setManualType] = createSignal(""); // 'USER', 'COMPANY', 'LOCATION'
  const [manualData, setManualData] = createSignal({});

  // States untuk fitur pencarian simbol kustom
  const [customSymbol, setCustomSymbol] = createSignal("");
  const [symbolResults, setSymbolResults] = createSignal([]);

  const periods = [
    { label: "1D", value: "1d" },
    { label: "1W", value: "5d" },
    { label: "1M", value: "1mo" },
    { label: "3M", value: "3mo" },
    { label: "6M", value: "6mo" },
    { label: "1Y", value: "1y" },
    { label: "5Y", value: "5y" }
  ];

  const init = () => {
    setStep('select');
    setLocalKeyword(props.node?.symbol || "");
    setCustomSymbol(props.node?.symbol || "");
    setPreviewNews([]);
    setPreviewMgmt([]);
    setSelectedMgmt([]);
    setSelectedPeriod("1mo");
    setSymbolResults([]);
    setManualType("");
    setManualData({});
  };

  // Pencarian Simbol Instan (Re-use backend search logic)
  const handleSearchSymbol = async () => {
    if (!customSymbol()) return;
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/search?q=${encodeURIComponent(customSymbol())}`);
      const res = await response.json();
      setSymbolResults(res.quotes || []);
    } catch (err) {
      console.error("Symbol search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectSymbol = (res) => {
    setCustomSymbol(res.symbol);
    setSymbolResults([]); // Clear results after selection
  };

  const handleAddChart = async () => {
    const symbol = customSymbol().toUpperCase() || props.node.symbol;
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/profile/${encodeURIComponent(symbol)}?period=${selectedPeriod()}`);
      const res = await response.json();
      const data = res.data || res;
      if (data.history) {
        const transformedHistory = data.history.map(h => ({
          price: h.Close || h.price,
          time: h.Date || h.time
        }));
        props.onAddChartNode(props.node.id, symbol, transformedHistory, selectedPeriod());
        props.onClose();
        init();
      }
    } catch (err) {
      console.error("Chart fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Shared handlers
  const handleSelectNews = () => {
    setLocalKeyword(props.node?.symbol || "");
    setStep('keyword');
  };

  const handleFetchPreview = async () => {
    setLoading(true);
    const keyword = localKeyword();
    try {
      const fetchSources = [
          { url: `${import.meta.env.VITE_API_BASE}/api/news/search?q=${encodeURIComponent(keyword)}`, key: 'results' },
          { url: `${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(keyword)}`, key: 'news' }
      ];

      const allResults = await Promise.all(
        fetchSources.map(async (src) => {
          try {
            const r = await fetch(src.url);
            const data = await r.json();
            return data[src.key] || [];
          } catch (e) {
            return [];
          }
        })
      );

      const rawNews = allResults.flat();
      
      const seen = new Set();
      const uniqueNews = [];
      for (const item of rawNews) {
          const link = item.link || item.url;
          if (link && !seen.has(link)) {
              seen.add(link);
              uniqueNews.push({
                  ...item,
                  link,
                  title: item.title || "No Title",
                  publisher: item.publisher || item.source || "GNews Intel",
                  time: item.time || item.timestamp
              });
          }
      }
      uniqueNews.sort((a, b) => (b.time || b.timestamp) - (a.time || a.timestamp));

      setPreviewNews(uniqueNews);
      setStep('preview');
    } catch (err) {
      console.error("Preview fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchManagement = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/profile/${encodeURIComponent(props.node.symbol)}`);
      const res = await response.json();
      const data = res.data || res;
      if (data.management) {
        setPreviewMgmt(data.management);
        setStep('mgmt_preview');
      }
    } catch (err) {
      console.error("Management fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMgmtSelection = (name) => {
    if (selectedMgmt().includes(name)) {
      setSelectedMgmt(prev => prev.filter(n => n !== name));
    } else {
      setSelectedMgmt(prev => [...prev, name]);
    }
  };

  const handleStartManual = (type) => {
    setManualType(type);
    setManualData({});
    setStep('manual_entry');
  };

  const deployManual = () => {
    props.onAddManual(manualType(), manualData(), props.node.id);
    props.onClose();
    init();
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
        <div class="bg-[#0d1117] border border-white/10 w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[95vh] flex flex-col rounded-xl">
          
          <Show when={step() === 'select'}>
            <div class="mb-6 text-center">
              <div class="text-[10px] font-black text-blue-400 mb-1 tracking-[0.3em] uppercase">Integration Hub</div>
              <h2 class="text-xl font-black text-white uppercase tracking-tighter">SELECT MODULE</h2>
              <div class="text-[9px] font-bold text-white/40 mt-1 uppercase flex items-center justify-center gap-2 italic">
                <div class="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                Target Node: {props.node?.symbol}
              </div>
            </div>

            <div class="grid grid-cols-1 gap-2 px-1 overflow-y-auto custom-scrollbar-dark pr-1">
              <button onClick={handleSelectNews} class="w-full p-3 bg-white/[0.03] border border-white/5 flex items-center justify-between group hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all rounded-lg">
                <div class="flex flex-col items-start text-left">
                  <span class="text-[12px] font-black text-white group-hover:text-emerald-400 transition-colors uppercase">NEWS_INTELLIGENCE</span>
                  <span class="text-[8px] font-bold text-white/30 uppercase mt-1 italic">Scan global & local feeds</span>
                </div>
                <div class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all text-white/20 font-black text-xs">→</div>
              </button>

              <button onClick={handleFetchManagement} disabled={loading()} class="w-full p-3 bg-white/[0.03] border border-white/5 flex items-center justify-between group hover:border-blue-500/50 hover:bg-blue-500/5 transition-all rounded-lg">
                <div class="flex flex-col items-start text-left">
                  <span class="text-[12px] font-black text-white group-hover:text-blue-400 transition-colors uppercase">MANAGEMENT_RECON</span>
                  <span class="text-[8px] font-bold text-white/30 uppercase mt-1 italic">Board of directors profiling</span>
                </div>
                <div class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all text-white/20 font-black text-xs">
                   <Show when={loading()} fallback={<span>→</span>}>
                    <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   </Show>
                </div>
              </button>

              <button onClick={() => setStep('chart_setup')} class="w-full p-3 bg-white/[0.03] border border-white/5 flex items-center justify-between group hover:border-orange-500/50 hover:bg-orange-500/5 transition-all rounded-lg text-left">
                <div class="flex flex-col items-start">
                  <span class="text-[12px] font-black text-white group-hover:text-orange-400 transition-colors uppercase">MARKET_ANALYTICS</span>
                  <span class="text-[8px] font-bold text-white/30 uppercase mt-1 italic">Historical price & trend analysis</span>
                </div>
                <div class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all text-white/20 font-black text-xs">→</div>
              </button>

              <div class="my-2 border-t border-white/5 pt-2 flex flex-col gap-2">
                <div class="text-[8px] font-black text-white/30 uppercase tracking-[0.3em] mb-1">Manual Correlation Mod</div>
                
                <button onClick={() => handleStartManual('USER')} class="w-full p-3 bg-blue-500/[0.03] border border-blue-500/10 flex items-center justify-between group hover:border-blue-500/50 hover:bg-blue-500/10 transition-all rounded-lg text-left">
                  <div class="flex flex-col items-start">
                    <span class="text-[12px] font-black text-white group-hover:text-blue-400 transition-colors uppercase">USER_INTEL_MOD</span>
                    <span class="text-[8px] font-bold text-white/30 uppercase mt-1 italic">Linked profile identification</span>
                  </div>
                  <div class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all text-white/20 font-black text-xs">+</div>
                </button>

                <button onClick={() => handleStartManual('COMPANY')} class="w-full p-3 bg-emerald-500/[0.03] border border-emerald-500/10 flex items-center justify-between group hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all rounded-lg text-left">
                  <div class="flex flex-col items-start">
                    <span class="text-[12px] font-black text-white group-hover:text-emerald-400 transition-colors uppercase">CORP_ENTITY_MOD</span>
                    <span class="text-[8px] font-bold text-white/30 uppercase mt-1 italic">Manual company mapping</span>
                  </div>
                  <div class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all text-white/20 font-black text-xs">+</div>
                </button>

                <button onClick={() => handleStartManual('LOCATION')} class="w-full p-3 bg-orange-500/[0.03] border border-orange-500/10 flex items-center justify-between group hover:border-orange-500/50 hover:bg-orange-500/10 transition-all rounded-lg text-left">
                  <div class="flex flex-col items-start">
                    <span class="text-[12px] font-black text-white group-hover:text-orange-400 transition-colors uppercase">GEOSPATIAL_MOD</span>
                    <span class="text-[8px] font-bold text-white/30 uppercase mt-1 italic">Position & Address anchoring</span>
                  </div>
                  <div class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all text-white/20 font-black text-xs">+</div>
                </button>

                <button onClick={() => setStep('airport_search')} class="w-full p-3 bg-red-500/[0.03] border border-red-500/10 flex items-center justify-between group hover:border-red-500/50 hover:bg-red-500/10 transition-all rounded-lg text-left">
                  <div class="flex flex-col items-start">
                    <span class="text-[12px] font-black text-white group-hover:text-red-400 transition-colors uppercase">AIRPORT_INTEL_MOD</span>
                    <span class="text-[8px] font-bold text-white/30 uppercase mt-1 italic">Database-driven facility linking</span>
                  </div>
                  <div class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all text-white/20 font-black text-xs">+</div>
                </button>
              </div>
            </div>
          </Show>

          {/* STEP: AIRPORT DATABASE SEARCH */}
          <Show when={step() === 'airport_search'}>
            <div class="mb-4">
              <div class="text-[10px] font-black text-red-500 mb-1 tracking-[0.3em] uppercase">Infrastructure Registry</div>
              <h2 class="text-xl font-black text-white uppercase tracking-tighter">AIRPORT_DATABASE</h2>
            </div>
            
            <div class="flex flex-col flex-1 min-h-0 space-y-4">
              <div class="relative">
                <input 
                  type="text" 
                  placeholder="Enter name (e.g. Soekarno) & Press Enter"
                  class="w-full bg-black/60 border border-white/10 p-3 rounded-lg text-white text-[12px] font-black uppercase outline-none focus:border-red-500/50 transition-all tracking-[0.1em]"
                  value={manualData().q || ""}
                  onInput={(e) => setManualData({...manualData(), q: e.target.value})}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      setLoading(true);
                      const res = await props.searchAirports(manualData().q);
                      setManualData({...manualData(), results: res});
                      setLoading(false);
                    }
                  }}
                />
              </div>

              <div class="bg-black/60 border border-white/10 rounded-lg overflow-hidden flex-1 max-h-[300px] overflow-y-auto custom-scrollbar-dark">
                <For each={manualData().results || []}>
                  {(airport) => (
                    <button 
                      onClick={() => {
                        props.onAddManual('AIRPORT', { 
                          name: airport.name, 
                          ident: airport.ident, 
                          iata: airport.iata, 
                          type_airport: airport.type,
                          address: airport.municipality,
                          country_name: airport.country_name,
                          lat: airport.latitude,
                          lon: airport.longitude
                        }, props.node.id);
                        props.onClose();
                        init();
                      }}
                      class="w-full p-3 text-left hover:bg-red-500/10 border-b border-white/5 last:border-0 flex justify-between items-center group transition-colors"
                    >
                      <div class="min-w-0">
                        <div class="text-[10px] font-black text-white uppercase truncate group-hover:text-red-400">{airport.name}</div>
                        <div class="text-[8px] text-white/30 font-bold">{airport.ident} • {airport.municipality}, {airport.country_name}</div>
                      </div>
                      <div class="text-[8px] font-black text-red-500 opacity-0 group-hover:opacity-100 uppercase">Link</div>
                    </button>
                  )}
                </For>
                <Show when={manualData().q && (manualData().results || []).length === 0 && !loading()}>
                  <div class="py-20 text-center opacity-20 text-[10px] uppercase font-black tracking-widest">No Database Match</div>
                </Show>
              </div>

              <div class="flex gap-3 pt-4 shrink-0 mt-auto">
                <button onClick={() => setStep('select')} class="flex-1 py-3 border border-white/10 rounded-lg text-white/40 text-[9px] font-black hover:bg-white/5 uppercase">Back</button>
              </div>
            </div>
          </Show>

          {/* STEP: MANUAL ENTRY FORM */}
          <Show when={step() === 'manual_entry'}>
            <div class="mb-6">
              <div class="text-[10px] font-black text-blue-400 mb-1 tracking-[0.3em] uppercase">{manualType()}_INTEGRATION</div>
              <h2 class="text-xl font-black text-white uppercase tracking-tighter">DATA ENTRY</h2>
            </div>
            
            <div class="space-y-4">
              <Show when={manualType() === 'USER'}>
                <div class="space-y-3">
                  <input 
                    type="text" placeholder="FULL NAME" 
                    class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-blue-500 transition-all"
                    onInput={(e) => setManualData({...manualData(), name: e.target.value})}
                  />
                  <input 
                    type="text" placeholder="JOB TITLE / ROLE" 
                    class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-blue-500 transition-all"
                    onInput={(e) => setManualData({...manualData(), title: e.target.value})}
                  />
                  <textarea 
                    placeholder="DESCRIPTION / CLEARANCE NOTES" 
                    class="w-full h-24 bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-bold uppercase outline-none focus:border-blue-500 transition-all resize-none"
                    onInput={(e) => setManualData({...manualData(), description: e.target.value})}
                  ></textarea>
                </div>
              </Show>

              <Show when={manualType() === 'COMPANY'}>
                <div class="space-y-3">
                  <input 
                    type="text" placeholder="COMPANY NAME" 
                    class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-emerald-500 transition-all"
                    onInput={(e) => setManualData({...manualData(), name: e.target.value, symbol: 'CORP'})}
                  />
                </div>
              </Show>

              <Show when={manualType() === 'LOCATION'}>
                <div class="space-y-3">
                  <input 
                    type="text" placeholder="PLACE NAME" 
                    class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-orange-500 transition-all"
                    onInput={(e) => setManualData({...manualData(), name: e.target.value})}
                  />
                  <input 
                    type="text" placeholder="FULL ADDRESS" 
                    class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-orange-500 transition-all"
                    onInput={(e) => setManualData({...manualData(), address: e.target.value})}
                  />
                </div>
              </Show>

              <div class="flex gap-3 pt-6">
                <button onClick={() => setStep('select')} class="flex-1 py-4 border border-white/10 rounded-lg text-white/40 text-[10px] font-black hover:bg-white/5 uppercase">Back</button>
                <button 
                  onClick={deployManual} 
                  class="flex-[2] py-4 bg-blue-600 rounded-lg text-white text-[10px] font-black hover:bg-blue-500 uppercase shadow-lg shadow-blue-900/40"
                >
                  Confirm Integration
                </button>
              </div>
            </div>
          </Show>

          {/* STEP: CHART SETUP (Instant Lookup Flow) */}
          <Show when={step() === 'chart_setup'}>
            <div class="mb-4">
              <div class="text-[10px] font-black text-orange-400 mb-1 tracking-[0.3em] uppercase">Market Analytics</div>
              <h2 class="text-xl font-black text-white uppercase tracking-tighter">CROSS-ENTITY CHART</h2>
            </div>
            
            <div class="flex flex-col flex-1 min-h-0 space-y-4">
              {/* Instant Search Bar */}
              <div class="relative">
                <input 
                  type="text" 
                  placeholder="Enter name (e.g. Bank Mandiri) & Press Enter"
                  class="w-full bg-black/60 border border-white/10 p-3 rounded-lg text-white text-[12px] font-black uppercase outline-none focus:border-orange-500/50 transition-all tracking-[0.1em]"
                  value={customSymbol()}
                  onInput={(e) => setCustomSymbol(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSymbol()}
                />
                <Show when={loading() && symbolResults().length === 0}>
                  <div class="absolute right-3 top-1/2 -translate-y-1/2">
                    <div class="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </Show>
              </div>

              {/* Instant Results Dropdown/List */}
              <Show when={symbolResults().length > 0}>
                <div class="bg-black/60 border border-white/10 rounded-lg overflow-hidden flex-1 max-h-[150px] overflow-y-auto custom-scrollbar-dark animate-in slide-in-from-top-2 duration-300">
                  <For each={symbolResults()}>
                    {(res) => (
                      <button 
                        onClick={() => selectSymbol(res)}
                        class="w-full p-2 text-left hover:bg-orange-500/10 border-b border-white/5 last:border-0 flex justify-between items-center group transition-colors"
                      >
                        <div class="min-w-0">
                          <div class="text-[10px] font-black text-white uppercase truncate">{res.shortname || res.longname}</div>
                          <div class="text-[8px] text-orange-500/60 font-bold">{res.symbol} • {res.exchange}</div>
                        </div>
                        <div class="text-[8px] font-black text-white/20 group-hover:text-orange-500 transition-colors uppercase">Select</div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              {/* Time Horizon Selection */}
              <div class="pt-2">
                <div class="text-[8px] font-black text-white/40 uppercase mb-2 tracking-widest">Time Horizon</div>
                <div class="grid grid-cols-7 gap-1">
                  <For each={periods}>
                    {(p) => (
                      <button 
                        onClick={() => setSelectedPeriod(p.value)}
                        class={`py-2 border rounded text-[8px] font-black transition-all ${
                          selectedPeriod() === p.value 
                          ? 'bg-orange-500 border-orange-500 text-white' 
                          : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'
                        }`}
                      >
                        {p.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div class="flex gap-3 pt-4 shrink-0 mt-auto">
                <button onClick={() => setStep('select')} class="flex-1 py-3 border border-white/10 rounded-lg text-white/40 text-[9px] font-black hover:bg-white/5 uppercase">Back</button>
                <button onClick={handleAddChart} disabled={loading() || !customSymbol()} class="flex-[2] py-3 bg-orange-600 rounded-lg text-white text-[9px] font-black hover:bg-orange-500 uppercase flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20 disabled:opacity-30 transition-all">
                  <Show when={loading() && symbolResults().length === 0}>
                    <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  </Show>
                  DEPLOY_MARKET_CHART
                </button>
              </div>
            </div>
          </Show>

          {/* NEWS SETUP */}
          <Show when={step() === 'keyword'}>
            <div class="mb-6 text-center">
              <div class="text-[10px] font-black text-emerald-400 mb-1 tracking-[0.3em] uppercase">Intelligence Setup</div>
              <h2 class="text-xl font-black text-white uppercase tracking-tighter">SEARCH_INTEL</h2>
            </div>
            <div class="space-y-4">
              <input 
                type="text" 
                class="w-full bg-black/60 border border-white/10 p-4 rounded-lg text-white text-[14px] font-black uppercase outline-none focus:border-emerald-500/50 transition-all tracking-[0.1em]"
                value={localKeyword()}
                onInput={(e) => setLocalKeyword(e.target.value)}
                autofocus
                onKeyDown={(e) => e.key === 'Enter' && handleFetchPreview()}
              />
              <div class="flex gap-3 pt-6">
                <button onClick={() => setStep('select')} class="flex-1 py-4 border border-white/10 rounded-lg text-white/40 text-[10px] font-black hover:bg-white/5 uppercase">Back</button>
                <button onClick={handleFetchPreview} disabled={loading()} class="flex-[2] py-4 bg-emerald-600 rounded-lg text-white text-[10px] font-black hover:bg-emerald-500 uppercase">Run Discovery</button>
              </div>
            </div>
          </Show>

          <Show when={step() === 'preview'}>
            <div class="mb-4">
              <div class="text-[10px] font-black text-emerald-400 mb-1 tracking-[0.3em] uppercase">Discovery Results</div>
              <h2 class="text-lg font-black text-white uppercase tracking-tighter">PREVIEW_INTEL</h2>
            </div>
            <div class="flex-1 overflow-y-auto custom-scrollbar-dark pr-2 space-y-2 mb-6">
              <For each={previewNews()}>
                {(item) => (
                  <div class="p-3 border border-white/5 bg-white/[0.03] rounded-lg">
                    <div class="text-[11px] font-bold text-white uppercase leading-tight line-clamp-2">{item.title}</div>
                    <div class="text-[8px] text-white/20 mt-2 font-black tracking-widest">{item.publisher}</div>
                  </div>
                )}
              </For>
            </div>
            <div class="flex gap-3 border-t border-white/10 pt-6">
              <button onClick={() => setStep('keyword')} class="flex-1 py-4 border border-white/10 rounded-lg text-white/40 text-[10px] font-black hover:bg-white/5 uppercase">Refine</button>
              <button onClick={() => { props.onAddNewsCollection(props.node.id, localKeyword(), previewNews()); props.onClose(); init(); }} class="flex-[2] py-4 bg-emerald-600 rounded-lg text-white text-[10px] font-black hover:bg-emerald-500 uppercase">Add to Canvas</button>
            </div>
          </Show>

          {/* MGMT PREVIEW */}
          <Show when={step() === 'mgmt_preview'}>
            <div class="mb-4">
              <div class="text-[10px] font-black text-blue-400 mb-1 tracking-[0.3em] uppercase">Executive Registry</div>
              <h2 class="text-lg font-black text-white uppercase tracking-tighter">MANAGEMENT_PREVIEW</h2>
            </div>
            <div class="flex-1 overflow-y-auto custom-scrollbar-dark pr-2 mb-6 space-y-1">
              <For each={previewMgmt()}>
                {(mgr) => (
                  <button onClick={() => toggleMgmtSelection(mgr.name)} class={`w-full p-4 border rounded-lg flex items-center justify-between transition-all ${selectedMgmt().includes(mgr.name) ? 'bg-blue-500/20 border-blue-500 text-white' : 'bg-white/[0.02] border-white/5 text-white/40 hover:border-white/10'}`}>
                    <div class="text-left font-black uppercase">
                      <div class="text-[12px]">{mgr.name}</div>
                      <div class="text-[8px] opacity-60 mt-1">{mgr.title}</div>
                    </div>
                  </button>
                )}
              </For>
            </div>
            <div class="flex gap-3 border-t border-white/10 pt-6">
              <button onClick={() => setStep('select')} class="flex-1 py-4 border border-white/10 rounded-lg text-white/40 text-[10px] font-black hover:bg-white/5 uppercase">Back</button>
              <button onClick={() => { props.onAddManagement(props.node.id, previewMgmt().filter(m => selectedMgmt().includes(m.name))); props.onClose(); init(); }} disabled={selectedMgmt().length === 0} class="flex-[2] py-4 bg-blue-600 rounded-lg text-white text-[10px] font-black hover:bg-blue-500 uppercase disabled:opacity-50">Promote to Canvas</button>
            </div>
          </Show>

          <div class="mt-8 border-t border-white/5 pt-4 shrink-0">
            <button onClick={props.onClose} class="w-full py-2 text-[10px] font-black text-white/10 hover:text-red-500 transition-colors uppercase tracking-[0.4em]">CANCEL_INTEGRATION</button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ModuleModal;
