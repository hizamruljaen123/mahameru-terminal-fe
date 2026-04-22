import { createSignal, onMount, For, Show } from 'solid-js';

export default function MinesDataPanel() {
  const [mines, setMines] = createSignal([]);
  const [filters, setFilters] = createSignal({ countries: [], commodities: [] });
  const [selectedCountry, setSelectedCountry] = createSignal('');
  const [selectedCommodity, setSelectedCommodity] = createSignal('');
  const [search, setSearch] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [stats, setStats] = createSignal(null);
  let mapInstance = null;
  let mineMarkers = null;

  const initMap = (el) => {
    if (mapInstance || !el) return;
    mapInstance = window.L.map(el, { zoomControl: false }).setView([20, 0], 2);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB'
    }).addTo(mapInstance);
    // Custom marker style that uses theme accent
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--text-accent').trim() || '#3b82f6';
    mineMarkers = window.L.markerClusterGroup ? window.L.markerClusterGroup() : window.L.layerGroup();
    mineMarkers.addTo(mapInstance);
    
    setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, 200);
  };

  const fetchFilters = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_MINES_API}/api/mines/filters`);
      const data = await res.json();
      setFilters(data.data);
    } catch (e) { console.error("Filter Fetch Error:", e); }
  };

  const fetchMines = async () => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_MINES_API}/api/mines?page_size=200`;
      if (selectedCountry()) url += `&country=${selectedCountry()}`;
      if (selectedCommodity()) url += `&commodity=${selectedCommodity()}`;
      if (search()) url += `&search=${search()}`;

      const res = await fetch(url);
      const result = await res.json();
      setMines(result.data || []);

      if (mineMarkers) {
        mineMarkers.clearLayers();
        result.data.forEach(mine => {
          if (mine.latitude && mine.longitude) {
            const marker = window.L.circleMarker([mine.latitude, mine.longitude], {
              radius: 5,
              fillColor: 'var(--text-accent)',
              color: 'var(--bg-main)',
              weight: 1,
              opacity: 1,
              fillOpacity: 0.8
            }).bindPopup(`<b>${mine.site_name}</b><br/>${mine.country}<br/>${mine.commod1}`);
            mineMarkers.addLayer(marker);
          }
        });
        if (result.data.length > 0 && mapInstance) {
           // mapInstance.fitBounds(mineMarkers.getBounds());
        }
      }
    } catch (e) {
      console.error("Mines Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchFilters();
    fetchMines();
  });

  return (
    <div class="h-full flex overflow-hidden bg-bg_main">
      {/* Search & Filter Sidebar */}
      <div class="w-80 border-r border-border_main bg-bg_main flex flex-col">
        <div class="p-4 border-b border-border_main bg-bg_header">
          <h3 class="text-[10px] font-black text-text_accent tracking-widest uppercase mb-1">MINERAL_RESOURCES_INTEL</h3>
          <p class="text-[8px] text-text_secondary font-mono tracking-tighter uppercase">GLOBAL_EXTRACTION_MAP</p>
        </div>

        <div class="p-4 space-y-4">
          <div class="flex flex-col gap-1">
            <label class="text-[8px] font-mono text-text_secondary uppercase">SEARCH_DEPOSIT</label>
            <input 
              type="text" 
              onInput={(e) => setSearch(e.target.value)}
              placeholder="SITE_NAME / COMMODITY..."
              class="w-full bg-black/40 border border-border_main p-2 text-[10px] text-text_accent font-mono focus:outline-none focus:border-text_accent"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-[8px] font-mono text-text_secondary uppercase">COUNTRY_FILTER</label>
            <select 
              onChange={(e) => setSelectedCountry(e.target.value)}
              class="w-full bg-black/40 border border-border_main p-2 text-[10px] text-text_accent font-mono focus:outline-none"
            >
              <option value="">ALL_TERRITORIES</option>
              <For each={filters().countries}>
                {(c) => <option value={c}>{c}</option>}
              </For>
            </select>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-[8px] font-mono text-text_secondary uppercase">COMMODITY_FILTER</label>
            <select 
              onChange={(e) => setSelectedCommodity(e.target.value)}
              class="w-full bg-black/40 border border-border_main p-2 text-[10px] text-text_accent font-mono focus:outline-none"
            >
              <option value="">ALL_COMMODITIES</option>
              <For each={filters().commodities}>
                {(c) => <option value={c}>{c}</option>}
              </For>
            </select>
          </div>

          <button 
             onClick={fetchMines}
             class="w-full py-2 bg-text_accent/10 border border-text_accent text-text_accent text-[10px] font-black uppercase tracking-widest hover:bg-text_accent hover:text-bg_main transition-all"
          >
             RUN_SCAN
          </button>
        </div>

        {/* Results List Mini */}
        <div class="flex-1 overflow-y-auto win-scroll border-t border-border_main p-4">
          <div class="text-[8px] text-text_secondary mb-2 uppercase font-mono">SCAN_RESULTS: {mines().length}</div>
          <div class="space-y-2">
            <For each={mines().slice(0, 50)}>
              {(mine) => (
                <div class="p-2 bg-bg_header/40 border border-border_main/30 rounded-sm">
                   <div class="text-[9px] font-bold text-text_primary truncate uppercase">{mine.site_name}</div>
                   <div class="flex justify-between mt-1">
                      <span class="text-[7px] font-mono text-text_accent">{mine.commod1}</span>
                      <span class="text-[7px] font-mono text-text_secondary uppercase">{mine.country}</span>
                   </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      <div class="flex-1 relative flex flex-col bg-bg_main">
          <div class="absolute inset-0 w-full h-full" ref={initMap}></div>
          <div class="absolute inset-0 pointer-events-none z-10 border-[10px] border-text_accent/5 ring-inset ring-1 ring-text_accent/20"></div>
          
          {/* Legend Overlay */}
          <div class="absolute bottom-6 left-6 z-20 bg-bg_header/90 backdrop-blur-md border border-border_main p-4 flex flex-col gap-2">
             <div class="flex items-center gap-3">
                <div class="w-3 h-3 rounded-full bg-text_accent shadow-[0_0_10px_var(--text-accent)]"></div>
                <span class="text-[9px] font-mono text-text_primary tracking-widest uppercase">ACTIVE_DEPOSIT</span>
             </div>
             <div class="text-[7px] text-text_secondary font-mono mt-1 opacity-60">
                SOURCE: USGS_MRDS_GLOBAL_DATABASE
             </div>
          </div>
      </div>
    </div>
  );
}
