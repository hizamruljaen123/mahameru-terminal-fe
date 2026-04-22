import { createSignal, createMemo, createEffect, onCleanup, Show, For } from 'solid-js';
import StrategicAssetDetail from './components/StrategicAssetDetail';
import { getUtilStatus } from '../../utils/analysis/refineryIntel';
import { mapOffshoreType, OFFSHORE_CATEGORIES } from '../../utils/config/offshoreMapping';

const CATEGORY_CONFIG = {
  major: { radius: 10, color: '#ef4444', fillColor: '#ef4444', label: 'MAJOR (>400K BBL)' },
  large: { radius: 7,  color: '#f97316', fillColor: '#f97316', label: 'LARGE (200-400K BBL)' },
  medium: { radius: 5, color: '#f59e0b', fillColor: '#f59e0b', label: 'MEDIUM (100-200K BBL)' },
  small: { radius: 3,  color: '#eab308', fillColor: '#eab308', label: 'SMALL (30-100K BBL)' },
  micro: { radius: 2,  color: '#84cc16', fillColor: '#84cc16', label: 'MICRO (<30K BBL)' },
  unknown: { radius: 2, color: '#64748b', fillColor: '#64748b', label: 'UNKNOWN' },
  lng: { radius: 6, color: '#3b82f6', fillColor: '#0ea5e9', label: 'LNG TERMINAL' },
  offshore: { radius: 6, color: '#f43f5e', fillColor: '#f43f5e', label: 'OFFSHORE PLATFORM' },
  terminal: { radius: 5, color: '#d946ef', fillColor: '#d946ef', label: 'PETROLEUM TERMINAL' },
};

const CAT_ORDER = ['major', 'large', 'medium', 'small', 'micro', 'unknown'];

const LNG_TYPE_CONFIG = {
  'EXPORT': { color: '#3b82f6', label: 'LNG EXPORT HUB' },
  'IMPORT': { color: '#a855f7', label: 'LNG IMPORT HUB' },
  'INTERNAL': { color: '#10b981', label: 'INTERNAL DIST' },
  'UNKNOWN': { color: '#64748b', label: 'UNDETERMINED' }
};

