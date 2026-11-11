/**
 * @param {object} invoice
 * @param {{ paymentMethodLabel?: (value: string) => string }} [opts] names the
 *   stored payment method (see lib/paymentMethods.js usePaymentMethods).
 */
export async function generateInvoicePDF(invoice, { paymentMethodLabel = v => v || '—' } = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const PW  = 210;
  const PH  = 297;
  const ML  = 14;
  const MR  = PW - 14;
  const CW  = MR - ML;

  const TEAL       = [13, 148, 136];
  const TEAL_DARK  = [15, 118, 110];
  const TEAL_LIGHT = [204, 240, 237];
  const GRAY_900   = [17, 24, 39];
  const GRAY_600   = [75, 85, 99];
  const GRAY_400   = [156, 163, 175];
  const GRAY_200   = [229, 231, 235];
  const WHITE      = [255, 255, 255];

  const cur = invoice.currency || 'INR';
  const sym = cur === 'INR' ? 'Rs.' : cur + ' ';

  function money(val) {
    if (val === null || val === undefined || val === '') return `${sym}0.00`;
    return `${sym}${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function fmt(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d)) return '—';
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }
  function v(val) { return val || '—'; }
  function setFont(style, size, color) {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...(color || GRAY_900));
  }

  let y = 0;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, PW, 42, 'F');

  setFont('bold', 22, WHITE);
  doc.text('LMS PLATFORM', ML, 17);
  setFont('normal', 8.5, [185, 236, 230]);
  doc.text('Learning Management System', ML, 24);

  setFont('bold', 28, WHITE);
  doc.text('INVOICE', MR, 16, { align: 'right' });
  setFont('normal', 9, [185, 236, 230]);
  doc.text(v(invoice.invoice_no), MR, 24, { align: 'right' });

  const status  = (invoice.payment_status || 'pending').toUpperCase();
  const pillW = 26, pillH = 7, pillX = MR - pillW, pillY = 29;
  doc.setFillColor(...WHITE);
  doc.roundedRect(pillX, pillY, pillW, pillH, 2, 2, 'F');
  const pillColors = { PAID: [22,163,74], PENDING: [202,138,4], FAILED: [220,38,38], REFUNDED: [2,132,199] };
  const pc = pillColors[status] || [107,114,128];
  setFont('bold', 7.5, pc);
  doc.text(status, pillX + pillW / 2, pillY + 4.7, { align: 'center' });

  y = 50;

  // ── Bill-to + Invoice details ────────────────────────────────────────────────
  const colMid = ML + CW / 2 + 4;

  setFont('bold', 7, TEAL);
  doc.text('BILLED TO', ML, y);
  doc.text('INVOICE DETAILS', colMid, y);
  y += 4;

  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.4);
  doc.line(ML, y, ML + 50, y);
  doc.line(colMid, y, colMid + 58, y);
  y += 5;

  const billStartY = y;

  setFont('bold', 10, GRAY_900);
  doc.text(v(invoice.bill_name || invoice.org_id?.org_name), ML, y);
  y += 5.5;

  const billLines = [
    invoice.bill_email || invoice.org_id?.org_email,
    invoice.bill_phone || invoice.org_id?.org_phone,
    invoice.bill_addr,
    [invoice.bill_city, invoice.bill_state].filter(Boolean).join(', '),
    [invoice.bill_country, invoice.bill_pincode].filter(Boolean).join(' — '),
    invoice.bill_gst_no ? `GSTIN: ${invoice.bill_gst_no}` : null,
  ].filter(Boolean);

  setFont('normal', 8.5, GRAY_600);
  billLines.forEach(line => { doc.text(line, ML, y); y += 4.8; });

  let yd = billStartY;
  const detailRows = [
    ['Invoice No',     v(invoice.invoice_no)],
    ['Invoice Date',   fmt(invoice.createdAt)],
    ['Payment Date',   fmt(invoice.payment_date)],
    ['Payment Method', paymentMethodLabel(invoice.payment_method)],
    ['Currency',       v(cur)],
    ['Order Ref',      v(invoice.order_id?._id)],
  ];
  detailRows.forEach(([label, val]) => {
    setFont('bold', 7.5, GRAY_400);
    doc.text(label.toUpperCase(), colMid, yd);
    setFont('normal', 8.5, GRAY_900);
    doc.text(val, colMid + 30, yd);
    yd += 5.5;
  });

  y = Math.max(y, yd) + 8;

  // ── Items table ──────────────────────────────────────────────────────────────
  doc.setFillColor(...GRAY_900);
  doc.rect(ML, y, CW, 8, 'F');
  setFont('bold', 7.5, WHITE);
  doc.text('#',           ML + 3,       y + 5.5);
  doc.text('DESCRIPTION', ML + 12,      y + 5.5);
  doc.text('ORG',         ML + CW - 88, y + 5.5);
  doc.text('UNIT PRICE',  ML + CW - 48, y + 5.5);
  doc.text('AMOUNT',      MR - 2,       y + 5.5, { align: 'right' });
  y += 8;

  const creditTitle = invoice.order_id?.credit_id?.title || 'Credit Package';
  const orgName     = invoice.org_id?.org_name || '—';
  const amount      = money(invoice.sub_total);

  doc.setFillColor(250, 254, 253);
  doc.rect(ML, y, CW, 12, 'F');
  doc.setFillColor(...TEAL);
  doc.rect(ML, y, 1.2, 12, 'F');

  setFont('normal', 8.5, GRAY_900);
  doc.text('1',         ML + 3,        y + 7.5);
  setFont('bold', 9, GRAY_900);
  doc.text(creditTitle, ML + 12,       y + 5.5);
  setFont('normal', 8, GRAY_600);
  doc.text('Credits package',  ML + 12, y + 10.5);
  setFont('normal', 8.5, GRAY_900);
  doc.text(orgName,     ML + CW - 88,  y + 7.5);
  doc.text(amount,      ML + CW - 48,  y + 7.5);
  setFont('bold', 9, GRAY_900);
  doc.text(amount,      MR - 2,        y + 7.5, { align: 'right' });
  y += 12;

  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.3);
  doc.line(ML, y, MR, y);
  y += 10;

  // ── Totals ───────────────────────────────────────────────────────────────────
  const totW = 80, totX = MR - totW;

  function totLine(label, val, bold = false, highlight = false) {
    if (highlight) {
      doc.setFillColor(...TEAL_DARK);
      doc.rect(totX, y - 4, totW, 9, 'F');
      setFont('bold', 10, WHITE);
      doc.text(label, totX + 4, y + 1.5);
      doc.text(val, MR - 2, y + 1.5, { align: 'right' });
      y += 12;
    } else {
      setFont(bold ? 'bold' : 'normal', 9, bold ? GRAY_900 : GRAY_600);
      doc.text(label, totX + 4, y);
      setFont(bold ? 'bold' : 'normal', 9, GRAY_900);
      doc.text(val, MR - 2, y, { align: 'right' });
      y += 6;
    }
  }

  totLine('Sub Total', money(invoice.sub_total));
  totLine('Discount',  money(invoice.discount));
  totLine('Tax',       money(invoice.tax));

  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.3);
  doc.line(totX, y - 2, MR, y - 2);
  y += 3;

  totLine('TOTAL AMOUNT', money(invoice.total_amount), true, true);
  y += 4;

  // ── Transaction info ──────────────────────────────────────────────────────────
  if (invoice.transaction_id) {
    doc.setFillColor(...TEAL_LIGHT);
    doc.roundedRect(ML, y, CW, 10, 2, 2, 'F');
    setFont('bold', 7.5, TEAL_DARK);
    doc.text('TRANSACTION ID', ML + 4, y + 4);
    setFont('normal', 8.5, GRAY_900);
    doc.text(v(invoice.transaction_id), ML + 36, y + 4);
    setFont('bold', 7.5, TEAL_DARK);
    doc.text('PAID ON', MR - 52, y + 4);
    setFont('normal', 8.5, GRAY_900);
    doc.text(fmt(invoice.payment_date), MR - 36, y + 4);
    y += 16;
  }

  // ── Shipping (if present) ──────────────────────────────────────────────────────
  const hasShip = [invoice.ship_name, invoice.ship_addr, invoice.ship_city].some(Boolean);
  if (hasShip) {
    doc.setDrawColor(...GRAY_200);
    doc.setLineWidth(0.3);
    doc.line(ML, y, MR, y);
    y += 7;

    setFont('bold', 7, TEAL);
    doc.text('SHIPPING ADDRESS', ML, y);
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.4);
    doc.line(ML, y + 2, ML + 50, y + 2);
    y += 7;

    const shipLines = [
      invoice.ship_name, invoice.ship_email, invoice.ship_phone,
      invoice.ship_addr,
      [invoice.ship_city, invoice.ship_state].filter(Boolean).join(', '),
      [invoice.ship_country, invoice.ship_pincode].filter(Boolean).join(' — '),
      invoice.ship_gst_no ? `GSTIN: ${invoice.ship_gst_no}` : null,
    ].filter(Boolean);

    setFont('normal', 8.5, GRAY_600);
    shipLines.forEach(line => { doc.text(line, ML, y); y += 4.8; });
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerY = PH - 22;
  doc.setFillColor(...TEAL);
  doc.rect(0, footerY, PW, 22, 'F');
  setFont('bold', 9.5, WHITE);
  doc.text('Thank you for your business!', ML, footerY + 9);
  setFont('normal', 8, [185, 236, 230]);
  doc.text('For queries, please contact: support@lmsplatform.com', ML, footerY + 16);
  setFont('normal', 8, [185, 236, 230]);
  doc.text(v(invoice.invoice_no), MR, footerY + 9, { align: 'right' });
  doc.text(`Generated on ${fmt(new Date().toISOString())}`, MR, footerY + 16, { align: 'right' });

  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.5);
  doc.rect(1, 1, PW - 2, PH - 2);

  doc.save(`${invoice.invoice_no || 'invoice'}.pdf`);
}
