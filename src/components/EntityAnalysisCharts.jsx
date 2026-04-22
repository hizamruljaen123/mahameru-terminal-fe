import { For, Show } from 'solid-js';
import { useEntityAnalysisCharts } from './EntityAnalysisCharts.logic';
import { SymbolInfoWidget, TechnicalAnalysisWidget, FinancialsWidget, SymbolProfileWidget, AdvancedChartWidget } from './TradingViewWidgets';

const EntityAnalysisCharts = (props) => {
    const state = useEntityAnalysisCharts(() => props.symbol);

    return (
        <div class="flex-1 overflow-auto bg-[#030303] p-4 space-y-4 scrollbar-thin">
            <Show when={state.loading()}>
                <div class="text-text_accent animate-pulse font-mono tracking-widest uppercase text-center py-10">PROCESSING...</div>
            </Show>

            <Show when={!state.loading()}>
                
                {/* TIER 1: ANALYSIS CENTER (TV Chart + Gauges) */}
                <div class="grid grid-cols-1 xl:grid-cols-4 gap-4">
                    {/* Main Chart Station */}
                    <div class="xl:col-span-3 h-[600px] bg-bg_header border border-border_main rounded flex flex-col shadow-2xl relative">
                        <div class="absolute top-4 left-4 pointer-events-none z-10 flex gap-2 items-center">
                            <span class="text-[9px] bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-[0.2em] shadow-[0_0_10px_rgba(16,185,129,0.2)]">LIVE SYNC</span>
                            <span class="text-[9px] bg-blue-500/20 text-blue-400 font-mono px-2 py-0.5 rounded border border-blue-500/30 uppercase tracking-[0.2em]">TV_PRO</span>
                        </div>
                        <div class="flex-1 w-full bg-black">
                            <AdvancedChartWidget symbol={props.symbol} height="100%" />
                        </div>
                    </div>
                    
                    {/* Right Gauges */}
                    <div class="xl:col-span-1 flex flex-col gap-4 h-[600px]">
                        <div class="flex-1 bg-bg_header border border-border_main rounded overflow-hidden flex flex-col relative group">
                            <div class="absolute top-2 left-2 z-10 text-[8px] space-x-1"><span class="bg-indigo-500/20 text-indigo-400 px-1 py-0.5 rounded font-bold uppercase tracking-widest">PROFILE</span></div>
                            <SymbolProfileWidget symbol={props.symbol} />
                        </div>
                        <div class="flex-1 bg-bg_header border border-border_main rounded overflow-hidden flex flex-col relative">
                            <div class="absolute top-2 left-2 z-10 text-[8px] space-x-1"><span class="bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded font-bold uppercase tracking-widest">QUANTITATIVE</span></div>
                            <TechnicalAnalysisWidget symbol={props.symbol} />
                        </div>
                    </div>
                </div>

                {/* TIER 2: MARKET EXECUTION */}
                <div class="grid grid-cols-1 xl:grid-cols-4 gap-4 h-[450px]">
                    {/* Live Execution Grid */}
                    <div class="xl:col-span-1 bg-bg_header border border-border_main rounded flex flex-col overflow-hidden shadow-xl">
                        <div class="px-4 py-2 border-b border-border_main flex justify-between items-center text-text_accent text-[11px] font-black uppercase tracking-widest bg-bg_main/50">
                            <span>LIVE TAPE</span>
                            <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                        </div>
                        <div class="flex-1 overflow-auto scrollbar-thin">
                            <table class="w-full text-left font-mono text-[9px] whitespace-nowrap">
                                <thead class="bg-bg_header sticky top-0 text-text_secondary opacity-50 uppercase font-black tracking-widest shadow-sm">
                                    <tr>
                                        <th class="p-2 border-b border-border_main">TIMESTAMP</th>
                                        <th class="p-2 border-b border-border_main text-right">Price</th>
                                        <th class="p-2 border-b border-border_main text-right">Delta</th>
                                        <th class="p-2 border-b border-border_main text-right px-4">Vol</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-border_main/20">
                                    <For each={state.intradayHistory()}>
                                        {(item) => (
                                            <tr class="hover:bg-bg_main/80 transition-colors group">
                                                <td class="p-2 text-text_secondary/70 group-hover:text-text_main">{item.time}</td>
                                                <td class="p-2 text-text_primary font-bold text-right">${item.price.toFixed(2)}</td>
                                                <td class={`p-2 text-right font-bold ${item.change >= 0 ? 'text-emerald-500' : 'text-red-500'} group-hover:scale-105 transition-transform`}>
                                                    {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}
                                                </td>
                                                <td class="p-2 text-text_secondary opacity-40 group-hover:opacity-100 text-right px-4">{item.volume.toLocaleString()}</td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* High-Frequency Engine */}
                    <div class="xl:col-span-1 bg-bg_header border border-border_main rounded flex flex-col p-3 relative shadow-xl">
                        <div class="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-2 border-b border-border_main/50 pb-1">SCALPING</div>
                        <div ref={state.setLiveChartRef} class="flex-1 w-full h-full"></div>
                    </div>

                    {/* MOMENTUM */}
                    <div class="xl:col-span-2 grid grid-cols-1 gap-4">
                        <div class="bg-[#05080c] border border-border_main rounded p-3 flex flex-col shadow-xl">
                            <div class="flex justify-between items-center mb-2 border-b border-emerald-500/20 pb-2">
                                <h3 class="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex gap-2 items-center">
                                    PRICE DYNAMICS
                                    <span class="bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded text-[8px] ml-2">UNIFIED</span>
                                </h3>
                                
                                <div class="flex gap-1">
                                    <For each={['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max']}>
                                        {(p) => (
                                            <button 
                                                onClick={() => state.handlePeriodChange(p)}
                                                class={`text-[8px] font-bold px-2 py-0.5 rounded transition-all uppercase tracking-widest ${
                                                    state.period() === p
                                                        ? 'bg-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                                                        : 'bg-bg_main text-text_secondary hover:bg-white/10 hover:text-white border border-border_main'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </div>
                            <div ref={state.setCombinedChartRef} class="flex-1 w-full h-full"></div>
                        </div>
                    </div>
                </div>

                {/* TIER 3: Macro Financials & Seasonality Matrix */}
                <div class="grid grid-cols-1 xl:grid-cols-4 gap-4">
                    {/* Financial Statements */}
                    <div class="xl:col-span-1 h-[450px] bg-bg_header border border-border_main rounded overflow-hidden shadow-xl relative">
                        <div class="absolute top-2 left-2 z-10 text-[8px] space-x-1"><span class="bg-gray-500/20 text-gray-400 px-1 py-0.5 rounded font-bold uppercase tracking-widest">FINANCIAL LEDGER</span></div>
                        <FinancialsWidget symbol={props.symbol} />
                    </div>

                    {/* Seasonality Grid */}
                    <div class="xl:col-span-3 bg-bg_header border border-border_main rounded p-6 shadow-xl h-[450px] overflow-hidden flex flex-col">
                        <div class="flex justify-between items-center mb-4 border-b border-border_main pb-3">
                            <h3 class="text-[11px] font-black text-text_accent uppercase tracking-[0.25em] flex items-center gap-2">
                                <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                                SEASONALITY ANALYSIS
                            </h3>
                            <Show when={state.showDrilldown()}>
                                <button onClick={() => state.setShowDrilldown(false)} class="text-[9px] bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 px-4 py-1.5 rounded transition-colors uppercase font-black tracking-widest shadow-[0_0_10px_rgba(239,68,68,0.2)]">EXIT DRILLDOWN</button>
                            </Show>
                        </div>

                        <Show when={!state.showDrilldown()}>
                            <div class="flex-1 overflow-auto scrollbar-thin">
                                <table class="w-full text-[9px] font-mono border-collapse min-w-[800px]">
                                    <thead class="sticky top-0 bg-bg_header z-10">
                                        <tr class="text-text_secondary opacity-70 font-black tracking-widest uppercase border-b border-border_main shadow-sm">
                                            <th class="p-2 text-left">YEAR</th>
                                            <For each={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}>
                                                {(m) => <th class="p-2 text-center">{m}</th>}
                                            </For>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-border_main/20">
                                        <For each={state.seasonalityYears()}>
                                            {(year) => (
                                                <tr class="hover:bg-white/5 transition-colors group">
                                                    <td class="p-2 font-black text-text_secondary group-hover:text-text_main">{year}</td>
                                                    <For each={state.seasonalityCells()[year]}>
                                                        {(cell) => (
                                                            <td class="p-0.5">
                                                                <div 
                                                                    onClick={() => state.handleSeasonalityClick(year, cell.month)}
                                                                    class="cursor-pointer flex flex-col items-center justify-center py-2.5 px-0.5 rounded-sm border border-transparent hover:border-white/40 transition-all duration-300 hover:scale-[1.15] hover:z-20 relative group/cell"
                                                                    style={{ "background-color": cell.bgColor, color: cell.txtColor, "box-shadow": `0 0 10px ${cell.txtColor}20` }}
                                                                >
                                                                    <span class="text-[9px] font-black tracking-tighter group-hover/cell:scale-110 transition-transform">{cell.formattedReturn}</span>
                                                                    <span class="text-[6px] opacity-40 font-bold tracking-widest mt-0.5 group-hover/cell:opacity-100">{cell.price ? `$${cell.price.toFixed(0)}` : ''}</span>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </For>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </Show>

                        <Show when={state.showDrilldown()}>
                            <div class="flex-1 w-full bg-black/20 rounded shadow-inner" ref={state.setDrilldownRef}></div>
                        </Show>
                    </div>
                </div>

            </Show>
        </div>
    );
};

export default EntityAnalysisCharts;
