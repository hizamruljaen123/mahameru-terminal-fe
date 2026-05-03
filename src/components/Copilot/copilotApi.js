/**
 * ============================================================================
 *  MAHAMERU COPILOT — API Client Module
 *  Handles all communication with the Copilot LLM Gateway (Port 8500).
 *  Supports REST chat, slash commands, and SSE streaming.
 * ============================================================================
 */

const COPILOT_BASE = import.meta.env.VITE_COPILOT_BASE || 
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? 'https://api.asetpedia.online/copilot'
        : 'http://localhost:8500');

console.log("[Copilot API] Base URL:", COPILOT_BASE);
const DEFAULT_TIMEOUT = 30000;

/**
 * Send a chat message and receive a structured Rich Response.
 * @param {Array<{role: string, content: string}>} messages - Conversation history
 * @param {Object} options
 * @param {boolean} [options.stream=false] - Enable SSE streaming
 * @param {number} [options.temperature=0.3] - LLM temperature
 * @param {AbortSignal} [options.signal] - AbortController signal
 * @returns {Promise<Object>} CopilotChatResponse
 */
export async function sendChatMessage(messages, options = {}) {
    const { stream = false, temperature = 0.3, signal, model } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
        const body = {
            messages,
            stream,
            temperature,
        };
        if (model) body.model = model;

        const response = await fetch(`${COPILOT_BASE}/api/copilot/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: signal || controller.signal,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Copilot API error (${response.status}): ${errText}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Send a chat message with SSE streaming support.
 * Returns an EventSource-compatible ReadableStream.
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} options
 * @returns {Promise<Response>} Raw fetch Response for SSE consumption
 */
export async function sendStreamingChat(messages, options = {}) {
    const { temperature = 0.3, signal, model } = options;

    const body = {
        messages,
        stream: true,
        temperature,
    };
    if (model) body.model = model;

    const response = await fetch(`${COPILOT_BASE}/api/copilot/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    });

    if (!response.ok) {
        throw new Error(`Copilot stream error (${response.status})`);
    }

    return response;
}

/**
 * Execute a slash command (bypasses LLM for speed).
 * @param {string} command - Slash command string (e.g. "/ta BBRI.JK")
 * @param {Object} options
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>} SlashCommandResponse
 */
export async function executeSlashCommand(command, options = {}) {
    const { signal } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
        const response = await fetch(`${COPILOT_BASE}/api/copilot/slash`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command }),
            signal: signal || controller.signal,
        });

        if (!response.ok) {
            throw new Error(`Slash command error (${response.status})`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Get the 7-stage research pipeline SSE stream URL.
 * @param {string} symbols - Comma-separated symbols
 * @param {string} [analysisType='full'] - Analysis type
 * @returns {string} SSE endpoint URL
 */
export function getResearchStreamUrl(symbols, analysisType = 'full') {
    const params = new URLSearchParams({ symbols, analysis_type: analysisType });
    return `${COPILOT_BASE}/api/copilot/research/stream?${params}`;
}

/**
 * Get all registered tools and slash commands.
 * @returns {Promise<{tools: Array, slash_commands: Object, routes: Object}>}
 */
export async function getAvailableTools() {
    const response = await fetch(`${COPILOT_BASE}/api/copilot/tools`);
    if (!response.ok) throw new Error(`Failed to fetch tools (${response.status})`);
    return await response.json();
}

/**
 * Check gateway health status.
 * @returns {Promise<Object>}
 */
export async function checkHealth() {
    try {
        const response = await fetch(`${COPILOT_BASE}/api/copilot/health`);
        if (!response.ok) return { status: 'unhealthy', http_status: response.status };
        return await response.json();
    } catch (e) {
        return { status: 'offline', error: e.message };
    }
}

/**
 * Parse SSE stream events from a ReadableStream response.
 * @param {Response} response - Fetch Response with SSE stream
 * @param {Function} onEvent - Callback(eventType, data)
 * @param {Function} onError - Callback(error)
 * @returns {Promise<void>}
 */
export async function parseSSEStream(response, onEvent, onError) {
    try {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Split by double newlines (SSE event boundary)
            const events = buffer.split('\n\n');
            // Keep the last incomplete chunk in buffer
            buffer = events.pop() || '';

            for (const eventBlock of events) {
                if (!eventBlock.trim()) continue;

                const lines = eventBlock.split('\n');
                let eventType = 'message';
                let dataStr = '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        dataStr = line.slice(6).trim();
                    }
                }

                if (dataStr) {
                    try {
                        const data = JSON.parse(dataStr);
                        onEvent(eventType, data);
                    } catch (e) {
                        // If not JSON, pass raw string
                        onEvent(eventType, dataStr);
                    }
                }
            }
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            onError?.(e);
        }
    }
}

export default {
    sendChatMessage,
    sendStreamingChat,
    executeSlashCommand,
    getResearchStreamUrl,
    getAvailableTools,
    checkHealth,
    parseSSEStream,
};
