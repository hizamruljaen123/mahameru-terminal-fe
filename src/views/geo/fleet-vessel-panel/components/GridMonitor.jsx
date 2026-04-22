import { createSignal, For, Show, createMemo } from 'solid-js';

// Strategic Maritime Locations (AIS Grid Monitoring)
const VESSEL_RADAR_LOCATIONS = [
   { id: 1, name: "Strait of Hormuz (Iran/Oman)", lat: 26.56667, lon: 56.46667, category: "MARITIME STRAITS" },
   { id: 2, name: "Strait of Malacca (Riau/Malaysia)", lat: 1.43333, lon: 102.93333, category: "MARITIME STRAITS" },
   { id: 3, name: "Suez Canal (Southern Entrance)", lat: 29.93333, lon: 32.55, category: "MARITIME STRAITS" },
   { id: 4, name: "Bab el-Mandeb Strait (Yemen/Djibouti)", lat: 12.58333, lon: 43.33333, category: "MARITIME STRAITS" },
   { id: 5, name: "Bosporus Strait (Istanbul)", lat: 41.13333, lon: 29.06667, category: "MARITIME STRAITS" },
   { id: 6, name: "Strait of Gibraltar", lat: 35.95, lon: -5.45, category: "MARITIME STRAITS" },
   { id: 7, name: "Panama Canal (Gatun Locks)", lat: 9.26667, lon: -79.91667, category: "MARITIME STRAITS" },
   { id: 8, name: "Sunda Strait (Banten/Lampung)", lat: -5.91667, lon: 105.86667, category: "MARITIME STRAITS" },
   { id: 9, name: "Lombok Strait (NTB)", lat: -8.53333, lon: 115.71667, category: "MARITIME STRAITS" },
   { id: 10, name: "The Skagerrak (Denmark)", lat: 57.83333, lon: 9.06667, category: "MARITIME STRAITS" },
   { id: 11, name: "Ras Tanura Oil Terminal (Saudi)", lat: 26.63333, lon: 50.16667, category: "MIDDLE_EAST_TERMINALS" },
   { id: 12, name: "Jebel Ali Port (UAE)", lat: 24.98333, lon: 55.05, category: "MIDDLE_EAST_TERMINALS" },
   { id: 13, name: "Kharg Island (Iran)", lat: 29.23333, lon: 50.31667, category: "MIDDLE_EAST_TERMINALS" },
   { id: 14, name: "Basra Oil Terminal (Iraq)", lat: 29.68333, lon: 48.81667, category: "MIDDLE_EAST_TERMINALS" },
   { id: 15, name: "Port of Fujairah (UAE)", lat: 25.16667, lon: 56.36667, category: "MIDDLE_EAST_TERMINALS" },
   { id: 16, name: "Yanbu Port (Saudi)", lat: 24.0, lon: 38.05, category: "MIDDLE_EAST_TERMINALS" },
   { id: 17, name: "Mina Al Ahmadi (Kuwait)", lat: 29.06667, lon: 48.13333, category: "MIDDLE_EAST_TERMINALS" },
   { id: 18, name: "Das Island (UAE)", lat: 25.15, lon: 52.86667, category: "MIDDLE_EAST_TERMINALS" },
   { id: 19, name: "Mina Salman (Bahrain)", lat: 26.2, lon: 50.6, category: "MIDDLE_EAST_TERMINALS" },
   { id: 20, name: "Port of Salalah (Oman)", lat: 16.93333, lon: 54.01667, category: "MIDDLE_EAST_TERMINALS" },
   { id: 21, name: "Port of Duqm (Oman)", lat: 19.66667, lon: 57.7, category: "MIDDLE_EAST_TERMINALS" },
   { id: 22, name: "Aden Port (Yemen)", lat: 12.78333, lon: 44.96667, category: "MIDDLE_EAST_TERMINALS" },
   { id: 23, name: "Zueitina (Libya)", lat: 30.95, lon: 20.11667, category: "MIDDLE_EAST_TERMINALS" },
   { id: 24, name: "Es Sider (Libya)", lat: 30.63333, lon: 18.35, category: "MIDDLE_EAST_TERMINALS" },
   { id: 25, name: "Baniyas (Syria)", lat: 35.18333, lon: 35.93333, category: "MIDDLE_EAST_TERMINALS" },
   { id: 26, name: "Jurong Island (Singapore)", lat: 1.25, lon: 103.71667, category: "SOUTHEAST ASIA" },
   { id: 36, name: "Rotterdam Maasvlakte (Netherlands)", lat: 51.95, lon: 4.05, category: "GLOBAL_ENERGY_HUBS" },
   { id: 38, name: "Houston Ship Channel (USA)", lat: 29.73333, lon: -95.11667, category: "GLOBAL_ENERGY_HUBS" },
   { id: 39, name: "Pulau Sambu Port", lat: 1.1597436, lon: 103.8802383, category: "INDONESIA_MAIN_PORTS" },
   { id: 40, name: "Tanjung Priok Port (Jakarta)", lat: -6.1033, lon: 106.8792, category: "INDONESIA_MAIN_PORTS" },
   { id: 41, name: "Tanjung Perak Port (Surabaya)", lat: -7.2006, lon: 112.7214, category: "INDONESIA_MAIN_PORTS" },
   { id: 42, name: "Belawan Port (Medan)", lat: 3.7844, lon: 98.6947, category: "INDONESIA_MAIN_PORTS" },
   { id: 43, name: "Soekarno-Hatta Port (Makassar)", lat: -5.1239, lon: 119.4103, category: "INDONESIA_MAIN_PORTS" },
   { id: 44, name: "Tanjung Emas Port (Semarang)", lat: -6.9458, lon: 110.4222, category: "INDONESIA_MAIN_PORTS" },
   { id: 45, name: "Teluk Bayur Port (Padang)", lat: -0.9972, lon: 100.3756, category: "INDONESIA_MAIN_PORTS" },
   { id: 46, name: "Boom Baru Port (Palembang)", lat: -2.9786, lon: 104.7869, category: "INDONESIA_MAIN_PORTS" },
   { id: 47, name: "Trisakti Port (Banjarmasin)", lat: -3.3361, lon: 114.5619, category: "INDONESIA_MAIN_PORTS" },
   { id: 48, name: "Dwikora Port (Pontianak)", lat: -0.0211, lon: 109.3411, category: "INDONESIA_MAIN_PORTS" },
   { id: 49, name: "Bitung Port (North Sulawesi)", lat: 1.4428, lon: 125.1919, category: "INDONESIA_MAIN_PORTS" },
   { id: 50, name: "Batu Ampar Port (Batam)", lat: 1.1558, lon: 103.9911, category: "INDONESIA_MAIN_PORTS" },
   { id: 51, name: "Dumai Port (Riau)", lat: 1.6844, lon: 101.4486, category: "INDONESIA_MAIN_PORTS" },
   { id: 52, name: "Ciwandan Port (Cilegon)", lat: -6.0142, lon: 105.9469, category: "INDONESIA_MAIN_PORTS" },
   { id: 53, name: "Panjang Port (Lampung)", lat: -5.4742, lon: 105.3183, category: "INDONESIA_MAIN_PORTS" },
   { id: 54, name: "Semayang Port (Balikpapan)", lat: -1.2725, lon: 116.8225, category: "INDONESIA_MAIN_PORTS" },
   { id: 55, name: "Sorong Port (West Papua)", lat: -0.8711, lon: 131.2464, category: "INDONESIA_MAIN_PORTS" },
   { id: 56, name: "Yos Sudarso Port (Ambon)", lat: -3.6931, lon: 128.1814, category: "INDONESIA_MAIN_PORTS" },
   { id: 57, name: "Jayapura Port (Papua)", lat: -2.5317, lon: 140.7103, category: "INDONESIA_MAIN_PORTS" },
   { id: 58, name: "Benoa Port (Bali)", lat: -8.7458, lon: 115.2133, category: "INDONESIA_MAIN_PORTS" },
   { id: 59, name: "Tenau Port (Kupang)", lat: -10.1883, lon: 123.5358, category: "INDONESIA_MAIN_PORTS" },
   { id: 60, name: "Samarinda Port (East Kalimantan)", lat: -0.5056, lon: 117.1517, category: "INDONESIA_MAIN_PORTS" },
   { id: 61, name: "Tarakan Port (North Kalimantan)", lat: 3.2806, lon: 117.5853, category: "INDONESIA_MAIN_PORTS" },
   { id: 62, name: "Kuala Tanjung Port (North Sumatra)", lat: 3.3769, lon: 99.4500, category: "INDONESIA_MAIN_PORTS" },
   { id: 63, name: "Patimban Port (Subang)", lat: -6.2417, lon: 107.9158, category: "INDONESIA_MAIN_PORTS" },
   { id: 64, name: "Gresik Port (East Java)", lat: -7.1550, lon: 112.6642, category: "INDONESIA_MAIN_PORTS" },
   { id: 65, name: "Cirebon Port (West Java)", lat: -6.7114, lon: 108.5756, category: "INDONESIA_MAIN_PORTS" },
   { id: 66, name: "Lembar Port (Lombok)", lat: -8.7289, lon: 116.0717, category: "INDONESIA_MAIN_PORTS" },
   { id: 67, name: "Parepare Port (South Sulawesi)", lat: -4.0108, lon: 119.6203, category: "INDONESIA_MAIN_PORTS" },
   { id: 68, name: "Sampit Port (Central Kalimantan)", lat: -2.5372, lon: 112.9608, category: "INDONESIA_MAIN_PORTS" },
   { id: 69, name: "Bontang Port (East Kalimantan)", lat: 0.1192, lon: 117.4889, category: "INDONESIA_MAIN_PORTS" },
   { id: 70, name: "Natuna Waters (North Natuna Sea)", lat: 4.0, lon: 108.0, category: "WATERWAYS" },
   { id: 71, name: "Strait of Makassar (ALKI II Sea Lane)", lat: -1.3333, lon: 118.5, category: "MARITIME STRAITS" },
   { id: 72, name: "Barito Approach (South Kalimantan)", lat: -3.6, lon: 114.4167, category: "SHIPPING_CHANNELS" },
   { id: 73, name: "Gelasa Strait (Bangka Belitung)", lat: -2.8333, lon: 107.0833, category: "MARITIME STRAITS" },
   { id: 74, name: "Bali Strait (Transit Channel)", lat: -8.25, lon: 114.4167, category: "MARITIME STRAITS" },
   { id: 75, name: "Nipah Waters (Batam STS Area)", lat: 1.15, lon: 103.65, category: "ANCHORAGE_ZONES" },
   { id: 76, name: "Ombai Strait (Submarine Transit Lane)", lat: -8.4167, lon: 125.0, category: "MARITIME STRAITS" },
   { id: 77, name: "Wetar Strait (Southwest Maluku)", lat: -8.1667, lon: 126.5, category: "MARITIME STRAITS" },
   { id: 78, name: "Tomini Bay (Sulawesi)", lat: -0.3333, lon: 121.0, category: "WATERWAYS" },
   { id: 79, name: "Berhala Strait (Jambi Approach Channel)", lat: -1.0, lon: 104.3333, category: "SHIPPING_CHANNELS" },
   { id: 80, name: "Port of Shanghai (China)", lat: 30.6267, lon: 122.0644, category: "GLOBAL_HUB_PORTS" },
   { id: 81, name: "Port of Ningbo-Zhoushan (China)", lat: 29.85, lon: 122.0833, category: "GLOBAL_HUB_PORTS" },
   { id: 82, name: "Port of Shenzhen (China)", lat: 22.5, lon: 113.9167, category: "GLOBAL_HUB_PORTS" },
   { id: 83, name: "Port of Busan (South Korea)", lat: 35.1044, lon: 129.0436, category: "GLOBAL_HUB_PORTS" },
   { id: 84, name: "Port of Hamburg (Germany)", lat: 53.5333, lon: 9.95, category: "GLOBAL_HUB_PORTS" },
   { id: 85, name: "Port of Antwerp-Bruges (Belgium)", lat: 51.2333, lon: 4.4, category: "GLOBAL_HUB_PORTS" },
   { id: 86, name: "Port of Los Angeles (USA)", lat: 33.7289, lon: -118.2619, category: "GLOBAL_HUB_PORTS" },
   { id: 87, name: "Port of Hong Kong", lat: 22.3333, lon: 114.1167, category: "GLOBAL_HUB_PORTS" },

   // OIL & GAS TERMINALS / REFINERIES
   { id: 88, name: "Ulsan Oil Terminal (South Korea)", lat: 35.47, lon: 129.37, category: "ENERGY_TERMINALS" },
   { id: 89, name: "Jamnagar Refinery (India) - World's Largest", lat: 22.45, lon: 70.0167, category: "ENERGY_TERMINALS" },
   { id: 90, name: "Abadan Refinery (Iran)", lat: 30.3333, lon: 48.2667, category: "ENERGY_TERMINALS" },
   { id: 91, name: "Ras Laffan LNG Terminal (Qatar)", lat: 25.9, lon: 51.55, category: "ENERGY_TERMINALS" },
   { id: 92, name: "Bonny Island LNG (Nigeria)", lat: 4.4333, lon: 7.1667, category: "ENERGY_TERMINALS" },
   { id: 93, name: "Corpus Christi Oil Port (Texas, USA)", lat: 27.8167, lon: -97.4, category: "ENERGY_TERMINALS" },
   { id: 94, name: "Port Hedland (Australia) - Iron Ore Export", lat: -20.3167, lon: 118.5833, category: "MINING_HUBS" },
   { id: 95, name: "Sullom Voe Terminal (North Sea, UK)", lat: 60.4667, lon: -1.3, category: "ENERGY_TERMINALS" },

   // OFFSHORE INFRASTRUCTURE & FLOATING HUBS
   { id: 96, name: "Brent Oil Field (North Sea)", lat: 61.2833, lon: 1.7333, category: "OFFSHORE_REFINERY" },
   { id: 97, name: "Safaniya Oil Field (Arabian Gulf) - Largest Offshore", lat: 28.0, lon: 49.0, category: "OFFSHORE_REFINERY" },
   { id: 98, name: "Troll Gas Field (Norway)", lat: 60.6667, lon: 3.5, category: "OFFSHORE_REFINERY" },
   { id: 99, name: "Lula Oil Field (Santos Basin, Brazil)", lat: -25.0, lon: -43.0, category: "OFFSHORE_REFINERY" },
   { id: 100, name: "Kashagan Field (Caspian Sea, Kazakhstan)", lat: 46.1333, lon: 51.5, category: "OFFSHORE_REFINERY" },
   { id: 101, name: "Prelude FLNG (Australia) - Largest Floating Facility", lat: -13.7833, lon: 123.3167, category: "OFFSHORE_REFINERY" },
   { id: 102, name: "Hebron Platform (Newfoundland, Canada)", lat: 46.5433, lon: -48.4967, category: "OFFSHORE_REFINERY" },

   // STRATEGIC INFRASTRUCTURE / CANALS / CHOKEPOINTS
   { id: 103, name: "English Channel (Strait of Dover)", lat: 50.1833, lon: -0.5333, category: "MARITIME STRAITS" },
   { id: 105, name: "Tsushima Strait (Japan/Korea)", lat: 34.4167, lon: 129.55, category: "MARITIME STRAITS" },
   { id: 106, name: "Kiel Canal (Germany)", lat: 54.3333, lon: 10.1333, category: "MARITIME STRAITS" },
   { id: 107, name: "Kerch Strait (Black Sea)", lat: 45.25, lon: 36.5, category: "MARITIME STRAITS" },
   { id: 108, name: "Cape of Good Hope (South Africa)", lat: -34.35, lon: 18.4667, category: "WATERWAYS" },
   { id: 109, name: "Strait of Magellan (Chile)", lat: -53.4667, lon: -70.9833, category: "MARITIME STRAITS" },
];

