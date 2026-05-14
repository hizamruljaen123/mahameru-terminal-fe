import { createSignal, onCleanup, Show, For } from 'solid-js';
import './ModelSelector.css'; // Reuse the same CSS for consistency

const AVAILABLE_LANGUAGES = [
    { id: 'en', name: 'English (Institutional)', icon: '🇺🇸' },
    { id: 'id', name: 'Bahasa Indonesia', icon: '🇮🇩' }
];

export default function LanguageSelector(props) {
    const [isOpen, setIsOpen] = createSignal(false);
    let containerRef;

    const selectedLang = () => AVAILABLE_LANGUAGES.find(l => l.id === props.selectedLanguage) || AVAILABLE_LANGUAGES[0];

    const handleClickOutside = (e) => {
        if (containerRef && !containerRef.contains(e.target)) {
            setIsOpen(false);
        }
    };

    window.addEventListener('click', handleClickOutside);
    onCleanup(() => window.removeEventListener('click', handleClickOutside));

    return (
        <div class="copilot-model-selector" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen())}
                class="copilot-model-btn"
                disabled={props.disabled}
            >
                <div class="flex items-center gap-2">
                    <span class="text-lg">{selectedLang().icon}</span>
                    <span class="copilot-model-name truncate">{selectedLang().name}</span>
                </div>
                <svg 
                    class={`copilot-model-chevron w-4 h-4 transition-transform duration-300 ${isOpen() ? 'rotate-180 text-text_accent' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <Show when={isOpen()}>
                <div class="copilot-model-dropdown animate-in fade-in zoom-in-95 duration-100">
                    <div class="copilot-model-dropdown-header">
                        Select Output Language
                    </div>
                    <div class="copilot-model-options-list win-scroll">
                        <For each={AVAILABLE_LANGUAGES}>
                            {(lang) => (
                                <button
                                    type="button"
                                    class={`copilot-model-option ${props.selectedLanguage === lang.id ? 'active' : ''}`}
                                    onClick={() => {
                                        props.onSelect(lang.id);
                                        setIsOpen(false);
                                    }}
                                >
                                    <div class="flex items-center gap-3">
                                        <span class="text-xl">{lang.icon}</span>
                                        <div class="copilot-model-option-info">
                                            <span class="copilot-model-option-label">{lang.name}</span>
                                            <span class="copilot-model-option-provider">Terminal Standard</span>
                                        </div>
                                    </div>
                                    <Show when={props.selectedLanguage === lang.id}>
                                        <div class="text-text_accent">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        </div>
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
