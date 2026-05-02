import { createSignal, onMount, createEffect, For, Show } from 'solid-js';
import * as echarts from 'echarts';

const CORPORATE_API = import.meta.env.VITE_CORPORATE_INTEL_API;

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? '0.00' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (v == null || isNaN(v)) ? '0.00%' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

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

function MetricBox({ label, value, color = 'text-text_accent' }) {
    return (
        <div class="bg-bg_header/30 border border-border_main p-4 flex flex-col rounded-sm">
            <span class="text-[7px] font-black text-text_secondary/40 uppercase tracking-widest mb-1">{label}</span>
            <span class={`text-[16px] font-black font-mono ${color}`}>{value}</span>
        </div>
    );
}

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────
export default function CorporateIntelView(props) {
    const [insiderTrades, setInsiderTrades] = createSignal([]);
    const [insiderSummary, setInsiderSummary] = createSignal(null);
    const [analystChanges, setAnalystChanges] = createSignal([]);
    const [earningsCalendar, setEarningsCalendar] = createSignal([]);
    const [dividendCalendar, setDividendCalendar] = createSignal([]);
    const [isLoading, setIsLoading] = createSignal(true);

    onMount(() => fetchAll());

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const [insiderRes, analystRes, earningsRes, dividendRes] = await Promise.allSettled([
                fetch(`${CORPORATE_API}/api/corporate/insider`).then(r => r.json()),
                fetch(`${CORPORATE_API}/api/corporate/analyst`).then(r => r.json()),
                fetch(`${CORPORATE_API}/api/corporate/earnings`).then(r => r.json()),
                fetch(`${CORPORATE_API}/api/corporate/dividends`).then(r => r.json()),
            ]);

            if (insiderRes.status === 'fulfilled' && insiderRes.value.status === 'success') {
                setInsiderTrades(insiderRes.value.data?.trades || []);
                setInsiderSummary(insiderRes.value.data?.summary || null);
            }
            if (analystRes.status === 'fulfilled' && analystRes.value.status === 'success') {
                setAnalystChanges(analystRes.value.data || []);
            }
            if (earningsRes.status === 'fulfilled' && earningsRes.value.status === 'success') {
                setEarningsCalendar(earningsRes.value.data || []);
            }
            if (dividendRes.status === 'fulfilled' && dividendRes.value.status === 'success') {
                setDividendCalendar(dividendRes.value.data || []);
            }
        } catch (e) {
            console.error('Corporate intel fetch failed:', e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div class="flex flex-col h-full bg-black font-mono">
            {/* STICKY HEADER */}
            <div class="h-14 border-b border-border_main bg-bg_header/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 sticky top-0 z-50">
                <div class="flex items-center gap-4">
                    <div class="w-3 h-3 bg-text_accent animate-pulse shadow-[0_0_15px_var(--text-accent)] rounded-full" />
                    <div>
                        <h2 class="text-[12px] font-black tracking-[0.5em] text-text_primary uppercase">CORPORATE INTEL</h2>
                        <div class="text-[7px] text-text_secondary/40 tracking-[0.2em] uppercase">High-Density Intelligence Terminal</div>
                    </div>
                </div>
                
                <Show when={insiderSummary()}>
                    {(s) => (
                        <div class="hidden md:flex items-center gap-6">
                            <div class="flex flex-col items-end">
                                <span class="text-[7px] text-text_secondary/40 uppercase font-black">Market Sentiment</span>
                                <span class="text-[10px] font-black text-emerald-500">BULLISH ACCUMULATION</span>
                            </div>
                            <div class="h-8 w-[1px] bg-white/10" />
                            <div class="flex items-center gap-4">
                                <div class="text-right">
                                    <div class="text-[11px] font-black text-emerald-500">{fmt(s().buys || 0, 0)}</div>
                                    <div class="text-[7px] text-text_secondary/40 uppercase">Insider Buys</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-[11px] font-black text-red-500">{fmt(s().sells || 0, 0)}</div>
                                    <div class="text-[7px] text-text_secondary/40 uppercase">Insider Sells</div>
                                </div>
                            </div>
                        </div>
                    )}
                </Show>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div class="flex-1 overflow-y-auto win-scroll bg-gradient-to-b from-bg_main to-black">
                <div class="max-w-[1600px] mx-auto p-6 space-y-12 pb-32">
                    
                    {/* SECTION 01: INSIDER INTELLIGENCE */}
                    <div id="insider" class="space-y-6">
                        <div class="flex items-center gap-4">
                            <span class="text-text_accent text-[14px] font-black italic">01</span>
                            <h3 class="text-[11px] font-black tracking-[0.3em] text-text_primary uppercase border-l-2 border-text_accent pl-3">Insider Trading Intelligence</h3>
                            <div class="flex-1 h-[1px] bg-gradient-to-r from-text_accent/20 to-transparent" />
                        </div>

                        <div class="grid grid-cols-12 gap-6">
                            {/* Stats */}
                            <div class="col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <Show when={insiderSummary()} fallback={<For each={[1,2,3,4]}>{() => <div class="h-20 bg-white/5 animate-pulse rounded-sm" />}</For>}>
                                    <MetricBox label="Global Monitoring" value={fmt(insiderSummary()?.total || 0, 0)} />
                                    <MetricBox label="Buy Volume" value={fmt(insiderSummary()?.buys || 0, 0)} color="text-emerald-500" />
                                    <MetricBox label="Sell Volume" value={fmt(insiderSummary()?.sells || 0, 0)} color="text-red-500" />
                                    <MetricBox label="Accumulation Ratio" value={fmt(insiderSummary()?.buy_sell_ratio || 0, 2)} color={insiderSummary()?.buy_sell_ratio > 1 ? 'text-emerald-500' : 'text-red-500'} />
                                </Show>
                            </div>

                            {/* Chart */}
                            <div class="col-span-12 lg:col-span-8 bg-bg_header/30 border border-border_main rounded-sm overflow-hidden h-[450px] shadow-lg flex flex-col">
                                <SectionHeader title="ACCUMULATION vs DISTRIBUTION TREND" subtitle="REAL-TIME INSIDER SENTIMENT FLOW" />
                                <div class="flex-1 p-4">
                                    <Show when={insiderSummary()?.history?.length > 0} fallback={<LoadingSkeleton rows={10} />}>
                                        {(() => {
                                            let el;
                                            onMount(() => {
                                                const chart = echarts.init(el);
                                                createEffect(() => {
                                                    const hist = insiderSummary()?.history;
                                                    if (!hist) return;
                                                    chart.setOption({
                                                        backgroundColor: 'transparent',
                                                        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 10, fontFamily: 'monospace' } },
                                                        legend: { data: ['Buys', 'Sells'], textStyle: { color: '#666', fontSize: 9 }, top: 0, right: 10 },
                                                        grid: { top: 40, bottom: 40, left: 50, right: 20 },
                                                        xAxis: { type: 'category', data: hist.map(d => d.date), axisLabel: { fontSize: 8, color: '#444', rotate: 30 } },
                                                        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { fontSize: 8, color: '#444' } },
                                                        series: [
                                                            { name: 'Buys', type: 'bar', stack: 'v', data: hist.map(d => d.buys), itemStyle: { color: '#10b981' } },
                                                            { name: 'Sells', type: 'bar', stack: 'v', data: hist.map(d => d.sells), itemStyle: { color: '#ef4444' } }
                                                        ]
                                                    });
                                                });
                                            });
                                            return <div ref={el} class="w-full h-full" />;
                                        })()}
                                    </Show>
                                </div>
                            </div>

                            {/* Notable Moves */}
                            <div class="col-span-12 lg:col-span-4 bg-bg_header/30 border border-border_main rounded-sm overflow-hidden h-[450px] shadow-lg flex flex-col">
                                <SectionHeader title="HIGH-CONFIDENCE MOVES" subtitle="TOP 20 RECENT TRANSACTIONS" />
                                <div class="flex-1 overflow-y-auto win-scroll p-4 space-y-3">
                                    <For each={insiderTrades().slice(0, 20)}>
                                        {(t) => (
                                            <div class="p-3 border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all group flex items-center justify-between rounded-sm">
                                                <div>
                                                    <div class="text-[11px] font-black text-text_primary group-hover:text-text_accent transition-colors">{t.symbol}</div>
                                                    <div class={`text-[8px] font-black uppercase mt-1 ${t.transaction_type === 'Buy' ? 'text-emerald-500' : 'text-red-500'}`}>{t.transaction_type}</div>
                                                </div>
                                                <div class="text-right">
                                                    <div class="text-[10px] font-black text-text_primary">${fmt((t.price || 0) * (t.shares || 0) / 1e6, 2)}M</div>
                                                    <div class="text-[7px] text-text_secondary/40 uppercase">{fmt(t.shares || 0, 0)} Shares</div>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>

                            {/* Full Table */}
                            <div class="col-span-12 bg-bg_header/30 border border-border_main rounded-sm overflow-hidden shadow-xl flex flex-col">
                                <SectionHeader title="INSIDER TRANSACTION LOG" subtitle="COMPREHENSIVE AUDIT TRAIL" />
                                <div class="max-h-[500px] overflow-auto win-scroll bg-black/20">
                                    <table class="w-full text-left border-collapse">
                                        <thead class="sticky top-0 z-10 bg-bg_header backdrop-blur-md">
                                            <tr class="text-[8px] text-text_secondary/40 font-black tracking-widest border-b border-white/5 uppercase">
                                                <th class="px-6 py-4">Filing Date</th>
                                                <th class="px-6 py-4">Symbol</th>
                                                <th class="px-6 py-4">Insider Name</th>
                                                <th class="px-6 py-4">Type</th>
                                                <th class="px-6 py-4">Price</th>
                                                <th class="px-6 py-4">Shares</th>
                                                <th class="px-6 py-4">Value</th>
                                                <th class="px-6 py-4 text-right">Ownership %</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-white/5">
                                            <For each={insiderTrades().slice(0, 50)}>
                                                {(t) => (
                                                    <tr class="hover:bg-white/5 transition-colors text-[9px]">
                                                        <td class="px-6 py-4 text-text_secondary/60">{t.filing_date || t.date}</td>
                                                        <td class="px-6 py-4 font-black text-text_primary uppercase">{t.symbol}</td>
                                                        <td class="px-6 py-4 text-text_primary/80 font-bold truncate max-w-[150px]">{t.insider_name}</td>
                                                        <td class="px-6 py-4">
                                                            <span class={`font-black px-2 py-0.5 rounded-sm ${t.transaction_type === 'Buy' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{t.transaction_type}</span>
                                                        </td>
                                                        <td class="px-6 py-4 text-text_accent/70 font-mono">${fmt(t.price, 2)}</td>
                                                        <td class="px-6 py-4 text-text_primary/60 font-mono">{fmt(t.shares || 0, 0)}</td>
                                                        <td class="px-6 py-4 font-black text-text_primary">${fmt((t.price || 0) * (t.shares || 0) / 1e6, 2)}M</td>
                                                        <td class="px-6 py-4 text-right text-text_secondary/40">{(t.percent_holding || 0).toFixed(2)}%</td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 02: ANALYST INTELLIGENCE */}
                    <div id="analyst" class="space-y-6">
                        <div class="flex items-center gap-4">
                            <span class="text-text_accent text-[14px] font-black italic">02</span>
                            <h3 class="text-[11px] font-black tracking-[0.3em] text-text_primary uppercase border-l-2 border-text_accent pl-3">Analyst Ratings & PT Revisions</h3>
                            <div class="flex-1 h-[1px] bg-gradient-to-r from-text_accent/20 to-transparent" />
                        </div>

                        <div class="bg-bg_header/30 border border-border_main rounded-sm overflow-hidden shadow-xl flex flex-col">
                            <SectionHeader title="RATING REVISIONS" subtitle="UPGRADES / DOWNGRADES / INITIATIONS" />
                            <div class="max-h-[500px] overflow-auto win-scroll bg-black/20">
                                <table class="w-full text-left border-collapse">
                                    <thead class="sticky top-0 z-10 bg-bg_header backdrop-blur-md">
                                        <tr class="text-[8px] text-text_secondary/40 font-black tracking-widest border-b border-white/5 uppercase">
                                            <th class="px-6 py-4">Date</th>
                                            <th class="px-6 py-4">Symbol</th>
                                            <th class="px-6 py-4">Firm</th>
                                            <th class="px-6 py-4">Action</th>
                                            <th class="px-6 py-4">Rating</th>
                                            <th class="px-6 py-4">Target Price</th>
                                            <th class="px-6 py-4 text-right">Implied Upside</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-white/5">
                                        <For each={analystChanges()}>
                                            {(a) => (
                                                <tr class="hover:bg-white/5 transition-colors text-[9px]">
                                                    <td class="px-6 py-4 text-text_secondary/60">{a.date}</td>
                                                    <td class="px-6 py-4 font-black text-text_primary uppercase">{a.symbol}</td>
                                                    <td class="px-6 py-4 text-text_primary/80 font-bold">{a.firm}</td>
                                                    <td class="px-6 py-4">
                                                        <span class={`font-black px-2 py-0.5 rounded-sm ${a.action === 'UPGRADE' ? 'bg-emerald-500/10 text-emerald-500' : a.action === 'DOWNGRADE' ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-text_secondary/60'}`}>{a.action || 'REITERATED'}</span>
                                                    </td>
                                                    <td class="px-6 py-4">
                                                        <div class="flex items-center gap-2">
                                                            <span class="font-black text-text_accent uppercase">{a.to_rating}</span>
                                                            {a.from_rating && <span class="text-[7px] text-text_secondary/30">← {a.from_rating}</span>}
                                                        </div>
                                                    </td>
                                                    <td class="px-6 py-4 font-black text-text_primary">
                                                        {a.pt_new ? `$${fmt(a.pt_new, 2)}` : '—'}
                                                    </td>
                                                    <td class={`px-6 py-4 text-right font-black ${(a.upside || 0) > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                                        {a.upside ? fmtPct(a.upside * 100) : '—'}
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 03 & 04: CALENDARS */}
                    <div class="grid grid-cols-12 gap-8">
                        {/* Earnings */}
                        <div id="earnings" class="col-span-12 lg:col-span-7 space-y-6">
                            <div class="flex items-center gap-4">
                                <span class="text-text_accent text-[14px] font-black italic">03</span>
                                <h3 class="text-[11px] font-black tracking-[0.3em] text-text_primary uppercase border-l-2 border-text_accent pl-3">Earnings Calendar</h3>
                            </div>
                            <div class="bg-bg_header/30 border border-border_main rounded-sm overflow-hidden shadow-xl min-h-[500px]">
                                <SectionHeader title="UPCOMING RELEASES" subtitle="EXPECTATIONS vs PRIOR" />
                                <div class="overflow-x-auto">
                                    <table class="w-full text-left border-collapse">
                                        <thead>
                                            <tr class="bg-black/60 text-[8px] text-text_secondary/40 font-black tracking-widest border-b border-white/5 uppercase">
                                                <th class="px-6 py-4">Date</th>
                                                <th class="px-6 py-4">Symbol</th>
                                                <th class="px-6 py-4">Est. EPS</th>
                                                <th class="px-6 py-4">Est. Revenue</th>
                                                <th class="px-6 py-4 text-right">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-white/5">
                                            <For each={earningsCalendar()}>
                                                {(e) => (
                                                    <tr class="hover:bg-white/5 transition-colors text-[9px]">
                                                        <td class="px-6 py-4 text-text_secondary/60">{e.date}</td>
                                                        <td class="px-6 py-4 font-black text-text_primary uppercase">{e.symbol}</td>
                                                        <td class="px-6 py-4 font-mono text-text_accent/80">${fmt(e.est_eps || 0, 2)}</td>
                                                        <td class="px-6 py-4 font-mono text-text_primary">${fmt((e.est_revenue || 0) / 1e9, 2)}B</td>
                                                        <td class="px-6 py-4 text-right">
                                                            <span class={`text-[8px] font-black px-1.5 py-0.5 rounded-sm ${e.time === 'BMO' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>{e.time || 'TBD'}</span>
                                                        </td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Dividends */}
                        <div id="dividends" class="col-span-12 lg:col-span-5 space-y-6">
                            <div class="flex items-center gap-4">
                                <span class="text-text_accent text-[14px] font-black italic">04</span>
                                <h3 class="text-[11px] font-black tracking-[0.3em] text-text_primary uppercase border-l-2 border-text_accent pl-3">Dividend Calendar</h3>
                            </div>
                            <div class="bg-bg_header/30 border border-border_main rounded-sm overflow-hidden shadow-xl h-[600px] flex flex-col">
                                <SectionHeader title="DIVIDEND STREAMS" subtitle="EX-DATE & YIELDS" />
                                <div class="flex-1 overflow-y-auto win-scroll bg-black/20">
                                    <div class="p-4 space-y-4">
                                        <For each={dividendCalendar().slice(0, 20)}>
                                            {(d) => (
                                                <div class="bg-black/40 border border-white/5 p-4 rounded-sm hover:border-text_accent/40 transition-all flex items-center justify-between">
                                                    <div>
                                                        <div class="text-[10px] font-black text-text_primary uppercase">{d.symbol}</div>
                                                        <div class="text-[7px] text-text_secondary/40 font-black mt-1 uppercase">EX: {d.ex_date || '—'}</div>
                                                    </div>
                                                    <div class="text-right">
                                                        <div class="text-[11px] font-black text-emerald-500">{d.yield ? fmt(d.yield, 2) + '%' : '—'}</div>
                                                        <div class="text-[7px] text-text_accent/60 font-black uppercase">Div: ${fmt(d.dividend, 3)}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
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
