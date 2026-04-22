/**
 * Geospatial Utilities for Infrastructure Connectivity Analysis
 */

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 * @returns {number} distance in kilometers
 */
export const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Estimates travel time based on distance and mode
 * @param {number} distanceKM 
 * @param {'road' | 'air'} mode 
 * @returns {string} Human readable estimation
 */
export const estimateTravelTime = (distanceKM, mode = 'road') => {
  const avgSpeed = mode === 'road' ? 60 : 250; // KM/H
  const hours = distanceKM / avgSpeed;
  const mins = Math.round(hours * 60);

  if (mins < 60) return `${mins}m`;
  return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
};

/**
 * Generates GeoJSON for connection lines between an origin and multiple targets
 */
export const generateLogisticsLines = (origin, targets) => {
  const oLon = origin.longitude || origin.lon || origin.lng;
  const oLat = origin.latitude || origin.lat;

  return {
    type: 'FeatureCollection',
    features: targets.map(target => {
      const tLon = target.longitude || target.lon || target.lng || target.longitude;
      const tLat = target.latitude || target.lat;

      return {
        type: 'Feature',
        properties: {
          distance: target.distance,
          name: target.name,
          type: target.type
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [oLon, oLat],
            [tLon, tLat]
          ]
        }
      };
    })
  };
};

/**
 * Fetches real road route from OSRM
 */
export const fetchRoadRoute = async (origin, dest) => {
  const oLon = origin.longitude || origin.lon;
  const oLat = origin.latitude || origin.lat;
  const dLon = dest.longitude || dest.lon;
  const dLat = dest.latitude || dest.lat;

  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${oLon},${oLat};${dLon},${dLat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      return {
        geometry: data.routes[0].geometry,
        distance: data.routes[0].distance / 1000, // KM
        duration: data.routes[0].duration / 60, // Minutes
      };
    }
  } catch (e) {
    console.error("Routing error:", e);
  }
  return null;
};

/**
 * Finds the midpoint between two coordinates
 */
export const getMidpoint = (p1, p2) => {
  return [
    (p1[0] + p2[0]) / 2,
    (p1[1] + p2[1]) / 2
  ];
};

/**
 * Reverse geocoding using Nominatim (Address Lookup)
 */
export const reverseGeocode = async (lat, lon) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
      headers: { 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' }
    });
    return await res.json();
  } catch (e) {
    console.error("Nominatim reverse geocode failed:", e);
    return null;
  }
};
