/**
 * Mahameru Technical Analysis Engine (Frontend Version)
 * Pure JS implementation for high-speed live calculations
 */

export const TechnicalAnalysis = {
  // Moving Average
  ema: (data, period) => {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    let ema = [data[0].close];
    for (let i = 1; i < data.length; i++) {
      ema.push(data[i].close * k + ema[i - 1] * (1 - k));
    }
    return ema.map((v, i) => ({ time: data[i].time, value: v }));
  },

  sma: (data, period) => {
    if (data.length < period) return [];
    const sma = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      sma.push({ time: data[i].time, value: sum / period });
    }
    return sma;
  },

  // Relative Strength Index
  rsi: (data, period = 14) => {
    if (data.length < period + 1) return [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    const rsi = [{ time: data[period].time, value: 100 - 100 / (1 + avgGain / avgLoss) }];

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rsi.push({ time: data[i].time, value: 100 - 100 / (1 + avgGain / avgLoss) });
    }
    return rsi;
  },

  // Bollinger Bands
  bollinger: (data, period = 20, stdDev = 2) => {
    if (data.length < period) return [];
    const bands = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[i - j].close;
      const mean = sum / period;
      let variance = 0;
      for (let j = 0; j < period; j++) variance += Math.pow(data[i - j].close - mean, 2);
      const sd = Math.sqrt(variance / period);
      bands.push({
        time: data[i].time,
        middle: mean,
        upper: mean + stdDev * sd,
        lower: mean - stdDev * sd
      });
    }
    return bands;
  },

  // MACD
  macd: (data, fast = 12, slow = 26, signal = 9) => {
    const emaFast = TechnicalAnalysis.ema(data, fast);
    const emaSlow = TechnicalAnalysis.ema(data, slow);
    if (emaSlow.length === 0) return [];

    const macdLine = [];
    // Align emaFast and emaSlow
    const offset = fast - slow; // usually fast < slow, so offset is negative
    emaSlow.forEach((s, i) => {
      const f = emaFast.find(x => x.time === s.time);
      if (f) macdLine.push({ time: s.time, value: f.value - s.value });
    });

    const signalLine = TechnicalAnalysis.ema(macdLine.map(x => ({ close: x.value, time: x.time })), signal);
    return { macd: macdLine, signal: signalLine };
  },

  // Trend & Signal Logic (PREDICTION ENGINE)
  getSignal: (data) => {
    if (data.length < 30) return { action: 'WAIT', score: 0 };
    
    const rsiValues = TechnicalAnalysis.rsi(data, 14);
    const lastRsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1].value : 50;
    const ema7 = TechnicalAnalysis.ema(data, 7);
    const ema25 = TechnicalAnalysis.ema(data, 25);
    const lastEma7 = ema7[ema7.length - 1]?.value;
    const lastEma25 = ema25[ema25.length - 1]?.value;
    const lastPrice = data[data.length - 1].close;

    let score = 0; // -10 to +10

    // RSI Logic
    if (lastRsi < 30) score += 3; // Oversold
    else if (lastRsi > 70) score -= 3; // Overbought
    else if (lastRsi > 50) score += 1;
    else score -= 1;

    // EMA Crossover Logic
    if (lastEma7 > lastEma25) score += 4; // Bullish cross
    else score -= 4; // Bearish cross

    // Price relative to EMA
    if (lastPrice > lastEma7) score += 2;
    else score -= 2;

    const action = score >= 5 ? 'STRONG BUY' : 
                   score >= 2 ? 'BUY' : 
                   score <= -5 ? 'STRONG SELL' : 
                   score <= -2 ? 'SELL' : 'NEUTRAL';

    return { action, score, rsi: lastRsi };
  }
};
