import { Show } from 'solid-js';
import ConflictIndexView from './ConflictIndexView';
import DisasterMappingView from './DisasterMappingView';
import MarketRiskPanel from './crisis-watcher/MarketRiskPanel';

export default function CrisisDisasterView(props) {
    return (
        <div class="h-full w-full overflow-hidden">
            <Show when={props.module === 'conflict'}>
                <ConflictIndexView />
            </Show>
            <Show when={props.module === 'disaster'}>
                <DisasterMappingView />
            </Show>
            <Show when={props.module === 'risk'}>
                <MarketRiskPanel />
            </Show>
        </div>
    );
}
