import { createMemo, createSignal, onMount, For, Show } from 'solid-js';
import GridView from './GridView';
import CategoryDetailView from './CategoryDetailView';

// ============================================================
// CONFIG — Fix Kritis #11: centralized API base URL
// ============================================================
const API_BASE = import.meta.env.VITE_API_BASE;

const PAGE_SIZE = 20;

// ============================================================
// PRIORITY CATEGORIES — Full 80+ list (Fix Kritis #9)
// Synced 1:1 dengan PRIORITY_CATEGORIES di news_service.py
// ============================================================
const PRIORITY_CATEGORIES = [
  'INDONESIA', 'BUSINESS', 'ECONOMY', 'INVESTMENT', 'POLITICS', 'GOVERNMENT', 'UPDATES',
  'INTELLIGENCE', 'GEOPOLITICS', 'INDUSTRIAL INTEL', 'RISK MANAGEMENT', 'BUSINESS RISK',
  'CYBER SECURITY', 'CYBER INTEL', 'SUPPLY CHAIN', 'ECONOMIC INTEL',
  'ARBITRATION', 'LEGAL COMPLIANCE', 'LEGAL RISK', 'INTERNATIONAL LAW', 'BUSINESS LAW',
  'CRIMINAL LAW', 'TRADE LAW', 'OFFICIAL DOCUMENTATION', 'OFFICIAL SPEECHES',
  'MILITARY NEWS', 'DEFENSE NEWS', 'NAVAL NEWS', 'ARMY NEWS', 'ENERGY',
  'MINING', 'MANUFACTURING', 'INDUSTRIAL', 'INFRASTRUCTURE', 'LOGISTICS',
  'AVIATION', 'TRADE', 'BUSINESS/CONTRACTS',
  'TECHNOLOGY', 'FINANCE', 'CRYPTO ANALYSIS', 'CRYPTO',
  'INDONESIA CRYPTO', 'UTILITY', 'REAL ESTATE', 'PROPERTY', 'AGRICULTURE',
  'ESG COMPLIANCE', 'ENVIRONMENTAL', 'ENVIRONMENT',
  'INTERNATIONAL', 'WORLD', 'SCIENCE', 'HEALTHCARE', 'HEALTH', 'HEALTH LAW',
  'SOCIAL RISK', 'SOCIAL', 'LABOR', 'HUMAN RESOURCES', 'PRESS RELEASES',
  'INFORMATION', 'PRESS', 'DOCUMENTATION', 'MAGAZINE', 'CONSUMER GOODS', 'CONSUMER',
  'RETAIL', 'SERVICE', 'HISTORY', 'PODCAST', 'SPORTS', 'ENTERTAINMENT', 'GALLERY'
];
// Category display name mapping for professional polish
const CATEGORY_DISPLAY_MAP = {
  'EKONOMI': 'ECONOMY',
  'INVESTASI': 'INVESTMENT',
  'PEMERINTAHAN': 'GOVERNMENT',
  'HUKUM INTERNASIONAL': 'INTERNATIONAL LAW',
  'HUKUM BISNIS': 'BUSINESS LAW',
  'HUKUM PIDANA': 'CRIMINAL LAW',
  'ENERGI': 'ENERGY',
  'INDUSTRI': 'INDUSTRY',
  'LOGISTIK': 'LOGISTICS',
  'INFRASTRUKTUR': 'INFRASTRUCTURE',
  'PERDAGANGAN': 'TRADE',
  'TEKNOLOGI': 'TECHNOLOGY',
  'KEUANGAN': 'FINANCE',
  'CRYPTO INDONESIA': 'IDX CRYPTO',
  'LINGKUNGAN': 'ENVIRONMENT',
  'SOSIAL': 'SOCIAL',
  'TENAGA KERJA': 'LABOR',
};

// Categories to hide by default to reduce noise (Point 2D of audit)
const NOISE_CATEGORIES = ['SPORTS', 'ENTERTAINMENT', 'GALLERY', 'MAGAZINE', 'PODCAST', 'HISTORY'];

