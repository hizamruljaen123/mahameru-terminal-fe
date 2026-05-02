/**
 * ============================================================================
 * ASETPEDIA INSTITUTIONAL INTELLIGENCE ENGINE
 * Comparative Analysis Prompt Framework v2.0
 * ============================================================================
 * Standard : CFA Institute · Goldman Sachs Research · MSCI ESG Methodology
 * Coverage : Stage 0–8 (Pre-check → Executive → Technical → Fundamental →
 *            Scorecard → News → Leadership → ESG/Final → Synthesis)
 * Features : Industry-adaptive KPI weights · Data-slice per stage ·
 *            Compressed context carry-forward · Hallucination guards ·
 *            Analyst override injection · Confidence scoring
 * ============================================================================
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type Language = 'en' | 'id';

export type LegalRisk = 'Low' | 'Medium' | 'High';

export type SectorKey =
    | 'technology'
    | 'financials'
    | 'banking'
    | 'energy'
    | 'healthcare'
    | 'consumer_staples'
    | 'consumer_discretionary'
    | 'industrials'
    | 'materials'
    | 'real_estate'
    | 'utilities'
    | 'communication_services'
    | 'default';

export interface KPIWeightConfig {
    revenueGrowth: number;
    profitMarginQuality: number;
    roeRoic: number;
    balanceSheetStrength: number;
    fcfGeneration: number;
    valuationAttractiveness: number;
    competitiveMoat: number;
    managementQuality: number;
    esgScore: number;
    technicalMomentum: number;
    marketPosition: number;
    legalRegulatoryRisk: number;
    dividendPolicy: number;
    innovationPipeline: number;
    insiderActivity: number;
    analystConsensus: number;
    newsSentiment: number;
    liquidityTradability: number;
    sectorTailwinds: number;
    corporateGovernance: number;
}

export interface InfrastructureProximity {
    total: number;
    nearest: Array<{ infra_type: string; name: string; distance: number }>;
    grouped: Record<string, Array<{ name: string; distance_km: number }>>;
}

export interface StagePromptOptions {
    stage: number;
    symbols: string[];
    fullData: Record<string, unknown>;
    generatedStages: Record<number, string>;
    language?: Language;
    sector?: SectorKey;
    analystNotes?: Partial<Record<number, string>>;
    peerBenchmarks?: PeerBenchmark[];
    currency?: string;
    exchange?: string;
    infrastructure?: Record<string, InfrastructureProximity | null> | null;
}

export interface PeerBenchmark {
    name: string;
    peRatio?: number;
    evEbitda?: number;
    revenueGrowthYoy?: number;
    netMargin?: number;
    marketCap?: string;
}

export interface StageConfig {
    title: string;
    persona: string;
    requiredDataKeys: string[];
    criticalDataKeys: string[];
    instruction: string;
}

// ============================================================================
// INDUSTRY-ADAPTIVE KPI WEIGHT MATRIX
// ============================================================================
// Total must always equal 100 per sector. Weights shift based on what
// actually drives valuation in each industry vertical.

const KPI_WEIGHT_MATRIX: Record<SectorKey, KPIWeightConfig> = {
    technology: {
        revenueGrowth: 10,
        profitMarginQuality: 7,
        roeRoic: 6,
        balanceSheetStrength: 5,
        fcfGeneration: 8,
        valuationAttractiveness: 5,
        competitiveMoat: 9,
        managementQuality: 7,
        esgScore: 4,
        technicalMomentum: 4,
        marketPosition: 7,
        legalRegulatoryRisk: 5,
        dividendPolicy: 2,
        innovationPipeline: 9,
        insiderActivity: 3,
        analystConsensus: 3,
        newsSentiment: 3,
        liquidityTradability: 2,
        sectorTailwinds: 5,
        corporateGovernance: 6,
    },
    financials: {
        revenueGrowth: 6,
        profitMarginQuality: 7,
        roeRoic: 12,
        balanceSheetStrength: 13,
        fcfGeneration: 4,
        valuationAttractiveness: 7,
        competitiveMoat: 6,
        managementQuality: 7,
        esgScore: 4,
        technicalMomentum: 3,
        marketPosition: 6,
        legalRegulatoryRisk: 8,
        dividendPolicy: 6,
        innovationPipeline: 2,
        insiderActivity: 3,
        analystConsensus: 3,
        newsSentiment: 3,
        liquidityTradability: 3,
        sectorTailwinds: 4,
        corporateGovernance: 8,
    },
    // Banking sector: OCF negative is NORMAL, focus on NIM/NPL/LDR/BOPO,
    // valuation uses P/B adjusted ROE or DDM (NOT EV/Revenue or DuPont)
    banking: {
        revenueGrowth: 5,
        profitMarginQuality: 5,
        roeRoic: 15,
        balanceSheetStrength: 15,
        fcfGeneration: 2,
        valuationAttractiveness: 10,
        competitiveMoat: 7,
        managementQuality: 8,
        esgScore: 5,
        technicalMomentum: 3,
        marketPosition: 7,
        legalRegulatoryRisk: 10,
        dividendPolicy: 5,
        innovationPipeline: 1,
        insiderActivity: 3,
        analystConsensus: 4,
        newsSentiment: 3,
        liquidityTradability: 3,
        sectorTailwinds: 4,
        corporateGovernance: 10,
    },
    energy: {
        revenueGrowth: 6,
        profitMarginQuality: 8,
        roeRoic: 7,
        balanceSheetStrength: 8,
        fcfGeneration: 10,
        valuationAttractiveness: 6,
        competitiveMoat: 5,
        managementQuality: 6,
        esgScore: 10,
        technicalMomentum: 4,
        marketPosition: 5,
        legalRegulatoryRisk: 8,
        dividendPolicy: 6,
        innovationPipeline: 3,
        insiderActivity: 3,
        analystConsensus: 3,
        newsSentiment: 3,
        liquidityTradability: 2,
        sectorTailwinds: 6,
        corporateGovernance: 5,
    },
    healthcare: {
        revenueGrowth: 8,
        profitMarginQuality: 8,
        roeRoic: 6,
        balanceSheetStrength: 6,
        fcfGeneration: 7,
        valuationAttractiveness: 5,
        competitiveMoat: 9,
        managementQuality: 7,
        esgScore: 5,
        technicalMomentum: 3,
        marketPosition: 6,
        legalRegulatoryRisk: 9,
        dividendPolicy: 3,
        innovationPipeline: 10,
        insiderActivity: 3,
        analystConsensus: 4,
        newsSentiment: 3,
        liquidityTradability: 2,
        sectorTailwinds: 5,
        corporateGovernance: 5,
    },
    consumer_staples: {
        revenueGrowth: 6,
        profitMarginQuality: 9,
        roeRoic: 8,
        balanceSheetStrength: 6,
        fcfGeneration: 9,
        valuationAttractiveness: 6,
        competitiveMoat: 8,
        managementQuality: 6,
        esgScore: 6,
        technicalMomentum: 3,
        marketPosition: 8,
        legalRegulatoryRisk: 4,
        dividendPolicy: 7,
        innovationPipeline: 3,
        insiderActivity: 3,
        analystConsensus: 3,
        newsSentiment: 3,
        liquidityTradability: 2,
        sectorTailwinds: 4,
        corporateGovernance: 5,
    },
    consumer_discretionary: {
        revenueGrowth: 9,
        profitMarginQuality: 7,
        roeRoic: 7,
        balanceSheetStrength: 6,
        fcfGeneration: 7,
        valuationAttractiveness: 6,
        competitiveMoat: 7,
        managementQuality: 7,
        esgScore: 4,
        technicalMomentum: 4,
        marketPosition: 7,
        legalRegulatoryRisk: 4,
        dividendPolicy: 3,
        innovationPipeline: 5,
        insiderActivity: 4,
        analystConsensus: 4,
        newsSentiment: 4,
        liquidityTradability: 2,
        sectorTailwinds: 6,
        corporateGovernance: 5,
    },
    industrials: {
        revenueGrowth: 7,
        profitMarginQuality: 8,
        roeRoic: 8,
        balanceSheetStrength: 8,
        fcfGeneration: 8,
        valuationAttractiveness: 6,
        competitiveMoat: 6,
        managementQuality: 7,
        esgScore: 6,
        technicalMomentum: 3,
        marketPosition: 6,
        legalRegulatoryRisk: 6,
        dividendPolicy: 5,
        innovationPipeline: 4,
        insiderActivity: 3,
        analystConsensus: 3,
        newsSentiment: 3,
        liquidityTradability: 2,
        sectorTailwinds: 7,
        corporateGovernance: 5,
    },
    materials: {
        revenueGrowth: 6,
        profitMarginQuality: 8,
        roeRoic: 7,
        balanceSheetStrength: 8,
        fcfGeneration: 8,
        valuationAttractiveness: 7,
        competitiveMoat: 5,
        managementQuality: 6,
        esgScore: 8,
        technicalMomentum: 4,
        marketPosition: 5,
        legalRegulatoryRisk: 7,
        dividendPolicy: 5,
        innovationPipeline: 3,
        insiderActivity: 3,
        analystConsensus: 3,
        newsSentiment: 3,
        liquidityTradability: 3,
        sectorTailwinds: 7,
        corporateGovernance: 5,
    },
    real_estate: {
        revenueGrowth: 5,
        profitMarginQuality: 7,
        roeRoic: 7,
        balanceSheetStrength: 10,
        fcfGeneration: 9,
        valuationAttractiveness: 8,
        competitiveMoat: 5,
        managementQuality: 7,
        esgScore: 6,
        technicalMomentum: 3,
        marketPosition: 5,
        legalRegulatoryRisk: 6,
        dividendPolicy: 10,
        innovationPipeline: 2,
        insiderActivity: 3,
        analystConsensus: 3,
        newsSentiment: 3,
        liquidityTradability: 3,
        sectorTailwinds: 6,
        corporateGovernance: 6,
    },
    utilities: {
        revenueGrowth: 4,
        profitMarginQuality: 8,
        roeRoic: 7,
        balanceSheetStrength: 10,
        fcfGeneration: 8,
        valuationAttractiveness: 8,
        competitiveMoat: 7,
        managementQuality: 6,
        esgScore: 9,
        technicalMomentum: 3,
        marketPosition: 5,
        legalRegulatoryRisk: 8,
        dividendPolicy: 10,
        innovationPipeline: 2,
        insiderActivity: 2,
        analystConsensus: 3,
        newsSentiment: 3,
        liquidityTradability: 2,
        sectorTailwinds: 5,
        corporateGovernance: 6,
    },
    communication_services: {
        revenueGrowth: 8,
        profitMarginQuality: 7,
        roeRoic: 6,
        balanceSheetStrength: 5,
        fcfGeneration: 8,
        valuationAttractiveness: 6,
        competitiveMoat: 9,
        managementQuality: 7,
        esgScore: 5,
        technicalMomentum: 4,
        marketPosition: 8,
        legalRegulatoryRisk: 6,
        dividendPolicy: 3,
        innovationPipeline: 7,
        insiderActivity: 3,
        analystConsensus: 3,
        newsSentiment: 4,
        liquidityTradability: 2,
        sectorTailwinds: 6,
        corporateGovernance: 5,
    },
    default: {
        revenueGrowth: 8,
        profitMarginQuality: 8,
        roeRoic: 7,
        balanceSheetStrength: 7,
        fcfGeneration: 7,
        valuationAttractiveness: 6,
        competitiveMoat: 6,
        managementQuality: 6,
        esgScore: 5,
        technicalMomentum: 5,
        marketPosition: 5,
        legalRegulatoryRisk: 5,
        dividendPolicy: 4,
        innovationPipeline: 4,
        insiderActivity: 4,
        analystConsensus: 4,
        newsSentiment: 4,
        liquidityTradability: 3,
        sectorTailwinds: 3,
        corporateGovernance: 3,
    },
};

// ============================================================================
// SECTOR DETECTION — maps yfinance sector strings to internal SectorKey
// Enables KPI weight matrix to calibrate analysis per sector
// ============================================================================

/**
 * Maps yfinance sector strings to internal SectorKey enum.
 * Detects sector from the first symbol's fundamental data,
 * with banking override for hardcoded BANKING_SYMBOLS.
 */
