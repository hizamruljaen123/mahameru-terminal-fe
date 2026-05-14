import { createSignal, onMount, For, Show } from 'solid-js';

export default function PolicyDivergenceTracker() {
    const [data, setData] = createSignal([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_SENTIMENT_URL}/api/sentiment/policy-divergence`);
            const json = await response.json();
            if (json.status === 'success') {
                setData(json.data);
            } else {
                setError('Failed to fetch policy divergence');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    onMount(() => {
        fetchData();
    });

    return (
        <div class="bg-bg_sidebar/40 border border-border_main rounded-xl p-4 flex flex-col h-full">
            <div class="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                <div class="flex flex-col">
                    <h3 class="text-[12px] font-black tracking-widest text-text_accent uppercase">Macro Policy Divergence</h3>
                    <span class="text-[8px] text-text_secondary tracking-[0.2em] uppercase mt-0.5">Central Bank AI Sentiment</span>
                </div>
                <button onClick={fetchData} class="p-1.5 hover:bg-white/5 rounded transition-colors">
                    <svg class={`w-3 h-3 text-text_accent ${loading() ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            <Show when={!loading()} fallback={<div class="flex-1 flex items-center justify-center text-[10px] animate-pulse text-text_secondary">ANALYZING SPEECHES...</div>}>
                <Show when={!error()} fallback={<div class="flex-1 flex items-center justify-center text-[10px] text-red-500">{error()}</div>}>
                    <div class="flex-1 flex flex-col justify-center space-y-5">
                        <For each={data()}>
                            {(bank) => (
                                <div class="flex flex-col gap-1.5">
                                    <div class="flex justify-between items-end">
                                        <div class="flex items-center gap-2">
                                            <span class="text-[14px] font-black text-white">{bank.bank}</span>
                                            <span class="text-[8px] px-1.5 py-0.5 bg-white/5 rounded text-text_secondary">N={bank.total_articles}</span>
                                        </div>
                                        <span class={`text-[10px] font-bold ${bank.hawkish_pct > bank.dovish_pct ? 'text-red-400' : (bank.dovish_pct > bank.hawkish_pct ? 'text-green-400' : 'text-text_secondary')}`}>
                                            {bank.hawkish_pct > bank.dovish_pct ? 'HAWKISH BIAS' : (bank.dovish_pct > bank.hawkish_pct ? 'DOVISH BIAS' : 'NEUTRAL')}
                                        </span>
                                    </div>
                                    
                                    {/* Divergence Bar */}
                                    <div class="w-full h-3 bg-black/50 rounded-full flex overflow-hidden border border-white/5">
                                        <div 
                                            class="h-full bg-red-500/80 transition-all duration-1000 relative" 
                                            style={{ width: `${bank.hawkish_pct}%` }}
                                            title={`Hawkish: ${bank.hawkish_pct}%`}
                                        >
                                            <Show when={bank.hawkish_pct > 15}>
                                                <span class="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white mix-blend-overlay">HAWKISH</span>
                                            </Show>
                                        </div>
                                        <div 
                                            class="h-full bg-slate-500/50 transition-all duration-1000" 
                                            style={{ width: `${bank.neutral_pct}%` }}
                                            title={`Neutral: ${bank.neutral_pct}%`}
                                        ></div>
                                        <div 
                                            class="h-full bg-green-500/80 transition-all duration-1000 relative" 
                                            style={{ width: `${bank.dovish_pct}%` }}
                                            title={`Dovish: ${bank.dovish_pct}%`}
                                        >
                                            <Show when={bank.dovish_pct > 15}>
                                                <span class="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white mix-blend-overlay">DOVISH</span>
                                            </Show>
                                        </div>
                                    </div>
                                    
                                    <div class="flex justify-between text-[8px] text-text_secondary font-mono px-1">
                                        <span>{bank.hawkish_pct.toFixed(0)}%</span>
                                        <span>{bank.dovish_pct.toFixed(0)}%</span>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </Show>
        </div>
    );
}
