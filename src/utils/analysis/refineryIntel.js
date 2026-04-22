

export const getUtilStatus = (queueCount) => {
  if (queueCount >= 5) return { label: 'CRITICAL_CONGESTION', color: 'text-red-500' };
  if (queueCount >= 2) return { label: 'HIGH_UTILIZATION', color: 'text-orange-500' };
  return { label: 'NORMAL_OPERATIONS', color: 'text-emerald-500' };
};

export const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};
