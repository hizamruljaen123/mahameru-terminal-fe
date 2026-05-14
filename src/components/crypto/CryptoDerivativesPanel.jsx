import { createSignal, createEffect, For, Show, onMount, onCleanup, createMemo } from 'solid-js';
import * as echarts from 'echarts';

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? 'N/A' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtVol = (v) => {
  if (v == null || isNaN(v)) return 'N/A';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toFixed(2);
};
const fmtPct = (v) => (v == null || isNaN(v)) ? 'N/A' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(3)}%`;

function SH({ title, action }) {
  return (
    <div class="px-4 py-2 border-b border-border_main bg-bg_header/40 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-1.5 h-1.5 bg-text_accent animate-pulse shadow-[0_0_8px_var(--text-accent)]" />
        <span class="text-[9px] font-black tracking-[0.3em] text-text_primary uppercase font-mono">{title}</span>
      </div>
      {action}
    </div>
  );
}

// ============================================
// NEW: LEVERAGE HEATMAP COMPONENT
// ============================================
function LeverageHeatmap({ liquidations, currentPrice }) {
  let ref, chart;
  
  console.log('LeverageHeatmap props:', { liquidations, currentPrice });
  
  onMount(() => {
    if (!ref) {
      console.log('LeverageHeatmap: ref not available on mount');
      return;
    }
    chart = echarts.init(ref);
    updateChart();
    chart.resize();
  });
  
  createEffect(() => {
    liquidations;
    currentPrice;
    if (chart) {
      updateChart();
      chart.resize();
    }
  });
  
  const updateChart = () => {
    if (!ref || !chart || !liquidations) {
      console.log('LeverageHeatmap: missing data', { ref: !!ref, chart: !!chart, liquidations: !!liquidations });
      return;
    }
    
    console.log('LeverageHeatmap: updating chart with', {
      longLiqs: liquidations?.long_liquidations?.length || 0,
      shortLiqs: liquidations?.short_liquidations?.length || 0,
      currentPrice: currentPrice
    });
    
    const longLiqs = liquidations?.long_liquidations || [];
    const shortLiqs = liquidations?.short_liquidations || [];
    
    // Create heatmap data showing leverage concentration
    const data = [];
    longLiqs.forEach(l => {
      const intensity = Math.max(0.2, 1 - (l.leverage / 100));
      data.push({
        name: `${l.leverage}x Long`,
        value: [0, l.price, intensity],
        itemStyle: { color: `rgba(246, 70, 93, ${intensity})` }
      });
    });
    shortLiqs.forEach(l => {
      const intensity = Math.max(0.2, 1 - (l.leverage / 100));
      data.push({
        name: `${l.leverage}x Short`,
        value: [1, l.price, intensity],
        itemStyle: { color: `rgba(14, 203, 129, ${intensity})` }
      });
    });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        formatter: p => `${p.name}<br/>Price: $${fmt(p.value[1])}`
      },
      grid: { top: 10, right: 30, bottom: 30, left: 50 },
      xAxis: {
        type: 'category',
        data: ['LONG', 'SHORT'],
        axisLabel: { color: '#555', fontSize: 9 },
        axisLine: { lineStyle: { color: '#333' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#555', fontSize: 8, formatter: v => '$' + fmt(v) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }
      },
      series: [{
        type: 'scatter',
        data: data,
        symbolSize: p => Math.max(15, 50 * p[2]),
        itemStyle: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }
      }]
    });
    
    chart.resize();
  };
  
  const h = () => chart?.resize();
  window.addEventListener('resize', h);
  onCleanup(() => { window.removeEventListener('resize', h); chart?.dispose(); });
  
  return <div ref={el => { ref = el; }} class="w-full h-full" style={{ height: '100%' }} />;
}

// ============================================
// NEW: LIQUIDATION CASCADE PREDICTOR
// ============================================
function LiquidationCascade({ liquidations, currentPrice }) {
  let ref, chart;
  
  console.log('LiquidationCascade props:', { liquidations, currentPrice });
  
  onMount(() => {
    if (!ref) {
      console.log('LiquidationCascade: ref not available on mount');
      return;
    }
    chart = echarts.init(ref);
    updateChart();
    chart.resize();
  });
  
  createEffect(() => {
    liquidations;
    currentPrice;
    if (chart) {
      updateChart();
      chart.resize();
    }
  });
  
  const updateChart = () => {
    if (!ref || !chart || !liquidations) {
      console.log('LiquidationCascade: missing data', { ref: !!ref, chart: !!chart, liquidations: !!liquidations });
      return;
    }
    
    console.log('LiquidationCascade: updating chart with', {
      longLiqs: liquidations?.long_liquidations?.length || 0,
      shortLiqs: liquidations?.short_liquidations?.length || 0,
      currentPrice: currentPrice
    });
    
    const longLiqs = liquidations?.long_liquidations?.slice(0, 10) || [];
    const shortLiqs = liquidations?.short_liquidations?.slice(0, 10) || [];
    
    const data = longLiqs.map(l => ({
      name: `${l.leverage}x Long`,
      value: [l.price, l.pct_from_current, 'LONG'],
      itemStyle: { color: 'rgba(246, 70, 93, 0.6)' }
    })).concat(shortLiqs.map(l => ({
      name: `${l.leverage}x Short`,
      value: [l.price, l.pct_from_current, 'SHORT'],
      itemStyle: { color: 'rgba(14, 203, 129, 0.6)' }
    })));

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        formatter: p => `
          <div style="color:#fff;font-family:monospace">
            <strong>${p.name}</strong><br/>
            Price: $${fmt(p.value[0])}<br/>
            From Current: ${fmtPct(p.value[1])}
          </div>
        `
      },
      grid: { top: 10, right: 30, bottom: 30, left: 50 },
      xAxis: {
        type: 'value',
        name: 'Price ($)',
        axisLabel: { color: '#555', fontSize: 8, formatter: v => '$' + fmt(v) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }
      },
      yAxis: {
        type: 'value',
        name: 'Distance from Current (%)',
        axisLabel: { color: '#555', fontSize: 8, formatter: v => fmtPct(v) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }
      },
      series: [{
        type: 'scatter',
        data: data,
        symbolSize: p => Math.max(20, 80 * Math.abs(p?.value?.[1] || 0) / 10),
        itemStyle: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }
      }]
    });
    
    chart.resize();
  };
  
  const h = () => chart?.resize();
  window.addEventListener('resize', h);
  onCleanup(() => { window.removeEventListener('resize', h); chart?.dispose(); });
  
  return <div ref={el => { ref = el; }} class="w-full h-full" style={{ height: '100%' }} />;
}

// ============================================
// NEW: FUNDING RATE SIGNAL DETECTOR
// ============================================
function FundingSignalBadge({ rate, avgRate }) {
  const signal = createMemo(() => {
    if (rate == null) return { signal: 'NEUTRAL', color: 'bg-blue-500/20 text-blue-400', desc: 'No signal' };
    
    const r = parseFloat(rate);
    const avg = parseFloat(avgRate) || 0.01;
    
    // Extreme funding detection
    if (r > 0.05) return { signal: 'EXTREME LONG', color: 'bg-red-500/30 text-red-400', desc: 'Crowded longs - potential squeeze', icon: '⚠️' };
    if (r < -0.05) return { signal: 'EXTREME SHORT', color: 'bg-green-500/30 text-green-400', desc: 'Crowded shorts - potential squeeze', icon: '⚠️' };
    
    // Mean reversion signals
    if (r > avg * 2 && r > 0.01) return { signal: 'OVERHEATED', color: 'bg-orange-500/20 text-orange-400', desc: 'Cooling likely', icon: '🔥' };
    if (r < -avg * 2 && r < -0.01) return { signal: 'OVERSOLD', color: 'bg-cyan-500/20 text-cyan-400', desc: 'Rebound likely', icon: '❄️' };
    
    // Trend following
    if (r > 0.01) return { signal: 'BULLISH FUNDING', color: 'bg-green-500/20 text-green-400', desc: 'Longs paying shorts', icon: '📈' };
    if (r < -0.01) return { signal: 'BEARISH FUNDING', color: 'bg-red-500/20 text-red-400', desc: 'Shorts paying longs', icon: '📉' };
    
    return { signal: 'NEUTRAL', color: 'bg-blue-500/20 text-blue-400', desc: 'Balanced market', icon: '⚖️' };
  });
  
  return (
    <div class={`px-3 py-2 rounded ${signal().color} flex items-center gap-2`}>
      <span class="text-sm">{signal().icon}</span>
      <div class="flex flex-col">
        <span class="text-[10px] font-black uppercase">{signal().signal}</span>
        <span class="text-[8px] text-text_secondary">{signal().desc}</span>
      </div>
    </div>
  );
}

function FundingChart({ data }) {
  let ref, chart;
  onMount(() => {
    if (!ref || !data?.length) return;
    chart = echarts.init(ref);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#0a0a0a', borderColor: '#333', textStyle: { color: '#ccc', fontSize: 10 } },
      grid: { top: 20, right: 20, bottom: 40, left: 50 },
      xAxis: { type: 'category', data: data.map((_, i) => `${i}`), axisLabel: { color: '#555', fontSize: 8 }, axisLine: { lineStyle: { color: '#333' } } },
      yAxis: { type: 'value', axisLabel: { color: '#555', fontSize: 8, formatter: v => v + '%' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } } },
      series: [{ type: 'bar', data: data.map(d => ({ value: d.rate, itemStyle: { color: d.rate > 0 ? '#00e676' : '#ff1744' } })) }]
    });
    const h = () => chart?.resize();
    window.addEventListener('resize', h);
    onCleanup(() => { window.removeEventListener('resize', h); chart?.dispose(); });
  });
  return <div ref={ref} class="w-full h-full" />;
}

function OIChart({ data }) {
  let ref, chart;
  onMount(() => {
    if (!ref || !data?.length) return;
    chart = echarts.init(ref);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#0a0a0a', borderColor: '#333', textStyle: { color: '#ccc', fontSize: 10 } },
      grid: { top: 20, right: 20, bottom: 30, left: 60 },
      xAxis: { type: 'category', data: data.map((_, i) => i), show: false },
      yAxis: { type: 'value', axisLabel: { color: '#555', fontSize: 8 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } } },
      series: [
        { name: 'OI Value', type: 'line', data: data.map(d => d.oi_value), smooth: true, symbol: 'none', lineStyle: { color: '#448aff', width: 2 }, areaStyle: { color: 'rgba(68,138,255,0.08)' } }
      ]
    });
    const h = () => chart?.resize();
    window.addEventListener('resize', h);
    onCleanup(() => { window.removeEventListener('resize', h); chart?.dispose(); });
  });
  return <div ref={ref} class="w-full h-full" />;
}

export default function CryptoDerivativesPanel(props) {
  const [data, setData] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const API = import.meta.env.VITE_CRYPTO_API;

  const fetchData = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API}/api/crypto/derivatives/${props.symbol}`);
      const json = await resp.json();
      console.log('Derivatives data:', json);
      if (json.status === 'success') setData(json.data);
    } catch (e) { console.error('Derivatives fetch error:', e); }
    setLoading(false);
  };

  createEffect(() => { props.symbol; fetchData(); });

  return (
    <div class="flex flex-col gap-6 animate-in fade-in duration-500">
      <Show when={loading()}>
        <div class="flex items-center justify-center py-20 gap-3">
          <div class="w-6 h-6 border-2 border-text_accent border-t-transparent animate-spin rounded-full" />
          <span class="text-[9px] font-black text-text_accent tracking-[0.4em] uppercase">LOADING DERIVATIVES DATA...</span>
        </div>
      </Show>
      <Show when={!loading() && data()}>
        {/* FUNDING RATE + OPEN INTEREST */}
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 lg:col-span-6 flex flex-col border-2 border-border_main bg-black/40 h-[350px]">
            <SH title="FUNDING RATE HISTORY" />
            <div class="flex-1 p-2 min-h-0">
              <Show when={data()?.funding_rates?.history?.length} fallback={<div class="flex items-center justify-center h-full text-[9px] text-text_secondary">NO FUTURES DATA</div>}>
                <FundingChart data={data().funding_rates.history} />
              </Show>
            </div>
            <Show when={data()?.funding_rates && !data().funding_rates.error}>
              <div class="px-4 py-3 border-t border-border_main bg-bg_header/20 flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <span class="text-[8px] font-black text-text_secondary uppercase">CURRENT RATE</span>
                  <span class={`text-[12px] font-black font-mono ${data().funding_rates.current_rate > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data().funding_rates.current_rate}%
                  </span>
                </div>
                <FundingSignalBadge rate={data().funding_rates.current_rate} avgRate={data().funding_rates.avg_rate} />
              </div>
            </Show>
          </div>

          <div class="col-span-12 lg:col-span-6 flex flex-col border-2 border-border_main bg-black/40 h-[350px]">
            <SH title="OPEN INTEREST" />
            <div class="flex-1 p-2 min-h-0">
              <Show when={data()?.open_interest?.history?.length} fallback={<div class="flex items-center justify-center h-full text-[9px] text-text_secondary">NO OI DATA</div>}>
                <OIChart data={data().open_interest.history} />
              </Show>
            </div>
            <Show when={data()?.open_interest && !data().open_interest.error}>
              <div class="px-4 py-3 border-t border-border_main bg-bg_header/20 flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <span class="text-[8px] font-black text-text_secondary uppercase">TREND</span>
                  <span class={`text-[10px] font-black ${data().open_interest.trend === 'RISING' ? 'text-green-400' : data().open_interest.trend === 'FALLING' ? 'text-red-400' : 'text-blue-400'}`}>
                    {data().open_interest.trend}
                  </span>
                </div>
                <span class="text-[9px] font-black text-text_secondary">24H: <span class={data().open_interest.change_24h >= 0 ? 'text-green-400' : 'text-red-400'}>{data().open_interest.change_24h}%</span></span>
              </div>
            </Show>
          </div>
        </div>

        {/* LIQUIDATION CASCADE + LEVERAGE HEATMAP */}
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 lg:col-span-6 flex flex-col border-2 border-border_main bg-black/40 h-[350px]">
            <SH title="LIQUIDATION CASCADE PREDICTOR" />
            <div class="flex-1 p-2 min-h-0 relative">
              <Show when={data()?.liquidation_zones && !data().liquidation_zones.error}>
                <LiquidationCascade liquidations={data().liquidation_zones} currentPrice={data().liquidation_zones.current_price} />
              </Show>
              <Show when={!data()?.liquidation_zones || data().liquidation_zones.error}>
                <div class="absolute inset-0 flex items-center justify-center text-[9px] text-text_secondary">
                  NO LIQUIDATION DATA
                </div>
              </Show>
            </div>
            <div class="px-4 py-2 border-t border-border_main bg-bg_header/20 flex items-center justify-between">
              <span class="text-[8px] font-black text-text_secondary">CURRENT PRICE: <span class="text-white font-mono">${fmt(data().liquidation_zones?.current_price)}</span></span>
              <span class="text-[8px] font-black text-text_secondary">LIQUIDATION ZONES: {data().liquidation_zones?.long_liquidations?.length || 0} LONG / {data().liquidation_zones?.short_liquidations?.length || 0} SHORT</span>
            </div>
          </div>

          <div class="col-span-12 lg:col-span-6 flex flex-col border-2 border-border_main bg-black/40 h-[350px]">
            <SH title="LEVERAGE HEATMAP" />
            <div class="flex-1 p-2 min-h-0 relative">
              <Show when={data()?.liquidation_zones && !data().liquidation_zones.error}>
                <LeverageHeatmap liquidations={data().liquidation_zones} currentPrice={data().liquidation_zones.current_price} />
              </Show>
              <Show when={!data()?.liquidation_zones || data().liquidation_zones.error}>
                <div class="absolute inset-0 flex items-center justify-center text-[9px] text-text_secondary">
                  NO LEVERAGE DATA
                </div>
              </Show>
            </div>
            <div class="px-4 py-2 border-t border-border_main bg-bg_header/20 flex items-center justify-between">
              <span class="text-[8px] font-black text-text_secondary">HEATMAP: LEVERAGE CONCENTRATION</span>
              <span class="text-[8px] font-black text-text_secondary">INTENSITY: {data().liquidation_zones?.long_liquidations?.length ? 'HIGH' : 'LOW'}</span>
            </div>
          </div>
        </div>

        {/* LONG/SHORT RATIO */}
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 lg:col-span-6 flex flex-col border-2 border-border_main bg-black/40">
            <SH title="GLOBAL LONG/SHORT RATIO" />
            <div class="p-4">
              <Show when={data()?.long_short_ratio && !data().long_short_ratio.error} fallback={<div class="py-10 text-center text-[9px] text-text_secondary">RATIO DATA UNAVAILABLE</div>}>
                <div class="flex flex-col gap-4">
                  <div class="text-center">
                    <span class={`text-[14px] font-black ${data().long_short_ratio.bias === 'LONG HEAVY' ? 'text-green-400' : data().long_short_ratio.bias === 'SHORT HEAVY' ? 'text-red-400' : 'text-blue-400'}`}>
                      {data().long_short_ratio.bias}
                    </span>
                  </div>
                  <Show when={data().long_short_ratio.current}>
                    <div class="flex gap-2 h-8">
                      <div class="bg-green-500/30 border border-green-500/50 flex items-center justify-center transition-all" style={{ width: `${data().long_short_ratio.current.long_pct}%` }}>
                        <span class="text-[9px] font-black text-green-300">LONG {data().long_short_ratio.current.long_pct}%</span>
                      </div>
                      <div class="bg-red-500/30 border border-red-500/50 flex items-center justify-center transition-all" style={{ width: `${data().long_short_ratio.current.short_pct}%` }}>
                        <span class="text-[9px] font-black text-red-300">SHORT {data().long_short_ratio.current.short_pct}%</span>
                      </div>
                    </div>
                    <div class="text-center">
                      <span class="text-[8px] font-black text-text_secondary uppercase">RATIO: </span>
                      <span class="text-[12px] font-black text-white font-mono">{data().long_short_ratio.current.ratio}</span>
                    </div>
                  </Show>
                  {/* History table */}
                  <div class="max-h-[250px] overflow-y-auto win-scroll">
                    <table class="w-full text-[9px] font-mono">
                      <thead class="sticky top-0 bg-bg_header/80">
                        <tr><th class="p-2 text-left text-text_accent">TIME</th><th class="p-2 text-right text-green-400">LONG%</th><th class="p-2 text-right text-red-400">SHORT%</th><th class="p-2 text-right text-white">RATIO</th></tr>
                      </thead>
                      <tbody>
                        <For each={(data().long_short_ratio.history || []).slice(-20).reverse()}>
                          {(h) => (
                            <tr class="border-t border-border_main/5 hover:bg-white/5">
                              <td class="p-2 text-text_secondary">{new Date(h.time).toLocaleTimeString()}</td>
                              <td class="p-2 text-right text-green-400">{h.long_pct}%</td>
                              <td class="p-2 text-right text-red-400">{h.short_pct}%</td>
                              <td class="p-2 text-right text-white font-bold">{h.ratio}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Show>
            </div>
          </div>

          <div class="col-span-12 lg:col-span-6 flex flex-col border-2 border-border_main bg-black/40">
            <SH title="LIQUIDATION ZONE MAP" />
            <div class="p-4">
              <Show when={data()?.liquidation_zones && !data().liquidation_zones.error}>
                <div class="text-center mb-4">
                  <span class="text-[10px] font-black text-text_secondary uppercase">CURRENT PRICE</span>
                  <div class="text-[20px] font-black text-white font-mono">${fmt(data().liquidation_zones.current_price)}</div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <span class="text-[8px] font-black text-red-400 uppercase tracking-widest block mb-2 text-center">LONG LIQUIDATIONS ↓</span>
                    <For each={data().liquidation_zones.long_liquidations.slice(0, 8)}>
                      {(liq) => (
                        <div class="flex justify-between py-1.5 border-b border-border_main/10 hover:bg-red-500/5">
                          <span class="text-[9px] font-black text-text_secondary">{liq.leverage}x</span>
                          <span class="text-[9px] font-mono text-red-400">${fmt(liq.price)} ({liq.pct_from_current}%)</span>
                        </div>
                      )}
                    </For>
                  </div>
                  <div>
                    <span class="text-[8px] font-black text-green-400 uppercase tracking-widest block mb-2 text-center">SHORT LIQUIDATIONS ↑</span>
                    <For each={data().liquidation_zones.short_liquidations.slice(0, 8)}>
                      {(liq) => (
                        <div class="flex justify-between py-1.5 border-b border-border_main/10 hover:bg-green-500/5">
                          <span class="text-[9px] font-black text-text_secondary">{liq.leverage}x</span>
                          <span class="text-[9px] font-mono text-green-400">${fmt(liq.price)} (+{liq.pct_from_current}%)</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
