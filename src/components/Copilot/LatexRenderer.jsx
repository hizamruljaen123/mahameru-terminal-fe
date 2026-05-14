import { createSignal, onMount, Show, createEffect } from 'solid-js';
import { ensureKaTeX } from './RichResponseRenderer';
import { downloadLatexAsPng } from './latexUtils';

/**
 * LatexRenderer — Renders LaTeX using KaTeX and supports PNG download
 */
export default function LatexRenderer(props) {
    const { formula, displayMode = true } = props;
    const [error, setError] = createSignal(null);
    const [isDownloading, setIsDownloading] = createSignal(false);
    const [showCode, setShowCode] = createSignal(false);
    const [renderReady, setRenderReady] = createSignal(false);

    let containerRef;
    let renderTimeout;

    onMount(async () => {
        try {
            await ensureKaTeX();
            setRenderReady(true);
            // Delay rendering to ensure DOM is ready
            renderTimeout = setTimeout(() => {
                renderMath();
            }, 50);
        } catch (e) {
            console.error('[LatexRenderer] KaTeX load error:', e);
            setError('Failed to load KaTeX');
        }

        return () => {
            if (renderTimeout) clearTimeout(renderTimeout);
        };
    });



    function renderMath() {
        if (!containerRef || !window.katex || showCode()) {
            return;
        }
        try {
            // Clear previous content
            containerRef.innerHTML = '';

            window.katex.render(formula, containerRef, {
                displayMode,
                throwOnError: false,
                trust: true,
                strict: false
            });
            setError(null);
        } catch (e) {
            console.error('[LatexRenderer] Render error:', e);
            setError(e.message || 'Failed to render LaTeX');
        }
    }

    createEffect(() => {
        if (renderReady() && !showCode()) {
            // Re-render math when switching back from code view
            renderTimeout = setTimeout(() => {
                renderMath();
            }, 50);
        }
    });

    async function downloadAsPNG() {
        if (!containerRef) return;
        setIsDownloading(true);
        try {
            await downloadLatexAsPng(containerRef, 'mahameru-formula');
        } catch (e) {
            console.error('[LatexRenderer] Download failed:', e);
            alert('Failed to generate image. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    }

    return (
        <div class="copilot-latex-wrapper" classList={{ 'display-mode': displayMode }}>
            <div class="copilot-latex-header">
                <span class="copilot-latex-label">LaTeX Formula</span>
                <div class="copilot-latex-actions">
                    <button
                        class="copilot-latex-toggle"
                        onClick={() => setShowCode(!showCode())}
                        title={showCode() ? "Show Render" : "Show Code"}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                        </svg>
                        <span>{showCode() ? 'Render' : 'Code'}</span>
                    </button>
                    <button
                        class="copilot-latex-download"
                        onClick={downloadAsPNG}
                        disabled={isDownloading()}
                        title="Download as PNG"
                    >
                        <Show when={isDownloading()} fallback={
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        }>
                            <div class="tc-spinner" style="width: 10px; height: 10px; border-width: 1px;"></div>
                        </Show>
                        <span>{isDownloading() ? 'Processing...' : 'PNG'}</span>
                    </button>
                    <button
                        class="copilot-latex-copy"
                        onClick={() => navigator.clipboard.writeText(formula)}
                        title="Copy LaTeX"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="copilot-latex-content">
                <Show when={showCode()} fallback={
                    <div ref={containerRef} class="katex-container">
                        <Show when={error()}>
                            <div class="copilot-latex-error">{error()}</div>
                        </Show>
                    </div>
                }>
                    <pre class="copilot-latex-raw-code">
                        <code>{formula}</code>
                    </pre>
                </Show>
            </div>
        </div>
    );
}
