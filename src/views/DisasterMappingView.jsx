import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';

export default function DisasterMappingView() {
  const [gdacsData, setGdacsData] = createSignal([]);
  const [usgsData, setUsgsData] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [selectedEvent, setSelectedEvent] = createSignal(null);
  const [stats, setStats] = createSignal({ earthquakes: 0, floods: 0, storms: 0, others: 0 });

  const [showSatelliteModal, setShowSatelliteModal] = createSignal(false);
  const [satProgress, setSatProgress] = createSignal(0);
  const [satLoading, setSatLoading] = createSignal(false);
  const [satInfo, setSatInfo] = createSignal(null);
  const [processedLayers, setProcessedLayers] = createSignal([]); // List of { id, name, canvas }
  const [activeLayerId, setActiveLayerId] = createSignal(null);
  const [isAborted, setIsAborted] = createSignal(false);
  const [satRange, setSatRange] = createSignal(1.0); // Degrees
  const [satGrid, setSatGrid] = createSignal(10);  // N x N Tiles
  const [satDate, setSatDate] = createSignal(new Date().toISOString().split('T')[0]);
  
  // TIME SERIES MODE
  const [missionMode, setMissionMode] = createSignal('SINGLE'); // 'SINGLE' or 'TIME_SERIES'
  const [satEndDate, setSatEndDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [timeSeriesRuns, setTimeSeriesRuns] = createSignal([]); // List of { date, layers: [{id, name, canvas}] }
  const [activeTSIndex, setActiveTSIndex] = createSignal(-1);
  



  
  let currentAbortController = null;
  
  // NASA LAYERS CONFIGURATION
  const [selectedLayers, setSelectedLayers] = createSignal([
    'MODIS_Terra_CorrectedReflectance_TrueColor'
  ]);

  const NASA_LAYERS = {
    'FIRES': [
        { id: 'MODIS_Terra_CorrectedReflectance_TrueColor', name: 'Terra True Color (Base)' },
        { id: 'VIIRS_SNPP_Thermal_Anomalies_375m_All', name: 'VIIRS Red Spot (Fire)' },
        { id: 'VIIRS_NOAA20_Thermal_Anomalies_375m_All', name: 'NOAA-20 Thermal' },
        { id: 'MODIS_Aqua_Thermal_Anomalies_All', name: 'Aqua Thermal' }
    ],
    'FLOODS': [
        { id: 'MODIS_Terra_CorrectedReflectance_Bands721', name: 'Terra Flood (B721)' },
        { id: 'MODIS_Aqua_CorrectedReflectance_Bands721', name: 'Aqua Flood (B721)' },
        { id: 'VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1', name: 'VIIRS Flood (M11)' }
    ],
    'VOLCANO/SMOKE': [
        { id: 'MODIS_Terra_Aerosol_Optical_Depth_Average', name: 'Terra Aerosol (Smoke)' },
        { id: 'MODIS_Aqua_Aerosol_Optical_Depth_Average', name: 'Aqua Aerosol (Smoke)' },
        { id: 'OMPS_NearRealTime_SO2_Index', name: 'SO2 Index (Volcano)' }
    ],
    'STORMS/CLOUD': [
        { id: 'MODIS_Terra_Cloud_Top_Temperature', name: 'Cloud Temperature' },
        { id: 'VIIRS_SNPP_Brightness_Temp_BandI5_Day', name: 'VIIRS Brightness' },
        { id: 'Goes_West_ABI_Geo_Color_True_Color', name: 'GOES-West Color' }
    ],
    'OVERLAYS': [
        { id: 'Coastlines_15m', name: 'Coastlines' },
        { id: 'Reference_Features_15m', name: 'Borders/Features' },
        { id: 'Reference_Labels_15m', name: 'Place Labels' }
    ]
  };

  const toggleLayer = (id) => {
    if (selectedLayers().includes(id)) {
        setSelectedLayers(selectedLayers().filter(l => l !== id));
    } else {
        setSelectedLayers([...selectedLayers(), id]);
    }
  };

  let satCanvasRef;

  const openSatelliteRecon = (event) => {
    setShowSatelliteModal(true);
    // Auto-set the date from the event time if available
    if (event && event.time) {
        setSatDate(new Date(event.time).toISOString().split('T')[0]);
    }
  };

    const startSatelliteMission = async () => {
        // Reset previous state
        if (currentAbortController) currentAbortController.abort();
        currentAbortController = new AbortController();
        const signal = currentAbortController.signal;

        setSatLoading(true);
        setSatProgress(0);
        setIsAborted(false);
        
        const lat = normalizeEvent(selectedEvent())?.lat;
        const lng = normalizeEvent(selectedEvent())?.lng;
        if (!lat || !lng) return;

        const layersToProcess = selectedLayers();

        // Calculate Dates
        let dates = [satDate()];
        if (missionMode() === 'TIME_SERIES') {
            dates = [];
            const start = new Date(satDate());
            const end = new Date(satEndDate());
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dates.push(new Date(d).toISOString().split('T')[0]);
            }
        }

        setTimeSeriesRuns([]);
        setActiveTSIndex(-1);

        for (let dateIdx = 0; dateIdx < dates.length; dateIdx++) {
            const currentDate = dates[dateIdx];
            const dailyLayers = [];

            for (let layerIdx = 0; layerIdx < layersToProcess.length; layerIdx++) {
                if (signal.aborted) break;
                const layerId = layersToProcess[layerIdx];
                
                try {
                    let layerName = layerId;
                    Object.values(NASA_LAYERS).forEach(cat => {
                        const found = cat.find(l => l.id === layerId);
                        if (found) layerName = found.name;
                    });

                    // Update Global Progress
                    const totalSteps = dates.length * layersToProcess.length;
                    const currentStep = (dateIdx * layersToProcess.length) + layerIdx;

                    const fetchWithTimeout = async (url, options = {}) => {
                        const timeoutId = setTimeout(() => currentAbortController && currentAbortController.abort(), 30000); 
                        try {
                            const response = await fetch(url, { ...options, signal });
                            clearTimeout(timeoutId);
                            return response;
                        } catch (err) {
                            clearTimeout(timeoutId);
                            throw err;
                        }
                    };

                    const resp = await fetchWithTimeout(`${import.meta.env.VITE_DISASTER_API}/api/disaster/nasa_imagery?lat=${lat}&lon=${lng}&date=${currentDate}&range_deg=${satRange()}&grid_size=${satGrid()}&layers=${layerId},Coastlines_15m,Reference_Features_15m`);
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
                                    // Smooth real-time progress
                                    setSatProgress(Math.round(((currentStep + (tilesLoaded/data.tiles.length)) / totalSteps) * 100));
                                    setTimeout(resolve, missionMode() === 'TIME_SERIES' ? 50 : 200); 
                                };
                                img.onerror = () => { tilesLoaded++; resolve(); };
                                img.src = tile.url;
                            });
                        }
                        dailyLayers.push({ id: layerId, name: layerName, canvas: layerCanvas });
                        if (dateIdx === 0 && layerIdx === 0) setSatInfo(data);
                    }
                } catch(e) { console.error(e); }
            }
            
            if (dailyLayers.length > 0) {
                const newRun = { date: currentDate, layers: dailyLayers };
                setTimeSeriesRuns(prev => [...prev, newRun]);
                if (activeTSIndex() === -1) {
                    setActiveTSIndex(0);
                    setProcessedLayers(dailyLayers);
                    if (!activeLayerId()) setActiveLayerId(dailyLayers[0].id);
                }
            }
        }
        
        if (!signal.aborted) setSatLoading(false);
    };

  const abortUplink = () => {
    if (currentAbortController) {
        currentAbortController.abort();
        setIsAborted(true);
        setSatLoading(false);
    }
  };

  const removeProcessedLayer = (id) => {
    const current = processedLayers();
    const filtered = current.filter(l => l.id !== id);
    setProcessedLayers(filtered);
    
    if (activeLayerId() === id) {
        if (filtered.length > 0) {
            setActiveLayerId(filtered[0].id);
        } else {
            setActiveLayerId(null);
            // Clear main canvas
            if (satCanvasRef) {
                const ctx = satCanvasRef.getContext('2d');
                ctx.clearRect(0, 0, satCanvasRef.width, satCanvasRef.height);
            }
        }
    }
  };

  // Watch for active TS index changes
  createEffect(() => {
    const idx = activeTSIndex();
    const runs = timeSeriesRuns();
    if (idx >= 0 && runs[idx]) {
        setProcessedLayers(runs[idx].layers);
        // Ensure activeLayerId still exists in new day
        const currentActive = activeLayerId();
        if (!runs[idx].layers.find(l => l.id === currentActive)) {
            setActiveLayerId(runs[idx].layers[0].id);
        }
    }
  });

  // Watch for activeLayerId changes and update the visible canvas
  createEffect(() => {
    const activeId = activeLayerId();
    const layers = processedLayers();
    if (activeId && layers.length > 0 && satCanvasRef) {
        const layer = layers.find(l => l.id === activeId);
        if (layer) {
            const ctx = satCanvasRef.getContext('2d');
            satCanvasRef.width = layer.canvas.width;
            satCanvasRef.height = layer.canvas.height;
            ctx.drawImage(layer.canvas, 0, 0);
        }
    }
  });

  let mapInstance = null;
  let gdacsLayer = null;
  let usgsLayer = null;

  const initMap = (el) => {
    if (mapInstance) return;
    mapInstance = window.L.map(el, { zoomControl: false }).setView([20, 0], 2);
    
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB'
    }).addTo(mapInstance);

    gdacsLayer = window.L.layerGroup().addTo(mapInstance);
    usgsLayer = window.L.layerGroup().addTo(mapInstance);

    setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, 200);

    fetchData();
  };

  const [bmkgData, setBmkgData] = createSignal(null);
  const [nasaEonetData, setNasaEonetData] = createSignal([]);
  const [nasaFirmsData, setNasaFirmsData] = createSignal([]);

  const [focus, setFocus] = createSignal('Global');
  const [category, setCategory] = createSignal('All');

  const fetchData = async () => {
    setLoading(true);
    const countryParam = focus() === 'Global' ? '' : `&country=${focus()}`;
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch all sources
    const fetchBmkg = async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_DISASTER_API}/api/disaster/bmkg`);
            const json = await resp.json();
            if (json.status === 'success') setBmkgData(json.data?.Infogempa?.gempa || null);
        } catch (e) { console.error("BMKG load error:", e); }
    };

    const fetchUsgs = async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_DISASTER_API}/api/disaster/usgs?limit=70`);
            const json = await resp.json();
            if (json.status === 'success') {
                const filtered = (json.data?.features || []).filter(f => {
                    const time = f.properties.time;
                    return time >= sevenDaysAgo.getTime();
                });
                setUsgsData(filtered);
            }
        } catch (e) { console.error("USGS load error:", e); }
    };

    const fetchGdacs = async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_DISASTER_API}/api/disaster/gdacs?limit=30${countryParam}`);
            const json = await resp.json();
            if (json.status === 'success') {
                const filtered = (json.data?.features || []).filter(f => {
                    const dateStr = f.properties.fromdate;
                    const date = new Date(dateStr);
                    return date >= sevenDaysAgo;
                });
                setGdacsData(filtered);
            }
        } catch (e) { console.error("GDACS load error:", e); }
    };

    const fetchNasaEonet = async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_DISASTER_API}/api/disaster/nasa_eonet?days=7`);
            const json = await resp.json();
            if (json.status === 'success') setNasaEonetData(json.data?.events || []);
        } catch (e) { console.error("NASA EONET load error:", e); }
    };

    const fetchNasaFirms = async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_DISASTER_API}/api/disaster/nasa_firms?days=1`);
            const json = await resp.json();
            if (json.status === 'success') setNasaFirmsData(json.data || []);
        } catch (e) { console.error("NASA FIRMS load error:", e); }
    };

    await Promise.all([fetchBmkg(), fetchUsgs(), fetchGdacs(), fetchNasaEonet(), fetchNasaFirms()]);
    updateMarkers();
    calculateStats();
    setLoading(false);
  };

  const handleFocusChange = (newFocus) => {
    setFocus(newFocus);
    fetchData();
    if (newFocus === 'Indonesia' && mapInstance) mapInstance.flyTo([-2, 118], 10);
    else if (newFocus === 'Global' && mapInstance) mapInstance.flyTo([20, 0], 2);
  };

  const calculateStats = () => {
    let floods = 0, storms = 0, others = 0, fires = nasaFirmsData().length;
    gdacsData().forEach(f => {
      const type = f.properties.eventtype;
      if (type === 'FL') floods++;
      else if (type === 'TC' || type == 'ST') storms++;
      else others++;
    });
    setStats({ earthquakes: usgsData().length + (bmkgData() ? 1 : 0), floods, storms, others: others + fires });
  };

  const getTacticalIcon = (type, severity) => {
    // Standardized color mapping
    const color = (severity === 'Red' || (typeof severity === 'number' && severity >= 6) || (typeof severity === 'string' && parseFloat(severity) > 350)) ? '#ff1744' : 
                  (severity === 'Orange' || (typeof severity === 'number' && severity >= 4) || (typeof severity === 'string' && parseFloat(severity) > 310)) ? '#ff9100' : '#00e676';
    
    // Icon Mappings
    const icons = {
        'EQ': '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>', // Bolt
        'ID_QUAKE': '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
        'QUAKE': '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
        'FIRE_ANOMALY': '<path d="M12 2c0 10-4 12-4 12s8-3 8-12c0 0-4.5 1.5-4 4.5 0 0-4.5-1.5-4-4.5z"/>', // Flame
        'WILDFIRES': '<path d="M12 2c0 10-4 12-4 12s8-3 8-12c0 0-4.5 1.5-4 4.5 0 0-4.5-1.5-4-4.5z"/>',
        'FL': '<path d="M2 12s3-4 10-4 10 4 10 4-3 4-10 4-10-4-10-4z"/><path d="M7 12c0 1 1 2 5 2s5-1 5-2"/>', // Wave
        'FLOODS': '<path d="M2 12s3-4 10-4 10 4 10 4-3 4-10 4-10-4-10-4z"/><path d="M7 12c0 1 1 2 5 2s5-1 5-2"/>',
        'TC': '<path d="M21 4H3l2 16h14l2-16zM12 11h-2v2h2v-2z"/>', // Cyclone
        'SEVERESTORMS': '<path d="M21 4H3l2 16h14l2-16zM12 11h-2v2h2v-2z"/>',
        'VOLCANOES': '<path d="M2 20L12 4l10 16H2z"/>' // Volcano
    };

    const glyph = icons[type] || '<circle cx="12" cy="12" r="5"/>';

    return window.L.divIcon({
        html: `
            <div class="relative flex items-center justify-center">
                <div class="absolute w-8 h-8 rounded border border-white/20 bg-black/40 backdrop-blur-md"></div>
                <div class="absolute w-6 h-6 rounded rotate-45 border border-${color}" style="background-color: ${color}20"></div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${color}" style="filter: drop-shadow(0 0 4px ${color})">
                    ${glyph}
                </svg>
            </div>
        `,
        className: 'tactical-marker',
        iconSize: [24, 24]
    });
  };

  const updateMarkers = () => {
    if (!gdacsLayer || !usgsLayer) return;
    gdacsLayer.clearLayers();
    usgsLayer.clearLayers();

    const cat = category();

    // 1. GDACS
    gdacsData().forEach(f => {
      const type = f.properties.eventtype;
      if (cat !== 'All' && !(
          (cat === 'Floods' && type === 'FL') ||
          (cat === 'Storms' && (type === 'TC' || type === 'ST')) ||
          (cat === 'Earthquakes' && type === 'EQ')
      )) return;
      const coords = f.geometry.coordinates;
      let lng = Array.isArray(coords[0]) ? coords[0][0] : coords[0];
      let lat = Array.isArray(coords[0]) ? coords[0][1] : coords[1];
      window.L.marker([lat, lng], { icon: getTacticalIcon(type, f.properties.alertlevel) }).addTo(gdacsLayer);
    });

    // 2. Earthquakes
    if (cat === 'All' || cat === 'Earthquakes') {
        usgsData().forEach(f => {
          const [lng, lat] = f.geometry.coordinates;
          window.L.marker([lat, lng], { icon: getTacticalIcon('EQ', f.properties.mag) }).addTo(usgsLayer);
        });
        const bmkg = bmkgData();
        if (bmkg && bmkg.Coordinates) {
          const [lat, lng] = bmkg.Coordinates.split(',').map(Number);
          window.L.marker([lat, lng], { icon: getTacticalIcon('ID_QUAKE', bmkg.Magnitude) }).addTo(usgsLayer);
        }
    }

    // 3. Fires (NASA FIRMS)
    if (cat === 'All' || cat === 'Fires') {
        nasaFirmsData().forEach(h => {
            const lat = parseFloat(h.latitude);
            const lng = parseFloat(h.longitude);
            window.L.marker([lat, lng], { icon: getTacticalIcon('FIRE_ANOMALY', h.brightness) }).addTo(gdacsLayer);
        });
    }

    // 4. NASA EONET
    nasaEonetData().forEach(ev => {
        const type = ev.categories[0]?.id;
        if (cat !== 'All' && !(
            (cat === 'Fires' && type === 'wildfires') ||
            (cat === 'Storms' && type === 'severeStorms') ||
            (cat === 'Floods' && type === 'floods') ||
            (cat === 'Volcanoes' && type === 'volcanoes')
        )) return;
        const geom = ev.geometry[0];
        if (geom && geom.coordinates) {
            const [lng, lat] = geom.coordinates;
            window.L.marker([lat, lng], { icon: getTacticalIcon(type.toUpperCase(), 'NASA_EONET') }).addTo(gdacsLayer);
        }
    });
  };

  const normalizeEvent = (ev) => {
    if (!ev) return null;
    // Handle GDACS/USGS
    if (ev.geometry && ev.geometry.coordinates) {
      const coords = ev.geometry.coordinates;
      let lng = Array.isArray(coords[0]) ? coords[0][0] : coords[0];
      let lat = Array.isArray(coords[0]) ? coords[0][1] : coords[1];
      return {
        id: ev.id || ev.properties?.eventid || ev.properties?.name,
        type: ev.properties?.eventtype || 'QUAKE',
        name: ev.properties?.name || ev.properties?.place,
        time: ev.properties?.time || ev.properties?.fromdate,
        lat, lng,
        severity: ev.properties?.alertlevel || ev.properties?.mag || 'INF',
        raw: ev
      };
    }
    // Handle FIRMS
    if (ev.latitude && ev.longitude) {
        return {
            id: `FIRE-${ev.latitude}-${ev.longitude}`,
            type: 'FIRE_ANOMALY',
            name: `Thermal Activity @ ${ev.latitude}, ${ev.longitude}`,
            time: `${ev.acq_date} ${ev.acq_time}`,
            lat: parseFloat(ev.latitude), lng: parseFloat(ev.longitude),
            severity: ev.brightness,
            raw: ev
        };
    }
    // Handle EONET
    if (ev.categories && ev.geometry) {
        const [lng, lat] = ev.geometry[0].coordinates;
        return {
            id: ev.id,
            type: ev.categories[0].id.toUpperCase(),
            name: ev.title,
            time: ev.geometry[0].date,
            lat, lng,
            severity: 'NASA_EONET',
            raw: ev
        };
    }
    // Handle BMKG
    if (ev.Coordinates) {
      const [lat, lng] = ev.Coordinates.split(',').map(Number);
      return {
        id: 'BMKG-' + ev.Tanggal + ev.Jam, type: 'ID_QUAKE',
        name: ev.Wilayah, time: ev.DateTime, lat, lng, severity: ev.Magnitude, raw: ev
      };
    }
    return null;
  };

  const handleFocus = (event) => {
    setSelectedEvent(event);
    const normalized = normalizeEvent(event);
    if (normalized && mapInstance) mapInstance.flyTo([normalized.lat, normalized.lng], 10);
  };

  onCleanup(() => { if (mapInstance) mapInstance.remove(); });

  return (
    <div class="h-full w-full flex flex-col overflow-hidden bg-bg_main font-mono lowercase">
      
      {/* HEADER: OPERATIONAL STATUS */}
      <div class="h-14 border-b border-border_main bg-bg_header/40 flex items-center justify-between px-6 shrink-0">
          <div class="flex items-center gap-4">
              <div class="w-10 h-10 flex items-center justify-center bg-red-500/10 border border-red-500/30 rounded shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="10" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
              </div>
              <div class="flex flex-col">
                  <h1 class="text-[14px] font-black tracking-tighter text-text_primary uppercase leading-none">GLOBAL_DISASTER_OBSERVATORY</h1>
                  <span class="text-[9px] text-red-500 animate-pulse font-black uppercase tracking-[0.2em]">Operational_Intel_Uplink</span>
              </div>
          </div>

          <div class="flex items-center gap-4">
              {/* SPECIALIZED INTELLIGENCE FILTERS */}
              <div class="flex items-center bg-black/40 border border-border_main p-1 rounded backdrop-blur-md">
                  <span class="text-[8px] font-black text-text_secondary px-2 border-r border-border_main/30 uppercase">Category</span>
                  <div class="flex gap-1 px-1">
                      {['All', 'Earthquakes', 'Fires', 'Floods', 'Storms'].map(c => (
                          <button 
                            onClick={() => { setCategory(c); updateMarkers(); }}
                            class={`px-2 py-0.5 text-[8px] font-bold uppercase transition-all ${category() === c ? 'bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'text-text_secondary hover:text-white'}`}
                          >
                              {c}
                          </button>
                      ))}
                  </div>
              </div>

              <div class="flex items-center bg-black/40 border border-border_main p-1 rounded backdrop-blur-md">
                  <span class="text-[8px] font-black text-text_secondary px-2 border-r border-border_main/30 uppercase">Focus</span>
                  <div class="flex gap-1 px-1">
                      {['Global', 'Indonesia', 'China', 'USA', 'Turkey'].map(f => (
                          <button 
                            onClick={() => handleFocusChange(f)}
                            class={`px-2 py-0.5 text-[8px] font-bold uppercase transition-all ${focus() === f ? 'bg-text_accent text-bg_main' : 'text-text_secondary hover:text-white'}`}
                          >
                              {f}
                          </button>
                      ))}
                  </div>
              </div>

              <div class="flex flex-col items-end border-r border-border_main pr-6">
                  <span class="text-[8px] text-text_secondary uppercase font-black tracking-widest mb-1">SOURCE_NODES</span>
                  <div class="flex items-center gap-3">
                      {['GDACS', 'USGS', 'BMKG', 'NASA'].map(s => (
                        <div class="flex items-center gap-1 opacity-70">
                            <div class="w-1 h-1 rounded-full bg-emerald-500"></div>
                            <span class="text-[9px] font-black text-white uppercase">{s}</span>
                        </div>
                      ))}
                  </div>
              </div>

              <button 
                onClick={fetchData}
                class="px-4 py-2 bg-text_accent/10 border border-text_accent/30 text-text_accent text-[10px] font-black tracking-widest hover:bg-text_accent hover:text-bg_main transition-colors uppercase"
                disabled={loading()}
              >
                {loading() ? 'REFRESHING...' : 'FORCE_SYNC'}
              </button>
          </div>
      </div>

      <div class="flex-1 flex overflow-hidden">
        {/* LEFT INFOSENSING AREA */}
        <div class="flex-[3] flex flex-col border-r border-border_main relative">
            <div class="flex-1 bg-zinc-900 overflow-hidden relative" ref={initMap}>
                {/* TACTICAL LEGEND TABLE */}
                <div class="absolute bottom-6 left-6 z-[1000] p-4 bg-black/85 border border-border_main/50 backdrop-blur-xl pointer-events-none">
                    <div class="text-[8px] font-black text-text_accent uppercase tracking-[0.2em] mb-4 pb-2 border-b border-border_main/30">DISASTER_CLASSIFICATION_LEGEND</div>
                    <table class="w-full text-left">
                        <thead class="text-[7px] text-text_secondary uppercase font-bold">
                            <tr>
                                <th class="pb-2 pr-4">Glyph</th>
                                <th class="pb-2 pr-4">Threat_Type</th>
                                <th class="pb-2">Severity_Levels</th>
                            </tr>
                        </thead>
                        <tbody class="space-y-1">
                            {[
                                { l: 'Earthquakes', i: 'Bolt' },
                                { l: 'Wildfires', i: 'Flame' },
                                { l: 'Floods', i: 'Wave' },
                                { l: 'Storms', i: 'Cyclone' },
                                { l: 'Volcanoes', i: 'Delta' }
                            ].map(row => (
                                <tr class="text-[9px] font-black border-t border-border_main/10">
                                    <td class="py-1.5 pr-4 flex items-center gap-2">
                                        <div class="w-4 h-4 border border-white/20 flex items-center justify-center bg-white/5">
                                            <div class="w-2 h-2 rounded-full bg-text_accent animate-pulse"></div>
                                        </div>
                                    </td>
                                    <td class="py-1.5 pr-4 text-white uppercase">{row.l}</td>
                                    <td class="py-1.5 flex gap-1">
                                        <div class="w-3 h-3 bg-[#ff1744] shadow-[0_0_5px_rgba(255,23,68,0.5)]"></div>
                                        <div class="w-3 h-3 bg-[#ff9100] shadow-[0_0_5px_rgba(255,145,0,0.5)]"></div>
                                        <div class="w-3 h-3 bg-[#00e676] shadow-[0_0_5px_rgba(0,230,118,0.5)]"></div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BOTTOM HUD SECTION */}
            <div class="h-44 bg-bg_header/20 border-t border-border_main flex shrink-0 overflow-hidden">
                <div class="w-64 border-r border-border_main p-4 flex flex-col justify-between bg-black/20">
                    <span class="text-[9px] font-black text-text_secondary uppercase tracking-widest">Global_Status_Summary</span>
                    <div class="grid grid-cols-2 gap-2 mt-2">
                        <div class="p-2 border border-border_main/30 bg-black/40">
                            <div class="text-[8px] text-text_accent font-black uppercase">Earthquakes</div>
                            <div class="text-[18px] font-black leading-none mt-1">{stats().earthquakes}</div>
                        </div>
                        <div class="p-2 border border-border_main/30 bg-black/40">
                            <div class="text-[8px] text-blue-400 font-black uppercase">Floods</div>
                            <div class="text-[18px] font-black leading-none mt-1">{stats().floods}</div>
                        </div>
                        <div class="p-2 border border-border_main/30 bg-black/40">
                            <div class="text-[8px] text-orange-400 font-black uppercase">Storms</div>
                            <div class="text-[18px] font-black leading-none mt-1">{stats().storms}</div>
                        </div>
                        <div class="p-2 border border-border_main/30 bg-black/40">
                            <div class="text-[8px] text-text_secondary/60 font-black uppercase">Others</div>
                            <div class="text-[18px] font-black leading-none mt-1">{stats().others}</div>
                        </div>
                    </div>
                </div>
                <div class="flex-1 flex flex-col overflow-hidden">
                    <div class="border-b border-border_main/30 bg-black/10">
                        <span class="text-[9px] font-black text-text_accent uppercase tracking-[0.2em] px-4 py-2 bg-text_accent/5 border-b border-r border-border_main/30 inline-block">Tactical_Intelligence_Feed</span>
                    </div>
                    
                    <div class="flex-1 overflow-hidden flex flex-col">
                        {/* THE REAL-TIME TABLE */}
                        <div class="flex-1 overflow-y-auto win-scroll">
                            <table class="w-full text-left border-collapse">
                                <thead class="sticky top-0 bg-bg_header/80 backdrop-blur-md z-10 border-b border-border_main">
                                    <tr class="text-[8px] font-black text-text_secondary uppercase tracking-widest">
                                        <th class="px-4 py-2 border-r border-border_main/20 w-24">Timestamp</th>
                                        <th class="px-4 py-2 border-r border-border_main/20 w-20 text-center">Type</th>
                                        <th class="px-4 py-2 border-r border-border_main/20">Operational_Focus / Location</th>
                                        <th class="px-4 py-2 border-r border-border_main/20 w-24 text-center">Threat_Lvl</th>
                                        <th class="px-4 py-2 w-32 text-right">Coordinates</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={[...(bmkgData() ? [bmkgData()] : []), ...gdacsData(), ...usgsData()]
                                         .map(normalizeEvent)
                                         .filter(Boolean)
                                         .sort((a,b) => new Date(b.time) - new Date(a.time))
                                         .slice(0, 50)}>
                                       {(ev) => {
                                          const severityColor = ev.severity === 'Red' || (typeof ev.severity === 'number' && ev.severity >= 6) ? 'text-red-500' : 
                                                              ev.severity === 'Orange' || (typeof ev.severity === 'number' && ev.severity >= 4) ? 'text-orange-500' : 'text-emerald-500';
                                          
                                          return (
                                            <tr 
                                              onClick={() => handleFocus(ev.raw)}
                                              class="border-b border-border_main/10 hover:bg-text_accent/5 cursor-pointer transition-colors group"
                                            >
                                                <td class="px-4 py-1.5 border-r border-border_main/10 font-mono text-[9px] text-text_secondary whitespace-nowrap">
                                                    {new Date(ev.time).toLocaleDateString('en-GB')} {new Date(ev.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                                                </td>
                                                <td class="px-4 py-1.5 border-r border-border_main/10 text-center">
                                                    <span class="text-[8px] font-black px-1.5 py-0.5 bg-black/40 border border-border_main/30 text-white leading-none uppercase">
                                                        {ev.type.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td class="px-4 py-1.5 border-r border-border_main/10">
                                                    <div class="text-[10px] font-black text-text_primary uppercase group-hover:text-text_accent transition-colors truncate max-w-[400px]">
                                                        {ev.name}
                                                    </div>
                                                </td>
                                                <td class="px-4 py-1.5 border-r border-border_main/10 text-center">
                                                    <div class={`flex items-center justify-center gap-2 font-black text-[9px] ${severityColor}`}>
                                                        <div class={`w-1.5 h-1.5 rounded-full animate-pulse ${severityColor.replace('text', 'bg')}`}></div>
                                                        {ev.severity}
                                                    </div>
                                                </td>
                                                <td class="px-4 py-1.5 text-right font-mono text-[9px] text-text_secondary/80 italic">
                                                    {ev.lat?.toFixed(3)}, {ev.lng?.toFixed(3)}
                                                </td>
                                            </tr>
                                          )
                                       }}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT ANALYTICS SIDEBAR (30%) */}
        <aside class="w-[30%] flex flex-col bg-bg_sidebar/20 overflow-hidden">
            <div class="px-6 py-4 border-b border-border_main flex items-center justify-between bg-black/20 shrink-0">
                <span class="text-[10px] font-black text-text_accent uppercase tracking-[0.3em]">INTELLIGENCE_DOSSIER</span>
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
            
            <div class="flex-1 overflow-y-auto win-scroll p-4 space-y-6">
                
                {/* ACTIVE FOCUS ACTION */}
                <Show when={selectedEvent() && normalizeEvent(selectedEvent())}>
                    <div class="bg-bg_header/60 border border-text_accent/40 p-4 shadow-[0_0_15px_rgba(0,255,65,0.1)] mb-6 animate-in slide-in-from-top-2">
                        <div class="flex flex-col gap-1 mb-4">
                            <span class="text-[8px] text-text_accent font-black tracking-widest uppercase">ACTIVE_TARGET_LOCKED</span>
                            <span class="text-[14px] font-black text-text_primary leading-none uppercase">{normalizeEvent(selectedEvent())?.name}</span>
                            <span class="text-[9px] text-text_secondary font-mono italic mt-1">COORD: {normalizeEvent(selectedEvent())?.lat.toFixed(4)}, {normalizeEvent(selectedEvent())?.lng.toFixed(4)}</span>
                        </div>
                        <button 
                            onClick={() => {
                                const ev = normalizeEvent(selectedEvent());
                                if(ev) openSatelliteRecon(ev);
                            }}
                            class="w-full py-2.5 bg-text_accent text-bg_main font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:brightness-125 transition-all"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                            START_SATELLITE_UPLINK (NASA_EO)
                        </button>
                    </div>
                </Show>



                {/* BMKG LATEST (INDONESIA) */}
                <Show when={bmkgData()}>
                    <section>
                        <div class="flex items-center gap-3 mb-4">
                            <div class="flex-1 h-px bg-amber-500/30"></div>
                            <h4 class="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-bg_main px-2">BMKG_INDONESIA</h4>
                            <div class="flex-1 h-px bg-amber-500/30"></div>
                        </div>
                        <div 
                            onClick={() => {
                                const [lat, lng] = bmkgData().Coordinates.split(',').map(Number);
                                mapInstance.flyTo([lat, lng], 12);
                            }}
                            class="p-4 border-2 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all cursor-pointer group relative overflow-hidden"
                        >
                            <div class="absolute -right-4 -top-4 w-16 h-16 border-4 border-amber-500/10 rounded-full group-hover:scale-150 transition-transform duration-700" />
                            <div class="flex justify-between items-start mb-3 relative z-10">
                                <div class="flex flex-col">
                                    <span class="text-[14px] font-black text-white leading-tight uppercase">{bmkgData().Wilayah}</span>
                                    <span class="text-[8px] text-amber-500 font-bold tracking-widest mt-1 italic">{bmkgData().Potensi}</span>
                                </div>
                                <div class="flex flex-col items-end">
                                    <span class="text-[18px] font-black text-amber-500 leading-none">{bmkgData().Magnitude}</span>
                                    <span class="text-[8px] opacity-40 font-mono mt-1">SR</span>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-4 pt-3 border-t border-amber-500/20 relative z-10">
                                <div class="flex flex-col">
                                    <span class="text-[7px] text-amber-500/60 font-black uppercase tracking-tighter">Kedalaman</span>
                                    <span class="text-[10px] text-white font-mono">{bmkgData().Kedalaman}</span>
                                </div>
                                <div class="flex flex-col items-end">
                                    <span class="text-[7px] text-amber-500/60 font-black uppercase tracking-tighter">Coordinates</span>
                                    <span class="text-[10px] text-white font-mono">{bmkgData().Coordinates}</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </Show>

                {/* GDACS MAJOR THREATS */}
                <section>
                    <div class="flex items-center gap-3 mb-4">
                        <div class="flex-1 h-px bg-border_main/30"></div>
                        <h4 class="text-[9px] font-black text-orange-400 uppercase tracking-widest bg-bg_main px-2">GDACS_ALERTS</h4>
                        <div class="flex-1 h-px bg-border_main/30"></div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <For each={gdacsData().slice(0, 10)}>
                            {(alert) => (
                                <div 
                                    onClick={() => handleFocus(alert)}
                                    class="p-3 border border-border_main/40 bg-black/30 hover:border-text_accent/60 transition-all group cursor-pointer"
                                >
                                    <div class="flex justify-between items-start mb-2">
                                        <div class="flex flex-col">
                                            <span class="text-[10px] font-black text-text_primary group-hover:text-text_accent">{alert.properties.name}</span>
                                            <span class="text-[8px] text-text_secondary italic opacity-60">{alert.properties.country}</span>
                                        </div>
                                        <div class={`px-2 py-0.5 text-[8px] font-black border rounded-sm ${alert.properties.alertlevel === 'Red' ? 'border-red-500/50 bg-red-500/10 text-red-500' : 'border-orange-500/50 bg-orange-500/10 text-orange-500'}`}>
                                            {alert.properties.alertlevel}
                                        </div>
                                    </div>
                                    <div class="flex justify-between text-[8px] font-bold text-text_secondary/80 mt-1 uppercase">
                                        <span>TYPE: {alert.properties.eventtype}</span>
                                        <span>DUR: {alert.properties.duration || 'N/A'} hrs</span>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </section>

                {/* USGS SEISMIC ACTIVITY */}
                <section>
                    <div class="flex items-center gap-3 mb-4">
                        <div class="flex-1 h-px bg-border_main/30"></div>
                        <h4 class="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-bg_main px-2">USGS_SEISMIC</h4>
                        <div class="flex-1 h-px bg-border_main/30"></div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <For each={usgsData().slice(0, 15)}>
                            {(quake) => (
                                <div 
                                    onClick={() => handleFocus(quake)}
                                    class="flex items-center gap-4 p-2 border-b border-border_main/10 hover:bg-white/5 transition-colors group cursor-pointer"
                                >
                                    <div class={`w-10 h-10 shrink-0 flex items-center justify-center border font-black text-[12px] ${quake.properties.mag >= 5 ? 'border-red-500/40 text-red-500 bg-red-500/5' : 'border-text_accent/40 text-text_accent bg-text_accent/5'}`}>
                                        {quake.properties.mag?.toFixed(1)}
                                    </div>
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-[9px] font-black text-text_primary truncate uppercase group-hover:text-text_accent">{quake.properties.place}</span>
                                        <span class="text-[7px] text-text_secondary font-bold uppercase">{new Date(quake.properties.time).toLocaleDateString('en-GB')} {new Date(quake.properties.time).toLocaleTimeString()}</span>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </section>
            </div>
            
            <div class="p-4 border-t border-border_main bg-black/40 flex items-center justify-between">
                <span class="text-[8px] font-black text-text_secondary opacity-40 uppercase tracking-widest">Global_Grid_ID: 882-QX</span>
                <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_var(--text-accent)]"></div>
                    <span class="text-[8px] font-black text-text_accent uppercase">Sync_Active</span>
                </div>
            </div>
        </aside>
      </div>

      {/* SATELLITE MODAL OVERLAY */}
      <Show when={showSatelliteModal()}>
        <div class="fixed inset-0 z-[9999] bg-bg_main/95 backdrop-blur-md flex flex-col p-10 animate-in fade-in duration-300">
            {/* Modal Header */}
            <div class="flex justify-between items-center border-b border-border_main pb-4 mb-6">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 border border-text_accent/40 bg-text_accent/10 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-text_accent"><circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                    </div>
                    <div class="flex flex-col">
                        <h2 class="text-xl font-black text-white uppercase tracking-widest leading-none">NASA_EARTH_OBSERVATORY_UPLINK</h2>
                        <span class="text-[10px] text-text_accent uppercase tracking-[0.3em] font-black mt-1">
                            {satLoading() ? `ESTABLISHING_CONNECTION... [${satProgress()}%]` : (processedLayers().length > 0 ? 'MISSION_READY' : 'WAITING_FOR_MISSION_COMMAND')}
                        </span>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <button 
                        onClick={() => setShowSatelliteModal(false)}
                        class="p-2 border border-border_main hover:border-red-500 hover:text-red-500 transition-all text-text_secondary"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 flex gap-6 overflow-hidden">
                {/* Layer Selection Sidebar in Modal */}
                <div class="w-80 bg-bg_header/20 border border-border_main p-4 flex flex-col gap-6 overflow-y-auto win-scroll shrink-0">
                    <span class="text-[10px] font-black text-text_accent uppercase tracking-[0.4em] border-b border-border_main pb-2">MISSION_CONTROL</span>
                    
                    {/* Mission Parameters */}
                    <div class="flex flex-col gap-4 p-4 bg-black/40 border-2 border-text_accent/20 rounded-sm">
                        
                        <div class="flex flex-col gap-2">
                            <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">MISSION_PROTOCOL</span>
                            <div class="flex gap-1">
                                {['SINGLE', 'TIME_SERIES'].map(m => (
                                    <button 
                                        onClick={() => setMissionMode(m)}
                                        class={`flex-1 py-1 text-[8px] font-black border transition-all ${missionMode() === m ? 'bg-text_accent text-bg_main border-text_accent' : 'bg-black/40 text-text_secondary border-border_main/30'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div class="flex flex-col gap-2">
                             <div class="flex justify-between items-center">
                                <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">{missionMode() === 'SINGLE' ? 'MISSION_DATE' : 'START_DATE'}</span>
                                <span class="text-[9px] font-mono text-text_accent">{satDate().split('-').reverse().join('/')}</span>
                             </div>
                             <input 
                                type="date"
                                value={satDate()}
                                onInput={(e) => setSatDate(e.target.value)}
                                class="bg-black/40 border border-border_main text-white text-[10px] p-2 outline-none focus:border-text_accent"
                             />
                        </div>

                        <Show when={missionMode() === 'TIME_SERIES'}>
                            <div class="flex flex-col gap-2 animate-in slide-in-from-top-1">
                                <div class="flex justify-between items-center">
                                    <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">END_DATE</span>
                                    <span class="text-[9px] font-mono text-text_accent">{satEndDate().split('-').reverse().join('/')}</span>
                                </div>
                                <input 
                                    type="date"
                                    value={satEndDate()}
                                    onInput={(e) => setSatEndDate(e.target.value)}
                                    class="bg-black/40 border border-border_main text-white text-[10px] p-2 outline-none focus:border-text_accent"
                                />
                            </div>
                        </Show>

                        <div class="flex flex-col gap-2">
                             <div class="flex justify-between items-center px-1">
                                <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">BREADTH (ZOOM)</span>
                                <span class="text-[9px] font-mono text-text_accent">{satRange().toFixed(1)}°</span>
                             </div>
                             <input 
                                type="range" min="0.1" max="5.0" step="0.1" 
                                value={satRange()} 
                                onInput={(e) => setSatRange(parseFloat(e.target.value))}
                                class="w-full accent-text_accent"
                             />
                        </div>

                        <div class="flex flex-col gap-2">
                             <div class="flex justify-between items-center px-1">
                                <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest">MOSAIC_GRID</span>
                                <span class="text-[9px] font-mono text-text_accent">{satGrid()}x{satGrid()}</span>
                             </div>
                             <input 
                                type="range" min="2" max="25" step="1" 
                                value={satGrid()} 
                                onInput={(e) => setSatGrid(parseInt(e.target.value))}
                                class="w-full accent-text_accent"
                             />
                        </div>

                        <button 
                            disabled={satLoading()}
                            onClick={startSatelliteMission}
                            class={`w-full py-4 mt-2 font-black text-[11px] uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-3 ${satLoading() ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-text_accent text-bg_main hover:brightness-125 shadow-[0_0_20px_rgba(0,255,65,0.2)]'}`}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="5 12 13 12 20 12"></polyline><polyline points="13 5 20 12 13 19"></polyline></svg>
                            {satLoading() ? 'EXECUTING...' : 'INITIATE_UPLINK'}
                        </button>
                    </div>

                    <span class="text-[10px] font-black text-text_secondary uppercase tracking-[0.4em] opacity-40 border-b border-white/5 pb-2">SPECTRAL_LAYERS</span>
                    
                    <For each={Object.entries(NASA_LAYERS)}>
                        {([category, layers]) => (
                            <div class="flex flex-col gap-2">
                                <span class="text-[8px] font-black text-text_secondary uppercase tracking-widest opacity-50">{category}</span>
                                <div class="flex flex-col gap-1">
                                    <For each={layers}>
                                        {(layer) => (
                                            <button 
                                                onClick={() => toggleLayer(layer.id)}
                                                class={`flex items-center gap-2 p-2 border transition-all text-left ${selectedLayers().includes(layer.id) ? 'border-text_accent bg-text_accent/10' : 'border-border_main/30 bg-black/20 opacity-60 hover:opacity-100'}`}
                                            >
                                                <div class={`w-2 h-2 rounded-sm ${selectedLayers().includes(layer.id) ? 'bg-text_accent shadow-[0_0_5px_var(--text-accent)]' : 'bg-zinc-800'}`}></div>
                                                <span class="text-[9px] font-bold text-white uppercase truncate">{layer.name}</span>
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </div>
                        )}
                    </For>
                </div>

                {/* Main Content Area: Canvas + Timeline Stack */}
                <div class="flex-1 flex overflow-hidden gap-6">
                    {/* Canvas Container */}
                    <div class="flex-1 flex flex-col overflow-hidden bg-black relative border border-border_main shadow-2xl">
                    
                    {/* Layer Switcher Tabs */}
                    <Show when={processedLayers().length > 0}>
                        <div class="flex border-b border-border_main bg-bg_header/40 p-1 shrink-0 gap-1 overflow-x-auto win-scroll">
                            <For each={processedLayers()}>
                                {(pLayer) => (
                                    <div class={`flex items-center gap-1 px-3 py-1.5 transition-all border-b-2 ${activeLayerId() === pLayer.id ? 'border-text_accent bg-text_accent/10' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                                        <button 
                                            onClick={() => setActiveLayerId(pLayer.id)}
                                            class={`text-[9px] font-black uppercase whitespace-nowrap ${activeLayerId() === pLayer.id ? 'text-white' : 'text-text_secondary hover:text-white'}`}
                                        >
                                            {pLayer.name}
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeProcessedLayer(pLayer.id);
                                            }}
                                            class="ml-2 w-4 h-4 flex items-center justify-center hover:bg-red-500 hover:text-white rounded-full text-[10px] text-text_secondary transition-all"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>

                    <div class="flex-1 overflow-auto win-scroll flex items-center justify-center bg-[#070b14] relative">
                        {satLoading() && (
                            <div class="absolute inset-0 bg-bg_main/80 z-[100] flex flex-col items-center justify-center gap-6">
                                <div class="w-16 h-16 border-4 border-t-text_accent rounded-full animate-spin"></div>
                                <div class="flex flex-col items-center text-center">
                                    <span class="text-sm font-black text-white tracking-widest uppercase mb-2">SCANNING_GEOSPATIAL_SPECTRUM</span>
                                    <div class="text-[10px] text-text_secondary mb-2 uppercase opacity-60">Processing Layer {processedLayers().length + 1} / {selectedLayers().length}</div>
                                    <div class="w-64 h-2 bg-bg_header border border-border_main relative mt-2">
                                        <div class="absolute inset-y-0 left-0 bg-text_accent transition-all duration-300" style={{ width: `${satProgress()}%` }}></div>
                                    </div>
                                    
                                    <button 
                                        onClick={abortUplink}
                                        class="mt-10 px-8 py-2 bg-red-500/10 border border-red-500/40 text-red-500 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-red-500 hover:text-white transition-all"
                                    >
                                        TERMINATE_UPLINK_MISSION
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <Show when={isAborted()}>
                            <div class="absolute inset-0 bg-red-900/10 z-50 flex items-center justify-center">
                                <span class="bg-black/80 border border-red-500 p-4 text-red-500 font-black text-[10px] uppercase tracking-widest">
                                    MISSION_ABORTED_BY_OPERATOR // DATA_PARTIAL
                                </span>
                            </div>
                        </Show>
                        
                        <div class="relative w-full h-full p-10 flex items-center justify-center">
                            <Show when={processedLayers().length === 0 && !satLoading()}>
                                <div class="text-text_secondary/30 text-[10px] uppercase font-black tracking-[1em]">Awaiting_Uplink_Sync</div>
                            </Show>
                             <canvas 
                                 ref={satCanvasRef} 
                                 class="max-w-[100%] max-h-[100%] object-contain shadow-[0_0_50px_rgba(0,0,0,0.8)] border-4 border-white/10"
                             ></canvas>
                        </div>
                        
                        <Show when={satInfo() && !satLoading()}>
                            <div class="absolute bottom-6 left-6 p-4 bg-black/80 border border-text_accent/30 backdrop-blur-md z-20">
                                <div class="flex flex-col gap-1 text-[10px] font-mono">
                                    <div class="flex justify-between items-center border-b border-text_accent/30 pb-2 mb-2 min-w-[300px]">
                                        <span class="text-text_accent font-black tracking-widest uppercase">TELEMETRY_DATA</span>
                                        <div class="flex items-center gap-2">
                                            <span class="text-[9px] text-white/40">MODE:</span>
                                            <span class="text-[9px] text-white font-black px-1.5 py-0.5 bg-text_accent/10 border border-text_accent/40">{missionMode()}</span>
                                        </div>
                                    </div>
                                    <span class="text-white">CENTER_COORD: {satInfo().center[0].toFixed(4)}, {satInfo().center[1].toFixed(4)}</span>
                                    <span class="text-white">CAPTURE_DATE: {timeSeriesRuns()[activeTSIndex()]?.date || satDate()}</span>
                                    <span class="text-white uppercase">Active_Spectrum: {processedLayers().find(l => l.id === activeLayerId())?.name}</span>
                                    
                                    <Show when={missionMode() === 'TIME_SERIES' && timeSeriesRuns().length > 1}>
                                        <div class="mt-4 pt-4 border-t border-white/10 flex items-center justify-between gap-4">
                                            <button 
                                                disabled={activeTSIndex() === 0}
                                                onClick={() => setActiveTSIndex(prev => prev - 1)}
                                                class="flex-1 py-2 bg-white/5 border border-white/10 text-white font-black text-[9px] hover:bg-white/10 disabled:opacity-20"
                                            >
                                                PREV_FRAME
                                            </button>
                                            <div class="text-[9px] text-text_accent font-bold">
                                                {activeTSIndex() + 1} / {timeSeriesRuns().length}
                                            </div>
                                            <button 
                                                disabled={activeTSIndex() === timeSeriesRuns().length - 1}
                                                onClick={() => setActiveTSIndex(prev => prev + 1)}
                                                class="flex-1 py-2 bg-text_accent/20 border border-text_accent/40 text-text_accent font-black text-[9px] hover:bg-text_accent hover:text-bg_main disabled:opacity-20"
                                            >
                                                NEXT_FRAME
                                            </button>
                                        </div>
                                    </Show>
                                    
                                    <div class="mt-2 text-[8px] text-emerald-500 font-black uppercase">Sensor_Array:</div>
                                    <div class="max-w-[300px] flex flex-wrap gap-1 text-[7px] text-text_secondary leading-tight">
                                        {processedLayers().map(l => l.name).join(' | ')}
                                    </div>
                                </div>
                            </div>
                        </Show>

                    </div>
                </div>

                    {/* Timeline Gallery Sidebar (Chrono Stack) */}
                    <Show when={missionMode() === 'TIME_SERIES' && timeSeriesRuns().length > 0}>
                        <aside class="w-64 bg-bg_header/20 border border-border_main flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-500 overflow-hidden">
                            <div class="p-4 border-b border-border_main bg-black/40">
                                <span class="text-[10px] font-black text-text_accent uppercase tracking-[0.3em]">CHRONO_STACK</span>
                            </div>
                            <div class="flex-1 overflow-y-auto win-scroll p-3 space-y-3">
                                <For each={timeSeriesRuns()}>
                                    {(run, idx) => (
                                        <button 
                                            onClick={() => setActiveTSIndex(idx())}
                                            class={`w-full group relative flex flex-col border transition-all ${activeTSIndex() === idx() ? 'border-text_accent bg-text_accent/5 shadow-[inset_0_0_10px_rgba(0,255,65,0.1)]' : 'border-border_main/30 bg-black/20 hover:border-text_accent/40'}`}
                                        >
                                            <div class="h-16 bg-zinc-900 flex items-center justify-center relative overflow-hidden transition-all">
                                                <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle, #fff 1px, transparent 1px); background-size: 8px 8px;"></div>
                                                <span class="text-[8px] font-black text-white/10 uppercase group-hover:text-text_accent/20">Frame_{idx()+1}</span>
                                                <Show when={activeTSIndex() === idx()}>
                                                    <div class="absolute inset-0 border-2 border-text_accent animate-pulse opacity-50"></div>
                                                </Show>
                                            </div>
                                            <div class="p-2 flex justify-between items-center bg-black/40">
                                                <span class={`text-[9px] font-black ${activeTSIndex() === idx() ? 'text-text_accent' : 'text-white/60'}`}>
                                                    {run.date.split('-').reverse().join('/')}
                                                </span>
                                                <div class={`w-1.5 h-1.5 rounded-full ${activeTSIndex() === idx() ? 'bg-text_accent shadow-[0_0_5px_var(--text-accent)]' : 'bg-white/10'}`}></div>
                                            </div>
                                        </button>
                                    )}
                                </For>
                            </div>
                            <div class="p-3 border-t border-border_main bg-black/40 text-center">
                                <span class="text-[8px] font-black text-text_secondary/40 uppercase">Total_Frames: {timeSeriesRuns().length}</span>
                            </div>
                        </aside>
                    </Show>
                </div>
            </div>
        </div>
      </Show>

    </div>
  );
}
