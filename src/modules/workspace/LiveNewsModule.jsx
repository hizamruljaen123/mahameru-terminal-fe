import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';

const CATEGORIES = [
  'AGRICULTURE', 'ARBITRATION', 'ARMY NEWS', 'AUTOMOTIVE', 'AVIATION',
  'BISNIS', 'BUSINESS', 'BUSINESS RISK', 'BUSINESS/CONTRACTS',
  'CONSUMER', 'CONSUMER GOODS', 'CRYPTO', 'CRYPTO ANALISIS', 'CRYPTO INDONESIA',
  'CYBER SECURITY', 'DEFENSE NEWS', 'DOCUMENTATION', 'ECONOMIC INTEL', 'ECONOMY',
  'EKONOMI', 'ENERGI', 'ENERGY', 'ENTERTAINMENT', 'ENVIRONMENT', 'ENVIRONMENTAL',
  'ESG COMPLIANCE', 'FINANCE', 'GEOPOLITICS', 'HEALTH', 'HEALTH LAW',
  'HEALTHCARE', 'HUKUM BISNIS', 'HUKUM INTERNASIONAL', 'HUKUM PIDANA', 'INDONESIA',
  'INDUSTRI', 'INDUSTRIAL', 'INDUSTRIAL INTEL', 'INFORMATION', 'INFRASTRUKTUR',
  'INTELLIGENCE', 'INTERNATIONAL', 'INVESTASI', 'KEUANGAN', 'LEGAL COMPLIANCE',
  'LEGAL RISK', 'LINGKUNGAN', 'LOGISTIK', 'LOGISTICS', 'MANUFACTURING', 'MILITARY NEWS',
  'MINING', 'NAVAL NEWS', 'OFFICIAL DOCUMENTATION', 'OFFICIAL SPEECHES', 'PEMERINTAHAN',
  'PERDAGANGAN', 'POLITICS', 'PRESS', 'PRESS RELEASES', 'PROPERTY', 'REAL ESTATE',
  'RETAIL', 'RISK MANAGEMENT', 'SCIENCE', 'SERVICE', 'SOCIAL RISK', 'SOSIAL', 'SPORTS',
  'SUPPLY CHAIN', 'TECHNOLOGY', 'TEKNOLOGI', 'TENAGA KERJA', 'TRADE LAW', 'UPDATES',
  'UTILITY', 'WORLD'
];

let eventSource = null;

