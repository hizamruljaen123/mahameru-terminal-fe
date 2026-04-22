import { createSignal, onMount, onCleanup, For } from 'solid-js';
import * as echarts from 'echarts';

export default function LiveMarketTerminal() {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'TRXUSDT', 'DOTUSDT', 'LINKUSDT'];
    const assets = {};
    const [prices, setPrices] = createSignal({});
    const [trades, setTrades] = createSignal({});
    const [sentiment, setSentiment] = createSignal({});
    const [depths, setDepths] = createSignal({});
    const [cardTabs, setCardTabs] = createSignal(Object.fromEntries(symbols.map(s => [s, 'trades'])));

    // Centralized BE Stream Connection
    let ws;

    const getEChartsOption = (data) => {
        const dates = data.map(d => new Date(d.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        const values = data.map(d => [d.open, d.close, d.low, d.high]);
        const volumes = data.map((d, i) => ({
            value: d.volume,
            itemStyle: { color: d.close >= d.open ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)' }
        }));

        // Calculate simple EMA 20
        const period = 20;
        const k = 2 / (period + 1);
        let emaVal = values[0][1]; 
        const emaData = values.map(v => {
            emaVal = v[1] * k + emaVal * (1 - k);
            return emaVal;
        });

        return {
            backgroundColor: 'transparent',
            animation: false,
            grid: [
                { left: 0, right: 40, top: 10, height: '60%' },
                { left: 0, right: 40, top: '75%', height: '20%' }
            ],
            xAxis: [
                { type: 'category', data: dates, axisLine: { lineStyle: { color: '#2a2a2a' } }, axisTick: { show: false }, axisLabel: { color: '#444', fontSize: 8, interval: Math.floor(dates.length / 4) }, splitLine: { show: false } },
                { type: 'category', gridIndex: 1, data: dates, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { show: false } }
            ],
            dataZoom: [
                { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 }
            ],
            yAxis: [
                { type: 'value', position: 'right', scale: true, axisLine: { show: false }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }, axisLabel: { color: '#555', fontSize: 8 } },
                { type: 'value', gridIndex: 1, show: false }
            ],
            series: [
                {
                    name: 'KLINE',
                    type: 'candlestick',
                    data: values,
                    itemStyle: {
                        color: '#0ecb81', color0: '#f6465d',
                        borderColor: '#0ecb81', borderColor0: '#f6465d'
                    }
                },
                {
                    name: 'EMA20',
                    type: 'line',
                    data: emaData,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 1, color: 'rgba(255, 171, 0, 0.6)' }
                },
                {
                    name: 'VOLUME',
                    type: 'bar',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: volumes
                }
            ]
        };
    };

    const initChart = (el, s) => {
        if (!el) return;
        const chart = echarts.init(el);
        assets[s] = { chart, klines: [], lastPrice: 0 };
        
        const ro = new ResizeObserver(() => chart.resize());
        ro.observe(el);
    };

    onMount(() => {
        const wsUrl = import.meta.env.VITE_CRYPTO_STREAM_WS || 'ws://2.24.223.76:8092/ws/crypto';
        ws = new WebSocket(wsUrl);
        
        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            
            if (msg.type === 'snapshot') {
                Object.entries(msg.data).forEach(([s, data]) => {
                    const asset = assets[s];
                    if (asset) {
                        const unique = (data.klines || []).sort((a,b) => a.time - b.time)
                            .filter((k, i, self) => i === 0 || k.time > self[i-1].time);
                        
                        asset.klines = unique;
                        asset.chart.setOption(getEChartsOption(unique));
                        
                        setTrades(prev => ({ ...prev, [s]: data.trades.reverse().slice(0, 50) }));
                        if (data.depth) setDepths(prev => ({ ...prev, [s]: data.depth }));

                        if (unique.length > 0) {
                            const last = unique[unique.length-1];
                            setPrices(prev => ({ ...prev, [s]: { price: last.close, side: 'neutral' } }));
                            asset.lastPrice = last.close;
                            setSentiment(prev => ({ ...prev, [s]: last.close >= last.open ? 'BULLISH' : 'BEARISH' }));
                        }
                    }
                });
            } else if (msg.type === 'kline') {
                const s = msg.symbol;
                const d = msg.data;
                const asset = assets[s];
                if (asset) {
                    // Update internal store
                    const existingIdx = asset.klines.findIndex(k => k.time === d.time);
                    if (existingIdx !== -1) {
                        asset.klines[existingIdx] = d;
                    } else {
                        asset.klines.push(d);
                    }
                    // Keep buffer
                    if (asset.klines.length > 300) asset.klines.shift();
                    
                    asset.chart.setOption(getEChartsOption(asset.klines));

                    setPrices(prev => ({ 
                        ...prev, [s]: { price: d.close, side: d.close >= asset.lastPrice ? 'up' : 'down' } 
                    }));
                    asset.lastPrice = d.close;
                    setSentiment(prev => ({ ...prev, [s]: d.close >= d.open ? 'BULLISH' : 'BEARISH' }));
                }
            } else if (msg.type === 'trade') {
                const s = msg.symbol;
                const d = msg.data;
                if (assets[s]) {
                    const isWhale = (d.p * d.q) > 10000;
                    const trade = {
                        p: d.p.toFixed(s.includes('DOGE') ? 4 : 2),
                        q: d.q.toFixed(3),
                        m: d.m,
                        w: isWhale,
                        t: new Date(d.T).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    };
                    setTrades(prev => {
                        const current = prev[s] || [];
                        return { ...prev, [s]: [trade, ...current].slice(0, 50) };
                    });
                }
            } else if (msg.type === 'depth') {
                setDepths(prev => ({ ...prev, [msg.symbol]: msg.data }));
            }
        };
    });

    onCleanup(() => {
        if (ws) ws.close();
        Object.values(assets).forEach(a => a.chart.dispose());
    });

    const getBTCThreshold = (s) => (s !== 'BTCUSDT' && sentiment()['BTCUSDT'] === sentiment()[s]);

    return (
        <div class="flex flex-col h-full bg-black/40 font-mono">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-1 bg-border_main/10 flex-1 overflow-hidden p-1">
                <For each={symbols}>
                    {(s) => (
                        <div class="flex flex-col bg-bg_main border border-border_main/20 overflow-hidden relative">
                            {/* Card Header */}
                            <div class="flex flex-col bg-black/60 border-b border-border_main/10">
                                <div class="flex justify-between items-center px-3 py-1.5">
                                    <div class="flex items-center gap-2">
                                        <span class="text-[10px] font-black text-text_accent uppercase">{s.replace('USDT','')}</span>
                                        {s !== 'BTCUSDT' && (
                                            <span class={`text-[7px] px-1 rounded-[1px] border ${getBTCThreshold(s) ? 'border-green-500/40 text-green-500' : 'border-white/10 text-text_secondary/40'}`}>
                                                {getBTCThreshold(s) ? 'SYNCED' : 'DECOUPLED'}
                                            </span>
                                        )}
                                    </div>
                                    <span class={`text-[11px] font-bold ${prices()[s]?.side === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                                        ${prices()[s]?.price?.toFixed(s.includes('DOGE') ? 4 : 2) || '0.00'}
                                    </span>
                                </div>
                                <div class="flex justify-between items-center px-3 pb-1">
                                    <span class={`text-[7px] font-black px-1 rounded-[2px] ${sentiment()[s] === 'BULLISH' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {sentiment()[s] || 'NEUTRAL'}
                                    </span>
                                    <div class="w-20 h-1 bg-white/5 rounded-full overflow-hidden flex">
                                        <div style={{ width: `${(depths()[s]?.bid_q / (depths()[s]?.bid_q + depths()[s]?.ask_q) * 100) || 50}%` }} class="h-full bg-green-500/60" />
                                        <div style={{ width: `${(depths()[s]?.ask_q / (depths()[s]?.bid_q + depths()[s]?.ask_q) * 100) || 50}%` }} class="h-full bg-red-500/60" />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Chart Area (ECharts) */}
                            <div class="flex-1 min-h-0 relative">
                                <div class="absolute inset-0" ref={(el) => initChart(el, s)} />
                            </div>

                            {/* Sub-Tabs */}
                            <div class="h-5 bg-black/60 flex items-center border-t border-border_main/10 px-2 gap-3 shrink-0">
                                <button onClick={() => setCardTabs(p => ({ ...p, [s]: 'trades' }))} 
                                    class={`text-[7px] font-black uppercase ${cardTabs()[s] === 'trades' ? 'text-text_accent' : 'text-text_secondary/40'}`}>01_TAPE</button>
                                <button onClick={() => setCardTabs(p => ({ ...p, [s]: 'depth' }))} 
                                    class={`text-[7px] font-black uppercase ${cardTabs()[s] === 'depth' ? 'text-text_accent' : 'text-text_secondary/40'}`}>02_DEPTH</button>
                            </div>

                            {/* Bottom Info Area */}
                            <div class="shrink-0 h-[80px] flex flex-col border-t border-border_main/10 bg-black/20 overflow-hidden">
                                <div class="flex-1 overflow-y-auto win-scroll">
                                    {cardTabs()[s] === 'trades' ? (
                                        <For each={trades()[s] || []}>
                                            {(t) => (
                                                <div class={`grid grid-cols-12 px-2 py-0.5 border-b border-white/[0.02] items-center ${t.w ? 'bg-text_accent/10' : ''}`}>
                                                    <div class={`col-span-1 text-[7px] ${t.m ? 'text-red-500' : 'text-green-500'}`}>{t.m ? '▼' : '▲'}</div>
                                                    <div class={`col-span-4 text-[9px] font-bold ${t.m ? 'text-red-500' : 'text-green-500'}`}>{t.p}</div>
                                                    <div class="col-span-4 text-[8px] text-text_secondary text-right opacity-60">{t.q}</div>
                                                    <div class="col-span-3 text-[7px] text-text_secondary/40 text-right">{t.w ? <span class="text-text_accent animate-pulse font-black">WHALE</span> : t.t}</div>
                                                </div>
                                            )}
                                        </For>
                                    ) : (
                                        <div class="flex flex-col p-2 gap-3">
                                            <div class="flex justify-between text-[8px] font-black text-text_secondary">
                                                <span>BUY/SELL RATIO</span>
                                                <span class="text-text_accent">{((depths()[s]?.bid_q / depths()[s]?.ask_q) || 1).toFixed(2)}x</span>
                                            </div>
                                            <div class="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                                                <div style={{ width: `${(depths()[s]?.bid_q / (depths()[s]?.bid_q + depths()[s]?.ask_q) * 100) || 50}%` }} class="h-full bg-green-500" />
                                            </div>
                                            <div class="flex justify-between text-[9px] font-mono">
                                                <span class="text-green-400">{depths()[s]?.bid_q?.toFixed(2)}</span>
                                                <span class="text-red-400">{depths()[s]?.ask_q?.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </For>
            </div>

            {/* Footer */}
            <div class="h-6 bg-black/80 border-t border-border_main/30 flex items-center justify-between px-4 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">
                <div class="flex items-center gap-4">
                    <span class="text-[8px] font-black text-white tracking-[0.2em]">ENGINE: ECHARTS_LIVE_CORE</span>
                    <div class="h-3 w-px bg-white/10" />
                    <span class="text-[8px] text-text_secondary/60">SOURCE: BINANCE_WSS_AGGREGATOR</span>
                </div>
                <span class="text-[8px] font-black text-text_accent italic animate-pulse">OPTIMIZED FOR TRADER X</span>
            </div>
        </div>
    );
}
