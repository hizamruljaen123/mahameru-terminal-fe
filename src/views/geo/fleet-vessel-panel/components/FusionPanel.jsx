import { Show, For } from 'solid-js';
import { getRiskColor } from '../../../../utils/analysis/vesselIntel';

/**
 * Fusion analysis panel showing Supply Chain Fusion Intelligence
 * Ported from legacy v6 terminal with modular improvements
 */
export default function FusionPanel(props) {
    const weatherCodeMap = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
        55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
        71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 95: 'Thunderstorm'
    };

    const getWeatherEmoji = (code) => {
        if (code === 0) return '☀️'; if (code <= 3) return '🌤️'; if (code <= 48) return '🌫️';
        if (code <= 55) return '🌦️'; if (code <= 65) return '🌧️'; if (code <= 75) return '❄️';
        if (code <= 95) return '🌩️'; return '☁️';
    };

    return (
        <div class="h-full flex flex-col p-6 space-y-6 overflow-y-auto tactical-scrollbar bg-[#06070a]/40">
            <Show when={props.fusionLoading()}>
                <div class="flex flex-col items-center justify-center py-10 gap-3 opacity-50">
                    <div class="w-8 h-8 border-2 border-[#00f2ff] border-t-transparent rounded-full animate-spin"></div>
                    <span class="text-[9px] font-black uppercase tracking-widest text-[#00f2ff]">Syncing logistics flow...</span>
                </div>
            </Show>

            <Show when={props.fusionResults() && !props.fusionLoading()} fallback={
                <Show when={!props.fusionLoading()}>
                    <div class="flex flex-col items-center justify-center py-20 opacity-20 text-center gap-4">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                        <div class="space-y-1">
                            <span class="text-[10px] font-black uppercase tracking-widest">Waiting for data quorum</span>
                            <p class="text-[8px] max-w-[200px] mx-auto uppercase">Data sedang dikumpulkan. Pemetaan arus logistik akan muncul secara otomatis berdasarkan kepadatan kapal.</p>
                        </div>
                    </div>
                </Show>
            }>
                {/* MACRO_ENVIRONMENT_STRIP: WEATHER & MARKET */}
                <div class="bg-black/40 border border-[#00f2ff]/30 p-4 flex flex-col gap-4 shadow-[0_0_15px_rgba(0,242,255,0.05)]">
                    {/* MINIMALIST WEATHER */}
                    <Show when={props.weatherData()}>
                        <div class="flex items-center justify-between border-b border-[#00f2ff]/10 pb-4">
                            <div class="flex items-center gap-4">
                                <div class="text-[24px] opacity-90">{getWeatherEmoji(props.weatherData().weathercode)}</div>
                                <div class="flex flex-col">
                                    <span class="text-[6px] font-black text-cyan-400/60 uppercase tracking-widest">Atmospheric_Intel</span>
                                    <span class="text-[10px] font-black text-white leading-none mt-1">{weatherCodeMap[props.weatherData().weathercode]} // {Math.round(props.weatherData().temperature)}°C</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-end">
                                <span class="text-[6px] font-black text-cyan-400/60 uppercase tracking-widest">Wind_Vectors</span>
                                <span class="text-[10px] font-black text-white leading-none mt-1">{props.weatherData().windspeed} KM/H @ {props.weatherData().winddirection}°</span>
                            </div>
                        </div>
                    </Show>

                    {/* MINIMALIST COMMODITY MARKET */}
                    <div class="flex items-center justify-between">
                        <div class="flex flex-col">
                            <span class="text-[6px] font-black text-white/40 uppercase tracking-widest">Global_Oil_Brent</span>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-sm font-black text-orange-500">${props.marketData().oil.toFixed(2)}</span>
                                <span class={`text-[8px] font-black ${props.marketData().oilChg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {props.marketData().oilChg >= 0 ? '▲' : '▼'}{Math.abs(props.marketData().oilChg).toFixed(2)}%
                                </span>
                            </div>
                        </div>

                        <div class="flex items-center gap-6">
                            <div class="flex flex-col items-end">
                                <span class="text-[6px] font-black text-white/40 uppercase tracking-widest">USD_INDEX</span>
                                <span class="text-[10px] font-black text-cyan-400 mt-1">{props.marketData().usd.toFixed(2)}</span>
                            </div>
                            <div class="w-px h-6 bg-white/10"></div>
                            <div class="flex flex-col items-end">
                                <span class="text-[6px] font-black text-white/40 uppercase tracking-widest">LOCAL_FX</span>
                                <span class="text-[10px] font-black text-purple-400 mt-1">{props.marketData().fx.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SUMMARY CARDS */}
                <div class="flex items-center justify-between">
                    <div class="text-[10px] font-black uppercase text-orange-400 flex items-center gap-2">
                        <div class="w-2 h-2 bg-orange-500 animate-pulse"></div>
                        Fusion_Batch_Recon
                    </div>
                    <button
                        onClick={props.onToggleFlows}
                        class={`px-3 py-1 border text-[7px] font-black transition-all ${props.showAllFlows() ? 'bg-orange-500 text-black border-orange-500' : 'text-orange-500 border-orange-500/30'}`}
                    >
                        {props.showAllFlows() ? 'LOGISTICS_MESH_ACTIVE' : 'LOGISTICS_MESH_HIDDEN'}
                    </button>
                </div>

                <div class="grid grid-cols-3 gap-4">
                    <div class="bg-blue-500/10 border border-blue-500/30 p-4">
                        <div class="text-[7px] text-blue-400 uppercase font-black mb-1">Terminal_Ops</div>
                        <div class="text-[24px] font-black text-blue-400 font-mono leading-none">{props.fusionResults().summary.at_terminal}</div>
                    </div>
                    <div class="bg-[#00f2ff]/10 border border-[#00f2ff]/30 p-4">
                        <div class="text-[7px] text-[#00f2ff] uppercase font-black mb-1">Approach</div>
                        <div class="text-[24px] font-black text-white font-mono leading-none">{props.fusionResults().summary.in_approach}</div>
                    </div>
                    <div class="bg-white/5 border border-white/10 p-4">
                        <div class="text-[7px] opacity-40 uppercase font-black mb-1">Batch_Size</div>
                        <div class="text-[24px] font-black text-white font-mono leading-none">{props.fusionResults().summary.total_analyzed}</div>
                    </div>
                </div>

                <div class="p-4 bg-blue-500/5 border-l-2 border-blue-500">
                    <p class="text-[10px] text-blue-200/80 italic leading-relaxed uppercase tracking-tighter">
                        {props.fusionResults().summary.intelligence_summary}
                    </p>
                </div>

                {/* LOGISTICS LIST */}
                <div class="space-y-4 pt-4">
                    <div class="text-[8px] font-black opacity-30 uppercase tracking-[0.2em] border-b border-white/10 pb-2">Supply_Chain_Flow_Registry</div>
                    <div class="divide-y divide-white/5 bg-black/20 border border-white/5">
                        <For each={props.fusionResults().details}>
                            {(item) => (
                                <div
                                    onClick={() => props.onSelectVessel(item.mmsi, item.lat, item.lon)}
                                    class="p-4 hover:bg-white/[0.03] cursor-pointer group transition-all flex flex-col gap-3"
                                >
                                    <div class="flex items-center justify-between w-full">
                                        <div class="flex flex-col">
                                            <div class="flex items-center gap-2">
                                                <span class={`text-[10px] font-black group-hover:text-[#00f2ff] uppercase tracking-tighter transition-colors ${item.is_energy_asset ? 'text-orange-400' : 'text-white'}`}>{item.name}</span>
                                                {item.is_energy_asset && <span class="text-[6px] bg-orange-500/20 text-orange-400 px-1 font-black border border-orange-500/40">ENERGY</span>}
                                            </div>
                                            <span class="text-[8px] opacity-40 uppercase mt-0.5">{item.type} // MMSI: {item.mmsi}</span>
                                        </div>
                                        <div class="flex items-center gap-8">
                                            <div class="flex flex-col items-end">
                                                <span class="text-[10px] font-black text-white">{item.distance_port_km} KM</span>
                                                <span class="text-[7px] opacity-30 uppercase tracking-tighter">Port: {item.destination_port}</span>
                                            </div>
                                            <div class={`w-28 px-2 py-1 text-[8px] font-black text-center border shadow-sm ${
                                                item.status === 'AT_DOCK/ANCHORED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10' :
                                                item.status === 'TERMINAL_ZONE' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-blue-500/10' :
                                                'bg-white/5 text-white/50 border-white/10'
                                            }`}>
                                                {item.status.replace('_', ' ')}
                                            </div>
                                        </div>
                                    </div>

                                    <Show when={item.closest_refinery}>
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                props.onSelectRefinery(item.closest_refinery);
                                            }}
                                            class="mx-0 p-3 bg-orange-500/5 border border-orange-500/20 flex items-center justify-between hover:bg-orange-500/15 transition-all group/ref"
                                        >
                                            <div class="flex items-center gap-3">
                                                <div class="w-1.5 h-1.5 bg-orange-500/60 group-hover/ref:bg-orange-500 rounded-full"></div>
                                                <div class="flex flex-col">
                                                    <span class="text-[8px] font-black text-orange-400 uppercase tracking-tighter">Proximal_Refinery: {item.closest_refinery.name}</span>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-4">
                                                <span class="text-[8px] font-bold text-white/40 uppercase">Distance: {item.closest_refinery.distance_km} KM</span>
                                                <div class="w-4 h-px bg-orange-500/20"></div>
                                                <span class="text-[7px] font-black text-orange-500 opacity-60 group-hover/ref:opacity-100 underline tracking-widest">MAP_ROUTE</span>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </Show>
        </div>
    );
}