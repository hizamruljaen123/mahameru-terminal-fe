import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';
import * as echarts from 'echarts';

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

function Sparkline({ klines }) {
  let ref;
  let chart;

  const render = () => {
    if (!ref || !klines || klines.length === 0) return;
    if (!chart) chart = echarts.init(ref);
    
    const data = klines.map(d => d.close);
    const isUp = data[data.length - 1] >= data[0];
    
    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      grid: { left: 2, right: 2, top: 2, bottom: 2 },
      xAxis: { type: 'category', show: false },
      yAxis: { type: 'value', scale: true, show: false },
      series: [{
        type: 'line',
        data: data,
        symbol: 'none',
        smooth: true,
        lineStyle: { 
          width: 1.5, 
          color: isUp ? '#0ecb81' : '#f6465d' 
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: isUp ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)' },
            { offset: 1, color: 'transparent' }
          ])
        }
      }]
    });
  };

  onMount(() => {
    render();
    const ro = new ResizeObserver(() => chart?.resize());
    if (ref) ro.observe(ref);
    onCleanup(() => { ro.disconnect(); chart?.dispose(); });
  });

  createEffect(() => { klines; render(); });

  return <div ref={ref} class="w-full h-8" />;
}

export default function CryptoAssetExplorer(props) {
  const [coins, setCoins] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch] = createSignal("");
  const [prices, setPrices] = createSignal({});
  const [klineStore, setKlineStore] = createSignal({});
  const [wsStatus, setWsStatus] = createSignal("CONNECTING");
  let ws = null;

  const connectWS = () => {
    if (ws) ws.close();
    const wsUrl = import.meta.env.VITE_CRYPTO_STREAM_WS || 'wss://api.asetpedia.online/ws/crypto';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => setWsStatus("LIVE");
    ws.onclose = () => { setWsStatus("OFFLINE"); setTimeout(connectWS, 5000); };
    ws.onerror = () => setWsStatus("ERROR");

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'snapshot') {
        const newKlines = {};
        const newPrices = {};
        Object.entries(msg.data).forEach(([s, data]) => {
          const klines = (data.klines || []).sort((a, b) => a.time - b.time);
          newKlines[s] = klines;
          if (klines.length > 0) {
            newPrices[s] = { price: klines[klines.length - 1].close, side: 'neutral' };
          }
        });
        setKlineStore(prev => ({ ...prev, ...newKlines }));
        setPrices(prev => ({ ...prev, ...newPrices }));
      } else if (msg.type === 'kline') {
        const s = msg.symbol;
        const d = msg.data;
        setKlineStore(prev => {
          const existing = prev[s] || [];
          const idx = existing.findIndex(k => k.time === d.time);
          let updated;
          if (idx !== -1) {
            updated = [...existing];
            updated[idx] = d;
          } else {
            updated = [...existing, d];
            if (updated.length > 100) updated.shift();
          }
          return { ...prev, [s]: updated };
        });
        setPrices(prev => {
          const lastPrice = prev[s]?.price || d.close;
          const side = d.close > lastPrice ? 'up' : d.close < lastPrice ? 'down' : 'neutral';
          return { ...prev, [s]: { price: d.close, side } };
        });
      }
    };
  };

  onMount(async () => {
    connectWS();
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

  onCleanup(() => {
    if (ws) ws.close();
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
              <th class="px-4 py-3 border-r border-border_main w-32">Live Trend</th>
              <th class="px-4 py-3 border-r border-border_main text-right">Market Cap</th>
              <th class="px-4 py-3 border-r border-border_main text-right">Volume (24h)</th>
              <th class="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border_main/30">
            <Show when={!loading()} fallback={
              <tr>
                <td colspan="9" class="py-20 text-center">
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
                      <td class="px-4 py-3 text-right font-mono text-[11px]">
                        <span class={
                          prices()[coin.symbol + 'USDT']?.side === 'up' ? 'text-green-400' : 
                          prices()[coin.symbol + 'USDT']?.side === 'down' ? 'text-red-400' : 
                          'text-text_primary'
                        }>
                          ${fmt(prices()[coin.symbol + 'USDT']?.price || quote.price, quote.price < 1 ? 4 : 2)}
                        </span>
                      </td>
                      <td class={`px-4 py-3 text-right font-mono text-[10px] ${signColor(quote.percent_change_24h)}`}>
                        {fmtPct(quote.percent_change_24h)}
                      </td>
                      <td class={`px-4 py-3 text-right font-mono text-[10px] ${signColor(quote.percent_change_7d)}`}>
                        {fmtPct(quote.percent_change_7d)}
                      </td>
                      <td class="px-2 py-1">
                        <Sparkline klines={klineStore()[coin.symbol + 'USDT'] || []} />
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
                          <button 
                            onClick={(e) => { e.stopPropagation(); window.open(`https://www.binance.com/en/trade/${coin.symbol}_USDT`, '_blank'); }}
                            class="bg-yellow-500/10 hover:bg-yellow-500/30 border border-yellow-500/20 text-yellow-500 text-[8px] font-black px-2 py-1 uppercase tracking-tighter transition-all"
                          >
                            Binance
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
          <div class={`w-1.5 h-1.5 rounded-full animate-pulse ${wsStatus() === 'LIVE' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{wsStatus()} // BINANCE DATA STREAM</span>
        </div>
      </div>
    </div>
  );
}
