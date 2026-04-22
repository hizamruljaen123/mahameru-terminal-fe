
import { createSignal, onMount, onCleanup, For, Show, createEffect, createMemo } from 'solid-js';
import { SolarEngine } from '../utils/SolarEngine';

export default function TimezoneMonitorView() {
    const [data, setData] = createSignal([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [selectedCountry, setSelectedCountry] = createSignal(null);
    const [currentTime, setCurrentTime] = createSignal(new Date());
    const [mapStyle, setMapStyle] = createSignal('light');
    const [showMeridians, setShowMeridians] = createSignal(true);
    const [showSolar, setShowSolar] = createSignal(true);
    const [showShading, setShowShading] = createSignal(true);
    const [showBeam, setShowBeam] = createSignal(true);

    let mapContainer = null;
    let mapInstance = null;
    let layerGroup = null;
    let tileLayer = null;
    let terminatorLayer = null;
    let twilightLayer = null;
    let goldenLayer = null;
    let sunMarker = null;
    let moonMarker = null;

    // ==========================================
    // OPTIMIZED MEMOS (Menghindari kalkulasi berulang di JSX)
    // ==========================================

    const selectedComputed = createMemo(() => {
        const c = selectedCountry();
        if (!c) return null;
        const now = currentTime();
        return {
            phase: SolarEngine.getDayPhase(c.lat, c.lon, now),
            altitude: SolarEngine.getSolarAltitude(c.lat, c.lon, now),
            events: SolarEngine.getSolarEvents(c.lat, c.lon, now),
            status: SolarEngine.getTemporalStatus(c.code, c.timezones[0]?.time)
        };
    });

    const filteredData = createMemo(() => {
        const q = searchQuery().toLowerCase();
        const now = currentTime();
        const rawData = data();

        const processItem = (c) => ({
            ...c,
            _phase: SolarEngine.getDayPhase(c.lat, c.lon, now),
            _status: SolarEngine.getTemporalStatus(c.code, c.timezones[0]?.time)
        });

        if (!q) return rawData.map(processItem);

        return rawData
            .filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
            .map(processItem);
    });

    // ==========================================
    // MAP LOGIC
    // ==========================================

    createEffect(() => {
        const currentData = data();
        if (currentData.length > 0 && layerGroup) {
            updateMarkers(currentData);
        }
    });

    const fetchData = async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_GEO_DATA_API}/api/geo/timezone-map`);
            const res = await resp.json();
            if (res.status === 'success') {
                const sorted = res.data.sort((a, b) => a.name.localeCompare(b.name));
                setData(sorted);
                updateMarkers(sorted);
            }
        } catch (e) {
            console.error("Failed to fetch timezone map:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const updateTiles = () => {
        if (!mapInstance) return;
        if (tileLayer) mapInstance.removeLayer(tileLayer);

        let url;
        switch (mapStyle()) {
            case 'light': url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'; break;
            case 'satellite': url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'; break;
            default: url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
        }

        tileLayer = window.L.tileLayer(url, {
            maxZoom: 19,
            attribution: 'Map data &copy; OpenStreetMap'
        }).addTo(mapInstance);
    };

    const initMap = () => {
        if (mapInstance || !mapContainer) return;
        if (!window.L) {
            setTimeout(initMap, 500);
            return;
        }
        try {
            mapInstance = window.L.map(mapContainer, {
                zoomControl: false,
                attributionControl: false
            }).setView([20, 0], 2);

            updateTiles();
            layerGroup = window.L.layerGroup().addTo(mapInstance);

            setTimeout(() => {
                if (mapInstance) {
                    mapInstance.invalidateSize();
                    mapInstance.setView([20, 0], 2);
                }
            }, 800);

            fetchData();
            updateSolarData();
        } catch (err) {
            console.error("Leaflet init error:", err);
        }
    };

    const updateSolarData = () => {
        if (!mapInstance) return;
        const now = new Date();
        const style = mapStyle();

        // Day/Night Colors
        const nightColor = style === 'light' ? '#0f172a' : (style === 'satellite' ? '#000000' : '#050b1a');
        const twilightColor = style === 'light' ? '#334155' : (style === 'satellite' ? '#1e293b' : '#312e81');
        const nightOpacity = style === 'light' ? 0.4 : (style === 'satellite' ? 0.55 : 0.4);
        const twilightOpacity = style === 'satellite' ? 0.35 : 0.2;
        const goldenOpacity = style === 'satellite' ? 0.25 : 0.1;

        // 1. Terminator Layers
        if (showShading()) {
            // Keep the core night layer disabled as requested, but restore twilight for context
            if (terminatorLayer) { mapInstance.removeLayer(terminatorLayer); terminatorLayer = null; }

            const twilightPath = SolarEngine.getTerminatorPolygon(now, -6);
            if (twilightLayer) {
                twilightLayer.setLatLngs(twilightPath).setStyle({ fillColor: twilightColor, fillOpacity: twilightOpacity });
            } else {
                twilightLayer = window.L.polygon(twilightPath, { color: '#000', fillColor: twilightColor, fillOpacity: twilightOpacity, weight: 0, interactive: false }).addTo(mapInstance);
            }

            const goldenPath = SolarEngine.getTerminatorPolygon(now, 0);
            const goldenColor = style === 'light' ? '#f59e0b' : '#fb923c';
            if (goldenLayer) {
                goldenLayer.setLatLngs(goldenPath).setStyle({ color: goldenColor, fillColor: goldenColor, fillOpacity: goldenOpacity });
            } else {
                goldenLayer = window.L.polygon(goldenPath, { 
                    color: goldenColor, 
                    fillColor: goldenColor, 
                    fillOpacity: goldenOpacity, 
                    weight: 2, 
                    dashArray: '5,5', 
                    interactive: false 
                }).addTo(mapInstance);
            }
        } else {
            if (terminatorLayer) { mapInstance.removeLayer(terminatorLayer); terminatorLayer = null; }
            if (twilightLayer) { mapInstance.removeLayer(twilightLayer); twilightLayer = null; }
            if (goldenLayer) { mapInstance.removeLayer(goldenLayer); goldenLayer = null; }
        }

        // 2. Solar/Lunar Position
        if (showSolar()) {
            const sunPoint = SolarEngine.getSubsolarPoint(now);
            if (sunMarker) {
                sunMarker.setLatLng([sunPoint.lat, sunPoint.lon]);
            } else {
                const sunIcon = window.L.divIcon({
                    html: `<div style="width: 24px; height: 24px; background: radial-gradient(circle, #fff 0%, #ffcc00 40%, rgba(255,204,0,0) 70%); border-radius: 50%; box-shadow: 0 0 15px rgba(255,204,0,0.8); animation: pulse 2s infinite;"></div>`,
                    className: 'sun-marker',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                sunMarker = window.L.marker([sunPoint.lat, sunPoint.lon], { icon: sunIcon, zIndexOffset: 2000 }).addTo(mapInstance);
            }

            const moonPoint = SolarEngine.getSublunarPoint(now);
            if (moonMarker) {
                moonMarker.setLatLng([moonPoint.lat, moonPoint.lon]);
            } else {
                const moonIcon = window.L.divIcon({
                    html: `<div style="width: 18px; height: 18px; background: radial-gradient(circle, #fff 0%, #a0a0a0 50%, transparent 100%); border-radius: 50%; box-shadow: 0 0 10px rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: center;">
                                <div style="width: 70%; height: 70%; background: #333; border-radius: 50%; margin-left: 30%; margin-top: -30%; opacity: 0.6;"></div>
                            </div>`,
                    className: 'moon-marker',
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                });
                moonMarker = window.L.marker([moonPoint.lat, moonPoint.lon], { icon: moonIcon, zIndexOffset: 1900 }).addTo(mapInstance);
            }
        } else {
            if (sunMarker) { mapInstance.removeLayer(sunMarker); sunMarker = null; }
            if (moonMarker) { mapInstance.removeLayer(moonMarker); moonMarker = null; }
        }

        // 3. Solar Beam
        const selected = selectedCountry();
        if (showBeam() && selected && sunMarker) {
            const sunPos = sunMarker.getLatLng();
            let destLng = sunPos.lng;
            if (Math.abs(destLng - selected.lon) > 180) {
                destLng += (destLng > selected.lon ? -360 : 360);
            }
            if (window.solarBeam) mapInstance.removeLayer(window.solarBeam);
            window.solarBeam = window.L.polyline([[selected.lat, selected.lon], [sunPos.lat, destLng]], {
                color: '#fb923c',
                weight: 1.5,
                dashArray: '5, 10',
                opacity: 0.6,
                className: 'solar-beam-anim'
            }).addTo(mapInstance);
        } else if (window.solarBeam) {
            mapInstance.removeLayer(window.solarBeam);
            window.solarBeam = null;
        }
    };

    const updateMarkers = (countries) => {
        if (!layerGroup) return;
        layerGroup.clearLayers();

        const selected = selectedCountry();

        if (showMeridians()) {
            for (let i = -12; i <= 12; i++) {
                const lon = i * 15;
                const color = getOffsetColor(i);
                window.L.polyline([[-85, lon], [85, lon]], {
                    color: color,
                    weight: selected ? 1 : 2,
                    opacity: selected ? 0.2 : 0.6,
                    dashArray: '8, 8'
                }).addTo(layerGroup);

                if (!selected) {
                    const labelStr = i >= 0 ? `GMT+${i}` : `GMT${i}`;
                    const tagIcon = window.L.divIcon({
                        html: `<div style="color: ${color}; font-size: 7px; font-weight: 900; background: #000; border: 1px solid ${color}; padding: 1px 4px; box-shadow: 0 0 5px ${color}; white-space: nowrap;">${labelStr}</div>`,
                        className: 'gmt-tag',
                        iconSize: [40, 12],
                        iconAnchor: [20, 6]
                    });
                    window.L.marker([82, lon], { icon: tagIcon }).addTo(layerGroup);
                    window.L.marker([-82, lon], { icon: tagIcon }).addTo(layerGroup);
                }
            }
        }

        countries.forEach(c => {
            const primaryTz = c.timezones[0];
            const offset = primaryTz ? parseInt(primaryTz.offset) / 100 : 0;
            const accentColor = getOffsetColor(offset);
            const isSelected = selected && selected.code === c.code;
            const localTime = primaryTz?.time.split(':').slice(0, 2).join(':');

            const icon = window.L.divIcon({
                html: isSelected ?
                    `<div class="relative">
                        <div style="width: 32px; height: 32px; background: ${accentColor}; border: 3px solid #000; border-radius: 50%; box-shadow: 0 0 30px ${accentColor}, 0 0 0 2px white; animation: pulse 1.5s infinite; display: flex; align-items: center; justify-content: center;">
                            <span style="color: white; font-size: 11px; font-weight: 900; text-shadow: 1px 1px 2px black;">${localTime}</span>
                        </div>
                        <div class="absolute -top-10 left-1/2 -translate-x-1/2 bg-black border border-white/20 px-2 py-1 text-[8px] font-black text-white whitespace-nowrap z-50">FOCUS_NODE: ${c.name}</div>
                    </div>` :
                    `<div class="relative group">
                        <div style="width: 8px; height: 8px; background: ${accentColor}; border: 1px solid rgba(0,0,0,0.2); border-radius: 50%; opacity: ${selected ? '0.2' : '0.6'}; transition: all 0.3s; scale: ${selected ? '0.7' : '1'};"></div>
                        <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-black px-1.5 py-0.5 text-[7px] font-black text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-white/10">
                            ${localTime}
                        </div>
                    </div>`,
                className: 'tz-marker',
                iconSize: isSelected ? [32, 32] : [8, 8],
                iconAnchor: isSelected ? [16, 16] : [4, 4]
            });

            const m = window.L.marker([c.lat, c.lon], {
                icon,
                zIndexOffset: isSelected ? 1000 : 0
            }).addTo(layerGroup);

            m.on('click', () => {
                setSelectedCountry(c);
                if (mapInstance) mapInstance.flyTo([c.lat, c.lon], 12);
            });
        });
    };

    const getOffsetColor = (offset) => {
        if (offset > 0) return `hsl(${60 - (offset * 5)}, 80%, 50%)`;
        if (offset < 0) return `hsl(${180 + (Math.abs(offset) * 5)}, 80%, 50%)`;
        return '#00ff88';
    };

    // ==========================================
    // LIFECYCLE
    // ==========================================

    onMount(() => {
        initMap();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        const markerTimer = setInterval(() => {
            const currentData = data();
            if (currentData.length > 0) updateMarkers(currentData);
            updateSolarData();
        }, 60000);

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setSelectedCountry(null);
                if (mapInstance) mapInstance.flyTo([20, 0], 2);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        onCleanup(() => {
            window.removeEventListener('keydown', handleKeyDown);
            clearInterval(timer);
            clearInterval(markerTimer);
            if (mapInstance) mapInstance.remove();
        });
    });

    // ==========================================
    // RENDER
    // ==========================================

    return (
        <div class="h-full flex flex-col bg-black text-white overflow-hidden" style={{ "font-family": "'Roboto', sans-serif;" }}>
            <style>
                {`
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400;500;700;900&display=swap');
                    @keyframes beamFlow {
                        from { stroke-dashoffset: 100; }
                        to { stroke-dashoffset: 0; }
                    }
                    .solar-beam-anim { animation: beamFlow 3s linear infinite; }
                `}
            </style>

            {/* TOP HUD */}
            <div class="h-14 flex items-center justify-between px-8 border-b border-white/5 bg-black/60 z-20">
                <div class="flex items-center gap-4">
                    <div class="w-1.5 h-1.5 bg-text_accent animate-ping rounded-full"></div>
                    <div class="flex flex-col">
                        <span class="text-[10px] text-text_accent font-black tracking-[0.4em] uppercase leading-none">GLOBAL TIME MONITORING</span>
                        <span class="text-[7px] text-white/30 uppercase tracking-widest mt-1">SATELLITE SYNC: ACTIVE</span>
                    </div>
                </div>

                <div class="flex items-center gap-10">
                    <div class="flex flex-col items-end">
                        <span class="text-[7px] text-white/20 uppercase tracking-[0.3em] font-black">SYSTEM UTC</span>
                        <span class="text-[14px] text-text_accent font-black tracking-widest">{currentTime().toISOString().split('T')[1].split('.')[0]}</span>
                    </div>
                    <input
                        type="text"
                        placeholder="SEARCH BY REGION..."
                        class="bg-white/5 border border-white/10 px-4 py-1.5 text-[9px] outline-none focus:border-text_accent/50 w-64 uppercase tracking-[0.3em]"
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div class="flex-1 flex overflow-hidden">
                {/* MAP AREA */}
                <div class="flex-1 relative bg-zinc-950">
                    <div
                        id="tz-map-container"
                        ref={mapContainer}
                        class="absolute inset-0 z-0"
                        style={{ width: "100%", height: "100%", border: "1px solid rgba(255,255,255,0.05)" }}
                    ></div>

                    <div class="absolute inset-0 pointer-events-none border border-white/[0.03] grid grid-cols-8 grid-rows-8 opacity-20 z-10">
                        {Array.from({ length: 64 }).map(() => <div class="border border-white/[0.01]"></div>)}
                    </div>

                    {/* MAP CONTROLS HUD */}
                    <div class="absolute bottom-8 left-8 z-[1000] flex items-center gap-1.5 p-1 bg-black/80 border border-white/10 backdrop-blur-xl rounded-sm">
                        <button onClick={() => { setShowMeridians(!showMeridians()); fetchData(); }} class={`w-10 h-10 border flex items-center justify-center transition-all ${showMeridians() ? 'bg-text_accent/20 border-text_accent text-text_accent' : 'border-transparent text-white/40 hover:text-white'}`} title="GMT_GRID">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                        </button>
                        <button onClick={() => { setShowSolar(!showSolar()); updateSolarData(); }} class={`w-10 h-10 border flex items-center justify-center transition-all ${showSolar() ? 'bg-text_accent/20 border-text_accent text-text_accent' : 'border-transparent text-white/40 hover:text-white'}`} title="SOLAR_UNITS">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
                        </button>
                        <button onClick={() => { setShowShading(!showShading()); updateSolarData(); }} class={`w-10 h-10 border flex items-center justify-center transition-all ${showShading() ? 'bg-text_accent/20 border-text_accent text-text_accent' : 'border-transparent text-white/40 hover:text-white'}`} title="DAY_NIGHT_SHADING">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21a9 9 0 1 1 0-18c-4.97 0-9 4.03-9 9s4.03 9 9 9z" /><path d="M12 3v18" /></svg>
                        </button>
                        <button onClick={() => { setShowBeam(!showBeam()); updateSolarData(); }} class={`w-10 h-10 border flex items-center justify-center transition-all ${showBeam() ? 'bg-text_accent/20 border-text_accent text-text_accent' : 'border-transparent text-white/40 hover:text-white'}`} title="VECTOR_BEAM">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                        </button>

                        <div class="w-px h-6 bg-white/10 mx-1"></div>

                        <button onClick={() => { setMapStyle('dark'); updateTiles(); updateSolarData(); }} class={`w-10 h-10 border flex items-center justify-center transition-all ${mapStyle() === 'dark' ? 'bg-text_accent/20 border-text_accent text-text_accent' : 'border-transparent text-white/40 hover:text-white'}`} title="DARK_STYLE">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                        </button>
                        <button onClick={() => { setMapStyle('light'); updateTiles(); updateSolarData(); }} class={`w-10 h-10 border flex items-center justify-center transition-all ${mapStyle() === 'light' ? 'bg-text_accent/20 border-text_accent text-text_accent' : 'border-transparent text-white/40 hover:text-white'}`} title="LIGHT_STYLE">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
                        <button onClick={() => { setMapStyle('satellite'); updateTiles(); updateSolarData(); }} class={`w-10 h-10 border flex items-center justify-center transition-all ${mapStyle() === 'satellite' ? 'bg-text_accent/20 border-text_accent text-text_accent' : 'border-transparent text-white/40 hover:text-white'}`} title="SATELLITE_STYLE">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                        </button>
                    </div>

                    {/* LEGEND HUD */}
                    <div class="absolute bottom-8 right-8 z-20 bg-black/60 border border-white/10 p-3 backdrop-blur-md flex flex-col gap-2 min-w-[120px]">
                        <div class="text-[7px] font-black text-white/30 tracking-[0.2em] uppercase mb-1 border-b border-white/5 pb-1">LEGEND</div>
                        <div class="flex items-center gap-2">
                            <div class="w-2.5 h-2.5 bg-white border border-black/10"></div>
                            <span class="text-[8px] font-black text-white/60 tracking-wider">SIANG / DAY</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-2.5 h-2.5 bg-[#f59e0b22] border border-[#f59e0b] border-dashed"></div>
                            <span class="text-[8px] font-black text-[#f59e0b] tracking-wider uppercase">Fajar/Senja</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-2.5 h-2.5 bg-[#312e8166]"></div>
                            <span class="text-[8px] font-black text-[#818cf8] tracking-wider uppercase">Remang / Twilight</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-2.5 h-2.5 bg-[#050b1a] border border-white/10"></div>
                            <span class="text-[8px] font-black text-white/40 tracking-wider uppercase">Malam / Night</span>
                        </div>
                    </div>
                </div>

                {/* SIDEBAR */}
                <div class="w-96 border-l border-white/10 bg-[#050505] flex flex-col overflow-hidden relative z-30">
                    <Show when={selectedComputed()}>
                        {(computed) => (
                            <div class="p-6 border-b border-white/10 bg-white/[0.03] shrink-0 overflow-y-auto win-scroll" style={{ "max-height": "65vh" }}>
                                <div class="flex justify-between items-start mb-4">
                                    <div class="flex flex-col">
                                        <span class="text-[8px] text-text_accent font-black uppercase tracking-[0.2em]">SELECTED REGION</span>
                                        <span class="text-[18px] font-black text-white uppercase tracking-tight leading-none mt-1">{selectedCountry().name}</span>
                                    </div>
                                    <button onClick={() => { setSelectedCountry(null); if (mapInstance) mapInstance.flyTo([20, 0], 2); }} class="text-[8px] bg-white/5 px-2 py-1 hover:bg-white/10 border border-white/10">ESC</button>
                                </div>

                                {/* SOLAR PERIOD CARD */}
                                <div class="px-5 py-3 bg-white/[0.03] border-l-4 flex justify-between items-center shadow-lg mb-3" style={{ "border-left-color": computed().phase.color }}>
                                    <div class="flex flex-col">
                                        <span class="text-[8px] text-white/30 uppercase font-black tracking-widest">DAY PHASE</span>
                                        <div class="flex items-center gap-3">
                                            <span class="text-[14px] font-black" style={{ color: computed().phase.color }}>{computed().phase.id}</span>
                                            <span class="text-[18px]">{computed().phase.icon}</span>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <span class="text-[8px] text-white/30 uppercase font-black">SOLAR POSITION</span>
                                        <div class="text-[12px] text-white/80 font-roboto font-bold italic">{computed().altitude.toFixed(1)}°</div>
                                    </div>
                                </div>

                                {/* SOLAR SPATIAL ANALYSIS */}
                                <div class="p-4 bg-white/[0.03] border border-white/10 flex flex-col gap-3 rounded-sm mb-3">
                                    <div class="flex justify-between items-center border-b border-white/5 pb-2">
                                        <span class="text-[8px] text-white/30 uppercase font-black">DISTANCE TO SUN</span>
                                        <span class="text-[12px] font-black text-text_accent">{Math.round(computed().events.distanceToSun).toLocaleString()} KM</span>
                                    </div>

                                    <div class="grid grid-cols-3 gap-2">
                                        <For each={computed().events.events}>
                                            {(event) => {
                                                const phase = event.id === 'PAGI' ? '🌅' : (event.id === 'SIANG' ? '☀️' : (event.id === 'SORE' ? '🌇' : '❄️'));
                                                return (
                                                    <div class="flex flex-col gap-1 items-center p-2 bg-black/40 border border-white/5">
                                                        <span class="text-[7px] text-white/20 font-black uppercase text-center">{event.label}</span>
                                                        <span class="text-[14px] mt-1">{phase}</span>
                                                        <span class="text-[9px] font-black text-white/60 font-roboto">
                                                            {event.isPolar ? '--' : `${event.h}h ${event.m}m`}
                                                        </span>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                    </div>
                                </div>

                                {/* WORK & MARKET STATUS */}
                                <div class="grid grid-cols-2 gap-3 mb-4">
                                    <div class="p-4 bg-white/[0.02] border border-white/10 flex flex-col gap-1.5 rounded-sm">
                                        <span class="text-[8px] text-white/30 uppercase font-black">WORKING HOURS</span>
                                        <div class="flex items-center gap-2">
                                            <div class="w-2 h-2 rounded-full animate-pulse" style={{ background: computed().status.color }}></div>
                                            <span class="text-[11px] font-black tracking-widest uppercase" style={{ color: computed().status.color }}>
                                                {computed().status.status}
                                            </span>
                                        </div>
                                    </div>

                                    <Show when={computed().status.market}>
                                        {(market) => (
                                            <div class="p-4 bg-white/[0.02] border border-white/10 flex flex-col gap-1.5 rounded-sm">
                                                <span class="text-[8px] text-white/30 uppercase font-black">HUB: {market().name}</span>
                                                <div class="flex flex-col">
                                                    <span class="text-[11px] font-black tracking-tighter uppercase" style={{ color: market().color }}>
                                                        {market().isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
                                                    </span>
                                                    <span class="text-[8px] text-white/60 font-bold mt-1">{market().label}</span>
                                                </div>
                                            </div>
                                        )}
                                    </Show>
                                </div>

                                {/* TIMEZONE DETAILS */}
                                <div class="space-y-3">
                                    <For each={selectedCountry().timezones}>
                                        {(tz) => {
                                            const offsetNumeric = parseInt(tz.offset) / 100;
                                            const color = getOffsetColor(offsetNumeric);
                                            return (
                                                <div class="p-5 bg-black border-l-2 border-white/5 flex justify-between items-center hover:bg-white/[0.03] transition-all" style={{ "border-left-color": color }}>
                                                    <div class="flex flex-col gap-1">
                                                        <span class="text-[20px] font-black text-white tracking-widest font-roboto leading-none">{tz.time}</span>
                                                        <span class="text-[9px] text-white/30 font-black uppercase tracking-widest">{tz.abbr} | {tz.offset}</span>
                                                    </div>
                                                    <div class="flex flex-col items-end">
                                                        <div class="w-3 h-3 rounded-full animate-pulse mb-1" style={{ background: color }}></div>
                                                        <span class="text-[7px] text-white/20 font-black uppercase text-right">{tz.zone}</span>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </For>
                                </div>
                            </div>
                        )}
                    </Show>

                    <div class="p-4 border-b border-white/5 bg-black/40 flex items-center justify-between shrink-0">
                        <span class="text-[8px] font-black tracking-[0.3em] text-white/40 uppercase">LOCATIONS [{filteredData().length}]</span>
                        <span class="text-[7px] text-text_accent font-bold uppercase tracking-widest">REALTIME</span>
                    </div>

                    <div class="flex-1 overflow-y-auto win-scroll">
                        <div class="flex flex-col">
                            <For each={filteredData()}>
                                {(c) => {
                                    const offset = c.timezones[0] ? parseInt(c.timezones[0].offset) / 100 : 0;
                                    const color = getOffsetColor(offset);
                                    const isSelected = selectedCountry()?.code === c.code;
                                    // Menggunakan data yang sudah di-memoize (_phase dan _status)
                                    return (
                                        <button
                                            onClick={() => {
                                                setSelectedCountry(c);
                                                if (mapInstance) mapInstance.flyTo([c.lat, c.lon], 12);
                                            }}
                                            class={`w-full px-5 py-3 flex items-center justify-between border-b border-white/[0.02] transition-all ${isSelected ? 'bg-text_accent/10' : 'hover:bg-white/[0.03]'}`}
                                        >
                                            <div class="flex items-center gap-4">
                                                <div class="w-1.5 h-4" style={{ background: color }}></div>
                                                <div class="flex flex-col">
                                                    <span class={`text-[12px] font-black uppercase tracking-tight ${isSelected ? 'text-text_accent' : 'text-white/80'}`}>{c.name}</span>
                                                    <div class="flex items-center gap-2 mt-0.5">
                                                        <div class="w-2 h-2 rounded-full" style={{ background: c._status.color }}></div>
                                                        <span class="text-[7px] text-white/40 font-black uppercase tracking-widest">{c._status.status}</span>
                                                        <Show when={c._status.market}>
                                                            <span class="text-[7px] font-black px-1.5 py-0.5 border border-white/10 bg-white/5" style={{ color: c._status.market.color }}>
                                                                {c._status.market.name}
                                                            </span>
                                                        </Show>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-5">
                                                <div class="flex flex-col items-end">
                                                    <span class="text-[14px] font-black text-white font-roboto leading-none">{c.timezones[0]?.time.split(':').slice(0, 2).join(':')}</span>
                                                    <span class="text-[8px] font-black uppercase mt-1 tracking-widest" style={{ color: c._phase.color }}>
                                                        {c._phase.id}
                                                    </span>
                                                </div>
                                                <span class="text-[8px] text-white/30 font-black uppercase w-10 text-right">{c.timezones[0]?.abbr}</span>
                                            </div>
                                        </button>
                                    );
                                }}
                            </For>
                        </div>
                    </div>

                    <div class="p-4 bg-black border-t border-white/10 text-center shrink-0">
                        <span class="text-[8px] text-white/20 font-black tracking-[0.5em] uppercase">SYSTEM ACTIVE</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
