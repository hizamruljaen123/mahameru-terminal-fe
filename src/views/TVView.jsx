import { createSignal, createMemo, onMount, onCleanup, createEffect, For, Show } from 'solid-js';

// --- HLS VIDEO PLAYER COMPONENT ---

function HlsVideoPlayer(props) {
  let videoRef = null;
  const [error, setError] = createSignal(false);
  const [retries, setRetries] = createSignal(0);
  const maxRetries = 3;
  let hls = null;

  const initPlayer = () => {
    if (!videoRef || !props.src) return;
    setError(false);

    if (hls) {
      hls.destroy();
      hls = null;
    }

    const handleError = (fatal = true) => {
       if (fatal) {
          setError(true);
          const nextRetry = retries() + 1;
          if (nextRetry <= maxRetries) {
             setRetries(nextRetry);
             console.log(`[STREAM_RECOVERY] Attempting reconnect ${nextRetry}/${maxRetries} in 5s...`);
             setTimeout(initPlayer, 5000);
          } else {
             console.log(`[STREAM_CLOSED] Connection recovery failed after ${maxRetries} attempts. Clearing node.`);
             if (props.onClose) props.onClose();
          }
       }
    };

    if (window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        enableWorker: true,
        backBufferLength: 0
      });
      hls.loadSource(props.src);
      hls.attachMedia(videoRef);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        setRetries(0); // Reset retries on success
        if (props.autoPlay) {
          videoRef.play().catch(() => handleError(true));
        }
      });
      hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) handleError(true);
      });
    } else if (videoRef.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.src = props.src;
      videoRef.onerror = () => handleError(true);
      if (props.autoPlay) videoRef.play().catch(() => handleError(true));
    }
  };

  onMount(() => {
    if (!window.Hls) {
      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.3.5/dist/hls.min.js";
      script.onload = initPlayer;
      document.body.appendChild(script);
    } else {
      initPlayer();
    }
  });

  onCleanup(() => {
    if (hls) hls.destroy();
  });

  return (
    <div class={`relative bg-black w-full h-full overflow-hidden ${props.class}`}>
      <Show when={error()}>
        <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/95 text-[#ef4444] border border-red-500/30 gap-4">
          <svg class={`w-8 h-8 opacity-80 ${retries() > 0 ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <Show when={retries() === 0} fallback={<path d="M21 12a9 9 0 1 1-6.219-8.56" />}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Show>
          </svg>
          <div class="flex flex-col items-center gap-1">
            <div class="text-[9px] font-mono font-black tracking-[0.3em] uppercase text-center">
               <Show when={retries() > 0} fallback="CONNECTION_FAILED // NODATA">
                  RECONNECTING: ATTEMPT_{retries()}/{maxRetries}
               </Show>
            </div>
            <Show when={retries() > 0}>
               <span class="text-[7px] font-black opacity-60 uppercase animate-pulse">Connecting to stream...</span>
            </Show>
          </div>
          <Show when={props.onClose}>
             <button 
                onClick={(e) => { e.stopPropagation(); props.onClose(); }}
                class="mt-2 px-4 py-1.5 border border-red-500/40 text-red-500 text-[9px] font-black tracking-widest hover:bg-red-500 hover:text-white transition-all uppercase"
             >
                CLOSE STREAM
             </button>
          </Show>
        </div>
      </Show>
      <video
        ref={videoRef}
        class="absolute inset-0 w-full h-full"
        muted={props.muted}
        playsInline
        style={{ "object-fit": 'contain' }}
      />
    </div>
  );
}

// --- CHANNEL BROWSER COMPONENT ---
function ChannelBrowser(props) {
  const [channels, setChannels] = createSignal([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [search, setSearch] = createSignal("");
  const [page, setPage] = createSignal(1);
  const [totalCount, setTotalCount] = createSignal(0);
  const [totalPages, setTotalPages] = createSignal(0);
  const pageSize = 30;

  const fetchChannels = async () => {
    setIsLoading(true);
    try {
      const q = search().toLowerCase();
      const url = `${import.meta.env.VITE_TV_API}/api/tv/channels?url=${encodeURIComponent(props.source.url)}&search=${encodeURIComponent(q)}&page=${page()}&pageSize=${pageSize}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.channels) {
        setChannels(data.channels);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 0);
      } else {
        setChannels([]);
        setTotalCount(0);
        setTotalPages(0);
      }
    } catch (e) {
      console.error("Failed to fetch channels from BE", e);
    } finally {
      setIsLoading(false);
    }
  };

  onMount(() => {
    fetchChannels();
  });

  createEffect(() => {
    // Re-fetch when page or search changes
    page();
    search();
    fetchChannels();
  });

  // Reset page when searching
  createEffect(() => {
    search();
    setPage(1);
  });

  return (
    <div class="flex flex-col h-full bg-bg_sidebar/95 backdrop-blur-2xl border border-border_main shadow-2xl overflow-hidden">
      <div class="p-4 border-b border-border_main bg-bg_header/30 flex flex-col gap-3">
         <div class="flex items-center justify-between">
            <h3 class="text-[11px] font-black tracking-widest text-text_accent uppercase">SOURCE LIST: {props.source.name}</h3>
            <button onClick={props.onClose} class="text-text_secondary hover:text-text_primary transition-all">
               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
         </div>
         <input 
            type="text" 
            placeholder="FILTER CHANNELS..." 
            onInput={(e) => setSearch(e.target.value)}
            class="bg-bg_main/60 border border-border_main text-[10px] px-3 py-1.5 focus:outline-none focus:border-text_accent/50 text-text_primary font-mono uppercase placeholder:text-text_secondary/30"
         />
      </div>
      
      <div class="flex-1 overflow-y-auto win-scroll p-4">
        <Show when={isLoading()} fallback={
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            <For each={channels()}>
              {(c) => {
                const isSelected = createMemo(() => props.selected().some(s => s.url === c.url));
                return (
                  <button 
                    onClick={() => props.onToggle(c)}
                    class={`p-3 text-left border transition-all ${isSelected() ? 'border-text_accent bg-text_accent/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-border_main hover:border-text_accent/60 bg-bg_main/5'}`}
                  >
                    <span class="text-[10px] font-black text-text_primary truncate w-full tracking-wider">{c.name.toUpperCase()}</span>
                  </button>
                );
              }}
            </For>
          </div>
        }>
          <div class="h-full flex items-center justify-center text-[10px] font-mono animate-pulse text-text_accent uppercase">FETCHING CHANNELS...</div>
        </Show>
      </div>

      <div class="p-3 border-t border-border_main bg-bg_header/30 flex items-center justify-between font-mono">
         <div class="text-[9px] text-white/40 font-black tracking-widest uppercase">TOTAL CHANNELS: {totalCount()}</div>
         <div class="flex items-center gap-4">
            <button 
               disabled={page() === 1}
               onClick={() => setPage(p => Math.max(1, p - 1))}
               class={`text-[9px] font-black tracking-tighter px-3 py-1 border transition-all ${page() === 1 ? 'border-border_main text-text_secondary/20' : 'border-border_main text-text_primary hover:border-text_accent hover:text-text_accent'}`}
            >
               PREVIOUS
            </button>
            <div class="text-[10px] text-text_accent font-black tracking-[0.2em]">
               PAGE {String(page()).padStart(2, '0')} / {String(totalPages() || 1).padStart(2, '0')}
            </div>
            <button 
               disabled={page() === totalPages()}
               onClick={() => setPage(p => Math.min(totalPages(), p + 1))}
               class={`text-[9px] font-black tracking-tighter px-3 py-1 border transition-all ${page() === (totalPages() || 1) ? 'border-white/5 text-white/20' : 'border-white/20 text-white hover:border-text_accent hover:text-text_accent'}`}
            >
               NEXT
            </button>
         </div>
      </div>
    </div>
  );
}

