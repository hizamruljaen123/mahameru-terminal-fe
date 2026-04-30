/**
 * PDF-safe static chart components.
 * Uses pure SVG/HTML — no canvas, no ECharts.
 * html2pdf uses html2canvas which cannot capture WebGL/canvas-rendered ECharts.
 * All components render as pure DOM elements captured correctly by html2canvas.
 */

import { For, Show } from 'solid-js';

const COMP_COLORS = ['#0ea5e9', '#f59e0b', '#10b981'];

// ─── Horizontal Bar Chart (multi-metric, multi-company) ───
export function BarChartPDF(props) {
  // props: { title, data: [{ label, values: [v_a, v_b, v_c] }], unit }
  const data = () => props.data || [];
  const unit = () => props.unit || '';
  const allVals = () => data().flatMap(d => d.values).filter(v => v != null && !isNaN(v));
  const maxVal = () => Math.max(...allVals(), 1);

  return (
    <div style="margin: 1.2rem 0; break-inside: avoid; page-break-inside: avoid;">
      <div style="font-size: 9px; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; border-left: 3px solid #0ea5e9; padding-left: 8px;">
        {props.title}
      </div>
      <div style="display: flex; flex-direction: column; gap: 5px;">
        <For each={data()}>
          {(row) => (
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <div style="width: 100px; font-size: 8px; color: #64748b; font-weight: 600; padding-top: 2px; flex-shrink: 0; text-align: right;">
                {row.label}
              </div>
              <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                <For each={row.values}>
                  {(val, i) => {
                    if (val == null || isNaN(val)) return null;
                    const pct = Math.max((val / maxVal()) * 100, 2);
                    const color = COMP_COLORS[i()] || '#94a3b8';
                    return (
                      <div style="display: flex; align-items: center; gap: 4px;">
                        <div style={`height: 11px; width: ${pct.toFixed(1)}%; background: ${color}; border-radius: 1px; min-width: 2px;`} />
                        <span style={`font-size: 8px; font-weight: 700; color: ${color};`}>
                          {typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val}{unit()}
                        </span>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// ─── SVG Sparkline (PDF-safe — uses SVG polyline, not canvas) ───
export function SparklinePDF(props) {
  const vals = () => (props.data || []).map(d => d.close || d.Close || d.value || 0).filter(v => !isNaN(v));
  const w = () => props.width || 200;
  const h = () => props.height || 50;

  const points = () => {
    const v = vals();
    if (v.length < 2) return '';
    const min = Math.min(...v);
    const max = Math.max(...v);
    const range = max - min || 1;
    return v.map((val, i) => {
      const x = (i / (v.length - 1)) * w();
      const y = h() - ((val - min) / range) * (h() - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  const chgPct = () => {
    const v = vals();
    if (v.length < 2) return null;
    return ((v[v.length - 1] - v[0]) / v[0] * 100).toFixed(1);
  };

  return (
    <div style="break-inside: avoid; page-break-inside: avoid; margin-bottom: 6px;">
      <Show when={props.label}>
        <div style="font-size: 8px; font-weight: 700; color: #475569; margin-bottom: 3px;">{props.label}</div>
      </Show>
      <Show when={vals().length >= 2} fallback={<div style="font-size: 8px; color: #cbd5e1; font-style: italic;">No price data</div>}>
        <svg width={w()} height={h()} style="display: block; overflow: visible;">
          <polyline
            points={points()}
            fill="none"
            stroke={props.color || '#0ea5e9'}
            stroke-width="1.5"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>
        <Show when={chgPct() !== null}>
          <div style={`font-size: 8px; font-weight: 800; color: ${Number(chgPct()) >= 0 ? '#10b981' : '#ef4444'};`}>
            {Number(chgPct()) >= 0 ? '▲' : '▼'} {Math.abs(Number(chgPct()))}% (period)
          </div>
        </Show>
      </Show>
    </div>
  );
}

// ─── Financial comparison table ───
export function FinancialTablePDF(props) {
  // props: { title, rows: [{ metric, values: [val_a, val_b, val_c] }], companies: [{symbol}] }
  const rows = () => props.rows || [];
  const companies = () => props.companies || [];

  return (
    <div style="margin: 1.2rem 0; break-inside: avoid; page-break-inside: avoid;">
      <div style="font-size: 9px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0;">
        {props.title}
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 8.5px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 5px 8px; text-align: left; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0;">Metric</th>
            <For each={companies()}>
              {(comp, i) => (
                <th style={`padding: 5px 8px; text-align: right; font-weight: 800; color: ${COMP_COLORS[i()] || '#64748b'}; border-bottom: 1px solid #e2e8f0;`}>
                  {comp.symbol}
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={rows()}>
            {(row, ri) => (
              <tr style={ri() % 2 === 0 ? 'background: #f8fafc;' : ''}>
                <td style="padding: 4px 8px; color: #64748b; font-weight: 600;">{row.metric}</td>
                <For each={row.values}>
                  {(v, i) => (
                    <td style={`padding: 4px 8px; text-align: right; font-weight: 600; color: #475569;`}>
                      {v ?? '—'}
                    </td>
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