export default function OilRefineryPanel() {
  const [view, setView] = createSignal('combined'); // 'fleet', 'lng', 'offshore', 'trades', 'report', 'combined'
  const [activeTableTab, setActiveTableTab] = createSignal('OVERVIEW'); // 'OVERVIEW', 'REFINERY', 'LNG', 'OFFSHORE'
  const [markerMode, setMarkerMode] = createSignal('COUNTRY'); // 'COUNTRY', 'ASSET'
  const [refineries, setRefineries] = createSignal([]);
  const [lngFacilities, setLngFacilities] = createSignal([]);
  const [offshorePlatforms, setOffshorePlatforms] = createSignal([]);
  const [petroleumTerminals, setPetroleumTerminals] = createSignal([]);
  const [selectedId, setSelectedId] = createSignal(null);
  const [news, setNews] = createSignal([]);
  const [loadingNews, setLoadingNews] = createSignal(false);
  const [searchTerm, setSearchTerm] = createSignal("");
  const [searchCountry, setSearchCountry] = createSignal("");
  const [showDetail, setShowDetail] = createSignal(false);

  // Trades State
  const [trades, setTrades] = createSignal([]);
  const [selectedTrade, setSelectedTrade] = createSignal(null);
  const [tradeHistory, setTradeHistory] = createSignal([]);
  const [loadingTrades, setLoadingTrades] = createSignal(false);
  const [tradeSearch, setTradeSearch] = createSignal("");
  const [tradePage, setTradePage] = createSignal(0);
  const [tradePageSize, setTradePageSize] = createSignal(50);
  const [tradeTotal, setTradeTotal] = createSignal(0);
  const [tradeNews, setTradeNews] = createSignal([]);
  const [loadingTradeNews, setLoadingTradeNews] = createSignal(false);

  // LNG State
  const [loadingLng, setLoadingLng] = createSignal(false);
  const [selectedLngId, setSelectedLngId] = createSignal(null);

  // Offshore State
  const [loadingOffshore, setLoadingOffshore] = createSignal(false);
  const [selectedOffshoreId, setSelectedOffshoreId] = createSignal(null);

  // Petroleum Terminal State
  const [loadingTerminals, setLoadingTerminals] = createSignal(false);
  const [selectedTerminalId, setSelectedTerminalId] = createSignal(null);

  // Analytics Stats State
  const [analytics, setAnalytics] = createSignal(null);
  const [loadingAnalytics, setLoadingAnalytics] = createSignal(false);
  const [combinedDBStats, setCombinedDBStats] = createSignal(null);
  const [loadingDBStats, setLoadingDBStats] = createSignal(false);
  
  const [refIntel, setRefIntel] = createSignal(null);
  const [detailTab, setDetailTab] = createSignal('INTEL'); // 'NEWS', 'INTEL'

  let mapInstance = null;
  let markerLayer = null;
  let routeLayer = null;
  let selectionLayer = null;

  const fetchRefineries = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_OIL_REFINERY_API}/api/refineries`);
      const result = await res.json();
      if (result.status === 'success') {
        const processed = (result.data || []).map(r => {
          const cap = parseFloat(r.kapasitas_bbl_per_hari) || 0;
          let cat = 'unknown';
          if (cap >= 400000) cat = 'major';
          else if (cap >= 200000) cat = 'large';
          else if (cap >= 100000) cat = 'medium';
          else if (cap >= 30000) cat = 'small';
          else if (cap > 0) cat = 'micro';
          return { ...r, category: cat, capacity: cap, latitude: parseFloat(r.latitude), longitude: parseFloat(r.longitude) };
        });
        setRefineries(processed);
      }
    } catch (e) {
      console.error("Refinery Analysis: Fetch error", e);
    }
  };

  const fetchLngFacilities = async () => {
    setLoadingLng(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_OIL_REFINERY_API}/api/lng-facilities?limit=1000`);
      const result = await res.json();
      if (result.status === 'success') {
        const processed = (result.data || []).map(l => ({
          ...l,
          category: 'lng',
          id: `lng-${l.id}`,
          originalId: l.id,
          name: l.fac_name,
          country: l.country,
          capacity: l.liq_capacity_bpd || 0,
          latitude: parseFloat(l.latitude),
          longitude: parseFloat(l.longitude),
          operator: l.operator,
          fac_status: l.fac_status,
          fac_type: l.fac_type
        }));
        setLngFacilities(processed);
      }
    } catch (e) {
      console.error("LNG Analysis: Fetch error", e);
    } finally {
      setLoadingLng(false);
    }
  };

  const fetchOffshorePlatforms = async () => {
    setLoadingOffshore(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_OIL_REFINERY_API}/api/offshore-platforms?limit=1000`);
      const result = await res.json();
      if (result.status === 'success') {
        const processed = (result.data || []).map(o => {
          const typeInfo = mapOffshoreType(o.fac_type);
          return {
            ...o,
            category: 'offshore',
            subCategory: typeInfo.key,
            catColor: typeInfo.color,
            catLabel: typeInfo.label,
            id: `offshore-${o.id}`,
            originalId: o.id,
            name: o.fac_name,
            country: o.country,
            latitude: parseFloat(o.latitude),
            longitude: parseFloat(o.longitude),
            operator: o.operator,
            fac_status: o.fac_status,
            fac_type: o.fac_type
          };
        });
        setOffshorePlatforms(processed);
      }
    } catch (e) {
      console.error("Offshore Analysis: Fetch error", e);
    } finally {
      setLoadingOffshore(false);
    }
  };

  const fetchPetroleumTerminals = async () => {
    setLoadingTerminals(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_OIL_REFINERY_API}/api/petroleum-terminals?limit=5000`);
      const result = await res.json();
      if (result.status === 'success') {
        const processed = (result.data || []).map(t => ({
          ...t,
          category: 'terminal',
          id: `terminal-${t.id}`,
          originalId: t.id,
          name: t.fac_name,
          country: t.country,
          capacity: t.liq_capacity_bpd || 0,
          latitude: parseFloat(t.latitude),
          longitude: parseFloat(t.longitude),
          operator: t.operator,
          fac_status: t.fac_status,
          fac_type: t.fac_type,
          on_offshore: t.on_offshore
        }));
        setPetroleumTerminals(processed);
      }
    } catch (e) {
      console.error("Terminal Analysis: Fetch error", e);
    } finally {
      setLoadingTerminals(false);
    }
  };

  const fetchTrades = async () => {
    setLoadingTrades(true);
    try {
      const offset = tradePage() * tradePageSize();
      const res = await fetch(`${import.meta.env.VITE_OIL_TRADE_API}/api/trade/data?frequency=monthly&limit=${tradePageSize()}&offset=${offset}`);
      const result = await res.json();
      if (result.status === 'success') {
        setTrades(result.data || []);
        setTradeTotal(result.total || 0);
      }
    } catch (e) {
      console.error("Trade Analysis: Fetch error", e);
    } finally {
      setLoadingTrades(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_OIL_TRADE_API}/api/trade/analytics`);
      const result = await res.json();
      if (result.status === 'success') {
        setAnalytics(result.data);
      }
    } catch (e) {
      console.error("Report Analysis: Fetch error", e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchCombinedDBStats = async () => {
    setLoadingDBStats(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_OIL_REFINERY_API}/api/stats/combined`);
      const result = await res.json();
      if (result.status === 'success') {
        setCombinedDBStats(result);
      }
    } catch (e) {
      console.error("DB Stats Analysis: Fetch error", e);
    } finally {
      setLoadingDBStats(false);
    }
  };

  createEffect(() => {
    if (view() === 'trades') fetchTrades();
    if (view() === 'report') {
      fetchAnalytics();
      fetchCombinedDBStats();
    } else {
      setTimeout(() => {
        if (mapInstance) mapInstance.invalidateSize();
      }, 100);
    }
    if (view() === 'lng') fetchLngFacilities();
    if (view() === 'offshore') fetchOffshorePlatforms();
    if (view() === 'terminal') fetchPetroleumTerminals();
    if (view() === 'fleet' || view() === 'combined') {
       fetchRefineries();
       fetchLngFacilities();
       fetchOffshorePlatforms();
       fetchPetroleumTerminals();
    }
  });

  createEffect(() => {
    const v = view();
    const r = filteredRefineries();
    const l = filteredLng();
    const o = filteredOffshore();
    const t = filteredTerminals();
    
    if (markerLayer) {
       if (v === 'combined') {
          const tab = activeTableTab();
          if (markerMode() === 'COUNTRY') {
             updateCountryMarkers(combinedStats().countries, tab);
          } else {
             if (tab === 'REFINERY') updateMarkers(r);
             else if (tab === 'LNG') updateMarkers(l);
             else if (tab === 'OFFSHORE') updateMarkers(o);
             else if (tab === 'TERMINAL') updateMarkers(t);
             else updateMarkers([...r, ...l, ...o, ...t]);
          }
       } else if (v === 'fleet') {
          updateMarkers(r);
       } else if (v === 'lng') {
          updateMarkers(l);
       } else if (v === 'offshore') {
          updateMarkers(o);
       } else if (v === 'terminal') {
          updateMarkers(t);
       } else {
          markerLayer.clearLayers();
       }
    }
  });

  const fetchTradeDetail = async (trade) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_OIL_TRADE_API}/api/trade/detail?origin_id=${trade.origin_id}&destination_id=${trade.destination_id}&grade_id=${trade.grade_id}`);
      const result = await res.json();
      if (result.status === 'success') {
        setTradeHistory(result.history || []);
      }
    } catch (e) {
      console.error("Trade Lane Detail: Fetch error", e);
    }
  };

  const fetchTradeNews = async (origin, destination) => {
    setLoadingTradeNews(true);
    setTradeNews([]);
    try {
      const res = await fetch(`${import.meta.env.VITE_OIL_TRADE_API}/api/trade/news?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);
      const result = await res.json();
      if (result.status === 'success') {
        setTradeNews(result.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTradeNews(false);
    }
  };

  const fetchNews = async (id) => {
    setLoadingNews(true);
    setNews([]);
    try {
      let url = `${import.meta.env.VITE_OIL_REFINERY_API}/api/refineries/${id}/news?period=7d`;
      let useGNews = false;

      if (id.toString().startsWith('offshore-')) {
        const offId = id.split('-')[1];
        const off = offshorePlatforms().find(p => p.originalId.toString() === offId);
        if (off) {
           url = `${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(off.name + " " + off.country)}`;
           useGNews = true;
        }
      } else if (id.toString().startsWith('terminal-')) {
        const termId = id.split('-')[1];
        const term = petroleumTerminals().find(p => p.originalId.toString() === termId);
        if (term) {
           url = `${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(term.name + " " + term.country)}`;
           useGNews = true;
        }
      } else if (id.toString().startsWith('lng-')) {
        const lngId = id.split('-')[1];
        const lng = lngFacilities().find(p => p.originalId.toString() === lngId);
        if (lng) {
          url = `${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(lng.name + " " + lng.country)}`;
          useGNews = true;
        }
      }

      const res = await fetch(url);
      const result = await res.json();

      if (useGNews) {
        const gnews = (result.news || []).map(n => ({
          title: n.title,
          description: "RSS FEED INFRASTRUCTURE UPDATE",
          publisher: n.publisher,
          pubDate: new Date(n.time * 1000).toLocaleString(),
          link: n.link,
          type: 'ASSET'
        }));
        setNews(gnews);
      } else if (result.status === 'success') {
        const refNews = (result.data.refinery || []).map(n => ({ ...n, type: 'ASSET' }));
        const macroNews = (result.data.macro || []).map(n => ({ ...n, type: 'MACRO' }));
        const tradeNewsData = (result.data.trade || []).map(n => ({ ...n, type: 'TRADE' }));
        setNews([...refNews, ...tradeNewsData, ...macroNews]);
      }
    } catch (e) {
      console.error("Refinery Detail: Fetch error", e);
    } finally {
      setLoadingNews(false);
    }
  };

  const handleSelect = (ref) => {
    if (ref.category === 'lng') {
      setSelectedLngId(ref.id);
      setSelectedId(null);
      setSelectedOffshoreId(null);
      setSelectedTerminalId(null);
      fetchNews(ref.id);
    } else if (ref.category === 'offshore') {
      setSelectedOffshoreId(ref.id);
      setSelectedId(null);
      setSelectedLngId(null);
      setSelectedTerminalId(null);
      fetchNews(ref.id);
    } else if (ref.category === 'terminal') {
      setSelectedTerminalId(ref.id);
      setSelectedId(null);
      setSelectedLngId(null);
      setSelectedOffshoreId(null);
      fetchNews(ref.id);
    } else {
      setSelectedId(ref.id);
      setSelectedLngId(null);
      setSelectedOffshoreId(null);
      setSelectedTerminalId(null);
      fetchNews(ref.id);
    }
    
    if (mapInstance && ref.latitude) {
      if (selectionLayer) {
        selectionLayer.clearLayers();
        const icon = window.L.divIcon({
          html: `<div class="w-6 h-6 border-2 border-white rounded-full bg-orange-500/80 animate-ping absolute -top-3 -left-3"></div><div class="w-4 h-4 border-2 border-white rounded-full bg-white absolute -top-2 -left-2 shadow-[0_0_10px_rgba(255,255,255,1)]"></div>`,
          className: 'custom-selection-marker'
        });
        window.L.marker([ref.latitude, ref.longitude], { icon }).addTo(selectionLayer);
      }
      mapInstance.flyTo([ref.latitude, ref.longitude], 14, { animate: true, duration: 1.5 });
    }
  };

  const handleTradeSelect = async (trade) => {
    setSelectedTrade(trade);
    fetchTradeDetail(trade);
    fetchTradeNews(trade.origin_name, trade.destination_name);
    
    if (mapInstance && routeLayer) {
      routeLayer.clearLayers();
      try {
        const res = await fetch(`${import.meta.env.VITE_OIL_TRADE_API}/api/geocode/route?origin=${encodeURIComponent(trade.origin_name)}&destination=${encodeURIComponent(trade.destination_name)}`);
        const result = await res.json();
        if (result.status === 'success' && result.origin.lat) {
          const originPt = [parseFloat(result.origin.lat), parseFloat(result.origin.lon)];
          const destPt = [parseFloat(result.destination.lat), parseFloat(result.destination.lon)];
          const path = window.L.polyline([originPt, destPt], {
            color: '#3b82f6',
            weight: 3,
            opacity: 0.6,
            dashArray: '10, 10',
            className: 'animate-trade-line'
          }).addTo(routeLayer);
          mapInstance.fitBounds(path.getBounds(), { padding: [50, 50], duration: 1 });
        }
      } catch (e) { console.error(e); }
    }
  };

  const filteredRefineries = createMemo(() => {
    const sc = searchCountry().toLowerCase();
    const st = searchTerm().toLowerCase();
    return refineries().filter(r => 
      r.nama_kilang.toLowerCase().includes(st) &&
      r.negara.toLowerCase().includes(sc)
    );
  });

  const filteredLng = createMemo(() => {
    const sc = searchCountry().toLowerCase();
    const st = searchTerm().toLowerCase();
    return lngFacilities().filter(l => 
      (l.name.toLowerCase().includes(st) || l.country.toLowerCase().includes(st)) &&
      l.country.toLowerCase().includes(sc)
    );
  });

  const filteredOffshore = createMemo(() => {
    const sc = searchCountry().toLowerCase();
    const st = searchTerm().toLowerCase();
    return offshorePlatforms().filter(o => 
      (o.name.toLowerCase().includes(st) || o.country.toLowerCase().includes(st)) &&
      o.country.toLowerCase().includes(sc)
    );
  });

  const filteredTerminals = createMemo(() => {
    const sc = searchCountry().toLowerCase();
    const st = searchTerm().toLowerCase();
    return petroleumTerminals().filter(t => 
      (t.name.toLowerCase().includes(st) || t.country.toLowerCase().includes(st)) &&
      t.country.toLowerCase().includes(sc)
    );
  });

  const filteredTrades = createMemo(() => {
    return trades().filter(t => 
      t.origin_name.toLowerCase().includes(tradeSearch().toLowerCase()) ||
      t.destination_name.toLowerCase().includes(tradeSearch().toLowerCase())
    );
  });

  const selectedRefinery = createMemo(() => refineries().find(r => r.id === selectedId()));
  const selectedLng = createMemo(() => lngFacilities().find(l => l.id === selectedLngId()));
  const selectedOffshore = createMemo(() => offshorePlatforms().find(o => o.id === selectedOffshoreId()));
  const selectedTerminal = createMemo(() => petroleumTerminals().find(t => t.id === selectedTerminalId()));

  const combinedStats = createMemo(() => {
    const refs = refineries();
    const lng = lngFacilities();
    const off = offshorePlatforms();
    const terminals = petroleumTerminals();
    const countryAgg = {};
    [...refs, ...lng, ...off, ...terminals].forEach(item => {
      const country = item.negara || item.country || 'UNKNOWN';
      if (!countryAgg[country]) {
        countryAgg[country] = { 
          name: country, 
          count: 0, 
          refs: 0, 
          lngs: 0, 
          offs: 0, 
          terms: 0,
          lat: 0, 
          lng: 0,
          bounds: [[item.latitude, item.longitude], [item.latitude, item.longitude]]
        };
      }
      countryAgg[country].count++;
      if (item.category === 'refinery') countryAgg[country].refs++;
      if (item.category === 'lng') countryAgg[country].lngs++;
      if (item.category === 'offshore') countryAgg[country].offs++;
      if (item.category === 'terminal') countryAgg[country].terms++;
      
      if (item.latitude && item.longitude) {
         countryAgg[country].lat = (countryAgg[country].lat * (countryAgg[country].count - 1) + item.latitude) / countryAgg[country].count;
         countryAgg[country].lng = (countryAgg[country].lng * (countryAgg[country].count - 1) + item.longitude) / countryAgg[country].count;
         countryAgg[country].bounds[0][0] = Math.min(countryAgg[country].bounds[0][0], item.latitude);
         countryAgg[country].bounds[0][1] = Math.min(countryAgg[country].bounds[0][1], item.longitude);
         countryAgg[country].bounds[1][0] = Math.max(countryAgg[country].bounds[1][0], item.latitude);
         countryAgg[country].bounds[1][1] = Math.max(countryAgg[country].bounds[1][1], item.longitude);
      }
    });
    const countries = Object.values(countryAgg).sort((a, b) => b.count - a.count);
    return { countries, totalAssets: refs.length + lng.length + off.length + terminals.length };
  });

  const initMap = (el) => {
    if (mapInstance || !el) return;
    mapInstance = window.L.map(el, { zoomControl: false }).setView([20, 0], 2);
    window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' }).addTo(mapInstance);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { opacity: 0.7 }).addTo(mapInstance);
    markerLayer = window.L.layerGroup().addTo(mapInstance);
    routeLayer = window.L.layerGroup().addTo(mapInstance);
    selectionLayer = window.L.layerGroup().addTo(mapInstance);
    fetchRefineries();
    fetchLngFacilities();
    fetchOffshorePlatforms();
    fetchPetroleumTerminals();
    setTimeout(() => mapInstance.invalidateSize(), 200);
  };
    
  const updateCountryMarkers = (countries, activeTab = 'OVERVIEW') => {
    if (!markerLayer) return;
    markerLayer.clearLayers();
    countries.forEach((country) => {
      if (!country.lat || !country.lng) return;
      let displayCount = country.count;
      let accentColor = '#f97316';
      let glowColor = 'rgba(249,115,22,0.2)';
      if (activeTab === 'REFINERY') displayCount = country.refs;
      else if (activeTab === 'LNG') { displayCount = country.lngs; accentColor = '#06b6d4'; glowColor = 'rgba(6,182,212,0.2)'; }
      else if (activeTab === 'OFFSHORE') { displayCount = country.offs; accentColor = '#f43f5e'; glowColor = 'rgba(244,63,94,0.2)'; }
      else if (activeTab === 'TERMINAL') { displayCount = country.terms; accentColor = '#d946ef'; glowColor = 'rgba(217,70,239,0.2)'; }
      if (displayCount === 0 && activeTab !== 'OVERVIEW') return;
      const icon = window.L.divIcon({
        className: 'country-aggregate-marker',
        html: `
          <div class="relative group">
            <div class="w-8 h-8 rounded-full border-2 backdrop-blur-sm flex items-center justify-center animate-in zoom-in duration-500 shadow-2xl" 
                 style="background-color: ${glowColor}; border-color: ${accentColor};">
               <span class="text-[10px] font-black text-white" style="text-shadow: 0 0 5px ${accentColor}">${displayCount}</span>
            </div>
            <div class="absolute top-full left-1/2 -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
               <div class="bg-black/90 border border-white/10 px-2 py-1 text-[8px] font-black text-white uppercase">${country.name}</div>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      window.L.marker([country.lat, country.lng], { icon }).addTo(markerLayer).on('click', () => {
         setSearchCountry(country.name);
         setMarkerMode('ASSET');
         if (activeTab === 'OVERVIEW') setActiveTableTab('REFINERY');
         mapInstance.fitBounds(country.bounds, { padding: [50, 50], maxZoom: 8, animate: true });
      });
    });
  };

  const updateMarkers = (data) => {
    if (!markerLayer || !mapInstance) return;
    markerLayer.clearLayers();
    if (data.length === 0) return;

    const bounds = window.L.latLngBounds();
    let hasPoints = false;

    data.forEach((item) => {
      if (!item.latitude || !item.longitude) return;
      let fillColor = '#0ea5e9';
      let radius = 6;
      if (item.category === 'lng') {
        const type = (item.fac_type || 'UNKNOWN').toUpperCase();
        fillColor = LNG_TYPE_CONFIG[type]?.color || LNG_TYPE_CONFIG.UNKNOWN.color;
        radius = 5;
      } else if (item.category === 'offshore') {
        fillColor = item.catColor || CATEGORY_CONFIG.offshore.fillColor;
        radius = 5;
      } else if (item.category === 'terminal') {
        fillColor = item.on_offshore?.toUpperCase() === 'OFFSHORE' ? '#8b5cf6' : '#d946ef';
        radius = 5;
      } else {
        const cfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.unknown;
        fillColor = cfg.fillColor;
        radius = cfg.radius;
      }

      window.L.circleMarker([item.latitude, item.longitude], {
        radius: radius, 
        fillColor: fillColor, 
        color: '#fff', 
        weight: 1, 
        opacity: 0.8, 
        fillOpacity: 0.8
      }).addTo(markerLayer).on('click', () => handleSelect(item));
      
      bounds.extend([item.latitude, item.longitude]);
      hasPoints = true;
    });

    if (hasPoints && markerMode() === 'ASSET' && data.length > 0) {
      mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 10, animate: true });
    }
  };

  onCleanup(() => { if (mapInstance) { mapInstance.remove(); mapInstance = null; } });

  const toggleView = (v) => {
    setView(v);
    if (selectionLayer) selectionLayer.clearLayers();
    if (routeLayer) routeLayer.clearLayers();
    if (mapInstance) setTimeout(() => mapInstance.invalidateSize(), 100);
  };

  return (
    <div class="h-full flex flex-col bg-[#050b14] text-[#e2e8f0] font-mono lowercase overflow-hidden">
      <div class="flex items-center gap-1 p-1 bg-[#0a1628] border-b border-[#1e3a5f] shrink-0 overflow-x-auto no-scrollbar">
         <div class="flex items-center gap-2 px-3 py-1 mr-4 border-r border-[#1e3a5f]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="3"><path d="M2 20h20M7 20v-4m10 4v-8M12 20V4" /></svg>
            <span class="text-[10px] font-black text-white tracking-widest uppercase">REFINERY ANALYTICS SYSTEM</span>
         </div>
         <div class="flex gap-1">
            <button onClick={() => toggleView('combined')} class={`h-6 px-3 text-[9px] font-black uppercase border transition-all ${view() === 'combined' ? 'bg-purple-600 text-white border-purple-400' : 'text-white/40 border-transparent hover:text-white'}`}>COMBINED HUB</button>
            <button onClick={() => toggleView('trades')} class={`h-6 px-3 text-[9px] font-black uppercase border transition-all ${view() === 'trades' ? 'bg-blue-600 text-white border-blue-400' : 'text-white/40 border-transparent hover:text-white'}`}>TRADE FLOW</button>
            <button onClick={() => setView('report')} class={`h-6 px-3 text-[9px] font-black uppercase border transition-all ${view() === 'report' ? 'bg-green-600 text-white border-green-400' : 'text-white/40 border-transparent hover:text-white'}`}>ANALYTICS REPORT</button>
         </div>
         <div class="ml-auto flex items-center gap-4 px-4 text-[9px] text-[#22c55e] font-black uppercase tracking-widest bg-[#22c55e]/5 h-full">
            <span class="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"></span>
            SYSTEM STATUS: OPERATIONAL
         </div>
      </div>

      <div class="flex-1 flex flex-col relative overflow-hidden">
        <div class={`flex-1 flex flex-col h-full ${view() === 'report' ? 'hidden' : ''}`}>
           <div class="h-[65%] relative border-b-2 border-[#1e3a5f]">
              <style>{`
                .animate-trade-line { stroke-dasharray: 10, 10; animation: dash 20s linear infinite; }
                @keyframes dash { to { stroke-dashoffset: -1000; } }
              `}</style>
              <div ref={initMap} class="w-full h-full grayscale-[0.2]" />
              
              <div class="absolute top-4 left-4 z-[1000] bg-black/90 border border-white/5 p-1.5 backdrop-blur-md flex flex-col gap-2.5 shadow-2xl animate-in fade-in slide-in-from-left-2 max-w-[120px] border-l-2 border-orange-500">
                <Show when={view() === 'fleet' || view() === 'combined'}>
                  <div class="w-full">
                    <div class="flex items-center gap-2 mb-2 pb-1 border-b border-orange-500/30">
                       <span class="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                       <span class="text-[9px] font-black text-white uppercase tracking-wider">OIL REFINERIES</span>
                    </div>
                    <div class="space-y-1">
                      <For each={CAT_ORDER.slice(0, 5)}>{(cat) => (<div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full" style={{ background: CATEGORY_CONFIG[cat].fillColor }}></div><span class="text-[7px] text-white/40 uppercase font-bold">{CATEGORY_CONFIG[cat].label}</span></div>)}</For>
                    </div>
                  </div>
                </Show>

                <Show when={view() === 'lng' || view() === 'combined'}>
                  <div class="w-full">
                    <div class="flex items-center gap-2 mb-2 pb-1 border-b border-cyan-500/30">
                       <span class="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                       <span class="text-[9px] font-black text-white uppercase tracking-wider">LNG TERMINALS</span>
                    </div>
                    <div class="space-y-1">
                       <For each={Object.entries(LNG_TYPE_CONFIG)}>{([key, cfg]) => (<div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full" style={{ background: cfg.color }}></div><span class="text-[7px] text-white/40 uppercase font-bold">{cfg.label}</span></div>)}</For>
                    </div>
                  </div>
                </Show>

                <Show when={view() === 'offshore' || view() === 'combined'}>
                  <div class="w-full">
                    <div class="flex items-center gap-2 mb-2 pb-1 border-b border-rose-500/30">
                       <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                       <span class="text-[9px] font-black text-white uppercase tracking-wider">OFFSHORE OPS</span>
                    </div>
                    <div class="space-y-1">
                       <For each={Object.values(OFFSHORE_CATEGORIES)}>{(cat) => (<div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full" style={{ background: cat.color }}></div><span class="text-[7px] text-white/40 uppercase font-bold">{cat.label}</span></div>)}</For>
                    </div>
                  </div>
                </Show>

                <Show when={view() === 'terminal' || view() === 'combined'}>
                  <div class="w-full">
                    <div class="flex items-center gap-2 mb-2 pb-1 border-b border-fuchsia-500/30">
                       <span class="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-pulse"></span>
                       <span class="text-[9px] font-black text-white uppercase tracking-wider">PETRO TERMINALS</span>
                    </div>
                    <div class="space-y-1">
                       <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-[#d946ef]"></div><span class="text-[7px] text-white/40 uppercase font-bold">ONSHORE</span></div>
                       <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-[#8b5cf6]"></div><span class="text-[7px] text-white/40 uppercase font-bold">OFFSHORE</span></div>
                    </div>
                  </div>
                </Show>
              </div>

               <Show when={(selectedRefinery() || selectedLng() || selectedOffshore() || selectedTerminal()) && (view() === 'combined' || view() === 'fleet' || view() === 'lng' || view() === 'offshore' || view() === 'terminal')}>
                  <div class="absolute bottom-4 left-4 right-4 z-[1000] bg-[#0a1628]/95 border-l-4 border-orange-500 p-4 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 shadow-2xl flex justify-between items-center">
                     <div>
                        <div class="text-[9px] text-[#22d3ee] font-black uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                           <span class="w-1.5 h-1.5 bg-[#22d3ee] animate-pulse"></span>
                           ASSET IDENTIFIED: {selectedRefinery() ? 'REFINERY' : selectedLng() ? 'LNG HUB' : selectedOffshore() ? 'OFFSHORE PLATFORM' : 'PETROLEUM TERMINAL'}
                        </div>
                         <h2 class="text-20px font-black text-white uppercase leading-none tracking-tighter">{selectedRefinery()?.nama_kilang || selectedLng()?.name || selectedOffshore()?.name || selectedTerminal()?.name}</h2>
                        <div class="flex gap-4 mt-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
                           <span class="text-[#f97316]">{selectedRefinery()?.negara || selectedLng()?.country || selectedOffshore()?.country || selectedTerminal()?.country}</span>
                           <span class="border-l border-white/10 pl-4 uppercase">{(selectedRefinery()?.capacity || selectedLng()?.liq_capacity_bpd || selectedTerminal()?.liq_capacity_bpd || 0).toLocaleString()} {selectedRefinery() || selectedLng() || selectedTerminal() ? 'BPD' : ''}</span>
                           <span class="border-l border-white/10 pl-4 text-green-500 uppercase">{selectedRefinery() ? 'OPERATIONAL' : (selectedLng() || selectedOffshore() || selectedTerminal())?.fac_status}</span>
                        </div>
                     </div>
                     <button onClick={() => { fetchNews(selectedId() || selectedLngId() || selectedOffshoreId() || selectedTerminalId()); setShowDetail(true); }} class="bg-orange-600 text-white px-8 py-3 text-[12px] font-black uppercase tracking-[0.2em] hover:bg-orange-500 transition-all shadow-[0_0_30px_rgba(234,88,12,0.4)] border border-orange-400/50">ANALYZE STRATEGIC ASSET</button>
                  </div>
               </Show>
            </div>

            <div class="flex-1 flex overflow-hidden">
               <div class="flex-1 flex flex-col bg-black/40">
                 <div class="p-2.5 border-b border-[#1e3a5f] bg-white/2 flex items-center gap-3">
                    <Show when={searchCountry() !== "" || activeTableTab() !== 'OVERVIEW'}>
                       <button onClick={() => { setSearchCountry(""); setActiveTableTab('OVERVIEW'); setMarkerMode('COUNTRY'); mapInstance.flyTo([20, 0], 2); }} class="bg-orange-500/10 border border-orange-500/30 text-orange-500 text-[8px] font-black px-2 py-1 flex items-center gap-1.5 hover:bg-orange-500 hover:text-white transition-all group shrink-0">← GLOBAL OVERVIEW</button>
                    </Show>
                    <Show when={view() === 'fleet'}><input onInput={(e) => setSearchTerm(e.target.value)} type="text" placeholder="FILTER BY NAME..." class="bg-black/40 border border-white/10 px-2 py-1 text-[10px] text-white w-32" /><input onInput={(e) => setSearchCountry(e.target.value)} type="text" placeholder="FILTER BY COUNTRY..." class="bg-black/40 border border-white/10 px-2 py-1 text-[10px] text-white w-32" /></Show>
                    <Show when={view() === 'lng'}><input onInput={(e) => setSearchTerm(e.target.value)} type="text" placeholder="FILTER BY TERMINAL..." class="bg-black/40 border border-cyan-500/30 px-2 py-1 text-[10px] text-white w-64" /></Show>
                    <Show when={view() === 'offshore'}><input onInput={(e) => setSearchTerm(e.target.value)} type="text" placeholder="FILTER BY PLATFORM..." class="bg-black/40 border border-rose-500/30 px-2 py-1 text-[10px] text-white w-64" /></Show>
                    <Show when={view() === 'terminal'}><input onInput={(e) => setSearchTerm(e.target.value)} type="text" placeholder="FILTER BY TERMINAL..." class="bg-black/40 border border-fuchsia-500/30 px-2 py-1 text-[10px] text-white w-64" /></Show>
                    <Show when={view() === 'trades'}><input onInput={(e) => setTradeSearch(e.target.value)} type="text" placeholder="SEARCH TRADE LANES..." class="bg-black/40 border border-blue-500/30 px-2 py-1 text-[10px] text-white w-64" /></Show>
                    <div class="ml-auto text-[8px] font-black text-white/30 uppercase tracking-widest">
                       TOTAL: { 
                         view() === 'trades' ? filteredTrades().length :
                         activeTableTab() === 'OVERVIEW' ? combinedStats().countries.length : 
                         activeTableTab() === 'REFINERY' ? filteredRefineries().length :
                         activeTableTab() === 'LNG' ? filteredLng().length :
                         activeTableTab() === 'OFFSHORE' ? filteredOffshore().length :
                         activeTableTab() === 'TERMINAL' ? filteredTerminals().length : 0
                       } RECORDS
                    </div>
                 </div>
                 
                 <Show when={view() === 'combined'}>
                    <div class="flex border-b border-[#1e3a5f] bg-black/20">
                      <button onClick={() => { setActiveTableTab('OVERVIEW'); setMarkerMode('COUNTRY'); setSearchCountry(""); }} class={`flex-1 py-1.5 text-[8px] font-black uppercase transition-all ${activeTableTab() === 'OVERVIEW' ? 'bg-orange-500/20 text-orange-500 border-b-2 border-orange-500' : 'text-white/40 hover:text-white'}`}>OVERVIEW</button>
                      <button onClick={() => { setActiveTableTab('REFINERY'); setMarkerMode('ASSET'); }} class={`flex-1 py-1.5 text-[8px] font-black uppercase transition-all ${activeTableTab() === 'REFINERY' ? 'bg-orange-500/20 text-orange-500 border-b-2 border-orange-500' : 'text-white/40 hover:text-white'}`}>REFINERIES</button>
                      <button onClick={() => { setActiveTableTab('LNG'); setMarkerMode('ASSET'); }} class={`flex-1 py-1.5 text-[8px] font-black uppercase transition-all ${activeTableTab() === 'LNG' ? 'bg-cyan-500/20 text-cyan-500 border-b-2 border-cyan-500' : 'text-white/40 hover:text-white'}`}>LNG TERMINALS</button>
                      <button onClick={() => { setActiveTableTab('OFFSHORE'); setMarkerMode('ASSET'); }} class={`flex-1 py-1.5 text-[8px] font-black uppercase transition-all ${activeTableTab() === 'OFFSHORE' ? 'bg-rose-500/20 text-rose-500 border-b-2 border-rose-500' : 'text-white/40 hover:text-white'}`}>OFFSHORE OPS</button>
                      <button onClick={() => { setActiveTableTab('TERMINAL'); setMarkerMode('ASSET'); }} class={`flex-1 py-1.5 text-[8px] font-black uppercase transition-all ${activeTableTab() === 'TERMINAL' ? 'bg-fuchsia-500/20 text-fuchsia-500 border-b-2 border-fuchsia-500' : 'text-white/40 hover:text-white'}`}>PETRO TERMINALS</button>
                    </div>
                 </Show>

                 <div class="flex-1 overflow-y-auto win-scroll relative">
                    <Show when={view() === 'combined' && activeTableTab() === 'OVERVIEW'}>
                       <table class="w-full text-left"><thead class="sticky top-0 bg-[#0f1d2e] z-10 border-b border-[#1e3a5f]"><tr class="text-[7px] text-white/40 uppercase tracking-widest"><th class="p-3">NATION / JURISDICTION</th><th class="p-3 text-right">ASSET COUNT</th><th class="p-3">DISTRIBUTION</th></tr></thead><tbody class="divide-y divide-white/5"><For each={combinedStats().countries}>{(agg) => (<tr onClick={() => { setSearchCountry(agg.name); setMarkerMode('ASSET'); setActiveTableTab('REFINERY'); mapInstance.fitBounds(agg.bounds, { padding: [30, 30], maxZoom: 8, animate: true }); }} class={`group cursor-pointer hover:bg-orange-500/5 ${searchCountry() === agg.name ? 'bg-orange-500/10 border-l-3 border-orange-500' : ''}`}><td class="p-2.5 text-[10px] font-black text-white uppercase group-hover:text-orange-500">{agg.name}</td><td class="p-2.5 text-[11px] font-black text-right text-orange-500">{agg.count}</td><td class="p-2.5"><div class="flex gap-1.5"><div class="flex items-center gap-0.5"><span class="w-1 h-1 rounded-full bg-orange-500"></span><span class="text-[7px] font-bold text-white/40">{agg.refs}</span></div><div class="flex items-center gap-0.5"><span class="w-1 h-1 rounded-full bg-cyan-500"></span><span class="text-[7px] font-bold text-white/40">{agg.lngs}</span></div><div class="flex items-center gap-0.5"><span class="w-1 h-1 rounded-full bg-rose-500"></span><span class="text-[7px] font-bold text-white/40">{agg.offs}</span></div><div class="flex items-center gap-0.5"><span class="w-1 h-1 rounded-full bg-fuchsia-500"></span><span class="text-[7px] font-bold text-white/40">{agg.terms}</span></div></div></td></tr>)}</For></tbody></table>
                    </Show>
                    <Show when={view() === 'fleet' || (view() === 'combined' && activeTableTab() === 'REFINERY')}>
                       <table class="w-full text-left"><thead class="sticky top-0 bg-[#0f1d2e] z-10 border-b border-[#1e3a5f]"><tr class="text-[7px] text-white/40 uppercase tracking-widest"><th class="p-3">IDENTIFIER</th><th class="p-3">LOCATION</th><th class="p-3 text-right">CAPACITY</th><th class="p-3">SCALE</th></tr></thead><tbody class="divide-y divide-white/5"><For each={filteredRefineries()}>{(ref) => (<tr onClick={() => handleSelect(ref)} class={`group cursor-pointer hover:bg-orange-500/5 ${selectedId() === ref.id ? 'bg-orange-500/10 border-l-2 border-orange-500' : ''}`}><td class="p-2 text-[10px] font-black text-white uppercase">{ref.nama_kilang}</td><td class="p-2 text-[10px] font-bold text-[#f97316] uppercase">{ref.negara}</td><td class="p-2 text-[11px] font-black text-right text-green-500">{ref.capacity.toLocaleString()}</td><td class="p-2"><span class="px-1 text-[7px] font-black border" style={{ color: CATEGORY_CONFIG[ref.category].color, 'border-color': CATEGORY_CONFIG[ref.category].color+'30' }}>{ref.category.toUpperCase()}</span></td></tr>)}</For></tbody></table>
                    </Show>
                    <Show when={view() === 'lng' || (view() === 'combined' && activeTableTab() === 'LNG')}>
                       <table class="w-full text-left"><thead class="sticky top-0 bg-[#0f1d2e] z-10 border-b border-[#1e3a5f]"><tr class="text-[7px] text-white/40 uppercase tracking-widest"><th class="p-3">LNG HUB IDENTIFIER</th><th class="p-3">LOCATION</th><th class="p-3">OPERATOR</th><th class="p-3">STATUS</th></tr></thead><tbody class="divide-y divide-white/5"><For each={filteredLng()}>{(lng) => (<tr onClick={() => handleSelect(lng)} class={`group cursor-pointer hover:bg-cyan-500/5 ${selectedLngId() === lng.id ? 'bg-cyan-500/10 border-l-2 border-cyan-500' : ''}`}><td class="p-2 text-[10px] font-black text-white uppercase">{lng.name}</td><td class="p-2 text-[10px] font-bold text-cyan-500 uppercase">{lng.country}</td><td class="p-2 text-[10px] font-bold text-white/40 uppercase">{lng.operator || 'N/A'}</td><td class="p-2"><span class="px-1 text-[7px] font-black border border-cyan-500/30 text-cyan-400 capitalize">{lng.fac_status}</span></td></tr>)}</For></tbody></table>
                    </Show>
                    <Show when={view() === 'offshore' || (view() === 'combined' && activeTableTab() === 'OFFSHORE')}>
                       <table class="w-full text-left"><thead class="sticky top-0 bg-[#0f1d2e] z-10 border-b border-[#1e3a5f]"><tr class="text-[7px] text-white/40 uppercase tracking-widest"><th class="p-3">OFFSHORE PLATFORM</th><th class="p-3">LOCATION</th><th class="p-3">OPERATOR</th><th class="p-3">STATUS</th></tr></thead><tbody class="divide-y divide-white/5"><For each={filteredOffshore()}>{(off) => (<tr onClick={() => handleSelect(off)} class={`group cursor-pointer hover:bg-rose-500/5 ${selectedOffshoreId() === off.id ? 'bg-rose-500/10 border-l-2 border-rose-500' : ''}`}><td class="p-2 text-[10px] font-black text-white uppercase">{off.name}</td><td class="p-2 text-[10px] font-bold text-rose-500 uppercase">{off.country}</td><td class="p-2 text-[10px] font-bold text-white/40 uppercase">{off.operator || 'N/A'}</td><td class="p-2"><span class="px-1 text-[7px] font-black border border-rose-500/30 text-rose-400 capitalize">{off.fac_status}</span></td></tr>)}</For></tbody></table>
                    </Show>
                    <Show when={view() === 'terminal' || (view() === 'combined' && activeTableTab() === 'TERMINAL')}>
                       <table class="w-full text-left"><thead class="sticky top-0 bg-[#0f1d2e] z-10 border-b border-[#1e3a5f]"><tr class="text-[7px] text-white/40 uppercase tracking-widest"><th class="p-3">TERMINAL HUB</th><th class="p-3">LOCATION</th><th class="p-3 text-right">CAPACITY</th><th class="p-3">STATUS</th></tr></thead><tbody class="divide-y divide-white/5"><For each={filteredTerminals()}>{(term) => (<tr onClick={() => handleSelect(term)} class={`group cursor-pointer hover:bg-fuchsia-500/5 ${selectedTerminalId() === term.id ? 'bg-fuchsia-500/10 border-l-2 border-fuchsia-500' : ''}`}><td class="p-2 text-[10px] font-black text-white uppercase">{term.name}</td><td class="p-2 text-[10px] font-bold text-fuchsia-500 uppercase">{term.country}</td><td class="p-2 text-[11px] font-black text-right text-white/60">{term.capacity.toLocaleString()}</td><td class="p-2 text-right"><span class="px-1 text-[7px] font-black border border-fuchsia-500/30 text-fuchsia-400 capitalize">{term.fac_status}</span></td></tr>)}</For></tbody></table>
                    </Show>
                    <Show when={view() === 'trades'}>
                       <table class="w-full text-left"><thead class="sticky top-0 bg-[#0f1d2e] z-10 border-b border-[#1e3a5f]"><tr class="text-[7px] text-white/40 uppercase tracking-widest"><th class="p-3">ORIGIN NODE</th><th class="p-3">DESTINATION NODE</th><th class="p-3">CARGO GRADE</th><th class="p-3">FREQUENCY</th></tr></thead><tbody class="divide-y divide-white/5"><For each={filteredTrades()}>{(trade) => (<tr onClick={() => handleTradeSelect(trade)} class={`group cursor-pointer hover:bg-blue-500/5 ${selectedTrade() === trade ? 'bg-blue-500/10 border-l-2 border-blue-500' : ''}`}><td class="p-2 text-[10px] font-black text-white uppercase">{trade.origin_name}</td><td class="p-2 text-[10px] font-black text-white uppercase">{trade.destination_name}</td><td class="p-2 text-[10px] font-bold text-blue-400 uppercase">{trade.grade_name}</td><td class="p-2 text-[10px] font-bold text-white/30 uppercase">{trade.frequency}</td></tr>)}</For></tbody></table>
                    </Show>
                 </div>
               </div>
            </div>
        </div>

        <div class={`flex-1 overflow-y-auto win-scroll bg-[#050b14] p-12 ${view() !== 'report' ? 'hidden' : ''}`}>
           {/* REPORT CONTENT ... */}
        </div>

        <StrategicAssetDetail 
           showDetail={showDetail}
           setShowDetail={setShowDetail}
           selectedRefinery={selectedRefinery}
           selectedLng={selectedLng}
           selectedOffshore={selectedOffshore}
           selectedTerminal={selectedTerminal}
           setSelectedId={setSelectedId}
           setSelectedLngId={setSelectedLngId}
           setSelectedOffshoreId={setSelectedOffshoreId}
           setSelectedTerminalId={setSelectedTerminalId}
           selectionLayer={selectionLayer}
           detailTab={detailTab}
           setDetailTab={setDetailTab}
           news={news}
           loadingNews={loadingNews}
           refIntel={refIntel}
           getUtilStatus={getUtilStatus}
        />
      </div>
    </div>
  );
}
