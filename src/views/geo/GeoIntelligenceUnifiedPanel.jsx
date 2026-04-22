import { createSignal, onMount, For, Show, createMemo } from 'solid-js';

export default function GeoIntelligenceUnifiedPanel(props) {
  const [trends, setTrends] = createSignal([]);
  const [totalArticles, setTotalArticles] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [selectedDate, setSelectedDate] = createSignal("");
  const [selectedCountryCode, setSelectedCountryCode] = createSignal(null);
  const [countryData, setCountryData] = createSignal([]);
  const [intelData, setIntelData] = createSignal(null);
  const [intelLoading, setIntelLoading] = createSignal(false);
  const [countryNews, setCountryNews] = createSignal([]);
  const [newsLoading, setNewsLoading] = createSignal(false);

  let mapInstance = null;
  let markerLayer = null;

  onMount(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SKY_API}/api/sky/countries`);
      const data = await res.json();
      setCountryData(data);
    } catch (e) {
      console.error("Geo Intelligence: Country data error", e);
    }
    fetchTrends();
  });

  const fetchTrends = async () => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_GEO_DATA_API}/api/geo/db-recap?days=1`;
      if (selectedDate()) {
        url = `${import.meta.env.VITE_GEO_DATA_API}/api/geo/archive-trends?date=${selectedDate()}`;
      }

      const res = await fetch(url);
      const result = await res.json();
      if (result.status === 'success') {
        const sortedData = result.data || [];
        setTrends(sortedData);
        setTotalArticles(result.total_articles || 0);
        updateMarkers(sortedData);
      }
    } catch (e) {
      console.error("Geo Intelligence: Trends fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchIntel = async (code) => {
    setIntelLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_GEO_DATA_API}/api/country-intel/${code}`);
      const data = await res.json();
      setIntelData(data);
    } catch (e) {
      console.error("Geo Intelligence: Intel fetch error", e);
    } finally {
      setIntelLoading(false);
    }
  };

  const fetchCountryNews = async (name) => {
    setNewsLoading(true);
    try {
      let url = `${import.meta.env.VITE_API_BASE}/api/news/country-intel?country=${encodeURIComponent(name)}`;
      if (selectedDate()) {
        url += `&date=${selectedDate()}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setCountryNews(data.results || []);
    } catch (e) {
      console.error("Geo Intelligence: News fetch error", e);
    } finally {
      setNewsLoading(false);
    }
  };

  const initMap = (el) => {
    if (mapInstance || !el) return;
    mapInstance = window.L.map(el, { zoomControl: false }).setView([20, 0], 2);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB'
    }).addTo(mapInstance);
    markerLayer = window.L.layerGroup().addTo(mapInstance);
    setTimeout(() => mapInstance.invalidateSize(), 200);
  };

  const updateMarkers = (recapData) => {
    if (!markerLayer) return;
    markerLayer.clearLayers();
    const maxCount = recapData.length > 0 ? Math.max(...recapData.map(d => d.count)) : 1;
    recapData.forEach((item) => {
      const ratio = item.count / maxCount;
      const radius = Math.max(6, ratio * 30);
      const color = getIntensityColor(item.count, maxCount);
      const circle = window.L.circleMarker([item.lat, item.lng], {
        radius, fillColor: color, color: '#fff', weight: 1, opacity: 0.9, fillOpacity: 0.7
      }).addTo(markerLayer);
      circle.on('click', () => handleCountryFocus(item.code));
    });
  };

  const getIntensityColor = (count, maxCount) => {
    const ratio = count / maxCount;
    const hue = Math.floor(120 * (1 - ratio));
    return `hsl(${hue}, 85%, 50%)`;
  };

  const handleCountryFocus = (code) => {
    setSelectedCountryCode(code);
    fetchIntel(code);
    
    // Immediate News Fetch from Database
    const item = trends().find(t => t.code === code);
    if (item) {
      fetchCountryNews(item.name);
      if (mapInstance) {
        mapInstance.flyTo([item.lat, item.lng], 4, { animate: true, duration: 1.5 });
      }
    }
  };

  const formatValue = (val) => {
    if (val === null || val === undefined) return '---';
    return typeof val === 'number' ? val.toLocaleString() : val;
  };

  const formatPopulation = (num) => {
    if (!num) return '---';
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    return num.toLocaleString();
  };

  return (
    <div class="h-full flex overflow-hidden bg-bg_main text-text_primary uppercase selection:bg-text_accent/30">
      {/* LEFT: Trends Sidebar */}
      <div class="w-80 border-r border-border_main bg-bg_sidebar/90 backdrop-blur-xl flex flex-col shadow-2xl z-20">
        <div class="p-4 border-b border-border_main bg-bg_header/50 flex flex-col gap-3">
          <div class="flex justify-between items-center">
            <h3 class="text-[10px] font-black text-text_accent tracking-widest uppercase">{selectedDate() ? `ARCHIVE: ${selectedDate()}` : 'GEOSPATIAL TREND ANALYSIS'}</h3>
            <div class="flex items-center gap-2">
              <Show when={selectedDate()}>
                <button onClick={() => {
                  setSelectedDate("");
                  fetchTrends();
                  if (selectedCountryCode()) {
                    const country = trends().find(t => t.code === selectedCountryCode());
                    if (country) fetchCountryNews(country.name);
                  }
                }} class="text-[8px] text-white/40 hover:text-white uppercase font-bold">LIVE STREAM</button>
              </Show>
              <button onClick={fetchTrends} class="text-text_accent hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class={loading() ? 'animate-spin' : ''}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
          </div>
          <input
            type="date"
            value={selectedDate()}
            onInput={(e) => {
              setSelectedDate(e.target.value);
              fetchTrends();
              if (selectedCountryCode()) {
                const country = trends().find(t => t.code === selectedCountryCode());
                if (country) fetchCountryNews(country.name);
              }
            }}
            class="w-full bg-black/40 border border-border_main/50 text-text_primary/60 p-1.5 focus:border-text_accent outline-none font-mono cursor-pointer hover:bg-black/60 transition-all"
          />
        </div>
        <div class="flex-1 overflow-y-auto win-scroll p-3 space-y-2">
          <Show when={!loading()} fallback={<div class="py-20 text-center animate-pulse text-[10px] opacity-40 uppercase">FETCHING DATA...</div>}>
            <For each={trends()}>
              {(item) => (
                <button onClick={() => handleCountryFocus(item.code)} class={`w-full group relative p-3 border text-left flex justify-between items-center overflow-hidden transition-all duration-300 ${selectedCountryCode() === item.code ? 'border-text_accent bg-text_accent/10' : 'border-border_main/20 hover:border-border_main/40 bg-bg_header/30'}`}>
                  <div class="z-10">
                    <div class={`text-[12px] font-black uppercase truncate ${selectedCountryCode() === item.code ? 'text-text_accent' : 'text-text_primary'}`}>{item.name}</div>
                    <div class="text-[8px] text-[#10b981] font-bold uppercase tracking-tighter">PRIMARY: {item.topCategory}</div>
                  </div>
                  <div class="z-10 text-right">
                    <div class="text-[15px] font-black" style={{ color: getIntensityColor(item.count, trends()[0]?.count || 1) }}>{item.count}</div>
                  </div>
                </button>
              )}
            </For>
          </Show>
        </div>
      </div>

      {/* CENTER: Map Area */}
      <div class="flex-1 relative bg-bg_main transition-all overflow-hidden border-x border-border_main/20">
        <div ref={initMap} class="w-full h-full z-0 opacity-60" />
        <div class="absolute inset-0 pointer-events-none z-10 border-[16px] border-black/20 ring-inset ring-1 ring-border_main/20 opacity-30"></div>
        <div class="absolute bottom-8 left-8 z-[1000] border-l-4 border-text_accent pl-4">
          <div class="text-[18px] font-black text-text_primary tracking-widest uppercase leading-none">GEOSPATIAL INTELLIGENCE</div>
          <div class="text-[10px] text-text_accent font-black tracking-[0.4em] uppercase opacity-70">GLOBAL SIGNAL SUMMARY</div>
        </div>
      </div>

      {/* RIGHT: Detail Intel (Compact) */}
      <Show when={selectedCountryCode()}>
        <div class="w-[450px] border-l border-border_main bg-bg_sidebar/95 backdrop-blur-2xl flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.7)] z-30 animate-in slide-in-from-right duration-500">
          {/* Header */}
          <div class="p-3 border-b border-border_main bg-black/40 flex justify-between items-center">
            <div class="flex items-center gap-3">
              <div class="w-2 h-2 rounded-full animate-pulse bg-text_accent"></div>
              <h3 class="text-[11px] font-black text-text_primary uppercase tracking-tighter">DETAILS: {selectedCountryCode()} // {trends().find(t => t.code === selectedCountryCode())?.name}</h3>
            </div>
            <button onClick={() => setSelectedCountryCode(null)} class="text-text_secondary hover:text-text_primary transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Comprehensive Info Section */}
          <div class="flex-1 overflow-y-auto win-scroll bg-black/20">
            <Show when={!intelLoading()} fallback={
              <div class="p-4 space-y-4 animate-pulse">
                <div class="h-32 bg-white/5 border border-white/10 rounded"></div>
              </div>
            }>
              <div class="p-4 space-y-4">
                {/* Visual Header: Flag & Identity */}
                <div class="flex gap-4 items-start border-b border-white/5 pb-4">
                  <Show when={intelData()?.country?.flags?.svg}>
                    <img src={intelData()?.country?.flags?.svg} alt="Flag" class="w-24 h-16 object-cover border border-white/10 shadow-lg shadow-black/50" />
                  </Show>
                  <div class="flex-1">
                    <div class="flex justify-between items-start">
                      <div>
                        <h2 class="text-16px font-black text-white uppercase leading-none">{intelData()?.country?.name?.common}</h2>
                        <p class="text-[9px] text-text_accent font-bold mt-1 opacity-70 uppercase truncate max-w-[200px]">{intelData()?.country?.name?.official}</p>
                      </div>
                      <Show when={intelData()?.country?.coatOfArms?.svg}>
                         <img src={intelData()?.country?.coatOfArms?.svg} alt="Coat Of Arms" class="w-10 h-10 object-contain opacity-40 grayscale hover:grayscale-0 transition-all" />
                      </Show>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <span class="px-1.5 py-0.5 bg-bg_header/20 border border-border_main/20 text-[7px] font-black text-text_primary/50 uppercase">{intelData()?.country?.region} // {intelData()?.country?.subregion}</span>
                      <span class="px-1.5 py-0.5 bg-text_accent/10 border border-text_accent/20 text-[7px] font-black text-text_accent uppercase">CAPITAL: {intelData()?.country?.capital?.[0]}</span>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div class="grid grid-cols-3 gap-2">
                  <div class="p-2 border border-border_main/30 bg-bg_header/20 hover:bg-bg_header/40 transition-colors">
                    <span class="text-[7px] text-text_primary/30 uppercase font-black block mb-1">POPULATION</span>
                    <span class="text-14px font-black text-text_primary">{formatPopulation(intelData()?.country?.population)}</span>
                  </div>
                  <div class="p-2 border border-border_main/30 bg-bg_header/20 hover:bg-bg_header/40 transition-colors">
                    <span class="text-[7px] text-text_primary/30 uppercase font-black block mb-1">AREA (KM2)</span>
                    <span class="text-14px font-black text-text_primary">{formatValue(intelData()?.country?.area)}</span>
                  </div>
                  <div class="p-2 border border-border_main/30 bg-bg_header/20 hover:bg-bg_header/40 transition-colors">
                    <span class="text-[7px] text-text_primary/30 uppercase font-black block mb-1">GINI INDEX</span>
                    <span class="text-14px font-black text-text_accent">{intelData()?.country?.gini ? Object.values(intelData()?.country?.gini)[0] : '---'}</span>
                  </div>
                </div>

                {/* Macro & Economy Snapshot */}
                <div class="grid grid-cols-2 gap-2">
                  <div class="p-3 border border-border_main/30 bg-black/40 space-y-2">
                    <h4 class="text-[8px] font-black text-text_primary/40 uppercase tracking-widest border-b border-border_main/30 pb-1">CURRENCY DETAILS</h4>
                    <div class="flex justify-between items-center">
                       <span class="text-[12px] font-black text-text_accent">{Object.keys(intelData()?.country?.currencies || {})[0]}</span>
                       <span class="text-[10px] text-text_primary/60 font-medium">{Object.values(intelData()?.country?.currencies || {})[0]?.name}</span>
                    </div>
                    <div class="text-[10px] text-text_primary/40 font-mono italic">
                       SYMBOL: <span class="text-text_primary">{Object.values(intelData()?.country?.currencies || {})[0]?.symbol}</span>
                    </div>
                    <div class="pt-1 mt-1 border-t border-border_main/30">
                       <span class="text-[7px] text-text_primary/30 uppercase font-black">USD EXCHANGE RATE</span>
                       <div class="text-[12px] font-black text-text_primary">1 USD = {formatValue(intelData()?.exchangeRates?.rates?.[Object.keys(intelData()?.country?.currencies || {})[0]])}</div>
                    </div>
                  </div>
                  <div class="p-3 border border-border_main/30 bg-black/40 space-y-2">
                    <h4 class="text-[8px] font-black text-text_primary/40 uppercase tracking-widest border-b border-border_main/30 pb-1">WORLD BANK DATA</h4>
                    <div class="space-y-1.5">
                       <div class="flex justify-between text-[9px] uppercase font-black">
                         <span class="text-text_primary/30">GDP Growth</span>
                         <span class="text-text_primary">{formatValue(intelData()?.worldBank?.gdpGrowth)}%</span>
                       </div>
                       <div class="flex justify-between text-[9px] uppercase font-black">
                         <span class="text-text_primary/30">Inflation</span>
                         <span class="text-text_primary">{formatValue(intelData()?.worldBank?.inflation)}%</span>
                       </div>
                       <div class="flex justify-between text-[9px] uppercase font-black">
                         <span class="text-text_primary/30">Unemp Rate</span>
                         <span class="text-text_primary">{formatValue(intelData()?.worldBank?.unemployment)}%</span>
                       </div>
                       <div class="flex justify-between text-[9px] uppercase font-black">
                         <span class="text-text_primary/30">Pol Stability</span>
                         <span class="text-text_primary">{formatValue(intelData()?.worldBank?.stability)}</span>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Technical Specs */}
                <div class="p-3 border border-border_main bg-bg_header/20 space-y-3">
                   <div class="grid grid-cols-2 gap-4">
                      <div>
                        <span class="text-[7px] text-text_primary/30 uppercase font-black block mb-1">LANGUAGES</span>
                        <div class="flex flex-wrap gap-1">
                          <For each={Object.values(intelData()?.country?.languages || {})}>
                            {(lang) => <span class="text-[9px] text-text_primary font-bold bg-bg_header/40 px-1 uppercase">{lang}</span>}
                          </For>
                        </div>
                      </div>
                      <div>
                        <span class="text-[7px] text-text_primary/30 uppercase font-black block mb-1">TIMEZONES</span>
                        <div class="flex flex-wrap gap-1">
                          <For each={intelData()?.country?.timezones || []}>
                            {(tz) => <span class="text-[9px] text-text_primary font-bold bg-bg_header/40 px-1">{tz}</span>}
                          </For>
                        </div>
                      </div>
                   </div>
                   <div class="pt-2 border-t border-border_main/30">
                      <span class="text-[7px] text-text_primary/30 uppercase font-black block mb-1">LAND BORDERS ({intelData()?.country?.borders?.length || 0})</span>
                      <div class="flex flex-wrap gap-1">
                        <For each={intelData()?.country?.borders || []}>
                          {(border) => <span class="px-1.5 py-0.5 bg-black/40 border border-border_main/30 text-[8px] font-black text-text_accent">{border}</span>}
                        </For>
                        <Show when={!intelData()?.country?.borders?.length}>
                          <span class="text-[8px] text-text_primary/20 italic uppercase">Island Nation</span>
                        </Show>
                      </div>
                   </div>
                </div>

                {/* Upcoming Holidays */}
                <Show when={intelData()?.holidays?.length > 0}>
                  <div class="space-y-2">
                    <h4 class="text-[8px] font-black text-white/40 uppercase tracking-widest px-1">UPCOMING HOLIDAYS</h4>
                    <div class="space-y-1">
                      <For each={intelData()?.holidays}>
                        {(h) => (
                          <div class="flex justify-between items-center p-2 bg-text_accent/5 border border-white/5">
                            <span class="text-[9px] text-white font-bold uppercase truncate max-w-[200px]">{h.name}</span>
                            <span class="text-[8px] text-text_accent font-mono">{h.date}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* News Intelligence */}
          <div class="flex-1 flex flex-col overflow-hidden">
            <div class="px-4 py-2 border-b border-border_main/20 bg-black/60 flex justify-between items-center">
              <span class="text-[9px] font-black text-text_primary/50 uppercase tracking-[0.3em]">LIVE SIGNAL FEED</span>
              <Show when={newsLoading()}>
                <div class="flex items-center gap-1.5">
                  <div class="w-1 h-1 bg-text_accent animate-ping rounded-full"></div>
                  <span class="text-[7px] text-text_accent font-black uppercase tracking-widest">FETCHING DATA...</span>
                </div>
              </Show>
            </div>

            <div class="flex-1 overflow-y-auto win-scroll p-4 space-y-2">
              <Show when={!newsLoading()} fallback={
                <div class="space-y-2">
                  <For each={[1, 2, 3]}>
                    {() => (
                      <div class="p-2.5 bg-black/20 border border-white/5 animate-pulse">
                        <div class="h-3 bg-white/10 w-3/4 mb-2"></div>
                      </div>
                    )}
                  </For>
                </div>
              }>
                <Show when={countryNews().length > 0} fallback={<div class="py-20 text-center opacity-20 text-[9px] italic font-mono uppercase">NO DATA FOUND</div>}>
                  <For each={countryNews()}>
                    {(news) => (
                    <div class="group p-2.5 bg-bg_header/10 border border-border_main/10 hover:border-text_accent/30 transition-all cursor-pointer">
                      <div class="flex justify-between items-start gap-3 mb-1.5">
                        <h5 class="text-[10px] font-black text-text_primary/80 line-clamp-2 uppercase group-hover:text-text_accent transition-colors leading-[1.25]">{news.title}</h5>
                        <div class="flex flex-col gap-1 items-end">
                          <span class="text-[6px] font-black text-text_accent bg-text_accent/10 px-1 border border-text_accent/20 uppercase whitespace-nowrap">{news.source}</span>
                          <span class={`w-1.5 h-1.5 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.2)] ${news.sentiment === 'positive' ? 'bg-green-500' : news.sentiment === 'negative' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                        </div>
                      </div>
                      <div class="text-[7px] text-text_primary/30 font-bold flex justify-between uppercase">
                        <span>TIMESTAMP: {new Date(news.timestamp * 1000).toLocaleDateString()}</span>
                        <Show when={news.category}>
                          <span class="uppercase italic">{news.category}</span>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </Show>
          </div>
        </div>

          {/* Footer */}
          <div class="p-3 border-t border-border_main bg-bg_main flex justify-between items-center">
            <span class="text-[7px] text-text_primary/10 uppercase font-black tracking-[0.2em]">ENQY TERMINAL // GEOSPATIAL NODE</span>
            <div class="flex items-center gap-2 opacity-30">
              <span class="text-[8px] text-text_accent font-black uppercase tracking-widest">UNIFIED ANALYTICS ACTIVE</span>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
