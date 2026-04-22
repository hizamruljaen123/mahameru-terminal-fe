import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';

export default function ConflictIndexView() {
    const [events, setEvents] = createSignal([]);
    const [loading, setLoading] = createSignal(true);
    const [stats, setStats] = createSignal({ total: 0, avgSeverity: 0, countries: 0 });
    const [selectedEvent, setSelectedEvent] = createSignal(null);
    const [filterType, setFilterType] = createSignal('All');
    const [searchTerm, setSearchTerm] = createSignal('');
    const [viewPerspective, setViewPerspective] = createSignal('top'); // top, tilt
    const [mapMode, setMapMode] = createSignal('dark'); // dark, satellite, terrain
    const [news, setNews] = createSignal([]);
    const [isFetchingNews, setIsFetchingNews] = createSignal(false);

    let mapInstance = null;
    let markers = [];
    let crosshairMarker = null;

    const fetchConflictData = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_CONFLICT_API}/api/conflict/summary`);
            const data = await resp.json();
            if (Array.isArray(data)) {
                setEvents(data);
                calculateStats(data);
                renderMarkers(data);
            }
        } catch (err) {
            console.error("Conflict API Error:", err);
        }
        setLoading(false);
    };

    const fetchNews = async (event) => {
        setIsFetchingNews(true);
        setNews([]);
        try {
            const query = `${event.negara} ${event.detail_konflik} military security conflict`;
            const resp = await fetch(`${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(query)}`);
            const data = await resp.json();
            if (data.news) {
                setNews(data.news);
            }
        } catch (err) {
            console.error("News Fetch Error:", err);
        }
        setIsFetchingNews(false);
    };

    const calculateStats = (data) => {
        let totalSeverity = 0;
        const countrySet = new Set();
        data.forEach(e => {
            totalSeverity += parseInt(e.index_keparahan || 0);
            countrySet.add(e.negara);
        });
        setStats({
            total: data.length,
            avgSeverity: Math.round(totalSeverity / (data.length || 1)),
            countries: countrySet.size
        });
    };

    const getSeverityColor = (sev) => {
        if (sev >= 90) return '#ff4444';
        if (sev >= 80) return '#ffaa00';
        if (sev >= 70) return '#ffcc00';
        return '#00bbff';
    };

    const initMap = (el) => {
        if (!el || mapInstance) return;

        mapInstance = new window.maplibregl.Map({
            container: el,
            style: {
                version: 8,
                sources: {
                    'osm': {
                        type: 'raster',
                        tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '&copy; CartoDB'
                    }
                },
                layers: [{
                    id: 'osm',
                    type: 'raster',
                    source: 'osm'
                }]
            },
            center: [20, 10],
            zoom: 2,
            pitch: 0,
            bearing: 0,
            antialias: true
        });

        mapInstance.on('load', () => {
            fetchConflictData();
            mapInstance.resize();
            setTimeout(() => {
                if (mapInstance) mapInstance.resize();
            }, 500);
        });
    };

    const updateMapStyle = (mode) => {
        if (!mapInstance) return;
        let tiles = [];
        if (mode === 'dark') {
            tiles = ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'];
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
            mapInstance.addLayer({
                id: 'osm',
                type: 'raster',
                source: 'osm'
            });
            mapInstance.resize();
        } catch (e) {
            console.warn("Style update failed", e);
        }
    };

    createEffect(() => {
        updateMapStyle(mapMode());
    });

    const togglePerspective = () => {
        if (!mapInstance) return;
        const isTop = viewPerspective() === 'top';
        const newPersp = isTop ? 'tilt' : 'top';
        setViewPerspective(newPersp);

        const event = selectedEvent();
        const center = event ? [parseFloat(event.longitude), parseFloat(event.latitude)] : mapInstance.getCenter();

        if (newPersp === 'top') {
            mapInstance.flyTo({ center, pitch: 0, bearing: 0, duration: 1200 });
        } else {
            mapInstance.flyTo({ center, pitch: 65, bearing: 45, duration: 1200 });
        }
    };

    const renderMarkers = (data) => {
        if (!mapInstance) return;
        markers.forEach(m => m.remove());
        markers = [];

        const filtered = data.filter(e => {
            const matchFilter = filterType() === 'All' || e.negara === filterType();
            const matchSearch = e.negara.toLowerCase().includes(searchTerm().toLowerCase()) ||
                e.detail_konflik.toLowerCase().includes(searchTerm().toLowerCase());
            return matchFilter && matchSearch;
        });

        filtered.forEach(e => {
            const lat = parseFloat(e.latitude);
            const lon = parseFloat(e.longitude);
            if (isNaN(lat) || isNaN(lon)) return;

            const color = getSeverityColor(e.index_keparahan);
            const size = 6 + (e.index_keparahan / 10);

            const el = document.createElement('div');
            el.className = 'cursor-pointer group';
            el.innerHTML = `
                <div class="flex items-center justify-center" style="width: ${size * 2}px; height: ${size * 2}px">
                    <div class="absolute bg-red-600 animate-pulse opacity-20 rounded-full" style="width: ${size * 2}px; height: ${size * 2}px"></div>
                    <div class="relative rounded-full border border-white/40 shadow-[0_0_10px_rgba(255,0,0,0.5)] transition-transform duration-300 group-hover:scale-150" 
                         style="background-color: ${color}; width: ${size}px; height: ${size}px;">
                    </div>
                </div>
            `;

            const m = new window.maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([lon, lat])
                .addTo(mapInstance);

            el.addEventListener('click', () => {
                setSelectedEvent(e);
                mapInstance.flyTo({ center: [lon, lat], zoom: 6, pitch: 45, duration: 1500 });
            });
            markers.push(m);
        });
    };

    createEffect(() => {
        if (events().length > 0) renderMarkers(events());
    });


    createEffect(() => {
        const event = selectedEvent();
        if (event && mapInstance) {
            fetchNews(event);
            const lat = parseFloat(event.latitude);
            const lon = parseFloat(event.longitude);
            if (isNaN(lat) || isNaN(lon)) return;

            if (crosshairMarker) {
                crosshairMarker.setLngLat([lon, lat]);
            } else {
                const el = document.createElement('div');
                el.className = 'custom-crosshair pointer-events-none';
                el.innerHTML = `
                    <div class="flex items-center justify-center pointer-events-none">
                        <div class="absolute h-[1px] w-[300px] bg-red-600/30"></div>
                        <div class="absolute w-[1px] h-[300px] bg-red-600/30"></div>
                        <div class="absolute h-[1px] w-[40px] bg-red-600/80"></div>
                        <div class="absolute w-[1px] h-[40px] bg-red-600/80"></div>
                        <div class="w-10 h-10 border border-red-600/40 rounded-full animate-ping"></div>
                        <div class="w-2 h-2 bg-red-600 rounded-full shadow-[0_0_15px_rgba(255,0,0,1)]"></div>
                    </div>
                `;
                crosshairMarker = new window.maplibregl.Marker({ element: el, zIndexOffset: 2000, anchor: 'center' })
                    .setLngLat([lon, lat])
                    .addTo(mapInstance);
            }
        } else if (crosshairMarker) {
            crosshairMarker.remove();
            crosshairMarker = null;
        }
    });

    onCleanup(() => {
        if (mapInstance) {
            mapInstance.remove();
            mapInstance = null;
        }
    });

    const filteredEvents = () => events().filter(e => {
        const matchFilter = filterType() === 'All' || e.negara === filterType();
        const matchSearch = e.negara.toLowerCase().includes(searchTerm().toLowerCase()) ||
            e.detail_konflik.toLowerCase().includes(searchTerm().toLowerCase());
        return matchFilter && matchSearch;
    });

    return (
        <div class="h-full w-full flex overflow-hidden bg-black font-roboto select-none relative uppercase">
            {/* SCANLINE OVERLAY */}
            <div class="absolute inset-0 pointer-events-none z-[99] opacity-[0.02] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>

            <style>{`
                .win-scroll::-webkit-scrollbar { width: 3px; }
                .win-scroll::-webkit-scrollbar-thumb { background: #333; }
                .maplibregl-canvas-container { cursor: crosshair !important; }
            `}</style>

            {/* SIDEBAR */}
            <div class="w-[320px] flex flex-col shrink-0 bg-[#060606] border-r border-white/10 relative z-20">

                <div class="p-6 border-b border-white/5 bg-[#0a0a0a]">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            <div class="w-1 h-4 bg-red-600"></div>
                            <span class="text-[11px] font-black text-white tracking-[0.3em] uppercase">Conflict Index</span>
                        </div>
                        <span class="text-[8px] font-mono text-zinc-600 uppercase">Monitoring</span>
                    </div>

                    <div class="relative mb-4">
                        <input
                            type="text"
                            placeholder="Search conflicts..."
                            onInput={(e) => setSearchTerm(e.target.value)}
                            class="w-full bg-[#111] border border-white/10 rounded-sm px-3 py-1.5 text-[10px] font-mono text-zinc-400 focus:outline-none focus:border-red-600/50 uppercase"
                        />
                    </div>

                    <div class="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                        <button onClick={() => setFilterType('All')} class={`px-2 py-1 text-[8px] font-black uppercase border rounded-sm whitespace-nowrap ${filterType() === 'All' ? 'bg-red-600 border-red-500 text-white' : 'border-white/10 text-zinc-500'}`}>All Regions</button>
                        {Array.from(new Set(events().map(e => e.negara))).slice(0, 8).map(c => (
                            <button onClick={() => setFilterType(c)} class={`px-2 py-1 text-[8px] font-black uppercase border rounded-sm whitespace-nowrap ${filterType() === c ? 'bg-zinc-800 border-white/20 text-red-500' : 'border-white/10 text-zinc-600'}`}>{c}</button>
                        ))}
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto win-scroll p-3 space-y-2">
                    <Show when={!loading()} fallback={<div class="h-20 flex items-center justify-center"><div class="w-4 h-4 border-2 border-red-600 border-t-transparent animate-spin rounded-full"></div></div>}>
                        <For each={filteredEvents()} fallback={
                            <div class="p-8 text-center text-[9px] text-zinc-700 italic border border-white/5 bg-black/40">
                                NO_TACTICAL_DATA_LOADED_FOR_SECTOR
                            </div>
                        }>
                            {(e) => (
                                <div
                                    onClick={() => {
                                        setSelectedEvent(e);
                                        if (mapInstance) mapInstance.flyTo({ center: [e.longitude, e.latitude], zoom: 6, pitch: 45, duration: 1500 });
                                    }}
                                    class={`p-3 border border-white/[0.03] bg-[#080808] cursor-pointer group ${selectedEvent()?.id === e.id ? 'border-red-600/30 bg-[#1a0505]' : ''}`}
                                >
                                    <div class="flex justify-between items-start mb-1">
                                        <span class="text-[9px] font-black text-zinc-400 group-hover:text-red-500 uppercase">{e.country || e.negara}</span>
                                        <span class="text-[9px] font-mono text-zinc-700">Index: {e.index_keparahan}</span>
                                    </div>
                                    <h3 class="text-[10px] font-bold text-white uppercase group-hover:text-red-400 line-clamp-1">{e.detail_konflik}</h3>
                                </div>
                            )}
                        </For>
                    </Show>
                </div>

                <div class="p-4 bg-black border-t border-white/5 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span class="text-[8px] font-black text-zinc-600 uppercase tracking-widest italic">Live Feed Active</span>
                    </div>
                </div>
            </div>

            {/* MAP AREA */}
            <div class="flex-1 relative bg-black overflow-hidden z-10 flex flex-col">
                <div id="conflict-map" class="absolute inset-0 w-full h-full" ref={initMap}></div>

                {/* FLOATING HUD CONTROLS (HORIZONTAL BOTTOM) */}
                <div class="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-4">
                    <div class="bg-black/80 backdrop-blur-xl border border-white/10 p-1.5 flex items-center gap-2 shadow-2xl rounded-lg">
                        <div class="group relative">
                            <button onClick={togglePerspective} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${viewPerspective() === 'top' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <span class="text-xs">⏹️</span>
                            </button>
                            <div class="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50 uppercase tracking-widest">2D_TOP_VIEW</div>
                        </div>
                        <div class="group relative">
                            <button onClick={togglePerspective} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${viewPerspective() === 'tilt' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <span class="text-xs">📐</span>
                            </button>
                            <div class="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50 uppercase tracking-widest">3D_TILT_SCAN</div>
                        </div>
                    </div>

                    <div class="bg-black/80 backdrop-blur-xl border border-white/10 p-1.5 flex items-center gap-2 shadow-2xl rounded-lg">
                        <div class="group relative">
                            <button onClick={() => setMapMode('dark')} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'dark' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <span class="text-xs">🌑</span>
                            </button>
                            <div class="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50 uppercase tracking-widest">INTEL_DARK</div>
                        </div>
                        <div class="group relative">
                            <button onClick={() => setMapMode('terrain')} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'terrain' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <span class="text-xs">⛰️</span>
                            </button>
                            <div class="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50 uppercase tracking-widest">GEO_TERRAIN</div>
                        </div>
                        <div class="group relative">
                            <button onClick={() => setMapMode('satellite')} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'satellite' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <span class="text-xs">🛰️</span>
                            </button>
                            <div class="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50 uppercase tracking-widest">SAT_HD_LIVE</div>
                        </div>
                    </div>
                </div>

                {/* HUD: TOP STATS */}
                <div class="absolute top-4 left-4 z-[1000] flex gap-1 pointer-events-none">
                    {[
                        { v: stats().total, l: 'Total Events' },
                        { v: stats().countries, l: 'Countries' },
                        { v: stats().avgSeverity, l: 'Avg Severity', c: 'text-red-500' }
                    ].map(s => (
                        <div class="bg-black border border-white/5 px-4 py-2 rounded-sm flex flex-col min-w-[80px]">
                            <span class="text-[7px] font-black text-zinc-600 tracking-widest uppercase">{s.l}</span>
                            <span class={`text-[12px] font-black ${s.c || 'text-white'} font-mono leading-none mt-1`}>{s.v}</span>
                        </div>
                    ))}
                </div>

                {/* HUD: LEGEND */}
                <div class="absolute top-20 left-4 z-[1000] pointer-events-auto">
                    <div class="bg-[#0a0a0a] border border-white/10 p-4 rounded-sm shadow-2xl space-y-2">
                        <div class="text-[8px] font-black text-red-600 uppercase tracking-widest mb-2">Severity Scale</div>
                        {[
                            { c: '#ff4444', l: 'Critical' },
                            { c: '#ffaa00', l: 'High' },
                            { c: '#00bbff', l: 'Moderate' }
                        ].map(i => (
                            <div class="flex items-center gap-3">
                                <div class="w-1.5 h-1.5 rounded-full" style={{ "background-color": i.c }}></div>
                                <span class="text-[8px] font-black text-zinc-500 uppercase">{i.l}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* DETAILS PANEL */}
                <Show when={selectedEvent()}>
                    <div class="absolute inset-y-0 right-0 w-[400px] bg-black border-l border-red-900/40 z-[2000] flex flex-col pointer-events-auto shadow-[0_0_50px_rgba(0,0,0,1)]">
                        <div class="p-8 border-b border-white/5 relative overflow-hidden">
                            <div class="flex items-center justify-between mb-8">
                                <div class="flex items-center gap-2">
                                    <div class="w-2 h-2 rounded-full bg-red-600"></div>
                                    <span class="text-[9px] font-black text-red-500 uppercase tracking-[0.4em]">Event Details</span>
                                </div>
                                <button onClick={() => setSelectedEvent(null)} class="text-zinc-500 hover:text-white">✕</button>
                            </div>

                            <h2 class="text-3xl font-black text-white leading-none uppercase tracking-tighter mb-4 group cursor-default">
                                {selectedEvent().negara}
                            </h2>
                            <div class="text-[12px] font-black text-red-600 uppercase flex items-center gap-3 bg-[#1a0505] px-3 py-1 border border-red-900/30 w-fit rounded-sm italic">
                                {selectedEvent().detail_konflik}
                            </div>
                        </div>

                        <div class="flex-1 overflow-y-auto p-8 space-y-8 win-scroll">
                            {/* RECON FEED */}
                            <section>
                                <div class="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                    <div class="w-1 h-2 bg-red-800"></div> SAT_RECON_L4_FEED
                                </div>
                                <div class="w-full h-48 bg-zinc-900 border border-white/5 overflow-hidden">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        frameborder="0"
                                        class="grayscale brightness-75 hover:grayscale-0 hover:brightness-100 transition-all duration-700"
                                        src={`https://maps.google.com/maps?q=${selectedEvent().latitude},${selectedEvent().longitude}&hl=en&z=17&t=k&output=embed`}
                                    ></iframe>
                                </div>
                            </section>

                            <section>
                                <div class="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                                    <div class="w-1 h-2 bg-text_accent"></div> Intelligence Analysis
                                </div>
                                <div class="text-[11px] text-zinc-400 font-medium leading-relaxed indent-4 text-justify">
                                    {selectedEvent().penjelasan_singkat}
                                </div>
                            </section>

                            {/* MILITARY INTEL FEED */}
                            <section>
                                <div class="text-[8px] font-black text-red-600 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                    <div class="w-1 h-2 bg-red-600"></div> Military Intel Feed
                                </div>
                                <div class="space-y-4">
                                    <Show when={!isFetchingNews()} fallback={<div class="text-[8px] text-zinc-600 animate-pulse">POLLING_MILITARY_SATELLITE...</div>}>
                                        <For each={news().slice(0, 5)}>
                                            {(item) => (
                                                <div class="border-b border-white/5 pb-3 last:border-0 group cursor-pointer" onClick={() => window.open(item.link, '_blank')}>
                                                    <div class="text-[9px] font-black text-white group-hover:text-red-500 transition-colors uppercase leading-tight">
                                                        {item.title}
                                                    </div>
                                                    <div class="flex items-center gap-3 mt-1.5 opacity-30 text-[7px] font-black uppercase tracking-widest">
                                                        <span>{item.publisher}</span>
                                                        <span class="w-1 h-px bg-white/40"></span>
                                                        <span>{new Date(item.time * 1000).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                        <Show when={news().length === 0}>
                                            <div class="text-[8px] text-zinc-700 italic">No tactical updates available for this sector.</div>
                                        </Show>
                                    </Show>
                                </div>
                            </section>

                            <div class="grid grid-cols-2 gap-4">
                                <div class="p-4 bg-[#1a1a1a] border border-white/5 rounded-sm">
                                    <div class="text-[7px] font-black text-zinc-600 uppercase mb-2 tracking-widest">Severity</div>
                                    <div class="text-[14px] font-black text-white font-mono tracking-tighter">{selectedEvent().index_keparahan} / 100</div>
                                </div>
                                <div class="p-4 bg-[#1a1a1a] border border-white/5 rounded-sm">
                                    <div class="text-[7px] font-black text-zinc-600 uppercase mb-2 tracking-widest">Sector Status</div>
                                    <div class="text-[10px] font-black text-red-500 font-mono uppercase">Active Conflict</div>
                                </div>
                            </div>

                            <section>
                                <div class="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-4">Involved Parties</div>
                                <div class="text-[10px] text-zinc-400 font-mono leading-relaxed bg-[#0d0d0d] p-4 border border-white/10 rounded-sm italic uppercase">
                                    {selectedEvent().daftar_pihak_terlibat}
                                </div>
                            </section>

                            <section>
                                <div class="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-4">Status</div>
                                <div class="text-[10px] text-zinc-300 leading-relaxed font-medium bg-[#120303] p-4 border border-red-900/20 rounded-sm border-l-2">
                                    {selectedEvent().situasi_saat_ini}
                                </div>
                            </section>
                        </div>

                        <div class="p-6 border-t border-white/5 bg-black flex justify-end">
                            <button onClick={() => setSelectedEvent(null)} class="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-black text-white uppercase tracking-[0.3em] rounded-sm italic">
                                Close
                            </button>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
}
