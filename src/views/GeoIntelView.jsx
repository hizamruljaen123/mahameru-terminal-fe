import { Show, Switch, Match } from 'solid-js';
import VesselRadarPanel from './geo/VesselRadarPanel';
import GeoIntelligenceUnifiedPanel from './geo/GeoIntelligenceUnifiedPanel';


import MinesDataPanel from './geo/MinesDataPanel';
import FleetVesselPanel from './geo/fleet-vessel-panel/FleetVesselPanel';
import OilFacilityPanel from './geo/OilFacilityPanel';
import OilRefineryPanel from './geo/OilRefineryPanel';
import SubmarineCablePanel from './geo/SubmarineCablePanel';
import WeatherPanel from './geo/WeatherPanel';
import GeoTrendPanel from './geo/GeoTrendPanel';
import InfraCCTVPanel from './geo/InfraCCTVPanel';
import MapsView from './MapsView';
import GlobalEconomyPanel from './geo/GlobalEconomyPanel';
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


          <Match when={activeModule() === 'mines-data'}><MinesDataPanel /></Match>
          <Match when={activeModule() === 'naval-fleet'}><FleetVesselPanel /></Match>
          <Match when={activeModule() === 'oil-facility'}><OilFacilityPanel /></Match>
          <Match when={activeModule() === 'oil-refinery'}><OilRefineryPanel /></Match>
          <Match when={activeModule() === 'submarine-cable'}><SubmarineCablePanel /></Match>
          <Match when={activeModule() === 'tech-infra'}><TechInfraPanel /></Match>
          <Match when={activeModule() === 'infra-cctv'}><InfraCCTVPanel /></Match>
          <Match when={activeModule() === 'weather'}><WeatherPanel /></Match>
          <Match when={activeModule() === 'global-economy'}><GlobalEconomyPanel /></Match>
          <Match when={activeModule() === 'satellite-visual'}><SatelliteMappingPanel /></Match>
        </Switch>
      </div>
    </div>
  );
}
