import { createSignal, onMount, onCleanup, For, Show, createEffect, Switch, Match } from 'solid-js';

export default function PortIntelligencePanel() {
  const [continents, setContinents] = createSignal([]);
  const [countries, setCountries] = createSignal([]);
  const [ports, setPorts] = createSignal([]);
  
  const [selectedContinent, setSelectedContinent] = createSignal('');
  const [selectedCountry, setSelectedCountry] = createSignal('');
  
  const [viewLevel, setViewLevel] = createSignal('continent'); // continent, country, port
  const [nodes, setNodes] = createSignal([]); 
  const [isLoading, setIsLoading] = createSignal(false);
  
  let mapInstance = null;
  let markerLayer = null;
  let tileLayer = null;
  
  const [mapMode, setMapMode] = createSignal('dark'); // dark, satellite
  const [selectedPortForAIS, setSelectedPortForAIS] = createSignal(null);
  
  onMount(() => {
    const el = document.getElementById('port-map-terminal');
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
    const res = await fetch(`${import.meta.env.VITE_PORT_API}/api/infra/ports/continent-nodes`);
    const data = await res.json();
    setNodes(data);
    setIsLoading(false);
    renderNodes();
  };

  const fetchCountriesForContinent = async (cont) => {
    setIsLoading(true);
    setSelectedContinent(cont);
    setViewLevel('country');
    const res = await fetch(`${import.meta.env.VITE_PORT_API}/api/infra/ports/country-nodes?continent=${cont}`);
    const data = await res.json();
    setNodes(data || []);
    setIsLoading(false);
    renderNodes();
    
    // Also update continent list for dropdown (if needed)
    const cRes = await fetch(`${import.meta.env.VITE_PORT_API}/api/infra/ports/continents`);
    const cData = await cRes.json();
    setContinents(cData);
  };

  const fetchPorts = async (countryCode) => {
    const cont = selectedContinent();
    const count = countryCode || selectedCountry();
    
    if (!cont || !count) return;
    
    setIsLoading(true);
    if (countryCode) setSelectedCountry(countryCode);
    setViewLevel('port');

    const res = await fetch(`${import.meta.env.VITE_PORT_API}/api/infra/ports/search?continent=${cont}&country=${count}`);
    const data = await res.json();
    setPorts(data);
    setIsLoading(false);
    renderPorts();

    // Update countries list for dropdown
    const cRes = await fetch(`${import.meta.env.VITE_PORT_API}/api/infra/ports/country-nodes?continent=${cont}`);
    const cData = await cRes.json();
    setCountries(cData);
  };

  const renderNodes = () => {
    if (!markerLayer || !mapInstance) return;
    markerLayer.clearLayers();
    const bounds = [];
    
    nodes().forEach(n => {
      const isContinent = viewLevel() === 'continent';
      const color = isContinent ? '#0ea5e9' : '#10b981'; // Cyan for Continent, Emerald for Country
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
          fetchCountriesForContinent(n.continent);
        } else {
          fetchPorts(n.code);
        }
      });

      bounds.push([n.lat, n.lon]);
    });

    if (bounds.length > 0) {
      mapInstance.flyToBounds(bounds, { padding: [100, 100], duration: 1 });
    }
  };

  const renderPorts = () => {
    if (!markerLayer || !mapInstance) return;
    markerLayer.clearLayers();
    const bounds = [];
    
    ports().forEach(p => {
      const marker = window.L.circleMarker([p.latitude, p.longitude], {
        radius: 6,
        fillColor: '#3b82f6', // Azure for ports
        color: '#fff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(markerLayer);
      
      marker.bindPopup(`
        <div class="p-2 bg-black text-white font-mono text-[10px] uppercase border border-blue-500/50">
          <div class="text-blue-400 font-black mb-1">${p.name}</div>
          <div>ID: ${p.id}</div>
          <div>COUNTRY: ${p.country_name}</div>
          <div>REGION: ${p.area_name || 'N/A'}</div>
          <div>SIZE: ${p.harbor_size || '---'} | TYPE: ${p.harbor_type || '---'}</div>
          <div class="mt-2 text-cyan-400 font-bold border-t border-white/10 pt-1 text-[8px] animate-pulse">ENABLE AIS TRACKING</div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedPortForAIS(p);
        mapInstance.flyTo([p.latitude, p.longitude], 12);
      });
      
      bounds.push([p.latitude, p.longitude]);
    });
    
    if (bounds.length > 0) {
      mapInstance.flyToBounds(bounds, { padding: [50, 50], duration: 1 });
    }
  };

  return (
    <div class="h-full w-full flex flex-col bg-bg_main overflow-hidden font-mono uppercase">
      {/* MAP AREA (70%) */}
      <div class="h-[70%] flex border-b border-border_main bg-zinc-900 relative">
        <div class="flex-1 relative">
           <div id="port-map-terminal" class="absolute inset-0"></div>
        
        {/* NAV OVERLAY */}
        <div class="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
           <div class="bg-black/90 p-3 border border-blue-500/20 backdrop-blur-md shadow-2xl min-w-[220px]">
              <div class="flex items-center justify-between gap-4 mb-2">
                <div class="flex items-center gap-2 text-[10px] font-black text-blue-400 tracking-widest">
                  <div class="w-2 h-2 bg-blue-500 animate-pulse"></div>
                  MARITIME INTELLIGENCE
                </div>
                <button 
                  onClick={fetchContinents}
                  class="text-[8px] bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-0.5 hover:bg-blue-500 hover:text-white transition-all"
                >
                  RESET GLOBAL
                </button>
                <button 
                  onClick={() => setMapMode(m => m === 'dark' ? 'satellite' : 'dark')}
                  class={`text-[8px] border px-2 py-0.5 transition-all ${mapMode() === 'satellite' ? 'bg-cyan-500 text-black border-cyan-500 font-black' : 'bg-white/10 border-white/20 text-white/60 hover:text-white'}`}
                >
                  {mapMode() === 'satellite' ? 'SAT ON' : 'SAT OFF'}
                </button>
              </div>

              <div class="text-[8px] text-white/40 mb-1 border-b border-white/5 pb-2 uppercase flex items-center gap-2">
                <span class="opacity-30">DOMAIN:</span>
                <span class="text-blue-400">MARITIME</span>
                <Show when={selectedContinent()}><span class="opacity-20">/</span> <span class="text-blue-400">{selectedContinent()}</span></Show>
                <Show when={selectedCountry()}><span class="opacity-20">/</span> <span class="text-blue-400">{selectedCountry()}</span></Show>
              </div>
              
              <div class="mt-2 flex flex-col gap-1">
                 <div class="text-[7px] text-text_secondary opacity-40">NAVIGATION LEVEL</div>
                 <div class="text-[10px] font-black text-white/80 tracking-[0.2em]">{viewLevel().toUpperCase()}</div>
              </div>
           </div>

           <div class="bg-black/90 px-3 py-1.5 border border-blue-500/10 backdrop-blur-md flex justify-between gap-4">
              <div class="text-[8px] text-white/40 italic">
                FACILITIES: {viewLevel() === 'port' ? ports().length : nodes().length}
              </div>
              <div class="text-[8px] text-blue-400 font-bold animate-pulse">
                SYSTEM LIVE
              </div>
           </div>
        </div>

        </div>

        {/* AIS SIDE PANEL */}
        <Show when={selectedPortForAIS()}>
          <div class="w-[350px] bg-black/90 border-l border-blue-500/20 backdrop-blur-xl flex flex-col animate-slide-left z-30">
             <div class="p-4 border-b border-blue-500/20 flex justify-between items-center bg-blue-500/5">
                <div class="flex flex-col">
                  <span class="text-[8px] font-black text-blue-400 tracking-widest uppercase italic leading-none">AIS TRACKING ACTIVE</span>
                  <span class="text-[10px] font-black text-white mt-1 truncate w-48">{selectedPortForAIS().name}</span>
                </div>
                <button 
                  onClick={() => setSelectedPortForAIS(null)}
                  class="text-[9px] font-black border border-white/10 px-2 py-1 hover:bg-white/10 hover:text-red-400 transition-all"
                >DISCONNECT</button>
             </div>
             
             <div class="flex-1 flex flex-col p-4 gap-4 overflow-y-auto win-scroll">
                <div class="border border-blue-500/30 bg-black h-[400px] shrink-0 relative overflow-hidden">
                   <iframe 
                      name="vesselfinder" 
                      id="vesselfinder" 
                      width="100%" 
                      height="400" 
                      frameborder="0" 
                      style="filter: grayscale(0.5) contrast(1.2) brightness(0.9) invert(0.05);"
                      src={`https://www.vesselfinder.com/aismap?zoom=13&lat=${selectedPortForAIS().latitude}&lon=${selectedPortForAIS().longitude}&width=100%25&height=400&names=true&mmsi=0&track=true&fleet=false&fleet_id=0&vtype=0&show_names=1&show_tz=0`}
                    ></iframe>
                </div>

                <div class="flex flex-col gap-1">
                   <div class="text-[8px] font-black text-blue-400/60 tracking-[0.2em]">SATELLITE VISUALS</div>
                   <div class="border border-white/10 p-1 bg-zinc-950 shadow-2xl relative group rounded-sm">
                        <iframe 
                          width="100%" 
                          height="200" 
                          frameborder="0" 
                          scrolling="no" 
                          class="grayscale-[20%] group-hover:grayscale-0 transition-all opacity-80"
                          src={`https://maps.google.com/maps?q=${selectedPortForAIS().latitude},${selectedPortForAIS().longitude}&hl=id&z=17&t=k&output=embed`}>
                        </iframe>
                        <div class="absolute bottom-2 right-2 bg-black/80 px-2 py-1 text-[8px] text-white/40 font-mono tracking-tighter border border-white/5">
                          SAT FEED // HD
                        </div>
                   </div>
                </div>
                
                <div class="flex flex-col gap-2">
                   <div class="text-[8px] font-black text-blue-400/60 tracking-[0.2em]">FACILITY DETAILS</div>
                   <div class="grid grid-cols-2 gap-2">
                      <div class="bg-white/5 p-2 rounded-sm border border-white/5">
                         <div class="text-[6px] text-white/30">HARBOR_SIZE</div>
                         <div class="text-[10px] font-bold text-white">{selectedPortForAIS().harbor_size || 'N/A'}</div>
                      </div>
                      <div class="bg-white/5 p-2 rounded-sm border border-white/5">
                         <div class="text-[6px] text-white/30">HARBOR_TYPE</div>
                         <div class="text-[10px] font-bold text-white">{selectedPortForAIS().harbor_type || 'N/A'}</div>
                      </div>
                      <div class="bg-white/5 p-2 rounded-sm border border-white/5">
                         <div class="text-[6px] text-white/30">CHART_REF</div>
                         <div class="text-[10px] font-bold text-white">{selectedPortForAIS().chart || 'N/A'}</div>
                      </div>
                      <div class="bg-white/5 p-2 rounded-sm border border-white/5">
                         <div class="text-[6px] text-white/30">PUBLICATION</div>
                         <div class="text-[10px] font-bold text-white">{selectedPortForAIS().publication || 'N/A'}</div>
                      </div>
                   </div>
                </div>
                
                <div class="mt-4 p-3 bg-blue-500/5 border border-blue-500/10 rounded-sm">
                   <div class="text-[7px] text-blue-400 font-bold uppercase mb-1 tracking-widest leading-none">Surveillance_Note</div>
                   <p class="text-[9px] leading-relaxed text-white/40 italic lowercase">
                     AIS data synchronized with main harbor coordinates. tracking vessels within a 15nm radius of {selectedPortForAIS().name}. 
                   </p>
                </div>
             </div>
             
             <div class="p-3 border-t border-white/5 bg-black text-[7px] text-white/20 font-mono flex justify-between">
                <span>RADAR_SYNC_OK</span>
                <span>DATA_BY_VESSELFINDER</span>
             </div>
          </div>
        </Show>
      </div>

      {/* DYNAMIC TABLE AREA (30%) */}
      <div class="h-[30%] flex flex-col bg-bg_main overflow-hidden border-t border-border_main">
        <div class="px-6 py-2 border-b border-border_main bg-bg_header flex justify-between items-center sticky top-0 z-10 shadow-lg">
          <h3 class="text-[9px] font-black text-blue-400 tracking-[0.2em] uppercase">MARITIME INFRASTRUCTURE AUDIT // {viewLevel()}</h3>
          <span class="text-[8px] text-text_secondary opacity-40 font-mono italic">LAST SYNC // {new Date().toISOString()}</span>
        </div>
        
        <div class="flex-1 overflow-y-auto win-scroll relative bg-bg_main">
          <Show when={isLoading()}>
            <div class="absolute inset-0 bg-black/50 z-20 flex items-center justify-center backdrop-blur-sm">
              <div class="text-[12px] font-black text-blue-400 animate-pulse tracking-[0.5em]">SYNCHRONIZING DATA...</div>
            </div>
          </Show>
          
          <table class="w-full text-left border-collapse table-fixed">
            <thead class="sticky top-0 bg-bg_sidebar z-10 border-b border-border_main shadow-sm">
              <Switch>
                <Match when={viewLevel() === 'continent'}>
                  <tr class="text-[8px] font-black text-text_secondary/80 uppercase tracking-tighter">
                    <th class="px-6 py-2">CONTINENT</th>
                    <th class="px-2 py-2">TOTAL PORTS</th>
                    <th class="px-2 py-2">COORDINATES</th>
                    <th class="px-6 py-2 text-right">ACTION</th>
                  </tr>
                </Match>
                <Match when={viewLevel() === 'country'}>
                  <tr class="text-[8px] font-black text-text_secondary/80 uppercase tracking-tighter">
                    <th class="px-6 py-2">CODE</th>
                    <th class="px-2 py-2">COUNTRY</th>
                    <th class="px-2 py-2">TOTAL PORTS</th>
                    <th class="px-2 py-2">COORDINATES</th>
                    <th class="px-6 py-2 text-right">ACTION</th>
                  </tr>
                </Match>
                <Match when={viewLevel() === 'port'}>
                  <tr class="text-[8px] font-black text-text_secondary/80 uppercase tracking-tighter">
                    <th class="px-6 py-2 w-1/3">PORT NAME</th>
                    <th class="px-2 py-2">REGION</th>
                    <th class="px-2 py-2">CHARTS / PUBLICATION</th>
                    <th class="px-2 py-2 text-right">LAT / LNG</th>
                    <th class="px-6 py-2 text-center w-24">DETAILS</th>
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
                    if (viewLevel() === 'port') fetchCountriesForContinent(selectedContinent());
                    else fetchContinents();
                  }}
                >
                  <td colspan="5" class="px-6 py-2">
                    <div class="flex items-center gap-2 text-white/40 group-hover:text-blue-400 transition-all italic text-[8px]">
                      <span class="font-black">←</span>
                      <span>RETURN TO {viewLevel() === 'port' ? 'COUNTRY' : 'GLOBAL'} LEVEL</span>
                    </div>
                  </td>
                </tr>
              </Show>

              <For each={viewLevel() === 'port' ? ports() : nodes()}>
                {(item, i) => (
                  <tr class="border-b border-border_main/30 hover:bg-blue-500/10 transition-colors group cursor-pointer" 
                      onClick={() => {
                        if (viewLevel() === 'continent') fetchCountriesForContinent(item.continent);
                        else if (viewLevel() === 'country') fetchPorts(item.code);
                        else mapInstance.flyTo([item.latitude, item.longitude], 12);
                      }}>
                    
                    <Switch>
                      <Match when={viewLevel() === 'continent'}>
                        <td class="px-6 py-2 font-black text-sky-400">{item.continent}</td>
                        <td class="px-2 py-2 text-white/60">{item.count} PORTS</td>
                        <td class="px-2 py-2 text-white/30 italic">
                          {Number(item.lat).toFixed(4)}, {Number(item.lon).toFixed(4)}
                        </td>
                        <td class="px-6 py-2 text-right">
                          <span class="text-[8px] border border-sky-500/20 px-2 py-1 text-sky-400 group-hover:bg-sky-500 group-hover:text-bg_main transition-all">VIEW DETAILS</span>
                        </td>
                      </Match>

                      <Match when={viewLevel() === 'country'}>
                        <td class="px-6 py-2 font-black text-emerald-400">{item.code}</td>
                        <td class="px-2 py-2 text-text_primary font-bold">{item.name}</td>
                        <td class="px-2 py-2 text-white/60">{item.count} NODES</td>
                        <td class="px-2 py-2 text-white/30 italic">
                          {Number(item.lat || 0).toFixed(4)}, {Number(item.lon || 0).toFixed(4)}
                        </td>
                        <td class="px-6 py-2 text-right">
                          <span class="text-[8px] border border-emerald-500/20 px-2 py-1 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-bg_main transition-all">VIEW PORTS</span>
                        </td>
                      </Match>

                      <Match when={viewLevel() === 'port'}>
                        <td class="px-6 py-2">
                          <div class="text-[10px] font-black text-text_primary group-hover:text-blue-400 transition-colors">{item.name}</div>
                          <div class="text-[8px] text-text_secondary opacity-40 uppercase">ID: {item.id}</div>
                        </td>
                        <td class="px-2 py-2">
                          <div class="text-[9px] font-bold text-blue-500">{item.area_name}</div>
                          <div class="text-[8px] text-text_secondary opacity-30">{item.country_name}</div>
                        </td>
                        <td class="px-2 py-2 text-[9px] text-text_secondary/60 uppercase">
                          {item.chart} / {item.publication}
                        </td>
                        <td class="px-2 py-2 text-text_secondary/40 text-right">
                          {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                        </td>
                        <td class="px-6 py-2 text-center">
                          <div class="text-[7px] bg-blue-500/10 text-blue-400 border border-blue-400/20 px-1 py-0.5">SIZE: {item.harbor_size}</div>
                        </td>
                      </Match>
                    </Switch>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
          
          <Show when={(viewLevel() === 'port' ? ports() : nodes()).length === 0}>
             <div class="h-full flex flex-col items-center justify-center p-32 opacity-20">
               <div class="text-[10px] font-mono uppercase tracking-[0.5em]">SYSTEM IDLE</div>
             </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