// --- MAIN TV VIEW COMPONENT ---
export default function TVView() {
  const [sources, setSources] = createSignal([]);
  const [selectedChannels, setSelectedChannels] = createSignal([]);
  const [activeSource, setActiveSource] = createSignal(null);
  const [focusedChannel, setFocusedChannel] = createSignal(null);
  const [unmutedChannel, setUnmutedChannel] = createSignal(null);
  const [sidebarSearch, setSidebarSearch] = createSignal("");
  const [isSidebarOpen, setSidebarOpen] = createSignal(true);

  onMount(() => {
    fetch(`${import.meta.env.VITE_TV_API}/api/tv/sources`)
      .then(r => r.json())
      .then(setSources);
  });

  const toggleChannel = (channel) => {
    if (selectedChannels().some(c => c.url === channel.url)) {
      setSelectedChannels(prev => prev.filter(c => c.url !== channel.url));
      if (unmutedChannel() === channel.url) setUnmutedChannel(null);
    } else {
      if (selectedChannels().length < 9) {
        setSelectedChannels(prev => [...prev, channel]);
      }
    }
  };

  const handleMuteToggle = (e, url) => {
    e.stopPropagation();
    if (unmutedChannel() === url) {
      setUnmutedChannel(null);
    } else {
      setUnmutedChannel(url);
    }
  };

  const [collapsedGroups, setCollapsedGroups] = createSignal(new Set(['General', 'Region', 'Country']));

  const filteredSources = createMemo(() => {
    const q = sidebarSearch().toLowerCase();
    if (!q) return sources();
    return sources().filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.group && s.group.toLowerCase().includes(q))
    );
  });

  const groups = createMemo(() => {
    const all = filteredSources().map(s => s.group || 'OTHER');
    const unique = [...new Set(all)];
    const priority = ['LIVE CHANNELS', 'General', 'Region', 'Country'];
    
    return unique.sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  });

  const toggleGroup = (group) => {
    const next = new Set(collapsedGroups());
    if (next.has(group)) next.delete(group);
    else next.add(group);
    setCollapsedGroups(next);
  };

  return (
    <div class="flex-1 flex overflow-hidden bg-bg_main transition-colors duration-500 relative">
      {/* Registry Sidebar */}
      <aside 
         class={`border-r border-border_main bg-bg_sidebar/95 flex flex-col shrink-0 transition-all duration-300 relative group/sidebar ${isSidebarOpen() ? 'w-64 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
      >
         {/* Sidebar Toggle Tab */}
         <button 
            onClick={() => setSidebarOpen(false)}
            class="absolute top-[40%] -right-3.5 z-50 w-7 h-16 bg-[#1a1a1a] flex items-center justify-center rounded-r-sm border border-l-0 border-border_main hover:bg-text_accent group/toggle transition-all shadow-[8px_0_15px_rgba(0,0,0,0.5)] border-l-transparent"
            title="COLLAPSE SIDEBAR"
         >
            <svg class="w-3.5 h-3.5 text-white/40 group-hover:text-black transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="15 18 9 12 15 6"/></svg>
         </button>

         <div class="p-4 border-b border-border_main flex flex-col gap-3">
            <div class="flex justify-between items-center">
               <span class="text-[9px] font-black tracking-[0.3em] text-text_secondary uppercase">STREAM SOURCES</span>
               <Show when={selectedChannels().length > 0}>
                  <button 
                    onClick={() => { setSelectedChannels([]); setUnmutedChannel(null); setFocusedChannel(null); }}
                    class="text-[8px] font-black text-red-500 border border-red-500/40 px-2 py-0.5 rounded-sm hover:bg-red-600 hover:text-white transition-all"
                  >
                    CLOSE ALL
                  </button>
               </Show>
            </div>
            <input 
               type="text" 
               placeholder="SEARCH SOURCES..." 
               onInput={(e) => {
                  setSidebarSearch(e.target.value);
                  if (e.target.value) setCollapsedGroups(new Set());
                  else setCollapsedGroups(new Set(['General', 'Region', 'Country']));
               }}
               class="w-full bg-bg_main/40 border border-border_main px-3 py-1.5 text-[9px] font-mono text-text_primary placeholder:text-text_secondary/20 focus:outline-none focus:border-text_accent transition-all uppercase"
            />
         </div>
        <div class="flex-1 overflow-y-auto win-scroll p-4 flex flex-col gap-5 font-mono">
           <For each={groups()}>
              {(group) => (
                 <div class="flex flex-col gap-1">
                    <button 
                       onClick={() => toggleGroup(group)}
                       class="text-[9px] font-black text-text_accent uppercase tracking-[0.2em] border-b border-text_accent/10 pb-1 flex items-center justify-between group/header hover:text-text_primary transition-colors"
                    >
                       <span>{group}</span>
                       <svg 
                          class={`w-3 h-3 transition-transform duration-300 ${collapsedGroups().has(group) ? '-rotate-90' : ''}`} 
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                       >
                          <polyline points="6 9 12 15 18 9"/>
                       </svg>
                    </button>
                    <Show when={!collapsedGroups().has(group)}>
                        <div class="flex flex-col gap-0.5 mt-1 animate-in slide-in-from-top-1 duration-200">
                           <For each={filteredSources().filter(s => s.group === group)}>
                              {(s) => {
                                const isSelected = createMemo(() => selectedChannels().some(c => c.url === s.url));
                                return (
                                  <button 
                                     onClick={() => s.directToggle ? toggleChannel(s) : setActiveSource(s)}
                                     class={`px-3 py-1.5 text-left text-[10px] font-bold hover:bg-text_accent/10 border-l border-transparent hover:border-text_accent transition-all ${activeSource()?.url === s.url || isSelected() ? 'text-text_accent bg-text_accent/5 border-text_accent' : 'text-text_secondary opacity-60 hover:opacity-100'}`}
                                  >
                                     <div class="flex items-center gap-2 overflow-hidden">
                                        <Show when={s.directToggle}>
                                           <div class={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected() ? 'bg-text_accent animate-pulse shadow-[0_0_8px_var(--text-accent)]' : 'bg-white/20'}`}></div>
                                        </Show>
                                        <span class="truncate block">{s.name.toUpperCase()}</span>
                                     </div>
                                  </button>
                                );
                             }}
                          </For>
                       </div>
                    </Show>
                 </div>
              )}
           </For>
        </div>
        <div class="p-4 border-t border-border_main text-[8px] text-text_secondary opacity-30 text-center uppercase tracking-widest">ENQY TERMINAL // MEDIA ANALYTICS</div>
      </aside>

      {/* Viewing Area */}
      <div class="flex-1 flex flex-col overflow-hidden relative font-mono">
        <Show when={activeSource()}>
          <div class="absolute inset-0 z-50 flex items-center justify-center p-12 bg-bg_main/40 backdrop-blur-sm animate-in fade-in duration-300">
             <div class="w-full max-w-4xl h-full max-h-[80vh] flex flex-col overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]">
               <ChannelBrowser 
                  source={activeSource()} 
                  selected={selectedChannels} 
                  onToggle={toggleChannel} 
                  onClose={() => setActiveSource(null)} 
               />
             </div>
          </div>
        </Show>

        <Show when={selectedChannels().length === 0} fallback={
          <div class={`flex-1 p-6 grid gap-4 h-full 
            ${selectedChannels().length === 1 ? 'grid-cols-1' : ''}
            ${selectedChannels().length >= 2 && selectedChannels().length <= 4 ? 'grid-cols-2' : ''}
            ${selectedChannels().length >= 5 ? 'grid-cols-3' : ''}
            overflow-y-auto win-scroll pb-20`}>
            <For each={selectedChannels()}>
              {(channel) => (
                <div class={`flex flex-col border border-border_main bg-black relative group overflow-hidden transition-all duration-300 hover:border-text_accent/40 ${unmutedChannel() === channel.url ? 'ring-2 ring-text_accent' : ''}`}>
                   <div class="absolute top-0 inset-x-0 h-10 bg-gradient-to-b from-black/90 to-transparent z-50 px-4 flex items-center justify-between opacity-50 group-hover:opacity-100 transition-opacity">
                      <div class="flex items-center gap-3">
                         <div class={`w-1.5 h-1.5 rounded-full animate-pulse ${unmutedChannel() === channel.url ? 'bg-text_accent shadow-[0_0_8px_var(--text-accent)]' : 'bg-red-600'}`}></div>
                         <span class="text-[9px] font-black text-white uppercase tracking-[0.2em] drop-shadow-md">{channel.name}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <button onClick={(e) => handleMuteToggle(e, channel.url)} class="p-1.5 hover:bg-white/10 rounded-sm transition-all" title="TOGGLE AUDIO">
                           <Show when={unmutedChannel() === channel.url} fallback={
                              <svg class="w-4 h-4 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                           }>
                              <svg class="w-4 h-4 text-text_accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                           </Show>
                        </button>
                        <button onClick={() => setFocusedChannel(channel)} class="p-1.5 hover:bg-white/10 rounded-sm transition-all" title="FOCUS VIEW">
                           <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        </button>
                        <button onClick={() => toggleChannel(channel)} class="p-1.5 bg-red-600/10 hover:bg-red-600 text-white/60 hover:text-white rounded-sm border border-red-600/20 transition-all ml-1" title="CLOSE STREAM">
                           <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                   </div>
                   <div class="flex-1 bg-black overflow-hidden relative">
                      <Show when={channel.isYoutube} fallback={
                        <HlsVideoPlayer src={channel.url} onClose={() => toggleChannel(channel)} muted={unmutedChannel() !== channel.url} autoPlay={true} />
                      }>
                        <iframe
                          class="absolute inset-0 w-full h-full pointer-events-none scale-[1.3]"
                          src={`${channel.url}?autoplay=1&mute=${unmutedChannel() === channel.url ? '0' : '1'}&controls=0&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0`}
                          frameborder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowfullscreen
                        ></iframe>
                      </Show>
                   </div>
                </div>
              )}
            </For>
          </div>
        }>
          <div class="flex-1 flex flex-col items-center justify-center gap-6 opacity-30 text-text_secondary">
             <svg class="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
             <div class="flex flex-col items-center gap-1">
                <span class="text-[12px] font-black tracking-[0.4em] uppercase">SYSTEM IDLE: NO STREAM SELECTED</span>
                <span class="text-[9px] font-mono uppercase">Please choose channels from the STREAM SOURCES library on the left.</span>
             </div>
          </div>
        </Show>
      </div>

      {/* TACTICAL ZOOM MODAL */}
      <Show when={!isSidebarOpen()}><button onClick={() => setSidebarOpen(true)} class="absolute top-[40%] left-0 z-[60] w-7 h-16 bg-text_accent/20 border border-l-0 border-text_accent flex items-center justify-center rounded-r-sm hover:bg-text_accent transition-all animate-in slide-in-from-left-2 group shadow-[5px_0_15px_rgba(0,255,65,0.2)]" title="EXPAND SIDEBAR"><svg class="w-3.5 h-3.5 text-text_accent group-hover:text-black transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"/></svg></button></Show><Show when={focusedChannel()}>
        <div class="fixed inset-0 z-[100] bg-black/95 flex flex-col p-6 animate-in zoom-in duration-300">
           <div class="flex justify-between items-center mb-6 border-b border-text_accent/20 pb-4">
              <div class="flex flex-col">
                 <h2 class="text-text_accent font-black tracking-[0.4em] text-[14px]">FULLSCREEN VIEW: {focusedChannel().name.toUpperCase()}</h2>
                 <span class="text-[9px] text-text_secondary font-mono tracking-widest mt-1 opacity-60 uppercase">Active Stream // Sound: {unmutedChannel() === focusedChannel().url ? 'ON' : 'OFF'}</span>
              </div>
              <div class="flex gap-4">
                <button onClick={() => setUnmutedChannel(focusedChannel().url === unmutedChannel() ? null : focusedChannel().url)} class={`px-6 py-2 border font-black text-[11px] tracking-widest uppercase transition-all ${unmutedChannel() === focusedChannel().url ? 'bg-text_accent text-black border-text_accent' : 'border-border_main text-text_secondary hover:text-white'}`}>
                    {unmutedChannel() === focusedChannel().url ? 'MUTED' : 'ENABLE AUDIO'}
                </button>
                <button onClick={() => setFocusedChannel(null)} class="px-6 py-2 bg-text_accent/10 border border-text_accent text-text_accent font-black text-[11px] tracking-widest uppercase hover:bg-text_accent hover:text-black transition-all">CLOSE</button>
              </div>
           </div>
           <div class="flex-1 bg-black border border-border_main relative group overflow-hidden">
              <Show when={focusedChannel().isYoutube} fallback={
                <HlsVideoPlayer src={focusedChannel().url} muted={unmutedChannel() !== focusedChannel().url} autoPlay={true} />
              }>
                <iframe
                   class="absolute inset-0 w-full h-full pointer-events-none scale-[1.1]"
                   src={`${focusedChannel().url}?autoplay=1&mute=${unmutedChannel() === focusedChannel().url ? '0' : '1'}&controls=1&modestbranding=1&rel=0`}
                   frameborder="0"
                   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                   allowfullscreen
                ></iframe>
              </Show>
              <div class="absolute bottom-4 right-4 pointer-events-none p-4 bg-black/80 border border-text_accent/20">
                 <div class="text-[8px] text-text_accent font-black tracking-widest animate-pulse uppercase">CONNECTION QUALITY: OPTIMAL (1080p)</div>
              </div>
           </div>
        </div>
      </Show>
    </div>
  );
}

