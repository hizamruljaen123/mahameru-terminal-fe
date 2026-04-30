/**
 * INSTITUTIONAL-GRADE COMPARATIVE ANALYSIS PROMPT TEMPLATES
 * Framework: ESG + Technical + Fundamental + Legal + Leadership Intelligence
 * Standard: Hedge Fund / Sell-Side Research Quality
 */

export function buildSystemPrompt(language = 'en') {
  const langLabel = language === 'id' ? 'INDONESIAN' : 'ENGLISH';
  return `You are a Senior Research Analyst at Asetpedia Institutional Intelligence — a premier independent research house serving institutional investors, sovereign wealth funds, and family offices. Your analyses adhere to CFA Institute standards, are structured like Goldman Sachs equity research reports, and incorporate ESG materiality analysis consistent with MSCI ESG methodology. 

WRITING STANDARDS:
- Use normal Sentence Case / Title Case throughout — professional prose like a Bloomberg research report
- Use Markdown tables for all data comparisons (valid | col | col | format)
- Use ### or #### headings only — clear, descriptive section titles
- Be quantitative: cite specific numbers, percentages, ratios from the provided data
- Be decisive: state a clear winner or superiority in each dimension where applicable
- Professional, analytical tone — no marketing language, no hype
- Language: ${langLabel} ONLY. Write the entire report in ${langLabel}.
- Minimum 600 words per stage — be thorough and detailed`;
}

