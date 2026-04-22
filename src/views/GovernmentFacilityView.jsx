import { createSignal, onMount, For, Show, onCleanup, createEffect } from 'solid-js';
import StrategicProjectView from './StrategicProjectView';
import MilitaryPanel from './infra/MilitaryPanel';


export default function GovernmentFacilityView() {
    const [viewLevel, setViewLevel] = createSignal('mode_select'); // 'mode_select', 'country_select', 'list', 'detail'
    const [analysisMode, setAnalysisMode] = createSignal(null); // 'SOVEREIGN' (By Owner) or 'DOMESTIC' (By Host)
    const [facilities, setFacilities] = createSignal([]);
    const [showStrategicProjects, setShowStrategicProjects] = createSignal(false);
    const [showMilitaryInfra, setShowMilitaryInfra] = createSignal(false);

    const [countries, setCountries] = createSignal([]);
    const [selectedCategory, setSelectedCategory] = createSignal('embassy');
    const [selectedEntity, setSelectedEntity] = createSignal(null);
    const [selectedFacility, setSelectedFacility] = createSignal(null);

    const [wikiData, setWikiData] = createSignal(null);
    const [isLoadingWiki, setIsLoadingWiki] = createSignal(false);

    const [newsData, setNewsData] = createSignal([]);
    const [isLoadingNews, setIsLoadingNews] = createSignal(false);

    const [isLoading, setIsLoading] = createSignal(false);
    const [searchQuery, setSearchQuery] = createSignal("");
    const [showMap, setShowMap] = createSignal(true);

    const [mapStyle, setMapStyle] = createSignal('osm'); // voyager, sat, osm, dark
    const [perspective, setPerspective] = createSignal('2D'); // 2D, 3D

    let mapInstance = null;
    let mapContainer;
    let markers = [];

    onMount(() => {
        initMap();
    });

    onCleanup(() => {
        if (mapInstance) {
            mapInstance.remove();
            mapInstance = null;
        }
    });

    const initMap = () => {
        if (!mapContainer || !window.maplibregl) return;

        mapInstance = new window.maplibregl.Map({
            container: mapContainer,
            style: getMapStyleObj('voyager'),
            center: [100, 5],
            zoom: 4,
            pitch: 0,
            bearing: 0,
            antialias: true
        });

        mapInstance.on('load', () => {
            setTimeout(() => mapInstance.resize(), 100);
        });
    };

    const getMapStyleObj = (mode) => {
        let tiles;
        let attr = '© OpenStreetMap';

        switch (mode) {
            case 'sat':
                tiles = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'];
                attr = '© Esri';
                break;
            case 'osm':
                tiles = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
                attr = '© OpenStreetMap';
                break;
            case 'dark':
                tiles = ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'];
                attr = '© CartoDB';
                break;
            default: // voyager
                tiles = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'];
                attr = '© Esri';
        }

        return {
            version: 8,
            sources: {
                'raster-tiles': { type: 'raster', tiles: tiles, tileSize: 256, attribution: attr }
            },
            layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 22 }]
        };
    };

    createEffect(() => {
        const style = mapStyle();
        if (mapInstance && mapInstance.getSource('raster-tiles')) {
            const styleObj = getMapStyleObj(style);
            try {
                mapInstance.removeLayer('raster-layer');
                mapInstance.removeSource('raster-tiles');
                mapInstance.addSource('raster-tiles', styleObj.sources['raster-tiles']);
                mapInstance.addLayer(styleObj.layers[0]);
            } catch (e) { console.warn(e); }
        }
    });

    const togglePerspective = () => {
        if (!mapInstance) return;
        if (perspective() === '2D') {
            mapInstance.easeTo({ pitch: 45, duration: 800 });
            setPerspective('3D');
        } else {
            mapInstance.easeTo({ pitch: 0, duration: 800 });
            setPerspective('2D');
        }
    };

    const resetSystem = () => {
        if (mapInstance) {
            mapInstance.flyTo({ center: [100, 5], zoom: 4, pitch: 0, duration: 1200 });
        }
        setPerspective('2D');
        setViewLevel('mode_select');
        setAnalysisMode(null);
        setSelectedEntity(null);
        setSelectedFacility(null);
        setCountries([]);
        setFacilities([]);
        setWikiData(null);
        setNewsData([]);
        clearMarkers();
    };

    const fetchWikipedia = async (query) => {
        setIsLoadingWiki(true);
        setWikiData(null);
        try {
            const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`);
            const searchData = await searchRes.json();
            if (searchData.query?.search?.length > 0) {
                const title = searchData.query.search[0].title;
                const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
                const summaryData = await summaryRes.json();
                setWikiData(summaryData);
            }
        } catch (e) { } finally { setIsLoadingWiki(false); }
    };

    const fetchEmbassyNews = async (f) => {
        setIsLoadingNews(true);
        setNewsData([]);
        try {
            const origin = f.operating_country || '';
            const host = f.country || '';
            const website = f.website ? f.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null;

            // 1. Core Keywords
            const baseQueries = [
                website ? `site:${website}` : null,
                `bilateral relations "${origin}" and "${host}"`,
                `hubungan diplomatik "${origin}" dan "${host}"`,
                `immigration visa updates "${origin}"`,
                `berita imigrasi "${origin}"`
            ].filter(Boolean);

            // 2. RSS Broadcasters (Top Tier News)
            const rssBroadcasters = [
                `site:reuters.com "${origin}" "${host}"`,
                `site:apnews.com "${origin}" "${host}"`,
                `site:bloomberg.com diplomacy "${origin}"`,
                `site:cnn.com "${origin}" immigration`,
                `site:thejakartapost.com bilateral ties "${origin}"`
            ];

            const allQueries = [...baseQueries, ...rssBroadcasters];
            const allNews = [];
            const seenUrls = new Set();

            const fetchPromises = allQueries.map(q =>
                fetch(`${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(q)}`)
                    .then(r => r.json())
                    .catch(() => ({ news: [] }))
            );

            // Fetch Indonesian specific context separately
            const idQueryRes = await fetch(`${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(`hubungan "${origin}" dan "${host}"`)}&lang=id&country=ID`);
            const idData = await idQueryRes.json();

            const results = await Promise.all(fetchPromises);

            ([...results.map(r => r.news || []), idData.news || []].flat()).forEach(n => {
                const url = n.link || n.url;
                if (url && !seenUrls.has(url)) {
                    allNews.push(n);
                    seenUrls.add(url);
                }
            });

            // Sort by time (newest first)
            const sorted = allNews.sort((a, b) => (b.time || 0) - (a.time || 0));
            setNewsData(sorted.slice(0, 25)); // Increased results
        } catch (e) {
            console.error("News fetch failed", e);
        } finally {
            setIsLoadingNews(false);
        }
    };

    const enterMode = async (mode) => {
        setAnalysisMode(mode);
        setIsLoading(true);
        try {
            const endpoint = mode === 'SOVEREIGN' ? 'represented-countries' : 'countries';
            const res = await fetch(`${import.meta.env.VITE_GOVERNMENT_FACILITY_API}/api/gov-facilities/${endpoint}?type=${encodeURIComponent(selectedCategory())}`);
            const data = await res.json();
            setCountries(data.map(item => typeof item === 'string' ? { name: item } : { name: item.country, lat: item.lat, lon: item.lon, code: item.code }));
            setViewLevel('country_select');
            if (mode === 'DOMESTIC') updateMapWithHostCountries(data);
            else { clearMarkers(); resetView(); }
        } catch (e) { console.error(e); }
        setIsLoading(false);
    };

    const fetchFacilities = async (target) => {
        setSelectedEntity(target);
        setIsLoading(true);
        try {
            const param = analysisMode() === 'SOVEREIGN' ? 'country' : 'location';
            const res = await fetch(`${import.meta.env.VITE_GOVERNMENT_FACILITY_API}/api/gov-facilities/list?type=${encodeURIComponent(selectedCategory())}&${param}=${encodeURIComponent(target)}`);
            const data = await res.json();
            setFacilities(data);
            setViewLevel('list');
            updateMapWithFacilities(data);
        } catch (e) { console.error(e); }
        setIsLoading(false);
    };

    const clearMarkers = () => {
        markers.forEach(m => m.remove());
        markers = [];
    };

    const updateMapWithHostCountries = (countryData) => {
        if (!mapInstance) return;
        clearMarkers();
        const bounds = new window.maplibregl.LngLatBounds();
        let hasBounds = false;
        countryData.forEach(c => {
            if (c.lat && c.lon) {
                const el = document.createElement('div');
                el.className = 'w-3 h-3 rounded-full bg-blue-500 border border-white/20 cursor-pointer hover:scale-125 transition-transform shadow-[0_0_8px_rgba(59,130,246,0.5)]';
                const marker = new window.maplibregl.Marker({ element: el }).setLngLat([c.lon, c.lat]).addTo(mapInstance);
                el.addEventListener('click', () => fetchFacilities(c.country));
                markers.push(marker);
                bounds.extend([c.lon, c.lat]);
                hasBounds = true;
            }
        });
        if (hasBounds) mapInstance.fitBounds(bounds, { padding: 80, duration: 1500 });
    };

    const updateMapWithFacilities = (facilityData) => {
        if (!mapInstance) return;
        clearMarkers();
        const bounds = new window.maplibregl.LngLatBounds();
        let hasBounds = false;
        facilityData.forEach(f => {
            if (f.latitude && f.longitude) {
                const flagUrl = f.repr_code ? `https://flagcdn.com/w40/${f.repr_code.toLowerCase()}.png` : null;
                const el = document.createElement('div');
                el.className = 'compact-pin cursor-pointer';
                el.innerHTML = flagUrl ? `<img src="${flagUrl}" class="compact-img" />` : `<div class="w-2.5 h-2.5 bg-blue-500 rounded-full border border-white/30"></div>`;
                const marker = new window.maplibregl.Marker({ element: el }).setLngLat([f.longitude, f.latitude]).addTo(mapInstance);
                el.addEventListener('click', () => {
                    handleMapFocus(f.latitude, f.longitude);
                    setSelectedFacility(f);
                    fetchWikipedia(f.operator);
                    fetchEmbassyNews(f);
                    setViewLevel('detail');
                });
                markers.push(marker);
                bounds.extend([f.longitude, f.latitude]);
                hasBounds = true;
            }
        });
        if (hasBounds) mapInstance.fitBounds(bounds, { padding: 100, duration: 1500 });
    };

    const handleMapFocus = (lat, lon) => {
        if (mapInstance) mapInstance.flyTo({ center: [lon, lat], zoom: 16, pitch: perspective() === '3D' ? 45 : 0, duration: 1200 });
    };

    const goBack = () => {
        if (viewLevel() === 'detail') { setViewLevel('list'); setSelectedFacility(null); setWikiData(null); setNewsData([]); }
        else if (viewLevel() === 'list') { setViewLevel('country_select'); setFacilities([]); if (analysisMode() === 'DOMESTIC') updateMapWithHostCountries(countries()); else { clearMarkers(); resetView(); } }
        else if (viewLevel() === 'country_select') { setViewLevel('mode_select'); setCountries([]); setAnalysisMode(null); setSelectedEntity(null); clearMarkers(); resetView(); }
    };

    const getPrevViewName = () => {
        if (viewLevel() === 'detail') return 'Back to List';
        if (viewLevel() === 'list') return 'Select Country';
        if (viewLevel() === 'country_select') return 'Main Menu';
        return '';
    };

    return (
        <div class="flex-1 flex flex-col overflow-hidden">
            <Show when={showStrategicProjects()}>
                <StrategicProjectView onBack={() => setShowStrategicProjects(false)} />
            </Show>

            <Show when={showMilitaryInfra()}>
                <MilitaryPanel onBack={() => setShowMilitaryInfra(false)} />
            </Show>

            <Show when={!showStrategicProjects() && !showMilitaryInfra()}>
                <div class="flex-1 flex flex-col bg-[#0f0f12] overflow-hidden font-sans text-zinc-300">
                    {/* Dark Compact Header */}
                    <div class="h-10 border-b border-white/5 flex items-center px-4 gap-4 bg-[#141416] z-20 shrink-0">
                        <div class="flex items-center gap-2">
                            <div class="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                            <span class="text-[11px] font-bold tracking-tight text-white capitalize">Government Facility Explorer</span>
                            {analysisMode() && <>
                                <span class="text-white/10 text-[10px]">/</span>
                                <span class="text-[10px] text-zinc-500 capitalize">{analysisMode().toLowerCase()} view</span>
                            </>}
                        </div>
                        <div class="ml-auto w-48 relative">
                            <input type="text" placeholder="Search..." class="w-full bg-[#1e1e22] border border-white/5 rounded px-2 py-0.5 text-[10px] outline-none focus:border-blue-500/50 transition-colors text-white placeholder:text-zinc-600" value={searchQuery()} onInput={(e) => setSearchQuery(e.target.value)} />
                        </div>
                    </div>

                    <div class="flex-1 flex overflow-hidden">
                        {/* Dark Compact Sidebar */}
                        <div class={`${showMap() ? 'w-[320px]' : 'flex-1'} flex flex-col border-r border-white/5 bg-[#141416] z-10 transition-all duration-500 overflow-hidden`}>

                            <div class="flex-1 overflow-y-auto win-scroll">
                                <Show when={viewLevel() === 'mode_select'}>
                                    <div class="p-5 space-y-4">
                                        <div class="space-y-1">
                                            <h2 class="text-[13px] font-bold text-white uppercase tracking-tight">Facility Directory</h2>
                                            <p class="text-[10px] text-zinc-500 leading-relaxed">Select how you want to browse government facilities.</p>
                                        </div>
                                        <div class="grid gap-2 pt-2">
                                            <button onClick={() => enterMode('SOVEREIGN')} class="p-4 bg-white/[0.03] border border-white/5 rounded-xl text-left hover:bg-white/[0.06] hover:border-blue-500/30 transition-all group">
                                                <h3 class="text-[11px] font-bold text-zinc-200 group-hover:text-blue-400">By Diplomatic Owner</h3>
                                                <p class="text-[9px] text-zinc-500 leading-normal mt-1 italic">Browse global footprint by owner nation.</p>
                                            </button>
                                            <button onClick={() => enterMode('DOMESTIC')} class="p-4 bg-white/[0.03] border border-white/5 rounded-xl text-left hover:bg-white/[0.06] hover:border-blue-500/30 transition-all group">
                                                <h3 class="text-[11px] font-bold text-zinc-200 group-hover:text-blue-400">By Host Location</h3>
                                                <p class="text-[9px] text-zinc-500 leading-normal mt-1 italic">Browse missions within a target territory.</p>
                                            </button>
                                            <div class="pt-2">
                                                <button onClick={() => setShowStrategicProjects(true)} class="w-full p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-left hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all group">
                                                    <h3 class="text-[11px] font-bold text-emerald-400">Strategic National Projects</h3>
                                                    <p class="text-[9px] text-zinc-500 leading-normal mt-1 italic">Monitor global infrastructure & PSN developments.</p>
                                                </button>
                                            </div>
                                            <div class="pt-2">
                                                <button onClick={() => setShowMilitaryInfra(true)} class="w-full p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-left hover:bg-red-500/10 hover:border-red-500/30 transition-all group">
                                                    <h3 class="text-[11px] font-bold text-red-400">Military Infrastructure</h3>
                                                    <p class="text-[9px] text-zinc-500 leading-normal mt-1 italic">Surveillance of global defense & military headquarters.</p>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </Show>

                                <Show when={viewLevel() !== 'mode_select'}>
                                    <button onClick={goBack} class="flex items-center gap-2 p-4 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors border-b border-white/[0.02] w-full bg-white/[0.01] uppercase tracking-widest">
                                        <span class="text-blue-500">←</span> {getPrevViewName()}
                                    </button>
                                </Show>

                                <Show when={viewLevel() === 'country_select'}>
                                    <div class="p-2 space-y-0.5">
                                        <For each={countries().filter(c => c.name.toLowerCase().includes(searchQuery().toLowerCase()))}>
                                            {(c) => (
                                                <button onClick={() => fetchFacilities(c.name)} class="w-full px-4 py-2.5 flex items-center justify-between text-[11px] font-bold text-zinc-400 hover:bg-white/[0.04] hover:text-white rounded-lg transition-all group">
                                                    <div class="flex items-center gap-3">
                                                        <Show when={c.code}><img src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`} class="w-4 h-3 object-cover rounded-sm shadow-sm opacity-40 group-hover:opacity-100" /></Show>
                                                        <span>{c.name}</span>
                                                    </div>
                                                    <span class="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </Show>

                                <Show when={viewLevel() === 'list'}>
                                    <div class="p-4 space-y-4">
                                        <div class="px-1 border-l-2 border-blue-500 pl-4">
                                            <h4 class="text-[11px] font-bold text-white uppercase tracking-wider">{selectedEntity()}</h4>
                                            <p class="text-[9px] text-zinc-500 font-medium">{facilities().length} facilities located</p>
                                        </div>
                                        <div class="space-y-1">
                                            <For each={facilities().filter(f => (f.operator || "").toLowerCase().includes(searchQuery().toLowerCase()) || (f.city || "").toLowerCase().includes(searchQuery().toLowerCase()))}>
                                                {(f) => (
                                                    <div onClick={() => { setSelectedFacility(f); setViewLevel('detail'); handleMapFocus(f.latitude, f.longitude); fetchWikipedia(f.operator); fetchEmbassyNews(f); }}
                                                        class="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-blue-500/40 hover:bg-white/[0.04] cursor-pointer transition-all">
                                                        <div class="flex items-center gap-3">
                                                            <Show when={f.repr_code}><img src={`https://flagcdn.com/w40/${f.repr_code.toLowerCase()}.png`} class="w-5 h-3.5 object-cover rounded-sm shadow-sm opacity-80" /></Show>
                                                            <div class="min-w-0 flex-1">
                                                                <div class="text-[10px] font-black text-zinc-200 truncate uppercase tracking-tight">{analysisMode() === 'SOVEREIGN' ? f.country : f.operator}</div>
                                                                <div class="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">{f.city} // {f.facility_type}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </div>
                                </Show>

                                <Show when={viewLevel() === 'detail' && selectedFacility()}>
                                    {(() => {
                                        const f = selectedFacility();
                                        return (
                                            <div class="p-6 space-y-6 animate-in fade-in duration-500 pb-24">
                                                <div class="space-y-3">
                                                    <div class="text-[8px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 w-fit px-2 py-0.5 rounded-sm uppercase tracking-widest">{f.facility_type}</div>
                                                    <h2 class="text-[14px] font-black text-white leading-tight uppercase tracking-tight">{f.operator}</h2>
                                                </div>

                                                {/* News Hub Section */}
                                                <div class="space-y-4">
                                                    <div class="flex items-center justify-between border-b border-white/5 pb-2">
                                                        <div class="flex items-center gap-2">
                                                            <div class="w-1 h-3 bg-emerald-500 rounded-full"></div>
                                                            <span class="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em]">Global Signal Hub</span>
                                                        </div>
                                                        <Show when={isLoadingNews()}>
                                                            <div class="w-3 h-3 border border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                                                        </Show>
                                                    </div>

                                                    <div class="space-y-2 max-h-[400px] overflow-y-auto win-scroll pr-1">
                                                        <For each={newsData()}>
                                                            {(news) => (
                                                                <a href={news.link || news.url} target="_blank" class="block p-4 bg-white/[0.02] border border-white/5 rounded-xl transition-all group hover:bg-white/[0.05] hover:border-emerald-500/30">
                                                                    <div class="text-[10px] text-zinc-100 group-hover:text-emerald-400 transition-colors font-bold leading-relaxed mb-3">
                                                                        {news.title}
                                                                    </div>
                                                                    <div class="flex items-center justify-between opacity-30 text-[7px] font-black uppercase tracking-widest">
                                                                        <span class="truncate pr-4">{news.publisher || news.source?.name}</span>
                                                                        <span class="shrink-0">{news.time ? new Date(news.time * 1000).toLocaleDateString() : (news.publishedAt ? new Date(news.publishedAt).toLocaleDateString() : '')}</span>
                                                                    </div>
                                                                </a>
                                                            )}
                                                        </For>
                                                        <Show when={!isLoadingNews() && newsData().length === 0}>
                                                            <div class="text-[9px] text-zinc-600 italic text-center py-6 uppercase tracking-widest bg-white/[0.01] rounded border border-dashed border-white/5 opacity-50 font-bold">Signal link offline</div>
                                                        </Show>
                                                    </div>
                                                </div>

                                                {/* Wikipedia Insight Section */}
                                                <div class="bg-blue-500/[0.02] border border-blue-500/10 rounded-xl p-5 space-y-4">
                                                    <div class="flex items-center gap-2">
                                                        <div class="w-1 h-3 bg-blue-500 rounded-full"></div>
                                                        <span class="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">Regional Profile</span>
                                                    </div>
                                                    <Show when={isLoadingWiki()}>
                                                        <div class="space-y-3 animate-pulse">
                                                            <div class="h-2 bg-white/5 rounded w-full"></div>
                                                            <div class="h-2 bg-white/5 rounded w-full"></div>
                                                            <div class="h-2 bg-white/5 rounded w-2/3"></div>
                                                        </div>
                                                    </Show>
                                                    <Show when={wikiData()} fallback={!isLoadingWiki() && <div class="text-[9px] text-zinc-600 italic font-bold uppercase tracking-widest">Metadata link failed</div>}>
                                                        <div class="space-y-4">
                                                            <p class="text-[10px] text-zinc-400 leading-relaxed font-normal">
                                                                {wikiData().extract}
                                                            </p>
                                                            <a href={wikiData().content_urls?.desktop?.page} target="_blank" class="flex items-center gap-2 text-[8px] text-blue-400 hover:text-white transition-colors uppercase font-black tracking-widest">
                                                                Open Full Report
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
                                                            </a>
                                                        </div>
                                                    </Show>
                                                </div>

                                                <div class="pt-4 flex flex-col gap-2 sticky bottom-0 bg-[#141416]/90 backdrop-blur-xl border-t border-white/5 -mx-6 px-6 pb-6 mt-auto">
                                                    <Show when={f.website}>
                                                        <a href={f.website} target="_blank" class="flex justify-center items-center w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-[10px] hover:bg-blue-500 transition-all uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-[0.98]">
                                                            Access Official Hub
                                                        </a>
                                                    </Show>
                                                    <div class="grid grid-cols-3 gap-2">
                                                        <Show when={f.facebook}><a href={f.facebook} target="_blank" class="h-10 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center hover:bg-white/[0.1] text-[9px] font-black text-zinc-600 hover:text-white transition-all uppercase tracking-tighter">FB</a></Show>
                                                        <Show when={f.twitter}><a href={f.twitter} target="_blank" class="h-10 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center hover:bg-white/[0.1] text-[9px] font-black text-zinc-600 hover:text-white transition-all uppercase tracking-tighter">TW</a></Show>
                                                        <Show when={f.youtube}><a href={f.youtube} target="_blank" class="h-10 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center hover:bg-white/[0.1] text-[9px] font-black text-zinc-600 hover:text-white transition-all uppercase tracking-tighter">YT</a></Show>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </Show>
                            </div>

                            <div class="h-8 px-4 bg-[#0f0f12] border-t border-white/5 flex items-center justify-between shrink-0">
                                <span class="text-[8px] text-zinc-700 font-black uppercase tracking-widest">SYS_STATUS: ACTIVE</span>
                                <span class="text-[8px] font-mono text-zinc-800 uppercase">LINK_v1.1</span>
                            </div>
                        </div>

                        {/* Map Area */}
                        <div class="flex-1 relative bg-[#0a0a0c]">
                            <div ref={mapContainer} class="w-full h-full"></div>

                            <div class="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                                <div class="bg-black/70 backdrop-blur-md border border-white/10 p-1 flex flex-col gap-1 shadow-2xl rounded-xl">
                                    <button onClick={resetSystem} class="w-8 h-8 flex items-center justify-center text-zinc-500 hover:bg-white/10 rounded-lg transition-colors" title="Full System Reset">🔄</button>
                                    <div class="h-px bg-white/5 mx-1"></div>
                                    <button onClick={togglePerspective} class={`w-8 h-8 flex items-center justify-center rounded-lg text-[9px] font-black ${perspective() === '2D' ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:bg-white/10'}`}>2D</button>
                                    <button onClick={togglePerspective} class={`w-8 h-8 flex items-center justify-center rounded-lg text-[9px] font-black ${perspective() === '3D' ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:bg-white/10'}`}>3D</button>
                                </div>

                                <div class="bg-black/70 backdrop-blur-md border border-white/10 p-1 flex flex-col gap-1 shadow-2xl rounded-xl">
                                    <button onClick={() => setMapStyle('voyager')} class={`w-8 h-8 flex items-center justify-center rounded-lg text-[8px] font-black ${mapStyle() === 'voyager' ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:bg-white/10'}`} title="Voyager">VGR</button>
                                    <button onClick={() => setMapStyle('osm')} class={`w-8 h-8 flex items-center justify-center rounded-lg text-[8px] font-black ${mapStyle() === 'osm' ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:bg-white/10'}`} title="OpenStreetMap">OSM</button>
                                    <button onClick={() => setMapStyle('dark')} class={`w-8 h-8 flex items-center justify-center rounded-lg text-[8px] font-black ${mapStyle() === 'dark' ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:bg-white/10'}`} title="Dark Matter">DRK</button>
                                    <button onClick={() => setMapStyle('sat')} class={`w-8 h-8 flex items-center justify-center rounded-lg text-[8px] font-black ${mapStyle() === 'sat' ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:bg-white/10'}`} title="Satellite">SAT</button>
                                </div>
                            </div>

                            <Show when={isLoading()}>
                                <div class="absolute inset-0 bg-black/40 backdrop-blur-sm z-[2000] flex items-center justify-center">
                                    <div class="w-10 h-10 border-2 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
                                </div>
                            </Show>

                            <div class="absolute top-4 left-4 pointer-events-none z-[1000]">
                                <div class="bg-black/80 backdrop-blur-md border border-white/10 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-4">
                                    <div class="w-1 h-8 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"></div>
                                    <div>
                                        <span class="text-[12px] font-bold text-white block leading-none tracking-tight">{selectedEntity() || 'Grid View'}</span>
                                        <span class="text-[8px] text-zinc-500 block uppercase tracking-[0.2em] mt-1 font-black">Facilities Map Feed</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <style>{`
                .compact-pin { width: 22px; height: 16px; border: 1.5px solid #FFF; border-radius: 2px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.3); background: #FFF; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
                .compact-pin:hover { transform: scale(1.8) translateY(-4px); z-index: 2000; box-shadow: 0 12px 30px rgba(0,0,0,0.6); }
                .compact-img { width: 100%; height: 100%; object-fit: cover; }
            `}</style>
                </div>
            </Show>
        </div>
    );
}
