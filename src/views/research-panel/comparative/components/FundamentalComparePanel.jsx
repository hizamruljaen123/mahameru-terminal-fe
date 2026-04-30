import { For, Show } from 'solid-js';

const COLORS = ['sky', 'amber', 'emerald'];
const colorMap = {
  sky: { text: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/30', badge: 'bg-sky-400 text-black' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', badge: 'bg-amber-400 text-black' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', badge: 'bg-emerald-400 text-black' },
};

const fmt = (v, d = 2) => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => v == null ? '—' : (v * 100).toFixed(2) + '%';
const fmtBig = (num) => {
  if (num == null) return '—';
  if (Math.abs(num) >= 1e12) return (num / 1e12).toFixed(2) + ' T';
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + ' B';
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + ' M';
  return num.toLocaleString();
};

const METRICS = [
  { label: 'Market Cap', key: 'marketCap', fmt: fmtBig },
  { label: 'Enterprise Value', key: 'enterpriseValue', fmt: fmtBig },
  { label: 'P/E (Trailing)', key: 'trailingPE', fmt: (v) => fmt(v) },
  { label: 'Forward P/E', key: 'forwardPE', fmt: (v) => fmt(v) },
  { label: 'PEG Ratio', key: 'pegRatio', fmt: (v) => fmt(v) },
  { label: 'P/B Ratio', key: 'priceToBook', fmt: (v) => fmt(v) },
  { label: 'P/S Ratio', key: 'priceToSales', fmt: (v) => fmt(v) },
  { label: 'EV/EBITDA', key: 'evToEbitda', fmt: (v) => fmt(v) },
  { label: 'EV/Revenue', key: 'evToRevenue', fmt: (v) => fmt(v) },
  { label: 'Beta (5Y)', key: 'beta', fmt: (v) => fmt(v) },
  
  { label: 'Revenue (TTM)', key: 'totalRevenue', fmt: fmtBig },
  { label: 'Revenue Growth', key: 'revenueGrowth', fmt: fmtPct },
  { label: 'Quarterly Rev Growth', key: 'quarterlyRevenueGrowth', fmt: fmtPct },
  { label: 'EBITDA', key: 'ebitda', fmt: fmtBig },
  { label: 'Net Income', key: 'netIncomeToCommon', fmt: fmtBig },
  { label: 'Earnings Growth', key: 'earningsGrowth', fmt: fmtPct },
  { label: 'Quarterly Ern Growth', key: 'earningsQuarterlyGrowth', fmt: fmtPct },
  
  { label: 'Gross Margin', key: 'grossMargins', fmt: fmtPct },
  { label: 'Operating Margin', key: 'operatingMargins', fmt: fmtPct },
  { label: 'Profit Margin', key: 'profitMargins', fmt: fmtPct },
  { label: 'ROE', key: 'returnOnEquity', fmt: fmtPct },
  { label: 'ROA', key: 'returnOnAssets', fmt: fmtPct },
  
  { label: 'Free Cash Flow', key: 'freeCashflow', fmt: fmtBig },
  { label: 'Levered FCF', key: 'leveredFreeCashflow', fmt: fmtBig },
  { label: 'Operating CF', key: 'operatingCashflow', fmt: fmtBig },
  
  { label: 'Total Cash', key: 'totalCash', fmt: fmtBig },
  { label: 'Total Debt', key: 'totalDebt', fmt: fmtBig },
  { label: 'D/E Ratio', key: 'debtToEquity', fmt: (v) => fmt(v) },
  { label: 'Current Ratio', key: 'currentRatio', fmt: (v) => fmt(v) },
  { label: 'Quick Ratio', key: 'quickRatio', fmt: (v) => fmt(v) },
  
  { label: 'Div Yield (%)', key: 'dividendYield', fmt: fmtPct },
  { label: 'Div Rate', key: 'dividendRate', fmt: (v) => fmt(v) },
  { label: 'Payout Ratio', key: 'payoutRatio', fmt: fmtPct },
  
  { label: 'Shares Out', key: 'sharesOutstanding', fmt: fmtBig },
  { label: 'Float Shares', key: 'floatShares', fmt: fmtBig },
  { label: 'Short Ratio', key: 'shortRatio', fmt: (v) => fmt(v) },
  { label: 'Short % of Float', key: 'shortPercentOfFloat', fmt: fmtPct },
  { label: 'Rec. Key', key: 'recommendationKey', fmt: (v) => v || '—' },
];

export default function FundamentalComparePanel(props) {
  // props: companies (array of {symbol, fundamental})
  const companies = () => props.companies || [];

  const getVal = (comp, key) => comp?.fundamental?.snapshot?.[key];

  // Determine winner per metric (higher is better unless marked otherwise)
  const LOWER_IS_BETTER = new Set(['debtToEquity', 'trailingPE', 'forwardPE', 'priceToBook', 'evToEbitda', 'evToRevenue', 'beta', 'pegRatio', 'priceToSales', 'shortRatio', 'shortPercentOfFloat', 'payoutRatio']);

  const getWinner = (key) => {
    const vals = companies().map(c => getVal(c, key));
    const valid = vals.map((v, i) => ({ v: parseFloat(v), i })).filter(x => !isNaN(x.v));
    if (valid.length < 2) return null;
    const best = LOWER_IS_BETTER.has(key)
      ? valid.reduce((a, b) => a.v < b.v ? a : b)
      : valid.reduce((a, b) => a.v > b.v ? a : b);
    return best.i;
  };

  return (
    <div class="flex flex-col gap-6">
      {/* Header row with company name badges */}
      <div class="grid gap-4" style={{ 'grid-template-columns': `180px repeat(${companies().length}, 1fr)` }}>
        <div class="text-[8px] font-black text-text_secondary/40 uppercase tracking-widest pt-2">METRIC</div>
        <For each={companies()}>
          {(comp, i) => {
            const c = colorMap[COLORS[i()]];
            return (
              <div class={`${c.bg} border ${c.border} rounded px-3 py-2`}>
                <div class={`text-[11px] font-black ${c.text} uppercase tracking-widest`}>{comp.symbol}</div>
                <div class="text-[8px] text-white/30 truncate">{comp?.fundamental?.snapshot?.shortName || ''}</div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Metrics Table */}
      <div class="rounded border border-white/5 overflow-hidden">
        <For each={METRICS}>
          {(metric, mi) => {
            const winner = getWinner(metric.key);
            return (
              <div class={`grid items-center gap-4 px-3 py-2 ${mi() % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
                style={{ 'grid-template-columns': `180px repeat(${companies().length}, 1fr)` }}>
                <div class="text-[9px] font-bold text-text_secondary/50 uppercase tracking-wide">{metric.label}</div>
                <For each={companies()}>
                  {(comp, i) => {
                    const raw = getVal(comp, metric.key);
                    const formatted = metric.fmt(raw);
                    const isWinner = winner === i();
                    const c = colorMap[COLORS[i()]];
                    return (
                      <div class={`flex items-center gap-1.5 ${isWinner ? c.text : 'text-white/60'} font-mono font-bold text-[10px]`}>
                        <Show when={isWinner}>
                          <span class={`text-[6px] px-1 py-0.5 rounded-sm font-black ${c.badge}`}>BEST</span>
                        </Show>
                        {formatted}
                      </div>
                    );
                  }}
                </For>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
