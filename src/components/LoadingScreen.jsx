export default function LoadingScreen(props) {
  return (
    <div class="flex-1 flex items-center justify-center bg-bg_main/50 transition-all duration-700 animate-in fade-in">
        <div class="relative p-12 border border-text_accent/20 bg-bg_sidebar/80 backdrop-blur-xl shadow-[0_0_80px_rgba(0,255,65,0.05)] flex flex-col items-center gap-8 max-w-md w-full">
            <div class="relative w-32 h-32">
                <div class="absolute inset-0 border border-text_accent/20 rounded-full"></div>
                <div class="absolute inset-2 border border-text_accent/10 rounded-full"></div>
                <div class="absolute inset-4 border border-text_accent/5 rounded-full"></div>
                <div class="absolute inset-0 border-r-2 border-text_accent rounded-full animate-spin shadow-[0_0_15px_var(--text-accent)]"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                    <div class="w-12 h-12 bg-text_accent/10 rounded-sm flex items-center justify-center animate-pulse border border-text_accent/30 shadow-[inset_0_0_10px_rgba(0,255,65,0.2)]">
                        <span class="text-text_accent text-xl font-black">A</span>
                    </div>
                </div>
            </div>

            <div class="flex flex-col items-center gap-3">
                <div class="text-[14px] font-black tracking-[0.6em] text-text_accent animate-pulse uppercase">
                    INITIALIZING_FEED
                </div>
                <div class="h-[2px] w-48 bg-text_secondary/10 relative overflow-hidden">
                    <div class="absolute inset-0 bg-text_accent animate-shimmer shadow-[0_0_10px_var(--text-accent)]"></div>
                </div>
            </div>

            <div class="font-mono text-[8px] text-text_secondary space-y-1 opacity-60 text-center tracking-widest leading-loose uppercase">
                 <p class="text-text_accent animate-pulse font-bold">{props.status().message}</p>
                 <p class="opacity-40 italic">SOURCE: {props.status().last_source || 'PENDING'}</p>
                 <p class="mt-2 bg-text_accent/5 border border-text_accent/20 py-1 px-4">
                    PROGRESS_NODE: {props.status().count}/{props.status().total} | {Math.round((props.status().count/props.status().total)*100 || 0)}%
                 </p>
            </div>
            
            <div class="absolute top-2 right-2 flex gap-1">
                 <div class="w-1 h-1 bg-text_accent animate-ping"></div>
                 <div class="w-1 h-1 bg-text_accent/50"></div>
            </div>
        </div>
    </div>
  );
}
