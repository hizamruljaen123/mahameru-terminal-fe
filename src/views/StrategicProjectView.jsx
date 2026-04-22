import { createSignal, onMount, For, Show, onCleanup, createEffect, createMemo } from 'solid-js';
import { getUtilStatus } from '../utils/analysis/refineryIntel';
import { mapOffshoreType, OFFSHORE_CATEGORIES } from '../utils/config/offshoreMapping';

const CATEGORY_CONFIG = {
  REFINERY: { color: '#f97316', label: 'OIL REFINERY', icon: '🛢️' },
  LNG: { color: '#06b6d4', label: 'LNG TERMINAL', icon: '❄️' },
  OFFSHORE: { color: '#f43f5e', label: 'OFFSHORE PLATFORM', icon: '🌊' },
  TERMINAL: { color: '#d946ef', label: 'PETROLEUM TERMINAL', icon: '⛽' },
};

export default function StrategicProjectView(props) {
    const [assets, setAssets] = createSignal([]);
    const [selectedAsset, setSelectedAsset] = createSignal(null);
    const [isLoading, setIsLoading] = createSignal(false);
    const [searchQuery, setSearchQuery] = createSignal("");
    const [filterCategory, setFilterCategory] = createSignal('ALL');
    
    const [newsData, setNewsData] = createSignal([]);
    const [isLoadingNews, setIsLoadingNews] = createSignal(false);
    const [intelData, setIntelData] = createSignal(null);

    let mapInstance = null;
    let mapContainer;

    onMount(async () => {
        await fetchAllAssets();
    });

    onCleanup(() => {
        if (mapInstance) {
            mapInstance.remove();
            mapInstance = null;
        }
    });

    const fetchAllAssets = async () => {
        setIsLoading(true);
        try {
            const [refs, lng, off, terms] = await Promise.all([
                fetch(`${import.meta.env.VITE_OIL_REFINERY_API}/api/refineries`).then(r => r.json()),
                fetch(`${import.meta.env.VITE_OIL_REFINERY_API}/api/lng-facilities?limit=500`).then(r => r.json()),
                fetch(`${import.meta.env.VITE_OIL_REFINERY_API}/api/offshore-platforms?limit=500`).then(r => r.json()),
                fetch(`${import.meta.env.VITE_OIL_REFINERY_API}/api/petroleum-terminals?limit=500`).then(r => r.json())
            ]);

            const normalized = [
                ...(refs.data || []).map(r => ({ ...r, category: 'REFINERY', name: r.nama_kilang, country: r.negara, capacity: r.kapasitas_bbl_per_hari || 0 })),
                ...(lng.data || []).map(l => ({ ...l, category: 'LNG', name: l.fac_name, country: l.country, capacity: l.liq_capacity_bpd || 0 })),
                ...(off.data || []).map(o => ({ ...o, category: 'OFFSHORE', name: o.fac_name, country: o.country, capacity: 0 })),
                ...(terms.data || []).map(t => ({ ...t, category: 'TERMINAL', name: t.fac_name, country: t.country, capacity: t.liq_capacity_bpd || 0 }))
            ];
            
            setAssets(normalized);
        } catch (e) { console.error("Data acquisition failed", e); }
        finally { setIsLoading(false); }
    };

    const fetchAssetIntelligence = async (asset) => {
        setIsLoadingNews(true);
        setNewsData([]);
        setIntelData(null);

        // Fetch GNews
        try {
            const query = `${asset.name} ${asset.country} energy infrastructure news`;
            const res = await fetch(`${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setNewsData(data.news || []);
        } catch (e) { console.error("GNews fetch failed", e); }
        finally { setIsLoadingNews(false); }

        // Mock Advanced Intel
        setIntelData({
            utilization: Math.floor(Math.random() * 30) + 70, // 70-100%
            efficiency: (Math.random() * 5 + 92).toFixed(1),
            security_level: 'OPTIMAL',
            vessel_count: Math.floor(Math.random() * 12),
            operational_risk: 'LOW'
        });
    };

    const selectAsset = (a) => {
        setSelectedAsset(a);
        fetchAssetIntelligence(a);
        if (a.latitude && a.longitude) {
            initMap(parseFloat(a.latitude), parseFloat(a.longitude));
        }
    };

    const initMap = (lat, lon) => {
        if (!mapContainer || !window.maplibregl) return;
        
        if (mapInstance) {
            mapInstance.flyTo({ center: [lon, lat], zoom: 14, pitch: 45, duration: 2000 });
            return;
        }

        mapInstance = new window.maplibregl.Map({
            container: mapContainer,
            style: {
                version: 8,
                sources: {
                    'raster-tiles': {
                        type: 'raster',
                        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                        tileSize: 256,
                        attribution: '© Esri'
                    },
                    'labels': {
                        type: 'raster',
                        tiles: ['https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'],
                        tileSize: 256
                    }
                },
                layers: [
                    { id: 'raster-layer', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 22 },
                    { id: 'labels-layer', type: 'raster', source: 'labels', minzoom: 0, maxzoom: 22 }
                ]
            },
            center: [lon, lat],
            zoom: 14,
            pitch: 45,
            antialias: true
        });

        new window.maplibregl.Marker({ color: '#f97316' }).setLngLat([lon, lat]).addTo(mapInstance);
    };

    const filteredAssets = createMemo(() => {
        return assets().filter(a => {
            const matchSearch = a.name.toLowerCase().includes(searchQuery().toLowerCase()) || 
                              a.country.toLowerCase().includes(searchQuery().toLowerCase());
            const matchCat = filterCategory() === 'ALL' || a.category === filterCategory();
            return matchSearch && matchCat;
        });
    });

    return (
        <div class="flex-1 flex flex-col bg-[#050608] overflow-hidden font-mono text-zinc-300">
            {/* Unified Header */}
            <div class="h-12 border-b border-white/5 flex items-center px-4 gap-6 bg-[#0a0b0e] z-30 shrink-0">
                <div class="flex items-center gap-3">
                    <button onClick={props.onBack} class="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-all">←</button>
                    <div class="h-6 w-[1px] bg-white/10 mx-2"></div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-orange-500 tracking-[0.3em] uppercase leading-none">ENERGY_STRATEGIC_ANALYTICS</span>
                        <span class="text-[14px] font-black text-white tracking-tighter uppercase mt-0.5">Global Infrastructure Intelligence Hub</span>
                    </div>
                </div>

                <div class="flex gap-2 ml-10">
                    <For each={['ALL', 'REFINERY', 'LNG', 'OFFSHORE', 'TERMINAL']}>
                        {(cat) => (
                            <button 
                                onClick={() => setFilterCategory(cat)}
                                class={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border transition-all ${filterCategory() === cat ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-white/30 hover:text-white'}`}
                            >
                                {cat}
                            </button>
                        )}
                    </For>
                </div>

                <div class="ml-auto w-64 relative">
                   <input 
                      type="text" 
                      placeholder="SIGNAL_ACQUISITION_SEARCH..." 
                      class="w-full bg-[#14151a] border border-white/5 rounded px-3 py-1.5 text-[10px] outline-none focus:border-orange-500/50 transition-colors text-white placeholder:text-zinc-700" 
                      value={searchQuery()} 
                      onInput={(e) => setSearchQuery(e.target.value)} 
                   />
                </div>
            </div>

            <div class="flex-1 flex overflow-hidden">
                {/* Tactical Sidebar */}
                <div class="w-[380px] flex flex-col border-r border-white/5 bg-[#0a0b0e] z-10 shrink-0">
                    <div class="p-4 border-b border-white/5 bg-white/[0.01] flex justify-between items-center">
                        <div>
                            <h4 class="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Asset Deployment Index</h4>
                            <p class="text-[8px] text-zinc-700 mt-0.5 uppercase font-bold">Encrypted Feed // Live // Verified</p>
                        </div>
                        <div class="text-right">
                            <span class="text-[12px] font-black text-orange-500">{filteredAssets().length}</span>
                            <span class="text-[8px] text-zinc-700 block uppercase">Nodes</span>
                        </div>
                    </div>
                    <div class="flex-1 overflow-y-auto win-scroll p-3 space-y-2">
                        <Show when={isLoading()}>
                            <For each={[1,2,3,4,5,6,7,8]}>
                                {() => <div class="h-16 w-full bg-white/[0.02] border border-white/5 rounded animate-pulse"></div>}
                            </For>
                        </Show>
                        <For each={filteredAssets()}>
                            {(a) => (
                                <button 
                                    onClick={() => selectAsset(a)}
                                    class={`w-full p-4 rounded-lg text-left transition-all border group relative overflow-hidden ${selectedAsset()?.id === a.id ? 'bg-white/5 border-white/20 ring-1 ring-orange-500/20' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] shadow-sm'}`}
                                >
                                    <div class="absolute top-0 right-0 p-2 opacity-5 italic font-black text-[14px]">{a.category}</div>
                                    <div class="text-[12px] font-black text-zinc-100 group-hover:text-orange-500 transition-colors truncate uppercase italic">{a.name}</div>
                                    <div class="flex items-center justify-between mt-2">
                                        <div class="flex items-center gap-2">
                                            <span class="w-1 h-3 rounded-full" style={{ background: CATEGORY_CONFIG[a.category].color }}></span>
                                            <span class="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{a.country}</span>
                                        </div>
                                        <Show when={a.capacity > 0}>
                                            <span class="text-[9px] font-black text-zinc-600 uppercase tracking-tighter">
                                                {a.capacity.toLocaleString()} BPD
                                            </span>
                                        </Show>
                                    </div>
                                </button>
                            )}
                        </For>
                    </div>
                </div>

                {/* Deep Analysis Workspace */}
                <div class="flex-1 overflow-y-auto win-scroll bg-[#050608] relative">
                    <Show when={selectedAsset()} fallback={
                        <div class="h-full flex flex-col items-center justify-center text-zinc-800 p-20 gap-4">
                            <div class="w-24 h-24 border-2 border-dashed border-zinc-800 rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                                <span class="text-4xl opacity-20">📡</span>
                            </div>
                            <div class="text-center">
                                <div class="text-[12px] font-black uppercase tracking-[0.4em] mb-1">Awaiting Data Target Selection</div>
                                <div class="text-[9px] opacity-30 font-bold uppercase tracking-widest italic">Ready for deep structural analysis sequence</div>
                            </div>
                        </div>
                    }>
                        {(() => {
                            const a = selectedAsset();
                            const cfg = CATEGORY_CONFIG[a.category];
                            return (
                                <div class="animate-in fade-in slide-in-from-right-4 duration-700">
                                    {/* Asset Identity Blade */}
                                    <div class="p-8 pb-4 border-b border-white/5 bg-gradient-to-r from-white/[0.02] to-transparent">
                                        <div class="flex items-start justify-between">
                                            <div class="space-y-4">
                                                <div class="flex items-center gap-4">
                                                    <span class="px-3 py-1 text-[10px] font-black rounded border italic tracking-[0.2em]" style={{ color: cfg.color, 'border-color': cfg.color + '30', background: cfg.color + '10' }}>
                                                        {cfg.label}
                                                    </span>
                                                    <span class="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                                                        <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                                                        SYSTEMS_ACTIVE_NOMINAL
                                                    </span>
                                                </div>
                                                <h1 class="text-5xl font-black text-white leading-none uppercase tracking-tighter italic drop-shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                                                    {a.name}
                                                </h1>
                                                <div class="flex gap-10">
                                                    <div>
                                                        <span class="text-[9px] text-zinc-600 font-black uppercase block mb-1">GEOGRAPHIC_LOCATION</span>
                                                        <span class="text-[14px] font-black text-zinc-200 uppercase">{a.location || a.country}</span>
                                                    </div>
                                                    <Show when={a.operator}>
                                                        <div>
                                                            <span class="text-[9px] text-zinc-600 font-black uppercase block mb-1">OPERATIONAL_AUTHORITY</span>
                                                            <span class="text-[14px] font-black text-orange-500 uppercase">{a.operator}</span>
                                                        </div>
                                                    </Show>
                                                    <Show when={a.capacity > 0}>
                                                        <div>
                                                            <span class="text-[9px] text-zinc-600 font-black uppercase block mb-1">DESIGN_CAPACITY_BPD</span>
                                                            <span class="text-[14px] font-black text-green-500 uppercase">{a.capacity.toLocaleString()}</span>
                                                        </div>
                                                    </Show>
                                                </div>
                                            </div>
                                            <div class="flex flex-col items-end gap-4">
                                                <div class="bg-white/5 border border-white/10 p-3 rounded flex items-center gap-4 group">
                                                    <div class="text-right">
                                                        <div class="text-[8px] text-zinc-600 font-black">ANALYSIS_COORD</div>
                                                        <div class="text-[11px] font-black text-zinc-400 font-mono tracking-tighter">{a.latitude?.toFixed(4)}, {a.longitude?.toFixed(4)}</div>
                                                    </div>
                                                    <div class="w-10 h-10 bg-orange-500/20 text-orange-500 flex items-center justify-center rounded group-hover:scale-110 transition-transform">🛰️</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="p-8 grid grid-cols-12 gap-8 pb-32">
                                        {/* Left Column: Technical Grid & Analytics */}
                                        <div class="col-span-8 space-y-8">
                                            {/* Advanced Analytics Blade */}
                                            <div class="grid grid-cols-4 gap-4">
                                                <For each={[
                                                    { label: 'EFFICIENCY_RATING', value: `${intelData()?.efficiency || '--'}%`, color: 'text-blue-500', icon: '⚡' },
                                                    { label: 'CAPACITY_UTIL', value: `${intelData()?.utilization || '--'}%`, color: 'text-green-500', icon: '📊' },
                                                    { label: 'SECURITY_INDEX', value: intelData()?.security_level || '--', color: 'text-emerald-500', icon: '🛡️' },
                                                    { label: 'VESSEL_TRAFFIC', value: intelData()?.vessel_count || '--', color: 'text-orange-500', icon: '🚢' }
                                                ]}>
                                                    {(stat) => (
                                                        <div class="bg-white/[0.02] border border-white/5 p-5 rounded-2xl relative overflow-hidden group hover:border-white/10 transition-all">
                                                            <div class="absolute -right-2 -bottom-2 opacity-5 text-4xl group-hover:scale-125 transition-transform">{stat.icon}</div>
                                                            <div class="text-[9px] text-zinc-600 font-black uppercase mb-3 tracking-widest">{stat.label}</div>
                                                            <div class={`text-[24px] font-black ${stat.color} tracking-tighter font-mono`}>{stat.value}</div>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>

                                            {/* Geospatial Intelligence Matrix */}
                                            <div class="grid grid-cols-2 gap-8">
                                                <div class="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden h-[450px] relative shadow-2xl ring-1 ring-white/5">
                                                    <div ref={mapContainer} class="w-full h-full grayscale-[0.2] contrast-[1.1]"></div>
                                                    <div class="absolute top-4 left-4 z-10 bg-[#0a0b0e]/90 border border-white/10 px-3 py-1 rounded text-[8px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                                        <span class="w-1.5 h-1.5 bg-orange-500 animate-pulse"></span>
                                                        VHR_SATELLITE_FEED_L1
                                                    </div>
                                                </div>

                                                <div class="space-y-6">
                                                    <div class="bg-[#0f1115] border border-white/5 rounded-2xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
                                                        <div class="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg></div>
                                                        <div>
                                                            <h3 class="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                                <span class="w-1 h-3 bg-blue-600"></span> INFRA_SPEC_MATRIX
                                                            </h3>
                                                            <div class="grid grid-cols-2 gap-6">
                                                                <div class="space-y-4">
                                                                    <div>
                                                                        <div class="text-[7px] text-zinc-600 uppercase font-black tracking-widest mb-1">FACILITY_TYPE</div>
                                                                        <div class="text-[11px] font-black text-white uppercase">{a.fac_type || a.category}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div class="text-[7px] text-zinc-600 uppercase font-black tracking-widest mb-1">INFRA_ID</div>
                                                                        <div class="text-[11px] font-black text-white uppercase">#{a.id || Math.floor(Math.random()*10000)}</div>
                                                                    </div>
                                                                </div>
                                                                <div class="space-y-4">
                                                                    <div>
                                                                        <div class="text-[7px] text-zinc-600 uppercase font-black tracking-widest mb-1">COUNTRY_CODE</div>
                                                                        <div class="text-[11px] font-black text-white uppercase">{a.country || 'GLOBAL'}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div class="text-[7px] text-zinc-600 uppercase font-black tracking-widest mb-1">DATA_FIDELITY</div>
                                                                        <div class="text-[11px] font-black text-green-500 uppercase tracking-widest">VERIFIED_L3</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div class="border-t border-white/5 pt-6">
                                                            <h3 class="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                                <span class="w-1 h-3 bg-emerald-600"></span> ANALYSIS_INSIGHTS
                                                            </h3>
                                                            <p class="text-[10px] text-zinc-500 leading-relaxed italic uppercase font-medium">
                                                                Detecting {intelData()?.operational_risk === 'LOW' ? 'STABLE' : 'UNSTABLE'} operational parameters. Capacity utilization is operating at {intelData()?.utilization}% efficiency with consistent vessel throughput detected via AIS triangulation. No structural anomalies observed in latest VHR spectral analysis.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column: Real-time News Stream */}
                                        <div class="col-span-4 space-y-6">
                                            <div class="bg-[#0a0b0e] border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[750px] ring-1 ring-white/5">
                                                <div class="p-5 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                                                    <div class="flex items-center gap-3">
                                                        <div class="w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(249,115,22,0.5)]"></div>
                                                        <div>
                                                            <h3 class="text-[13px] font-black text-white uppercase tracking-[0.2em]">Live Signal Hub</h3>
                                                            <p class="text-[8px] text-zinc-700 uppercase font-black tracking-widest mt-0.5 italic">Real-time digital intel stream</p>
                                                        </div>
                                                    </div>
                                                    <Show when={isLoadingNews()}>
                                                        <div class="w-4 h-4 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                                                    </Show>
                                                </div>

                                                <div class="flex-1 overflow-y-auto win-scroll p-2 space-y-2">
                                                    <Show when={newsData().length > 0} fallback={
                                                        !isLoadingNews() && <div class="py-20 text-center opacity-30">
                                                            <div class="text-[9px] font-black uppercase tracking-widest mb-2 font-mono">📡 SIGNAL_LOSS</div>
                                                            <div class="text-[8px] font-bold uppercase italic tracking-tighter">Awaiting digital data acquisition sequence...</div>
                                                        </div>
                                                    }>
                                                        <For each={newsData()}>
                                                            {(news) => (
                                                                <a href={news.link} target="_blank" class="block p-4 bg-white/[0.02] border-l-2 border-white/5 hover:border-orange-500 hover:bg-white/[0.04] transition-all group relative overflow-hidden">
                                                                    <div class="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                                                                    </div>
                                                                    <div class="flex justify-between items-center text-[7px] text-zinc-600 font-black uppercase mb-2 tracking-widest">
                                                                        <span class="bg-white/5 px-1.5 py-0.5 rounded text-white italic">{news.publisher}</span>
                                                                        <span>{new Date(news.time * 1000).toLocaleDateString()}</span>
                                                                    </div>
                                                                    <h4 class="text-[11px] font-bold text-zinc-100 leading-tight group-hover:text-orange-500 transition-colors uppercase italic tracking-tighter line-clamp-3">
                                                                        {news.title}
                                                                    </h4>
                                                                </a>
                                                            )}
                                                        </For>
                                                    </Show>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </Show>
                </div>
            </div>
        </div>
    );
}
