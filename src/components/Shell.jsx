import { For, createSignal, Show, createMemo, createEffect } from 'solid-js';
import logo from '../../assets/img/logo-dark.png';


const NEWS_CATEGORIES = [
  // TIER 1: BREAKING & CORE NATIONAL (Prioritas Utama)

  'INDONESIA',
  'BUSINESS',
  'ECONOMY',
  'INVESTMENT',
  'POLITICS',
  'GOVERNMENT',
  'UPDATES',

  // TIER 2: STRATEGIC INTELLIGENCE & RISK
  'INTELLIGENCE',
  'GEOPOLITICS',
  'INDUSTRIAL INTEL',
  'RISK MANAGEMENT',
  'BUSINESS RISK',
  'CYBER SECURITY',
  'CYBER INTEL',
  'SUPPLY CHAIN',
  'ECONOMIC INTEL',

  // TIER 3: LEGAL & HUKUM
  'ARBITRATION',
  'LEGAL COMPLIANCE',
  'LEGAL RISK',
  'INTERNATIONAL LAW',
  'BUSINESS LAW',
  'CRIMINAL LAW',
  'TRADE LAW',
  'OFFICIAL DOCUMENTATION',
  'OFFICIAL SPEECHES',

  // TIER 4: MILITARY & SEKTOR INDUSTRI BERAT
  'MILITARY NEWS',
  'DEFENSE NEWS',
  'NAVAL NEWS',
  'ARMY NEWS',
  'ENERGY',
  'MINING',
  'MANUFACTURING',
  'INDUSTRIAL',
  'INFRASTRUCTURE',
  'LOGISTICS',
  'AVIATION',
  'TRADE',
  'BUSINESS/CONTRACTS',

  // TIER 5: TEKNOLOGI, FINANSIAL & LINGKUNGAN
  'TECHNOLOGY',
  'FINANCE',
  'CRYPTO ANALYSIS',
  'CRYPTO',
  'INDONESIA CRYPTO',
  'UTILITY',
  'REAL ESTATE',
  'PROPERTY',
  'AGRICULTURE',
  'ESG COMPLIANCE',
  'ENVIRONMENT',
  'ENVIRONMENTAL',

  // TIER 6: SOSIAL, KESEHATAN & UMUM
  'INTERNATIONAL',
  'WORLD',
  'SCIENCE',
  'HEALTHCARE',
  'HEALTH',
  'HEALTH LAW',
  'SOCIAL RISK',
  'SOCIAL',
  'LABOR',
  'HUMAN RESOURCES',
  'PRESS RELEASES',
  'INFORMATION',
  'PRESS',
  'DOCUMENTATION',
  'MAGAZINE',
  'CONSUMER GOODS',
  'CONSUMER',
  'RETAIL',
  'SERVICE',

  // TIER 7: LOW RELEVANCE (Less Important)
  'HISTORY',
  'PODCAST',
  'SPORTS',
  'ENTERTAINMENT',
  'GALLERY'
];

const NEWS_GROUPS = {
  "STRATEGIC": ['INTERNATIONAL', 'WORLD', 'INDONESIA', 'POLITICS', 'GEOPOLITICS', 'GOVERNMENT', 'OFFICIAL SPEECHES', 'OFFICIAL DOCUMENTATION'],
  "FINANCE": ['BUSINESS', 'ECONOMY', 'INVESTMENT', 'FINANCE', 'TRADE', 'ECONOMY', 'BUSINESS LAW', 'REAL ESTATE', 'PROPERTY', 'RETAIL', 'CONSUMER GOODS', 'SERVICE', 'BUSINESS/CONTRACTS'],
  "TECH & CRYPTO": ['TECHNOLOGY', 'CRYPTO', 'CRYPTO ANALYSIS', 'INDONESIA CRYPTO', 'CYBER SECURITY', 'CYBER INTEL', 'INFORMATION', 'PODCAST'],
  "DEFENSE & RISK": ['INTELLIGENCE', 'DEFENSE NEWS', 'ARMY NEWS', 'NAVAL NEWS', 'MILITARY NEWS', 'BUSINESS RISK', 'RISK MANAGEMENT', 'LEGAL RISK', 'SOCIAL RISK', 'INDUSTRIAL INTEL', 'ECONOMIC INTEL', 'SECURITY', 'ARBITRATION'],
  "INDUSTRIAL": ['INDUSTRIAL', 'MANUFACTURING', 'LOGISTICS', 'SUPPLY CHAIN', 'INFRASTRUCTURE', 'ENERGY', 'MINING', 'AUTOMOTIVE', 'UTILITY', 'AGRICULTURE', 'LABOR'],
  "COMPLIANCE": ['LEGAL COMPLIANCE', 'ESG COMPLIANCE', 'CRIMINAL LAW', 'INTERNATIONAL LAW', 'HEALTH LAW', 'TRADE LAW', 'ENVIRONMENTAL', 'ENVIRONMENT'],
  "MEDIA & SOCIAL": ['SOCIAL', 'HEALTH', 'HEALTHCARE', 'SPORTS', 'SCIENCE', 'ENTERTAINMENT', 'MAGAZINE', 'PRESS', 'PRESS RELEASES', 'DOCUMENTATION', 'GALLERY', 'UPDATES', 'HUMAN RESOURCES', 'AVIATION']
};

