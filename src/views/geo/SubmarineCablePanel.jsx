import { createSignal, onMount, For, Show } from 'solid-js';

export default function SubmarineCablePanel() {
  const [cables, setCables] = createSignal([]);
  const [selectedCable, setSelectedCable] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [isStarted, setIsStarted] = createSignal(true); // default true now
  const [selectedRegion, setSelectedRegion] = createSignal('GLOBAL');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [totalPages, setTotalPages] = createSignal(1);
  const [viewMode, setViewMode] = createSignal('map');
  const [wikiSummary, setWikiSummary] = createSignal(null);
  
  let mapInstance = null;
  let cableLayer = null;
  let fullGeoData = null;

  const REGIONS = [
    { id: 'GLOBAL', name: 'GLOBAL' },
    { id: 'A', name: 'ATLANTIC' },
    { id: 'I', name: 'INDIAN' },
    { id: 'P', name: 'PACIFIC' },
    { id: 'S', name: 'SOUTHEAST' },
    { id: 'E', name: 'EUROPE' },
    { id: 'M', name: 'MEDITERRANEAN' },
  ];

  const initMap = (el) => {
    if (mapInstance || !el) return;
    mapInstance = window.L.map(el, { zoomControl: false }).setView([20, 0], 2);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB'
    }).addTo(mapInstance);
    
    cableLayer = window.L.geoJSON(null, {
      style: (feature) => ({
        color: 'var(--text-accent)',
        weight: 1.5,
        opacity: 0.6
      }),
      onEachFeature: (feature, layer) => {
        layer.on('click', () => {
           fetchDetail(feature.properties.id);
        });
      }
    }).addTo(mapInstance);
    
    fetchGeo();
    setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, 200);
  };

  const fetchGeo = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUBMARINE_CABLE_API}/api/submarine-cables/geo`);
      const data = await res.json();
      fullGeoData = data;
      if (cableLayer) {
        cableLayer.addData(data);
      }
    } catch (e) { console.error("GeoJSON Fetch Error:", e); }
  };

  const fetchCables = async () => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_SUBMARINE_CABLE_API}/api/submarine-cables/list?page=${page()}&page_size=25`;
      if (searchQuery()) url += `&q=${encodeURIComponent(searchQuery())}`;
      if (selectedRegion() !== 'GLOBAL') url += `&region=${selectedRegion()}`;

      const res = await fetch(url);
      const result = await res.json();
      setCables(result.data);
      setTotalPages(result.total_pages);

      // Update map: If no search/region filter, show EVERYTHING. 
      // Otherwise, show only the results.
      if (cableLayer && fullGeoData) {
        cableLayer.clearLayers();
        
        const isFiltered = searchQuery() || selectedRegion() !== 'GLOBAL';
        
        if (!isFiltered) {
          cableLayer.addData(fullGeoData);
        } else {
          const filteredFeatures = fullGeoData.features.filter(f => 
            result.data.some(c => c.id === f.properties.id)
          );
          cableLayer.addData({ type: 'FeatureCollection', features: filteredFeatures });
          if (filteredFeatures.length > 0) {
             const bounds = cableLayer.getBounds();
             if (bounds.isValid()) mapInstance.fitBounds(bounds, { padding: [20, 20] });
          }
        }
      }
    } catch (e) {
      console.error("Fetch Cables Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchWikipediaSummary = async (name) => {
    try {
      const slug = name.replace(/\s+/g, '_');
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        setWikiSummary(data.extract);
      } else {
        setWikiSummary(null);
      }
    } catch (e) {
      setWikiSummary(null);
    }
  };

  const fetchDetail = async (id) => {
    setLoading(true);
    setWikiSummary(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUBMARINE_CABLE_API}/api/submarine-cables/detail/${id}`);
      const data = await res.json();
      setSelectedCable(data);
      setViewMode('detail');

      if (data.name) {
        fetchWikipediaSummary(data.name);
      }

      if (cableLayer && fullGeoData) {
        cableLayer.clearLayers();
        const singleFeature = fullGeoData.features.find(f => f.properties.id === id);
        if (singleFeature) {
          cableLayer.addData(singleFeature);
          const bounds = cableLayer.getBounds();
          if (bounds.isValid()) mapInstance.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    } catch (e) { 
      console.error("Cable Detail Error:", e); 
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      setPage(1);
      fetchCables();
    }
  };

  const handleBackToMap = () => {
    setViewMode('map');
    fetchCables();
  };

  const handleRegionSelect = (regId) => {
    setSelectedRegion(regId);
    if (regId === 'GLOBAL') {
      setSearchQuery('');
    }
    setPage(1);
    fetchCables();
  };

  onMount(() => {
    fetchCables();
  });

  return (
    <div class="h-full flex overflow-hidden bg-bg_main text-text_primary uppercase" style="font-family: 'Roboto', sans-serif;">
      {/* 1. Region Selector (Thin Sidebar) */}
      <div class="w-16 border-r border-border_main bg-bg_sidebar flex flex-col items-center py-4 space-y-4">
        <span class="text-[7px] text-text_accent font-black rotate-180 [writing-mode:vertical-lr] mb-2 uppercase tracking-widest">REGION</span>
        <For each={REGIONS}>
           {(reg) => (
             <button 
               onClick={() => handleRegionSelect(reg.id)}
               class={`w-10 h-10 flex items-center justify-center text-[10px] font-black border transition-all ${selectedRegion() === reg.id ? 'border-text_accent text-text_accent bg-text_accent/10 shadow-[0_0_10px_rgba(var(--text-accent-rgb),0.3)]' : 'border-border_main text-text_secondary hover:border-text_accent/50'}`}
               title={reg.name}
             >
               {reg.id}
             </button>
           )}
        </For>
      </div>

      {/* 2. Cable List Sidebar */}
      <div class="w-72 border-r border-border_main bg-bg_main flex flex-col">
        <div class="p-4 border-b border-border_main bg-bg_header">
          <h3 class="text-[10px] font-black text-text_accent tracking-widest uppercase mb-1">CABLE REGISTRY</h3>
          <p class="text-[8px] text-text_secondary tracking-tighter uppercase">{selectedRegion()} // REGIONAL ASSETS</p>
        </div>

        {/* Search Bar */}
        <div class="p-3 border-b border-border_main bg-black/20">
           <input 
             type="text" 
             placeholder="SEARCH CABLES..."
             class="w-full bg-bg_main border border-border_main p-2 text-[10px] text-text_accent focus:border-text_accent outline-none"
             value={searchQuery()}
             onInput={(e) => setSearchQuery(e.target.value)}
             onKeyDown={handleSearch}
           />
        </div>
        
        <div class="flex-1 overflow-y-auto win-scroll p-2">
           <Show when={!loading()} fallback={<div class="py-12 text-center text-[10px] animate-pulse">FETCHING DATA...</div>}>
              <div class="space-y-0.5">
                <For each={cables()}>
                  {(cable) => (
                    <button 
                      onClick={() => fetchDetail(cable.id)}
                      class={`w-full text-left p-2 text-[10px] border transition-all rounded-sm flex justify-between items-center group ${selectedCable()?.id === cable.id ? 'border-text_accent bg-text_accent/10' : 'border-transparent hover:border-text_accent/20 hover:bg-text_accent/5'}`}
                    >
                      <span class={`truncate transition-colors ${selectedCable()?.id === cable.id ? 'text-text_primary font-bold' : 'text-text_secondary group-hover:text-text_primary'}`}>{cable.name}</span>
                      <div class={`w-1 h-1 rounded-full ${selectedCable()?.id === cable.id ? 'bg-text_accent' : 'bg-transparent group-hover:bg-text_accent/30'}`}></div>
                    </button>
                  )}
                </For>
              </div>
           </Show>
        </div>

        {/* Pagination Controls */}
        <div class="p-3 border-t border-border_main bg-bg_header flex items-center justify-between text-[9px] font-black">
            <button 
              disabled={page() === 1 || loading()}
              onClick={() => { setPage(p => p - 1); fetchCables(); }}
              class="hover:text-text_accent disabled:opacity-30 uppercase tracking-widest"
            >PREV</button>
            <span class="text-text_secondary">{page()} / {totalPages()}</span>
            <button 
              disabled={page() === totalPages() || loading()}
              onClick={() => { setPage(p => p + 1); fetchCables(); }}
              class="hover:text-text_accent disabled:opacity-30 uppercase tracking-widest"
            >NEXT</button>
        </div>
      </div>

      {/* 3. Main Area */}
      <div class="flex-1 relative flex flex-col">
        {/* Map View */}
        <Show when={viewMode() === 'map'}>
           <div class="absolute inset-0 bg-bg_main">
              <div class="absolute inset-0 w-full h-full" ref={initMap}></div>
           </div>
           <div class="absolute inset-0 pointer-events-none z-10 border-[10px] border-text_accent/5 ring-inset ring-1 ring-text_accent/20"></div>
           
           {/* LOGO OVERLAY */}
           <div class="absolute top-6 left-6 z-20">
              <div class="bg-bg_header/80 backdrop-blur-md border border-border_main p-4 shadow-2xl">
                 <h4 class="text-[10px] font-black text-text_accent tracking-[0.4em] uppercase italic">CABLE INFRASTRUCTURE</h4>
                 <div class="text-[8px] text-text_secondary mt-1 uppercase opacity-60">SYSTEM LIVE</div>
              </div>
           </div>
        </Show>

        {/* Detail View (Full Page Replacement) */}
        <Show when={viewMode() === 'detail'}>
          <div class="absolute inset-0 z-20 bg-bg_main p-12 overflow-y-auto win-scroll animate-in fade-in duration-500">
            <div class="mx-auto max-w-5xl">
              <button 
                onClick={handleBackToMap}
                class="mb-12 flex items-center gap-3 text-[10px] text-text_accent hover:text-text_primary transition-all group"
              >
                <div class="border border-text_accent p-2 group-hover:bg-text_accent group-hover:text-bg_main transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </div>
                <span class="uppercase font-black tracking-[0.3em]">BACK TO MAP</span>
              </button>

              <div class="flex justify-between items-end border-b border-border_main pb-8 mb-10">
                <div>
                   <span class="text-[10px] text-text_accent tracking-[0.6em] uppercase font-black">FACILITY DOSSIER</span>
                   <h1 class="text-6xl font-black text-text_primary mt-2 uppercase tracking-tighter leading-none">{selectedCable()?.name}</h1>
                </div>
                <div class="text-right">
                   <div class="text-[10px] text-text_secondary uppercase opacity-50 mb-1 tracking-[0.2em]">SERVICE STATUS</div>
                   <div class="text-3xl font-black text-text_accent italic border-r-4 border-text_accent pr-4">{selectedCable()?.rfs || 'TBD'}</div>
                </div>
              </div>

              <div class="grid grid-cols-12 gap-16">
                 <div class="col-span-8 space-y-16">
                    <section>
                       <h3 class="text-[11px] font-black text-text_accent mb-6 flex items-center gap-3 uppercase">
                          <div class="w-8 h-[2px] bg-text_accent"></div>
                          EXECUTIVE SUMMARY
                       </h3>
                       <p class="text-[15px] text-text_secondary leading-relaxed font-light italic">
                         "the {selectedCable()?.name} infrastructure serves as a strategic backbone for global connectivity. 
                         mapping over {selectedCable()?.length || 'standardized'} kilometers of deep-sea fiber optic cabling, 
                         it provides high-density bandwidth critical for sovereign data integrity."
                       </p>
                    </section>

                    <section>
                       <h3 class="text-[11px] font-black text-text_accent mb-6 flex items-center gap-3 uppercase">
                          <div class="w-8 h-[2px] bg-text_accent"></div>
                          CONSORTIUM & INTELLIGENCE
                       </h3>
                       <div class="p-8 bg-bg_header border border-border_main border-l-8 border-l-text_accent shadow-xl space-y-6">
                          <div>
                            <span class="text-[8px] text-text_secondary uppercase font-bold tracking-widest block mb-2 opacity-50">OWNERSHIP</span>
                            <p class="text-[13px] text-text_primary/80 whitespace-pre-wrap leading-[1.8] font-mono">
                              {selectedCable()?.owners || 'INFORMATION CLASSIFIED'}
                            </p>
                          </div>

                          <Show when={wikiSummary()}>
                             <div class="pt-6 border-t border-border_main">
                                <span class="text-[8px] text-text_accent uppercase font-bold tracking-widest block mb-2">EXTERNAL INTELLIGENCE</span>
                                <p class="text-[12px] text-text_secondary italic leading-relaxed">
                                  {wikiSummary()}
                                </p>
                             </div>
                          </Show>
                       </div>
                    </section>
                 </div>

                 <div class="col-span-4 space-y-10">
                    <div class="p-6 border border-border_main bg-bg_header shadow-lg">
                       <h4 class="text-[10px] font-black text-text_accent mb-6 uppercase tracking-widest border-b border-border_main pb-2">LANDING POINTS</h4>
                       <div class="space-y-4 max-h-[500px] overflow-y-auto pr-2 win-scroll">
                         <For each={selectedCable()?.landing_points}>
                           {(lp) => (
                             <div class="flex flex-col border-b border-border_main/20 pb-2 hover:bg-text_accent/5 transition-colors p-1 group">
                                <span class="text-[11px] text-text_primary font-bold uppercase transition-colors group-hover:text-text_accent">{lp.name}</span>
                                <span class="text-[9px] text-text_secondary uppercase opacity-60 mt-1">{lp.country}</span>
                             </div>
                           )}
                         </For>
                       </div>
                    </div>

                    <div class="p-6 border border-text_accent/30 bg-text_accent/5 relative overflow-hidden group">
                       <div class="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
                          <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                       </div>
                       <h4 class="text-[10px] font-black text-text_accent mb-3 uppercase tracking-widest">SYSTEM STATUS</h4>
                       <div class="flex items-center gap-2">
                          <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          <div class="text-[11px] text-text_primary font-bold uppercase tracking-tighter">ONLINE</div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
