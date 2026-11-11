'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import { DownloadIcon, useReport, PeriodFields, ReportTable, ShareCell } from './ReportParts';
import { dateLabel, periodText } from './reportFormat';
import { percentText } from './traineeData';
import { SEVERITY, ISSUE_SEVERITIES, FLAG_KIND, rulesText } from './chapterQualityData';
import s from './Report.module.css';
import { orDash } from '../../../lib/displayValue';

const SEV_ICON = {
  critical: 'M10 2a1 1 0 01.87.5l7 12A1 1 0 0117 16H3a1 1 0 01-.87-1.5l7-12A1 1 0 0110 2zm0 5a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1zm0 7.5a1 1 0 100-2 1 1 0 000 2z',
  warning: 'M10 18a8 8 0 100-16 8 8 0 000 16zm0-12a1 1 0 011 1v3a1 1 0 11-2 0V7a1 1 0 011-1zm0 8.5a1 1 0 100-2 1 1 0 000 2z',
  info: 'M10 18a8 8 0 100-16 8 8 0 000 16zm0-11.5a1 1 0 100-2 1 1 0 000 2zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9z',
  ok: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.58 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z',
};

/** Severity badge: icon + label, never colour alone. */
const Severity = ({ level }) => (
  <span className={`${s.sev} ${s[`sev_${level}`]}`}>
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d={SEV_ICON[level]} clipRule="evenodd" /></svg>
    {SEVERITY[level].label}
  </span>
);

const QUESTIONS_PER_PAGE = 20;

const QuestionCell = ({ q }) => (
  <>{q.question}{q.removed && <span className={s.tag}>Removed</span>}</>
);

