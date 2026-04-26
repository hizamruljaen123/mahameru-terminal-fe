import { onCleanup, onMount, Show, For } from 'solid-js';
import { useVesselState } from './hooks/useVesselState';
import { useWebSocket } from './hooks/useWebSocket';
import { useMapController } from './hooks/useMapController';
import { useIntelligence } from './hooks/useIntelligence';
import { THEATERS } from './constants/theaters';
import HeaderHUD from './components/HeaderHUD';
import BootScreen from './components/BootScreen';
import RegistryDrawer from './components/RegistryDrawer';
import GridMonitor from './components/GridMonitor';

/**
 * FLEET MONITORING TERMINAL
 * Optimized for stability and real-time tracking.
 */
export default function FleetVesselPanel() {
    // Initialize state
    const state = useVesselState();
    const operatingMode = state.operatingMode;
    const setOperatingMode = state.setOperatingMode;
    const ws = useWebSocket(state);
    const map = useMapController(state);
    const intel = useIntelligence(state);

    // Control handlers
    const launchSurveillance = () => {
        const theater = THEATERS[state.activeTheater()];
        if (map.getMap()) {
            map.jumpTo(theater.center, theater.zoom);
        }

        state.setIsOperational(true);
        state.setStatus('SCANNING');

        ws.connect(theater);
        intel.fetchTheaterPorts(theater);
    };

    const abortSurveillance = () => {
        state.setIsOperational(false);
        ws.cleanup();
        map.clearVessels();
    };

    // FIXED: Add debouncing to search
    let searchTimeout;
    const handleVesselSearchInput = (term) => {
        state.setVesselSearchTerm(term);
        
        // Clear previous timeout
        if (searchTimeout) clearTimeout(searchTimeout);
        
        // If term is empty, clear results immediately
        if (!term.trim()) {
            state.setVesselSearchResults([]);
            return;
        }
        
        // Debounce actual search by 300ms
        searchTimeout = setTimeout(() => {
            handleVesselSearch(term);
        }, 300);
    };

    const handleVesselSearch = (term) => {
        const searchTerm = term.toLowerCase().trim();
        if (!searchTerm) {
            state.setVesselSearchResults([]);
            return;
        }

        const results = [];
        state.vesselRegistry.forEach((v) => {
            if (String(v.mmsi).includes(searchTerm) || (v.name || '').toLowerCase().includes(searchTerm)) {
                results.push(v);
            }
        });
        
        const slicedResults = results.slice(0, 50);
        state.setVesselSearchResults(slicedResults);

        // AUTO-SELECT: If exactly one match found, trigger selection automatically
        if (results.length === 1) {
            handleSelectVessel(results[0]);
        }
    };

    const handleSelectVessel = (v) => {
        state.setSelectedMmsi(String(v.mmsi));
        state.setSelectedPortId(null);
        state.setSelectedRefinery(null);
        state.setVesselSearchResults([]);
        state.setVesselSearchTerm(v.name || v.mmsi);
        
        // ENSURE DETAILS ARE VISIBLE
        state.setShowRegistry(true);
        state.setActiveTab('VESSELS');
        
        if (v.lat != null && v.lon != null) {
            map.getMap()?.flyTo({
                center: [v.lon, v.lat],
                zoom: 14,
                pitch: 45,
                speed: 1.5,
                essential: true
            });
        }
    };

    const getTabStyle = (tab) => {
        const styles = {
            'VESSELS': state.activeTab() === tab ? 'bg-[#00f2ff] text-black border-[#00f2ff]' : 'text-white/40 border-white/10 hover:border-white/20',
            'PORTS': state.activeTab() === tab ? 'bg-blue-600 text-white border-blue-600' : 'text-white/40 border-white/10 hover:border-white/20',
            'ANALYTICS': state.activeTab() === tab ? 'bg-purple-600 text-white border-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'text-white/40 border-white/10 hover:border-white/20',
            'HAZARDS': state.activeTab() === tab ? 'bg-red-600 text-white border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'text-white/40 border-white/10 hover:border-white/20'
        };
        return styles[tab] || styles['VESSELS'];
    };

    // Cleanup
    onMount(() => {
        // Small delay to ensure MapLibre and WebSocket refs are stable
        setTimeout(launchSurveillance, 1000);
    });

    onCleanup(() => {
        ws.cleanup();
    });

    return (
        <div class="h-full flex flex-col bg-[#06070a] text-[#00f2ff] font-mono selection:bg-[#00f2ff] selection:text-black">

            <HeaderHUD
                activeTheater={state.activeTheater}
                status={state.status}
                vesselCount={state.vesselCount}
                lastSignalTime={state.lastSignalTime}
                isOperational={state.isOperational}
                onTerminate={abortSurveillance}
                onReconnect={() => {
                    const theater = THEATERS[state.activeTheater()];
                    ws.cleanup();
                    ws.connect(theater);
                }}
            />

            {/* PRIMARY MODE SWITCHER */}
            <div class="h-10 bg-[#0b0c10] border-b border-[#00f2ff]/20 flex items-center px-6 gap-2 shrink-0">
                <button 
                    onClick={() => setOperatingMode('MAP')}
                    class={`px-6 h-full text-[9px] font-black transition-all border-b-2 uppercase tracking-[0.2em] flex items-center gap-2 ${operatingMode() === 'MAP' ? 'text-[#00f2ff] border-[#00f2ff] bg-[#00f2ff]/5' : 'text-white/20 border-transparent hover:text-white/40'}`}
                >
                    <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                    TACTICAL MAP VIEW
                </button>
                <button 
                    onClick={() => setOperatingMode('RADAR')}
                    class={`px-6 h-full text-[9px] font-black transition-all border-b-2 uppercase tracking-[0.2em] flex items-center gap-2 ${operatingMode() === 'RADAR' ? 'text-[#00f2ff] border-[#00f2ff] bg-[#00f2ff]/5' : 'text-white/20 border-transparent hover:text-white/40'}`}
                >
                    <span class={`w-1.5 h-1.5 bg-current ${operatingMode() === 'RADAR' ? 'animate-ping' : ''}`}></span>
                    VESSEL GRID REGION MONITOR
                </button>
                
                <div class="ml-auto flex items-center gap-4">
                    <span class="text-[7px] text-white/10 font-bold tracking-widest uppercase">TERMINAL MODE: {operatingMode()}</span>
                </div>
            </div>

            {/* Main Content Area */}
            <div class="flex-1 relative bg-black overflow-hidden">
                {/* Map Container - Persistent to avoid re-init bugs */}
                <div 
                    id="fleet-vessel-map" 
                    class={`absolute inset-0 w-full h-full transition-opacity duration-500 ${operatingMode() === 'MAP' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}`} 
                    ref={map.initMap}
                ></div>

                <div class={`absolute inset-0 w-full h-full transition-opacity duration-500 ${operatingMode() === 'RADAR' ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none z-0'}`}>
                    <Show when={operatingMode() === 'RADAR'}>
                        <GridMonitor />
                    </Show>
                </div>

                <div class={`absolute inset-0 w-full h-full pointer-events-none ${operatingMode() === 'MAP' ? 'z-30' : 'z-0'}`}>
                    <Show when={operatingMode() === 'MAP'}>
                        {/* UNIFIED TOP COMMAND PANEL */}
                        <div class="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex items-center pointer-events-auto bg-black/70 backdrop-blur-2xl border border-white/10 p-1 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-lg min-w-[700px]">
                            {/* SEARCH SECTION */}
                            <Show when={state.isOperational()}>
                                <div class="relative w-72 px-2">
                                    <input 
                                        type="text"
                                        placeholder="SEARCH MMSI / VESSEL..."
                                        class="w-full bg-transparent p-2 pl-8 text-[10px] font-black tracking-widest text-[#00f2ff] outline-none transition-all placeholder:text-[#00f2ff]/20"
                                        value={state.vesselSearchTerm()}
                                        onInput={(e) => handleVesselSearchInput(e.currentTarget.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleVesselSearch()}
                                    />
                                    <div class="absolute left-4 top-1/2 -translate-y-1/2 text-[#00f2ff] opacity-40">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>

                                    {/* SEARCH RESULTS DROPDOWN (Positioned relative to the unified bar) */}
                                    <Show when={state.vesselSearchResults().length > 0}>
                                        <div class="absolute top-full left-0 mt-2 w-full bg-[#06070a]/95 backdrop-blur-xl border border-[#00f2ff]/30 shadow-2xl max-h-80 overflow-y-auto win-scroll">
                                            <For each={state.vesselSearchResults()}>{(v) => (
                                                <div 
                                                    onClick={() => handleSelectVessel(v)}
                                                    class="p-2.5 border-b border-white/5 hover:bg-[#00f2ff]/10 cursor-pointer transition-all group flex flex-col gap-0.5"
                                                >
                                                    <div class="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter">
                                                        <span class="text-white group-hover:text-[#00f2ff] truncate max-w-[140px]">{v.name}</span>
                                                        <span class="text-[#00f2ff]/50 font-mono">MMSI: {v.mmsi}</span>
                                                    </div>
                                                    <div class="text-[7px] text-white/20 uppercase font-bold tracking-widest">{v.type || 'UNKNOWN'}</div>
                                                </div>
                                            )}</For>
                                        </div>
                                    </Show>
                                </div>
                            </Show>

                            <div class="w-[1px] h-6 bg-white/10 mx-1"></div>

                            {/* CONTROLS SECTION */}
                            <div class="flex items-center gap-1">
                                {/* NAVIGATION */}
                                <div class="flex items-center gap-0.5 px-1">
                                    <button onClick={map.zoomIn} class="w-8 h-8 flex items-center justify-center transition-all rounded text-white/40 hover:text-white hover:bg-white/5">
                                        <span class="text-xs">➕</span>
                                    </button>
                                    <button onClick={map.zoomOut} class="w-8 h-8 flex items-center justify-center transition-all rounded text-white/40 hover:text-white hover:bg-white/5">
                                        <span class="text-xs">➖</span>
                                    </button>
                                </div>
                                
                                <div class="w-[1px] h-6 bg-white/10"></div>

                                {/* PERSPECTIVE */}
                                <div class="flex items-center gap-0.5 px-1">
                                    <button onClick={map.togglePerspective}
                                        class={`w-8 h-8 flex items-center justify-center transition-all rounded ${state.viewPerspective() === 'top' ? 'text-[#00f2ff] bg-[#00f2ff]/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                        <span class="text-xs">⏹️</span>
                                    </button>
                                    <button onClick={map.togglePerspective}
                                        class={`w-8 h-8 flex items-center justify-center transition-all rounded ${state.viewPerspective() === 'tilt' ? 'text-[#00f2ff] bg-[#00f2ff]/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                        <span class="text-xs">📐</span>
                                    </button>
                                </div>

                                <div class="w-[1px] h-6 bg-white/10"></div>

                                {/* STYLE */}
                                <div class="flex items-center gap-0.5 px-1">
                                    <button onClick={() => state.setMapMode('dark')}
                                        class={`w-8 h-8 flex items-center justify-center transition-all rounded ${state.mapMode() === 'dark' ? 'text-[#00f2ff] bg-[#00f2ff]/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                        <span class="text-xs">🌑</span>
                                    </button>
                                    <button onClick={() => state.setMapMode('terrain')}
                                        class={`w-8 h-8 flex items-center justify-center transition-all rounded ${state.mapMode() === 'terrain' ? 'text-[#00f2ff] bg-[#00f2ff]/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                        <span class="text-xs">⛰️</span>
                                    </button>
                                    <button onClick={() => state.setMapMode('satellite')}
                                        class={`w-8 h-8 flex items-center justify-center transition-all rounded ${state.mapMode() === 'satellite' ? 'text-[#00f2ff] bg-[#00f2ff]/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                        <span class="text-xs">🛰️</span>
                                    </button>
                                </div>

                                <div class="w-[1px] h-6 bg-white/10"></div>

                                {/* SYSTEM */}
                                <Show when={state.isOperational()}>
                                    <div class="flex items-center gap-0.5 px-1">
                                        <button onClick={() => { const t = THEATERS.GLOBAL; map.flyTo(t.center, t.zoom); }}
                                            class="w-8 h-8 flex items-center justify-center transition-all rounded text-white/40 hover:text-green-400 hover:bg-green-400/10">
                                            <span class="text-xs">🏠</span>
                                        </button>
                                        <button onClick={map.hardReset}
                                            class="w-8 h-8 flex items-center justify-center transition-all rounded text-white/40 hover:text-red-400 hover:bg-red-400/10">
                                            <span class="text-xs">🛠️</span>
                                        </button>
                                        <button onClick={() => { const t = THEATERS[state.activeTheater()]; ws.cleanup(); ws.connect(t); }}
                                            class="w-8 h-8 flex items-center justify-center transition-all rounded text-white/40 hover:text-[#00f2ff] hover:bg-[#00f2ff]/10">
                                            <span class="text-xs">🔄</span>
                                        </button>
                                    </div>
                                </Show>
                            </div>
                        </div>

                        <BootScreen
                            isOperational={state.isOperational}
                            activeTheater={state.activeTheater}
                            onTheaterChange={state.setActiveTheater}
                            onLaunch={launchSurveillance}
                            class="pointer-events-auto"
                        />

                        <div class="absolute bottom-6 left-6 z-30 pointer-events-auto">
                            {/* UNIFIED TACTICAL DASHBOARD */}
                            <div class="bg-[#06070a]/90 backdrop-blur-xl border border-[#00f2ff]/20 p-2 shadow-[0_0_30px_rgba(0,242,255,0.1)] flex items-center gap-4 rounded-lg">
                                {/* SECTION 1: MESH CONTROLS (Only visible when port selected) */}
                                <Show when={state.selectedPortId()}>
                                    <div class="flex items-center gap-3 pr-4 border-r border-[#00f2ff]/10 animate-in slide-in-from-left duration-300">
                                        <div class="flex flex-col">
                                            <span class="text-[8px] font-black text-[#00f2ff] tracking-widest uppercase">Tactical Mesh</span>
                                            <div class="flex items-center gap-2 mt-1">
                                                <input 
                                                    type="range" min="1" max="30" step="1"
                                                    value={state.meshRadius()}
                                                    onInput={(e) => state.setMeshRadius(parseInt(e.currentTarget.value))}
                                                    class="w-24 h-1 bg-[#00f2ff]/10 appearance-none cursor-pointer accent-[#00f2ff]"
                                                />
                                                <span class="text-[8px] font-mono text-[#00f2ff]/60 w-8">{state.meshRadius()}KM</span>
                                            </div>
                                        </div>
                                        <div class="flex gap-1">
                                            <button
                                                onClick={() => state.setIsMeshActive(!state.isMeshActive())}
                                                class={`px-2 py-1 text-[7px] font-black uppercase border transition-all ${state.isMeshActive() ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-[#00f2ff]/10 border-[#00f2ff]/30 text-[#00f2ff]'}`}
                                            >
                                                {state.isMeshActive() ? 'OFF' : 'ON'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (state.isMeshActive()) {
                                                        state.setIsMeshActive(false);
                                                        setTimeout(() => state.setIsMeshActive(true), 10);
                                                    } else {
                                                        state.setIsMeshActive(true);
                                                    }
                                                }}
                                                class="px-2 py-1 bg-[#00f2ff] text-black text-[7px] font-black uppercase hover:bg-white transition-all"
                                            >
                                                PROC
                                            </button>
                                        </div>
                                    </div>
                                </Show>

                                {/* SECTION 2: SYSTEM STATS & REGISTRY */}
                                <div class="flex items-center gap-3">
                                    <div class="flex flex-col items-end">
                                        <span class="text-[7px] font-bold text-[#00ff41] tracking-widest leading-none">ACTIVE SIGNAL</span>
                                        <span class="text-[10px] font-black text-white mt-0.5">{state.vesselCount()} VESSELS</span>
                                    </div>
                                    <button
                                        onClick={() => state.setShowRegistry(!state.showRegistry())}
                                        class={`px-4 py-2 text-[8px] font-black transition-all uppercase border rounded ${state.showRegistry()
                                                ? 'bg-[#00f2ff] text-black border-[#00f2ff]'
                                                : 'bg-[#06070a]/90 text-[#00f2ff] border-[#00f2ff]/30 hover:bg-[#00f2ff]/20'
                                            }`}
                                    >
                                        Registry
                                    </button>
                                </div>
                            </div>
                        </div>


                    </Show>
                </div>
            </div>

            {/* DRAWERS */}
            <Show when={operatingMode() === 'MAP'}>
                <RegistryDrawer
                    state={state}
                    showRegistry={state.showRegistry}
                    activeTab={state.activeTab}
                    onTabChange={state.setActiveTab}
                    getTabStyle={getTabStyle}
                    vesselFilter={state.vesselFilter}
                    onVesselFilterChange={state.setVesselFilter}
                    portFilter={state.portFilter}
                    onPortFilterChange={state.setPortFilter}
                    selectedMmsi={state.selectedMmsi}
                    selectedPortId={state.selectedPortId}
                    filteredShips={state.filteredShips}
                    groupedPorts={state.groupedPorts}
                    registrySize={state.vesselCount}
                    onVesselSelect={handleSelectVessel}
                    onPortSelect={(p) => {
                        state.setSelectedPortId(p.id);
                        state.setSelectedMmsi(null);
                        state.setSelectedRefinery(null);
                    }}
                    onHazardSelect={(h) => {
                        state.setActiveHazard(h);
                        intel.fetchNearestPortToHazard(h.lat, h.lon);
                    }}
                    activeShip={state.activeShip}
                    activePort={state.activePort}
                    activeRefinery={state.activeRefineryDetail}
                    intelDossier={state.tacticalIntel}
                    marketData={state.marketData}
                    stormData={state.stormData}
                    disasterAlerts={state.disasterAlerts}
                    dossierTab={state.dossierTab}
                    onDossierTabChange={state.setDossierTab}
                    reconTab={state.reconTab}
                    onReconTabChange={state.setReconTab}
                    portReconTab={state.portReconTab}
                    onPortReconTabChange={state.setPortReconTab}
                    hazardNearbyInfras={state.hazardNearbyInfras}
                    activeHazard={state.activeHazard}
                    intelLoading={state.intelLoading}
                    portsCount={() => state.ports().length}
                />

            </Show>
        </div>
    );
}