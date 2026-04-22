import { createSignal } from 'solid-js';

export function useRailStationData() {
    const [stations, setStations] = createSignal([]);
    const [countries, setCountries] = createSignal([]);
    const [stats, setStats] = createSignal(null);
    const [isLoading, setIsLoading] = createSignal(false);
    const [selectedStation, setSelectedStation] = createSignal(null);
    const [multimodalAssets, setMultimodalAssets] = createSignal({ airports: [], ports: [], industrial_zones: [] });
    const [proximityAssets, setProximityAssets] = createSignal({ airports: [], ports: [], industrial_zones: [] });

    const API_BASE = `${import.meta.env.VITE_RAIL_STATION_API}/api/rail`;

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_BASE}/stats`);
            const data = await res.json();
            setStats(data);
        } catch (e) {
            console.error("FAIL_RAIL_STATS", e);
        }
    };

    const fetchCountries = async (query = '') => {
        try {
            const url = `${API_BASE}/countries?q=${encodeURIComponent(query)}`;
            const res = await fetch(url);
            const data = await res.json();
            setCountries(data);
        } catch (e) {
            console.error("FAIL_RAIL_COUNTRIES", e);
        }
    };

    const fetchStations = async (countryCode = '', query = '') => {
        setIsLoading(true);
        try {
            const url = `${API_BASE}/stations?country=${countryCode}&q=${encodeURIComponent(query)}`;
            const res = await fetch(url);
            const data = await res.json();
            setStations(data);
        } catch (e) {
            console.error("FAIL_RAIL_STATIONS", e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMultimodal = async (countryCode = '') => {
        try {
            const url = `${API_BASE}/multimodal?country=${countryCode}`;
            const res = await fetch(url);
            const data = await res.json();
            setMultimodalAssets(data);
        } catch (e) {
            console.error("FAIL_MULTIMODAL_FETCH", e);
        }
    };

    const fetchProximityAssets = async (lat, lon, radius = 100) => {
        try {
            const url = `${API_BASE}/proximity?lat=${lat}&lon=${lon}&radius=${radius}`;
            const res = await fetch(url);
            const data = await res.json();
            setProximityAssets(data);
            return data;
        } catch (e) {
            console.error("FAIL_PROXIMITY_FETCH", e);
            return null;
        }
    };

    return {
        stations,
        countries,
        stats,
        multimodalAssets,
        proximityAssets,
        isLoading,
        selectedStation, setSelectedStation,
        fetchStats,
        fetchCountries,
        fetchStations,
        fetchMultimodal,
        fetchProximityAssets
    };
}
