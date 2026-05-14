import { createSignal, createEffect, onMount, onCleanup, Show, For, createMemo, ErrorBoundary } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import {
    sendChatMessage,
    sendStreamingChat,
    executeSlashCommand,
    checkHealth,
    parseSSEStream,
    fetchSessionMessages,
    fetchAgents,
    fetchSessionDetails,
    executeCode,
} from './copilotApi.js';
import RichResponseRenderer, { ImageModal } from './RichResponseRenderer.jsx';
import { MahameruCopilotSidebar } from './MahameruCopilotSidebar.jsx';
import './copilot.css';
import { AVAILABLE_MODELS as REGISTRY_MODELS } from '../../lib/models/modelRegistry';
import ModelSelector from '../shared/ModelSelector';



const MAX_HISTORY = 50;
const CONTEXT_WINDOW = 15;

const SLASH_COMMANDS_LIST = [
    { command: '/ta', description: 'Technical Analysis', usage: '/ta [SYMBOL]' },
    { command: '/quote', description: 'Price Quote', usage: '/quote [SYMBOL]' },
    { command: '/vessel', description: 'Interactive Vessel Radar Map for a port, strait, or area', usage: '/vessel [LOCATION]' },
    { command: '/news', description: 'News Feed', usage: '/news [TOPIC]' },
    { command: '/macro', description: 'Macro Dashboard', usage: '/macro' },
    { command: '/crypto', description: 'Crypto Analysis', usage: '/crypto [SYMBOL]' },
    { command: '/forex', description: 'Forex Rates', usage: '/forex [PAIR]' },
    { command: '/sentiment', description: 'Market Sentiment', usage: '/sentiment [TOPIC]' },
    { command: '/regime', description: 'Market Regime', usage: '/regime' },
    { command: '/help', description: 'Show all commands', usage: '/help' },
];

const AVAILABLE_MODELS = REGISTRY_MODELS.map(m => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    description: m.description,
    icon: m.icon
}));



 /**
  * Collapsible Thinking/Reasoning block
  */
