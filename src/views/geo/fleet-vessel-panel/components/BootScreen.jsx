import { Show } from 'solid-js';
import { THEATERS } from '../constants/theaters';

/**
 * Boot screen for theater selection and system initialization
 */
export default function BootScreen(props) {
    return (
        <Show when={!props.isOperational()}>
            <div class="absolute inset-0 z-[100] bg-[#06070a] flex items-center justify-center p-12">
                <div class="max-w-md w-full space-y-8 bg-[#0b0c10] p-10 border border-[#00f2ff]/20">
                    <div class="space-y-1">
                        <h1 class="text-2xl font-black italic tracking-tighter uppercase text-[#00f2ff]">FLEET TRACKING</h1>
                        <p class="text-[9px] opacity-40 uppercase tracking-widest leading-relaxed">
                            SYSTEM OPTIMIZED FOR STABILITY // PERFORMANCE MODE
                        </p>
                    </div>

                    <div class="space-y-4">
                        <div class="flex flex-col gap-2">
                            <label class="text-[8px] uppercase tracking-widest opacity-60">SELECT REGION</label>
                            <select
                                class="w-full bg-[#06070a] border border-[#00f2ff]/20 p-3 text-xs outline-none focus:border-[#00f2ff] text-[#00f2ff]"
                                value={props.activeTheater()}
                                onChange={(e) => props.onTheaterChange(e.target.value)}
                            >
                                {Object.entries(THEATERS).map(([k, v]) => (
                                    <option value={k}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={props.onLaunch}
                            class="w-full py-4 bg-[#00f2ff]/10 border border-[#00f2ff] text-xs font-black tracking-[0.4em] uppercase hover:bg-[#00f2ff] hover:text-[#06070a] transition-all"
                        >
                            LOAD DATA
                        </button>
                    </div>
                </div>
            </div>
        </Show>
    );
}