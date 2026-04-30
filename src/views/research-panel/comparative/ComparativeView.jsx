import { createSignal, Show, For } from 'solid-js';
import { useComparativeData } from './hooks/useComparativeData';
import { useAIStream } from './hooks/useAIStream';
import CompanySelector from './components/CompanySelector';
import TechnicalComparePanel from './components/TechnicalComparePanel';
import FundamentalComparePanel from './components/FundamentalComparePanel';
import NewsSignalPanel from './components/NewsSignalPanel';
import LeadershipTrailPanel from './components/LeadershipTrailPanel';
import LegalCasePanel from './components/LegalCasePanel';
import AIAnalysisStream from './components/AIAnalysisStream';
import GlossaryPanel from './components/GlossaryPanel';
import { BarChartPDF, FinancialTablePDF, SparklinePDF } from './components/PDFCharts';

const GET_STAGE_NAMES = (language = 'en') => {
  const isId = language === 'id';
  return {
    1: isId ? 'Ringkasan Eksekutif & Model Bisnis' : 'Executive Summary & Business Model',
    2: isId ? 'Analisis Teknikal' : 'Technical Analysis',
    3: isId ? 'Bedah Fundamental' : 'Fundamental Deep Dive',
    4: isId ? 'Matriks Scorecard Komparatif' : 'Comparative Scorecard',
    5: isId ? 'Intelijen Sinyal Berita' : 'News Signal Intelligence',
    6: isId ? 'Kepemimpinan & Risiko Hukum' : 'Leadership & Legal Risk',
    7: isId ? 'ESG & Keputusan Investasi' : 'ESG Assessment & Investment Decision',
  };
};

const DATA_TABS = [
  { id: 'technical', label: 'Technical Analysis' },
  { id: 'fundamental', label: 'Fundamental' },
  { id: 'news', label: 'News Signals' },
  { id: 'leadership', label: 'Leadership Trail' },
  { id: 'legal', label: 'Legal Exposure' },
];

const REPORT_STYLES = `
  .ai-stage-content { text-transform: none !important; }
  .ai-stage-content h1, .ai-stage-content h2, .ai-stage-content h3, .ai-stage-content h4, .ai-stage-content h5, .ai-stage-content h6 { 
    text-transform: none !important; 
    font-family: 'Roboto', sans-serif;
  }
  .ai-stage-content p, .ai-stage-content li, .ai-stage-content td, .ai-stage-content th { 
    text-transform: none !important; 
  }
  .ai-stage-content h3 { font-size: 1.1rem; font-weight: 800; color: #0369a1; margin-top: 1.5rem; margin-bottom: 0.75rem; }
  .ai-stage-content h4 { font-size: 1rem; font-weight: 700; color: #334155; margin-top: 1.25rem; margin-bottom: 0.5rem; }
  .ai-stage-content p { font-size: 0.9rem; line-height: 1.8; margin-bottom: 1rem; color: #334155; }
  .ai-stage-content ul, .ai-stage-content ol { font-size: 0.9rem; line-height: 1.8; margin-bottom: 1rem; color: #334155; padding-left: 1.5rem; }
  .ai-stage-content li { margin-bottom: 0.4rem; }
  .ai-stage-content strong { color: #0284c7; font-weight: 700; }
  .ai-stage-content table { width: 100%; font-size: 0.82rem; border-collapse: collapse; margin-bottom: 1.5rem; }
  .ai-stage-content th { background: #f8fafc; color: #0f172a; font-weight: 700; padding: 0.6rem 0.75rem; border-bottom: 2px solid #cbd5e1; text-align: left; }
  .ai-stage-content td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #e2e8f0; color: #475569; }
  .ai-stage-content tr:hover td { background: #f8fafc; }
`;

