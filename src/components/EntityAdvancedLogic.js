import { Indicators } from './indicators.js';

export const fetchMLAnalysis = async (symbol, period, signal) => (await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/ml/${symbol}?period=${period}`, { signal })).json();
export const fetchAKFTAnalysis = async (symbol, period, signal) => (await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/akft/${symbol}?period=${period}`, { signal })).json();
export const fetchAMPAAnalysis = async (symbol, params, period, signal) => {
    const q = new URLSearchParams({ ...params, period }).toString();
    return (await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/ampa/${symbol}?${q}`, { signal })).json();
};
export const fetchFAHMAAnalysis = async (symbol, period, signal) => (await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/fahma/${symbol}?period=${period}`, { signal })).json();
export const fetchPRISMAnalysis = async (symbol, period, signal) => (await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/prism/${symbol}?period=${period}`, { signal })).json();

// Centralized Request Manager to prevent "Zombie Fetches"
const controllers = new Map();
const getSignal = (key) => {
    if (controllers.has(key)) controllers.get(key).abort("REPLACED_BY_NEW_REQUEST");
    const controller = new AbortController();
    controllers.set(key, controller);
    return controller.signal;
};
const clearControllers = () => {
    controllers.forEach(c => c.abort("WORKSPACE_CLEANUP"));
    controllers.clear();
};

let mainChart;
let deepCharts = [];
let activeIndicators = new Set();
let deepActiveList = [];
let fullData = [];
let localPeriodData = [];
let localPeriod = '6mo';
let currentSymbol = '';
let mlData = null;
let akftData = null;
let ampaData = null;
let fahmaData = null;
let prismData = null;
let ampaParams = { pattern_len: 10, lookup_limit: 1000, forecast_len: 10 };
let shouldStopDeep = false;

export const stopDeep = () => { shouldStopDeep = true; };
window.stopDeep = stopDeep;

export const initAdvancedAnalysis = (data, symbol) => {
    // GUARD: Prevent "Back-overwriting". 
    // If we are already on this symbol and have a manually fetched custom period (like 6mo),
    // don't let the parent's initial "fast-load" data (usually 1w) overwrite the workstation.
    if (currentSymbol === symbol && fullData.length >= data.length && localPeriod !== '1w') {
        return;
    }

    clearControllers();
    
    // Reset period to default only if the symbol has actually changed
    if (currentSymbol !== symbol) {
        localPeriod = '6mo';
    }
    
    currentSymbol = symbol;
    const historyData = data?.history ? data.history : (Array.isArray(data) ? data : []);
    fullData = [...historyData].sort((a, b) => new Date(a.Date) - new Date(b.Date));
    mlData = null; akftData = null; ampaData = null; fahmaData = null; prismData = null;

    document.querySelectorAll('.adv-period-btn').forEach(btn => {
        btn.removeAttribute('data-active');
        if (btn.dataset.range === localPeriod) btn.setAttribute('data-active', 'true');
    });
    
    // Update labels in advanced view
    const tickerLabels = document.querySelectorAll('.active-ticker');
    tickerLabels.forEach(lbl => lbl.textContent = symbol);

    // Reset loaders and panels
    toggleAdvancedLoading(false);
    toggleDeepLoading(false);
    document.getElementById('deepAnalysisPanel').classList.add('hidden');

    setupToggles(); setupPeriodSelectors(); updateLocalData(); renderAdvancedWorkstation();
};

const setupPeriodSelectors = () => {
    document.querySelectorAll('.adv-period-btn').forEach(btn => {
        btn.onclick = async () => {
            document.querySelectorAll('.adv-period-btn').forEach(b => b.removeAttribute('data-active'));
            btn.setAttribute('data-active', 'true');
            localPeriod = btn.dataset.range; 

            toggleAdvancedLoading(true);

            try {
                const headSignal = getSignal('history');
                const res = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/history/${currentSymbol}?period=${localPeriod}`, { signal: headSignal });
                const data = await res.json();
                
                if (data && data.history) {
                    fullData = [...data.history].sort((a, b) => new Date(a.Date) - new Date(b.Date));
                }

                // Parallel fetch for all active deep analytical nodes to ensure "100% GET" before rendering
                const deepFetches = [];
                if (activeIndicators.has('ml-hurst') || activeIndicators.has('ml-montecarlo') || activeIndicators.has('ml-apef') || activeIndicators.has('ml-arima') || activeIndicators.has('zscore') || activeIndicators.has('ml-sera')) {
                    deepFetches.push(fetchMLAnalysis(currentSymbol, localPeriod, getSignal('ml')).then(d => { mlData = d; mlData.period = localPeriod; }).catch(e => e.name !== 'AbortError' && console.error(e)));
                }
                if (activeIndicators.has('nt-akft')) {
                    deepFetches.push(fetchAKFTAnalysis(currentSymbol, localPeriod, getSignal('akft')).then(d => { akftData = d; akftData.period = localPeriod; }).catch(e => e.name !== 'AbortError' && console.error(e)));
                }
                if (activeIndicators.has('nt-ampa')) {
                    deepFetches.push(fetchAMPAAnalysis(currentSymbol, ampaParams, localPeriod, getSignal('ampa')).then(d => { ampaData = d; ampaData.period = localPeriod; }).catch(e => e.name !== 'AbortError' && console.error(e)));
                }
                if (activeIndicators.has('nt-fahma')) {
                    deepFetches.push(fetchFAHMAAnalysis(currentSymbol, localPeriod, getSignal('fahma')).then(d => { fahmaData = d; fahmaData.period = localPeriod; }).catch(e => e.name !== 'AbortError' && console.error(e)));
                }
                if (activeIndicators.has('nt-prism')) {
                    deepFetches.push(fetchPRISMAnalysis(currentSymbol, localPeriod, getSignal('prism')).then(d => { prismData = d; prismData.period = localPeriod; }).catch(e => e.name !== 'AbortError' && console.error(e)));
                }

                await Promise.all(deepFetches);

                updateLocalData();
                renderAdvancedWorkstation();
                renderAdvancedTable();
                
                if (deepActiveList.length > 0) {
                    await showDeepAnalysis(deepActiveList[deepActiveList.length - 1]);
                }

            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error("Failed to fetch historical data stream:", err);
                }
            } finally {
                toggleAdvancedLoading(false);
            }
        };
    });
};

const renderAdvancedTable = () => {
    const tablePanel = document.getElementById('advancedTablePanel');
    const tbody = document.getElementById('advancedTableBody');
    if (!tablePanel || !tbody || !localPeriodData.length) return;
    
    // Show Table
    tablePanel.classList.remove('hidden');

    let rows = '';
    const displayData = [...localPeriodData].reverse();
    for (const row of displayData) {
        rows += `
            <tr class="hover:bg-green-500/5 transition-colors border-b border-border_main/5 group">
                <td class="p-4 pl-8 text-text_secondary whitespace-nowrap border-r border-border_main/10 font-bold group-hover:text-text_main">${row.Date}</td>
                <td class="p-4 text-right border-r border-border_main/10 tabular-nums">${row.Open.toFixed(2)}</td>
                <td class="p-4 text-right border-r border-border_main/10 tabular-nums text-green-500/70">${row.High.toFixed(2)}</td>
                <td class="p-4 text-right border-r border-border_main/10 tabular-nums text-red-500/70">${row.Low.toFixed(2)}</td>
                <td class="p-4 text-right border-r border-border_main/10 tabular-nums text-text_main font-black bg-white/5">${row.Close.toFixed(2)}</td>
                <td class="p-4 pr-8 text-right tabular-nums opacity-40 group-hover:opacity-100 transition-opacity">${row.Volume.toLocaleString()}</td>
            </tr>
        `;
    }
    tbody.innerHTML = rows;
};

