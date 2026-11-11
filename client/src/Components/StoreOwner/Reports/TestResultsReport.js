'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon, useReport, PeriodFields, ReportTable, SplitBar, ShareCell, Badge } from '../../SuperAdmin/Reports/ReportParts';
import { dateLabel, periodText } from '../../SuperAdmin/Reports/reportFormat';
import { percentText } from '../../SuperAdmin/Reports/traineeData';
import { GRADE_STYLE, LEVEL, duration, gradeScaleText, rulesText } from './testResultsData';
import s from '../../SuperAdmin/Reports/Report.module.css';

const PAGE_SIZE = 20;

const Grade = ({ grade }) => (grade ? <span className={`${s.gradePill} ${s[GRADE_STYLE[grade].cls]}`} aria-label={`Grade ${grade}`}>{grade}</span> : '—');
const Result = ({ passed }) => <Badge tone={passed ? 'ok' : 'critical'} label={passed ? 'Pass' : 'Fail'} />;
const Person = ({ r }) => <><span className={s.nameCell}>{r.name}</span>{r.email && <span className={s.subText}>{r.email}</span>}</>;
const ChapterCell = ({ c }) => (c ? <>{c.chapter} <strong>{c.score}%</strong><span className={s.subText}>{c.course}</span></> : '—');

