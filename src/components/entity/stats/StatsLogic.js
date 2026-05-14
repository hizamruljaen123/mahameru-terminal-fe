/**
 * StatsLogic.js — Statistical Testing Engine (Frontend)
 * Handles API fetching, ECharts rendering, Mermaid.js diagrams, and table population
 * Modular companion to EntityAdvancedLogic.js
 */
import * as echarts from 'echarts';

// ============================================================
// STATE
// ============================================================
let statsData = null;
let statsCharts = {};
let currentSymbol = '';
let currentPeriod = '6mo';
let activeCategories = new Set([
    'normality', 'stationarity', 'autocorrelation',
    'distribution', 'descriptive', 'variance', 'correlation'
]);
let currentCategoryTab = 'normality';
let statsAbortController = null;

// ============================================================
// API
// ============================================================
export const fetchStatsAnalysis = async (symbol, period, categories = null) => {
    if (statsAbortController) statsAbortController.abort('REPLACED');
    statsAbortController = new AbortController();

    const catsParam = categories
        ? Array.from(categories).join(',')
        : Array.from(activeCategories).join(',');

    const url = `${import.meta.env.VITE_ENTITY_URL}/api/entity/stats/${symbol}?period=${period}&categories=${catsParam}`;
    const res = await fetch(url, { signal: statsAbortController.signal });
    return res.json();
};

// ============================================================
// MAIN ORCHESTRATOR
// ============================================================
export const runStatisticalBattery = async (symbol, period) => {
    currentSymbol = symbol;
    currentPeriod = period;

    const panel = document.getElementById('statsPanel');
    const statusEl = document.getElementById('statsStatus');
    const loadingEl = document.getElementById('statsLoading');

    if (panel) panel.classList.remove('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (statusEl) {
        statusEl.textContent = 'EXECUTING STATISTICAL BATTERY...';
        statusEl.classList.add('animate-pulse', 'text-cyan-400');
    }

    try {
        statsData = await fetchStatsAnalysis(symbol, period);
        disposeAllCharts();

        if (statusEl) {
            statusEl.textContent = `BATTERY COMPLETE — ${statsData.summary?.total_tests || '?'} TESTS`;
            statusEl.classList.remove('animate-pulse');
        }
        if (loadingEl) loadingEl.classList.add('hidden');

        renderSummaryRow(statsData);
        renderCategoryTabs(statsData);
        renderActiveCategory(statsData);

        // Heatmap rendering
        const heatmapDom = document.getElementById('statsCorrelationHeatmap');
        const heatmapData = statsData.categories?.correlation?.charts?.heatmap;
        if (heatmapDom && heatmapData) {
            heatmapDom.classList.remove('hidden');
            renderCorrelationHeatmap('statsCorrelationHeatmap', heatmapData);
        } else if (heatmapDom) {
            heatmapDom.classList.add('hidden');
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('[STATS] Battery failed:', err);
            if (statusEl) {
                statusEl.textContent = 'EXECUTION FAILED';
                statusEl.classList.remove('animate-pulse');
                statusEl.classList.add('text-red-500');
            }
            if (loadingEl) loadingEl.classList.add('hidden');
        }
    }
};

window.runStatisticalBattery = runStatisticalBattery;

