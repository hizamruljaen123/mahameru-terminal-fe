import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';

export default function PowerPlantPanel() {
  const [powerPlants, setPowerPlants] = createSignal([]);
  const [countryList, setCountryList] = createSignal([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [stats, setStats] = createSignal(null);
  const [selectedCountry, setSelectedCountry] = createSignal('');
  const [selectedFuel, setSelectedFuel] = createSignal('');
  const [countrySearch, setCountrySearch] = createSignal('');
  
  // Selected Plant Dossier
  const [selectedPlant, setSelectedPlant] = createSignal(null);
  const [plantNews, setPlantNews] = createSignal([]);
  const [wikiSnippet, setWikiSnippet] = createSignal("");
  const [activeTab, setActiveTab] = createSignal('analytics'); // analytics, dossier

  const [currentPage, setCurrentPage] = createSignal(1);
  const [pageSize] = createSignal(200);
  const [totalCount, setTotalCount] = createSignal(0);
  
  let mapInstance = null;
  let markerLayer = null;
  let tileLayer = null;
  
  let charts = { fuel: null, capacity: null, trend: null, avg: null, transition: null };

  const [mapMode, setMapMode] = createSignal('dark');

  onMount(() => {
    const el = document.getElementById('powerplant-map-terminal');
    if (el) initMap(el);
    fetchCountryList();
    fetchStats();
  });

  onCleanup(() => {
    if (mapInstance) {
      try { mapInstance.off(); mapInstance.remove(); } catch (e) {}
      mapInstance = null;
    }
    Object.values(charts).forEach(c => c?.dispose());
  });

  const initMap = (el) => {
    if (mapInstance || !el) return;
    mapInstance = window.L.map(el, { zoomControl: false, attributionControl: true }).setView([15, 0], 2);
    markerLayer = window.L.layerGroup().addTo(mapInstance);
    
    createEffect(() => {
      const mode = mapMode();
      if (!mapInstance) return;
      if (tileLayer) mapInstance.removeLayer(tileLayer);
      const url = mode === 'dark' 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      tileLayer = window.L.tileLayer(url, { maxZoom: 19 }).addTo(mapInstance);
    });
    
    setTimeout(() => { if (mapInstance) mapInstance.invalidateSize(); }, 800);
  };

  const fetchCountryList = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_POWER_PLANT_API}/api/power-plants/countries`);
      const data = await res.json();
      setCountryList(data.data || []);
      renderCountryHubs();
    } catch (e) {}
  };

  const fetchStats = async (country = null) => {
    try {
      let url = `${import.meta.env.VITE_POWER_PLANT_API}/api/power-plants/stats`;
      if (country) url += `?country=${encodeURIComponent(country)}`;
      const res = await fetch(url);
      const data = await res.json();
      setStats(data);
      if (activeTab() === 'analytics') renderCharts();
    } catch (e) {}
  };

  const [globalSearch, setGlobalSearch] = createSignal('');
  let searchInputRef = null;

  const fetchPowerPlants = async (countryOverride = null, page = 1) => {
    setIsLoading(true);
    const country = countryOverride !== null ? countryOverride : selectedCountry();
    setCurrentPage(page);
    try {
      let url = `${import.meta.env.VITE_POWER_PLANT_API}/api/power-plants?page=${page}&page_size=${pageSize()}`;
      if (country) url += `&country=${encodeURIComponent(country)}`;
      if (selectedFuel()) url += `&fuel=${encodeURIComponent(selectedFuel())}`;
      if (globalSearch()) url += `&q=${encodeURIComponent(globalSearch())}`;
      
      const res = await fetch(url);
      const data = await res.json();
      setPowerPlants(data.data || []);
      setTotalCount(data.total || 0);
      renderPowerPlantMarkers();
    } catch (e) {} finally { setIsLoading(false); }
  };

  const fetchPlantDossier = async (plant) => {
    setPlantNews([]);
    setWikiSnippet("");
    try {
      // News Query Logic
      let ownerQuery = plant.owner ? ` "${plant.owner}"` : "";
      let query = `POWER PLANT "${plant.name}"${ownerQuery} ${plant.country_long}`;
      
      // Specifically for Indonesia, add local language query
      if (plant.country_long.toLowerCase() === 'indonesia') {
        let idOwner = plant.owner ? ` "${plant.owner}"` : "";
        query = `"Pembangkit Listrik" "${plant.name}"${idOwner} OR "POWER PLANT" "${plant.name}"`;
      }

      // News Fetch
      const nRes = await fetch(`${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(query)}&lang=${plant.country_long.toLowerCase() === 'indonesia' ? 'id' : 'en'}`);
      const nData = await nRes.json();
      setPlantNews(nData.news || []);

      // Wikipedia Fetch
      const wRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(plant.name.replace(/ /g, '_'))}`);
      if (wRes.ok) {
        const wData = await wRes.json();
        setWikiSnippet(wData.extract || "");
      }
    } catch (e) { console.error("Dossier error:", e); }
  };

  const renderCountryHubs = () => {
    if (!markerLayer || !mapInstance) return;
    markerLayer.clearLayers();
    countryList().forEach(c => {
      if (c.lat && c.lon) {
        const marker = window.L.circleMarker([c.lat, c.lon], {
          radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.6
        }).addTo(markerLayer);
        marker.on('click', () => { handleCountrySelection(c.name); mapInstance.flyTo([c.lat, c.lon], 10); });
      }
    });
  };

  const renderPowerPlantMarkers = () => {
    if (!markerLayer || !mapInstance) return;
    markerLayer.clearLayers();
    const bounds = [];
    
    const getFuelColor = (fuel) => {
        const colors = {
          'Coal': '#262626', 'Gas': '#f59e0b', 'Oil': '#78350f',
          'Hydro': '#3b82f6', 'Solar': '#fbce24', 'Wind': '#10b981',
          'Nuclear': '#a855f7', 'Geothermal': '#ef4444'
        };
        return colors[fuel] || '#6366f1';
    };

    powerPlants().forEach(p => {
      if (p.latitude && p.longitude) {
        const marker = window.L.circleMarker([p.latitude, p.longitude], {
          radius: Math.max(4, Math.min(10, p.capacity_mw / 400)),
          fillColor: getFuelColor(p.primary_fuel), color: '#fff', weight: 1, opacity: 1, fillOpacity: 0.8
        }).addTo(markerLayer);
        
        marker.on('click', () => { handlePlantSelection(p); });
        bounds.push([p.latitude, p.longitude]);
      }
    });
    if (bounds.length > 0) mapInstance.flyToBounds(bounds, { padding: [100, 100], duration: 1.5 });
  };

  const renderCharts = () => {
    const s = stats();
    if (!s || activeTab() !== 'analytics') return;
    setTimeout(() => {
        const up = (id, key, opt) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!charts[key]) charts[key] = window.echarts.init(el);
            charts[key].setOption({ backgroundColor: 'transparent', ...opt });
          };
      
          up('fuel-chart', 'fuel', {
            tooltip: { trigger: 'item' },
            series: [{ type: 'pie', radius: ['40%', '75%'], itemStyle: { borderRadius: 4, borderColor: '#000', borderWidth: 2 }, label: { show: false }, data: s.fuel_distribution.map(f => ({ value: f.total_capacity, name: f.primary_fuel })) }]
          });
      
          up('capacity-chart', 'capacity', {
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '5%', bottom: '5%', top: '5%', containLabel: true },
            xAxis: { type: 'value', splitLine: { show: false }, axisLabel: { show: false } },
            yAxis: { type: 'category', data: s.capacity_segments.map(c => c.category), axisLabel: { fontSize: 8, color: '#999' } },
            series: [{ type: 'bar', data: s.capacity_segments.map(c => c.count), itemStyle: { color: '#3b82f6' } }]
          });
      
          up('avg-chart', 'avg', {
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '5%', bottom: '25%', top: '5%', containLabel: true },
            xAxis: { type: 'category', data: s.fuel_distribution.slice(0, 8).map(f => f.primary_fuel), axisLabel: { fontSize: 8, color: '#999', rotate: 45 } },
            yAxis: { type: 'value', splitLine: { show: false }, axisLabel: { fontSize: 7 } },
            series: [{ type: 'bar', data: s.fuel_distribution.slice(0, 8).map(f => f.avg_capacity), itemStyle: { color: '#10b981' } }]
          });
      
          up('transition-chart', 'transition', {
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '5%', bottom: '15%', top: '5%', containLabel: true },
            xAxis: { type: 'category', data: [...new Set(s.fuel_year_matrix.map(m => m.decade))].sort(), axisLabel: { fontSize: 8, color: '#999' } },
            yAxis: { type: 'value', splitLine: { show: false }, axisLabel: { fontSize: 7 } },
            series: [{ type: 'line', smooth: true, data: s.commissioning_trend.map(t => t.count), itemStyle: { color: '#fbce24' }, areaStyle: { opacity: 0.1 } }]
          });
    }, 100);
  };

  const handleCountrySelection = (country) => {
    setSelectedCountry(country);
    setSelectedPlant(null);
    if (!country) {
        setPowerPlants([]); setTotalCount(0); renderCountryHubs(); fetchStats(null);
    } else {
        fetchPowerPlants(country, 1); fetchStats(country);
    }
  };

  const handlePlantSelection = (plant) => {
    setSelectedPlant(plant);
    setActiveTab('dossier');
    fetchPlantDossier(plant);
  };

  return (
    <div class="h-full w-full flex bg-bg_main overflow-hidden tracking-tight text-white" style="font-family: 'Roboto', sans-serif;">
      {/* SIDEBAR */}
      <div class="w-64 border-r border-border_main flex flex-col bg-bg_sidebar shrink-0">
        <div class="p-4 border-b border-border_main bg-bg_header/80 backdrop-blur-md">
           <div class="text-[10px] font-black text-text_accent tracking-widest mb-3 flex items-center gap-2 uppercase">
             <div class="w-2 h-2 bg-text_accent animate-pulse"></div> REGION REGISTRY
           </div>
           <input type="text" placeholder="FILTER NODES..." onInput={(e) => setCountrySearch(e.currentTarget.value)} class="w-full bg-black/40 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none" />
        </div>
        
        <div class="p-3 bg-black/30 border-b border-border_main">
            <div class="text-[9px] font-bold text-text_accent opacity-40 uppercase mb-2">FUEL TYPE FILTERS</div>
            <div class="flex flex-wrap gap-1">
                <For each={['Nuclear', 'Hydro', 'Solar', 'Wind', 'Gas', 'Coal', 'Oil']}>
                    {(f) => (
                        <button onClick={() => { setSelectedFuel(selectedFuel() === f ? '' : f); fetchPowerPlants(null, 1); }}
                            class={`px-2 py-0.5 text-[9px] border transition-all rounded-sm ${selectedFuel() === f ? 'bg-text_accent border-text_accent text-bg_main font-bold' : 'border-white/10 text-white/40 hover:border-white/40'}`}
                        >{f.toUpperCase()}</button>
                    )}
                </For>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto win-scroll p-1">
           <button onClick={() => handleCountrySelection('')} class={`w-full text-left p-3 mb-1 transition-all flex flex-col border border-transparent ${selectedCountry() === '' ? 'bg-text_accent/10 border-text_accent/30' : 'hover:bg-white/5'}`}>
             <span class={`text-[11px] font-bold ${selectedCountry() === '' ? 'text-text_accent' : 'text-white/60'}`}>Global Overview</span>
           </button>
           <For each={countryList().filter(c => c.name.toLowerCase().includes(countrySearch().toLowerCase()))}>
             {(c) => (
                <button onClick={() => handleCountrySelection(c.name)} class={`w-full text-left px-3 py-2 transition-all flex items-center gap-3 border border-transparent ${selectedCountry() === c.name ? 'bg-text_accent/10 border-text_accent/30 text-text_accent' : 'hover:bg-white/5 text-white/60'}`}>
                   <img src={`https://flagcdn.com/w20/${(c.code || "").toLowerCase()}.png`} class="w-4 h-3 opacity-80" onError={(e) => e.target.style.display='none'} />
                   <span class="text-[11px] font-medium truncate">{c.name}</span>
                </button>
             )}
           </For>
        </div>
      </div>

      {/* MAIN CONTENT Area */}
      <div class="flex-1 flex flex-col overflow-hidden">
        <div class="h-[55%] relative border-b border-border_main bg-black">
          <div id="powerplant-map-terminal" class="absolute inset-0"></div>
          <div class="absolute top-4 right-4 z-[1000] flex items-center gap-2">
             <div class="bg-black/60 p-2 border border-white/10 backdrop-blur-md shadow-2xl flex items-center gap-3">
                <button 
                  onClick={() => { if (selectedCountry()) { renderPowerPlantMarkers(); } else { mapInstance.flyTo([15, 0], 2); } }}
                  class="text-[9px] bg-white/10 border border-white/20 text-white/60 px-3 py-1 hover:bg-white/20 hover:text-white transition-all font-bold"
                > RECENTER VIEW </button>
                <div class="w-px h-3 bg-white/20"></div>
                <button onClick={() => { setSelectedFuel(''); handleCountrySelection(''); }}
                  class="text-[9px] bg-red-500/10 border border-red-500/30 text-red-500 px-3 py-1 hover:bg-red-500 hover:text-white transition-all font-bold"
                > RESET GLOBAL </button>
                <div class="w-px h-3 bg-white/20"></div>
                <button onClick={() => setMapMode(m => m === 'dark' ? 'satellite' : 'dark')} class={`text-[9px] border px-3 py-1 transition-all font-bold ${mapMode() === 'satellite' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-white/10 border-white/20 text-white/60'}`}>
                  {mapMode() === 'satellite' ? 'SAT ON' : 'SAT OFF'}
                </button>
             </div>
          </div>
          <div class="absolute bottom-4 left-4 z-20 pointer-events-none">
             <div class="text-[13px] font-black text-white tracking-[0.2em] bg-black/80 px-5 py-3 border-l-4 border-text_accent shadow-2xl flex items-center gap-4">
               {selectedCountry() || 'GLOBAL INFRASTRUCTURE'} <span class="opacity-40 font-normal ml-2">[{totalCount().toLocaleString()} Records]</span>
             </div>
          </div>
        </div>

        <div class="flex-1 flex overflow-hidden">
          {/* DATA TABLE */}
          <div class="w-[60%] flex flex-col border-r border-border_main bg-bg_main overflow-hidden">
            <div class="px-6 py-2 border-b border-border_main flex justify-between items-center z-10 shrink-0">
               <div class="flex items-center gap-4">
                  <h3 class="text-[11px] font-bold text-text_accent tracking-wider uppercase whitespace-nowrap">FACILITY INVENTORY</h3>
                  <div class="relative flex items-center">
                    <input 
                      type="text" 
                      placeholder="SEARCH FACILITY..." 
                      class="bg-black/40 border border-white/10 px-3 py-1 text-[10px] w-56 outline-none focus:border-text_accent/50 transition-all font-bold placeholder:opacity-20 translate-z-0"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setGlobalSearch(e.currentTarget.value);
                          fetchPowerPlants(null, 1);
                        }
                      }}
                    />
                    <Show when={globalSearch()}>
                       <button onClick={() => { setGlobalSearch(''); fetchPowerPlants(null, 1); }} class="absolute right-2 text-[10px] opacity-40 hover:opacity-100">×</button>
                    </Show>
                  </div>
               </div>
               <div class="flex gap-1 ml-4">
                  <button onClick={() => fetchPowerPlants(null, currentPage()-1)} disabled={currentPage()==1} class="text-[10px] px-3 py-1 bg-white/5 border border-white/10 opacity-40 hover:opacity-100 disabled:opacity-10 transition-all">← Prev</button>
                  <button onClick={() => fetchPowerPlants(null, currentPage()+1)} disabled={currentPage()==Math.ceil(totalCount()/pageSize())} class="text-[10px] px-3 py-1 bg-text_accent/20 border border-text_accent/40 text-text_accent font-bold hover:bg-text_accent hover:text-white flex items-center gap-1 transition-all">Next →</button>
               </div>
            </div>
            <div class="flex-1 overflow-y-auto win-scroll">
               <table class="w-full text-left border-collapse table-fixed">
                 <thead class="sticky top-0 bg-bg_sidebar/95 backdrop-blur-md z-10 border-b border-border_main">
                   <tr class="text-[10px] font-bold text-text_secondary/80 uppercase">
                     <th class="px-6 py-2.5">Facility Name</th>
                     <th class="px-2 py-2.5">Fuel</th>
                     <th class="px-2 py-2.5 text-right w-32">Output MW</th>
                     <th class="px-6 py-2.5 text-right w-44">Coords</th>
                   </tr>
                 </thead>
                 <tbody class="text-[12px]">
                   <For each={powerPlants()}>
                     {(p) => (
                       <tr class={`border-b border-border_main/10 hover:bg-text_accent/10 transition-colors cursor-pointer group ${selectedPlant()?.id === p.id ? 'bg-text_accent/5' : ''}`} onClick={() => { handlePlantSelection(p); mapInstance.flyTo([p.latitude, p.longitude], 14); }}>
                         <td class="px-6 py-2 leading-tight">
                           <div class="font-bold text-text_primary group-hover:text-text_accent transition-colors line-clamp-1 truncate">{p.name}</div>
                           <div class="text-[10px] text-white/30 italic truncate">{p.owner}</div>
                         </td>
                         <td class="px-2 py-2"><span class="px-1.5 py-0.5 text-[9px] font-bold border border-white/10 bg-black/40 text-text_accent rounded-sm">{p.primary_fuel}</span></td>
                         <td class="px-2 py-2 text-right font-bold text-text_accent">{p.capacity_mw.toLocaleString()}</td>
                         <td class="px-6 py-2 text-right text-white/20 italic text-[10px]">{Number(p.latitude).toFixed(3)}, {Number(p.longitude).toFixed(3)}</td>
                       </tr>
                     )}
                   </For>
                 </tbody>
               </table>
            </div>
          </div>

          {/* INTELLIGENCE DOCK (DYNAMIC) */}
          <div class="w-[40%] flex flex-col bg-bg_sidebar/40 overflow-hidden">
             <div class="p-3 border-b border-border_main flex justify-between items-center bg-bg_header/30">
                <div class="text-[10px] font-bold text-text_accent tracking-widest uppercase">
                  {selectedPlant() ? 'FACILITY DOSSIER' : 'REGIONAL ANALYTICS'}
                </div>
                <Show when={selectedPlant()}>
                  <button onClick={() => setSelectedPlant(null)} class="text-[9px] text-white/40 hover:text-white uppercase font-bold border border-white/10 px-2 py-0.5">RETURN TO ANALYTICS</button>
                </Show>
             </div>
             
             <div class="flex-1 overflow-y-auto win-scroll p-4">
                <Show when={!selectedPlant()}>
                  <div class="space-y-8">
                     <div class="grid grid-cols-2 gap-4">
                        <div><div class="text-[9px] text-white/40 mb-2 border-l-2 border-blue-500 pl-2 font-bold uppercase">FUEL MIX</div><div id="fuel-chart" class="h-28 w-full"></div></div>
                        <div><div class="text-[9px] text-white/40 mb-2 border-l-2 border-text_accent pl-2 font-bold uppercase">CAPACITY SEGMENTS</div><div id="capacity-chart" class="h-28 w-full"></div></div>
                     </div>
                     <div><div class="text-[9px] text-white/40 mb-2 border-l-2 border-green-500 pl-2 font-bold uppercase">AVERAGE CAPACITY</div><div id="avg-chart" class="h-32 w-full"></div></div>
                     <div><div class="text-[9px] text-white/40 mb-2 border-l-2 border-yellow-500 pl-2 font-bold uppercase">COMMISSIONING TREND</div><div id="transition-chart" class="h-32 w-full"></div></div>
                     
                     <div class="pt-4 border-t border-white/5">
                        <div class="text-[9px] text-white/40 mb-3 border-l-2 border-white pl-2 font-bold uppercase">PORTFOLIO OWNERS</div>
                        <div class="space-y-1.5">
                           <For each={stats()?.top_owners?.slice(0, 5)}>
                              {(o) => (
                                 <div class="flex items-center justify-between gap-4 bg-white/5 p-2 border border-white/5 text-[10px]">
                                    <span class="text-white/60 truncate font-bold uppercase">{o.owner}</span>
                                    <span class="text-text_accent font-black shrink-0">{Math.round(o.total_capacity).toLocaleString()} MW</span>
                                 </div>
                              )}
                           </For>
                        </div>
                     </div>
                  </div>
                </Show>

                <Show when={selectedPlant()}>
                  <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                     <div class="p-4 bg-blue-500/10 border border-blue-500/30 rounded-sm">
                        <div class="text-[10px] font-bold text-blue-400 uppercase mb-1 flex items-center gap-2">
                           <div class="w-2 h-2 bg-blue-400 animate-pulse"></div> FACILITY SELECTED
                        </div>
                        <div class="text-[16px] font-black">{selectedPlant()?.name}</div>
                        <div class="text-[11px] text-white/60 mt-1">GEO: {selectedPlant()?.country_long} | FUEL: {selectedPlant()?.primary_fuel}</div>
                     </div>

                     {/* SATELLITE IMAGE */}
                     <div class="border border-white/10 p-1 bg-black shadow-2xl relative group">
                        <iframe 
                          width="100%" 
                          height="280" 
                          frameborder="0" 
                          scrolling="no" 
                          class="grayscale-[20%] group-hover:grayscale-0 transition-all"
                          src={`https://maps.google.com/maps?q=${selectedPlant()?.latitude},${selectedPlant()?.longitude}&hl=id&z=17&t=k&output=embed`}>
                        </iframe>
                        <div class="absolute bottom-1 right-1 bg-black/80 px-2 py-1 text-[8px] text-white/40 font-mono tracking-tighter">
                          SAT FEED // HD
                        </div>
                     </div>

                     {/* WIKIPEDIA INTEL */}
                     <Show when={wikiSnippet()}>
                        <div class="space-y-2">
                           <div class="text-[10px] font-black text-text_accent uppercase tracking-widest flex items-center gap-2">
                             <div class="w-4 h-[1px] bg-text_accent"></div> TECHNICAL DATA
                           </div>
                           <div class="text-[12px] text-white/80 leading-relaxed bg-white/5 p-4 italic border-l-2 border-text_accent font-medium">
                              {wikiSnippet()}
                           </div>
                        </div>
                     </Show>

                     {/* STRATEGIC NEWS */}
                     <Show when={plantNews().length > 0}>
                        <div class="space-y-3">
                           <div class="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                             <div class="w-4 h-[1px] bg-blue-400"></div> FIELD INTELLIGENCE
                           </div>
                           <div class="space-y-2">
                              <For each={plantNews().slice(0, 12)}>
                                 {(n) => (
                                    <a href={n.link} target="_blank" class="block p-3 bg-black/40 border border-white/5 hover:border-blue-500/50 transition-all group">
                                       <div class="text-[12px] font-bold group-hover:text-blue-400 transition-colors leading-snug">{n.title}</div>
                                       <div class="flex justify-between items-center mt-2">
                                          <span class="text-[10px] text-white/30 uppercase font-black">{n.publisher}</span>
                                          <span class="text-[10px] text-white/20 italic">{new Date(n.time * 1000).toLocaleDateString()}</span>
                                       </div>
                                    </a>
                                 )}
                              </For>
                           </div>
                        </div>
                     </Show>

                     {/* EMPTY STATE */}
                     <Show when={!wikiSnippet() && plantNews().length === 0}>
                        <div class="p-12 text-center opacity-20 text-[11px] italic">No technical or strategic dossiers detected for this node.</div>
                     </Show>
                  </div>
                </Show>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