export default function TestResultsReport() {
  const [learnerId, setLearnerId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [exporting, setExporting] = useState(false);
  const state = useReport('test-results', { learnerId, courseId }, 'all', 'org-report');
  const { range, customInvalid, report, loading, error, startLoading } = state;
  const periodDesc = periodText(range.from, range.to);
  const employeeName = learnerId ? (report?.options.employees.find(e => e.id === learnerId)?.name || 'Selected employee') : 'All employees';
  const courseName = courseId ? (report?.options.courses.find(c => c.id === courseId)?.title || 'Selected course') : 'All courses';

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateTestResultsPDF } = await import('../../../lib/generateTestResultsPDF');
      await generateTestResultsPDF(report, { periodText: periodDesc, employee: employeeName, course: courseName });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;
  const oneEmployee = Boolean(learnerId), oneCourse = Boolean(courseId);
  const who = oneEmployee ? [] : [{ label: 'Employee', render: r => <Person r={r} /> }];
  const timeNote = t && t.timedAttempts < t.attempts ? ` Time is recorded for ${t.timedAttempts} of ${t.attempts} attempts (from now on).` : '';

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Test Results</h1>
          <p className={s.subtitle}>Taken {periodDesc} · {employeeName} · {courseName}</p>
        </div>
        <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
          <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
        </button>
      </header>

      <div className={s.filters} role="group" aria-label="Report filters">
        <PeriodFields state={state} label="Taken" />
        <label className={s.field}>
          <span>Employee</span>
          <select value={learnerId} onChange={e => { startLoading(); setLearnerId(e.target.value); }}>
            <option value="">All employees</option>
            {(report?.options.employees || []).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className={s.field}>
          <span>Course</span>
          <select value={courseId} onChange={e => { startLoading(); setCourseId(e.target.value); }}>
            <option value="">All courses</option>
            {(report?.options.courses || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      </div>
      {customInvalid && <p className={s.errorText}>The start date must be on or before the end date.</p>}
      {error && <p className={s.errorText}>{error}</p>}

      {loading && !report ? <p className={s.empty}>Loading test results…</p> : report && (
        <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
          <div>
            <section className={s.tiles} aria-label="Summary">
              <div className={`${s.tile} ${s.tileHero}`}>
                <span className={s.tileLabel}>Average score</span>
                <span className={s.heroValue}>{percentText(t.avgScore)} {t.grade && <Grade grade={t.grade} />}</span>
              </div>
              <div className={s.tile}><span className={s.tileLabel}>Attempts pass / fail</span><span className={s.tileValue}>{t.attemptsPassed} <small className={s.tileSub}>/ {t.attemptsFailed} · {percentText(t.passRate)} pass</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Questions skipped</span><span className={s.tileValue}>{percentText(t.skipRate)} <small className={s.tileSub}>{t.skipped} of {t.questions}</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Avg time per attempt</span><span className={s.tileValue}>{t.avgTimeSec === null ? '—' : duration(t.avgTimeSec)}</span></div>
            </section>
            <p className={s.statusLine}>{t.attempts} quiz attempt{t.attempts === 1 ? '' : 's'} on {t.quizzes} quiz{t.quizzes === 1 ? '' : 'zes'} by {t.employees} employee{t.employees === 1 ? '' : 's'}; {t.quizzesPassed} quiz{t.quizzesPassed === 1 ? '' : 'zes'} passed, {t.quizzesFailed} not passed yet.{timeNote}</p>
          </div>

          <div className={s.twoCol}>
            <section className={s.card} aria-labelledby="gr-h">
              <h2 id="gr-h" className={s.cardTitle}>Grades</h2>
              <p className={s.cardHint}>Best attempt on each quiz · {gradeScaleText(report.grades)}</p>
              <SplitBar label="Grades" parts={report.grades.map(g => ({ label: g.grade, value: report.gradeCounts[g.grade], className: s[GRADE_STYLE[g.grade].cls] }))} />
            </section>
            <section className={s.card} aria-labelledby="bw-h">
              <h2 id="bw-h" className={s.cardTitle}>Best / worst chapter</h2>
              {report.chapterRows.length === 0 ? <p className={s.empty}>No quiz attempts in this view.</p> : (
                <ul className={s.statRow}>
                  <li><span className={s.statLabel}>Best chapter</span><span className={s.statValue}><ChapterCell c={report.bestChapter && { ...report.bestChapter, score: report.bestChapter.avgScore }} /></span></li>
                  <li><span className={s.statLabel}>Worst chapter</span><span className={s.statValue}>{report.worstChapter ? <ChapterCell c={{ ...report.worstChapter, score: report.worstChapter.avgScore }} /> : '—'}</span></li>
                </ul>
              )}
            </section>
          </div>

          <ReportTable id="re-h" title="Results per employee" rows={report.perEmployee} rowKey={r => r.learnerId} pageSize={PAGE_SIZE}
            empty="No quiz attempts in this view."
            columns={[
              { label: 'Employee', render: r => <Person r={r} /> },
              { label: 'Score', align: 'right', render: r => percentText(r.avgScore) },
              { label: 'Grade', render: r => <Grade grade={r.grade} /> },
              { label: 'Best / worst', align: 'right', render: r => `${r.bestScore}% / ${r.worstScore}%` },
              { label: 'Attempts', align: 'right', render: r => r.attempts },
              { label: 'Pass / fail', align: 'right', render: r => `${r.attemptsPassed} / ${r.attemptsFailed}` },
              { label: 'Skipped', align: 'right', render: r => `${r.skipped} (${percentText(r.skipRate)})` },
              { label: 'Avg time', className: s.nowrap, render: r => duration(r.avgTimeSec) },
              { label: 'Best chapter', render: r => <ChapterCell c={r.bestChapter} /> },
              { label: 'Worst chapter', render: r => <ChapterCell c={r.worstChapter} /> },
            ]}
            footer={<p className={s.note}>Score = average of the employee&apos;s best attempt on each quiz. Best / worst = their highest / lowest single attempt.</p>} />

          <ReportTable id="cr-h" title="Results by chapter" rows={report.chapterRows} rowKey={r => `${r.courseId}-${r.chapterId}`} pageSize={PAGE_SIZE}
            empty="No quiz attempts in this view."
            columns={[
              ...(oneCourse ? [] : [{ label: 'Course', render: r => r.course }]),
              { label: 'Chapter', className: s.nameCell, render: r => r.chapter },
              { label: 'Employees', align: 'right', render: r => r.employees },
              { label: 'Attempts', align: 'right', render: r => r.attempts },
              { label: 'Avg score', render: r => (r.avgScore === null ? '—' : <ShareCell share={r.avgScore} />) },
              { label: 'Grade', render: r => <Grade grade={r.grade} /> },
              { label: 'Pass rate', align: 'right', render: r => percentText(r.passRate) },
              { label: 'Skipped', align: 'right', render: r => percentText(r.skipRate) },
              { label: 'Avg time', className: s.nowrap, render: r => duration(r.avgTimeSec) },
            ]}
            footer={<p className={s.note}>Best chapter first. Avg score = average of each employee&apos;s best attempt; pass rate = employees who passed the chapter quiz.</p>} />

          <ReportTable id="at-h" title="Attempts" rows={report.attempts} rowKey={(r, i) => `${r.learnerId}-${r.topicId}-${r.attempt}-${i}`} pageSize={PAGE_SIZE}
            empty="No quiz attempts in this view."
            columns={[
              ...who,
              ...(oneCourse ? [] : [{ label: 'Course', render: r => r.course }]),
              { label: 'Chapter / quiz', render: r => <>{r.chapter}<span className={s.subText}>{r.quiz}</span></> },
              { label: 'Attempt', align: 'right', render: r => `#${r.attempt}` },
              { label: 'Date', className: s.nowrap, render: r => dateLabel(r.takenAt) },
              { label: 'Score', align: 'right', render: r => `${r.score}%` },
              { label: 'Grade', render: r => <Grade grade={r.grade} /> },
              { label: 'Result', render: r => <><Result passed={r.passed} />{r.passMark !== null && <span className={s.subText}>pass mark {r.passMark}%</span>}</> },
              { label: 'Skipped', align: 'right', render: r => `${r.skipped}/${r.questions}` },
              { label: 'Time taken', className: s.nowrap, render: r => duration(r.timeTakenSec) },
            ]}
            footer={report.totals.attempts > report.attempts.length && <p className={s.note}>Showing the latest {report.attempts.length} of {report.totals.attempts} attempts.</p>} />

          <ReportTable id="ap-h" title="Aptitude tests" rows={report.aptitude} rowKey={(r, i) => i} pageSize={PAGE_SIZE}
            empty="No aptitude tests taken in this view."
            columns={[
              ...who,
              { label: 'Course', render: r => r.course },
              { label: 'Date', className: s.nowrap, render: r => dateLabel(r.takenAt) },
              { label: 'Score', align: 'right', render: r => `${r.score}%` },
              { label: 'Grade', render: r => <Grade grade={r.grade} /> },
              { label: 'Level', render: r => LEVEL[r.level] || '—' },
              { label: 'Skipped', align: 'right', render: r => `${r.skipped}/${r.questions}` },
              { label: 'Time taken', className: s.nowrap, render: r => duration(r.timeTakenSec) },
            ]} />

          <section className={s.card} aria-labelledby="tr-h">
            <h2 id="tr-h" className={s.cardTitle}>How results are worked out</h2>
            <ul className={s.rulesList}>{rulesText(report.grades).map(x => <li key={x}>{x}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