// ============================================================
// SUMMARY ROW
// ============================================================
const renderSummaryRow = (data) => {
    const s = data.summary || {};
    const badges = document.getElementById('statsSummaryBadges');
    if (!badges) return;

    const cls = (cond) => cond ? 'text-red-500' : 'text-green-500';

    badges.innerHTML = `
        <div class="flex flex-wrap gap-3 text-[10px] font-mono">
            <span class="px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-cyan-400 font-black">${s.total_tests || '?'} TESTS</span>
            <span class="px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400 font-black">${s.significant_tests || '?'} SIG</span>
            <span class="px-2 py-1 rounded font-black border ${s.normality_rejected ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}">NORMALITY: ${s.normality_rejected ? 'REJECTED' : 'NORMAL'}</span>
            <span class="px-2 py-1 rounded font-black border ${s.stationarity === 'STATIONARY' ? 'bg-green-500/10 border-green-500/20 text-green-400' : s.stationarity === 'NON-STATIONARY' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}">STAT: ${s.stationarity || '?'}</span>
            <span class="px-2 py-1 rounded font-black border ${s.autocorrelation_present ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}">AUTOCORR: ${s.autocorrelation_present ? 'YES' : 'NO'}</span>
            <span class="px-2 py-1 rounded font-black border ${s.fat_tails ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}">FAT TAILS: ${s.fat_tails ? 'YES' : 'NO'}</span>
            <span class="px-2 py-1 rounded font-black border ${s.regime_stability === 'REGIME_SHIFT_DETECTED' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'}">REGIME: ${s.regime_stability || '?'}</span>
        </div>
        <div class="text-[9px] text-text_dim mt-2 italic">${s.overall_verdict || ''}</div>
    `;
};
// ============================================================
// CATEGORY TABS
// ============================================================
const renderCategoryTabs = (data) => {
    const container = document.getElementById('statsCategoryTabs');
    if (!container) return;

    const categories = data.categories || {};
    let html = '';

    for (const [key, cat] of Object.entries(categories)) {
        const isActive = key === currentCategoryTab;
        html += `
            <button 
                class="stats-cat-tab px-4 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${isActive 
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' 
                    : 'border-transparent text-text_dim hover:text-text_main hover:bg-white/5'}"
                data-cat="${key}"
            >
                ${cat.icon || ''} ${cat.label}
            </button>
        `;
    }

    container.innerHTML = html;

    container.querySelectorAll('.stats-cat-tab').forEach(btn => {
        btn.onclick = () => {
            currentCategoryTab = btn.dataset.cat;
            renderCategoryTabs(data);
            renderActiveCategory(data);
        };
    });
};

const renderActiveCategory = (data) => {
    const tableContainer = document.getElementById('statsTablesContainer');
    const mermaidContainer = document.getElementById('statsMermaidContainer');
    const heatmapDom = document.getElementById('statsCorrelationHeatmap');

    if (!tableContainer || !mermaidContainer || !heatmapDom) return;

    // Reset
    tableContainer.innerHTML = '';
    mermaidContainer.innerHTML = '';
    heatmapDom.classList.add('hidden');
    disposeAllCharts();

    const catData = data.categories?.[currentCategoryTab];
    if (!catData) return;

    if (currentCategoryTab === 'correlation') {
        renderCorrelationMermaid(data);
        const hData = catData.charts?.heatmap;
        if (hData) {
            heatmapDom.classList.remove('hidden');
            renderCorrelationHeatmap('statsCorrelationHeatmap', hData);
        }
    } else {
        // Render Table
        tableContainer.innerHTML = buildCategoryTableHtml(currentCategoryTab, catData);
        
        // Render Charts for this category
        const chartDom = document.getElementById(`stats-chart-${currentCategoryTab}`);
        if (chartDom && catData.charts) {
            const chartKeys = Object.keys(catData.charts);
            if (chartKeys.length > 1) {
                renderMultiChartCategory(currentCategoryTab, chartDom, catData, chartKeys);
            } else if (chartKeys.length === 1) {
                renderSingleChart(currentCategoryTab, chartDom, catData.charts[chartKeys[0]], chartKeys[0]);
            }
        }
    }
};

