/**
 * SolarEngine.js
 * Advanced Geospatial Solar Calculation Engine
 * FIXED VERSION
 */

export const SolarEngine = {
    DEG2RAD: Math.PI / 180,
    RAD2DEG: 180 / Math.PI,

    /**
     * Calculates the subsolar point (lat, lon) for a given Date
     * @param {Date} date - Should be UTC date (use new Date() directly, JS dates are UTC internally)
     */
    getSubsolarPoint(date) {
        // ✅ FIX: Gunakan UTC methods langsung, jangan konversi timezone
        const julianDay = this.getJulianDay(date);
        const julianCentury = (julianDay - 2451545.0) / 36525.0;

        // Geometric Mean Long Sun (deg)
        let L0 = 280.46646 + julianCentury * (36000.76983 + julianCentury * 0.0003032);
        L0 = ((L0 % 360) + 360) % 360; // ✅ FIX: Proper modulo for negative numbers

        // Geometric Mean Anomaly Sun (deg)
        const M = 357.52911 + julianCentury * (35999.05029 - 0.0001537 * julianCentury);
        const M_rad = M * this.DEG2RAD;

        // Eccentricity of Earth Orbit
        const e = 0.016708634 - julianCentury * (0.000042037 + 0.0000001267 * julianCentury);

        // Sun Equation of Center
        const C = (1.914602 - julianCentury * (0.004817 + 0.000014 * julianCentury)) * Math.sin(M_rad) +
            (0.019993 - 0.000101 * julianCentury) * Math.sin(2 * M_rad) +
            0.000289 * Math.sin(3 * M_rad);

        // Sun True Longitude (deg)
        const trueLong = L0 + C;

        // Sun Apparent Longitude (deg)
        const omega = 125.04 - 1934.136 * julianCentury;
        const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * this.DEG2RAD);

        // Mean Obliquity of Ecliptic (deg)
        const epsilon0 = 23 + (26 + (21.448 - julianCentury * (46.815 + julianCentury * (0.00059 - julianCentury * 0.001813))) / 60) / 60;
        const epsilon = epsilon0 + 0.00256 * Math.cos(omega * this.DEG2RAD);
        const epsilon_rad = epsilon * this.DEG2RAD;

        // Sun Declination (the latitude of the subsolar point)
        const lambda_rad = lambda * this.DEG2RAD;
        const delta = Math.asin(Math.sin(epsilon_rad) * Math.sin(lambda_rad)) * this.RAD2DEG;

        // Equation of Time (minutes) - ✅ Simplified and more accurate formula
        const y = Math.tan(epsilon_rad / 2) ** 2;
        const L0_rad = L0 * this.DEG2RAD;
        const eqTime = 4 * this.RAD2DEG * (
            y * Math.sin(2 * L0_rad)
            - 2 * e * Math.sin(M_rad)
            + 4 * e * y * Math.sin(M_rad) * Math.cos(2 * L0_rad)
            - 0.5 * y * y * Math.sin(4 * L0_rad)
            - 1.25 * e * e * Math.sin(2 * M_rad)
        );

        // ✅ FIX: Proper longitude calculation
        // At 12:00 UTC, subsolar longitude ≈ 0° (with eqTime correction)
        // Earth rotates 360° in 24h = 15°/hour
        const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
        let lon = (12 - utcHours) * 15 - eqTime / 4;

        // Normalize to [-180, 180]
        lon = ((lon + 180) % 360 + 360) % 360 - 180;

        return {
            lat: delta,
            lon: lon
        };
    },

    /**
     * Calculates the sublunar point (lat, lon) for a given Date
     * ✅ FIXED: Proper GST calculation
     */
    getSublunarPoint(date) {
        // Days since J2000.0 (Jan 1.5, 2000 TT ≈ Jan 1.5, 2000 UTC)
        const d = (date.getTime() / 86400000.0) - 10957.5;

        // Moon's mean elements (degrees)
        let L = ((218.316 + 13.176396 * d) % 360 + 360) % 360; // Mean longitude
        let M_moon = ((134.963 + 13.064993 * d) % 360 + 360) % 360; // Mean anomaly
        let F = ((93.272 + 13.229350 * d) % 360 + 360) % 360; // Mean distance from node

        const M_rad = M_moon * this.DEG2RAD;
        const F_rad = F * this.DEG2RAD;

        // ✅ IMPROVED: More accurate lunar position with additional terms
        // Longitude (ecliptic)
        let lonEcl = L
            + 6.289 * Math.sin(M_rad)
            - 1.274 * Math.sin(2 * M_rad - F_rad)  // Evection
            + 0.658 * Math.sin(2 * F_rad)            // Variation
            + 0.214 * Math.sin(2 * M_rad)            // Annual inequality
            - 0.186 * Math.sin(M_rad - 2 * F_rad);   // Parallactic inequality

        // Latitude (ecliptic)
        let latEcl = 5.128 * Math.sin(F_rad)
            + 0.281 * Math.sin(M_rad + F_rad)
            - 0.173 * Math.sin(M_rad - F_rad);

        // Obliquity of the ecliptic (more accurate)
        const T = d / 36525.0;
        const ecl = (23.439291 - 0.0130042 * T) * this.DEG2RAD;

        const lonEcl_rad = lonEcl * this.DEG2RAD;
        const latEcl_rad = latEcl * this.DEG2RAD;

        // Convert to equatorial (Declination/RA)
        const sinDec = Math.sin(latEcl_rad) * Math.cos(ecl) +
            Math.cos(latEcl_rad) * Math.sin(ecl) * Math.sin(lonEcl_rad);
        const dec = Math.asin(sinDec) * this.RAD2DEG;

        const ra = Math.atan2(
            Math.sin(lonEcl_rad) * Math.cos(ecl) - Math.tan(latEcl_rad) * Math.sin(ecl),
            Math.cos(lonEcl_rad)
        ) * this.RAD2DEG;

        // ✅ FIX: Proper Greenwich Sidereal Time calculation
        // GST in degrees at the given instant
        const theta0 = 280.46061837 + 360.98564736629 * d;
        const gst = ((theta0 % 360) + 360) % 360;

        // Longitude = GST - RA (with wrap)
        let lon = ((gst - ra + 180) % 360 + 360) % 360 - 180;

        return {
            lat: dec,
            lon: lon
        };
    },

    /**
     * Calculates solar altitude for a given lat/lon and date
     */
    getSolarAltitude(lat, lon, date) {
        const subsolar = this.getSubsolarPoint(date);
        const phi = lat * this.DEG2RAD;
        const delta = subsolar.lat * this.DEG2RAD;

        // Hour angle (difference in longitude)
        let H = (lon - subsolar.lon) * this.DEG2RAD;

        const sinAlt = Math.sin(phi) * Math.sin(delta) +
            Math.cos(phi) * Math.cos(delta) * Math.cos(H);

        return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * this.RAD2DEG;
    },

    /**
     * Categorizes the day phase based on solar altitude
     */
    getDayPhase(lat, lon, date) {
        const alt = this.getSolarAltitude(lat, lon, date);
        const subsolar = this.getSubsolarPoint(date);

        // Afternoon = Sun is WEST of observer (subsolar.lon < lon)
        const lonDiff = ((lon - subsolar.lon + 540) % 360) - 180;
        const isAfternoon = lonDiff > 0;

        if (alt < -18) return { id: 'MALAM', color: '#312e81', icon: '🌑' };
        if (alt < -12) return { id: 'MALAM', color: '#4338ca', icon: '🌙' };
        if (alt < -6) return { id: 'MALAM', color: '#6366f1', icon: '🌙' };
        if (alt < 0) return { id: 'SENJA', color: '#f59e0b', icon: '🌇' };
        if (alt < 6) return { id: 'Fajar', color: '#fb923c', icon: '🌅' };
        if (alt < 20) {
            return isAfternoon
                ? { id: 'SORE', color: '#fb923c', icon: '🌤️' }
                : { id: 'PAGI', color: '#38bdf8', icon: '🌅' };
        }
        if (alt < 70) return { id: 'SIANG', color: '#facc15', icon: '☀️' };
        return { id: 'SIANG', color: '#fef08a', icon: '🔆' }; // High noon
    },

    /**
     * ✅ FIXED: Calculates precise time for solar events (returns actual times)
     */
    getSolarEvents(lat, lon, date) {
        const subsolar = this.getSubsolarPoint(date);
        const phi = lat * this.DEG2RAD;
        const delta = subsolar.lat * this.DEG2RAD;

        // Solar Hour Angle for Sunrise/Sunset (standard refraction: h = -0.833°)
        const h0 = -0.833 * this.DEG2RAD;
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);
        const cosDelta = Math.cos(delta);
        const sinDelta = Math.sin(delta);

        let cosH = (Math.sin(h0) - sinPhi * sinDelta) / (cosPhi * cosDelta);

        // Handle polar regions (24h day or 24h night)
        const isPolarDay = cosH < -1;
        const isPolarNight = cosH > 1;

        cosH = Math.max(-1, Math.min(1, cosH));
        const Hs_rad = Math.acos(cosH); // Hour angle in radians
        const Hs_deg = Hs_rad * this.RAD2DEG;

        // Current hour angle (how far observer is from meridian in degrees)
        const currentH_deg = ((lon - subsolar.lon + 540) % 360) - 180;

        // ✅ FIX: Convert to actual LOCAL times
        // Time to solar noon (when currentH = 0)
        const hoursToNoon = -currentH_deg / 15;

        // Time to sunrise/sunset
        const hoursToSunrise = (-Hs_deg - currentH_deg) / 15;
        const hoursToSunset = (Hs_deg - currentH_deg) / 15;

        // ✅ FIX: Create actual Date objects for each event
        const msPerHour = 3600000;
        const nowMs = date.getTime();

        const formatEvent = (hoursOffset, label, id) => {
            let eventDate = new Date(nowMs + hoursOffset * msPerHour);

            // Handle wrap-around to next/previous day
            let remainingMs = hoursOffset * msPerHour;
            if (remainingMs < 0) remainingMs += 86400000;

            const totalMin = Math.round((remainingMs % 86400000) / 60000);

            return {
                id,
                label,
                h: eventDate.getHours(),
                m: eventDate.getMinutes(),
                totalMin: totalMin,
                isPolar: false,
                date: eventDate
            };
        };

        let events = [];

        if (isPolarDay) {
            events = [
                { id: 'POLAR', label: 'Midnight Sun', h: 0, m: 0, totalMin: 0, isPolar: true },
                { id: 'SIANG', label: 'Solar Noon', ...formatEvent(hoursToNoon, 'Solar Noon', 'SIANG') },
                { id: 'POLAR', label: 'Midnight Sun', h: 0, m: 0, totalMin: 0, isPolar: true }
            ];
        } else if (isPolarNight) {
            events = [
                { id: 'POLAR', label: 'Polar Night', h: 0, m: 0, totalMin: 0, isPolar: true },
                { id: 'POLAR', label: 'Polar Night', h: 0, m: 0, totalMin: 0, isPolar: true },
                { id: 'POLAR', label: 'Polar Night', h: 0, m: 0, totalMin: 0, isPolar: true }
            ];
        } else {
            events = [
                formatEvent(hoursToSunrise, 'Sunrise', 'PAGI'),
                formatEvent(hoursToNoon, 'Solar Noon', 'SIANG'),
                formatEvent(hoursToSunset, 'Sunset', 'SORE')
            ];
        }

        return {
            distanceToSun: this.calculateDistance(lat, lon, subsolar.lat, subsolar.lon),
            solarDeclination: subsolar.lat,
            events
        };
    },

    getTemporalStatus(countryCode, localTimeStr) {
        // ... (unchanged, this part is fine)
        if (!localTimeStr) return null;
        const [h, m] = localTimeStr.split(':').map(Number);
        const totalMinutes = h * 60 + m;

        const isWorking = h >= 8 && h < 17;

        let market = null;
        const hubs = {
            'US': { name: 'NYSE', open: 9 * 60 + 30, close: 16 * 60 },
            'GB': { name: 'LSE', open: 8 * 60, close: 16 * 60 + 30 },
            'ID': { name: 'IDX', open: 9 * 60, close: 15 * 60 + 50 },
            'JP': { name: 'TSE', open: 9 * 60, close: 15 * 60 },
            'HK': { name: 'HKEX', open: 9 * 60 + 30, close: 16 * 60 },
            'CN': { name: 'SSE', open: 9 * 60 + 30, close: 15 * 60 },
            'DE': { name: 'XETRA', open: 9 * 60, close: 17 * 60 + 30 },
            'FR': { name: 'EURONEXT', open: 9 * 60, close: 17 * 60 + 30 },
            'IN': { name: 'NSE', open: 9 * 60 + 15, close: 15 * 60 + 30 },
            'AU': { name: 'ASX', open: 10 * 60, close: 16 * 60 },
            'BR': { name: 'B3', open: 10 * 60, close: 17 * 60 },
            'KR': { name: 'KRX', open: 9 * 60, close: 15 * 60 + 30 },
            'CA': { name: 'TSX', open: 9 * 60 + 30, close: 16 * 60 },
            'SG': { name: 'SGX', open: 9 * 60, close: 17 * 60 },
            'RU': { name: 'MOEX', open: 10 * 60, close: 18 * 60 + 45 },
            'SA': { name: 'TADAWUL', open: 10 * 60, close: 15 * 60 },
            'ZA': { name: 'JSE', open: 9 * 60, close: 17 * 60 },
            'MX': { name: 'BMV', open: 8 * 60 + 30, close: 15 * 60 },
            'TR': { name: 'BIST', open: 10 * 60, close: 18 * 60 }
        };

        if (hubs[countryCode]) {
            const hub = hubs[countryCode];
            const isOpen = totalMinutes >= hub.open && totalMinutes < hub.close;
            let timeDiff = 0;
            if (isOpen) {
                timeDiff = hub.close - totalMinutes;
            } else {
                timeDiff = totalMinutes < hub.open ? hub.open - totalMinutes : (1440 - totalMinutes + hub.open);
            }

            const diffH = Math.floor(timeDiff / 60);
            const diffM = timeDiff % 60;

            market = {
                name: hub.name,
                isOpen,
                label: isOpen ? `CLOSING IN ${diffH}h ${diffM}m` : `OPENING IN ${diffH}h ${diffM}m`,
                color: isOpen ? '#6ee7b7' : '#f87171'
            };
        }

        return {
            isWorking,
            status: isWorking ? 'WORKING' : 'RESTING',
            color: isWorking ? '#38bdf8' : '#94a3b8',
            market
        };
    },

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * this.DEG2RAD;
        const dLon = (lat2 - lon1) * this.DEG2RAD; // ❌ BUG: Should be lon2 - lon1
        // ... wait this is a bug in original too
        const dLonFixed = (lon2 - lon1) * this.DEG2RAD; // ✅ FIX
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * this.DEG2RAD) * Math.cos(lat2 * this.DEG2RAD) *
            Math.sin(dLonFixed / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    getJulianDay(date) {
        return (date.getTime() / 86400000.0) + 2440587.5;
    },

    /**
     * ✅ IMPROVED: Better terminator polygon generation
     */
    getTerminatorPolygon(date, altOffset = 0) {
        const subsolar = this.getSubsolarPoint(date);
        const latS_rad = subsolar.lat * this.DEG2RAD;
        const lonS_rad = subsolar.lon * this.DEG2RAD;
        const h = altOffset * this.DEG2RAD;
        const sinH = Math.sin(h);
        const path = [];

        // Generate points along the terminator
        for (let lonDeg = -180; lonDeg <= 180; lonDeg += 2) {
            const lon_rad = lonDeg * this.DEG2RAD;

            // Solve: sin(h) = sin(lat)sin(latS) + cos(lat)cos(latS)cos(lon-lonS)
            const A = Math.sin(latS_rad);
            const B = Math.cos(latS_rad) * Math.cos(lon_rad - lonS_rad);
            const R = Math.sqrt(A * A + B * B);

            let lat;
            if (sinH * sinH <= R * R + 0.0001) {
                // Two solutions exist, pick the correct one
                const theta = Math.atan2(B, A);
                const alpha = Math.asin(Math.max(-1, Math.min(1, sinH / R)));

                let lat1 = (alpha - theta) * this.RAD2DEG;
                let lat2 = (Math.PI - alpha - theta) * this.RAD2DEG;

                // Normalize to [-90, 90]
                lat1 = Math.max(-90, Math.min(90, lat1));
                lat2 = Math.max(-90, Math.min(90, lat2));

                // Pick the latitude that makes sense for this terminator
                // The terminator should be continuous
                if (path.length > 0) {
                    const prevLat = path[path.length - 1][0];
                    const diff1 = Math.abs(lat1 - prevLat);
                    const diff2 = Math.abs(lat2 - prevLat);
                    lat = diff1 < diff2 ? lat1 : lat2;
                } else {
                    lat = lat1;
                }
            } else {
                // No intersection - fully day or night at this longitude
                lat = A > 0 ? 90 : -90;
            }

            path.push([lat, lonDeg]);
        }

        // ✅ FIX: Better polygon closure
        const isNorthPoleDark = subsolar.lat < 0;

        if (isNorthPoleDark) {
            // North pole is in darkness - close via north pole
            path.push([90, 180]);
            path.push([90, -180]);
        } else {
            // South pole is in darkness - close via south pole
            path.push([-90, 180]);
            path.push([-90, -180]);
        }

        return path;
    }
};