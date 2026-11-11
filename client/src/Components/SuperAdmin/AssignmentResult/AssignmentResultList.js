'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sBase from '../OrgCourseAssignment/OrgCourseAssignmentList.module.css';
import sOwn from './AssignmentResult.module.css';
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, ResultCount, SkeletonRows, pageItems } from '../AdminKit/ListParts';

// Shared list styles + this page's own + the super admin look.
const s = withAdminKit({ ...sBase, ...sOwn });

export const BASE_PATH = '/superadmin/assignment-result';
const LIMIT = 10;

const toArr = (res) => (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const isAssignment = (t) => String(t?.video_type || '').toLowerCase() === 'assignment' && !t.deletedAt;
// Numbered by its place in the whole course (as on the review page), not in the filtered list.
const chapterLabel = (ch) => `Ch ${ch.n} – ${ch.title || 'Untitled'}`;

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

/** The row's overall state for the chapter, most urgent first. hasResults: there is something to open. */
function statusOf(r) {
  if (!r.assignments) return { label: 'No assignment', cls: 'stNone', hasResults: false };
  if (r.approved === r.assignments) return { label: 'Approved', cls: 'stApproved', hasResults: true };
  if (r.waiting > 0) return { label: 'Waiting for review', cls: 'stWaiting', hasResults: true };
  if (r.rejected > 0) return { label: 'Rejected', cls: 'stRejected', hasResults: true };
  if (r.approved > 0) return { label: 'Partly approved', cls: 'stPartial', hasResults: true };
  return { label: 'Not submitted', cls: 'stNone', hasResults: false };
}

const ResultsIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
  </svg>
);

