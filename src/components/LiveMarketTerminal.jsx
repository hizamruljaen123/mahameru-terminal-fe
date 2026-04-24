import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';
import * as echarts from 'echarts';

// Top 50 popular coins with Binance USDT pairs
const TOP_50 = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','TRXUSDT','DOTUSDT','LINKUSDT',
  'AVAXUSDT','MATICUSDT','LTCUSDT','ATOMUSDT','UNIUSDT','XLMUSDT','ETCUSDT','FILUSDT','APTUSDT','OPUSDT',
  'ARBUSDT','NEARUSDT','INJUSDT','SUIUSDT','STXUSDT','RUNEUSDT','IMXUSDT','LDOUSDT','SEIUSDT','TIAUSDT',
  'RENDERUSDT','FETUSDT','ARUSDT','ALGOUSDT','VETUSDT','ICPUSDT','HBARUSDT','EGLDUSDT','SANDUSDT','MANAUSDT',
  'AXSUSDT','GALAUSDT','APEUSDT','FTMUSDT','JASMYUSDT','RNDRUSDT','WLDUSDT','JUPUSDT','PENDLEUSDT','ONDOUSDT'
];

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

function MiniChart({ klines }) {
  let ref;
  let chart;

  const render = () => {
    if (!ref || !klines || klines.length === 0) return;
    if (!chart) chart = echarts.init(ref);
    const vals = klines.map(d => [d.open, d.close, d.low, d.high]);
    const dates = klines.map(d => new Date(d.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      grid: [
        { left: 0, right: 0, top: 4, height: '62%' },
        { left: 0, right: 0, top: '72%', height: '24%' }
      ],
      xAxis: [
        { type: 'category', data: dates, show: false },
        { type: 'category', gridIndex: 1, data: dates, show: false }
      ],
      yAxis: [
        { type: 'value', scale: true, show: false },
        { type: 'value', gridIndex: 1, show: false }
      ],
      dataZoom: [{ type: 'inside', xAxisIndex: [0, 1] }],
      series: [
        {
          type: 'candlestick',
          data: vals,
          itemStyle: { color: '#0ecb81', color0: '#f6465d', borderColor: '#0ecb81', borderColor0: '#f6465d' }
        },
        {
          type: 'bar',
          xAxisIndex: 1, yAxisIndex: 1,
          data: klines.map(d => ({
            value: d.volume,
            itemStyle: { color: d.close >= d.open ? 'rgba(14,203,129,0.4)' : 'rgba(246,70,93,0.4)' }
          }))
        }
      ]
    });
  };

  onMount(() => {
    render();
    const ro = new ResizeObserver(() => chart?.resize());
    if (ref) ro.observe(ref);
    onCleanup(() => { ro.disconnect(); chart?.dispose(); });
  });

  createEffect(() => { klines; render(); });

  return <div ref={ref} class="w-full h-full" />;
}

