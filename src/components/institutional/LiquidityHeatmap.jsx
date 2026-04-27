import { createSignal, onMount, onCleanup, createEffect, Show } from 'solid-js';
import * as echarts from 'echarts';

export default function LiquidityHeatmap(props) {
    const [data, setData] = createSignal(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);
    let chartRef;
    let chart;

    const fetchLiquidity = async () => {
        if (!props.symbol) return;
        setLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_CRYPTO_API}/api/crypto/derivatives/${props.symbol}`);
            const json = await response.json();
            if (json.status === 'success') {
                setData(json.data);
                renderChart(json.data);
            } else {
                setError(json.message || 'Failed to fetch derivatives');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderChart = (derivativesData) => {
        if (!chartRef || !derivativesData?.liquidation_zones?.current_price) return;
        if (!chart) chart = echarts.init(chartRef, 'dark');

        const currentPrice = derivativesData.liquidation_zones.current_price;
        const longLiqs = derivativesData.liquidation_zones.long_liquidations || [];
        const shortLiqs = derivativesData.liquidation_zones.short_liquidations || [];

        // Prepare bar data
        // For horizontal chart, Y axis is price, X axis is leverage intensity (proxy for size)
        const prices = [];
        const values = [];
        const colors = [];

        // Add Shorts (above current price) -> ascending
        [...shortLiqs].reverse().forEach(liq => {
            prices.push(`$${liq.price.toLocaleString()}`);
            values.push(liq.leverage * 2); // Visual multiplier
            colors.push('#ef4444'); // Red for Short Liq (Buy pressure if hit)
        });

        // Current Price
        prices.push(`CURRENT: $${currentPrice.toLocaleString()}`);
        values.push(0);
        colors.push('#38bdf8');

        // Add Longs (below current price) -> descending
        longLiqs.forEach(liq => {
            prices.push(`$${liq.price.toLocaleString()}`);
            values.push(liq.leverage * 2);
            colors.push('#10b981'); // Green for Long Liq (Sell pressure if hit)
        });

        const option = {
            backgroundColor: 'transparent',
            title: {
                text: 'Estimated Liquidation Map',
                textStyle: { color: '#64748b', fontSize: 10, fontWeight: 'bold' },
                left: 'center'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    const p = params[0];
                    if (p.name.includes('CURRENT')) return `Current Price: ${currentPrice}`;
                    const type = p.color === '#ef4444' ? 'Short Liquidation' : 'Long Liquidation';
                    return `${type}<br/>Price: ${p.name}<br/>Leverage Cluster: ${p.value / 2}x`;
                }
            },
            grid: { 
                top: 35, 
                bottom: 10, 
                left: 10, 
                right: 30,
                containLabel: true 
            },
            xAxis: { 
                type: 'value', 
                show: false,
                splitLine: { show: false }
            },
            yAxis: { 
                type: 'category', 
                data: prices,
                axisLabel: { 
                    color: '#94a3b8', 
                    fontSize: 9, 
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    margin: 12
                },
                axisTick: { show: false },
                axisLine: { show: false },
                inverse: true // Price ascending from top to bottom
            },
            series: [
                {
                    type: 'bar',
                    data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i] } })),
                    barWidth: '45%',
                    showBackground: true,
                    backgroundStyle: { color: 'rgba(255,255,255,0.01)' },
                    itemStyle: {
                        borderRadius: [0, 2, 2, 0]
                    }
                }
            ]
        };

        chart.setOption(option);
    };

    onMount(() => {
        fetchLiquidity();
        const handleResize = () => chart && chart.resize();
        window.addEventListener('resize', handleResize);
        onCleanup(() => {
            window.removeEventListener('resize', handleResize);
            if (chart) chart.dispose();
        });
    });

    createEffect(() => {
        if (props.symbol) fetchLiquidity();
    });

    return (
        <div class="bg-bg_sidebar/40 border border-border_main rounded-xl p-4 flex flex-col h-full">
            <div class="flex items-center justify-between mb-2 border-b border-white/5 pb-2">
                <h3 class="text-[12px] font-black tracking-widest text-text_accent uppercase">Liquidity Heatmap</h3>
                <span class="text-[9px] text-text_secondary bg-black/50 px-2 py-1 rounded border border-white/10 uppercase">
                    {data()?.long_short_ratio?.bias || 'ANALYZING...'}
                </span>
            </div>

            <Show when={!loading()} fallback={<div class="flex-1 flex items-center justify-center text-[10px] animate-pulse text-text_secondary">FETCHING ORDER BOOK & OI...</div>}>
                <Show when={!error()} fallback={<div class="flex-1 flex items-center justify-center text-[10px] text-red-500">{error()}</div>}>
                    
                    <div class="flex gap-2 mb-2 text-[10px] font-mono">
                        <div class="flex-1 bg-black/30 p-2 rounded flex justify-between items-center border border-white/5">
                            <span class="text-text_secondary">FUNDING</span>
                            <span class={data()?.funding_rates?.current_rate > 0 ? 'text-green-400' : 'text-red-400'}>
                                {data()?.funding_rates?.current_rate?.toFixed(4)}%
                            </span>
                        </div>
                        <div class="flex-1 bg-black/30 p-2 rounded flex justify-between items-center border border-white/5">
                            <span class="text-text_secondary">LS RATIO</span>
                            <span class="text-white">{data()?.long_short_ratio?.current?.ratio?.toFixed(2)}</span>
                        </div>
                    </div>

                    <div class="flex-1 w-full" ref={chartRef}></div>
                    
                </Show>
            </Show>
        </div>
    );
}
