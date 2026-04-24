import { createSignal, onMount, For, Show } from 'solid-js';

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? 'N/A' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMln = (v) => {
  if (v == null || isNaN(v)) return 'N/A';
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  return v.toLocaleString();
};
const fmtPct = (v) => (v == null || isNaN(v)) ? 'N/A' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const signColor = (v) => v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-text_secondary';

export default function CryptoAssetExplorer(props) {
  const [coins, setCoins] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch] = createSignal("");

  onMount(async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_CRYPTO_API}/api/crypto/cmc/list`);
      const json = await resp.json();
      if (json.status === "success") {
        setCoins(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch CMC list", e);
    } finally {
      setLoading(false);
    }
  });

  const filteredCoins = () => {
    const q = search().toLowerCase();
    if (!q) return coins();
    return coins().filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  };

  return (
    <div class="flex flex-col h-full bg-bg_main/20">
      {/* Header / Search */}
      <div class="p-4 border-b border-border_main bg-black/40 flex items-center justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h2 class="text-[12px] font-black text-text_accent uppercase tracking-widest">Global Asset Explorer</h2>
          <p class="text-[9px] text-text_secondary uppercase">Institutional Data powered by CoinMarketCap Professional</p>
        </div>
        
        <div class="relative w-64">
          <input 
            type="text"
            placeholder="FILTER ASSETS (NAME/SYMBOL)..."
            class="w-full bg-bg_main/60 border border-border_main px-3 py-1.5 text-[10px] font-mono text-text_primary focus:border-text_accent outline-none transition-all placeholder:text-text_secondary/30"
            onInput={(e) => setSearch(e.target.value)}
            value={search()}
          />
          <div class="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-3 bg-text_accent/20" />
        </div>
      </div>

      {/* Table Container */}
      <div class="flex-1 overflow-auto custom-scrollbar">
        <table class="w-full text-left border-collapse min-w-[800px]">
          <thead class="sticky top-0 z-10 bg-bg_header/90 backdrop-blur-md border-b border-border_main shadow-lg">
            <tr class="text-[9px] font-black text-text_secondary uppercase tracking-tighter">
              <th class="px-4 py-3 border-r border-border_main w-12 text-center">#</th>
              <th class="px-4 py-3 border-r border-border_main">Asset</th>
              <th class="px-4 py-3 border-r border-border_main text-right">Price (USD)</th>
              <th class="px-4 py-3 border-r border-border_main text-right">24h %</th>
              <th class="px-4 py-3 border-r border-border_main text-right">7d %</th>
              <th class="px-4 py-3 border-r border-border_main text-right">Market Cap</th>
              <th class="px-4 py-3 border-r border-border_main text-right">Volume (24h)</th>
              <th class="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border_main/30">
            <Show when={!loading()} fallback={
              <tr>
                <td colspan="8" class="py-20 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <div class="w-8 h-8 border-2 border-text_accent/20 border-t-text_accent animate-spin rounded-full" />
                    <span class="text-[10px] font-mono text-text_secondary animate-pulse">QUERYING CMC INFRASTRUCTURE...</span>
                  </div>
                </td>
              </tr>
            }>
              <For each={filteredCoins()}>
                {(coin) => {
                  const quote = coin.quote.USD;
                  return (
                    <tr 
                      class="hover:bg-text_accent/5 transition-colors group cursor-pointer"
                      onClick={() => props.onSelect(coin.symbol)}
                    >
                      <td class="px-4 py-3 text-center font-mono text-[10px] text-text_secondary group-hover:text-text_accent">{coin.cmc_rank}</td>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                          <div class="w-6 h-6 bg-black/40 border border-border_main flex items-center justify-center text-[10px] font-black text-text_accent group-hover:border-text_accent/40">
                            {coin.symbol[0]}
                          </div>
                          <div class="flex flex-col">
                            <span class="text-[11px] font-bold text-text_primary uppercase leading-tight">{coin.name}</span>
                            <span class="text-[9px] font-black text-text_accent/60 font-mono tracking-tighter">{coin.symbol}</span>
                          </div>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-right font-mono text-[11px] text-text_primary">
                        ${fmt(quote.price, quote.price < 1 ? 4 : 2)}
                      </td>
                      <td class={`px-4 py-3 text-right font-mono text-[10px] ${signColor(quote.percent_change_24h)}`}>
                        {fmtPct(quote.percent_change_24h)}
                      </td>
                      <td class={`px-4 py-3 text-right font-mono text-[10px] ${signColor(quote.percent_change_7d)}`}>
                        {fmtPct(quote.percent_change_7d)}
                      </td>
                      <td class="px-4 py-3 text-right font-mono text-[10px] text-text_secondary">
                        ${fmtMln(quote.market_cap)}
                      </td>
                      <td class="px-4 py-3 text-right font-mono text-[10px] text-text_secondary">
                        ${fmtMln(quote.volume_24h)}
                      </td>
                      <td class="px-4 py-3 text-center">
                        <div class="flex items-center justify-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); props.onSelect(coin.symbol); }}
                            class="bg-text_accent/10 hover:bg-text_accent/20 border border-text_accent/20 text-text_accent text-[8px] font-black px-2 py-1 uppercase tracking-tighter transition-all"
                          >
                            Intel
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); props.onAddToLive(coin.symbol); }}
                            class="bg-blue-500/10 hover:bg-blue-500/30 border border-blue-500/20 text-blue-400 text-[8px] font-black px-2 py-1 uppercase tracking-tighter transition-all"
                          >
                            + Live
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      {/* Footer / Summary */}
      <div class="p-3 border-t border-border_main bg-bg_header/20 flex items-center justify-between text-[8px] font-mono text-text_secondary uppercase">
        <div class="flex gap-4">
          <span>Total Assets: {coins().length}</span>
          <span>Filtered: {filteredCoins().length}</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span>Real-time Stream Connected</span>
        </div>
      </div>
    </div>
  );
}
