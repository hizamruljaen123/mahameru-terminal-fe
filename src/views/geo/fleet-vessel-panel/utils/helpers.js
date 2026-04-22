import { TYPE_COLORS } from '../constants/colors';

/**
 * Get vessel color based on type
 */
export const getVesselColor = (type) => {
    if (!type) return TYPE_COLORS.Other;
    const match = Object.keys(TYPE_COLORS).find(k => type.includes(k));
    return match ? TYPE_COLORS[match] : TYPE_COLORS.Other;
};

/**
 * Generate NASA satellite snapshot URL
 */
export const getNasaSnapshotUrl = (lat, lon) => {
    if (lat == null || lon == null) return null;

    const offset = 0.45;
    const bbox = [
        (lat - offset).toFixed(9),
        (lon - offset).toFixed(9),
        (lat + offset).toFixed(9),
        (lon + offset).toFixed(9)
    ].join(',');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const dateStr = yesterday.toISOString().split('T')[0];

    return `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&LAYERS=VIIRS_SNPP_CorrectedReflectance_TrueColor,VIIRS_SNPP_Thermal_Anomalies_375m_All,Coastlines_15m&CRS=EPSG:4326&BBOX=${bbox}&FORMAT=image/jpeg&WIDTH=1200&HEIGHT=1200&TIME=${dateStr}`;
};

/**
 * Calculate route label with distance and ETA
 */
export const getRouteLabel = (distKm, speedKts) => {
    if (!distKm) return "";
    const speedKmH = (speedKts || 0) * 1.852;
    let label = `${Math.round(distKm)}KM`;
    if (speedKmH > 2) {
        const hours = distKm / speedKmH;
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        label += ` (${h}h ${m}m)`;
    }
    return label;
};

/**
 * Clean vessel data for API compliance
 */
export const cleanVesselForApi = (ship) => ({
    mmsi: String(ship.mmsi),
    lat: Number(ship.lat || ship.latitude || 0),
    lon: Number(ship.lon || ship.longitude || 0),
    name: ship.name || 'Unknown',
    type: ship.type || 'Tanker',
    speed: Number(ship.speed || 0)
});

/**
 * Calculate distance between two points in km using Haversine formula
 */
export const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};