import { Show, createSignal, For, onMount, createEffect, createMemo } from 'solid-js';
import NominatimSearch from './NominatimSearch';

const ModuleToolbar = (props) => {
  const [step, setStep] = createSignal('idle'); // 'idle', 'keyword', 'preview', 'mgmt_preview', 'chart_setup', 'manual_entry', 'airport_search', 'timezone_search', 'timezone_config'
  const [pos, setPos] = createSignal({ x: window.innerWidth / 2 - 150, y: window.innerHeight - 150 });

  const [localKeyword, setLocalKeyword] = createSignal("");
  const [previewNews, setPreviewNews] = createSignal([]);
  const [previewMgmt, setPreviewMgmt] = createSignal([]);
  const [selectedMgmt, setSelectedMgmt] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [selectedPeriod, setSelectedPeriod] = createSignal("1mo");

  const [manualType, setManualType] = createSignal("");
  const [eventMode, setEventMode] = createSignal('official'); // 'official' | 'manual'
  const [manualData, setManualData] = createSignal({});
  const [tzConfig, setTzConfig] = createSignal({
    mode: 'auto',
    customDate: new Date().toISOString().slice(0, 10),
    customTime: "12:00"
  });
  const [customSymbol, setCustomSymbol] = createSignal("");
  const [symbolResults, setSymbolResults] = createSignal([]);
  const [selectedTicker, setSelectedTicker] = createSignal(null);
  const [selectedEvents, setSelectedEvents] = createSignal([]);

  const periods = [
    { label: "1D", value: "1d" },
    { label: "1W", value: "5d" },
    { label: "1M", value: "1mo" },
    { label: "3M", value: "3mo" },
    { label: "6M", value: "6mo" },
    { label: "1Y", value: "1y" }
  ];

  const init = () => {
    setStep('idle');
    setLocalKeyword(props.node?.symbol || "");
    setCustomSymbol(props.node?.symbol || "");
    setPreviewNews([]);
    setPreviewMgmt([]);
    setSelectedMgmt([]);
    setSymbolResults([]);
    setManualType("");
    setManualData({});
    setTzConfig({
      mode: 'auto',
      customDate: new Date().toISOString().slice(0, 10),
      customTime: "12:00"
    });
  };

  const [isManuallyPositioned, setIsManuallyPositioned] = createSignal(false);

  createEffect(() => {
    if (!props.isOpen) {
      init();
      setIsManuallyPositioned(false);
    } else {
      setLocalKeyword(props.node?.symbol || "");
      setCustomSymbol(props.node?.symbol || "");

      // Auto Position above the node (only if not manually moved)
      if (props.node && props.canvasState && !isManuallyPositioned()) {
        const { offset, scale } = props.canvasState;
        const vx = props.node.x * scale + offset.x;
        const vy = props.node.y * scale + offset.y;

        setPos({
          x: vx + (110 * scale) - 160,
          y: vy - 70
        });
      }
    }
  });

  // Draggable Logic
  const handleDragStart = (e) => {
    setIsManuallyPositioned(true);
    const startX = e.clientX - pos().x;
    const startY = e.clientY - pos().y;

    const onMove = (me) => {
      setPos({ x: me.clientX - startX, y: me.clientY - startY });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleSearchSymbol = async () => {
    if (!customSymbol()) return;
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_ENTITY_CORRELATION_API}/api/correlation/search?q=${encodeURIComponent(customSymbol())}`);
      const res = await response.json();
      if (res.success) setSymbolResults(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChart = async () => {
    const symbol = customSymbol().toUpperCase() || props.node.symbol;
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_ENTITY_CORRELATION_API}/api/correlation/history/${encodeURIComponent(symbol)}?period=${selectedPeriod()}`);
      const res = await response.json();
      if (res.success) {
        props.onAddChartNode(props.node.id, symbol, res.data, selectedPeriod());
        init();
        props.onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchPreview = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_ENTITY_CORRELATION_API}/api/correlation/news/${encodeURIComponent(localKeyword())}`);
      const res = await response.json();
      if (res.success) {
        setPreviewNews(res.data || []);
        setStep('preview');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchManagement = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_ENTITY_CORRELATION_API}/api/correlation/management/${encodeURIComponent(props.node.symbol)}`);
      const res = await response.json();
      if (res.success) {
        setPreviewMgmt(res.data || []);
        setStep('mgmt_preview');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deployManual = () => {
    props.onAddManual(manualType(), manualData(), props.node.id);
    init();
    props.onClose();
  };

  const searchAirports = async () => {
    setLoading(true);
    const res = await props.searchAirports(manualData().q);
    setManualData({ ...manualData(), results: res });
    setLoading(false);
  };

  const searchPorts = async () => {
    setLoading(true);
    const res = await props.searchPorts(manualData().q);
    setManualData({ ...manualData(), results: res });
    setLoading(false);
  };

  const searchPowerPlants = async () => {
    setLoading(true);
    const res = await props.searchPowerPlants(manualData().q);
    setManualData({ ...manualData(), results: res });
    setLoading(false);
  };

  const searchIndustrialZones = async () => {
    setLoading(true);
    const res = await props.searchIndustrialZones(manualData().q);
    setManualData({ ...manualData(), results: res });
    setLoading(false);
  };

  const searchTimezones = async () => {
    setLoading(true);
    const res = await props.searchTimezones(manualData().q);
    setManualData({ ...manualData(), results: res });
    setLoading(false);
  };

  const searchRefineries = async () => {
    setLoading(true);
    const res = await props.searchRefineries(manualData().q);
    setManualData({ ...manualData(), results: res });
    setLoading(false);
  };

  const searchTickers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_MARKET_API}/api/market/search?query=${encodeURIComponent(manualData().q)}`);
      const res = await response.json();
      setManualData({ ...manualData(), tickerResults: res.results || [] });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchCalendarForTicker = async (symbol) => {
    setLoading(true);
    setSelectedTicker(symbol);
    const res = await props.fetchCompanyEvents(symbol);
    setManualData({ ...manualData(), calendarResults: res });
    setLoading(false);
  };

  const toggleEventSelection = (event) => {
    const key = `${event.type}-${event.date}`;
    const exists = selectedEvents().find(e => `${e.type}-${e.date}` === key);
    if (exists) {
      setSelectedEvents(prev => prev.filter(e => `${e.type}-${e.date}` !== key));
    } else {
      setSelectedEvents(prev => [...prev, event]);
    }
  };

  const deploySelectedEvents = () => {
    selectedEvents().forEach(event => {
      props.onAddManual('EMITENT_EVENT', { ...event }, props.node.id);
    });
    init();
    props.onClose();
  };

  const getStepTitle = () => {
    switch(step()) {
      case 'keyword': return 'NEWS_SCAN';
      case 'preview': return 'NEWS_RECON';
      case 'mgmt_preview': return 'MGMT_INTEL';
      case 'chart_setup': return 'QUANT_ANALYTICS';
      case 'manual_entry': return 'MANUAL_DEPT';
      case 'nominatim_search': return 'GEO_FINDER';
      case 'airport_search': return 'AVIATION_HUB';
      case 'port_search': return 'MARITIME_LINK';
      case 'power_search': return 'ENERGY_INFRA';
      case 'industry_search': return 'INDUS_ZONE';
      case 'oil_search': return 'OIL_ENERGY';
      case 'timezone_search': return 'GEO_AWARENESS';
      case 'market_events': return 'MARKET_CALENDAR';
      default: return '';
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed z-[100] flex flex-row items-start animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-none gap-3"
        style={{ left: `${pos().x}px`, top: `${pos().y}px` }}
      >
        {/* Categorized Toolbar Container */}
        <div class="flex flex-col p-3 bg-[#0d1117]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto ring-1 ring-white/10 w-[300px]">
          {/* Header with Drag Handle */}
          <div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <div
              onMouseDown={handleDragStart}
              class="flex items-center gap-2 cursor-grab active:cursor-grabbing"
            >
              <div class="flex flex-col gap-0.5">
                <div class="w-1 h-1 bg-blue-500 rounded-full"></div>
                <div class="w-1 h-1 bg-blue-500 rounded-full"></div>
              </div>
              <div class="flex items-center">
                <span class="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Link_Terminal</span>
                <Show when={step() !== 'idle'}>
                   <div class="w-px h-3 bg-white/10 mx-2"></div>
                   <span class="text-[9px] font-black text-blue-500 uppercase tracking-[0.1em]">{getStepTitle()}</span>
                </Show>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="text-white/20 hover:text-red-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>

          {/* Categories Grid */}
          <div class="space-y-4">
            {/* 1. CORE INTELLIGENCE */}
            <div>
              <div class="text-[7px] font-black text-blue-400/60 uppercase tracking-widest mb-1.5 ml-1">Core_Intelligence</div>
              <div class="grid grid-cols-4 gap-1">
                <ToolbarButton
                  active={step() === 'keyword' || step() === 'preview'}
                  onClick={() => { setLocalKeyword(props.node?.symbol || ""); setStep('keyword'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" /></svg>}
                  label="NEWS"
                  color="text-emerald-400"
                />
                <ToolbarButton
                  active={step() === 'mgmt_preview'}
                  onClick={handleFetchManagement}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                  label="MGMT"
                  loading={loading() && step() === 'idle'}
                  color="text-blue-400"
                />
                <ToolbarButton
                  active={step() === 'chart_setup'}
                  onClick={() => setStep('chart_setup')}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>}
                  label="MARKET"
                  color="text-orange-400"
                />
                <ToolbarButton
                  active={step() === 'market_events'}
                  onClick={() => { setManualData({ q: props.node?.symbol || "" }); setStep('market_events'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>}
                  label="EVENTS"
                  color="text-amber-400"
                />
              </div>
            </div>

            <div>
              <div class="text-[7px] font-black text-emerald-400/60 uppercase tracking-widest mb-1.5 ml-1">Entity_Registry</div>
              <div class="grid grid-cols-4 gap-1">
                <ToolbarButton
                  active={manualType() === 'USER'}
                  onClick={() => { setManualType('USER'); setStep('manual_entry'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                  label="USER"
                  color="text-blue-400"
                />
                <ToolbarButton
                  active={manualType() === 'COMPANY'}
                  onClick={() => { setManualType('COMPANY'); setStep('manual_entry'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="16" x="3" y="4" rx="2" /><path d="M13 8h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-6" /><path d="M13 12h8" /></svg>}
                  label="CORP"
                  color="text-emerald-400"
                />
                <ToolbarButton
                  active={manualType() === 'LOCATION'}
                  onClick={() => { setManualType('LOCATION'); setStep('manual_entry'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>}
                  label="LOC"
                  color="text-orange-400"
                />
                <ToolbarButton
                  active={manualType() === 'HYPERLINK'}
                  onClick={() => { setManualType('HYPERLINK'); setStep('manual_entry'); setManualData({ name: '', url: '' }); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>}
                  label="LINK"
                  color="text-purple-400"
                />
              </div>
            </div>

            {/* 3. STRATEGIC INFRA */}
            <div>
              <div class="text-[7px] font-black text-orange-400/60 uppercase tracking-widest mb-1.5 ml-1">Strategic_Infra</div>
              <div class="grid grid-cols-5 gap-1">
                <ToolbarButton
                  active={step() === 'airport_search'}
                  onClick={() => { setManualData({}); setStep('airport_search'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>}
                  label="AIRPORT"
                  color="text-red-500"
                />
                <ToolbarButton
                  active={step() === 'port_search'}
                  onClick={() => { setManualData({}); setStep('port_search'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V10" /><path d="M18 10V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v4" /><path d="m22 22-5-5" /><path d="m2 22 5-5" /><path d="M12 18H5" /><path d="M12 18h7" /></svg>}
                  label="PORT"
                  color="text-blue-500"
                />
                <ToolbarButton
                  active={step() === 'power_search'}
                  onClick={() => { setManualData({}); setStep('power_search'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>}
                  label="POWER"
                  color="text-yellow-500"
                />
                <ToolbarButton
                  active={step() === 'industry_search'}
                  onClick={() => { setManualData({}); setStep('industry_search'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v12H2V10" /><path d="M2 10V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4" /><path d="M4 10a2 2 0 1 0 4 0" /><path d="M8 10a2 2 0 1 0 4 0" /><path d="M12 10a2 2 0 1 0 4 0" /><path d="M16 10a2 2 0 1 0 4 0" /><path d="M7 22v-5" /><path d="M17 22v-5" /><path d="M12 22v-5" /></svg>}
                  label="INDUS"
                  color="text-emerald-500"
                />
                <ToolbarButton
                  active={step() === 'oil_search'}
                  onClick={() => { setManualData({}); setStep('oil_search'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m7 7 10 10"/><path d="m17 7-10 10"/></svg>}
                  label="OIL"
                  color="text-yellow-600"
                />
              </div>
            </div>

            {/* 4. GEOSPATIAL INTEL */}
            <div>
              <div class="text-[7px] font-black text-indigo-400/60 uppercase tracking-widest mb-1.5 ml-1">Geospatial_Intel</div>
              <div class="grid grid-cols-3 gap-1">
                <ToolbarButton
                  active={step() === 'timezone_search'}
                  onClick={() => { setManualData({ q: props.node?.country_name || "" }); setStep('timezone_search'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                  label="TIME"
                  color="text-indigo-400"
                />
                <ToolbarButton
                  active={step() === 'nominatim_search'}
                  onClick={() => { setStep('nominatim_search'); }}
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /><line x1="12" y1="7" x2="12" y2="2" /><line x1="12" y1="17" x2="12" y2="22" /><line x1="17" y1="12" x2="22" y2="12" /><line x1="7" y1="12" x2="2" y2="12" /></svg>}
                  label="GEO"
                  color="text-emerald-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Context Panel */}
        <Show when={step() !== 'idle'}>
          <div class="pointer-events-auto w-[300px] bg-[#0d1117]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10 animate-in slide-in-from-left-5 duration-500">
            <Show when={step() === 'nominatim_search'}>
              <NominatimSearch
                nodeId={props.node.id}
                onAddManual={props.onAddManual}
                onFinished={() => { init(); props.onClose(); }}
              />
            </Show>

            {/* Panels for each step (News, Mgmt, Chart, etc) */}
          <Show when={step() === 'keyword'}>
            <div class="p-4 space-y-4">
              <div class="text-[9px] font-black text-emerald-400 uppercase tracking-widest">News Discovery</div>
              <input
                type="text" class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none focus:border-emerald-500"
                value={localKeyword()} onInput={(e) => setLocalKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchPreview()}
              />
              <button onClick={handleFetchPreview} class="w-full py-3 bg-emerald-600 text-white text-[9px] font-black uppercase rounded hover:bg-emerald-500 transition-colors">Start Scan</button>
            </div>
          </Show>

          <Show when={step() === 'preview'}>
            <div class="flex flex-col max-h-[300px]">
              <div class="p-4 border-b border-white/5 flex justify-between items-center bg-emerald-500/5">
                <span class="text-[9px] font-black text-emerald-400 uppercase">Scan Results</span>
                <button onClick={() => setStep('keyword')} class="text-[8px] font-black text-white/30 hover:text-white uppercase">Refine</button>
              </div>
              <div class="flex-1 overflow-y-auto custom-scrollbar-dark p-2 space-y-2">
                <For each={previewNews()}>
                  {(item) => (
                    <div class="p-2 border border-white/5 bg-white/[0.02] rounded text-[10px] font-bold text-white/80 leading-tight">
                      {item.title}
                    </div>
                  )}
                </For>
              </div>
              <div class="p-3 border-t border-white/5">
                <button onClick={() => { props.onAddNewsCollection(props.node.id, localKeyword(), previewNews()); props.onClose(); init(); }} class="w-full py-3 bg-emerald-600 text-white text-[9px] font-black uppercase rounded shadow-lg shadow-emerald-900/40">Add to Canvas</button>
              </div>
            </div>
          </Show>

          <Show when={step() === 'mgmt_preview'}>
            <div class="flex flex-col max-h-[300px]">
              <div class="p-4 border-b border-white/5 bg-blue-500/5">
                <span class="text-[9px] font-black text-blue-400 uppercase">Executive Personnel Detected</span>
              </div>
              <div class="flex-1 overflow-y-auto custom-scrollbar-dark p-2 space-y-1 text-left">
                <For each={previewMgmt()}>
                  {(mgr) => (
                    <button
                      onClick={() => setSelectedMgmt(prev => prev.includes(mgr.name) ? prev.filter(n => n !== mgr.name) : [...prev, mgr.name])}
                      class={`w-full p-3 border rounded text-left transition-all ${selectedMgmt().includes(mgr.name) ? 'bg-blue-500/20 border-blue-500 text-white' : 'bg-white/[0.02] border-white/5 text-white/40'}`}
                    >
                      <div class="text-[10px] font-bold uppercase">{mgr.name}</div>
                      <div class="text-[7px] font-black opacity-40 mt-0.5 uppercase tracking-tighter">{mgr.title}</div>
                    </button>
                  )}
                </For>
              </div>
              <div class="p-3 border-t border-white/5">
                <button onClick={() => { props.onAddManagement(props.node.id, previewMgmt().filter(m => selectedMgmt().includes(m.name))); props.onClose(); init(); }} disabled={selectedMgmt().length === 0} class="w-full py-3 bg-blue-600 text-white text-[9px] font-black uppercase rounded disabled:opacity-50">Link Selected</button>
              </div>
            </div>
          </Show>

          <Show when={step() === 'chart_setup'}>
            <div class="p-4 space-y-4">
              <div class="text-[9px] font-black text-orange-400 uppercase tracking-widest leading-loose">Market Data Lookup</div>
              <div class="relative">
                <input
                  type="text" class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none"
                  value={customSymbol()} onInput={(e) => setCustomSymbol(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSymbol()}
                />
                <Show when={loading()}><div class="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div></Show>
              </div>
              <Show when={symbolResults().length > 0}>
                <div class="max-h-[100px] overflow-y-auto space-y-1 custom-scrollbar-dark">
                  <For each={symbolResults()}>
                    {(res) => (
                      <button onClick={() => { setCustomSymbol(res.symbol); setSymbolResults([]); }} class="w-full p-2 text-left bg-white/5 hover:bg-orange-500/20 text-[9px] font-bold text-white uppercase rounded">
                        {res.symbol} - {res.shortname}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
              <div class="grid grid-cols-6 gap-1">
                <For each={periods}>
                  {(p) => (
                    <button onClick={() => setSelectedPeriod(p.value)} class={`py-1.5 rounded text-[8px] font-black border transition-all ${selectedPeriod() === p.value ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>{p.label}</button>
                  )}
                </For>
              </div>
              <button onClick={handleAddChart} class="w-full py-3 bg-orange-600 text-white text-[9px] font-black uppercase rounded">Deploy Chart</button>
            </div>
          </Show>

          <Show when={step() === 'manual_entry'}>
            <div class="p-4 space-y-4">
              <div class="text-[9px] font-black text-blue-400 uppercase tracking-widest">{manualType()} ENTRY</div>
              <Show when={manualType() === 'USER'}>
                <div class="space-y-2">
                  <input type="text" placeholder="NAME" class="w-full bg-black/40 border border-white/10 p-3 rounded text-[10px] font-black text-white uppercase outline-none" onInput={(e) => setManualData({ ...manualData(), name: e.target.value })} />
                  <input type="text" placeholder="ROLE" class="w-full bg-black/40 border border-white/10 p-3 rounded text-[10px] font-black text-white uppercase outline-none" onInput={(e) => setManualData({ ...manualData(), title: e.target.value })} />
                  <textarea placeholder="DESC" class="w-full h-20 bg-black/40 border border-white/10 p-3 rounded text-[10px] font-black text-white uppercase outline-none resize-none" onInput={(e) => setManualData({ ...manualData(), description: e.target.value })} />
                </div>
              </Show>
              <Show when={manualType() === 'COMPANY'}>
                <input type="text" placeholder="CORP NAME" class="w-full bg-black/40 border border-white/10 p-3 rounded text-[10px] font-black text-white uppercase outline-none" onInput={(e) => setManualData({ ...manualData(), name: e.target.value, symbol: 'CORP' })} />
              </Show>
              <Show when={manualType() === 'LOCATION'}>
                <div class="space-y-2">
                  <input type="text" placeholder="SITE NAME" class="w-full bg-black/40 border border-white/10 p-3 rounded text-[10px] font-black text-white uppercase outline-none" onInput={(e) => setManualData({ ...manualData(), name: e.target.value })} />
                  <input type="text" placeholder="ADDRESS" class="w-full bg-black/40 border border-white/10 p-3 rounded text-[10px] font-black text-white uppercase outline-none" onInput={(e) => setManualData({ ...manualData(), address: e.target.value })} />
                  <div class="grid grid-cols-2 gap-2">
                    <input type="number" step="any" placeholder="LATITUDE" class="w-full bg-black/40 border border-white/10 p-2 rounded text-[9px] font-black text-white uppercase outline-none" onInput={(e) => setManualData({ ...manualData(), lat: parseFloat(e.target.value) })} />
                    <input type="number" step="any" placeholder="LONGITUDE" class="w-full bg-black/40 border border-white/10 p-2 rounded text-[9px] font-black text-white uppercase outline-none" onInput={(e) => setManualData({ ...manualData(), lon: parseFloat(e.target.value) })} />
                  </div>
                  <div class="flex items-center justify-between p-2 bg-black/40 rounded border border-white/5">
                    <span class="text-[8px] font-black text-white/40 uppercase">Embed Map</span>
                    <button
                      onClick={() => setManualData({ ...manualData(), showMap: !manualData().showMap })}
                      class={`w-8 h-4 rounded-full relative transition-all ${manualData().showMap ? 'bg-orange-500' : 'bg-white/10'}`}
                    >
                      <div class={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${manualData().showMap ? 'left-4.5' : 'left-0.5'}`}></div>
                    </button>
                  </div>
                </div>
              </Show>
              <Show when={manualType() === 'HYPERLINK'}>
                <div class="space-y-2">
                  <input type="text" placeholder="NAME / LABEL" class="w-full bg-black/40 border border-white/10 p-3 rounded text-[10px] font-black text-white uppercase outline-none" onInput={(e) => setManualData({ ...manualData(), name: e.target.value })} />
                  <input type="text" placeholder="URL (HTTPS://...)" class="w-full bg-black/40 border border-white/10 p-3 rounded text-[10px] font-black text-white uppercase outline-none" onInput={(e) => setManualData({ ...manualData(), url: e.target.value })} />
                </div>
              </Show>
              <button onClick={deployManual} class="w-full py-3 bg-blue-600 text-white text-[9px] font-black uppercase rounded shadow-lg shadow-blue-900/40">Link Entity</button>
            </div>
          </Show>

          <Show when={step() === 'airport_search'}>
            <div class="p-4 space-y-4">
              <div class="text-[9px] font-black text-red-500 uppercase tracking-widest leading-loose">Infrastructure Link</div>
              <input
                type="text" placeholder="Search Airports..." class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none"
                value={manualData().q || ""} onInput={(e) => setManualData({ ...manualData(), q: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && searchAirports()}
              />
              <div class="max-h-[150px] overflow-y-auto space-y-1 custom-scrollbar-dark text-left">
                <For each={manualData().results || []}>
                  {(airport) => (
                    <button
                      onClick={() => { props.onAddManual('AIRPORT', { ...airport, address: airport.municipality, type_airport: airport.type, lat: airport.latitude, lon: airport.longitude }, props.node.id); init(); props.onClose(); }}
                      class="w-full p-2 text-left bg-white/5 hover:bg-red-500/20 border-white/5 border rounded"
                    >
                      <div class="text-[9px] font-black text-white uppercase truncate">{airport.name}</div>
                      <div class="text-[7px] text-white/30 font-black uppercase">{airport.ident} • {airport.municipality}</div>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={step() === 'port_search'}>
            <div class="p-4 space-y-4">
              <div class="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-loose">Maritime Link</div>
              <input
                type="text" placeholder="Search Ports..." class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none"
                value={manualData().q || ""} onInput={(e) => setManualData({ ...manualData(), q: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && searchPorts()}
              />
              <div class="max-h-[150px] overflow-y-auto space-y-1 custom-scrollbar-dark text-left">
                <For each={manualData().results || []}>
                  {(port) => (
                    <button
                      onClick={() => { props.onAddManual('PORT', { ...port }, props.node.id); init(); props.onClose(); }}
                      class="w-full p-2 text-left bg-white/5 hover:bg-blue-500/20 border-white/5 border rounded"
                    >
                      <div class="text-[9px] font-black text-white uppercase truncate">{port.name}</div>
                      <div class="text-[7px] text-white/30 font-black uppercase">{port.country_name} • SIZE: {port.harbor_size}</div>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={step() === 'power_search'}>
            <div class="p-4 space-y-4">
              <div class="text-[9px] font-black text-yellow-500 uppercase tracking-widest leading-loose">Energy Infrastructure</div>
              <input
                type="text" placeholder="Search Generators..." class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none"
                value={manualData().q || ""} onInput={(e) => setManualData({ ...manualData(), q: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && searchPowerPlants()}
              />
              <div class="max-h-[150px] overflow-y-auto space-y-1 custom-scrollbar-dark text-left">
                <For each={manualData().results || []}>
                  {(plant) => (
                    <button
                      onClick={() => { props.onAddManual('POWER_PLANT', { ...plant, country_name: plant.country_long }, props.node.id); init(); props.onClose(); }}
                      class="w-full p-2 text-left bg-white/5 hover:bg-yellow-500/20 border-white/5 border rounded"
                    >
                      <div class="text-[9px] font-black text-white uppercase truncate">{plant.name}</div>
                      <div class="text-[7px] text-white/30 font-black uppercase">{plant.country_long} • {plant.primary_fuel} • {plant.capacity_mw}MW</div>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={step() === 'industry_search'}>
            <div class="p-4 space-y-4">
              <div class="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-loose">Strategic Industrial Hubs</div>
              <input
                type="text" placeholder="Search Industrial Zones..." class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none"
                value={manualData().q || ""} onInput={(e) => setManualData({ ...manualData(), q: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && searchIndustrialZones()}
              />
              <div class="max-h-[150px] overflow-y-auto space-y-1 custom-scrollbar-dark text-left">
                <For each={manualData().results || []}>
                  {(zone) => (
                    <button
                      onClick={() => { props.onAddManual('INDUSTRIAL_ZONE', { ...zone, country_name: zone.country }, props.node.id); init(); props.onClose(); }}
                      class="w-full p-2 text-left bg-white/5 hover:bg-emerald-500/20 border-white/5 border rounded"
                    >
                      <div class="text-[9px] font-black text-white uppercase truncate">{zone.name}</div>
                      <div class="text-[7px] text-white/30 font-black uppercase">{zone.country} • {zone.sector}</div>
                    </button>
                  )}
                </For>
                <Show when={manualData().q && (manualData().results || []).length === 0 && !loading()}>
                  <div class="py-10 text-center text-[8px] font-black text-white/10 uppercase tracking-widest border border-dashed border-white/5 rounded">
                    No Economic Hub Match Found
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={step() === 'market_events'}>
            <div class="p-4 space-y-4">
              <div class="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5 mb-2">
                <button 
                  onClick={() => { setEventMode('official'); setSelectedTicker(null); setSelectedEvents([]); }} 
                  class={`flex-1 py-1 rounded text-[7px] font-black uppercase transition-all ${eventMode() === 'official' ? 'bg-orange-500 text-white' : 'text-white/20 hover:text-white/40'}`}
                >Official</button>
                <button 
                  onClick={() => setEventMode('manual')} 
                  class={`flex-1 py-1 rounded text-[7px] font-black uppercase transition-all ${eventMode() === 'manual' ? 'bg-blue-500 text-white' : 'text-white/20 hover:text-white/40'}`}
                >Manual</button>
              </div>

              <Show when={eventMode() === 'official'}>
                {/* STAGE 1: Ticker Search */}
                <Show when={!selectedTicker()}>
                  <div class="text-[9px] font-black text-orange-400 uppercase tracking-widest leading-loose">Search Ticker Intelligence</div>
                  <input 
                    type="text" placeholder="ENTER SYMBOL OR NAME (E.G. BBCA)..." class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none focus:border-orange-500 transition-all font-mono"
                    value={manualData().q || ""} onInput={(e) => setManualData({...manualData(), q: e.target.value.toUpperCase()})}
                    onKeyDown={(e) => e.key === 'Enter' && searchTickers()}
                  />
                  
                  <div class="max-h-[150px] overflow-y-auto space-y-1 custom-scrollbar-dark mt-2">
                    <For each={manualData().tickerResults || []}>
                      {(ticker) => (
                        <button 
                          onClick={() => fetchCalendarForTicker(ticker.symbol)}
                          class="w-full p-2 text-left bg-white/5 hover:bg-orange-500/20 border border-white/5 rounded transition-all flex justify-between items-center group"
                        >
                          <span class="text-[10px] font-black text-white group-hover:text-orange-400">{ticker.symbol}</span>
                          <span class="text-[8px] text-white/40 font-bold uppercase">{ticker.name}</span>
                        </button>
                      )}
                    </For>
                    <Show when={manualData().q && (manualData().tickerResults || []).length === 0 && !loading()}>
                       <button 
                          onClick={() => fetchCalendarForTicker(manualData().q)}
                          class="w-full p-3 bg-orange-600/10 border border-dashed border-orange-500/20 rounded text-[9px] font-black text-orange-500 uppercase hover:bg-orange-600 hover:text-white transition-all"
                       >Use Exact Ticker: {manualData().q}</button>
                    </Show>
                  </div>
                </Show>

                {/* STAGE 2: Event Selection */}
                <Show when={selectedTicker()}>
                   <div class="flex items-center justify-between mb-2">
                      <div class="text-[8px] font-black text-orange-500 uppercase tracking-widest">Ticker: {selectedTicker()}</div>
                      <button onClick={() => setSelectedTicker(null)} class="text-[7px] font-black text-white/20 hover:text-red-500 uppercase tracking-tighter">Change</button>
                   </div>
                   
                   <div class="max-h-[220px] overflow-y-auto space-y-2 custom-scrollbar-dark text-left">
                      <For each={manualData().calendarResults || []}>
                        {(event) => {
                          const isSelected = createMemo(() => 
                            selectedEvents().some(e => `${e.type}-${e.date}` === `${event.type}-${event.date}`)
                          );
                          return (
                            <button 
                              onClick={() => toggleEventSelection(event)}
                              class={`w-full p-2 text-left border rounded transition-all flex items-center gap-3 group ${
                                isSelected() ? 'bg-orange-500/20 border-orange-500 shadow-lg shadow-orange-500/10' : 'bg-white/5 border-white/5 hover:bg-white/[0.08]'
                              }`}
                            >
                              <div class={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected() ? 'bg-orange-500 border-orange-500' : 'border-white/20'}`}>
                                <Show when={isSelected()}>
                                   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M20 6L9 17l-5-5"/></svg>
                                </Show>
                              </div>
                              <div class="flex-1">
                                <div class="flex items-center justify-between mb-1">
                                  <div class="text-[7px] font-black text-orange-500 uppercase tracking-wider">{event.type}</div>
                                  <div class="text-[7px] text-white/40 font-black">{event.date.split(' ')[0]}</div>
                                </div>
                                <div class="text-[10px] font-black text-white uppercase group-hover:text-orange-400 transition-colors truncate">{event.name}</div>
                              </div>
                            </button>
                          );
                        }}
                      </For>
                      <Show when={(manualData().calendarResults || []).length === 0 && !loading()}>
                        <div class="py-10 text-center text-[8px] font-black text-white/10 uppercase tracking-widest border border-dashed border-white/5 rounded">
                          No corporate events found
                        </div>
                      </Show>
                   </div>

                   <Show when={selectedEvents().length > 0}>
                      <button 
                        onClick={deploySelectedEvents}
                        class="w-full bg-orange-600 hover:bg-orange-500 p-3 rounded text-[10px] font-black text-white uppercase tracking-[0.2em] transition-all shadow-xl shadow-orange-600/20 animate-in fade-in slide-in-from-bottom-2"
                      >Deploy {selectedEvents().length} Strategic Assets</button>
                   </Show>
                </Show>
              </Show>

              <Show when={eventMode() === 'manual'}>
                <div class="text-[9px] font-black text-blue-400 uppercase tracking-widest leading-loose">Manual Mission Milestone</div>
                <div class="space-y-2">
                  <input 
                    type="text" placeholder="EVENT NAME (E.G. BOARD MEETING)..." class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none focus:border-blue-500 transition-all font-mono"
                    value={manualData().name || ""} onInput={(e) => setManualData({...manualData(), name: e.target.value})}
                  />
                  <div class="grid grid-cols-2 gap-2">
                    <input 
                      type="date" class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none focus:border-blue-500 transition-all font-mono"
                      value={manualData().date || new Date().toISOString().split('T')[0]} 
                      onInput={(e) => setManualData({...manualData(), date: e.target.value})}
                    />
                    <input 
                      type="time" class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none focus:border-blue-500 transition-all font-mono"
                      value={manualData().time || "12:00"} onInput={(e) => setManualData({...manualData(), time: e.target.value})}
                    />
                  </div>
                  <button 
                    onClick={() => { 
                      const targetDate = manualData().date || new Date().toISOString().split('T')[0];
                      props.onAddManual('EMITENT_EVENT', { ...manualData(), subType: 'MANUAL', date: targetDate }, props.node.id); 
                      init(); 
                      props.onClose(); 
                    }}
                    class="w-full bg-blue-600 hover:bg-blue-500 p-2 rounded text-[9px] font-black text-white uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                  >Deploy Manual Event</button>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={step() === 'oil_search'}>
            <div class="p-4 space-y-4">
              <div class="text-[9px] font-black text-yellow-600 uppercase tracking-widest leading-loose">Oil & Energy Facilities</div>
              <input
                type="text" placeholder="Search Refineries..." class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none"
                value={manualData().q || ""} onInput={(e) => setManualData({ ...manualData(), q: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && searchRefineries()}
              />
              <div class="max-h-[150px] overflow-y-auto space-y-1 custom-scrollbar-dark text-left">
                <For each={manualData().results || []}>
                  {(refinery) => (
                    <button
                      onClick={() => { props.onAddManual('OIL_REFINERY', { ...refinery, name: refinery.nama_kilang, country_name: refinery.negara, lat: refinery.latitude, lon: refinery.longitude }, props.node.id); init(); props.onClose(); }}
                      class="w-full p-2 text-left bg-white/5 hover:bg-yellow-600/20 border-white/5 border rounded"
                    >
                      <div class="text-[9px] font-black text-white uppercase truncate">{refinery.nama_kilang}</div>
                      <div class="text-[7px] text-white/30 font-black uppercase">{refinery.negara} • {refinery.kapasitas} BPSD</div>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={step() === 'timezone_search'}>
            <div class="p-4 space-y-4">
              <div class="text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-loose">Geospatial Awareness</div>
              <input
                type="text" placeholder="Search Countries..." class="w-full bg-black/60 border border-white/10 p-3 rounded text-[11px] font-black uppercase text-white outline-none"
                value={manualData().q || ""} onInput={(e) => setManualData({ ...manualData(), q: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && searchTimezones()}
              />
              <div class="max-h-[150px] overflow-y-auto space-y-1 custom-scrollbar-dark text-left">
                <For each={manualData().results || []}>
                  {(country) => (
                    <button
                      onClick={() => { setManualData(country); setStep('timezone_config'); }}
                      class="w-full p-2 text-left bg-white/5 hover:bg-indigo-500/20 border-white/5 border rounded flex items-center gap-3 transition-all"
                    >
                      <img src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} class="w-4 h-3 object-cover border border-white/10" />
                      <div class="min-w-0 flex-1">
                        <div class="text-[9px] font-black text-white uppercase truncate">{country.name}</div>
                        <div class="text-[7px] text-white/30 font-black uppercase">GMT: {country.timezones[0]?.offset}</div>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={step() === 'timezone_config'}>
            <div class="p-4 space-y-4 text-left">
              <div class="flex items-center gap-2 mb-2">
                <img src={`https://flagcdn.com/w40/${manualData().code?.toLowerCase()}.png`} class="w-4 h-3 object-cover border border-white/10" />
                <div class="text-[9px] font-black text-indigo-400 uppercase tracking-widest truncate">{manualData().name}</div>
              </div>

              {/* TABS */}
              <div class="flex gap-1 p-1 bg-black/40 rounded border border-white/5">
                <button
                  onClick={() => setTzConfig({ ...tzConfig(), mode: 'auto' })}
                  class={`flex-1 py-2 text-[8px] font-black uppercase rounded transition-all ${tzConfig().mode === 'auto' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                >
                  AUTO_LIVE
                </button>
                <button
                  onClick={() => setTzConfig({ ...tzConfig(), mode: 'manual' })}
                  class={`flex-1 py-2 text-[8px] font-black uppercase rounded transition-all ${tzConfig().mode === 'manual' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                >
                  MANUAL_FIXED
                </button>
              </div>

              <Show when={tzConfig().mode === 'manual'}>
                <div class="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <div class="text-[7px] font-black text-white/30 uppercase tracking-widest">Temporal Definition</div>
                  <div class="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      class="w-full bg-black/60 border border-white/10 p-2 rounded text-[10px] font-black text-white outline-none"
                      value={tzConfig().customDate}
                      onInput={(e) => setTzConfig({ ...tzConfig(), customDate: e.target.value })}
                    />
                    <input
                      type="time"
                      class="w-full bg-black/60 border border-white/10 p-2 rounded text-[10px] font-black text-white outline-none"
                      value={tzConfig().customTime}
                      onInput={(e) => setTzConfig({ ...tzConfig(), customTime: e.target.value })}
                    />
                  </div>
                </div>
              </Show>

              <div class="pt-2 flex gap-2">
                <button
                  onClick={() => setStep('timezone_search')}
                  class="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/60 text-[9px] font-black uppercase tracking-widest rounded transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    const finalData = {
                      ...manualData(),
                      mode: tzConfig().mode,
                      customDate: tzConfig().customDate,
                      customTime: tzConfig().customTime
                    };
                    props.onAddManual('TIMEZONE', finalData, props.node.id);
                    init();
                    props.onClose();
                  }}
                  class="flex-[2] py-3 bg-indigo-500 hover:bg-indigo-400 text-white text-[9px] font-black uppercase tracking-widest rounded shadow-lg shadow-indigo-500/20 transition-all"
                >
                  Deploy Node
                </button>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  </Show>
  );
};

const ToolbarButton = (props) => (
  <button
    onClick={props.onClick}
    class={`flex flex-col items-center justify-center py-2.5 px-1 rounded-lg transition-all group pointer-events-auto border ${props.active ? 'bg-white/20 border-white/40 shadow-lg' : 'hover:bg-white/10 border-transparent'}`}
  >
    <div class={`${props.active ? 'text-white' : 'text-white/40 group-hover:text-white'} transition-colors mb-1.5`}>
      {props.loading ? <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : props.icon}
    </div>

    <div class={`text-[7px] font-black uppercase tracking-[0.1em] transition-colors ${props.active ? 'text-white' : 'text-white/40 group-hover:text-white'}`}>
      {props.label}
    </div>
  </button>
);

export default ModuleToolbar;
