export const OFFSHORE_CATEGORIES = {
  PRODUCTION: { label: 'PRODUCTION / PROCESSING', color: '#ef4444', markers: ['PRODUCTION', 'PROCESS', 'CENTRAL PROCESSING', 'TREATMENT', 'PUMPING'] },
  DRILLING: { label: 'DRILLING / WELLHEAD', color: '#f97316', markers: ['DRILLING', 'WELLHEAD', 'SUBSEA WELLHEAD'] },
  FLOATING: { label: 'FLOATING PRODUCTION (FPSO)', color: '#3b82f6', markers: ['FPSO', 'FSO', 'FLOATING', 'FPS', 'TENSION LEG', 'SPAR', 'SEMI SUBMERSIBLE'] },
  SUPPORT: { label: 'SUPPORT / UTILITY', color: '#10b981', markers: ['ACCOMMODATION', 'HOUSING', 'QUARTERS', 'UTILITY', 'FLARE', 'INJECTION', 'WELL PROTECTOR', 'SATELLITE'] },
  SUBSEA: { label: 'SUBSEA SYSTEM', color: '#a855f7', markers: ['SUBSEA STEEL'] },
  STRUCTURE: { label: 'FIXED STRUCTURE', color: '#64748b', markers: ['FIXED STEEL', 'GRAVITY', 'CAISSON', 'TOWER', 'LATTICE', 'CLUSTER', 'MONOTUBULAR'] },
  GENERAL: { label: 'GENERAL PLATFORM', color: '#94a3b8', markers: ['OFFSHORE PLATFORM', 'PLATFORM', 'OTHERS'] }
};

export const mapOffshoreType = (typeName) => {
  if (!typeName) return OFFSHORE_CATEGORIES.GENERAL;
  const upperType = typeName.toUpperCase();
  
  for (const [key, cat] of Object.entries(OFFSHORE_CATEGORIES)) {
    if (cat.markers.some(m => upperType.includes(m))) {
      return { ...cat, key };
    }
  }
  
  return { ...OFFSHORE_CATEGORIES.GENERAL, key: 'GENERAL' };
};
