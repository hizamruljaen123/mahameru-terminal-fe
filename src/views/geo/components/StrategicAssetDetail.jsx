import { Show, For, onCleanup, createSignal, createEffect, createMemo } from 'solid-js';
import { useNearbyFacilities } from '../hooks/useNearbyFacilities';
import { useAisStream } from '../hooks/useAisStream';
import TechnicalDossier from './TechnicalDossier';
import NearbyFacilitiesList from './NearbyFacilitiesList';
import SigintFeed from './SigintFeed';

export default function StrategicAssetDetail(props) {
  const [mapMode, setMapMode] = createSignal('satellite');
  const [isMapReady, setIsMapReady] = createSignal(false);
  const [viewPerspective, setViewPerspective] = createSignal('tilt');
  const [selectedNearby, setSelectedNearby] = createSignal(null);
  const [hudHeight, setHudHeight] = createSignal(250);
  const [hudWidth, setHudWidth] = createSignal(400);
  const [showFleetMesh, setShowFleetMesh] = createSignal(false);
  const [activeCategory, setActiveCategory] = createSignal('all');
  const [sidebarTab, setSidebarTab] = createSignal('META');
  
  const { nearbyFacilities, isLoadingNearby } = useNearbyFacilities(props);
  const ais = useAisStream();
  
  // Reset local state when the main asset changes
  createEffect(() => {
    props.selectedRefinery();
    props.selectedLng();
    props.selectedOffshore();
    props.selectedTerminal();
    setSelectedNearby(null);
    setSidebarTab('META');
    setActiveCategory('all');
  });

  // Reactive Merged List: Static Infra + Live AIS Stream
  const mergedFacilities = createMemo(() => {
    const staticList = nearbyFacilities();
    const liveShipsMap = ais.liveShips();

    const mainLat = props.selectedRefinery()?.latitude || props.selectedLng()?.latitude || props.selectedOffshore()?.latitude || props.selectedTerminal()?.latitude;
    const mainLon = props.selectedRefinery()?.longitude || props.selectedLng()?.longitude || props.selectedOffshore()?.longitude || props.selectedTerminal()?.longitude;

    if (!mainLat || !mainLon) return staticList;

    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };
    
    // Filter live ships to only Cargo and Tanker and Calc Distance
    const liveShipsArray = Object.values(liveShipsMap)
      .filter(s => s.type === 'Cargo' || s.type === 'Tanker')
      .map(s => ({
         ...s,
         infra_type: 'vessel',
         distance: haversine(mainLat, mainLon, s.lat, s.lon)
      }));

    // Create a Map to deduplicate vessels by MMSI
    const dedupedVessels = new Map();
    
    // Add REST ships (already has distance)
    staticList
      .filter(f => f.infra_type === 'vessel' && (f.type === 'Cargo' || f.type === 'Tanker'))
      .forEach(v => {
        dedupedVessels.set(v.mmsi, v);
      });
    
    // Override with Live Stream ships (updated distance)
    liveShipsArray.forEach(v => {
      dedupedVessels.set(v.mmsi, v);
    });

    // Final merge: All Non-Vessel Infra + Deduped Cargo/Tanker Vessels
    const infraOnly = staticList.filter(f => f.infra_type !== 'vessel');
    const finalVessels = Array.from(dedupedVessels.values());
    
    const combined = [...infraOnly, ...finalVessels];
    return combined.sort((a,b) => a.distance - b.distance);
  });

  const filteredMarkers = createMemo(() => {
    const list = mergedFacilities();
    const cat = activeCategory();
    const energyTypes = ['refinery', 'lng', 'terminal', 'offshore'];
    
    if (cat === 'all') return list;
    if (cat === 'energy') return list.filter(f => energyTypes.includes(f.infra_type));
    if (cat === 'vessel') return list.filter(f => f.infra_type === 'vessel');
    return list.filter(f => f.infra_type === cat);
  });

  let mapInstance = null;
  let activeMarker = null;
  let nearbyMarker = null;
  let distanceMarker = null;
  let mapContainer;

  const handleStreamNearPort = () => {
    const ports = nearbyFacilities().filter(f => f.infra_type === 'port');
    if (ports.length === 0) {
      console.warn("No nearby ports found for AIS streaming");
      return;
    }
    
    // Sort by distance and get the nearest
    const nearestPort = ports.sort((a,b) => a.distance - b.distance)[0];
    
    // Calculate BBox (0.2 deg around port)
    const bbox = [
      [nearestPort.latitude - 0.1, nearestPort.longitude - 0.1],
      [nearestPort.latitude + 0.1, nearestPort.longitude + 0.1]
    ];
    
    console.log(`Targeting NAV stream at: ${nearestPort.name} @ ${nearestPort.latitude}, ${nearestPort.longitude}`);
    ais.connect(bbox);
    
    // Fly map to port
    if (mapInstance) {
      mapInstance.flyTo({ center: [nearestPort.longitude, nearestPort.latitude], zoom: 13, pitch: 45, duration: 2000 });
    }
  };

  const initMap = () => {
    if (mapInstance || !mapContainer) return;

    const lat = props.selectedRefinery()?.latitude || props.selectedLng()?.latitude || props.selectedOffshore()?.latitude || props.selectedTerminal()?.latitude || 0;
    const lon = props.selectedRefinery()?.longitude || props.selectedLng()?.longitude || props.selectedOffshore()?.longitude || props.selectedTerminal()?.longitude || 0;

    mapInstance = new window.maplibregl.Map({
      container: mapContainer,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [lon, lat],
      zoom: 16,
      pitch: 65,
      bearing: 45,
      antialias: true
    });

    mapInstance.on('load', () => {
      setIsMapReady(true);
      update3DBuildings();
      
      // Initialize sources for proximity line
      mapInstance.addSource('proximity-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      mapInstance.addLayer({
        id: 'proximity-line-layer',
        type: 'line',
        source: 'proximity-line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
          'line-dasharray': [2, 2]
        }
      });

      mapInstance.addSource('proximity-label', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      mapInstance.addLayer({
        id: 'proximity-label-layer',
        type: 'symbol',
        source: 'proximity-label',
        layout: {
          'text-field': ['get', 'distance'],
          'text-font': ['Open Sans Bold'],
          'text-size': 11,
          'text-offset': [0, -1]
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': '#3b82f6',
          'text-halo-width': 2
        }
      });
      mapInstance.on('styleimagemissing', (e) => {
        const data = new Uint8Array(1 * 1 * 4);
        mapInstance.addImage(e.id, { width: 1, height: 1, data });
      });
    });
  };

  const update3DBuildings = () => {
    if (!mapInstance || !mapInstance.isStyleLoaded()) return;
    if (mapInstance.getLayer('3d-buildings')) return;

    if (mapInstance.getSource('openmaptiles')) {
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
  };

  createEffect(() => {
    const mode = mapMode();
    const ready = isMapReady();
    if (!mapInstance || !ready) return;

    if (mode === 'satellite') {
      mapInstance.setStyle({
        version: 8,
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        sources: {
          'satellite': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256
          }
        },
        layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
      });
    } else {
      mapInstance.setStyle('https://tiles.openfreemap.org/styles/dark');
    }

    mapInstance.once('styledata', update3DBuildings);
  });

  createEffect(() => {
    if (props.showDetail() && props.detailTab() === 'INTEL') {
      setTimeout(initMap, 300);
    }
  });
  const getMarkerHTML = (type, name, lat, lon, color, isSelected = false, activeCategory = 'all') => {
    const isMinimal = activeCategory === 'all' && !isSelected;

    if (isMinimal) {
      return `
        <div class="group cursor-pointer flex flex-col items-center">
           <div class="w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')} border border-white/20 shadow-xl transition-all group-hover:scale-150"></div>
        </div>
      `;
    }

    const icons = {
      port: '<path d="M12 22V8M5 12h14M12 8l-4 4M12 8l4 4"/>',
      airport: '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 21 4s-2 0-3.5 1.5L14 9L5.8 7.2L4 9l7 3l-3 3l-3-1l-2 2l3 2l2 3l2-2l-1-3l3-3l3 7l1.8-1.8z"/>',
      industrial: '<path d="M2 20V4l6 4v12M8 20l6-4V4l6 4v12"/>',
      refinery: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
      lng: '<path d="M21 8c0-4.42-9-8-9-8s-9 3.58-9 8c0 3.87 3.13 7 7 7h4c3.87 0 7-3.13 7-7z"/>',
      terminal: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
      offshore: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
      vessel: '<path d="M22 10l-6-6H8L2 10h20zM2 10v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10M12 10V4"/>'
    };

    const icon = icons[type] || '<circle cx="12" cy="12" r="10"/>';
    const scale = isSelected ? 'scale(1.2)' : 'scale(0.8)';
    const opacity = isSelected ? '1' : '0.6';
    const shadow = isSelected ? 'drop-shadow(0 0 10px rgba(59,130,246,0.8))' : 'drop-shadow(0 5px 5px rgba(0,0,0,0.5))';
    
    return `
      <div class="flex flex-col items-center group cursor-pointer transition-all duration-300" style="transform: ${scale}; opacity: ${opacity}; filter: ${shadow};">
        <div class="absolute bottom-full mb-2 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all pointer-events-none">
           <div class="bg-black/90 border border-${color.replace('text-', '')}/40 px-3 py-1.5 backdrop-blur-md whitespace-nowrap">
              <span class="text-[9px] font-black text-white uppercase tracking-tighter block">${name}</span>
              <span class="text-[7px] font-mono text-${color.replace('text-', '')} font-black">${lat.toFixed(5)}N / ${lon.toFixed(5)}E</span>
           </div>
        </div>
        <div class="relative w-10 h-10 flex items-center justify-center">
           <svg width="40" height="40" viewBox="0 0 40 40" class="absolute inset-0 ${color}">
              <path fill="currentColor" d="M20 0C8.954 0 0 8.954 0 20c0 11.046 8.954 20 20 20s20-8.954 20-20c0-11.046-8.954-20-20-20z"/>
              <path fill="rgba(0,0,0,0.3)" d="M20 2C10.059 2 2 10.059 2 20s8.059 18 18 18 18-8.059 18-18S29.941 2 20 2z"/>
           </svg>
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" class="relative z-10">
              ${icon}
           </svg>
        </div>
        ${isSelected ? '<div class="w-1.5 h-1.5 bg-white rounded-full mt-[-2px] animate-pulse"></div>' : '<div class="w-1 h-1 bg-white/40 rounded-full mt-[-2px]"></div>'}
      </div>
    `;
  };

  let facilityMarkers = new Map();

  createEffect(() => {
    const list = filteredMarkers().filter(f => typeof (f.longitude || f.lon) === 'number' && typeof (f.latitude || f.lat) === 'number');
    const ready = isMapReady();
    if (!mapInstance || !ready) return;

    const mainLat = props.selectedRefinery()?.latitude || props.selectedLng()?.latitude || props.selectedOffshore()?.latitude || props.selectedTerminal()?.latitude || 0;
    const mainLon = props.selectedRefinery()?.longitude || props.selectedLng()?.longitude || props.selectedOffshore()?.longitude || props.selectedTerminal()?.longitude || 0;

    if (mainLat === 0) return;

    const bounds = new window.maplibregl.LngLatBounds();
    bounds.extend([mainLon, mainLat]);

    if (list.length > 0) {
      list.forEach(fac => {
        const fLat = fac.latitude || fac.lat;
        const fLon = fac.longitude || fac.lon;
        if (typeof fLat === 'number' && typeof fLon === 'number') {
          bounds.extend([fLon, fLat]);
        }
      });
      if (!bounds.isEmpty()) {
        mapInstance.fitBounds(bounds, { padding: 100, pitch: 45, duration: 2000 });
      }
    } else {
      mapInstance.flyTo({ center: [mainLon, mainLat], zoom: 15, pitch: 45, duration: 2000 });
    }
  });

  // Marker Management Effect
  createEffect(() => {
    const list = filteredMarkers().filter(f => typeof (f.longitude || f.lon) === 'number' && typeof (f.latitude || f.lat) === 'number');
    const selected = selectedNearby();
    const ready = isMapReady();
    if (!mapInstance || !ready) return;

    const mainLat = props.selectedRefinery()?.latitude || props.selectedLng()?.latitude || props.selectedOffshore()?.latitude || props.selectedTerminal()?.latitude || 0;
    const mainLon = props.selectedRefinery()?.longitude || props.selectedLng()?.longitude || props.selectedOffshore()?.longitude || props.selectedTerminal()?.longitude || 0;

    // 1. Cleanup old markers not in current list
    const currentIds = new Set(list.map(f => f.mmsi || f.id || f.name));
    for (const [id, marker] of facilityMarkers.entries()) {
      if (!currentIds.has(id)) {
        marker.remove();
        facilityMarkers.delete(id);
      }
    }

    // 2. Draw/Update Markers
    list.forEach(fac => {
      const id = fac.mmsi || fac.id || fac.name;
      const isSelected = selected && (id === (selected.mmsi || selected.id || selected.name));
      
      const colors = { port: 'text-blue-400', airport: 'text-yellow-400', industrial: 'text-emerald-400', refinery: 'text-orange-500', lng: 'text-cyan-400', terminal: 'text-fuchsia-400', offshore: 'text-rose-500' };
      let color = colors[fac.infra_type] || 'text-blue-500';
      if (fac.infra_type === 'vessel') {
        if (fac.type === 'Tanker') color = 'text-rose-400';
        else if (fac.type === 'Cargo') color = 'text-sky-400';
        else color = 'text-slate-400';
      }

      if (facilityMarkers.has(id)) {
        const marker = facilityMarkers.get(id);
        marker.setLngLat([fac.longitude || fac.lon, fac.latitude || fac.lat]);
        if (marker._isSelected !== isSelected || marker._activeCategory !== activeCategory()) {
          marker.remove();
          facilityMarkers.delete(id);
        } else {
          return;
        }
      }

      // Create New Marker
      const el = document.createElement('div');
      el.innerHTML = getMarkerHTML(fac.infra_type, fac.name, fac.latitude || fac.lat, fac.longitude || fac.lon, color, isSelected, activeCategory());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedNearby(fac);
      });

      const newMarker = new window.maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([fac.longitude || fac.lon, fac.latitude || fac.lat])
        .addTo(mapInstance);
      
      newMarker._isSelected = isSelected;
      newMarker._activeCategory = activeCategory();
      facilityMarkers.set(id, newMarker);
    });

    // 3. Update Tactical Line and Label
    const lines = [];
    if (showFleetMesh()) {
      list.forEach(v => {
        lines.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[mainLon, mainLat], [v.longitude || v.lon, v.latitude || v.lat]]
          }
        });
      });
    } else if (selected) {
      lines.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [[mainLon, mainLat], [selected.longitude || selected.lon, selected.latitude || selected.lat]]
        }
      });
    }

    mapInstance.getSource('proximity-line')?.setData({
      type: 'FeatureCollection',
      features: lines
    });

    if (selected && !showFleetMesh()) {
      const targetLat = selected.latitude || selected.lat;
      const targetLon = selected.longitude || selected.lon;

      if (distanceMarker) distanceMarker.remove();
      const midLon = (mainLon + targetLon) / 2;
      const midLat = (mainLat + targetLat) / 2;
      const distEl = document.createElement('div');
      distEl.className = 'px-2 py-0.5 bg-blue-600/90 text-white text-[10px] font-black border border-white/20 shadow-xl backdrop-blur-md rounded-sm whitespace-nowrap';
      distEl.innerText = `${selected.distance.toFixed(2)} KM`;
      distanceMarker = new window.maplibregl.Marker({ element: distEl })
        .setLngLat([midLon, midLat])
        .addTo(mapInstance);

      // Fit Bounds
      const bounds = new window.maplibregl.LngLatBounds()
        .extend([mainLon, mainLat])
        .extend([targetLon, targetLat]);
      mapInstance.fitBounds(bounds, { padding: 120, pitch: 45, duration: 1500 });
    } else {
      if (distanceMarker) distanceMarker.remove();
    }
  });

  createEffect(() => {
    const lat = props.selectedRefinery()?.latitude || props.selectedLng()?.latitude || props.selectedOffshore()?.latitude || props.selectedTerminal()?.latitude;
    const lon = props.selectedRefinery()?.longitude || props.selectedLng()?.longitude || props.selectedOffshore()?.longitude || props.selectedTerminal()?.longitude;
    const name = props.selectedRefinery()?.nama_kilang || props.selectedLng()?.name || props.selectedOffshore()?.name || props.selectedTerminal()?.name;
    const ready = isMapReady();

    if (mapInstance && ready && typeof lat === 'number' && typeof lon === 'number') {
      if (activeMarker) activeMarker.remove();
      
      const type = props.selectedRefinery() ? 'refinery' : props.selectedLng() ? 'lng' : props.selectedOffshore() ? 'offshore' : 'terminal';
      const colors = { refinery: 'orange-500', lng: 'cyan-400', offshore: 'rose-500', terminal: 'fuchsia-400' };
      const color = colors[type];

      const el = document.createElement('div');
      el.innerHTML = getMarkerHTML(type, name, lat, lon, color);

      activeMarker = new window.maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lon, lat])
        .addTo(mapInstance);
      
      mapInstance.flyTo({ center: [lon, lat], zoom: 17, pitch: 65, bearing: 45, duration: 2000 });
    }
  });

  onCleanup(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
    if (activeMarker) {
      activeMarker.remove();
      activeMarker = null;
    }
    if (nearbyMarker) {
      nearbyMarker.remove();
      nearbyMarker = null;
    }
    if (distanceMarker) {
      distanceMarker.remove();
      distanceMarker = null;
    }
  });

  return (
    <Show when={props.showDetail()}>
       <div class="absolute inset-0 z-[5000] bg-[#050b14] flex flex-col animate-in slide-in-from-right duration-500 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
          <div class="p-4 border-b-2 border-orange-500 bg-[#0a1628] flex items-center justify-between shrink-0">
             <div class="flex items-center gap-6">
                <button onClick={() => { props.setShowDetail(false); props.setSelectedId(null); props.setSelectedLngId(null); props.setSelectedOffshoreId(null); props.setSelectedTerminalId(null); if (props.selectionLayer) props.selectionLayer.clearLayers(); }} class="text-white/40 hover:text-white flex items-center gap-2 transition-colors">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m15 18-6-6 6-6" /></svg>
                   <span class="text-[10px] font-black uppercase tracking-widest">EXIT DETAILS</span>
                </button>
                <div class="h-8 w-[1px] bg-white/10"></div>
                <h2 class="text-20px font-black text-white uppercase tracking-tighter leading-none">
                  {props.selectedRefinery()?.nama_kilang || props.selectedLng()?.name || props.selectedOffshore()?.name || props.selectedTerminal()?.name}
                </h2>
             </div>
          </div>
          <div class="flex-1 flex overflow-hidden">
             {/* LEFT SIDEBAR - MODULAR DOSSIER */}
             <div class="w-[320px] border-r border-white/5 flex flex-col bg-[#050b14]">
                {/* SIDEBAR TABS */}
                <div class="flex border-b border-white/5 bg-[#0a1628]/40">
                   <button 
                     onClick={() => setSidebarTab('META')}
                     class={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${sidebarTab() === 'META' ? 'text-blue-400 bg-blue-500/5' : 'text-white/20 hover:text-white/40'}`}
                   >01_META_INTEL</button>
                   <button 
                     onClick={() => setSidebarTab('SIGINT')}
                     class={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${sidebarTab() === 'SIGINT' ? 'text-orange-500 bg-orange-500/5' : 'text-white/20 hover:text-white/40'}`}
                   >02_SIGINT_FEED</button>
                </div>

                <div class="p-6 space-y-8 flex-1 overflow-y-auto win-scroll bg-gradient-to-b from-[#0a1628] to-transparent">
                   <Show when={sidebarTab() === 'META'}>
                      <TechnicalDossier 
                        selectedRefinery={props.selectedRefinery()} 
                        selectedLng={props.selectedLng()} 
                        selectedOffshore={props.selectedOffshore()} 
                        selectedTerminal={props.selectedTerminal()}
                        selectedVessel={selectedNearby()}
                        nearbyFacilities={mergedFacilities()}
                      />
                   </Show>
                   
                   <Show when={sidebarTab() === 'SIGINT'}>
                      <SigintFeed 
                        news={props.news()} 
                        isLoading={props.loadingNews()} 
                      />
                   </Show>
                </div>
             </div>
             
             {/* RIGHT CONTENT - 3D RECON MAP */}
             <div class="flex-1 flex flex-col bg-[#050b14] relative">
                 <div class="p-0 border-b border-white/5 bg-[#0f1d2e] flex items-center shrink-0">
                    <button 
                      onClick={() => props.setDetailTab('INTEL')}
                      class={`px-6 py-4 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all ${props.detailTab() === 'INTEL' ? 'border-blue-500 text-white shadow-[0_5px_15px_rgba(59,130,246,0.3)]' : 'border-transparent text-white/30'}`}
                    >STRATEGIC ANALYTICS</button>
                 </div>
                 
                 <div class="flex-1 relative overflow-hidden">
                    <Show when={props.detailTab() === 'INTEL'}>
                       <div class="w-full h-full relative group">
                          <div ref={mapContainer} class="w-full h-full bg-black"></div>
                          
                          {/* FLOATING PROXIMITY HUD */}
                          <div 
                            class="absolute bottom-6 left-6 z-20 shadow-2xl flex flex-col overflow-hidden transition-[width,height] duration-75"
                            style={{ 
                              width: `${hudWidth()}px`, 
                              height: `${hudHeight()}px`,
                              "min-width": "300px",
                              "min-height": "150px"
                            }}
                          >
                             {/* RESIZE HANDLE - TOP */}
                             <div 
                                class="absolute top-0 left-0 w-full h-1 cursor-ns-resize hover:bg-blue-500/50 z-30 transition-colors"
                                onMouseDown={(e) => {
                                  const startY = e.clientY;
                                  const startH = hudHeight();
                                  const onMove = (me) => {
                                    const delta = startY - me.clientY;
                                    setHudHeight(Math.max(150, startH + delta));
                                  };
                                  const onUp = () => {
                                    window.removeEventListener('mousemove', onMove);
                                    window.removeEventListener('mouseup', onUp);
                                  };
                                  window.addEventListener('mousemove', onMove);
                                  window.addEventListener('mouseup', onUp);
                                }}
                             ></div>

                             {/* RESIZE HANDLE - RIGHT */}
                             <div 
                                class="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-blue-500/50 z-30 transition-colors"
                                onMouseDown={(e) => {
                                  const startX = e.clientX;
                                  const startW = hudWidth();
                                  const onMove = (me) => {
                                    const delta = me.clientX - startX;
                                    setHudWidth(Math.max(300, startW + delta));
                                  };
                                  const onUp = () => {
                                    window.removeEventListener('mousemove', onMove);
                                    window.removeEventListener('mouseup', onUp);
                                  };
                                  window.addEventListener('mousemove', onMove);
                                  window.addEventListener('mouseup', onUp);
                                }}
                             ></div>

                             <div class="w-full h-full bg-[#0a1628]/90 backdrop-blur-xl border border-white/10 flex flex-col overflow-hidden relative">
                                <div class="p-4 flex-1 flex flex-col min-h-0">
                                   <NearbyFacilitiesList 
                                     facilities={mergedFacilities()} 
                                     isLoading={isLoadingNearby()} 
                                     onSelect={(fac) => setSelectedNearby(fac)}
                                     onStreamNearPort={handleStreamNearPort}
                                     onKillStream={() => ais.disconnect()}
                                     onResetAis={() => ais.setLiveShips({})}
                                     activeCategory={activeCategory()}
                                     onCategoryChange={setActiveCategory}
                                   />
                                </div>
                                <div class="px-3 py-1 bg-black/40 border-t border-white/5 flex items-center justify-between">
                                   <span class="text-[6px] font-black text-zinc-600 uppercase tracking-widest">AUTO_RADAR_ACTIVE</span>
                                   <div class="flex gap-1">
                                      <span class="w-1 h-1 bg-blue-500 rounded-full"></span>
                                      <span class="w-1 h-1 bg-blue-500/40 rounded-full"></span>
                                   </div>
                                </div>
                             </div>
                          </div>
                          
                          {/* Map HUD Controls */}
                          <div class="absolute top-6 right-6 z-10 flex flex-col gap-3">
                             <div class="bg-[#0a1628]/90 border border-white/10 backdrop-blur-md flex flex-col overflow-hidden shadow-2xl">
                                <button 
                                  onClick={() => setMapMode('satellite')}
                                  class={`px-3 py-2 text-[8px] font-black uppercase tracking-widest transition-all ${mapMode() === 'satellite' ? 'bg-orange-500 text-white' : 'text-white/40 hover:bg-white/5'}`}
                                >SAT</button>
                                <button 
                                  onClick={() => setMapMode('dark')}
                                  class={`px-3 py-2 text-[8px] font-black uppercase tracking-widest transition-all ${mapMode() === 'dark' ? 'bg-orange-500 text-white' : 'text-white/40 hover:bg-white/5'}`}
                                >DRK</button>
                             </div>
                             
                             <div class="bg-[#0a1628]/90 border border-white/10 backdrop-blur-md flex flex-col overflow-hidden shadow-2xl">
                                <button 
                                  onClick={() => setShowFleetMesh(!showFleetMesh())}
                                  class={`px-3 py-2 text-[8px] font-black uppercase tracking-widest transition-all ${showFleetMesh() ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'text-white/40 hover:bg-white/5'}`}
                                >MESH</button>
                             </div>
                             
                             <div class="bg-[#0a1628]/90 border border-white/10 backdrop-blur-md flex flex-col overflow-hidden shadow-2xl">
                                <button 
                                  onClick={() => {
                                    const next = viewPerspective() === 'top' ? 'tilt' : 'top';
                                    setViewPerspective(next);
                                    mapInstance?.flyTo({ pitch: next === 'top' ? 0 : 65, bearing: next === 'top' ? 0 : 45 });
                                  }}
                                  class="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-white/60 hover:bg-white/5"
                                >
                                  {viewPerspective() === 'top' ? '2D' : '3D'}
                                </button>
                             </div>
                          </div>
                          
                          <div class="absolute top-6 left-6 z-10 flex items-center gap-2 bg-black/40 px-3 py-1 text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                             <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                             SIGNAL: OPTIMAL_VHR
                          </div>
                       </div>
                    </Show>
                 </div>
              </div>
           </div>
        </div>
     </Show>
  );
}

