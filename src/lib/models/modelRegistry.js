/**
 * Mahameru Terminal — Global Model Registry
 * Central source of truth for all LLM models available across the platform.
 */

export const MODEL_PROVIDERS = {
    DEEPSEEK: 'DeepSeek',
    GOOGLE: 'Google',
    OPENAI: 'OpenAI',
    MOONSHOT: 'Moonshot AI',
    MINIMAX: 'Minimax',
    ANTHROPIC: 'Anthropic',
    META: 'Meta',
    OPENROUTER: 'OpenRouter',
    DIT: 'DIT.ai',
    OSIRIS: 'Osiris Code',
};

export const AVAILABLE_MODELS = [
    // ============================================================
    // === GRATIS (FREE) TIERS — OpenRouter :free variants
    // Sumber: openrouter.ai/collections/free-models (Mei 2026)
    // Rate limit: 20 req/menit, 200 req/hari per model
    // ============================================================
    {
        id: 'openai/gpt-oss-120b:free',
        name: 'GPT OSS 120B (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'High-reasoning, agentic MoE 117B. 131K context.',
        icon: '🧠',
        type: 'reasoning',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'openai/gpt-oss-20b:free',
        name: 'GPT OSS 20B (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Low-latency agentic MoE 21B. 131K context.',
        icon: '⚡',
        type: 'balanced',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'google/gemma-3-27b-it:free',
        name: 'Gemma 3 27B (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Multimodal vision & text. 131K context.',
        icon: '🔮',
        type: 'balanced',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'google/gemma-3-12b-it:free',
        name: 'Gemma 3 12B (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Balanced multimodal performance. 131K context.',
        icon: '💎',
        type: 'balanced',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Multilingual dialogue & reasoning. 66K context.',
        icon: '🦙',
        type: 'chat',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'meta-llama/llama-3.2-3b-instruct:free',
        name: 'Llama 3.2 3B (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Efficient multilingual dialogue.',
        icon: '🐑',
        type: 'chat',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'nvidia/nemotron-3-super-120b-a12b:free',
        name: 'Nemotron 3 Super (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'NVIDIA 120B MoE — 262K context, SWE-Bench 60.47%.',
        icon: '🟢',
        type: 'reasoning',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        name: 'Nemotron 3 Nano Omni (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Multimodal (text/image/video/audio) sub-agent. 256K context.',
        icon: '👁️',
        type: 'balanced',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'nvidia/nemotron-3-nano-30b-a3b:free',
        name: 'Nemotron 3 Nano 30B (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Specialized small language MoE model.',
        icon: '🧪',
        type: 'balanced',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'nvidia/nemotron-nano-12b-v2-vl:free',
        name: 'Nemotron Nano 12B VL (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Video & document intelligence. 128K context.',
        icon: '📽️',
        type: 'balanced',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'nvidia/nemotron-nano-9b-v2:free',
        name: 'Nemotron Nano 9B V2 (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Unified reasoning trace model. 128K context.',
        icon: '🧬',
        type: 'balanced',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'qwen/qwen3-coder-480b-a35b-instruct:free',
        name: 'Qwen 3 Coder 480B (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Best free coding model on OpenRouter. 262K context.',
        icon: '💻',
        type: 'chat',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'qwen/qwen3-next-80b-a35b-instruct:free',
        name: 'Qwen 3 Next 80B (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Fast, stable responses for RAG.',
        icon: '🚀',
        type: 'balanced',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'z-ai/glm-4.5-air:free',
        name: 'GLM 4.5 Air (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Lightweight agent-centric variant.',
        icon: '🌪️',
        type: 'balanced',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'nousresearch/hermes-3-405b:free',
        name: 'Hermes 3 405B (Free)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Frontier-level steerable model.',
        icon: '🎭',
        type: 'reasoning',
        tier: 'gratis',
        price_label: 'Free'
    },
    {
        id: 'deepseek/deepseek-r1:free',
        name: 'DeepSeek R1 (Free Router)',
        provider: MODEL_PROVIDERS.OPENROUTER,
        description: 'Failover free route untuk DeepSeek R1. Rate limited.',
        icon: '🔗',
        type: 'reasoning',
        tier: 'gratis',
        price_label: 'Free'
    },

    // ============================================================
    // === MURAH (ECONOMY) TIERS
    // ============================================================
    {
        id: 'minimax-m2.5',
        name: 'Minimax M2.5',
        provider: MODEL_PROVIDERS.DIT,
        description: 'High-performance MoE for efficient data synthesis.',
        icon: '🐉',
        type: 'balanced',
        tier: 'murah',
        price_label: '$0.30 / $1.20 per 1M'   // DIPERBARUI: Resmi DIT
    },
    {
        id: 'minimax-m2.7',
        name: 'Minimax M2.7',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Advanced MoE model for production scale.',
        icon: '🌊',
        type: 'balanced',
        tier: 'murah',
        price_label: '$0.31 / $1.22 per 1M'   // DIPERBARUI: Resmi DIT
    },
    {
        id: 'deepseek-v4-flash',
        name: 'DeepSeek V4 Flash',
        provider: MODEL_PROVIDERS.DEEPSEEK,
        description: 'Ultra-fast flagship DeepSeek. 1M context, thinking & non-thinking mode.',
        icon: '⚡',
        type: 'balanced',
        tier: 'murah',
        price_label: '$0.14 / $0.28 per 1M'   // Input / Output — harga resmi DeepSeek
    },
    {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash Preview',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Low-latency intelligence for real-time tasks.',
        icon: '✨',
        type: 'balanced',
        tier: 'murah',
        price_label: '$0.50 / $3.00 per 1M'   // DIPERBARUI: Resmi DIT
    },
    {
        id: 'kimi-k2.5',
        name: 'Kimi k2.5',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Superior performance in long-context & research.',
        icon: '🌙',
        type: 'chat',
        tier: 'murah',
        price_label: '$0.60 / $3.00 per 1M'   // DIPERBARUI: Resmi DIT
    },
    {
        id: 'gpt-5.4-mini',
        name: 'GPT 5.4 Mini',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Cost-effective high-performance model.',
        icon: '📉',
        type: 'balanced',
        tier: 'murah',
        price_label: '$0.75 / $4.50 per 1M'   // DIPERBARUI: Resmi DIT
    },
    {
        id: 'claude-haiku-4-5-20251001',
        name: 'Claude 4.5 Haiku',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Fastest & cheapest Claude. 200K context.',
        icon: '⚡',
        type: 'balanced',
        tier: 'murah',
        price_label: '$1.00 / $5.00 per 1M'   // Input / Output — harga resmi Anthropic ( Cocok dengan DIT)
    },
    {
        id: 'gpt-5.1',
        name: 'GPT 5.1',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Reliable production-grade model.',
        icon: '🏢',
        type: 'balanced',
        tier: 'murah',                        // DITURUNKAN TIER: Harga input sangat murah
        price_label: '$1.25 / $10.00 per 1M'  // DIPERBARUI: Resmi DIT
    },
    {
        id: 'gemini-3.1-flash-image-preview',
        name: 'Gemini 3.1 Flash Image',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Rapid visual analysis (Khusus Gambar).',
        icon: '📸',
        type: 'balanced',
        tier: 'murah',                        // DITURUNKAN TIER: Input murah, mahal hanya di output gambar
        price_label: '$0.50 / $60.00 per 1M'  // DIPERBARUI: Resmi DIT
    },
    {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat (V4 Flash)',
        provider: MODEL_PROVIDERS.DEEPSEEK,
        description: '⚠️ Alias deepseek-v4-flash (non-thinking). Akan deprecated. 1M context.',
        icon: '💬',
        type: 'chat',
        tier: 'murah',
        price_label: '$0.14 / $0.28 per 1M'   // Input / Output — harga resmi DeepSeek
    },
    {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner (V4 Flash)',
        provider: MODEL_PROVIDERS.DEEPSEEK,
        description: '⚠️ Alias deepseek-v4-flash (thinking mode). Akan deprecated. 1M context.',
        icon: '🧠',
        type: 'reasoning',
        tier: 'murah',
        price_label: '$0.14 / $0.28 per 1M'   // Input / Output — harga resmi DeepSeek
    },
    {
        id: 'deepseek-r1',
        name: 'DeepSeek R1 (Production)',
        provider: MODEL_PROVIDERS.DEEPSEEK,
        description: 'Production-ready R1 reasoning. 64K context. Higher uptime.',
        icon: '🚀',
        type: 'reasoning',
        tier: 'murah',
        price_label: '$0.70 / $2.50 per 1M'   // Input / Output — via OpenRouter
    },

    // ============================================================
    // === PRO (PROFESSIONAL) TIERS
    // ============================================================
    {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro Preview',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Next-gen reasoning with multi-modal support.',
        icon: '♊',
        type: 'reasoning',
        tier: 'pro',
        price_label: '$2.00 / $12.00 per 1M'  // DIPERBARUI: Resmi DIT
    },
    {
        id: 'gpt-5.2',
        name: 'GPT 5.2',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Advanced production assistant.',
        icon: '🤖',
        type: 'reasoning',
        tier: 'pro',
        price_label: '$1.75 / $14.00 per 1M'  // DIPERBARUI: Resmi DIT
    },
    {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro Preview',
        provider: MODEL_PROVIDERS.DIT,
        description: 'High-fidelity reasoning with massive context.',
        icon: '🧬',
        type: 'reasoning',
        tier: 'pro',
        price_label: '$2.00 / $12.00 per 1M'  // DIPERBARUI: Resmi DIT
    },
    {
        id: 'gpt-5.4',
        name: 'GPT 5.4',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Professional grade assistant.',
        icon: '🛡️',
        type: 'balanced',
        tier: 'pro',
        price_label: '$2.50 / $15.00 per 1M'  // DIPERBARUI: Resmi DIT
    },
    {
        id: 'claude-sonnet-4-6',
        name: 'Claude 4.6 Sonnet',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Balanced flagship. 1M context, extended thinking support.',
        icon: '🎭',
        type: 'balanced',
        tier: 'pro',
        price_label: '$3.00 / $15.00 per 1M'  // Input / Output — harga resmi Anthropic
    },
    {
        id: 'claude-sonnet-4-5-20250929',
        name: 'Claude 4.5 Sonnet',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Efficient flagship variant (Sep 2025). 200K context.',
        icon: '🎻',
        type: 'balanced',
        tier: 'pro',
        price_label: '$3.00 / $15.00 per 1M'  // Input / Output — harga resmi Anthropic
    },
    {
        id: 'deepseek-v4-pro',
        name: 'DeepSeek V4 Pro',
        provider: MODEL_PROVIDERS.DEEPSEEK,
        description: 'High-precision reasoning. 1M context. (Promo 75% off s/d 31 Mei 2026)',
        icon: '💎',
        type: 'reasoning',
        tier: 'pro',
        price_label: '$1.74 / $3.48 per 1M'  // Input / Output — harga resmi DeepSeek (promo)
    },

    // ============================================================
    // === PREMIUM (INSTITUTIONAL) TIERS
    // ============================================================
    {
        id: 'claude-opus-4-6',
        name: 'Claude 4.6 Opus',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Flagship reasoning. 1M context flat-rate, extended thinking.',
        icon: '🧠',
        type: 'reasoning',
        tier: 'premium',
        price_label: '$5.00 / $25.00 per 1M'  // Input / Output — harga resmi Anthropic
    },
    {
        id: 'claude-opus-4-5-20251101',
        name: 'Claude 4.5 Opus',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Deep reasoning (Nov 2025 release). 1M context.',
        icon: '💎',
        type: 'reasoning',
        tier: 'premium',
        price_label: '$5.00 / $25.00 per 1M'  // Input / Output — harga resmi Anthropic
    },
    {
        id: 'claude-opus-4-7',
        name: 'Claude 4.7 Opus',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Frontier reasoning. Rilis Apr 2026, tokenizer baru (+35% token).',
        icon: '🚀',
        type: 'reasoning',
        tier: 'premium',
        price_label: '$5.00 / $25.00 per 1M'  // Input / Output — harga resmi Anthropic
    },
    {
        id: 'gpt-5.5',
        name: 'GPT 5.5',
        provider: MODEL_PROVIDERS.DIT,
        description: 'Balanced frontier model for production assistants, coding, and tool use.',
        icon: '✨',
        type: 'reasoning',
        tier: 'premium',
        price_label: '$5.00 / $30.00 per 1M'  // DIPERBARUI: Resmi DIT (Deskripsi juga disesuaikan)
    },
    {
        id: 'gpt-image-2',
        name: 'DIT Image Gen v2',
        provider: MODEL_PROVIDERS.DIT,
        description: 'AI image generation (Khusus Gambar).',
        icon: '🖼️',
        type: 'balanced',
        tier: 'premium',
        price_label: '$8.00 / $30.00 per 1M'
    },

    // ============================================================
    // === OSIRIS CODE — Frontier Fallback Suite
    // ============================================================
    {
        id: 'claude-opus-4-6:osiris',
        name: 'Claude 4.6 Opus (Osiris)',
        provider: MODEL_PROVIDERS.OSIRIS,
        description: 'Frontier reasoning via Osiris Code. 1M context.',
        icon: '🧠',
        type: 'reasoning',
        tier: 'premium',
        price_label: '$5.00 / $25.00 per 1M'
    },
    {
        id: 'claude-sonnet-4-5:osiris',
        name: 'Claude 4.5 Sonnet (Osiris)',
        provider: MODEL_PROVIDERS.OSIRIS,
        description: 'Balanced flagship, 200K context.',
        icon: '🎭',
        type: 'balanced',
        tier: 'pro',
        price_label: '$3.00 / $15.00 per 1M'
    },
    {
        id: 'gpt-5-4:osiris',
        name: 'Codex GPT 5.4 (Osiris)',
        provider: MODEL_PROVIDERS.OSIRIS,
        description: 'Professional grade assistant, 200K context.',
        icon: '🛡️',
        type: 'balanced',
        tier: 'pro',
        price_label: '$1.25 / $2.50 per 1M'
    },
    {
        id: 'gpt-5-5:osiris',
        name: 'Codex GPT 5.5 (Osiris)',
        provider: MODEL_PROVIDERS.OSIRIS,
        description: 'Frontier coding & technical reasoning, 200K context.',
        icon: '💻',
        type: 'reasoning',
        tier: 'premium',
        price_label: '$2.50 / $5.00 per 1M'
    },
    {
        id: 'deepseek-v4-pro:osiris',
        name: 'DeepSeek V4 Pro (Osiris)',
        provider: MODEL_PROVIDERS.OSIRIS,
        description: 'High-precision reasoning, 1M context.',
        icon: '💎',
        type: 'reasoning',
        tier: 'pro',
        price_label: '$1.74 / $3.48 per 1M'
    },
    {
        id: 'gemini-3-1-pro:osiris',
        name: 'Gemini 3.1 Pro (Osiris)',
        provider: MODEL_PROVIDERS.OSIRIS,
        description: 'High-fidelity reasoning, 1M context.',
        icon: '🧬',
        type: 'reasoning',
        tier: 'pro',
        price_label: '$4.00 / $15.00 per 1M'
    },
    {
        id: 'glm-5.1:osiris',
        name: 'GLM 5.1 (Osiris)',
        provider: MODEL_PROVIDERS.OSIRIS,
        description: 'Advanced multilingual MoE, 203K context.',
        icon: '🌪️',
        type: 'balanced',
        tier: 'pro',
        price_label: '$1.76 / $5.54 per 1M'
    },
    {
        id: 'glm-5v-turbo:osiris',
        name: 'GLM 5V Turbo (Osiris)',
        provider: MODEL_PROVIDERS.OSIRIS,
        description: 'Multimodal vision specialist, 200K context.',
        icon: '📸',
        type: 'balanced',
        tier: 'murah',
        price_label: '$0.55 / $2.19 per 1M'
    },
    {
        id: 'kimi-k2.6:osiris',
        name: 'Kimi K2.6 (Osiris)',
        provider: MODEL_PROVIDERS.OSIRIS,
        description: 'Superior performance in research & long-context, 256K context.',
        icon: '🌙',
        type: 'chat',
        tier: 'pro',
        price_label: '$0.95 / $4.00 per 1M'
    }
]

export const DEFAULT_MODEL_ID = 'minimax-m2.5';
