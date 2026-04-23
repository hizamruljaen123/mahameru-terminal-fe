import { createSignal, onMount, onCleanup, For, Show, createEffect, createMemo } from 'solid-js';
import * as echarts from 'echarts';

const MARKET_API = import.meta.env.VITE_MARKET_API || 'http://localhost:8088';

const DEFAULT_UNIVERSE = [
  { symbol: 'BTC-USD', name: 'Bitcoin', group: 'CRYPTO' },
  { symbol: 'ETH-USD', name: 'Ethereum', group: 'CRYPTO' },
  { symbol: 'SOL-USD', name: 'Solana', group: 'CRYPTO' },
  { symbol: 'BNB-USD', name: 'BNB', group: 'CRYPTO' },
  { symbol: 'USDIDR=X', name: 'USD/IDR', group: 'FOREX' },
  { symbol: 'EURUSD=X', name: 'EUR/USD', group: 'FOREX' },
  { symbol: 'GBPUSD=X', name: 'GBP/USD', group: 'FOREX' },
  { symbol: 'USDJPY=X', name: 'USD/JPY', group: 'FOREX' },
  { symbol: 'GC=F', name: 'Gold', group: 'COMMODITY' },
  { symbol: 'CL=F', name: 'Crude WTI', group: 'COMMODITY' },
  { symbol: 'BZ=F', name: 'Brent', group: 'COMMODITY' },
  { symbol: 'SI=F', name: 'Silver', group: 'COMMODITY' },
  { symbol: '^JKSE', name: 'IHSG', group: 'INDEX' },
  { symbol: '^GSPC', name: 'S&P 500', group: 'INDEX' },
  { symbol: '^NDX', name: 'Nasdaq 100', group: 'INDEX' },
  { symbol: 'BBCA.JK', name: 'BCA', group: 'IDX' },
  { symbol: 'BBRI.JK', name: 'BRI', group: 'IDX' },
  { symbol: 'TLKM.JK', name: 'Telkom', group: 'IDX' },
];

const WINDOWS = [
  { label: '7D', value: '7d', desc: 'Short Term' },
  { label: '30D', value: '30d', desc: 'Mid Term' },
  { label: '90D', value: '90d', desc: 'Quarterly' },
];

const GROUP_COLORS = {
  CRYPTO: '#f59e0b',
  FOREX: '#8b5cf6',
  COMMODITY: '#10b981',
  INDEX: '#3b82f6',
  IDX: '#06b6d4',
  SEARCHED: '#e2e8f0',
};

