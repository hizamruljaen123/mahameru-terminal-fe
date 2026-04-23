import { createSignal, For, Show } from 'solid-js';

const NominatimSearch = (props) => {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [selected, setSelected] = createSignal(null);
  const [showMap, setShowMap] = createSignal(true);

  const handleSearch = async () => {
    if (!query().trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SATELLITE_VISUAL_API}/api/osm/search?q=${encodeURIComponent(query())}`);
      const json = await resp.json();
      if (json.status === 'success') {
        setResults(json.data);
      }
    } catch (err) {
      console.error("Nominatim Search Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item) => {
    setSelected({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      name: item.display_name.split(',')[0],
      address: item.display_name
    });
  };

  return (
    <div class="p-4 space-y-4 text-left animate-in fade-in zoom-in-95 duration-300">
      <div class="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-loose border-b border-emerald-500/20 pb-1 flex items-center gap-2">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="7" x2="12" y2="2"/><line x1="12" y1="17" x2="12" y2="22"/><line x1="17" y1="12" x2="22" y2="12"/><line x1="7" y1="12" x2="2" y2="12"/></svg>
         Nominatim_Geo_Finder
      </div>
      
      <div class="relative">
        <input 
          type="text" placeholder="ENTER ADDRESS / COORDINATES..." 
          class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none focus:border-emerald-500 transition-all"
          value={query()} onInput={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          autofocus
        />
        <button onClick={handleSearch} class="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-400">
           <Show when={!loading()} fallback={<div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
           </Show>
        </button>
      </div>

      <Show when={!selected()}>
        <div class="max-h-[200px] overflow-y-auto space-y-2 custom-scrollbar-dark pr-1">
          <For each={results()}>
            {(item) => (
              <button 
                onClick={() => handleSelect(item)}
                class="w-full p-2 bg-white/5 border border-white/5 rounded text-left hover:bg-emerald-500/10 transition-all group"
              >
                <div class="text-[9px] font-black text-white group-hover:text-emerald-400 line-clamp-2 uppercase leading-tight">{item.display_name}</div>
                <div class="text-[7px] text-white/30 font-bold mt-1 uppercase italic truncate">{item.type} • {item.class}</div>
              </button>
            )}
          </For>
          <Show when={query() && results().length === 0 && !loading()}>
             <div class="py-10 text-center text-[8px] font-black text-white/10 uppercase tracking-widest border border-dashed border-white/5 rounded">
                Coordinates Not Found
             </div>
          </Show>
        </div>
      </Show>

      <Show when={selected()}>
         <div class="animate-in fade-in slide-in-from-top-2 space-y-3">
            <div class="p-3 bg-white/5 border border-emerald-500/30 rounded relative overflow-hidden group">
               <div class="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <div class="text-[9px] font-black text-emerald-400 uppercase mb-1 flex items-center gap-1">
                  <div class="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                  Target_Acquired
               </div>
               <div class="text-[10px] text-white font-black uppercase line-clamp-2 leading-tight relative">{selected().name}</div>
            </div>

            <div class="grid grid-cols-2 gap-2">
               <div class="bg-black/80 p-2 border border-white/5 rounded">
                 <div class="text-[7px] text-white/30 font-black mb-1">LATITUDE</div>
                 <div class="text-[10px] text-emerald-400 font-roboto font-black tabular-nums">{selected().lat.toFixed(6)}</div>
               </div>
               <div class="bg-black/80 p-2 border border-white/5 rounded">
                 <div class="text-[7px] text-white/30 font-black mb-1">LONGITUDE</div>
                 <div class="text-[10px] text-emerald-400 font-roboto font-black tabular-nums">{selected().lon.toFixed(6)}</div>
               </div>
            </div>

            <div class="flex items-center justify-between p-2 bg-black/40 rounded border border-white/5">
              <span class="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none">Render_Satellite_Imagery</span>
               <button 
                  onClick={() => setShowMap(!showMap())}
                  class={`w-8 h-4 rounded-full relative transition-all ${showMap() ? 'bg-emerald-500 border-emerald-400' : 'bg-white/10 border-white/20'} border`}
               >
                  <div class={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${showMap() ? 'left-4.5' : 'left-0.5'}`}></div>
               </button>
            </div>

            <Show when={showMap()}>
               <div class="h-[120px] rounded overflow-hidden border border-emerald-500/30 grayscale invert contrast-125 brightness-75 relative">
                 <iframe 
                    width="100%" height="100%" frameborder="0" scrolling="no" 
                    src={`https://maps.google.com/maps?q=${selected().lat},${selected().lon}&z=15&t=k&output=embed`}>
                 </iframe>
                 <div class="absolute inset-0 pointer-events-none border border-emerald-500/20 ring-1 ring-inset ring-emerald-500/10"></div>
               </div>
            </Show>

            <div class="flex gap-2">
               <button 
                  onClick={() => setSelected(null)}
                  class="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/60 text-[9px] font-black uppercase rounded tracking-widest transition-all"
               >
                  Back
               </button>
               <button 
                  onClick={() => {
                     props.onAddManual('LOCATION', { ...selected(), showMap: showMap() }, props.nodeId);
                     props.onFinished();
                  }}
                  class="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase rounded shadow-lg shadow-emerald-900/40 tracking-widest transition-all"
               >
                  Deploy Target
               </button>
            </div>
         </div>
      </Show>
    </div>
  );
};

export default NominatimSearch;
