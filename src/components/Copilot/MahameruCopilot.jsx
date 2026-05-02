import { createSignal, createEffect, onMount, onCleanup, Show, For, createMemo } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import {
    sendChatMessage,
    sendStreamingChat,
    executeSlashCommand,
    checkHealth,
    parseSSEStream,
} from './copilotApi.js';
import RichResponseRenderer from './RichResponseRenderer.jsx';
import SSEStream from './SSEStream.jsx';
import './copilot.css';

/**
 * ============================================================================
 *  MAHAMERU COPILOT — ChatGPT-style Professional Redesign
 *
 *  Features:
 *  - Model selector dropdown in header
 *  - Auto-resize textarea input at bottom (ChatGPT layout)
 *  - Code syntax highlighting (highlight.js via CDN)
 *  - LaTeX rendering (KaTeX via CDN)
 *  - Conversation history with professional bubble design
 *  - Slash commands, keyboard shortcuts, command history
 * ============================================================================
 */

// ---- Configuration ----
const MAX_HISTORY = 50;
const CONTEXT_WINDOW = 20;

const SLASH_COMMANDS_LIST = [
    { command: '/ta', description: 'Technical Analysis', usage: '/ta [SYMBOL]' },
    { command: '/quote', description: 'Price Quote', usage: '/quote [SYMBOL]' },
    { command: '/vessel', description: 'Vessel Tracking Map', usage: '/vessel [AREA]' },
    { command: '/news', description: 'News Feed', usage: '/news [TOPIC]' },
    { command: '/research', description: 'Deep Research Pipeline', usage: '/research [SYMBOL]' },
    { command: '/macro', description: 'Macro Dashboard', usage: '/macro' },
    { command: '/crypto', description: 'Crypto Analysis', usage: '/crypto [SYMBOL]' },
    { command: '/forex', description: 'Forex Rates', usage: '/forex [PAIR]' },
    { command: '/sentiment', description: 'Market Sentiment', usage: '/sentiment [TOPIC]' },
    { command: '/regime', description: 'Market Regime', usage: '/regime' },
    { command: '/help', description: 'Show all commands', usage: '/help' },
];

const AVAILABLE_MODELS = [
    { value: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner', provider: 'deepseek' },
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', provider: 'deepseek' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', provider: 'deepseek' },
    { value: 'deepseek-r1', label: 'DeepSeek R1', provider: 'deepseek' },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', provider: 'dit' },
    { value: 'gpt-5.1', label: 'GPT-5.1', provider: 'dit' },
    { value: 'gpt-5.2', label: 'GPT-5.2', provider: 'dit' },
    { value: 'gpt-5.3', label: 'GPT-5.3', provider: 'dit' },
    { value: 'gpt-5.4', label: 'GPT-5.4', provider: 'dit' },
    { value: 'gpt-5.5', label: 'GPT-5.5', provider: 'dit' },
    { value: 'kimi-k2.5', label: 'Kimi K2.5', provider: 'dit' },
];

/**
 * Collapsible Thinking/Reasoning block
 */