const updateLocalData = () => {
    // We already fetch the exact time range from Yahoo Finance above,
    // so localPeriodData is simply fullData!
    localPeriodData = fullData;
};


export const toggleQuantSidebar = (show) => {
    const sidebar = document.getElementById('quantSidebar');
    if (!sidebar) return;
    if (show) sidebar.classList.remove('hidden');
    else sidebar.classList.add('hidden');
    // Important: Resize chart to fill or leave space
    setTimeout(() => { if (mainChart) mainChart.resize(); }, 100);
};

const toggleAdvancedLoading = (show) => {
    const loader = document.getElementById('advancedLoadingScreen');
    if (loader) {
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    }
};

window.closeDeepAnalysis = () => {
    stopDeep();
    const deepNodes = ['ml-hurst', 'ml-montecarlo', 'ml-arima', 'ml-apef', 'zscore', 'exp-qeo', 'exp-frc', 'exp-grs', 'exp-kvi', 'exp-stw', 'nt-akft', 'nt-ampa', 'nt-fahma', 'nt-prism'];
    
    document.querySelectorAll('.indicator-toggle').forEach(toggle => {
        if (deepNodes.includes(toggle.dataset.indicator) && toggle.checked) {
             toggle.checked = false;
             toggle.dispatchEvent(new Event('change'));
        }
    });

    document.getElementById('deepAnalysisPanel').classList.add('hidden');
};

window.unselectAllIndicators = () => {
    document.querySelectorAll('.indicator-toggle').forEach(toggle => {
        if (toggle.checked) {
            toggle.checked = false;
            toggle.dispatchEvent(new Event('change'));
        }
    });
};

window.selectAllIndicators = () => {
    document.querySelectorAll('.indicator-toggle').forEach(toggle => {
        if (!toggle.checked) {
            toggle.checked = true;
            toggle.dispatchEvent(new Event('change'));
        }
    });
};

export const setupToggles = () => {
    document.querySelectorAll('.indicator-toggle').forEach(toggle => {
        // Prevent duplicate listeners
        if (toggle.dataset.listenerAttached) return;
        toggle.dataset.listenerAttached = 'true';

        toggle.onchange = async (e) => {
            const indicator = e.target.dataset.indicator;
            const deepList = ['ml-hurst', 'ml-montecarlo', 'ml-arima', 'ml-apef', 'ml-sera', 'zscore', 'exp-qeo', 'exp-frc', 'exp-grs', 'exp-kvi', 'exp-stw', 'nt-akft', 'nt-ampa', 'nt-fahma', 'nt-prism'];
            const isDeep = deepList.includes(indicator);

            if (e.target.checked) {
                if (isDeep) {
                    document.getElementById('deepAnalysisPanel').classList.remove('hidden');
                    toggleDeepLoading(true);
                } else {
                    toggleAdvancedLoading(true);
                }
                activeIndicators.add(indicator);
                if (isDeep) deepActiveList.push(indicator);
            } else {
                activeIndicators.delete(indicator);
                if (isDeep) {
                   deepActiveList = deepActiveList.filter(i => i !== indicator);
                   if (deepActiveList.length === 0) {
                       document.getElementById('deepAnalysisPanel').classList.add('hidden');
                   }
                }
            }

            if (indicator.startsWith('ml-') || indicator.startsWith('exp-') || indicator.startsWith('nt-') || ['zscore'].includes(indicator)) {
                if (e.target.checked) {
                    if (indicator.startsWith('ml-') || indicator === 'zscore') {
                        if (!mlData || mlData.symbol !== currentSymbol || mlData.period !== localPeriod) {
                            try { mlData = await fetchMLAnalysis(currentSymbol, localPeriod, getSignal('ml')); mlData.period = localPeriod; }
                            catch (err) { if (err.name !== 'AbortError') console.error('ML Fetch Error:', err); }
                        }
                    } else if (indicator === 'nt-akft') {
                        if (!akftData || akftData.symbol !== currentSymbol || akftData.period !== localPeriod) {
                            try { akftData = await fetchAKFTAnalysis(currentSymbol, localPeriod, getSignal('akft')); akftData.period = localPeriod; } 
                            catch (err) { if (err.name !== 'AbortError') console.error('AKFT Error:', err); }
                        }
                    } else if (indicator === 'nt-ampa') {
                        if (!ampaData || ampaData.symbol !== currentSymbol || ampaData.period !== localPeriod) {
                            try { ampaData = await fetchAMPAAnalysis(currentSymbol, ampaParams, localPeriod, getSignal('ampa')); ampaData.period = localPeriod; } 
                            catch (err) { if (err.name !== 'AbortError') console.error('AMPA Error:', err); }
                        }
                    } else if (indicator === 'nt-fahma') {
                        if (!fahmaData || fahmaData.symbol !== currentSymbol || fahmaData.period !== localPeriod) {
                            try { fahmaData = await fetchFAHMAAnalysis(currentSymbol, localPeriod, getSignal('fahma')); fahmaData.period = localPeriod; } 
                            catch (err) { if (err.name !== 'AbortError') console.error('FAHMA Error:', err); }
                        }
                    } else if (indicator === 'nt-prism') {
                        if (!prismData || prismData.symbol !== currentSymbol || prismData.period !== localPeriod) {
                            try { prismData = await fetchPRISMAnalysis(currentSymbol, localPeriod, getSignal('prism')); prismData.period = localPeriod; } 
                            catch (err) { if (err.name !== 'AbortError') console.error('PRISM Error:', err); }
                        }
                    }
                }
            }

            if (deepActiveList.length > 0) {
                await showDeepAnalysis(deepActiveList[deepActiveList.length - 1]);
            } else {
                document.getElementById('deepAnalysisPanel').classList.add('hidden');
                toggleDeepLoading(false);
            }

            const check = e.target.parentElement.querySelector('.indicator-check');
            const isIndigo = indicator.startsWith('nt-') || indicator.startsWith('ml-') || indicator.startsWith('exp-') || ['zscore', 'ml-sera'].includes(indicator);
            const activeColor = isIndigo ? 'bg-indigo-500' : 'bg-green-500';
            const borderColor = isIndigo ? 'border-indigo-500' : 'border-green-500';

            if (e.target.checked) {
                check.classList.add(activeColor, borderColor);
                check.innerHTML = '<svg class="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7"></path></svg>';
            } else {
                check.classList.remove('bg-green-500', 'border-green-500', 'bg-indigo-500', 'border-indigo-500');
                check.innerHTML = '';
            }

            renderAdvancedWorkstation();
            if (!isDeep) {
                setTimeout(() => toggleAdvancedLoading(false), 300);
            }
        };
    });
};

const toggleDeepLoading = (show) => {
    const loader = document.getElementById('deepLoadingScreen');
    if (loader) {
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    }
};

