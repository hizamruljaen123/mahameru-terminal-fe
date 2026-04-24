import { createSignal, onMount, createEffect, For, Show, onCleanup } from 'solid-js';
import * as echarts from 'echarts';

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? 'N/A' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

function SectionHeader({ title, action }) {
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

function FlowChart({ data }) {
  let ref;
  let chart;
  onMount(() => {
    if (!ref || !data || !data.length) return;
    chart = echarts.init(ref);
    const dates = data.map(d => d.date);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#0a0a0a', borderColor: '#333', textStyle: { color: '#ccc', fontSize: 10 } },
      grid: { top: 30, right: 30, bottom: 40, left: 60 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: '#555', fontSize: 8, rotate: 45 }, axisLine: { lineStyle: { color: '#333' } } },
      yAxis: [
        { type: 'value', name: 'Net Flow', nameTextStyle: { color: '#555', fontSize: 8 }, axisLabel: { color: '#555', fontSize: 8 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } } },
        { type: 'value', name: 'Cumulative', nameTextStyle: { color: '#555', fontSize: 8 }, axisLabel: { color: '#555', fontSize: 8 }, splitLine: { show: false } }
      ],
      series: [
        { name: 'Net Flow', type: 'bar', data: data.map(d => d.net_flow), itemStyle: { color: p => p.value > 0 ? '#00e676' : '#ff1744' } },
        { name: 'Cumulative', type: 'line', yAxisIndex: 1, data: data.map(d => d.cumulative), smooth: true, symbol: 'none', lineStyle: { color: '#448aff', width: 2 } }
      ]
    });
    const h = () => chart?.resize();
    window.addEventListener('resize', h);
    onCleanup(() => { window.removeEventListener('resize', h); chart?.dispose(); });
  });
  return <div ref={ref} class="w-full h-full" />;
}

function NvtChart({ data }) {
  let ref;
  let chart;
  onMount(() => {
    if (!ref || !data || !data.length) return;
    chart = echarts.init(ref);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#0a0a0a', borderColor: '#333', textStyle: { color: '#ccc', fontSize: 10 } },
      grid: { top: 30, right: 50, bottom: 40, left: 60 },
      xAxis: { type: 'category', data: data.map(d => d.date), axisLabel: { color: '#555', fontSize: 8, rotate: 45 }, axisLine: { lineStyle: { color: '#333' } } },
      yAxis: [
        { type: 'value', name: 'NVT', axisLabel: { color: '#555', fontSize: 8 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } } },
        { type: 'value', name: 'Price', axisLabel: { color: '#555', fontSize: 8 }, splitLine: { show: false } }
      ],
      series: [
        { name: 'NVT', type: 'line', data: data.map(d => d.nvt), smooth: true, symbol: 'none', lineStyle: { color: '#ff9100', width: 2 }, areaStyle: { color: 'rgba(255,145,0,0.05)' } },
        { name: 'NVT Signal', type: 'line', data: data.map(d => d.nvt_signal), smooth: true, symbol: 'none', lineStyle: { color: '#e040fb', width: 1.5, type: 'dashed' } },
        { name: 'Price', type: 'line', yAxisIndex: 1, data: data.map(d => d.price), smooth: true, symbol: 'none', lineStyle: { color: '#00e5ff', width: 1 } }
      ]
    });
    const h = () => chart?.resize();
    window.addEventListener('resize', h);
    onCleanup(() => { window.removeEventListener('resize', h); chart?.dispose(); });
  });
  return <div ref={ref} class="w-full h-full" />;
}