// ============================================================
// CATEGORY TABLES
// ============================================================
const buildCategoryTableHtml = (catKey, catData) => {
    if (!catData.tests || catData.tests.length === 0) return '';
    
    const rows = (catData.tests || []).map(t => {
        const sig = t.is_significant;
        const sigCls = sig ? 'text-red-500' : 'text-green-500';
        const sigLabel = sig ? 'YES' : 'NO';
        return `
            <tr class="hover:bg-cyan-500/5 transition-colors">
                <td class="p-2 pl-3 text-text_secondary font-bold border-r border-border_main/5">${t.name}</td>
                <td class="p-2 text-right tabular-nums font-mono border-r border-border_main/5">${t.statistic != null ? (typeof t.statistic === 'number' ? t.statistic.toFixed(4) : t.statistic) : '—'}</td>
                <td class="p-2 text-right tabular-nums font-mono border-r border-border_main/5 ${sig ? 'text-red-400' : 'text-text_dim'}">${t.p_value != null ? t.p_value.toFixed(4) : '—'}</td>
                <td class="p-2 text-center border-r border-border_main/5"><span class="${sigCls} font-black text-[8px]">${sigLabel}</span></td>
                <td class="p-2 font-black text-[9px] border-r border-border_main/5 ${sig ? 'text-red-400' : 'text-green-400'}">${t.verdict || '—'}</td>
                <td class="p-2 pr-3 text-text_dim text-[8px]">${t.interpretation || ''}</td>
            </tr>
        `;
    }).join('');

    const combinedRow = catData.combined_verdict ? `
        <tr class="bg-cyan-500/5 border-t-2 border-cyan-500/30">
            <td class="p-2 pl-3 text-cyan-400 font-black">COMBINED VERDICT</td>
            <td class="p-2 text-right">—</td>
            <td class="p-2 text-right">—</td>
            <td class="p-2 text-center">—</td>
            <td class="p-2 font-black text-cyan-400">${catData.combined_verdict}</td>
            <td class="p-2 pr-3 text-cyan-300/70 text-[8px]">${catData.combined_interpretation || ''}</td>
        </tr>
    ` : '';

    return `
    <div class="mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300" id="stats-cat-${catKey}">
        <div class="flex items-center justify-between mb-4 bg-cyan-500/5 p-3 border-l-2 border-cyan-500">
            <div>
                <h4 class="text-[11px] font-black text-cyan-400 uppercase tracking-[0.2em]">
                    ${catData.icon || '▸'} ${catData.label}
                </h4>
                <p class="text-text_dim text-[9px] mt-1 uppercase opacity-70 font-bold">${catData.description || ''}</p>
            </div>
            <div class="px-3 py-1 bg-cyan-500/10 rounded text-cyan-400 text-[9px] font-black border border-cyan-500/20">
                ${catData.summary || ''}
            </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-[10px] border-collapse font-mono border border-border_main/20 rounded-sm">
                    <thead class="bg-[#0a0a0a] text-text_secondary text-[8px] uppercase font-black">
                        <tr>
                            <th class="p-2 pl-3 border-r border-border_main/10">TEST</th>
                            <th class="p-2 text-right border-r border-border_main/10">STATISTIC</th>
                            <th class="p-2 text-right border-r border-border_main/10">P-VALUE</th>
                            <th class="p-2 text-center border-r border-border_main/10 w-16">SIG</th>
                            <th class="p-2 border-r border-border_main/10">VERDICT</th>
                            <th class="p-2 pr-3">INTERPRETATION</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-border_main/10 bg-[#020202]">
                        ${rows}
                        ${combinedRow}
                    </tbody>
                </table>
            </div>
            <div id="stats-chart-${catKey}" class="bg-[#020202] border border-border_main/10 rounded-sm overflow-hidden" style="height: 400px;">
                <!-- Chart content populated by renderActiveCategory -->
            </div>
        </div>
    </div>
    `;
};

// ============================================================
// CHART RENDERING (ECharts)
// ============================================================
const renderAllCharts = (data) => {
    for (const [catKey, catData] of Object.entries(data.categories || {})) {
        if (!catData.charts) continue;

        const chartDom = document.getElementById(`stats-chart-${catKey}`);
        if (!chartDom) continue;

        // Render first available chart for this category
        const chartKeys = Object.keys(catData.charts);
        if (chartKeys.length === 0) continue;

        // Create a multi-chart container with tabs if multiple charts
        if (chartKeys.length > 1) {
            renderMultiChartCategory(catKey, chartDom, catData, chartKeys);
        } else {
            renderSingleChart(catKey, chartDom, catData.charts[chartKeys[0]], chartKeys[0]);
        }
    }
};

