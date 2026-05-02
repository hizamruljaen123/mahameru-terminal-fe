import { createSignal, onMount, onCleanup, createEffect, For, Show } from 'solid-js';
import * as echarts from 'echarts';
import SupplyChainIntel from '../components/institutional/SupplyChainIntel';

const SUPPLY_CHAIN_API = import.meta.env.VITE_SUPPLY_CHAIN_API;
const DASHBOARD_API = import.meta.env.VITE_DASHBOARD_API;

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? '0.00' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (v == null || isNaN(v)) ? '0.00%' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const signColor = (v) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-text_secondary';

function SectionHeader({ title, subtitle }) {
    return (
        <div class="flex items-center justify-between px-4 py-2 border-b border-border_main bg-bg_main/5">
            <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 bg-text_accent shadow-[0_0_8px_var(--text-accent)]" />
                <span class="text-[9px] font-black tracking-[0.2em] text-text_primary uppercase font-mono">{title}</span>
                {subtitle && <span class="text-[7px] text-text_secondary/40 uppercase ml-2">{subtitle}</span>}
            </div>
        </div>
    );
}

function LoadingSkeleton({ rows = 5 }) {
    return (
        <div class="p-4 space-y-3">
            <For each={[...Array(rows)]}>
                {() => (
                    <div class="flex flex-col gap-2">
                        <div class="h-1 bg-border_main/20 w-[80%]" />
                        <div class="h-0.5 bg-border_main/20 w-[40%]" />
                    </div>
                )}
            </For>
        </div>
    );
}

// ─── REGIME BADGE ─────────────────────────────────────────────────────────────
const regimeBadge = (regime) => {
    if (!regime) return { cls: 'bg-gray-800 text-gray-400', label: 'UNKNOWN' };
    if (regime === 'CRISIS') return { cls: 'bg-red-900/60 text-red-400 border border-red-700/50', label: 'CRISIS' };
    if (regime === 'ELEVATED') return { cls: 'bg-orange-900/60 text-orange-400 border border-orange-700/50', label: 'ELEVATED' };
    if (regime === 'NORMAL') return { cls: 'bg-emerald-900/60 text-emerald-400 border border-emerald-700/50', label: 'NORMAL' };
    if (regime === 'LOW') return { cls: 'bg-green-900/60 text-green-400 border border-green-700/50', label: 'LOW' };
    if (regime === 'MINIMAL') return { cls: 'bg-blue-900/60 text-blue-400 border border-blue-700/50', label: 'MINIMAL' };
    return { cls: 'bg-gray-800 text-gray-400 border border-gray-700/50', label: regime };
};

// ─── CATEGORY COLORS ──────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
    energy: '#ef4444',
    industrial: '#f59e0b',
    agriculture: '#34d399',
    freight: '#3b82f6',
    pmi: '#8b5cf6',
};

const CATEGORY_LABELS = {
    energy: 'Energy',
    industrial: 'Industrial Metals',
    agriculture: 'Agriculture',
    freight: 'Freight Rates',
    pmi: 'PMI Proxy',
};

