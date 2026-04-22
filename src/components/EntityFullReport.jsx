import { createSignal, onMount, For, Show, onCleanup, createEffect } from 'solid-js';

const EntityFullReport = (props) => {
    const [info, setInfo] = createSignal(null);
    const [financials, setFinancials] = createSignal(null);
    const [ownership, setOwnership] = createSignal(null);
    const [analyst, setAnalyst] = createSignal(null);
    const [events, setEvents] = createSignal(null);
    
    // Global error/loading
    const [error, setError] = createSignal(null);

    let revenueChartRef;
    let balanceChartRef;
    let holdersChartRef;
    let recommendationChartRef;

    let chartInstances = [];

    // Individual chart effects for serial population
    createEffect(() => {
        if (financials() && revenueChartRef) setTimeout(initFinancialCharts, 100);
    });

    createEffect(() => {
        if (ownership() && holdersChartRef) setTimeout(initOwnershipCharts, 100);
    });

    createEffect(() => {
        if (analyst() && recommendationChartRef) setTimeout(initAnalystCharts, 100);
    });

    const initFinancialCharts = () => {
        if (!financials() || !revenueChartRef) return;
        const revChart = window.echarts.getInstanceByDom(revenueChartRef) || window.echarts.init(revenueChartRef);
        chartInstances.push(revChart);
        
        const dates = Object.keys(financials().income_statement).sort();
        const revenues = dates.map(d => financials().income_statement[d]["Total Revenue"]);
        const netIncome = dates.map(d => financials().income_statement[d]["Net Income"]);
        const margins = dates.map(d => (financials().income_statement[d]["Net Income"] / (financials().income_statement[d]["Total Revenue"] || 1) * 100));

        revChart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
            legend: { textStyle: { color: '#666' }, bottom: 0 },
            grid: { top: '15%', left: '3%', right: '4%', bottom: '15%', containLabel: true },
            xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#333' } } },
            yAxis: [
                { type: 'value', name: 'Volume', splitLine: { lineStyle: { color: '#222' } } },
                { type: 'value', name: '%', splitLine: { show: false } }
            ],
            series: [
                { name: 'Revenue', type: 'bar', data: revenues, itemStyle: { color: '#00e5ff', opacity: 0.8 }, barMaxWidth: 20 },
                { name: 'Income', type: 'bar', data: netIncome, itemStyle: { color: '#10b981' }, barMaxWidth: 20 },
                { name: 'Margin', type: 'line', yAxisIndex: 1, data: margins, itemStyle: { color: '#fbbf24' } }
            ]
        });

        const balChart = window.echarts.getInstanceByDom(balanceChartRef) || window.echarts.init(balanceChartRef);
        chartInstances.push(balChart);
        const latestDate = dates[dates.length - 1];
        const latestBal = financials().balance_sheet[latestDate] || {};
        balChart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'item' },
            series: [{
                name: 'Financial Health',
                type: 'pie', radius: ['40%', '70%'],
                data: [
                    { value: latestBal["Cash And Cash Equivalents"], name: 'Cash', itemStyle: { color: '#00e5ff' } },
                    { value: latestBal["Long Term Debt"], name: 'Debt', itemStyle: { color: '#ef4444' } },
                    { value: latestBal["Inventory"], name: 'Inv', itemStyle: { color: '#fbbf24' } }
                ]
            }]
        });
    };

    const initOwnershipCharts = () => {
        if (!ownership() || !holdersChartRef) return;
        const ownersChart = window.echarts.getInstanceByDom(holdersChartRef) || window.echarts.init(holdersChartRef);
        chartInstances.push(ownersChart);
        const topOwners = Object.keys(ownership().institutional_holders.Holder || {}).map(idx => ({
            name: ownership().institutional_holders.Holder[idx],
            value: ownership().institutional_holders.Shares[idx]
        })).slice(0, 5);

        ownersChart.setOption({
            backgroundColor: 'transparent', tooltip: { trigger: 'item' },
            series: [{ name: 'Institutional Whales', type: 'pie', radius: '60%', data: topOwners, label: { show: false } }]
        });
    };

    const initAnalystCharts = () => {
        if (!analyst() || !recommendationChartRef) return;
        const recChart = window.echarts.getInstanceByDom(recommendationChartRef) || window.echarts.init(recommendationChartRef);
        chartInstances.push(recChart);
        const rec = analyst().recommendations;
        if (rec && rec.period) {
            const currentIdx = Object.keys(rec.period).find(k => rec.period[k] === '0m') || "0";
            const radarData = [rec.strongBuy[currentIdx] || 0, rec.buy[currentIdx] || 0, rec.hold[currentIdx] || 0, rec.sell[currentIdx] || 0];
            recChart.setOption({
                backgroundColor: 'transparent',
                radar: {
                    indicator: [{ name: 'S-Buy', max: 50 }, { name: 'Buy', max: 50 }, { name: 'Hold', max: 50 }, { name: 'Sell', max: 20 }],
                    radius: '60%'
                },
                series: [{ type: 'radar', data: [{ value: radarData, areaStyle: { color: 'rgba(16, 185, 129, 0.2)' } }] }]
            });
        }
    };

    onMount(() => {
        const symbol = props.symbol;
        const BASE = `${import.meta.env.VITE_ENTITY_URL}/api/entity/fundamental`;

        // Serial but concurrent fire-and-forget population
        fetch(`${BASE}/info/${symbol}`).then(r => r.json()).then(setInfo).catch(e => setError(e.message));
        fetch(`${BASE}/financials/${symbol}`).then(r => r.json()).then(setFinancials).catch(e => setError(e.message));
        fetch(`${BASE}/ownership/${symbol}`).then(r => r.json()).then(setOwnership).catch(e => setError(e.message));
        fetch(`${BASE}/analyst/${symbol}`).then(r => r.json()).then(setAnalyst).catch(e => setError(e.message));
        fetch(`${BASE}/events/${symbol}`).then(r => r.json()).then(setEvents).catch(e => setError(e.message));

        const resizeHandler = () => chartInstances.forEach(c => c.resize());
        window.addEventListener('resize', resizeHandler);
        onCleanup(() => {
            window.removeEventListener('resize', resizeHandler);
            chartInstances.forEach(c => c.dispose());
        });
    });

    const formatValue = (val) => {
        if (val === null || val === "" || val === undefined) return "-";
        if (typeof val === 'number') {
            if (Math.abs(val) >= 1e12) return (val / 1e12).toFixed(2) + "T";
            if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(2) + "B";
            if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + "M";
            return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
        }
        return val;
    };

    const renderTable = (sectionData, title, compact = false) => {
        if (!sectionData || Object.keys(sectionData).length === 0) return null;
        const dates = Object.keys(sectionData).sort().reverse();
        const rows = Object.keys(sectionData[dates[0]] || {});

        return (
            <div class={`overflow-hidden border border-border_main rounded flex flex-col h-full bg-bg_header/10`}>
                <div class="bg-bg_header p-2 px-3 border-b border-border_main flex justify-between items-center">
                    <h3 class="text-[10px] font-black text-text_accent uppercase tracking-widest">{title}</h3>
                </div>
                <div class="flex-1 overflow-auto scrollbar-thin">
                    <table class="w-full text-[9px] text-left border-collapse">
                        <thead class="bg-bg_main text-text_secondary uppercase font-bold sticky top-0 z-10">
                            <tr>
                                <th class="p-2 border-r border-border_main w-32 bg-bg_main">Metric</th>
                                <For each={dates}>
                                    {(date) => <th class="p-2 text-right border-r border-border_main bg-bg_main">{date}</th>}
                                </For>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border_main/20 font-mono">
                            <For each={rows}>
                                {(row) => (
                                    <tr class="hover:bg-bg_main/30 transition-colors">
                                        <td class="p-1 px-2 border-r border-border_main text-text_secondary truncate">{row}</td>
                                        <For each={dates}>
                                            {(date) => (
                                                <td class="p-1 px-2 text-right border-r border-border_main text-text_primary">
                                                    {formatValue(sectionData[date][row])}
                                                </td>
                                            )}
                                        </For>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div class="flex-1 overflow-auto scrollbar-thin p-1 space-y-8 animate-in fade-in duration-700">
            <Show when={error()}>
                <div class="p-6 border border-red-500/30 bg-red-500/10 rounded text-red-500 font-mono text-sm">
                    [SYSTEM_FAILURE] Internal error accessing fundamental node: {error()}
                </div>
            </Show>

            {/* Header Section */}
            <Show when={info()} fallback={<div class="h-32 bg-bg_header animate-pulse rounded border border-border_main"></div>}>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-2 space-y-6">
                        <div class="bg-bg_header p-6 border border-border_main rounded shadow-2xl relative overflow-hidden group">
                            <div class="absolute top-0 right-0 p-2 opacity-10 font-black text-4xl group-hover:opacity-20 transition-all pointer-events-none uppercase">{info().symbol}</div>
                            <h2 class="text-2xl font-black text-text_primary uppercase mb-2">{info().longName}</h2>
                            <p class="text-xs text-text_secondary leading-relaxed opacity-80">{info().longBusinessSummary}</p>
                            <div class="mt-4 flex flex-wrap gap-4 text-[10px] font-black uppercase text-text_accent">
                                <span>Sector: {info().sector}</span>
                                <span class="opacity-30">|</span>
                                <span>Industry: {info().industry}</span>
                                <span class="opacity-30">|</span>
                                <span>Employees: {formatValue(info().fullTimeEmployees)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="bg-bg_header p-6 border border-border_main rounded space-y-4">
                        <h3 class="text-[10px] font-black text-text_secondary uppercase tracking-[0.2em] border-b border-border_main pb-2">Institutional Overlook</h3>
                        <div class="space-y-3">
                            <div class="flex justify-between items-center text-[11px]">
                                <span class="text-text_secondary opacity-60 uppercase">Market Cap</span>
                                <span class="font-bold text-text_accent">{formatValue(info().marketCap)}</span>
                            </div>
                            <div class="flex justify-between items-center text-[11px]">
                                <span class="text-text_secondary opacity-60 uppercase">Revenue (TTM)</span>
                                <span class="font-bold text-emerald-500">{formatValue(info().totalRevenue)}</span>
                            </div>
                            <div class="flex justify-between items-center text-[11px]">
                                <span class="text-text_secondary opacity-60 uppercase">EBITDA</span>
                                <span class="font-bold text-blue-400">{formatValue(info().ebitda)}</span>
                            </div>
                            <div class="flex justify-between items-center text-[11px]">
                                <span class="text-text_secondary opacity-60 uppercase">Target Price</span>
                                <span class="font-bold text-amber-500">{formatValue(info().targetMeanPrice)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>

            {/* Quantitative Charts Section */}
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
                <div class="lg:col-span-6 bg-bg_header border border-border_main rounded p-4 h-[350px]">
                    <h3 class="text-[10px] font-black text-text_accent uppercase tracking-widest mb-4">Strategic Trend: Rev/Income</h3>
                    <Show when={financials()} fallback={<div class="w-full h-full bg-bg_main/10 animate-pulse"></div>}>
                        <div ref={revenueChartRef} class="w-full h-full"></div>
                    </Show>
                </div>
                <div class="lg:col-span-3 bg-bg_header border border-border_main rounded p-4 h-[350px]">
                    <h3 class="text-[10px] font-black text-text_accent uppercase tracking-widest mb-4">Liquidity Pulse</h3>
                    <Show when={financials()} fallback={<div class="w-full h-full bg-bg_main/10 animate-pulse"></div>}>
                        <div ref={balanceChartRef} class="w-full h-full"></div>
                    </Show>
                </div>
                <div class="lg:col-span-3 bg-bg_header border border-border_main rounded p-4 h-[350px]">
                    <h3 class="text-[10px] font-black text-text_accent uppercase tracking-widest mb-4">Consensus Mapping</h3>
                    <Show when={analyst()} fallback={<div class="w-full h-full bg-bg_main/10 animate-pulse"></div>}>
                        <div ref={recommendationChartRef} class="w-full h-full"></div>
                    </Show>
                </div>
            </div>

            {/* Quantitative Financial Intelligence Section */}
            <div class="space-y-6 mt-12">
                <div class="flex items-center gap-4">
                    <h2 class="text-xl font-black text-text_accent uppercase tracking-[0.3em] border-l-4 border-text_accent pl-6 bg-gradient-to-r from-text_accent/10 to-transparent py-2">Quantitative Financial Intelligence</h2>
                    <div class="flex-1 h-[2px] bg-gradient-to-r from-text_accent/20 to-transparent"></div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
                    <Show when={financials()} fallback={<div class="h-full bg-bg_header/20 animate-pulse rounded border border-border_main"></div>}>
                        {renderTable(financials().income_statement, "Income Statement [TTM/Annual]")}
                        {renderTable(financials().balance_sheet, "Balance Sheet [Capital Structure]")}
                    </Show>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-1 gap-6 h-[300px]">
                    <Show when={financials()} fallback={<div class="h-full bg-bg_header/20 animate-pulse rounded border border-border_main"></div>}>
                        {renderTable(financials().cash_flow, "Cash Flow Dynamics [Comparative Ledger]")}
                    </Show>
                </div>
            </div>
                
            {/* Stakeholder & Insider Intelligence Dossier */}
            <div class="mt-12 space-y-6">
                <div class="flex items-center gap-4">
                    <h2 class="text-xl font-black text-amber-500 uppercase tracking-[0.3em] border-l-4 border-amber-500 pl-6 bg-gradient-to-r from-amber-500/10 to-transparent py-2">Stakeholder Intelligence Dossier</h2>
                    <div class="flex-1 h-[2px] bg-gradient-to-r from-amber-500/20 to-transparent"></div>
                </div>

                <Show when={ownership()} fallback={<div class="h-64 bg-bg_header/20 animate-pulse rounded border border-border_main"></div>}>
                    <div class="border border-border_main rounded overflow-hidden bg-bg_header/5">
                        <div class="grid grid-cols-1 lg:grid-cols-12">
                            {/* Left: Shareholder Matrix */}
                            <div class="lg:col-span-4 border-r border-border_main">
                                <div class="bg-bg_header p-2 px-3 border-b border-border_main">
                                    <h3 class="text-[10px] font-black text-text_accent uppercase tracking-widest text-center">Relative Shareholder Proximity</h3>
                                </div>
                                <div class="p-4 bg-bg_main/5">
                                    <div ref={holdersChartRef} class="w-full h-[250px]"></div>
                                    <div class="mt-4 grid grid-cols-1 gap-1.5 overflow-auto max-h-[150px] scrollbar-thin text-center text-[9px] text-text_secondary uppercase opacity-50">
                                        [Aggregated Institutional Node Data]
                                    </div>
                                </div>
                            </div>

                            {/* Right: Institutional Whales */}
                            <div class="lg:col-span-8 flex flex-col h-full overflow-hidden">
                                <div class="bg-bg_header p-2 px-3 border-b border-border_main">
                                    <h3 class="text-[10px] font-black text-text_accent uppercase tracking-widest">Institutional Whales [Top 10 Analysis]</h3>
                                </div>
                                <div class="flex-1 overflow-auto max-h-[450px] scrollbar-thin">
                                    <table class="w-full text-left text-[9px] border-collapse">
                                        <thead class="bg-bg_main text-text_secondary uppercase font-bold sticky top-0 z-10">
                                            <tr>
                                                <th class="p-2 border-r border-border_main">Entity Descriptor</th>
                                                <th class="p-2 text-right border-r border-border_main">Shares Held</th>
                                                <th class="p-2 text-right border-r border-border_main">% Node</th>
                                                <th class="p-2 text-right border-r border-border_main">Value Node</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-border_main/10 font-mono bg-bg_header/5">
                                            <For each={Object.keys(ownership().institutional_holders?.Holder || {}).slice(0, 10)}>
                                                {(idx) => (
                                                    <tr class="hover:bg-bg_main transition-colors">
                                                        <td class="p-1.5 px-3 text-text_primary font-bold border-r border-border_main/10">{ownership().institutional_holders.Holder[idx]}</td>
                                                        <td class="p-1.5 px-3 text-right border-r border-border_main/10">{formatValue(ownership().institutional_holders.Shares[idx])}</td>
                                                        <td class="p-1.5 px-3 text-right border-r border-border_main/10 text-text_accent font-black">{(ownership().institutional_holders.pctHeld[idx] * 100).toFixed(2)}%</td>
                                                        <td class="p-1.5 px-3 text-right border-r border-border_main/10">{formatValue(ownership().institutional_holders.Value[idx])}</td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Bottom: Infiltrator Dynamics (Full-Width) */}
                        <div class="border-t border-border_main">
                            <div class="bg-bg_header p-2 px-3 border-b border-border_main flex justify-between items-center">
                                <h3 class="text-[10px] font-black text-amber-500 uppercase tracking-widest">Infiltrator Dynamics [Analytic Insider Transactions Record]</h3>
                            </div>
                            <div class="overflow-auto max-h-[300px] scrollbar-thin bg-bg_main/5">
                                <table class="w-full text-left text-[9px] border-collapse">
                                    <thead class="bg-bg_main text-text_secondary uppercase font-bold sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2 px-3 border-r border-border_main">Insider Entity</th>
                                            <th class="p-2 px-3 border-r border-border_main">Position Rank</th>
                                            <th class="p-2 px-3 border-r border-border_main">Execution Modality</th>
                                            <th class="p-2 px-3 text-right border-r border-border_main">Shares Volume</th>
                                            <th class="p-2 px-3 text-right">Value Node</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-border_main/10 font-mono">
                                        <For each={Object.keys(ownership().insider_transactions?.Insider || {}).slice(0, 15)}>
                                            {(idx) => (
                                                <tr class="hover:bg-bg_main/50 transition-colors">
                                                    <td class="p-1 px-2 font-bold text-text_primary border-r border-border_main/10">
                                                        <div class="truncate max-w-[150px]">{ownership().insider_transactions.Insider[idx]}</div>
                                                    </td>
                                                    <td class="p-1 px-2 uppercase text-text_secondary opacity-70 border-r border-border_main/10 truncate max-w-[120px]">{ownership().insider_transactions.Position[idx]}</td>
                                                    <td class="p-1 px-2 border-r border-border_main/10">
                                                        <span class={ownership().insider_transactions.Text[idx]?.toLowerCase().includes('sale') ? 'text-red-400' : 'text-emerald-400 uppercase'}>
                                                            {ownership().insider_transactions.Text[idx]?.split(' ')[0] || "ACQUISITION"}
                                                        </span>
                                                    </td>
                                                    <td class="p-1 px-3 text-right font-black border-r border-border_main/10 text-text_primary">{formatValue(ownership().insider_transactions.Shares[idx])}</td>
                                                    <td class="p-1 px-3 text-right text-text_accent font-bold bg-text_accent/5">{formatValue(ownership().insider_transactions.Value[idx])}</td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </Show>
            </div>

            <div class="mt-8 text-center opacity-40 text-[9px] font-mono p-4 uppercase tracking-[0.5em]">
                End of Intelligence Dossier // {new Date().toISOString()}
            </div>
        </div>
    );
};

export default EntityFullReport;