export function detectSectorFromData(
    fullData: Record<string, unknown>,
    symbols: string[]
): SectorKey {
    // Banking override: if any symbol is in BANKING_SYMBOLS list
    if (hasBankingSymbol(symbols)) return 'banking';

    const firstSymbol = symbols[0];
    const symData = (fullData as any)?.[firstSymbol];
    const sector: string | undefined = symData?.fundamental?.snapshot?.sector;

    if (!sector) return 'default';

    // Normalize yfinance sector values to our SectorKey
    const sectorMap: Record<string, SectorKey> = {
        'technology': 'technology',
        'communication services': 'communication_services',
        'telecommunications': 'communication_services',
        'consumer cyclical': 'consumer_discretionary',
        'consumer discretionary': 'consumer_discretionary',
        'consumer defensive': 'consumer_staples',
        'consumer staples': 'consumer_staples',
        'energy': 'energy',
        'financial services': 'financials',
        'financial': 'financials',
        'healthcare': 'healthcare',
        'industrials': 'industrials',
        'basic materials': 'materials',
        'materials': 'materials',
        'real estate': 'real_estate',
        'utilities': 'utilities',
    };

    const normalized = sector.toLowerCase().trim();
    return sectorMap[normalized] ?? 'default';
}

// ============================================================================
// DATA RELEVANCE MAP — only relevant keys are sent per stage
// This prevents token bloat and forces model focus
// ============================================================================

const DATA_SLICE_MAP: Record<number, string[]> = {
    0: ['*'], // Stage 0 needs full scan to assess data quality
    1: [
        'fundamental.snapshot.longBusinessSummary',
        'fundamental.snapshot.sector',
        'fundamental.snapshot.industry',
        'fundamental.snapshot.country',
        'fundamental.snapshot.fullTimeEmployees',
        'fundamental.snapshot.companyOfficers',
        'fundamental.snapshot.marketCap',
        'fundamental.snapshot.website',
        'fundamental.snapshot.wikipedia_summary'
    ],
    2: [
        'market.historical',
        'ta.current',
        'ta.signals',
        'ta.support_resistance',
        'fundamental.snapshot.beta'
    ],
    3: [
        'fundamental.snapshot',
        'fundamentalEnriched.financials.income_statement',
        'fundamentalEnriched.financials.balance_sheet',
        'fundamentalEnriched.financials.cash_flow',
        'fundamental.snapshot.wikipedia_summary'
    ],
    4: [
        'fundamental.snapshot',
        'ta.signals',
        'sentiment',
        'fundamental.snapshot.companyOfficers',
        'news'
    ],
    5: [
        'news',
        'projectNews',
        'leadershipNews',
        'sectorNews',
        'sentiment'
    ],
    6: [
        'fundamental.snapshot.companyOfficers',
        'legalNews',
        'leadershipNews'
    ],
    7: [
        'fundamental.snapshot',
        'sentiment',
        'ta.signals',
        'market.historical'
    ],
    8: [], // Stage 8 uses only compressed stage verdicts — no raw data needed
};

// ============================================================================
// STAGE-SPECIFIC ANALYST PERSONAS
// Different analytical lens per stage raises domain accuracy significantly
// ============================================================================

const STAGE_PERSONAS: Record<number, Record<Language, string>> = {
    0: {
        en: 'You are a Senior Data Integrity Officer at Asetpedia Institutional Intelligence. Your role is to audit data completeness before research commences — a critical gating function that protects the integrity of downstream analysis.',
        id: 'Anda adalah Senior Data Integrity Officer di Asetpedia Institutional Intelligence. Peran Anda adalah mengaudit kelengkapan data sebelum riset dimulai — fungsi penjagaan kritis yang melindungi integritas analisis hilir.',
    },
    1: {
        en: 'You are a Senior Equity Research Analyst at Asetpedia Institutional Intelligence, specializing in business model analysis and competitive strategy. Your approach combines industry structure analysis (Porter\'s Five Forces, SWOT, value chain) with qualitative assessment of competitive moat durability. You write with the precision of Goldman Sachs equity research and the strategic depth of McKinsey industry analysis.',
        id: 'Anda adalah Senior Equity Research Analyst di Asetpedia Institutional Intelligence, spesialis analisis model bisnis dan strategi kompetitif. Pendekatan Anda menggabungkan analisis struktur industri (Porter\'s Five Forces, SWOT, value chain) dengan penilaian kualitatif ketahanan competitive moat. Anda menulis dengan presisi riset ekuitas Goldman Sachs dan kedalaman strategis analisis industri McKinsey.',
    },
    2: {
        en: 'You are a Senior Technical Analyst and Market Structure Specialist at Asetpedia Institutional Intelligence, with expertise in price action, momentum systems, and multi-timeframe trend analysis. You apply institutional-grade technical methodology: Wyckoff market cycles, Volume Spread Analysis, ICT concepts, and classical Dow Theory — not just indicator readings. You distinguish between signal and noise with conviction.',
        id: 'Anda adalah Senior Technical Analyst dan Market Structure Specialist di Asetpedia Institutional Intelligence, dengan keahlian dalam price action, sistem momentum, dan analisis tren multi-timeframe. Anda menerapkan metodologi teknikal kelas institusional: siklus pasar Wyckoff, Volume Spread Analysis, konsep ICT, dan Teori Dow klasik — bukan sekadar pembacaan indikator. Anda membedakan sinyal dari noise dengan keyakinan.',
    },
    3: {
        en: 'You are a Senior Fundamental Analyst and Valuation Specialist at Asetpedia Institutional Intelligence, trained in CFA Institute methodology. You perform granular financial statement analysis — decomposing DuPont ROE, stress-testing balance sheets, and interrogating FCF quality. Your valuation work is anchored in intrinsic value: DCF, Residual Income, and EV/EBITDA relative frameworks. You identify accounting quality issues and normalize earnings where necessary.',
        id: 'Anda adalah Senior Fundamental Analyst dan Valuation Specialist di Asetpedia Institutional Intelligence, terlatih dalam metodologi CFA Institute. Anda melakukan analisis laporan keuangan yang granular — mendekomposisi DuPont ROE, stress-testing neraca, dan menginterogasi kualitas FCF. Pekerjaan valuasi Anda berjangkar pada nilai intrinsik: DCF, Residual Income, dan kerangka relatif EV/EBITDA. Anda mengidentifikasi masalah kualitas akuntansi dan menormalisasi pendapatan bila perlu.',
    },
    4: {
        en: 'You are the Chief Investment Strategist at Asetpedia Institutional Intelligence. Your role is to synthesize all analytical dimensions into a single, authoritative, weighted scorecard — the definitive institutional ranking tool. You apply rigorous, sector-calibrated weights and justify every score with specific data evidence. Your verdicts are final and actionable.',
        id: 'Anda adalah Chief Investment Strategist di Asetpedia Institutional Intelligence. Peran Anda adalah mensintesis semua dimensi analitik ke dalam satu scorecard tertimbang yang definitif dan otoritatif — alat peringkat institusional yang menentukan. Anda menerapkan bobot yang ketat dan dikalibrasi per sektor, serta membenarkan setiap skor dengan bukti data spesifik. Putusan Anda bersifat final dan dapat ditindaklanjuti.',
    },
    5: {
        en: 'You are a Senior Intelligence Analyst at Asetpedia Institutional Intelligence, specializing in news signal extraction, sentiment quantification, and narrative momentum analysis. You treat news as structured data — identifying catalysts, separating signal from noise, detecting sentiment divergence from fundamentals, and assessing how information flow shifts market pricing. You are a forensic reader of corporate communications.',
        id: 'Anda adalah Senior Intelligence Analyst di Asetpedia Institutional Intelligence, spesialis ekstraksi sinyal berita, kuantifikasi sentimen, dan analisis momentum narasi. Anda memperlakukan berita sebagai data terstruktur — mengidentifikasi katalis, memisahkan sinyal dari noise, mendeteksi divergensi sentimen dari fundamental, dan menilai bagaimana aliran informasi menggeser penetapan harga pasar. Anda adalah pembaca forensik komunikasi korporat.',
    },
    6: {
        en: 'You are a Senior Governance & Risk Intelligence Analyst at Asetpedia Institutional Intelligence. You assess leadership track records with forensic rigor — evaluating capital allocation decisions, guidance reliability, strategic execution, and board accountability. You identify legal and reputational risk with the precision of a legal due diligence expert, quantifying potential financial exposure where possible.',
        id: 'Anda adalah Senior Governance & Risk Intelligence Analyst di Asetpedia Institutional Intelligence. Anda menilai rekam jejak kepemimpinan dengan ketelitian forensik — mengevaluasi keputusan alokasi modal, keandalan panduan, eksekusi strategis, dan akuntabilitas dewan. Anda mengidentifikasi risiko hukum dan reputasi dengan presisi seorang pakar legal due diligence, mengkuantifikasi potensi eksposur finansial bila memungkinkan.',
    },
    7: {
        en: 'You are the Head of Research at Asetpedia Institutional Intelligence, responsible for issuing the final investment verdict. Your analysis integrates ESG materiality, scenario modeling, and risk matrix construction — culminating in a decisive, conviction-driven recommendation with explicit price targets and risk thresholds. You write for portfolio managers who need clarity, not hedging.',
        id: 'Anda adalah Head of Research di Asetpedia Institutional Intelligence, bertanggung jawab mengeluarkan putusan investasi akhir. Analisis Anda mengintegrasikan materialitas ESG, pemodelan skenario, dan konstruksi matriks risiko — berpuncak pada rekomendasi yang decisif dan conviction-driven dengan target harga eksplisit dan ambang risiko. Anda menulis untuk manajer portofolio yang butuh kejelasan, bukan hedging.',
    },
    8: {
        en: 'You are a Senior Research Editor at Asetpedia Institutional Intelligence. Your role is to distill a full 7-stage institutional research report into a precision one-pager for senior portfolio managers and investment committees. Every word must carry weight. Clarity and conviction over comprehensiveness.',
        id: 'Anda adalah Senior Research Editor di Asetpedia Institutional Intelligence. Peran Anda adalah menyuling laporan riset institusional 7-stage menjadi one-pager presisi untuk manajer portofolio senior dan komite investasi. Setiap kata harus berbobot. Kejelasan dan keyakinan di atas komprehensivitas.',
    },
};

// ============================================================================
// WRITING STANDARDS — shared across all stages
// ============================================================================

