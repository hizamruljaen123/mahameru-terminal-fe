import { createSignal, onMount, createEffect, Show, onCleanup, For } from 'solid-js';
import { ensureMermaid } from './RichResponseRenderer';
import { applyMermaidTheme, MERMAID_THEMES } from './theme_mermaid';

/**
 * DiagramRenderer — Renders Mermaid and PlantUML diagrams
 * Uses Mermaid.js for 'mermaid' blocks and PlantUML server for 'plantuml' blocks.
 */
export default function DiagramRenderer(props) {
    const { type, code } = props;
    const [svg, setSvg] = createSignal('');
    const [error, setError] = createSignal(null);
    const [loading, setLoading] = createSignal(true);
    const [showCode, setShowCode] = createSignal(false);
    const [selectedTheme, setSelectedTheme] = createSignal('dark');
    const [renderKey, setRenderKey] = createSignal(0); // Force re-render on demand

    let containerRef;
    let renderTimeout;

    // React to code, type, or theme changes
    createEffect(() => {
        const t = props.type;
        const theme = selectedTheme();
        
        if (t === 'mermaid') {
            renderMermaid();
        } else if (t === 'plantuml') {
            renderPlantUML();
        }
    });

    onCleanup(() => {
        if (renderTimeout) clearTimeout(renderTimeout);
    });

    async function renderMermaid() {
        setLoading(true);
        setError(null);
        setSvg('');

        const rawCode = (props.code || '').trim();
        try {
            await ensureMermaid();
            applyMermaidTheme(selectedTheme());

            const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

            const cleanCode = rawCode
                .replace(/&gt;/g, '>')
                .replace(/&lt;/g, '<')
                .replace(/&amp;/g, '&');

            // 1. Validate syntax first to avoid Mermaid injecting errors into the body
            try {
                await window.mermaid.parse(cleanCode, { suppressErrors: false });
            } catch (parseError) {
                console.error('[DiagramRenderer] Parse error:', parseError);
                setError('Syntax error in diagram');
                setSvg('');
                setLoading(false);
                return;
            }

            // 2. Render only if syntax is valid
            try {
                const { svg: renderedSvg } = await window.mermaid.render(id, cleanCode);
                setSvg(renderedSvg);
                setError(null);
                setLoading(false);
            } catch (renderError) {
                console.error('[DiagramRenderer] Render error:', renderError);
                setError('Failed to render diagram');
                setSvg('');
                setLoading(false);
            }
        } catch (e) {
            console.error('[DiagramRenderer] Init error:', e);
            setError('Failed to initialize engine');
            setLoading(false);
        }
    }

    async function renderPlantUML() {
        setLoading(true);
        setError(null);
        setSvg('');

        const rawCode = (props.code || '').trim();
        try {
            const encoded = plantUmlEncode(rawCode);
            const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;

            const resp = await fetch(url, { timeout: 10000 });
            if (resp.ok) {
                const svgText = await resp.text();
                setSvg(svgText);
                setError(null);
                setLoading(false);
            } else {
                throw new Error(`PlantUML server returned ${resp.status}`);
            }
        } catch (e) {
            console.error('[DiagramRenderer] PlantUML Error:', e);
            setError(e.message || 'Failed to render PlantUML diagram');
            setSvg('');
            setLoading(false);
        }
    }

    function retryRender() {
        if (props.type === 'mermaid') {
            renderMermaid();
        } else if (props.type === 'plantuml') {
            renderPlantUML();
        }
    }

    function downloadSVG() {
        const svgData = svg();
        if (!svgData) return;
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `diagram-${type}-${Date.now()}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    return (
        <div class="copilot-diagram-wrapper" ref={containerRef}>
            <div class="copilot-diagram-header">
                <div class="flex items-center gap-3">
                    <span class="copilot-diagram-type">{type}</span>
                    <Show when={type === 'mermaid'}>
                        <div class="copilot-diagram-themes">
                            <For each={Object.keys(MERMAID_THEMES)}>
                                {(theme) => (
                                    <button
                                        class={`theme-dot ${theme} ${selectedTheme() === theme ? 'active' : ''}`}
                                        onClick={() => setSelectedTheme(theme)}
                                        title={`Switch to ${theme} theme`}
                                    />
                                )}
                            </For>
                        </div>
                    </Show>
                </div>
                <div class="copilot-diagram-actions">
                    <button
                        class={`copilot-diagram-toggle ${showCode() ? 'active' : ''}`}
                        onClick={() => setShowCode(!showCode())}
                        title={showCode() ? "Show Diagram" : "Show Code"}
                    >
                        <Show when={showCode()} fallback={
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                            </svg>
                        }>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                        </Show>
                        <span>{showCode() ? 'Diagram' : 'Code'}</span>
                    </button>
                    <Show when={svg()}>
                        <button
                            class="copilot-diagram-maximize"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('copilot-open-image-modal', {
                                    detail: { svg: svg(), type }
                                }));
                            }}
                            title="Maximize Diagram"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 3 21 3 21 9" />
                                <polyline points="9 21 3 21 3 15" />
                                <line x1="21" y1="3" x2="14" y2="10" />
                                <line x1="3" y1="21" x2="10" y2="14" />
                            </svg>
                        </button>
                        <button
                            class="copilot-diagram-download"
                            onClick={downloadSVG}
                            title="Download SVG"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        </button>
                    </Show>
                    <button
                        class="copilot-diagram-copy"
                        onClick={async () => {
                            await navigator.clipboard.writeText(code);
                        }}
                        title="Copy code"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div 
                class="copilot-diagram-body"
                style={{ 
                    background: type === 'mermaid' ? MERMAID_THEMES[selectedTheme()].containerBg : 'rgba(0, 0, 0, 0.2)',
                    transition: 'background 0.3s ease',
                    "border-radius": '0 0 12px 12px',
                    margin: '-16px',
                    "margin-top": '0',
                    padding: '16px',
                    "min-height": '150px',
                    display: 'flex',
                    "flex-direction": 'column',
                    "justify-content": 'center',
                    "align-items": 'center',
                    position: 'relative'
                }}
            >

            <Show when={showCode()}>
                <div class="copilot-diagram-code-view">
                    <pre><code>{code}</code></pre>
                </div>
            </Show>

            <Show when={!showCode()}>
                <Show when={loading()}>
                    <div class="copilot-diagram-loading">
                        <div class="tc-spinner"></div>
                        <span>Rendering {type} diagram...</span>
                    </div>
                </Show>
                <Show when={error()}>
                    <div class="copilot-diagram-error-container">
                        <div class="copilot-diagram-error">
                            <div class="flex items-center justify-between gap-3 flex-wrap">
                                <div class="flex items-center gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span>{type} rendering failed: {error()}</span>
                                </div>
                                <Show when={props.onFixDiagram}>
                                    <button
                                        class="copilot-diagram-fix-btn"
                                        onClick={() => props.onFixDiagram(type, code, error())}
                                        title={`Regenerate ${type} code with active AI model`}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                                        </svg>
                                        Regenerate with AI
                                    </button>
                                </Show>
                            </div>
                        </div>
                        <pre class="copilot-diagram-raw-fallback">{code}</pre>
                    </div>
                </Show>
                <Show when={svg()}>
                    <div class="copilot-diagram-svg" innerHTML={svg()} />
                </Show>
            </Show>
        </div>
    </div>
);
}

/**
 * PlantUML Encoding Helper
 * Ported from official PlantUML javascript example
 */
function plantUmlEncode(text) {
    // This is a simplified version. PlantUML uses a specific deflate + custom 64-bit encoding.
    // For a robust implementation without external zlib, we can use a small helper or 
    // simply use the HEX encoding if the server supports it, but compressed is better.
    // Let's use a known compact implementation.

    function encode64(data) {
        let r = "";
        for (let i = 0; i < data.length; i += 3) {
            if (i + 2 === data.length) {
                r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), 0);
            } else if (i + 1 === data.length) {
                r += append3bytes(data.charCodeAt(i), 0, 0);
            } else {
                r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), data.charCodeAt(i + 2));
            }
        }
        return r;
    }

    function append3bytes(b1, b2, b3) {
        let c1 = b1 >> 2;
        let c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
        let c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
        let c4 = b3 & 0x3F;
        let r = "";
        r += encode6bit(c1 & 0x3F);
        r += encode6bit(c2 & 0x3F);
        r += encode6bit(c3 & 0x3F);
        r += encode6bit(c4 & 0x3F);
        return r;
    }

    function encode6bit(b) {
        if (b < 10) return String.fromCharCode(48 + b);
        b -= 10;
        if (b < 26) return String.fromCharCode(65 + b);
        b -= 26;
        if (b < 26) return String.fromCharCode(97 + b);
        b -= 26;
        if (b === 0) return '-';
        if (b === 1) return '_';
        return '?';
    }

    // For better results, we should use pako (zlib) to deflate.
    // Since we don't have it yet, we'll try a simpler UTF-8 to hex fallback 
    // or just assume the user might provide pako later.
    // Actually, PlantUML server supports "~h" prefix for hex.

    function toHex(str) {
        let result = '';
        for (let i = 0; i < str.length; i++) {
            result += str.charCodeAt(i).toString(16).padStart(2, '0');
        }
        return "~h" + result;
    }

    // HEX is safer without external dependencies
    return toHex(unescape(encodeURIComponent(text)));
}
