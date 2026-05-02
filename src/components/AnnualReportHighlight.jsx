import { createSignal, onMount, createEffect, onCleanup, Show } from 'solid-js';
import { renderMiningReport } from '../utils/annualReportRenderer.js';
import '../utils/annualReportRenderer.css';

/**
 * AnnualReportHighlight
 * Render laporan keuangan highlight (BMRS format) dari database.
 *
 * Props:
 *   symbol      : string — Kode saham (contoh: "BRMS")
 *   entityUrl   : string — Base URL entity service (VITE_ENTITY_URL)
 *   onHasReport : (boolean) => void — Callback untuk memberitahu parent
 *                                     apakah report tersedia (untuk show/hide tab)
 */
export default function AnnualReportHighlight(props) {
    let containerRef;
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);
    const [reportJson, setReportJson] = createSignal(null);
    const [reportsList, setReportsList] = createSignal([]);
    const [selectedYear, setSelectedYear] = createSignal(null);

    const fetchReport = async (symbol) => {
        if (!symbol) return;
        setLoading(true);
        setError(null);
        setReportJson(null);
        setReportsList([]);

        try {
            const baseUrl = props.entityUrl || import.meta.env.VITE_ENTITY_URL;
            const res = await fetch(`${baseUrl}/api/entity/annual-report/${encodeURIComponent(symbol)}`);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            const data = await res.json();

            if (data.exists && data.reports && data.reports.length > 0) {
                setReportsList(data.reports);
                // Auto-select the most recent year
                const latest = data.reports[0]; // sudah diurut DESC oleh backend
                setSelectedYear(latest.tahun_report);
                setReportJson(latest.highlight_json);
                if (props.onHasReport) props.onHasReport(true);
            } else {
                setReportsList([]);
                setReportJson(null);
                if (props.onHasReport) props.onHasReport(false);
            }
        } catch (err) {
            console.error("[AnnualReportHighlight] Fetch error:", err);
            setError(err.message || "Failed to load annual report data.");
            if (props.onHasReport) props.onHasReport(false);
        } finally {
            setLoading(false);
        }
    };

    // Fetch when symbol changes
    createEffect(() => {
        const sym = props.symbol;
        if (sym) {
            fetchReport(sym);
        }
    });

    // Re-render when reportJson or selectedYear changes
    createEffect(() => {
        const json = reportJson();
        const year = selectedYear();
        if (json && containerRef) {
            // Clear container
            containerRef.innerHTML = '<div class="ar-report-loading"><div class="spinner"></div><span>Rendering report...</span></div>';
            // Use setTimeout to allow DOM to update, then render
            setTimeout(() => {
                if (containerRef) {
                    try {
                        renderMiningReport(json, containerRef);
                    } catch (err) {
                        console.error("[AnnualReportHighlight] Render error:", err);
                        containerRef.innerHTML = `<div class="ar-report-error">Render error: ${escHtml(err.message)}</div>`;
                    }
                }
            }, 50);
        }
    });

    // Handle year selection change
    const handleYearChange = (year) => {
        setSelectedYear(year);
        const report = reportsList().find(r => r.tahun_report === year);
        if (report) {
            setReportJson(report.highlight_json);
        }
    };

    const escHtml = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    return (
        <div class="ar-report flex h-full overflow-hidden bg-white">
            {/* Sidebar Archive */}
            <Show when={reportsList().length > 0}>
                <div class="w-64 bg-[#f4f7f9] border-r border-gray-200 flex flex-col shrink-0 py-6 px-4">
                    <div class="mb-8 px-2">
                        <h4 class="text-[11px] font-extrabold text-[#005a9c] uppercase tracking-[0.15em] mb-1">Archive</h4>
                        <div class="text-[10px] text-gray-400 font-medium">Institutional Reports</div>
                    </div>

                    <div class="flex-1 overflow-y-auto px-1 flex flex-col gap-3 win-scroll">
                        <For each={reportsList()}>
                            {(r) => (
                                <div class="flex flex-col gap-1.5 mb-2">
                                    <button
                                        onClick={() => handleYearChange(r.tahun_report)}
                                        class={`flex items-center justify-between px-5 py-3.5 text-[12px] font-bold border transition-all duration-300 rounded-xl ${selectedYear() === r.tahun_report
                                            ? 'bg-[#005a9c] text-white border-[#005a9c] shadow-lg shadow-[#005a9c]/30 transform scale-[1.02]'
                                            : 'bg-white border-gray-200 text-gray-500 hover:border-[#005a9c] hover:bg-white hover:text-[#005a9c] hover:shadow-sm'
                                        }`}
                                    >
                                        <div class="flex items-center gap-3">
                                            <div class={`w-2 h-2 rounded-full ${selectedYear() === r.tahun_report ? 'bg-white animate-pulse' : 'bg-gray-300'}`}></div>
                                            <span>FY {r.tahun_report}</span>
                                        </div>
                                        <svg class={`w-3 h-3 ${selectedYear() === r.tahun_report ? 'text-white' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                            <path d="M9 18l6-6-6-6" />
                                        </svg>
                                    </button>

                                    <Show when={r.link_report}>
                                        <a
                                            href={r.link_report}
                                            target="_blank"
                                            class="flex items-center gap-2.5 px-5 py-2.5 text-[10px] font-bold text-gray-400 hover:text-[#005a9c] bg-white/40 border border-gray-100 rounded-lg transition-all hover:border-[#005a9c]/20"
                                        >
                                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                            </svg>
                                            View Source PDF
                                        </a>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </div>

                    <div class="mt-auto pt-6 px-2 border-t border-gray-200/60">
                        <div class="text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em] opacity-50">Asetpedia Terminal</div>
                    </div>
                </div>
            </Show>

            {/* Content area */}
            <div class="flex-1 overflow-y-auto scrollbar-thin">
                {/* Loading state */}
                <Show when={loading()}>
                    <div class="ar-report-loading">
                        <div class="spinner"></div>
                        <span class="text-[11px] font-bold text-gray-500 tracking-widest animate-pulse">
                            Loading Annual Report...
                        </span>
                    </div>
                </Show>

                {/* Error state */}
                <Show when={error() && !loading()}>
                    <div class="ar-report-error">
                        <div class="text-[11px] font-bold text-red-600 tracking-widest mb-2">Failed to Load Report</div>
                        <div class="text-[10px] font-mono text-gray-400">{error()}</div>
                        <button
                            onClick={() => fetchReport(props.symbol)}
                            class="mt-4 px-4 py-2 bg-[#005a9c] text-white text-[10px] font-bold rounded tracking-widest hover:opacity-80 transition-all"
                        >
                            Retry
                        </button>
                    </div>
                </Show>

                {/* No report state */}
                <Show when={!loading() && !error() && !reportJson()}>
                    <div class="ar-report-empty">
                        <div class="text-[11px] font-bold text-gray-300 tracking-widest">
                            No Annual Report Available
                        </div>
                        <div class="text-[10px] text-gray-300 mt-1">
                            No highlight data found for this entity.
                        </div>
                    </div>
                </Show>

                {/* Report render container */}
                <div ref={containerRef} class="p-10"></div>
            </div>
        </div>
    );
}
