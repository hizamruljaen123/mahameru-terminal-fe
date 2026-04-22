import { Show, Switch, Match } from 'solid-js';
import AirportIntelligencePanel from './infra/AirportIntelligencePanel';
import PortIntelligencePanel from './infra/PortIntelligencePanel';
import PowerPlantPanel from './infra/PowerPlantPanel';
import IndustrialZonePanel from './infra/IndustrialZonePanel';
import DatacenterPanel from './infra/datacenter-panel/DatacenterPanel';
import RailStationPanel from './infra/RailStationPanel';
import SubmarineCablePanel from './geo/SubmarineCablePanel';
import OilRefineryPanel from './geo/OilRefineryPanel';
import InfraCCTVPanel from './geo/InfraCCTVPanel';
import MinesDataPanel from './geo/MinesDataPanel';

export default function InfrastructureView(props) {
  const activeModule = () => props.module();

  return (
    <div class="flex-1 flex flex-col overflow-hidden bg-black">
      <div class="flex-1 min-h-0 overflow-hidden relative">
        <Switch fallback={<div class="p-8 text-text_accent font-mono opacity-20 flex items-center justify-center h-full uppercase tracking-widest animate-pulse">
          <div class="flex flex-col items-center gap-4">
            <div class="w-12 h-12 border-2 border-text_accent border-t-transparent animate-spin rounded-full"></div>
            SELECT_INFRA_MODULE_BY_SIDEBAR_CONTROL
          </div>
        </div>}>
          <Match when={activeModule() === 'airport'}>
            <AirportIntelligencePanel />
          </Match>
          <Match when={activeModule() === 'port'}>
            <PortIntelligencePanel />
          </Match>
          <Match when={activeModule() === 'power-plant'}>
            <PowerPlantPanel />
          </Match>
          <Match when={activeModule() === 'industrial-zone'}>
            <IndustrialZonePanel />
          </Match>
          <Match when={activeModule() === 'datacenter'}>
            <DatacenterPanel />
          </Match>
          <Match when={activeModule() === 'train-station'}>
            <RailStationPanel />
          </Match>
          <Match when={activeModule() === 'submarine-cable'}>
            <SubmarineCablePanel />
          </Match>
          <Match when={activeModule() === 'oil-facility'}>
            <OilRefineryPanel />
          </Match>
          <Match when={activeModule() === 'infra-cctv'}>
            <InfraCCTVPanel />
          </Match>
          <Match when={activeModule() === 'mines-data'}>
            <MinesDataPanel />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
