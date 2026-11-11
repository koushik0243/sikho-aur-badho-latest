'use client';

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import s from "./TrackAnalysis.module.css";

const AVATAR_COLORS = ['#d4897a','#e5a97b','#c8956a','#b8856a','#5a9b8a','#7b9fd4','#9b8ad4','#d4a87a'];

function toArr(res) {
  if (Array.isArray(res))             return res;
  if (Array.isArray(res?.data))       return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data?.list)) return res.data.list;
  if (Array.isArray(res?.list))       return res.list;
  return [];
}

function InitialAvatar({ name, idx }) {
  const color    = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const initials = name
    ? name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  return (
    <svg className={s.avatar} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="20" fill={color} />
      <text x="20" y="25" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">{initials}</text>
    </svg>
  );
}

const ChevronIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const Icon = {
  users:     <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>,
  book:      <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>,
  clipboard: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
  check:     <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
};

const EyeIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
  </svg>
);

export default function TrackAnalysisPage() {
  const user   = useSelector(selectUser);
  const router = useRouter();

  const [loading,         setLoading]         = useState(true);
  const [coursesForDrop,  setCoursesForDrop]  = useState([]);
  const [learners,        setLearners]        = useState([]);
  const [assignments,     setAssignments]     = useState([]);
  const [failureChapters, setFailureChapters] = useState([]);
  const [selectedCourse,  setSelectedCourse]  = useState(null);
  const [quizTopics,      setQuizTopics]      = useState([]);
  const [courseAttempts,  setCourseAttempts]  = useState([]);
  const [attemptTotals,   setAttemptTotals]   = useState({ total: 0, passed: 0 });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let orgId = user?.orgId ? String(user.orgId) : null;
        if (!orgId) {
          const uid = user?._id || user?.id;
          if (uid) {
            const r   = await apiServiceHandler('GET', `user/admin/edit/${uid}`).catch(() => null);
            const rec = r?.data ?? r;
            orgId     = rec?.orgId ? String(rec.orgId) : null;
          }
        }
        if (!orgId) return;

        const [ocRes, learnerRes, assignRes] = await Promise.all([
          apiServiceHandler('GET', `organization-course/list?orgId=${orgId}`).catch(() => null),
          apiServiceHandler('GET', `user/admin/list?orgId=${orgId}&user_type=employee&orgRole=employee`).catch(() => null),
          apiServiceHandler('GET', `course-assignment/list?organizationId=${orgId}`).catch(() => null),
        ]);

        const ocList     = toArr(ocRes);
        const learnerList = toArr(learnerRes);
        const assignList  = toArr(assignRes);

        setLearners(learnerList);
        setAssignments(assignList);

        const courseIds = ocList.map(oc => {
          const c = oc.courseId;
          return c?._id ? String(c._id) : String(c);
        }).filter(Boolean);

        const drop = ocList.map(oc => {
          const c = oc.courseId;
          return c?._id ? { _id: String(c._id), title: c.title || 'Untitled' } : null;
        }).filter(Boolean);
        setCoursesForDrop(drop);

        if (courseIds.length > 0) {
          const attResults = await Promise.all(
            courseIds.map(cid =>
              apiServiceHandler('GET', `quiz-attempt/course-all?courseId=${cid}`).catch(() => null)
            )
          );
          const allAttempts = attResults.flatMap(r => toArr(r));
          setAttemptTotals({ total: allAttempts.length, passed: allAttempts.filter(a => a.passed).length });

          const topicStats = {};
          for (const att of allAttempts) {
            const tid   = String(att.topicId?._id || att.topicId || '');
            const tName = att.topicId?.title || '';
            const cName = att.topicId?.chapterId?.title || att.chapterId?.title || '';
            if (!tid) continue;
            if (!topicStats[tid]) topicStats[tid] = { total: 0, failed: 0, label: cName ? `${cName} · ${tName}` : tName || 'Quiz' };
            topicStats[tid].total++;
            if (!att.passed) topicStats[tid].failed++;
          }

          const chapters = Object.values(topicStats)
            .filter(d => d.total > 0)
            .map(d => ({ label: d.label, pct: Math.round((d.failed / d.total) * 100), total: d.total }))
            .sort((a, b) => b.pct - a.pct)
            .slice(0, 5);

          setFailureChapters(chapters);
        }
      } finally {
        setLoading(false);
      }
    }
    if (user) load();
  }, [user?._id]);

  // Load quiz topics + attempts for selected course
  useEffect(() => {
    if (!selectedCourse) { setQuizTopics([]); setCourseAttempts([]); return; }
    async function loadCourse() {
      const [topicRes, attRes] = await Promise.all([
        apiServiceHandler('GET', `topic/list?courseId=${selectedCourse._id}`).catch(() => null),
        apiServiceHandler('GET', `quiz-attempt/course-all?courseId=${selectedCourse._id}`).catch(() => null),
      ]);
      setQuizTopics(toArr(topicRes).filter(t => (t.video_type || t.type) === 'quiz'));
      setCourseAttempts(toArr(attRes));
    }
    loadCourse();
  }, [selectedCourse?._id]);

  // Per-topic attempt stats for selected course
  const topicStatMap = {};
  for (const att of courseAttempts) {
    const tid = String(att.topicId?._id || att.topicId || '');
    if (!tid) continue;
    if (!topicStatMap[tid]) topicStatMap[tid] = { total: 0, passed: 0 };
    topicStatMap[tid].total++;
    if (att.passed) topicStatMap[tid].passed++;
  }

  // Per-learner assignment count and latest course
  const learnerAssignCount  = {};
  const learnerLatestCourse = {};
  for (const a of assignments) {
    const uid   = String(a.userId?._id || a.userId || '');
    const title = a.courseId?.title || '';
    if (!uid) continue;
    learnerAssignCount[uid] = (learnerAssignCount[uid] || 0) + 1;
    if (title) learnerLatestCourse[uid] = title;
  }

  const overallPass = attemptTotals.total > 0 ? Math.round((attemptTotals.passed / attemptTotals.total) * 100) : null;
  const KPIS = [
    { label: 'Learners',          value: learners.length,       icon: Icon.users },
    { label: 'Courses',           value: coursesForDrop.length, icon: Icon.book },
    { label: 'Quiz attempts',     value: attemptTotals.total,   icon: Icon.clipboard },
    { label: 'Overall pass rate', value: overallPass === null ? '—' : `${overallPass}%`, icon: Icon.check,
      tone: overallPass === null ? '' : overallPass >= 60 ? 'good' : overallPass >= 35 ? 'warn' : 'bad' },
  ];

  return (
    <div className={s.page}>
      <header className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Track &amp; Analysis</h1>
          <p className={s.pageSub}>Where learners struggle, how each learner is doing, and how every quiz is performing.</p>
        </div>
      </header>

      {loading ? (
        <div className={s.loadingWrap} role="status" aria-label="Loading analysis"><div className={s.spinner} /></div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <section className={s.kpis} aria-label="Overview">
            {KPIS.map(k => (
              <div key={k.label} className={`${s.kpi} ${k.tone ? s[`kpi_${k.tone}`] : ''}`}>
                <span className={s.kpiIcon} aria-hidden="true">{k.icon}</span>
                <div>
                  <div className={s.kpiValue}>{k.value}</div>
                  <div className={s.kpiLabel}>{k.label}</div>
                </div>
              </div>
            ))}
          </section>

          {/* ── Chapter-wise failure analysis ── */}
          <section className={s.card} aria-labelledby="ta-fail-h">
            <div className={s.cardHead}>
              <div>
                <h2 id="ta-fail-h" className={s.cardTitle}>Chapter-wise failure analysis</h2>
                <p className={s.cardSub}>Quizzes learners fail most often — the place to improve content first.</p>
              </div>
              <span className={s.cardMeta}>
                {failureChapters.length > 0 ? `Top ${failureChapters.length} by fail rate` : 'No quiz attempt data yet'}
              </span>
            </div>
            <div className={s.cardBody}>
              {failureChapters.length > 0 ? (
                <ol className={s.failList}>
                  {failureChapters.map((ch, i) => {
                    const tone = ch.pct > 60 ? 'bad' : ch.pct > 35 ? 'warn' : 'good';
                    return (
                      <li key={ch.label} className={s.failRow}>
                        <span className={s.failRank}>{i + 1}</span>
                        <div className={s.failMain}>
                          <div className={s.failTop}>
                            <span className={s.failLabel} title={ch.label}>{ch.label}</span>
                            <span className={s.failMeta}>{ch.total} attempt{ch.total !== 1 ? 's' : ''}</span>
                          </div>
                          <div className={s.failTrack} role="progressbar" aria-valuenow={ch.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${ch.label} fail rate`}>
                            <span className={s[`fill_${tone}`]} style={{ width: `${Math.max(ch.pct, 2)}%` }} />
                          </div>
                        </div>
                        <span className={`${s.failPct} ${s[`pct_${tone}`]}`}>{ch.pct}%<small>fail</small></span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className={s.emptyNote}>No quiz attempts recorded yet for your courses.</p>
              )}
            </div>
          </section>

          {/* ── Learners + quiz tracking ── */}
          <div className={s.bottomGrid}>
            <section className={s.card} aria-labelledby="ta-learners-h">
              <div className={s.cardHead}>
                <div>
                  <h2 id="ta-learners-h" className={s.cardTitle}>Learner progress</h2>
                  <p className={s.cardSub}>Open a learner to see their course-by-course progress.</p>
                </div>
                <span className={s.cardMeta}>{learners.length} learner{learners.length !== 1 ? 's' : ''}</span>
              </div>
              {learners.length === 0 ? (
                <p className={s.emptyNote}>No learners enrolled yet.</p>
              ) : (
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th scope="col">Learner</th>
                        <th scope="col" className={s.num}>Courses</th>
                        <th scope="col">Status</th>
                        <th scope="col" className={s.actionCol}><span className={s.srOnly}>Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {learners.map((l, i) => {
                        const uid     = String(l._id || '');
                        const name    = l.name || l.fullName || `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Learner';
                        const courses = learnerAssignCount[uid] || 0;
                        const latest  = learnerLatestCourse[uid] || 'No course assigned';
                        const active  = (l.status || 'active').toLowerCase() === 'active';
                        return (
                          <tr key={uid || i}>
                            <td>
                              <div className={s.who}>
                                <InitialAvatar name={name} idx={i} />
                                <div className={s.whoText}>
                                  <div className={s.learnerName}>{name}</div>
                                  <div className={s.learnerSub}>{latest}</div>
                                </div>
                              </div>
                            </td>
                            <td className={s.num}><span className={s.countPill}>{courses}</span></td>
                            <td><span className={active ? s.statusActive : s.statusInactive}>{l.status || 'Active'}</span></td>
                            <td className={s.actionCol}>
                              <button data-action="view" className={s.btnView} onClick={() => router.push(`/storeowner/track-analysis/${uid}`)}
                                title="View" aria-label={`View ${name}'s progress`}>
                                {EyeIcon}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={`${s.card} ${s.videoCard}`} aria-labelledby="ta-quiz-h">
              <div className={s.cardHead}>
                <div>
                  <h2 id="ta-quiz-h" className={s.cardTitle}>Quiz completion tracking</h2>
                  <p className={s.cardSub}>Pass rate for every quiz in a course.</p>
                </div>
              </div>
              <div className={s.cardBody}>
                <div className={s.selectWrap}>
                  <select
                    className={s.select}
                    aria-label="Course"
                    value={selectedCourse?._id || ''}
                    onChange={e => {
                      const found = coursesForDrop.find(c => c._id === e.target.value);
                      setSelectedCourse(found || null);
                    }}
                  >
                    <option value="" disabled>Select a course</option>
                    {coursesForDrop.map(c => (
                      <option key={c._id} value={c._id}>{c.title}</option>
                    ))}
                  </select>
                  <span className={s.chevron}>{ChevronIcon}</span>
                </div>

                {!selectedCourse && <p className={s.emptyNote}>Select a course to view quiz stats.</p>}
                {selectedCourse && quizTopics.length === 0 && <p className={s.emptyNote}>No quiz topics in this course.</p>}

                {quizTopics.length > 0 && (
                  <div className={s.videoList} tabIndex={0} role="region" aria-label="Quiz completion by quiz">
                    {quizTopics.map(tp => {
                      const tid   = String(tp._id);
                      const stats = topicStatMap[tid] || { total: 0, passed: 0 };
                      const pct   = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
                      const tone  = stats.total === 0 ? 'none' : pct >= 60 ? 'good' : pct >= 35 ? 'warn' : 'bad';
                      return (
                        <div key={tid} className={s.videoItem}>
                          <div className={s.videoTop}>
                            <div className={s.videoTitle}>{tp.title}</div>
                            <span className={`${s.ratePill} ${s[`rate_${tone}`]}`}>{stats.total ? `${pct}% pass` : 'No attempts'}</span>
                          </div>
                          <div className={s.videoProgressRow}>
                            <div className={s.videoTrack}>
                              <div className={`${s.videoFill} ${s[`fill_${tone === 'none' ? 'good' : tone}`]}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={s.videoScore}>{stats.passed}/{stats.total} passed</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
