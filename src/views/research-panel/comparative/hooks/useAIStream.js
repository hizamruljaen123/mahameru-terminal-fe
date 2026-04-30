import { createSignal } from 'solid-js';
import { buildSystemPrompt, buildStagePrompt } from '../constants/promptTemplates';

const RESEARCH_API = import.meta.env.VITE_RESEARCH_API;
const TOTAL_STAGES = 7;

/**
 * Handles sequential AI stage streaming via SSE from the backend.
 */
export function useAIStream() {
  const [reports, setReports] = createSignal({});
  const [currentStage, setCurrentStage] = createSignal(0);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [streamProgress, setStreamProgress] = createSignal(0);

  const loadMarked = () => new Promise(resolve => {
    if (window.marked) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });

  const runAnalysis = async (symbols, fullData, model = 'deepseek-v4-flash', language = 'en', onLog) => {
    setIsStreaming(true);
    setReports({});
    setCurrentStage(0);
    setStreamProgress(0);
    await loadMarked();

    const generatedStages = {};

    for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
      setCurrentStage(stage);
      onLog?.(`Generating Stage ${stage}/${TOTAL_STAGES}: ${getStageName(stage, language)}...`);
      setStreamProgress(Math.round((stage - 1) / TOTAL_STAGES * 100));

      const systemPrompt = buildSystemPrompt(language);
      const userPrompt = buildStagePrompt(stage, symbols, fullData, generatedStages, language);

      try {
        const res = await fetch(`${RESEARCH_API}/api/analyze/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbols,
            stage,
            model,
            system_prompt: systemPrompt,
            user_prompt: userPrompt,
            full_data: fullData,
            generated_stages: generatedStages,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let stageText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf('\n');
          while (boundary !== -1) {
            const line = buffer.substring(0, boundary).trim();
            buffer = buffer.substring(boundary + 1);

            if (line.startsWith('data: ')) {
              try {
                const obj = JSON.parse(line.substring(6));
                if (obj.content) {
                  stageText += obj.content;
                  const rendered = window.marked ? window.marked.parse(stageText) : stageText;
                  setReports(prev => ({ ...prev, [stage]: rendered }));
                }
              } catch (_) {}
            }
            boundary = buffer.indexOf('\n');
          }
        }

        generatedStages[stage] = stageText;
        onLog?.(`Stage ${stage} complete.`);
      } catch (e) {
        onLog?.(`Stage ${stage} error: ${e.message}`);
        generatedStages[stage] = `*Error generating this section: ${e.message}*`;
      }
    }

    setStreamProgress(100);
    setCurrentStage(0);
    setIsStreaming(false);
    onLog?.('✓ Full analysis synthesis complete.');
    return generatedStages;
  };

  return { reports, currentStage, isStreaming, streamProgress, runAnalysis };
}

function getStageName(stage, language = 'en') {
  const isId = language === 'id';
  const names = {
    1: isId ? 'Ringkasan Eksekutif & Model Bisnis' : 'Executive Summary & Business Model',
    2: isId ? 'Analisis Teknikal' : 'Technical Analysis',
    3: isId ? 'Bedah Fundamental' : 'Fundamental Deep Dive',
    4: isId ? 'Matriks Scorecard Komparatif' : 'Comparative Scorecard Matrix',
    5: isId ? 'Intelijen Sinyal Berita' : 'News Signal Intelligence',
    6: isId ? 'Kepemimpinan & Risiko Hukum' : 'Leadership & Legal Risk',
    7: isId ? 'ESG & Keputusan Investasi' : 'ESG & Investment Decision',
  };
  return names[stage] || `Stage ${stage}`;
}
