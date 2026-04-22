import { createEffect, onMount, onCleanup } from 'solid-js';
import { cleanVesselForApi } from '../utils/helpers';

/**
 * Intelligence data fetching hook
 */
export function useIntelligence(state) {
    const activeIntervals = { market: null, disaster: null };

    const fetchMarketIntelligence = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_COMMODITY_API}/api/commodities/highlights`);
            const json = await res.json();
            if (json.status === 'success') {
                const brent = json.data.find(d => d.symbol === 'BZ=F');
                let localFxValue = 1.0921;
                if (state.activeShip()?.country === 'Indonesia') localFxValue = 15680;

                state.setMarketData({
                    oil: brent?.price || 82.45,
                    oilChg: brent?.regularMarketChangePercent || 1.2,
                    usd: 104.12,
                    usdChg: -0.05,
                    fx: localFxValue,
                    fxChg: 0.1
                });
            }
        } catch (e) {
            console.warn("[SYSTEM] Commodity Service Unreachable. Using cached tactical defaults.");
            state.setMarketData(prev => ({
                ...prev,
                oil: prev.oil || 82.45,
                usd: 104.12,
                fx: state.activeShip()?.country === 'Indonesia' ? 15680 : 1.0921
            }));
        }
    };

    const fetchAtmosphericData = async (lat, lon) => {
        if (!lat || !lon) return;
        state.setWeatherLoading(true);
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            const data = await res.json();
            state.setWeatherData(data.current_weather);
        } catch (e) {
            console.error("METEO_FETCH_ERROR:", e);
        } finally {
            state.setWeatherLoading(false);
        }
    };

    const fetchTheaterPorts = async (theater) => {
        let url = `${import.meta.env.VITE_PORT_API}/api/infra/ports/search?limit=2000`;
        if (theater?.bbox && state.activeTheater() !== 'GLOBAL') {
            const [[minLat, minLng], [maxLat, maxLng]] = theater.bbox;
            url += `&min_lat=${minLat}&max_lat=${maxLat}&min_lng=${minLng}&max_lng=${maxLng}`;
        }
        try {
            const res = await fetch(url);
            const data = await res.json();
            state.setPorts(data);
        } catch (e) {
            console.error("Tactical Port Fetch Failure:", e);
        }
    };

    const fetchIntelligenceDossier = async () => {
        state.setIntelLoading(true);
        try {
            const r = await fetch(`${import.meta.env.VITE_VESSEL_INTEL_API}/api/intelligence/dossier`);
            const j = await r.json();
            if (j.status === 'success') state.setIntelDossier(j);
        } catch (e) {
            console.error("Intel Dossier Fetch Error:", e);
        }
        state.setIntelLoading(false);
    };

    const fetchDisasterAlerts = async () => {
        try {
            const [gdacsRes, usgsRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_DISASTER_API}/api/disaster/gdacs?eventlist=TC;TS;VO&limit=10`),
                fetch(`${import.meta.env.VITE_DISASTER_API}/api/disaster/usgs?limit=10`)
            ]);
            
            const gdacsJson = await gdacsRes.json();
            const usgsJson = await usgsRes.json();

            let alerts = [];

            if (gdacsJson.status === 'success' && gdacsJson.data?.features) {
                alerts = gdacsJson.data.features.map(f => ({
                    type: f.properties.eventtype,
                    name: f.properties.eventname || f.properties.name,
                    level: f.properties.alertlevel,
                    description: f.properties.description,
                    lat: f.geometry.coordinates[1],
                    lon: f.geometry.coordinates[0],
                    source: 'GDACS'
                }));
            }

            if (usgsJson.status === 'success' && usgsJson.data?.features) {
                const usgsAlerts = usgsJson.data.features.map(f => ({
                    type: 'EQ',
                    name: f.properties.place,
                    level: f.properties.mag >= 6 ? 'RED' : (f.properties.mag >= 4.5 ? 'ORANGE' : 'GREEN'),
                    description: `Magnitude ${f.properties.mag} Earthquake recorded in ${f.properties.place}`,
                    lat: f.geometry.coordinates[1],
                    lon: f.geometry.coordinates[0],
                    source: 'USGS'
                }));
                alerts = [...alerts, ...usgsAlerts];
            }

            state.setDisasterAlerts(alerts);
        } catch (e) {
            console.warn("Disaster service offline. Hazard radar restricted.");
        }
    };

    const triggerTacticalRecon = (ship) => {
        // Tactical reconnaissance logic involving correlation service removed.
        // Ready for new correlation engine implementation.
        state.setLoadingIntel(false);
    };

    const setupShipIntelligenceEffect = () => {
        createEffect(() => {
            const ship = state.activeShip();
            if (ship) {
                fetchAtmosphericData(ship.lat || ship.latitude, ship.lon || ship.longitude);
                triggerTacticalRecon(ship);
            } else if (state.selectedRefinery()) {
                fetchAtmosphericData(state.selectedRefinery().latitude, state.selectedRefinery().longitude);
                state.setTacticalIntel(null);
                state.setStormData(null);
            } else {
                state.setTacticalIntel(null);
                state.setStormData(null);
            }
        });
    };

    const startPeriodicFetches = () => {
        activeIntervals.market = setInterval(fetchMarketIntelligence, 60000);
        activeIntervals.disaster = setInterval(fetchDisasterAlerts, 300000);
        fetchMarketIntelligence();
        fetchDisasterAlerts();
    };

    const cleanup = () => {
        if (activeIntervals.market) clearInterval(activeIntervals.market);
        if (activeIntervals.disaster) clearInterval(activeIntervals.disaster);
    };

    onMount(() => {
        setupShipIntelligenceEffect();
        startPeriodicFetches();
    });

    onCleanup(() => cleanup());

    return {
        fetchIntelligenceDossier,
        fetchDisasterAlerts,
        fetchMarketIntelligence,
        fetchTheaterPorts
    };
}