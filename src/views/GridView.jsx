import { createMemo, createSignal, For, Show } from 'solid-js';

const PAGE_SIZE = 12; // 4x3 Grid

export default function GridView(props) {
  const [currentPage, setCurrentPage] = createSignal(1);

  const items = createMemo(() => {
    const cat = props.category() || 'INDONESIA';
    return props.data()[cat] || [];
  });

  const totalPages = createMemo(() => Math.ceil(items().length / PAGE_SIZE) || 1);

  const pagedItems = createMemo(() => {
    const start = (currentPage() - 1) * PAGE_SIZE;
    return items().slice(start, start + PAGE_SIZE);
  });

  const setPage = (delta) => setCurrentPage(prev => Math.max(1, Math.min(totalPages(), prev + delta)));

  return (
    <div class="flex-1 p-6 overflow-hidden flex flex-col gap-6 animate-in fade-in duration-700">
      {/* GRID HEADER */}
      <div class="flex items-center justify-between border-b border-border_main pb-4">
        <div class="flex flex-col">
          <h2 class="text-xl font-black tracking-[0.3em] text-text_primary uppercase font-mono">
            {props.category() || 'GLOBAL'} <span class="text-text_accent opacity-40">// GRID_VIEW_PORTAL</span>
          </h2>
          <span class="text-[9px] text-text_secondary font-mono tracking-widest opacity-60">
            PAGINATION: PAGE_{currentPage()}/{totalPages()} // ITEMS: {pagedItems().length}/{items().length}
          </span>
        </div>

        <div class="flex items-center gap-4">
          <button 
            onClick={() => setPage(-1)}
            disabled={currentPage() === 1}
            class="px-4 py-1.5 border border-border_main text-[10px] font-black tracking-widest hover:bg-text_accent/10 disabled:opacity-20 transition-all uppercase"
          >
            ← PREV
          </button>
          <button 
            onClick={() => setPage(1)}
            disabled={currentPage() === totalPages()}
            class="px-4 py-1.5 border border-border_main text-[10px] font-black tracking-widest hover:bg-text_accent/10 disabled:opacity-20 transition-all uppercase"
          >
            NEXT →
          </button>
        </div>
      </div>

      {/* 4x3 GRID CONTAINER */}
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 overflow-y-auto win-scroll pr-2 pb-10">
        <For each={pagedItems()} fallback={
           <div class="col-span-full h-full flex flex-col items-center justify-center py-40 opacity-20">
              <div class="w-16 h-16 border-2 border-dashed border-text_accent animate-spin-slow mb-6"></div>
              <div class="text-lg font-black tracking-[0.5em] animate-pulse">AWAITING_INTEL_FEED...</div>
           </div>
        }>
          {(item) => (
            <article 
              onClick={() => window.open(item.link, '_blank')}
              class="group relative bg-bg_sidebar/40 border border-border_main rounded-sm overflow-hidden flex flex-col hover:border-text_accent/50 transition-all duration-300 shadow-lg hover:shadow-text_accent/10 cursor-pointer"
            >
               {/* THUMBNAIL */}
               <div class="h-44 w-full relative overflow-hidden bg-bg_main/50">
                  <Show 
                    when={item.imageUrl} 
                    fallback={<div class="w-full h-full flex items-center justify-center text-[10px] font-mono text-text_secondary/20">NO_FIELD_MEDIA</div>}
                  >
                    <img src={item.imageUrl} alt="" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  </Show>
                  
                  {/* SOURCE OVERLAY badge */}
                  <div class="absolute top-3 left-3 px-2 py-0.5 bg-black/80 backdrop-blur-md text-[8px] font-black text-white/80 border border-white/10 uppercase tracking-widest">
                    {item.source}
                  </div>
                  
                  {/* SENTIMENT DOT */}
                  <Show when={item.sentiment}>
                    <div class={`absolute top-3 right-3 w-2 h-2 rounded-full ${
                      String(item.sentiment).toUpperCase() === 'NEGATIVE' ? 'bg-red-500 shadow-[0_0_8px_red]' :
                      String(item.sentiment).toUpperCase() === 'POSITIVE' ? 'bg-emerald-500 shadow-[0_0_8px_#00ff41]' : 'bg-white/40'
                    }`} />
                  </Show>
               </div>

               {/* CONTENT */}
               <div class="p-5 flex flex-col gap-3">
                 <div class="text-[8px] font-mono text-text_secondary/50 font-bold uppercase tracking-tighter">
                   DATESTAMP: {new Date(item.timestamp * 1000).toLocaleString([], {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                 </div>
                 
                 <h4 class="text-[13px] font-bold text-text_primary group-hover:text-text_accent transition-colors leading-snug line-clamp-2">
                    {item.title}
                 </h4>
                 
                 <p class="text-[10px] text-text_secondary leading-relaxed line-clamp-3 opacity-60">
                    {item.description || "No tactical summary available for this intelligence packet."}
                 </p>
               </div>
               
               {/* BOTTOM DECORATION */}
               <div class="mt-auto h-1 w-0 bg-text_accent group-hover:w-full transition-all duration-500"></div>
            </article>
          )}
        </For>
      </div>
    </div>
  );
}
