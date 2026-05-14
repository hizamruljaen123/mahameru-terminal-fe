/**
 * In-Memory API Response Cache with TTL
 * Purpose: Reduce duplicate network requests for reference data
 * Pattern: Simple Map-based cache with timestamp expiration
 */

const cache = new Map();

/**
 * Get cached data if still valid
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if expired/missing
 */
export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.ts > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Set cache with TTL (default 5 minutes)
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds (default 5min)
 */
export function setCache(key, data, ttl = 5 * 60 * 1000) {
  cache.set(key, { data, ts: Date.now(), ttl });
}

/**
 * Invalidate specific cache entry
 * @param {string} key - Cache key to remove
 */
export function invalidateCache(key) {
  cache.delete(key);
}

/**
 * Clear entire cache (use sparingly)
 */
export function clearCache() {
  cache.clear();
}

/**
 * Get cache statistics (for debugging)
 * @returns {Object} { size, keys }
 */
export function cacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
};

/**
 * Create a cached fetch wrapper
 * Usage: const data = await cachedFetch('countries', url, { ttl: 300000 });
 */
export async function cachedFetch(key, url, options = {}, ttl = 5 * 60 * 1000) {
  // Return cached if available and fresh
  const cached = getCached(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();

  // Store in cache
  setCache(key, data, ttl);
  return data;
}
