import { createSignal, Show, For, onCleanup } from 'solid-js';
import './ModelSelector.css';

/**
 * Shared ModelSelector Component
 * Used across the Mahameru platform for consistent AI model selection.
 * 
 * Props:
 * - selectedModelId: () => string
 * - availableModels: () => Array<{id, name, provider, icon, description}>
 * - onSelect: (model) => void
 * - label: string (optional)
 */
export default function ModelSelector(props) {
    const [isOpen, setIsOpen] = createSignal(false);
    let containerRef;

    // Close on click outside
    const handleClickOutside = (e) => {
        if (containerRef && !containerRef.contains(e.target)) {
            setIsOpen(false);
        }
    };

    document.addEventListener('click', handleClickOutside);
    onCleanup(() => document.removeEventListener('click', handleClickOutside));

    const selectedModel = () => {
        const models = props.availableModels || [];
        const id = props.selectedModelId;
        return models.find(m => m.id === id) || models[0];
    };

    const handleSelect = (model) => {
        props.onSelect(model);
        setIsOpen(false);
    };

    return (
        <div class="copilot-model-selector" ref={containerRef}>
            <button
                class="copilot-model-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen());
                }}
            >
                <span class="text-[12px]">{selectedModel()?.icon}</span>
                <span class="copilot-model-name">{selectedModel()?.name}</span>
                <svg
                    class={`copilot-model-chevron ${isOpen() ? 'open' : ''}`}
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            <Show when={isOpen()}>
                <div class="copilot-model-dropdown animate-in fade-in zoom-in-95 duration-100">
                    <div class="copilot-model-dropdown-header">{props.label || 'Select Intelligence Engine'}</div>
                    <div class="copilot-model-options-list win-scroll">
                        <For each={props.availableModels}>
                            {(m) => (
                                <button
                                    class="copilot-model-option group"
                                    classList={{ 'active': props.selectedModelId === m.id }}
                                    onClick={() => handleSelect(m)}
                                >
                                    <div class="flex items-center gap-3 w-full">
                                        <span class="text-[18px] group-hover:scale-110 transition-transform shrink-0">{m.icon}</span>
                                        <div class="copilot-model-option-info flex-1">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-2">
                                                    <span class="copilot-model-option-label">{m.name}</span>
                                                    <Show when={m.tier}>
                                                        <span class="px-1 py-0.5 rounded text-[4px] font-bold uppercase tracking-widest border"
                                                            classList={{
                                                                'bg-green-500/10 text-green-500 border-green-500/20': m.tier === 'gratis',
                                                                'bg-blue-500/10 text-blue-500 border-blue-500/20': m.tier === 'murah',
                                                                'bg-purple-500/10 text-purple-500 border-purple-500/20': m.tier === 'pro',
                                                                'bg-amber-500/10 text-amber-500 border-amber-500/20': m.tier === 'premium'
                                                            }}
                                                        >
                                                            {m.tier}
                                                        </span>
                                                    </Show>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <Show when={m.price_label}>
                                                        <span class="text-[7px] font-mono opacity-60">{m.price_label}</span>
                                                    </Show>
                                                    <Show when={m.provider === 'DIT.ai'}>
                                                        <span class="px-1.5 py-0.5 rounded-md bg-text_accent/10 text-text_accent text-[5px] font-black tracking-tighter uppercase border border-text_accent/20">Enterprise</span>
                                                    </Show>
                                                </div>
                                            </div>
                                            <span class="copilot-model-option-provider">{m.provider} — {m.description}</span>
                                        </div>
                                    </div>
                                    <Show when={props.selectedModelId === m.id}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                    </Show>
                                </button>
                            )}
                        </For>
                    </div>
                </div>
            </Show>
        </div>
    );
}
