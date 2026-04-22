import { createSignal, onMount, onCleanup, For, Show, createEffect, Switch, Match } from 'solid-js';

export default function AirportIntelligencePanel() {
  const [continents, setContinents] = createSignal([]);
  const [countries, setCountries] = createSignal([]);
  const [types, setTypes] = createSignal([]);
  const [airports, setAirports] = createSignal([]);
  
  const [selectedContinent, setSelectedContinent] = createSignal('');
  const [selectedCountry, setSelectedCountry] = createSignal('');
  const [selectedType, setSelectedType] = createSignal('large_airport');
  const [searchQuery, setSearchQuery] = createSignal('');
  
  const [viewLevel, setViewLevel] = createSignal('continent'); // continent, country, airport
  const [nodes, setNodes] = createSignal([]); 
  const [isLoading, setIsLoading] = createSignal(false);
  
  let mapInstance = null;
  let markerLayer = null;
  let tileLayer = null;
  
  const [mapMode, setMapMode] = createSignal('dark'); // dark, satellite
  
  onMount(() => {
    const el = document.getElementById('airport-map-terminal');
    if (el) initMap(el);
  });

  onCleanup(() => {
    if (mapInstance) {
      try {
        mapInstance.off();
        mapInstance.remove();
      } catch (e) {
        console.error("Map cleanup error:", e);
      }
      mapInstance = null;
    }
  });

  const initMap = (el) => {
    if (mapInstance || !el) return;
    
    // Create map instance
    mapInstance = window.L.map(el, { 
      zoomControl: false,
      attributionControl: true
    }).setView([15, 0], 2);
    
    // Create layer group for markers
    markerLayer = window.L.layerGroup().addTo(mapInstance);

    // Initial tile layer setup handled by createEffect
    createEffect(() => {
      const mode = mapMode();
      if (!mapInstance) return;
      
      if (tileLayer) {
          mapInstance.removeLayer(tileLayer);
      }
      
      const url = mode === 'dark' 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        
      const attr = mode === 'dark' ? '&copy; CartoDB' : '&copy; Esri';
      
      tileLayer = window.L.tileLayer(url, {
        attribution: attr,
        maxZoom: 19
      }).addTo(mapInstance);
    });
    
    // Force size invalidation
    setTimeout(() => {
      if (mapInstance) {
        mapInstance.invalidateSize();
        fetchContinents();
      }
    }, 800);
  };

  const fetchContinents = async () => {
    setIsLoading(true);
    setViewLevel('continent');
    setSelectedContinent('');
    setSelectedCountry('');
    const res = await fetch(`${import.meta.env.VITE_INFRASTRUCTURE_API}/api/infra/airports/continent-nodes`);
    const data = await res.json();
    setNodes(data);
    setIsLoading(false);
    renderNodes();
  };

  const fetchCountries = async (cont) => {
    setIsLoading(true);
    setSelectedContinent(cont);
    setViewLevel('country');
    const res = await fetch(`${import.meta.env.VITE_INFRASTRUCTURE_API}/api/infra/airports/country-nodes?continent=${cont}`);
    const data = await res.json();
    setNodes(data || []);
    setIsLoading(false);
    renderNodes();
    
    // Also update continent list for dropdown
    const cRes = await fetch(`${import.meta.env.VITE_INFRASTRUCTURE_API}/api/infra/airports/continents`);
    const cData = await cRes.json();
    setContinents(cData);
  };

  const fetchAirports = async (countryCode) => {
    const cont = selectedContinent();
    const count = countryCode || selectedCountry();
    const type = selectedType();
    
    if (countryCode) setSelectedCountry(countryCode);
    setViewLevel('airport');

    const q = searchQuery();

    const res = await fetch(`${import.meta.env.VITE_INFRASTRUCTURE_API}/api/infra/airports/search?continent=${cont}&country=${count}&type=${type}&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setAirports(data);
    setIsLoading(false);
    renderAirports();

    // Update types for dropdown
    const tRes = await fetch(`${import.meta.env.VITE_INFRASTRUCTURE_API}/api/infra/airports/types?continent=${cont}&country=${count}`);
    const tData = await tRes.json();
    setTypes(tData);

    // Update countries list for dropdown
    const cRes = await fetch(`${import.meta.env.VITE_INFRASTRUCTURE_API}/api/infra/airports/country-nodes?continent=${cont}`);
    const cData = await cRes.json();
    setCountries(cData);
  };

  const renderNodes = () => {
    if (!markerLayer || !mapInstance) return;
    markerLayer.clearLayers();
    const bounds = [];
    
    nodes().forEach(n => {
      const isContinent = viewLevel() === 'continent';
      const color = isContinent ? '#3b82f6' : '#f59e0b'; // Blue for Continent, Amber for Country
      const size = isContinent ? 15 : 10;
      
      const marker = window.L.circleMarker([n.lat, n.lon], {
        radius: size,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.6
      }).addTo(markerLayer);

      const label = isContinent ? n.continent : n.name;
      marker.bindTooltip(`${label} (${n.count})`, { permanent: false, direction: 'top' });
      
      marker.on('click', () => {
        if (isContinent) {
          fetchCountries(n.continent);
        } else {
          fetchAirports(n.code);
        }
      });

      bounds.push([n.lat, n.lon]);
    });

    if (bounds.length > 0) {
      mapInstance.flyToBounds(bounds, { padding: [100, 100], duration: 1 });
    }
  };

  const renderAirports = () => {
    if (!markerLayer || !mapInstance) return;
    markerLayer.clearLayers();
    const bounds = [];
    
    airports().forEach(a => {
      const marker = window.L.circleMarker([a.latitude, a.longitude], {
        radius: 6,
        fillColor: '#ef4444', // Red for airports
        color: '#fff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(markerLayer);
      
      marker.bindPopup(`
        <div class="p-2 bg-black text-white font-mono text-[10px] uppercase">
          <div class="text-text_accent font-black mb-1">${a.name}</div>
          <div>CODE: ${a.ident} / ${a.iata || 'N/A'}</div>
          <div>TYPE: ${a.type}</div>
          <div>MUNICIPALITY: ${a.municipality}</div>
        </div>
      `);
      
      bounds.push([a.latitude, a.longitude]);
    });
    
    if (bounds.length > 0) {
      mapInstance.flyToBounds(bounds, { padding: [50, 50], duration: 1 });
    }
  };

  return (
    <div class="h-full w-full flex flex-col bg-bg_main overflow-hidden font-mono uppercase">
      {/* MAP AREA (70%) */}
      <div class="h-[70%] relative border-b border-border_main bg-zinc-900">
        <div id="airport-map-terminal" class="absolute inset-0"></div>
        
        {/* NAV OVERLAY */}
        <div class="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
           <div class="bg-black/80 p-3 border border-text_accent/20 backdrop-blur-md shadow-2xl min-w-[200px]">
              <div class="flex items-center justify-between gap-4 mb-2">
                <div class="flex items-center gap-2 text-[10px] font-black text-text_accent tracking-widest">
                  <div class="w-2 h-2 bg-text_accent animate-pulse"></div>
                  INFRASTRUCTURE MONITOR
                </div>
                <button 
                  onClick={fetchContinents}
                  class="text-[8px] bg-red-500/10 border border-red-500/30 text-red-500 px-2 py-0.5 hover:bg-red-500 hover:text-white transition-all"
                >
                  RESET GLOBAL
                </button>
                <button 
                  onClick={() => setMapMode(m => m === 'dark' ? 'satellite' : 'dark')}
                  class={`text-[8px] border px-2 py-0.5 transition-all ${mapMode() === 'satellite' ? 'bg-yellow-500 text-black border-yellow-500 font-black' : 'bg-white/10 border-white/20 text-white/60 hover:text-white'}`}
                >
                  {mapMode() === 'satellite' ? 'SAT ON' : 'SAT OFF'}
                </button>
              </div>

              <div class="text-[8px] text-white/40 mb-1 border-b border-white/5 pb-2 uppercase flex items-center gap-2">
                <span class="opacity-30">LOC:</span>
                <span class="text-text_accent">GLOBE</span>
                <Show when={selectedContinent()}><span class="opacity-20">/</span> <span class="text-text_accent">{selectedContinent()}</span></Show>
                <Show when={selectedCountry()}><span class="opacity-20">/</span> <span class="text-text_accent">{selectedCountry()}</span></Show>
              </div>
              
              <div class="mt-2 flex flex-col gap-1">
                 <div class="text-[7px] text-text_secondary opacity-40">NAVIGATION LEVEL</div>
                 <div class="text-[10px] font-black text-white/80 tracking-[0.2em]">{viewLevel().replace('_', ' ').toUpperCase()}</div>
              </div>

              {/* TACTICAL SEARCH & TYPE FILTER (ONLY AT AIRPORT LEVEL) */}
              <Show when={viewLevel() === 'airport'}>
                <div class="mt-4 pt-3 border-t border-white/5 flex flex-col gap-3">
                   <div class="flex flex-col gap-1.5">
                      <div class="text-[7px] text-text_accent opacity-60 font-black tracking-widest">FACILITY SEARCH</div>
                      <div class="relative">
                        <input 
                          type="text"
                          placeholder="ENTER FACILITY NAME..."
                          value={searchQuery()}
                          onInput={(e) => setSearchQuery(e.currentTarget.value)}
                          onKeyDown={(e) => e.key === 'Enter' && fetchAirports()}
                          class="w-full bg-black/40 border border-white/10 px-2 py-1.5 text-[9px] text-white focus:border-text_accent/50 outline-none transition-all placeholder:text-white/10 uppercase font-black"
                        />
                        <div class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-20">🔍</div>
                      </div>
                   </div>

                   <div class="flex flex-col gap-1.5">
                      <div class="text-[7px] text-text_accent opacity-60 font-black tracking-widest">FACILITY CATEGORY</div>
                      <div class="flex flex-wrap gap-1">
                          <For each={[
                            'large_airport', 'medium_airport', 'small_airport', 
                            'heliport', 'seaplane_base', 'balloonport', 'closed'
                          ]}>
                            {(t) => (
                              <button 
                                onClick={() => {
                                  setSelectedType(t);
                                  fetchAirports();
                                }}
                                class={`text-[7px] px-1.5 py-0.5 border transition-all ${
                                  selectedType() === t 
                                  ? 'bg-text_accent border-text_accent text-bg_main font-black' 
                                  : 'bg-black/40 border-white/10 text-white/40 hover:border-text_accent/40'
                                }`}
                              >
                                {t.replace('_', ' ').toUpperCase()}
                              </button>
                            )}
                          </For>
                      </div>
                   </div>
                </div>
              </Show>
           </div>

           <div class="bg-black/80 px-3 py-1.5 border border-text_accent/10 backdrop-blur-md flex justify-between gap-4">
              <div class="text-[8px] text-white/40 italic">
                FACILITIES IN VIEW: {viewLevel() === 'airport' ? airports().length : nodes().length}
              </div>
              <div class="text-[8px] text-text_accent font-bold animate-pulse">
                SYSTEM LIVE
              </div>
           </div>
        </div>

        {/* LOGO OVERLAY */}
        <div class="absolute bottom-4 left-4 z-20">
           <div class="text-[10px] font-black text-text_accent tracking-[0.3em] uppercase italic bg-bg_main/60 backdrop-blur-sm px-2 py-1 border-l-2 border-text_accent">
             AIRPORT INFRASTRUCTURE MONITOR
           </div>
        </div>
      </div>

      {/* DYNAMIC TABLE AREA (30%) */}
      <div class="h-[30%] flex flex-col bg-bg_main overflow-hidden border-t border-border_main">
        <div class="px-6 py-2 border-b border-border_main bg-bg_header flex justify-between items-center sticky top-0 z-10 shadow-lg">
          <h3 class="text-[9px] font-black text-text_accent tracking-[0.2em] uppercase">INFRASTRUCTURE INVENTORY // {viewLevel().replace('_', ' ')}</h3>
          <span class="text-[8px] text-text_secondary opacity-40 font-mono italic">DATA VERIFIED // {new Date().toISOString()}</span>
        </div>
        
        <div class="flex-1 overflow-y-auto win-scroll relative bg-bg_main">
          <Show when={isLoading()}>
            <div class="absolute inset-0 bg-black/50 z-20 flex items-center justify-center backdrop-blur-sm">
              <div class="text-[12px] font-black text-text_accent animate-pulse tracking-[0.5em]">SYNCHRONIZING DATA...</div>
            </div>
          </Show>
          
          <table class="w-full text-left border-collapse table-fixed">
            <thead class="sticky top-0 bg-bg_sidebar z-10 border-b border-border_main shadow-sm">
              <Switch>
                <Match when={viewLevel() === 'continent'}>
                  <tr class="text-[8px] font-black text-text_secondary/80 uppercase tracking-tighter">
                    <th class="px-6 py-2">CONTINENT</th>
                    <th class="px-2 py-2">TOTAL FACILITIES</th>
                    <th class="px-2 py-2">COORDINATES</th>
                    <th class="px-6 py-2 text-right">ACTION</th>
                  </tr>
                </Match>
                <Match when={viewLevel() === 'country'}>
                  <tr class="text-[8px] font-black text-text_secondary/80 uppercase tracking-tighter">
                    <th class="px-6 py-2">CODE</th>
                    <th class="px-2 py-2">COUNTRY</th>
                    <th class="px-2 py-2">TOTAL FACILITIES</th>
                    <th class="px-2 py-2">COORDINATES</th>
                    <th class="px-6 py-2 text-right">ACTION</th>
                  </tr>
                </Match>
                <Match when={viewLevel() === 'airport'}>
                  <tr class="text-[8px] font-black text-text_secondary/80 uppercase tracking-tighter">
                    <th class="px-6 py-2">FACILITY NAME</th>
                    <th class="px-2 py-2">CODES (ICAO/IATA)</th>
                    <th class="px-2 py-2">COUNTRY</th>
                    <th class="px-2 py-2 w-40 text-right">LAT / LNG</th>
                    <th class="px-6 py-2 text-center w-32">SOURCE</th>
                  </tr>
                </Match>
              </Switch>
            </thead>
            <tbody class="text-[10px] font-mono">
              {/* BACK NAVIGATION ROW */}
              <Show when={viewLevel() !== 'continent'}>
                <tr 
                  class="border-b border-border_main/50 bg-white/5 hover:bg-white/10 cursor-pointer transition-all group"
                  onClick={() => {
                    if (viewLevel() === 'airport') fetchCountries(selectedContinent());
                    else fetchContinents();
                  }}
                >
                  <td colspan="5" class="px-6 py-2">
                    <div class="flex items-center gap-2 text-white/40 group-hover:text-text_accent transition-all italic text-[8px]">
                      <span class="font-black">←</span>
                      <span>RETURN TO {viewLevel() === 'airport' ? 'COUNTRY' : 'GLOBAL'} LEVEL</span>
                    </div>
                  </td>
                </tr>
              </Show>

              <For each={viewLevel() === 'airport' ? airports() : nodes()}>
                {(item, i) => (
                  <tr class="border-b border-border_main/30 hover:bg-text_accent/10 transition-colors group cursor-pointer" 
                      onClick={() => {
                        if (viewLevel() === 'continent') fetchCountries(item.continent);
                        else if (viewLevel() === 'country') fetchAirports(item.code);
                        else mapInstance.flyTo([item.latitude, item.longitude], 12);
                      }}>
                    
                    <Switch>
                      {/* CONTINENT ROW */}
                      <Match when={viewLevel() === 'continent'}>
                        <td class="px-6 py-2 font-black text-blue-400">{item.continent}</td>
                        <td class="px-2 py-2 text-white/60">{item.count} NODES</td>
                        <td class="px-2 py-2 text-white/30 italic">
                          {Number(item.lat).toFixed(4)}, {Number(item.lon).toFixed(4)}
                        </td>
                        <td class="px-6 py-2 text-right">
                          <span class="text-[8px] border border-blue-500/20 px-2 py-1 text-blue-400 group-hover:bg-blue-500 group-hover:text-bg_main transition-all">VIEW DETAILS</span>
                        </td>
                      </Match>

                      {/* COUNTRY ROW */}
                      <Match when={viewLevel() === 'country'}>
                        <td class="px-6 py-2 font-black text-amber-400">{item.code}</td>
                        <td class="px-2 py-2 text-text_primary font-bold">{item.name}</td>
                        <td class="px-2 py-2 text-white/60">{item.count} NODES</td>
                        <td class="px-2 py-2 text-white/30 italic">
                          {Number(item.lat).toFixed(4)}, {Number(item.lon).toFixed(4)}
                        </td>
                        <td class="px-6 py-2 text-right">
                          <span class="text-[8px] border border-amber-500/20 px-2 py-1 text-amber-400 group-hover:bg-amber-500 group-hover:text-bg_main transition-all">VIEW AIRPORTS</span>
                        </td>
                      </Match>

                      {/* AIRPORT ROW */}
                      <Match when={viewLevel() === 'airport'}>
                        <td class="px-6 py-2">
                          <div class="text-[10px] font-black text-text_primary group-hover:text-red-400 transition-colors">{item.name}</div>
                          <div class="text-[8px] text-text_secondary opacity-40 lowercase">{item.municipality}</div>
                        </td>
                        <td class="px-2 py-2">
                          <div class="text-[9px] font-bold text-red-500">{item.ident}</div>
                          <div class="text-[8px] text-text_secondary opacity-30">{item.iata || '---'}</div>
                        </td>
                        <td class="px-2 py-2 text-[9px] text-text_secondary/60 uppercase">
                          {item.country_name}
                        </td>
                        <td class="px-2 py-2 text-text_secondary/40 text-right">
                          {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                        </td>
                        <td class="px-6 py-2 text-center">
                          <Show when={item.wikipedia}>
                            <a href={item.wikipedia} target="_blank" onClick={(e) => e.stopPropagation()} class="text-[8px] border border-red-500/20 px-2 py-1 text-red-400 hover:bg-red-500 hover:text-white transition-all">WIKI</a>
                          </Show>
                        </td>
                      </Match>
                    </Switch>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
          
          <Show when={(viewLevel() === 'airport' ? airports() : nodes()).length === 0}>
             <div class="h-full flex flex-col items-center justify-center p-32 opacity-20">
               <div class="text-[10px] font-mono uppercase tracking-[0.5em]">SYSTEM IDLE</div>
             </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
