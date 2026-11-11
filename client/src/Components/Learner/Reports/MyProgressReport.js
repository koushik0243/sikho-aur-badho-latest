'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon, useReport, ReportTable, SplitBar, ShareCell, Badge } from '../../SuperAdmin/Reports/ReportParts';
import { dateLabel } from '../../SuperAdmin/Reports/reportFormat';
import { PHASE_SHORT, QUIZ_RESULT } from '../../StoreOwner/Reports/employeeProgressData';
import { PhaseCell, StatusText } from '../../StoreOwner/Reports/ProgressCells';
import { RULES_TEXT, testResultText } from './myProgressData';
import s from '../../SuperAdmin/Reports/Report.module.css';
import pg from './MyProgress.module.css';

const PAGE_SIZE = 20;
const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

export default function MyProgressReport() {
  const [courseId, setCourseId] = useState('');
  const [exporting, setExporting] = useState(false);
  const state = useReport('progress', { courseId }, 'all', 'my-report');
  const { report, loading, error, startLoading } = state;
  const courseName = courseId ? (report?.options.courses.find(c => c.id === courseId)?.title || 'Selected course') : 'All my courses';

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateMyProgressPDF } = await import('../../../lib/generateMyProgressPDF');
      await generateMyProgressPDF(report, { course: courseName });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;
  const oneCourse = Boolean(courseId);
  const courseCol = oneCourse ? [] : [{ label: 'Course', render: r => r.course }];
  const currentIds = new Set((report?.courses || []).map(c => c.currentChapter?.chapterId).filter(Boolean));

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>My Progress</h1>
          <p className={s.subtitle}>{report?.me?.name || 'Me'} · {courseName}</p>
        </div>
        <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
          <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
        </button>
      </header>

      <div className={s.filters} role="group" aria-label="Report filters">
        <label className={s.field}>
          <span>Course</span>
          <select value={courseId} onChange={e => { startLoading(); setCourseId(e.target.value); }}>
            <option value="">All my courses</option>
            {(report?.options.courses || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      </div>
      {error && <p className={s.errorText}>{error}</p>}

      {loading && !report ? <p className={s.empty}>Loading your progress…</p> : report && (
        <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
          <div>
            <section className={s.tiles} aria-label="Summary">
              <div className={`${s.tile} ${s.tileHero}`}>
                <span className={s.tileLabel}>Overall</span>
                <span className={s.heroValue}>{t.overall === null ? '—' : `${t.overall}%`} <small className={s.tileSub}>{t.completedCourses} of {t.courses} course{t.courses === 1 ? '' : 's'} completed</small></span>
              </div>
              <div className={s.tile}><span className={s.tileLabel}>My score</span><span className={s.tileValue}>{t.myScore === null ? '—' : `${t.myScore}%`} <small className={s.tileSub}>average best quiz score</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Chapters</span><span className={s.tileValue}>{t.chaptersDone} <small className={s.tileSub}>completed · {t.chaptersPending} pending</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Tests passed</span><span className={s.tileValue}>{t.testsPassed} <small className={s.tileSub}>of {t.testsPassed + t.testsFailed} taken</small></span></div>
            </section>
            <p className={s.statusLine}>{t.certificates} certificate{t.certificates === 1 ? '' : 's'} earned. Your progress is as of now.</p>
          </div>

          {report.courses.length === 0 ? <p className={s.empty}>You have no courses yet.</p> : (
            <>
              <div className={s.twoCol}>
                <section className={s.card} aria-labelledby="ch-h">
                  <h2 id="ch-h" className={s.cardTitle}>Chapters completed / pending</h2>
                  <SplitBar label="Chapters" parts={[
                    { label: 'Completed', value: t.chaptersDone, className: s.st_completed },
                    { label: 'Pending', value: t.chaptersPending, className: s.st_not_started },
                  ]} />
                  <h3 className={pg.byCourseTitle}>By course</h3>
                  <ul className={pg.byCourse}>
                    {report.courses.map(c => {
                      const done = c.chaptersDone || 0;
                      const pending = c.chaptersPending || 0;
                      return (
                        <li key={c.courseId} className={pg.courseRow}>
                          <div className={pg.courseTop}>
                            <span className={pg.courseName} title={c.course}>{c.course}</span>
                            <span className={pg.courseCount}><strong>{done}</strong> of {c.chapters} done</span>
                          </div>
                          <div className={pg.courseBar} role="img" aria-label={`${c.course}: ${done} completed, ${pending} pending`}>
                            {done + pending === 0 ? <span className={pg.barEmpty} /> : <>
                              {done > 0 && <span className={s.st_completed} style={{ flexGrow: done }} title={`Completed: ${done}`} />}
                              {pending > 0 && <span className={s.st_not_started} style={{ flexGrow: pending }} title={`Pending: ${pending}`} />}
                            </>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
                <section className={s.card} aria-labelledby="cur-h">
                  <h2 id="cur-h" className={s.cardTitle}>Current chapter</h2>
                  <ul className={s.performerList}>
                    {report.courses.map(c => (
                      <li key={c.courseId}>
                        <span className={s.nameCell}>{c.currentChapter ? c.currentChapter.title : 'All chapters done'}</span>
                        {c.currentChapter ? <Badge tone="info" label={`${c.currentChapter.progress}%`} /> : <Badge tone="ok" label="Completed" />}
                        <span className={s.subText}>{c.course}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <ReportTable id="mc-h" title="My courses — phase status" rows={report.courses} rowKey={r => r.courseId}
                empty="No courses."
                columns={[
                  { label: 'Course', className: `${s.nameCell} ${s.minName}`, render: r => r.course },
                  { label: 'Overall', render: r => <ShareCell share={r.progress} /> },
                  { label: 'Status', className: s.nowrap, render: r => <StatusText status={r.status} /> },
                  { label: 'Chapters', align: 'right', render: r => `${r.chaptersDone} done · ${r.chaptersPending} pending` },
                  ...report.phases.map((p, i) => ({ label: `${i + 1}. ${PHASE_SHORT[p.key]}`, render: r => <PhaseCell phaseKey={p.key} p={r.phases[p.key]} /> })),
                ]}
                footer={<p className={s.note}>✓ done · ◐ in progress · ○ not started · — not part of the course.</p>} />

              <ReportTable id="te-h" title="Tests" rows={report.tests} rowKey={r => r.topicId} pageSize={PAGE_SIZE}
                empty="You have not taken a chapter quiz yet."
                columns={[
                  { label: 'Quiz', className: s.nameCell, render: r => r.quiz },
                  ...courseCol,
                  { label: 'Chapter', render: r => r.chapter },
                  { label: 'Result', render: r => <><Badge tone={r.passed ? 'ok' : 'critical'} label={r.passed ? 'Passed' : 'Not passed'} /><span className={s.subText}>{testResultText(r)}</span></> },
                  { label: 'Best marks', align: 'right', render: r => `${r.bestScore}%` },
                  { label: 'Pass mark', align: 'right', render: r => (r.passMark === null ? '—' : `${r.passMark}%`) },
                  { label: 'Attempts', align: 'right', render: r => r.attempts },
                  { label: 'Passed on', className: s.nowrap, render: r => (r.passedAt ? dateLabel(r.passedAt) : '—') },
                ]}
                footer={report.aptitude.length > 0 && <p className={s.note}>Aptitude tests: {report.aptitude.map(a => `${a.course} — ${LEVEL[a.level] || a.level} (${a.score}%)`).join('; ')}.</p>} />

              <ReportTable id="cp-h" title="Chapter-wise progress" rows={report.chapterRows} rowKey={r => `${r.courseId}-${r.chapterId}`} pageSize={PAGE_SIZE}
                empty="No chapters."
                columns={[
                  ...courseCol,
                  { label: 'Chapter', className: `${s.nameCell} ${s.nowrap}`, render: r => <>{r.chapter}{currentIds.has(r.chapterId) && <> <Badge tone="info" label="Current" /></>}</> },
                  { label: 'Lessons', align: 'right', render: r => (r.lessons ? `${r.lessonsDone}/${r.lessons}` : '—') },
                  { label: 'Quiz', render: r => (QUIZ_RESULT[r.result].tone ? <Badge tone={QUIZ_RESULT[r.result].tone} label={QUIZ_RESULT[r.result].label} /> : <span className={s.subText}>{QUIZ_RESULT[r.result].label}</span>) },
                  { label: 'Best score', align: 'right', render: r => (r.bestScore === null ? '—' : `${r.bestScore}%`) },
                  { label: 'Homework', align: 'right', render: r => (r.homework ? `${r.homeworkDone}/${r.homework}` : '—') },
                  { label: 'Zoom', align: 'right', render: r => (r.zoom ? `${r.zoomDone}/${r.zoom}` : '—') },
                  { label: 'Progress', render: r => <ShareCell share={r.progress} /> },
                  { label: 'Status', className: s.nowrap, render: r => <StatusText status={r.status} /> },
                ]} />
            </>
          )}

          <section className={s.card} aria-labelledby="mr-h">
            <h2 id="mr-h" className={s.cardTitle}>How your progress is worked out</h2>
            <ul className={s.rulesList}>{RULES_TEXT.map(x => <li key={x}>{x}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
