import { createSignal, createEffect, createMemo, onCleanup, onMount, Show, For, Switch, Match } from 'solid-js';
import { Dynamic } from 'solid-js/web';
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

async function ensureHighlightJs() {
    if (hljsLoaded) return;
    try {
        // Load CSS
        if (!document.querySelector('link[href*="highlight.js"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
            document.head.appendChild(link);
        }
        // Load JS
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
    }
}

async function ensureKaTeX() {
    if (katexLoaded) return;
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
    }
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
            renderEnhancedMarkdown(contentEl, props.content, hlReady(), katexReady());
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
function renderEnhancedMarkdown(container, text, hlReady, katexReady) {
    if (!text) { container.innerHTML = ''; return; }

    // 1. Extract and render Math to prevent marked from messing it up
    const mathBlocks = [];
    let processedText = text;

    if (katexReady && window.katex) {
        processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
            const id = `___MATH_${mathBlocks.length}___`;
            try {
                mathBlocks.push(window.katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false }));
            } catch {
                mathBlocks.push(`<div class="copilot-katex-error">${formula}</div>`);
            }
            return id;
        });

        processedText = processedText.replace(/\$(.+?)\$/g, (_, formula) => {
            const id = `___MATH_${mathBlocks.length}___`;
            try {
                mathBlocks.push(window.katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false }));
            } catch {
                mathBlocks.push(`<span class="copilot-katex-error">${formula}</span>`);
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

    // 4. Restore Math
    for (let i = 0; i < mathBlocks.length; i++) {
        safeHtml = safeHtml.replace(`___MATH_${i}___`, mathBlocks[i]);
    }

    container.innerHTML = safeHtml;

    // 5. Post-process DOM for Tables and Code blocks
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
            setTimeout(() => {
                copyBtn.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
            }, 2000);
        };

        header.appendChild(langBadge);
        header.appendChild(copyBtn);

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);

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
function TableBlock(props) {
    const { headers, rows, title, onResearchStart } = props;

    return (
        <div class="copilot-table">
            <Show when={title}>
                <div class="copilot-table-title">{title}</div>
            </Show>
            <div class="copilot-table-scroll">
                <table>
                    <thead>
                        <tr>
                            <For each={headers}>
                                {(header) => (
                                    <th>{header}</th>
                                )}
                            </For>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={rows}>
                            {(row, rowIdx) => (
                                <tr>
                                    <For each={row}>
                                        {(cell, cellIdx) => (
                                            <td classList={{ 'copilot-table-first': cellIdx() === 0 }}>
                                                <TickerLink 
                                                    value={cell} 
                                                    onResearchStart={onResearchStart} 
                                                />
                                            </td>
                                        )}
                                    </For>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Card renderer
// ---------------------------------------------------------------------------
function CardBlock(props) {
    const { title, subtitle, fields, color } = props;
    const accentColor = color || '#22d3ee';

    return (
        <div class="copilot-card" style={{ 'border-color': accentColor + '30' }}>
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
                            <span class="copilot-card-value">{field.value}</span>
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
                <MarkdownBlock content={props.content} />
            </Show>

            <For each={sortedComponents()}>
                {(comp, idx) => (
                    <RenderComponent
                        component={comp}
                        index={idx()}
                        onResearchStart={props.onResearchStart}
                    />
                )}
            </For>
        </div>
    );
}

function RenderComponent(props) {
    const { component, index } = props;
    const type = component.type;

    return (
        <Switch>
            {/* Markdown text */}
            <Match when={type === 'markdown'}>
                <MarkdownBlock content={component.data} />
            </Match>

            {/* ECharts chart */}
            <Match when={type === 'chart' && component.engine === 'echarts'}>
                <div class="copilot-chart-wrapper">
                    <LazyECharts options={component.options} />
                </div>
            </Match>

            {/* Leaflet map */}
            <Match when={type === 'map' && component.engine === 'leaflet'}>
                <div class="copilot-map-wrapper" style="height: 350px;">
                    <LazyLeafletMap
                        geojson={component.geojson}
                        center={component.center}
                        zoom={component.zoom}
                    />
                </div>
            </Match>

            {/* Data table */}
            <Match when={type === 'table'}>
                <TableBlock
                    headers={component.headers || []}
                    rows={component.rows || []}
                    title={component.title}
                    onResearchStart={props.onResearchStart}
                />
            </Match>

            {/* Tabs container (categorized chart panels) */}
            <Match when={type === 'tabs'}>
                <TabsContainer 
                    tabs={component.tabs || []} 
                    onResearchStart={props.onResearchStart}
                />
            </Match>

            {/* SSE Stream trigger */}
            <Match when={type === 'sse_stream'}>
                <button
                    onClick={() => props.onResearchStart?.(component.symbols || '', component.analysis_type || 'full')}
                    class="copilot-sse-btn"
                >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 3l14 9-14 9V3z" />
                    </svg>
                    Start Research Stream
                </button>
            </Match>

            {/* Single card */}
            <Match when={type === 'card'}>
                <CardBlock
                    title={component.title}
                    subtitle={component.subtitle}
                    fields={component.fields || []}
                    color={component.color}
                />
            </Match>

            {/* Cards layout */}
            <Match when={type === 'cards'}>
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
            </Match>

            {/* Fallback */}
            <Match when={true}>
                <div class="copilot-unknown-component">
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
                                    <MarkdownBlock content={tab.data} />
                                </Match>
                                {/* Fallback: render nested tabs recursively */}
                                <Match when={tab.type === 'tabs'}>
                                    <TabsContainer 
                                        tabs={tab.tabs || []} 
                                        onResearchStart={props.onResearchStart}
                                    />
                                </Match>
                                {/* Generic fallback — try rendering as chart if options exist */}
                                <Match when={tab.type !== 'chart' && tab.type !== 'table' && tab.type !== 'markdown' && tab.type !== 'tabs'}>
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
