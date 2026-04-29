import { createSignal, Show } from 'solid-js';
import LiveMarketTerminal from '../../components/LiveMarketTerminal';

export default function LiveCryptoModule(props) {
  const [symbols, setSymbols] = createSignal("");
  const [watchlist, setWatchlist] = createSignal([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const input = symbols().trim();
    if (!input) return;
    
    // Split by comma if user enters multiple, e.g. BTC, ETH
    const parsed = input.split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .map(s => s.includes('USDT') ? s : `${s}USDT`);
      
    if (parsed.length > 0) {
      setWatchlist(parsed);
    }
  };

  return (
    <div class="h-full flex flex-col bg-[#111] border border-white/5 rounded-sm overflow-hidden font-mono group">
      {/* Module Header */}
      <div class="drag-handle flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5 cursor-grab active:cursor-grabbing">
        <div class="flex items-center gap-2">
          <div class={`w-1.5 h-1.5 rounded-full ${watchlist().length > 0 ? 'bg-text_accent animate-pulse' : 'bg-text_accent/40'}`}></div>
          <span class="text-[9px] font-black text-text_accent uppercase tracking-widest">
            {watchlist().length > 0 ? `LIVE CRYPTO: ${watchlist().join(', ')}` : 'CRYPTO NODE DEPLOYMENT'}
          </span>
        </div>
        
        <div class="flex items-center gap-2">
          <button 
            onClick={() => props.onRemove(props.instanceId)}
            class="text-text_secondary/40 hover:text-red-500 transition-colors"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Module Controls: Symbol Input */}
      <Show when={watchlist().length === 0}>
        <div class="p-6 bg-black/20 flex-1 flex flex-col justify-center items-center space-y-4 animate-in fade-in duration-300">
          <div class="w-full max-w-xs text-center flex flex-col items-center">
            <div class="w-12 h-12 rounded-full bg-text_accent/5 border border-text_accent/20 flex items-center justify-center mb-4 text-text_accent">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            
            <label class="text-[9px] font-black text-text_secondary/80 uppercase tracking-[0.2em] mb-2 block">
              ENTER CRYPTO SYMBOL(S)
            </label>
            
            <form onSubmit={handleSubmit} class="w-full flex flex-col gap-3">
              <div class="relative w-full">
                <input 
                  type="text" 
                  placeholder="E.G. BTC, ETH, SOLUSDT"
                  value={symbols()}
                  onInput={(e) => setSymbols(e.target.value)}
                  class="w-full bg-black/40 border border-border_main/60 p-3 text-[11px] font-mono text-text_primary outline-none focus:border-text_accent/50 transition-all uppercase rounded-md text-center tracking-wider placeholder-text_secondary/30"
                  autofocus
                />
              </div>
              
              <button 
                type="submit"
                class="w-full bg-text_accent/10 border border-text_accent/30 text-text_accent text-[10px] font-black py-3 rounded-md hover:bg-text_accent hover:text-black transition-all uppercase tracking-[0.15em] shadow-[0_0_15px_rgba(var(--text-accent-rgb),0.1)] hover:shadow-[0_0_20px_rgba(var(--text-accent-rgb),0.2)]"
              >
                Launch Live Feed
              </button>
            </form>
            <span class="text-[8px] text-text_secondary/40 mt-3 block italic uppercase tracking-wider">Separate multiple pairs with commas</span>
          </div>
        </div>
      </Show>

      {/* Live Market Terminal */}
      <Show when={watchlist().length > 0}>
        <div class="flex-1 min-h-0 relative animate-in zoom-in-[0.98] duration-300">
          <LiveMarketTerminal watchlist={watchlist()} setWatchlist={setWatchlist} />
          
          {/* Action button to reset or modify watchlist if needed */}
          <button 
            onClick={() => setWatchlist([])}
            class="absolute bottom-3 left-3 px-3 py-1.5 bg-black/80 backdrop-blur-md border border-border_main/40 text-text_secondary/60 hover:text-text_primary text-[8px] font-black uppercase tracking-widest rounded-md transition-all z-50 opacity-40 hover:opacity-100 hover:border-text_accent/30"
          >
            [ CHANGE PAIRS ]
          </button>
        </div>
      </Show>
    </div>
  );
}
