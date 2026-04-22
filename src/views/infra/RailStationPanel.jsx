import { onMount, Show, createSignal, createEffect, For, onCleanup } from 'solid-js';
import { useRailStationData } from './hooks/useRailStationData';
import { fetchRoadRoute, getMidpoint, estimateTravelTime } from '../../utils/geoUtils';

export default function RailStationPanel() {
    const {
        stations,
        countries,
        stats,
        multimodalAssets,
        proximityAssets,
        isLoading,
        selectedStation, setSelectedStation,
        fetchStats,
        fetchCountries,
        fetchStations,
        fetchMultimodal,
        fetchProximityAssets
    } = useRailStationData();

    const [selectedCountry, setSelectedCountry] = createSignal('');
    const [searchQuery, setSearchQuery] = createSignal('');
    const [viewPerspective, setViewPerspective] = createSignal('top'); // top, tilt
    const [mapMode, setMapMode] = createSignal('dark'); // dark, terrain, satellite
    const [ormStyle, setOrmStyle] = createSignal('standard'); // standard, maxspeed, electrification
    const [isMapReady, setIsMapReady] = createSignal(false);
    const [railOverlayVisible, setRailOverlayVisible] = createSignal(true);
    const [logisticLayers, setLogisticLayers] = createSignal({ airports: true, ports: true, industry: true });
    const [isScanningProximity, setIsScanningProximity] = createSignal(false);
    
    const [globalSearchResults, setGlobalSearchResults] = createSignal([]);
    const [searchMode, setSearchMode] = createSignal('database'); // database, global_net
    const [isSearchingGlobal, setIsSearchingGlobal] = createSignal(false);
    const [activeSidebarTab, setActiveSidebarTab] = createSignal('search'); // search, analysis
    const [activeDetailTable, setActiveDetailTable] = createSignal(null); // 'airports', 'ports', 'industry'

    // Filtering logic to exclude closed facilities
    const filteredProximity = () => {
        const assets = proximityAssets();
        return {
            airports: assets.airports.filter(a => a.type && a.type.toLowerCase() !== 'closed'),
            ports: assets.ports.filter(p => !p.name || !p.name.toLowerCase().includes('closed')),
            industrial_zones: assets.industrial_zones.filter(i => !i.name || !i.name.toLowerCase().includes('closed'))
        };
    };

    let mapRef = null;
    let mapContainer;
    let markers = [];
    let activeRouteLabels = [];

    onMount(() => {
        fetchStats();
        fetchCountries();
        fetchStations();

        // Initialize Map
        const map = new window.maplibregl.Map({
            container: mapContainer,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [15, 20], 
            zoom: 2.2,
            pitch: 0,
            bearing: 0
        });

        mapRef = map;

        map.on('load', () => {
            setIsMapReady(true);
            renderMarkers();
        });
    });

    onCleanup(() => {
        if (mapRef) {
            try { mapRef.remove(); } catch (e) {}
        }
    });

    // Reactive ORM Style (Infrastructure Sub-Layers)
    createEffect(() => {
        if (!mapRef || !isMapReady()) return;
        const style = ormStyle();
        const tiles = [
            `https://a.tiles.openrailwaymap.org/${style}/{z}/{x}/{y}.png`,
            `https://b.tiles.openrailwaymap.org/${style}/{z}/{x}/{y}.png`,
            `https://c.tiles.openrailwaymap.org/${style}/{z}/{x}/{y}.png`
        ];

        try {
            // Safe removal with existence checks
            if (mapRef.getLayer('rail-tracks')) {
                mapRef.removeLayer('rail-tracks');
            }
            if (mapRef.getSource('openrailwaymap')) {
                mapRef.removeSource('openrailwaymap');
            }
            
            mapRef.addSource('openrailwaymap', {
                type: 'raster',
                tiles: tiles,
                tileSize: 256
            });
            
            mapRef.addLayer({
                id: 'rail-tracks',
                type: 'raster',
                source: 'openrailwaymap',
                paint: { 'raster-opacity': 0.8 }
            }); // Appended at top, no invalid beforeId
        } catch (e) {
            console.warn("ORM Style update skipped: Style conflict", e);
        }
    });

    // Reactive Map Mode (HUD)
    createEffect(() => {
        if (!mapRef || !isMapReady()) return;
        const mode = mapMode();
        
        let tiles = [];
        if (mode === 'dark') {
            tiles = [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
            ];
        } else if (mode === 'light') {
            tiles = [
                'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
            ];
        } else if (mode === 'terrain') {
            tiles = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'];
        } else {
            tiles = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'];
        }

        try {
            if (mapRef.getSource('base-layer')) {
                mapRef.removeLayer('base-layer');
                mapRef.removeSource('base-layer');
            }
            mapRef.addSource('base-layer', {
                type: 'raster',
                tiles: tiles,
                tileSize: 256,
                attribution: '© ESRI / CartoDB'
            });
            mapRef.addLayer({
                id: 'base-layer',
                type: 'raster',
                source: 'base-layer'
            }, 'rail-tracks'); // Keep rail tracks on top
        } catch (e) {
            console.warn("Style update skipped", e);
        }
    });

    const renderMarkers = () => {
        if (!mapRef || !isMapReady()) return;
        
        // Clear old manual markers
        markers.forEach(m => m.remove());
        markers = [];
        
        // 1. GLOBAL_SEARCH_RESULTS_PINS (Neon Green Tactical Pins)
        if (globalSearchResults().length > 0) {
            globalSearchResults().forEach(s => {
                const el = document.createElement('div');
                el.className = 'search-result-pin cursor-pointer group';
                el.innerHTML = `
                    <div class="relative flex flex-col items-center">
                        <svg width="24" height="32" viewBox="0 0 24 32" fill="none" class="drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]">
                            <path d="M12 0C5.37 0 0 5.37 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.37 18.63 0 12 0Z" fill="#22C55E"/>
                            <circle cx="12" cy="12" r="4" fill="#000000" />
                        </svg>
                        <div class="absolute -top-8 whitespace-nowrap bg-black text-[#22C55E] text-[8px] font-black px-2 py-0.5 border border-[#22C55E]/50 rounded opacity-0 group-hover:opacity-100 transition-all z-50 pointer-events-none uppercase">
                            ${s.name}
                        </div>
                    </div>
                `;

                const m = new window.maplibregl.Marker({ element: el, anchor: 'bottom' })
                    .setLngLat([parseFloat(s.longitude), parseFloat(s.latitude)])
                    .addTo(mapRef);
                
                el.addEventListener('click', () => handleStationSelection(s));
                markers.push(m);
            });
        }

        const selectedCode = selectedCountry();

        // 2. MODE 1: PURE_SOVEREIGN_PINS (Minimalist Tactical Overview)
        if (!selectedCode && globalSearchResults().length === 0) {
            countries().forEach(country => {
                if (!country.latitude || !country.longitude) return;

                const el = document.createElement('div');
                el.className = 'country-pin cursor-pointer group';
                el.innerHTML = `
                    <div class="relative flex items-center justify-center">
                        <div class="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] group-hover:scale-150 transition-all duration-300"></div>
                        <div class="absolute -bottom-6 whitespace-nowrap bg-black/95 px-2 py-0.5 border border-white/10 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                           <span class="text-[7px] font-black text-white uppercase tracking-wider">${country.name || country.code}</span>
                        </div>
                    </div>
                `;

                const m = new window.maplibregl.Marker({ element: el })
                    .setLngLat([parseFloat(country.longitude), parseFloat(country.latitude)])
                    .addTo(mapRef);
                
                el.addEventListener('click', () => {
                    handleCountryChange(country.code);
                });
                markers.push(m);
            });
            
            // Hide detail layers if active
            if (mapRef.getLayer('station-labels')) mapRef.setLayoutProperty('station-labels', 'visibility', 'none');
            if (mapRef.getLayer('station-points')) mapRef.setLayoutProperty('station-points', 'visibility', 'none');
            return;
        }

        // 3. MODE 2: COUNTRY_SPECIFIC_DRILLDOWN (Stations with Labels)
        const geojson = {
            type: 'FeatureCollection',
            features: stations().map(s => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [parseFloat(s.longitude), parseFloat(s.latitude)] },
                properties: { name: s.name, is_hub: s.is_main_station, type: 'rail' }
            }))
        };

        // RENDER MULTIMODAL TACTICAL PINS (Manual Markers for high-end look)
        const addMarker = (item, type, color, icon) => {
            const el = document.createElement('div');
            el.className = 'multimodal-pin cursor-pointer group';
            el.innerHTML = `
                <div class="relative flex flex-col items-center">
                    <svg width="20" height="26" viewBox="0 0 24 32" fill="none" style="filter: drop-shadow(0 0 5px ${color}80);">
                        <path d="M12 0C5.37 0 0 5.37 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.37 18.63 0 12 0Z" fill="${color}"/>
                        <circle cx="12" cy="12" r="4" fill="#000000" />
                    </svg>
                    <div class="absolute -top-1 font-black text-[7px]" style="color: white; transform: translateY(-50%);">${icon}</div>
                    <div class="absolute -top-7 whitespace-nowrap bg-black text-[7px] font-black px-1.5 py-0.5 border rounded opacity-0 group-hover:opacity-100 transition-all z-50 pointer-events-none uppercase" style="border-color: ${color}; color: ${color}">
                        ${item.name}
                    </div>
                </div>
            `;
            const m = new window.maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([parseFloat(item.longitude || item.lon), parseFloat(item.latitude || item.lat)])
                .addTo(mapRef);
            
            el.addEventListener('click', () => {
                // TRIGGER REAL ROAD ROUTE FROM SELECTED STATION
                renderRealRoute(item);
            });
            markers.push(m);
        };

        if (logisticLayers().airports) {
            proximityAssets().airports.forEach(a => addMarker(a, 'airport', '#3B82F6', '✈️'));
        }
        if (logisticLayers().ports) {
            proximityAssets().ports.forEach(p => addMarker(p, 'port', '#06B6D4', '⚓'));
        }
        if (logisticLayers().industry) {
            proximityAssets().industrial_zones.forEach(i => addMarker(i, 'industry', '#F59E0B', '🏭'));
        }

        if (mapRef.getSource('station-data')) {
            mapRef.getSource('station-data').setData(geojson);
        } else {
            mapRef.addSource('station-data', { type: 'geojson', data: geojson });
        }

        // Add Points Layer
        if (!mapRef.getLayer('station-points')) {
            mapRef.addLayer({
                id: 'station-points',
                type: 'circle',
                source: 'station-data',
                paint: {
                    'circle-radius': 4,
                    'circle-color': ['case', ['get', 'is_hub'], '#FFD700', '#22C55E'],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#FFFFFF'
                }
            });
        }
        mapRef.setLayoutProperty('station-points', 'visibility', 'visible');

        // Add Labels Layer with Sector-Specific Halos
        if (!mapRef.getLayer('station-labels')) {
            mapRef.addLayer({
                id: 'station-labels',
                type: 'symbol',
                source: 'station-data',
                layout: {
                    'text-field': ['get', 'name'],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-size': 9,
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top',
                    'text-allow-overlap': false
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': [
                        'match', ['get', 'type'],
                        'rail', '#1E40AF',
                        'airport', '#1D4ED8',
                        'port', '#0E7490',
                        'industry', '#B45309',
                        '#000000'
                    ],
                    'text-halo-width': 1.5
                }
            });
        }
        mapRef.setLayoutProperty('station-labels', 'visibility', 'visible');
    };

    const renderRealRoute = async (dest) => {
        const origin = selectedStation();
        if (!origin || !mapRef || !isMapReady()) return;
        
        const route = await fetchRoadRoute(origin, dest);
        if (!route) return;

        // Hide straight proximity lines
        if (mapRef.getLayer('proximity-lines-layer')) mapRef.setLayoutProperty('proximity-lines-layer', 'visibility', 'none');
        if (mapRef.getLayer('proximity-lines-glow')) mapRef.setLayoutProperty('proximity-lines-glow', 'visibility', 'none');
        
        activeRouteLabels.forEach(m => m.remove());
        activeRouteLabels = [];

        if (mapRef.getSource('active-route')) {
            mapRef.getSource('active-route').setData(route.geometry);
            mapRef.setLayoutProperty('active-route-layer', 'visibility', 'visible');
            mapRef.setLayoutProperty('active-route-glow', 'visibility', 'visible');
        } else {
            mapRef.addSource('active-route', { type: 'geojson', data: route.geometry });
            
            // NEON PINK GLOW
            mapRef.addLayer({
                id: 'active-route-glow',
                type: 'line',
                source: 'active-route',
                paint: {
                    'line-color': '#f43f5e',
                    'line-width': 12,
                    'line-opacity': 0.2,
                    'line-blur': 6
                }
            });

            // NEON PINK CORE
            mapRef.addLayer({
                id: 'active-route-layer',
                type: 'line',
                source: 'active-route',
                paint: {
                    'line-color': '#f43f5e',
                    'line-width': 4,
                    'line-opacity': 1
                }
            });
        }

        // Add Midpoint Label for Distance/ETA
        const coords = route.geometry.coordinates;
        const midIdx = Math.floor(coords.length / 2);
        const midCoord = coords[midIdx];

        const el = document.createElement('div');
        el.className = 'route-label pointer-events-none z-50';
        el.innerHTML = `
            <div class="bg-[#f43f5e] px-2 py-0.5 border border-white/20 text-[9px] font-black text-white whitespace-nowrap shadow-2xl skew-x-[-10deg]">
                DIST: ${route.distance.toFixed(1)}KM // ETA: ${Math.round(route.duration)} MIN
            </div>
        `;

        const m = new window.maplibregl.Marker({ element: el })
            .setLngLat(midCoord)
            .addTo(mapRef);
        activeRouteLabels.push(m);

        // ADD POINT A (ORIGIN) LABEL
        const elA = document.createElement('div');
        elA.className = 'point-label z-50';
        elA.innerHTML = `<div class="bg-black/90 border border-green-500 px-2 py-0.5 text-[8px] font-black text-green-500 whitespace-nowrap uppercase shadow-2xl">POINT_A // ${origin.name}</div>`;
        const markerA = new window.maplibregl.Marker({ element: elA, offset: [0, -40] }).setLngLat([parseFloat(origin.longitude), parseFloat(origin.latitude)]).addTo(mapRef);
        activeRouteLabels.push(markerA);

        // ADD POINT B (DESTINATION) LABEL
        const elB = document.createElement('div');
        elB.className = 'point-label z-50';
        elB.innerHTML = `<div class="bg-black/90 border border-amber-500 px-2 py-0.5 text-[8px] font-black text-amber-500 whitespace-nowrap uppercase shadow-2xl">POINT_B // ${dest.name}</div>`;
        const markerB = new window.maplibregl.Marker({ element: elB, offset: [0, -40] }).setLngLat([parseFloat(dest.lon || dest.longitude), parseFloat(dest.lat || dest.latitude)]).addTo(mapRef);
        activeRouteLabels.push(markerB);

        // AUTO-ZOOM TO NEWLY RENDERED ROUTE
        const bounds = coords.reduce((acc, coord) => acc.extend(coord), new window.maplibregl.LngLatBounds(coords[0], coords[0]));
        mapRef.fitBounds(bounds, { 
            padding: 100, 
            pitch: 65, 
            bearing: -20, 
            duration: 1500 
        });
    };

    const renderProximityConnections = (origin, proximity) => {
        if (!mapRef || !isMapReady() || !origin || !proximity) return;
        
        const allTargets = [...proximity.airports, ...proximity.ports, ...proximity.industrial_zones];
        if (allTargets.length === 0) {
            if (mapRef.getSource('proximity-lines')) mapRef.getSource('proximity-lines').setData({ type: 'FeatureCollection', features: [] });
            return;
        }

        const geojson = {
            type: 'FeatureCollection',
            features: allTargets.map(target => ({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [parseFloat(origin.longitude), parseFloat(origin.latitude)],
                        [parseFloat(target.lon), parseFloat(target.lat)]
                    ]
                },
                properties: { type: target.type || 'multimodal', distance: target.distance }
            }))
        };

        if (mapRef.getSource('proximity-lines')) {
            mapRef.getSource('proximity-lines').setData(geojson);
        } else {
            mapRef.addSource('proximity-lines', { type: 'geojson', data: geojson });
            
            // GLOW LAYER (CYAN OUTER)
            mapRef.addLayer({
                id: 'proximity-lines-glow',
                type: 'line',
                source: 'proximity-lines',
                paint: {
                    'line-color': '#06B6D4',
                    'line-width': 8,
                    'line-opacity': 0.15,
                    'line-blur': 4
                }
            });

            // CORE LAYER (CYAN DASHED)
            mapRef.addLayer({
                id: 'proximity-lines-layer',
                type: 'line',
                source: 'proximity-lines',
                paint: {
                    'line-color': '#22D3EE',
                    'line-width': 2,
                    'line-dasharray': [4, 2],
                    'line-opacity': 0.7
                }
            });
        }
    };

    const handleStationSelection = async (s) => {
        if (!s) return;
        const normalized = {
            id: s.id || s.osm_id,
            name: s.name || s.alt_name || 'UNKNOWN_STATION',
            latitude: parseFloat(s.latitude || s.lat),
            longitude: parseFloat(s.longitude || s.lon),
            country_code: s.country_code || s['addr:country'] || 'GL',
            time_zone: s.time_zone || 'UTC',
            is_main_station: s.is_main_station || s.railway === 'station',
            operator: s.operator || 'UNKNOWN',
            platforms: s.platforms,
            uic_ref: s.uic_ref || s['railway:ref'],
            railway_ref: s['railway:ref'],
            elevation: s.ele,
            network: s.network,
            osm_type: s.railway,
            rank: s.rank
        };
        
        setSelectedStation(normalized);
        setActiveSidebarTab('analysis'); // AUTO-SWITCH TO ANALYSIS DOSSIER
        
        if (mapRef && normalized.latitude && normalized.longitude) {
            mapRef.flyTo({
                center: [parseFloat(normalized.longitude), parseFloat(normalized.latitude)],
                zoom: 13, // Wide enough to see connections
                pitch: 65,
                bearing: -20,
                speed: 1.5,
                curve: 1.4
            });
            setViewPerspective('tilt');

            // TRIGGER PROXIMITY SCAN (100KM)
            setIsScanningProximity(true);
            const proxData = await fetchProximityAssets(normalized.latitude, normalized.longitude, 100);
            setIsScanningProximity(false);
            if (proxData) {
                renderProximityConnections(normalized, proxData);
            }
        }
    };

    createEffect(() => {
        renderMarkers();
    });


    const togglePerspective = () => {
        if (!mapRef) return;
        const isTop = viewPerspective() === 'top';
        const newPersp = isTop ? 'tilt' : 'top';
        setViewPerspective(newPersp);
        
        // INTELLIGENT AUTO-ZOOM TO ACTIVE ROUTE
        const routeSource = mapRef.getSource('active-route');
        if (routeSource && routeSource._data && routeSource._data.coordinates) {
            const coords = routeSource._data.coordinates;
            const bounds = coords.reduce((acc, coord) => acc.extend(coord), new window.maplibregl.LngLatBounds(coords[0], coords[0]));
            
            mapRef.fitBounds(bounds, { 
                padding: 100, 
                pitch: newPersp === 'top' ? 0 : 65, 
                bearing: newPersp === 'top' ? 0 : -20, 
                duration: 1500 
            });
            return;
        }

        // FALLBACK TO SELECTED STATION OR GLOBAL VIEW
        if (newPersp === 'top') {
            mapRef.flyTo({ pitch: 0, bearing: 0, duration: 1200 });
        } else {
            mapRef.flyTo({ pitch: 65, bearing: -20, duration: 1200 });
        }
    };

    const handleCountryChange = (code) => {
        setSelectedCountry(code);
        fetchStations(code, searchQuery());
        fetchMultimodal(code); // Trigger multimodal fetch for the selected jurisdiction
        setActiveSidebarTab('search'); // Stay on search when changing country
        
        const country = countries().find(c => c.code === code);
        if (country && mapRef) {
            mapRef.flyTo({
                center: [parseFloat(country.longitude), parseFloat(country.latitude)],
                zoom: 5.5, // STRATEGIC_JURISDICTION_OVERVIEW
                pitch: 0,
                duration: 2000
            });
            setViewPerspective('top');
        } else if (!code && mapRef) {
            // Reset to Center View
            mapRef.flyTo({ center: [0, 20], zoom: 2.2, pitch: 0, duration: 1500 });
        }
    };
    const handleGlobalSearch = async (query) => {
        if (!query) return;
        setIsSearchingGlobal(true);
        setActiveSidebarTab('search');
        try {
            const response = await fetch(`${import.meta.env.VITE_RAIL_STATION_API}/orm_proxy/facility?name=${encodeURIComponent(query)}`);
            const data = await response.json();
            setGlobalSearchResults(data || []);
            
            // INTELLIGENT NAVIGATION: AUTO-FLY ONLY ON SINGULAR MATCH
            if (data && data.length === 1) {
                handleStationSelection(data[0]);
            } else if (data && data.length > 1) {
                // Stay on search tab to let user triage multiple hits
                setActiveSidebarTab('search');
            }
        } catch (error) {
            console.error("Global search failed:", error);
        } finally {
            setIsSearchingGlobal(false);
        }
    };

    return (
        <div class="h-full w-full flex bg-[#050505] overflow-hidden font-sans uppercase" style="font-family: 'Roboto', sans-serif;">
            
            {/* TACTICAL ICON RAIL (MINIMALIST) */}
            <div class="w-16 flex flex-col items-center py-6 bg-black border-r border-white/5 gap-8 z-[70]">
                <div class="w-10 h-10 bg-green-500/10 border border-green-500/30 flex items-center justify-center rounded cursor-help">
                    <span class="text-green-500 font-black text-xs">ET</span>
                </div>
                <div class="flex flex-col gap-6">
                    {/* SEARCH_MODE_DB */}
                    <div class="relative group">
                        <button onClick={() => { setActiveSidebarTab('search'); setSearchMode('database'); }} class={`w-10 h-10 flex items-center justify-center rounded transition-all text-xl ${activeSidebarTab() === 'search' && searchMode() === 'database' ? 'text-green-500 bg-green-500/10' : 'text-white/60 hover:text-white'}`}>🔍</button>
                        <div class="absolute left-full ml-4 px-2 py-1 bg-green-900 border border-green-500/50 text-green-400 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[100] pointer-events-none before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-green-500/50">
                            DATABASE
                        </div>
                    </div>

                    {/* SEARCH_MODE_GLOBAL */}
                    <div class="relative group">
                        <button onClick={() => { setActiveSidebarTab('search'); setSearchMode('global_net'); }} class={`w-10 h-10 flex items-center justify-center rounded transition-all text-xl ${activeSidebarTab() === 'search' && searchMode() === 'global_net' ? 'text-blue-500 bg-blue-500/10' : 'text-white/60 hover:text-white'}`}>📡</button>
                        <div class="absolute left-full ml-4 px-2 py-1 bg-blue-900 border border-blue-500/50 text-blue-400 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[100] pointer-events-none before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-blue-500/50">
                            OSINT
                        </div>
                    </div>

                    {/* ANALYSIS_DOSSIER */}
                    <div class="relative group">
                        <button onClick={() => { if(selectedStation()) setActiveSidebarTab('analysis'); }} class={`w-10 h-10 flex items-center justify-center rounded transition-all text-xl ${activeSidebarTab() === 'analysis' ? 'text-amber-500 bg-amber-500/10' : 'text-white/60 hover:text-white'} ${!selectedStation() ? 'opacity-20 cursor-not-allowed' : ''}`}>📑</button>
                        <div class="absolute left-full ml-4 px-2 py-1 bg-amber-900 border border-amber-500/50 text-amber-400 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[100] pointer-events-none before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-amber-500/50">
                            DOSSIER
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN SIDEBAR: COMMAND CENTER */}
            <div class="w-[360px] flex flex-col bg-zinc-950 border-r border-white/10 overflow-hidden shadow-2xl z-[60]">
                
                {/* TACTICAL TABS */}
                <div class="flex bg-black border-b border-white/10 shrink-0">
                    <button 
                        onClick={() => setActiveSidebarTab('search')}
                        class={`flex-1 py-3 text-[9px] font-black transition-all ${activeSidebarTab() === 'search' ? 'text-white bg-zinc-900 border-b-2 border-blue-500' : 'text-white/30 hover:text-white/60'}`}
                    >
                        SEARCH
                    </button>
                    <button 
                        onClick={() => { if(selectedStation()) setActiveSidebarTab('analysis'); }}
                        class={`flex-1 py-3 text-[9px] font-black transition-all ${activeSidebarTab() === 'analysis' ? 'text-white bg-zinc-900 border-b-2 border-amber-500' : 'text-white/30 hover:text-white/60'} ${!selectedStation() ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                        DOSSIER
                    </button>
                </div>

                <div class="flex-1 overflow-y-auto win-scroll relative">
                    <Show when={activeSidebarTab() === 'search'} fallback={
                        /* ANALYSIS DOSSIER VIEW (Unified) */
                        <div class="flex flex-col animate-in slide-in-from-left duration-300">
                            <Show when={selectedStation()} fallback={
                                <div class="p-12 text-center space-y-4">
                                    <div class="text-[30px] opacity-20">📑</div>
                                    <div class="text-[10px] text-white/20 font-black">SELECT ASSET FOR DETAILS</div>
                                </div>
                            }>
                                <div class="p-5 space-y-6">
                                    {/* HEADER METRICS */}
                                    <div class="flex items-start gap-4">
                                        <div class="bg-amber-500/10 border border-amber-500/30 p-3 rounded">
                                            <span class="text-xl">🚉</span>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="text-[12px] font-black text-white truncate leading-none mb-1">{selectedStation().name}</div>
                                            <div class="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">{selectedStation().operator}</div>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-2 gap-2">
                                        <div class="bg-black/60 p-3 border border-white/5">
                                            <div class="text-[7px] text-white/40 mb-1 uppercase">Infrastructure Ref</div>
                                            <div class="text-[10px] text-white font-black">{selectedStation().railway_ref || selectedStation().uic_ref || 'N/A'}</div>
                                            <div class="text-[6px] text-amber-400 mt-1 uppercase font-bold">TYPE: {selectedStation().osm_type || 'STATION'}</div>
                                        </div>
                                        <div class="bg-black/60 p-3 border border-white/5">
                                            <div class="text-[7px] text-white/40 mb-1 uppercase">Strat Rank</div>
                                            <div class="text-[10px] text-blue-500 font-black">LEVEL {selectedStation().rank || '??'}</div>
                                            <div class="text-[6px] text-green-500 mt-1 uppercase font-bold">DATA VERIFIED</div>
                                        </div>
                                    </div>

                                    <div class="bg-white/5 p-4 border border-white/5">
                                        <div class="text-[7px] text-green-500 font-black mb-3 tracking-widest leading-none flex justify-between items-center">
                                            <span>GEOSPATIAL DATA</span>
                                            <span class="text-[6px] opacity-40">AUTO_SYNCED_v2</span>
                                        </div>
                                        <div class="grid grid-cols-2 gap-4">
                                            <div><div class="text-[7px] text-white/40">LATITUDE</div><div class="text-[10px] text-white font-bold">{selectedStation().latitude.toFixed(6)}</div></div>
                                            <div><div class="text-[7px] text-white/40">LONGITUDE</div><div class="text-[10px] text-white font-bold">{selectedStation().longitude.toFixed(6)}</div></div>
                                        </div>
                                    </div>

                                    <div class="space-y-4">
                                        <div class="flex items-center justify-between border-b border-white/10 pb-2">
                                            <div class="text-[7px] text-zinc-500 uppercase font-black tracking-widest">REGIONAL LOGISTICS</div>
                                            <Show when={isScanningProximity()}>
                                                <div class="text-[6px] text-cyan-400 animate-pulse italic">SEARCHING 100KM RADIUS...</div>
                                            </Show>
                                        </div>

                                        <div class="space-y-4">
                                            <Show when={filteredProximity().airports.length > 0}>
                                                <div class="space-y-1.5">
                                                    <div class="flex justify-between items-end mb-1">
                                                        <div class="text-[6px] text-blue-400 font-black uppercase flex items-center gap-1"><span>✈️</span> AIRPORTS</div>
                                                        <button onClick={() => setActiveDetailTable('airports')} class="text-[6px] text-white/30 hover:text-white transition-colors font-black border-b border-white/10 pb-0.5">VIEW ALL</button>
                                                    </div>
                                                    <For each={filteredProximity().airports.slice(0, 3)}>{(a) => (
                                                        <div onClick={() => renderRealRoute(a)} class="bg-blue-500/5 border border-blue-500/10 p-2 flex justify-between items-center group hover:bg-blue-500/10 transition-all cursor-pointer">
                                                            <div class="min-w-0 pr-3">
                                                                <div class="text-[8px] font-bold text-white uppercase truncate">{a.name}</div>
                                                                <div class="text-[6px] text-blue-400 font-bold uppercase mt-0.5">{a.type.replace('_', ' ')}</div>
                                                            </div>
                                                            <div class="text-[8px] font-black text-blue-400 whitespace-nowrap shrink-0">{a.distance.toFixed(1)}KM</div>
                                                        </div>
                                                    )}</For>
                                                </div>
                                            </Show>

                                            <Show when={filteredProximity().ports.length > 0}>
                                                <div class="space-y-1.5">
                                                    <div class="flex justify-between items-end mb-1">
                                                        <div class="text-[6px] text-cyan-400 font-black uppercase flex items-center gap-1"><span>⚓</span> PORTS</div>
                                                        <button onClick={() => setActiveDetailTable('ports')} class="text-[6px] text-white/30 hover:text-white transition-colors font-black border-b border-white/10 pb-0.5">VIEW ALL</button>
                                                    </div>
                                                    <For each={filteredProximity().ports.slice(0, 3)}>{(p) => (
                                                        <div onClick={() => renderRealRoute(p)} class="bg-cyan-500/5 border border-cyan-500/10 p-2 flex justify-between items-center group hover:bg-cyan-500/10 transition-all cursor-pointer">
                                                            <div class="min-w-0 pr-3">
                                                                <div class="text-[8px] font-bold text-white uppercase truncate">{p.name || 'UNNAMED_PORT'}</div>
                                                                <div class="text-[6px] text-cyan-400 font-bold uppercase mt-0.5 tracking-tighter">PORT_INDEX: {p.id}</div>
                                                            </div>
                                                            <div class="text-[8px] font-black text-cyan-400 whitespace-nowrap shrink-0">{p.distance.toFixed(1)}KM</div>
                                                        </div>
                                                    )}</For>
                                                </div>
                                            </Show>

                                            <Show when={filteredProximity().industrial_zones.length > 0}>
                                                <div class="space-y-1.5">
                                                    <div class="flex justify-between items-end mb-1">
                                                        <div class="text-[6px] text-amber-400 font-black uppercase flex items-center gap-1"><span>🏭</span> INDUSTRIAL ZONES</div>
                                                        <button onClick={() => setActiveDetailTable('industry')} class="text-[6px] text-white/30 hover:text-white transition-colors font-black border-b border-white/10 pb-0.5">VIEW ALL</button>
                                                    </div>
                                                    <For each={filteredProximity().industrial_zones.slice(0, 3)}>{(i) => (
                                                        <div onClick={() => renderRealRoute(i)} class="bg-amber-500/5 border border-amber-500/10 p-2 flex justify-between items-center group hover:bg-amber-500/10 transition-all cursor-pointer">
                                                            <div class="min-w-0 pr-3">
                                                                <div class="text-[8px] font-bold text-white uppercase truncate">{i.name}</div>
                                                                <div class="text-[6px] text-amber-400 font-bold uppercase mt-0.5">OWNER: {i.ownership || 'PRIVATE_ENTITY'}</div>
                                                            </div>
                                                            <div class="text-[8px] font-black text-amber-400 whitespace-nowrap shrink-0">{i.distance.toFixed(1)}KM</div>
                                                        </div>
                                                    )}</For>
                                                </div>
                                            </Show>
                                        </div>
                                    </div>

                                    {/* MINI SAT RECON */}
                                    <div class="bg-black/40 border border-white/5 rounded-sm p-4 mt-8">
                                        <div class="text-[7px] text-white/40 font-black mb-2 px-1 text-center">SATELLITE VIEW</div>
                                        <iframe width="100%" height="150" frameborder="0" class="grayscale hover:grayscale-0 transition-all duration-700 border border-white/10"
                                            src={`https://maps.google.com/maps?q=${selectedStation().latitude},${selectedStation().longitude}&hl=en&z=17&t=k&output=embed`}>
                                        </iframe>
                                    </div>
                                </div>
                            </Show>
                        </div>
                    }>
                        {/* SEARCH CONTROL HUB CONTENT */}
                        <div class="flex flex-col animate-in slide-in-from-right duration-300">
                            <div class="p-4 border-b border-white/5 bg-black/20 space-y-4">
                                {/* Mode Toggle & Search Input */}
                                <div class="space-y-4">
                                    <Show when={searchMode() === 'database'}>
                                        <div class="space-y-1">
                                            <label class="text-[7px] text-white/30 font-black uppercase">SELECT COUNTRY</label>
                                            <select class="w-full bg-black border border-white/10 text-[9px] text-white px-3 py-2 outline-none focus:border-green-500/50 transition-all uppercase cursor-pointer" onChange={(e) => handleCountryChange(e.target.value)}>
                                                <option value="">ALL COUNTRIES</option>
                                                <For each={countries()}>{(c) => <option value={c.code} selected={selectedCountry() === c.code}>[{c.continent || '??'}] {c.name || c.code}</option>}</For>
                                            </select>
                                        </div>
                                    </Show>

                                    <div class="relative">
                                        <label class="text-[7px] text-white/30 font-black mb-1 block">SEARCH QUERY</label>
                                        <input 
                                            type="text" 
                                            placeholder={searchMode() === 'database' ? "NAME / CODE + ENTER..." : "INFRA_TYPE / UIC + ENTER..."} 
                                            onInput={(e) => setSearchQuery(e.currentTarget.value)} 
                                            onKeyDown={(e) => { 
                                                if (e.key === 'Enter') { 
                                                    const query = searchQuery(); 
                                                    if (searchMode() === 'database') { 
                                                        if (selectedCountry()) { fetchStations(selectedCountry(), query); } 
                                                        else { fetchCountries(query); } 
                                                    } else { handleGlobalSearch(query); } 
                                                } 
                                            }} 
                                            class={`w-full bg-black border border-white/10 px-3 py-2.5 text-[10px] text-white outline-none transition-all font-bold ${searchMode() === 'global_net' ? 'focus:border-blue-500/50' : 'focus:border-green-500/50'}`} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div class="p-4 bg-zinc-900/50 sticky top-0 backdrop-blur-md z-10 border-b border-white/10">
                                <div class="text-[8px] font-black text-white/40 tracking-[0.2em] mb-1">SEARCH RESULTS</div>
                            </div>
                            
                            <Show when={searchMode() === 'global_net'} fallback={
                                <Show when={selectedCountry()} fallback={
                                    <For each={countries()}>{(c) => (
                                        <div onClick={() => handleCountryChange(c.code)} class="p-4 border-b border-white/5 hover:bg-green-500/5 transition-all cursor-pointer group"><div class="text-[10px] font-black text-white group-hover:text-green-400">{c.name}</div><div class="text-[7px] text-white/20 mt-1 uppercase italic">{c.continent} • {c.code} • {c.station_count} NODES</div></div>
                                    )}</For>
                                }>
                                    <For each={stations().slice(0, 50)}>{(s) => (
                                        <div onClick={() => handleStationSelection(s)} class="p-4 border-b border-white/5 hover:bg-green-500/5 transition-all cursor-pointer group"><div class="text-[10px] font-black text-white group-hover:text-green-400 truncate">{s.name}</div><div class="text-[7px] text-white/20 mt-1 font-mono">{s.is_main_station ? 'MAIN_HUB' : 'REGIONAL'} • {s.country_code}</div></div>
                                    )}</For>
                                </Show>
                            }>
                                <For each={globalSearchResults()}>{(s) => (
                                    <div onClick={() => handleStationSelection(s)} class="p-4 border-b border-blue-500/10 hover:bg-blue-500/5 transition-all cursor-pointer group"><div class="text-[10px] font-black text-blue-400 group-hover:text-blue-300 uppercase">{s.name}</div><div class="text-[7px] text-blue-300/20 mt-1 uppercase">{s.railway} • OSM_ID_{s.osm_id}</div></div>
                                )}</For>
                            </Show>
                        </div>
                    </Show>
                </div>

                <div class="p-4 border-t border-white/5 bg-black/40">
                    <div class="text-[6px] text-white/20 font-black tracking-[0.2em] mb-3">SYSTEM LIVE // DATA SYNCHRONIZED</div>
                    <div class="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-500 w-[94%] shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                    </div>
                </div>
            </div>

            {/* MAIN AREA: MAP + DYNAMIC TABLE DOCK */}
            <div class="flex-1 flex flex-col min-w-0 font-sans relative">
                {/* MAP THEATER */}
                <div class={`relative transition-all duration-500 bg-zinc-900 ${activeDetailTable() ? 'h-[70%] border-b border-white/10' : 'h-full'}`}>
                    <div ref={mapContainer} class="absolute inset-0"></div>
                    
                    {/* HUD CONTROLS */}
                    <div class="absolute top-4 right-4 z-[1000] flex flex-col gap-3">
                        {/* PERSPECTIVE CONTROLS */}
                        <div class="bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                            <button onClick={togglePerspective} title="2D_VIEW" class={`w-8 h-8 flex items-center justify-center transition-all rounded ${viewPerspective() === 'top' ? 'text-green-500 bg-green-500/10' : 'text-white/40 hover:text-white'}`}>⏹️</button>
                            <button onClick={togglePerspective} title="3D_TACTICAL" class={`w-8 h-8 flex items-center justify-center transition-all rounded ${viewPerspective() === 'tilt' ? 'text-green-500 bg-green-500/10' : 'text-white/40'}`}>📐</button>
                        </div>
                        
                        {/* MAP STYLE CONTROLS */}
                        <div class="bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                            <button onClick={() => setMapMode('satellite')} title="SAT_RECON" class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'satellite' ? 'text-blue-500 bg-blue-500/10' : 'text-white/40 hover:text-white'}`}>🛰️</button>
                            <button onClick={() => setMapMode('dark')} title="DARK_HUD" class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'dark' ? 'text-green-500 bg-green-500/10' : 'text-white/40 hover:text-white'}`}>🌑</button>
                            <button onClick={() => setMapMode('light')} title="LIGHT_INTEL" class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'light' ? 'text-amber-500 bg-amber-500/10' : 'text-white/40 hover:text-white'}`}>☀️</button>
                        </div>
                    </div>
                </div>

                {/* DYNAMIC LOGISTICS TRIAGE DOCK (30% Bottom) */}
                <Show when={activeDetailTable()}>
                    <div class="h-[30%] bg-zinc-950 flex flex-col animate-in slide-in-from-bottom duration-500 relative">
                        {/* DOCK HEADER */}
                        <div class={`px-6 py-2 border-b border-white/10 flex justify-between items-center ${activeDetailTable() === 'airports' ? 'bg-blue-500/5' : activeDetailTable() === 'ports' ? 'bg-cyan-500/5' : 'bg-amber-500/5'}`}>
                            <div class="flex items-center gap-4">
                                <h3 class="text-[9px] font-black text-white tracking-[0.2em] uppercase">
                                    {activeDetailTable() === 'airports' ? 'AIRPORT INVENTORY' : activeDetailTable() === 'ports' ? 'PORT REGISTRY' : 'INDUSTRIAL ASSETS'}
                                </h3>
                                <div class="h-3 w-px bg-white/10"></div>
                                <div class="text-[7px] text-white/30 font-bold uppercase italic tracking-tighter">RADIUS: 100KM</div>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="text-[8px] font-black text-green-500/60 uppercase">{filteredProximity()[activeDetailTable()].length} ENTITIES FOUND</div>
                                <button onClick={() => setActiveDetailTable(null)} class="text-white/20 hover:text-white text-[10px] font-black">CLOSE [X]</button>
                            </div>
                        </div>

                        {/* TABLE CONTAINER */}
                        <div class="flex-1 overflow-y-auto win-scroll">
                            <table class="w-full text-left border-collapse table-fixed">
                                <thead class="sticky top-0 bg-zinc-900 z-10 border-b border-white/5">
                                    <tr class="text-[7px] font-black text-white/30 uppercase tracking-widest"><th class="px-6 py-2 w-1/3">ASSET_IDENTIFIER</th><th class="px-3 py-2">CATEGORY</th><th class="px-3 py-2">METADATA</th><th class="px-6 py-2 text-right">DIST_KM</th></tr>
                                </thead>
                                <tbody class="text-[9px]">
                                    <For each={filteredProximity()[activeDetailTable()]}>{(item) => (
                                        <tr onClick={() => renderRealRoute(item)} class="border-b border-white/5 hover:bg-white/[0.03] transition-colors group cursor-pointer">
                                            <td class="px-6 py-2">
                                                <div class="font-black text-white group-hover:text-amber-400 truncate uppercase">{item.name || 'UNNAMED_FACILITY'}</div>
                                            </td>
                                            <td class="px-3 py-2">
                                                <span class={`text-[7px] font-black uppercase ${activeDetailTable() === 'airports' ? 'text-blue-400' : activeDetailTable() === 'ports' ? 'text-cyan-400' : 'text-amber-400'}`}>
                                                    {activeDetailTable() === 'airports' ? (item.type || 'AIRPORT') : activeDetailTable() === 'ports' ? 'PORT_FACILITY' : (item.sector || 'INDUSTRIAL')}
                                                </span>
                                            </td>
                                            <td class="px-3 py-2 uppercase italic text-white/20 text-[8px]">
                                                {activeDetailTable() === 'airports' ? `IATA: ${item.iata_code || 'N/A'}` : activeDetailTable() === 'ports' ? `IDX: ${item.id}` : `OWN: ${item.ownership || 'PVT'}`}
                                            </td>
                                            <td class="px-6 py-2 text-right font-black text-white/40 group-hover:text-green-500 transition-colors uppercase italic">{item.distance.toFixed(1)}</td>
                                        </tr>
                                    )}</For>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
}
