import { For, Show, createSignal } from 'solid-js';

const COLORS = ['text-sky-400 border-sky-400', 'text-amber-400 border-amber-400', 'text-emerald-400 border-emerald-400'];
const BG_COLORS = ['bg-sky-400/10', 'bg-amber-400/10', 'bg-emerald-400/10'];

export default function CompanySelector(props) {
  // props: companies (signal), setCompanies, onSearch (fn for autocomplete)
  const [suggestions, setSuggestions] = createSignal([[], [], []]);
  const [activeSugIdx, setActiveSugIdx] = createSignal(null);

  const fetchSuggestions = async (idx, q) => {
    if (!q || q.length < 1) { setSuggestions(prev => { const n = [...prev]; n[idx] = []; return n; }); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_RESEARCH_API}/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(prev => { const n = [...prev]; n[idx] = data.data || []; return n; });
    } catch (_) {}
  };

  const setSymbol = (idx, val) => {
    props.setCompanies(prev => {
      const n = [...prev];
      n[idx] = val;
      return n;
    });
  };

  const slotLabels = ['Company A', 'Company B', 'Company C (Optional)'];

  return (
    <div class="flex flex-col gap-3">
      <div class="text-[8px] font-black text-text_accent/50 tracking-[0.4em] uppercase border-b border-border_main pb-1">
        SELECT COMPANIES TO COMPARE
      </div>

      <For each={[0, 1, 2]}>
        {(idx) => (
          <div class="relative">
            <label class={`text-[8px] font-black tracking-wider uppercase block mb-1 ${COLORS[idx]}`}>
              {slotLabels[idx]}
            </label>
            <div class={`flex items-center gap-2 border ${idx < 2 ? 'border-white/20' : 'border-white/10'} ${BG_COLORS[idx]} rounded-sm px-2 py-1.5`}>
              <span class={`text-[10px] font-black ${COLORS[idx]}`}>{String.fromCharCode(65 + idx)}</span>
              <input
                type="text"
                placeholder={idx < 2 ? `e.g. BBCA.JK, AAPL` : `Optional — e.g. GOOG`}
                class="flex-1 bg-transparent text-[11px] font-mono text-white outline-none uppercase tracking-wider placeholder:text-white/15"
                value={props.companies()[idx]}
                onInput={(e) => {
                  setSymbol(idx, e.target.value.toUpperCase());
                  fetchSuggestions(idx, e.target.value);
                }}
                disabled={props.disabled}
              />
              <Show when={props.companies()[idx]}>
                <button
                  onClick={() => { setSymbol(idx, ''); setSuggestions(prev => { const n = [...prev]; n[idx] = []; return n; }); }}
                  class="text-white/20 hover:text-red-400 text-[10px] font-black"
                >✕</button>
              </Show>
            </div>

            {/* Autocomplete dropdown */}
            <Show when={suggestions()[idx]?.length > 0}>
              <div class="absolute z-50 w-full bg-bg_sidebar border border-border_main shadow-2xl mt-0.5 flex flex-col max-h-40 overflow-y-auto win-scroll">
                <For each={suggestions()[idx]}>
                  {(rec) => (
                    <button
                      type="button"
                      class="text-left px-3 py-1.5 text-[9px] hover:bg-text_accent hover:text-bg_main font-mono border-b border-border_main/30 text-white transition-colors flex flex-col"
                      onClick={() => {
                        setSymbol(idx, rec.symbol);
                        setSuggestions(prev => { const n = [...prev]; n[idx] = []; return n; });
                      }}
                    >
                      <span class="font-black text-text_accent">{rec.symbol}</span>
                      <span class="text-[8px] text-text_secondary truncate">{rec.name}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </For>

      <div class="text-[7px] font-mono text-white/20 text-center pt-1">
        Minimum 2 companies required · Maximum 3 companies
      </div>
    </div>
  );
}
