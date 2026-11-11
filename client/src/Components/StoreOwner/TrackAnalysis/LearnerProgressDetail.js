'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import s from './LearnerProgressDetail.module.css';

function toArr(res) {
  if (Array.isArray(res))             return res;
  if (Array.isArray(res?.data))       return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data?.list)) return res.data.list;
  if (Array.isArray(res?.list))       return res.list;
  return [];
}

function getTopicType(topic) {
  const vt = String(topic?.video_type || topic?.type || '').toLowerCase().trim();
  if (vt === 'quiz') return 'quiz';
  if (vt === 'zoom_link' || vt === 'zoom' || vt === 'live' || vt === 'meeting') return 'zoom';
  if (vt === 'assignment') return 'assignment';
  return 'lesson';
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const ChevronIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const BackIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

export default function LearnerProgressDetail() {
  const { learnerId } = useParams();
  const router = useRouter();

  const [learner,  setLearner]  = useState(null);
  const [courses,  setCourses]  = useState([]); // [{ course, chapters, rows }]
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expanded, setExpanded] = useState({}); // courseId -> bool

  const load = useCallback(async () => {
    if (!learnerId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const [learnerRes, assignRes] = await Promise.all([
        apiServiceHandler('GET', `user/admin/edit/${learnerId}`).catch(() => null),
        apiServiceHandler('GET', `course-assignment/list?userId=${learnerId}`).catch(() => null),
      ]);
      const learnerData = learnerRes?.data ?? learnerRes;
      if (!learnerData?._id) { setNotFound(true); setLoading(false); return; }
      setLearner(learnerData);

      // Distinct assigned courses (this collection also holds per-quiz-topic
      // attempt records for the same learner, so de-dupe by courseId).
      const seen = new Map();
      toArr(assignRes).forEach(a => {
        const c = a.courseId;
        const cid = String(c?._id || c || '');
        if (cid && !seen.has(cid)) seen.set(cid, c?._id ? { _id: cid, title: c.title || 'Untitled Course' } : null);
      });
      const courseRefs = [...seen.values()].filter(Boolean);

      // Drop courses that no longer exist or have been soft-deleted
      // (course/:id returns nothing when deletedAt is set).
      const liveCourseChecks = await Promise.all(courseRefs.map(async (course) => {
        const res = await apiServiceHandler('GET', `course/${course._id}`).catch(() => null);
        const data = res?.data ?? res;
        return data?._id ? { _id: course._id, title: data.title || course.title } : null;
      }));
      const liveCourseRefs = liveCourseChecks.filter(Boolean);

      const courseData = await Promise.all(liveCourseRefs.map(async (course) => {
        const cid = course._id;
        const [chRes, topRes, progRes, quizRes] = await Promise.all([
          apiServiceHandler('GET', `chapter/list?courseId=${cid}`).catch(() => null),
          apiServiceHandler('GET', `topic/list?courseId=${cid}`).catch(() => null),
          apiServiceHandler('GET', `progress/course-admin?courseId=${cid}&userId=${learnerId}`).catch(() => null),
          apiServiceHandler('GET', `quiz-attempt/course-all?courseId=${cid}`).catch(() => null),
        ]);

        const chapters = toArr(chRes);
        const topics    = toArr(topRes);
        const progData  = progRes?.data ?? progRes;
        const progressRecords = Array.isArray(progData?.topics) ? progData.topics : [];
        const progressByTopic = {};
        progressRecords.forEach(p => { progressByTopic[String(p.topicId)] = p; });

        const attempts = toArr(quizRes).filter(a => String(a.userId?._id || a.userId || '') === String(learnerId));
        const latestAttemptByTopic = {};
        attempts.forEach(a => {
          const tid = String(a.topicId?._id || a.topicId || '');
          if (!tid) return;
          const existing = latestAttemptByTopic[tid];
          if (!existing || new Date(a.createdAt) > new Date(existing.createdAt)) {
            latestAttemptByTopic[tid] = a;
          }
        });

        const topicsByChapter = {};
        topics.forEach(t => {
          const cidTopic = String(t.chapterId?._id || t.chapterId || '');
          if (!topicsByChapter[cidTopic]) topicsByChapter[cidTopic] = [];
          topicsByChapter[cidTopic].push(t);
        });

        const rows = chapters.map((ch, idx) => {
          const chId = String(ch._id || '');
          const chTopics = topicsByChapter[chId] || [];
          const lessonTopics = chTopics.filter(t => getTopicType(t) === 'lesson');
          const quizTopics   = chTopics.filter(t => getTopicType(t) === 'quiz');

          let chapterPct = null;
          if (lessonTopics.length > 0) {
            const totalDur = lessonTopics.reduce((sum, t) => sum + (progressByTopic[String(t._id)]?.durationSeconds || 0), 0);
            const totalWatched = lessonTopics.reduce((sum, t) => {
              const p = progressByTopic[String(t._id)];
              return sum + Math.min(p?.watchedSeconds || 0, p?.durationSeconds || 0);
            }, 0);
            chapterPct = totalDur > 0 ? Math.min(100, Math.round((totalWatched / totalDur) * 100)) : 0;
          }

          const quizTopic = quizTopics[0] || null;
          const quizAttempt = quizTopic ? latestAttemptByTopic[String(quizTopic._id)] : null;
          const quizStatus = !quizTopic ? 'none'
            : !quizAttempt ? 'not-attempted'
            : quizAttempt.passed ? 'passed' : 'failed';
          const quizScore = quizAttempt ? Number(quizAttempt.totalScore || 0) : null;

          return {
            idx,
            id: chId,
            title: ch.title || `Chapter ${idx + 1}`,
            topicCount: chTopics.length,
            chapterPct,
            quizStatus,
            quizScore,
          };
        });

        return { course, rows };
      }));

      setCourses(courseData);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [learnerId]);

  useEffect(() => { load(); }, [load]);

  function toggleCourse(cid) {
    setExpanded(prev => ({ ...prev, [cid]: !prev[cid] }));
  }

  const learnerName = learner?.name || learner?.fullName || `${learner?.firstName || ''} ${learner?.lastName || ''}`.trim() || 'Learner';

  return (
    <div className={s.page}>
      {/* Breadcrumb */}
      <div className={s.breadcrumb}>
        <button className={s.backBtn} onClick={() => router.push('/storeowner/track-analysis')}>
          {BackIcon} Track &amp; Analysis
        </button>
        {!loading && !notFound && (
          <>
            <span className={s.breadSep}>/</span>
            <span className={s.breadCurr}>{learnerName}</span>
          </>
        )}
      </div>

      {loading ? (
        <div className={s.loadingWrap}><div className={s.spinner} /></div>
      ) : notFound ? (
        <div className={s.emptyWrap}>
          <p className={s.emptyTitle}>Learner not found</p>
          <button className={s.btnBack} onClick={() => router.push('/storeowner/track-analysis')}>
            ← Back to Track &amp; Analysis
          </button>
        </div>
      ) : (
        <>
          {/* Learner header */}
          <div className={s.learnerHeader}>
            <div className={s.learnerAvatar}>{getInitials(learnerName)}</div>
            <div className={s.learnerHeaderInfo}>
              <h1 className={s.learnerName}>{learnerName}</h1>
              <p className={s.learnerEmail}>{learner?.email || '—'}</p>
            </div>
            <div className={s.courseCountPill}>
              {courses.length} {courses.length === 1 ? 'Course' : 'Courses'}
            </div>
          </div>

          {/* Per-course progress */}
          {courses.length === 0 ? (
            <div className={s.emptyWrap}>
              <p className={s.emptyTitle}>No courses assigned</p>
              <span className={s.emptySub}>This learner hasn&apos;t been assigned any course yet.</span>
            </div>
          ) : (
            <div className={s.courseList}>
              {courses.map(({ course, rows }) => {
                const cid = String(course._id);
                const isOpen = expanded[cid] !== false; // default open
                const lessonRows = rows.filter(r => r.chapterPct !== null);
                const avgPct = lessonRows.length > 0
                  ? Math.round(lessonRows.reduce((sum, r) => sum + r.chapterPct, 0) / lessonRows.length)
                  : 0;
                const quizRows = rows.filter(r => r.quizStatus !== 'none');
                const passedCount = quizRows.filter(r => r.quizStatus === 'passed').length;

                return (
                  <div key={cid} className={s.courseCard}>
                    <div className={s.courseCardHead} onClick={() => toggleCourse(cid)}>
                      <div className={s.courseCardHeadLeft}>
                        <h3 className={s.courseTitle}>{course.title}</h3>
                        <span className={s.courseMeta}>
                          {rows.length} chapter{rows.length !== 1 ? 's' : ''}
                          {quizRows.length > 0 && <> &middot; {passedCount}/{quizRows.length} quizzes passed</>}
                        </span>
                      </div>
                      <div className={s.courseCardHeadRight}>
                        <div className={s.courseProgressMini}>
                          <div className={s.courseProgressTrack}>
                            <div className={s.courseProgressFill} style={{ width: `${avgPct}%` }} />
                          </div>
                          <span className={s.courseProgressPct}>{avgPct}%</span>
                        </div>
                        <span className={s.chevronBox} style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                          {ChevronIcon}
                        </span>
                      </div>
                    </div>

                    {isOpen && (
                      rows.length === 0 ? (
                        <p className={s.noChaptersNote}>No chapters in this course yet.</p>
                      ) : (
                        <div className={s.chapterTable}>
                          <div className={s.chapterTableHead}>
                            <span className={s.colChapter}>Chapter</span>
                            <span className={s.colProgress}>Progress</span>
                            <span className={s.colQuiz}>Quiz</span>
                          </div>
                          {rows.map(r => (
                            <div key={r.id || r.idx} className={s.chapterRow}>
                              <div className={s.colChapter}>
                                <span className={s.chapterRowTitle}>Ch {r.idx + 1} &ndash; {r.title}</span>
                                <span className={s.chapterRowMeta}>{r.topicCount} topic{r.topicCount !== 1 ? 's' : ''}</span>
                              </div>
                              <div className={s.colProgress}>
                                {r.chapterPct !== null ? (
                                  <div className={s.rowProgress}>
                                    <div className={s.rowProgressTrack}>
                                      <div className={s.rowProgressFill} style={{ width: `${r.chapterPct}%` }} />
                                    </div>
                                    <span className={s.rowProgressPct}>{r.chapterPct}%</span>
                                  </div>
                                ) : (
                                  <span className={s.noDataNote}>No lessons</span>
                                )}
                              </div>
                              <div className={s.colQuiz}>
                                {r.quizStatus === 'none' && <span className={s.quizNone}>—</span>}
                                {r.quizStatus === 'not-attempted' && <span className={s.quizPill + ' ' + s.quizPending}>Not Attempted</span>}
                                {r.quizStatus === 'passed' && (
                                  <span className={`${s.quizPill} ${s.quizPassed}`}>Passed{r.quizScore !== null ? ` — ${r.quizScore}%` : ''}</span>
                                )}
                                {r.quizStatus === 'failed' && (
                                  <span className={`${s.quizPill} ${s.quizFailed}`}>Failed{r.quizScore !== null ? ` — ${r.quizScore}%` : ''}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
