import { For, Show, onMount, createEffect } from 'solid-js';
import * as echarts from 'echarts';

const COLORS = ['sky', 'amber', 'emerald'];
const HEX = ['#38bdf8', '#fbbf24', '#34d399'];
const colorMap = {
  sky: { text: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/30' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
};

function ComparativeCandleChart(props) {
  let ref;
  let chart;

  const init = () => {
    if (!ref || !props.data || props.data.length === 0) return;
    if (!chart) chart = echarts.init(ref, null, { renderer: 'canvas' });
    
    const dates = props.data.map(d => d.date || d.Date || '');
    const ohlc = props.data.map(d => [d.open || d.Open, d.close || d.Close, d.low || d.Low, d.high || d.High]);
    const volumes = props.data.map((d, i) => ({
      value: d.volume || d.Volume || 0,
      itemStyle: { color: (d.close || d.Close) >= (d.open || d.Open) ? `${props.hex}44` : '#ff174444' }
    }));

    const taData = props.ta || {};
    const ind = taData.indicators || {};

    const makeLine = (arr, name, color, width = 1, type = 'solid') => ({
      name, type: 'line', data: arr?.slice(-60), smooth: true,
      lineStyle: { color, width, type, opacity: 0.8 },
      symbol: 'none', z: 3
    });

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      grid: [
        { left: 0, right: 0, top: 10, bottom: 20 },
        { left: 0, right: 0, top: '80%', bottom: 0 }
      ],
      xAxis: [
        { type: 'category', data: dates.slice(-60), show: false, gridIndex: 0 },
        { type: 'category', data: dates.slice(-60), show: false, gridIndex: 1 }
      ],
      yAxis: [
        { type: 'value', scale: true, show: false, gridIndex: 0 },
        { type: 'value', show: false, gridIndex: 1 }
      ],
      series: [
        {
          type: 'candlestick',
          data: ohlc.slice(-60),
          itemStyle: {
            color: props.hex,
            color0: '#ef4444',
            borderColor: props.hex,
            borderColor0: '#ef4444'
          }
        },
        {
          name: 'Volume',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes.slice(-60)
        },
        makeLine(ind.sma?.sma20, 'SMA20', '#f59e0b', 1),
        makeLine(ind.sma?.sma50, 'SMA50', '#3b82f6', 1),
        makeLine(ind.bb?.upper, 'BBU', '#94a3b8', 0.5, 'dotted'),
        makeLine(ind.bb?.lower, 'BBL', '#94a3b8', 0.5, 'dotted'),
      ]
    });
  };

  onMount(() => {
    init();
    const ro = new ResizeObserver(() => chart?.resize());
    if (ref) ro.observe(ref);
    return () => { ro.disconnect(); chart?.dispose(); };
  });

  createEffect(() => {
    props.data;
    props.ta;
    init();
  });

  return <div ref={ref} class="w-full h-full" />;
}

