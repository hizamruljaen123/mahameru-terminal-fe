import { createSignal, onMount, onCleanup, Show, For, createEffect } from 'solid-js';

export default function SatelliteMappingPanel() {
  let globeInstance = null;
  let animationFrame = null;
  const [loading, setLoading] = createSignal(true);
  const [satellites, setSatellites] = createSignal([]);
  const [currentPage, setCurrentPage] = createSignal(1);
  const [selectedSat, setSelectedSat] = createSignal(null);
  const [countries, setCountries] = createSignal([]);
  const [nearestCountry, setNearestCountry] = createSignal(null);
  const [verifiedCountries, setVerifiedCountries] = createSignal([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [isFiltering, setIsFiltering] = createSignal(false);
  const [satTerritories, setSatTerritories] = createSignal({});
  const [mapStyle, setMapStyle] = createSignal('NATURAL');
  const [satWeather, setSatWeather] = createSignal(null);
  const [groundTab, setGroundTab] = createSignal('OPTICAL'); // 'OPTICAL', 'NASA_GIBS'
  const [activeGibsCategory, setActiveGibsCategory] = createSignal('visual_and_reference');
  const [activeGibsLayer, setActiveGibsLayer] = createSignal('MODIS_Terra_CorrectedReflectance_TrueColor');
  const [showGibsModal, setShowGibsModal] = createSignal(false);

  // MAIN TABS
  const [mainTab, setMainTab] = createSignal('SATELLITE TRACKING'); // 'SATELLITE TRACKING' or 'EARTH IMAGERY'

  // NASA SATELLITE MODULE STATE
  const [osmQuery, setOsmQuery] = createSignal('');
  const [osmResults, setOsmResults] = createSignal([]);
  const [isSearchingOsm, setIsSearchingOsm] = createSignal(false);
  const [nasaTarget, setNasaTarget] = createSignal(null); // {lat, lon, label}
  
  const [nasaRange, setNasaRange] = createSignal(1.0);
  const [nasaGrid, setNasaGrid] = createSignal(10);
  const [nasaDate, setNasaDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [nasaLoading, setNasaLoading] = createSignal(false);
  const [nasaProgress, setNasaProgress] = createSignal(0);
  const [nasaProcessedLayers, setNasaProcessedLayers] = createSignal([]);
  const [nasaActiveLayerId, setNasaActiveLayerId] = createSignal(null);
  const [nasaSelectedLayers, setNasaSelectedLayers] = createSignal(['MODIS_Terra_CorrectedReflectance_TrueColor']);
  let nasaCanvasRef;
  let nasaAbortController = null;

  // Manual Input
  const [manualTitle, setManualTitle] = createSignal('');
  const [manualLat, setManualLat] = createSignal('');
  const [manualLon, setManualLon] = createSignal('');
  const [isManualTargeting, setIsManualTargeting] = createSignal(false);

  // Time Series
  const [nasaMissionMode, setNasaMissionMode] = createSignal('SNAPSHOT'); // 'SNAPSHOT', 'TIME_SERIES'
  const [nasaEndDate, setNasaEndDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [nasaTimeSeriesRuns, setNasaTimeSeriesRuns] = createSignal([]);
  const [activeNasaTSIndex, setActiveNasaTSIndex] = createSignal(0);

  const handleManualLock = () => {
     if (manualLat() && manualLon()) {
        setNasaTarget({
            lat: parseFloat(manualLat()),
            lon: parseFloat(manualLon()),
            label: manualTitle() || `MANUAL COORDINATES [${manualLat()}, ${manualLon()}]`
        });
     }
  };

  const handleOsmSearch = async (e) => {
    if (e.key === 'Enter' && osmQuery().trim()) {
        const query = osmQuery().trim();
        setIsSearchingOsm(true);
        
        // Manual Coordinate Parsing: "LAT, LON"
        const coordMatch = query.match(/^([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)$/);
        if (coordMatch) {
            setNasaTarget({
                lat: parseFloat(coordMatch[1]),
                lon: parseFloat(coordMatch[2]),
                label: `MANUAL COORDINATES [${coordMatch[1]}, ${coordMatch[2]}]`
            });
            setOsmResults([]);
            setIsSearchingOsm(false);
            return;
        }

        try {
            const resp = await fetch(`${import.meta.env.VITE_SATELLITE_VISUAL_API}/api/osm/search?q=${encodeURIComponent(query)}`);
            const json = await resp.json();
            if (json.status === 'success') {
                setOsmResults(json.data);
            }
        } catch(err) {
            console.error(err);
        }
        setIsSearchingOsm(false);
    }
  };

  const executeNasaUplink = async () => {
     if (!nasaTarget()) return;
     if (nasaAbortController) nasaAbortController.abort();
     anyAbortController = new AbortController();
     const signal = anyAbortController.signal;
     nasaAbortController = anyAbortController;

     setNasaLoading(true);
     setNasaProgress(0);
     setNasaProcessedLayers([]);
     setNasaActiveLayerId(null);
     setNasaTimeSeriesRuns([]);
     setActiveNasaTSIndex(0);

     const mode = nasaMissionMode();
     const startObj = new Date(nasaDate());
     const endObj = mode === 'TIME_SERIES' ? new Date(nasaEndDate()) : new Date(nasaDate());
     
     let dateList = [];
     let currDate = new Date(startObj);
     while (currDate <= endObj) {
         dateList.push(currDate.toISOString().split('T')[0]);
         currDate.setDate(currDate.getDate() + 1);
     }
     
     if (dateList.length > 20) dateList = dateList.slice(0, 20);

     const layersToProcess = nasaSelectedLayers();
     let completedGlobal = 0;
     const totalFetches = dateList.length * layersToProcess.length;

     const runs = [];

     for (const dStr of dateList) {
         if (signal.aborted) break;
         
         const dailyLayers = [];
         let firstLayerId = null;

         for (const layerId of layersToProcess) {
             if (signal.aborted) break;
             try {
                 let layerName = layerId;
                 Object.values(GIBS_HIERARCHY).forEach(cat => {
                     const found = cat.find(l => l.id === layerId);
                     if (found) layerName = found.name;
                 });

                 const fetchWithTimeout = async (url) => {
                     const timeoutId = setTimeout(() => nasaAbortController && nasaAbortController.abort(), 30000); 
                     const response = await fetch(url, { signal });
                     clearTimeout(timeoutId);
                     return response;
                 };

                 const resp = await fetchWithTimeout(`${import.meta.env.VITE_DISASTER_API}/api/disaster/nasa_imagery?lat=${nasaTarget().lat}&lon=${nasaTarget().lon}&date=${dStr}&range_deg=${nasaRange()}&grid_size=${nasaGrid()}&layers=${layerId},Coastlines_15m,Reference_Features_15m`);
                 const result = await resp.json();
                 
                 if (result.status === 'success') {
                     const data = result.data;
                     const layerCanvas = document.createElement('canvas');
                     layerCanvas.width = data.canvas_size;
                     layerCanvas.height = data.canvas_size;
                     const ctx = layerCanvas.getContext('2d');
                     ctx.fillStyle = '#0a1628';
                     ctx.fillRect(0, 0, data.canvas_size, data.canvas_size);
                     
                     let tilesLoaded = 0;
                     for (const tile of data.tiles) {
                         if (signal.aborted) break;
                         await new Promise((resolve) => {
                             const img = new Image();
                             img.onload = () => {
                                 ctx.drawImage(img, tile.col * data.img_res, tile.row * data.img_res);
                                 tilesLoaded++;
                                 setTimeout(resolve, 30); 
                             };
                             img.onerror = () => { tilesLoaded++; resolve(); };
                             img.src = tile.url;
                         });
                     }
                     dailyLayers.push({ id: layerId, name: layerName, canvas: layerCanvas });
                     if (!firstLayerId) firstLayerId = layerId;
                 }
             } catch (e) {
                 console.error("Layer error", e);
             }
             completedGlobal++;
             setNasaProgress(Math.round((completedGlobal / totalFetches) * 100));
         }

         if (dailyLayers.length > 0) {
             runs.push({ date: dStr, layers: dailyLayers });
             setNasaTimeSeriesRuns([...runs]);
             if (runs.length === 1) {
                 setNasaProcessedLayers(dailyLayers);
                 setNasaActiveLayerId(firstLayerId);
             }
         }
     }
     
     if (!signal.aborted) setNasaLoading(false);
  };

  createEffect(() => {
     const idx = activeNasaTSIndex();
     const runs = nasaTimeSeriesRuns();
     if (runs.length > 0 && runs[idx]) {
         setNasaProcessedLayers(runs[idx].layers);
         const activeId = nasaActiveLayerId();
         if (!runs[idx].layers.find(l => l.id === activeId)) {
             setNasaActiveLayerId(runs[idx].layers[0]?.id);
         }
     }
  });

  createEffect(() => {
     const activeId = nasaActiveLayerId();
     const layers = nasaProcessedLayers();
     if (activeId && layers.length > 0 && nasaCanvasRef) {
         const layer = layers.find(l => l.id === activeId);
         if (layer) {
             const ctx = nasaCanvasRef.getContext('2d');
             nasaCanvasRef.width = layer.canvas.width;
             nasaCanvasRef.height = layer.canvas.height;
             ctx.drawImage(layer.canvas, 0, 0);
         }
     }
  });

  const toggleNasaLayer = (id) => {
    if (nasaSelectedLayers().includes(id)) {
        setNasaSelectedLayers(nasaSelectedLayers().filter(l => l !== id));
    } else {
        setNasaSelectedLayers([...nasaSelectedLayers(), id]);
    }
  };

  const GIBS_HIERARCHY = {
    "visual_and_reference": [
      { id: "MODIS_Terra_CorrectedReflectance_TrueColor", name: "TRUE COLOR (TERRA)" },
      { id: "MODIS_Aqua_CorrectedReflectance_TrueColor", name: "TRUE COLOR (AQUA)" },
      { id: "VIIRS_SNPP_CorrectedReflectance_TrueColor", name: "TRUE COLOR (VIIRS)" },
      { id: "Coastlines_15m", name: "COASTAL BOUNDARY" },
      { id: "Reference_Features_15m", name: "GEO REFERENCE" }
    ],
    "hazards_and_fire": [
      { id: "MODIS_Terra_Thermal_Anomalies_All", name: "THERMAL ANOMALIES" },
      { id: "VIIRS_SNPP_Thermal_Anomalies_375m_All", name: "HIGH-RES FIRE" },
      { id: "MODIS_Terra_Aerosol", name: "AEROSOL DENSITY" }
    ],
    "water_and_ocean": [
      { id: "MODIS_Terra_Sea_Surface_Temp_Day", name: "SEA SURFACE TEMP" },
      { id: "MODIS_Terra_Chlorophyll_A", name: "CHLOROPHYLL DENSITY" },
      { id: "GHRS_L4_MUR_Sea_Surface_Temperature", name: "GLOBAL SST ANALYSIS" }
    ],
    "atmosphere_and_weather": [
      { id: "MODIS_Terra_Cloud_Top_Height", name: "CLOUD ALTITUDE" },
      { id: "GPM_IMERG_Late_Precipitation_Cal", name: "PRECIPITATION GRID" },
      { id: "MODIS_Terra_Water_Vapor_5km", name: "ATMOSPHERIC VAPOR" }
    ],
    "land_and_vegetation": [
      { id: "MODIS_Terra_NDVI_8Day", name: "VEGETATION INDEX" },
      { id: "MODIS_Terra_Land_Surface_Temp_Day", name: "LAND SURFACE TEMP" },
      { id: "MODIS_Terra_Snow_Cover", name: "SNOW DISTRIBUTION" }
    ],
    "cryosphere": [
      { id: "Sea_Ice_Concentration_Blue_Marble", name: "SEA ICE FLUX" }
    ]
  };

  const createGibsBbox = (lat, lon, kmRadius = 40) => {
    const delta = kmRadius / 111.0;
    const south = lat - delta;
    const west = lon - delta;
    const north = lat + delta;
    const east = lon + delta;
    return `${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)}`;
  };

  const getGibsUrl = () => {
     const sat = selectedSat();
     if (!sat) return "";
     const bbox = createGibsBbox(sat.lat, sat.lon);
     const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
     const layers = `${activeGibsLayer()},Coastlines_15m,Reference_Features_15m`;
     return `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&LAYERS=${layers}&CRS=EPSG:4326&BBOX=${bbox}&FORMAT=image/jpeg&WIDTH=1200&HEIGHT=800&TIME=${yesterday}`;
  };
  
  const ITEMS_PER_PAGE = 50;

  const MAP_STYLES = {
    'SATELLITE': 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    'NATURAL': 'https://unpkg.com/three-globe/example/img/earth-night.jpg',
    'VECTOR DARK': 'https://unpkg.com/three-globe/example/img/earth-dark.jpg',
    'VECTOR LIGHT': 'https://unpkg.com/three-globe/example/img/earth-day.jpg'
  };

  const DEG2RAD = Math.PI / 180;
  const EARTH_ROT_RATE = (2 * Math.PI) / (23.9344696 * 60 * 60 * 1000); // rad/ms

  onMount(() => {
    initMap();
    fetchSatelliteData();
    fetchCountryData();
    window.addEventListener('resize', handleResize);
  });

  createEffect(() => {
     const slice = currentItems();
     if (countries().length > 0 && slice.length > 0) {
        refreshTerritories(slice);
     }
  });

  createEffect(() => {
     const style = mapStyle();
     if (globeInstance) globeInstance.globeImageUrl(MAP_STYLES[style]);
  });

  onCleanup(() => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    window.removeEventListener('resize', handleResize);
    const el = document.getElementById('sat-globe-map');
    if (el) el.innerHTML = '';
  });

  const handleResize = () => {
      const el = document.getElementById('sat-globe-map');
      if (globeInstance && el) {
          globeInstance.width(el.clientWidth);
          globeInstance.height(el.clientHeight);
      }
  };

  const initMap = () => {
    const el = document.getElementById('sat-globe-map');
    
    globeInstance = window.Globe()(el)
      .globeImageUrl(MAP_STYLES[mapStyle()])
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
      .htmlElementsData([])
      .htmlLat('lat')
      .htmlLng('lon')
      .htmlAltitude('alt')
      .htmlElement(d => {
          const isSelected = d.isSelected;
          const color = isSelected ? '#00ff41' : '#00f2ff';
          const element = document.createElement('div');
          element.innerHTML = `
            <div style="position: relative; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                ${isSelected ? `
                  <div style="position: absolute; width: 80px; height: 80px; border: 1px solid #00ff41; border-radius: 50%; animation: pulse-green 1.5s infinite; opacity: 0.3;"></div>
                  <div style="position: absolute; width: 120px; height: 120px; border: 1px dashed #00ff41; border-radius: 50%; opacity: 0.2; animation: spin-slow 20s linear infinite;"></div>
                  <div style="position: absolute; width: 2px; height: 32px; background: #00ff41; filter: drop-shadow(0 0 5px #00ff41);"></div>
                  <div style="position: absolute; width: 32px; height: 2px; background: #00ff41; filter: drop-shadow(0 0 5px #00ff41);"></div>
                ` : ''}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" style="filter: drop-shadow(0 0 8px ${color}); ${isSelected ? 'animation: blink 0.8s infinite alternate;' : ''}">
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2l.5-.5a4.05 4.05 0 0 0 4.6 4.3 4.05 4.05 0 0 0 4.5-4.5 4.05 4.05 0 0 0-4.3-4.6l.5-.5Z"/>
                    <path d="m15.4 6.5-2.8 2.8"/>
                    <path d="m19 2.5-4.6 4.6"/>
                    <path d="M8.5 15.4 5.7 18.2"/>
                    <path d="M11 11h.01"/>
                </svg>
            </div>
          `;
          element.style.pointerEvents = 'auto';
          element.style.cursor = 'crosshair';
          element.onclick = () => {
              setSelectedSat(d);
              if (globeInstance) globeInstance.pointOfView({ lat: d.lat, lng: d.lon, altitude: 1.2 }, 1000);
          };
          return element;
      })
      
    globeInstance.pointOfView({ lat: 0, lng: 0, altitude: 3.5 });
    globeInstance.controls().autoRotate = true;
    globeInstance.controls().autoRotateSpeed = 0.5;

    startKinematicEngine();
  };

  const handleZoom = (direction) => {
    if (!globeInstance) return;
    const currentView = globeInstance.pointOfView();
    const newAlt = direction === 'in' ? currentView.altitude * 0.7 : currentView.altitude * 1.4;
    globeInstance.pointOfView({ altitude: Math.max(0.1, Math.min(10, newAlt)) }, 600);
  };

  const fetchSatelliteData = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SATELLITE_VISUAL_API}/api/satellites/active`);
      const data = await res.json();
      if (data.status === 'success') {
          const parsed = data.data.map(str => {
              const s = str;
              return {
                  id: s.NORAD_CAT_ID,
                  name: s.OBJECT_NAME,
                  type: s.CLASSIFICATION_TYPE,
                  epochTime: new Date(s.EPOCH).getTime(),
                  meanMotionSpeed: (s.MEAN_MOTION * 2 * Math.PI) / (24 * 60 * 60 * 1000),
                  meanAnomaly0: s.MEAN_ANOMALY * DEG2RAD,
                  argPeri: s.ARG_OF_PERICENTER * DEG2RAD,
                  inclination: s.INCLINATION * DEG2RAD,
                  raan: s.RA_OF_ASC_NODE * DEG2RAD,
                  eccentricity: s.ECCENTRICITY,
                  raw: s
              };
          });
          setSatellites(parsed);
      }
    } catch (e) {
      console.error("Satellite Tracking: Constellation data error", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCountryData = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_GEO_DATA_API}/api/geo/countries/lite`);
      const data = await res.json();
      if (data.status === 'success') {
          setCountries(data.data.map(c => ({
            ...c,
            lat: Number(c.lat),
            lon: Number(c.lon)
          })));
      }
    } catch (e) {
      console.error("Satellite Tracking: Geo-registry error", e);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * DEG2RAD;
    const dLon = (lon2 - lon1) * DEG2RAD;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateLivePos = (s, epochTime, now) => {
      const dt = now - epochTime;
      const M = (s.MEAN_ANOMALY * DEG2RAD) + ((s.MEAN_MOTION * 2 * Math.PI) / (24 * 60 * 60 * 1000)) * dt;
      const u = (s.ARG_OF_PERICENTER * DEG2RAD) + M;
      const z = Math.sin(u) * Math.sin(s.INCLINATION * DEG2RAD);
      const lat = Math.asin(z) / DEG2RAD;

      const theta = EARTH_ROT_RATE * dt;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const x = Math.cos(u) * Math.cos(s.RA_OF_ASC_NODE * DEG2RAD) - Math.sin(u) * Math.sin(s.RA_OF_ASC_NODE * DEG2RAD) * Math.cos(s.INCLINATION * DEG2RAD);
      const y = Math.cos(u) * Math.sin(s.RA_OF_ASC_NODE * DEG2RAD) + Math.sin(u) * Math.cos(s.RA_OF_ASC_NODE * DEG2RAD) * Math.cos(s.INCLINATION * DEG2RAD);
      const xEcef = x * cosT + y * sinT;
      const yEcef = -x * sinT + y * cosT;
      const lon = Math.atan2(yEcef, xEcef) / DEG2RAD;
      
      return { lat, lon };
  };

  const findNearestCountry = (satLat, satLon) => {
     if (countries().length === 0) return null;
     let minDistance = Infinity;
     let nearest = null;
     
     const list = countries();
     for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (!c.lat || !c.lon) continue;
        const dist = calculateDistance(satLat, satLon, c.lat, c.lon);
        if (dist < minDistance) {
           minDistance = dist;
           nearest = c;
        }
     }
     if (!nearest || minDistance > 1500) return null; 
     return { ...nearest, distance: minDistance };
  };

  const refreshTerritories = (slice) => {
    const now = Date.now();
    const newMap = {};
    slice.forEach(sat => {
       const pos = calculateLivePos(sat.raw, sat.epochTime, now);
       const country = findNearestCountry(pos.lat, pos.lon);
       newMap[sat.id] = country ? country.name : "INTERNATIONAL WATERS";
    });
    setSatTerritories(newMap);
  };

  const filteredSatellites = () => {
    const all = satellites();
    const query = searchQuery().trim().toUpperCase();
    if (!isFiltering() || !query) return all;
    
    const targetCountry = countries().find(c => 
       (c.name && c.name.toUpperCase().includes(query)) || 
       (c.code && c.code.toUpperCase() === query)
    );
    
    if (!targetCountry) return [];
    const now = Date.now();
    return all.filter(sat => {
       const pos = calculateLivePos(sat.raw, sat.epochTime, now);
       const dist = calculateDistance(pos.lat, pos.lon, targetCountry.lat, targetCountry.lon);
       return dist < 2000; 
    });
  };

  const currentItems = () => filteredSatellites().slice((currentPage() - 1) * ITEMS_PER_PAGE, currentPage() * ITEMS_PER_PAGE);
  const totalPages = () => Math.max(1, Math.ceil(filteredSatellites().length / ITEMS_PER_PAGE));

  const calculatePositions = (nowMs) => {
    const sats = currentItems();
    const features = [];
    
    for (let i = 0; i < sats.length; i++) {
        const s = sats[i];
        const dt = nowMs - s.epochTime;
        const M = s.meanAnomaly0 + s.meanMotionSpeed * dt;
        const u = s.argPeri + M;
        const cosu = Math.cos(u), sinu = Math.sin(u);
        const cosI = Math.cos(s.inclination), sinI = Math.sin(s.inclination);
        const cosO = Math.cos(s.raan), sinO = Math.sin(s.raan);
        
        const x = cosu * cosO - sinu * sinO * cosI;
        const y = cosu * sinO + sinu * cosO * cosI;
        const z = sinu * sinI;
        
        const theta = EARTH_ROT_RATE * dt;
        const cosT = Math.cos(theta), sinT = Math.sin(theta);
        const xEcef = x * cosT + y * sinT;
        const yEcef = -x * sinT + y * cosT;
        
        const lat = Math.asin(z) / DEG2RAD;
        const lon = Math.atan2(yEcef, xEcef) / DEG2RAD;
        
        const MU = 3.986004418e14, R_EARTH = 6371000;
        const n_rad_s = (s.raw.MEAN_MOTION * 2 * Math.PI) / 86400;
        const a_meters = Math.pow(MU / (n_rad_s * n_rad_s), 1/3);
        const alt_globe_units = Math.max(a_meters - R_EARTH, 100000) / R_EARTH;
        
        features.push({
            id: s.id, name: s.name, type: s.type,
            lat: lat, lon: lon, alt: alt_globe_units, 
            isSelected: selectedSat()?.id === s.id,
            raw: s.raw
        });
    }
    return features;
  };

  let lastBackendCheck = 0;
  let lastWeatherCheck = 0;

  const fetchVerifiedRange = async (lat, lon) => {
     const now = Date.now();
     if (now - lastBackendCheck < 5000) return;
     lastBackendCheck = now;
     try {
        const res = await fetch(`${import.meta.env.VITE_GEO_DATA_API}/api/geo/countries/in-range?lat=${lat}&lon=${lon}&radius=5.0`);
        const data = await res.json();
        if (data.status === 'success') setVerifiedCountries(data.data);
     } catch (e) {}
  };

  const fetchWeatherIntel = async (lat, lon) => {
     const now = Date.now();
     if (now - lastWeatherCheck < 10000) return; 
     lastWeatherCheck = now;
     try {
        const res = await fetch(`${import.meta.env.VITE_GEO_DATA_API}/api/weather/forecast?lat=${lat}&lng=${lon}`);
        const data = await res.json();
        if (data && data.current_weather) {
           setSatWeather(data.current_weather);
        }
     } catch (e) {}
  };

  let lastUpdate = 0;
  const startKinematicEngine = () => {
    const animate = (time) => {
        if (time - lastUpdate > 100) {
            const now = Date.now();
            const features = calculatePositions(now);
            if (globeInstance) globeInstance.htmlElementsData(features);

            const selected = selectedSat();
            if (selected) {
               const pos = calculateLivePos(selected.raw, selected.epochTime, now);
               setNearestCountry(findNearestCountry(pos.lat, pos.lon));
               fetchVerifiedRange(pos.lat, pos.lon);
               fetchWeatherIntel(pos.lat, pos.lon);
            }
            lastUpdate = time;
        }
        animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
  };

  return (
    <div class="h-full w-full flex flex-col overflow-hidden bg-bg_main text-text_primary font-mono tracking-tight uppercase">
      <style>{`
        @keyframes pulse-green { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes blink { 0% { opacity: 0.4; } 100% { opacity: 1; } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      {/* HEADER */}
      <div class="h-10 border-b border-border_main bg-bg_header/80 px-4 flex items-center justify-between shrink-0 box-border">
          <div class="flex items-center gap-6">
              <div class="flex items-center gap-3">
                  <div class="w-3 h-3 bg-cyan-400 font-bold text-black flex justify-center items-center rounded-sm text-[8px] leading-none">🛰️</div>
                  <span class="text-[11px] font-black tracking-widest text-cyan-400 leading-none">SATELLITE MONITORING NETWORK</span>
              </div>
              <div class="flex gap-1 border-l border-cyan-500/30 pl-4">
                  <button 
                      onClick={() => setMainTab('SATELLITE TRACKING')}
                      class={`px-3 py-1 font-black text-[9px] transition-all tracking-widest ${mainTab() === 'SATELLITE TRACKING' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'text-cyan-500/60 hover:text-cyan-400'}`}
                  >
                      SATELLITE TRACKING
                  </button>
                  <button 
                      onClick={() => setMainTab('EARTH IMAGERY')}
                      class={`px-3 py-1 font-black text-[9px] transition-all tracking-widest ${mainTab() === 'EARTH IMAGERY' ? 'bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.3)]' : 'text-orange-500/60 hover:text-orange-400'}`}
                  >
                      EARTH IMAGERY
                  </button>
              </div>
          </div>
          <div class="text-[9px] font-black opacity-40">METEO SYNC ACTIVE</div>
      </div>
      
      <Show when={mainTab() === 'SATELLITE TRACKING'}>
      <div class="flex-1 flex flex-col overflow-hidden relative animate-in fade-in duration-300">
          <div class="flex-[3] relative border-b border-border_main z-0">
              <div id="sat-globe-map" class="absolute inset-0"></div>
              
              <div class="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
                 <div class="bg-black/80 backdrop-blur-md border border-cyan-500/30 p-3 min-w-[200px] shadow-2xl">
                    <div class="text-[8px] text-cyan-400 font-black mb-1">SATELLITE CONSTELLATION</div>
                    <div class="text-[18px] font-black text-white leading-none">
                      {filteredSatellites().length} <span class="text-[10px] opacity-40">NODES</span>
                    </div>
                 </div>
                 
                 <div class="bg-black/80 backdrop-blur-md border border-cyan-500/30 p-1 flex gap-1 pointer-events-auto">
                    <For each={Object.keys(MAP_STYLES)}>
                       {(style) => (
                          <button 
                            onClick={() => setMapStyle(style)}
                            class={`px-2 py-1 text-[7px] font-black transition-all border ${mapStyle() === style ? 'bg-cyan-500 text-black border-cyan-500' : 'text-cyan-500 border-cyan-500/20 hover:bg-cyan-500/20'}`}
                          >
                             {style.replace(/_/g, ' ')}
                          </button>
                       )}
                    </For>
                 </div>
              </div>

              <div class="absolute top-4 right-4 z-30 flex flex-col gap-1 pointer-events-auto">
                  <button onClick={() => handleZoom('in')} class="w-8 h-8 bg-black/80 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-400 hover:text-black transition-all flex items-center justify-center font-black text-lg shadow-xl">+</button>
                  <button onClick={() => handleZoom('out')} class="w-8 h-8 bg-black/80 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-400 hover:text-black transition-all flex items-center justify-center font-black text-lg shadow-xl">-</button>
              </div>
              
              <Show when={selectedSat()}>
                  <div class="absolute bottom-6 right-6 z-40 flex flex-col gap-3 pointer-events-auto max-w-[400px]">
                      
                      {/* WEATHER INTEL HUD */}
                      <div class="bg-black/90 p-3 border border-yellow-500/50 backdrop-blur-md animate-fade-in shadow-2xl flex flex-col gap-2">
                          <div class="flex justify-between items-center border-b border-yellow-500/20 pb-1">
                              <span class="text-[8px] font-black text-yellow-500 tracking-widest uppercase">WEATHER DATA SYNC</span>
                              <span class="text-[7px] text-white/40">UPDATE INTERVAL: 10S</span>
                          </div>
                          <Show when={satWeather()} fallback={<div class="text-[8px] text-white/20 animate-pulse uppercase">Acquiring weather data...</div>}>
                             <div class="grid grid-cols-3 gap-3">
                                <div class="flex flex-col">
                                   <span class="text-[6px] text-white/40">TEMPERATURE</span>
                                   <span class="text-[14px] font-black text-white">{satWeather().temperature}°C</span>
                                </div>
                                <div class="flex flex-col">
                                   <span class="text-[6px] text-white/40">WIND SPEED</span>
                                   <span class="text-[14px] font-black text-yellow-500">{satWeather().windspeed} <span class="text-[6px]">KM/H</span></span>
                                </div>
                                <div class="flex flex-col">
                                   <span class="text-[6px] text-white/40">CONDITION CODE</span>
                                   <span class="text-[14px] font-black text-cyan-400">{satWeather().weathercode}</span>
                                </div>
                             </div>
                          </Show>
                      </div>

                       <div class="border border-cyan-500/30 bg-black shadow-[0_0_30px_rgba(0,0,0,0.8)] relative group overflow-hidden rounded-sm animate-slide-left flex flex-col">
                          <div class="flex bg-black/80 border-b border-cyan-500/20">
                             <button 
                                onClick={() => setGroundTab('OPTICAL')}
                                class={`px-3 py-1.5 text-[7px] font-black tracking-widest transition-all ${groundTab() === 'OPTICAL' ? 'bg-cyan-500 text-black' : 'text-cyan-500 hover:bg-cyan-500/10'}`}
                             >OPTICAL IMAGING</button>
                             <button 
                                onClick={() => setGroundTab('NASA_GIBS')}
                                class={`px-3 py-1.5 text-[7px] font-black tracking-widest transition-all border-l border-cyan-500/20 ${groundTab() === 'NASA_GIBS' ? 'bg-orange-600 text-white' : 'text-orange-500 hover:bg-orange-600/10'}`}
                             >NASA GIBS DATA</button>
                          </div>

                          <div class="relative h-[240px] w-full">
                             <Show when={groundTab() === 'OPTICAL'}>
                                <iframe 
                                   width="100%" height="100%" frameborder="0" scrolling="no" 
                                   class="grayscale-[30%] group-hover:grayscale-0 transition-all opacity-80 group-hover:opacity-100"
                                   src={`https://maps.google.com/maps?q=${selectedSat()?.lat},${selectedSat()?.lon}&hl=id&z=10&t=k&output=embed`}>
                                </iframe>
                             </Show>

                             <Show when={groundTab() === 'NASA_GIBS'}>
                                <div class="absolute inset-0 bg-neutral-900 overflow-hidden">
                                   <img 
                                      src={getGibsUrl()} 
                                      class="w-full h-full object-cover transition-all duration-700 active:scale-150 cursor-crosshair"
                                      loading="lazy"
                                   />
                                   <div class="absolute bottom-2 left-2 flex flex-col gap-1 z-20">
                                      <select 
                                         class="bg-black/80 text-[6px] text-white border border-white/20 px-1 py-0.5 outline-none font-black"
                                         value={activeGibsCategory()}
                                         onInput={(e) => setActiveGibsCategory(e.target.value)}
                                      >
                                         <For each={Object.keys(GIBS_HIERARCHY)}>
                                            {(cat) => <option value={cat}>{cat.replace(/_/g, ' ').toUpperCase()}</option>}
                                         </For>
                                      </select>
                                      <select 
                                         class="bg-orange-600 text-[6px] text-white border border-orange-400/50 px-1 py-0.5 outline-none font-black"
                                         value={activeGibsLayer()}
                                         onInput={(e) => setActiveGibsLayer(e.target.value)}
                                      >
                                         <For each={GIBS_HIERARCHY[activeGibsCategory()]}>
                                            {(layer) => <option value={layer.id}>{layer.name}</option>}
                                         </For>
                                      </select>
                                   </div>
                                   <div class="absolute top-2 right-2 flex flex-col items-end gap-1">
                                       <span class="bg-black/80 text-[6px] text-orange-500 font-black px-1 py-0.5 border border-orange-500/30">GIBS SYNC: ACTIVE</span>
                                       <span class="text-[5px] text-white/40 italic">DATE: {new Date(Date.now() - 86400000).toISOString().split('T')[0]}</span>
                                   </div>
                                   <button 
                                      onClick={() => setShowGibsModal(true)}
                                      class="absolute bottom-2 right-2 bg-orange-600 text-white p-1.5 border border-orange-400 group-hover:scale-110 transition-all shadow-lg active:scale-95"
                                      title="FULLSCREEN SCAN"
                                   >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                                   </button>
                                </div>
                             </Show>
                          </div>

                          <div class="bg-black/80 px-3 py-1.5 flex justify-between items-center border-t border-cyan-500/20">
                             <div class="flex flex-col">
                                <span class="text-[7px] text-cyan-400/50 font-black uppercase tracking-widest leading-none mb-0.5">LOCATION STATUS</span>
                                <span class="text-[10px] text-white font-black uppercase">
                                  {nearestCountry() ? `OVER ${nearestCountry().name}` : 'INTERNATIONAL WATERS'}
                                </span>
                             </div>
                             <div class="flex flex-col items-end">
                                <span class="text-[7px] text-white/30 font-black">PROXIMITY</span>
                                <span class="text-[9px] text-cyan-400 font-mono font-black italic">
                                   {nearestCountry() ? `${Math.round(nearestCountry().distance)}KM` : '---'}
                                </span>
                             </div>
                          </div>
                       </div>

                      <div class="bg-black/90 p-4 border border-cyan-500/50 backdrop-blur-md w-full animate-fade-in shadow-2xl">
                          <div class="flex justify-between items-center border-b border-cyan-500/30 pb-2 mb-3">
                              <div class="flex items-center gap-2">
                                 <div class="w-1.5 h-1.5 bg-red-500 animate-pulse rounded-full"></div>
                                 <span class="text-[11px] font-black text-cyan-400 truncate uppercase tracking-widest">{selectedSat().name}</span>
                              </div>
                              <button onClick={() => setSelectedSat(null)} class="text-white/40 hover:text-red-500 transition-colors">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              </button>
                          </div>
                          <div class="grid grid-cols-2 gap-4 mb-3">
                               <div class="flex flex-col border-l border-cyan-500/20 pl-2">
                                  <span class="text-[7px] text-white/30 font-black uppercase tracking-tighter">NORAD ID</span>
                                  <span class="text-[10px] text-white font-mono font-black">{selectedSat().id}</span>
                               </div>
                               <div class="flex flex-col border-l border-cyan-500/20 pl-2">
                                  <span class="text-[7px] text-white/30 font-black uppercase tracking-tighter">ORBIT CLASSIFICATION</span>
                                  <span class="text-[10px] text-white font-mono font-black">{selectedSat().type}</span>
                               </div>
                          </div>
                          <div class="bg-cyan-500/10 p-2 border border-cyan-500/20 grid grid-cols-2 gap-2 text-[9px] font-black text-white/80">
                              <div class="flex flex-col">
                                 <span class="text-[6px] opacity-40">LATITUDE</span>
                                 <span class="tabular-nums text-cyan-400">{typeof selectedSat().lat === 'number' ? selectedSat().lat.toFixed(6) : '---'}</span>
                              </div>
                              <div class="flex flex-col">
                                 <span class="text-[6px] opacity-40">LONGITUDE</span>
                                 <span class="tabular-nums text-cyan-400">{typeof selectedSat().lon === 'number' ? selectedSat().lon.toFixed(6) : '---'}</span>
                              </div>
                          </div>
                      </div>
                  </div>
              </Show>
          </div>
          
          <div class="flex-1 flex flex-col bg-bg_sidebar shrink-0 relative overflow-hidden z-50 shadow-[0_-20px_50px_rgba(0,0,0,0.9)]">
             <div class="px-6 py-2 bg-black/40 border-b border-border_main flex justify-between items-center bg-bg_header/30">
                 <div class="flex items-center gap-4">
                    <span class="text-[9px] font-black text-cyan-400 tracking-[0.2em] uppercase">SATELLITE TELEMETRY // PAGE {currentPage()}</span>
                    <div class="relative group ml-4">
                        <input 
                           type="text" placeholder="FILTER BY COUNTRY..." value={searchQuery()}
                           onInput={(e) => setSearchQuery(e.target.value)}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                                setIsFiltering(searchQuery().length > 0);
                                setCurrentPage(1);
                             }
                           }}
                           class="bg-black/40 border border-cyan-500/20 text-cyan-400 text-[9px] px-3 py-1 w-[200px] font-black focus:outline-none focus:border-cyan-500 transition-all placeholder:text-cyan-500/20 uppercase"
                        />
                        <div class="absolute right-2 top-1.5 text-[8px] text-cyan-400/30 font-black pointer-events-none">ENTER</div>
                    </div>
                 </div>
                 <div class="flex items-center gap-3">
                    <button disabled={currentPage() === 1} onClick={() => setCurrentPage(p => p - 1)} class="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[8px] font-black hover:bg-cyan-500 hover:text-black disabled:opacity-20 transition-all">PREVIOUS</button>
                    <div class="text-[10px] text-white/40 font-black font-mono">{currentPage()} <span class="opacity-20">/</span> {totalPages()}</div>
                    <button disabled={currentPage() === totalPages()} onClick={() => setCurrentPage(p => p + 1)} class="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[8px] font-black hover:bg-cyan-500 hover:text-black disabled:opacity-20 transition-all">NEXT</button>
                 </div>
             </div>
             
             <div class="flex-1 overflow-y-auto win-scroll bg-bg_main">
               <table class="w-full text-left table-fixed border-collapse">
                 <thead class="sticky top-0 bg-bg_sidebar z-10 shadow-lg border-b border-border_main">
                     <tr class="text-[8px] text-text_secondary font-black tracking-widest uppercase">
                         <th class="px-6 py-2 w-24 border-r border-border_main/10">NORAD ID</th>
                         <th class="px-4 py-2 border-r border-border_main/10">SATELLITE NAME</th>
                         <th class="px-4 py-2 w-32 border-r border-border_main/10">TERRITORY</th>
                         <th class="px-4 py-2 w-32 border-r border-border_main/10">EPOCH TIME</th>
                         <th class="px-4 py-2 w-24 text-center">CLASS</th>
                         <th class="px-4 py-2 w-32 border-l border-border_main/10 text-right">MEAN MOTION</th>
                     </tr>
                 </thead>
                 <tbody class="text-[10px] font-mono">
                    <For each={currentItems()}>
                        {(sat) => (
                          <tr class={`border-b border-border_main/20 hover:bg-cyan-500/10 cursor-pointer transition-colors group ${selectedSat()?.id === sat.id ? 'bg-[#00ff41]/10 border-l-2 border-[#00ff41]' : ''}`}
                               onClick={() => {
                                   const pos = calculateLivePos(sat.raw, sat.epochTime, Date.now());
                                   setSelectedSat({...sat, lat: pos.lat, lon: pos.lon});
                                   if (globeInstance) globeInstance.pointOfView({ lat: pos.lat, lng: pos.lon, altitude: 1.2 }, 1000);
                               }}
                          >
                              <td class="px-6 py-1.5 font-bold text-cyan-500 border-r border-border_main/10">{sat.id}</td>
                              <td class="px-4 py-1.5 font-black text-text_primary group-hover:text-cyan-400 transition-colors uppercase truncate">{sat.name}</td>
                              <td class="px-4 py-1.5 border-r border-border_main/10">
                                 <div class="flex items-center gap-1.5">
                                    <div class={`w-1 h-1 rounded-full ${satTerritories()[sat.id] === 'INTERNATIONAL WATERS' ? 'bg-blue-500' : 'bg-green-500 animate-pulse'}`}></div>
                                    <span class={`text-[9px] font-black tracking-tighter ${satTerritories()[sat.id] === 'INTERNATIONAL WATERS' ? 'text-white/30' : 'text-cyan-400'}`}>
                                       {satTerritories()[sat.id] || "PROCESSING..."}
                                    </span>
                                 </div>
                              </td>
                              <td class="px-4 py-1.5 text-text_secondary/40 text-[9px] uppercase">{new Date(sat.raw.EPOCH).toLocaleDateString()}</td>
                              <td class="px-4 py-1.5 text-center"><span class="text-[8px] border border-white/10 px-1.5 py-0.5 opacity-60">{sat.type}</span></td>
                              <td class="px-4 py-1.5 text-right font-black text-white/40 border-l border-border_main/10 tabular-nums">{sat.raw.MEAN_MOTION.toFixed(6)}</td>
                          </tr>
                        )}
                    </For>
                 </tbody>
               </table>
             </div>
          </div>
      </div>

      <Show when={showGibsModal()}>
         <div class="fixed inset-0 z-[9000] bg-black/95 backdrop-blur-2xl flex flex-col p-10 animate-fade-in">
            <div class="flex justify-between items-center mb-6 border-b border-orange-500/30 pb-4">
                <div class="flex items-center gap-4">
                    <div class="w-2 h-2 bg-orange-500 animate-pulse rounded-full"></div>
                    <div class="flex flex-col">
                        <span class="text-[14px] font-black text-white uppercase tracking-[0.3em]">NASA GIBS HIGH-RESOLUTION SCAN</span>
                        <span class="text-[9px] text-orange-400 font-bold tracking-widest uppercase">{activeGibsLayer().replace(/_/g, ' ')} // CAT_{activeGibsCategory().toUpperCase()}</span>
                    </div>
                </div>
                <div class="flex items-center gap-6">
                    <div class="flex flex-col items-end">
                        <span class="text-[7px] text-white/30 uppercase font-black">TARGET COORDINATES</span>
                        <span class="text-[10px] text-cyan-400 font-mono font-black italic">{selectedSat()?.lat.toFixed(4)}, {selectedSat()?.lon.toFixed(4)}</span>
                    </div>
                    <button 
                       onClick={() => setShowGibsModal(false)}
                       class="bg-orange-600 text-white px-6 py-2 text-[11px] font-black uppercase tracking-widest hover:bg-orange-500 border border-orange-400 shadow-[0_0_20px_rgba(234,88,12,0.4)] transition-all"
                    >EXIT SCAN MODE</button>
                </div>
            </div>
            <div class="flex-1 relative overflow-hidden bg-neutral-900 border border-white/5 shadow-2xl group">
               <img 
                  src={getGibsUrl()} 
                  class="w-full h-full object-contain cursor-zoom-in active:scale-[2] transition-transform duration-1000 origin-center" 
               />
               <div class="absolute bottom-6 left-6 bg-black/80 border border-white/20 p-4 backdrop-blur-md max-w-[300px]">
                  <span class="text-[8px] text-orange-500 font-black uppercase block mb-1">INTELLIGENCE SUMMARY</span>
                  <p class="text-[10px] text-white/60 leading-relaxed italic uppercase font-bold">SEARCH GRID CAPTURED VIA NASA EARTHDATA GIBS INTERFACE. HIGH-FIDELITY ATMOSPHERIC DATA ACQUIRED FOR ANALYSIS.</p>
               </div>
            </div>
         </div>
      </Show>
      </Show>

      {/* MODULE: EARTH IMAGERY */}
      <Show when={mainTab() === 'EARTH IMAGERY'}>
        <div class="flex-1 flex overflow-hidden bg-black animate-in fade-in duration-300">
            {/* Left Control Panel */}
            <div class="w-80 bg-bg_header/30 border-r border-border_main flex flex-col shrink-0">
                <div class="p-4 border-b border-border_main bg-black/40">
                    <span class="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">GEOSPATIAL TARGETING</span>
                </div>
                
                <div class="p-4 flex flex-col gap-4 border-b border-border_main/30">
                    <div class="flex gap-2 border-b border-border_main/30 pb-2">
                        <button onClick={() => setIsManualTargeting(false)} class={`flex-1 py-1 text-[8px] font-black transition-all border ${!isManualTargeting() ? 'bg-orange-500 text-black border-orange-500' : 'text-orange-500 border-orange-500/30'}`}>PLACE SEARCH</button>
                        <button onClick={() => setIsManualTargeting(true)} class={`flex-1 py-1 text-[8px] font-black transition-all border ${isManualTargeting() ? 'bg-orange-500 text-black border-orange-500' : 'text-orange-500 border-orange-500/30'}`}>COORDINATE INPUT</button>
                    </div>

                    <Show when={!isManualTargeting()}>
                        <div class="flex flex-col gap-2 relative">
                            <span class="text-[8px] font-black text-white/50 uppercase tracking-widest">LOCATION SEARCH</span>
                            <div class="relative">
                                <input 
                                    type="text"
                                    placeholder="ENTER CITY OR COORDINATES..."
                                    value={osmQuery()}
                                    onInput={(e) => setOsmQuery(e.target.value)}
                                    onKeyDown={handleOsmSearch}
                                    class="w-full bg-black/60 border border-orange-500/30 text-orange-400 text-[10px] p-2.5 font-black focus:outline-none focus:border-orange-500 transition-all placeholder:text-orange-500/20 uppercase"
                                />
                                <div class="absolute right-2 top-2 text-[8px] font-black text-orange-500/40 pointer-events-none">ENTER</div>
                            </div>
                            
                            <Show when={isSearchingOsm()}>
                                <div class="text-[8px] text-orange-500 animate-pulse font-bold mt-1 uppercase">Searching...</div>
                            </Show>

                            <Show when={osmResults().length > 0}>
                                <div class="absolute top-[100%] left-0 w-full bg-black/90 border border-orange-500/50 shadow-2xl z-50 flex flex-col max-h-[200px] overflow-y-auto win-scroll">
                                    <For each={osmResults()}>
                                        {(res) => (
                                            <button 
                                                onClick={() => {
                                                    setNasaTarget({ lat: parseFloat(res.lat), lon: parseFloat(res.lon), label: res.display_name });
                                                    setOsmResults([]);
                                                }}
                                                class="p-2 border-b border-white/5 text-left hover:bg-orange-600/20 group transition-all"
                                            >
                                                <div class="text-[9px] font-black text-white/80 uppercase truncate group-hover:text-orange-400">{res.display_name}</div>
                                                <div class="text-[7px] text-white/40 font-mono mt-0.5 uppercase">LAT:{parseFloat(res.lat).toFixed(4)} LON:{parseFloat(res.lon).toFixed(4)}</div>
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </Show>

                    <Show when={isManualTargeting()}>
                        <div class="flex flex-col gap-2">
                            <span class="text-[8px] font-black text-white/50 uppercase tracking-widest">MANUAL COORDINATES</span>
                            <input type="text" placeholder="PLACE LABEL (OPTIONAL)" value={manualTitle()} onInput={(e) => setManualTitle(e.target.value)} class="bg-black/60 border border-orange-500/30 text-orange-400 text-[9px] p-2 font-black outline-none focus:border-orange-500 uppercase placeholder:text-orange-500/20" />
                            <div class="grid grid-cols-2 gap-2">
                                <input type="number" step="0.0001" placeholder="LATITUDE" value={manualLat()} onInput={(e) => setManualLat(e.target.value)} class="bg-black/60 border border-orange-500/30 text-orange-400 text-[9px] p-2 font-black outline-none focus:border-orange-500 placeholder:text-orange-500/20" />
                                <input type="number" step="0.0001" placeholder="LONGITUDE" value={manualLon()} onInput={(e) => setManualLon(e.target.value)} class="bg-black/60 border border-orange-500/30 text-orange-400 text-[9px] p-2 font-black outline-none focus:border-orange-500 placeholder:text-orange-500/20" />
                            </div>
                            <button onClick={handleManualLock} class="w-full py-2 border border-orange-400 text-orange-500 hover:bg-orange-600 hover:text-white text-[8px] font-black uppercase transition-all shadow-[0_0_10px_rgba(249,115,22,0.1)]">SET TARGET</button>
                        </div>
                    </Show>

                    <Show when={nasaTarget()}>
                        <div class="bg-orange-500/10 border border-orange-500/30 p-3 flex flex-col gap-2 relative group overflow-hidden">
                            <div class="flex flex-col gap-1 z-10">
                                <span class="text-[7px] text-orange-500 font-black uppercase tracking-widest">TARGET SET</span>
                                <span class="text-[9px] text-white font-black uppercase leading-tight line-clamp-2">{nasaTarget().label}</span>
                                <span class="text-[8px] text-orange-400 font-mono italic">{nasaTarget().lat.toFixed(4)}, {nasaTarget().lon.toFixed(4)}</span>
                            </div>
                            <div class="h-24 w-full border border-orange-500/50 mt-1 relative overflow-hidden grayscale hover:grayscale-0 transition-all duration-300">
                                <div class="absolute inset-0 z-20 pointer-events-none opacity-50" style="background-image: radial-gradient(circle, #f97316 1px, transparent 1px); background-size: 8px 8px;"></div>
                                <iframe width="100%" height="100%" frameborder="0" scrolling="no" class="relative z-10 scale-125" src={`https://maps.google.com/maps?q=${nasaTarget().lat},${nasaTarget().lon}&hl=id&z=10&t=k&output=embed`}></iframe>
                            </div>
                            <button onClick={() => setNasaTarget(null)} class="absolute top-2 right-2 text-white/30 hover:text-red-500 z-30">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    </Show>
                </div>

                <div class="flex-1 overflow-y-auto win-scroll p-4 space-y-6">
                    <div class="flex flex-col gap-4">
                        <div class="flex flex-col gap-2">
                            <span class="text-[8px] font-black text-white/50 uppercase tracking-widest">ANALYSIS MODE</span>
                            <div class="flex gap-1">
                                {['SNAPSHOT', 'TIME SERIES'].map(m => (
                                    <button 
                                        onClick={() => setNasaMissionMode(m === 'SNAPSHOT' ? 'SNAPSHOT' : 'TIME_SERIES')}
                                        class={`flex-1 py-1 text-[8px] font-black border transition-all ${nasaMissionMode() === (m === 'SNAPSHOT' ? 'SNAPSHOT' : 'TIME_SERIES') ? 'bg-orange-500 text-black border-orange-500' : 'bg-black/40 text-orange-500/60 border-orange-500/30'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div class="flex flex-col gap-2">
                             <div class="flex justify-between items-center">
                                <span class="text-[8px] font-black text-white/50 uppercase tracking-widest">{nasaMissionMode() === 'SNAPSHOT' ? 'OBSERVATION DATE' : 'START DATE'}</span>
                                <span class="text-[9px] font-mono text-orange-400">{nasaDate().split('-').reverse().join('/')}</span>
                             </div>
                             <input 
                                type="date"
                                value={nasaDate()}
                                onInput={(e) => setNasaDate(e.target.value)}
                                class="bg-black/60 border border-border_main text-white text-[10px] p-2 outline-none focus:border-orange-500"
                             />
                        </div>

                        <Show when={nasaMissionMode() === 'TIME_SERIES'}>
                            <div class="flex flex-col gap-2 animate-in slide-in-from-top-1">
                                <div class="flex justify-between items-center">
                                    <span class="text-[8px] font-black text-white/50 uppercase tracking-widest">END DATE</span>
                                    <span class="text-[9px] font-mono text-orange-400">{nasaEndDate().split('-').reverse().join('/')}</span>
                                </div>
                                <input 
                                    type="date"
                                    value={nasaEndDate()}
                                    onInput={(e) => setNasaEndDate(e.target.value)}
                                    class="bg-black/60 border border-border_main text-white text-[10px] p-2 outline-none focus:border-orange-500"
                                />
                            </div>
                        </Show>
                        <div class="flex flex-col gap-2">
                             <div class="flex justify-between items-center">
                                <span class="text-[8px] font-black text-white/50 uppercase tracking-widest">ZOOM RANGE</span>
                                <span class="text-[9px] font-mono text-orange-400">{nasaRange().toFixed(1)}°</span>
                             </div>
                             <input 
                                type="range" min="0.1" max="5.0" step="0.1" 
                                value={nasaRange()} 
                                onInput={(e) => setNasaRange(parseFloat(e.target.value))}
                                class="w-full accent-orange-500"
                             />
                        </div>
                        <div class="flex flex-col gap-2">
                             <div class="flex justify-between items-center">
                                <span class="text-[8px] font-black text-white/50 uppercase tracking-widest">IMAGE RESOLUTION</span>
                                <span class="text-[9px] font-mono text-orange-400">{nasaGrid()}x{nasaGrid()}</span>
                             </div>
                             <input 
                                type="range" min="2" max="25" step="1" 
                                value={nasaGrid()} 
                                onInput={(e) => setNasaGrid(parseInt(e.target.value))}
                                class="w-full accent-orange-500"
                             />
                        </div>
                        <button 
                            disabled={nasaLoading() || !nasaTarget()}
                            onClick={executeNasaUplink}
                            class={`w-full py-3 mt-2 font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2 ${nasaLoading() || !nasaTarget() ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-orange-600 text-white hover:brightness-125 shadow-[0_0_15px_rgba(234,88,12,0.3)]'}`}
                        >
                            {nasaLoading() ? 'DOWNLOADING...' : 'FETCH SATELLITE IMAGERY'}
                        </button>
                    </div>

                    <div class="flex flex-col gap-3">
                        <span class="text-[8px] font-black text-orange-500/50 uppercase tracking-[0.4em] border-b border-white/5 pb-2">IMAGERY LAYERS</span>
                        <For each={Object.entries(GIBS_HIERARCHY)}>
                            {([category, layers]) => (
                                <div class="flex flex-col gap-1.5">
                                    <span class="text-[7px] font-black text-white/40 uppercase tracking-widest uppercase">{category.replace(/_/g, ' ')}</span>
                                    <div class="flex flex-col gap-1">
                                        <For each={layers}>
                                            {(layer) => (
                                                <button 
                                                    onClick={() => toggleNasaLayer(layer.id)}
                                                    class={`flex items-center gap-2 p-1.5 border transition-all text-left ${nasaSelectedLayers().includes(layer.id) ? 'border-orange-500 bg-orange-500/10' : 'border-white/5 bg-black/20 hover:border-white/20'}`}
                                                >
                                                    <div class={`w-1.5 h-1.5 rounded-full ${nasaSelectedLayers().includes(layer.id) ? 'bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.5)]' : 'bg-zinc-700'}`}></div>
                                                    <span class="text-[8px] font-bold text-white uppercase truncate">{layer.name}</span>
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </div>

            {/* Main Image View */}
            <div class="flex-1 flex flex-col bg-[#050505] relative shadow-inner overflow-hidden">
                <Show when={nasaProcessedLayers().length > 0}>
                    <div class="flex border-b border-border_main bg-bg_header/40 p-1 shrink-0 gap-1 overflow-x-auto win-scroll z-10">
                        <For each={nasaProcessedLayers()}>
                            {(pLayer) => (
                                <button 
                                    onClick={() => setNasaActiveLayerId(pLayer.id)}
                                    class={`px-4 py-2 flex items-center transition-all border-b-2 text-[9px] font-black uppercase whitespace-nowrap ${nasaActiveLayerId() === pLayer.id ? 'border-orange-500 text-white bg-orange-500/10' : 'border-transparent text-white/40 hover:text-white'}`}
                                >
                                    {pLayer.name}
                                </button>
                            )}
                        </For>
                    </div>
                </Show>

                <div class="flex-1 relative flex items-center justify-center p-10 overflow-auto win-scroll">
                    <Show when={!nasaTarget() && nasaProcessedLayers().length === 0}>
                        <div class="flex flex-col items-center gap-4 opacity-20 relative z-20">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/></svg>
                            <span class="text-[12px] font-black uppercase tracking-[0.4em]">SET GEOSPATIAL TARGET</span>
                        </div>
                    </Show>

                    {nasaLoading() && (
                        <div class="absolute inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center gap-6 backdrop-blur-sm">
                            <div class="w-16 h-16 border-4 border-t-orange-500 rounded-full animate-spin"></div>
                            <div class="flex flex-col items-center text-center">
                                <span class="text-sm font-black text-white tracking-widest uppercase mb-2">DOWNLOADING SATELLITE IMAGERY...</span>
                                <div class="w-64 h-1.5 bg-zinc-900 border border-white/10 relative mt-2">
                                    <div class="absolute inset-y-0 left-0 bg-orange-500 transition-all duration-300" style={{ width: `${nasaProgress()}%` }}></div>
                                </div>
                                <button 
                                    onClick={() => { if(nasaAbortController) nasaAbortController.abort() }}
                                    class="mt-6 text-red-500 text-[9px] font-black uppercase tracking-widest hover:text-red-400"
                                >
                                    CANCEL TRANSFER
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <canvas 
                         ref={nasaCanvasRef} 
                         class="max-w-[100%] max-h-[100%] object-contain shadow-[0_0_50px_rgba(0,0,0,0.8)] border-4 border-white/5 relative z-10"
                    ></canvas>
                    
                    {/* Time Series Nav HUD */}
                    <Show when={nasaMissionMode() === 'TIME_SERIES' && nasaTimeSeriesRuns().length > 1 && !nasaLoading()}>
                        <div class="absolute bottom-6 left-6 p-4 bg-black/80 border border-orange-500/30 backdrop-blur-md z-20 shadow-2xl flex flex-col gap-2">
                            <span class="text-orange-500 font-black tracking-widest uppercase text-[10px] border-b border-orange-500/30 pb-1">TIME SERIES DATA</span>
                            <span class="text-white font-mono text-[9px] uppercase">TARGET: {nasaTarget()?.label}</span>
                            <span class="text-white font-mono text-[9px] uppercase">DATE: {nasaTimeSeriesRuns()[activeNasaTSIndex()]?.date}</span>
                            
                            <div class="mt-2 pt-2 border-t border-white/10 flex items-center justify-between gap-4 w-64">
                                <button 
                                    disabled={activeNasaTSIndex() === 0}
                                    onClick={() => setActiveNasaTSIndex(prev => prev - 1)}
                                    class="flex-1 py-1.5 bg-white/5 border border-white/10 text-white font-black text-[9px] hover:bg-white/10 disabled:opacity-20 uppercase"
                                >
                                    PREV FRAME
                                </button>
                                <div class="text-[9px] text-orange-500 font-bold font-mono">
                                    {activeNasaTSIndex() + 1} / {nasaTimeSeriesRuns().length}
                                </div>
                                <button 
                                    disabled={activeNasaTSIndex() === nasaTimeSeriesRuns().length - 1}
                                    onClick={() => setActiveNasaTSIndex(prev => prev + 1)}
                                    class="flex-1 py-1.5 bg-orange-500/20 border border-orange-500/40 text-orange-500 font-black text-[9px] hover:bg-orange-500 hover:text-black disabled:opacity-20 transition-all uppercase"
                                >
                                    NEXT FRAME
                                </button>
                            </div>
                        </div>
                    </Show>
                </div>
            </div>

            {/* Timeline Gallery Sidebar */}
            <Show when={nasaMissionMode() === 'TIME_SERIES' && nasaTimeSeriesRuns().length > 0}>
                <aside class="w-64 bg-bg_header/20 border-l border-border_main flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-500 overflow-hidden">
                    <div class="p-4 border-b border-border_main bg-black/40 flex justify-between items-center">
                        <span class="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">IMAGE HISTORY</span>
                        <button
                            onClick={() => {
                                nasaTimeSeriesRuns().forEach((run, idx) => {
                                    if(run.layers.length > 0) {
                                       const a = document.createElement("a");
                                       a.href = run.layers[0].canvas.toDataURL("image/png");
                                       a.download = `EXPORT_${run.date}_F${idx+1}.png`;
                                       a.click();
                                    }
                                });
                            }}
                            class="p-1.5 border border-orange-500/30 text-orange-500 hover:bg-orange-500 hover:text-black transition-all group relative"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto win-scroll p-3 space-y-3 relative">
                        <For each={nasaTimeSeriesRuns()}>
                            {(run, idx) => (
                                <button 
                                    onClick={() => setActiveNasaTSIndex(idx())}
                                    class={`w-full group relative flex flex-col border transition-all overflow-hidden ${activeNasaTSIndex() === idx() ? 'border-orange-500 bg-orange-500/10 shadow-[inset_0_0_10px_rgba(249,115,22,0.1)]' : 'border-border_main/30 bg-black/20 hover:border-orange-500/40'}`}
                                >
                                    <div class="h-16 bg-zinc-900 flex items-center justify-center relative overflow-hidden transition-all w-full">
                                        <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle, #f97316 1px, transparent 1px); background-size: 8px 8px;"></div>
                                        <span class="text-[8px] font-black text-white/10 uppercase group-hover:text-orange-500/20">FRAME {idx()+1}</span>
                                        <Show when={activeNasaTSIndex() === idx()}>
                                            <div class="absolute inset-0 border-2 border-orange-500 animate-pulse opacity-50 z-20 pointer-events-none"></div>
                                        </Show>
                                    </div>
                                    <div class="p-2 flex justify-between items-center bg-black/40 w-full relative z-30">
                                        <span class={`text-[9px] font-black ${activeNasaTSIndex() === idx() ? 'text-orange-500' : 'text-white/60'}`}>
                                            {run.date.split('-').reverse().join('/')}
                                        </span>
                                        <div 
                                           onClick={(e) => {
                                               e.stopPropagation();
                                               const newRuns = nasaTimeSeriesRuns().filter((_, i) => i !== idx());
                                               setNasaTimeSeriesRuns(newRuns);
                                               if(activeNasaTSIndex() >= newRuns.length) {
                                                   setActiveNasaTSIndex(Math.max(0, newRuns.length - 1));
                                               }
                                           }}
                                           class="w-5 h-5 flex items-center justify-center text-white/30 hover:text-red-500 hover:bg-red-500/10 transition-all rounded"
                                           title="REMOVE"
                                        >
                                           <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                        </div>
                                    </div>
                                </button>
                            )}
                        </For>
                    </div>
                </aside>
            </Show>
        </div>
      </Show>
    </div>
  );
}
