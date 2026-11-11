'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DownloadIcon, useReport, ReportTable, ShareCell, Badge } from '../../SuperAdmin/Reports/ReportParts';
import { dateLabel } from '../../SuperAdmin/Reports/reportFormat';
import { percentText } from '../../SuperAdmin/Reports/traineeData';
import { GRADE_STYLE } from '../../StoreOwner/Reports/testResultsData';
import { StatusText } from '../../StoreOwner/Reports/ProgressCells';
import { VERDICT, DIFFICULTY_LABEL, rulesText } from './achievementsData';
import s from '../../SuperAdmin/Reports/Report.module.css';

const Grade = ({ grade }) => (grade ? <span className={`${s.gradePill} ${s[GRADE_STYLE[grade].cls]}`} aria-label={`Grade ${grade}`}>{grade}</span> : '—');
const MEDAL = 'M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 14.3 5.2 16.9l.9-5.4L2.2 7.7l5.4-.8L10 2z';
const LOCK = 'M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z';

export default function MyAchievementsReport() {
  const [courseId, setCourseId] = useState('');
  const [exporting, setExporting] = useState(false);
  const state = useReport('achievements', { courseId }, 'all', 'my-report');
  const { report, loading, error, startLoading } = state;
  const courseName = courseId ? (report?.options.courses.find(c => c.id === courseId)?.title || 'Selected course') : 'All my courses';

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateMyAchievementsPDF } = await import('../../../lib/generateMyAchievementsPDF');
      await generateMyAchievementsPDF(report, { course: courseName });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;
  const area = (title, id, rows, empty) => (
    <ReportTable id={id} title={title} rows={rows} rowKey={(r, i) => i}
      empty={empty}
      columns={[
        { label: 'Chapter', className: s.nameCell, render: r => <>{r.chapter}<span className={s.subText}>{r.course}</span></> },
        { label: 'Best score', align: 'right', render: r => `${r.bestScore}%` },
        { label: 'Quiz', render: r => <Badge tone={r.result === 'passed' ? 'ok' : 'critical'} label={r.result === 'passed' ? 'Passed' : 'Not passed'} /> },
        { label: 'Attempts', align: 'right', render: r => r.attempts },
      ]} />
  );

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>My Achievements</h1>
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

      {loading && !report ? <p className={s.empty}>Loading your achievements…</p> : report && (
        <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
          <div>
            <section className={s.tiles} aria-label="Summary">
              <div className={`${s.tile} ${s.tileHero}`}>
                <span className={s.tileLabel}>Certificates</span>
                <span className={s.heroValue}>{t.certificates} <small className={s.tileSub}>{t.badgesEarned} of {t.badges} badges</small></span>
              </div>
              <div className={s.tile}><span className={s.tileLabel}>My grade</span><span className={s.tileValue}>{t.grade ? <Grade grade={t.grade} /> : '—'} <small className={s.tileSub}>{t.myScore === null ? 'no quiz yet' : `score ${t.myScore}%`}</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Leaderboard</span><span className={s.tileValue}>{t.myRank ? `#${t.myRank}` : '—'} <small className={s.tileSub}>{t.myRank ? `of ${t.leaderboardSize}` : 'no ranking'}</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Tests passed</span><span className={s.tileValue}>{t.testsPassed} <small className={s.tileSub}>of {t.testsTaken} · {t.totalAttempts} attempts</small></span></div>
            </section>
          </div>

          <section className={s.card} aria-labelledby="bd-h">
            <h2 id="bd-h" className={s.cardTitle}>Badges</h2>
            <ul className={s.badgeGrid}>
              {report.badges.map(b => (
                <li key={b.key} className={`${s.badgeItem} ${b.earned ? s.badgeEarned : s.badgeLocked}`}>
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d={b.earned ? MEDAL : LOCK} /></svg>
                  <span><span className={s.badgeName}>{b.label}</span><span className={s.subText}>{b.earned ? 'Earned' : b.hint}</span></span>
                </li>
              ))}
            </ul>
          </section>

          <ReportTable id="ce-h" title="Certificates" rows={report.certificates} rowKey={r => r.courseId}
            empty="No certificates yet — complete a course to earn one."
            columns={[
              { label: 'Course', className: s.nameCell, render: r => r.course },
              { label: 'Issued', className: s.nowrap, render: r => dateLabel(r.issuedAt) },
              { label: 'Time taken', align: 'right', render: r => (r.daysTaken === null ? '—' : `${r.daysTaken} day${r.daysTaken === 1 ? '' : 's'}`) },
              { label: 'Certificate', render: r => (r.viewable ? <Link href={`/learner/certificate?courseId=${r.courseId}`} className={s.linkBtn}>View certificate</Link> : <span className={s.subText}>Course removed</span>) },
            ]} />

          <div className={s.twoCol}>
            <ReportTable id="gr-h" title="Grade by course" rows={report.courseGrades} rowKey={r => r.courseId}
              empty="No courses."
              columns={[
                { label: 'Course', className: s.nameCell, render: r => r.course },
                { label: 'Score', align: 'right', render: r => (r.score === null ? '—' : `${r.score}%`) },
                { label: 'Grade', render: r => <Grade grade={r.grade} /> },
                { label: 'Status', className: s.nowrap, render: r => <StatusText status={r.status} /> },
              ]} />
            <ReportTable id="lb-h" title="Leaderboard" rows={report.leaderboard} rowKey={r => `${r.rank}-${r.name}`}
              empty="No leaderboard — you are not part of an organization."
              columns={[
                { label: '#', render: r => r.rank },
                { label: 'Learner', render: r => (r.isMe ? <strong>You</strong> : r.name) },
                { label: 'Performance', render: r => <ShareCell share={r.performance} /> },
                { label: 'Completed', align: 'right', render: r => `${r.completed}/${r.courses}` },
              ]}
              footer={t.myRank && <p className={s.note}>You are #{t.myRank} of {t.leaderboardSize} learners in your organization.</p>} />
          </div>

          <div className={s.twoCol}>
            {area('My strong areas', 'st-h', report.strong, `No strong areas yet — pass a chapter quiz with ${report.rules.STRONG}% or more.`)}
            {area('My weak areas', 'wk-h', report.weak, 'No weak areas — every quiz you took is passed.')}
          </div>

          <ReportTable id="df-h" title="By difficulty" rows={report.difficulty} rowKey={r => r.difficulty}
            empty="No questions answered yet."
            columns={[
              { label: 'Difficulty', className: s.nameCell, render: r => DIFFICULTY_LABEL[r.difficulty] || r.difficulty },
              { label: 'Score (answered)', align: 'right', render: r => (r.avgScore === null ? '—' : `${r.avgScore}%`) },
              { label: 'Skipped', align: 'right', render: r => percentText(r.skipRate) },
              { label: 'Verdict', render: r => <><Badge tone={VERDICT[r.verdict].tone} label={VERDICT[r.verdict].label} />{r.oftenSkipped && <span className={s.subText}>Often skipped — answer more to improve</span>}</> },
            ]} />

          <ReportTable id="at-h" title="Attempts" rows={report.attempts} rowKey={(r, i) => i}
            empty="You have not taken a chapter quiz yet."
            actions={t.testsTaken > 0 && <span className={s.cardHint}>{t.firstTryPasses} first-try pass{t.firstTryPasses === 1 ? '' : 'es'}{t.avgAttemptsToPass !== null ? ` · ${t.avgAttemptsToPass} ${t.avgAttemptsToPass === 1 ? 'try' : 'tries'} to pass on average` : ''}</span>}
            columns={[
              { label: 'Quiz', className: s.nameCell, render: r => <>{r.quiz}<span className={s.subText}>{r.course} · {r.chapter}</span></> },
              { label: 'Attempts', align: 'right', render: r => r.attempts },
              { label: 'Passed on', render: r => (r.passed ? <Badge tone="ok" label={r.firstTry ? 'First try' : `Attempt ${r.passedOnAttempt}`} /> : <Badge tone="critical" label="Not yet" />) },
              { label: 'Best', align: 'right', render: r => `${r.bestScore}%` },
              { label: 'Last', align: 'right', render: r => `${r.lastScore}%` },
              { label: 'Last tried', className: s.nowrap, render: r => dateLabel(r.lastAt) },
            ]} />

          <section className={s.card} aria-labelledby="ar-h">
            <h2 id="ar-h" className={s.cardTitle}>How achievements are worked out</h2>
            <ul className={s.rulesList}>{rulesText(report.rules, report.grades).map(x => <li key={x}>{x}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
