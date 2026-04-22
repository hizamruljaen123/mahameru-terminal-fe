import * as echarts from "echarts";

class EChartsDeepAnalyzer {
    constructor(containerId = 'chart-container') {
        this.containerId = containerId;
        this.charts = [];
        this.darkTheme = {
            backgroundColor: '#0d1117',
            textStyle: { color: '#c9d1d9' },
            title: { textStyle: { color: '#f0f6fc', fontSize: 14, fontWeight: 'bold' } },
            legend: { textStyle: { color: '#8b949e', fontSize: 11 }, pageTextStyle: { color: '#8b949e' } },
            tooltip: {
                backgroundColor: 'rgba(22, 27, 34, 0.95)',
                borderColor: '#21262d',
                textStyle: { color: '#c9d1d9', fontSize: 12 },
                axisPointer: { lineStyle: { color: '#58a6ff' } }
            },
            xAxis: {
                axisLine: { lineStyle: { color: '#21262d' } },
                axisTick: { lineStyle: { color: '#21262d' } },
                axisLabel: { color: '#8b949e', fontSize: 10, rotate: 30 },
                splitLine: { lineStyle: { color: '#21262d', type: 'dashed' } }
            },
            yAxis: {
                axisLine: { lineStyle: { color: '#21262d' } },
                axisTick: { lineStyle: { color: '#21262d' } },
                axisLabel: { color: '#8b949e', fontSize: 10 },
                splitLine: { lineStyle: { color: '#21262d', type: 'dashed' } }
            },
            grid: { left: 60, right: 40, top: 60, bottom: 40, containLabel: true },
            color: [
                '#58a6ff', // Blue (Accent)
                '#3fb950', // Green (Success)
                '#f85149', // Red (Error)
                '#d29922', // Gold (Warning)
                '#bc8cff', // Purple
                '#39d2c0', // Cyan
                '#f778ba', // Pink
                '#e3b341', // Orange
                '#8b949e', // Gray
                '#1f6feb'  // Dark Blue
            ]
        };
    }

    init() {
        if (typeof echarts === 'undefined') {
            console.error('ECharts tidak ditemukan! Include echarts.min.js terlebih dahulu.');
            return false;
        }
        // Register dark theme
        echarts.registerTheme('deep_analysis', this.darkTheme);
        return true;
    }

    clear() {
        this.charts.forEach(c => c.dispose());
        this.charts = [];
        const el = document.getElementById(this.containerId);
        if (el) el.innerHTML = '';
    }

    /**
     * RENDER SEMUA CHART DALAM GRID ATAU TABS
     * @param {Object} apiResponse - JSON dari /api/charts/all
     * @param {String} layout - 'grid' atau 'tabs'
     * @param {String} filterCategory - (Optional) filter by category
     */
    renderAll(apiResponse, layout = 'grid', filterCategory = null) {
        if (!this.init()) return;
        this.clear();

        const el = document.getElementById(this.containerId);
        if (!el) return;

        let charts = apiResponse.charts || [];
        
        // Filter by category if requested
        if (filterCategory) {
            charts = charts.filter(c => c.category === filterCategory);
        }

        if (layout === 'grid') {
            el.style.display = 'grid';
            el.style.gridTemplateColumns = 'repeat(auto-fit, minmax(600px, 1fr))';
            el.style.gap = '16px';

            charts.forEach((chartData, index) => {
                const div = document.createElement('div');
                div.id = `chart-${index}`;
                div.style.minHeight = '350px';
                div.style.backgroundColor = '#161b22';
                div.style.borderRadius = '8px';
                div.style.border = '1px solid #21262d';
                div.style.overflow = 'hidden';
                el.appendChild(div);
                this._renderSingle(div.id, chartData);
            });
        } else if (layout === 'tabs') {
            el.style.display = 'block';
            // Buat tab buttons
            const tabBar = document.createElement('div');
            tabBar.style.display = 'flex';
            tabBar.style.gap = '8px';
            tabBar.style.marginBottom = '12px';
            tabBar.style.flexWrap = 'wrap';

            charts.forEach((chartData, index) => {
                const btn = document.createElement('button');
                btn.textContent = chartData.title || `Chart ${index}`;
                btn.className = 'echart-tab-btn';
                btn.style.cssText = 'padding:6px 14px; border:1px solid #30363d; background:#0d1117; color:#c9d1d9; border-radius:6px; cursor:pointer; font-size:12px;';
                btn.onclick = () => {
                    document.querySelectorAll('.echart-tab-btn').forEach(b => b.style.borderColor = '#30363d');
                    btn.style.borderColor = '#58a6ff';
                    contentDiv.style.display = 'block';
                    this._renderSingle(contentDiv.id, chartData);
                };
                tabBar.appendChild(btn);
            });
            el.appendChild(tabBar);

            const contentDiv = document.createElement('div');
            contentDiv.id = 'tab-content';
            contentDiv.style.minHeight = '500px';
            contentDiv.style.backgroundColor = '#161b22';
            contentDiv.style.borderRadius = '8px';
            contentDiv.style.border = '1px solid #21262d';
            el.appendChild(contentDiv);

            if (charts.length > 0) {
                this._renderSingle(contentDiv.id, charts[0]);
                tabBar.children[0].style.borderColor = '#58a6ff';
            }
        }
    }

