import { For, Show, createSignal, createEffect } from 'solid-js';

const COLORS = ['text-sky-400 border-sky-400', 'text-amber-400 border-amber-400', 'text-emerald-400 border-emerald-400'];
const BG_COLORS = ['bg-sky-400/10', 'bg-amber-400/10', 'bg-emerald-400/10'];

export default function CompanySelector(props) {
  const [inputValue, setInputValue] = createSignal('');
  const [suggestions, setSuggestions] = createSignal([]);
  const [currentWord, setCurrentWord] = createSignal('');

  // Sync internal input value with props.companies
  createEffect(() => {
    const symbols = props.companies().filter(s => s && s.trim().length > 0);
    if (symbols.length > 0 && !inputValue().includes(symbols[0])) {
      setInputValue(symbols.join(', '));
    }
  });

  const fetchSuggestions = async (q) => {
    const query = q.trim();
    if (!query || query.length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_RESEARCH_API}/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const filtered = (data.data || []).filter(item => 
        ['EQUITY', 'EQUITY_STOCK', 'COMMONSTOCK'].includes(item.quoteType?.toUpperCase()) || 
        ['EQUITY', 'STOCK'].includes(item.typeDisp?.toUpperCase())
      );
      setSuggestions(filtered);
    } catch (_) {
      setSuggestions([]);
    }
  };

  const handleInput = (e) => {
    const val = e.target.value.toUpperCase();
    setInputValue(val);
    
    // Split by comma to get the last word
    const parts = val.split(',');
    const lastPart = parts[parts.length - 1].trim();
    setCurrentWord(lastPart);
    
    if (lastPart.length > 0) {
      fetchSuggestions(lastPart);
    } else {
      setSuggestions([]);
    }

    // Update parent state
    const symbols = parts.map(s => s.trim()).filter(s => s.length > 0).slice(0, 3);
    props.setCompanies(symbols);
  };

  const selectSymbol = (symbol) => {
    const parts = inputValue().split(',');
    parts[parts.length - 1] = ` ${symbol}`; // Replace last part with selected symbol
    const newVal = parts.join(',').trim();
    
    setInputValue(newVal);
    setSuggestions([]);
    
    const symbols = newVal.split(',').map(s => s.trim()).filter(s => s.length > 0).slice(0, 3);
    props.setCompanies(symbols);
  };

  return (
    <div class="flex flex-col gap-3">
      <div class="text-[8px] font-black text-text_accent/50 tracking-[0.4em] uppercase border-b border-border_main pb-1">
        SELECT COMPANIES TO COMPARE
      </div>

      <div class="relative">
        <label class="text-[8px] font-black tracking-wider uppercase block mb-1 text-sky-400">
          Multi-Ticker Input
        </label>
        <div class="flex flex-col gap-2 border border-white/20 bg-white/5 rounded-sm p-1">
          <div class="flex items-center gap-2 px-2 py-1.5">
             <svg class="w-3 h-3 text-text_accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
             <input
              type="text"
              placeholder="E.G. BBCA.JK, AAPL, MSFT"
              class="flex-1 bg-transparent text-[11px] font-mono text-white outline-none uppercase tracking-wider placeholder:text-white/15"
              value={inputValue()}
              onInput={handleInput}
              disabled={props.disabled}
            />
            <Show when={inputValue()}>
              <button
                onClick={() => { setInputValue(''); props.setCompanies(['', '', '']); setSuggestions([]); }}
                class="text-white/20 hover:text-red-400 text-[10px] font-black"
              >✕</button>
            </Show>
          </div>
          
          {/* Active Tickers Chips */}
          <div class="flex flex-wrap gap-1 px-1 pb-1">
            <For each={props.companies().filter(s => s.length > 0)}>
              {(symbol, i) => (
                <div class={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1.5 ${BG_COLORS[i()] || 'bg-white/10'} ${COLORS[i()] || 'text-white'}`}>
                  <span>{symbol}</span>
                  <button onClick={() => {
                    const next = props.companies().filter(s => s !== symbol);
                    props.setCompanies(next);
                  }} class="hover:text-white">✕</button>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Autocomplete dropdown */}
        <Show when={suggestions().length > 0}>
          <div class="absolute z-50 w-full bg-bg_sidebar border border-border_main shadow-2xl mt-1 flex flex-col max-h-56 overflow-y-auto win-scroll rounded-sm">
            <div class="bg-white/5 px-3 py-1 text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">Select Match for "{currentWord()}"</div>
            <For each={suggestions()}>
              {(rec) => (
                <button
                  type="button"
                  class="text-left px-3 py-2 text-[9px] hover:bg-text_accent hover:text-bg_main font-mono border-b border-border_main/30 text-white transition-colors flex flex-col gap-0.5 group"
                  onClick={() => selectSymbol(rec.symbol)}
                >
                  <div class="flex items-center justify-between">
                    <span class="font-black text-text_accent group-hover:text-bg_main uppercase">{rec.symbol}</span>
                    <span class="text-[7px] opacity-40 italic group-hover:text-bg_main/50">{rec.typeDisp || rec.quoteType || rec.type || 'Equity'}</span>
                  </div>
                  <div class="text-[10px] font-bold text-white/90 truncate uppercase tracking-tight group-hover:text-bg_main">
                    {rec.shortname || rec.longname || rec.name || 'Unknown Company'}
                  </div>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="text-[7px] font-mono text-white/20 text-center pt-1">
        Max 3 companies · Separate with commas
      </div>
    </div>
  );
}
