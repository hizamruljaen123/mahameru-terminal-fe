import { createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import * as echarts from 'echarts';

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? 'N/A' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

function SH({ title }) {
  return (
    <div class="px-4 py-2 border-b border-border_main bg-bg_header/40 flex items-center gap-3 shrink-0">
      <div class="w-1.5 h-1.5 bg-text_accent animate-pulse shadow-[0_0_8px_var(--text-accent)]" />
      <span class="text-[9px] font-black tracking-[0.3em] text-text_primary uppercase font-mono">{title}</span>
    </div>
  );
}

function CorrelationHeatmap({ labels, matrix }) {
  let ref, chart;
  onMount(() => {
    if (!ref || !matrix?.length) return;
    chart = echarts.init(ref);
    const data = [];
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        data.push([j, i, matrix[i][j]]);
      }
    }
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { formatter: p => `${labels[p.value[1]]} vs ${labels[p.value[0]]}: ${p.value[2]}` },
      grid: { top: 40, right: 20, bottom: 40, left: 80 },
      xAxis: { type: 'category', data: labels, axisLabel: { color: '#aaa', fontSize: 9, rotate: 45 }, splitArea: { show: true } },
      yAxis: { type: 'category', data: labels, axisLabel: { color: '#aaa', fontSize: 9 }, splitArea: { show: true } },
      visualMap: { min: -1, max: 1, orient: 'horizontal', left: 'center', bottom: 0, show: false,
        inRange: { color: ['#ff1744', '#1a1a1a', '#00e676'] } },
      series: [{ type: 'heatmap', data, label: { show: true, color: '#fff', fontSize: 9, formatter: p => p.value[2].toFixed(2) },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }]
    });
    const h = () => chart?.resize();
    window.addEventListener('resize', h);
    onCleanup(() => { window.removeEventListener('resize', h); chart?.dispose(); });
  });
  return <div ref={ref} class="w-full h-full" />;
}

function DrawdownChart({ data }) {
  let ref, chart;
  onMount(() => {
    if (!ref || !data?.length) return;
    chart = echarts.init(ref);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#0a0a0a', borderColor: '#333', textStyle: { color: '#ccc', fontSize: 10 } },
      grid: { top: 30, right: 50, bottom: 40, left: 60 },
      xAxis: { type: 'category', data: data.map(d => d.date), axisLabel: { color: '#555', fontSize: 8, rotate: 45 }, axisLine: { lineStyle: { color: '#333' } } },
      yAxis: [
        { type: 'value', name: 'Drawdown %', axisLabel: { color: '#555', fontSize: 8 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } } },
        { type: 'value', name: 'Price', axisLabel: { color: '#555', fontSize: 8 }, splitLine: { show: false } }
      ],
      series: [
        { name: 'Drawdown', type: 'line', data: data.map(d => d.drawdown), smooth: true, symbol: 'none',
          lineStyle: { color: '#ff1744', width: 1.5 }, areaStyle: { color: 'rgba(255,23,68,0.1)' } },
        { name: 'Price', type: 'line', yAxisIndex: 1, data: data.map(d => d.price), smooth: true, symbol: 'none',
          lineStyle: { color: '#448aff', width: 1 } }
      ]
    });
    const h = () => chart?.resize();
    window.addEventListener('resize', h);
    onCleanup(() => { window.removeEventListener('resize', h); chart?.dispose(); });
  });
  return <div ref={ref} class="w-full h-full" />;
}

function VolatilityChart({ data }) {
  let ref, chart;
  onMount(() => {
    if (!ref || !data?.length) return;
    chart = echarts.init(ref);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#0a0a0a', borderColor: '#333', textStyle: { color: '#ccc', fontSize: 10 } },
      legend: { top: 5, textStyle: { color: '#666', fontSize: 8 } },
      grid: { top: 30, right: 20, bottom: 40, left: 50 },
      xAxis: { type: 'category', data: data.map(d => d.date), axisLabel: { color: '#555', fontSize: 8, rotate: 45 }, axisLine: { lineStyle: { color: '#333' } } },
      yAxis: { type: 'value', axisLabel: { color: '#555', fontSize: 8, formatter: v => v + '%' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } } },
      series: [
        { name: '7D Vol', type: 'line', data: data.map(d => d.vol_7d), smooth: true, symbol: 'none', lineStyle: { color: '#ff9100', width: 1 } },
        { name: '30D Vol', type: 'line', data: data.map(d => d.vol_30d), smooth: true, symbol: 'none', lineStyle: { color: '#00e5ff', width: 2 } },
        { name: '90D Vol', type: 'line', data: data.map(d => d.vol_90d), smooth: true, symbol: 'none', lineStyle: { color: '#e040fb', width: 1.5, type: 'dashed' } }
      ]
    });
    const h = () => chart?.resize();
    window.addEventListener('resize', h);
    onCleanup(() => { window.removeEventListener('resize', h); chart?.dispose(); });
  });
  return <div ref={ref} class="w-full h-full" />;
}

