/**
 * Technical Indicators Service (Modular)
 */

export const Indicators = {
    // Basic Indicators
    ma: (data, period) => {
        let result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push({ x: data[i].Date, y: null });
                continue;
            }
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j].Close;
            }
            result.push({ x: data[i].Date, y: sum / period });
        }
        return result;
    },

    ema: (data, period) => {
        let result = [];
        let k = 2 / (period + 1);
        let ema = data[0].Close;
        for (let i = 0; i < data.length; i++) {
            ema = (data[i].Close * k) + (ema * (1 - k));
            result.push({ x: data[i].Date, y: ema });
        }
        return result;
    },

    momentum: (data, period = 10) => {
        let result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period) {
                result.push({ x: data[i].Date, y: null });
                continue;
            }
            result.push({ x: data[i].Date, y: data[i].Close - data[i - period].Close });
        }
        return result;
    },

    roc: (data, period = 12) => {
        let result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period) {
                result.push({ x: data[i].Date, y: null });
                continue;
            }
            let prevClose = data[i - period].Close;
            result.push({ x: data[i].Date, y: ((data[i].Close - prevClose) / prevClose) * 100 });
        }
        return result;
    },

    pivotPoints: (data) => {
        // Standard Pivot Points based on previous day (if data is daily)
        // or a rolling window if we want it dynamic.
        // Let's do standard: Pivot (P) = (H + L + C) / 3 of the last candle
        let last = data[data.length - 2]; // Previous candle
        if (!last) return null;
        let p = (last.High + last.Low + last.Close) / 3;
        return {
            p: p,
            r1: (2 * p) - last.Low,
            s1: (2 * p) - last.High,
            r2: p + (last.High - last.Low),
            s2: p - (last.High - last.Low)
        };
    },

    highLowChannel: (data, period = 20) => {
        let upper = [];
        let lower = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                upper.push({ x: data[i].Date, y: null });
                lower.push({ x: data[i].Date, y: null });
                continue;
            }
            let slice = data.slice(i - period + 1, i + 1);
            upper.push({ x: data[i].Date, y: Math.max(...slice.map(d => d.High)) });
            lower.push({ x: data[i].Date, y: Math.min(...slice.map(d => d.Low)) });
        }
        return { upper, lower };
    },

    // Intermediate Indicators
    rsi: (data, period = 14) => {
        let result = [];
        let gains = [];
        let losses = [];
        for (let i = 1; i < data.length; i++) {
            let diff = data[i].Close - data[i - 1].Close;
            gains.push(diff > 0 ? diff : 0);
            losses.push(diff < 0 ? Math.abs(diff) : 0);
        }

        let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

        for (let i = 0; i < data.length; i++) {
            if (i <= period) {
                result.push({ x: data[i].Date, y: null });
                continue;
            }
            avgGain = ((avgGain * (period - 1)) + gains[i - 1]) / period;
            avgLoss = ((avgLoss * (period - 1)) + losses[i - 1]) / period;
            let rs = avgGain / (avgLoss || 1);
            result.push({ x: data[i].Date, y: 100 - (100 / (1 + rs)) });
        }
        return result;
    },

    bollinger: (data, period = 20, multiplier = 2) => {
        let sma = Indicators.ma(data, period);
        let result = { upper: [], lower: [], middle: [] };
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.upper.push({ x: data[i].Date, y: null });
                result.lower.push({ x: data[i].Date, y: null });
                result.middle.push({ x: data[i].Date, y: null });
                continue;
            }
            let slice = data.slice(i - period + 1, i + 1).map(d => d.Close);
            let mean = slice.reduce((a, b) => a + b, 0) / period;
            let stdDev = Math.sqrt(slice.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / period);
            result.middle.push({ x: data[i].Date, y: mean });
            result.upper.push({ x: data[i].Date, y: mean + (multiplier * stdDev) });
            result.lower.push({ x: data[i].Date, y: mean - (multiplier * stdDev) });
        }
        return result;
    },

    // Professional Indicators
    macd: (data, slow = 26, fast = 12, signal = 9) => {
        let emaSlow = Indicators.ema(data, slow);
        let emaFast = Indicators.ema(data, fast);
        let macdLine = emaFast.map((f, i) => ({ x: f.x, y: f.y - (emaSlow[i]?.y || 0) }));
        
        let k = 2 / (signal + 1);
        let sig = macdLine[0].y;
        let signalLine = macdLine.map(m => {
            sig = (m.y * k) + (sig * (1 - k));
            return { x: m.x, y: sig };
        });

        return { macd: macdLine, signal: signalLine, hist: macdLine.map((m, i) => ({ x: m.x, y: m.y - signalLine[i].y })) };
    },

    stochastic: (data, period = 14, smoothK = 3, smoothD = 3) => {
        let kLine = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                kLine.push({ x: data[i].Date, y: null });
                continue;
            }
            let slice = data.slice(i - period + 1, i + 1);
            let low = Math.min(...slice.map(d => d.Low));
            let high = Math.max(...slice.map(d => d.High));
            let k = ((data[i].Close - low) / (high - low)) * 100;
            kLine.push({ x: data[i].Date, y: k });
        }

        // Smoothing for %K and %D
        const getSMA = (arr, p) => {
            let res = [];
            for (let i = 0; i < arr.length; i++) {
                if (i < p - 1 || arr[i].y === null) {
                    res.push({ x: arr[i].x, y: null });
                    continue;
                }
                let sum = 0;
                for (let j = 0; j < p; j++) sum += arr[i-j].y;
                res.push({ x: arr[i].x, y: sum / p });
            }
            return res;
        };

        let slowK = getSMA(kLine, smoothK);
        let slowD = getSMA(slowK, smoothD);
        return { k: slowK, d: slowD };
    },

    atr: (data, period = 14) => {
        let atr = [];
        let trs = [];
        for (let i = 0; i < data.length; i++) {
            if (i === 0) {
                trs.push(data[i].High - data[i].Low);
                atr.push({ x: data[i].Date, y: trs[0] });
                continue;
            }
            let tr = Math.max(
                data[i].High - data[i].Low,
                Math.abs(data[i].High - data[i-1].Close),
                Math.abs(data[i].Low - data[i-1].Close)
            );
            trs.push(tr);
            if (i < period) {
                atr.push({ x: data[i].Date, y: trs.reduce((a,b) => a+b, 0) / (i+1) });
            } else {
                let prevAtr = atr[i-1].y;
                let val = (prevAtr * (period - 1) + tr) / period;
                atr.push({ x: data[i].Date, y: val });
            }
        }
        return atr;
    },

    cci: (data, period = 20) => {
        let result = [];
        let tps = data.map(d => (d.High + d.Low + d.Close) / 3);
        
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push({ x: data[i].Date, y: null });
                continue;
            }
            let slice = tps.slice(i - period + 1, i + 1);
            let sma = slice.reduce((a, b) => a + b, 0) / period;
            let meanDev = slice.map(x => Math.abs(x - sma)).reduce((a, b) => a + b, 0) / period;
            let cci = (tps[i] - sma) / (0.015 * meanDev);
            result.push({ x: data[i].Date, y: cci });
        }
        return result;
    },

    williamsR: (data, period = 14) => {
        let result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push({ x: data[i].Date, y: null });
                continue;
            }
            let slice = data.slice(i - period + 1, i + 1);
            let high = Math.max(...slice.map(d => d.High));
            let low = Math.min(...slice.map(d => d.Low));
            let r = ((high - data[i].Close) / (high - low)) * -100;
            result.push({ x: data[i].Date, y: r });
        }
        return result;
    },

    // Professional Indicators
    vwap: (data) => {
        let result = [];
        let cumPv = 0;
        let cumVol = 0;
        for (let i = 0; i < data.length; i++) {
            let tp = (data[i].High + data[i].Low + data[i].Close) / 3;
            cumPv += tp * data[i].Volume;
            cumVol += data[i].Volume;
            result.push({ x: data[i].Date, y: cumPv / (cumVol || 1) });
        }
        return result;
    },

    ichimoku: (data) => {
        const getMedian = (slice) => (Math.max(...slice.map(d => d.High)) + Math.min(...slice.map(d => d.Low))) / 2;
        let tenkan = [], kijun = [], spanA = [], spanB = [], chikou = [];

        for (let i = 0; i < data.length; i++) {
            // Tenkan (9)
            if (i >= 8) tenkan.push({ x: data[i].Date, y: getMedian(data.slice(i - 8, i + 1)) });
            else tenkan.push({ x: data[i].Date, y: null });

            // Kijun (26)
            if (i >= 25) kijun.push({ x: data[i].Date, y: getMedian(data.slice(i - 25, i + 1)) });
            else kijun.push({ x: data[i].Date, y: null });

            // Chikou (Lagging 26)
            if (i < data.length - 26) chikou.push({ x: data[i].Date, y: data[i + 25]?.Close || null });
            else chikou.push({ x: data[i].Date, y: null });

            // Senkou Span A & B are projected 26 periods ahead. 
            // For simple rendering, we calculate current but label it as leading
            if (i >= 25) {
                let sA = (tenkan[i].y + kijun[i].y) / 2;
                spanA.push({ x: data[i].Date, y: sA }); // Plotted 26 ahead usually, but here we just return the values
            } else spanA.push({ x: data[i].Date, y: null });

            if (i >= 51) {
                let sB = getMedian(data.slice(i - 51, i + 1));
                spanB.push({ x: data[i].Date, y: sB });
            } else spanB.push({ x: data[i].Date, y: null });
        }
        return { tenkan, kijun, spanA, spanB, chikou };
    },

    psar: (data, step = 0.02, maxStep = 0.2) => {
        let psar = [];
        let uptrend = true;
        let af = step;
        let ep = data[0].High;
        let sar = data[0].Low;

        for (let i = 0; i < data.length; i++) {
            psar.push({ x: data[i].Date, y: sar });
            let nextSar = sar + af * (ep - sar);
            if (uptrend) {
                if (data[i].Low < nextSar) {
                    uptrend = false;
                    nextSar = ep;
                    ep = data[i].Low;
                    af = step;
                } else {
                    if (data[i].High > ep) {
                        ep = data[i].High;
                        af = Math.min(af + step, maxStep);
                    }
                }
            } else {
                if (data[i].High > nextSar) {
                    uptrend = true;
                    nextSar = ep;
                    ep = data[i].High;
                    af = step;
                } else {
                    if (data[i].Low < ep) {
                        ep = data[i].Low;
                        af = Math.min(af + step, maxStep);
                    }
                }
            }
            sar = nextSar;
        }
        return psar;
    },

    fibonacci: (data) => {
        const highs = data.map(d => d.High);
        const lows = data.map(d => d.Low);
        const max = Math.max(...highs);
        const min = Math.min(...lows);
        const diff = max - min;
        return {
            max: max,
            min: min,
            levels: {
                "0%": max,
                "23.6%": max - (0.236 * diff),
                "38.2%": max - (0.382 * diff),
                "50%": max - (0.5 * diff),
                "61.8%": max - (0.618 * diff),
                "78.6%": max - (0.786 * diff),
                "100%": min
            }
        };
    },

    mfi: (data, period = 14) => {
        let mfi = [];
        let tps = data.map(d => (d.High + d.Low + d.Close) / 3);
        let pmf = [], nmf = [];

        for (let i = 0; i < data.length; i++) {
            if (i === 0) { pmf.push(0); nmf.push(0); continue; }
            let mf = tps[i] * data[i].Volume;
            if (tps[i] > tps[i-1]) { pmf.push(mf); nmf.push(0); }
            else if (tps[i] < tps[i-1]) { pmf.push(0); nmf.push(mf); }
            else { pmf.push(0); nmf.push(0); }
        }

        for (let i = 0; i < data.length; i++) {
            if (i < period) { mfi.push({ x: data[i].Date, y: null }); continue; }
            let posSum = pmf.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            let negSum = nmf.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            let mFr = posSum / (negSum || 1);
            mfi.push({ x: data[i].Date, y: 100 - (100 / (1 + mFr)) });
        }
        return mfi;
    },

    cmf: (data, period = 20) => {
        let cmf = [];
        let mfvs = data.map(d => {
            let mult = ((d.Close - d.Low) - (d.High - d.Close)) / ((d.High - d.Low) || 1);
            return mult * d.Volume;
        });

        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) { cmf.push({ x: data[i].Date, y: null }); continue; }
            let sumMfv = mfvs.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            let sumVol = data.slice(i - period + 1, i + 1).map(d => d.Volume).reduce((a, b) => a + b, 0);
            cmf.push({ x: data[i].Date, y: sumMfv / (sumVol || 1) });
        }
        return cmf;
    },

    keltner: (data, period = 20, multiplier = 1.5) => {
        let mid = Indicators.ma(data, period);
        let atr = Indicators.atr(data, period);
        let upper = [], lower = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                upper.push({ x: data[i].Date, y: null });
                lower.push({ x: data[i].Date, y: null });
                continue;
            }
            upper.push({ x: data[i].Date, y: mid[i].y + (multiplier * atr[i].y) });
            lower.push({ x: data[i].Date, y: mid[i].y - (multiplier * atr[i].y) });
        }
        return { upper, lower, middle: mid };
    },

    // Quantitative & Deep Analysis
    stddev: (data, period = 20) => {
        let res = [];
        let ma = Indicators.ma(data, period);
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) { res.push({ x: data[i].Date, y: null }); continue; }
            let slice = data.slice(i - period + 1, i + 1).map(d => d.Close);
            let avg = ma[i].y;
            let sqDiff = slice.map(x => Math.pow(x - avg, 2));
            let variance = sqDiff.reduce((a, b) => a + b, 0) / period;
            res.push({ x: data[i].Date, y: Math.sqrt(variance) });
        }
        return res;
    },

    zscore: (data, period = 20) => {
        let res = [];
        let ma = Indicators.ma(data, period);
        let sd = Indicators.stddev(data, period);
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1 || sd[i].y === 0) { res.push({ x: data[i].Date, y: null }); continue; }
            res.push({ x: data[i].Date, y: (data[i].Close - ma[i].y) / sd[i].y });
        }
        return res;
    },

    frama: (data, period = 20) => {
        // Fractal Adaptive Moving Average (FRAMA)
        let res = [];
        let w = period / 2;
        let alpha = 0; // Smoothing factor
        let filt = data[0].Close;

        for (let i = 0; i < data.length; i++) {
            if (i < period) { res.push({ x: data[i].Date, y: data[i].Close }); continue; }
            
            // Fractal Dimension Calculation
            let n1 = (Math.max(...data.slice(i - period + 1, i - w + 1).map(d=>d.High)) - Math.min(...data.slice(i - period + 1, i - w + 1).map(d=>d.Low))) / w;
            let n2 = (Math.max(...data.slice(i - w + 1, i + 1).map(d=>d.High)) - Math.min(...data.slice(i - w + 1, i + 1).map(d=>d.Low))) / w;
            let n3 = (Math.max(...data.slice(i - period + 1, i + 1).map(d=>d.High)) - Math.min(...data.slice(i - period + 1, i + 1).map(d=>d.Low))) / period;
            
            let dimen = (n1 > 0 && n2 > 0 && n3 > 0) ? (Math.log(n1 + n2) - Math.log(n3)) / Math.log(2) : 0;
            let alpha = Math.exp(-4.6 * (dimen - 1));
            alpha = Math.max(Math.min(alpha, 1), 0.01);
            
            filt = alpha * data[i].Close + (1 - alpha) * filt;
            res.push({ x: data[i].Date, y: filt });
        }
        return res;
    },

    // --- ADVANCED STATISTICAL SUITE ---
    logarithmicEntropy: (data, period = 14) => {
        let res = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period) { res.push({ x: data[i].Date, y: 0 }); continue; }
            let slice = data.slice(i - period + 1, i + 1).map(d => d.Close);
            let returns = slice.slice(1).map((v, idx) => Math.log(v / slice[idx]));
            let mean = returns.reduce((a, b) => a + b, 0) / returns.length;
            let entropy = returns.reduce((acc, v) => acc + Math.abs(v - mean), 0); 
            res.push({ x: data[i].Date, y: entropy * 100 });
        }
        return res;
    },

    priceVolumeImpulse: (data, period = 14) => {
        let res = [];
        for (let i = 0; i < data.length; i++) {
            if (i === 0) { res.push({ x: data[i].Date, y: 0 }); continue; }
            let logReturn = Math.log(data[i].Close / (data[i-1].Close || 1e-10));
            // Standardized Impulse: Volume * Squared Log Return
            let impulse = data[i].Volume * Math.pow(logReturn, 2);
            res.push({ x: data[i].Date, y: impulse });
        }
        // Smooth it with SMA to highlight the trend in activity intensity
        return Indicators.ma(res.map(r => ({Date: r.x, Close: r.y})), period);
    },

    statisticalSpread: (data, period = 20) => {
        let ma = Indicators.ma(data, period);
        let sd = Indicators.stddev(data, period);
        let upper = [], lower = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period) { upper.push({x:data[i].Date, y:null}); lower.push({x:data[i].Date, y:null}); continue; }
            upper.push({ x: data[i].Date, y: ma[i].y + (3 * sd[i].y) });
            lower.push({ x: data[i].Date, y: ma[i].y - (3 * sd[i].y) });
        }
        return { upper, lower };
    },

    fractalAdaptiveSmoothing: (data) => {
        let f8 = Indicators.frama(data, 8);
        let f21 = Indicators.frama(data, 21);
        return { fast: f8, slow: f21 };
    },

    adaptiveStochastic: (data, period = 14) => {
        let res = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period * 2) { res.push({ x: data[i].Date, y: 50 }); continue; }
            // Dynamic period based on local volatility
            let volSlice = data.slice(i - 10, i + 1).map(d => Math.abs(d.High - d.Low));
            let avgVol = volSlice.reduce((a,b)=>a+b,0) / volSlice.length;
            let dynamicPeriod = Math.max(5, Math.min(30, Math.floor(period * (avgVol / (data[i].Close * 0.01)))));
            
            let slice = data.slice(i - dynamicPeriod + 1, i + 1);
            let low = Math.min(...slice.map(d => d.Low));
            let high = Math.max(...slice.map(d => d.High));
            let k = ((data[i].Close - low) / (high - low)) * 100;
            res.push({ x: data[i].Date, y: k });
        }
        return res;
    },

    marketMomentumIndex: (data, n = 14) => {
        let res = [];
        let tr = [];
        for (let i = 0; i < data.length; i++) {
            let h_l = data[i].High - data[i].Low;
            let h_pc = i > 0 ? Math.abs(data[i].High - data[i-1].Close) : h_l;
            let l_pc = i > 0 ? Math.abs(data[i].Low - data[i-1].Close) : h_l;
            tr.push(Math.max(h_l, h_pc, l_pc));
        }

        let volumes = data.map(d => d.Volume);
        
        for (let i = 0; i < data.length; i++) {
            if (i < n) { res.push({ x: data[i].Date, y: 0 }); continue; }
            
            let atr = tr.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n;
            let k = (data[i].Close - data[i - n].Close) / data[i - n].Close;
            
            let volSlice = volumes.slice(i - n + 1, i + 1);
            let avgVol = volSlice.reduce((a, b) => a + b, 0) / n;
            let m = data[i].Volume / (avgVol || 1);
            
            let f = (data[i].High - data[i].Low) / (atr || 1e-6);
            let dmmv = (k * m) / (f + 1e-6);
            
            res.push({ x: data[i].Date, y: dmmv });
        }
        return res;
    }
};
