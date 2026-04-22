import { For, Show } from 'solid-js';

export default function DatacenterSidebar(props) {
    return (
        <Show when={props.selectedDC()}>
            <div class="w-[350px] bg-black/95 border-l border-cyan-500/20 backdrop-blur-xl flex flex-col animate-slide-left z-30 font-mono uppercase">
                <div class="p-4 border-b border-cyan-500/20 flex justify-between items-center bg-cyan-500/5">
                    <div class="flex flex-col">
                        <span class="text-[8px] font-black text-cyan-400 tracking-widest uppercase italic leading-none">ASSET ACTIVE</span>
                        <span class="text-[10px] font-black text-white mt-1 truncate w-48">{props.selectedDC().facility_name}</span>
                    </div>
                    <button 
                        onClick={() => props.setSelectedDC(null)}
                        class="text-[9px] font-black border border-white/10 px-2 py-1 hover:bg-white/10 hover:text-red-400 transition-all"
                    >CLOSE</button>
                </div>
                
                <div class="flex-1 flex flex-col p-4 gap-4 overflow-y-auto win-scroll">
                    {/* SATELLITE RECON OVERLAY */}
                    <div class="flex flex-col gap-1">
                        <div class="text-[8px] font-black text-cyan-400/60 tracking-[0.2em]">SATELLITE VIEW</div>
                        <div class="border border-white/10 p-1 bg-zinc-950 shadow-2xl relative group rounded-sm">
                            <iframe 
                                width="100%" 
                                height="200" 
                                frameborder="0" 
                                scrolling="no" 
                                class="grayscale-[20%] group-hover:grayscale-0 transition-all opacity-80"
                                src={`https://maps.google.com/maps?q=${props.selectedDC().latitude},${props.selectedDC().longitude}&hl=id&z=17&t=k&output=embed`}>
                            </iframe>
                            <div class="absolute bottom-2 right-2 bg-black/80 px-2 py-1 text-[8px] text-white/40 font-mono tracking-tighter border border-white/5">
                                SAT VIEW v4
                            </div>
                        </div>
                    </div>

                    {/* OSINT NEWS FEED */}
                    <div class="space-y-2 border-t border-white/5 pt-4">
                        <div class="flex items-center justify-between px-1">
                            <div class="flex items-center gap-2">
                                <span class="text-white text-[10px] font-black tracking-widest uppercase">FACILITY NEWS</span>
                                <div class="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                            </div>
                            <span class="text-[8px] font-mono text-white/20 tracking-tighter">DATA CENTER + {props.selectedDC()?.operator_name || props.selectedDC()?.company_name || 'NULL'}</span>
                        </div>
                        
                        <div class="bg-zinc-900/50 border border-white/5 p-2 space-y-2 max-h-[250px] overflow-y-auto win-scroll">
                            <For each={props.newsFeed() || []} fallback={
                                <div class="py-8 text-center">
                                    <div class="text-[8px] font-black text-white/20 uppercase animate-pulse">FETCHING NEWS...</div>
                                </div>
                            }>
                                {(news) => (
                                    <a 
                                        href={news.link} 
                                        target="_blank" 
                                        class="flex flex-col border-b border-white/5 pb-2 last:border-0 group hover:bg-white/5 p-1 transition-all"
                                    >
                                        <div class="text-[9px] font-bold text-white/80 group-hover:text-cyan-400 transition-colors leading-relaxed">
                                            {news.title}
                                        </div>
                                        <div class="flex items-center justify-between mt-1">
                                            <span class="text-[7px] text-cyan-500/60 uppercase font-black tracking-widest">{news.publisher}</span>
                                            <span class="text-[7px] text-white/20 font-mono">
                                                {new Date(news.time * 1000).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </a>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* STATS GRID */}
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-white/5 p-2 rounded-sm border border-white/5">
                            <div class="text-[6px] text-white/30 font-black">OPERATIONAL STATUS</div>
                            <div class="text-[10px] font-bold text-cyan-400">{props.selectedDC().operational_status}</div>
                        </div>
                        <div class="bg-white/5 p-2 rounded-sm border border-white/5">
                            <div class="text-[6px] text-white/30 font-black">CAPACITY</div>
                            <div class="text-[10px] font-bold text-white">{props.selectedDC().it_load_mw} MW</div>
                        </div>
                        <div class="bg-white/5 p-2 rounded-sm border border-white/5">
                            <div class="text-[6px] text-white/30 font-black">TIER LEVEL</div>
                            <div class="text-[10px] font-bold text-white">{props.selectedDC().tier_level}</div>
                        </div>
                        <div class="bg-white/5 p-2 rounded-sm border border-white/5">
                            <div class="text-[6px] text-white/30 font-black">RENEWABLE ENERGY</div>
                            <div class="text-[10px] font-bold text-emerald-400">{props.selectedDC().renewable_energy_pct}%</div>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="text-[8px] font-black text-cyan-400/60 tracking-[0.2em]">INFRASTRUCTURE</div>
                        <div class="bg-zinc-900 border border-white/5 p-3 space-y-2">
                            <div class="flex justify-between">
                                <span class="text-[8px] text-white/40">BUILDING SIZE</span>
                                <span class="text-[9px] font-bold text-white">{props.selectedDC().total_building_size}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-[8px] text-white/40">WHITE SPACE</span>
                                <span class="text-[9px] font-bold text-white">{props.selectedDC().white_space_size}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-[8px] text-white/40">RACK CAPACITY</span>
                                <span class="text-[9px] font-bold text-white">{props.selectedDC().rack_capacity}</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="text-[8px] font-black text-cyan-400/60 tracking-[0.2em]">CONNECTIVITY</div>
                        <div class="bg-zinc-900 border border-white/5 p-3 space-y-2">
                            <div class="flex justify-between">
                                <span class="text-[8px] text-white/40">CARRIER NEUTRAL</span>
                                <span class="text-[9px] font-bold text-cyan-400">{props.selectedDC().carrier_neutral}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-[8px] text-white/40">TOTAL CARRIERS</span>
                                <span class="text-[9px] font-bold text-white">{props.selectedDC().total_carriers}</span>
                            </div>
                            <div class="flex flex-col gap-1 mt-2">
                                <span class="text-[7px] text-white/30">IX PRESENCE</span>
                                <span class="text-[8px] font-mono text-cyan-400/80 leading-tight border-l border-cyan-500/20 pl-2">{props.selectedDC().ix_presence}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        <div class="text-[8px] font-black text-orange-500/60 tracking-[0.2em] flex items-center justify-between">
                            POWER GRID PROXIMITY
                            <span class="text-[7px] bg-orange-500/10 px-1 border border-orange-500/20">100KM RADIUS</span>
                        </div>
                        <div class="bg-zinc-900 border border-orange-500/10 p-2 space-y-1 max-h-[140px] overflow-y-auto win-scroll">
                            <For each={props.nearbyPowerPlants() || []} fallback={
                                <div class="py-4 text-center opacity-20 text-[8px] font-black tracking-widest italic">NO POWER INFRASTRUCTURE FOUND</div>
                            }>
                                {(plant) => (
                                    <div 
                                        onClick={() => props.onPowerPlantClick(plant)}
                                        class={`flex flex-col border-b border-white/5 py-1.5 last:border-0 group cursor-pointer transition-all ${props.selectedPowerPlant()?.id === plant.id ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500 pl-2' : 'hover:bg-white/5'}`}
                                    >
                                        <div class="flex justify-between items-start">
                                            <span class={`text-[9px] font-black transition-colors ${props.selectedPowerPlant()?.id === plant.id ? 'text-cyan-400' : 'text-white group-hover:text-orange-400'}`}>{plant.name}</span>
                                            <span class="text-[8px] font-mono text-orange-500">{Number(plant.distance_km).toFixed(1)} KM</span>
                                        </div>
                                        <div class="flex items-center gap-2 mt-0.5">
                                            <span class="text-[7px] bg-white/5 px-1 text-white/40 uppercase">{plant.primary_fuel}</span>
                                            <span class="text-[7px] text-white/30 truncate">{plant.capacity_mw} MW</span>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                    
                    <div class="mt-auto p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-sm">
                        <div class="text-[7px] text-cyan-400 font-bold uppercase mb-1 tracking-widest leading-none">SECURITY PROTOCOL</div>
                        <p class="text-[9px] leading-relaxed text-white/40 italic lowercase">
                            monitoring secure facility perimeter at {props.selectedDC().city}. all outgoing traffic encrypted via aes-256-gcm.
                        </p>
                    </div>
                </div>
                
                <div class="p-3 border-t border-white/5 bg-black text-[7px] text-white/20 font-mono flex justify-between uppercase">
                    <span>SYSTEM LIVE</span>
                    <span>LAST UPDATED: {props.selectedDC().last_updated}</span>
                </div>
            </div>
        </Show>
    );
}
