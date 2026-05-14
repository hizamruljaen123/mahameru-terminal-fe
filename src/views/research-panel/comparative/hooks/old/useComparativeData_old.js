import { createSignal } from 'solid-js';

const RESEARCH_API = import.meta.env.VITE_RESEARCH_API;
const MARKET_API = 'https://api.asetpedia.online/market';
const TA_API = 'https://api.asetpedia.online/ta';
const GNEWS_API = 'https://api.asetpedia.online/gnews';
const OIL_REFINERY_API = import.meta.env.VITE_OIL_REFINERY_API || 'https://api.asetpedia.online/refinery';

/**
 * Parallel data aggregation for up to 3 companies.
 * Returns: { data: { [symbol]: {...} }, logs: [], progress: 0-100 }
 */
export function useComparativeData() {
  const [companies, setCompanies] = createSignal(['', '', '']);
  const [rawData, setRawData] = createSignal({});
  const [loading, setLoading] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [logs, setLogs] = createSignal([]);
  const [error, setError] = createSignal(null);

  const addLog = (msg, type = 'info') => {
    const prefix = type === 'error' ? '✗' : type === 'success' ? '✓' : '·';
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${prefix} ${msg}`]);
  };

  const fetchWithTimeout = async (url, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  const fetchCompanyData = async (symbol) => {
    const result = { symbol };

    // 1. Fundamental (research_service — snapshot + wiki + officers)
    try {
      addLog(`[${symbol}] Fetching fundamental data...`);
      const res = await fetchWithTimeout(`${RESEARCH_API}/api/data/fundamental?symbol=${symbol}`);
      const json = await res.json();
      if (json.status === 'success') result.fundamental = json.data;
    } catch (e) {
      addLog(`[${symbol}] Fundamental fetch failed: ${e.message}`, 'error');
    }

    // 1b. Enriched fundamental (market_service — full financials: income, balance, cashflow by year)
    try {
      addLog(`[${symbol}] Fetching enriched financial statements...`);
      const res = await fetchWithTimeout(`${MARKET_API}/api/market/fundamental?symbol=${symbol}`, 20000);
      const json = await res.json();
      if (json.status === 'success') {
        // Merge into fundamental: add snapshot fields & yearly financials
        result.fundamentalEnriched = {
          snapshot: json.snapshot || {},
          years: json.years || [],
          financials: json.financials || {},
        };
        // Also backfill snapshot fields that market_service has
        if (result.fundamental) {
          result.fundamental.snapshot = {
            ...(result.fundamental.snapshot || {}),
            ...(json.snapshot || {}),
          };
        }
      }
    } catch (e) {
      addLog(`[${symbol}] Enriched financials fetch failed: ${e.message}`, 'error');
    }

    // 2. Market / Historical
    try {
      addLog(`[${symbol}] Fetching market history...`);
      const res = await fetchWithTimeout(`${RESEARCH_API}/api/data/market?symbol=${symbol}`);
      const json = await res.json();
      if (json.status === 'success') result.market = json.data;
    } catch (e) {
      addLog(`[${symbol}] Market fetch failed: ${e.message}`, 'error');
    }

    // 3. Technical Analysis
    try {
      addLog(`[${symbol}] Fetching technical indicators...`);
      const res = await fetchWithTimeout(`${TA_API}/api/ta/analyze/${symbol}`, 12000);
      const json = await res.json();
      if (!json.error) result.ta = json;
    } catch (e) {
      addLog(`[${symbol}] TA fetch failed: ${e.message}`, 'error');
    }

    // 4, 5, 6. Enriched News Gathering (Multi-query approach)
    try {
      const name = (result.fundamental?.snapshot?.name || symbol).trim().replace(/\n/g, ' ');
      // Refined base query for better specification
      const baseQuery = `${name} (${symbol})`;

      addLog(`[${symbol}] Initiating institutional news scan for ${name}...`);

      const sector = (result.fundamental?.snapshot?.sector || 'industry').trim().replace(/\n/g, ' ');
      const countryName = (result.fundamental?.snapshot?.country || 'USA').trim().replace(/\n/g, ' ');

      // Map common countries to GNews codes
      const countryMap = { 'Indonesia': 'ID', 'Malaysia': 'MY', 'Singapore': 'SG', 'United States': 'US', 'USA': 'US' };
      const countryCode = countryMap[countryName] || 'US';

      // Extract top officers for precision search
      const officers = (result.fundamental?.snapshot?.companyOfficers || [])
        .slice(0, 2)
        .map(o => o.name)
        .filter(n => n && n.length > 3);

      const newsTopics = [
        { key: 'news', q: `${name} Company News latest developments`, label: 'General' },
        { key: 'legalNews', q: `${name} Lawsuit Legal Case Controversy Risk`, label: 'Legal/Risk' },
        { key: 'projectNews', q: `${name} Future Projects Expansion Investment Strategy`, label: 'Expansion' },
        { key: 'sectorNews', q: `${sector} industry news global outlook trends ${countryName}`, label: 'Sector Intelligence' }
      ];

      // Add officer-specific queries for Leadership Trail
      if (officers.length > 0) {
        officers.forEach(officer => {
          newsTopics.push({
            key: 'leadershipNews',
            q: `"${officer}" ${name} news development`,
            label: `Leadership: ${officer}`,
            isStrict: true,
            officerName: officer
          });
        });
      } else {
        newsTopics.push({ key: 'leadershipNews', q: `${name} CEO Leadership Management Board`, label: 'Leadership' });
      }

      // Fetch all topics in parallel for this company
      const newsResults = await Promise.all(newsTopics.map(async (topic) => {
        try {
          // For legal news, we request a 10-year archive (using 10y period)
          const isLegal = topic.key === 'legalNews';
          const periodParam = isLegal ? '&period=10y' : '';

          const res = await fetchWithTimeout(`${RESEARCH_API}/api/gnews/search?q=${encodeURIComponent(topic.q)}&lang=en&country=${countryCode}${periodParam}`, 30000);
          const json = await res.json();
          let data = json.data || [];

          // Strict filtering for leadership news to avoid generic junk
          if (topic.isStrict && topic.officerName) {
            data = data.filter(item => {
              const text = (item.title + ' ' + (item.description || '')).toLowerCase();
              return text.includes(topic.officerName.toLowerCase());
            });
          }

          return { key: topic.key, data };
        } catch (e) {
          return { key: topic.key, data: [] };
        }
      }));

      // Merge and deduplicate by title/link
      const seen = new Set();
      const allNews = [];
      const categorized = { news: [], legalNews: [], leadershipNews: [], projectNews: [], sectorNews: [] };

      newsResults.forEach(res => {
        res.data.forEach(item => {
          const id = (item.link || item.title).toLowerCase();
          if (!seen.has(id)) {
            seen.add(id);
            allNews.push(item);
            categorized[res.key].push(item);
          }
        });
      });

      result.news = allNews;
      result.legalNews = categorized.legalNews;
      result.leadershipNews = categorized.leadershipNews;
      result.projectNews = categorized.projectNews;
      result.sectorNews = categorized.sectorNews;

      addLog(`[${symbol}] Deep scan complete. Found ${allNews.length} unique signals.`);
    } catch (e) {
      addLog(`[${symbol}] News scan failed: ${e.message}`, 'error');
      result.news = [];
      result.legalNews = [];
      result.leadershipNews = [];
    }

    // 7. Sentiment
    try {
      const res = await fetchWithTimeout(
        `https://api.asetpedia.online/sentiment/api/sentiment/research?keyword=${symbol}`, 6000
      );
      const json = await res.json();
      result.sentiment = json.data || {};
    } catch (e) {
      result.sentiment = {};
    }

    // 8. Infrastructure Proximity — enriched from yfinance lat/lon data
    try {
      const lat = result.fundamental?.snapshot?.latitude;
      const lon = result.fundamental?.snapshot?.longitude;
      if (lat != null && lon != null) {
        addLog(`[${symbol}] Scanning nearby infrastructure (${lat}, ${lon})...`);
        const infraRes = await fetchWithTimeout(
          `${OIL_REFINERY_API}/api/infrastructure/nearby?lat=${lat}&lon=${lon}&radius=100`, 10000
        );
        const infraJson = await infraRes.json();
        if (infraJson.status === 'success' && Array.isArray(infraJson.data)) {
          // Group by infra_type and count
          const grouped = {};
          infraJson.data.forEach(f => {
            if (!grouped[f.infra_type]) grouped[f.infra_type] = [];
            if (grouped[f.infra_type].length < 5) { // Keep top 5 nearest per type
              grouped[f.infra_type].push({
                name: f.name,
                distance_km: Math.round(f.distance * 10) / 10
              });
            }
          });
          result.infrastructure = {
            total: infraJson.data.length,
            nearest: infraJson.data.slice(0, 3), // Top 3 overall nearest
            grouped
          };
          addLog(`[${symbol}] Found ${infraJson.data.length} nearby infrastructure assets.`, 'success');
        }
      } else {
        addLog(`[${symbol}] No geolocation data for infrastructure scan.`, 'info');
      }
    } catch (e) {
      addLog(`[${symbol}] Infrastructure scan unavailable: ${e.message}`, 'error');
      result.infrastructure = null;
    }

    return result;
  };

  const gatherAllData = async () => {
    const activeSymbols = companies().filter(s => s.trim().length > 0);
    if (activeSymbols.length < 2) {
      setError('Please enter at least 2 company ticker symbols to compare.');
      return null;
    }

    setLoading(true);
    setProgress(5);
    setLogs([]);
    setRawData({});
    setError(null);

    addLog(`Starting parallel data collection for: ${activeSymbols.join(', ')}`);

    try {
      // Fetch all companies in parallel
      const results = await Promise.all(activeSymbols.map(s => fetchCompanyData(s.toUpperCase())));

      const aggregated = {};
      results.forEach(r => { aggregated[r.symbol] = r; });

      setRawData(aggregated);
      setProgress(60);
      addLog(`Data collection complete. ${results.length} companies ready for AI synthesis.`, 'success');

      return aggregated;
    } catch (e) {
      setError(`Data collection failed: ${e.message}`);
      addLog(`Fatal error: ${e.message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    companies, setCompanies,
    rawData, setRawData,
    loading, setLoading,
    progress, setProgress,
    logs, setLogs,
    error, setError,
    gatherAllData,
    addLog,
  };
}
