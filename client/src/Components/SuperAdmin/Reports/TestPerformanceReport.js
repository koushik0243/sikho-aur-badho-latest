'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import { DownloadIcon, useReport, PeriodFields, ReportTable, SplitBar, ShareCell } from './ReportParts';
import { dateLabel, periodText } from './reportFormat';
import { percentText } from './traineeData';
import { OUTCOME, LEVELS, daysText, doneText } from './testPerformanceData';
import AssignmentSubmissions from '../../AssignmentSubmissions/AssignmentSubmissions';
import s from './Report.module.css';

const levelClass = { beginner: s.lv_beginner, intermediate: s.lv_intermediate, expert: s.lv_expert };
const shareOrDash = v => (v === null || v === undefined ? '—' : <ShareCell share={v} />);

/** One figure in a row of small stats. */
const Stat = ({ label, value }) => (
  <li><span className={s.statLabel}>{label}</span><span className={s.statValue}>{value}</span></li>
);

/** Fastest → slowest completion on one line, with the median and average marked. */
function CompletionRange({ cp }) {
  const min = cp.fastestDays ?? 0;
  const max = cp.slowestDays ?? 0;
  const at = v => (max > min ? ((v - min) / (max - min)) * 100 : 50);
  const marks = [
    { key: 'median', label: 'Median', v: cp.medianDays, cls: s.ctMarkMedian },
    { key: 'avg', label: 'Average', v: cp.avgDays, cls: s.ctMarkAvg },
  ].filter(m => m.v !== null && m.v !== undefined);
  return (
    <div className={s.ctRange} role="img"
      aria-label={`Completion time ranges from ${daysText(min)} to ${daysText(max)}; median ${daysText(cp.medianDays)}, average ${daysText(cp.avgDays)}`}>
      <div className={s.ctTrack}>
        <span className={s.ctSpan} />
        {marks.map((m, i) => (
          <span key={m.key} className={`${s.ctMark} ${m.cls}`} style={{ left: `${at(m.v)}%` }}>
            <span className={`${s.ctMarkLabel} ${i === 0 ? s.ctBelow : s.ctAbove}`}>{m.label} · {daysText(m.v)}</span>
          </span>
        ))}
      </div>
      <div className={s.ctEnds}><span>Fastest · {daysText(min)}</span><span>Slowest · {daysText(max)}</span></div>
    </div>
  );
}

