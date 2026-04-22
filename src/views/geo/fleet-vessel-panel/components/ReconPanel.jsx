import { Show, Switch, Match, For } from 'solid-js';
import { getNasaSnapshotUrl } from '../utils/helpers';
import { getVesselColor } from '../../../../utils/analysis/vesselIntel';

/**
 * Tactical Reconnaissance Dossier
 * High-fidelity details for selected assets (Ships, Ports, Refineries)
 * Ported from FleetVesselPanel.txt
 */
export default function ReconPanel(props) {
    const ship = () => props.ship();
    const port = () => props.activePort?.();
    const refinery = () => props.activeRefinery?.();

    // Internal tab states for sub-sections
    const [dossierTab, setDossierTab] = props.dossierTabState || [() => 'SUMMARY', () => {}];
    const [reconTab, setReconTab] = props.reconTabState || [() => 'NASA', () => {}];
    const [portReconTab, setPortReconTab] = props.portReconTabState || [() => 'RADAR', () => {}];

    const weatherCodeMap = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
        55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
        71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 95: 'Thunderstorm'
    };

    return (
        <div class="w-[50%] flex flex-col h-full bg-black/40 border-l border-[#00f2ff]/10">
            <div class="h-6 bg-[#00f2ff]/10 flex items-center px-6 border-b border-[#00f2ff]/20">
                <span class="text-[8px] font-black tracking-widest text-[#00f2ff]">VESSEL DETAILS</span>
            </div>

            <div class="flex-1 p-6 overflow-y-auto tactical-scrollbar">
                <Switch fallback={
                    <div class="h-full flex flex-col items-center justify-center opacity-20 italic text-[10px] gap-4">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                        SELECT A VESSEL OR PORT
                    </div>
                }>
                    <Match when={ship()}>
                        {(v) => (
                            <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* DOSSIER TABS CONTROL */}
                                <div class="flex border-b border-white/10 sticky top-0 bg-[#0b0c10] z-30 pt-2 pb-0.5">
                                    <button
                                        onClick={() => setDossierTab('SUMMARY')}
                                        class={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${dossierTab() === 'SUMMARY' ? 'border-[#00f2ff] text-[#00f2ff]' : 'border-transparent text-white/40 hover:text-white'}`}
                                    >1. SUMMARY</button>

                                    <Show when={v().type?.toLowerCase().includes('tanker')}>
                                        <button
                                            onClick={() => setDossierTab('REPORT')}
                                            class={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${dossierTab() === 'REPORT' ? 'border-orange-500 text-orange-500 shadow-[0_5px_15px_rgba(249,115,22,0.2)]' : 'border-transparent text-white/40 hover:text-white'}`}
                                        >2. ANALYSIS</button>
                                    </Show>
                                </div>

                                <Switch>
                                    <Match when={dossierTab() === 'SUMMARY'}>
                                        <div class="space-y-6">
                                            <div class="flex justify-between items-start border-b border-[#00f2ff]/10 pb-4">
                                                <div>
                                                    <h2 class="text-lg font-black uppercase tracking-tighter leading-none" style={{ color: getVesselColor(v().type) }}>{v().name || 'Unknown'}</h2>
                                                    <span class="text-[9px] font-mono tracking-widest opacity-60" style={{ color: getVesselColor(v().type) }}>
                                                        {v().mmsi} {v().imo ? `// IMO: ${v().imo}` : ''} // {v().type || 'UNKNOWN'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div class="grid grid-cols-2 gap-y-4 gap-x-8">
                                                <div class="space-y-1">
                                                    <div class="text-[7px] opacity-40 uppercase tracking-widest">STATUS</div>
                                                    <div class="text-[10px] uppercase font-bold text-white">{v().status || 'ACTIVE'}</div>
                                                </div>
                                                <div class="space-y-1">
                                                    <div class="text-[7px] opacity-40 uppercase tracking-widest">SPEED</div>
                                                    <div class="text-[10px] uppercase font-bold text-[#00ff41]">{v().speed != null ? v().speed.toFixed(1) : '0.0'} KTS</div>
                                                </div>
                                                <div class="space-y-1">
                                                    <div class="text-[7px] opacity-40 uppercase tracking-widest">HEADING</div>
                                                    <div class="text-[10px] uppercase font-bold">{v().heading || '0'}°</div>
                                                </div>
                                                <div class="space-y-1">
                                                    <div class="text-[7px] opacity-40 uppercase tracking-widest">CATEGORY</div>
                                                    <div class="text-[10px] uppercase font-bold opacity-60">{v().type || 'VESSEL'}</div>
                                                </div>
                                            </div>

                                            <div class="p-4 bg-[#00f2ff]/5 border-l-2 border-[#00f2ff] space-y-2">
                                                <div class="text-[7px] opacity-40 uppercase tracking-widest">ROUTING</div>
                                                <div class="flex items-center gap-3">
                                                    <div class="flex flex-col">
                                                        <span class="text-[8px] opacity-30 italic">ORIGIN</span>
                                                        <span class="text-[11px] font-black uppercase tracking-tight">EN ROUTE</span>
                                                    </div>
                                                    <div class="flex-1 h-[1px] bg-[#00f2ff]/20 relative"></div>
                                                    <div class="flex flex-col text-right">
                                                        <span class="text-[8px] opacity-30 italic">DESTINATION</span>
                                                        <span class="text-[11px] font-black uppercase tracking-tight text-[#00f2ff]">{v().destination && v().destination !== 'N/A' ? v().destination : 'NOT DISCLOSED'}</span>
                                                    </div>
                                                </div>
                                                <div class="pt-2 flex justify-between text-[8px] opacity-60">
                                                    <span>ETA: {v().eta && v().eta !== 'N/A' ? v().eta : 'UNK'}</span>
                                                    <span>LAT: {v().lat?.toFixed(5)}</span>
                                                    <span>LON: {v().lon?.toFixed(5)}</span>
                                                </div>
                                            </div>

                                            {/* REFINERY PROXIMITY HUD */}
                                            <Show when={v().closest_refinery}>
                                                <div class="p-4 bg-orange-500/10 border border-orange-500/30 space-y-3">
                                                    <div class="flex items-center justify-between">
                                                        <div class="flex items-center gap-2">
                                                            <div class="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                                            <span class="text-[10px] font-black text-orange-400 uppercase">REFINERY PROXIMITY</span>
                                                        </div>
                                                        <span class="text-[9px] font-black text-white">{v().closest_refinery.distance_km} KM</span>
                                                    </div>
                                                    <button
                                                        onClick={() => props.onSelectRefinery(v().closest_refinery)}
                                                        class="w-full py-2 bg-orange-500 text-black text-[9px] font-black uppercase hover:bg-white transition-all"
                                                    >ANALYZE ROUTE</button>
                                                </div>
                                            </Show>

                                            {/* VISUAL INTELLIGENCE TERMINAL */}
                                            <div class="space-y-4">
                                                <div class="flex items-center justify-between border-b border-[#00f2ff]/10 pb-1">
                                                    <span class="text-[10px] opacity-60 font-black tracking-widest uppercase">SATELLITE VIEW</span>
                                                    <div class="flex border border-[#00f2ff]/20 p-0.5">
                                                        <button
                                                            onClick={() => setReconTab('NASA')}
                                                            class={`text-[8px] px-3 py-1 transition-all uppercase tracking-tighter ${reconTab() === 'NASA' ? 'bg-[#00f2ff] text-black font-black' : 'text-[#00f2ff]/40 hover:text-[#00f2ff]'}`}
                                                        >NASA VIEW</button>
                                                        <button
                                                            onClick={() => setReconTab('GOOGLE')}
                                                            class={`text-[8px] px-3 py-1 transition-all uppercase tracking-tighter ${reconTab() === 'GOOGLE' ? 'bg-[#00f2ff] text-black font-black' : 'text-[#00f2ff]/40 hover:text-[#00f2ff]'}`}
                                                        >GOOGLE MAPS</button>
                                                    </div>
                                                </div>
                                                <Show when={reconTab() === 'NASA'}>
                                                    <div class="space-y-3">
                                                        <img src={getNasaSnapshotUrl(v().lat, v().lon)} class="w-full aspect-video object-cover border border-[#00f2ff]/20" />
                                                    </div>
                                                </Show>
                                                <Show when={reconTab() === 'GOOGLE'}>
                                                    <div class="border border-white/10 p-1 bg-black shadow-2xl relative group">
                                                        <iframe
                                                            width="100%" height="250" frameborder="0" scrolling="no" class="grayscale-[20%] group-hover:grayscale-0 transition-all opacity-80 group-hover:opacity-100"
                                                            src={`https://maps.google.com/maps?q=${v().lat},${v().lon}&hl=id&z=17&t=k&output=embed`}>
                                                        </iframe>
                                                    </div>
                                                </Show>
                                            </div>
                                        </div>
                                    </Match>

                                    <Match when={dossierTab() === 'REPORT'}>
                                        <div class="space-y-6">
                                            <Show when={props.intelLoading()}>
                                                <div class="py-20 flex flex-col items-center justify-center gap-3 opacity-40">
                                                    <div class="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span class="text-[9px] font-black uppercase tracking-widest text-orange-400">Processing Data...</span>
                                                </div>
                                            </Show>

                                            <Show when={!props.intelLoading() && props.tacticalIntel()}>
                                                <div class="space-y-6 animate-in fade-in duration-500">
                                                    <div class="p-6 bg-orange-500/5 border border-orange-500/30 relative overflow-hidden group">
                                                        <h4 class="text-[11px] font-black text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                            <span class="w-1.5 h-1.5 bg-orange-500"></span> CALCULATED ETA (V3.1)
                                                        </h4>
                                                        <div class="grid grid-cols-2 gap-6">
                                                            <div class="flex flex-col">
                                                                <span class="text-[8px] opacity-40 uppercase font-black">ESTIMATED ARRIVAL</span>
                                                                <Show when={props.tacticalIntel().eta} fallback={<span class="text-[12px] font-black text-white/40">N/A (STATIONARY)</span>}>
                                                                    <span class="text-[20px] font-black text-white">{new Date(props.tacticalIntel().eta).toLocaleTimeString()}</span>
                                                                    <span class="text-[9px] text-orange-400/80 font-bold">{new Date(props.tacticalIntel().eta).toLocaleDateString()}</span>
                                                                </Show>
                                                            </div>
                                                            <div class="flex flex-col items-end">
                                                                <span class="text-[8px] opacity-40 uppercase font-black">TIME TO DESTINATION</span>
                                                                <span class="text-[20px] font-black text-white">{props.tacticalIntel().hours != null ? props.tacticalIntel().hours : '--'} <span class="text-[10px]">HRS</span></span>
                                                                <span class="text-[8px] font-black text-emerald-400 uppercase">Status: {props.tacticalIntel().status}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <Show when={props.stormData()}>
                                                        <div class="p-6 bg-blue-500/5 border border-blue-500/30">
                                                            <h4 class="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-4">WEATHER MONITORING</h4>
                                                            <p class="text-[9px] italic text-blue-200/50 leading-relaxed uppercase">
                                                                Vessel is currently operating in a potential high-swell zone. Monitoring wind vector deviation at 1.2s intervals.
                                                            </p>
                                                        </div>
                                                    </Show>
                                                </div>
                                            </Show>
                                        </div>
                                    </Match>
                                </Switch>
                            </div>
                        )}
                    </Match>

                    <Match when={port()}>
                        {(p) => (
                            <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div class="flex justify-between items-start border-b border-blue-500/20 pb-4">
                                    <div>
                                        <h2 class="text-xl font-black uppercase tracking-tighter leading-none text-blue-400">{p().name}</h2>
                                        <span class="text-[9px] font-mono tracking-widest opacity-60 text-blue-300">ID: {p().id} // TYPE: {p().harbor_type} // SIZE: {p().harbor_size}</span>
                                    </div>
                                </div>

                                <div class="grid grid-cols-2 gap-y-4 gap-x-8 text-[10px]">
                                    <div class="space-y-1">
                                        <div class="text-[7px] opacity-40 uppercase tracking-widest">REGION</div>
                                        <div class="font-bold text-white uppercase">{p().area_name || 'UNKNOWN'}</div>
                                    </div>
                                    <div class="space-y-1">
                                        <div class="text-[7px] opacity-40 uppercase tracking-widest">COUNTRY</div>
                                        <div class="font-bold text-blue-400 uppercase">{p().country_name || 'N/A'}</div>
                                    </div>
                                </div>

                                <div class="p-4 bg-blue-500/5 border-l-2 border-blue-500 space-y-2">
                                    <div class="text-[7px] opacity-40 uppercase tracking-widest">COORDINATES</div>
                                    <div class="flex justify-between text-[11px] font-black font-mono">
                                        <span>LAT: {p().latitude.toFixed(5)}</span>
                                        <span>LON: {p().longitude.toFixed(5)}</span>
                                    </div>
                                </div>

                                {/* PORT VISUAL INTELLIGENCE TERMINAL */}
                                <div class="space-y-4">
                                    <div class="flex items-center justify-between border-b border-blue-500/10 pb-1">
                                        <span class="text-[10px] opacity-60 font-black tracking-widest uppercase text-blue-400">PORT VIEW</span>
                                        <div class="flex border border-blue-500/20 p-0.5">
                                            <button
                                                onClick={() => setPortReconTab('RADAR')}
                                                class={`text-[8px] px-3 py-1 transition-all uppercase tracking-tighter ${portReconTab() === 'RADAR' ? 'bg-blue-600 text-white font-black' : 'text-blue-400/40 hover:text-blue-400'}`}
                                            >LIVE RADAR</button>
                                            <button
                                                onClick={() => setPortReconTab('NASA')}
                                                class={`text-[8px] px-3 py-1 transition-all uppercase tracking-tighter ${portReconTab() === 'NASA' ? 'bg-blue-600 text-white font-black' : 'text-blue-400/40 hover:text-blue-400'}`}
                                            >NASA PHOTO</button>
                                        </div>
                                    </div>

                                    <Switch>
                                        <Match when={portReconTab() === 'RADAR'}>
                                            <div class="border border-blue-500/30 p-0.5 bg-black shadow-2xl relative group">
                                                <iframe
                                                    width="100%" height="350" frameborder="0" style="filter: grayscale(0.6) contrast(1.2) brightness(0.9) invert(0.05);"
                                                    src={`https://www.vesselfinder.com/aismap?zoom=13&lat=${p().latitude}&lon=${p().longitude}&width=100%25&height=350&names=true&mmsi=0&track=true&fleet=false&fleet_id=0&vtype=0&show_names=1&show_tz=0`}
                                                ></iframe>
                                                <div class="absolute bottom-1 right-1 bg-black/80 px-2 py-1 text-[8px] text-white/40 font-mono tracking-tighter border border-white/5">RADAR FEED // SYNC</div>
                                            </div>
                                        </Match>
                                        <Match when={portReconTab() === 'NASA'}>
                                            <div class="space-y-3">
                                                <img src={getNasaSnapshotUrl(p().latitude, p().longitude)} class="w-full aspect-video object-cover border border-blue-500/20 grayscale" />
                                            </div>
                                        </Match>
                                    </Switch>
                                </div>
                            </div>
                        )}
                    </Match>

                    <Match when={refinery()}>
                        {(ref) => (
                            <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div class="flex justify-between items-start border-b border-orange-500/20 pb-4">
                                    <div>
                                        <h2 class="text-xl font-black uppercase tracking-tighter leading-none text-orange-400">{ref().name}</h2>
                                        <span class="text-[9px] font-mono tracking-widest opacity-60 text-orange-300">ENERGY INFRASTRUCTURE // {ref().country || 'N/A'}</span>
                                    </div>
                                </div>

                                <div class="p-4 bg-orange-500/5 border-l-2 border-orange-500 space-y-4">
                                    <div class="text-[8px] font-black opacity-40 uppercase tracking-widest text-orange-400/60">FACILITY DETAILS</div>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <div class="text-[7px] opacity-40 uppercase font-bold tracking-tighter">DAILY CAPACITY</div>
                                            <div class="text-[14px] font-black text-white">450,000 BPD <span class="text-[7px] opacity-30 font-normal">EST.</span></div>
                                        </div>
                                        <div>
                                            <div class="text-[7px] opacity-40 uppercase font-bold tracking-tighter">STORAGE UNITS</div>
                                            <div class="text-[14px] font-black text-white">42 TANKS</div>
                                        </div>
                                    </div>
                                </div>

                                <div class="space-y-3">
                                    <div class="text-[10px] font-black opacity-30 uppercase tracking-widest text-orange-400">TERRAIN VIEW</div>
                                    <div class="border border-orange-500/20 p-1 bg-black shadow-2xl relative overflow-hidden group">
                                        <iframe
                                            width="100%" height="250" frameborder="0" scrolling="no" class="grayscale-[40%] group-hover:grayscale-0 transition-all opacity-80 group-hover:opacity-100 scale-105"
                                            src={`https://maps.google.com/maps?q=${ref().lat},${ref().lon}&hl=id&z=17&t=k&output=embed`}>
                                        </iframe>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Match>
                </Switch>
            </div>
        </div>
    );
}