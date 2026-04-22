import { createSignal, onCleanup, createEffect } from 'solid-js';

export const useEntityAnalysisCharts = (symbolAccessor) => {
    let combinedChartRef, drilldownRef, liveChartRef;
    let combinedChart, drilldownChart, liveChart;

    const [loading, setLoading] = createSignal(true);
    const [intradayHistory, setIntradayHistory] = createSignal([]);
    const [fullHistory, setFullHistory] = createSignal([]);
    const [period, setPeriod] = createSignal('1y');

    const [showDrilldown, setShowDrilldown] = createSignal(false);
    const [seasonalityYears, setSeasonalityYears] = createSignal([]);
    const [seasonalityCells, setSeasonalityCells] = createSignal({});

    let pollInterval;
    let liveChartData = null;

    const [theme, setTheme] = createSignal(document.documentElement.getAttribute('data-theme') || 'grey');

    const getThemeColors = (t) => {
        if (t === 'light') {
            return {
                text: '#334155', dim: '#64748b', border: '#cbd5e1',
                card: '#f8fafc', base: '#ffffff', up: '#16a34a', down: '#dc2626',
                accent: '#2563eb'
            };
        }
        if (t === 'dark') {
            return {
                text: '#e2e8f0', dim: '#94a3b8', border: '#1e293b',
                card: '#0f172a', base: '#020617', up: '#22c55e', down: '#ef4444',
                accent: '#3b82f6'
            };
        }
        // grey default
        return {
            text: '#d4d4d8', dim: '#a1a1aa', border: '#3f3f46',
            card: '#27272a', base: '#18181b', up: '#4ade80', down: '#f87171',
            accent: '#818cf8'
        };
    };

    createEffect(async () => {
        const sym = symbolAccessor();
        if (!sym) return;

        setLoading(true);
        await Promise.all([
            fetchFullHistory(sym, period()),
            fetchIntradayData(sym)
        ]);
        setLoading(false);
        setTimeout(() => initCharts(sym), 100);

        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(() => {
            fetchIntradayData(sym, true);
        }, 60000);

        // Theme Observation
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                if (m.attributeName === 'data-theme') {
                    const newT = document.documentElement.getAttribute('data-theme') || 'grey';
                    setTheme(newT);
                    if (combinedChart) initCharts(sym); // Re-init to apply new colors
                    if (liveChartData) updateLiveChart(liveChartData, sym);
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });

        onCleanup(() => {
            observer.disconnect();
        });
    });

    onCleanup(() => {
        if (pollInterval) clearInterval(pollInterval);
        if (combinedChart) combinedChart.dispose();
        if (drilldownChart) drilldownChart.dispose();
        if (liveChart) liveChart.dispose();
        window.removeEventListener('resize', handleResize);
    });

    const handleResize = () => {
        if (combinedChart) combinedChart.resize();
        if (liveChart) liveChart.resize();
        if (drilldownChart) drilldownChart.resize();
    };

    window.addEventListener('resize', handleResize);

    const fetchFullHistory = async (sym, p = '1y') => {
        try {
            const res = await fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/history/${sym}?period=${p}`);
            const data = await res.json();
            setFullHistory(data.history || []);
            processSeasonality(data.history || []);
        } catch (e) {
            console.error(e);
        }
    };

    const handlePeriodChange = async (newPeriod) => {
        const sym = symbolAccessor();
        if (!sym) return;
        setPeriod(newPeriod);
        
        try {
            await fetchFullHistory(sym, newPeriod);
            if (combinedChart) {
                initCharts(sym); 
            }
        } catch (e) {
            console.error('Failed to change period:', e);
        }
    };

    const fetchIntradayData = async (sym, isUpdate = false) => {
        try {
            const [histRes, chartRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/intraday/history/${sym}`).then(r => r.json()),
                fetch(`${import.meta.env.VITE_ENTITY_URL}/api/entity/intraday/chart/${sym}`).then(r => r.json())
            ]);

            if (histRes.data) setIntradayHistory(histRes.data);
            if (chartRes.times && isUpdate && liveChart) {
                updateLiveChart(chartRes, sym);
            } else if (chartRes.times && !isUpdate) {
                liveChartData = chartRes;
            }
        } catch (e) {
            console.error(e);
        }
    };

    const initCharts = (sym) => {
        if (!window.echarts) return;
        const colors = getThemeColors(theme());
        const history = fullHistory();

        if (combinedChartRef && history.length > 0) {
            if (combinedChart) combinedChart.dispose();
            const eTheme = theme() === 'light' ? 'light' : 'dark';
            combinedChart = window.echarts.init(combinedChartRef, eTheme);
            combinedChart.setOption({
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'axis', axisPointer: { type: 'cross' },
                    backgroundColor: colors.card, borderColor: colors.border,
                    textStyle: { color: colors.text }
                },
                legend: { data: ['Candlestick', 'Trend Line'], textStyle: { color: colors.dim } },
                dataZoom: [
                    { type: 'inside', start: 0, end: 100 },
                    { type: 'slider', height: 12, bottom: 5, borderColor: 'transparent', textStyle: { color: colors.dim } }
                ],
                xAxis: { type: 'category', data: history.map(d => d.Date), axisLabel: { color: colors.dim }, axisLine: { lineStyle: { color: colors.border } } },
                yAxis: [
                    { type: 'value', scale: true, splitLine: { lineStyle: { color: colors.border, opacity: 0.3 } }, axisLabel: { color: colors.dim } }
                ],
                series: [
                    {
                        name: 'Candlestick',
                        type: 'candlestick',
                        data: history.map(d => [d.Open, d.Close, d.Low, d.High]),
                        itemStyle: { color: colors.up, color0: colors.down, borderColor: colors.up, borderColor0: colors.down }
                    },
                    {
                        name: 'Trend Line',
                        type: 'line',
                        data: history.map(d => d.Close),
                        smooth: true, symbol: 'none',
                        lineStyle: { color: colors.accent, width: 1, opacity: 0.8 }
                    }
                ]
            });
        }

        if (liveChartRef && liveChartData) {
            if (liveChart) liveChart.dispose();
            const eTheme = theme() === 'light' ? 'light' : 'dark';
            liveChart = window.echarts.init(liveChartRef, eTheme);
            updateLiveChart(liveChartData, sym);
        }
    };

    const updateLiveChart = (data, sym) => {
        if (!liveChart) return;
        const colors = getThemeColors(theme());
        liveChart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', backgroundColor: colors.card, borderColor: colors.border },
            grid: { top: 30, bottom: 20, left: 50, right: 20 },
            xAxis: { type: 'category', data: data.times },
            yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: colors.border, opacity: 0.3 } } },
            series: [{
                name: sym, type: 'line', data: data.prices,
                smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#f59e0b' },
                areaStyle: {
                    color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
                        { offset: 1, color: 'transparent' }
                    ])
                }
            }]
        });
    };

    const getHeatmapColor = (pct) => {
        let normalized = Math.max(-5, Math.min(5, pct));
        let hue = normalized < 0 ? 0 : 120;
        let intensity = Math.abs(normalized) / 5;
        return `hsla(${hue}, 70%, 50%, ${0.1 + intensity * 0.4})`;
    };

    const getTextColor = (pct) => {
        if (Math.abs(pct) < 0.5) return getThemeColors().dim;
        return pct > 0 ? getThemeColors().up : getThemeColors().down;
    };

    const processSeasonality = (data) => {
        const monthlyData = {};
        data.forEach(d => {
            const date = new Date(d.Date);
            const y = date.getFullYear();
            const m = date.getMonth();
            if (!monthlyData[y]) monthlyData[y] = Array(12).fill(null);
            monthlyData[y][m] = d.Close;
        });

        const years = Object.keys(monthlyData).sort((a, b) => b - a);
        const cells = {};
        years.forEach(year => {
            cells[year] = [];
            for (let m = 0; m < 12; m++) {
                const price = monthlyData[year][m];
                let prevPrice = (m > 0) ? monthlyData[year][m - 1] : (monthlyData[year - 1] ? monthlyData[year - 1][11] : null);
                let returnPct = (price && prevPrice) ? ((price - prevPrice) / prevPrice) * 100 : 0;
                cells[year].push({
                    month: m,
                    price,
                    returnPct,
                    formattedReturn: (price && prevPrice) ? (returnPct > 0 ? '+' : '') + returnPct.toFixed(1) + '%' : '-',
                    bgColor: (price && prevPrice) ? getHeatmapColor(returnPct) : 'rgba(255,255,255,0.02)',
                    txtColor: (price && prevPrice) ? getTextColor(returnPct) : '#444'
                });
            }
        });
        setSeasonalityYears(years);
        setSeasonalityCells(cells);
    };

    const handleSeasonalityClick = (year, month) => {
        const monthData = fullHistory().filter(d => {
            const dt = new Date(d.Date);
            return dt.getFullYear() === parseInt(year) && dt.getMonth() === month;
        });

        if (!monthData.length) return;

        setShowDrilldown(true);
        setTimeout(() => {
            if (!drilldownRef) return;
            if (drilldownChart) drilldownChart.dispose();
            drilldownChart = window.echarts.init(drilldownRef, 'dark');
            const colors = getThemeColors();
            drilldownChart.setOption({
                title: { text: `Drilldown: ${year}-${month + 1}`, textStyle: { fontSize: 10, color: colors.dim } },
                backgroundColor: 'transparent',
                tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
                grid: [{ top: '15%', height: '50%' }, { top: '70%', height: '15%' }],
                xAxis: [
                    { type: 'category', data: monthData.map(d => d.Date), show: false },
                    { type: 'category', gridIndex: 1, data: monthData.map(d => d.Date) }
                ],
                yAxis: [
                    { scale: true },
                    { gridIndex: 1, splitNumber: 1, axisLabel: { show: false } }
                ],
                series: [
                    { type: 'candlestick', data: monthData.map(d => [d.Open, d.Close, d.Low, d.High]), itemStyle: { color: colors.up, color0: colors.down, borderColor: colors.up, borderColor0: colors.down } },
                    { type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: monthData.map(d => d.Volume), itemStyle: { color: 'rgba(34, 197, 94, 0.5)' } }
                ]
            });
        }, 100);
    };

    return {
        loading,
        intradayHistory,
        showDrilldown,
        setShowDrilldown,
        seasonalityYears,
        seasonalityCells,
        handleSeasonalityClick,
        period,
        handlePeriodChange,
        setCombinedChartRef: (el) => { combinedChartRef = el; },
        setLiveChartRef: (el) => { liveChartRef = el; },
        setDrilldownRef: (el) => { drilldownRef = el; }
    };
};
