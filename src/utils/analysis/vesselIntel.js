

export const getRiskColor = (val) => {
  if (typeof val === 'number') {
    if (val >= 80) return '#ff3e3e';
    if (val >= 50) return '#ff9d00';
    return '#00f2ff';
  }
  const level = String(val).toUpperCase();
  if (level === 'CRITICAL') return '#ff3e3e';
  if (level === 'HIGH') return '#ff9d00';
  if (level === 'MEDIUM') return '#ffcc00';
  if (level === 'LOW') return '#00ff41';
  return '#00f2ff';
};

export const getVesselColor = (type) => {
  const t = (type || '').toLowerCase();
  if (t.includes('tanker')) return '#ff9d00';
  if (t.includes('cargo')) return '#00f2ff';
  if (t.includes('military')) return '#ff0055';
  if (t.includes('fishing')) return '#00ff41';
  if (t.includes('passenger')) return '#a855f7';
  return '#6b7280';
};
