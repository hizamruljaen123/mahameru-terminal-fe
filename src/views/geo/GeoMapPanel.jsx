import { createSignal, onMount, onCleanup } from 'solid-js';

export default function GeoMapPanel() {
  let mapEl;
  let map;
  const [activeLayer, setActiveLayer] = createSignal('dark');

  const layers = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  };

  let tileLayer;

  const initMap = () => {
    if (!window.L) return;
    map = window.L.map(mapEl, {
      zoomControl: false,
      attributionControl: false
    }).setView([0, 0], 2);

    tileLayer = window.L.tileLayer(layers[activeLayer()], {
        maxZoom: 19
    }).addTo(map);

    window.L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    setTimeout(() => map.invalidateSize(), 150);
  };

  const switchLayer = (type) => {
    setActiveLayer(type);
    if (tileLayer) {
        map.removeLayer(tileLayer);
        tileLayer = window.L.tileLayer(layers[type], { maxZoom: 19 }).addTo(map);
    }
  };

  const resetZoom = () => {
    if (map) map.setView([0, 0], 2);
  };

  const reloadMap = () => {
    if (map) {
      map.invalidateSize();
      const currentLayer = activeLayer();
      map.removeLayer(tileLayer);
      tileLayer = window.L.tileLayer(layers[currentLayer], { maxZoom: 19 }).addTo(map);
    }
  };

  onMount(() => {
    initMap();
  });

  onCleanup(() => {
    if (map) map.remove();
  });

  return (
    <div class="w-full h-full relative bg-black">
      <div ref={mapEl} class="w-full h-full z-0" />
      
      {/* LAYER & ACTION CONTROLS */}
      <div class="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
        <div class="flex gap-1 bg-black/60 backdrop-blur-md p-1 border border-white/10 rounded-sm">
          <button 
            onClick={() => switchLayer('dark')}
            class={`px-3 py-1 text-[9px] font-mono uppercase tracking-tighter transition-all ${activeLayer() === 'dark' ? 'bg-[#3b82f6] text-white' : 'text-white/40 hover:text-white'}`}
          >
            DARK
          </button>
          <button 
            onClick={() => switchLayer('light')}
            class={`px-3 py-1 text-[9px] font-mono uppercase tracking-tighter transition-all ${activeLayer() === 'light' ? 'bg-[#3b82f6] text-white' : 'text-white/40 hover:text-white'}`}
          >
            WHITE
          </button>
          <button 
            onClick={() => switchLayer('satellite')}
            class={`px-3 py-1 text-[9px] font-mono uppercase tracking-tighter transition-all ${activeLayer() === 'satellite' ? 'bg-[#3b82f6] text-white' : 'text-white/40 hover:text-white'}`}
          >
            SATELLITE
          </button>
        </div>

        <div class="flex gap-1 bg-black/60 backdrop-blur-md p-1 border border-white/10 rounded-sm">
          <button 
            onClick={resetZoom}
            class="px-3 py-1 text-[9px] font-mono uppercase tracking-tighter text-white/60 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
          >
            <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            RESET_ZOOM
          </button>
          <div class="w-[1px] bg-white/10 h-3 my-auto"></div>
          <button 
            onClick={reloadMap}
            class="px-3 py-1 text-[9px] font-mono uppercase tracking-tighter text-white/60 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
          >
            <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            RELOAD_SENSORS
          </button>
        </div>
      </div>

      {/* TECH OVERLAY */}
      <div class="absolute top-4 left-4 z-[1000] pointer-events-none">
         <div class="flex flex-col gap-0.5 border-l-2 border-[#3b82f6] pl-2">
            <div class="text-[10px] font-black text-white tracking-widest uppercase font-mono">GLOBAL_GEOSPATIAL_GRID</div>
            <div class="text-[7px] text-[#3b82f6] font-mono uppercase tracking-widest">REALTIME_SAT_LINK: ACTIVE</div>
         </div>
      </div>
    </div>
  );
}
