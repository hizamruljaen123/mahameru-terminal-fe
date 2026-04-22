import { For } from 'solid-js';
import { HARBOR_TYPE_NAMES } from '../constants/colors';

/**
 * Port listing grouped by harbor type
 */
export default function PortList(props) {
    return (
        <div class="flex flex-col divide-y divide-[#00f2ff]/10">
            <For each={Object.entries(props.groupedPorts())}>
                {([type, pList]) => (
                    <div class="flex flex-col">
                        <div class="sticky top-0 bg-[#00f2ff]/10 px-6 py-2 text-[8px] font-black text-blue-400 border-b border-[#00f2ff]/20 backdrop-blur-md z-10 uppercase tracking-tighter">
                            {HARBOR_TYPE_NAMES[type] || type} [{pList.length}]
                        </div>
                        <For each={pList}>
                            {(port) => (
                                <div
                                    onClick={() => props.onSelect(port)}
                                    class={`px-6 py-2 text-[9px] hover:bg-[#00f2ff]/5 cursor-pointer transition-colors border-b border-white/5 ${props.selectedPortId === port.id ? 'bg-blue-600/10' : ''}`}
                                >
                                    <div class="flex items-center gap-2">
                                        <span class="font-black text-white/90 uppercase">{port.name}</span>
                                        <span class="text-[7px] opacity-30">{port.country_name}</span>
                                    </div>
                                    <div class="text-[7px] opacity-40 mt-0.5 font-mono">
                                        {port.latitude?.toFixed(4)}°, {port.longitude?.toFixed(4)}°
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                )}
            </For>
        </div>
    );
}