// ─── PRESSURE GAUGE ───────────────────────────────────────────────────────────
function PressureGauge({ index }) {
    let chartRef;
    let chart;

    onMount(() => {
        chart = echarts.init(chartRef);
        const val = index ?? 50;
        const option = {
            series: [{
                type: 'gauge',
                center: ['50%', '60%'],
                radius: '90%',
                startAngle: 220,
                endAngle: -40,
                min: 0,
                max: 100,
                pointer: { show: true, length: '55%', width: 4, itemStyle: { color: '#a0a0c0' } },
                progress: {
                    show: true,
                    width: 8,
                    itemStyle: {
                        color: val >= 75 ? '#ef4444' : val >= 60 ? '#f97316' : val >= 40 ? '#f59e0b' : val >= 25 ? '#34d399' : '#3b82f6'
                    }
                },
                axisLine: {
                    lineStyle: {
                        width: 8,
                        color: [
                            [0.25, '#3b82f6'],
                            [0.40, '#34d399'],
                            [0.60, '#f59e0b'],
                            [0.75, '#f97316'],
                            [1, '#ef4444']
                        ]
                    }
                },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { show: false },
                detail: {
                    formatter: `{value}`,
                    fontSize: 22,
                    fontWeight: 'bold',
                    color: '#c0c0e0',
                    fontFamily: 'monospace',
                    offsetCenter: [0, '45%']
                },
                data: [{ value: val, name: '' }]
            }]
        };
        chart.setOption(option);
    });

    onCleanup(() => chart?.dispose());

    return <div ref={chartRef} class="w-full h-full" />;
}

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────
export default function SupplyChainView(props) {
    const [indexData, setIndexData] = createSignal(null);
    const [components, setComponents] = createSignal([]);
    const [timelineData, setTimelineData] = createSignal([]);
    const [isLoading, setIsLoading] = createSignal(true);

    onMount(() => fetchAll());

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const [indexRes, timelineRes] = await Promise.allSettled([
                fetch(`${SUPPLY_CHAIN_API}/api/supply-chain/index`).then(r => r.json()),
                fetch(`${SUPPLY_CHAIN_API}/api/supply-chain/timeline?days=90`).then(r => r.json()),
            ]);

            if (indexRes.status === 'fulfilled' && indexRes.value.status === 'success') {
                const idx = indexRes.value.data;
                setIndexData(idx);
                if (idx.components) {
                    const comps = Object.entries(idx.components).map(([ticker, meta]) => ({ ticker, ...meta }));
                    setComponents(comps);
                }
            }
            if (timelineRes.status === 'fulfilled' && timelineRes.value.status === 'success') {
                setTimelineData(timelineRes.value.data || []);
            }
        } catch (e) {
            console.error('Supply chain fetch failed:', e);
        } finally {
            setIsLoading(false);
        }
    };

    // Derive composite index from timeline if /index endpoint returns nothing
    const derivedIndex = () => {
        const tl = timelineData();
        if (!tl.length) return 50;
        // Get the latest date's average pressure across all tickers
        const latest = tl[tl.length - 1]?.date;
        const latestRows = tl.filter(d => d.date === latest);
        if (!latestRows.length) return 50;
        return latestRows.reduce((s, d) => s + (d.pressure ?? 50), 0) / latestRows.length;
    };

    const derivedCategoryScores = () => {
        const tl = timelineData();
        if (!tl.length) return {};
        const latest = tl[tl.length - 1]?.date;
        const latestRows = tl.filter(d => d.date === latest);
        // Map known tickers to categories
        const tickerCat = { 'CL=F': 'energy', 'HG=F': 'industrial', 'LBS=F': 'agriculture' };
        const scores = {};
        latestRows.forEach(d => {
            const cat = tickerCat[d.ticker] || 'industrial';
            scores[cat] = d.pressure ?? 50;
        });
        return scores;
    };

    const index = () => indexData()?.composite_index ?? derivedIndex();
    const regime = () => {
        if (indexData()?.regime) return indexData().regime;
        const v = index();
        return v >= 75 ? 'CRISIS' : v >= 60 ? 'ELEVATED' : v >= 40 ? 'NORMAL' : v >= 25 ? 'LOW' : 'MINIMAL';
    };
    const categories = () => indexData()?.category_scores || derivedCategoryScores();
    const hasData = () => !isLoading() && (indexData() || timelineData().length > 0);

    return (
        <div class="flex flex-col h-full bg-bg_main">
            {/* ─── HEADER ─── */}
            <div class="h-10 border-b border-border_main bg-bg_header/50 flex items-center justify-between px-4 shrink-0">
                <div class="flex items-center gap-2">
                    <div class="w-2 h-2 bg-text_accent animate-pulse shadow-[0_0_8px_var(--text-accent)]" />
                    <span class="text-[9px] font-black tracking-[0.2em] text-text_primary uppercase font-mono">Supply Chain Intelligence Terminal</span>
                </div>
                <Show when={indexData() || timelineData().length > 0}>
                    <div class="flex items-center gap-3">
                        <span class="text-[7px] text-text_secondary/40">
                            GLOBAL PRESSURE: <span class="font-mono font-black" classList={{
                                'text-red-400': index() >= 75,
                                'text-orange-400': index() >= 60 && index() < 75,
                                'text-amber-400': index() >= 40 && index() < 60,
                                'text-emerald-400': index() < 40,
                            }}>{fmt(index(), 1)}</span>
                        </span>
                        <span class={`px-3 py-0.5 text-[7px] font-black tracking-widest uppercase ${regimeBadge(regime()).cls}`}>
                            {regimeBadge(regime()).label}
                        </span>
                    </div>
                </Show>
            </div>

            <div class="flex-1 overflow-y-auto win-scroll p-4">
                <Show when={hasData()} fallback={<LoadingSkeleton rows={15} />}>
                    <div class="grid grid-cols-12 gap-4">
                        
                        {/* ─── ROW 1: CORE METRICS & VESSEL INTEL ─── */}
                        <div class="col-span-12 lg:col-span-3 space-y-4">
                            <div class="bg-bg_header/30 border border-border_main p-3">
                                <SectionHeader title="Pressure Index" subtitle="0-100 Gauge" />
                                <div class="h-44">
                                    <PressureGauge index={index()} />
                                </div>
                                <div class="text-center mt-1">
                                    <span class="text-2xl font-black font-mono" classList={{
                                        'text-red-400': index() >= 75,
                                        'text-orange-400': index() >= 60 && index() < 75,
                                        'text-amber-400': index() >= 40 && index() < 60,
                                        'text-emerald-400': index() < 40,
                                    }}>{fmt(index(), 1)}</span>
                                </div>
                            </div>
                            
                            <div class="bg-bg_header/30 border border-border_main p-3">
                                <SectionHeader title="Quick Stats" />
                                <div class="mt-2 space-y-2">
                                    <div class="flex justify-between items-center border-b border-border_main/10 pb-1">
                                        <span class="text-[6px] text-text_secondary/40 uppercase">Components</span>
                                        <span class="text-[10px] font-black text-text_primary font-mono">{components().length || Object.keys(categories()).length}</span>
                                    </div>
                                    <div class="flex justify-between items-center border-b border-border_main/10 pb-1">
                                        <span class="text-[6px] text-text_secondary/40 uppercase">Update</span>
                                        <span class="text-[8px] font-black text-emerald-400 font-mono">{timelineData().length > 0 ? timelineData()[timelineData().length - 1].date : 'N/A'}</span>
                                    </div>
                                    <div class={`text-[7px] font-bold mt-1 ${index() > 60 ? 'text-red-400' : 'text-emerald-400'} uppercase tracking-tighter`}>
                                        {index() > 60 ? '⚠️ Congestion' : '✓ Stabilized'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="col-span-12 lg:col-span-5 bg-bg_header/30 border border-border_main p-3">
                            <SectionHeader title="Category Breakdown" subtitle="Sectoral Sub-indices" />
                            <CategoryBreakdownChart categories={categories()} />
                        </div>

                        <div class="col-span-12 lg:col-span-4 h-full">
                            <SupplyChainIntel />
                        </div>

                        {/* ─── ROW 2: TIMELINE ─── */}
                        <div class="col-span-12 bg-bg_header/30 border border-border_main p-3">
                            <TimelineChart data={timelineData()} />
                        </div>

                        {/* ─── ROW 3: COMPONENTS & INTERPRETATION ─── */}
                        <div class="col-span-12 lg:col-span-8">
                            <ComponentsTable data={components().length ? components() : Object.entries(categories()).map(([cat, score]) => ({ ticker: cat.toUpperCase(), category: cat, pressure_score: score, current_price: 0, z_score: 0, '1y_mean': 0, '1y_high': 0, '1y_low': 0, weight: 0.2 }))} />
                        </div>

                        <div class="col-span-12 lg:col-span-4 bg-bg_header/30 border border-border_main p-3">
                            <SectionHeader title="Index Definition" />
                            <div class="mt-4 space-y-3">
                                <p class="text-[8px] text-text_secondary/60 leading-relaxed italic">
                                    "The Global Supply Chain Pressure Index (GSCPI) is a composite measure that tracks the health of global logistics and commodity flows."
                                </p>
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="p-2 border border-border_main/30 bg-bg_main/20">
                                        <span class="text-[7px] text-blue-400 font-black block">0 - 40</span>
                                        <span class="text-[6px] text-text_secondary/40">Deflationary / High Capacity</span>
                                    </div>
                                    <div class="p-2 border border-border_main/30 bg-bg_main/20">
                                        <span class="text-[7px] text-amber-400 font-black block">40 - 60</span>
                                        <span class="text-[6px] text-text_secondary/40">Neutral / Balanced Flow</span>
                                    </div>
                                    <div class="p-2 border border-border_main/30 bg-bg_main/20">
                                        <span class="text-[7px] text-orange-400 font-black block">60 - 75</span>
                                        <span class="text-[6px] text-text_secondary/40">Elevated Stress / Lagging</span>
                                    </div>
                                    <div class="p-2 border border-border_main/30 bg-bg_main/20">
                                        <span class="text-[7px] text-red-400 font-black block">75 - 100</span>
                                        <span class="text-[6px] text-text_secondary/40">Systemic Crisis / Halted</span>
                                    </div>
                                </div>
                                <div class="pt-4 border-t border-border_main/30">
                                    <span class="text-[7px] text-text_secondary/40 block mb-2 uppercase tracking-widest">Weight Distribution</span>
                                    <div class="w-full h-1.5 bg-bg_main/50 rounded-full overflow-hidden flex">
                                        <div class="h-full bg-red-500" style="width: 38%" title="Energy" />
                                        <div class="h-full bg-amber-500" style="width: 33%" title="Industrial" />
                                        <div class="h-full bg-emerald-500" style="width: 10%" title="Agri" />
                                        <div class="h-full bg-blue-500" style="width: 9%" title="Freight" />
                                        <div class="h-full bg-purple-500" style="width: 10%" title="PMI" />
                                    </div>
                                    <div class="flex justify-between text-[6px] text-text_secondary/30 mt-1 uppercase font-mono">
                                        <span>Energy 38%</span>
                                        <span>Metals 33%</span>
                                        <span>Other 29%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </Show>
            </div>
        </div>
    );
}

