import { createSignal, onMount, For, Show, createEffect } from 'solid-js';

const PRICE_API = import.meta.env.VITE_PRICE_INTEL_API || 'http://localhost:8170';

export default function PriceIntelPanel(props) {
    const [analysis, setAnalysis] = createSignal(null);
    const [report, setReport] = createSignal(null);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal(null);

    const fetchData = async (sym) => {
        if (!sym) return;
        setLoading(true);
        setError(null);
        try {
            const [anaRes, repRes] = await Promise.all([
                fetch(`${PRICE_API}/api/price/analyze/${sym}`),
                fetch(`${PRICE_API}/api/price/report/${sym}`)
            ]);
            if (anaRes.ok) setAnalysis(await anaRes.json());
            if (repRes.ok) setReport(await repRes.json());
        } catch (e) {
            console.error("Price Intel Fetch Error", e);
            setError("Price Intelligence Engine Offline.");
        } finally {
            setLoading(false);
        }
    };

    createEffect(() => {
        fetchData(props.symbol);
    });

    return (
        <div class="h-full w-full bg-bg_main text-white p-4 overflow-y-auto win-scroll font-mono uppercase">
            <Show when={loading()}>
                <div class="flex items-center gap-3 text-text_accent p-6">
                    <div class="w-4 h-4 border-2 border-text_accent border-t-transparent animate-spin rounded-full"></div>
                    <span class="text-[9px] font-black tracking-widest">ANALYZING PRICE PATTERNS...</span>
                </div>
            </Show>
            
            <Show when={error()}>
                <div class="p-4 border border-red-500/20 bg-red-500/10 text-red-400 text-[10px] font-black tracking-widest">
                    {error()}
                </div>
            </Show>

            <Show when={!loading() && analysis()}>
                <div class="space-y-6 animate-in fade-in">
                    {/* TOP STATUS */}
                    <div class="grid grid-cols-3 gap-4">
                        <div class="p-4 bg-bg_header/30 border border-border_main flex flex-col gap-1">
                            <span class="text-[8px] text-text_secondary/50 tracking-widest">Signal</span>
                            <span class={`text-[16px] font-black ${analysis().signal === 'BUY' ? 'text-emerald-400' : analysis().signal === 'SELL' ? 'text-red-400' : 'text-blue-400'}`}>
                                {analysis().signal || 'HOLD'}
                            </span>
                        </div>
                        <div class="p-4 bg-bg_header/30 border border-border_main flex flex-col gap-1">
                            <span class="text-[8px] text-text_secondary/50 tracking-widest">Confidence</span>
                            <span class="text-[16px] font-black text-text_accent">
                                {((analysis().confidence || 0) * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div class="p-4 bg-bg_header/30 border border-border_main flex flex-col gap-1">
                            <span class="text-[8px] text-text_secondary/50 tracking-widest">Volatility Status</span>
                            <span class="text-[14px] font-black text-amber-400">
                                {analysis().volatility_status || 'NORMAL'}
                            </span>
                        </div>
                    </div>

                    {/* METRICS */}
                    <div class="grid grid-cols-2 gap-4">
                        <div class="p-4 border border-border_main bg-bg_header/10">
                            <h3 class="text-[9px] font-black text-text_secondary mb-3 tracking-widest border-b border-border_main/30 pb-2">KEY METRICS</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between text-[10px]">
                                    <span class="text-text_secondary/50">Current Price</span>
                                    <span class="font-black text-text_primary">{analysis().current_price}</span>
                                </div>
                                <div class="flex justify-between text-[10px]">
                                    <span class="text-text_secondary/50">RSI (14)</span>
                                    <span class="font-black text-text_primary">{analysis().rsi_14?.toFixed(2)}</span>
                                </div>
                                <div class="flex justify-between text-[10px]">
                                    <span class="text-text_secondary/50">MACD Histogram</span>
                                    <span class={`font-black ${analysis().macd_hist > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{analysis().macd_hist?.toFixed(4)}</span>
                                </div>
                            </div>
                        </div>

                        {/* SUPPORT / RESISTANCE */}
                        <div class="p-4 border border-border_main bg-bg_header/10">
                            <h3 class="text-[9px] font-black text-text_secondary mb-3 tracking-widest border-b border-border_main/30 pb-2">PRICE LEVELS</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between text-[10px]">
                                    <span class="text-red-400/50">Resistance</span>
                                    <span class="font-black text-red-400">{analysis().resistance}</span>
                                </div>
                                <div class="flex justify-between text-[10px]">
                                    <span class="text-emerald-400/50">Support</span>
                                    <span class="font-black text-emerald-400">{analysis().support}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI REPORT */}
                    <Show when={report()}>
                        <div class="p-4 border border-text_accent/20 bg-text_accent/5 relative overflow-hidden group">
                            <div class="absolute top-0 left-0 w-1 h-full bg-text_accent"></div>
                            <h3 class="text-[9px] font-black text-text_accent mb-3 tracking-widest flex items-center gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-text_accent animate-pulse"></span>
                                AI SYNTHESIS REPORT
                            </h3>
                            <div class="text-[10px] text-text_secondary leading-relaxed font-sans normal-case whitespace-pre-wrap">
                                {report().summary || report().report_text}
                            </div>
                        </div>
                    </Show>
                </div>
            </Show>
        </div>
    );
}
