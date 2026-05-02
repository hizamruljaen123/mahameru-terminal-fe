import { createSignal, onMount, createEffect, onCleanup, For, Show } from 'solid-js';
import * as echarts from 'echarts';

const REGIME_API = import.meta.env.VITE_REGIME_API;
const DASHBOARD_API = import.meta.env.VITE_DASHBOARD_API;

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? '0.00' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (v == null || isNaN(v)) ? '0.00%' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const signColor = (v) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-text_secondary';

// ─── REGIME BADGE STYLING ────────────────────────────────────────────────────
const regimeBadge = (regime) => {
    if (!regime) return { cls: 'bg-gray-800 text-gray-400', label: 'UNKNOWN' };
    const label = regime.replace(/_/g, ' ');
    if (regime.includes('CRISIS')) return { cls: 'bg-red-900/60 text-red-400 border border-red-700/50', label };
    if (regime.includes('RISK_OFF') || regime === 'FLIGHT_TO_SAFETY') return { cls: 'bg-orange-900/60 text-orange-400 border border-orange-700/50', label };
    if (regime === 'MIXED_SIGNALS') return { cls: 'bg-amber-900/60 text-amber-400 border border-amber-700/50', label };
    if (regime === 'GOLD_HEDGE') return { cls: 'bg-yellow-900/60 text-yellow-400 border border-yellow-700/50', label };
    if (regime.includes('RISK_ON') || regime === 'GROWTH_LED') return { cls: 'bg-emerald-900/60 text-emerald-400 border border-emerald-700/50', label };
    return { cls: 'bg-gray-800 text-gray-400 border border-gray-700/50', label };
};

// ─── GAUGE COMPONENT ─────────────────────────────────────────────────────────
function RegimeGauge({ riskScore, regime }) {
    let chartRef;
    let chart;

    onMount(() => {
        chart = echarts.init(chartRef);
        const score = riskScore ?? 5;
        const option = {
            series: [{
                type: 'gauge',
                center: ['50%', '60%'],
                radius: '85%',
                startAngle: 220,
                endAngle: -40,
                min: 0,
                max: 10,
                pointer: { show: true, length: '55%', width: 3, itemStyle: { color: '#a0a0c0' } },
                progress: { show: true, width: 6, itemStyle: { color: score <= 3 ? '#34d399' : score <= 5 ? '#f59e0b' : score <= 7 ? '#f97316' : '#ef4444' } },
                axisLine: {
                    lineStyle: {
                        width: 6, color: [
                            [0.3, '#34d399'],
                            [0.5, '#fbbf24'],
                            [0.7, '#fb923c'],
                            [1, '#ef4444']
                        ]
                    }
                },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { show: false },
                detail: { show: false },
                data: [{ value: score, name: '' }]
            }]
        };
        chart.setOption(option);

        onCleanup(() => chart?.dispose());
    });

    return <div ref={chartRef} class="w-full h-full" />;
}

// ─── CORRELATION HEATMAP ──────────────────────────────────────────────────────
function CorrelationHeatmapDisplay({ matrix, labels }) {
    let chartRef;
    let chart;

    onMount(() => {
        if (!matrix || !labels?.length) return;
        chart = echarts.init(chartRef);

        const n = labels.length;
        const data = [];
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                data.push([j, i, matrix[i]?.[j] ?? 0]);
            }
        }

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                position: 'top',
                formatter: (p) => {
                    const val = p.data?.[2] ?? 0;
                    const c1 = labels[p.data?.[0]] || '';
                    const c2 = labels[p.data?.[1]] || '';
                    return `<div class="text-[10px] font-mono"><b>${c1}</b> vs <b>${c2}</b><br/>Correlation: <span style="color:${val > 0 ? '#34d399' : '#ef4444'}">${val.toFixed(3)}</span></div>`;
                }
            },
            grid: { left: '10%', right: '3%', top: '3%', bottom: '10%', containLabel: false },
            xAxis: {
                type: 'category',
                data: labels,
                splitArea: { show: true },
                axisLabel: { rotate: 45, fontSize: 6, color: '#8080a0', interval: 0, width: 50, overflow: 'break' },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            yAxis: {
                type: 'category',
                data: labels,
                splitArea: { show: true },
                axisLabel: { fontSize: 6, color: '#8080a0', interval: 0 },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            visualMap: {
                min: -1, max: 1,
                calculable: true,
                orient: 'horizontal',
                left: 'center',
                bottom: '0%',
                inRange: { color: ['#ef4444', '#f97316', '#fef3c7', '#34d399', '#059669'] },
                textStyle: { color: '#8080a0', fontSize: 6 }
            },
            series: [{
                type: 'heatmap',
                data: data,
                label: {
                    show: n <= 12,
                    fontSize: 5,
                    color: '#c0c0e0',
                    formatter: (p) => (p.data?.[2] ?? 0).toFixed(1)
                },
                emphasis: {
                    itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
                }
            }]
        };
        chart.setOption(option);

        onCleanup(() => chart?.dispose());
    });

    if (!matrix || !labels?.length) {
        return <div class="text-text_secondary/40 text-[7px] p-4 text-center">No correlation data</div>;
    }

    return (
        <div class="h-full">
            <div ref={chartRef} class="w-full" style={{ height: `${Math.max(200, labels.length * 18)}px` }} />
        </div>
    );
}

