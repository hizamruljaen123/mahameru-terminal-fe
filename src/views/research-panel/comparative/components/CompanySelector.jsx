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
    <div class="flex flex-col gap-2">
      <div class="relative group">
        <div class={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${props.disabled ? 'opacity-50 cursor-not-allowed bg-white/5 border-white/5' : 'bg-white/[0.03] border-white/10 hover:border-text_accent/30 focus-within:border-text_accent/50 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_20px_rgba(34,211,238,0.05)]'}`}>
          <div class={`transition-colors duration-300 ${inputValue() ? 'text-text_accent' : 'text-white/20'}`}>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <input
            type="text"
            placeholder="Search & Compare Tickers..."
            class="flex-1 bg-transparent text-[11px] font-bold text-white outline-none uppercase tracking-[0.1em] placeholder:text-white/10 placeholder:font-normal"
            value={inputValue()}
            onInput={handleInput}
            disabled={props.disabled}
          />

          <Show when={inputValue()}>
            <button
              onClick={() => { setInputValue(''); props.setCompanies(['', '', '']); setSuggestions([]); }}
              class="p-1 hover:bg-white/10 rounded-full text-white/20 hover:text-red-400 transition-all"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Show>
        </div>

        {/* Autocomplete dropdown - Redesigned to be solid and premium */}
        <Show when={suggestions().length > 0}>
          <div class="absolute z-50 w-full bg-[#0a0a0a] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] mt-2 flex flex-col max-h-64 overflow-y-auto win-scroll rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div class="bg-white/[0.02] px-4 py-2 text-[8px] font-black text-white/20 uppercase tracking-[0.2em] border-b border-white/5">
              Suggestions for "{currentWord()}"
            </div>
            <For each={suggestions()}>
              {(rec) => (
                <button
                  type="button"
                  class="text-left px-4 py-3 hover:bg-white/[0.05] border-b border-white/[0.03] last:border-b-0 transition-colors flex flex-col gap-1 group"
                  onClick={() => selectSymbol(rec.symbol)}
                >
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-black text-text_accent group-hover:text-white transition-colors">{rec.symbol}</span>
                    <span class="text-[7px] font-bold text-white/10 uppercase tracking-widest">{rec.typeDisp || rec.quoteType || 'Equity'}</span>
                  </div>
                  <div class="text-[9px] font-bold text-white/40 group-hover:text-white/80 transition-colors truncate uppercase">
                    {rec.shortname || rec.longname || rec.name}
                  </div>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Active Tickers Chips - Modern Pill Style */}
      <Show when={props.companies().filter(s => s.length > 0).length > 0}>
        <div class="flex flex-wrap gap-2 mt-1">
          <For each={props.companies().filter(s => s.length > 0)}>
            {(symbol, i) => (
              <div class={`px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-2 border animate-in zoom-in-90 duration-200 ${BG_COLORS[i()] || 'bg-white/5'} ${COLORS[i()] || 'text-white border-white/10'}`}>
                <span class="tracking-widest">{symbol}</span>
                <button onClick={() => {
                  const next = props.companies().filter(s => s !== symbol);
                  props.setCompanies(next);
                }} class="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-black/20 transition-colors">
                  <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

