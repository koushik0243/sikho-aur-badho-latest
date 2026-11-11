'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon, useReport, ReportTable, SplitBar, ShareCell, Badge } from '../../SuperAdmin/Reports/ReportParts';
import { dateLabel } from '../../SuperAdmin/Reports/reportFormat';
import { percentText } from '../../SuperAdmin/Reports/traineeData';
import { DONE_FILTERS, filterDone, RULES_TEXT } from './summaryData';
import s from '../../SuperAdmin/Reports/Report.module.css';

const PAGE_SIZE = 20;
const Person = ({ r }) => <><span className={s.nameCell}>{r.name}</span>{r.email && <span className={s.subText}>{r.email}</span>}</>;
const ratio = (done, total) => (total ? `${done}/${total}` : '—');

/** Ranked list of performers for the best / weak cards. */
function Performers({ rows, weak }) {
  if (!rows.length) return <p className={s.empty}>{weak ? 'No weak performers — everyone is making progress.' : 'No one has made progress yet.'}</p>;
  return (
    <ol className={s.performerList}>
      {rows.map(e => (
        <li key={e.learnerId}>
          <span className={s.nameCell}>#{e.rank} {e.name}</span>{' '}
          <Badge tone={weak ? 'critical' : 'ok'} label={`${e.performance}%`} />
          <span className={s.subText}>
            Progress {e.avgProgress}% · quiz {e.quizScore === null ? 'not taken' : `${e.quizScore}%`} · {e.completed}/{e.courses} courses completed
            {weak && e.reasons.length > 0 && ` · ${e.reasons.join(', ')}`}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function SummaryReport() {
  const [courseId, setCourseId] = useState('');
  const [zoomFilter, setZoomFilter] = useState('all');
  const [hwFilter, setHwFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const state = useReport('summary', { courseId }, 'all', 'org-report');
  const { report, loading, error, startLoading } = state;
  const courseName = courseId ? (report?.options.courses.find(c => c.id === courseId)?.title || 'Selected course') : 'All courses';

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    try {
      const { generateSummaryPDF } = await import('../../../lib/generateSummaryPDF');
      await generateSummaryPDF(report, { course: courseName });
    } catch {
      toast.warning('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;
  const oneCourse = Boolean(courseId);
  const courseCol = oneCourse ? [] : [{ label: 'Course', render: r => r.course }];
  const sessionColumns = (doneLabel, notLabel) => [
    { label: 'Session', className: s.nameCell, render: r => r.title },
    ...courseCol,
    { label: 'Chapter', render: r => r.chapter },
    { label: 'Employees', align: 'right', render: r => r.enrolled },
    { label: doneLabel, align: 'right', render: r => r.done },
    { label: 'Rate', render: r => <ShareCell share={r.rate ?? 0} /> },
    { label: notLabel, render: r => (r.missing.length ? r.missing.join(', ') : <span className={s.subText}>Everyone</span>) },
  ];
  const chips = (value, set, rows, label) => (
    <div className={s.chips} role="group" aria-label={label}>
      {DONE_FILTERS.map(f => (
        <button key={f.value} type="button" className={s.chipBtn} aria-pressed={value === f.value} onClick={() => set(f.value)}>
          {f.label} {filterDone(rows, f.value).length}
        </button>
      ))}
    </div>
  );

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Summary</h1>
          <p className={s.subtitle}>Store completion, performers, Zoom and homework · {courseName}</p>
        </div>
        <button type="button" className={s.exportBtn} onClick={exportPdf} disabled={!report || exporting || loading}>
          <DownloadIcon /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
        </button>
      </header>

      <div className={s.filters} role="group" aria-label="Report filters">
        <label className={s.field}>
          <span>Course</span>
          <select value={courseId} onChange={e => { startLoading(); setCourseId(e.target.value); }}>
            <option value="">All courses</option>
            {(report?.options.courses || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      </div>
      {error && <p className={s.errorText}>{error}</p>}

      {loading && !report ? <p className={s.empty}>Loading summary…</p> : report && (
        <div className={`${s.sections} ${loading ? s.refreshing : ''}`}>
          <div>
            <section className={s.tiles} aria-label="Summary">
              <div className={`${s.tile} ${s.tileHero}`}>
                <span className={s.tileLabel}>Store completion</span>
                <span className={s.heroValue}>{percentText(t.completionRate)} <small className={s.tileSub}>{t.completed} of {t.enrollments} courses</small></span>
              </div>
              <div className={s.tile}><span className={s.tileLabel}>Average progress</span><span className={s.tileValue}>{t.avgProgress === null ? '—' : `${t.avgProgress}%`} <small className={s.tileSub}>{t.chaptersDone}/{t.chapters} chapters</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Zoom attended</span><span className={s.tileValue}>{percentText(t.zoomRate)} <small className={s.tileSub}>{t.zoomDone} of {t.zoom}</small></span></div>
              <div className={s.tile}><span className={s.tileLabel}>Homework done</span><span className={s.tileValue}>{percentText(t.homeworkRate)} <small className={s.tileSub}>{t.homeworkDone} of {t.homework}</small></span></div>
            </section>
            <p className={s.statusLine}>{t.employees} of {t.staff} employees have courses · {t.certificates} certificate{t.certificates === 1 ? '' : 's'} · quizzes {t.quizPassed} passed, {t.quizFailed} failed. Everything is as of now.</p>
          </div>

          <div className={s.twoCol}>
            <section className={s.card} aria-labelledby="sc-h">
              <h2 id="sc-h" className={s.cardTitle}>Store completion</h2>
              <h3 className={s.miniTitle}>Enrolled courses</h3>
              <SplitBar label="Courses" parts={[
                { label: 'Completed', value: t.completed, className: s.st_completed },
                { label: 'Not completed', value: t.enrollments - t.completed, className: s.st_not_started },
              ]} />
              <h3 className={s.miniTitle}>Chapters</h3>
              <SplitBar label="Chapters" parts={[
                { label: 'Completed', value: t.chaptersDone, className: s.st_completed },
                { label: 'Not completed', value: t.chapters - t.chaptersDone, className: s.st_not_started },
              ]} />
            </section>
            <section className={s.card} aria-labelledby="zh-h">
              <h2 id="zh-h" className={s.cardTitle}>Zoom &amp; homework</h2>
              <h3 className={s.miniTitle}>Zoom sessions</h3>
              <SplitBar label="Zoom sessions" parts={[
                { label: 'Attended', value: t.zoomDone, className: s.st_completed },
                { label: 'Not attended', value: t.zoom - t.zoomDone, className: s.st_dropout },
              ]} />
              <h3 className={s.miniTitle}>Homework</h3>
              <SplitBar label="Homework" parts={[
                { label: 'Done', value: t.homeworkDone, className: s.st_completed },
                { label: 'Not done', value: t.homework - t.homeworkDone, className: s.st_dropout },
              ]} />
            </section>
          </div>

          <div className={s.twoCol}>
            <section className={s.card} aria-labelledby="bp-h">
              <h2 id="bp-h" className={s.cardTitle}>Best performers</h2>
              <Performers rows={report.best} />
            </section>
            <section className={s.card} aria-labelledby="wp-h">
              <h2 id="wp-h" className={s.cardTitle}>Weak performers</h2>
              <Performers rows={report.weak} weak />
            </section>
          </div>

          <ReportTable id="rk-h" title="Employee ranking" rows={report.employees} rowKey={r => r.learnerId} pageSize={PAGE_SIZE}
            empty="No employee has a course yet."
            columns={[
              { label: '#', render: r => r.rank },
              { label: 'Employee', render: r => <Person r={r} /> },
              { label: 'Performance', render: r => <ShareCell share={r.performance} /> },
              { label: 'Progress', align: 'right', render: r => `${r.avgProgress}%` },
              { label: 'Quiz score', align: 'right', render: r => (r.quizScore === null ? '—' : `${r.quizScore}%`) },
              { label: 'Completed', align: 'right', render: r => `${r.completed}/${r.courses}` },
              { label: 'Certificates', align: 'right', render: r => r.certificates },
              { label: 'Zoom', align: 'right', render: r => ratio(r.zoomDone, r.zoom) },
              { label: 'Homework', align: 'right', render: r => ratio(r.homeworkDone, r.homework) },
            ]} />

          <ReportTable id="zs-h" title="Zoom sessions" rows={report.zoomSessions} rowKey={r => r.topicId} pageSize={PAGE_SIZE}
            empty="No Zoom sessions in these courses."
            columns={sessionColumns('Attended', 'Not attended')} />

          <ReportTable id="za-h" title="Zoom attended or not" rows={filterDone(report.zoomRows, zoomFilter)} rowKey={(r, i) => `${r.topicId}-${r.learnerId}-${i}`} pageSize={PAGE_SIZE}
            empty="No sessions match this filter."
            actions={report.zoomRows.length > 0 && chips(zoomFilter, setZoomFilter, report.zoomRows, 'Zoom attendance')}
            columns={[
              { label: 'Employee', render: r => <Person r={r} /> },
              { label: 'Session', render: r => <>{r.title}<span className={s.subText}>{r.chapter}</span></> },
              ...courseCol,
              { label: 'Attended', render: r => <Badge tone={r.done ? 'ok' : 'critical'} label={r.done ? 'Attended' : 'Not attended'} /> },
              { label: 'Joined on', className: s.nowrap, render: r => (r.doneAt ? dateLabel(r.doneAt) : '—') },
            ]} />

          <ReportTable id="hs-h" title="Homework" rows={report.homeworkItems} rowKey={r => r.topicId} pageSize={PAGE_SIZE}
            empty="No homework in these courses."
            columns={sessionColumns('Done', 'Not done')} />

          <ReportTable id="ha-h" title="Homework done or not" rows={filterDone(report.homeworkRows, hwFilter)} rowKey={(r, i) => `${r.topicId}-${r.learnerId}-${i}`} pageSize={PAGE_SIZE}
            empty="No homework matches this filter."
            actions={report.homeworkRows.length > 0 && chips(hwFilter, setHwFilter, report.homeworkRows, 'Homework')}
            columns={[
              { label: 'Employee', render: r => <Person r={r} /> },
              { label: 'Homework', render: r => <>{r.title}<span className={s.subText}>{r.chapter}</span></> },
              ...courseCol,
              { label: 'Status', render: r => <Badge tone={r.done ? 'ok' : 'critical'} label={r.done ? 'Done' : 'Not done'} /> },
              { label: 'Done on', className: s.nowrap, render: r => (r.doneAt ? dateLabel(r.doneAt) : '—') },
            ]} />

          <section className={s.card} aria-labelledby="sr-h">
            <h2 id="sr-h" className={s.cardTitle}>How the summary is worked out</h2>
            <ul className={s.rulesList}>{RULES_TEXT.map(x => <li key={x}>{x}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
