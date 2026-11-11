'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DownloadIcon, useReport, ReportTable, Badge } from '../../SuperAdmin/Reports/ReportParts';
import { percentText } from '../../SuperAdmin/Reports/traineeData';
import { PRIORITY, rulesText } from './weakAreasData';
import s from '../../SuperAdmin/Reports/Report.module.css';
import w from './MyWeakAreas.module.css';

const PAGE_SIZE = 20;
const SKIP_FILTERS = [{ value: 'still', label: 'Still skipped' }, { value: 'all', label: 'All' }];

const svg = d => <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d={d} /></svg>;
const ICON = {
  chapter: svg('M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z'),
  skip:    svg('M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z'),
  watch:   svg('M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z'),
  retake:  svg('M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z'),
  step:    svg('M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'),
  bulb:    svg('M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z'),
  info:    svg('M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'),
  arrow:   svg('M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z'),
  done:    svg('M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'),
};

/** A small labelled meter (0–100) used on each chapter card. */
function Meter({ label, value, pct, tone = '' }) {
  const v = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return (
    <div className={w.meter}>
      <div className={w.meterTop}><span>{label}</span><strong>{value}</strong></div>
      <div className={`${w.meterTrack} ${tone ? w[`meter_${tone}`] : ''}`} aria-hidden="true">{v > 0 && <span style={{ width: `${v}%` }} />}</div>
    </div>
  );
}

