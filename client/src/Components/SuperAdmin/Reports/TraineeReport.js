'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ColumnChart from './ColumnChart';
import { DownloadIcon, useWidth, useReport, PeriodFields, ReportTable, SplitBar } from './ReportParts';
import { monthLabel, dateLabel, periodText } from './reportFormat';
import { TRAINEE_STATUS, STATUS_KEYS, statusCount, percentText } from './traineeData';
import s from './Report.module.css';

const statusClass = { completed: s.st_completed, in_progress: s.st_in_progress, not_started: s.st_not_started, dropout: s.st_dropout };

export default function TraineeReport() {
  const [orgId, setOrgId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [courses, setCourses] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [chartRef, chartWidth] = useWidth();
  const state = useReport('trainees', { orgId, courseId }, 'all');
  const { range, customInvalid, report, loading, error, startLoading } = state;

  useEffect(() => {
    apiServiceHandler('GET', 'organization/list-pagination?limit=1000')
      .then(res => setOrgs(Array.isArray(res?.data) ? res.data : [])).catch(() => setOrgs([]));
    apiServiceHandler('GET', 'course/list')
      .then(res => setCourses(Array.isArray(res?.data) ? res.data : [])).catch(() => setCourses([]));
  }, []);

  const orgName = orgId ? (orgs.find(o => String(o._id) === orgId)?.org_name || 'Selected organization') : 'All organizations';
  const courseName = courseId ? (courses.find(c => String(c._id) === courseId)?.title || 'Selected course') : 'All courses';
  const periodDesc = periodText(range.from, range.to);

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateTraineePDF } = await import('../../../lib/generateTraineePDF');
      await generateTraineePDF(report, { periodText: periodDesc, organization: orgName, course: courseName, oneCourse: Boolean(courseId) });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;
  const l = report?.learners;
  const chartData = (report?.monthly || []).map(m => ({ key: m.month, label: monthLabel(m.month), shortLabel: monthLabel(m.month, true), value: m.enrolled }));
  const enrollments = n => `${n} enrollment${n === 1 ? '' : 's'}`;

  return (
    <SuperAdminShell activeSection="report-trainees">
      <div className={s.page}>
        <header className={s.header}>
          <div>
            <h1 className={s.title}>Trainees</h1>
            <p className={s.subtitle}>Course enrollments · {periodDesc} · {orgName} · {courseName}</p>
          </div>
          <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
            <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
          </button>
        </header>

        <div className={s.filters} role="group" aria-label="Report filters">
          <PeriodFields state={state} label="Enrolled" />
          <label className={s.field}>
            <span>Organization</span>
            <select value={orgId} onChange={e => { startLoading(); setOrgId(e.target.value); }}>
              <option value="">All organizations</option>
              {orgs.map(o => <option key={o._id} value={o._id}>{o.org_name}</option>)}
            </select>
          </label>
          <label className={s.field}>
            <span>Course</span>
            <select value={courseId} onChange={e => { startLoading(); setCourseId(e.target.value); }}>
              <option value="">All courses</option>
              {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
            </select>
          </label>
        </div>
        {customInvalid && <p className={s.errorText}>The start date must be on or before the end date.</p>}
        {error && <p className={s.errorText}>{error}</p>}

        {loading && !report ? <p className={s.empty}>Loading trainees…</p> : report && (
          <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
            <div>
              <section className={s.tiles} aria-label="Summary">
                <div className={`${s.tile} ${s.tileHero}`}>
                  <span className={s.tileLabel}>Enrolled</span>
                  <span className={s.heroValue}>{t.enrolled}</span>
                </div>
                <div className={s.tile}><span className={s.tileLabel}>Completed</span><span className={s.tileValue}>{t.completed} <small className={s.tileSub}>{t.completionRate}%</small></span></div>
                <div className={s.tile}><span className={s.tileLabel}>Pending</span><span className={s.tileValue}>{t.pending}</span></div>
                <div className={s.tile}><span className={s.tileLabel}>Dropout</span><span className={s.tileValue}>{t.dropout} <small className={s.tileSub}>{t.dropoutRate}%</small></span></div>
              </section>
              <p className={s.statusLine}>
                One enrollment = one course assigned to one learner. Pending = {t.inProgress} in progress + {t.notStarted} not started ·
                Dropout = not completed and no learning activity for {report.dropoutDays}+ days.
              </p>
            </div>

            {/* ── Status, learners and monthly enrollments: one row, 4 of 12 columns each ── */}
            <div className={s.threeCol}>
              <section className={`${s.card} ${s.statusCard}`} aria-labelledby="status-h">
                <h2 id="status-h" className={s.cardTitle}>Enrollment status</h2>
                <div className={s.cardFigure}>
                  <span className={s.heroValue}>{t.enrolled ? `${t.completionRate}%` : '—'}</span>
                  <span className={s.figureNote}>completed · {t.completed} of {enrollments(t.enrolled)}</span>
                </div>
                {/* One stacked bar, then a row per status (count, share, own bar) filling the card */}
                <div className={s.splitBar} role="img"
                  aria-label={`Enrollment status: ${STATUS_KEYS.map(k => `${TRAINEE_STATUS[k].label} ${statusCount(t, k)}`).join(', ')}`}>
                  {t.enrolled === 0 ? <span className={s.splitEmpty} /> : STATUS_KEYS.filter(k => statusCount(t, k) > 0).map(k => (
                    <span key={k} className={statusClass[k]} style={{ flexGrow: statusCount(t, k) }} title={`${TRAINEE_STATUS[k].label}: ${statusCount(t, k)}`} />
                  ))}
                </div>
                <ul className={s.statusRows}>
                  {STATUS_KEYS.map(k => {
                    const n = statusCount(t, k);
                    const share = t.enrolled ? Math.round((n / t.enrolled) * 100) : 0;
                    return (
                      <li key={k} className={s.statusRow}>
                        <span className={`${s.legendDot} ${statusClass[k]}`} aria-hidden="true" />
                        <span className={s.statusName}>{TRAINEE_STATUS[k].label}</span>
                        <span className={s.statusNum}>{n}</span>
                        <span className={s.statusPct}>{share}%</span>
                        <span className={s.statusTrack} aria-hidden="true">{share > 0 && <span className={statusClass[k]} style={{ width: `${share}%` }} />}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
              <section className={s.card} aria-labelledby="active-h">
                <h2 id="active-h" className={s.cardTitle}>Active / inactive learners</h2>
                <p className={s.cardHint}>{l.total} learner{l.total === 1 ? '' : 's'} with enrollments in this view</p>
                <h3 className={s.miniTitle}>Learning in the last {report.dropoutDays} days</h3>
                <SplitBar label="Learning activity" parts={[
                  { label: 'Active', value: l.active, className: s.st_completed },
                  { label: 'Inactive', value: l.inactive, className: s.st_not_started },
                ]} />
                <h3 className={s.miniTitle}>Account status</h3>
                <SplitBar label="Account status" parts={[
                  { label: 'Active', value: l.accountActive, className: s.st_completed },
                  { label: 'Inactive', value: l.accountInactive, className: s.st_not_started },
                ]} />
              </section>
              <section className={s.card} aria-labelledby="enr-h">
                <div className={s.cardHead}>
                  <h2 id="enr-h" className={s.cardTitle}>Enrollments per month</h2>
                  {chartData.length > 0 && (
                    <button type="button" className={s.linkBtn} onClick={() => setShowTable(v => !v)} aria-pressed={showTable}>
                      {showTable ? 'Show chart' : 'Show as table'}
                    </button>
                  )}
                </div>
                {chartData.length === 0 ? <p className={s.empty}>No enrollments in this view.</p> : showTable ? (
                  <div className={`${s.tableWrap} ${s.chartSized}`}>
                    <table className={s.table}>
                      <thead><tr><th>Month</th><th className={s.num}>Enrolled</th></tr></thead>
                      <tbody>{report.monthly.map(m => <tr key={m.month}><td>{monthLabel(m.month)}</td><td className={s.num}>{m.enrolled}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : (
                  <div ref={chartRef} className={s.chartBox}>
                    <ColumnChart data={chartData} width={chartWidth} integer formatValue={enrollments} formatAxis={v => String(Math.round(v))} />
                  </div>
                )}
              </section>
            </div>

            <ReportTable id="chap-h" title="Chapter-wise performance" rows={report.chapters} rowKey={r => r.chapterId}
              empty="No chapters for the courses in this view."
              columns={[
                ...(courseId ? [] : [{ label: 'Course', className: s.nameCell, render: r => r.course }]),
                { label: 'Chapter', className: courseId ? s.nameCell : undefined, render: r => r.chapter },
                { label: 'Enrolled', align: 'right', render: r => r.enrolled },
                { label: 'Started', align: 'right', render: r => `${r.started} (${r.startedPct}%)` },
                { label: 'Lessons done', align: 'right', render: r => percentText(r.lessonCompletion) },
                { label: 'Took quiz', align: 'right', render: r => (r.hasQuiz ? r.quizTakers : '—') },
                { label: 'Pass rate', align: 'right', render: r => percentText(r.passRate) },
                { label: 'Avg score', align: 'right', render: r => percentText(r.avgScore) },
              ]}
              footer={<p className={s.note}>Lessons done = average share of the chapter&apos;s lesson videos fully watched by enrolled learners. Pass rate and average (best) score count learners who took the chapter quiz.</p>} />

            <ReportTable id="tr-h" title="Trainees" rows={report.trainees} rowKey={r => `${r.learnerId}-${r.courseId}`}
              empty="No enrollments in this view."
              columns={[
                { label: 'Learner', render: r => <><span className={s.nameCell}>{r.name}</span>{r.email && <span className={s.subText}>{r.email}</span>}</> },
                { label: 'Organization', render: r => r.organization },
                { label: 'Course', render: r => r.course },
                { label: 'Enrolled on', className: s.nowrap, render: r => dateLabel(r.enrolledAt) },
                { label: 'Progress', align: 'right', render: r => `${r.progress}%` },
                { label: 'Status', render: r => <span className={`${s.status} ${s[`tstatus_${r.status}`] || ''}`}>{TRAINEE_STATUS[r.status]?.label || r.status}</span> },
                { label: 'Last activity', className: s.nowrap, render: r => (r.lastActivity ? dateLabel(r.lastActivity) : 'Never') },
              ]}
              footer={report.traineeCount > report.trainees.length && (
                <p className={s.note}>Showing {report.trainees.length} of {report.traineeCount} enrollments (dropouts first).</p>
              )} />
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
