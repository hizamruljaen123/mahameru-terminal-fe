/**
 * StatsPanel.jsx — Statistical Testing Results Panel
 * Displays multi-method statistical tables, ECharts visualizations per category,
 * and Mermaid.js correlation diagram. Rendered as an overlay panel in EntityAdvancedView.
 */
import { onMount, onCleanup, createSignal } from 'solid-js';
import { runStatisticalBattery, closeStatsPanel, disposeAllCharts, toggleCategory } from './StatsLogic.js';
import { ensureMermaid } from '../../Copilot/RichResponseRenderer';

export default function StatsPanel(props) {
    const [isExecuting, setIsExecuting] = createSignal(false);
    const [statusText, setStatusText] = createSignal('READY');
    const [errorText, setErrorText] = createSignal('');

    const handleExecute = async () => {
        if (!props.symbol) return;
        setIsExecuting(true);
        setErrorText('');
        setStatusText('EXECUTING STATISTICAL BATTERY...');
        try {
            await runStatisticalBattery(props.symbol, props.period || '6mo');
            setStatusText('BATTERY COMPLETE');
        } catch (e) {
            // Silently log execution errors instead of showing them in the UI if needed,
            // but for now we keep it but ensure mermaid doesn't bark.
            console.warn('[STATS] Execution error:', e);
            setErrorText(e.message || 'Execution failed');
            setStatusText('EXECUTION FAILED');
        } finally {
            setIsExecuting(false);
        }
    };

    const handleClose = () => {
        closeStatsPanel();
        props.onClose?.();
    };

    onMount(async () => {
        // Initialize Mermaid with error suppression
        try {
            await ensureMermaid();
            if (window.mermaid) {
                window.mermaid.initialize({
                    startOnLoad: false,
                    theme: 'dark',
                    securityLevel: 'loose',
                    suppressErrorRendering: true, // Disable error diagrams in UI
                    logLevel: 'fatal'
                });
            }
        } catch (e) {
            console.warn('[STATS] Mermaid init failed:', e);
        }

        // Auto-execute if symbol is available
        if (props.symbol && props.autoRun !== false) {
            setTimeout(() => handleExecute(), 300);
        }
    });

    onCleanup(() => {
        disposeAllCharts();
    });

    // Re-execute when period changes
    const periodEffect = () => {
        if (props.symbol && props.period) {
            handleExecute();
        }
    };

    return (
        <div
            id="statsPanel"
            class="absolute inset-0 bg-[#050505] z-50 overflow-y-auto win-scroll"
            classList={{ hidden: !props.visible }}
        >
            {/* Header */}
            <div class="sticky top-0 bg-bg_header/95 backdrop-blur-md px-8 py-5 border-b border-white/5 flex justify-between items-center z-[100]">
                <div class="flex items-center gap-4">
                    <div class="w-2 h-8 bg-cyan-500 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
                    <div>
                        <h3 class="text-[13px] font-black text-cyan-400 uppercase tracking-[0.4em]">
                            STATISTICAL ANALYSIS MATRIX — <span class="text-text_main">{props.symbol || '---'}</span>
                        </h3>
                        <p class="text-[9px] text-text_dim font-bold uppercase opacity-50">
                            Multi-Method Statistical Battery · {props.period?.toUpperCase() || '6MO'} ·
                            <span id="statsStatus" class="ml-1 text-cyan-400">{statusText()}</span>
                        </p>
                    </div>
                </div>
                <div class="flex gap-3">
                    <button
                        onClick={handleExecute}
                        disabled={isExecuting()}
                        class={`px-5 py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded flex items-center gap-2 ${isExecuting()
                                ? 'bg-cyan-600/30 border border-cyan-500/30 text-cyan-400/50 cursor-wait'
                                : 'bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-black'
                            }`}
                    >
                        {isExecuting() ? (
                            <>
                                <div class="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                                EXECUTING...
                            </>
                        ) : (
                            '▶ RE-RUN BATTERY'
                        )}
                    </button>
                    <button
                        onClick={handleClose}
                        class="px-6 py-2 bg-red-600/20 border border-red-500/40 text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-black transition-all rounded"
                    >
                        EXIT
                    </button>
                </div>
            </div>

            {/* Loading Screen */}
            <div
                id="statsLoading"
                class="absolute inset-0 bg-black/80 backdrop-blur-sm z-[200] flex-col items-center justify-center"
                classList={{ hidden: !isExecuting(), flex: isExecuting() }}
            >
                <div class="flex flex-col items-center gap-6">
                    <div class="w-16 h-16 border-t-2 border-r-2 border-cyan-500 rounded-full animate-spin"></div>
                    <span class="text-cyan-400 text-[11px] font-black uppercase tracking-[0.8em] animate-pulse">
                        COMPUTING STATISTICAL BATTERY...
                    </span>
                    <span class="text-text_dim text-[9px] font-mono">
                        15+ tests across 7 analytical categories
                    </span>
                </div>
            </div>

            {/* Body */}
            <div class="p-8 space-y-8 pb-32">
                {/* Error */}
                {errorText() && (
                    <div class="px-6 py-4 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-[10px] font-mono">
                        ERROR: {errorText()}
                    </div>
                )}

                {/* Summary Row */}
                <div class="bg-bg_main border border-border_main/20 rounded-sm p-4">
                    <div id="statsSummaryBadges" class="mb-1">
                        <span class="text-text_dim text-[9px]">No data loaded. Click "RUN BATTERY" to execute statistical tests.</span>
                    </div>
                </div>

                {/* Category Tab Navigation */}
                <div id="statsCategoryTabs" class="flex flex-wrap gap-2 border-b border-white/5 pb-2">
                    {/* Populated dynamically by StatsLogic.js */}
                </div>

                {/* Category Tables + Charts */}
                <div id="statsTablesContainer" class="space-y-6">
                    {/* Populated dynamically by StatsLogic.js */}
                </div>

                {/* Correlation Mermaid Diagram */}
                <div id="statsMermaidContainer">
                    {/* Populated dynamically by StatsLogic.js */}
                </div>

                {/* Correlation Heatmap (separate ECharts) */}
                <div id="statsCorrelationHeatmap" class="w-full bg-[#020202] border border-border_main/10 rounded-sm hidden" style="height:400px">
                    {/* Populated if correlation data available */}
                </div>
            </div>
        </div>
    );
}
