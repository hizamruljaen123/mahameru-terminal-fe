import { createSignal, onMount, createEffect, For, Show } from 'solid-js';
import * as echarts from 'echarts';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BOND_API = import.meta.env.VITE_BOND_API;
const MACRO_API = import.meta.env.VITE_MACRO_API;
const DASHBOARD_API = import.meta.env.VITE_DASHBOARD_API;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (v, d = 2) => (v == null || isNaN(v)) ? '\u2014' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (v == null || isNaN(v)) ? '\u2014' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const signColor = (v) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-text_secondary';
const scoreColor = (s) => s >= 70 ? 'text-red-500' : s >= 40 ? 'text-amber-500' : s >= 20 ? 'text-emerald-500' : 'text-text_accent';
const fmtMarketCap = (v) => {
    if (v == null || isNaN(v)) return '\u2014';
    const abs = Math.abs(v);
    if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    return `$${Number(v).toLocaleString()}`;
};
const fmtVolume = (v) => {
    if (v == null || isNaN(v)) return '\u2014';
    const abs = Math.abs(v);
    if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return Number(v).toLocaleString();
};

// ============================================================
// ═══ COMPLETE YFINANCE BOND TICKER CATALOG ═══════════════════
// ============================================================

const YIELD_CURVE_TICKERS = [
    { maturity: '3m', symbol: '^IRX', name: '13-Week Treasury Bill', type: 'Rate', duration: 0.25, yf_url: 'https://finance.yahoo.com/quote/%5EIRX' },
    { maturity: '6m', symbol: 'BIL', name: 'SPDR Bloomberg 1-3 Month T-Bill ETF', type: 'ETF', duration: 0.16, yf_url: 'https://finance.yahoo.com/quote/BIL' },
    { maturity: '1y', symbol: 'SHV', name: 'iShares Short Treasury Bond ETF', type: 'ETF', duration: 0.35, yf_url: 'https://finance.yahoo.com/quote/SHV' },
    { maturity: '2y', symbol: '^2YY', name: 'ICE 2Y US Treasury Note Futures', type: 'Futures', duration: 1.90, yf_url: 'https://finance.yahoo.com/quote/%5E2YY' },
    { maturity: '3y', symbol: 'SHY', name: 'iShares 1-3 Year Treasury Bond ETF', type: 'ETF', duration: 1.90, yf_url: 'https://finance.yahoo.com/quote/SHY' },
    { maturity: '5y', symbol: '^FVX', name: '5-Year Treasury Note Yield', type: 'Rate', duration: 4.80, yf_url: 'https://finance.yahoo.com/quote/%5EFVX' },
    { maturity: '7y', symbol: 'IEI', name: 'iShares 3-7 Year Treasury Bond ETF', type: 'ETF', duration: 5.50, yf_url: 'https://finance.yahoo.com/quote/IEI' },
    { maturity: '10y', symbol: '^TNX', name: '10-Year Treasury Note Yield', type: 'Rate', duration: 8.90, yf_url: 'https://finance.yahoo.com/quote/%5ETNX' },
    { maturity: '20y', symbol: '^TYX', name: '20-Year Treasury Bond Yield', type: 'Rate', duration: 16.5, yf_url: 'https://finance.yahoo.com/quote/%5ETYX' },
    { maturity: '30y', symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', type: 'ETF', duration: 17.5, yf_url: 'https://finance.yahoo.com/quote/TLT' },
];

const GLOBAL_BOND_TICKERS = [
    { code: 'US', ticker: 'IEF', name: 'US 7-10 Year Treasury', category: 'Sovereign', region: 'North America', duration: 7.8, currency: 'USD', yf_url: 'https://finance.yahoo.com/quote/IEF' },
    { code: 'JP', ticker: 'BNDX', name: 'Total International Bond ETF', category: 'Sovereign', region: 'Asia', duration: 8.1, currency: 'USD', yf_url: 'https://finance.yahoo.com/quote/BNDX' },
    { code: 'DE', ticker: 'BWX', name: 'SPDR Bloomberg International Treasury Bond', category: 'Sovereign', region: 'Europe', duration: 7.5, currency: 'USD', yf_url: 'https://finance.yahoo.com/quote/BWX' },
    { code: 'UK', ticker: 'IGOV', name: 'iShares International Treasury Bond', category: 'Sovereign', region: 'Europe', duration: 7.2, currency: 'USD', yf_url: 'https://finance.yahoo.com/quote/IGOV' },
    { code: 'EM', ticker: 'EMB', name: 'iShares JP Morgan USD Emerging Markets Bond', category: 'Sovereign', region: 'Emerging', duration: 6.5, currency: 'USD', yf_url: 'https://finance.yahoo.com/quote/EMB' },
    { code: 'IG', ticker: 'LQD', name: 'iShares iBoxx Investment Grade Corp Bond', category: 'Corporate', region: 'US', duration: 8.5, currency: 'USD', yf_url: 'https://finance.yahoo.com/quote/LQD' },
    { code: 'HY', ticker: 'HYG', name: 'iShares iBoxx High Yield Corporate Bond', category: 'Corporate', region: 'US', duration: 4.3, currency: 'USD', yf_url: 'https://finance.yahoo.com/quote/HYG' },
    { code: 'TIP', ticker: 'TIP', name: 'iShares TIPS Bond (Real Yield Proxy)', category: 'Inflation', region: 'US', duration: 7.4, currency: 'USD', yf_url: 'https://finance.yahoo.com/quote/TIP' },
    { code: 'SP', ticker: 'SPY', name: 'SPDR S&P 500 ETF (Risk-Free Proxy)', category: 'Equity', region: 'US', duration: 0.0, currency: 'USD', yf_url: 'https://finance.yahoo.com/quote/SPY' },
];

const ALL_BOND_TICKERS = [
    ...YIELD_CURVE_TICKERS.map(t => ({ ...t, group: 'USA Yield Curve' })),
    ...GLOBAL_BOND_TICKERS.map(t => ({ ...t, group: 'Global Bonds' })),
];

// ============================================================
// ═══ PREDICTIVE MODELS ═══════════════════════════════════════
// ============================================================

/** Recession probability based on 2Y10Y spread depth */
function calcRecessionProb(spread2y10y) {
    if (spread2y10y == null) return null;
    // Logistic-style model: deeper inversion = higher probability
    const prob = Math.min(95, Math.max(2, Math.round(50 - spread2y10y * 80)));
    return prob;
}

function recessionLevel(prob) {
    if (prob == null) return { label: 'N/A', color: 'text-text_secondary/40' };
    if (prob >= 70) return { label: 'HIGH RISK', color: 'text-red-500' };
    if (prob >= 40) return { label: 'MODERATE RISK', color: 'text-amber-500' };
    if (prob >= 15) return { label: 'LOW RISK', color: 'text-emerald-500' };
    return { label: 'MINIMAL', color: 'text-text_accent' };
}

/** Duration-based price sensitivity: ΔP ≈ -D × Δy × P */
function priceImpactPct(duration, yieldChangeBps) {
    if (duration == null || yieldChangeBps == null) return null;
    return -(duration * (yieldChangeBps / 100)) * 100; // in %
}

/** Forward rate estimate: (1+y₂)²/(1+y₁) - 1 */
function calcForwardRate(y1, y2, years1, years2) {
    if (y1 == null || y2 == null) return null;
    if (y1 === 0) return null;
    const t1 = years1;
    const t2 = years2;
    const t = t2 - t1;
    if (t <= 0) return null;
    const forward = Math.pow((1 + y2 / 100) ** t2 / (1 + y1 / 100) ** t1, 1 / t) - 1;
    return forward * 100;
}

/** Macro-Bond Correlation Score (0-100, higher = more correlated risk) */
function calcMacroBondCorrScore(inflation, rate, spread, creditRegime) {
    let score = 0;
    // Inflation contribution (max 30 pts): high inflation = high correlation score
    if (inflation != null) {
        if (inflation > 5) score += 30;
        else if (inflation > 3) score += 20;
        else if (inflation > 2) score += 10;
    }
    // Rate contribution (max 25 pts)
    if (rate != null) {
        if (rate > 5) score += 25;
        else if (rate > 3) score += 15;
        else if (rate > 1) score += 8;
    }
    // Spread contribution (max 25 pts)
    if (spread != null) {
        if (spread < 0) score += 25;      // Inverted = bad for bonds
        else if (spread < 0.5) score += 12; // Flattening
    }
    // Credit regime (max 20 pts)
    if (creditRegime === 'RISK_OFF') score += 20;
    else if (creditRegime === 'NEUTRAL') score += 10;
    return Math.min(100, score);
}

function corrScoreLabel(score) {
    if (score == null) return { label: 'N/A', color: 'text-text_secondary' };
    if (score >= 70) return { label: 'HIGH CORRELATION', color: 'text-red-500' };
    if (score >= 40) return { label: 'MODERATE CORRELATION', color: 'text-amber-500' };
    return { label: 'LOW CORRELATION', color: 'text-emerald-500' };
}

/** Country bond risk grade */
function calcBondRiskGrade(corrScore, centralBankBias, recessionProb) {
    let grade = 'A';
    let factors = [];
    if (corrScore >= 70) { grade = 'D'; factors.push('High macro-bond correlation'); }
    else if (corrScore >= 50) { grade = 'C'; factors.push('Moderate correlation'); }
    else if (corrScore >= 30) { grade = 'B'; factors.push('Low correlation'); }
    else { grade = 'A'; factors.push('Very low correlation'); }

    if (centralBankBias === 'HAWKISH') { grade = String.fromCharCode(grade.charCodeAt(0) + 1 > 68 ? 68 : grade.charCodeAt(0) + 1); factors.push('Tightening cycle'); }
    if (recessionProb != null && recessionProb >= 50) { grade = 'D'; factors.push('Recession risk'); }
    return { grade: grade.length > 1 ? 'D' : grade, color: grade <= 'A' ? 'text-emerald-500' : grade <= 'B' ? 'text-amber-500' : 'text-red-500', factors };
}

// ============================================================
// ═══ COMPONENTS ══════════════════════════════════════════════
// ============================================================

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

// ─── SELECTOR BAR ────────────────────────────────────────────

function SelectorBar({ tabs, active, onChange }) {
    return (
        <div class="h-8 border-b border-border_main bg-bg_header/20 flex items-center px-3 shrink-0 overflow-x-auto">
            <nav class="flex items-center gap-1">
                <For each={tabs}>
                    {(tab, idx) => (
                        <button
                            onClick={() => onChange(tab.id)}
                            class={`whitespace-nowrap px-2 py-0.5 text-[7px] font-black tracking-widest border transition-all ${active === tab.id
                                ? 'bg-text_accent text-bg_main border-text_accent'
                                : 'border-transparent text-text_secondary/40 hover:text-text_primary/60'
                                }`}
                        >
                            {tab.label}
                        </button>
                    )}
                </For>
            </nav>
        </div>
    );
}


// ============================================================
// ═══ MAIN EXPORT: BondDetailPredictions ═════════════════════
// ============================================================
export default function BondDetailPredictions(props) {
    const { selectedCountry, countryName } = props;

    // ── STATE ──────────────────────────────────────────────────
    const [activeSection, setActiveSection] = createSignal('CATALOG');
    const [selectedTicker, setSelectedTicker] = createSignal(null);
    const [tickerDetail, setTickerDetail] = createSignal(null);
    const [tickerHistory, setTickerHistory] = createSignal(null);
    const [loadingDetail, setLoadingDetail] = createSignal(false);

    // Bond data
    const [yieldCurve, setYieldCurve] = createSignal(null);
    const [globalBonds, setGlobalBonds] = createSignal([]);
    const [inversionData, setInversionData] = createSignal(null);
    const [creditSpreads, setCreditSpreads] = createSignal(null);
    const [realYields, setRealYields] = createSignal(null);
    const [bondSummary, setBondSummary] = createSignal(null);
    const [isLoading, setIsLoading] = createSignal(true);

    // Macro data
    const [macroData, setMacroData] = createSignal(null);
    const [cbRates, setCbRates] = createSignal(null);
    const [loadingMacro, setLoadingMacro] = createSignal(false);

    const SECTIONS = [
        { id: 'CATALOG', label: 'Complete Catalog' },
        { id: 'EXPLORER', label: 'Detail Explorer' },
        { id: 'PREDICTIONS', label: 'Predictive Analytics' },
        { id: 'MACRO_CORR', label: 'Macro Correlation' },
    ];

    // ── FETCH BOND DATA ───────────────────────────────────────
    const fetchBondData = async () => {
        setIsLoading(true);
        try {
            const resp = await fetch(`${DASHBOARD_API}/api/dashboard/bonds`);
            const json = await resp.json();
            if (json.status === 'success' && json.data) {
                const yc = json.data.yield_curve?.data;
                const normalized = yc?.curve?.map(d => ({
                    ...d,
                    yield: d.yield != null && Math.abs(d.yield) < 0.2 ? d.yield * 100 : d.yield,
                    prev_yield: d.prev_yield != null && Math.abs(d.prev_yield) < 0.2 ? d.prev_yield * 100 : d.prev_yield,
                })) || [];
                setYieldCurve(normalized);
                setInversionData({
                    ...(yc?.spreads || {}),
                    ...(json.data.inversion?.data || {}),
                    history: json.data.inversion?.data?.spread_history || [],
                    current_spread: json.data.inversion?.data?.current_spread,
                    days_inverted: json.data.inversion?.data?.days_inverted,
                });
                setGlobalBonds(json.data.global?.data?.bonds || []);
                setCreditSpreads(json.data.credit_spreads?.data || null);
                setRealYields(json.data.real_yields?.data || null);
                setBondSummary(json.data.summary?.data || null);
            }
        } catch (e) {
            console.error('Bond fetch failed:', e);
            // Fallback: direct bond service
            try {
                const resp = await fetch(`${BOND_API}/api/bonds/summary`);
                const json = await resp.json();
                if (json.status === 'success') {
                    setYieldCurve(json.data.yield_curve || null);
                    setGlobalBonds(json.data.global_bonds || []);
                    setBondSummary(json.data);
                }
            } catch (e2) { console.error('Direct bond fetch also failed:', e2); }
        } finally {
            setIsLoading(false);
        }
    };

    // ── FETCH MACRO DATA ───────────────────────────────────────
    const fetchMacroData = async () => {
        setLoadingMacro(true);
        try {
            const [macroResp, cbResp] = await Promise.all([
                fetch(`${MACRO_API}/api/macro/indicators`).catch(() => null),
                fetch(`${MACRO_API}/api/macro/central-bank-rates`).catch(() => null),
            ]);
            if (macroResp?.ok) {
                const mj = await macroResp.json();
                if (mj.status === 'success') setMacroData(mj.data);
            }
            if (cbResp?.ok) {
                const cj = await cbResp.json();
                if (cj.status === 'success') setCbRates(cj.data);
            }
        } catch (e) { console.error('Macro fetch error:', e); }
        finally { setLoadingMacro(false); }
    };

    // ── FETCH TICKER DETAIL ────────────────────────────────────
    const fetchTickerDetail = async (symbol) => {
        setLoadingDetail(true);
        setSelectedTicker(symbol);
        setTickerDetail(null);
        setTickerHistory(null);
        try {
            // Fetch detail via backend bond_service proxy (avoids CORS issues)
            const resp = await fetch(`${BOND_API}/api/bonds/ticker-detail/${symbol}`);
            const json = await resp.json();
            if (json.status === 'success' && json.data) {
                const d = json.data;
                const history = d.history || [];
                setTickerDetail({
                    symbol: d.symbol,
                    currency: d.currency || 'USD',
                    currentPrice: d.currentPrice,
                    previousClose: d.previousClose,
                    high52w: d.high52w,
                    low52w: d.low52w,
                    name: d.name,
                    dayHigh: d.dayHigh,
                    dayLow: d.dayLow,
                    open: d.open,
                    volume: d.volume,
                    avgVolume: d.avgVolume,
                    marketCap: d.marketCap,
                    dividendYield: d.dividendYield,
                    peRatio: d.peRatio,
                    beta: d.beta,
                    category: d.category,
                    marketTime: d.last_updated ? new Date(d.last_updated * 1000).toLocaleString() : null,
                });
                setTickerHistory(history);
            }
        } catch (e) { console.error('Ticker detail fetch error:', e); }
        finally { setLoadingDetail(false); }
    };

    // ── INIT ──────────────────────────────────────────────────
    onMount(() => {
        fetchBondData();
        fetchMacroData();
    });

    // ── DERIVED PREDICTIONS ────────────────────────────────────
    const predictions = () => {
        const inv = inversionData();
        const yc = yieldCurve();
        const cs = creditSpreads();
        const macro = macroData();
        const cb = cbRates();

        const yieldMap = {};
        if (yc) yc.forEach(d => { if (d.yield != null) yieldMap[d.maturity] = d.yield; });

        const spread2y10y = inv?.us10y2y ?? inv?.['2y10y'] ?? null;
        const recessionProb = calcRecessionProb(spread2y10y);
        const recLevel = recessionLevel(recessionProb);

        // Price sensitivity scenarios
        const scenarios = [
            { label: 'Fed Cut -50bps', change: -50 },
            { label: 'Fed Cut -25bps', change: -25 },
            { label: 'No Change', change: 0 },
            { label: 'Fed Hike +25bps', change: 25 },
            { label: 'Fed Hike +50bps', change: 50 },
        ];

        // Get key durations
        const tltDuration = 17.5;
        const iefDuration = 7.8;
        const shyDuration = 1.9;
        const bilDuration = 0.16;

        const sensitivityScenarios = scenarios.map(s => ({
            label: s.label,
            change: s.change,
            TLT: priceImpactPct(tltDuration, s.change),
            IEF: priceImpactPct(iefDuration, s.change),
            SHY: priceImpactPct(shyDuration, s.change),
            BIL: priceImpactPct(bilDuration, s.change),
        }));

        // Forward rates
        const fwd2y1y = calcForwardRate(yieldMap['2y'], yieldMap['3y'], 2, 3);
        const fwd5y5y = calcForwardRate(yieldMap['5y'], yieldMap['10y'], 5, 10);
        const fwd10y10y = calcForwardRate(yieldMap['10y'], yieldMap['20y'], 10, 20);

        // Get macro values for selected country
        const indicators = macro?.indicators || {};
        const cpiVal = indicators.CPI?.current;
        const gdpVal = indicators.GDP?.current;
        const unemploymentVal = indicators.UNEMPLOYMENT?.current;
        const fedFunds = indicators.FEDFUNDS?.current;

        // Find central bank for selected country
        const cbForCountry = cb?.central_banks?.find(b => {
            if (selectedCountry === 'USA') return b.central_bank?.includes('Federal');
            if (selectedCountry === 'IDN') return b.central_bank?.includes('Indonesia');
            if (selectedCountry === 'DEU' || selectedCountry === 'FRA' || selectedCountry === 'ITA' || selectedCountry === 'ESP') return b.central_bank?.includes('ECB');
            if (selectedCountry === 'JPN') return b.central_bank?.includes('Japan');
            if (selectedCountry === 'GBR') return b.central_bank?.includes('UK');
            if (selectedCountry === 'CHN') return b.central_bank?.includes('China');
            if (selectedCountry === 'IND') return b.central_bank?.includes('India');
            return null;
        });

        const creditRegime = cs?.credit_regime || 'NEUTRAL';
        const corrScore = calcMacroBondCorrScore(cpiVal, fedFunds, spread2y10y, creditRegime);
        const corrLabel = corrScoreLabel(corrScore);
        const riskGrade = calcBondRiskGrade(corrScore, cbForCountry?.policy_stance, recessionProb);

        return {
            recessionProb,
            recLevel,
            sensitivityScenarios,
            forwardRates: { fwd2y1y, fwd5y5y, fwd10y10y },
            macroValues: { cpi: cpiVal, gdp: gdpVal, unemployment: unemploymentVal, fedFunds },
            cbForCountry,
            corrScore,
            corrLabel,
            riskGrade,
            spread2y10y,
        };
    };

    // ============================================================
    // ═══ RENDER ═════════════════════════════════════════════════
    // ============================================================

    return (
        <div class="flex flex-col h-full overflow-hidden">
            {/* Section Tabs */}
            <SelectorBar tabs={SECTIONS} active={activeSection()} onChange={setActiveSection} />

            <div class="flex-1 overflow-y-auto win-scroll">

                {/* ════════════════════════════════════════════════════════
            SECTION 1: COMPLETE BOND TICKER CATALOG
            ════════════════════════════════════════════════════════ */}
                <Show when={activeSection() === 'CATALOG'}>
                    <div class="p-4 space-y-6">
                        {/* US Treasury Yield Curve Tickers */}
                        <div class="bg-bg_header/30 border border-border_main">
                            <SectionHeader title="01. US TREASURY YIELD CURVE TICKERS" subtitle={`${YIELD_CURVE_TICKERS.length} symbols`} />
                            <div class="overflow-x-auto">
                                <table class="w-full text-left border-collapse">
                                    <thead class="sticky top-0 bg-bg_header z-10">
                                        <tr class="text-[6px] text-text_secondary/40 uppercase font-black tracking-widest border-b border-border_main">
                                            <th class="px-3 py-2">Maturity</th>
                                            <th class="px-3 py-2">Symbol</th>
                                            <th class="px-3 py-2">Name</th>
                                            <th class="px-3 py-2">Type</th>
                                            <th class="px-3 py-2">Duration</th>
                                            <th class="px-3 py-2">Current Yield</th>
                                            <th class="px-3 py-2">Yahoo Finance</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-border_main/20">
                                        <For each={YIELD_CURVE_TICKERS}>
                                            {(t, idx) => {
                                                const ycEntry = yieldCurve()?.find(d => d.maturity === t.maturity);
                                                const currentYield = ycEntry?.yield;
                                                return (
                                                    <tr class={`hover:bg-text_accent/5 transition-colors ${idx() % 2 === 0 ? 'bg-bg_main/5' : ''}`}>
                                                        <td class="px-3 py-2.5">
                                                            <span class="text-[9px] font-black text-text_primary">{t.maturity}</span>
                                                        </td>
                                                        <td class="px-3 py-2.5">
                                                            <button
                                                                onClick={() => { setActiveSection('EXPLORER'); fetchTickerDetail(t.symbol); }}
                                                                class="text-[9px] font-mono font-bold text-text_accent hover:underline hover:text-text_accent/80"
                                                            >
                                                                {t.symbol}
                                                            </button>
                                                        </td>
                                                        <td class="px-3 py-2.5 text-[8px] text-text_secondary">{t.name}</td>
                                                        <td class="px-3 py-2.5">
                                                            <span class="text-[7px] font-black px-1 py-0.5 bg-text_accent/10 text-text_accent">{t.type}</span>
                                                        </td>
                                                        <td class="px-3 py-2.5 text-[9px] font-bold text-text_primary">{t.duration.toFixed(1)}y</td>
                                                        <td class={`px-3 py-2.5 text-[9px] font-black font-mono ${signColor(currentYield)}`}>
                                                            {currentYield != null ? `${fmt(currentYield, 2)}%` : '\u2014'}
                                                        </td>
                                                        <td class="px-3 py-2.5">
                                                            <a href={t.yf_url} target="_blank" class="text-[7px] text-text_accent/60 hover:text-text_accent underline">YF &uarr;</a>
                                                        </td>
                                                    </tr>
                                                );
                                            }}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Global Bond ETFs */}
                        <div class="bg-bg_header/30 border border-border_main">
                            <SectionHeader title="02. GLOBAL BOND ETFs" subtitle={`${GLOBAL_BOND_TICKERS.length} symbols`} />
                            <div class="overflow-x-auto">
                                <table class="w-full text-left border-collapse">
                                    <thead class="sticky top-0 bg-bg_header z-10">
                                        <tr class="text-[6px] text-text_secondary/40 uppercase font-black tracking-widest border-b border-border_main">
                                            <th class="px-3 py-2">Code</th>
                                            <th class="px-3 py-2">Ticker</th>
                                            <th class="px-3 py-2">Name</th>
                                            <th class="px-3 py-2">Category</th>
                                            <th class="px-3 py-2">Region</th>
                                            <th class="px-3 py-2">Duration</th>
                                            <th class="px-3 py-2">Currency</th>
                                            <th class="px-3 py-2">Price</th>
                                            <th class="px-3 py-2">Yield</th>
                                            <th class="px-3 py-2">Change</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-border_main/20">
                                        <For each={GLOBAL_BOND_TICKERS}>
                                            {(t, idx) => {
                                                const gbEntry = globalBonds()?.find(b => b.ticker === t.ticker);
                                                const price = gbEntry?.price;
                                                const yieldPct = gbEntry?.yield_pct;
                                                const change = gbEntry?.change_pct;
                                                return (
                                                    <tr class={`hover:bg-text_accent/5 transition-colors ${idx() % 2 === 0 ? 'bg-bg_main/5' : ''}`}>
                                                        <td class="px-3 py-2.5 text-[8px] font-bold text-text_primary">{t.code}</td>
                                                        <td class="px-3 py-2.5">
                                                            <button
                                                                onClick={() => { setActiveSection('EXPLORER'); fetchTickerDetail(t.ticker); }}
                                                                class="text-[9px] font-mono font-bold text-text_accent hover:underline hover:text-text_accent/80"
                                                            >
                                                                {t.ticker}
                                                            </button>
                                                        </td>
                                                        <td class="px-3 py-2.5 text-[8px] text-text_secondary">{t.name}</td>
                                                        <td class="px-3 py-2.5">
                                                            <span class={`text-[7px] font-black px-1 py-0.5 ${t.category === 'Sovereign' ? 'bg-emerald-500/10 text-emerald-400' :
                                                                t.category === 'Corporate' ? 'bg-blue-500/10 text-blue-400' :
                                                                    t.category === 'Inflation' ? 'bg-amber-500/10 text-amber-400' :
                                                                        'bg-purple-500/10 text-purple-400'
                                                                }`}>{t.category}</span>
                                                        </td>
                                                        <td class="px-3 py-2.5 text-[8px] text-text_secondary/60">{t.region}</td>
                                                        <td class="px-3 py-2.5 text-[9px] font-bold text-text_primary">{t.duration.toFixed(1)}y</td>
                                                        <td class="px-3 py-2.5 text-[8px] text-text_secondary/40">{t.currency}</td>
                                                        <td class="px-3 py-2.5 text-[9px] font-bold text-text_primary">{price ? `$${fmt(price, 2)}` : '\u2014'}</td>
                                                        <td class={`px-3 py-2.5 text-[9px] font-black font-mono ${signColor(yieldPct)}`}>{yieldPct != null ? `${fmt(yieldPct, 2)}%` : '\u2014'}</td>
                                                        <td class={`px-3 py-2.5 text-[8px] font-black ${signColor(change)}`}>{change != null ? `${fmtPct(change)}` : '\u2014'}</td>
                                                    </tr>
                                                );
                                            }}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Summary Statistics */}
                        <div class="grid grid-cols-12 gap-3">
                            <div class="col-span-3 bg-bg_header/30 border border-border_main p-3 flex flex-col items-center">
                                <span class="text-[7px] text-text_secondary/40 uppercase font-bold tracking-widest">Total Unique Symbols</span>
                                <span class="text-xl font-black text-text_accent mt-1">{ALL_BOND_TICKERS.length}</span>
                            </div>
                            <div class="col-span-3 bg-bg_header/30 border border-border_main p-3 flex flex-col items-center">
                                <span class="text-[7px] text-text_secondary/40 uppercase font-bold tracking-widest">Global Bond ETFs</span>
                                <span class="text-xl font-black text-emerald-500 mt-1">{GLOBAL_BOND_TICKERS.length}</span>
                            </div>
                            <div class="col-span-3 bg-bg_header/30 border border-border_main p-3 flex flex-col items-center">
                                <span class="text-[7px] text-text_secondary/40 uppercase font-bold tracking-widest">Yield Curve Tenors</span>
                                <span class="text-xl font-black text-blue-500 mt-1">{YIELD_CURVE_TICKERS.length}</span>
                            </div>
                            <div class="col-span-3 bg-bg_header/30 border border-border_main p-3 flex flex-col items-center">
                                <span class="text-[7px] text-text_secondary/40 uppercase font-bold tracking-widest">Duration Range</span>
                                <span class="text-lg font-black text-amber-500 mt-1">0.16y \u2013 17.5y</span>
                            </div>
                        </div>

                        <div class="bg-bg_header/10 border border-border_main/30 p-4">
                            <div class="flex items-start gap-3">
                                <div class="text-text_accent text-lg mt-0.5">&#9432;</div>
                                <div>
                                    <span class="text-[8px] font-bold text-text_primary uppercase block mb-1">Data Source</span>
                                    <p class="text-[8px] text-text_secondary/60 leading-relaxed">
                                        All tickers sourced from <span class="text-text_accent">yfinance</span> via the internal Bond Intelligence Microservice
                                        (<span class="font-mono text-text_accent">bond_service.py</span>).
                                        Yield Curve data fetched from <span class="font-mono">YIELD_CURVE_SYMBOLS</span> dict (10 maturities).
                                        Global bond ETFs from <span class="font-mono">GLOBAL_BOND_ETFS</span> dict (8 funds).
                                        Credit spread analysis uses HYG/LQD/SPY. Real yield proxy via TIP/IEF/^TNX.
                                        Click any symbol to open the <span class="text-text_accent">Detail Explorer</span>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* ════════════════════════════════════════════════════════
            SECTION 2: BOND DETAIL EXPLORER
            ════════════════════════════════════════════════════════ */}
                <Show when={activeSection() === 'EXPLORER'}>
                    <div class="p-4 grid grid-cols-12 gap-4">
                        {/* Ticker Selector */}
                        <div class="col-span-12 bg-bg_header/30 border border-border_main">
                            <SectionHeader title="BOND TICKER SELECTOR" subtitle="Click to explore" />
                            <div class="p-2 flex flex-wrap gap-1 max-h-[120px] overflow-y-auto win-scroll">
                                <For each={ALL_BOND_TICKERS}>
                                    {(t) => (
                                        <button
                                            onClick={() => fetchTickerDetail(t.symbol || t.ticker)}
                                            class={`px-2 py-0.5 text-[7px] font-bold border transition-all ${selectedTicker() === (t.symbol || t.ticker)
                                                ? 'bg-text_accent text-bg_main border-text_accent'
                                                : 'border-border_main/30 text-text_secondary/60 hover:text-text_primary hover:border-border_main'
                                                }`}
                                        >
                                            {t.symbol || t.ticker}
                                        </button>
                                    )}
                                </For>
                            </div>
                        </div>

                        {/* Detail Panel */}
                        <Show when={selectedTicker() && tickerDetail()}>
                            <div class="col-span-12 xl:col-span-5 bg-bg_header/30 border border-border_main flex flex-col">
                                <SectionHeader title={`${selectedTicker()} DETAILS`} subtitle={tickerDetail()?.currency || ''} />
                                <div class="p-4 space-y-3">
                                    <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                        <span class="text-[8px] font-bold text-text_primary uppercase">Current Price</span>
                                        <span class="text-sm font-black text-text_accent font-mono">${fmt(tickerDetail()?.currentPrice, 2)}</span>
                                    </div>
                                    <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                        <span class="text-[8px] font-bold text-text_primary uppercase">Previous Close</span>
                                        <span class="text-[9px] font-bold text-text_primary">${fmt(tickerDetail()?.previousClose, 2)}</span>
                                    </div>
                                    <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                        <span class="text-[8px] font-bold text-text_primary uppercase">52-Week High</span>
                                        <span class="text-[9px] font-bold text-emerald-500">${fmt(tickerDetail()?.high52w, 2)}</span>
                                    </div>
                                    <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                        <span class="text-[8px] font-bold text-text_primary uppercase">52-Week Low</span>
                                        <span class="text-[9px] font-bold text-red-500">${fmt(tickerDetail()?.low52w, 2)}</span>
                                    </div>
                                    <Show when={tickerDetail()?.open}>
                                        <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                            <span class="text-[8px] font-bold text-text_primary uppercase">Open</span>
                                            <span class="text-[9px] font-bold text-text_primary">${fmt(tickerDetail()?.open, 2)}</span>
                                        </div>
                                    </Show>
                                    <Show when={tickerDetail()?.dayHigh && tickerDetail()?.dayLow}>
                                        <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                            <span class="text-[8px] font-bold text-text_primary uppercase">Day Range</span>
                                            <span class="text-[9px] font-bold text-text_primary">${fmt(tickerDetail()?.dayLow, 2)} – ${fmt(tickerDetail()?.dayHigh, 2)}</span>
                                        </div>
                                    </Show>
                                    <Show when={tickerDetail()?.beta != null}>
                                        <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                            <span class="text-[8px] font-bold text-text_primary uppercase">Beta (Volatility)</span>
                                            <span class={`text-[9px] font-bold font-mono ${tickerDetail()?.beta >= 1 ? 'text-red-500' : 'text-emerald-500'}`}>{fmt(tickerDetail()?.beta, 2)}</span>
                                        </div>
                                    </Show>
                                    <Show when={tickerDetail()?.peRatio != null}>
                                        <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                            <span class="text-[8px] font-bold text-text_primary uppercase">P/E Ratio</span>
                                            <span class="text-[9px] font-bold text-text_primary">{fmt(tickerDetail()?.peRatio, 2)}</span>
                                        </div>
                                    </Show>
                                    <Show when={tickerDetail()?.marketCap != null}>
                                        <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                            <span class="text-[8px] font-bold text-text_primary uppercase">Market Cap</span>
                                            <span class="text-[9px] font-bold text-text_primary">${fmtMarketCap(tickerDetail()?.marketCap)}</span>
                                        </div>
                                    </Show>
                                    <Show when={tickerDetail()?.volume != null}>
                                        <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                            <span class="text-[8px] font-bold text-text_primary uppercase">Volume</span>
                                            <span class="text-[9px] font-bold text-text_primary">{fmtVolume(tickerDetail()?.volume)}</span>
                                        </div>
                                    </Show>
                                    <Show when={tickerDetail()?.avgVolume != null}>
                                        <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                            <span class="text-[8px] font-bold text-text_primary uppercase">Avg. Volume</span>
                                            <span class="text-[8px] text-text_secondary/80">{fmtVolume(tickerDetail()?.avgVolume)}</span>
                                        </div>
                                    </Show>
                                    <Show when={tickerDetail()?.dividendYield != null}>
                                        <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                            <span class="text-[8px] font-bold text-text_primary uppercase">Dividend Yield</span>
                                            <span class="text-[9px] font-bold text-amber-500">{fmt(tickerDetail()?.dividendYield * 100, 2)}%</span>
                                        </div>
                                    </Show>
                                    <Show when={tickerDetail()?.category}>
                                        <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                            <span class="text-[8px] font-bold text-text_primary uppercase">Category</span>
                                            <span class="text-[8px] text-text_secondary/80">{tickerDetail()?.category}</span>
                                        </div>
                                    </Show>
                                    <Show when={tickerDetail()?.marketTime}>
                                        <div class="flex items-center justify-between py-2 border-b border-border_main/10">
                                            <span class="text-[8px] font-bold text-text_primary uppercase">Last Updated</span>
                                            <span class="text-[7px] text-text_secondary/60">{tickerDetail()?.marketTime}</span>
                                        </div>
                                    </Show>
                                    {/* Price Change */}
                                    <Show when={tickerDetail()?.currentPrice && tickerDetail()?.previousClose}>
                                        {(() => {
                                            const chg = tickerDetail().currentPrice - tickerDetail().previousClose;
                                            const chgPct = (chg / tickerDetail().previousClose) * 100;
                                            return (
                                                <div class="flex items-center justify-between py-2">
                                                    <span class="text-[8px] font-bold text-text_primary uppercase">Daily Change</span>
                                                    <span class={`text-[10px] font-black font-mono ${chg >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {chg >= 0 ? '\u25B2' : '\u25BC'} ${Math.abs(chg).toFixed(2)} ({Math.abs(chgPct).toFixed(2)}%)
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </Show>
                                    <div class="mt-3 pt-3 border-t border-border_main/20">
                                        <a
                                            href={`https://finance.yahoo.com/quote/${selectedTicker().startsWith('^') ? '%5E' + selectedTicker().slice(1) : selectedTicker()}`}
                                            target="_blank"
                                            class="text-[8px] text-text_accent hover:underline uppercase font-bold"
                                        >
                                            View on Yahoo Finance &rarr;
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Price History Chart */}
                            <div class="col-span-12 xl:col-span-7 bg-bg_header/30 border border-border_main flex flex-col h-[400px]">
                                <SectionHeader title={`${selectedTicker()} PRICE HISTORY`} subtitle="6 months" />
                                <div class="flex-1 p-2">
                                    <Show when={tickerHistory()} fallback={<LoadingSkeleton rows={6} />}>
                                        {(() => {
                                            let chartEl;
                                            let chart;
                                            onMount(() => { chart = echarts.init(chartEl); });
                                            createEffect(() => {
                                                if (!chart || !tickerHistory()) return;
                                                const hist = tickerHistory();
                                                const prices = hist.map(d => d.close);
                                                const dates = hist.map(d => d.date);
                                                const minP = Math.min(...prices);
                                                const maxP = Math.max(...prices);
                                                chart.setOption({
                                                    backgroundColor: 'transparent',
                                                    tooltip: {
                                                        trigger: 'axis',
                                                        textStyle: { fontSize: 9, fontFamily: 'monospace' },
                                                        formatter: (params) => {
                                                            const p = params[0];
                                                            const d = hist[p.dataIndex];
                                                            return `<div style="font-size:9px">
                                <b>${d.date}</b><br/>
                                Close: <b>$${d.close.toFixed(2)}</b><br/>
                                ${d.volume ? `Vol: ${(d.volume / 1e6).toFixed(1)}M` : ''}
                              </div>`;
                                                        }
                                                    },
                                                    grid: { top: 20, bottom: 20, left: 50, right: 15 },
                                                    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 8, color: '#666', rotate: 30 }, axisLine: { show: false } },
                                                    yAxis: {
                                                        type: 'value',
                                                        min: minP * 0.98,
                                                        max: maxP * 1.02,
                                                        splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
                                                        axisLabel: { fontSize: 8, color: '#666', formatter: '${value}' },
                                                    },
                                                    series: [{
                                                        type: 'line',
                                                        data: prices,
                                                        smooth: true,
                                                        symbol: 'none',
                                                        lineStyle: { color: '#10b981', width: 2 },
                                                        areaStyle: {
                                                            color: {
                                                                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                                                                colorStops: [
                                                                    { offset: 0, color: 'rgba(16,185,129,0.3)' },
                                                                    { offset: 1, color: 'rgba(16,185,129,0.02)' },
                                                                ]
                                                            }
                                                        },
                                                        markLine: {
                                                            silent: true,
                                                            data: [
                                                                { yAxis: minP, label: { formatter: `L: $${minP.toFixed(2)}`, fontSize: 8, color: '#f87171' }, lineStyle: { color: '#f87171', type: 'dashed', width: 1 } },
                                                                { yAxis: maxP, label: { formatter: `H: $${maxP.toFixed(2)}`, fontSize: 8, color: '#34d399' }, lineStyle: { color: '#34d399', type: 'dashed', width: 1 } },
                                                            ]
                                                        }
                                                    }]
                                                });
                                            });
                                            return <div ref={chartEl} class="w-full h-full" />;
                                        })()}
                                    </Show>
                                </div>
                            </div>
                        </Show>

                        <Show when={!selectedTicker()}>
                            <div class="col-span-12 flex items-center justify-center py-20">
                                <div class="text-center">
                                    <div class="text-4xl text-text_secondary/20 mb-4">&#128200;</div>
                                    <span class="text-[9px] text-text_secondary/40 uppercase tracking-widest">Select a ticker above to view details</span>
                                    <p class="text-[7px] text-text_secondary/20 mt-2">Click any symbol in the catalog or the selector bar above</p>
                                </div>
                            </div>
                        </Show>
                    </div>
                </Show>

                {/* ════════════════════════════════════════════════════════
            SECTION 3: PREDICTIVE ANALYTICS
            ════════════════════════════════════════════════════════ */}
                <Show when={activeSection() === 'PREDICTIONS'}>
                    <div class="p-4 space-y-6">
                        {/* Recession Probability */}
                        <div class="bg-bg_header/30 border border-border_main">
                            <SectionHeader title="01. RECESSION PROBABILITY MODEL" subtitle="Based on 2Y10Y Yield Spread" />
                            <div class="p-4">
                                <Show when={predictions().recessionProb != null} fallback={<LoadingSkeleton rows={3} />}>
                                    <div class="grid grid-cols-12 gap-6">
                                        <div class="col-span-12 lg:col-span-4 flex flex-col items-center justify-center p-6 border border-border_main bg-bg_main/20">
                                            <span class="text-[7px] text-text_secondary/40 uppercase tracking-widest font-bold mb-2">Recession Probability</span>
                                            <div class="relative w-32 h-32 flex items-center justify-center">
                                                <svg viewBox="0 0 100 100" class="w-32 h-32 transform -rotate-90">
                                                    <circle cx="50" cy="50" r="42" fill="none" stroke="#1a1a1a" stroke-width="8" />
                                                    <circle cx="50" cy="50" r="42" fill="none" stroke={
                                                        predictions().recessionProb >= 70 ? '#ef4444' :
                                                            predictions().recessionProb >= 40 ? '#f59e0b' :
                                                                predictions().recessionProb >= 15 ? '#10b981' : '#6366f1'
                                                    } stroke-width="8" stroke-dasharray={`${(predictions().recessionProb / 100) * 264} 264`}
                                                        stroke-linecap="round" class="transition-all duration-1000" />
                                                </svg>
                                                <span class={`absolute text-xl font-black ${predictions().recLevel.color}`}>{predictions().recessionProb}%</span>
                                            </div>
                                            <span class={`text-[8px] font-black mt-2 ${predictions().recLevel.color}`}>{predictions().recLevel.label}</span>
                                            <span class="text-[7px] text-text_secondary/40 mt-1">2Y10Y Spread: {fmt(predictions().spread2y10y, 3)}%</span>
                                        </div>

                                        <div class="col-span-12 lg:col-span-8">
                                            <span class="text-[8px] font-bold text-text_primary uppercase block mb-3">Interpretation</span>
                                            <div class="space-y-2 text-[8px] text-text_secondary/60 leading-relaxed">
                                                <p>This model uses the <span class="text-text_accent font-bold">2Y-10Y Treasury spread</span> as the primary input, calculated as:</p>
                                                <p class="font-mono text-text_accent bg-bg_main/30 px-2 py-1 border border-border_main/20 text-center">
                                                    P(recession) = min(95, max(2, round(50 - spread &times; 80)))
                                                </p>
                                                <p>When the spread is deeply negative (inverted curve), recession probability increases. Historical data shows that an inverted yield curve has preceded every US recession since the 1950s (with a 6-24 month lag).</p>
                                                <div class="grid grid-cols-4 gap-2 mt-3">
                                                    <div class="border border-border_main/20 p-2 text-center">
                                                        <span class="text-[9px] font-black text-red-500 block">{'70-95%'}</span>
                                                        <span class="text-[6px] text-text_secondary/40 uppercase">Deep Inversion</span>
                                                        <span class="text-[6px] text-text_secondary/20">{'< -0.25% spread'}</span>
                                                    </div>
                                                    <div class="border border-border_main/20 p-2 text-center">
                                                        <span class="text-[9px] font-black text-amber-500 block">{'40-69%'}</span>
                                                        <span class="text-[6px] text-text_secondary/40 uppercase">Moderate Inversion</span>
                                                        <span class="text-[6px] text-text_secondary/20">{'-0.25% to 0%'}</span>
                                                    </div>
                                                    <div class="border border-border_main/20 p-2 text-center">
                                                        <span class="text-[9px] font-black text-emerald-500 block">{'15-39%'}</span>
                                                        <span class="text-[6px] text-text_secondary/40 uppercase">Flattening</span>
                                                        <span class="text-[6px] text-text_secondary/20">{'0% to 0.5%'}</span>
                                                    </div>
                                                    <div class="border border-border_main/20 p-2 text-center">
                                                        <span class="text-[9px] font-black text-text_accent block">{'2-14%'}</span>
                                                        <span class="text-[6px] text-text_secondary/40 uppercase">Normal</span>
                                                        <span class="text-[6px] text-text_secondary/20">{'> 0.5% spread'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                        </div>

                        {/* Duration-Based Price Sensitivity */}
                        <div class="bg-bg_header/30 border border-border_main">
                            <SectionHeader title="02. DURATION-BASED PRICE SENSITIVITY (SCENARIO ANALYSIS)" subtitle="Price impact of yield changes" />
                            <div class="p-4">
                                <Show when={predictions().sensitivityScenarios.length > 0} fallback={<LoadingSkeleton rows={5} />}>
                                    <div class="overflow-x-auto">
                                        <table class="w-full text-left border-collapse">
                                            <thead>
                                                <tr class="text-[6px] text-text_secondary/40 uppercase font-black tracking-widest border-b border-border_main">
                                                    <th class="px-3 py-2">Scenario</th>
                                                    <th class="px-3 py-2 text-right">Yield Change</th>
                                                    <th class="px-3 py-2 text-right text-rose-400">TLT (30Y) &Delta;%</th>
                                                    <th class="px-3 py-2 text-right text-blue-400">IEF (10Y) &Delta;%</th>
                                                    <th class="px-3 py-2 text-right text-emerald-400">SHY (3Y) &Delta;%</th>
                                                    <th class="px-3 py-2 text-right text-amber-400">BIL (6M) &Delta;%</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-border_main/20">
                                                <For each={predictions().sensitivityScenarios}>
                                                    {(s) => (
                                                        <tr class="hover:bg-text_accent/5 transition-colors">
                                                            <td class="px-3 py-2.5">
                                                                <span class={`text-[9px] font-black ${s.label.includes('Cut') ? 'text-emerald-500' :
                                                                    s.label.includes('Hike') ? 'text-red-500' :
                                                                        'text-text_secondary/60'
                                                                    }`}>{s.label}</span>
                                                            </td>
                                                            <td class="px-3 py-2.5 text-right text-[9px] font-mono font-bold">
                                                                <span class={s.change > 0 ? 'text-red-500' : s.change < 0 ? 'text-emerald-500' : 'text-text_secondary'}>
                                                                    {s.change > 0 ? '+' : ''}{s.change} bps
                                                                </span>
                                                            </td>
                                                            <td class={`px-3 py-2.5 text-right text-[9px] font-black font-mono ${s.TLT > 0 ? 'text-emerald-500' : s.TLT < 0 ? 'text-red-500' : 'text-text_secondary'}`}>
                                                                {s.TLT != null ? `${s.TLT >= 0 ? '+' : ''}${s.TLT.toFixed(1)}%` : '\u2014'}
                                                            </td>
                                                            <td class={`px-3 py-2.5 text-right text-[9px] font-black font-mono ${s.IEF > 0 ? 'text-emerald-500' : s.IEF < 0 ? 'text-red-500' : 'text-text_secondary'}`}>
                                                                {s.IEF != null ? `${s.IEF >= 0 ? '+' : ''}${s.IEF.toFixed(1)}%` : '\u2014'}
                                                            </td>
                                                            <td class={`px-3 py-2.5 text-right text-[9px] font-black font-mono ${s.SHY > 0 ? 'text-emerald-500' : s.SHY < 0 ? 'text-red-500' : 'text-text_secondary'}`}>
                                                                {s.SHY != null ? `${s.SHY >= 0 ? '+' : ''}${s.SHY.toFixed(2)}%` : '\u2014'}
                                                            </td>
                                                            <td class={`px-3 py-2.5 text-right text-[9px] font-black font-mono ${s.BIL > 0 ? 'text-emerald-500' : s.BIL < 0 ? 'text-red-500' : 'text-text_secondary'}`}>
                                                                {s.BIL != null ? `${s.BIL >= 0 ? '+' : ''}${s.BIL.toFixed(2)}%` : '\u2014'}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </For>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div class="flex items-center gap-2 mt-3 text-[7px] text-text_secondary/40">
                                        <span class="font-bold">Formula:</span>
                                        <span class="font-mono">&Delta;P/P &asymp; -D &times; &Delta;y</span>
                                        <span class="ml-2">where D = Modified Duration, &Delta;y = Yield change in basis points</span>
                                    </div>
                                </Show>
                            </div>
                        </div>

                        {/* Forward Rate Estimates */}
                        <div class="bg-bg_header/30 border border-border_main">
                            <SectionHeader title="03. IMPLIED FORWARD RATE ESTIMATES" subtitle="Derived from yield curve" />
                            <div class="p-4">
                                <Show when={yieldCurve()} fallback={<LoadingSkeleton rows={3} />}>
                                    <div class="grid grid-cols-3 gap-4">
                                        <div class="border border-border_main/30 p-4 text-center bg-bg_main/10">
                                            <span class="text-[7px] text-text_secondary/40 uppercase font-bold tracking-widest block">1Y Forward 2Y Rate</span>
                                            <span class={`text-xl font-black mt-1 ${predictions().forwardRates.fwd2y1y != null ? 'text-text_accent' : 'text-text_secondary/20'}`}>
                                                {predictions().forwardRates.fwd2y1y != null ? `${fmt(predictions().forwardRates.fwd2y1y, 2)}%` : '\u2014'}
                                            </span>
                                            <span class="text-[6px] text-text_secondary/20 mt-1 block">Market expectation for 2Y yield in 1 year</span>
                                        </div>
                                        <div class="border border-border_main/30 p-4 text-center bg-bg_main/10">
                                            <span class="text-[7px] text-text_secondary/40 uppercase font-bold tracking-widest block">5Y Forward 5Y Rate</span>
                                            <span class={`text-xl font-black mt-1 ${predictions().forwardRates.fwd5y5y != null ? 'text-text_accent' : 'text-text_secondary/20'}`}>
                                                {predictions().forwardRates.fwd5y5y != null ? `${fmt(predictions().forwardRates.fwd5y5y, 2)}%` : '\u2014'}
                                            </span>
                                            <span class="text-[6px] text-text_secondary/20 mt-1 block">Market expectation for 5Y yield in 5 years</span>
                                        </div>
                                        <div class="border border-border_main/30 p-4 text-center bg-bg_main/10">
                                            <span class="text-[7px] text-text_secondary/40 uppercase font-bold tracking-widest block">10Y Forward 10Y Rate</span>
                                            <span class={`text-xl font-black mt-1 ${predictions().forwardRates.fwd10y10y != null ? 'text-text_accent' : 'text-text_secondary/20'}`}>
                                                {predictions().forwardRates.fwd10y10y != null ? `${fmt(predictions().forwardRates.fwd10y10y, 2)}%` : '\u2014'}
                                            </span>
                                            <span class="text-[6px] text-text_secondary/20 mt-1 block">Market expectation for 10Y yield in 10 years</span>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* ════════════════════════════════════════════════════════
            SECTION 4: MACRO-BOND CORRELATION
            ════════════════════════════════════════════════════════ */}
                <Show when={activeSection() === 'MACRO_CORR'}>
                    <div class="p-4 space-y-6">
                        {/* Summary Score */}
                        <div class="grid grid-cols-12 gap-4">
                            <div class="col-span-12 lg:col-span-4 bg-bg_header/30 border border-border_main p-4 flex flex-col items-center justify-center">
                                <span class="text-[7px] text-text_secondary/40 uppercase font-bold tracking-widest mb-2">Macro-Bond Correlation Score</span>
                                <Show when={predictions().corrScore != null} fallback={<LoadingSkeleton rows={2} />}>
                                    <div class="relative w-28 h-28 flex items-center justify-center">
                                        <svg viewBox="0 0 100 100" class="w-28 h-28 transform -rotate-90">
                                            <circle cx="50" cy="50" r="42" fill="none" stroke="#1a1a1a" stroke-width="8" />
                                            <circle cx="50" cy="50" r="42" fill="none" stroke={
                                                predictions().corrScore >= 70 ? '#ef4444' :
                                                    predictions().corrScore >= 40 ? '#f59e0b' :
                                                        '#10b981'
                                            } stroke-width="8" stroke-dasharray={`${(predictions().corrScore / 100) * 264} 264`}
                                                stroke-linecap="round" class="transition-all duration-1000" />
                                        </svg>
                                        <span class={`absolute text-xl font-black ${predictions().corrLabel.color}`}>{predictions().corrScore}</span>
                                    </div>
                                    <span class={`text-[8px] font-black mt-2 ${predictions().corrLabel.color}`}>{predictions().corrLabel.label}</span>
                                </Show>
                            </div>

                            <div class="col-span-12 lg:col-span-4 bg-bg_header/30 border border-border_main p-4 flex flex-col items-center justify-center">
                                <span class="text-[7px] text-text_secondary/40 uppercase font-bold tracking-widest mb-2">Bond Risk Grade</span>
                                <Show when={predictions().riskGrade.grade} fallback={<LoadingSkeleton rows={2} />}>
                                    <span class={`text-5xl font-black ${predictions().riskGrade.color}`}>{predictions().riskGrade.grade}</span>
                                    <div class="flex flex-wrap gap-1 mt-2 justify-center">
                                        <For each={predictions().riskGrade.factors}>
                                            {(f) => <span class="text-[6px] px-1 py-0.5 bg-bg_main/30 text-text_secondary/60">{f}</span>}
                                        </For>
                                    </div>
                                </Show>
                            </div>

                            <div class="col-span-12 lg:col-span-4 bg-bg_header/30 border border-border_main p-4 flex flex-col items-center justify-center">
                                <span class="text-[7px] text-text_secondary/40 uppercase font-bold tracking-widest mb-2">Central Bank Stance</span>
                                <Show when={predictions().cbForCountry} fallback={
                                    <div class="text-center">
                                        <span class="text-[8px] text-text_secondary/40">No central bank data for {countryName() || selectedCountry()}</span>
                                    </div>
                                }>
                                    <span class={`text-xl font-black ${predictions().cbForCountry.policy_stance === 'HAWKISH' ? 'text-red-500' :
                                        predictions().cbForCountry.policy_stance === 'DOVISH' ? 'text-emerald-500' :
                                            'text-amber-500'
                                        }`}>{predictions().cbForCountry.policy_stance}</span>
                                    <span class="text-[7px] text-text_secondary/40 mt-1">{predictions().cbForCountry.central_bank}</span>
                                    <span class="text-[9px] font-bold text-text_accent mt-0.5">{fmt(predictions().cbForCountry.proxy_rate, 2)}% proxy rate</span>
                                </Show>
                            </div>
                        </div>

                        {/* Macro Indicators Table */}
                        <div class="bg-bg_header/30 border border-border_main">
                            <SectionHeader title="CURRENT MACRO INDICATORS" subtitle={countryName() || selectedCountry()} />
                            <div class="p-4">
                                <Show when={predictions().macroValues.cpi != null || predictions().macroValues.gdp != null} fallback={
                                    <p class="text-[8px] text-text_secondary/40 text-center py-6">Macro data unavailable. FRED API key may not be configured.</p>
                                }>
                                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div class="border border-border_main/20 p-3 text-center">
                                            <span class="text-[7px] text-text_secondary/40 uppercase tracking-widest font-bold block">CPI / Inflation</span>
                                            <span class={`text-lg font-black mt-1 ${predictions().macroValues.cpi > 5 ? 'text-red-500' : predictions().macroValues.cpi > 3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {predictions().macroValues.cpi != null ? `${fmt(predictions().macroValues.cpi, 1)}%` : '\u2014'}
                                            </span>
                                            <span class="text-[6px] text-text_secondary/20 mt-1 block">Consumer Price Index</span>
                                        </div>
                                        <div class="border border-border_main/20 p-3 text-center">
                                            <span class="text-[7px] text-text_secondary/40 uppercase tracking-widest font-bold block">GDP</span>
                                            <span class="text-lg font-black text-text_accent mt-1">
                                                {predictions().macroValues.gdp != null ? fmt(predictions().macroValues.gdp, 1) : '\u2014'}
                                            </span>
                                            <span class="text-[6px] text-text_secondary/20 mt-1 block">Real GDP (Billions)</span>
                                        </div>
                                        <div class="border border-border_main/20 p-3 text-center">
                                            <span class="text-[7px] text-text_secondary/40 uppercase tracking-widest font-bold block">Unemployment</span>
                                            <span class={`text-lg font-black mt-1 ${predictions().macroValues.unemployment > 6 ? 'text-red-500' : predictions().macroValues.unemployment > 4 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {predictions().macroValues.unemployment != null ? `${fmt(predictions().macroValues.unemployment, 1)}%` : '\u2014'}
                                            </span>
                                            <span class="text-[6px] text-text_secondary/20 mt-1 block">Labor Market Health</span>
                                        </div>
                                        <div class="border border-border_main/20 p-3 text-center">
                                            <span class="text-[7px] text-text_secondary/40 uppercase tracking-widest font-bold block">Fed Funds Rate</span>
                                            <span class={`text-lg font-black mt-1 ${predictions().macroValues.fedFunds > 5 ? 'text-red-500' : predictions().macroValues.fedFunds > 3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {predictions().macroValues.fedFunds != null ? `${fmt(predictions().macroValues.fedFunds, 2)}%` : '\u2014'}
                                            </span>
                                            <span class="text-[6px] text-text_secondary/20 mt-1 block">Central Bank Rate</span>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                        </div>

                        {/* Correlation Analysis */}
                        <div class="bg-bg_header/30 border border-border_main">
                            <SectionHeader title="MACRO-BOND CORRELATION ANALYSIS" />
                            <div class="p-4">
                                <Show when={predictions().corrScore != null} fallback={<LoadingSkeleton rows={4} />}>
                                    <div class="space-y-4">
                                        <p class="text-[8px] text-text_secondary/60 leading-relaxed">
                                            The <span class="text-text_accent font-bold">Macro-Bond Correlation Score</span> measures how strongly bond market conditions
                                            are correlated with macroeconomic fundamentals for <span class="text-text_primary font-bold">{countryName() || selectedCountry()}</span>.
                                            This composite index combines <span class="font-mono">inflation</span>, <span class="font-mono">interest rates</span>,
                                            <span class="font-mono">yield curve spread</span>, and <span class="font-mono">credit regime</span> into a single 0-100 score.
                                        </p>
                                        <div class="grid grid-cols-4 gap-3">
                                            <div class="border border-border_main/20 p-3">
                                                <span class="text-[7px] text-text_secondary/40 uppercase block font-bold">Inflation</span>
                                                <span class="text-[10px] font-black text-text_primary">{predictions().macroValues.cpi != null ? `${fmt(predictions().macroValues.cpi, 1)}%` : '\u2014'}</span>
                                                <div class="mt-1 h-1 bg-border_main overflow-hidden">
                                                    <div class={`h-full ${predictions().macroValues.cpi > 5 ? 'bg-red-500' : predictions().macroValues.cpi > 3 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={`width: ${Math.min((predictions().macroValues.cpi || 0) * 10, 100)}%`} />
                                                </div>
                                                <span class="text-[6px] text-text_secondary/20">{predictions().macroValues.cpi > 5 ? 'Weight: 30 pts' : predictions().macroValues.cpi > 3 ? 'Weight: 20 pts' : predictions().macroValues.cpi > 2 ? 'Weight: 10 pts' : 'Weight: 0 pts'}</span>
                                            </div>
                                            <div class="border border-border_main/20 p-3">
                                                <span class="text-[7px] text-text_secondary/40 uppercase block font-bold">Rate Level</span>
                                                <span class="text-[10px] font-black text-text_primary">{predictions().macroValues.fedFunds != null ? `${fmt(predictions().macroValues.fedFunds, 2)}%` : '\u2014'}</span>
                                                <div class="mt-1 h-1 bg-border_main overflow-hidden">
                                                    <div class={`h-full ${predictions().macroValues.fedFunds > 5 ? 'bg-red-500' : predictions().macroValues.fedFunds > 3 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={`width: ${Math.min((predictions().macroValues.fedFunds || 0) * 15, 100)}%`} />
                                                </div>
                                                <span class="text-[6px] text-text_secondary/20">{predictions().macroValues.fedFunds > 5 ? 'Weight: 25 pts' : predictions().macroValues.fedFunds > 3 ? 'Weight: 15 pts' : 'Weight: 8 pts'}</span>
                                            </div>
                                            <div class="border border-border_main/20 p-3">
                                                <span class="text-[7px] text-text_secondary/40 uppercase block font-bold">Yield Spread</span>
                                                <span class={`text-[10px] font-black ${predictions().spread2y10y < 0 ? 'text-red-500' : predictions().spread2y10y < 0.5 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                    {predictions().spread2y10y != null ? `${fmt(predictions().spread2y10y, 2)}%` : '\u2014'}
                                                </span>
                                                <div class="mt-1 h-1 bg-border_main overflow-hidden">
                                                    <div class={`h-full ${predictions().spread2y10y < 0 ? 'bg-red-500' : predictions().spread2y10y < 0.5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={`width: ${predictions().spread2y10y != null ? Math.min(Math.abs(predictions().spread2y10y) * 100, 100) : 0}%`} />
                                                </div>
                                                <span class="text-[6px] text-text_secondary/20">{predictions().spread2y10y < 0 ? 'Weight: 25 pts (Inverted)' : predictions().spread2y10y < 0.5 ? 'Weight: 12 pts (Flattening)' : 'Weight: 0 pts (Normal)'}</span>
                                            </div>
                                            <div class="border border-border_main/20 p-3">
                                                <span class="text-[7px] text-text_secondary/40 uppercase block font-bold">Credit Regime</span>
                                                <span class={`text-[10px] font-black ${predictions().creditRegime === 'RISK_OFF' ? 'text-red-500' :
                                                    predictions().creditRegime === 'RISK_ON' ? 'text-emerald-500' :
                                                        'text-amber-500'
                                                    }`}>{predictions().creditRegime || 'NEUTRAL'}</span>
                                                <div class="mt-1 h-1 bg-border_main overflow-hidden">
                                                    <div class={`h-full ${predictions().creditRegime === 'RISK_OFF' ? 'bg-red-500' :
                                                        predictions().creditRegime === 'RISK_ON' ? 'bg-emerald-500' :
                                                            'bg-amber-500'
                                                        }`} style="width: 100%" />
                                                </div>
                                                <span class="text-[6px] text-text_secondary/20">{predictions().creditRegime === 'RISK_OFF' ? 'Weight: 20 pts' : 'Weight: 10 pts'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                        </div>

                        {/* Bond-Macro Forward Guidance */}
                        <div class="bg-bg_header/20 border border-border_main/30 p-4">
                            <div class="flex items-start gap-3">
                                <div class="text-text_accent text-lg mt-0.5">&#128200;</div>
                                <div>
                                    <span class="text-[8px] font-bold text-text_primary uppercase block mb-1">Predictive Model Methodology</span>
                                    <div class="text-[7px] text-text_secondary/40 leading-relaxed space-y-1">
                                        <p><span class="font-bold">Recession Model:</span> Logistic-style function using 2Y10Y spread depth. Based on historical NY Fed/FRB recession prediction models.</p>
                                        <p><span class="font-bold">Price Sensitivity:</span> Modified duration approximation (&Delta;P/P &asymp; -D &times; &Delta;y). Bond durations sourced from issuer documentation.</p>
                                        <p><span class="font-bold">Forward Rates:</span> Implied forward rate formula: (1+y₂)^t₂ / (1+y₁)^t₁ {'-'} 1 for the period between t₁ and t₂.</p>
                                        <p><span class="font-bold">Macro-Bond Correlation:</span> Composite score (0-100) combining inflation level, interest rate level, yield curve shape, and credit regime. Higher scores indicate stronger macro-bond market linkage.</p>
                                        <p><span class="font-bold">Data Sources:</span> Bond data from yfinance via Bond Intelligence Microservice. Macro data from FRED API (via macro_economics_service) with yfinance ETF fallback proxies when FRED key is unavailable.</p>
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
