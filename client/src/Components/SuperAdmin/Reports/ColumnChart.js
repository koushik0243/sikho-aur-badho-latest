'use client';

import { useState } from 'react';
import { niceMax } from './reportFormat';
import s from './Report.module.css';

const DEFAULT_HEIGHT = 240;
const PAD = { top: 16, right: 12, bottom: 30, left: 56 };
const MAX_BAR = 24;     // columns never fill their slot
const TICKS = 4;

/**
 * One series of columns over time (no legend — the card title names it).
 * Hover / focus a column for its tooltip.
 * @param {{
 *   data: { key: string, label: string, shortLabel: string, value: number }[],
 *   width: number,
 *   formatValue: (v: number) => string,       full value (tooltip, accessible name)
 *   formatAxis: (v: number) => string,        short value (axis, peak label)
 *   tooltipLines?: (d: object) => string[],   extra tooltip lines
 *   integer?: boolean                         counts: keep axis ticks whole
 *   height?: number                           chart height (defaults to 240; never smaller)
 * }} props
 */
export default function ColumnChart({ data, width, formatValue, formatAxis, tooltipLines, integer = false, height }) {
  const [hover, setHover] = useState(null);
  if (!data.length || !width) return null;
  const HEIGHT = Math.max(DEFAULT_HEIGHT, Math.floor(height || 0));

  const innerW = Math.max(40, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const peakValue = Math.max(...data.map(d => d.value));
  const top = integer ? Math.max(TICKS, Math.ceil(peakValue / TICKS) * TICKS) : niceMax(peakValue);
  const slot = innerW / data.length;
  const barW = Math.min(MAX_BAR, Math.max(1, slot * 0.6)); // thin for long daily series
  const focusable = data.length <= 62; // long series: the table view is the keyboard route
  const y = v => PAD.top + innerH - (v / top) * innerH;
  const every = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 64)));  // thin out labels
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  // 4px rounded top, square base on the baseline.
  const column = (x, y0, h) => {
    if (h <= 0) return '';
    const r = barW >= 4 ? Math.min(4, barW / 2, h) : 0;
    return `M${x},${y0 + h}V${y0 + r}Q${x},${y0} ${x + r},${y0}H${x + barW - r}Q${x + barW},${y0} ${x + barW},${y0 + r}V${y0 + h}Z`;
  };

  const hovered = hover !== null ? data[hover] : null;
  const tipX = hover !== null ? PAD.left + slot * hover + slot / 2 : 0;

  return (
    <div className={s.chartWrap} onMouseLeave={() => setHover(null)}>
      <svg className={s.chart} width={width} height={HEIGHT} role="img"
        aria-label={data.map(d => `${d.label} ${formatValue(d.value)}`).join(', ')}>
        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const v = (top / TICKS) * i;
          const gy = y(v);
          return (
            <g key={i}>
              <line x1={PAD.left} x2={width - PAD.right} y1={gy} y2={gy} className={i === 0 ? s.chartBaseline : s.chartGrid} />
              <text x={PAD.left - 8} y={gy} dy="0.32em" textAnchor="end" className={s.chartAxisText}>{formatAxis(v)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = PAD.left + slot * i + (slot - barW) / 2;
          const h = (d.value / top) * innerH;
          return (
            <g key={d.key}>
              <path d={column(x, y(d.value), h)} className={hover === i ? s.chartBarActive : s.chartBar} />
              {i === peak && d.value > 0 && (
                <text x={x + barW / 2} y={y(d.value) - 6} textAnchor="middle" className={s.chartValueText}>{formatAxis(d.value)}</text>
              )}
              {i % every === 0 && (
                <text x={PAD.left + slot * i + slot / 2} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" className={s.chartAxisText}>{d.shortLabel}</text>
              )}
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent"
                tabIndex={focusable ? 0 : -1} role="button" aria-label={`${d.label}: ${formatValue(d.value)}`}
                onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div className={s.chartTip} role="status"
          style={{ left: Math.min(Math.max(tipX, 80), width - 80), top: Math.max(4, y(hovered.value) - 64) }}>
          <strong>{hovered.label}</strong>
          <span>{formatValue(hovered.value)}</span>
          {(tooltipLines?.(hovered) || []).map(line => <span key={line} className={s.chartTipMuted}>{line}</span>)}
        </div>
      )}
    </div>
  );
}