const ThoughtBlock = (props) => {
    const [isOpen, setIsOpen] = createSignal(props.initiallyOpen ?? false);

    return (
        <div class="copilot-thought-container">
            <div
                class={`copilot-thought-header ${isOpen() ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen())}
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M9 18l6-6-6-6" />
                </svg>
                <span>{props.isThinking ? 'Thinking...' : 'Thought'}</span>
            </div>
            <Show when={isOpen() || props.isThinking}>
                <div class="copilot-thought-content">
                    {props.content}
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
    const [researchStream, setResearchStream] = createSignal(null);
    const [commandHistory, setCommandHistory] = createSignal([]);
    const [historyIndex, setHistoryIndex] = createSignal(-1);
    const [gatewayError, setGatewayError] = createSignal(null);
    const [selectedModel, setSelectedModel] = createSignal(
        () => AVAILABLE_MODELS.find(m => m.value === (import.meta.env.VITE_COPILOT_LLM_MODEL || 'deepseek-chat'))
            || AVAILABLE_MODELS[0]
    );
    const [showModelDropdown, setShowModelDropdown] = createSignal(false);

    let messagesEndRef;
    let inputRef;
    let chatContainerRef;
    let textareaRef;
    let modelDropdownRef;

    // ---- Gateway health check ----
    onMount(async () => {
        console.log("[Copilot] Checking gateway health at localhost:8500...");
        const status = await checkHealth();
        console.log("[Copilot] Gateway Status:", status);
        setGatewayStatus(status);
        props.onGatewayStatus?.(status);

        if (status.status === 'offline' || status.status === 'unhealthy') {
            setGatewayError(`Copilot Gateway is ${status.status}. Some features may be unavailable.`);
        }

        inputRef?.focus();
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

    // ---- Auto-scroll ----
    createEffect(() => {
        if (messages.length > 0) {
            // Subscribe to the last message's content/thought/steps to trigger scroll
            const lastMsg = messages[messages.length - 1];
            const _trigger = (lastMsg.content?.length || 0) + (lastMsg.thought?.length || 0) + (lastMsg.steps?.length || 0);

            // Use 'auto' instead of 'smooth' during streaming to prevent jitter
            messagesEndRef?.scrollIntoView({ behavior: 'auto' });
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
            model: role === 'assistant' ? selectedModel().label : undefined,
            steps: [],
            toolCalls: [],
            thought: '',
            isThinking: false,
            isStreaming: false,
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
        if (!text || isLoading()) return;

        setInput('');
        setShowSlashMenu(false);

        addMessage('user', text);

        setCommandHistory(prev => {
            const updated = [text, ...prev.filter(c => c !== text)];
            return updated.slice(0, 50);
        });
        setHistoryIndex(-1);

        if (text.startsWith('/')) {
            await handleSlashCommand(text);
            return;
        }

        await handleLLMChat(text);
    }

    // ---- Slash command ----
    async function handleSlashCommand(text) {
        setIsLoading(true);
        try {
            addMessage('assistant', '', [], { isThinking: true });
            const response = await executeSlashCommand(text);
            setMessages(prev => prev.filter(m => !m.isThinking));
            addMessage('assistant', response.message || `Executed ${text}`, response.components || []);
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
    async function handleLLMChat(text) {
        setIsLoading(true);
        const allMessages = messages;
        const chatMessages = allMessages
            .filter(m => !m.isThinking && m.role !== 'system')
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
            isThinking: true,
            isStreaming: true,
            steps: [],            // array of {step, label, sub?, progress}
            toolCalls: [],        // array of {tool, status}
            currentStep: null,
            timestamp: Date.now(),
            model: selectedModel().label
        }]);

        try {
            const response = await sendStreamingChat(chatMessages, {
                model: selectedModel().value,
            });

            let fullContent = '';
            let fullThought = '';

            await parseSSEStream(
                response,
                (eventType, data) => {
                    const msgIdx = messages.findIndex(m => m.id === assistantMsgId);
                    if (msgIdx === -1) return;

                    if (eventType === 'meta') {
                        setMessages(msgIdx, 'model', data.model || messages[msgIdx].model);
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
                            isStreaming: false,
                            isThinking: false,
                        });
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
        setInput(cmd.command + ' ');
        setShowSlashMenu(false);
        inputRef?.focus();
    }

    // ---- Actions ----
    async function regenerateResponse(msgIdx) {
        if (isLoading()) return;
        
        // Truncate messages to restart from the assistant message position
        const history = messages.slice(0, msgIdx);
        setMessages([...history]);
        
        // Trigger chat again
        await handleLLMChat();
    }

    function editMessage(msgIdx) {
        if (isLoading()) return;
        
        const msg = messages[msgIdx];
        if (msg.role !== 'user') return;
        
        setInput(msg.content);
        // Truncate messages from the user message position
        setMessages(messages.slice(0, msgIdx));
        
        // Focus textarea
        setTimeout(() => textareaRef?.focus(), 50);
    }

    // ---- Research stream ----
    function startResearchStream(symbols, analysisType) {
        setResearchStream({ symbols, analysisType });
        addMessage('system', `📡 Starting Deep Research Pipeline for ${symbols}...`);
    }

    function onResearchComplete() { setResearchStream(null); }
    function onResearchError(error) {
        addMessage('assistant', `⚠️ Research error: ${error}`, [{
            type: 'markdown',
            data: `The research pipeline encountered an error: ${error}`,
        }]);
        setResearchStream(null);
    }

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
            class={`mahameru-copilot flex flex-col ${props.className || ''}`}
        >


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
                <For each={messages}>
                    {(msg) => (
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
                                        {msg.content}
                                        
                                        {/* User Message Actions */}
                                        <div class="copilot-msg-actions">
                                            <button 
                                                class="copilot-action-btn" 
                                                title="Edit message"
                                                onClick={() => editMessage(index())}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </button>
                                        </div>
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

                                        {/* ── Step Progress Indicator (Visible during thinking) ── */}
                                        <Show when={msg.steps && msg.steps.length > 0}>
                                            <div class="copilot-progress-steps">
                                                <For each={msg.steps}>
                                                    {(step) => {
                                                        const isCurrent = step.step === msg.currentStep;
                                                        const isDone = step.progress === 100;
                                                        return (
                                                            <div class="copilot-progress-step"
                                                                classList={{
                                                                    'current': isCurrent,
                                                                    'done': isDone || step.progress === 100,
                                                                }}
                                                            >
                                                                <div class="copilot-step-icon">
                                                                    <Show when={isDone || step.progress === 100} fallback={
                                                                        <Show when={isCurrent} fallback={
                                                                            <span class="copilot-step-dot" />
                                                                        }>
                                                                            <span class="copilot-step-spinner" />
                                                                        </Show>
                                                                    }>
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
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
                                                        );
                                                    }}
                                                </For>
                                            </div>
                                        </Show>

                                        {/* ── Tool Call Status (Visible during thinking) ── */}
                                        <Show when={msg.toolCalls && msg.toolCalls.length > 0}>
                                            <div class="copilot-tool-calls">
                                                <For each={msg.toolCalls}>
                                                    {(tc) => (
                                                        <div class="copilot-tool-call-row"
                                                            classList={{
                                                                'tc-start': tc.status === 'start',
                                                                'tc-complete': tc.status === 'complete',
                                                                'tc-error': tc.status === 'error',
                                                            }}
                                                        >
                                                            <Show when={tc.status === 'start'}>
                                                                <span class="tc-spinner" />
                                                                <span class="tc-label">{tc.tool}</span>
                                                            </Show>
                                                            <Show when={tc.status === 'complete'}>
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

                                        {/* ── Thinking dots (fallback if no steps yet) ── */}
                                        <Show when={msg.isThinking && (!msg.steps || msg.steps.length === 0)}>
                                            <div class="copilot-thinking">
                                                <div class="copilot-thinking-dots">
                                                    <span class="copilot-dot"></span>
                                                    <span class="copilot-dot"></span>
                                                    <span class="copilot-dot"></span>
                                                </div>
                                                <span>Thinking...</span>
                                            </div>
                                        </Show>

                                        {/* ── Reasoning/Thought Block ── */}
                                        <Show when={msg.thought}>
                                            <ThoughtBlock
                                                content={msg.thought}
                                                isThinking={msg.isStreaming && !msg.content}
                                                initiallyOpen={msg.isStreaming && !msg.content}
                                            />
                                        </Show>

                                        {/* ── Main Response Content ── */}
                                        <Show when={msg.content || (msg.components && msg.components.length > 0)}>
                                            <div class="copilot-markdown">
                                                <RichResponseRenderer
                                                    content={msg.content}
                                                    components={msg.components}
                                                    onResearchStart={startResearchStream}
                                                />
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

                {/* Research stream */}
                <Show when={researchStream()}>
                    <div class="copilot-msg-row copilot-msg-assistant">
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
                                <SSEStream
                                    symbols={researchStream().symbols}
                                    analysisType={researchStream().analysisType}
                                    onComplete={onResearchComplete}
                                    onError={onResearchError}
                                />
                            </div>
                        </div>
                    </div>
                </Show>

                <div ref={messagesEndRef} />
            </div>

            {/* ======== SLASH COMMANDS ======== */}
            <Show when={showSlashMenu()}>
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
                <Show when={messages.length === 0}>
                    <div class="copilot-welcome-grid">
                        <QuickActionButton icon="📈" label="TA" onClick={() => setInput('/ta ')} />
                        <QuickActionButton icon="💹" label="Market" onClick={() => setInput('/quote ')} />
                        <QuickActionButton icon="🚢" label="Vessel" onClick={() => setInput('/vessel ')} />
                        <QuickActionButton icon="🔬" label="Research" onClick={() => setInput('/research ')} />
                        <QuickActionButton icon="🌍" label="Macro" onClick={() => setInput('/macro')} />
                        <QuickActionButton icon="📰" label="News" onClick={() => setInput('/news ')} />
                    </div>
                    <div class="h-8" /> {/* spacer */}
                </Show>

                <div class="copilot-input-container">
                    <textarea
                        ref={textareaRef}
                        value={input()}
                        onInput={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder={isLoading() ? 'Waiting for response...' : 'Message Mahameru Copilot...'}
                        disabled={isLoading()}
                        rows="1"
                        class="copilot-textarea"
                        autocomplete="off"
                        spellcheck={false}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input().trim() || isLoading()}
                        class="copilot-send-btn"
                    >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
                <div class="copilot-input-footer">
                    <span class="copilot-input-footer-text">
                        {gatewayStatus().status === 'healthy'
                            ? `${selectedModel().label} · ${gatewayStatus().llm_enabled ? 'LLM enabled' : 'Router mode'}`
                            : 'Gateway offline'}
                    </span>
                    <span class="copilot-input-footer-text">
                        {messages.length > 0 ? `${messages.filter(m => m.role !== 'system').length} messages` : ''}
                    </span>
                </div>
            </div>
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
