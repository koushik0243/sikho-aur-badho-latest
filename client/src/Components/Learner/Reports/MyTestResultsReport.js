'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon, useReport, PeriodFields, ReportTable, SplitBar, ShareCell, Badge } from '../../SuperAdmin/Reports/ReportParts';
import { dateLabel, periodText } from '../../SuperAdmin/Reports/reportFormat';
import { percentText } from '../../SuperAdmin/Reports/traineeData';
import { BAND_STYLE, DIFFICULTY_LABEL, duration, resultText, RULES_TEXT } from './myTestResultsData';
import s from '../../SuperAdmin/Reports/Report.module.css';

const PAGE_SIZE = 20;
const Stat = ({ label, value }) => <li><span className={s.statLabel}>{label}</span><span className={s.statValue}>{value}</span></li>;
const pctOrDash = v => (v === null || v === undefined ? '—' : `${v}%`);

/** Score summary for one question type (speech / MCQ). */
function ScoreCard({ id, title, block, bands, emptyText }) {
  return (
    <section className={s.card} aria-labelledby={id}>
      <h2 id={id} className={s.cardTitle}>{title}</h2>
      {block.questions === 0 ? <p className={s.empty}>{emptyText}</p> : (
        <>
          <ul className={s.statRow}>
            <Stat label="Score (answered)" value={pctOrDash(block.avgScore)} />
            <Stat label="With skips as 0" value={pctOrDash(block.overallScore)} />
            <Stat label="Answered" value={`${block.answered} of ${block.questions}`} />
          </ul>
          <h3 className={s.miniTitle}>Your answers</h3>
          <SplitBar label={`${title} answers`} parts={bands.map(b => ({ label: b.label, value: block.bands[b.key], className: s[BAND_STYLE[b.key].cls] }))} />
        </>
      )}
    </section>
  );
}

