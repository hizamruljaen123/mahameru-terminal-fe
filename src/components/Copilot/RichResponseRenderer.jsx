import { createSignal, createEffect, createMemo, onCleanup, onMount, Show, For, Switch, Match } from 'solid-js';
import { render, Dynamic } from 'solid-js/web';
import DiagramRenderer from './DiagramRenderer.jsx';
import LatexRenderer from './LatexRenderer.jsx';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * ============================================================================
 *  MAHAMERU COPILOT — Enhanced Rich Response Renderer
 *
 *  Features:
 *  - Markdown with syntax highlighting (highlight.js CDN)
 *  - LaTeX math rendering (KaTeX CDN)
 *  - Code blocks with language badge + copy button
 *  - ECharts, Leaflet Maps, Tables, Cards
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Static renderers
// ---------------------------------------------------------------------------
import VesselRadarRenderer from './VesselRadarRenderer.jsx';

// ---------------------------------------------------------------------------
// Lazy-loaded renderers
// ---------------------------------------------------------------------------
let EChartsRenderer = null;
let LeafletMapRenderer = null;

async function ensureECharts() {
    if (!EChartsRenderer) {
        EChartsRenderer = (await import('./EChartsRenderer.jsx')).default;
    }
    return EChartsRenderer;
}

async function ensureLeaflet() {
    if (!LeafletMapRenderer) {
        LeafletMapRenderer = (await import('./LeafletMapRenderer.jsx')).default;
    }
    return LeafletMapRenderer;
}

// ---------------------------------------------------------------------------
// CDN library loader
// ---------------------------------------------------------------------------
let hljsLoaded = false;
let katexLoaded = false;

