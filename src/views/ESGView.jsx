import { createSignal, onMount, createEffect, For, Show } from 'solid-js';
import * as echarts from 'echarts';

const ESG_API = import.meta.env.VITE_ESG_API;
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

// ─── ESG WATCHLIST ────────────────────────────────────────────────────────────
const ESG_WATCHLIST = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA",
    "JPM", "BAC", "WFC", "GS", "MS",
    "XOM", "CVX", "COP", "SLB",
    "CAT", "DE", "GE", "MMM",
    "PG", "KO", "PEP", "WMT",
    "UNH", "JNJ", "PFE", "MRK", "ABBV",
    "V", "MA", "DIS", "NFLX", "BA",
];

// ─── ESG SCORE BADGE ──────────────────────────────────────────────────────────
const esgBadge = (score) => {
    if (score == null) return { cls: 'bg-gray-800 text-gray-400', label: 'N/A' };
    if (score >= 70) return { cls: 'bg-emerald-900/60 text-emerald-400 border border-emerald-700/50', label: 'Excellent' };
    if (score >= 50) return { cls: 'bg-green-900/60 text-green-400 border border-green-700/50', label: 'Good' };
    if (score >= 30) return { cls: 'bg-amber-900/60 text-amber-400 border border-amber-700/50', label: 'Average' };
    if (score >= 15) return { cls: 'bg-orange-900/60 text-orange-400 border border-orange-700/50', label: 'Poor' };
    return { cls: 'bg-red-900/60 text-red-400 border border-red-700/50', label: 'Critical' };
};

const controversyBadge = (level) => {
    if (!level) return { cls: 'bg-gray-800 text-gray-400', label: 'N/A' };
    if (level === 'HIGH') return { cls: 'bg-red-900/60 text-red-400 border border-red-700/50', label: 'HIGH' };
    if (level === 'MEDIUM') return { cls: 'bg-amber-900/60 text-amber-400 border border-amber-700/50', label: 'MEDIUM' };
    return { cls: 'bg-emerald-900/60 text-emerald-400 border border-emerald-700/50', label: 'LOW' };
};

