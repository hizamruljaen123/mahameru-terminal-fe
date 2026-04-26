import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { HARBOR_PALETTE } from '../constants/colors';
import { getVesselColor, getRouteLabel, calculateHaversineDistance } from '../utils/helpers';

/**
 * MapLibre GL map controller
 */
export function useMapController(state) {
    let mapInstance = null;
    let resizeObserver = null;
    let isolatedMarkers = [];
    let refineryMarkers = [];
    let disasterMarkers = [];
    let routeLabels = [];
    let meshLabels = [];
    let hazardLabels = [];
    let hazardPortMarkers = [];

    const clearGroup = (group) => {
        group.forEach(m => m.remove());
        group.length = 0;
    };

    const addLabel = (lngLat, text, color = '#00f2ff', size = '8px', group = routeLabels) => {
        const el = document.createElement('div');
        el.className = 'tactical-label';
        el.innerHTML = `
            <div class="px-1.5 py-0.5 bg-black/80 backdrop-blur-sm border border-${color}/30 text-[${size}] font-black text-${color} whitespace-nowrap uppercase tracking-tighter shadow-2xl" 
                 style="color: ${color}; border-color: ${color}40; font-family: Inter, system-ui, sans-serif;">
                ${text}
            </div>
        `;
        const marker = new window.maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat(lngLat)
            .addTo(mapInstance);
        group.push(marker);
    };

    const getDisasterIconHtml = (type, level) => {
        const color = String(level).toUpperCase() === 'RED' ? '#ff1744' : 
                      String(level).toUpperCase() === 'ORANGE' ? '#ff9100' : '#00e676';
        
        const icons = {
            'EQ': '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>', // Bolt
            'QUAKE': '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
            'FIRE_ANOMALY': '<path d="M12 2c0 10-4 12-4 12s8-3 8-12c0 0-4.5 1.5-4 4.5 0 0-4.5-1.5-4-4.5z"/>', // Flame
            'FL': '<path d="M2 12s3-4 10-4 10 4 10 4-3 4-10 4-10-4-10-4z"/><path d="M7 12c0 1 1 2 5 2s5-1 5-2"/>', // Wave
            'TC': '<path d="M21 4H3l2 16h14l2-16zM12 11h-2v2h2v-2z"/>', // Cyclone
            'TS': '<path d="M21 4H3l2 16h14l2-16zM12 11h-2v2h2v-2z"/>',
            'VO': '<path d="M2 20L12 4l10 16H2z"/>' // Volcano
        };

        const names = {
            'EQ': 'EARTHQUAKE',
            'QUAKE': 'EARTHQUAKE',
            'FIRE_ANOMALY': 'FIRE DETECTED',
            'FL': 'FLOODING',
            'TC': 'CYCLONE',
            'TS': 'STORM',
            'VO': 'VOLCANO',
            'DR': 'DROUGHT'
        };

        const glyph = icons[type] || '<circle cx="12" cy="12" r="5"/>';
        const typeName = names[type] || type.toUpperCase();

        return `
            <div class="relative flex items-center justify-center pointer-events-auto cursor-pointer" title="${typeName}">
                <div class="absolute w-8 h-8 rounded border border-white/20 bg-black/60 backdrop-blur-md"></div>
                <div class="absolute w-6 h-6 rounded rotate-45 border border-${color}" style="border-color: ${color}; background-color: ${color}20"></div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${color}" style="filter: drop-shadow(0 0 4px ${color})">
                    ${glyph}
                </svg>
                <div class="absolute -bottom-6 px-1.5 py-0.5 bg-black/90 border border-white/10 text-[7px] font-black text-white whitespace-nowrap uppercase tracking-tighter shadow-xl">
                    HAZARD: ${typeName}
                </div>
            </div>
        `;
    };

    const syncDisasterMarkers = () => {
        if (!mapInstance) return;
        disasterMarkers.forEach(m => m.remove());
        disasterMarkers = [];

        const alerts = state.disasterAlerts() || [];
        alerts.forEach(alert => {
            const el = document.createElement('div');
            el.innerHTML = getDisasterIconHtml(alert.type, alert.level);
            
            // Add click handler to marker
            el.onclick = () => {
                state.setActiveHazard(alert);
                mapInstance.flyTo({
                    center: [alert.lon, alert.lat],
                    zoom: 10,
                    pitch: 45,
                    essential: true
                });
            };

            const marker = new window.maplibregl.Marker({ element: el })
                .setLngLat([alert.lon, alert.lat])
                .addTo(mapInstance);
            
            disasterMarkers.push(marker);
        });
    };

    const addDisasterProximityLayers = () => {
        mapInstance.addSource('hazard-proximity', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        mapInstance.addLayer({
            id: 'layer-hazard-proximity',
            type: 'line',
            source: 'hazard-proximity',
            paint: {
                'line-color': '#ffffff',
                'line-width': 2,
                'line-dasharray': [2, 2],
                'line-opacity': 0.8
            }
        });
    };

    const syncDisasterProximity = () => {
        if (!mapInstance || !mapInstance.getSource('hazard-proximity')) return;
        clearGroup(hazardLabels);
        clearGroup(hazardPortMarkers);
        
        const hazard = state.activeHazard();
        const infras = state.hazardNearbyInfras() || [];

        if (!hazard || infras.length === 0) {
            mapInstance.getSource('hazard-proximity').setData({ type: 'FeatureCollection', features: [] });
            return;
        }

        const features = infras.map(port => {
            const distText = `${port.distance_km?.toFixed(1)} KM`;
            const label = `${distText} TO ${port.name.toUpperCase()}`;
            
            // Standard Pin Marker with Label Above
            const el = document.createElement('div');
            el.className = 'hazard-port-pin';
            el.innerHTML = `
                <div class="flex flex-col items-center group pointer-events-auto cursor-pointer">
                    <div class="px-2 py-1 bg-black/90 border border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white mb-1 flex flex-col items-center">
                        <span class="text-[8px] font-black tracking-tighter leading-tight">${port.name.toUpperCase()}</span>
                        <span class="text-[7px] font-bold text-blue-400 mt-0.5">${distText} FROM HAZARD</span>
                    </div>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 4px rgba(59,130,246,0.5))">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#3b82f6" stroke="white" stroke-width="1.5"/>
                        <circle cx="12" cy="9" r="2.5" fill="white"/>
                    </svg>
                </div>
            `;
            
            // Add click to select port
            el.onclick = () => {
                state.setSelectedPortId(port.id);
                state.setActiveTab('PORTS');
                state.setShowRegistry(true);
            };

            const marker = new window.maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([port.longitude, port.latitude])
                .addTo(mapInstance);
            hazardPortMarkers.push(marker);

            const midLon = (hazard.lon + port.longitude) / 2;
            const midLat = (hazard.lat + port.latitude) / 2;
            
            if (!isNaN(midLon) && !isNaN(midLat)) {
                addLabel([midLon, midLat], distText, '#ffffff', '7px', hazardLabels);
            }

            return {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[hazard.lon, hazard.lat], [port.longitude, port.latitude]]
                },
                properties: { distance: label }
            };
        });

        mapInstance.getSource('hazard-proximity').setData({ type: 'FeatureCollection', features });
    };

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
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    1, 3,
                    5, 5,
                    10, 8,
                    15, 12
                ],
                'circle-color': ['get', 'color'],
                'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 5, 1.5, 10, 2],
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.9
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
            type: 'circle',
            source: 'ports',
            minzoom: 5,
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    5, 2,
                    10, 5,
                    15, 8
                ],
                'circle-color': [
                    'match', ['get', 'type'],
                    'CN', '#3b82f6', 'CB', '#0ea5e9', 'CT', '#00f2ff',
                    'RN', '#10b981', 'RB', '#059669', 'RT', '#34d399',
                    'LC', '#8b5cf6', 'OR', '#f43f5e', 'TH', '#f59e0b',
                    '#ffffff'
                ],
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff'
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

    const addMeshLayers = () => {
        if (!mapInstance) return;
        mapInstance.addSource('tactical-mesh', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        mapInstance.addLayer({
            id: 'mesh-lines',
            type: 'line',
            source: 'tactical-mesh',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
                'line-color': '#00f2ff',
                'line-width': 1,
                'line-dasharray': [4, 4],
                'line-opacity': 0.4
            }
        });

    };

    const [isMapReady, setIsMapReady] = createSignal(false);
    
    // Helper for mesh sync
    const syncMeshNetwork = () => {
        if (!mapInstance || !mapInstance.getSource('tactical-mesh')) return;
        clearGroup(meshLabels);
        
        const port = state.activePort();
        const active = state.isMeshActive();
        const radius = state.meshRadius();

        if (!active || !port) {
            mapInstance.getSource('tactical-mesh').setData({ type: 'FeatureCollection', features: [] });
            return;
        }

        const features = [];
        const portLat = port.latitude;
        const portLon = port.longitude;
        const ships = Array.from(state.vesselRegistry.values());

        ships.forEach(ship => {
            const shipLat = ship.lat || ship.latitude;
            const shipLon = ship.lon || ship.longitude;
            if (shipLat == null || shipLon == null) return;

            const dist = calculateHaversineDistance(portLat, portLon, shipLat, shipLon);
            if (dist <= radius) {
                const label = `${dist.toFixed(1)}KM`;
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [[portLon, portLat], [shipLon, shipLat]]
                    },
                    properties: { distance: label }
                });

                // Add HTML label at midpoint
                addLabel([(portLon + shipLon) / 2, (portLat + shipLat) / 2], label, '#00f2ff', '6px', meshLabels);
            }
        });

        mapInstance.getSource('tactical-mesh').setData({ type: 'FeatureCollection', features });
    };

    const addNearbyLayers = () => {
        if (!mapInstance) return;
        mapInstance.addSource('nearby', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        mapInstance.addLayer({
            id: 'nearby-connections',
            type: 'line',
            source: 'nearby',
            layout: {
                'line-cap': 'round',
                'line-join': 'round'
            },
            paint: {
                'line-color': '#00f2ff',
                'line-width': 1.5,
                'line-dasharray': [2, 2],
                'line-opacity': 0.6
            }
        });

        mapInstance.addLayer({
            id: 'nearby-points',
            type: 'circle',
            source: 'nearby',
            filter: ['==', '$type', 'Point'],
            paint: {
                'circle-radius': 4,
                'circle-color': '#00f2ff',
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff'
            }
        });
    };

    const setupClickHandlers = () => {
        mapInstance.on('mouseenter', 'vessels-point', () =>
            mapInstance.getCanvas().style.cursor = 'pointer');
        mapInstance.on('mouseleave', 'vessels-point', () =>
            mapInstance.getCanvas().style.cursor = '');

        mapInstance.on('click', (e) => {
            const availableLayers = ['vessels-point', 'ports-layer'].filter(l => mapInstance.getLayer(l));
            if (availableLayers.length === 0) return;

            const features = mapInstance.queryRenderedFeatures(e.point, { layers: availableLayers });
            if (features.length > 0) {
                const f = features[0];
                if (f.layer.id === 'vessels-point') {
                    state.setSelectedMmsi(f.properties.mmsi);
                    state.setSelectedPortId(null);
                    state.setShowRegistry(true);
                    state.setActiveTab('VESSELS');
                } else if (f.layer.id === 'ports-layer') {
                    state.setSelectedPortId(f.properties.id);
                    state.setSelectedMmsi(null);
                    state.setShowRegistry(true);
                    state.setActiveTab('PORTS');
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
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
            return;
        }

        if (mapInstance) return;

        // Create ResizeObserver to handle container size changes
        resizeObserver = new ResizeObserver(() => {
            if (mapInstance) mapInstance.resize();
        });
        resizeObserver.observe(el);

        // FIX: Production CSP blocks blob: workers. Use CDN CSP-compliant worker.
        if (window.maplibregl) {
            window.maplibregl.workerUrl = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl-csp-worker.js';
        }

        mapInstance = new window.maplibregl.Map({
            container: el,
            style: createBaseStyle(),
            center: [30, 20],
            zoom: 1.5,
            attributionControl: false,
            antialias: true,
            fadeDuration: 300,
            trackResize: true,
            dragPan: true,
            scrollZoom: true,
            boxZoom: true,
            dragRotate: true,
            keyboard: true,
            doubleClickZoom: true,
            touchZoomRotate: true
        });

        window.__mapInstance = mapInstance;

        mapInstance.on('load', () => {
            Object.entries(HARBOR_PALETTE).forEach(([key, color]) =>
                registerSquareIcon(`sq-${key}`, color));

            addRoutingLayers();
            addTankerMeshLayers();
            addVesselLayers();
            addPortLayers();
            addSelectionLayer();
            addNearbyLayers();
            addMeshLayers();
            addDisasterProximityLayers();

            // Mark as ready ONLY after all sources/layers are added
            setIsMapReady(true);

            // Perform initial sync immediately
            syncPortsOnMap();
            syncMap();

            setupClickHandlers();

            setTimeout(() => mapInstance?.resize(), 100);

            mapInstance.on('styleimagemissing', (e) => {
                const data = new Uint8Array(1 * 1 * 4);
                mapInstance.addImage(e.id, { width: 1, height: 1, data });
            });
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

        const features = vessels
            .filter(v => {
                const lat = Number(v.lat || v.latitude);
                const lon = Number(v.lon || v.longitude);
                // Filter out 0,0 which is often a sign of invalid data in AIS
                return !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
            })
            .map(v => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [Number(v.lon || v.longitude), Number(v.lat || v.latitude)] },
                properties: {
                    mmsi: v.mmsi,
                    name: v.name || 'UNKNOWN',
                    color: getVesselColor(v.type),
                    speed: v.speed || 0,
                    course: v.course || 0
                }
            }));

        if (features.length > 0 || vessels.length === 0) {
            mapInstance.getSource('vessels').setData({ type: 'FeatureCollection', features });
            if (vessels.length > 0) {
                console.log(`[MAP] Synced ${features.length}/${vessels.length} vessels to tactical layer`);
            }
        }

        const mmsi = state.selectedMmsi();
        isolatedMarkers.forEach(m => m.remove());
        isolatedMarkers = [];

        // Always sync basic sources to maintain context and use normal pin styles
        syncPortsOnMap();

        if (mmsi) {
            const ship = state.vesselRegistry.get(mmsi);
            const sLat = ship?.lat || ship?.latitude;
            const sLon = ship?.lon || ship?.longitude;

            if (ship && typeof sLat === 'number' && typeof sLon === 'number') {
                const shipColor = getVesselColor(ship.type);
                const shipHtml = `
          <div class="flex flex-col items-center gap-1">
            <div style="background-color: ${shipColor}; box-shadow: 0 0 20px ${shipColor}" class="w-4 h-4 rounded-full border-2 border-white animate-pulse"></div>
            <div style="border-color: ${shipColor}" class="px-2 py-0.5 bg-black/90 border text-[9px] font-black text-white whitespace-nowrap">SHIP: ${ship.name}</div>
          </div>`;
                isolatedMarkers.push(createIsolatedMarker(shipHtml, [sLon, sLat]));

                const destName = (ship.destination || '').toUpperCase().trim();
                const port = state.ports().find(p => 
                    (p.name || '').toUpperCase().trim() === destName || 
                    destName.includes((p.name || '').toUpperCase().trim()) && (p.name || '').length > 3
                );
                
                if (port) {
                    const portHtml = `
            <div class="flex flex-col items-center gap-1">
              <div class="bg-cyan-700 p-2 rounded-full border-2 border-white shadow-[0_0_25px_#00f2ff]">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15l-4-4 4-4M17 15l4-4-4-4" />
                </svg>
              </div>
              <div class="px-2 py-0.5 bg-black/90 border border-cyan-400 text-[9px] font-black text-cyan-400 whitespace-nowrap">DESTINATION: ${port.name}</div>
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
        } else if (state.selectedPortId()) {
            const port = state.activePort();
            if (port && port.longitude != null && port.latitude != null) {
                const portHtml = `
          <div class="flex flex-col items-center gap-1">
            <div class="bg-blue-600 p-2.5 rounded-full border-2 border-white shadow-[0_0_30px_#3b82f6] animate-bounce">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div class="px-2 py-0.5 bg-black/90 border border-blue-400 text-[10px] font-black text-blue-400 whitespace-nowrap uppercase tracking-widest">SELECTED PORT: ${port.name}</div>
          </div>`;
                isolatedMarkers.push(createIsolatedMarker(portHtml, [port.longitude, port.latitude]));
            }
        } else {
            syncRefineryMarkers();
        }
        syncRouting(vessels, mmsi);
    };

    const syncRefineryMarkers = () => {
        refineryMarkers.forEach(m => m.remove());
        refineryMarkers = [];

        // Placeholder for future refinery marker implementation if needed
        const refineries = [];
        if (refineries.length === 0) return;

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

    const syncRouting = (vessels, mmsi) => {
        const ship = state.activeShip();
        let portFeatures = [];
        let refineryFeatures = [];
        clearGroup(routeLabels);

        const drawShipFlow = (targetShip, opacity = 1.0) => {
            const port = state.ports().find(p => p.name === targetShip.destination_port);
            const shipPos = [targetShip.lon || targetShip.longitude, targetShip.lat || targetShip.latitude];

            if (port) {
                const portPos = [port.longitude, port.latitude];
                const label = getRouteLabel(targetShip.distance_port_km, targetShip.speed);
                portFeatures.push({
                    type: 'Feature',
                    properties: { opacity, label },
                    geometry: { type: 'LineString', coordinates: [shipPos, portPos] }
                });
                
                if (opacity === 1.0) {
                    addLabel([(shipPos[0] + portPos[0]) / 2, (shipPos[1] + portPos[1]) / 2], label, '#00f2ff');
                }
            }

            const refinery = targetShip.closest_refinery;
            if (refinery) {
                const refPos = [refinery.lon || refinery.longitude, refinery.lat || refinery.latitude];
                const label = getRouteLabel(refinery.distance_km, targetShip.speed);
                refineryFeatures.push({
                    type: 'Feature',
                    properties: { opacity, label },
                    geometry: { type: 'LineString', coordinates: [shipPos, refPos] }
                });

                if (opacity === 1.0) {
                    addLabel([(shipPos[0] + refPos[0]) / 2, (shipPos[1] + refPos[1]) / 2], label, '#ff9d00');
                }
            }
        };

        if (ship) drawShipFlow(ship, 1.0);

        if (state.showAllFlows()) {
            const others = vessels.filter(v => v.mmsi !== mmsi);
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

    const syncNearbyInfrastructure = () => {
        if (!mapInstance || !mapInstance.getSource('nearby')) return;

        const ship = state.activeShip();
        const data = state.nearbyInfrastructure();
        
        if (!ship || !data || data.length === 0) {
            mapInstance.getSource('nearby').setData({ type: 'FeatureCollection', features: [] });
            return;
        }

        const features = [];
        const shipCoord = [ship.lon || ship.longitude, ship.lat || ship.latitude];

        data.forEach(infra => {
            const infraCoord = [infra.lon || infra.longitude, infra.lat || infra.latitude];
            if (infraCoord[0] == null || infraCoord[1] == null) return;

            // Point feature for infrastructure
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: infraCoord },
                properties: { name: infra.name, type: infra.infra_type }
            });

            // Connection line from ship to infrastructure
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [shipCoord, infraCoord]
                },
                properties: { type: 'connection' }
            });
        });

        mapInstance.getSource('nearby').setData({ type: 'FeatureCollection', features });
    };

    const syncSelection = () => {
        const target = state.activeShip();
        const port = state.activePort();
        if (!mapInstance?.getSource('selection')) return;

        const features = [];
        if (target && target.lon != null && target.lat != null) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [target.lon, target.lat] },
                properties: { mmsi: target.mmsi, type: 'ship' }
            });
        }
        if (port && port.longitude != null && port.latitude != null) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [port.longitude, port.latitude] },
                properties: { id: port.id, type: 'port' }
            });
        }

        mapInstance.getSource('selection').setData({ type: 'FeatureCollection', features });
    };

    const jumpTo = (center, zoom) => {
        mapInstance?.jumpTo({ center, zoom });
    };

    const flyTo = (center, zoom) => {
        mapInstance?.flyTo({ center, zoom, duration: 2000 });
    };

    const zoomIn = () => {
        mapInstance?.zoomIn({ duration: 300 });
    };

    const zoomOut = () => {
        mapInstance?.zoomOut({ duration: 300 });
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
        createEffect(() => { isMapReady(); state.ports(); state.portFilter(); syncPortsOnMap(); });
        createEffect(() => { isMapReady(); state.nearbyInfrastructure(); syncNearbyInfrastructure(); });
        createEffect(() => { isMapReady(); state.isMeshActive(); syncMeshNetwork(); });
        createEffect(() => { isMapReady(); state.disasterAlerts(); syncDisasterMarkers(); });
        createEffect(() => { isMapReady(); state.activeHazard(); state.nearestPortToHazard(); syncDisasterProximity(); });

        // Trigger resize when switching modes or toggling registry to ensure map fills container
        createEffect(() => {
            const mode = state.operatingMode();
            const showRegistry = state.showRegistry();
            if (isMapReady() && mode === 'MAP') {
                setTimeout(() => mapInstance?.resize(), 100);
            }
        });

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
                // Add below tactical layers but above base satellite
                const tacticalLayer = mapInstance.getStyle().layers.find(l =>
                    l.id.includes('vessels') || l.id.includes('ports') || l.id.includes('route')
                );

                mapInstance.addLayer({
                    id: 'osm',
                    type: 'raster',
                    source: 'osm'
                }, tacticalLayer?.id);

                ensureTacticalOnTop();
                // Re-sync data to ensure it appears on new style
                syncMap();
                syncPortsOnMap();
                syncDisasterMarkers();
            } catch (e) {
                console.warn("Style update skipped:", e);
            }
        });
    };

    const ensureTacticalOnTop = () => {
        if (!mapInstance) return;
        const tacticalLayers = [
            'mesh-lines', 'layer-route-port', 'layer-route-refinery', 
            'layer-hazard-proximity', 'ports-layer', 'vessels-point', 
            'selection-halo', 'nearby-connections', 'nearby-points',
            'layer-tanker-mesh-dots'
        ];
        tacticalLayers.forEach(id => {
            if (mapInstance.getLayer(id)) mapInstance.moveLayer(id);
        });
    };

    const handleResize = () => mapInstance?.resize();

    onMount(() => {
        window.addEventListener('resize', handleResize);
        setupReactiveEffects();
    });

    onCleanup(() => {
        window.removeEventListener('resize', handleResize);
        if (mapInstance) {
            isolatedMarkers.forEach(m => m.remove());
            refineryMarkers.forEach(m => m.remove());
            disasterMarkers.forEach(m => m.remove());
            clearGroup(routeLabels);
            clearGroup(meshLabels);
            clearGroup(hazardLabels);
            mapInstance.remove();
        }
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
        zoomIn,
        zoomOut,
        clearVessels,
        hardReset,
        getMap: () => mapInstance
    };
}