export default function LiveMarketTerminal(props) {
  const selected = () => props.watchlist || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
  const [prices, setPrices] = createSignal({});
  const [klineStore, setKlineStore] = createSignal({});
  const [trades, setTrades] = createSignal({});
  const [depths, setDepths] = createSignal({});
  const [sentiment, setSentiment] = createSignal({});
  const [cardTabs, setCardTabs] = createSignal({});
  const [showSelector, setShowSelector] = createSignal(false);
  const [selectorSearch, setSelectorSearch] = createSignal('');
  const [wsStatus, setWsStatus] = createSignal('CONNECTING');

  // Internal mutable refs
  const assetKlines = {};
  const assetLastPrice = {};
  let ws = null;

  const toggleSelect = (sym) => {
    props.setWatchlist(prev => {
      if (prev.includes(sym)) {
        if (prev.length <= 1) return prev;
        return prev.filter(s => s !== sym);
      }
      if (prev.length >= 10) return prev;
      return [...prev, sym];
    });
  };

  const connectWS = () => {
    if (ws) ws.close();
    const wsUrl = import.meta.env.VITE_CRYPTO_STREAM_WS || 'ws://2.24.223.76:8092/ws/crypto';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => setWsStatus('LIVE');
    ws.onclose = () => { setWsStatus('RECONNECTING'); setTimeout(connectWS, 4000); };
    ws.onerror = () => setWsStatus('ERROR');

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'snapshot') {
        const newKlines = {};
        const newTrades = {};
        const newDepths = {};
        const newPrices = {};
        const newSentiment = {};
        Object.entries(msg.data).forEach(([s, data]) => {
          const klines = (data.klines || []).sort((a, b) => a.time - b.time);
          assetKlines[s] = klines;
          if (klines.length > 0) {
            const last = klines[klines.length - 1];
            assetLastPrice[s] = last.close;
            newPrices[s] = { price: last.close, side: 'neutral' };
            newSentiment[s] = last.close >= last.open ? 'BULLISH' : 'BEARISH';
          }
          newKlines[s] = [...klines];
          newTrades[s] = (data.trades || []).slice(0, 50);
          if (data.depth) newDepths[s] = data.depth;
        });
        setKlineStore(prev => ({ ...prev, ...newKlines }));
        setTrades(prev => ({ ...prev, ...newTrades }));
        setDepths(prev => ({ ...prev, ...newDepths }));
        setPrices(prev => ({ ...prev, ...newPrices }));
        setSentiment(prev => ({ ...prev, ...newSentiment }));
      } else if (msg.type === 'kline') {
        const s = msg.symbol;
        const d = msg.data;
        if (!assetKlines[s]) assetKlines[s] = [];
        const idx = assetKlines[s].findIndex(k => k.time === d.time);
        if (idx !== -1) assetKlines[s][idx] = d;
        else { assetKlines[s].push(d); if (assetKlines[s].length > 300) assetKlines[s].shift(); }
        setKlineStore(prev => ({ ...prev, [s]: [...assetKlines[s]] }));
        const side = d.close >= (assetLastPrice[s] || d.close) ? 'up' : 'down';
        assetLastPrice[s] = d.close;
        setPrices(prev => ({ ...prev, [s]: { price: d.close, side } }));
        setSentiment(prev => ({ ...prev, [s]: d.close >= d.open ? 'BULLISH' : 'BEARISH' }));
      } else if (msg.type === 'trade') {
        const s = msg.symbol;
        const d = msg.data;
        const isWhale = (d.p * d.q) > 10000;
        const trade = {
          p: d.p.toFixed(s.includes('DOGE') || s.includes('SHIB') ? 6 : 2),
          q: d.q.toFixed(3), m: d.m, w: isWhale,
          t: new Date(d.T).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        setTrades(prev => ({ ...prev, [s]: [trade, ...(prev[s] || [])].slice(0, 50) }));
      } else if (msg.type === 'depth') {
        setDepths(prev => ({ ...prev, [msg.symbol]: msg.data }));
      }
    };
  };

  onMount(() => {
    connectWS();
    onCleanup(() => { if (ws) ws.close(); });
  });

  const filteredTop50 = () =>
    TOP_50.filter(s => s.toLowerCase().includes(selectorSearch().toLowerCase()));

  const priceColor = (sym) => {
    const s = prices()[sym]?.side;
    return s === 'up' ? 'text-green-400' : s === 'down' ? 'text-red-400' : 'text-text_primary';
  };

  return (
    <div class="flex flex-col h-full bg-black/40 font-mono overflow-hidden">

      {/* Toolbar */}
      <div class="h-10 bg-bg_header/60 border-b border-border_main flex items-center justify-between px-4 shrink-0">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class={`w-2 h-2 rounded-full animate-pulse ${wsStatus() === 'LIVE' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : wsStatus() === 'ERROR' ? 'bg-red-400' : 'bg-yellow-400'}`} />
            <span class="text-[9px] font-black tracking-widest uppercase text-text_secondary">
              {wsStatus()} // BINANCE STREAM
            </span>
          </div>
          <span class="text-[8px] text-text_secondary/40 uppercase">{selected().length} ASSET{selected().length !== 1 ? 'S' : ''} ACTIVE</span>
        </div>
      </div>

      {/* Live Market Grid */}
      <div class={`flex-1 overflow-auto p-1 grid gap-1 ${selected().length <= 2 ? 'grid-cols-1 md:grid-cols-2' : selected().length <= 4 ? 'grid-cols-2' : selected().length <= 6 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5'}`}>
        <For each={selected()}>
          {(sym) => {
            const tab = () => cardTabs()[sym] || 'chart';
            const setTab = (t) => setCardTabs(p => ({ ...p, [sym]: t }));
            const klines = () => klineStore()[sym] || [];
            const depth = () => depths()[sym] || {};
            const tradeList = () => trades()[sym] || [];
            const price = () => prices()[sym];
            const sent = () => sentiment()[sym];
            const bidPct = () => {
              const d = depth();
              const total = (d.bid_q || 0) + (d.ask_q || 0);
              return total > 0 ? (d.bid_q / total * 100) : 50;
            };

            return (
              <div class="flex flex-col bg-bg_main border border-border_main/30 overflow-hidden">
                {/* Card Header */}
                <div class="bg-black/60 border-b border-border_main/20 px-3 py-2 flex items-center justify-between shrink-0">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 flex items-center justify-center bg-black/60 border border-border_main text-[10px] font-black text-text_accent">
                      {sym.replace('USDT', '').slice(0, 3)}
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[11px] font-black text-text_accent uppercase">{sym.replace('USDT', '')}/USDT</span>
                      <span class={`text-[8px] font-black px-1 ${sent() === 'BULLISH' ? 'text-green-400' : 'text-red-400'}`}>
                        {sent() || '—'}
                      </span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end">
                    <span class={`text-[15px] font-black tabular-nums ${priceColor(sym)}`}>
                      ${price()?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) || '—'}
                    </span>
                    {/* Bid/Ask depth bar */}
                    <div class="w-20 h-1 bg-white/5 mt-1 rounded-full overflow-hidden flex">
                      <div style={{ width: `${bidPct()}%` }} class="h-full bg-green-500/60 transition-all duration-500" />
                      <div style={{ width: `${100 - bidPct()}%` }} class="h-full bg-red-500/60 transition-all duration-500" />
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div class="flex-1 min-h-[160px] relative">
                  <Show when={klines().length > 0} fallback={
                    <div class="absolute inset-0 flex items-center justify-center">
                      <div class="w-5 h-5 border-2 border-text_accent/40 border-t-text_accent animate-spin rounded-full" />
                    </div>
                  }>
                    <div class="absolute inset-0">
                      <MiniChart klines={klines()} />
                    </div>
                  </Show>
                </div>

                {/* Sub-tab bar */}
                <div class="h-6 bg-black/60 flex items-center border-t border-border_main/10 px-3 gap-4 shrink-0">
                  {['chart', 'tape', 'depth'].map(t => (
                    <button
                      onClick={() => setTab(t)}
                      class={`text-[7px] font-black uppercase tracking-widest transition-all ${tab() === t ? 'text-text_accent' : 'text-text_secondary/30 hover:text-text_secondary/60'}`}
                    >
                      {t === 'chart' ? '01_PRICE' : t === 'tape' ? '02_TAPE' : '03_DEPTH'}
                    </button>
                  ))}
                </div>

                {/* Bottom panel */}
                <div class="h-24 overflow-y-auto win-scroll border-t border-border_main/10 bg-black/20 shrink-0">
                  <Show when={tab() === 'tape'}>
                    <For each={tradeList()}>
                      {(t) => (
                        <div class={`grid grid-cols-12 px-2 py-0.5 border-b border-white/[0.02] items-center text-[8px] ${t.w ? 'bg-text_accent/5' : ''}`}>
                          <span class={`col-span-1 ${t.m ? 'text-red-500' : 'text-green-500'}`}>{t.m ? '▼' : '▲'}</span>
                          <span class={`col-span-4 font-bold ${t.m ? 'text-red-400' : 'text-green-400'}`}>{t.p}</span>
                          <span class="col-span-4 text-text_secondary/50 text-right">{t.q}</span>
                          <span class="col-span-3 text-right">{t.w ? <span class="text-text_accent animate-pulse font-black text-[7px]">WHALE</span> : <span class="text-text_secondary/30 text-[7px]">{t.t}</span>}</span>
                        </div>
                      )}
                    </For>
                    <Show when={tradeList().length === 0}>
                      <div class="flex items-center justify-center h-full text-[8px] text-text_secondary/30 uppercase">Awaiting trades...</div>
                    </Show>
                  </Show>

                  <Show when={tab() === 'depth'}>
                    <div class="flex flex-col gap-2 p-3">
                      <div class="flex justify-between text-[8px] font-black">
                        <span class="text-text_secondary">BID/ASK RATIO</span>
                        <span class="text-text_accent">{((depth().bid_q / (depth().ask_q || 1)) || 1).toFixed(2)}x</span>
                      </div>
                      <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                        <div style={{ width: `${bidPct()}%` }} class="h-full bg-green-500 transition-all duration-500" />
                        <div style={{ width: `${100 - bidPct()}%` }} class="h-full bg-red-500 transition-all duration-500" />
                      </div>
                      <div class="grid grid-cols-2 gap-2 text-[9px] font-mono">
                        <div class="flex flex-col">
                          <span class="text-text_secondary/40 text-[7px] uppercase">Best Bid</span>
                          <span class="text-green-400 font-black">${fmt(depth().bid_p, 4)}</span>
                          <span class="text-green-400/60">{fmt(depth().bid_q, 3)}</span>
                        </div>
                        <div class="flex flex-col items-end">
                          <span class="text-text_secondary/40 text-[7px] uppercase">Best Ask</span>
                          <span class="text-red-400 font-black">${fmt(depth().ask_p, 4)}</span>
                          <span class="text-red-400/60">{fmt(depth().ask_q, 3)}</span>
                        </div>
                      </div>
                    </div>
                  </Show>

                  <Show when={tab() === 'chart'}>
                    <div class="p-3 flex flex-col gap-1 text-[8px] font-mono">
                      <Show when={klines().length > 0}>
                        {() => {
                          const last = klines()[klines().length - 1];
                          const prev = klines().length > 1 ? klines()[klines().length - 2] : last;
                          const chg = ((last.close - prev.close) / prev.close * 100);
                          return <>
                            <div class="flex justify-between"><span class="text-text_secondary/40">OPEN</span><span>${fmt(last.open, 4)}</span></div>
                            <div class="flex justify-between"><span class="text-text_secondary/40">HIGH</span><span class="text-green-400">${fmt(last.high, 4)}</span></div>
                            <div class="flex justify-between"><span class="text-text_secondary/40">LOW</span><span class="text-red-400">${fmt(last.low, 4)}</span></div>
                            <div class="flex justify-between"><span class="text-text_secondary/40">VOL</span><span>{fmt(last.volume, 2)}</span></div>
                            <div class="flex justify-between"><span class="text-text_secondary/40">CHG</span><span class={chg >= 0 ? 'text-green-400' : 'text-red-400'}>{chg >= 0 ? '+' : ''}{chg.toFixed(3)}%</span></div>
                          </>;
                        }}
                      </Show>
                    </div>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Footer */}
      <div class="h-6 bg-black/80 border-t border-border_main/30 flex items-center justify-between px-4 shrink-0">
        <div class="flex items-center gap-4 text-[8px]">
          <span class="font-black text-text_secondary tracking-[0.2em]">ENGINE: ECHARTS_LIVE_CORE</span>
          <span class="text-text_secondary/40">SOURCE: BINANCE_WSS_AGG</span>
        </div>
        <span class="text-[8px] font-black text-text_accent italic animate-pulse">MAHAMERU LIVE SURVEILLANCE</span>
      </div>
    </div>
  );
}
