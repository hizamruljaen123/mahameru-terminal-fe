import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';

export default function MilitaryPanel(props) {
  const [militaryFacilities, setMilitaryFacilities] = createSignal([]);
  const [policeFacilities, setPoliceFacilities] = createSignal([]);
  const [stats, setStats] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCountry, setSelectedCountry] = createSignal('');
  const [viewLevel, setViewLevel] = createSignal('global'); // 'global' or 'country'
  const [militaryCountryNodes, setMilitaryCountryNodes] = createSignal([]);
  const [policeCountryNodes, setPoliceCountryNodes] = createSignal([]);
  const [selectedFacility, setSelectedFacility] = createSignal(null);
  const [facilityNews, setFacilityNews] = createSignal([]);
  const [activeTab, setActiveTab] = createSignal('analytics'); // analytics, recon, dossier
  const [strengthData, setStrengthData] = createSignal(null);
  const [globalRankings, setGlobalRankings] = createSignal([]);
  const [wikiSummary, setWikiSummary] = createSignal(null);
  const [currentTime, setCurrentTime] = createSignal(new Date());
  const [isMapReady, setIsMapReady] = createSignal(false);
  const [viewPerspective, setViewPerspective] = createSignal('top');
  const [mapMode, setMapMode] = createSignal('satellite');
  const [infrastructureType, setInfrastructureType] = createSignal('all'); // all, military, police

  let mapInstance = null;
  let markers = [];
  let charts = { country: null };

  const filteredMilitary = () => {
    let list = militaryFacilities();
    if (searchQuery()) {
      const q = searchQuery().toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(q) || f.city.toLowerCase().includes(q) || f.country.toLowerCase().includes(q));
    }
    return list;
  };

  const filteredPolice = () => {
    let list = policeFacilities();
    if (searchQuery()) {
      const q = searchQuery().toLowerCase();
      list = list.filter(f => (f.hq_name?.toLowerCase().includes(q) || f.organization_name?.toLowerCase().includes(q) || f.city?.toLowerCase().includes(q) || f.country?.toLowerCase().includes(q)));
    }
    return list;
  };

  const combinedList = () => {
    const mil = filteredMilitary().map(f => ({ ...f, infraType: 'military' }));
    const pol = filteredPolice().map(f => ({ ...f, infraType: 'police' }));
    return [...mil, ...pol].sort((a, b) => a.country.localeCompare(b.country));
  };

  onMount(() => {
    const el = document.getElementById('military-infra-map');
    if (el) initMap(el);
    fetchCountryNodes();
    fetchStats();

    const clock = setInterval(() => setCurrentTime(new Date()), 1000);
    onCleanup(() => clearInterval(clock));
  });

  createEffect(() => {
    if (!isMapReady()) return;
    const level = viewLevel();
    let milData = level === 'global' ? militaryCountryNodes() : filteredMilitary();
    let polData = level === 'global' ? policeCountryNodes() : filteredPolice();
    
    renderMarkers(milData, polData);
  });

  onCleanup(() => {
    if (mapInstance) {
      try { mapInstance.remove(); } catch (e) { }
      mapInstance = null;
    }
  });

  const initMap = (el) => {
    if (mapInstance || !el) return;

    mapInstance = new window.maplibregl.Map({
      container: el,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [20, 20],
      zoom: 2,
      pitch: 0,
      bearing: 0,
      maxZoom: 19,
      antialias: true
    });

    mapInstance.on('load', () => {
      setIsMapReady(true);

      // Add 3D Building Layer (if vector style is active)
      if (mapInstance.getSource('openmaptiles') || mapInstance.getSource('osm')) {
        mapInstance.addLayer({
          'id': '3d-buildings',
          'source': 'openmaptiles',
          'source-layer': 'building',
          'type': 'fill-extrusion',
          'minzoom': 15,
          'paint': {
            'fill-extrusion-color': '#555',
            'fill-extrusion-height': ['get', 'render_height'],
            'fill-extrusion-base': ['get', 'render_min_height'],
            'fill-extrusion-opacity': 0.8
          }
        });
      }

      setTimeout(() => { mapInstance.resize(); }, 500);
    });

    createEffect(() => {
      const mode = mapMode();
      if (!mapInstance || !isMapReady()) return;

      if (mode === 'satellite') {
        mapInstance.setStyle({
          version: 8,
          sources: {
            'satellite': {
              type: 'raster',
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256
            }
          },
          layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
        });
      } else if (mode === 'dark') {
        mapInstance.setStyle('https://tiles.openfreemap.org/styles/dark');
      } else if (mode === 'terrain') {
        mapInstance.setStyle('https://tiles.openfreemap.org/styles/liberty');
      }

      // Re-add 3D buildings after style change if it's a vector style
      mapInstance.once('styledata', () => {
        if (!mapInstance.getLayer('3d-buildings') && mapInstance.getSource('openmaptiles')) {
          mapInstance.addLayer({
            'id': '3d-buildings',
            'source': 'openmaptiles',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
              'fill-extrusion-color': '#555',
              'fill-extrusion-height': ['get', 'render_height'],
              'fill-extrusion-base': ['get', 'render_min_height'],
              'fill-extrusion-opacity': 0.8
            }
          });
        }
      });
    });
  };

  const togglePerspective = () => {
    if (!mapInstance) return;
    const isTop = viewPerspective() === 'top';
    const newPersp = isTop ? 'tilt' : 'top';
    setViewPerspective(newPersp);

    // Switch to vector/terrain mode for 3D buildings when tilting
    if (newPersp === 'tilt' && mapMode() === 'satellite') {
      setMapMode('terrain');
    }

    if (newPersp === 'top') {
      mapInstance.flyTo({ pitch: 0, bearing: 0, duration: 1200 });
    } else {
      mapInstance.flyTo({ pitch: 65, bearing: 45, duration: 1200 });
    }
  };

  const fetchCountryNodes = async () => {
    setIsLoading(true);
    try {
      if (mapInstance) {
        mapInstance.flyTo({ zoom: 2, pitch: 0, bearing: 0, speed: 1.5 });
      }
      setViewPerspective('top');
      
      const [milRes, polRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_MILITARY_API}/api/military-infra/countries`),
        fetch(`${import.meta.env.VITE_MILITARY_API}/api/police-infra/countries`)
      ]);
      
      const milData = await milRes.json();
      const polData = await polRes.json();
      
      setMilitaryCountryNodes(milData);
      setPoliceCountryNodes(polData);
      setViewLevel('global');
      setSelectedCountry('');
      setMilitaryFacilities([]);
      setPoliceFacilities([]);
      setSelectedFacility(null);
    } catch (e) { } finally { setIsLoading(false); }
  };

  const fetchFacilities = async (countryName = '') => {
    setIsLoading(true);
    try {
      let milUrl = `${import.meta.env.VITE_MILITARY_API}/api/military-infra?limit=1000`;
      let polUrl = `${import.meta.env.VITE_MILITARY_API}/api/police-infra?limit=1000`;
      if (countryName) {
        milUrl += `&country=${encodeURIComponent(countryName)}`;
        polUrl += `&country=${encodeURIComponent(countryName)}`;
      }

      const [milRes, polRes] = await Promise.all([
        fetch(milUrl),
        fetch(polUrl)
      ]);
      
      const milData = await milRes.json();
      const polData = await polRes.json();
      
      setMilitaryFacilities(milData);
      setPoliceFacilities(polData);
      
      if (countryName) setSelectedCountry(countryName);

      setViewLevel('country');
      if (milData.length === 1 && polData.length === 0) {
        handleFacilitySelection(milData[0], 'military');
      } else if (polData.length === 1 && milData.length === 0) {
        handleFacilitySelection(polData[0], 'police');
      }
    } catch (e) {
      console.error("Fetch facilities failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStrengthData = async (countryName) => {
    try {
      if (!countryName) {
        setStrengthData(null);
        return;
      }
      const res = await fetch(`${import.meta.env.VITE_MILITARY_API}/api/military-infra/strength?country=${encodeURIComponent(countryName)}`);
      const data = await res.json();
      setStrengthData(data);
    } catch (e) {
      console.error("Strength fetch failed", e);
    }
  };

  const fetchStats = async () => {
    try {
      const statsRes = await fetch(`${import.meta.env.VITE_MILITARY_API}/api/infra-combined/stats`);
      const statsData = await statsRes.json();
      setStats(statsData);

      const rankRes = await fetch(`${import.meta.env.VITE_MILITARY_API}/api/military-infra/strength`);
      const rankData = await rankRes.json();
      setGlobalRankings(rankData.slice(0, 50)); // Top 50 global rankings
    } catch (e) { }
  };

  createEffect(() => {
    const country = selectedCountry();
    if (country) fetchStrengthData(country);
  });

  const fetchFacilityDossier = async (fac, type) => {
    setFacilityNews([]);
    try {
      const name = type === 'military' ? fac.name : fac.hq_name;
      const query = `${type === 'military' ? 'Military' : 'Police'} Headquarters "${name}" ${fac.country || ''}`;
      const res = await fetch(`${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setFacilityNews(data.news || []);
    } catch (e) { }
  };

  const fetchWikiSummary = async (fac, type) => {
    setWikiSummary(null);
    try {
      const name = type === 'military' ? fac.name : fac.hq_name;
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`);
      const data = await res.json();

      if (data.type === 'standard') {
        setWikiSummary(data);
      } else {
        const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + ' ' + fac.country)}&format=json&origin=*`);
        const searchData = await searchRes.json();
        if (searchData.query?.search?.length > 0) {
          const title = searchData.query.search[0].title;
          const sRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
          const sData = await sRes.json();
          setWikiSummary(sData);
        }
      }
    } catch (e) { }
  };

  const renderMarkers = (milList, polList) => {
    if (!mapInstance) return;
    markers.forEach(m => m.remove());
    markers = [];

    const createMarker = (item, type) => {
      let lat = item.lat || item.latitude;
      let lon = item.lon || item.longitude;
      if (!lat || !lon) return;

      // Displacement for global pins to avoid overlapping
      if (viewLevel() === 'global' && type === 'police') {
        lon += 0.5; // Offset police pin 
      }

      const isSelected = selectedFacility()?.id === item.id && selectedFacility()?.infraType === type;
      const el = document.createElement('div');
      
      const themeColor = type === 'military' ? '#dc2626' : '#2563eb'; // Red for military, Blue for police
      const shadowColor = type === 'military' ? 'rgba(220,38,38,0.5)' : 'rgba(37,99,235,0.5)';
      const name = type === 'military' ? (item.name || item.hq_name) : (item.hq_name || item.name);

      if (viewLevel() === 'global') {
        el.className = 'cursor-pointer group';
        el.innerHTML = `
          <div class="relative flex items-center justify-center w-8 h-8">
            <div class="absolute inset-0 border rounded-full animate-ping" style="border-color: ${themeColor}66;"></div>
            <div class="w-6 h-6 bg-black/90 border-2 rounded-full flex items-center justify-center transition-all duration-300" style="border-color: ${themeColor}; box-shadow: 0 0 15px ${shadowColor};">
               <div class="w-1.5 h-1.5 rounded-full" style="background-color: ${themeColor};"></div>
            </div>
            <div class="absolute -top-6 whitespace-nowrap bg-black/90 px-2 py-0.5 border border-white/10 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity z-50">
               <span class="text-[7px] font-black text-white uppercase tracking-widest">${item.name} (${type === 'military' ? 'MIL' : 'POL'})</span>
            </div>
          </div>
        `;
        const m = new window.maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(mapInstance);

        el.addEventListener('click', () => {
          fetchFacilities(item.name);
          mapInstance.flyTo({ center: [lon, lat], zoom: 6, speed: 1.2 });
        });
        markers.push(m);
      } else {
        if (isSelected) {
          el.className = 'cursor-pointer z-[100]';
          el.innerHTML = `
            <div class="relative flex flex-col items-center">
              <div class="bg-black/90 border border-[${themeColor}]/50 px-3 py-1 mb-2 shadow-[0_0_20px_${shadowColor}] backdrop-blur-md">
                 <div class="text-[10px] font-black text-white whitespace-nowrap uppercase tracking-widest">${name}</div>
              </div>
              <div class="w-10 h-10 flex items-center justify-center filter drop-shadow-[0_0_10px_${themeColor}]">
                <svg viewBox="0 0 24 24" class="w-8 h-8" style="fill: ${themeColor}; stroke: #fff; stroke-width: 1.5;">
                   <path d="M12 0c-4.198 0-8 3.403-8 7.602 0 4.198 3.469 9.21 8 16.398 4.531-7.188 8-12.2 8-16.398 0-4.199-3.801-7.602-8-7.602zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z"/>
                </svg>
              </div>
            </div>
          `;
        } else {
          el.className = 'cursor-pointer z-[80]';
          el.innerHTML = `
            <div class="w-4 h-4 border-2 border-white rounded-full transition-all duration-300 hover:scale-150" style="background-color: ${themeColor}; box-shadow: 0 0 15px ${shadowColor};"></div>
          `;
        }

        const m = new window.maplibregl.Marker({
          element: el,
          anchor: isSelected ? 'bottom' : 'center'
        })
          .setLngLat([lon, lat])
          .addTo(mapInstance);

        el.addEventListener('click', () => { handleFacilitySelection(item, type); });
        markers.push(m);
      }
    };

    milList.forEach(item => createMarker(item, 'military'));
    polList.forEach(item => createMarker(item, 'police'));
  };

  const handleFacilitySelection = (fac, type) => {
    setSelectedFacility({ ...fac, infraType: type });
    setActiveTab('dossier');
    fetchFacilityDossier(fac, type);
    fetchWikiSummary(fac, type);
    if (mapInstance) {
      mapInstance.flyTo({ center: [fac.longitude, fac.latitude], zoom: 15, duration: 1500 });
    }
  };



  return (
    <div class="flex-1 flex flex-col bg-[#020202] overflow-hidden text-zinc-400 font-sans">
      {/* Header Bar - Condensed */}
      <div class="h-10 border-b border-white/5 flex items-center px-4 gap-4 bg-[#050505] z-50 shrink-0">
        <button onClick={() => props.onBack()} class="text-zinc-600 hover:text-white transition-colors">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="flex items-center gap-2">
          <div class="w-1 h-4 bg-red-600"></div>
          <div>
            <h1 class="text-[11px] font-black text-white uppercase tracking-[0.2em] leading-none">MILITARY_SURVEILLANCE_v5.0</h1>
          </div>
        </div>

        <div class="flex-1 max-w-sm relative ml-auto">
          <input
            type="text"
            placeholder="FILTER NODES..."
            class="w-full bg-white/[0.02] border border-white/5 px-3 py-1 text-[9px] outline-none focus:border-red-600/30 transition-all font-bold placeholder:text-zinc-800 uppercase tracking-widest"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div class="flex items-center gap-4 border-l border-white/5 pl-4">
          <div class="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{currentTime().toLocaleTimeString([], { hour12: false })}</div>
          <div class="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_5px_#dc2626]"></div>
        </div>
      </div>

      <div class="flex-1 flex overflow-hidden">
        {/* Left Control Panel - Ultra Dense */}
        <div class="w-[380px] flex flex-col border-r border-white/5 bg-[#050505] z-20">
          <div class="flex h-8 border-b border-white/5">
            <button
              onClick={() => setActiveTab('analytics')}
              class={`flex-1 text-[8px] font-black uppercase tracking-[0.2em] transition-all ${activeTab() === 'analytics' ? 'text-zinc-300 bg-white/5' : 'text-zinc-700 hover:text-zinc-400'}`}
            >
              STATS
            </button>
            <button
              onClick={() => setActiveTab('recon')}
              class={`flex-1 text-[8px] font-black uppercase tracking-[0.2em] border-x border-white/5 transition-all ${activeTab() === 'recon' ? 'text-red-500 bg-red-500/5' : 'text-zinc-700 hover:text-zinc-400'}`}
            >
              RECON_LIST
            </button>
            <button
              onClick={() => setActiveTab('dossier')}
              class={`flex-1 text-[8px] font-black uppercase tracking-[0.2em] transition-all ${activeTab() === 'dossier' ? 'text-yellow-500 bg-yellow-500/5' : 'text-zinc-700 hover:text-zinc-400'}`}
            >
              DOSSIER
            </button>
          </div>

          <div class="flex-1 overflow-y-auto win-scroll">
            <Show when={activeTab() === 'analytics'}>
              <div class="p-4 space-y-6">
                <div class="grid grid-cols-2 gap-2">
                  <div class="bg-white/[0.01] border border-white/5 p-3 relative group">
                    <div class="text-[7px] text-zinc-600 font-bold uppercase tracking-widest">MILITARY_NODES</div>
                    <div class="text-xl font-black text-white mt-1">{stats()?.military_total || 0}</div>
                  </div>
                  <div class="bg-white/[0.01] border border-white/5 p-3">
                    <div class="text-[7px] text-zinc-600 font-bold uppercase tracking-widest">POLICE_NODES</div>
                    <div class="text-xl font-black text-blue-500 mt-1">{stats()?.police_total || 0}</div>
                  </div>
                </div>

                <Show when={strengthData()}>
                  {(data) => (
                    <div class="space-y-3 p-3 bg-red-600/5 border border-red-600/20 animate-in fade-in slide-in-from-top-2">
                      <div class="flex items-center justify-between border-b border-white/5 pb-2">
                        <span class="text-[9px] font-black text-red-500 uppercase tracking-widest">{data().country} CAPABILITY</span>
                        <span class="text-[7px] font-black text-zinc-600 uppercase">RANK: {data().gfp_rank}</span>
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                          <div class="flex justify-between items-center text-[7px] font-black text-zinc-500 uppercase">
                            <span>Personnel</span>
                            <span class="text-white">{(data().total_personnel / 1000000).toFixed(1)}M</span>
                          </div>
                          <div class="flex justify-between items-center text-[7px] font-black text-zinc-500 uppercase">
                            <span>Active</span>
                            <span class="text-white">{(data().active_personnel / 1000).toFixed(0)}K</span>
                          </div>
                        </div>
                        <div class="space-y-2">
                          <div class="flex justify-between items-center text-[7px] font-black text-zinc-500 uppercase">
                            <span>Defense Budget</span>
                            <span class="text-white">${(data().defense_budget_usd / 1000000000).toFixed(1)}B</span>
                          </div>
                          <div class="flex justify-between items-center text-[7px] font-black text-zinc-500 uppercase">
                            <span>Power Index</span>
                            <span class="text-red-500 font-bold">{data().power_index}</span>
                          </div>
                        </div>
                      </div>

                      <div class="pt-2 grid grid-cols-3 gap-2 border-t border-white/5">
                        <div class="flex flex-col items-center">
                          <span class="text-[10px] font-black text-white">{data().tanks}</span>
                          <span class="text-[5px] font-black text-zinc-600 uppercase tracking-widest">Tanks</span>
                        </div>
                        <div class="flex flex-col items-center">
                          <span class="text-[10px] font-black text-white">{data().total_aircraft}</span>
                          <span class="text-[5px] font-black text-zinc-600 uppercase tracking-widest">Aircraft</span>
                        </div>
                        <div class="flex flex-col items-center">
                          <span class="text-[10px] font-black text-white">{data().total_naval_vessels}</span>
                          <span class="text-[5px] font-black text-zinc-600 uppercase tracking-widest">Naval</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Show>

                <div class="space-y-1">
                  <div class="text-[7px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-2 px-1">REGION_DEPLOYMENT</div>
                  <div class="max-h-[300px] overflow-y-auto win-scroll pr-1">
                    <For each={militaryCountryNodes()}>
                      {(node) => (
                        <button
                          onClick={() => { fetchFacilities(node.name); mapInstance?.flyTo({ center: [node.lon, node.lat], zoom: 6 }); }}
                          class={`w-full flex items-center justify-between p-2 transition-all group ${selectedCountry() === node.name ? 'bg-red-600/10 border-l-2 border-red-600' : 'hover:bg-white/[0.03]'}`}
                        >
                          <div class="flex items-center gap-2">
                            <span class={`text-[9px] font-bold tracking-tight uppercase ${selectedCountry() === node.name ? 'text-red-500' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{node.name}</span>
                          </div>
                          <div class="flex items-center gap-2 text-[7px] font-black">
                            <span class="text-zinc-700 group-hover:text-red-500 uppercase">{node.facility_count} MIL</span>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <div class="space-y-1 mt-4">
                  <div class="text-[7px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-2 px-1">GLOBAL_FIREPOWER_RANKINGS</div>
                  <div class="max-h-[300px] overflow-y-auto win-scroll pr-1 divide-y divide-white/5 bg-white/[0.01]">
                    <For each={globalRankings()}>
                      {(rank) => (
                        <div class="flex items-center justify-between p-2 group hover:bg-white/[0.03]">
                          <div class="flex items-center gap-2">
                            <span class="text-[7px] font-black text-zinc-800 w-4">{rank.gfp_rank}</span>
                            <span class="text-[8px] font-bold text-zinc-400 group-hover:text-white uppercase">{rank.country}</span>
                          </div>
                          <div class="flex items-center gap-3">
                            <span class="text-[7px] font-black text-red-900">{rank.power_index} PI</span>
                            <Show when={rank.country === "Indonesia"}>
                              <div class="w-1 h-1 rounded-full bg-red-600 animate-pulse"></div>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={activeTab() === 'recon'}>
              <div class="p-4 space-y-4">
                <div class="text-[7px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 px-1 border-b border-white/10 pb-1 flex justify-between items-center">
                  <span>UNIFIED_INTELLIGENCE {selectedCountry() ? ` - ${selectedCountry()}` : ''}</span>
                  <div class="flex gap-2">
                    <span class="text-red-600">MIL</span>
                    <span class="text-blue-500">POL</span>
                  </div>
                </div>
                <div class="space-y-1 max-h-[calc(100vh-180px)] overflow-y-auto win-scroll pr-1">
                  <For each={combinedList()} fallback={<div class="text-[8px] text-zinc-800 p-4">NO ASSETS DETECTED</div>}>
                    {(fac) => (
                      <button 
                        onClick={() => handleFacilitySelection(fac, fac.infraType)}
                        class={`w-full text-left p-2 border border-white/5 transition-all group ${selectedFacility()?.id === fac.id && selectedFacility()?.infraType === fac.infraType ? (fac.infraType === 'military' ? 'bg-red-600/10 border-red-600/50' : 'bg-blue-600/10 border-blue-600/50') : 'hover:bg-white/5'}`}
                      >
                         <div class="flex items-center gap-2 mb-0.5">
                           <div class={`w-1 h-1 rounded-full ${fac.infraType === 'military' ? 'bg-red-600' : 'bg-blue-600'}`}></div>
                           <div class="text-[9px] font-black text-white group-hover:text-zinc-300 transition-colors uppercase truncate">{fac.infraType === 'military' ? fac.name : fac.hq_name}</div>
                         </div>
                         <div class="text-[7px] font-bold text-zinc-600 uppercase tracking-widest pl-3 truncate">
                           {fac.infraType === 'police' ? fac.organization_name : `${fac.city || 'ADMIN_REGION'}, ${fac.country}`}
                         </div>
                         <Show when={fac.infraType === 'police'}>
                            <div class="text-[6px] font-black text-zinc-700 uppercase pl-3 mt-0.5">{fac.city}, {fac.country}</div>
                         </Show>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <Show when={activeTab() === 'dossier'}>
              <div class="flex flex-col h-full animate-in fade-in duration-300">
                <Show when={selectedFacility()} fallback={
                  <div class="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-20">
                    <span class="text-[8px] font-black tracking-[0.5em] uppercase">WAITING FOR TARGET SELECTION</span>
                  </div>
                }>
                  {(() => {
                    const fac = selectedFacility();
                    return (
                      <div class="flex flex-col h-full">
                        <div class="p-4 border-b border-white/5 bg-white/[0.01]">
                          <div class="flex items-center justify-between mb-2">
                            <span class={`text-[7px] font-black uppercase tracking-[0.2em] ${fac.infraType === 'military' ? 'text-red-500' : 'text-blue-500'}`}>
                              {fac.infraType === 'military' ? 'STRATEGIC_MILITARY_ASSET' : 'PUBLIC_SAFETY_HQ'}
                            </span>
                            <span class="text-[7px] font-mono text-zinc-600">{fac.latitude.toFixed(3)}N / {fac.longitude.toFixed(3)}E</span>
                          </div>
                          <h2 class="text-[16px] font-black text-white uppercase tracking-tight leading-tight mb-2">
                            {fac.infraType === 'military' ? fac.name : fac.hq_name}
                          </h2>
                          <Show when={fac.infraType === 'police'}>
                            <div class="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-2">{fac.organization_name}</div>
                          </Show>
                          <div class="flex items-center gap-2">
                            <div class={`w-1 h-1 rounded-full ${fac.infraType === 'military' ? 'bg-red-600' : 'bg-blue-600'}`}></div>
                            <span class="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{fac.city || 'N/A'}, {fac.country}</span>
                          </div>
                        </div>

                        <div class="flex-1 overflow-y-auto win-scroll p-3 space-y-4">
                          <Show when={wikiSummary()}>
                            {(wiki) => (
                              <div class="bg-white/[0.02] border border-white/5 p-3 space-y-2 animate-in fade-in duration-500">
                                <div class="flex items-center gap-2 mb-1">
                                  <div class={`w-1 h-3 ${fac.infraType === 'military' ? 'bg-red-600' : 'bg-blue-600'}`}></div>
                                  <span class="text-[7px] font-black text-zinc-500 uppercase tracking-[0.2em]">WIKIPEDIA_INTEL</span>
                                </div>
                                <Show when={wiki().thumbnail}>
                                  <img src={wiki().thumbnail.source} class="w-full h-32 object-cover border border-white/5 opacity-80" />
                                </Show>
                                <p class="text-[9px] text-zinc-400 leading-relaxed font-medium italic">
                                  {wiki().extract}
                                </p>
                                <a href={wiki().content_urls?.desktop?.page} target="_blank" class={`text-[7px] font-black uppercase tracking-widest block ${fac.infraType === 'military' ? 'text-red-700 hover:text-red-500' : 'text-blue-700 hover:text-blue-500'}`}>Full Intelligence File →</a>
                              </div>
                            )}
                          </Show>

                          <Show when={fac.infraType === 'police'}>
                            <div class="bg-white/[0.02] border border-white/5 p-3 space-y-2">
                               <div class="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">HQ_METADATA</div>
                               <div class="space-y-1.5">
                                  <div class="flex flex-col">
                                    <span class="text-[6px] text-zinc-500 uppercase">Address</span>
                                    <span class="text-[8px] text-zinc-300">{fac.address || 'DATA_REDACTED'}</span>
                                  </div>
                                  <Show when={fac.website}>
                                    <div class="flex flex-col">
                                      <span class="text-[6px] text-zinc-500 uppercase">Official Channel</span>
                                      <a href={fac.website} target="_blank" class="text-[8px] text-blue-400 truncate">{fac.website}</a>
                                    </div>
                                  </Show>
                                  <Show when={fac.notes}>
                                    <div class="flex flex-col">
                                      <span class="text-[6px] text-zinc-500 uppercase">Operator Remarks</span>
                                      <span class="text-[8px] text-zinc-300 italic">{fac.notes}</span>
                                    </div>
                                  </Show>
                               </div>
                            </div>
                          </Show>

                          <div class="space-y-1">
                            <div class="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-3 px-1 border-b border-white/5 pb-1">SIGINT_INTERCEPTS</div>
                            <For each={facilityNews()}>
                              {(news) => (
                                <a href={news.link} target="_blank" class="block p-2 hover:bg-white/[0.03] border-l border-transparent hover:border-red-600/50 transition-all group">
                                  <div class="text-[9px] font-bold text-zinc-300 group-hover:text-white leading-tight mb-1 uppercase">
                                    {news.title}
                                  </div>
                                  <div class="flex items-center justify-between text-[6px] font-black text-zinc-700 uppercase tracking-widest">
                                    <span>{news.source?.name}</span>
                                    <span class="text-red-900 group-hover:text-red-600">{news.publishedAt && !isNaN(new Date(news.publishedAt)) ? new Date(news.publishedAt).toLocaleDateString() : 'REAL_TIME'}</span>
                                  </div>
                                </a>
                              )}
                            </For>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </Show>
              </div>
            </Show>
          </div>

          <div class="h-6 px-4 border-t border-white/5 flex items-center justify-between bg-black/80">
            <div class="flex items-center gap-1.5">
              <div class="w-1 h-1 rounded-full bg-red-600"></div>
              <span class="text-[6px] font-black text-zinc-700 uppercase tracking-widest">STREAM: LIVE</span>
            </div>
            <span class="text-[6px] font-black text-zinc-800 uppercase tracking-widest">LATENCY: 8ms</span>
          </div>
        </div>

        {/* Map Visualization */}
        <div class="flex-1 relative bg-black">
          <div id="military-infra-map" class="w-full h-full"></div>

          <div class="absolute bottom-4 left-4 z-30 flex flex-col gap-1 w-56">
            <Show when={viewLevel() === 'country'}>
              <div class="bg-black/60 backdrop-blur-md border border-white/5 p-2 flex flex-col max-h-[250px] shadow-2xl">
                <div class="text-[7px] font-black text-red-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">{selectedCountry()} NODES</div>
                <div class="overflow-y-auto flex-1 win-scroll space-y-0.5">
                  <For each={combinedList()}>
                    {(fac) => (
                      <button onClick={() => handleFacilitySelection(fac, fac.infraType)} class={`w-full text-left px-2 py-1 text-[8px] font-bold uppercase transition-all ${selectedFacility()?.id === fac.id && selectedFacility()?.infraType === fac.infraType ? (fac.infraType === 'military' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white') : 'text-zinc-500 hover:bg-white/5'}`}>
                        <div class="truncate">{fac.infraType === 'military' ? fac.name : fac.hq_name}</div>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>

          <div class="absolute top-4 right-4 z-30 flex flex-col gap-2">
            <div class="flex flex-col overflow-hidden bg-black/60 backdrop-blur-md border border-white/5">
              {['satellite', 'dark', 'terrain'].map(m => (
                <button onClick={() => setMapMode(m)} class={`w-8 h-8 flex items-center justify-center text-[7px] font-black transition-all ${mapMode() === m ? 'bg-red-600 text-white' : 'text-zinc-600 hover:bg-white/5'}`}>{m.slice(0, 3).toUpperCase()}</button>
              ))}
            </div>
            <div class="flex flex-col overflow-hidden bg-black/60 backdrop-blur-md border border-white/5">
              <button onClick={togglePerspective} class={`w-8 h-8 flex items-center justify-center text-[7px] font-black transition-all ${viewPerspective() === 'top' ? 'bg-red-600 text-white' : 'text-zinc-600 hover:bg-white/5'}`}>2D</button>
              <button onClick={togglePerspective} class={`w-8 h-8 flex items-center justify-center text-[7px] font-black transition-all ${viewPerspective() === 'tilt' ? 'bg-red-600 text-white' : 'text-zinc-600 hover:bg-white/5'}`}>3D</button>
            </div>
          </div>

          <Show when={isLoading()}>
            <div class="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-[100] flex items-center justify-center">
              <div class="text-[7px] font-black text-red-600 uppercase tracking-[0.5em] animate-pulse">DOWNLOADING_TACTICAL_BUFFER...</div>
            </div>
          </Show>

          <div class="absolute top-4 left-4 z-30 pointer-events-none">
            <div class="bg-black/40 backdrop-blur-sm border-l border-red-600 px-3 py-1.5 shadow-2xl">
              <span class="text-[12px] font-black text-white uppercase tracking-tight">
                {selectedCountry() || 'GLOBAL_MONITOR'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
