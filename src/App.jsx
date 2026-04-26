import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { io } from 'socket.io-client';
import { Sidebar, Header, Footer } from './components/Shell';
import LoadingScreen from './components/LoadingScreen';
import MainDashboardView from './views/MainDashboardView';
import NewsView from './views/NewsView';
import GridView from './views/GridView';
import CategoryDetailView from './views/CategoryDetailView';
import SearchView from './views/SearchView';
import MapsView from './views/MapsView';
import TVView from './views/TVView';
import EntityAnalysisView from './views/EntityAnalysisView';
import SentimentView from './views/SentimentView';
import GeoIntelView from './views/GeoIntelView';
import CryptoIntelligenceView from './views/CryptoIntelligenceView';
import ForexIntelligenceView from './views/ForexIntelligenceView';
import CommoditiesIntelligenceView from './views/CommoditiesIntelligenceView';
import AdvancedDeepAnalyticsView from './views/AdvancedDeepAnalyticsView';
import DisasterMappingView from './views/DisasterMappingView';
import InfrastructureView from './views/InfrastructureView';
import CyberIntelligenceView from './views/CyberIntelligenceView';
import SectorDetailView from './views/SectorDetailView';
import TimezoneMonitorView from './views/TimezoneMonitorView';
import ConflictIndexView from './views/ConflictIndexView';
import CrisisDisasterView from './views/CrisisDisasterView';
import GovernmentFacilityView from './views/GovernmentFacilityView';
// === TIER 1: INSTITUTIONAL INTELLIGENCE MODULES ===
import WatchlistView from './views/WatchlistView';
import CorrelationView from './views/CorrelationView';
import AlertCenterView from './views/AlertCenterView';
import EntityCorrelationView from './views/entity-correlation/EntityCorrelationView';
import { alertManager } from './utils/alertManager';

