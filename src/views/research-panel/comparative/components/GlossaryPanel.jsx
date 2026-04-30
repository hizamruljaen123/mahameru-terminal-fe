import { For, Show } from 'solid-js';
import { GLOSSARY } from '../constants/glossary';

export default function GlossaryPanel() {
  return (
    <div class="flex flex-col gap-8">
      <div class="border-b border-slate-200 pb-4">
        <h2 class="text-xl font-black text-slate-800 uppercase tracking-wider">Glossary of Financial Terms</h2>
        <p class="text-sm text-slate-500 mt-1">Reference definitions for all analytical terminology used in this institutional research report.</p>
      </div>

      <For each={GLOSSARY}>
        {(section) => (
          <div class="flex flex-col gap-4">
            <h3 class="text-[11px] font-black text-sky-600 uppercase tracking-[0.3em] border-b-2 border-sky-100 pb-2">
              {section.group}
            </h3>
            <div class="grid grid-cols-1 gap-3">
              <For each={section.terms}>
                {(item) => (
                  <div class="flex gap-4 py-2 border-b border-slate-100 last:border-0">
                    <div class="min-w-[220px] shrink-0">
                      <span class="text-[11px] font-black text-slate-800">{item.term}</span>
                    </div>
                    <p class="text-[11px] text-slate-500 leading-relaxed">{item.def}</p>
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>

      <div class="border-t border-slate-200 pt-4 text-[9px] text-slate-300 font-mono text-center">
        © Asetpedia Institutional Intelligence · This glossary is for informational purposes only.
        All definitions reflect standard industry conventions as of the report date.
      </div>
    </div>
  );
}
