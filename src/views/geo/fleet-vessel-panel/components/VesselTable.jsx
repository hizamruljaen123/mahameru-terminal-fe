import { For } from 'solid-js';
import { getVesselColor } from '../utils/helpers';

/**
 * Vessel listing table component
 */
export default function VesselTable(props) {
    return (
        <table class="w-full text-left border-collapse">
            <thead class="sticky top-0 bg-[#0b0c10] z-20 border-b border-[#00f2ff]/20">
                <tr class="text-[7px] opacity-40 uppercase tracking-widest bg-[#06070a]">
                    <th class="px-6 py-2">VESSEL NAME</th>
                    <th class="px-6 py-2">CATEGORY</th>
                </tr>
            </thead>
            <tbody>
                <For each={props.vessels()}>
                    {(ship) => (
                        <tr
                            onClick={() => props.onSelect(ship)}
                            class={`text-[10px] border-b border-white/5 hover:bg-[#00f2ff]/5 cursor-pointer transition-colors ${props.selectedMmsi === ship.mmsi ? 'bg-[#00f2ff]/10' : ''}`}
                        >
                            <td class="px-6 py-1.5 font-black uppercase text-white/90">
                                <div class="flex items-center gap-2">
                                    <div class="w-1.5 h-1.5 rounded-full" style={{ background: getVesselColor(ship.type) }}></div>
                                    {ship.name || 'UNKNOWN'}
                                </div>
                            </td>
                            <td class="px-6 py-1.5 opacity-60 font-mono tracking-tighter text-[9px]">
                                {ship.type || 'N/A'}
                            </td>
                        </tr>
                    )}
                </For>
            </tbody>
        </table>
    );
}