/** Super admin · Organizations → Assignment Result: course → chapter → every enrolled learner. */
export default function AssignmentResultList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [courseId, setCourseId] = useState(searchParams.get('courseId') || '');
  const [chapterId, setChapterId] = useState(searchParams.get('chapterId') || '');
  const [result, setResult] = useState(null); // { key, rows, assignments, error? }
  const [page, setPage] = useState(1);

  useEffect(() => {
    apiServiceHandler('GET', 'course/list-pagination?limit=1000&page=1')
      .then(res => setCourses(toArr(res).sort((a, b) => (a.title || '').localeCompare(b.title || ''))))
      .catch(() => { setCourses([]); toast.warning('Failed to load courses.'); });
  }, []);

  useEffect(() => {
    if (!courseId) return undefined;
    let cancelled = false;
    // Only chapters that contain at least one assignment.
    Promise.all([
      apiServiceHandler('GET', `chapter/list?courseId=${courseId}`),
      apiServiceHandler('GET', `topic/list?courseId=${courseId}`),
    ])
      .then(([chRes, topicRes]) => {
        if (cancelled) return;
        const withAssignment = new Set(toArr(topicRes).filter(isAssignment).map(t => String(t.chapterId)));
        const list = toArr(chRes).filter(c => !c.deletedAt).sort(byOrder)
          .map((c, i) => ({ ...c, n: i + 1 }))
          .filter(c => withAssignment.has(String(c._id)));
        setChapters(list);
        // A chapter from the URL that has no assignment can't stay selected.
        setChapterId(prev => (prev && !list.some(c => String(c._id) === prev) ? '' : prev));
      })
      .catch(() => { if (!cancelled) setChapters([]); });
    return () => { cancelled = true; };
  }, [courseId]);

  const key = `${courseId}|${chapterId}`;
  useEffect(() => {
    if (!courseId || !chapterId) return undefined;
    let cancelled = false;
    apiServiceHandler('GET', `topic-activity/chapter-learners?courseId=${courseId}&chapterId=${chapterId}&t=${Date.now()}`)
      .then(res => { if (!cancelled) setResult({ key, rows: toArr(res), assignments: res?.assignments ?? 0 }); })
      .catch(err => { if (!cancelled) setResult({ key, rows: [], assignments: 0, error: err?.response?.data?.message || 'Could not load learners.' }); });
    return () => { cancelled = true; };
  }, [courseId, chapterId, key]);

  // Keep the choice in the URL, so "Back" from a learner's results returns here.
  useEffect(() => {
    const qs = new URLSearchParams();
    if (courseId) qs.set('courseId', courseId);
    if (chapterId) qs.set('chapterId', chapterId);
    router.replace(qs.toString() ? `${BASE_PATH}?${qs}` : BASE_PATH, { scroll: false });
  }, [courseId, chapterId, router]);

  const pickCourse = (v) => { setCourseId(v); setChapterId(''); setChapters([]); setPage(1); };
  const pickChapter = (v) => { setChapterId(v); setPage(1); };

  const ready = Boolean(courseId && chapterId);
  const current = ready && result?.key === key ? result : null;
  const rows = current?.rows || [];
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const safePage = Math.min(page, totalPages);
  const paged = rows.slice((safePage - 1) * LIMIT, safePage * LIMIT);
  const from = total === 0 ? 0 : (safePage - 1) * LIMIT + 1;
  const to = Math.min(safePage * LIMIT, total);

  const openResults = (r) => {
    const qs = new URLSearchParams({ learnerId: String(r.learnerId), orgId: String(r.orgId || ''), courseId, chapterId });
    router.push(`${BASE_PATH}/review?${qs}`);
  };

  let body;
  if (!ready) body = <tr className={s.emptyRow}><td colSpan={7}><EmptyState>Select a course and a chapter to see the learners.</EmptyState></td></tr>;
  else if (!current) body = <SkeletonRows columns={7} />;
  else if (current.error) body = <tr className={s.emptyRow}><td colSpan={7}><EmptyState>{current.error}</EmptyState></td></tr>;
  else if (paged.length === 0) body = <tr className={s.emptyRow}><td colSpan={7}><EmptyState>No learner has uploaded a video for this chapter yet.</EmptyState></td></tr>;
  else body = paged.map((r, i) => {
    const st = statusOf(r);
    return (
      <tr key={String(r.learnerId)} className={i % 2 ? s.stripeAlt : undefined}>
        <td>{from + i}</td>
        <td>
          <div className={s.cellMain}>{r.name || '—'}</div>
          {r.email && <div className={s.subText}>{r.email}</div>}
        </td>
        <td>{r.orgName || '—'}</td>
        <td>
          <span className={`${s.statusPill} ${s[st.cls]}`}>{st.label}</span>
          {r.assignments > 1 && <div className={s.subText}>{r.approved} of {r.assignments} approved</div>}
        </td>
        <td className={s.num}>{r.videos}</td>
        <td>{fmtDate(r.lastUploadAt)}</td>
        <td style={{ textAlign: 'center' }}>
          {/* Nothing to open until the learner has submitted */}
          {st.hasResults ? (
            <div className={s.actions} style={{ justifyContent: 'center' }}>
              <button data-action="video" type="button" className={s.btnView} title="Results" aria-label={`Assignment results of ${r.name || r.email}`} onClick={() => openResults(r)}>
                <ResultsIcon />
              </button>
            </div>
          ) : <span className={s.subText} aria-label="No results yet">—</span>}
        </td>
      </tr>
    );
  });

  return (
    <SuperAdminShell activeSection="assignment-result">
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Assignment Result</h1>
          <p className={s.pageSubtitle}>Choose a course and a chapter to see the learners who uploaded assignment videos — latest upload first</p>
        </div>
      </div>

      <div className={s.card}>
        <div className={`${s.filterBar} ${s.arFilters}`}>
          <label className={s.arField}>
            <span>Course</span>
            <select className={s.orgSelect} value={courseId} onChange={e => pickCourse(e.target.value)}>
              <option value="">— Select a course —</option>
              {courses.map(c => <option key={c._id} value={c._id}>{c.title || 'Untitled'}</option>)}
            </select>
          </label>
          <label className={s.arField}>
            <span>Chapter</span>
            <select className={s.orgSelect} value={chapterId} onChange={e => pickChapter(e.target.value)} disabled={!courseId}>
              <option value="">{!courseId ? 'Select a course first' : chapters.length ? '— Select a chapter —' : 'No chapter with an assignment'}</option>
              {chapters.map(c => <option key={c._id} value={c._id}>{chapterLabel(c)}</option>)}
            </select>
          </label>
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Learner</th>
                <th>Organization</th>
                <th>Status</th>
                <th>Videos</th>
                <th>Last upload</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>{body}</tbody>
          </table>
        </div>

        {ready && current && !current.error && (
          <div className={s.pagination}>
            <span><ResultCount from={from} to={to} total={total} singular="learner" plural="learners" /></span>
            <div className={s.paginationBtns}>
              <button className={s.pageBtn} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page">Previous</button>
              {pageItems(safePage, totalPages).map(p => typeof p !== 'number' ? <PageGap key={p} /> : (
                <button key={p} className={`${s.pageBtn}${safePage === p ? ` ${s.pageBtnActive}` : ''}`} onClick={() => setPage(p)} aria-current={safePage === p ? 'page' : undefined}>{p}</button>
              ))}
              <button className={s.pageBtn} disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page">Next</button>
            </div>
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
