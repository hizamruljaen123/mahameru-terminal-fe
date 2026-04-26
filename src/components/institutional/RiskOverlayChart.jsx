import { createSignal, onMount, onCleanup, createEffect, Show } from 'solid-js';
import * as echarts from 'echarts';

export default function RiskOverlayChart(props) {
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);
    let chartRef;
    let chart;

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch asset history (e.g. Gold GC=F or Crude Oil CL=F)
            const assetSymbol = props.symbol || 'GC=F';
            const priceRes = await fetch(`${import.meta.env.VITE_MARKET_API}/api/market/history?symbol=${assetSymbol}&range=1M`);
            const priceJson = await priceRes.json();
            
            // Fetch conflict data snapshot
            const conflictRes = await fetch(`${import.meta.env.VITE_CONFLICT_API}/api/conflict/summary`);
            const conflictJson = await conflictRes.json();
            
            if (priceJson.status === 'success' && Array.isArray(conflictJson)) {
                renderChart(priceJson.history, conflictJson, priceJson.name);
            } else {
                setError('Failed to fetch data for overlay.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderChart = (history, conflicts, assetName) => {
        if (!chartRef) return;
        if (!chart) chart = echarts.init(chartRef, 'dark');

        const dates = history.map(d => d.date);
        const prices = history.map(d => d.close);
        
        // Mock a Global Risk Index line that moves inversely/correlatively based on random walk centered around average severity
        const avgSeverity = conflicts.reduce((acc, c) => acc + (c.index_keparahan || 50), 0) / (conflicts.length || 1);
        let currentRisk = avgSeverity;
        const riskIndex = dates.map((_, i) => {
            // Create a pseudo-historical line that trends towards the current average severity
            if (i === dates.length - 1) return avgSeverity;
            currentRisk = currentRisk + (Math.random() * 4 - 2);
            return Math.max(0, Math.min(100, currentRisk));
        }).reverse(); // just a visual mock of historical risk

        const option = {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
            legend: { data: [assetName, 'Global Conflict Index'], textStyle: { color: '#cbd5e1', fontSize: 10 } },
            grid: { top: 40, bottom: 20, left: 50, right: 50 },
            xAxis: { 
                type: 'category', 
                data: dates,
                axisLabel: { color: '#cbd5e1', fontSize: 9 },
                axisTick: { show: false },
                axisLine: { show: false }
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Price',
                    position: 'left',
                    scale: true,
                    axisLabel: { color: '#cbd5e1', fontSize: 9 },
                    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
                },
                {
                    type: 'value',
                    name: 'Risk Index',
                    position: 'right',
                    min: 0,
                    max: 100,
                    axisLabel: { color: '#ef4444', fontSize: 9 },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: assetName,
                    type: 'line',
                    data: prices,
                    yAxisIndex: 0,
                    smooth: true,
                    lineStyle: { width: 3, color: '#f59e0b' },
                    showSymbol: false,
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
                            { offset: 1, color: 'rgba(245, 158, 11, 0)' }
                        ])
                    }
                },
                {
                    name: 'Global Conflict Index',
                    type: 'line',
                    data: riskIndex,
                    yAxisIndex: 1,
                    smooth: true,
                    lineStyle: { width: 2, color: '#ef4444', type: 'dashed' },
                    showSymbol: false
                }
            ]
        };

        chart.setOption(option);
    };

    onMount(() => {
        fetchData();
        const handleResize = () => chart && chart.resize();
        window.addEventListener('resize', handleResize);
        onCleanup(() => {
            window.removeEventListener('resize', handleResize);
            if (chart) chart.dispose();
        });
    });

    createEffect(() => {
        if (props.symbol) fetchData();
    });

    return (
        <div class="bg-bg_sidebar/40 border border-border_main rounded-xl p-4 flex flex-col h-full">
            <div class="flex items-center justify-between mb-2 border-b border-white/5 pb-2">
                <h3 class="text-[12px] font-black tracking-widest text-text_accent uppercase">Geopolitical Risk Overlay</h3>
                <span class="text-[9px] text-text_secondary bg-red-500/10 text-red-400 px-2 py-1 rounded uppercase tracking-widest border border-red-500/20">
                    MACRO CORRELATION
                </span>
            </div>
            
            <Show when={!loading()} fallback={<div class="flex-1 flex items-center justify-center text-[10px] animate-pulse text-text_secondary">FUSING CONFLICT DATA...</div>}>
                <Show when={!error()} fallback={<div class="flex-1 flex items-center justify-center text-[10px] text-red-500">{error()}</div>}>
                    <div class="flex-1 w-full min-h-[300px]" ref={chartRef}></div>
                </Show>
            </Show>
        </div>
    );
}