// ─── SCORE GAUGE ──────────────────────────────────────────────────────────────
function ScoreGauge({ score, label, color }) {
    let chartRef;
    let chart;

    onMount(() => {
        chart = echarts.init(chartRef);
        const val = score ?? 0;
        const gaugeColor = color || (val >= 70 ? '#34d399' : val >= 50 ? '#4ade80' : val >= 30 ? '#f59e0b' : val >= 15 ? '#f97316' : '#ef4444');
        const option = {
            series: [{
                type: 'gauge',
                center: ['50%', '60%'],
                radius: '75%',
                startAngle: 220,
                endAngle: -40,
                min: 0,
                max: 100,
                pointer: { show: true, length: '45%', width: 2, itemStyle: { color: '#a0a0c0' } },
                progress: { show: true, width: 5, itemStyle: { color: gaugeColor } },
                axisLine: {
                    lineStyle: {
                        width: 5, color: [
                            [0.15, '#ef4444'],
                            [0.3, '#f97316'],
                            [0.5, '#f59e0b'],
                            [0.7, '#4ade80'],
                            [1, '#34d399']
                        ]
                    }
                },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { show: false },
                detail: {
                    formatter: `{value}`,
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: '#c0c0e0',
                    fontFamily: 'monospace',
                    offsetCenter: [0, '40%']
                },
                data: [{ value: val, name: label }]
            }]
        };
        chart.setOption(option);
    });

    onCleanup(() => chart?.dispose());

    return <div ref={chartRef} class="w-full h-full" />;
}

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────
export default function ESGView(props) {
    const [activeTab, setActiveTab] = createSignal('SCORES');
    const [selectedSymbol, setSelectedSymbol] = createSignal('AAPL');
    const [esgData, setEsgData] = createSignal(null);
    const [sectorData, setSectorData] = createSignal([]);
    const [controversies, setControversies] = createSignal([]);
    const [isLoading, setIsLoading] = createSignal(true);

    onMount(() => fetchAll());

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const [scoreRes, sectorRes, controversyRes] = await Promise.allSettled([
                fetch(`${ESG_API}/api/esg/score/${selectedSymbol()}`).then(r => r.json()),
                fetch(`${ESG_API}/api/esg/sector-average`).then(r => r.json()),
                fetch(`${ESG_API}/api/esg/controversy`).then(r => r.json()),
            ]);

            if (scoreRes.status === 'fulfilled' && scoreRes.value.status === 'success') {
                setEsgData(scoreRes.value.data);
            }
            if (sectorRes.status === 'fulfilled' && sectorRes.value.status === 'success') {
                setSectorData(sectorRes.value.data?.sectors || []);
            }
            if (controversyRes.status === 'fulfilled' && controversyRes.value.status === 'success') {
                setControversies(controversyRes.value.data?.controversies || []);
            }
        } catch (e) {
            console.error('ESG fetch failed:', e);
        } finally {
            setIsLoading(false);
        }
    };

    // Re-fetch when symbol changes
    createEffect(() => {
        const sym = selectedSymbol();
        if (sym && activeTab() === 'SCORES') {
            (async () => {
                try {
                    const res = await fetch(`${ESG_API}/api/esg/score/${sym}`);
                    const json = await res.json();
                    if (json.status === 'success') setEsgData(json.data);
                } catch (e) {
                    console.error('ESG score fetch:', e);
                }
            })();
        }
    });

    const TABS = [
        { id: 'SCORES', label: 'ESG Scores' },
        { id: 'SECTORS', label: 'Sector Averages' },
        { id: 'CONTROVERSY', label: 'Controversy Tracker' },
    ];

    return (
        <div class="flex flex-col h-full">
            {/* ─── TAB BAR ─────────────────────────────────────────────────────── */}
            <div class="h-10 border-b border-border_main bg-bg_header/50 flex items-center justify-between px-4 shrink-0">
                <nav class="flex items-center gap-1">
                    <For each={TABS}>
                        {(tab) => (
                            <button
                                onClick={() => setActiveTab(tab.id)}
                                class={`px-3 py-1 text-[8px] font-black tracking-widest border transition-all ${activeTab() === tab.id ? 'bg-text_accent text-bg_main border-text_accent' : 'border-transparent text-text_secondary opacity-40 hover:opacity-100'}`}
                            >{tab.label.toUpperCase()}</button>
                        )}
                    </For>
                </nav>
                <Show when={activeTab() === 'SCORES'}>
                    <select
                        value={selectedSymbol()}
                        onChange={(e) => setSelectedSymbol(e.target.value)}
                        class="bg-bg_main/50 border border-border_main text-text_primary text-[8px] px-2 py-1 outline-none font-mono cursor-pointer"
                    >
                        <For each={ESG_WATCHLIST}>
                            {(sym) => <option value={sym}>{sym}</option>}
                        </For>
                    </select>
                </Show>
            </div>

            <div class="flex-1 overflow-y-auto win-scroll p-4">
                {/* ─── TAB 1: ESG SCORES ──────────────────────────────────────── */}
                <Show when={activeTab() === 'SCORES'}>
                    <Show when={!isLoading && esgData()} fallback={<LoadingSkeleton rows={8} />}>
                        <div class="grid grid-cols-12 gap-4">
                            {/* Company Info Header */}
                            <div class="col-span-12 bg-bg_header/30 border border-border_main p-4">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <div class="flex items-center gap-3">
                                            <span class="text-lg font-black font-mono text-text_accent">{esgData()?.symbol}</span>
                                            <span class="text-[9px] text-text_primary">{esgData()?.company || ''}</span>
                                        </div>
                                        <div class="flex items-center gap-3 mt-1 text-[7px] text-text_secondary/40">
                                            <span>{esgData()?.sector || 'N/A'}</span>
                                            <span>{esgData()?.industry || ''}</span>
                                            {esgData()?.esg_available === false && (
                                                <span class="text-amber-400">ESG data limited</span>
                                            )}
                                        </div>
                                    </div>
                                    <Show when={esgData()?.esg_scores?.total_esg != null}>
                                        {(total) => {
                                            const badge = esgBadge(total());
                                            return <span class={`px-3 py-1 text-[8px] font-black tracking-widest uppercase ${badge.cls}`}>{badge.label}</span>;
                                        }}
                                    </Show>
                                </div>
                            </div>

                            {/* ESG Score Gauges */}
                            <div class="col-span-12 lg:col-span-4 bg-bg_header/30 border border-border_main p-4">
                                <SectionHeader title="Total ESG" />
                                <div class="h-44">
                                    <ScoreGauge score={esgData()?.esg_scores?.total_esg} />
                                </div>
                                <div class="text-center mt-2">
                                    <span class="text-2xl font-black font-mono" classList={{
                                        'text-emerald-400': (esgData()?.esg_scores?.total_esg ?? 0) >= 50,
                                        'text-amber-400': (esgData()?.esg_scores?.total_esg ?? 0) >= 30 && (esgData()?.esg_scores?.total_esg ?? 0) < 50,
                                        'text-red-400': (esgData()?.esg_scores?.total_esg ?? 0) < 30,
                                    }}>
                                        {fmt(esgData()?.esg_scores?.total_esg ?? 0, 0)}
                                    </span>
                                    <span class="text-[8px] text-text_secondary/40 ml-1">/100</span>
                                </div>
                            </div>

                            {/* E / S / G Breakdown */}
                            <div class="col-span-12 lg:col-span-8 bg-bg_header/30 border border-border_main p-4">
                                <SectionHeader title="ESG Breakdown" subtitle="Environmental / Social / Governance" />
                                <div class="grid grid-cols-3 gap-4 mt-4">
                                    <ESGScoreCard
                                        label="Environmental"
                                        score={esgData()?.esg_scores?.environment_score}
                                        color="bg-emerald-500"
                                    />
                                    <ESGScoreCard
                                        label="Social"
                                        score={esgData()?.esg_scores?.social_score}
                                        color="bg-blue-500"
                                    />
                                    <ESGScoreCard
                                        label="Governance"
                                        score={esgData()?.esg_scores?.governance_score}
                                        color="bg-purple-500"
                                    />
                                </div>

                                {/* Score bar visualization */}
                                <div class="mt-6 space-y-3">
                                    <ESGBarRow label="Total ESG" value={esgData()?.esg_scores?.total_esg} color="#34d399" />
                                    <ESGBarRow label="Environment" value={esgData()?.esg_scores?.environment_score} color="#34d399" />
                                    <ESGBarRow label="Social" value={esgData()?.esg_scores?.social_score} color="#60a5fa" />
                                    <ESGBarRow label="Governance" value={esgData()?.esg_scores?.governance_score} color="#a78bfa" />
                                </div>
                            </div>

                            {/* Governance Risk */}
                            <Show when={esgData()?.governance}>
                                <div class="col-span-12 bg-bg_header/30 border border-border_main p-4">
                                    <SectionHeader title="Governance Risk Assessment" />
                                    <div class="grid grid-cols-4 gap-4 mt-3">
                                        <Show when={esgData()?.governance?.board_size != null}>
                                            <MiniMetric label="Board Size" value={esgData()?.governance?.board_size} />
                                        </Show>
                                        <MiniMetric
                                            label="Audit Risk"
                                            value={esgData()?.governance?.audit_risk}
                                            badge={typeof esgData()?.governance?.audit_risk === 'string'}
                                        />
                                        <MiniMetric
                                            label="Compensation Risk"
                                            value={esgData()?.governance?.compensation_risk}
                                            badge={typeof esgData()?.governance?.compensation_risk === 'string'}
                                        />
                                        <MiniMetric
                                            label="Shareholder Rights Risk"
                                            value={esgData()?.governance?.shareholder_rights_risk}
                                            badge={typeof esgData()?.governance?.shareholder_rights_risk === 'string'}
                                        />
                                    </div>
                                </div>
                            </Show>

                            {/* Raw ESG Data */}
                            <Show when={esgData()?.raw_data && Object.keys(esgData().raw_data).length > 0}>
                                <div class="col-span-12 bg-bg_header/30 border border-border_main p-4">
                                    <SectionHeader title="Raw ESG Metrics" subtitle="From sustainability data" />
                                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                                        <For each={Object.entries(esgData()?.raw_data || {}).filter(([k]) => !['totalEsg', 'environmentScore', 'socialScore', 'governanceScore', 'peerGroup'].includes(k))}>
                                            {([key, val]) => (
                                                <div class="border border-border_main/30 p-2">
                                                    <div class="text-[6px] text-text_secondary/40 uppercase tracking-wider truncate">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                                                    <div class="text-[9px] font-mono font-black mt-0.5 text-text_primary truncate">{val != null ? String(val) : 'N/A'}</div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>
                        </div>
                    </Show>
                </Show>

                {/* ─── TAB 2: SECTOR AVERAGES ─────────────────────────────────── */}
                <Show when={activeTab() === 'SECTORS'}>
                    <Show when={!isLoading && sectorData().length} fallback={<LoadingSkeleton rows={6} />}>
                        <SectorESGChart data={sectorData()} />
                    </Show>
                </Show>

                {/* ─── TAB 3: CONTROVERSY TRACKER ─────────────────────────────── */}
                <Show when={activeTab() === 'CONTROVERSY'}>
                    <Show when={!isLoading && controversies().length} fallback={<LoadingSkeleton rows={6} />}>
                        <ControversyTable data={controversies()} />
                    </Show>
                </Show>
            </div>
        </div>
    );
}

// ─── ESG SCORE CARD ───────────────────────────────────────────────────────────
function ESGScoreCard({ label, score, color }) {
    const pct = score != null ? Math.min(score, 100) : 0;
    const badge = esgBadge(score);
    return (
        <div class="border border-border_main/30 p-4 text-center">
            <div class="text-[7px] text-text_secondary/40 uppercase tracking-wider mb-2">{label}</div>
            <div class="text-2xl font-black font-mono mb-1" classList={{
                'text-text_primary': score == null,
                'text-emerald-400': score >= 50,
                'text-amber-400': score >= 30 && score < 50,
                'text-red-400': score < 30,
            }}>{score != null ? fmt(score, 0) : 'N/A'}</div>
            <div class="w-full h-1.5 bg-bg_main/50 rounded-full overflow-hidden">
                <div class={`h-full rounded-full transition-all duration-700 ${color || 'bg-text_accent'}`} style={{ width: `${pct}%` }} />
            </div>
            <div class="mt-2">
                <span class={`px-2 py-0.5 text-[6px] font-black tracking-widest uppercase ${badge.cls}`}>{badge.label}</span>
            </div>
        </div>
    );
}

// ─── ESG BAR ROW ──────────────────────────────────────────────────────────────
function ESGBarRow({ label, value, color }) {
    const pct = value != null ? Math.min(value, 100) : 0;
    return (
        <div class="flex items-center gap-3">
            <span class="text-[7px] text-text_secondary/40 uppercase tracking-wider w-24 shrink-0">{label}</span>
            <div class="flex-1 h-2 bg-bg_main/50 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color || '#34d399' }} />
            </div>
            <span class="text-[9px] font-mono font-black w-10 text-right" style={{ color: color || '#34d399' }}>{value != null ? fmt(value, 0) : 'N/A'}</span>
        </div>
    );
}

// ─── MINI METRIC ──────────────────────────────────────────────────────────────
function MiniMetric({ label, value, badge }) {
    return (
        <div class="border border-border_main/30 p-3">
            <div class="text-[7px] text-text_secondary/40 uppercase tracking-wider">{label}</div>
            <div class="mt-1">
                {badge ? (
                    <span class={`px-2 py-0.5 text-[7px] font-black tracking-widest uppercase ${String(value).toLowerCase().includes('high') ? 'bg-red-900/60 text-red-400' :
                            String(value).toLowerCase().includes('medium') ? 'bg-amber-900/60 text-amber-400' :
                                String(value).toLowerCase().includes('low') ? 'bg-emerald-900/60 text-emerald-400' :
                                    'bg-gray-800 text-gray-400'
                        } border border-border_main/30`}>
                        {value != null ? String(value) : 'N/A'}
                    </span>
                ) : (
                    <span class="text-lg font-black font-mono text-text_primary">{value != null ? fmt(value, 0) : 'N/A'}</span>
                )}
            </div>
        </div>
    );
}

// ─── SECTOR ESG CHART ─────────────────────────────────────────────────────────
function SectorESGChart({ data }) {
    let chartRef;
    let chart;

    onMount(() => {
        if (!data?.length) return;
        chart = echarts.init(chartRef);

        const sorted = [...data].sort((a, b) => b.average_esg_score - a.average_esg_score);
        const sectors = sorted.map(d => d.sector);
        const scores = sorted.map(d => d.average_esg_score);
        const counts = sorted.map(d => d.companies_tracked || 0);
        const maxScore = Math.max(...scores, 1);

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    const d = sorted[params[0].dataIndex];
                    return `<div class="text-[10px] font-mono">
                        <b>${d.sector}</b><br/>
                        Avg ESG: <span style="color:${d.average_esg_score >= 50 ? '#34d399' : '#f59e0b'}">${fmt(d.average_esg_score, 1)}</span><br/>
                        Companies: ${d.companies_tracked}<br/>
                        Range: ${fmt(d.min_score, 1)} – ${fmt(d.max_score, 1)}
                    </div>`;
                }
            },
            grid: { left: '18%', right: '8%', top: '4%', bottom: '8%' },
            xAxis: {
                type: 'value',
                max: 100,
                axisLabel: { fontSize: 7, color: '#8080a0' },
                splitLine: { lineStyle: { color: '#1a1a2e' } }
            },
            yAxis: {
                type: 'category',
                data: sectors,
                axisLabel: { fontSize: 7, color: '#8080a0', width: 100, overflow: 'truncate' },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            series: [
                {
                    type: 'bar',
                    data: scores.map((s, i) => ({
                        value: s,
                        itemStyle: {
                            color: s >= 50 ? '#34d399' : s >= 30 ? '#f59e0b' : '#ef4444',
                            borderRadius: [0, 2, 2, 0]
                        }
                    })),
                    barMaxWidth: 16,
                    label: {
                        show: true,
                        position: 'right',
                        fontSize: 7,
                        color: '#8080a0',
                        formatter: (p) => fmt(p.value, 1)
                    },
                    markLine: {
                        silent: true,
                        data: [{ xAxis: 50, label: { formatter: '50 Avg', fontSize: 7, color: '#8080a0' } }],
                        lineStyle: { color: '#8080a0', type: 'dashed', width: 1 }
                    }
                }
            ]
        };
        chart.setOption(option);
    });

    onCleanup(() => chart?.dispose());

    return (
        <div class="bg-bg_header/30 border border-border_main p-4">
            <SectionHeader title="Sector Average ESG Scores" subtitle="From watchlist companies" />
            <div ref={chartRef} class="w-full h-80" />
            <div class="mt-2 grid grid-cols-3 gap-4">
                <For each={data}>
                    {(s) => (
                        <div class="border border-border_main/30 p-2 flex items-center justify-between">
                            <span class="text-[7px] text-text_primary truncate">{s.sector}</span>
                            <div class="flex items-center gap-2">
                                <span class="text-[8px] font-mono font-black" classList={signColor(s.average_esg_score - 50)}>
                                    {fmt(s.average_esg_score, 1)}
                                </span>
                                <span class="text-[6px] text-text_secondary/40">({s.companies_tracked})</span>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}

// ─── CONTROVERSY TABLE ────────────────────────────────────────────────────────
function ControversyTable({ data }) {
    return (
        <div class="bg-bg_header/30 border border-border_main p-4">
            <SectionHeader title={`ESG Controversy Tracker (${data.length} flagged)`} subtitle="Companies with elevated controversy scores" />
            <div class="overflow-x-auto mt-3">
                <table class="w-full text-[7px] font-mono">
                    <thead>
                        <tr class="border-b border-border_main/30 text-text_secondary/40 uppercase tracking-wider">
                            <th class="text-left py-2 px-2">Symbol</th>
                            <th class="text-left py-2 px-2">Company</th>
                            <th class="text-left py-2 px-2">Sector</th>
                            <th class="text-right py-2 px-2">Controversy Score</th>
                            <th class="text-center py-2 px-2">Level</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={data}>
                            {(item) => {
                                const badge = controversyBadge(item.controversy_level);
                                return (
                                    <tr class="border-b border-border_main/10 hover:bg-bg_main/20 transition-colors">
                                        <td class="py-2 px-2 text-text_accent font-black">{item.symbol}</td>
                                        <td class="py-2 px-2 text-text_primary">{item.company || item.symbol}</td>
                                        <td class="py-2 px-2 text-text_secondary/60">{item.sector || 'N/A'}</td>
                                        <td class="py-2 px-2 text-right font-mono">
                                            <span classList={{
                                                'text-red-400': item.controversy_score > 3,
                                                'text-amber-400': item.controversy_score > 1 && item.controversy_score <= 3,
                                                'text-emerald-400': item.controversy_score <= 1,
                                            }}>{fmt(item.controversy_score, 1)}</span>
                                        </td>
                                        <td class="py-2 px-2 text-center">
                                            <span class={`px-2 py-0.5 text-[6px] font-black tracking-widest uppercase ${badge.cls}`}>
                                                {badge.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            }}
                        </For>
                    </tbody>
                </table>
            </div>
            <div class="mt-3 text-[7px] text-text_secondary/40">
                Controversy scores range from 0 (none) to 5 (severe). Scores above 3 indicate significant ESG-related controversies requiring attention.
            </div>
        </div>
    );
}