// Category groups for UI clustering
const NEWS_GROUPS = {
  "STRATEGIC": ['INDONESIA', 'INTERNATIONAL', 'WORLD', 'POLITICS', 'GEOPOLITICS', 'PEMERINTAHAN', 'OFFICIAL SPEECHES', 'OFFICIAL DOCUMENTATION', 'UPDATES'],
  "FINANCE": ['BUSINESS', 'ECONOMY', 'INVESTASI', 'FINANCE', 'KEUANGAN', 'PERDAGANGAN', 'EKONOMI', 'BISNIS', 'HUKUM BISNIS', 'REAL ESTATE', 'PROPERTY', 'RETAIL', 'CONSUMER GOODS', 'SERVICE', 'BUSINESS/CONTRACTS', 'ECONOMIC INTEL'],
  "ANALYSIS & RISK": ['INTELLIGENCE', 'GEOPOLITICS', 'BUSINESS RISK', 'RISK MANAGEMENT', 'LEGAL RISK', 'SOCIAL RISK', 'INDUSTRIAL INTEL', 'ECONOMIC INTEL', 'ARBITRATION', 'SUPPLY CHAIN'],
  "CYBER & TECH": ['TECHNOLOGY', 'TEKNOLOGI', 'CYBER SECURITY', 'CRYPTO', 'CRYPTO ANALISIS', 'CRYPTO INDONESIA', 'INFORMATION'],
  "LEGAL & COMPLIANCE": ['LEGAL COMPLIANCE', 'ESG COMPLIANCE', 'HUKUM PIDANA', 'HUKUM INTERNASIONAL', 'HEALTH LAW', 'TRADE LAW', 'ENVIRONMENTAL', 'ENVIRONMENT', 'LINGKUNGAN'],
  "DEFENSE & MILITARY": ['MILITARY NEWS', 'DEFENSE NEWS', 'NAVAL NEWS', 'ARMY NEWS'],
  "INDUSTRIAL": ['INDUSTRIAL', 'INDUSTRI', 'MANUFACTURING', 'LOGISTIK', 'LOGISTICS', 'INFRASTRUKTUR', 'ENERGY', 'ENERGI', 'MINING', 'AVIATION', 'UTILITY', 'AGRICULTURE', 'TENAGA KERJA'],
  "MEDIA & SOCIAL": ['HEALTH', 'HEALTHCARE', 'SCIENCE', 'SOSIAL', 'SPORTS', 'ENTERTAINMENT', 'MAGAZINE', 'PRESS', 'PRESS RELEASES', 'DOCUMENTATION', 'GALLERY', 'HUMAN RESOURCES', 'CONSUMER', 'HISTORY'],
};

// Build reverse lookup: category → group
const CAT_TO_GROUP = {};
Object.entries(NEWS_GROUPS).forEach(([group, cats]) => {
  cats.forEach(c => { CAT_TO_GROUP[c] = group; });
});