export function buildStagePrompt(stage, symbols, fullData, generatedStages, language = 'en') {
  const symbolList = symbols.join(', ');
  const dataContext = JSON.stringify(fullData, null, 2);
  const previousContext = Object.entries(generatedStages)
    .map(([s, text]) => `--- STAGE ${s} OUTPUT ---\n${text}`)
    .join('\n\n');

  const langLabel = language === 'id' ? 'INDONESIAN' : 'ENGLISH';

  const stages = {
    1: {
      title: language === 'id' ? "RINGKASAN EKSEKUTIF & INTELIJEN MODEL BISNIS" : "EXECUTIVE SUMMARY & BUSINESS MODEL INTELLIGENCE",
      instruction: language === 'id' 
        ? `Buat Ringkasan Eksekutif yang komprehensif membandingkan ${symbolList}. Gunakan data ringkasan Wikipedia dan segmen bisnis yang disediakan untuk memperkaya profil.

Struktur respons Anda sebagai berikut:
### 1.1 Profil Perusahaan & Ikhtisar Model Bisnis
Untuk setiap perusahaan, detailkan: segmen bisnis inti, model pendapatan, eksposur geografis, dan keunggulan kompetitif utama. Masukkan konteks historis dari ringkasan Wikipedia. Nilai bagaimana setiap model bisnis bertahan dari disrupsi.

### 1.2 Posisi Industri & Lanskap Kompetitif
Petakan kedua perusahaan dalam lanskap kompetitif. Siapa yang memegang posisi pasar dominan? Terapkan analisis Porter's Five Forces untuk industri tempat setiap perusahaan beroperasi.

### 1.3 Analisis SWOT — Berdampingan
Sajikan tabel SWOT untuk setiap perusahaan, lalu sintesiskan ke dalam SWOT komparatif.

### 1.4 Lintasan Strategis
Apa strategi yang dinyatakan masing-masing perusahaan? Apakah strategi tersebut kredibel mengingat sumber daya keuangan dan posisi kompetitif mereka?

### 1.5 Putusan Ringkasan Eksekutif
Nyatakan perusahaan mana yang menyajikan tesis investasi yang lebih unggul pada tahap ini, dengan alasan singkat. Jadilah penentu.`
        : `Produce a comprehensive Executive Summary comparing ${symbolList}. Use the provided Wikipedia summary and business segments data to enrich the profiles.

Structure your response as follows:
### 1.1 Company Profiles & Business Model Overview
For each company, detail: core business segments, revenue model, geographic exposure, and key competitive moats. Incorporate historical context from Wikipedia summaries. Assess how each business model withstands disruption.

### 1.2 Industry Positioning & Competitive Landscape
Map both companies on the competitive landscape. Who holds the dominant market position? Apply Porter's Five Forces analysis for the industry each company operates in.

### 1.3 SWOT Analysis — Side-by-Side
Present a SWOT table for each company, then synthesize into a comparative SWOT.

### 1.4 Strategic Trajectory
What is each company's stated strategy? Are the strategies credible given their financial resources and competitive position?

### 1.5 Executive Summary Verdict
State which company presents a superior investment thesis at this stage, with a brief rationale. Be decisive.`
    },

    2: {
      title: language === 'id' ? "ANALISIS TEKNIKAL — HARGA & MOMENTUM KOMPARATIF" : "TECHNICAL ANALYSIS — COMPARATIVE PRICE ACTION & MOMENTUM",
      instruction: language === 'id'
        ? `Lakukan analisis teknikal berdampingan yang ketat untuk ${symbolList}.

### 2.1 Tren Harga & Struktur Pasar
Analisis tren yang berlaku (uptrend/downtrend/konsolidasi) untuk setiap perusahaan. Identifikasi harga tertinggi dan terendah struktural utama.

### 2.2 Indikator Momentum
Bandingkan pembacaan RSI(14), MACD, dan Stokastik. Apakah ada perusahaan yang menunjukkan divergensi momentum dari tren harganya? Apa sinyal ini?

### 2.3 Analisis Moving Average
Evaluasi posisi harga relatif terhadap SMA20, SMA50, SMA200. Identifikasi konfigurasi golden cross / death cross jika ada. Sajikan temuan dalam tabel markdown.

### 2.4 Arsitektur Fibonacci & Support/Resistance
Petakan level retracement Fibonacci yang kritis. Identifikasi zona support dan resistance utama untuk setiap perusahaan. Mana yang memiliki ruang teknikal lebih untuk naik?

### 2.5 Volatilitas & Penilaian Risiko
Bandingkan ATR dan Beta. Perusahaan mana yang menawarkan potensi imbal hasil yang disesuaikan dengan risiko lebih baik dari perspektif teknikal?

### 2.6 Putusan Teknikal
Nyatakan perusahaan mana yang menunjukkan setup teknikal lebih unggul untuk masuk, dengan rentang harga target dan level stop-loss berdasarkan struktur teknikal.`
        : `Conduct a rigorous side-by-side technical analysis for ${symbolList}.

### 2.1 Price Trend & Market Structure
Analyze the prevailing trend (uptrend/downtrend/consolidation) for each company. Identify key structural highs and lows.

### 2.2 Momentum Indicators
Compare RSI(14), MACD, and Stochastic readings. Is either company showing momentum divergence from its price trend? What does this signal?

### 2.3 Moving Average Analysis
Evaluate the position of price relative to SMA20, SMA50, SMA200. Identify golden cross / death cross configurations if present. Present findings in a markdown table.

### 2.4 Fibonacci & Support/Resistance Architecture
Map critical Fibonacci retracement levels. Identify the key support and resistance zones for each company. Which one has more technical room to run upward?

### 2.5 Volatility & Risk Assessment
Compare ATR and Beta. Which company offers better risk-adjusted return potential from a technical perspective?

### 2.6 Technical Verdict
Declare which company shows a technically superior setup for entry, with a target price range and stop-loss level based on technical structure.`
    },

    3: {
      title: language === 'id' ? "ANALISIS FUNDAMENTAL — KESEHATAN KEUANGAN & VALUASI" : "FUNDAMENTAL ANALYSIS — FINANCIAL HEALTH & VALUATION DEEP DIVE",
      instruction: language === 'id'
        ? `Lakukan analisis fundamental tingkat institusi membandingkan ${symbolList}.

### 3.1 Perbandingan Kelipatan Valuasi
Bandingkan P/E, Forward P/E, P/B, EV/EBITDA, P/S di kedua perusahaan. Apakah mereka diperdagangkan pada premium atau diskon terhadap rekan sektornya? Sediakan tabel markdown dengan semua kelipatan.

### 3.2 Analisis Profitabilitas & Efisiensi
Bandingkan Gross Margin, Operating Margin, Net Margin, ROE, ROIC, dan ROA. Perusahaan mana yang menghasilkan pengembalian modal superior? Analisis trennya — apakah profitabilitas berkembang atau menyusut?

### 3.3 Kualitas Pendapatan & Analisis Pertumbuhan
Analisis tingkat pertumbuhan pendapatan historis, pertumbuhan EBITDA, dan lintasan EPS. Apakah pertumbuhan bersifat organik atau didorong akuisisi? Apakah berulang atau berbasis proyek?

### 3.4 Ketahanan Neraca
Bandingkan rasio D/E, Net Debt/EBITDA, Current Ratio, dan Posisi Kas. Perusahaan mana yang lebih baik diposisikan untuk menghadapi penurunan ekonomi atau memanfaatkan peluang pertumbuhan?

### 3.5 Analisis Arus Kas
Evaluasi pembuatan Arus Kas Bebas (FCF), yield FCF, rasio konversi Arus Kas Operasi. Pembuatan FCF yang kuat adalah ciri bisnis berkualitas.

### 3.6 Penilaian Alokasi Modal
Bagaimana manajemen mengalokasikan modal? Dividen, pembelian kembali, M&A, atau investasi ulang? Pendekatan mana yang menciptakan nilai pemegang saham lebih besar?

### 3.7 Putusan Fundamental
Berdasarkan valuasi dan kualitas keuangan, nyatakan perusahaan mana yang merupakan investasi superior dari sisi fundamental, termasuk perkiraan rentang nilai intrinsik.`
        : `Conduct institutional-grade fundamental analysis comparing ${symbolList}.

### 3.1 Valuation Multiples Comparison
Compare P/E, Forward P/E, P/B, EV/EBITDA, P/S across both companies. Are they trading at a premium or discount to their sector peers? Provide a markdown table with all multiples.

### 3.2 Profitability & Efficiency Analysis
Compare Gross Margin, Operating Margin, Net Margin, ROE, ROIC, and ROA. Which company generates superior returns on capital? Analyze the trend — is profitability expanding or contracting?

### 3.3 Revenue Quality & Growth Analysis
Analyze historical revenue growth rates, EBITDA growth, and EPS trajectory. Is growth organic or acquisition-driven? Is it recurring or project-based?

### 3.4 Balance Sheet Fortitude
Compare D/E ratio, Net Debt/EBITDA, Current Ratio, and Cash Position. Which company is better positioned to weather an economic downturn or capitalize on growth opportunities?

### 3.5 Cash Flow Analysis
Evaluate Free Cash Flow generation, FCF yield, Operating Cash Flow conversion ratio. Strong FCF generation is the hallmark of a quality business.

### 3.6 Capital Allocation Assessment
How does management allocate capital? Dividends, buybacks, M&A, or reinvestment? Which approach creates more shareholder value?

### 3.7 Fundamental Verdict
Based on valuation and financial quality, state which company is the superior investment from a fundamental standpoint, including estimated intrinsic value range.`
    },

    4: {
      title: language === 'id' ? "MATRIKS SCORECARD KOMPARATIF — PERINGKAT KPI INSTITUSIONAL" : "COMPARATIVE SCORECARD MATRIX — INSTITUTIONAL KPI RANKING",
      instruction: language === 'id'
        ? `Hasilkan scorecard institusional definitif untuk ${symbolList}.

### 4.1 Matriks Penilaian KPI Komprehensif
Skor setiap perusahaan di seluruh 20 KPI berikut pada skala 1–10. Justifikasi setiap skor secara singkat. Sajikan sebagai tabel markdown yang diformat dengan baik:

| KPI | Bobot | ${symbols.map(s => s + ' Skor').join(' | ')} | Pemenang |
|-----|--------|${symbols.map(() => '------').join('|')}|--------|
| Pertumbuhan Pendapatan (CAGR 3th) | 8% | | |
| Kualitas Margin Laba | 8% | | |
| ROE / ROIC | 7% | | |
| Kekuatan Neraca | 7% | | |
| Pembuatan Arus Kas Bebas | 7% | | |
| Daya Tarik Valuasi | 6% | | |
| Kekuatan Keunggulan Kompetitif | 6% | | |
| Kualitas Manajemen | 6% | | |
| Skor ESG | 5% | | |
| Momentum Teknikal | 5% | | |
| Posisi Pasar | 5% | | |
| Risiko Hukum & Regulasi | 5% | | |
| Kebijakan Dividen | 4% | | |
| Jalur Inovasi | 4% | | |
| Aktivitas Orang Dalam | 4% | | |
| Konsensus Analis | 4% | | |
| Sentimen Berita | 4% | | |
| Likuiditas & Tradabilitas | 3% | | |
| Angin Sektor | 3% | | |
| Tata Kelola Perusahaan | 3% | | |

### 4.2 Skor Akhir Tertimbang
Hitung dan sajikan skor akhir tertimbang untuk setiap perusahaan. Nyatakan pemenang keseluruhan.

### 4.3 Diferensiator Utama
Apa 3 faktor paling kritis yang memisahkan perusahaan-perusahaan ini dalam scorecard ini?`
        : `Produce the definitive institutional scorecard for ${symbolList}.

### 4.1 Comprehensive KPI Scoring Matrix
Score each company across ALL of the following 20 KPIs on a 1–10 scale. Justify each score briefly. Present as a well-formatted markdown table:

| KPI | Weight | ${symbols.map(s => s + ' Score').join(' | ')} | Winner |
|-----|--------|${symbols.map(() => '------').join('|')}|--------|
| Revenue Growth (3Y CAGR) | 8% | | |
| Profit Margin Quality | 8% | | |
| ROE / ROIC | 7% | | |
| Balance Sheet Strength | 7% | | |
| Free Cash Flow Generation | 7% | | |
| Valuation Attractiveness | 6% | | |
| Competitive Moat Strength | 6% | | |
| Management Quality | 6% | | |
| ESG Score | 5% | | |
| Technical Momentum | 5% | | |
| Market Position | 5% | | |
| Legal & Regulatory Risk | 5% | | |
| Dividend Policy | 4% | | |
| Innovation Pipeline | 4% | | |
| Insider Activity | 4% | | |
| Analyst Consensus | 4% | | |
| News Sentiment | 4% | | |
| Liquidity & Tradability | 3% | | |
| Sector Tailwinds | 3% | | |
| Corporate Governance | 3% | | |

### 4.2 Weighted Final Score
Calculate and present the weighted final score for each company. Declare the overall winner.

### 4.3 Key Differentiators
What are the 3 most critical factors that separate these companies in this scorecard?`
    },

    5: {
      title: language === 'id' ? "INTELIJEN SINYAL BERITA & ANALISIS DIVERGENSI SENTIMEN" : "NEWS SIGNAL INTELLIGENCE & SENTIMENT DIVERGENCE ANALYSIS",
      instruction: language === 'id'
        ? `Analisis berita terbaru dan sinyal sentimen untuk ${symbolList}.

### 5.1 Sinyal Berita Makro & Regulasi
Perkembangan makroekonomi atau regulasi apa yang baru-baru ini mempengaruhi setiap perusahaan? Perusahaan mana yang menghadapi hambatan regulasi lebih banyak?

### 5.2 Analisis Kejutan Pendapatan & Katalis Pendapatan
Apa kejutan pendapatan atau katalis pendapatan terbaru? Apakah pasar menilai kembali perusahaan mana pun berdasarkan informasi baru?

### 5.3 Aksi Korporasi Strategis
Ada aktivitas M&A, kemitraan, spin-off, penggalangan modal, atau pivot strategis baru-baru ini? Evaluasi kebijaksanaan strategis dari setiap tindakan.

### 5.4 Divergensi Sentimen
Apakah ada divergensi yang berarti antara sentimen pasar dan nilai fundamental untuk perusahaan mana pun? Ini menciptakan peluang alfa potensial.

### 5.5 Arus Berita Sektor & Industri
Tren industri apa yang terlihat dalam berita? Perusahaan mana yang diposisikan lebih baik untuk mendapat manfaat atau menahan tren ini?

### 5.6 Putusan Intelijen Berita
Berdasarkan arus berita dan analisis sentimen, perusahaan mana yang memiliki momentum narasi superior? Nilai sentimen berita untuk masing-masing: (POSITIF / NETRAL / NEGATIF / CAMPURAN).`
        : `Analyze recent news and sentiment signals for ${symbolList} across multiple analytical dimensions. Pay close attention to the provided "projectNews" (strategic expansion) and "leadershipNews" datasets.

### 5.1 Macro & Regulatory News Signals
What macroeconomic or regulatory developments have affected each company recently? Which company faces more regulatory headwinds?

### 5.2 Earnings & Revenue Catalyst Analysis
What are the most recent earnings surprises or revenue catalysts? Is the market re-rating either company based on new information?

### 5.3 Strategic Corporate Actions & Future Projects
Analyze M&A activity, partnerships, capital raises, and specific expansion projects mentioned in "projectNews". Evaluate the strategic wisdom and potential ROI of these future-facing actions.

### 5.4 Sentiment Divergence
Is there a meaningful divergence between market sentiment and fundamental value for either company? This creates potential alpha opportunities.

### 5.5 Sector & Industry Newsflow
What sector-wide trends are evident in the news? Which company is better positioned to benefit from or withstand these trends?

### 5.6 News Intelligence Verdict
Based on newsflow (general, legal, leadership, and projects), which company has the superior narrative momentum? Rate the news sentiment for each: (POSITIVE / NEUTRAL / NEGATIVE / MIXED).`
    },

    6: {
      title: language === 'id' ? "JEJAK KEPEMIMPINAN & INTELIJEN RISIKO HUKUM" : "LEADERSHIP FOOTPRINT & LEGAL RISK INTELLIGENCE",
      instruction: language === 'id'
        ? `Lakukan penilaian intelijen terhadap kualitas kepemimpinan dan risiko hukum/regulasi untuk ${symbolList}. Analisis data "companyOfficers" yang disediakan untuk setiap entitas.

### 6.1 Profil Kepemimpinan Eksekutif & Rekam Jejak
Untuk eksekutif kunci masing-masing perusahaan (CEO, CFO, dan perwira/officer yang terdaftar): Apa rekam jejak profesional mereka? Keputusan kunci yang mereka buat? Bagaimana performa mereka dibandingkan target yang ditetapkan? Sebutkan nama-nama spesifik dari data.

### 6.2 Kredibilitas Kepemimpinan & Kepercayaan Pasar
Apakah eksekutif memiliki sejarah memenuhi panduan? Ada sejarah kesalahan pendapatan yang signifikan, kegagalan strategis, atau kegagalan kepemimpinan?

### 6.3 Penilaian Tata Kelola Perusahaan
Evaluasi: independensi dewan, transaksi pihak berelasi, penyelarasan kompensasi eksekutif dengan pengembalian pemegang saham, kualitas audit, dan transparansi pengungkapan.

### 6.4 Eksposur Kasus Hukum & Regulasi
Berdasarkan berita dan sinyal hukum yang tersedia, nilai: setiap tuntutan hukum yang tertunda, investigasi regulasi, proses antimonopoli, pelanggaran lingkungan, atau perselisihan tenaga kerja. Kuantifikasi eksposur jika memungkinkan.

### 6.5 Analisis Risiko Reputasi
Risiko reputasi apa yang dihadapi setiap perusahaan? Ada kontroversi ESG, masalah kewajiban produk, pelanggaran data, atau skandal publik?

### 6.6 Putusan Kepemimpinan & Hukum
Perusahaan mana yang menunjukkan tata kelola superior dan risiko hukum/reputasi lebih rendah? Skor masing-masing pada Kualitas Kepemimpinan (1–10) dan Risiko Hukum (Rendah/Menengah/Tinggi).`
        : `Conduct an intelligence assessment of leadership quality and legal/regulatory risk for ${symbolList}. Analyze the specific "companyOfficers" data provided for each entity.

### 6.1 Executive Leadership Profile & Track Record
For each company's key executives (CEO, CFO, and listed officers): What is their professional track record? Key decisions they've made? How have they performed versus stated targets? Mention specific names from the data.

### 6.2 Leadership Credibility & Market Trust
Do the executives have a history of delivering on guidance? Any history of significant earnings misses, strategic failures, or leadership failures?

### 6.3 Corporate Governance Assessment
Evaluate: board independence, related-party transactions, executive compensation alignment with shareholder returns, audit quality, and transparency of disclosures.

### 6.4 Legal & Regulatory Case Exposure
Based on available news and legal signals, assess: any pending lawsuits, regulatory investigations, antitrust proceedings, environmental violations, or labor disputes. Quantify exposure where possible.

### 6.5 Reputational Risk Analysis
What reputational risks does each company face? Any ESG controversies, product liability issues, data breaches, or public scandals?

### 6.6 Leadership & Legal Verdict
Which company demonstrates superior governance and lower legal/reputational risk? Score each on Leadership Quality (1–10) and Legal Risk (Low/Medium/High).`
    },

    7: {
      title: language === 'id' ? "PENILAIAN ESG, PREDIKSI 12-BULAN & KEPUTUSAN INVESTASI" : "ESG ASSESSMENT, 12-MONTH PREDICTION & INVESTMENT DECISION",
      instruction: language === 'id'
        ? `Hasilkan analisis penutup definitif dan rekomendasi investasi untuk ${symbolList}.

### 7.1 Penilaian Materialitas ESG
Untuk setiap perusahaan, identifikasi 3 faktor ESG material teratas yang relevan dengan industrinya. Skor setiap perusahaan pada dimensi Lingkungan, Sosial, dan Tata Kelola. Nilai lintasan ESG (membaik/stabil/memburuk).

### 7.2 Target Harga 12-Bulan & Analisis Skenario
Untuk setiap perusahaan, sediakan:
- **Base Case** (60% probabilitas): Asumsi, harga target, imbal hasil tersirat
- **Bull Case** (25% probabilitas): Katalis kunci, harga target, imbal hasil tersirat
- **Bear Case** (15% probabilitas): Risiko kunci, harga target, penurunan tersirat

### 7.3 Katalis untuk Diawasi (Cakrawala 12-Bulan)
Daftar 5 katalis teratas untuk setiap perusahaan yang dapat menggerakkan saham secara material ke kedua arah.

### 7.4 Matriks Risiko
Sajikan matriks risiko komprehensif untuk setiap perusahaan: identifikasi probabilitas dan keparahan untuk risiko pasar, risiko operasional, risiko regulasi, risiko ESG, dan risiko keuangan.

### 7.5 REKOMENDASI INVESTASI AKHIR
Nyatakan dengan jelas untuk setiap perusahaan:
- **Peringkat**: Strong Buy / Buy / Accumulate / Hold / Reduce / Sell / Strong Sell
- **Target Harga 12-Bulan**: [harga spesifik]
- **Profil Risiko**: Konservatif / Moderat / Agresif
- **Kesesuaian**: [Institusional / Ritel / Keduanya]
- **Pendorong Keyakinan Kunci**: [1 kalimat]

### 7.6 Kesimpulan Investasi Komparatif
Perusahaan mana yang mewakili investasi superior pada harga saat ini? Dalam kondisi apa rekomendasi akan berubah? Bagian ini berfungsi sebagai kesimpulan eksekutif untuk laporan penelitian institusional ini.`
        : `Produce the definitive closing analysis and investment recommendation for ${symbolList}.

### 7.1 ESG Materiality Assessment
For each company, identify the top 3 material ESG factors relevant to their industry. Score each company on Environmental, Social, and Governance dimensions. Assess ESG trajectory (improving/stable/deteriorating).

### 7.2 12-Month Price Target & Scenario Analysis
For each company, provide:
- **Base Case** (60% probability): Assumptions, target price, implied return
- **Bull Case** (25% probability): Key catalysts, target price, implied return  
- **Bear Case** (15% probability): Key risks, target price, implied downside

### 7.3 Catalysts to Watch (12-Month Horizon)
List the top 5 catalysts for each company that could move the stock materially in either direction.

### 7.4 Risk Matrix
Present a comprehensive risk matrix for each company: identify probability and severity for market risk, operational risk, regulatory risk, ESG risk, and financial risk.

### 7.5 FINAL INVESTMENT RECOMMENDATION
State clearly for each company:
- **Rating**: Strong Buy / Buy / Accumulate / Hold / Reduce / Sell / Strong Sell
- **12-Month Price Target**: [specific price]
- **Risk Profile**: Conservative / Moderate / Aggressive
- **Suitability**: [Institutional / Retail / Both]
- **Key Conviction Driver**: [1 sentence]

### 7.6 Comparative Investment Conclusion
Which company represents the superior investment at current prices? Under what conditions would the recommendation change? This section serves as the executive conclusion for this institutional research report.`
    }
  };

  const stageConfig = stages[stage];
  
  return `You are writing Stage ${stage} of 7 for an institutional comparative analysis report in ${langLabel}.

Report Title: "Institutional Comparative Analysis: ${symbolList}"
Stage ${stage}: ${stageConfig.title}

${previousContext ? `CONTEXT FROM PREVIOUS STAGES (use for continuity and cross-referencing):\n${previousContext}\n\n` : ''}

TASK — ${stageConfig.instruction}

RAW DATA AVAILABLE FOR ANALYSIS:
${dataContext}

IMPORTANT INSTRUCTIONS:
- Write at least 600 words for this stage
- Every quantitative claim must reference data from the raw data provided above
- All tables must be valid Markdown format
- Be analytical and decisive — take clear positions
- Do not repeat content from previous stages unnecessarily — build upon it
- Close this stage with a clear directional verdict
- LANGUAGE: Write in ${langLabel} ONLY.`;
}
