import { For, Show } from 'solid-js';

export default function SigintFeed(props) {
  return (
    <div class="flex flex-col min-h-0">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="w-1 h-3 bg-orange-500"></span>
          <span class="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">SIGINT_STREAM</span>
        </div>
        <Show when={props.isLoading}>
          <span class="text-[7px] text-orange-500 font-bold animate-pulse uppercase italic">ACQUIRING...</span>
        </Show>
      </div>
      
      <div class="space-y-1.5 overflow-hidden">
        <For each={props.news.slice(0, 10)}>{(item) => (
          <a href={item.link} target="_blank" class="block p-2.5 bg-white/[0.02] border border-white/5 hover:border-orange-500 transition-all group">
            <h4 class="text-[9px] font-bold text-white/70 uppercase leading-tight line-clamp-2 group-hover:text-white">{item.title}</h4>
            <div class="mt-1.5 flex items-center gap-3 text-[6px] font-black text-zinc-600 uppercase">
              <span class="truncate">{item.publisher}</span>
              <span class="shrink-0">{item.pubDate.split(',')[0]}</span>
            </div>
          </a>
        )}</For>
        <Show when={!props.isLoading && props.news.length === 0}>
          <div class="py-10 text-center opacity-20 border border-dashed border-white/5">
            <span class="text-[8px] font-black uppercase">NO_SIGNAL_DETECTED</span>
          </div>
        </Show>
      </div>
    </div>
  );
}
