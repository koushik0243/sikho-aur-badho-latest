'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { selectUser, selectAuthReady } from '../../../redux/slices/authSlice';
import apiServiceHandler, { clearGetCache } from '../../../service/apiService';
import CourseCard from '../../../Components/Learner/CourseCard/CourseCard';
import CourseFilters from '../../../Components/Learner/CourseCard/CourseFilters';
import { STAGE_LABEL, STAGE_RANK, courseState } from '../../../Components/Learner/CourseCard/courseCardData';
import s from "./Courses.module.css";

const PAGE_SIZE = 12; // two full rows of six

// Extract an array from any common API response shape
function toArray(res) {
  if (Array.isArray(res))             return res;
  if (Array.isArray(res?.data))       return res.data;
  if (Array.isArray(res?.data?.courses)) return res.data.courses;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data?.list)) return res.data.list;
  if (Array.isArray(res?.courses))    return res.courses;
  if (Array.isArray(res?.list))       return res.list;
  if (Array.isArray(res?.result))     return res.result;
  return [];
}

function StarRating({ value = 0 }) {
  return (
    <span className={s.stars}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} viewBox="0 0 20 20" fill="currentColor"
          className={n <= Math.round(value) ? s.starFilled : s.starEmpty}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </span>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4 7.962 7.962 0 009 5.189V4.804z"/>
    </svg>
  );
}

function formatDuration(hr, min) {
  const h = Number(hr || 0);
  const m = Number(min || 0);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return null;
}

/** This page's extra card lines: chapters + duration, and the star rating (shown inside the shared card). */
function CourseMeta({ course }) {
  const chapters = Number(course?.totalChapters || 0);
  const duration = formatDuration(course?.duration_hr, course?.duration_min);
  const rating   = Number(course?.rating || 0);
  return (
    <>
      <div className={s.metaRow}>
        <div className={s.metaLeft}>
          {chapters > 0 && (
            <span className={s.metaItem}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
              </svg>
              {chapters} Chapter{chapters !== 1 ? 's' : ''}
            </span>
          )}
          {duration && (
            <span className={s.metaItem}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
              </svg>
              {duration}
            </span>
          )}
        </div>
        <button className={s.cardMenuBtn} aria-label="More options">⋯</button>
      </div>
      <div className={s.ratingRow}>
        <StarRating value={rating}/>
        <button className={s.ratingLink} onClick={() => {}}>Leave A Rating</button>
      </div>
    </>
  );
}

function SkeletonCard() {
  return (
    <div className={s.skelCard}>
      <div className={s.skelThumb}/>
      <div className={s.skelBody}>
        <div className={s.skelLine} style={{ width: '60%' }}/>
        <div className={s.skelLine} style={{ width: '80%', height: '16px' }}/>
        <div className={s.skelLine} style={{ width: '90%' }}/>
        <div className={s.skelLine} style={{ width: '40%', marginTop: '4px' }}/>
      </div>
    </div>
  );
}

