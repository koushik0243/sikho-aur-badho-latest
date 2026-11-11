'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import SuperAdminShell from '../SuperAdminShell';
import ColumnChart from './ColumnChart';
import { DownloadIcon, useSize, useReport, PeriodFields, ShareCell } from './ReportParts';
import { money, moneyShort, periodText, revenueSeries } from './reportFormat';
import s from './Report.module.css';

const VIEWS = [{ value: 'monthly', label: 'Monthly' }, { value: 'daily', label: 'Daily' }];

const ordersText = n => `${n} order${n === 1 ? '' : 's'}`;

/** Monthly / Daily switch. */
function ViewSwitch({ view, onChange, dailyAvailable }) {
  return (
    <div className={s.segmented} role="radiogroup" aria-label="Show by">
      {VIEWS.map(v => (
        <button key={v.value} type="button" role="radio" aria-checked={view === v.value}
          className={view === v.value ? s.segmentedOn : undefined}
          disabled={v.value === 'daily' && !dailyAvailable}
          title={v.value === 'daily' && !dailyAvailable ? 'Choose a period of up to a year to see daily figures' : undefined}
          onClick={() => onChange(v.value)}>
          {v.label}
        </button>
      ))}
    </div>
  );
}

/** Period table: revenue, orders and AOV per month / day. */
// Same height as the chart it replaces (scrolls inside), so switching chart ↔ table never resizes the card.
function PeriodTable({ points, view }) {
  const rows = view === 'daily' ? points.filter(p => p.orders > 0) : points;
  if (!rows.length) return <p className={`${s.empty} ${s.chartSized}`}>No orders in this period.</p>;
  return (
    <div className={`${s.tableWrap} ${s.chartSized}`}>
      <table className={s.table}>
        <thead>
          <tr><th>{view === 'daily' ? 'Day' : 'Month'}</th><th className={s.num}>Orders</th><th className={s.num}>Revenue</th><th className={s.num}>AOV</th></tr>
        </thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.key}>
              <td>{p.label}</td>
              <td className={s.num}>{p.orders}</td>
              <td className={s.num}>{money(p.revenue)}</td>
              <td className={s.num}>{p.orders ? money(p.aov) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {view === 'daily' && <p className={s.note}>Days without orders are left out of the table.</p>}
    </div>
  );
}