    /**
     * RENDER GAUGES DASHBOARD
     * @param {Object} apiResponse - JSON dari /api/charts/summary-gauges
     */
    renderGauges(apiResponse) {
        if (!this.init()) return;
        this.clear();

        const el = document.getElementById(this.containerId);
        el.style.display = 'grid';
        el.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
        el.style.gap = '16px';

        // Header info
        const header = document.createElement('div');
        header.style.gridColumn = '1 / -1';
        header.style.marginBottom = '16px';
        header.style.padding = '16px';
        header.style.backgroundColor = '#161b22';
        header.style.borderRadius = '8px';
        header.style.border = '1px solid #21262d';
        header.innerHTML = `
            <div style="font-size:20px; color:#f0f6fc; font-weight:bold;">${apiResponse.entity_code} — Summary</div>
            <div style="font-size:14px; color:#8b949e;">Close: <span style="color:#f0f6fc; font-weight:bold;">${apiResponse.close?.toFixed(2) || 'N/A'}</span></div>
        `;
        el.appendChild(header);

        (apiResponse.gauges || []).forEach((gauge, index) => {
            const div = document.createElement('div');
            div.id = `gauge-${index}`;
            div.style.minHeight = '220px';
            div.style.backgroundColor = '#161b22';
            div.style.borderRadius = '8px';
            div.style.border = '1px solid #21262d';
            el.appendChild(div);
            this._renderSingle(div.id, gauge);
        });
    }

    /**
     * INTERNAL: Render 1 chart ke container
     */
    _renderSingle(containerId, chartData) {
        if (!this.init()) return; 

        const el = document.getElementById(containerId);
        if (!el) return;

        try {
            if (chartData.chartType === 'error') {
                el.style.display = 'none';
                return;
            }

            // Strict data check before initializing ECharts
            let hasData = false;
            if (chartData.series && Array.isArray(chartData.series)) {
                hasData = chartData.series.some(s => s.data && Array.isArray(s.data) && s.data.some(v => v !== null && v !== undefined));
            } else if (chartData.data && Array.isArray(chartData.data)) {
                hasData = chartData.data.some(v => v !== null && v !== undefined);
            } else if (['candlestick', 'order_blocks', 'fair_value_gaps', 'smc_concepts', 'heatmap', 'gauge'].includes(chartData.chartType)) {
                hasData = true;
            }

            if (!hasData) {
                el.style.display = 'none';
                return;
            }

            const chart = echarts.init(el, 'deep_analysis');
            this.charts.push(chart);

            const option = this._buildOption(chartData);
            chart.setOption(option);

            // Auto resize
            const resizeObserver = new ResizeObserver(() => {
                if (!chart.isDisposed()) {
                    chart.resize();
                }
            });
            resizeObserver.observe(el);
        } catch (err) {
            console.warn(`Chart rendering failed for ${containerId}:`, err);
            el.style.display = 'none';
        }
    }

