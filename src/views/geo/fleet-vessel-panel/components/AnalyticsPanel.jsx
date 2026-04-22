import { Show, For } from 'solid-js';

/**
 * Analytics Engine Hub - Real-time metrics and data intelligence
 */
export default function AnalyticsPanel(props) {
    const intelDossier = () => props.intelDossier();
    const marketData = () => props.marketData();
    const stormData = () => props.stormData();
    const disasterAlerts = () => props.disasterAlerts();

    return (
        <div class="p-6 space-y-8 overflow-y-auto h-full tactical-scrollbar bg-[#0a0b10]">
            {/* --- PHASE 2: DATA INTELLIGENCE HUD --- */}
            <section class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="h-px flex-1 bg-white/10"></div>
                    <span class="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Phase_02: Multi_Source_Alignment</span>
                    <div class="h-px flex-1 bg-white/10"></div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    {/* Weather-Vessel Overlay */}
                    <div class="p-4 bg-blue-500/5 border border-blue-500/20">
                        <h4 class="text-[9px] font-black text-blue-400 uppercase mb-3">Weather-Vessel_Overlay</h4>
                        <div class="space-y-2">
                            <Show when={stormData()} fallback={<span class="text-[8px] opacity-30">SCANNING_ATMOSPHERE_VECTORS...</span>}>
                                <div class="flex flex-col gap-2">
                                    <div class="flex justify-between items-center text-[8px] font-bold">
                                        <span class="text-white/60">STORM_ENTITY</span>
                                        <span class={stormData().storm?.severity > 50 ? 'text-red-400' : 'text-green-400'}>
                                            {stormData().storm?.severity > 50 ? 'ALERT_HIGH_RISK' : 'NOMINAL_FLOW'}
                                        </span>
                                    </div>
                                    <div class="h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div class="h-full bg-blue-500" style={`width: ${stormData().storm?.severity || 30}%`} />
                                    </div>
                                    <p class="text-[7px] text-blue-200/40 italic">Global_Storm_Radar monitoring theater vectors.</p>
                                </div>
                            </Show>
                        </div>
                    </div>

                    {/* Price Correlation Engine */}
                    <div class="p-4 bg-emerald-500/5 border border-emerald-500/20">
                        <h4 class="text-[9px] font-black text-emerald-400 uppercase mb-3">Supply_Chain_Integriy</h4>
                        <div class="flex items-end justify-between">
                            <div>
                                <span class="text-[22px] font-black text-white">{intelDossier()?.global_supply_integrity_score || 88}%</span>
                                <span class="text-[7px] block opacity-40 uppercase">System_Confidence_Rating</span>
                            </div>
                            <div class="text-right">
                                <span class="text-[8px] font-black text-emerald-400 uppercase">
                                    {intelDossier()?.global_supply_integrity_score > 70 ? 'STABLE' : 'FRAGILE'}
                                </span>
                                <span class="text-[7px] block opacity-40 uppercase">Real-Time Sync</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Crack Spread Calculator */}
                <div class="p-4 bg-orange-500/5 border border-orange-500/20">
                    <h4 class="text-[9px] font-black text-orange-400 uppercase mb-3 text-center">Proxy_Refinery_Intelligence (Operational_Margins)</h4>
                    <div class="grid grid-cols-3 gap-8">
                        <div class="text-center">
                            <span class="text-[14px] font-black text-white">${(marketData().oil * 1.15).toFixed(2)}</span>
                            <span class="text-[7px] block opacity-30 uppercase">Est_3-2-1_Margin</span>
                        </div>
                        <div class="text-center">
                            <span class="text-[14px] font-black text-white">{intelDossier()?.key_metrics.total_mbbl_on_water || '---'}MB</span>
                            <span class="text-[7px] block opacity-30 uppercase">On-Water_Inventory</span>
                        </div>
                        <div class="text-center">
                            <span class={`text-[14px] font-black ${intelDossier()?.key_metrics.active_anomalies > 5 ? 'text-red-500' : 'text-[#00f2ff]'}`}>
                                {intelDossier()?.key_metrics.active_anomalies > 5 ? 'VULNERABLE' : 'HEALTHY'}
                            </span>
                            <span class="text-[7px] block opacity-30 uppercase">Tactical_Signal</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- PHASE 3: ANALYTICS ENGINE HUD --- */}
            <section class="space-y-4">
                <div class="flex items-center gap-3 pt-4">
                    <div class="h-px flex-1 bg-white/10"></div>
                    <span class="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Phase_03: Intelligent_Computation</span>
                    <div class="h-px flex-1 bg-white/10"></div>
                </div>

                <div class="grid grid-cols-3 gap-4">
                    {/* Disruption Index */}
                    <div class="col-span-1 p-4 bg-red-500/5 border border-red-500/20 flex flex-col items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 bg-red-500/5 animate-pulse" />
                        <span class="text-[8px] font-black text-red-400 uppercase mb-1 z-10">Anomaly_Frequency</span>
                        <span class="text-[32px] font-black text-white z-10">{intelDossier()?.key_metrics.active_anomalies || 0}</span>
                        <span class="text-[8px] font-black text-white/20 uppercase z-10">DETECTED_EVENTS_24H</span>
                    </div>

                    {/* Predictive ETA Summary */}
                    <div class="col-span-2 p-4 bg-purple-600/5 border border-purple-600/20">
                        <h4 class="text-[9px] font-black text-purple-400 uppercase mb-3">Logistics_Flow_Predictor (System_Accuracy)</h4>
                        <div class="space-y-3">
                            <div class="flex justify-between items-center text-[9px] border-b border-white/5 pb-2">
                                <span class="text-white/60 uppercase">Registry_Trust_Score</span>
                                <span class="text-purple-400 font-bold">{((100 - (intelDossier()?.key_metrics.active_anomalies || 0)) * 0.95).toFixed(1)}%</span>
                            </div>
                            <div class="flex justify-between items-center text-[9px]">
                                <span class="text-white/60 uppercase">Chokepoint_Latency</span>
                                <span class="text-white/40">FACTOR: {(1.0 + (intelDossier()?.key_metrics.active_anomalies || 0) * 0.02).toFixed(2)}x</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="p-5 bg-white/5 border border-white/10">
                    <h4 class="text-[9px] font-black text-white opacity-40 uppercase mb-4">Refinery_Proximity_Queue_Tracker (Real-Time_Congestion)</h4>
                    <div class="py-6 text-center text-[8px] opacity-20 uppercase italic">SUBSYSTEM_OFFLINE_OR_NO_DATA</div>
                </div>

                {/* ENVIRONMENTAL HAZARD RADAR */}
                <div class="p-5 bg-red-900/10 border border-red-500/20">
                    <div class="flex items-center gap-2 mb-4">
                        <div class="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                        <h4 class="text-[9px] font-black text-red-500 uppercase tracking-widest">Environmental_Hazard_Radar (GDACS+NASA)</h4>
                    </div>
                    <div class="space-y-3">
                        <For each={disasterAlerts()}>
                            {(hazard) => (
                                <div class="p-3 bg-black/40 border-l-2 border-red-500/40 group hover:border-red-500 transition-all">
                                    <div class="flex justify-between items-start mb-1">
                                        <span class="text-[10px] font-black text-white uppercase">{hazard.type} // {hazard.name}</span>
                                        <span class={`text-[8px] font-black px-1.5 ${hazard.level === 'Red' ? 'bg-red-500 text-white' : 'bg-orange-500 text-black'}`}>
                                            {hazard.level.toUpperCase()}_ALERT
                                        </span>
                                    </div>
                                    <p class="text-[8px] text-white/40 italic leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
                                        {hazard.description}
                                    </p>
                                    <div class="mt-2 flex justify-between items-center">
                                        <span class="text-[7px] opacity-30">LOC: {hazard.lat.toFixed(3)}, {hazard.lon.toFixed(3)}</span>
                                        <button
                                            onClick={() => window.__mapInstance?.flyTo({ center: [hazard.lon, hazard.lat], zoom: 6 })}
                                            class="text-[7px] font-black text-red-400/60 hover:text-red-400 uppercase underline"
                                        >Fly_To_Event</button>
                                    </div>
                                </div>
                            )}
                        </For>
                        <Show when={disasterAlerts().length === 0}>
                            <div class="py-4 text-center text-[8px] opacity-20 uppercase italic">NO_IMMEDIATE_DISASTERS_IN_THEATER</div>
                        </Show>
                    </div>
                </div>
            </section>
        </div>
    );
}