export default function RevenueReport() {
  const [view, setView] = useState('monthly');
  const [revenueTable, setRevenueTable] = useState(false);
  const [aovTable, setAovTable] = useState(false);
  const [exporting, setExporting] = useState(false);
  // The two cards sit side by side; each chart fills its card so both match in height.
  const [revenueRef, revenueWidth, revenueHeight] = useSize();
  const [aovRef, aovWidth, aovHeight] = useSize();
  const state = useReport('revenue');
  const { range, customInvalid, report, loading, error } = state;
  const periodDesc = periodText(range.from, range.to);

  const dailyAvailable = Boolean(report?.daily);
  const activeView = view === 'daily' && !dailyAvailable ? 'monthly' : view;
  const points = report ? revenueSeries(report, activeView) : [];
  const unit = activeView === 'daily' ? 'day' : 'month';

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateRevenuePDF } = await import('../../../lib/generateRevenuePDF');
      await generateRevenuePDF(report, { periodText: periodDesc, view: activeView });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;
  const course = report?.byCourse;
  const courseShare = v => (t?.revenue ? Math.round((v / t.revenue) * 1000) / 10 : 0);

  return (
    <SuperAdminShell activeSection="report-revenue">
      <div className={s.page}>
        <header className={s.header}>
          <div>
            <h1 className={s.title}>Revenue</h1>
            <p className={s.subtitle}>Revenue from successful credit-package orders · {periodDesc}</p>
          </div>
          <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
            <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
          </button>
        </header>

        <div className={s.filters} role="group" aria-label="Report filters">
          <PeriodFields state={state} />
          <div className={s.field}>
            <span>Show by</span>
            <ViewSwitch view={activeView} onChange={setView} dailyAvailable={dailyAvailable} />
          </div>
        </div>
        {customInvalid && <p className={s.errorText}>The start date must be on or before the end date.</p>}
        {error && <p className={s.errorText}>{error}</p>}
        {report && !dailyAvailable && (
          <p className={s.note}>Daily figures are available for periods of up to {report.maxDailyDays} days — choose a shorter period to see them.</p>
        )}

        {loading && !report ? <p className={s.empty}>Loading revenue…</p> : report && (
          <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
            {/* ── Revenue + AOV side by side (stacked on small screens) ── */}
            <div className={s.twoCol}>
              {/* ── Revenue ── */}
              <section className={s.card} aria-labelledby="revenue-h">
                <div className={s.cardHead}>
                  <h2 id="revenue-h" className={s.cardTitle}>{activeView === 'daily' ? 'Daily' : 'Monthly'} revenue</h2>
                  {points.length > 0 && (
                    <button type="button" className={s.linkBtn} onClick={() => setRevenueTable(v => !v)} aria-pressed={revenueTable}>
                      {revenueTable ? 'Show chart' : 'Show as table'}
                    </button>
                  )}
                </div>
                <div className={s.cardFigure}>
                  <span className={s.heroValue}>{money(t.revenue)}</span>
                  <span className={s.figureNote}>total revenue from {ordersText(t.orders)}</span>
                </div>
                {points.length === 0 ? <p className={s.empty}>No orders in this period.</p> : revenueTable ? (
                  <PeriodTable points={points} view={activeView} />
                ) : (
                  <div ref={revenueRef} className={`${s.chartBox} ${s.chartFill}`}>
                    <ColumnChart data={points.map(p => ({ ...p, value: p.revenue }))} width={revenueWidth} height={revenueHeight}
                      formatValue={money} formatAxis={v => moneyShort(v)}
                      tooltipLines={p => [ordersText(p.orders)]} />
                  </div>
                )}
              </section>
  
              {/* ── AOV ── */}
              <section className={s.card} aria-labelledby="aov-h">
                <div className={s.cardHead}>
                  <h2 id="aov-h" className={s.cardTitle}>Average order value (AOV)</h2>
                  {points.length > 0 && (
                    <button type="button" className={s.linkBtn} onClick={() => setAovTable(v => !v)} aria-pressed={aovTable}>
                      {aovTable ? 'Show chart' : 'Show as table'}
                    </button>
                  )}
                </div>
                <div className={s.cardFigure}>
                  <span className={s.heroValue}>{money(t.averageOrder)}</span>
                  <span className={s.figureNote}>{money(t.revenue)} ÷ {ordersText(t.orders)} · per {unit} below</span>
                </div>
                {points.length === 0 ? <p className={s.empty}>No orders in this period.</p> : aovTable ? (
                  <PeriodTable points={points} view={activeView} />
                ) : (
                  <div ref={aovRef} className={`${s.chartBox} ${s.chartFill}`}>
                    <ColumnChart data={points.map(p => ({ ...p, value: p.aov }))} width={aovWidth} height={aovHeight}
                      formatValue={v => money(v)} formatAxis={v => moneyShort(v)}
                      tooltipLines={p => [p.orders ? `${money(p.revenue)} ÷ ${ordersText(p.orders)}` : 'No orders']} />
                  </div>
                )}
              </section>
            </div>

            {/* ── Course-wise revenue ── */}
            <section className={s.card} aria-labelledby="course-h">
              <h2 id="course-h" className={s.cardTitle}>Course-wise revenue</h2>
              {course.rows.length === 0 && course.unallocated === 0 ? <p className={s.empty}>No revenue in this period.</p> : (
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead>
                      <tr><th>Course</th><th className={s.num}>Credits used</th><th className={s.num}>Organizations</th><th className={s.num}>Revenue</th><th className={s.shareCol}>Share</th></tr>
                    </thead>
                    <tbody>
                      {course.rows.map(r => (
                        <tr key={r.courseId || 'none'}>
                          <td className={s.nameCell}>{r.title}</td>
                          <td className={s.num}>{r.credits}</td>
                          <td className={s.num}>{r.organizations}</td>
                          <td className={s.num}>{money(r.revenue)}</td>
                          <td className={s.shareCol}><ShareCell share={courseShare(r.revenue)} /></td>
                        </tr>
                      ))}
                      {course.unallocated > 0 && (
                        <tr className={s.mutedRow}>
                          <td>Not yet used on a course</td>
                          <td className={s.num}>—</td>
                          <td className={s.num}>—</td>
                          <td className={s.num}>{money(course.unallocated)}</td>
                          <td className={s.shareCol}><ShareCell share={courseShare(course.unallocated)} /></td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td className={s.num}>{course.creditsUsed}</td>
                        <td />
                        <td className={s.num}>{money(t.revenue)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <p className={s.note}>
                Organizations buy credits, not courses — each credit assigns one course to one learner. An organization&apos;s revenue in the period is
                shared across the courses it used credits on in the period; revenue from organizations that haven&apos;t used credits yet is shown as
                &quot;Not yet used on a course&quot;.
              </p>
            </section>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
