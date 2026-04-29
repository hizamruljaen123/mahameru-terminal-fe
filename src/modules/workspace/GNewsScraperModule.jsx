import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';

export default function GNewsScraperModule(props) {
  const [keywords, setKeywords] = createSignal("");
  const [keywordList, setKeywordList] = createSignal([]);
  const [currentIdx, setCurrentIdx] = createSignal(0);
  const [news, setNews] = createSignal([]);
  const [isActive, setIsActive] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [timerStatus, setTimerStatus] = createSignal("WAITING");
  const [filterKeyword, setFilterKeyword] = createSignal("");

  let intervalId = null;

  const filteredNews = () => {
    const fk = filterKeyword() || (keywordList().length > 0 ? keywordList()[0] : "");
    if (!fk) return news();
    return news().filter(item => (item.keyword || "").toUpperCase() === fk.toUpperCase());
  };

  onMount(() => {
    const listener = (e) => {
      if (e.detail && e.detail.keyword) {
        const kw = e.detail.keyword.trim();
        if (!kw) return;

        setKeywordList(prev => {
          if (!prev.includes(kw)) {
            const updated = [...prev, kw];
            setKeywords(updated.join(", "));
            return updated;
          }
          return prev;
        });

        setTimeout(() => {
          const idx = keywordList().findIndex(k => k.toUpperCase() === kw.toUpperCase());
          if (idx !== -1) setCurrentIdx(idx);
          setFilterKeyword(kw);
          setIsActive(true);
          scrapeAllKeywords();

          if (intervalId) clearInterval(intervalId);
          intervalId = setInterval(scrapeAllKeywords, 60000);
        }, 50);
      }
    };

    window.addEventListener('set-gnews-keyword', listener);
    onCleanup(() => window.removeEventListener('set-gnews-keyword', listener));
  });

  const scrapeAllKeywords = async () => {
    if (keywordList().length === 0) return;
    
    setLoading(true);
    setTimerStatus("DOWNLOADING RECENT INTEL...");

    try {
      const allFetchedNews = [];
      await Promise.all(keywordList().map(async (keyword) => {
        try {
          const url = `${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(keyword)}`;
          const res = await fetch(url);
          const parsed = await res.json();

          if (parsed.status === 'success' && Array.isArray(parsed.data)) {
            const mapped = parsed.data.map(item => ({
              title: item.title,
              link: item.link,
              source: item.publisher || 'GNEWS',
              timestamp: item.time || (Date.now() / 1000),
              keyword: keyword
            }));
            allFetchedNews.push(...mapped);
          }
        } catch (e) {
          console.error(`[GNewsScraperModule] fetch error for ${keyword}:`, e);
        }
      }));

      if (allFetchedNews.length > 0) {
        setNews(prev => {
          const combined = [...allFetchedNews, ...prev];
          const unique = [];
          const seen = new Set();
          for (const item of combined) {
            const uniqueKey = item.link + "-" + item.keyword;
            if (!seen.has(uniqueKey)) {
              seen.add(uniqueKey);
              unique.push(item);
            }
          }
          return unique.sort((a, b) => b.timestamp - a.timestamp);
        });
      }
    } catch (e) {
      console.error("[GNewsScraperModule] scrape cycle error:", e);
    } finally {
      setLoading(false);
      setTimerStatus("UP TO DATE. SLEEPING 60s");
    }
  };

  const handleStart = () => {
    const list = keywords()
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (list.length === 0) return;

    setKeywordList(list);
    setIsActive(true);
    setCurrentIdx(0);
    setFilterKeyword(list[0]);
    setNews([]);
    
    scrapeAllKeywords();

    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(scrapeAllKeywords, 60000);
  };

  const handleStop = () => {
    setIsActive(false);
    if (intervalId) clearInterval(intervalId);
    setTimerStatus("STOPPED");
  };

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId);
  });

  return (
    <div class="h-full flex flex-col bg-[#111] border border-white/5 rounded-sm overflow-hidden font-mono group">
      {/* Header */}
      <div class="drag-handle flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5 cursor-grab active:cursor-grabbing">
        <div class="flex items-center gap-2">
          <div class={`w-1.5 h-1.5 rounded-full ${isActive() ? 'bg-text_accent animate-pulse' : 'bg-text_accent/40'}`}></div>
          <span class="text-[9px] font-black text-text_accent uppercase tracking-widest">
            GNEWS ROTATION ENGINE
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button 
            onClick={() => props.onRemove(props.instanceId)}
            class="text-text_secondary/40 hover:text-red-500 transition-colors"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Input / Config View */}
      <Show when={!isActive()}>
        <div class="flex-1 flex flex-col p-4 justify-center animate-in fade-in duration-300 gap-4">
          <div class="text-center">
            <h3 class="text-[11px] font-black text-text_primary tracking-widest uppercase mb-1">CONFIGURE TARGETS</h3>
            <p class="text-[8px] text-text_secondary/60 uppercase tracking-wider">Scrape Google News alternately every minute.</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[8px] font-bold text-cyan-400 uppercase tracking-widest">KEYWORDS (COMMA SEPARATED):</label>
            <textarea 
              rows="3"
              placeholder="e.g. TRUMP, MINYAK, PERANG IRAN, PRESIDEN AMERIKA"
              value={keywords()}
              onInput={(e) => setKeywords(e.target.value)}
              class="w-full bg-black/40 border border-border_main/60 p-2.5 text-[10px] font-mono text-text_primary outline-none focus:border-cyan-500/50 transition-all uppercase rounded-md tracking-wider placeholder-text_secondary/30 resize-none"
            />
          </div>

          <button 
            onClick={handleStart}
            disabled={!keywords().trim()}
            class={`w-full py-2.5 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-[9px] font-black tracking-[0.2em] uppercase rounded transition-all flex items-center justify-center gap-2 ${
              keywords().trim() ? 'text-cyan-400 border-cyan-400' : 'text-text_secondary/30 border-white/5 cursor-not-allowed'
            }`}
          >
            <span>▶ LAUNCH ENGINE</span>
          </button>
        </div>
      </Show>

      {/* Live Feed Scrape View */}
      <Show when={isActive()}>
        <div class="flex-1 flex flex-col overflow-hidden animate-in zoom-in-[0.98] duration-300">
          
          <div class="px-3 py-2 bg-cyan-500/5 border-b border-cyan-500/10 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2 overflow-hidden mr-2">
              <span class="text-[8px] font-black text-cyan-400 animate-pulse shrink-0">●</span>
              <span class="text-[8px] text-cyan-400/80 font-bold tracking-widest uppercase truncate">
                {timerStatus()}
              </span>
            </div>
            <Show when={loading()}>
              <div class="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent animate-spin rounded-full shrink-0"></div>
            </Show>
          </div>

          {/* Keyword Tabs Row */}
          <div class="px-3 py-1 bg-black/30 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <For each={keywordList()}>
              {(kw) => (
                <button 
                  onClick={() => setFilterKeyword(kw)}
                  class={`px-2 py-0.5 text-[7px] font-bold rounded-sm border uppercase transition-all whitespace-nowrap ${filterKeyword().toUpperCase() === kw.toUpperCase() ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'border-transparent text-white/40 hover:text-white'}`}
                >
                  {kw}
                </button>
              )}
            </For>
          </div>

          <div class="flex-1 overflow-y-auto win-scroll p-3 space-y-2">
            <For each={filteredNews()}>
              {(item) => (
                <div 
                  onClick={() => window.open(item.link, '_blank')}
                  class="p-2.5 bg-black/20 border border-white/5 rounded hover:border-cyan-500/20 hover:bg-cyan-500/[0.02] transition-all cursor-pointer group flex flex-col gap-1 border-l-2 border-l-transparent hover:border-l-cyan-500"
                >
                  <div class="flex items-center justify-between text-[7px] font-mono">
                    <div class="flex items-center gap-1.5">
                      <span class="text-cyan-500/60 font-black">{item.source}</span>
                      <span class="text-white/20">•</span>
                      <span class="text-white/40 font-black px-1 bg-white/5 rounded-[2px]">{item.keyword}</span>
                    </div>
                    <span class="text-text_secondary/40 font-bold">
                      {new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 class="text-[10px] font-bold text-text_primary group-hover:text-cyan-400 transition-colors leading-snug line-clamp-2 uppercase">
                    {item.title}
                  </h4>
                </div>
              )}
            </For>

            <Show when={news().length === 0 && !loading()}>
              <div class="h-full flex items-center justify-center text-[9px] text-text_secondary/30 uppercase tracking-widest text-center p-6 italic">
                Awaiting first telemetry wave...
              </div>
            </Show>
          </div>

          <div class="p-2 border-t border-border_main/20 bg-black/40 flex items-center justify-between shrink-0">
            <button 
              onClick={handleStop}
              class="px-2 py-1 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:bg-red-500/20 text-[7px] font-black uppercase tracking-widest rounded transition-all"
            >
              [ ABORT ]
            </button>
            <div class="flex gap-1 overflow-x-auto win-scroll max-w-[70%] pr-1">
              <For each={keywordList()}>
                {(kw, index) => (
                  <span class={`text-[7px] font-black px-1 rounded-[1px] shrink-0 ${index() === currentIdx() ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-text_secondary/40 border border-transparent'}`}>
                    {kw}
                  </span>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
