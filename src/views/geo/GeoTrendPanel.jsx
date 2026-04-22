import { createSignal, onMount, For, Show } from 'solid-js';

export default function GeoTrendPanel() {
  const [trends, setTrends] = createSignal([]);
  const [total, setTotal] = createSignal(0);
  const [isLoading, setIsLoading] = createSignal(true);
  const [selectedDate, setSelectedDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [selectedNews, setSelectedNews] = createSignal([]);
  const [isNewsLoading, setIsNewsLoading] = createSignal(false);

  const fetchTrends = async (date) => {
    setIsLoading(true);
    try {
      // Fetch from the new MySQL-based endpoint on port 5001
      const res = await fetch(`${import.meta.env.VITE_ARCHIVE_API}/api/news/geo-trending?date=${date}`);
      const result = await res.json();
      if (result.success) {
        setTrends(result.data.mentions || []);
        setTotal(result.data.totalArticles || 0);
      }
    } catch (e) {
      console.error("Geo Trends Fetch Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNews = async (date) => {
    setIsNewsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_ARCHIVE_API}/api/news/archive-by-date?date=${date}`);
      const result = await res.json();
      if (result.success) {
        setSelectedNews(result.results || []);
      }
    } catch (e) {
      console.error("News Fetch Error:", e);
    } finally {
      setIsNewsLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    fetchTrends(newDate);
    fetchNews(newDate);
  };

  onMount(() => {
    fetchTrends(selectedDate());
    fetchNews(selectedDate());
  });

  return (
    <div class="h-full flex bg-[#050d1a] text-[#e2e8f0] overflow-hidden">
      {/* LEFT: TRENDS LIST */}
      <div class="flex-1 flex flex-col p-6 overflow-hidden">
        <div class="flex justify-between items-end mb-8 border-b border-[#1e3a5f] pb-4">
          <div>
            <h2 class="text-2xl font-black font-mono text-[#3b82f6] uppercase tracking-[0.2em]">GEOGRAPHIC_TREND_VECTOR</h2>
            <p class="text-[10px] text-[#475569] font-mono mt-1 tracking-widest uppercase">ANALYZING NEWS_SIGNAL DENSITY PER TERRITORY FROM ARCHIVE</p>
          </div>
          <div class="flex items-center gap-6">
            <div class="flex flex-col gap-1">
              <span class="text-[9px] text-[#475569] font-mono tracking-widest uppercase">TEMPORAL_FILTER</span>
              <input 
                type="date" 
                value={selectedDate()} 
                onInput={handleDateChange}
                class="bg-[#0a192f] border border-[#1e3a5f] text-[#3b82f6] text-[12px] px-3 py-1 font-mono focus:outline-none focus:border-[#3b82f6]"
              />
            </div>
            <div class="text-right">
              <div class="text-[9px] text-[#475569] font-mono tracking-widest uppercase">BUFFER_SAMPLE_SIZE</div>
              <div class="text-[20px] font-black text-[#3b82f6] font-mono">{total()} <span class="text-[10px] opacity-40">PKTS</span></div>
            </div>
          </div>
        </div>

        {isLoading() ? (
          <div class="flex-1 flex items-center justify-center">
              <div class="flex flex-col items-center gap-4">
                  <div class="w-12 h-12 border-2 border-t-[#3b82f6] border-[#1e3a5f] rounded-full animate-spin"></div>
                  <span class="text-[10px] font-mono text-[#3b82f6] animate-pulse uppercase tracking-[0.5em]">CALCULATING_SIGMA_DENSITY...</span>
              </div>
          </div>
        ) : (
          <div class="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto win-scroll pr-2">
            <For each={trends()}>
              {(trend, i) => (
                <div class="relative group p-4 border border-[#1e3a5f] bg-[#070f1e] overflow-hidden hover:border-[#3b82f6]/50 transition-all cursor-default h-fit">
                  {/* Visual Bar Background */}
                  <div 
                     class="absolute bottom-0 left-0 h-1 bg-[#3b82f6]/20 transition-all duration-1000" 
                     style={{ width: `${Math.min(100, (trend[1] / (trends()[0]?.[1] || 1)) * 100)}%` }}
                  />
                  
                  <div class="flex justify-between items-start mb-2">
                    <span class="text-[24px] font-black italic text-[#1e3a5f] group-hover:text-[#3b82f6]/20 transition-colors leading-none tracking-tighter">
                      #{String(i()+1).padStart(2, '0')}
                    </span>
                    <div class="px-2 py-0.5 bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] text-[10px] font-black font-mono">
                      {trend[1]} MSG
                    </div>
                  </div>

                  <div class="flex flex-col">
                    <span class="text-[18px] font-black text-[#f8fafc] group-hover:text-[#3b82f6] transition-colors uppercase tracking-tight font-mono">
                      {trend[0]}
                    </span>
                    <span class="text-[8px] text-[#475569] font-mono tracking-widest uppercase mt-1">
                      TERRITORY_SIGNAL_HOTSPOT
                    </span>
                  </div>
                </div>
              )}
            </For>
            <Show when={trends().length === 0}>
              <div class="col-span-full py-20 text-center opacity-30 text-[10px] font-mono uppercase tracking-widest">
                NO_SIGNALS_DETECTED_FOR_THIS_PERIOD
              </div>
            </Show>
          </div>
        )}
        
        <div class="mt-6 flex gap-4 text-[8px] font-mono text-[#1e3a5f] tracking-widest uppercase">
            <span>SOURCE: MYSQL_ARCHIVE (5001)</span>
            <span>●</span>
            <span>DATE: {selectedDate()}</span>
            <span>●</span>
            <span>ALGO: COUNTRY_DETECTOR_V2</span>
        </div>
      </div>

      {/* RIGHT: NEWS SIDEBAR */}
      <div class="w-[400px] border-l border-[#1e3a5f] bg-[#070f1e]/80 flex flex-col">
        <div class="p-4 border-b border-[#1e3a5f] flex justify-between items-center bg-[#0a192f]">
          <h3 class="text-[12px] font-black text-[#3b82f6] tracking-widest uppercase">ARCHIVED_NEWS_STREAM</h3>
          <span class="text-[10px] font-mono text-[#475569] uppercase">{selectedNews().length} ITEMS</span>
        </div>
        
        <div class="flex-1 overflow-y-auto p-4 space-y-4 win-scroll">
          <Show when={!isNewsLoading()} fallback={
            <div class="flex flex-col items-center justify-center py-20 gap-4">
              <div class="w-8 h-8 border-2 border-t-[#3b82f6] border-[#1e3a5f] rounded-full animate-spin"></div>
              <span class="text-[9px] font-mono text-[#3b82f6] animate-pulse">QUERYING_DATABASE...</span>
            </div>
          }>
            <For each={selectedNews()}>
              {(news) => (
                <div class="group border border-[#1e3a5f]/50 p-3 hover:border-[#3b82f6] transition-all bg-[#0d1b2a]/50">
                  <div class="flex flex-col gap-2">
                    <div class="flex justify-between items-start">
                      <span class="text-[9px] font-black text-[#3b82f6] bg-[#3b82f6]/10 px-1.5 py-0.5 border border-[#3b82f6]/20 uppercase">
                        {news.source || 'INTEL'}
                      </span>
                      <span class="text-[8px] text-[#475569] font-mono">
                        {new Date(news.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <a 
                      href={news.link} 
                      target="_blank" 
                      class="text-[11px] font-bold text-slate-200 group-hover:text-[#3b82f6] transition-colors uppercase leading-tight"
                    >
                      {news.title}
                    </a>
                    <div class="flex justify-between items-center mt-1">
                      <span class="text-[8px] text-[#475569] font-mono uppercase tracking-tighter truncate w-32">
                        {news.category || 'UNCATEGORIZED'}
                      </span>
                      <div class="flex items-center gap-2">
                        <Show when={news.sentiment}>
                          <span class={`text-[8px] font-black uppercase ${news.sentiment === 'positive' ? 'text-green-500' : news.sentiment === 'negative' ? 'text-red-500' : 'text-blue-400'}`}>
                            {news.sentiment}
                          </span>
                        </Show>
                        <div class={`w-1.5 h-1.5 rounded-full ${news.sentiment === 'positive' ? 'bg-green-500' : news.sentiment === 'negative' ? 'bg-red-500' : 'bg-blue-400'}`}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </For>
            <Show when={selectedNews().length === 0}>
               <div class="py-20 text-center opacity-20 text-[10px] italic font-mono uppercase">
                  no_news_records_found_for_this_timestamp
               </div>
            </Show>
          </Show>
        </div>

        <div class="p-3 border-t border-[#1e3a5f] bg-[#0a192f] text-[7px] text-[#475569] font-mono flex justify-between uppercase">
          <span>SECURE_CONNECTION_STABLE</span>
          <span>NODE: ARCHIVE_V1</span>
        </div>
      </div>
    </div>
  );
}

