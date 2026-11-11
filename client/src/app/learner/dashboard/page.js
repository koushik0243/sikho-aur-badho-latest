'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { selectUser, selectAuthReady } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import { API_URL } from '../../../lib/constant';
import CourseCard from '../../../Components/Learner/CourseCard/CourseCard';
import CourseFilters from '../../../Components/Learner/CourseCard/CourseFilters';
import { STAGE_LABEL, STAGE_RANK, courseState } from '../../../Components/Learner/CourseCard/courseCardData';
import s from "./Dashboard.module.css";

// Slim progress bar for a stat tile (0–100).
function StatBar({ pct = 0, accent = false }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={`${s.statBar} ${accent ? s.statBarAccent : ''}`} aria-hidden="true">
      {v > 0 && <span style={{ width: `${v}%` }} />}
    </div>
  );
}

// Activity badges ("FAILED", "PASSED", …) take the colour of what they mean.
function badgeTone(badge) {
  const b = String(badge || '').toLowerCase();
  if (/fail|not pass|reject/.test(b)) return s.badgeBad;
  if (/re-?upload/.test(b)) return s.badgeWarn;
  if (/pass|complet|certif|success|approv/.test(b)) return s.badgeGood;
  return '';
}

const Icon = {
  trend:   <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/></svg>,
  clock:   <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>,
  check:   <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>,
  score:   <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>,
  video:   <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/></svg>,
  book:    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4 7.962 7.962 0 009 5.189V4.804z"/></svg>,
  cert:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd"/><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/></svg>,
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function timeAgo(d) {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} mins ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} hr${h > 1 ? 's' : ''} ago` : `${Math.floor(h / 24)}d ago`;
}

const COURSES_PER_PAGE  = 4; // one row of cards on a desktop screen
const ACTIVITY_PER_PAGE = 5;

/** "Showing x–y of n" + Previous / page numbers / Next (same look as the Courses page). */
function Pager({ page, pageSize, total, onPage, label }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav className={s.pagination} aria-label={`${label} pages`}>
      <span className={s.paginationInfo} aria-live="polite">Showing {from}–{to} of {total}</span>
      <div className={s.paginationBtns}>
        <button type="button" className={s.pageBtn} onClick={() => onPage(page - 1)} disabled={page === 1}>Previous</button>
        {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
          <button key={n} type="button" className={`${s.pageBtn} ${n === page ? s.pageBtnActive : ''}`}
            onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined}>{n}</button>
        ))}
        <button type="button" className={s.pageBtn} onClick={() => onPage(page + 1)} disabled={page === pages}>Next</button>
      </div>
    </nav>
  );
}

export default function LearnerDashboardPage() {
  const user      = useSelector(selectUser);
  const authReady = useSelector(selectAuthReady);
  const router    = useRouter();

  const [courses,    setCourses]    = useState([]);
  const [sessions,   setSessions]   = useState([]);
  const [activities, setActivities] = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [courseFilter, setCourseFilter] = useState('all');
  const [coursePage,   setCoursePage]   = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  // A new filter starts the course list again at page 1.
  const changeCourseFilter = (key) => { setCourseFilter(key); setCoursePage(1); };

  const load = useCallback(async () => {
    const userId = user?._id ? String(user._id) : '';
    const orgId  = (() => {
      const raw = user?.orgId;
      if (!raw) return null;
      if (typeof raw === 'object' && raw._id) return String(raw._id);
      return String(raw);
    })();

    if (!userId) {
      if (authReady) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [caRes, courseRes, ocRes, sessRes, actRes, myProgRes] = await Promise.all([
        apiServiceHandler('GET', `course-assignment/list?userId=${userId}`).catch(() => null),
        apiServiceHandler('GET', 'course/list').catch(() => null),
        orgId ? apiServiceHandler('GET', `organization-course/list?orgId=${orgId}`).catch(() => null) : Promise.resolve(null),
        apiServiceHandler('GET', 'live-session/list').catch(() => null),
        apiServiceHandler('GET', `activity-log/list?userId=${userId}`).catch(() => null),
        apiServiceHandler('GET', `my-report/progress?t=${Date.now()}`).catch(() => null),
      ]);
      // Real progress per course (lessons watched + quizzes passed), to show Start vs Resume.
      const myProgress = new Map((myProgRes?.data?.courses || []).map(c => [String(c.courseId), c]));

      const toArr = res => {
        if (Array.isArray(res))                  return res;
        if (Array.isArray(res?.data))            return res.data;
        if (Array.isArray(res?.data?.courses))   return res.data.courses;
        if (Array.isArray(res?.data?.data))      return res.data.data;
        if (Array.isArray(res?.data?.list))      return res.data.list;
        if (Array.isArray(res?.courses))         return res.courses;
        if (Array.isArray(res?.list))            return res.list;
        if (Array.isArray(res?.result))          return res.result;
        return [];
      };

      const userAssignments = toArr(caRes);
      const allCourses      = toArr(courseRes);
      const orgCourseList   = toArr(ocRes);
      const liveSessions    = toArr(sessRes);
      const activityList    = toArr(actRes);

      // Build courseMap — org-course entries carry course_image so overlay last
      const courseMap = {};
      for (const c of allCourses) {
        const key = String(c._id || c.id || '');
        if (key) courseMap[key] = c;
      }
      for (const oc of orgCourseList) {
        const rawId = oc.courseId?._id
          ? String(oc.courseId._id)
          : typeof oc.courseId === 'string' ? oc.courseId : null;
        if (rawId && oc.courseId && typeof oc.courseId === 'object') {
          courseMap[rawId] = { ...courseMap[rawId], ...oc.courseId };
        }
      }

      // Deduplicate user assignments by courseId — keep latest per course
      const seen = new Map();
      for (const a of userAssignments) {
        const rawCid = a.courseId?._id || a.courseId?.id
          || (typeof a.courseId === 'string' ? a.courseId : null);
        const cid = rawCid ? String(rawCid) : null;
        if (!cid) continue;
        const existing = seen.get(cid);
        if (!existing || new Date(a.attemptedAt) > new Date(existing.attemptedAt)) {
          seen.set(cid, a);
        }
      }

      // Build assignments array with enriched course data
      let assignments = Array.from(seen.entries()).map(([cid, a]) => {
        const course = courseMap[cid]
          || (typeof a.courseId === 'object' ? a.courseId : {});
        return {
          _id: a._id, cid, courseId: course, courseName: course?.title, score: a.score, status: a.status,
          ...courseState(myProgress.get(cid)),
        };
      }).filter(a => a.courseId && (a.courseId._id || a.courseId.title));

      // Per-course fallback for any still missing course_image
      const needImage = assignments.filter(a => !a.courseId?.course_image);
      if (needImage.length > 0) {
        const fetched = await Promise.all(
          needImage.map(a => apiServiceHandler('GET', `course/${a.cid}`).catch(() => null))
        );
        fetched.forEach((res, i) => {
          if (!res) return;
          const full = res?.data ?? res;
          if (full?.course_image || full?.title) {
            const cid = needImage[i].cid;
            courseMap[cid] = { ...courseMap[cid], ...full };
          }
        });
        assignments = assignments.map(a => ({
          ...a,
          courseId: courseMap[a.cid] || a.courseId,
        }));
      }

      setCourses([...assignments].sort((x, y) => STAGE_RANK[x.stage] - STAGE_RANK[y.stage] || Number(y.progress || 0) - Number(x.progress || 0)));
      setSessions(liveSessions.slice(0, 3));
      setActivities(activityList);

      // Headline numbers come from the same report as My Progress, so the two pages agree.
      setStats(myProgRes?.data?.totals || null);
    } finally {
      setLoading(false);
    }
  }, [user, authReady]);

  useEffect(() => { load(); }, [load]);

  const tot = stats || {};
  const pctOf = (n, d) => (d ? (n / d) * 100 : 0);
  const testsTaken = (tot.testsPassed || 0) + (tot.testsFailed || 0);
  const STATS = [
    { key: 'progress', label: 'Overall progress', icon: Icon.trend, value: `${tot.overall ?? 0}%`,
      caption: `${tot.completedCourses ?? 0} of ${tot.courses ?? 0} courses completed`, pct: tot.overall, accent: true },
    { key: 'chapters', label: 'Chapters', icon: Icon.book, value: `${tot.chaptersDone ?? 0}`, sub: ` / ${tot.chapters ?? 0}`,
      caption: `${tot.chaptersPending ?? 0} still to finish`, pct: pctOf(tot.chaptersDone, tot.chapters) },
    { key: 'tests', label: 'Tests passed', icon: Icon.check, value: `${tot.testsPassed ?? 0}`, sub: ` / ${testsTaken}`,
      caption: testsTaken ? `${tot.testsFailed} not passed yet` : 'No tests taken yet', pct: pctOf(tot.testsPassed, testsTaken) },
    { key: 'score', label: 'My score', icon: Icon.score, value: `${tot.myScore ?? 0}%`,
      caption: `Average best quiz score · ${tot.certificates ?? 0} certificate${tot.certificates === 1 ? '' : 's'}`, pct: tot.myScore },
  ];

  return (
    <div className={s.page}>
      {/* ── Section title ── */}
      <header className={s.pageHead}>
        <h1 className={s.sectionHeading}>Welcome back{user?.name ? `, ${String(user.name).split(' ')[0]}` : ''}</h1>
        <p className={s.pageSub}>Pick up where you left off.</p>
      </header>

      {/* ── Stats ── */}
      <section className={s.statsRow} aria-label="Overview">
        {STATS.map(st => (
          <div key={st.key} className={`${s.statCard} ${st.accent ? s.statCardAccent : ''}`}>
            <div className={s.statTop}>
              <div className={`${s.statIconWrap} ${st.accent ? s.statIconAccent : ''}`}>
                {st.icon}
              </div>
              <span className={s.statLabel}>{st.label}</span>
            </div>
            <div className={s.statValue}>
              {loading ? '—' : st.value}
              {!loading && st.sub && <span className={s.statSub}>{st.sub}</span>}
            </div>
            <StatBar pct={loading ? 0 : st.pct} accent={st.accent} />
            <div className={s.statCaption}>{loading ? ' ' : st.caption}</div>
          </div>
        ))}
      </section>

      {/* ── My Courses: every course ── */}
      <section className={s.coursesPanel} aria-labelledby="my-courses-h">
        <CourseFilters id="my-courses-h" title="My Courses" courses={courses} value={courseFilter} onChange={changeCourseFilter} showControls={!loading} />

        {loading ? (
          <div className={s.courseGrid}>{[0, 1, 2, 3].map(i => <div key={i} className={s.skelCard}/>)}</div>
        ) : courses.length === 0 ? (
          <div className={s.empty}><span>{Icon.book}</span><p>No courses enrolled yet.</p></div>
        ) : (() => {
          const shown = courses.filter(c => courseFilter === 'all' || c.stage === courseFilter);
          if (!shown.length) return <div className={s.empty}><span>{Icon.book}</span><p>No {STAGE_LABEL[courseFilter].toLowerCase()} courses.</p></div>;
          return (
            <>
              <div className={s.courseGrid} role="list" aria-label="My courses">
                {shown.slice((coursePage - 1) * COURSES_PER_PAGE, coursePage * COURSES_PER_PAGE).map((ca, i) => {
                  const c = ca.courseId || ca.course || {};
                  const cId = c._id ? String(c._id) : null;
                  return (
                    <CourseCard key={ca._id || i}
                      title={c.title || ca.courseName || 'Untitled Course'}
                      category={c.catId?.title || c.category || ''}
                      desc={c.desc || c.description || ''}
                      stage={ca.stage} started={ca.started} progress={ca.progress}
                      chapters={ca.chapters} chaptersDone={ca.chaptersDone} currentChapter={ca.currentChapter} certificate={ca.certificate}
                      onOpen={() => cId && router.push(`/learner/courses/${cId}`)} />
                  );
                })}
              </div>
              <Pager page={coursePage} pageSize={COURSES_PER_PAGE} total={shown.length} onPage={setCoursePage} label="My courses" />
            </>
          );
        })()}
      </section>

      {/* ── Activity + Sessions ── */}
      <div className={s.midRow}>
        {/* Activity Log */}
        <div className={s.activitySection}>
          <div className={s.panelHead}>
            <h2 className={s.panelTitle}>Recent Activity Log</h2>
          </div>

          {loading ? (
            <div className={s.activityList}>{[0,1,2].map(i => <div key={i} className={s.skelActivity}/>)}</div>
          ) : activities.length === 0 ? (
            <div className={s.empty}><span>{Icon.cert}</span><p>No recent activity.</p></div>
          ) : (
            <div className={s.activityList}>
              {activities.slice((activityPage - 1) * ACTIVITY_PER_PAGE, activityPage * ACTIVITY_PER_PAGE).map((act, i) => (
                <div key={act._id || i} className={s.activityItem}>
                  <span className={s.activityNum}>{(activityPage - 1) * ACTIVITY_PER_PAGE + i + 1}</span>
                  <div className={s.activityBody}>
                    <p className={s.activityTitle}>{act.title || act.action || 'Activity'}</p>
                    {act.description && <p className={s.activityDesc}>{act.description}</p>}
                  </div>
                  <div className={s.activityMeta}>
                    {act.badge && <span className={`${s.activityBadge} ${badgeTone(act.badge)}`}>{act.badge}</span>}
                    <span className={s.activityTime}>{timeAgo(act.createdAt || act.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && <Pager page={activityPage} pageSize={ACTIVITY_PER_PAGE} total={activities.length} onPage={setActivityPage} label="Recent activity" />}
        </div>

        {/* Live Sessions */}
        <div className={s.sessionsPanel}>
          <div className={s.panelHead}>
            <h2 className={s.panelTitle}>Upcoming Live Sessions</h2>
          </div>

          {loading ? (
            <div className={s.sessionList}>{[0,1,2].map(i => <div key={i} className={s.skelSession}/>)}</div>
          ) : sessions.length === 0 ? (
            <div className={s.empty}><span>{Icon.video}</span><p>No upcoming sessions.</p></div>
          ) : (
            <div className={s.sessionList}>
              {sessions.map((sess, i) => {
                const img = (sess.thumbnail || sess.image) ? `${API_URL}${sess.thumbnail || sess.image}` : null;
                return (
                  <div key={sess._id || i} className={`${s.sessionItem} ${i === 1 ? s.sessionItemActive : ''}`}>
                    <div className={s.sessionThumb}>
                      {img
                        ? <img src={img} alt={sess.title} className={s.sessionThumbImg}/>
                        : <div className={s.sessionThumbPlaceholder}>{Icon.video}</div>
                      }
                    </div>
                    <div className={s.sessionBody}>
                      <p className={s.sessionTitle}>{sess.title || 'Live Session'}</p>
                      <p className={s.sessionInstructor}>Session with {sess.instructor || sess.instructorName || 'Instructor Name'}</p>
                      <p className={s.sessionTime}>{fmtDate(sess.scheduledAt || sess.date)} &nbsp;{fmtTime(sess.scheduledAt || sess.date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
