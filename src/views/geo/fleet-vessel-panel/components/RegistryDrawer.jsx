import { Show, Switch, Match, For } from 'solid-js';
import VesselTable from './VesselTable';
import PortList from './PortList';
import FusionPanel from './FusionPanel';
import AnalyticsPanel from './AnalyticsPanel';
import IntelligencePanel from './IntelligencePanel';
import ReconPanel from './ReconPanel';
import DisasterPanel from './DisasterPanel';

/**
 * Registry drawer component with dual-pane layout
 */
export default function RegistryDrawer(props) {
    return (
        <div class={`bg-[#0b0c10] border-t border-[#00f2ff]/20 transition-all duration-300 ${props.showRegistry() ? 'h-[40%]' : 'h-0'}`}>
            <div class="h-full flex flex-row overflow-hidden divide-x divide-[#00f2ff]/10">

                {/* Left Pane - Listings */}
                <div class="w-[50%] flex flex-col h-full bg-[#06070a]/40">
                    {/* Tab Header */}
                    <div class="p-4 border-b border-[#00f2ff]/10 bg-[#0b0c10]">
                        <div class="flex gap-4 h-8 items-center justify-between mb-4">
                            <div class="flex gap-2 h-full">
                                <For each={['VESSELS', 'PORTS', 'HAZARDS', 'FUSION', 'ANALYTICS', 'INTELLIGENCE']}>
                                    {(tab) => (
                                         <button
                                             onClick={() => {
                                                 if (tab === 'INTELLIGENCE') props.onTabChange(tab, true);
                                                 else props.onTabChange(tab);
                                             }}
                                             class={`h-full px-4 text-[9px] font-black transition-all border ${props.getTabStyle(tab)}`}
                                         >
                                             {tab}
                                         </button>
                                     )}
                                 </For>
                            </div>
                            <span class="text-[7px] opacity-30 italic">
                                DATA_LOADED: {props.activeTab() === 'VESSELS' ? props.registrySize() : props.portsCount()}
                            </span>
                        </div>

                        {/* Filter HUD */}
                        <div class="flex items-center gap-3">
                            <span class="text-[8px] font-black opacity-30 uppercase">Filter:</span>
                            <div class="flex flex-wrap gap-1.5">
                                <Switch>
                                    <Match when={props.activeTab() === 'VESSELS'}>
                                        <For each={['ALL', 'TANKER', 'CARGO', 'PASSENGER', 'OFFICIAL', 'FISHING']}>
                                            {(f) => (
                                                <button
                                                    onClick={() => props.onVesselFilterChange(f)}
                                                    class={`px-2 py-0.5 text-[7px] font-black border transition-all ${props.vesselFilter() === f ? 'bg-[#00f2ff]/20 text-[#00f2ff] border-[#00f2ff]/40' : 'text-white/30 border-white/5 hover:border-white/10'}`}
                                                >
                                                    {f}
                                                </button>
                                            )}
                                        </For>
                                    </Match>
                                    <Match when={props.activeTab() === 'PORTS'}>
                                        <For each={['ALL', 'CN', 'CB', 'CT', 'RN', 'RB', 'RT', 'LC', 'OR', 'TH']}>
                                            {(f) => (
                                                <button
                                                    onClick={() => props.onPortFilterChange(f)}
                                                    class={`px-2 py-0.5 text-[7px] font-black border transition-all ${props.portFilter() === f ? 'bg-blue-600/20 text-blue-400 border-blue-600/40' : 'text-white/30 border-white/5 hover:border-white/10'}`}
                                                >
                                                    {f}
                                                </button>
                                            )}
                                        </For>
                                    </Match>
                                </Switch>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div class="flex-1 overflow-y-auto tactical-scrollbar bg-black/20">
                        <Switch>
                            <Match when={props.activeTab() === 'VESSELS'}>
                                <VesselTable
                                    vessels={props.filteredShips}
                                    selectedMmsi={props.selectedMmsi}
                                    onSelect={(ship) => props.onVesselSelect(ship)}
                                />
                            </Match>
                            <Match when={props.activeTab() === 'PORTS'}>
                                <PortList
                                    groupedPorts={props.groupedPorts}
                                    selectedPortId={props.selectedPortId}
                                    onSelect={(port) => props.onPortSelect(port)}
                                />
                            </Match>
                            <Match when={props.activeTab() === 'FUSION'}>
                                <FusionPanel
                                    fusionResults={props.fusionResults}
                                    fusionLoading={props.fusionLoading}
                                    weatherData={props.weatherData}
                                    marketData={props.marketData}
                                    showAllFlows={props.showAllFlows}
                                    onToggleFlows={props.onToggleFlows}
                                    onSelectVessel={props.onVesselSelectDetailed}
                                    onSelectRefinery={props.onRefinerySelect}
                                />
                            </Match>
                            <Match when={props.activeTab() === 'ANALYTICS'}>
                                <AnalyticsPanel 
                                    fusionResults={props.fusionResults}
                                    intelDossier={props.intelDossier}
                                    marketData={props.marketData}
                                    stormData={props.stormData}
                                    disasterAlerts={props.disasterAlerts}
                                />
                            </Match>
                            <Match when={props.activeTab() === 'INTELLIGENCE'}>
                                <IntelligencePanel 
                                    intelDossier={props.intelDossier}
                                    intelLoading={props.intelLoading}
                                />
                            </Match>
                            <Match when={props.activeTab() === 'HAZARDS'}>
                                <DisasterPanel 
                                    state={props.state} 
                                />
                            </Match>
                        </Switch>
                    </div>
                </div>

                {/* Right Pane - Recon */}
                <ReconPanel
                    ship={props.activeShip}
                    activePort={props.activePort}
                    activeRefinery={props.activeRefinery}
                    dossierTabState={[props.dossierTab, props.onDossierTabChange]}
                    reconTabState={[props.reconTab, props.onReconTabChange]}
                    portReconTabState={[props.portReconTab, props.onPortReconTabChange]}
                    intelLoading={props.intelLoading}
                    tacticalIntel={props.tacticalIntel}
                    stormData={props.stormData}
                    onSelectRefinery={props.onRefinerySelect}
                />
            </div>
        </div>
    );
}