export default function ChapterQualityReport() {
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [issueFilter, setIssueFilter] = useState('all');
  const state = useReport('chapter-quality', { courseId }, 'all');
  const { range, customInvalid, report, loading, error, startLoading } = state;

  useEffect(() => {
    apiServiceHandler('GET', 'course/list')
      .then(res => setCourses(Array.isArray(res?.data) ? res.data : [])).catch(() => setCourses([]));
  }, []);

  const courseName = courseId ? (courses.find(c => String(c._id) === courseId)?.title || 'Selected course') : 'All courses';
  const periodDesc = periodText(range.from, range.to);
  const oneCourse = Boolean(courseId);

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateChapterQualityPDF } = await import('../../../lib/generateChapterQualityPDF');
      await generateChapterQualityPDF(report, { periodText: periodDesc, course: courseName, oneCourse });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const sm = report?.summary;
  const flagged = (report?.chapters || []).filter(c => c.severity !== 'ok');
  const chapterRows = showAllChapters ? (report?.chapters || []) : flagged;
  const issues = (report?.contentIssues || []).filter(i => issueFilter === 'all' || i.severity === issueFilter);
  const courseCol = oneCourse ? [] : [{ label: 'Course', render: r => r.course }];
  const questionColumns = (kind) => [
    { label: 'Question', className: `${s.nameCell} ${s.clip}`, render: q => <QuestionCell q={q} /> },
    ...courseCol,
    { label: 'Chapter', render: q => q.chapter },
    ...(kind === 'failed' ? [
      { label: 'Answers', align: 'right', render: q => q.answered },
      { label: 'Failed', align: 'right', render: q => q.failed },
      { label: 'Fail rate', render: q => <ShareCell share={q.failRate} /> },
      { label: 'Avg marks', align: 'right', render: q => percentText(q.avgScore) },
    ] : [
      { label: 'Shown', align: 'right', render: q => q.shown },
      { label: 'Skipped', align: 'right', render: q => q.skipped },
      { label: 'Skip rate', render: q => <ShareCell share={q.skipRate} /> },
    ]),
  ];
  const moreNote = (shown, total) => total > shown && <p className={s.note}>Showing the top {shown} of {total}.</p>;

  return (
    <SuperAdminShell activeSection="report-chapter-quality">
      <div className={s.page}>
        <header className={s.header}>
          <div>
            <h1 className={s.title}>Chapter Quality Alert</h1>
            <p className={s.subtitle}>Quizzes taken {periodDesc} · {courseName}</p>
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
              <option value="">All courses</option>
              {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
            </select>
          </label>
        </div>
        {customInvalid && <p className={s.errorText}>The start date must be on or before the end date.</p>}
        {error && <p className={s.errorText}>{error}</p>}

        {loading && !report ? <p className={s.empty}>Checking chapters…</p> : report && (
          <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
            <div>
              <section className={s.tiles} aria-label="Summary">
                <div className={`${s.tile} ${s.tileHero} ${sm.criticalChapters + sm.criticalIssues > 0 ? s.tileAlert : ''}`}>
                  <span className={s.tileLabel}>Chapters needing attention</span>
                  <span className={s.heroValue}>{flagged.length} <small className={s.tileSub}>{sm.weakChapters} weak · {sm.difficultChapters} difficult</small></span>
                </div>
                <div className={s.tile}><span className={s.tileLabel}>Failed questions</span><span className={s.tileValue}>{sm.failedQuestions}</span></div>
                <div className={s.tile}><span className={s.tileLabel}>Skipped questions</span><span className={s.tileValue}>{sm.skippedQuestions}</span></div>
                <div className={s.tile}><span className={s.tileLabel}>Content issues</span><span className={s.tileValue}>{sm.contentIssues} <small className={s.tileSub}>{sm.criticalIssues} critical</small></span></div>
              </section>
              <p className={s.statusLine}>
                {sm.chaptersChecked} chapters checked · {sm.chaptersWithQuizData} with quiz attempts in this period.
                The period filters quiz attempts and reviews; content issues are always the current state of the course builder.
              </p>
            </div>

            <ReportTable id="wk-h" title="Weak & difficult chapters" rows={chapterRows} rowKey={r => r.chapterId}
              empty={showAllChapters ? 'No quiz attempts in this view.' : 'No chapter alerts. Every chapter with enough quiz attempts is doing fine.'}
              actions={report.chapters.length > flagged.length && (
                <button type="button" className={s.linkBtn} onClick={() => setShowAllChapters(v => !v)} aria-pressed={showAllChapters}>
                  {showAllChapters ? 'Show alerts only' : `Show all ${report.chapters.length} chapters`}
                </button>
              )}
              columns={[
                { label: 'Alert', render: r => <Severity level={r.severity} /> },
                ...courseCol.map(c => ({ ...c, className: `${s.nameCell} ${s.minName}` })),
                { label: 'Chapter', className: oneCourse ? `${s.nameCell} ${s.minName}` : s.minName, render: r => r.chapter },
                { label: 'Learners', align: 'right', render: r => r.learners },
                { label: 'Pass rate', align: 'right', render: r => percentText(r.passRate) },
                { label: 'First try', align: 'right', render: r => percentText(r.firstTryRate) },
                { label: 'Tries / learner', align: 'right', render: r => orDash(r.attemptsPerLearner) },
                { label: 'Avg score', align: 'right', render: r => percentText(r.avgScore) },
                { label: 'Skipped', align: 'right', render: r => percentText(r.skipRate) },
                { label: 'Rating', align: 'right', render: r => (r.avgRating === null ? '—' : `${r.avgRating} / 5`) },
                { label: 'Why', render: r => (r.flags.length ? (
                  <span className={s.flags}>{r.flags.map(f => <span key={f.text} className={s.flag}><span className={s.flagKind}>{FLAG_KIND[f.kind]}</span>{f.text}</span>)}</span>
                ) : (r.enoughData ? '—' : <span className={s.subText}>Not enough attempts yet</span>)) },
              ]} />

            <ReportTable id="fq-h" title="Failed questions" rows={report.failedQuestions} rowKey={q => q.questionId} pageSize={QUESTIONS_PER_PAGE}
              empty="No question is failed by most learners in this view."
              columns={questionColumns('failed')}
              footer={<>
                {moreNote(report.failedQuestions.length, sm.failedQuestions)}
                <p className={s.note}>Questions where most answers scored under {report.rules.FAILED_SHARE}% of the marks — often a sign the question, its expected answer or the lesson needs work.</p>
              </>} />

            <ReportTable id="sq-h" title="Skipped questions" rows={report.skippedQuestions} rowKey={q => q.questionId} pageSize={QUESTIONS_PER_PAGE}
              empty="No question is skipped by most learners in this view."
              columns={questionColumns('skipped')}
              footer={moreNote(report.skippedQuestions.length, sm.skippedQuestions)} />

            <ReportTable id="ci-h" title="Content issues" rows={issues} rowKey={(r, i) => `${r.type}-${r.item}-${r.problem}-${i}`}
              empty={report.contentIssues.length ? 'No issues at this level.' : 'No content issues found.'}
              actions={report.contentIssues.length > 0 && (
                <div className={s.chips} role="group" aria-label="Filter by severity">
                  {['all', ...ISSUE_SEVERITIES].map(k => (
                    <button key={k} type="button" className={s.chipBtn} aria-pressed={issueFilter === k} onClick={() => setIssueFilter(k)}>
                      {k === 'all' ? `All ${sm.contentIssues}` : `${SEVERITY[k].label} ${sm[`${k}Issues`]}`}
                    </button>
                  ))}
                </div>
              )}
              columns={[
                { label: 'Level', render: r => <Severity level={r.severity} /> },
                { label: 'Type', render: r => r.type },
                ...courseCol,
                { label: 'Chapter', render: r => r.chapter },
                { label: 'Item', className: `${s.nameCell} ${s.clip}`, render: r => r.item },
                { label: 'Problem', className: s.clip, render: r => <>{r.problem}<span className={s.fixText}>{r.fix}</span></> },
              ]} />

            <ReportTable id="rv-h" title="Low-rated chapters (learner reviews)" rows={report.lowReviews} rowKey={(r, i) => i}
              empty={`No chapter reviews rated ${report.rules.LOW_REVIEW} or lower in this view.`}
              columns={[
                { label: 'Rating', align: 'right', render: r => `${r.rating} / 5` },
                ...courseCol,
                { label: 'Chapter', render: r => r.chapter },
                { label: 'Learner', render: r => r.learner },
                { label: 'Comment', className: s.clip, render: r => r.text },
                { label: 'Date', className: s.nowrap, render: r => dateLabel(r.createdAt) },
              ]}
              footer={moreNote(report.lowReviews.length, sm.lowReviews)} />

            <section className={s.card} aria-labelledby="rules-h">
              <h2 id="rules-h" className={s.cardTitle}>How alerts are decided</h2>
              <ul className={s.rulesList}>{rulesText(report.rules).map(t => <li key={t}>{t}</li>)}</ul>
            </section>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
