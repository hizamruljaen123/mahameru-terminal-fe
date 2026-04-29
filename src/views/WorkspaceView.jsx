import { createSignal, Show, For } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Dynamic } from 'solid-js/web';
import EntityChartModule from '../modules/workspace/EntityChartModule';
import EntityDataModule from '../modules/workspace/EntityDataModule';
import LiveCryptoModule from '../modules/workspace/LiveCryptoModule';
import LiveNewsModule from '../modules/workspace/LiveNewsModule';
import GNewsScraperModule from '../modules/workspace/GNewsScraperModule';
import WorkspaceTechnicalAnalysisModule from '../modules/workspace/WorkspaceTechnicalAnalysisModule';
import TVStreamModule from '../modules/workspace/TVStreamModule';
import DeepAnalyticsModule from '../modules/workspace/DeepAnalyticsModule';

export default function WorkspaceView() {
  const [hasWorkspace, setHasWorkspace] = createSignal(false);
  const [showAddMenu, setShowAddMenu] = createSignal(false);
  const [tabs, setTabs] = createSignal([
    { id: 'tab-1', name: 'WORKSPACE 1' }
  ]);
  const [activeTabId, setActiveTabId] = createSignal('tab-1');
  const [editingTabId, setEditingTabId] = createSignal(null);
  const [tempTabName, setTempTabName] = createSignal('');
  const [tabsModules, setTabsModules] = createStore({
    'tab-1': []
  });

  const modules = () => tabsModules[activeTabId()] || [];
  const setModules = (...args) => setTabsModules(activeTabId(), ...args);

  const addTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab = { id: newId, name: `WORKSPACE ${tabs().length + 1}` };
    setTabs([...tabs(), newTab]);
    setTabsModules(newId, []);
    setActiveTabId(newId);
  };

  const removeTab = (id) => {
    if (tabs().length <= 1) return;
    const remaining = tabs().filter(t => t.id !== id);
    setTabs(remaining);
    
    if (activeTabId() === id) {
      setActiveTabId(remaining[0].id);
    }
    setTabsModules(id, undefined);
  };

  const [showDataMenu, setShowDataMenu] = createSignal(false);
  const [loadMode, setLoadMode] = createSignal(null);
  let fileInputRef;

  const saveFile = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveTab = () => {
    const activeTab = tabs().find(t => t.id === activeTabId());
    const tabName = activeTab ? activeTab.name : 'Tab';
    const data = {
      type: 'mahameru_tab',
      name: tabName,
      modules: tabsModules[activeTabId()] || []
    };
    saveFile(`${tabName.toLowerCase().replace(/\s+/g, '_')}.tab`, data);
    setShowDataMenu(false);
  };

  const handleSaveWorkspace = () => {
    const data = {
      type: 'mahameru_workspace',
      tabs: tabs(),
      tabsModules: { ...tabsModules }
    };
    saveFile(`workspace_${Date.now()}.mws`, data);
    setShowDataMenu(false);
  };

  const triggerLoadTab = () => {
    setLoadMode('tab');
    fileInputRef?.click();
    setShowDataMenu(false);
  };

  const triggerLoadWorkspace = () => {
    setLoadMode('workspace');
    fileInputRef?.click();
    setShowDataMenu(false);
  };

  const handleFileLoad = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        if (data.type === 'mahameru_tab' || data.modules) {
          const newId = `tab-${Date.now()}`;
          const newTab = { id: newId, name: data.name || `LOADED TAB` };
          setTabs([...tabs(), newTab]);
          setTabsModules(newId, data.modules || []);
          setActiveTabId(newId);
        } else if (data.type === 'mahameru_workspace' || data.tabs) {
          if (data.tabs && data.tabsModules) {
            setTabs(data.tabs);
            Object.keys(tabsModules).forEach(k => setTabsModules(k, undefined));
            Object.entries(data.tabsModules).forEach(([k, v]) => {
              if (v) setTabsModules(k, v);
            });
            if (data.tabs.length > 0) {
              setActiveTabId(data.tabs[0].id);
            }
            setHasWorkspace(true);
          }
        } else {
          alert('Invalid file format.');
        }
      } catch (err) {
        alert('Failed to parse file: ' + err.message);
      }
      e.target.value = null;
    };
    reader.readAsText(file);
  };

  let canvasRef;

  const MODULE_CATEGORIES = [
    {
      group: 'Data & Charts',
      items: [
        { id: 'chart-intraday', label: 'Entity Chart (Intraday)', icon: 'M13 10V3L4 14h7v7l9-11h-7z', component: EntityChartModule, props: { initialInterval: 'INTRADAY' }, w: 6, h: 20 },
        { id: 'chart-historical', label: 'Entity Chart (Historical)', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', component: EntityChartModule, props: { initialInterval: 'HISTORICAL' }, w: 6, h: 20 },
        { id: 'data-intraday', label: 'Entity Table (Intraday)', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', component: EntityDataModule, props: { initialInterval: 'INTRADAY' }, w: 6, h: 20 },
        { id: 'data-historical', label: 'Entity Table (Historical)', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', component: EntityDataModule, props: { initialInterval: 'HISTORICAL' }, w: 6, h: 20 },
      ]
    },
    {
      group: 'Analytics & Tools',
      items: [
        { id: 'technical', label: 'Entity Technical Analysis', icon: 'M21 12l-9-9-9 9M12 3v18', component: WorkspaceTechnicalAnalysisModule, w: 6, h: 20 },
        { id: 'deep-ta', label: 'Advanced Deep Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', component: DeepAnalyticsModule, w: 8, h: 25 },
      ]
    },
    {
      group: 'Feeds & Streams',
      items: [
        { id: 'live-crypto', label: 'Live Crypto Module', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', component: LiveCryptoModule, w: 6, h: 20 },
        { id: 'live-news', label: 'Live News Module', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2zM14 4v4h4', component: LiveNewsModule, w: 4, h: 15 },
        { id: 'gnews-scraper', label: 'GNews Rotation Engine', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', component: GNewsScraperModule, w: 4, h: 15 },
        { id: 'tv-stream', label: 'TV & Video Stream', icon: 'M15 10l5-5v14l-5-5H5a2 2 0 01-2-2V12a2 2 0 012-2h10z', component: TVStreamModule, w: 6, h: 18 },
      ]
    }
  ];

  const MODULE_TYPES = MODULE_CATEGORIES.flatMap(cat => cat.items);

  const findEmptySpot = (w, h, currentModules = modules()) => {
    let y = 0;
    while (true) {
      for (let x = 0; x <= 12 - w; x++) {
        const collision = currentModules.find(m => {
          const xOverlap = (x < m.x + m.w) && (x + w > m.x);
          const yOverlap = (y < m.y + m.h) && (y + h > m.y);
          return xOverlap && yOverlap;
        });
        if (!collision) return { x, y };
      }
      y++;
      if (y > 1000) return { x: 0, y: 0 }; 
    }
  };

  const autoArrange = () => {
    const sorted = [...modules()].sort((a, b) => {
      if (Math.abs(a.y - b.y) < 10) return a.x - b.x;
      return a.y - b.y;
    });
    
    let placed = [];
    for (const mod of sorted) {
      const spot = findEmptySpot(mod.w, mod.h, placed);
      placed.push({ ...mod, x: spot.x, y: spot.y });
    }
    
    placed.forEach(p => {
      setModules(m => m.instanceId === p.instanceId, { x: p.x, y: p.y });
    });
  };

  const addModule = (type) => {
    const spot = findEmptySpot(type.w, type.h);
    setModules([...modules(), { 
      ...type, 
      instanceId: Date.now(), 
      x: spot.x,
      y: spot.y,
      w: type.w, 
      h: type.h 
    }]);
    setShowAddMenu(false);
  };

  const removeModule = (instanceId) => {
    setModules(modules().filter(m => m.instanceId !== instanceId));
  };

  // Dragging & Resizing state
  const [draggedModule, setDraggedModule] = createSignal(null);
  const [resizingModule, setResizingModule] = createSignal(null);
  const [ghostPos, setGhostPos] = createSignal(null);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });

  const onResizeStart = (e, mod, direction) => {
    e.preventDefault();
    e.stopPropagation();
    
    setResizingModule({
      id: mod.instanceId,
      startX: e.clientX,
      startY: e.clientY,
      startW: mod.w,
      startH: mod.h,
      startX_pos: mod.x,
      startY_pos: mod.y,
      direction: direction,
      mod: mod
    });
    setGhostPos({ x: mod.x, y: mod.y, w: mod.w, h: mod.h });
  };

  const onDragStart = (e, mod) => {
    if (!e.target.closest('.drag-handle')) return;
    if (e.target.closest('button') || e.target.closest('input')) return;
    
    if (canvasRef) {
      const rect = canvasRef.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top + canvasRef.scrollTop;
      
      const colWidth = rect.width / 12;
      const rowHeight = 20;
      
      const modulePixelX = mod.x * colWidth;
      const modulePixelY = mod.y * rowHeight;
      
      setDragOffset({
        x: mouseX - modulePixelX,
        y: mouseY - modulePixelY
      });
    }

    setDraggedModule(mod);
    setGhostPos({ x: mod.x, y: mod.y, w: mod.w, h: mod.h });
  };

  const onMouseMove = (e) => {
    if (!canvasRef) return;

    const rect = canvasRef.getBoundingClientRect();
    const colWidth = rect.width / 12;
    const rowHeight = 20; // 20px per grid unit height to match background grid

    const resMod = resizingModule();
    if (resMod) {
      const deltaX = e.clientX - resMod.startX;
      const deltaY = e.clientY - resMod.startY;

      const deltaGridX = Math.round(deltaX / colWidth);
      const deltaGridY = Math.round(deltaY / rowHeight);

      let newX = resMod.startX_pos;
      let newY = resMod.startY_pos;
      let newW = resMod.startW;
      let newH = resMod.startH;

      if (resMod.direction.includes('e')) {
        newW = Math.max(2, Math.min(12 - resMod.startX_pos, resMod.startW + deltaGridX));
      }
      if (resMod.direction.includes('w')) {
        const maxDeltaX = resMod.startW - 2;
        const actualDeltaX = Math.max(-resMod.startX_pos, Math.min(maxDeltaX, deltaGridX));
        newX = resMod.startX_pos + actualDeltaX;
        newW = resMod.startW - actualDeltaX;
      }
      if (resMod.direction.includes('s')) {
        newH = Math.max(5, resMod.startH + deltaGridY);
      }
      if (resMod.direction.includes('n')) {
        const maxDeltaY = resMod.startH - 5;
        const actualDeltaY = Math.max(-resMod.startY_pos, Math.min(maxDeltaY, deltaGridY));
        newY = resMod.startY_pos + actualDeltaY;
        newH = resMod.startH - actualDeltaY;
      }

      setGhostPos({ x: newX, y: newY, w: newW, h: newH });
      return;
    }

    const mod = draggedModule();
    if (mod) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top + canvasRef.scrollTop;
      
      const offset = dragOffset();
      const targetX = mouseX - offset.x;
      const targetY = mouseY - offset.y;

      const newX = Math.max(0, Math.min(12 - mod.w, Math.round(targetX / colWidth)));
      const newY = Math.max(0, Math.round(targetY / rowHeight));

      setGhostPos({ x: newX, y: newY, w: mod.w, h: mod.h });
    }
  };

  const onMouseUp = () => {
    const resMod = resizingModule();
    if (resMod && ghostPos()) {
      const ghost = ghostPos();
      setModules(m => m.instanceId === resMod.id, { x: ghost.x, y: ghost.y, w: ghost.w, h: ghost.h });
      setResizingModule(null);
      setGhostPos(null);
      return;
    }

    const mod = draggedModule();
    const ghost = ghostPos();
    if (mod && ghost) {
      setModules(m => m.instanceId === mod.instanceId, { x: ghost.x, y: ghost.y });
    }
    setDraggedModule(null);
    setGhostPos(null);
  };

  return (
    <div class="flex-1 bg-[#080808] flex flex-col relative overflow-hidden font-mono"
         onMouseMove={onMouseMove}
         onMouseUp={onMouseUp}
         onMouseLeave={onMouseUp}>
      {/* Subtle Grid Pattern */}
      <div class="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ "background-image": "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", "background-size": "20px 20px" }}>
      </div>

      <Show when={!hasWorkspace()}>
        {/* Minimalist Welcome Screen */}
        <div class="flex-1 flex flex-col items-center justify-center z-10 px-4">
          <div class="w-full max-w-sm">
            
            <div class="flex items-center gap-3 mb-8 opacity-60">
              <div class="w-1.5 h-4 bg-text_accent"></div>
              <h1 class="text-[11px] font-black tracking-[0.4em] text-text_primary uppercase">
                Initialize Workspace
              </h1>
            </div>

            <div class="flex flex-col gap-2">
              <button 
                onClick={() => setHasWorkspace(true)}
                class="group flex items-center justify-between p-4 bg-[#111]/50 border border-white/5 hover:border-text_accent/40 transition-all duration-200"
              >
                <div class="flex flex-col items-start gap-1">
                  <span class="text-[10px] font-black text-text_primary uppercase tracking-wider group-hover:text-text_accent transition-colors">01. New Environment</span>
                  <span class="text-[8px] text-text_secondary/40 uppercase tracking-tight">Create a clean analysis session</span>
                </div>
                <svg class="w-4 h-4 text-text_secondary/20 group-hover:text-text_accent/40 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>

              <button 
                onClick={triggerLoadWorkspace}
                class="group flex items-center justify-between p-4 bg-[#111]/50 border border-white/5 hover:border-text_accent/40 transition-all duration-200"
              >
                <div class="flex flex-col items-start gap-1">
                  <span class="text-[10px] font-black text-text_primary uppercase tracking-wider group-hover:text-text_accent transition-colors">02. Load Configuration</span>
                  <span class="text-[8px] text-text_secondary/40 uppercase tracking-tight">Restore from local .mws file</span>
                </div>
                <svg class="w-4 h-4 text-text_secondary/20 group-hover:text-text_accent/40 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              </button>
            </div>

            <div class="mt-12 flex items-center justify-between opacity-20">
              <span class="text-[7px] tracking-[0.2em] uppercase font-bold">Protocol v4.0.2</span>
              <div class="flex gap-1">
                <div class="w-1 h-1 rounded-full bg-text_accent"></div>
                <div class="w-1 h-1 rounded-full bg-text_accent/50"></div>
                <div class="w-1 h-1 rounded-full bg-text_accent/20"></div>
              </div>
            </div>
          </div>
        </div>
      </Show>

      <Show when={hasWorkspace()}>
        <div class="flex-1 flex flex-col p-4 z-10 overflow-hidden">
          {/* Active Workspace Header */}
          <div class="flex items-center justify-between border-b border-white/5 pb-2 mb-4 relative shrink-0">
            <div class="flex items-center gap-6 flex-1 mr-4">
              {/* Action Buttons */}
              <div class="flex items-center gap-2 shrink-0">
                {/* Save/Load Session Dropdown (Menu) */}
                <div class="relative">
                  <button 
                    onClick={() => setShowDataMenu(!showDataMenu())}
                    class={`flex items-center gap-2 px-3 py-1 rounded-sm border transition-all duration-200 ${showDataMenu() ? 'bg-text_accent text-black border-text_accent' : 'bg-white/5 border-white/10 text-text_secondary hover:border-text_accent/50 hover:text-text_primary'}`}
                  >
                    <svg class="w-3.5 h-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <span class="text-[9px] font-black uppercase tracking-tighter">Menu</span>
                  </button>

                  <Show when={showDataMenu()}>
                    <div class="absolute top-full left-0 mt-2 w-48 bg-[#0f0f0f] border border-white/10 shadow-2xl z-[100] py-1 font-mono">
                      <div class="px-3 py-1.5 border-b border-white/5 text-[7px] font-black text-text_accent tracking-widest uppercase opacity-40">Workspace Tools</div>
                      <button 
                        onClick={() => { autoArrange(); setShowDataMenu(false); }}
                        class="w-full flex items-center gap-2 px-3 py-2 hover:bg-text_accent hover:text-black transition-colors text-left"
                      >
                        <span class="text-[9px] font-bold tracking-wider uppercase">🧩 Auto Arrange</span>
                      </button>

                      <div class="px-3 py-1.5 border-t border-b border-white/5 text-[7px] font-black text-text_accent tracking-widest uppercase opacity-40 mt-1">Save Session</div>
                      <button 
                        onClick={handleSaveTab}
                        class="w-full flex items-center gap-2 px-3 py-2 hover:bg-text_accent hover:text-black transition-colors text-left"
                      >
                        <span class="text-[9px] font-bold tracking-wider uppercase">💾 Save Active Tab</span>
                      </button>
                      <button 
                        onClick={handleSaveWorkspace}
                        class="w-full flex items-center gap-2 px-3 py-2 hover:bg-text_accent hover:text-black transition-colors text-left"
                      >
                        <span class="text-[9px] font-bold tracking-wider uppercase">📂 Save Workspace</span>
                      </button>

                      <div class="px-3 py-1.5 border-t border-b border-white/5 text-[7px] font-black text-text_accent tracking-widest uppercase opacity-40 mt-1">Load Session</div>
                      <button 
                        onClick={triggerLoadTab}
                        class="w-full flex items-center gap-2 px-3 py-2 hover:bg-text_accent hover:text-black transition-colors text-left"
                      >
                        <span class="text-[9px] font-bold tracking-wider uppercase">📥 Load Tab</span>
                      </button>
                      <button 
                        onClick={triggerLoadWorkspace}
                        class="w-full flex items-center gap-2 px-3 py-2 hover:bg-text_accent hover:text-black transition-colors text-left"
                      >
                        <span class="text-[9px] font-bold tracking-wider uppercase">📤 Load Workspace</span>
                      </button>

                      <div class="px-3 py-1.5 border-t border-b border-white/5 text-[7px] font-black text-red-500/70 tracking-widest uppercase mt-1">Danger Zone</div>
                      <button 
                        onClick={() => { 
                          setHasWorkspace(false); 
                          setTabs([{ id: 'tab-1', name: 'WORKSPACE 1' }]);
                          setActiveTabId('tab-1');
                          setTabsModules({ 'tab-1': [] });
                          setShowDataMenu(false);
                        }}
                        class="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500 hover:text-stone-950 transition-colors text-left group"
                      >
                        <span class="text-[9px] font-bold tracking-wider uppercase text-red-500 group-hover:text-stone-950">⚠️ Terminate Session</span>
                      </button>
                    </div>
                  </Show>
                </div>

                {/* Add Module Button */}
                <div class="relative">
                  <button 
                    onClick={() => setShowAddMenu(!showAddMenu())}
                    class={`flex items-center gap-2 px-3 py-1 rounded-sm border transition-all duration-200 ${showAddMenu() ? 'bg-text_accent text-black border-text_accent' : 'bg-white/5 border-white/10 text-text_secondary hover:border-text_accent/50 hover:text-text_primary'}`}
                  >
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <path d={showAddMenu() ? "M6 18L18 6M6 6l12 12" : "M12 5v14M5 12h14"} />
                    </svg>
                    <span class="text-[9px] font-black uppercase tracking-tighter">Add Module</span>
                  </button>

                  {/* Dropdown Menu */}
                  <Show when={showAddMenu()}>
                    <div class="absolute top-full left-0 mt-2 w-56 bg-[#0f0f0f] border border-white/10 shadow-2xl z-[100] py-1">
                      <For each={MODULE_CATEGORIES}>
                        {(category) => (
                          <>
                            <div class="px-4 py-1.5 border-b border-white/5 text-[7px] font-black text-text_accent tracking-widest uppercase opacity-40 mt-2 first:mt-0">
                              {category.group}
                            </div>
                            <For each={category.items}>
                              {(item) => (
                                <button 
                                  onClick={() => { addModule(item); setShowAddMenu(false); }}
                                  class="w-full flex items-center gap-3 px-4 py-2 hover:bg-text_accent hover:text-black transition-colors group text-left font-mono"
                                >
                                  <svg class="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d={item.icon} />
                                  </svg>
                                  <span class="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
                                </button>
                              )}
                            </For>
                          </>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div class="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 win-scroll">
                <For each={tabs()}>
                  {(tab) => (
                    <div class={`flex items-center gap-1.5 border-b-2 px-3 py-1 transition-all duration-200 ${activeTabId() === tab.id ? 'border-text_accent bg-white/5' : 'border-transparent hover:bg-white/[0.02]'}`}>
                      <Show when={editingTabId() === tab.id} fallback={
                        <span 
                          onClick={() => {
                            if (activeTabId() === tab.id) {
                              setTempTabName(tab.name);
                              setEditingTabId(tab.id);
                            } else {
                              setActiveTabId(tab.id);
                            }
                          }}
                          class={`text-[9px] font-black uppercase tracking-widest cursor-pointer whitespace-nowrap ${activeTabId() === tab.id ? 'text-text_accent' : 'text-text_secondary/40 hover:text-text_secondary'}`}
                        >
                          {tab.name}
                        </span>
                      }>
                        <input 
                          type="text" 
                          value={tempTabName()} 
                          onInput={(e) => setTempTabName(e.target.value)}
                          onBlur={() => {
                            if (tempTabName().trim()) {
                              setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, name: tempTabName().trim() } : t));
                            }
                            setEditingTabId(null);
                          }}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') {
                              if (tempTabName().trim()) {
                                setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, name: tempTabName().trim() } : t));
                              }
                              setEditingTabId(null);
                            } 
                          }}
                          class="bg-black/40 border border-text_accent/20 px-1 py-0.5 text-[9px] text-text_accent uppercase font-mono outline-none rounded-sm w-24"
                          autofocus
                        />
                      </Show>

                      <Show when={tabs().length > 1}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTab(tab.id);
                          }}
                          class="text-text_secondary/20 hover:text-red-500 transition-colors text-[10px] font-black leading-none px-1"
                          title="Delete Tab"
                        >
                          &times;
                        </button>
                      </Show>
                    </div>
                  )}
                </For>

                <button 
                  onClick={addTab}
                  class="flex items-center justify-center w-5 h-5 ml-1 rounded-sm border border-dashed border-white/10 hover:border-text_accent/50 text-text_secondary/40 hover:text-text_accent transition-all text-[11px] font-black"
                  title="Add New Tab"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          
          {/* Module Canvas */}
          <div class="flex-1 overflow-y-auto win-scroll pr-2 pb-10 relative" ref={canvasRef}>
            <Show when={modules().length === 0} fallback={
              <div class="relative w-full" style={{ "height": `${Math.max(...modules().map(m => m.y + m.h), 40) * 20}px` }}>
                
                {/* Ghost Placeholder */}
                <Show when={ghostPos()}>
                  <div 
                    class="absolute bg-text_accent/5 border border-dashed border-text_accent/30 transition-all duration-75 z-0 rounded-sm"
                    style={{
                      left: `${(ghostPos().x / 12) * 100}%`,
                      top: `${ghostPos().y * 20}px`,
                      width: `${(ghostPos().w / 12) * 100}%`,
                      height: `${ghostPos().h * 20}px`,
                      padding: "5px"
                    }}
                  >
                     <div class="w-full h-full border border-dashed border-text_accent/20 rounded-sm"></div>
                  </div>
                </Show>

                <For each={modules()}>
                  {(mod) => (
                    <div 
                      data-instance-id={mod.instanceId}
                      onMouseDown={(e) => onDragStart(e, mod)}
                      class={`absolute transition-all duration-300 ${(draggedModule()?.instanceId === mod.instanceId || resizingModule()?.id === mod.instanceId) ? 'z-50 opacity-80 scale-[1.02] shadow-2xl pointer-events-none' : 'z-10'}`}
                      style={{
                        left: `${(mod.x / 12) * 100}%`,
                        top: `${mod.y * 20}px`,
                        width: `${(mod.w / 12) * 100}%`,
                        height: `${mod.h * 20}px`,
                        padding: '5px'
                      }}
                    >
                       <Show when={mod.component} fallback={
                          <div class="h-full bg-[#111] border border-white/5 flex flex-col items-center justify-center gap-4 opacity-20">
                             <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d={mod.icon} /></svg>
                             <span class="text-[9px] font-black uppercase tracking-[0.2em]">{mod.label} Under Construction</span>
                          </div>
                       }>
                          {/* Render Dynamic Module Component */}
                          <div class="relative group/mod h-full" style={{ "overflow": "hidden" }}>
                             <Dynamic component={mod.component} instanceId={mod.instanceId} onRemove={removeModule} {...(mod.props || {})} />
                             
                             {/* Resize Handles */}
                             {/* N */}
                             <div onMouseDown={(e) => onResizeStart(e, mod, 'n')} class="absolute top-0 left-0 right-0 h-1.5 cursor-n-resize pointer-events-auto z-50 hover:bg-text_accent/30 transition-colors"></div>
                             {/* S */}
                             <div onMouseDown={(e) => onResizeStart(e, mod, 's')} class="absolute bottom-0 left-0 right-0 h-1.5 cursor-s-resize pointer-events-auto z-50 hover:bg-text_accent/30 transition-colors"></div>
                             {/* E */}
                             <div onMouseDown={(e) => onResizeStart(e, mod, 'e')} class="absolute top-0 bottom-0 right-0 w-1.5 cursor-e-resize pointer-events-auto z-50 hover:bg-text_accent/30 transition-colors"></div>
                             {/* W */}
                             <div onMouseDown={(e) => onResizeStart(e, mod, 'w')} class="absolute top-0 bottom-0 left-0 w-1.5 cursor-w-resize pointer-events-auto z-50 hover:bg-text_accent/30 transition-colors"></div>
                             
                             {/* NW */}
                             <div onMouseDown={(e) => onResizeStart(e, mod, 'nw')} class="absolute top-0 left-0 w-3 h-3 cursor-nw-resize pointer-events-auto z-50"></div>
                             {/* NE */}
                             <div onMouseDown={(e) => onResizeStart(e, mod, 'ne')} class="absolute top-0 right-0 w-3 h-3 cursor-ne-resize pointer-events-auto z-50"></div>
                             {/* SW */}
                             <div onMouseDown={(e) => onResizeStart(e, mod, 'sw')} class="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize pointer-events-auto z-50"></div>
                             {/* SE */}
                             <div 
                               onMouseDown={(e) => onResizeStart(e, mod, 'se')}
                               class="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end opacity-20 group-hover/mod:opacity-100 transition-opacity z-50 pointer-events-auto pb-1 pr-1"
                             >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="text-text_accent w-2 h-2">
                                   <path d="M21 15L15 21M21 8L8 21" />
                                </svg>
                             </div>
                          </div>
                       </Show>
                    </div>
                  )}
                </For>
              </div>
            }>
              <div class="h-full flex flex-col items-center justify-center opacity-10">
                <span class="text-[9px] tracking-[0.5em] uppercase font-black">Ready for module deployment</span>
              </div>
            </Show>
          </div>
        </div>
      </Show>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileLoad} 
        style={{ display: "none" }} 
        accept=".tab,.mws,application/json"
      />
    </div>
  );
}
