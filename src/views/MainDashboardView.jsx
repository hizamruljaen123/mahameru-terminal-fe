import { createSignal, onMount, createEffect, onCleanup, For, Show, createResource, createMemo } from 'solid-js';
import * as echarts from 'echarts';
import { io } from 'socket.io-client';

const DASHBOARD_API = import.meta.env.VITE_DASHBOARD_API;
const GEO_API = import.meta.env.VITE_GEO_DATA_API;

// ── Stale-While-Revalidate Cache Helpers ─────────────────────────────────────
// Persist last-good API responses to localStorage so the UI paints instantly
// on mount with stale data, then silently replaces with fresh data.
const SWR_TTL = 5 * 60 * 1000; // 5 minutes — stale data is still shown, just flagged
const swrGet = (key) => {
   try {
      const raw = localStorage.getItem(`swr_${key}`);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      return data ?? null;
   } catch { return null; }
};
const swrSet = (key, data) => {
   try { localStorage.setItem(`swr_${key}`, JSON.stringify({ data, ts: Date.now() })); } catch { }
};

// --- CONFIG & CONSTANTS ---
const CITIES = [
   { name: 'NEW YORK', tz: 'America/New_York', lat: 40.71, lng: -74.01, market: 'NYSE', region: 'AMER' },
   { name: 'LONDON', tz: 'Europe/London', lat: 51.51, lng: -0.13, market: 'LSE', region: 'EMEA' },
   { name: 'TOKYO', tz: 'Asia/Tokyo', lat: 35.69, lng: 139.69, market: 'TSE', region: 'APAC' },
   { name: 'SINGAPORE', tz: 'Asia/Singapore', lat: 1.29, lng: 103.85, market: 'SGX', region: 'APAC' },
   { name: 'JAKARTA', tz: 'Asia/Jakarta', lat: -6.21, lng: 106.85, market: 'IDX', region: 'APAC' },
   { name: 'DUBAI', tz: 'Asia/Dubai', lat: 25.20, lng: 55.27, market: 'DFM', region: 'ME' }
];

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? '0.00' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (v == null || isNaN(v)) ? '0.00%' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
const signColor = (v) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-text_secondary';

// --- SHARED COMPONENTS ---

function WidgetHeader(props) {
   return (
      <div class="px-3 py-1.5 border-b border-border_main bg-bg_main/5 flex items-center justify-between shrink-0">
         <div class="flex flex-col">
            <div class="flex items-center gap-2">
               <div class="w-1.5 h-1.5 bg-text_accent shadow-[0_0_8px_var(--text-accent)]" />
               <span class="text-[9px] font-black tracking-[0.2em] text-text_primary uppercase font-mono">{props.title}</span>
            </div>
            {props.subtitle && <span class="text-[7px] text-text_secondary opacity-40 uppercase ml-3">{props.subtitle}</span>}
         </div>
         <div class="flex gap-1.5">
            <div class="w-1 h-3 bg-border_main"></div>
            <div class="w-1 h-3 bg-border_main"></div>
         </div>
      </div>
   );
}

function LoadingSkeleton(props) {
   const rows = () => props.rows || 5;
   return (
      <div class="p-4 space-y-3">
         <For each={[...Array(rows())]}>
            {() => (
               <div class="flex flex-col gap-2">
                  <div class="h-1 bg-border_main/20 w-[80%]"></div>
                  <div class="h-0.5 bg-border_main/20 w-[40%]"></div>
               </div>
            )}
         </For>
      </div>
   );
}

// --- WIDGETS ---

function MarketOverviewWidget(props) {
   return (
      <div class="glass-panel flex flex-col overflow-hidden h-full group hover:border-text_accent/40">
         <WidgetHeader title="KEY ASSET MONITOR" />
         <div class="flex-1 overflow-hidden flex flex-col p-1">
            <Show when={props.loading && !props.data} fallback={
               <div class="flex-1 overflow-y-auto win-scroll">
                  <table class="w-full text-left border-collapse">
                     <thead class="sticky top-0 bg-bg_header z-10">
                        <tr class="text-[7px] text-text_secondary/40 uppercase font-black tracking-widest border-b border-border_main">
                           <th class="px-2 py-1">ASSET</th>
                           <th class="px-2 py-1">TYPE</th>
                           <th class="px-2 py-1 text-right">VALUE</th>
                           <th class="px-2 py-1 text-right">CHANGE (%)</th>
                        </tr>
                     </thead>
                     <tbody class="divide-y divide-border_main/20">
                        <For each={[
                           ...(props.data?.highlights?.crypto || []),
                           ...(props.data?.highlights?.forex || []),
                           ...(props.data?.highlights?.commodity || [])
                        ]}>
                           {(asset) => (
                              <tr class="hover:bg-text_accent/5 transition-colors">
                                 <td class="px-2 py-1 text-[9px] font-black text-text_primary truncate max-w-[80px] uppercase">{asset.name}</td>
                                 <td class="px-2 py-1 text-[7px] font-bold text-text_secondary/40 italic uppercase">{asset.symbol.split('=')[0].split('-')[0]}</td>
                                 <td class="px-2 py-1 text-[8px] font-bold text-text_accent text-right">{fmt(asset.price, 2)}</td>
                                 <td class={`px-2 py-1 text-[8px] font-bold text-right ${signColor(asset.change_pct)}`}>{fmtPct(asset.change_pct)}</td>
                              </tr>
                           )}
                        </For>
                     </tbody>
                  </table>
               </div>
            }>
               <LoadingSkeleton rows={6} />
            </Show>
         </div>
      </div>
   );
}

