import { For, Show } from 'solid-js';

const COLORS = ['sky', 'amber', 'emerald'];
const colorMap = {
  sky: { text: 'text-sky-400', border: 'border-sky-400/30', bg: 'bg-sky-400/5' },
  amber: { text: 'text-amber-400', border: 'border-amber-400/30', bg: 'bg-amber-400/5' },
  emerald: { text: 'text-emerald-400', border: 'border-emerald-400/30', bg: 'bg-emerald-400/5' },
};

const RISK_KEYWORDS = ['lawsuit', 'fraud', 'fine', 'penalty', 'investigation', 'violation', 'sanction', 'corruption', 'hukum', 'gugatan', 'korupsi', 'pidana', 'denda', 'kasus'];

function getRiskLevel(news = []) {
  const texts = news.map(n => (n.title || '').toLowerCase());
  const hits = texts.filter(t => RISK_KEYWORDS.some(k => t.includes(k)));
  if (hits.length >= 4) return { label: 'HIGH', color: 'text-red-400 bg-red-400/10 border-red-400/30' };
  if (hits.length >= 2) return { label: 'MEDIUM', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' };
  return { label: 'LOW', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' };
}

export default function LegalCasePanel(props) {
  const companies = () => props.companies || [];

  const formatDate = (ts) => {
    if (!ts) return '';
    try { return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (_) { return ''; }
  };

  return (
    <div class="flex flex-col gap-6">
      {/* Risk Level Summary */}
      <div class={`grid gap-4`} style={{ 'grid-template-columns': `repeat(${companies().length}, 1fr)` }}>
        <For each={companies()}>
          {(comp, i) => {
            const c = colorMap[COLORS[i()]];
            const riskLevel = getRiskLevel(comp?.legalNews || []);
            return (
              <div class={`border ${c.border} ${c.bg} rounded p-3`}>
                <div class={`text-[9px] font-black ${c.text} uppercase tracking-widest mb-2`}>{comp.symbol}</div>
                <div class="flex items-center gap-2">
                  <span class="text-[8px] text-white/30 font-bold uppercase">Legal Risk Exposure:</span>
                  <span class={`text-[9px] font-black px-2 py-0.5 rounded border ${riskLevel.color}`}>
                    {riskLevel.label}
                  </span>
                </div>
                <div class="text-[7px] font-mono text-white/20 mt-1">
                  {(comp?.legalNews || []).length} legal-related news signals detected
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Legal News Feeds */}
      <div class={`grid gap-6`} style={{ 'grid-template-columns': `repeat(${companies().length}, 1fr)` }}>
        <For each={companies()}>
          {(comp, i) => {
            const c = colorMap[COLORS[i()]];
            const legalNews = comp?.legalNews || [];
            return (
              <div class="flex flex-col gap-2">
                <div class={`text-[8px] font-black ${c.text} uppercase tracking-widest border-b border-white/5 pb-1`}>
                  {comp.symbol} — Legal Case Intelligence
                </div>
                <div class="flex flex-col gap-2 max-h-[320px] overflow-y-auto win-scroll pr-1">
                  <Show when={legalNews.length === 0}>
                    <div class="text-[8px] italic text-white/20 py-4 text-center">
                      No significant legal cases detected. Monitoring ongoing.
                    </div>
                  </Show>
                  <For each={legalNews.slice(0, 8)}>
                    {(item) => {
                      const title = (item.title || '').toLowerCase();
                      const isHigh = RISK_KEYWORDS.some(k => title.includes(k));
                      return (
                        <a
                          href={item.link || item.url || '#'}
                          target="_blank"
                          class={`block border rounded p-2.5 transition-all cursor-pointer ${isHigh ? 'border-red-400/20 bg-red-400/[0.03] hover:bg-red-400/[0.06]' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'}`}
                        >
                          <div class="flex items-center justify-between mb-1">
                            <span class={`text-[7px] font-black px-1.5 py-0.5 uppercase ${isHigh ? 'text-red-400 bg-red-400/10' : `${c.text} bg-white/5`}`}>
                              {isHigh ? '⚠ LEGAL SIGNAL' : (item.publisher || item.source || 'NEWS')}
                            </span>
                            <span class="text-[7px] font-mono text-white/20">
                              {formatDate(item.providerPublishTime || item.timestamp)}
                            </span>
                          </div>
                          <div class="text-[9px] font-semibold text-white/70 hover:text-white leading-snug line-clamp-2 transition-colors">
                            {item.title}
                          </div>
                        </a>
                      );
                    }}
                  </For>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
