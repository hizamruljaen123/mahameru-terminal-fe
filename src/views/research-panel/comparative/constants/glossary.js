export const GLOSSARY = [
  {
    group: "TECHNICAL ANALYSIS",
    terms: [
      { term: "RSI (Relative Strength Index)", def: "Momentum oscillator measuring the speed and magnitude of price movements on a scale of 0–100. RSI > 70 indicates overbought; RSI < 30 indicates oversold." },
      { term: "MACD (Moving Average Convergence Divergence)", def: "Trend-following momentum indicator showing the relationship between two exponential moving averages. A bullish signal occurs when the MACD line crosses above the signal line." },
      { term: "Bollinger Bands", def: "Volatility bands placed 2 standard deviations above and below a 20-day SMA. Price touching the upper band may indicate overbought conditions; lower band may indicate oversold." },
      { term: "SMA / EMA", def: "Simple Moving Average (SMA) uses equal weighting across periods; Exponential Moving Average (EMA) gives more weight to recent prices, making it more reactive to new information." },
      { term: "Fibonacci Retracement", def: "Horizontal lines indicating potential support/resistance levels based on Fibonacci ratios (23.6%, 38.2%, 50%, 61.8%, 78.6%) drawn between a significant high and low." },
      { term: "ATR (Average True Range)", def: "Volatility indicator measuring average price range over a period. High ATR indicates greater volatility; useful for setting stop-loss levels." },
      { term: "Support & Resistance", def: "Price levels where a stock historically has difficulty falling below (support) or rising above (resistance), based on buying and selling pressure." },
      { term: "Beta (β)", def: "Measures a stock's volatility relative to the overall market. Beta > 1 is more volatile than the market; Beta < 1 is less volatile." },
    ]
  },
  {
    group: "FUNDAMENTAL ANALYSIS",
    terms: [
      { term: "P/E Ratio (Price-to-Earnings)", def: "Share price divided by earnings per share. A higher P/E suggests investors expect higher future growth, while a lower P/E may indicate undervaluation." },
      { term: "P/B Ratio (Price-to-Book)", def: "Market price per share divided by book value per share. P/B < 1 may indicate the stock is undervalued relative to its net assets." },
      { term: "EV/EBITDA", def: "Enterprise Value divided by Earnings Before Interest, Taxes, Depreciation and Amortization. A capital-structure-neutral valuation metric for comparing companies across sectors." },
      { term: "ROE (Return on Equity)", def: "Net income divided by shareholders' equity. Measures how effectively management uses shareholder capital to generate profit. ROE > 15% is generally considered strong." },
      { term: "ROIC (Return on Invested Capital)", def: "Measures how efficiently a company allocates capital to generate profit relative to total invested capital. ROIC > WACC indicates value creation." },
      { term: "Free Cash Flow (FCF)", def: "Operating cash flow minus capital expenditures. Represents the cash available for dividends, debt repayment, or reinvestment. Consistent positive FCF is a hallmark of financial health." },
      { term: "Debt-to-Equity (D/E)", def: "Total liabilities divided by shareholders' equity. High D/E indicates significant financial leverage; sector context is critical for interpretation." },
      { term: "Gross / Operating / Net Margin", def: "Profitability ratios measuring efficiency at different stages: Gross (revenue minus COGS), Operating (after operating expenses), Net (after all costs including tax)." },
      { term: "Current Ratio", def: "Current assets divided by current liabilities. A ratio > 1 indicates the company can cover short-term obligations; < 1 may signal liquidity risk." },
      { term: "EBITDA", def: "Earnings Before Interest, Taxes, Depreciation and Amortization. A proxy for operating cash flow, useful for comparing operational performance across companies." },
      { term: "Market Capitalization", def: "Total market value of outstanding shares (Price × Shares Outstanding). Used to classify companies: Large-cap (>$10B), Mid-cap ($2B–$10B), Small-cap (<$2B)." },
      { term: "Enterprise Value (EV)", def: "Market cap plus total debt minus cash and equivalents. Represents the theoretical acquisition cost of a company, including its debt obligations." },
    ]
  },
  {
    group: "ESG FRAMEWORK",
    terms: [
      { term: "ESG (Environmental, Social, Governance)", def: "A framework for evaluating non-financial risks and opportunities. Used by institutional investors to assess long-term sustainability and ethical impact of investments." },
      { term: "Environmental Score (E)", def: "Measures a company's impact on the environment: carbon footprint, energy efficiency, water usage, waste management, and climate risk exposure." },
      { term: "Social Score (S)", def: "Evaluates relationships with employees, suppliers, customers, and communities: labor practices, human rights, community engagement, and product safety." },
      { term: "Governance Score (G)", def: "Assesses quality of leadership, executive compensation, board diversity, shareholder rights, transparency, and anti-corruption policies." },
      { term: "Materiality Matrix", def: "A tool identifying ESG issues most significant to a company's business and stakeholders, prioritizing which factors are most likely to affect financial performance." },
      { term: "Carbon Footprint / Scope 1, 2, 3", def: "Scope 1: Direct emissions. Scope 2: Indirect emissions from purchased energy. Scope 3: All other indirect emissions across the value chain." },
      { term: "ESG Integration", def: "The systematic inclusion of ESG factors in investment analysis and portfolio construction, distinct from exclusionary screening." },
    ]
  },
  {
    group: "RISK & LEGAL",
    terms: [
      { term: "Litigation Risk", def: "The probability that legal proceedings—lawsuits, regulatory investigations, arbitration—could materially affect a company's financial position or reputation." },
      { term: "Regulatory Exposure", def: "Vulnerability to changes in laws, regulations, or government policies that could impact the company's operations, costs, or market position." },
      { term: "Counterparty Risk", def: "The risk that a business partner or contracting entity fails to meet its contractual obligations, creating financial losses." },
      { term: "Systemic Risk", def: "Risk inherent to an entire market or economic system that cannot be diversified away, often triggered by macroeconomic shocks." },
      { term: "Credit Risk", def: "The probability that a borrower defaults on their debt obligations. Reflected in credit ratings from agencies like Moody's, S&P, and Fitch." },
    ]
  },
  {
    group: "ASETPEDIA INTELLIGENCE METRICS",
    terms: [
      { term: "Trust Score", def: "Asetpedia's internal metric (0–10) rating the credibility and reliability of a news source based on editorial standards and track record." },
      { term: "Impact Score", def: "A measure of the potential financial or operational impact of a news event on the associated company, sector, or market. Score > 5 triggers an ALERT flag." },
      { term: "Sentiment Score", def: "Aggregated NLP-derived score indicating market sentiment (Positive / Neutral / Negative) from news and social media signals." },
      { term: "Comparative KPI Score", def: "Weighted institutional scoring framework across 20 key performance indicators used to produce a relative winner ranking in the Comparative Matrix." },
      { term: "Leadership Footprint Index", def: "Asetpedia metric tracking public profile, strategic decisions, controversies, and market perception of a company's executive leadership team." },
    ]
  }
];