export default function TestPerformanceReport() {
  const [orgId, setOrgId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [courses, setCourses] = useState([]);
  const [exporting, setExporting] = useState(false);
  const state = useReport('test-performance', { orgId, courseId }, 'all');
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
  const oneCourse = Boolean(courseId);

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateTestPerformancePDF } = await import('../../../lib/generateTestPerformancePDF');
      await generateTestPerformancePDF(report, { periodText: periodDesc, organization: orgName, course: courseName, oneCourse });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const q = report?.quiz, sk = report?.skip, apt = report?.aptitude, hw = report?.homework, zm = report?.zoom, cp = report?.completion;
  const courseCol = oneCourse ? [] : [{ label: 'Course', render: r => r.course }];
  const activityColumns = (doneLabel, notDoneLabel) => [
    { label: 'Topic', className: s.nameCell, render: r => r.title },
    ...courseCol,
    { label: 'Chapter', render: r => r.chapter },
    { label: 'Enrolled', align: 'right', render: r => r.enrolled },
    { label: doneLabel, align: 'right', render: r => r.done },
    { label: notDoneLabel, align: 'right', render: r => r.notDone },
    { label: 'Rate', render: r => shareOrDash(r.rate) },
  ];

  return (
    <SuperAdminShell activeSection="report-test-performance">
      <div className={s.page}>
        <header className={s.header}>
          <div>
            <h1 className={s.title}>Test Performance</h1>
            <p className={s.subtitle}>Tests taken {periodDesc} · {orgName} · {courseName}</p>
          </div>
          <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
            <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
          </button>
        </header>

        <div className={s.filters} role="group" aria-label="Report filters">
          <PeriodFields state={state} label="Taken" />
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

        {loading && !report ? <p className={s.empty}>Loading test performance…</p> : report && (
          <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
            <div>
              <section className={s.tiles} aria-label="Summary">
                <div className={`${s.tile} ${s.tileHero}`}>
                  <span className={s.tileLabel}>Quiz pass rate</span>
                  <span className={s.heroValue}>{percentText(q.passRate)}</span>
                </div>
                <div className={s.tile}><span className={s.tileLabel}>Questions skipped</span><span className={s.tileValue}>{percentText(sk.rate)}</span></div>
                <div className={s.tile}><span className={s.tileLabel}>Aptitude avg score</span><span className={s.tileValue}>{percentText(apt.avgScore)}</span></div>
                <div className={s.tile}><span className={s.tileLabel}>Avg completion time</span><span className={s.tileValue}>{daysText(cp.avgDays)}</span></div>
              </section>
              <p className={s.statusLine}>
                The period filters quiz and aptitude attempts by the date taken, and completions by the date completed.
                Homework and Zoom show the current status of every enrolled learner.
              </p>
            </div>

            <div className={s.twoCol}>
              <section className={s.card} aria-labelledby="pf-h">
                <h2 id="pf-h" className={s.cardTitle}>Quiz pass / fail</h2>
                <ul className={s.statRow}>
                  <Stat label="Attempts" value={q.attempts} />
                  <Stat label="Average score" value={percentText(q.avgScore)} />
                </ul>
                <h3 className={s.miniTitle}>Attempts</h3>
                <SplitBar label="Quiz attempts" parts={[
                  { label: OUTCOME.passed.label, value: q.passed, className: s.st_pass },
                  { label: OUTCOME.failed.label, value: q.failed, className: s.st_fail },
                  { label: OUTCOME.pending.label, value: q.pendingEvaluation, className: s.st_pending },
                ]} />
                <h3 className={s.miniTitle}>Learners per quiz</h3>
                <SplitBar label="Learners per quiz" parts={[
                  { label: 'Passed', value: q.learnerQuizPassed, className: s.st_pass },
                  { label: 'Not passed yet', value: q.learnerQuizFailed, className: s.st_fail },
                ]} />
                <p className={s.note}>Learners per quiz counts each learner once per quiz: passed if any attempt passed.</p>
              </section>

              <section className={s.card} aria-labelledby="apt-h">
                <h2 id="apt-h" className={s.cardTitle}>Aptitude test results</h2>
                <ul className={s.statRow}>
                  <Stat label="Attempts" value={apt.attempts} />
                  <Stat label="Learners" value={apt.learners} />
                  <Stat label="Average score" value={percentText(apt.avgScore)} />
                  <Stat label="Skipped" value={percentText(apt.skipRate)} />
                </ul>
                <h3 className={s.miniTitle}>Level reached</h3>
                <SplitBar label="Aptitude level" parts={LEVELS.map(lv => ({ label: lv.label, value: apt.levels[lv.key], className: levelClass[lv.key] }))} />
              </section>
            </div>

            <ReportTable id="cm-h" title="Chapter-wise marks" rows={report.chapterMarks} rowKey={r => r.chapterId}
              empty="No quiz attempts in this view."
              columns={[
                ...courseCol.map(c => ({ ...c, className: s.nameCell })),
                { label: 'Chapter', className: oneCourse ? s.nameCell : undefined, render: r => r.chapter },
                { label: 'Attempts', align: 'right', render: r => r.attempts },
                { label: 'Learners', align: 'right', render: r => r.learners },
                { label: 'Avg score', render: r => shareOrDash(r.avgScore) },
                { label: 'Avg best score', align: 'right', render: r => percentText(r.avgBest) },
                { label: 'Pass rate', align: 'right', render: r => percentText(r.passRate) },
                { label: 'Skip rate', align: 'right', render: r => percentText(r.skipRate) },
              ]}
              footer={<p className={s.note}>Avg score = mean of all evaluated attempts · Avg best score = each learner&apos;s best attempt, averaged.</p>} />

            <ReportTable id="sk-h" title="Question skip rate" rows={sk.mostSkipped} rowKey={(r, i) => i}
              empty="No skipped questions in this view."
              actions={<span className={s.cardHint}>{sk.skipped} of {sk.shown} questions skipped ({percentText(sk.rate)})</span>}
              columns={[
                { label: 'Question', className: `${s.nameCell} ${s.clip}`, render: r => r.question },
                ...courseCol,
                { label: 'Chapter', render: r => r.chapter },
                { label: 'Shown', align: 'right', render: r => r.shown },
                { label: 'Skipped', align: 'right', render: r => r.skipped },
                { label: 'Skip rate', render: r => <ShareCell share={r.skipRate} /> },
              ]}
              footer={<p className={s.note}>The {sk.mostSkipped.length > 1 ? `${sk.mostSkipped.length} questions` : 'question'} learners skip most in quizzes.</p>} />

            <ReportTable id="aptc-h" title="Aptitude results by course" rows={apt.byCourse} rowKey={r => r.course}
              empty="No aptitude tests taken in this view."
              columns={[
                { label: 'Course', className: s.nameCell, render: r => r.course },
                { label: 'Attempts', align: 'right', render: r => r.attempts },
                { label: 'Learners', align: 'right', render: r => r.learners },
                { label: 'Avg score', render: r => shareOrDash(r.avgScore) },
                ...LEVELS.map(lv => ({ label: lv.label, align: 'right', render: r => r[lv.key] })),
              ]} />

            <ReportTable id="hw-h" title="Homework done" rows={hw.rows} rowKey={r => r.topicId}
              empty="No homework assignments in the courses in this view."
              actions={hw.rows.length > 0 && <span className={s.cardHint}>{doneText(hw.done, hw.enrolled, hw.rate)} done</span>}
              columns={activityColumns('Done', 'Not done')}
              footer={<p className={s.note}>Done = the learner uploaded a video of the finished assignment in the course player (watch them below). Assignments completed before videos were required count as done without a video.</p>} />

            <AssignmentSubmissions title="Homework video submissions" courseId={courseId} orgId={orgId}
              sub="Videos learners uploaded after completing a homework assignment — newest first." />

            <ReportTable id="zm-h" title="Zoom meetings joined" rows={zm.rows} rowKey={r => r.topicId}
              empty="No Zoom sessions in the courses in this view."
              actions={zm.rows.length > 0 && <span className={s.cardHint}>{doneText(zm.joined, zm.enrolled, zm.rate)} joined</span>}
              columns={activityColumns('Joined', 'Not joined')}
              footer={<p className={s.note}>Joined = the learner opened the meeting with the Join button in the course player. Zoom doesn&apos;t report back how long they stayed.</p>} />

            <section className={`${s.card} ${s.ctCard}`} aria-labelledby="ct-h">
              <div className={s.cardHead}>
                <div>
                  <h2 id="ct-h" className={s.cardTitle}>Course completion time</h2>
                  <p className={s.cardHint}>From the day the course was assigned to the day it was completed.</p>
                </div>
                {cp.count > 0 && <span className={s.ctCount}>{cp.count} completion{cp.count === 1 ? '' : 's'}</span>}
              </div>
              {cp.count === 0 ? <p className={s.empty}>No course completions in this view.</p> : (
                <div className={s.ctBody}>
                  <div className={s.ctHero}>
                    <span className={s.ctHeroLabel}>Average time to complete</span>
                    <span className={s.ctHeroValue}>{daysText(cp.avgDays)}</span>
                    <span className={s.ctHeroNote}>Half of all completions took {daysText(cp.medianDays)} or less</span>
                  </div>
                  <ul className={s.ctStats}>
                    <li><span className={s.ctStatLabel}>Median</span><span className={s.ctStatValue}>{daysText(cp.medianDays)}</span></li>
                    <li><span className={s.ctStatLabel}>Fastest</span><span className={s.ctStatValue}>{daysText(cp.fastestDays)}</span></li>
                    <li><span className={s.ctStatLabel}>Slowest</span><span className={s.ctStatValue}>{daysText(cp.slowestDays)}</span></li>
                  </ul>
                  <CompletionRange cp={cp} />
                </div>
              )}
            </section>

            {cp.count > 0 && !oneCourse && (
              <ReportTable id="ctc-h" title="Completion time by course" rows={cp.byCourse} rowKey={r => r.course} empty=""
                columns={[
                  { label: 'Course', className: s.nameCell, render: r => r.course },
                  { label: 'Completions', align: 'right', render: r => r.completions },
                  { label: 'Average', align: 'right', render: r => daysText(r.avgDays) },
                  { label: 'Fastest', align: 'right', render: r => daysText(r.fastestDays) },
                  { label: 'Slowest', align: 'right', render: r => daysText(r.slowestDays) },
                ]} />
            )}

            {cp.count > 0 && (
              <ReportTable id="ctl-h" title="Completed courses" rows={cp.list} rowKey={(r, i) => i} empty=""
                columns={[
                  { label: 'Learner', render: r => <><span className={s.nameCell}>{r.name}</span>{r.email && <span className={s.subText}>{r.email}</span>}</> },
                  { label: 'Organization', render: r => r.organization },
                  ...courseCol,
                  { label: 'Assigned', className: s.nowrap, render: r => dateLabel(r.enrolledAt) },
                  { label: 'Completed', className: s.nowrap, render: r => dateLabel(r.completedAt) },
                  { label: 'Time taken', align: 'right', render: r => daysText(r.days) },
                ]}
                footer={cp.count > cp.list.length && <p className={s.note}>Showing the latest {cp.list.length} of {cp.count} completions.</p>} />
            )}
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
