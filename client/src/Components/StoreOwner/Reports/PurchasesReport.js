'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DownloadIcon, useReport, PeriodFields, ReportTable, SplitBar, ShareCell, Badge } from '../../SuperAdmin/Reports/ReportParts';
import { money, monthLabel, dateLabel, periodText } from '../../SuperAdmin/Reports/reportFormat';
import { ORDER_STATUS, PAYMENT_STATUS, STATUS_TONE, methodLabel, RULES_TEXT } from './purchasesData';
import s from '../../SuperAdmin/Reports/Report.module.css';
import { orDash } from '../../../lib/displayValue';

const PAGE_SIZE = 20;
const Person = ({ r }) => <><span className={s.nameCell}>{r.name}</span>{r.email && <span className={s.subText}>{r.email}</span>}</>;

export default function PurchasesReport() {
  const [exporting, setExporting] = useState(false);
  const state = useReport('purchases', {}, 'all', 'org-report');
  const { range, customInvalid, report, loading, error } = state;
  const periodDesc = periodText(range.from, range.to);

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generatePurchasesPDF } = await import('../../../lib/generatePurchasesPDF');
      await generatePurchasesPDF(report, { periodText: periodDesc });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const b = report?.balance, t = report?.totals;
  const usedPct = b && b.bought ? Math.round((b.used / b.bought) * 100) : 0;
  const missing = report ? report.orders.filter(o => o.status === 'success' && !o.invoiceNo) : [];

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Purchases</h1>
          <p className={s.subtitle}>{report?.organization || 'My organization'} · credits and invoices · {periodDesc}</p>
        </div>
        <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
          <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
        </button>
      </header>

      <div className={s.filters} role="group" aria-label="Report filters">
        <PeriodFields state={state} />
      </div>
      {customInvalid && <p className={s.errorText}>The start date must be on or before the end date.</p>}
      {error && <p className={s.errorText}>{error}</p>}

      {loading && !report ? <p className={s.empty}>Loading purchases…</p> : report && (
        <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
          <div>
            <section className={s.tiles} aria-label="Summary">
              <div className={`${s.tile} ${s.tileHero} ${b.remaining <= 0 ? s.tileAlert : ''}`}>
                <span className={s.tileLabel}>Credits remaining</span>
                <span className={s.heroValue}>{b.remaining} <small className={s.tileSub}>of {b.bought} bought</small></span>
              </div>
              <div className={s.tile}><span className={s.tileLabel}>Credits bought</span><span className={s.tileValue}>{t.creditsBought} <small className={s.tileSub}>{t.packsBought} pack{t.packsBought === 1 ? '' : 's'}</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Credits used</span><span className={s.tileValue}>{t.creditsUsed} <small className={s.tileSub}>{t.employeesUsing} employee{t.employeesUsing === 1 ? '' : 's'}</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Amount paid</span><span className={s.tileValue}>{money(t.amountPaid)} <small className={s.tileSub}>{t.invoices} invoice{t.invoices === 1 ? '' : 's'}</small></span></div>
            </section>
            <p className={s.statusLine}>Remaining is your balance today. Bought, used, paid and the lists below are for {periodDesc.toLowerCase() === 'all time' ? 'all time' : periodDesc}.</p>
          </div>

          <div className={s.twoCol}>
            <section className={s.card} aria-labelledby="bal-h">
              <h2 id="bal-h" className={s.cardTitle}>Credit balance (today)</h2>
              <p className={s.cardHint}>{b.bought} credits bought in {b.packs} pack{b.packs === 1 ? '' : 's'} · {usedPct}% used</p>
              <SplitBar label="Credit balance" parts={[
                { label: 'Used', value: b.used, className: s.st_in_progress },
                { label: 'Remaining', value: Math.max(0, b.remaining), className: s.st_not_started },
              ]} />
              {b.remaining <= 0 && <p className={s.errorText}>No credits left — buy a credit pack to assign more courses.</p>}
            </section>
            <section className={s.card} aria-labelledby="mo-h">
              <h2 id="mo-h" className={s.cardTitle}>By month</h2>
              {report.monthly.length === 0 ? <p className={s.empty}>No purchases or usage in this period.</p> : (
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead><tr><th>Month</th><th className={s.num}>Bought</th><th className={s.num}>Used</th><th className={s.num}>Paid</th></tr></thead>
                    <tbody>{report.monthly.map(m => <tr key={m.month}><td>{monthLabel(m.month)}</td><td className={s.num}>{m.bought}</td><td className={s.num}>{m.used}</td><td className={s.num}>{money(m.spent)}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <ReportTable id="pk-h" title="Credits bought" rows={report.packs} rowKey={r => r.id} pageSize={PAGE_SIZE}
            empty="No credit packs bought in this period."
            columns={[
              { label: 'Date', className: s.nowrap, render: r => dateLabel(r.boughtAt) },
              { label: 'Package', className: s.nameCell, render: r => r.package },
              { label: 'Credits', align: 'right', render: r => r.credits },
              { label: 'Price', align: 'right', render: r => money(r.price) },
              { label: 'Due date', className: s.nowrap, render: r => (r.dueDate ? dateLabel(r.dueDate) : '—') },
              { label: 'Status', render: r => (
                <span className={`${s.status} ${r.status === 'active' ? s.status_active : s.status_inactive}`}>
                  {r.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              ) },
            ]} />

          <div className={s.twoCol}>
            <ReportTable id="uc-h" title="Credits used by course" rows={report.usageByCourse} rowKey={r => r.course} pageSize={10}
              empty="No credits used in this period."
              columns={[
                { label: 'Course', className: s.nameCell, render: r => r.course },
                { label: 'Credits', align: 'right', render: r => r.credits },
                { label: 'Share', render: r => <ShareCell share={t.creditsUsed ? Math.round((r.credits / t.creditsUsed) * 1000) / 10 : 0} /> },
              ]} />
            <ReportTable id="ue-h" title="Credits used by employee" rows={report.usageByEmployee} rowKey={r => r.name} pageSize={10}
              empty="No credits used in this period."
              columns={[
                { label: 'Employee', render: r => <Person r={r} /> },
                { label: 'Credits', align: 'right', render: r => r.credits },
                { label: 'Courses', align: 'right', render: r => r.courses.length },
              ]} />
          </div>

          <ReportTable id="us-h" title="Credit usage" rows={report.usage} rowKey={(r, i) => i} pageSize={PAGE_SIZE}
            empty="No credits used in this period."
            columns={[
              { label: 'Date', className: s.nowrap, render: r => dateLabel(r.usedAt) },
              { label: 'Employee', render: r => <Person r={r} /> },
              { label: 'Course', render: r => r.course },
              { label: 'Credits', align: 'right', render: () => 1 },
            ]} />

          <ReportTable id="in-h" title="Invoices" rows={report.invoices} rowKey={r => r.id} pageSize={PAGE_SIZE}
            empty="No invoices in this period."
            actions={t.invoices > 0 && <span className={s.cardHint}>{money(t.invoiced)} invoiced</span>}
            columns={[
              { label: 'Invoice', className: s.nowrap, render: r => <Link href={`/storeowner/invoices/${r.id}`} className={s.linkBtn}>{r.invoiceNo}</Link> },
              { label: 'Date', className: s.nowrap, render: r => dateLabel(r.date) },
              { label: 'Package', render: r => r.package },
              { label: 'Subtotal', align: 'right', render: r => money(r.subTotal) },
              { label: 'Discount', align: 'right', render: r => (r.discount ? `− ${money(r.discount)}` : '—') },
              { label: 'Tax', align: 'right', render: r => (r.tax ? money(r.tax) : '—') },
              { label: 'Total', align: 'right', render: r => <strong>{money(r.total)}</strong> },
              { label: 'Method', render: r => methodLabel(r.paymentMethod) },
              { label: 'Status', render: r => <Badge tone={STATUS_TONE[r.paymentStatus] || 'info'} label={PAYMENT_STATUS[r.paymentStatus] || r.paymentStatus} /> },
            ]}
            footer={missing.length > 0 && (
              <p className={s.note}>
                {missing.length} paid order{missing.length === 1 ? ' has' : 's have'} no invoice: {missing.map(o => `${o.package} · ${money(o.amount)} on ${dateLabel(o.date)}`).join('; ')}.
              </p>
            )} />

          <ReportTable id="or-h" title="Orders" rows={report.orders} rowKey={r => r.id} pageSize={PAGE_SIZE}
            empty="No orders in this period."
            columns={[
              { label: 'Date', className: s.nowrap, render: r => dateLabel(r.date) },
              { label: 'Package', className: s.nameCell, render: r => r.package },
              { label: 'Credits', align: 'right', render: r => orDash(r.credits) },
              { label: 'Amount', align: 'right', render: r => money(r.amount) },
              { label: 'Payment', render: r => methodLabel(r.gateway) },
              { label: 'Status', render: r => <Badge tone={STATUS_TONE[r.status] || 'info'} label={ORDER_STATUS[r.status] || r.status} /> },
              { label: 'Invoice', className: s.nowrap, render: r => r.invoiceNo || <span className={s.subText}>No invoice</span> },
            ]} />

          <section className={s.card} aria-labelledby="pr-h">
            <h2 id="pr-h" className={s.cardTitle}>How credits are counted</h2>
            <ul className={s.rulesList}>{RULES_TEXT.map(x => <li key={x}>{x}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
