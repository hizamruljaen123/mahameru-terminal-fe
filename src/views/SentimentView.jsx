import { createSignal, createResource, Show, For, onMount, createEffect, onCleanup } from 'solid-js';
import * as echarts from 'echarts';
import { fetchWithRetry } from '../utils/apiFetch';
import { loadPreloadCache, savePreloadCache } from '../utils/preloadCache';

export default function SentimentView() {
    const [summary, setSummary] = createSignal(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [keyword, setKeyword] = createSignal('');
    const [researchResults, setResearchResults] = createSignal(null);
    const [isResearching, setIsResearching] = createSignal(false);
    const [activeTab, setActiveTab] = createSignal('OVERVIEW');
    const [apiError, setApiError] = createSignal(null);

    let pieChartRef;
    let barChartRef;
    let heatmapChartRef;
    let barChartResearchRef;

    // Store chart instances for proper disposal
    const chartInstances = new Map();

    const disposeCharts = () => {
        chartInstances.forEach(chart => chart.dispose());
        chartInstances.clear();
    };

    const initCharts = () => {
        if (summary() && summary().status === 'success') {
            const data = summary().data;
            const totalPos = data.reduce((acc, row) => acc + (row.POSITIVE || Math.round((row.total * row.positive_pct / 100) || 0)), 0);
            const totalNeg = data.reduce((acc, row) => acc + (row.NEGATIVE || Math.round((row.total * row.negative_pct / 100) || 0)), 0);
            const totalNeu = data.reduce((acc, row) => acc + (row.NEUTRAL || Math.round((row.total * row.neutral_pct / 100) || 0)), 0);
            const totalArt = totalPos + totalNeg + totalNeu;
            const globalScore = totalArt > 0 ? ((totalPos - totalNeg) / totalArt) * 100 : 0;

            // 1. SENTIMENT SLIDER (Custom logic handled in JSX)
            // No ECharts for gauge anymore, we use a custom slider component

            // 2. PIE CHART (Distribution)
            if (pieChartRef) {
                const chart = echarts.init(pieChartRef);
                chartInstances.set('pie', chart);
                chart.setOption({
                    backgroundColor: 'transparent',
                    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                    series: [{
                        name: 'Sentiment',
                        type: 'pie',
                        radius: ['50%', '80%'],
                        avoidLabelOverlap: false,
                        itemStyle: { borderRadius: 8, borderColor: '#0f172a', borderWidth: 3 },
                        label: { show: false, position: 'center' },
                        emphasis: { 
                            label: { 
                                show: true, 
                                fontSize: 14, 
                                fontWeight: '900', 
                                color: '#fff',
                                formatter: '{b}\n{d}%'
                            } 
                        },
                        data: [
                            { value: totalPos, name: 'POSITIVE', itemStyle: { color: '#10b981' } },
                            { value: totalNeg, name: 'NEGATIVE', itemStyle: { color: '#ef4444' } },
                            { value: totalNeu, name: 'NEUTRAL', itemStyle: { color: '#64748b' } }
                        ]
                    }]
                });
            }

            // 3. TREEMAP (Category Scores) - Replaces Bar Chart
            const sortedData = [...data].sort((a, b) => b.score - a.score);
            const treemapData = sortedData.map(d => ({
                name: d.category,
                value: [(d.POSITIVE + d.NEGATIVE + d.NEUTRAL) || 1, d.score], // [Area, ColorValue]
                score: d.score.toFixed(1)
            }));

            const treemapOption = {
                backgroundColor: 'transparent',
                tooltip: {
                    formatter: function (info) {
                        const data = info.data;
                        return [
                            '<div class="p-2 font-mono text-[10px]">',
                            '<b class="text-text_accent">' + info.name + '</b><br/>',
                            'NET SCORE: ' + data.score + '<br/>',
                            'VOLUME: ' + info.value[0] + ' ARTICLES',
                            '</div>'
                        ].join('');
                    }
                },
                visualMap: {
                    show: false,
                    min: -60,
                    max: 60,
                    dimension: 1,
                    inRange: {
                        color: ['#ef4444', '#475569', '#10b981']
                    }
                },
                series: [{
                    type: 'treemap',
                    data: treemapData,
                    roam: false,
                    nodeClick: false,
                    breadcrumb: { show: false },
                    label: {
                        show: true,
                        formatter: function (params) {
                            return params.name + '\n' + params.data.score;
                        },
                        fontSize: 9,
                        fontWeight: 'bold',
                        color: '#fff'
                    },
                    itemStyle: {
                        borderColor: '#0f172a',
                        borderWidth: 1,
                        gapWidth: 1
                    },
                    levels: [
                        { itemStyle: { borderColor: '#0f172a', borderWidth: 2, gapWidth: 2 } }
                    ]
                }]
            };

            if (barChartRef) {
                const chart = echarts.init(barChartRef);
                chartInstances.set('bar', chart);
                chart.setOption(treemapOption);
            }
            if (barChartResearchRef) {
                const chart = echarts.init(barChartResearchRef);
                chartInstances.set('barResearch', chart);
                chart.setOption(treemapOption);
            }
        }
    };

    onMount(async () => {
        // 1. Load from preload cache
        const cached = await loadPreloadCache();
        if (cached && cached.sentiment) {
            console.log('[SentimentView] Preload cache applied');
            setSummary({ status: 'success', data: cached.sentiment });
            setIsLoading(false);
        }

        // 2. Fetch fresh
        await fetchFreshSummary();
    });

    const fetchFreshSummary = async () => {
        setIsLoading(true);
        try {
            const res = await fetchWithRetry(`${import.meta.env.VITE_SENTIMENT_URL}/api/sentiment/summary-all`);
            if (res.status === 'success') {
                setSummary(res);
                // Sync to global preload cache
                const currentCache = await loadPreloadCache() || {};
                savePreloadCache({ ...currentCache, sentiment: res.data });
            }
        } catch (e) {
            console.error("Fresh fetch failed:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const initHeatmap = () => {
        if (researchResults() && heatmapChartRef) {
            const articles = researchResults().articles;
            const categories = [...new Set(articles.map(a => a.category))].slice(0, 8);
            const dates = [...new Set(articles.map(a => a.pubDate.split(' ')[0]))].sort().slice(-14);

            const heatmapData = [];
            categories.forEach((cat, cIdx) => {
                dates.forEach((d, dIdx) => {
                    const matched = articles.filter(a => a.category === cat && a.pubDate.startsWith(d));
                    let score = 0;
                    if (matched.length > 0) {
                        const pos = matched.filter(a => a.sentiment === 'POSITIVE').length;
                        const neg = matched.filter(a => a.sentiment === 'NEGATIVE').length;
                        score = (pos - neg) / matched.length;
                    }
                    if (matched.length > 0) {
                        heatmapData.push([dIdx, cIdx, score.toFixed(2)]);
                    } else {
                        heatmapData.push([dIdx, cIdx, null]);
                    }
                });
            });

            const chart = echarts.init(heatmapChartRef);
            chartInstances.set('heatmap', chart);
            chart.setOption({
                tooltip: {
                    position: 'top',
                    formatter: function (params) {
                        return `${dates[params.value[0]]}<br/>${categories[params.value[1]]}: <b>${params.value[2]}</b>`;
                    }
                },
                grid: { height: '70%', top: '10%' },
                xAxis: { type: 'category', data: dates, splitArea: { show: true }, axisLabel: { color: '#64748b', fontSize: 9 } },
                yAxis: { type: 'category', data: categories, splitArea: { show: true }, axisLabel: { color: '#bcc6d4', fontSize: 9 } },
                visualMap: {
                    min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: '0%',
                    inRange: { color: ['#ef4444', '#64748b', '#10b981'] },
                    textStyle: { color: '#fff' }
                },
                series: [{
                    name: 'Sentiment Score',
                    type: 'heatmap',
                    data: heatmapData,
                    label: { show: false },
                    emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
                }]
            });
        }
    };

    createEffect(() => { initCharts(); });
    createEffect(() => { initHeatmap(); });

    onCleanup(() => {
        disposeCharts();
    });

    const handleResearch = async (e) => {
        e.preventDefault();
        const query = keyword();
        if (!query) return;

        setIsResearching(true);
        setResearchResults(null);
        setApiError(null);
        setActiveTab('RESEARCH');

        try {
            const data = await fetchWithRetry(
                `${import.meta.env.VITE_SENTIMENT_URL}/api/sentiment/research?keyword=${encodeURIComponent(query)}`
            );
            setResearchResults(data.data);
        } catch (e) {
            console.error(e);
            setApiError("Failed to fetch research data. Please try again.");
        } finally {
            setIsResearching(false);
        }
    };

    return (
        <div class="h-full w-full bg-bg_main text-text_primary overflow-hidden flex flex-col font-mono text-[11px] uppercase tracking-tighter">

            {/* STAGGERED HEADER */}
            <div class="flex-shrink-0 p-6 border-b border-border_main bg-bg_header flex items-center justify-between z-20 shadow-xl">
                <div class="flex items-center gap-6">
                    <div class="p-3 bg-text_accent/10 border border-text_accent shadow-[0_0_15px_rgba(0,255,65,0.2)]">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-text_accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                    </div>
                    <div>
                        <h1 class="text-xl font-black text-text_primary tracking-[0.2em]">SENTIMENT ANALYSIS MONITOR // <span class="text-text_accent">ANALYTICS v4</span></h1>
                        <div class="flex items-center gap-2 mt-1 opacity-50">
                            <div class="w-1.5 h-1.5 rounded-full bg-text_accent animate-ping"></div>
                            <span class="text-[8px] tracking-[0.3em]">SYSTEM STATUS: ONLINE // DATA SCAN: ACTIVE // SYNC: {new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="flex bg-bg_main border border-border_main p-1 rounded-sm">
                        <button
                            onClick={() => setActiveTab('OVERVIEW')}
                            class={`px-4 py-1.5 text-[10px] font-black transition-all ${activeTab() === 'OVERVIEW' ? 'bg-text_accent text-bg_main' : 'text-text_secondary opacity-40 hover:opacity-100'}`}
                        >OVERVIEW</button>
                        <button
                            onClick={() => setActiveTab('RESEARCH')}
                            class={`px-4 py-1.5 text-[10px] font-black transition-all ${activeTab() === 'RESEARCH' ? 'bg-text_accent text-bg_main' : 'text-text_secondary opacity-40 hover:opacity-100'}`}
                        >DEEP ANALYSIS</button>

                    </div>
                    <button
                        onClick={fetchFreshSummary}
                        class={`p-2.5 border border-text_accent text-text_accent hover:bg-text_accent hover:text-bg_main transition-all ${isLoading() ? 'animate-spin opacity-50' : ''}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto win-scroll p-6 space-y-8 pb-32">

                {/* OVERVIEW CONTENT */}
                <Show when={activeTab() === 'OVERVIEW'}>
                    <div class="grid grid-cols-12 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                        {/* LEFT: GLOBAL METRICS */}
                        <div class="col-span-12 xl:col-span-4 flex flex-col gap-6">
                            {/* SENTIMENT SLIDER */}
                            <div class="bg-bg_header/30 border border-border_main p-4 flex flex-col gap-4 shadow-2xl relative overflow-hidden group">
                                <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 9.5h3v7h-3zm5-5h3v12h-3zm5 10h3v2h-3zm5-5h3v7h-3z" /></svg>
                                </div>
                                <span class="text-[10px] font-black text-text_accent tracking-widest">SENTIMENT METER // SLIDER</span>
                                
                                <Show when={summary() && summary().status === 'success'} fallback={<div class="h-[120px] flex items-center justify-center text-text_secondary/20 font-black animate-pulse uppercase tracking-[0.5em]">SYNCING SENSORS...</div>}>
                                    {(() => {
                                        const data = summary().data;
                                        const totalPos = data.reduce((acc, row) => acc + (row.POSITIVE || Math.round((row.total * row.positive_pct / 100) || 0)), 0);
                                        const totalNeg = data.reduce((acc, row) => acc + (row.NEGATIVE || Math.round((row.total * row.negative_pct / 100) || 0)), 0);
                                        const totalNeu = data.reduce((acc, row) => acc + (row.NEUTRAL || Math.round((row.total * row.neutral_pct / 100) || 0)), 0);
                                        const totalArt = totalPos + totalNeg + totalNeu;
                                        const score = totalArt > 0 ? ((totalPos - totalNeg) / totalArt) * 100 : 0;
                                        const percentage = ((score + 100) / 200) * 100;
                                        
                                        return (
                                            <div class="py-10 px-2">
                                                <div class="relative h-2 bg-bg_main border border-border_main rounded-full overflow-visible">
                                                    {/* Gradient Background */}
                                                    <div class="absolute inset-0 flex rounded-full overflow-hidden opacity-30">
                                                        <div class="flex-1 bg-red-500"></div>
                                                        <div class="flex-1 bg-slate-500"></div>
                                                        <div class="flex-1 bg-green-500"></div>
                                                    </div>
                                                    
                                                    {/* Pointer */}
                                                    <div 
                                                        class="absolute -top-3 h-8 w-1 bg-text_accent shadow-[0_0_15px_#00ff41] z-10 transition-all duration-1000 ease-out"
                                                        style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
                                                    >
                                                        <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-text_accent font-black text-[16px] whitespace-nowrap">
                                                            {score.toFixed(1)}
                                                        </div>
                                                        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-text_accent"></div>
                                                    </div>
                                                </div>
                                                <div class="flex justify-between mt-4 text-[7px] text-text_secondary font-black tracking-[0.2em]">
                                                    <span class="text-red-500">EXTREME FEAR</span>
                                                    <span>NEUTRAL</span>
                                                    <span class="text-green-500">EXTREME GREED</span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </Show>
                            </div>

                            {/* DISTRIBUTION WITH TABLE */}
                            <div class="bg-bg_header/30 border border-border_main p-4 flex flex-col gap-4 shadow-2xl">
                                <span class="text-[10px] font-black text-text_accent tracking-widest">DISTRIBUTION ANALYSIS</span>
                                <div class="flex flex-col gap-4">
                                    <div ref={pieChartRef} class="h-[180px] w-full"></div>
                                    
                                    <Show when={summary() && summary().status === 'success'}>
                                        {(() => {
                                            const data = summary().data;
                                            const totalPos = data.reduce((acc, row) => acc + (row.POSITIVE || Math.round((row.total * row.positive_pct / 100) || 0)), 0);
                                            const totalNeg = data.reduce((acc, row) => acc + (row.NEGATIVE || Math.round((row.total * row.negative_pct / 100) || 0)), 0);
                                            const totalNeu = data.reduce((acc, row) => acc + (row.NEUTRAL || Math.round((row.total * row.neutral_pct / 100) || 0)), 0);
                                            const totalArt = totalPos + totalNeg + totalNeu;
                                            
                                            const stats = [
                                                { label: 'POSITIVE', count: totalPos, color: 'text-green-400', bg: 'bg-green-500/10' },
                                                { label: 'NEGATIVE', count: totalNeg, color: 'text-red-400', bg: 'bg-red-500/10' },
                                                { label: 'NEUTRAL', count: totalNeu, color: 'text-slate-400', bg: 'bg-slate-500/10' }
                                            ];

                                            return (
                                                <div class="border-t border-border_main pt-4 space-y-1">
                                                    <div class="grid grid-cols-3 text-[8px] font-black text-text_secondary mb-2 opacity-50 px-2">
                                                        <span>SENTIMENT</span>
                                                        <span class="text-right">COUNT</span>
                                                        <span class="text-right">SHARE %</span>
                                                    </div>
                                                    <For each={stats}>
                                                        {(s) => (
                                                            <div class={`grid grid-cols-3 p-2 border border-transparent hover:border-border_main transition-colors ${s.bg}`}>
                                                                <span class={`font-black ${s.color}`}>{s.label}</span>
                                                                <span class="text-right font-mono">{s.count}</span>
                                                                <span class="text-right font-mono text-text_accent">
                                                                    {totalArt > 0 ? ((s.count / totalArt) * 100).toFixed(1) : '0.0'}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </For>
                                                    <div class="grid grid-cols-3 p-2 bg-text_accent/5 border-t border-text_accent/20 mt-2">
                                                        <span class="font-black text-text_primary">TOTAL</span>
                                                        <span class="text-right font-mono">{totalArt}</span>
                                                        <span class="text-right font-mono">100%</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </Show>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: CATEGORY BREAKDOWN */}
                        <div class="col-span-12 xl:col-span-8 flex flex-col gap-6">
                            <div class="bg-bg_header/30 border border-border_main p-4 shadow-2xl h-full">
                                <span class="text-[10px] font-black text-text_accent tracking-widest">CATEGORY NET SCORE</span>
                                <div ref={barChartRef} class="h-[450px] w-full"></div>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* RESEARCH CONTENT */}
                <Show when={activeTab() === 'RESEARCH'}>
                    <div class="flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-500">

                        {/* SEARCH BAR */}
                        <form onSubmit={handleResearch} class="flex gap-2">
                            <input
                                type="text"
                                value={keyword()}
                                onInput={(e) => setKeyword(e.target.value)}
                                placeholder="ENTER KEYWORD (e.g., 'FED', 'OIL', 'BI')..."
                                class="flex-1 bg-bg_main border border-border_main p-3 text-text_primary placeholder-text_secondary focus:border-text_accent focus:outline-none transition-colors"
                            />
                            <button
                                type="submit"
                                disabled={isResearching()}
                                class="px-6 py-3 bg-text_accent text-bg_main font-black tracking-widest hover:bg-text_accent/80 transition-colors disabled:opacity-50"
                            >
                                {isResearching() ? 'SCANNING...' : 'ANALYZE'}
                            </button>
                        </form>

                        <Show when={apiError()}>
                            <div class="bg-red-500/10 border border-red-500 p-4 text-red-400">
                                {apiError()}
                            </div>
                        </Show>

                        <Show when={researchResults()}>
                            <div class="grid grid-cols-12 gap-6">
                                <div class="col-span-12 xl:col-span-8 bg-bg_header/30 border border-border_main p-4 shadow-2xl">
                                    <span class="text-[10px] font-black text-text_accent tracking-widest">SENTIMENT HEATMAP // {keyword().toUpperCase()}</span>
                                    <div ref={heatmapChartRef} class="h-[400px] w-full"></div>
                                </div>
                                <div class="col-span-12 xl:col-span-4 flex flex-col gap-4">
                                    <div class="bg-bg_header/30 border border-border_main p-4 shadow-2xl">
                                        <span class="text-[10px] font-black text-text_accent tracking-widest">TOP ARTICLES</span>
                                        <div class="mt-2 space-y-2 max-h-[400px] overflow-y-auto win-scroll">
                                            <For each={researchResults().articles?.slice(0, 10) || []}>
                                                {(article) => (
                                                    <a href={article.link} target="_blank" class="block p-2 border border-border_main hover:border-text_accent transition-colors group">
                                                        <div class="flex items-center gap-2 mb-1">
                                                            <span class={`text-[8px] px-1.5 py-0.5 font-black ${article.sentiment === 'POSITIVE' ? 'bg-green-500/20 text-green-400' : article.sentiment === 'NEGATIVE' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                                                {article.sentiment}
                                                            </span>
                                                            <span class="text-[8px] text-text_secondary">{article.category}</span>
                                                        </div>
                                                        <p class="text-[10px] text-text_primary group-hover:text-text_accent transition-colors line-clamp-2">{article.title}</p>
                                                        <p class="text-[8px] text-text_secondary mt-1">{article.pubDate}</p>
                                                    </a>
                                                )}
                                            </For>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Show>
                    </div>
                </Show>
            </div>
        </div>
    );
}