export default function LiveNewsModule(props) {
  const [selectedCategory, setSelectedCategory] = createSignal(null);
  const [news, setNews] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [searchTerm, setSearchTerm] = createSignal("");

  const getWorkspaceTickers = () => {
    const list = new Set();
    document.querySelectorAll('.drag-handle, .font-bold, button').forEach(el => {
      const txt = el.textContent || "";
      const matches = txt.match(/\b[A-Z]{2,6}\b/g);
      if (matches) {
        matches.forEach(m => {
          if (!['OPEN', 'HIGH', 'LOW', 'CLOSE', 'LOAD', 'TAB', 'EDIT', 'DONE', 'FILE', 'ANALYZE', 'INFO'].includes(m)) {
            list.add(m);
          }
        });
      }
    });
    return Array.from(list);
  };

  const fetchInitialNews = async (category) => {
    setLoading(true);
    setNews([]);
    
    const tickers = getWorkspaceTickers();
    let query = tickers.length > 0 ? tickers.join(" ") : category;
    
    if (!query) {
      query = "Ekonomi";
    }

    try {
      const url = `${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const parsed = await res.json();

      if (parsed.status === 'success' && Array.isArray(parsed.data)) {
        const mapped = parsed.data.map(item => ({
          title: item.title,
          link: item.link,
          source: item.publisher || 'GNEWS',
          timestamp: item.time || Date.now(),
          category: category
        }));

        setNews(mapped.slice(0, 15));
      }
    } catch (e) {
      console.error("[LiveNewsModule] fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const startStream = (category) => {
    if (eventSource) eventSource.close();
    eventSource = new EventSource(`${import.meta.env.VITE_API_BASE}/stream`);

    eventSource.onmessage = (event) => {
      if (!event.data || event.data.startsWith(':')) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.updates && typeof msg.updates === 'object') {
          let fresh = [];
          Object.entries(msg.updates).forEach(([cat, articles]) => {
            if (cat.toUpperCase() === category.toUpperCase() && Array.isArray(articles)) {
              fresh = [...fresh, ...articles];
            }
          });
          
          if (fresh.length > 0) {
            setNews(prev => {
              const combined = [...fresh, ...prev];
              const unique = [];
              const seen = new Set();
              for (const item of combined) {
                if (!seen.has(item.link)) {
                  seen.add(item.link);
                  unique.push(item);
                }
              }
              return unique.sort((a, b) => b.timestamp - a.timestamp);
            });
          }
        }
      } catch (err) {
        console.warn('[LiveNewsModule] parse error:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setTimeout(() => startStream(category), 5000);
    };
  };

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    fetchInitialNews(cat);
    startStream(cat);
    
    // Switch tracking focus in GNewsScraperModule
    window.dispatchEvent(new CustomEvent('set-gnews-keyword', { detail: { keyword: cat } }));
  };

  onCleanup(() => {
    if (eventSource) eventSource.close();
  });

  const filteredCategories = () =>
    CATEGORIES.filter(c => c.toLowerCase().includes(searchTerm().toLowerCase()));

  return (
    <div class="h-full flex flex-col bg-[#111] border border-white/5 rounded-sm overflow-hidden font-mono group">
      {/* Module Header */}
      <div class="drag-handle flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5 cursor-grab active:cursor-grabbing">
        <div class="flex items-center gap-2">
          <div class={`w-1.5 h-1.5 rounded-full ${selectedCategory() ? 'bg-text_accent animate-pulse' : 'bg-text_accent/40'}`}></div>
          <span class="text-[9px] font-black text-text_accent uppercase tracking-widest">
            {selectedCategory() ? `LIVE FEED: ${selectedCategory()}` : 'NEWS STREAM DEPLOYMENT'}
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

      {/* Category Selector View */}
      <Show when={!selectedCategory()}>
        <div class="flex-1 flex flex-col p-4 overflow-hidden animate-in fade-in duration-300">
          <div class="relative mb-3">
            <input
              type="text"
              placeholder="SEARCH CATEGORIES..."
              value={searchTerm()}
              onInput={(e) => setSearchTerm(e.target.value)}
              class="w-full bg-black/40 border border-border_main/60 p-2 text-[10px] font-mono text-text_primary outline-none focus:border-text_accent/50 transition-all uppercase rounded-md tracking-widest placeholder-text_secondary/30"
            />
          </div>

          <div class="flex-1 overflow-y-auto win-scroll grid grid-cols-2 gap-2 pr-1">
            <For each={filteredCategories()}>
              {(cat) => (
                <button
                  onClick={() => handleSelectCategory(cat)}
                  class="p-3 bg-black/20 border border-white/5 hover:border-text_accent/30 hover:bg-text_accent/5 text-[9px] font-black text-text_secondary hover:text-text_accent transition-all uppercase text-left tracking-wider rounded-md flex items-center justify-between group/cat"
                >
                  <span>{cat}</span>
                  <span class="opacity-0 group-hover/cat:opacity-100 transition-opacity text-text_accent">→</span>
                </button>
              )}
            </For>

            {/* Type-in custom category if not in list */}
            <Show when={searchTerm().trim() && !CATEGORIES.includes(searchTerm().trim().toUpperCase())}>
              <button
                onClick={() => handleSelectCategory(searchTerm().trim().toUpperCase())}
                class="p-3 bg-text_accent/5 border border-text_accent/30 hover:bg-text_accent/10 text-[9px] font-black text-text_accent transition-all uppercase text-left tracking-wider rounded-md flex items-center justify-between group/cat col-span-2"
              >
                <span>DEPLOY: {searchTerm().trim().toUpperCase()}</span>
                <span>⚡</span>
              </button>
            </Show>
          </div>
        </div>
      </Show>

      {/* Live Articles List View */}
      <Show when={selectedCategory()}>
        <div class="flex-1 flex flex-col overflow-hidden animate-in zoom-in-[0.98] duration-300">

          <Show when={loading()}>
            <div class="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px] z-10 gap-3">
              <div class="w-6 h-6 border-2 border-text_accent border-t-transparent animate-spin rounded-full"></div>
              <span class="text-[8px] font-black text-text_accent uppercase tracking-widest animate-pulse">Retrieving Data...</span>
            </div>
          </Show>

          <div class="flex-1 overflow-y-auto win-scroll p-3 space-y-2">
            <For each={news()}>
              {(item) => (
                <div
                  onClick={() => window.open(item.link, '_blank')}
                  class="p-2.5 bg-black/20 border border-white/5 rounded hover:border-text_accent/20 hover:bg-white/[0.02] transition-all cursor-pointer group flex flex-col gap-1 border-l-2 border-l-transparent hover:border-l-text_accent"
                >
                  <div class="flex items-center justify-between text-[7px] font-mono">
                    <span class="text-text_accent/60 font-black">{item.source}</span>
                    <span class="text-text_secondary/40 font-bold">
                      {new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 class="text-[10px] font-bold text-text_primary group-hover:text-text_accent transition-colors leading-snug line-clamp-2 uppercase">
                    {item.title}
                  </h4>
                  <Show when={item.sentiment}>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span class={`text-[7px] font-black px-1 rounded-[1px] ${String(item.sentiment).toUpperCase() === 'NEGATIVE' ? 'bg-red-500/20 text-red-500' :
                          String(item.sentiment).toUpperCase() === 'POSITIVE' ? 'bg-green-500/20 text-green-500' : 'bg-white/10 text-text_secondary/60'
                        }`}>
                        {String(item.sentiment).toUpperCase()}
                      </span>
                    </div>
                  </Show>
                </div>
              )}
            </For>

            <Show when={news().length === 0 && !loading()}>
              <div class="h-full flex items-center justify-center text-[9px] text-text_secondary/30 uppercase tracking-widest text-center p-6 italic">
                No active signals for this category.<br />Awaiting global telemetry...
              </div>
            </Show>
          </div>

          <div class="p-2 border-t border-border_main/20 bg-black/40 flex items-center justify-between shrink-0">
            <button
              onClick={() => setSelectedCategory(null)}
              class="px-2 py-1 bg-white/5 border border-white/5 hover:border-text_accent/20 text-text_secondary/60 hover:text-text_accent text-[7px] font-black uppercase tracking-widest rounded transition-all"
            >
              [ CHANGE CATEGORY ]
            </button>
            <span class="text-[7px] text-text_secondary/20 italic tracking-widest animate-pulse font-black">
              STREAMING_DATA
            </span>
          </div>
        </div>
      </Show>
    </div>
  );
}