export default function CryptoQuantPanel(props) {
  const [data, setData] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const API = import.meta.env.VITE_CRYPTO_API;

  const fetchData = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API}/api/crypto/quant/${props.symbol}`);
      const json = await resp.json();
      if (json.status === 'success') setData(json.data);
    } catch (e) { console.error('Quant fetch error:', e); }
    setLoading(false);
  };

  createEffect(() => { props.symbol; fetchData(); });

  return (
    <div class="flex flex-col gap-6 animate-in fade-in duration-500">
      <Show when={loading()}>
        <div class="flex items-center justify-center py-20 gap-3">
          <div class="w-6 h-6 border-2 border-text_accent border-t-transparent animate-spin rounded-full" />
          <span class="text-[9px] font-black text-text_accent tracking-[0.4em] uppercase">RUNNING QUANTITATIVE ANALYSIS...</span>
        </div>
      </Show>
      <Show when={!loading() && data()}>
        {/* CORRELATION MATRIX */}
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 lg:col-span-8 flex flex-col border-2 border-border_main bg-black/40 h-[450px]">
            <SH title="CROSS-ASSET CORRELATION MATRIX" />
            <div class="flex-1 p-2 min-h-0">
              <Show when={data()?.correlation?.matrix?.length}>
                <CorrelationHeatmap labels={data().correlation.labels} matrix={data().correlation.matrix} />
              </Show>
            </div>
          </div>
          <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40 overflow-hidden">
            <SH title="CORRELATION RANKING" />
            <div class="flex-1 overflow-y-auto win-scroll p-3">
              <For each={data()?.correlation?.target_correlations || []}>
                {(c) => (
                  <div class="flex items-center justify-between py-2.5 border-b border-border_main/10 hover:bg-white/5">
                    <span class="text-[10px] font-black text-text_primary">{c.asset}</span>
                    <div class="flex items-center gap-3">
                      <div class="w-20 h-1.5 bg-white/5 overflow-hidden">
                        <div class={`h-full ${c.correlation >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.abs(c.correlation) * 100}%` }} />
                      </div>
                      <span class={`text-[10px] font-black font-mono w-14 text-right ${c.correlation >= 0.5 ? 'text-green-400' : c.correlation <= -0.5 ? 'text-red-400' : 'text-text_secondary'}`}>
                        {c.correlation}
                      </span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* VOLATILITY SURFACE */}
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 lg:col-span-8 flex flex-col border-2 border-border_main bg-black/40 h-[350px]">
            <SH title="ROLLING VOLATILITY SURFACE" />
            <div class="flex-1 p-2 min-h-0">
              <Show when={data()?.volatility?.history?.length}>
                <VolatilityChart data={data().volatility.history} />
              </Show>
            </div>
          </div>
          <div class="col-span-12 lg:col-span-4 flex flex-col gap-6">
            {/* Risk Metrics */}
            <div class="flex flex-col border-2 border-border_main bg-black/40">
              <SH title="RISK METRICS" />
              <div class="p-4 grid grid-cols-2 gap-3">
                <div class="bg-black/30 p-3 border border-border_main/20">
                  <span class="text-[7px] font-black text-text_secondary uppercase block mb-1">SHARPE RATIO</span>
                  <span class={`text-[16px] font-black font-mono ${(data()?.volatility?.sharpe_ratio || 0) > 1 ? 'text-green-400' : 'text-red-400'}`}>
                    {data()?.volatility?.sharpe_ratio || 'N/A'}
                  </span>
                </div>
                <div class="bg-black/30 p-3 border border-border_main/20">
                  <span class="text-[7px] font-black text-text_secondary uppercase block mb-1">SORTINO RATIO</span>
                  <span class={`text-[16px] font-black font-mono ${(data()?.volatility?.sortino_ratio || 0) > 1 ? 'text-green-400' : 'text-red-400'}`}>
                    {data()?.volatility?.sortino_ratio || 'N/A'}
                  </span>
                </div>
                <div class="bg-black/30 p-3 border border-border_main/20">
                  <span class="text-[7px] font-black text-text_secondary uppercase block mb-1">ANN. RETURN</span>
                  <span class={`text-[14px] font-black font-mono ${(data()?.volatility?.annualized_return || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data()?.volatility?.annualized_return}%
                  </span>
                </div>
                <div class="bg-black/30 p-3 border border-border_main/20">
                  <span class="text-[7px] font-black text-text_secondary uppercase block mb-1">ANN. VOL</span>
                  <span class="text-[14px] font-black font-mono text-yellow-400">{data()?.volatility?.annualized_vol}%</span>
                </div>
              </div>
            </div>
            {/* Beta */}
            <Show when={data()?.beta?.betas}>
              <div class="flex flex-col border-2 border-border_main bg-black/40">
                <SH title="BETA ANALYSIS" />
                <div class="p-4 flex flex-col gap-3">
                  <For each={Object.entries(data().beta.betas)}>
                    {([bench, val]) => (
                      <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                        <span class="text-[9px] font-black text-text_secondary uppercase">{bench} BETA</span>
                        <div class="flex items-center gap-3">
                          <span class={`text-[12px] font-black font-mono ${Math.abs(val) > 1.5 ? 'text-red-400' : Math.abs(val) > 0.8 ? 'text-yellow-400' : 'text-green-400'}`}>{val}</span>
                          <span class={`text-[7px] font-black px-1.5 py-0.5 ${Math.abs(val) > 1.5 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                            {data().beta.interpretation[bench]}
                          </span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* DRAWDOWN */}
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 lg:col-span-8 flex flex-col border-2 border-border_main bg-black/40 h-[350px]">
            <SH title="DRAWDOWN ANALYSIS" />
            <div class="flex-1 p-2 min-h-0">
              <Show when={data()?.drawdown?.history?.length}>
                <DrawdownChart data={data().drawdown.history} />
              </Show>
            </div>
            <div class="px-4 py-2 border-t border-border_main bg-bg_header/20 flex items-center gap-6">
              <span class="text-[8px] font-black text-text_secondary">CURRENT DD: <span class="text-red-400">{data()?.drawdown?.current_drawdown}%</span></span>
              <span class="text-[8px] font-black text-text_secondary">MAX DD: <span class="text-red-500">{data()?.drawdown?.max_drawdown}%</span></span>
            </div>
          </div>
          <div class="col-span-12 lg:col-span-4 flex flex-col border-2 border-border_main bg-black/40 overflow-hidden">
            <SH title="DRAWDOWN EVENTS" />
            <div class="flex-1 overflow-y-auto win-scroll p-3">
              <For each={(data()?.drawdown?.events || []).slice(0, 8)}>
                {(ev) => (
                  <div class="mb-3 p-3 bg-black/30 border border-border_main/20">
                    <div class="flex justify-between mb-1">
                      <span class="text-[8px] text-text_accent font-black">{ev.start}</span>
                      <span class="text-[10px] font-black text-red-400">{ev.max_drawdown}%</span>
                    </div>
                    <div class="flex justify-between text-[8px] text-text_secondary">
                      <span>Recovery: {ev.recovery}</span>
                      <span>{ev.duration_days}d</span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* VOL TERM STRUCTURE */}
        <Show when={data()?.volatility?.term_structure}>
          <div class="flex flex-col border-2 border-border_main bg-black/40">
            <SH title="VOLATILITY TERM STRUCTURE" />
            <div class="p-4 grid grid-cols-5 gap-3">
              <For each={Object.entries(data().volatility.term_structure)}>
                {([period, val]) => (
                  <div class="bg-black/30 p-4 border border-border_main/20 text-center">
                    <span class="text-[8px] font-black text-text_secondary uppercase block mb-2">{period}</span>
                    <span class={`text-[16px] font-black font-mono ${val > 80 ? 'text-red-400' : val > 50 ? 'text-yellow-400' : 'text-green-400'}`}>{val}%</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
