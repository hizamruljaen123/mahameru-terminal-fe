import { onMount, Show, createSignal, createEffect, Switch, Match } from 'solid-js';
import { useDatacenterData } from './hooks/useDatacenterData';
import DatacenterMap from './components/DatacenterMap';
import DatacenterSidebar from './components/DatacenterSidebar';
import DatacenterTable from './components/DatacenterTable';

export default function DatacenterPanel() {
    // Inject Roboto Font for maximum readability
    onMount(() => {
        if (!document.getElementById('google-font-roboto')) {
            const link = document.createElement('link');
            link.id = 'google-font-roboto';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap';
            document.head.appendChild(link);
        }
    });

    const {
        datacenters,
        countryNodes,
        stats,
        isLoading,
        selectedDC, setSelectedDC,
        viewLevel, setViewLevel,
        mapMode, setMapMode,
        viewPerspective, setViewPerspective,
        hubDatacenters,
        hubCountryNodes,
        hubStats,
        hubPagination,
        nearbyPowerPlants, setNearbyPowerPlants,
        newsFeed, setNewsFeed,
        fetchStats, fetchCountryNodes, fetchDatacenters,
        fetchHubDatacenters,
        fetchHubCountryNodes,
        fetchNearbyPowerPlants,
        fetchNewsFeed
    } = useDatacenterData();

    const [activeTableTab, setActiveTableTab] = createSignal('priority'); // priority, hub_geo, hub_orphans
    const [selectedCountry, setSelectedCountry] = createSignal('');
    const [searchQuery, setSearchQuery] = createSignal('');
    const [selectedPowerPlant, setSelectedPowerPlant] = createSignal(null);

    let mapRef = null;

    onMount(() => {
        fetchStats();
        fetchCountryNodes();
        fetchHubCountryNodes();
    });

    // Handle initial fetch or tab switch for Hub data with AUTO-RESET
    createEffect(() => {
        const tab = activeTableTab();
        
        // AUTO-RESET TO GLOBAL ON TAB SWITCH
        setViewLevel('global');
        setSelectedCountry('');
        setSelectedDC(null);
        setSelectedPowerPlant(null);
        setSearchQuery(''); // Reset search on tab switch
        
        if (mapRef) {
            mapRef.flyTo({ center: [0, 20], zoom: 2, pitch: 0, duration: 1500 });
        }

        if (tab === 'priority') {
            fetchCountryNodes();
        } else if (tab === 'hub_geo') {
            fetchHubCountryNodes();
            fetchHubDatacenters('geospatial', 1, '');
        } else if (tab === 'hub_orphans') {
            fetchHubDatacenters('non-geospatial', 1);
        }
    });

    const handleSearch = (q) => {
        setSearchQuery(q);
        setViewLevel('global'); // Reset view level when searching globally
        
        if (activeTableTab() === 'priority') {
            fetchDatacenters(selectedCountry(), q);
        } else {
            const mode = activeTableTab() === 'hub_geo' ? 'geospatial' : 'non-geospatial';
            fetchHubDatacenters(mode, 1, selectedCountry(), q);
        }
    };

    const handlePowerPlantClick = (plant) => {
        setSelectedPowerPlant(plant);
        const dc = selectedDC();
        if (mapRef && plant && dc) {
            const bounds = new window.maplibregl.LngLatBounds();
            bounds.extend([parseFloat(dc.longitude), parseFloat(dc.latitude)]);
            bounds.extend([parseFloat(plant.longitude), parseFloat(plant.latitude)]);
            
            mapRef.fitBounds(bounds, {
                padding: { top: 80, bottom: 80, left: 380, right: 80 }, // Dynamic padding for UI elements
                duration: 1500,
                pitch: 45
            });
        }
    };

    const handleCountryClick = (countryName) => {
        setSelectedCountry(countryName);
        setViewLevel('country');
        setSelectedDC(null);
        setSelectedPowerPlant(null);
        setNearbyPowerPlants([]); 
        setNewsFeed([]); // CLEAR NEWS ON LOCATION SWITCH
        
        if (activeTableTab() === 'priority') {
            fetchDatacenters(countryName);
        } else {
            fetchHubDatacenters(activeTableTab() === 'hub_geo' ? 'geospatial' : 'non-geospatial', 1, countryName);
        }

        if (mapRef) {
            // Find coordinates to fly to
            const source = activeTableTab() === 'priority' ? countryNodes() : hubCountryNodes();
            const node = source.find(n => n.name === countryName);
            if (node) {
                mapRef.flyTo({ center: [parseFloat(node.lon), parseFloat(node.lat)], zoom: 5 });
            }
        }
    };

    const handleDCClick = (dc) => {
        setSelectedDC(dc);
        setSelectedPowerPlant(null); // Reset plant selection on new DC click
        setNearbyPowerPlants([]); // Clear previous grid before fetching new one
        setNewsFeed([]); // CLEAR OLD NEWS STREAM
        
        // AUTO-FETCH NEARBY POWER PLANTS FOR ENERGY AUDIT
        fetchNearbyPowerPlants(dc.latitude, dc.longitude);

        // FECH OSINT NEWS FEED
        const company = dc.operator_name || dc.company_name || '';
        const country = dc.country_code || dc.country_name || '';
        fetchNewsFeed(company, country);

        if (mapRef) {
            mapRef.flyTo({
                center: [parseFloat(dc.longitude), parseFloat(dc.latitude)],
                zoom: 14,
                pitch: 45,
                duration: 2000
            });
        }
    };

    const handleBackToGlobal = () => {
        fetchCountryNodes();
        setSelectedDC(null);
        setSelectedPowerPlant(null);
        setNearbyPowerPlants([]);
        setNewsFeed([]); // FULL WIPE
        if (mapRef) {
            mapRef.flyTo({
                center: [0, 20],
                zoom: 2,
                pitch: 0,
                duration: 1500
            });
        }
    };

    return (
        <div class="h-full w-full flex flex-col bg-bg_main overflow-hidden uppercase" style="font-family: 'Roboto', sans-serif;">
            <Switch>
                {/* DATA AUDIT CONSOLE FOR UNMAPPED RECORDS */}
                <Match when={activeTableTab() === 'hub_orphans'}>
                    <div class="h-full flex flex-col">
                        <div class="px-8 py-4 bg-black/40 border-b border-border_main flex justify-between items-center backdrop-blur-3xl animate-in fade-in slide-in-from-top-4 duration-700">
                            <div>
                                <h2 class="text-xl font-black text-red-500 tracking-[0.3em]">DATA AUDIT CONSOLE</h2>
                                <p class="text-[8px] text-white/30 tracking-widest mt-1 uppercase">TOTAL UNMAPPED RECORDS: {hubStats()?.missing_location_count || 0}</p>
                            </div>
                            <button 
                                onClick={() => setActiveTableTab('priority')}
                                class="bg-white/5 border border-white/20 px-6 py-2 text-[10px] font-black hover:bg-white/10 hover:border-cyan-500 hover:text-cyan-400 transition-all flex items-center gap-2 group"
                            >
                                <span class="group-hover:-translate-x-1 transition-transform">←</span>
                                <span>RETURN TO DASHBOARD</span>
                            </button>
                        </div>
                        <div class="flex-1 overflow-hidden">
                            <DatacenterTable 
                                activeTableTab={activeTableTab()}
                                setActiveTableTab={setActiveTableTab}
                                viewLevel={viewLevel}
                                countryNodes={countryNodes}
                                datacenters={datacenters}
                                hubDatacenters={hubDatacenters}
                                hubCountryNodes={hubCountryNodes}
                                hubStats={hubStats}
                                hubPagination={hubPagination()}
                                selectedDC={selectedDC}
                                isLoading={isLoading}
                                onCountryClick={handleCountryClick}
                                onDCClick={handleDCClick}
                                onBackToGlobal={handleBackToGlobal}
                                onSearch={handleSearch}
                                onPageChange={(page) => fetchHubDatacenters('non-geospatial', page, selectedCountry(), searchQuery())}
                            />
                        </div>
                    </div>
                </Match>

                {/* STANDARD GEOSPATIAL SURVEILLANCE VIEW */}
                <Match when={true}>
                    <div class="h-full flex flex-col">
                        {/* MAP AREA (70%) */}
                        <div class="h-[70%] flex border-b border-border_main bg-zinc-900 relative transition-all duration-700 overflow-hidden">
                            <div class="flex-1 relative">
                                <DatacenterMap 
                                    activeTableTab={activeTableTab()}
                                    viewLevel={viewLevel}
                                    countryNodes={countryNodes}
                                    hubCountryNodes={hubCountryNodes}
                                    datacenters={datacenters}
                                    hubDatacenters={hubDatacenters}
                                    selectedDC={selectedDC}
                                    nearbyPowerPlants={nearbyPowerPlants}
                                    selectedPowerPlant={selectedPowerPlant}
                                    onPowerPlantClick={handlePowerPlantClick}
                                    mapMode={mapMode}
                                    viewPerspective={viewPerspective}
                                    onMapReady={(map) => mapRef = map}
                                    onCountryClick={handleCountryClick}
                                    onDCClick={handleDCClick}
                                />

                                {/* FLOATING HUD CONTROLS */}
                                <div class="absolute top-4 right-4 z-[1000] flex flex-col gap-3">
                                    <div class="bg-black/80 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                                        <div class="group relative">
                                            <button onClick={handleBackToGlobal} class="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all rounded">
                                                <span class="text-sm">🔄</span>
                                            </button>
                                            <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">RESET VIEW</div>
                                        </div>
                                        <div class="h-px bg-white/5 mx-1"></div>
                                        <div class="group relative">
                                            <button onClick={() => setViewPerspective('top')} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${viewPerspective() === 'top' ? 'text-cyan-400 bg-cyan-400/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                                <span class="text-sm">⏹️</span>
                                            </button>
                                            <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">2D VIEW</div>
                                        </div>
                                        <div class="group relative">
                                            <button onClick={() => setViewPerspective('tilt')} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${viewPerspective() === 'tilt' ? 'text-cyan-400 bg-cyan-400/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                                <span class="text-sm">📐</span>
                                            </button>
                                            <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">3D VIEW</div>
                                        </div>
                                    </div>

                                    <div class="bg-black/80 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                                        <div class="group relative">
                                            <button onClick={() => setMapMode('dark')} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'dark' ? 'text-cyan-400 bg-cyan-400/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                                <span class="text-sm">🌑</span>
                                            </button>
                                            <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">DARK MODE</div>
                                        </div>
                                        <div class="group relative">
                                            <button onClick={() => setMapMode('terrain')} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'terrain' ? 'text-cyan-400 bg-cyan-400/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                                <span class="text-sm">⛰️</span>
                                            </button>
                                            <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">TERRAIN</div>
                                        </div>
                                        <div class="group relative">
                                            <button onClick={() => setMapMode('satellite')} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'satellite' ? 'text-cyan-400 bg-cyan-400/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                                <span class="text-sm">🛰️</span>
                                            </button>
                                            <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">SATELLITE</div>
                                        </div>
                                    </div>
                                </div>

                                <div class="absolute bottom-6 right-6 text-right opacity-40">
                                    <div class="text-[10px] font-black text-white uppercase tracking-[0.4em]">GEOSPATIAL INTEL</div>
                                    <div class="text-[8px] text-cyan-500 font-bold uppercase">SYSTEM LIVE</div>
                                </div>
                            </div>

                            {/* SIDEBAR WITH POWER PROXIMITY */}
                            <DatacenterSidebar 
                                stats={stats}
                                viewLevel={viewLevel}
                                countryNodes={countryNodes}
                                datacenters={datacenters}
                                selectedDC={selectedDC}
                                setSelectedDC={setSelectedDC}
                                onCountryClick={handleCountryClick}
                                onBackToGlobal={handleBackToGlobal}
                                onDCClick={handleDCClick}
                                nearbyPowerPlants={nearbyPowerPlants}
                                selectedPowerPlant={selectedPowerPlant}
                                onPowerPlantClick={handlePowerPlantClick}
                                newsFeed={newsFeed}
                            />
                        </div>

                        {/* TABLE AREA (30%) */}
                        <div class="h-[30%] w-full">
                            <DatacenterTable 
                                activeTableTab={activeTableTab()}
                                setActiveTableTab={setActiveTableTab}
                                viewLevel={viewLevel}
                                countryNodes={countryNodes}
                                datacenters={datacenters}
                                hubDatacenters={hubDatacenters}
                                hubCountryNodes={hubCountryNodes}
                                hubStats={hubStats}
                                hubPagination={hubPagination()}
                                selectedDC={selectedDC}
                                isLoading={isLoading}
                                onCountryClick={handleCountryClick}
                                onDCClick={handleDCClick}
                                onBackToGlobal={handleBackToGlobal}
                                onSearch={handleSearch}
                                onPageChange={(page) => fetchHubDatacenters(activeTableTab() === 'hub_geo' ? 'geospatial' : 'non-geospatial', page, selectedCountry(), searchQuery())}
                            />
                        </div>
                    </div>
                </Match>
            </Switch>
        </div>
    );
}
