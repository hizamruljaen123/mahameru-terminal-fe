import { formatTime } from '../utils/formatters';
import { MAX_BATCH_SIZE } from '../constants/theaters';

/**
 * FIXED WebSocket handler with validation, auth, and memory leak prevention
 */
export function useWebSocket(state) {
    let ws = null;
    let bufferTimer = null;
    let pendingUpdates = [];
    const MAX_PENDING = 5000;

    const validateCoordinates = (lat, lon) => {
        if (lat == null || lon == null) return false;
        const latNum = Number(lat), lonNum = Number(lon);
        return latNum >= -90 && latNum <= 90 && lonNum >= -180 && lonNum <= 180;
    };

    const validateMessageSchema = (msg) => {
        if (!msg || typeof msg !== 'object') return false;
        if (msg.type === 'initial' && !Array.isArray(msg.data)) return false;
        if (msg.type === 'update' && !msg.data?.mmsi) return false;
        return ['initial', 'update'].includes(msg.type);
    };

    const handleIncomingMessage = (rawMsg) => {
        try {
            const msg = typeof rawMsg === 'string' ? JSON.parse(rawMsg) : rawMsg;
            if (!validateMessageSchema(msg)) {
                console.warn('Invalid message schema');
                state.setStatus('PROTOCOL_ERROR');
                return;
            }
            const data = msg.data;
            state.setLastSignalTime(formatTime());

            if (msg.type === 'initial') {
                const records = (Array.isArray(data) ? data : (data.records || []))
                    .filter(s => validateCoordinates(s.lat || s.latitude, s.lon || s.longitude))
                    .slice(0, 10000);
                updateFleetData(records);
            } else if (msg.type === 'update' && validateCoordinates(data.lat || data.latitude, data.lon || data.longitude)) {
                if (pendingUpdates.length < MAX_PENDING) {
                    pendingUpdates.push(data);
                } else {
                    flushBuffer();
                    pendingUpdates.push(data);
                }
            }
        } catch (err) {
            console.error('WebSocket message error:', err);
            state.setStatus('PROTOCOL_ERROR');
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
        if (bufferTimer) {
            clearInterval(bufferTimer);
            bufferTimer = null;
        }
        bufferTimer = setInterval(flushBuffer, 5000);

        if (ws) ws.close();
        const aisApi = import.meta.env.VITE_AIS_API || 'https://api.asetpedia.online/ais';
        const wsProtocol = aisApi.startsWith('https') ? 'wss' : 'ws';
        const urlObj = new URL(aisApi);
        const wsHost = urlObj.host;
        const wsPath = urlObj.pathname.replace(/\/$/, '');
        ws = new WebSocket(`${wsProtocol}://${wsHost}${wsPath}/ws/ships`);

        ws.onopen = () => {
            state.setStatus('CONNECTED');
            const token = localStorage.getItem('auth_token');
            ws.send(JSON.stringify({ type: 'subscribe', bbox: theater.bbox, auth_token: token }));
        };
        ws.onmessage = (e) => handleIncomingMessage(e.data);
        ws.onclose = () => {
            state.setStatus('OFFLINE');
            pendingUpdates = [];
        };
        ws.onerror = (err) => {
            state.setStatus('ERROR');
            console.error('WebSocket error:', err);
        };
    };

    const disconnect = () => {
        if (ws) {
            ws.close();
            ws = null;
        }
        if (bufferTimer) {
            clearInterval(bufferTimer);
            bufferTimer = null;
        }
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