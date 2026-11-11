'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import SuperAdminShell from '../SuperAdminShell';
import ColumnChart from './ColumnChart';
import { DownloadIcon, useWidth, useReport, PeriodFields, ReportTable } from './ReportParts';
import { money, monthLabel, dayLabel, dateLabel, ymdLabel, periodText } from './reportFormat';
import { percentText } from './traineeData';
import { COURSE_RANKINGS, ORG_RANKINGS, ranked, changeText } from './platformHealthData';
import s from './Report.module.css';

/** "+12.5% vs last month" — arrow + sign + words, never colour alone. */
function Delta({ value, versus }) {
  const text = changeText(value);
  if (text === null) return <span className={`${s.delta} ${s.deltaFlat}`}>No sales {versus} to compare</span>;
  const cls = value > 0 ? s.deltaUp : value < 0 ? s.deltaDown : s.deltaFlat;
  return <span className={`${s.delta} ${cls}`}><span aria-hidden="true">{value > 0 ? '▲' : value < 0 ? '▼' : '■'}</span>{text} vs {versus}</span>;
}

/** A "Rank by" select for a card header. */
function RankBy({ value, onChange, options }) {
  return (
    <label className={`${s.field} ${s.inlineField}`}>
      <span>Rank by</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
    </label>
  );
}

const Stat = ({ label, value }) => (
  <li><span className={s.statLabel}>{label}</span><span className={s.statValue}>{value}</span></li>
);

