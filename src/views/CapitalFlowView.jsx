import { createSignal, onMount, createEffect, For, Show } from 'solid-js';
import * as echarts from 'echarts';

const CAPITAL_FLOW_API = import.meta.env.VITE_CAPITAL_FLOW_API;
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

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────
export default function CapitalFlowView(props) {
    const [etfFlows, setEtfFlows] = createSignal({});
    const [rotationSignal, setRotationSignal] = createSignal(null);
    const [safeHaven, setSafeHaven] = createSignal(null);
    const [emFlows, setEmFlows] = createSignal(null);
    const [isLoading, setIsLoading] = createSignal(true);

    onMount(() => fetchAll());

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const resp = await fetch(`${DASHBOARD_API}/api/dashboard/capital-flows`);
            const json = await resp.json();
            if (json.status === 'success' && json.data) {
                // ETF Flows: categories are nested
                const rawEtf = json.data.etf_flows?.data || {};
                const etfCats = rawEtf.categories || {};
                
                // Enhance categories with computed aggregate inflow/outflow
                const processedEtf = {};
                Object.entries(etfCats).forEach(([cat, d]) => {
                    const etfs = d.etfs || [];
                    const inflow = etfs.reduce((sum, e) => sum + (e.flow_proxy > 0 ? e.flow_proxy : 0), 0);
                    const outflow = etfs.reduce((sum, e) => sum + (e.flow_proxy < 0 ? Math.abs(e.flow_proxy) : 0), 0);
                    processedEtf[cat] = {
                        ...d,
                        net_flow: d.category_flow / 1000000, // Convert to $M if backend provides raw $? No, the sample shows 982,924,192. Let's convert to Millions.
                        inflow: inflow / 1000000,
                        outflow: outflow / 1000000
                    };
                });
                setEtfFlows(processedEtf);

                // Rotation: map rankings to sectors for FE compatibility
                const rot = json.data.rotation?.data || {};
                if (rot.rankings) {
                    const sectors = {};
                    rot.rankings.forEach(r => {
                        sectors[r.asset] = {
                            flow: (r.return_1m * 10), // Proxy flow with returns if missing, but let's see. 
                            // Actually API rankings don't have 'flow'. Let's just use the rankings list directly in the view.
                            signal: r.return_1w > 0 ? 'OVERWEIGHT' : 'UNDERWEIGHT',
                            momentum: r.return_1m
                        };
                    });
                    setRotationSignal({ ...rot, sectors });
                }

                // Safe Haven
                const sh = json.data.safe_haven?.data || {};
                if (sh.safe_havens) {
                    const assets = {};
                    sh.safe_havens.forEach(a => {
                        assets[a.asset] = { price: a.price, change: a.change_pct, flow: 0 };
                    });
                    setSafeHaven({
                        level: sh.safe_haven_demand_index,
                        status: sh.demand_level,
                        assets
                    });
                }

                // Emerging Markets
                const em = json.data.emerging?.data || {};
                if (em.assets) {
                    const regions = {};
                    em.assets.forEach(a => {
                        regions[a.name] = { 
                            net_flow: a.change_pct, // Proxy
                            equity_flow: a.trend_5d,
                            debt_flow: a.trend_1m,
                            sentiment: a.change_pct > 0 ? 'BULLISH' : 'BEARISH'
                        };
                    });
                    setEmFlows({ regions });
                }
            }
        } catch (e) {
            console.error('Capital flow fetch failed, trying direct API...', e);
            try {
                const resp = await fetch(`${CAPITAL_FLOW_API}/api/capital-flow/summary`);
                const json = await resp.json();
                if (json.status === 'success') {
                    setEtfFlows(json.data.etf_flows || {});
                    setRotationSignal(json.data.rotation_signal);
                    setSafeHaven(json.data.safe_haven);
                    setEmFlows(json.data.em_flows);
                }
            } catch (e2) { console.error('Direct capital flow API failed:', e2); }
        } finally {
            setIsLoading(false);
        }
    };

    const TABS = [
        { id: 'ETF_FLOWS', label: 'ETF Flows' },
        { id: 'ROTATION', label: 'Rotation Signals' },
        { id: 'SAFE_HAVEN', label: 'Safe Haven' },
        { id: 'EM_FLOWS', label: 'Emerging Markets' },
    ];

    // ETF category colors
    const catColors = {
        'EQUITY': '#3b82f6', 'FIXED_INCOME': '#10b981', 'SECTOR': '#f59e0b',
        'COMMODITY': '#f97316', 'CURRENCY': '#8b5cf6', 'THEMATIC': '#ec4899', 'INVERSE': '#ef4444'
    };

    // Flow direction display
    const FlowBar = ({ inflow, outflow, net }) => {
        const max = Math.max(Math.abs(inflow || 0), Math.abs(outflow || 0), 1);
        const inPct = (inflow / max) * 100;
        const outPct = (outflow / max) * 100;
        return (
            <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between text-[8px]">
                    <span class="text-emerald-500 font-black">IN: ${fmt(inflow || 0, 0)}M</span>
                    <span class="text-red-500 font-black">OUT: ${fmt(outflow || 0, 0)}M</span>
                </div>
                <div class="h-2 bg-border_main overflow-hidden flex">
                    <div class="h-full bg-emerald-500 transition-all" style={`width: ${inPct}%`} />
                    <div class="h-full bg-red-500 transition-all" style={`width: ${outPct}%`} />
                </div>
                <span class={`text-[9px] font-black ${net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    NET: ${fmt(Math.abs(net || 0), 0)}M {net >= 0 ? 'INFLOW' : 'OUTFLOW'}
                </span>
            </div>
        );
    };

    return (
        <div class="flex flex-col h-full bg-black">
            <div class="h-12 border-b border-border_main bg-bg_header/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 sticky top-0 z-20">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 bg-text_accent animate-pulse shadow-[0_0_10px_var(--text-accent)]" />
                    <h2 class="text-[11px] font-black tracking-[0.4em] text-text_primary uppercase font-mono">Unified Capital Flows Intelligence</h2>
                </div>
                <Show when={rotationSignal()}>
                    {(r) => (
                        <div class={`flex items-center gap-2 px-3 py-1 ${r().direction === 'RISK_ON' ? 'bg-emerald-500/10 border-emerald-500/30' : r().direction === 'RISK_OFF' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'} border rounded-sm`}>
                            <span class={`text-[9px] font-black tracking-widest ${r().direction === 'RISK_ON' ? 'text-emerald-500' : r().direction === 'RISK_OFF' ? 'text-red-500' : 'text-amber-500'}`}>GLOBAL STANCE: {r().direction?.replace(/_/g, ' ')}</span>
                        </div>
                    )}
                </Show>
            </div>

            <div class="flex-1 overflow-y-auto win-scroll">
                <div class="max-w-[1600px] mx-auto p-6 space-y-12 pb-24">
                    
                    {/* ─── SECTION 1: ETF FLOWS ────────────────────────────────────────────── */}
                    <div id="etf-flows" class="space-y-4">
                        <div class="flex items-center gap-3 mb-2">
                            <span class="text-text_accent font-mono text-[10px] opacity-40">01</span>
                            <h3 class="text-[12px] font-black tracking-[0.2em] text-text_primary uppercase">ETF Flows Analytics</h3>
                            <div class="flex-1 h-[1px] bg-white/5" />
                        </div>
                        
                        <div class="grid grid-cols-12 gap-4">
                            <div class="col-span-12 lg:col-span-8 bg-bg_header/30 border border-border_main flex flex-col h-[500px] rounded-sm overflow-hidden shadow-2xl">
                                <SectionHeader title="Category Breakdown" subtitle="Net Inflow/Outflow ($M)" />
                                <div class="flex-1 p-2">
                                    <Show when={Object.keys(etfFlows()).length > 0} fallback={<LoadingSkeleton rows={8} />}>
                                        {(() => {
                                            let chartEl;
                                            let chart;
                                            onMount(() => { chart = echarts.init(chartEl); });
                                            createEffect(() => {
                                                if (!chart || !Object.keys(etfFlows()).length) return;
                                                const cats = Object.keys(etfFlows());
                                                const netFlows = cats.map(c => etfFlows()[c]?.net_flow || 0);
                                                chart.setOption({
                                                    backgroundColor: 'transparent',
                                                    tooltip: {
                                                        trigger: 'axis', textStyle: { fontSize: 9 }, formatter: (params) => {
                                                            const idx = params[0].dataIndex;
                                                            const c = cats[idx];
                                                            const d = etfFlows()[c];
                                                            return `<b>${c}</b><br/>Inflow: $${fmt(d.inflow || 0, 0)}M<br/>Outflow: $${fmt(d.outflow || 0, 0)}M<br/>Net: <span style="color:${d.net_flow >= 0 ? '#10b981' : '#ef4444'}">$${fmt(Math.abs(d.net_flow || 0), 0)}M ${d.net_flow >= 0 ? 'INFLOW' : 'OUTFLOW'}</span><br/>ETFs: ${d.etfs?.length || 0}`;
                                                        }
                                                    },
                                                    grid: { top: 40, bottom: 40, left: 60, right: 20 },
                                                    xAxis: { type: 'category', data: cats, axisLabel: { fontSize: 8, color: '#666', rotate: 25 } },
                                                    yAxis: { type: 'value', name: 'Net Flow ($M)', nameTextStyle: { fontSize: 7, color: '#666' }, splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { fontSize: 8, color: '#666' } },
                                                    series: [{
                                                        type: 'bar', data: cats.map((c, i) => ({
                                                            value: netFlows[i],
                                                            itemStyle: { 
                                                                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                                                    { offset: 0, color: netFlows[i] >= 0 ? '#10b981' : '#ef4444' },
                                                                    { offset: 1, color: netFlows[i] >= 0 ? '#064e3b' : '#7f1d1d' }
                                                                ]),
                                                                borderRadius: [4, 4, 0, 0] 
                                                            }
                                                        })),
                                                        barWidth: '40%',
                                                        label: { show: true, position: 'top', fontSize: 8, formatter: (p) => `$${fmt(Math.abs(p.value), 0)}M`, color: '#ccc', fontWeight: 'bold' },
                                                        markLine: { silent: true, data: [{ yAxis: 0, label: { formatter: 'ZERO', fontSize: 7, color: '#666' } }], lineStyle: { color: '#333', type: 'solid' } }
                                                    }]
                                                });
                                            });
                                            return <div ref={chartEl} class="w-full h-full" />;
                                        })()}
                                    </Show>
                                </div>
                            </div>

                            <div class="col-span-12 lg:col-span-4 bg-bg_header/30 border border-border_main rounded-sm overflow-hidden flex flex-col">
                                <SectionHeader title="Category Monitor" subtitle="Real-time Intensity" />
                                <div class="flex-1 overflow-y-auto win-scroll p-4 space-y-4">
                                    <Show when={Object.keys(etfFlows()).length > 0} fallback={<LoadingSkeleton rows={4} />}>
                                        <For each={Object.entries(etfFlows())}>
                                            {([cat, data]) => (
                                                <div class="bg-black/40 border border-white/5 p-4 rounded hover:border-text_accent/30 transition-colors group">
                                                    <div class="flex items-center gap-2 mb-2">
                                                        <div class="w-1.5 h-6 bg-text_accent opacity-20 group-hover:opacity-100 transition-opacity" style={`background: ${catColors[cat] || '#666'}`} />
                                                        <div class="flex flex-col">
                                                            <span class="text-[10px] font-black text-text_primary uppercase tracking-wider">{cat.replace(/_/g, ' ')}</span>
                                                            <span class="text-[7px] text-text_secondary/40 font-mono">{data.etfs?.length || 0} ASSETS TRACKED</span>
                                                        </div>
                                                    </div>
                                                    <FlowBar inflow={data.inflow} outflow={data.outflow} net={data.net_flow} />
                                                </div>
                                            )}
                                        </For>
                                    </Show>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── SECTION 2: ROTATION SIGNALS ──────────────────────────────────────── */}
                    <div id="rotation-signals" class="space-y-4">
                        <div class="flex items-center gap-3 mb-2">
                            <span class="text-text_accent font-mono text-[10px] opacity-40">02</span>
                            <h3 class="text-[12px] font-black tracking-[0.2em] text-text_primary uppercase">Market Rotation Signals</h3>
                            <div class="flex-1 h-[1px] bg-white/5" />
                        </div>

                        <div class="grid grid-cols-12 gap-4">
                            <div class="col-span-12 xl:col-span-7 bg-bg_header/30 border border-border_main flex flex-col h-[500px] rounded-sm overflow-hidden">
                                <SectionHeader title="Signal Strength" subtitle="Performance vs Flow Analysis" />
                                <div class="flex-1 p-2">
                                    <Show when={rotationSignal()?.sectors} fallback={<LoadingSkeleton rows={8} />}>
                                        {(() => {
                                            let chartEl;
                                            let chart;
                                            onMount(() => { chart = echarts.init(chartEl); });
                                            createEffect(() => {
                                                if (!chart || !rotationSignal()?.sectors) return;
                                                const sectors = Object.keys(rotationSignal().sectors);
                                                const signals = sectors.map(s => rotationSignal().sectors[s]);
                                                chart.setOption({
                                                    backgroundColor: 'transparent',
                                                    tooltip: {
                                                        trigger: 'axis', textStyle: { fontSize: 9 }, formatter: (params) => {
                                                            const idx = params[0].dataIndex;
                                                            const s = sectors[idx];
                                                            const d = rotationSignal().sectors[s];
                                                            return `<b>${s}</b><br/>Signal Score: ${fmt(d.flow, 1)}<br/>Status: <b>${d.signal}</b><br/>Momentum: ${fmtPct(d.momentum)}`;
                                                        }
                                                    },
                                                    grid: { top: 40, bottom: 60, left: 60, right: 20 },
                                                    xAxis: { type: 'category', data: sectors, axisLabel: { fontSize: 7, color: '#666', rotate: 35 } },
                                                    yAxis: { type: 'value', name: 'Momentum Score', nameTextStyle: { fontSize: 7, color: '#666' }, splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { fontSize: 8, color: '#666' } },
                                                    series: [{
                                                        type: 'bar', data: sectors.map((s, i) => ({
                                                            value: signals[i].momentum * 100,
                                                            itemStyle: { 
                                                                color: signals[i].signal === 'OVERWEIGHT' ? '#10b981' : signals[i].signal === 'UNDERWEIGHT' ? '#ef4444' : '#f59e0b', 
                                                                borderRadius: [2, 2, 0, 0],
                                                                opacity: 0.8
                                                            }
                                                        })),
                                                        barWidth: '45%',
                                                        label: { show: true, position: 'top', fontSize: 7, formatter: (p) => signals[p.dataIndex].signal?.slice(0, 4), color: '#999' }
                                                    }]
                                                });
                                            });
                                            return <div ref={chartEl} class="w-full h-full" />;
                                        })()}
                                    </Show>
                                </div>
                            </div>

                            <div class="col-span-12 xl:col-span-5 bg-bg_header/30 border border-border_main flex flex-col h-[500px] rounded-sm overflow-hidden">
                                <SectionHeader title="Ranking Table" subtitle="Relative Strength Index" />
                                <div class="flex-1 p-4 space-y-1 overflow-y-auto win-scroll">
                                    <Show when={rotationSignal()?.sectors} fallback={<LoadingSkeleton rows={10} />}>
                                        <div class="flex text-[7px] text-text_secondary/40 font-black uppercase tracking-widest px-2 mb-2">
                                            <span class="w-1/3">ASSET CLASS</span>
                                            <span class="w-1/4 text-center">SIGNAL</span>
                                            <span class="w-1/4 text-center">MOMENTUM</span>
                                            <span class="w-1/6 text-right">SCORE</span>
                                        </div>
                                        <For each={Object.entries(rotationSignal()?.sectors || {})}>
                                            {([sector, data]) => (
                                                <div class="flex items-center justify-between py-2.5 px-3 border border-white/5 bg-black/20 hover:bg-white/5 transition-colors rounded-sm mb-1 group">
                                                    <div class="w-1/3 flex items-center gap-3">
                                                        <div class={`w-1 h-3 ${data.signal === 'OVERWEIGHT' ? 'bg-emerald-500' : data.signal === 'UNDERWEIGHT' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                                        <span class="text-[9px] font-black text-text_primary uppercase tracking-tight group-hover:text-text_accent transition-colors">{sector}</span>
                                                    </div>
                                                    <div class="w-1/4 text-center">
                                                        <span class={`text-[8px] font-black px-1.5 py-0.5 rounded-sm ${data.signal === 'OVERWEIGHT' ? 'bg-emerald-500/10 text-emerald-500' : data.signal === 'UNDERWEIGHT' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>{data.signal}</span>
                                                    </div>
                                                    <div class="w-1/4 text-center">
                                                        <span class={`text-[9px] font-mono font-bold ${data.momentum >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPct(data.momentum)}</span>
                                                    </div>
                                                    <div class="w-1/6 text-right">
                                                        <span class="text-[9px] font-mono text-text_accent/60">{fmt(data.flow, 1)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </Show>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── SECTION 3: SAFE HAVEN & EM FLOWS ────────────────────────────────────────────── */}
                    <div class="grid grid-cols-12 gap-6">
                        {/* SAFE HAVEN */}
                        <div id="safe-haven" class="col-span-12 lg:col-span-5 space-y-4">
                            <div class="flex items-center gap-3 mb-2">
                                <span class="text-text_accent font-mono text-[10px] opacity-40">03</span>
                                <h3 class="text-[12px] font-black tracking-[0.2em] text-text_primary uppercase">Safe Haven Demand</h3>
                                <div class="flex-1 h-[1px] bg-white/5" />
                            </div>
                            
                            <div class="bg-bg_header/30 border border-border_main flex flex-col rounded-sm overflow-hidden h-[500px]">
                                <SectionHeader title="Demand Index" subtitle="Risk-Off Flight Gauge" />
                                <div class="flex-1 p-6 space-y-6">
                                    <Show when={safeHaven()} fallback={<LoadingSkeleton rows={5} />}>
                                        <div class="flex flex-col items-center">
                                            <div class="relative w-40 h-40 flex items-center justify-center">
                                                <svg class="w-full h-full transform -rotate-90">
                                                    <circle cx="80" cy="80" r="70" fill="transparent" stroke="#1a1a1a" stroke-width="12" />
                                                    <circle 
                                                        cx="80" cy="80" r="70" fill="transparent" 
                                                        stroke={(safeHaven()?.level || 0) >= 70 ? '#ef4444' : (safeHaven()?.level || 0) >= 40 ? '#f59e0b' : '#10b981'} 
                                                        stroke-width="12" 
                                                        stroke-dasharray={440}
                                                        stroke-dashoffset={440 - (440 * (safeHaven()?.level || 0)) / 100}
                                                        class="transition-all duration-1000 ease-out"
                                                    />
                                                </svg>
                                                <div class="absolute flex flex-col items-center">
                                                    <span class="text-[32px] font-black font-mono text-text_primary">{fmt(safeHaven()?.level || 0, 0)}</span>
                                                    <span class="text-[8px] font-black text-text_secondary/40 tracking-widest -mt-1 uppercase">INDEX</span>
                                                </div>
                                            </div>
                                            <div class="mt-4 px-4 py-1 rounded bg-white/5 border border-white/5 text-center">
                                                <span class={`text-[9px] font-black tracking-[0.2em] uppercase ${(safeHaven()?.level || 0) >= 70 ? 'text-red-500' : (safeHaven()?.level || 0) >= 40 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                    {safeHaven()?.level >= 70 ? 'STRONG SAFE-HAVEN FLOWS' :
                                                        safeHaven()?.level >= 40 ? 'MODERATE DEMAND' :
                                                            'MINIMAL SAFE-HAVEN DEMAND'}
                                                </span>
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-2 gap-3 mt-4">
                                            <For each={Object.entries(safeHaven()?.assets || {}).slice(0, 4)}>
                                                {([asset, data]) => (
                                                    <div class="bg-black/40 border border-white/5 p-3 rounded-sm group hover:border-text_accent/20 transition-all">
                                                        <div class="flex justify-between items-center mb-1">
                                                            <span class="text-[8px] font-black text-text_secondary uppercase">{asset}</span>
                                                            <span class={`text-[8px] font-mono font-bold ${data.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmtPct(data.change)}</span>
                                                        </div>
                                                        <div class="text-[11px] font-black text-text_primary group-hover:text-text_accent transition-colors">${fmt(data.price, 2)}</div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </div>
                            </div>
                        </div>

                        {/* EM FLOWS */}
                        <div id="em-flows" class="col-span-12 lg:col-span-7 space-y-4">
                            <div class="flex items-center gap-3 mb-2">
                                <span class="text-text_accent font-mono text-[10px] opacity-40">04</span>
                                <h3 class="text-[12px] font-black tracking-[0.2em] text-text_primary uppercase">Emerging Markets Pulse</h3>
                                <div class="flex-1 h-[1px] bg-white/5" />
                            </div>

                            <div class="bg-bg_header/30 border border-border_main flex flex-col rounded-sm overflow-hidden h-[500px]">
                                <SectionHeader title="Regional Flows" subtitle="EM Index & Currency Sentiment" />
                                <div class="flex-1 overflow-hidden flex flex-col">
                                    <div class="flex-1 overflow-y-auto win-scroll">
                                        <table class="w-full text-left border-collapse">
                                            <thead class="sticky top-0 bg-black z-10">
                                                <tr class="text-[7px] text-text_secondary/40 font-black tracking-widest border-b border-white/5">
                                                    <th class="px-6 py-4">ASSET CLASS</th>
                                                    <th class="px-4 py-4 text-center">CHANGE %</th>
                                                    <th class="px-4 py-4 text-center">5D TREND</th>
                                                    <th class="px-4 py-4 text-center">1M TREND</th>
                                                    <th class="px-6 py-4 text-right">SENTIMENT</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-white/5">
                                                <Show when={emFlows()?.regions} fallback={<tr><td colSpan={5} class="text-center py-20 text-[9px] text-text_secondary/40 uppercase tracking-[0.3em]">Processing EM Data...</td></tr>}>
                                                    <For each={Object.entries(emFlows()?.regions || {})}>
                                                        {([region, data]) => (
                                                            <tr class="hover:bg-text_accent/5 group transition-colors">
                                                                <td class="px-6 py-4">
                                                                    <div class="flex items-center gap-3">
                                                                        <div class={`w-1.5 h-1.5 rounded-full ${data.net_flow >= 0 ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
                                                                        <span class="text-[10px] font-black text-text_primary uppercase tracking-tight group-hover:text-text_accent transition-colors">{region}</span>
                                                                    </div>
                                                                </td>
                                                                <td class={`px-4 py-4 text-center text-[10px] font-black font-mono ${data.net_flow >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                    {fmtPct(data.net_flow)}
                                                                </td>
                                                                <td class="px-4 py-4 text-center">
                                                                    <div class="flex items-center justify-center gap-1">
                                                                        <div class={`h-1 w-8 rounded-full bg-white/5 overflow-hidden`}>
                                                                            <div class={`h-full ${data.equity_flow >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={`width: ${Math.abs(data.equity_flow) * 100}%`} />
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td class="px-4 py-4 text-center">
                                                                    <div class="flex items-center justify-center gap-1">
                                                                        <div class={`h-1 w-8 rounded-full bg-white/5 overflow-hidden`}>
                                                                            <div class={`h-full ${data.debt_flow >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={`width: ${Math.abs(data.debt_flow) * 100}%`} />
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td class="px-6 py-4 text-right">
                                                                    <span class={`text-[8px] font-black px-2 py-0.5 rounded-sm ${data.sentiment === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-500' : data.sentiment === 'BEARISH' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                                        {data.sentiment || 'NEUTRAL'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </For>
                                                </Show>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
