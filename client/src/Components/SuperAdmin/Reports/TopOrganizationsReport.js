'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import SuperAdminShell from '../SuperAdminShell';
import { DownloadIcon, useReport, PeriodFields, ReportTable, ShareCell } from './ReportParts';
import { money, dateLabel, periodText } from './reportFormat';
import { percentText } from './traineeData';
import { VIP_STATUS, vipRuleText, daysAgo } from './topOrganizationsData';
import s from './Report.module.css';

const STATUS_ICON = {
  ok: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.58 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z',
  warning: 'M10 18a8 8 0 100-16 8 8 0 000 16zm0-12a1 1 0 011 1v3a1 1 0 11-2 0V7a1 1 0 011-1zm0 8.5a1 1 0 100-2 1 1 0 000 2z',
  critical: 'M10 2a1 1 0 01.87.5l7 12A1 1 0 0117 16H3a1 1 0 01-.87-1.5l7-12A1 1 0 0110 2zm0 5a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1zm0 7.5a1 1 0 100-2 1 1 0 000 2z',
};

/** VIP status badge: icon + label, never colour alone. */
const VipStatus = ({ status }) => {
  const v = VIP_STATUS[status];
  return (
    <span className={`${s.sev} ${s[`sev_${v.sev}`]}`}>
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d={STATUS_ICON[v.sev]} clipRule="evenodd" /></svg>
      {v.label}
    </span>
  );
};

const OrgCell = ({ o }) => (
  <><span className={s.nameCell}>{o.name}</span>{o.location && <span className={s.subText}>{o.location}</span>}</>
);