export function Sidebar(props) {
  const [isOpen, setIsOpen] = createSignal(true);
  const [catFilter, setCatFilter] = createSignal("");
  const [activeGroup, setActiveGroup] = createSignal(null);

  // Auto-collapse sidebar when in Workspace
  createEffect((prevView) => {
    const currentView = props.view();
    if (currentView === 'workspace' && prevView !== 'workspace') {
      setIsOpen(false);
    } else if (currentView !== 'workspace' && prevView === 'workspace') {
      setIsOpen(true);
    }
    return currentView;
  }, props.view());

  const filteredCategories = createMemo(() => {
    const all = [...new Set([...NEWS_CATEGORIES, ...props.categories.map(c => c.toUpperCase())])].sort();
    if (!catFilter()) return all;
    return all.filter(c => c.toLowerCase().includes(catFilter().toLowerCase()));
  });

  const getCategorized = () => {
    const cats = filteredCategories();
    const result = {};

    // Initialize groups
    Object.keys(NEWS_GROUPS).forEach(g => result[g] = []);
    result["UNCATEGORIZED"] = [];

    cats.forEach(cat => {
      let found = false;
      for (const [group, members] of Object.entries(NEWS_GROUPS)) {
        if (members.includes(cat)) {
          result[group].push(cat);
          found = true;
          break;
        }
      }
      if (!found) result["UNCATEGORIZED"].push(cat);
    });

    // Remove empty groups
    return Object.fromEntries(Object.entries(result).filter(([_, v]) => v.length > 0));
  };

  return (
    <aside
      class={`bg-bg_sidebar border-r border-border_main flex flex-col shrink-0 relative z-50 ${isOpen() ? 'w-64' : 'w-16'}`}
    >
      {/* Brand & Mini Toggle */}
      <div class="flex items-center justify-center px-4 border-b border-border_main bg-black relative py-1">
        <Show when={isOpen()}>
          <img src={logo} alt="Mahameru Terminal" class="h-14 w-auto object-contain" />
        </Show>
        <button
          onClick={() => setIsOpen(!isOpen())}
          class={`flex items-center justify-center text-text_secondary hover:text-text_accent ${isOpen() ? 'absolute right-2 w-8 h-8' : 'w-10 h-10'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            {isOpen() ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" transform="rotate(180 12 12)" />}
          </svg>
        </button>
      </div>

      <nav class="flex-1 py-4 flex flex-col gap-0.5 overflow-y-auto win-scroll">
        <For each={[
          {
            title: 'MAIN MENU',
            items: [
              { id: 'dashboard', label: 'Dashboard', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10' },
              { id: 'research-panel', label: 'Research Panel', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
              { id: 'workspace', label: 'Workspace', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
              { id: 'entity-correlation', label: 'Entity Correlation', icon: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5' },
            ]
          },
          {
            title: 'MARKETS',
            items: [
              { id: 'entity', label: 'Stocks', icon: 'M3 3v18h18 M19 9l-5 5-4-4-3 3' },
              { id: 'sectors', label: 'Sectors', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
              { id: 'commodities', label: 'Commodities', icon: 'M12 2l9 4.9V17L12 22l-9-4.9V7z M12 22V12 M21 7l-9 5 M3 7l9 5' },
              { id: 'forex', label: 'Foreign Exchange', icon: 'M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
              { id: 'crypto', label: 'Crypto Assets', icon: 'M4 4h16v16H4z' },
            ]
          },
          {
            title: 'FEEDS',
            items: [
              { id: 'news', label: 'News Feed', icon: 'M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16' },
              { id: 'deep-analytics', label: 'Data Analytics', icon: 'M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 8.208A4 4 0 0 0 12 22a4 4 0 0 0 5-9.1A4 4 0 0 0 17.997 10.125 3 3 0 1 0 12 5ZM12 13V5M12 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },

              { id: 'sentiment', label: 'Market Sentiment', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
              { id: 'tv', label: 'Live TV', icon: 'M23 7l-7 5 7 5V7z M1 5h15v14H1z' },
              { id: 'cyber-intel', label: 'Cyber Security', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4M12 16h.01' },
            ]
          },
          {
            title: 'PORTFOLIO',
            items: [
              { id: 'watchlist', label: 'Watchlist', icon: 'M3 3v18h18 M19 9l-5 5-4-4-3 3' },
              { id: 'correlation', label: 'Correlation', icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
              { id: 'alerts', label: 'Notifications', icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0' },
            ]
          },
          {
            title: 'MAPS',
            items: [
              { id: 'geointel', label: 'World View', icon: 'M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10z M2 12h20' },
              { id: 'crisis-disaster', label: 'Crisis & Disaster Tracking', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
              { id: 'infrastructure', label: 'Infrastructure', icon: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5' },
              { id: 'geo-monitor', label: 'Geo Monitoring', icon: 'M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10z M12 6v6l4 2' },
              { id: 'government-facility', label: 'Government Facility', icon: 'M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21v-4a3 3 0 0 1 6 0v4' },
            ]
          }
        ]}>
          {(section) => (
            <>
              <Show when={isOpen()}>
                <div class="text-[8px] text-text_accent font-black px-6 mt-6 mb-2 tracking-[0.3em] opacity-30 uppercase border-l-2 border-text_accent/20 ml-3">
                  {section.title}
                </div>
              </Show>

              <For each={section.items}>
                {(item) => (
                  <div class="flex flex-col">
                    <a
                      href={item.id === 'dashboard' ? '/' : `/${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        props.setView(item.id);
                      }}
                      class={`flex items-center group relative no-underline ${isOpen() ? 'px-6 py-2 mx-1 rounded hover:bg-[#1a1a1a]' : 'justify-center py-4'} ${props.view() === item.id ? 'text-text_accent bg-[#1a1400] border-l border-text_accent' : 'text-text_secondary/70 hover:text-text_primary'}`}
                    >
                      <div class={isOpen() ? 'mr-3' : 'scale-110'}>
                        <svg class={`w-4 h-4 ${props.view() === item.id ? 'scale-110' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d={item.icon} />
                        </svg>
                      </div>
                      <Show when={isOpen()}>
                        <span class="font-black text-[10px] tracking-widest uppercase">{item.label}</span>
                        <Show when={props.view() === item.id}>
                          <div class="ml-auto w-1 h-1 rounded-full bg-text_accent"></div>
                        </Show>
                      </Show>
                    </a>

                    {/* SUBMENUS */}
                    <Show when={isOpen() && props.view() === item.id}>
                      {/* NEWS SUBMENU: Filterable & Grouped */}
                      <Show when={item.id === 'news'}>
                        <div class="flex flex-col mx-7 mt-2 mb-4 bg-[#0a0a0a] rounded border border-white/5 p-2 gap-1 overflow-hidden">
                          <input
                            type="text"
                            placeholder="Filter categories..."
                            class="bg-[#050505] border-b border-white/10 text-[9px] px-2 py-1.5 mb-2 outline-none focus:border-text_accent/50 w-full font-mono text-text_accent uppercase"
                            value={catFilter()}
                            onInput={(e) => setCatFilter(e.target.value)}
                          />

                          <div class="max-h-[300px] overflow-y-auto win-scroll flex flex-col gap-1 pr-1">
                            <For each={Object.entries(getCategorized())}>
                              {([group, cats]) => (
                                <div class="mb-1">
                                  <button
                                    onClick={() => setActiveGroup(activeGroup() === group ? null : group)}
                                    class="w-full text-left text-[8px] font-black text-white/20 tracking-widest flex items-center gap-2 py-1 hover:text-white/40 border-b border-white/5 mb-1"
                                  >
                                    <span class="text-[10px]">{activeGroup() === group ? '▼' : '▶'}</span>
                                    {group} ({cats.length})
                                  </button>

                                  <Show when={activeGroup() === group || catFilter()}>
                                    <div class="flex flex-col gap-0.5 ml-2 border-l border-white/10 pl-2 py-1">
                                      {cats.map(cat => (
                                        <button
                                          onClick={() => props.onCategorySelect(cat)}
                                          class={`text-[9px] text-left py-1.5 hover:text-text_accent font-bold tracking-tight uppercase ${props.selectedCategory() === cat ? 'text-text_accent font-black shadow-[inset_2px_0_0_var(--text-accent)] pl-2' : 'text-text_secondary/40'}`}
                                        >
                                          {cat.replace('_', ' ')}
                                        </button>
                                      ))}
                                    </div>
                                  </Show>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>

                      {/* GEOINTEL SUBMENU */}
                      <Show when={item.id === 'geointel'}>
                        <div class="flex flex-col gap-1 mx-10 mt-1 mb-4 border-l border-text_accent/30 pl-4 py-2">
                          {[
                            { id: 'naval-fleet', label: 'Fleet Monitoring' },
                            { id: 'flight-intel', label: 'Flight Status' },
                            { id: 'geo-map', label: 'Trend Analysis' },
                            { id: 'satellite-visual', label: 'Satellite Visuals' },
                            { id: 'weather', label: 'Weather & Environment' },
                            { id: 'global-economy', label: 'Economic Data' },
                          ].map(mod => (
                            <button
                              onClick={() => props.setGeoModule(mod.id)}
                              class={`text-[9px] text-left py-1.5 hover:text-text_accent font-bold tracking-tight uppercase ${props.geoModule() === mod.id ? 'text-text_accent font-black pl-2' : 'text-text_secondary/50'}`}
                            >
                              {mod.label}
                            </button>
                          ))}
                        </div>
                      </Show>

                      {/* CRISIS MONITOR SUBMENU */}
                      <Show when={item.id === 'crisis-disaster'}>
                        <div class="flex flex-col gap-1 mx-10 mt-1 mb-4 border-l border-text_accent/30 pl-4 py-2">
                          {[
                            { id: 'conflict', label: 'Conflict Index' },
                            { id: 'disaster', label: 'Disaster Map' },
                            { id: 'risk', label: 'Market Risk' },
                          ].map(mod => (
                            <button
                              onClick={() => props.setCrisisModule ? props.setCrisisModule(mod.id) : null}
                              class={`text-[9px] text-left py-1.5 hover:text-text_accent font-bold tracking-tight uppercase ${props.crisisModule() === mod.id ? 'text-text_accent font-black pl-2' : 'text-text_secondary/50'}`}
                            >
                              {mod.label}
                            </button>
                          ))}
                        </div>
                      </Show>

                      {/* INFRASTRUCTURE SUBMENU */}
                      <Show when={item.id === 'infrastructure'}>
                        <div class="flex flex-col gap-1 mx-10 mt-1 mb-4 border-l border-text_accent/30 pl-4 py-2">
                          {[
                            { id: 'airport', label: 'Airports' },
                            { id: 'port', label: 'Ports' },
                            { id: 'power-plant', label: 'Power Plants' },
                            { id: 'industrial-zone', label: 'Industrial Zones' },
                            { id: 'datacenter', label: 'Data Centers' },
                            { id: 'train-station', label: 'Railways' },
                            { id: 'oil-facility', label: 'Oil Facilities' },
                            { id: 'submarine-cable', label: 'Cables' },
                            { id: 'infra-cctv', label: 'Public Cameras' },
                            { id: 'mines-data', label: 'Mining Sites' },
                          ].map(mod => (
                            <button
                              onClick={() => props.setInfraModule ? props.setInfraModule(mod.id) : null}
                              class={`text-[9px] text-left py-1.5 hover:text-text_accent font-bold tracking-tight uppercase ${props.infraModule() === mod.id ? 'text-text_accent font-black pl-2' : 'text-text_secondary/50'}`}
                            >
                              {mod.label}
                            </button>
                          ))}
                        </div>
                      </Show>
                    </Show>
                  </div>
                )}
              </For>
            </>
          )}
        </For>
      </nav>

      <Show when={isOpen()}>
        <div class="p-6 border-t border-border_main bg-[#0a0a0a]">

        </div>
      </Show>
    </aside>
  );
}

export function Header(props) {
  return (
    <header class="h-14 flex items-center justify-between px-8 bg-black border-b border-border_main shrink-0 z-40 sticky top-0 shadow-lg">
      <div class="flex items-center gap-6">
        <div class="flex flex-col group">
          <div class="flex items-center gap-2">
            <div class="w-1.5 h-1.5 bg-text_accent rounded-full"></div>
            <h2 class="text-[14px] font-black tracking-[0.3em] text-text_primary leading-none uppercase font-mono group-hover:text-text_accent">
              {props.view().replace('-', ' ')}
            </h2>
          </div>

        </div>
      </div>

      <div class="flex items-center gap-6">


        {/* === LIVE STATUS === */}
        <div class="flex items-center gap-2 px-4 border-r border-white/5">
          <div class={`relative flex items-center gap-2 px-2.5 py-1 rounded-sm border ${props.socketConnected?.() ? 'border-green-500/20 bg-[#020502]' : props.status?.().message === 'RECONNECTING' ? 'border-amber-500/20 bg-[#050402]' : 'border-white/5 bg-[#0a0a0a]'}`}>
            <span class={`w-1.5 h-1.5 rounded-full ${props.socketConnected?.() ? 'bg-green-400' : props.status?.().message === 'RECONNECTING' ? 'bg-amber-400 animate-pulse' : 'bg-white/10'}`} />
            <span class={`text-[8px] font-black tracking-[0.3em] uppercase ${props.socketConnected?.() ? 'text-green-400' : props.status?.().message === 'RECONNECTING' ? 'text-amber-400' : 'text-white/20'}`}>
              {props.socketConnected?.() ? 'STABLE' : props.status?.().message === 'RECONNECTING' ? 'RECONNECTING' : 'OFFLINE'}
            </span>
            <Show when={props.liveCount?.() > 0}>
              <button
                onClick={() => props.onLiveClear?.()}
                class="ml-1 flex items-center gap-1 bg-text_accent text-bg_main px-1.5 py-0.5 rounded-sm text-[7px] font-black"
              >
                +{props.liveCount?.()} NEW
              </button>
            </Show>
          </div>
        </div>

        <div class="flex items-center gap-3 pr-6 border-r border-white/5">
          <button onClick={() => props.onThemeChange('dark')} class={`w-4 h-4 rounded-full ${props.theme() === 'dark' ? 'ring-2 ring-text_accent ring-offset-2 ring-offset-bg_main bg-black' : 'bg-zinc-800'}`}></button>
          <button onClick={() => props.onThemeChange('gray')} class={`w-4 h-4 rounded-full ${props.theme() === 'gray' ? 'ring-2 ring-text_accent ring-offset-2 ring-offset-bg_main bg-zinc-600' : 'bg-zinc-600'}`}></button>
        </div>

        <div class="flex flex-col items-end min-w-[100px] border-l border-white/5 pl-6">
          <span class="text-text_accent font-black text-[11px] tracking-widest uppercase">{props.status().message}</span>
          <div class="flex items-center gap-2 mt-0.5">
            <div class="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                class="h-full bg-text_accent"
                style={{ width: `${Math.min(100, (props.status().count / Math.max(1, props.status().total)) * 100)}%` }}
              ></div>
            </div>
            <span class="text-[9px] text-text_secondary font-mono opacity-40 uppercase tracking-tighter">
              {props.status().count}/{props.status().total}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer class="h-10 px-8 bg-black border-t border-border_main flex items-center justify-between z-40 relative shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">

    </footer>
  );
}
