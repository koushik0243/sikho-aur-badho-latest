'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import apiServiceHandler from '../../service/apiService';
import { formatBytes } from '../../lib/assignmentSubmission';
import SubmissionPlayer from './SubmissionPlayer';
import s from './AssignmentSubmissions.module.css';
import { orDash } from '../../lib/displayValue';

const PAGE_SIZE = 10;
const REVIEW = { approved: ['Completed', 'pillGood'], reupload: ['Re-upload requested', 'pillWarn'], pending: ['Waiting for review', 'pillInfo'] };
const fmtDate = d => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const PlayIcon = <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>;

/**
 * Homework video submissions with an in-page player — for super admins (all organizations)
 * and store owners (their own learners; the server enforces this).
 * @param {{ title?: string, sub?: string, courseId?: string, orgId?: string, userId?: string,
 *   showOrganization?: boolean, showLearner?: boolean, className?: string }} props
 */
export default function AssignmentSubmissions({
  title = 'Assignment submissions', sub = 'Videos learners uploaded after completing a homework assignment.',
  courseId = '', orgId = '', userId = '', showOrganization = true, showLearner = true, className = '',
}) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [playing, setPlaying] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ t: String(Date.now()) });
    if (courseId) params.set('courseId', courseId);
    if (orgId) params.set('orgId', orgId);
    if (userId) params.set('userId', userId);
    apiServiceHandler('GET', `topic-activity/submissions?${params}`)
      .then(res => { if (!cancelled) { setRows(Array.isArray(res?.data) ? res.data : []); setError(''); } })
      .catch(err => { if (!cancelled) { setRows([]); setError(err?.response?.data?.message || 'Could not load submissions.'); } });
    return () => { cancelled = true; };
  }, [courseId, orgId, userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows || !q) return rows || [];
    return rows.filter(r => [r.learner?.name, r.learner?.email, r.organization, r.course, r.chapter, r.topic]
      .some(v => String(v || '').toLowerCase().includes(q)));
  }, [rows, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const closePlayer = useCallback(() => setPlaying(null), []);

  return (
    <section className={`${s.card} ${className}`} aria-labelledby="asub-h">
      <div className={s.head}>
        <div>
          <h2 id="asub-h" className={s.title}>{title}{rows && <span className={s.count}>{rows.length}</span>}</h2>
          {sub && <p className={s.sub}>{sub}</p>}
        </div>
        {rows && rows.length > 0 && (
          <label className={s.search}>
            <span className={s.srOnly}>Search submissions</span>
            <input type="search" placeholder="Search learner, course, topic…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />
          </label>
        )}
      </div>

      {rows === null ? <p className={s.empty}>Loading submissions…</p>
        : error ? <p className={s.errorText}>{error}</p>
          : filtered.length === 0 ? <p className={s.empty}>{query ? 'No submission matches your search.' : 'No assignment videos have been submitted yet.'}</p>
            : (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      {showLearner && <th>Learner</th>}
                      {showOrganization && <th>Organization</th>}
                      <th>Course / assignment</th>
                      <th>Submitted</th>
                      <th>Review</th>
                      <th className={s.num}>Size</th>
                      <th className={s.actionCol}>Video</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(r => (
                      <tr key={r._id}>
                        {showLearner && <td><span className={s.strong}>{orDash(r.learner?.name)}</span>{r.learner?.email && <span className={s.subText}>{r.learner.email}</span>}</td>}
                        {showOrganization && <td>{r.organization}</td>}
                        <td><span className={s.strong}>{r.topic}</span><span className={s.subText}>{r.course} · {r.chapter}</span></td>
                        <td className={s.nowrap}>{fmtDate(r.uploadedAt)}</td>
                        <td>{(() => { const [label, cls] = REVIEW[r.review?.status || 'pending'] || REVIEW.pending; return <span className={`${s.pill} ${s[cls]}`}>{label}</span>; })()}</td>
                        <td className={s.num}>{formatBytes(r.size)}</td>
                        <td className={s.actionCol}>
                          <button type="button" className={s.watchBtn}
                            onClick={() => setPlaying({ _id: r._id, title: r.topic, subtitle: `${r.learner?.name} · ${r.course}`, size: r.size })}
                            aria-label={`Watch ${r.learner?.name}'s video for ${r.topic}`}>
                            {PlayIcon} Watch
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

      {filtered.length > PAGE_SIZE && (
        <nav className={s.pager} aria-label="Submission pages">
          <span className={s.pagerInfo}>Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className={s.pagerBtns}>
            <button type="button" className={s.pageBtn} disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page">Previous</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
              <button key={n} type="button" className={`${s.pageBtn} ${n === current ? s.pageOn : ''}`} onClick={() => setPage(n)} aria-current={n === current ? 'page' : undefined}>{n}</button>
            ))}
            <button type="button" className={s.pageBtn} disabled={current === pages} onClick={() => setPage(current + 1)} aria-label="Next page">Next</button>
          </div>
        </nav>
      )}

      <SubmissionPlayer submission={playing} onClose={closePlayer} />
    </section>
  );
}
