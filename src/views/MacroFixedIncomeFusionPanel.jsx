import { createSignal, onMount, createEffect, For, Show } from 'solid-js';
import * as echarts from 'echarts';
import BondDetailPredictions from './BondDetailPredictions';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BOND_API = import.meta.env.VITE_BOND_API;
const DASHBOARD_API = import.meta.env.VITE_DASHBOARD_API;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (v, d = 2) => (v == null || isNaN(v)) ? '\u2014' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (v == null || isNaN(v)) ? '0.00%' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const signColor = (v) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-text_secondary';
const formatValue = (val, type) => {
    if (val === null || val === undefined) return 'N/A';
    if (type === 'currency') return '$' + (val / 1e12).toFixed(2) + 'T';
    if (type === 'percent') return val.toFixed(2) + '%';
    if (type === 'pop') return (val / 1e6).toFixed(1) + 'M';
    return val.toLocaleString();
};

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, rightSlot }) {
    return (
        <div class="flex items-center justify-between px-4 py-2 border-b border-border_main bg-bg_main/5 shrink-0">
            <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 bg-text_accent shadow-[0_0_8px_var(--text-accent)]" />
                <span class="text-[9px] font-black tracking-[0.2em] text-text_primary uppercase font-mono">{title}</span>
                {subtitle && <span class="text-[7px] text-text_secondary/40 uppercase ml-2">{subtitle}</span>}
            </div>
            {rightSlot}
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

// ─── YIELD CURVE CHART ────────────────────────────────────────────────────────
function YieldCurveChart({ data, title }) {
    let chartEl;
    let chart;

    onMount(() => {
        chart = echarts.init(chartEl, null, { renderer: 'canvas' });
    });

    createEffect(() => {
        const validData = data.filter(d => d.yield != null);
        if (!validData.length) return;
        const terms = validData.map(d => d.term || d.maturity);
        const yields = validData.map(d => d.yield);
        const prev = validData.map(d => d.prev_yield || d.yield);
        const changes = validData.map((d, i) => d.yield - prev[i]);

        chart.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                textStyle: { fontSize: 9, fontFamily: 'monospace' },
                formatter: (params) => {
                    const p = params[0];
                    const idx = p.dataIndex;
                    const d = data[idx];
                    return `<div class="text-[9px]">
            <b>${d.term || d.maturity}</b><br/>
            Yield: ${fmt(d.yield, 2)}%<br/>
            Chg: <span style="color:${changes[idx] >= 0 ? '#34d399' : '#f87171'}">${fmtPct(changes[idx])}</span>
          </div>`;
                }
            },
            grid: { top: 20, bottom: 20, left: 45, right: 15 },
            xAxis: {
                type: 'category',
                data: terms,
                axisLabel: { fontSize: 8, color: '#666', fontWeight: 'bold', rotate: 30 },
                axisLine: { show: false },
                axisTick: { show: false },
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
                axisLabel: { fontSize: 8, color: '#666', formatter: '{value}%' },
            },
            series: [{
                type: 'line',
                data: yields,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { color: '#10b981', width: 2 },
                areaStyle: {
                    color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16,185,129,0.3)' }, { offset: 1, color: 'rgba(16,185,129,0.02)' }] }
                },
                itemStyle: { color: (p) => changes[p.dataIndex] >= 0 ? '#34d399' : '#f87171' },
                markLine: {
                    silent: true,
                    data: [{ type: 'average', label: { formatter: 'AVG: {c}%', fontSize: 8, color: '#999' } }],
                    lineStyle: { color: '#555', type: 'dashed', width: 1 }
                }
            }]
        });
    });

    return <div ref={chartEl} class="w-full h-full" />;
}

