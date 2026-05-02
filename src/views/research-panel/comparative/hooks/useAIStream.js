import { createSignal } from 'solid-js';
import { buildSystemPrompt, buildStagePrompt, hasBankingSymbol, detectSectorFromData } from '../constants/enhancedPrompt';

const RESEARCH_API = import.meta.env.VITE_RESEARCH_API;
const TOTAL_STAGES = 8;

/**
 * Handles sequential AI stage streaming via SSE from the backend.
 * UPDATED: Passes symbols to buildSystemPrompt for banking sector detection,
 * and supports chain prompting workflow (Prompt A/B/C/D grouping).
 */
export function useAIStream() {
  const [reports, setReports] = createSignal({});
  const [currentStage, setCurrentStage] = createSignal(0);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [streamProgress, setStreamProgress] = createSignal(0);
  const [thinking, setThinking] = createSignal('');

  const loadMarked = () => new Promise(resolve => {
    if (window.marked) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });

  /**
   * Chain prompting grouping:
   * Prompt A = Stages 1-3 (Business Model, Technical, Fundamental)
   * Prompt B = Stages 4-5 (Scorecard, Sentiment)
   * Prompt C = Stage 6 (Leadership & Legal)
   * Prompt D = Stage 8 (Reconciliation & Final Synthesis)
   * Stage 7 (ESG) runs standalone
   */
  const getChainGroup = (stage) => {
    if (stage >= 1 && stage <= 3) return 'A';
    if (stage >= 4 && stage <= 5) return 'B';
    if (stage === 6) return 'C';
    if (stage === 8) return 'D';
    return null; // Stage 7 standalone
  };

  const runAnalysis = async (symbols, fullData, model = 'deepseek-v4-flash', language = 'en', onLog, caveman = false) => {
    setIsStreaming(true);
    setReports({});
    setCurrentStage(0);
    setStreamProgress(0);
    await loadMarked();

    const generatedStages = {};
    const isBanking = hasBankingSymbol(symbols);
    // Detect sector from yfinance data to calibrate KPI weights
    const detectedSector = detectSectorFromData(fullData, symbols);

    // Extract infrastructure proximity data per symbol
    const infraData = {};
    for (const sym of symbols) {
      const symData = fullData[sym];
      if (symData && symData.infrastructure) {
        infraData[sym] = symData.infrastructure;
      }
    }

    for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
      setCurrentStage(stage);
      onLog?.(`Generating Stage ${stage}/${TOTAL_STAGES}: ${getStageName(stage, language)}...`);
      setStreamProgress(Math.round((stage - 1) / TOTAL_STAGES * 100));

      // Pass symbols to buildSystemPrompt for banking sector detection
      const systemPrompt = buildSystemPrompt(language, stage, symbols);
      const userPrompt = buildStagePrompt({
        stage,
        symbols,
        fullData,
        generatedStages,
        language,
        sector: detectedSector,  // Pass detected sector for calibrated KPI weights
        infrastructure: Object.keys(infraData).length > 0 ? infraData : null  // Pass infra proximity context
      });

      // For banking symbols, add chain prompting context to user prompt
      let enhancedUserPrompt = userPrompt;
      if (isBanking) {
        const chainGroup = getChainGroup(stage);
        if (chainGroup === 'A' && stage === 1) {
          enhancedUserPrompt = `[PROMPT A - Stages 1-3]\n\n${userPrompt}\n\nATURAN KHUSUS:\n- Stage 2: Jika tidak ada data Volume, DILARANG menganalisis Wyckoff. Batasi hanya pada Support/Resistance, RSI, ADX, dan Risk/Reward.\n- Stage 3: Fokus analisis pada NIM, NPL, LDR, BOPO, dan P/B vs ROE. Abaikan analisis DuPont jika tidak ada Total Aset.`;
        } else if (chainGroup === 'B' && stage === 4) {
          enhancedUserPrompt = `[PROMPT B - Stages 4-5]\n\n${userPrompt}\n\nATURAN KHUSUS:\n- Stage 4: Buat tabel scorecard dengan total bobot PASTI 100%. Jangan memberikan skor numerik pada variabel yang datanya kosong (beri tanda strip "-").\n- Stage 5: Ekstrak hanya fakta spesifik dari berita, jangan membuat generalisasi luas.`;
        } else if (chainGroup === 'C' && stage === 6) {
          enhancedUserPrompt = `[PROMPT C - Stage 6]\n\n${userPrompt}\n\nATURAN KHUSUS:\n- Terapkan ATURAN ANOMALI dari System Instruction. Jika ada nama yang sama di dua perusahaan, wajib jadikan Red Flag utama.\n- Jika tidak ada data kompensasi atau buyback, tulis "[DATA TIDAK TERSEDIA]". Jangan mengarang skor Kualitas Kepemimpinan.`;
        } else if (chainGroup === 'D' && stage === 8) {
          enhancedUserPrompt = `[PROMPT D - REKONSILIASI & STAGE 8 FINAL]\n\n${userPrompt}\n\nSEBELUM MENULIS, LAKUKAN REKONSILIASI:\n1. Jika Stage 2 (Teknikal) mendukung BMRI, tapi Stage 3 (Fundamental) mendukung BBRI, Anda TIDAK BOLEH memaksa memilih salah satu secara buta.\n2. Buat SINTESIS: Misalnya, "BBRI untuk akumulasi jangka panjang (Core Holding), BMRI untuk trading jangka pendek (Tactical Position)".\n3. Jika di Stage 6 ada Red Flag Hukum, hal itu WAJIB menurunkan rekomendasi akhir atau menambahkan syarat.`;
        }
      }

      try {
        const res = await fetch(`${RESEARCH_API}/api/analyze/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbols,
            stage,
            model,
            system_prompt: systemPrompt,
            user_prompt: enhancedUserPrompt,
            generated_stages: generatedStages,
            caveman: caveman
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let stageText = '';
        let buffer = '';
        let currentThinkingText = '';
        let isInsideThinkTag = false;

        while (true) {
          const { done, value } = await reader.read();

          if (value) {
            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.indexOf('\n');
            while (boundary !== -1) {
              const line = buffer.substring(0, boundary).trim();
              buffer = buffer.substring(boundary + 1);

              if (line.startsWith('data: ')) {
                try {
                  const obj = JSON.parse(line.substring(6));

                  // Handle explicit thinking property (DeepSeek R1 style)
                  if (obj.thinking) {
                    currentThinkingText += obj.thinking;
                    setThinking(currentThinkingText);
                  }

                  if (obj.content) {
                    let content = obj.content;

                    // Handle <think> tags in content
                    if (content.includes('<think>')) {
                      isInsideThinkTag = true;
                      const parts = content.split('<think>');
                      stageText += parts[0]; // Content before tag
                      content = parts[1] || '';
                    }

                    if (isInsideThinkTag) {
                      if (content.includes('</think>')) {
                        isInsideThinkTag = false;
                        const parts = content.split('</think>');
                        currentThinkingText += parts[0];
                        setThinking(currentThinkingText);
                        content = parts[1] || '';
                      } else {
                        currentThinkingText += content;
                        setThinking(currentThinkingText);
                        content = ''; // All is thinking
                      }
                    }

                    if (content) {
                      stageText += content;
                      const rendered = window.marked ? window.marked.parse(stageText) : stageText;
                      setReports(prev => ({ ...prev, [stage]: rendered }));
                    }
                  } else if (obj.error) {
                    onLog?.(`Stage ${stage} API Error: ${obj.error}`);
                  }
                } catch (_) { }
              }
              boundary = buffer.indexOf('\n');
            }
          }

          if (done) break;
        }

        generatedStages[stage] = stageText;
        onLog?.(`Stage ${stage} complete.`);
        // Reset thinking for next stage
        currentThinkingText = '';
        setThinking('');
      } catch (e) {
        onLog?.(`Stage ${stage} error: ${e.message}`);
        generatedStages[stage] = `*Error generating this section: ${e.message}*`;
      }
    }

    setStreamProgress(100);
    setCurrentStage(0);
    setIsStreaming(false);
    setThinking('');
    onLog?.('✓ Full analysis synthesis complete.');
    return generatedStages;
  };

  return { reports, setReports, currentStage, setCurrentStage, isStreaming, setIsStreaming, streamProgress, setStreamProgress, thinking, runAnalysis };
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
    8: isId ? 'Sintesis One-Pager Institusional' : 'Institutional One-Pager Synthesis',
  };
  return names[stage] || `Stage ${stage}`;
}
