import { createSignal, onMount, For, Show } from 'solid-js';
import TechnicalAnalysisPanel from '../components/TechnicalAnalysisPanel';

const IndexAnalysisView = (props) => {
    const [movers, setMovers] = createSignal({ gainers: [], losers: [] });
    const [loadingMovers, setLoadingMovers] = createSignal(false);

    onMount(() => {
        if (props.symbol) {
            fetchMovers();
        }
    });

    const fetchMovers = async () => {
        setLoadingMovers(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/market-movers/${encodeURIComponent(props.symbol)}`);
            const data = await res.json();
            setMovers(data);
        } catch (err) {
            console.error("Fetch movers failed", err);
        } finally {
            setLoadingMovers(false);
        }
    };

    const formatNumber = (num) => {
        if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
        if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
        return num.toLocaleString();
    };

    return (
        <div class="flex-1 flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div class="bg-bg_header border-l-4 border-text_accent p-4 rounded flex justify-between items-center shadow-lg">
                <div class="flex items-center gap-4">
                    <div>
                        <h2 class="text-xl font-black text-text_primary tracking-widest uppercase">{props.symbol} Index Analysis</h2>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-[9px] bg-bg_main px-3 py-1 rounded border border-border_main text-text_accent font-mono uppercase tracking-widest">Composite_Pulse_Active</span>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Left: Technical Analysis */}
                <div class="lg:col-span-8 bg-bg_header border border-border_main rounded flex flex-col overflow-hidden shadow-2xl">
                    <div class="bg-bg_main px-4 py-2 border-b border-border_main flex justify-between items-center">
                        <h3 class="text-[11px] font-black text-text_accent uppercase tracking-widest">Main Diagnostic Chart</h3>
                        <div class="flex gap-2">
                            <div class="w-2 h-2 rounded-full bg-text_accent animate-ping"></div>
                        </div>
                    </div>
                    <div class="flex-1 min-h-[600px] bg-bg_header">
                        <TechnicalAnalysisPanel symbol={props.symbol} showToolbar={true} />
                    </div>
                </div>

                {/* Right: Movers */}
                <div class="lg:col-span-4 space-y-6 flex flex-col">
                    {/* Gainers */}
                    <div class="bg-bg_header border border-border_main rounded flex flex-col flex-1 min-h-[300px] shadow-lg">
                        <div class="bg-bg_main px-4 py-2 border-b border-emerald-500/30 flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                <h3 class="text-[11px] font-black text-emerald-500 uppercase tracking-widest">Top Gainers</h3>
                            </div>
                            <span class="text-[8px] font-mono opacity-40">VOL_ACCUMULATION</span>
                        </div>
                        <div class="p-2 space-y-2 overflow-auto scrollbar-thin flex-1 max-h-[400px]">
                            <Show when={loadingMovers()}>
                                <div class="p-4 text-center text-text_secondary opacity-40 animate-pulse uppercase text-[10px] tracking-widest">Synthesizing Mover Data...</div>
                            </Show>
                            <For each={movers().gainers}>
                                {(item) => (
                                    <div class="flex justify-between items-center p-3 bg-bg_main/30 border border-white/5 rounded hover:border-emerald-500/30 transition-all group cursor-pointer">
                                        <div>
                                            <p class="text-[12px] font-black text-text_primary group-hover:text-emerald-500">{item.symbol}</p>
                                            <p class="text-[8px] text-text_secondary opacity-40 uppercase">Vol: {formatNumber(item.volume)}</p>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-[11px] font-bold text-text_primary tracking-tighter">{item.close.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            <p class="text-[10px] font-black text-emerald-500">+{item.change_pct.toFixed(2)}%</p>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Losers */}
                    <div class="bg-bg_header border border-border_main rounded flex flex-col flex-1 min-h-[300px] shadow-lg">
                        <div class="bg-bg_main px-4 py-2 border-b border-red-500/30 flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                <h3 class="text-[11px] font-black text-red-500 uppercase tracking-widest">Top Losers</h3>
                            </div>
                            <span class="text-[8px] font-mono opacity-40">LIQUIDITY_OUTFLOW</span>
                        </div>
                        <div class="p-2 space-y-2 overflow-auto scrollbar-thin flex-1 max-h-[400px]">
                            <Show when={loadingMovers()}>
                                <div class="p-4 text-center text-text_secondary opacity-40 animate-pulse uppercase text-[10px] tracking-widest">Scanning Liquidity Nodes...</div>
                            </Show>
                            <For each={movers().losers}>
                                {(item) => (
                                    <div class="flex justify-between items-center p-3 bg-bg_main/30 border border-white/5 rounded hover:border-red-500/30 transition-all group cursor-pointer">
                                        <div>
                                            <p class="text-[12px] font-black text-text_primary group-hover:text-red-500">{item.symbol}</p>
                                            <p class="text-[8px] text-text_secondary opacity-40 uppercase">Vol: {formatNumber(item.volume)}</p>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-[11px] font-bold text-text_primary tracking-tighter">{item.close.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            <p class="text-[10px] font-black text-red-500">{item.change_pct.toFixed(2)}%</p>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IndexAnalysisView;
