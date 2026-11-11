'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon, useReport, ReportTable, ShareCell, Badge } from '../../SuperAdmin/Reports/ReportParts';
import { dateLabel } from '../../SuperAdmin/Reports/reportFormat';
import { percentText } from '../../SuperAdmin/Reports/traineeData';
import { PHASE_SHORT, QUIZ_RESULT, quizSummary, RULES_TEXT } from './employeeProgressData';
import { PhaseCell, StatusText } from './ProgressCells';
import s from '../../SuperAdmin/Reports/Report.module.css';

const PAGE_SIZE = 20;

const Person = ({ r }) => (
  <><span className={s.nameCell}>{r.name}</span>{r.email && <span className={s.subText}>{r.email}</span>}</>
);

export default function EmployeeProgressReport() {
  const [learnerId, setLearnerId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [exporting, setExporting] = useState(false);
  const state = useReport('progress', { learnerId, courseId }, 'all', 'org-report');
  const { report, loading, error, startLoading } = state;

  const employeeName = learnerId ? (report?.options.employees.find(e => e.id === learnerId)?.name || 'Selected employee') : 'All employees';
  const courseName = courseId ? (report?.options.courses.find(c => c.id === courseId)?.title || 'Selected course') : 'All courses';

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateEmployeeProgressPDF } = await import('../../../lib/generateEmployeeProgressPDF');
      await generateEmployeeProgressPDF(report, { employee: employeeName, course: courseName });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;
  const oneEmployee = Boolean(learnerId), oneCourse = Boolean(courseId);
  const who = oneEmployee ? [] : [{ label: 'Employee', render: r => <Person r={r} /> }];
  const which = oneCourse ? [] : [{ label: 'Course', className: s.minName, render: r => r.course }];

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Employee Progress</h1>
          <p className={s.subtitle}>Chapter-wise and phase-wise progress · {employeeName} · {courseName}</p>
        </div>
        <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
          <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
        </button>
      </header>

      <div className={s.filters} role="group" aria-label="Report filters">
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
      {error && <p className={s.errorText}>{error}</p>}

      {loading && !report ? <p className={s.empty}>Loading progress…</p> : report && (
        <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
          <div>
            <section className={s.tiles} aria-label="Summary">
              <div className={`${s.tile} ${s.tileHero}`}>
                <span className={s.tileLabel}>Average progress</span>
                <span className={s.heroValue}>{t.avgProgress === null ? '—' : `${t.avgProgress}%`} <small className={s.tileSub}>{t.enrollments} course{t.enrollments === 1 ? '' : 's'} · {t.employees} employee{t.employees === 1 ? '' : 's'}</small></span>
              </div>
              <div className={s.tile}><span className={s.tileLabel}>Chapters completed</span><span className={s.tileValue}>{t.chaptersDone} <small className={s.tileSub}>of {t.chapters}</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Quiz results</span><span className={s.tileValue}>{t.quizPassed} <small className={s.tileSub}>passed · {t.quizFailed} failed</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Courses completed</span><span className={s.tileValue}>{t.completed} <small className={s.tileSub}>{t.certificates} certificate{t.certificates === 1 ? '' : 's'}</small></span></div>
            </section>
            <p className={s.statusLine}>Progress is current (as of now). Pick an employee and / or a course above to focus the report.</p>
          </div>

          <ReportTable id="ph-h" title="Phase-wise progress" rows={report.phaseSummary} rowKey={p => p.key}
            empty="No enrolled courses."
            columns={[
              { label: 'Phase', className: s.nameCell, render: (p, i) => `${i + 1}. ${p.label}` },
              { label: 'Courses', align: 'right', render: p => p.applicable },
              { label: 'Finished', align: 'right', render: p => p.finished },
              { label: 'In progress', align: 'right', render: p => p.inProgress },
              { label: 'Not started', align: 'right', render: p => p.notStarted },
              { label: 'Items done', align: 'right', render: p => (p.total ? `${p.done} / ${p.total}` : '—') },
              { label: 'Progress', render: p => (p.rate === null ? '—' : <ShareCell share={p.rate} />) },
            ]}
            footer={<p className={s.note}>Courses = enrolled courses where the phase applies (e.g. only courses with an aptitude test count for phase 1). Items: tests taken, lessons watched, quizzes passed, homework / Zoom done, courses completed.</p>} />

          <ReportTable id="pe-h" title="Progress per employee" rows={report.enrollments} rowKey={r => `${r.learnerId}-${r.courseId}`} pageSize={PAGE_SIZE}
            empty="No enrolled courses for this selection."
            columns={[
              ...who, ...which,
              ...report.phases.map((p, i) => ({ label: `${i + 1}. ${PHASE_SHORT[p.key]}`, render: r => <PhaseCell phaseKey={p.key} p={r.phases[p.key]} /> })),
              { label: 'Chapters', align: 'right', render: r => `${r.chaptersDone}/${r.chapters}` },
              { label: 'Progress', render: r => <ShareCell share={r.progress} /> },
              { label: 'Result', render: r => <><StatusText status={r.status} /><span className={s.subText}>{quizSummary(r)}{r.avgBestScore !== null ? ` · avg best ${r.avgBestScore}%` : ''}</span></> },
            ]}
            footer={<p className={s.note}>Phases: 1 aptitude test, 2 lessons, 3 chapter quizzes, 4 homework &amp; Zoom, 5 completion &amp; certificate. ✓ done · ◐ in progress · ○ not started · — not in this course.</p>} />

          <ReportTable id="ch-h" title="Chapter-wise progress" rows={report.chapterRows} rowKey={r => `${r.learnerId}-${r.chapterId}`} pageSize={PAGE_SIZE}
            empty="No chapters for this selection."
            columns={[
              ...who, ...which,
              { label: 'Chapter', className: `${s.nameCell} ${s.nowrap}`, render: r => r.chapter },
              { label: 'Lessons', align: 'right', render: r => (r.lessons ? `${r.lessonsDone}/${r.lessons}` : '—') },
              { label: 'Quiz', render: r => (QUIZ_RESULT[r.result].tone ? <Badge tone={QUIZ_RESULT[r.result].tone} label={QUIZ_RESULT[r.result].label} /> : <span className={s.subText}>{QUIZ_RESULT[r.result].label}</span>) },
              { label: 'Best score', align: 'right', render: r => (r.bestScore === null ? '—' : `${r.bestScore}%`) },
              { label: 'Attempts', align: 'right', render: r => (r.quizzes ? r.attempts : '—') },
              { label: 'Homework', align: 'right', render: r => (r.homework ? `${r.homeworkDone}/${r.homework}` : '—') },
              { label: 'Zoom', align: 'right', render: r => (r.zoom ? `${r.zoomDone}/${r.zoom}` : '—') },
              { label: 'Progress', render: r => <ShareCell share={r.progress} /> },
              { label: 'Status', className: s.nowrap, render: r => <StatusText status={r.status} /> },
            ]} />

          {oneEmployee && (
            <p className={s.note}>Showing {employeeName}{oneCourse ? ` in ${courseName}` : ''}. Enrolled courses: {report.enrollments.map(e => `${e.course} (${dateLabel(e.enrolledAt)}, ${percentText(e.progress)})`).join('; ') || 'none'}.</p>
          )}

          <section className={s.card} aria-labelledby="pr-h">
            <h2 id="pr-h" className={s.cardTitle}>How progress and results are decided</h2>
            <ul className={s.rulesList}>{RULES_TEXT.map(x => <li key={x}>{x}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
