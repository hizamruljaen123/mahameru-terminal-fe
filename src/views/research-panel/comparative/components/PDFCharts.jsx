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

// ─── SVG Candlestick + Overlays (PDF-safe) ───
export function SparklinePDF(props) {
  const data = () => props.data || [];
  const ta = () => props.ta || {};
  const isFull = () => props.type === 'full';
  
  const w = () => props.width || (isFull() ? 300 : 200);
  const h = () => props.height || (isFull() ? 100 : 50);

  const getMinMax = () => {
    const d = data().slice(-60); // Last 60 days
    if (d.length === 0) return { min: 0, max: 1 };
    
    let prices = d.flatMap(x => [x.high ?? x.High ?? x.close, x.low ?? x.Low ?? x.close]);
    
    // Include TA if present for scaling
    if (ta()?.indicators?.bb?.upper) {
      const bb = ta().indicators.bb;
      prices.push(...bb.upper.slice(-60), ...bb.lower.slice(-60));
    }
    
    prices = prices.filter(v => typeof v === 'number' && v > 0);
    const minVal = prices.length ? Math.min(...prices) * 0.98 : 0;
    const maxVal = prices.length ? Math.max(...prices) * 1.02 : 1;
    return { min: minVal, max: maxVal };
  };

  const stats = () => getMinMax();
  const range = () => (stats().max - stats().min) || 1;

  const scaleY = (val) => h() - ((val - stats().min) / range()) * h();
  const scaleX = (i, total) => (i / (total - 1)) * w();

  const candles = () => {
    const d = data().slice(-60);
    const n = d.length;
    if (n < 2) return [];
    return d.map((item, i) => {
      const open = item.open ?? item.Open ?? item.close;
      const close = item.close ?? item.Close ?? item.open;
      const high = item.high ?? item.High ?? Math.max(open, close);
      const low = item.low ?? item.Low ?? Math.min(open, close);
      
      const x = scaleX(i, n);
      const yOpen = scaleY(open);
      const yClose = scaleY(close);
      const yHigh = scaleY(high);
      const yLow = scaleY(low);
      
      return {
        x,
        y1: Math.min(yOpen, yClose),
        h: Math.abs(yOpen - yClose) || 0.5,
        yh1: yHigh,
        yh2: yLow,
        isUp: close >= open
      };
    });
  };

  const renderPath = (arr, color, width = 1, dashed = false) => {
    if (!arr || arr.length < 2) return null;
    const d = arr.slice(-60).map((v, i) => {
      const x = scaleX(i, 60);
      const y = scaleY(v);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
    return <path d={d} fill="none" stroke={color} stroke-width={width} stroke-dasharray={dashed ? "2,2" : "none"} />;
  };

  return (
    <div style="break-inside: avoid; page-break-inside: avoid; margin-bottom: 10px;">
      <Show when={props.label}>
        <div style="font-size: 8px; font-weight: 800; color: #334155; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.05em;">{props.label}</div>
      </Show>
      <div style={`position: relative; width: ${w()}px; height: ${h()}px; background: #f8fafc; border: 1px solid #e2e8f0;`}>
        <svg width={w()} height={h()} style="display: block; overflow: visible;">
          {/* BB Area */}
          <Show when={isFull() && ta()?.indicators?.bb}>
             {(() => {
                const bb = ta().indicators.bb;
                const up = bb.upper.slice(-60);
                const lo = bb.lower.slice(-60);
                let path = `M ${scaleX(0, 60)} ${scaleY(up[0])} `;
                for(let i=1; i<up.length; i++) path += `L ${scaleX(i, 60)} ${scaleY(up[i])} `;
                for(let i=lo.length-1; i>=0; i--) path += `L ${scaleX(i, 60)} ${scaleY(lo[i])} `;
                path += 'Z';
                return <path d={path} fill="#e2e8f0" opacity="0.4" />;
             })()}
          </Show>

          {/* Indicators */}
          <Show when={isFull() && ta()?.indicators}>
            {renderPath(ta().indicators.sma?.sma20, '#f59e0b', 0.8)}
            {renderPath(ta().indicators.sma?.sma50, '#3b82f6', 0.8)}
            {renderPath(ta().indicators.bb?.upper, '#94a3b8', 0.5, true)}
            {renderPath(ta().indicators.bb?.lower, '#94a3b8', 0.5, true)}
          </Show>

          {/* Candles */}
          <For each={candles()}>
            {(c) => (
              <g>
                <line x1={c.x} y1={c.yh1} x2={c.x} y2={c.yh2} stroke={c.isUp ? '#10b981' : '#ef4444'} stroke-width="0.5" />
                <rect x={c.x - 1.5} y={c.y1} width="3" height={c.h} fill={c.isUp ? '#10b981' : '#ef4444'} />
              </g>
            )}
          </For>
        </svg>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 3px;">
        <div style="font-size: 7px; color: #94a3b8; font-family: monospace;">{stats().min.toFixed(2)}</div>
        <div style="font-size: 7px; color: #94a3b8; font-family: monospace;">{stats().max.toFixed(2)}</div>
      </div>
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
