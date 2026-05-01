import { createSignal, Show, For, onMount, createEffect } from 'solid-js';
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
    8: isId ? 'Sintesis One-Pager Institusional' : 'Institutional One-Pager Synthesis',
  };
};

const loadMarked = () => {
  return new Promise((resolve) => {
    if (window.marked) return resolve();
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/marked/marked.min.js';
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
};

const loadKaTeX = () => {
  return new Promise((resolve) => {
    if (window.renderMathInElement) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/katex@0.16.8/dist/katex.min.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/katex@0.16.8/dist/katex.min.js';
    script.onload = () => {
      const autoRender = document.createElement('script');
      autoRender.src = 'https://unpkg.com/katex@0.16.8/dist/contrib/auto-render.min.js';
      autoRender.onload = () => resolve();
      document.head.appendChild(autoRender);
    };
    document.head.appendChild(script);
  });
};

const DATA_TABS = [
  { id: 'report', label: 'REPORT' },
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
    rawData, setRawData, loading, progress, logs, setLogs, error,
    gatherAllData, addLog,
  } = useComparativeData();

  const { reports, setReports, currentStage, isStreaming, streamProgress, thinking, runAnalysis } = useAIStream();

  const [model, setModel] = createSignal('deepseek-v4-flash');
  const [language, setLanguage] = createSignal('id');
  const [caveman, setCaveman] = createSignal(false);
  const [activeDataTab, setActiveDataTab] = createSignal('report');
  const [phase, setPhase] = createSignal('input'); // 'input' | 'data' | 'report'
  const [activeView, setActiveView] = createSignal('new'); // 'new' | 'history'
  const [reportContainerRef, setReportContainerRef] = createSignal(null);
  const [logContainerRef, setLogContainerRef] = createSignal(null);
  const [availableModels, setAvailableModels] = createSignal([
    { "id": "deepseek-v4-flash", "name": "DeepSeek V4 Flash", "provider": "DeepSeek" },
    { "id": "deepseek-v4-pro", "name": "DeepSeek V4 Pro", "provider": "DeepSeek" },
    { "id": "deepseek-chat", "name": "DeepSeek Chat Standard", "provider": "DeepSeek" },
    { "id": "deepseek-reasoner", "name": "DeepSeek Reasoner Standard", "provider": "DeepSeek" },
    { "id": "deepseek-r1", "name": "DeepSeek R1", "provider": "DeepSeek" },
    { "id": "gpt-5.5", "name": "GPT 5.5", "provider": "OpenAI" },
    { "id": "gpt-5.4-mini", "name": "GPT 5.4-Mini", "provider": "OpenAI" },
    { "id": "kimi-k2.5", "name": "Kimi k2.5", "provider": "Moonshot AI" },
    { "id": "gemini-flash-latest", "name": "Gemini 3 Flash", "provider": "Google" },
  ]);
  const [history, setHistory] = createSignal([]);

  const activeCompanies = () => {
    const data = rawData();
    return Object.values(data);
  };

  const fetchModels = async () => {
    try {
      const res = await fetch(`${RESEARCH_API}/api/models`);
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        setAvailableModels(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch models", e);
    }
  };

  const loadHistory = () => {
    const saved = localStorage.getItem('asetpedia_research_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (_) { setHistory([]); }
    }
  };

  const saveToHistory = () => {
    const symbols = Object.keys(rawData());
    if (symbols.length === 0 || !reports()[8]) return;

    const newItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      symbols,
      reports: reports(),
      rawData: rawData(),
      language: language(),
      model: model()
    };

    setHistory(prev => {
      const filtered = prev.filter(item => item.symbols.join(',') !== symbols.join(','));
      const updated = [newItem, ...filtered].slice(0, 10); // Keep last 10
      localStorage.setItem('asetpedia_research_history', JSON.stringify(updated));
      return updated;
    });
    setLogs([`[${new Date().toLocaleTimeString()}] ✓ Research successfully archived to local history.`]);
  };

  const handleNewResearch = () => {
    setCompanies(['', '', '']);
    setRawData({});
    setReports({});
    setPhase('input');
    setLogs([`[${new Date().toLocaleTimeString()}] Resetting workspace for new institutional research.`]);
  };

  const handleLoadZIP = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    addLog(`Reading data package: ${file.name}...`);

    // Load JSZip if not loaded
    await new Promise(resolve => {
      if (window.JSZip) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });

    try {
      const zip = await window.JSZip.loadAsync(file);
      const dataFile = zip.file('data_bundle.json') || zip.file('data.json');
      if (!dataFile) throw new Error("Format tidak valid: data_bundle.json tidak ditemukan.");

      const content = await dataFile.async('string');
      const packageData = JSON.parse(content);

      const actualRawData = packageData.rawData || packageData.raw_data;
      if (actualRawData) {
        setRawData(actualRawData);
        setReports(packageData.reports || {});
        setLanguage(packageData.language || packageData.metadata?.language || 'id');
        setModel(packageData.model || packageData.metadata?.model || 'deepseek-v4-flash');
        setPhase('report');
        addLog(`✓ Institutional data package loaded: ${Object.keys(actualRawData).join(', ')}`, 'success');
      }
    } catch (e) {
      addLog(`Failed to load ZIP: ${e.message}`, 'error');
    }
    // Clear input
    event.target.value = '';
  };

  const deleteHistoryItem = (id) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('asetpedia_research_history', JSON.stringify(updated));
      return updated;
    });
  };

  const loadHistoryItem = (item) => {
    setActiveView('new');
    setPhase('report');
    setLanguage(item.language || 'en');
    setModel(item.model || 'deepseek-v4-flash');
    setCompanies([...item.symbols, '', ''].slice(0, 3));

    // Inject data into hooks
    setRawData(item.rawData || {});
    setReports(item.reports || {});
    setLogs([`[${new Date().toLocaleTimeString()}] ✓ Loaded archived research from history.`]);

    // Scroll to top of report
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  onMount(async () => {
    await Promise.all([loadMarked(), loadKaTeX()]);
    fetchModels();
    loadHistory();
  });

  createEffect(() => {
    const rs = reports();
    if (Object.keys(rs).some(k => rs[k].length > 0)) {
      setTimeout(() => {
        const container = reportContainerRef();
        if (container && window.renderMathInElement) {
          window.renderMathInElement(container, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
          });
        }
      }, 200);
    }
  });

  createEffect(() => {
    logs();
    const el = logContainerRef();
    if (el) el.scrollTop = el.scrollHeight;
  });

  const handleGatherData = async () => {
    const data = await gatherAllData();
    if (data) setPhase('data');
  };

  const handleRunAnalysis = async () => {
    setActiveDataTab('report');
    setPhase('report');
    const symbols = Object.keys(rawData());
    const result = await runAnalysis(symbols, rawData(), model(), language(), addLog, caveman());
    if (result) {
      saveToHistory();
    }
  };

  const handleExportZIP = async () => {
    addLog("Preparing research data package (JSON + HTML)...");

    // Load JSZip
    await new Promise(resolve => {
      if (window.JSZip) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });

    const zip = new window.JSZip();
    const symbolsText = Object.keys(rawData()).join('_');
    const filename = `${symbolsText}_Research_Bundle_${new Date().toISOString().split('T')[0]}`;

    // 1. Data Bundle (JSON)
    const bundle = {
      metadata: {
        symbols: Object.keys(rawData()),
        timestamp: new Date().toISOString(),
        model: model(),
        language: language(),
        stages_count: 8
      },
      reports: reports(),
      rawData: rawData(),
      logs: logs(),
      language: language(),
      model: model()
    };
    zip.file("data_bundle.json", JSON.stringify(bundle, null, 2));

    // 2. Static HTML Version
    const el = reportContainerRef();
    if (el) {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Asetpedia Research: ${Object.keys(rawData()).join(' vs ')}</title>
          <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Roboto', sans-serif; background: #f1f5f9; margin: 0; padding: 40px; color: #1e293b; }
            .report-wrapper { background: white; max-width: 900px; margin: 0 auto; padding: 60px; border-radius: 4px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
            ${REPORT_STYLES}
          </style>
        </head>
        <body>
          <div class="report-wrapper">${el.innerHTML}</div>
        </body>
        </html>
      `;
      zip.file("report_archive.html", htmlContent);
    }

    // 3. README
    zip.file("README.txt", `ASETPEDIA INSTITUTIONAL INTELLIGENCE\nResearch Data Package\n\nSymbols: ${Object.keys(rawData()).join(', ')}\nDate: ${new Date().toLocaleString()}\n\nContents:\n- data_bundle.json: Full raw data and AI generated reports.\n- report_archive.html: Static offline-viewable version of the report.`);

    // 4. Generate and Download
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `${filename}.zip`;
    link.click();
    addLog("✓ Research bundle successfully exported as ZIP.");
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
                  body {background: white; margin: 0; padding: 40px; font-family: 'Roboto', sans-serif; -webkit-print-color-adjust: exact; }
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

    // We need to find the equivalent positions. 
    // A better way is to find canvases in the iframe and replace them.
    const iframeCanvases = doc.querySelectorAll('canvas');
    origCanvases.forEach((canvas, i) => {
      try {
        const img = doc.createElement('img');
        img.src = canvas.toDataURL('image/png', 1.0);
        img.alt = 'Analysis Chart Snapshot';
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

          {/* AI Settings - Compact */}
          <div class="glass-panel p-2 flex flex-col gap-2">
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1">
                <label class="text-[7px] font-black text-text_accent/50 uppercase tracking-widest">Engine</label>
                <select
                  class="bg-black border border-border_main px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-text_accent"
                  value={model()}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={loading() || isStreaming()}
                >
                  <For each={availableModels()}>
                    {(m) => <option value={m.id}>{m.name || m.id}</option>}
                  </For>
                </select>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-[7px] font-black text-text_accent/50 uppercase tracking-widest">Language</label>
                <select
                  class="bg-black border border-border_main px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-text_accent"
                  value={language()}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={loading() || isStreaming()}
                >
                  <option value="en">EN</option>
                  <option value="id">ID</option>
                </select>
              </div>
            </div>

            <div class="flex items-center justify-between bg-white/5 p-1.5 border border-white/5 rounded-sm">
              <div class="flex flex-col">
                <span class="text-[8px] font-black text-text_accent leading-none">TOKEN SAVER</span>
                <span class="text-[6px] text-white/20 uppercase">SAVE ~65%</span>
              </div>
              <button
                type="button"
                onClick={() => setCaveman(!caveman())}
                class={`w-7 h-3.5 rounded-full transition-all relative ${caveman() ? 'bg-text_accent' : 'bg-white/10'}`}
              >
                <div class={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${caveman() ? 'left-4' : 'left-0.5'}`}></div>
              </button>
            </div>
          </div>

          {/* Institutional Command Hub */}
          <div class="glass-panel p-3 flex flex-col gap-3">
            <h3 class="text-[8px] font-black text-text_accent/50 tracking-[0.4em] border-b border-border_main pb-2">
              Institutional Command Hub
            </h3>
            
            <div class="grid grid-cols-3 gap-2">
              {/* Row 1: Core Process */}
              <button
                onClick={handleGatherData}
                disabled={loading() || isStreaming()}
                class={`flex flex-col items-center justify-center gap-1.5 p-2 rounded border transition-all ${loading() ? 'bg-text_accent/20 border-text_accent animate-pulse' : 'bg-white/5 border-white/10 hover:border-text_accent/50 hover:bg-white/10'} disabled:opacity-30 group`}
                title="Gather Data"
              >
                <svg class={`w-4 h-4 ${loading() ? 'text-text_accent animate-spin' : 'text-white/60 group-hover:text-text_accent'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7c0 2 1 3 3 3h10c2 0 3-1 3-3" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12c0 2 1 3 3 3h10c2 0 3-1 3-3" />
                </svg>
                <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">Gather</span>
              </button>

              <button
                onClick={handleRunAnalysis}
                disabled={loading() || isStreaming() || Object.keys(rawData()).length === 0}
                class={`flex flex-col items-center justify-center gap-1.5 p-2 rounded border transition-all ${isStreaming() ? 'bg-text_accent border-text_accent' : 'bg-white/5 border-white/10 hover:border-text_accent/50 hover:bg-white/10'} disabled:opacity-30 group`}
                title="Synthesize Report"
              >
                <svg class={`w-4 h-4 ${isStreaming() ? 'text-bg_main animate-pulse' : 'text-white/60 group-hover:text-text_accent'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span class={`text-[7px] font-black uppercase tracking-tighter ${isStreaming() ? 'text-bg_main' : 'text-white/40 group-hover:text-white'}`}>Synth</span>
              </button>

              <button
                onClick={handleNewResearch}
                disabled={loading() || isStreaming()}
                class="flex flex-col items-center justify-center gap-1.5 p-2 rounded border bg-white/5 border-white/10 hover:border-blue-400/50 hover:bg-blue-400/10 transition-all disabled:opacity-30 group"
                title="New Research"
              >
                <svg class="w-4 h-4 text-white/60 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">New</span>
              </button>

              {/* Row 2: File Operations */}
              <button
                onClick={handleSavePDF}
                disabled={!reports()[8]}
                class="flex flex-col items-center justify-center gap-1.5 p-2 rounded border bg-white/5 border-white/10 hover:border-rose-400/50 hover:bg-rose-400/10 transition-all disabled:opacity-30 group"
                title="Export PDF"
              >
                <svg class="w-4 h-4 text-white/60 group-hover:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">PDF</span>
              </button>

              <button
                onClick={handleExportZIP}
                disabled={!reports()[8]}
                class="flex flex-col items-center justify-center gap-1.5 p-2 rounded border bg-white/5 border-white/10 hover:border-amber-400/50 hover:bg-amber-400/10 transition-all disabled:opacity-30 group"
                title="Export ZIP"
              >
                <svg class="w-4 h-4 text-white/60 group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">ZIP</span>
              </button>

              <div class="relative group">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleLoadZIP}
                  disabled={loading() || isStreaming()}
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                />
                <div class="flex flex-col items-center justify-center gap-1.5 p-2 rounded border bg-white/5 border-white/10 group-hover:border-emerald-400/50 group-hover:bg-emerald-400/10 transition-all opacity-100 group-disabled:opacity-30">
                  <svg class="w-4 h-4 text-white/60 group-hover:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span class="text-[7px] font-black uppercase tracking-tighter text-white/40 group-hover:text-white">Load</span>
                </div>
              </div>
            </div>
          </div>

          {/* Research History - Simplified in sidebar, link to main tab */}
          <div class="glass-panel p-3 flex flex-col gap-2">
            <h3 class="text-[8px] font-black text-text_accent/50 tracking-[0.4em] border-b border-border_main pb-1 flex justify-between items-center">
              Quick History
              <button onClick={() => setActiveView('history')} class="text-text_accent hover:underline">View All</button>
            </h3>
            <div class="flex flex-col gap-1.5">
              <For each={history().slice(0, 3)}>
                {(item) => (
                  <div class="bg-black/40 border border-white/5 p-2 rounded flex flex-col gap-1 cursor-pointer hover:border-text_accent/30 transition-all" onClick={() => loadHistoryItem(item)}>
                    <div class="flex items-center justify-between">
                      <span class="text-[8px] font-black text-white/80">{item.symbols.join(' vs ')}</span>
                      <span class="text-[6px] text-white/20">{new Date(item.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Execution Logs */}
          <div class="glass-panel p-3 flex flex-col gap-2 min-h-[150px] max-h-[200px]">
            <h3 class="text-[8px] font-black text-text_accent/50 tracking-[0.4em] border-b border-border_main pb-1">
              Process Terminal
            </h3>
            <div
              ref={setLogContainerRef}
              class="flex-1 overflow-y-auto win-scroll flex flex-col gap-1.5 font-mono text-[8px] pr-1"
            >
              <For each={logs()}>
                {(log) => (
                  <div class="flex gap-2 animate-in slide-in-from-left-1 duration-200">
                    <span class="text-text_accent opacity-30 shrink-0">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                    <span class={log.includes('✓') || log.includes('complete') ? 'text-green-400' : log.includes('Error') ? 'text-red-400' : 'text-white/60'}>
                      {log}
                    </span>
                  </div>
                )}
              </For>
              <Show when={loading() || isStreaming()}>
                <div class="w-1 h-3 bg-text_accent animate-pulse mt-0.5"></div>
              </Show>
              <Show when={logs().length === 0}>
                <div class="text-white/10 italic py-2 uppercase tracking-widest text-[7px]">System standby...</div>
              </Show>
            </div>
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

        </div>

        {/* ─── MAIN CONTENT ──────────────────────────── */}
        <div class="flex-1 flex flex-col overflow-hidden bg-[#090d15]">

          {/* Main View Switcher */}
          <div class="shrink-0 h-12 border-b border-white/5 bg-black/40 flex items-center px-6 gap-8">
            <button
              onClick={() => setActiveView('new')}
              class={`h-full flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-all border-b-2 ${activeView() === 'new' ? 'text-text_accent border-text_accent' : 'text-white/20 border-transparent hover:text-white'}`}
            >
              <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
              Research Workspace
            </button>
            <button
              onClick={() => setActiveView('history')}
              class={`h-full flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-all border-b-2 ${activeView() === 'history' ? 'text-text_accent border-text_accent' : 'text-white/20 border-transparent hover:text-white'}`}
            >
              <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
              Research Timeline
            </button>
          </div>

          <div class="flex-1 overflow-y-auto win-scroll">
            <Show when={activeView() === 'new'}>
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
                      Enter 2–3 company tickers in the sidebar. Click "Gather Data" to collect all market intelligence, then "Synthesize Report" to generate 8 stages of institutional-grade AI analysis.
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
                  <Show when={activeDataTab() === 'report'}>
                    <div class="bg-[#090d15] px-6 pb-10 pt-2">
                      {/* Execution Logs in Main Area */}
                      <Show when={loading() && !reports()[1]}>
                        <div class="max-w-4xl mx-auto w-full my-auto flex flex-col gap-6 py-20 animate-in fade-in duration-700">
                          <div class="flex flex-col items-center justify-center text-center gap-4">
                            <div class="w-16 h-16 border-2 border-text_accent/20 rounded-full flex items-center justify-center relative">
                              <div class="absolute inset-0 border-t-2 border-text_accent rounded-full animate-spin"></div>
                              <span class="text-[10px] font-black text-text_accent tracking-[0.2em]">{progress()}%</span>
                            </div>
                            <div class="flex flex-col">
                              <h2 class="text-lg font-black text-white tracking-[0.3em] uppercase">Multi-Asset Intelligence</h2>
                              <p class="text-[9px] text-text_secondary tracking-[0.2em] uppercase opacity-50">Synthesizing comparative data matrix</p>
                            </div>
                          </div>

                          <div class="glass-panel p-6 bg-black/80 border border-text_accent/20 rounded-lg shadow-[0_0_50px_rgba(0,186,255,0.1)]">
                            <div class="flex items-center gap-2 border-b border-white/10 pb-3 mb-4">
                              <div class="w-2 h-2 rounded-full bg-red-500"></div>
                              <div class="w-2 h-2 rounded-full bg-yellow-500"></div>
                              <div class="w-2 h-2 rounded-full bg-green-500"></div>
                              <span class="ml-2 text-[9px] font-mono text-text_secondary opacity-40 uppercase tracking-widest">Comparative_Kernel_v4.0</span>
                            </div>
                            <div class="flex flex-col gap-2 font-mono text-[10px] h-[300px] overflow-y-auto win-scroll pr-4">
                              <For each={logs()}>
                                {(log) => (
                                  <div class="flex gap-4 animate-in slide-in-from-left-2 duration-300">
                                    <span class="text-text_accent opacity-40 whitespace-nowrap">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                                    <span class={log.includes('✓') || log.includes('complete') ? 'text-green-400' : log.includes('Error') ? 'text-red-400' : 'text-white/70'}>
                                      {log}
                                    </span>
                                  </div>
                                )}
                              </For>
                              <div class="w-2 h-4 bg-text_accent animate-pulse mt-1"></div>
                            </div>
                          </div>
                        </div>
                      </Show>

                      <Show when={isStreaming() || reports()[1]}>
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

                          {/* Market Macro Context */}
                          <Show when={activeCompanies()?.[0]?.fundamental?.macro_data}>
                            <div class="grid grid-cols-4 gap-2 mb-8 text-[8px] uppercase font-black text-left">
                              <For each={activeCompanies()[0].fundamental.macro_data.indices}>
                                {(idx) => (
                                  <div class="p-2 border border-slate-100 bg-slate-50 flex flex-col justify-between">
                                    <div class="text-slate-400 truncate">{idx.name}</div>
                                    <div class={idx.change_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                      {idx.price.toLocaleString()} ({idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%)
                                    </div>
                                  </div>
                                )}
                              </For>
                              <Show when={activeCompanies()[0].fundamental.macro_data.sector_etf}>
                                <div class="p-2 border border-slate-100 bg-slate-50 flex flex-col justify-between">
                                  <div class="text-slate-400 truncate">Sektor ETF: {activeCompanies()[0].fundamental.macro_data.sector_etf.ticker}</div>
                                  <div class="text-slate-800">{activeCompanies()[0].fundamental.macro_data.sector_etf.price.toLocaleString()}</div>
                                </div>
                              </Show>
                            </div>
                          </Show>

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
                                    <div class="text-[8px] uppercase text-slate-400 font-mono mt-1">
                                      {snap.sector} - {snap.industry}
                                    </div>
                                    <div class="mt-2 flex items-baseline gap-1">
                                      <span class="text-[8px] font-black text-slate-400 uppercase">Price:</span>
                                      <span class="text-[11px] font-black text-slate-700">
                                        {comp?.market?.historical?.[comp?.market?.historical?.length - 1]?.close?.toLocaleString() || '—'}
                                      </span>
                                    </div>
                                    <div class="flex items-baseline gap-1">
                                      <span class="text-[8px] font-black text-slate-400 uppercase">Market Cap:</span>
                                      <span class="text-[11px] font-black text-slate-700">
                                        {snap.marketCap ? (snap.marketCap / 1e12).toFixed(2) + ' T' : '—'}
                                      </span>
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
                                    <div class="mb-6">
                                      <div class="grid gap-6" style={{ 'grid-template-columns': `repeat(${activeCompanies().length}, 1fr)` }}>
                                        <For each={activeCompanies()}>
                                          {(comp, i) => (
                                            <div class="flex flex-col gap-2">
                                              <div class="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-1">
                                                {comp.symbol} - Technical Structure
                                              </div>
                                              <SparklinePDF
                                                data={comp?.market?.historical || []}
                                                ta={comp?.ta}
                                                color={['#0ea5e9', '#f59e0b', '#10b981'][i()]}
                                                width={280}
                                                height={140}
                                                label={`${comp.symbol} TA Structure`}
                                                type="full"
                                              />
                                              <div class="grid grid-cols-2 gap-2 mt-1">
                                                <SparklinePDF
                                                  data={comp?.ta?.indicators?.rsi?.rsi14?.map(v => ({ value: v })) || []}
                                                  color="#8b5cf6"
                                                  width={135}
                                                  height={40}
                                                  label="RSI(14)"
                                                />
                                                <SparklinePDF
                                                  data={comp?.ta?.indicators?.macd?.hist?.map(v => ({ value: v })) || []}
                                                  color="#3b82f6"
                                                  width={135}
                                                  height={40}
                                                  label="MACD Hist"
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </For>
                                      </div>
                                    </div>
                                    <FinancialTablePDF
                                      title={language() === 'id' ? "Ringkasan Indikator Teknikal" : "Technical Indicators Summary"}
                                      companies={activeCompanies()}
                                      rows={[
                                        { metric: 'TA Verdict', values: activeCompanies().map(c => c?.ta?.signals?.verdict || '—') },
                                        { metric: 'TA Score', values: activeCompanies().map(c => c?.ta?.signals?.score ?? '—') },
                                        { metric: 'RSI (14)', values: activeCompanies().map(c => c?.ta?.current?.rsi14?.toFixed(2) ?? '—') },
                                        { metric: 'MACD', values: activeCompanies().map(c => c?.ta?.current?.macd?.toFixed(4) ?? '—') },
                                        { metric: 'ADX Strength', values: activeCompanies().map(c => c?.ta?.current?.adx?.toFixed(2) ?? '—') },
                                        { metric: 'ATR (Volatility)', values: activeCompanies().map(c => c?.ta?.current?.atr?.toFixed(2) ?? '—') },
                                        { metric: 'Support S1', values: activeCompanies().map(c => c?.ta?.support_resistance?.supports?.[0]?.toFixed(2) ?? '—') },
                                        { metric: 'Resistance R1', values: activeCompanies().map(c => c?.ta?.support_resistance?.resistances?.[0]?.toFixed(2) ?? '—') },
                                      ]}
                                    />
                                  </Show>

                                  <Show when={n === 3}>
                                    <FinancialTablePDF
                                      title={language() === 'id' ? "Perbandingan Kelipatan Valuasi" : "Valuation Multiples Comparison"}
                                      companies={activeCompanies()}
                                      rows={[
                                        { metric: 'P/E (Trailing)', values: activeCompanies().map(c => c?.fundamental?.snapshot?.trailingPE?.toFixed(2) ?? '—') },
                                        { metric: 'Forward P/E', values: activeCompanies().map(c => c?.fundamental?.snapshot?.forwardPE?.toFixed(2) ?? '—') },
                                        { metric: 'PEG Ratio', values: activeCompanies().map(c => c?.fundamental?.snapshot?.pegRatio?.toFixed(2) ?? '—') },
                                        { metric: 'P/B Ratio', values: activeCompanies().map(c => c?.fundamental?.snapshot?.priceToBook?.toFixed(2) ?? '—') },
                                        { metric: 'Beta', values: activeCompanies().map(c => c?.fundamental?.snapshot?.beta?.toFixed(2) ?? '—') },
                                      ]}
                                    />
                                  </Show>
                                </div>
                              );
                            }}
                          </For>

                          {/* Glossary */}
                          <Show when={reports()[8]}>
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
                      </Show>
                      <Show when={!isStreaming() && !reports()[1]}>
                        <div class="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-lg opacity-30 text-[10px] font-black tracking-widest">
                          <span>NO REPORT SYNTHESIZED</span>
                          <span class="mt-2 text-white/20">Click "Synthesize Report" in the sidebar to generate</span>
                        </div>
                      </Show>
                    </div>
                  </Show>

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
            </Show>

            {/* ─── HISTORY TIMELINE VIEW ─── */}
            <Show when={activeView() === 'history'}>
              <div class="max-w-4xl mx-auto p-12">
                <div class="flex items-center justify-between mb-12 border-b border-white/10 pb-6">
                  <div class="flex flex-col gap-1">
                    <h2 class="text-2xl font-black text-white tracking-widest uppercase">Institutional Research Archive</h2>
                    <p class="text-[10px] font-mono text-white/40 uppercase tracking-widest">Chronological timeline of your local analysis reports</p>
                  </div>
                  <div class="text-right">
                    <span class="text-[40px] font-black text-text_accent/20 leading-none">{history().length}</span>
                    <div class="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Total_Reports</div>
                  </div>
                </div>

                <div class="relative flex flex-col gap-8">
                  {/* Timeline Line */}
                  <div class="absolute left-[39px] top-0 bottom-0 w-px bg-gradient-to-b from-text_accent/40 via-text_accent/10 to-transparent"></div>

                  <For each={history()}>
                    {(item) => (
                      <div class="relative flex gap-12 group">
                        {/* Timeline Node */}
                        <div class="shrink-0 w-20 flex flex-col items-center pt-1.5">
                          <div class="text-[10px] font-black text-white/30 uppercase">{new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short' })}</div>
                          <div class="text-[18px] font-black text-white/60 leading-none my-1">{new Date(item.timestamp).getDate()}</div>
                          <div class="text-[8px] font-black text-white/20">{new Date(item.timestamp).getFullYear()}</div>
                        </div>

                        <div class="absolute left-[35px] top-4 w-2 h-2 rounded-full bg-[#090d15] border-2 border-text_accent z-10 group-hover:scale-150 transition-transform"></div>

                        {/* Content Card */}
                        <div class="flex-1 bg-white/[0.03] border border-white/5 rounded p-5 hover:bg-white/[0.05] hover:border-text_accent/30 transition-all">
                          <div class="flex items-start justify-between mb-4">
                            <div class="flex flex-col gap-1">
                              <div class="flex items-center gap-2">
                                <For each={item.symbols}>
                                  {(s, i) => (
                                    <>
                                      <span class="text-[14px] font-black text-text_accent">{s}</span>
                                      {i() < item.symbols.length - 1 && <span class="text-white/10 text-[10px]">vs</span>}
                                    </>
                                  )}
                                </For>
                              </div>
                              <div class="text-[9px] font-mono text-white/40 uppercase flex items-center gap-3">
                                <span>Engine: {item.model}</span>
                                <span class="w-1 h-1 bg-white/10 rounded-full"></span>
                                <span>Lang: {item.language}</span>
                              </div>
                            </div>
                            <div class="flex gap-2">
                              <button
                                onClick={() => loadHistoryItem(item)}
                                class="px-4 py-1.5 bg-text_accent text-bg_main text-[9px] font-black tracking-widest hover:brightness-110"
                              >LOAD_REPORT</button>
                              <button
                                onClick={() => deleteHistoryItem(item.id)}
                                class="px-3 py-1.5 border border-red-500/30 text-red-400 text-[9px] font-black tracking-widest hover:bg-red-500/10"
                              >DELETE</button>
                            </div>
                          </div>
                          <div class="grid grid-cols-3 gap-4 border-t border-white/5 pt-4">
                            <div class="flex flex-col">
                              <span class="text-[7px] text-white/20 font-black uppercase tracking-widest mb-1">Status</span>
                              <span class="text-[9px] font-black text-emerald-400">ARCHIVED_FULL</span>
                            </div>
                            <div class="flex flex-col">
                              <span class="text-[7px] text-white/20 font-black uppercase tracking-widest mb-1">Time</span>
                              <span class="text-[9px] font-black text-white/60">{new Date(item.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div class="flex flex-col">
                              <span class="text-[7px] text-white/20 font-black uppercase tracking-widest mb-1">ID</span>
                              <span class="text-[9px] font-mono text-white/40 truncate">{item.id.slice(0, 8)}...</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>

                  <Show when={history().length === 0}>
                    <div class="flex flex-col items-center justify-center py-20 text-white/20 gap-4">
                      <div class="w-12 h-12 border border-current rounded-full flex items-center justify-center opacity-40">
                        <span class="text-2xl">?</span>
                      </div>
                      <div class="text-[10px] font-black tracking-[0.4em] uppercase">No Archived Research</div>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
      {/* Floating Thinking Panel */}
      <Show when={thinking()}>
        <div class="fixed bottom-6 right-6 w-80 max-h-[300px] bg-[#090d15]/95 border border-text_accent/30 rounded-lg shadow-[0_0_50px_rgba(0,186,255,0.15)] flex flex-col z-[100] animate-in slide-in-from-right-4 duration-300">
          <div class="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-text_accent/5 rounded-t-lg">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-text_accent animate-pulse"></div>
              <span class="text-[8px] font-black text-text_accent tracking-[0.2em] uppercase">Deep Intelligence Core</span>
            </div>
            <div class="flex gap-1">
              <div class="w-1 h-1 rounded-full bg-white/20"></div>
              <div class="w-1 h-1 rounded-full bg-white/20"></div>
              <div class="w-1 h-1 rounded-full bg-white/20"></div>
            </div>
          </div>
          <div class="p-4 overflow-y-auto win-scroll flex-1 font-mono text-[9px] text-text_secondary/80 leading-relaxed italic whitespace-pre-wrap">
            {thinking()}
          </div>
          <div class="px-3 py-1.5 border-t border-white/5 bg-black/20 rounded-b-lg flex justify-between items-center">
            <span class="text-[7px] text-white/20 font-mono uppercase tracking-widest">Reasoning_Phase_Active</span>
            <div class="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
              <div class="h-full bg-text_accent/40 w-1/2 animate-shimmer"></div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