    /**
     * INTERNAL: Bangun ECharts option dari data JSON
     */
    _buildOption(data) {
        const type = data.chartType;

        if (type === 'line') return this._optLine(data);
        if (type === 'bar') return this._optBar(data);
        if (type === 'scatter') return this._optScatter(data);
        if (type === 'candlestick') return this._optCandlestick(data);
        if (type === 'heatmap') return this._optHeatmap(data);
        if (type === 'gauge') return this._optGauge(data);
        if (type === 'mixed_bar_line') return this._optMixed(data);
        if (type === 'mixed_bar_line_v2') return this._optMixedV2(data);
        if (type === 'line_with_markers') return this._optLineMarkers(data);
        if (type === 'raw_array') return this._optRawArray(data);
        if (type === 'raw_multi_array') return this._optRawMulti(data);
        if (type === 'order_blocks') return this._optOrderBlocks(data);
        if (type === 'fair_value_gaps') return this._optFairValueGaps(data);
        if (type === 'liquidity_sweeps') return this._optLiquiditySweeps(data);
        if (type === 'smc_concepts') return this._optSMCConcepts(data);
        if (type === 'signal_markers') return this._optSignalMarkers(data);
        if (type === 'regime_signal') return this._optRegimeSignal(data);
        if (type === 'horizontal_bar') return this._optHorizontalBar(data);
        if (type === 'topology') return this._optTopology(data);
        if (type === 'risk') return this._optRisk(data);
        if (type === 'anomaly') return this._optAnomaly(data);
        if (type === 'mixed') return this._optMixed(data);

        return { title: { text: data.title || 'Unknown' } };
    }

    _optRegimeSignal(data) {
        const option = this._optCandlestick(data);
        const markers = data.markers;
        if (!markers || !markers.length) return option;

        if (option.series[0]) {
            option.series[0].markPoint = {
                data: markers.map(m => ({
                    xAxis: m.xAxis,
                    yAxis: m.yAxis,
                    symbol: m.symbol || 'circle',
                    symbolSize: m.symbol === 'pin' ? 20 : 10,
                    itemStyle: { 
                        color: m.color, 
                        opacity: 0.9,
                        shadowBlur: 10,
                        shadowColor: m.color
                    },
                    label: { 
                        show: true, 
                        position: 'top', 
                        fontSize: 8, 
                        color: '#fff',
                        fontWeight: 'bold',
                        formatter: m.label 
                    }
                }))
            };
        }

        return option;
    }

    _optSignalMarkers(data) {
        const option = this._optCandlestick(data);
        const markers = data.markers;
        if (!markers || !markers.length) return option;

        if (option.series[0]) {
            option.series[0].markPoint = {
                data: markers.map(m => ({
                    xAxis: m.xAxis,
                    yAxis: m.yAxis,
                    symbol: m.symbol,
                    symbolRotate: m.symbolRotate || 0,
                    symbolSize: 15,
                    itemStyle: { 
                        color: m.color,
                        shadowBlur: 5,
                        shadowColor: m.color
                    },
                    label: { 
                        show: true, 
                        position: m.symbolRotate === 180 ? 'bottom' : 'top', 
                        fontSize: 8, 
                        color: m.color,
                        fontWeight: 'bold',
                        formatter: m.label 
                    }
                }))
            };
        }

        return option;
    }