export default function GridMonitor() {
   // Max 9 panels (3x3 grid)
   const [selectedIds, setSelectedIds] = createSignal([1, 2, 3, 26, 36, 38]);
   const [regionSearchTerm, setRegionSearchTerm] = createSignal('');
   const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
   const [singleAssetId, setSingleAssetId] = createSignal("");
   const [activeSingleImos, setActiveSingleImos] = createSignal([]); // Array of strings (IMOs)

   const handleSingleSearch = () => {
      const val = singleAssetId().trim();
      if (!val) return;
      
      // Don't add if already exists
      if (!activeSingleImos().includes(val)) {
         setActiveSingleImos([...activeSingleImos(), val]);
      }
      setSingleAssetId(""); // Clear input
   };

   const removeSingleImo = (imo) => {
      setActiveSingleImos(activeSingleImos().filter(i => i !== imo));
   };

   const toggleLocation = (id) => {
      const current = selectedIds();
      if (current.includes(id)) {
         setSelectedIds(current.filter(i => i !== id));
      } else {
         if (current.length < 9) {
            setSelectedIds([...current, id]);
         }
      }
   };

   const filteredLocations = createMemo(() => VESSEL_RADAR_LOCATIONS.filter(loc =>
      loc.name.toLowerCase().includes(regionSearchTerm().toLowerCase()) ||
      loc.category.toLowerCase().includes(regionSearchTerm().toLowerCase())
   ));

   const categories = () => [...new Set(VESSEL_RADAR_LOCATIONS.map(l => l.category))];
   const selectedLocations = () => VESSEL_RADAR_LOCATIONS.filter(l => selectedIds().includes(l.id));

   const gridPanels = createMemo(() => {
      const items = selectedLocations().map(l => ({ ...l, panelType: 'REGION' }));
      
      // Add all active IMOs to the items list
      activeSingleImos().forEach(imo => {
         items.unshift({
            id: 'SOLO-' + imo,
            name: `PRIORITY TARGET: IMO ${imo}`,
            panelType: 'SOLO',
            imo: imo
         });
      });
      
      return items;
   });

   const clearAllPanels = () => {
      setSelectedIds([]);
      setActiveSingleImos([]);
   };

   return (
      <div class="h-full flex bg-[#06070a] overflow-hidden uppercase">

         {/* Sidebar Selector */}
         <div class={`flex-shrink-0 border-r border-[#00f2ff]/20 bg-[#0b0c10] flex flex-col transition-all duration-300 ${isSidebarOpen() ? 'w-64' : 'w-0 overflow-hidden'}`}>

            {/* Solo Asset Search Section */}
            <div class="p-4 border-b border-red-500/20 bg-red-500/5 space-y-3 shrink-0">
               <div class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 bg-red-500 animate-pulse"></div>
                  <span class="text-[9px] font-black tracking-[0.2em] text-red-500 uppercase">SOLO ASSET TRACKER</span>
               </div>
               <div class="flex gap-1">
                  <input
                     type="text"
                     placeholder="ENTER IMO..."
                     value={singleAssetId()}
                     onInput={(e) => setSingleAssetId(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleSingleSearch()}
                     class="flex-1 bg-black/60 border border-white/10 px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-red-500 transition-all font-mono"
                  />
                  <button
                     onClick={handleSingleSearch}
                     class="bg-red-500/20 text-red-500 border border-red-500/40 px-2 text-[8px] font-black hover:bg-red-500 hover:text-white transition-all uppercase"
                  >
                     SCAN
                  </button>
               </div>

               <div class="space-y-2 max-h-[150px] overflow-y-auto win-scroll">
                  <For each={activeSingleImos()}>{(imo) => (
                     <div class="p-2 border border-red-500/30 bg-red-500/5 flex items-center justify-between group">
                        <div class="flex flex-col gap-0.5 overflow-hidden">
                           <span class="text-[6px] text-red-500/60 font-black tracking-widest uppercase">LOCKED_IN_GRID</span>
                           <span class="text-[9px] text-red-500 font-mono font-black truncate">IMO: {imo}</span>
                        </div>
                        <button onClick={() => removeSingleImo(imo)} class="text-red-500/40 hover:text-red-500 transition-colors">
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                     </div>
                  )}</For>
               </div>
            </div>

            <div class="p-4 border-b border-[#00f2ff]/10 bg-white/2 space-y-4">
               <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                     <div class="w-2 h-2 bg-[#00f2ff] animate-pulse"></div>
                     <span class="text-[9px] font-black tracking-widest text-[#00f2ff] uppercase">REGION MONITOR</span>
                  </div>
                  <span class="text-[8px] text-white/40">{selectedIds().length}/9 SELECTED</span>
               </div>

               <input
                  type="text"
                  placeholder="FILTER LOCATIONS..."
                  onInput={(e) => setRegionSearchTerm(e.target.value)}
                  class="w-full bg-black/40 border border-white/10 px-3 py-2 text-[10px] text-white outline-none focus:border-[#00f2ff] transition-all"
               />
            </div>

            <div class="flex-1 overflow-y-auto win-scroll p-2 space-y-4">
               <For each={categories()}>{(cat) => (
                  <div class="space-y-1">
                     <span class="text-[7px] font-black text-white/20 px-2 uppercase tracking-widest">{cat.replace('_', ' ')}</span>
                     <div class="space-y-0.5">
                        <For each={filteredLocations().filter(l => l.category === cat)}>{(loc) => (
                           <button
                              onClick={() => toggleLocation(loc.id)}
                              class={`w-full p-2 text-left text-[9px] transition-all border-l-2 ${selectedIds().includes(loc.id) ? 'bg-[#00f2ff]/5 border-[#00f2ff] text-white' : 'border-transparent text-white/40 hover:bg-white/5 hover:text-white'}`}
                           >
                              <div class="flex justify-between items-center">
                                 <span class="truncate pr-2 uppercase font-black">{loc.name}</span>
                                 <Show when={selectedIds().includes(loc.id)}>
                                    <span class="text-[7px] text-[#00f2ff] font-black tracking-tighter">ACTIVE</span>
                                 </Show>
                              </div>
                           </button>
                        )}</For>
                     </div>
                  </div>
               )}</For>
            </div>
         </div>

         {/* Main Grid View */}
         <div class="flex-1 flex flex-col relative overflow-hidden bg-black">

            {/* Toolbar */}
            <div class="h-8 border-b border-[#00f2ff]/10 bg-[#0b0c10] flex items-center justify-between px-4 shrink-0">
               <div class="flex items-center gap-4">
                  <button
                     onClick={() => setIsSidebarOpen(!isSidebarOpen())}
                     class="text-white/40 hover:text-[#00f2ff] transition-colors"
                  >
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
                  </button>
                  <div class="flex items-center gap-2">
                     <span class="text-[8px] font-black text-white tracking-[0.4em] uppercase">GRID MONITORING SYSTEM</span>
                  </div>
               </div>

               <div class="flex gap-4 items-center">
                  <button
                     onClick={clearAllPanels}
                     class="text-[8px] font-black text-red-500 hover:underline uppercase tracking-widest"
                  >
                     WIPE ALL TERMINALS
                  </button>
                  <button
                     onClick={() => { const current = selectedIds(); setSelectedIds([]); setTimeout(() => setSelectedIds(current), 100); }}
                     class="text-[8px] font-black text-[#00f2ff] hover:underline uppercase tracking-widest"
                  >
                     RE-SYNC GRID
                  </button>
               </div>
            </div>

            {/* The Grid */}
            <div class="flex-1 p-2 bg-[#06070a] overflow-y-auto win-scroll relative">
               <div class={`grid gap-2 h-full w-full ${gridPanels().length <= 1 ? 'grid-cols-1' : gridPanels().length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  <For each={gridPanels()}>{(panel) => (
                     <div class={`relative bg-black border flex flex-col group transition-all min-h-[300px] ${panel.panelType === 'SOLO' ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/5 hover:border-[#00f2ff]/30'}`}>

                        {/* Panel Header */}
                        <div class={`h-6 border-b flex items-center justify-between px-3 shrink-0 z-10 ${panel.panelType === 'SOLO' ? 'bg-red-500/20 border-red-500/20' : 'bg-black/80 border-white/5'}`}>
                           <div class="flex items-center gap-2 overflow-hidden">
                              <div class={`w-1 h-1 rounded-full animate-ping ${panel.panelType === 'SOLO' ? 'bg-red-500' : 'bg-[#00f2ff]'}`}></div>
                              <span class={`text-[8px] font-black truncate uppercase tracking-widest ${panel.panelType === 'SOLO' ? 'text-red-500' : 'text-white/60'}`}>
                                 {panel.name}
                              </span>
                           </div>
                           <button
                              onClick={() => {
                                 if (panel.panelType === 'REGION') toggleLocation(panel.id);
                                 else removeSingleImo(panel.imo);
                              }}
                              class="text-white/20 hover:text-red-500 transition-colors"
                           >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                           </button>
                        </div>

                        {/* IFrame Area */}
                        <div class="flex-1 relative overflow-hidden bg-black">
                           <Show
                              when={panel.panelType === 'REGION'}
                              fallback={
                                 <iframe
                                    src={`https://www.vesselfinder.com/aismap?zoom=6&names=true&show_track=true&imo=${panel.imo}&track=true&fleet=false&description=false&search=false`}
                                    class="w-full h-full border-0 transition-all pointer-events-auto"
                                    title={panel.name}
                                 />
                              }
                           >
                              <iframe
                                 src={`https://www.vesselfinder.com/aismap?zoom=10&lat=${panel.lat}&lon=${panel.lon}&targetmmsi=0&track=false&fleet=false&fleet_id=&vno=0&nm=true&tm=false&mmsi=0&imo=0&names=true&click_to_activate=false&skin=0&psize=0&description=true&search=true&vessels=true`}
                                 class="w-full h-full border-0 transition-all pointer-events-auto"
                                 title={panel.name}
                              />
                           </Show>
                        </div>
                     </div>
                  )}</For>
               </div>
            </div>
         </div>
      </div>
   );
}