const renderMultiChartCategory = (catKey, container, catData, chartKeys) => {
    // Build tab navigation
    let tabHtml = '<div class="flex gap-1 px-3 py-2 bg-[#0a0a0a] border-b border-border_main/10">';
    chartKeys.forEach((key, idx) => {
        const label = catData.charts[key].title || key.replace(/_/g, ' ');
        tabHtml += `<button class="stats-tab-btn px-3 py-1 text-[9px] font-black uppercase tracking-wider border border-transparent rounded-sm text-text_dim hover:text-cyan-400 ${idx === 0 ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : ''}" data-cat="${catKey}" data-chart="${key}">${label}</button>`;
    });
    tabHtml += '</div>';

    const chartArea = document.createElement('div');
    chartArea.id = `stats-chart-inner-${catKey}`;
    chartArea.className = 'w-full';
    chartArea.style.height = '400px';

    container.innerHTML = tabHtml;
    container.appendChild(chartArea);

    // Render first chart
    renderSingleChart(catKey, chartArea, catData.charts[chartKeys[0]], chartKeys[0]);

    // Tab click handlers
    container.querySelectorAll('.stats-tab-btn').forEach(btn => {
        btn.onclick = () => {
            container.querySelectorAll('.stats-tab-btn').forEach(b => {
                b.classList.remove('bg-cyan-500/10', 'border-cyan-500/30', 'text-cyan-400');
                b.classList.add('text-text_dim', 'border-transparent');
            });
            btn.classList.add('bg-cyan-500/10', 'border-cyan-500/30', 'text-cyan-400');
            btn.classList.remove('text-text_dim', 'border-transparent');

            const ck = btn.dataset.chart;
            if (statsCharts[`${catKey}_${ck}`]) {
                statsCharts[`${catKey}_${ck}`].resize();
            } else {
                renderSingleChart(catKey, chartArea, catData.charts[ck], ck);
            }
        };
    });
};

const buildChartOption = (def) => ({
    backgroundColor: 'transparent',
    title: { 
        text: def.title || '', 
        left: 'center', 
        top: 8, 
        textStyle: { color: '#22d3ee', fontSize: 12, fontWeight: 'bold' } 
    },
    tooltip: { trigger: 'axis' },
    grid: { left: '10%', right: '5%', top: '15%', bottom: '10%' }
});

const renderSingleChart = (catKey, dom, chartDef, chartKey) => {
    if (!dom || !chartDef) return;

    const existingKey = `${catKey}_${chartKey}`;
    if (statsCharts[existingKey]) {
        statsCharts[existingKey].dispose();
    }

    const chart = echarts.init(dom, 'dark');
    statsCharts[existingKey] = chart;

    let option = buildChartOption(chartDef);

    // Special charts
    if (chartDef.type === 'scatter') {
        option = buildScatterOption(chartDef);
    } else if (chartDef.type === 'bar') {
        option = buildBarOption(chartDef);
    } else if (chartDef.type === 'line') {
        option = buildLineOption(chartDef);
    } else if (chartDef.type === 'bar_line') {
        option = buildBarLineOption(chartDef);
    } else if (chartDef.type === 'multi_line') {
        option = buildMultiLineOption(chartDef);
    } else if (chartDef.type === 'box') {
        option = buildBoxOption(chartDef);
    }

    chart.setOption(option);
};

// ============================================================
// ECHARTS OPTION BUILDERS
// ============================================================
const buildScatterOption = (def) => ({
    backgroundColor: 'transparent',
    title: { text: def.title || '', left: 'center', top: 8, textStyle: { color: '#818cf8', fontSize: 12, fontWeight: 'bold' } },
    tooltip: { trigger: 'item', formatter: p => `(${p.value[0].toFixed(4)}, ${p.value[1].toFixed(4)})` },
    xAxis: { type: 'value', name: def.x_label, nameTextStyle: { color: '#666' }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
    yAxis: { type: 'value', name: def.y_label, nameTextStyle: { color: '#666' }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
    series: [{ type: 'scatter', data: (def.points || []).map(p => [p.x, p.y]), symbolSize: 4, itemStyle: { color: '#22d3ee' } }],
    grid: { left: '10%', right: '5%', top: '15%', bottom: '10%' }
});

const buildBarOption = (def) => {
    const bars = def.bars || [];
    const data = bars.map(b => b.y);
    const labels = bars.map(b => b.x);
    const confBand = def.confidence_band;

    return {
        backgroundColor: 'transparent',
        title: { text: def.title || '', left: 'center', top: 8, textStyle: { color: '#22d3ee', fontSize: 12, fontWeight: 'bold' } },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 9, color: '#666', rotate: labels.length > 20 ? 90 : 0 } },
        yAxis: {
            type: 'value', name: def.y_label, nameTextStyle: { color: '#666' },
            splitLine: { lineStyle: { color: '#1a1a1a' } },
            min: def.y_min, max: def.y_max
        },
        series: [{
            type: 'bar',
            data: data,
            itemStyle: {
                color: (p) => {
                    const v = p.value;
                    if (confBand && Math.abs(v) > confBand) return '#ef4444';
                    if (confBand && Math.abs(v) > confBand * 0.7) return '#f59e0b';
                    return '#22d3ee';
                }
            }
        }],
        ...(confBand ? {
            markLine: {
                silent: true,
                data: [
                    { yAxis: confBand, lineStyle: { color: '#ef4444', type: 'dashed', opacity: 0.5 }, label: { formatter: '+CI' } },
                    { yAxis: -confBand, lineStyle: { color: '#ef4444', type: 'dashed', opacity: 0.5 }, label: { formatter: '-CI' } }
                ]
            }
        } : {}),
        grid: { left: '10%', right: '5%', top: '15%', bottom: '10%' }
    };
};

