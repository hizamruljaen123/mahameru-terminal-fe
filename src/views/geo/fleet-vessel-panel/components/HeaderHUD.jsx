import { Show } from 'solid-js';

/**
 * Header HUD component displaying system status and controls
 */
export default function HeaderHUD(props) {
    return (
        <div class="h-16 border-b border-[#00f2ff]/20 bg-[#06070a] flex items-center justify-between px-6 z-50">
            <div class="flex items-center gap-6">
                <div class="flex flex-col">
                    <div class="flex items-baseline gap-3">
                        <span class="text-xs font-black tracking-widest uppercase italic text-white">FLEET MONITORING SYSTEM</span>
                        <span class="text-[7px] text-[#00f2ff]/40 tracking-widest uppercase border border-[#00f2ff]/20 px-1.5">SYSTEM ACTIVE</span>
                    </div>

                    {/* Inline Legend Strip */}
                    <div class="flex gap-4 items-center mt-2 overflow-x-hidden whitespace-nowrap opacity-60">
                        <div class="flex items-center gap-2 border-r border-white/10 pr-4">
                            <div class="flex items-center gap-1.5">
                                <div class="w-1.5 h-1.5 rounded-full bg-[#ff9d00]"></div>
                                <span class="text-[6px] uppercase tracking-tighter">TANKER</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <div class="w-1.5 h-1.5 rounded-full bg-[#00f2ff]"></div>
                                <span class="text-[6px] uppercase tracking-tighter">CARGO</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <div class="w-1.5 h-1.5 rounded-full bg-[#ff0055]"></div>
                                <span class="text-[6px] uppercase tracking-tighter">OFFICIAL</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <div class="w-1.5 h-1.5 rounded-full bg-[#00ff41]"></div>
                                <span class="text-[6px] uppercase tracking-tighter">FISHING</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="flex items-center gap-1.5">
                                <div class="w-1.5 h-1.5 bg-[#3b82f6]"></div>
                                <span class="text-[6px] uppercase tracking-tighter">CN_COAST</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <div class="w-1.5 h-1.5 bg-[#10b981]"></div>
                                <span class="text-[6px] uppercase tracking-tighter">RN_RIVER</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <div class="w-1.5 h-1.5 bg-[#f59e0b]"></div>
                                <span class="text-[6px] uppercase tracking-tighter">TH_TYPH</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="h-8 w-px bg-white/10 mx-2"></div>

                <div class="flex items-center gap-4 text-[10px]">
                    <div class="flex flex-col">
                        <span class="text-[6px] opacity-30 uppercase tracking-widest">ACTIVE REGION</span>
                        <span class="font-bold tracking-tighter">{props.activeTheater()}</span>
                    </div>
                    <div class="flex flex-col ml-4">
                        <span class="text-[6px] opacity-30 uppercase tracking-widest">STATUS</span>
                        <span class={`font-black ${props.status() === 'CONNECTED' ? 'text-[#00ff41]' : 'text-[#ff3e3e]'}`}>
                            {props.status()}
                        </span>
                    </div>
                    <div class="flex flex-col ml-4">
                        <span class="text-[6px] opacity-30 uppercase tracking-widest">VESSELS TRACKED</span>
                        <span class="font-black text-white">{props.vesselCount()}</span>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-6">
                <div class="flex flex-col items-end">
                    <span class="text-[7px] text-[#00f2ff]/40 uppercase tracking-widest">LAST UPDATE</span>
                    <span class="text-[11px] font-bold">{props.lastSignalTime()}</span>
                </div>
                <Show when={props.isOperational()}>
                    <button
                        onClick={props.onTerminate}
                        class="px-4 py-1.5 border border-[#ff3e3e]/40 text-[#ff3e3e] text-[9px] font-black hover:bg-[#ff3e3e] hover:text-white transition-all uppercase"
                    >
                        STOP
                    </button>
                </Show>
            </div>
        </div>
    );
}