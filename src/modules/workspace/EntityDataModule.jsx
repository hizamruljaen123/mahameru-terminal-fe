import { createSignal, createEffect, Show, For } from 'solid-js';

export default function EntityDataModule(props) {
  let searchController;

  const [symbol, setSymbol] = createSignal("");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal([]);
  const [tableData, setTableData] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [interval, setInterval] = createSignal(props.initialInterval || "INTRADAY");
  const [period, setPeriod] = createSignal("1mo"); // Default to 1mo for table to avoid massive lag

  const fetchSearch = async (query) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    if (searchController) searchController.abort();
    searchController = new AbortController();

    try {
      const res = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/search?q=${encodeURIComponent(query)}`, { signal: searchController.signal });
      const data = await res.json();
      setSearchResults(data.quotes || []);
    } catch (err) {
      if (err.name !== 'AbortError') console.error("Search failed", err);
    }
  };

  const loadData = async (targetSymbol) => {
    if (!targetSymbol) return;
    setLoading(true);
    try {
      const endpoint = interval() === "INTRADAY" 
        ? `${import.meta.env.VITE_ENTITY_URL}/api/entity/realtime/${targetSymbol}`
        : `${import.meta.env.VITE_ENTITY_URL}/api/entity/history/${targetSymbol}?period=${period()}`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      
      if (interval() === "INTRADAY") {
        setTableData(data.intraday || []);
      } else {
        setTableData(data.history || []);
      }
    } catch (e) {
      console.error("Fetch Error", e);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (symbol()) {
      loadData(symbol());
    }
  });

  return (
    <div class="h-full flex flex-col bg-[#111] border border-white/5 rounded-sm overflow-hidden font-mono group">
      {/* Header */}
      <div class="drag-handle flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5 cursor-grab active:cursor-grabbing">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 bg-text_accent/40 rounded-full"></div>
          <span class="text-[9px] font-black text-text_accent uppercase tracking-widest">
            {symbol() || 'Select Entity'} — {interval()} DATA
          </span>
        </div>
        <button 
          onClick={() => props.onRemove(props.instanceId)}
          class="text-text_secondary/40 hover:text-red-500 transition-colors"
        >
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Search (Locked after selection) */}
      <Show when={!symbol()}>
        <div class="p-3 bg-black/20 border-b border-white/5 space-y-3">
          <div class="relative">
            <label class="text-[7px] font-black text-text_secondary/40 uppercase tracking-widest mb-1 block">Entity Node Selector</label>
            <div class="relative">
              <input 
                type="text" 
                placeholder="SYMBOL (E.G. AAPL, BTC-USD)..."
                value={searchQuery()}
                onInput={(e) => {
                  setSearchQuery(e.target.value);
                  fetchSearch(e.target.value);
                }}
                class="w-full bg-black/40 border border-white/10 p-2 pl-8 text-[10px] font-mono text-text_primary outline-none focus:border-text_accent/30 transition-all uppercase rounded-sm"
              />
              <div class="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-20">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              </div>
            </div>

            <Show when={searchResults().length > 0}>
              <div class="absolute top-full left-0 right-0 bg-[#0a0a0a] border border-text_accent/20 shadow-2xl mt-1 py-1 z-[100] max-h-48 overflow-y-auto win-scroll">
                <For each={searchResults()}>
                  {(item) => (
                    <button 
                      onClick={() => {
                        setSymbol(item.symbol);
                        setSearchResults([]);
                        setSearchQuery(item.symbol);
                        loadData(item.symbol);
                      }}
                      class="w-full flex items-center justify-between px-3 py-2.5 hover:bg-text_accent hover:text-black transition-colors group"
                    >
                      <div class="flex flex-col items-start">
                        <span class="text-[9px] font-black group-hover:text-black">{item.symbol}</span>
                        <span class="text-[7px] opacity-40 uppercase font-bold">{item.exchDisp}</span>
                      </div>
                      <span class="text-[8px] opacity-60 truncate ml-4 group-hover:opacity-100">{item.longname || item.shortname}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Range Selector */}
      <Show when={symbol() && interval() === "HISTORICAL"}>
        <div class="flex items-center gap-1 p-2 bg-black/10 border-b border-white/5 overflow-x-auto win-scroll no-scrollbar">
          <For each={['1d', '1w', '1m', '3m', '6m', '1y', '5y', '10y']}>
            {(p) => (
              <button 
                onClick={() => { setPeriod(p); loadData(symbol()); }}
                class={`px-2 py-1 text-[8px] font-black uppercase transition-all rounded-sm border ${period() === p ? 'bg-text_accent text-black border-text_accent' : 'bg-white/5 text-text_secondary border-white/5 hover:border-white/10'}`}
              >
                {p}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Data Table */}
      <div class="flex-1 overflow-auto win-scroll relative bg-black/5">
        <Show when={loading()}>
          <div class="absolute inset-0 flex items-center justify-center bg-black/40 z-20 backdrop-blur-[1px]">
            <div class="w-4 h-4 border-2 border-text_accent border-t-transparent animate-spin rounded-full"></div>
          </div>
        </Show>

        <Show when={!symbol()}>
           <div class="h-full flex items-center justify-center text-[9px] text-text_secondary/20 uppercase font-black tracking-widest">
              Awaiting Selection
           </div>
        </Show>

        <Show when={symbol() && tableData().length > 0}>
          <table class="w-full border-collapse text-left">
            <thead class="sticky top-0 bg-[#0d0d0d] z-10 border-b border-white/10 shadow-sm">
              <tr>
                <th class="p-2.5 text-[7px] font-black text-text_secondary/60 uppercase tracking-tighter">Date/Time</th>
                <th class="p-2.5 text-[7px] font-black text-text_secondary/60 uppercase tracking-tighter">Open</th>
                <th class="p-2.5 text-[7px] font-black text-text_secondary/60 uppercase tracking-tighter">High</th>
                <th class="p-2.5 text-[7px] font-black text-text_secondary/60 uppercase tracking-tighter">Low</th>
                <th class="p-2.5 text-[7px] font-black text-text_secondary/60 uppercase tracking-tighter">Close</th>
                <th class="p-2.5 text-[7px] font-black text-text_secondary/60 uppercase tracking-tighter text-right">Volume</th>
              </tr>
            </thead>
            <tbody>
              <For each={tableData()}>
                {(row) => (
                  <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td class="p-2 text-[9px] font-mono text-text_primary">{row.time || row.Date}</td>
                    <td class="p-2 text-[9px] font-mono text-text_secondary">{(row.open || row.Open)?.toFixed(2)}</td>
                    <td class="p-2 text-[9px] font-mono text-green-500/80">{(row.high || row.High)?.toFixed(2)}</td>
                    <td class="p-2 text-[9px] font-mono text-red-500/80">{(row.low || row.Low)?.toFixed(2)}</td>
                    <td class="p-2 text-[9px] font-mono text-text_accent">{(row.close || row.Close)?.toFixed(2)}</td>
                    <td class="p-2 text-[9px] font-mono text-text_secondary text-right">{row.volume || row.Volume}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>
    </div>
  );
}