const buildLineOption = (def) => ({
    backgroundColor: 'transparent',
    title: { text: def.title || '', left: 'center', top: 8, textStyle: { color: '#22d3ee', fontSize: 12, fontWeight: 'bold' } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: (def.series?.[0]?.data || []).map(d => d.x), axisLabel: { fontSize: 8, color: '#444', interval: 'auto' } },
    yAxis: { type: 'value', name: def.y_label, nameTextStyle: { color: '#666' }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
    series: (def.series || []).map((s, i) => ({
        type: 'line',
        name: s.name,
        data: s.data.map(d => d.y),
        showSymbol: false,
        smooth: true,
        lineStyle: { width: i === 0 ? 2 : 1, color: ['#22d3ee', '#f59e0b', '#ef4444', '#a78bfa', '#34d399'][i % 5] }
    })),
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 12, bottom: 2 }],
    grid: { left: '10%', right: '5%', top: '15%', bottom: '15%' }
});

const buildBarLineOption = (def) => ({
    backgroundColor: 'transparent',
    title: { text: def.title || '', left: 'center', top: 8, textStyle: { color: '#22d3ee', fontSize: 12, fontWeight: 'bold' } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: (def.bars || []).map(b => b.x), axisLabel: { fontSize: 8, color: '#444' } },
    yAxis: { type: 'value', name: def.y_label, nameTextStyle: { color: '#666' }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
    series: [
        { type: 'bar', name: 'Data', data: (def.bars || []).map(b => b.y), itemStyle: { color: '#22d3ee80' } },
        ...(def.line ? [{ type: 'line', name: 'Normal', data: (def.line || []).map(l => l.y), showSymbol: false, smooth: true, lineStyle: { color: '#f59e0b', width: 2 } }] : [])
    ],
    grid: { left: '10%', right: '5%', top: '15%', bottom: '10%' }
});

const buildMultiLineOption = (def) => ({
    backgroundColor: 'transparent',
    title: { text: def.title || '', left: 'center', top: 8, textStyle: { color: '#22d3ee', fontSize: 12, fontWeight: 'bold' } },
    tooltip: { trigger: 'axis' },
    legend: { data: (def.series || []).map(s => s.name), bottom: 5, textStyle: { color: '#666', fontSize: 9 } },
    xAxis: {
        type: (def.series?.[0]?.data[0]?.x != null && isNaN(def.series[0].data[0].x)) ? 'category' : 'value',
        data: (def.series?.[0]?.data || []).map(d => d.x),
        axisLabel: { fontSize: 8, color: '#444' }
    },
    yAxis: { type: 'value', name: def.y_label, nameTextStyle: { color: '#666' }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
    series: (def.series || []).map((s, i) => ({
        type: 'line',
        name: s.name,
        data: s.data.map(d => [d.x, d.y]),
        showSymbol: false,
        smooth: true,
        lineStyle: { width: i === 0 ? 2.5 : 1.5, color: ['#22d3ee', '#f59e0b', '#ef4444', '#a78bfa', '#34d399', '#f472b6'][i % 6] }
    })),
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 10, bottom: 35 }],
    grid: { left: '10%', right: '5%', top: '15%', bottom: '25%' }
});

const buildBoxOption = (def) => ({
    backgroundColor: 'transparent',
    title: { text: def.title || '', left: 'center', top: 8, textStyle: { color: '#22d3ee', fontSize: 12, fontWeight: 'bold' } },
    tooltip: { trigger: 'item' },
    xAxis: { type: 'category', data: (def.series || []).map(s => s.name) },
    yAxis: { type: 'value', name: 'Return', nameTextStyle: { color: '#666' }, splitLine: { lineStyle: { color: '#1a1a1a' } } },
    series: (def.series || []).map((s, i) => {
        const arr = s.data || [];
        arr.sort((a, b) => a - b);
        const q1 = arr[Math.floor(arr.length * 0.25)] || 0;
        const q3 = arr[Math.floor(arr.length * 0.75)] || 0;
        const median = arr[Math.floor(arr.length * 0.5)] || 0;
        const min = arr[0] || 0;
        const max = arr[arr.length - 1] || 0;
        return {
            type: 'boxplot',
            data: [[min, q1, median, q3, max]],
            itemStyle: { color: ['#22d3ee', '#f59e0b'][i % 2] }
        };
    }),
    grid: { left: '10%', right: '5%', top: '15%', bottom: '10%' }
});