const showDeepAnalysis = async (id) => {
    const panel = document.getElementById('deepAnalysisPanel');
    const container = document.getElementById('deepAnalysisContent');
    panel.classList.remove('hidden');
    toggleDeepLoading(true);

    // Clear previous dynamic charts if any
    deepCharts.forEach(c => c.dispose());
    deepCharts = [];
    container.innerHTML = '';

    // We render ALL active deep indicators independently
    shouldStopDeep = false;
    for (const indicatorId of deepActiveList) {
        if (shouldStopDeep) break;
        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'w-full bg-[#050505] border-b border-gray-900 mb-2';

        // Inject Parameter Controls for AMPA
        if (indicatorId === 'nt-ampa') {
            const controls = document.createElement('div');
            controls.className = 'grid grid-cols-4 gap-4 mb-6 bg-gray-900/30 p-4 border border-gray-900 rounded-sm';
            controls.innerHTML = `
                <div>
                    <label class="text-[7px] text-gray-600 block mb-1 uppercase font-black tracking-widest">Pattern Len</label>
                    <input type="number" id="param-pattern-len" value="${ampaParams.pattern_len}" class="w-full bg-black border border-gray-800 text-[10px] p-2 py-1 text-indigo-400 font-mono focus:border-indigo-500 outline-none">
                </div>
                <div>
                    <label class="text-[7px] text-gray-600 block mb-1 uppercase font-black tracking-widest">Search Depth</label>
                    <input type="number" id="param-lookup-limit" value="${ampaParams.lookup_limit}" class="w-full bg-black border border-gray-800 text-[10px] p-2 py-1 text-indigo-500 font-mono focus:border-indigo-500 outline-none">
                </div>
                <div>
                    <label class="text-[7px] text-gray-600 block mb-1 uppercase font-black tracking-widest">Forecast Days</label>
                    <input type="number" id="param-forecast-len" value="${ampaParams.forecast_len}" class="w-full bg-black border border-gray-800 text-[10px] p-2 py-1 text-green-500 font-mono focus:border-indigo-500 outline-none">
                </div>
                <div class="flex items-end">
                    <button id="btn-ampa-sync" class="w-full h-[28px] bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 text-[8px] font-black uppercase tracking-[0.2em] hover:bg-indigo-500 hover:text-black transition-all">SYNCHRONIZE_PROTOCOL</button>
                </div>
            `;
            chartWrapper.appendChild(controls);

            setTimeout(() => {
                const btn = document.getElementById('btn-ampa-sync');
                if (btn) {
                    btn.onclick = async () => {
                        btn.textContent = 'EXECUTING_SYNC...';
                        ampaParams.pattern_len = parseInt(document.getElementById('param-pattern-len').value);
                        ampaParams.lookup_limit = parseInt(document.getElementById('param-lookup-limit').value);
                        ampaParams.forecast_len = parseInt(document.getElementById('param-forecast-len').value);

                        try {
                            ampaData = await fetchAMPAAnalysis(currentSymbol, ampaParams, localPeriod, getSignal('ampa')); ampaData.period = localPeriod;
                            const chartDom = document.getElementById(`chart-nt-ampa`);
                            renderDeepView('nt-ampa', chartDom);
                            btn.textContent = 'PROTOCOL_SYNCED';
                            setTimeout(() => { btn.textContent = 'SYNCHRONIZE_PROTOCOL'; }, 2000);
                        } catch (err) {
                            if (err.name !== 'AbortError') {
                                console.error(err);
                                btn.textContent = 'SYNC_FAILED';
                            }
                        }
                    };
                }
            }, 100);
        }

        const chartDom = document.createElement('div');
        chartDom.id = `chart-${indicatorId}`;
        chartDom.className = 'w-full h-[600px]';
        // Balanced height for multi-panel deep analytical nodes
        if (indicatorId === 'nt-akft' || indicatorId === 'nt-ampa' || indicatorId === 'nt-fahma' || indicatorId === 'nt-prism') chartDom.style.height = '850px';

        chartWrapper.appendChild(chartDom);
        container.appendChild(chartWrapper);

        const chartInstance = renderDeepView(indicatorId, chartDom);
        if (chartInstance) deepCharts.push(chartInstance);

        // --- PRISM TECHNICAL REPORT (PRISM.py Replica) ---
        if (indicatorId === 'nt-prism' && prismData?.report) {
            const r = prismData.report;
            const reportDiv = document.createElement('div');
            reportDiv.className = 'p-6 bg-card/60 backdrop-blur-md text-dim font-mono text-[11px] leading-relaxed border-t border-border mt-2 shadow-2xl';
            
            const color = r.signal === 'BUY' ? 'text-green-500' : (r.signal === 'SELL' ? 'text-red-500' : 'text-gray-500');
            const regimeCol = r.regime === 'QUIET' ? 'text-green-400' : (r.regime === 'TURBULENT' ? 'text-red-400' : 'text-blue-400');

            reportDiv.innerHTML = `
                <div class="grid grid-cols-4 gap-8 mb-8 border-b border-gray-900 pb-8">
                    <div class="space-y-1">
                        <div class="text-dim/40 font-black tracking-widest text-[9px] mb-2">TERMINAL_DATA</div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>DATE:</span> <span class="text-main font-bold">${r.last_date}</span></div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>PRICE:</span> <span class="text-main font-bold">$${r.last_close.toFixed(2)}</span></div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>RSI(14):</span> <span class="text-main font-bold">${r.rsi.toFixed(1)}</span></div>
                    </div>
                    <div class="space-y-1">
                        <div class="text-dim/40 font-black tracking-widest text-[9px] mb-2">INTELLIGENCE_METRICS</div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>CPS_SCORE:</span> <span class="text-blue-500 font-bold">${r.cps.toFixed(4)}</span></div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>MPM_INDEX:</span> <span class="text-purple-500 font-bold">${r.mpm.toFixed(4)}</span></div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>CMA_MICRO:</span> <span class="text-orange-500 font-bold">${r.cma.toFixed(4)}</span></div>
                    </div>
                    <div class="space-y-1">
                        <div class="text-dim/40 font-black tracking-widest text-[9px] mb-2">STATE_DECODER</div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>REGIME:</span> <span class="${regimeCol} font-bold">${r.regime}</span></div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>CONFIDENCE:</span> <span class="text-blue-500 font-bold">${r.confidence.toFixed(1)}%</span></div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>SIGNAL:</span> <span class="${color} font-black uppercase text-[12px]">${r.signal}</span></div>
                    </div>
                    <div class="space-y-1">
                        <div class="text-dim/40 font-black tracking-widest text-[9px] mb-2">DISTRIBUTION_MATRIX</div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>TOTAL_BUY:</span> <span class="text-green-600 font-bold">${r.distribution.buy}</span></div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>TOTAL_SELL:</span> <span class="text-red-600 font-bold">${r.distribution.sell}</span></div>
                        <div class="flex justify-between border-b border-border/20 py-1"><span>TOTAL_HOLD:</span> <span class="text-dim font-bold">${r.distribution.hold}</span></div>
                    </div>
                </div>

                <div>
                    <div class="text-[#444] font-black tracking-widest text-[9px] mb-3">5_RECENT_SIGNALS_AUDIT</div>
                    <div class="grid grid-cols-4 border-b border-gray-900 pb-1 text-[9px] font-black text-[#555]">
                        <div>STATE</div><div>CPS_VAL</div><div>CONFIDENCE</div><div>PRICE_EXEC</div>
                    </div>
                    ${[...r.recent_signals].reverse().map(sig => `
                        <div class="grid grid-cols-4 py-2 border-b border-gray-900/50">
                            <div class="${sig.sig_label === 'BUY' ? 'text-green-500' : 'text-red-500'} font-black text-[10px]">${sig.sig_label}</div>
                            <div class="text-white">${sig.cps.toFixed(4)}</div>
                            <div class="text-blue-400">${sig.conf.toFixed(1)}%</div>
                            <div class="text-gray-300">$${sig.close.toFixed(2)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            chartWrapper.appendChild(reportDiv);
        }
    }
    toggleDeepLoading(false);
};

const renderDeepView = (id, targetDom) => {
    if (!targetDom) return null;
    const terminalTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const chartTheme = terminalTheme === 'light' ? 'light' : 'dark';
    const chart = echarts.init(targetDom, chartTheme);

    const dates = localPeriodData.map(d => d.Date);
    const prices = localPeriodData.map(d => d.Close);
    const startIndex = fullData.findIndex(d => d.Date === dates[0]);
    const sliceData = (fullAnalysis) => fullAnalysis.slice(startIndex, startIndex + dates.length).map(v => v.y);

    let option = {
        backgroundColor: 'transparent', animation: false,
        tooltip: { 
            trigger: 'axis', 
            backgroundColor: terminalTheme === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)', 
            borderColor: 'var(--border-main)',
            borderWidth: 1,
            textStyle: { color: 'var(--text-main)', fontSize: 10 },
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.2)'
        },
        dataZoom: [
            { type: 'inside', xAxisIndex: [0] },
            { type: 'slider', xAxisIndex: [0], height: 10, bottom: 5, borderColor: 'transparent', textStyle: { color: 'var(--text-dim)' } }
        ],
        toolbox: {
            feature: {
                dataZoom: { yAxisIndex: 'none' },
                restore: {},
                saveAsImage: {}
            },
            iconStyle: { borderColor: 'var(--text-dim)', borderWidth: 1 }
        },
        xAxis: { 
            type: 'category', 
            data: dates, 
            boundaryGap: false, 
            axisLine: { lineStyle: { color: 'var(--border-main)' } },
            axisLabel: { color: 'var(--text-dim)', fontSize: 9 }
        },
        yAxis: { 
            scale: true, 
            splitLine: { lineStyle: { color: 'var(--border-main)', opacity: 0.1, type: 'dashed' } }, 
            axisLine: { show: false },
            axisLabel: { color: 'var(--text-dim)', fontSize: 9 } 
        },
        series: []
    };

    if (id === 'ml-hurst') {
        const val = mlData?.hurst || 0.5;
        option = {
            title: { text: `REGIME: ${mlData?.regime || 'Neutral'}`, left: 'center', top: '15%', textStyle: { color: '#818cf8', fontSize: 20 } },
            series: [{
                type: 'gauge', startAngle: 180, endAngle: 0, min: 0, max: 1,
                axisLine: { lineStyle: { width: 15, color: [[0.45, '#fb923c'], [0.55, '#94a3b8'], [1, '#22c55e']] } },
                pointer: { width: 4 }, data: [{ value: val }],
                detail: { formatter: val.toFixed(4), color: '#fff', fontSize: 30, offsetCenter: [0, '30%'] }
            }]
        };
    } else if (id === 'ml-montecarlo') {
        const lastPrice = prices[prices.length - 1];
        const forecastDates = Array.from({ length: 20 }, (_, i) => `T+${i + 1}`);
        option.xAxis.data = [...dates, ...forecastDates];
        for (let i = 0; i < 40; i++) {
            let p = [lastPrice];
            for (let j = 0; j < 19; j++) p.push(p[p.length - 1] * (1 + (Math.random() - 0.5) * 0.02 * (mlData?.hurst || 1)));
            option.series.push({ type: 'line', data: [...Array(dates.length - 1).fill(null), ...p], lineStyle: { width: 0.5, opacity: 0.08, color: '#6366f1' }, showSymbol: false });
        }
        option.series.push({ name: 'Historical', type: 'line', data: prices, lineStyle: { color: '#fff', width: 2 } });
    } else if (id === 'ml-arima') {
        if (mlData?.arima_forecast) {
            option.xAxis.data = mlData.arima_forecast.map(v => v.x);
            option.series.push({ name: 'ARIMA Model', type: 'line', data: mlData.arima_forecast.map(v => v.y), lineStyle: { color: '#10b981', width: 3 }, areaStyle: { color: 'rgba(16,185,129,0.1)' }, smooth: true });
        }
    } else if (id === 'ml-apef') {
        if (mlData?.alpha?.apef_echo) {
            option.series.push({ name: 'Price', type: 'line', data: prices, lineStyle: { color: '#444' } });
            option.series.push({ name: 'Master Echo', type: 'line', data: mlData.alpha.apef_echo.map(v => v.y), lineStyle: { color: '#a78bfa', width: 3, type: 'dashed' }, areaStyle: { color: 'rgba(167,139,250,0.05)' } });
        }
    } else if (id === 'ml-sera') {
        if (mlData?.sera) {
            option.yAxis = { min: -100, max: 100, splitLine: { show: true, lineStyle: { color: '#222' } } };
            // Map SERA data to chart dates for perfect alignment
            const seraMap = {};
            mlData.sera.forEach(v => seraMap[v.x] = v.y);
            const seraData = dates.map(d => seraMap[d] !== undefined ? seraMap[d] : null);
            
            option.series.push({ 
                name: 'SERA Force', type: 'line', data: seraData, 
                lineStyle: { width: 3, color: '#f59e0b' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(245, 158, 11, 0.4)' },
                        { offset: 0.5, color: 'rgba(0,0,0,0)' },
                        { offset: 1, color: 'rgba(239, 68, 68, 0.4)' }
                    ])
                },
                markLine: {
                    data: [
                        { yAxis: 60, lineStyle: { color: '#ef4444', type: 'dashed', opacity: 0.5 } },
                        { yAxis: -60, lineStyle: { color: '#22c55e', type: 'dashed', opacity: 0.5 } }
                    ]
                }
            });
        }
    } else if (id === 'zscore') {
        const z = sliceData(Indicators.zscore(fullData));
        option.yAxis = { min: -5, max: 5, splitLine: { show: true, lineStyle: { color: '#222' } } };
        option.series.push({ type: 'bar', data: z.map(v => ({ value: v, itemStyle: { color: v > 2 ? '#ef4444' : v < -2 ? '#22c55e' : '#444' } })) });
    } else if (id === 'exp-qeo') {
        const qeo = sliceData(Indicators.logarithmicEntropy(fullData));
        option.series.push({ name: 'Log-Entropy Surface', type: 'line', data: qeo, areaStyle: { color: 'rgba(129,140,248,0.2)' }, lineStyle: { color: '#818cf8', width: 4 }, smooth: true });
    } else if (id === 'exp-frc') {
        const frc = Indicators.fractalAdaptiveSmoothing(fullData);
        option.series.push({ name: 'Fast_Fractal', type: 'line', data: sliceData(frc.fast), lineStyle: { color: '#ef4444', width: 1.5 }, smooth: true });
        option.series.push({ name: 'Slow_Fractal', type: 'line', data: sliceData(frc.slow), lineStyle: { color: '#3b82f6', width: 1.5, opacity: 0.5 }, areaStyle: { color: 'rgba(59,130,246,0.1)' }, smooth: true });
    } else if (id === 'exp-grs') {
        const grs = Indicators.statisticalSpread(fullData);
        option.series.push({ name: '3-Sigma_Upper', type: 'line', data: sliceData(grs.upper), lineStyle: { color: '#facc15', width: 1, type: 'dotted' } });
        option.series.push({ name: '3-Sigma_Lower', type: 'line', data: sliceData(grs.lower), lineStyle: { color: '#facc15', width: 1, type: 'dotted' }, areaStyle: { color: 'rgba(250,204,21,0.03)' } });
        option.series.push({ name: 'Price', type: 'line', data: prices, lineStyle: { color: '#fff' } });
    } else if (id === 'exp-kvi') {
        const kvi = sliceData(Indicators.priceVolumeImpulse(fullData));
        option.series.push({ name: 'PVI_Impulse', type: 'line', data: kvi, areaStyle: { color: 'rgba(34,197,94,0.4)' }, lineStyle: { color: '#22c55e', shadowBlur: 20, shadowColor: '#22c55e' } });
    } else if (id === 'exp-stw') {
        const stw = sliceData(Indicators.adaptiveStochastic(fullData));
        option.yAxis = { min: 0, max: 100 };
        option.series.push({ name: 'Adaptive Stoch', type: 'line', data: stw, lineStyle: { color: '#facc15', width: 3 }, markArea: { data: [[{ yAxis: 80, itemStyle: { color: 'rgba(239,68,68,0.1)' } }, { yAxis: 100 }], [{ yAxis: 0, itemStyle: { color: 'rgba(34,197,94,0.1)' } }, { yAxis: 20 }]] } });
    } else if (id === 'nt-akft' && akftData) {
        // Multi-panel thermodynamics dashboard (mimicking AKFT.py) - FULL WIDTH INDEPENDENT MODE
        const akDates = akftData.dates;

        option = {
            backgroundColor: 'transparent', animation: false,
            title: {
                text: `NODE_AKFT: ${akftData.meta.regime}`,
                left: 'center', top: '1%', textStyle: { color: '#818cf8', fontSize: 16, fontWeight: '900', letterSpacing: 4 }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross', label: { backgroundColor: '#111' } },
                backgroundColor: 'rgba(5, 5, 5, 0.95)',
                borderColor: '#333',
                textStyle: { color: '#eee', fontSize: 11, fontFamily: 'monospace' }
            },
            axisPointer: { link: { xAxisIndex: 'all' } },
            grid: [
                { left: '5%', right: '5%', top: '5%', height: '30%' },   // Price
                { left: '5%', right: '5%', top: '42%', height: '15%' },  // Hurst
                { left: '5%', right: '5%', top: '63%', height: '15%' },  // PE
                { left: '5%', right: '5%', top: '84%', height: '12%' }   // Energy
            ],
            xAxis: [
                { type: 'category', data: akDates, gridIndex: 0, axisLabel: { show: false }, axisLine: { lineStyle: { color: '#222' } } },
                { type: 'category', data: akDates, gridIndex: 1, axisLabel: { show: false }, axisLine: { lineStyle: { color: '#222' } } },
                { type: 'category', data: akDates, gridIndex: 2, axisLabel: { show: false }, axisLine: { lineStyle: { color: '#222' } } },
                { type: 'category', data: akDates, gridIndex: 3, axisLabel: { fontSize: 10, color: '#444' }, axisLine: { lineStyle: { color: '#222' } } }
            ],
            yAxis: [
                { gridIndex: 0, scale: true, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }, axisLabel: { fontSize: 10, color: '#aaa' } },
                { gridIndex: 1, name: 'HURST_EXP', nameTextStyle: { color: '#555', fontWeight: 'bold' }, splitLine: { show: false }, min: 0.3, max: 0.7, axisLabel: { fontSize: 9, color: '#666' } },
                { gridIndex: 2, name: 'CMPLX_PE', nameTextStyle: { color: '#555', fontWeight: 'bold' }, splitLine: { show: false }, min: 0.8, max: 1, axisLabel: { fontSize: 9, color: '#666' } },
                { gridIndex: 3, name: 'ENERGY_K', nameTextStyle: { color: '#555', fontWeight: 'bold' }, splitLine: { show: false }, axisLabel: { fontSize: 9, color: '#666' } }
            ],
            series: [
                {
                    name: 'Price Stream', type: 'line', data: akftData.close, gridIndex: 0,
                    lineStyle: { color: '#fff', width: 2, shadowBlur: 10, shadowColor: 'rgba(255,255,255,0.2)' },
                    areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(255,255,255,0.05)' }, { offset: 1, color: 'transparent' }]) }
                },
                {
                    name: 'Regime (Hurst)', type: 'line', data: akftData.hurst, xAxisIndex: 1, yAxisIndex: 1,
                    lineStyle: { color: '#fbbf24', width: 2.5 },
                    markArea: {
                        data: [
                            [{ yAxis: 0.55, itemStyle: { color: 'rgba(34,197,94,0.05)' } }, { yAxis: 0.7 }],
                            [{ yAxis: 0.3, itemStyle: { color: 'rgba(239,68,68,0.05)' } }, { yAxis: 0.45 }]
                        ]
                    }
                },
                {
                    name: 'Entropy Matrix', type: 'line', data: akftData.entropy, xAxisIndex: 2, yAxisIndex: 2,
                    lineStyle: { color: '#818cf8', width: 2.5 },
                    smooth: true,
                    areaStyle: { color: 'rgba(129,140,248,0.05)' }
                },
                {
                    name: 'Kinetic Flux', type: 'bar', data: akftData.energy, xAxisIndex: 3, yAxisIndex: 3,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: 'rgba(6, 182, 212, 0.1)' }]),
                        borderRadius: [2, 2, 0, 0]
                    }
                }
            ]
        };
    } else if (id === 'nt-ampa' && ampaData) {
        // AMPA Fractal Projection Dashboard - UNIFIED TRANSITION VIEW
        const target = ampaData.target_pattern;
        const forecast = ampaData.projection;
        const recent = ampaData.recent_prices;
        const bestMatch = ampaData.matches[0];

        // Unified X-Axis for the Fractal Node: -9 to +10
        const unifiedLabels = [
            ...Array.from({ length: 10 }, (_, i) => i - 9),
            ...Array.from({ length: 10 }, (_, i) => `T+${i + 1}`)
        ];

        option = {
            backgroundColor: 'transparent', animation: false,
            title: [
                { text: `NODE_AMPA: ${ampaData.symbol} FRACTAL_MEMORY_SYNC`, left: 'center', top: '0', textStyle: { color: '#fbbf24', fontSize: 16, fontWeight: '900', letterSpacing: 4 } },
                { text: '01. GLOBAL_PRICE_CONTEXT (LOOKBACK)', left: '5%', top: '5%', textStyle: { color: '#555', fontSize: 10, fontWeight: 'bold' } },
                { text: '02. UNIFIED_FRACTAL_TRANSITION_MATRIX (CORE)', left: '5%', top: '35%', textStyle: { color: '#00ffff', fontSize: 10, fontWeight: 'bold' } }
            ],
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(10, 10, 10, 0.95)', borderColor: '#444',
                textStyle: { color: '#eee', fontSize: 11, fontFamily: 'monospace' },
                axisPointer: { type: 'cross' }
            },
            grid: [
                { left: '6%', right: '6%', top: '8%', height: '22%' },      // Global Node
                { left: '6%', right: '6%', top: '40%', height: '52%' }     // Unified Transition Node
            ],
            xAxis: [
                { type: 'category', data: recent.dates, gridIndex: 0, axisLabel: { fontSize: 8, color: '#333' } },
                { type: 'category', data: unifiedLabels, gridIndex: 1, axisLabel: { fontSize: 9, color: '#555' }, axisLine: { lineStyle: { color: '#222' } } }
            ],
            yAxis: [
                { gridIndex: 0, scale: true, splitLine: { lineStyle: { color: '#111' } } },
                { gridIndex: 1, scale: true, splitLine: { lineStyle: { color: '#111' } } }
            ],
            series: [
                { name: 'History', type: 'line', data: recent.prices, xAxisIndex: 0, yAxisIndex: 0, lineStyle: { color: '#222', width: 2 } },

                // UNIFIED MATRIX (Grid Index 1)
                {
                    name: 'Target (Core)', type: 'line', xAxisIndex: 1, yAxisIndex: 1,
                    data: [...target.prices, ...Array(10).fill(null)],
                    lineStyle: { color: '#00ffff', width: 4, shadowBlur: 10, shadowColor: 'rgba(0,255,255,0.6)' },
                    symbol: 'circle', symbolSize: 6, itemStyle: { color: '#00ffff' }
                },
                {
                    name: 'Analogue (History)', type: 'line', xAxisIndex: 1, yAxisIndex: 1,
                    data: [...bestMatch.prices, ...Array(10).fill(null)],
                    lineStyle: { color: '#ef4444', width: 2, type: 'dashed' },
                    symbol: 'circle', symbolSize: 4, itemStyle: { color: '#ef4444' }
                },
                {
                    name: 'AMPA_PROJECTION', type: 'line', xAxisIndex: 1, yAxisIndex: 1,
                    data: [...Array(9).fill(null), target.prices[9], ...forecast.predicted_prices],
                    lineStyle: { color: '#22c55e', width: 3 },
                    symbol: 'rect', symbolSize: 8, itemStyle: { color: '#22c55e' },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(34,197,94,0.15)' },
                            { offset: 1, color: 'transparent' }
                        ])
                    },
                    markLine: {
                        symbol: 'none',
                        data: [{ yAxis: forecast.base_price, lineStyle: { color: '#888', type: 'dotted', opacity: 0.4 }, label: { show: false } }]
                    }
                }
            ]
        };
    } else if (id === 'nt-prism' && prismData) {
        // PRISM Intelligence Spectrum Matrix Dashboard - INSTITUTIONAL REPLICA
        const dates = prismData.dates;
        const ohlc = dates.map((_, i) => [prismData.open[i], prismData.close[i], prismData.low[i], prismData.high[i]]);
        
        option = {
            backgroundColor: 'transparent', animation: false,
            title: [
                { text: `PRISM Algorithm — ${currentSymbol} | ${dates.length} Bar Historis`, left: '5%', top: '3%', textStyle: { color: '#ccc', fontSize: 13, fontWeight: 'bold' } }
            ],
            tooltip: { trigger: 'axis', backgroundColor: 'rgba(5,5,5,0.95)', borderColor: '#333', textStyle: { color: '#eee', fontSize: 11, fontFamily: 'monospace' } },
            axisPointer: { link: { xAxisIndex: 'all' } },
            grid: [
                { left: '6%', right: '6%', top: '7%', height: '30%' },      // Price
                { left: '6%', right: '6%', top: '40%', height: '12%' },     // CPS
                { left: '6%', right: '6%', top: '55%', height: '12%' },     // MPM/CMA
                { left: '6%', right: '6%', top: '70%', height: '12%' },     // RSI
                { left: '6%', right: '6%', top: '85%', height: '10%' }      // Confidence + VRC
            ],
            xAxis: [
                { type: 'category', data: dates, gridIndex: 0, axisLabel: { show: false } },
                { type: 'category', data: dates, gridIndex: 1, axisLabel: { show: false } },
                { type: 'category', data: dates, gridIndex: 2, axisLabel: { show: false } },
                { type: 'category', data: dates, gridIndex: 3, axisLabel: { show: false } },
                { type: 'category', data: dates, gridIndex: 4, axisLabel: { fontSize: 8, color: '#333' } }
            ],
            yAxis: [
                { gridIndex: 0, scale: true, splitLine: { lineStyle: { color: '#111' } } },
                { gridIndex: 1, scale: true, splitLine: { show: false }, axisLabel: { fontSize: 8 } },
                { gridIndex: 2, scale: true, splitLine: { show: false }, axisLabel: { fontSize: 8 } },
                { gridIndex: 3, scale: true, splitLine: { show: false }, min: 0, max: 100, axisLabel: { fontSize: 8 } },
                { gridIndex: 4, scale: true, splitLine: { show: false }, min: 0, max: 105, axisLabel: { fontSize: 8 } }
            ],
            series: [
                // PANEL 1: PRICE (CANDLESTICK)
                { 
                    name: 'Price', type: 'candlestick', xAxisIndex: 0, yAxisIndex: 0, data: ohlc,
                    itemStyle: { color: '#3fb950', color0: '#f85149', borderColor: '#3fb950', borderColor0: '#f85149' }
                },
                { name: 'BB_U', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: prismData.bb_u, lineStyle: { opacity: 0.1, color: '#58a6ff' }, symbol: 'none' },
                { name: 'BB_L', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: prismData.bb_l, lineStyle: { opacity: 0.1, color: '#58a6ff' }, symbol: 'none', areaStyle: { color: 'rgba(88,166,255,0.05)' } },
                {
                    name: 'BUY_SIGNAL', type: 'scatter', xAxisIndex: 0, yAxisIndex: 0,
                    symbolSize: 10, itemStyle: { color: '#3fb950' }, symbol: 'triangle',
                    data: prismData.signals.map((s, i) => s === 1 ? [i, prismData.low[i] * 0.99] : null).filter(x => x)
                },
                {
                    name: 'SELL_SIGNAL', type: 'scatter', xAxisIndex: 0, yAxisIndex: 0,
                    symbolSize: 10, itemStyle: { color: '#f85149' }, symbol: 'triangle', rotate: 180,
                    data: prismData.signals.map((s, i) => s === -1 ? [i, prismData.high[i] * 1.01] : null).filter(x => x)
                },
                // PANEL 2: CPS (BICOLOR AREA)
                { 
                    name: 'CPS', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: prismData.cps, 
                    lineStyle: { color: '#58a6ff', width: 1.5 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(63, 185, 80, 0.4)' },
                            { offset: 0.5, color: 'rgba(0,0,0,0)' },
                            { offset: 1, color: 'rgba(248, 81, 73, 0.4)' }
                        ])
                    }, symbol: 'none'
                },
                { name: 'T_BUY', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: prismData.t_buy, lineStyle: { color: '#3fb950', width: 0.7, type: 'dotted', opacity: 0.4 }, symbol: 'none' },
                { name: 'T_SELL', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: prismData.t_sell, lineStyle: { color: '#f85149', width: 0.7, type: 'dotted', opacity: 0.4 }, symbol: 'none' },
                
                // PANEL 3: COMPONENTS
                { name: 'MPM', type: 'line', xAxisIndex: 2, yAxisIndex: 2, data: prismData.mpm, lineStyle: { color: '#d2a8ff', width: 2 }, symbol: 'none' },
                { name: 'CMA', type: 'line', xAxisIndex: 2, yAxisIndex: 2, data: prismData.cma, lineStyle: { color: '#ffa657', width: 1, opacity: 0.8 }, symbol: 'none' },
                
                // PANEL 4: RSI (BICOLOR AREA)
                {
                    name: 'RSI', type: 'line', xAxisIndex: 3, yAxisIndex: 3, data: prismData.rsi,
                    lineStyle: { color: '#e3b341', width: 1.2 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(63, 185, 80, 0.2)' },
                            { offset: 0.5, color: 'rgba(0,0,0,0)' },
                            { offset: 1, color: 'rgba(248, 81, 73, 0.2)' }
                        ])
                    }, symbol: 'none',
                    markLine: {
                        symbol: 'none',
                        data: [{ yAxis: 70, lineStyle: { color: '#f85149', type: 'dashed', opacity: 0.4 } }, { yAxis: 30, lineStyle: { color: '#3fb950', type: 'dashed', opacity: 0.4 } }]
                    }
                },

                // PANEL 5: CONFIDENCE + VRC HEATMAP
                { 
                    name: 'Confidence', type: 'line', xAxisIndex: 4, yAxisIndex: 4, data: prismData.confidence, 
                    lineStyle: { color: '#79c0ff', width: 1.5 }, symbol: 'none',
                    markArea: {
                        data: prismData.regime_p.map((p, i) => {
                            if (i === 0) return null;
                            const color = p < 0.33 ? 'rgba(31, 58, 31, 0.4)' : (p > 0.67 ? 'rgba(58, 31, 31, 0.4)' : 'rgba(26, 31, 46, 0.4)');
                            return [{ xAxis: i-0.5, itemStyle: { color } }, { xAxis: i+0.5 }];
                        }).filter(x => x)
                    }
                }
            ]
        };
    }
 else if (id === 'nt-fahma' && fahmaData) {
        // FAHMA Adaptive Hybrid Momentum Dashboard - UNIFIED CONFLUENCE VIEW
        const dates = fahmaData.dates;
        
        option = {
            backgroundColor: 'transparent', animation: false,
            title: [
                { text: `NODE_FAHMA: ${fahmaData.symbol} ADAPTIVE_HYBRID_INTEL`, left: 'center', top: '0', textStyle: { color: '#fbbf24', fontSize: 16, fontWeight: '900', letterSpacing: 4 } },
                { text: '01. PRICE_SIGNAL_STREAM', left: '5%', top: '6%', textStyle: { color: '#555', fontSize: 10, fontWeight: 'bold' } },
                { text: '02. MOMENTUM_CONFLUENCE_MATRIX (UNI)', left: '5%', top: '42%', textStyle: { color: '#00ffff', fontSize: 10, fontWeight: 'bold' } }
            ],
            tooltip: { trigger: 'axis', backgroundColor: 'rgba(10, 10, 10, 0.95)', borderColor: '#444', textStyle: { color: '#eee', fontSize: 11, fontFamily: 'monospace' } },
            grid: [
                { left: '6%', right: '6%', top: '10%', height: '30%' },      // Price
                { left: '6%', right: '6%', top: '46%', height: '46%' }      // Confluence
            ],
            xAxis: [
                { type: 'category', data: dates, gridIndex: 0, axisLabel: { show: false } },
                { type: 'category', data: dates, gridIndex: 1, axisLabel: { fontSize: 8, color: '#333' }, axisLine: { lineStyle: { color: '#222' } } }
            ],
            yAxis: [
                { gridIndex: 0, scale: true, splitLine: { lineStyle: { color: '#111' } } },
                { gridIndex: 1, scale: true, splitLine: { lineStyle: { color: '#111' } }, axisLabel: { fontSize: 9, color: '#444' } }
            ],
            series: [
                { name: 'Price', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: fahmaData.close, lineStyle: { color: '#666', width: 1.5 } },
                { name: 'MA20', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: fahmaData.ma20, lineStyle: { color: '#f59e0b', width: 1, opacity: 0.5, type: 'dashed' } },
                
                // UNIFIED CONFLUENCE
                { 
                    name: 'Hurst (Regime)', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: fahmaData.hurst, 
                    lineStyle: { color: '#fbbf24', width: 2, opacity: 0.6 },
                    areaStyle: { color: 'rgba(251,191,36,0.03)' }, symbol: 'none'
                },
                { 
                    name: 'PSI (Similarity)', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: fahmaData.psi, 
                    lineStyle: { color: '#d946ef', width: 2, opacity: 0.6 },
                    areaStyle: { color: 'rgba(217,70,239,0.03)' }, symbol: 'none'
                },
                { 
                    name: 'CTS (Signal Alpha)', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: fahmaData.cts, 
                    lineStyle: { color: '#00ffff', width: 3.5, shadowBlur: 10, shadowColor: 'rgba(0,255,255,0.4)' },
                    areaStyle: { color: 'rgba(0,255,255,0.05)' }, symbol: 'none'
                }
            ]
        };
    }

    chart.setOption(option);
    return chart;
};