// ─── CATEGORY BREAKDOWN CHART ─────────────────────────────────────────────────
function CategoryBreakdownChart({ categories }) {
    let chartRef;
    let chart;

    onMount(() => {
        const entries = Object.entries(categories || {});
        if (!entries.length) return;
        chart = echarts.init(chartRef);

        const cats = entries.map(([k]) => CATEGORY_LABELS[k] || k);
        const scores = entries.map(([, v]) => v ?? 50);
        const colors = entries.map(([k]) => CATEGORY_COLORS[k] || '#8080a0');

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    const [p] = params;
                    const cat = cats[p.dataIndex];
                    const score = scores[p.dataIndex];
                    const color = colors[p.dataIndex];
                    const level = score >= 75 ? 'CRISIS' : score >= 60 ? 'ELEVATED' : score >= 40 ? 'NORMAL' : score >= 25 ? 'LOW' : 'MINIMAL';
                    return `<div class="text-[10px] font-mono">
                        <b>${cat}</b><br/>
                        Pressure: <span style="color:${color}">${fmt(score, 1)}</span><br/>
                        Regime: ${level}
                    </div>`;
                }
            },
            grid: { left: '15%', right: '6%', top: '4%', bottom: '8%' },
            xAxis: {
                type: 'value',
                max: 100,
                axisLabel: { fontSize: 7, color: '#8080a0' },
                splitLine: { lineStyle: { color: '#1a1a2e' } }
            },
            yAxis: {
                type: 'category',
                data: cats,
                axisLabel: { fontSize: 8, color: '#8080a0' },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            series: [{
                type: 'bar',
                data: scores.map((s, i) => ({
                    value: s,
                    itemStyle: {
                        color: colors[i],
                        borderRadius: [0, 2, 2, 0]
                    }
                })),
                barMaxWidth: 20,
                label: {
                    show: true,
                    position: 'right',
                    fontSize: 8,
                    color: '#8080a0',
                    fontFamily: 'monospace',
                    formatter: (p) => fmt(p.value, 1)
                },
                markLine: {
                    silent: true,
                    data: [
                        { xAxis: 50, label: { formatter: 'Avg 50', fontSize: 7, color: '#8080a0' } }
                    ],
                    lineStyle: { color: '#8080a0', type: 'dashed', width: 1 }
                }
            }]
        };
        chart.setOption(option);
    });

    onCleanup(() => chart?.dispose());

    const entries = Object.entries(categories || {});
    if (!entries.length) return <div class="text-text_secondary/40 text-[8px] p-8 text-center">No category data available</div>;

    return <div ref={chartRef} class="w-full h-64" />;
}

