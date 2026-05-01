import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';
import * as echarts from 'echarts';
import ComparativeView from './research-panel/comparative/ComparativeView';
import { optimizeAIData } from '../utils/aiDataOptimizer';

// We'll dynamically load Marked.js for markdown parsing
const loadMarked = () => {
    return new Promise((resolve) => {
        if (window.marked) return resolve();
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/marked/marked.min.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
};

// We'll dynamically load KaTeX for math rendering
const loadKaTeX = () => {
    return new Promise((resolve) => {
        if (window.renderMathInElement) return resolve();

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/katex@0.16.8/dist/katex.min.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/katex@0.16.8/dist/katex.min.js';
        script.onload = () => {
            const autoRender = document.createElement('script');
            autoRender.src = 'https://unpkg.com/katex@0.16.8/dist/contrib/auto-render.min.js';
            autoRender.onload = () => resolve();
            document.head.appendChild(autoRender);
        };
        document.head.appendChild(script);
    });
};

const loadHtml2Pdf = () => {
    return new Promise((resolve) => {
        if (window.html2pdf) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
};

const REPORT_STYLES = `
  .paper-report {
    background-color: #ffffff;
    color: #1e293b;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border-radius: 4px;
    text-transform: none !important;
  }
  .paper-report * {
    text-transform: none !important;
  }
  .paper-report h1 {
    font-family: 'Outfit', sans-serif;
    font-size: 2.25rem;
    font-weight: 900;
    color: #0f172a !important;
    margin-bottom: 1.5rem;
  }
  .paper-report h2 {
    font-family: 'Outfit', sans-serif;
    font-size: 1.5rem;
    font-weight: 800;
    color: #1e293b !important;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }
  .paper-report h3 {
    font-family: 'Outfit', sans-serif;
    font-size: 1.25rem;
    font-weight: 700;
    color: #0369a1 !important;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }
  .paper-report p {
    font-size: 0.95rem;
    line-height: 1.8;
    margin-bottom: 1.25rem;
    color: #334155 !important;
  }
  .paper-report ul, .paper-report ol {
    margin-bottom: 1.25rem;
    padding-left: 1.5rem;
  }
  .paper-report li {
    margin-bottom: 0.5rem;
  }
  .paper-report strong {
    color: #0284c7;
    font-weight: 700;
  }
`;

export default function ResearchPanelView() {
    const RESEARCH_API = import.meta.env.VITE_RESEARCH_API;
    const [mode, setMode] = createSignal('single'); // 'single' | 'comparative'

    const [symbol, setSymbol] = createSignal('');
    const [model, setModel] = createSignal('deepseek-v4-flash');
    const [loading, setLoading] = createSignal(false);
    const [progress, setProgress] = createSignal(0);
    const [caveman, setCaveman] = createSignal(false);
    const [logs, setLogs] = createSignal([]);
    const [fullData, setFullData] = createSignal(null);
    const [chartPeriod, setChartPeriod] = createSignal('1y');
    const [activeFundTab, setActiveFundTab] = createSignal('valuation');
    const [recommendations, setRecommendations] = createSignal([]);
    const [taData, setTaData] = createSignal(null);
    const [activeView, setActiveView] = createSignal('new'); // 'new' | 'history'
    const [history, setHistory] = createSignal([]);
    const [language, setLanguage] = createSignal('id');

    // AI generated sections
    const [reports, setReports] = createSignal({
        1: '', 2: '', 3: '', 4: '', 5: ''
    });

    const [availableModels, setAvailableModels] = createSignal([
        { "id": "deepseek-v4-flash", "name": "DeepSeek V4 Flash", "provider": "DeepSeek" },
        { "id": "deepseek-v4-pro", "name": "DeepSeek V4 Pro", "provider": "DeepSeek" },
        { "id": "deepseek-chat", "name": "DeepSeek Chat", "provider": "DeepSeek" },
        { "id": "deepseek-reasoner", "name": "DeepSeek Reasoner (R1)", "provider": "DeepSeek" },
        { "id": "deepseek-r1", "name": "DeepSeek R1", "provider": "DeepSeek" },
        { "id": "gpt-5.5", "name": "GPT 5.5", "provider": "OpenAI" },
        { "id": "gpt-5.4-mini", "name": "GPT 5.4-Mini", "provider": "OpenAI" },
        { "id": "kimi-k2.5", "name": "Kimi k2.5", "provider": "Moonshot AI" },
        { "id": "minimax-m2.7", "name": "Minimax m2.7", "provider": "Minimax" },
        { "id": "gemini-flash-latest", "name": "Gemini 3 Flash", "provider": "Google" },
    ]);

    let myChart;
    let rsiChart;
    let macdChart;
    let chartContainer;
    let rsiContainer;
    let macdContainer;
    let reportContainerRef; // for PDF

    const addLog = (msg) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const handleLoadZIP = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Load JSZip
        await new Promise(resolve => {
            if (window.JSZip) return resolve();
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            s.onload = resolve;
            document.head.appendChild(s);
        });

        try {
            const zip = await window.JSZip.loadAsync(file);
            const dataFile = zip.file('data_bundle.json') || zip.file('data.json');
            if (!dataFile) throw new Error("Invalid format: data_bundle.json not found.");

            const content = await dataFile.async('string');
            const pkg = JSON.parse(content);
            const actualRawData = pkg.rawData || pkg.raw_data;

            if (actualRawData) {
                // Determine symbol from data
                const sym = Object.keys(actualRawData)[0];
                if (sym) {
                    setSymbol(sym);
                    setFullData(actualRawData[sym]);
                    setReports(pkg.reports || {});
                    setLanguage(pkg.language || pkg.metadata?.language || 'id');
                    setModel(pkg.model || pkg.metadata?.model || 'deepseek-v4-flash');
                }
            }
        } catch (e) {
            console.error("ZIP load error:", e);
        }
        event.target.value = '';
    };

    const handleExportZIP = async () => {
        if (!fullData() || !reports()[1]) return;

        await new Promise(resolve => {
            if (window.JSZip) return resolve();
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            s.onload = resolve;
            document.head.appendChild(s);
        });

        const zip = new window.JSZip();
        const filename = `${symbol()}_Research_Bundle_${new Date().toISOString().split('T')[0]}`;

        const bundle = {
            metadata: {
                symbol: symbol(),
                timestamp: new Date().toISOString(),
                model: model(),
                language: language()
            },
            reports: reports(),
            rawData: { [symbol()]: fullData() },
            language: language(),
            model: model()
        };

        zip.file("data_bundle.json", JSON.stringify(bundle, null, 2));
        
        // Static HTML Archive
        const el = document.getElementById('report-container');
        if (el) {
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${symbol()} Analysis</title><style>body{font-family:sans-serif;padding:40px;color:#334155;max-width:800px;margin:0 auto;}${REPORT_STYLES}</style></head><body>${el.innerHTML}</body></html>`;
            zip.file("report_archive.html", html);
        }

        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `${filename}.zip`;
        link.click();
    };

    onMount(async () => {
        await Promise.all([loadMarked(), loadHtml2Pdf(), loadKaTeX()]);
        loadHistory();
        fetchModels();
    });



    const loadHistory = () => {
        const saved = localStorage.getItem('asetpedia_single_history');
        if (saved) {
            try { setHistory(JSON.parse(saved)); } catch (_) { setHistory([]); }
        }
    };

    const saveToHistory = () => {
        if (!symbol() || !reports()[5]) return;
        const newItem = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            symbol: symbol(),
            reports: reports(),
            fullData: fullData(),
            taData: taData(),
            language: language()
        };
        setHistory(prev => {
            const updated = [newItem, ...prev.filter(i => i.symbol !== symbol())].slice(0, 10);
            localStorage.setItem('asetpedia_single_history', JSON.stringify(updated));
            return updated;
        });
    };

    const loadHistoryItem = (item) => {
        setActiveView('new');
        setSymbol(item.symbol);
        setFullData(item.fullData);
        setReports(item.reports);
        setTaData(item.taData);
        setLanguage(item.language || 'id');
        addLog(`✓ Loaded archived research for ${item.symbol}.`);
    };

    const fetchModels = async () => {
        try {
            const res = await fetch(`${RESEARCH_API}/api/models`);
            const json = await res.json();
            if (json.data && Array.isArray(json.data)) {
                setAvailableModels(json.data);
            }
        } catch (e) {
            console.error("Failed to fetch models", e);
        }
    };

    createEffect(() => {
        const data = fullData();
        if (data && data.market && data.market.historical) {
            setTimeout(() => {
                renderChart(data.market.historical);
            }, 300);
        }
    });

    createEffect(() => {
        const rs = reports();
        if (Object.keys(rs).some(k => rs[k].length > 0)) {
            setTimeout(() => {
                const containers = document.querySelectorAll('.paper-report');
                containers.forEach(container => {
                    if (window.renderMathInElement) {
                        window.renderMathInElement(container, {
                            delimiters: [
                                { left: '$$', right: '$$', display: true },
                                { left: '$', right: '$', display: false },
                                { left: '\\(', right: '\\)', display: false },
                                { left: '\\[', right: '\\]', display: true }
                            ],
                            throwOnError: false
                        });
                    }
                });
            }, 200);
        }
    });

    const formatNumber = (num) => {
        if (num == null) return 'N/A';
        if (Math.abs(num) >= 1e12) return (num / 1e12).toFixed(2) + ' T';
        if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + ' B';
        if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + ' M';
        return num.toLocaleString();
    };

    const fetchMarketChart = async (sym, period) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_TA_URL}/api/ta/analyze/${sym}?period=${period}`);
            const json = await res.json();
            if (!json.error) {
                setTaData(json);
                renderChart(json);
            }
        } catch (e) {
            console.error("Failed to fetch chart", e);
        }
    };

    const renderChart = (taResponse) => {
        if (!chartContainer || !taResponse) return;
        if (!myChart) myChart = echarts.init(chartContainer);
        if (!rsiContainer) return;
        if (!rsiChart) rsiChart = echarts.init(rsiContainer);
        if (!macdContainer) return;
        if (!macdChart) macdChart = echarts.init(macdContainer);

        const dates = taResponse.dates;
        const ohlcv = taResponse.ohlcv;
        const ind = taResponse.indicators;

        const data = dates.map((_, i) => [
            ohlcv.open[i], ohlcv.close[i], ohlcv.low[i], ohlcv.high[i]
        ]);

        const makeLine = (arr, name, color, width = 1, type = 'solid') => ({
            name, type: 'line', data: arr, symbol: 'none', smooth: true,
            lineStyle: { color, width, type }, z: 3
        });

        // 1. Main Price Chart
        myChart.setOption({
            backgroundColor: 'transparent',
            animation: false,
            tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
            legend: { data: ['Price', 'SMA20', 'SMA50', 'EMA200', 'BB Upper', 'BB Lower'], textStyle: { color: '#64748b', fontSize: 10 }, top: 0 },
            grid: [{ left: '8%', right: '5%', top: '15%', bottom: '25%' }, { left: '8%', right: '5%', top: '80%', bottom: '5%' }],
            xAxis: [
                { type: 'category', data: dates, boundaryGap: false, gridIndex: 0, axisLine: { lineStyle: { color: '#e2e8f0' } } },
                { type: 'category', data: dates, boundaryGap: false, gridIndex: 1, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { show: false } }
            ],
            yAxis: [{ scale: true, splitArea: { show: true }, gridIndex: 0 }, { gridIndex: 1, show: false }],
            dataZoom: [{ type: 'inside', xAxisIndex: [0, 1], start: 70, end: 100 }, { show: true, xAxisIndex: [0, 1], type: 'slider', top: '92%', start: 70, end: 100 }],
            series: [
                { name: 'Price', type: 'candlestick', data: data, itemStyle: { color: '#10b981', color0: '#ef4444', borderColor: '#10b981', borderColor0: '#ef4444' } },
                { name: 'Volume', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: ohlcv.volume, itemStyle: { color: '#cbd5e1' } },
                makeLine(ind.sma.sma20, 'SMA20', '#f59e0b', 1.5),
                makeLine(ind.sma.sma50, 'SMA50', '#3b82f6', 1.5),
                makeLine(ind.ema.ema200, 'EMA200', '#6366f1', 1.5, 'dashed'),
                makeLine(ind.bb.upper, 'BB Upper', '#94a3b8', 1, 'dotted'),
                makeLine(ind.bb.lower, 'BB Lower', '#94a3b8', 1, 'dotted')
            ]
        }, true);

        // 2. RSI Chart
        rsiChart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis' },
            grid: { left: '8%', right: '5%', top: '10%', bottom: '20%' },
            xAxis: { type: 'category', data: dates, axisLabel: { show: false } },
            yAxis: { min: 0, max: 100, splitLine: { lineStyle: { type: 'dashed' } } },
            series: [
                {
                    name: 'RSI(14)', type: 'line', data: ind.rsi.rsi14, symbol: 'none',
                    lineStyle: { color: '#8b5cf6', width: 1.5 },
                    markLine: {
                        silent: true, symbol: 'none',
                        data: [{ yAxis: 70, lineStyle: { color: '#f87171' } }, { yAxis: 30, lineStyle: { color: '#4ade80' } }]
                    }
                }
            ]
        }, true);

        // 3. MACD Chart
        const macd = ind.macd;
        macdChart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis' },
            grid: { left: '8%', right: '5%', top: '10%', bottom: '20%' },
            xAxis: { type: 'category', data: dates, axisLabel: { show: false } },
            yAxis: { scale: true },
            series: [
                { name: 'MACD', type: 'line', data: macd.line, symbol: 'none', lineStyle: { width: 1.5, color: '#3b82f6' } },
                { name: 'Signal', type: 'line', data: macd.signal, symbol: 'none', lineStyle: { width: 1, color: '#f59e0b' } },
                {
                    name: 'Hist', type: 'bar', data: macd.hist,
                    itemStyle: { color: (params) => params.value >= 0 ? '#10b98166' : '#ef444466' }
                }
            ]
        }, true);

        // Synchronize charts
        echarts.connect([myChart, rsiChart, macdChart]);
    };

    const fetchSuggestions = async (q) => {
        if (!q || q.trim().length < 1) {
            setRecommendations([]);
            return;
        }
        try {
            const res = await fetch(`${RESEARCH_API}/api/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            if (data.status === 'success' && data.data) {
                // Filter for stocks only, matching CompanySelector logic
                const filtered = (data.data || []).filter(item =>
                    ['EQUITY', 'EQUITY_STOCK', 'COMMONSTOCK'].includes(item.quoteType?.toUpperCase()) ||
                    ['EQUITY', 'STOCK'].includes(item.typeDisp?.toUpperCase())
                );
                setRecommendations(filtered);
            } else {
                setRecommendations([]);
            }
        } catch (e) {
            setRecommendations([]);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!symbol()) return;

        setLoading(true);
        setProgress(10);
        setLogs([]);
        setFullData(null);
        setReports({ 1: '', 2: '', 3: '', 4: '', 5: '' });
        setRecommendations([]);
        setTaData(null);

        let aggregatedData = { symbol: symbol() };

        try {
            // 1. Fundamental
            addLog("Fetching Fundamental Data...");
            const fRes = await fetch(`${RESEARCH_API}/api/data/fundamental?symbol=${symbol()}`);
            const fData = await fRes.json();
            if (fData.status === 'success') {
                aggregatedData.fundamental = fData.data;
                setProgress(30);
            }

            // 2. Market (Baseline 1y for AI)
            addLog("Fetching Market Data...");
            const mRes = await fetch(`${RESEARCH_API}/api/data/market?symbol=${symbol()}`);
            const mData = await mRes.json();
            if (mData.status === 'success') {
                aggregatedData.market = mData.data;
                setProgress(50);
            }

            // 3.5 TA Analysis
            addLog("Executing Advanced Technical Analysis...");
            try {
                const taRes = await fetch(`${import.meta.env.VITE_TA_URL}/api/ta/analyze/${symbol()}?period=6mo`);
                const taJson = await taRes.json();
                if (!taJson.error) {
                    aggregatedData.ta = taJson;
                    setTaData(taJson);
                }
            } catch (e) {
                console.error("TA fetch failed", e);
            }

            // 3.6 News & Sentiment
            addLog("Fetching News Intelligence & Sentiment...");
            try {
                const sRes = await fetch(`${RESEARCH_API}/api/data/news?symbol=${symbol()}`);
                const sJson = await sRes.json();
                if (sJson.status === 'success') {
                    aggregatedData.news = sJson.data.news || [];
                    aggregatedData.sentiment = sJson.data.sentiment || {};
                }
            } catch (e) {
                console.error("Failed to fetch news/sentiment", e);
            }

            // 3.7 Extended News Scan (Legal, Leadership, etc.)
            addLog("Performing deep institutional news scan...");
            try {
                const name = (aggregatedData.fundamental?.snapshot?.name || symbol()).trim();
                const country = (aggregatedData.fundamental?.snapshot?.country || 'USA').trim();
                const sector = (aggregatedData.fundamental?.snapshot?.sector || 'industry').trim();
                
                const topics = [
                    { key: 'legalNews', q: `${name} Lawsuit Legal Case Controversy Risk` },
                    { key: 'projectNews', q: `${name} Future Projects Expansion Investment Strategy` },
                    { key: 'leadershipNews', q: `${name} CEO Leadership Management Board news` },
                    { key: 'sectorNews', q: `${sector} industry news global outlook trends ${country}` }
                ];

                const newsResults = await Promise.all(topics.map(async (topic) => {
                    const res = await fetch(`${RESEARCH_API}/api/gnews/search?q=${encodeURIComponent(topic.q)}&lang=en&country=US`);
                    const json = await res.json();
                    return { key: topic.key, data: json.data || [] };
                }));

                newsResults.forEach(res => {
                    aggregatedData[res.key] = res.data;
                });
            } catch (e) {
                console.error("Deep news scan failed", e);
            }

            const optimizedData = optimizeAIData(aggregatedData);
            setFullData(aggregatedData);

            // 4. Sequential AI Generation
            let generatedStages = {};
            for (let stage = 1; stage <= 5; stage++) {
                addLog(`Generating Stage ${stage}...`);
                setProgress(70 + (stage * 6));

                const repRes = await fetch(`${RESEARCH_API}/api/analyze/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        symbol: symbol(),
                        stage: stage,
                        model: model(),
                        full_data: optimizedData,
                        generated_stages: generatedStages,
                        caveman: caveman()
                    })
                });

                const reader = repRes.body.getReader();
                const decoder = new TextDecoder();
                let stageText = '';
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    let boundary = buffer.indexOf('\n');
                    while (boundary !== -1) {
                        const line = buffer.substring(0, boundary).trim();
                        buffer = buffer.substring(boundary + 1);

                        if (line.startsWith('data: ')) {
                            try {
                                const obj = JSON.parse(line.substring(6));
                                if (obj.content) {
                                    stageText += obj.content;
                                    setReports(prev => ({ ...prev, [stage]: window.marked ? window.marked.parse(stageText) : stageText }));
                                }
                            } catch (e) { }
                        }
                        boundary = buffer.indexOf('\n');
                    }
                }
                generatedStages[stage] = stageText;
            }

            setProgress(100);
            addLog("Synthesis Complete.");
            saveToHistory();

        } catch (err) {
            addLog(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleExportMD = () => {
        if (!reports()[5]) return;
        const fullContent = Object.values(reports()).join('\n\n---\n\n');
        const blob = new Blob([fullContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Asetpedia_Research_${symbol()}_${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog("Markdown Report Exported.");
    };

    const handleSavePDF = async () => {
        const el = reportContainerRef;
        if (!window.html2pdf || !el) return;

        addLog("Initializing institutional PDF engine...");

        // 1. Create Iframe Sandbox
        const iframe = document.createElement('iframe');
        Object.assign(iframe.style, {
            position: 'fixed',
            left: '-10000px',
            top: '0',
            width: '1200px',
            height: '1000px'
        });
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        const reportHtml = el.innerHTML;

        // 2. Build complete document
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
                body { background: white; margin: 0; padding: 60px; font-family: 'Roboto', sans-serif; }
                .paper-report { background: white; color: #1e293b; width: 100%; }
                .paper-report h1 { font-family: 'Outfit', sans-serif; font-size: 2.25rem; font-weight: 900; color: #0f172a; margin-bottom: 1.5rem; }
                .paper-report h2 { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 800; color: #1e293b; margin-top: 2rem; margin-bottom: 1rem; }
                .paper-report h3 { font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 700; color: #0369a1; margin-top: 1.5rem; margin-bottom: 0.75rem; }
                .paper-report p, .paper-report li { font-size: 0.95rem; line-height: 1.8; margin-bottom: 1.25rem; color: #334155; text-align: justify; }
                .paper-report table { width: 100%; font-size: 0.85rem; border-collapse: collapse; margin-bottom: 1.5rem; }
                .paper-report th { background: #f8fafc; color: #0f172a; font-weight: 700; padding: 0.75rem; border-bottom: 2px solid #cbd5e1; }
                .paper-report td { padding: 0.75rem; border-bottom: 1px solid #e2e8f0; color: #475569; }
                .section-title { font-size: 1rem; font-weight: 800; color: #0284c7; border-bottom: 1.5px solid #0284c7; padding-bottom: 4px; margin-top: 2rem; margin-bottom: 1rem; }
                .img-snapshot { width: 100%; height: auto; display: block; margin: 20px 0; border: 1px solid #eee; }
                canvas { display: none !important; }
            </style>
          </head>
          <body>
            <div class="paper-report">${reportHtml}</div>
          </body>
          </html>
        `);
        doc.close();

        // 3. Sync Canvases
        const origCanvases = el.querySelectorAll('canvas');
        const iframeCanvases = doc.querySelectorAll('canvas');
        origCanvases.forEach((canvas, i) => {
            try {
                const img = doc.createElement('img');
                img.src = canvas.toDataURL('image/png', 1.0);
                img.className = 'img-snapshot';
                if (iframeCanvases[i]) {
                    iframeCanvases[i].parentNode.replaceChild(img, iframeCanvases[i]);
                }
            } catch (e) { }
        });

        // 4. Capture
        const opt = {
            margin: [10, 10, 10, 10],
            filename: `${symbol()}_Research_Report.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: 1200,
                windowWidth: 1200
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            addLog("Generating institutional document...");
            await new Promise(r => setTimeout(r, 1000));
            await window.html2pdf().set(opt).from(doc.body).save();
            addLog("PDF Export Complete.");
        } catch (err) {
            addLog(`PDF Export Failed: ${err.message}`, 'error');
        } finally {
            document.body.removeChild(iframe);
        }
    };

    return (
        <div class="flex-1 flex flex-col bg-bg_main overflow-hidden text-text_primary text-[10px] relative">

            {/* Header + Mode Tabs */}
            <div class="px-6 py-3 bg-bg_sidebar border-b border-border_main flex justify-between items-center shrink-0">
                <div class="flex items-center gap-4">
                    <h2 class="text-[13px] font-black text-text_accent tracking-widest uppercase">Intelligence Terminal</h2>
                </div>
                <div class="flex items-center gap-1 bg-black/40 p-1 rounded border border-white/5">
                    <button
                        onClick={() => setMode('single')}
                        class={`px-4 py-1.5 text-[9px] font-black tracking-widest rounded-sm transition-all ${mode() === 'single' ? 'bg-text_accent text-bg_main' : 'text-white/30 hover:text-white'
                            }`}
                    >
                        Single Analysis
                    </button>
                    <button
                        onClick={() => setMode('comparative')}
                        class={`px-4 py-1.5 text-[9px] font-black tracking-widest rounded-sm transition-all ${mode() === 'comparative' ? 'bg-text_accent text-bg_main' : 'text-white/30 hover:text-white'
                            }`}
                    >
                        ⊕ Comparative
                    </button>
                </div>
            </div>

            {/* Route to views */}
            <Show when={mode() === 'comparative'}>
                <ComparativeView />
            </Show>

            <Show when={mode() === 'single'}>
                {/* Progress Bar */}
                <Show when={progress() > 0 && progress() < 100}>
                    <div class="h-1 w-full bg-bg_sidebar">
                        <div class="h-full bg-text_accent transition-all duration-300" style={{ width: `${progress()}%` }}></div>
                    </div>
                </Show>

                <div class="flex-1 flex overflow-hidden">
                    {/* Left Sidebar: Context & Data Modules */}
                    <div class="w-[300px] border-r border-border_main flex flex-col bg-bg_sidebar overflow-y-auto win-scroll p-4 gap-4 shrink-0">

                        <div class="glass-panel p-3 flex flex-col gap-3">
                            <h3 class="text-[8px] font-black text-text_accent/50 tracking-[0.4em] border-b border-border_main pb-1">
                                Asset Context
                            </h3>
                            <form onSubmit={handleSearch} class="flex flex-col gap-3">
                                <div class="relative">
                                    <label class="text-[8px] text-text_secondary font-black block mb-1">Enter Ticker</label>
                                    <input
                                        type="text"
                                        class="w-full bg-black border border-border_main px-3 py-2 text-[11px] font-mono text-white outline-none focus:border-text_accent uppercase"
                                        placeholder="e.g., BBCA.JK, AAPL"
                                        value={symbol()}
                                        onInput={(e) => setSymbol(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                fetchSuggestions(symbol());
                                            }
                                        }}
                                        disabled={loading()}
                                    />
                                    <Show when={recommendations().length > 0}>
                                        <div class="absolute z-50 bg-bg_sidebar border border-border_main w-full max-h-48 overflow-y-auto mt-1 flex flex-col shadow-2xl win-scroll">
                                            <div class="bg-white/5 px-3 py-1 text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">Select Match</div>
                                            <For each={recommendations()}>
                                                {(rec) => (
                                                    <button
                                                        type="button"
                                                        class="text-left px-3 py-2 text-[9px] hover:bg-text_accent hover:text-bg_main font-mono border-b border-border_main/30 text-white transition-colors flex flex-col gap-0.5"
                                                        onClick={() => {
                                                            setSymbol(rec.symbol);
                                                            setRecommendations([]);
                                                        }}
                                                    >
                                                        <div class="flex items-center justify-between">
                                                            <span class="font-black text-text_accent uppercase">{rec.symbol}</span>
                                                            <span class="text-[7px] opacity-40 italic">{rec.typeDisp || rec.quoteType || rec.type || 'Equity'}</span>
                                                        </div>
                                                        <div class="text-[10px] font-bold text-white/90 truncate uppercase tracking-tight">
                                                            {rec.shortname || rec.longname || rec.name || 'Unknown Company'}
                                                        </div>
                                                    </button>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </div>
                                {/* AI Settings - Compact */}
                                <div class="glass-panel p-2 flex flex-col gap-2">
                                    <div class="grid grid-cols-2 gap-2">
                                        <div class="flex flex-col gap-1">
                                            <label class="text-[7px] font-black text-text_accent/50 uppercase tracking-widest">Engine</label>
                                            <select
                                                class="bg-black border border-border_main px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-text_accent"
                                                value={model()}
                                                onChange={(e) => setModel(e.target.value)}
                                                disabled={loading()}
                                            >
                                                <For each={availableModels()}>
                                                    {(m) => <option value={m.id}>{m.name || m.id}</option>}
                                                </For>
                                            </select>
                                        </div>
                                        <div class="flex flex-col gap-1">
                                            <label class="text-[7px] font-black text-text_accent/50 uppercase tracking-widest">Language</label>
                                            <select
                                                class="bg-black border border-border_main px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-text_accent"
                                                value={language()}
                                                onChange={(e) => setLanguage(e.target.value)}
                                                disabled={loading()}
                                            >
                                                <option value="en">EN</option>
                                                <option value="id">ID</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div class="flex items-center justify-between bg-white/5 p-1.5 border border-white/5 rounded-sm">
                                        <div class="flex flex-col">
                                            <span class="text-[8px] font-black text-text_accent leading-none uppercase">Token Saver</span>
                                            <span class="text-[6px] text-white/20 uppercase">Save ~65% Tokens</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCaveman(!caveman())}
                                            class={`w-7 h-3.5 rounded-full transition-all relative ${caveman() ? 'bg-text_accent' : 'bg-white/10'}`}
                                        >
                                            <div class={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${caveman() ? 'left-4' : 'left-0.5'}`}></div>
                                        </button>
                                    </div>
                                </div>
                                {/* Institutional Command Hub */}
                                <div class="glass-panel p-3 flex flex-col gap-3">
                                    <h3 class="text-[8px] font-black text-text_accent/50 tracking-[0.4em] border-b border-border_main pb-2 uppercase">
                                        Command Hub
                                    </h3>
                                    <div class="grid grid-cols-3 gap-2">
                                        <button
                                            type="submit"
                                            disabled={loading() || !symbol()}
                                            class={`flex flex-col items-center justify-center gap-1.5 p-2 rounded border transition-all ${loading() ? 'bg-text_accent/20 border-text_accent animate-pulse' : 'bg-white/5 border-white/10 hover:border-text_accent/50 hover:bg-white/10'} disabled:opacity-30 group`}
                                            title="Start Analysis"
                                        >
                                            <svg class={`w-4 h-4 ${loading() ? 'text-text_accent animate-spin' : 'text-white/60 group-hover:text-text_accent'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                            <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">Analyze</span>
                                        </button>

                                        <button
                                            type="button"
                                            disabled={loading() || (!fullData() && !reports()[1])}
                                            onClick={handleSavePDF}
                                            class="flex flex-col items-center justify-center gap-1.5 p-2 rounded border bg-white/5 border-white/10 hover:border-rose-400/50 hover:bg-rose-400/10 transition-all disabled:opacity-30 group"
                                            title="Export PDF"
                                        >
                                            <svg class="w-4 h-4 text-white/60 group-hover:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">PDF</span>
                                        </button>

                                        <button
                                            type="button"
                                            disabled={loading() || !reports()[5]}
                                            onClick={handleExportMD}
                                            class="flex flex-col items-center justify-center gap-1.5 p-2 rounded border bg-white/5 border-white/10 hover:border-emerald-400/50 hover:bg-emerald-400/10 transition-all disabled:opacity-30 group"
                                            title="Export Markdown"
                                        >
                                            <svg class="w-4 h-4 text-white/60 group-hover:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">MD</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => { setSymbol(''); setFullData(null); setReports({}); }}
                                            disabled={loading()}
                                            class="flex flex-col items-center justify-center gap-1.5 p-2 rounded border bg-white/5 border-white/10 hover:border-blue-400/50 hover:bg-blue-400/10 transition-all disabled:opacity-30 group"
                                            title="New Research"
                                        >
                                            <svg class="w-4 h-4 text-white/60 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">New</span>
                                        </button>
                                        
                                        <button
                                            type="button"
                                            onClick={() => setActiveView('history')}
                                            class="flex flex-col items-center justify-center gap-1.5 p-2 rounded border bg-white/5 border-white/10 hover:border-amber-400/50 hover:bg-amber-400/10 transition-all group"
                                            title="History"
                                        >
                                            <svg class="w-4 h-4 text-white/60 group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">History</span>
                                        </button>

                                        <button
                                            type="button"
                                            disabled={loading() || !reports()[1]}
                                            onClick={handleExportZIP}
                                            class="flex flex-col items-center justify-center gap-1.5 p-2 rounded border bg-white/5 border-white/10 hover:border-amber-400/50 hover:bg-amber-400/10 transition-all disabled:opacity-30 group"
                                            title="Export ZIP"
                                        >
                                            <svg class="w-4 h-4 text-white/60 group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                            </svg>
                                            <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">ZIP</span>
                                        </button>

                                        <div class="relative group">
                                            <input
                                                type="file"
                                                accept=".zip"
                                                onChange={handleLoadZIP}
                                                disabled={loading()}
                                                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                                            />
                                            <div class="flex flex-col items-center justify-center gap-1.5 p-2 rounded border bg-white/5 border-white/10 group-hover:border-emerald-400/50 group-hover:bg-emerald-400/10 transition-all opacity-100 group-disabled:opacity-30 h-full">
                                                <svg class="w-4 h-4 text-white/60 group-hover:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                </svg>
                                                <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">Load</span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => window.print()}
                                            class="flex flex-col items-center justify-center gap-1.5 p-2 rounded border bg-white/5 border-white/10 hover:border-sky-400/50 hover:bg-sky-400/10 transition-all group"
                                            title="Print Report"
                                        >
                                            <svg class="w-4 h-4 text-white/60 group-hover:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                            </svg>
                                            <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">Print</span>
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <Show when={reports()[1] || fullData()}>
                            <div class="glass-panel p-3">
                                <h3 class="text-[9px] font-black text-text_accent tracking-widest border-b border-border_main pb-1 mb-2">Report Bookmarks</h3>
                                <div class="flex flex-col gap-1.5 text-[10px] font-bold text-text_secondary">
                                    <a href="#ai-stage-1" class="hover:text-text_accent transition-colors flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-text_accent"></span> 1. Business Overview</a>
                                    <a href="#ai-stage-2" class="hover:text-text_accent transition-colors flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-text_accent"></span> 2. Fundamentals Deep-Dive</a>
                                    <a href="#ai-stage-3" class="hover:text-text_accent transition-colors flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-text_accent"></span> 3. Technical Setup</a>
                                    <a href="#ai-stage-4" class="hover:text-text_accent transition-colors flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-text_accent"></span> 4. Catalyst Highlights</a>
                                    <a href="#ai-stage-5" class="hover:text-text_accent transition-colors flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-text_accent"></span> 5. Final Recommendations</a>
                                </div>
                            </div>
                        </Show>

                        <div class="glass-panel p-3 flex flex-col gap-2">
                            <h3 class="text-[8px] font-black text-text_accent/50 tracking-[0.4em] border-b border-border_main pb-1 flex justify-between items-center">
                                Quick History
                                <button onClick={() => setActiveView('history')} class="text-text_accent hover:underline text-[7px] uppercase tracking-widest">View All</button>
                            </h3>
                            <div class="flex flex-col gap-1.5">
                                <For each={history().slice(0, 3)}>
                                    {(item) => (
                                        <div class="bg-black/40 border border-white/5 p-2 rounded flex flex-col gap-1 cursor-pointer hover:border-text_accent/30 transition-all" onClick={() => loadHistoryItem(item)}>
                                            <div class="flex items-center justify-between">
                                                <span class="text-[8px] font-black text-white/80">{item.symbol}</span>
                                                <span class="text-[6px] text-white/20">{new Date(item.timestamp).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    )}
                                </For>
                                <Show when={history().length === 0}>
                                    <div class="text-[7px] text-white/10 uppercase italic p-2">No history recorded</div>
                                </Show>
                            </div>
                        </div>
                    </div>
                    <div class="flex-1 flex flex-col overflow-hidden bg-[#090d15]">

                        {/* Main View Switcher */}
                        <div class="shrink-0 h-12 border-b border-white/5 bg-black/40 flex items-center px-6 gap-8">
                            <button
                                onClick={() => setActiveView('new')}
                                class={`h-full flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-all border-b-2 ${activeView() === 'new' ? 'text-text_accent border-text_accent' : 'text-white/20 border-transparent hover:text-white'}`}
                            >
                                <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                                Research Workspace
                            </button>
                            <button
                                onClick={() => setActiveView('history')}
                                class={`h-full flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-all border-b-2 ${activeView() === 'history' ? 'text-text_accent border-text_accent' : 'text-white/20 border-transparent hover:text-white'}`}
                            >
                                <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                                Research Timeline
                            </button>
                        </div>

                        <div class="flex-1 overflow-y-auto win-scroll p-8">
                            <style>{REPORT_STYLES}</style>

                            <Show when={activeView() === 'history'}>
                                <div class="max-w-5xl mx-auto w-full flex flex-col gap-6 py-10">
                                    <h2 class="text-2xl font-black text-white tracking-[0.3em] uppercase border-b border-white/5 pb-4 mb-4">Research Archive</h2>
                                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <For each={history()}>
                                            {(item) => (
                                                <div class="glass-panel p-6 flex flex-col gap-4 hover:border-text_accent/50 transition-all cursor-pointer group" onClick={() => loadHistoryItem(item)}>
                                                    <div class="flex justify-between items-start">
                                                        <div class="flex flex-col">
                                                            <span class="text-2xl font-black text-text_accent group-hover:scale-105 transition-transform">{item.symbol}</span>
                                                            <span class="text-[9px] text-text_secondary uppercase tracking-widest">{new Date(item.timestamp).toLocaleString()}</span>
                                                        </div>
                                                        <div class="px-2 py-1 bg-text_accent/10 border border-text_accent/20 rounded text-[8px] font-bold text-text_accent uppercase">Report Saved</div>
                                                    </div>
                                                    <div class="mt-4 flex items-center justify-between text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                                        <span>{item.language === 'id' ? 'Bahasa Indonesia' : 'English'}</span>
                                                        <span class="text-text_accent group-hover:translate-x-2 transition-transform">Load Analysis →</span>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                        <Show when={history().length === 0}>
                                            <div class="col-span-full py-20 flex flex-col items-center justify-center text-white/10 text-center gap-4">
                                                <div class="w-16 h-16 border-2 border-dashed border-white/5 rounded-full flex items-center justify-center text-4xl">∅</div>
                                                <div class="text-[10px] font-black uppercase tracking-[0.3em]">No saved research found in archive</div>
                                            </div>
                                        </Show>
                                    </div>
                                </div>
                            </Show>

                            <Show when={activeView() === 'new'}>
                                {/* Execution Logs in Main Area */}
                                <Show when={loading() && !reports()[1]}>
                                    <div class="max-w-4xl mx-auto w-full my-auto flex flex-col gap-6 animate-in fade-in duration-700">
                                        <div class="flex flex-col items-center justify-center text-center gap-4">
                                            <div class="w-20 h-20 border-2 border-text_accent/20 rounded-full flex items-center justify-center relative">
                                                <div class="absolute inset-0 border-t-2 border-text_accent rounded-full animate-spin"></div>
                                                <span class="text-[10px] font-black text-text_accent tracking-[0.2em]">{progress()}%</span>
                                            </div>
                                            <div class="flex flex-col">
                                                <h2 class="text-xl font-black text-white tracking-[0.3em] uppercase">Intelligence Synthesis</h2>
                                                <p class="text-[10px] text-text_secondary tracking-[0.2em] uppercase opacity-50">Fetching institutional data for {symbol()}</p>
                                            </div>
                                        </div>

                                        <div class="glass-panel p-6 bg-black/80 border border-text_accent/20 rounded-lg shadow-[0_0_50px_rgba(0,186,255,0.1)]">
                                            <div class="flex items-center gap-2 border-b border-white/10 pb-3 mb-4">
                                                <div class="w-2 h-2 rounded-full bg-red-500"></div>
                                                <div class="w-2 h-2 rounded-full bg-yellow-500"></div>
                                                <div class="w-2 h-2 rounded-full bg-green-500"></div>
                                                <span class="ml-2 text-[10px] font-mono text-text_secondary opacity-40 uppercase tracking-widest">Execution Terminal_v4.0</span>
                                            </div>
                                            <div class="flex flex-col gap-2 font-mono text-[11px] h-[300px] overflow-y-auto win-scroll pr-4">
                                                <For each={logs()}>
                                                    {(log) => (
                                                        <div class="flex gap-4 animate-in slide-in-from-left-2 duration-300">
                                                            <span class="text-text_accent opacity-40 whitespace-nowrap">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                                                            <span class={log.includes('✓') ? 'text-green-400' : log.includes('Error') ? 'text-red-400' : 'text-white/70'}>
                                                                {log}
                                                            </span>
                                                        </div>
                                                    )}
                                                </For>
                                                <div class="w-2 h-4 bg-text_accent animate-pulse mt-1"></div>
                                            </div>
                                        </div>
                                    </div>
                                </Show>

                                <Show when={fullData() || reports()[1]}>
                                    <div class="paper-report bg-white shadow-2xl mx-auto max-w-6xl p-16 relative font-sans text-justify text-[#1e293b]" ref={reportContainerRef}>
                                        <style>
                                            {`
                                    .paper-report {
                                        background-color: #ffffff;
                                        color: #1e293b;
                                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                                        border-radius: 4px;
                                    }
                                    .paper-report * {
                                        text-transform: none !important;
                                    }
                                    .paper-report h1 {
                                        font-family: 'Outfit', sans-serif;
                                        font-size: 2.25rem;
                                        font-weight: 900;
                                        color: #0f172a !important;
                                        margin-bottom: 1.5rem;
                                    }
                                    .paper-report h2 {
                                        font-family: 'Outfit', sans-serif;
                                        font-size: 1.5rem;
                                        font-weight: 800;
                                        color: #1e293b !important;
                                        margin-top: 2rem;
                                        margin-bottom: 1rem;
                                    }
                                    .paper-report h3 {
                                        font-family: 'Outfit', sans-serif;
                                        font-size: 1.25rem;
                                        font-weight: 700;
                                        color: #0369a1 !important;
                                        margin-top: 1.5rem;
                                        margin-bottom: 0.75rem;
                                    }
                                    .paper-report h4, .paper-report h5 {
                                        font-family: 'Outfit', sans-serif;
                                        font-size: 1.1rem;
                                        font-weight: 700;
                                        color: #334155 !important;
                                        margin-top: 1.25rem;
                                        margin-bottom: 0.5rem;
                                    }
                                    .paper-report p {
                                        font-size: 0.95rem;
                                        line-height: 1.8;
                                        margin-bottom: 1.25rem;
                                        color: #334155;
                                        text-align: justify;
                                    }
                                    .paper-report ul, .paper-report ol {
                                        font-size: 0.95rem;
                                        line-height: 1.8;
                                        margin-bottom: 1.25rem;
                                        color: #334155;
                                        padding-left: 1.5rem;
                                        text-align: justify;
                                    }
                                    .paper-report li {
                                        margin-bottom: 0.5rem;
                                    }
                                    .paper-report strong {
                                        color: #0284c7;
                                        font-weight: 700;
                                    }
                                    .paper-report table {
                                        width: 100%;
                                        font-size: 0.85rem;
                                        border-collapse: collapse;
                                        margin-bottom: 1.5rem;
                                    }
                                    .paper-report th {
                                        background-color: #f8fafc;
                                        color: #0f172a;
                                        font-weight: 700;
                                        padding: 0.75rem;
                                        border-bottom: 2px solid #cbd5e1;
                                    }
                                    .paper-report td {
                                        padding: 0.75rem;
                                        border-bottom: 1px solid #e2e8f0;
                                        color: #475569;
                                    }
                                    .section-title {
                                        font-size: 1rem;
                                        font-weight: 800;
                                        color: #0284c7;
                                        border-bottom: 1.5px solid #0284c7;
                                        padding-bottom: 4px;
                                        margin-top: 2rem;
                                        margin-bottom: 1rem;
                                        letter-spacing: 0.05em;
                                    }
                                    .print-justify p { text-align: justify; }
                                `}
                                        </style>

                                        {/* Document Header */}
                                        <div class="flex justify-between items-start border-b-2 border-slate-200 pb-4 mb-6">
                                            <div>
                                                <h1 class="text-4xl font-black tracking-tight text-slate-900 m-0 p-0">{symbol()}</h1>
                                                <div class="text-sm font-bold text-slate-500 mt-1">{fullData()?.fundamental?.snapshot?.name || 'Asset Overview'}</div>
                                            </div>
                                            <div class="text-right">
                                                <div class="text-xs font-black text-sky-600">Asetpedia Intelligence</div>
                                                <div class="text-xs font-bold text-slate-400 mt-1">{new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                            </div>
                                        </div>
                                        {/* Market & Macro Context */}
                                        <Show when={fullData()?.fundamental?.macro_data}>
                                            <div class="grid grid-cols-4 gap-2 mb-6 text-[9px] uppercase font-black">
                                                <For each={fullData()?.fundamental?.macro_data?.indices}>
                                                    {(idx) => (
                                                        <div class="p-2 border border-slate-200 bg-slate-50 flex flex-col justify-between">
                                                            <div class="text-slate-400 truncate">{idx.name}</div>
                                                            <div class={idx.change_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                                                {idx.price.toLocaleString()} ({idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%)
                                                            </div>
                                                        </div>
                                                    )}
                                                </For>
                                                <Show when={fullData()?.fundamental?.macro_data?.sector_etf}>
                                                    <div class="p-2 border border-slate-200 bg-slate-50 flex flex-col justify-between">
                                                        <div class="text-slate-400 truncate">Sector ETF: {fullData()?.fundamental?.macro_data?.sector_etf?.ticker}</div>
                                                        <div class="text-slate-800">{fullData()?.fundamental?.macro_data?.sector_etf?.price.toLocaleString()}</div>
                                                    </div>
                                                </Show>
                                            </div>
                                        </Show>

                                        {/* Legal & Risk Signals */}
                                        <Show when={fullData()?.legalNews?.length > 0}>
                                            <div class="bg-rose-50 border-l-4 border-rose-500 p-4 mb-6">
                                                <h5 class="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <span class="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                                                    Critical Legal & Regulatory Signals Detected
                                                </h5>
                                                <div class="grid grid-cols-2 gap-4">
                                                    <For each={fullData()?.legalNews?.slice(0, 2)}>
                                                        {(n) => (
                                                            <div class="text-[10px] font-bold text-slate-800 leading-tight">
                                                                • {n.title}
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>
                                        </Show>

                                        {/* Row: News and Executives */}
                                        <div class="grid grid-cols-3 gap-6 my-6 text-left">
                                            <div class="col-span-2">
                                                <h5 class="text-xs font-black text-slate-800 border-b border-slate-200 pb-1 mb-2">Latest Public News</h5>
                                                <div class="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                                                    <For each={fullData()?.news?.news?.slice(0, 4)}>
                                                        {(n) => (
                                                            <a href={n.link} target="_blank" class="block p-2 border border-slate-200 hover:bg-slate-50 transition">
                                                                <div class="text-[9px] font-black text-sky-600 mb-1">{n.publisher || 'NEWS'}</div>
                                                                <div class="text-[11px] font-bold text-slate-800 leading-tight">{n.title}</div>
                                                            </a>
                                                        )}
                                                    </For>
                                                    <Show when={!fullData()?.news?.news?.length}>
                                                        <div class="text-xs text-slate-400 italic">No news data available.</div>
                                                    </Show>
                                                </div>
                                            </div>
                                            <div class="col-span-1">
                                                <h5 class="text-xs font-black text-slate-800 border-b border-slate-200 pb-1 mb-2">Management</h5>
                                                <div class="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 text-xs">
                                                    <For each={fullData()?.fundamental?.snapshot?.companyOfficers?.slice(0, 4)}>
                                                        {(o) => (
                                                            <div class="border-b border-slate-100 pb-1">
                                                                <div class="font-bold text-slate-800">{o.name || '-'}</div>
                                                                <div class="text-[9px] text-slate-400 font-bold">{o.title || '-'}</div>
                                                            </div>
                                                        )}
                                                    </For>
                                                    <Show when={!fullData()?.fundamental?.snapshot?.companyOfficers?.length}>
                                                        <div class="text-xs text-slate-400 italic">No leadership data available.</div>
                                                    </Show>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Section 1: Strategic Overview & Business Intel */}
                                        <div class="section-title">1. Strategic Overview & Business Intel</div>
                                        <div class="space-y-4">
                                            <Show when={fullData()?.fundamental?.snapshot?.longBusinessSummary}>
                                                <p class="text-[11px] text-slate-700 leading-relaxed text-justify">
                                                    <strong>Company Description:</strong> {fullData()?.fundamental?.snapshot?.longBusinessSummary}
                                                </p>
                                            </Show>
                                            <Show when={fullData()?.fundamental?.snapshot?.wikipedia_summary}>
                                                <p class="text-[11px] text-slate-500 leading-relaxed text-justify italic border-l-2 border-slate-100 pl-4">
                                                    <strong>Wikipedia Context:</strong> {fullData()?.fundamental?.snapshot?.wikipedia_summary}
                                                </p>
                                            </Show>
                                            <Show when={!fullData()?.fundamental?.snapshot?.longBusinessSummary && !fullData()?.fundamental?.snapshot?.wikipedia_summary}>
                                                <p class="text-xs text-slate-400 italic">No strategic overview available for this asset ticker.</p>
                                            </Show>
                                        </div>

                                        {/* AI Stage 1 */}
                                        <div id="ai-stage-1" innerHTML={reports()[1]} class="text-justify my-6"></div>

                                        {/* Section 2: Fundamental Factsheet with Tabs */}
                                        <div class="section-title">2. Fundamental Factsheet</div>

                                        {/* Tabs Header */}
                                        <div class="flex gap-2 border-b border-slate-200 text-left text-xs mb-4">
                                            <For each={['valuation', 'profitability', 'income', 'balance']}>
                                                {(tab) => (
                                                    <button
                                                        class={`px-4 py-2 font-black uppercase transition-all border-b-2 ${activeFundTab() === tab ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                                        onClick={() => setActiveFundTab(tab)}
                                                    >
                                                        {tab}
                                                    </button>
                                                )}
                                            </For>
                                        </div>

                                        {/* Tabs Content */}
                                        <div class="my-4 text-left text-xs">
                                            <Show when={activeFundTab() === 'valuation'}>
                                                <div class="grid grid-cols-2 gap-4">
                                                    <div class="p-3 bg-slate-50 border border-slate-200">
                                                        <span class="text-slate-400 font-bold">Market Cap</span>
                                                        <div class="text-base font-black text-slate-800">{formatNumber(fullData()?.fundamental?.snapshot?.marketCap)}</div>
                                                    </div>
                                                    <div class="p-3 bg-slate-50 border border-slate-200">
                                                        <span class="text-slate-400 font-bold">Trailing P/E</span>
                                                        <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.trailingPE?.toFixed(2) || 'N/A'}</div>
                                                    </div>
                                                    <div class="p-3 bg-slate-50 border border-slate-200">
                                                        <span class="text-slate-400 font-bold">Enterprise Value</span>
                                                        <div class="text-base font-black text-slate-800">{formatNumber(fullData()?.fundamental?.snapshot?.enterpriseValue)}</div>
                                                    </div>
                                                    <div class="p-3 bg-slate-50 border border-slate-200">
                                                        <span class="text-slate-400 font-bold">Beta</span>
                                                        <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.beta?.toFixed(2) || 'N/A'}</div>
                                                    </div>
                                                    <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">PEG Ratio</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.pegRatio?.toFixed(2) || 'N/A'}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Price to Book</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.priceToBook?.toFixed(2) || 'N/A'}</div>
                                                     </div>
                                                </div>
                                            </Show>
                                            <Show when={activeFundTab() === 'profitability'}>
                                                 <div class="grid grid-cols-2 gap-4">
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Gross Margins</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.grossMargins ? (fullData().fundamental.snapshot.grossMargins * 100).toFixed(2) + '%' : 'N/A'}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Profit Margins</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.profitMargins ? (fullData().fundamental.snapshot.profitMargins * 100).toFixed(2) + '%' : 'N/A'}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Operating Margins</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.operatingMargins ? (fullData().fundamental.snapshot.operatingMargins * 100).toFixed(2) + '%' : 'N/A'}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Return on Equity (ROE)</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.returnOnEquity ? (fullData().fundamental.snapshot.returnOnEquity * 100).toFixed(2) + '%' : 'N/A'}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Revenue Growth (TTM)</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.revenueGrowth ? (fullData().fundamental.snapshot.revenueGrowth * 100).toFixed(2) + '%' : 'N/A'}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Earnings Growth</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.earningsGrowth ? (fullData().fundamental.snapshot.earningsGrowth * 100).toFixed(2) + '%' : 'N/A'}</div>
                                                     </div>
                                                 </div>
                                             </Show>
                                             <Show when={activeFundTab() === 'income'}>
                                                 <div class="grid grid-cols-2 gap-4">
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Total Revenue</span>
                                                         <div class="text-base font-black text-slate-800">{formatNumber(fullData()?.fundamental?.snapshot?.totalRevenue)}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">EBITDA</span>
                                                         <div class="text-base font-black text-slate-800">{formatNumber(fullData()?.fundamental?.snapshot?.ebitda)}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Operating Cash Flow</span>
                                                         <div class="text-base font-black text-slate-800">{formatNumber(fullData()?.fundamental?.snapshot?.operatingCashflow)}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Free Cash Flow</span>
                                                         <div class="text-base font-black text-slate-800">{formatNumber(fullData()?.fundamental?.snapshot?.freeCashflow)}</div>
                                                     </div>
                                                 </div>
                                             </Show>
                                             <Show when={activeFundTab() === 'balance'}>
                                                 <div class="grid grid-cols-2 gap-4">
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Total Cash</span>
                                                         <div class="text-base font-black text-slate-800">{formatNumber(fullData()?.fundamental?.snapshot?.totalCash)}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Total Debt</span>
                                                         <div class="text-base font-black text-slate-800">{formatNumber(fullData()?.fundamental?.snapshot?.totalDebt)}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Debt to Equity (D/E)</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.debtToEquity?.toFixed(2) || 'N/A'}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Current Ratio</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.currentRatio?.toFixed(2) || 'N/A'}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Quick Ratio</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.quickRatio?.toFixed(2) || 'N/A'}</div>
                                                     </div>
                                                     <div class="p-3 bg-slate-50 border border-slate-200">
                                                         <span class="text-slate-400 font-bold">Beta</span>
                                                         <div class="text-base font-black text-slate-800">{fullData()?.fundamental?.snapshot?.beta?.toFixed(2) || 'N/A'}</div>
                                                     </div>
                                                 </div>
                                             </Show>
                                        </div>

                                        {/* AI Stage 2 */}
                                        <div id="ai-stage-2" innerHTML={reports()[2]} class="text-justify my-6"></div>

                                        {/* Historical Financials Table (Yearly) */}
                                        <Show when={fullData()?.fundamental?.financials && Object.keys(fullData().fundamental.financials).length > 0}>
                                            <div class="my-8">
                                                <div class="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">Historical Financials (Yearly)</div>
                                                <div class="overflow-x-auto win-scroll pb-2">
                                                    <table class="w-full text-left border-collapse border border-slate-200 text-[10px] font-mono">
                                                        <thead class="bg-slate-50">
                                                            <tr>
                                                                <th class="p-2 border border-slate-200 font-bold uppercase text-slate-500">Metric</th>
                                                                <For each={Object.keys(fullData().fundamental.financials).sort((a, b) => b.localeCompare(a))}>
                                                                    {(y) => <th class="p-2 border border-slate-200 text-right font-bold text-slate-700">{y}</th>}
                                                                </For>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <For each={Array.from(new Set(Object.values(fullData().fundamental.financials).flatMap(yObj => Object.keys(yObj)))).filter(m => m.length <= 30)}>
                                                                {(m) => (
                                                                    <tr>
                                                                        <td class="p-2 border border-slate-200 font-bold text-slate-800">{m}</td>
                                                                        <For each={Object.keys(fullData().fundamental.financials).sort((a, b) => b.localeCompare(a))}>
                                                                            {(y) => {
                                                                                const val = fullData().fundamental.financials[y][m];
                                                                                return <td class="p-2 border border-slate-200 text-right">{val != null ? formatNumber(val) : '-'}</td>;
                                                                            }}
                                                                        </For>
                                                                    </tr>
                                                                )}
                                                            </For>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </Show>

                                        {/* Section 3: Technical Trends & Charts */}
                                        <div class="section-title">3. MARKET ANALYTICS & TECHNICAL TRENDS</div>

                                        {/* Timescale buttons for chart */}
                                        <div class="flex justify-end gap-1 mb-4 text-xs font-bold">
                                            <For each={['1mo', '3mo', '6mo', '1y', '3y', '5y']}>
                                                {(p) => (
                                                    <button
                                                        class={`px-2 py-1 uppercase border rounded transition ${chartPeriod() === p ? 'border-sky-600 bg-sky-600 text-white font-black' : 'border-slate-200 text-slate-500 hover:border-slate-400 bg-white'}`}
                                                        onClick={() => {
                                                            setChartPeriod(p);
                                                            fetchMarketChart(symbol(), p);
                                                        }}
                                                    >
                                                        {p}
                                                    </button>
                                                )}
                                            </For>
                                        </div>

                                        {/* Main EChart Wrapper */}
                                        <div class="space-y-4 mb-6">
                                            <div>
                                                <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Price Action & Overlays</div>
                                                <div class="h-[320px] bg-slate-50 border border-slate-200 p-2" ref={chartContainer}></div>
                                            </div>
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">RSI Oscillator</div>
                                                    <div class="h-[140px] bg-slate-50 border border-slate-200 p-2" ref={rsiContainer}></div>
                                                </div>
                                                <div>
                                                    <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">MACD Momentum</div>
                                                    <div class="h-[140px] bg-slate-50 border border-slate-200 p-2" ref={macdContainer}></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Advanced Local TA Grid */}
                                        <Show when={taData()}>
                                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-left mb-6">
                                                {/* Score Box */}
                                                <div class="p-3 bg-slate-50 border border-slate-200 rounded">
                                                    <div class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">TA Score / Verdict</div>
                                                    <div class="text-base font-black mt-1" style={{ color: taData().signals.verdict.includes('BUY') ? '#10b981' : taData().signals.verdict.includes('SELL') ? '#ef4444' : '#64748b' }}>
                                                        {taData().signals.verdict} ({taData().signals.score})
                                                    </div>
                                                </div>
                                                {/* Indicators Box */}
                                                <div class="p-3 bg-slate-50 border border-slate-200 rounded">
                                                    <div class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Key Metrics</div>
                                                    <div class="grid grid-cols-2 gap-2 mt-1 font-mono font-bold text-slate-800">
                                                        <div>RSI(14): <span class="font-black text-sky-600">{taData().current.rsi14 ? taData().current.rsi14.toFixed(2) : '-'}</span></div>
                                                        <div>MACD: <span class="font-black text-sky-600">{taData().current.macd ? taData().current.macd.toFixed(4) : '-'}</span></div>
                                                    </div>
                                                </div>
                                                {/* Fib / Sup Box */}
                                                <div class="p-3 bg-slate-50 border border-slate-200 rounded">
                                                    <div class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Support & Resistance</div>
                                                    <div class="grid grid-cols-2 gap-2 mt-1 font-mono font-bold text-slate-800">
                                                        <div>S1: <span class="text-emerald-600 font-black">{taData().support_resistance.supports[0] || '-'}</span></div>
                                                        <div>R1: <span class="text-rose-600 font-black">{taData().support_resistance.resistances[0] || '-'}</span></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-left mb-6">
                                                {/* MA TABLE */}
                                                <div>
                                                    <div class="text-slate-500 font-black uppercase text-[10px] mb-2 tracking-widest">Moving Averages</div>
                                                    <table class="w-full text-slate-700 border-collapse border border-slate-200 text-[11px]">
                                                        <thead class="bg-slate-50">
                                                            <tr>
                                                                <th class="p-2 border border-slate-200 text-left font-bold">Indicator</th>
                                                                <th class="p-2 border border-slate-200 text-right font-bold">Value</th>
                                                                <th class="p-2 border border-slate-200 text-center font-bold">Position</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <For each={Object.entries(taData().ma_table || {})}>
                                                                {([key, row]) => (
                                                                    <tr>
                                                                        <td class="p-2 border border-slate-200 font-bold uppercase">{key}</td>
                                                                        <td class="p-2 border border-slate-200 text-right font-mono">{row.value ? row.value.toFixed(2) : '-'}</td>
                                                                        <td class={`p-2 border border-slate-200 text-center font-bold font-mono ${row.above ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                            {row.above ? 'Above' : 'Below'}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </For>
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* FIB TABLE */}
                                                <div>
                                                    <div class="text-slate-500 font-black uppercase text-[10px] mb-2 tracking-widest">Fibonacci Retracement</div>
                                                    <table class="w-full text-slate-700 border-collapse border border-slate-200 text-[11px]">
                                                        <thead class="bg-slate-50">
                                                            <tr>
                                                                <th class="p-2 border border-slate-200 text-left font-bold">Fib Level</th>
                                                                <th class="p-2 border border-slate-200 text-right font-bold">Value</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <For each={Object.entries(taData().fibonacci?.levels || {})}>
                                                                {([lvl, price]) => (
                                                                    <tr>
                                                                        <td class="p-2 border border-slate-200 font-bold font-mono">Fib {lvl}</td>
                                                                        <td class="p-2 border border-slate-200 text-right font-mono font-bold text-slate-800">{price ? price.toFixed(2) : '-'}</td>
                                                                    </tr>
                                                                )}
                                                            </For>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </Show>

                                        {/* AI Stage 3 */}
                                        <div id="ai-stage-3" innerHTML={reports()[3]} class="text-justify my-6"></div>

                                        {/* AI Stage 4 */}
                                        <div id="ai-stage-4" innerHTML={reports()[4]} class="text-justify my-6"></div>

                                        {/* AI Stage 5 */}
                                        <div id="ai-stage-5" innerHTML={reports()[5]} class="text-justify my-6"></div>
                                    </div>
                                </Show>

                                <Show when={!loading() && !fullData()}>
                                    <div class="paper-report bg-white text-slate-400 shadow-2xl mx-auto max-w-6xl p-20 flex flex-col items-center justify-center">
                                        <div class="w-20 h-20 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center mb-6">
                                            <svg class="w-10 h-10 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                            </svg>
                                        </div>
                                        <h2 class="text-xl font-black text-slate-300 tracking-[0.3em] uppercase mb-2">Analysis Hub</h2>
                                        <span class="text-[9px] font-black tracking-[0.2em] uppercase text-slate-400/50 max-w-xs text-center leading-relaxed">Enter a valid ticker symbol and select your AI engine to synthesize a professional research report</span>
                                    </div>
                                </Show>
                            </Show> {/* end activeView === 'new' */}
                        </div>
                    </div>
                </div>
            </Show> {/* end single mode */}
        </div>
    );
}
