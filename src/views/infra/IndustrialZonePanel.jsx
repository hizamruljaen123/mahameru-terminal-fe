import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';
import { generateLogisticsLines, getMidpoint, estimateTravelTime, fetchRoadRoute } from '../../utils/geoUtils';

export default function IndustrialZonePanel() {
  const [zones, setZones] = createSignal([]);
  const [stats, setStats] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCountry, setSelectedCountry] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal('');
  const [viewLevel, setViewLevel] = createSignal('global'); // 'global' or 'country'
  const [countryNodes, setCountryNodes] = createSignal([]);
  const [selectedZone, setSelectedZone] = createSignal(null);
  const [zoneNews, setZoneNews] = createSignal([]);
  const [activeTab, setActiveTab] = createSignal('analytics'); // analytics, dossier
  const [dossierSubTab, setDossierSubTab] = createSignal('summary'); // summary, logistics, env, intel
  const [currentTime, setCurrentTime] = createSignal(new Date());
  const [zoneWeather, setZoneWeather] = createSignal(null);
  const [isLoadingWeather, setIsLoadingWeather] = createSignal(false);
  const [nearbyLogistics, setNearbyLogistics] = createSignal({ airports: [], ports: [], power_plants: [] });
  const [isMapReady, setIsMapReady] = createSignal(false);
  const [viewPerspective, setViewPerspective] = createSignal('top'); // top, tilt
  const [nearbyFacilities, setNearbyFacilities] = createSignal([]);
  const [isScanningFacilities, setIsScanningFacilities] = createSignal(false);
  const [reconFocusCoord, setReconFocusCoord] = createSignal(null);

  let mapInstance = null;
  let markers = [];
  let infraMarkers = [];
  let facilityMarkers = [];
  let connectionLabels = [];
  let activeRouteLabels = [];
  let charts = { country: null, sector: null };

  const [mapMode, setMapMode] = createSignal('satellite');

  const weatherCodeMap = {
    0: 'Clear sky',
    1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    95: 'Thunderstorm',
  };

  const getWeatherEmoji = (code) => {
    if (code === 0) return '☀️';
    if (code <= 3) return '🌤️';
    if (code <= 48) return '🌫️';
    if (code <= 55) return '🌦️';
    if (code <= 65) return '🌧️';
    if (code <= 75) return '❄️';
    if (code <= 95) return '🌩️';
    return '☁️';
  };

  const filteredZones = () => {
    let list = zones();
    if (searchQuery()) {
        const q = searchQuery().toLowerCase();
        list = list.filter(z => z.name.toLowerCase().includes(q) || (z.sector || '').toLowerCase().includes(q));
    }
    if (selectedCountry()) {
        list = list.filter(z => z.country === selectedCountry());
    }
    if (selectedCategory()) {
        list = list.filter(z => getOwnershipCategory(z.ownership) === selectedCategory());
    }
    return list;
  };

  onMount(() => {
    const el = document.getElementById('industrial-zone-map');
    if (el) initMap(el);
    fetchCountryNodes();
    fetchStats();
    
    const clock = setInterval(() => setCurrentTime(new Date()), 1000);
    onCleanup(() => clearInterval(clock));
  });

  createEffect(() => {
    const list = filteredZones();
    const nodes = countryNodes();
    const level = viewLevel();
    renderMarkers(level === 'global' ? nodes : list);
  });

  onCleanup(() => {
    if (mapInstance) {
      try { mapInstance.remove(); } catch (e) {}
      mapInstance = null;
    }
    Object.values(charts).forEach(c => c?.dispose());
  });

  const initMap = (el) => {
    if (mapInstance || !el) return;
    
    mapInstance = new window.maplibregl.Map({
      container: el,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '© ESRI World Imagery'
          }
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm'
        }]
      },
      center: [100, 15],
      zoom: 3,
      pitch: 0, // START FLAT
      bearing: 0,
      maxZoom: 18,
      antialias: true
    });

    mapInstance.on('load', () => {
      setIsMapReady(true);
      setTimeout(() => { mapInstance.resize(); }, 500);
    });

    createEffect(() => {
      const mode = mapMode();
      if (!mapInstance || !isMapReady()) return;
      
      let tiles = [];
      if (mode === 'dark') {
          tiles = ['https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'];
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
        }, mapInstance.getLayer('logistics-lines-layer') ? 'logistics-lines-layer' : undefined);
      } catch (e) {
        console.warn("Style update skipped: map not ready", e);
      }
    });
  };

  const fetchWeatherForZone = async (lat, lon) => {
    setIsLoadingWeather(true);
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure`);
      const data = await res.json();
      setZoneWeather(data.current);
    } catch (e) {
      console.error('Weather fetch failed', e);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const getAirportStyle = (type) => {
    switch (type) {
      case 'small_airport': return { color: '#10b981', shadow: 'rgba(16,185,129,0.5)', icon: '✈️' };
      case 'medium_airport': return { color: '#f59e0b', shadow: 'rgba(245,158,11,0.5)', icon: '✈️' };
      case 'large_airport': return { color: '#8b5cf6', shadow: 'rgba(139,92,246,0.5)', icon: '✈️' };
      case 'closed': return { color: '#6b7280', shadow: 'rgba(107,114,128,0.5)', icon: '✖️' };
      case 'heliport': return { color: '#06b6d4', shadow: 'rgba(6,182,212,0.5)', icon: '🚁' };
      case 'seaplane_base': return { color: '#3b82f6', shadow: 'rgba(59,130,246,0.5)', icon: '⚓' };
      case 'balloonport': return { color: '#ec4899', shadow: 'rgba(236,72,153,0.5)', icon: '🎈' };
      default: return { color: '#f97316', shadow: 'rgba(249,115,22,0.5)', icon: '✈️' };
    }
  };

  const showInfraPopup = (data, type) => {
    let titleColor = 'text-orange-400';
    let icon = '✈️';
    let detailsHtml = '';

    if (type === 'airport') {
      titleColor = 'text-orange-400';
      icon = '✈️';
      detailsHtml = `
        <div class="grid grid-cols-2 gap-2 mt-2 border-t border-white/10 pt-2">
          <div><div class="text-[7px] text-white/40 uppercase">TYPE</div><div class="text-[9px] text-white/80 font-bold">${data.type || 'N/A'}</div></div>
          <div><div class="text-[7px] text-white/40 uppercase">ELEVATION</div><div class="text-[9px] text-white/80 font-bold">${data.elevation_ft || 0} FT</div></div>
          <div><div class="text-[7px] text-white/40 uppercase">MUNICIPALITY</div><div class="text-[9px] text-white/80 font-bold">${data.municipality || 'N/A'}</div></div>
          <div><div class="text-[7px] text-white/40 uppercase">COORD</div><div class="text-[9px] text-white/80 font-bold">${data.lat?.toFixed(3)}, ${data.lon?.toFixed(3)}</div></div>
        </div>
        ${data.wikipedia_link ? `<a href="${data.wikipedia_link}" target="_blank" class="block text-[8px] text-blue-400 mt-2 uppercase font-black hover:text-white transition-colors underline">DATABASE_RECON_WIKI</a>` : ''}
      `;
    } else if (type === 'port') {
      titleColor = 'text-cyan-400';
      icon = '🚢';
      detailsHtml = `
        <div class="grid grid-cols-2 gap-2 mt-2 border-t border-white/10 pt-2">
          <div><div class="text-[7px] text-white/40 uppercase">HARBOR_TYPE</div><div class="text-[9px] text-white/80 font-bold">${data.type || 'N/A'}</div></div>
          <div><div class="text-[7px] text-white/40 uppercase">DEPTH_CHANNEL</div><div class="text-[9px] text-white/80 font-bold">${data.channel_depth || 'N/A'}</div></div>
          <div><div class="text-[7px] text-white/40 uppercase">SHELTER</div><div class="text-[9px] text-white/80 font-bold">${data.shelter_afforded_code || 'N/A'}</div></div>
          <div><div class="text-[7px] text-white/40 uppercase">SIZE_CODE</div><div class="text-[9px] text-white/80 font-bold">${data.harbor_size_code || 'N/A'}</div></div>
        </div>
      `;
    } else if (type === 'power_plant') {
      titleColor = 'text-yellow-400';
      icon = '⚡';
      detailsHtml = `
        <div class="grid grid-cols-2 gap-2 mt-2 border-t border-white/10 pt-2">
          <div><div class="text-[7px] text-white/40 uppercase">GENERATION</div><div class="text-[9px] text-white/80 font-bold">${data.capacity || 0} MW</div></div>
          <div><div class="text-[7px] text-white/40 uppercase">PRIMARY_FUEL</div><div class="text-[9px] text-white/80 font-bold uppercase">${data.type || 'N/A'}</div></div>
          <div><div class="text-[7px] text-white/40 uppercase">COMMISSIONING</div><div class="text-[9px] text-white/80 font-bold">${data.commissioning_year || 'N/A'}</div></div>
          <div class="col-span-2"><div class="text-[7px] text-white/40 uppercase">OPERATOR</div><div class="text-[9px] text-white/80 font-bold uppercase truncate">${data.owner || 'N/A'}</div></div>
        </div>
      `;
    }

    const popupHtml = `
      <div class="bg-zinc-950/95 border border-white/10 p-4 min-w-[200px] shadow-2xl backdrop-blur-md">
        <div class="flex items-center gap-3 mb-1">
          <div class="text-xl">${icon}</div>
          <div class="min-w-0">
            <div class="${titleColor} text-[10px] font-black uppercase tracking-widest leading-tight truncate">${data.name}</div>
            <div class="text-[7px] text-white/30 font-bold mt-0.5 tracking-[0.2em] uppercase">${type.toUpperCase()} DATA</div>
          </div>
        </div>
        ${detailsHtml}
      </div>
    `;

    new window.maplibregl.Popup({ closeButton: false, offset: 25 })
      .setLngLat([data.lon, data.lat])
      .setHTML(popupHtml)
      .addTo(mapInstance);
  };

  const renderInfraMarkers = (data) => {
    if (!mapInstance) return;
    infraMarkers.forEach(m => m.remove());
    infraMarkers = [];

    // AIRPORTS (VARYING COLORS BASED ON TYPE)
    data.airports.forEach(air => {
      const style = getAirportStyle(air.type);
      const el = document.createElement('div');
      el.className = 'cursor-pointer group';
      el.innerHTML = `
        <div class="relative flex flex-col items-center">
            <div class="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center transition-transform duration-300 group-hover:scale-125" 
                 style="background-color: ${style.color}; box-shadow: 0 0 15px ${style.shadow};">
               <span class="text-[12px]">${style.icon}</span>
            </div>
            <div class="absolute -top-12 bg-black/90 px-2 py-1 border rounded-sm opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity"
                 style="border-color: ${style.color}4d;">
               <div class="text-[7px] font-black text-white uppercase">${air.name}</div>
               <div class="text-[6px] font-bold uppercase" style="color: ${style.color};">VIEW ROUTE</div>
            </div>
        </div>
      `;
      const m = new window.maplibregl.Marker({ element: el })
        .setLngLat([air.lon, air.lat])
        .addTo(mapInstance);
      
      el.addEventListener('click', () => { 
        renderRealRoute(air); 
        setReconFocusCoord({ lat: air.lat, lon: air.lon });
        showInfraPopup(air, 'airport');
      });
      infraMarkers.push(m);
    });

    // PORTS (TEAL/BLUE)
    data.ports.forEach(port => {
      const el = document.createElement('div');
      el.className = 'cursor-pointer group';
      el.innerHTML = `
        <div class="relative flex flex-col items-center">
            <div class="w-8 h-8 bg-cyan-600 rounded-full border-2 border-white flex items-center justify-center shadow-[0_0_15px_rgba(8,145,178,0.5)] group-hover:scale-125 transition-transform duration-300">
               <span class="text-[12px]">⚓</span>
            </div>
            <div class="absolute -top-10 bg-black/90 px-2 py-0.5 border border-cyan-500/30 rounded-sm opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
               <div class="text-[7px] font-black text-white uppercase">${port.name}</div>
               <div class="text-[6px] text-cyan-500 font-bold uppercase">CALCULATE ROAD ROUTE</div>
            </div>
        </div>
      `;
      const m = new window.maplibregl.Marker({ element: el })
        .setLngLat([port.lon, port.lat])
        .addTo(mapInstance);

      el.addEventListener('click', () => { 
        renderRealRoute(port); 
        setReconFocusCoord({ lat: port.lat, lon: port.lon });
        showInfraPopup(port, 'port');
      });
      infraMarkers.push(m);
    });

    // POWER PLANTS (YELLOW)
    data.power_plants?.forEach(plant => {
      const el = document.createElement('div');
      el.className = 'group cursor-pointer';
      el.innerHTML = `
        <div class="relative flex flex-col items-center">
          <div class="bg-yellow-500/80 border-2 border-white/50 w-7 h-7 flex items-center justify-center text-white text-[12px] group-hover:scale-125 transition-transform duration-300 shadow-[0_0_15px_rgba(234,179,8,0.5)]">
            ⚡
          </div>
          <div class="mt-2 text-[8px] font-black text-white bg-black/80 px-2 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 uppercase tracking-tighter">
            ${plant.name} [${plant.capacity}MW]
          </div>
        </div>
      `;

      const m = new window.maplibregl.Marker({ element: el })
        .setLngLat([plant.lon, plant.lat])
        .addTo(mapInstance);

      el.addEventListener('click', () => { 
        renderRealRoute(plant); 
        setReconFocusCoord({ lat: plant.lat, lon: plant.lon });
        showInfraPopup(plant, 'power_plant');
      });
      infraMarkers.push(m);
    });
  };

  const renderFacilityMarkers = (data) => {
    if (!mapInstance || !Array.isArray(data)) {
        console.warn("renderFacilityMarkers: data is not an array", data);
        return;
    }
    facilityMarkers.forEach(m => m.remove());
    facilityMarkers = [];

    data.forEach(fac => {
      const el = document.createElement('div');
      el.className = 'cursor-pointer group z-40';
      
      let icon = '🏥';
      let color = '#ef4444'; // default red for hospital
      
      if (fac.type === 'bank') { icon = '🏦'; color = '#22c55e'; }
      if (fac.type === 'fuel') { icon = '⛽'; color = '#eab308'; }
      if (fac.type === 'bus_station') { icon = '🚌'; color = '#3b82f6'; }
      if (fac.type === 'place_of_worship') { 
         icon = '🕌'; color = '#a855f7'; 
         const rel = fac.tags?.religion?.toLowerCase();
         if (rel === 'christian') icon = '⛪';
         if (rel === 'hindu') icon = '🛕';
         if (rel === 'buddhist' || rel === 'taoist' || rel === 'chinese_folk') icon = '🏯';
      }

      el.innerHTML = `
        <div class="relative flex flex-col items-center">
            <div class="w-6 h-6 rounded-full border border-white/50 flex items-center justify-center transition-all duration-300 group-hover:scale-125" 
                 style="background-color: ${color}; box-shadow: 0 0 10px ${color}80;">
               <span class="text-[10px]">${icon}</span>
            </div>
            <div class="absolute -top-10 bg-black/95 px-2 py-0.5 border border-white/10 rounded-sm opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-all">
               <div class="text-[7px] font-black text-white uppercase">${fac.name}</div>
               <div class="text-[5px] font-bold uppercase" style="color: ${color};">${fac.type?.replace('_', ' ')}</div>
            </div>
        </div>
      `;
      const m = new window.maplibregl.Marker({ element: el })
        .setLngLat([fac.lon, fac.lat])
        .addTo(mapInstance);
      
      el.addEventListener('click', () => {
         renderRealRoute(fac);
         setReconFocusCoord({ lat: fac.lat, lon: fac.lon });
      });
      
      facilityMarkers.push(m);
    });
  };

  const handlePerformScan = async () => {
    const zone = selectedZone();
    if (!zone || isScanningFacilities()) return;
    
    setIsScanningFacilities(true);
    setNearbyFacilities([]);
    facilityMarkers.forEach(m => m.remove());
    facilityMarkers = [];

    try {
      const res = await fetch(`${import.meta.env.VITE_INDUSTRIAL_ZONE_API}/api/industrial-zones/pois?zone_id=${zone.id}&lat=${zone.latitude}&lon=${zone.longitude}`);
      const data = await res.json();
      
      if (data.facilities) {
          setNearbyFacilities(data.facilities);
          renderFacilityMarkers(data.facilities);
      }
    } catch (e) {
      console.error("Facility scan failed", e);
    } finally {
      setIsScanningFacilities(false);
    }
  };

  const renderRealRoute = async (dest) => {
    const origin = selectedZone();
    if (!origin || !mapInstance || !isMapReady()) return;
    
    const route = await fetchRoadRoute(origin, dest);
    if (!route) return;

    // HIDE STRAIGHT LINES
    if (mapInstance.getLayer('logistics-lines-layer')) mapInstance.setLayoutProperty('logistics-lines-layer', 'visibility', 'none');
    if (mapInstance.getLayer('logistics-lines-glow')) mapInstance.setLayoutProperty('logistics-lines-glow', 'visibility', 'none');
    connectionLabels.forEach(m => m.remove());
    connectionLabels = [];

    // CLEAN OLD ROUTE LABELS
    activeRouteLabels.forEach(m => m.remove());
    activeRouteLabels = [];

    if (mapInstance.getSource('active-route')) {
      mapInstance.getSource('active-route').setData(route.geometry);
      // FORCE VISIBILITY ON IN CASE PREVIOUSLY HIDDEN
      if (mapInstance.getLayer('active-route-layer')) mapInstance.setLayoutProperty('active-route-layer', 'visibility', 'visible');
      if (mapInstance.getLayer('active-route-glow')) mapInstance.setLayoutProperty('active-route-glow', 'visibility', 'visible');
    } else {
      mapInstance.addSource('active-route', { type: 'geojson', data: route.geometry });
      
      // NEON PINK GLOW (THICKER)
      mapInstance.addLayer({
        id: 'active-route-glow',
        type: 'line',
        source: 'active-route',
        layout: { 'visibility': 'visible' },
        paint: {
          'line-color': '#f43f5e',
          'line-width': 14,
          'line-opacity': 0.25,
          'line-blur': 6
        }
      });
      // NEON PINK CORE (THICKER)
      mapInstance.addLayer({
        id: 'active-route-layer',
        type: 'line',
        source: 'active-route',
        layout: { 'visibility': 'visible' },
        paint: {
          'line-color': '#f43f5e',
          'line-width': 5,
          'line-opacity': 1
        }
      });
    }

    // FIND MIDPOINT OF ROAD GEOMETRY
    const coords = route.geometry.coordinates;
    const midIdx = Math.floor(coords.length / 2);
    const midCoord = coords[midIdx];

    const el = document.createElement('div');
    el.className = 'connection-label pointer-events-none z-50';
    el.innerHTML = `
      <div class="bg-[#f43f5e] px-2 py-0.5 border border-white/20 text-[9px] font-black text-white whitespace-nowrap shadow-2xl skew-x-[-12deg]">
         REAL_DIST: ${route.distance.toFixed(1)}KM // ETA: ${Math.round(route.duration)} MIN
      </div>
    `;

    const m = new window.maplibregl.Marker({ element: el })
      .setLngLat(midCoord)
      .addTo(mapInstance);
    activeRouteLabels.push(m);
  };

  const renderLogisticsConnections = (data, origin) => {
    if (!mapInstance || !isMapReady() || !origin) return;
    
    connectionLabels.forEach(m => m.remove());
    connectionLabels = [];

    const allTargets = [...data.airports, ...data.ports];
    const geojson = generateLogisticsLines(origin, allTargets);

    if (mapInstance.getSource('logistics-lines')) {
      mapInstance.getSource('logistics-lines').setData(geojson);
    } else {
      mapInstance.addSource('logistics-lines', { type: 'geojson', data: geojson });
      
      // GLOW LAYER (OUTER)
      mapInstance.addLayer({
        id: 'logistics-lines-glow',
        type: 'line',
        source: 'logistics-lines',
        paint: {
          'line-color': '#0ea5e9',
          'line-width': 10,
          'line-opacity': 0.2,
          'line-blur': 4
        }
      });

      // CORE LAYER (INNER)
      mapInstance.addLayer({
        id: 'logistics-lines-layer',
        type: 'line',
        source: 'logistics-lines',
        paint: {
          'line-color': '#0ea5e9',
          'line-width': 2.5,
          'line-dasharray': [6, 4],
          'line-opacity': 0.8
        }
      });
    }
  };

  const fetchNearbyLogistics = async (lat, lon, zone) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_INDUSTRIAL_ZONE_API}/api/industrial-zones/logistics?lat=${lat}&lon=${lon}&radius=100`);
      const data = await res.json();
      setNearbyLogistics(data);
      renderInfraMarkers(data);

      if (mapInstance && isMapReady()) {
        if (mapInstance.getLayer('logistics-lines-layer')) mapInstance.setLayoutProperty('logistics-lines-layer', 'visibility', 'visible');
        if (mapInstance.getLayer('logistics-lines-glow')) mapInstance.setLayoutProperty('logistics-lines-glow', 'visibility', 'visible');
        if (mapInstance.getLayer('active-route-layer')) mapInstance.setLayoutProperty('active-route-layer', 'visibility', 'none');
        if (mapInstance.getLayer('active-route-glow')) mapInstance.setLayoutProperty('active-route-glow', 'visibility', 'none');
        activeRouteLabels.forEach(m => m.remove());
        activeRouteLabels = [];
      }

      renderLogisticsConnections(data, zone);
    } catch (e) {
      console.error('Logistics nodes fetch failed', e);
    }
  };

  const togglePerspective = () => {
    if (!mapInstance) return;
    const isTop = viewPerspective() === 'top';
    const newPersp = isTop ? 'tilt' : 'top';
    setViewPerspective(newPersp);
    
    if (newPersp === 'top') {
      // IF ROUTE IS ACTIVE, FOCUS ON IT
      const routeSource = mapInstance.getSource('active-route');
      if (routeSource && mapInstance.getLayer('active-route-layer') && mapInstance.getLayoutProperty('active-route-layer', 'visibility') !== 'none') {
        const coords = routeSource._data.coordinates;
        const bounds = coords.reduce((acc, coord) => acc.extend(coord), new window.maplibregl.LngLatBounds(coords[0], coords[0]));
        mapInstance.fitBounds(bounds, { padding: 80, pitch: 0, bearing: 0, duration: 1500 });
        return;
      }

      mapInstance.flyTo({ pitch: 0, bearing: 0, duration: 1200 });
    } else {
      mapInstance.flyTo({ pitch: 65, bearing: 45, duration: 1200 });
    }
  };

  const fetchCountryNodes = async () => {
    setIsLoading(true);
    try {
      if (mapInstance) {
          mapInstance.flyTo({ zoom: 3, pitch: 0, bearing: 0, speed: 1.5 });
          if (mapInstance.getLayer('logistics-lines-glow')) mapInstance.removeLayer('logistics-lines-glow');
          if (mapInstance.getLayer('logistics-lines-layer')) mapInstance.removeLayer('logistics-lines-layer');
          if (mapInstance.getSource('logistics-lines')) mapInstance.removeSource('logistics-lines');
          if (mapInstance.getLayer('active-route-glow')) mapInstance.removeLayer('active-route-glow');
          if (mapInstance.getLayer('active-route-layer')) mapInstance.removeLayer('active-route-layer');
          if (mapInstance.getSource('active-route')) mapInstance.removeSource('active-route');
      }
      setViewPerspective('top');
      infraMarkers.forEach(m => m.remove());
      infraMarkers = [];
      connectionLabels.forEach(m => m.remove());
      connectionLabels = [];
      const res = await fetch(`${import.meta.env.VITE_INDUSTRIAL_ZONE_API}/api/industrial-zones/countries`);
      const data = await res.json();
      setCountryNodes(data);
      setViewLevel('global');
      setSelectedCountry('');
      setZones([]);
      setZoneWeather(null);
      setNearbyLogistics({ airports: [], ports: [], power_plants: [] });
      setNearbyFacilities([]);
      facilityMarkers.forEach(m => m.remove());
      facilityMarkers = [];
    } catch (e) {} finally { setIsLoading(false); }
  };

  const fetchZones = async (countryName = '') => {
    setIsLoading(true);
    try {
      let url = `${import.meta.env.VITE_INDUSTRIAL_ZONE_API}/api/industrial-zones?limit=1000`;
      if (countryName) url += `&country=${encodeURIComponent(countryName)}`;
      
      const res = await fetch(url);
      const data = await res.json();
      setZones(data);
      setViewLevel('country');
      if (countryName) setSelectedCountry(countryName);
    } catch (e) {
        console.error("Fetch zones failed", e);
    } finally {
        setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_INDUSTRIAL_ZONE_API}/api/industrial-zones/stats`);
      const data = await res.json();
      setStats(data);
      renderCharts();
    } catch (e) {}
  };

  const fetchZoneDossier = async (zone) => {
    setZoneNews([]);
    try {
      const query = `Industrial Zone "${zone.name}" ${zone.country || ''}`;
      const res = await fetch(`${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setZoneNews(data.news || []);
    } catch (e) {}
  };

  const getOwnershipCategory = (ownership) => {
    if (!ownership) return 'UNKNOWN';
    const o = ownership.toLowerCase();
    
    // Check for Negara-Swasta (Kemitraan/Joint)
    if (o.includes('negara') && (o.includes('swasta') || o.includes('swalta')) || o.includes('kemitraan') || o.includes('joint') || o.includes('sez')) {
        return 'NEGARA-SWASTA';
    }
    
    // Check for Negara (Public/SOE)
    if (o.includes('negara') || o.includes('bumn') || o.includes('pemerintah') || o.includes('royal commission') || o.includes('zonescorp') || o.includes('qapco') || o.includes('qatarenergy') || o.includes('ad ports') || o.includes('posco') || o.includes('nippon') || o.includes('salzgitter')) {
        return 'NEGARA';
    }
    
    // Check for Swasta (Private)
    if (o.includes('swasta') || o.includes('swalta') || o.includes('ftz') || o.includes('dp world') || o.includes('afz') || o.includes('edb')) {
        return 'SWASTA';
    }
    
    return 'OTHER';
  };

  const renderMarkers = (dataList) => {
    if (!mapInstance) return;
    markers.forEach(m => m.remove());
    markers = [];
    
    dataList.forEach(item => {
      const lat = item.lat || item.latitude;
      const lon = item.lon || item.longitude;
      if (!lat || !lon) return;

      const isSelected = selectedZone()?.id === item.id;
      const el = document.createElement('div');
      
      if (viewLevel() === 'global') {
        el.className = 'cursor-pointer group';
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="absolute inset-0 bg-text_accent animate-ping opacity-20 rounded-full"></div>
            <div class="w-10 h-10 bg-black/90 border-2 border-text_accent rounded-full flex flex-col items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform duration-300">
               <span class="text-[10px] font-black text-text_accent leading-none">${item.zone_count}</span>
               <span class="text-[5px] text-white/40 font-bold uppercase leading-tight mt-0.5">NODES</span>
            </div>
            <div class="absolute -bottom-8 whitespace-nowrap bg-black/80 px-2 py-0.5 border border-white/10 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
               <span class="text-[8px] font-black text-white uppercase">${item.name}</span>
            </div>
          </div>
        `;
        const m = new window.maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(mapInstance);
        
        el.addEventListener('click', () => {
          fetchZones(item.name);
          mapInstance.flyTo({ center: [lon, lat], zoom: 6, speed: 1.2 });
        });
        markers.push(m);
      } else {
        const cat = getOwnershipCategory(item.ownership);
        let color = '#94a3b8';
        if (cat === 'SWASTA') color = '#3b82f6';
        if (cat === 'NEGARA') color = '#ef4444';
        if (cat === 'NEGARA-SWASTA') color = '#a855f7';

        if (isSelected) {
          // PROFESSIONAL TEARDROP PIN FOR SELECTED (NAME ABOVE PIN)
          el.className = 'cursor-pointer z-50';
          el.innerHTML = `
            <div class="relative flex flex-col items-center">
              <div class="bg-black/90 border-l-4 border-l-text_accent px-3 py-1 mb-1 shadow-2xl backdrop-blur-md">
                 <div class="text-[9px] font-black text-white whitespace-nowrap uppercase tracking-widest">${item.name}</div>
              </div>
              <div class="w-10 h-10 flex items-center justify-center drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
                <svg viewBox="0 0 24 24" class="w-full h-full" style="fill: ${color}; stroke: #fff; stroke-width: 1;">
                   <path d="M12 0c-4.198 0-8 3.403-8 7.602 0 4.198 3.469 9.21 8 16.398 4.531-7.188 8-12.2 8-16.398 0-4.199-3.801-7.602-8-7.602zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z"/>
                </svg>
              </div>
            </div>
          `;
        } else {
          // CIRCULAR PULSE FOR OTHERS
          el.className = 'marker-pulse cursor-pointer';
          el.style.width = '12px';
          el.style.height = '12px';
          el.style.backgroundColor = color;
          el.style.border = '2px solid white';
          el.style.borderRadius = '50%';
          el.style.boxShadow = `0 0 10px ${color}`;
        }
        
        const m = new window.maplibregl.Marker({ 
          element: el,
          anchor: isSelected ? 'bottom' : 'center'
        })
          .setLngLat([lon, lat])
          .addTo(mapInstance);
        
        el.addEventListener('click', () => { handleZoneSelection(item); });
        markers.push(m);
      }
    });
  };

  const renderCharts = () => {
    const s = stats();
    if (!s) return;
    
    setTimeout(() => {
      const up = (id, key, opt) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (!charts[key]) charts[key] = window.echarts.init(el);
        charts[key].setOption({ backgroundColor: 'transparent', ...opt });
      };

      if (s.by_country) {
        up('country-dist-chart', 'country', {
          tooltip: { trigger: 'item' },
          series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 4, borderColor: '#000', borderWidth: 2 },
            label: { show: false },
            data: s.by_country.map(item => ({ value: item.count, name: item.country || 'Unknown' }))
          }]
        });
      }

      if (s.by_sector) {
        up('sector-dist-chart', 'sector', {
          tooltip: { trigger: 'axis' },
          grid: { left: '3%', right: '4%', bottom: '3%', top: '5%', containLabel: true },
          xAxis: { type: 'value', splitLine: { show: false }, axisLabel: { show: false } },
          yAxis: { 
            type: 'category', 
            data: s.by_sector.map(item => (item.sector || 'N/A').substring(0, 15)),
            axisLabel: { fontSize: 8, color: '#999' }
          },
          series: [{
            type: 'bar',
            data: s.by_sector.map(item => item.count),
            itemStyle: { color: '#0ea5e9' }
          }]
        });
      }
    }, 200);
  };

  const clearRealRoute = () => {
    if (!mapInstance || !isMapReady()) return;
    
    if (mapInstance.getLayer('active-route-layer')) mapInstance.setLayoutProperty('active-route-layer', 'visibility', 'none');
    if (mapInstance.getLayer('active-route-glow')) mapInstance.setLayoutProperty('active-route-glow', 'visibility', 'none');
    
    activeRouteLabels.forEach(m => m.remove());
    activeRouteLabels = [];

    if (mapInstance.getLayer('logistics-lines-layer')) mapInstance.setLayoutProperty('logistics-lines-layer', 'visibility', 'visible');
    if (mapInstance.getLayer('logistics-lines-glow')) mapInstance.setLayoutProperty('logistics-lines-glow', 'visibility', 'visible');
    
    const zone = selectedZone();
    const logistics = nearbyLogistics();
    if (zone && (logistics.airports.length > 0 || logistics.ports.length > 0)) {
      renderLogisticsConnections(logistics, zone);
    }
  };

  const handleZoneSelection = (zone) => {
    setSelectedZone(zone);
    setActiveTab('dossier');
    fetchZoneDossier(zone);
    fetchWeatherForZone(zone.latitude, zone.longitude);
    fetchNearbyLogistics(zone.latitude, zone.longitude, zone);
    setReconFocusCoord({ lat: zone.latitude, lon: zone.longitude });
    setNearbyFacilities([]);
    facilityMarkers.forEach(m => m.remove());
    facilityMarkers = [];
    setViewPerspective('tilt');
    
    if (mapInstance) {
      mapInstance.flyTo({
        center: [zone.longitude, zone.latitude],
        zoom: 16.5,
        pitch: 65,
        bearing: 45,
        speed: 1.5,
        essential: true
      });
    }
  };

   return (
    <div class="h-full w-full flex bg-bg_main overflow-hidden font-mono uppercase">
      {/* LEFT SECTION: MAP + TABLE */}
      <div class="flex-1 flex flex-col min-w-0 border-r border-border_main">
        {/* MAP AREA (70%) */}
        <div class="h-[70%] bg-zinc-900 relative border-b border-border_main">
           <div id="industrial-zone-map" class="absolute inset-0"></div>

           {/* FLOATING HUD CONTROLS */}
           <div class="absolute top-4 right-4 z-[1000] flex flex-col gap-3">
              <div class="bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                 <div class="group relative">
                    <button onClick={clearRealRoute} class="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all rounded">
                      <span class="text-xs">🔄</span>
                    </button>
                    <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">RESET VIEW</div>
                 </div>
                 <div class="h-px bg-white/5 mx-1"></div>
                 <div class="group relative">
                    <button onClick={togglePerspective} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${viewPerspective() === 'top' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                      <span class="text-xs">⏹️</span>
                    </button>
                    <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">2D VIEW</div>
                 </div>
                 <div class="group relative">
                    <button onClick={togglePerspective} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${viewPerspective() === 'tilt' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                      <span class="text-xs">📐</span>
                    </button>
                    <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">3D VIEW</div>
                 </div>
              </div>

              <div class="bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                 <div class="group relative">
                    <button onClick={() => setMapMode('dark')} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'dark' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                      <span class="text-xs">🌑</span>
                    </button>
                    <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">DARK MODE</div>
                 </div>
                 <div class="group relative">
                    <button onClick={() => setMapMode('terrain')} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'terrain' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                      <span class="text-xs">⛰️</span>
                    </button>
                    <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">TERRAIN</div>
                 </div>
                 <div class="group relative">
                    <button onClick={() => setMapMode('satellite')} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapMode() === 'satellite' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                      <span class="text-xs">🛰️</span>
                    </button>
                    <div class="absolute right-10 top-1.5 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-50">SATELLITE</div>
                 </div>
              </div>
           </div>
        </div>

        {/* TABLE AREA (30%) */}
        <div class="h-[30%] flex flex-col bg-bg_main overflow-hidden">
          <div class="px-6 py-2 border-b border-border_main bg-bg_header flex justify-between items-center sticky top-0 z-10 shadow-lg">
            <div class="flex items-center gap-6">
              <Show when={viewLevel() === 'country'}>
                 <button onClick={fetchCountryNodes} class="group flex items-center gap-2 px-3 py-1 bg-black border border-white/10 hover:border-text_accent transition-all">
                   <span class="text-[12px] text-text_accent transition-transform">←</span>
                   <span class="text-[8px] font-black text-white/60 group-hover:text-white uppercase">BACK TO GLOBAL</span>
                 </button>
              </Show>
              <h3 class="text-[9px] font-black text-text_accent tracking-[0.2em] uppercase">
                {viewLevel() === 'global' ? 'GLOBAL INDUSTRIAL NODES' : `${selectedCountry()} CLUSTER AUDIT`}
              </h3>
              <div class="h-4 w-px bg-white/10"></div>
              <div class="flex items-center gap-4">
                {/* CATEGORIES */}
                <button onClick={() => setSelectedCategory(selectedCategory() === 'NEGARA' ? '' : 'NEGARA')} class={`flex items-center gap-2 px-2 py-1 border rounded-sm ${selectedCategory() === 'NEGARA' ? 'bg-[#ef4444]/20 border-[#ef4444]' : 'border-transparent opacity-60'}`}>
                  <span class="w-2 h-2 rounded-full bg-[#ef4444]"></span>
                  <span class="text-[7px] text-white/80 font-bold uppercase">NEGARA</span>
                </button>
                <button onClick={() => setSelectedCategory(selectedCategory() === 'SWASTA' ? '' : 'SWASTA')} class={`flex items-center gap-2 px-2 py-1 border rounded-sm ${selectedCategory() === 'SWASTA' ? 'bg-[#3b82f6]/20 border-[#3b82f6]' : 'border-transparent opacity-60'}`}>
                  <span class="w-2 h-2 rounded-full bg-[#3b82f6]"></span>
                  <span class="text-[7px] text-white/80 font-bold uppercase">SWASTA</span>
                </button>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <input type="text" placeholder="FILTER_RECORDS..." onInput={(e) => { setSearchQuery(e.currentTarget.value); fetchZones(); }} class="bg-black/40 border border-white/10 px-3 py-1 text-[9px] text-white outline-none focus:border-text_accent/50 w-48 font-bold" />
            </div>
          </div>

          <div class="flex-1 overflow-y-auto win-scroll bg-black/20 relative">
            <Show when={isLoading()}>
              <div class="absolute inset-0 bg-black/50 z-20 flex items-center justify-center backdrop-blur-sm shadow-inner">
                <div class="text-[12px] font-black text-text_accent animate-pulse tracking-[0.5em]">SYNCHRONIZING DATA...</div>
              </div>
            </Show>
            <table class="w-full text-left border-collapse table-fixed">
              <thead class="sticky top-0 bg-bg_sidebar z-10 border-b border-border_main">
                <tr class="text-[8px] font-black text-text_secondary/80 uppercase">
                  <th class="px-6 py-2 w-1/3">ZONE NAME</th>
                  <th class="px-2 py-2">SECTOR</th>
                  <th class="px-2 py-2">OWNERSHIP</th>
                  <th class="px-6 py-2 text-right">COORDINATES</th>
                </tr>
              </thead>
              <tbody class="text-[10px] font-mono">
                <For each={filteredZones()}>
                  {(z) => (
                    <tr onClick={() => handleZoneSelection(z)} class={`border-b border-border_main/30 hover:bg-text_accent/10 transition-colors group cursor-pointer ${selectedZone()?.id === z.id ? 'bg-text_accent/5 border-l-2 border-l-text_accent' : ''}`}>
                      <td class="px-6 py-2">
                        <div class="text-[9px] font-black text-white group-hover:text-text_accent truncate">{z.name}</div>
                        <div class="text-[7px] text-white/20 uppercase mt-0.5">{z.country}</div>
                      </td>
                      <td class="px-2 py-2">
                         <span class="text-[7px] border border-white/5 px-1 py-0.5 opacity-60 uppercase">{z.sector?.substring(0, 15)}...</span>
                      </td>
                      <td class="px-2 py-2 text-white/40 text-[8px] uppercase">{z.ownership?.substring(0, 12)}...</td>
                      <td class="px-6 py-2 text-right text-text_secondary/40 italic text-[8px]">{Number(z.latitude).toFixed(3)}, {Number(z.longitude).toFixed(3)}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR: ASSET_DOSSIER_v4.0 */}
      <Show when={selectedZone()}>
        <div class="w-[400px] flex flex-col bg-bg_sidebar border-l border-text_accent/20 animate-in slide-in-from-right duration-500 shadow-[-10px_0_40px_rgba(0,0,0,0.5)] z-50 relative overflow-hidden">
           {/* SIDEPANEL HEADER */}
           <div class="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
              <div class="flex items-center gap-2">
                 <div class="w-1.5 h-4 bg-text_accent"></div>
                 <span class="text-[9px] font-black text-white tracking-[0.2em] uppercase">ZONE DOSSIER</span>
              </div>
              <button onClick={() => setSelectedZone(null)} class="text-white/20 hover:text-white transition-colors p-1 text-lg">✕</button>
           </div>

           <div class="p-6 bg-black/40 border-b border-white/5">
              <h2 class="text-xl font-black text-white leading-tight uppercase mb-2">{selectedZone().name}</h2>
              <div class="flex flex-wrap gap-2">
                 <span class="text-[8px] font-black text-text_accent bg-text_accent/10 px-2 py-1 rounded-sm tracking-widest border border-text_accent/20 uppercase">{selectedZone().country}</span>
                 <span class="text-[8px] text-white/40 font-mono py-1">UID: {selectedZone().id}</span>
              </div>
           </div>

           {/* TABS CONTROLS */}
           <div class="flex border-b border-white/5 bg-zinc-950/60 sticky top-[95px] z-10">
              <For each={['SUMMARY', 'LOGISTICS', 'ENV', 'INTEL']}>
                 {(tab) => (
                    <button onClick={() => setDossierSubTab(tab.toLowerCase())}
                       class={`flex-1 py-3 text-[8px] font-black tracking-widest transition-all relative ${dossierSubTab() === tab.toLowerCase() ? 'text-text_accent bg-text_accent/5' : 'text-white/20 hover:text-white/60'}`}>
                       {tab}
                       <Show when={dossierSubTab() === tab.toLowerCase()}>
                          <div class="absolute bottom-0 left-0 w-full h-1 bg-text_accent shadow-[0_0_10px_#0ea5e9]"></div>
                       </Show>
                    </button>
                 )}
              </For>
           </div>

           <div class="flex-1 overflow-y-auto win-scroll bg-black/10">
              <div class="p-6">
                 <Show when={dossierSubTab() === 'summary'}>
                    <div class="space-y-4 animate-in fade-in duration-300">
                       <div class="bg-white/5 p-4 border border-white/5">
                          <div class="text-[7px] text-text_accent font-black uppercase mb-1.5 opacity-60 tracking-widest">OWNERSHIP</div>
                          <div class="text-[11px] text-white font-bold uppercase">{selectedZone().ownership || 'NOT_SPECIFIED'}</div>
                       </div>
                       <div class="bg-white/5 p-4 border border-white/5">
                          <div class="text-[7px] text-text_accent font-black uppercase mb-1.5 opacity-60 tracking-widest">SECTOR</div>
                          <div class="text-[10px] text-white/90 leading-relaxed uppercase">{selectedZone().sector || 'GENERAL_INDUSTRIAL'}</div>
                       </div>
                       <div class="bg-white/5 p-4 border border-white/5">
                          <div class="text-[7px] text-text_accent font-black uppercase mb-2 tracking-widest">GEOSPATIAL DATA</div>
                          <div class="flex flex-col gap-1 text-[9px] font-mono text-white/60">
                             <div>LATITUDE: {selectedZone().latitude}</div>
                             <div>LONGITUDE: {selectedZone().longitude}</div>
                          </div>
                       </div>
                    </div>
                 </Show>

                 <Show when={dossierSubTab() === 'logistics'}>
                     <div class="space-y-6 animate-in fade-in duration-300">
                        <div class="bg-blue-600/5 border border-white/5 p-4 rounded-sm">
                           <div class="flex items-center justify-between mb-4">
                              <div class="text-[9px] font-black text-white/60 tracking-widest uppercase">PUBLIC FACILITIES</div>
                              <button 
                                 onClick={handlePerformScan} 
                                 disabled={isScanningFacilities()}
                                 class={`px-4 py-1.5 text-[8px] font-black border transition-all flex items-center gap-2 ${isScanningFacilities() ? 'bg-white/5 border-white/10 text-white/20 animate-pulse' : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-white'}`}>
                                 <span class="text-xs">{isScanningFacilities() ? '⏳' : '📡'}</span>
                                 {isScanningFacilities() ? 'SCANNING...' : 'SCAN FACILITIES'}
                              </button>
                           </div>

                           <Show when={nearbyFacilities().length > 0}>
                              <div class="max-h-[300px] overflow-y-auto win-scroll mt-4 pr-1">
                                 <div class="grid grid-cols-1 gap-1.5">
                                    <For each={nearbyFacilities()}>
                                       {(fac) => {
                                          let color = 'text-red-400';
                                          let icon = '🏥';
                                          
                                          if (fac.type === 'bank') { icon = '🏦'; color = 'text-green-400'; }
                                          if (fac.type === 'fuel') { icon = '⛽'; color = 'text-yellow-400'; }
                                          if (fac.type === 'bus_station') { icon = '🚌'; color = 'text-blue-400'; }
                                          if (fac.type === 'place_of_worship') { 
                                             icon = '🕌'; color = 'text-purple-400'; 
                                             const rel = fac.tags?.religion?.toLowerCase();
                                             if (rel === 'christian') icon = '⛪';
                                             if (rel === 'hindu') icon = '🛕';
                                             if (rel === 'buddhist' || rel === 'taoist' || rel === 'chinese_folk') icon = '🏯';
                                          }
                                          
                                          return (
                                             <div 
                                                onClick={() => {
                                                   renderRealRoute(fac);
                                                   setReconFocusCoord({ lat: fac.lat, lon: fac.lon });
                                                   mapInstance?.flyTo({ center: [fac.lon, fac.lat], zoom: 15, duration: 1500 });
                                                }}
                                                class="flex items-center justify-between bg-black/40 px-3 py-1.5 border-l-2 border-white/5 group hover:border-text_accent pointer-events-auto cursor-pointer hover:bg-white/5 transition-all">
                                                <div class="flex items-center gap-3 min-w-0">
                                                   <div class={`text-[10px] ${color} w-6 flex items-center justify-center opacity-80 group-hover:opacity-100`}>{icon}</div>
                                                   <div class="text-[9px] font-bold text-white/80 truncate group-hover:text-text_accent">{fac.name}</div>
                                                </div>
                                                <span class="text-[7px] text-white/20 opacity-0 group-hover:opacity-100 transition-opacity uppercase text-right leading-none">ROUTE</span>
                                             </div>
                                          );
                                       }}
                                    </For>
                                 </div>
                              </div>
                           </Show>

                           <Show when={!isScanningFacilities() && nearbyFacilities().length === 0}>
                              <div class="text-[7px] text-center text-white/10 py-4 uppercase tracking-[0.2em] border border-dashed border-white/5">SYSTEM READY</div>
                           </Show>
                        </div>

                        <div>
                           <div class="text-[8px] font-black text-white/40 tracking-[0.2em] mb-4 flex items-center gap-2">
                              <span>AIR LOGISTICS</span>
                              <div class="flex-1 h-px bg-white/5"></div>
                           </div>
                           <div class="space-y-2">
                              <For each={nearbyLogistics()?.airports?.slice(0, 8) || []}>
                                 {(air) => (
                                    <div 
                                       onClick={() => {
                                          renderRealRoute(air);
                                          setReconFocusCoord({ lat: air.lat, lon: air.lon });
                                          showInfraPopup(air, 'airport');
                                          mapInstance?.flyTo({ center: [air.lon, air.lat], zoom: 15, duration: 1500 });
                                       }}
                                       class="flex justify-between items-center bg-white/5 p-3 border-l-2 border-orange-500/50 hover:bg-white/10 transition-all cursor-pointer group">
                                       <div class="min-w-0 pr-2">
                                          <div class="text-[10px] font-black text-white px-1 truncate group-hover:text-orange-400">{air.name}</div>
                                          <div class="text-[7px] text-white/30 px-1 uppercase">{air.type || 'INTERNATIONAL'}</div>
                                       </div>
                                       <div class="text-right">
                                          <span class="text-[10px] font-black text-orange-400">{air.distance?.toFixed(1)}KM</span>
                                       </div>
                                    </div>
                                 )}
                              </For>
                           </div>
                        </div>
                        <div>
                           <div class="text-[8px] font-black text-white/40 tracking-[0.2em] mb-4 flex items-center gap-2">
                              <span>MARITIME_INFRASTRUCTURE</span>
                              <div class="flex-1 h-px bg-white/5"></div>
                           </div>
                           <div class="space-y-2">
                              <For each={nearbyLogistics()?.ports?.slice(0, 8) || []}>
                                 {(port) => (
                                    <div 
                                       onClick={() => {
                                          renderRealRoute(port);
                                          setReconFocusCoord({ lat: port.lat, lon: port.lon });
                                          showInfraPopup(port, 'port');
                                          mapInstance?.flyTo({ center: [port.lon, port.lat], zoom: 15, duration: 1500 });
                                       }}
                                       class="flex justify-between items-center bg-white/5 p-3 border-l-2 border-cyan-500/50 hover:bg-white/10 transition-all cursor-pointer group">
                                       <div class="min-w-0 pr-2">
                                          <div class="text-[10px] font-black text-white px-1 truncate group-hover:text-cyan-400">{port.name}</div>
                                          <div class="text-[7px] text-white/30 px-1 uppercase">FREIGHT_TERMINAL</div>
                                       </div>
                                       <div class="text-right">
                                          <span class="text-[10px] font-black text-cyan-400">{port.distance?.toFixed(1)}KM</span>
                                       </div>
                                    </div>
                                 )}
                              </For>
                           </div>
                        </div>
                        <div>
                           <div class="text-[8px] font-black text-white/40 tracking-[0.2em] mb-4 flex items-center gap-2">
                              <span>POWER GENERATION</span>
                              <div class="flex-1 h-px bg-white/5"></div>
                           </div>
                           <div class="space-y-2">
                              <For each={nearbyLogistics()?.power_plants?.slice(0, 8) || []}>
                                 {(plant) => (
                                    <div 
                                       onClick={() => {
                                          renderRealRoute(plant);
                                          setReconFocusCoord({ lat: plant.lat, lon: plant.lon });
                                          showInfraPopup(plant, 'power_plant');
                                          mapInstance?.flyTo({ center: [plant.lon, plant.lat], zoom: 15, duration: 1500 });
                                       }}
                                       class="flex justify-between items-center bg-white/5 p-3 border-l-2 border-yellow-500/50 hover:bg-white/10 transition-all cursor-pointer group">
                                       <div class="min-w-0 pr-2">
                                          <div class="text-[10px] font-black text-white px-1 truncate group-hover:text-yellow-400">{plant.name}</div>
                                          <div class="text-[7px] text-white/30 px-1 uppercase">{plant.type || 'ENERGY_PLANT'} • {plant.capacity}MW</div>
                                       </div>
                                       <div class="text-right">
                                          <span class="text-[10px] font-black text-yellow-400">{plant.distance?.toFixed(1)}KM</span>
                                       </div>
                                    </div>
                                 )}
                              </For>
                           </div>
                        </div>
                     </div>
                 </Show>

                 <Show when={dossierSubTab() === 'env'}>
                    <div class="space-y-4 animate-in fade-in duration-300">
                       <div class="bg-black/40 border border-white/5 p-4 rounded-sm flex flex-col gap-4">
                          <div class="flex justify-between items-center border-b border-white/5 pb-4">
                             <div>
                                <div class="text-2xl font-black text-white tracking-tighter">{currentTime().toLocaleTimeString('id-ID', { hour12: false })}</div>
                                <div class="text-[8px] text-white/40 font-bold uppercase mt-1">TIME SYNCHRONIZED</div>
                             </div>
                             <div class="text-right">
                                <div class="text-[8px] font-black text-text_accent uppercase tracking-widest">LOCAL TIME</div>
                                <div class="text-[7px] text-white/30 mt-1 uppercase">{currentTime().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                             </div>
                          </div>
                          <Show when={zoneWeather()} fallback={<div class="py-4 text-center text-[8px] text-white/20 animate-pulse uppercase tracking-[0.3em]">FETCHING WEATHER...</div>}>
                             <div class="flex items-center justify-between mt-2">
                                <div class="flex items-center gap-4">
                                   <div class="text-4xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{getWeatherEmoji(zoneWeather().weather_code)}</div>
                                   <div>
                                      <div class="text-2xl font-black text-white">{Math.round(zoneWeather().temperature_2m)}°C</div>
                                      <div class="text-[8px] text-text_accent font-bold uppercase tracking-widest">{weatherCodeMap[zoneWeather().weather_code]}</div>
                                   </div>
                                </div>
                                <div class="text-right space-y-2">
                                   <div class="flex justify-between gap-6 text-[8px]">
                                      <span class="text-white/40 uppercase">HUMIDITY</span>
                                      <span class="text-white font-bold">{zoneWeather().relative_humidity_2m}%</span>
                                   </div>
                                   <div class="flex justify-between gap-6 text-[8px]">
                                      <span class="text-white/40 uppercase">WIND_SPD</span>
                                      <span class="text-white font-bold">{Math.round(zoneWeather().wind_speed_10m)} KM/H</span>
                                   </div>
                                </div>
                             </div>
                          </Show>
                       </div>
                    </div>
                 </Show>

                 <Show when={dossierSubTab() === 'intel'}>
                    <div class="space-y-6 animate-in fade-in duration-300">
                       <div class="text-[8px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">LIVE_SURVEILLANCE_FEED</div>
                       <div class="space-y-6">
                          <For each={zoneNews().slice(0, 10)}>
                             {(news) => (
                                <div class="group border-b border-white/5 pb-4 last:border-0 cursor-pointer">
                                   <div class="text-[10px] text-white/80 group-hover:text-text_accent transition-colors font-bold leading-relaxed uppercase">
                                      {news.title}
                                   </div>
                                   <div class="flex items-center gap-4 mt-2.5 opacity-30 text-[7px] font-black uppercase tracking-widest">
                                      <span>{news.source?.name || 'UNKNOWN_INTEL'}</span>
                                      <span class="w-2 h-px bg-white/40"></span>
                                      <span>{news.publishedAt ? new Date(news.publishedAt).toLocaleDateString() : 'N/A'}</span>
                                   </div>
                                </div>
                             )}
                          </For>
                       </div>
                    </div>
                 </Show>
              </div>
           </div>

           <div class="p-4 border-t border-white/5 bg-zinc-950/80">
              <div class="text-[7px] font-black text-text_accent uppercase tracking-[0.3em] mb-2 px-1">SAT_RECON_FEED_L0</div>
              <iframe width="100%" height="200" frameborder="0" class="grayscale hover:grayscale-0 transition-all duration-700 border border-white/10"
                 src={`https://maps.google.com/maps?q=${reconFocusCoord()?.lat || selectedZone()?.latitude},${reconFocusCoord()?.lon || selectedZone()?.longitude}&hl=en&z=17&t=k&output=embed`}>
              </iframe>
           </div>
        </div>
      </Show>
    </div>
  );
}