/** One low chapter: why it is weak + what to do, in order. */
function PlanCard({ c, index }) {
  const pr = PRIORITY[c.priority] || PRIORITY.low;
  return (
    <li className={`${w.plan} ${w[`plan_${c.priority}`] || ''}`}>
      <div className={w.planHead}>
        <span className={w.planNum} aria-hidden="true">{index + 1}</span>
        <div className={w.planHeadText}>
          <h3 className={w.planTitle}>{c.chapter}</h3>
          <span className={w.planCourse}>{c.course}</span>
        </div>
        <Badge tone={pr.tone} label={pr.label} />
      </div>

      <div className={w.meters}>
        <Meter label="Best score" value={c.bestScore === null ? '—' : `${c.bestScore}%`} pct={c.bestScore} tone={c.result === 'failed' ? 'bad' : ''} />
        <Meter label="Skipped" value={percentText(c.skipRate)} pct={c.skipRate} tone={c.skipRate >= 50 ? 'warn' : ''} />
        <Meter label="Chapter progress" value={`${c.progress}%`} pct={c.progress} />
        <div className={w.facts}>
          <span><strong>{c.attempts}</strong> attempt{c.attempts === 1 ? '' : 's'}</span>
          <span><strong>{c.lessons ? `${c.lessonsWatched}/${c.lessons}` : '—'}</strong> lessons watched</span>
        </div>
      </div>

      <div className={w.reasons} aria-label="Why this chapter is listed">
        {c.reasons.map(r => <span key={r} className={w.reason}>{r}</span>)}
      </div>

      <h4 className={w.stepsTitle}>What to do next</h4>
      <ol className={w.steps}>
        {c.steps.map((step, i) => (
          <li key={i} className={w.step}>
            <span className={`${w.stepIcon} ${w[`step_${step.kind}`] || ''}`}>{ICON[step.kind] || ICON.step}</span>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>

      {c.feedback.length > 0 && (
        <details className={w.feedback}>
          <summary>What the AI said about your answers <span className={w.count}>{c.feedback.length}</span></summary>
          <ul>
            {c.feedback.map((f, i) => (
              <li key={i}>
                <div className={w.fbHead}><span className={w.fbQ}>“{f.question}”</span><span className={w.fbScore}>{f.score}%</span></div>
                <p>{f.feedback}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className={w.planFoot}>
        <Link href={`/learner/courses/${c.courseId}`} className={w.cta}>Continue {c.course} {ICON.arrow}</Link>
      </div>
    </li>
  );
}

export default function MyWeakAreasReport() {
  const [courseId, setCourseId] = useState('');
  const [skipFilter, setSkipFilter] = useState('still');
  const [exporting, setExporting] = useState(false);
  const state = useReport('weak-areas', { courseId }, 'all', 'my-report');
  const { report, loading, error, startLoading } = state;
  const courseName = courseId ? (report?.options.courses.find(c => c.id === courseId)?.title || 'Selected course') : 'All my courses';

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateMyWeakAreasPDF } = await import('../../../lib/generateMyWeakAreasPDF');
      await generateMyWeakAreasPDF(report, { course: courseName });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;
  const skipped = report ? report.skippedQuestions.filter(q => skipFilter === 'all' || q.stillSkipped) : [];
  const oneCourse = Boolean(courseId);
  const KPIS = t ? [
    { key: 'low', icon: ICON.chapter, label: 'Low chapters', value: t.lowChapters, hint: `${t.highPriority} high priority`, tone: t.highPriority > 0 ? 'bad' : '' },
    { key: 'skip', icon: ICON.skip, label: 'Skipped questions', value: t.skippedQuestions, hint: `${t.stillSkipped} still skipped`, tone: t.stillSkipped > 0 ? 'warn' : '' },
    { key: 'watch', icon: ICON.watch, label: 'Lessons to watch', value: t.lessonsToWatch, hint: t.lessonsToWatch ? 'Unwatched in weak chapters' : 'All watched' },
    { key: 'retake', icon: ICON.retake, label: 'Quizzes to retake', value: t.quizzesToRetake, hint: t.quizzesToRetake ? 'Not passed yet' : 'Nothing to retake' },
  ] : [];

  return (
    <div className={`${s.page} ${w.page}`}>
      <header className={s.header}>
        <div>
          <span className={w.eyebrow}>My reports</span>
          <h1 className={s.title}>My Weak Areas</h1>
          <p className={s.subtitle}>{report?.me?.name || 'Me'} · {courseName} · what to revise next</p>
        </div>
        <div className={w.headActions}>
          <label className={`${s.field} ${w.courseField}`}>
            <span>Course</span>
            <select value={courseId} onChange={e => { startLoading(); setCourseId(e.target.value); }}>
              <option value="">All my courses</option>
              {(report?.options.courses || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
            <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
          </button>
        </div>
      </header>
      {error && <p className={s.errorText}>{error}</p>}

      {loading && !report ? <p className={s.empty}>Finding your weak areas…</p> : report && (
        <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
          <section className={w.kpis} aria-label="Summary">
            {KPIS.map(k => (
              <div key={k.key} className={`${w.kpi} ${k.tone ? w[`kpi_${k.tone}`] : ''}`}>
                <span className={w.kpiIcon}>{k.icon}</span>
                <div>
                  <div className={w.kpiValue}>{k.value}</div>
                  <div className={w.kpiLabel}>{k.label}</div>
                  <div className={w.kpiHint}>{k.hint}</div>
                </div>
              </div>
            ))}
          </section>

          <div className={w.layout}>
            <section className={w.planCol} aria-labelledby="lc-h">
              <div className={w.colHead}>
                <h2 id="lc-h" className={w.colTitle}>Your revision plan</h2>
                <span className={w.colSub}>{report.lowChapters.length} chapter{report.lowChapters.length === 1 ? '' : 's'} to revise, most urgent first</span>
              </div>
              {report.lowChapters.length === 0 ? (
                <div className={w.allGood}>
                  <span className={w.allGoodIcon}>{ICON.done}</span>
                  <div><strong>No weak chapters</strong><p>Every chapter you started is on track. Keep going!</p></div>
                </div>
              ) : (
                <ol className={w.plans}>{report.lowChapters.map((c, i) => <PlanCard key={`${c.courseId}-${c.chapterId}`} c={c} index={i} />)}</ol>
              )}
            </section>

            <aside className={w.side}>
              {report.tips.length > 0 && (
                <section className={w.tips} aria-labelledby="tp-h">
                  <h2 id="tp-h" className={w.sideTitle}><span className={w.sideIcon}>{ICON.bulb}</span> Revision tips</h2>
                  <ul>{report.tips.map(x => <li key={x}>{x}</li>)}</ul>
                </section>
              )}
              <details className={w.rules}>
                <summary><span className={w.sideIcon}>{ICON.info}</span> How weak areas are found</summary>
                <ul>{rulesText(report.rules).map(x => <li key={x}>{x}</li>)}</ul>
              </details>
            </aside>
          </div>

          <ReportTable id="sq-h" title="Skipped questions" rows={skipped} rowKey={(r, i) => `${r.question}-${i}`} pageSize={PAGE_SIZE}
            empty={skipFilter === 'still' ? 'No question is still skipped.' : 'You have not skipped any question.'}
            actions={report.skippedQuestions.length > 0 && (
              <div className={s.chips} role="group" aria-label="Skipped questions">
                {SKIP_FILTERS.map(f => (
                  <button key={f.value} type="button" className={s.chipBtn} aria-pressed={skipFilter === f.value} onClick={() => setSkipFilter(f.value)}>
                    {f.label} {f.value === 'all' ? t.skippedQuestions : t.stillSkipped}
                  </button>
                ))}
              </div>
            )}
            columns={[
              { label: 'Question', className: s.clip, render: r => r.question },
              { label: 'Quiz', render: r => <>{r.quiz}<span className={s.subText}>{r.chapter}</span></> },
              ...(oneCourse ? [] : [{ label: 'Course', render: r => r.course }]),
              { label: 'Skipped', align: 'right', render: r => `${r.skipped}/${r.shown}` },
              { label: 'Last time', render: r => (r.stillSkipped ? <Badge tone="critical" label="Skipped" /> : <Badge tone="ok" label={`Answered ${r.lastScore}%`} />) },
            ]}
            footer={<p className={s.note}>Expected answers are not shown — rewatch the chapter&apos;s lessons, then answer in your own words. Skipped questions score 0; a partial answer earns marks.</p>} />
        </div>
      )}
    </div>
  );
}
