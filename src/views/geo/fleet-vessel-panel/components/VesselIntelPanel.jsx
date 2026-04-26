import { createSignal, onMount, For, Show } from 'solid-js';

const INTEL_API = import.meta.env.VITE_VESSEL_INTEL_API;
const API_TOKEN = localStorage.getItem('auth_token') || '';
const REQUEST_TIMEOUT = 30000; // 30 seconds

export default function VesselIntelPanel() {
    const [anomalies, setAnomalies] = createSignal([]);
    const [inventory, setInventory] = createSignal(null);
    const [signals, setSignals] = createSignal([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);
    const [lastUpdate, setLastUpdate] = createSignal(new Date().toLocaleTimeString());

    const fetchWithTimeout = (url, timeout = REQUEST_TIMEOUT) => {
        return Promise.race([
            fetch(url, {
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
        ]);
    };

    const validateResponse = (data, expectedFields) => {
        if (!data || typeof data !== 'object') return false;
        return expectedFields.every(field => field in data);
    };

    onMount(async () => {
        setLoading(true);
        setError(null);
        
        try {
            // Use Promise.allSettled for partial failure handling
            const results = await Promise.allSettled([
                fetchWithTimeout(`${INTEL_API}/api/v1/vessel/intelligence/anomalies`)
                    .then(r => r.ok ? r.json() : Promise.reject(`Status ${r.status}`)),
                fetchWithTimeout(`${INTEL_API}/api/v1/vessel/intelligence/inventory-model`)
                    .then(r => r.ok ? r.json() : Promise.reject(`Status ${r.status}`)),
                fetchWithTimeout(`${INTEL_API}/api/v1/vessel/intelligence/signals`)
                    .then(r => r.ok ? r.json() : Promise.reject(`Status ${r.status}`))
            ]);
            
            // Handle each result independently
            if (results[0].status === 'fulfilled') {
                const data = results[0].value;
                if (validateResponse(data, ['anomalies'])) {
                    setAnomalies(data.anomalies?.dark_vessels || []);
                } else {
                    setError('Invalid anomaly data format');
                }
            } else {
                console.warn('Anomalies fetch failed:', results[0].reason);
                setAnomalies([]);
            }
            
            if (results[1].status === 'fulfilled') {
                const data = results[1].value;
                if (validateResponse(data, ['floating_inventory'])) {
                    setInventory(data);
                } else {
                    setError('Invalid inventory data format');
                }
            } else {
                console.warn('Inventory fetch failed:', results[1].reason);
                setInventory(null);
            }
            
            if (results[2].status === 'fulfilled') {
                const data = results[2].value;
                if (validateResponse(data, ['signals'])) {
                    setSignals(data.signals || []);
                } else {
                    setError('Invalid signal data format');
                }
            } else {
                console.warn('Signals fetch failed:', results[2].reason);
                setSignals([]);
            }
            
            setLastUpdate(new Date().toLocaleTimeString());
            
        } catch (e) {
            console.error('Vessel Intel fetch error:', e);
            setError(`Failed to load intelligence data: ${e.message}`);
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
            
            <Show when={error()}>
                <div class="p-4 bg-red-900/20 border border-red-500/50 rounded text-[9px] text-red-300 mb-4">
                    {error()}
                </div>
            </Show>
            
            <Show when={!loading()} fallback={<div class="flex items-center gap-2 text-[10px] text-[#00f2ff]"><div class="w-4 h-4 border-2 border-[#00f2ff] border-t-transparent animate-spin rounded-full"></div> DECRYPTING DATA...</div>}>
                <div class="flex justify-between items-center mb-4 text-[7px] opacity-50">
                    <span>Last Update: {lastUpdate()}</span>
                    <span>Status: Connected</span>
                </div>
                <div class="space-y-6">
                    {/* INVENTORY MODEL */}
                    <Show when={inventory()}>
                        <div class="border border-white/10 bg-black/40 p-4">
                            <h3 class="text-[10px] font-black text-zinc-400 mb-3 tracking-widest border-b border-white/5 pb-2">FLOATING INVENTORY MODEL</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="flex flex-col gap-1">
                                    <span class="text-[8px] opacity-50">Total Monitored MBbls</span>
                                    <span class="text-[14px] font-black text-[#00f2ff]">{Math.round(inventory().total_monitored_mbbl * 10) / 10} MBbls</span>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span class="text-[8px] opacity-50">Total Vessels</span>
                                    <span class="text-[14px] font-black text-white">{inventory().total_vessels || 0}</span>
                                </div>
                                <div class="flex flex-col gap-1 col-span-2">
                                    <span class="text-[8px] opacity-50">Confidence Level</span>
                                    <span class="text-[9px] font-bold text-green-400">{inventory().data_quality?.confidence_level || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* ANOMALIES */}
                    <div class="border border-white/10 bg-black/40 p-4">
                        <h3 class="text-[10px] font-black text-red-400 mb-3 tracking-widest border-b border-red-500/20 pb-2">VESSEL ANOMALIES ({anomalies().length})</h3>
                        <div class="space-y-2 max-h-[300px] overflow-y-auto win-scroll pr-2">
                            <For each={anomalies().slice(0, 20)} fallback={<div class="text-[9px] opacity-50 italic">NO ANOMALIES DETECTED</div>}>
                                {(ano) => (
                                    <div class="p-3 bg-red-900/10 border border-red-500/20 flex flex-col gap-1 hover:bg-red-900/20 transition-all">
                                        <div class="flex justify-between">
                                            <span class="text-[10px] font-black text-white">{ano.name || 'Unknown'} (MMSI: {ano.mmsi})</span>
                                            <span class="text-[8px] font-bold text-red-500 px-1 border border-red-500/50 bg-red-500/10">DARK</span>
                                        </div>
                                        <span class="text-[9px] opacity-70">Last seen: {new Date(ano.last_seen).toLocaleString()}</span>
                                        <span class="text-[7px] text-zinc-500 mt-1">Signals: {ano.signal_count || 0}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* TRADING SIGNALS */}
                    <div class="border border-white/10 bg-black/40 p-4">
                        <h3 class="text-[10px] font-black text-green-400 mb-3 tracking-widest border-b border-green-500/20 pb-2">TRADING SIGNALS ({signals().length})</h3>
                        <div class="space-y-2 max-h-[300px] overflow-y-auto win-scroll pr-2">
                            <For each={signals().slice(0, 20)} fallback={<div class="text-[9px] opacity-50 italic">NO SIGNALS GENERATED</div>}>
                                {(sig) => (
                                    <div class={`p-3 border flex flex-col gap-1 transition-all ${sig.action === 'BUY' ? 'bg-green-900/10 border-green-500/20' : sig.action === 'SELL' ? 'bg-red-900/10 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-black text-white">{sig.asset || 'Unknown'}</span>
                                            <span class={`text-[10px] font-black ${sig.action === 'BUY' ? 'text-green-500' : sig.action === 'SELL' ? 'text-red-500' : 'text-zinc-400'}`}>{sig.action || 'N/A'}</span>
                                        </div>
                                        <span class="text-[9px] opacity-70">{sig.rationale}</span>
                                        <div class="flex justify-between mt-2 pt-2 border-t border-current/10">
                                            <span class="text-[8px] opacity-50">Confidence: {Math.round((sig.confidence || 0) * 100)}%</span>
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