// ============================================================
// COMPONENT
// ============================================================
export default function NewsView(props) {
  const [pagination, setPagination] = createSignal({});
  const [expandedGroups, setExpandedGroups] = createSignal(
    new Set(['STRATEGIC', 'FINANCE', 'INTELLIGENCE & RISK'])
  );
  const [isHighDensity, setIsHighDensity] = createSignal(true);
  const [activeGroupFilter, setActiveGroupFilter] = createSignal('ALL');
  const [hideNoise, setHideNoise] = createSignal(true);
  const [gracePeriodActive, setGracePeriodActive] = createSignal(true);

  // ============================================================
  // PROGRESSIVE SSE LOADING
  // Opens a single SSE stream to the backend which sends category
  // data one-by-one as each DB query completes.
  // This replaces the old per-category fetch polling approach.
  // ============================================================
  // Initializing progressive stream parameters via root state controllers
  onMount(() => {
    console.log("[NewsView] Mounted. Utilizing global incremental feed state mapping.");
    
    // Grace period for loading: hide loading categories after 2s if no data
    const timer = setTimeout(() => {
      setGracePeriodActive(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  });

  // ============================================================
  // DATA PROCESSING
  // ============================================================
  const filteredData = createMemo(() => {
    const raw = props.data();
    const processed = {};

    Object.keys(raw).forEach(cat => {
      const upperCat = cat.toUpperCase();
      const items = raw[cat] || [];
      if (!processed[upperCat]) processed[upperCat] = [];
      processed[upperCat].push(...items);
    });

    // Sort by real publish timestamp within each category
    Object.keys(processed).forEach(key => {
      const seen = new Set();
      const unique = processed[key].filter(item => {
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
      });
      processed[key] = unique.sort((a, b) => b.timestamp - a.timestamp);
    });

    return processed;
  });

  // Top 10 breaking signals across all active categories
  const breakingStream = createMemo(() => {
    const all = [];
    const data = filteredData();
    // Use first few core categories for breaking stream, excluding noise
    const coreCats = ['INDONESIA', 'BUSINESS', 'ECONOMY', 'INVESTASI', 'POLITICS', 'INTELLIGENCE', 'GEOPOLITICS', 'FINANCE'];
    coreCats.forEach(cat => {
      const items = data[cat] || [];
      if (items.length > 0) all.push({ ...items[0], _cat: cat });
    });
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  });

  // Get categories that have data for each group
  const groupsWithData = createMemo(() => {
    const result = {};
    const data = filteredData();
    
    Object.entries(NEWS_GROUPS).forEach(([group, cats]) => {
      // If noise is hidden, filter out low-relevance groups
      if (hideNoise() && group === 'MEDIA & SOCIAL') return;
      
      const filteredCats = cats.filter(c => {
        // Filter out noise if setting active
        if (hideNoise() && NOISE_CATEGORIES.includes(c)) return false;
        
        // Filter out empty categories after grace period
        const hasData = data[c] && data[c].length > 0;
        return hasData || gracePeriodActive();
      });
        
      if (filteredCats.length > 0) {
        result[group] = filteredCats;
      }
    });
    return result;
  });

  const toggleGroup = (g) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  const totalArticles = createMemo(() => {
    return Object.values(filteredData()).reduce((sum, items) => sum + items.length, 0);
  });

  return (
    <div class="flex-1 overflow-hidden flex flex-col bg-bg_main">

      {/* === HEADER BAR === */}
      <div class="px-6 py-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4 bg-black/20">
        <div class="flex items-center gap-6">
          <div>
            <h2 class="text-white font-black tracking-[0.35em] uppercase text-[13px]">
              GLOBAL NEWS AGGREGATOR
            </h2>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="w-1.5 h-1.5 bg-text_accent rounded-full animate-pulse shadow-[0_0_8px_var(--text-accent)]" />
              <span class="text-[9px] font-mono text-text_accent/50 tracking-widest uppercase">
                {totalArticles().toLocaleString()} ARTICLES INDEXED // {PRIORITY_CATEGORIES.length} CATEGORIES TRACKED
              </span>
            </div>
          </div>

          {/* View toggle */}
          <div class="flex items-center gap-0.5 bg-white/5 p-1 rounded border border-white/5">
            <button onClick={() => props.setViewMode('table')}
              class={`px-3 py-1.5 rounded-sm text-[9px] font-black tracking-[0.2em] transition-all ${props.viewMode() === 'table' ? 'bg-text_accent text-bg_main' : 'text-white/40 hover:text-white'}`}>
              TABLE
            </button>
            <button onClick={() => props.setViewMode('grid')}
              class={`px-3 py-1.5 rounded-sm text-[9px] font-black tracking-[0.2em] transition-all ${props.viewMode() === 'grid' ? 'bg-text_accent text-bg_main' : 'text-white/40 hover:text-white'}`}>
              GRID
            </button>
          </div>

          {/* Noise filter toggle */}
          <div class="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded">
            <span class="text-[8px] text-amber-500 font-black tracking-widest uppercase">FINANCE ONLY</span>
            <button onClick={() => setHideNoise(!hideNoise())}
              class={`w-8 h-4 rounded-full relative transition-colors ${hideNoise() ? 'bg-amber-500' : 'bg-white/10'}`}>
              <div class={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all duration-200 ${hideNoise() ? 'left-4.5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div class="flex items-center gap-2 bg-white/5 border border-white/5 rounded px-3 py-2 w-72 focus-within:border-text_accent/30 transition-colors">
          <svg class="w-3.5 h-3.5 text-text_accent/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="SEARCH NEWS..."
            onInput={(e) => props.setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                props.onSearch(e.target.value.trim());
                e.target.blur();
              }
            }}
            class="bg-transparent text-[10px] flex-1 outline-none font-mono tracking-widest uppercase text-text_accent placeholder:text-white/15" />
        </div>
      </div>

      {/* === MAIN CONTENT === */}
      <Show when={!props.selectedCategory()} fallback={
        <Show when={props.viewMode() === 'grid'} fallback={
          <CategoryDetailView category={props.selectedCategory} data={props.data}
            searchTerm={props.searchTerm} onBack={() => props.setSelectedCategory(null)} />
        }>
          <GridView category={props.selectedCategory} data={props.data} />
        </Show>
      }>
        <div class="flex-1 overflow-y-auto win-scroll px-6 pb-10 space-y-10 pt-6">

          {/* BREAKING NEWS TICKER */}
          <Show when={breakingStream().length > 0}>
            <div class="border border-text_accent/15 rounded-lg bg-text_accent/[0.02] overflow-hidden">
              <div class="flex items-center justify-between px-4 py-2.5 border-b border-text_accent/10">
                <div class="flex items-center gap-3">
                  <div class="flex gap-1">
                    <span class="w-1.5 h-1.5 bg-text_accent rounded-full animate-pulse" />
                    <span class="w-1.5 h-1.5 bg-text_accent rounded-full animate-pulse" style="animation-delay:0.2s" />
                    <span class="w-1.5 h-1.5 bg-text_accent rounded-full animate-pulse" style="animation-delay:0.4s" />
                  </div>
                  <span class="text-[10px] font-black text-text_accent tracking-[0.4em] uppercase">BREAKING NEWS FEED</span>
                </div>
                <span class="text-[8px] font-mono text-white/15 uppercase">LATEST ARTICLES PER PRIORITY CATEGORY</span>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-x divide-white/5">
                <For each={breakingStream()}>
                  {(item) => (
                    <div onClick={() => window.open(item.link, '_blank')}
                      class="p-3 cursor-pointer group hover:bg-white/[0.03] transition-all">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-[7px] font-black bg-text_accent/10 text-text_accent px-1.5 py-0.5 rounded-sm uppercase">
                          {CATEGORY_DISPLAY_MAP[item._cat] || item._cat}
                        </span>
                        <span class="text-[7px] font-mono text-white/20">
                          {new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p class="text-[10px] font-semibold text-white/70 group-hover:text-white leading-snug line-clamp-2 transition-colors">
                        {item.title}
                      </p>
                      <div class="flex items-center justify-between mt-2">
                        <span class="text-[8px] text-white/20 truncate max-w-[80px]">{item.source}</span>
                        <Show when={item.trust >= 9}>
                          <span class="text-[7px] bg-green-500/10 text-green-400 border border-green-500/20 px-1 font-black">VERIFIED</span>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* GROUP FILTER TABS */}
          <div class="flex items-center gap-2 flex-wrap">
            <button onClick={() => setActiveGroupFilter('ALL')}
              class={`px-3 py-1.5 text-[9px] font-black tracking-wider border rounded-sm uppercase transition-all ${activeGroupFilter() === 'ALL' ? 'bg-text_accent text-bg_main' : 'border-white/10 text-white/30 hover:text-white hover:border-white/30'}`}>
              ALL ({Object.keys(groupsWithData()).length} GROUPS)
            </button>
            <For each={Object.keys(NEWS_GROUPS)}>
              {(group) => (
                <Show when={groupsWithData()[group]}>
                  <button onClick={() => setActiveGroupFilter(group === activeGroupFilter() ? 'ALL' : group)}
                    class={`px-3 py-1.5 text-[9px] font-black tracking-wider border rounded-sm uppercase transition-all ${activeGroupFilter() === group ? 'bg-text_accent text-bg_main' : 'border-white/10 text-white/30 hover:text-white hover:border-white/30'}`}>
                    {group} ({(groupsWithData()[group] || []).length})
                  </button>
                </Show>
              )}
            </For>
          </div>

          {/* CATEGORY STREAM GROUPS */}
          <For each={Object.entries(groupsWithData())}>
            {([groupName, categories]) => (
              <Show when={activeGroupFilter() === 'ALL' || activeGroupFilter() === groupName}>
                <div class="space-y-4">
                  {/* Group Header */}
                  <button onClick={() => toggleGroup(groupName)}
                    class="w-full flex items-center justify-between py-2 border-b border-white/10 hover:border-text_accent/20 transition-colors group">
                    <div class="flex items-center gap-4">
                      <span class={`text-[10px] text-white/20 transition-transform ${expandedGroups().has(groupName) ? 'rotate-90' : ''}`}>▶</span>
                      <h3 class="text-[11px] font-black tracking-[0.5em] text-white group-hover:text-text_accent transition-colors uppercase">
                        {groupName} GROUP
                      </h3>
                      <span class="text-[9px] text-white/20 font-mono">{categories.length} SOURCES</span>
                    </div>
                    <span class="text-[8px] text-white/10 font-mono uppercase">
                      {categories.reduce((n, c) => n + (filteredData()[c] || []).length, 0)} ARTICLES
                    </span>
                  </button>

                  {/* Category Panels */}
                  <Show when={expandedGroups().has(groupName)}>
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      <For each={categories}>
                        {(category) => {
                          const items    = createMemo(() => filteredData()[category] || []);
                          const total    = createMemo(() => Math.max(1, Math.ceil(items().length / PAGE_SIZE)));
                          const curPage  = createMemo(() => pagination()[category] || 1);
                          const setPage  = (d) => setPagination(p => ({
                            ...p, [category]: Math.max(1, Math.min(total(), curPage() + d))
                          }));
                          const paged    = createMemo(() => items().slice((curPage() - 1) * PAGE_SIZE, curPage() * PAGE_SIZE));

                          return (
                            <Show when={items().length > 0 || gracePeriodActive()}>
                              <section class={`flex flex-col bg-bg_sidebar/20 border border-white/5 rounded-lg overflow-hidden hover:border-white/10 transition-all ${isHighDensity() ? 'max-h-[360px]' : 'max-h-[550px]'}`}>
                                {/* Panel Header */}
                                <div class="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02] shrink-0">
                                  <div class="flex items-center gap-2.5 cursor-pointer group/h"
                                    onClick={() => props.onCategorySelect(category)}>
                                    <div class="w-1.5 h-1.5 bg-text_accent" />
                                    <span class="text-[10px] font-black text-white tracking-[0.2em] uppercase group-hover/h:text-text_accent transition-colors">
                                      {CATEGORY_DISPLAY_MAP[category] || category}
                                    </span>
                                    <span class="text-[8px] font-mono text-white/20">{items().length}</span>
                                  </div>
                                  <div class="flex items-center gap-1">
                                    <button onClick={() => setPage(-1)} disabled={curPage() === 1}
                                      class="w-5 h-5 flex items-center justify-center text-[8px] bg-white/5 hover:bg-text_accent hover:text-bg_main disabled:opacity-10 transition-colors rounded-sm">◀</button>
                                    <span class="text-[8px] font-mono text-white/20 px-1">{curPage()}/{total()}</span>
                                    <button onClick={() => setPage(1)} disabled={curPage() === total()}
                                      class="w-5 h-5 flex items-center justify-center text-[8px] bg-white/5 hover:bg-text_accent hover:text-bg_main disabled:opacity-10 transition-colors rounded-sm">▶</button>
                                  </div>
                                </div>

                                {/* Articles List */}
                                <div class="flex-1 overflow-y-auto win-scroll divide-y divide-white/[0.04]">
                                  <Show when={paged().length > 0} fallback={
                                    <div class="h-full flex flex-col items-center justify-center gap-4 py-20 bg-black/5 animate-pulse">
                                      <div class="w-6 h-6 border-2 border-text_accent/20 border-t-text_accent animate-spin rounded-full" />
                                      <div class="flex flex-col items-center gap-1">
                                        <span class="text-[9px] font-black tracking-[0.4em] text-text_accent uppercase">RETRIEVING INTEL</span>
                                        <span class="text-[7px] font-mono text-white/10 uppercase tracking-widest italic">Scanning global repositories...</span>
                                      </div>
                                    </div>
                                  }>
                                    <For each={paged()}>
                                      {(item) => (
                                        <div onClick={() => window.open(item.link, '_blank')}
                                          class={`flex items-start gap-3 px-4 cursor-pointer group hover:bg-white/[0.04] border-l-2 border-l-transparent hover:border-l-text_accent transition-all ${isHighDensity() ? 'py-1.5' : 'py-2.5'}`}>
                                          {/* Time */}
                                          <div class="text-[8px] font-mono text-white/20 pt-0.5 shrink-0 w-10 text-right">
                                            {new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                          {/* Content */}
                                          <div class="flex-1 overflow-hidden">
                                            <div class="flex items-start gap-1.5">
                                              <Show when={item.sentiment}>
                                                <div class={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${String(item.sentiment).toUpperCase() === 'NEGATIVE' ? 'bg-red-500' :
                                                  String(item.sentiment).toUpperCase() === 'POSITIVE' ? 'bg-green-500' : 'bg-white/20'
                                                  }`} />
                                              </Show>
                                              <span class={`font-medium text-white/75 group-hover:text-white transition-colors leading-snug ${isHighDensity() ? 'text-[10px] line-clamp-1' : 'text-[11px] line-clamp-2'}`}>
                                                {item.title}
                                              </span>
                                            </div>
                                            <Show when={!isHighDensity()}>
                                              <div class="flex items-center gap-2 mt-1">
                                                <span class="text-[8px] font-bold text-text_accent/40 uppercase truncate max-w-[120px]">
                                                  {item.source}
                                                </span>
                                                <Show when={item.trust >= 9}>
                                                  <span class="text-[7px] text-green-400/60 border border-green-500/20 px-1 font-black">★</span>
                                                </Show>
                                                <Show when={item.impactScore > 5}>
                                                  <span class="text-[7px] bg-red-500/15 text-red-400 border border-red-500/25 px-1 font-black uppercase">ALERT</span>
                                                </Show>
                                              </div>
                                            </Show>
                                          </div>
                                        </div>
                                      )}
                                    </For>
                                  </Show>
                                </div>
                              </section>
                            </Show>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>
            )}
          </For>

        </div>
      </Show>
    </div>
  );
}
