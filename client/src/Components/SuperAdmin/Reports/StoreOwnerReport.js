'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import SuperAdminShell from '../SuperAdminShell';
import ColumnChart from './ColumnChart';
import { DownloadIcon, useSize, useReport, PeriodFields, ReportTable, ShareCell } from './ReportParts';
import { money, monthLabel, dateLabel, periodText } from './reportFormat';
import { RANKINGS, TOP_N, ORG_STATUS_LABEL, locationOf, topOrganizations } from './storeOwnerData';
import s from './Report.module.css';

function StatusText({ status }) {
  return <span className={`${s.status} ${s[`status_${status}`] || ''}`}>{ORG_STATUS_LABEL[status] || status}</span>;
}

function OrgName({ o }) {
  return (
    <>
      <span className={s.nameCell}>{o.name}</span>
      {o.owner?.email && <span className={s.subText}>{o.owner.email}</span>}
    </>
  );
}

export default function StoreOwnerReport() {
  const [rankBy, setRankBy] = useState('revenue');
  const [exporting, setExporting] = useState(false);
  const [showTable, setShowTable] = useState(false);
  // The chart fills its card so it lines up with the companies table beside it.
  const [chartRef, chartWidth, chartHeight] = useSize();
  const state = useReport('store-owners', {}, 'all');
  const { range, customInvalid, report, loading, error } = state;
  const periodDesc = periodText(range.from, range.to);
  const rankLabel = RANKINGS.find(r => r.value === rankBy)?.label;

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateStoreOwnerPDF } = await import('../../../lib/generateStoreOwnerPDF');
      await generateStoreOwnerPDF(report, { periodText: periodDesc, rankBy });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;
  const top = report ? topOrganizations(report.organizations, rankBy) : [];
  const chartData = (report?.monthly || []).map(m => ({ key: m.month, label: monthLabel(m.month), shortLabel: monthLabel(m.month, true), value: m.registered }));
  const count = n => `${n} organization${n === 1 ? '' : 's'}`;

  return (
    <SuperAdminShell activeSection="report-store-owner">
      <div className={s.page}>
        <header className={s.header}>
          <div>
            <h1 className={s.title}>Store Owners</h1>
            <p className={s.subtitle}>Organizations registered · {periodDesc}</p>
          </div>
          <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
            <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
          </button>
        </header>

        <div className={s.filters} role="group" aria-label="Report filters">
          <PeriodFields state={state} label="Registered" />
        </div>
        {customInvalid && <p className={s.errorText}>The start date must be on or before the end date.</p>}
        {error && <p className={s.errorText}>{error}</p>}

        {loading && !report ? <p className={s.empty}>Loading store owners…</p> : report && (
          <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
            <div>
              <section className={s.tiles} aria-label="Summary">
                <div className={`${s.tile} ${s.tileHero}`}>
                  <span className={s.tileLabel}>Registered</span>
                  <span className={s.heroValue}>{t.registered}</span>
                </div>
                <div className={s.tile}><span className={s.tileLabel}>Active</span><span className={s.tileValue}>{t.active}</span></div>
                <div className={s.tile}><span className={s.tileLabel}>Inactive</span><span className={s.tileValue}>{t.inactive}</span></div>
                <div className={s.tile}><span className={s.tileLabel}>Suspended</span><span className={s.tileValue}>{t.suspended}</span></div>
              </section>
              <p className={s.statusLine}>
                Registered this month {t.registeredThisMonth} · Learners across these organizations {t.learners} · Without a location {t.withoutLocation}
              </p>
            </div>

            {/* ── Registrations chart (4 of 12 columns) + registered companies (8 of 12); stacked on small screens ── */}
            <div className={s.row4x8}>
              <section className={s.card} aria-labelledby="reg-h">
                <div className={s.cardHead}>
                  <h2 id="reg-h" className={s.cardTitle}>New registrations per month</h2>
                  {chartData.length > 0 && (
                    <button type="button" className={s.linkBtn} onClick={() => setShowTable(v => !v)} aria-pressed={showTable}>
                      {showTable ? 'Show chart' : 'Show as table'}
                    </button>
                  )}
                </div>
                {chartData.length === 0 ? <p className={s.empty}>No organizations registered in this period.</p> : showTable ? (
                  <div className={`${s.tableWrap} ${s.chartSized}`}>
                    <table className={s.table}>
                      <thead><tr><th>Month</th><th className={s.num}>Registered</th></tr></thead>
                      <tbody>{report.monthly.map(m => <tr key={m.month}><td>{monthLabel(m.month)}</td><td className={s.num}>{m.registered}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : (
                  <div ref={chartRef} className={`${s.chartBox} ${s.chartFill}`}>
                    <ColumnChart data={chartData} width={chartWidth} height={chartHeight} integer
                      formatValue={count} formatAxis={v => String(Math.round(v))} />
                  </div>
                )}
              </section>
              <ReportTable id="all-h" title="Registered companies" rows={report.organizations} rowKey={o => o._id}
                empty="No organizations registered in this period."
                columns={[
                  { label: 'Company', render: o => <OrgName o={o} /> },
                  { label: 'Location', render: o => locationOf(o) },
                  { label: 'Registered on', className: s.nowrap, render: o => dateLabel(o.registeredAt) },
                  { label: 'Learners', align: 'right', render: o => o.learners },
                  { label: 'Courses', align: 'right', render: o => o.courses },
                  { label: 'Status', render: o => <StatusText status={o.status} /> },
                ]} />
            </div>

            <ReportTable id="top-h" title={`Top ${TOP_N} companies by ${rankLabel.toLowerCase()}`} rows={top} rowKey={o => o._id}
              empty="No organizations registered in this period."
              actions={(
                <label className={`${s.field} ${s.inlineField}`}>
                  <span>Rank by</span>
                  <select value={rankBy} onChange={e => setRankBy(e.target.value)}>
                    {RANKINGS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>
              )}
              columns={[
                { label: '#', render: (o, i) => i + 1 },
                { label: 'Company', render: o => <OrgName o={o} /> },
                { label: 'Location', render: o => locationOf(o) },
                { label: 'Learners', align: 'right', render: o => o.learners },
                { label: 'Courses', align: 'right', render: o => o.courses },
                { label: 'Orders', align: 'right', render: o => o.orders },
                { label: 'Revenue', align: 'right', render: o => money(o.revenue) },
                { label: 'Status', render: o => <StatusText status={o.status} /> },
              ]}
              footer={<p className={s.note}>Revenue is all successful credit purchases by the company; learners and courses are current.</p>} />

            <div className={s.twoCol}>
              <ReportTable id="state-h" title="Location — by state" rows={report.byState} empty="No organizations registered in this period."
                columns={[
                  { label: 'State', className: s.nameCell, render: r => r.state || 'Not specified' },
                  { label: 'Companies', align: 'right', render: r => r.organizations },
                  { label: 'Active', align: 'right', render: r => r.active },
                  { label: 'Learners', align: 'right', render: r => r.learners },
                  { label: 'Share', className: s.shareCol, render: r => <ShareCell share={r.share} /> },
                ]} />
              <ReportTable id="city-h" title="Location — by city" rows={report.byCity} empty="No organizations registered in this period."
                columns={[
                  { label: 'City', className: s.nameCell, render: r => r.city || 'Not specified' },
                  { label: 'State', render: r => r.state || '—' },
                  { label: 'Companies', align: 'right', render: r => r.organizations },
                  { label: 'Learners', align: 'right', render: r => r.learners },
                  { label: 'Share', className: s.shareCol, render: r => <ShareCell share={r.share} /> },
                ]} />
            </div>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
