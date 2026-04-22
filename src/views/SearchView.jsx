import { createMemo, createSignal, For, Show } from 'solid-js';

export default function SearchView(props) {
  const [dateFilter, setDateFilter] = createSignal('');

  const filteredResults = createMemo(() => {
    let list = props.results() || [];
    if (dateFilter()) {
      list = list.filter(item => {
        const itemDate = new Date(item.timestamp * 1000).toISOString().split('T')[0];
        return itemDate === dateFilter();
      });
    }
    return list;
  });

  const groupedByDate = createMemo(() => {
    const groups = {};
    filteredResults().forEach(item => {
      const date = new Date(item.timestamp * 1000).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
      const today = new Date().toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
      const label = date === today ? 'TODAY_ACTIVE' : date.toUpperCase().replace(/\s/g, '_');
      
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });
    return groups;
  });

  const dates = createMemo(() => Object.keys(groupedByDate()));

  return (
    <div class="flex-1 p-6 overflow-hidden flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
      {/* SEARCH HEADER */}
      <div class="flex items-center justify-between border-b border-border_main pb-4 bg-bg_sidebar/20 p-4">
        <div class="flex items-center gap-4">
          <button 
            onClick={() => props.onBack()}
            class="p-2 hover:bg-text_accent/20 text-text_accent border border-text_accent/30 rounded-sm transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div class="flex flex-col">
            <h2 class="text-xl font-black tracking-[.25em] text-text_primary uppercase font-mono">
                GLOBAL_SEARCH_RESULT <span class="text-text_accent opacity-50">// Q: {props.query()}</span>
            </h2>
            <span class="text-[10px] text-text_secondary font-mono tracking-widest opacity-50">ARCHIVE_MATCHES: {filteredResults().length} PACKETS FOUND</span>
          </div>
        </div>

        <div class="flex items-center gap-4">
           {/* DATE FILTER */}
           <div class="flex items-center gap-3 bg-bg_main/50 px-4 py-2 border border-border_main">
              <span class="text-[9px] font-black text-text_secondary uppercase tracking-widest">FILTER_DATE:</span>
              <input 
                type="date" 
                onInput={(e) => setDateFilter(e.target.value)}
                class="bg-transparent text-[10px] text-text_accent font-mono border-none focus:ring-0 uppercase"
              />
           </div>
        </div>
      </div>

      {/* RESULTS LIST */}
      <div class="flex-1 overflow-y-auto win-scroll flex flex-col gap-8 pb-20 pr-2">
        <For each={dates()} fallback={
           <div class="flex-1 flex flex-col items-center justify-center py-40 opacity-20 grayscale">
              <div class="w-20 h-20 border-4 border-dashed border-text_accent animate-spin-slow mb-6"></div>
              <div class="text-xl font-black tracking-[.5em] uppercase">NO_ARCHIVE_DATA_MATCHES</div>
           </div>
        }>
          {(dateLabel) => (
            <div class="flex flex-col border border-border_main bg-bg_sidebar/10">
               <div class="bg-bg_header/90 px-4 py-2 flex items-center justify-between border-b border-border_main border-l-4 border-l-text_accent">
                  <h3 class="text-[10px] font-black text-text_primary tracking-widest uppercase">{dateLabel}</h3>
                  <span class="text-[9px] font-mono font-bold text-text_accent opacity-50">ENTRIES: {groupedByDate()[dateLabel].length}</span>
               </div>

               <div class="flex flex-col divide-y divide-border_main/10 bg-bg_main/5">
                  <For each={groupedByDate()[dateLabel]}>
                    {(item) => (
                      <div 
                        onClick={() => window.open(item.link, '_blank')}
                        class="grid grid-cols-[100px_1fr_150px_150px] items-center px-4 py-3 hover:bg-text_accent/5 cursor-pointer group transition-all border-l-2 border-l-transparent hover:border-l-text_accent"
                      >
                         <div class="text-[9px] font-mono text-text_secondary opacity-40 group-hover:opacity-100 uppercase tracking-tighter">
                            {new Date(item.timestamp * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                         </div>

                         <div class="flex items-center gap-3 overflow-hidden px-2">
                            <Show when={item.sentiment}>
                               <div class={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  String(item.sentiment).toUpperCase() === 'NEGATIVE' ? 'bg-red-500 shadow-[0_0_8px_red]' : 
                                  String(item.sentiment).toUpperCase() === 'POSITIVE' ? 'bg-emerald-500 shadow-[0_0_8px_#00ff41]' : 'bg-gray-500'
                               }`} />
                            </Show>
                            <h4 class="text-[11px] font-medium text-text_primary group-hover:text-text_accent truncate tracking-tight">{item.title}</h4>
                         </div>

                         <div class="px-4 text-center">
                            <span class="text-[9px] font-black text-text_secondary/30 uppercase truncate block">{item.category}</span>
                         </div>

                         <div class="text-right">
                             <span class="text-[9px] font-black text-text_secondary/60 group-hover:text-text_accent/60 uppercase truncate">{item.source}</span>
                         </div>
                      </div>
                    )}
                  </For>
               </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