function buildWritingStandards(language: Language, stage: number): string {
    const isID = language === 'id';
    const langLabel = isID ? 'INDONESIAN' : 'ENGLISH';

    return `
WRITING STANDARDS:
- Professional Sentence Case throughout — analytical prose, not marketing copy
- Use valid Markdown tables for ALL data comparisons: | col | col | format
- Use ### or #### headings only — clear and descriptive
- Be quantitative: cite specific numbers, ratios, percentages from the provided data
- Be decisive: name a winner or state clear superiority where evidence supports it
- Analytical tone — think Goldman Sachs equity research meets MSCI ESG report
- LANGUAGE: ${langLabel} ONLY. Every word, heading, and table label in ${langLabel}.
- Write concisely — every sentence must carry analytical weight. No padding, no repetition, no meta-commentary
- If data is marked [DATA TIDAK TERSEDIA] or [DATA UNAVAILABLE], explicitly state this in your analysis — do NOT fabricate, estimate, or proxy missing values
- Where data gaps exist, note their impact on analytical confidence
- Cross-reference prior stage verdicts where relevant for consistency
- ZERO PROXY RULE: Never substitute missing data with proxy indicators. If Volume data is missing, do NOT use MFI as a Volume proxy. If SMA data is missing, do NOT use SAR as an SMA proxy. State "[DATA TIDAK TERSEDIA]" and move on.
`.trim();
}

// ============================================================================
// DATA VALIDATION ENGINE
// Prevents hallucination by flagging missing critical data before prompting
// ============================================================================

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, key: string) => {
        if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
            return (acc as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
}

function isDataPresent(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && Object.keys(value as object).length === 0) return false;
    return true;
}

// Fields that, if missing, materially degrade analysis quality per stage
const CRITICAL_FIELDS_PER_STAGE: Record<number, string[]> = {
    1: ['fundamental.snapshot.longBusinessSummary', 'fundamental.snapshot.sector'],
    2: ['market.historical', 'ta.current'],
    3: ['fundamental.snapshot', 'fundamentalEnriched.financials.income_statement'],
    4: ['fundamental.snapshot'],
    5: ['news'],
    6: ['fundamental.snapshot.companyOfficers'],
    7: ['fundamental.snapshot', 'ta.signals'],
    8: [],
};

function buildDataAvailabilityBlock(
    fullData: Record<string, unknown>,
    stage: number,
    symbols: string[],
    language: Language
): string {
    if (stage === 0 || stage === 8) return '';

    const critical = CRITICAL_FIELDS_PER_STAGE[stage] ?? [];
    const sliceKeys = DATA_SLICE_MAP[stage] ?? [];

    const missingCritical: string[] = [];
    const missingNonCritical: string[] = [];

    for (const sym of symbols) {
        const symData = (fullData[sym] ?? {}) as Record<string, unknown>;
        for (const key of sliceKeys) {
            if (key === '*') continue;
            const val = getNestedValue(symData, key);
            if (!isDataPresent(val)) {
                const label = `${sym}.${key}`;
                if (critical.includes(key)) {
                    missingCritical.push(label);
                } else {
                    missingNonCritical.push(label);
                }
            }
        }
    }

    const isID = language === 'id';
    const lines: string[] = [];

    if (missingCritical.length > 0) {
        lines.push(
            isID
                ? `⚠️ DATA KRITIKAL TIDAK TERSEDIA: ${missingCritical.join(', ')}. Jangan fabrikasi nilai-nilai ini. Nyatakan secara eksplisit bahwa data tidak tersedia dan kurangi keyakinan analitis Anda pada bagian yang terpengaruh.`
                : `⚠️ CRITICAL DATA UNAVAILABLE: ${missingCritical.join(', ')}. Do NOT fabricate these values. Explicitly state data unavailability and reduce your analytical confidence on affected sections.`
        );
    }

    if (missingNonCritical.length > 0) {
        lines.push(
            isID
                ? `ℹ️ Data sekunder tidak tersedia: ${missingNonCritical.join(', ')}. Lanjutkan analisis namun catat keterbatasan.`
                : `ℹ️ Secondary data unavailable: ${missingNonCritical.join(', ')}. Proceed with analysis but note the limitations.`
        );
    }

    if (lines.length === 0) {
        lines.push(
            isID
                ? `✓ Semua field data kunci tersedia untuk stage ini.`
                : `✓ All key data fields are available for this stage.`
        );
    }

    return `\nDATA INTEGRITY STATUS:\n${lines.join('\n')}\n`;
}

// ============================================================================
// DATA OPTIMIZER — minimizes token usage by removing nulls and compacting history
// ============================================================================

function optimizeValue(val: any): any {
    if (val === null || val === undefined || val === '') return null;

    if (Array.isArray(val)) {
        if (val.length > 0 && val[0] && typeof val[0] === 'object') {
            const keys = Object.keys(val[0]);
            const dateKey = keys.find(k => k === 'date' || k === 'time' || k === 'timestamp');
            if (dateKey) {
                const first = val[0];
                const last = val[val.length - 1];
                const v = val.map((h: any) => {
                    if (h.close !== undefined) return h.close;
                    if (h.price !== undefined) return h.price;
                    const numKey = keys.find(k => k !== dateKey && typeof h[k] === 'number');
                    return numKey ? h[numKey] : h;
                });
                return {
                    p: `${first[dateKey]} to ${last[dateKey]}`, // Period
                    d: v // Data
                };
            }
        }
        const filtered = val.map(optimizeValue).filter(v => v !== null);
        return filtered.length > 0 ? filtered : null;
    }

    if (typeof val === 'object' && !(val instanceof Date)) {
        const optimized: any = {};
        let hasData = false;
        for (const [k, v] of Object.entries(val)) {
            const ov = optimizeValue(v);
            if (ov !== null) {
                optimized[k] = ov;
                hasData = true;
            }
        }
        return hasData ? optimized : null;
    }

    return val;
}

// ============================================================================
// DATA SLICER — extracts only stage-relevant fields from fullData
// ============================================================================

function sliceData(
    fullData: Record<string, unknown>,
    stage: number,
    symbols: string[]
): Record<string, unknown> {
    const keys = DATA_SLICE_MAP[stage] ?? [];
    const sliced: Record<string, Record<string, any>> = {};

    // First pass: extract and optimize
    for (const sym of symbols) {
        const symData = (fullData[sym] ?? {}) as Record<string, any>;
        sliced[sym] = {};

        if (keys.includes('*')) {
            sliced[sym] = optimizeValue(symData) || {};
        } else {
            for (const key of keys) {
                const val = getNestedValue(symData, key);
                sliced[sym][key] = isDataPresent(val) ? optimizeValue(val) : '-';
            }
        }
    }

    // Secondary pass: ensure consistency across symbols (normalize with '-')
    const allStageKeys = new Set<string>();
    symbols.forEach(sym => Object.keys(sliced[sym]).forEach(k => allStageKeys.add(k)));

    symbols.forEach(sym => {
        allStageKeys.forEach(k => {
            if (sliced[sym][k] === undefined || sliced[sym][k] === null) {
                sliced[sym][k] = '-';
            }
        });
    });

    return sliced;
}

// ============================================================================
// CONTEXT COMPRESSOR — sends only verdicts from prior stages, not full text
// Prevents context window overflow at stage 6–7
// ============================================================================

/**
 * Compresses prior stage analysis into concise verdict-only context.
 * Uses multi-strategy extraction: (1) verdict section heading, (2) markdown tables, (3) last paragraphs.
 * Limits each stage to ~400 chars for token efficiency.
 */
function compressPreviousContext(
    generatedStages: Record<number, string>,
    currentStage: number,
    language: Language
): string {
    const isID = language === 'id';
    const verdictLabel = isID ? 'PUTUSAN' : 'VERDICT';
    const contextLabel = isID ? 'RINGKASAN ANALISIS SEBELUMNYA' : 'PRIOR STAGE ANALYSIS SUMMARY';
    const MAX_CHARS_PER_STAGE = 400;

    const entries = Object.entries(generatedStages)
        .filter(([s]) => Number(s) < currentStage)
        .map(([s, text]) => {
            if (!text) return '';

            // Strategy 1: Find VERDICT/CONCLUSION headings (markdown ## or ###)
            let extracted = '';
            const headingPatterns = [
                // English verdict headings
                /##\s*(?:Verdict|Conclusion|Final\s*(?:Thoughts?|Analysis|Recommendation)|Investment\s*(?:Decision|Thesis|Recommendation)|Key\s*(?:Findings|Insights)|Summary\s*(?:&|and)\s*Recommendation)[^]*?(?=##|\n#|$)/gi,
                // Indonesian verdict headings
                /##\s*(?:Putusan|Kesimpulan|Akhir|Keputusan\s*Investasi|Rekomendasi|Ringkasan\s*(?:&|dan)\s*Rekomendasi|Temuan\s*Utama)[^]*?(?=##|\n#|$)/gi,
                // H3 verdict headings
                /###\s*(?:Verdict|Conclusion|Putusan|Kesimpulan|Final|Akhir|Keputusan|Rekomendasi)[^]*?(?=###|##|\n#|$)/gi,
            ];

            for (const pattern of headingPatterns) {
                const match = text.match(pattern);
                if (match) {
                    extracted = match[0].trim();
                    break;
                }
            }

            // Strategy 2: If no verdict heading, extract key tables (for scorecard Stage 4)
            if (!extracted && Number(s) === 4) {
                const tableRegex = /(\|.+\|\n)+/g;
                const tables = [...text.matchAll(tableRegex)];
                if (tables.length > 0) {
                    // Take the last complete table (scorecard summary)
                    extracted = tables[tables.length - 1][0].trim();
                }
            }

            // Strategy 3: Fall back to last 2 paragraphs
            if (!extracted) {
                const paragraphs = text.split('\n\n').filter(p => p.trim().length > 20);
                extracted = paragraphs.slice(-2).join('\n\n');
            }

            // Truncate to limit
            if (extracted.length > MAX_CHARS_PER_STAGE) {
                extracted = extracted.slice(0, MAX_CHARS_PER_STAGE) + '...[truncated]';
            }

            return extracted ? `[Stage ${s} ${verdictLabel}]\n${extracted}` : '';
        });

    const validEntries = entries.filter(Boolean);
    if (validEntries.length === 0) return '';

    return `${contextLabel} (use for cross-referencing — build upon, do not repeat):\n\n${validEntries.join('\n\n---\n\n')}\n`;
}

// ============================================================================
// PEER BENCHMARK BLOCK — injects sector comparables for relative valuation
// ============================================================================

function buildPeerBenchmarkBlock(
    peers: PeerBenchmark[] | undefined,
    language: Language
): string {
    if (!peers || peers.length === 0) return '';

    const isID = language === 'id';
    const header = isID
        ? 'KOMPARASI PEER SEKTORAL (gunakan sebagai benchmark valuasi relatif):'
        : 'SECTOR PEER COMPARABLES (use as relative valuation benchmarks):';

    const rows = peers
        .map(
            (p) =>
                `| ${p.name} | ${p.peRatio ?? 'N/A'} | ${p.evEbitda ?? 'N/A'} | ${p.revenueGrowthYoy != null ? p.revenueGrowthYoy + '%' : 'N/A'} | ${p.netMargin != null ? p.netMargin + '%' : 'N/A'} | ${p.marketCap ?? 'N/A'} |`
        )
        .join('\n');

    const tableHeader = isID
        ? `| Peer | P/E | EV/EBITDA | Pertumbuhan Pendapatan YoY | Net Margin | Market Cap |
|------|-----|-----------|----------------------------|------------|------------|`
        : `| Peer | P/E | EV/EBITDA | Revenue Growth YoY | Net Margin | Market Cap |
|------|-----|-----------|-------------------|------------|------------|`;

    return `\n${header}\n${tableHeader}\n${rows}\n`;
}

