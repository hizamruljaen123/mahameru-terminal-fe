import { createSignal, onMount, onCleanup, createEffect, Show, For } from 'solid-js';
import * as echarts from 'echarts';

export default function VaRDashboard(props) {
    const [varData, setVarData] = createSignal(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);
    let chartRef;
    let chart;

    const fetchVar = async () => {
        setLoading(true);
        try {
            // Default portfolio if not provided
            const symbols = props.symbols || ['^GSPC', 'BTC-USD', 'GC=F'];
            const response = await fetch(`${import.meta.env.VITE_MARKET_API}/api/market/var`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols, window: props.window || '1y' })
            });
            const data = await response.json();
            if (data.status === 'success') {
                setVarData(data);
                renderChart(data.metrics);
            } else {
                setError(data.detail || 'Failed to fetch VaR');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderChart = (metrics) => {
        if (!chartRef) return;
        if (!chart) chart = echarts.init(chartRef, 'dark');

        const option = {
            backgroundColor: 'transparent',
            tooltip: { formatter: '{b} : {c}%' },
            series: [{
                type: 'gauge',
                startAngle: 180,
                endAngle: 0,
                min: 0,
                max: 20, // Max 20% VaR for visual
                splitNumber: 4,
                axisLine: {
                    lineStyle: {
                        width: 10,
                        color: [
                            [0.3, '#10b981'],
                            [0.7, '#f59e0b'],
                            [1, '#ef4444']
                        ]
                    }
                },
                pointer: {
                    icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
                    length: '60%',
                    width: 5,
                    offsetCenter: [0, '-10%'],
                    itemStyle: { color: 'auto' }
                },
                axisTick: { length: 15, lineStyle: { color: 'auto', width: 2 } },
                splitLine: { length: 20, lineStyle: { color: 'auto', width: 3 } },
                axisLabel: { color: '#cbd5e1', distance: -40, fontSize: 10 },
                title: { offsetCenter: [0, '30%'], fontSize: 12, color: '#94a3b8' },
                detail: {
                    fontSize: 18,
                    offsetCenter: [0, '0%'],
                    valueAnimation: true,
                    formatter: function (value) { return '-' + value.toFixed(2) + '%'; },
                    color: 'inherit'
                },
                data: [{ value: Math.abs(metrics.var_95_pct), name: '95% Value at Risk' }]
            }]
        };

        chart.setOption(option);
    };

    onMount(() => {
        fetchVar();
        const handleResize = () => chart && chart.resize();
        window.addEventListener('resize', handleResize);
        onCleanup(() => {
            window.removeEventListener('resize', handleResize);
            if (chart) chart.dispose();
        });
    });

    createEffect(() => {
        if (props.symbols) {
            fetchVar();
        }
    });

    return (
        <div class="bg-bg_sidebar/40 border border-border_main rounded-xl p-4 flex flex-col min-h-[300px]">
            <div class="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                <h3 class="text-[12px] font-black tracking-widest text-text_accent uppercase">Portfolio Risk Engine (VaR)</h3>
                <span class="text-[9px] text-text_secondary bg-black/50 px-2 py-1 rounded">Confidence: 95%</span>
            </div>
            
            <Show when={!loading()} fallback={<div class="flex-1 flex items-center justify-center text-[10px] animate-pulse text-text_secondary">CALCULATING RISK MATRICES...</div>}>
                <Show when={!error()} fallback={<div class="flex-1 flex items-center justify-center text-[10px] text-red-500">{error()}</div>}>
                    <div class="flex-1 flex flex-col md:flex-row gap-4">
                        <div class="flex-1 flex flex-col justify-center items-center">
                            <div ref={chartRef} class="w-full h-[200px]"></div>
                        </div>
                        <div class="flex-1 flex flex-col justify-center space-y-4">
                            <div class="bg-black/30 p-3 rounded border border-white/5">
                                <div class="text-[9px] text-text_secondary uppercase tracking-widest mb-1">Expected Shortfall (CVaR)</div>
                                <div class="text-[16px] font-black text-red-400 font-mono">
                                    {varData()?.metrics.expected_shortfall_95_pct?.toFixed(2)}%
                                </div>
                            </div>
                            <div class="bg-black/30 p-3 rounded border border-white/5">
                                <div class="text-[9px] text-text_secondary uppercase tracking-widest mb-1">Max Drawdown</div>
                                <div class="text-[16px] font-black text-orange-400 font-mono">
                                    {varData()?.metrics.max_drawdown_pct?.toFixed(2)}%
                                </div>
                            </div>
                            <div class="bg-black/30 p-3 rounded border border-white/5">
                                <div class="text-[9px] text-text_secondary uppercase tracking-widest mb-1">Annualized Volatility</div>
                                <div class="text-[16px] font-black text-blue-400 font-mono">
                                    {varData()?.metrics.volatility_annualized_pct?.toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
}
