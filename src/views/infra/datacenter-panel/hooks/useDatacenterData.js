import { createSignal } from 'solid-js';

export function useDatacenterData() {
    const [datacenters, setDatacenters] = createSignal([]);
    const [countryNodes, setCountryNodes] = createSignal([]);
    const [stats, setStats] = createSignal(null);
    const [isLoading, setIsLoading] = createSignal(false);
    const [selectedDC, setSelectedDC] = createSignal(null);
    const [viewLevel, setViewLevel] = createSignal('global'); // global, country
    const [mapMode, setMapMode] = createSignal('dark'); // dark, light, satellite, terrain
    const [viewPerspective, setViewPerspective] = createSignal('top'); // top, tilt

    const [hubDatacenters, setHubDatacenters] = createSignal([]);
    const [hubCountryNodes, setHubCountryNodes] = createSignal([]);
    const [hubStats, setHubStats] = createSignal(null);
    const [hubMode, setHubMode] = createSignal('geospatial'); // geospatial, non-geospatial
    const [hubPagination, setHubPagination] = createSignal({ page: 1, total_pages: 1, total: 0 });
    const [nearbyPowerPlants, setNearbyPowerPlants] = createSignal([]);
    const [newsFeed, setNewsFeed] = createSignal([]);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_DATACENTER_API}/api/infra/datacenters/stats`);
            const data = await res.json();
            setStats(data);
            
            // Also fetch hub stats
            const hubRes = await fetch(`${import.meta.env.VITE_DATACENTER_API}/api/infra/datacenters/hub/stats`);
            const hubData = await hubRes.json();
            setHubStats(hubData);
        } catch (e) {
            console.error("Failed to fetch DC stats", e);
        }
    };

    const fetchNearbyPowerPlants = async (lat, lon) => {
        const pLat = parseFloat(lat);
        const pLon = parseFloat(lon);
        
        if (isNaN(pLat) || isNaN(pLon)) {
            console.warn("INVALID_COORDINATES_DETECTED // ABORTING_PROXIMITY_SEARCH");
            setNearbyPowerPlants([]);
            return;
        }

        try {
            console.log(`POLLING_ENERGY_GRID: RAD_100KM FROM [${pLat}, ${pLon}]`);
            const res = await fetch(`${import.meta.env.VITE_POWER_PLANT_API}/api/power-plants/proximity?lat=${pLat}&lon=${pLon}&radius=100`);
            const body = await res.json();
            
            if (body.status === 'success' || body.data) {
                const results = body.data || [];
                console.log(`ENERGY_INFRA_DETECTED: ${results.length} UNITS_IN_RADIUS`);
                setNearbyPowerPlants(results);
            } else {
                setNearbyPowerPlants([]);
            }
        } catch (e) {
            console.error("ENERGY_GRID_COMM_FAILURE", e);
            setNearbyPowerPlants([]);
        }
    };

    const fetchNewsFeed = async (company, country) => {
        try {
            const query = `Data center ${company || ''} ${country || ''}`.trim();
            console.log(`POLLING_DUAL_LANG_STREAM: "${query}"`);

            // EXECUTE DUAL-STREAM OSINT SEARCH
            const [resEn, resId] = await Promise.all([
                fetch(`${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(query)}&lang=en`),
                fetch(`${import.meta.env.VITE_GNEWS_API}/api/gnews/search?q=${encodeURIComponent(query)}&lang=id&country=ID`)
            ]);

            const [dataEn, dataId] = await Promise.all([resEn.json(), resId.json()]);

            const combined = [...(dataEn.news || []), ...(dataId.news || [])];
            
            // REMOVE DUPLICATES BY TITLE (Case-Insensitive)
            const unique = combined.reduce((acc, current) => {
                const x = acc.find(item => item.title.toLowerCase() === current.title.toLowerCase());
                if (!x) return acc.concat([current]);
                return acc;
            }, []);

            // SORT BY CHRONOLOGY
            unique.sort((a, b) => b.time - a.time);

            setNewsFeed(unique);
        } catch (e) {
            console.error("OSINT_DUAL_STREAM_FAILURE", e);
            setNewsFeed([]);
        }
    };

    const fetchHubDatacenters = async (mode = 'geospatial', page = 1, country = '', search = '') => {
        setIsLoading(true);
        try {
            let url = `${import.meta.env.VITE_DATACENTER_API}/api/infra/datacenters/hub?mode=${mode}&page=${page}&page_size=100`;
            if (country) url += `&country=${encodeURIComponent(country)}`;
            if (search) url += `&q=${encodeURIComponent(search)}`;
            
            const res = await fetch(url);
            const body = await res.json();
            
            setHubDatacenters(body.data || []);
            setHubPagination(body.pagination || { page: 1, total_pages: 1, total: 0 });
            setHubMode(mode);
        } catch (e) {
            console.error("Failed to fetch Hub DCs", e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchHubCountryNodes = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_DATACENTER_API}/api/infra/datacenters/hub/country-nodes`);
            const data = await res.json();
            setHubCountryNodes(data);
        } catch (e) {
            console.error("Failed to fetch Hub country nodes", e);
        }
    };

    const fetchCountryNodes = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_DATACENTER_API}/api/infra/datacenters/country-nodes`);
            const data = await res.json();
            setCountryNodes(data);
            setViewLevel('global');
        } catch (e) {
            console.error("Failed to fetch country nodes", e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDatacenters = async (country = '') => {
        setIsLoading(true);
        try {
            let url = `${import.meta.env.VITE_DATACENTER_API}/api/infra/datacenters`;
            if (country) url += `?country=${country}`;
            const res = await fetch(url);
            const data = await res.json();
            setDatacenters(data);
            setViewLevel('country');
        } catch (e) {
            console.error("Failed to fetch DCs", e);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        datacenters, setDatacenters,
        countryNodes, setCountryNodes,
        stats, setStats,
        isLoading, setIsLoading,
        selectedDC, setSelectedDC,
        viewLevel, setViewLevel,
        mapMode, setMapMode,
        viewPerspective, setViewPerspective,
        hubDatacenters, setHubDatacenters,
        hubCountryNodes, setHubCountryNodes,
        hubStats, setHubStats,
        hubMode, setHubMode,
        hubPagination, setHubPagination,
        nearbyPowerPlants, setNearbyPowerPlants,
        newsFeed, setNewsFeed,
        fetchStats, fetchCountryNodes, fetchDatacenters, fetchHubDatacenters, fetchHubCountryNodes, fetchNearbyPowerPlants, fetchNewsFeed
    };
}
