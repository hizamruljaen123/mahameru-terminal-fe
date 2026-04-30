import { createSignal } from 'solid-js';

const RESEARCH_API = import.meta.env.VITE_RESEARCH_API;
const MARKET_API = 'https://api.asetpedia.online/market';
const TA_API = 'https://api.asetpedia.online/ta';
const GNEWS_API = 'https://api.asetpedia.online/gnews';

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
      const country = (result.fundamental?.snapshot?.country || 'USA').trim().replace(/\n/g, ' ');
      
      const newsTopics = [
        { key: 'news', q: `${name} Company News latest developments`, label: 'General' },
        { key: 'legalNews', q: `${name} Lawsuit Legal Case Controversy Risk`, label: 'Legal/Risk' },
        { key: 'projectNews', q: `${name} Future Projects Expansion Investment Strategy`, label: 'Expansion' },
        { key: 'leadershipNews', q: `${name} CEO Leadership Management Board`, label: 'Leadership' },
        { key: 'sectorNews', q: `${sector} industry news global outlook trends ${country}`, label: 'Sector Intelligence' }
      ];

      // Fetch all topics in parallel for this company - ALWAYS use English for better data depth
      const newsResults = await Promise.all(newsTopics.map(async (topic) => {
        try {
          const res = await fetchWithTimeout(`${RESEARCH_API}/api/gnews/search?q=${encodeURIComponent(topic.q)}&lang=en&country=US`, 10000);
          const json = await res.json();
          return { key: topic.key, data: json.data || [] };
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
