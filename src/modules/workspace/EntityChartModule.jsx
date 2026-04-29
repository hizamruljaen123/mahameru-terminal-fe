import { createSignal, onMount, onCleanup, createEffect, Show, For } from 'solid-js';
import * as echarts from 'echarts';
import { io } from "socket.io-client";

export default function EntityChartModule(props) {
  let chartRef;
  let chart;
  let socket;
  let searchController;

  const [symbol, setSymbol] = createSignal("");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal([]);
  const [chartData, setChartData] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [interval, setInterval] = createSignal(props.initialInterval || "INTRADAY"); // INTRADAY or HISTORICAL
  const [period, setPeriod] = createSignal("1y"); 
  const [tickerPulse, setTickerPulse] = createSignal(false);

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
        setChartData(data.intraday || []);
      } else {
        // Convert yfinance historical format to chart format
        const history = data.history || [];
        const formatted = history.map(d => ({
          time: d.Date,
          open: d.Open,
          high: d.High,
          low: d.Low,
          close: d.Close,
          volume: d.Volume
        }));
        setChartData(formatted);
      }
      initOrUpdateChart();
    } catch (e) {
      console.error("Fetch Error", e);
    } finally {
      setLoading(false);
    }
  };

  const initOrUpdateChart = () => {
    if (!chartRef || !chartData()) return;
    
    if (!chart) {
      chart = echarts.init(chartRef, 'dark');
    }

    const data = chartData();
    const times = data.map(d => d.time);
    const values = data.map(d => [d.open, d.close, d.low, d.high]);
    const volumes = data.map((d, i) => [i, d.volume, d.open > d.close ? -1 : 1]);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(10, 10, 10, 0.9)',
        borderColor: '#333',
        textStyle: { color: '#ccc', fontSize: 10, fontFamily: 'monospace' }
      },
      grid: [
        { left: '40', right: '10', height: '65%', top: '10%' },
        { left: '40', right: '10', height: '15%', top: '80%' }
      ],
      xAxis: [
        {
          type: 'category',
          data: times,
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { fontSize: 8, color: '#666' }
        },
        {
          type: 'category',
          gridIndex: 1,
          data: times,
          axisLabel: { show: false }
        }
      ],
      yAxis: [
        {
          scale: true,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
          axisLabel: { fontSize: 8, color: '#666' }
        },
        {
          scale: true,
          gridIndex: 1,
          axisLabel: { show: false },
          axisLine: { show: false },
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
            color: (params) => params.data[2] === 1 ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 23, 68, 0.3)'
          }
        }
      ]
    };
    chart.setOption(option);
  };

  onMount(() => {
    socket = io(import.meta.env.VITE_ENTITY_URL);
    socket.on("ticker_update", (data) => {
      if (data.symbol === symbol() && interval() === "INTRADAY") {
        setTickerPulse(true);
        // Minimal logic to update the last bar
        setChartData(prev => {
          if (!prev || prev.length === 0) return prev;
          const next = [...prev];
          const last = next[next.length - 1];
          last.close = data.price;
          if (data.price > last.high) last.high = data.price;
          if (data.price < last.low) last.low = data.price;
          return next;
        });
        initOrUpdateChart();
        setTimeout(() => setTickerPulse(false), 1000);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (chart) chart.resize();
    });
    if (chartRef) resizeObserver.observe(chartRef);

    onCleanup(() => {
      if (socket) socket.disconnect();
      resizeObserver.disconnect();
      if (chart) chart.dispose();
    });
  });

  createEffect(() => {
    if (symbol()) {
      loadData(symbol());
      if (socket) socket.emit("subscribe", { symbol: symbol() });
    }
  });

  return (
    <div class="h-full flex flex-col bg-[#111] border border-white/5 rounded-sm overflow-hidden font-mono group">
      {/* Module Header */}
      <div class="drag-handle flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5 cursor-grab active:cursor-grabbing">
        <div class="flex items-center gap-2">
          <div class={`w-1.5 h-1.5 rounded-full ${tickerPulse() ? 'bg-text_accent animate-ping' : 'bg-text_accent/40'}`}></div>
          <span class="text-[9px] font-black text-text_accent uppercase tracking-widest">
            {symbol() || 'Select Entity'} — {interval()} MODE
          </span>
        </div>
        
        <div class="flex items-center gap-2">
          <button 
            onClick={() => props.onRemove(props.instanceId)}
            class="text-text_secondary/40 hover:text-red-500 transition-colors"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Module Controls: Search (Hidden after selection) */}
      <Show when={!symbol()}>
        <div class="p-3 bg-black/20 border-b border-white/5 space-y-3 animate-in slide-in-from-top-1 duration-300">
          {/* Entity Search */}
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

            {/* Suggestions Dropdown */}
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

      {/* Historical Range Selector */}
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

      {/* Chart Canvas */}
      <div class="flex-1 relative min-h-0">
        <Show when={loading()}>
          <div class="absolute inset-0 flex items-center justify-center z-10 bg-black/20 backdrop-blur-[1px]">
            <div class="w-4 h-4 border-2 border-text_accent border-t-transparent animate-spin rounded-full"></div>
          </div>
        </Show>
        
        <Show when={!symbol()}>
           <div class="absolute inset-0 flex items-center justify-center text-[9px] text-text_secondary/20 uppercase font-black tracking-widest">
              Awaiting Symbol Input
           </div>
        </Show>

        <div ref={chartRef} class="w-full h-full"></div>
      </div>
    </div>
  );
}
