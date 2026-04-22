import { createSignal, onMount, For, Show, createEffect } from 'solid-js';

export default function GlobalEconomyPanel() {
  const [selectedCountry, setSelectedCountry] = createSignal('USA');
  const [countries, setCountries] = createSignal([]);
  const [macroData, setMacroData] = createSignal({
    yields: [
      { id: 'US3M', label: 'Treasury 3M', value: '5.38%', change: '-0.01' },
      { id: 'US2Y', label: 'Treasury 2Y', value: '4.82%', change: '+0.03' },
      { id: 'US10Y', label: 'Treasury 10Y', value: '4.45%', change: '+0.05' },
    ],
    centralBanks: [
      { id: 'FED', name: 'Federal Reserve', rate: '5.50%', bias: 'Hawkish' },
      { id: 'ECB', name: 'Euro Central Bank', rate: '4.50%', bias: 'Neutral' },
      { id: 'BOJ', name: 'Bank of Japan', rate: '0.10%', bias: 'Dovish' },
      { id: 'BI', name: 'Bank Indonesia', rate: '6.25%', bias: 'Hawkish' },
    ],
    cpi: [
      { country: 'United States', value: '3.4%', status: 'High' },
      { country: 'European Union', value: '2.4%', status: 'Stable' },
      { country: 'United Kingdom', value: '3.2%', status: 'High' },
      { country: 'Indonesia', value: '3.0%', status: 'Stable' },
    ]
  });

  const [sectors, setSectors] = createSignal([]);
  const [countryProxies, setCountryProxies] = createSignal([]);
  const [countryNews, setCountryNews] = createSignal([]);
  const [loadingProxies, setLoadingProxies] = createSignal(false);
  const [loadingNews, setLoadingNews] = createSignal(false);

  const fetchCountries = async () => {
    try {
      const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca3');
      const data = await res.json();
      const sorted = data.map(c => ({
        id: c.cca3,
        name: c.name.common
      })).sort((a, b) => a.id.localeCompare(b.id));
      setCountries(sorted);
    } catch (e) {
      console.error("Country Fetch Error:", e);
      setCountries([
        { id: 'USA', name: 'United States' },
        { id: 'CHN', name: 'China' },
        { id: 'RUS', name: 'Russia' },
        { id: 'IDN', name: 'Indonesia' }
      ]);
    }
  };

  const fetchSectors = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_DASHBOARD_API}/api/economy/sectors`);
      const data = await res.json();
      setSectors(data.data || []);
    } catch (e) {
      console.error("Sector Fetch Error:", e);
    }
  };

  const fetchCountryProxies = async (code) => {
    setLoadingProxies(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_DASHBOARD_API}/api/economy/country-proxies/${code}`);
      const data = await res.json();
      const mappedResults = (data.data || []).map(p => {
         const nameMap = {
            'MARKET_INDEX': 'Equity Index',
            'CURRENCY_STRENGTH': 'Currency Strength',
            'BOND_PROXY': 'Sovereign Debt'
         };
         return { ...p, readableName: nameMap[p.name] || p.name };
      });
      setCountryProxies(mappedResults);
    } catch (e) {
      console.error("Proxy Fetch Error:", e);
      setCountryProxies([]);
    } finally {
      setLoadingProxies(false);
    }
  };

  const fetchCountryNews = async (code, name) => {
    setLoadingNews(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_DASHBOARD_API}/api/economy/country-news/${code}/${name}`);
      const data = await res.json();
      setCountryNews(data.data || []);
    } catch (e) {
      console.error("News Fetch Error:", e);
      setCountryNews([]);
    } finally {
      setLoadingNews(false);
    }
  };

  const [countryProfile, setCountryProfile] = createSignal(null);
  const [loadingProfile, setLoadingProfile] = createSignal(false);

  const fetchCountryProfile = async (code, name) => {
    setLoadingProfile(true);
    try {
      // 1. Fetch Wikipedia directly from Frontend
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${name.replace(' ', '_')}`;
      const wikiRes = await fetch(wikiUrl);
      const wikiData = wikiRes.ok ? await wikiRes.json() : null;

      // 2. Fetch World Bank Stats from Backend
      const res = await fetch(`${import.meta.env.VITE_DASHBOARD_API}/api/economy/country-profile/${code}/${name}`);
      const data = await res.json();
      
      const combined = {
         ...(data.data || {}),
         summary: wikiData?.extract || 'Profile not available.',
         thumbnail: wikiData?.thumbnail?.source || null
      };

      setCountryProfile(combined);
    } catch (e) {
      console.error("Profile Fetch Error:", e);
      setCountryProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  onMount(() => {
    fetchSectors();
    fetchCountries();
  });

  createEffect(() => {
    const code = selectedCountry();
    const list = countries();
    if (code) {
       fetchCountryProxies(code);
       const c = list.find(x => x.id === code);
       if (c) {
          fetchCountryNews(c.id, c.name);
          fetchCountryProfile(c.id, c.name);
       }
    }
  });

  const formatValue = (val, type) => {
    if (val === null || val === undefined) return 'N/A';
    if (type === 'currency') return '$' + (val / 1e12).toFixed(2) + 'T';
    if (type === 'percent') return val.toFixed(2) + '%';
    if (type === 'pop') return (val / 1e6).toFixed(1) + 'M';
    return val.toLocaleString();
  };

  return (
    <div class="h-full flex overflow-hidden bg-bg_main text-text_primary uppercase" style="font-family: 'Roboto', sans-serif;">
      {/* LEFT SIDEBAR: COUNTRY LIST (SCROLLABLE) */}
      <div class="w-64 border-r border-border_main bg-bg_sidebar flex flex-col shrink-0 py-4 overflow-y-auto win-scroll">
        <div class="px-4 mb-4">
           <span class="text-[10px] font-bold text-text_accent uppercase tracking-widest">GLOBAL REGIONS</span>
        </div>
        <div class="flex flex-col gap-1 px-2">
           <For each={countries()}>
             {(c) => (
               <button 
                 onClick={() => setSelectedCountry(c.id)}
                 title={c.name}
                 class={`w-full text-left px-3 py-2 rounded-sm font-bold text-[10px] border transition-all ${selectedCountry() === c.id ? 'bg-text_accent text-bg_main border-text_accent' : 'border-transparent text-text_secondary opacity-60 hover:opacity-100 uppercase'}`}
               >
                 {c.name}
               </button>
             )}
           </For>
        </div>
      </div>

      {/* MAIN VIEW */}
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR / HEADER */}
        <div class="px-6 py-4 border-b border-border_main bg-bg_header flex justify-between items-center">
          <div class="flex items-center gap-6">
            <h1 class="text-xl font-bold text-text_accent tracking-tight uppercase italic">ECONOMY & MACRO ANALYSIS</h1>
            <div class="flex items-center gap-2 bg-text_accent/10 px-3 py-1 border border-text_accent/20">
               <span class="text-[9px] font-bold text-text_accent uppercase">Target:</span>
               <span class="text-[11px] font-bold text-text_primary uppercase tracking-widest">{selectedCountry()}</span>
            </div>
          </div>
          <div class="flex items-center gap-4 text-[9px] text-text_secondary font-bold uppercase opacity-60">
             <span>Version 2.0.4v</span>
             <span class="w-1 h-3 bg-text_accent/40"></span>
             <span>INTEGRATED NEWS WIRE</span>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto win-scroll">
           
           {/* COUNTRY PROFILE & MACRO STATS */}
           <Show when={countryProfile() && (countryProfile().summary !== 'Profile not available.' || Object.keys(countryProfile().stats || {}).length > 0)}>
              <div class="p-6 border-b border-border_main bg-bg_header/5">
                 <div class="grid grid-cols-12 gap-8">
                    {/* Wiki Summary */}
                    <Show when={countryProfile().summary !== 'Profile not available.'}>
                       <div class={`col-span-12 ${Object.keys(countryProfile().stats || {}).length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'} flex gap-6`}>
                          <Show when={countryProfile().thumbnail}>
                             <img src={countryProfile().thumbnail} class="w-32 h-40 object-cover border border-border_main grayscale contrast-125" alt="Country Thumbnail" />
                          </Show>
                          <div class="flex-1">
                             <span class="text-[9px] font-bold text-text_accent uppercase tracking-widest mb-1 block">REGION PROFILE</span>
                             <p class="text-[12px] text-text_secondary leading-relaxed line-clamp-6 opacity-80 italic">
                                {countryProfile().summary}
                             </p>
                          </div>
                       </div>
                    </Show>
                    {/* World Bank Stats */}
                    <Show when={Object.keys(countryProfile().stats || {}).length > 0}>
                       <div class={`col-span-12 ${countryProfile().summary !== 'Profile not available.' ? 'lg:col-span-4 border-l border-border_main pl-8' : 'lg:col-span-12'}`}>
                          <span class="text-[9px] font-bold text-text_accent uppercase tracking-widest mb-4 block">ECONOMIC INDICATORS</span>
                          <div class="grid grid-cols-1 gap-4">
                             <Show when={countryProfile().stats?.gdp}>
                                <div class="flex justify-between items-end border-b border-white/5 pb-2">
                                   <span class="text-[10px] text-text_secondary">Total GDP</span>
                                   <span class="text-sm font-bold text-text_primary">{formatValue(countryProfile().stats?.gdp, 'currency')}</span>
                                </div>
                             </Show>
                             <Show when={countryProfile().stats?.gdp_per_capita}>
                                <div class="flex justify-between items-end border-b border-white/5 pb-2">
                                   <span class="text-[10px] text-text_secondary">GDP Per Capita</span>
                                   <span class="text-sm font-bold text-text_primary">${formatValue(countryProfile().stats?.gdp_per_capita, 'normal')}</span>
                                </div>
                             </Show>
                             <Show when={countryProfile().stats?.inflation}>
                                <div class="flex justify-between items-end border-b border-white/5 pb-2">
                                   <span class="text-[10px] text-text_secondary">Inflation Rate</span>
                                   <span class={`text-sm font-bold ${countryProfile().stats?.inflation > 5 ? 'text-red-500' : 'text-green-500'}`}>{formatValue(countryProfile().stats?.inflation, 'percent')}</span>
                                </div>
                             </Show>
                             <Show when={countryProfile().stats?.population}>
                                <div class="flex justify-between items-end border-b border-white/5 pb-2">
                                   <span class="text-[10px] text-text_secondary">Population</span>
                                   <span class="text-sm font-bold text-text_primary">{formatValue(countryProfile().stats?.population, 'pop')}</span>
                                </div>
                             </Show>
                          </div>
                       </div>
                    </Show>
                 </div>
              </div>
           </Show>
           
           {/* SECTION 1: GLOBAL MACRO MATRIX */}
           <div class="p-6">
              <div class="flex items-center justify-between mb-2">
                 <span class="text-[10px] font-bold text-text_accent uppercase tracking-[0.2em]">01. Global Macro Matrix</span>
              </div>
              <table class="w-full text-left border-collapse bg-bg_header/20">
                 <thead>
                    <tr class="border-b border-border_main bg-bg_header/40 text-text_secondary text-[9px] font-bold uppercase">
                       <th class="p-3">FIXED INCOME & YIELDS</th>
                       <th class="p-3">CENTRAL BANK RATES</th>
                       <th class="p-3">INFLATION PULSE (CPI)</th>
                    </tr>
                 </thead>
                 <tbody>
                    <tr>
                       <td class="p-0 border-r border-border_main vertical-top">
                          <For each={macroData().yields.filter(y => y.value)}>
                             {(y) => (
                                <div class="p-3 border-b border-white/5 flex justify-between items-center group hover:bg-white/5">
                                   <span class="text-[10px] text-text_secondary font-bold">{y.label}</span>
                                   <div class="flex items-center gap-3">
                                      <span class="text-xs font-bold text-text_primary">{y.value}</span>
                                      <span class={`text-[8px] font-bold px-1 rounded-sm ${y.change.startsWith('+') ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>{y.change}</span>
                                   </div>
                                </div>
                             )}
                          </For>
                       </td>
                       <td class="p-0 border-r border-border_main vertical-top">
                          <For each={macroData().centralBanks.filter(cb => cb.rate)}>
                             {(cb) => (
                                <div class="p-3 border-b border-white/5 flex justify-between items-center group hover:bg-white/5">
                                   <div class="flex flex-col">
                                      <span class="text-[10px] text-text_primary font-bold">{cb.name}</span>
                                      <span class="text-[7px] text-text_secondary italic opacity-60">{cb.bias}</span>
                                   </div>
                                   <span class="text-sm font-bold text-text_accent">{cb.rate}</span>
                                </div>
                             )}
                          </For>
                       </td>
                       <td class="p-0 vertical-top">
                          <For each={macroData().cpi.filter(c => c.value)}>
                             {(c) => (
                                <div class="p-3 border-b border-white/5 flex justify-between items-center group hover:bg-white/5">
                                   <span class="text-[10px] text-text_primary font-bold">{c.country}</span>
                                   <div class="flex items-center gap-2">
                                      <div class="w-16 h-1 bg-border_main overflow-hidden">
                                         <div class={`h-full ${c.status === 'High' ? 'bg-red-500' : 'bg-green-500'}`} style={`width: ${parseFloat(c.value) * 10}%`}></div>
                                      </div>
                                      <span class={`text-[10px] font-bold ${c.status === 'High' ? 'text-red-500' : 'text-green-500'}`}>{c.value}</span>
                                   </div>
                                </div>
                             )}
                          </For>
                       </td>
                    </tr>
                 </tbody>
              </table>
           </div>

           {/* SECTION 2: LIVE MARKET SURVEILLANCE & SECTORS */}
           <div class="px-6 grid grid-cols-2 gap-8">
              {/* TABLE: TERRITORY LIVE ASSETS */}
              <Show when={countryProxies().length > 0}>
                 <div>
                    <div class="flex items-center justify-between mb-2">
                       <span class="text-[10px] font-bold text-text_accent uppercase tracking-[0.2em]">02. Market Indicators // {selectedCountry()}</span>
                       <Show when={loadingProxies()}><span class="text-[8px] animate-pulse">POLLING...</span></Show>
                    </div>
                    <table class="w-full border-collapse">
                       <thead>
                          <tr class="bg-bg_header/40 text-[9px] text-text_secondary uppercase font-bold border-b border-border_main">
                             <th class="p-3 text-left">ASSET CLASS</th>
                             <th class="p-3 text-right">SYMBOL</th>
                             <th class="p-3 text-right">PRICE</th>
                             <th class="p-3 text-right">CHANGE</th>
                          </tr>
                       </thead>
                       <tbody class="bg-bg_header/10">
                          <For each={countryProxies()}>
                             {(p) => (
                                <tr class="border-b border-white/5 hover:bg-text_accent/5 transition-all">
                                   <td class="p-3 text-[10px] font-bold text-text_primary">{p.readableName}</td>
                                   <td class="p-3 text-[8px] text-right text-text_secondary opacity-40 font-mono italic">{p.symbol}</td>
                                   <td class="p-3 text-[11px] text-right font-bold text-text_primary">{p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                   <td class={`p-3 text-[10px] text-right font-bold ${p.change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                      {p.change_pct >= 0 ? '▲' : '▼'}{Math.abs(p.change_pct).toFixed(2)}%
                                   </td>
                                </tr>
                             )}
                          </For>
                       </tbody>
                    </table>
                 </div>
              </Show>

              {/* TABLE: GLOBAL SECTOR CAPITAL FLOWS */}
              <Show when={sectors().length > 0}>
                 <div class={countryProxies().length === 0 ? 'col-span-2' : ''}>
                    <div class="flex items-center justify-between mb-2">
                       <span class="text-[10px] font-bold text-text_accent uppercase tracking-[0.2em]">03. Sector Performance</span>
                       <button onClick={fetchSectors} class="text-[8px] text-text_accent hover:underline uppercase font-bold">SYNC</button>
                    </div>
                    <table class="w-full border-collapse">
                       <thead>
                          <tr class="bg-bg_header/40 text-[9px] text-text_secondary uppercase font-bold border-b border-border_main">
                             <th class="p-3 text-left">SECTOR</th>
                             <th class="p-3 text-right">VALUE</th>
                             <th class="p-3 text-right">HEATMAP</th>
                          </tr>
                       </thead>
                       <tbody class="bg-bg_header/10">
                          <For each={sectors()}>
                             {(s) => (
                                <tr class="border-b border-white/5 hover:bg-white/5">
                                   <td class="p-3 text-[10px] font-bold text-text_primary">{s.name.replace('_', ' ')}</td>
                                   <td class="p-3 text-right text-[10px] font-bold text-text_secondary">${s.price.toFixed(2)}</td>
                                   <td class="p-3 text-right">
                                      <div class="flex items-center justify-end gap-3">
                                         <span class={`text-[9px] font-bold ${s.change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%</span>
                                         <div class="w-12 h-1.5 bg-border_main rounded-full overflow-hidden">
                                            <div class={`h-full ${s.change_pct >= 0 ? 'bg-green-500' : 'bg-red-500'}`} style={`width: ${Math.min(Math.abs(s.change_pct) * 15, 100)}%`}></div>
                                         </div>
                                      </div>
                                   </td>
                                </tr>
                             )}
                          </For>
                       </tbody>
                    </table>
                 </div>
              </Show>
           </div>

           {/* SECTION 3: INTEL WIRE */}
           <Show when={countryNews().length > 0}>
              <div class="p-6 mt-4">
                 <div class="w-full">
                    <div class="flex items-center justify-between mb-2">
                       <span class="text-[10px] font-bold text-text_accent uppercase tracking-[0.2em]">04. ECONOMIC & POLITICAL NEWS</span>
                       <Show when={loadingNews()}><span class="text-[8px] animate-pulse uppercase">STREAMING...</span></Show>
                    </div>
                    <div class="border border-border_main bg-bg_header/10 max-h-[600px] overflow-y-auto win-scroll">
                       <For each={countryNews()}>
                          {(news) => (
                             <div class="p-4 border-b border-white/5 hover:bg-white/5 transition-all group flex items-start gap-4">
                                <div class="w-16 shrink-0 text-[8px] font-bold text-text_secondary opacity-40 uppercase pt-1">
                                   {new Date(news.timestamp * 1000).toLocaleDateString()}
                                </div>
                                <div class="flex-1 flex flex-col gap-1">
                                   <a href={news.url} target="_blank" class="text-[11px] font-bold text-text_primary group-hover:text-text_accent leading-snug">
                                      {news.title}
                                   </a>
                                   <div class="flex items-center gap-4 mt-1">
                                      <span class="text-[8px] font-bold text-text_accent/60 uppercase">{news.source}</span>
                                      <div class="w-1 h-1 rounded-full bg-white/10"></div>
                                      <span class="text-[8px] text-text_secondary lowercase italic opacity-30">{news.description?.slice(0, 150)}...</span>
                                   </div>
                                </div>
                             </div>
                          )}
                       </For>
                    </div>
                 </div>
              </div>
           </Show>

        </div>
      </div>
    </div>
  );
}
