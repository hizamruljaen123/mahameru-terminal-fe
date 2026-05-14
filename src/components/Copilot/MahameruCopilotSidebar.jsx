import { For, Show, createSignal, onMount, createMemo, createEffect, onCleanup } from 'solid-js';
import { fetchHistory, deleteSession, renameSession } from './copilotApi';
import './copilotSidebar.css';

export function MahameruCopilotSidebar(props) {
    const [history, setHistory] = createSignal([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [editingId, setEditingId] = createSignal(null);
    const [editTitle, setEditTitle] = createSignal('');
    const [confirmDeleteId, setConfirmDeleteId] = createSignal(null);
    const [isDeleting, setIsDeleting] = createSignal(false);

    let sidebarRef;

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const data = await fetchHistory();
            setHistory(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Failed to load history', e);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(loadHistory);

    onMount(() => {
        const handler = () => loadHistory();
        window.addEventListener('refresh-copilot-history', handler);
        return () => window.removeEventListener('refresh-copilot-history', handler);
    });

    createEffect(() => {
        const activeId = confirmDeleteId();
        if (!activeId) return;

        const handlePointerDown = (event) => {
            if (!sidebarRef?.contains(event.target)) {
                setConfirmDeleteId(null);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setConfirmDeleteId(null);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleEscape);
        onCleanup(() => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
        });
    });

    const handleDelete = async (id, e) => {
        if (e) e.stopPropagation();
        if (isDeleting()) return;

        try {
            setIsDeleting(true);
            await deleteSession(id);
            setConfirmDeleteId(null);
            await loadHistory();
            if (props.currentSessionId() === id) {
                props.onNewChat();
            }
        } catch (e) {
            console.error('Failed to delete session', e);
            alert('Failed to delete session');
        } finally {
            setIsDeleting(false);
        }
    };

    const startRename = (session, e) => {
        e.stopPropagation();
        setConfirmDeleteId(null);
        setEditingId(session.session_id);
        setEditTitle(session.title || '');
    };

    const handleRename = async (id) => {
        const title = editTitle().trim();
        if (title) {
            try {
                await renameSession(id, title);
                setEditingId(null);
                await loadHistory();
            } catch (e) {
                console.error('Failed to rename session', e);
                alert('Failed to rename session');
            }
        } else {
            setEditingId(null);
        }
    };

    const groupedHistory = createMemo(() => {
        const groups = {
            Today: [],
            Yesterday: [],
            'Previous 7 Days': [],
            Older: []
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        history().forEach((session) => {
            const date = new Date(session.updated_at || session.created_at);
            if (date >= today) groups.Today.push(session);
            else if (date >= yesterday) groups.Yesterday.push(session);
            else if (date >= lastWeek) groups['Previous 7 Days'].push(session);
            else groups.Older.push(session);
        });

        return Object.entries(groups).filter(([, items]) => items.length > 0);
    });

    return (
        <aside class="copilot-history-sidebar" ref={sidebarRef}>
            <div class="sidebar-header">
                <button class="new-chat-btn" onClick={props.onNewChat}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>New Chat</span>
                </button>
            </div>

            <div class="history-list win-scroll">
                <Show
                    when={!isLoading()}
                    fallback={
                        <div class="history-skeleton">
                            <div class="skeleton-item" />
                            <div class="skeleton-item" />
                            <div class="skeleton-item" />
                            <div class="skeleton-item" style="width: 80%" />
                        </div>
                    }
                >
                    <For each={groupedHistory()}>
                        {([label, sessions]) => (
                            <div class="history-group">
                                <div class="group-label">{label}</div>
                                <For each={sessions}>
                                    {(session) => {
                                        const isConfirming = () => confirmDeleteId() === session.session_id;
                                        const isEditing = () => editingId() === session.session_id;

                                        return (
                                            <div
                                                class={`history-item ${props.currentSessionId() === session.session_id ? 'active' : ''} ${isConfirming() ? 'danger-active' : ''}`}
                                                onClick={() => {
                                                    if (!isEditing()) {
                                                        props.onSelectSession(session.session_id);
                                                    }
                                                }}
                                            >
                                                <svg class="item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                                </svg>

                                                <div class="item-content">
                                                    <Show
                                                        when={isEditing()}
                                                        fallback={
                                                            <div class="item-text-wrap">
                                                                <span class="item-title">{session.title || 'Untitled Chat'}</span>
                                                                <span class="item-subtitle">{session.model || 'Unknown Model'}</span>
                                                            </div>
                                                        }
                                                    >
                                                        <input
                                                            class="item-edit-input"
                                                            value={editTitle()}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onInput={(e) => setEditTitle(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleRename(session.session_id);
                                                                if (e.key === 'Escape') setEditingId(null);
                                                            }}
                                                            onBlur={() => handleRename(session.session_id)}
                                                            autoFocus
                                                        />
                                                    </Show>
                                                </div>

                                                <div class={`item-actions ${isConfirming() ? 'visible' : ''}`}>
                                                    <Show
                                                        when={isConfirming()}
                                                        fallback={
                                                            <>
                                                                <button 
                                                                    class="action-btn" 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const link = `${window.location.origin}/copilot/chat/${session.session_id}`;
                                                                        navigator.clipboard.writeText(link);
                                                                        // Optional: You could add a toast here instead of alert
                                                                        alert("Link copied to clipboard!");
                                                                    }} 
                                                                    title="Copy Link"
                                                                    aria-label="Copy share link"
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                                                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                                                    </svg>
                                                                </button>
                                                                <button class="action-btn" onClick={(e) => startRename(session, e)} title="Rename" aria-label="Rename session">
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    class="action-btn delete-trigger"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingId(null);
                                                                        setConfirmDeleteId(session.session_id);
                                                                    }}
                                                                    title="Delete"
                                                                    aria-label="Delete session"
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                    </svg>
                                                                </button>
                                                            </>
                                                        }
                                                    >
                                                        <div class="confirm-delete-popup" onClick={(e) => e.stopPropagation()}>
                                                            <span class="confirm-delete-label">Delete?</span>
                                                            <button class="confirm-yes" disabled={isDeleting()} onClick={(e) => handleDelete(session.session_id, e)}>
                                                                {isDeleting() ? 'Deleting...' : 'Delete'}
                                                            </button>
                                                            <button class="confirm-no" disabled={isDeleting()} onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConfirmDeleteId(null);
                                                            }}>
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </Show>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        )}
                    </For>
                </Show>
            </div>
        </aside>
    );
}
