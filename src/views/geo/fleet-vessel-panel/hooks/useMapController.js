import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { HARBOR_PALETTE } from '../constants/colors';
import { getVesselColor, getRouteLabel } from '../utils/helpers';

/**
 * MapLibre GL map controller
 */
export function useMapController(state) {
    let mapInstance = null;
    let isolatedMarkers = [];
    let refineryMarkers = [];

    const registerSquareIcon = (id, color) => {
        const canvas = document.createElement('canvas');
        canvas.width = 30;
        canvas.height = 30;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(6, 7, 10, 0.7)';
        ctx.fillRect(8, 8, 14, 14);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(8, 8, 14, 14);
        ctx.fillStyle = color;
        ctx.fillRect(14, 14, 2, 2);
        const data = ctx.getImageData(0, 0, 30, 30);
        if (!mapInstance.hasImage(id)) mapInstance.addImage(id, data);
    };

    const createBaseStyle = () => ({
        version: 8,
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        sources: {
            'satellite': {
                type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                attribution: 'Esri, Maxar'
            }
        },
        layers: [{
            id: 'satellite',
            type: 'raster',
            source: 'satellite',
            minzoom: 0,
            maxzoom: 20
        }]
    });

    const addRoutingLayers = () => {
        // Port route source and layer
        mapInstance.addSource('route-port', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        mapInstance.addLayer({
            id: 'layer-route-port',
            type: 'line',
            source: 'route-port',
            paint: {
                'line-color': '#00f2ff',
                'line-width': 3,
                'line-dasharray': [2, 1],
                'line-opacity': ['get', 'opacity']
            }
        });

        // Refinery route source and layer
        mapInstance.addSource('route-refinery', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        mapInstance.addLayer({
            id: 'layer-route-refinery',
            type: 'line',
            source: 'route-refinery',
            paint: {
                'line-color': '#ff9d00',
                'line-width': 4,
                'line-dasharray': [1, 1],
                'line-opacity': ['get', 'opacity']
            }
        });

        // Route labels
        const addRouteLabels = (sourceId, layerId, color) => {
            mapInstance.addLayer({
                id: layerId,
                type: 'symbol',
                source: sourceId,
                layout: {
                    'text-field': ['get', 'label'],
                    'symbol-placement': 'line-center',
                    'text-font': ['Open Sans Regular'],
                    'text-size': 9,
                    'text-offset': [0, -1],
                    'text-allow-overlap': true,
                    'text-keep-upright': true
                },
                paint: {
                    'text-color': color,
                    'text-halo-color': '#000000',
                    'text-halo-width': 2
                }
            });
        };

        addRouteLabels('route-port', 'layer-route-port-labels', '#00f2ff');
        addRouteLabels('route-refinery', 'layer-route-refinery-labels', '#ff9d00');
    };

    const addTankerMeshLayers = () => {
        mapInstance.addSource('tanker-mesh-dots', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        mapInstance.addLayer({
            id: 'layer-tanker-mesh-dots',
            type: 'circle',
            source: 'tanker-mesh-dots',
            paint: {
                'circle-radius': 4,
                'circle-color': '#ff9d00',
                'circle-opacity': 0.8,
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff'
            }
        });
        mapInstance.addLayer({
            id: 'layer-tanker-mesh-labels',
            type: 'symbol',
            source: 'tanker-mesh-dots',
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Regular'],
                'text-size': 8,
                'text-offset': [0, 1.2],
                'text-anchor': 'top'
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 1
            }
        });
    };

    const addVesselLayers = () => {
        mapInstance.addSource('vessels', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        mapInstance.addLayer({
            id: 'vessels-point',
            type: 'circle',
            source: 'vessels',
            paint: {
                'circle-radius': 5,
                'circle-color': ['get', 'color'],
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#06070a'
            }
        });
        mapInstance.addLayer({
            id: 'vessels-labels',
            type: 'symbol',
            source: 'vessels',
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Regular'],
                'text-size': 9,
                'text-offset': [0, 1.2],
                'text-anchor': 'top'
            },
            paint: {
                'text-color': ['get', 'color'],
                'text-halo-color': '#06070a',
                'text-halo-width': 1.2
            }
        });
    };

    const addPortLayers = () => {
        mapInstance.addSource('ports', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        mapInstance.addLayer({
            id: 'ports-layer',
            type: 'symbol',
            source: 'ports',
            minzoom: 3,
            layout: {
                'icon-image': [
                    'match', ['get', 'type'],
                    'CN', 'sq-CN', 'CB', 'sq-CB', 'CT', 'sq-CT',
                    'RN', 'sq-RN', 'RB', 'sq-RB', 'RT', 'sq-RT',
                    'LC', 'sq-LC', 'OR', 'sq-OR', 'TH', 'sq-TH',
                    'sq-DEFAULT'
                ],
                'icon-size': 1,
                'icon-allow-overlap': true,
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Regular'],
                'text-size': 8.5,
                'text-offset': [0, 1.2],
                'text-anchor': 'top'
            },
            paint: {
                'text-color': [
                    'match', ['get', 'type'],
                    'CN', '#3b82f6', 'CB', '#0ea5e9', 'CT', '#00f2ff',
                    'RN', '#10b981', 'RB', '#059669', 'RT', '#34d399',
                    'LC', '#8b5cf6', 'OR', '#f43f5e', 'TH', '#f59e0b',
                    '#ffffff'
                ],
                'text-halo-color': '#06070a',
                'text-halo-width': 1.5
            }
        });
    };

    const addSelectionLayer = () => {
        mapInstance.addSource('selection', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        mapInstance.addLayer({
            id: 'selection-halo',
            type: 'circle',
            source: 'selection',
            paint: {
                'circle-radius': 12,
                'circle-color': 'transparent',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 0.8
            }
        });
    };

    const [isMapReady, setIsMapReady] = createSignal(false);

    const setupClickHandlers = () => {
        mapInstance.on('mouseenter', 'vessels-point', () =>
            mapInstance.getCanvas().style.cursor = 'pointer');
        mapInstance.on('mouseleave', 'vessels-point', () =>
            mapInstance.getCanvas().style.cursor = '');

        mapInstance.on('click', (e) => {
            const layers = ['vessels-point', 'ports-layer'];
            const features = mapInstance.queryRenderedFeatures(e.point, { layers });
            if (features.length > 0) {
                const f = features[0];
                if (f.layer.id === 'vessels-point') {
                    state.setSelectedMmsi(f.properties.mmsi);
                    state.setSelectedPortId(null);
                    state.setShowRegistry(true);
                } else if (f.layer.id === 'ports-layer') {
                    state.setSelectedPortId(f.properties.id);
                    state.setSelectedMmsi(null);
                    state.setShowRegistry(true);
                }
            }
        });
    };

    const initMap = (el) => {
        if (!el) {
            if (mapInstance) {
                isolatedMarkers.forEach(m => m.remove());
                isolatedMarkers = [];
                refineryMarkers.forEach(m => m.remove());
                refineryMarkers = [];
                mapInstance.remove();
                mapInstance = null;
                window.__mapInstance = null;
                setIsMapReady(false);
            }
            return;
        }

        if (mapInstance) return;

        mapInstance = new window.maplibregl.Map({
            container: el,
            style: createBaseStyle(),
            center: [30, 20],
            zoom: 1.5,
            attributionControl: false,
            antialias: true,
            fadeDuration: 300,
            trackResize: true
        });

        window.__mapInstance = mapInstance;

        mapInstance.on('load', () => {
            setIsMapReady(true);
            Object.entries(HARBOR_PALETTE).forEach(([key, color]) =>
                registerSquareIcon(`sq-${key}`, color));

            addRoutingLayers();
            addTankerMeshLayers();
            addVesselLayers();
            addPortLayers();
            addSelectionLayer();
            syncPortsOnMap();
            setupClickHandlers();

            setTimeout(() => mapInstance?.resize(), 100);
        });
    };

    const syncPortsOnMap = () => {
        if (!mapInstance || !mapInstance.getSource('ports')) return;
        const features = state.portsForMap().map(p => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
            properties: {
                name: p.name,
                id: p.id,
                type: p.harbor_type,
                size: p.harbor_size,
                country: p.country_name
            }
        }));
        mapInstance.getSource('ports').setData({ type: 'FeatureCollection', features });
    };



    const createIsolatedMarker = (html, lngLat) => {
        const el = document.createElement('div');
        el.innerHTML = html;
        return new window.maplibregl.Marker({ element: el })
            .setLngLat(lngLat)
            .addTo(mapInstance);
    };

    const syncMap = () => {
        if (!mapInstance || !mapInstance.getSource('vessels')) return;

        let vessels = Array.from(state.vesselRegistry.values());
        if (state.vesselFilter() !== 'ALL') {
            const f = state.vesselFilter().toLowerCase();
            vessels = vessels.filter(v => (v.type || '').toLowerCase() === f);
        }

        const mmsi = state.selectedMmsi();
        isolatedMarkers.forEach(m => m.remove());
        isolatedMarkers = [];

        // Always sync basic sources to maintain context and use normal pin styles
        syncPortsOnMap();
        const features = vessels.map(v => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
            properties: { name: v.name, mmsi: v.mmsi, color: getVesselColor(v.type) }
        }));
        mapInstance.getSource('vessels').setData({ type: 'FeatureCollection', features });

        if (mmsi) {
            const ship = state.vesselRegistry.get(mmsi);

            if (ship) {
                const shipColor = getVesselColor(ship.type);
                const shipHtml = `
          <div class="flex flex-col items-center gap-1">
            <div style="background-color: ${shipColor}; box-shadow: 0 0 20px ${shipColor}" class="w-4 h-4 rounded-full border-2 border-white animate-pulse"></div>
            <div style="border-color: ${shipColor}" class="px-2 py-0.5 bg-black/90 border text-[9px] font-black text-white whitespace-nowrap">SHIP: ${ship.name}</div>
          </div>`;
                isolatedMarkers.push(createIsolatedMarker(shipHtml, [ship.lon || ship.longitude, ship.lat || ship.latitude]));

                const port = state.ports().find(p => p.name === ship.destination_port);
                if (port) {
                    const portHtml = `
            <div class="flex flex-col items-center gap-1">
              <div class="bg-cyan-700 p-2 rounded-full border-2 border-white shadow-[0_0_25px_#00f2ff]">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15l-4-4 4-4M17 15l4-4-4-4" />
                </svg>
              </div>
              <div class="px-2 py-0.5 bg-black/90 border border-cyan-400 text-[9px] font-black text-cyan-400 whitespace-nowrap">PORT: ${port.name}</div>
            </div>`;
                    isolatedMarkers.push(createIsolatedMarker(portHtml, [port.longitude, port.latitude]));
                }

                const refinery = ship.closest_refinery;
                if (refinery) {
                    const refHtml = `
            <div class="flex flex-col items-center gap-1">
              <div class="bg-orange-600 p-2 rounded-full border-2 border-white shadow-[0_0_25px_#ff9d00]">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div class="px-2 py-0.5 bg-black/90 border border-orange-400 text-[9px] font-black text-orange-400 whitespace-nowrap">REFINERY: ${refinery.name}</div>
            </div>`;
                    isolatedMarkers.push(createIsolatedMarker(refHtml, [refinery.lon || refinery.longitude, refinery.lat || refinery.latitude]));
                }
            }
        } else {
            syncRefineryMarkers();
        }
        syncRouting();
    };

    const syncRefineryMarkers = () => {
        refineryMarkers.forEach(m => m.remove());
        refineryMarkers = [];

        const refineries = [];
        refineries.forEach(ref => {
            const el = document.createElement('div');
            el.innerHTML = `
        <div class="relative group cursor-pointer">
          <div class="w-3 h-3 bg-orange-600 border border-white/40 shadow-[0_0_10px_rgba(255,157,0,0.5)]"></div>
          <div class="absolute hidden group-hover:block top-4 left-0 bg-black/90 border border-orange-500 p-1 text-[7px] text-orange-400 whitespace-nowrap z-50">
            REFINERY: ${ref.nama_kilang}
          </div>
        </div>`;
            el.onclick = () => {
                state.setSelectedRefinery(ref);
                state.setSelectedPortId(null);
                state.setSelectedMmsi(null);
            };
            const m = new window.maplibregl.Marker(el)
                .setLngLat([ref.longitude, ref.latitude])
                .addTo(mapInstance);
            refineryMarkers.push(m);
        });
    };

    const syncRouting = () => {
        const ship = state.activeShip();
        let portFeatures = [];
        let refineryFeatures = [];

        const drawShipFlow = (targetShip, opacity = 1.0) => {
            const port = state.ports().find(p => p.name === targetShip.destination_port);
            if (port) {
                portFeatures.push({
                    type: 'Feature',
                    properties: { opacity, label: getRouteLabel(targetShip.distance_port_km, targetShip.speed) },
                    geometry: {
                        type: 'LineString',
                        coordinates: [[targetShip.lon || targetShip.longitude, targetShip.lat || targetShip.latitude], [port.longitude, port.latitude]]
                    }
                });
            }

            const refinery = targetShip.closest_refinery;
            if (refinery) {
                refineryFeatures.push({
                    type: 'Feature',
                    properties: { opacity, label: getRouteLabel(refinery.distance_km, targetShip.speed) },
                    geometry: {
                        type: 'LineString',
                        coordinates: [[targetShip.lon || targetShip.longitude, targetShip.lat || targetShip.latitude], [refinery.lon || refinery.longitude, refinery.lat || refinery.latitude]]
                    }
                });
            }
        };

        if (ship) drawShipFlow(ship, 1.0);

        if (state.showAllFlows()) {
            const others = [];
            others.forEach(s => drawShipFlow(s, 0.3));

            if (mapInstance.getSource('tanker-mesh-dots')) {
                const tankerDots = others
                    .filter(s => s.type?.toLowerCase().includes('tanker'))
                    .map(s => ({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [s.lon || s.longitude, s.lat || s.latitude] },
                        properties: { name: s.name }
                    }));
                mapInstance.getSource('tanker-mesh-dots').setData({ type: 'FeatureCollection', features: tankerDots });
            }
        } else {
            mapInstance.getSource('tanker-mesh-dots')?.setData({ type: 'FeatureCollection', features: [] });
        }

        mapInstance.getSource('route-port')?.setData({ type: 'FeatureCollection', features: portFeatures });
        mapInstance.getSource('route-refinery')?.setData({ type: 'FeatureCollection', features: refineryFeatures });
    };

    const syncSelection = () => {
        const target = state.activeShip();
        if (!mapInstance?.getSource('selection')) return;

        if (target && target.lon != null && target.lat != null) {
            mapInstance.getSource('selection').setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [target.lon, target.lat] },
                    properties: { mmsi: target.mmsi }
                }]
            });
        } else {
            mapInstance.getSource('selection').setData({ type: 'FeatureCollection', features: [] });
        }
    };

    const jumpTo = (center, zoom) => {
        mapInstance?.jumpTo({ center, zoom });
    };

    const flyTo = (center, zoom) => {
        mapInstance?.flyTo({ center, zoom, duration: 2000 });
    };

    const clearVessels = () => {
        mapInstance?.getSource('vessels')?.setData({ type: 'FeatureCollection', features: [] });
    };

    const togglePerspective = () => {
        if (!mapInstance) return;
        const isTop = state.viewPerspective() === 'top';
        const newPersp = isTop ? 'tilt' : 'top';
        state.setViewPerspective(newPersp);
        
        const ship = state.activeShip();
        const port = state.activePort();
        const targetCoord = ship ? [ship.lon || ship.longitude, ship.lat || ship.latitude] : (port ? [port.longitude, port.latitude] : null);

        if (newPersp === 'top') {
            mapInstance.flyTo({ 
                center: targetCoord || mapInstance.getCenter(),
                zoom: targetCoord ? 14 : Math.max(mapInstance.getZoom(), 4),
                pitch: 0, 
                bearing: 0, 
                duration: 2000,
                essential: true 
            });
        } else {
            mapInstance.flyTo({ 
                center: targetCoord || mapInstance.getCenter(),
                zoom: targetCoord ? 16.5 : (mapInstance.getZoom() < 12 ? 14 : mapInstance.getZoom()),
                pitch: 65, 
                bearing: 45, 
                duration: 2500,
                essential: true 
            });
        }
    };

    const setupReactiveEffects = () => {
        createEffect(() => { isMapReady(); syncSelection(); });
        createEffect(() => { isMapReady(); state.ships(); state.vesselFilter(); syncMap(); });
        createEffect(() => { isMapReady(); state.portFilter(); syncPortsOnMap(); });

        // Map Style Switching (Ported from IndustrialZonePanel)
        createEffect(() => {
            const mode = state.mapMode();
            const ready = isMapReady();
            if (!mapInstance || !ready || !mapInstance.isStyleLoaded()) return;

            let tiles = [];
            if (mode === 'dark') {
                tiles = [
                    'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
                ];
            } else if (mode === 'terrain') {
                tiles = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'];
            } else {
                tiles = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'];
            }

            try {
                if (mapInstance.getSource('osm')) {
                    mapInstance.removeLayer('osm');
                    mapInstance.removeSource('osm');
                }

                mapInstance.addSource('osm', {
                    type: 'raster',
                    tiles: tiles,
                    tileSize: 256,
                    attribution: '© ESRI Professional Geospatial'
                });

                // Add at the bottom
                mapInstance.addLayer({
                    id: 'osm',
                    type: 'raster',
                    source: 'osm'
                }, mapInstance.getStyle().layers[0]?.id);
            } catch (e) {
                console.warn("Style update skipped:", e);
            }
        });


    };

    onMount(() => {
        window.addEventListener('resize', () => mapInstance?.resize());
        setupReactiveEffects();
    });

    onCleanup(() => {
        if (mapInstance) mapInstance.remove();
    });

    const hardReset = () => {
        const el = mapInstance?.getContainer();
        if (el) {
            initMap(null);
            setTimeout(() => initMap(el), 100);
        }
    };

    return {
        initMap,
        syncMap,
        syncPortsOnMap,
        togglePerspective,
        jumpTo,
        flyTo,
        clearVessels,
        hardReset,
        getMap: () => mapInstance
    };
}