// ─── MAIN FUSED VIEW ──────────────────────────────────────────────────────────
export default function MacroFixedIncomeFusionPanel(props) {
    // ── STATE: Country-centric (ex-GlobalEconomyPanel) ──────────────────────
    const [selectedCountry, setSelectedCountry] = createSignal('USA');
    const [countries, setCountries] = createSignal([]);
    const [macroData] = createSignal({
        yields: [
            { id: 'US3M', label: 'Treasury 3M', value: '5.38%', change: '-0.01' },
            { id: 'US2Y', label: 'Treasury 2Y', value: '4.82%', change: '+0.03' },
            { id: 'US10Y', label: 'Treasury 10Y', value: '4.45%', change: '+0.05' },
        ],
        centralBanks: [
            { id: 'FED', name: 'Federal Reserve', rate: '5.50%', bias: 'Hawkish' },
            { id: 'ECB', name: 'Euro Central Bank', rate: '4.50%', bias: 'Neutral' },
            { id: 'BOJ', name: 'Bank of Japan', rate: '0.10%', bias: 'Dovish' },
            { id: 'BI', name: 'Bank Indonesia', rate: '6.25%', bias: 'Hawkish' },
        ],
        cpi: [
            { country: 'United States', value: '3.4%', status: 'High' },
            { country: 'European Union', value: '2.4%', status: 'Stable' },
            { country: 'United Kingdom', value: '3.2%', status: 'High' },
            { country: 'Indonesia', value: '3.0%', status: 'Stable' },
        ]
    });
    const [sectors, setSectors] = createSignal([]);
    const [countryProxies, setCountryProxies] = createSignal([]);
    const [countryNews, setCountryNews] = createSignal([]);
    const [countryProfile, setCountryProfile] = createSignal(null);
    const [loadingProxies, setLoadingProxies] = createSignal(false);
    const [loadingNews, setLoadingNews] = createSignal(false);
    const [loadingProfile, setLoadingProfile] = createSignal(false);

    // ── STATE: Bond-centric (ex-BondIntelligenceView) ──────────────────────
    const [activeTab, setActiveTab] = createSignal('COUNTRY_MACRO');
    const [yieldCurve, setYieldCurve] = createSignal(null);
    const [longTermCurve, setLongTermCurve] = createSignal(null);
    const [inversionData, setInversionData] = createSignal(null);
    const [globalBonds, setGlobalBonds] = createSignal([]);
    const [creditSpreads, setCreditSpreads] = createSignal(null);
    const [realYields, setRealYields] = createSignal(null);
    const [summary, setSummary] = createSignal(null);
    const [isLoading, setIsLoading] = createSignal(true);

    const TABS = [
        { id: 'COUNTRY_MACRO', label: 'Country Macro' },
        { id: 'YIELD_CURVE', label: 'Yield Curve' },
        { id: 'GLOBAL_BONDS', label: 'Global Bonds' },
        { id: 'INVERSION', label: 'Inversion' },
        { id: 'CREDIT', label: 'Credit Spreads' },
        { id: 'BOND_DETAILS', label: 'Bond Details' },
    ];

    // ── BOND FETCH (ex-BondIntelligenceView) ────────────────────────────────
    const fetchBondData = async () => {
        setIsLoading(true);
        try {
            const resp = await fetch(`${DASHBOARD_API}/api/dashboard/bonds`);
            const json = await resp.json();
            if (json.status === 'success' && json.data) {
                const ycData = json.data.yield_curve?.data;

                const normalizeYield = (y) => {
                    if (y == null) return null;
                    return (Math.abs(y) < 0.2) ? y * 100 : y;
                };

                const normalizedCurve = ycData?.curve?.map(d => ({
                    ...d,
                    yield: normalizeYield(d.yield),
                    prev_yield: normalizeYield(d.prev_yield || d.yield)
                })) || [];

                setYieldCurve(normalizedCurve.length > 0 ? normalizedCurve : null);

                if (normalizedCurve.length > 0) {
                    setLongTermCurve(normalizedCurve.filter(d => ['5y', '7y', '10y', '20y', '30y'].includes(d.maturity)));
                }

                const invData = json.data.inversion?.data;
                const spreads = ycData?.spreads || {};
                const spreadKeyMap = { '2y10y': 'us10y2y', '3m10y': 'us3m10y', '5y30y': 'us5y30y', '2y5y': 'us2y5y' };
                const mappedSpreads = {};
                for (const [k, v] of Object.entries(spreadKeyMap)) {
                    if (spreads[k] !== undefined) mappedSpreads[v] = spreads[k];
                }
                if (mappedSpreads.us10y2y === undefined && invData?.current_spread !== undefined) {
                    mappedSpreads.us10y2y = invData.current_spread;
                }

                setInversionData({
                    ...mappedSpreads,
                    ...(invData || {}),
                    history: invData?.spread_history || []
                });

                const globalData = json.data.global?.data;
                const bonds = globalData?.bonds?.map(b => ({
                    ...b,
                    country: b.name || b.ticker,
                    yield: (b.yield_pct || 0) * 100,
                    change: b.change_pct || 0
                })) || [];

                setGlobalBonds(bonds);
                setCreditSpreads(json.data.credit_spreads?.data || null);
                setRealYields(json.data.real_yields?.data || null);
                setSummary(json.data.summary?.data || null);
            }
        } catch (e) {
            console.error('Bond fetch failed, trying direct API...', e);
            try {
                const resp = await fetch(`${BOND_API}/api/bonds/summary`);
                const json = await resp.json();
                if (json.status === 'success') {
                    setYieldCurve(json.data.yield_curve || null);
                    setInversionData(null);
                    setGlobalBonds(json.data.global_bonds || []);
                    setCreditSpreads(null);
                    setRealYields(null);
                    setSummary(json.data);
                }
            } catch (e2) {
                console.error('Direct bond fetch also failed:', e2);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const inversionStatus = () => {
        if (!inversionData()) return null;
        const d = inversionData();
        const spread = d.us10y2y;
        if (spread == null) return null;
        if (spread < 0) return { label: 'INVERTED', color: 'text-red-500', bg: 'bg-red-500/10', icon: '\u2B07' };
        if (spread < 0.5) return { label: 'FLATTENING', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: '\u27A1' };
        return { label: 'NORMAL', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: '\u2B06' };
    };

    // ── COUNTRY FETCH (ex-GlobalEconomyPanel) ──────────────────────────────
    const fetchCountries = async () => {
        try {
            const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca3');
            const data = await res.json();
            const sorted = data.map(c => ({ id: c.cca3, name: c.name.common })).sort((a, b) => a.id.localeCompare(b.id));
            setCountries(sorted);
        } catch (e) {
            console.error("Country Fetch Error:", e);
            setCountries([
                { id: 'USA', name: 'United States' }, { id: 'CHN', name: 'China' },
                { id: 'RUS', name: 'Russia' }, { id: 'IDN', name: 'Indonesia' }
            ]);
        }
    };

    const fetchSectors = async () => {
        try {
            const res = await fetch(`${DASHBOARD_API}/api/economy/sectors`);
            const data = await res.json();
            setSectors(data.data || []);
        } catch (e) {
            console.error("Sector Fetch Error:", e);
        }
    };

    const fetchCountryProxies = async (code) => {
        setLoadingProxies(true);
        try {
            const res = await fetch(`${DASHBOARD_API}/api/economy/country-proxies/${code}`);
            const data = await res.json();
            const mappedResults = (data.data || []).map(p => {
                const nameMap = { 'MARKET_INDEX': 'Equity Index', 'CURRENCY_STRENGTH': 'Currency Strength', 'BOND_PROXY': 'Sovereign Debt' };
                return { ...p, readableName: nameMap[p.name] || p.name };
            });
            setCountryProxies(mappedResults);
        } catch (e) {
            console.error("Proxy Fetch Error:", e);
            setCountryProxies([]);
        } finally {
            setLoadingProxies(false);
        }
    };

    const fetchCountryNews = async (code, name) => {
        setLoadingNews(true);
        try {
            const res = await fetch(`${DASHBOARD_API}/api/economy/country-news/${code}/${name}`);
            const data = await res.json();
            setCountryNews(data.data || []);
        } catch (e) {
            console.error("News Fetch Error:", e);
            setCountryNews([]);
        } finally {
            setLoadingNews(false);
        }
    };

    const fetchCountryProfile = async (code, name) => {
        setLoadingProfile(true);
        try {
            const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${name.replace(' ', '_')}`;
            const wikiRes = await fetch(wikiUrl);
            const wikiData = wikiRes.ok ? await wikiRes.json() : null;

            const res = await fetch(`${DASHBOARD_API}/api/economy/country-profile/${code}/${name}`);
            const data = await res.json();

            setCountryProfile({
                ...(data.data || {}),
                summary: wikiData?.extract || 'Profile not available.',
                thumbnail: wikiData?.thumbnail?.source || null
            });
        } catch (e) {
            console.error("Profile Fetch Error:", e);
            setCountryProfile(null);
        } finally {
            setLoadingProfile(false);
        }
    };

    // ── INIT ───────────────────────────────────────────────────────────────
    onMount(() => {
        fetchSectors();
        fetchCountries();
        fetchBondData();
    });

    // ── EFFECT: When country changes, fetch country-specific data ──────────
    createEffect(() => {
        const code = selectedCountry();
        const list = countries();
        if (code) {
            fetchCountryProxies(code);
            const c = list.find(x => x.id === code);
            if (c) {
                fetchCountryNews(c.id, c.name);
                fetchCountryProfile(c.id, c.name);
            }
        }
    });

    // ── RENDER ──────────────────────────────────────────────────────────────
    return (
        <div class="h-full flex overflow-hidden bg-bg_main text-text_primary uppercase" style="font-family: 'Roboto', sans-serif;">
            {/* ─── LEFT SIDEBAR: COUNTRY LIST ──────────────────────────────── */}
            <div class="w-56 border-r border-border_main bg-bg_sidebar flex flex-col shrink-0 overflow-hidden">
                <div class="px-3 py-3 border-b border-border_main bg-bg_header/30">
                    <span class="text-[8px] font-bold text-text_accent uppercase tracking-widest block">GLOBAL REGIONS</span>
                    <span class="text-[6px] text-text_secondary/40 italic mt-0.5 block">{countries().length} countries</span>
                </div>
                <div class="flex-1 overflow-y-auto win-scroll py-1">
                    <div class="flex flex-col gap-0.5 px-1.5">
                        <For each={countries()}>
                            {(c) => (
                                <button
                                    onClick={() => setSelectedCountry(c.id)}
                                    title={c.name}
                                    class={`w-full text-left px-2.5 py-1.5 rounded-sm font-bold text-[9px] border transition-all ${selectedCountry() === c.id ? 'bg-text_accent text-bg_main border-text_accent' : 'border-transparent text-text_secondary/60 hover:text-text_primary hover:border-border_main/30 uppercase'}`}
                                >
                                    {c.name}
                                </button>
                            )}
                        </For>
                    </div>
                </div>
            </div>

            {/* ─── MAIN VIEWPORT ───────────────────────────────────────────── */}
            <div class="flex-1 flex flex-col overflow-hidden">
                {/* HEADER BAR */}
                <div class="px-4 py-2 border-b border-border_main bg-bg_header/50 flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-4">
                        <h1 class="text-sm font-bold text-text_accent tracking-tight uppercase italic">MACRO & FIXED INCOME</h1>
                        <div class="flex items-center gap-2 bg-text_accent/10 px-2 py-0.5 border border-text_accent/20">
                            <span class="text-[7px] font-bold text-text_accent uppercase">Target:</span>
                            <span class="text-[10px] font-bold text-text_primary uppercase tracking-widest">{selectedCountry()}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <Show when={inversionStatus()}>
                            {(s) => (
                                <div class={`flex items-center gap-1 px-2 py-0.5 ${s().bg} border border-current/20 rounded-sm`}>
                                    <span class={`text-[8px] ${s().color} font-black`}>{s().icon} {s().label}</span>
                                </div>
                            )}
                        </Show>
                        <button onClick={fetchBondData} class="p-1 hover:bg-bg_main/5 rounded transition-colors">
                            <svg class={`w-3 h-3 text-text_secondary ${isLoading() ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                        </button>
                    </div>
                </div>

                {/* TAB BAR */}
                <div class="h-9 border-b border-border_main bg-bg_header/30 flex items-center px-4 shrink-0">
                    <nav class="flex items-center gap-1">
                        <For each={TABS}>
                            {(tab, idx) => (
                                <button
                                    onClick={() => setActiveTab(tab.id)}
                                    class={`px-2.5 py-1 text-[7px] font-black tracking-widest border transition-all ${activeTab() === tab.id ? 'bg-text_accent text-bg_main border-text_accent' : 'border-transparent text-text_secondary/40 hover:text-text_primary/60'}`}
                                >
                                    0{idx() + 1} {tab.label}
                                </button>
                            )}
                        </For>
                    </nav>
                </div>

                {/* ─── TAB CONTENT ─────────────────────────────────────────── */}
                <div class="flex-1 overflow-y-auto win-scroll">

                    {/* ═══ TAB 1: COUNTRY MACRO ════════════════════════════════ */}
                    <Show when={activeTab() === 'COUNTRY_MACRO'}>
                        {/* Country Profile */}
                        <Show when={countryProfile() && (countryProfile().summary !== 'Profile not available.' || Object.keys(countryProfile().stats || {}).length > 0)}>
                            <div class="p-4 border-b border-border_main bg-bg_header/5">
                                <div class="grid grid-cols-12 gap-6">
                                    <Show when={countryProfile().summary !== 'Profile not available.'}>
                                        <div class={`col-span-12 ${Object.keys(countryProfile().stats || {}).length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'} flex gap-4`}>
                                            <Show when={countryProfile().thumbnail}>
                                                <img src={countryProfile().thumbnail} class="w-24 h-32 object-cover border border-border_main grayscale contrast-125" alt="Thumbnail" />
                                            </Show>
                                            <div class="flex-1">
                                                <span class="text-[8px] font-bold text-text_accent uppercase tracking-widest mb-1 block">REGION PROFILE</span>
                                                <p class="text-[11px] text-text_secondary leading-relaxed line-clamp-5 opacity-80 italic">
                                                    {countryProfile().summary}
                                                </p>
                                            </div>
                                        </div>
                                    </Show>
                                    <Show when={Object.keys(countryProfile().stats || {}).length > 0}>
                                        <div class={`col-span-12 ${countryProfile().summary !== 'Profile not available.' ? 'lg:col-span-4 border-l border-border_main pl-6' : 'lg:col-span-12'}`}>
                                            <span class="text-[8px] font-bold text-text_accent uppercase tracking-widest mb-3 block">ECONOMIC INDICATORS</span>
                                            <div class="grid grid-cols-1 gap-3">
                                                <Show when={countryProfile().stats?.gdp}>
                                                    <div class="flex justify-between items-end border-b border-white/5 pb-1.5">
                                                        <span class="text-[9px] text-text_secondary">Total GDP</span>
                                                        <span class="text-xs font-bold text-text_primary">{formatValue(countryProfile().stats?.gdp, 'currency')}</span>
                                                    </div>
                                                </Show>
                                                <Show when={countryProfile().stats?.gdp_per_capita}>
                                                    <div class="flex justify-between items-end border-b border-white/5 pb-1.5">
                                                        <span class="text-[9px] text-text_secondary">GDP Per Capita</span>
                                                        <span class="text-xs font-bold text-text_primary">${formatValue(countryProfile().stats?.gdp_per_capita, 'normal')}</span>
                                                    </div>
                                                </Show>
                                                <Show when={countryProfile().stats?.inflation}>
                                                    <div class="flex justify-between items-end border-b border-white/5 pb-1.5">
                                                        <span class="text-[9px] text-text_secondary">Inflation Rate</span>
                                                        <span class={`text-xs font-bold ${countryProfile().stats?.inflation > 5 ? 'text-red-500' : 'text-green-500'}`}>{formatValue(countryProfile().stats?.inflation, 'percent')}</span>
                                                    </div>
                                                </Show>
                                                <Show when={countryProfile().stats?.population}>
                                                    <div class="flex justify-between items-end border-b border-white/5 pb-1.5">
                                                        <span class="text-[9px] text-text_secondary">Population</span>
                                                        <span class="text-xs font-bold text-text_primary">{formatValue(countryProfile().stats?.population, 'pop')}</span>
                                                    </div>
                                                </Show>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            </div>
                        </Show>

                        {/* Global Macro Matrix */}
                        <div class="p-4">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[9px] font-bold text-text_accent uppercase tracking-[0.2em]">01. Global Macro Matrix</span>
                            </div>
                            <table class="w-full text-left border-collapse bg-bg_header/20">
                                <thead>
                                    <tr class="border-b border-border_main bg-bg_header/40 text-text_secondary text-[8px] font-bold uppercase">
                                        <th class="p-2.5">FIXED INCOME & YIELDS</th>
                                        <th class="p-2.5">CENTRAL BANK RATES</th>
                                        <th class="p-2.5">INFLATION PULSE (CPI)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td class="p-0 border-r border-border_main align-top">
                                            <For each={macroData().yields.filter(y => y.value)}>
                                                {(y) => (
                                                    <div class="p-2.5 border-b border-white/5 flex justify-between items-center group hover:bg-white/5">
                                                        <span class="text-[9px] text-text_secondary font-bold">{y.label}</span>
                                                        <div class="flex items-center gap-2">
                                                            <span class="text-xs font-bold text-text_primary">{y.value}</span>
                                                            <span class={`text-[7px] font-bold px-1 rounded-sm ${y.change.startsWith('+') ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>{y.change}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </td>
                                        <td class="p-0 border-r border-border_main align-top">
                                            <For each={macroData().centralBanks.filter(cb => cb.rate)}>
                                                {(cb) => (
                                                    <div class="p-2.5 border-b border-white/5 flex justify-between items-center group hover:bg-white/5">
                                                        <div class="flex flex-col">
                                                            <span class="text-[9px] text-text_primary font-bold">{cb.name}</span>
                                                            <span class="text-[6px] text-text_secondary italic opacity-60">{cb.bias}</span>
                                                        </div>
                                                        <span class="text-xs font-bold text-text_accent">{cb.rate}</span>
                                                    </div>
                                                )}
                                            </For>
                                        </td>
                                        <td class="p-0 align-top">
                                            <For each={macroData().cpi.filter(c => c.value)}>
                                                {(c) => (
                                                    <div class="p-2.5 border-b border-white/5 flex justify-between items-center group hover:bg-white/5">
                                                        <span class="text-[9px] text-text_primary font-bold">{c.country}</span>
                                                        <div class="flex items-center gap-2">
                                                            <div class="w-14 h-1 bg-border_main overflow-hidden">
                                                                <div class={`h-full ${c.status === 'High' ? 'bg-red-500' : 'bg-green-500'}`} style={`width: ${parseFloat(c.value) * 10}%`}></div>
                                                            </div>
                                                            <span class={`text-[9px] font-bold ${c.status === 'High' ? 'text-red-500' : 'text-green-500'}`}>{c.value}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Market Indicators + Sector Performance */}
                        <div class="px-4 grid grid-cols-2 gap-6 pb-4">
                            <Show when={countryProxies().length > 0}>
                                <div>
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="text-[9px] font-bold text-text_accent uppercase tracking-[0.2em]">02. Market Indicators // {selectedCountry()}</span>
                                        <Show when={loadingProxies()}><span class="text-[7px] animate-pulse">POLLING...</span></Show>
                                    </div>
                                    <table class="w-full border-collapse">
                                        <thead>
                                            <tr class="bg-bg_header/40 text-[8px] text-text_secondary uppercase font-bold border-b border-border_main">
                                                <th class="p-2.5 text-left">ASSET CLASS</th>
                                                <th class="p-2.5 text-right">SYMBOL</th>
                                                <th class="p-2.5 text-right">PRICE</th>
                                                <th class="p-2.5 text-right">CHANGE</th>
                                            </tr>
                                        </thead>
                                        <tbody class="bg-bg_header/10">
                                            <For each={countryProxies()}>
                                                {(p) => (
                                                    <tr class="border-b border-white/5 hover:bg-text_accent/5 transition-all">
                                                        <td class="p-2.5 text-[9px] font-bold text-text_primary">{p.readableName}</td>
                                                        <td class="p-2.5 text-[7px] text-right text-text_secondary/40 font-mono italic">{p.symbol}</td>
                                                        <td class="p-2.5 text-[10px] text-right font-bold text-text_primary">{p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        <td class={`p-2.5 text-[9px] text-right font-bold ${p.change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {p.change_pct >= 0 ? '\u25B2' : '\u25BC'}{Math.abs(p.change_pct).toFixed(2)}%
                                                        </td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </Show>

                            <Show when={sectors().length > 0}>
                                <div class={countryProxies().length === 0 ? 'col-span-2' : ''}>
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="text-[9px] font-bold text-text_accent uppercase tracking-[0.2em]">03. Sector Performance</span>
                                        <button onClick={fetchSectors} class="text-[7px] text-text_accent hover:underline uppercase font-bold">SYNC</button>
                                    </div>
                                    <table class="w-full border-collapse">
                                        <thead>
                                            <tr class="bg-bg_header/40 text-[8px] text-text_secondary uppercase font-bold border-b border-border_main">
                                                <th class="p-2.5 text-left">SECTOR</th>
                                                <th class="p-2.5 text-right">VALUE</th>
                                                <th class="p-2.5 text-right">HEATMAP</th>
                                            </tr>
                                        </thead>
                                        <tbody class="bg-bg_header/10">
                                            <For each={sectors()}>
                                                {(s) => (
                                                    <tr class="border-b border-white/5 hover:bg-white/5">
                                                        <td class="p-2.5 text-[9px] font-bold text-text_primary">{s.name.replace('_', ' ')}</td>
                                                        <td class="p-2.5 text-right text-[9px] font-bold text-text_secondary">${s.price.toFixed(2)}</td>
                                                        <td class="p-2.5 text-right">
                                                            <div class="flex items-center justify-end gap-2">
                                                                <span class={`text-[8px] font-bold ${s.change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%</span>
                                                                <div class="w-10 h-1.5 bg-border_main rounded-full overflow-hidden">
                                                                    <div class={`h-full ${s.change_pct >= 0 ? 'bg-green-500' : 'bg-red-500'}`} style={`width: ${Math.min(Math.abs(s.change_pct) * 15, 100)}%`}></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </Show>
                        </div>

                        {/* Country News Wire */}
                        <Show when={countryNews().length > 0}>
                            <div class="px-4 pb-4">
                                <div class="w-full">
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="text-[9px] font-bold text-text_accent uppercase tracking-[0.2em]">04. ECONOMIC & POLITICAL NEWS // {selectedCountry()}</span>
                                        <Show when={loadingNews()}><span class="text-[7px] animate-pulse uppercase">STREAMING...</span></Show>
                                    </div>
                                    <div class="border border-border_main bg-bg_header/10 max-h-[400px] overflow-y-auto win-scroll">
                                        <For each={countryNews()}>
                                            {(news) => (
                                                <div class="p-3 border-b border-white/5 hover:bg-white/5 transition-all group flex items-start gap-3">
                                                    <div class="w-14 shrink-0 text-[7px] font-bold text-text_secondary/40 uppercase pt-1">
                                                        {new Date(news.timestamp * 1000).toLocaleDateString()}
                                                    </div>
                                                    <div class="flex-1 flex flex-col gap-1">
                                                        <a href={news.url} target="_blank" class="text-[10px] font-bold text-text_primary group-hover:text-text_accent leading-snug">
                                                            {news.title}
                                                        </a>
                                                        <div class="flex items-center gap-3 mt-0.5">
                                                            <span class="text-[7px] font-bold text-text_accent/60 uppercase">{news.source}</span>
                                                            <div class="w-1 h-1 rounded-full bg-white/10"></div>
                                                            <span class="text-[7px] text-text_secondary lowercase italic opacity-30">{news.description?.slice(0, 120)}...</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </div>
                        </Show>
                    </Show>

                    {/* ═══ TAB 2: YIELD CURVE ══════════════════════════════════ */}
                    <Show when={activeTab() === 'YIELD_CURVE'}>
                        <div class="p-4 grid grid-cols-12 gap-4">
                            <div class="col-span-12 xl:col-span-8 bg-bg_header/30 border border-border_main flex flex-col h-[450px]">
                                <SectionHeader title="US TREASURY YIELD CURVE" subtitle={summary()?.last_updated ? new Date(summary().last_updated * 1000).toLocaleString() : ''} />
                                <div class="flex-1 p-2">
                                    <Show when={yieldCurve()} fallback={<LoadingSkeleton rows={8} />}>
                                        <YieldCurveChart data={yieldCurve()} />
                                    </Show>
                                </div>
                            </div>

                            <div class="col-span-12 xl:col-span-4 flex flex-col gap-4">
                                <div class="bg-bg_header/30 border border-border_main flex flex-col">
                                    <SectionHeader title="KEY RATES" />
                                    <div class="p-3 space-y-2">
                                        <Show when={yieldCurve()} fallback={<LoadingSkeleton rows={4} />}>
                                            <For each={yieldCurve()?.filter((_, i) => [0, 1, 3, 5, 7, yieldCurve().length - 1].includes(i)) || []}>
                                                {(r) => (
                                                    <div class="flex items-center justify-between py-1 border-b border-border_main/10 last:border-0">
                                                        <span class="text-[8px] font-bold text-text_primary">{r.term || r.maturity}</span>
                                                        <div class="flex items-center gap-2">
                                                            <span class="text-[9px] font-black text-text_accent font-mono">{fmt(r.yield, 2)}{r.yield != null ? '%' : ''}</span>
                                                            <span class={`text-[6px] font-black ${(r.yield - (r.prev_yield || r.yield)) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                {fmtPct(r.yield - (r.prev_yield || r.yield))}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </Show>
                                    </div>
                                </div>

                                <div class="bg-bg_header/30 border border-border_main flex flex-col">
                                    <SectionHeader title="SPREADS" />
                                    <div class="p-3 space-y-2">
                                        <Show when={inversionData()} fallback={<LoadingSkeleton rows={3} />}>
                                            <For each={Object.entries(inversionData() || {}).filter(([k]) => k.startsWith('us'))}>
                                                {([key, val]) => (
                                                    <div class="flex items-center justify-between py-1 border-b border-border_main/10 last:border-0">
                                                        <span class="text-[7px] font-bold text-text_secondary/60 uppercase">{key.replace('us', 'US ').replace('y', 'Y')}</span>
                                                        <span class={`text-[8px] font-black font-mono ${val < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{fmt(val, 2)}%</span>
                                                    </div>
                                                )}
                                            </For>
                                        </Show>
                                    </div>
                                </div>
                            </div>

                            <div class="col-span-12 bg-bg_header/30 border border-border_main flex flex-col h-[300px]">
                                <SectionHeader title="LONG-TERM YIELD CURVE (5Y-30Y)" />
                                <div class="flex-1 p-2">
                                    <Show when={longTermCurve()} fallback={<LoadingSkeleton rows={6} />}>
                                        <YieldCurveChart data={longTermCurve()} />
                                    </Show>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* ═══ TAB 3: GLOBAL BONDS ════════════════════════════════ */}
                    <Show when={activeTab() === 'GLOBAL_BONDS'}>
                        <div class="p-4">
                            <div class="bg-bg_header/30 border border-border_main flex flex-col">
                                <SectionHeader title="GLOBAL GOVERNMENT BOND YIELDS" subtitle="10Y BENCHMARK" />
                                <div class="overflow-x-auto">
                                    <table class="w-full text-left border-collapse">
                                        <thead class="sticky top-0 bg-bg_header z-10">
                                            <tr class="text-[6px] text-text_secondary/40 uppercase font-black tracking-widest border-b border-border_main">
                                                <th class="px-3 py-2">COUNTRY</th>
                                                <th class="px-3 py-2">YIELD</th>
                                                <th class="px-3 py-2">CHANGE</th>
                                                <th class="px-3 py-2">1M CHG</th>
                                                <th class="px-3 py-2">3M CHG</th>
                                                <th class="px-3 py-2">YTD CHG</th>
                                                <th class="px-3 py-2">MOODY'S</th>
                                                <th class="px-3 py-2">S&P</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-border_main/20">
                                            <Show when={globalBonds().length > 0} fallback={<tr><td colSpan={8} class="text-center text-text_secondary/40 py-10 text-[8px]">No data available</td></tr>}>
                                                <For each={globalBonds()}>
                                                    {(b) => (
                                                        <tr class="hover:bg-text_accent/5 transition-colors">
                                                            <td class="px-3 py-2.5 flex items-center gap-2">
                                                                {b.flag && <img src={`https://flagcdn.com/w20/${b.country_code?.toLowerCase() || 'us'}.png`} class="w-4 h-3 object-cover" />}
                                                                <span class="text-[9px] font-black text-text_primary uppercase">{b.country || b.name}</span>
                                                            </td>
                                                            <td class={`px-3 py-2.5 text-[9px] font-black font-mono ${signColor(b.yield)}`}>{fmt(b.yield, 2)}%</td>
                                                            <td class={`px-3 py-2.5 text-[8px] font-black ${signColor(b.change)}`}>{fmtPct(b.change)}</td>
                                                            <td class={`px-3 py-2.5 text-[8px] font-black ${signColor(b.chg_1m)}`}>{fmtPct(b.chg_1m)}</td>
                                                            <td class={`px-3 py-2.5 text-[8px] font-black ${signColor(b.chg_3m)}`}>{fmtPct(b.chg_3m)}</td>
                                                            <td class={`px-3 py-2.5 text-[8px] font-black ${signColor(b.chg_ytd)}`}>{fmtPct(b.chg_ytd)}</td>
                                                            <td class="px-3 py-2.5">
                                                                <span class={`text-[7px] font-black px-1 py-0.5 ${b.moody === 'Aaa' || b.moody?.startsWith('Aa') ? 'bg-emerald-500/20 text-emerald-400' : b.moody?.startsWith('B') ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{b.moody || '\u2014'}</span>
                                                            </td>
                                                            <td class="px-3 py-2.5">
                                                                <span class={`text-[7px] font-black px-1 py-0.5 ${b.sp === 'AAA' || b.sp?.startsWith('AA') ? 'bg-emerald-500/20 text-emerald-400' : b.sp?.startsWith('BB') ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{b.sp || '\u2014'}</span>
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
                    </Show>

                    {/* ═══ TAB 4: INVERSION ═══════════════════════════════════ */}
                    <Show when={activeTab() === 'INVERSION'}>
                        <div class="p-4 grid grid-cols-12 gap-4">
                            <div class="col-span-12 xl:col-span-7 bg-bg_header/30 border border-border_main flex flex-col h-[400px]">
                                <SectionHeader title="2Y-10Y SPREAD HISTORY" subtitle="KEY RECESSION INDICATOR" />
                                <div class="flex-1 p-2">
                                    <Show when={inversionData()?.history} fallback={<LoadingSkeleton rows={8} />}>
                                        {(() => {
                                            let chartEl;
                                            let chart;
                                            onMount(() => { chart = echarts.init(chartEl); });
                                            createEffect(() => {
                                                if (!chart || !inversionData()?.history) return;
                                                const hist = inversionData().history;
                                                chart.setOption({
                                                    backgroundColor: 'transparent',
                                                    tooltip: { trigger: 'axis', textStyle: { fontSize: 9 } },
                                                    grid: { top: 20, bottom: 20, left: 50, right: 15 },
                                                    xAxis: { type: 'time', axisLabel: { fontSize: 8, color: '#666' }, splitLine: { show: false } },
                                                    yAxis: {
                                                        type: 'value',
                                                        splitLine: { lineStyle: { color: '#1a1a1a' } },
                                                        axisLabel: { fontSize: 8, color: '#666', formatter: '{value}%' },
                                                    },
                                                    visualMap: {
                                                        top: 5, right: 5, pieces: [{ min: -10, max: 0, color: '#ef4444' }, { min: 0, max: 5, color: '#10b981' }],
                                                        textStyle: { fontSize: 8, color: '#666' }
                                                    },
                                                    series: [{
                                                        type: 'line', data: hist.map(d => [d.date, d.spread]), smooth: true,
                                                        symbol: 'none', lineStyle: { width: 2 },
                                                        areaStyle: {
                                                            color: {
                                                                type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
                                                                    { offset: 0, color: 'rgba(239,68,68,0.3)' },
                                                                    { offset: 0.5, color: 'rgba(16,185,129,0.1)' },
                                                                    { offset: 1, color: 'rgba(16,185,129,0.02)' }
                                                                ]
                                                            }
                                                        },
                                                        markLine: {
                                                            silent: true,
                                                            data: [{ yAxis: 0, label: { formatter: 'ZERO LINE', fontSize: 8, color: '#ef4444' } }],
                                                            lineStyle: { color: '#ef4444', type: 'dashed', width: 1 }
                                                        }
                                                    }]
                                                });
                                            });
                                            return <div ref={chartEl} class="w-full h-full" />;
                                        })()}
                                    </Show>
                                </div>
                            </div>

                            <div class="col-span-12 xl:col-span-5 bg-bg_header/30 border border-border_main flex flex-col h-[400px]">
                                <SectionHeader title="INVERSION METRICS" />
                                <div class="flex-1 p-4 space-y-3 overflow-y-auto">
                                    <Show when={inversionData()} fallback={<LoadingSkeleton rows={5} />}>
                                        <For each={Object.entries(inversionData() || {}).filter(([k]) => typeof k === 'string' && typeof inversionData()[k] === 'number')}>
                                            {([key, val]) => (
                                                <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                                    <span class="text-[8px] font-bold text-text_primary uppercase">{key.replace(/([a-z])([A-Z])/g, '$1 $2').replace('us', 'US ').replace(/y/g, 'Y ')}</span>
                                                    <div class="flex items-center gap-2">
                                                        <div class={`w-2 h-2 rounded-full ${val < 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                        <span class={`text-[10px] font-black font-mono ${val < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{fmt(val, 3)}%</span>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </Show>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* ═══ TAB 5: CREDIT SPREADS ══════════════════════════════ */}
                    <Show when={activeTab() === 'CREDIT'}>
                        <div class="p-4 grid grid-cols-12 gap-4">
                            <div class="col-span-12 xl:col-span-6 bg-bg_header/30 border border-border_main flex flex-col h-[350px]">
                                <SectionHeader title="CORPORATE BOND SPREADS" subtitle="IG / HY / EM" />
                                <div class="flex-1 p-4 space-y-4">
                                    <Show when={creditSpreads()} fallback={<LoadingSkeleton rows={5} />}>
                                        <div class="space-y-4">
                                            <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                                <span class="text-[8px] font-bold text-text_primary uppercase">HY/IG Ratio</span>
                                                <span class="text-[10px] font-black font-mono text-text_accent">{fmt(creditSpreads().current?.hy_lq_ratio, 4)}</span>
                                            </div>
                                            <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                                <span class="text-[8px] font-bold text-text_primary uppercase">Relative Strength</span>
                                                <span class="text-[10px] font-black font-mono text-text_accent">{fmt(creditSpreads().current?.relative_strength, 4)}</span>
                                            </div>
                                            <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                                <span class="text-[8px] font-bold text-text_primary uppercase">Ratio Change</span>
                                                <span class={`text-[10px] font-black font-mono ${creditSpreads().ratio_change_pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmtPct(creditSpreads().ratio_change_pct)}</span>
                                            </div>
                                            <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                                <span class="text-[8px] font-bold text-text_primary uppercase">Credit Regime</span>
                                                <span class="text-[8px] font-black px-2 py-0.5 bg-text_accent/10 text-text_accent rounded">{creditSpreads().credit_regime || '\u2014'}</span>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            </div>

                            <div class="col-span-12 xl:col-span-6 bg-bg_header/30 border border-border_main flex flex-col h-[350px]">
                                <SectionHeader title="REAL YIELDS (TIPS)" subtitle="INFLATION-ADJUSTED" />
                                <div class="flex-1 p-4 space-y-4">
                                    <Show when={realYields()} fallback={<div class="p-4 text-center text-[8px] text-text_secondary/40">Data unavailable</div>}>
                                        <For each={Object.entries(realYields() || {})}>
                                            {([key, val]) => (
                                                <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                                    <span class="text-[8px] font-bold text-text_primary uppercase">{key.replace(/_/g, ' ')}</span>
                                                    <span class="text-[10px] font-black font-mono text-text_accent">{fmt(val, 2)}%</span>
                                                </div>
                                            )}
                                        </For>
                                    </Show>
                                </div>
                            </div>

                            <div class="col-span-12 bg-bg_header/30 border border-border_main flex flex-col h-[300px]">
                                <SectionHeader title="CREDIT SPREAD HISTORY (IG vs HY)" />
                                <div class="flex-1 p-2">
                                    <Show when={creditSpreads()?.spread_history} fallback={<LoadingSkeleton rows={6} />}>
                                        {(() => {
                                            let chartEl;
                                            let chart;
                                            onMount(() => { chart = echarts.init(chartEl); });
                                            createEffect(() => {
                                                if (!chart || !creditSpreads()?.spread_history) return;
                                                const hist = creditSpreads().spread_history;
                                                chart.setOption({
                                                    backgroundColor: 'transparent',
                                                    tooltip: { trigger: 'axis', textStyle: { fontSize: 9 } },
                                                    legend: { data: ['HY/IG Ratio', 'Rel Strength'], textStyle: { fontSize: 8, color: '#999' }, top: 0 },
                                                    grid: { top: 30, bottom: 20, left: 50, right: 15 },
                                                    xAxis: { type: 'time', axisLabel: { fontSize: 8, color: '#666' } },
                                                    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { fontSize: 8, color: '#666' } },
                                                    series: [
                                                        { name: 'HY/IG Ratio', type: 'line', data: hist.map(d => [d.date, d.hy_lq_ratio]), smooth: true, symbol: 'none', lineStyle: { color: '#f97316', width: 1.5 }, areaStyle: { color: 'rgba(249,115,22,0.1)' } },
                                                        { name: 'Rel Strength', type: 'line', data: hist.map(d => [d.date, d.relative_strength]), smooth: true, symbol: 'none', lineStyle: { color: '#3b82f6', width: 1.5 }, areaStyle: { color: 'rgba(59,130,246,0.1)' } }
                                                    ]
                                                });
                                            });
                                            return <div ref={chartEl} class="w-full h-full" />;
                                        })()}
                                    </Show>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* ═══ TAB 6: BOND DETAIL & PREDICTIONS ══════════════════ */}
                    <Show when={activeTab() === 'BOND_DETAILS'}>
                        <BondDetailPredictions
                            selectedCountry={selectedCountry}
                            countryName={() => {
                                const c = countries().find(x => x.id === selectedCountry());
                                return c?.name || selectedCountry();
                            }}
                        />
                    </Show>

                </div>
            </div>
        </div>
    );
}
