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
    const [L, setL] = useState(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load Leaflet library
    onMount(async () => {
        try {
            // Load CSS
            if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = LEAFLET_CSS;
                document.head.appendChild(link);
            }

            // Load JS
            if (typeof window.L !== 'undefined') {
                setL(() => window.L);
                setLoading(false);
                return;
            }

            const script = document.createElement('script');
            script.src = LEAFLET_JS;
            script.async = true;
            script.onload = () => {
                setL(() => window.L);
                setLoading(false);
            };
            script.onerror = () => {
                setError('Failed to load Leaflet library');
                setLoading(false);
            };
            document.head.appendChild(script);
            onCleanup(() => {
                if (script.parentNode) script.parentNode.removeChild(script);
                if (mapInstance()) {
                    mapInstance().remove();
                }
            });
        } catch (e) {
            setError(e.message);
            setLoading(false);
        }
    });

    // Initialize map when library loads
    createEffect(() => {
        const leaflet = L();
        if (!leaflet || !mapContainer) return;

        // Wait for container to be in DOM and visible
        setTimeout(() => {
            if (!mapContainer) return;

            const center = props.center || [0, 0];
            const zoom = props.zoom || 3;

            const map = leaflet.map(mapContainer, {
                center,
                zoom,
                zoomControl: true,
                attributionControl: true,
            });

            // Add tile layer (dark theme)
            leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 19,
            }).addTo(map);

            // Add GeoJSON data
            const geojson = props.geojson;
            if (geojson && geojson.features) {
                const geoLayer = leaflet.geoJSON(geojson, {
                    pointToLayer: (feature, latlng) => {
                        const props = feature.properties || {};

                        // Determine marker style based on properties
                        let markerColor = '#22d3ee'; // default cyan
                        let markerSize = 8;

                        if (props.anomaly === 'dark_ship' || props.flag === 'dark_ship') {
                            markerColor = '#ef4444'; // red for dark ships
                            markerSize = 10;
                        } else if (props.type?.toLowerCase().includes('tanker')) {
                            markerColor = '#f59e0b'; // amber for tankers
                        } else if (props.type?.toLowerCase().includes('cargo')) {
                            markerColor = '#3b82f6'; // blue for cargo
                        } else if (props.altitude) {
                            markerColor = '#a78bfa'; // purple for aircraft
                            markerSize = 7;
                        } else if (props.magnitude) {
                            markerColor = '#ef4444'; // red for earthquakes
                            markerSize = Math.max(6, Math.min(16, props.magnitude * 2));
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
                        const p = feature.properties || {};
                        const fields = [];

                        for (const [key, value] of Object.entries(p)) {
                            if (value && value !== 'N/A' && value !== 'Unknown') {
                                fields.push(`<strong>${key}:</strong> ${value}`);
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
                });

                // Fit map to bounds if there are features
                if (geoLayer.getLayers().length > 0) {
                    const bounds = geoLayer.getBounds();
                    if (bounds.isValid()) {
                        map.fitBounds(bounds, { padding: [30, 30] });
                    }
                }
            }

            // Invalidate size after render
            setTimeout(() => map.invalidateSize(), 200);

            setMapInstance(map);
        }, 100);
    });

    return (
        <div class="leaflet-container-wrapper relative w-full overflow-hidden rounded-lg" style={{ height: props.height || '350px' }}>
            {/* Loading state */}
            {loading() && (
                <div class="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div class="text-gray-500 text-xs flex items-center gap-2">
                        <span class="inline-block w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        Loading map...
                    </div>
                </div>
            )}

            {/* Error state */}
            {error() && (
                <div class="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <span class="text-red-400 text-xs">{error()}</span>
                </div>
            )}

            {/* Map container */}
            <div
                ref={mapContainer}
                class="w-full h-full rounded-lg"
                style={{ visibility: loading() ? 'hidden' : 'visible' }}
            />
        </div>
    );
}

/**
 * SolidJS doesn't have useState, but we can use createSignal
 * Note: The above uses useState which doesn't exist in SolidJS.
 * This is a compatibility wrapper.
 */
function useState(initial) {
    const [get, set] = createSignal(initial);
    return [get, set];
}
