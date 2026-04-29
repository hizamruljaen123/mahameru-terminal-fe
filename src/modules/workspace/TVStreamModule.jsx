import { createSignal, onMount, onCleanup, createEffect, Show, For, createMemo } from 'solid-js';

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
             console.log(`[WORKSPACE_TV_RECOVERY] Reconnecting ${nextRetry}/${maxRetries} in 5s...`);
             setTimeout(initPlayer, 5000);
          } else {
             console.log(`[WORKSPACE_TV_CLOSED] Connection recovery failed.`);
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
        setRetries(0);
        videoRef.play().catch(() => handleError(true));
      });
      hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) handleError(true);
      });
    } else if (videoRef.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.src = props.src;
      videoRef.onerror = () => handleError(true);
      videoRef.play().catch(() => handleError(true));
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
    <div class="relative bg-black w-full h-full overflow-hidden">
      <Show when={error()}>
        <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/95 text-[#ef4444] border border-red-500/30 gap-2">
          <svg class={`w-6 h-6 opacity-80 ${retries() > 0 ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <Show when={retries() === 0} fallback={<path d="M21 12a9 9 0 1 1-6.219-8.56" />}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Show>
          </svg>
          <div class="text-[8px] font-mono font-black tracking-[0.2em] uppercase">
             {retries() > 0 ? `RECONNECTING... ATTEMPT ${retries()}/${maxRetries}` : 'CONNECTION_FAILED'}
          </div>
        </div>
      </Show>
      <video ref={videoRef} class="absolute inset-0 w-full h-full" muted={props.muted} playsInline style={{ "object-fit": 'contain' }} />
    </div>
  );
}

// --- MAIN WORKSPACE MODULE ---
export default function TVStreamModule(props) {
  const [selectedUrl, setSelectedUrl] = createSignal("");
  const [streamName, setStreamName] = createSignal("");
  const [isYoutube, setIsYoutube] = createSignal(false);
  const [muted, setMuted] = createSignal(true);

  // Browse state
  const [customInput, setCustomInput] = createSignal("");
  const [activeTab, setActiveTab] = createSignal("custom"); // 'custom' | 'sources' | 'channels'
  
  const [sources, setSources] = createSignal([]);
  const [selectedSource, setSelectedSource] = createSignal(null);
  const [channels, setChannels] = createSignal([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");

  onMount(() => {
    // Load sources if they exist
    const api = import.meta.env.VITE_TV_API || "";
    fetch(`${api}/api/tv/sources`)
      .then(r => r.json())
      .then(setSources)
      .catch(e => console.error("Error loading sources", e));
  });

  const parseYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const loadStream = (url, name = "CUSTOM STREAM") => {
    if (!url) return;
    setStreamName(name);
    
    const ytId = parseYoutubeId(url);
    if (ytId) {
      setSelectedUrl(`https://www.youtube.com/embed/${ytId}`);
      setIsYoutube(true);
    } else {
      setSelectedUrl(url);
      setIsYoutube(false);
    }
  };

  const selectSource = async (source) => {
    setSelectedSource(source);
    setIsLoading(true);
    setActiveTab("channels");
    try {
      const api = import.meta.env.VITE_TV_API || "";
      const url = `${api}/api/tv/channels?url=${encodeURIComponent(source.url)}&pageSize=100`;
      const res = await fetch(url);
      const data = await res.json();
      setChannels(data.channels || []);
    } catch (e) {
      console.error("Error fetching channels", e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredChannels = () => {
    const q = searchQuery().toLowerCase();
    if (!q) return channels();
    return channels().filter(c => c.name.toLowerCase().includes(q));
  };

  return (
    <div class="h-full flex flex-col bg-[#111] border border-white/5 rounded-sm overflow-hidden font-mono group">
      {/* Header */}
      <div class="drag-handle flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5 cursor-grab active:cursor-grabbing shrink-0">
        <div class="flex items-center gap-2">
          <div class={`w-1.5 h-1.5 rounded-full ${selectedUrl() ? 'bg-text_accent animate-pulse' : 'bg-text_accent/40'}`}></div>
          <span class="text-[9px] font-black text-text_accent uppercase tracking-widest truncate max-w-[150px]">
            {selectedUrl() ? streamName() : 'TV STREAM DEPLOYMENT'}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <Show when={selectedUrl()}>
            <button 
              onClick={() => setMuted(!muted())} 
              class={`p-1 border border-white/10 hover:border-text_accent/30 rounded-sm transition-all text-[9px] font-bold ${!muted() ? 'text-text_accent' : 'text-text_secondary'}`}
              title="Toggle Audio"
            >
              {muted() ? 'MUTED' : 'AUDIO ON'}
            </button>
            <button 
              onClick={() => { setSelectedUrl(""); setStreamName(""); }} 
              class="text-[9px] font-bold text-red-500 hover:bg-red-500 hover:text-white border border-red-500/40 px-2 py-1 rounded-sm transition-all"
            >
              STOP
            </button>
          </Show>
          <button
            onClick={() => props.onRemove(props.instanceId)}
            class="text-text_secondary/40 hover:text-red-500 transition-colors"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div class="flex-1 relative bg-black/20 overflow-hidden flex flex-col">
        <Show when={selectedUrl()} fallback={
          <div class="flex-1 flex flex-col p-4 overflow-hidden">
            {/* Tabs */}
            <div class="flex gap-1 border-b border-border_main/30 mb-3 shrink-0">
              <button 
                onClick={() => setActiveTab("custom")}
                class={`text-[9px] font-black tracking-widest px-3 py-1.5 border-t border-x rounded-t-md transition-all ${activeTab() === 'custom' ? 'bg-black/40 text-text_accent border-border_main/60 border-b-transparent' : 'border-transparent text-text_secondary/60 hover:text-text_primary'}`}
              >
                CUSTOM URL
              </button>
              <button 
                onClick={() => setActiveTab("sources")}
                class={`text-[9px] font-black tracking-widest px-3 py-1.5 border-t border-x rounded-t-md transition-all ${activeTab() === 'sources' || activeTab() === 'channels' ? 'bg-black/40 text-text_accent border-border_main/60 border-b-transparent' : 'border-transparent text-text_secondary/60 hover:text-text_primary'}`}
              >
                API SOURCES
              </button>
            </div>

            {/* Custom URL Tab */}
            <Show when={activeTab() === 'custom'}>
              <div class="flex flex-col gap-2 animate-in fade-in duration-200">
                <input 
                  type="text" 
                  placeholder="PASTE M3U8 OR YOUTUBE URL..."
                  value={customInput()}
                  onInput={(e) => setCustomInput(e.target.value)}
                  class="w-full bg-black/40 border border-border_main/60 p-2.5 text-[10px] font-mono text-text_primary outline-none focus:border-text_accent/50 rounded-md tracking-widest uppercase placeholder-text_secondary/30"
                />
                <button 
                  onClick={() => loadStream(customInput())}
                  disabled={!customInput()}
                  class={`p-2 border font-black text-[10px] tracking-widest uppercase rounded-md transition-all ${customInput() ? 'border-text_accent bg-text_accent/10 text-text_accent hover:bg-text_accent hover:text-black' : 'border-border_main/20 text-text_secondary/30 cursor-not-allowed'}`}
                >
                  DEPLOY STREAM
                </button>
                <span class="text-[8px] text-text_secondary/40 text-center uppercase tracking-wider mt-2">
                  Supports .m3u8 live streams & standard YouTube video URLs.
                </span>
              </div>
            </Show>

            {/* API Sources Tab */}
            <Show when={activeTab() === 'sources'}>
              <div class="flex-1 overflow-y-auto win-scroll animate-in fade-in duration-200 mt-1">
                <table class="w-full text-left border-collapse font-mono text-[11px]">
                  <thead>
                    <tr class="border-b border-border_main/30 text-text_secondary/60">
                      <th class="py-1 px-2 uppercase tracking-wider font-bold">Source Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={sources()} fallback={
                      <tr>
                        <td class="text-[9px] text-text_secondary/50 p-4 text-center animate-pulse uppercase tracking-widest">
                          No API Sources Available
                        </td>
                      </tr>
                    }>
                      {(source) => (
                        <tr 
                          onClick={() => selectSource(source)}
                          class="border-b border-border_main/10 hover:bg-white/5 cursor-pointer text-text_primary hover:text-text_accent transition-colors"
                        >
                          <td class="py-1.5 px-2 truncate">
                            {source.name.toUpperCase()}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>

            {/* Channels Tab (After source selected) */}
            <Show when={activeTab() === 'channels'}>
              <div class="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-200">
                <div class="flex items-center gap-2 mb-2 shrink-0">
                  <button 
                    onClick={() => setActiveTab("sources")}
                    class="text-[9px] text-text_accent hover:underline font-black uppercase tracking-widest"
                  >
                    &lt; BACK
                  </button>
                  <span class="text-[8px] text-text_secondary/40 uppercase truncate">
                    IN: {selectedSource()?.name}
                  </span>
                </div>
                <input 
                  type="text" 
                  placeholder="FILTER CHANNELS..." 
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.target.value)}
                  class="w-full bg-black/40 border border-border_main/40 px-2 py-1 text-[9px] font-mono text-text_primary focus:outline-none focus:border-text_accent/50 rounded uppercase mb-2 shrink-0"
                />
                
                <div class="flex-1 overflow-y-auto win-scroll">
                  <table class="w-full text-left border-collapse font-mono text-[11px]">
                    <thead>
                      <tr class="border-b border-border_main/30 text-text_secondary/60">
                        <th class="py-1 px-2 uppercase tracking-wider font-bold">Channel Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      <Show when={!isLoading()} fallback={
                        <tr>
                          <td class="text-[9px] text-text_accent font-black tracking-widest text-center animate-pulse py-4 uppercase">
                            FETCHING CHANNELS...
                          </td>
                        </tr>
                      }>
                        <For each={filteredChannels()} fallback={
                          <tr>
                            <td class="text-[9px] text-text_secondary/50 p-4 text-center uppercase">
                              No Channels Found
                            </td>
                          </tr>
                        }>
                          {(channel) => (
                            <tr 
                              onClick={() => loadStream(channel.url, channel.name)}
                              class="border-b border-border_main/10 hover:bg-white/5 cursor-pointer text-text_primary hover:text-text_accent transition-colors"
                            >
                              <td class="py-1.5 px-2 truncate max-w-[250px]">
                                {channel.name.toUpperCase()}
                              </td>
                            </tr>
                          )}
                        </For>
                      </Show>
                    </tbody>
                  </table>
                </div>
              </div>
            </Show>
          </div>
        }>
          {/* Stream Playing */}
          <div class="flex-1 relative bg-black">
            <Show when={isYoutube()} fallback={
              <HlsVideoPlayer src={selectedUrl()} muted={muted()} />
            }>
              <iframe
                class="absolute inset-0 w-full h-full pointer-events-none scale-[1.3]"
                src={`${selectedUrl()}?autoplay=1&mute=${muted() ? '1' : '0'}&controls=0&modestbranding=1&rel=0`}
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
