import { For, Show, createMemo } from 'solid-js';
import { calculateHaversineDistance } from '../utils/helpers';

export default function DisasterPanel(props) {
    const sortedDisasters = createMemo(() => {
        const ship = props.state.activeShip();
        const base = props.state.disasterAlerts() || [];
        
        if (!ship) return base;

        return [...base].map(d => {
            const dist = calculateHaversineDistance(
                ship.lat || ship.latitude, 
                ship.lon || ship.longitude, 
                d.lat, 
                d.lon
            );
            return { ...d, distance: dist };
        }).sort((a, b) => a.distance - b.distance);
    });

    const getAlertColor = (level) => {
        const l = String(level).toUpperCase();
        if (l === 'RED') return 'text-red-500 border-red-500/30 bg-red-500/10';
        if (l === 'ORANGE') return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
        return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
    };

    const getIcon = (type) => {
        const t = String(type).toUpperCase();
        if (t === 'TC' || t === 'TS') return '🌀'; // Tropical Cyclone / Storm
        if (t === 'VO') return '🌋'; // Volcano
        if (t === 'EQ') return '⚡'; // Earthquake
        if (t === 'FL') return '🌊'; // Flood
        return '⚠️';
    };

    return (
        <div class="flex flex-col h-full bg-[#06070a] font-mono">
            <div class="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-950/40">
                <div class="flex items-center gap-3">
                    <div class="w-1.5 h-4 bg-red-600 shadow-[0_0_10px_#dc2626]"></div>
                    <span class="text-[10px] font-black text-white tracking-[0.3em] uppercase">HAZARD_RECON_RADAR</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span class="text-[8px] font-black text-red-500 uppercase tracking-widest">Live_Uplink</span>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto win-scroll p-4 space-y-4">
                <Show when={sortedDisasters().length > 0} fallback={
                    <div class="h-full flex flex-col items-center justify-center opacity-20 py-20">
                        <span class="text-4xl mb-4">📡</span>
                        <span class="text-[10px] font-black tracking-[0.4em] uppercase">No_Active_Hazards</span>
                    </div>
                }>
                    <For each={sortedDisasters()}>
                        {(hazard) => (
                            <div 
                                onClick={() => {
                                    if (window.__mapInstance) {
                                        window.__mapInstance.flyTo({
                                            center: [hazard.lon, hazard.lat],
                                            zoom: 7,
                                            pitch: 45,
                                            duration: 2000
                                        });
                                    }
                                    if (props.onHazardSelect) props.onHazardSelect(hazard);
                                }}
                                class="group border border-white/5 bg-white/5 p-4 relative overflow-hidden transition-all hover:border-red-500/40 hover:bg-red-500/5 cursor-pointer"
                            >
                                <div class="flex justify-between items-start mb-3">
                                    <div class="flex items-center gap-3">
                                        <span class="text-2xl">{getIcon(hazard.type)}</span>
                                        <div class="flex flex-col">
                                            <span class="text-[11px] font-black text-white uppercase group-hover:text-red-400 transition-colors">{hazard.name}</span>
                                            <span class="text-[8px] text-white/30 uppercase tracking-tighter">TYPE: {hazard.type} // SRC: {hazard.source || 'GDACS'}</span>
                                        </div>
                                    </div>
                                    <span class={`text-[8px] font-black px-2 py-0.5 border rounded-sm uppercase ${getAlertColor(hazard.level)}`}>
                                        {hazard.level}_ALERT
                                    </span>
                                </div>

                                <Show when={hazard.distance !== undefined}>
                                    <div class="flex items-center justify-between bg-black/40 border-l-2 border-red-600 px-3 py-2 mb-3">
                                        <div class="flex flex-col">
                                            <span class="text-[7px] text-red-400 font-bold uppercase tracking-widest">ASSET_PROXIMITY</span>
                                            <span class="text-[14px] font-black text-white tracking-tighter">{Math.round(hazard.distance).toLocaleString()} KM</span>
                                        </div>
                                        <div class="text-right">
                                            <span class="text-[7px] text-white/30 font-bold uppercase block">STATUS</span>
                                            <span class={`text-[9px] font-black ${hazard.distance < 500 ? 'text-red-500' : hazard.distance < 1500 ? 'text-orange-500' : 'text-emerald-500'}`}>
                                                {hazard.distance < 500 ? 'CRITICAL_RISK' : hazard.distance < 1500 ? 'MODERATE_DANGER' : 'LOW_IMPACT'}
                                            </span>
                                        </div>
                                    </div>
                                </Show>

                                <div class="text-[9px] text-white/60 leading-relaxed line-clamp-2 uppercase italic mb-3 opacity-80">
                                    {hazard.description || 'Global observation data pending detailed atmospheric analysis.'}
                                </div>

                                <Show when={props.state.activeHazard()?.id === hazard.id && props.state.nearestPortToHazard()}>
                                    <div class="bg-white/5 border-l-2 border-white px-3 py-2 mb-3 animate-in fade-in slide-in-from-right duration-500">
                                        <div class="flex justify-between items-center">
                                            <div class="flex flex-col">
                                                <span class="text-[7px] text-white/50 font-bold uppercase tracking-widest">NEAREST CRITICAL PORT</span>
                                                <span class="text-[10px] font-black text-[#00f2ff] uppercase tracking-tighter">
                                                    {props.state.nearestPortToHazard().name}
                                                </span>
                                            </div>
                                            <div class="text-right">
                                                <span class="text-[14px] font-black text-white">
                                                    {props.state.nearestPortToHazard().distance_km} KM
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Show>

                                <div class="flex items-center justify-between pt-3 border-t border-white/5">
                                    <div class="text-[8px] font-mono text-white/20">
                                        LAT: {hazard.lat.toFixed(4)} // LON: {hazard.lon.toFixed(4)}
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (window.__mapInstance) {
                                                window.__mapInstance.flyTo({
                                                    center: [hazard.lon, hazard.lat],
                                                    zoom: 7,
                                                    pitch: 45,
                                                    duration: 2000
                                                });
                                            }
                                        }}
                                        class="px-3 py-1 bg-white/5 border border-white/10 text-[8px] font-black text-white uppercase hover:bg-white/10 transition-colors"
                                    >
                                        RECON_FOCUS
                                    </button>
                                </div>
                            </div>
                        )}
                    </For>
                </Show>
            </div>

            <div class="p-4 border-t border-white/5 bg-zinc-950/20 text-center">
                <span class="text-[7px] font-bold text-white/20 uppercase tracking-[0.5em]">Global_Disaster_Intelligence_Network_v1.3</span>
            </div>
        </div>
    );
}
