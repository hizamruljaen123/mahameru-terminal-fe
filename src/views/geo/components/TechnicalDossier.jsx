import { createSignal, createEffect, For, Show } from 'solid-js';

const countryToCurrency = {
  'Indonesia': 'IDR',
  'Singapore': 'SGD',
  'Malaysia': 'MYR',
  'United Kingdom': 'GBP',
  'Australia': 'AUD',
  'USA': 'USD',
  'China': 'CNY',
  'Japan': 'JPY',
  'South Korea': 'KRW',
  'Vietnam': 'VND',
  'Thailand': 'THB',
  'Philippines': 'PHP',
  'India': 'INR'
};

const COMMODITY_API = import.meta.env.VITE_COMMODITY_API || 'http://2.24.223.76:8087';
const DISASTER_API = import.meta.env.VITE_DISASTER_API || 'http://2.24.223.76:8095';

export default function TechnicalDossier(props) {
  const [marketData, setMarketData] = createSignal(null);
  const [disasterAlerts, setDisasterAlerts] = createSignal([]);
  const [isLoading, setIsLoading] = createSignal(false);

  const getCountry = () => props.selectedRefinery?.negara || props.selectedLng?.country || props.selectedOffshore?.country || props.selectedTerminal?.country || props.selectedVessel?.country || props.selectedVessel?.negara;
  const getCurrency = () => countryToCurrency[getCountry()] || 'USD';

  // 1. Fetch Market Surveillance
  createEffect(async () => {
    const currency = getCurrency();
    const asset = currentAsset();
    if (!asset || props.selectedVessel?.infra_type === 'vessel') {
      setMarketData(null);
      return;
    }
    
    setIsLoading(true);
    try {
      const resp = await fetch(`${COMMODITY_API}/api/commodities/market-summary?currency=${currency}`);
      const json = await resp.json();
      if (json.status === 'success') {
        setMarketData(json.data);
      }
    } catch (e) {
      console.error("Market Data error:", e);
    } finally {
      setIsLoading(false);
    }
  });

  // 2. Fetch Disaster Intelligence
  createEffect(async () => {
    const country = getCountry();
    try {
      const [gdacsRes, usgsRes] = await Promise.all([
        fetch(`${DISASTER_API}/api/disaster/gdacs?limit=5`),
        fetch(`${DISASTER_API}/api/disaster/usgs?limit=5`)
      ]);
      
      const [gdacs, usgs] = await Promise.all([gdacsRes.json(), usgsRes.json()]);
      
      let alerts = [];
      if (gdacs.status === 'success' && gdacs.data.features) {
        alerts = gdacs.data.features.map(f => ({
          type: 'HUMANITARIAN',
          name: f.properties.eventname,
          level: f.properties.alertlevel,
          date: f.properties.fromdate,
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0]
        }));
      }
      
      if (usgs.status === 'success' && usgs.data.features) {
        const quakes = usgs.data.features.map(f => ({
          type: 'SEISMIC',
          name: f.properties.place,
          magnitude: f.properties.mag,
          date: new Date(f.properties.time).toISOString(),
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0]
        }));
        alerts = [...alerts, ...quakes];
      }

      // BMKG if Indonesia
      if (country?.toUpperCase() === 'INDONESIA') {
        const bmkgRes = await fetch(`${DISASTER_API}/api/disaster/bmkg`);
        const bmkg = await bmkgRes.json();
        if (bmkg.status === 'success' && bmkg.data.Infogempa?.gempa) {
          const g = bmkg.data.Infogempa.gempa;
          alerts = [{
            type: 'BMKG_ACTIVE',
            name: `QUAKE: ${g.Wilayah}`,
            magnitude: g.Magnitude,
            depth: g.Kedalaman,
            date: `${g.Tanggal} ${g.Jam}`,
            lat: parseFloat(g.Coordinates.split(',')[0]),
            lon: parseFloat(g.Coordinates.split(',')[1])
          }, ...alerts];
        }
      }
      
      setDisasterAlerts(alerts);
    } catch (e) {
      console.error("Disaster Data error:", e);
    }
  });

  const fmt = (v, curr = 'USD', rate = 1) => {
    const converted = v * rate;
    return new Intl.NumberFormat(curr === 'IDR' ? 'id-ID' : 'en-US', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: curr === 'IDR' ? 0 : 2
    }).format(converted);
  };

  const currentAsset = () => props.selectedRefinery || props.selectedLng || props.selectedOffshore || props.selectedTerminal || props.selectedVessel;

  return (
    <div class="space-y-6">
      {/* MARKET INTELLIGENCE SECTION - Only for Energy Related */}
      <Show when={props.selectedRefinery || props.selectedLng || props.selectedOffshore || props.selectedTerminal}>
        <div>
          <div class="flex items-center gap-2 pb-2 border-b border-white/10 mb-4">
            <span class="w-1 h-3 bg-blue-500"></span>
            <span class="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">MARKET_SURVEILLANCE</span>
          </div>
          
          <Show when={marketData()} fallback={<div class="py-4 text-[9px] font-black text-zinc-600 animate-pulse uppercase tracking-widest">SYNCHRONIZING_MARKET_NODE...</div>}>
             <div class="space-y-4">
               <div class="grid grid-cols-1 gap-3">
                 <For each={Object.values(marketData().benchmarks)}>
                   {(item) => (
                     <div class="bg-white/5 border-l-2 border-blue-500/30 p-2 flex items-center justify-between group hover:bg-white/10 transition-colors">
                        <div class="flex flex-col">
                          <span class="text-[7px] font-black text-zinc-500 uppercase tracking-tighter">{item.name}</span>
                          <div class="flex items-center gap-2">
                             <span class="text-[12px] font-black text-white font-mono">{fmt(item.price)}</span>
                             <span class={`text-[8px] font-black font-mono ${item.change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {item.change_pct >= 0 ? '+' : ''}{item.change_pct.toFixed(2)}%
                             </span>
                          </div>
                        </div>
                        <div class="text-right">
                           <span class="text-[7px] font-black text-blue-400 uppercase tracking-tighter">LOCAL_PRICE ({getCurrency()})</span>
                           <div class="text-[11px] font-black text-white/60 font-mono italic">
                              {fmt(item.price, marketData().currency, marketData().rate)}
                           </div>
                        </div>
                     </div>
                   )}
                 </For>
               </div>
               
               <div class="pt-2 flex items-center justify-between opacity-50">
                  <span class="text-[6px] font-black text-zinc-500 uppercase tracking-widest">LOCAL_FX_RATE: USD{getCurrency()} @ {marketData().rate?.toLocaleString()}</span>
                  <span class="text-[6px] font-black text-zinc-500 uppercase tracking-widest leading-none">SOURCE: YAHOO_FINANCE_V3</span>
               </div>
             </div>
          </Show>
        </div>
      </Show>

      <div>
        <div class="flex items-center gap-2 pb-2 border-b border-white/10 mb-4">
          <span class="w-1 h-3 bg-orange-500"></span>
          <span class="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">{currentAsset()?.infra_type === 'vessel' ? 'NAVAL_DOSSIER' : 'INFRASTRUCTURE_RECON'}</span>
        </div>

        <div class="space-y-3">
          {/* ENERGY: REFINERY */}
          <Show when={props.selectedRefinery}>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">OPERATIONAL_CAPACITY</div>
                <div class="flex items-baseline gap-1.5">
                  <span class="text-[20px] font-black text-green-500 tracking-tighter">{props.selectedRefinery?.capacity.toLocaleString()}</span>
                  <span class="text-[8px] font-black text-zinc-600 uppercase">BPD</span>
                </div>
              </div>
              <div>
                <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">ASSET_SCALE</div>
                <div class="text-[10px] font-black text-white uppercase italic">{props.selectedRefinery.category}</div>
              </div>
            </div>
          </Show>

          {/* ENERGY: LNG */}
          <Show when={props.selectedLng}>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">HUB_TYPE</div>
                <div class="text-[14px] font-black text-cyan-500 uppercase">{props.selectedLng.fac_type}</div>
              </div>
              <div class="col-span-2 pb-2 border-b border-white/5">
                <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">OPERATOR_ID</div>
                <div class="text-[10px] font-black text-white uppercase truncate">{props.selectedLng.operator || 'CONFIDENTIAL'}</div>
              </div>
            </div>
          </Show>

          {/* ENERGY: TERMINAL */}
          <Show when={props.selectedTerminal}>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">TERMINAL_CLASS</div>
                <div class="text-[14px] font-black text-fuchsia-500 uppercase">{props.selectedTerminal.fac_type}</div>
              </div>
              <div class="col-span-2">
                <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">COMMODITY_STREAM</div>
                <div class="text-[10px] font-black text-white uppercase">{props.selectedTerminal.commodity || 'PETROLEUM'}</div>
              </div>
            </div>
          </Show>

          {/* NAVAL: VESSEL */}
          <Show when={props.selectedVessel && props.selectedVessel.infra_type === 'vessel'}>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2 flex items-start justify-between">
                <div class="flex flex-col">
                  <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">NAVAL_UNIT_IDENTIFICATION</div>
                  <div class="text-[14px] font-black text-sky-400 uppercase leading-tight truncate">{props.selectedVessel.name}</div>
                  <div class="flex items-center gap-2 mt-1">
                    <Show when={props.selectedVessel.country_code && props.selectedVessel.country_code !== 'un'}>
                       <img src={`https://flagcdn.com/w20/${props.selectedVessel.country_code.toLowerCase()}.png`} class="w-3 h-2.5 object-cover border border-white/20" alt="" />
                    </Show>
                    <div class="text-[8px] font-mono text-white/40 uppercase">MMSI: {props.selectedVessel.mmsi} | {props.selectedVessel.country_name}</div>
                  </div>
                </div>
                <a href={`https://www.vesselfinder.com/vessels/details/${props.selectedVessel.mmsi}`} target="_blank" class="bg-sky-500/10 border border-sky-500/40 p-1.5 hover:bg-sky-500 transition-all"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg></a>
              </div>
              <div class="col-span-2 grid grid-cols-2 gap-3 py-3 border-y border-white/5 bg-white/[0.02] px-2 mt-2">
                 <div>
                    <div class="text-[6px] text-zinc-500 uppercase font-black mb-0.5">IMO_NUMBER</div>
                    <div class="text-[10px] font-black text-white font-mono">{props.selectedVessel.imo || 'N/A'}</div>
                 </div>
                 <div>
                    <div class="text-[6px] text-zinc-500 uppercase font-black mb-0.5">CALL_SIGN</div>
                    <div class="text-[10px] font-black text-white font-mono">{props.selectedVessel.callsign || 'N/A'}</div>
                 </div>
                 <div>
                    <div class="text-[6px] text-zinc-500 uppercase font-black mb-0.5">MAX_DRAUGHT</div>
                    <div class="text-[10px] font-black text-cyan-400 font-mono">{props.selectedVessel.draught ? `${props.selectedVessel.draught}m` : '0.0m'}</div>
                 </div>
                 <div>
                    <div class="text-[6px] text-zinc-500 uppercase font-black mb-0.5">DIMENSIONS</div>
                    <div class="text-[10px] font-black text-white font-mono">{props.selectedVessel.length || 0}m x {props.selectedVessel.width || 0}m</div>
                 </div>
              </div>
              <div class="col-span-2 space-y-1 py-1 border-b border-white/5">
                <div class="flex items-center justify-between">
                    <span class="text-[8px] text-zinc-600 font-black uppercase">SPEED_SOG</span>
                    <span class="text-[11px] text-green-500 font-black font-mono">{props.selectedVessel.speed?.toFixed(1)} KN</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-[8px] text-zinc-600 font-black uppercase">HEADING_COG</span>
                    <span class="text-[11px] text-blue-400 font-black font-mono">{props.selectedVessel.heading || 0}°</span>
                </div>
              </div>
              <div class="col-span-2 bg-sky-500/10 p-2 border border-sky-500/20">
                <div class="text-[6px] text-sky-400 font-black uppercase tracking-widest mb-1 animate-pulse italic">REALTIME_AIS_FEED</div>
                <div class="text-[9px] font-black text-white uppercase italic">{props.selectedVessel.destination || 'UNKNOWN_DESTINATION'}</div>
              </div>
            </div>
          </Show>

          {/* MARITIME: PORT/HARBOR */}
          <Show when={props.selectedVessel && props.selectedVessel.infra_type === 'port'}>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">HARBOR_SPECIFICATION</div>
                <div class="text-[16px] font-black text-blue-500 uppercase leading-none">{props.selectedVessel.name}</div>
              </div>
              <div class="col-span-2 grid grid-cols-3 gap-2 py-3 border-y border-white/5 bg-white/[0.02] px-2 mt-2">
                 <div>
                    <div class="text-[6px] text-zinc-500 uppercase font-black mb-0.5">CHANNEL_DEPTH</div>
                    <div class="text-[10px] font-black text-white font-mono">{props.selectedVessel.channel_depth || '0.0m'}</div>
                 </div>
                 <div>
                    <div class="text-[6px] text-zinc-500 uppercase font-black mb-0.5">ANCHORAGE</div>
                    <div class="text-[10px] font-black text-white font-mono">{props.selectedVessel.anchorage_depth || '0.0m'}</div>
                 </div>
                 <div>
                    <div class="text-[6px] text-zinc-500 uppercase font-black mb-0.5">OIL_TERMINAL</div>
                    <div class="text-[10px] font-black text-white font-mono">{props.selectedVessel.oil_terminal_depth || '0.0m'}</div>
                 </div>
              </div>
              <div class="col-span-2 space-y-1">
                 <div class="flex items-center justify-between border-b border-white/5 py-1">
                    <span class="text-[7px] text-zinc-600 font-black">HARBOR_TYPE</span>
                    <span class="text-[9px] text-white font-black uppercase">{props.selectedVessel.harbor_type_code || 'COASTAL'}</span>
                 </div>
                 <div class="flex items-center justify-between border-b border-white/5 py-1">
                    <span class="text-[7px] text-zinc-600 font-black">VESSEL_CAPACITY</span>
                    <span class="text-[9px] text-white font-black uppercase">{props.selectedVessel.maxsize_vessel_code || 'MEDIUM'}</span>
                 </div>
                 <div class="flex items-center justify-between py-1">
                    <span class="text-[7px] text-zinc-600 font-black">PILOTAGE_AVAIL</span>
                    <span class="text-[9px] text-green-500 font-black uppercase">{props.selectedVessel.pilotage_available || 'YES'}</span>
                 </div>
              </div>
            </div>
          </Show>

          {/* AVIATION: AIRPORT */}
          <Show when={props.selectedVessel && props.selectedVessel.infra_type === 'airport'}>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">AIRPORT_DESIGNATION</div>
                <div class="text-[16px] font-black text-yellow-500 uppercase leading-none">{props.selectedVessel.name}</div>
              </div>
              <div class="col-span-2 grid grid-cols-2 gap-3 py-3 border-y border-white/5 bg-white/[0.02] px-2 mt-2">
                 <div>
                    <div class="text-[6px] text-zinc-500 uppercase font-black mb-0.5">IATA_CODE</div>
                    <div class="text-[16px] font-black text-white font-mono tracking-tighter">{props.selectedVessel.iata_code || '---'}</div>
                 </div>
                 <div>
                    <div class="text-[6px] text-zinc-500 uppercase font-black mb-0.5">ELEVATION</div>
                    <div class="text-[16px] font-black text-white font-mono tracking-tighter">{props.selectedVessel.elevation_ft || 0}<small class="text-[8px] ml-0.5 text-zinc-500">FT</small></div>
                 </div>
              </div>
              <div class="col-span-2 flex flex-col gap-1">
                 <div class="text-[7px] text-zinc-500 font-black uppercase">MUNICIPALITY_ID</div>
                 <div class="text-[10px] font-black text-white uppercase italic">{props.selectedVessel.municipality || 'UNKNOWN'}</div>
              </div>
              <div class="col-span-2 flex items-center justify-between border-t border-white/5 pt-2">
                 <div class="text-[7px] text-zinc-500 font-black uppercase tracking-widest">SCHEDULED_SERVICE:</div>
                 <div class={`text-[9px] font-black ${props.selectedVessel.scheduled_service === 'yes' ? 'text-green-500' : 'text-zinc-500'}`}>{props.selectedVessel.scheduled_service?.toUpperCase() || 'NO'}</div>
              </div>
            </div>
          </Show>

          {/* INDUSTRIAL: ZONE */}
          <Show when={props.selectedVessel && props.selectedVessel.infra_type === 'industrial'}>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">INDUSTRIAL_COMPLEX</div>
                <div class="text-[16px] font-black text-emerald-500 uppercase leading-none">{props.selectedVessel.name}</div>
              </div>
              <div class="col-span-2 bg-black/20 p-3 border border-white/5 mt-2">
                 <div class="text-[6px] text-zinc-500 uppercase font-black mb-2 tracking-widest">OPERATIONAL_SECTORS</div>
                 <div class="flex flex-wrap gap-1">
                    <For each={(props.selectedVessel.sector || 'General Industrial').split(',')}>
                       {(sec) => <span class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[8px] font-black px-1.5 py-0.5 uppercase tracking-tighter">{sec.trim()}</span>}
                    </For>
                 </div>
              </div>
              <div class="col-span-2">
                 <div class="text-[7px] text-zinc-500 font-black uppercase mb-1">OWNERSHIP_STRUCTURE</div>
                 <div class="text-[10px] font-black text-white uppercase italic">{props.selectedVessel.ownership || 'CONFIDENTIAL_PRIVATE'}</div>
              </div>
            </div>
          </Show>

          {/* MILITARY: FACILITY */}
          <Show when={props.selectedVessel && props.selectedVessel.infra_type === 'military'}>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <div class="text-[7px] text-rose-500/60 uppercase font-black mb-1 tracking-widest">RESTRICTED_NAVAL_ASSET</div>
                <div class="text-[18px] font-black text-rose-500 uppercase leading-none">{props.selectedVessel.name}</div>
              </div>
              <div class="col-span-2 py-3 border-y border-rose-500/20 bg-rose-500/5 px-2 mt-2">
                 <div class="text-[8px] font-black text-white uppercase tracking-tighter">SURVEILLANCE_CLASSIFICATION: <span class="text-rose-500">LEVEL_04</span></div>
              </div>
              <div class="col-span-2 flex flex-col gap-1">
                 <div class="text-[7px] text-zinc-500 font-black uppercase">JURISDICTIONAL_OVERWATCH</div>
                 <div class="text-[11px] font-black text-white uppercase italic">{props.selectedVessel.country || props.selectedVessel.negara}</div>
              </div>
            </div>
          </Show>

          {/* POLICE: FACILITY */}
          <Show when={props.selectedVessel && props.selectedVessel.infra_type === 'police'}>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <div class="text-[7px] text-sky-500/60 uppercase font-black mb-1 tracking-widest">MUNICIPAL_QUARTERS</div>
                <div class="text-[18px] font-black text-sky-500 uppercase leading-none">{props.selectedVessel.name}</div>
              </div>
              <div class="col-span-2 py-3 border-y border-sky-500/20 bg-sky-500/5 px-2 mt-2">
                 <div class="text-[8px] font-black text-white uppercase tracking-tighter">HQ_IDENTIFIER: <span class="text-sky-400">{props.selectedVessel.hq_name || 'CENTRAL'}</span></div>
              </div>
              <div class="col-span-2 flex flex-col gap-1">
                 <div class="text-[7px] text-zinc-500 font-black uppercase">PUBLIC_ACCESS_NODE</div>
                 <div class="text-[11px] font-black text-white uppercase italic truncate">{props.selectedVessel.address || 'REDACTED'}</div>
              </div>
            </div>
          </Show>

          <Show when={props.selectedOffshore}>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">PLATFORM_TYPE</div>
                <div class="text-[14px] font-black text-rose-500 uppercase">{props.selectedOffshore.fac_type}</div>
              </div>
              <div>
                <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">DEPLOYMENT</div>
                <div class="text-[10px] font-black text-white uppercase">{props.selectedOffshore.install_date || 'N/A'}</div>
              </div>
            </div>
          </Show>

          {/* NEARBY PETROLEUM INFRASTRUCTURE (5KM RADIUS) */}
          <div class="pt-4 mt-2 border-t border-white/10">
             <div class="flex items-center justify-between mb-3">
                <div class="text-[8px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
                   <span class="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></span>
                   PROXIMITY_PETROLEUM_INDEX (5KM)
                </div>
                <span class="text-[6px] text-zinc-500 font-mono">SCAN_RADIUS: 5.0KM</span>
             </div>
             
             <div class="space-y-1.5">
                <For each={(props.nearbyFacilities || []).filter(f => ['refinery', 'lng', 'terminal', 'offshore'].includes(f.infra_type) && f.distance <= 5 && f.name !== (props.selectedRefinery?.nama_kilang || props.selectedLng?.fac_name || props.selectedOffshore?.fac_name || props.selectedTerminal?.fac_name || props.selectedVessel?.name))}>
                   {(facility) => (
                      <div class="bg-white/5 border border-white/5 p-2 flex items-center justify-between group hover:border-orange-500/30 transition-all">
                         <div class="flex flex-col">
                            <span class="text-[9px] font-black text-white uppercase truncate max-w-[180px]">{facility.name}</span>
                            <span class="text-[6px] font-black text-orange-500/60 uppercase">{facility.infra_type}</span>
                         </div>
                         <div class="text-right">
                            <div class="text-[10px] font-mono font-black text-white/80">{facility.distance.toFixed(2)}<small class="text-[6px] ml-0.5 opacity-50">KM</small></div>
                            <div class="text-[5px] text-zinc-600 font-black uppercase tracking-tighter">RADIAL_OFF_CENTER</div>
                         </div>
                      </div>
                   )}
                   <Show when={(props.nearbyFacilities || []).filter(f => ['refinery', 'lng', 'terminal', 'offshore'].includes(f.infra_type) && f.distance <= 5 && f.name !== (props.selectedRefinery?.nama_kilang || props.selectedLng?.fac_name || props.selectedOffshore?.fac_name || props.selectedTerminal?.fac_name || props.selectedVessel?.name)).length === 0}>
                      <div class="py-3 px-2 border border-dashed border-white/5 flex items-center justify-center">
                         <span class="text-[7px] font-black text-zinc-600 uppercase tracking-widest">NO_CRITICAL_PETROLEUM_PROXIMITY</span>
                      </div>
                   </Show>
                </For>
             </div>
          </div>

          {/* LIVE DISASTER WATCH SYSTEM */}
          <div class="pt-4 mt-2 border-t border-white/10">
             <div class="flex items-center justify-between mb-3">
                <div class="text-[8px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                   <div class="relative">
                      <span class="w-1.5 h-1.5 bg-rose-500 rounded-full block animate-ping"></span>
                      <span class="absolute top-0 left-0 w-1.5 h-1.5 bg-rose-500 rounded-full block border border-white/50"></span>
                   </div>
                   DISASTER_WATCH_SYSTEM (LIVE)
                </div>
                <span class="text-[6px] text-zinc-500 font-mono">CHANNELS: GDACS, USGS, BMKG</span>
             </div>

             <div class="space-y-1.5">
                <For each={disasterAlerts()}>
                   {(alert) => (
                      <div class="bg-rose-500/5 border-l-2 border-rose-600 p-2 group hover:bg-rose-500/10 transition-all flex flex-col gap-1">
                         <div class="flex items-center justify-between">
                            <span class="text-[6px] font-black py-0.5 px-1 bg-rose-600 text-white uppercase rounded-sm">{alert.type}</span>
                            <span class="text-[6px] font-mono text-zinc-400">{new Date(alert.date).toLocaleString()}</span>
                         </div>
                         <div class="text-[10px] font-black text-white uppercase leading-tight">{alert.name}</div>
                         <div class="flex items-center gap-3 mt-1">
                            <Show when={alert.magnitude}>
                               <div class="flex flex-col">
                                  <span class="text-[5px] text-zinc-500 font-bold uppercase">MAGNITUDE</span>
                                  <span class="text-[9px] font-black text-rose-400">{alert.magnitude} <small class="text-[6px]">Mw</small></span>
                               </div>
                            </Show>
                            <Show when={alert.level}>
                               <div class="flex flex-col">
                                  <span class="text-[5px] text-zinc-500 font-bold uppercase">ALERT_LEVEL</span>
                                  <span class={alert.level === 'Red' ? 'text-[9px] font-black text-rose-500 uppercase' : 'text-[9px] font-black text-orange-400 uppercase'}>{alert.level}</span>
                               </div>
                            </Show>
                             <div class="flex flex-col">
                                <span class="text-[5px] text-zinc-500 font-bold uppercase">COORDINATES</span>
                                <span class="text-[7px] font-mono font-bold text-zinc-300">{alert.lat.toFixed(4)}, {alert.lon.toFixed(4)}</span>
                             </div>
                         </div>
                      </div>
                   )}
                </For>
                <Show when={disasterAlerts().length === 0}>
                   <div class="py-4 border border-dashed border-white/5 flex items-center justify-center">
                      <span class="text-[7px] font-black text-zinc-600 uppercase tracking-widest">NO_THREAT_DETECTION_ACTIVE</span>
                   </div>
                </Show>
             </div>
          </div>

          <div class="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div>
              <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">JURISDICTION</div>
              <div class="text-[11px] font-black text-white uppercase italic">{getCountry() || currentAsset()?.country || currentAsset()?.negara || 'GLOBAL'}</div>
            </div>
            <div>
              <div class="text-[7px] text-zinc-500 uppercase font-black mb-1">DATA_STATUS</div>
              <div class="text-[10px] font-black text-green-500 uppercase flex items-center gap-1.5">
                <span class="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
                ACTIVE
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
