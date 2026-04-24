import { createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import * as echarts from 'echarts';

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? 'N/A' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (v == null || isNaN(v)) ? 'N/A' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

function SH({ title }) {
  return (
    <div class="px-4 py-2 border-b border-border_main bg-bg_header/40 flex items-center gap-3 shrink-0">
      <div class="w-1.5 h-1.5 bg-text_accent animate-pulse shadow-[0_0_8px_var(--text-accent)]" />
      <span class="text-[9px] font-black tracking-[0.3em] text-text_primary uppercase font-mono">{title}</span>
    </div>
  );
}

function DominancePie({ data }) {
  let ref, chart;
  onMount(() => {
    if (!ref || !data) return;
    chart = echarts.init(ref);
    const colors = ['#f7931a', '#627eea', '#26a17b', '#f0b90b', '#9945ff', '#00adef', '#0033ad', '#0d1e30', '#c3a634', '#e84142'];
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { formatter: p => `${p.name}: ${p.value}%` },
      series: [{
        type: 'pie', radius: ['45%', '75%'], center: ['50%', '50%'],
        label: { color: '#aaa', fontSize: 9, formatter: '{b}: {c}%' },
        emphasis: { label: { fontSize: 11, fontWeight: 'bold' } },
        data: entries.map(([k, v], i) => ({ name: k, value: v, itemStyle: { color: colors[i % colors.length] } }))
      }]
    });
    const h = () => chart?.resize();
    window.addEventListener('resize', h);
    onCleanup(() => { window.removeEventListener('resize', h); chart?.dispose(); });
  });
  return <div ref={ref} class="w-full h-full" />;
}

function FearGreedGauge({ value, label }) {
  let ref, chart;
  onMount(() => {
    if (!ref) return;
    chart = echarts.init(ref);
    const v = value || 50;
    chart.setOption({
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge', startAngle: 200, endAngle: -20,
        min: 0, max: 100,
        axisLine: { lineStyle: { width: 20, color: [[0.25, '#ff1744'], [0.5, '#ff9100'], [0.75, '#ffea00'], [1, '#00e676']] } },
        pointer: { itemStyle: { color: '#fff' }, width: 4 },
        axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { color: '#555', fontSize: 9, distance: 25 },
        detail: { valueAnimation: true, formatter: `{value}\n${label || ''}`, color: '#fff', fontSize: 18, fontWeight: 'bold', offsetCenter: [0, '70%'] },
        data: [{ value: v }]
      }]
    });
    const h = () => chart?.resize();
    window.addEventListener('resize', h);
    onCleanup(() => { window.removeEventListener('resize', h); chart?.dispose(); });
  });
  return <div ref={ref} class="w-full h-full" />;
}

