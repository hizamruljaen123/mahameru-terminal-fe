import { createSignal, For, Show } from 'solid-js';

const CCTV_LOCATIONS = [
  { 
    id: 1, 
    name: "OSAKA GRAND RING, Osaka", 
    youtubeId: "kCE6T3p8AZ4", 
    category: "ASIA_INFRA",
    description: "Real-time monitoring of the Grand Ring infrastructure in Osaka, Japan."
  },
  { 
    id: 2, 
    name: "SAN DIEGO ISLAND, USA", 
    youtubeId: "iaBfYxbmwXA", 
    category: "NORTH_AMERICA",
    description: "Live feed from San Diego Island, monitoring coastal infrastructure and maritime activity."
  },
  { 
    id: 3, 
    name: "AKITA PORT CITY", 
    youtubeId: "gSlQ0ZQxVU8", 
    category: "ASIA_INFRA",
    description: "Critical maritime node in Northern Japan, monitoring port operations and logistics."
  },
  { 
    id: 4, 
    name: "PORT ROTTERDAM", 
    youtubeId: "_KVWehizoNU", 
    category: "EUROPE_INFRA",
    description: "One of the world's largest ports, monitoring primary shipping lanes and container terminals."
  },
  { 
    id: 5, 
    name: "HMS WARRIOR PORTSMOUTH", 
    youtubeId: "N9KCrI_-Zv0", 
    category: "EUROPE_INFRA",
    description: "Strategic naval heritage site and maritime monitoring in Portsmouth, UK."
  },
  { 
    id: 6, 
    name: "AMAZONEHAVEN, WEST VIEW, ROTTERDAM", 
    youtubeId: "M09NaBVPjAI", 
    category: "EUROPE_INFRA",
    description: "Specific monitoring of the Amazonehaven terminal at Maasvlakte, Rotterdam."
  },
  { 
    id: 7, 
    name: "RCRV RESEARCH VESSEL CAM-1", 
    youtubeId: "zKXPw48ohHA", 
    category: "MARITIME_RESEARCH",
    description: "Regional Class Research Vessel (RCRV) live feed monitoring deep sea operations."
  },
  { 
    id: 8, 
    name: "DA NANG LIVE CAM, VIETNAM", 
    youtubeId: "5wLzH_GrRl8", 
    category: "ASIA_INFRA",
    description: "Hải Châu District, Da Nang. Urban infrastructure and traffic flow monitoring."
  },
  { 
    id: 9, 
    name: "TIMES SQUARE, NEW YORK", 
    youtubeId: "rnXIjl_Rzy4", 
    category: "NORTH_AMERICA",
    description: "The Heart of New York City. High-density urban monitoring and security node."
  },
  { 
    id: 10, 
    name: "NEW YORK HARBOR/SKYLINE", 
    youtubeId: "VGnFLdQW39A", 
    category: "NORTH_AMERICA",
    description: "Strategic overview of New York harbor and metropolitan infrastructure."
  },
  { 
    id: 11, 
    name: "SHINJUKU, TOKYO", 
    youtubeId: "6dp-bvQ7RWo", 
    category: "ASIA_INFRA",
    description: "Busiest transit hub in the world. Monitoring massive logistical flows in Shinjuku."
  },
  { 
    id: 12, 
    name: "WESTERN WALL, JERUSALEM", 
    youtubeId: "77akujLn4k8", 
    category: "MIDDLE_EAST",
    description: "Strategic site monitoring in Jerusalem, Israel. Critical security node."
  },
  { 
    id: 13, 
    name: "SYDNEY AIRPORT SPOTTING", 
    youtubeId: "7Bd8MZriCAo", 
    category: "OCEANIA_INFRA",
    description: "Air traffic monitoring and logistics flow at Sydney International Airport."
  },
  { 
    id: 14, 
    name: "LAS VEGAS AIRPORT (LAS)", 
    youtubeId: "_-Qg5jD-PfA", 
    category: "NORTH_AMERICA",
    description: "Monitoring aviation infrastructure and ground operations at LAS."
  },
  { 
    id: 15, 
    name: "DOWNTOWN SINGAPORE", 
    youtubeId: "9cfkyMzanbc", 
    category: "ASIA_INFRA",
    description: "Live overview of Singapore's central business district and tech infrastructure."
  },
  { 
    id: 16, 
    name: "PORT OF SINGAPORE", 
    youtubeId: "KUtH-ztAWcA", 
    category: "ASIA_INFRA",
    description: "Primary global shipping hub. Monitoring high-frequency maritime logistics."
  }
];

