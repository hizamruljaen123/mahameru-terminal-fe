import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';

/**
 * ============================================================================
 *  MAHAMERU COPILOT — ECharts Renderer
 *  Renders full ECharts configuration objects into interactive charts.
 *  Lazy-loads echarts from CDN to avoid bundle size impact.
 * ============================================================================
 */

const ECHARTS_CDN = 'https://cdn.jsdelivr.net/npm/echarts@6/dist/echarts.min.js';

/**
 * Props:
 *   options: Object - Full ECharts configuration object
 *   style: Object - Optional container styles
 *   theme: string - 'dark' (default) or 'light'
 */
export default function EChartsRenderer(props) {
    let containerRef;
    const [echartsLib, setEchartsLib] = createSignal(null);
    const [chartInstance, setChartInstance] = createSignal(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);

    // Load ECharts library dynamically from node_modules
    onMount(async () => {
        try {
            const echarts = await import('echarts');
            setEchartsLib(() => echarts);
            setLoading(false);
        } catch (e) {
            setError('Failed to load ECharts: ' + e.message);
            setLoading(false);
        }
    });

    // Initialize chart when library loads and container is ready
    createEffect(() => {
        const ecModule = echartsLib();
        if (!ecModule || !containerRef) return;

        try {
            // Handle both ES modules and CJS default exports
            const ec = ecModule.default || ecModule;
            
            if (typeof ec.init !== 'function') {
                throw new Error("echarts.init is not a function. Check import format.");
            }

            const instance = ec.init(containerRef, props.theme || 'dark', {
                renderer: 'canvas',
            });
            setChartInstance(instance);

            onCleanup(() => {
                instance.dispose();
            });
        } catch (err) {
            console.error("[ECharts] Init Error:", err);
            setError("Chart Init Error: " + err.message);
        }
    });

    // Update chart options whenever they change
    createEffect(() => {
        const instance = chartInstance();
        const opts = props.options;
        if (!instance || !opts) return;

        try {
            instance.setOption(opts, { notMerge: true });
            
            // Handle element resize with ResizeObserver
            if (window.ResizeObserver && containerRef) {
                const resizeObserver = new ResizeObserver(() => {
                    instance.resize();
                });
                resizeObserver.observe(containerRef);
                onCleanup(() => resizeObserver.disconnect());
            } else {
                // Fallback to window resize
                const handleResize = () => instance.resize();
                window.addEventListener('resize', handleResize);
                onCleanup(() => window.removeEventListener('resize', handleResize));
            }
        } catch (err) {
            console.error("[ECharts] Set Option Error:", err);
            setError("Chart Render Error: " + err.message);
        }
    });

    // Delay resize in case of CSS animation/transition
    createEffect(() => {
        const instance = chartInstance();
        if (instance) {
            setTimeout(() => instance.resize(), 150);
            setTimeout(() => instance.resize(), 500); // secondary check
        }
    });

    return (
        <div class="echarts-container relative w-full" style={props.style || { height: '400px', 'min-height': '300px' }}>
            {/* Loading state */}
            {loading() && (
                <div class="absolute inset-0 flex items-center justify-center bg-gray-900/60 rounded-lg z-10">
                    <div class="text-gray-500 text-xs flex items-center gap-2">
                        <span class="inline-block w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        Loading chart...
                    </div>
                </div>
            )}

            {/* Error state */}
            {error() && (
                <div class="absolute inset-0 flex items-center justify-center bg-gray-900/60 rounded-lg z-10">
                    <span class="text-red-400 text-xs">{error()}</span>
                </div>
            )}

            {/* Chart container */}
            <div
                ref={containerRef}
                class="w-full h-full min-h-[300px]"
                style={{ visibility: loading() ? 'hidden' : 'visible' }}
            />
        </div>
    );
}
