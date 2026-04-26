import { formatTime } from '../utils/formatters';
import { MAX_BATCH_SIZE } from '../constants/theaters';

/**
 * WebSocket connection handler for vessel data
 */
export function useWebSocket(state) {
    let ws = null;
    let bufferTimer = null;
    let pendingUpdates = [];

    const handleIncomingMessage = (msg) => {
        if (!msg || !msg.data) return;
        const data = msg.data;
        state.setLastSignalTime(formatTime());

        if (msg.type === 'initial') {
            const records = (Array.isArray(data) ? data : (data.records || []))
                .filter(s => (s.lat || s.latitude) != null && (s.lon || s.longitude) != null);
            updateFleetData(records);
        } else if (msg.type === 'update') {
            if ((data.lat || data.latitude) != null && (data.lon || data.longitude) != null) {
                pendingUpdates.push(data);
            }
        }
    };

    const updateFleetData = (batch) => {
        batch.forEach(ship => {
            // Normalize coordinates for internal map consistency
            const lat = Number(ship.lat || ship.latitude || 0);
            const lon = Number(ship.lon || ship.longitude || 0);
            state.vesselRegistry.set(ship.mmsi, { ...ship, lat, lon });
        });
        
        // Update signals BEFORE analysis check to ensure quorum is detected correctly
        syncRegistry();


    };

    const syncRegistry = () => {
        state.setShips(Array.from(state.vesselRegistry.values()));
        state.setVesselCount(state.vesselRegistry.size);
    };

    const flushBuffer = () => {
        if (pendingUpdates.length === 0) return;
        updateFleetData(pendingUpdates);
        pendingUpdates = [];
    };



    const connect = (theater) => {
        if (bufferTimer) clearInterval(bufferTimer);
        bufferTimer = setInterval(flushBuffer, 5000);

        if (ws) ws.close();
        const aisApi = import.meta.env.VITE_AIS_API || 'https://api.asetpedia.online/ais';
        const wsProtocol = aisApi.startsWith('https') ? 'wss' : 'ws';
        const urlObj = new URL(aisApi);
        const wsHost = urlObj.host;
        const wsPath = urlObj.pathname.replace(/\/$/, ''); // Remove trailing slash
        ws = new WebSocket(`${wsProtocol}://${wsHost}${wsPath}/ws/ships`);

        ws.onopen = () => {
            state.setStatus('CONNECTED');
            ws.send(JSON.stringify({ type: 'subscribe', bbox: theater.bbox }));
        };
        ws.onmessage = (e) => handleIncomingMessage(JSON.parse(e.data));
        ws.onclose = () => state.setStatus('OFFLINE');
        ws.onerror = () => state.setStatus('ERROR');
    };

    const disconnect = () => {
        if (ws) ws.close();
        if (bufferTimer) clearInterval(bufferTimer);
        pendingUpdates = [];
    };

    const cleanup = () => {
        disconnect();
        state.vesselRegistry.clear();
        state.setShips([]);
    };

    return {
        connect,
        disconnect,
        cleanup,
        syncRegistry
    };
}