export default function CryptoOnChainPanel(props) {
  const [data, setData] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const API = import.meta.env.VITE_CRYPTO_API;

  const fetchData = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API}/api/crypto/onchain/${props.symbol}`);
      const json = await resp.json();
      if (json.status === 'success') setData(json.data);
    } catch (e) { console.error('OnChain fetch error:', e); }
    setLoading(false);
  };

  createEffect(() => { props.symbol; fetchData(); });

  return (
    <div class="flex flex-col gap-6 animate-in fade-in duration-500">
      <Show when={loading()}>
        <div class="flex items-center justify-center py-20 gap-3">
          <div class="w-6 h-6 border-2 border-text_accent border-t-transparent animate-spin rounded-full" />
          <span class="text-[9px] font-black text-text_accent tracking-[0.4em] uppercase">COMPUTING ON-CHAIN METRICS...</span>
        </div>
      </Show>
      <Show when={!loading() && data()}>
        {/* EXCHANGE FLOW */}
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 lg:col-span-8 flex flex-col border-2 border-border_main bg-black/40 h-[400px]">
            <SectionHeader title="EXCHANGE NET FLOW ESTIMATION" />
            <div class="flex-1 p-2 min-h-0">
              <Show when={data()?.exchange_flow?.flow_history?.length}>
                <FlowChart data={data().exchange_flow.flow_history} />
              </Show>
            </div>
          </div>
          <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40">
            <SectionHeader title="FLOW SUMMARY (7D)" />
            <div class="p-5 flex flex-col gap-4">
              <Show when={data()?.exchange_flow?.summary}>
                {(s) => (<>
                  <div class="flex flex-col gap-1">
                    <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">TREND</span>
                    <span class={`text-[16px] font-black ${s.trend === 'ACCUMULATION' ? 'text-emerald-400' : 'text-red-400'}`}>{s.trend}</span>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div class="bg-black/30 p-3 border border-border_main/20">
                      <span class="text-[7px] font-black text-green-500 uppercase block mb-1">OUTFLOW (7D)</span>
                      <span class="text-[12px] font-black text-white font-mono">{fmt(s['7d_outflow'])}</span>
                    </div>
                    <div class="bg-black/30 p-3 border border-border_main/20">
                      <span class="text-[7px] font-black text-red-500 uppercase block mb-1">INFLOW (7D)</span>
                      <span class="text-[12px] font-black text-white font-mono">{fmt(s['7d_inflow'])}</span>
                    </div>
                  </div>
                  <div class="flex justify-between py-2 border-t border-border_main/10">
                    <span class="text-[8px] font-black text-text_secondary uppercase">Outflow Days</span>
                    <span class="text-[10px] font-black text-green-400">{s.outflow_days}</span>
                  </div>
                  <div class="flex justify-between py-2 border-t border-border_main/10">
                    <span class="text-[8px] font-black text-text_secondary uppercase">Inflow Days</span>
                    <span class="text-[10px] font-black text-red-400">{s.inflow_days}</span>
                  </div>
                </>)}
              </Show>
            </div>
          </div>
        </div>

        {/* WHALE ACTIVITY */}
        <div class="flex flex-col border-2 border-border_main bg-black/40 max-h-[500px]">
          <SectionHeader title="WHALE ACTIVITY TRACKER" />
          <div class="flex-1 overflow-y-auto win-scroll">
            <table class="w-full text-left text-[10px] font-mono border-collapse">
              <thead class="bg-bg_header/60 sticky top-0 z-10 border-b border-border_main">
                <tr>
                  <th class="p-3 text-text_accent font-black tracking-widest">DATE</th>
                  <th class="p-3 text-white font-black tracking-widest">VOL USD</th>
                  <th class="p-3 text-white font-black tracking-widest">Z-SCORE</th>
                  <th class="p-3 text-white font-black tracking-widest">PRICE</th>
                  <th class="p-3 text-white font-black tracking-widest">CHANGE</th>
                  <th class="p-3 text-white font-black tracking-widest">TYPE</th>
                  <th class="p-3 text-white font-black tracking-widest">MAG</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border_main/10">
                <For each={data()?.whale_activity?.whale_events || []}>
                  {(ev) => (
                    <tr class="hover:bg-white/5 transition-colors">
                      <td class="p-3 text-text_accent">{ev.date}</td>
                      <td class="p-3 text-white">${(ev.volume_usd / 1e6).toFixed(1)}M</td>
                      <td class="p-3 text-yellow-400 font-bold">{ev.z_score}</td>
                      <td class="p-3 text-white">${fmt(ev.price)}</td>
                      <td class={`p-3 font-bold ${ev.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{ev.change}%</td>
                      <td class={`p-3 font-black ${ev.type === 'ACCUMULATION' ? 'text-green-400' : 'text-red-400'}`}>{ev.type}</td>
                      <td class={`p-3 font-black ${ev.magnitude === 'MEGA' ? 'text-yellow-300' : 'text-blue-400'}`}>{ev.magnitude}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          <Show when={data()?.whale_activity?.stats}>
            <div class="px-4 py-3 border-t border-border_main bg-bg_header/20 flex items-center gap-6">
              <span class={`text-[9px] font-black ${data().whale_activity.stats.whale_pressure === 'BUYING' ? 'text-green-400' : 'text-red-400'}`}>
                WHALE PRESSURE: {data().whale_activity.stats.whale_pressure}
              </span>
              <span class="text-[8px] text-text_secondary">EVENTS: {data().whale_activity.stats.total_events} | ACC: {data().whale_activity.stats.accumulation_events} | DIST: {data().whale_activity.stats.distribution_events}</span>
            </div>
          </Show>
        </div>

        {/* NVT RATIO */}
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 lg:col-span-8 flex flex-col border-2 border-border_main bg-black/40 h-[350px]">
            <SectionHeader title="NVT RATIO (NETWORK VALUE / TRANSACTIONS)" />
            <div class="flex-1 p-2 min-h-0">
              <Show when={data()?.nvt_ratio?.history?.length}>
                <NvtChart data={data().nvt_ratio.history} />
              </Show>
            </div>
          </div>
          <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40">
            <SectionHeader title="NVT ASSESSMENT" />
            <div class="p-5 flex flex-col gap-4">
              <Show when={data()?.nvt_ratio}>
                <div class="flex flex-col gap-1">
                  <span class="text-[8px] font-black text-text_secondary uppercase">CURRENT NVT</span>
                  <span class="text-[22px] font-black text-white font-mono">{data().nvt_ratio.current_nvt}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[8px] font-black text-text_secondary uppercase">6M AVERAGE</span>
                  <span class="text-[14px] font-black text-text_accent font-mono">{data().nvt_ratio.avg_nvt_6m}</span>
                </div>
                <div class={`px-4 py-3 border-2 text-center text-[12px] font-black ${
                  data().nvt_ratio.assessment === 'UNDERVALUED' ? 'border-green-500 text-green-400 bg-green-500/10' :
                  data().nvt_ratio.assessment === 'OVERVALUED' ? 'border-red-500 text-red-400 bg-red-500/10' :
                  'border-blue-500 text-blue-400 bg-blue-500/10'}`}>
                  {data().nvt_ratio.assessment}
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
