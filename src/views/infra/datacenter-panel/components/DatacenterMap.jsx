import { onMount, onCleanup, createEffect, createSignal } from 'solid-js';

export default function DatacenterMap(props) {
    let mapContainer;
    let mapInstance = null;
    let markers = [];
    const [isMapReady, setIsMapReady] = createSignal(false);

    onMount(() => {
        initMap();
    });

    onCleanup(() => {
        if (mapInstance) {
            mapInstance.remove();
        }
    });

    createEffect(() => {
        const mode = props.mapMode();
        if (!mapInstance || !isMapReady()) return;

        const tiles = {
            dark: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            light: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            terrain: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
        };

        const source = mapInstance.getSource('osm');
        if (source) {
            mapInstance.removeLayer('osm');
            mapInstance.removeSource('osm');
        }

        mapInstance.addSource('osm', {
            type: 'raster',
            tiles: [tiles[mode] || tiles.dark],
            tileSize: 256,
            attribution: '© ESRI Professional Geospatial // CARTO'
        });

        mapInstance.addLayer({
            id: 'osm',
            type: 'raster',
            source: 'osm'
        }, mapInstance.getLayer('markers') ? 'markers' : undefined);
    });

    createEffect(() => {
        const persp = props.viewPerspective();
        if (!mapInstance || !isMapReady()) return;

        if (persp === 'top') {
            mapInstance.flyTo({ pitch: 0, bearing: 0, duration: 1500 });
        } else {
            mapInstance.flyTo({ pitch: 60, bearing: 30, duration: 1500 });
        }
    });

    const initMap = () => {
        if (!mapContainer) return;

        mapInstance = new window.maplibregl.Map({
            container: mapContainer,
            style: {
                version: 8,
                sources: {},
                layers: []
            },
            center: [0, 20], 
            zoom: 2,
            pitch: 0,
            antialias: true
        });

        mapInstance.on('load', () => {
            mapInstance.resize();
            setIsMapReady(true);
            props.onMapReady(mapInstance);
        });
    };

    createEffect(() => {
        const isHub = props.activeTableTab !== 'priority';
        const level = props.viewLevel(); // global or country
        
        let data = [];
        if (isHub) {
            data = level === 'global' ? props.hubCountryNodes() : props.hubDatacenters();
        } else {
            data = level === 'global' ? props.countryNodes() : props.datacenters();
        }

        if (isMapReady()) renderMarkers(data, isHub);
    });

    let powerMarkers = [];

    createEffect(() => {
        const plants = props.nearbyPowerPlants();
        const selected = props.selectedDC();
        const selectedPlant = props.selectedPowerPlant();
        if (!mapInstance || !isMapReady()) return;
        
        // --- 1. HANDLE POWER PLANT MARKERS ---
        powerMarkers.forEach(m => m.remove());
        powerMarkers = [];

        if (!selected || !plants || plants.length === 0) {
            cleanupAllEnergyLayers();
            return;
        }

        plants.forEach(plant => {
            const isTarget = selectedPlant?.id === plant.id;
            const el = document.createElement('div');
            el.className = 'cursor-pointer group z-10';
            el.innerHTML = `
                <div class="relative flex flex-col items-center">
                    <div class="${isTarget ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 transition-opacity bg-black/90 border border-yellow-500/30 px-2 py-0.5 mb-1 backdrop-blur-md">
                         <div class="text-[7px] font-black text-yellow-500 whitespace-nowrap uppercase">${plant.name}</div>
                         <div class="text-[6px] text-white/40 uppercase">${plant.primary_fuel} | ${plant.capacity_mw}MW</div>
                    </div>
                    <div class="relative flex items-center justify-center">
                        <div class="absolute inset-0 bg-yellow-400 animate-ping opacity-20 rounded-full"></div>
                        <div class="w-5 h-5 bg-black border ${isTarget ? 'border-yellow-400 border-2' : 'border-yellow-500'} rounded-full flex items-center justify-center shadow-[0_0_10px_#eab30880]">
                            <span class="text-[10px]">⚡</span>
                        </div>
                    </div>
                </div>
            `;

            const m = new window.maplibregl.Marker({ 
                element: el,
                anchor: 'bottom'
            })
                .setLngLat([parseFloat(plant.longitude), parseFloat(plant.latitude)])
                .addTo(mapInstance);
            
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                props.onPowerPlantClick(plant);
            });
            
            powerMarkers.push(m);
        });

        // --- 2. DRAW STRAIGHT DASHED LINES (OVERVIEW) ---
        const dcLat = parseFloat(selected.latitude);
        const dcLon = parseFloat(selected.longitude);
        const lineFeatures = plants.map(plant => ({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[dcLon, dcLat], [parseFloat(plant.longitude), parseFloat(plant.latitude)]]
            }
        }));

        const updateEnergyOverview = () => {
            if (mapInstance.getSource('energy-overview')) {
                mapInstance.getSource('energy-overview').setData({ type: 'FeatureCollection', features: lineFeatures });
            } else {
                mapInstance.addSource('energy-overview', { type: 'geojson', data: { type: 'FeatureCollection', features: lineFeatures } });
                mapInstance.addLayer({
                    id: 'energy-overview-lines',
                    type: 'line',
                    source: 'energy-overview',
                    paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-dasharray': [3, 4], 'line-opacity': 0.4 }
                });
            }
        };

        updateEnergyOverview();

        // --- 3. HANDLE NEON ROAD ROUTING (ONLY IF PLANT SELECTED) ---
        if (selectedPlant) {
            const fetchRoute = async () => {
                const target = selectedPlant;
                try {
                    const tLat = parseFloat(target.latitude);
                    const tLon = parseFloat(target.longitude);
                    
                    console.log(`FETCHING_TACTICAL_ROUTE: [${dcLon},${dcLat}] -> [${tLon},${tLat}]`);
                    
                    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${dcLon},${dcLat};${tLon},${tLat}?overview=full&geometries=geojson`);
                    const data = await res.json();

                    if (data.code === 'Ok' && data.routes.length > 0) {
                        const geometry = data.routes[0].geometry;
                        const distance = (data.routes[0].distance / 1000).toFixed(1);
                        const coords = geometry.coordinates;
                        const midIdx = Math.floor(coords.length / 2);
                        const midCoord = coords[midIdx];

                        const routeData = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: geometry }] };
                        const labelData = { type: 'FeatureCollection', features: [{ 
                            type: 'Feature', 
                            geometry: { type: 'Point', coordinates: midCoord },
                            properties: { distance: `${distance}KM` }
                        }] };

                        if (mapInstance.getSource('power-routes')) {
                            mapInstance.getSource('power-routes').setData(routeData);
                            mapInstance.getSource('power-labels').setData(labelData);
                        } else {
                            mapInstance.addSource('power-routes', { type: 'geojson', data: routeData });
                            
                            // Ensure added above overview and OSM
                            mapInstance.addLayer({
                                id: 'power-routes-glow',
                                type: 'line',
                                source: 'power-routes',
                                layout: { 'line-join': 'round', 'line-cap': 'round' },
                                paint: { 'line-color': '#06b6d4', 'line-width': 8, 'line-blur': 8, 'line-opacity': 0.6 }
                            });
                            mapInstance.addLayer({
                                id: 'power-routes-core',
                                type: 'line',
                                source: 'power-routes',
                                layout: { 'line-join': 'round', 'line-cap': 'round' },
                                paint: { 'line-color': '#22d3ee', 'line-width': 3, 'line-opacity': 1 }
                            });

                            mapInstance.addSource('power-labels', { type: 'geojson', data: labelData });
                            mapInstance.addLayer({
                                id: 'power-labels',
                                type: 'symbol',
                                source: 'power-labels',
                                layout: {
                                    'text-field': ['get', 'distance'],
                                    'text-font': ['Open Sans Bold'],
                                    'text-size': 12,
                                    'text-allow-overlap': true,
                                    'text-offset': [0, -1]
                                },
                                paint: { 'text-color': '#06b6d4', 'text-halo-color': '#000000', 'text-halo-width': 2.5 }
                            });
                        }
                    } else {
                        console.warn("OSRM_ROUTE_NOT_FOUND");
                    }
                } catch (err) { console.error("TACTICAL_ROUTE_FAILURE", err); }
            };
            fetchRoute();
        } else {
            clearNeonLayers();
        }
    });

    const clearNeonLayers = () => {
        if (!mapInstance) return;
        ['power-routes-glow', 'power-routes-core', 'power-labels'].forEach(id => {
            if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
        });
        ['power-routes', 'power-labels'].forEach(id => {
            if (mapInstance.getSource(id)) mapInstance.removeSource(id);
        });
    }

    const cleanupAllEnergyLayers = () => {
        clearNeonLayers();
        if (mapInstance && mapInstance.getLayer('energy-overview-lines')) mapInstance.removeLayer('energy-overview-lines');
        if (mapInstance && mapInstance.getSource('energy-overview')) mapInstance.removeSource('energy-overview');
    }

    const renderMarkers = (dataList, isHub = false) => {
        if (!mapInstance || !Array.isArray(dataList)) return;
        markers.forEach(m => m.remove());
        markers = [];

        const themeColor = isHub ? 'orange' : 'cyan';
        const themeHex = isHub ? '#f97316' : '#06b6d4';

        dataList.forEach(item => {
            const lat = parseFloat(item.lat || item.latitude || 0);
            const lon = parseFloat(item.lon || item.longitude || 0);

            const el = document.createElement('div');
            el.className = 'cursor-pointer group';
            
            if (props.viewLevel() === 'global') {
                const count = item.datacenter_count || 1;
                el.innerHTML = `
                    <div class="relative flex items-center justify-center">
                        <div class="absolute inset-0 bg-${themeColor}-500 animate-ping opacity-20 rounded-full"></div>
                        <div class="w-10 h-10 bg-black/90 border-2 border-${themeColor}-500 rounded-full flex flex-col items-center justify-center shadow-[0_0_15px_${themeHex}80] group-hover:scale-110 transition-transform">
                           <span class="text-[7px] text-white/40 uppercase font-black leading-none mb-1">NODES</span>
                           <span class="text-[11px] font-black text-${themeColor}-400 leading-none">${count > 1000 ? (count/1000).toFixed(1)+'K' : count}</span>
                        </div>
                    </div>
                `;
                const m = new window.maplibregl.Marker({ element: el })
                    .setLngLat([lon, lat])
                    .addTo(mapInstance);
                
                el.addEventListener('click', () => {
                    props.onCountryClick(item.name);
                });
                markers.push(m);
            } else {
                const isSelected = props.selectedDC()?.id === item.id;
                
                if (isSelected) {
                    el.innerHTML = `
                        <div class="relative flex flex-col items-center">
                            <div class="bg-black/90 border-l-4 border-l-${themeColor}-500 px-2 py-1 mb-1 shadow-2xl backdrop-blur-md">
                                <div class="text-[8px] font-black text-white whitespace-nowrap uppercase">${item.facility_name || item.name}</div>
                                <div class="text-[7px] text-white/40 uppercase">${item.company_name || ''}</div>
                            </div>
                            <!-- MapLibre Style SVG Pin -->
                            <svg width="24" height="30" viewBox="0 0 24 36" class="drop-shadow-xl animate-bounce-subtle">
                                <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" fill="${themeHex}"/>
                                <circle cx="12" cy="12" r="4" fill="white"/>
                            </svg>
                        </div>
                    `;
                } else {
                    el.innerHTML = `
                        <div class="w-3 h-3 bg-${themeColor}-600 rounded-full border border-white/50 group-hover:scale-125 transition-transform shadow-[0_0_10px_${themeHex}80]"></div>
                    `;
                }

                const m = new window.maplibregl.Marker({ 
                    element: el,
                    anchor: isSelected ? 'bottom' : 'center'
                })
                    .setLngLat([lon, lat])
                    .addTo(mapInstance);
                
                el.addEventListener('click', () => {
                    props.onDCClick(item);
                });
                markers.push(m);
            }
        });
    };

    return (
        <div ref={mapContainer} class="w-full h-full bg-zinc-900 border border-white/5" />
    );
}
