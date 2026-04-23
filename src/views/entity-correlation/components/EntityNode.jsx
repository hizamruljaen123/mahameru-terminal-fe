import { Show, Switch, Match, createSignal, onMount, onCleanup } from 'solid-js';
import NewsPanel from './NewsPanel';
import { useDraggable } from '../hooks/useDraggable';

const EntityNode = (props) => {
  const { onMouseDown } = useDraggable(props.node, props.onPositionChange, props.scale || 1);

  const getDimensions = () => {
    switch (props.node.type) {
      case 'NEWS_RESULT':
        const newsCount = (props.node.news || []).length;
        const calculatedHeight = Math.min(Math.max(newsCount * 85 + 60, 160), 400);
        return { w: 320, h: calculatedHeight };
      case 'MANAGEMENT_NODE':
      case 'USER':
        return { w: 220, h: 100 };
      case 'CHART_NODE':
        return { w: 350, h: 250 };
      case 'LOCATION':
        return { w: 220, h: (props.node.showMap && props.node.lat) ? 260 : 125 };
      case 'AIRPORT':
      case 'PORT':
      case 'POWER_PLANT':
      case 'INDUSTRIAL_ZONE':
      case 'OIL_REFINERY':
        return { w: 260, h: 220 };
      case 'EMITENT_EVENT':
        return { w: 230, h: 160 };
      case 'TIMEZONE':
        return { w: 280, h: 280 };
      case 'COMPANY':
        return { w: 200, h: 80 };
      case 'HYPERLINK':
        return { w: 180, h: 80 };
      default:
        return { w: 180, h: 80 };
    }
  };

  const currentDim = getDimensions();

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (props.onNodeDoubleClick) {
      props.onNodeDoubleClick(props.node);
    }
  };

  const wrappedMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('.custom-scrollbar-dark')) {
      return;
    }
    onMouseDown(e);
  };

  // Simple SVG Line Chart Renderer
  const renderChart = (data) => {
    if (!data || data.length < 2) return <div class="flex items-center justify-center h-full text-[10px] text-white/20">NO_DATA_STREAM</div>;
    
    const prices = data.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    
    const w = 310;
    const h = 150;
    
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((d.price - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div class="relative w-full h-[180px] p-2 bg-black/40 rounded border border-white/5 mt-2">
        <svg viewBox={`0 0 ${w} ${h}`} class="w-full h-full overflow-visible">
          <polyline
            fill="none"
            stroke="#10b981"
            stroke-width="2"
            stroke-linejoin="round"
            points={points}
            class="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          />
        </svg>
        <div class="absolute top-2 right-2 text-[8px] font-bold text-emerald-500">MAX: {max}</div>
        <div class="absolute bottom-2 right-2 text-[8px] font-bold text-red-500/60">MIN: {min}</div>
      </div>
    );
  };

  // Timezone & Country Intelligence Logic
  const [isFrozen, setIsFrozen] = createSignal(props.node.mode === 'manual');
  
  const getInitialTime = () => {
    if (props.node.mode === 'manual' && props.node.customDate && props.node.customTime) {
      // Create date object for the custom time
      const d = new Date(`${props.node.customDate}T${props.node.customTime}`);
      // Shift it to "UTC" base so getZonedTime can apply the country offset correctly
      const tz = props.node.timezones?.[0];
      if (!tz) return d;
      const offsetStr = tz.offset;
      const sign = offsetStr.startsWith('+') ? 1 : -1;
      const h = parseInt(offsetStr.slice(1, 3));
      const m = parseInt(offsetStr.slice(3, 5));
      const totalOffsetMs = sign * (h * 60 + m) * 60000;
      return new Date(d.getTime() - totalOffsetMs + (new Date().getTimezoneOffset() * 60000));
    }
    return new Date();
  };

  const [currentTime, setCurrentTime] = createSignal(getInitialTime());
  
  if (props.node.type === 'TIMEZONE') {
    const timer = setInterval(() => {
      if (!isFrozen()) setCurrentTime(new Date());
    }, 1000);
    onCleanup(() => clearInterval(timer));
  }

  const getZonedTime = () => {
    if (!props.node.timezones?.[0]) return currentTime();
    const tz = props.node.timezones[0];
    const offsetStr = tz.offset; // e.g. "+0700" or "-0500"
    const sign = offsetStr.startsWith('+') ? 1 : -1;
    const hours = parseInt(offsetStr.slice(1, 3));
    const mins = parseInt(offsetStr.slice(3, 5));
    const totalOffsetMinutes = sign * (hours * 60 + mins);
    
    // Get UTC time and add offset
    const utc = currentTime().getTime() + (currentTime().getTimezoneOffset() * 60000);
    return new Date(utc + (totalOffsetMinutes * 60000));
  };

  const formatZoned = (date) => {
    return {
      time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      day: date.toLocaleDateString('en-GB', { weekday: 'long' })
    };
  };

  return (
    <div 
      class={`absolute animate-in zoom-in duration-500 select-none pointer-events-auto group ${props.isActive ? 'z-50' : 'z-10'}`}
      style={{ 
        left: `${props.node.x}px`, 
        top: `${props.node.y}px`, 
        width: `${currentDim.w}px`,
        height: `${currentDim.h}px`
      }}
      onDblClick={handleDoubleClick}
      onClick={(e) => {
        e.stopPropagation();
        if (props.onNodeClick) props.onNodeClick();
      }}
    >
      {/* Selection Glow */}
      <Show when={props.isActive}>
        <div class="absolute -inset-2 bg-blue-500/10 blur-xl animate-pulse rounded-full z-[-1]"></div>
      </Show>

      {/* Connection Mode Indicator */}
      <Show when={props.isConnectionSource}>
        <div class="absolute -inset-4 border-2 border-emerald-500 rounded-lg animate-ping opacity-20 pointer-events-none"></div>
        <div class="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-600 text-[6px] font-black text-white uppercase rounded tracking-[0.2em] animate-bounce">Connection_Source</div>
      </Show>

      {/* Anchor Visuals */}
      <div class="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#0a0c10]"></div>
        <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#0a0c10]"></div>
        <div class="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#0a0c10]"></div>
        <div class="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#0a0c10]"></div>
      </div>

      <Switch>
        {/* CASE: CHART NODE */}
        <Match when={props.node.type === 'CHART_NODE'}>
          <div 
            onMouseDown={wrappedMouseDown}
            class="w-full h-full bg-[#0d1117]/95 backdrop-blur-md border-2 border-orange-500/30 p-4 flex flex-col rounded-sm shadow-2xl relative overflow-hidden ring-1 ring-orange-500/10"
          >
            <div class="flex justify-between items-center mb-2 shrink-0">
               <div class="text-[8px] font-black text-orange-400 tracking-[0.2em] uppercase">MARKET_ANALYTICS</div>
               <button class="text-white/20 hover:text-red-500 transition-colors p-1" onClick={() => props.onDelete(props.node.id)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
            <div class="text-[12px] font-black text-white uppercase mb-1">{props.node.name}</div>
            <div class="flex-1 min-h-0">
              {renderChart(props.node.history)}
            </div>
            <div class="mt-2 text-[7px] text-white/30 font-bold uppercase tracking-widest flex justify-between">
              <span>SYNC_OK</span>
              <span>SCALE: {props.node.period}</span>
            </div>
          </div>
        </Match>

        {/* CASE: NEWS RESULT */}
        <Match when={props.node.type === 'NEWS_RESULT'}>
          <div class="w-full h-full bg-[#0d1117]/95 backdrop-blur-md border-2 border-emerald-500/30 shadow-2xl overflow-hidden flex flex-col rounded-sm ring-1 ring-emerald-500/10">
            <div 
              onMouseDown={wrappedMouseDown}
              class="bg-emerald-500/20 text-emerald-400 p-2 border-b border-emerald-500/20 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing"
            >
              <div class="text-[9px] font-black tracking-widest uppercase truncate ml-2 italic pointer-events-none">{props.node.name}</div>
              <button class="text-emerald-500/60 hover:text-red-500 transition-colors p-1" onClick={() => props.onDelete(props.node.id)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto custom-scrollbar-dark bg-black/60 pointer-events-auto">
              <NewsPanel news={props.node.news || []} loading={false} onRemove={(index) => props.onRemoveNews(props.node.id, index)} />
            </div>
            <div onMouseDown={wrappedMouseDown} class="p-1 bg-emerald-500/10 text-[7px] text-emerald-500/60 text-center font-bold uppercase tracking-tighter shrink-0 border-t border-emerald-500/10 cursor-grab active:cursor-grabbing">
              Expansion Node Ready
            </div>
          </div>
        </Match>

        {/* CASE: USER / MANAGEMENT */}
        <Match when={props.node.type === 'USER' || props.node.type === 'MANAGEMENT_NODE'}>
          <div onMouseDown={wrappedMouseDown} class="w-full h-full bg-[#0b1424]/95 backdrop-blur-md border-2 border-blue-500/40 p-4 flex flex-col justify-center rounded-sm ring-1 ring-blue-500/10 cursor-grab active:cursor-grabbing hover:bg-blue-500/5 transition-colors group">
            <div class="flex justify-between items-start absolute top-3 right-3 scale-75 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="text-blue-500/40 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); props.onDelete(props.node.id); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
            <div class="text-[8px] font-black text-blue-400 tracking-[0.2em] uppercase mb-1 pointer-events-none">
              {props.node.type === 'USER' ? 'USER_INTEL' : 'OFFICER_RECON'}
            </div>
            <div class="text-[12px] font-black text-white uppercase leading-tight line-clamp-1 mb-1 pointer-events-none">{props.node.name}</div>
            <div class="text-[9px] font-bold text-blue-500/60 uppercase line-clamp-1 pointer-events-none">{props.node.title}</div>
            <Show when={props.node.description}>
               <div class="text-[7px] text-white/30 truncate mt-1 italic uppercase font-bold">{props.node.description}</div>
            </Show>
          </div>
        </Match>

        {/* CASE: HYPERLINK */}
        <Match when={props.node.type === 'HYPERLINK'}>
          <div onMouseDown={wrappedMouseDown} class="w-full h-full bg-purple-950/20 backdrop-blur-md border-2 border-purple-500/40 p-4 flex flex-col justify-center rounded-sm ring-1 ring-purple-500/10 cursor-grab active:cursor-grabbing hover:bg-purple-500/10 transition-all group relative">
            <div class="flex justify-between items-start absolute top-3 right-3 scale-75 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="text-purple-500/40 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); props.onDelete(props.node.id); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
            <div class="text-[8px] font-black text-purple-400 tracking-[0.2em] uppercase mb-1 pointer-events-none flex items-center gap-1">
               <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
               URL_REFERENCE
            </div>
            <a 
               href={props.node.url} 
               target="_blank" 
               rel="noopener noreferrer"
               onMouseDown={(e) => e.stopPropagation()}
               class="text-[11px] font-black text-white uppercase leading-tight line-clamp-1 hover:text-purple-400 transition-colors"
            >
               {props.node.name}
            </a>
            <div class="text-[7px] font-bold text-purple-500/50 uppercase truncate pointer-events-none mt-1">{props.node.url}</div>
          </div>
        </Match>

        {/* CASE: LOCATION */}
        <Match when={props.node.type === 'LOCATION'}>
          <div onMouseDown={wrappedMouseDown} class="w-full h-full bg-orange-950/20 backdrop-blur-md border-2 border-orange-500/40 p-4 flex flex-col justify-center rounded-sm ring-1 ring-orange-500/10 cursor-grab active:cursor-grabbing hover:bg-orange-500/5 transition-colors group relative">
            <div class="flex justify-between items-start absolute top-3 right-3 scale-75 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="text-orange-500/40 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); props.onDelete(props.node.id); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
            <div class="text-[8px] font-black text-orange-400 tracking-[0.2em] uppercase mb-1 pointer-events-none">GEOSPATIAL_LOC</div>
            <div class="text-[12px] font-black text-white uppercase leading-tight line-clamp-1 mb-1 pointer-events-none">{props.node.name}</div>
            <div class="text-[8px] font-bold text-white/40 uppercase line-clamp-2 pointer-events-none">{props.node.address}</div>
            
            <Show when={props.node.showMap && props.node.lat && props.node.lon}>
              <div class="relative flex-1 min-h-[100px] mt-2 rounded overflow-hidden border border-orange-500/30 bg-black/40">
                 <iframe 
                  width="100%" 
                  height="100%" 
                  style="border:0; filter: grayscale(1) invert(0.9) contrast(1.2) brightness(0.8);" 
                  loading="lazy" 
                  allowfullscreen
                  src={`https://maps.google.com/maps?q=${props.node.lat},${props.node.lon}&z=13&output=embed`}
                 ></iframe>
                 <div class="absolute inset-0 pointer-events-none border border-orange-500/20 ring-1 ring-inset ring-orange-500/10"></div>
              </div>
            </Show>

            <Show when={props.node.lat && props.node.lon}>
               <div class="mt-2 text-[7px] font-roboto text-orange-500/60 font-black tabular-nums border-t border-orange-500/20 pt-1 flex justify-between">
                 <span>{props.node.lat?.toFixed(4)}N</span>
                 <span>{props.node.lon?.toFixed(4)}E</span>
               </div>
            </Show>
          </div>
        </Match>

        {/* CASE: AIRPORT */}
        <Match when={props.node.type === 'AIRPORT'}>
          <div onMouseDown={wrappedMouseDown} class="w-full h-full bg-red-950/40 backdrop-blur-md border-2 border-red-500/60 p-4 flex flex-col justify-start rounded-sm ring-1 ring-red-500/20 cursor-grab active:cursor-grabbing hover:bg-red-500/10 transition-colors group relative">
            <div class="flex justify-between items-start absolute top-3 right-3 scale-75 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="text-red-500/40 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); props.onDelete(props.node.id); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
            <div class="flex items-center justify-between mb-2 pointer-events-none border-b border-red-500/20 pb-1">
              <div class="text-[8px] font-black text-red-400 tracking-[0.2em] uppercase">AVIATION_FACILITY</div>
              <div class="text-[10px] font-black text-red-500">{props.node.ident}</div>
            </div>
            <div class="text-[11px] font-black text-white uppercase leading-tight mb-1 pointer-events-none group-hover:text-red-400 transition-colors truncate">{props.node.name}</div>
            <div class="text-[7px] font-bold text-white/50 uppercase line-clamp-1 pointer-events-none mb-2 italic">{props.node.address}, {props.node.country_name}</div>
            
            {/* Google Maps Embed Integration */}
            <div class="relative flex-1 min-h-[90px] mb-2 rounded overflow-hidden border border-red-500/30 bg-black/40">
               <iframe 
                width="100%" 
                height="100%" 
                style="border:0; filter: grayscale(1) invert(0.9) contrast(1.2);" 
                loading="lazy" 
                allowfullscreen
                src={`https://maps.google.com/maps?q=${props.node.lat},${props.node.lon}&z=11&output=embed`}
               ></iframe>
               <div class="absolute inset-0 pointer-events-none border border-red-500/20 ring-1 ring-inset ring-red-500/10"></div>
            </div>

            <div class="mt-auto flex items-center justify-between border-t border-white/10 pt-2 shrink-0">
               <div class="text-[7px] font-black text-red-500 uppercase pointer-events-none tracking-widest">{props.node.type_airport?.replace('_', ' ')}</div>
               <div class="text-[8px] font-roboto text-white/50 font-bold tabular-nums">
                 {props.node.lat?.toFixed(4)}, {props.node.lon?.toFixed(4)}
               </div>
            </div>
          </div>
        </Match>

        {/* CASE: PORT */}
        <Match when={props.node.type === 'PORT'}>
          <div onMouseDown={wrappedMouseDown} class="w-full h-full bg-blue-950/40 backdrop-blur-md border-2 border-blue-500/60 p-4 flex flex-col justify-start rounded-sm ring-1 ring-blue-500/20 cursor-grab active:cursor-grabbing hover:bg-blue-500/10 transition-colors group relative">
            <div class="flex justify-between items-start absolute top-3 right-3 scale-75 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="text-blue-500/40 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); props.onDelete(props.node.id); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
            <div class="flex items-center justify-between mb-2 pointer-events-none border-b border-blue-500/20 pb-1">
              <div class="text-[8px] font-black text-blue-400 tracking-[0.2em] uppercase">MARITIME_FACILITY</div>
              <div class="text-[10px] font-black text-blue-500">{props.node.country_code}</div>
            </div>
            <div class="text-[11px] font-black text-white uppercase leading-tight mb-1 pointer-events-none group-hover:text-blue-400 transition-colors truncate">{props.node.name}</div>
            <div class="text-[7px] font-bold text-white/50 uppercase line-clamp-1 pointer-events-none mb-2 italic">{props.node.country_name} • {props.node.area_name}</div>
            
            {/* Google Maps Embed Integration */}
            <div class="relative flex-1 min-h-[90px] mb-2 rounded overflow-hidden border border-blue-500/30 bg-black/40">
               <iframe 
                width="100%" 
                height="100%" 
                style="border:0; filter: grayscale(1) invert(0.9) contrast(1.2);" 
                loading="lazy" 
                allowfullscreen
                src={`https://maps.google.com/maps?q=${props.node.lat},${props.node.lon}&z=11&output=embed`}
               ></iframe>
               <div class="absolute inset-0 pointer-events-none border border-blue-500/20 ring-1 ring-inset ring-blue-500/10"></div>
            </div>

            <div class="mt-auto flex items-center justify-between border-t border-white/10 pt-2 shrink-0">
               <div class="text-[7px] font-black text-blue-500 uppercase pointer-events-none tracking-widest">SIZE: {props.node.harbor_size}</div>
               <div class="text-[8px] font-roboto text-white/50 font-bold tabular-nums">
                 {props.node.lat?.toFixed(4)}, {props.node.lon?.toFixed(4)}
               </div>
            </div>
          </div>
        </Match>

        {/* CASE: INDUSTRIAL_ZONE */}
        <Match when={props.node.type === 'INDUSTRIAL_ZONE'}>
          <div onMouseDown={wrappedMouseDown} class="w-full h-full bg-emerald-950/40 backdrop-blur-md border-2 border-emerald-500/60 p-4 flex flex-col justify-start rounded-sm ring-1 ring-emerald-500/20 cursor-grab active:cursor-grabbing hover:bg-emerald-500/10 transition-colors group relative font-roboto">
            <div class="flex justify-between items-start absolute top-3 right-3 scale-75 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="text-emerald-500/40 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); props.onDelete(props.node.id); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
            <div class="flex items-center justify-between mb-2 pointer-events-none border-b border-emerald-500/20 pb-1">
              <div class="text-[8px] font-black text-emerald-400 tracking-[0.2em] uppercase">ECONOMIC_HUB</div>
              <div class="text-[10px] font-black text-emerald-500">{props.node.sector || 'MULTI-SECTOR'}</div>
            </div>
            <div class="text-[11px] font-black text-white uppercase leading-tight mb-1 pointer-events-none group-hover:text-emerald-400 transition-colors truncate">{props.node.name}</div>
            <div class="text-[7px] font-bold text-white/50 uppercase line-clamp-1 pointer-events-none mb-2 italic">{props.node.country_name}</div>
            
            {/* Google Maps Embed Integration */}
            <div class="relative flex-1 min-h-[90px] mb-2 rounded overflow-hidden border border-emerald-500/30 bg-black/40">
               <iframe 
                width="100%" 
                height="100%" 
                style="border:0; filter: grayscale(1) invert(0.9) contrast(1.2);" 
                loading="lazy" 
                allowfullscreen
                src={`https://maps.google.com/maps?q=${props.node.lat},${props.node.lon}&z=13&output=embed`}
               ></iframe>
               <div class="absolute inset-0 pointer-events-none border border-emerald-500/20 ring-1 ring-inset ring-emerald-500/10"></div>
            </div>

            <div class="mt-auto flex items-center justify-between border-t border-white/10 pt-2 shrink-0">
               <div class="text-[7px] font-black text-emerald-500 uppercase pointer-events-none tracking-widest">ID {props.node.id}</div>
               <div class="text-[8px] font-roboto text-white/50 font-bold tabular-nums">
                 {props.node.lat?.toFixed(4)}, {props.node.lon?.toFixed(4)}
               </div>
            </div>
          </div>
        </Match>

        {/* CASE: EMITENT_EVENT */}
        <Match when={props.node.type === 'EMITENT_EVENT'}>
          <div onMouseDown={wrappedMouseDown} 
            class={`w-full h-full backdrop-blur-md border-2 p-4 flex flex-col justify-start rounded-sm ring-1 cursor-grab active:cursor-grabbing transition-colors group relative ${
              props.node.subType === 'MANUAL' 
                ? 'bg-blue-950/20 border-blue-500/40 ring-blue-500/10 hover:bg-blue-500/10' 
                : 'bg-orange-950/20 border-orange-500/40 ring-orange-500/10 hover:bg-orange-500/10'
            }`}
          >
            {/* Close Button */}
            <div class="flex justify-between items-start absolute top-3 right-3 scale-75 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                class={`${props.node.subType === 'MANUAL' ? 'text-blue-500/40' : 'text-orange-500/40'} hover:text-red-500 transition-colors p-1`} 
                onClick={(e) => { e.stopPropagation(); props.onDelete(props.node.id); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>

            {/* Header */}
            <div class={`flex items-center justify-between mb-2 pointer-events-none border-b pb-1 ${props.node.subType === 'MANUAL' ? 'border-blue-500/20' : 'border-orange-500/20'}`}>
              <div class={`text-[8px] font-black tracking-[0.2em] uppercase flex items-center gap-1 ${props.node.subType === 'MANUAL' ? 'text-blue-500' : 'text-orange-500'}`}>
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
                 {props.node.subType === 'MANUAL' ? 'MISSION_MILESTONE' : 'OFFICIAL_EVENT'}
              </div>
              <div class="text-[9px] font-black text-white/50 lowercase">
                {props.node.date?.split(/[\sT]/)[0]} {props.node.subType === 'MANUAL' ? props.node.time : ''}
              </div>
            </div>

            {/* Body */}
            <div class={`text-[11px] font-black text-white uppercase leading-tight mb-2 pointer-events-none transition-colors text-left ${props.node.subType === 'MANUAL' ? 'group-hover:text-blue-400' : 'group-hover:text-orange-400'}`}>{props.node.name}</div>
            
            <div class="space-y-1 text-left">
               <div class={`text-[8px] font-black uppercase tracking-widest ${props.node.subType === 'MANUAL' ? 'text-blue-500/80' : 'text-orange-500/80'}`}>
                 {props.node.subType === 'MANUAL' ? 'MANUAL_ENTRY' : props.node.symbol}
               </div>

               <Show when={props.node.consensus_eps}>
                  <div class="bg-white/5 p-2 rounded border border-white/5">
                     <div class="text-[7px] text-white/30 font-bold uppercase mb-1">Market Consensus</div>
                     <div class="flex gap-4">
                        <div>
                           <div class="text-[6px] text-white/20 uppercase">EPS Avg</div>
                           <div class="text-[9px] font-black text-white">{(props.node.consensus_eps || 0).toFixed(2)}</div>
                        </div>
                        <div>
                           <div class="text-[6px] text-white/20 uppercase">Rev Avg</div>
                           <div class="text-[9px] font-black text-white">{(props.node.consensus_rev || 0).toLocaleString()}</div>
                        </div>
                     </div>
                  </div>
               </Show>
            </div>

            <div class="mt-auto flex items-center justify-between border-t border-white/10 pt-2 shrink-0">
               <div class={`text-[7px] font-black uppercase pointer-events-none tracking-widest italic tracking-tighter ${props.node.subType === 'MANUAL' ? 'text-blue-500' : 'text-orange-500'}`}>
                 {props.node.subType === 'MANUAL' ? 'OPERATIONAL_TASK' : 'Verified yFinance Data'}
               </div>
            </div>
          </div>
        </Match>

        {/* CASE: OIL_REFINERY */}
        <Match when={props.node.type === 'OIL_REFINERY'}>
          <div onMouseDown={wrappedMouseDown} class="w-full h-full bg-yellow-950/20 backdrop-blur-md border-2 border-yellow-600/40 p-4 flex flex-col justify-start rounded-sm ring-1 ring-yellow-500/10 cursor-grab active:cursor-grabbing hover:bg-yellow-500/10 transition-colors group relative">
            <div class="flex justify-between items-start absolute top-3 right-3 scale-75 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="text-yellow-500/40 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); props.onDelete(props.node.id); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
            <div class="flex items-center justify-between mb-2 pointer-events-none border-b border-yellow-500/20 pb-1">
              <div class="text-[8px] font-black text-yellow-500 tracking-[0.2em] uppercase flex items-center gap-1">
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 2v20"/><path d="m7 7 10 10"/><path d="m17 7-10 10"/></svg>
                 OIL_FACILITY
              </div>
              <div class="text-[10px] font-black text-yellow-400">{props.node.kapasitas} BPSD</div>
            </div>
            <div class="text-[11px] font-black text-white uppercase leading-tight mb-1 pointer-events-none group-hover:text-yellow-400 transition-colors truncate text-left">{props.node.name}</div>
            <div class="text-[7px] font-bold text-white/50 uppercase line-clamp-1 pointer-events-none mb-2 italic text-left">{props.node.negara} • {props.node.operator}</div>
            
            {/* Google Maps Embed Integration */}
            <div class="relative flex-1 min-h-[90px] mb-2 rounded overflow-hidden border border-yellow-500/30 grayscale invert contrast-125 brightness-75">
               <iframe 
                width="100%" 
                height="100%" 
                style="border:0;" 
                loading="lazy" 
                allowfullscreen
                src={`https://maps.google.com/maps?q=${props.node.lat},${props.node.lon}&z=13&t=k&output=embed`}
               ></iframe>
               <div class="absolute inset-0 pointer-events-none border border-yellow-500/20 ring-1 ring-inset ring-yellow-500/10"></div>
            </div>

            <div class="mt-auto flex items-center justify-between border-t border-white/10 pt-2 shrink-0">
               <div class="text-[7px] font-black text-yellow-500 uppercase pointer-events-none tracking-widest italic">Live Facility Feed</div>
               <div class="text-[8px] font-roboto text-white/50 font-bold tabular-nums">
                 {props.node.lat?.toFixed(4)}, {props.node.lon?.toFixed(4)}
               </div>
            </div>
          </div>
        </Match>

        {/* CASE: POWER_PLANT */}
        <Match when={props.node.type === 'POWER_PLANT'}>
          <div onMouseDown={wrappedMouseDown} class="w-full h-full bg-yellow-950/40 backdrop-blur-md border-2 border-yellow-500/60 p-4 flex flex-col justify-start rounded-sm ring-1 ring-yellow-500/20 cursor-grab active:cursor-grabbing hover:bg-yellow-500/10 transition-colors group relative">
            <div class="flex justify-between items-start absolute top-3 right-3 scale-75 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="text-yellow-500/40 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); props.onDelete(props.node.id); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
            <div class="flex items-center justify-between mb-2 pointer-events-none border-b border-yellow-500/20 pb-1">
              <div class="text-[8px] font-black text-yellow-400 tracking-[0.2em] uppercase">POWER_GENERATION</div>
              <div class="text-[10px] font-black text-yellow-500">{props.node.primary_fuel}</div>
            </div>
            <div class="text-[11px] font-black text-white uppercase leading-tight mb-1 pointer-events-none group-hover:text-yellow-400 transition-colors truncate">{props.node.name}</div>
            <div class="text-[7px] font-bold text-white/50 uppercase line-clamp-1 pointer-events-none mb-2 italic">{props.node.country_name} • {props.node.owner}</div>
            
            {/* Google Maps Embed Integration */}
            <div class="relative flex-1 min-h-[90px] mb-2 rounded overflow-hidden border border-yellow-500/30 bg-black/40">
               <iframe 
                width="100%" 
                height="100%" 
                style="border:0; filter: grayscale(1) invert(0.9) contrast(1.2);" 
                loading="lazy" 
                allowfullscreen
                src={`https://maps.google.com/maps?q=${props.node.lat},${props.node.lon}&z=11&output=embed`}
               ></iframe>
               <div class="absolute inset-0 pointer-events-none border border-yellow-500/20 ring-1 ring-inset ring-yellow-500/10"></div>
            </div>

            <div class="mt-auto flex items-center justify-between border-t border-white/10 pt-2 shrink-0">
               <div class="text-[7px] font-black text-yellow-500 uppercase pointer-events-none tracking-widest">{props.node.capacity_mw} MW</div>
               <div class="text-[8px] font-roboto text-white/50 font-bold tabular-nums">
                 {props.node.lat?.toFixed(4)}, {props.node.lon?.toFixed(4)}
               </div>
            </div>
          </div>
        </Match>

        {/* CASE: TIMEZONE */}
        <Match when={props.node.type === 'TIMEZONE'}>
          <div onMouseDown={wrappedMouseDown} class="w-full h-full bg-indigo-950/40 backdrop-blur-md border-2 border-indigo-500/60 p-5 flex flex-col justify-start rounded-sm ring-1 ring-indigo-500/20 cursor-grab active:cursor-grabbing hover:bg-indigo-500/10 transition-colors group relative overflow-hidden">
             {/* Scanning Line overlay */}
             <div class="absolute inset-x-0 h-[2px] bg-indigo-500/20 top-0 animate-[scan_3s_linear_infinite] shadow-[0_0_15px_theme(colors.indigo.500)]"></div>
             
             <div class="flex justify-between items-start absolute top-4 right-4 z-10">
              <button class="text-white/20 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); props.onDelete(props.node.id); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>

            <div class="flex items-center gap-3 mb-4 pointer-events-none pb-2 border-b border-indigo-500/20">
              <img src={`https://flagcdn.com/w80/${props.node.code.toLowerCase()}.png`} class="w-10 h-7 object-cover border border-white/10 shadow-lg shadow-black/50" />
              <div>
                <div class="text-[8px] font-black text-indigo-400 tracking-[0.2em] uppercase">Chronos_Recon</div>
                <div class="text-[12px] font-black text-white uppercase tracking-tighter">{props.node.name}</div>
              </div>
            </div>

            <div class="flex-1 flex flex-col items-center justify-center py-2 relative">
               <div class="text-[34px] font-roboto font-black text-white leading-none tabular-nums tracking-tighter">
                 {formatZoned(getZonedTime()).time}
               </div>
               <div class="text-[9px] font-black text-indigo-400 mt-2 tracking-[0.3em] uppercase opacity-60">
                 {formatZoned(getZonedTime()).day}
               </div>
               <div class="text-[10px] font-bold text-white/50 mt-1 tabular-nums">
                 {formatZoned(getZonedTime()).date}
               </div>
            </div>

            <div class="mt-4 pt-3 border-t border-indigo-500/20 flex flex-col gap-2">
               <div class="flex items-center justify-between">
                 <div class="flex flex-col">
                   <div class="text-[7px] font-black text-white/30 uppercase tracking-widest">Temporal State</div>
                   <div class={`text-[8px] font-black uppercase ${isFrozen() ? 'text-red-500' : 'text-indigo-400'}`}>
                     {isFrozen() ? 'FROZEN_LINE' : 'LIVE_FEED'}
                   </div>
                 </div>
                 <button 
                   onClick={(e) => { e.stopPropagation(); setIsFrozen(!isFrozen()); }}
                   class={`px-3 py-1.5 rounded text-[8px] font-black uppercase transition-all border ${isFrozen() ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-indigo-500 border-indigo-400 text-white shadow-[0_0_10px_theme(colors.indigo.500/0.4)]'}`}
                 >
                   {isFrozen() ? 'Resume' : 'Freeze'}
                 </button>
               </div>
               
               <div class="flex items-center justify-between opacity-40">
                  <div class="text-[7px] font-black text-white uppercase tracking-widest leading-none">POS_{props.node.code}</div>
                  <div class="text-[8px] font-roboto text-white font-bold tabular-nums">
                    {props.node.lat?.toFixed(4)}N {props.node.lon?.toFixed(4)}E
                  </div>
               </div>
            </div>
          </div>
        </Match>

        {/* CASE: COMPANY / DEFAULT */}
        <Match when={true}>
          <div onMouseDown={wrappedMouseDown} class={`w-full h-full bg-[#161b22]/95 backdrop-blur-md border-2 ${props.node.type === 'COMPANY' ? 'border-emerald-500/40' : 'border-white/20'} p-4 flex flex-col justify-center group hover:border-blue-500 transition-all rounded-sm shadow-xl cursor-grab active:cursor-grabbing`}>
            <div class="cursor-pointer pointer-events-none">
              <div class={`text-[8px] font-black ${props.node.type === 'COMPANY' ? 'text-emerald-400' : 'text-blue-400'} mb-1 tracking-tighter uppercase`}>
                {props.node.type === 'COMPANY' ? 'CORP_ENTITY' : props.node.symbol}
              </div>
              <div class="text-[11px] font-bold text-white uppercase leading-tight truncate">{props.node.name}</div>
            </div>
            <div class="mt-2 pt-2 border-t border-white/5 flex justify-between items-center shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
              <span class="text-[7px] text-white/30 font-bold uppercase">{props.node.type}</span>
              <button class="text-white/40 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); props.onDelete(props.node.id); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
};

export default EntityNode;
