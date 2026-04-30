import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';
import * as echarts from 'echarts';
import ComparativeView from './research-panel/comparative/ComparativeView';

// We'll dynamically load Marked.js for markdown parsing
const loadMarked = () => {
    return new Promise((resolve) => {
        if (window.marked) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
};

// We'll dynamically load html2pdf.js for PDF saving
const loadHtml2Pdf = () => {
    return new Promise((resolve) => {
        if (window.html2pdf) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
};

export default function ResearchPanelView() {
    const RESEARCH_API = import.meta.env.VITE_RESEARCH_API;
    const [mode, setMode] = createSignal('single'); // 'single' | 'comparative'

    const [symbol, setSymbol] = createSignal('');
    const [model, setModel] = createSignal('deepseek-v4-flash');
    const [loading, setLoading] = createSignal(false);
    const [progress, setProgress] = createSignal(0);
    const [logs, setLogs] = createSignal([]);
    const [fullData, setFullData] = createSignal(null);
    const [chartPeriod, setChartPeriod] = createSignal('1y');
    const [activeFundTab, setActiveFundTab] = createSignal('valuation');
    const [recommendations, setRecommendations] = createSignal([]);
    const [taData, setTaData] = createSignal(null);

    // AI generated sections
    const [reports, setReports] = createSignal({
        1: '', 2: '', 3: '', 4: '', 5: ''
    });

    let chartContainer;
    let myChart = null;
    let reportContainerRef; // for PDF

    const addLog = (msg) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    onMount(async () => {
        await loadMarked();
        await loadHtml2Pdf();
    });

    createEffect(() => {
        const data = fullData();
        if (data && data.market && data.market.historical) {
            setTimeout(() => {
                renderChart(data.market.historical);
            }, 300);
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
            const res = await fetch(`${RESEARCH_API}/api/data/chart?symbol=${sym}&period=${period}`);
            const json = await res.json();
            if (json.status === 'success' && json.data.length > 0) {
                renderChart(json.data);
            }
        } catch (e) {
            console.error("Failed to fetch chart", e);
        }
    };

    const renderChart = (historicalData) => {
        if (!chartContainer) return;
        if (!myChart) {
            myChart = echarts.init(chartContainer);
        }

        const dates = historicalData.map(d => d.date);
        const data = historicalData.map(d => [d.open, d.close, d.low, d.high]);
        const volumes = historicalData.map(d => d.volume);

        myChart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
            grid: { left: '10%', right: '5%', bottom: '15%' },
            xAxis: { type: 'category', data: dates, boundaryGap: false },
            yAxis: { scale: true, splitArea: { show: true } },
            dataZoom: [{ type: 'inside', start: 50, end: 100 }, { show: true, type: 'slider', top: '90%', start: 50, end: 100 }],
            series: [
                {
                    name: 'Price',
                    type: 'candlestick',
                    data: data,
                    itemStyle: { color: '#ef4444', color0: '#10b981', borderColor: '#ef4444', borderColor0: '#10b981' }
                }
            ]
        }, true);
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
                setRecommendations(data.data);
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
            addLog("Fetching Proprietary Technical Analysis...");
            try {
                const taRes = await fetch(`https://api.asetpedia.online/ta/api/ta/analyze/${symbol()}`);
                const taJson = await taRes.json();
                if (taJson && !taJson.error) {
                    aggregatedData.ta = taJson;
                    setTaData(taJson);
                }
            } catch (e) {
                console.error("Failed to fetch TA data", e);
            }

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
                        full_data: aggregatedData,
                        generated_stages: generatedStages
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

        } catch (err) {
            addLog(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
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
            } catch (e) {}
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
                    <h2 class="text-[13px] font-black text-text_accent tracking-widest">Research & Analysis Hub</h2>
                </div>
                <div class="flex items-center gap-1 bg-black/40 p-1 rounded border border-white/5">
                    <button
                        onClick={() => setMode('single')}
                        class={`px-4 py-1.5 text-[9px] font-black tracking-widest rounded-sm transition-all ${
                            mode() === 'single' ? 'bg-text_accent text-bg_main' : 'text-white/30 hover:text-white'
                        }`}
                    >
                        Single Analysis
                    </button>
                    <button
                        onClick={() => setMode('comparative')}
                        class={`px-4 py-1.5 text-[9px] font-black tracking-widest rounded-sm transition-all ${
                            mode() === 'comparative' ? 'bg-text_accent text-bg_main' : 'text-white/30 hover:text-white'
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
                        <h3 class="text-[9px] font-black text-text_accent tracking-widest border-b border-border_main pb-1 mb-1">
                            Market Context Selection
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
                                    <div class="absolute z-50 bg-bg_sidebar border border-border_main w-full max-h-48 overflow-y-auto mt-1 flex flex-col shadow-2xl">
                                        <For each={recommendations()}>
                                            {(rec) => (
                                                <button
                                                    type="button"
                                                    class="text-left px-3 py-2 text-[9px] hover:bg-text_accent hover:text-bg_main font-mono border-b border-border_main/30 text-white transition-colors flex flex-col"
                                                    onClick={() => {
                                                        setSymbol(rec.symbol);
                                                        setRecommendations([]);
                                                    }}
                                                >
                                                    <span class="font-black text-text_accent">{rec.symbol}</span>
                                                    <span class="text-[8px] text-text_secondary truncate">{rec.name}</span>
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </div>
                            <div>
                                <label class="text-[8px] text-text_secondary font-black block mb-1">AI Engine Model</label>
                                <select
                                    class="w-full bg-black border border-border_main px-3 py-2 text-[11px] font-mono text-white outline-none focus:border-text_accent"
                                    value={model()}
                                    onChange={(e) => setModel(e.target.value)}
                                    disabled={loading()}
                                >
                                    <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
                                    <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={loading() || !symbol()}
                                class="w-full bg-text_accent text-bg_main py-2.5 font-black hover:brightness-110 transition-all tracking-widest disabled:opacity-50 text-[10px]"
                            >
                                {loading() ? '⟳ Processing Intelligence...' : 'Start Research Analysis'}
                            </button>
                            <button
                                type="button"
                                disabled={loading() || (!fullData() && !reports()[1])}
                                onClick={handleSavePDF}
                                class="w-full border border-text_accent/30 text-text_accent py-2 font-black hover:bg-text_accent hover:text-bg_main transition-colors tracking-widest disabled:opacity-30 text-[10px]"
                            >
                                Export PDF Report
                            </button>
                        </form>
                    </div>

                    <div class="glass-panel p-3 flex flex-col gap-2">
                        <h3 class="text-[9px] font-black text-text_accent tracking-widest border-b border-border_main pb-1">Execution Logs</h3>
                        <div class="flex flex-col gap-1 text-[8px] font-mono opacity-60 overflow-y-auto max-h-32">
                            <For each={logs()}>
                                {(log) => <div>{log}</div>}
                            </For>
                        </div>
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

                    <Show when={fullData()?.news}>
                        <div class="glass-panel p-3">
                            <h3 class="text-[9px] font-black text-text_accent tracking-widest border-b border-border_main pb-1 mb-2">News Feed & Public Sentiment</h3>
                            <div class="flex flex-col gap-2 max-h-64 overflow-y-auto win-scroll pr-1">
                                <For each={fullData().news.news.slice(0, 5)}>
                                    {(n) => (
                                        <a href={n.link} target="_blank" class="block bg-bg_main/50 p-2 border border-border_main hover:border-text_accent/50 cursor-pointer">
                                            <div class="text-[8px] font-black text-text_accent mb-1">{n.publisher || 'NEWS'}</div>
                                            <div class="text-[9px] font-bold text-white line-clamp-2 leading-tight">{n.title}</div>
                                        </a>
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>

                    <Show when={fullData()?.fundamental}>
                        <div class="glass-panel p-3">
                            <h3 class="text-[9px] font-black text-text_accent tracking-widest border-b border-border_main pb-1 mb-2">Fundamental Factsheet</h3>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="bg-bg_main/50 p-2 border border-border_main">
                                    <div class="text-[7px] text-text_secondary opacity-50">Market Cap</div>
                                    <div class="text-[11px] font-black text-white">{formatNumber(fullData().fundamental.snapshot.marketCap)}</div>
                                </div>
                                <div class="bg-bg_main/50 p-2 border border-border_main">
                                    <div class="text-[7px] text-text_secondary opacity-50">PE Ratio</div>
                                    <div class="text-[11px] font-black text-white">{fullData().fundamental.snapshot.peRatio?.toFixed(2) || 'N/A'}</div>
                                </div>
                                <div class="bg-bg_main/50 p-2 border border-border_main">
                                    <div class="text-[7px] text-text_secondary opacity-50">Revenue</div>
                                    <div class="text-[11px] font-black text-white">{formatNumber(fullData().fundamental.snapshot.totalRevenue)}</div>
                                </div>
                                <div class="bg-bg_main/50 p-2 border border-border_main">
                                    <div class="text-[7px] text-text_secondary opacity-50">Net Income</div>
                                    <div class="text-[11px] font-black text-white">{formatNumber(fullData().fundamental.snapshot.netIncome)}</div>
                                </div>
                            </div>
                        </div>
                    </Show>
                </div>
                <div class="flex-1 flex flex-col overflow-y-auto win-scroll bg-[#0b0f19] p-8">

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

                            {/* Section 1: Strategic Overview (Wiki) */}
                            <div class="section-title">1. Strategic Overview & Business Intel</div>
                            <p class="text-sm text-slate-600 leading-relaxed text-justify">
                                {fullData()?.fundamental?.snapshot?.wikipedia_summary || 'No overview available for this asset ticker.'}
                            </p>

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
                            <div class="h-[320px] bg-slate-50 border border-slate-200 p-2 mb-6" ref={chartContainer}></div>

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
                            <svg class="w-16 h-16 mb-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span class="text-xs font-black tracking-widest uppercase text-slate-400">ENTER A VALID TICKER SYMBOL TO START RESEARCH</span>
                        </div>
                    </Show>
                </div>
            </div>
            </Show> {/* end single mode */}
        </div>
    );
}
