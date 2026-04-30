import { For, Show } from 'solid-js';

const COLORS = ['sky', 'amber', 'emerald'];
const colorMap = {
  sky: { text: 'text-sky-400', bg: 'bg-sky-400', border: 'border-sky-400/30' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-400', border: 'border-amber-400/30' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-400/30' },
};

export default function NewsSignalPanel(props) {
  const companies = () => props.companies || [];

  const formatDate = (ts) => {
    if (!ts) return '';
    try { return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch (_) { return ''; }
  };

  const getSentimentColor = (s = '') => {
    const u = s.toUpperCase();
    if (u === 'POSITIVE') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    if (u === 'NEGATIVE') return 'text-red-400 bg-red-400/10 border-red-400/20';
    return 'text-white/30 bg-white/5 border-white/10';
  };

  return (
    <div class="flex flex-col gap-6">
      {/* Sentiment Summary Row */}
      <div class={`grid gap-4`} style={{ 'grid-template-columns': `repeat(${companies().length}, 1fr)` }}>
        <For each={companies()}>
          {(comp, i) => {
            const c = colorMap[COLORS[i()]];
            const sent = comp?.sentiment;
            const overall = sent?.overall_sentiment || sent?.sentiment || 'N/A';
            const score = sent?.score ?? sent?.sentiment_score;
            return (
              <div class={`border ${c.border} rounded p-3`}>
                <div class={`text-[9px] font-black ${c.text} uppercase tracking-widest mb-2`}>{comp.symbol} — Sentiment</div>
                <div class={`inline-flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-black ${getSentimentColor(overall)}`}>
                  {overall.toUpperCase()}
                </div>
                <Show when={score !== undefined}>
                  <div class="text-[8px] font-mono text-white/30 mt-1">Score: {Number(score).toFixed(3)}</div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* Latest News Side by Side */}
      <div class={`grid gap-6`} style={{ 'grid-template-columns': `repeat(${companies().length}, 1fr)` }}>
        <For each={companies()}>
          {(comp, i) => {
            const c = colorMap[COLORS[i()]];
            const news = comp?.news || [];
            const projectNews = comp?.projectNews || [];
            
            const sectorNews = comp?.sectorNews || [];
            
            return (
              <div class="flex flex-col gap-6">
                {/* General Feed */}
                <div class="flex flex-col gap-2">
                  <div class={`text-[8px] font-black ${c.text} uppercase tracking-widest border-b border-white/5 pb-1`}>
                    {comp.symbol} — General Feed ({news.length})
                  </div>
                  <div class="flex flex-col gap-2 max-h-[180px] overflow-y-auto win-scroll pr-1">
                    <Show when={news.length === 0}>
                      <div class="text-[8px] italic text-white/20 py-4 text-center">No news data available.</div>
                    </Show>
                    <For each={news.slice(0, 8)}>
                      {(item) => (
                        <NewsCard item={item} colorText={c.text} />
                      )}
                    </For>
                  </div>
                </div>

                {/* Sector Intelligence Feed */}
                <div class="flex flex-col gap-2">
                  <div class={`text-[8px] font-black text-amber-400/70 uppercase tracking-widest border-b border-white/5 pb-1`}>
                    Sector Intel (Local & Global) ({sectorNews.length})
                  </div>
                  <div class="flex flex-col gap-2 max-h-[180px] overflow-y-auto win-scroll pr-1">
                    <Show when={sectorNews.length === 0}>
                      <div class="text-[8px] italic text-white/20 py-4 text-center">No sector news found.</div>
                    </Show>
                    <For each={sectorNews.slice(0, 8)}>
                      {(item) => (
                        <NewsCard item={item} colorText="text-amber-300" />
                      )}
                    </For>
                  </div>
                </div>

                {/* Project/Future Feed */}
                <div class="flex flex-col gap-2">
                  <div class={`text-[8px] font-black text-sky-400/70 uppercase tracking-widest border-b border-white/5 pb-1`}>
                    Strategic Expansion & Projects ({projectNews.length})
                  </div>
                  <div class="flex flex-col gap-2 max-h-[180px] overflow-y-auto win-scroll pr-1">
                    <Show when={projectNews.length === 0}>
                      <div class="text-[8px] italic text-white/20 py-4 text-center">No project news found.</div>
                    </Show>
                    <For each={projectNews.slice(0, 8)}>
                      {(item) => (
                        <NewsCard item={item} colorText="text-sky-300" />
                      )}
                    </For>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

function NewsCard({ item, colorText }) {
  const formatDate = (ts) => {
    if (!ts) return '';
    try { return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch (_) { return ''; }
  };

  return (
    <a
      href={item.link || item.url || '#'}
      target="_blank"
      class="block border border-white/5 hover:border-white/15 rounded p-2.5 transition-all cursor-pointer bg-white/[0.02] hover:bg-white/[0.04]"
    >
      <div class="flex items-center justify-between mb-1">
        <span class={`text-[7px] font-black px-1.5 py-0.5 rounded-sm ${colorText} bg-white/5 uppercase`}>
          {item.publisher || item.source || 'NEWS'}
        </span>
        <span class="text-[7px] font-mono text-white/20">{formatDate(item.time || item.timestamp)}</span>
      </div>
      <div class="text-[9px] font-bold text-white/80 leading-snug transition-colors">
        {item.title}
      </div>
      <Show when={item.description}>
        <div class="text-[8px] text-white/40 mt-1.5 leading-relaxed line-clamp-3 font-medium">
          {item.description.replace(/<[^>]*>?/gm, '')}
        </div>
      </Show>
    </a>
  );
}
