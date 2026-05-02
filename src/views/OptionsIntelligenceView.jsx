import { createSignal, onMount, createEffect, For, Show } from 'solid-js';
import * as echarts from 'echarts';

const OPTIONS_API = import.meta.env.VITE_OPTIONS_API;
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

// ─── P/C RATIO GAUGE ──────────────────────────────────────────────────────────
function PCRatioGauge({ value, change }) {
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
                radius: '80%',
                startAngle: 220, endAngle: -40,
                min: 0, max: 3,
                splitNumber: 3,
                progress: { show: true, width: 8 },
                axisLine: {
                    lineStyle: {
                        width: 8, color: [
                            [0.25, '#10b981'], [0.5, '#f59e0b'], [0.75, '#f97316'], [1, '#ef4444']
                        ]
                    }
                },
                axisTick: { show: false },
                splitLine: { length: 6, lineStyle: { width: 1, color: '#333' } },
                axisLabel: { fontSize: 8, color: '#666', distance: 10 },
                pointer: { width: 3, length: '65%' },
                detail: { valueAnimation: true, formatter: (v) => fmt(v, 2), fontSize: 16, fontWeight: 'bold', color: '#f59e0b', offsetCenter: [0, '40%'] },
                data: [{ value, name: 'P/C Ratio' }],
                title: { offsetCenter: [0, '70%'], fontSize: 8, color: '#666' }
            }]
        });
    });
    return <div ref={chartEl} class="w-full h-full" />;
}

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────
export default function OptionsIntelligenceView(props) {
    const [optionsData, setOptionsData] = createSignal(null);
    const [putCallRatio, setPutCallRatio] = createSignal(null);
    const [maxPain, setMaxPain] = createSignal(null);
    const [ivRank, setIvRank] = createSignal([]);
    const [unusualActivity, setUnusualActivity] = createSignal([]);
    const [optionsSignals, setOptionsSignals] = createSignal([]);
    const [selectedSymbol, setSelectedSymbol] = createSignal('SPY');
    const [isLoading, setIsLoading] = createSignal(true);

    const WATCH_SYMBOLS = ['SPY', 'QQQ', 'IWM', 'AAPL', 'TSLA', 'NVDA', 'AMZN', 'MSFT', 'GOOGL', 'META', 'AMD', 'PLTR'];

    onMount(() => fetchAll());

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const resp = await fetch(`${DASHBOARD_API}/api/dashboard/options`);
            const json = await resp.json();
            if (json.status === 'success' && json.data) {
                const pcr = json.data.put_call_ratio?.data;
                const mp = json.data.max_pain?.data;
                const summary = json.data.summary?.data;
                
                setOptionsData(json.data);
                setOptionsSignals(summary?.signals || []);
                
                // Map to UI expectations
                setPutCallRatio({
                    total: pcr?.market_pcr_oi || summary?.put_call_ratio?.market_pcr_oi,
                    sentiment: pcr?.sentiment || summary?.put_call_ratio?.sentiment,
                    call_volume: pcr?.aggregate?.total_call_oi || summary?.put_call_ratio?.aggregate?.total_call_oi,
                    put_volume: pcr?.aggregate?.total_put_oi || summary?.put_call_ratio?.aggregate?.total_put_oi,
                    tickers: pcr?.tickers || summary?.put_call_ratio?.tickers || [],
                    history: summary?.put_call_ratio?.history || [],
                    breakdown: (pcr?.tickers || summary?.put_call_ratio?.tickers || []).map(t => ({
                        name: t.symbol,
                        call_vol: t.call_volume || t.call_open_interest,
                        put_vol: t.put_volume || t.put_open_interest,
                        ratio: t.pcr_vol || t.pcr_oi
                    }))
                });
                
                setMaxPain({
                    tickers: mp?.tickers || summary?.max_pain?.tickers || [],
                    // Keep existing symbol detail if available
                    ...(maxPain()?.strikes ? { strikes: maxPain().strikes } : {}),
                    ...((mp?.tickers || summary?.max_pain?.tickers || []).find(t => t.symbol === selectedSymbol()))
                });

                setIvRank(summary?.iv_rank || []);
                setUnusualActivity(summary?.unusual_activity || []);
            }
        } catch (e) {
            console.error('Options fetch failed, trying direct API...', e);
            try {
                const resp = await fetch(`${OPTIONS_API}/api/options/summary`);
                const json = await resp.json();
                if (json.status === 'success') {
                    setOptionsData(json.data);
                    setPutCallRatio(json.data.put_call_ratio);
                    setMaxPain(json.data.max_pain);
                    setIvRank(json.data.iv_rank || []);
                    setUnusualActivity(json.data.unusual_activity || []);
                }
            } catch (e2) { console.error('Direct options API failed:', e2); }
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSymbolDetail = async (symbol) => {
        setSelectedSymbol(symbol);
        try {
            const resp = await fetch(`${DASHBOARD_API}/api/dashboard/options?symbol=${symbol}`);
            const json = await resp.json();
            if (json.status === 'success' && json.data) {
                // The response might be the same structure as the summary but for one ticker, 
                // or have a specific 'options_chain' field.
                // We'll normalize it into maxPain strikes if available.
                const pcr = json.data.put_call_ratio?.data;
                const mp = json.data.max_pain?.data;
                const summary = json.data.summary?.data;
                
                setMaxPain(prev => ({
                    ...prev,
                    tickers: mp?.tickers || summary?.max_pain?.tickers || prev.tickers || [],
                    ...(json.data.options_chain || json.data.chain || {}),
                    ...(mp?.tickers?.find(t => t.symbol === symbol) || summary?.max_pain?.tickers?.find(t => t.symbol === symbol) || {}),
                    symbol: symbol
                }));

                // Update PCR if ticker specific data returned
                if (pcr?.tickers?.length > 0) {
                    const tData = pcr.tickers.find(t => t.symbol === symbol);
                    if (tData) {
                        setPutCallRatio(prev => ({
                            ...prev,
                            // If we want to highlight this specific ticker in the gauge
                            total: tData.pcr_vol || tData.pcr_oi,
                        }));
                    }
                }
            }
        } catch (e) { console.error(`Failed to fetch ${symbol} detail:`, e); }
    };

    const getSentimentColor = (s) => {
        if (!s) return 'text-text_secondary';
        if (s.includes('BULLISH')) return 'text-emerald-400';
        if (s.includes('BEARISH')) return 'text-red-400';
        return 'text-amber-400';
    };

    return (
        <div class="flex flex-col h-full bg-bg_main overflow-hidden">
            {/* Header / Global Controls */}
            <div class="h-10 border-b border-border_main bg-bg_header/50 flex items-center justify-between px-4 shrink-0">
                <div class="flex items-center gap-2">
                    <div class="w-2 h-2 bg-text_accent animate-pulse" />
                    <span class="text-[10px] font-black tracking-widest text-text_primary uppercase font-mono">OPTIONS INTELLIGENCE TERMINAL</span>
                    <span class="text-[7px] text-text_secondary/40 font-black uppercase ml-4">INSTITUTIONAL FEED // REAL-TIME GREEKS</span>
                </div>
                
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <span class="text-[7px] text-text_secondary/40 font-black uppercase tracking-widest">Focus:</span>
                        <select
                            value={selectedSymbol()}
                            onChange={(e) => fetchSymbolDetail(e.target.value)}
                            class="bg-bg_header border border-border_main text-[9px] font-black text-text_accent px-2 py-1 uppercase outline-none focus:border-text_accent transition-colors"
                        >
                            <For each={WATCH_SYMBOLS}>
                                {(s) => <option value={s}>{s}</option>}
                            </For>
                        </select>
                    </div>
                    <button 
                        onClick={fetchAll} 
                        class="flex items-center gap-2 px-3 py-1 bg-text_accent/10 border border-text_accent/30 text-[8px] font-black text-text_accent hover:bg-text_accent/20 transition-all uppercase tracking-widest"
                    >
                        <svg class={`w-2.5 h-2.5 ${isLoading() ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* Consolidated Dashboard Grid */}
            <div class="flex-1 overflow-y-auto win-scroll p-4 space-y-4">
                
                {/* ─── ROW 1: CORE SENTIMENT & SIGNALS ──────────────────────────── */}
                <div class="grid grid-cols-12 gap-4">
                    <div class="col-span-12 xl:col-span-3 bg-bg_header/30 border border-border_main flex flex-col h-[300px]">
                        <SectionHeader title="PCR GAUGE" subtitle="MARKET PCR OI" />
                        <div class="flex-1 p-2">
                            <Show when={putCallRatio()?.total != null} fallback={<LoadingSkeleton rows={4} />}>
                                <PCRatioGauge value={putCallRatio()?.total} change={putCallRatio()?.change} />
                            </Show>
                        </div>
                        <div class="p-2 bg-black/20 border-t border-border_main grid grid-cols-2 gap-2">
                            <div class="text-center">
                                <div class="text-[6px] font-black text-emerald-500 uppercase">CALL OI</div>
                                <div class="text-[10px] font-black font-mono text-text_primary">{fmt(putCallRatio()?.call_volume || 0, 0)}</div>
                            </div>
                            <div class="text-center">
                                <div class="text-[6px] font-black text-red-500 uppercase">PUT OI</div>
                                <div class="text-[10px] font-black font-mono text-text_primary">{fmt(putCallRatio()?.put_volume || 0, 0)}</div>
                            </div>
                        </div>
                    </div>

                    <div class="col-span-12 xl:col-span-6 bg-bg_header/30 border border-border_main flex flex-col h-[300px]">
                        <SectionHeader title="PCR TREND HISTORY" subtitle="DAILY RATIO FLOW" />
                        <div class="flex-1 p-2">
                            <Show when={putCallRatio()?.history?.length > 0} fallback={<LoadingSkeleton rows={6} />}>
                                {(() => {
                                    let chartEl;
                                    let chart;
                                    onMount(() => { chart = echarts.init(chartEl); });
                                    createEffect(() => {
                                        if (!chart || !putCallRatio()?.history) return;
                                        const hist = putCallRatio().history;
                                        chart.setOption({
                                            backgroundColor: 'transparent',
                                            tooltip: { trigger: 'axis', textStyle: { fontSize: 9 } },
                                            grid: { top: 20, bottom: 20, left: 45, right: 15 },
                                            xAxis: { type: 'time', axisLabel: { fontSize: 8, color: '#666' } },
                                            yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { fontSize: 8, color: '#666' } },
                                            series: [{
                                                type: 'line', data: hist.map(d => [d.date, d.ratio]), smooth: true,
                                                symbol: 'none', lineStyle: { width: 2, color: '#f59e0b' },
                                                areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(245,158,11,0.2)' }, { offset: 1, color: 'rgba(245,158,11,0.02)' }] } }
                                            }]
                                        });
                                    });
                                    return <div ref={chartEl} class="w-full h-full" />;
                                })()}
                            </Show>
                        </div>
                    </div>

                    <div class="col-span-12 xl:col-span-3 bg-bg_header/30 border border-border_main flex flex-col h-[300px]">
                        <SectionHeader title="MARKET SIGNALS" subtitle="AI SYNTHESIS" />
                        <div class="flex-1 p-3 space-y-2 overflow-y-auto win-scroll">
                            <Show when={optionsSignals().length > 0} fallback={<div class="h-full flex items-center justify-center text-[8px] text-text_secondary/40 uppercase font-mono tracking-widest">NO ACTIVE SIGNALS</div>}>
                                <For each={optionsSignals()}>
                                    {(sig) => (
                                        <div class={`border-l-2 p-2 bg-white/5 flex flex-col gap-1 ${sig.severity === 'HIGH' ? 'border-red-500' : 'border-amber-500'}`}>
                                            <div class="flex items-center justify-between">
                                                <span class="text-[8px] font-black text-text_primary uppercase">{sig.signal?.replace(/_/g, ' ')}</span>
                                                <span class={`text-[6px] font-black px-1 py-0.5 rounded-sm ${sig.severity === 'HIGH' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>{sig.severity}</span>
                                            </div>
                                            <p class="text-[8px] text-text_secondary leading-tight line-clamp-2">{sig.detail}</p>
                                        </div>
                                    )}
                                </For>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* ─── ROW 2: PCR BREAKDOWN & MAX PAIN MONITOR ─────────────────── */}
                <div class="grid grid-cols-12 gap-4">
                    <div class="col-span-12 xl:col-span-5 bg-bg_header/30 border border-border_main flex flex-col h-[380px]">
                        <SectionHeader title="TICKER PCR BREAKDOWN" subtitle="SENTIMENT HEATMAP" />
                        <div class="flex-1 p-2">
                            <Show when={putCallRatio()?.breakdown?.length > 0} fallback={<LoadingSkeleton rows={6} />}>
                                {(() => {
                                    let chartEl;
                                    let chart;
                                    onMount(() => { chart = echarts.init(chartEl); });
                                    createEffect(() => {
                                        if (!chart || !putCallRatio()?.breakdown) return;
                                        const d = putCallRatio().breakdown;
                                        chart.setOption({
                                            backgroundColor: 'transparent',
                                            tooltip: { trigger: 'axis', textStyle: { fontSize: 9 } },
                                            grid: { top: 30, bottom: 40, left: 55, right: 15 },
                                            xAxis: { type: 'category', data: d.map(b => b.name), axisLabel: { fontSize: 7, color: '#666', rotate: 30 } },
                                            yAxis: { type: 'value', axisLabel: { fontSize: 7, color: '#666' }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
                                            series: [
                                                { name: 'Calls', type: 'bar', stack: 'v', data: d.map(b => b.call_vol), itemStyle: { color: '#10b981' } },
                                                { name: 'Puts', type: 'bar', stack: 'v', data: d.map(b => b.put_vol), itemStyle: { color: '#ef4444' } },
                                            ]
                                        });
                                    });
                                    return <div ref={chartEl} class="w-full h-full" />;
                                })()}
                            </Show>
                        </div>
                    </div>

                    <div class="col-span-12 xl:col-span-3 bg-bg_header/30 border border-border_main flex flex-col h-[380px]">
                        <SectionHeader title="TICKER SENTIMENT" />
                        <div class="flex-1 p-2 space-y-2 overflow-y-auto win-scroll">
                            <For each={putCallRatio()?.tickers}>
                                {(data) => (
                                    <div class={`bg-bg_main/10 border border-border_main/30 p-2 hover:border-text_accent/50 transition-colors cursor-pointer ${selectedSymbol() === data.symbol ? 'border-text_accent bg-text_accent/5' : ''}`} onClick={() => fetchSymbolDetail(data.symbol)}>
                                        <div class="flex justify-between items-center mb-1">
                                            <span class="text-[9px] font-black text-text_accent uppercase">{data.symbol}</span>
                                            <span class={`text-[9px] font-black font-mono ${(data.pcr_vol || data.pcr_oi) > 1 ? 'text-red-500' : 'text-emerald-500'}`}>{fmt(data.pcr_vol || data.pcr_oi, 2)}</span>
                                        </div>
                                        <div class="h-1 bg-border_main/20 rounded-full overflow-hidden flex">
                                            <div class="bg-emerald-500/50" style={`width: ${(data.call_volume || data.call_open_interest) / ((data.call_volume || data.call_open_interest) + (data.put_volume || data.put_open_interest)) * 100}%`} />
                                            <div class="bg-red-500/50 flex-1" />
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    <div class="col-span-12 xl:col-span-4 bg-bg_header/30 border border-border_main flex flex-col h-[380px]">
                        <SectionHeader title="MAX PAIN MONITOR" subtitle="TARGET LEVELS" />
                        <div class="flex-1 overflow-y-auto win-scroll">
                            <table class="w-full text-left border-collapse">
                                <thead class="sticky top-0 bg-bg_header/90 z-10">
                                    <tr class="text-[7px] text-text_secondary/40 border-b border-border_main uppercase font-black tracking-widest">
                                        <th class="px-4 py-2">SYM</th>
                                        <th class="px-4 py-2 text-right">PRICE</th>
                                        <th class="px-4 py-2 text-right">MAX PAIN</th>
                                        <th class="px-4 py-2 text-right">DIST %</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-border_main/10">
                                    <For each={maxPain()?.tickers || []}>
                                        {(mp) => (
                                            <tr class={`hover:bg-white/5 cursor-pointer transition-colors ${selectedSymbol() === mp.symbol ? 'bg-text_accent/10' : ''}`} onClick={() => fetchSymbolDetail(mp.symbol)}>
                                                <td class="px-4 py-2 text-[9px] font-black text-text_primary">{mp.symbol}</td>
                                                <td class="px-4 py-2 text-[9px] font-mono text-right text-text_secondary">${fmt(mp.current_price, 2)}</td>
                                                <td class="px-4 py-2 text-[9px] font-mono text-right font-black text-f59e0b">${fmt(mp.max_pain, 0)}</td>
                                                <td class={`px-4 py-2 text-[9px] font-mono text-right font-black ${mp.distance_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(mp.distance_pct, 1)}%</td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ─── ROW 3: DEEP INTELLIGENCE (IV RANK & UNUSUAL) ───────────── */}
                <div class="grid grid-cols-12 gap-4">
                    <div class="col-span-12 xl:col-span-8 bg-bg_header/30 border border-border_main flex flex-col h-[420px]">
                        <SectionHeader title="UNUSUAL OPTIONS ACTIVITY" subtitle="VOLUME/OI RATIO > 1.5x" />
                        <div class="flex-1 overflow-y-auto win-scroll">
                            <table class="w-full text-left border-collapse">
                                <thead class="sticky top-0 bg-bg_header/90 z-10">
                                    <tr class="text-[7px] text-text_secondary/40 uppercase font-black border-b border-border_main">
                                        <th class="px-4 py-2">SYM</th>
                                        <th class="px-4 py-2">STRIKE</th>
                                        <th class="px-4 py-2">EXPIRY</th>
                                        <th class="px-4 py-2 text-center">TYPE</th>
                                        <th class="px-4 py-2 text-right">VOL/OI</th>
                                        <th class="px-4 py-2 text-right">PREMIUM</th>
                                        <th class="px-4 py-2 text-right">IV</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-border_main/10">
                                    <Show when={unusualActivity()?.length > 0} fallback={<tr><td colSpan={7} class="py-10 text-center text-[8px] text-text_secondary/30 uppercase font-mono tracking-widest">Awaiting unusual activity flow...</td></tr>}>
                                        <For each={unusualActivity().slice(0, 50)}>
                                            {(trade) => (
                                                <tr class="hover:bg-text_accent/5 transition-colors">
                                                    <td class="px-4 py-2 text-[10px] font-black text-text_primary">{trade.symbol}</td>
                                                    <td class="px-4 py-2 text-[9px] font-mono font-bold text-text_accent">${fmt(trade.strike, 2)}</td>
                                                    <td class="px-4 py-2 text-[8px] text-text_secondary/60 font-mono uppercase">{trade.expiry}</td>
                                                    <td class="px-4 py-2 text-center">
                                                        <span class={`text-[7px] font-black px-1.5 py-0.5 rounded-sm ${trade.option_type === 'CALL' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{trade.option_type}</span>
                                                    </td>
                                                    <td class="px-4 py-2 text-[10px] font-mono text-right font-black text-text_primary">{fmt(trade.vol_oi_ratio, 2)}x</td>
                                                    <td class="px-4 py-2 text-[10px] font-mono text-right font-black text-text_accent">${fmt(trade.premium, 0)}</td>
                                                    <td class="px-4 py-2 text-[9px] font-mono text-right text-text_secondary">{fmt(trade.iv, 1)}%</td>
                                                </tr>
                                            )}
                                        </For>
                                    </Show>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="col-span-12 xl:col-span-4 bg-bg_header/30 border border-border_main flex flex-col h-[420px]">
                        <SectionHeader title="IMPLIED VOLATILITY RANK" subtitle="52W RANGE MONITOR" />
                        <div class="flex-1 overflow-y-auto win-scroll">
                            <table class="w-full text-left border-collapse">
                                <thead class="sticky top-0 bg-bg_header/90 z-10">
                                    <tr class="text-[7px] text-text_secondary/40 uppercase font-black border-b border-border_main">
                                        <th class="px-4 py-2">SYM</th>
                                        <th class="px-4 py-2 text-right">IV</th>
                                        <th class="px-4 py-2 text-right">RANK</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-border_main/10">
                                    <Show when={ivRank()?.length > 0} fallback={<tr><td colSpan={3} class="py-10 text-center text-[8px] text-text_secondary/30 uppercase font-mono tracking-widest">Awaiting IV data...</td></tr>}>
                                        <For each={ivRank().sort((a, b) => (b.iv_rank || 0) - (a.iv_rank || 0))}>
                                            {(iv) => (
                                                <tr class="hover:bg-text_accent/5 transition-colors">
                                                    <td class="px-4 py-2 text-[10px] font-black text-text_primary">{iv.symbol}</td>
                                                    <td class="px-4 py-2 text-[10px] font-mono font-black text-text_accent text-right">{fmt(iv.iv, 1)}%</td>
                                                    <td class="px-4 py-2 text-right">
                                                        <div class="flex items-center justify-end gap-3">
                                                            <div class="w-16 h-1 bg-border_main/30 rounded-full overflow-hidden">
                                                                <div class="h-full transition-all duration-500" style={`width: ${Math.min(100, iv.iv_rank || 0)}%; background: ${(iv.iv_rank || 0) > 70 ? '#ef4444' : (iv.iv_rank || 0) > 30 ? '#f59e0b' : '#10b981'}`} />
                                                            </div>
                                                            <span class={`text-[10px] font-black font-mono w-8 ${(iv.iv_rank || 0) > 70 ? 'text-red-500' : 'text-emerald-500'}`}>{fmt(iv.iv_rank || 0, 0)}%</span>
                                                        </div>
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
    );
}

function StatBox({ label, value, color = 'text-text_accent', sub, subColor = 'text-text_secondary/40' }) {
    return (
        <div class="bg-bg_main/10 border border-border_main/30 p-3 flex flex-col">
            <span class="text-[7px] font-black text-text_secondary/40 uppercase tracking-widest mb-1">{label}</span>
            <span class={`text-[14px] font-black font-mono ${color}`}>{value}</span>
            {sub && <span class={`text-[8px] font-bold ${subColor} mt-0.5`}>{sub}</span>}
        </div>
    );
}