// ============================================================
// MERMAID CORRELATION DIAGRAM
// ============================================================
const renderCorrelationMermaid = (data) => {
    const container = document.getElementById('statsMermaidContainer');
    if (!container) return;

    const corrData = data.categories?.correlation;
    if (!corrData) {
        container.innerHTML = '';
        return;
    }

    const mermaidCode = corrData.mermaid_diagram || '';
    if (!mermaidCode) {
        container.innerHTML = '<p class="text-text_dim text-[9px] p-4">No correlation diagram available</p>';
        return;
    }

    // Render mermaid code block
    const cleanCode = mermaidCode.replace(/```mermaid\n?/g, '').replace(/```/g, '').trim();

    container.innerHTML = `
        <h4 class="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-3 border-l-2 border-cyan-400 pl-3">🔗 FEATURE CORRELATION MAP</h4>
        <div class="bg-[#0a0a0a] border border-border_main/20 rounded-sm p-4">
            <pre class="mermaid text-[9px] font-mono text-text_dim overflow-x-auto">${cleanCode}</pre>
        </div>
    `;

    // Trigger Mermaid render if available
    if (window.mermaid) {
        try {
            window.mermaid.run({ querySelector: '.mermaid' });
        } catch (e) {
            console.warn('[STATS] Mermaid render failed:', e);
        }
    }
};

// ============================================================
// CORRELATION HEATMAP (ECharts)
// ============================================================
export const renderCorrelationHeatmap = (domId, heatmapData) => {
    const dom = document.getElementById(domId);
    if (!dom || !heatmapData?.points) return;

    const chart = echarts.init(dom, 'dark');
    const labels = heatmapData.labels || [];
    const points = heatmapData.points || [];

    const data = points.map(p => [p.x, p.y, p.value]);

    chart.setOption({
        backgroundColor: 'transparent',
        title: { text: 'Feature Correlation Heatmap', left: 'center', top: 5, textStyle: { color: '#22d3ee', fontSize: 12 } },
        tooltip: {
            formatter: (p) => {
                const pt = points.find(pt => pt.x === p.value[0] && pt.y === p.value[1]);
                return pt ? `${pt.x_label} ↔ ${pt.y_label}<br/>Correlation: <b>${pt.value.toFixed(4)}</b>` : '';
            }
        },
        xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 8, color: '#666', rotate: 45 }, position: 'top' },
        yAxis: { type: 'category', data: labels, axisLabel: { fontSize: 8, color: '#666' } },
        visualMap: {
            min: -1, max: 1,
            inRange: { color: ['#ef4444', '#1a1a1a', '#22d3ee'] },
            text: ['1.0', '-1.0'],
            textStyle: { color: '#666' },
            left: 'right'
        },
        series: [{
            type: 'heatmap',
            data: data,
            label: { show: true, fontSize: 9, formatter: p => p.value[2].toFixed(2), color: '#fff' },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
        }],
        grid: { left: '15%', right: '15%', top: '12%', bottom: '15%' }
    });
};

// ============================================================
// UTILITY
// ============================================================
export const disposeAllCharts = () => {
    Object.values(statsCharts).forEach(c => {
        try { c.dispose(); } catch (e) { /* noop */ }
    });
    statsCharts = {};
};

export const closeStatsPanel = () => {
    const panel = document.getElementById('statsPanel');
    if (panel) panel.classList.add('hidden');
    disposeAllCharts();
};

window.closeStatsPanel = closeStatsPanel;

export const toggleCategory = (catId) => {
    if (activeCategories.has(catId)) {
        activeCategories.delete(catId);
    } else {
        activeCategories.add(catId);
    }
};

export const setActiveCategories = (cats) => {
    activeCategories = new Set(cats);
};

export const getActiveCategories = () => activeCategories;
