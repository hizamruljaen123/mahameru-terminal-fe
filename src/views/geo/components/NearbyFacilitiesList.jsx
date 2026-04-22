import { For, Show, createSignal, createMemo } from 'solid-js';

export default function NearbyFacilitiesList(props) {
  const categories = [
    { id: 'all', label: 'ALL', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>', color: 'text-white' },
    { id: 'port', label: 'PORT', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22V8M5 12h14M12 8l-4 4M12 8l4 4"/></svg>', color: 'text-blue-400' },
    { id: 'airport', label: 'AIR', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 21 4s-2 0-3.5 1.5L14 9L5.8 7.2L4 9l7 3l-3 3l-3-1l-2 2l3 2l2 3l2-2l-1-3l3-3l3 7l1.8-1.8z"/></svg>', color: 'text-yellow-400' },
    { id: 'industrial', label: 'IND', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20V4l6 4v12M8 20l6-4V4l6 4v12"/></svg>', color: 'text-emerald-400' },
    { id: 'energy', label: 'NRG', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', color: 'text-orange-500' },
    { id: 'vessel', label: 'SHP', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10l-6-6H8L2 10h20zM2 10v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10M12 10V4"/></svg>', color: 'text-sky-400' }
  ];

  const energyTypes = ['refinery', 'lng', 'terminal', 'offshore'];
  const vesselTypes = ['vessel', 'Cargo', 'Tanker'];

  const filteredFacilities = createMemo(() => {
    const cat = props.activeCategory;
    if (cat === 'all') return props.facilities;
    if (cat === 'energy') return props.facilities.filter(f => energyTypes.includes(f.infra_type));
    if (cat === 'vessel') return props.facilities.filter(f => f.infra_type === 'vessel');
    return props.facilities.filter(f => f.infra_type === cat);
  });

  const getCount = (cat) => {
    if (cat === 'all') return props.facilities.length;
    if (cat === 'energy') return props.facilities.filter(f => energyTypes.includes(f.infra_type)).length;
    if (cat === 'vessel') return props.facilities.filter(f => f.infra_type === 'vessel').length;
    return props.facilities.filter(f => f.infra_type === cat).length;
  };

  const getIcon = (type, vesselType) => {
    if (type === 'vessel') return categories.find(c => c.id === 'vessel').icon;
    if (energyTypes.includes(type)) return categories.find(c => c.id === 'energy').icon;
    return categories.find(c => c.id === type)?.icon || categories[0].icon;
  };

  const getThemeColor = (type, vesselType) => {
    if (type === 'vessel') {
      if (vesselType === 'Tanker') return 'text-rose-400';
      if (vesselType === 'Cargo') return 'text-sky-400';
      return 'text-slate-400';
    }
    switch (type) {
      case 'port': return 'text-blue-400';
      case 'airport': return 'text-yellow-400';
      case 'industrial': return 'text-emerald-400';
      case 'refinery': return 'text-orange-500';
      case 'lng': return 'text-cyan-400';
      case 'terminal': return 'text-fuchsia-400';
      case 'offshore': return 'text-rose-500';
      default: return 'text-white/40';
    }
  };

  return (
    <div class="flex flex-col h-full">
      <div class="shrink-0 flex items-center justify-between pb-3 border-b border-white/10">
        <div class="flex items-center gap-2">
          <span class="w-1 h-3 bg-blue-500"></span>
          <span class="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">PROXIMITY_ANALYSIS</span>
        </div>
        <Show when={props.isLoading}>
          <span class="text-[7px] text-blue-500 font-bold animate-pulse uppercase tracking-widest italic">SCANNING...</span>
        </Show>
      </div>

      {/* CATEGORY NAV */}
      <div class="shrink-0 flex gap-1 py-1 border-b border-white/5">
        <For each={categories}>{(cat) => (
          <button 
            onClick={() => props.onCategoryChange(cat.id)}
            class={`flex-1 flex flex-col items-center py-2 transition-all border ${props.activeCategory === cat.id ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent hover:bg-white/5'}`}
          >
            <div class={`mb-1 ${props.activeCategory === cat.id ? cat.color : 'text-white/20'}`} innerHTML={cat.icon}></div>
            <div class="flex items-center gap-1">
              <span class={`text-[6px] font-black tracking-widest ${props.activeCategory === cat.id ? 'text-white' : 'text-white/20'}`}>{cat.label}</span>
              <span class="text-[6px] font-mono text-zinc-500 bg-black/40 px-1 rounded-sm">{getCount(cat.id)}</span>
            </div>
          </button>
        )}</For>
      </div>

      {/* AIS COMMAND CONSOLE */}
      <Show when={props.activeCategory === 'vessel'}>
         <div class="shrink-0 p-2 bg-[#0a1628]/60 border-b border-white/5 flex gap-1">
            <button 
              onClick={() => props.onStreamNearPort()}
              class="flex-[2] py-2 bg-blue-600 hover:bg-blue-500 text-white text-[8px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 group shadow-[0_0_15px_rgba(37,99,235,0.3)]"
            >
               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="group-hover:animate-spin">
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
               </svg>
               SYNC
            </button>
            <button 
              onClick={() => props.onResetAis()}
              class="flex-1 py-2 bg-orange-600/20 border border-orange-500/40 hover:bg-orange-600 text-orange-400 hover:text-white text-[8px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1"
            >
               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
               RE-CAL
            </button>
            <button 
              onClick={() => props.onKillStream()}
              class="flex-1 py-2 bg-red-600/20 border border-red-500/40 hover:bg-red-600 text-red-400 hover:text-white text-[8px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1"
            >
               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
               KILL
            </button>
         </div>
      </Show>

      <div class="flex-1 overflow-y-auto win-scroll pr-1 mt-2">
        <For each={filteredFacilities()}>{(fac) => (
          <div 
            onClick={() => props.onSelect(fac)}
            class="flex items-center justify-between p-2 mb-1 bg-white/[0.02] border border-white/5 hover:border-blue-500/50 hover:bg-blue-500/[0.05] transition-all group cursor-pointer"
          >
            <div class="flex items-center gap-3">
              <div class={`shrink-0 w-6 h-6 flex items-center justify-center bg-black/40 border border-white/5 ${getThemeColor(fac.infra_type, fac.type)}`}>
                <div innerHTML={getIcon(fac.infra_type, fac.type)}></div>
              </div>
              <div class="flex flex-col overflow-hidden">
                <span class="text-[9px] font-bold text-white/80 uppercase leading-none mb-1 group-hover:text-white transition-colors truncate">{fac.name}</span>
                <div class="flex items-center gap-2">
                   <span class={`text-[6px] font-black uppercase tracking-[0.1em] ${getThemeColor(fac.infra_type, fac.type)}`}>
                     {fac.infra_type === 'vessel' ? fac.type : fac.infra_type}
                   </span>
                   <Show when={fac.infra_type === 'vessel' && fac.destination}>
                      <span class="text-[6px] font-mono text-zinc-600 truncate border-l border-white/10 pl-2">TO: {fac.destination}</span>
                   </Show>
                </div>
              </div>
            </div>
            <div class="flex flex-col items-end">
              <span class="text-[10px] font-black text-white font-mono">{fac.distance.toFixed(1)}</span>
              <span class="text-[6px] font-black text-zinc-600 uppercase tracking-widest">KM</span>
            </div>
          </div>
        )}</For>
        
        <Show when={!props.isLoading && filteredFacilities().length === 0}>
          <div class="py-10 text-center opacity-20 border border-dashed border-white/5">
            <span class="text-[8px] font-black uppercase">NO_TARGETS_IN_DOMAIN</span>
          </div>
        </Show>
      </div>
    </div>
  );
}

