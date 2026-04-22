import { createMemo, For, Show, createSignal, onMount } from 'solid-js';

export default function CyberIntelligenceView(props) {
  const [cyberNews, setCyberNews] = createSignal([]);
  const [isFetching, setIsFetching] = createSignal(true);

  const fetchCyberIntel = async () => {
    setIsFetching(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/news/cyber-intel?limit=100`);
      const res = await response.json();
      if (res.success) {
        setCyberNews(res.news || []);
      }
    } catch (err) {
      console.error("Failed to fetch cyber intel:", err);
    } finally {
      setIsFetching(false);
    }
  };

  onMount(() => {
    fetchCyberIntel();
    // Auto-refresh every 60 seconds for independent streaming
    const interval = setInterval(fetchCyberIntel, 60000);
    return () => clearInterval(interval);
  });

  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    const date = new Date(ts * 1000);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).toUpperCase();
  };

  return (
    <div class="flex-1 flex flex-col overflow-hidden bg-bg_main p-6 gap-6 win-scroll overflow-y-auto">
      {/* HEADER SECTION */}
      <div class="flex flex-col gap-2 border-l-4 border-text_accent pl-6 py-2 bg-text_accent/5">
        <h1 class="text-2xl font-black tracking-[0.2em] text-text_primary">CYBER ATTACK MAP</h1>

      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[calc(100%-100px)] min-h-[800px]">

        {/* LEFT COLUMN: LIVE THREAT MAP (KASPERSKY) */}
        <div class="xl:col-span-2 flex flex-col gap-4">


          <div class="flex-1 min-h-[600px] border border-white/5 rounded-lg overflow-hidden bg-black relative group shadow-2xl">

            <iframe
              width="100%"
              height="100%"
              src="https://cybermap.kaspersky.com/en/widget/dynamic/dark"
              frameborder="0"
              class="opacity-80 group-hover:opacity-100 transition-opacity duration-700 scale-100"
            ></iframe>
            {/* OVERLAY DECORATION */}
            <div class="absolute inset-0 pointer-events-none border-[20px] border-black/10 mix-blend-overlay"></div>
          </div>
        </div>

        {/* RIGHT COLUMN: RECENT THREAT FEEDS */}
        <div class="flex flex-col h-full max-h-[600px] gap-3">
          <div class="flex items-center justify-between px-1">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-text_accent animate-pulse shadow-[0_0_8px_var(--text-accent)]"></div>
              <span class="text-[10px] font-mono font-black tracking-[0.2em] text-text_primary uppercase">THREAT STREAM</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[8px] font-mono text-white/20 uppercase tracking-tighter">SIG_STRENGTH: 98%</span>
              <button
                onClick={fetchCyberIntel}
                disabled={isFetching()}
                class="group flex items-center gap-1.5"
              >
                <div class={`w-2 h-2 border border-text_accent/40 border-t-text_accent rounded-full ${isFetching() ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`}></div>
                <span class="text-[8px] font-black text-white/40 group-hover:text-text_accent transition-colors">REFRESH</span>
              </button>
            </div>
          </div>

          <div class="flex-1 min-h-0 border border-white/5 rounded-md bg-black/20 backdrop-blur-md overflow-hidden flex flex-col">

            <div class="flex-1 overflow-y-auto win-scroll hover:scrollbar-thumb-text_accent/20 transition-all custom-scrollbar">
              <div class="flex flex-col">
                <For each={cyberNews()} fallback={
                  <div class="py-20 flex flex-col items-center justify-center opacity-10">
                    <span class="text-[9px] font-mono animate-pulse">FETCHING DATA...</span>
                  </div>
                }>
                  {(news) => (
                    <a
                      href={news.link}
                      target="_blank"
                      class="group flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.03] hover:bg-text_accent/[0.03] transition-all duration-150 relative overflow-hidden"
                    >
                      <div class={`absolute left-0 top-0 bottom-0 w-[1.5px] transition-all ${news.impactScore > 0.6 ? 'bg-red-500/50' : 'bg-text_accent/20 group-hover:bg-text_accent'}`}></div>

                      <div class="flex flex-col min-w-[55px] opacity-40 group-hover:opacity-100 transition-opacity">
                        <span class="text-[8px] font-mono text-white leading-none mb-1">
                          {new Date(news.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span class="text-[7px] font-black text-text_accent truncate uppercase tracking-tighter">
                          {news.source.split('.')[0]}
                        </span>
                      </div>

                      <div class="flex-1 min-w-0">
                        <h3 class="text-[10px] font-medium text-white/70 group-hover:text-white leading-tight truncate transition-colors uppercase font-mono tracking-tight">
                          {news.title}
                        </h3>
                      </div>

                      <div class="flex items-center gap-2">
                        <Show when={news.impactScore > 0.6}>
                          <span class="text-[7px] font-mono text-red-400 bg-red-400/10 px-1 border border-red-400/20 rounded-sm">CRIT</span>
                        </Show>
                        <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg class="w-2.5 h-2.5 text-text_accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </div>
                      </div>
                    </a>
                  )}
                </For>
              </div>
            </div>

            <div class="px-3 py-1.5 bg-white/[0.02] border-t border-white/5 flex justify-between items-center">
              <span class="text-[7px] font-mono text-white/20 uppercase tracking-[0.2em]">TOTAL RECORDS: {cyberNews().length}</span>
              <span class="text-[7px] font-mono text-text_accent/40 italic">FEED ACTIVE</span>
            </div>
            <br>
            </br>

          </div>
          <div class="flex flex-col gap-2 p-3 bg-black/40 border border-white/5 rounded-md backdrop-blur-md">
            <div class="flex items-center gap-2 mb-1 px-1">
              <div class="w-1 h-1 rotate-45 bg-text_accent"></div>
              <span class="text-[9px] font-mono font-black tracking-[0.3em] text-white/40 uppercase">THREAT DECODER</span>
            </div>

            <div class="flex flex-col border-t border-white/5">
              <For each={[
                { code: 'OAS', label: 'On-Access Scan', desc: 'Real-time file/malware detection', color: 'bg-[#4ade80]' },
                { code: 'ODS', label: 'On-Demand Scan', desc: 'Manual/Scheduled system scans', color: 'bg-[#ef4444]' },
                { code: 'MAV', label: 'Mail Anti-Virus', desc: 'Email-based threats & phishing', color: 'bg-[#f97316]' },
                { code: 'WAV', label: 'Web Anti-Virus', desc: 'Malicious scripts & URLs', color: 'bg-[#3b82f6]' },
                { code: 'IDS', label: 'Intrusion Detection', desc: 'Network attacks & port scans', color: 'bg-[#d946ef]' },
                { code: 'VUL', label: 'Vulnerability Scan', desc: 'Software flaws & unpatched holes', color: 'bg-[#eab308]' },
                { code: 'KAS', label: 'Anti-Spam Scan', desc: 'High-volume malicious traffic', color: 'bg-[#8b5cf6]' },
                { code: 'RMW', label: 'Ransomware Detect', desc: 'Critical data encryption attacks', color: 'bg-[#2563eb]' }
              ]}>
                {(item) => (
                  <div class="group flex items-center gap-3 py-1.5 px-2 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <div class={`w-1 h-3 rounded-full ${item.color} opacity-60 group-hover:opacity-100 transition-opacity`}></div>

                    <span class="text-[10px] font-mono font-black text-white/80 min-w-[30px]">{item.code}</span>

                    <div class="flex flex-1 items-baseline gap-2 min-w-0">
                      <span class="text-[9px] font-bold text-white/60 uppercase truncate">{item.label}</span>
                      <span class="hidden md:block text-[8px] font-mono text-white/20 truncate group-hover:text-white/40 transition-colors">
              // {item.desc}
                      </span>
                    </div>

                    <div class="hidden group-hover:flex items-center gap-1">
                      <div class="w-1 h-1 rounded-full bg-text_accent animate-ping"></div>
                      <span class="text-[7px] font-mono text-text_accent">ACTIVE</span>
                    </div>
                  </div>
                )}
              </For>
            </div>

            <div class="flex justify-between items-center px-1 pt-1">
              <span class="text-[7px] font-mono text-white/10 italic">SYSTEM_REF: KASPERSKY_TELEMETRY</span>
              <span class="text-[7px] font-mono text-white/10 uppercase">v2.5_INTEL</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