// ─── BAR CHART (COMPACT) ─────────────────────────────────────────────────────
function BarChart({ data, horizontal }) {
    let chartRef;
    let chart;

    onMount(() => {
        if (!data?.length) return;
        chart = echarts.init(chartRef);

        const labels = data.map(d => {
            const a1 = (d.asset1 || d.symbol1 || '').substring(0, 6);
            const a2 = (d.asset2 || d.symbol2 || '').substring(0, 6);
            return `${a1}/${a2}`;
        });
        const values = data.map(d => d.change ?? 0);
        const colors = values.map(v => v > 0.2 ? '#ef4444' : v > 0.1 ? '#f59e0b' : '#34d399');

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                formatter: (p) => {
                    const d = data[p.dataIndex];
                    return `<div class="text-[10px] font-mono">
                        <b>${d.asset1 || d.symbol1} vs ${d.asset2 || d.symbol2}</b><br/>
                        Recent: ${fmt(d.recent_corr, 3)} | Prior: ${fmt(d.prior_corr, 3)}<br/>
                        Change: <span style="color:${(d.change ?? 0) > 0.2 ? '#ef4444' : '#f59e0b'}">${fmt(d.change, 3)}</span>
                    </div>`;
                }
            },
            grid: { left: '18%', right: '3%', top: '2%', bottom: '6%', containLabel: false },
            xAxis: { type: 'value', axisLabel: { fontSize: 6, color: '#8080a0' }, splitLine: { lineStyle: { color: '#1a1a2e' } } },
            yAxis: {
                type: 'category',
                data: labels.reverse(),
                axisLabel: { fontSize: 6, color: '#8080a0' },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            series: [{
                type: 'bar',
                data: values.reverse().map((v, i) => ({
                    value: v,
                    itemStyle: { color: colors[values.length - 1 - i] }
                })),
                barMaxWidth: 10,
                label: {
                    show: true,
                    position: 'right',
                    fontSize: 6,
                    color: '#8080a0',
                    formatter: (p) => p.value.toFixed(3)
                }
            }]
        };
        chart.setOption(option);

        onCleanup(() => chart?.dispose());
    });

    return <div ref={chartRef} class="w-full h-48" />;
}

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────
export default function RegimeView(props) {
    const [regimeData, setRegimeData] = createSignal(null);
    const [corrMatrix, setCorrMatrix] = createSignal(null);
    const [corrLabels, setCorrLabels] = createSignal([]);
    const [factorModel, setFactorModel] = createSignal(null);
    const [corrBreakdown, setCorrBreakdown] = createSignal(null);
    const [corrChanges, setCorrChanges] = createSignal([]);
    const [isLoading, setIsLoading] = createSignal(true);

    onMount(() => fetchAll());

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const fetchWithFallback = async () => {
                try {
                    const res = await fetch(`${DASHBOARD_API}/api/dashboard/regime`);
                    if (res.ok) {
                        const json = await res.json();
                        if (json.status === 'success') return json.data;
                    }
                } catch { }
                try {
                    const res = await fetch(`${REGIME_API}/api/regime/summary`);
                    if (res.ok) {
                        const json = await res.json();
                        if (json.status === 'success') return json.data;
                    }
                } catch { }
                const [regimeRes, corrRes, changeRes, factorRes] = await Promise.allSettled([
                    fetch(`${REGIME_API}/api/regime/current`).then(r => r.json()),
                    fetch(`${REGIME_API}/api/regime/correlation-matrix`).then(r => r.json()),
                    fetch(`${REGIME_API}/api/regime/correlation-change`).then(r => r.json()),
                    fetch(`${REGIME_API}/api/regime/factor-model`).then(r => r.json()),
                ]);
                const data = {};
                if (regimeRes.status === 'fulfilled' && regimeRes.value.status === 'success') data.current = { status: 'success', data: regimeRes.value.data };
                if (corrRes.status === 'fulfilled' && corrRes.value.status === 'success') data.correlation = { status: 'success', data: corrRes.value.data };
                if (changeRes.status === 'fulfilled' && changeRes.value.status === 'success') data.change = { status: 'success', data: changeRes.value.data };
                if (factorRes.status === 'fulfilled' && factorRes.value.status === 'success') data.factors = { status: 'success', data: factorRes.value.data };
                return data;
            };

            const data = await fetchWithFallback();
            if (!data) return;

            // Helper: unwrap {status, data} envelopes
            const isWrapped = (v) => v && typeof v === 'object' && 'status' in v && 'data' in v;
            const unwrap = (v) => isWrapped(v) ? v.data : v;

            // API returns: data.current, data.correlation, data.factors, data.summary
            const currentRaw = unwrap(data.current);
            const summaryRaw = unwrap(data.summary);
            const corrRaw = unwrap(data.correlation);
            const factorsRaw = unwrap(data.factors);
            const changeRaw = unwrap(data.change);

            // Regime: prefer data.current, fallback to summary.regime or legacy data.regime
            const regime = currentRaw || summaryRaw?.regime || {};
            setRegimeData(regime);

            // Correlation matrix
            const corr = corrRaw || summaryRaw?.correlation || {};
            if (corr.matrix && corr.labels) {
                setCorrMatrix(corr.matrix);
                setCorrLabels(corr.labels);
            }

            // Factors
            const factors = factorsRaw || summaryRaw?.factors || {};
            if (factors.factors) setFactorModel(factors);

            // Correlation changes
            const change = changeRaw || summaryRaw?.change || {};
            if (change.correlation_breakdown) {
                setCorrBreakdown(change.correlation_breakdown);
                setCorrChanges(change.correlation_breakdown.top_changes || []);
            } else if (change.top_changes) {
                setCorrBreakdown(change);
                setCorrChanges(change.top_changes || []);
            } else {
                setCorrBreakdown({});
            }

        } catch (e) {
            console.error('Regime fetch failed:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const currentRegime = () => regimeData()?.regime || regimeData()?.regime_label || 'UNKNOWN';
    const regimeStyle = () => regimeBadge(currentRegime());

    return (
        <Show when={!isLoading()} fallback={
            <div class="flex flex-col h-full">
                {/* Top skeleton bar */}
                <div class="h-10 border-b border-border_main bg-bg_header/50 flex items-center px-4 shrink-0 gap-3">
                    <div class="h-3 w-24 bg-border_main/20" />
                    <div class="h-3 w-16 bg-border_main/20" />
                    <div class="h-3 w-20 bg-border_main/20" />
                    <div class="h-3 w-28 bg-border_main/20" />
                </div>
                <div class="flex-1 overflow-y-auto win-scroll p-4">
                    <div class="grid grid-cols-12 gap-3">
                        <div class="col-span-12 lg:col-span-3">
                            <div class="bg-bg_header/30 border border-border_main p-4 h-64">
                                <div class="h-3 w-24 bg-border_main/20 mb-4" />
                                <div class="h-48 bg-border_main/10 rounded" />
                            </div>
                        </div>
                        <div class="col-span-12 lg:col-span-9">
                            <div class="bg-bg_header/30 border border-border_main p-4 h-64">
                                <div class="h-3 w-32 bg-border_main/20 mb-4" />
                                <div class="space-y-2">
                                    <For each={[...Array(6)]}>{() => <div class="h-2 bg-border_main/20 w-full" />}</For>
                                </div>
                            </div>
                        </div>
                        <div class="col-span-12">
                            <div class="bg-bg_header/30 border border-border_main p-4 h-48">
                                <div class="h-3 w-40 bg-border_main/20 mb-4" />
                                <div class="h-36 bg-border_main/10 rounded" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        }>
        <Show when={regimeData() || corrMatrix() || factorModel()} fallback={
            <div class="flex items-center justify-center h-full">
                <div class="text-text_secondary/40 text-[9px] font-mono tracking-widest uppercase">No regime data available</div>
            </div>
        }>
        <>
        <div class="flex flex-col h-full">
            {/* ═══════════════════════════════════════════════════════════════════
               TOP METRIC STRIP — all key indicators in one compact bar
               ═══════════════════════════════════════════════════════════════════ */}
            <div class="h-9 border-b border-border_main bg-bg_header/50 flex items-center justify-between px-3 shrink-0">
                {/* Left: Regime badge + key numbers */}
                <div class="flex items-center gap-3">
                    <span class={`px-2 py-0.5 text-[7px] font-black tracking-widest uppercase ${regimeStyle().cls}`}>
                        {regimeStyle().label}
                    </span>
                    <div class="flex items-center gap-3 text-[8px] font-mono">
                        <span class="text-text_secondary/40">Risk</span>
                        <span classList={{
                            'text-emerald-400': (regimeData()?.risk_score ?? 5) <= 3,
                            'text-amber-400': (regimeData()?.risk_score ?? 5) > 3 && (regimeData()?.risk_score ?? 5) <= 5,
                            'text-orange-400': (regimeData()?.risk_score ?? 5) > 5 && (regimeData()?.risk_score ?? 5) <= 7,
                            'text-red-400': (regimeData()?.risk_score ?? 5) > 7,
                        }}>{fmt(regimeData()?.risk_score ?? 5, 1)}/10</span>
                    </div>
                    <Show when={regimeData()?.vix_confirm != null}>
                        <div class="flex items-center gap-1 text-[8px] font-mono">
                            <span class="text-text_secondary/40">VIX</span>
                            <span classList={{
                                'text-emerald-400': (regimeData()?.vix_confirm ?? 20) < 15,
                                'text-amber-400': (regimeData()?.vix_confirm ?? 20) >= 15 && (regimeData()?.vix_confirm ?? 20) < 25,
                                'text-red-400': (regimeData()?.vix_confirm ?? 20) >= 25,
                            }}>{fmt(regimeData()?.vix_confirm, 1)}</span>
                        </div>
                    </Show>
                    <Show when={corrBreakdown()}>
                        <div class="flex items-center gap-1 text-[8px] font-mono">
                            <span class="text-text_secondary/40">Breakdown</span>
                            <span classList={{
                                'text-red-400': corrBreakdown()?.breakdown_level === 'HIGH_BREAKDOWN',
                                'text-amber-400': corrBreakdown()?.breakdown_level === 'ELEVATED',
                                'text-emerald-400': !corrBreakdown()?.breakdown_level || corrBreakdown()?.breakdown_level === 'LOW',
                            }}>{corrBreakdown()?.breakdown_level || 'LOW'}</span>
                        </div>
                    </Show>
                </div>
                {/* Right: last updated + factor count */}
                <div class="flex items-center gap-3 text-[7px] text-text_secondary/40 font-mono">
                    <Show when={factorModel()?.factors?.length}>
                        <span>{factorModel().factors.length} factors · {fmt(factorModel()?.total_explained_variance || 0, 1)}% explained</span>
                    </Show>
                    <Show when={regimeData()?.last_updated}>
                        <span>Updated {new Date(regimeData().last_updated * 1000).toLocaleTimeString()}</span>
                    </Show>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
               MAIN CONTENT — dense 3-column grid
               ═══════════════════════════════════════════════════════════════════ */}
            <div class="flex-1 overflow-y-auto win-scroll p-3">
                <div class="grid grid-cols-12 gap-3">

                    {/* ─── LEFT COLUMN: Gauge + Regime Description ───────────── */}
                    <div class="col-span-12 lg:col-span-3 space-y-3">
                        {/* Gauge */}
                        <div class="bg-bg_header/30 border border-border_main p-3">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[7px] font-black tracking-[0.2em] text-text_primary uppercase font-mono">Risk Score</span>
                                <span class="text-[10px] font-black font-mono tracking-tight" classList={{
                                    'text-emerald-400': (regimeData()?.risk_score ?? 5) <= 3,
                                    'text-amber-400': (regimeData()?.risk_score ?? 5) > 3 && (regimeData()?.risk_score ?? 5) <= 5,
                                    'text-orange-400': (regimeData()?.risk_score ?? 5) > 5 && (regimeData()?.risk_score ?? 5) <= 7,
                                    'text-red-400': (regimeData()?.risk_score ?? 5) > 7,
                                }}>{fmt(regimeData()?.risk_score ?? 5, 1)}</span>
                            </div>
                            <div class="h-32">
                                <RegimeGauge riskScore={regimeData()?.risk_score ?? 5} regime={currentRegime()} />
                            </div>
                        </div>

                        {/* Regime Classification Mini */}
                        <div class="bg-bg_header/30 border border-border_main p-3">
                            <div class="text-[7px] font-black tracking-[0.2em] text-text_primary uppercase font-mono mb-2">Classification</div>
                            <div class="flex items-center gap-2 mb-2">
                                <span class={`px-2 py-0.5 text-[7px] font-black tracking-widest uppercase ${regimeStyle().cls}`}>
                                    {regimeStyle().label}
                                </span>
                            </div>
                            <div class="text-[7px] text-text_secondary/60 leading-relaxed">
                                {regimeData()?.description || 'Analyzing market conditions...'}
                            </div>
                            {/* Regime spectrum mini */}
                            <div class="flex items-center gap-1 mt-2 text-[6px]">
                                <span class="px-1.5 py-0.5 bg-emerald-900/60 text-emerald-400 border border-emerald-700/50">RISK ON</span>
                                <span class="text-text_secondary/40">→</span>
                                <span class="px-1.5 py-0.5 bg-amber-900/60 text-amber-400 border border-amber-700/50">MIXED</span>
                                <span class="text-text_secondary/40">→</span>
                                <span class="px-1.5 py-0.5 bg-orange-900/60 text-orange-400 border border-orange-700/50">RISK OFF</span>
                                <span class="text-text_secondary/40">→</span>
                                <span class="px-1.5 py-0.5 bg-red-900/60 text-red-400 border border-red-700/50">CRISIS</span>
                            </div>
                        </div>
                    </div>

                    {/* ─── CENTER COLUMN: Factor Model ────────────────────────── */}
                    <div class="col-span-12 lg:col-span-5 space-y-3">
                        <Show when={factorModel()?.factors?.length} fallback={
                            <div class="bg-bg_header/30 border border-border_main p-3 h-full flex items-center justify-center">
                                <span class="text-[7px] text-text_secondary/40">No factor model available</span>
                            </div>
                        }>
                            <div class="bg-bg_header/30 border border-border_main p-3">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-[7px] font-black tracking-[0.2em] text-text_primary uppercase font-mono">PCA Factor Model</span>
                                    <span class="text-[6px] text-text_secondary/40">{fmt(factorModel()?.total_explained_variance || 0, 1)}% total variance</span>
                                </div>
                                {factorModel()?.interpretation && (
                                    <div class="text-[6px] text-text_primary/70 font-mono mb-2 leading-relaxed">
                                        {factorModel().interpretation}
                                    </div>
                                )}
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <For each={factorModel()?.factors || []}>
                                        {(factor) => (
                                            <div class="border border-border_main/30 p-2">
                                                <div class="flex items-center justify-between mb-1">
                                                    <span class="text-[7px] font-black tracking-wider text-text_accent">{factor.factor}</span>
                                                    <span class="text-[6px] text-text_secondary/40">{fmt(factor.explained_variance, 1)}%</span>
                                                </div>
                                                <div class="w-full h-1 bg-bg_main/50 rounded-full overflow-hidden mb-1">
                                                    <div
                                                        class="h-full bg-text_accent rounded-full transition-all duration-700"
                                                        style={{ width: `${factor.explained_variance}%` }}
                                                    />
                                                </div>
                                                <div class="flex justify-between text-[6px]">
                                                    <span class="text-text_primary font-mono">{factor.top_loading_asset}</span>
                                                    <span class={signColor(factor.loading_value)}>{fmtPct(factor.loading_value)}</span>
                                                </div>
                                                <div class="text-[5px] text-text_secondary/40 mt-0.5">{factor.label}</div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </Show>

                        {/* ─── BREAKDOWN SUMMARY MINI ──────────────────────────── */}
                        <Show when={corrBreakdown()}>
                            <div class="bg-bg_header/30 border border-border_main p-3">
                                <div class="flex items-center gap-4">
                                    <div>
                                        <div class="text-[7px] font-black tracking-[0.2em] text-text_primary uppercase font-mono mb-1">Corr Breakdown</div>
                                        <div class="flex items-center gap-3 text-[8px] font-mono">
                                            <span classList={{
                                                'text-red-400': corrBreakdown()?.breakdown_level === 'HIGH_BREAKDOWN',
                                                'text-amber-400': corrBreakdown()?.breakdown_level === 'ELEVATED',
                                                'text-emerald-400': !corrBreakdown()?.breakdown_level || corrBreakdown()?.breakdown_level === 'LOW',
                                            }} class="font-black tracking-wider">{corrBreakdown()?.breakdown_level || 'LOW'}</span>
                                            <span class="text-text_secondary/40">Avg Δ {fmt(corrBreakdown()?.average_correlation_change ?? 0, 3)}</span>
                                            <span class="text-text_secondary/40">{corrBreakdown()?.total_pairs || 0} pairs</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Show>
                    </div>

                    {/* ─── RIGHT COLUMN: Correlation Matrix ──────────────────── */}
                    <div class="col-span-12 lg:col-span-4 space-y-3">
                        <Show when={corrMatrix() && corrLabels()?.length} fallback={
                            <div class="bg-bg_header/30 border border-border_main p-3 h-full flex items-center justify-center">
                                <span class="text-[7px] text-text_secondary/40">No correlation matrix</span>
                            </div>
                        }>
                            <div class="bg-bg_header/30 border border-border_main p-3">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-[7px] font-black tracking-[0.2em] text-text_primary uppercase font-mono">Correlation Matrix</span>
                                    <span class="text-[6px] text-text_secondary/40">{corrLabels()?.length || 0} assets · 6m rolling</span>
                                </div>
                                <CorrelationHeatmapDisplay
                                    matrix={corrMatrix()}
                                    labels={corrLabels()}
                                />
                                <div class="mt-1 text-[5px] text-text_secondary/40 leading-tight">
                                    Green = positive, Red = negative. Strong corr {'>'}|0.7| signals regime shifts.
                                </div>
                            </div>
                        </Show>
                    </div>

                    {/* ─── BOTTOM FULL-WIDTH: Correlation Changes ────────────── */}
                    <div class="col-span-12 bg-bg_header/30 border border-border_main p-3">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-[7px] font-black tracking-[0.2em] text-text_primary uppercase font-mono">Correlation Changes</span>
                            <span class="text-[6px] text-text_secondary/40">{corrChanges().length} pairs monitored</span>
                        </div>
                        <div class="grid grid-cols-12 gap-3">
                            {/* Bar chart */}
                            <div class="col-span-12 lg:col-span-5">
                                <Show when={corrChanges().length > 0} fallback={
                                    <div class="text-[7px] text-text_secondary/40 text-center py-8">No correlation changes data</div>
                                }>
                                    <BarChart horizontal data={corrChanges().slice(0, 12)} />
                                </Show>
                            </div>
                            {/* Table */}
                            <div class="col-span-12 lg:col-span-7 overflow-x-auto max-h-48 overflow-y-auto win-scroll">
                                <Show when={corrChanges().length > 0} fallback={
                                    <div class="text-[7px] text-text_secondary/40 text-center py-8">No correlation changes data</div>
                                }>
                                    <table class="w-full text-[6.5px] font-mono">
                                        <thead class="sticky top-0 bg-bg_header/95">
                                            <tr class="border-b border-border_main/30 text-text_secondary/40 uppercase tracking-wider">
                                                <th class="text-left py-1.5 px-1.5 w-6">#</th>
                                                <th class="text-left py-1.5 px-1.5">Asset 1</th>
                                                <th class="text-left py-1.5 px-1.5">Asset 2</th>
                                                <th class="text-right py-1.5 px-1.5">Recent</th>
                                                <th class="text-right py-1.5 px-1.5">Prior</th>
                                                <th class="text-right py-1.5 px-1.5">Δ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For each={corrChanges()}>
                                                {(chg, idx) => (
                                                    <tr class="border-b border-border_main/10 hover:bg-bg_main/20 transition-colors">
                                                        <td class="py-1.5 px-1.5 text-text_secondary/40">{idx() + 1}</td>
                                                        <td class="py-1.5 px-1.5 text-text_primary">{chg.asset1 || chg.symbol1 || '-'}</td>
                                                        <td class="py-1.5 px-1.5 text-text_primary">{chg.asset2 || chg.symbol2 || '-'}</td>
                                                        <td class="py-1.5 px-1.5 text-right font-mono" classList={signColor(chg.recent_corr)}>{fmt(chg.recent_corr, 3)}</td>
                                                        <td class="py-1.5 px-1.5 text-right font-mono" classList={signColor(chg.prior_corr)}>{fmt(chg.prior_corr, 3)}</td>
                                                        <td class="py-1.5 px-1.5 text-right font-mono" classList={signColor(chg.change)}>{fmt(chg.change, 3)}</td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </Show>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
        </>
        </Show>
        </Show>
    );
}