export default function ComparativeView() {
  const RESEARCH_API = import.meta.env.VITE_RESEARCH_API;

  const {
    companies, setCompanies,
    rawData, loading, progress, logs, error,
    gatherAllData, addLog,
  } = useComparativeData();

  const { reports, currentStage, isStreaming, streamProgress, runAnalysis } = useAIStream();

  const [model, setModel] = createSignal('deepseek-v4-flash');
  const [language, setLanguage] = createSignal('en');
  const [activeDataTab, setActiveDataTab] = createSignal('technical');
  const [phase, setPhase] = createSignal('input'); // 'input' | 'data' | 'report'
  const [reportContainerRef, setReportContainerRef] = createSignal(null);

  const activeCompanies = () => {
    const data = rawData();
    return Object.values(data);
  };

  const handleGatherData = async () => {
    const data = await gatherAllData();
    if (data) setPhase('data');
  };

  const handleRunAnalysis = async () => {
    setPhase('report');
    const symbols = Object.keys(rawData());
    await runAnalysis(symbols, rawData(), model(), language(), addLog);
  };

  const handleSavePDF = async () => {
    const el = reportContainerRef();
    if (!el) return;

    // Load html2pdf
    await new Promise(resolve => {
      if (window.html2pdf) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });

    addLog("Initializing secure PDF rendering engine...");

    // 1. Create a clean sandbox (Iframe)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '1200px';
    iframe.style.height = '1000px';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    
    // 2. Prepare the content
    const reportHtml = el.innerHTML;
    
    // 3. Inject full document with styles
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          body { background: white; margin: 0; padding: 40px; font-family: 'Roboto', sans-serif; -webkit-print-color-adjust: exact; }
          ${REPORT_STYLES}
          /* Custom overrides for PDF */
          .paper-report { box-shadow: none !important; border: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
          canvas { display: none !important; } /* We will replace these */
          .img-snapshot { width: 100%; height: auto; display: block; margin: 20px 0; border: 1px solid #eee; }
          .page-break { page-break-before: always; height: 0; margin: 0; border: none; }
        </style>
      </head>
      <body>
        <div class="paper-report">
          ${reportHtml}
        </div>
      </body>
      </html>
    `);
    doc.close();

    // 4. Handle Canvases (Replace with images in the iframe)
    const origCanvases = el.querySelectorAll('canvas');
    const iframeDivs = doc.querySelectorAll('div'); // Search in doc
    
    // We need to find the equivalent positions. 
    // A better way is to find canvases in the iframe and replace them.
    const iframeCanvases = doc.querySelectorAll('canvas');
    origCanvases.forEach((canvas, i) => {
      try {
        const img = doc.createElement('img');
        img.src = canvas.toDataURL('image/png', 1.0);
        img.className = 'img-snapshot';
        if (iframeCanvases[i]) {
          iframeCanvases[i].parentNode.replaceChild(img, iframeCanvases[i]);
        }
      } catch (e) { console.error(e); }
    });

    // 5. Generate PDF from Iframe
    const symbols = Object.keys(rawData()).join('_vs_');
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${symbols}_Comparative_Analysis.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        width: 1200,
        windowWidth: 1200
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      addLog("Capturing high-fidelity intelligence...");
      // Wait for font loading and rendering
      await new Promise(r => setTimeout(r, 1000));
      await window.html2pdf().set(opt).from(doc.body).save();
      addLog("Institutional Export Successful.");
    } catch (err) {
      addLog(`Export Error: ${err.message}`, 'error');
    } finally {
      document.body.removeChild(iframe);
    }
  };

  const totalProgress = () => {
    if (phase() === 'data') return Math.round(progress() * 0.5);
    if (phase() === 'report') return 50 + Math.round(streamProgress() * 0.5);
    return 0;
  };

  return (
    <div class="flex-1 flex flex-col bg-bg_main overflow-hidden text-text_primary text-[10px] relative">
      <style>{REPORT_STYLES}</style>

      {/* Progress bar */}
      <Show when={loading() || isStreaming()}>
        <div class="h-1 w-full bg-black shrink-0">
          <div class="h-full bg-text_accent transition-all duration-500" style={{ width: `${totalProgress()}%` }} />
        </div>
      </Show>

      <div class="flex-1 flex overflow-hidden">
        {/* ─── LEFT SIDEBAR ─────────────────────────── */}
        <div class="w-[280px] border-r border-border_main flex flex-col bg-bg_sidebar overflow-y-auto win-scroll p-4 gap-4 shrink-0">

          {/* Company Selector */}
          <CompanySelector
            companies={companies}
            setCompanies={setCompanies}
            disabled={loading() || isStreaming()}
          />

          {/* AI Model & Language */}
          <div class="glass-panel p-3 flex flex-col gap-3">
            <div class="flex flex-col gap-1.5">
              <h3 class="text-[8px] font-black text-text_accent/50 tracking-[0.4em] border-b border-border_main pb-1">
                AI Engine
              </h3>
              <select
                class="w-full bg-black border border-border_main px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-text_accent"
                value={model()}
                onChange={(e) => setModel(e.target.value)}
                disabled={loading() || isStreaming()}
              >
                <option value="deepseek-v4-flash">DeepSeek V4 Flash (Fast)</option>
                <option value="deepseek-v4-pro">DeepSeek V4 Pro (Deep)</option>
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <h3 class="text-[8px] font-black text-text_accent/50 tracking-[0.4em] border-b border-border_main pb-1">
                Report Language
              </h3>
              <select
                class="w-full bg-black border border-border_main px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-text_accent"
                value={language()}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={loading() || isStreaming()}
              >
                <option value="en">English (Institutional)</option>
                <option value="id">Bahasa Indonesia (Lokal)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div class="flex flex-col gap-2">
            <button
              onClick={handleGatherData}
              disabled={loading() || isStreaming()}
              class="w-full bg-white/10 border border-white/20 text-white py-2.5 font-black hover:bg-white/20 transition-colors tracking-widest disabled:opacity-40 text-[9px]"
            >
              {loading() ? '⟳ Collecting Data...' : '① Gather Data'}
            </button>
            <button
              onClick={handleRunAnalysis}
              disabled={loading() || isStreaming() || Object.keys(rawData()).length === 0}
              class="w-full bg-text_accent text-bg_main py-2.5 font-black hover:brightness-110 transition-all tracking-widest disabled:opacity-40 text-[9px]"
            >
              {isStreaming() ? `⟳ Synthesizing Stage ${currentStage()}/7...` : '② Synthesize Report'}
            </button>
            <button
              onClick={handleSavePDF}
              disabled={!reports()[7]}
              class="w-full border border-text_accent/30 text-text_accent py-2 font-black hover:bg-text_accent hover:text-bg_main transition-colors tracking-widest disabled:opacity-30 text-[9px]"
            >
              ↓ Export PDF
            </button>
          </div>

          {/* Stage Progress */}
          <Show when={isStreaming() || reports()[1]}>
            <div class="glass-panel p-3 flex flex-col gap-1.5">
              <h3 class="text-[8px] font-black text-text_accent/50 tracking-[0.4em] border-b border-border_main pb-1 mb-1">
                Report Stages
              </h3>
              <For each={Object.entries(GET_STAGE_NAMES(language()))}>
                {([num, name]) => {
                  const n = Number(num);
                  const isDone = !!reports()[n];
                  const isActive = currentStage() === n;
                  return (
                    <a href={`#ai-stage-${n}`} class={`flex items-center gap-2 py-0.5 transition-colors text-[8px] font-bold uppercase tracking-wide ${isActive ? 'text-text_accent' : isDone ? 'text-white/50 hover:text-text_accent' : 'text-white/15'}`}>
                      <span class={`w-3 h-3 flex items-center justify-center rounded-full text-[7px] font-black shrink-0 ${isActive ? 'bg-text_accent text-black animate-pulse' : isDone ? 'bg-white/20 text-white' : 'border border-white/10 text-white/20'}`}>
                        {isDone ? '✓' : n}
                      </span>
                      {name}
                    </a>
                  );
                }}
              </For>
            </div>
          </Show>

          {/* Execution Logs */}
          <div class="glass-panel p-3">
            <h3 class="text-[8px] font-black text-text_accent/50 tracking-widest border-b border-border_main pb-1 mb-2">
              Execution Log
            </h3>
            <div class="flex flex-col gap-0.5 text-[7px] font-mono text-white/30 max-h-36 overflow-y-auto win-scroll">
              <For each={logs()}>
                {(log) => <div class="leading-relaxed">{log}</div>}
              </For>
              <Show when={logs().length === 0}>
                <div class="text-white/15 italic">Awaiting data collection...</div>
              </Show>
            </div>
          </div>
        </div>

        {/* ─── MAIN CONTENT ──────────────────────────── */}
        <div class="flex-1 overflow-y-auto win-scroll bg-[#090d15]">

          {/* Initial empty state */}
          <Show when={phase() === 'input'}>
            <div class="h-full flex flex-col items-center justify-center text-center p-10 gap-6">
              <div class="w-16 h-16 border border-white/10 rounded-full flex items-center justify-center">
                <svg class="w-8 h-8 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div class="flex flex-col gap-2">
                <h2 class="text-[16px] font-black text-white/60 tracking-[0.3em]">Comparative Analysis Engine</h2>
                <p class="text-[10px] font-mono text-white/20 max-w-md uppercase tracking-wider leading-relaxed">
                  Enter 2–3 company tickers in the sidebar. Click "Gather Data" to collect all market intelligence, then "Synthesize Report" to generate 7 stages of institutional-grade AI analysis.
                </p>
              </div>
              <div class="flex gap-6 text-[8px] font-mono text-white/15 uppercase tracking-widest">
                <span>• Technical Analysis</span>
                <span>• Fundamental Comparison</span>
                <span>• ESG Assessment</span>
                <span>• Legal Intelligence</span>
              </div>
            </div>
          </Show>

          {/* Error */}
          <Show when={error()}>
            <div class="m-6 border border-red-400/20 bg-red-400/5 rounded p-4 text-red-400 text-[9px] font-mono">
              ✗ {error()}
            </div>
          </Show>

          {/* Data Dashboard Phase */}
          <Show when={phase() === 'data' || phase() === 'report'}>
            <div class="p-6 flex flex-col gap-6">

              {/* Data tabs */}
              <div class="flex items-center gap-1 flex-wrap border-b border-white/5 pb-4">
                <For each={DATA_TABS}>
                  {(tab) => (
                    <button
                      onClick={() => setActiveDataTab(tab.id)}
                      class={`px-3 py-1.5 text-[9px] font-black tracking-wider rounded-sm transition-all border ${activeDataTab() === tab.id ? 'bg-text_accent text-bg_main border-text_accent' : 'border-white/10 text-white/30 hover:text-white hover:border-white/30'}`}
                    >
                      {tab.label}
                    </button>
                  )}
                </For>
              </div>

              {/* Tab content */}
              <Show when={activeDataTab() === 'technical'}>
                <TechnicalComparePanel companies={activeCompanies()} />
              </Show>
              <Show when={activeDataTab() === 'fundamental'}>
                <FundamentalComparePanel companies={activeCompanies()} />
              </Show>
              <Show when={activeDataTab() === 'news'}>
                <NewsSignalPanel companies={activeCompanies()} />
              </Show>
              <Show when={activeDataTab() === 'leadership'}>
                <LeadershipTrailPanel companies={activeCompanies()} />
              </Show>
              <Show when={activeDataTab() === 'legal'}>
                <LegalCasePanel companies={activeCompanies()} />
              </Show>
            </div>
          </Show>

          {/* ─── REPORT (White Paper) ─── */}
          <Show when={phase() === 'report'}>
            <div class="bg-[#090d15] px-6 pb-10 pt-2">
              <div
                ref={setReportContainerRef}
                class="bg-white shadow-2xl mx-auto max-w-5xl p-12 font-sans text-[#1e293b] text-justify rounded-sm"
              >
                {/* Report Cover */}
                <div class="flex justify-between items-start border-b-4 border-sky-600 pb-6 mb-8">
                  <div>
                    <div class="text-[9px] font-black text-sky-500 tracking-[0.4em] mb-2">
                      {language() === 'id' ? 'Intelijen Institusional Asetpedia' : 'Asetpedia Institutional Intelligence'}
                    </div>
                    <h1 class="text-3xl font-black text-slate-900 leading-tight">
                      {language() === 'id' ? 'Laporan Analisis Komparatif' : 'Comparative Analysis Report'}
                    </h1>
                    <div class="text-lg font-bold text-slate-500 mt-1">{Object.keys(rawData()).join(' vs. ')}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-[9px] font-black text-slate-400 tracking-widest">
                      {language() === 'id' ? 'Rahasia' : 'Confidential'}
                    </div>
                    <div class="text-[10px] font-bold text-slate-400 mt-1">
                      {new Date().toLocaleDateString(language() === 'id' ? 'id-ID' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <div class="text-[9px] font-mono text-slate-300 mt-0.5">Engine: {model()}</div>
                  </div>
                </div>

                {/* Company overview row */}
                <div class="grid gap-4 mb-8" style={{ 'grid-template-columns': `repeat(${activeCompanies().length}, 1fr)` }}>
                  <For each={activeCompanies()}>
                    {(comp, i) => {
                      const colors = ['#0ea5e9', '#f59e0b', '#10b981'];
                      const snap = comp?.fundamental?.snapshot || comp?.fundamentalEnriched?.snapshot || {};
                      return (
                        <div class="border-l-4 pl-4" style={{ 'border-color': colors[i()] }}>
                          <div class="font-black text-slate-900 text-[15px]">{comp.symbol}</div>
                          <div class="text-[10px] font-bold text-slate-500">{snap.name || snap.shortName || '—'}</div>
                          <div class="text-[9px] text-slate-400 mt-1">{snap.sector || ''}{snap.industry ? ` · ${snap.industry}` : ''}</div>
                          <div class="text-[10px] font-mono text-slate-600 mt-1">
                            Price: <strong>{snap.currentPrice ? `${snap.currency || ''} ${Number(snap.currentPrice).toFixed(2)}` : '—'}</strong>
                          </div>
                          <div class="text-[9px] text-slate-400 mt-0.5">
                            Market Cap: <strong>{snap.marketCap ? (snap.marketCap / 1e12 >= 1 ? (snap.marketCap / 1e12).toFixed(2) + ' T' : (snap.marketCap / 1e9).toFixed(2) + ' B') : '—'}</strong>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>

                {/* AI Stages */}
                <For each={Object.entries(GET_STAGE_NAMES(language()))}>
                  {([num, name]) => {
                    const n = Number(num);
                    return (
                      <div class="mb-8" id={`ai-stage-${n}`}>
                        <div class="text-[10px] font-black text-sky-600 tracking-[0.25em] uppercase border-b-2 border-sky-100 pb-1 mb-4">
                          {language() === 'id' ? `Tahap ${n}` : `Stage ${n}`}: {name}
                        </div>
                        <AIAnalysisStream content={reports()[n]} isActive={currentStage() === n} stageNum={n} stageTitle={name} />

                        {/* Insert Charts based on stage */}
                        <Show when={n === 1 && activeCompanies().some(c => c?.market?.historical?.length > 0)}>
                          <div class="mt-6 mb-4">
                            <div class="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">
                              {language() === 'id' ? 'Performa Harga (Tren 1-Tahun)' : 'Price Performance (1-Year Trend)'}
                            </div>
                            <div class="grid gap-6" style={{ 'grid-template-columns': `repeat(${activeCompanies().length}, 1fr)` }}>
                              <For each={activeCompanies()}>
                                {(comp, i) => (
                                  <SparklinePDF
                                    data={comp?.market?.historical || []}
                                    color={['#0ea5e9', '#f59e0b', '#10b981'][i()]}
                                    width={240}
                                    height={60}
                                    label={`${comp.symbol} — 1Y Price`}
                                  />
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>

                        <Show when={n === 2 && activeCompanies().some(c => c?.ta)}>
                          <FinancialTablePDF
                            title={language() === 'id' ? "Ringkasan Indikator Teknikal" : "Technical Indicators Summary"}
                            companies={activeCompanies()}
                            rows={[
                              { metric: 'TA Verdict', values: activeCompanies().map(c => c?.ta?.signals?.verdict || '—') },
                              { metric: 'TA Score', values: activeCompanies().map(c => c?.ta?.signals?.score ?? '—') },
                              { metric: 'RSI (14)', values: activeCompanies().map(c => c?.ta?.current?.rsi14?.toFixed(2) ?? '—') },
                              { metric: 'MACD', values: activeCompanies().map(c => c?.ta?.current?.macd?.toFixed(4) ?? '—') },
                              { metric: 'SMA 50', values: activeCompanies().map(c => c?.ta?.current?.sma50?.toFixed(2) ?? '—') },
                              { metric: 'SMA 200', values: activeCompanies().map(c => c?.ta?.current?.sma200?.toFixed(2) ?? '—') },
                              { metric: 'Support S1', values: activeCompanies().map(c => c?.ta?.support_resistance?.supports?.[0]?.toFixed(2) ?? '—') },
                              { metric: 'Resistance R1', values: activeCompanies().map(c => c?.ta?.support_resistance?.resistances?.[0]?.toFixed(2) ?? '—') },
                            ]}
                          />
                          <BarChartPDF
                            title={language() === 'id' ? "Perbandingan RSI (Oversold < 30 | Overbought > 70)" : "RSI Comparison (Oversold < 30 | Overbought > 70)"}
                            data={[{ label: 'RSI (14)', values: activeCompanies().map(c => c?.ta?.current?.rsi14) }]}
                          />
                        </Show>

                        <Show when={n === 3}>
                          <FinancialTablePDF
                            title={language() === 'id' ? "Perbandingan Kelipatan Valuasi" : "Valuation Multiples Comparison"}
                            companies={activeCompanies()}
                            rows={[
                              { metric: 'P/E (Trailing)', values: activeCompanies().map(c => c?.fundamental?.snapshot?.trailingPE?.toFixed(2) ?? c?.fundamentalEnriched?.snapshot?.trailingPE?.toFixed(2) ?? '—') },
                              { metric: 'Forward P/E', values: activeCompanies().map(c => c?.fundamental?.snapshot?.forwardPE?.toFixed(2) ?? '—') },
                              { metric: 'PEG Ratio', values: activeCompanies().map(c => c?.fundamental?.snapshot?.pegRatio?.toFixed(2) ?? '—') },
                              { metric: 'P/B Ratio', values: activeCompanies().map(c => c?.fundamental?.snapshot?.priceToBook?.toFixed(2) ?? c?.fundamentalEnriched?.snapshot?.priceToBook?.toFixed(2) ?? '—') },
                              { metric: 'P/S Ratio', values: activeCompanies().map(c => c?.fundamental?.snapshot?.priceToSales?.toFixed(2) ?? '—') },
                              { metric: 'EV/EBITDA', values: activeCompanies().map(c => c?.fundamental?.snapshot?.evToEbitda?.toFixed(2) ?? c?.fundamentalEnriched?.snapshot?.evToEbitda?.toFixed(2) ?? '—') },
                              { metric: 'Beta', values: activeCompanies().map(c => c?.fundamental?.snapshot?.beta?.toFixed(2) ?? c?.fundamentalEnriched?.snapshot?.beta?.toFixed(2) ?? '—') },
                            ]}
                          />
                          <BarChartPDF
                            title={language() === 'id' ? "Perbandingan Margin Profitabilitas (%)" : "Profitability Margins Comparison (%)"}
                            unit="%"
                            data={[
                              { label: 'Gross Margin', values: activeCompanies().map(c => { const v = c?.fundamental?.snapshot?.grossMargins; return v != null ? parseFloat(String(v).replace('%','')) : null; }) },
                              { label: 'Operating Margin', values: activeCompanies().map(c => { const v = c?.fundamental?.snapshot?.operatingMargins; return v != null ? parseFloat(String(v).replace('%','')) : null; }) },
                              { label: 'Net Margin', values: activeCompanies().map(c => { const v = c?.fundamental?.snapshot?.profitMargins; return v != null ? parseFloat(String(v).replace('%','')) : null; }) },
                            ]}
                          />
                          <FinancialTablePDF
                            title={language() === 'id' ? "Pertumbuhan & Performa" : "Growth & Performance"}
                            companies={activeCompanies()}
                            rows={[
                              { metric: 'Revenue Growth', values: activeCompanies().map(c => { const v = c?.fundamental?.snapshot?.revenueGrowth; return v != null ? (v*100).toFixed(2)+'%' : '—'; }) },
                              { metric: 'Earnings Growth', values: activeCompanies().map(c => { const v = c?.fundamental?.snapshot?.earningsGrowth; return v != null ? (v*100).toFixed(2)+'%' : '—'; }) },
                              { metric: 'Qtrly Rev Growth', values: activeCompanies().map(c => { const v = c?.fundamental?.snapshot?.quarterlyRevenueGrowth; return v != null ? (v*100).toFixed(2)+'%' : '—'; }) },
                              { metric: 'Qtrly Ern Growth', values: activeCompanies().map(c => { const v = c?.fundamental?.snapshot?.earningsQuarterlyGrowth; return v != null ? (v*100).toFixed(2)+'%' : '—'; }) },
                            ]}
                          />
                          <FinancialTablePDF
                            title={language() === 'id' ? "Neraca & Likuiditas" : "Balance Sheet & Liquidity"}
                            companies={activeCompanies()}
                            rows={[
                              { metric: 'Total Cash', values: activeCompanies().map(c => { const v = c?.fundamentalEnriched?.snapshot?.totalCash; return v ? (v/1e9).toFixed(2)+'B' : '—'; }) },
                              { metric: 'Total Debt', values: activeCompanies().map(c => { const v = c?.fundamentalEnriched?.snapshot?.totalDebt; return v ? (v/1e9).toFixed(2)+'B' : '—'; }) },
                              { metric: 'D/E Ratio', values: activeCompanies().map(c => c?.fundamentalEnriched?.snapshot?.debtToEquity?.toFixed(2) ?? '—') },
                              { metric: 'Current Ratio', values: activeCompanies().map(c => c?.fundamentalEnriched?.snapshot?.currentRatio?.toFixed(2) ?? '—') },
                              { metric: 'Quick Ratio', values: activeCompanies().map(c => c?.fundamentalEnriched?.snapshot?.quickRatio?.toFixed(2) ?? '—') },
                              { metric: 'Free Cash Flow', values: activeCompanies().map(c => { const v = c?.fundamentalEnriched?.snapshot?.freeCashflow; return v ? (v/1e9).toFixed(2)+'B' : '—'; }) },
                            ]}
                          />
                        </Show>
                      </div>
                    );
                  }}
                </For>

                {/* Glossary */}
                <Show when={reports()[7]}>
                  <div class="mt-12 pt-8 border-t-2 border-slate-100">
                    <GlossaryPanel />
                  </div>
                </Show>

                {/* Footer */}
                <div class="mt-12 pt-6 border-t border-slate-200 text-[8px] text-slate-300 text-center font-mono">
                  {language() === 'id' 
                    ? 'Laporan ini dibuat oleh Mesin AI Intelijen Institusional Asetpedia. Untuk tujuan informasi saja. Bukan nasihat keuangan.'
                    : 'This report was generated by Asetpedia Institutional Intelligence AI Engine. For informational purposes only. Not financial advice.'}
                  <br />
                  © {new Date().getFullYear()} Asetpedia Hub · {language() === 'id' ? 'Rahasia' : 'Confidential'}
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