function App() {
  const [data, setData] = createSignal({});
  const [status, setStatus] = createSignal({ message: 'INITIALIZING', last_source: '', count: 0, total: 0 });
  const [isLoading, setIsLoading] = createSignal(true);
  const [searchTerm, setSearchTerm] = createSignal("");
  const [theme, setTheme] = createSignal((localStorage.getItem('enqy-terminal-theme') === 'light' ? 'dark' : localStorage.getItem('enqy-terminal-theme')) || 'dark');
  const [viewMode, setViewMode] = createSignal('table');
  const [selectedCategory, setSelectedCategory] = createSignal(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal([]);
  const [countries, setCountries] = createSignal([]);
  const [geoModule, setGeoModule] = createSignal('geo-map');
  const [infraModule, setInfraModule] = createSignal('airport');
  const [crisisModule, setCrisisModule] = createSignal('conflict');
  const [liveCount, setLiveCount] = createSignal(0);       // live article counter
  const [socketConnected, setSocketConnected] = createSignal(false); // socket status

  const handleGlobalSearch = async (q) => {
    setSearchQuery(q);
    setView('search');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/news/search?q=${encodeURIComponent(q)}`);
      const res = await response.json();
      if (res.success) {
        setSearchResults(res.results);
      }
    } catch (err) { console.error("Global search failed:", err); }
  };

  onMount(() => {
    let eventSource;

    // 0. DATA MERGER (Merge incoming news into state without losing existing ones)
    const mergeData = (incoming) => {
      setData(prev => {
        const next = { ...prev };
        Object.keys(incoming).forEach(rawCat => {
          const cat = rawCat.toUpperCase();
          const existing = next[cat] || [];
          const fresh = incoming[rawCat] || [];

          // Merge & Deduplicate by link
          const combined = [...fresh, ...existing];
          const unique = [];
          const seen = new Set();

          for (const item of combined) {
            if (!seen.has(item.link)) {
              seen.add(item.link);
              unique.push(item);
            }
          }

          // Sort by time and limit to 100 for performance
          next[cat] = unique.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);

          // Cleanup: If the raw category exists but is different from the normalized one, delete old key
          if (rawCat !== cat) delete next[rawCat];
        });
        return next;
      });
    };

    // 1. INITIAL CACHE LOAD
    const initLoad = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/news/data`);
        const parsed = await response.json();

        if (parsed.status) setStatus(parsed.status);
        if (parsed.news) mergeData(parsed.news);
        
        // Immediate release of loading screen to show the progressive UI
        setIsLoading(false);
      } catch (err) {
        console.error("Initial Load Error:", err);
        setIsLoading(false);
      }

      startStream();
    };

    const startStream = () => {
      if (eventSource) eventSource.close();
      eventSource = new EventSource(`${import.meta.env.VITE_API_BASE}/stream`);

      eventSource.onmessage = (event) => {
        const parsed = JSON.parse(event.data);
        if (parsed.status) setStatus(parsed.status);
        if (parsed.news) mergeData(parsed.news);
      };

      eventSource.onerror = (err) => {
        console.warn("Stream Disconnected. Backend may be offline.");
        eventSource.close();
      };
    };

    // 3. MANUAL SYNC TRIGER (Kill stream, fetch total, restart stream)
    window.triggerManualRefresh = async () => {
      console.log("--- INITIATING CONTROLLED MANUAL REFRESH ---");
      if (eventSource) eventSource.close(); // STOP STREAM WHEN MANUAL PROCESS STARTS
      setIsLoading(true);

      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/news/refresh`);
        const result = await response.json();
        console.log("Manual Sync Completed:", result);
      } catch (err) {
        console.error("Manual Sync Failed:", err);
      }

      // Resync and Restart Stream
      await initLoad();
    };

    // Begin the hybrid sync
    initLoad();

    // Satellite Services
    fetch(`${import.meta.env.VITE_SKY_API}/api/sky/countries`).then(r => r.json()).then(setCountries);
    applyTheme(theme());

    // ================================================================
    // SOCKET.IO — Real-time live stream from backup_service (port 5004)
    // ================================================================
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_BACKUP_URL;
    
    // Parse path if present in SOCKET_URL (e.g. https://api.asetpedia.online/backup)
    let socketPath = "/socket.io";
    let socketBaseUrl = SOCKET_URL;
    
    try {
      const urlObj = new URL(SOCKET_URL);
      if (urlObj.pathname && urlObj.pathname !== '/') {
        socketPath = urlObj.pathname.replace(/\/$/, "") + "/socket.io";
        socketBaseUrl = urlObj.origin;
      }
    } catch (e) {
      console.warn("[SOCKET] Invalid URL in env, falling back to default path");
    }

    const socket = io(socketBaseUrl, {
      path: socketPath,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      console.log(`[SOCKET] Connected to live stream (${socket.id})`);
      // Subscribe to all categories
      socket.emit('subscribe', { categories: [] });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      console.warn('[SOCKET] Disconnected from live stream');
    });

    socket.on('new_articles', (payload) => {
      const articles = payload.articles || [];
      if (articles.length === 0) return;

      // Increment live counter for the notification badge
      setLiveCount(prev => prev + articles.length);

      // Build a category-grouped object and merge into app state
      const incoming = {};
      articles.forEach(art => {
        const cat = (art.category || 'UNCATEGORIZED').toUpperCase();
        if (!incoming[cat]) incoming[cat] = [];
        incoming[cat].push({
          ...art,
          // Normalize timestamp — could be unix float or ISO string from socket
          timestamp: typeof art.timestamp === 'number'
            ? art.timestamp
            : new Date(art.timestamp).getTime() / 1000,
        });
      });

      mergeData(incoming);
      console.log(`[SOCKET] +${articles.length} live articles injected`);
    });

    // === ALERT MANAGER: init price polling + connect socket for keyword alerts
    alertManager.init();
    alertManager.setSocket(socket);

    onCleanup(() => {
      if (eventSource) eventSource.close();
      socket.disconnect();
      alertManager.destroy();
      window.removeEventListener('popstate', onPopState);
    });
  });

  const onPopState = (e) => {
    if (e.state && e.state.view) {
      setView(e.state.view);
    } else {
      const path = window.location.pathname.replace(/\/$/, "");
      setView(routeMap[path || '/'] || 'dashboard');
    }
  };

  onMount(() => {
    window.addEventListener('popstate', onPopState);
  });

  const patchData = (category, news) => {
    const cat = category.toUpperCase();
    setData(prev => ({
      ...prev,
      [cat]: [...(prev[cat] || []), ...news].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100)
    }));
  };

  const applyTheme = (t) => {
    ['theme-dark', 'theme-gray', 'theme-light'].forEach(cls => document.documentElement.classList.remove(cls));
    document.documentElement.classList.add(`theme-${t}`);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('enqy-terminal-theme', newTheme);
    applyTheme(newTheme);
  };

  // --- BRAIN: ROUTING ENGINE ---
  const routeMap = {
    '/': 'dashboard',
    '/dashboard': 'dashboard',
    '/news': 'news',
    '/maps': 'maps',
    '/tv': 'tv',
    '/entity': 'entity',
    '/sentiment': 'sentiment',
    '/geointel': 'geointel',
    '/disaster': 'disaster',
    '/crypto': 'crypto',
    '/forex': 'forex',
    '/commodities': 'commodities',
    '/deep-analytics': 'deep-analytics',
    '/infrastructure': 'infrastructure',
    '/trade-policy': 'trade-policy',
    // TIER 1: INSTITUTIONAL
    '/watchlist': 'watchlist',
    '/correlation': 'correlation',
    '/alerts': 'alerts',
    '/cyber-intel': 'cyber-intel',
    '/sectors': 'sectors',
    '/geo-monitor': 'geo-monitor',
    '/conflict-index': 'conflict-index',
    '/crisis-disaster': 'crisis-disaster',
    '/government-facility': 'government-facility',
    '/entity-correlation': 'entity-correlation',
  };

  // Immediate detection before first render
  const getInitialView = () => {
    const path = window.location.pathname.replace(/\/$/, ""); // Remove trailing slash
    return routeMap[path || '/'] || 'dashboard';
  };

  const [view, setView] = createSignal(getInitialView());

  const syncBrowserUrl = (v) => {
    const path = v === 'dashboard' ? '/' : `/${v}`;
    if (window.location.pathname !== path) {
      window.history.pushState({ view: v }, '', path);
    }
  };

  const navigateTo = (v) => {
    setView(v);
    syncBrowserUrl(v);
  };

  return (
    <div class="h-full flex bg-bg_main text-text_primary uppercase tracking-tight text-[12px] transition-colors duration-500 overflow-hidden" style={{ "font-family": "'Roboto', sans-serif" }}>

      <Sidebar
        view={view}
        setView={navigateTo}
        categories={Object.keys(data()).sort()}
        selectedCategory={selectedCategory}
        onCategorySelect={(cat) => setSelectedCategory(cat.toUpperCase())}
        geoModule={geoModule}
        setGeoModule={setGeoModule}
        infraModule={infraModule}
        setInfraModule={setInfraModule}
        crisisModule={crisisModule}
        setCrisisModule={setCrisisModule}
      />

      <main class="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header
          view={view}
          status={status}
          theme={theme}
          onThemeChange={handleThemeChange}
          socketConnected={socketConnected}
          liveCount={liveCount}
          onLiveClear={() => setLiveCount(0)}
        />

        <div class="flex-1 flex flex-col overflow-hidden relative">
          <Show when={view() === 'dashboard'}>
            <MainDashboardView theme={theme} />
          </Show>

          <Show when={view() === 'news'}>
            <Show when={isLoading()} fallback={
              <NewsView
                data={data}
                status={status}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onSearch={handleGlobalSearch}
                onArchiveFetch={patchData}
                onCategorySelect={(cat) => setSelectedCategory(cat.toUpperCase())}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                viewMode={viewMode}
                setViewMode={setViewMode}
              />
            }>
              <LoadingScreen status={status} />
            </Show>
          </Show>

          <Show when={view() === 'search'}>
            <SearchView
              results={searchResults}
              query={searchQuery}
              onBack={() => setView('news')}
            />
          </Show>

          <Show when={view() === 'maps'}>
            <MapsView countries={countries} />
          </Show>

          <Show when={view() === 'tv'}>
            <TVView />
          </Show>

          <Show when={view() === 'entity'}>
            <EntityAnalysisView theme={theme} />
          </Show>

          <Show when={view() === 'sentiment'}>
            <SentimentView />
          </Show>

          <Show when={view() === 'geointel'}>
            <GeoIntelView module={geoModule} countries={countries} />
          </Show>

          <Show when={view() === 'disaster'}>
            <CrisisDisasterView module="disaster" />
          </Show>

          <Show when={view() === 'crypto'}>
            <CryptoIntelligenceView theme={theme} />
          </Show>

          <Show when={view() === 'forex'}>
            <ForexIntelligenceView theme={theme} />
          </Show>

          <Show when={view() === 'commodities'}>
            <CommoditiesIntelligenceView theme={theme} />
          </Show>

          <Show when={view() === 'deep-analytics'}>
            <AdvancedDeepAnalyticsView />
          </Show>

          <Show when={view() === 'infrastructure'}>
            <InfrastructureView module={infraModule} />
          </Show>

          <Show when={view() === 'trade-policy'}>
            <TradePolicyView />
          </Show>

          {/* === TIER 1: INSTITUTIONAL FINANCIAL TERMINAL === */}
          <Show when={view() === 'watchlist'}>
            <WatchlistView />
          </Show>

          <Show when={view() === 'correlation'}>
            <CorrelationView />
          </Show>

          <Show when={view() === 'alerts'}>
            <AlertCenterView />
          </Show>

          <Show when={view() === 'cyber-intel'}>
            <CyberIntelligenceView data={data} theme={theme} />
          </Show>

          <Show when={view() === 'sectors'}>
            <SectorDetailView
              onNavigateToEntity={(symbol) => {
                navigateTo('entity');
                // Delay slightly so EntityAnalysisView mounts before we trigger search
                setTimeout(() => {
                  window.__sectorDrillSymbol = symbol;
                  window.dispatchEvent(new CustomEvent('sector-drill-symbol', { detail: { symbol } }));
                }, 200);
              }}
            />
          </Show>

          <Show when={view() === 'geo-monitor'}>
            <TimezoneMonitorView />
          </Show>

          <Show when={view() === 'crisis-disaster'}>
            <CrisisDisasterView module={crisisModule()} />
          </Show>


          <Show when={view() === 'government-facility'}>
            <GovernmentFacilityView />
          </Show>

          <Show when={view() === 'entity-correlation'}>
            <EntityCorrelationView />
          </Show>

        </div>

        <Footer />
      </main>
    </div>
  );
}

export default App;
