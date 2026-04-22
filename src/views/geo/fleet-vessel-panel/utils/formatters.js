/**
 * Format time string from Date
 */
export const formatTime = (date) => {
    const d = date || new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
};

/**
 * Format coordinate for display
 */
export const formatCoord = (lat, lon, precision = 4) => {
    if (lat == null || lon == null) return 'N/A';
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(precision)}°${latDir} ${Math.abs(lon).toFixed(precision)}°${lonDir}`;
};

/**
 * Format distance for display
 */
export const formatDistance = (km) => {
    if (!km) return 'N/A';
    if (km < 1) return `${(km * 1000).toFixed(0)}m`;
    if (km > 1000) return `${(km / 1000).toFixed(1)}k km`;
    return `${km.toFixed(1)}km`;
};

/**
 * Format percentage change with sign
 */
export const formatChange = (value) => {
    if (!value) return '0.00';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
};