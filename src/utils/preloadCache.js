/**
 * Preload Cache Utility for MarketDashboard
 * Purpose: Load cached market data instantly from static JSON or localStorage
 *          to eliminate perceived loading time on page open.
 *
 * Strategy:
 * 1. On mount, try to load from localStorage first (most recent user session)
 * 2. Fallback to /assets/market-preload.json (shipped default / last known good)
 * 3. After successful API fetch, persist to localStorage for next visit
 */

const CACHE_KEY = 'mahameru_market_dashboard_cache';
const CACHE_VERSION = 1;

/**
 * Load preload data from localStorage or fallback to static JSON asset
 * @returns {Promise<Object|null>} Cached market data or null
 */
export async function loadPreloadCache() {
    // 1. Try localStorage first (most recent)
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed._version === CACHE_VERSION && parsed._timestamp) {
                const ageMs = Date.now() - parsed._timestamp;
                // Accept cache up to 24 hours old
                if (ageMs < 24 * 60 * 60 * 1000) {
                    console.log('[PreloadCache] Loaded from localStorage, age:', Math.round(ageMs / 1000), 's');
                    return parsed.data;
                }
            }
        }
    } catch (e) {
        console.warn('[PreloadCache] localStorage read failed:', e);
    }

    // 2. Fallback to static JSON asset (guaranteed to exist, shipped with build)
    try {
        const res = await fetch('/assets/market-preload.json', { cache: 'no-store' });
        if (res.ok) {
            const json = await res.json();
            console.log('[PreloadCache] Loaded from static asset');
            return json;
        }
    } catch (e) {
        console.warn('[PreloadCache] Static asset fetch failed:', e);
    }

    return null;
}

/**
 * Save fetched market data to localStorage for next preload
 * @param {Object} data - The full data object to cache
 */
export function savePreloadCache(data) {
    try {
        const payload = {
            _version: CACHE_VERSION,
            _timestamp: Date.now(),
            data
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        console.log('[PreloadCache] Saved to localStorage');
    } catch (e) {
        console.warn('[PreloadCache] localStorage write failed:', e);
    }
}

/**
 * Clear the preload cache (useful for force-refresh)
 */
export function clearPreloadCache() {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch (e) {
        console.warn('[PreloadCache] localStorage clear failed:', e);
    }
}
