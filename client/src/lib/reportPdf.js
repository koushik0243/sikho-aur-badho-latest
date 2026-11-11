import { niceMax } from '../Components/SuperAdmin/Reports/reportFormat';

// Shared A4 layout for the report PDFs.
// jsPDF's built-in Helvetica covers Latin text only, so text goes through `plain()`,
// and amounts use "Rs.". Anything outside that (Hindi, other scripts, ₹ …) is drawn
// by the browser on a canvas — which shapes every script correctly — and placed in
// the PDF as a sharp image at the same size and position.

export const plain = (text) => String(text ?? '')
  .replace(/[–—−]/g, '-').replace(/[·•]/g, '|').replace(/…/g, '...')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

const PW = 210, PH = 297, ML = 14, MR = PW - 14, CW = MR - ML, BOTTOM = PH - 16;
const TEAL = [13, 148, 136], TEAL_DARK = [15, 118, 110], TEAL_LIGHT = [240, 253, 250];
const INK = [17, 24, 39], INK2 = [75, 85, 99], MUTED = [107, 114, 128], LINE = [229, 231, 235], SOFT = [243, 244, 246];

const PT_MM = 25.4 / 72;   // 1 pt in mm
const PX_MM = 25.4 / 96;   // 1 CSS px in mm
const LINE_FACTOR = 1.15;  // jsPDF's default line height
const SCALE = 3;           // canvas oversampling, so image text stays sharp in print
const CANVAS_FONTS = 'Helvetica, Arial, "Nirmala UI", "Noto Sans Devanagari", "Mangal", "Noto Sans", sans-serif';

/** True when Helvetica can draw the text itself. */
const isLatin = (t) => !/[^\x00-\xFF]/.test(t);

/**
 * @param {{ title: string, subtitle: string, rightLines?: string[] }} header
 * @returns builder: tiles, note, section, columnChart, splitBar, table, empty, save — y advances as you add.
 */