// ============================================================================
// KPI WEIGHT TABLE BUILDER — generates dynamic table based on sector
// ============================================================================

function buildKPIWeightTable(
    symbols: string[],
    sector: SectorKey,
    language: Language
): string {
    const w = KPI_WEIGHT_MATRIX[sector] ?? KPI_WEIGHT_MATRIX.default;
    const isID = language === 'id';

    const scoreLabel = isID ? 'Skor' : 'Score';
    const winnerLabel = isID ? 'Pemenang' : 'Winner';
    const weightLabel = isID ? 'Bobot' : 'Weight';

    const scoreHeaders = symbols.map((s) => `${s} ${scoreLabel}`).join(' | ');
    const scoreDividers = symbols.map(() => '------').join('|');

    const kpiRows = [
        [isID ? 'Pertumbuhan Pendapatan (CAGR 3th)' : 'Revenue Growth (3Y CAGR)', `${w.revenueGrowth}%`],
        [isID ? 'Kualitas Margin Laba' : 'Profit Margin Quality', `${w.profitMarginQuality}%`],
        [isID ? 'ROE / ROIC' : 'ROE / ROIC', `${w.roeRoic}%`],
        [isID ? 'Kekuatan Neraca' : 'Balance Sheet Strength', `${w.balanceSheetStrength}%`],
        [isID ? 'Pembuatan Arus Kas Bebas' : 'Free Cash Flow Generation', `${w.fcfGeneration}%`],
        [isID ? 'Daya Tarik Valuasi' : 'Valuation Attractiveness', `${w.valuationAttractiveness}%`],
        [isID ? 'Kekuatan Competitive Moat' : 'Competitive Moat Strength', `${w.competitiveMoat}%`],
        [isID ? 'Kualitas Manajemen' : 'Management Quality', `${w.managementQuality}%`],
        [isID ? 'Skor ESG' : 'ESG Score', `${w.esgScore}%`],
        [isID ? 'Momentum Teknikal' : 'Technical Momentum', `${w.technicalMomentum}%`],
        [isID ? 'Posisi Pasar' : 'Market Position', `${w.marketPosition}%`],
        [isID ? 'Risiko Hukum & Regulasi' : 'Legal & Regulatory Risk', `${w.legalRegulatoryRisk}%`],
        [isID ? 'Kebijakan Dividen' : 'Dividend Policy', `${w.dividendPolicy}%`],
        [isID ? 'Pipeline Inovasi' : 'Innovation Pipeline', `${w.innovationPipeline}%`],
        [isID ? 'Aktivitas Orang Dalam' : 'Insider Activity', `${w.insiderActivity}%`],
        [isID ? 'Konsensus Analis' : 'Analyst Consensus', `${w.analystConsensus}%`],
        [isID ? 'Sentimen Berita' : 'News Sentiment', `${w.newsSentiment}%`],
        [isID ? 'Likuiditas & Tradabilitas' : 'Liquidity & Tradability', `${w.liquidityTradability}%`],
        [isID ? 'Angin Sektor' : 'Sector Tailwinds', `${w.sectorTailwinds}%`],
        [isID ? 'Tata Kelola Perusahaan' : 'Corporate Governance', `${w.corporateGovernance}%`],
    ];

    const totalWeight = Object.values(w).reduce((a, b) => a + b, 0);
    const emptyScores = symbols.map(() => '').join(' | ');

    const rows = kpiRows
        .map(([kpi, weight]) => `| ${kpi} | ${weight} | ${emptyScores} | |`)
        .join('\n');

    const totalRow = `| **TOTAL** | **${totalWeight}%** | ${emptyScores} | |`;

    return `| KPI | ${weightLabel} | ${scoreHeaders} | ${winnerLabel} |
|-----|--------|${scoreDividers}|--------|
${rows}
${totalRow}`;
}

// ============================================================================
// STAGE INSTRUCTION BUILDERS
// ============================================================================

function buildStage0Instruction(symbols: string[], language: Language): string {
    const isID = language === 'id';
    const symbolList = symbols.join(' vs ');

    return isID
        ? `Lakukan audit kelengkapan data untuk laporan perbandingan ${symbolList}.

### Inventaris Data per Perusahaan
Untuk setiap simbol, buat tabel yang menunjukkan status setiap field data kunci:
- ✓ Tersedia dan terpercaya
- ⚠️ Tersedia namun tidak lengkap/tidak pasti  
- ✗ Tidak tersedia

### Penilaian Dampak Kesenjangan Data
Untuk setiap field yang hilang, nilai: apakah ini akan secara material mempengaruhi analisis? Stage mana yang paling terdampak?

### Peringkat Kepercayaan Per Perusahaan
Beri skor kepercayaan keseluruhan data: TINGGI / SEDANG / RENDAH, dengan justifikasi satu kalimat.

### Rekomendasi Pra-Analisis
Adakah peringatan khusus yang harus diperhatikan analis sebelum membaca laporan penuh?`
        : `Conduct a data completeness audit for the ${symbolList} comparative report.

### Data Inventory per Company
For each symbol, produce a table showing the status of every key data field:
- ✓ Available and reliable
- ⚠️ Available but incomplete or uncertain
- ✗ Not available

### Data Gap Impact Assessment
For each missing field, assess: will this materially impair the analysis? Which stages are most affected?

### Per-Company Data Confidence Rating
Assign an overall data confidence score: HIGH / MEDIUM / LOW, with one-sentence justification.

### Pre-Analysis Recommendations
Are there specific caveats the analyst should bear in mind before reading the full report?`;
}

function buildStage8Instruction(symbols: string[], language: Language): string {
    const isID = language === 'id';
    const symbolList = symbols.join(' vs ');

    return isID
        ? `Susun one-pager institusional untuk ${symbolList} yang menyuling semua 7 stage analisis.

### Snapshot Perusahaan (3 kalimat per perusahaan)
Esensi model bisnis, posisi kompetitif, dan kondisi saat ini dalam 3 kalimat padat.

### Matriks Rekomendasi Final

| Metrik | ${symbols[0]} | ${symbols[1] ?? 'Perusahaan B'} |
|--------|--------------|--------------|
| Rating | | |
| Target Harga 12 Bulan | | |
| Harga Saat Ini | | |
| Potensi Imbal Hasil | | |
| Profil Risiko | | |
| Kesesuaian Investor | | |
| Skor Kepercayaan | | |

### Tiga Pendorong Keyakinan Utama (per perusahaan)
Faktor fundamental, teknikal, atau katalitik yang paling mendukung rekomendasi.

### Bendera Risiko Teratas (maks. 2 per perusahaan)
Risiko spesifik yang dapat membatalkan tesis investasi.

### Putusan Komparatif Akhir
Satu paragraf definitif: perusahaan mana yang mewakili investasi superior pada harga saat ini, dalam kondisi apa tesis dapat berubah, dan timeframe keyakinan.`
        : `Compose an institutional one-pager for ${symbolList} distilling all 7 stages of analysis.

### Company Snapshot (3 sentences per company)
The essence of the business model, competitive position, and current condition in 3 tight sentences.

### Final Recommendation Matrix

| Metric | ${symbols[0]} | ${symbols[1] ?? 'Company B'} |
|--------|--------------|--------------|
| Rating | | |
| 12-Month Price Target | | |
| Current Price | | |
| Implied Return Potential | | |
| Risk Profile | | |
| Investor Suitability | | |
| Conviction Score | | |

### Top 3 Conviction Drivers (per company)
The fundamental, technical, or catalytic factors most supporting the recommendation.

### Top Risk Flags (max 2 per company)
Specific risks that could invalidate the investment thesis.

### Definitive Comparative Verdict
One decisive paragraph: which company represents the superior investment at current prices, under what conditions the thesis would change, and conviction timeframe.`;
}

// ============================================================================
// STAGE INSTRUCTIONS MAP
// ============================================================================

