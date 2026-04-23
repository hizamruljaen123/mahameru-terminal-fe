import { createSignal, createResource, Show, For, onMount, createEffect } from 'solid-js';
import * as echarts from 'echarts';


const fetchGlobalSummary = async () => {
    try {
        const res = await fetch(`${import.meta.env.VITE_SENTIMENT_URL}/api/sentiment/summary-all`);
        const data = await res.json();
        return data;
    } catch(e) {
        console.error("error global summary: ", e);
        return {status: "error", data: []};
    }
};

export default function SentimentView() {

    const [summary, { refetch }] = createResource(fetchGlobalSummary);
    const [keyword, setKeyword] = createSignal('');
    const [researchResults, setResearchResults] = createSignal(null);
    const [isResearching, setIsResearching] = createSignal(false);
    const [activeTab, setActiveTab] = createSignal('OVERVIEW'); // OVERVIEW | RESEARCH | SENTIMENT TRENDS



    let gaugeChartRef;
    let pieChartRef;
    let barChartRef;
    let heatmapChartRef;
    let barChartResearchRef;


    const initCharts = () => {
        if (summary() && summary().status === 'success') {
            const data = summary().data;
            const totalPos = data.reduce((acc, row) => acc + row.POSITIVE, 0);
            const totalNeg = data.reduce((acc, row) => acc + row.NEGATIVE, 0);
            const totalNeu = data.reduce((acc, row) => acc + row.NEUTRAL, 0);
            const totalArt = totalPos + totalNeg + totalNeu;
            const globalScore = totalArt > 0 ? ((totalPos - totalNeg) / totalArt) * 100 : 0;

            // 1. GAUGE CHART (Mood)
            if (gaugeChartRef) {
                const chart = echarts.init(gaugeChartRef);
                chart.setOption({
                    backgroundColor: 'transparent',
                    series: [{
                        type: 'gauge',
                        startAngle: 180,
                        endAngle: 0,
                        min: -100,
                        max: 100,
                        splitNumber: 10,
                        axisLine: { lineStyle: { width: 6, color: [ [0.3, '#ef4444'], [0.7, '#64748b'], [1, '#10b981'] ] } },
                        pointer: { icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z', length: '12%', width: 20, offsetCenter: [0, '-60%'], itemStyle: { color: 'auto' } },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        title: { offsetCenter: [0, '-20%'], fontSize: 10, color: '#64748b', fontWeight: 'bold' },
                        detail: { fontSize: 24, offsetCenter: [0, '0%'], valueAnimation: true, formatter: '{value}', color: 'inherit', fontWeight: 'bold' },
                        data: [{ value: globalScore.toFixed(1), name: 'AVERAGE SCORE' }]
                    }]
                });
            }

            // 2. PIE CHART (Distribution)
            if (pieChartRef) {
                const chart = echarts.init(pieChartRef);
                chart.setOption({
                    tooltip: { trigger: 'item' },
                    series: [{
                        name: 'SENTIMENT DISTRIBUTION',
                        type: 'pie',
                        radius: ['50%', '80%'],
                        avoidLabelOverlap: false,
                        itemStyle: { borderRadius: 4, borderColor: '#0a1628', borderWidth: 2 },
                        label: { show: false },
                        emphasis: { label: { show: true, fontSize: 10, fontWeight: 'bold', color: '#fff' } },
                        labelLine: { show: false },
                        data: [
                            { value: totalPos, name: 'POSITIVE', itemStyle: { color: '#10b981' } },
                            { value: totalNeu, name: 'NEUTRAL', itemStyle: { color: '#64748b' } },
                            { value: totalNeg, name: 'NEGATIVE', itemStyle: { color: '#ef4444' } }
                        ]
                    }]
                });
            }

            // 3. HORIZONTAL BAR (Category Scores)
            const sortedData = [...data].sort((a,b) => b.score - a.score).slice(0, 10);
            const barOption = {
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                grid: { top: 10, left: 80, right: 30, bottom: 20 },
                xAxis: { splitLine: { show: false }, axisLabel: { color: '#64748b', fontSize: 9 } },
                yAxis: { 
                    type: 'category', 
                    data: sortedData.map(d => d.category), 
                    axisLabel: { color: '#bcc6d4', fontSize: 9, fontWeight: 'bold' },
                    axisLine: { show: false },
                    tickLine: { show: false }
                },
                series: [{
                    name: 'NET_SCORE',
                    type: 'bar',
                    data: sortedData.map(d => ({
                        value: d.score.toFixed(1),
                        itemStyle: { color: d.score > 0 ? '#10b981' : d.score < 0 ? '#ef4444' : '#64748b' }
                    })),
                    label: { show: true, position: 'right', fontSize: 9, color: '#fff' }
                }]
            };

            if (barChartRef) {
                const chart = echarts.init(barChartRef);
                chart.setOption(barOption);
            }
            if (barChartResearchRef) {
                const chart = echarts.init(barChartResearchRef);
                chart.setOption(barOption);
            }
        }
    };

    const initHeatmap = () => {
        if (researchResults() && heatmapChartRef) {
            const articles = researchResults().articles;
            const categories = [...new Set(articles.map(a => a.category))].slice(0, 8);
            // Group by actual dates in the dataset for a realistic time-bucket
            const dates = [...new Set(articles.map(a => a.pubDate.split(' ')[0]))].sort().slice(-14);
            
            const heatmapData = [];
            categories.forEach((cat, cIdx) => {
                dates.forEach((d, dIdx) => {
                    const matched = articles.filter(a => a.category === cat && a.pubDate.startsWith(d));
                    let score = 0;
                    if (matched.length > 0) {
                        const pos = matched.filter(a => a.sentiment === 'POSITIVE').length;
                        const neg = matched.filter(a => a.sentiment === 'NEGATIVE').length;
                        score = (pos - neg) / matched.length; // Range [-1, 1]
                    }
                    if (matched.length > 0) {
                        heatmapData.push([dIdx, cIdx, score.toFixed(2)]);
                    } else {
                        heatmapData.push([dIdx, cIdx, null]); // Exclude empty cells
                    }
                });
            });

            const chart = echarts.init(heatmapChartRef);
            chart.setOption({
                tooltip: { 
                    position: 'top',
                    formatter: function (params) {
                        if (params.data[2] === null) return `No Data`;
                        return `<div style="font-size:9px"><b>${dates[params.data[0]]} | ${categories[params.data[1]]}</b><br/>Net Sentiment: <b>${params.data[2]}</b></div>`;
                    }
                },
                grid: { height: '70%', top: '10%', left: '15%' },
                xAxis: { type: 'category', data: dates, splitArea: { show: true }, axisLabel: { fontSize: 7, color: '#64748b' } },
                yAxis: { type: 'category', data: categories, splitArea: { show: true }, axisLabel: { fontSize: 8, color: '#bcc6d4', fontWeight: 'bold', width: 90, overflow: 'truncate' } },
                visualMap: {
                    min: -1,
                    max: 1,
                    calculable: true,
                    orient: 'horizontal',
                    left: 'center',
                    bottom: '5%',
                    inRange: { color: ['#ef4444', '#64748b', '#10b981'] },
                    show: false
                },
                series: [{
                    name: 'SENTIMENT PULSE',
                    type: 'heatmap',
                    data: heatmapData,
                    label: { show: false },
                    emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
                }]
            });
        }
    };



    createEffect(() => initCharts());
    createEffect(() => { initHeatmap(); });

    const handleResearch = async (e) => {
        e.preventDefault();
        const query = keyword();
        if (!query) return;
        
        setIsResearching(true);
        setResearchResults(null);
        setActiveTab('RESEARCH');
        
        try {
            // STEP 1: Fetch Basic Data (Fast)
            const res = await fetch(`${import.meta.env.VITE_SENTIMENT_URL}/api/sentiment/research?keyword=${encodeURIComponent(query)}`);
            const data = await res.json();
            setResearchResults(data.data);
            setIsResearching(false);
        } catch (e) {
            console.error(e);
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
                        onClick={() => { refetch(); }}
                        class="p-2.5 border border-text_accent text-text_accent hover:bg-text_accent hover:text-bg_main transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto win-scroll p-6 space-y-8 pb-32">
                
                {/* OVERVIEW CONTENT */}
                <Show when={activeTab() === 'OVERVIEW'}>
                    <div class="grid grid-cols-12 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                        {/* LEFT: GLOBAL METRICS */}
                        <div class="col-span-12 xl:col-span-4 flex flex-col gap-6">
                            <div class="bg-bg_header/30 border border-border_main p-4 flex flex-col gap-4 shadow-2xl relative overflow-hidden group">
                                <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 9.5h3v7h-3zm5-5h3v12h-3zm5 10h3v2h-3zm5-5h3v7h-3z"/></svg>
                                </div>
                                <span class="text-[10px] font-black text-text_accent tracking-widest">SENTIMENT GAUGE</span>
                                <div ref={gaugeChartRef} class="h-[200px] w-full"></div>
                                <div class="border-t border-border_main pt-4 flex justify-between">
                                    <div class="flex flex-col">
                                        <span class="text-[8px] text-text_secondary">STABILITY</span>
                                        <span class="text-xs font-black text-text_accent">STABLE</span>
                                    </div>
                                    <div class="flex flex-col items-end">
                                        <span class="text-[8px] text-text_secondary">VOLATILITY</span>
                                        <span class="text-xs font-black text-red-400">0.02%</span>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-bg_header/30 border border-border_main p-4 flex flex-col gap-4 shadow-2xl">
                                <span class="text-[10px] font-black text-text_secondary tracking-widest">SENTIMENT DISTRIBUTION</span>
                                <div ref={pieChartRef} class="h-[180px] w-full"></div>
                            </div>
                        </div>

                        {/* MIDDLE: TOP CATEGORIES SCORE */}
                        <div class="col-span-12 xl:col-span-8 flex flex-col gap-6">
                            <div class="bg-bg_header/30 border border-border_main p-6 flex flex-col gap-4 shadow-2xl h-full">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-[10px] font-black text-text_primary tracking-[.4em]">NET SENTIMENT BY CATEGORY</span>
                                    <span class="text-[8px] text-text_accent opacity-50">LATEST SYNC: {new Date().toLocaleTimeString()}</span>
                                </div>
                                <div ref={barChartRef} class="flex-1 min-h-[350px]"></div>
                            </div>
                        </div>

                        {/* BOTTOM: THE DETAILED CARDS (STAGGERED) */}
                        <div class="col-span-12">
                             <div class="flex items-center gap-4 mb-6">
                                <div class="h-px flex-1 bg-border_main/30"></div>
                                <h3 class="text-[10px] font-black tracking-[.8em] text-text_secondary opacity-40">REAL-TIME CATEGORY BREAKDOWN</h3>
                                <div class="h-px flex-1 bg-border_main/30"></div>
                             </div>
                             
                             <Show when={summary() && summary().status === 'success'}>
                                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                    <For each={summary().data}>
                                        {(row, index) => (
                                            <div 
                                                class="bg-bg_header/20 border border-border_main group hover:border-text_accent/50 transition-all p-4 flex flex-col gap-2 relative overflow-hidden animate-in fade-in"
                                                style={{ "animation-delay": `${index() * 50}ms` }}
                                            >
                                                <div class="flex justify-between items-start mb-2">
                                                    <span class="text-[10px] font-black text-text_primary tracking-wider">{row.category}</span>
                                                    <span class={`text-[12px] font-black ${row.score > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {row.score > 0 ? '▲' : '▼'}{Math.abs(row.score).toFixed(0)}
                                                    </span>
                                                </div>
                                                
                                                <div class="flex items-center gap-[1px] h-1.5 bg-bg_main border border-border_main/20">
                                                    <div class="h-full bg-green-500/80" style={{ width: `${(row.POSITIVE / row.total) * 100}%` }}></div>
                                                    <div class="h-full bg-slate-500/80" style={{ width: `${(row.NEUTRAL / row.total) * 100}%` }}></div>
                                                    <div class="h-full bg-red-500/80" style={{ width: `${(row.NEGATIVE / row.total) * 100}%` }}></div>
                                                </div>

                                                <div class="mt-2 grid grid-cols-2 gap-2 text-[8px] font-bold">
                                                    <div class="flex flex-col">
                                                        <span class="text-text_secondary opacity-40">VOLUME</span>
                                                        <span class="text-text_primary">{row.total} PKT</span>
                                                    </div>
                                                    <div class="flex flex-col items-end">
                                                        <span class="text-text_secondary opacity-40">DOMINANCE</span>
                                                        <span class={row.sentiment_status === 'positive' ? 'text-green-500' : 'text-red-500'}>{row.sentiment_status.toUpperCase()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                             </Show>
                        </div>
                    </div>
                </Show>


                {/* RESEARCH CONTENT */}
                <Show when={activeTab() === 'RESEARCH'}>
                    <div class="flex flex-col gap-8 animate-in zoom-in-95 duration-500">
                        {/* SEARCH CONSOLE */}
                        <div class="bg-bg_header/40 border-2 border-text_accent/30 p-8 shadow-2xl relative overflow-hidden group rounded-sm">
                            <div class="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-32 h-32 text-text_accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                            </div>
                            
                            <div class="relative z-10 flex flex-col gap-6">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 bg-text_accent/20 border border-text_accent">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-text_accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                    </div>
                                    <div>
                                        <h2 class="text-xs font-black text-text_primary tracking-widest uppercase">TOPIC RESEARCH CONSOLE</h2>
                                        <p class="text-[9px] text-text_secondary mt-1 tracking-widest opacity-60">CORRELATED TOPIC DETECTION // ANALYSIS SCAN</p>
                                    </div>
                                </div>

                                <form onSubmit={handleResearch} class="flex gap-4">
                                    <input 
                                        type="text" 
                                        placeholder="ENTER TOPIC TO ANALYZE..."
                                        value={keyword()}
                                        onInput={(e) => setKeyword(e.target.value)}
                                        class="flex-1 bg-bg_main border border-border_main px-6 py-4 text-xs font-bold focus:border-text_accent focus:outline-none focus:ring-4 focus:ring-text_accent/10 transition-all uppercase tracking-widest placeholder:opacity-30"
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={isResearching()}
                                        class={`px-12 py-4 bg-text_accent text-bg_main font-black tracking-widest hover:brightness-125 hover:shadow-[0_0_20px_rgba(0,255,65,0.4)] transition-all flex items-center gap-3 ${isResearching() ? 'opacity-50' : ''}`}
                                    >
                                        {isResearching() ? 'ANALYZING...' : 'RUN SEARCH'}
                                        <svg xmlns="http://www.w3.org/2000/svg" class={`w-4 h-4 ${isResearching() ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* RESEARCH LOADING PLACEHOLDER */}
                        <Show when={isResearching()}>
                            <div class="h-64 flex flex-col items-center justify-center border border-border_main py-10 opacity-50 animate-pulse">
                                <div class="w-12 h-12 rounded-full border-4 border-t-text_accent animate-spin mb-4"></div>
                                <div class="text-[12px] tracking-[0.5em] font-black">SEARCHING DATA...</div>
                            </div>
                        </Show>

                        {/* RESEARCH RESULTS */}
                        <Show when={researchResults()}>
                            <div class="grid grid-cols-12 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
                                
                                {/* HEATMAP OVERVIEW */}
                                <div class="col-span-12 xl:col-span-8 bg-bg_header/20 border border-border_main p-6 flex flex-col gap-4 shadow-xl h-[400px]">
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-[10px] font-black text-text_accent tracking-widest">SENTIMENT HEATMAP // {keyword()}</span>
                                        <span class="text-[8px] opacity-40 uppercase">SYNC v3</span>
                                    </div>
                                    <div ref={heatmapChartRef} class="flex-1 w-full"></div>
                                </div>

                                {/* QUICK STAT                                 <div class="col-span-12 xl:col-span-4 flex flex-col gap-4">
                                    <div class="flex-1 bg-bg_main border border-border_main p-6 flex flex-col items-center justify-center relative group overflow-hidden">
                                        <div class="absolute inset-0 bg-green-500/5 group-hover:bg-green-500/10 transition-colors"></div>
                                        <span class="text-[12px] font-black text-green-500 mb-2 tracking-widest">POSITIVE ARTICLES</span>
                                        <span class="text-5xl font-black text-text_primary">{researchResults().sentiment_dist.POSITIVE}</span>
                                        <span class="mt-4 text-[8px] opacity-30">TRUST LEVEL: HIGH</span>
                                    </div>
                                    <div class="flex-1 bg-bg_main border border-border_main p-6 flex flex-col items-center justify-center relative group overflow-hidden">
                                        <div class="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
                                        <span class="text-[12px] font-black text-red-500 mb-2 tracking-widest">NEGATIVE ARTICLES</span>
                                        <span class="text-5xl font-black text-text_primary">{researchResults().sentiment_dist.NEGATIVE}</span>
                                        <span class="mt-4 text-[8px] opacity-30">ALERT LEVEL: MODERATE</span>
                                    </div>
                                </div></div>



                                {/* CATEGORY BAR CHART IN RESEARCH */}
                                <div class="col-span-12 xl:col-span-4 bg-bg_header/20 border border-border_main p-4 h-[300px]">
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-[10px] font-black text-text_primary tracking-widest">GLOBAL CATEGORY</span>
                                    </div>
                                    <div ref={barChartResearchRef} class="w-full h-full"></div>
                                </div>

                                {/* RECENT DOCS GRID */}
                                <div class="col-span-12">
                                     <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <For each={researchResults().articles.slice(0, 50)}>
                                            {(art) => (
                                                <div 
                                                    onClick={() => window.open(art.link, '_blank')}
                                                    class="p-4 bg-bg_header/10 border-l-2 hover:bg-bg_header/30 hover:translate-x-1 cursor-pointer transition-all flex flex-col gap-2 group"
                                                    style={{ "border-color": art.sentiment === 'POSITIVE' ? '#10b981' : art.sentiment === 'NEGATIVE' ? '#ef4444' : '#64748b' }}
                                                >
                                                    <div class="flex justify-between items-center opacity-40 group-hover:opacity-100 transition-opacity">
                                                        <span class="text-[7px] font-black tracking-widest">{art.category}</span>
                                                        <span class="text-[7px]">{new Date(art.pubDate).toLocaleString()}</span>
                                                    </div>
                                                    <h4 class="text-[10px] font-bold leading-relaxed line-clamp-2 uppercase group-hover:text-text_accent">
                                                        {art.title}
                                                    </h4>
                                                    <div class="mt-2 flex items-center justify-between">
                                                        <span class={`text-[8px] font-black px-2 py-0.5 ${art.sentiment === 'POSITIVE' ? 'bg-green-500/20 text-green-500' : art.sentiment === 'NEGATIVE' ? 'bg-red-500/20 text-red-500' : 'bg-slate-500/20 text-slate-400'}`}>
                                                            {art.sentiment}
                                                        </span>
                                                        <span class="text-[8px] opacity-20">REF_ID: #{art.id}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                     </div>
                                </div>

                            </div>
                        </Show>

                         <Show when={!researchResults() && !isResearching()}>
                                     <div class="h-64 flex flex-col items-center justify-center border border-border_main/30 border-dashed opacity-20 gap-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                                        <span class="text-sm font-black tracking-[1em]">AWAITING INPUT</span>
                                     </div>
                                 </Show>
                    </div>
                </Show>
            </div>

            {/* FOOTER STATUS */}
            <div class="flex-shrink-0 h-10 px-6 bg-bg_header border-t border-border_main flex items-center justify-between shadow-2xl z-40 relative">
                <div class="flex gap-10 text-[8px] font-bold text-text_secondary tracking-[0.4em]">
                    <span class="flex items-center gap-2"><div class="w-1 h-1 bg-green-500 rounded-full"></div> NEURAL_ENGINE: v2.4</span>
                    <span class="flex items-center gap-2"><div class="w-1 h-1 bg-text_accent rounded-full"></div> ANALYTICS: ACTIVE</span>
                </div>
                <div class="text-[9px] font-black text-text_primary tracking-[0.3em] opacity-40 italic">
                    ENQY TERMINAL // SENTIMENT ANALYTICS
                </div>
            </div>
        </div>
    );
}
