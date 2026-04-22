/**
 * Currency Conversion Library using fawazahmed0/exchange-api
 * Base URL: https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{base}.json
 */

const BASE_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1';

/**
 * Fetch exchange rates for a given base currency.
 * @param {string} base - The base currency code (e.g., 'usd', 'idr').
 * @returns {Promise<Object>} - Object containing rates.
 */
export async function fetchRates(base = 'usd') {
  const code = base.toLowerCase();
  try {
    const response = await fetch(`${BASE_URL}/currencies/${code}.json`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data[code]; // The API returns { date: "...", [code]: { ...rates } }
  } catch (error) {
    console.error(`Failed to fetch rates for ${base}:`, error);
    return null;
  }
}

/**
 * Get all available currency names and codes.
 * @returns {Promise<Object>}
 */
export async function getCurrencies() {
  try {
    const response = await fetch(`${BASE_URL}/currencies.json`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch currency list:', error);
    return {};
  }
}

/**
 * Utility to format currency values.
 */
export const currencyFormatter = (value, currency = 'USD', locale = 'id-ID') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  }).format(value);
};
