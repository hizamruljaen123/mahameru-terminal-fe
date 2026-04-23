import { createSignal, onMount, createEffect } from 'solid-js';
import { storage } from '../utils/storage';

export const useCorrelation = () => {
  const [nodes, setNodes] = createSignal([]);
  const [links, setLinks] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [results, setResults] = createSignal([]);
  const [query, setQuery] = createSignal("");
  const [activeNodeId, setActiveNodeId] = createSignal(null);

  onMount(() => {
    const savedNodes = storage.loadNodes();
    const savedLinks = storage.loadLinks();
    if (savedNodes && savedNodes.length > 0) setNodes(savedNodes);
    if (savedLinks && savedLinks.length > 0) setLinks(savedLinks);
  });

  createEffect(() => {
    storage.saveNodes(nodes());
    storage.saveLinks(links());
  });

  const searchEntities = async (q) => {
    if (!q) return;
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/search?q=${encodeURIComponent(q)}`);
      const res = await response.json();
      setResults(res.quotes || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const addNode = (entity) => {
    setNodes(prev => [...prev, {
      id: entity.symbol + '-' + Date.now(),
      name: entity.shortname || entity.longname,
      symbol: entity.symbol,
      type: entity.quoteType,
      x: Math.random() * 200 + 400,
      y: Math.random() * 200 + 200
    }]);
    setResults([]);
    setQuery("");
  };

  const addManualNode = (type, data, parentId = null) => {
    const id = `${type.toLowerCase()}-${Date.now()}`;
    const parentNode = parentId ? nodes().find(n => n.id === parentId) : null;
    
    setNodes(prev => [...prev, {
      id,
      ...data,
      type,
      parentId,
      x: parentNode ? parentNode.x + 350 : Math.random() * 200 + 400,
      y: parentNode ? parentNode.y + (Math.random() * 100 - 50) : Math.random() * 200 + 200
    }]);
  };

  const addNewsNode = (parentId, keyword, newsData) => {
    const parentNode = nodes().find(n => n.id === parentId);
    setNodes(prev => [...prev, {
      id: `news-result-${Date.now()}`,
      parentId: parentId,
      name: `NEWS : ${keyword}`,
      news: newsData,
      type: 'NEWS_RESULT',
      x: (parentNode?.x || 100) + 350,
      y: (parentNode?.y || 100)
    }]);
  };

  const addManagementNodes = (parentId, directors) => {
    const parentNode = nodes().find(n => n.id === parentId);
    const newNodes = directors.map((dir, index) => ({
      id: `mgmt-${Date.now()}-${index}`,
      parentId: parentId,
      name: dir.name,
      title: dir.title,
      type: 'MANAGEMENT_NODE',
      x: (parentNode?.x || 100) + 400,
      y: (parentNode?.y || 100) + (index * 80) - ((directors.length * 80) / 2)
    }));
    setNodes(prev => [...prev, ...newNodes]);
  };

  const addChartNode = (parentId, symbol, historyData, period) => {
    const parentNode = nodes().find(n => n.id === parentId);
    setNodes(prev => [...prev, {
      id: `chart-${Date.now()}`,
      parentId: parentId,
      symbol: symbol,
      name: `CHART: ${symbol} (${period})`,
      history: historyData,
      period: period,
      type: 'CHART_NODE',
      x: (parentNode?.x || 100) + 400,
      y: (parentNode?.y || 100) + 20
    }]);
  };

  const updateNodePosition = (id, x, y) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
  };

  const updateNodeRelationshipSide = (childId, sideType, sideValue) => {
    setNodes(prev => prev.map(n => n.id === childId ? { ...n, [sideType]: sideValue } : n));
  };

  const removeNewsFromNode = (nodeId, newsIndex) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        const newNews = [...n.news];
        newNews.splice(newsIndex, 1);
        return { ...n, news: newNews };
      }
      return n;
    }));
  };

  const removeNode = (id) => {
    setNodes(nodes().filter(n => n.id !== id));
  };

  const fetchNodeNews = async (nodeId, queryStr) => {
    const node = nodes().find(n => n.id === nodeId);
    if (!node) return;
    setLoading(true);
    
    const companyName = node.name || node.symbol || queryStr;
    const symbol = node.symbol || queryStr;

    try {
      const fetchSources = [
          { url: `${import.meta.env.VITE_API_BASE}/api/news/search?q=${encodeURIComponent(companyName)}`, key: 'results' },
          { url: `${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(symbol)}`, key: 'news' },
          { url: `${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(companyName)}`, key: 'news' }
      ];

      const allResults = await Promise.all(
        fetchSources.map(async (src) => {
          try {
            const r = await fetch(src.url);
            const data = await r.json();
            return data[src.key] || [];
          } catch (e) {
            return [];
          }
        })
      );

      const rawNews = allResults.flat();
      
      const seen = new Set();
      const uniqueNews = [];
      for (const item of rawNews) {
          const link = item.link || item.url;
          if (link && !seen.has(link)) {
              seen.add(link);
              uniqueNews.push({
                  ...item,
                  link,
                  title: item.title || "No Title",
                  publisher: item.publisher || item.source || "GNews Intel",
                  time: item.time || item.timestamp
              });
          }
      }
      uniqueNews.sort((a, b) => (b.time || b.timestamp) - (a.time || a.timestamp));

      addNewsNode(nodeId, queryStr, uniqueNews);
    } catch (err) {
      console.error("News fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNodeManagement = async (symbol) => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/profile/${encodeURIComponent(symbol)}`);
      const res = await response.json();
      const data = res.data || res;
      if (data.management) {
        return data.management;
      }
      return [];
    } catch (err) {
      console.error("Management fetch error:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchNodeHistory = async (symbol, period = "1mo") => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/profile/${encodeURIComponent(symbol)}?period=${period}`);
      const res = await response.json();
      const data = res.data || res;
      if (data.history) {
        // Map Close to price for the chart engine
        return data.history.map(h => ({
          price: h.Close || h.price,
          time: h.Date || h.time
        }));
      }
      return [];
    } catch (err) {
      console.error("History fetch error:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const clearCanvas = () => {
    if (confirm("Reset intelligence canvas?")) {
      setNodes([]);
      storage.clear();
    }
  };

  return {
    nodes,
    addLink: (sourceId, targetId) => {
      if (!sourceId || !targetId || sourceId === targetId) return;
      // Prevent duplicate
      if (links().find(l => l.source === sourceId && l.target === targetId)) return;
      setLinks(prev => [...prev, { source: sourceId, target: targetId }]);
    },
    removeLink: (sourceId, targetId) => {
      setLinks(prev => prev.filter(l => !(l.source === sourceId && l.target === targetId)));
    },
    links,
    loading,
    results,
    query,
    setQuery,
    searchEntities,
    addNode,
    addManualNode,
    addNewsNode,
    addManagementNodes,
    addChartNode,
    updateNodePosition,
    updateNodeRelationshipSide,
    removeNewsFromNode,
    removeNode,
    searchAirports: async (q) => {
      if (!q) return [];
      try {
        const response = await fetch(`${import.meta.env.VITE_INFRASTRUCTURE_API}/api/infra/airports/search?q=${encodeURIComponent(q)}&limit=10`);
        const res = await response.json();
        return res;
      } catch (err) {
        console.error("Airport search error:", err);
        return [];
      }
    },
    searchPorts: async (q) => {
      if (!q) return [];
      try {
        const response = await fetch(`${import.meta.env.VITE_PORT_API}/api/infra/ports/search?q=${encodeURIComponent(q)}&limit=10`);
        const res = await response.json();
        return res;
      } catch (err) {
        console.error("Port search error:", err);
        return [];
      }
    },
    searchPowerPlants: async (q) => {
      if (!q) return [];
      try {
        const response = await fetch(`${import.meta.env.VITE_POWER_PLANT_API}/api/power-plants?q=${encodeURIComponent(q)}&page_size=10`);
        const res = await response.json();
        return res.data || [];
      } catch (err) {
        console.error("Power Plant search error:", err);
        return [];
      }
    },
    searchIndustrialZones: async (q) => {
      if (!q) return [];
      try {
        const response = await fetch(`${import.meta.env.VITE_INDUSTRIAL_ZONE_API}/api/industrial-zones?q=${encodeURIComponent(q)}&limit=10`);
        const res = await response.json();
        return res;
      } catch (err) {
        console.error("Industrial Zone search error:", err);
        return [];
      }
    },
    searchTimezones: async (q) => {
      if (!q) return [];
      try {
        const response = await fetch(`${import.meta.env.VITE_GEO_DATA_API}/api/geo/timezone-map`);
        const res = await response.json();
        if (res.status === 'success') {
          return res.data.filter(c => 
            c.name.toLowerCase().includes(q.toLowerCase()) || 
            c.code.toLowerCase().includes(q.toLowerCase())
          ).slice(0, 10);
        }
        return [];
      } catch (err) {
        console.error("Timezone search error:", err);
        return [];
      }
    },
    searchRefineries: async (q) => {
      if (!q) return [];
      try {
        const response = await fetch(`${import.meta.env.VITE_OIL_REFINERY_API}/api/refineries?q=${encodeURIComponent(q)}`);
        const res = await response.json();
        return res.data || [];
      } catch (err) {
        console.error("Refinery search error:", err);
        return [];
      }
    },
    fetchCompanyEvents: async (symbol) => {
      try {
        const response = await fetch(`${import.meta.env.VITE_MARKET_API}/api/market/company-events?symbol=${encodeURIComponent(symbol)}`);
        const res = await response.json();
        return res.events || [];
      } catch (err) {
        console.error("Event fetch error:", err);
        return [];
      }
    },
    fetchGlobalCalendar: async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_MARKET_API}/api/market/calendar`);
        const res = await response.json();
        return res.events || [];
      } catch (err) {
        console.error("Global calendar fetch error:", err);
        return [];
      }
    },
    fetchNodeNews,
    fetchNodeManagement,
    fetchNodeHistory,
    activeNodeId,
    setActiveNodeId,
    clearCanvas,
    loadProject: ({ nodes: newNodes, links: newLinks }) => {
      setActiveNodeId(null);
      setNodes(newNodes || []);
      setLinks(newLinks || []);
    },
  };
};
