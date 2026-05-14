import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';

/**
 * ============================================================================
 *  MAHAMERU COPILOT — ECharts Renderer
 *  Renders full ECharts configuration objects into interactive charts.
 *  Lazy-loads echarts from CDN to avoid bundle size impact.
 * ============================================================================
 */

/**
 * Props:
 *   options: Object - Full ECharts configuration object
 *   style: Object - Optional container styles
 *   theme: string - 'dark' (default) or 'light'
 */
export default function EChartsRenderer(props) {
    let containerRef;
    let resizeObserver = null;
    let fallbackResizeHandler = null;
    let delayedResizeA = null;
    let delayedResizeB = null;

    const [echartsLib, setEchartsLib] = createSignal(null);
    const [chartInstance, setChartInstance] = createSignal(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);

    function cleanupResizeBindings() {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }

        if (fallbackResizeHandler) {
            window.removeEventListener('resize', fallbackResizeHandler);
            fallbackResizeHandler = null;
        }

        if (delayedResizeA) {
            clearTimeout(delayedResizeA);
            delayedResizeA = null;
        }

        if (delayedResizeB) {
            clearTimeout(delayedResizeB);
            delayedResizeB = null;
        }
    }

    function cleanupChart() {
        cleanupResizeBindings();
        const instance = chartInstance();
        if (instance) {
            try {
                instance.dispose();
            } catch (err) {
                console.warn('[ECharts] Dispose warning:', err);
            }
            setChartInstance(null);
        }
    }

    onMount(async () => {
        try {
            const echarts = await import('echarts');
            setEchartsLib(echarts);
            setLoading(false);
        } catch (e) {
            setError(`Failed to load ECharts: ${e.message}`);
            setLoading(false);
        }
    });

    createEffect(() => {
        const ecModule = echartsLib();
        if (!ecModule || !containerRef) return;

        cleanupChart();
        setError(null);

        try {
            const ec = ecModule.default || ecModule;
            if (typeof ec.init !== 'function') {
                throw new Error('echarts.init is not a function. Check import format.');
            }

            const instance = ec.init(containerRef, props.theme || 'dark', {
                renderer: 'canvas',
            });

            setChartInstance(instance);
        } catch (err) {
            console.error('[ECharts] Init Error:', err);
            setError(`Chart Init Error: ${err.message}`);
        }
    });

    createEffect(() => {
        const instance = chartInstance();
        const opts = props.options;
        if (!instance || !opts) return;

        cleanupResizeBindings();
        setError(null);

        try {
            instance.setOption(opts, { notMerge: true, lazyUpdate: false });

            if (window.ResizeObserver && containerRef) {
                resizeObserver = new ResizeObserver(() => {
                    try {
                        instance.resize();
                    } catch (err) {
                        console.warn('[ECharts] ResizeObserver resize warning:', err);
                    }
                });
                resizeObserver.observe(containerRef);
            } else {
                fallbackResizeHandler = () => {
                    try {
                        instance.resize();
                    } catch (err) {
                        console.warn('[ECharts] Window resize warning:', err);
                    }
                };
                window.addEventListener('resize', fallbackResizeHandler);
            }

            delayedResizeA = setTimeout(() => {
                try {
                    instance.resize();
                } catch (err) {
                    console.warn('[ECharts] Delayed resize warning:', err);
                }
            }, 150);

            delayedResizeB = setTimeout(() => {
                try {
                    instance.resize();
                } catch (err) {
                    console.warn('[ECharts] Secondary delayed resize warning:', err);
                }
            }, 500);
        } catch (err) {
            console.error('[ECharts] Set Option Error:', err);
            setError(`Chart Render Error: ${err.message}`);
        }
    });

    onCleanup(() => {
        cleanupChart();
    });

    return (
        <div class="echarts-container relative w-full" style={props.style || { height: '400px', 'min-height': '300px' }}>
            {loading() && (
                <div class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-gray-900/60">
                    <div class="flex items-center gap-2 text-xs text-gray-500">
                        <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                        Loading chart...
                    </div>
                </div>
            )}

            {error() && (
                <div class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-gray-900/60">
                    <span class="text-xs text-red-400">{error()}</span>
                </div>
            )}

            <div
                ref={containerRef}
                class="h-full w-full min-h-[300px]"
                style={{ visibility: loading() ? 'hidden' : 'visible' }}
            />
        </div>
    );
}
