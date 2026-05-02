import { Show, Switch, Match } from 'solid-js';
import VesselRadarPanel from './geo/VesselRadarPanel';
import GeoIntelligenceUnifiedPanel from './geo/GeoIntelligenceUnifiedPanel';
import FleetVesselPanel from './geo/fleet-vessel-panel/FleetVesselPanel';
import OilFacilityPanel from './geo/OilFacilityPanel';
import WeatherPanel from './geo/WeatherPanel';
import GeoTrendPanel from './geo/GeoTrendPanel';
import MapsView from './MapsView';
import SatelliteMappingPanel from './geo/SatelliteMappingPanel';

export default function GeoIntelView(props) {
  const activeModule = () => props.module();

  return (
    <div class="flex-1 flex flex-col overflow-hidden bg-black">
      {/* NO_HEADER - Directly the content area */}
      <div class="flex-1 relative overflow-hidden">
        <Switch fallback={<div class="p-8 text-[#1e3a5f] font-mono uppercase">SELECT A MODULE FROM SIDEBAR</div>}>
          <Match when={activeModule() === 'flight-intel'}>
            <MapsView countries={props.countries} />
          </Match>
          <Match when={activeModule() === 'geo-map'}>
            <GeoIntelligenceUnifiedPanel />
          </Match>
          <Match when={activeModule() === 'geo-trend'}>
            <GeoTrendPanel />
          </Match>
          <Match when={activeModule() === 'naval-fleet'}><FleetVesselPanel /></Match>
          <Match when={activeModule() === 'oil-facility'}><OilFacilityPanel /></Match>
          <Match when={activeModule() === 'weather'}><WeatherPanel /></Match>
          <Match when={activeModule() === 'satellite-visual'}><SatelliteMappingPanel /></Match>
        </Switch>
      </div>
    </div>
  );
}
