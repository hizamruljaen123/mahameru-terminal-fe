import { createSignal, onMount, For, Show } from 'solid-js';

export default function MarketRiskPanel() {
    const [events, setEvents] = createSignal([]);
    const [loading, setLoading] = createSignal(true);

    onMount(async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_CONFLICT_API}/api/conflict/summary`);
            const data = await resp.json();
            if (Array.isArray(data)) {
                // Sort by highest risk
                setEvents(data.sort((a, b) => parseInt(b.index_keparahan || 0) - parseInt(a.index_keparahan || 0)));
            }
        } catch (err) {
            console.error("Conflict API Error:", err);
        } finally {
            setLoading(false);
        }
    });

    const getRiskColor = (sev) => {
        if (sev >= 90) return 'bg-red-500/20 text-red-500 border-red-500/50';
        if (sev >= 80) return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
        if (sev >= 70) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
        return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
    };

    return (
        <div class="h-full w-full bg-black text-white p-6 overflow-y-auto win-scroll font-mono uppercase">
            <div class="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                <div class="w-2 h-2 bg-red-500 animate-pulse"></div>
                <h2 class="text-[14px] font-black tracking-[0.3em] text-white">Market Risk Heatmap</h2>
            </div>
            
            <Show when={!loading()} fallback={<div class="flex items-center gap-3 text-[10px] text-text_accent"><div class="w-4 h-4 border-2 border-text_accent border-t-transparent animate-spin rounded-full"></div> LOADING RISK DATA...</div>}>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <For each={events()}>
                        {(event) => (
                            <div class={`p-4 border ${getRiskColor(parseInt(event.index_keparahan))} flex flex-col gap-2 relative overflow-hidden group`}>
                                <div class="flex justify-between items-start">
                                    <span class="text-[14px] font-black tracking-widest">{event.negara}</span>
                                    <span class="text-[16px] font-black tabular-nums">{event.index_keparahan}</span>
                                </div>
                                <span class="text-[9px] font-bold opacity-80">{event.detail_konflik}</span>
                                <div class="mt-4 pt-4 border-t border-current/20">
                                    <span class="text-[8px] font-bold opacity-60 block mb-1">IMPACT & INVOLVED PARTIES</span>
                                    <span class="text-[9px] line-clamp-2 leading-relaxed">{event.daftar_pihak_terlibat}</span>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
}