// --- MAIN VIEW ---

export default function MainDashboardView(props) {
   // ── Intel Resource (news, sentiment, geo, google trends) ──────────────────
   // Seeds immediately from localStorage stale cache for instant first paint.
   // Fresh API response replaces stale data silently when it arrives.
   const [intelStale] = createSignal(swrGet('intel'));
   const [intel, { refetch: refetchIntel }] = createResource(async () => {
      try {
         const resp = await fetch(`${DASHBOARD_API}/api/dashboard/intelligence`);
         const json = await resp.json();
         if (json.data) swrSet('intel', json.data);
         return json.data;
      } catch (e) { return intelStale(); }
   });
   // Merged view: stale until fresh data arrives
   const intelData = () => intel() ?? intelStale();

   // ── Country List (mostly static — cache aggressively) ─────────────────────
   const [countryList] = createResource(async () => {
      const cached = swrGet('countries');
      // Return cached immediately; also kick off a network refresh
      if (cached) {
         fetch(`${DASHBOARD_API}/api/dashboard/countries`)
            .then(r => r.json())
            .then(j => { if (j.data) swrSet('countries', j.data); })
            .catch(() => { });
         return cached;
      }
      try {
         const resp = await fetch(`${DASHBOARD_API}/api/dashboard/countries`);
         const json = await resp.json();
         if (json.data) swrSet('countries', json.data);
         return json.data;
      } catch (e) { return []; }
   });

   const [selectedGeo, setSelectedGeo] = createSignal({ code: 'GLO', name: 'GLOBAL' });
   const [searchQuery, setSearchQuery] = createSignal("");
   const [internalSearchQuery, setInternalSearchQuery] = createSignal("");
   const [showSelector, setShowSelector] = createSignal(false);
   const [specificTrends, { mutate: mutateTrends, refetch: refetchTrends }] = createResource(
      () => selectedGeo(),
      async (geo) => {
         if (geo.code === 'GLO') return null;
         try {
            const resp = await fetch(`${DASHBOARD_API}/api/dashboard/google-trends?geo=${geo.code}&name=${geo.name}`);
            const json = await resp.json();
            return json.data;
         } catch (e) { return []; }
      }
   );

   const filteredCountries = createMemo(() => countryList() || []);

   const [selectedTrendTopic, setSelectedTrendTopic] = createSignal(null);
   const [topicNews, { refetch: refetchTopicNews }] = createResource(
      () => selectedTrendTopic(),
      async (topic) => {
         if (!topic) return [];
         try {
            const resp = await fetch(`${DASHBOARD_API}/api/dashboard/google-news?q=${encodeURIComponent(topic)}`);
            const json = await resp.json();
            return json.data;
         } catch (e) { return []; }
      }
   );

   // ── Markets Resource ──────────────────────────────────────────────────────
   // After BE fix, /api/dashboard/markets reads from cache → <100ms warm.
   // We also persist results to localStorage so revisits are instant.
   const [marketsStale] = createSignal(swrGet('markets'));
   const [markets, { refetch: refetchMarkets }] = createResource(async () => {
      try {
         const resp = await fetch(`${DASHBOARD_API}/api/dashboard/markets`);
         const json = await resp.json();
         if (json.data) swrSet('markets', json.data);
         return json.data;
      } catch (e) { return marketsStale(); }
   });
   // Merged view: stale until fresh data arrives
   const marketsData = () => markets() ?? marketsStale();

   // ── Sentiment Heatmap Resource ─────────────────────────────────────────
   // Direct DB query on the `article` table — replaces 6MB microservice call.
   // Groups today's analysed articles by category, computes pct breakdown.
   const [heatmapStale] = createSignal(swrGet('sentiment_heatmap'));
   const [sentimentHeatmap, { refetch: refetchHeatmap }] = createResource(async () => {
      try {
         const resp = await fetch(`${DASHBOARD_API}/api/dashboard/sentiment-heatmap`);
         const json = await resp.json();
         if (json.data) swrSet('sentiment_heatmap', json.data);
         return json.data;
      } catch (e) { return heatmapStale(); }
   });
   const sentimentHeatmapData = () => sentimentHeatmap() ?? heatmapStale();



   const [weatherData, setWeatherData] = createSignal({});
   const [worldTimes, setWorldTimes] = createSignal({});
   const [marketStatus, setMarketStatus] = createSignal({});
   const [liveNews, setLiveNews] = createSignal([]);

   const updateClocks = () => {
      const now = new Date();
      const utcHours = now.getUTCHours();
      const utcMin = now.getUTCMinutes();
      const utcTime = utcHours + utcMin / 60;

      const newTimes = {};
      const newStatus = {};

      CITIES.forEach(city => {
         newTimes[city.name] = now.toLocaleTimeString('en-US', { timeZone: city.tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

         let isOpen = false;
         if (city.market === 'NYSE') isOpen = utcTime >= 14.5 && utcTime <= 21;
         else if (city.market === 'LSE') isOpen = utcTime >= 8 && utcTime <= 16.5;
         else if (city.market === 'TSE') isOpen = utcTime >= 0 && utcTime <= 6;
         else if (city.market === 'SGX') isOpen = utcTime >= 1 && utcTime <= 9;
         else if (city.market === 'IDX') isOpen = utcTime >= 2 && utcTime <= 9;
         else if (city.market === 'DFM') isOpen = utcTime >= 6 && utcTime <= 11;
         newStatus[city.name] = isOpen;
      });
      setWorldTimes(newTimes);
      setMarketStatus(newStatus);
   };

   const fetchWeatherForCity = async (city) => {
      try {
         const resp = await fetch(`${GEO_API}/api/weather/forecast?lat=${city.lat}&lng=${city.lng}&tz=${city.tz}`);
         const data = await resp.json();
         if (data && data.current_weather) {
            setWeatherData(prev => ({
               ...prev,
               [city.name]: {
                  temperature: data.current_weather.temperature,
                  windspeed: data.current_weather.windspeed
               }
            }));
         }
      } catch (e) { console.error(`Weather sync failed for ${city.name}:`, e); }
   };

   const fetchAllWeather = () => {
      CITIES.forEach(city => fetchWeatherForCity(city));
   };

   const getMarketCountdown = (city) => {
      const now = new Date();
      const utcTime = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
      const day = now.getUTCDay(); // 0: Sun, 1-5: Mon-Fri, 6: Sat

      const rules = {
         'NYSE': { open: 14.5, close: 21 },
         'LSE': { open: 8, close: 16.5 },
         'TSE': { open: 0, close: 6 },
         'SGX': { open: 1, blue: 9 },
         'IDX': { open: 2, close: 9 },
         'DFM': { open: 6, close: 11 }
      };

      const rule = rules[city.market];
      if (!rule) return "N/A";

      // 1. Weekend Check
      if (day === 0 || day === 6) return "WEEKEND";

      // 2. Currently Open (Active)
      if (utcTime >= rule.open && utcTime < rule.close) return "TRADING";

      // 3. Before Open
      if (utcTime < rule.open) {
         const diff = rule.open - utcTime;
         const h = Math.floor(diff);
         const m = Math.floor((diff - h) * 60);
         return `T-${h}H ${m}M`;
      }

      // 4. After Close
      return "CLOSED";
   };

   onMount(() => {
      updateClocks();
      const clockItv = setInterval(updateClocks, 1000);

      // --- PRELOAD NEWS CACHE (SQLite Fast Access) ---
      // Populate the stream immediately from the last 10 cached articles
      fetch(`${DASHBOARD_API}/api/dashboard/news-preload`)
         .then(r => r.json())
         .then(j => { if (j.data) setLiveNews(j.data); })
         .catch(() => { });

      // --- NEWS SOCKET INTEGRATION ---
      const newsSocket = io(import.meta.env.VITE_BACKUP_URL);
      newsSocket.on("new_articles", (data) => {
         // data format from backup_service: { count: X, articles: [...] }
         if (data && data.articles) {
            setLiveNews(prev => {
               const next = [...data.articles, ...prev];
               return next.slice(0, 30); // Keep last 30 items
            });
         }
      });

      fetchAllWeather();
      const weatherSyncItv = setInterval(fetchAllWeather, 1800000); // 30m

      // REAL-TIME BACKGROUND SYNC
      // Markets updated more frequently (10s) to show sequential discovdery
      const marketSyncItv = setInterval(() => refetchMarkets(), 10000);

      const syncItv = setInterval(() => {
         refetchIntel();
         refetchHeatmap();
         if (selectedGeo().code !== 'GLO') refetchTrends();
         if (selectedTrendTopic()) refetchTopicNews();
      }, 60000);

      const handleResize = () => sentimentChart && sentimentChart.resize();
      window.addEventListener('resize', handleResize);
      onCleanup(() => {
         clearInterval(clockItv);
         clearInterval(syncItv);
         clearInterval(marketSyncItv);
         clearInterval(weatherSyncItv);
         window.removeEventListener('resize', handleResize);
      });
   });

   let sentimentChartRef;
   let sentimentChart;
   // Sentiment Chart Effect — only init once; update via setOption to avoid flicker
   // Data now comes from /api/dashboard/sentiment-heatmap (direct DB, <10ms)
   createEffect(() => {
      const sentiment = sentimentHeatmapData();
      if (sentiment && sentiment.length > 0 && sentimentChartRef) {
         const currentTheme = props.theme?.() === 'light' ? null : 'dark';
         if (!sentimentChart || sentimentChart.isDisposed()) {
            sentimentChart = echarts.init(sentimentChartRef, currentTheme);
         }
         const rawData = sentiment || [];

         sentimentChart.setOption({
            backgroundColor: 'transparent',
            tooltip: {
               trigger: 'item',
               formatter: (info) => {
                  const d = info.data;
                  if (!d || d.positive_pct === undefined) return '';
                  return `
                      <div style="font-family: 'Roboto', sans-serif; font-size: 10px; color: #fff; background: #0a0a0a; border: 1px solid #333; padding: 10px; border-radius: 4px;">
                        <div style="font-weight: 900; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 5px; color: #00ff41;">${d.name}</div>
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                          <span>POSITIVE:</span>
                          <span style="color: #10b981; font-weight: bold;">${d.positive_pct.toFixed(1)}%</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                          <span>NEUTRAL:</span>
                          <span style="color: #64748b; font-weight: bold;">${d.neutral_pct.toFixed(1)}%</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                          <span>NEGATIVE:</span>
                          <span style="color: #ef4444; font-weight: bold;">${d.negative_pct.toFixed(1)}%</span>
                        </div>
                        <div style="margin-top: 8px; border-top: 1px solid #222; padding-top: 5px; font-weight: 900; font-size: 11px; text-align: center; color: ${d.score >= 0 ? '#10b981' : '#ef4444'}">
                          SCORE: ${d.score.toFixed(1)}
                        </div>
                      </div>
                    `;
               }
            },
            series: [{
               type: 'treemap',
               id: 'sentiment',
               left: 0, right: 0, top: 0, bottom: 0,
               width: '100%', height: '100%',
               data: sentiment
                  .filter(d => d.category && d.total > 0)
                  .map(d => ({
                     name: d.category,
                     value: d.total || 10,
                     positive_pct: d.positive_pct,
                     neutral_pct: d.neutral_pct,
                     negative_pct: d.negative_pct,
                     score: d.score,
                     itemStyle: {
                        color: d.score > 20 ? '#059669' :
                           d.score > 5 ? '#10b981' :
                              d.score > -5 ? '#334155' :
                                 d.score > -20 ? '#dc2626' : '#991b1b',
                        borderColor: '#000',
                        borderWidth: 1
                     }
                  })),
               label: {
                  show: true,
                  formatter: (params) => {
                     const d = params.data;
                     if (!d || d.positive_pct === undefined) return params.name;
                     const pcts = [
                        { label: 'POS', val: d.positive_pct || 0 },
                        { label: 'NEU', val: d.neutral_pct || 0 },
                        { label: 'NEG', val: d.negative_pct || 0 }
                     ];
                     const dominant = pcts.sort((a, b) => b.val - a.val)[0];
                     return `${params.name}\n${dominant.label}: ${dominant.val.toFixed(0)}%`;
                  },
                  fontSize: 8,
                  fontWeight: '900',
                  color: '#fff',
                  lineHeight: 11
               },
               breadcrumb: { show: false },
               itemStyle: { borderColor: '#000', borderWidth: 1 }
            }]
         });
      }
   });

   return (
      <div class="flex-1 flex flex-col bg-bg_main overflow-hidden text-text_primary text-[10px] relative">




         {/* 1. MASTER SURVEILLANCE BAR (Partial Loaded World Clocks) */}
         <div class="grid grid-cols-6 bg-bg_sidebar/80 border-b border-border_main shrink-0">
            <For each={CITIES}>
               {(city) => (
                  <div class="px-4 py-2.5 border-r border-border_main flex flex-col items-center justify-center relative overflow-hidden group hover:bg-bg_main/5">
                     <div class={`absolute top-0 right-0 px-2 py-0.5 text-[6px] font-black ${marketStatus()[city.name] ? 'bg-emerald-500 text-bg_main' : 'bg-red-500/20 text-red-500'}`}>
                        {marketStatus()[city.name] ? 'ACTIVE' : 'STANDBY'}
                     </div>
                     <span class="text-[8px] font-black text-text_secondary group-hover:text-text_accent transition-colors tracking-widest opacity-60 mb-0.5">{city.name}</span>
                     <div class="flex flex-col items-center">
                        <span class="text-[15px] font-black text-white leading-none tracking-tighter">{worldTimes()[city.name] || '--:--:--'}</span>
                        <span class={`text-[8px] font-black mt-1 uppercase ${getMarketCountdown(city) === 'TRADING' ? 'text-emerald-400' : 'text-blue-400/60'}`}>
                           {getMarketCountdown(city)}
                        </span>
                     </div>
                  </div>
               )}
            </For>
         </div>

         {/* 2. MARKET WATCHLIST — uses marketsData() for stale-while-revalidate */}
         <div class="h-10 bg-bg_main/50 border-b border-border_main flex items-center overflow-hidden shrink-0">
            <div class="px-4 py-2 bg-text_accent text-bg_main text-[8px] font-black tracking-widest shrink-0 skew-x-[-15deg] h-full flex items-center shadow-[5px_0_15px_rgba(0,0,0,0.5)] z-10">
               WATCHLIST
            </div>
            <div class="flex-1 overflow-hidden flex items-center">
               <Show when={marketsData()?.watchlist} fallback={
                  <span class="text-[8px] text-text_secondary/40 font-black px-4 animate-pulse uppercase tracking-widest">
                     SYNCING MARKET FEED...
                  </span>
               }>
                  <div class="ticker-scroll flex items-center gap-6">
                     <For each={[1, 2]}>
                        {() => (
                           <div class="flex items-center gap-6 pr-6">
                              <For each={Object.entries(marketsData()?.watchlist || {})}>
                                 {([cat, items]) => (
                                    <div class="flex items-center gap-4">
                                       <span class="text-[7px] font-black text-text_accent opacity-50 uppercase">{cat.replace(/_/g, ' ')}</span>
                                       <For each={items}>
                                          {(asset) => (
                                             <div class="flex items-center gap-2 cursor-default group whitespace-nowrap shrink-0 animate-in fade-in slide-in-from-right-2 duration-700">
                                                <span class="text-[9px] font-black text-text_primary group-hover:text-text_accent whitespace-nowrap">{asset.name}</span>
                                                <span class={`text-[8px] font-mono font-bold ${signColor(asset.change_pct)} whitespace-nowrap`}>{fmtPct(asset.change_pct)}</span>
                                             </div>
                                          )}
                                       </For>
                                       <div class="w-px h-3 bg-border_main mx-2"></div>
                                    </div>
                                 )}
                              </For>
                           </div>
                        )}
                     </For>
                  </div>
               </Show>
            </div>
         </div>

         {/* 2. PRIMARY SURVEILLANCE GRID */}
         <div class="flex-1 p-3 grid grid-cols-12 grid-rows-12 gap-3 overflow-hidden">

            {/* COLUMN A: SENTIMENT & WEATHER */}
            <div class="col-span-3 row-span-12 flex flex-col gap-3 overflow-hidden">
               <div class="glass-panel flex flex-col shrink-0 h-[280px]">
                  <WidgetHeader
                     title="NEWS SENTIMENT HEATMAP"
                     subtitle={`TODAY · ${new Date().toLocaleDateString()} · DATABASE_DIRECT`}
                  />
                  <div class="flex-1 p-2">
                     {/* Skeleton only when zero data — stale or fresh */}
                     <Show when={sentimentHeatmapData()?.length > 0} fallback={
                        <div class="flex flex-col items-center justify-center h-full gap-2">
                           <LoadingSkeleton rows={8} />
                           <span class="text-[7px] text-text_secondary/30 uppercase font-black animate-pulse tracking-widest">
                              QUERYING DATABASE...
                           </span>
                        </div>
                     }>
                        <div ref={sentimentChartRef} class="w-full h-full"></div>
                     </Show>
                  </div>
               </div>


               <div class="glass-panel flex flex-col flex-1 overflow-hidden">
                  <WidgetHeader title="METEOROLOGICAL STATUS" />
                  <div class="flex-1 overflow-y-auto win-scroll">
                     <div class="grid grid-cols-1 divide-y divide-border_main">
                        <For each={CITIES}>
                           {(city) => (
                              <div class="p-3 flex items-center justify-between group hover:bg-bg_main/5 transition-colors">
                                 <div class="flex flex-col">
                                    <span class="text-[9px] font-black text-text_primary">{city.name}</span>
                                    <span class="text-[7px] text-text_secondary opacity-40 uppercase">ZONE: {city.region}</span>
                                 </div>
                                 <div class="flex flex-col items-end">
                                    <span class="text-[14px] font-black text-blue-400">
                                       {weatherData()[city.name] ? `${Math.round(weatherData()[city.name].temperature)}°C` : '--'}
                                    </span>
                                    <span class="text-[7px] font-black text-text_secondary/50 uppercase">
                                       WIND: {weatherData()[city.name]?.windspeed || '0'} KM/H
                                    </span>
                                 </div>
                              </div>
                           )}
                        </For>
                     </div>
                  </div>

               </div>
            </div>

            {/* COLUMN B: CENTRAL NEWS & OPS */}
            <div class="col-span-6 row-span-12 flex flex-col gap-3 overflow-hidden">
               <div class="glass-panel flex-[3] flex flex-col overflow-hidden">
                  <WidgetHeader title="LIVE NEWS STREAM" />
                  <div class="flex-1 overflow-hidden flex flex-col">
                     {/* Show skeleton only if no data at all (not even stale) */}
                     <Show when={liveNews().length > 0 || intelData()?.top_news?.length > 0} fallback={
                        <div class="p-6"><LoadingSkeleton rows={12} /></div>
                     }>
                        <div class="flex-1 overflow-y-auto win-scroll relative">
                           <table class="w-full text-left">
                              <thead class="sticky top-0 bg-bg_header z-10 border-b border-border_main">
                                 <tr class="text-[8px] text-text_secondary/40 uppercase font-black tracking-widest">
                                    <th class="p-3">TIME</th>
                                    <th class="p-3">CAT</th>
                                    <th class="p-3">LATEST NEWS</th>
                                    <th class="p-3 text-right">SOURCE</th>
                                 </tr>
                              </thead>
                              <tbody class="divide-y divide-border_main">
                                 <For each={liveNews().length > 0 ? liveNews() : (intelData()?.top_news || [])}>
                                    {(news) => (
                                       <tr class="hover:bg-text_accent/10 group cursor-pointer animate-in fade-in slide-in-from-left duration-300">
                                          <td class="p-3 opacity-20 text-[8px] font-bold">
                                             {news.timestamp ? new Date(news.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--'}
                                          </td>
                                          <td class="p-3">
                                             <span class="px-1 py-0.5 border border-border_main text-[7px] font-black uppercase opacity-60 group-hover:border-text_accent/40 group-hover:text-text_accent">{news.category}</span>
                                          </td>
                                          <td class="p-3">
                                             <div class="text-[10px] font-black text-text_primary group-hover:text-text_accent leading-tight line-clamp-2 uppercase">
                                                {news.description?.replace(/<[^>]*>?/gm, '') || news.title}
                                             </div>
                                          </td>
                                          <td class="p-3 text-right text-[8px] font-black opacity-40 group-hover:opacity-60 whitespace-nowrap">{news.source || 'SYSTEM'}</td>
                                       </tr>
                                    )}
                                 </For>
                              </tbody>
                           </table>
                        </div>
                     </Show>
                  </div>
               </div>
               <div class="flex-[1] shrink-0">
                  <MarketOverviewWidget data={marketsData()} loading={!marketsData()} />
               </div>
            </div>

            {/* COLUMN C: GLOBAL SEARCH TRENDS & GEO ACTIVITY */}
            <div class="col-span-3 row-span-12 flex flex-col gap-3 overflow-hidden">
               <div class="glass-panel flex-[2] flex flex-col overflow-hidden relative">
                  <div class="flex items-center justify-between px-3 py-2 border-b border-border_main bg-bg_header/30">
                     <div class="flex flex-col">
                        <span class="text-[9px] font-black text-text_accent tracking-widest uppercase">
                           {selectedTrendTopic() ? 'TOPIC DETAILS' : 'GLOBAL TRENDING'}
                        </span>
                        <span class="text-[7px] text-text_secondary/40 font-bold uppercase truncate max-w-[150px]">
                           {selectedTrendTopic() ? `TOPIC: ${selectedTrendTopic()}` : `${selectedGeo().name} // ANALYSIS`}
                        </span>
                     </div>
                     <div class="flex items-center gap-2">
                        <Show when={selectedTrendTopic()}>
                           <button
                              onClick={() => setSelectedTrendTopic(null)}
                              class="px-2 py-0.5 border border-text_accent text-[7px] font-black bg-text_accent/10 text-text_accent hover:bg-text_accent hover:text-bg_main transition-colors uppercase"
                           >
                              BACK TO TRENDS
                           </button>
                        </Show>
                        <button
                           onClick={() => setShowSelector(!showSelector())}
                           class="px-2 py-0.5 border border-border_main text-[7px] font-black hover:bg-text_accent hover:text-bg_main transition-colors uppercase"
                        >
                           {showSelector() ? 'CLOSE' : 'SELECT REGION'}
                        </button>
                     </div>
                  </div>

                  {/* Searchable Selector Overlay */}
                  <Show when={showSelector()}>
                     <div class="absolute inset-0 top-9 z-20 bg-[#0a0a0a] p-3 flex flex-col gap-2 border-t border-border_main">
                        <div class="text-[7px] font-black text-text_accent opacity-50 uppercase tracking-[0.2em] mb-1">SELECT REGION</div>
                        <div class="flex-1 overflow-y-auto win-scroll divide-y divide-border_main/10 pr-1">
                           <div
                              onClick={() => { setSelectedGeo({ code: 'GLO', name: 'GLOBAL' }); setShowSelector(false); }}
                              class="py-2 px-1 hover:bg-text_accent/10 cursor-pointer flex justify-between group"
                           >
                              <span class="text-[9px] font-black text-text_primary group-hover:text-text_accent">GLOBAL CONSOLIDATED</span>
                              <span class="text-[7px] font-black text-text_accent opacity-50">GLO</span>
                           </div>
                           <For each={filteredCountries()}>
                              {(c) => (
                                 <div
                                    onClick={() => { setSelectedGeo(c); setShowSelector(false); }}
                                    class="py-2 px-1 hover:bg-text_accent/10 cursor-pointer flex justify-between items-center group"
                                 >
                                    <div class="flex items-center gap-3">
                                       <img src={`https://flagcdn.com/w20/${c.code.toLowerCase()}.png`} class="w-4 h-3 object-cover opacity-80 group-hover:opacity-100" />
                                       <span class="text-[9px] font-black text-text_primary uppercase group-hover:text-text_accent">{c.name}</span>
                                    </div>
                                    <span class="text-[7px] font-black text-text_accent opacity-50">{c.code}</span>
                                 </div>
                              )}
                           </For>
                        </div>
                     </div>
                  </Show>

                  <div class="flex-1 overflow-hidden flex flex-col">
                     {/* Show skeleton ONLY when no data at all — stale or fresh */}
                     <Show when={intelData() || specificTrends() || topicNews()} fallback={
                        <div class="p-4"><LoadingSkeleton rows={10} /></div>
                     }>
                        <div class="flex-1 overflow-y-auto win-scroll p-1">
                           <table class="w-full text-left">
                              <thead class="sticky top-0 bg-bg_header z-10 shadow-sm border-b border-border_main">
                                 <Show when={!selectedTrendTopic()} fallback={
                                    <tr class="text-[7px] font-black text-text_secondary/40 uppercase tracking-widest">
                                       <th class="px-2 py-1.5 w-16">TIME</th>
                                       <th class="px-2 py-1.5">SOURCE // TITLE</th>
                                    </tr>
                                 }>
                                    <tr class="text-[7px] font-black text-text_secondary/40 uppercase tracking-widest">
                                       <th class="px-2 py-1.5 w-10">LOCATION</th>
                                       <th class="px-2 py-1.5">TOPIC</th>
                                       <th class="px-2 py-1.5 text-right">VOLUME</th>
                                    </tr>
                                 </Show>
                              </thead>
                              <tbody>
                                 <Show when={!selectedTrendTopic()} fallback={
                                    <For each={topicNews() || []}>
                                       {(art) => (
                                          <tr class="border-b border-border_main/10 hover:bg-text_accent/5 cursor-pointer" onClick={() => window.open(art.link, '_blank')}>
                                             <td class="px-2 py-1.5 align-top">
                                                <span class="text-[7px] font-black text-text_secondary/50 uppercase whitespace-nowrap">
                                                   {new Date(art.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                             </td>
                                             <td class="px-2 py-1.5">
                                                <div class="text-[8px] font-black text-text_accent uppercase mb-0.5">{art.source}</div>
                                                <div class="text-[9px] font-bold text-text_primary leading-tight line-clamp-2 uppercase">{art.title}</div>
                                             </td>
                                          </tr>
                                       )}
                                    </For>
                                 }>
                                    <For each={selectedGeo().code === 'GLO' ? intelData()?.google_trends : (specificTrends() || [])}>
                                       {(trend) => (
                                          <tr class="border-b border-border_main/10 hover:bg-blue-500/5 group transition-colors cursor-pointer" onClick={() => setSelectedTrendTopic(trend.topic)}>
                                             <td class="px-2 py-1.5">
                                                <div class="flex items-center gap-1.5">
                                                   <img src={`https://flagcdn.com/w20/${trend.country_code.toLowerCase()}.png`} class="w-3 h-2.5 object-cover opacity-60" />
                                                   <span class="text-[8px] font-black text-blue-400">{trend.country_code}</span>
                                                </div>
                                             </td>
                                             <td class="px-2 py-1.5">
                                                <div class="text-[9px] font-black text-text_primary group-hover:text-text_accent uppercase truncate max-w-[140px]">{trend.topic}</div>
                                                <div class="text-[6px] text-text_secondary/30 italic uppercase">{trend.cat || 'BUSINESS'}</div>
                                             </td>
                                             <td class="px-2 py-1.5 text-right">
                                                <div class="text-[8px] font-black text-text_primary">{trend.traffic}</div>
                                             </td>
                                          </tr>
                                       )}
                                    </For>
                                 </Show>
                              </tbody>
                           </table>
                        </div>
                     </Show>
                  </div>
               </div>

               <div class="glass-panel flex-[1] flex flex-col overflow-hidden">
                  <WidgetHeader title="SENTIMENT TRENDS" />
                  <div class="flex-1 p-3 space-y-3 overflow-y-auto win-scroll">
                     <Show when={intelData()} fallback={<LoadingSkeleton rows={5} />}>
                        <>

                           <For each={intelData()?.trending_topics?.slice(0, 4)}>
                              {(topic) => (
                                 <div class="flex items-center justify-between group mb-2">
                                    <div class="flex flex-col">
                                       <span class="text-[9px] font-black text-white group-hover:text-text_accent transition-colors truncate w-32 uppercase">{topic.name}</span>
                                       <div class="flex items-center gap-1">
                                          <span class={`text-[6px] px-1 ${topic.score >= 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'} font-black italic`}>
                                             {topic.score >= 0 ? 'BULLISH' : 'BEARISH'}
                                          </span>
                                       </div>
                                    </div>
                                    <div class="flex flex-col items-end shrink-0">
                                       <span class="text-[10px] font-black text-text_accent">{topic.count}</span>
                                       <span class="text-[6px] opacity-20 italic">PULSE</span>
                                    </div>
                                 </div>
                              )}
                           </For>

                           <div class="mt-4 pt-2 border-t border-border_main/10 text-[7px] text-text_accent/40 font-black uppercase mb-1 tracking-[0.2em]">ACTIVE REGIONS</div>
                           <For each={intelData()?.geo_trends?.slice(0, 4)}>
                              {(geo) => (
                                 <div class="flex items-center justify-between group mb-2">
                                    <div class="flex flex-col">
                                       <span class="text-[9px] font-black text-text_primary truncate w-32 uppercase">{geo.name}</span>
                                       <span class="text-[7px] text-text_secondary opacity-30 uppercase tracking-widest">{geo.topCategory}</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                       <div class="w-12 h-1 bg-border_main overflow-hidden">
                                          <div class="h-full bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.5)]" style={`width: ${Math.min(100, (geo.count / (intelData()?.geo_trends[0]?.count || 1)) * 100)}%`}></div>
                                       </div>
                                       <span class="text-[9px] font-black text-blue-400 w-4 text-right">{geo.count}</span>
                                    </div>
                                 </div>
                              )}
                           </For>
                        </>
                     </Show>
                  </div>
               </div>
            </div>
         </div>

         {/* 3. TERMINAL STATUS BAR */}

      </div>
   );
}

function WidgetTicker(props) {
   return (
      <div class="glass-panel flex flex-col shrink-0">
         <WidgetHeader title={props.title} />
         <div class="p-3">
            <Show when={props.loading && !props.data} fallback={
               <div class="grid grid-cols-2 gap-2">
                  <For each={props.data?.slice(0, 4)}>
                     {(asset) => (
                        <div class="bg-bg_main/5 p-2 flex flex-col gap-0.5 border border-border_main">
                           <span class="text-[7px] text-text_secondary opacity-30 uppercase font-black leading-none">{asset.symbol}</span>
                           <div class="flex items-center justify-between">
                              <span class="text-[10px] font-black text-text_primary truncate max-w-[60px] leading-none uppercase">{asset.name}</span>
                              <span class={`text-[8px] font-black ${signColor(asset.change_pct)}`}>{fmtPct(asset.change_pct)}</span>
                           </div>
                        </div>
                     )}
                  </For>
               </div>
            }>
               <LoadingSkeleton rows={2} />
            </Show>
         </div>
      </div>
   );
}
