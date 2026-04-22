import { createMemo, For, Show } from 'solid-js';

const PAGE_SIZE = 15;

export default function CategoryDetailView(props) {
  const categoryName = () => props.category();
  
  const groupedBySource = createMemo(() => {
    const rawData = props.data()[categoryName()] || [];
    // No local filtering while typing, wait for ENTER (Global Search)
    const groups = {};
    rawData.forEach(item => {
      const src = item.source || 'UNKNOWN_SOURCE';
      if (!groups[src]) groups[src] = [];
      groups[src].push(item);
    });
    return groups;
  });

  const sources = createMemo(() => Object.keys(groupedBySource()).sort());

  return (
    <div class="flex-1 p-6 overflow-hidden flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
      {/* HEADER SECTION */}
      <div class="flex items-center justify-between border-b border-border_main pb-4 bg-bg_sidebar/20 p-4 backdrop-blur-sm rounded-sm shadow-inner">
        <div class="flex items-center gap-4">
          <button 
            onClick={() => props.onBack()}
            class="p-2 hover:bg-text_accent/20 text-text_accent border border-text_accent/30 rounded-sm transition-all active:scale-95 group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div class="flex flex-col">
            <h2 class="text-xl font-black tracking-[.25em] text-text_primary uppercase font-mono">
                {categoryName().replace('_', ' ')} <span class="text-text_accent opacity-50">// SOURCE_BREAKDOWN</span>
            </h2>
            <span class="text-[10px] text-text_secondary font-mono tracking-widest opacity-50">NODE_MAP: {sources().length} ACTIVE_SOURCES DETECTED</span>
          </div>
        </div>
        
        <div class="flex gap-4">
           <div class="px-4 py-2 bg-text_accent/5 border border-text_accent/10 flex flex-col items-end">
              <span class="text-[8px] font-black text-text_secondary leading-none mb-1">TOTAL_PACKETS</span>
              <span class="text-sm font-black text-text_accent font-mono">{(props.data()[categoryName()] || []).length}</span>
           </div>
        </div>
      </div>

      {/* SOURCE GRID */}
      <div class="flex-1 overflow-y-auto win-scroll grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 pb-20 pr-2">
        <For each={sources()} fallback={
            <div class="col-span-full py-40 flex flex-col items-center justify-center grayscale opacity-30 gap-6">
                <div class="w-20 h-20 border-4 border-dashed border-text_accent animate-spin-slow"></div>
                <div class="text-xl font-black tracking-[.5em] animate-pulse uppercase">NO_SOURCE_DATA_AVAILABLE</div>
            </div>
        }>
          {(sourceName) => {
            const items = groupedBySource()[sourceName];
            return (
              <section class="flex flex-col border border-border_main bg-bg_sidebar/30 hover:border-text_accent/30 transition-colors group">
                <div class="bg-bg_header/90 px-4 py-2 flex items-center justify-between border-b border-border_main">
                  <div class="flex items-center gap-3">
                    <div class="w-1.5 h-1.5 bg-text_accent animate-pulse"></div>
                    <h3 class="text-[10px] font-black text-text_primary tracking-widest uppercase truncate max-w-[200px]">
                        {sourceName}
                    </h3>
                  </div>
                  <span class="text-[9px] font-mono font-bold text-text_accent opacity-50">ENTRIES: {items.length}</span>
                </div>

                <div class="flex flex-col divide-y divide-border_main/10 max-h-[400px] overflow-y-auto win-scroll bg-bg_main/5">
                  <For each={items.slice(0, 30)}>
                    {(item) => (
                      <div 
                        onClick={() => window.open(item.link, '_blank')}
                        class="p-4 hover:bg-text_accent/5 flex flex-col gap-2 cursor-pointer transition-colors border-l-2 border-l-transparent hover:border-l-text_accent group"
                      >
                         <div class="flex items-center justify-between gap-4">
                            <span class="text-[8px] font-mono text-text_secondary opacity-40 uppercase group-hover:opacity-100 transition-opacity">
                                {new Date(item.timestamp * 1000).toLocaleString([], {day: '2-digit', month: 'short', hour:'2-digit', minute:'2-digit'})}
                            </span>
                            
                            <Show when={item.sentiment}>
                                <span class={`text-[7px] px-1 font-black ${
                                    String(item.sentiment).toUpperCase() === 'NEGATIVE' ? 'text-red-500' : 
                                    String(item.sentiment).toUpperCase() === 'POSITIVE' ? 'text-emerald-500' : 'text-gray-500'
                                }`}>
                                    {String(item.sentiment).toUpperCase()}
                                </span>
                            </Show>
                         </div>
                         <h4 class="text-[11px] font-medium leading-tight group-hover:text-text_accent transition-colors truncate">
                            {item.title}
                         </h4>
                      </div>
                    )}
                  </For>
                </div>
              </section>
            );
          }}
        </For>
      </div>
    </div>
  );
}
