import { createSignal, onMount, For, Show } from 'solid-js';

const CalendarPanel = (props) => {
  const [events, setEvents] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    const data = await props.fetchGlobalCalendar();
    setEvents(data);
    setLoading(false);
  });

  return (
    <div class="fixed top-20 right-6 z-[60] w-[320px] bg-black/80 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in slide-in-from-right-10 duration-500">
      {/* Header */}
      <div class="p-4 bg-orange-600/10 border-b border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-3">
           <div class="p-2 bg-orange-600 rounded-lg shadow-lg shadow-orange-600/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white">
                 <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
           </div>
           <div>
              <div class="text-[10px] font-black text-white uppercase tracking-[0.2em]">Official_Calendar</div>
              <div class="text-[7px] font-black text-orange-500 uppercase tracking-widest">Market Corporate Events</div>
           </div>
        </div>
        <button onClick={props.onClose} class="text-white/20 hover:text-white transition-colors">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Body */}
      <div class="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar-dark p-2 space-y-1">
        <Show when={loading()}>
           <div class="py-20 flex flex-col items-center justify-center gap-4">
              <div class="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <div class="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Synchronizing...</div>
           </div>
        </Show>

        <Show when={!loading() && events().length === 0}>
           <div class="py-20 text-center">
              <div class="text-[9px] font-black text-white/10 uppercase tracking-widest">No Strategic Events Scheduled</div>
           </div>
        </Show>

        <For each={events()}>
          {(event) => (
            <div class="p-3 bg-white/5 hover:bg-white/[0.08] border border-white/5 rounded-xl transition-all group flex items-start gap-4">
               <div class="flex flex-col items-center min-w-[40px] pt-1">
                  <div class="text-[10px] font-black text-orange-500">{event.date.split('-')[2]}</div>
                  <div class="text-[7px] font-black text-white/40 uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</div>
               </div>
               <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                     <span class="text-[7px] font-black text-orange-400 uppercase tracking-wider">{event.type}</span>
                     <span class="text-[8px] font-mono text-white/30 font-bold">{event.symbol}</span>
                  </div>
                  <div class="text-[11px] font-black text-white uppercase group-hover:text-orange-400 transition-colors truncate">{event.name}</div>
                  <Show when={event.consensus_eps}>
                     <div class="flex gap-4 mt-2 border-t border-white/5 pt-2">
                        <div>
                           <div class="text-[6px] text-white/20 uppercase font-black">EPS Est</div>
                           <div class="text-[9px] font-mono text-white font-bold">{event.consensus_eps}</div>
                        </div>
                        <div>
                           <div class="text-[6px] text-white/20 uppercase font-black">Revenue Est</div>
                           <div class="text-[9px] font-mono text-white font-bold">{(event.consensus_rev / 1e12).toFixed(1)}T</div>
                        </div>
                     </div>
                  </Show>
                  <button 
                    onClick={() => props.onPinEvent(event)}
                    class="mt-3 w-full py-1.5 bg-orange-600/10 hover:bg-orange-600 text-[7px] font-black text-orange-500 group-hover:text-white uppercase tracking-widest rounded-lg border border-orange-500/20 transition-all opacity-0 group-hover:opacity-100"
                  >Pin to Canvas</button>
               </div>
            </div>
          )}
        </For>
      </div>

      {/* Footer */}
      <div class="p-3 bg-black/40 border-t border-white/5 text-center">
         <div class="text-[7px] font-black text-blue-400 uppercase tracking-[0.4em] animate-pulse">Tactical Readiness: Green</div>
      </div>
    </div>
  );
};

export default CalendarPanel;
