import { createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { useCorrelation } from './hooks/useCorrelation';
import EntityNode from './components/EntityNode';
import Toolbar from './components/Toolbar';
import EntityModal from './components/EntityModal';
import ModuleToolbar from './components/ModuleToolbar';
import RelationshipLines from './components/RelationshipLines';
import CalendarPanel from './components/CalendarPanel';
const EntityCorrelationView = () => {
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [scale, setScale] = createSignal(1);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });
  
  const [isAltPressed, setIsAltPressed] = createSignal(false);
  const [connectionSourceId, setConnectionSourceId] = createSignal(null);
  const [showCalendar, setShowCalendar] = createSignal(false);

  const [projectName, setProjectName] = createSignal('Untitled Project');
  const [lastSaved, setLastSaved] = createSignal(null);

  const {
    nodes,
    links,
    addLink,
    removeLink,
    loading,
    results,
    query,
    setQuery,
    searchEntities,
    addNode,
    addManualNode,
    addNewsNode,
    addManagementNodes,
    addChartNode,
    updateNodePosition,
    removeNewsFromNode,
    removeNode,
    fetchNodeNews,
    fetchNodeManagement,
    fetchNodeHistory,
    searchAirports,
    searchPorts,
    searchPowerPlants,
    searchIndustrialZones,
    searchTimezones,
    searchRefineries,
    fetchCompanyEvents,
    fetchGlobalCalendar,
    activeNodeId,
    setActiveNodeId,
    clearCanvas,
    loadProject,
  } = useCorrelation();

  const handleAddEntity = (entity) => {
    addNode(entity);
    setIsModalOpen(false);
  };

  const handleZoom = (delta) => {
    setScale(prev => Math.min(Math.max(prev + delta, 0.2), 3));
  };

  const resetViewport = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomToFit = () => {
    const activeNodes = nodes();
    if (activeNodes.length === 0) return resetViewport();

    // 1. Dapatkan Bounding Box dari semua node
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    activeNodes.forEach(n => {
      // Estimasi dimensi (Equity: 150, Mgmt: 220, News: 300)
      const w = n.type === 'NEWS_RESULT' ? 300 : (n.type === 'MANAGEMENT_NODE' ? 220 : 150);
      const h = n.type === 'NEWS_RESULT' ? 300 : 100;
      
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + w);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + h);
    });

    // 2. Tambahkan padding (50px)
    const padding = 100;
    const contentW = (maxX - minX) + padding;
    const contentH = (maxY - minY) + padding;
    
    const viewportW = window.innerWidth - 250; // Offset for sidebar
    const viewportH = window.innerHeight;

    // 3. Hitung skala terbaik
    const scaleW = viewportW / contentW;
    const scaleH = viewportH / contentH;
    const newScale = Math.min(Math.max(Math.min(scaleW, scaleH), 0.3), 1.2);

    // 4. Hitung offset tengah
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    setScale(newScale);
    setOffset({
      x: (viewportW / (2 * newScale)) - centerX + 125, // Adjusted for center
      y: (viewportH / (2 * newScale)) - centerY
    });
  };

  const panDirection = (dir) => {
    const step = 100 / scale(); // Menyesuaikan langkah dengan zoom
    setOffset(prev => {
      const newOffset = { ...prev };
      if (dir === 'up') newOffset.y += step;
      if (dir === 'down') newOffset.y -= step;
      if (dir === 'left') newOffset.x += step;
      if (dir === 'right') newOffset.x -= step;
      return newOffset;
    });
  };

  // Keyboard Support
  const handleKeyDown = (e) => {
    if (e.altKey) setIsAltPressed(true);
    if (activeNodeId()) return; // Jangan geser jika modal buka
    if (e.key === 'ArrowUp') panDirection('up');
    if (e.key === 'ArrowDown') panDirection('down');
    if (e.key === 'ArrowLeft') panDirection('left');
    if (e.key === 'ArrowRight') panDirection('right');
    if (e.key === '=' || e.key === '+') handleZoom(0.1);
    if (e.key === '-' || e.key === '_') handleZoom(-0.1);
  };

  const handleKeyUp = (e) => {
    if (!e.altKey) {
      setIsAltPressed(false);
      setConnectionSourceId(null);
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  });
  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  });

  const handleCanvasMouseDown = (e) => {
    // Only pan if clicking the background direct or grid
    if (isAltPressed()) return; // Don't pan if connecting
    if (e.target !== e.currentTarget && !e.target.classList.contains('absolute-inset-0')) return;
    
    const startX = e.clientX - offset().x;
    const startY = e.clientY - offset().y;

    const onMouseMove = (moveEvent) => {
      setOffset({
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleNodeClick = (id) => {
    if (isAltPressed()) {
      if (!connectionSourceId()) {
        setConnectionSourceId(id);
      } else {
        addLink(connectionSourceId(), id);
        // Chain connections
        setConnectionSourceId(id);
      }
    } else {
      setActiveNodeId(id);
    }
  };

  const handleNodeDoubleClick = (node) => {
    setActiveNodeId(node.id);
  };

  return (
    <div class="relative w-full h-full bg-[#0a0c10] overflow-hidden flex flex-col text-white">
      {/* Grid Pattern Background */}
      <div class="absolute inset-0 z-0 opacity-10" 
           style="background-image: radial-gradient(#1e293b 1px, transparent 1px); background-size: 30px 30px;">
      </div>

      <div 
        class="relative flex-1 z-10 overflow-hidden cursor-crosshair bg-[#050608]"
        onMouseDown={handleCanvasMouseDown}
      >
        <div 
          class="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${offset().x}px, ${offset().y}px) scale(${scale()})`,
            "transform-origin": "0 0"
          }}
        >
          {/* Relationship Lines Sub-Engine */}
          <RelationshipLines nodes={nodes} links={links} />

          <Show when={nodes().length === 0}>
            <div class="absolute inset-0 flex flex-col items-center justify-center opacity-20 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mb-4">
                <path d="M12 20v-8m0 0V4m0 8h8m-8 0H4"></path>
              </svg>
              <p class="text-[10px] tracking-[0.5em] font-black uppercase">Canvas Ready for Entity Mapping</p>
            </div>
          </Show>

          <div class="absolute inset-0 pointer-events-none">
            <For each={nodes()}>
              {(node) => (
                <EntityNode 
                  node={node} 
                  scale={scale()}
                  isActive={activeNodeId() === node.id}
                  isConnectionSource={connectionSourceId() === node.id}
                  onPositionChange={(pos) => updateNodePosition(node.id, pos.x, pos.y)}
                  onDelete={removeNode}
                  onNodeClick={() => handleNodeClick(node.id)}
                  onNodeDoubleClick={handleNodeDoubleClick}
                  onRemoveNews={removeNewsFromNode}
                />
              )}
            </For>
          </div>
        </div>

        {/* Navigation Overlay */}
        <div class="absolute bottom-10 right-10 z-50 flex flex-col gap-2 items-center">
          {/* D-PAD Pan Controls */}
          <div class="grid grid-cols-3 gap-1 mb-4">
            <div></div>
            <button onClick={() => panDirection('up')} class="w-8 h-8 bg-[#161b22] border border-white/10 rounded flex items-center justify-center text-white/40 hover:text-white transition-all">▲</button>
            <div></div>
            <button onClick={() => panDirection('left')} class="w-8 h-8 bg-[#161b22] border border-white/10 rounded flex items-center justify-center text-white/40 hover:text-white transition-all">◀</button>
            <button onClick={zoomToFit} class="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>
            </button>
            <button onClick={() => panDirection('right')} class="w-8 h-8 bg-[#161b22] border border-white/10 rounded flex items-center justify-center text-white/40 hover:text-white transition-all">▶</button>
            <div></div>
            <button onClick={() => panDirection('down')} class="w-8 h-8 bg-[#161b22] border border-white/10 rounded flex items-center justify-center text-white/40 hover:text-white transition-all">▼</button>
            <div></div>
          </div>

          <div class="flex flex-col gap-2">
            <button onClick={() => handleZoom(0.1)} class="w-10 h-10 bg-[#161b22] border border-white/10 rounded flex items-center justify-center text-white hover:bg-white/10 transition-all font-black text-lg">+</button>
            <div class="bg-[#161b22] border border-white/10 py-1 text-[8px] font-black text-center text-white/40 uppercase tabular-nums">
              {Math.round(scale() * 100)}%
            </div>
            <button onClick={() => handleZoom(-0.1)} class="w-10 h-10 bg-[#161b22] border border-white/10 rounded flex items-center justify-center text-white hover:bg-white/10 transition-all font-black text-lg">-</button>
            <button onClick={resetViewport} class="mt-2 w-10 h-10 bg-[#161b22] border border-white/10 rounded flex items-center justify-center text-blue-500 hover:bg-white/10 transition-all" title="Reset View">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Toolbar */}
      <Toolbar 
        onAddClick={() => setIsModalOpen(true)} 
        onClear={clearCanvas} 
        onCalendarToggle={() => setShowCalendar(!showCalendar())}
        projectName={projectName}
        setProjectName={setProjectName}
        lastSaved={lastSaved}
        setLastSaved={setLastSaved}
        nodes={nodes}
        links={links}
        onLoad={(data) => { loadProject(data); }}
        onNewProject={() => { clearCanvas(); setLastSaved(null); }}
      />

      {/* Search Modal */}
      <EntityModal 
        isOpen={isModalOpen()} 
        onClose={() => setIsModalOpen(false)}
        query={query()}
        setQuery={setQuery}
        results={results()}
        loading={loading()}
        onSearch={() => searchEntities(query())}
        onAdd={handleAddEntity}
        onAddManual={addManualNode}
        searchAirports={searchAirports}
        searchPorts={searchPorts}
        searchPowerPlants={searchPowerPlants}
        searchIndustrialZones={searchIndustrialZones}
        searchTimezones={searchTimezones}
        searchRefineries={searchRefineries}
        fetchCompanyEvents={fetchCompanyEvents}
      />

      <ModuleToolbar 
        isOpen={!!activeNodeId()} 
        canvasState={{ offset: offset(), scale: scale() }}
        node={nodes().find(n => n.id === activeNodeId())}
        onClose={() => setActiveNodeId(null)}
        onAddNewsCollection={(nodeId, keyword, newsData) => {
          addNewsNode(nodeId, keyword, newsData);
        }}
        onAddManagement={(nodeId, directors) => {
          addManagementNodes(nodeId, directors);
        }}
        onAddChartNode={(nodeId, symbol, history, period) => {
          addChartNode(nodeId, symbol, history, period);
        }}
        onAddManual={addManualNode}
        searchAirports={searchAirports}
        searchPorts={searchPorts}
        searchPowerPlants={searchPowerPlants}
        searchIndustrialZones={searchIndustrialZones}
        searchTimezones={searchTimezones}
        searchRefineries={searchRefineries}
        fetchCompanyEvents={fetchCompanyEvents}
      />


      <Show when={showCalendar()}>
        <CalendarPanel 
          fetchGlobalCalendar={fetchGlobalCalendar}
          onClose={() => setShowCalendar(false)}
          onPinEvent={(event) => {
            addManualNode('EMITENT_EVENT', { ...event });
            setShowCalendar(false);
          }}
        />
      </Show>

      {/* Legend / Status Overlay */}
      <div class="absolute top-4 left-4 z-40 flex flex-col gap-1 pointer-events-none">
        <div class="text-[10px] font-black text-black/40 tracking-[0.2em] uppercase">ENTITY_CANVAS_V2.0</div>
        <div class="text-[8px] text-black/20 font-bold uppercase tracking-widest">LAYER: GRAPH_ENGINE_MODULAR</div>
      </div>
    </div>
  );
};

export default EntityCorrelationView;
