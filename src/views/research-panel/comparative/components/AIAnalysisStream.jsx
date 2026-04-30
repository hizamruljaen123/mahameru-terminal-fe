import { Show } from 'solid-js';

/**
 * Renders a streaming AI stage content with a Markdown-parsed innerHTML.
 * Shows a live typing cursor while streaming.
 */
export default function AIAnalysisStream(props) {
  // props: content (HTML string), isActive (bool), stageNum, stageTitle
  return (
    <div class={`transition-all duration-300 ${props.isActive ? 'opacity-100' : 'opacity-70'}`}>
      <Show when={props.isActive}>
        <div class="flex items-center gap-2 mb-3 px-1">
          <div class="flex gap-1">
            <span class="w-1 h-3 bg-text_accent animate-[pulse_0.6s_ease-in-out_infinite]" />
            <span class="w-1 h-3 bg-text_accent animate-[pulse_0.6s_ease-in-out_0.2s_infinite]" />
            <span class="w-1 h-3 bg-text_accent animate-[pulse_0.6s_ease-in-out_0.4s_infinite]" />
          </div>
          <span class="text-[8px] font-black text-text_accent uppercase tracking-widest animate-pulse">
            AI SYNTHESIZING STAGE {props.stageNum}...
          </span>
        </div>
      </Show>

      <Show when={props.content}>
        <div
          id={`ai-stage-${props.stageNum}`}
          innerHTML={props.content}
          class="ai-stage-content text-justify"
        />
      </Show>

      <Show when={!props.content && !props.isActive}>
        <div class="h-8 flex items-center gap-2 text-white/15">
          <span class="w-1.5 h-1.5 rounded-full bg-white/10" />
          <span class="text-[8px] font-mono uppercase tracking-widest">Pending synthesis...</span>
        </div>
      </Show>
    </div>
  );
}