    _optHorizontalBar(data) {
        const option = this._baseOpt(data.title);
        option.xAxis = { type: 'value', axisLabel: { fontSize: 10 } };
        option.yAxis = { 
            type: 'category', 
            data: data.yAxis,
            axisLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)' }
        };
        option.grid = { left: '150px', right: '40px', bottom: '40px', top: '60px' };
        option.series = data.series.map(s => ({
            ...s,
            label: { 
                show: true, 
                position: 'right', 
                fontSize: 10, 
                color: '#fff', 
                formatter: (p) => (typeof p.value === 'number' ? p.value.toFixed(17).replace(/\.?0+$/, '') : p.value)
            },
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: '#1f6feb' },
                    { offset: 1, color: '#58a6ff' }
                ]),
                borderRadius: [0, 4, 4, 0]
            },
            // Dynamic color mapping for scores
            data: s.data.map(val => ({
                value: val,
                itemStyle: {
                    color: val >= 0.5 ? '#3fb950' : (val <= -0.5 ? '#f85149' : '#58a6ff')
                }
            }))
        }));
        return option;
    }

    _optSMCConcepts(data) {
        const option = this._optCandlestick(data);
        const markers = data.markers;
        if (!markers || !markers.length) return option;

        if (option.series[0]) {
            option.series[0].markPoint = {
                symbol: 'rect',
                symbolSize: [40, 20],
                label: {
                    show: true,
                    fontSize: 8,
                    fontWeight: 'bold',
                    color: '#fff',
                    formatter: (p) => p.data.label
                },
                data: markers.map(m => ({
                    xAxis: m.xAxis,
                    yAxis: m.yAxis,
                    label: m.label,
                    itemStyle: { 
                        color: m.color, 
                        opacity: 0.8,
                        shadowBlur: 8,
                        shadowColor: 'rgba(0,0,0,0.5)',
                        borderColor: '#fff',
                        borderWidth: 0.5
                    }
                }))
            };
        }

        return option;
    }

    _optLiquiditySweeps(data) {
        const option = this._optCandlestick(data);
        const markers = data.markers;
        if (!markers || !markers.length) return option;

        if (option.series[0]) {
            option.series[0].markPoint = {
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { color: '#bc8cff', opacity: 0.8 },
                label: { show: false },
                data: markers.map(m => ({
                    xAxis: m.xAxis,
                    yAxis: m.yAxis,
                    value: 'SWEEP'
                }))
            };
        }

        return option;
    }

    _optFairValueGaps(data) {
        const option = this._optCandlestick(data);
        const zones = data.fvgZones;
        if (!zones) return option;

        const markAreas = [];
        const top = zones.top;
        const bottom = zones.bottom;
        const types = zones.type;

        for (let i = 0; i < top.length; i++) {
            if (top[i] !== null && bottom[i] !== null) {
                const color = (types[i] === 1 || types[i] > 0) ? '#3fb950' : '#f85149';
                const label = (types[i] === 1 || types[i] > 0) ? 'FVG UP' : 'FVG DOWN';
                
                markAreas.push([
                    { name: label, xAxis: data.xAxis[Math.max(0, i - 1)], yAxis: bottom[i], itemStyle: { color, opacity: 0.25 } },
                    { xAxis: data.xAxis[Math.min(data.xAxis.length - 1, i + 1)], yAxis: top[i] }
                ]);
            }
        }

        if (option.series[0]) {
            option.series[0].markArea = {
                silent: true,
                data: markAreas,
                label: { show: false }
            };
        }

        return option;
    }

    _optOrderBlocks(data) {
        const option = this._optCandlestick(data);
        const zones = data.obZones;
        if (!zones) return option;

        const markAreas = [];
        
        const extractAreas = (highArr, lowArr, color, labelPrefix) => {
            let currentStart = -1;
            let currentHigh = 0;
            let currentLow = 0;

            for (let i = 0; i < highArr.length; i++) {
                const h = highArr[i];
                const l = lowArr[i];

                if (h !== null && currentStart === -1) {
                    currentStart = i;
                    currentHigh = h;
                    currentLow = l;
                } else if ((h === null || h !== currentHigh || l !== currentLow) && currentStart !== -1) {
                    // End of zone
                    markAreas.push([
                        { name: labelPrefix, xAxis: data.xAxis[currentStart], yAxis: currentLow, itemStyle: { color, opacity: 0.15 } },
                        { xAxis: data.xAxis[i - 1], yAxis: currentHigh }
                    ]);
                    currentStart = (h !== null) ? i : -1;
                    currentHigh = h;
                    currentLow = l;
                }
            }
            if (currentStart !== -1) {
                markAreas.push([
                    { name: labelPrefix, xAxis: data.xAxis[currentStart], yAxis: currentLow, itemStyle: { color, opacity: 0.15 } },
                    { xAxis: data.xAxis[highArr.length - 1], yAxis: currentHigh }
                ]);
            }
        };

        if (zones.bearish) extractAreas(zones.bearish.high, zones.bearish.low, '#f85149', 'Bearish OB');
        if (zones.bullish) extractAreas(zones.bullish.high, zones.bullish.low, '#3fb950', 'Bullish OB');

        if (option.series[0]) {
            option.series[0].markArea = {
                silent: true,
                data: markAreas,
                label: { show: false }
            };
        }

        return option;
    }

    _baseOpt(title) {
        return {
            backgroundColor: 'transparent',
            title: { text: title, left: 'center', textStyle: { fontSize: 13, color: '#f0f6fc', fontWeight: 'bold' } },
            tooltip: { 
                trigger: 'axis', 
                confine: true,
                backgroundColor: 'rgba(13, 17, 23, 0.9)',
                borderColor: '#30363d',
                padding: [8, 12],
                textStyle: { fontSize: 10, color: '#c9d1d9' },
                valueFormatter: (value) => (typeof value === 'number' ? value.toFixed(4) : value),
                formatter: (params) => {
                    if (!params || params.length === 0) return '';
                    let res = `<div style="font-weight:bold;margin-bottom:4px;border-bottom:1px solid #30363d;padding-bottom:2px;">${params[0].axisValue}</div>`;
                    res += '<div style="max-height:200px;overflow-y:auto;padding-right:8px;">';
                    params.forEach(p => {
                        const val = typeof p.value === 'number' ? p.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4}) : p.value;
                        res += `<div style="display:flex;justify-content:between;gap:12px;margin-bottom:2px;">
                                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${p.color};margin-top:3px;"></span>
                                    <span style="flex:1;opacity:0.7;">${p.seriesName}</span>
                                    <span style="font-family:monospace;font-weight:bold;">${val}</span>
                                </div>`;
                    });
                    res += '</div>';
                    return res;
                }
            },
            legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 9 }, itemWidth: 10, itemHeight: 10 },
            grid: { left: 60, right: 30, top: 45, bottom: 40, containLabel: true },
            toolbox: { feature: { dataZoom: { yAxisIndex: 'none' }, restore: {}, saveAsImage: {} }, right: 10, top: 5 }
        };
    }

    _optLine(data) {
        return {
            ...this._baseOpt(data.title),
            xAxis: { type: 'category', data: data.xAxis, boundaryGap: false },
            yAxis: { type: 'value', scale: true, ...(data.options?.yAxis || {}) },
            series: data.series.map((s, i) => ({
                name: s.name, type: 'line', data: s.data, showSymbol: false,
                smooth: true,
                connectNulls: false,
                lineStyle: { 
                    width: 2, 
                    color: this.darkTheme.color[i % this.darkTheme.color.length],
                    shadowBlur: 10,
                    shadowColor: this.darkTheme.color[i % this.darkTheme.color.length]
                },
                areaStyle: { 
                    opacity: 0.05,
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: this.darkTheme.color[i % this.darkTheme.color.length] },
                        { offset: 1, color: 'transparent' }
                    ])
                },
                ...(s.yAxisIndex !== undefined ? { yAxisIndex: s.yAxisIndex } : {}),
                ...(s.lineStyle ? { lineStyle: s.lineStyle } : {})
            })),
            ...(data.options?.markLine ? { markLine: data.options.markLine } : {})
        };
    }

    _optBar(data) {
        return {
            ...this._baseOpt(data.title),
            xAxis: { type: 'category', data: data.xAxis, boundaryGap: false },
            yAxis: { type: 'value', ...(data.options?.yAxis || {}) },
            series: data.series.map((s, i) => ({
                name: s.name, type: 'bar', data: s.data,
                itemStyle: { color: this.darkTheme.color[i % this.darkTheme.color.length], borderRadius: [2, 2, 0, 0] },
                ...(s.itemStyle ? { itemStyle: s.itemStyle } : {})
            }))
        };
    }

    _optScatter(data) {
        return this._optLine(data); // Formatnya sama
    }

    _optCandlestick(data) {
        return {
            ...this._baseOpt(data.title),
            xAxis: { type: 'category', data: data.xAxis },
            yAxis: { type: 'value', scale: true },
            legend: { data: data.series.map(s => s.name) },
            series: data.series.map((s, i) => {
                if (s.type === 'candlestick') {
                    return {
                        ...s, type: 'candlestick',
                        itemStyle: { color: '#3fb950', color0: '#f85149', borderColor: '#238636', borderColor0: '#da3633' }
                    };
                }
                return { ...s, type: 'line', symbol: 'none', lineStyle: { width: 1.5, color: this.darkTheme.color[(i + 2) % this.darkTheme.color.length] } };
            }),
            dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', start: 0, end: 100, bottom: 5 }]
        };
    }

    _optHeatmap(data) {
        return {
            ...this._baseOpt(data.title),
            xAxis: { type: 'category', data: data.xAxis, splitArea: { show: false } },
            yAxis: { type: 'category', data: data.yAxis, splitArea: { show: false } },
            visualMap: { min: 0, calculable: true, orient: 'horizontal', left: 'center', bottom: 5, inRange: ['#161b22', '#58a6ff'] },
            series: data.series
        };
    }

    _optGauge(data) {
        const gaugeData = data.series?.[0]?.data?.[0] || { value: 0 };
        return {
            backgroundColor: 'transparent',
            title: { text: data.title, left: 'center', bottom: '5%', textStyle: { fontSize: 12, color: '#8b949e' } },
            series: [{
                type: 'gauge', startAngle: 210, endAngle: -30, min: data.options?.gauge?.min ?? 0, max: data.options?.gauge?.max ?? 100,
                progress: { show: true, width: 12, itemStyle: { color: '#58a6ff' } },
                axisLine: data.options?.gauge?.axisLine || { lineStyle: { width: 12, color: '#30363d' } },
                axisTick: { distance: -12, length: 4, lineStyle: { color: '#30363d' } },
                splitLine: { distance: -12, length: 12, lineStyle: { color: '#30363d' } },
                axisLabel: { distance: 20, color: '#8b949e', fontSize: 10 },
                detail: { 
                    valueAnimation: true, 
                    formatter: (value) => (typeof value === 'number' ? value.toFixed(17).replace(/\.?0+$/, '') : value), 
                    fontSize: 24, 
                    color: '#f0f6fc', 
                    offsetCenter: [0, '70%'] 
                },
                data: [{ value: gaugeData.value, name: data.title }]
            }]
        };
    }

    _optMixed(data) {
        // Bar + Line (2 yAxis)
        const yAxes = data.options?.yAxis ? (Array.isArray(data.options.yAxis) ? data.options.yAxis : [data.options.yAxis, {}]) : [{}, {}];
        return {
            ...this._baseOpt(data.title),
            xAxis: { type: 'category', data: data.xAxis, boundaryGap: false },
            yAxis: yAxes.map((y, i) => ({ type: 'value', position: i === 0 ? 'left' : 'right', splitLine: { show: i === 0 }, ...(y || {}) })),
            series: data.series.map((s, i) => ({
                ...s, type: s.type || 'line',
                ...(s.yAxisIndex !== undefined ? { yAxisIndex: s.yAxisIndex } : (s.type === 'bar' ? { yAxisIndex: 0 } : { yAxisIndex: 1 })),
                ...(s.type === 'bar' ? { barMaxWidth: 4 } : {})
            })),
            ...(data.options?.markLine ? { markLine: data.options.markLine } : {})
        };
    }

    _optMixedV2(data) {
        return this._optMixed(data);
    }

    _optTopology(data) {
        // Topology specific dual-axis chart with high-contrast neon colors
        const option = this._optMixed(data);
        
        // Series 0: NN Distance (Complexity/Novelty) -> Cyan Glow
        if (option.series[0]) {
            option.series[0].lineStyle = { 
                width: 3, 
                color: '#39d2c0', 
                shadowBlur: 15, 
                shadowColor: '#39d2c0' 
            };
            option.series[0].areaStyle = {
                opacity: 0.15,
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#39d2c0' },
                    { offset: 1, color: 'transparent' }
                ])
            };
        }
        
        // Series 1: Recurrence Rate (Periodic Structure) -> Pink Glow
        if (option.series[1]) {
            option.series[1].lineStyle = { 
                width: 3, 
                color: '#f778ba', 
                shadowBlur: 15, 
                shadowColor: '#f778ba' 
            };
            option.series[1].areaStyle = {
                opacity: 0.1,
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#f778ba' },
                    { offset: 1, color: 'transparent' }
                ])
            };
        }

        // Enhance grid and axes for topology
        option.grid.top = 80;
        option.legend.top = 35;
        
        return option;
    }

    _optRisk(data) {
        // Advanced Risk visualization: High-contrast Alert palette (Blood reds & Oranges)
        const option = this._optLine(data);
        const alertColors = ['#f85149', '#ff7b72', '#ff9485', '#ec6547']; // Blood-neon theme
        
        option.series.forEach((s, i) => {
            const color = alertColors[i % alertColors.length];
            s.connectNulls = true; // For risk we want continuous lines if possible
            s.lineStyle = { 
                width: 3, 
                color: color, 
                shadowBlur: 12, 
                shadowColor: color 
            };
            s.areaStyle = {
                opacity: 0.1,
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: color },
                    { offset: 1, color: 'transparent' }
                ])
            };
        });
        
        // Add specific risk grid scaling
        option.yAxis.scale = true;
        return option;
    }

    _optAnomaly(data) {
        // Isolation Forest Anomaly Detection Visualization
        const option = this._optLine(data);
        const markers = data.markers || [];
        const stats = data.stats || [];
        
        // Amber line for Caution
        if (option.series[0]) {
            option.series[0].name = "Anom Score";
            option.series[0].lineStyle = { 
                color: '#e3b341', 
                width: 2, 
                shadowBlur: 10, 
                shadowColor: '#e3b341' 
            };
            option.series[0].areaStyle = {
                opacity: 0.1,
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#e3b341' },
                    { offset: 1, color: 'transparent' }
                ])
            };
            
            // Red Pin Markers for Anomalies
            option.series[0].markPoint = {
                symbol: 'pin',
                symbolSize: 25,
                label: { show: false },
                itemStyle: { 
                    color: '#f85149', 
                    shadowBlur: 15, 
                    shadowColor: '#f85149' 
                },
                data: markers.map(m => ({
                    xAxis: m.xAxis,
                    yAxis: m.value
                }))
            };
        }

        // --- MULTIPLE LAYER: Add Statistical Pie Overlay (Top-Right) ---
        if (stats.length > 0) {
            option.series.push({
                name: 'Anomaly Distribution',
                type: 'pie',
                radius: ['15%', '25%'],
                center: ['88%', '25%'],
                avoidLabelOverlap: false,
                label: { show: false },
                emphasis: { label: { show: false } },
                labelLine: { show: false },
                data: stats.map(s => ({
                    name: s.name,
                    value: s.value,
                    itemStyle: { 
                        color: s.name === 'Anomaly' ? '#f85149' : '#39d2c0',
                        shadowBlur: 5,
                        shadowColor: s.name === 'Anomaly' ? '#f85149' : '#39d2c0'
                    }
                }))
            });

            // Add Percentage Text Badge
            option.graphic = [{
                type: 'text',
                left: '84%',
                top: '35%',
                style: {
                    text: `${data.anomaly_percentage?.toFixed(1)}% ANOMALY`,
                    fill: '#f85149',
                    fontSize: 10,
                    fontWeight: 'bold',
                    fontFamily: 'monospace'
                }
            }];
        }
        
        return option;
    }

    _optLineMarkers(data) {
        return {
            ...this._baseOpt(data.title),
            xAxis: { type: 'category', data: data.xAxis },
            yAxis: { type: 'value' },
            series: data.series,
            // Markers akan dihandle manual jika perlu, atau gunakan markPoint
            ...(data.options || {})
        };
    }

    _optRawArray(data) {
        // Data mentah tanpa tanggal — tampilkan sebagai line chart index-based
        const cleanData = (data.data || []).map(v => v === null ? '-' : v);
        return {
            ...this._baseOpt(data.title),
            xAxis: { type: 'category', data: cleanData.map((_, i) => `${i}`), show: false },
            yAxis: { type: 'value' },
            series: [{ name: data.title, type: 'line', data: cleanData, showSymbol: false, lineStyle: { width: 1.5 } }]
        };
    }

    _optRawMulti(data) {
        // Multi-array untuk complexity metrics (satu chart, banyak line)
        const series = [];
        let maxLen = 0;
        let xAxisData = data.xAxis || [];

        if (data.series) {
            const entries = Object.entries(data.series);
            entries.forEach(([name, arr], i) => {
                const clean = (arr || []).map(v => (v === null || v === undefined) ? '-' : v);
                maxLen = Math.max(maxLen, clean.length);
                series.push({ 
                    name, 
                    type: 'line', 
                    data: clean, 
                    showSymbol: false, 
                    smooth: true,
                    lineStyle: { 
                        width: 2, 
                        color: this.darkTheme.color[i % this.darkTheme.color.length],
                        shadowBlur: 8,
                        shadowColor: this.darkTheme.color[i % this.darkTheme.color.length]
                    } 
                });
            });
        }

        if (xAxisData.length === 0) {
            xAxisData = Array.from({ length: maxLen }, (_, i) => `${i}`);
        }

        return {
            ...this._baseOpt(data.title),
            legend: { data: series.map(s => s.name), bottom: 0 },
            xAxis: { type: 'category', data: xAxisData, boundaryGap: false },
            yAxis: { type: 'value', scale: true },
            series: series
        };
    }
}