export default function TopOrganizationsReport() {
  const [exporting, setExporting] = useState(false);
  const state = useReport('top-organizations', {}, 'this-year');
  const { range, customInvalid, report, loading, error } = state;
  const periodDesc = periodText(range.from, range.to);

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateTopOrganizationsPDF } = await import('../../../lib/generateTopOrganizationsPDF');
      await generateTopOrganizationsPDF(report, { periodText: periodDesc });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals, vip = report?.vip, oth = report?.others;
  const top = report?.rules.TOP;

  return (
    <SuperAdminShell activeSection="report-top-organizations">
      <div className={s.page}>
        <header className={s.header}>
          <div>
            <h1 className={s.title}>Top Organizations</h1>
            <p className={s.subtitle}>{periodDesc} · ranked by revenue and enrollments</p>
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

        {loading && !report ? <p className={s.empty}>Loading organizations…</p> : report && (
          <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
            <div>
              <section className={s.tiles} aria-label="Summary">
                <div className={`${s.tile} ${s.tileHero}`}>
                  <span className={s.tileLabel}>Revenue</span>
                  <span className={s.heroValue}>{money(t.revenue)}</span>
                </div>
                <div className={s.tile}><span className={s.tileLabel}>Paying organizations</span><span className={s.tileValue}>{t.payingOrganizations} <small className={s.tileSub}>{t.orders} orders</small></span></div>
                <div className={s.tile}><span className={s.tileLabel}>Enrollments</span><span className={s.tileValue}>{t.enrollments} <small className={s.tileSub}>{t.enrollingOrganizations} orgs</small></span></div>
                <div className={s.tile}><span className={s.tileLabel}>VIP customers</span><span className={s.tileValue}>{vip.customers.length} <small className={s.tileSub}>{vip.share}% of all revenue</small></span></div>
              </section>
              <p className={s.statusLine}>
                Revenue = successful credit purchases. Enrollment = one course assigned to one learner. The period filters both top-10 lists; VIP status is lifetime.
              </p>
            </div>

            <ReportTable id="rev-h" title={`Top ${top} by revenue`} rows={report.topRevenue} rowKey={o => o.orgId}
              empty="No orders in this period."
              columns={[
                { label: '#', render: o => o.rank },
                { label: 'Organization', render: o => <OrgCell o={o} /> },
                { label: 'Orders', align: 'right', render: o => o.orders },
                { label: 'Revenue', align: 'right', render: o => money(o.revenue) },
                { label: 'Share', render: o => <ShareCell share={o.share} /> },
                { label: 'Avg order', align: 'right', render: o => money(o.aov) },
                { label: 'Last order', className: s.nowrap, render: o => dateLabel(o.lastOrder) },
              ]}
              footer={report.topRevenue.length > 0 && (
                <p className={s.note}>
                  The top {report.topRevenue.length} brought in {money(report.topRevenueSum)} — {report.topRevenueShare}% of {money(t.revenue)} in this period.
                  {oth.revenue.organizations > 0 && ` ${oth.revenue.organizations} other organization${oth.revenue.organizations === 1 ? '' : 's'}: ${money(oth.revenue.revenue)} from ${oth.revenue.orders} orders.`}
                </p>
              )} />

            <ReportTable id="enr-h" title={`Top ${top} by enrollment`} rows={report.topEnrollment} rowKey={o => o.orgId}
              empty="No enrollments in this period."
              columns={[
                { label: '#', render: o => o.rank },
                { label: 'Organization', render: o => <OrgCell o={o} /> },
                { label: 'Enrollments', align: 'right', render: o => o.enrollments },
                { label: 'Share', render: o => <ShareCell share={o.share} /> },
                { label: 'Learners', align: 'right', render: o => o.learners },
                { label: 'Courses', align: 'right', render: o => o.courses },
                { label: 'Completed', align: 'right', render: o => o.completed },
                { label: 'In progress', align: 'right', render: o => o.inProgress + o.notStarted },
                { label: 'Dropout', align: 'right', render: o => o.dropout },
                { label: 'Completion', align: 'right', render: o => `${o.completionRate}%` },
              ]}
              footer={report.topEnrollment.length > 0 && (
                <p className={s.note}>
                  The top {report.topEnrollment.length} hold {report.topEnrollmentShare}% of {t.enrollments} enrollments in this period. In progress includes not started yet.
                  {oth.enrollment.organizations > 0 && ` ${oth.enrollment.organizations} other organization${oth.enrollment.organizations === 1 ? '' : 's'}: ${oth.enrollment.enrollments} enrollments.`}
                </p>
              )} />

            <ReportTable id="vip-h" title="VIP customers" rows={vip.customers} rowKey={o => o.orgId}
              empty="No organization has paid yet."
              actions={vip.customers.length > 0 && <span className={s.cardHint}>{vip.active} active · {vip.cooling} cooling · {vip.atRisk} at risk</span>}
              columns={[
                { label: '#', render: o => o.rank },
                { label: 'Organization', render: o => <OrgCell o={o} /> },
                { label: 'Status', render: o => <VipStatus status={o.status} /> },
                { label: 'Lifetime revenue', align: 'right', render: o => money(o.revenue) },
                { label: 'Share', render: o => <ShareCell share={o.share} /> },
                { label: 'Orders', align: 'right', render: o => o.orders },
                { label: 'Avg order', align: 'right', render: o => money(o.aov) },
                { label: 'Customer since', className: s.nowrap, render: o => dateLabel(o.customerSince) },
                { label: 'Last order', className: s.nowrap, render: o => <>{dateLabel(o.lastOrder)}<span className={s.subText}>{daysAgo(o.daysSinceOrder)}</span></> },
                { label: 'Learners', align: 'right', render: o => o.learners },
                { label: 'Completion', align: 'right', render: o => percentText(o.completionRate) },
              ]}
              footer={<p className={s.note}>
                {vipRuleText(report.rules)}
                {vip.customers.length > 0 && ` ${vip.customers.length} VIP${vip.customers.length === 1 ? '' : 's'} of ${t.lifetimePaying} paying organizations bring ${money(vip.revenue)} (${vip.share}% of lifetime revenue); the entry level is ${money(vip.threshold)} lifetime.`}
              </p>} />
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
