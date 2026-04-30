import { For, Show, onMount, createEffect } from 'solid-js';
import * as echarts from 'echarts';

const COLORS = ['sky', 'amber', 'emerald'];
const HEX = ['#38bdf8', '#fbbf24', '#34d399'];
const colorMap = {
  sky: { text: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/30' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
};

function MiniLineChart({ data, color, symbol }) {
  let ref;
  let chart;

  const init = () => {
    if (!ref || !data || data.length === 0) return;
    if (!chart) chart = echarts.init(ref, null, { renderer: 'svg' });
    const closes = data.map(d => d.close || d.Close);
    const dates = data.map(d => d.date || d.Date || '');
    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      grid: { left: 0, right: 0, top: 4, bottom: 4 },
      xAxis: { type: 'category', data: dates, show: false },
      yAxis: { type: 'value', scale: true, show: false },
      series: [{
        type: 'line', data: closes,
        smooth: true,
        lineStyle: { color, width: 1.5 },
        areaStyle: { color: `${color}20` },
        symbol: 'none',
      }]
    });
  };

  onMount(() => {
    init();
    const ro = new ResizeObserver(() => chart?.resize());
    if (ref) ro.observe(ref);
    return () => { ro.disconnect(); chart?.dispose(); };
  });

  createEffect(() => { data; init(); });

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
            const hist = comp?.market?.historical || [];
            const first = hist[0]?.close;
            const last = hist[hist.length - 1]?.close;
            const chg = first ? ((last - first) / first * 100) : null;
            return (
              <div class={`border ${c.border} ${c.bg} rounded p-3 flex flex-col gap-2`}>
                <div class="flex items-center justify-between">
                  <span class={`text-[10px] font-black ${c.text} uppercase tracking-widest`}>{comp.symbol}</span>
                  <Show when={chg !== null}>
                    <span class={`text-[9px] font-black ${chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {chg >= 0 ? '+' : ''}{chg?.toFixed(2)}% (1Y)
                    </span>
                  </Show>
                </div>
                <div class="h-[120px]">
                  <MiniLineChart data={hist.slice(-120)} color={HEX[i()]} symbol={comp.symbol} />
                </div>
                <div class="text-[9px] font-mono text-white/40">
                  Current: <span class="text-white font-black">{fmt(last)}</span>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* TA Indicators Table */}
      <div class="border border-white/5 rounded overflow-hidden">
        <div class="grid gap-4 px-4 py-2 border-b border-white/5 bg-white/[0.03]"
          style={{ 'grid-template-columns': `160px repeat(${companies().length}, 1fr)` }}>
          <div class="text-[8px] font-black text-white/20 uppercase tracking-widest">INDICATOR</div>
          <For each={companies()}>
            {(comp, i) => (
              <div class={`text-[9px] font-black ${colorMap[COLORS[i()]].text} uppercase tracking-widest`}>{comp.symbol}</div>
            )}
          </For>
        </div>

        <For each={[
          { label: 'TA Verdict', fn: (c) => c?.ta?.signals?.verdict || '—', isVerdict: true },
          { label: 'TA Score', fn: (c) => c?.ta?.signals?.score ?? '—' },
          { label: 'RSI (14)', fn: (c) => fmt(c?.ta?.current?.rsi14) },
          { label: 'MACD', fn: (c) => fmt(c?.ta?.current?.macd, 4) },
          { label: 'EMA 20', fn: (c) => fmt(c?.ta?.current?.ema20) },
          { label: 'SMA 50', fn: (c) => fmt(c?.ta?.current?.sma50) },
          { label: 'SMA 200', fn: (c) => fmt(c?.ta?.current?.sma200) },
          { label: 'Support S1', fn: (c) => fmt(c?.ta?.support_resistance?.supports?.[0]) },
          { label: 'Resistance R1', fn: (c) => fmt(c?.ta?.support_resistance?.resistances?.[0]) },
          { label: 'Fib 61.8%', fn: (c) => fmt(c?.ta?.fibonacci?.levels?.['0.618']) },
          { label: 'Beta', fn: (c) => fmt(c?.fundamental?.snapshot?.beta) },
        ]}>
          {(row, ri) => (
            <div class={`grid gap-4 items-center px-4 py-2 ${ri() % 2 === 0 ? 'bg-white/[0.015]' : ''}`}
              style={{ 'grid-template-columns': `160px repeat(${companies().length}, 1fr)` }}>
              <div class="text-[8px] font-bold text-white/30 uppercase tracking-wide">{row.label}</div>
              <For each={companies()}>
                {(comp, i) => {
                  const val = row.fn(comp);
                  return (
                    <div class={`font-mono font-bold text-[10px] ${row.isVerdict ? verdictColor(String(val)) : 'text-white/80'}`}>
                      {val}
                    </div>
                  );
                }}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
