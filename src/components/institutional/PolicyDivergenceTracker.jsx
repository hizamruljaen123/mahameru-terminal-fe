import { createSignal, onMount, For, Show } from 'solid-js';

// --- Robust fetch with retry ---
const fetchWithRetry = async (url, options = {}, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
    }
};

export default function PolicyDivergenceTracker() {
    const [data, setData] = createSignal([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const json = await fetchWithRetry(`${import.meta.env.VITE_SENTIMENT_URL}/api/sentiment/policy-divergence`);
            if (json.status === 'success') {
                // Transform data from object to array if needed
                if (typeof json.data === 'object' && !Array.isArray(json.data)) {
                    const transformed = Object.entries(json.data).map(([bank, stats]) => ({
                        bank,
                        total_articles: stats.hawkish + stats.dovish + stats.neutral,
                        hawkish_pct: stats.total > 0 ? (stats.hawkish / stats.total) * 100 : (stats.hawkish + stats.dovish + stats.neutral > 0 ? (stats.hawkish / (stats.hawkish + stats.dovish + stats.neutral)) * 100 : 0),
                        dovish_pct: stats.total > 0 ? (stats.dovish / stats.total) * 100 : (stats.hawkish + stats.dovish + stats.neutral > 0 ? (stats.dovish / (stats.hawkish + stats.dovish + stats.neutral)) * 100 : 0),
                        neutral_pct: stats.total > 0 ? (stats.neutral / stats.total) * 100 : (stats.hawkish + stats.dovish + stats.neutral > 0 ? (stats.neutral / (stats.hawkish + stats.dovish + stats.neutral)) * 100 : 0)
                    }));
                    setData(transformed);
                } else {
                    setData(json.data);
                }
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
        <div class="bg-black/40 border-2 border-border_main p-4 flex flex-col h-full hover:border-text_accent/20 transition-all group overflow-hidden">
            <div class="flex items-center justify-between mb-4 border-b border-border_main/20 pb-2">
                <div class="flex items-center gap-3">
                    <div class="w-1.5 h-1.5 bg-text_accent animate-pulse shadow-[0_0_8px_var(--text-accent)]" />
                    <div class="flex flex-col">
                        <h3 class="text-[10px] font-black tracking-[0.2em] text-text_primary uppercase font-mono">Macro Policy Divergence</h3>
                        <span class="text-[7px] text-text_secondary tracking-[0.3em] uppercase mt-0.5 opacity-50">Central Bank AI Sentiment</span>
                    </div>
                </div>
                <button onClick={fetchData} class="p-1.5 hover:bg-text_accent/10 transition-all text-text_secondary hover:text-text_accent">
                    <svg class={`w-3 h-3 ${loading() ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            <Show when={!loading()} fallback={<div class="flex-1 flex flex-col items-center justify-center gap-2">
                <div class="w-4 h-4 border-2 border-text_accent border-t-transparent animate-spin rounded-full"></div>
                <div class="text-[8px] font-black text-text_accent tracking-[0.4em] uppercase animate-pulse">ANALYZING SPEECHES...</div>
            </div>}>
                <Show when={!error()} fallback={<div class="flex-1 flex flex-col items-center justify-center gap-2 text-red-400">
                    <svg class="w-6 h-6 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span class="text-[9px] font-black uppercase tracking-widest">{error()}</span>
                </div>}>
                    <div class="flex-1 flex flex-col justify-center space-y-4">
                        <For each={data()}>
                            {(bank) => (
                                <div class="flex flex-col gap-1.5">
                                    <div class="flex justify-between items-end">
                                        <div class="flex items-center gap-2">
                                            <span class="text-[12px] font-black text-text_primary font-mono">{bank.bank}</span>
                                            <span class="text-[7px] font-black px-1.5 py-0.5 bg-black/40 border border-border_main/30 text-text_secondary uppercase tracking-tighter">N={bank.total_articles}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <div class={`w-1.5 h-1.5 rounded-full ${bank.hawkish_pct > bank.dovish_pct ? 'bg-red-400' : (bank.dovish_pct > bank.hawkish_pct ? 'bg-emerald-400' : 'bg-text_secondary')} animate-pulse`}></div>
                                            <span class={`text-[9px] font-black tracking-widest uppercase ${bank.hawkish_pct > bank.dovish_pct ? 'text-red-400' : (bank.dovish_pct > bank.hawkish_pct ? 'text-emerald-400' : 'text-text_secondary')}`}>
                                                {bank.hawkish_pct > bank.dovish_pct ? 'HAWKISH' : (bank.dovish_pct > bank.hawkish_pct ? 'DOVISH' : 'NEUTRAL')}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Divergence Bar */}
                                    <div class="w-full h-3 bg-black/40 border border-border_main/20 flex overflow-hidden group/bar relative">
                                        <div 
                                            class="h-full bg-red-500/60 transition-all duration-1000 relative border-r border-black/20" 
                                            style={{ width: `${bank.hawkish_pct}%` }}
                                        >
                                            <Show when={bank.hawkish_pct > 20}>
                                                <span class="absolute inset-0 flex items-center justify-center text-[6px] font-black text-white/40 tracking-[0.2em] uppercase">HAWK</span>
                                            </Show>
                                        </div>
                                        <div 
                                            class="h-full bg-white/5 transition-all duration-1000" 
                                            style={{ width: `${bank.neutral_pct}%` }}
                                        ></div>
                                        <div 
                                            class="h-full bg-emerald-500/60 transition-all duration-1000 relative border-l border-black/20" 
                                            style={{ width: `${bank.dovish_pct}%` }}
                                        >
                                            <Show when={bank.dovish_pct > 20}>
                                                <span class="absolute inset-0 flex items-center justify-center text-[6px] font-black text-white/40 tracking-[0.2em] uppercase">DOVE</span>
                                            </Show>
                                        </div>
                                    </div>
                                    
                                    <div class="flex justify-between text-[7px] text-text_secondary font-mono px-1 opacity-50 uppercase tracking-widest font-black">
                                        <span>HAWKISH: {bank.hawkish_pct.toFixed(0)}%</span>
                                        <span>DOVISH: {bank.dovish_pct.toFixed(0)}%</span>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </Show>
            
            <div class="mt-4 pt-4 border-t border-border_main/10 opacity-30 flex items-center justify-between">
                <span class="text-[7px] font-black uppercase tracking-widest italic">Signal Engine Alpha v4.2</span>
                <span class="text-[7px] font-mono tracking-tighter">SOURCE: GLOBAL_SENTIMENT_NODE</span>
            </div>
        </div>
    );
}
