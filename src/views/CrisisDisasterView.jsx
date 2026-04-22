import { Show } from 'solid-js';
import ConflictIndexView from './ConflictIndexView';
import DisasterMappingView from './DisasterMappingView';

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
                <div class="h-full w-full flex items-center justify-center bg-black text-white font-mono uppercase">
                    <div class="mt-4 p-4 bg-black/40 border border-white/5 rounded">
                        <div class="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Status Report</div>
                        <div class="text-[12px] text-zinc-300">Monitoring all strategic nodes for anomalous activity.</div>
                    </div>
                </div>
            </Show>
        </div>
    );
}
