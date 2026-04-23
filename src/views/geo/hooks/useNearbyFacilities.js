import { createSignal, createEffect } from 'solid-js';

export function useNearbyFacilities(props) {
  const [nearbyFacilities, setNearbyFacilities] = createSignal([]);
  const [isLoadingNearby, setIsLoadingNearby] = createSignal(false);
  const [nearbyRadius, setNearbyRadius] = createSignal(100);

  const fetchNearby = async () => {
    const lat = props.selectedRefinery()?.latitude || props.selectedLng()?.latitude || props.selectedOffshore()?.latitude || props.selectedTerminal()?.latitude;
    const lon = props.selectedRefinery()?.longitude || props.selectedLng()?.longitude || props.selectedOffshore()?.longitude || props.selectedTerminal()?.longitude;

    if (!lat || !lon) return;

    setIsLoadingNearby(true);
    try {
      // Parallel fetch for infrastructure and live vessels
      const [infraRes, aisRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_OIL_REFINERY_API}/api/infrastructure/nearby?lat=${lat}&lon=${lon}&radius=${nearbyRadius()}`),
        fetch(`${import.meta.env.VITE_AIS_API}/api/proximity/vessels?lat=${lat}&lon=${lon}&radius=${nearbyRadius()}`)
      ]);

      const [infraResult, aisResult] = await Promise.all([
        infraRes.json(),
        aisRes.json()
      ]);

      let combined = [];
      if (infraResult.status === 'success') combined = [...infraResult.data];
      if (aisResult.status === 'success') combined = [...combined, ...aisResult.data];

      // Sort by distance
      combined.sort((a, b) => a.distance - b.distance);
      
      setNearbyFacilities(combined);
    } catch (e) {
      console.error("Nearby fetch failed", e);
    } finally {
      setIsLoadingNearby(false);
    }
  };

  createEffect(() => {
    // Explicitly track selection and show state
    const show = props.showDetail();
    const lat = props.selectedRefinery()?.latitude || props.selectedLng()?.latitude || props.selectedOffshore()?.latitude || props.selectedTerminal()?.latitude;
    const lon = props.selectedRefinery()?.longitude || props.selectedLng()?.longitude || props.selectedOffshore()?.longitude || props.selectedTerminal()?.longitude;
    const radius = nearbyRadius();

    if (show && lat && lon) {
      setNearbyFacilities([]);
      fetchNearby();
    }
  });

  return {
    nearbyFacilities,
    isLoadingNearby,
    nearbyRadius,
    setNearbyRadius,
    refreshNearby: fetchNearby
  };
}