function buildStageInstruction(
    stage: number,
    symbols: string[],
    language: Language,
    sector: SectorKey
): string {
    const isID = language === 'id';
    const symbolList = symbols.join(', ');

    const instructions: Record<number, string> = {
        1: isID
            ? `Produksi Ringkasan Eksekutif komprehensif yang membandingkan ${symbolList}.

### 1.1 Profil Perusahaan & Ikhtisar Model Bisnis
Untuk setiap perusahaan, detailkan: segmen bisnis inti dan kontribusi pendapatan per segmen (%), model monetisasi, eksposur geografis, dan keunggulan kompetitif utama. Sertakan konteks historis dari ringkasan Wikipedia. Nilai ketahanan model bisnis terhadap disrupsi teknologi, siklus ekonomi, dan tekanan regulasi.

### 1.2 Positioning Industri & Lanskap Kompetitif (Porter's Five Forces)
Petakan kedua perusahaan dalam lanskap kompetitif. Siapa yang memegang posisi pasar dominan? Untuk setiap perusahaan, terapkan Porter's Five Forces secara eksplisit: (1) Ancaman pendatang baru, (2) Kekuatan pemasok, (3) Kekuatan pembeli, (4) Ancaman produk substitusi, (5) Rivalitas kompetitif. Nyatakan intensitas setiap kekuatan (Rendah/Sedang/Tinggi) dan implikasinya.

### 1.3 Analisis SWOT Berdampingan
Sajikan tabel SWOT terstruktur untuk setiap perusahaan, lalu identifikasi 3 pertukaran (tradeoff) SWOT komparatif yang paling signifikan antar keduanya.

### 1.4 Lintasan & Kredibilitas Strategis
Apa strategi yang dinyatakan masing-masing perusahaan (panduan manajemen, laporan tahunan)? Nilai kredibilitas strategis: apakah sumber daya keuangan mendukung ambisi yang dinyatakan? Apakah eksekusi historis selaras dengan strategi yang dikomunikasikan?

### 1.5 Keunggulan Kompetitif (Moat Analysis)
Identifikasi dan nilai lebar competitive moat setiap perusahaan: switching costs, network effects, cost advantages, intangible assets (merek, paten, lisensi), atau efficient scale. Beri rating moat: Lebar / Sedang / Sempit / Tidak Ada.

### 1.6 Putusan Ringkasan Eksekutif
Nyatakan dengan tegas perusahaan mana yang menyajikan tesis investasi lebih unggul pada tahap ini. Sertakan rasional 3 poin spesifik. Jadilah decisif.`
            : `Produce a comprehensive Executive Summary comparing ${symbolList}.

### 1.1 Company Profiles & Business Model Overview
For each company, detail: core business segments with revenue contribution per segment (%), monetization model, geographic exposure, and key competitive moats. Incorporate historical context from Wikipedia summaries. Assess business model resilience against technological disruption, economic cycles, and regulatory pressure.

### 1.2 Industry Positioning & Competitive Landscape (Porter's Five Forces)
Map both companies on the competitive landscape. Who holds the dominant market position? For each company, explicitly apply Porter's Five Forces: (1) Threat of new entrants, (2) Supplier power, (3) Buyer power, (4) Threat of substitutes, (5) Competitive rivalry. State the intensity of each force (Low/Medium/High) and its implications.

### 1.3 SWOT Analysis — Side-by-Side
Present a structured SWOT table for each company, then identify the 3 most significant comparative SWOT tradeoffs between the two.

### 1.4 Strategic Trajectory & Credibility
What is each company's stated strategy (management guidance, annual reports)? Assess strategic credibility: do financial resources support the stated ambition? Does historical execution align with communicated strategy?

### 1.5 Competitive Moat Analysis
Identify and rate the width of each company's competitive moat: switching costs, network effects, cost advantages, intangible assets (brands, patents, licenses), or efficient scale. Assign a moat rating: Wide / Moderate / Narrow / None.

### 1.6 Executive Summary Verdict
State decisively which company presents a superior investment thesis at this stage. Include a 3-point specific rationale. Be decisive.`,

        2: isID
            ? `Lakukan analisis teknikal institusional yang ketat untuk ${symbolList}.

### 2.1 Struktur Pasar & Analisis Tren (Multi-Timeframe)
Analisis tren yang berlaku pada timeframe Daily, Weekly, dan Monthly untuk setiap perusahaan. Identifikasi fase siklus Wyckoff saat ini (Accumulation/Markup/Distribution/Markdown). Tentukan struktur pasar: Higher Highs/Higher Lows vs Lower Highs/Lower Lows. Identifikasi swing highs dan swing lows struktural kunci dengan level harga spesifik.

### 2.2 Indikator Momentum & Sinyal Divergensi
Sajikan tabel perbandingan pembacaan RSI(14), MACD (line vs signal vs histogram), dan Stochastic(14,3,3) untuk kedua perusahaan. Deteksi divergensi momentum bullish atau bearish dari tren harga — ini adalah sinyal kelas A. Nilai kekuatan momentum: apakah menguat atau melemah?

### 2.3 Analisis Moving Average & Konfigurasi Cross

| Indikator | ${symbols[0]} | ${symbols[1] ?? 'Perusahaan B'} | Sinyal |
|-----------|--------------|--------------|--------|
| Harga vs SMA20 | | | |
| Harga vs SMA50 | | | |
| Harga vs SMA200 | | | |
| SMA20 vs SMA50 | | | |
| SMA50 vs SMA200 | | | |
| Golden/Death Cross | | | |

### 2.4 Arsitektur Support/Resistance & Level Fibonacci
Petakan level Fibonacci retracement kritis (38.2%, 50%, 61.8%) dari swing high/low terbaru yang signifikan. Identifikasi zona supply dan demand utama. Nilai mana yang memiliki ruang teknikal lebih untuk naik sebelum mencapai resistance kuat berikutnya.

### 2.5 Volatilitas, Beta & Risk-Adjusted Potential
Bandingkan ATR (Average True Range) dan Beta pasar. Hitung estimasi reward-to-risk ratio untuk setiap perusahaan berdasarkan setup teknikal saat ini. Perusahaan mana yang menawarkan potensi imbal hasil disesuaikan risiko lebih baik?

### 2.6 Volume Analysis & Order Flow
Apakah volume mengkonfirmasi pergerakan harga? Identifikasi volume anomaly, selling/buying climax, atau tanda-tanda distribusi/akumulasi institusional.

### 2.7 Putusan Teknikal
Nyatakan dengan tegas perusahaan mana yang menunjukkan setup teknikal superior untuk entry, termasuk: zona entry ideal (harga spesifik), target harga tahap 1 dan tahap 2, level stop-loss berdasarkan struktur, dan probabilitas arah estimasi.`
            : `Conduct a rigorous institutional technical analysis for ${symbolList}.

### 2.1 Market Structure & Trend Analysis (Multi-Timeframe)
Analyze the prevailing trend on Daily, Weekly, and Monthly timeframes for each company. Identify the current Wyckoff cycle phase (Accumulation/Markup/Distribution/Markdown). Determine market structure: Higher Highs/Higher Lows vs Lower Highs/Lower Lows. Identify key structural swing highs and swing lows with specific price levels.

### 2.2 Momentum Indicators & Divergence Signals
Present a comparison table of RSI(14), MACD (line vs signal vs histogram), and Stochastic(14,3,3) readings for both companies. Detect any bullish or bearish momentum divergence from price trend — these are Class A signals. Assess momentum strength: is it accelerating or decelerating?

### 2.3 Moving Average Analysis & Cross Configurations

| Indicator | ${symbols[0]} | ${symbols[1] ?? 'Company B'} | Signal |
|-----------|--------------|--------------|--------|
| Price vs SMA20 | | | |
| Price vs SMA50 | | | |
| Price vs SMA200 | | | |
| SMA20 vs SMA50 | | | |
| SMA50 vs SMA200 | | | |
| Golden/Death Cross | | | |

### 2.4 Support/Resistance Architecture & Fibonacci Levels
Map critical Fibonacci retracement levels (38.2%, 50%, 61.8%) from the most recent significant swing high/low. Identify key supply and demand zones. Assess which has more technical room to run before hitting strong resistance.

### 2.5 Volatility, Beta & Risk-Adjusted Potential
Compare ATR (Average True Range) and market Beta. Calculate estimated reward-to-risk ratio for each company based on current technical setup. Which offers better risk-adjusted return potential?

### 2.6 Volume Analysis & Order Flow
Is volume confirming price movement? Identify volume anomalies, selling/buying climaxes, or signs of institutional distribution/accumulation.

### 2.7 Technical Verdict
Declare decisively which company shows a technically superior setup for entry, including: ideal entry zone (specific price), Phase 1 and Phase 2 price targets, structure-based stop-loss level, and estimated directional probability.`,

        3: isID
            ? `Lakukan analisis fundamental tingkat institusional untuk ${symbolList}.

### 3.1 Perbandingan Kelipatan Valuasi

| Metrik Valuasi | ${symbols[0]} | ${symbols[1] ?? 'Perusahaan B'} | Rata-rata Sektor | Pemenang |
|----------------|--------------|--------------|-----------------|---------|
| P/E Trailing | | | | |
| P/E Forward | | | | |
| PEG Ratio | | | | |
| P/B | | | | |
| EV/EBITDA | | | | |
| EV/Revenue | | | | |
| P/FCF | | | | |
| Dividend Yield | | | | |

Apakah masing-masing diperdagangkan pada premium atau diskon vs peer? Apakah premium/diskon terjustifikasi?

### 3.2 Profitabilitas & Efisiensi — DuPont Decomposition
Bandingkan Gross Margin, Operating Margin, EBITDA Margin, Net Margin. Dekomposisi ROE dengan DuPont (Net Margin × Asset Turnover × Equity Multiplier). Bandingkan ROIC vs WACC — hanya perusahaan yang ROIC > WACC yang secara genuinly menciptakan nilai pemegang saham. Analisis tren marginal: apakah profitabilitas berkembang atau menyusut?

### 3.3 Kualitas Pendapatan & Analisis Pertumbuhan
Hitung CAGR pendapatan 1Y, 3Y, dan 5Y. Nilai apakah pertumbuhan bersifat organik atau didorong akuisisi, berulang atau berbasis proyek. Analisis konsistensi pertumbuhan — berapa deviasi standar pertumbuhan pendapatan? Perusahaan mana yang memiliki pertumbuhan yang lebih dapat diprediksi?

### 3.4 Ketahanan Neraca & Analisis Leverage
Bandingkan Debt/Equity, Net Debt/EBITDA, Interest Coverage, Current Ratio, Quick Ratio, dan posisi kas bersih. Lakukan stress test: jika EBITDA turun 30%, perusahaan mana yang masih bisa melayani utangnya? Identifikasi maturity wall hutang yang material.

### 3.5 Kualitas & Persistensi FCF
Bandingkan FCF (Operating CF − Capex), FCF Yield, dan rasio konversi FCF-to-Net Income. FCF yield > 5% umumnya menarik. Apakah FCF lebih tinggi atau lebih rendah dari net income secara konsisten? Kualitas accruals — apakah earnings bersih dari manipulasi akuntansi?

### 3.6 Penilaian Alokasi Modal
Bagaimana manajemen mengalokasikan FCF? Skor alokasi modal: apakah buyback dilakukan pada harga yang menarik? Apakah dividen berkelanjutan? Apakah M&A menciptakan atau menghancurkan nilai (analisis track record akuisisi)?

### 3.7 Estimasi Nilai Intrinsik
Berikan estimasi kisaran nilai intrinsik untuk setiap perusahaan berdasarkan: (1) EV/EBITDA relatif vs peer, (2) FCF Yield implied valuation, (3) Price-to-Book justified. Nyatakan premium atau diskon saat ini vs nilai intrinsik estimasi.

### 3.8 Putusan Fundamental
Berdasarkan valuasi dan kualitas keuangan, nyatakan dengan tegas perusahaan mana yang merupakan investasi superior dari sisi fundamental.`
            : `Conduct institutional-grade fundamental analysis comparing ${symbolList}.

### 3.1 Valuation Multiples Comparison

| Valuation Metric | ${symbols[0]} | ${symbols[1] ?? 'Company B'} | Sector Median | Winner |
|-----------------|--------------|--------------|--------------|--------|
| P/E Trailing | | | | |
| P/E Forward | | | | |
| PEG Ratio | | | | |
| P/B | | | | |
| EV/EBITDA | | | | |
| EV/Revenue | | | | |
| P/FCF | | | | |
| Dividend Yield | | | | |

Is each trading at a premium or discount to peers? Is the premium/discount justified?

### 3.2 Profitability & Efficiency — DuPont Decomposition
Compare Gross Margin, Operating Margin, EBITDA Margin, Net Margin. Decompose ROE using DuPont (Net Margin × Asset Turnover × Equity Multiplier). Compare ROIC vs WACC — only companies where ROIC > WACC are genuinely creating shareholder value. Analyze margin trajectory: is profitability expanding or contracting?

### 3.3 Revenue Quality & Growth Analysis
Calculate 1Y, 3Y, and 5Y revenue CAGR. Assess whether growth is organic or acquisition-driven, recurring or project-based. Analyze growth consistency — what is the standard deviation of revenue growth? Which company has more predictable growth?

### 3.4 Balance Sheet Fortitude & Leverage Analysis
Compare Debt/Equity, Net Debt/EBITDA, Interest Coverage, Current Ratio, Quick Ratio, and net cash position. Stress test: if EBITDA falls 30%, which company can still service its debt? Identify any material debt maturity walls.

### 3.5 FCF Quality & Persistence
Compare FCF (Operating CF − Capex), FCF Yield, and FCF-to-Net Income conversion ratio. FCF yield >5% is generally attractive. Is FCF consistently above or below net income? Accruals quality — is earnings free from accounting manipulation?

### 3.6 Capital Allocation Assessment
How does management deploy FCF? Score capital allocation: are buybacks done at attractive prices? Are dividends sustainable? Does M&A create or destroy value (analyze acquisition track record)?

### 3.7 Intrinsic Value Estimation
Provide intrinsic value range estimates for each company based on: (1) EV/EBITDA relative to peers, (2) FCF Yield implied valuation, (3) Justified Price-to-Book. State current premium or discount to estimated intrinsic value.

### 3.8 Fundamental Verdict
Based on valuation and financial quality, state decisively which company is the superior investment from a fundamental standpoint.`,

        4: isID
            ? `Produksi scorecard institusional definitif untuk ${symbolList} di sektor ${sector.replace('_', ' ')}.

### 4.1 Metodologi Penilaian
Jelaskan secara singkat bagaimana bobot KPI dikalibrasi untuk sektor ${sector.replace('_', ' ')}. Mengapa faktor tertentu diberi bobot lebih tinggi di sektor ini?

### 4.2 Matriks Penilaian KPI Komprehensif
Skor setiap perusahaan di semua 20 KPI pada skala 1–10. Untuk setiap baris, WAJIB sertakan justifikasi skor singkat berbasis data (bukan opini) di kolom tambahan:

${buildKPIWeightTable(symbols, sector, language)}

**Catatan penilaian:** 1–3 = Lemah · 4–5 = Di bawah rata-rata · 6–7 = Di atas rata-rata · 8–9 = Kuat · 10 = Best-in-class

### 4.3 Skor Akhir Tertimbang & Sensitivitas
Hitung skor tertimbang akhir untuk setiap perusahaan. Lakukan analisis sensitivitas: jika bobot 3 KPI teratas berubah ±2%, apakah pemenang berubah? Ini menguji kekokohan kesimpulan.

### 4.4 Tiga Diferensiator Utama
Apa 3 faktor paling kritis yang memisahkan perusahaan-perusahaan ini? Seberapa material perbedaannya?

### 4.5 Putusan Scorecard
Nyatakan pemenang keseluruhan. Apakah kemenangan ini meyakinkan (margin >10 poin) atau tipis (margin <5 poin)? Implikasi apa untuk keyakinan investasi?`
            : `Produce the definitive institutional scorecard for ${symbolList} in the ${sector.replace('_', ' ')} sector.

### 4.1 Scoring Methodology
Briefly explain how the KPI weights are calibrated for the ${sector.replace('_', ' ')} sector. Why are certain factors weighted more heavily in this sector?

### 4.2 Comprehensive KPI Scoring Matrix
Score each company across all 20 KPIs on a 1–10 scale. For each row, MUST include a brief data-driven (not opinion-based) score justification:

${buildKPIWeightTable(symbols, sector, language)}

**Scoring guide:** 1–3 = Weak · 4–5 = Below average · 6–7 = Above average · 8–9 = Strong · 10 = Best-in-class

### 4.3 Weighted Final Score & Sensitivity Analysis
Calculate the final weighted score for each company. Perform sensitivity analysis: if the top 3 KPI weights shift by ±2%, does the winner change? This tests the robustness of the conclusion.

### 4.4 Top 3 Key Differentiators
What are the 3 most critical factors separating these companies? How material is the difference?

### 4.5 Scorecard Verdict
Declare the overall winner. Is this win convincing (>10 point margin) or marginal (<5 point margin)? What does this imply for investment conviction?`,

        5: isID
            ? `Analisis sinyal berita dan intelijen sentimen untuk ${symbolList}.

### 5.1 Sinyal Makroekonomi & Regulasi
Perkembangan makro atau regulasi apa yang baru-baru ini mempengaruhi setiap perusahaan? Nilai dampak: (POSITIF / NETRAL / NEGATIF) dengan reasoning. Perusahaan mana yang menghadapi hambatan regulasi lebih besar? Apakah ada pendekatan regulasi yang akan datang?

### 5.2 Analisis Kejutan Pendapatan & Katalis Pendapatan
Apa kejutan pendapatan terbaru vs konsensus (beat/miss berapa %)? Apakah panduan manajemen dinaikkan, diturunkan, atau dipertahankan? Apakah pasar sedang merevaluasi (re-rating) salah satu perusahaan berdasarkan informasi baru?

### 5.3 Proyek Strategis & Ekspansi Masa Depan
Analisis data "projectNews" secara mendalam. Untuk setiap proyek atau inisiatif yang disebutkan: nilai total nilai proyek (jika diketahui), timeline eksekusi, risiko eksekusi, dan dampak potensial terhadap pendapatan masa depan. Mana yang memiliki pipeline ekspansi lebih meyakinkan?

### 5.4 Aksi Korporasi Strategis
Adakah aktivitas M&A, kemitraan strategis, penggalangan modal, atau divestasi? Nilai kebijaksanaan strategis: apakah harga yang dibayar wajar? Apakah ini value-accretive atau dilutive? Apakah ini mengindikasikan kekuatan atau kelemahan posisi?

### 5.5 Deteksi Divergensi Sentimen
Bandingkan sentimen pasar saat ini dengan nilai fundamental yang dinilai di stage 3. Adakah divergensi bermakna? Divergensi positif (sentimen lebih negatif dari fundamental) = potensi peluang alfa. Divergensi negatif (sentimen lebih positif dari fundamental) = potensi overvaluation.

### 5.6 Analisis Arus Berita Sektoral
Tren industri apa yang terlihat dalam data berita? Mana yang lebih baik diposisikan untuk memanfaatkan angin sektor ini?

### 5.7 Putusan Intelijen Berita
Beri rating sentimen berita untuk setiap perusahaan: SANGAT POSITIF / POSITIF / CAMPURAN / NEGATIF / SANGAT NEGATIF. Nyatakan perusahaan mana yang memiliki momentum narasi superior dan mengapa.`
            : `Analyze news signals and sentiment intelligence for ${symbolList}.

### 5.1 Macro & Regulatory News Signals
What macro or regulatory developments have recently affected each company? Rate the impact: (POSITIVE / NEUTRAL / NEGATIVE) with reasoning. Which company faces greater regulatory headwinds? Is any regulatory crackdown approaching?

### 5.2 Earnings Surprise & Revenue Catalyst Analysis
What is the latest earnings surprise vs consensus (beat/miss by what %)? Did management raise, lower, or maintain guidance? Is the market re-rating either company based on new information?

### 5.3 Strategic Projects & Future Expansion
Analyze "projectNews" data in depth. For each project or initiative mentioned: assess total project value (if known), execution timeline, execution risk, and potential impact on future revenue. Which has the more compelling expansion pipeline?

### 5.4 Strategic Corporate Actions
Any M&A activity, strategic partnerships, capital raises, or divestitures? Assess strategic wisdom: is the price paid fair? Is this value-accretive or dilutive? Does it signal strength or weakness of position?

### 5.5 Sentiment Divergence Detection
Compare current market sentiment to the fundamental value assessed in Stage 3. Is there a meaningful divergence? Positive divergence (sentiment more negative than fundamentals) = potential alpha opportunity. Negative divergence (sentiment more positive than fundamentals) = potential overvaluation.

### 5.6 Sector Newsflow Analysis
What industry-wide trends are evident in the news data? Which is better positioned to capitalize on sector tailwinds?

### 5.7 News Intelligence Verdict
Assign a news sentiment rating for each company: STRONGLY POSITIVE / POSITIVE / MIXED / NEGATIVE / STRONGLY NEGATIVE. State which company has superior narrative momentum and why.`,

        6: isID
            ? `Lakukan penilaian intelijen kepemimpinan dan risiko hukum untuk ${symbolList}.

### 6.1 Profil Eksekutif Kunci & Rekam Jejak
Untuk setiap perusahaan, profil CEO, CFO, dan pejabat kunci lainnya dari data "companyOfficers" yang disediakan. Sebutkan nama-nama spesifik. Untuk setiap eksekutif: rekam jejak profesional, keputusan kunci yang dibuat di perusahaan ini, dan track record vs target yang dinyatakan. Hindari generalisasi — gunakan fakta spesifik dari data.

### 6.2 Keandalan Panduan & Kepercayaan Pasar
Eksekutif memiliki sejarah memenuhi atau melampaui panduan? Hitung tingkat akurasi panduan: berapa kali dalam 4 kuartal terakhir hasil aktual melebihi / memenuhi / meleset dari panduan? Adakah kegagalan strategis atau restrukturisasi besar yang merusak kepercayaan investor?

### 6.3 Penilaian Tata Kelola Perusahaan
Evaluasi secara sistematis: independensi dewan (% direktur independen), kualitas komite audit (keahlian anggota), penyelarasan kompensasi eksekutif dengan kinerja jangka panjang (apakah ada cliff vesting?), transaksi pihak berelasi material, dan transparansi pengungkapan (compare vs standar industri).

### 6.4 Eksposur Kasus Hukum & Regulasi
Berdasarkan data "legalNews" yang tersedia, nilai secara kuantitatif: tuntutan hukum yang tertunda (nilai klaim, kemungkinan kekalahan), investigasi regulasi aktif, risiko antimonopoli, liabilitas lingkungan, atau sengketa tenaga kerja besar. Untuk setiap item: kemungkinan risiko (Rendah/Sedang/Tinggi) dan estimasi paparan finansial.

### 6.5 Analisis Risiko Reputasi & ESG
Risiko reputasi apa yang dihadapi setiap perusahaan? Kontroversi ESG, masalah kewajiban produk, pelanggaran data, atau skandal publik? Bagaimana ini mempengaruhi kemampuan menarik modal institusional (banyak LP/SWF memiliki mandat ESG)?

### 6.6 Aktivitas Insider — Tanda Kepercayaan atau Kekhawatiran?
Analisis data transaksi insider: apakah eksekutif membeli atau menjual? Apakah ini terprogram (10b5-1 plans) atau diskresioner? Pembelian diskresioner dalam jumlah besar adalah sinyal kepercayaan manajemen yang kuat.

### 6.7 Putusan Kepemimpinan & Hukum
Skor setiap perusahaan:
- Kualitas Kepemimpinan: X/10 (dengan justifikasi)
- Kualitas Tata Kelola: X/10 (dengan justifikasi)
- Risiko Hukum: Rendah / Sedang / Tinggi (dengan estimasi eksposur finansial)
- Risiko Reputasi: Rendah / Sedang / Tinggi

Perusahaan mana yang menunjukkan tata kelola superior dan risiko lebih rendah?`
            : `Conduct leadership and legal risk intelligence assessment for ${symbolList}.

### 6.1 Key Executive Profiles & Track Record
For each company, profile the CEO, CFO, and other key officers from the provided "companyOfficers" data. Name specific individuals. For each executive: professional background, key decisions made at this company, and track record vs stated targets. Avoid generalization — use specific facts from the data.

### 6.2 Guidance Reliability & Market Trust
Do executives have a history of meeting or beating guidance? Calculate guidance accuracy rate: in the last 4 quarters, how many times did actual results beat / meet / miss guidance? Any strategic failures or major restructurings that damaged investor confidence?

### 6.3 Corporate Governance Assessment
Systematically evaluate: board independence (% independent directors), audit committee quality (member expertise), executive compensation alignment with long-term performance (are there cliff vesting provisions?), material related-party transactions, and disclosure transparency (compare to industry standards).

### 6.4 Legal & Regulatory Case Exposure
Based on available "legalNews" data, quantitatively assess: pending lawsuits (claim value, probability of loss), active regulatory investigations, antitrust risk, environmental liabilities, or major labor disputes. For each item: risk likelihood (Low/Medium/High) and estimated financial exposure.

### 6.5 Reputational Risk & ESG Analysis
What reputational risks does each company face? ESG controversies, product liability issues, data breaches, or public scandals? How does this affect the ability to attract institutional capital (many LPs/SWFs have ESG mandates)?

### 6.6 Insider Activity — Confidence Signal or Concern?
Analyze insider transaction data: are executives buying or selling? Are these programmatic (10b5-1 plans) or discretionary? Large discretionary purchases are a strong management confidence signal.

### 6.7 Leadership & Legal Verdict
Score each company:
- Leadership Quality: X/10 (with justification)
- Governance Quality: X/10 (with justification)
- Legal Risk: Low / Medium / High (with estimated financial exposure)
- Reputational Risk: Low / Medium / High

Which company demonstrates superior governance and lower overall risk?`,

        7: isID
            ? `Produksi analisis penutup definitif dan rekomendasi investasi untuk ${symbolList}.

### 7.1 Penilaian Materialitas ESG (Framework MSCI)
Untuk setiap perusahaan, identifikasi 3–5 faktor ESG material teratas yang relevan dengan industrinya (merujuk pada SASB Materiality Map untuk sektor ${sector.replace('_', ' ')}). Skor setiap perusahaan pada dimensi E (Lingkungan), S (Sosial), dan G (Tata Kelola) pada skala 1–10. Nilai lintasan ESG: Membaik / Stabil / Memburuk. Apakah profil ESG masing-masing menciptakan atau menghancurkan nilai jangka panjang?

### 7.2 Target Harga 12-Bulan & Analisis Skenario

Untuk **${symbols[0]}**:
- **Base Case (60%):** Asumsi kunci, target harga [X], imbal hasil tersirat [Y%]
- **Bull Case (25%):** Katalis kritis, target harga [X+Z], imbal hasil tersirat [Y+A%]
- **Bear Case (15%):** Risiko kritis, target harga [X−W], downside tersirat [Y−B%]

Untuk **${symbols[1] ?? 'Perusahaan B'}**:
- **Base Case (60%):** Asumsi kunci, target harga [X], imbal hasil tersirat [Y%]
- **Bull Case (25%):** Katalis kritis, target harga [X+Z], imbal hasil tersirat [Y+A%]
- **Bear Case (15%):** Risiko kritis, target harga [X−W], downside tersirat [Y−B%]

### 7.3 Lima Katalis Utama (Cakrawala 12 Bulan)
Daftar 5 katalis teratas per perusahaan yang dapat menggerakkan saham secara material ke kedua arah: earnings, regulasi, M&A, inovasi produk, perubahan makro. Nilai probabilitas dan besaran dampak setiap katalis.

### 7.4 Matriks Risiko Komprehensif

| Kategori Risiko | ${symbols[0]} Prob. | ${symbols[0]} Severity | ${symbols[1] ?? 'Perusahaan B'} Prob. | ${symbols[1] ?? 'Perusahaan B'} Severity |
|----------------|---------------------|----------------------|--------------------------------------|------------------------------------------|
| Risiko Pasar | | | | |
| Risiko Operasional | | | | |
| Risiko Regulasi | | | | |
| Risiko ESG | | | | |
| Risiko Keuangan | | | | |
| Risiko Kompetitif | | | | |

Prob: Rendah/Sedang/Tinggi · Severity: Minor/Moderat/Kritis

### 7.5 REKOMENDASI INVESTASI FINAL

| Parameter | ${symbols[0]} | ${symbols[1] ?? 'Perusahaan B'} |
|-----------|--------------|--------------|
| Rating | | |
| Target Harga 12 Bulan | | |
| Harga Saat Ini | | |
| Potensi Imbal Hasil | | |
| Profil Risiko | | |
| Kesesuaian | | |
| Keyakinan | | |

**Rating scale:** Strong Buy · Buy · Accumulate · Hold · Reduce · Sell · Strong Sell

### 7.6 Kesimpulan Komparatif Investasi
Perusahaan mana yang mewakili investasi superior pada harga saat ini? Sintesis temuan dari semua 7 stage analisis ini menjadi thesis 3-paragraf. Di kondisi apa rekomendasi akan berubah? Apa trigger harga atau peristiwa yang akan menyebabkan downgrade atau upgrade?`
            : `Produce the definitive closing analysis and investment recommendation for ${symbolList}.

### 7.1 ESG Materiality Assessment (MSCI Framework)
For each company, identify the top 3–5 material ESG factors relevant to their industry (reference SASB Materiality Map for the ${sector.replace('_', ' ')} sector). Score each company on E (Environmental), S (Social), and G (Governance) dimensions on a 1–10 scale. Assess ESG trajectory: Improving / Stable / Deteriorating. Does each company's ESG profile create or destroy long-term value?

### 7.2 12-Month Price Target & Scenario Analysis

For **${symbols[0]}**:
- **Base Case (60%):** Key assumptions, target price [X], implied return [Y%]
- **Bull Case (25%):** Key catalysts, target price [X+Z], implied return [Y+A%]
- **Bear Case (15%):** Key risks, target price [X−W], implied downside [Y−B%]

For **${symbols[1] ?? 'Company B'}**:
- **Base Case (60%):** Key assumptions, target price [X], implied return [Y%]
- **Bull Case (25%):** Key catalysts, target price [X+Z], implied return [Y+A%]
- **Bear Case (15%):** Key risks, target price [X−W], implied downside [Y−B%]

### 7.3 Top 5 Catalysts to Watch (12-Month Horizon)
List 5 catalysts per company that could move the stock materially in either direction: earnings, regulation, M&A, product innovation, macro shifts. Assess probability and magnitude of impact for each.

### 7.4 Comprehensive Risk Matrix

| Risk Category | ${symbols[0]} Prob. | ${symbols[0]} Severity | ${symbols[1] ?? 'Company B'} Prob. | ${symbols[1] ?? 'Company B'} Severity |
|--------------|---------------------|----------------------|-------------------------------------|---------------------------------------|
| Market Risk | | | | |
| Operational Risk | | | | |
| Regulatory Risk | | | | |
| ESG Risk | | | | |
| Financial Risk | | | | |
| Competitive Risk | | | | |

Prob: Low/Medium/High · Severity: Minor/Moderate/Critical

### 7.5 FINAL INVESTMENT RECOMMENDATION

| Parameter | ${symbols[0]} | ${symbols[1] ?? 'Company B'} |
|-----------|--------------|--------------|
| Rating | | |
| 12-Month Price Target | | |
| Current Price | | |
| Implied Return | | |
| Risk Profile | | |
| Suitability | | |
| Conviction | | |

**Rating scale:** Strong Buy · Buy · Accumulate · Hold · Reduce · Sell · Strong Sell

### 7.6 Comparative Investment Conclusion
Which company represents the superior investment at current prices? Synthesize findings from all 7 stages into a 3-paragraph thesis. Under what conditions would the recommendation change? What price trigger or event would cause a downgrade or upgrade?`,
    };

    return instructions[stage] ?? '';
}

