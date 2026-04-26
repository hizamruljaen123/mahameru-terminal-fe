import { For, createSignal, createMemo, createEffect } from 'solid-js';
import { getVesselColor } from '../utils/helpers';

/**
 * Vessel listing table component with pagination
 */
export default function VesselTable(props) {
    const [page, setPage] = createSignal(0);
    const pageSize = 20;

    const paginatedVessels = createMemo(() => {
        const start = page() * pageSize;
        return props.vessels().slice(start, start + pageSize);
    });

    const totalPages = createMemo(() => Math.ceil(props.vessels().length / pageSize));

    // Reset page when search/filter changes
    createEffect(() => {
        props.vessels();
        setPage(0);
    });

    return (
        <div class="h-full flex flex-col overflow-hidden">
            <div class="flex-1 overflow-y-auto tactical-scrollbar">
                <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-[#0b0c10] z-20 border-b border-[#00f2ff]/20">
                        <tr class="text-[7px] opacity-40 uppercase tracking-widest bg-[#06070a]">
                            <th class="px-6 py-2">VESSEL NAME</th>
                            <th class="px-6 py-2">CATEGORY</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={paginatedVessels()}>
                            {(ship) => (
                                <tr
                                    onClick={() => props.onSelect(ship)}
                                    class={`text-[10px] border-b border-white/5 hover:bg-[#00f2ff]/5 cursor-pointer transition-colors ${String(props.selectedMmsi?.() || '') === String(ship.mmsi) ? 'bg-[#00f2ff]/10' : ''}`}
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
            </div>

            {/* Pagination Controls */}
            <div class="h-10 bg-[#06070a] border-t border-white/5 flex items-center justify-between px-6 shrink-0">
                <div class="text-[8px] font-bold text-white/30 uppercase tracking-widest">
                    PAGE {page() + 1} OF {Math.max(1, totalPages())}
                </div>
                <div class="flex gap-1">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page() === 0}
                        class={`px-3 py-1 text-[8px] font-black border ${page() === 0 ? 'text-white/10 border-white/5' : 'text-[#00f2ff] border-[#00f2ff]/30 hover:bg-[#00f2ff]/10'}`}
                    >
                        PREV
                    </button>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages() - 1, p + 1))}
                        disabled={page() >= totalPages() - 1}
                        class={`px-3 py-1 text-[8px] font-black border ${page() >= totalPages() - 1 ? 'text-white/10 border-white/5' : 'text-[#00f2ff] border-[#00f2ff]/30 hover:bg-[#00f2ff]/10'}`}
                    >
                        NEXT
                    </button>
                </div>
            </div>
        </div>
    );
}