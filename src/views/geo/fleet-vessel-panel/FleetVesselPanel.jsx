import { onCleanup, Show } from 'solid-js';
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
        
        state.setVesselSearchResults(results.slice(0, 50));
    };

    const handleSelectVessel = (v) => {
        state.setSelectedMmsi(String(v.mmsi));
        state.setVesselSearchResults([]);
        state.setVesselSearchTerm(v.name || v.mmsi);
        
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

                <div class={`absolute inset-0 w-full h-full ${operatingMode() === 'MAP' ? 'z-30' : 'pointer-events-none'}`}>
                    <Show when={operatingMode() === 'MAP'}>
                        {/* SEARCH HUD */}
                        <Show when={state.isOperational()}>
                            <div class="absolute top-6 left-6 z-40 w-64">
                                <div class="relative">
                                    <input 
                                        type="text"
                                        placeholder="SEARCH MMSI/NAME..."
                                        value={state.vesselSearchTerm()}
                                        class="w-full bg-black/80 backdrop-blur-md border border-[#00f2ff]/20 px-3 py-2 text-[10px] text-[#00f2ff] focus:border-[#00f2ff] outline-none placeholder:text-[#00f2ff]/20 font-bold shadow-2xl"
                                        onInput={(e) => handleVesselSearchInput(e.currentTarget.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleVesselSearch(state.vesselSearchTerm());
                                        }}
                                    />
                                    <div class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-20 pointer-events-none font-black italic">SEARCH ↵</div>
                                </div>

                                {/* SEARCH RESULTS DROPDOWN */}
                                <Show when={state.vesselSearchResults().length > 0}>
                                    <div class="mt-1 bg-[#06070a]/95 backdrop-blur-xl border border-[#00f2ff]/30 shadow-[0_0_50px_rgba(0,242,255,0.2)] max-h-80 overflow-y-auto win-scroll animate-in fade-in duration-300">
                                        <For each={state.vesselSearchResults()}>{(v) => (
                                            <div 
                                                onClick={() => handleSelectVessel(v)}
                                                class="p-2.5 border-b border-white/5 hover:bg-[#00f2ff]/10 cursor-pointer transition-all group flex flex-col gap-0.5"
                                            >
                                                <div class="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter">
                                                    <span class="text-white group-hover:text-[#00f2ff] truncate max-w-[140px]">{v.name}</span>
                                                    <span class="text-[#00f2ff]/50 font-mono">MMSI: {v.mmsi}</span>
                                                </div>
                                                <div class="text-[7px] text-white/20 uppercase font-bold tracking-widest">{v.type || 'UNKNOWN'} • {v.status || 'NO_STATUS'}</div>
                                            </div>
                                        )}</For>
                                    </div>
                                </Show>
                            </div>
                        </Show>

                        {/* FLOATING HUD CONTROLS */}
                        <div class="absolute top-4 right-4 z-[1000] flex flex-col gap-3">
                            {/* PERSPECTIVE CONTROLS */}
                            <div class="bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                                <div class="group relative">
                                    <button onClick={map.togglePerspective}
                                        class={`w-8 h-8 flex items-center justify-center transition-all rounded ${state.viewPerspective() === 'top' ? 'text-blue-400 bg-blue-400/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                        <span class="text-xs">⏹️</span>
                                    </button>
                                    <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">2D TOP VIEW</div>
                                </div>
                                <div class="group relative">
                                    <button onClick={map.togglePerspective}
                                        class={`w-8 h-8 flex items-center justify-center transition-all rounded ${state.viewPerspective() === 'tilt' ? 'text-blue-400 bg-blue-400/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                        <span class="text-xs">📐</span>
                                    </button>
                                    <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">3D TILT VIEW</div>
                                </div>
                            </div>

                            {/* STYLE CONTROLS */}
                            <div class="bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                                <div class="group relative">
                                    <button onClick={() => state.setMapMode('dark')}
                                        class={`w-8 h-8 flex items-center justify-center transition-all rounded ${state.mapMode() === 'dark' ? 'text-blue-400 bg-blue-400/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                        <span class="text-xs">🌑</span>
                                    </button>
                                    <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">DARK VIEW</div>
                                </div>
                                <div class="group relative">
                                    <button onClick={() => state.setMapMode('terrain')}
                                        class={`w-8 h-8 flex items-center justify-center transition-all rounded ${state.mapMode() === 'terrain' ? 'text-blue-400 bg-blue-400/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                        <span class="text-xs">⛰️</span>
                                    </button>
                                    <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">TERRAIN VIEW</div>
                                </div>
                                <div class="group relative">
                                    <button onClick={() => state.setMapMode('satellite')}
                                        class={`w-8 h-8 flex items-center justify-center transition-all rounded ${state.mapMode() === 'satellite' ? 'text-blue-400 bg-blue-400/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                        <span class="text-xs">🛰️</span>
                                    </button>
                                    <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">SATELLITE VIEW</div>
                                </div>
                            </div>

                            {/* SYSTEM & STREAM CONTROLS */}
                            <Show when={state.isOperational()}>
                                <div class="bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                                    <div class="group relative">
                                        <button 
                                            onClick={() => {
                                                const theater = THEATERS.GLOBAL;
                                                map.flyTo(theater.center, theater.zoom);
                                            }}
                                            class="w-8 h-8 flex items-center justify-center transition-all rounded text-white/40 hover:text-green-400 hover:bg-green-400/10"
                                        >
                                            <span class="text-xs">🏠</span>
                                        </button>
                                        <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">RESET GLOBAL VIEW</div>
                                    </div>
                                    <div class="group relative">
                                        <button 
                                            onClick={map.hardReset}
                                            class="w-8 h-8 flex items-center justify-center transition-all rounded text-white/40 hover:text-red-400 hover:bg-red-400/10"
                                        >
                                            <span class="text-xs">🛠️</span>
                                        </button>
                                        <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">HARD RESET MAP</div>
                                    </div>
                                    <div class="group relative">
                                        <button 
                                            onClick={() => {
                                                const theater = THEATERS[state.activeTheater()];
                                                ws.cleanup();
                                                ws.connect(theater);
                                            }}
                                            class="w-8 h-8 flex items-center justify-center transition-all rounded text-white/40 hover:text-[#00f2ff] hover:bg-[#00f2ff]/10"
                                        >
                                            <span class="text-xs">🔄</span>
                                        </button>
                                        <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">RELOAD SIGNAL</div>
                                    </div>
                                </div>
                            </Show>
                        </div>

                        <BootScreen
                            isOperational={state.isOperational}
                            activeTheater={state.activeTheater}
                            onTheaterChange={state.setActiveTheater}
                            onLaunch={launchSurveillance}
                        />

                        <div class="absolute bottom-6 left-6 z-30 flex items-center gap-2">
                            <div class="bg-[#06070a]/90 border border-[#00f2ff]/20 px-4 py-2 shadow-[0_0_20px_rgba(0,242,255,0.1)]">
                                <span class="text-[9px] font-bold text-[#00ff41] tracking-tighter">
                                    {state.vesselCount()} VESSELS TRACKED
                                </span>
                            </div>
                            <button
                                onClick={() => state.setShowRegistry(!state.showRegistry())}
                                class={`px-4 py-2 text-[9px] h-full font-black transition-all uppercase border ${state.showRegistry()
                                        ? 'bg-[#00f2ff] text-black border-[#00f2ff]'
                                        : 'bg-[#06070a]/90 text-[#00f2ff] border-[#00f2ff]/20 hover:bg-[#00f2ff]/20'
                                    }`}
                            >
                                Vessel Registry
                            </button>
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
                    vesselFilter={state.vesselFilter}
                    portFilter={state.portFilter}
                    reconTab={state.reconTab}
                    selectedMmsi={state.selectedMmsi}
                    selectedPortId={state.selectedPortId}
                    filteredShips={state.filteredShips}
                    groupedPorts={state.groupedPorts}
                    registrySize={state.vesselCount}
                    portsCount={() => state.ports().length}
                    marketData={state.marketData}
                    weatherData={state.weatherData}
                    showAllFlows={state.showAllFlows}
                    onToggleFlows={() => { state.setShowAllFlows(!state.showAllFlows()); map.syncMap(); }}
                    onVesselSelectDetailed={(mmsi, lat, lon) => {
                        state.setSelectedMmsi(String(mmsi));
                        state.setSelectedPortId(null);
                        state.setSelectedRefinery(null);
                        if (lat != null && lon != null) {
                            map.getMap()?.flyTo({ center: [lon, lat], zoom: 16, pitch: 45, speed: 1.2, essential: true });
                        }
                        setTimeout(() => map.syncMap(), 100);
                    }}
                    onRefinerySelect={(ref) => {
                        state.setSelectedRefinery(ref);
                        state.setSelectedPortId(null);
                        state.setSelectedMmsi(null);
                        map.syncMap();
                    }}
                    activeShip={state.activeShip}
                    activePort={state.activePort}
                    activeRefinery={state.activeRefineryDetail}
                    dossierTab={state.dossierTab}
                    onDossierTabChange={state.setDossierTab}
                    portReconTab={state.portReconTab}
                    onPortReconTabChange={state.setPortReconTab}
                    weatherLoading={state.weatherLoading}
                    tacticalIntel={state.tacticalIntel}
                    intelDossier={state.intelDossier}
                    intelLoading={state.intelLoading}
                    stormData={state.stormData}
                    disasterAlerts={state.disasterAlerts}
                    onTabChange={(tab) => {
                        state.setActiveTab(tab);
                    }}
                    onModeChange={setOperatingMode}
                    onVesselSelect={(ship) => {
                        state.setSelectedMmsi(ship.mmsi);
                        state.setSelectedPortId(null);
                        map.jumpTo([ship.lon, ship.lat], 12);
                    }}
                    onPortSelect={(port) => {
                        state.setSelectedPortId(port.id);
                        state.setSelectedMmsi(null);
                        map.jumpTo([port.longitude, port.latitude], 12);
                    }}
                    onVesselFilterChange={(f) => state.setVesselFilter(f)}
                    onPortFilterChange={(f) => state.setPortFilter(f)}
                    onReconTabChange={(t) => state.setReconTab(t)}
                    getTabStyle={getTabStyle}
                />
            </Show>
        </div>
    );
}