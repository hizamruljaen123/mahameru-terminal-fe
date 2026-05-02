import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import { getResearchStreamUrl, parseSSEStream } from './copilotApi.js';

/**
 * ============================================================================
 *  MAHAMERU COPILOT — SSE Stream Handler
 *  Consumes the 7-stage Deep Research Pipeline SSE endpoint and renders
 *  progressive markdown content as each stage completes.
 *
 *  Displays:
 *  - Stage progress bar
 *  - Stage descriptions as they execute
 *  - Streaming markdown content rendered in real-time
 *  - Final report on completion
 * ============================================================================
 */

/**
 * Props:
 *   symbols: string - Comma-separated symbols
 *   analysisType: string - 'full', 'fundamental', 'technical', 'comparative'
 *   onComplete: () => void - Callback when pipeline finishes
 *   onError: (error: string) => void - Callback on error
 */
export default function SSEStream(props) {
    const [progress, setProgress] = createSignal(0);
    const [currentStage, setCurrentStage] = createSignal('');
    const [currentStageName, setCurrentStageName] = createSignal('');
    const [content, setContent] = createSignal('');
    const [isRunning, setIsRunning] = createSignal(true);
    const [isComplete, setIsComplete] = createSignal(false);
    const [error, setError] = createSignal(null);
    const [stages, setStages] = createSignal([]);
    const [researchId, setResearchId] = createSignal('');
    const [finalReport, setFinalReport] = createSignal('');

    let abortController = null;

    const startStream = async () => {
        abortController = new AbortController();

        try {
            const url = getResearchStreamUrl(props.symbols, props.analysisType);
            const response = await fetch(url, { signal: abortController.signal });

            if (!response.ok) {
                throw new Error(`Research stream error (${response.status})`);
            }

            await parseSSEStream(
                response,
                (eventType, data) => {
                    switch (eventType) {
                        case 'meta':
                            setResearchId(data.research_id || '');
                            setStages(Array.from({ length: data.total_stages || 7 }, (_, i) => ({
                                id: i + 1,
                                name: '',
                                status: 'pending',
                            })));
                            break;

                        case 'stage_start':
                            setCurrentStage(data.stage);
                            setCurrentStageName(data.name);
                            setProgress(data.progress || 0);
                            setStages(prev => prev.map(s =>
                                s.id === parseInt(data.stage?.split('/')[0]) || s.id === data.stage
                                    ? { ...s, name: data.name, status: 'running' }
                                    : s
                            ));
                            break;

                        case 'chunk':
                            setContent(prev => prev + (data.content || ''));
                            setProgress(data.progress || 0);
                            break;

                        case 'stage_complete':
                            setProgress(data.progress || 0);
                            setStages(prev => prev.map(s =>
                                s.id === parseInt(data.stage?.split('/')[0]) || s.id === data.stage
                                    ? { ...s, status: 'complete' }
                                    : s
                            ));
                            break;

                        case 'complete':
                            setFinalReport(data.report || '');
                            setProgress(100);
                            setIsComplete(true);
                            setIsRunning(false);
                            props.onComplete?.();
                            break;

                        case 'error':
                            setError(data.error || 'Unknown stream error');
                            setIsRunning(false);
                            props.onError?.(data.error);
                            break;

                        case 'done':
                            // Stream finished
                            break;
                    }
                },
                (err) => {
                    if (err.name !== 'AbortError') {
                        setError(err.message);
                        setIsRunning(false);
                        props.onError?.(err.message);
                    }
                }
            );
        } catch (e) {
            if (e.name !== 'AbortError') {
                setError(e.message);
                setIsRunning(false);
                props.onError?.(e.message);
            }
        }
    };

    // Start stream on mount
    createEffect(() => {
        startStream();
    });

    // Cleanup on unmount
    onCleanup(() => {
        if (abortController) {
            abortController.abort();
        }
    });

    // Cancel handler
    const cancel = () => {
        if (abortController) {
            abortController.abort();
        }
        setIsRunning(false);
    };

    // Retry handler
    const retry = () => {
        setError(null);
        setContent('');
        setProgress(0);
        setCurrentStage('');
        setIsComplete(false);
        setIsRunning(true);
        startStream();
    };

    return (
        <div class="copilot-sse-stream rounded-lg border border-gray-700 bg-gray-900/60 overflow-hidden">
            {/* Header */}
            <div class="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-medium text-cyan-400 tracking-wider">
                        Deep Research Pipeline
                    </span>
                    <Show when={researchId()}>
                        <span class="text-[10px] text-gray-500 font-mono">ID: {researchId()}</span>
                    </Show>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">{props.symbols}</span>
                    <Show when={isRunning() && !isComplete()}>
                        <button
                            onClick={cancel}
                            class="text-[10px] px-2 py-0.5 bg-red-800/50 hover:bg-red-700/50 text-red-300 rounded transition-colors"
                        >
                            Cancel
                        </button>
                    </Show>
                    <Show when={error() || isComplete()}>
                        <button
                            onClick={retry}
                            class="text-[10px] px-2 py-0.5 bg-cyan-800/50 hover:bg-cyan-700/50 text-cyan-300 rounded transition-colors"
                        >
                            Retry
                        </button>
                    </Show>
                </div>
            </div>

            {/* Progress bar */}
            <div class="px-4 py-2 border-b border-gray-800">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] text-gray-400 font-mono">
                        <Show when={currentStage()} fallback="Initializing...">
                            {currentStage()}: {currentStageName()}
                        </Show>
                    </span>
                    <span class="text-[10px] text-gray-500 font-mono">{progress()}%</span>
                </div>
                <div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        class="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progress()}%` }}
                    />
                </div>
            </div>

            {/* Stage indicators */}
            <div class="px-4 py-2 border-b border-gray-800 flex gap-2 flex-wrap">
                <For each={stages()}>
                    {(stage) => (
                        <div
                            class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors"
                            classList={{
                                'bg-gray-800 text-gray-500': stage.status === 'pending',
                                'bg-cyan-900/50 text-cyan-300 animate-pulse': stage.status === 'running',
                                'bg-green-900/30 text-green-400': stage.status === 'complete',
                            }}
                        >
                            <Show when={stage.status === 'complete'}>
                                <span>✓</span>
                            </Show>
                            <Show when={stage.status === 'running'}>
                                <span class="inline-block w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                            </Show>
                            <span>Stage {stage.id}</span>
                        </div>
                    )}
                </For>
            </div>

            {/* Streaming content */}
            <div class="px-4 py-3 max-h-96 overflow-y-auto">
                <Show when={error()}>
                    <div class="text-red-400 text-xs mb-2">⚠ Error: {error()}</div>
                </Show>

                <Show when={content() && !isComplete()}>
                    <div class="prose prose-invert prose-xs max-w-none text-xs text-gray-300">
                        <StreamingMarkdown content={content()} />
                    </div>
                </Show>

                <Show when={finalReport()}>
                    <div class="prose prose-invert prose-xs max-w-none text-xs text-gray-200">
                        <StreamingMarkdown content={finalReport()} />
                    </div>
                </Show>

                <Show when={!content() && !error() && isRunning()}>
                    <div class="flex items-center gap-2 text-gray-500 text-xs">
                        <span class="inline-block w-2 h-2 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        Waiting for research pipeline to initialize...
                    </div>
                </Show>

                <Show when={!content() && !error() && !isRunning() && !isComplete()}>
                    <div class="text-gray-500 text-xs italic">Stream cancelled.</div>
                </Show>
            </div>

            {/* Completion status */}
            <Show when={isComplete()}>
                <div class="px-4 py-2 border-t border-gray-700 bg-green-900/20">
                    <div class="flex items-center gap-2 text-xs text-green-400">
                        <span>✓</span>
                        <span>Research pipeline complete for {props.symbols}</span>
                    </div>
                </div>
            </Show>
        </div>
    );
}

/**
 * Simple streaming markdown renderer for progressive content.
 * Renders markdown as it arrives, handling partial blocks gracefully.
 */
function StreamingMarkdown(props) {
    let contentRef;

    createEffect(() => {
        if (contentRef && props.content) {
            contentRef.innerHTML = renderStreamingMarkdown(props.content);
            // Scroll to bottom
            const container = contentRef.closest('.overflow-y-auto');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }
    });

    return <div ref={contentRef} />;
}

function renderStreamingMarkdown(text) {
    if (!text) return '';

    let html = text
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1 text-cyan-400">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold mt-4 mb-1 text-cyan-300">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mt-4 mb-2 text-cyan-200">$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-amber-300 text-xs font-mono">$1</code>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="text-blue-400 underline">$1</a>')
        .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$1. $2</li>')
        .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-gray-600 pl-2 italic text-gray-400 my-1">$1</blockquote>')
        .replace(/\n\n/g, '</p><p class="mb-1">')
        .replace(/\n/g, '<br />');

    return `<p class="mb-1">${html}</p>`;
}