// ============================================================================
// MAIN EXPORTED FUNCTIONS
// ============================================================================

/**
 * Builds the system-level prompt for a given stage.
 * Each stage gets a different persona optimized for its analytical domain.
 */
/**
 * Master System Prompt for Banking Sector Analysis
 * Prevents hallucination, proxy data, wrong valuation models,
 * and cross-stage contradictions for Indonesian banking stocks.
 */
export const MASTER_SYSTEM_PROMPT = `[SYSTEM INSTRUCTION - WAJIB DITAATI SAMPAI STAGE 8 SELESAI]
Anda adalah Senior Equity Research Analyst bersertifikat CFA Level III yang spesialis menganalisis sektor perbankan Indonesia. Anda sedang menulis laporan komparatif institusional.

LAKUKAN HAL BERIKUT SECARA MUTLAK:
1. TAKSONOMI SEKTOR: BBRI dan BMRI adalah bank umum nasional berstatus SIFI (Systemically Important Financial Institutions). DILARANG KERAS menyebut mereka sebagai "Banks - Regional".
2. ANALISIS ARUS KAS: Untuk bank, Operating Cash Flow (OCF) negatif adalah NORMAL saat Loan Growth tinggi. DILARANG KERAS menggunakan rasio OCF/Net Income untuk menilai "kualitas pendapatan", "akrual", atau "tekanan likuiditas".
3. METODOLOGI VALUASI: DILARANG KERAS menggunakan EV/Revenue (karena Deposit bukanlah utang korporasi). DILARANG KERAS menggunakan model DuPont tradisional (Revenue/Total Assets) jika data Total Assets tidak tersedia. Jika diminta menganalisis DuPont tapi data Total Assets kosong, TULIS: "[DATA TIDAK TERSEDIA]". Valuasi wajib hanya menggunakan P/B adjusted ROE atau Dividend Discount Model.
4. ATURAN KEKOSONGAN DATA (ZERO PROXY): Jika diminta menganalisis indikator (Volume, SMA20, Stochastic, Skor Kepemimpinan) tetapi datanya TIDAK ADA di tabel yang saya berikan, Anda WAJIB menulis '[DATA TIDAK TERSEDIA - TIDAK DAPAT DINILAI]'. DILARANG menggunakan MFI sebagai proxy Volume. DILARANG menggunakan Parabolic SAR sebagai proxy SMA. DILARANG menebak skor 1-10 untuk kualitas direksi jika hanya diberi data nama dan umur.
5. ATURAN ANOMALI (RED FLAG): Jika Anda menemukan anomali data (misal: 1 orang menjabat direksi di 2 bank BUMN kompetitor sekaligus, atau Dividend Yield > 10%), Anda WAJIB menghentikan analisis standar dan menempatkan anomali tersebut sebagai "RED FLAG RISIKO TATA KELOLA" yang wajib dibahas mendalam di bagian risiko. DILARANG MENGABAIKANNYA dengan alasan "kesalahan data".
6. KETEPATAN MATEMATIKA: Hitung semua persentase dan rasio dengan presisi 100%. (Contoh: 453T / 409T = 1.1x, BUKAN 2.2x). Total bobot dalam Scorecard WAJIB tepat 100%, dilarang melebihiinya.
7. GAYA BAHASA: Tulis sesingkat, padat, dan sarat informasi mungkin. HINDARI kalimat meta seperti "Sekarang kita akan menganalisis..." atau "Karena data tidak tersedia, kita akan menggunakan asumsi...". Langsung masuk ke data dan kesimpulan.`;

