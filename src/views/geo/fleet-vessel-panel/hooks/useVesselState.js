import { createSignal, createMemo } from 'solid-js';
import { BATCH_ANALYSIS_QUORUM, MAX_DISPLAY_VESSELS } from '../constants/theaters';
import { HARBOR_TYPE_NAMES } from '../constants/colors';

/**
 * Central state management for vessel panel
 */
export function useVesselState() {
    // Core signals
    const [ships, setShips] = createSignal([]);
    const [status, setStatus] = createSignal('OFFLINE');
    const [activeTheater, setActiveTheater] = createSignal('GLOBAL');
    const [isOperational, setIsOperational] = createSignal(false);
    const [lastSignalTime, setLastSignalTime] = createSignal('--:--:--');
    const [vesselCount, setVesselCount] = createSignal(0);

    // UI state
    const [showRegistry, setShowRegistry] = createSignal(false);
    const [selectedMmsi, setSelectedMmsi] = createSignal(null);
    const [reconTab, setReconTab] = createSignal('GOOGLE');
    const [activeTab, setActiveTab] = createSignal('VESSELS');
    const [dossierTab, setDossierTab] = createSignal('SUMMARY');
    const [portReconTab, setPortReconTab] = createSignal('RADAR');

    // Filter state
    const [vesselFilter, setVesselFilter] = createSignal('ALL');
    const [portFilter, setPortFilter] = createSignal('ALL');

    // Search state
    const [vesselSearchTerm, setVesselSearchTerm] = createSignal("");
    const [vesselSearchResults, setVesselSearchResults] = createSignal([]);

    // Port state
    const [ports, setPorts] = createSignal([]);
    const [selectedPortId, setSelectedPortId] = createSignal(null);

    // Tactical intelligence state
    const [tacticalIntel, setTacticalIntel] = createSignal(null);
    const [stormData, setStormData] = createSignal(null);
    const [loadingIntel, setLoadingIntel] = createSignal(false);
    const [selectedRefinery, setSelectedRefinery] = createSignal(null);
    const [showAllFlows, setShowAllFlows] = createSignal(false);


    // External data state
    const [marketData, setMarketData] = createSignal({
        oil: 0, usd: 0, fx: 0, oilChg: 0, usdChg: 0, fxChg: 0
    });
    const [weatherData, setWeatherData] = createSignal(null);
    const [weatherLoading, setWeatherLoading] = createSignal(false);

    const [disasterAlerts, setDisasterAlerts] = createSignal([]);

    // Map & Perspective state
    const [mapMode, setMapMode] = createSignal('satellite'); // dark, terrain, satellite
    const [viewPerspective, setViewPerspective] = createSignal('top'); // top, tilt

    // Non-reactive registry
    const vesselRegistry = new Map();

    // Derived signals
    const activeShip = () => {
        const mmsi = selectedMmsi();
        if (!mmsi) return null;
        return vesselRegistry.get(mmsi) || null;
    };

    const activePort = () => selectedPortId()
        ? ports().find(p => p.id === selectedPortId())
        : null;

    const activeRefineryDetail = () => selectedRefinery();

    const groupedPorts = () => {
        const groups = {};
        ports().forEach(p => {
            const t = p.harbor_type || 'n/a';
            if (portFilter() !== 'ALL' && t !== portFilter()) return;
            if (!groups[t]) groups[t] = [];
            groups[t].push(p);
        });
        return groups;
    };

    const filteredShips = () => {
        let s = ships();
        if (vesselFilter() !== 'ALL') {
            const f = vesselFilter().toLowerCase();
            return s.filter(v => (v.type || '').toLowerCase() === f).slice(0, MAX_DISPLAY_VESSELS);
        }
        return s.slice(0, MAX_DISPLAY_VESSELS);
    };

    const portsForMap = () => {
        const all = ports();
        if (portFilter() === 'ALL') return all;
        return all.filter(p => p.harbor_type === portFilter());
    };


    return {
        // Signals
        ships, setShips,
        status, setStatus,
        activeTheater, setActiveTheater,
        isOperational, setIsOperational,
        lastSignalTime, setLastSignalTime,
        vesselCount, setVesselCount,
        showRegistry, setShowRegistry,
        selectedMmsi, setSelectedMmsi,
        reconTab, setReconTab,
        activeTab, setActiveTab,
        dossierTab, setDossierTab,
        portReconTab, setPortReconTab,
        vesselFilter, setVesselFilter,
        portFilter, setPortFilter,
        vesselSearchTerm, setVesselSearchTerm,
        vesselSearchResults, setVesselSearchResults,
        ports, setPorts,
        selectedPortId, setSelectedPortId,
        tacticalIntel, setTacticalIntel,
        stormData, setStormData,
        loadingIntel, setLoadingIntel,
        selectedRefinery, setSelectedRefinery,
        showAllFlows, setShowAllFlows,
        marketData, setMarketData,
        weatherData, setWeatherData,
        weatherLoading, setWeatherLoading,
        disasterAlerts, setDisasterAlerts,

        mapMode, setMapMode,
        viewPerspective, setViewPerspective,

        // Non-reactive
        vesselRegistry,

        // Derived
        activeShip,
        activePort,
        activeRefineryDetail,
        groupedPorts,
        filteredShips,
        portsForMap
    };
}