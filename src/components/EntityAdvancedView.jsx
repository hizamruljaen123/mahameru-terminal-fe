import { createSignal, createEffect, onCleanup, onMount, Show } from 'solid-js';
import { initAdvancedAnalysis, setupToggles } from './EntityAdvancedLogic.js';

export default function EntityAdvancedView(props) {
    const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
    const [collapsedGroups, setCollapsedGroups] = createSignal(new Set(['dynamicOscillators', 'deepQuant', 'neuralLab']));

    const toggleGroup = (groupId) => {
        const next = new Set(collapsedGroups());
        if (next.has(groupId)) next.delete(groupId);
        else next.add(groupId);
        setCollapsedGroups(next);
    };

    onMount(() => {
        // Any initial mount logic if needed
    });

    createEffect(() => {
        if (props.fullHistory && props.symbol) {
            initAdvancedAnalysis(props.fullHistory, props.symbol);
        }
    });

    createEffect(() => {
        // Re-run setupToggles whenever a group is expanded or collapsed
        // to attach listeners to newly created DOM elements
        const groups = collapsedGroups();
        setTimeout(() => setupToggles(), 100); 
    });

    onCleanup(() => {
        // Any specific cleanup for ECharts or DOM bindings could go here
        // The script re-initializes or replaces things.
    });

    const coreOverlays = [
        { id: 'sma20', name: 'SMA 20-Day' }, { id: 'ema50', name: 'EMA 50-Day' }, 
        { id: 'frama', name: 'FRAMA Adaptive' }, { id: 'vwap', name: 'VWAP Alpha' }, 
        { id: 'bbands', name: 'Bollinger Matrix' }, { id: 'ichimoku', name: 'Ichimoku Cloud' }, 
        { id: 'psar', name: 'Parabolic SAR' }, { id: 'pivot', name: 'Standard Pivots' },
        { id: 'fib', name: 'Fibonacci Nodes' }, { id: 'channel', name: 'High/Low Channel' },
        { id: 'keltner', name: 'Keltner Matrix' }
    ];

    const dynamicOscillators = [
        { id: 'rsi', name: 'RSI Dynamic' }, { id: 'macd', name: 'MACD Spectrum' }, 
        { id: 'stoch', name: 'Stochastic K' }, { id: 'cci', name: 'CCI Harmonic' }, 
        { id: 'mfi', name: 'MFI Flow' }, { id: 'cmf', name: 'Chaikin CMF' },
        { id: 'roc', name: 'ROC Delta' }, { id: 'momentum', name: 'Momentum Flux' },
        { id: 'williams', name: 'Williams %R' }, { id: 'atr', name: 'ATR Volatility' }
    ];

    const deepQuant = [
        { id: 'ml-hurst', name: 'Hurst Exponent' }, { id: 'ml-montecarlo', name: 'Monte Carlo P30' }, 
        { id: 'ml-arima', name: 'ARIMA Forecast' }, { id: 'ml-apef', name: 'APEF Echo Scan' }, 
        { id: 'ml-sera', name: 'SERA Energy Map' }, { id: 'zscore', name: 'Z-Score Normal' },
        { id: 'exp-qeo', name: 'Logarithmic Entropy' }, { id: 'exp-kvi', name: 'Price-Volume Impulse' },
        { id: 'exp-grs', name: 'Statistical Spread' }, { id: 'exp-frc', name: 'Fractal Adaptive Smoothing' },
        { id: 'exp-stw', name: 'Adaptive Stochastic' }, { id: 'exp-dmmv', name: 'Market Momentum Index' }
    ];

    const neuralLab = [
        { id: 'nt-akft', name: 'AKFT Engine' }, { id: 'nt-ampa', name: 'AMPA Engine' }, 
        { id: 'nt-fahma', name: 'FAHMA Engine' }, { id: 'nt-prism', name: 'PRISM Engine' }
    ];

    return (
        <div id="advancedView" class="view-pane flex-1 overflow-y-auto win-scroll h-full p-6 space-y-6 bg-[#050505]">
            {/* Minimalist Strategic News Ticker */}
            <div class="bg-bg_header/30 border border-border_main/20 rounded-md py-2.5 px-6 overflow-hidden relative flex items-center gap-6 group backdrop-blur-sm">
                <div class="shrink-0 flex items-center gap-3 border-r border-border_main/30 pr-6 z-10 bg-bg_header/50">
                    <div class={`w-2 h-2 rounded-full ${props.newsLoading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'} shadow-[0_0_10px_currentColor]`}></div>
                    <span class="text-[10px] font-black text-text_main uppercase tracking-[0.3em]">LIVE_INTEL_STREAM</span>
                </div>
                <div class="flex-1 overflow-hidden relative h-4">
                    <div 
                        class="absolute inset-y-0 left-0 flex items-center gap-16 whitespace-nowrap hover:[animation-play-state:paused]"
                        style="animation: advancedTicker 80s linear infinite; display: flex; width: max-content;"
                    >
                        <style>{`
                            @keyframes advancedTicker {
                                0% { transform: translateX(0); }
                                100% { transform: translateX(-50%); }
                            }
                        `}</style>
                        <Show when={props.news && props.news.length > 0} fallback={<span class="text-[9px] text-text_dim italic uppercase opacity-40 tracking-widest">SYNCHRONIZING WITH GLOBAL RSS NODES...</span>}>
                            {/* Double the list for seamless loop */}
                            {[...props.news, ...props.news].map((item, idx) => (
                                <a href={item.link} target="_blank" class="flex items-center gap-3 hover:text-amber-500 transition-colors group/news">
                                    <span class="text-[10px] font-black text-text_secondary group-hover/news:text-text_main uppercase tracking-tight">{item.title}</span>
                                    <span class="text-[8px] font-bold text-text_dim opacity-40 uppercase tabular-nums">[{item.publisher} // {new Date(item.time * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
                                    <div class="w-1.5 h-1.5 bg-border_main rotate-45 opacity-20"></div>
                                </a>
                            ))}
                        </Show>
                    </div>
                    {/* Fades for smooth edge transition */}
                    <div class="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-bg_header/80 to-transparent z-10 pointer-events-none"></div>
                    <div class="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg_header/80 to-transparent z-10 pointer-events-none"></div>
                </div>
            </div>

            {/* Advanced Analytical Workstation Card */}
            <div class="flex h-[calc(100vh-400px)] min-h-[600px] gap-6 relative">
                
                {/* Sidebar Toggle Button (Floating) */}
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen())}
                    class={`absolute top-6 z-[100] w-7 h-14 bg-[#1a1a1a] border border-border_main flex items-center justify-center rounded-r hover:bg-text_accent group transition-all duration-300 shadow-xl ${isSidebarOpen() ? 'left-[320px]' : 'left-0'}`}
                    title={isSidebarOpen() ? "COLLAPSE SIDEBAR" : "EXPAND SIDEBAR"}
                >
                    <svg class={`w-4 h-4 text-text_secondary group-hover:text-bg_main transition-transform ${isSidebarOpen() ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>

                {/* Professional Sidebar */}
                <aside class={`bg-bg_header border border-border_main p-6 flex flex-col gap-8 overflow-y-auto scrollbar-thin transition-all duration-300 ${isSidebarOpen() ? 'w-80 opacity-100' : 'w-0 opacity-0 p-0 border-0 pointer-events-none overflow-hidden'}`}>
                    <div class="space-y-1">
                        <h4 class="text-[10px] font-black text-green-500 uppercase tracking-[0.3em]">ANALYTICAL MATRIX</h4>
                        <p class="text-text_dim text-[9px] uppercase font-bold opacity-40">SYSTEM PROTOCOL v4.2.0</p>
                    </div>

                    {/* Indicator Categories */}
                    <div class="space-y-6">
                        <div class="flex items-center justify-between border-b border-white/5 pb-2">
                            <span class="text-[8px] font-black text-text_dim uppercase opacity-60">BULK CONTROLS</span>
                            <div class="flex gap-2">
                                <button onClick={() => window.selectAllIndicators()} class="text-[8px] font-black text-green-500 hover:underline uppercase">ALL</button>
                                <button onClick={() => window.unselectAllIndicators()} class="text-[8px] font-black text-red-500 hover:underline uppercase">NONE</button>
                            </div>
                        </div>
                        {/* Group 1: Core Overlays */}
                        <div class="space-y-3">
                            <button 
                                onClick={() => toggleGroup('coreOverlays')}
                                class="w-full flex items-center justify-between text-[9px] font-black text-blue-400 uppercase tracking-widest border-l-2 border-blue-400 pl-3 hover:text-white transition-colors"
                            >
                                <span>01. CORE OVERLAYS</span>
                                <span class="text-[8px] opacity-40">{!collapsedGroups().has('coreOverlays') ? '-' : '+'}</span>
                            </button>
                            <Show when={!collapsedGroups().has('coreOverlays')}>
                                <div class="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
                                    {coreOverlays.map(item => (
                                        <label class="flex items-center justify-between group cursor-pointer bg-bg_main/30 p-2 rounded border border-transparent hover:border-border_main transition-all">
                                            <span class="text-[10px] font-bold text-text_dim group-hover:text-text_main">{item.name}</span>
                                            <div class="relative">
                                                <input type="checkbox" class="indicator-toggle hidden" data-indicator={item.id} />
                                                <div class="indicator-check w-4 h-4 rounded border border-border_main flex items-center justify-center transition-all group-hover:bg-text_main/5"></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </Show>
                        </div>

                        {/* Group 2: Momentum & Oscillators */}
                        <div class="space-y-3">
                            <button 
                                onClick={() => toggleGroup('dynamicOscillators')}
                                class="w-full flex items-center justify-between text-[9px] font-black text-purple-400 uppercase tracking-widest border-l-2 border-purple-400 pl-3 hover:text-white transition-colors"
                            >
                                <span>02. DYNAMIC OSCILLATORS</span>
                                <span class="text-[8px] opacity-40">{!collapsedGroups().has('dynamicOscillators') ? '-' : '+'}</span>
                            </button>
                            <Show when={!collapsedGroups().has('dynamicOscillators')}>
                                <div class="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
                                    {dynamicOscillators.map(item => (
                                        <label class="flex items-center justify-between group cursor-pointer bg-bg_main/30 p-2 rounded border border-transparent hover:border-border_main transition-all">
                                            <span class="text-[10px] font-bold text-text_dim group-hover:text-text_main">{item.name}</span>
                                            <div class="relative">
                                                <input type="checkbox" class="indicator-toggle hidden" data-indicator={item.id} />
                                                <div class="indicator-check w-4 h-4 rounded border border-border_main flex items-center justify-center transition-all group-hover:bg-text_main/5"></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </Show>
                        </div>

                        {/* Group 3: Deep Quant & Experimental */}
                        <div class="space-y-3">
                            <button 
                                onClick={() => toggleGroup('deepQuant')}
                                class="w-full flex items-center justify-between text-[9px] font-black text-amber-500 uppercase tracking-widest border-l-2 border-amber-500 pl-3 hover:text-white transition-colors"
                            >
                                <span>03. QUANTITATIVE ANALYSIS</span>
                                <span class="text-[8px] opacity-40">{!collapsedGroups().has('deepQuant') ? '-' : '+'}</span>
                            </button>
                            <Show when={!collapsedGroups().has('deepQuant')}>
                                <div class="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
                                    {deepQuant.map(item => (
                                        <label class="flex items-center justify-between group cursor-pointer bg-bg_main/30 p-2 rounded border border-transparent hover:border-border_main transition-all">
                                            <span class="text-[10px] font-bold text-text_dim group-hover:text-text_main">{item.name}</span>
                                            <div class="relative">
                                                <input type="checkbox" class="indicator-toggle hidden" data-indicator={item.id} />
                                                <div class="indicator-check w-4 h-4 rounded border border-indigo-500/30 flex items-center justify-center transition-all group-hover:bg-indigo-500/10"></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </Show>
                        </div>

                        {/* Group 4: Neural Zenith Protocols */}
                        <div class="space-y-3">
                            <button 
                                onClick={() => toggleGroup('neuralLab')}
                                class="w-full flex items-center justify-between text-[9px] font-black text-red-500 uppercase tracking-widest border-l-2 border-red-500 pl-3 hover:text-white transition-colors"
                            >
                                <span>04. ALGORITHMIC FORECASTING</span>
                                <span class="text-[8px] opacity-40">{!collapsedGroups().has('neuralLab') ? '-' : '+'}</span>
                            </button>
                            <Show when={!collapsedGroups().has('neuralLab')}>
                                <div class="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
                                    {neuralLab.map(item => (
                                        <label class="flex items-center justify-between group cursor-pointer bg-bg_main/30 p-2 rounded border border-transparent hover:border-border_main transition-all">
                                            <span class="text-[10px] font-black text-text_main group-hover:text-red-400">{item.name}</span>
                                            <div class="relative">
                                                <input type="checkbox" class="indicator-toggle hidden" data-indicator={item.id} />
                                                <div class="indicator-check w-4 h-4 rounded border border-red-500/50 flex items-center justify-center transition-all group-hover:bg-red-500/20"></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </Show>
                        </div>
                    </div>
                </aside>

                {/* Main Workspace */}
                <main class="flex-1 bg-bg_main border border-border_main flex flex-col relative overflow-hidden rounded-md">
                    {/* Workspace Toolbar */}
                    <div class="bg-bg_header px-6 py-4 border-b border-border_main flex justify-between items-center z-10">
                        <div class="flex gap-4">
                            {['1d', '1w', '1mo', '3mo', '6mo', '1y', '3y', '5y', '10y'].map(r => (
                                <button class="adv-period-btn px-4 py-1.5 text-[10px] font-black rounded border border-border_main/50 text-text_dim hover:text-text_main data-[active=true]:bg-green-600 data-[active=true]:text-white data-[active=true]:border-green-600 uppercase transition-all" data-range={r} data-active={r === '6mo' ? 'true' : null}>{r}</button>
                            ))}
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="text-[9px] font-black text-text_dim uppercase tracking-[0.2em] animate-pulse">SYNC STATUS: ACTIVE</span>
                        </div>
                    </div>

                    {/* Chart Layers */}
                    <div id="advancedChart" class="flex-1 w-full bg-[#030303] z-0"></div>

                    {/* Deep Analysis Overlay Panel */}
                    <div id="deepAnalysisPanel" class="absolute inset-0 bg-[#050505] z-50 overflow-y-auto scrollbar-thin hidden">
                         <div class="sticky top-0 bg-bg_header/95 backdrop-blur-md px-10 py-6 border-b border-white/5 flex justify-between items-center z-[100]">
                            <h3 class="text-[13px] font-black text-indigo-400 uppercase tracking-[0.4em]">QUANTITATIVE FORECAST PROTOCOL — <span class="active-ticker">---</span></h3>
                            <div class="flex gap-4">
                                <button onClick={() => window.stopDeep()} class="px-6 py-2 bg-yellow-600/20 border border-yellow-500/40 text-yellow-500 text-[9px] font-black uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-all">STOP ANALYSIS</button>
                                <button onClick={() => window.closeDeepAnalysis()} class="px-6 py-2 bg-red-600/20 border border-red-500/40 text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-black transition-all">EXIT</button>
                            </div>
                        </div>
                        <div id="deepAnalysisContent" class="p-10 space-y-12 pb-32">
                            {/* Dynamic Deep Nodes */}
                        </div>
                    </div>

                    {/* Loading Screens */}
                    <div id="advancedLoadingScreen" class="absolute inset-0 bg-black/80 backdrop-blur-sm z-[200] hidden flex-col items-center justify-center">
                        <div class="flex flex-col items-center gap-4">
                            <div class="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                            <span class="text-green-500 text-[10px] font-black uppercase tracking-[0.5em]">SYNCING DATA...</span>
                        </div>
                    </div>
                    <div id="deepLoadingScreen" class="absolute inset-0 bg-black/90 backdrop-blur-lg z-[300] hidden flex-col items-center justify-center">
                        <div class="flex flex-col items-center gap-6">
                            <div class="w-16 h-16 border-t-2 border-r-2 border-indigo-500 rounded-full animate-spin"></div>
                            <span class="text-indigo-400 text-[11px] font-black uppercase tracking-[0.8em] animate-pulse">PROCESSING...</span>
                        </div>
                    </div>
                </main>
            </div>

            {/* Separate Historical Data Table Card */}
            <div id="advancedTablePanel" class="bg-bg_main border border-border_main rounded-lg overflow-hidden hidden animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-2xl">
                <div class="bg-bg_header px-8 py-5 border-b border-border_main flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <div class="w-2 h-8 bg-green-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.5)]"></div>
                        <div>
                            <h3 class="text-[13px] font-black text-text_main uppercase tracking-[0.3em]">HISTORICAL DATA BUFFER</h3>
                            <p class="text-[9px] text-text_dim font-bold uppercase opacity-50">Operational Stream Matrix — <span class="active-ticker">---</span></p>
                        </div>
                    </div>
                    <div class="flex items-center gap-6">
                        <span class="text-[9px] font-black text-green-500/60 uppercase tracking-widest animate-pulse">STREAM_READY</span>
                        <button onClick={() => document.getElementById('advancedTablePanel').classList.add('hidden')} class="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all rounded flex items-center gap-2 group">
                            <span>TERMINATE_BUFFER</span>
                            <svg class="w-3 h-3 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                </div>
                <div class="max-h-[600px] overflow-y-auto scrollbar-thin">
                    <table class="w-full text-left text-[11px] border-collapse font-mono">
                        <thead class="bg-[#0a0a0a] sticky top-0 text-text_secondary text-[9px] uppercase font-black z-20">
                            <tr class="border-b border-border_main/50">
                                <th class="p-4 pl-8 border-r border-border_main/20">DATETIME_STAMP</th>
                                <th class="p-4 border-r border-border_main/20 text-right">OPEN_VAL</th>
                                <th class="p-4 border-r border-border_main/20 text-right">HIGH_VAL</th>
                                <th class="p-4 border-r border-border_main/20 text-right">LOW_VAL</th>
                                <th class="p-4 border-r border-border_main/20 text-right text-text_main">CLOSE_VAL</th>
                                <th class="p-4 pr-8 text-right">VOL_MATRIX</th>
                            </tr>
                        </thead>
                        <tbody id="advancedTableBody" class="divide-y divide-border_main/10 bg-[#020202]">
                            {/* Handled natively by Logic JS */}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