export default function CorrelationView() {
  const [selected, setSelected] = createSignal(new Set(['BTC-USD', 'ETH-USD', 'SOL-USD', 'USDIDR=X', 'EURUSD=X', 'GC=F', 'CL=F', '^GSPC']));
  const [window_, setWindow] = createSignal('30d');
  const [corrData, setCorrData] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal([]);
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [customAssets, setCustomAssets] = createSignal([]);

  let chartRef;
  let chart;
  let searchController = null;

  const fetchCorrelation = async () => {
    const syms = Array.from(selected());
    if (syms.length < 2) {
      setError('Select at least 2 assets to calculate correlation');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${MARKET_API}/api/market/correlation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: syms, window: window_() }),
      });
      const data = await resp.json();
      if (data.status === 'success') {
        setCorrData(data);
      } else {
        setError(data.message || 'Failed to fetch correlation matrix data');
      }
    } catch {
      setError('Connection failed. Verify quantitative analytics engine connection.');
    } finally {
      setLoading(false);
    }
  };

  const searchTicker = async () => {
    const q = searchQuery().trim();
    if (!q) return;

    if (searchController) searchController.abort();
    searchController = new AbortController();

    setSearchLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/search?q=${encodeURIComponent(q)}`, { 
        signal: searchController.signal 
      });
      const json = await resp.json();
      setSearchResults(json.quotes || []);
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    } finally {
      setSearchLoading(false);
    }
  };

  const addSearchedAsset = (ticker) => {
    const newAsset = { symbol: ticker.symbol, name: ticker.shortname || ticker.symbol, group: 'SEARCHED' };
    setCustomAssets(prev => {
      if (prev.find(a => a.symbol === newAsset.symbol)) return prev;
      return [...prev, newAsset];
    });
    
    setSelected(prev => {
      const next = new Set(prev);
      next.add(ticker.symbol);
      return next;
    });
    
    setSearchResults([]);
    setSearchQuery('');
    fetchCorrelation();
  };

  createEffect(() => {
    const data = corrData();
    if (!data || !chartRef) return;

    requestAnimationFrame(() => {
      if (!chartRef || chartRef.clientWidth === 0 || chartRef.clientHeight === 0) return;
      if (!chart) chart = echarts.init(chartRef, 'dark');

      const syms = data.symbols;
      const names = data.names || {};
      const labels = syms.map(s => names[s] || s);
      const matrix = data.matrix;

      const heatmapData = [];
      matrix.forEach((row, ri) => {
        row.forEach((val, ci) => {
          const v = val != null ? parseFloat(val.toFixed(3)) : null;
          heatmapData.push({
            value: [ci, ri, v],
            itemStyle: ci === ri ? { color: '#ffffff', opacity: 0.8 } : {}
          });
        });
      });

      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          position: 'top',
          formatter: p => {
            const [ci, ri, val] = p.data;
            if (val === null) return '';
            const xName = labels[ci];
            const yName = labels[ri];
            const color = val >= 0.5 ? '#10b981' : val <= -0.5 ? '#ef4444' : '#64748b';
            
            return `<div style="font-family: 'Roboto', sans-serif; font-size: 11px; padding: 10px; background: rgba(5,5,15,0.95); border: 1px solid #1e293b; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
              <div style="color: #94a3b8; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;">CORRELATION PAIR</div>
              <div style="margin: 6px 0; color: #fff;">${yName} ↔ ${xName}</div>
              <div style="font-size: 16px; font-weight: 900; color: ${color}; font-variant-numeric: tabular-nums;">
                ρ = <span style="letter-spacing: 0.05em;">${val >= 0 ? '+' : ''}${val.toFixed(3)}</span>
              </div>
            </div>`;
          },
        },
        grid: { top: 60, bottom: 90, left: 110, right: 30 },
        xAxis: {
          type: 'category',
          data: labels,
          position: 'top',
          axisLabel: { 
            color: '#cbd5e1', 
            fontSize: 10, 
            fontWeight: 'bold', 
            rotate: 45, 
            interval: 0, 
            fontFamily: 'Roboto, sans-serif' 
          },
          splitArea: { show: true, areaStyle: { color: ['rgba(0,0,0,0.1)', 'transparent'] } },
          axisTick: { show: false },
          axisLine: { show: false }
        },
        yAxis: {
          type: 'category',
          data: labels,
          inverse: true,
          axisLabel: { 
            color: '#cbd5e1', 
            fontSize: 10, 
            fontWeight: 'bold', 
            interval: 0, 
            fontFamily: 'Roboto, sans-serif' 
          },
          splitArea: { show: true, areaStyle: { color: ['rgba(0,0,0,0.1)', 'transparent'] } },
          axisTick: { show: false },
          axisLine: { show: false }
        },
        visualMap: {
          min: -1,
          max: 1,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 10,
          itemWidth: 15,
          itemHeight: 250,
          inRange: {
            // Diverging Red to Slate to Emerald
            color: ['#ef4444', '#1e293b', '#10b981']
          },
          textStyle: { color: '#64748b', fontSize: 10, fontWeight: 'bold' },
          text: ['+1.0 (Positive)', '-1.0 (Inverse)']
        },
        series: [{
          name: 'Correlation Matrix',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            formatter: (p) => {
              const val = p.data.value[2];
              if (val === null) return '';
              // Hide diagonal 1.00 if we want it clean, but let's show it in black for contrast on white
              return val.toFixed(2);
            },
            color: (p) => {
              // Black text for white diagonal, white text for colored cells
              return p.data.value[0] === p.data.value[1] ? '#000000' : '#ffffff';
            },
            fontSize: 9,
            fontWeight: 'bold',
            fontFamily: 'Roboto, monospace'
          },
          itemStyle: {
            borderColor: '#0f172a', /* Dark slate gap between cells */
            borderWidth: 2
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0,0,0,0.5)',
              borderColor: '#38bdf8', /* Cyan border on hover */
              borderWidth: 2
            }
          }
        }],
      });
    });
  });

  onMount(() => {
    fetchCorrelation();
    const handleResize = () => chart && chart.resize();
    window.addEventListener('resize', handleResize);
    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      if (chart) { chart.dispose(); chart = null; }
    });
  });

  const toggleAsset = (sym) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(sym) ? next.delete(sym) : next.add(sym);
      return next;
    });
  };

  const toggleGroup = (group) => {
    const groupSyms = DEFAULT_UNIVERSE.filter(a => a.group === group).map(a => a.symbol);
    const allSelected = groupSyms.every(s => selected().has(s));
    setSelected(prev => {
      const next = new Set(prev);
      allSelected ? groupSyms.forEach(s => next.delete(s)) : groupSyms.forEach(s => next.add(s));
      return next;
    });
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const groups = createMemo(() => {
    const map = {};
    DEFAULT_UNIVERSE.forEach(a => {
      if (!map[a.group]) map[a.group] = [];
      map[a.group].push(a);
    });
    return map;
  });

  return (
    <div class="h-full w-full flex flex-col bg-bg_main text-text_primary text-[12px] tracking-tight overflow-hidden font-roboto">

      {/* ── HEADER ── */}
      <div class="flex items-center justify-between px-6 py-4 bg-bg_header border-b border-border_main shrink-0 relative overflow-hidden">
        {/* Decorative Grid Background */}
        <div class="absolute inset-0 opacity-[0.03] pointer-events-none" style="background-image: radial-gradient(#38bdf8 1px, transparent 1px); background-size: 20px 20px;"></div>
        
        <div class="flex items-center gap-4 relative z-10">
          <div class="w-1.5 h-8 bg-text_accent shadow-[0_0_10px_rgba(56,189,248,0.5)]"></div>
          <div>
            <div class="text-[14px] font-black tracking-[0.15em] uppercase text-text_primary">CROSS-ASSET CORRELATION</div>
            <div class="text-[9px] text-text_accent/60 tracking-[0.3em] uppercase mt-0.5 font-bold">Pearson Correlation Matrix</div>
          </div>
        </div>
        
        <div class="flex items-center gap-6 relative z-10">
          <div class="flex flex-col items-end">
            <span class="text-[8px] text-text_secondary/50 font-black tracking-widest uppercase mb-1">TIME HORIZON</span>
            <div class="flex rounded overflow-hidden shadow-inner border border-border_main/50 bg-black/40 p-0.5">
              <For each={WINDOWS}>
                {(w) => (
                  <button 
                    onClick={() => setWindow(w.value)} 
                    class={`px-4 py-1.5 text-[9px] font-black uppercase transition-all duration-300 rounded-sm ${window_() === w.value ? 'bg-text_accent/20 text-text_accent border border-text_accent/30 shadow-[0_0_10px_rgba(56,189,248,0.15)]' : 'text-text_secondary/60 hover:text-text_primary hover:bg-white/5 border border-transparent'}`}
                    title={w.desc}
                  >
                    {w.label}
                  </button>
                )}
              </For>
            </div>
          </div>
          
          <button 
            onClick={fetchCorrelation} 
            disabled={loading()} 
            class="mt-3 px-6 py-2.5 bg-text_accent text-bg_main text-[10px] font-black uppercase tracking-[0.2em] hover:brightness-125 transition-all shadow-[0_0_15px_rgba(56,189,248,0.4)] disabled:opacity-50 disabled:shadow-none min-w-[140px] border border-transparent active:scale-[0.98]"
          >
            {loading() ? (
              <span class="flex items-center justify-center gap-2">
                <div class="w-3 h-3 border-2 border-bg_main border-t-transparent rounded-full animate-spin"></div> 
                CALCULATING
              </span>
            ) : '⚡ CALCULATE CORRELATION'}
          </button>
        </div>
      </div>

      <div class="flex-1 flex overflow-hidden">
        
        {/* ── SIDEBAR (ASSET SELECTION) ── */}
        <div class="w-72 border-r border-border_main flex flex-col bg-bg_sidebar shadow-[inset_-10px_0_20px_rgba(0,0,0,0.3)] relative overflow-hidden z-20">
          
          {/* SEARCH BAR */}
          <div class="p-4 border-b border-border_main bg-bg_header/60">
            <label class="text-[8px] font-black text-text_secondary/40 tracking-[0.2em] uppercase block mb-2">ADD ASSET</label>
            <div class="relative group">
              <input 
                type="text" 
                placeholder="Enter Ticker... (e.g. AAPL)" 
                value={searchQuery()} 
                onInput={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchTicker()}
                class="w-full bg-black/50 border border-white/10 pl-8 pr-3 py-2 text-[10px] uppercase font-bold text-text_primary placeholder:text-text_secondary/20 focus:outline-none focus:border-text_accent/50 transition-colors" 
              />
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] opacity-40 group-focus-within:text-text_accent group-focus-within:opacity-100 transition-colors">
                {searchLoading() ? <div class="w-3 h-3 border border-text_accent border-t-transparent rounded-full animate-spin"></div> : '🔍'}
              </span>
            </div>
            
            <Show when={searchResults().length > 0}>
              <div class="absolute left-4 right-4 mt-1 bg-bg_sidebar border border-text_accent/30 shadow-2xl z-[100] max-h-60 overflow-auto rounded-sm animate-in slide-in-from-top-2 duration-200">
                 <For each={searchResults()}>
                   {res => (
                     <div onClick={() => addSearchedAsset(res)} class="px-3 py-2 border-b border-white/5 hover:bg-text_accent/10 cursor-pointer flex justify-between items-center group/res transition-colors">
                        <div class="flex flex-col">
                          <span class="font-black text-[10px] text-text_primary group-hover/res:text-text_accent transition-colors">{res.symbol}</span>
                          <span class="text-[8px] text-text_secondary opacity-60 truncate w-32">{res.shortname}</span>
                        </div>
                        <span class="text-[8px] bg-white/10 px-1 py-0.5 rounded font-black text-text_secondary tracking-widest">{res.quoteType}</span>
                     </div>
                   )}
                 </For>
              </div>
            </Show>
          </div>

          <div class="flex-1 overflow-auto win-scroll p-2">
            
            <div class="flex items-center justify-between px-3 py-3 border-b border-white/5">
              <span class="text-[9px] font-black text-text_secondary/50 tracking-[0.2em] uppercase">SELECTED ASSETS</span>
              <div class="flex items-center gap-2">
                <span class="text-[9px] font-black text-text_accent px-1.5 py-0.5 bg-text_accent/10 border border-text_accent/20 rounded-sm">
                  {selected().size}
                </span>
                <button onClick={clearSelection} class="text-[8px] font-black text-red-400 hover:bg-red-400/10 px-1.5 py-0.5 border border-transparent hover:border-red-400/30 transition-all rounded-sm">
                  CLEAR
                </button>
              </div>
            </div>

            {/* SEARCHED ASSETS SECTION */}
            <Show when={customAssets().length > 0}>
              <div class="flex flex-col border-b border-border_main/30 py-2">
                <div class="px-3 py-1.5 text-[8px] font-black text-text_accent/60 tracking-widest uppercase">CUSTOM ASSETS</div>
                <For each={customAssets()}>
                  {asset => (
                    <button onClick={() => toggleAsset(asset.symbol)} class="flex items-center gap-3 px-4 py-1.5 text-left group transition-all">
                      <div class={`w-3 h-3 flex items-center justify-center rounded-[2px] transition-all border ${selected().has(asset.symbol) ? 'bg-text_accent border-text_accent text-bg_main' : 'bg-black/20 border-white/20 group-hover:border-text_accent/50'}`}>
                        {selected().has(asset.symbol) && <svg class="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>}
                      </div>
                      <div class="flex flex-col flex-1 min-w-0">
                        <span class={`font-black text-[10px] transition-colors ${selected().has(asset.symbol) ? 'text-text_primary' : 'text-text_secondary/50 group-hover:text-text_secondary'}`}>{asset.symbol}</span>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* DEFAULT UNIVERSE */}
            <div class="py-2">
              <For each={Object.entries(groups())}>
                {([group, assets]) => (
                  <div class="mt-2 text-white">
                    <button onClick={() => toggleGroup(group)} class="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors group/btn">
                      <div class="w-1.5 h-3 rounded-full" style={{ background: GROUP_COLORS[group] }}></div>
                      <span class="text-[9px] font-black flex-1 text-left tracking-widest uppercase" style={{ color: GROUP_COLORS[group] }}>{group}</span>
                      <span class="text-[8px] font-black tracking-widest px-1.5 rounded-sm bg-black/40 border border-white/10 group-hover/btn:border-white/30 transition-colors">
                        <span class={assets.filter(a => selected().has(a.symbol)).length > 0 ? "text-text_primary" : "text-text_secondary/40"}>
                          {assets.filter(a => selected().has(a.symbol)).length}
                        </span>
                        <span class="text-text_secondary/30">/{assets.length}</span>
                      </span>
                    </button>
                    
                    <div class="flex flex-col mt-1 gap-px px-2">
                      <For each={assets}>
                        {(asset) => (
                          <button onClick={() => toggleAsset(asset.symbol)} class="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-all text-left group/item rounded-sm">
                            <div class={`w-3 h-3 rounded-[2px] transition-all border flex items-center justify-center ${selected().has(asset.symbol) ? 'border-transparent' : 'bg-black/20 border-white/10 group-hover/item:border-white/30'}`} style={selected().has(asset.symbol) ? { background: GROUP_COLORS[group] } : {}}>
                                {selected().has(asset.symbol) && <svg class="w-2 h-2 text-bg_main" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7"/></svg>}
                            </div>
                            <div class="flex-1 flex justify-between items-center">
                              <span class={`font-black text-[10px] uppercase transition-colors ${selected().has(asset.symbol) ? 'text-text_primary' : 'text-text_secondary/40 group-hover:text-text_secondary'}`}>{asset.symbol}</span>
                              <span class="text-[8px] text-text_secondary/40 font-bold opacity-0 group-hover/item:opacity-100 transition-opacity">{asset.name}</span>
                            </div>
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* ── HEATMAP AREA ── */}
        <div class="flex-1 flex flex-col bg-bg_main relative z-10">
          
          <Show when={error()}>
            <div class="absolute top-4 left-1/2 -transform-x-1/2 px-6 py-3 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-black tracking-widest shadow-2xl z-50 rounded-sm flex items-center gap-3 backdrop-blur-sm">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ERR: {error()}
            </div>
          </Show>
          
          <Show when={loading() && !corrData()}>
             <div class="absolute inset-0 z-40 bg-bg_main/80 backdrop-blur-sm flex flex-col items-center justify-center">
                <div class="relative w-16 h-16 mb-4">
                  <div class="absolute inset-0 border-2 border-text_accent/20 rounded-full"></div>
                  <div class="absolute inset-0 border-2 border-text_accent border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div class="text-[10px] font-black text-text_accent tracking-[0.3em] uppercase animate-pulse">Calculating correlations...</div>
                <div class="text-[8px] text-text_secondary/40 mt-2 tracking-widest uppercase">Fetching Historical Prices & Computing Matrix</div>
             </div>
          </Show>

          {/* ECharts Heatmap Container */}
          <div class="flex-1 p-6 flex flex-col relative">
            <div class="absolute inset-0 p-6 pointer-events-none z-0 opacity-20">
              <div class="w-full h-full border border-border_main rounded-sm shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]"></div>
            </div>
            
             <Show when={!loading() && !corrData() && !error()}>
                <div class="flex-1 flex flex-col items-center justify-center opacity-30 pointer-events-none">
                  <svg class="w-16 h-16 mb-4 text-text_secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  <div class="text-[10px] font-black tracking-[0.2em] uppercase">Select Assets and Click Calculate</div>
                </div>
             </Show>
            
             <div ref={chartRef} class="w-full h-full min-h-[500px] z-10 transition-opacity duration-500" style={{ opacity: loading() ? 0.3 : 1 }}></div>
          </div>

          <div class="px-6 py-2 border-t border-border_main bg-bg_header/40 flex items-center justify-between text-text_secondary/40 shrink-0">
             <div class="flex gap-4 items-center">
               <span class="flex items-center gap-1.5 text-[8px] font-black tracking-[0.2em] uppercase">
                 <div class={`w-1.5 h-1.5 rounded-full ${corrData() ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-red-500 shadow-[0_0_5px_#ef4444]'}`}></div>
                 STATUS DUMP: {corrData() ? 'OK' : 'WAITING'}
               </span>
               <span class="text-[8px]">/</span>
               <span class="text-[8px] font-black tracking-widest uppercase">DATA POINTS: <span class="text-text_primary">{corrData()?.data_points || 0}</span></span>
             </div>
             <div class="text-[8px] font-black tracking-[0.3em] uppercase italic opacity-50">ENQY TERMINAL // RISK ANALYTICS</div>
          </div>
        </div>
      </div>
    </div>
  );
}