export default function InfraCCTVPanel() {
  const [selectedIds, setSelectedIds] = createSignal([1, 4, 16, 15, 9, 12]);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);

  const toggleLocation = (id) => {
    const current = selectedIds();
    if (current.includes(id)) {
      if (current.length > 1) {
        setSelectedIds(current.filter(i => i !== id));
      }
    } else {
      if (current.length < 9) { // Max 9 for 3x3 grid
        setSelectedIds([...current, id]);
      }
    }
  };

  const filteredLocations = () => CCTV_LOCATIONS.filter(loc => 
    loc.name.toLowerCase().includes(searchQuery().toLowerCase()) ||
    loc.category.toLowerCase().includes(searchQuery().toLowerCase())
  );

  const categories = () => [...new Set(CCTV_LOCATIONS.map(l => l.category))];
  const selectedLocations = () => CCTV_LOCATIONS.filter(l => selectedIds().includes(l.id));

  return (
    <div class="h-full flex bg-bg_main overflow-hidden font-mono lowercase transition-colors duration-400">
      
      {/* Sidebar Selector */}
      <div class={`flex-shrink-0 border-r border-border_main bg-bg_sidebar flex flex-col transition-all duration-300 ${isSidebarOpen() ? 'w-80' : 'w-0 overflow-hidden'}`}>
        <div class="p-4 border-b border-border_main bg-white/2 space-y-4">
           <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                 <div class="w-2 h-2 bg-text_accent animate-pulse shadow-[0_0_10px_var(--text-accent)]"></div>
                 <span class="text-[10px] font-black tracking-widest text-text_accent uppercase">INFRA_CCTV_SYSTEM_v1</span>
              </div>
              <span class="text-[8px] text-text_secondary opacity-40">{selectedIds().length}/9 NODES</span>
           </div>
           
           <input 
             type="text" 
             placeholder="FILTER_CCTV_NODES..." 
             onInput={(e) => setSearchQuery(e.target.value)}
             class="w-full bg-bg_main/60 border border-border_main px-3 py-2 text-[10px] text-text_primary outline-none focus:border-text_accent transition-all"
           />
        </div>

        <div class="flex-1 overflow-y-auto win-scroll p-2 space-y-6">
           <For each={categories()}>{(cat) => (
              <div class="space-y-1">
                 <span class="text-[8px] font-black text-text_secondary px-2 uppercase tracking-widest opacity-30">{cat.replace('_', ' ')}</span>
                 <div class="space-y-0.5">
                    <For each={filteredLocations().filter(l => l.category === cat)}>{(loc) => (
                       <button 
                         onClick={() => toggleLocation(loc.id)}
                         class={`w-full p-2.5 text-left text-[10px] transition-all border-l-2 ${selectedIds().includes(loc.id) ? 'bg-text_accent/10 border-text_accent text-text_primary' : 'border-transparent text-text_secondary opacity-40 hover:bg-white/5 hover:opacity-100'}`}
                       >
                          <div class="flex justify-between items-center">
                             <span class="truncate pr-2 uppercase font-black">{loc.name}</span>
                             <Show when={selectedIds().includes(loc.id)}>
                                <span class="text-[8px] text-text_accent font-black">ACTIVE</span>
                             </Show>
                          </div>
                          <p class="text-[7px] opacity-40 mt-1 uppercase font-bold">{loc.category} // CCTV_FEED_OK</p>
                       </button>
                    )}</For>
                 </div>
              </div>
           )}</For>
        </div>
      </div>

      {/* Main Grid View */}
      <div class="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Toolbar */}
        <div class="h-10 border-b border-border_main bg-bg_header flex items-center justify-between px-4 shrink-0 transition-colors">
           <div class="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen())}
                class="text-text_secondary opacity-40 hover:opacity-100 transition-colors"
              >
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              </button>
              <div class="flex items-center gap-2">
                 <span class="text-[9px] font-black text-text_primary tracking-[0.4em] uppercase">GLOBAL_INFRA_CCTV_MONITOR</span>
                 <div class="px-1.5 py-0.5 bg-text_accent text-bg_main text-[8px] font-black uppercase tracking-tighter shadow-[0_0_10px_var(--text-accent)]">MULTI_SITE_INTEL</div>
              </div>
           </div>
           
           <div class="flex gap-4 items-center">
              <span class="text-[8px] text-text_secondary opacity-20 font-bold tracking-[0.5em] uppercase">SYSTEM_TIME: {new Date().toLocaleTimeString()}</span>
              <button 
                onClick={() => { const current = selectedIds(); setSelectedIds([]); setTimeout(() => setSelectedIds(current), 100); }}
                class="text-[9px] font-black text-text_accent hover:underline uppercase tracking-widest"
              >
                SYNC_LIVE_FEEDS
              </button>
           </div>
        </div>

        {/* The Grid */}
        <div class="flex-1 p-4 bg-bg_main overflow-y-auto win-scroll relative transition-colors">
           <div class={`grid gap-4 h-full w-full ${selectedIds().length <= 1 ? 'grid-cols-1' : selectedIds().length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <For each={selectedLocations()}>{(loc) => (
                 <div class="relative bg-black border border-border_main flex flex-col group hover:border-text_accent transition-all bg-[linear-gradient(45deg,rgba(0,255,65,0.02)_0%,transparent_100%)] min-h-[350px] shadow-xl">
                    
                    {/* Panel Header */}
                    <div class="h-8 border-b border-border_main bg-black/80 flex items-center justify-between px-3 shrink-0 z-10 group-hover:border-text_accent transition-colors">
                       <div class="flex items-center gap-2 overflow-hidden">
                          <div class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                          <span class="text-[9px] font-black text-white truncate uppercase tracking-widest font-mono">{loc.name}</span>
                       </div>
                       <div class="flex items-center gap-2">
                         <span class="text-[7px] text-text_accent/60 font-mono hidden md:block">LIVE_FEED_STREAMING</span>
                         <button 
                           onClick={() => toggleLocation(loc.id)}
                           class="text-white/20 hover:text-red-500 transition-colors"
                         >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                         </button>
                       </div>
                    </div>

                    {/* YouTube Embed Area */}
                    <div class="flex-1 relative overflow-hidden bg-black">
                       <iframe
                         width="100%"
                         height="100%"
                         src={`https://www.youtube.com/embed/${loc.youtubeId}?autoplay=1&mute=1&rel=0&modestbranding=1`}
                         title={loc.name}
                         frameborder="0"
                         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                         referrerpolicy="strict-origin-when-cross-origin"
                         allowfullscreen
                         class="w-full h-full"
                       ></iframe>
                       
                       {/* Info Overlay */}
                       <div class="absolute bottom-2 left-2 right-2 px-2 py-1 bg-black/80 border border-white/5 text-[7px] font-mono text-white/50 z-20 pointer-events-none group-hover:border-text_accent/30 transition-colors flex justify-between">
                          <span>{loc.category} // INTEL_RX_STABLE</span>
                          <span class="text-text_accent/40">BUFFER: 250ms</span>
                       </div>
                    </div>
                    
                    {/* Description Footer */}
                    <div class="p-2 border-t border-border_main bg-black/40 hidden group-hover:block animate-in slide-in-from-bottom-2 duration-200">
                       <p class="text-[8px] text-text_secondary leading-tight line-clamp-2 uppercase italic">{loc.description}</p>
                    </div>
                 </div>
              )}</For>
              
              <Show when={selectedIds().length === 0}>
                 <div class="col-span-full h-full flex flex-col items-center justify-center opacity-10">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    <p class="text-[14px] font-black mt-4 tracking-[10px] uppercase">CCTV_STANDBY</p>
                 </div>
              </Show>
           </div>
        </div>
      </div>
    </div>
  );
}