/** Indonesian banking symbols that trigger the Master System Prompt */
export const BANKING_SYMBOLS = ['BBRI', 'BMRI', 'BBTN', 'BNGA', 'BNII', 'BDMN', 'MEGA', 'PNBN', 'BJBR', 'BJTM', 'BTPN', 'AGRO', 'MAYA', 'NISP', 'SDRA'];

/** Check if any symbol in the list is a banking stock */
export function hasBankingSymbol(symbols: string[]): boolean {
    return symbols.some(s => BANKING_SYMBOLS.includes(s.toUpperCase()));
}

export function buildSystemPrompt(
    language: Language = 'en',
    stage: number = 1,
    symbols: string[] = []
): string {
    const persona = STAGE_PERSONAS[stage]?.[language] ?? STAGE_PERSONAS[1][language];
    const writingStandards = buildWritingStandards(language, stage);
    const isID = language === 'id';

    const disclaimerLine = isID
        ? 'DISCLAIMER: Analisis ini hanya untuk tujuan penelitian institusional. Bukan merupakan saran keuangan yang dipersonalisasi.'
        : 'DISCLAIMER: This analysis is for institutional research purposes only. It does not constitute personalized financial advice.';

    const basePrompt = `${persona}

${writingStandards}

${disclaimerLine}`;

    // Prepend Master System Prompt for banking symbols
    if (hasBankingSymbol(symbols)) {
        return `${MASTER_SYSTEM_PROMPT}\n\n${basePrompt}`;
    }

    return basePrompt;
}

// ============================================================================
// INFRASTRUCTURE PROXIMITY BLOCK — injects nearby infrastructure context
// ============================================================================

