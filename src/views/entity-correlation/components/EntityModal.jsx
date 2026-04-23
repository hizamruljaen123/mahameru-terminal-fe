import { Show, For, createSignal } from 'solid-js';

const EntityModal = (props) => {
  const [tab, setTab] = createSignal('search'); // 'search' or 'manual'
  const [manualType, setManualType] = createSignal('USER'); // 'USER', 'COMPANY', 'LOCATION', 'AIRPORT'
  
  // Manual States
  const [userData, setUserData] = createSignal({ name: '', job: '', description: '' });
  const [companyData, setCompanyData] = createSignal({ name: '' });
  const [locationData, setLocationData] = createSignal({ name: '', address: '', lat: '', lon: '', showMap: false });
  const [airportQuery, setAirportQuery] = createSignal("");
  const [airportResults, setAirportResults] = createSignal([]);
  const [loadingAirports, setLoadingAirports] = createSignal(false);
  const [portQuery, setPortQuery] = createSignal("");
  const [portResults, setPortResults] = createSignal([]);
  const [loadingPorts, setLoadingPorts] = createSignal(false);
  const [linkData, setLinkData] = createSignal({ name: '', url: '' });
  const [powerQuery, setPowerQuery] = createSignal("");
  const [powerResults, setPowerResults] = createSignal([]);
  const [loadingPower, setLoadingPower] = createSignal(false);
  const [industryQuery, setIndustryQuery] = createSignal("");
  const [industryResults, setIndustryResults] = createSignal([]);
  const [loadingIndustry, setLoadingIndustry] = createSignal(false);
  const [timezoneQuery, setTimezoneQuery] = createSignal("");
  const [timezoneResults, setTimezoneResults] = createSignal([]);
  const [loadingTimezone, setLoadingTimezone] = createSignal(false);
  const [refineryQuery, setRefineryQuery] = createSignal("");
  const [refineryResults, setRefineryResults] = createSignal([]);
  const [loadingRefineries, setLoadingRefineries] = createSignal(false);

  const handleSearchAirports = async () => {
    if (!airportQuery()) return;
    setLoadingAirports(true);
    const results = await props.searchAirports(airportQuery());
    setAirportResults(results || []);
    setLoadingAirports(false);
  };

  const handleSearchPorts = async () => {
    if (!portQuery()) return;
    setLoadingPorts(true);
    const results = await props.searchPorts(portQuery());
    setPortResults(results || []);
    setLoadingPorts(false);
  };

  const handleSearchPower = async () => {
    if (!powerQuery()) return;
    setLoadingPower(true);
    const results = await props.searchPowerPlants(powerQuery());
    setPowerResults(results || []);
    setLoadingPower(false);
  };

  const handleSearchIndustry = async () => {
    if (!industryQuery()) return;
    setLoadingIndustry(true);
    const results = await props.searchIndustrialZones(industryQuery());
    setIndustryResults(results || []);
    setLoadingIndustry(false);
  };

  const handleSearchTimezone = async () => {
    if (!timezoneQuery()) return;
    setLoadingTimezone(true);
    const results = await props.searchTimezones(timezoneQuery());
    setTimezoneResults(results || []);
    setLoadingTimezone(false);
  };

  const handleSearchRefineries = async () => {
    if (!refineryQuery()) return;
    setLoadingRefineries(true);
    const res = await props.searchRefineries(refineryQuery());
    setRefineryResults(res);
    setLoadingRefineries(false);
  };

  const handleAddManual = (item = null, type = null) => {
    let data = {};
    let typeToDeploy = type || manualType();

    if (type === 'AIRPORT' && item) {
      data = { 
        name: item.name, 
        ident: item.ident, 
        iata: item.iata, 
        type_airport: item.type, 
        region: item.region, 
        country_name: item.country_name,
        address: item.municipality,
        lat: item.latitude,
        lon: item.longitude
      };
    } else if (type === 'PORT' && item) {
      data = {
        name: item.name,
        country_code: item.country_code,
        country_name: item.country_name,
        area_name: item.area_name,
        lat: item.latitude,
        lon: item.longitude,
        harbor_size: item.harbor_size,
        harbor_type: item.harbor_type,
        publication: item.publication,
        chart: item.chart
      };
    } else if (type === 'POWER_PLANT' && item) {
      data = {
        name: item.name,
        country_name: item.country_long,
        primary_fuel: item.primary_fuel,
        capacity_mw: item.capacity_mw,
        owner: item.owner,
        lat: item.latitude,
        lon: item.longitude,
        commissioning_year: item.commissioning_year,
        source: item.source
      };
    } else if (type === 'INDUSTRIAL_ZONE' && item) {
      data = {
        name: item.name,
        country_name: item.country,
        sector: item.sector,
        lat: item.latitude,
        lon: item.longitude,
        website: item.website,
        id: item.id
      };
    } else if (type === 'TIMEZONE' && item) {
      data = {
        name: item.name,
        code: item.code,
        lat: item.lat,
        lon: item.lon,
        timezones: item.timezones
      };
    } else if (type === 'OIL_REFINERY' && item) {
      data = {
        name: item.nama_kilang,
        negara: item.negara,
        kapasitas: item.kapasitas,
        lat: item.latitude,
        lon: item.longitude,
        id: item.id
      };
    } else if (manualType() === 'USER') {
      data = { name: userData().name, title: userData().job, description: userData().description };
    } else if (manualType() === 'COMPANY') {
      data = { name: companyData().name, symbol: 'CORP' };
    } else if (manualType() === 'LOCATION') {
      data = { name: locationData().name, address: locationData().address, lat: locationData().lat, lon: locationData().lon, showMap: locationData().showMap };
    } else if (manualType() === 'HYPERLINK') {
      data = { name: linkData().name, url: linkData().url };
    }
    
    props.onAddManual(typeToDeploy, data);
    props.onClose();
    // Reset
    setUserData({ name: '', job: '', description: '' });
    setCompanyData({ name: '' });
    setLocationData({ name: '', address: '', lat: '', lon: '', showMap: false });
    setLinkData({ name: '', url: '' });
    setAirportQuery("");
    setAirportResults([]);
    setPortQuery("");
    setPortResults([]);
    setPowerQuery("");
    setPowerResults([]);
    setIndustryQuery("");
    setIndustryResults([]);
    setTimezoneQuery("");
    setTimezoneResults([]);
    setRefineryQuery("");
    setRefineryResults([]);
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
        <div class="bg-[#0b0e14] border border-white/10 w-full max-w-xl p-8 shadow-2xl animate-in zoom-in-95 duration-300 rounded-xl flex flex-col max-h-[90vh]">
          <div class="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
            <div>
              <div class="text-[10px] font-black text-blue-400 mb-1 tracking-[0.3em] uppercase">Security Clearance</div>
              <h2 class="text-xl font-black text-white uppercase tracking-tighter">NEW ENTITY RECONNAISSANCE</h2>
            </div>
            <button onClick={props.onClose} class="text-white/20 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          {/* Tabs */}
          <div class="flex gap-2 mb-6 p-1 bg-black/40 rounded-lg border border-white/5">
            <button 
              onClick={() => setTab('search')}
              class={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${tab() === 'search' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-white/30 hover:bg-white/5'}`}
            >
              Market Search
            </button>
            <button 
              onClick={() => setTab('manual')}
              class={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${tab() === 'manual' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-white/30 hover:bg-white/5'}`}
            >
              Manual Registry
            </button>
          </div>

          <div class="flex-1 overflow-y-auto custom-scrollbar-dark pr-2">
            <Show when={tab() === 'search'}>
              <div class="space-y-6">
                <div class="relative">
                  <input 
                    type="text" 
                    placeholder="ENTER ENTITY SYMBOL (E.G. BBCA.JK, AAPL)..."
                    class="w-full bg-black/60 border border-white/10 p-5 rounded-lg text-white font-black uppercase text-sm outline-none focus:border-blue-500/50 transition-all tracking-[0.1em]"
                    value={props.query}
                    onInput={(e) => props.setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && props.onSearch()}
                    autofocus
                  />
                  <button 
                    onClick={props.onSearch}
                    class="absolute right-3 top-1/2 -translate-y-1/2 p-3 text-blue-500 hover:text-blue-400 transition-colors"
                    disabled={props.loading}
                  >
                    <Show when={!props.loading} fallback={
                      <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    }>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </Show>
                  </button>
                </div>

                <div class="max-h-[300px] overflow-y-auto">
                  <Show when={props.results.length > 0} fallback={
                    <Show when={!props.loading && props.query.length > 0}>
                      <div class="py-12 border-2 border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center opacity-30">
                        <p class="text-[10px] font-black uppercase tracking-widest">No matching assets found in local registry</p>
                      </div>
                    </Show>
                  }>
                    <div class="grid grid-cols-1 gap-2">
                      <For each={props.results}>
                        {(item) => (
                          <button 
                            onClick={() => props.onAdd(item)}
                            class="p-4 bg-white/[0.03] border border-white/5 rounded-lg flex items-center justify-between group hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left"
                          >
                            <div>
                              <div class="text-[12px] font-black text-white uppercase group-hover:text-blue-400 transition-colors">{item.symbol}</div>
                              <div class="text-[9px] font-bold text-white/30 uppercase mt-1 truncate max-w-[200px]">{item.shortname || item.longname}</div>
                              <div class="text-[7px] text-white/20 font-black uppercase tracking-tighter mt-0.5">{item.exchDisp}</div>
                            </div>
                            <div class="p-2 border border-blue-500/0 text-blue-500 opacity-0 group-hover:opacity-100 transition-all">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </div>
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            <Show when={tab() === 'manual'}>
              <div class="flex flex-col gap-6">
                <div class="flex gap-2 bg-black/20 p-1 rounded-md border border-white/5">
                  <button onClick={() => setManualType('USER')} class={`flex-1 py-1.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${manualType() === 'USER' ? 'bg-blue-600/20 border border-blue-500 text-blue-400' : 'text-white/10'}`}>User</button>
                  <button onClick={() => setManualType('COMPANY')} class={`flex-1 py-1.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${manualType() === 'COMPANY' ? 'bg-emerald-600/20 border border-emerald-500 text-emerald-400' : 'text-white/10'}`}>Corp</button>
                  <button onClick={() => setManualType('LOCATION')} class={`flex-1 py-1.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${manualType() === 'LOCATION' ? 'bg-orange-600/20 border border-orange-500 text-orange-400' : 'text-white/10'}`}>Loc</button>
                  <button onClick={() => setManualType('AIRPORT')} class={`flex-1 py-1.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${manualType() === 'AIRPORT' ? 'bg-red-600/20 border border-red-500 text-red-400' : 'text-white/10'}`}>Airport</button>
                  <button onClick={() => setManualType('PORT')} class={`flex-1 py-1.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${manualType() === 'PORT' ? 'bg-blue-600/20 border border-blue-500 text-blue-400' : 'text-white/10'}`}>Port</button>
                  <button onClick={() => setManualType('POWER_PLANT')} class={`flex-1 py-1.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${manualType() === 'POWER_PLANT' ? 'bg-yellow-600/20 border border-yellow-500 text-yellow-500' : 'text-white/10'}`}>Power</button>
                  <button onClick={() => setManualType('INDUSTRIAL_ZONE')} class={`flex-1 py-1.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${manualType() === 'INDUSTRIAL_ZONE' ? 'bg-emerald-600/20 border border-emerald-500 text-emerald-500' : 'text-white/10'}`}>Indus</button>
                  <button onClick={() => setManualType('TIMEZONE')} class={`flex-1 py-1.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${manualType() === 'TIMEZONE' ? 'bg-indigo-600/20 border border-indigo-500 text-indigo-500' : 'text-white/10'}`}>Time</button>
                  <button onClick={() => setManualType('OIL_REFINERY')} class={`flex-1 py-1.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${manualType() === 'OIL_REFINERY' ? 'bg-yellow-600/20 border border-yellow-500 text-yellow-500' : 'text-white/10'}`}>Oil</button>
                  <button onClick={() => setManualType('HYPERLINK')} class={`flex-1 py-1.5 text-[7px] font-black uppercase tracking-tighter rounded transition-all ${manualType() === 'HYPERLINK' ? 'bg-purple-600/20 border border-purple-500 text-purple-400' : 'text-white/10'}`}>Link</button>
                </div>

                <div class="space-y-4">
                  <Show when={manualType() === 'HYPERLINK'}>
                    <div class="space-y-3">
                      <input 
                        type="text" placeholder="LINK NAME" 
                        class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-purple-500 transition-all"
                        value={linkData().name} onInput={(e) => setLinkData({...linkData(), name: e.target.value})}
                      />
                      <input 
                        type="text" placeholder="URL (HTTPS://...)" 
                        class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-purple-500 transition-all"
                        value={linkData().url} onInput={(e) => setLinkData({...linkData(), url: e.target.value})}
                      />
                    </div>
                  </Show>

                  <Show when={manualType() === 'TIMEZONE'}>
                    <div class="space-y-4">
                      <div class="relative">
                        <input 
                          type="text" placeholder="SEARCH COUNTRY / CODE (E.G. INDONESIA, ID)..." 
                          class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-indigo-500 transition-all pr-12"
                          value={timezoneQuery()} onInput={(e) => setTimezoneQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchTimezone()}
                        />
                        <button onClick={handleSearchTimezone} class="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-400">
                          <Show when={!loadingTimezone()} fallback={<div class="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                          </Show>
                        </button>
                      </div>

                      <div class="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar-dark">
                        <For each={timezoneResults()}>
                          {(country) => (
                            <button 
                              onClick={() => handleAddManual(country, 'TIMEZONE')}
                              class="w-full p-3 bg-white/[0.02] border border-white/5 rounded hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-left flex justify-between items-center group"
                            >
                              <div class="flex items-center gap-3 min-w-0">
                                <img src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} class="w-6 h-4 object-cover border border-white/10 shrink-0" />
                                <div class="min-w-0">
                                  <div class="text-[10px] font-black text-white uppercase truncate group-hover:text-indigo-400">{country.name}</div>
                                  <div class="text-[7px] text-white/30 font-bold uppercase mt-1">
                                    GMT: {country.timezones[0]?.offset} • LAT: {country.lat.toFixed(2)} LON: {country.lon.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              <div class="text-[8px] font-black text-indigo-500 opacity-0 group-hover:opacity-100 uppercase">Select</div>
                            </button>
                          )}
                        </For>
                        <Show when={timezoneQuery() && timezoneResults().length === 0 && !loadingTimezone()}>
                          <div class="py-10 text-center text-[8px] font-black text-white/10 uppercase tracking-widest border border-dashed border-white/5 rounded">
                            No Country/Timezone Match Found
                          </div>
                        </Show>
                      </div>
                    </div>
                  </Show>
                  <Show when={manualType() === 'USER'}>
                    <div class="space-y-3">
                      <input 
                        type="text" placeholder="FULL NAME" 
                        class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-blue-500 transition-all"
                        value={userData().name} onInput={(e) => setUserData({...userData(), name: e.target.value})}
                      />
                      <input 
                        type="text" placeholder="JOB TITLE / ROLE" 
                        class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-blue-500 transition-all"
                        value={userData().job} onInput={(e) => setUserData({...userData(), job: e.target.value})}
                      />
                      <textarea 
                        placeholder="DESCRIPTION / CLEARANCE NOTES" 
                        class="w-full h-24 bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-bold uppercase outline-none focus:border-blue-500 transition-all resize-none"
                        value={userData().description} onInput={(e) => setUserData({...userData(), description: e.target.value})}
                      ></textarea>
                    </div>
                  </Show>

                  <Show when={manualType() === 'COMPANY'}>
                    <div class="space-y-3">
                      <input 
                        type="text" placeholder="COMPANY NAME" 
                        class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-emerald-500 transition-all"
                        value={companyData().name} onInput={(e) => setCompanyData({...companyData(), name: e.target.value})}
                      />
                    </div>
                  </Show>

                  <Show when={manualType() === 'LOCATION'}>
                    <div class="space-y-3">
                      <input 
                        type="text" placeholder="PLACE NAME" 
                        class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-orange-500 transition-all"
                        value={locationData().name} onInput={(e) => setLocationData({...locationData(), name: e.target.value})}
                      />
                      <input 
                        type="text" placeholder="FULL ADDRESS" 
                        class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-orange-500 transition-all"
                        value={locationData().address} onInput={(e) => setLocationData({...locationData(), address: e.target.value})}
                      />
                      <div class="grid grid-cols-2 gap-3">
                        <input 
                          type="number" step="any" placeholder="LATITUDE (OPTIONAL)" 
                          class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-orange-500 transition-all"
                          value={locationData().lat} onInput={(e) => setLocationData({...locationData(), lat: parseFloat(e.target.value)})}
                        />
                        <input 
                          type="number" step="any" placeholder="LONGITUDE (OPTIONAL)" 
                          class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-orange-500 transition-all"
                          value={locationData().lon} onInput={(e) => setLocationData({...locationData(), lon: parseFloat(e.target.value)})}
                        />
                      </div>
                      
                      <div class="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5">
                        <div class="flex flex-col">
                          <span class="text-[9px] font-black text-white uppercase">Google Maps Embed</span>
                          <span class="text-[7px] text-white/30 font-bold uppercase tracking-tight">Requires Coordinates</span>
                        </div>
                        <button 
                          onClick={() => setLocationData({...locationData(), showMap: !locationData().showMap})}
                          class={`w-10 h-5 rounded-full relative transition-all duration-300 ${locationData().showMap ? 'bg-orange-500' : 'bg-white/10'}`}
                        >
                          <div class={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${locationData().showMap ? 'left-6' : 'left-1'}`}></div>
                        </button>
                      </div>
                    </div>
                  </Show>

                  <Show when={manualType() === 'OIL_REFINERY'}>
                    <div class="space-y-4">
                      <div class="relative">
                        <input 
                          type="text" placeholder="SEARCH REFINERIES..." 
                          class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-yellow-500 transition-all"
                          value={refineryQuery()} onInput={(e) => setRefineryQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchRefineries()}
                        />
                        <Show when={loadingRefineries()}>
                          <div class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                        </Show>
                      </div>

                      <div class="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto custom-scrollbar-dark pr-1 text-left">
                        <For each={refineryResults()}>
                          {(item) => (
                            <button 
                              onClick={() => handleAddManual(item, 'OIL_REFINERY')}
                              class="w-full p-4 bg-white/5 border border-white/5 rounded text-left hover:bg-yellow-500/20 transition-all group"
                            >
                              <div class="text-[10px] font-black text-white group-hover:text-yellow-400 uppercase tracking-wider">{item.nama_kilang}</div>
                              <div class="text-[8px] text-white/30 font-bold mt-1 uppercase italic">{item.negara} • {item.kapasitas} BPSD • {item.operator}</div>
                            </button>
                          )}
                        </For>
                        <Show when={refineryQuery() && refineryResults().length === 0 && !loadingRefineries()}>
                           <div class="py-10 text-center text-[10px] font-black text-white/10 uppercase tracking-[0.2em] border border-dashed border-white/5 rounded">
                              No refinery intelligence found
                           </div>
                        </Show>
                      </div>
                    </div>
                  </Show>

                  <Show when={manualType() === 'AIRPORT'}>
                    <div class="space-y-4">
                      <div class="relative">
                        <input 
                          type="text" placeholder="SEARCH DATABASE (E.G. SOEKARNO)..." 
                          class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-red-500 transition-all pr-12"
                          value={airportQuery()} onInput={(e) => setAirportQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchAirports()}
                        />
                        <button onClick={handleSearchAirports} class="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400">
                          <Show when={!loadingAirports()} fallback={<div class="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                          </Show>
                        </button>
                      </div>

                      <div class="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar-dark">
                        <For each={airportResults()}>
                          {(airport) => (
                            <button 
                              onClick={() => handleAddManual(airport, 'AIRPORT')}
                              class="w-full p-3 bg-white/[0.02] border border-white/5 rounded hover:border-red-500/50 hover:bg-red-500/5 transition-all text-left flex justify-between items-center group"
                            >
                              <div class="min-w-0">
                                <div class="text-[10px] font-black text-white uppercase truncate group-hover:text-red-400">{airport.name}</div>
                                <div class="text-[7px] text-white/30 font-bold uppercase mt-1">ID: {airport.ident} • {airport.municipality}, {airport.country_name}</div>
                              </div>
                              <div class="text-[8px] font-black text-red-500 opacity-0 group-hover:opacity-100 uppercase">Select</div>
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>

                  <Show when={manualType() === 'PORT'}>
                    <div class="space-y-4">
                      <div class="relative">
                        <input 
                          type="text" placeholder="SEARCH DATABASE (E.G. TANJUNG PRIOK)..." 
                          class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-blue-500 transition-all pr-12"
                          value={portQuery()} onInput={(e) => setPortQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchPorts()}
                        />
                        <button onClick={handleSearchPorts} class="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-400">
                          <Show when={!loadingPorts()} fallback={<div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                          </Show>
                        </button>
                      </div>

                      <div class="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar-dark">
                        <For each={portResults()}>
                          {(port) => (
                            <button 
                              onClick={() => handleAddManual(port, 'PORT')}
                              class="w-full p-3 bg-white/[0.02] border border-white/5 rounded hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left flex justify-between items-center group"
                            >
                              <div class="min-w-0">
                                <div class="text-[10px] font-black text-white uppercase truncate group-hover:text-blue-400">{port.name}</div>
                                <div class="text-[7px] text-white/30 font-bold uppercase mt-1">{port.country_name} • SIZE: {port.harbor_size}</div>
                              </div>
                              <div class="text-[8px] font-black text-blue-500 opacity-0 group-hover:opacity-100 uppercase">Select</div>
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>

                  <Show when={manualType() === 'POWER_PLANT'}>
                    <div class="space-y-4">
                      <div class="relative">
                        <input 
                          type="text" placeholder="SEARCH GENERATORS (E.G. CIRATA, PLTA)..." 
                          class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-yellow-500 transition-all pr-12"
                          value={powerQuery()} onInput={(e) => setPowerQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchPower()}
                        />
                        <button onClick={handleSearchPower} class="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-500 hover:text-yellow-400">
                          <Show when={!loadingPower()} fallback={<div class="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                          </Show>
                        </button>
                      </div>

                      <div class="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar-dark">
                        <For each={powerResults()}>
                          {(plant) => (
                            <button 
                              onClick={() => handleAddManual(plant, 'POWER_PLANT')}
                              class="w-full p-3 bg-white/[0.02] border border-white/5 rounded hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all text-left flex justify-between items-center group"
                            >
                              <div class="min-w-0">
                                <div class="text-[10px] font-black text-white uppercase truncate group-hover:text-yellow-400">{plant.name}</div>
                                <div class="text-[7px] text-white/30 font-bold uppercase mt-1">{plant.country_long} • {plant.primary_fuel} • {plant.capacity_mw}MW</div>
                              </div>
                              <div class="text-[8px] font-black text-yellow-500 opacity-0 group-hover:opacity-100 uppercase">Select</div>
                            </button>
                          )}
                        </For>
                        <Show when={powerQuery() && powerResults().length === 0 && !loadingPower()}>
                          <div class="py-10 text-center text-[8px] font-black text-white/10 uppercase tracking-widest border border-dashed border-white/5 rounded">
                            No Generator Match Found
                          </div>
                        </Show>
                      </div>
                    </div>
                  </Show>

                  <Show when={manualType() === 'INDUSTRIAL_ZONE'}>
                    <div class="space-y-4">
                      <div class="relative">
                        <input 
                          type="text" placeholder="SEARCH HUBS (E.G. JABABEKA, KERTI)..." 
                          class="w-full bg-black/40 border border-white/10 p-4 rounded text-xs text-white font-black uppercase outline-none focus:border-emerald-500 transition-all pr-12"
                          value={industryQuery()} onInput={(e) => setIndustryQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchIndustry()}
                        />
                        <button onClick={handleSearchIndustry} class="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-400">
                          <Show when={!loadingIndustry()} fallback={<div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                          </Show>
                        </button>
                      </div>

                      <div class="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar-dark">
                        <For each={industryResults()}>
                          {(zone) => (
                            <button 
                              onClick={() => handleAddManual(zone, 'INDUSTRIAL_ZONE')}
                              class="w-full p-3 bg-white/[0.02] border border-white/5 rounded hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left flex justify-between items-center group"
                            >
                              <div class="min-w-0">
                                <div class="text-[10px] font-black text-white uppercase truncate group-hover:text-emerald-400">{zone.name}</div>
                                <div class="text-[7px] text-white/30 font-bold uppercase mt-1">{zone.country} • {zone.sector}</div>
                              </div>
                              <div class="text-[8px] font-black text-emerald-500 opacity-0 group-hover:opacity-100 uppercase">Select</div>
                            </button>
                          )}
                        </For>
                        <Show when={industryQuery() && industryResults().length === 0 && !loadingIndustry()}>
                          <div class="py-10 text-center text-[8px] font-black text-white/10 uppercase tracking-widest border border-dashed border-white/5 rounded">
                            No Industrial Hub Match Found
                          </div>
                        </Show>
                      </div>
                    </div>
                  </Show>

                  <Show when={manualType() !== 'AIRPORT' && manualType() !== 'PORT' && manualType() !== 'POWER_PLANT' && manualType() !== 'INDUSTRIAL_ZONE'}>
                    <button 
                      onClick={() => handleAddManual()}
                      class="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-[0.3em] rounded-lg shadow-lg shadow-blue-900/20 transition-all mt-4"
                    >
                      Deploy New {manualType()} Node
                    </button>
                  </Show>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default EntityModal;
