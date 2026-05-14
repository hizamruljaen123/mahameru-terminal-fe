import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';

/**
 * ============================================================================
 *  MAHAMERU COPILOT — Leaflet Map Renderer
 *  Renders GeoJSON data onto an interactive Leaflet map.
 *  Supports vessel markers, aircraft vectors, disaster circles, asset clusters.
 *  Lazy-loads Leaflet from CDN to avoid bundle size impact.
 * ============================================================================
 */

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

/**
 * Props:
 *   geojson: Object - GeoJSON FeatureCollection
 *   center: [number, number] - [lat, lng]
 *   zoom: number - Zoom level (1-18)
 *   height: string - Container height (default: '350px')
 */
export default function LeafletMapRenderer(props) {
    let mapContainer;
    let renderTimeout;
    let sizeTimeout;
    let injectedScript = null;

    const [leafletLib, setLeafletLib] = createSignal(null);
    const [mapInstance, setMapInstance] = createSignal(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(null);

    function cleanupMap() {
        if (renderTimeout) {
            clearTimeout(renderTimeout);
            renderTimeout = null;
        }

        if (sizeTimeout) {
            clearTimeout(sizeTimeout);
            sizeTimeout = null;
        }

        const map = mapInstance();
        if (map) {
            try {
                map.remove();
            } catch (e) {
                console.warn('[LeafletMapRenderer] Failed to dispose map:', e);
            }
            setMapInstance(null);
        }
    }

    function sanitizePopupValue(value) {
        return String(value)
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"');
    }

    onMount(async () => {
        try {
            if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = LEAFLET_CSS;
                document.head.appendChild(link);
            }

            if (typeof window.L !== 'undefined') {
                setLeafletLib(window.L);
                setLoading(false);
                return;
            }

            injectedScript = document.createElement('script');
            injectedScript.src = LEAFLET_JS;
            injectedScript.async = true;
            injectedScript.onload = () => {
                setLeafletLib(window.L);
                setLoading(false);
            };
            injectedScript.onerror = () => {
                setError('Failed to load Leaflet library');
                setLoading(false);
            };
            document.head.appendChild(injectedScript);
        } catch (e) {
            setError(e.message || 'Failed to initialize Leaflet');
            setLoading(false);
        }
    });

    createEffect(() => {
        const leaflet = leafletLib();
        if (!leaflet || !mapContainer) return;

        const center = props.center || [0, 0];
        const zoom = props.zoom || 3;
        const geojson = props.geojson;

        cleanupMap();
        setError(null);

        renderTimeout = setTimeout(() => {
            if (!mapContainer || !leaflet) return;

            try {
                const map = leaflet.map(mapContainer, {
                    center,
                    zoom,
                    zoomControl: true,
                    attributionControl: true,
                });

                leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
                    subdomains: 'abcd',
                    maxZoom: 19,
                }).addTo(map);

                if (geojson && geojson.features) {
                    const geoLayer = leaflet.geoJSON(geojson, {
                        pointToLayer: (feature, latlng) => {
                            const featureProps = feature.properties || {};

                            let markerColor = '#22d3ee';
                            let markerSize = 8;

                            if (featureProps.anomaly === 'dark_ship' || featureProps.flag === 'dark_ship') {
                                markerColor = '#ef4444';
                                markerSize = 10;
                            } else if (featureProps.type?.toLowerCase().includes('tanker')) {
                                markerColor = '#f59e0b';
                            } else if (featureProps.type?.toLowerCase().includes('cargo')) {
                                markerColor = '#3b82f6';
                            } else if (featureProps.altitude) {
                                markerColor = '#a78bfa';
                                markerSize = 7;
                            } else if (featureProps.magnitude) {
                                markerColor = '#ef4444';
                                markerSize = Math.max(6, Math.min(16, featureProps.magnitude * 2));
                            }

                            return leaflet.circleMarker(latlng, {
                                radius: markerSize,
                                fillColor: markerColor,
                                color: '#fff',
                                weight: 1,
                                opacity: 0.8,
                                fillOpacity: 0.6,
                            });
                        },
                        onEachFeature: (feature, layer) => {
                            const featureProps = feature.properties || {};
                            const fields = [];

                            for (const [key, value] of Object.entries(featureProps)) {
                                if (value && value !== 'N/A' && value !== 'Unknown') {
                                    fields.push(`<strong>${sanitizePopupValue(key)}:</strong> ${sanitizePopupValue(value)}`);
                                }
                            }

                            if (fields.length > 0) {
                                layer.bindPopup(`
                <div class="leaflet-popup-content-wrapper" style="background: #1f2937; color: #e5e7eb; border-radius: 8px; max-width: 300px;">
                  <div style="padding: 8px 12px; font-size: 12px; font-family: monospace;">
                    ${fields.join('<br/>')}
                  </div>
                </div>
              `);
                            }
                        },
                    }).addTo(map);

                    if (geoLayer.getLayers().length > 0) {
                        const bounds = geoLayer.getBounds();
                        if (bounds.isValid()) {
                            map.fitBounds(bounds, { padding: [30, 30] });
                        }
                    }
                }

                setMapInstance(map);
                sizeTimeout = setTimeout(() => map.invalidateSize(), 200);
            } catch (e) {
                console.error('[LeafletMapRenderer] Map init error:', e);
                setError(e.message || 'Failed to render map');
                cleanupMap();
            }
        }, 100);
    });

    onCleanup(() => {
        cleanupMap();
        if (injectedScript?.parentNode) {
            injectedScript.parentNode.removeChild(injectedScript);
        }
    });

    return (
        <div class="leaflet-container-wrapper relative w-full overflow-hidden rounded-lg" style={{ height: props.height || '350px' }}>
            {loading() && (
                <div class="absolute inset-0 z-10 flex items-center justify-center bg-gray-900">
                    <div class="flex items-center gap-2 text-xs text-gray-500">
                        <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                        Loading map...
                    </div>
                </div>
            )}

            {error() && (
                <div class="absolute inset-0 z-10 flex items-center justify-center bg-gray-900">
                    <span class="text-xs text-red-400">{error()}</span>
                </div>
            )}

            <div
                ref={mapContainer}
                class="h-full w-full rounded-lg"
                style={{ visibility: loading() ? 'hidden' : 'visible' }}
            />
        </div>
    );
}
