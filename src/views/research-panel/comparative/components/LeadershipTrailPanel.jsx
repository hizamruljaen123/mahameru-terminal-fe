import { For, Show } from 'solid-js';

const COLORS = ['sky', 'amber', 'emerald'];
const colorMap = {
  sky: { text: 'text-sky-400', border: 'border-sky-400/30' },
  amber: { text: 'text-amber-400', border: 'border-amber-400/30' },
  emerald: { text: 'text-emerald-400', border: 'border-emerald-400/30' },
};

function NewsCard({ item, colorText }) {
  const formatDate = (ts) => {
    if (!ts) return '';
    try { return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (_) { return ''; }
  };

  return (
    <a
      href={item.link || item.url || '#'}
      target="_blank"
      class="block border border-white/5 hover:border-white/15 rounded p-2.5 transition-all bg-white/[0.02] hover:bg-white/[0.04]"
    >
      <div class="flex items-center justify-between mb-1">
        <span class={`text-[7px] font-black px-1.5 py-0.5 bg-white/5 uppercase ${colorText}`}>
          {item.publisher || item.source || 'NEWS'}
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
}

export default function LeadershipTrailPanel(props) {
  const companies = () => props.companies || [];

  return (
    <div class={`grid gap-6`} style={{ 'grid-template-columns': `repeat(${companies().length}, 1fr)` }}>
      <For each={companies()}>
        {(comp, i) => {
          const c = colorMap[COLORS[i()]];
          const officers = comp?.fundamental?.snapshot?.companyOfficers?.slice(0, 6) || [];
          const leaderNews = comp?.leadershipNews || [];

          return (
            <div class="flex flex-col gap-4">
              {/* Management Roster */}
              <div class={`border ${c.border} rounded p-3`}>
                <div class={`text-[8px] font-black ${c.text} uppercase tracking-widest mb-3`}>
                  {comp.symbol} — Leadership
                </div>
                <div class="flex flex-col gap-2">
                  <Show when={officers.length === 0}>
                    <div class="text-[8px] italic text-white/20">No leadership data available.</div>
                  </Show>
                  <For each={officers}>
                    {(officer) => (
                      <div class="border-b border-white/5 pb-2 last:border-0">
                        <div class="font-bold text-[10px] text-white">{officer.name || '—'}</div>
                        <div class="text-[8px] text-white/30 font-bold uppercase tracking-wide">{officer.title || '—'}</div>
                        <Show when={officer.totalPay}>
                          <div class="text-[7px] font-mono text-white/20 mt-0.5">
                            Comp: ${Number(officer.totalPay).toLocaleString()}
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Leadership News Trail */}
              <div class="flex flex-col gap-2">
                <div class={`text-[8px] font-black ${c.text} uppercase tracking-widest border-b border-white/5 pb-1`}>
                  Leadership Intelligence Trail ({leaderNews.length})
                </div>
                <div class="flex flex-col gap-2 max-h-[280px] overflow-y-auto win-scroll pr-1">
                  <Show when={leaderNews.length === 0}>
                    <div class="text-[8px] italic text-white/20 py-3 text-center">No leadership news found.</div>
                  </Show>
                  <For each={leaderNews.slice(0, 6)}>
                    {(item) => <NewsCard item={item} colorText={c.text} />}
                  </For>
                </div>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
