import { createMemo } from 'solid-js';

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"');
}

export default function VesselRadarRenderer(props) {
    const coords = createMemo(() => {
        const parse = (v, fallback = 0) => {
            const n = Number.parseFloat(v);
            return Number.isFinite(n) ? n : fallback;
        };

        const lat = clamp(parse(props.lat), -90, 90);
        const lon = clamp(parse(props.lon), -180, 180);
        const zoom = clamp(parse(props.zoom, 10), 1, 18);
        const name = String(props.name || props.location || 'Vessel Radar').slice(0, 120);

        return { lat, lon, zoom, name };
    });

    const widgetHtml = createMemo(() => {
        const { lat, lon, zoom, name } = coords();
        const safeName = escapeHtml(name);

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        html, body {
            margin: 0;
            padding: 0;
            background: #000;
            overflow: hidden;
            height: 100%;
            width: 100%;
        }
        body {
            font-family: Inter, system-ui, sans-serif;
        }
        #vf-root {
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
        }
        .vf-fallback {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #9ca3af;
            font-size: 12px;
            background: #020617;
            text-align: center;
            padding: 16px;
            box-sizing: border-box;
        }
    </style>
    <script>
        window.width = '100%';
        window.height = '100%';
        window.latitude = ${JSON.stringify(lat)};
        window.longitude = ${JSON.stringify(lon)};
        window.zoom = ${JSON.stringify(zoom)};
    </script>
</head>
<body>
    <div id="vf-root">
        <div class="vf-fallback">Loading live vessel radar for ${safeName}...</div>
    </div>
    <script src="https://www.vesselfinder.com/aismap.js"></script>
</body>
</html>`;
    });

    const footerLabel = createMemo(() => {
        const { lat, lon, zoom } = coords();
        return `POS: ${lat.toFixed(4)} / ${lon.toFixed(4)} | ZOOM: ${zoom}`;
    });

    return (
        <div class="copilot-vessel-radar-container" style="height: 400px; border: 1px solid var(--border-main); position: relative; overflow: hidden; background: #000; border-radius: 8px;">
            <div class="radar-header" style="position: absolute; top: 0; left: 0; right: 0; height: 32px; background: rgba(0,0,0,0.88); border-bottom: 1px solid var(--border-main); z-index: 10; display: flex; align-items: center; padding: 0 12px; font-size: 10px; font-weight: 700; color: var(--text-accent); letter-spacing: 1px; backdrop-filter: blur(4px);">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: #00ff88; margin-right: 8px; box-shadow: 0 0 8px #00ff88; animation: radar-pulse 2s infinite;"></div>
                LIVE RADAR: {coords().name.toUpperCase()}
            </div>

            <iframe
                srcdoc={widgetHtml()}
                style="width: 100%; height: 100%; border: 0; display: block;"
                title="Vessel Radar"
                loading="lazy"
                referrerpolicy="no-referrer"
                sandbox="allow-scripts"
            />

            <div class="radar-coordinates" style="position: absolute; bottom: 10px; left: 10px; max-width: calc(100% - 20px); background: rgba(0,0,0,0.82); padding: 4px 8px; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #00ff88; z-index: 10; border: 1px solid rgba(0,255,136,0.25); border-radius: 4px; text-shadow: 0 0 5px rgba(0,255,136,0.35); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                {footerLabel()}
            </div>

            <style>{`
                @keyframes radar-pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.45; transform: scale(1.12); }
                    100% { opacity: 1; transform: scale(1); }
                }
                .copilot-vessel-radar-container iframe {
                    filter: brightness(0.92) contrast(1.08) saturate(1.08);
                }
            `}</style>
        </div>
    );
}
