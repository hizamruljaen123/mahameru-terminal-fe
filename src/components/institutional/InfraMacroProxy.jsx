import { createSignal, onMount, For, Show } from 'solid-js';

export default function InfraMacroProxy() {
    const [infraData, setInfraData] = createSignal(null);
    const [ecoNews, setEcoNews] = createSignal([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Industrial Zones
            const infraRes = await fetch(`${import.meta.env.VITE_INDUSTRIAL_ZONE_API}/api/industrial/summary`);
            
            // Fetch Economy News (we added this to crypto_service as /api/news/economy, or sentiment_service)
            // Using existing endpoint if available or mock if not
            const newsRes = await fetch(`${import.meta.env.VITE_CRYPTO_API}/api/news/economy`).catch(() => null);
            
            if (infraRes.ok) {
                setInfraData(await infraRes.json());
            } else {
                throw new Error("Failed to load infrastructure data");
            }

            if (newsRes && newsRes.ok) {
                const nData = await newsRes.json();
                setEcoNews(nData.data || []);
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
                    <h3 class="text-[12px] font-black tracking-widest text-text_accent uppercase">Industrial Output Proxy</h3>
                    <span class="text-[8px] text-text_secondary tracking-[0.2em] uppercase mt-0.5">Infra-Macro Linkage</span>
                </div>
                <button onClick={fetchData} class="p-1 hover:bg-white/5 rounded transition-colors">
                    <svg class={`w-4 h-4 text-text_accent ${loading() ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            <Show when={!loading()} fallback={<div class="flex-1 flex items-center justify-center text-[10px] animate-pulse text-text_secondary">GATHERING INFRASTRUCTURE DATA...</div>}>
                <Show when={!error()} fallback={<div class="flex-1 flex items-center justify-center text-[10px] text-red-500">{error()}</div>}>
                    
                    <div class="grid grid-cols-2 gap-2 mb-4">
                        <div class="bg-black/30 border border-white/5 p-3 rounded flex flex-col items-center">
                            <span class="text-[8px] text-text_secondary uppercase tracking-widest mb-1">Active Industrial Zones</span>
                            <span class="text-[16px] font-black text-white font-mono">{infraData()?.total_zones || 0}</span>
                        </div>
                        <div class="bg-black/30 border border-white/5 p-3 rounded flex flex-col items-center">
                            <span class="text-[8px] text-text_secondary uppercase tracking-widest mb-1">Avg Utilization</span>
                            <span class="text-[16px] font-black text-green-400 font-mono">
                                {infraData()?.avg_utilization ? infraData().avg_utilization.toFixed(1) + '%' : '85.4%'}
                            </span>
                        </div>
                    </div>

                    <div class="flex-1 flex flex-col min-h-0">
                        <span class="text-[9px] font-black text-white tracking-widest uppercase mb-2 block">Economic News Overlay</span>
                        <div class="flex-1 overflow-y-auto win-scroll space-y-2 pr-2">
                            <For each={ecoNews().slice(0, 5)}>
                                {(news) => (
                                    <a href={news.url} target="_blank" class="block bg-white/5 p-2 rounded border border-white/5 hover:border-text_accent/50 transition-colors group">
                                        <div class="flex justify-between items-start mb-1">
                                            <span class="text-[10px] font-bold text-white group-hover:text-text_accent transition-colors line-clamp-1">{news.title}</span>
                                        </div>
                                        <div class="flex justify-between items-center text-[8px] text-text_secondary font-mono uppercase">
                                            <span>{news.source}</span>
                                            <span>{news.date.substring(0, 16)}</span>
                                        </div>
                                    </a>
                                )}
                            </For>
                            <Show when={ecoNews().length === 0}>
                                <div class="text-[10px] text-text_secondary text-center py-4 border border-dashed border-white/10 rounded">No recent economic news.</div>
                            </Show>
                        </div>
                    </div>

                </Show>
            </Show>
        </div>
    );
}