const updateQuantPanel = () => {
    if (!mlData) return;
    document.getElementById('regimeIndicator').textContent = `${mlData.regime} (${mlData.hurst.toFixed(3)})`;
    if (mlData.mc_stats) {
        document.getElementById('probUpBar').style.width = `${mlData.mc_stats.prob_up * 100}%`;
        document.getElementById('probDownBar').style.width = `${mlData.mc_stats.prob_down * 100}%`;
        document.getElementById('probUpVal').textContent = `${(mlData.mc_stats.prob_up * 100).toFixed(1)}%`;
        document.getElementById('probDownVal').textContent = `${(mlData.mc_stats.prob_down * 100).toFixed(1)}%`;
    }
};

export const renderAdvancedWorkstation = () => {
    const dom = document.getElementById('advancedChart');
    if (!dom || !localPeriodData.length) return;
    if (mainChart) mainChart.dispose();
    mainChart = echarts.init(dom, 'dark', { renderer: 'canvas' });

    const dates = localPeriodData.map(d => d.Date);
    const startIndex = fullData.findIndex(d => d.Date === dates[0]);
    const ohlc = localPeriodData.map(d => [d.Open, d.Close, d.Low, d.High]);
    const volumes = localPeriodData.map((d) => [d.Date, d.Volume, d.Close >= d.Open ? 1 : -1]);

    const sliceData = (fullAnalysis) => fullAnalysis.slice(startIndex, startIndex + dates.length).map(v => v.y);

    let mainSeries = [{
        name: 'Price', type: 'candlestick', data: ohlc,
        itemStyle: { color: '#22c55e', color0: '#ef4444', borderColor: '#22c55e', borderColor0: '#ef4444' },
        markArea: { data: [], silent: true }, markPoint: { data: [] }
    }];

    let lanes = [];

    activeIndicators.forEach(ind => {
        if (ind === 'sma20') mainSeries.push({ name: 'SMA 20', type: 'line', data: sliceData(Indicators.ma(fullData, 20)), lineStyle: { color: '#3b82f6', width: 0.8 } });
        if (ind === 'ema50') mainSeries.push({ name: 'EMA 50', type: 'line', data: sliceData(Indicators.ema(fullData, 50)), lineStyle: { color: '#f59e0b', width: 0.8 } });
        if (ind === 'frama') mainSeries.push({ name: 'FRAMA', type: 'line', data: sliceData(Indicators.frama(fullData)), lineStyle: { color: '#ec4899', width: 1.5 } });

        if (ind === 'vwap') lanes.push({ id: 'vwap', name: 'VWAP', data: sliceData(Indicators.vwap(fullData)), color: '#8b5cf6', isMulti: true, extra: [localPeriodData.map(d => d.Close)] });
        if (ind === 'ichimoku') {
            const i = Indicators.ichimoku(fullData);
            lanes.push({ id: 'ichimoku', name: 'Ichimoku', data: sliceData(i.tenkan), color: '#ef4444', isMulti: true, extra: [sliceData(i.kijun)] });
        }
        if (ind === 'psar') lanes.push({ id: 'psar', name: 'Parabolic SAR', data: sliceData(Indicators.psar(fullData)), color: '#fbbf24', type: 'scatter' });
        if (ind === 'fib') {
            const f = Indicators.fibonacci(localPeriodData);
            lanes.push({ id: 'fib', name: 'Fibonacci', data: dates.map(() => f.levels["61.8%"]), color: '#444', isMulti: true, extra: [dates.map(() => f.levels["38.2%"]), dates.map(() => f.levels["23.6%"])] });
        }
        if (ind === 'atr') lanes.push({ id: 'atr', name: 'ATR', data: sliceData(Indicators.atr(fullData)), color: '#9ca3af' });
        if (ind === 'mfi') lanes.push({ id: 'mfi', name: 'MFI', data: sliceData(Indicators.mfi(fullData)), color: '#22c55e', range: [0, 100] });
        if (ind === 'cmf') lanes.push({ id: 'cmf', name: 'Chaikin CMF', data: sliceData(Indicators.cmf(fullData)), color: '#8b5cf6', range: [-1, 1] });
        if (ind === 'keltner') {
            const k = Indicators.keltner(fullData);
            lanes.push({ id: 'keltner', name: 'Keltner', data: sliceData(k.middle), color: '#3b82f6', isMulti: true, extra: [sliceData(k.upper), sliceData(k.lower)] });
        }
        if (ind === 'bbands') {
            const bb = Indicators.bollinger(fullData);
            lanes.push({ id: 'bbands', name: 'Bollinger', data: sliceData(bb.middle), color: '#9ca3af', isMulti: true, extra: [sliceData(bb.upper), sliceData(bb.lower)] });
        }
        if (ind === 'pivot') {
            const p = Indicators.pivotPoints(fullData);
            if (p) lanes.push({ id: 'pivot', name: 'Pivots', data: dates.map(() => p.p), color: '#94a3b8', isMulti: true, extra: [dates.map(() => p.r1), dates.map(() => p.s1)] });
        }
        if (ind === 'channel') {
            const pc = Indicators.highLowChannel(fullData, 20);
            lanes.push({ id: 'channel', name: 'Channel', data: sliceData(pc.upper), color: '#ef4444', isMulti: true, extra: [sliceData(pc.lower)] });
        }
        if (ind === 'cci') lanes.push({ id: 'cci', name: 'CCI', data: sliceData(Indicators.cci(fullData)), color: '#2dd4bf', range: [-200, 200] });
        if (ind === 'williams') lanes.push({ id: 'williams', name: 'Williams %R', data: sliceData(Indicators.williamsR(fullData)), color: '#ec4899', range: [-100, 0] });
        if (ind === 'rsi') lanes.push({ id: 'rsi', name: 'RSI', data: sliceData(Indicators.rsi(fullData)), color: '#818cf8', range: [0, 100] });
        if (ind === 'stoch') lanes.push({ id: 'stoch', name: 'Stoch', data: sliceData(Indicators.stochastic(fullData).k), color: '#fbbf24', range: [0, 100] });
        if (ind === 'macd') {
            const m = Indicators.macd(fullData);
            lanes.push({ id: 'macd', name: 'MACD', data: sliceData(m.macd), color: '#3b82f6', isMulti: true, extra: [sliceData(m.signal)] });
        }
        if (ind === 'ml-sera' && mlData?.sera) {
            const m = new Map(mlData.sera.map(v => [v.x, v.y]));
            lanes.push({ id: 'sera', name: 'SERA Energy', data: dates.map(d => m.get(d) || null), color: '#06b6d4', range: [-100, 100], isArea: true });
        }
        if (ind === 'momentum') lanes.push({ id: 'momentum', name: 'Momentum', data: sliceData(Indicators.momentum(fullData)), color: '#f87171' });
        if (ind === 'roc') lanes.push({ id: 'roc', name: 'ROC (%)', data: sliceData(Indicators.roc(fullData)), color: '#fb923c' });
        if (ind === 'exp-dmmv') lanes.push({ id: 'dmmv', name: 'DMMV Force', data: sliceData(Indicators.dmmv(fullData)), type: 'bar', color: '#10b981' });

        // Institutional Markers (Overlays)
        if (ind === 'ob' && mlData?.alpha?.order_blocks) {
            mlData.alpha.order_blocks.forEach(ob => {
                const color = ob.label === 'Supply Block' ? '#ef4444' : '#22c55e';
                mainSeries[0].markPoint.data.push({
                    name: ob.label, coord: [ob.x, ob.y],
                    value: ob.label[0],
                    itemStyle: { color: color, opacity: 0.8 },
                    label: { show: true, fontSize: 8, color: '#fff', fontWeight: 'bold' }
                });
            });
        }
        if (ind === 'fvg' && mlData?.alpha?.fvg) {
            mlData.alpha.fvg.forEach(gap => {
                const color = gap.type === 'Bullish' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)';
                const borderColor = gap.type === 'Bullish' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';
                mainSeries[0].markArea.data.push([
                    { name: gap.type + ' FVG', xAxis: gap.start, yAxis: gap.bottom, itemStyle: { color: color, borderColor: borderColor, borderWidth: 1 } },
                    { xAxis: gap.end, yAxis: gap.top }
                ]);
            });
        }
    });

    const laneCount = lanes.length;
    const volHeight = 8;
    const laneHeight = laneCount > 6 ? 4 : laneCount > 4 ? 6 : 8;
    const bottomReserved = volHeight + (laneCount * (laneHeight + 3));
    const mainHeight = Math.max(20, 100 - bottomReserved - 10);

    let grids = [{ left: '3%', right: '3%', top: '5%', height: `${mainHeight}%` }, { left: '3%', right: '3%', top: `${mainHeight + 6}%`, height: `${volHeight}%` }];
    let xAxes = [{ type: 'category', data: dates, boundaryGap: false, axisLabel: { show: false } }, { type: 'category', gridIndex: 1, data: dates, boundaryGap: false, axisLabel: { show: laneCount === 0, color: 'var(--text-dim)', fontSize: 9 } }];
    let yAxes = [{ scale: true, splitLine: { lineStyle: { color: '#111' } } }, { gridIndex: 1, splitNumber: 1, axisLabel: { show: false }, splitLine: { show: false } }];

    let finalSeries = [...mainSeries];
    finalSeries.push({ name: 'Volume', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: volumes.map(v => v[1]), itemStyle: { color: (p) => volumes[p.dataIndex][2] === 1 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' } });

    lanes.forEach((lane, i) => {
        const gridIdx = i + 2;
        const top = mainHeight + volHeight + 10 + (i * (laneHeight + 3));
        grids.push({ left: '3%', right: '3%', top: `${top}%`, height: `${laneHeight}%` });
        xAxes.push({ type: 'category', gridIndex: gridIdx, data: dates, boundaryGap: false, axisLabel: { show: i === laneCount - 1, fontSize: 8, color: '#444' } });
        yAxes.push({ gridIndex: gridIdx, min: lane.id.match(/pivot|channel|bbands|ichimoku|fib|keltner|vwap/) ? null : lane.range?.[0], max: lane.id.match(/pivot|channel|bbands|ichimoku|fib|keltner|vwap/) ? null : lane.range?.[1], scale: true, splitNumber: 1, axisLabel: { fontSize: 7, color: '#555' }, splitLine: { lineStyle: { color: '#000' } } });
        finalSeries.push({ name: lane.name, type: lane.type || 'line', data: lane.data, xAxisIndex: gridIdx, yAxisIndex: gridIdx, showSymbol: false, symbolSize: 2, lineStyle: { color: lane.color, width: 1.5 }, areaStyle: lane.isArea ? { color: lane.color, opacity: 0.1 } : null, itemStyle: { color: lane.color } });
        if (lane.isMulti && lane.extra) {
            lane.extra.forEach((exData, ei) => {
                finalSeries.push({ name: `${lane.name} Ex ${ei}`, type: 'line', data: exData, xAxisIndex: gridIdx, yAxisIndex: gridIdx, showSymbol: false, lineStyle: { color: lane.id.match(/bbands|fib|keltner|vwap/) ? 'rgba(255,255,255,0.1)' : (ei === 0 ? '#ef4444' : '#22c55e'), width: 0.8, type: 'dotted' } });
            });
        }
    });

    mainChart.setOption({
        background: 'transparent', animation: false,
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } }, 
        axisPointer: { link: { xAxisIndex: 'all' } },
        grid: grids, xAxis: xAxes, yAxis: yAxes, series: finalSeries,
        toolbox: {
            feature: {
                dataZoom: { yAxisIndex: 'none' },
                restore: {},
                saveAsImage: {}
            },
            iconStyle: { borderColor: '#888' }, right: '5%'
        },
        dataZoom: [
            { type: 'inside', xAxisIndex: xAxes.map((_, i) => i), start: 0, end: 100 },
            { type: 'slider', xAxisIndex: xAxes.map((_, i) => i), start: 0, end: 100, height: 15, bottom: 2, borderColor: 'transparent', textStyle: { color: '#666' } }
        ]
    });
    window.addEventListener('resize', () => {
        if (mainChart) mainChart.resize();
        deepCharts.forEach(c => c.resize());
    });
};
