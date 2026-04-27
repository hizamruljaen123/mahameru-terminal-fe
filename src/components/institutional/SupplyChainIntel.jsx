import { createSignal, onMount, For, Show } from 'solid-js';

export default function SupplyChainIntel(props) {
    const [invData, setInvData] = createSignal(null);
    const [anomData, setAnomData] = createSignal(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Using default backend port 8100 as per python file, mapped via env in production
            const API_BASE = import.meta.env.VITE_VESSEL_INTEL_API || 'http://localhost:8100';

            const [invRes, anomRes] = await Promise.all([
                fetch(`${API_BASE}/intelligence/inventory-model`),
                fetch(`${API_BASE}/intelligence/anomalies`)
            ]);

            if (invRes.ok && anomRes.ok) {
                setInvData(await invRes.json());
                setAnomData(await anomRes.json());
            } else {
                setError('No Data Yet');
            }
        } catch (err) {
            setError('Connection to Vessel Intel Node failed.');
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
                <div>
                    <h3 class="text-[12px] font-black tracking-widest text-text_accent uppercase">Energy Supply Chain Intel</h3>
                    <div class="text-[8px] text-text_secondary font-mono tracking-widest mt-1">SATELLITE & AIS FUSION</div>
                </div>
                <button onClick={fetchData} class="p-1 hover:bg-white/5 rounded transition-colors">
                    <svg class={`w-4 h-4 text-text_accent ${loading() ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            <Show when={!loading()} fallback={<div class="flex-1 flex flex-col items-center justify-center text-[10px] animate-pulse text-text_secondary gap-2"><svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>TRACKING VESSELS...</span></div>}>
                <Show when={!error()} fallback={<div class="flex-1 flex items-center justify-center text-[10px] text-red-500">{error()}</div>}>

                    {/* Top Stats */}
                    <div class="flex gap-2 mb-4">
                        <div class="flex-1 bg-black/30 border border-white/5 p-3 rounded flex flex-col items-center">
                            <span class="text-[8px] text-text_secondary uppercase tracking-widest mb-1">Total Floating Inventory</span>
                            <span class="text-[16px] font-black text-blue-400 font-mono">{invData()?.total_monitored_mbbl?.toFixed(1)} <span class="text-[10px] opacity-50">MBBL</span></span>
                        </div>
                        <div class="flex-1 bg-black/30 border border-white/5 p-3 rounded flex flex-col items-center">
                            <span class="text-[8px] text-text_secondary uppercase tracking-widest mb-1">Detected Anomalies</span>
                            <span class="text-[16px] font-black text-red-400 font-mono">{anomData()?.anomalies?.count || 0} <span class="text-[10px] opacity-50">SHIPS</span></span>
                        </div>
                    </div>

                    <div class="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 win-scroll">
                        {/* Port Congestion / Floating Inventory Hubs */}
                        <div>
                            <span class="text-[9px] font-black text-white tracking-widest uppercase mb-2 block">Major Destination Hubs</span>
                            <div class="space-y-2">
                                <For each={invData()?.floating_inventory || []}>
                                    {(hub) => (
                                        <div class="flex items-center justify-between bg-white/5 p-2 rounded border border-white/5 group hover:bg-white/10 transition-colors">
                                            <div class="flex flex-col">
                                                <span class="text-[10px] font-bold text-white uppercase">{hub.destination}</span>
                                                <span class="text-[8px] text-text_secondary uppercase">{hub.vessel_count} Tankers En Route</span>
                                            </div>
                                            <div class="flex flex-col items-end">
                                                <span class="text-[11px] font-mono text-text_accent font-bold">{hub.estimated_mbbl?.toFixed(1)} MBBL</span>
                                                <div class="flex gap-1 mt-1">
                                                    <For each={Array(Math.min(5, Math.max(1, Math.ceil(hub.vessel_count / 5))))}>
                                                        {() => <div class="w-1 h-2 bg-text_accent opacity-60 rounded-sm"></div>}
                                                    </For>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>

                        {/* Anomalies List */}
                        <Show when={anomData()?.anomalies?.count > 0}>
                            <div>
                                <span class="text-[9px] font-black text-red-400 tracking-widest uppercase mb-2 block flex items-center gap-1">
                                    <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                    High Risk / Dark Vessels
                                </span>
                                <div class="space-y-1">
                                    <For each={anomData()?.anomalies?.dark_vessels?.slice(0, 5) || []}>
                                        {(v) => (
                                            <div class="flex justify-between items-center text-[9px] font-mono bg-red-500/10 p-1.5 rounded border border-red-500/20">
                                                <span class="text-red-300 truncate w-24" title={v.name}>{v.name}</span>
                                                <span class="text-text_secondary opacity-60">MMSI: {v.mmsi}</span>
                                                <span class="text-red-400 font-bold uppercase">SIGNAL LOST</span>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </Show>
                    </div>

                </Show>
            </Show>
        </div>
    );
}
