/**
 * API Fetch with Retry, Exponential Backoff, and 429 Handling
 * Purpose: Resilient network requests with automatic retry on rate limits and transient failures
 *
 * Features:
 * - Exponential backoff (2^attempt seconds)
 * - Respects Retry-After header on 429 responses
 * - AbortController support
 * - Optional caching via apiCache
 */

import { getCached, setCache } from './apiCache';

/**
 * Fetch with retry logic and exponential backoff
 * @param {string} url - Full URL to fetch
 * @param {Object} options - Fetch options (method, headers, body, signal, etc.)
 * @param {Object} config - Retry configuration
 * @param {number} config.retries - Max retry attempts (default: 3)
 * @param {number} config.backoffBase - Base backoff in ms (default: 1000)
 * @param {boolean} config.useCache - Enable response caching (default: false)
 * @param {number} config.cacheTTL - Cache TTL in ms if useCache=true (default: 5min)
 * @param {string} config.cacheKey - Custom cache key (default: url)
 * @returns {Promise<any>} JSON response data
 */
export async function fetchWithRetry(
  url,
  options = {},
  {
    retries = 3,
    backoffBase = 1000,
    useCache = false,
    cacheTTL = 5 * 60 * 1000,
    cacheKey = null
  } = {}
) {
  // Check cache first if enabled
  if (useCache) {
    const key = cacheKey || url;
    const cached = getCached(key);
    if (cached !== null) {
      return cached;
    }
  }

  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, options);

      // Handle 429 Rate Limit — respect Retry-After header
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '1');
        const delayMs = retryAfter * 1000;
        console.warn(`[fetchWithRetry] Rate limited (429). Retrying after ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
        continue; // retry
      }

      // Handle other error statuses
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      // Cache successful response if enabled
      if (useCache) {
        const key = cacheKey || url;
        setCache(key, data, cacheTTL);
      }

      return data;
    } catch (err) {
      lastError = err;
      // Don't retry on abort or network errors that won't transiently resolve
      if (err.name === 'AbortError' || err.name === 'TypeError') {
        break;
      }
      // Wait with exponential backoff before next attempt
      if (attempt < retries - 1) {
        const delay = backoffBase * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Convenience wrapper for GET requests with caching
 */
export async function getCachedFetch(url, options = {}, ttl = 5 * 60 * 1000) {
  return fetchWithRetry(url, { ...options, method: 'GET' }, {
    useCache: true,
    cacheTTL: ttl,
    retries: 2,
    backoffBase: 500
  });
}

/**
 * Create an AbortController with auto-timeout
 * @param {number} ms - Timeout in milliseconds
 * @returns {Object} { controller, timeoutId }
 */
export function createControllerWithTimeout(ms = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return { controller, timeoutId };
}

/**
 * Clear timeout and abort controller helper
 */
export function cleanupController(controller, timeoutId) {
  if (timeoutId) clearTimeout(timeoutId);
  if (controller) controller.abort();
}
