import { createSignal, onMount, For, Show } from 'solid-js';

const INTEL_API = import.meta.env.VITE_VESSEL_INTEL_API;

export default function VesselIntelPanel() {
    const [anomalies, setAnomalies] = createSignal([]);
    const [inventory, setInventory] = createSignal(null);
    const [signals, setSignals] = createSignal([]);
    const [loading, setLoading] = createSignal(true);

    onMount(async () => {
        try {
            const [anoRes, invRes, sigRes] = await Promise.all([
                fetch(`${INTEL_API}/api/intelligence/anomalies`),
                fetch(`${INTEL_API}/api/intelligence/inventory-model`),
                fetch(`${INTEL_API}/api/intelligence/signals`)
            ]);
            
            if (anoRes.ok) {
                const data = await anoRes.json();
                setAnomalies(data.anomalies || []);
            }
            if (invRes.ok) {
                const data = await invRes.json();
                setInventory(data.data);
            }
            if (sigRes.ok) {
                const data = await sigRes.json();
                setSignals(data.signals || []);
            }
        } catch (e) {
            console.error("Vessel Intel fetch error:", e);
        } finally {
            setLoading(false);
        }
    });

    return (
        <div class="h-full w-full bg-[#06070a]/90 text-white overflow-y-auto win-scroll p-4 font-mono uppercase">
            <div class="flex items-center gap-2 mb-6 border-b border-white/10 pb-2">
                <div class="w-2 h-2 bg-[#00f2ff] animate-pulse"></div>
                <h2 class="text-[12px] font-black tracking-[0.2em] text-[#00f2ff]">Supply Chain Intelligence</h2>
            </div>
            
            <Show when={!loading()} fallback={<div class="flex items-center gap-2 text-[10px] text-[#00f2ff]"><div class="w-4 h-4 border-2 border-[#00f2ff] border-t-transparent animate-spin rounded-full"></div> DECRYPTING DATA...</div>}>
                <div class="space-y-6">
                    {/* INVENTORY MODEL */}
                    <Show when={inventory()}>
                        <div class="border border-white/10 bg-black/40 p-4">
                            <h3 class="text-[10px] font-black text-zinc-400 mb-3 tracking-widest border-b border-white/5 pb-2">FLOATING INVENTORY MODEL</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="flex flex-col gap-1">
                                    <span class="text-[8px] opacity-50">Total Floating Volume</span>
                                    <span class="text-[14px] font-black text-[#00f2ff]">{inventory().total_floating_volume_bbls?.toLocaleString()} BBLS</span>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span class="text-[8px] opacity-50">Active VLCCs</span>
                                    <span class="text-[14px] font-black text-white">{inventory().active_vlccs}</span>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* ANOMALIES */}
                    <div class="border border-white/10 bg-black/40 p-4">
                        <h3 class="text-[10px] font-black text-red-400 mb-3 tracking-widest border-b border-red-500/20 pb-2">VESSEL ANOMALIES</h3>
                        <div class="space-y-2 max-h-[300px] overflow-y-auto win-scroll pr-2">
                            <For each={anomalies()} fallback={<div class="text-[9px] opacity-50 italic">NO ANOMALIES DETECTED</div>}>
                                {(ano) => (
                                    <div class="p-3 bg-red-900/10 border border-red-500/20 flex flex-col gap-1 hover:bg-red-900/20 transition-all">
                                        <div class="flex justify-between">
                                            <span class="text-[10px] font-black text-white">{ano.vessel_name} (MMSI: {ano.mmsi})</span>
                                            <span class="text-[8px] font-bold text-red-500 px-1 border border-red-500/50 bg-red-500/10">{ano.type}</span>
                                        </div>
                                        <span class="text-[9px] opacity-70">{ano.details}</span>
                                        <span class="text-[7px] text-zinc-500 mt-1">{new Date(ano.timestamp).toLocaleString()}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* TRADING SIGNALS */}
                    <div class="border border-white/10 bg-black/40 p-4">
                        <h3 class="text-[10px] font-black text-green-400 mb-3 tracking-widest border-b border-green-500/20 pb-2">TRADING SIGNALS</h3>
                        <div class="space-y-2 max-h-[300px] overflow-y-auto win-scroll pr-2">
                            <For each={signals()} fallback={<div class="text-[9px] opacity-50 italic">NO SIGNALS GENERATED</div>}>
                                {(sig) => (
                                    <div class={`p-3 border flex flex-col gap-1 transition-all ${sig.action === 'BUY' ? 'bg-green-900/10 border-green-500/20' : sig.action === 'SELL' ? 'bg-red-900/10 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-black text-white">{sig.commodity}</span>
                                            <span class={`text-[10px] font-black ${sig.action === 'BUY' ? 'text-green-500' : sig.action === 'SELL' ? 'text-red-500' : 'text-zinc-400'}`}>{sig.action}</span>
                                        </div>
                                        <span class="text-[9px] opacity-70">{sig.rationale}</span>
                                        <div class="flex justify-between mt-2 pt-2 border-t border-current/10">
                                            <span class="text-[8px] opacity-50">Confidence: {sig.confidence * 100}%</span>
                                            <span class="text-[7px] text-zinc-500">{new Date(sig.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}