export default function TechnicalComparePanel(props) {
  const companies = () => props.companies || [];

  const fmt = (v, d = 2) => (v == null || isNaN(v)) ? '—' : Number(v).toFixed(d);
  const verdictColor = (v = '') => {
    if (v.includes('BUY')) return 'text-emerald-400';
    if (v.includes('SELL')) return 'text-red-400';
    return 'text-white/50';
  };

  return (
    <div class="flex flex-col gap-6">
      {/* Price Chart Grid */}
      <div class={`grid gap-4`} style={{ 'grid-template-columns': `repeat(${companies().length}, 1fr)` }}>
        <For each={companies()}>
          {(comp, i) => {
            const c = colorMap[COLORS[i()]];
            const hex = HEX[i()];
            const hist = comp?.market?.historical || [];
            const validPrices = hist.filter(d => d.close != null && d.close > 0);
            const last = validPrices.length > 0 ? validPrices[validPrices.length - 1].close : null;
            const currentYear = new Date().getFullYear();
            const ytdStartEntry = validPrices.find(d => d.date && d.date.startsWith(`${currentYear}-01`)) || validPrices[0];
            const first = ytdStartEntry?.close;
            const chg = (first && last) ? ((last - first) / first * 100) : null;

            return (
              <div class={`border ${c.border} ${c.bg} rounded p-3 flex flex-col gap-2`}>
                <div class="flex items-center justify-between">
                  <div class="flex flex-col">
                    <span class={`text-[10px] font-black ${c.text} uppercase tracking-widest`}>{comp.symbol}</span>
                    <span class="text-[7px] text-white/20 uppercase font-bold">{comp?.fundamental?.snapshot?.name}</span>
                  </div>
                  <Show when={chg !== null}>
                    <div class="flex flex-col items-end">
                      <span class={`text-[10px] font-black ${chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {chg >= 0 ? '+' : ''}{chg?.toFixed(2)}%
                      </span>
                      <span class="text-[6px] text-white/20 font-bold uppercase tracking-tighter">YTD_PERF</span>
                    </div>
                  </Show>
                </div>
                <div class="h-[140px] mt-2">
                  <ComparativeCandleChart data={hist} ta={comp?.ta} color={c.text} hex={hex} />
                </div>
                <div class="flex items-center justify-between mt-1 border-t border-white/5 pt-2">
                  <div class="flex flex-col">
                    <span class="text-[6px] text-white/30 uppercase font-black tracking-widest">LAST_PRICE</span>
                    <span class="text-[11px] font-black font-mono text-white">{fmt(last)}</span>
                  </div>
                  <div class="flex flex-col items-end">
                    <span class="text-[6px] text-white/30 uppercase font-black tracking-widest">VERDICT</span>
                    <span class={`text-[9px] font-black uppercase ${verdictColor(comp?.ta?.signals?.verdict)}`}>
                      {comp?.ta?.signals?.verdict || 'NEUTRAL'}
                    </span>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Technical Score Visualization */}
      <div class="glass-panel p-4 flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <h3 class="text-[8px] font-black text-text_accent tracking-[0.4em] uppercase">Comparative Momentum Score</h3>
          <div class="h-px bg-white/5 flex-1"></div>
        </div>
        <div class="grid gap-6 items-end" style={{ 'grid-template-columns': `repeat(${companies().length}, 1fr)` }}>
          <For each={companies()}>
            {(comp, i) => {
              const score = comp?.ta?.signals?.score || 0;
              const c = colorMap[COLORS[i()]];
              const h = Math.max((score / 100) * 100, 5); 
              return (
                <div class="flex flex-col items-center gap-3 group">
                   <div class="relative w-full flex flex-col items-center">
                    <div class="absolute -top-6 text-[10px] font-black text-white/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      {score.toFixed(1)}
                    </div>
                    <div class="w-full max-w-[40px] bg-white/5 rounded-t-sm relative overflow-hidden h-[100px] flex items-end">
                      <div 
                        class={`w-full ${c.bg.replace('/10', '/40')} transition-all duration-1000 ease-out border-t-2 ${c.border.replace('/30', '')}`}
                        style={{ height: `${h}%` }}
                      >
                        <div class="absolute inset-0 bg-gradient-to-t from-transparent to-white/5"></div>
                      </div>
                    </div>
                  </div>
                  <div class="flex flex-col items-center">
                    <span class={`text-[9px] font-black ${c.text} uppercase tracking-widest`}>{comp.symbol}</span>
                    <span class="text-[7px] text-white/20 font-bold uppercase">{comp?.ta?.signals?.verdict || 'NEUTRAL'}</span>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* TA Indicators Table */}
      <div class="bg-black/20 border border-white/5 rounded-sm overflow-hidden">
        <div class="px-4 py-2 bg-white/5 border-b border-white/5 flex items-center gap-2">
          <div class="w-1 h-3 bg-text_accent"></div>
          <span class="text-[9px] font-black tracking-[0.2em] uppercase text-white/80">TECHNICAL_INDICATOR_MATRIX</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-[9px] font-mono">
            <thead>
              <tr class="border-b border-white/10">
                <th class="px-4 py-2 text-left text-white/20 font-black uppercase tracking-widest">INDICATOR</th>
                <For each={companies()}>
                  {(comp, i) => (
                    <th class={`px-4 py-2 text-left font-black uppercase tracking-widest ${colorMap[COLORS[i()]].text}`}>
                      {comp.symbol}
                    </th>
                  )}
                </For>
              </tr>
            </thead>
            <tbody>
              <For each={[
                { label: 'TA Verdict', fn: (c) => c?.ta?.signals?.verdict || '—', isVerdict: true },
                { label: 'TA Score', fn: (c) => c?.ta?.signals?.score ?? '—' },
                { label: 'RSI (14)', fn: (c) => fmt(c?.ta?.current?.rsi14) },
                { label: 'MACD (Line)', fn: (c) => fmt(c?.ta?.current?.macd, 4) },
                { label: 'EMA 20', fn: (c) => fmt(c?.ta?.current?.ema20) },
                { label: 'SMA 50', fn: (c) => fmt(c?.ta?.current?.sma50) },
                { label: 'SMA 200', fn: (c) => fmt(c?.ta?.current?.sma200) },
                { label: 'Support S1', fn: (c) => fmt(c?.ta?.support_resistance?.supports?.[0]) },
                { label: 'Resistance R1', fn: (c) => fmt(c?.ta?.support_resistance?.resistances?.[0]) },
                { label: 'Fib 61.8%', fn: (c) => fmt(c?.ta?.fibonacci?.levels?.['0.618']) },
              ].filter(row => {
                // Only show row if at least one company has data (!= '—')
                return companies().some(comp => row.fn(comp) !== '—');
              })}>
                {(row, ri) => (
                  <tr class={`border-b border-white/5 transition-colors hover:bg-white/5 ${ri() % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                    <td class="px-4 py-2 text-white/40 font-bold uppercase tracking-tighter">{row.label}</td>
                    <For each={companies()}>
                      {(comp) => {
                        const val = row.fn(comp);
                        return (
                          <td class={`px-4 py-2 font-mono font-black ${row.isVerdict ? verdictColor(String(val)) : 'text-white/80'}`}>
                            {val}
                          </td>
                        );
                      }}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
