import { createSignal, createMemo, onMount, onCleanup, createEffect, For, Show } from 'solid-js';
import { SolarEngine } from '../../utils/SolarEngine';

const GEO_API = `${import.meta.env.VITE_GEO_DATA_API}/api`;
const OWM_KEY = '9174eb782e1439c70d19871c80221c37';

const WEATHER_OVERLAY_CONFIG = {
  none: { label: 'RADAR DISABLED', icon: '📡', url: '', opacity: 0 },
  temp_new: { label: 'TEMPERATURE RADAR', icon: '🌡️', url: `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`, opacity: 0.5 },
  precipitation_new: { label: 'PRECIPITATION RADAR', icon: '🌧️', url: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`, opacity: 0.6 },
  clouds_new: { label: 'SATELLITE CLOUD COVER', icon: '☁️', url: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`, opacity: 0.5 },
  wind_new: { label: 'WIND VECTORS', icon: '💨', url: `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`, opacity: 0.4 },
  pressure_new: { label: 'PRESSURE ISOBARS', icon: '⏲️', url: `https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`, opacity: 0.4 }
};

const weatherCodeMap = {
  0: 'Clear sky',
  1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  95: 'Thunderstorm',
};

const getTemperatureColor = (temp) => {
  if (temp <= 0) return '#3b82f6';
  if (temp <= 15) return '#06b6d4';
  if (temp <= 25) return '#10b981';
  if (temp <= 30) return '#f59e0b';
  if (temp <= 35) return '#f97316';
  return '#ef4444';
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

export default function WeatherPanel() {
  const [activeTab, setActiveTab] = createSignal('map');
  const [sidebarTab, setSidebarTab] = createSignal('hubs'); // 'hubs', 'quakes'
  
  // Robust state loading for weather hubs
  const [weatherHubs, setWeatherHubs] = createSignal((() => {
    try {
      const saved = localStorage.getItem('weather-storage');
      if (saved) {
        const parsed = JSON.parse(saved);
        const data = parsed?.state?.watchList || parsed?.watchList || parsed;
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch(e) {
      console.error('Weather Analysis: Storage access error', e);
    }
    
    // Default locations for the terminal view
    return [
      { name: 'Jakarta', lat: -6.2088, lng: 106.8456, tz: 'Asia/Jakarta' },
      { name: 'New York', lat: 40.7128, lng: -74.0060, tz: 'America/New_York' },
      { name: 'London', lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
      { name: 'Tokyo', lat: 35.6762, lng: 139.6503, tz: 'Asia/Tokyo' },
      { name: 'Singapore', lat: 1.3521, lng: 103.8198, tz: 'Asia/Singapore' },
    ];
  })());

  const [weatherData, setWeatherData] = createSignal({});
  const [earthquakes, setEarthquakes] = createSignal([]);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [selectedCityName, setSelectedCityName] = createSignal(null);
  const [showDetail, setShowDetail] = createSignal(false);
  const [detailedData, setDetailedData] = createSignal(null);
  const [loadingDetailed, setLoadingDetailed] = createSignal(false);
  
  const [weatherOverlay, setWeatherOverlay] = createSignal('none');
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
  const [isGeocoding, setIsGeocoding] = createSignal(false);
  const [showQuakes, setShowQuakes] = createSignal(false);
  
  // Solar & Timezone Signals
  const [currentTime, setCurrentTime] = createSignal(new Date());
  const [showSolar, setShowSolar] = createSignal(true);
  const [showShading, setShowShading] = createSignal(true);
  const [showMeridians, setShowMeridians] = createSignal(true);
  const [mapStyle, setMapStyle] = createSignal('satellite');

  let mapInstance = null;
  let tileLayer = null;
  let labelLayer = null;
  let markerLayer = null;
  let quakeLayer = null;
  let overlayLayer = null;
  let terminatorLayer = null;
  let twilightLayer = null;
  let goldenLayer = null;
  let sunMarker = null;
  let moonMarker = null;
  let meridianLayer = null;
  let markersMap = new Map();

  const saveWatchList = (list) => {
    if (!Array.isArray(list)) return;
    localStorage.setItem('weather-storage', JSON.stringify({ state: { watchList: list } }));
    setWeatherHubs(list);
  };

  const fetchWeatherForCity = async (city) => {
    if (!city || !city.lat) return;
    try {
      const res = await fetch(`${GEO_API}/weather/forecast?lat=${city.lat}&lng=${city.lng}&tz=${city.tz}`);
      const data = await res.json();
      
      const now = new Date();
      now.setMinutes(0, 0, 0);
      let hourIndex = data.hourly.time.findIndex(t => new Date(t) >= now);
      if (hourIndex === -1) hourIndex = 0;

      const processed = {
        city: city.name,
        temp: data.current_weather.temperature,
        feelsLike: data.hourly.apparent_temperature ? data.hourly.apparent_temperature[hourIndex] : data.current_weather.temperature,
        condition: weatherCodeMap[data.current_weather.weathercode] || 'Unknown',
        code: data.current_weather.weathercode,
        lat: city.lat,
        lng: city.lng,
        windSpeed: data.current_weather.windspeed,
        windDirection: data.current_weather.winddirection,
        humidity: data.hourly.relative_humidity_2m ? data.hourly.relative_humidity_2m[hourIndex] : 0,
        pressure: data.hourly.surface_pressure ? data.hourly.surface_pressure[hourIndex] : 0,
        cloudCover: data.hourly.cloud_cover ? data.hourly.cloud_cover[hourIndex] : 0,
        visibility: data.hourly.visibility ? data.hourly.visibility[hourIndex] : 0,
        precipProb: data.hourly.precipitation_probability ? data.hourly.precipitation_probability[hourIndex] : 0,
        time: new Date().toLocaleTimeString('en-US', { timeZone: city.tz, hour: '2-digit', minute: '2-digit' }),
        tz: city.tz,
        gmt: new Date().toLocaleTimeString('en-US', { timeZone: city.tz, timeZoneName: 'short' }).split(' ').pop(),
        hourly: {
          time: data.hourly.time.slice(hourIndex, hourIndex + 24),
          temp: data.hourly.temperature_2m.slice(hourIndex, hourIndex + 24),
          humidity: data.hourly.relative_humidity_100m ? data.hourly.relative_humidity_100m.slice(hourIndex, hourIndex + 24) : [],
          wind: data.hourly.wind_speed_10m.slice(hourIndex, hourIndex + 24),
          precip: data.hourly.precipitation_probability.slice(hourIndex, hourIndex + 24),
        },
        daily: {
          time: data.daily.time,
          tempMax: data.daily.temperature_2m_max,
          tempMin: data.daily.temperature_2m_min,
          weatherCode: data.daily.weathercode,
          sunrise: data.daily.sunrise,
          sunset: data.daily.sunset,
          precipSum: data.daily.precipitation_sum || Array(7).fill(0),
          windGust: data.daily.wind_gusts_10m_max || Array(7).fill(0),
        }
      };

      setWeatherData(prev => ({ ...prev, [city.name]: processed }));
      return processed;
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllWeather = async () => {
    const listData = weatherHubs();
    if (Array.isArray(listData)) {
      for (const city of listData) {
        fetchWeatherForCity(city);
      }
    }
  };

  const fetchQuakes = async () => {
    try {
      const res = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json');
      const data = await res.json();
      const processed = (data.Infogempa.gempa || []).slice(0, 15).map(q => {
        const coords = q.Coordinates.split(',');
        return {
          lat: parseFloat(coords[0]),
          lng: parseFloat(coords[1]),
          magnitude: q.Magnitude,
          kedalaman: q.Kedalaman,
          wilayah: q.Wilayah,
          jam: q.Jam,
          tanggal: q.Tanggal,
          potensi: q.Potensi
        };
      });
      setEarthquakes(processed);
      updateQuakeMarkers(processed);
    } catch(e) { console.error(e); }
  };

  const fetchDetailedWeather = async (cityName) => {
    const city = weatherHubs().find(c => c.name === cityName);
    if (!city) return;
    setLoadingDetailed(true);
    try {
      const res = await fetch(`${GEO_API}/weather/forecast?lat=${city.lat}&lng=${city.lng}&tz=${city.tz}&past_days=7`);
      const data = await res.json();
      
      const now = new Date();
      now.setMinutes(0, 0, 0);
      let hourIndex = data.hourly.time.findIndex(t => new Date(t) >= now);
      if (hourIndex === -1) hourIndex = 0;

      const detailed = {
        name: city.name,
        current: weatherData()[city.name],
        timeline: data.hourly.time.map((t, i) => ({
          time: t,
          temp: data.hourly.temperature_2m[i],
          precip: data.hourly.precipitation_probability[i],
          wind: data.hourly.wind_speed_10m[i],
          humidity: data.hourly.relative_humidity_2m ? data.hourly.relative_humidity_2m[i] : 0,
          isPast: new Date(t) < now
        }))
      };
      setDetailedData(detailed);
      setShowDetail(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetailed(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery().trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`${GEO_API}/weather/search?name=${encodeURIComponent(searchQuery())}&count=8`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const addCity = (result) => {
    const newCity = {
      name: result.name,
      lat: result.latitude,
      lng: result.longitude,
      tz: result.timezone || 'UTC'
    };
    if (!weatherHubs().find(c => c.name === newCity.name)) {
      saveWatchList([newCity, ...weatherHubs()]);
      fetchWeatherForCity(newCity);
    }
    setSearchResults([]);
    setSearchQuery('');
    setSelectedCityName(newCity.name);
    focusCity(newCity.name);
  };

  const focusCity = (cityName) => {
    if (!mapInstance) return;
    const city = weatherHubs().find(c => c.name === cityName);
    if (!city) return;
    
    mapInstance.flyTo([city.lat, city.lng], 10, {
        duration: 1.5,
        easeLinearity: 0.25
    });

    // Wait for markers to be rendered if they are being updated
    setTimeout(() => {
        // No longer using popups, the floating panel handles it
    }, 500);
  };

  const initMap = (el) => {
    if (mapInstance || !el || !window.L) return;
    mapInstance = window.L.map(el, { zoomControl: false }).setView([20, 0], 2);
    
    markerLayer = window.L.layerGroup().addTo(mapInstance);
    quakeLayer = window.L.layerGroup().addTo(mapInstance);
    overlayLayer = window.L.layerGroup().addTo(mapInstance);

    updateTiles();
    fetchAllWeather();
    fetchQuakes();
    updateSolarLayers();
    updateMeridians();

    setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, 200);
  };

  const updateTiles = () => {
    if (!mapInstance) return;
    if (tileLayer) mapInstance.removeLayer(tileLayer);
    if (labelLayer) mapInstance.removeLayer(labelLayer);

    let url;
    let labelUrl = 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';
    let labelOpacity = 0.5;

    switch (mapStyle()) {
        case 'light': 
            url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'; 
            labelUrl = null; 
            break;
        case 'dark': 
            url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'; 
            labelUrl = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png';
            labelOpacity = 0.8;
            break;
        default: // satellite
            url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
            labelUrl = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png';
            labelOpacity = 0.8;
    }

    tileLayer = window.L.tileLayer(url, { maxZoom: 19 }).addTo(mapInstance);
    if (labelUrl) {
        labelLayer = window.L.tileLayer(labelUrl, { opacity: labelOpacity, pane: 'shadowPane' }).addTo(mapInstance);
    }
  };

  createEffect(() => {
    if (activeTab() === 'map' && mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 150);
    }
  });

  const updateMarkers = (dataMap) => {
    if (!markerLayer) return;
    markerLayer.clearLayers();
    markersMap.clear();

    Object.values(dataMap).forEach((city) => {
      const color = getTemperatureColor(city.temp);
      const phase = SolarEngine.getDayPhase(city.lat, city.lng, currentTime());
      
      const icon = window.L.divIcon({
        className: 'weather-marker',
        html: `
          <div class="relative flex items-center justify-center group">
            <div class="w-4 h-4 rounded-full border-2 border-white/50 shadow-[0_0_15px_${color}] group-hover:scale-125 transition-all" style="background-color: ${color};"></div>
            <div class="absolute -top-7 bg-bg_header border border-text_accent/50 px-1.5 py-0.5 text-[9px] whitespace-nowrap font-black font-roboto text-white shadow-xl">${city.temp.toFixed(0)}°</div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = window.L.marker([city.lat, city.lng], { icon })
        .addTo(markerLayer)
        .on('click', () => {
           setSelectedCityName(city.city);
           focusCity(city.city);
        });

      markersMap.set(city.city, marker);
    });
  };

  const updateQuakeMarkers = (quakes) => {
    if (!quakeLayer) return;
    quakeLayer.clearLayers();
    if (!showQuakes()) return;
    quakes.forEach(eq => {
      window.L.circleMarker([eq.lat, eq.lng], {
        radius: Math.max(5, parseFloat(eq.magnitude) * 2.5),
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.3,
        weight: 1
      }).addTo(quakeLayer).bindPopup(`
        <div class="bg-bg_header text-white p-3 font-roboto text-[10px] border border-red-500/50">
          <p class="font-black text-red-500 uppercase tracking-widest">SEISMIC ACTIVITY M${eq.magnitude}</p>
          <p class="mt-2 text-white font-bold">${eq.wilayah}</p>
          <div class="mt-2 flex justify-between border-t border-white/10 pt-1 text-white/40">
            <span>${eq.tanggal}</span><span>${eq.jam}</span>
          </div>
        </div>
      `);
    });
  };

  createEffect(() => { updateMarkers(weatherData()); });
  createEffect(() => { updateQuakeMarkers(earthquakes()); });

  createEffect(() => {
    if (!overlayLayer || !mapInstance) return;
    overlayLayer.clearLayers();
    const config = WEATHER_OVERLAY_CONFIG[weatherOverlay()];
    if (config.url) {
      window.L.tileLayer(config.url, { opacity: config.opacity }).addTo(overlayLayer);
    }
  });

  const selectedCityData = createMemo(() => weatherData()[selectedCityName()] || null);

  const selectedComputed = createMemo(() => {
    const city = selectedCityData();
    if (!city) return null;
    const now = currentTime();
    return {
        phase: SolarEngine.getDayPhase(city.lat, city.lng, now),
        altitude: SolarEngine.getSolarAltitude(city.lat, city.lng, now),
        events: SolarEngine.getSolarEvents(city.lat, city.lng, now)
    };
  });

  const updateSolarLayers = () => {
    if (!mapInstance) return;
    const now = currentTime();
    const style = mapStyle();
    const isSat = style === 'satellite';
    
    // 1. Shading
    if (showShading()) {
        const nightColor = style === 'light' ? '#334155' : '#050b1a';
        const twilightColor = style === 'light' ? '#64748b' : '#312e81';
        const shadingOpacity = isSat ? 0.35 : 0.2; // Increase opacity on satellite for better definition
        
        const twilightPath = SolarEngine.getTerminatorPolygon(now, -6);
        if (twilightLayer) {
            twilightLayer.setLatLngs(twilightPath).setStyle({ fillColor: twilightColor, fillOpacity: shadingOpacity });
        } else {
            twilightLayer = window.L.polygon(twilightPath, { color: '#000', fillColor: twilightColor, fillOpacity: shadingOpacity, weight: 0, interactive: false }).addTo(mapInstance);
        }

        const goldenPath = SolarEngine.getTerminatorPolygon(now, 0);
        const goldenColor = style === 'light' ? '#f59e0b' : '#fb923c';
        if (goldenLayer) {
            goldenLayer.setLatLngs(goldenPath).setStyle({ color: goldenColor, fillColor: goldenColor, fillOpacity: isSat ? 0.2 : 0.1 });
        } else {
            goldenLayer = window.L.polygon(goldenPath, { color: goldenColor, fillColor: goldenColor, fillOpacity: isSat ? 0.2 : 0.1, weight: 1, dashArray: '5,5', interactive: false }).addTo(mapInstance);
        }
    } else {
        if (twilightLayer) { mapInstance.removeLayer(twilightLayer); twilightLayer = null; }
        if (goldenLayer) { mapInstance.removeLayer(goldenLayer); goldenLayer = null; }
    }

    // 2. Solar/Lunar
    if (showSolar()) {
        const sunPoint = SolarEngine.getSubsolarPoint(now);
        const sunColor = style === 'light' ? '#f59e0b' : '#ffcc00';
        const sunGlow = style === 'light' ? 'rgba(245,158,11,0.5)' : '#ffcc00';
        const sunBorder = isSat ? '2px solid rgba(0,0,0,0.8)' : '1px solid rgba(255,255,255,0.5)';
        
        if (sunMarker) {
            mapInstance.removeLayer(sunMarker); // Recreate to update HTML style correctly
            sunMarker = null;
        }
        
        const sunIcon = window.L.divIcon({
            html: `<div style="width: 22px; height: 22px; background: radial-gradient(circle, #fff 0%, ${sunColor} 60%, transparent 100%); border-radius: 50%; box-shadow: 0 0 20px ${sunGlow}; border: ${sunBorder};"></div>`,
            className: 'sun-marker', iconSize: [22, 22], iconAnchor: [11, 11]
        });
        sunMarker = window.L.marker([sunPoint.lat, sunPoint.lon], { icon: sunIcon, zIndexOffset: 2000 }).addTo(mapInstance);

        const moonPoint = SolarEngine.getSublunarPoint(now);
        const moonGlow = style === 'light' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)';
        const moonBorder = isSat ? '2px solid rgba(0,0,0,0.8)' : '1px solid rgba(255,255,255,0.3)';
        
        if (moonMarker) {
            mapInstance.removeLayer(moonMarker);
            moonMarker = null;
        }
        
        const moonIcon = window.L.divIcon({
            html: `<div style="width: 18px; height: 18px; background: radial-gradient(circle, #fff 0%, #a0a0a0 70%, transparent 100%); border-radius: 50%; box-shadow: 0 0 15px ${moonGlow}; border: ${moonBorder};"></div>`,
            className: 'moon-marker', iconSize: [18, 18], iconAnchor: [9, 9]
        });
        moonMarker = window.L.marker([moonPoint.lat, moonPoint.lon], { icon: moonIcon, zIndexOffset: 1900 }).addTo(mapInstance);
    } else {
        if (sunMarker) { mapInstance.removeLayer(sunMarker); sunMarker = null; }
        if (moonMarker) { mapInstance.removeLayer(moonMarker); moonMarker = null; }
    }
  };

  const updateMeridians = () => {
    if (!mapInstance) return;
    if (meridianLayer) {
        mapInstance.removeLayer(meridianLayer);
        meridianLayer = null;
    }
    if (!showMeridians()) return;

    meridianLayer = window.L.layerGroup().addTo(mapInstance);
    for (let i = -12; i <= 12; i++) {
        const lon = i * 15;
        window.L.polyline([[-85, lon], [85, lon]], {
            color: '#ffffff',
            weight: 1,
            opacity: 0.1,
            dashArray: '5, 5'
        }).addTo(meridianLayer);

        const label = i >= 0 ? `GMT+${i}` : `GMT${i}`;
        const tag = window.L.divIcon({
            html: `<div style="color: rgba(255,255,255,0.3); font-size: 7px; font-weight: 900; background: rgba(0,0,0,0.4); padding: 1px 3px; border: 1px solid rgba(255,255,255,0.1); white-space: nowrap;">${label}</div>`,
            className: 'gmt-tag',
            iconSize: [40, 12],
            iconAnchor: [20, 6]
        });
        window.L.marker([80, lon], { icon: tag }).addTo(meridianLayer);
    }
  };

  onMount(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const solarTimer = setInterval(() => {
        updateSolarLayers();
        if (showMeridians()) updateMeridians();
    }, 60000);

    onCleanup(() => {
        clearInterval(timer);
        clearInterval(solarTimer);
        if (mapInstance) mapInstance.remove();
    });
  });

  const getSparklinePath = (points, width, height) => {
    if (!points || points.length < 2) return "";
    const cleanPoints = points.filter(p => !isNaN(p));
    const min = Math.min(...cleanPoints);
    const max = Math.max(...cleanPoints);
    const range = max - min || 1;
    const dx = width / (points.length - 1);
    
    return points.map((p, i) => {
      const x = i * dx;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  return (
    <div class="h-full flex flex-col bg-bg_main text-text_primary font-roboto lowercase overflow-hidden">
      
      {/* HEADER */}
      <div class="h-10 flex items-center justify-between px-4 border-b border-border_main bg-bg_header shrink-0">
         <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 px-3 py-1 mr-4 border-r border-border_main">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="text-text_accent" stroke-width="3"><path d="M17.5 19c.3 0 .5-.1.7-.3.2-.2.3-.5.3-.7V11c0-.3-.1-.5-.3-.7-.2-.2-.5-.3-.7-.3h-1c-.3 0-.5.1-.7.3-.2.2-.3.5-.3.7v7c0 .3.1.5.3.7.2.2.5.3.7.3h1c.1 0 .2 0 .3-.1z"/></svg>
               <span class="text-[10px] font-black text-white tracking-widest uppercase">METEOROLOGICAL ANALYSIS REPORT</span>
            </div>
            <div class="flex gap-1 h-6">
               <button onClick={() => setActiveTab('map')} class={`px-3 text-[9px] font-black uppercase border transition-all ${activeTab() === 'map' ? 'bg-text_accent border-text_accent text-white' : 'text-white/40 border-transparent hover:text-white'}`}>WEATHER MAP</button>
               <button onClick={() => setActiveTab('terminal')} class={`px-3 text-[9px] font-black uppercase border transition-all ${activeTab() === 'terminal' ? 'bg-text_accent border-text_accent text-white' : 'text-white/40 border-transparent hover:text-white'}`}>WEATHER CONSOLE</button>
            </div>
         </div>
         <div class="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-[#22c55e] bg-[#22c55e]/5 px-3 h-full">
            <span class="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"></span> MONITORING: ACTIVE_DATA_STREAM
         </div>
      </div>

      <div class="flex-1 flex overflow-hidden relative">
        
        {/* MAP VIEW - PERSISTENT DOM FOR LEAFLET STABILITY */}
        <div class={`flex-1 relative w-full h-full bg-black ${activeTab() === 'map' ? '' : 'hidden'}`}>
           <div ref={initMap} class="absolute inset-0 w-full h-full grayscale-[0.3] contrast-[1.2] z-0" style="min-height: 100%;" />
              
              {/* Floating Map Controls - Unified Tactical HUD */}
              <div class="absolute top-4 right-4 z-[1001] flex flex-col gap-3">
                 
                 {/* GROUP A: SYSTEM CONTROLS */}
                 <div class="bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                    <div class="group relative">
                        <button 
                          onClick={() => {
                            if (mapInstance) {
                                mapInstance.flyTo(mapInstance.getCenter(), 12);
                                fetchAllWeather();
                                fetchQuakes();
                                updateSolarLayers();
                            }
                          }}
                          class="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all rounded"
                        >
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="group-hover:rotate-180 transition-transform duration-500"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                        </button>
                        <div class="absolute right-10 top-1 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-[1002]">REFRESH_DATA_STREAM</div>
                    </div>
                 </div>

                 {/* GROUP B: CELESTIAL & TEMPORAL */}
                 <div class="bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                    <div class="group relative">
                        <button onClick={() => { setShowSolar(!showSolar()); updateSolarLayers(); }} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${showSolar() ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
                        </button>
                        <div class="absolute right-10 top-1 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-[1002]">SOLAR_UNITS</div>
                    </div>

                    <div class="group relative">
                        <button onClick={() => { setShowShading(!showShading()); updateSolarLayers(); }} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${showShading() ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 21a9 9 0 1 1 0-18c-4.97 0-9 4.03-9 9s4.03 9 9 9z"/><path d="M12 3v18"/></svg>
                        </button>
                        <div class="absolute right-10 top-1 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-[1002]">ATMOSPHERIC_SHADING</div>
                    </div>

                    <div class="group relative">
                        <button onClick={() => { setShowMeridians(!showMeridians()); updateMeridians(); }} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${showMeridians() ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        </button>
                        <div class="absolute right-10 top-1 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-[1002]">GMT_MERIDIANS</div>
                    </div>
                 </div>

                 {/* GROUP C: MAP PERSPECTIVE */}
                 <div class="bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 flex flex-col gap-2 shadow-2xl rounded-lg">
                    <div class="group relative">
                        <button onClick={() => { setMapStyle('light'); updateTiles(); updateSolarLayers(); updateMeridians(); }} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapStyle() === 'light' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <div class="absolute right-10 top-1 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-[1002]">LIGHT_RECON</div>
                    </div>

                    <div class="group relative">
                        <button onClick={() => { setMapStyle('dark'); updateTiles(); updateSolarLayers(); updateMeridians(); }} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapStyle() === 'dark' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                        </button>
                        <div class="absolute right-10 top-1 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-[1002]">DARK_RECON</div>
                    </div>

                    <div class="group relative">
                        <button onClick={() => { setMapStyle('satellite'); updateTiles(); updateSolarLayers(); updateMeridians(); }} class={`w-8 h-8 flex items-center justify-center transition-all rounded ${mapStyle() === 'satellite' ? 'text-text_accent bg-text_accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        </button>
                        <div class="absolute right-10 top-1 bg-black text-[7px] font-black text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-xl z-[1002]">SATELLITE_RECON</div>
                    </div>
                 </div>
              </div>

              {/* SELECTED LOCATION DOSSIER - PERSISTENT FLOATING PANEL */}
              <Show when={selectedCityData() && activeTab() === 'map'}>
                  <div class="absolute top-[340px] right-4 z-[1001] w-[200px] bg-black/60 backdrop-blur-xl border border-text_accent/30 p-4 shadow-2xl rounded-lg animate-in fade-in slide-in-from-right-4 font-roboto">
                      <div class="flex justify-between items-start mb-4 border-b border-white/10 pb-2">
                          <div>
                              <div class="text-[8px] text-text_accent font-black tracking-widest uppercase">LOCATION_INTEL</div>
                              <div class="text-[13px] text-white font-black uppercase leading-tight mt-1 truncate max-w-[120px]">{selectedCityName()}</div>
                          </div>
                          <button onClick={() => setSelectedCityName(null)} class="text-white/20 hover:text-white transition-colors">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
                          </button>
                      </div>
                      
                      <div class="space-y-2">
                          <div class="flex justify-between items-center bg-white/5 p-2 border-l border-text_accent">
                              <span class="text-[8px] text-white/40 font-black">LOCAL_TIME</span>
                              <span class="text-[10px] text-white font-black">{selectedCityData().time}</span>
                          </div>
                          <div class="flex justify-between items-center bg-white/5 p-2 border-l border-orange-500">
                              <span class="text-[8px] text-white/40 font-black">GMT_ZONE</span>
                              <span class="text-[10px] text-orange-500 font-black">{selectedCityData().gmt}</span>
                          </div>
                          <div class="flex justify-between items-center bg-white/5 p-2 border-l" style={selectedComputed() ? { 'border-color': selectedComputed().phase.color } : {}}>
                              <span class="text-[8px] text-white/40 font-black">CYCLE_PHASE</span>
                              <span class="text-[10px] font-black" style={selectedComputed() ? { color: selectedComputed().phase.color } : {}}>
                                  {selectedComputed()?.phase?.id} {selectedComputed()?.phase?.icon}
                              </span>
                          </div>
                          <div class="flex justify-between items-center bg-white/5 p-2 border-l border-cyan-500">
                              <span class="text-[8px] text-white/40 font-black">ALTITUDE</span>
                              <span class="text-[10px] text-cyan-500 font-black">{selectedComputed()?.altitude?.toFixed(1)}°</span>
                          </div>
                      </div>

                      <button 
                         onClick={() => setActiveTab('terminal')}
                         class="w-full mt-4 bg-text_accent/10 hover:bg-text_accent/20 border border-text_accent/40 py-2 text-[8px] text-text_accent font-black uppercase tracking-[0.2em] transition-all"
                      >
                          OPEN TERMINAL CONSOLE
                      </button>
                  </div>
              </Show>

              {/* CELESTIAL LEGEND */}
              <div class="absolute bottom-6 right-6 z-[1001] bg-black/60 border border-white/10 p-2.5 backdrop-blur-md flex flex-col gap-1.5 min-w-[110px]">
                  <div class="text-[7px] font-black text-white/30 tracking-[0.2em] uppercase mb-0.5 border-b border-white/5 pb-1">CELESTIAL_INTEL</div>
                  <div class="flex items-center gap-2">
                      <div class="w-2 h-2 bg-text_accent border border-white/10"></div>
                      <span class="text-[8px] font-black text-white/60 uppercase">Daylight</span>
                  </div>
                  <div class="flex items-center gap-2">
                      <div class="w-2 h-2 bg-[#312e81] border border-white/10"></div>
                      <span class="text-[8px] font-black text-white/60 uppercase">Nightfall</span>
                  </div>
                  <div class="flex items-center gap-2">
                      <div class="w-2 h-2 bg-[#fb923c22] border border-[#fb923c] border-dashed"></div>
                      <span class="text-[8px] font-black text-[#fb923c] uppercase">Twilight</span>
                  </div>
              </div>

               {/* Map Sidebar */}
               <div class={`absolute top-0 left-0 bottom-0 w-[350px] bg-bg_sidebar border-r border-border_main z-[1000] flex flex-col transition-transform duration-300 ${!isSidebarOpen() ? '-translate-x-full' : ''}`}>
                 <div class="p-4 border-b border-border_main bg-bg_header/50 space-y-4">
                    <div class="space-y-2">
                       <span class="text-[8px] font-black text-text_accent uppercase tracking-widest block">ADD MONITORING LOCATION</span>
                       <form onSubmit={handleSearch} class="relative group">
                          <input onInput={(e) => setSearchQuery(e.target.value)} value={searchQuery()} type="text" placeholder="SEARCH CITY NAME..." class="w-full bg-black/80 border border-white/10 px-3 py-2 text-[10px] text-white placeholder:text-white/20 outline-none focus:border-text_accent focus:border-opacity-50 transition-all font-roboto" />
                          <div class="absolute right-2 top-1.5 flex gap-1">
                             <Show when={isSearching()}><span class="w-4 h-4 border-2 border-text_accent border-t-transparent rounded-full animate-spin"></span></Show>
                             <button type="submit" class="text-text_accent hover:text-white transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></button>
                          </div>
                          
                          <Show when={searchResults().length === 0 && searchQuery().length > 2 && !isSearching()}>
                             <div class="absolute top-full left-0 right-0 bg-black border border-orange-500/50 p-4 z-[2000] shadow-2xl animate-in fade-in slide-in-from-top-1 font-roboto">
                                <p class="text-[9px] font-black text-orange-500 uppercase mb-2">LOCATION NOT FOUND IN DATABASE</p>
                                <div class="space-y-2">
                                   <div class="flex gap-1">
                                      <input id="manualLat" type="number" step="any" placeholder="LAT" class="flex-1 bg-black border border-white/20 px-2 py-1 text-[10px] text-white outline-none focus:border-text_accent" />
                                      <input id="manualLng" type="number" step="any" placeholder="LNG" class="flex-1 bg-black border border-white/20 px-2 py-1 text-[10px] text-white outline-none focus:border-text_accent" />
                                   </div>
                                   <button type="button" onClick={() => { const lat = parseFloat(document.getElementById('manualLat').value); const lng = parseFloat(document.getElementById('manualLng').value); if (!isNaN(lat) && !isNaN(lng)) { addCity({ name: searchQuery(), latitude: lat, longitude: lng, timezone: 'UTC' }); } }} class="w-full bg-orange-600 text-white text-[9px] font-black py-1.5 uppercase hover:bg-orange-500 transition-colors">ADD LOCATION MANUALLY</button>
                                </div>
                             </div>
                          </Show>

                          <Show when={searchResults().length > 0}>
                             <div class="absolute top-full left-0 right-0 bg-black/95 border-x border-b border-text_accent/50 z-[2000] shadow-[0_10px_40px_rgba(0,0,0,0.9)] max-h-60 overflow-y-auto win-scroll animate-in fade-in slide-in-from-top-1 font-roboto">
                                <For each={searchResults()}>{(res) => (<button type="button" onClick={() => addCity(res)} class="w-full p-3 text-left hover:bg-text_accent/20 border-b border-white/5 last:border-0 flex justify-between items-center group transition-colors"><div><p class="text-[10px] font-black text-white uppercase group-hover:text-text_accent">{res.name}</p><p class="text-[8px] text-white/40 uppercase">{res.admin1}, {res.country}</p></div><span class="text-[14px] opacity-0 group-hover:opacity-100 transition-opacity font-black text-text_accent">+</span></button>)}</For>
                             </div>
                          </Show>
                       </form>
                    </div>

                    <div class="bg-bg_header border border-border_main p-2 space-y-2">
                       <span class="text-[8px] font-black text-text_accent uppercase tracking-widest block mb-1">METEOROLOGICAL RADAR OVERLAYS</span>
                       <div class="grid grid-cols-3 gap-1">
                          <For each={Object.entries(WEATHER_OVERLAY_CONFIG)}>{([key, cfg]) => (<button onClick={() => setWeatherOverlay(key)} class={`p-1 text-[8px] border truncate transition-all ${weatherOverlay() === key ? 'bg-text_accent border-text_accent text-white' : 'border-white/5 text-white/40 hover:text-white'}`}>{cfg.icon} {cfg.label}</button>)}</For>
                       </div>
                    </div>

                    <div class="flex h-8 bg-bg_header border border-border_main p-0.5">
                       <button onClick={() => setSidebarTab('hubs')} class={`flex-1 text-[9px] font-black uppercase tracking-widest ${sidebarTab() === 'hubs' ? 'bg-text_accent text-white' : 'text-white/40'}`}>LOCATIONS</button>
                       <button onClick={() => setSidebarTab('quakes')} class={`flex-1 text-[9px] font-black uppercase tracking-widest ${sidebarTab() === 'quakes' ? 'bg-red-600 text-white' : 'text-white/40'}`}>SEISMIC ACTIVITY</button>
                    </div>
                 </div>

                 <div class="flex-1 overflow-y-auto win-scroll p-2">
                    <Show when={sidebarTab() === 'hubs'}>
                       <div class="space-y-1">
                          <For each={weatherHubs()}>{(city) => (<div onClick={() => { setSelectedCityName(city.name); focusCity(city.name); }} class={`p-3 bg-white/5 border-l-2 transition-all cursor-pointer ${selectedCityName() === city.name ? 'border-text_accent bg-white/10' : 'border-transparent hover:border-white/20'}`}><div class="flex justify-between items-start"><div><p class="text-[10px] font-black text-white uppercase">{city.name}</p><p class="text-[8px] text-text_accent font-bold uppercase">{weatherData()[city.name] ? weatherData()[city.name].condition : 'ANALYZING...'}</p></div><div class="text-right"><p class="text-[14px] font-black" style={{ color: weatherData()[city.name] ? getTemperatureColor(weatherData()[city.name].temp) : '#fff' }}>{weatherData()[city.name] ? Math.round(weatherData()[city.name].temp) : '--'}°</p><p class="text-[7px] text-white/30">{weatherData()[city.name] ? weatherData()[city.name].time : ''}</p></div></div></div>)}</For>
                       </div>
                    </Show>
                    <Show when={sidebarTab() === 'quakes'}>
                       <div class="px-2 py-2 mb-2 border-b border-white/5">
                          <button onClick={() => setShowQuakes(!showQuakes())} class={`w-full py-2 text-[9px] font-black uppercase border transition-all ${showQuakes() ? 'bg-red-600 border-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'border-red-600/30 text-red-500/60 hover:text-red-500 bg-red-600/5'}`}>
                             {showQuakes() ? 'HIDE SEISMIC PINS' : 'SHOW SEISMIC PINS'}
                          </button>
                       </div>
                       <div class="space-y-4 px-2 py-2">
                          <For each={earthquakes()}>{(eq) => (<div onClick={() => { if (!showQuakes()) setShowQuakes(true); mapInstance.flyTo([eq.lat, eq.lng], 12); }} class="border-l-2 border-red-500 bg-red-600/5 p-3 hover:bg-red-600/10 cursor-pointer"><div class="flex justify-between items-center mb-1"><span class="text-[12px] font-black text-red-500 italic">M{eq.magnitude}</span><span class="text-[8px] text-white/40 font-bold">{eq.jam}</span></div><p class="text-[10px] font-black text-white uppercase tracking-tighter leading-tight">{eq.wilayah}</p><div class="mt-2 text-[7px] text-white/30 uppercase flex justify-between"><span>{eq.tanggal}</span><span>DEPTH: {eq.kedalaman}</span></div></div>)}</For>
                       </div>
                    </Show>
                 </div>
              </div>
              
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen())} class={`absolute top-1/2 -translate-y-1/2 z-[1001] bg-bg_header border border-border_main p-1.5 shadow-xl transition-all ${isSidebarOpen() ? 'left-[350px]' : 'left-0'}`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="text-text_accent" stroke="currentColor" stroke-width="3" style={{ transform: isSidebarOpen() ? 'rotate(0deg)' : 'rotate(180deg)' }}><path d="m15 18-6-6 6-6"/></svg></button>
           </div>

        {/* TERMINAL VIEW - PERSISTENT DOM */}
        <div class={`flex-1 overflow-hidden ${activeTab() === 'terminal' ? '' : 'hidden'}`}>
           <div class="flex-1 flex overflow-hidden h-full">
              <div class="w-64 border-r border-border_main bg-bg_sidebar flex flex-col shrink-0">
                 <div class="p-4 bg-bg_header border-b border-border_main flex items-center justify-between"><span class="text-[10px] font-black text-text_accent uppercase tracking-widest">ACTIVE MONITORING LOCATIONS</span><span class="text-[8px] text-white/30">{weatherHubs().length} UNITS</span></div>
                 <div class="flex-1 overflow-y-auto win-scroll">
                    <For each={weatherHubs()}>{(city) => (
                       <div onClick={() => setSelectedCityName(city.name)} class={`p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 ${selectedCityName() === city.name ? 'bg-text_accent/15 border-l-4 border-text_accent' : ''}`}>
                          <div class="flex justify-between items-center"><p class="text-[12px] font-black text-white uppercase truncate">{city.name}</p><span class="text-[11px] font-black" style={{ color: weatherData()[city.name] ? getTemperatureColor(weatherData()[city.name].temp) : '#fff' }}>{weatherData()[city.name] ? Math.round(weatherData()[city.name].temp)+'°' : '--'}</span></div>
                          <div class="flex justify-between items-center mt-1"><span class="text-[8px] text-text_accent font-bold uppercase">{weatherData()[city.name]?.condition || '...'}</span><span class="text-[8px] text-white/20 uppercase">{city.tz.split('/')[1]}</span></div>
                       </div>
                    )}</For>
                 </div>
              </div>
              
              <div class="flex-1 overflow-y-auto win-scroll p-10 bg-[linear-gradient(to_bottom,var(--bg-header),var(--bg-main))] relative">
                 <div class="absolute inset-0 opacity-5 pointer-events-none" style="background-image: radial-gradient(var(--text-accent) 1px, transparent 1px); background-size: 40px 40px;"></div>
                 
                 <Show when={selectedCityData()} fallback={<div class="h-full flex flex-col items-center justify-center opacity-10"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" class="text-text_accent" stroke="currentColor" stroke-width="1"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><p class="text-[14px] font-black uppercase mt-4 tracking-[10px]">SELECT LOCATION TO START ANALYSIS</p></div>}>
                    <div class="max-w-7xl mx-auto space-y-16 relative">
                       
                       {/* High Intensity Header */}
                       <div class="flex flex-col md:flex-row md:items-end justify-between gap-10 border-b-2 border-text_accent/20 pb-10">
                          <div class="flex items-center gap-10">
                             <div class="text-[100px] font-black leading-none tracking-tighter" style={{ color: getTemperatureColor(selectedCityData().temp) }}>{Math.round(selectedCityData().temp)}<span class="text-[35px] opacity-20 ml-1">°C</span></div>
                             <div class="space-y-3">
                                <h2 class="text-[50px] font-black uppercase text-white leading-none tracking-tight">{selectedCityData().city}</h2>
                                <div class="flex items-center gap-4">
                                   <span class="bg-text_accent text-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em]">{selectedCityData().condition}</span>
                                   <div class="h-6 w-[1px] bg-white/10"></div>
                                   <span class="text-[12px] font-black text-white/40 tracking-[0.3em] uppercase">{selectedCityData().time} LOCAL TIME</span>
                                </div>
                             </div>
                          </div>
                          <div class="grid grid-cols-2 gap-8 text-right bg-white/2 p-6 border border-white/5">
                             <div><p class="text-[10px] text-white/30 font-bold uppercase tracking-widest">LATITUDE</p><p class="text-[14px] font-black text-white">{selectedCityData().lat.toFixed(4)}</p></div>
                             <div><p class="text-[10px] text-white/30 font-bold uppercase tracking-widest">LONGITUDE</p><p class="text-[14px] font-black text-white">{selectedCityData().lng.toFixed(4)}</p></div>
                          </div>
                       </div>

                       {/* Primary Matrix Grid */}
                       <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                          <For each={[
                             { l: 'FEELS LIKE', v: Math.round(selectedCityData().feelsLike)+'°C', c: '#ef4444' },
                             { l: 'WIND VELOCITY', v: selectedCityData().windSpeed+' KM/H', c: '#3b82f6' },
                             { l: 'HUMIDITY INDEX', v: selectedCityData().humidity+'%', c: '#06b6d4' },
                             { l: 'VISIBILITY', v: (selectedCityData().visibility/1000).toFixed(1)+' KM', c: '#8b5cf6' },
                             { l: 'BAROMETRIC PRESSURE', v: selectedCityData().pressure+' HPA', c: '#f59e0b' },
                             { l: 'CLOUD COVERAGE', v: selectedCityData().cloudCover+'%', c: '#94a3b8' }
                          ]}>{(m) => (
                             <div class="p-6 bg-bg_header border border-white/5 space-y-3 relative overflow-hidden group hover:border-text_accent transition-all shadow-xl">
                                <span class="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] block">{m.l}</span>
                                <p class="text-[20px] font-black text-white">{m.v}</p>
                                <div class="h-1 w-full bg-white/5 mt-4 overflow-hidden"><div class="h-full bg-text_accent animate-shimmer" style={{ width: '40%', background: m.c }}></div></div>
                             </div>
                          )}</For>
                       </div>

                       {/* Deep Dive Charts */}
                       <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
                          <div class="p-8 bg-bg_header border border-white/10 shadow-2xl relative overflow-hidden">
                             <div class="absolute top-0 left-0 w-2 h-full bg-red-600/50"></div>
                             <h4 class="text-[11px] font-black text-white uppercase tracking-[0.4em] mb-10 pb-4 border-b border-white/5 flex justify-between items-center">
                                <span>TEMPERATURE ANALYSIS</span>
                                <span class="text-[9px] text-red-500 bg-red-500/10 px-2 py-0.5">HIGH PRECISION DATA</span>
                             </h4>
                             <div class="h-60 w-full relative">
                                <svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none">
                                   <path d={getSparklinePath(selectedCityData().hourly.temp, 500, 100)} fill="none" stroke="#ef4444" stroke-width="3" />
                                   <path d={getSparklinePath(selectedCityData().hourly.temp, 500, 100) + " L 500 100 L 0 100 Z"} fill="url(#gradTempDetail)" />
                                   <defs><linearGradient id="gradTempDetail" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.3"/><stop offset="100%" stop-color="#ef4444" stop-opacity="0"/></linearGradient></defs>
                                </svg>
                             </div>
                             <div class="flex justify-between mt-6 text-[9px] font-black text-white/30 uppercase tracking-widest"><span>START TIME</span><span>THERMAL VARIANCE</span><span>END TIME</span></div>
                          </div>

                          <div class="p-8 bg-bg_header border border-white/10 shadow-2xl relative overflow-hidden">
                             <div class="absolute top-0 left-0 w-2 h-full bg-text_accent/50"></div>
                             <h4 class="text-[11px] font-black text-white uppercase tracking-[0.4em] mb-10 pb-4 border-b border-white/5 flex justify-between items-center">
                                <span>PRECIPITATION DATA</span>
                                <span class="text-[9px] text-text_accent bg-text_accent/10 px-2 py-0.5">MOISTURE ANALYSIS</span>
                             </h4>
                             <div class="h-60 w-full relative">
                                <svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none">
                                   <path d={getSparklinePath(selectedCityData().hourly.precip, 500, 100)} fill="none" class="stroke-text_accent" stroke-width="3" />
                                   <path d={getSparklinePath(selectedCityData().hourly.precip, 500, 100) + " L 500 100 L 0 100 Z"} fill="url(#gradPreDetail)" />
                                   <defs><linearGradient id="gradPreDetail" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" class="stop-color-text-accent" stop-opacity="0.3"/><stop offset="100%" class="stop-color-text-accent" stop-opacity="0"/></linearGradient></defs>
                                </svg>
                             </div>
                             <div class="flex justify-between mt-6 text-[9px] font-black text-white/30 uppercase tracking-widest"><span>MOISTURE MIN</span><span>PRECIPITATION FLUX</span><span>MOISTURE MAX</span></div>
                          </div>
                       </div>

                       {/* 7-Day Forecasting Grid */}
                       <div class="bg-bg_header border border-text_accent/30 shadow-2xl">
                          <div class="p-6 border-b border-white/5 px-8 flex justify-between items-center bg-text_accent/5">
                              <div class="flex items-center gap-4">
                                 <span class="text-[12px] font-black text-white uppercase tracking-[0.5em]">7-DAY METEOROLOGICAL FORECAST</span>
                                 <div class="px-2 py-0.5 bg-text_accent text-white text-[9px] font-black">LONG RANGE DATA</div>
                              </div>
                              <button onClick={() => fetchDetailedWeather(selectedCityName())} class="text-[10px] font-black text-white bg-text_accent hover:opacity-80 px-6 py-2 transition-all uppercase tracking-widest">VIEW DETAILED ANALYSIS</button>
                          </div>
                          <div class="grid grid-cols-1 md:grid-cols-7 divide-x divide-white/5">
                             <For each={selectedCityData().daily.time}>{(day, i) => (
                                <div class="p-8 hover:bg-white/5 transition-all text-center group border-b md:border-b-0 border-white/5">
                                   <p class="text-[10px] font-black text-white/30 uppercase mb-6">{new Date(day).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit' })}</p>
                                   <div class="text-[48px] mb-8 group-hover:scale-110 transition-transform duration-500">{getWeatherEmoji(selectedCityData().daily.weatherCode[i()])}</div>
                                   <div class="space-y-2 mb-6">
                                      <p class="text-[28px] font-black text-white leading-none">{Math.round(selectedCityData().daily.tempMax[i()])}°</p>
                                      <p class="text-[12px] font-bold text-white/20">{Math.round(selectedCityData().daily.tempMin[i()])}°</p>
                                   </div>
                                   <div class="pt-6 border-t border-white/5 flex flex-col gap-2">
                                      <div class="flex items-center justify-between text-[9px] font-black uppercase text-text_accent"><span>WIND</span><span>{selectedCityData().daily.windGust[i()].toFixed(0)}K</span></div>
                                      <div class="flex items-center justify-between text-[9px] font-black uppercase text-text_accent"><span>PRECIP</span><span>{selectedCityData().daily.precipSum[i()].toFixed(1)}M</span></div>
                                   </div>
                                </div>
                             )}</For>
                          </div>
                       </div>
                       
                       {/* Climatic Impact Assessment Matrix */}
                       <div class="p-8 bg-bg_header border border-white/10 shadow-xl overflow-hidden">
                          <h4 class="text-[11px] font-black text-white/40 uppercase tracking-[0.4em] mb-8 border-b border-white/10 pb-4">CLIMATIC IMPACT ASSESSMENT</h4>
                          <table class="w-full text-left">
                             <thead>
                                <tr class="text-[10px] text-text_accent uppercase tracking-widest border-b border-white/10"><th class="pb-4">PARAMETER</th><th class="pb-4">CURRENT VALUE</th><th class="pb-4">LEVEL</th><th class="pb-4">ADVISORY</th></tr>
                             </thead>
                             <tbody class="divide-y divide-white/5">
                                <tr class="group hover:bg-white/2 transition-all"><td class="py-5 text-[11px] font-black text-white uppercase">THERMAL TREND</td><td class="py-5 text-[11px] font-bold text-white">{selectedCityData().temp}°C</td><td class="py-5"><span class={`px-2 py-0.5 text-[8px] font-black rounded-sm ${selectedCityData().temp > 35 ? 'bg-red-500 text-white' : 'bg-green-500/20 text-green-500'}`}>{selectedCityData().temp > 35 ? 'CRITICAL' : 'STABLE'}</span></td><td class="py-5 text-[10px] text-white/40 italic uppercase">Operational stability confirmed. No cooling required.</td></tr>
                                <tr class="group hover:bg-white/2 transition-all"><td class="py-5 text-[11px] font-black text-white uppercase">PRECIPITATION PROBABILITY</td><td class="py-5 text-[11px] font-bold text-white">{selectedCityData().precipProb}%</td><td class="py-5"><span class={`px-2 py-0.5 text-[8px] font-black rounded-sm ${selectedCityData().precipProb > 60 ? 'bg-text_accent text-white' : 'bg-white/20 text-white'}`}>{selectedCityData().precipProb > 60 ? 'HIGH' : 'LOW'}</span></td><td class="py-5 text-[10px] text-white/40 italic uppercase">Minimal risk of precipitation in the next 6-hour window.</td></tr>
                                <tr class="group hover:bg-white/2 transition-all"><td class="py-5 text-[11px] font-black text-white uppercase">WIND TURBULENCE</td><td class="py-5 text-[11px] font-bold text-white">{selectedCityData().windSpeed} KM/H</td><td class="py-5"><span class={`px-2 py-0.5 text-[8px] font-black rounded-sm ${selectedCityData().windSpeed > 40 ? 'bg-orange-500 text-white' : 'bg-green-500/20 text-green-500'}`}>{selectedCityData().windSpeed > 40 ? 'CAUTION' : 'NOMINAL'}</span></td><td class="py-5 text-[10px] text-white/40 italic uppercase">Nominal conditions for logistics and aviation operations.</td></tr>
                             </tbody>
                          </table>
                       </div>

                    </div>
                 </Show>
              </div>
           </div>
        </div>

      </div>

      {/* DETAIL MODAL (Overlay Slide-up) */}
      <Show when={showDetail()}>
         <div class="absolute inset-0 z-[5000] bg-bg_main flex flex-col animate-in slide-in-from-bottom duration-500 shadow-[0_-50px_100px_rgba(0,0,0,0.8)]">
            <div class="p-6 border-b-2 border-text_accent bg-bg_header flex justify-between items-center shrink-0">
               <div class="flex items-center gap-6">
                  <button onClick={() => setShowDetail(false)} class="text-white/40 hover:text-white transition-colors flex items-center gap-2 group">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="group-hover:-translate-x-1 transition-transform"><path d="m15 18-6-6 6-6"/></svg>
                     <span class="text-[12px] font-black uppercase tracking-[0.3em]">EXIT DETAILED VIEW</span>
                  </button>
                  <div class="h-10 w-[1px] bg-white/10"></div>
                  <h2 class="text-[24px] font-black text-white uppercase tracking-tighter leading-none">{detailedData()?.name} // METEOROLOGICAL DATA REPORT</h2>
               </div>
               <div class="flex items-center gap-4">
                  <span class="text-[10px] font-black text-white/20 uppercase">SOURCE: GLOBAL METEOROLOGICAL DATA</span>
                  <div class="px-3 py-1 bg-text_accent text-white font-black text-[12px] uppercase">DATA SYNCHRONIZATION COMPLETE</div>
               </div>
            </div>
            
            <div class="flex-1 overflow-y-auto win-scroll p-12 space-y-16">
               <div class="grid grid-cols-4 gap-10">
                  <div class="p-10 bg-bg_header border-l-4 border-red-600 shadow-2xl relative">
                     <span class="text-[10px] font-black text-text_accent block mb-3 tracking-widest uppercase">CURRENT DATA INTENSITY</span>
                     <p class="text-[56px] font-black text-white leading-none tracking-tighter">{Math.round(detailedData()?.current.temp)}°C</p>
                     <p class="text-[14px] font-black text-white/30 mt-2 uppercase tracking-widest">{detailedData()?.current.condition}</p>
                     <div class="absolute top-10 right-8 text-[60px] opacity-10">{getWeatherEmoji(detailedData()?.current.code)}</div>
                  </div>
                  <div class="col-span-3 grid grid-cols-4 gap-6">
                     <For each={[
                        { l: 'FEELS LIKE', v: Math.round(detailedData()?.current.feelsLike)+'°', c: '#ef4444' },
                        { l: 'MOISTURE', v: detailedData()?.current.humidity+'%', c: '#06b6d4' },
                        { l: 'UV INDEX', v: 'NOMINAL', c: '#f59e0b' },
                        { l: 'VISIBILITY RANGE', v: (detailedData()?.current.visibility/1000).toFixed(0)+'KM', c: '#8b5cf6' }
                     ]}>{(m) => (
                          <div class="p-8 bg-bg_header border border-border_main space-y-2 group hover:border-text_accent transition-all">
                             <span class="text-[10px] font-black text-white/30 uppercase tracking-widest">{m.l}</span>
                             <p class="text-[24px] font-black text-white">{m.v}</p>
                             <div class="h-1 bg-border_main mt-4"><div class="h-full bg-text_accent" style={{ width: '30%', background: m.c }}></div></div>
                          </div>
                      )}</For>
                  </div>
               </div>

               <div class="bg-bg_sidebar border border-white/5 p-12 shadow-inner">
                  <h3 class="text-[14px] font-black text-white uppercase tracking-[0.6em] mb-12 pb-6 border-b border-white/5 flex items-center justify-between">
                     <div class="flex items-center gap-4"><span class="w-2 h-2 bg-red-600 shadow-[0_0_10px_#ef4444]"></span> 14-DAY TEMPERATURE HISTORY</div>
                     <span class="text-[9px] text-white/20">UPDATE INTERVAL: 60M</span>
                  </h3>
                  <div class="h-80 w-full relative">
                     <svg width="100%" height="100%" viewBox="0 0 1000 150" preserveAspectRatio="none">
                        <path d={getSparklinePath(detailedData()?.timeline.map(t=>t.temp), 1000, 150)} fill="none" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />
                        <path d={getSparklinePath(detailedData()?.timeline.map(t=>t.temp), 1000, 150) + " L 1000 150 L 0 150 Z"} fill="url(#gradDetailedLg)" />
                        <defs><linearGradient id="gradDetailedLg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.3" /><stop offset="100%" stop-color="#ef4444" stop-opacity="0" /></linearGradient></defs>
                        <line x1="500" y1="0" x2="500" y2="150" class="stroke-text_accent" stroke-width="2" stroke-dasharray="10,5" />
                     </svg>
                     <div class="flex justify-between mt-8 text-[11px] font-black uppercase">
                        <span class="text-white/10 italic">PAST 7 DAYS</span>
                        <div class="flex items-center gap-2 text-text_accent"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><circle cx="12" cy="12" r="10"/></svg> CURRENT TIME</div>
                        <span class="text-white/10 italic">NEXT 7 DAYS</span>
                     </div>
                  </div>
               </div>

               <div class="grid grid-cols-2 gap-12">
                  <div class="p-10 bg-bg_sidebar border border-white/5 shadow-xl">
                     <h4 class="text-[12px] font-black text-text_accent uppercase tracking-[0.4em] border-b border-white/5 pb-6 mb-10 flex justify-between"><span>HISTORICAL PRECIPITATION DATA</span><span class="opacity-20 italic">VARIANCE</span></h4>
                     <div class="h-56 w-full"><svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none"><path d={getSparklinePath(detailedData()?.timeline.map(t=>t.precip), 500, 100)} fill="none" class="stroke-text_accent" stroke-width="3" /><path d={getSparklinePath(detailedData()?.timeline.map(t=>t.precip), 500, 100) + " L 500 100 L 0 100 Z"} class="fill-text_accent/10" /></svg></div>
                  </div>
                  <div class="p-10 bg-bg_sidebar border border-white/5 shadow-xl">
                     <h4 class="text-[12px] font-black text-green-500 uppercase tracking-[0.4em] border-b border-white/5 pb-6 mb-10 flex justify-between"><span>WIND VELOCITY DATA</span><span class="opacity-20 italic">VARIANCE</span></h4>
                     <div class="h-56 w-full"><svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none"><path d={getSparklinePath(detailedData()?.timeline.map(t=>t.wind), 500, 100)} fill="none" stroke="#10b981" stroke-width="3" /><path d={getSparklinePath(detailedData()?.timeline.map(t=>t.wind), 500, 100) + " L 500 100 L 0 100 Z"} fill="#10b98125" /></svg></div>
                  </div>
               </div>
            </div>
         </div>
      </Show>

    </div>
  );
}

function Badge({ children, class: cls }) {
  return <span class={`px-2 py-0.5 rounded-full text-[9px] font-bold ${cls}`}>{children}</span>;
}
