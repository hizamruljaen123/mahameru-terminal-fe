// Fixed: use environment variable instead of hardcoded production URL
const SENTIMENT_BASE_URL = import.meta.env.VITE_SENTIMENT_URL || 'https://api.asetpedia.online/sentiment';

export function useComparativeData() {
    // ... existing code ...

    const fetchWithTimeout = async (url, timeout = 15000) => {
        // ... existing implementation ...
    };

    const fetchCompanyData = async (symbol) => {
        // ... existing code ...

        // Fixed line: use SENTIMENT_BASE_URL instead of hardcoded URL
        const res = await fetchWithTimeout(
            `${SENTIMENT_BASE_URL}/api/sentiment/research?keyword=${encodeURIComponent(symbol)}`,
            15000 // Increased timeout from 6000ms to 15000ms for model inference
        );

        // ... rest of existing code ...
    };

    // ... rest of existing code ...
}
