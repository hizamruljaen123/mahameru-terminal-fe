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
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF = 1000;

function getAuthHeaders(extraHeaders = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return {
        ...extraHeaders,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

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
    const { stream = false, temperature = 0.3, signal, model, use_tools = true, session_id, agent_id, save_history = true, retries = DEFAULT_RETRIES } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const body = {
                messages,
                stream,
                temperature,
                use_tools,
                session_id,
                save_history,
                metadata: { agent_id }
            };
            if (model) body.model = model;

            const response = await fetch(`${COPILOT_BASE}/api/copilot/chat`, {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(body),
                signal: signal || controller.signal,
            });

            if (!response.ok) {
                // Retry on 429 or 5xx
                if (response.status === 429 || response.status >= 500) {
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '0');
                    const delay = retryAfter > 0 ? retryAfter * 1000 : DEFAULT_BACKOFF * Math.pow(2, attempt);
                    if (attempt < retries) {
                        console.warn(`[Copilot] Retry ${attempt + 1}/${retries} after ${delay}ms (status ${response.status})`);
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }
                }
                const errText = await response.text().catch(() => 'Unknown error');
                throw new Error(`Copilot API error (${response.status}): ${errText}`);
            }

            clearTimeout(timeoutId);
            return await response.json();
        } catch (err) {
            lastError = err;
            if (err.name === 'AbortError') break;
            if (attempt < retries) {
                const delay = DEFAULT_BACKOFF * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    clearTimeout(timeoutId);
    throw lastError;
}

/**
 * Send a chat message with SSE streaming support.
 * Returns an EventSource-compatible ReadableStream.
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} options
 * @returns {Promise<Response>} Raw fetch Response for SSE consumption
 */
export async function sendStreamingChat(messages, options = {}) {
    const { temperature = 0.3, signal, model, use_tools = true, session_id, agent_id, save_history = true, metadata = {} } = options;

    const body = {
        messages,
        stream: true,
        temperature,
        use_tools,
        session_id,
        save_history,
        metadata: { agent_id, ...metadata }
    };
    if (model) body.model = model;

    const response = await fetch(`${COPILOT_BASE}/api/copilot/stream`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
        signal,
    });

    if (!response.ok) {
        throw new Error(`Copilot stream error (${response.status})`);
    }

    return response;
}

// ---- HISTORY API ----

export async function fetchHistory() {
    const resp = await fetch(`${COPILOT_BASE}/api/copilot/history`, {
        headers: getAuthHeaders()
    });
    if (!resp.ok) throw new Error('Failed to fetch chat history');
    return await resp.json();
}

export async function fetchSessionMessages(sessionId) {
    const resp = await fetch(`${COPILOT_BASE}/api/copilot/history/${sessionId}`, {
        headers: getAuthHeaders()
    });
    if (!resp.ok) throw new Error('Failed to fetch session messages');
    return await resp.json();
}

export async function fetchSessionDetails(sessionId) {
    const resp = await fetch(`${COPILOT_BASE}/api/copilot/history/session/${sessionId}`, {
        headers: getAuthHeaders()
    });
    if (!resp.ok) throw new Error('Failed to fetch session details');
    return await resp.json();
}

export async function deleteSession(sessionId) {
    const resp = await fetch(`${COPILOT_BASE}/api/copilot/history/${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!resp.ok) throw new Error('Failed to delete session');
    return await resp.json();
}

export async function renameSession(sessionId, title) {
    const resp = await fetch(`${COPILOT_BASE}/api/copilot/history/${sessionId}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title })
    });
    if (!resp.ok) throw new Error('Failed to rename session');
    return await resp.json();
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
        const { session_id, signal: optSignal } = options;
        const response = await fetch(`${COPILOT_BASE}/api/copilot/slash`, {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ command, session_id }),
            signal: optSignal || controller.signal,
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
 * Get all registered tools and slash commands.
 * @returns {Promise<{tools: Array, slash_commands: Object, routes: Object}>}
 */
export async function getAvailableTools() {
    const response = await fetch(`${COPILOT_BASE}/api/copilot/tools`, {
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error(`Failed to fetch tools (${response.status})`);
    return await response.json();
}

/**
 * Get all available AI agents from the registry.
 * @returns {Promise<{agents: Array}>}
 */
export async function fetchAgents() {
    const response = await fetch(`${COPILOT_BASE}/api/copilot/agents`, {
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error(`Failed to fetch agents (${response.status})`);
    return await response.json();
}

/**
 * Check gateway health status.
 * @returns {Promise<Object>}
 */
export async function checkHealth() {
    try {
        const response = await fetch(`${COPILOT_BASE}/api/copilot/health`, {
            headers: getAuthHeaders()
        });
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

/**
 * Execute code in the host sandbox.
 * @param {string} language - python, javascript, bash
 * @param {string} code - source code
 * @param {number} [timeout=30]
 * @returns {Promise<Object>} CodeExecutionResponse
 */
export async function executeCode(language, code, timeout = 30) {
    const response = await fetch(`${COPILOT_BASE}/api/copilot/code/execute`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ language, code, timeout }),
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Code execution error (${response.status}): ${errText}`);
    }

    return await response.json();
}

export default {
    sendChatMessage,
    sendStreamingChat,
    executeSlashCommand,
    getAvailableTools,
    checkHealth,
    parseSSEStream,
    fetchHistory,
    fetchSessionMessages,
    deleteSession,
    renameSession,
    executeCode
};
