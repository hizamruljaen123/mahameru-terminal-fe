import { Show, For } from 'solid-js';

/**
 * PHASE 4 & 5: Intelligence Dossier & Trading Signals
 */
export default function IntelligencePanel(props) {
    const dossier = () => props.intelDossier();
    const loading = () => props.intelLoading();

    return (
        <div class="p-6 space-y-8 overflow-y-auto h-full tactical-scrollbar">
            <Show when={loading()}>
                <div class="flex flex-col items-center justify-center h-40 opacity-50">
                    <div class="w-6 h-6 border-b-2 border-orange-500 rounded-full animate-spin mb-2"></div>
                    <span class="text-[8px] font-black uppercase tracking-widest">Compiling Tactical Dossier...</span>
                </div>
            </Show>

            <Show when={dossier() && !loading()}>
                {/* DOSSIER HEADER */}
                <div class="bg-orange-900/20 border border-orange-500/40 p-4 relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-1 bg-orange-500 text-[6px] font-black text-black uppercase tracking-widest">CONFIDENTIAL</div>
                    <div class="flex flex-col gap-1">
                        <span class="text-[10px] font-black text-orange-400 uppercase tracking-tighter">{dossier().report_id}</span>
                        <h3 class="text-xl font-black text-white italic tracking-tighter uppercase leading-none mt-1">Daily Intelligence Dossier</h3>
                        <p class="text-[9px] text-orange-200/60 mt-2 font-medium leading-relaxed max-w-sm">{dossier().summary}</p>
                    </div>
                </div>

                {/* TACTICAL SIGNALS */}
                <div class="space-y-4">
                    <div class="flex items-center gap-2">
                        <div class="w-1.5 h-3 bg-emerald-500"></div>
                        <span class="text-[10px] font-black text-white uppercase tracking-widest">TACTICAL_SIGNAL_STREAM</span>
                    </div>
                    <div class="grid grid-cols-1 gap-2">
                        <For each={dossier().tactical_signals}>
                            {(sig) => (
                                <div class={`p-4 border-l-4 flex justify-between items-center transition-all hover:bg-white/[0.02] ${sig.direction === 'LONG' ? 'border-l-emerald-500 bg-emerald-500/5' : 'border-l-orange-500 bg-orange-500/5'}`}>
                                    <div class="flex flex-col gap-1 pr-4">
                                        <div class="flex items-center gap-3">
                                            <span class="text-xs font-black text-white">{sig.asset}</span>
                                            <span class={`text-[8px] font-black px-1.5 py-0.5 rounded-sm ${sig.direction === 'LONG' ? 'bg-emerald-500 text-black' : 'bg-orange-500 text-black'}`}>{sig.direction}</span>
                                            <span class="text-[7px] font-black text-white/40 uppercase">Conviction: {sig.conviction}</span>
                                        </div>
                                        <p class="text-[9px] text-white/70 leading-relaxed font-medium">{sig.reason}</p>
                                    </div>
                                    <div class="flex flex-col items-end">
                                        <span class="text-[7px] font-black text-white/30 uppercase">RISK_SCORE</span>
                                        <span class="text-lg font-black font-mono text-white/90">{sig.risk_score}</span>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>

                {/* PROXY INVENTORY MODEL */}
                <div class="space-y-3">
                    <div class="flex items-center gap-2">
                        <div class="w-1.5 h-3 bg-blue-500"></div>
                        <span class="text-[10px] font-black text-white uppercase tracking-widest">PROX_INVENTORY_MODEL (ON-WATER)</span>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <For each={dossier().inventory_hubs}>
                            {(hub) => (
                                <div class="bg-black/40 border border-white/10 p-3 hover:border-blue-500/40 transition-all">
                                    <span class="text-[7px] font-black text-white/30 uppercase block mb-0.5">HUB_NODE</span>
                                    <span class="text-[10px] font-black text-white block truncate uppercase">{hub.destination}</span>
                                    <div class="flex justify-between items-end mt-2">
                                        <div class="flex flex-col leading-none">
                                            <span class="text-[6px] text-blue-400/60 font-black uppercase">Estim_MBbl</span>
                                            <span class="text-base font-black text-white font-mono">{hub.estimated_mbbl.toFixed(1)}</span>
                                        </div>
                                        <div class="flex flex-col items-end leading-none">
                                            <span class="text-[8px] font-black text-blue-400">{hub.vessel_count} ASSETS</span>
                                            <span class="text-[6px] text-white/20 font-black uppercase tracking-tighter">TRANSIT: {hub.active_transit}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>

                {/* ANOMALY ALERT FEED */}
                <div class="space-y-3">
                    <div class="flex items-center gap-2">
                        <div class="w-1.5 h-3 bg-red-500"></div>
                        <span class="text-[10px] font-black text-white uppercase tracking-widest">REAL-TIME_ANOMALY_ALERTS</span>
                    </div>
                    <div class="divide-y divide-white/5 border border-white/5 bg-black/20">
                        <For each={dossier().tactical_signals.filter(s => s.risk_score > 60)}>
                            {(sig) => (
                                <div class="px-4 py-3 flex items-center gap-4 group">
                                    <div class="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></div>
                                    <div class="flex-1">
                                        <div class="text-[9px] font-black text-red-400 uppercase">HIGH_CONVICTION_SUPPLY_SHOCK</div>
                                        <div class="text-[8px] text-white/50 lowercase italic">{sig.reason}. Disruption identified at {new Date().toLocaleTimeString()}</div>
                                    </div>
                                    <button class="px-2 py-1 bg-white/5 border border-white/10 text-[7px] font-black text-white/60 uppercase hover:bg-red-500 hover:text-black hover:border-red-500 transition-all">INTERCEPT</button>
                                </div>
                            )}
                        </For>
                        <Show when={dossier().tactical_signals.filter(s => s.risk_score > 60).length === 0}>
                            <div class="p-8 text-center text-[9px] text-white/20 uppercase tracking-widest italic">ALL_SYSTEMS_OPERATIONAL // NO_ACTIVE_DEVIATIONS</div>
                        </Show>
                    </div>
                </div>
            </Show>
        </div>
    );
}