export async function createReportPdf({ title, subtitle, rightLines = [] }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = 0;

  // ── Text layer ────────────────────────────────────────
  const cur = { style: 'normal', size: 10, color: INK };
  const ctx = document.createElement('canvas').getContext('2d');
  const cssFont = (style, size, scale = 1) => `${style === 'italic' ? 'italic ' : ''}${style === 'bold' ? 700 : 400} ${size * scale}pt ${CANVAS_FONTS}`;
  const font = (style, size, color = INK) => {
    Object.assign(cur, { style, size, color });
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color);
  };
  /** Width of a string in mm, in the current font. */
  const widthOf = (t) => {
    if (isLatin(t)) return doc.getTextWidth(t);
    ctx.font = cssFont(cur.style, cur.size);
    return ctx.measureText(t).width * PX_MM;
  };
  /** The text cut to `width` mm with "..." when it does not fit. */
  const fit = (text, width) => {
    let t = plain(text);
    if (widthOf(t) <= width) return t;
    while (t.length > 1 && widthOf(`${t}...`) > width) t = t.slice(0, -1);
    return `${t}...`;
  };
  /** Wraps text to lines no wider than `width` mm (explicit \n breaks are kept). */
  const wrap = (text, width) => {
    const t = plain(text);
    if (isLatin(t)) return doc.splitTextToSize(t, width);
    const out = [];
    for (const para of t.split('\n')) {
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        const next = line + word;
        if (!line || widthOf(next.trimEnd()) <= width) { line = next; continue; }
        out.push(line.trimEnd());
        line = word.trimStart();
        while (widthOf(line) > width && line.length > 1) { // a single word longer than the line
          let cut = line.length;
          while (cut > 1 && widthOf(line.slice(0, cut)) > width) cut -= 1;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      }
      out.push(line.trimEnd());
    }
    return out;
  };
  /** One non-Latin line as an image; (x, y) is the baseline like doc.text. Same text + style → same image. */
  const images = new Map();
  const drawImageLine = (t, x, baseY, align) => {
    const sizePx = cur.size * (96 / 72);
    const key = `${cur.style}|${cur.size}|${cur.color.join(',')}|${t}`;
    if (images.has(key)) {
      const im = images.get(key);
      const left = align === 'right' ? x - im.wMm + PX_MM : align === 'center' ? x - im.wMm / 2 : x - PX_MM;
      doc.addImage(im.alias, 'PNG', left, baseY - im.ascentMm, im.wMm, im.hMm, im.alias, 'FAST');
      return;
    }
    ctx.font = cssFont(cur.style, cur.size, SCALE);
    const wPx = Math.ceil(ctx.measureText(t).width) + 2 * SCALE;
    const hPx = Math.ceil(sizePx * 1.5 * SCALE);
    const c = document.createElement('canvas');
    c.width = Math.max(1, wPx); c.height = hPx;
    const cx = c.getContext('2d');
    cx.font = cssFont(cur.style, cur.size, SCALE);
    cx.fillStyle = `rgb(${cur.color.join(',')})`;
    cx.textBaseline = 'alphabetic';
    const ascentPx = sizePx * 1.1 * SCALE;
    cx.fillText(t, SCALE, ascentPx);
    const wMm = (wPx / SCALE) * PX_MM, hMm = (hPx / SCALE) * PX_MM;
    const left = align === 'right' ? x - wMm + PX_MM : align === 'center' ? x - wMm / 2 : x - PX_MM;
    const alias = `txt${images.size}`;
    const ascentMm = (ascentPx / SCALE) * PX_MM;
    doc.addImage(c.toDataURL('image/png'), 'PNG', left, baseY - ascentMm, wMm, hMm, alias, 'FAST');
    images.set(key, { alias, wMm, hMm, ascentMm });
  };
  /** Draws a string or lines at baseline (x, y), choosing Helvetica or an image per line. */
  const draw = (textOrLines, x, baseY, opts = {}) => {
    const lines = (Array.isArray(textOrLines) ? textOrLines : [textOrLines]).map(plain);
    if (lines.every(isLatin)) { doc.text(lines.length === 1 ? lines[0] : lines, x, baseY, { lineHeightFactor: LINE_FACTOR, ...opts }); return; }
    const step = cur.size * LINE_FACTOR * PT_MM;
    lines.forEach((line, i) => {
      if (isLatin(line)) doc.text(line, x, baseY + i * step, opts);
      else drawImageLine(line, x, baseY + i * step, opts.align);
    });
  };
  const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = 18; return true; } return false; };

  // Header band
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, PW, 30, 'F');
  font('bold', 18, [255, 255, 255]);
  draw(fit(title, CW - 62), ML, 14);
  font('normal', 9.5, [224, 247, 244]);
  draw(fit(subtitle, CW - 62), ML, 22);
  font('normal', 8.5, [224, 247, 244]);
  rightLines.slice(0, 2).forEach((line, i) => draw(line, MR, 14 + i * 8, { align: 'right' }));
  y = 40;

  const api = {
    CW,
    /** Up to 5 boxes in a row; the first is highlighted. items: [label, value] */
    tiles(items) {
      const gap = 3;
      const tw = (CW - gap * (items.length - 1)) / items.length;
      items.forEach(([label, value], i) => {
        const x = ML + i * (tw + gap);
        doc.setFillColor(...(i === 0 ? TEAL_LIGHT : [249, 250, 251]));
        doc.setDrawColor(...(i === 0 ? [153, 246, 228] : LINE));
        doc.roundedRect(x, y, tw, 22, 2, 2, 'FD');
        font('bold', 7, MUTED);
        draw(fit(String(label).toUpperCase(), tw - 8), x + 4, y + 7);
        font('bold', i === 0 ? 13 : 12, INK);
        draw(fit(value, tw - 8), x + 4, y + 16);
      });
      y += 28;
    },
    /** Muted paragraph, wrapped to the page width. */
    note(text) {
      font('normal', 8, MUTED);
      const lines = wrap(text, CW);
      ensure(lines.length * 4 + 2);
      draw(lines, ML, y);
      y += lines.length * 4 + 5;
    },
    /**
     * Section heading; kept on the same page as the first `keepWith` mm of what
     * follows (default: a table header + two rows; pass more before a chart).
     */
    section(text, keepWith = 30) {
      ensure(keepWith);
      font('bold', 11.5, INK);
      draw(fit(text, CW), ML, y);
      y += 5;
    },
    empty(text) {
      font('normal', 9, MUTED);
      draw(fit(text, CW), ML, y + 4);
      y += 12;
    },
    /**
     * A bar split into parts with a text legend (label, count, %) under it.
     * parts: [{ label, value, rgb: [r,g,b] }]; `title` is an optional small heading.
     */
    splitBar(parts, title) {
      ensure(20);
      if (title) { font('bold', 8, INK2); draw(String(title).toUpperCase(), ML, y); y += 4; }
      const total = parts.reduce((sum, p) => sum + p.value, 0);
      const h = 5;
      doc.setFillColor(...SOFT);
      doc.roundedRect(ML, y, CW, h, 1.5, 1.5, 'F');
      if (total > 0) {
        let x = ML;
        const live = parts.filter(p => p.value > 0);
        live.forEach((p) => {
          const w = (CW - 0.6 * (live.length - 1)) * (p.value / total);
          doc.setFillColor(...p.rgb);
          doc.rect(x, y, w, h, 'F');
          x += w + 0.6;
        });
      }
      y += h + 5;
      let x = ML;
      parts.forEach(p => {
        const text = plain(`${p.label} ${p.value}${total ? ` (${Math.round((p.value / total) * 100)}%)` : ''}`);
        doc.setFillColor(...p.rgb);
        doc.rect(x, y - 2.6, 2.6, 2.6, 'F');
        font('normal', 8.5, INK2);
        draw(text, x + 4, y);
        x += 4 + widthOf(text) + 8;
      });
      y += 8;
    },
    /** One series of columns. data: [{ shortLabel, value }] */
    columnChart(data, { formatAxis, integer = false }) {
      const chartH = 52, axisW = 16, labelH = 6, ticks = 4;
      ensure(chartH + labelH + 6);
      const peakValue = Math.max(...data.map(d => d.value));
      const top = integer ? Math.max(ticks, Math.ceil(peakValue / ticks) * ticks) : niceMax(peakValue);
      const plotX = ML + axisW, plotW = CW - axisW, plotY = y + 4, plotH = chartH - 4;
      for (let i = 0; i <= ticks; i++) {
        const gy = plotY + plotH - (plotH * i) / ticks;
        doc.setDrawColor(...(i === 0 ? [209, 213, 219] : SOFT));
        doc.line(plotX, gy, MR, gy);
        font('normal', 6.5, MUTED);
        draw(formatAxis((top * i) / ticks), plotX - 2, gy + 1.2, { align: 'right' });
      }
      const slot = plotW / data.length;
      const bw = Math.min(8, slot * 0.6);
      const every = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 14)));
      const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
      data.forEach((d, i) => {
        const h = (d.value / top) * plotH;
        const bx = plotX + slot * i + (slot - bw) / 2;
        if (h > 0) {
          doc.setFillColor(...TEAL);
          doc.roundedRect(bx, plotY + plotH - h, bw, h, Math.min(1, h / 2), Math.min(1, h / 2), 'F');
          doc.rect(bx, plotY + plotH - Math.min(h, 1), bw, Math.min(h, 1), 'F'); // square base
        }
        if (i === peak && d.value > 0) {
          font('bold', 6.5, INK2);
          draw(formatAxis(d.value), bx + bw / 2, plotY + plotH - h - 1.5, { align: 'center' });
        }
        if (i % every === 0) {
          font('normal', 6.5, MUTED);
          draw(d.shortLabel, plotX + slot * i + slot / 2, plotY + plotH + 4.5, { align: 'center' });
        }
      });
      y += chartH + labelH + 4;
    },
    /**
     * Table with page breaks; the header row repeats on new pages.
     * cols: [{ label, width (mm; the last column takes what's left if omitted), align: 'right',
     *          wrap?: true (wrap long text over lines instead of cutting it),
     *          color?: (value) => [r,g,b] (text colour for the cell) }]
     */
    table(cols, rows, emptyText) {
      const used = cols.reduce((sum, c) => sum + (c.width || 0), 0);
      const widths = cols.map(c => c.width || CW - used);
      const rowH = 7;
      const header = () => {
        doc.setFillColor(...SOFT);
        doc.rect(ML, y, CW, rowH, 'F');
        font('bold', 7.5, TEAL_DARK);
        let x = ML;
        cols.forEach((c, ci) => {
          const right = c.align === 'right';
          draw(fit(c.label.toUpperCase(), widths[ci] - 3), right ? x + widths[ci] - 2 : x + 2, y + 4.8, { align: right ? 'right' : 'left' });
          x += widths[ci];
        });
        y += rowH;
      };
      if (!rows.length) { api.empty(emptyText); return; }
      ensure(rowH * 2);
      header();
      const LINE_H = 3.7;
      rows.forEach((r, ri) => {
        const cellLines = cols.map((c, ci) => {
          if (!c.wrap) return null;
          font(ci === 0 ? 'bold' : 'normal', 8.5, INK);
          return wrap(r[ci], widths[ci] - 4);
        });
        const h = Math.max(rowH, ...cellLines.map(l => (l ? l.length * LINE_H + 3.4 : 0)));
        if (ensure(h)) header();
        if (ri % 2 === 1) { doc.setFillColor(250, 251, 252); doc.rect(ML, y, CW, h, 'F'); }
        let x = ML;
        cols.forEach((c, ci) => {
          font(ci === 0 ? 'bold' : 'normal', 8.5, c.color?.(r[ci]) || (ci === 0 ? INK : INK2));
          const right = c.align === 'right';
          const text = cellLines[ci] || fit(r[ci], widths[ci] - 4);
          draw(text, right ? x + widths[ci] - 2 : x + 2, y + 4.8, { align: right ? 'right' : 'left' });
          x += widths[ci];
        });
        doc.setDrawColor(...LINE);
        doc.line(ML, y + h, MR, y + h);
        y += h;
      });
      y += 7;
    },
    /** Italic note just under the previous table. */
    tableNote(text) {
      ensure(6);
      font('italic', 8, MUTED);
      draw(fit(text, CW), ML, y - 3);
      y += 4;
    },
    /** Adds the footer (title + "Page x of y") to every page and downloads. */
    save(filename) {
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setDrawColor(...LINE);
        doc.line(ML, PH - 11, MR, PH - 11);
        font('normal', 7.5, MUTED);
        draw(fit(title, CW - 30), ML, PH - 6);
        doc.text(`Page ${p} of ${pages}`, MR, PH - 6, { align: 'right' });
      }
      doc.save(filename);
    },
  };
  return api;
}