// ─── COMPONENTS TABLE ─────────────────────────────────────────────────────────
function ComponentsTable({ data }) {
    const sorted = () => [...data].sort((a, b) => (b.pressure_score ?? 50) - (a.pressure_score ?? 50));

    return (
        <div class="bg-bg_header/30 border border-border_main p-4">
            <SectionHeader title={`Supply Chain Components (${data.length})`} subtitle="Sorted by pressure score" />
            <div class="overflow-x-auto mt-3">
                <table class="w-full text-[7px] font-mono">
                    <thead>
                        <tr class="border-b border-border_main/30 text-text_secondary/40 uppercase tracking-wider">
                            <th class="text-left py-2 px-2">Ticker</th>
                            <th class="text-left py-2 px-2">Name</th>
                            <th class="text-left py-2 px-2">Category</th>
                            <th class="text-right py-2 px-2">Price</th>
                            <th class="text-right py-2 px-2">Z-Score</th>
                            <th class="text-right py-2 px-2">Pressure</th>
                            <th class="text-right py-2 px-2">1Y Mean</th>
                            <th class="text-right py-2 px-2">1Y High</th>
                            <th class="text-right py-2 px-2">1Y Low</th>
                            <th class="text-right py-2 px-2">Weight</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={sorted()}>
                            {(item) => (
                                <tr class="border-b border-border_main/10 hover:bg-bg_main/20 transition-colors">
                                    <td class="py-2 px-2 text-text_accent font-black">{item.ticker}</td>
                                    <td class="py-2 px-2 text-text_primary">{item.name || item.ticker}</td>
                                    <td class="py-2 px-2">
                                        <span class="px-1.5 py-0.5 text-[6px] font-black tracking-wider uppercase"
                                            style={{
                                                background: `${(CATEGORY_COLORS[item.category] || '#8080a0')}20`,
                                                color: CATEGORY_COLORS[item.category] || '#8080a0',
                                                border: `1px solid ${(CATEGORY_COLORS[item.category] || '#8080a0')}40`
                                            }}>{item.category || 'N/A'}</span>
                                    </td>
                                    <td class="py-2 px-2 text-right text-text_primary">${fmt(item.current_price, 2)}</td>
                                    <td class="py-2 px-2 text-right font-mono" classList={signColor(item.z_score)}>
                                        {item.z_score != null ? fmt(item.z_score, 2) : 'N/A'}
                                    </td>
                                    <td class="py-2 px-2 text-right">
                                        <div class="flex items-center justify-end gap-1">
                                            <div class="w-12 h-1.5 bg-bg_main/50 rounded-full overflow-hidden">
                                                <div class="h-full rounded-full transition-all" style={{
                                                    width: `${Math.min(item.pressure_score ?? 50, 100)}%`,
                                                    background: (item.pressure_score ?? 50) >= 75 ? '#ef4444' : (item.pressure_score ?? 50) >= 60 ? '#f97316' : (item.pressure_score ?? 50) >= 40 ? '#f59e0b' : '#34d399'
                                                }} />
                                            </div>
                                            <span class="font-mono w-8 text-right" style={{
                                                color: (item.pressure_score ?? 50) >= 75 ? '#ef4444' : (item.pressure_score ?? 50) >= 60 ? '#f97316' : (item.pressure_score ?? 50) >= 40 ? '#f59e0b' : '#34d399'
                                            }}>{fmt(item.pressure_score, 1)}</span>
                                        </div>
                                    </td>
                                    <td class="py-2 px-2 text-right text-text_secondary/60">${fmt(item['1y_mean'], 2)}</td>
                                    <td class="py-2 px-2 text-right text-text_secondary/60">${fmt(item['1y_high'], 2)}</td>
                                    <td class="py-2 px-2 text-right text-text_secondary/60">${fmt(item['1y_low'], 2)}</td>
                                    <td class="py-2 px-2 text-right text-text_secondary/60">{fmt((item.weight ?? 0) * 100, 0)}%</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── TIMELINE CHART ───────────────────────────────────────────────────────────
function TimelineChart({ data }) {
    let chartRef;
    let chart;

    onMount(() => {
        if (!data?.length) return;
        chart = echarts.init(chartRef);

        // Group by date
        const dateMap = {};
        const tickers = [...new Set(data.map(d => d.ticker))];

        data.forEach(d => {
            if (!dateMap[d.date]) dateMap[d.date] = {};
            dateMap[d.date][d.ticker] = d.pressure;
        });

        const dates = Object.keys(dateMap).sort();
        const series = tickers.map(ticker => ({
            name: ticker,
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: dates.map(d => dateMap[d]?.[ticker] ?? null),
            lineStyle: { width: 1.5 }
        }));

        const tickerColors = {
            'CL=F': '#ef4444',
            'HG=F': '#f59e0b',
            'LBS=F': '#34d399',
        };

        series.forEach(s => {
            s.itemStyle = { color: tickerColors[s.name] || '#8080a0' };
            s.lineStyle = { ...s.lineStyle, color: tickerColors[s.name] || '#8080a0' };
        });

        // Add composite average line
        series.push({
            name: 'Composite Avg',
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: dates.map(d => {
                const vals = tickers.map(t => dateMap[d]?.[t]).filter(v => v != null);
                return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            }),
            lineStyle: { width: 2, color: '#a78bfa', type: 'dashed' },
            itemStyle: { color: '#a78bfa' },
        });

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    let html = `<div class="text-[10px] font-mono"><b>${params[0].axisValue}</b><br/>`;
                    params.forEach(p => {
                        if (p.value != null) {
                            html += `${p.seriesName}: <span style="color:${p.color}">${fmt(p.value, 1)}</span><br/>`;
                        }
                    });
                    html += '</div>';
                    return html;
                }
            },
            legend: {
                data: [...tickers, 'Composite Avg'],
                textStyle: { color: '#8080a0', fontSize: 7 },
                bottom: 0,
                left: 'center',
                icon: 'roundRect',
                itemWidth: 10,
                itemHeight: 2
            },
            grid: { left: '4%', right: '4%', top: '4%', bottom: '14%', containLabel: true },
            xAxis: {
                type: 'category',
                data: dates,
                axisLabel: {
                    fontSize: 7,
                    color: '#8080a0',
                    interval: Math.max(1, Math.floor(dates.length / 12))
                },
                axisLine: { lineStyle: { color: '#1a1a2e' } },
                splitLine: { show: false }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLabel: { fontSize: 7, color: '#8080a0' },
                splitLine: { lineStyle: { color: '#1a1a2e' } },
                axisLine: { show: false }
            },
            series,
            visualMap: false
        };
        chart.setOption(option);
    });

    onCleanup(() => chart?.dispose());

    if (!data?.length) {
        return <div class="text-text_secondary/40 text-[8px] p-8 text-center">No timeline data available</div>;
    }

    return (
        <div class="bg-bg_header/30 border border-border_main p-4">
            <SectionHeader title="Supply Chain Pressure Timeline" subtitle="90-day history" />
            <div ref={chartRef} class="w-full h-80" />
            <div class="mt-2 text-[7px] text-text_secondary/40 px-2">
                <span class="text-red-400">●</span> Crude Oil (CL=F)
                <span class="ml-3 text-amber-400">●</span> Copper (HG=F)
                <span class="ml-3 text-emerald-400">●</span> Lumber (LBS=F)
                <span class="ml-3 text-purple-400">●</span> Composite Average
                <span class="ml-4">Higher = more supply chain pressure</span>
            </div>
        </div>
    );
}
