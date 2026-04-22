import { For, Show, Switch, Match } from 'solid-js';

export default function DatacenterTable(props) {
    return (
        <div class="h-full flex flex-col bg-bg_main overflow-hidden border-t border-border_main font-mono uppercase">
            <div class="px-6 py-2 border-b border-border_main bg-bg_header flex justify-between items-center sticky top-0 z-10 shadow-lg">
                <div class="flex items-center gap-6">
                    <h3 class="text-[9px] font-black text-cyan-400 tracking-[0.2em] uppercase">INFRASTRUCTURE REGISTRY</h3>
                    <div class="flex gap-4 border-l border-white/10 pl-6">
                        <button
                            onClick={() => props.setActiveTableTab('priority')}
                            class={`text-[8px] font-black tracking-widest transition-all relative py-1 ${props.activeTableTab === 'priority' ? 'text-cyan-400' : 'text-white/30 hover:text-white/60'}`}
                        >
                            PRIORITY NODES
                            <Show when={props.activeTableTab === 'priority'}>
                                <div class="absolute -bottom-2 left-0 w-full h-0.5 bg-cyan-500 shadow-[0_0_10px_#06b6d4]"></div>
                            </Show>
                        </button>
                        <button
                            onClick={() => props.setActiveTableTab('hub_geo')}
                            class={`text-[8px] font-black tracking-widest transition-all relative py-1 ${props.activeTableTab === 'hub_geo' ? 'text-orange-400' : 'text-white/30 hover:text-white/60'}`}
                        >
                            GEOSPATIAL ASSETS
                            <Show when={props.activeTableTab === 'hub_geo'}>
                                <div class="absolute -bottom-2 left-0 w-full h-0.5 bg-orange-500 shadow-[0_0_10px_#f97316]"></div>
                            </Show>
                        </button>
                        <button
                            onClick={() => props.setActiveTableTab('hub_orphans')}
                            class={`text-[8px] font-black tracking-widest transition-all relative py-1 ${props.activeTableTab === 'hub_orphans' ? 'text-red-400' : 'text-white/30 hover:text-white/60'}`}
                        >
                            DATA AUDIT
                            <Show when={props.activeTableTab === 'hub_orphans'}>
                                <div class="absolute -bottom-2 left-0 w-full h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444]"></div>
                            </Show>
                        </button>
                    </div>
                    <Show when={props.viewLevel() !== 'global'}>
                        <button 
                            onClick={() => props.onBackToGlobal()}
                            class="ml-4 px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-500 text-[8px] font-black hover:bg-orange-500 hover:text-bg_main transition-all"
                        >
                            ← WORLD VIEW
                        </button>
                    </Show>
                </div>
                <div class="flex items-center gap-4">
                    {/* GLOBAL RECON SEARCH INPUT */}
                    <div class="relative flex items-center group">
                        <div class="absolute left-3 text-white/20 group-focus-within:text-orange-500 transition-colors">
                            <span class="text-[10px]">🔎</span>
                        </div>
                        <input 
                            type="text"
                            placeholder="SEARCH REGISTRY..."
                            class="bg-black/40 border border-white/10 px-8 py-1.5 text-[8px] font-black tracking-widest text-white placeholder:text-white/10 focus:outline-none focus:border-orange-500/50 focus:bg-black/60 transition-all w-48 focus:w-64"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') props.onSearch(e.currentTarget.value);
                            }}
                        />
                    </div>

                    <Show when={props.hubStats()}>
                        <div class="text-[8px] text-white/20 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 border border-white/5">
                            VAULT_TOTAL: <span class="text-white">{props.hubStats().total_records}</span>
                        </div>
                    </Show>
                    <span class="text-[8px] text-text_secondary opacity-40 font-mono italic shrink-0">TERMINAL_REF: {new Date().toLocaleTimeString()}</span>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto win-scroll relative bg-bg_main">
                <Show when={props.isLoading()}>
                    <div class="absolute inset-0 bg-black/50 z-20 flex items-center justify-center backdrop-blur-sm">
                        <div class="text-[12px] font-black text-cyan-400 animate-pulse tracking-[0.5em]">LOADING...</div>
                    </div>
                </Show>

                <table class="w-full text-left border-collapse table-fixed">
                    <thead class="sticky top-0 bg-bg_sidebar z-10 border-b border-border_main shadow-sm">
                        <Switch>
                            <Match when={props.activeTableTab === 'priority'}>
                                <tr class="text-[8px] font-black text-white/40 uppercase tracking-tighter">
                                    <th class="px-6 py-2 w-1/4">IDENTIFIER</th>
                                    <th class="px-2 py-2">OPERATOR / REGION</th>
                                    <th class="px-2 py-2">SPECIFICATIONS</th>
                                    <th class="px-6 py-2 text-right">COORDINATES</th>
                                    <th class="px-6 py-2 text-center w-24">STATUS</th>
                                </tr>
                            </Match>
                            <Match when={props.activeTableTab === 'hub_geo' || props.activeTableTab === 'hub_orphans'}>
                                <tr class="text-[8px] font-black text-white/40 uppercase tracking-tighter">
                                    <th class="px-6 py-2 w-1/3">FACILITY NAME</th>
                                    <th class="px-2 py-2">OPERATOR</th>
                                    <th class="px-2 py-2">LOCATION</th>
                                    <th class="px-6 py-2 text-right">COORDINATES</th>
                                    <th class="px-6 py-2 text-center w-24">UUID</th>
                                </tr>
                            </Match>
                        </Switch>
                    </thead>
                    <tbody class="text-[10px]">
                        <Switch>
                            {/* RENDER HIGH PRIORITY DATA */}
                            <Match when={props.activeTableTab === 'priority'}>
                                <For each={props.viewLevel() === 'global' ? props.countryNodes() : props.datacenters()}>
                                    {(item) => (
                                        <tr
                                            class={`border-b border-border_main/30 hover:bg-cyan-500/10 transition-colors group cursor-pointer ${props.selectedDC()?.id === item.id ? 'bg-cyan-500/10' : ''}`}
                                            onClick={() => {
                                                if (props.viewLevel() === 'global') props.onCountryClick(item.name);
                                                else props.onDCClick(item);
                                            }}
                                        >
                                            <Switch>
                                                <Match when={props.viewLevel() === 'global'}>
                                                    <td class="px-6 py-2 font-black text-cyan-400">{item.name}</td>
                                                    <td class="px-2 py-2 text-white/60">{item.datacenter_count} NODES</td>
                                                    <td class="px-2 py-2 text-white/30 italic">{Number(item.lat).toFixed(3)}, {Number(item.lon).toFixed(3)}</td>
                                                    <td colspan="2" class="px-6 py-2 text-right">
                                                        <span class="text-[8px] border border-cyan-500/20 px-2 py-1 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-bg_main transition-all uppercase font-black tracking-widest">DRILL DOWN</span>
                                                    </td>
                                                </Match>
                                                <Match when={props.viewLevel() === 'country'}>
                                                    <td class="px-6 py-2">
                                                        <div class="text-[10px] font-black text-white group-hover:text-cyan-400 transition-colors truncate">{item.facility_name}</div>
                                                        <div class="text-[7px] text-white/20 uppercase">ID: {item.dc_id}</div>
                                                    </td>
                                                    <td class="px-2 py-2">
                                                        <div class="text-[9px] font-bold text-cyan-500">{item.operator_name}</div>
                                                        <div class="text-[8px] text-white/40 uppercase">{item.city}, {item.country_code}</div>
                                                    </td>
                                                    <td class="px-2 py-2">
                                                        <div class="text-[8px] text-white/60 uppercase">LOAD: {item.it_load_mw}</div>
                                                        <div class="text-[8px] text-white/30 uppercase">TIER: {item.tier_level}</div>
                                                    </td>
                                                    <td class="px-6 py-2 text-right text-white/30">
                                                        {item.latitude}, {item.longitude}
                                                    </td>
                                                    <td class="px-6 py-2 text-center text-[8px] font-black text-emerald-400 opacity-60">ACTIVE</td>
                                                </Match>
                                            </Switch>
                                        </tr>
                                    )}
                                </For>
                            </Match>

                            {/* RENDER HUB DATA (GEOSPATIAL OR ORPHANS) */}
                            <Match when={props.activeTableTab === 'hub_geo' || props.activeTableTab === 'hub_orphans'}>
                                <Switch>
                                    {/* GLOBAL VIEW: COUNTRY SUMMARY */}
                                    <Match when={props.viewLevel() === 'global'}>
                                        <For each={props.hubCountryNodes()}>
                                            {(item) => (
                                                <tr
                                                    class="border-b border-border_main/30 hover:bg-orange-500/10 transition-colors group cursor-pointer"
                                                    onClick={() => props.onCountryClick(item.name)}
                                                >
                                                    <td class="px-6 py-2 font-black text-orange-400">{item.name}</td>
                                                    <td class="px-2 py-2 text-white/60 font-bold uppercase">{item.datacenter_count} REGISTERED FACILITIES</td>
                                                    <td class="px-2 py-2 text-white/20 italic">
                                                        AVERAGE COORDINATES: {Number(item.lat).toFixed(2)}, {Number(item.lon).toFixed(2)}
                                                    </td>
                                                    <td colspan="2" class="px-6 py-2 text-right">
                                                        <span class="text-[8px] border border-orange-500/20 px-2 py-1 text-orange-400 group-hover:bg-orange-500 group-hover:text-bg_main transition-all uppercase font-black tracking-widest">MAP VIEW</span>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </Match>

                                    {/* COUNTRY VIEW: DETAILED FACILITY LIST */}
                                    <Match when={props.viewLevel() === 'country'}>
                                        <For each={props.hubDatacenters()}>
                                            {(item) => (
                                                <tr 
                                                    class="border-b border-border_main/30 hover:bg-white/5 transition-colors group cursor-pointer"
                                                    onClick={() => props.onDCClick(item)}
                                                >
                                                    <td class="px-6 py-2">
                                                        <div class="text-[9px] font-black text-white group-hover:text-cyan-400 transition-colors uppercase truncate">{item.facility_name || 'UNNAMED FACILITY'}</div>
                                                        <div class="text-[7px] text-white/20 uppercase truncate italic">{item.full_address}</div>
                                                    </td>
                                                    <td class="px-2 py-2 text-white/60 font-bold uppercase">{item.company_name || 'UNKNOWN OPERATOR'}</td>
                                                    <td class="px-2 py-2">
                                                        <div class="text-[9px] text-orange-400/80 font-black uppercase">{item.country_name}</div>
                                                        <div class="text-[8px] text-white/30 uppercase">{item.city_name} {item.zip_code}</div>
                                                    </td>
                                                    <td class="px-6 py-2 text-right font-mono text-white/20 italic">
                                                        {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                                                    </td>
                                                    <td class="px-6 py-2 text-center text-white/10 text-[8px] font-mono">
                                                        #{item.id}
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </Match>
                                </Switch>
                            </Match>
                        </Switch>
                    </tbody>
                </table>

                <Show when={(props.activeTableTab === 'priority' ? (props.viewLevel() === 'global' ? props.countryNodes() : props.datacenters()) : props.hubDatacenters()).length === 0}>
                    <div class="h-full flex flex-col items-center justify-center p-20 opacity-20">
                        <div class="text-[10px] font-mono uppercase tracking-[0.5em]">RECORD NOT FOUND</div>
                    </div>
                </Show>
            </div>

            {/* SERVER-SIDE PAGINATION UI (Only for Hub Tabs) */}
            <Show when={props.activeTableTab !== 'priority'}>
                <div class="px-6 py-2 border-t border-border_main bg-bg_header flex justify-between items-center text-[8px] font-black uppercase text-white/40">
                    <div class="flex items-center gap-4">
                        <button
                            disabled={props.hubPagination.page <= 1}
                            onClick={() => props.onPageChange(props.hubPagination.page - 1)}
                            class={`px-3 py-1 border border-white/10 hover:bg-white/5 transition-all ${props.hubPagination.page <= 1 ? 'opacity-20 cursor-not-allowed' : 'text-cyan-400 border-cyan-400/20'}`}
                        >
                            PREVIOUS
                        </button>
                        <div class="flex items-center gap-1 font-mono tracking-widest text-white/60">
                            SEGMENT <span class="text-white font-black">{props.hubPagination.page}</span> / {props.hubPagination.total_pages}
                        </div>
                        <button
                            disabled={props.hubPagination.page >= props.hubPagination.total_pages}
                            onClick={() => props.onPageChange(props.hubPagination.page + 1)}
                            class={`px-3 py-1 border border-white/10 hover:bg-white/5 transition-all ${props.hubPagination.page >= props.hubPagination.total_pages ? 'opacity-20 cursor-not-allowed' : 'text-cyan-400 border-cyan-400/20'}`}
                        >
                            NEXT
                        </button>
                    </div>
                    <div class="italic opacity-30">
                        SHOWING {props.hubDatacenters().length} ASSETS IN CURRENT STREAM
                    </div>
                </div>
            </Show>

        </div>
    );
}