let hljsPromise = null;
export async function ensureHighlightJs() {
    if (hljsLoaded) return;
    if (hljsPromise) return hljsPromise;

    hljsPromise = (async () => {
        try {
            if (!document.querySelector('link[href*="highlight.js"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
                document.head.appendChild(link);
            }
            if (!window.hljs) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            hljsLoaded = true;
        } catch (e) {
            console.warn('[Copilot] Failed to load highlight.js:', e);
            hljsPromise = null;
        }
    })();
    return hljsPromise;
}

let katexPromise = null;
export async function ensureKaTeX() {
    if (katexLoaded) return;
    if (katexPromise) return katexPromise;

    katexPromise = (async () => {
        try {
            if (!document.querySelector('link[href*="katex"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css';
                document.head.appendChild(link);
            }
            if (!window.katex) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            katexLoaded = true;
        } catch (e) {
            console.warn('[Copilot] Failed to load KaTeX:', e);
            katexPromise = null;
        }
    })();
    return katexPromise;
}

let mermaidPromise = null;
let mermaidLoaded = false;
export async function ensureMermaid() {
    if (mermaidLoaded) return;
    if (mermaidPromise) return mermaidPromise;

    mermaidPromise = (async () => {
        try {
            if (!window.mermaid) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.0/mermaid.min.js';
                    script.onload = () => {
                        window.mermaid.initialize({
                            startOnLoad: false,
                            theme: 'dark',
                            securityLevel: 'loose',
                            fontFamily: 'Inter, sans-serif',
                            suppressErrorRendering: true,
                            maxTextSize: 90000
                        });
                        resolve();
                    };
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            mermaidLoaded = true;
        } catch (e) {
            console.warn('[Copilot] Failed to load Mermaid:', e);
            mermaidPromise = null;
        }
    })();
    return mermaidPromise;
}

// ---------------------------------------------------------------------------
// Copy button component for code blocks
// ---------------------------------------------------------------------------
function CopyButton(props) {
    const [copied, setCopied] = createSignal(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(props.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = props.text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    return (
        <button
            class="copilot-code-copy-btn"
            onClick={handleCopy}
            title="Copy code"
        >
            <Show when={copied()} fallback={
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
            }>
                <svg class="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6L9 17l-5-5" />
                </svg>
            </Show>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Enhanced Markdown block with syntax highlighting, LaTeX, code copy
// ---------------------------------------------------------------------------
function MarkdownBlock(props) {
    let contentEl;
    const [hlReady, setHlReady] = createSignal(false);
    const [katexReady, setKatexReady] = createSignal(false);

    onMount(async () => {
        await Promise.all([ensureHighlightJs(), ensureKaTeX()]);
        setHlReady(true);
        setKatexReady(true);
    });

    createEffect(() => {
        if (contentEl && props.content) {
            renderEnhancedMarkdown(contentEl, props.content, hlReady(), katexReady(), {
                onExecuteCode: props.onExecuteCode,
                isStreaming: props.isStreaming,
                onFixDiagram: props.onFixDiagram
            });
        }
    });

    return (
        <div
            ref={contentEl}
            class="copilot-markdown"
        />
    );
}

/**
 * Render markdown to DOM with syntax highlighting, LaTeX, and copy buttons.
 * Instead of innerHTML (which would lose event handlers), we build
 * the DOM manually for code blocks with copy buttons.
 */
function renderEnhancedMarkdown(container, text, hlReady, katexReady, props = {}) {
    // Cleanup any previously mounted Solid components in this container
    if (container.__solid_disposers) {
        container.__solid_disposers.forEach(dispose => {
            try { dispose(); } catch (e) { console.error('Dispose error:', e); }
        });
    }
    if (container.__cleanupFns) {
        container.__cleanupFns.forEach(cleanup => {
            try { cleanup(); } catch (e) { console.error('Cleanup error:', e); }
        });
    }
    container.__solid_disposers = [];
    container.__cleanupFns = [];

    if (!text) {
        container.innerHTML = '';
        return;
    }

    // 1. Extract and render Math to prevent marked from messing it up
    const mathBlocks = [];
    const diagramBlocks = [];
    let processedText = text;

    // ── EXTRACT DIAGRAMS FIRST (before markdown processing) ──
    if (processedText.includes('```mermaid') || processedText.includes('```plantuml')) {
        processedText = processedText.replace(/```(mermaid|plantuml)\n([\s\S]*?)```/g, (match, type, code) => {
            const id = `DIAGRAMBLOCK${diagramBlocks.length}X`;
            diagramBlocks.push({ type, code: code.trim(), id });
            return `\n${id}\n`;
        });
    }

    if (katexReady && window.katex) {
        // Block math: $$...$$ or \[...\]
        processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
            const id = `MATHBLOCK${mathBlocks.length}X`;
            const cleanFormula = formula.trim();
            let staticHtml = null;
            if (props.isStreaming) {
                try {
                    staticHtml = `<div class="copilot-latex-static-stream">${window.katex.renderToString(cleanFormula, { displayMode: true, throwOnError: false })}</div>`;
                } catch { staticHtml = `<div class="copilot-katex-error">${cleanFormula}</div>`; }
            }
            mathBlocks.push({ formula: cleanFormula, isBlock: true, staticHtml });
            return id;
        });

        processedText = processedText.replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => {
            const id = `MATHBLOCK${mathBlocks.length}X`;
            const cleanFormula = formula.trim();
            let staticHtml = null;
            if (props.isStreaming) {
                try {
                    staticHtml = `<div class="copilot-latex-static-stream">${window.katex.renderToString(cleanFormula, { displayMode: true, throwOnError: false })}</div>`;
                } catch { staticHtml = `<div class="copilot-katex-error">${cleanFormula}</div>`; }
            }
            mathBlocks.push({ formula: cleanFormula, isBlock: true, staticHtml });
            return id;
        });

        // Some models use [ ] on separate lines without backslashes
        processedText = processedText.replace(/(?:^|\n)\[\s*\n([\s\S]*?)\n\s*\](?:\n|$)/g, (_, formula) => {
            const id = `MATHBLOCK${mathBlocks.length}X`;
            const cleanFormula = formula.trim();
            let staticHtml = null;
            if (props.isStreaming) {
                try {
                    staticHtml = `<div class="copilot-latex-static-stream">${window.katex.renderToString(cleanFormula, { displayMode: true, throwOnError: false })}</div>`;
                } catch { staticHtml = `<div class="copilot-katex-error">${cleanFormula}</div>`; }
            }
            mathBlocks.push({ formula: cleanFormula, isBlock: true, staticHtml });
            return "\n" + id + "\n";
        });

        // Inline math: $...$ or \(...\)
        processedText = processedText.replace(/\$(.+?)\$/g, (_, formula) => {
            const id = `MATHINLINE${mathBlocks.length}X`;
            try {
                mathBlocks.push({
                    html: window.katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false }),
                    isBlock: false
                });
            } catch {
                mathBlocks.push({ html: `<span class="copilot-katex-error">${formula}</span>`, isBlock: false });
            }
            return id;
        });

        processedText = processedText.replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => {
            const id = `MATHINLINE${mathBlocks.length}X`;
            try {
                mathBlocks.push({
                    html: window.katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false }),
                    isBlock: false
                });
            } catch {
                mathBlocks.push({ html: `<span class="copilot-katex-error">${formula}</span>`, isBlock: false });
            }
            return id;
        });
    }

    // 2. Parse Markdown
    marked.setOptions({ breaks: true, gfm: true });
    const rawHtml = marked.parse(processedText);

    // 3. Purify HTML
    let safeHtml = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['svg', 'path', 'rect'],
        ADD_ATTR: ['viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'x', 'y', 'width', 'height', 'rx', 'ry', 'd']
    });

    // 4. Restore Diagrams (BEFORE Math to maintain order)
    for (let i = 0; i < diagramBlocks.length; i++) {
        const diagram = diagramBlocks[i];
        const id = diagram.id;
        const mountHtml = `<div id="diagram-mount-${i}" class="diagram-render-root" style="min-height: 150px; width: 100%; margin: 16px 0;"></div>`;
        safeHtml = safeHtml.replace(new RegExp(id, 'g'), mountHtml);
    }

    // 5. Restore Math (Inline and Streaming Blocks)
    for (let i = 0; i < mathBlocks.length; i++) {
        if (!mathBlocks[i].isBlock) {
            const id = `MATHINLINE${i}X`;
            safeHtml = safeHtml.replace(new RegExp(id, 'g'), mathBlocks[i].html);
        } else if (props.isStreaming && mathBlocks[i].staticHtml) {
            const id = `MATHBLOCK${i}X`;
            safeHtml = safeHtml.replace(new RegExp(id, 'g'), mathBlocks[i].staticHtml);
        } else if (!props.isStreaming && mathBlocks[i].isBlock) {
            // Pre-inject mount points into the HTML string to avoid destructive DOM manipulation
            const id = `MATHBLOCK${i}X`;
            const mountHtml = `<div id="math-mount-${i}" class="math-render-root" style="min-height: 1em;"></div>`;
            safeHtml = safeHtml.replace(new RegExp(id, 'g'), mountHtml);
        }
    }

    try {
        container.innerHTML = safeHtml;

        // 5b. UNWRAP mount points from <p> tags to avoid invalid HTML nesting (div inside p)
        // which causes browser-driven layout shifting and "sticky to top" behavior.
        const mountPoints = container.querySelectorAll('.diagram-render-root, .math-render-root');
        mountPoints.forEach(mp => {
            const parent = mp.parentNode;
            if (parent && parent.tagName === 'P') {
                // Move the mount point out of the paragraph
                parent.parentNode.insertBefore(mp, parent.nextSibling);
                // If the paragraph is now empty, remove it
                if (parent.innerHTML.trim() === '') {
                    parent.remove();
                }
            }
        });
    } catch (e) {
        console.error('[Copilot] HTML Set Error:', e);
        container.textContent = props.content;
        return;
    }

    // 6. Render Diagrams FIRST using bottom-to-top mount order
    for (let i = diagramBlocks.length - 1; i >= 0; i--) {
        const diagram = diagramBlocks[i];
        const mountPoint = container.querySelector(`#diagram-mount-${i}`);
        if (mountPoint) {
            try {
                const dispose = render(
                    () => <DiagramRenderer type={diagram.type} code={diagram.code} onFixDiagram={props.onFixDiagram} />,
                    mountPoint
                );
                container.__solid_disposers.push(dispose);
            } catch (renderError) {
                console.error('[Copilot] Diagram render crash:', renderError);
                mountPoint.innerHTML = `<div class="copilot-diagram-error">Failed to mount diagram</div>`;
            }
        }
    }

    // 7. Render Math Blocks using LatexRenderer (Final/Non-Streaming), bottom-to-top
    if (!props.isStreaming) {
        for (let i = mathBlocks.length - 1; i >= 0; i--) {
            if (mathBlocks[i].isBlock) {
                const mountPoint = container.querySelector(`#math-mount-${i}`);
                if (mountPoint) {
                    try {
                        const dispose = render(() => <LatexRenderer formula={mathBlocks[i].formula} displayMode={true} />, mountPoint);
                        container.__solid_disposers.push(dispose);
                    } catch (err) {
                        console.error('[Copilot] Latex mount error:', err);
                        mountPoint.innerHTML = `<div class="copilot-katex-error">${mathBlocks[i].formula}</div>`;
                    }
                }
            }
        }
    }

    // 8. Post-process DOM for Tables and Code blocks
    // Wrap tables
    container.querySelectorAll('table').forEach(table => {
        table.classList.add('markdown-table');
        if (!table.parentNode.classList.contains('copilot-table-scroll')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'copilot-table-scroll';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });

    // Wrap pre > code for syntax highlighting and copy button
    container.querySelectorAll('pre').forEach(pre => {
        const codeEl = pre.querySelector('code');
        if (!codeEl) return;

        let lang = 'text';
        codeEl.className.split(' ').forEach(cls => {
            if (cls.startsWith('language-')) lang = cls.replace('language-', '');
        });

        // Skip diagram blocks (already handled above)
        if (lang === 'mermaid' || lang === 'plantuml') {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'copilot-code-wrapper';

        const header = document.createElement('div');
        header.className = 'copilot-code-header';

        const langBadge = document.createElement('span');
        langBadge.className = 'copilot-code-lang';
        langBadge.textContent = lang;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copilot-code-copy-btn';
        copyBtn.title = 'Copy code';
        copyBtn.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;

        const rawCode = codeEl.textContent;
        copyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(rawCode);
            } catch {
                const ta = document.createElement('textarea');
                ta.value = rawCode;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            copyBtn.innerHTML = `<svg class="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
            const resetCopyTimeout = setTimeout(() => {
                copyBtn.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
            }, 2000);
            container.__cleanupFns.push(() => clearTimeout(resetCopyTimeout));
        };

        header.appendChild(langBadge);
        header.appendChild(copyBtn);

        const footer = document.createElement('div');
        footer.className = 'copilot-code-footer';

        const resultEl = document.createElement('div');
        resultEl.className = 'copilot-code-result hidden';

        // Run button for supported languages
        if (props.onExecuteCode && ['python', 'javascript', 'js', 'bash', 'sh', 'shell', 'cmd'].includes(lang)) {
            const runBtn = document.createElement('button');
            runBtn.className = 'copilot-code-run-btn-large';
            runBtn.innerHTML = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-14 9V3z" /></svg> Run Code`;

            runBtn.onclick = async () => {
                runBtn.disabled = true;
                runBtn.innerHTML = `<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg> Running...`;

                try {
                    const res = await props.onExecuteCode(lang, rawCode);
                    resultEl.classList.remove('hidden');

                    let output = '';
                    if (res.stdout) output += `<div class="stdout">${res.stdout}</div>`;
                    if (res.stderr) output += `<div class="stderr">${res.stderr}</div>`;

                    if (!res.stdout && !res.stderr && (!res.images || res.images.length === 0)) {
                        output = `<div class="text-gray-500 italic">Process finished with exit code ${res.exit_code} (no output)</div>`;
                    }

                    resultEl.innerHTML = `
                        <div class="result-header">
                            <span>Output (${res.duration_ms}ms)</span>
                            <button class="close-btn">×</button>
                        </div>
                        <div class="result-body">
                            <pre>${output}</pre>
                        </div>
                    `;

                    // Handle images outside the result box
                    const imagesContainer = document.createElement('div');
                    imagesContainer.className = 'copilot-execution-gallery';

                    if (res.images && res.images.length > 0) {
                        res.images.forEach((img, i) => {
                            const imgWrapper = document.createElement('div');
                            imgWrapper.className = 'gallery-image-item';
                            imgWrapper.innerHTML = `<img src="${img}" alt="Generated Plot ${i + 1}" />`;
                            imgWrapper.onclick = () => {
                                window.dispatchEvent(new CustomEvent('copilot-open-image-modal', { detail: { url: img } }));
                            };
                            imagesContainer.appendChild(imgWrapper);
                        });
                    }

                    // Clear old gallery if any
                    const oldGallery = wrapper.querySelector('.copilot-execution-gallery');
                    if (oldGallery) oldGallery.remove();
                    wrapper.appendChild(imagesContainer);

                    resultEl.querySelector('.close-btn').onclick = () => {
                        resultEl.classList.add('hidden');
                        resultEl.innerHTML = '';
                        imagesContainer.remove();
                    };

                    // Scroll to result or images
                    if (res.images && res.images.length > 0) {
                        imagesContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else {
                        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }

                    // Scroll to result
                    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } catch (e) {
                    resultEl.classList.remove('hidden');
                    resultEl.innerHTML = `<div class="stderr">Execution Error: ${e.message}</div>`;
                } finally {
                    runBtn.disabled = false;
                    runBtn.innerHTML = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-14 9V3z" /></svg> Run Code`;
                }
            };
            footer.appendChild(runBtn);
        }

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
        wrapper.appendChild(footer);
        wrapper.appendChild(resultEl);

        if (hlReady && window.hljs) {
            window.hljs.highlightElement(codeEl);
        }
    });
}

// ---------------------------------------------------------------------------
// Ticker Link — makes ticker symbols clickable to trigger research
// ---------------------------------------------------------------------------
function TickerLink(props) {
    const isTicker = createMemo(() => {
        const val = String(props.value || '');
        // Match common ticker patterns: BBCA.JK, AAPL, BTC-USD
        return /^[A-Z0-9]{2,10}(\.[A-Z]{2})?$/.test(val) || /^[A-Z]{2,5}-USD$/.test(val);
    });

    if (!isTicker() || !props.onResearchStart) {
        return <span>{String(props.value)}</span>;
    }

    return (
        <button
            class="copilot-ticker-link"
            onClick={() => props.onResearchStart(String(props.value), 'full')}
            title={`Research ${props.value}`}
        >
            {String(props.value)}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Table renderer
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Table renderer (Professional Terminal Style)
// ---------------------------------------------------------------------------
function TableBlock(props) {
    const { headers, rows, title, onResearchStart, color } = props;
    const accentColor = color || '#38bdf8';

    // --- FIX: Specialized News Feed table handling ---
    const isNewsFeed = createMemo(() => {
        const t = (title || '').toLowerCase();
        return t.includes('news feed') || t.includes('berita');
    });

    const processedData = createMemo(() => {
        const h = headers || [];
        const r = rows || [];

        if (!isNewsFeed()) return { headers: h, rows: r };

        // Identify indices for desired columns: Judul, Deskripsi, Sentimen
        const titleIdx = h.findIndex(col => col.toLowerCase().includes('title') || col.toLowerCase().includes('judul'));
        const descIdx = h.findIndex(col => col.toLowerCase().includes('desc') || col.toLowerCase().includes('isi'));
        const sentIdx = h.findIndex(col => col.toLowerCase().includes('sentimen'));

        // If we can't find these columns, try a generic approach or fallback
        const filteredIndices = [titleIdx, descIdx, sentIdx].filter(idx => idx !== -1);
        if (filteredIndices.length === 0) return { headers: h, rows: r };

        const filteredHeaders = filteredIndices.map(idx => h[idx]);
        const filteredRows = r.map(row => {
            return filteredIndices.map(idx => {
                let val = row[idx];
                // Truncate description to 100 chars
                if (idx === descIdx && typeof val === 'string' && val.length > 100) {
                    val = val.substring(0, 100) + '...';
                }
                return val;
            });
        });

        return { headers: filteredHeaders, rows: filteredRows };
    });

    return (
        <div class="copilot-table-scroll">
            <table class="copilot-table-root">
                <thead>
                    <tr>
                        <For each={processedData().headers}>
                            {(header) => (
                                <th>{header}</th>
                            )}
                        </For>
                    </tr>
                </thead>
                <tbody>
                    <For each={processedData().rows}>
                        {(row, rowIdx) => (
                            <tr>
                                <For each={row}>
                                    {(cell, cellIdx) => (
                                        <td classList={{ 'copilot-table-first': cellIdx() === 0 }}>
                                            <Show when={cellIdx() === 0 || !['BUY', 'SELL', 'NEUTRAL', 'STRONG BUY', 'STRONG SELL'].includes(String(cell).toUpperCase())} fallback={
                                                <SignalBadge val={String(cell)} />
                                            }>
                                                <TickerLink
                                                    value={cell}
                                                    onResearchStart={onResearchStart}
                                                />
                                            </Show>
                                        </td>
                                    )}
                                </For>
                            </tr>
                        )}
                    </For>
                </tbody>
            </table>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Score Gauge component (SVG)
// ---------------------------------------------------------------------------
function ScoreGauge(props) {
    const { pct, verdict, label } = props;
    const color = createMemo(() => {
        const v = String(verdict || '').toUpperCase();
        if (v.includes('BUY')) return '#00c853';
        if (v.includes('SELL')) return '#ff1744';
        return '#fbbf24';
    });

    return (
        <div class="copilot-gauge-container">
            <div class="relative w-24 h-24">
                <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1a1a1a" stroke-width="2.5" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={color()} stroke-width="2.5"
                        stroke-dasharray={`${pct || 0} 100`} stroke-linecap="round"
                        style="transition: stroke-dasharray 1s ease-out;" />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-[14px] font-black" style={{ color: color() }}>{Math.round(pct)}%</span>
                </div>
            </div>
            <div class="flex flex-col items-center mt-1">
                <span class="text-[10px] font-black tracking-widest uppercase" style={{ color: color() }}>{verdict}</span>
                <Show when={label}>
                    <span class="text-[8px] text-text_secondary uppercase tracking-tighter mt-0.5">{label}</span>
                </Show>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Signal Badge component
// ---------------------------------------------------------------------------
function SignalBadge(props) {
    const val = String(props.val || '').toUpperCase();
    const theme = createMemo(() => {
        if (val.includes('STRONG BUY') || val === 'BUY') return 'bg-green-500/20 text-green-400 border-green-500/40';
        if (val.includes('STRONG SELL') || val === 'SELL') return 'bg-red-500/20 text-red-400 border-red-500/40';
        return 'bg-white/5 text-text_secondary border-white/10';
    });

    return (
        <span class={`px-2 py-0.5 text-[8px] font-black tracking-widest border uppercase rounded-[2px] inline-block ${theme()}`}>
            {val}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Card renderer (Professional Style)
// ---------------------------------------------------------------------------
function CardBlock(props) {
    const { title, subtitle, fields, color } = props;
    const accentColor = color || '#22d3ee';

    return (
        <div class="copilot-card-v2" style={{ 'border-color': accentColor + '20' }}>
            <div class="copilot-card-header" style={{ 'border-left': `3px solid ${accentColor}` }}>
                <div class="copilot-card-title">{title}</div>
                <Show when={subtitle}>
                    <div class="copilot-card-subtitle">{subtitle}</div>
                </Show>
            </div>
            <div class="copilot-card-body">
                <For each={fields}>
                    {(field) => (
                        <div class="copilot-card-field">
                            <span class="copilot-card-label">{field.label}</span>
                            <span class="copilot-card-value font-mono">
                                <Show when={!['BUY', 'SELL', 'NEUTRAL'].includes(String(field.value).toUpperCase())} fallback={
                                    <SignalBadge val={field.value} />
                                }>
                                    {field.value}
                                </Show>
                            </span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Rich Response Renderer
// ---------------------------------------------------------------------------
export default function RichResponseRenderer(props) {
    const sortedComponents = createMemo(() => {
        return props.components || [];
    });

    return (
        <div class="copilot-rich-response">
            {/* Fallback for raw content (streaming or simple text) */}
            <Show when={(!props.components || props.components.length === 0) && props.content}>
                <MarkdownBlock
                    content={props.content}
                    isStreaming={props.isStreaming}
                    onExecuteCode={props.onExecuteCode}
                    onFixDiagram={props.onFixDiagram}
                />
            </Show>

            <div class="flex flex-col gap-3">
                <For each={sortedComponents()}>
                    {(comp, idx) => (
                        <RenderComponent
                            component={comp}
                            index={idx()}
                            onResearchStart={props.onResearchStart}
                            onExecuteCode={props.onExecuteCode}
                            onFixDiagram={props.onFixDiagram}
                            onPlanSwitch={props.onPlanSwitch}
                        />
                    )}
                </For>
            </div>
        </div>
    );
}

 function RenderComponent(props) {
     const { component, index } = props;
     const type = component.type;
     const animationDelay = () => `${index() * 0.08}s`;

     return (
         <Switch>
             {/* Markdown text */}
             <Match when={type === 'markdown'}>
                 <div class="copilot-component-enter" style={{ animationDelay: animationDelay() }}>
                     <MarkdownBlock content={component.data} onExecuteCode={props.onExecuteCode} />
                 </div>
             </Match>

             {/* ECharts chart */}
             <Match when={type === 'chart' && component.engine === 'echarts'}>
                 <div class="copilot-component-enter" style={{ animationDelay: animationDelay() }}>
                     <div class="copilot-chart-wrapper">
                         <LazyECharts options={component.options} />
                     </div>
                 </div>
             </Match>

             {/* Score Gauge */}
             <Match when={type === 'gauge' || (type === 'signal' && component.pct != null)}>
                 <div class="copilot-component-enter flex justify-center p-2" style={{ animationDelay: animationDelay() }}>
                     <ScoreGauge
                         pct={component.pct || 0}
                         verdict={component.verdict || component.value || 'NEUTRAL'}
                         label={component.label || component.title}
                     />
                 </div>
             </Match>

             {/* Leaflet map */}
             <Match when={type === 'map' && component.engine === 'leaflet'}>
                 <div class="copilot-component-enter" style={{ animationDelay: animationDelay() }}>
                     <div class="copilot-map-wrapper" style="height: 350px;">
                         <LazyLeafletMap
                             geojson={component.geojson}
                             center={component.center}
                             zoom={component.zoom}
                         />
                     </div>
                 </div>
             </Match>

             {/* Vessel Radar */}
             <Match when={type === 'vessel_radar'}>
                 <div class="copilot-component-enter" style={{ animationDelay: animationDelay() }}>
                     <div class="copilot-radar-wrapper" style="margin: 10px 0;">
                         <VesselRadarRenderer
                             lat={component.lat || component.latitude}
                             lon={component.lon || component.longitude || component.lng}
                             zoom={component.zoom}
                             name={component.location || component.display_name || component.title || component.name}
                         />
                     </div>
                 </div>
             </Match>

             {/* Data table */}
             <Match when={type === 'table'}>
                 <div class="copilot-component-enter" style={{ animationDelay: animationDelay() }}>
                     <TableBlock
                         headers={component.headers || []}
                         rows={component.rows || []}
                         title={component.title}
                         color={component.color}
                         onResearchStart={props.onResearchStart}
                     />
                 </div>
             </Match>

             {/* Tabs container (categorized chart panels) */}
             <Match when={type === 'tabs'}>
                 <div class="copilot-component-enter" style={{ animationDelay: animationDelay() }}>
                     <TabsContainer
                         tabs={component.tabs || []}
                         onResearchStart={props.onResearchStart}
                         onExecuteCode={props.onExecuteCode}
                     />
                 </div>
             </Match>

             {/* Single card */}
             <Match when={type === 'card'}>
                 <div class="copilot-component-enter" style={{ animationDelay: animationDelay() }}>
                     <CardBlock
                         title={component.title}
                         subtitle={component.subtitle}
                         fields={component.fields || []}
                         color={component.color}
                     />
                 </div>
             </Match>

             {/* Plan Switch Button */}
             <Match when={type === 'plan_switch'}>
                 <div class="copilot-component-enter" style={{ animationDelay: animationDelay() }}>
                     <div class="copilot-plan-switch mt-4 p-4 border border-[#22d3ee]/20 rounded-md bg-[#22d3ee]/5 text-center">
                         <div class="text-[#22d3ee] font-semibold mb-2">Plan is Ready for Execution</div>
                         <button
                             class="px-4 py-2 bg-[#22d3ee] text-[#0a0a0a] rounded hover:bg-[#22d3ee]/90 font-medium text-sm transition-colors"
                             onClick={() => props.onPlanSwitch && props.onPlanSwitch(component.data?.plan_path)}
                         >
                             {component.data?.text || "Switch to Build?"}
                         </button>
                     </div>
                 </div>
             </Match>

             {/* Cards layout */}
             <Match when={type === 'cards'}>
                 <div class="copilot-component-enter" style={{ animationDelay: animationDelay() }}>
                     <div class="copilot-cards-grid">
                         <For each={component.cards || []}>
                             {(card) => (
                                 <CardBlock
                                     title={card.title}
                                     subtitle={card.subtitle}
                                     fields={card.fields || []}
                                     color={card.color}
                                 />
                             )}
                         </For>
                     </div>
                 </div>
             </Match>

             {/* Fallback */}
             <Match when={true}>
                 <div class="copilot-unknown-component copilot-component-enter" style={{ animationDelay: animationDelay() }}>
                     [Unsupported: {type}]
                 </div>
             </Match>
         </Switch>
     );
}

// ---------------------------------------------------------------------------
// Tabs Container — renders categorized tabbed chart panels
// ---------------------------------------------------------------------------
function TabsContainer(props) {
    const [activeTab, setActiveTab] = createSignal(0);
    const tabs = props.tabs || [];

    return (
        <div class="copilot-tabs-container">
            <div class="copilot-tabs-bar" role="tablist">
                <For each={tabs}>
                    {(tab, idx) => (
                        <button
                            class="copilot-tab-btn"
                            classList={{ active: activeTab() === idx() }}
                            onClick={() => setActiveTab(idx())}
                            role="tab"
                            aria-selected={activeTab() === idx()}
                        >
                            {tab.title || `Tab ${idx() + 1}`}
                        </button>
                    )}
                </For>
            </div>
            <div class="copilot-tab-content" role="tabpanel">
                <For each={tabs}>
                    {(tab, idx) => (
                        <Show when={activeTab() === idx()}>
                            {/* Render the tab's inner component based on its type */}
                            <Switch>
                                <Match when={tab.type === 'chart' && tab.engine === 'echarts'}>
                                    <div class="copilot-chart-wrapper">
                                        <LazyECharts options={tab.options} />
                                    </div>
                                </Match>
                                <Match when={tab.type === 'table'}>
                                    <TableBlock
                                        headers={tab.headers || []}
                                        rows={tab.rows || []}
                                        title={tab.title}
                                        onResearchStart={props.onResearchStart}
                                    />
                                </Match>
                                <Match when={tab.type === 'markdown'}>
                                    <MarkdownBlock content={tab.data} onExecuteCode={props.onExecuteCode} />
                                </Match>
                                {/* Vessel Radar inside tabs */}
                                <Match when={tab.type === 'vessel_radar'}>
                                    <div class="copilot-radar-wrapper" style="margin: 10px 0;">
                                        <VesselRadarRenderer
                                            lat={tab.lat || tab.latitude}
                                            lon={tab.lon || tab.longitude || tab.lng}
                                            zoom={tab.zoom}
                                            name={tab.location || tab.display_name || tab.title || tab.name}
                                        />
                                    </div>
                                </Match>
                                {/* Fallback: render nested tabs recursively */}
                                <Match when={tab.type === 'tabs'}>
                                    <TabsContainer
                                        tabs={tab.tabs || []}
                                        onResearchStart={props.onResearchStart}
                                        onExecuteCode={props.onExecuteCode}
                                    />
                                </Match>
                                {/* Generic fallback — try rendering as chart if options exist */}
                                <Match when={tab.type !== 'chart' && tab.type !== 'table' && tab.type !== 'markdown' && tab.type !== 'tabs' && tab.type !== 'vessel_radar'}>
                                    <Show when={tab.options} fallback={
                                        <div class="copilot-unknown-component">
                                            [Unsupported tab content: {tab.type}]
                                        </div>
                                    }>
                                        <div class="copilot-chart-wrapper">
                                            <LazyECharts options={tab.options} />
                                        </div>
                                    </Show>
                                </Match>
                            </Switch>
                        </Show>
                    )}
                </For>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Lazy-loaded ECharts wrapper
// ---------------------------------------------------------------------------
function LazyECharts(props) {
    const [ChartComponent, setChartComponent] = createSignal(null);
    const [loaded, setLoaded] = createSignal(false);
    const [error, setError] = createSignal(null);

    createEffect(() => {
        ensureECharts()
            .then((comp) => {
                setChartComponent(() => comp);
                setLoaded(true);
            })
            .catch((e) => setError(e.message));
    });

    return (
        <Show when={loaded()} fallback={
            <div class="copilot-lazy-loading">
                <Show when={!error()} fallback={<span class="text-red-400">Chart error: {error()}</span>}>
                    <span class="copilot-loading-pulse">Loading chart...</span>
                </Show>
            </div>
        }>
            <Dynamic component={ChartComponent()} options={props.options} />
        </Show>
    );
}

// ---------------------------------------------------------------------------
// Lazy-loaded Leaflet map wrapper
// ---------------------------------------------------------------------------
function LazyLeafletMap(props) {
    const [MapComponent, setMapComponent] = createSignal(null);
    const [loaded, setLoaded] = createSignal(false);
    const [error, setError] = createSignal(null);

    createEffect(() => {
        ensureLeaflet()
            .then((comp) => {
                setMapComponent(() => comp);
                setLoaded(true);
            })
            .catch((e) => setError(e.message));
    });

    return (
        <Show when={loaded()} fallback={
            <div class="copilot-lazy-loading" style="height: 100%;">
                <Show when={!error()} fallback={<span class="text-red-400">Map error: {error()}</span>}>
                    <span class="copilot-loading-pulse">Loading map...</span>
                </Show>
            </div>
        }>
            <MapComponent
                geojson={props.geojson}
                center={props.center}
                zoom={props.zoom}
            />
        </Show>
    );
}

// ---------------------------------------------------------------------------
// Image & Diagram Modal — shows enlarged content (Singleton)
// ---------------------------------------------------------------------------
export function ImageModal() {
    const [modalData, setModalData] = createSignal(null);

    createEffect(() => {
        const handler = (e) => setModalData(e.detail);
        window.addEventListener('copilot-open-image-modal', handler);
        return () => window.removeEventListener('copilot-open-image-modal', handler);
    });

    return (
        <Show when={modalData()}>
            <div class="copilot-image-modal-overlay" onClick={() => setModalData(null)}>
                <div class="copilot-image-modal-content" onClick={e => e.stopPropagation()}>
                    <div class="copilot-modal-header">
                        <span class="modal-title">{modalData().type ? `${modalData().type.toUpperCase()} Diagram` : 'Enlarged View'}</span>
                        <button class="modal-close-inner" onClick={() => setModalData(null)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    <div class="copilot-modal-body">
                        <Show when={modalData().svg} fallback={
                            <img src={modalData().url} alt="Generated Graph" />
                        }>
                            <div class="copilot-modal-svg-wrap" innerHTML={modalData().svg} />
                        </Show>
                    </div>

                    <div class="modal-footer">
                        <Show when={modalData().url}>
                            <a href={modalData().url} download="graph.png" class="download-btn">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                </svg>
                                Download PNG
                            </a>
                        </Show>
                        <Show when={modalData().svg}>
                            <button 
                                class="download-btn"
                                onClick={() => {
                                    const blob = new Blob([modalData().svg], { type: 'image/svg+xml' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `diagram-${Date.now()}.svg`;
                                    link.click();
                                    URL.revokeObjectURL(url);
                                }}
                            >
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                </svg>
                                Download SVG
                            </button>
                        </Show>
                    </div>
                </div>
            </div>
        </Show>
    );
}