// ═══════════════════════════════════════════════════════════════════
// HELPER: Fetch & Render Wrapper
// ═══════════════════════════════════════════════════════════════════

class DeepAnalysisAPI {
    constructor(baseUrl = `${import.meta.env.VITE_ANALYZER_API}/api`) {
        this.baseUrl = baseUrl;
        this.sessionId = null;
    }

    async init(entityCode, startDate = null, endDate = null, ohlcv = null, period = '1y') {
        const body = { entity_code: entityCode, period };
        if (startDate) body.start_date = startDate;
        if (endDate) body.end_date = endDate;
        if (ohlcv) body.ohlcv = ohlcv;

        const res = await fetch(`${this.baseUrl}/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.status === 'success') {
            this.sessionId = data.session_id;
        }
        return data;
    }

    async runFunction(funcId) {
        if (!this.sessionId) throw new Error('Sesi belum diinisialisasi. Panggil init() dulu.');
        const res = await fetch(`${this.baseUrl}/run/${funcId}?session_id=${this.sessionId}`);
        return await res.json();
    }

    async getSingleChart(funcId) {
        if (!this.sessionId) throw new Error('Sesi belum diinisialisasi.');
        const res = await fetch(`${this.baseUrl}/charts/single/${funcId}?session_id=${this.sessionId}`);
        return await res.json();
    }

    async getExecutiveSummary() {
        if (!this.sessionId) throw new Error('Sesi belum diinisialisasi.');
        const res = await fetch(`${this.baseUrl}/analysis/executive-summary?session_id=${this.sessionId}`);
        return await res.json();
    }

    async getGauges() {
        if (!this.sessionId) throw new Error('Sesi belum diinisialisasi.');
        const res = await fetch(`${this.baseUrl}/charts/summary-gauges?session_id=${this.sessionId}`);
        return await res.json();
    }

    async getStatus() {
        if (!this.sessionId) throw new Error('Sesi belum diinisialisasi.');
        const res = await fetch(`${this.baseUrl}/status?session_id=${this.sessionId}`);
        return await res.json();
    }
}

// Export untuk penggunaan module (ES6) atau browser global
export { EChartsDeepAnalyzer, DeepAnalysisAPI };