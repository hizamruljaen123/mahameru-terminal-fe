import { For, Show } from 'solid-js';

const NewsPanel = (props) => {
  return (
    <div class="mt-4 animate-in slide-in-from-top-2 duration-300">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-1 h-3 bg-emerald-500 rounded-full"></div>
        <span class="text-[9px] font-black tracking-widest text-emerald-400 uppercase">LATENCY_CORE_NEWS</span>
      </div>
      
      <Show when={props.loading}>
        <div class="py-4 flex justify-center">
          <div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Show>

      <div class="space-y-2">
        <For each={props.news}>
          {(item, index) => (
            <div class="group relative">
              <a 
                href={item.link} 
                target="_blank" 
                class="block p-3 bg-black/40 border border-white/10 hover:border-emerald-500/30 rounded transition-all pr-8"
              >
                <div class="text-[10px] text-white/90 font-bold leading-snug group-hover:text-emerald-300 transition-colors uppercase">
                  {item.title}
                </div>
                <div class="flex items-center justify-between mt-2">
                  <span class="text-[8px] text-white/30 font-black">{item.publisher}</span>
                  <span class="text-[8px] text-white/20">{new Date(item.time * 1000).toLocaleDateString()}</span>
                </div>
              </a>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  props.onRemove && props.onRemove(index());
                }}
                class="absolute right-2 top-2 w-5 h-5 flex items-center justify-center text-white/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove Item"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          )}
        </For>
      </div>

      <Show when={!props.loading && props.news.length === 0}>
        <div class="py-4 text-center text-[9px] text-white/20 uppercase font-black tracking-widest">
          No recent intelligence found
        </div>
      </Show>
    </div>
  );
};

export default NewsPanel;