const ThoughtBlock = (props) => {
    const [isOpen, setIsOpen] = createSignal(props.initiallyOpen ?? false);

    return (
        <div classList={{
            'copilot-thought-container': true,
            'copilot-thinking-glow': props.isThinking && !isOpen()
        }}>
            <div
                class={`copilot-thought-header ${isOpen() ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen())}
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M9 18l6-6-6-6" />
                </svg>
                <span>{props.isThinking ? (props.label || 'AI gathering data') : (props.label || 'Thought')}</span>
                <Show when={props.isThinking}>
                    <div class="copilot-thinking-dots-enhanced" style="margin-left: 8px; display: inline-flex;">
                        <div class="copilot-dot"></div>
                        <div class="copilot-dot"></div>
                        <div class="copilot-dot"></div>
                    </div>
                </Show>
            </div>
            <Show when={isOpen() || (props.isThinking && props.initiallyOpen)}>
                <div class="copilot-thought-content">
                    {props.content}
                    {props.children}
                </div>
            </Show>
        </div>
    );
};

/**
 * Props:
 *   className: string - Additional CSS classes
 *   initialMessage: string - Optional initial system message
 *   height: string - Container height (default: '600px')
 *   onGatewayStatus: (status: Object) => void - Callback
 */
export default function MahameruCopilot(props) {
    // ---- State ----
    const [messages, setMessages] = createStore([]);
    const [input, setInput] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);
    const [gatewayStatus, setGatewayStatus] = createSignal({ status: 'checking' });
    const [showSlashMenu, setShowSlashMenu] = createSignal(false);
    const [slashFilter, setSlashFilter] = createSignal('');
    const [commandHistory, setCommandHistory] = createSignal([]);
    const [historyIndex, setHistoryIndex] = createSignal(-1);
    const [gatewayError, setGatewayError] = createSignal(null);
    const [selectedModel, setSelectedModel] = createSignal(
        AVAILABLE_MODELS.find(m => m.id === (import.meta.env.VITE_COPILOT_LLM_MODEL || 'minimax-m2.5'))
        || AVAILABLE_MODELS.find(m => m.id === 'minimax-m2.5')
        || AVAILABLE_MODELS[0]
    );

    const [showModelDropdown, setShowModelDropdown] = createSignal(false);
    const [activeTools, setActiveTools] = createSignal([]); // array of { command, label, icon }
    const [copilotMode, setCopilotMode] = createSignal('chat'); // 'analytics' or 'chat'
    const [currentSessionId, setCurrentSessionId] = createSignal(null);
    const [showSidebar, setShowSidebar] = createSignal(true);
    const [availableAgents, setAvailableAgents] = createSignal([]);
    const [selectedAgentId, setSelectedAgentId] = createSignal('build-agent');
    const [activeAbortController, setActiveAbortController] = createSignal(null);
    const [researchStream, setResearchStream] = createSignal(null);
    
    // ---- Deep Link & URL Sync ----
    onMount(() => {
        // Load session from URL if present (/copilot/chat/{uuid})
        const path = window.location.pathname;
        if (path.startsWith('/copilot/chat/')) {
            const sessionId = path.split('/').pop();
            // Validate UUID length approx
            if (sessionId && sessionId.length > 30) {
                handleSelectSession(sessionId);
            }
        }
    });

    createEffect(() => {
        const sessionId = currentSessionId();
        if (sessionId) {
            const newPath = `/copilot/chat/${sessionId}`;
            if (window.location.pathname !== newPath) {
                // Use replaceState if it's the same view to prevent polluting history while chatting
                // but for clicking sidebar items, pushState is already handled by browser back button 
                // but we want to make it feel like real navigation
                window.history.pushState({ view: 'copilot', sessionId }, '', newPath);
            }
        } else if (window.location.pathname.startsWith('/copilot/chat/')) {
            // If session cleared (New Chat), go back to base copilot URL
            window.history.pushState({ view: 'copilot' }, '', '/copilot');
        }
    });

    // ---- Slash Command Filter ----
    const getFilteredSlashCommands = createMemo(() => {
        const filter = slashFilter();
        if (!filter) return SLASH_COMMANDS_LIST;
        return SLASH_COMMANDS_LIST.filter(cmd =>
            cmd.command.toLowerCase().includes(filter) ||
            cmd.description.toLowerCase().includes(filter)
        );
    });

    let messagesEndRef;
    let inputRef;
    let chatContainerRef;
    let textareaRef;
    let modelDropdownRef;

    // ---- Gateway health check ----
    onMount(async () => {
        console.log(`[Copilot] Checking gateway health at ${import.meta.env.VITE_COPILOT_BASE || 'default (localhost:8500)'}...`);
        const status = await checkHealth();
        console.log("[Copilot] Gateway Status:", status);
        setGatewayStatus(status);
        props.onGatewayStatus?.(status);

        if (status.status === 'offline' || status.status === 'unhealthy') {
            setGatewayError(`Copilot Gateway is ${status.status}. Some features may be unavailable.`);
        }

        inputRef?.focus();

        // Fetch agents
        try {
            const agentData = await fetchAgents();
            setAvailableAgents(agentData.agents || []);
        } catch (e) {
            console.error("[Copilot] Failed to fetch agents", e);
        }
    });

    // Periodic health check (every 30s)
    let healthInterval;
    onMount(() => {
        healthInterval = setInterval(async () => {
            const status = await checkHealth();
            setGatewayStatus(status);
            props.onGatewayStatus?.(status);
        }, 30000);
    });

    onCleanup(() => {
        if (healthInterval) clearInterval(healthInterval);
    });

    // ---- Auto-scroll Logic (Robust) ----
    createEffect(() => {
        const container = chatContainerRef;
        if (!container) return;

        // Watch for size changes in the container (to handle async rendering of diagrams/latex)
        const observer = new ResizeObserver(() => {
            // Only auto-scroll if we are already near the bottom or if it's a new message
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
            if (isNearBottom || messages.length > 0) {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: messages.length > 0 && messages[messages.length - 1].isStreaming ? 'auto' : 'smooth'
                });
            }
        });

        observer.observe(container);

        // Also observe all message rows for internal content changes
        const rows = container.querySelectorAll('.copilot-msg-row');
        rows.forEach(row => observer.observe(row));

        onCleanup(() => observer.disconnect());
    });

    // Special scroll for session change
    createEffect(() => {
        if (currentSessionId()) {
            setTimeout(() => {
                chatContainerRef?.scrollTo({ top: chatContainerRef.scrollHeight, behavior: 'auto' });
            }, 100);
        }
    });

    // ---- Auto-resize textarea ----
    createEffect(() => {
        const ta = textareaRef;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
        }
    });

    // ---- Close model dropdown on outside click ----
    createEffect(() => {
        if (showModelDropdown()) {
            const handler = (e) => {
                if (modelDropdownRef && !modelDropdownRef.contains(e.target)) {
                    setShowModelDropdown(false);
                }
            };
            document.addEventListener('mousedown', handler);
            onCleanup(() => document.removeEventListener('mousedown', handler));
        }
    });

    // ---- Message model ----
    function addMessage(role, content, components = [], metadata = {}) {
        const msg = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            role,
            content,
            components,
            timestamp: Date.now(),
            model: role === 'assistant' ? selectedModel().name : undefined,

            steps: [],
            toolCalls: [],
            thought: '',
            isThinking: false,
            isStreaming: false,
            isEditing: false,
            tempContent: '',
            ...metadata,
        };

        setMessages(prev => {
            const updated = [...prev, msg];
            if (updated.length > MAX_HISTORY) {
                return updated.slice(updated.length - MAX_HISTORY);
            }
            return updated;
        });
    }

    // ---- Send message ----
    async function handleSend() {
        const text = input().trim();
        const tools = activeTools();

        if (!text && tools.length === 0) return;
        if (isLoading()) return;

        let finalInput = text;
        if (tools.length > 0) {
            const commands = tools.map(t => t.command).join(' ');
            finalInput = `${commands} ${text}`.trim();
        }

        setInput('');
        setActiveTools([]);
        setShowSlashMenu(false);

        addMessage('user', finalInput);

        setCommandHistory(prev => {
            const updated = [finalInput, ...prev.filter(c => c !== finalInput)];
            return updated.slice(0, 50);
        });
        setHistoryIndex(-1);

        // If multiple tools are selected, we MUST use the LLM agent loop
        if (tools.length > 1) {
            await handleLLMChat(finalInput);
            return;
        }

        if (finalInput.startsWith('/')) {
            await handleSlashCommand(finalInput);
            return;
        }

        await handleLLMChat(finalInput);
    }

    // ---- Typing effect for streaming ----
    function TypingCursor() {
        return (
            <span class="copilot-streaming-cursor" />
        );
    }

    // ---- Slash command ----
    async function handleSlashCommand(text) {
        setIsLoading(true);
        try {
            let sessionId = currentSessionId();
            if (!sessionId) {
                sessionId = crypto.randomUUID();
                setCurrentSessionId(sessionId);
            }

            addMessage('assistant', '', [], { isThinking: true });
            const response = await executeSlashCommand(text, { session_id: sessionId });

            // Note: executeSlashCommand now supports session_id in backend.
            setMessages(prev => prev.filter(m => !m.isThinking));
            addMessage('assistant', response.message || `Executed ${text}`, response.components || []);
            setMessages(messages.length - 1, 'id', response.id || Date.now().toString());
            setIsLoading(false);

            // Refresh sidebar history
            window.dispatchEvent(new CustomEvent('refresh-copilot-history'));
        } catch (e) {
            setMessages(prev => prev.filter(m => !m.isThinking));
            addMessage('assistant', `⚠️ Command failed: ${e.message}`, [{
                type: 'markdown',
                data: `**Error executing** \`${text}\`: ${e.message}\n\nTry \`/help\` for available commands.`,
            }]);
        } finally {
            setIsLoading(false);
        }
    }

    // ---- LLM Chat (Streaming with step progress) ----
    async function handleLLMChat(text, extraMetadata = {}) {
        setIsLoading(true);
        const allMessages = messages;
        const chatMessages = allMessages
            .filter(m => !m.isThinking && m.role !== 'system')
            // Filter out error messages from history to prevent malforming the prompt
            .filter(m => !m.content.startsWith('⚠️') && !m.content.includes('HTTP Error') && !m.content.includes('Connection Error'))
            .slice(-CONTEXT_WINDOW)
            .map(m => ({
                role: m.role,
                content: m.content,
            }));

        // Create initial empty assistant message with progress tracking
        const assistantMsgId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        setMessages(prev => [...prev, {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            thought: '',
            components: [],
            isThinking: copilotMode() === 'analytics',
            isStreaming: true,
            steps: [],            // array of {step, label, sub?, progress}
            toolCalls: [],        // array of {tool, status}
            plannedTools: [],     // array of tool names from planning phase
            currentStep: null,
            timestamp: Date.now(),
            model: selectedModel().name,

            isEditing: false,
            tempContent: ''
        }]);

        // If first message in a new session, create a session ID
        let sessionId = currentSessionId();
        if (!sessionId) {
            sessionId = crypto.randomUUID();
            setCurrentSessionId(sessionId);
        }

        // Abort previous request if any
        if (activeAbortController()) {
            activeAbortController().abort();
        }
        const controller = new AbortController();
        setActiveAbortController(controller);

        try {
            const response = await sendStreamingChat(chatMessages, {
                model: selectedModel().id,
                use_tools: copilotMode() === 'analytics',
                session_id: sessionId,
                agent_id: copilotMode() === 'analytics' ? selectedAgentId() : 'build-agent',
                signal: controller.signal,
                metadata: extraMetadata
            });

            let fullContent = '';
            let fullThought = '';

            await parseSSEStream(
                response,
                (eventType, data) => {
                    const currentMessages = messages;
                    const msgIdx = currentMessages.findIndex(m => m.id === assistantMsgId);
                    if (msgIdx === -1) return;

                    if (eventType === 'meta') {
                        setMessages(msgIdx, 'model', data.model || messages[msgIdx].model);
                    }

                    // ── TOOL PLAN (new) ──
                    if (eventType === 'plan') {
                        const tools = data.tools || [];
                        setMessages(msgIdx, produce(m => {
                            m.plannedTools = tools;
                            // Add a plan step
                            const planStep = {
                                step: 2,
                                label: `📋 Tool Plan: ${tools.length} tool(s) selected`,
                                sub: tools,
                                progress: 15,
                            };
                            m.steps.push(planStep);
                        }));
                    }

                    // ── Step progress update ──
                    if (eventType === 'step') {
                        const newStep = {
                            step: data.step,
                            label: data.label,
                            sub: data.sub,
                            progress: data.progress || 0,
                        };

                        setMessages(msgIdx, produce(m => {
                            m.currentStep = data.step;
                            const idx = m.steps.findIndex(s => s.step === data.step);
                            if (idx >= 0) m.steps[idx] = newStep;
                            else m.steps.push(newStep);
                        }));
                    }

                    // ── Individual tool call progress ──
                    if (eventType === 'tool_call') {
                        setMessages(msgIdx, produce(m => {
                            const idx = m.toolCalls.findIndex(t => t.tool === data.tool);
                            if (idx >= 0) m.toolCalls[idx].status = data.status;
                            else m.toolCalls.push({ tool: data.tool, status: data.status });
                        }));
                    }

                    // ── LLM reasoning/thought ──
                    if (eventType === 'reasoning') {
                        fullThought += (data.content || '');
                        setMessages(msgIdx, { thought: fullThought, isThinking: true });
                    }

                    // ── Error from backend ──
                    if (eventType === 'error') {
                        setMessages(msgIdx, {
                            content: data.message || `⚠️ Error: ${data.error || 'Unknown error'}`,
                            isStreaming: false,
                            isThinking: false
                        });
                    }

                    // ── Old-style thinking event ──
                    if (eventType === 'thinking') {
                        fullThought += (data.content || '');
                        setMessages(msgIdx, 'thought', fullThought);
                    }

                    // ── Content chunk streaming ──
                    if (eventType === 'chunk') {
                        fullContent += (data.content || '');
                        setMessages(msgIdx, { content: fullContent, isThinking: false });
                    }

                    // ── Final complete ──
                    if (eventType === 'complete') {
                        setMessages(msgIdx, {
                            content: data.message || fullContent,
                            components: data.components || [],
                            tool_calls_made: data.tool_calls_made || [],
                            plannedTools: data.planned_tools || messages[msgIdx]?.plannedTools || [],
                            isStreaming: false,
                            isThinking: false,
                        });
                        window.dispatchEvent(new CustomEvent('refresh-copilot-history'));
                    }
                },
                (err) => {
                    console.error('[Copilot] Stream error:', err);
                    const msgIdx = messages.findIndex(m => m.id === assistantMsgId);
                    if (msgIdx !== -1) {
                        setMessages(msgIdx, { content: `⚠️ Error: ${err.message}`, isStreaming: false, isThinking: false });
                    }
                }
            );
        } catch (e) {
            console.error('[Copilot] Chat error:', e);
            const msgIdx = messages.findIndex(m => m.id === assistantMsgId);
            if (msgIdx !== -1) {
                setMessages(msgIdx, { content: `⚠️ Connection Error: ${e.message}`, isStreaming: false, isThinking: false });
            }
        } finally {
            setIsLoading(false);
        }
    }

    // ---- Input handlers ----
    function handleInput(e) {
        const value = e.target.value;
        setInput(value);

        if (value === '/') {
            setShowSlashMenu(true);
            setSlashFilter('');
        } else if (value.startsWith('/')) {
            setShowSlashMenu(true);
            setSlashFilter(value.slice(1).toLowerCase());
        } else {
            setShowSlashMenu(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
            return;
        }

        if (e.key === 'ArrowUp' && commandHistory().length > 0 && !e.shiftKey) {
            e.preventDefault();
            const idx = historyIndex() + 1;
            if (idx < commandHistory().length) {
                setHistoryIndex(idx);
                setInput(commandHistory()[idx]);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const idx = historyIndex() - 1;
            if (idx >= 0) {
                setHistoryIndex(idx);
                setInput(commandHistory()[idx]);
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
            return;
        }

        if (e.key === 'Escape') {
            setShowSlashMenu(false);
            setShowModelDropdown(false);
            inputRef?.blur();
        }
    }

    function selectSlashCommand(cmd) {
        setActiveTools(prev => {
            if (prev.find(t => t.command === cmd.command)) return prev;
            return [...prev, {
                command: cmd.command,
                label: cmd.description,
                icon: getToolIcon(cmd.command)
            }];
        });
        setInput('');
        setShowSlashMenu(false);
        textareaRef?.focus();
    }

    function getToolIcon(cmd) {
        if (cmd === '/ta') return '📈';
        if (cmd === '/quote') return '💹';
        if (cmd === '/vessel') return '🚢';
        if (cmd === '/macro') return '🌍';
        if (cmd === '/news') return '📰';
        if (cmd === '/sentiment') return '🧠';
        return '🛠️';
    }

    function removeActiveTool(cmd) {
        setActiveTools(prev => prev.filter(t => t.command !== cmd));
        textareaRef?.focus();
    }

    // ---- Actions ----
    async function regenerateResponse(msgIdx) {
        if (isLoading()) return;

        // Truncate messages to restart from the assistant message position
        // Usually, we want to keep the history up to the user message BEFORE this assistant message
        const history = messages.slice(0, msgIdx);
        setMessages([...history]);

        // Trigger chat again using the last user message
        const lastUserMsg = history[history.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
            await handleLLMChat(lastUserMsg.content);
        }
    }

    function startEditing(msgId) {
        const idx = messages.findIndex(m => m.id === msgId);
        if (idx === -1) return;
        setMessages(idx, 'isEditing', true);
        setMessages(idx, 'tempContent', messages[idx].content);
    }

    function stopGeneration() {
        if (activeAbortController()) {
            activeAbortController().abort();
            setActiveAbortController(null);
            setIsLoading(false);

            // Set the last message to not streaming anymore
            const lastIdx = messages.length - 1;
            if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
                setMessages(lastIdx, 'isStreaming', false);
                setMessages(lastIdx, 'isThinking', false);
            }
        }
    }

    function cancelEditing(msgId) {
        const idx = messages.findIndex(m => m.id === msgId);
        if (idx === -1) return;
        setMessages(idx, 'isEditing', false);
    }

    function startResearchStream(payload) {
        setResearchStream(payload || { startedAt: Date.now() });
    }

    async function handleExecuteCode(language, code) {
        return await executeCode(language, code);
    }
    
    function handlePlanSwitch(planPath) {
        setCopilotMode('analytics');
        setSelectedAgentId('build-agent');
        
        const text = "Please execute the plan.";
        addMessage('user', text);
        
        // Push the user message to history, then call LLM
        setHistoryIndex(-1);
        handleLLMChat(text, { plan_path: planPath, switched_from_plan: true });
    }

    /**
     * AI-Powered Diagram Fixer
     * Regenerates only the broken diagram code block using the active LLM/model.
     */
    async function handleFixDiagram(msgIdx, type, code, errorMsg) {
        if (isLoading()) return;

        const normalizedType = String(type || '').toLowerCase() === 'plantuml' ? 'plantuml' : 'mermaid';
        const normalizedCode = String(code || '').trim();
        const prompt = `You are repairing a broken ${normalizedType} diagram.
The renderer failed with this error: ${errorMsg || 'Unknown render error'}

TASK:
- Fix the ${normalizedType} syntax so it renders successfully.
- Preserve the original meaning, structure, labels, and data as much as possible.
- Do not explain anything.
- Return ONLY one fenced code block using the exact language tag ${normalizedType}.
- Do not return markdown text before or after the code block.

BROKEN DIAGRAM:
\`\`\`${normalizedType}
${normalizedCode}
\`\`\`

TIPS:
- For mermaid, ensure a valid diagram type declaration and valid node/edge syntax.
- For plantuml, ensure valid @startuml / @enduml boundaries and valid relationship syntax.

Return only the corrected fenced code block.`;

        setIsLoading(true);
        try {
            const history = messages.slice(0, msgIdx).map(m => ({ role: m.role, content: m.content }));
            const response = await sendChatMessage([...history, { role: 'user', content: prompt }], {
                model: selectedModel().id,
                session_id: currentSessionId(),
                save_history: false
            });

            if (!response?.content) {
                console.warn('[Copilot] Diagram fix returned empty response');
                return;
            }

            const match = response.content.match(new RegExp('```' + normalizedType + '\\s*([\\s\\S]*?)```', 'i'));
            if (!match) {
                console.warn('[Copilot] Could not find corrected code block in LLM response');
                return;
            }

            const fixedCode = match[1].trim();
            const newCodeBlock = `\`\`\`${normalizedType}\n${fixedCode}\n\`\`\``;
            const oldCodeBlock = `\`\`\`${normalizedType}\n${normalizedCode}\n\`\`\``;
            const oldCodeBlockAlt = `\`\`\`${normalizedType}${normalizedCode}\`\`\``;

            let newContent = messages[msgIdx].content;
            if (newContent.includes(oldCodeBlock)) {
                newContent = newContent.replace(oldCodeBlock, newCodeBlock);
            } else if (newContent.includes(oldCodeBlockAlt)) {
                newContent = newContent.replace(oldCodeBlockAlt, newCodeBlock);
            } else {
                const escapedCode = normalizedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const codePattern = new RegExp('```' + normalizedType + '[\\s\\S]*?' + escapedCode + '[\\s\\S]*?```', 'i');
                newContent = newContent.replace(codePattern, newCodeBlock);
            }

            setMessages(msgIdx, 'content', newContent);
        } catch (e) {
            console.error('[Copilot] Diagram fix failed:', e);
        } finally {
            setIsLoading(false);
        }
    }

    async function saveEdit(msgId) {
        const idx = messages.findIndex(m => m.id === msgId);
        if (idx === -1) return;

        const newContent = messages[idx].tempContent;
        if (!newContent.trim()) return;

        // Truncate history from here
        const history = messages.slice(0, idx);
        setMessages([...history]);

        // Send again
        setInput(newContent);
        handleSend();
    }

    // ---- Session Management ----
    const handleNewChat = () => {
        setMessages([]);
        setCurrentSessionId(null);
        setGatewayError(null);
    };

    const handleSelectSession = async (sessionId) => {
        if (!sessionId || sessionId === 'undefined') return;
        try {
            setIsLoading(true);
            const [msgs, session] = await Promise.all([
                fetchSessionMessages(sessionId),
                fetchSessionDetails(sessionId)
            ]);

            if (session && session.agent_id) {
                setSelectedAgentId(session.agent_id);
            }

            setMessages(msgs.map(m => ({
                id: m.id || Math.random().toString(36).substr(2, 9),
                role: m.role,
                content: m.content,
                timestamp: new Date(m.created_at || m.timestamp).getTime(),
                tool_calls_made: m.tool_calls || [],
                // Reconstruct basic components if it's an assistant message with tool calls
                components: m.role === 'assistant' ? [] : [], // RichResponseRenderer will handle empty components by showing markdown
                isThinking: false,
                isStreaming: false
            })));
            setCurrentSessionId(sessionId);
            setGatewayError(null);
        } catch (e) {
            console.error("Failed to load session", e);
            setGatewayError("Failed to load chat session.");
        } finally {
            setIsLoading(false);
        }
    };

    // ---- Clear ----
    function clearConversation() {
        setMessages([]);
        setResearchStream(null);
        addMessage('system', '🧹 Conversation cleared. How can I help you?');
    }

    // ---- Model selector ----
    function handleModelSelect(model) {
        setSelectedModel(model);
        setShowModelDropdown(false);
    }

    // =========================================================================
    // RENDER — ChatGPT Professional Layout
    // =========================================================================

    return (
        <div
            class="mahameru-copilot-container"
            style={{ height: props.height || '100%' }}
        >
            <Show when={showSidebar()}>
                <MahameruCopilotSidebar
                    currentSessionId={currentSessionId}
                    onNewChat={handleNewChat}
                    onSelectSession={handleSelectSession}
                />
            </Show>

            <div class="mahameru-copilot">
                {/* ======== HEADER ======== */}
                <header class="copilot-header border-b border-white/5">
                    <div class="copilot-header-left">
                        <button
                            class="copilot-sidebar-toggle"
                            onClick={() => setShowSidebar(!showSidebar())}
                            title="Toggle Sidebar"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect width="18" height="18" x="3" y="3" rx="2" />
                                <path d="M9 3v18" />
                            </svg>
                        </button>
                        <ModelSelector
                            selectedModelId={selectedModel().id}
                            availableModels={AVAILABLE_MODELS}
                            onSelect={handleModelSelect}
                        />

                        <div class="h-4 w-px bg-white/10 mx-2" />

                        {/* Agent Selector — Only show in Analytics mode */}
                        <Show when={copilotMode() === 'analytics'}>
                            <div class="copilot-agent-selector">
                                <select
                                    class="agent-select"
                                    value={selectedAgentId()}
                                    onInput={(e) => setSelectedAgentId(e.target.value)}
                                >
                                    <For each={availableAgents()}>
                                        {(agent) => (
                                            <option value={agent.identifier}>
                                                {agent.name || agent.identifier}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                        </Show>
                    </div>


                    <div class="copilot-header-right">
                        <div class="copilot-mode-toggle">
                            <button
                                class={`mode-btn ${copilotMode() === 'chat' ? 'active' : ''}`}
                                onClick={() => setCopilotMode('chat')}
                                title="Chat Mode: Direct responses without tool analysis"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <span>Chat</span>
                            </button>
                            <button
                                class={`mode-btn ${copilotMode() === 'analytics' ? 'active' : ''}`}
                                onClick={() => setCopilotMode('analytics')}
                                title="Analytics Mode: Full agentic analysis with tools"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                                    <path d="M22 12A10 10 0 0 0 12 2v10z" />
                                </svg>
                                <span>Analytics</span>
                            </button>
                        </div>

                    </div>
                </header>


                {/* ======== ERROR BANNER ======== */}
                <Show when={gatewayError()}>
                    <div class="copilot-error-banner">
                        <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        {gatewayError()}
                    </div>
                </Show>

                {/* ======== MESSAGES AREA ======== */}
                <div ref={chatContainerRef} class="copilot-messages">
                    {/* Welcome screen */}
                    <Show when={messages.length === 0}>
                        <div class="copilot-welcome">
                            <div class="copilot-welcome-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                    <path d="M2 17l10 5 10-5" />
                                    <path d="M2 12l10 5 10-5" />
                                </svg>
                            </div>
                            <h2 class="copilot-welcome-title">How can I help you today?</h2>
                        </div>
                    </Show>

                    {/* Message list */}
                    <ErrorBoundary fallback={(err) => (
                        <div class="copilot-error-banner" style="margin: 20px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>Critical UI Crash in Chat List: {err.toString()}</span>
                        </div>
                    )}>
                        <For each={messages}>
                            {(msg, index) => (
                                <div class="copilot-msg-row"
                                    classList={{
                                        'copilot-msg-user': msg.role === 'user',
                                        'copilot-msg-assistant': msg.role === 'assistant' && !msg.isThinking,
                                        'copilot-msg-system': msg.role === 'system',
                                        'copilot-msg-thinking': msg.isThinking,
                                    }}
                                >
                                    {/* System message */}
                                    <Show when={msg.role === 'system'}>
                                        <div class="copilot-msg-system-content">{msg.content}</div>
                                    </Show>

                                    {/* User message */}
                                    <Show when={msg.role === 'user'}>
                                        <div class="copilot-msg-user-row">
                                            <div class="copilot-msg-user-content">
                                                <Show when={msg.isEditing} fallback={
                                                    <>
                                                        {msg.content}
                                                        <div class="copilot-msg-actions">
                                                            <button
                                                                class="copilot-action-btn"
                                                                title="Edit message"
                                                                onClick={() => startEditing(msg.id)}
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </>
                                                }>
                                                    <div class="copilot-edit-container">
                                                        <textarea
                                                            class="copilot-edit-textarea"
                                                            value={msg.tempContent || ''}
                                                            onInput={(e) => setMessages(index(), 'tempContent', e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    saveEdit(msg.id);
                                                                } else if (e.key === 'Escape') {
                                                                    cancelEditing(msg.id);
                                                                }
                                                            }}
                                                            ref={(el) => {
                                                                if (el) {
                                                                    el.style.height = 'auto';
                                                                    el.style.height = el.scrollHeight + 'px';
                                                                    el.focus();
                                                                }
                                                            }}
                                                        />
                                                        <div class="copilot-edit-actions">
                                                            <button class="copilot-edit-btn btn-save" onClick={() => saveEdit(msg.id)}>
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                                    <path d="M20 6L9 17l-5-5" />
                                                                </svg>
                                                            </button>
                                                            <button class="copilot-edit-btn btn-cancel" onClick={() => cancelEditing(msg.id)}>
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                                    <path d="M18 6L6 18M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </Show>
                                            </div>
                                            <div class="copilot-avatar copilot-avatar-user">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                    <circle cx="12" cy="7" r="4" />
                                                </svg>
                                            </div>
                                        </div>
                                    </Show>

                                    {/* Assistant response (Thinking or Response) */}
                                    <Show when={msg.role === 'assistant'}>
                                        <div class="copilot-msg-assistant-row">
                                            <div class="copilot-avatar copilot-avatar-assistant">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M12 8V4H8" />
                                                    <rect width="16" height="12" x="4" y="8" rx="2" />
                                                    <path d="M2 14h2" />
                                                    <path d="M20 14h2" />
                                                    <path d="M15 13v2" />
                                                    <path d="M9 13v2" />
                                                </svg>
                                            </div>
                                            <div class="copilot-msg-assistant-content">

                                                {/* ── Consolidated Thinking/Reasoning/Tool Calls ── */}
                                                <Show when={msg.isThinking || msg.thought || (msg.toolCalls && msg.toolCalls.length > 0) || (msg.steps && msg.steps.length > 0) || (msg.plannedTools && msg.plannedTools.length > 0)}>
                                                    <ThoughtBlock
                                                        label="Ai gathering data"
                                                        isThinking={msg.isThinking}
                                                        content={msg.thought}
                                                        initiallyOpen={false}
                                                    >
                                                        {/* ── PLANNED TOOLS (New) ── */}
                                                        <Show when={msg.plannedTools && msg.plannedTools.length > 0 && msg.isStreaming}>
                                                            <div class="copilot-tool-plan mt-2">
                                                                <div class="copilot-plan-header">
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.5">
                                                                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                                                                        <rect x="9" y="3" width="6" height="4" rx="1" />
                                                                        <path d="M9 14l2 2 4-4" />
                                                                    </svg>
                                                                    <span class="copilot-plan-title">Tool Plan ({msg.plannedTools.length})</span>
                                                                </div>
                                                                <div class="copilot-plan-tools">
                                                                    <For each={msg.plannedTools}>
                                                                        {(toolName) => (
                                                                            <span class="copilot-plan-chip">{toolName}</span>
                                                                        )}
                                                                    </For>
                                                                </div>
                                                            </div>
                                                        </Show>

                                                        {/* Tool Call Status (Inside the collapsed block) */}
                                                        <Show when={msg.toolCalls && msg.toolCalls.length > 0}>
                                                            <div class="copilot-tool-calls mt-2">
                                                                {/* Deduplicate tool calls by tool name to prevent redundant logs */}
                                                                <For each={[...new Map(msg.toolCalls.map(item => [item.tool, item])).values()]}>
                                                                    {(tc) => (
                                                                        <div class="copilot-tool-call-row"
                                                                            classList={{
                                                                                'tc-start': tc.status === 'start',
                                                                                'tc-complete': tc.status === 'complete',
                                                                                'tc-error': tc.status === 'error',
                                                                            }}
                                                                        >
                                                                            <Show when={tc.status === 'start' && msg.isStreaming}>
                                                                                <span class="tc-spinner" />
                                                                                <span class="tc-label">{tc.tool}</span>
                                                                            </Show>
                                                                            <Show when={tc.status === 'complete' || (tc.status === 'start' && !msg.isStreaming)}>
                                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#26a69a" stroke-width="3">
                                                                                    <path d="M20 6L9 17l-5-5" />
                                                                                </svg>
                                                                                <span class="tc-label tc-label-ok">{tc.tool}</span>
                                                                            </Show>
                                                                            <Show when={tc.status === 'error'}>
                                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef5350" stroke-width="3">
                                                                                    <path d="M18 6L6 18M6 6l12 12" />
                                                                                </svg>
                                                                                <span class="tc-label tc-label-err">{tc.tool}</span>
                                                                            </Show>
                                                                        </div>
                                                                    )}
                                                                </For>
                                                            </div>
                                                        </Show>

                                                        {/* Step Progress (Inside) */}
                                                        <Show when={msg.steps && msg.steps.length > 0}>
                                                            <div class="copilot-progress-steps mt-2">
                                                                <For each={msg.steps}>
                                                                    {(step) => (
                                                                        <div class="copilot-progress-step"
                                                                            classList={{
                                                                                'current': msg.currentStep === step.step,
                                                                                'done': step.progress === 100 || step.status === 'complete'
                                                                            }}
                                                                        >
                                                                            <div class="copilot-step-icon">
                                                                                <Show when={step.progress === 100} fallback={<span class="copilot-step-dot" />}>
                                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                                                                        <path d="M20 6L9 17l-5-5" />
                                                                                    </svg>
                                                                                </Show>
                                                                            </div>
                                                                            <div class="copilot-step-label">
                                                                                <span>{step.label}</span>
                                                                                <Show when={step.sub && step.sub.length > 0}>
                                                                                    <span class="copilot-step-sub">{step.sub.join(', ')}</span>
                                                                                </Show>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </For>
                                                            </div>
                                                        </Show>
                                                    </ThoughtBlock>
                                                </Show>

                                                 {/* ── Main Response Content ── */}
                                                 <Show when={msg.content || (msg.components && msg.components.length > 0)}>
                                                     <div class="copilot-markdown">
                                                         <ErrorBoundary fallback={(err) => (
                                                             <div class="copilot-diagram-error-container p-4 mt-2">
                                                                 <div class="copilot-diagram-error">
                                                                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                                         <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                     </svg>
                                                                     <span>Message Rendering Error</span>
                                                                 </div>
                                                                 <pre class="copilot-diagram-raw-fallback mt-2 text-xs text-red-300 whitespace-pre-wrap">{err.toString()}</pre>
                                                                 <div class="mt-2 text-xs text-gray-400 border-t border-white/10 pt-2">
                                                                     <strong>Raw Content Fallback:</strong>
                                                                     <pre class="mt-1 whitespace-pre-wrap">{msg.content}</pre>
                                                                 </div>
                                                             </div>
                                                         )}>
                                                             <RichResponseRenderer
                                                                 msgIdx={index()}
                                                                 content={msg.content}
                                                                 components={msg.components}
                                                                 isStreaming={msg.isStreaming}
                                                                 onResearchStart={startResearchStream}
                                                                 onExecuteCode={handleExecuteCode}
                                                                 onPlanSwitch={handlePlanSwitch}
                                                                 onFixDiagram={(type, code, err) => handleFixDiagram(index(), type, code, err)}
                                                             />
                                                             {/* Streaming cursor */}
                                                             <Show when={msg.isStreaming && msg.content}>
                                                                 <TypingCursor />
                                                             </Show>
                                                         </ErrorBoundary>
                                                     </div>
                                                 </Show>

                                                {/* ── Tools metadata ── */}
                                                <Show when={msg.tool_calls_made && msg.tool_calls_made.length > 0}>
                                                    <div class="copilot-tools-used">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                                                        </svg>
                                                        <span>{msg.tool_calls_made.length} tools used</span>
                                                    </div>
                                                </Show>

                                                {/* Assistant Message Actions */}
                                                <Show when={!msg.isStreaming && !msg.isThinking}>
                                                    <div class="copilot-msg-actions">
                                                        <button
                                                            class="copilot-action-btn"
                                                            title="Regenerate response"
                                                            onClick={() => regenerateResponse(index())}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                <path d="M23 4v6h-6" />
                                                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </Show>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </ErrorBoundary>

                    <div ref={messagesEndRef} />
                </div>

                {/* ======== SLASH COMMANDS ======== */}
                <Show when={showSlashMenu() && copilotMode() === 'analytics'}>
                    <div class="copilot-slash-menu">
                        <For each={getFilteredSlashCommands()}>
                            {(cmd) => (
                                <button
                                    onClick={() => selectSlashCommand(cmd)}
                                    class="copilot-slash-item"
                                >
                                    <div class="copilot-slash-item-left">
                                        <span class="copilot-slash-command">{cmd.command}</span>
                                        <span class="copilot-slash-desc">{cmd.description}</span>
                                    </div>
                                    <span class="copilot-slash-usage">{cmd.usage}</span>
                                </button>
                            )}
                        </For>
                        <Show when={getFilteredSlashCommands().length === 0}>
                            <div class="copilot-slash-empty">No matching commands</div>
                        </Show>
                    </div>
                </Show>

                {/* ======== INPUT AREA ======== */}
                <div class="copilot-input-area">
                    <Show when={messages.length === 0 && copilotMode() === 'analytics'}>
                        <div class="copilot-welcome-grid animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <QuickActionButton icon="📈" label="TA" sub="Technical Intel" onClick={() => selectSlashCommand({ command: '/ta', description: 'Technical Analysis' })} />
                            <QuickActionButton icon="💹" label="Market" sub="Quotes & Stats" onClick={() => selectSlashCommand({ command: '/quote', description: 'Market Quote' })} />
                            <QuickActionButton icon="🚢" label="Vessel" sub="Supply Chain" onClick={() => selectSlashCommand({ command: '/vessel', description: 'Vessel Intel' })} />
                            <QuickActionButton icon="🌍" label="Macro" sub="Global Trends" onClick={() => selectSlashCommand({ command: '/macro', description: 'Macro Analysis' })} />
                            <QuickActionButton icon="📰" label="News" sub="Live Sentiment" onClick={() => selectSlashCommand({ command: '/news', description: 'Latest News' })} />
                        </div>
                        <div class="h-6" />
                    </Show>

                    <div class="copilot-input-container">
                        <div class="copilot-input-main-wrap">
                            <Show when={activeTools().length > 0}>
                                <div class="copilot-input-tool-chips">
                                    <For each={activeTools()}>
                                        {(tool) => (
                                            <div class="copilot-input-tool-chip">
                                                <span class="copilot-input-tool-icon">{tool.icon}</span>
                                                <span class="copilot-input-tool-label">{tool.command}</span>
                                                <button class="copilot-input-tool-remove" onClick={() => removeActiveTool(tool.command)}>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                                        <path d="M18 6L6 18M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                            <textarea
                                ref={textareaRef}
                                value={input()}
                                onInput={handleInput}
                                onKeyDown={handleKeyDown}
                                placeholder={isLoading() ? 'Waiting for response...' : (activeTools().length > 0 ? `Enter symbols for selected tools...` : 'Message Mahameru Copilot...')}
                                disabled={isLoading()}
                                rows="1"
                                class="copilot-textarea"
                                autocomplete="off"
                                spellcheck={false}
                            />
                        </div>
                        <Show when={isLoading()}>
                            <button
                                onClick={stopGeneration}
                                class="copilot-stop-btn"
                                title="Stop generating"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                                <span>Stop</span>
                            </button>
                        </Show>
                        <button
                            onClick={handleSend}
                            disabled={!input().trim() || isLoading()}
                            class="copilot-send-btn"
                        >
                            <Show when={!isLoading()} fallback={<span class="tc-spinner" style="width: 14px; height: 14px; border-width: 2px;" />}>
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </Show>
                        </button>
                    </div>
                    <div class="copilot-input-footer">
                        <span class="copilot-input-footer-text">
                            {gatewayStatus().status === 'healthy'
                                ? `${selectedModel().name} · ${gatewayStatus().llm_enabled ? 'LLM enabled' : 'Router mode'}`

                                : 'Gateway offline'}
                        </span>
                        <span class="copilot-input-footer-text">
                            {messages.length > 0 ? `${messages.filter(m => m.role !== 'system').length} messages` : ''}
                        </span>
                    </div>
                </div>
            </div>
            <ImageModal />
        </div>
    );
}

// ---- Helper: Quick Action Button ----
function QuickActionButton(props) {
    return (
        <button
            onClick={props.onClick}
            class="copilot-quick-btn"
        >
            <span class="copilot-quick-btn-icon">{props.icon}</span>
            <div class="copilot-quick-btn-text">
                <span class="copilot-quick-btn-label">{props.label}</span>
                <span class="copilot-quick-btn-sub">{props.sub}</span>
            </div>
        </button>
    );
}
