import { createSignal, onMount, createEffect, For, Show } from 'solid-js';
import * as echarts from 'echarts';

const VOLATILITY_API = import.meta.env.VITE_VOLATILITY_API;
const DASHBOARD_API = import.meta.env.VITE_DASHBOARD_API;
const RESEARCH_API = import.meta.env.VITE_RESEARCH_API;

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

// ─── VIX GAUGE ────────────────────────────────────────────────────────────────
function VixGauge({ value, change, prevClose }) {
    let chartEl;
    let chart;
    onMount(() => { chart = echarts.init(chartEl); });
    createEffect(() => {
        if (!chart || value == null) return;
        chart.setOption({
            backgroundColor: 'transparent',
            series: [{
                type: 'gauge',
                center: ['50%', '55%'],
                radius: '90%',
                startAngle: 220,
                endAngle: -40,
                min: 0,
                max: 80,
                splitNumber: 4,
                progress: {
                    show: true, width: 6, itemStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [
                                { offset: 0, color: '#10b981' }, { offset: 0.3, color: '#f59e0b' },
                                { offset: 0.6, color: '#f97316' }, { offset: 1, color: '#ef4444' }
                            ]
                        }
                    }
                },
                axisLine: { lineStyle: { width: 6, color: [[0.25, '#10b981'], [0.5, '#f59e0b'], [0.75, '#f97316'], [1, '#ef4444']] } },
                axisTick: { show: false },
                splitLine: { length: 6, lineStyle: { width: 1, color: '#333' } },
                axisLabel: { fontSize: 8, color: '#666', distance: 10, formatter: '{value}' },
                pointer: { width: 3, length: '65%' },
                detail: {
                    valueAnimation: true,
                    formatter: (v) => `${fmt(v, 2)}`,
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#10b981',
                    offsetCenter: [0, '40%']
                },
                data: [{ value, name: 'VIX' }],
                title: { offsetCenter: [0, '70%'], fontSize: 8, color: '#666' }
            }]
        });
    });
    return <div ref={chartEl} class="w-full h-full" />;
}

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────
export default function VolatilityIntelligenceView(props) {
    const [vixData, setVixData] = createSignal(null);
    const [vixTermStructure, setVixTermStructure] = createSignal(null);
    const [crossAssetVol, setCrossAssetVol] = createSignal(null);
    const [regime, setRegime] = createSignal(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [activeSymbol, setActiveSymbol] = createSignal('GLOBAL MARKET');
    const [searchHistory, setSearchHistory] = createSignal([]);
    
    // Search State
    const [symbol, setSymbol] = createSignal('');
    const [recommendations, setRecommendations] = createSignal([]);

    onMount(() => fetchAll());

    const fetchSuggestions = async (q) => {
        if (!q || q.trim().length < 1) {
            setRecommendations([]);
            return;
        }
        try {
            const res = await fetch(`${RESEARCH_API}/api/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            if (data.status === 'success' && data.data) {
                const filtered = (data.data || []).filter(item =>
                    ['EQUITY', 'EQUITY_STOCK', 'COMMONSTOCK', 'ETF', 'INDEX', 'CURRENCY', 'CRYPTOCURRENCY'].includes(item.quoteType?.toUpperCase()) ||
                    ['EQUITY', 'STOCK', 'ETF', 'INDEX'].includes(item.typeDisp?.toUpperCase())
                );
                setRecommendations(filtered);
            } else {
                setRecommendations([]);
            }
        } catch (e) {
            setRecommendations([]);
        }
    };

    const fetchAll = async (sym = '') => {
        setIsLoading(true);
        // Clear previous data for smooth skeleton transition
        setVixData(null);
        setVixTermStructure(null);
        setCrossAssetVol(null);
        setRegime(null);
        
        try {
            const query = sym ? `?symbol=${sym}` : '';
            const resp = await fetch(`${DASHBOARD_API}/api/dashboard/volatility${query}`);
            const json = await resp.json();
            if (json.status === 'success' && json.data) {
                // Normalize VIX Data
                const v = json.data.vix?.data;
                if (v) {
                    setVixData({
                        value: v.current?.vix,
                        change: v.current?.change,
                        prev_close: v.current?.prev_close,
                        high_52w: v.statistics?.['1y_max'],
                        low_52w: v.statistics?.['1y_min'],
                        percentile: v.statistics?.percentile_rank,
                        last_updated: v.last_updated,
                        z_score: v.statistics?.z_score // Fallback or included if backend provides it
                    });
                }

                // Normalize Term Structure
                const vt = json.data.vix_term?.data;
                if (vt?.curve) {
                    setVixTermStructure(vt.curve.map(d => ({
                        month: d.label?.toUpperCase() || d.name,
                        current: d.price,
                        prev: d.price
                    })));
                }

                // Normalize Cross-Asset Vol
                const ca = json.data.cross_asset?.data;
                if (ca?.assets) {
                    const crossObj = {};
                    ca.assets.forEach(a => {
                        crossObj[a.asset] = {
                            realized_vol: a.realized_vol_21d,
                            change: (a.vol_change_ratio - 1) * 100,
                            implied_vol: a.realized_vol_63d,
                            iv_rv_ratio: a.vol_change_ratio
                        };
                    });
                    setCrossAssetVol(crossObj);
                }

                // Normalize Regime
                const r = json.data.regime?.data;
                if (r) {
                    setRegime({
                        ...r,
                        current: r.current_regime,
                        history: r.history || (v?.history || []).map(h => ({
                            date: h.date,
                            score: h.vix,
                            regime: h.vix > 30 ? 'EXTREME_FEAR' : h.vix > 20 ? 'FEAR' : h.vix > 15 ? 'NEUTRAL' : 'COMPLACENCY'
                        }))
                    });
                }

                // Add to history
                const currentSym = sym || 'GLOBAL MARKET';
                setSearchHistory(prev => {
                    const filtered = prev.filter(p => p.symbol !== currentSym);
                    return [{
                        symbol: currentSym,
                        vix: v ? {
                            value: v.current?.vix,
                            change: v.current?.change,
                            high_52w: v.statistics?.['1y_max'],
                            low_52w: v.statistics?.['1y_min']
                        } : null,
                        regime: r ? { current: r.current_regime } : null,
                        history: r?.history || v?.history || [],
                        termStructure: vt?.curve || []
                    }, ...filtered].slice(0, 5); // Keep last 5
                });
            }
        } catch (e) {
            console.error('Volatility fetch failed, trying direct API...', e);
            try {
                const resp = await fetch(`${VOLATILITY_API}/api/volatility/summary`);
                const json = await resp.json();
                if (json.status === 'success') {
                    setVixData(json.data.vix);
                    setVixTermStructure(json.data.term_structure);
                    setCrossAssetVol(json.data.cross_asset);
                    setRegime(json.data.regime);
                    
                    // Add global market to history on fallback success
                    setSearchHistory(prev => {
                        const existing = prev.filter(p => p.symbol !== 'GLOBAL MARKET');
                        return [{
                            symbol: 'GLOBAL MARKET',
                            vix: json.data.vix ? {
                                value: json.data.vix.value,
                                change: json.data.vix.change,
                                high_52w: json.data.vix.high_52w,
                                low_52w: json.data.vix.low_52w
                            } : null,
                            regime: json.data.regime ? { current: json.data.regime.current } : null,
                            history: json.data.regime?.history || json.data.vix?.history || [],
                            termStructure: json.data.term_structure || []
                        }, ...existing].slice(0, 5);
                    });
                }
            } catch (e2) { console.error('Direct vol API failed:', e2); }
        } finally {
            setIsLoading(false);
        }
    };

    const removeHistory = (sym) => {
        setSearchHistory(prev => prev.filter(p => p.symbol !== sym));
    };

    // Regime color mapping
    const regimeColor = (r) => {
        const map = { 'EXTREME_FEAR': 'text-red-500', 'FEAR': 'text-orange-500', 'NEUTRAL': 'text-amber-500', 'NORMAL': 'text-amber-500', 'COMPLACENCY': 'text-emerald-500', 'EXTREME_COMPLACENCY': 'text-green-400' };
        return map[r] || 'text-text_secondary';
    };
    const regimeBg = (r) => {
        const map = { 'EXTREME_FEAR': 'bg-red-500/10', 'FEAR': 'bg-orange-500/10', 'NEUTRAL': 'bg-amber-500/10', 'NORMAL': 'bg-amber-500/10', 'COMPLACENCY': 'bg-emerald-500/10', 'EXTREME_COMPLACENCY': 'bg-green-500/10' };
        return map[r] || 'bg-gray-500/10';
    };

    const getDisplayName = () => activeSymbol() === 'GLOBAL MARKET' ? 'VIX' : activeSymbol();

    return (
        <div class="flex flex-col h-full bg-bg_main">
            {/* Header */}
            <div class="h-8 border-b border-border_main bg-bg_header/50 flex items-center justify-between px-4 shrink-0">
                <div class="flex items-center gap-3">
                    <span class="text-[10px] font-black tracking-widest text-text_primary uppercase flex items-center gap-2">
                        <div class="w-1.5 h-1.5 bg-text_accent shadow-[0_0_8px_var(--text-accent)]" />
                        VOLATILITY: <span class="text-text_accent ml-1">{activeSymbol()}</span>
                    </span>
                    <Show when={isLoading()}>
                        <span class="text-[8px] text-text_accent animate-pulse font-mono ml-2">LIVE FEED SYNC...</span>
                    </Show>

                    <div class="relative w-48 ml-4">
                        <input
                            type="text"
                            class="w-full bg-black/50 border border-border_main px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-text_accent uppercase"
                            placeholder="SEARCH ENTITY (E.G., AAPL)"
                            value={symbol()}
                            onInput={(e) => setSymbol(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    fetchSuggestions(symbol());
                                }
                            }}
                            disabled={isLoading()}
                        />
                        <Show when={recommendations().length > 0}>
                            <div class="absolute z-50 bg-bg_sidebar border border-border_main w-full max-h-48 overflow-y-auto mt-1 flex flex-col shadow-2xl win-scroll">
                                <For each={recommendations()}>
                                    {(rec) => (
                                        <button
                                            type="button"
                                            class="text-left px-2 py-1.5 text-[8px] hover:bg-text_accent hover:text-bg_main font-mono border-b border-border_main/30 text-white transition-colors flex flex-col gap-0.5"
                                            onClick={() => {
                                                setSymbol(rec.symbol);
                                                setActiveSymbol(rec.symbol);
                                                setRecommendations([]);
                                                fetchAll(rec.symbol);
                                            }}
                                        >
                                            <div class="flex items-center justify-between">
                                                <span class="font-black text-text_accent uppercase">{rec.symbol}</span>
                                            </div>
                                            <div class="text-[7px] font-bold text-white/70 truncate uppercase">{rec.shortname || rec.longname || rec.name}</div>
                                        </button>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </div>
                </div>
                <Show when={regime()}>
                    {(r) => (
                        <div class={`flex items-center gap-1.5 px-2 py-0.5 ${regimeBg(r().current)} border border-current/20 rounded-sm`}>
                            <span class={`text-[8px] font-black ${regimeColor(r().current)} tracking-widest`}>{r().current?.replace(/_/g, ' ')}</span>
                        </div>
                    )}
                </Show>
            </div>

            {/* Main Content */}
            <div class="flex-1 overflow-y-auto win-scroll p-2">
                <div class="flex flex-col gap-2">
                    {/* ROW 0: History Watchlist */}
                    <Show when={searchHistory().length > 0}>
                        <div class="bg-bg_header/30 border border-border_main flex flex-col">
                            <SectionHeader title="ENTITY WATCHLIST" subtitle="RECENTLY ANALYZED" />
                            <div class="p-1 overflow-x-auto win-scroll">
                                <table class="w-full text-left border-collapse">
                                    <thead>
                                        <tr class="border-b border-border_main/50 text-[8px] text-text_secondary uppercase">
                                            <th class="p-1.5 font-black">Entity</th>
                                            <th class="p-1.5 font-black text-right">Vol Level</th>
                                            <th class="p-1.5 font-black text-right">Change</th>
                                            <th class="p-1.5 font-black text-right">52W High</th>
                                            <th class="p-1.5 font-black text-right">52W Low</th>
                                            <th class="p-1.5 font-black text-center">Regime</th>
                                            <th class="p-1.5 font-black text-center w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={searchHistory()}>
                                            {(item) => (
                                                <tr 
                                                    class={`border-b border-border_main/20 hover:bg-white/5 transition-colors cursor-pointer group ${activeSymbol() === item.symbol ? 'bg-text_accent/10' : ''}`} 
                                                    onClick={() => { 
                                                        if(activeSymbol() !== item.symbol) {
                                                            setActiveSymbol(item.symbol); 
                                                            fetchAll(item.symbol === 'GLOBAL MARKET' ? '' : item.symbol); 
                                                        }
                                                    }}
                                                >
                                                    <td class="p-1.5 text-[10px] font-bold text-text_accent flex items-center gap-2">
                                                        {activeSymbol() === item.symbol && <div class="w-1 h-1 rounded-full bg-text_accent"></div>}
                                                        {item.symbol}
                                                    </td>
                                                    <td class="p-1.5 text-[9px] font-mono text-right font-black">{fmt(item.vix?.value)}</td>
                                                    <td class={`p-1.5 text-[9px] font-mono text-right font-bold ${item.vix?.change >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmtPct(item.vix?.change)}</td>
                                                    <td class="p-1.5 text-[9px] font-mono text-right text-text_secondary">{fmt(item.vix?.high_52w)}</td>
                                                    <td class="p-1.5 text-[9px] font-mono text-right text-text_secondary">{fmt(item.vix?.low_52w)}</td>
                                                    <td class="p-1.5 text-center">
                                                        <span class={`text-[8px] font-black tracking-wider px-1 py-0.5 rounded-sm ${regimeBg(item.regime?.current)} ${regimeColor(item.regime?.current)}`}>
                                                            {item.regime?.current?.replace(/_/g, ' ') || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td class="p-1.5 text-center">
                                                        <button 
                                                            class="text-[9px] text-text_secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" 
                                                            onClick={(e) => { e.stopPropagation(); removeHistory(item.symbol); }}
                                                            title="Remove from history"
                                                        >✕</button>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Show>

                    {/* ROW 1: Core Stats & Regime */}
                    <div class="grid grid-cols-12 gap-2">
                        {/* VIX GAUGE */}
                        <div class="col-span-12 xl:col-span-3 bg-bg_header/30 border border-border_main flex flex-col h-[220px]">
                            <SectionHeader title={`${getDisplayName()} FEAR GAUGE`} subtitle={vixData()?.last_updated ? new Date(vixData().last_updated * 1000).toLocaleTimeString() : ''} />
                            <div class="flex-1 p-1">
                                <Show when={vixData()?.value != null} fallback={<LoadingSkeleton rows={4} />}>
                                    <VixGauge value={vixData()?.value} change={vixData()?.change} prevClose={vixData()?.prev_close} />
                                </Show>
                            </div>
                        </div>

                        {/* VIX STATS */}
                        <div class="col-span-12 xl:col-span-4 bg-bg_header/30 border border-border_main flex flex-col h-[220px]">
                            <SectionHeader title={`${getDisplayName()} STATISTICS`} />
                            <div class="p-2 grid grid-cols-3 gap-2 flex-1 content-start">
                                <Show when={vixData()} fallback={<LoadingSkeleton rows={3} />}>
                                    <StatBox label="Current" value={fmt(vixData()?.value, 2)} color="text-text_accent" sub={fmtPct(vixData()?.change)} subColor={vixData()?.change >= 0 ? 'text-red-500' : 'text-emerald-500'} />
                                    <StatBox label="Prev Close" value={fmt(vixData()?.prev_close, 2)} color="text-text_primary" />
                                    <StatBox label="Percentile" value={`${fmt(vixData()?.percentile || 0, 0)}%`} color="text-amber-500" />
                                    <StatBox label="52W High" value={fmt(vixData()?.high_52w, 2)} color="text-red-500" sub={vixData()?.high_52w_date} subColor="text-text_secondary/40" />
                                    <StatBox label="52W Low" value={fmt(vixData()?.low_52w, 2)} color="text-emerald-500" sub={vixData()?.low_52w_date} subColor="text-text_secondary/40" />
                                    <StatBox label="Z-Score" value={fmt(vixData()?.z_score || 0, 2)} color={Math.abs(vixData()?.z_score || 0) > 2 ? 'text-red-500' : 'text-text_accent'} />
                                </Show>
                            </div>
                        </div>

                        {/* REGIME DETECTION */}
                        <div class="col-span-12 xl:col-span-3 bg-bg_header/30 border border-border_main flex flex-col h-[220px]">
                            <SectionHeader title="REGIME DETECTION" />
                            <div class="flex-1 p-2 space-y-2 overflow-y-auto win-scroll">
                                <Show when={regime()} fallback={<LoadingSkeleton rows={4} />}>
                                    <For each={Object.entries(regime() || {}).filter(([k]) => typeof regime()[k] === 'string' || typeof regime()[k] === 'number')}>
                                        {([key, val]) => (
                                            <div class="flex items-center justify-between py-1.5 border-b border-border_main/10">
                                                <span class="text-[8px] font-bold text-text_primary/70 uppercase">{key.replace(/_/g, ' ')}</span>
                                                <span class={`text-[9px] font-black font-mono ${typeof val === 'string' ? regimeColor(val) : 'text-text_accent'}`}>
                                                    {typeof val === 'number' ? fmt(val, 2) : val?.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        )}
                                    </For>
                                </Show>
                            </div>
                        </div>

                        {/* INTERPRETATION */}
                        <div class="col-span-12 xl:col-span-2 bg-bg_header/30 border border-border_main flex flex-col h-[220px]">
                            <SectionHeader title="INTERPRETATION" />
                            <div class="flex-1 p-3 flex flex-col justify-center">
                                <Show when={vixData()?.value != null} fallback={<LoadingSkeleton rows={2} />}>
                                    <div class="text-[9px] text-text_primary/80 leading-relaxed font-mono">
                                        {vixData()?.value < 12 ? '⬆ COMPLACENCY — Markets pricing minimal risk. Historically precedes volatility spikes.' :
                                            vixData()?.value < 16 ? '➡ NORMAL — Steady state. Standard hedging environment.' :
                                                vixData()?.value < 20 ? '⬆ ELEVATED — Above-average uncertainty. Risk-off positioning increasing.' :
                                                    vixData()?.value < 25 ? '⬆ HIGH — Significant fear. Crisis hedging recommended.' :
                                                        vixData()?.value < 35 ? '⬆ VERY HIGH — Panic levels. Historically associated with corrections.' :
                                                            '⬆ EXTREME — Systemic stress. Massive capitulation or black-swan event.'}
                                    </div>
                                </Show>
                            </div>
                        </div>
                    </div>

                    {/* ROW 2: Structure & History */}
                    <div class="grid grid-cols-12 gap-2">
                        {/* TERM STRUCTURE */}
                        <div class="col-span-12 xl:col-span-6 bg-bg_header/30 border border-border_main flex flex-col h-[260px]">
                            <SectionHeader title="FUTURES TERM STRUCTURE" subtitle="CONTANGO / BACKWARDATION" />
                            <div class="flex-1 p-1">
                                <Show when={vixTermStructure()} fallback={<LoadingSkeleton rows={4} />}>
                                    {(() => {
                                        let chartEl;
                                        let chart;
                                        onMount(() => { chart = echarts.init(chartEl); });
                                        createEffect(() => {
                                            if (!chart || !vixTermStructure()) return;
                                            const ts = Array.isArray(vixTermStructure()) ? vixTermStructure() : [];
                                            const months = ts.map(d => d.month);
                                            const current = ts.map(d => d.current);
                                            const prev = ts.map(d => d.prev);
                                            const isContango = ts.length > 0 && ts[ts.length - 1]?.current > ts[0]?.current;

                                            const series = [
                                                { name: `${getDisplayName()} Current`, type: 'line', data: current, smooth: true, symbol: 'diamond', symbolSize: 6, lineStyle: { color: isContango ? '#f59e0b' : '#10b981', width: 2 }, areaStyle: { color: isContango ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)' } },
                                                { name: `${getDisplayName()} Prev`, type: 'line', data: prev, smooth: true, symbol: 'circle', symbolSize: 4, lineStyle: { color: '#6b7280', width: 1, type: 'dashed' } }
                                            ];

                                            searchHistory().forEach((item, idx) => {
                                                if (item.symbol !== activeSymbol() && item.termStructure && item.termStructure.length > 0) {
                                                    const color = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316'][idx % 4];
                                                    series.push({
                                                        name: item.symbol, type: 'line', data: item.termStructure.map(d => d.price || d.current),
                                                        smooth: true, symbol: 'circle', symbolSize: 4, lineStyle: { color, width: 1, type: 'dashed' }
                                                    });
                                                }
                                            });

                                            chart.setOption({
                                                backgroundColor: 'transparent',
                                                tooltip: { trigger: 'axis', textStyle: { fontSize: 9 } },
                                                legend: { textStyle: { fontSize: 8, color: '#999' }, top: 0, right: 10 },
                                                grid: { top: 25, bottom: 20, left: 40, right: 10 },
                                                xAxis: { type: 'category', data: months, axisLabel: { fontSize: 8, color: '#666' } },
                                                yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { fontSize: 8, color: '#666' } },
                                                series,
                                                graphic: [{ type: 'text', left: 'center', top: 5, style: { text: isContango ? '🟡 CONTANGO' : '🟢 BACKWARDATION', fontSize: 9, fontWeight: 'bold', fill: isContango ? '#f59e0b' : '#10b981' } }]
                                            }, true);
                                        });
                                        return <div ref={chartEl} class="w-full h-full" />;
                                    })()}
                                </Show>
                            </div>
                        </div>

                        {/* REGIME HISTORY */}
                        <div class="col-span-12 xl:col-span-6 bg-bg_header/30 border border-border_main flex flex-col h-[260px]">
                            <SectionHeader title="REGIME HISTORY" subtitle="RECENT TRANSITIONS" />
                            <div class="flex-1 p-1">
                                <Show when={regime()?.history} fallback={<LoadingSkeleton rows={4} />}>
                                    {(() => {
                                        let chartEl;
                                        let chart;
                                        onMount(() => { chart = echarts.init(chartEl); });
                                        createEffect(() => {
                                            if (!chart || !regime()?.history) return;
                                            
                                            const series = [];
                                            searchHistory().forEach((item, idx) => {
                                                const hData = item.history || [];
                                                if (hData.length > 0) {
                                                    const isActive = item.symbol === activeSymbol();
                                                    const color = isActive ? '#10b981' : ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316'][idx % 4];
                                                    const s = {
                                                        name: item.symbol, type: 'line', data: hData.map(d => [d.date, d.score || d.vix]),
                                                        smooth: true, symbol: 'none', lineStyle: { width: isActive ? 2 : 1.5, color, type: isActive ? 'solid' : 'dashed' }
                                                    };
                                                    if (isActive) {
                                                        s.areaStyle = { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16,185,129,0.2)' }, { offset: 1, color: 'rgba(16,185,129,0.01)' }] } };
                                                        s.markPoint = {
                                                            data: hData.filter(d => d.regime === 'EXTREME_FEAR' || d.regime === 'EXTREME_COMPLACENCY').map(d => ({
                                                                coord: [d.date, d.score || d.vix], symbol: 'pin', symbolSize: 20,
                                                                itemStyle: { color: d.regime === 'EXTREME_FEAR' ? '#ef4444' : '#34d399' },
                                                                label: { fontSize: 8, formatter: d.regime === 'EXTREME_FEAR' ? '!' : '✓' }
                                                            }))
                                                        };
                                                    }
                                                    series.push(s);
                                                }
                                            });

                                            chart.setOption({
                                                backgroundColor: 'transparent',
                                                tooltip: { trigger: 'axis', textStyle: { fontSize: 9 } },
                                                grid: { top: 20, bottom: 20, left: 40, right: 10 },
                                                xAxis: { type: 'time', axisLabel: { fontSize: 8, color: '#666' } },
                                                yAxis: { type: 'value', max: 100, splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { fontSize: 8, color: '#666' } },
                                                series
                                            }, true);
                                        });
                                        return <div ref={chartEl} class="w-full h-full" />;
                                    })()}
                                </Show>
                            </div>
                        </div>
                    </div>

                    {/* ROW 3: Cross Asset */}
                    <div class="grid grid-cols-12 gap-2">
                        {/* MATRIX */}
                        <div class="col-span-12 xl:col-span-8 bg-bg_header/30 border border-border_main flex flex-col h-[280px]">
                            <SectionHeader title="CROSS-ASSET VOLATILITY MATRIX" subtitle="20D REALIZED VOL" />
                            <div class="flex-1 p-1">
                                <Show when={crossAssetVol()} fallback={<LoadingSkeleton rows={5} />}>
                                    {(() => {
                                        let chartEl;
                                        let chart;
                                        onMount(() => { chart = echarts.init(chartEl); });
                                        createEffect(() => {
                                            if (!chart || !crossAssetVol()) return;
                                            
                                            // Merge searched entities
                                            const mergedAssets = { ...(crossAssetVol() || {}) };
                                            searchHistory().forEach(item => {
                                                if (item.symbol !== 'GLOBAL MARKET' && item.vix?.value) {
                                                    mergedAssets[item.symbol] = {
                                                        realized_vol: item.vix.value,
                                                        change: item.vix.change,
                                                        implied_vol: item.vix.value,
                                                        iv_rv_ratio: 1
                                                    };
                                                }
                                            });
                                            
                                            const assets = Object.keys(mergedAssets);
                                            const vols = assets.map(k => mergedAssets[k]?.realized_vol || 0);
                                            const changes = assets.map(k => mergedAssets[k]?.change || 0);
                                            
                                            chart.setOption({
                                                backgroundColor: 'transparent',
                                                tooltip: { trigger: 'axis', textStyle: { fontSize: 9 }, formatter: (params) => {
                                                    const a = assets[params[0].dataIndex];
                                                    const d = mergedAssets[a];
                                                    return `<b>${a}</b><br/>Vol: ${fmt(d.realized_vol, 1)}%<br/>Chg: ${fmtPct(d.change)}`;
                                                } },
                                                grid: { top: 20, bottom: 25, left: 40, right: 10 },
                                                xAxis: { type: 'category', data: assets, axisLabel: { fontSize: 8, color: '#666', interval: 0, rotate: 0 } },
                                                yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { fontSize: 8, color: '#666' } },
                                                series: [{
                                                    type: 'bar', data: assets.map((a, i) => ({ 
                                                        value: vols[i], 
                                                        itemStyle: { 
                                                            color: a === activeSymbol() ? '#3b82f6' : (changes[i] >= 0 ? '#ef4444' : '#10b981'), 
                                                            borderRadius: [2, 2, 0, 0] 
                                                        } 
                                                    })),
                                                    barWidth: '40%', label: { show: true, position: 'top', fontSize: 7, color: '#999', formatter: '{c}%' },
                                                    markLine: { silent: true, data: [{ type: 'average' }], lineStyle: { color: '#555', type: 'dashed' }, label: { formatter: 'AVG', fontSize: 7 } }
                                                }]
                                            }, true);
                                        });
                                        return <div ref={chartEl} class="w-full h-full" />;
                                    })()}
                                </Show>
                            </div>
                        </div>

                        {/* SCATTER */}
                        <div class="col-span-12 xl:col-span-4 bg-bg_header/30 border border-border_main flex flex-col h-[280px]">
                            <SectionHeader title="VOLATILITY SCATTER" subtitle="CHANGE vs LEVEL" />
                            <div class="flex-1 p-1">
                                <Show when={crossAssetVol()} fallback={<LoadingSkeleton rows={5} />}>
                                    {(() => {
                                        let chartEl;
                                        let chart;
                                        onMount(() => { chart = echarts.init(chartEl); });
                                        createEffect(() => {
                                            if (!chart || !crossAssetVol()) return;
                                            
                                            // Merge searched entities
                                            const mergedAssets = { ...(crossAssetVol() || {}) };
                                            searchHistory().forEach(item => {
                                                if (item.symbol !== 'GLOBAL MARKET' && item.vix?.value) {
                                                    mergedAssets[item.symbol] = {
                                                        realized_vol: item.vix.value,
                                                        change: item.vix.change,
                                                        implied_vol: item.vix.value,
                                                        iv_rv_ratio: 1
                                                    };
                                                }
                                            });
                                            
                                            const assets = Object.keys(mergedAssets);
                                            const data = assets.map(a => ({ value: [mergedAssets[a]?.realized_vol || 0, mergedAssets[a]?.change || 0, mergedAssets[a]?.implied_vol || 0], name: a }));
                                            
                                            chart.setOption({
                                                backgroundColor: 'transparent',
                                                tooltip: { trigger: 'item', textStyle: { fontSize: 9 }, formatter: (p) => `<b>${p.data.name}</b><br/>Vol: ${fmt(p.data.value[0], 1)}%<br/>Δ: ${fmtPct(p.data.value[1])}` },
                                                grid: { top: 20, bottom: 25, left: 40, right: 20 },
                                                xAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { fontSize: 8, color: '#666' } },
                                                yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { fontSize: 8, color: '#666' } },
                                                series: [{
                                                    type: 'scatter', symbolSize: (d) => d.name === activeSymbol() ? 15 : 10,
                                                    data: data.map(d => ({ 
                                                        ...d, 
                                                        itemStyle: { 
                                                            color: d.name === activeSymbol() ? '#3b82f6' : (d.value[1] >= 0 ? '#ef4444' : '#10b981'), 
                                                            opacity: d.name === activeSymbol() ? 1 : 0.8 
                                                        } 
                                                    })),
                                                    label: { show: true, formatter: (p) => p.data.name, fontSize: 8, color: '#ccc', position: 'right' },
                                                    markLine: { silent: true, data: [{ yAxis: 0 }], lineStyle: { color: '#555', type: 'dashed', width: 1 } }
                                                }]
                                            }, true);
                                        });
                                        return <div ref={chartEl} class="w-full h-full" />;
                                    })()}
                                </Show>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatBox({ label, value, color = 'text-text_accent', sub, subColor = 'text-text_secondary/40' }) {
    return (
        <div class="bg-bg_main/20 border border-border_main/30 p-2 flex flex-col justify-center">
            <span class="text-[7px] font-black text-text_secondary/60 uppercase tracking-widest mb-0.5">{label}</span>
            <div class="flex items-baseline gap-1">
                <span class={`text-[12px] font-black font-mono ${color}`}>{value}</span>
                {sub && <span class={`text-[7px] font-bold ${subColor}`}>{sub}</span>}
            </div>
        </div>
    );
}