function buildInfrastructureContextBlock(
    infrastructure: Record<string, InfrastructureProximity | null> | null | undefined,
    language: Language
): string {
    if (!infrastructure) return '';
    const isID = language === 'id';
    const entries = Object.entries(infrastructure).filter(([_, v]) => v != null) as [string, InfrastructureProximity][];
    if (entries.length === 0) return '';

    const lines: string[] = [];
    lines.push(isID
        ? '\n--- KONTEKS INFRASTRUKTUR DEKAT PERUSAHAAN ---'
        : '\n--- NEARBY INFRASTRUCTURE CONTEXT ---');

    for (const [symbol, data] of entries) {
        if (!data || data.total === 0) continue;
        lines.push(isID
            ? `\n${symbol}: Terdeteksi ${data.total} aset infrastruktur dalam radius 100km.`
            : `\n${symbol}: ${data.total} infrastructure assets detected within 100km radius.`);

        // Top 3 overall nearest
        if (data.nearest && data.nearest.length > 0) {
            const nearestList = data.nearest.slice(0, 3).map(f =>
                `${f.name} (${f.infra_type}, ${Math.round(f.distance)}km)`
            ).join('; ');
            lines.push(isID
                ? `Terdekat: ${nearestList}`
                : `Nearest: ${nearestList}`);
        }

        // Per-type breakdown
        const typeLines: string[] = [];
        for (const [type, facilities] of Object.entries(data.grouped)) {
            if (facilities.length > 0) {
                const names = facilities.map(f => `${f.name} (${f.distance_km}km)`).join(', ');
                const typeLabel = type.replace(/_/g, ' ');
                typeLines.push(`  ${typeLabel}: ${names}`);
            }
        }
        if (typeLines.length > 0) {
            lines.push(isID ? '\nRincian per jenis:' : '\nBreakdown by type:');
            lines.push(...typeLines);
        }
    }

    lines.push(isID
        ? '\n--- GUNALAH DATA INFRASTRUKTUR INI sebagai konteks tambahan ---'
        : '\n--- USE THIS INFRASTRUCTURE DATA as additional context ---');

    return lines.join('\n');
}

/**
 * Builds the full user-turn prompt for a given analysis stage.
 * Includes data slicing, context compression, peer benchmarks, and analyst notes.
 */
export function buildStagePrompt(options: StagePromptOptions): string {
    const {
        stage,
        symbols,
        fullData,
        generatedStages,
        language = 'en',
        sector = 'default',
        analystNotes = {},
        peerBenchmarks,
        currency = 'USD',
        exchange = '',
        infrastructure,
    } = options;

    const isID = language === 'id';
    const langLabel = isID ? 'INDONESIAN' : 'ENGLISH';
    const symbolList = symbols.join(', ');

    // Stage 8 uses no raw data — only compressed verdicts
    const relevantData = stage === 8
        ? {}
        : sliceData(fullData, stage, symbols);

    const previousContext = stage > 1
        ? compressPreviousContext(generatedStages, stage, language)
        : '';

    const dataAvailability = buildDataAvailabilityBlock(fullData, stage, symbols, language);

    const peerBlock = [3, 4, 7].includes(stage)
        ? buildPeerBenchmarkBlock(peerBenchmarks, language)
        : '';

    const analystNote = analystNotes[stage]
        ? `\n${isID ? 'CATATAN ANALIS (perlakukan sebagai konteks kepercayaan tinggi)' : 'ANALYST NOTE (treat as high-confidence context)'}:\n${analystNotes[stage]}\n`
        : '';

    // Stage 0 and 8 use their own specialized instruction builders
    const instruction = stage === 0
        ? buildStage0Instruction(symbols, language)
        : stage === 8
            ? buildStage8Instruction(symbols, language)
            : buildStageInstruction(stage, symbols, language, sector);

    const stageTitles: Record<number, Record<Language, string>> = {
        0: { en: 'DATA QUALITY PRE-CHECK', id: 'PRA-PEMERIKSAAN KUALITAS DATA' },
        1: { en: 'EXECUTIVE SUMMARY & BUSINESS MODEL INTELLIGENCE', id: 'RINGKASAN EKSEKUTIF & INTELIJEN MODEL BISNIS' },
        2: { en: 'TECHNICAL ANALYSIS — COMPARATIVE PRICE ACTION & MOMENTUM', id: 'ANALISIS TEKNIKAL — PRICE ACTION & MOMENTUM KOMPARATIF' },
        3: { en: 'FUNDAMENTAL ANALYSIS — FINANCIAL HEALTH & VALUATION DEEP DIVE', id: 'ANALISIS FUNDAMENTAL — KESEHATAN KEUANGAN & VALUASI' },
        4: { en: 'COMPARATIVE SCORECARD MATRIX — INSTITUTIONAL KPI RANKING', id: 'MATRIKS SCORECARD KOMPARATIF — PERINGKAT KPI INSTITUSIONAL' },
        5: { en: 'NEWS SIGNAL INTELLIGENCE & SENTIMENT DIVERGENCE ANALYSIS', id: 'INTELIJEN SINYAL BERITA & ANALISIS DIVERGENSI SENTIMEN' },
        6: { en: 'LEADERSHIP FOOTPRINT & LEGAL RISK INTELLIGENCE', id: 'JEJAK KEPEMIMPINAN & INTELIJEN RISIKO HUKUM' },
        7: { en: 'ESG ASSESSMENT, 12-MONTH PREDICTION & INVESTMENT DECISION', id: 'PENILAIAN ESG, PREDIKSI 12-BULAN & KEPUTUSAN INVESTASI' },
        8: { en: 'INSTITUTIONAL ONE-PAGER SYNTHESIS', id: 'SINTESIS ONE-PAGER INSTITUSIONAL' },
    };

    const stageTitle = stageTitles[stage]?.[language] ?? `STAGE ${stage}`;
    const totalStages = 9; // 0 through 8

    const metaHeader = isID
        ? `Anda menulis Stage ${stage} dari ${totalStages - 1} untuk laporan analisis komparatif institusional dalam ${langLabel}.

Judul Laporan: "Analisis Komparatif Institusional: ${symbolList}"
Bursa/Pasar: ${exchange || 'N/A'} · Mata Uang: ${currency}
Sektor: ${sector.replace(/_/g, ' ')} · Bobot KPI: Dikalibrasi untuk sektor ini
Stage ${stage}: ${stageTitle}`
        : `You are writing Stage ${stage} of ${totalStages - 1} for an institutional comparative analysis report in ${langLabel}.

Report Title: "Institutional Comparative Analysis: ${symbolList}"
Exchange/Market: ${exchange || 'N/A'} · Currency: ${currency}
Sector: ${sector.replace(/_/g, ' ')} · KPI Weights: Calibrated for this sector
Stage ${stage}: ${stageTitle}`;

    const infraBlock = [1, 2, 3].includes(stage)
        ? buildInfrastructureContextBlock(infrastructure, language)
        : '';

    const sections = [
        metaHeader,
        previousContext ? `\n${previousContext}` : '',
        dataAvailability,
        infraBlock,
        peerBlock,
        analystNote,
        `\nTASK:\n${instruction}`,
        stage !== 8 && Object.keys(relevantData).length > 0
            ? `\n${isID ? 'DATA MENTAH UNTUK ANALISIS' : 'RAW DATA FOR ANALYSIS'} (${isID ? 'hanya field yang relevan untuk stage ini' : 'relevant fields for this stage only'}):\n${JSON.stringify(relevantData, null, 2)}`
            : '',
        `\n${isID ? 'INSTRUKSI PENTING' : 'CRITICAL INSTRUCTIONS'}:
- ${isID ? 'Setiap klaim kuantitatif HARUS mereferensikan data spesifik dari data mentah di atas' : 'Every quantitative claim MUST reference specific data from the raw data above'}
- ${isID ? 'Semua tabel harus dalam format Markdown yang valid' : 'All tables must be in valid Markdown format'}
- ${isID ? 'Jadilah analitik dan decisif — ambil posisi yang jelas dengan justifikasi berbasis data' : 'Be analytical and decisive — take clear positions with data-driven justification'}
- ${isID ? 'Jangan ulangi konten dari stage sebelumnya — bangun di atasnya' : 'Do not repeat content from prior stages — build upon it'}
- ${isID ? 'Tutup stage ini dengan putusan arah yang jelas' : 'Close this stage with a clear directional verdict'}
- ${isID ? 'ZERO PROXY: Jika data bertanda [DATA UNAVAILABLE], tulis "[DATA TIDAK TERSEDIA - TIDAK DAPAT DINILAI]". JANGAN menggunakan proxy indicator. JANGAN menebak skor.' : 'ZERO PROXY: If data is marked [DATA UNAVAILABLE], write "[DATA TIDAK TERSEDIA - TIDAK DAPAT DINILAI]". Do NOT use proxy indicators. Do NOT guess scores.'}
- ${isID ? 'GAYA BAHASA: Langsung ke data dan kesimpulan. HINDARI kalimat meta seperti "Sekarang kita akan menganalisis..."' : 'WRITING STYLE: Go directly to data and conclusions. AVOID meta sentences like "Now we will analyze..."'}
- LANGUAGE: ${langLabel} ONLY`,
    ];

    return sections.filter(Boolean).join('\n');
}

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Returns the optimal data keys to request from your data provider per stage.
 * Use this to pre-fetch only what's needed before calling buildStagePrompt.
 */
export function getRequiredDataKeysForStage(stage: number): string[] {
    return DATA_SLICE_MAP[stage] ?? [];
}

/**
 * Returns the sector-specific KPI weights for transparency and UI display.
 */
export function getKPIWeightsForSector(sector: SectorKey): KPIWeightConfig {
    return KPI_WEIGHT_MATRIX[sector] ?? KPI_WEIGHT_MATRIX.default;
}

/**
 * Validates that all required stage options are present and returns a list
 * of warnings for any potential quality issues before making the API call.
 */
export function validateStageOptions(options: StagePromptOptions): string[] {
    const warnings: string[] = [];
    const { stage, symbols, fullData, sector } = options;

    if (symbols.length < 2) {
        warnings.push('Only one symbol provided — comparative analysis requires at least 2 companies.');
    }

    if (symbols.length > 3) {
        warnings.push('More than 3 symbols may reduce per-company depth. Consider splitting into pairwise reports.');
    }

    if (!sector || sector === 'default') {
        warnings.push('No sector specified — using default KPI weights. For best accuracy, specify the sector.');
    }

    const criticalFields = CRITICAL_FIELDS_PER_STAGE[stage] ?? [];
    for (const sym of symbols) {
        const symData = (fullData[sym] ?? {}) as Record<string, unknown>;
        for (const field of criticalFields) {
            if (!isDataPresent(getNestedValue(symData, field))) {
                warnings.push(`${sym}: Critical field "${field}" is missing for Stage ${stage}. This may cause hallucination.`);
            }
        }
    }

    return warnings;
}

/**
 * Returns all 9 stage numbers in execution order (0–8).
 */
export const ALL_STAGES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * Stage descriptors for UI display
 */
export const STAGE_META = {
    0: { icon: '🔍', isOptional: true },
    1: { icon: '📋', isOptional: false },
    2: { icon: '📈', isOptional: false },
    3: { icon: '💰', isOptional: false },
    4: { icon: '🏆', isOptional: false },
    5: { icon: '📰', isOptional: false },
    6: { icon: '⚖️', isOptional: false },
    7: { icon: '🎯', isOptional: false },
    8: { icon: '📄', isOptional: true },
} as const;