export default function PlatformHealthReport() {
  const [exporting, setExporting] = useState(false);
  const [courseRank, setCourseRank] = useState('enrollments');
  const [orgRank, setOrgRank] = useState('revenue');
  const [showDauTable, setShowDauTable] = useState(false);
  const [dauRef, dauWidth] = useWidth();
  const [certRef, certWidth] = useWidth();
  const state = useReport('platform-health', {}, 'this-year');
  const { range, customInvalid, report, loading, error } = state;
  const periodDesc = periodText(range.from, range.to);

  const courses = report ? ranked(report.courseRanking, courseRank, 'title') : [];
  const orgs = report ? ranked(report.orgRanking, orgRank, 'name') : [];

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generatePlatformHealthPDF } = await import('../../../lib/generatePlatformHealthPDF');
      await generatePlatformHealthPDF(report, { periodText: periodDesc, courseRank, orgRank });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const dau = report?.dau, rev = report?.revenue, cert = report?.certificates;
  const people = n => `${n} active user${n === 1 ? '' : 's'}`;
  const dauData = (dau?.daily || []).map(d => ({ key: d.day, label: dayLabel(d.day), shortLabel: dayLabel(d.day, true), value: d.active, learners: d.learners, others: d.others }));
  const certData = (cert?.monthly || []).map(m => ({ key: m.month, label: monthLabel(m.month), shortLabel: monthLabel(m.month, true), value: m.issued }));
  const courseLabel = COURSE_RANKINGS.find(r => r.value === courseRank).label.toLowerCase();
  const orgLabel = ORG_RANKINGS.find(r => r.value === orgRank).label.toLowerCase();

  return (
    <SuperAdminShell activeSection="report-platform-health">
      <div className={s.page}>
        <header className={s.header}>
          <div>
            <h1 className={s.title}>Platform Health</h1>
            <p className={s.subtitle}>As of {ymdLabel(report?.today || range.to || '') || 'today'} · rankings and certificates for {periodDesc}</p>
          </div>
          <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
            <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
          </button>
        </header>

        <div className={s.filters} role="group" aria-label="Report filters">
          <PeriodFields state={state} label="Rankings & certificates" />
        </div>
        {customInvalid && <p className={s.errorText}>The start date must be on or before the end date.</p>}
        {error && <p className={s.errorText}>{error}</p>}

        {loading && !report ? <p className={s.empty}>Checking platform health…</p> : report && (
          <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
            <div>
              <section className={s.tiles} aria-label="Summary">
                <div className={`${s.tile} ${s.tileHero}`}>
                  <span className={s.tileLabel}>Active users today</span>
                  <span className={s.heroValue}>{dau.today.active} <small className={s.tileSub}>yesterday {dau.yesterday.active}</small></span>
                </div>
                <div className={s.tile}>
                  <span className={s.tileLabel}>Revenue this month (MTD)</span>
                  <span className={s.tileValue}>{money(rev.mtd.revenue)}</span>
                  <Delta value={rev.mtd.change} versus="last month" />
                </div>
                <div className={s.tile}>
                  <span className={s.tileLabel}>Revenue this year (YTD)</span>
                  <span className={s.tileValue}>{money(rev.ytd.revenue)}</span>
                  <Delta value={rev.ytd.change} versus="last year" />
                </div>
                <div className={s.tile}><span className={s.tileLabel}>Certificates issued</span><span className={s.tileValue}>{cert.issued} <small className={s.tileSub}>{cert.total} all time</small></span></div>
              </section>
              <p className={s.statusLine}>
                Active users and MTD / YTD revenue are as of today; MTD and YTD compare with the same days last month / last year.
                The period filters certificates and both rankings.
              </p>
            </div>

            <section className={s.card} aria-labelledby="dau-h">
              <div className={s.cardHead}>
                <h2 id="dau-h" className={s.cardTitle}>Daily active users (DAU) — last {dau.days} days</h2>
                <button type="button" className={s.linkBtn} onClick={() => setShowDauTable(v => !v)} aria-pressed={showDauTable}>
                  {showDauTable ? 'Show chart' : 'Show as table'}
                </button>
              </div>
              <ul className={s.statRow}>
                <Stat label="Average DAU" value={dau.avgDau} />
                <Stat label={`Active in ${dau.days} days (MAU)`} value={`${dau.mau} (${dau.mauLearners} learner${dau.mauLearners === 1 ? '' : 's'})`} />
                <Stat label="Stickiness (DAU ÷ MAU)" value={percentText(dau.stickiness)} />
                <Stat label="Busiest day" value={dau.peak ? `${dayLabel(dau.peak.day)} · ${dau.peak.active}` : '—'} />
              </ul>
              {showDauTable ? (
                // Same height as the chart (scrolls inside), so the card doesn't resize when toggling.
                <div className={`${s.tableWrap} ${s.chartSized}`}>
                  <table className={s.table}>
                    <thead><tr><th>Day</th><th className={s.num}>Active users</th><th className={s.num}>Learners</th><th className={s.num}>Others</th></tr></thead>
                    <tbody>{[...dau.daily].reverse().map(d => <tr key={d.day}><td>{dayLabel(d.day)}</td><td className={s.num}>{d.active}</td><td className={s.num}>{d.learners}</td><td className={s.num}>{d.others}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : (
                <div ref={dauRef} className={s.chartBox}>
                  <ColumnChart data={dauData} width={dauWidth} integer formatValue={people} formatAxis={v => String(Math.round(v))}
                    tooltipLines={d => [`${d.learners} learner${d.learners === 1 ? '' : 's'} · ${d.others} admin / store owner`]} />
                </div>
              )}
              <p className={s.note}>
                A user is active on a day they signed in to the platform or did any learning (lesson, quiz, aptitude test, note, review, homework, Zoom).
                {dau.trackingSince ? ` Sign-ins are counted from ${ymdLabel(dau.trackingSince)}; earlier days show learning activity only.` : ' Sign-in tracking has just started; past days show learning activity only.'}
              </p>
            </section>

            <div className={s.twoCol}>
              <section className={s.card} aria-labelledby="rev-h">
                <h2 id="rev-h" className={s.cardTitle}>Revenue to date</h2>
                <div className={s.tableWrap}>
                  <table className={`${s.table} ${s.compareTable}`}>
                    <thead><tr><th>Period</th><th>Dates</th><th className={s.num}>Orders</th><th className={s.num}>Revenue</th></tr></thead>
                    <tbody>
                      {[
                        ['Month to date', rev.mtd], ['Same days last month', rev.lastMonthToDate], ['All of last month', rev.lastMonth],
                        ['Year to date', rev.ytd], ['Same period last year', rev.lastYearToDate],
                      ].map(([label, r]) => (
                        <tr key={label}><td>{label}</td><td className={s.nowrap}>{ymdLabel(r.from)} – {ymdLabel(r.to)}</td><td className={s.num}>{r.orders}</td><td className={s.num}>{money(r.revenue)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={s.note}>Revenue = successful credit purchases, India time.</p>
              </section>

              <section className={s.card} aria-labelledby="cert-h">
                <h2 id="cert-h" className={s.cardTitle}>Certificates issued</h2>
                <ul className={s.statRow}>
                  <Stat label="In this period" value={cert.issued} />
                  <Stat label="Learners" value={cert.learners} />
                  <Stat label="All time" value={cert.total} />
                </ul>
                {certData.length === 0 || cert.issued === 0 ? <p className={s.empty}>No certificates issued in this period.</p> : (
                  <div ref={certRef} className={s.chartBox}>
                    <ColumnChart data={certData} width={certWidth} integer formatValue={n => `${n} certificate${n === 1 ? '' : 's'}`} formatAxis={v => String(Math.round(v))} />
                  </div>
                )}
              </section>
            </div>

            <ReportTable id="certl-h" title="Latest certificates" rows={cert.latest} rowKey={(r, i) => i}
              empty="No certificates issued in this period."
              columns={[
                { label: 'Learner', className: s.nameCell, render: r => r.name },
                { label: 'Organization', render: r => r.organization },
                { label: 'Course', render: r => r.course },
                { label: 'Issued', className: s.nowrap, render: r => dateLabel(r.issuedAt) },
              ]} />

            <ReportTable id="cr-h" title={`Course ranking — by ${courseLabel}`} rows={courses} rowKey={r => r.courseId}
              empty="No courses yet."
              actions={<RankBy value={courseRank} onChange={setCourseRank} options={COURSE_RANKINGS} />}
              columns={[
                { label: '#', render: r => r.rank },
                { label: 'Course', className: s.nameCell, render: r => r.title },
                { label: 'Enrollments', align: 'right', render: r => r.enrollments },
                { label: 'Learners', align: 'right', render: r => r.learners },
                { label: 'Certificates', align: 'right', render: r => r.certificates },
                { label: 'Completion', align: 'right', render: r => percentText(r.completionRate) },
                { label: 'Quiz pass', align: 'right', render: r => percentText(r.passRate) },
                { label: 'Rating', align: 'right', render: r => (r.rating === null ? '—' : `${r.rating} / 5`) },
                { label: 'Revenue', align: 'right', render: r => money(r.revenue) },
              ]}
              footer={<p className={s.note}>Enrollments, certificates, quiz pass rate, rating and revenue are for the period. Course revenue shares each organization&apos;s purchases across the courses it used credits on (as in the Revenue report).</p>} />

            <ReportTable id="or-h" title={`Organization ranking — by ${orgLabel}`} rows={orgs} rowKey={r => r.orgId}
              empty="No organizations yet."
              actions={<RankBy value={orgRank} onChange={setOrgRank} options={ORG_RANKINGS} />}
              columns={[
                { label: '#', render: r => r.rank },
                { label: 'Organization', render: r => <><span className={s.nameCell}>{r.name}</span>{r.location && <span className={s.subText}>{r.location}</span>}</> },
                { label: 'Learners', align: 'right', render: r => r.learners },
                { label: `Active (${dau.days}d)`, align: 'right', render: r => `${r.activeLearners}${r.activeRate !== null ? ` (${r.activeRate}%)` : ''}` },
                { label: 'Enrollments', align: 'right', render: r => r.enrollments },
                { label: 'Completion', align: 'right', render: r => percentText(r.completionRate) },
                { label: 'Certificates', align: 'right', render: r => r.certificates },
                { label: 'Revenue', align: 'right', render: r => money(r.revenue) },
              ]}
              footer={<p className={s.note}>Learners are current; active learners are from the last {dau.days} days; enrollments, certificates and revenue are for the period.</p>} />
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
