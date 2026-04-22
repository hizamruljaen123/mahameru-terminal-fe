/**
 * Theater configuration for tactical map views
 */
export const THEATERS = {
    'GLOBAL': {
        name: 'GLOBAL_VIEW',
        center: [30, 20],
        zoom: 1.5,
        bbox: [[-90, -180], [90, 180]]
    },
    'SEA': {
        name: 'SOUTHEAST_ASIA',
        center: [115, 5],
        zoom: 4.5,
        bbox: [[-10, 95], [20, 140]]
    },
    'EUROPE': {
        name: 'EUROPE',
        center: [5, 52],
        zoom: 4,
        bbox: [[35, -15], [65, 30]]
    },
    'HO_AFRICA': {
        name: 'HORN_OF_AFRICA',
        center: [52, 12],
        zoom: 4.5,
        bbox: [[0, 40], [25, 65]]
    },
    'PANAMA': {
        name: 'PANAMA',
        center: [-79.5, 9],
        zoom: 8.5,
        bbox: [[8, -81], [10, -78]]
    }
};

export const DEFAULT_THEATER = 'GLOBAL';
export const BATCH_ANALYSIS_QUORUM = { SEA: 25, DEFAULT: 50 };
export const MAX_BATCH_SIZE = 1500;
export const MAX_DISPLAY_VESSELS = 200;