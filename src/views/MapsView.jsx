import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';

export default function MapsView(props) {
  const [selectedCountry, setSelectedCountry] = createSignal('IDN');
  const [aircraft, setAircraft] = createSignal([]);
  const [airports, setAirports] = createSignal([]);
  const [routes, setRoutes] = createSignal({}); // {callsign: {origin, destination}}
  const [focusIcao, setFocusIcao] = createSignal(null);
  const [selectedAirport, setSelectedAirport] = createSignal(null);
  const [selectedType, setSelectedType] = createSignal('large_airport');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [activeTab, setActiveTab] = createSignal('flights'); // 'flights', 'airports'
  const [countryNews, setCountryNews] = createSignal([]);
  const [isNewsLoading, setIsNewsLoading] = createSignal(false);

  // Real-time Environment Info
  const [envData, setEnvData] = createSignal({
    temp: '--',
    wind: '--',
    desc: 'INITIALIZING',
    icon: '---',
    offset: 0
  });
  const [localTime, setLocalTime] = createSignal('--:--:--');
  const [localDay, setLocalDay] = createSignal('---');

  let mapInstance = null;
  let layerGroup = null;
  let airportLayer = null;
  let routeLayer = null;
  let airportMarkers = {};

  const initMap = (el) => {
    if (mapInstance) return;
    mapInstance = window.L.map(el, { zoomControl: false }).setView([-2.5, 118], 5);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB'
    }).addTo(mapInstance);
    layerGroup = window.L.layerGroup().addTo(mapInstance);
    airportLayer = window.L.layerGroup().addTo(mapInstance);
    routeLayer = window.L.layerGroup().addTo(mapInstance);

    setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, 200);

    fetchAircraft(selectedCountry());
  };

  const updateMarkers = () => {
    if (!layerGroup || !routeLayer) return;
    layerGroup.clearLayers();
    routeLayer.clearLayers();

    const data = focusIcao()
      ? aircraft().filter(a => a.icao24 === focusIcao())
      : aircraft();

    const COLORS = ['#38bdf8', '#818cf8', '#fb7185', '#fbbf24', '#34d399', '#a78bfa', '#f472b6', '#22d3ee', '#f87171'];

    data.forEach(s => {
      // Use ICAO24 to derive a consistent color for the same plane
      const colorIndex = parseInt(s.icao24, 16) % COLORS.length;
      const color = COLORS[colorIndex] || COLORS[0];

      const icon = window.L.divIcon({
        html: `<div style="transform: rotate(${s.track}deg); color: ${color}; filter: drop-shadow(0 0 3px ${color}80);">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                   <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                 </svg>
               </div>`,
        className: 'custom-div-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      const m = window.L.marker([s.lat, s.lng], { icon }).addTo(layerGroup);

      const fr24Url = s.callsign ? `https://www.flightaware.com/live/flight/${s.callsign.trim()}` : '#';

      m.bindPopup(`
        <div style="background: #000; color: #fff; padding: 8px; font-family: 'Roboto', sans-serif; border: 1px solid var(--text-accent);">
          <div style="color: var(--text-accent); font-weight: 900; font-size: 12px; margin-bottom: 4px; letter-spacing: 1px;">FLIGHT ID: ${s.callsign || 'UNKNOWN'}</div>
          <div style="font-size: 9px; opacity: 0.7; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); pb-2">
            ICAO: ${s.icao24} | REG: ${s.origin_country}
          </div>
          <div style="font-size: 10px; font-weight: bold; margin-bottom: 10px;">
            ALTITUDE: <span style="color: #fbbf24">${s.alt}m</span><br/>
            VELOCITY: <span style="color: #fbbf24">${s.spd}kph</span>
          </div>
          <a href="${fr24Url}" target="_blank" 
             style="display: block; text-align: center; background: var(--text-accent); color: #000; text-decoration: none; padding: 4px; font-size: 9px; font-weight: 900; letter-spacing: 1px; transition: opacity 0.2s;">
            EXTERNAL TRACKING
          </a>
        </div>
      `, { className: 'tactical-popup', minWidth: 160 });

      if (focusIcao() === s.icao24) {
        const c = props.countries().find(x => x.code === selectedCountry());
        if (c) {
          window.L.polyline([c.coords, [s.lat, s.lng]], {
            color: 'var(--text-accent)',
            weight: 1,
            dashArray: '5, 10',
            opacity: 0.6
          }).addTo(routeLayer);
        }
        if (mapInstance) mapInstance.flyTo([s.lat, s.lng], 12);
      }
    });

    if (!focusIcao()) {
      const c = props.countries().find(x => x.code === selectedCountry());
      if (c && mapInstance) mapInstance.flyTo(c.coords, 8);
    }
  };

  const fetchAircraft = (code) => {
    setSelectedCountry(code);
    setFocusIcao(null);
    const c = props.countries().find(x => x.code === code);
    if (c) {
      fetchIntelligence(c.name);
      fetchAirports(c.code);
    }

    fetch(`${import.meta.env.VITE_SKY_API}/api/sky/aircraft/${code}`)
      .then(r => r.json())
      .then(d => {
        const sorted = (d.states || []).sort((a, b) => b.alt - a.alt);
        setAircraft(sorted);
        updateMarkers();
        sorted.slice(0, 3).forEach(s => { if (s.callsign) fetchRoute(s.callsign); });
      });

    if (c && c.coords) {
      fetchEnvironment(c.coords[0], c.coords[1]);
    }
  };

  const fetchEnvironment = async (lat, lng) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_GEO_DATA_API}/api/weather/forecast?lat=${lat}&lng=${lng}&tz=auto`);
      const data = await res.json();

      const code = data.current_weather?.weathercode || 0;
      const mapping = {
        0: { desc: 'CLEAR_SKY', icon: '☀️' },
        1: { desc: 'MAINLY_CLEAR', icon: '🌤️' },
        2: { desc: 'PARTLY_CLOUDY', icon: '⛅' },
        3: { desc: 'OVERCAST', icon: '☁️' },
        45: { desc: 'FOGGY', icon: '🌫️' },
        48: { desc: 'RIME_FOG', icon: '🌫️' },
        51: { desc: 'LIGHT_DRIZZLE', icon: '🌦️' },
        53: { desc: 'MODERATE_DRIZZLE', icon: '🌦️' },
        55: { desc: 'DENSE_DRIZZLE', icon: '🌧️' },
        61: { desc: 'SLIGHT_RAIN', icon: '🌧️' },
        63: { desc: 'MODERATE_RAIN', icon: '🌧️' },
        65: { desc: 'HEAVY_RAIN', icon: '🌧️' },
        71: { desc: 'SLIGHT_SNOW', icon: '❄️' },
        73: { desc: 'MODERATE_SNOW', icon: '❄️' },
        75: { desc: 'HEAVY_SNOW', icon: '❄️' },
        95: { desc: 'THUNDERSTORM', icon: '⛈️' }
      };

      const m = mapping[code] || { desc: 'STABLE_ATMOS', icon: '📡' };

      setEnvData({
        temp: Math.round(data.current_weather?.temperature || 0),
        wind: Math.round(data.current_weather?.windspeed || 0),
        desc: m.desc,
        icon: m.icon,
        offset: data.utc_offset_seconds || 0
      });
    } catch (e) {
      console.error("Environment Sync Error:", e);
    }
  };

  const fetchIntelligence = async (query) => {
    if (!query) return;
    setIsNewsLoading(true);

    try {
      // Use the centralized GNews Sub-Service (Port 5006) - Period set to None for GLOBAL_ARCHIVE search
      const res = await fetch(`${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(query)}&period=None`);
      const data = await res.json();

      if (data.news) {
        setCountryNews(data.news.map(n => ({
          title: n.title,
          link: n.link,
          source: n.publisher || 'SIGNAL_INTEL',
          timestamp: n.time
        })));
      } else {
        setCountryNews([]);
      }
      setIsNewsLoading(false);
    } catch (error) {
      console.error("Signal Intel Error:", error);
      setCountryNews([]);
      setIsNewsLoading(false);
    }
  };

  const fetchAirports = (countryCode) => {
    const code = countryCode || selectedCountry();
    const type = selectedType();
    const q = searchQuery();

    // Map 3-letter to 2-letter for API efficiency
    const iso2 = code === 'IDN' ? 'ID' :
      code === 'USA' ? 'US' :
        code === 'GBR' ? 'GB' :
          code === 'CHN' ? 'CN' :
            code === 'JPN' ? 'JP' : code.substring(0, 2);

    fetch(`${import.meta.env.VITE_INFRASTRUCTURE_API}/api/infra/airports/search?country=${iso2}&type=${type}&q=${encodeURIComponent(q)}&limit=50`)
      .then(r => r.json())
      .then(d => {
        setAirports(Array.isArray(d) ? d : []);
        updateAirportMarkers();
      });
  };

  const updateAirportMarkers = () => {
    if (!airportLayer) return;
    airportLayer.clearLayers();
    airportMarkers = {};

    airports().forEach(apt => {
      const icon = window.L.divIcon({
        html: `<div style="width: 24px; height: 24px; background: rgba(0,0,0,0.7); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 4px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 0 5px rgba(99, 102, 241, 0.6));">
                  <img src="/assets/img/control-tower.png" style="width: 18px; height: 18px; filter: brightness(0) invert(1) drop-shadow(0 0 2px #6366f1);" />
                </div>`,
        className: 'airport-div-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const m = window.L.marker([apt.latitude, apt.longitude], { icon }).addTo(airportLayer);
      airportMarkers[apt.id] = m;

      const popupHtml = `
        <div style="background: #000; color: #fff; padding: 5px; font-family: 'Roboto', sans-serif; border: 1px solid var(--text-accent); min-width: 300px;">
          <div style="color: var(--text-accent); font-weight: 900; font-size: 10px; margin-bottom: 5px; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 3px;">
            LOCATION: ${apt.name.toUpperCase()}
          </div>
          <iframe 
            width="100%" 
            height="200" 
            frameborder="0" 
            scrolling="no" 
            style="border: 0; filter: contrast(1.1) brightness(0.9);"
            src="https://maps.google.com/maps?q=${apt.latitude},${apt.longitude}&hl=id&z=16&t=k&output=embed">
          </iframe>
          <div style="font-size: 8px; opacity: 0.5; margin-top: 5px; display: flex; justify-content: space-between;">
            <span>COORD: ${apt.latitude.toFixed(4)}, ${apt.longitude.toFixed(4)}</span>
            <span>ELEV: ${apt.elevation || 0}FT</span>
          </div>
        </div>
      `;
      m.bindPopup(popupHtml, { minWidth: 310, className: 'tactical-popup' });
      m.bindTooltip(`<div class="bg-black/95 p-2 border border-indigo-500/50 text-[10px] font-black text-white uppercase">${apt.name} (${apt.iata || apt.ident})</div>`, { direction: 'top' });

      m.on('click', () => {
        setSelectedAirport(apt);
        fetchIntelligence(apt.name);
        if (mapInstance) mapInstance.flyTo([apt.latitude, apt.longitude], 14);
      });
    });
  };

  const openAirportTactical = (apt) => {
    setSelectedAirport(apt);
    fetchIntelligence(apt.name);
    if (!mapInstance) return;
    mapInstance.flyTo([apt.latitude, apt.longitude], 14);

    const m = airportMarkers[apt.id];
    if (m) {
      setTimeout(() => m.openPopup(), 400);
    }
  };

  const fetchRoute = (callsign) => {
    if (routes()[callsign]) return;
    fetch(`${import.meta.env.VITE_SKY_API}/api/sky/route/${callsign}`)
      .then(r => r.json())
      .then(d => {
        if (d.route) {
          setRoutes(prev => ({ ...prev, [callsign]: { origin: d.route[0], destination: d.route[1] } }));
        }
      }).catch(() => { });
  };

  const handleFocus = (icao) => {
    setFocusIcao(icao === focusIcao() ? null : icao);
    updateMarkers();
  };

  onMount(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const local = new Date(utc + (envData().offset * 1000));

      setLocalTime(local.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setLocalDay(local.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase());
    }, 1000);

    onCleanup(() => {
      clearInterval(timer);
      if (mapInstance) mapInstance.remove();
    });
  });

  return (
    <div class="h-full w-full flex flex-col overflow-hidden bg-black font-mono lowercase">
      {/* TOP SECTION: GLOBAL MAP (75%) */}
      <div class="flex-[3] relative w-full border-b border-border_main overflow-hidden bg-zinc-900 min-h-[40%]">
        <div class="absolute inset-0 w-full h-full" ref={initMap}></div>
        <div class="absolute top-4 left-4 pointer-events-none z-[1000]">
          <div class="p-3 bg-black/80 border border-text_accent/30 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <div class="text-[10px] font-black text-text_accent uppercase mb-1 tracking-widest flex items-center gap-2">
              <div class="w-2 h-2 bg-text_accent animate-pulse"></div>
              {focusIcao() ? `TRACKING FLIGHT: ${focusIcao()}` : 'FLIGHT MONITOR ACTIVE'}
            </div>
            <div class="text-[8px] text-white/60 space-y-1.5 uppercase flex flex-col mt-2">
              <div class="flex items-center justify-between border-b border-white/5 pb-1">
                <span class="opacity-40">REGION ID</span>
                <span class="text-white font-black">{selectedCountry()}</span>
              </div>
              <div class="flex items-center justify-between border-b border-white/5 pb-1">
                <span class="opacity-40">ACTIVE FLIGHTS</span>
                <span class="text-white font-black">{aircraft().length} FLIGHTS</span>
              </div>

              <div class="flex flex-col gap-1 border border-text_accent/20 bg-text_accent/5 p-2 my-1">
                <div class="flex items-center justify-between font-mono">
                  <span class="text-text_accent font-black tracking-widest">{localTime()}</span>
                  <span class="text-[7px] opacity-60">{localDay()}</span>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[12px]">{envData().icon}</span>
                    <span class="text-[9px] font-black text-white">{envData().temp}°C</span>
                  </div>
                  <span class="text-[7px] text-text_accent font-bold tracking-tighter bg-text_accent/10 px-1">{envData().desc}</span>
                </div>
              </div>

              <Show when={focusIcao()}>
                <button onClick={() => handleFocus(null)} class="mt-2 text-text_accent border border-text_accent/20 px-2 py-1 pointer-events-auto bg-text_accent/10 hover:bg-text_accent/30 lowercase font-black text-[9px] transition-all">
                  RESET VIEW
                </button>
              </Show>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: INTEL PANELS (25%) */}
      <div class="flex-[1.5] flex w-full bg-bg_sidebar/40 min-h-[300px] border-t-2 border-text_accent/20">
        {/* PANEL LEFT: NODES & NEWS (25%) */}
        <div class="w-[25%] border-r border-border_main flex flex-col overflow-hidden bg-black/40">
          <div class="h-1/2 flex flex-col border-b border-border_main overflow-hidden">
            <div class="px-4 py-2 border-b border-border_main flex justify-between items-center bg-black/60 sticky top-0">
              <span class="text-[10px] font-black tracking-widest text-text_accent uppercase">REGIONS</span>
              <span class="text-[8px] opacity-40 italic">{props.countries().length}</span>
            </div>
            <div class="flex-1 overflow-y-auto win-scroll p-1 flex flex-col gap-0.5 bg-black/20">
              <For each={props.countries()}>
                {(c) => (
                  <button
                    onClick={() => fetchAircraft(c.code)}
                    class={`px-3 py-1.5 text-[9px] text-left border rounded-sm transition-all ${selectedCountry() === c.code ? 'border-text_accent bg-text_accent/20 text-text_accent' : 'border-transparent text-text_secondary hover:bg-white/5 opacity-60 hover:opacity-100'}`}
                  >
                    <div class="flex justify-between items-center lowercase font-bold">
                      <span>{c.name}</span>
                      <span class="text-[7px] opacity-30">{c.code}</span>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* NEWS FEED */}
          <div class="h-1/2 flex flex-col overflow-hidden">
            <div class="px-4 py-2 border-b border-border_main flex justify-between items-center bg-black/60 sticky top-0">
              <span class="text-[10px] font-black tracking-widest text-text_accent uppercase">NEWS FEED</span>
              <div class="flex items-center gap-2">
                <Show when={isNewsLoading()}>
                  <div class="w-1.5 h-1.5 bg-text_accent animate-ping rounded-full"></div>
                </Show>
                <span class="text-[8px] opacity-40 italic">COUNT: {countryNews().length}</span>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto win-scroll p-2 flex flex-col gap-2">
              <For each={countryNews()}>
                {(n) => (
                  <div class="p-2 border border-border_main/30 bg-black/40 hover:border-text_accent/40 transition-colors group">
                    <div class="text-[9px] text-text_accent font-black mb-1 line-clamp-2 uppercase leading-tight group-hover:text-white transition-colors">
                      <a href={n.link} target="_blank" class="hover:underline">{n.title}</a>
                    </div>
                    <div class="flex justify-between items-center text-[7px] opacity-30 mt-1 font-bold">
                      <span>{n.source}</span>
                      <span>{new Date(n.timestamp * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </For>
              <Show when={countryNews().length === 0 && !isNewsLoading()}>
                <div class="flex-1 flex items-center justify-center opacity-20 text-[10px] italic">
                  Waiting for data...
                </div>
              </Show>
            </div>
          </div>
        </div>

        {/* PANEL RIGHT: TACTICAL ANALYTICS HUB (75%) */}
        <div class="w-[75%] flex flex-col overflow-hidden bg-black/20">

          {/* TAB NAVIGATION */}
          <div class="flex border-b border-white/5 bg-black/40 px-6 pt-2">
            <button
              onClick={() => setActiveTab('flights')}
              class={`px-6 py-2 text-[9px] font-black tracking-widest uppercase transition-all border-b-2 flex items-center gap-2 ${activeTab() === 'flights' ? 'border-text_accent text-text_accent' : 'border-transparent text-white/30 hover:text-white/60'}`}
            >
              <div class={`w-1.5 h-1.5 rounded-full ${activeTab() === 'flights' ? 'bg-text_accent animate-pulse' : 'bg-white/10'}`}></div>
              FLIGHT OPERATIONS
            </button>
            <button
              onClick={() => setActiveTab('airports')}
              class={`px-6 py-2 text-[9px] font-black tracking-widest uppercase transition-all border-b-2 flex items-center gap-2 ${activeTab() === 'airports' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-white/30 hover:text-white/60'}`}
            >
              <div class={`w-1.5 h-1.5 rounded-full ${activeTab() === 'airports' ? 'bg-indigo-500 animate-pulse' : 'bg-white/10'}`}></div>
              AIRPORT INFRASTRUCTURE
            </button>
          </div>

          <div class="flex-1 overflow-hidden relative">
            <Switch>
              {/* FLIGHT DATA TAB */}
              <Match when={activeTab() === 'flights'}>
                <div class="h-full flex flex-col overflow-hidden animate-fade-in">
                  <div class="px-6 py-2 border-b border-border_main/50 flex justify-between items-center bg-black/20 sticky top-0 z-20 backdrop-blur-sm">
                    <h4 class="text-[8px] font-black text-text_accent/60 uppercase tracking-widest">AERIAL TRAFFIC MONITOR</h4>
                    <div class="text-[8px] opacity-30 italic uppercase flex items-center gap-4">
                      <span>ACTIVE FLIGHTS: {aircraft().length}</span>
                      <span class="text-text_accent animate-pulse">SYSTEM LIVE</span>
                    </div>
                  </div>

                  <div class="flex-1 overflow-y-auto win-scroll">
                    <table class="w-full text-left border-collapse">
                      <thead class="sticky top-0 bg-[#0a0a0a] z-10 border-b border-border_main">
                        <tr class="text-[8px] font-black text-text_accent uppercase">
                          <th class="px-6 py-2 font-black">ICAO</th>
                          <th class="px-2 py-2 font-black">CALLSIGN</th>
                          <th class="px-2 py-2 font-black">REG_COUNTRY</th>
                          <th class="px-2 py-2 font-black">FROM {"->"} TO</th>
                          <th class="px-2 py-2 font-black text-right">ALT</th>
                          <th class="px-2 py-2 font-black text-right">SPD</th>
                          <th class="px-6 py-2 font-black text-center">STATUS</th>
                        </tr>
                      </thead>
                      <tbody class="text-[10px] lowercase font-bold">
                        <For each={aircraft()}>
                          {(s) => (
                            <tr
                              onClick={() => handleFocus(s.icao24)}
                              class={`border-bottom border-border_main/5 transition-colors group cursor-pointer ${focusIcao() === s.icao24 ? 'bg-text_accent/20' : 'hover:bg-text_accent/5'}`}
                            >
                              <td class="px-6 py-2 text-white font-black group-hover:text-text_accent">{s.icao24}</td>
                              <td class="px-2 py-2 text-text_accent font-black uppercase tracking-tighter">{s.callsign || 'N/A'}</td>
                              <td class="px-2 py-2 text-text_secondary/80 truncate max-w-[120px] uppercase font-bold text-[8px]">{s.origin_country}</td>
                              <td class="px-2 py-2">
                                <div class="flex items-center gap-1">
                                  <span class={`text-[9px] uppercase font-black truncate max-w-[100px] ${routes()[s.callsign] ? 'text-green-500' : 'text-text_secondary/40'}`}>
                                    {routes()[s.callsign]?.origin || '---'}
                                  </span>
                                  <span class="text-[7px] opacity-20 mx-1">{"->"}</span>
                                  <span class={`text-[9px] uppercase font-black truncate max-w-[100px] ${routes()[s.callsign] ? 'text-green-500 animate-pulse' : 'text-text_secondary/40'}`}>
                                    {routes()[s.callsign]?.destination || '---'}
                                  </span>
                                </div>
                              </td>
                              <td class="px-2 py-2 text-white/80 text-right font-mono">{s.alt}m</td>
                              <td class="px-2 py-2 text-white/80 text-right font-mono">{s.spd}kph</td>
                              <td class="px-6 py-2 text-center pointer-events-none">
                                <div class={`text-[8px] px-3 py-1 border transition-all uppercase font-black ${focusIcao() === s.icao24 ? 'border-text_accent bg-text_accent text-bg_main' : 'border-text_accent/40 text-text_accent'}`}>
                                  {focusIcao() === s.icao24 ? 'TRACKING' : 'READY'}
                                </div>
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Match>

              {/* AIRPORT INTEL TAB */}
              <Match when={activeTab() === 'airports'}>
                <div class="h-full flex flex-col overflow-hidden animate-fade-in bg-indigo-500/[0.01]">
                  <div class="px-6 py-3 border-b border-border_main/50 flex flex-col gap-3 bg-black/20 sticky top-0 z-20 backdrop-blur-sm">
                    <div class="flex justify-between items-center">
                      <div class="flex flex-col">
                        <h4 class="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none">AIRPORT DATA</h4>
                        <span class="text-[7px] text-white/20 mt-1 uppercase tracking-tighter italic">LOGISTICS NODES</span>
                      </div>
                      <div class="flex items-center gap-3">
                        <div class="relative">
                          <input
                            type="text"
                            placeholder="SEARCH BY ID..."
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchAirports()}
                            class="bg-black/60 border border-white/10 px-3 py-1.5 text-[8px] text-white focus:border-indigo-500/50 outline-none w-56 uppercase font-bold transition-all"
                          />
                          <div class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] opacity-20">🔍</div>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center justify-between">
                      <div class="flex gap-1.5">
                        <For each={['large_airport', 'medium_airport', 'small_airport', 'heliport']}>
                          {(t) => (
                            <button
                              onClick={() => { setSelectedType(t); fetchAirports(); }}
                              class={`text-[7px] px-3 py-1 border transition-all ${selectedType() === t ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 font-bold' : 'border-white/5 text-white/40 hover:text-white/80 hover:bg-white/5'}`}
                            >
                              {t.replace('_', ' ').toUpperCase()}
                            </button>
                          )}
                        </For>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-[8px] text-white/40 uppercase tracking-tighter">DATA_POINTS:</span>
                        <span class="text-[8px] text-indigo-400 font-bold">{airports().length}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex-1 overflow-y-auto win-scroll">
                    <table class="w-full text-left border-collapse">
                      <thead class="sticky top-0 bg-[#0a0a0a] z-10 border-b border-border_main">
                        <tr class="text-[8px] font-black text-indigo-400 uppercase">
                          <th class="px-6 py-2 font-black">ID_IDENT</th>
                          <th class="px-2 py-2 font-black">AIRPORT_NAME</th>
                          <th class="px-2 py-2 font-black">MUNICIPALITY</th>
                          <th class="px-2 py-2 font-black">CLASSIFICATION</th>
                          <th class="px-2 py-2 font-black text-right">ELEVATION</th>
                          <th class="px-6 py-2 font-black text-center">STATUS</th>
                        </tr>
                      </thead>
                      <tbody class="text-[10px] lowercase font-bold">
                        <For each={airports()}>
                          {(apt) => (
                            <tr
                              onClick={() => openAirportTactical(apt)}
                              class={`border-bottom border-indigo-500/5 transition-colors group cursor-pointer ${selectedAirport()?.id === apt.id ? 'bg-indigo-500/20' : 'hover:bg-indigo-500/5'}`}
                            >
                              <td class="px-6 py-2 font-black text-white/50 group-hover:text-indigo-400">
                                {apt.ident}
                                <Show when={apt.iata}><span class="ml-2 text-indigo-500/60 uppercase">[{apt.iata}]</span></Show>
                              </td>
                              <td class="px-2 py-2 text-indigo-400 font-black uppercase tracking-tighter truncate max-w-[200px] group-hover:text-white">{apt.name}</td>
                              <td class="px-2 py-2 text-white/40 uppercase font-bold text-[8px]">{apt.municipality || 'UNSPECIFIED'}</td>
                              <td class="px-2 py-2">
                                <span class="text-[7px] border border-indigo-500/30 px-1.5 py-0.5 text-indigo-500/60 uppercase group-hover:border-indigo-500 transition-colors">
                                  {apt.type.replace('_', ' ')}
                                </span>
                              </td>
                              <td class="px-2 py-2 text-white/60 text-right font-mono italic">{apt.elevation || '0'}FT</td>
                              <td class="px-6 py-2 text-center">
                                <div class={`text-[8px] px-2 py-0.5 border transition-all uppercase font-black ${selectedAirport()?.id === apt.id ? 'border-indigo-500 bg-indigo-500 text-bg_main' : 'border-indigo-500/20 text-indigo-500/60'}`}>
                                  {selectedAirport()?.id === apt.id ? 'FOCUSED' : 'ONLINE'}
                                </div>
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Match>
            </Switch>
          </div>
        </div>
      </div>
    </div>
  );
}