export default function LearnerCoursesPage() {
  const user      = useSelector(selectUser);
  const authReady = useSelector(selectAuthReady);
  const router    = useRouter();

  // Resolve userId to a stable string — handles both _id and id field names
  const userId = user ? String(user._id || user.id || '') : '';

  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [filter,  setFilter]  = useState('all');

  const load = useCallback(async () => {
    if (!userId) {
      if (authReady) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const orgId = (() => {
        const raw = user?.orgId;
        if (!raw) return null;
        if (typeof raw === 'object' && raw._id) return String(raw._id);
        return String(raw);
      })();

      const [caRes, courseRes, ocRes, myProgRes] = await Promise.all([
        apiServiceHandler('GET', `course-assignment/list?userId=${userId}`).catch(() => null),
        apiServiceHandler('GET', 'course/list').catch(() => null),
        orgId ? apiServiceHandler('GET', `organization-course/list?orgId=${orgId}`).catch(() => null) : Promise.resolve(null),
        apiServiceHandler('GET', `my-report/progress?t=${Date.now()}`).catch(() => null),
      ]);
      // Real progress per course (as on the dashboard): stage, %, chapters, certificate.
      const myProgress = new Map((myProgRes?.data?.courses || []).map(c => [String(c.courseId), c]));

      const assignments    = toArray(caRes);
      const rawCourseList  = toArray(courseRes);
      const orgCourseList  = toArray(ocRes);

      // Build full course detail map keyed by _id
      const courseMap = {};
      for (const c of rawCourseList) {
        const key = String(c._id || c.id || '');
        if (key) courseMap[key] = c;
      }
      // Overlay org-course populated courseId objects (these carry course_image)
      for (const oc of orgCourseList) {
        const rawId = oc.courseId?._id
          ? String(oc.courseId._id)
          : typeof oc.courseId === 'string' ? oc.courseId : null;
        if (rawId && oc.courseId && typeof oc.courseId === 'object') {
          courseMap[rawId] = { ...courseMap[rawId], ...oc.courseId };
        }
      }

      // Deduplicate assignments by courseId — keep the latest per course
      const seen = new Map();
      for (const a of assignments) {
        const rawCid = a.courseId?._id || a.courseId?.id
          || (typeof a.courseId === 'string' ? a.courseId : null);
        const cid = rawCid ? String(rawCid) : null;
        if (!cid) continue;
        const existing = seen.get(cid);
        if (!existing || new Date(a.attemptedAt) > new Date(existing.attemptedAt)) {
          seen.set(cid, a);
        }
      }

      // Build initial merged list
      let merged = Array.from(seen.entries()).map(([cid, assignment]) => {
        const course = courseMap[cid]
          || (typeof assignment.courseId === 'object' ? assignment.courseId : {});
        return { id: String(assignment._id || assignment.id || cid), cid, course, assignment };
      }).filter(item => item.course && (item.course._id || item.course.id || item.course.title));

      // Per-course fallback: fetch individually for any course still missing course_image
      const missing = merged.filter(item => !item.course.course_image);
      if (missing.length > 0) {
        const fetched = await Promise.all(
          missing.map(item =>
            apiServiceHandler('GET', `course/${item.cid}`).catch(() => null)
          )
        );
        fetched.forEach((res, i) => {
          if (!res) return;
          const full = res?.data ?? res;
          if (full && (full.course_image || full.title)) {
            const cid = missing[i].cid;
            courseMap[cid] = { ...courseMap[cid], ...full };
          }
        });
        // Re-build merged with enriched courseMap
        merged = merged.map(item => ({
          ...item,
          course: courseMap[item.cid] || item.course,
        }));
      }

      setItems(merged
        .map(({ cid, ...rest }) => ({ ...rest, ...courseState(myProgress.get(cid)) }))
        .sort((x, y) => STAGE_RANK[x.stage] - STAGE_RANK[y.stage] || Number(y.progress || 0) - Number(x.progress || 0)));
    } finally {
      setLoading(false);
    }
  }, [userId, authReady, user]);

  // Clear GET cache on mount so stale empty results don't block fresh data
  useEffect(() => { clearGetCache(); }, []);

  useEffect(() => { load(); }, [load]);

  const shown      = items.filter(it => filter === 'all' || it.stage === filter);
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageItems  = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const changeFilter = (key) => { setFilter(key); setPage(1); };

  async function handleResume(course) {
    const courseId = course?._id ? String(course._id) : null;
    if (!courseId) return;

    const hasAptitude = !!course?.aptitudeEnabled
      && Array.isArray(course?.aptitudeSelectedQuestionIds)
      && course.aptitudeSelectedQuestionIds.length > 0;

    if (hasAptitude) {
      try {
        const res = await apiServiceHandler('GET', `aptitude-attempt/list?courseId=${courseId}`);
        const priorAttempts = toArray(res);
        if (priorAttempts.length === 0) {
          router.push(`/learner/courses/${courseId}/aptitude-test`);
          return;
        }
      } catch {
        // If the check itself fails, don't block the learner from studying —
        // fall through to the normal course route below.
      }
    }

    router.push(`/learner/courses/${courseId}`);
  }

  function renderPagination() {
    const from = shown.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to   = Math.min(page * PAGE_SIZE, shown.length);
    return (
      <div className={s.pagination}>
        <span className={s.paginationInfo}>Showing {from}–{to} of {shown.length}</span>
        <div className={s.paginationBtns}>
          <button className={s.pageBtn} onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p}
              className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ''}`}
              onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
          <button className={s.pageBtn} onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next</button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <section className={s.panel} aria-labelledby="courses-h">
        <CourseFilters id="courses-h" as="h1" title="My Courses" courses={items} value={filter} onChange={changeFilter} showControls={!loading} />

        {loading ? (
          <div className={s.grid}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i}/>)}
          </div>
        ) : items.length === 0 ? (
          <div className={s.empty}>
            <BookIcon/>
            <p className={s.emptyTitle}>No courses available yet</p>
            <p className={s.emptyDesc}>Courses added to your organisation will appear here.</p>
          </div>
        ) : shown.length === 0 ? (
          <div className={s.empty}>
            <BookIcon/>
            <p className={s.emptyTitle}>No {STAGE_LABEL[filter].toLowerCase()} courses</p>
          </div>
        ) : (
          <>
            <div className={s.grid} role="list" aria-label="My courses">
              {pageItems.map(({ id, course, ...state }) => (
                <CourseCard
                  key={id}
                  title={course?.title || 'Untitled Course'}
                  category={course?.catId?.title || course?.category || ''}
                  desc={course?.desc || course?.description || ''}
                  {...state}
                  extra={<CourseMeta course={course}/>}
                  onOpen={() => handleResume(course)}
                />
              ))}
            </div>
            {renderPagination()}
          </>
        )}
      </section>
    </div>
  );
}