export default function MyTestResultsReport() {
  const [courseId, setCourseId] = useState('');
  const [exporting, setExporting] = useState(false);
  const state = useReport('test-results', { courseId }, 'all', 'my-report');
  const { range, customInvalid, report, loading, error, startLoading } = state;
  const periodDesc = periodText(range.from, range.to);
  const courseName = courseId ? (report?.options.courses.find(c => c.id === courseId)?.title || 'Selected course') : 'All my courses';

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateMyTestResultsPDF } = await import('../../../lib/generateMyTestResultsPDF');
      await generateMyTestResultsPDF(report, { periodText: periodDesc, course: courseName });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;
  const oneCourse = Boolean(courseId);
  const courseCol = oneCourse ? [] : [{ label: 'Course', render: r => r.course }];

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>My Test Results</h1>
          <p className={s.subtitle}>{report?.me?.name || 'Me'} · taken {periodDesc} · {courseName}</p>
        </div>
        <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
          <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
        </button>
      </header>

      <div className={s.filters} role="group" aria-label="Report filters">
        <PeriodFields state={state} label="Taken" />
        <label className={s.field}>
          <span>Course</span>
          <select value={courseId} onChange={e => { startLoading(); setCourseId(e.target.value); }}>
            <option value="">All my courses</option>
            {(report?.options.courses || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      </div>
      {customInvalid && <p className={s.errorText}>The start date must be on or before the end date.</p>}
      {error && <p className={s.errorText}>{error}</p>}

      {loading && !report ? <p className={s.empty}>Loading your test results…</p> : report && (
        <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
          <div>
            <section className={s.tiles} aria-label="Summary">
              <div className={`${s.tile} ${s.tileHero}`}>
                <span className={s.tileLabel}>Speech score</span>
                <span className={s.heroValue}>{pctOrDash(report.speech.avgScore)} <small className={s.tileSub}>on {report.speech.answered} answered</small></span>
              </div>
              <div className={s.tile}><span className={s.tileLabel}>MCQ score</span><span className={s.tileValue}>{report.mcq.questions ? pctOrDash(report.mcq.avgScore) : '—'} <small className={s.tileSub}>{report.mcq.questions ? `${report.mcq.answered} answered` : 'no MCQs yet'}</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Test score</span><span className={s.tileValue}>{pctOrDash(t.testScore)} <small className={s.tileSub}>{t.tests} test{t.tests === 1 ? '' : 's'}</small></span></div>
              <div className={`${s.tile} ${t.skipRate >= 50 ? s.tileAlert : ''}`}><span className={s.tileLabel}>Questions skipped</span><span className={s.tileValue}>{percentText(t.skipRate)} <small className={s.tileSub}>{t.skipped} of {t.shown}</small></span></div>
            </section>
            <p className={s.statusLine}>
              {t.quizAttempts} chapter quiz attempt{t.quizAttempts === 1 ? '' : 's'} and {t.aptitudeAttempts} aptitude test{t.aptitudeAttempts === 1 ? '' : 's'}.
              {t.allSkippedAttempts > 0 && ` ${t.allSkippedAttempts} test${t.allSkippedAttempts === 1 ? ' was' : 's were'} submitted without any answer.`}
              {t.blankAnswers > 0 && ` ${t.blankAnswers} answer${t.blankAnswers === 1 ? ' was' : 's were'} submitted blank (counted as skipped).`}
            </p>
          </div>

          <div className={s.twoCol}>
            <ScoreCard id="sp-h" title="Speech scores" block={report.speech} bands={report.bands} emptyText="No spoken answers in this view." />
            <ScoreCard id="mc-h" title="MCQ scores" block={report.mcq} bands={report.bands}
              emptyText="Your tests have no multiple-choice questions yet — every question so far is answered by speaking." />
          </div>

          <div className={s.twoCol}>
            <ReportTable id="sd-h" title="Skips by difficulty" rows={report.byDifficulty} rowKey={r => r.difficulty}
              empty="No questions in this view."
              columns={[
                { label: 'Difficulty', className: s.nameCell, render: r => DIFFICULTY_LABEL[r.difficulty] || r.difficulty },
                { label: 'Questions', align: 'right', render: r => r.shown },
                { label: 'Skipped', render: r => <ShareCell share={r.skipRate ?? 0} /> },
                { label: 'Score', align: 'right', render: r => pctOrDash(r.avgScore) },
              ]} />
            <ReportTable id="sp2-h" title="Skips by question position" rows={report.byPosition} rowKey={r => r.label}
              empty="No questions in this view."
              columns={[
                { label: 'Position', className: s.nameCell, render: r => r.label },
                { label: 'Questions', align: 'right', render: r => r.shown },
                { label: 'Skipped', render: r => <ShareCell share={r.skipRate ?? 0} /> },
              ]}
              footer={<p className={s.note}>A higher skip rate later in a test can mean time ran short.</p>} />
          </div>

          <ReportTable id="st-h" title="Skips by test" rows={report.byTest} rowKey={r => r.key} pageSize={PAGE_SIZE}
            empty="No tests in this view."
            columns={[
              { label: 'Test', className: s.nameCell, render: r => <>{r.test}{r.kind === 'aptitude' && <span className={s.subText}>Aptitude</span>}</> },
              ...courseCol,
              { label: 'Chapter', render: r => r.chapter },
              { label: 'Attempts', align: 'right', render: r => r.attempts },
              { label: 'Best score', align: 'right', render: r => pctOrDash(r.bestScore) },
              { label: 'Speech score', align: 'right', render: r => pctOrDash(r.speechScore) },
              { label: 'Skipped', render: r => <ShareCell share={r.skipRate ?? 0} /> },
              { label: 'Skipped / shown', align: 'right', render: r => `${r.skipped}/${r.shown}` },
            ]} />

          <ReportTable id="at-h" title="My attempts" rows={report.attempts} rowKey={(r, i) => i} pageSize={PAGE_SIZE}
            empty="No tests taken in this view."
            columns={[
              { label: 'Date', className: s.nowrap, render: r => dateLabel(r.takenAt) },
              { label: 'Test', render: r => <>{r.test}<span className={s.subText}>{r.kind === 'aptitude' ? 'Aptitude test' : r.chapter}</span></> },
              ...courseCol,
              { label: 'Score', align: 'right', render: r => `${r.score}%` },
              { label: 'Result', render: r => <Badge tone={r.kind === 'aptitude' ? 'info' : r.passed ? 'ok' : 'critical'} label={resultText(r)} /> },
              { label: 'Answered', align: 'right', render: r => `${r.answered}/${r.questions}` },
              { label: 'Skipped', align: 'right', render: r => percentText(r.skipRate) },
              { label: 'Time', className: s.nowrap, render: r => duration(r.timeTakenSec) },
            ]} />

          <div className={s.twoCol}>
            <ReportTable id="ms-h" title="Questions I skip most" rows={report.mostSkipped} rowKey={(r, i) => i}
              empty="You have not skipped any question."
              columns={[
                { label: 'Question', className: s.clip, render: r => <>{r.question}<span className={s.subText}>{r.test}</span></> },
                { label: 'Skipped', align: 'right', render: r => `${r.skipped}/${r.shown}` },
              ]} />
            <ReportTable id="lw-h" title="My lowest-scoring answers" rows={report.lowestScored} rowKey={(r, i) => i}
              empty="No spoken answers yet."
              columns={[
                { label: 'Question', className: s.clip, render: r => <>{r.question}{r.feedback && <span className={s.subText}>Feedback: {r.feedback}</span>}</> },
                { label: 'Score', align: 'right', render: r => `${r.avgScore}%` },
              ]} />
          </div>

          <section className={s.card} aria-labelledby="tr-h">
            <h2 id="tr-h" className={s.cardTitle}>How your results are worked out</h2>
            <ul className={s.rulesList}>{RULES_TEXT.map(x => <li key={x}>{x}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