export default function CryptoMacroPanel(props) {
  const [data, setData] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const API = import.meta.env.VITE_CRYPTO_API;

  const fetchData = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API}/api/crypto/macro`);
      const json = await resp.json();
      if (json.status === 'success') setData(json.data);
    } catch (e) { console.error('Macro fetch error:', e); }
    setLoading(false);
  };

  onMount(fetchData);

  return (
    <div class="flex flex-col gap-6 animate-in fade-in duration-500">
      <Show when={loading()}>
        <div class="flex items-center justify-center py-20 gap-3">
          <div class="w-6 h-6 border-2 border-text_accent border-t-transparent animate-spin rounded-full" />
          <span class="text-[9px] font-black text-text_accent tracking-[0.4em] uppercase">LOADING MACRO INTELLIGENCE...</span>
        </div>
      </Show>
      <Show when={!loading() && data()}>
        {/* FEAR & GREED + DOMINANCE */}
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40 h-[350px]">
            <SH title="FEAR & GREED INDEX" />
            <div class="flex-1 min-h-0">
              <Show when={data()?.fear_greed?.current} fallback={<div class="flex items-center justify-center h-full text-[9px] text-text_secondary">UNAVAILABLE</div>}>
                <FearGreedGauge value={data().fear_greed.current.value} label={data().fear_greed.current.label} />
              </Show>
            </div>
          </div>
          <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40 h-[350px]">
            <SH title="MARKET DOMINANCE" />
            <div class="flex-1 min-h-0">
              <Show when={data()?.dominance?.dominance}>
                <DominancePie data={data().dominance.dominance} />
              </Show>
            </div>
          </div>
          <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40 h-[350px]">
            <SH title="STABLECOIN SUPPLY RATIO" />
            <div class="p-4 flex flex-col gap-4 overflow-y-auto win-scroll">
              <Show when={data()?.stablecoin && !data().stablecoin.error}>
                <div class="bg-black/30 p-4 border border-border_main/20 text-center">
                  <span class="text-[8px] font-black text-text_secondary uppercase block mb-1">SSR (BTC MCAP / STABLE MCAP)</span>
                  <span class="text-[24px] font-black text-white font-mono">{data().stablecoin.ssr}</span>
                  <span class={`text-[9px] font-black block mt-1 ${
                    data().stablecoin.ssr_signal?.includes('HIGH') ? 'text-green-400' :
                    data().stablecoin.ssr_signal?.includes('LOW') ? 'text-red-400' : 'text-blue-400'}`}>
                    {data().stablecoin.ssr_signal}
                  </span>
                </div>
                <div class="text-[8px] font-black text-text_secondary uppercase mb-1">TOTAL STABLE MCAP</div>
                <span class="text-[14px] font-black text-white font-mono">${(data().stablecoin.total_market_cap / 1e9).toFixed(2)}B</span>
                <For each={data().stablecoin.stablecoins || []}>
                  {(s) => (
                    <div class="flex items-center justify-between py-2 border-t border-border_main/10">
                      <span class="text-[9px] font-black text-text_primary">{s.symbol}</span>
                      <div class="flex items-center gap-3">
                        <span class="text-[8px] text-text_secondary">${(s.market_cap / 1e9).toFixed(1)}B</span>
                        <span class={`text-[8px] font-black px-1.5 py-0.5 ${s.peg_status === 'STABLE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{s.peg_status}</span>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </div>

        {/* ETF FLOW TRACKER */}
        <div class="flex flex-col border-2 border-border_main bg-black/40 max-h-[500px]">
          <SH title="SPOT CRYPTO ETF TRACKER" />
          <div class="flex-1 overflow-y-auto win-scroll">
            <Show when={data()?.etf_flows?.etfs?.length} fallback={<div class="p-10 text-center text-[9px] text-text_secondary">ETF DATA LOADING...</div>}>
              <table class="w-full text-left text-[10px] font-mono border-collapse">
                <thead class="bg-bg_header/60 sticky top-0 z-10 border-b border-border_main">
                  <tr>
                    <th class="p-3 text-text_accent font-black tracking-widest">TICKER</th>
                    <th class="p-3 text-white font-black tracking-widest">NAME</th>
                    <th class="p-3 text-white font-black tracking-widest">TYPE</th>
                    <th class="p-3 text-white font-black tracking-widest text-right">PRICE</th>
                    <th class="p-3 text-white font-black tracking-widest text-right">1D CHG</th>
                    <th class="p-3 text-white font-black tracking-widest text-right">VOLUME</th>
                    <th class="p-3 text-white font-black tracking-widest text-right">VOL RATIO</th>
                    <th class="p-3 text-white font-black tracking-widest text-right">AUM</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border_main/10">
                  <For each={data().etf_flows.etfs}>
                    {(etf) => (
                      <tr class="hover:bg-white/5 transition-colors">
                        <td class="p-3 text-text_accent font-bold">{etf.ticker}</td>
                        <td class="p-3 text-white text-[9px] max-w-[200px] truncate">{etf.name}</td>
                        <td class={`p-3 font-black ${etf.type === 'BTC' ? 'text-orange-400' : 'text-blue-400'}`}>{etf.type}</td>
                        <td class="p-3 text-right text-white">${fmt(etf.price)}</td>
                        <td class={`p-3 text-right font-bold ${etf.change_1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(etf.change_1d)}</td>
                        <td class="p-3 text-right text-text_secondary">{(etf.volume / 1e6).toFixed(1)}M</td>
                        <td class={`p-3 text-right font-bold ${etf.vol_ratio > 1.5 ? 'text-yellow-400' : 'text-text_secondary'}`}>{etf.vol_ratio}x</td>
                        <td class="p-3 text-right text-text_secondary">{etf.aum > 0 ? `$${(etf.aum / 1e9).toFixed(2)}B` : 'N/A'}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </div>
          <Show when={data()?.etf_flows?.aggregate}>
            <div class="px-4 py-3 border-t border-border_main bg-bg_header/20 flex items-center gap-8">
              <span class="text-[8px] font-black text-text_secondary">BTC ETF VOL: <span class="text-orange-400">{(data().etf_flows.aggregate.btc_total_volume / 1e6).toFixed(1)}M</span></span>
              <span class="text-[8px] font-black text-text_secondary">ETH ETF VOL: <span class="text-blue-400">{(data().etf_flows.aggregate.eth_total_volume / 1e6).toFixed(1)}M</span></span>
              <span class="text-[8px] font-black text-text_secondary">TRACKED: {data().etf_flows.aggregate.total_etfs} ETFs</span>
            </div>
          </Show>
        </div>

        {/* FEAR & GREED HISTORY */}
        <Show when={data()?.fear_greed?.history?.length}>
          <div class="flex flex-col border-2 border-border_main bg-black/40">
            <SH title="FEAR & GREED HISTORY (30D)" />
            <div class="p-4 grid grid-cols-10 gap-2">
              <For each={(data().fear_greed.history || []).slice(0, 30)}>
                {(h) => {
                  const v = h.value;
                  const bg = v < 25 ? 'bg-red-600' : v < 40 ? 'bg-red-400' : v < 55 ? 'bg-yellow-500' : v < 75 ? 'bg-green-400' : 'bg-green-600';
                  return (
                    <div class={`${bg} p-2 text-center rounded-sm`} title={`${h.label}: ${v}`}>
                      <span class="text-[10px] font-black text-white block">{v}</span>
                      <span class="text-[6px] font-black text-white/60 uppercase block truncate">{h.label}</span>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
