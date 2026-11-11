'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectUser, selectAuthReady } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import { DEFAULT_PASSING_GRADE } from '../../../Components/Learner/quizSettings';
import pageStyles from "./Quiz.module.css";
import { withLearnerKit } from '../../../Components/Learner/LearnerKit/LearnerKit';

// Page styles + the shared learner page look.
const s = withLearnerKit(pageStyles);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

function toArr(res) {
  if (Array.isArray(res))              return res;
  if (Array.isArray(res?.data))        return res.data;
  if (Array.isArray(res?.data?.data))  return res.data.data;
  if (Array.isArray(res?.data?.list))  return res.data.list;
  if (Array.isArray(res?.list))        return res.list;
  return [];
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTimeOfDay(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function ResultCircle({ passed }) {
  if (passed) {
    return (
      <div className={s.circleWrap}>
        <div className={`${s.circle} ${s.circlePassed}`}>
          <svg viewBox="0 0 48 48" fill="none" width="52" height="52">
            <circle cx="24" cy="24" r="22" stroke="#16a34a" strokeWidth="3" fill="#dcfce7"/>
            <path d="M14 24l7 7 13-13" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className={`${s.circleRing} ${s.circleRingPassed}`}/>
      </div>
    );
  }
  return (
    <div className={s.circleWrap}>
      <div className={`${s.circle} ${s.circleFailed}`}>
        <svg viewBox="0 0 48 48" fill="none" width="52" height="52">
          <circle cx="24" cy="24" r="22" stroke="#dc2626" strokeWidth="3" fill="#fee2e2"/>
          <path d="M16 16l16 16M32 16L16 32" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className={`${s.circleRing} ${s.circleRingFailed}`}/>
    </div>
  );
}

export default function QuizResultPage() {
  const router    = useRouter();
  const user      = useSelector(selectUser);
  const authReady = useSelector(selectAuthReady);
  const userId    = user ? String(user._id || user.id || '') : '';

  const [courses,        setCourses]        = useState([]);
  const [chapters,       setChapters]       = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedChapter,setSelectedChapter]= useState('');
  const [attempts,       setAttempts]       = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingChapters,setLoadingChapters]= useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  // Load courses the learner is enrolled in
  useEffect(() => {
    if (!authReady || !userId) { setLoadingCourses(false); return; }
    let cancelled = false;
    async function loadCourses() {
      try {
        const [assignRes, allRes] = await Promise.all([
          apiServiceHandler('GET', `course-assignment/list?userId=${userId}`).catch(() => null),
          apiServiceHandler('GET', 'course/list').catch(() => null),
        ]);
        if (cancelled) return;

        const assigned = toArr(assignRes);
        const all      = toArr(allRes);

        // Build course list from assignments, fall back to all courses
        let list = [];
        if (assigned.length > 0) {
          list = assigned.map(a => {
            const cObj = all.find(c => String(c._id) === String(a.courseId?._id || a.courseId || ''));
            return cObj || a.courseId || a;
          }).filter(c => c && c._id);
        } else {
          list = all;
        }
        setCourses(list);
        // Open on the first course with a quiz attempt (else the first course), so the page shows results straight away.
        const prog = await apiServiceHandler('GET', `my-report/progress?t=${Date.now()}`).catch(() => null);
        if (cancelled) return;
        const withResults = new Set((prog?.data?.tests || []).map(x => String(x.courseId)));
        const pick = list.find(c => withResults.has(String(c._id))) || list[0];
        if (pick?._id) setSelectedCourse(prev => prev || String(pick._id));
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    }
    loadCourses();
    return () => { cancelled = true; };
  }, [userId, authReady]);

  // Load chapters when course changes
  useEffect(() => {
    if (!selectedCourse) { setChapters([]); setSelectedChapter(''); return; }
    let cancelled = false;
    setLoadingChapters(true);
    setChapters([]);
    setSelectedChapter('');
    setAttempts([]);
    async function loadChapters() {
      try {
        const res = await apiServiceHandler('GET', `chapter/list?courseId=${selectedCourse}`).catch(() => null);
        if (!cancelled) setChapters(toArr(res));
      } finally {
        if (!cancelled) setLoadingChapters(false);
      }
    }
    loadChapters();
    return () => { cancelled = true; };
  }, [selectedCourse]);

  // Load quiz attempts when course (or chapter) changes
  useEffect(() => {
    if (!selectedCourse) { setAttempts([]); return; }
    let cancelled = false;
    setLoadingResults(true);
    async function loadAttempts() {
      try {
        let url = `quiz-attempt/course?courseId=${selectedCourse}`;
        if (selectedChapter) url += `&chapterId=${selectedChapter}`;
        const res = await apiServiceHandler('GET', url).catch(() => null);
        if (!cancelled) setAttempts(toArr(res));
      } finally {
        if (!cancelled) setLoadingResults(false);
      }
    }
    loadAttempts();
    return () => { cancelled = true; };
  }, [selectedCourse, selectedChapter]);

  const activeCourse = courses.find(c => String(c._id) === selectedCourse);
  const latestAttempt = attempts[0] ?? null;

  return (
    <div className={s.page}>

      <button
        className={s.backBtn}
        onClick={() => router.push(selectedCourse ? `/learner/courses/${selectedCourse}` : '/learner/courses')}
      >
        {BackArrow} Back to {selectedCourse ? 'Course' : 'Courses'}
      </button>

      {/* ── Filter bar ── */}
      <div className={s.filterCard}>
        <p className={s.filterMeta}>My Progress</p>
        <h2 className={s.filterTitle}>Quiz Results</h2>
        <div className={s.filterRow}>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Course</label>
            <div className={s.selectWrap}>
              <select
                className={s.select}
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                disabled={loadingCourses}
              >
                <option value="">
                  {loadingCourses ? 'Loading courses…' : '— Select a course —'}
                </option>
                {courses.map(c => (
                  <option key={String(c._id)} value={String(c._id)}>
                    {c.title || 'Untitled Course'}
                  </option>
                ))}
              </select>
              <span className={s.selectArrow}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </span>
            </div>
          </div>

          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Chapter</label>
            <div className={s.selectWrap}>
              <select
                className={s.select}
                value={selectedChapter}
                onChange={e => setSelectedChapter(e.target.value)}
                disabled={!selectedCourse || loadingChapters}
              >
                <option value="">
                  {loadingChapters ? 'Loading chapters…' : '— All Chapters —'}
                </option>
                {chapters.map((ch, i) => (
                  <option key={String(ch._id)} value={String(ch._id)}>
                    Ch {i + 1} – {ch.title || `Chapter ${i + 1}`}
                  </option>
                ))}
              </select>
              <span className={s.selectArrow}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── No course selected ── */}
      {!selectedCourse && (
        <div className={s.emptyWrap}>
          <svg viewBox="0 0 48 48" fill="none" width="52" height="52" style={{ opacity: 0.25 }}>
            <rect x="6" y="8" width="36" height="32" rx="4" stroke="#0b7b7b" strokeWidth="2.5"/>
            <path d="M14 18h20M14 24h14M14 30h10" stroke="#0b7b7b" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <p className={s.emptyTitle}>Select a course to view quiz results</p>
          <span className={s.emptySub}>Choose a course and optionally a chapter from the filters above.</span>
        </div>
      )}

      {/* ── Loading results ── */}
      {selectedCourse && loadingResults && (
        <div className={s.loadingWrap}><div className={s.spinner}/></div>
      )}

      {/* ── No attempts found ── */}
      {selectedCourse && !loadingResults && attempts.length === 0 && (
        <div className={s.emptyWrap}>
          <svg viewBox="0 0 48 48" fill="none" width="52" height="52" style={{ opacity: 0.25 }}>
            <circle cx="24" cy="24" r="18" stroke="#0b7b7b" strokeWidth="2.5"/>
            <path d="M24 16v8M24 30v2" stroke="#0b7b7b" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <p className={s.emptyTitle}>No quiz attempts found</p>
          <span className={s.emptySub}>
            {selectedChapter
              ? 'No quizzes attempted for the selected chapter yet.'
              : `No quizzes attempted for "${activeCourse?.title || 'this course'}" yet.`}
          </span>
        </div>
      )}

      {/* ── Results ── */}
      {selectedCourse && !loadingResults && latestAttempt && (() => {
        const att        = latestAttempt;
        const score      = Number(att.totalScore || 0);
        const passed     = att.passed === true;
        const topicTitle = att.topicId?.title || att.topicTitle || 'Quiz';
        const chTitle    = att.chapterId?.title || '';
        const label      = chTitle ? `${chTitle} — ${topicTitle}` : topicTitle;
        const answers    = Array.isArray(att.answers) ? att.answers : [];

        return (
          <>
            {/* Attempt count banner when multiple */}
            {attempts.length > 1 && (
              <div className={s.attemptsBanner}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                </svg>
                Showing latest of {attempts.length} attempt{attempts.length > 1 ? 's' : ''}
                {selectedChapter ? ' for this chapter' : ' for this course'}
              </div>
            )}

            {/* Result card */}
            <div className={s.resultCard}>
              <div className={s.resultTopBar}>
                <h2 className={s.resultTitle}>Quiz Result</h2>
                <span className={`${s.resultBadge} ${passed ? s.badgePassed : s.badgeFailed}`}>
                  {passed ? `Passed — ${score}%` : `Failed — ${score}%`}
                </span>
              </div>

              <div className={s.resultBody}>
                <ResultCircle passed={passed}/>
                <h3 className={`${s.outcomeText} ${passed ? s.outcomePassed : s.outcomeFailed}`}>
                  {passed ? 'Quiz Passed!' : 'Quiz Failed'}
                </h3>
                <p className={s.chapterLabel}>{label}</p>
                <p className={s.attemptDate}>{fmtDate(att.createdAt)} · {fmtTimeOfDay(att.createdAt)}</p>

                <div className={s.statsRow}>
                  <div className={s.stat}>
                    <span className={s.statVal}>{score}%</span>
                    <span className={s.statLbl}>Final Score</span>
                  </div>
                  <div className={s.statDivider}/>
                  <div className={s.stat}>
                    <span className={s.statVal}>
                      {answers.filter(a => a.status === 'answered').length}/{answers.length}
                    </span>
                    <span className={s.statLbl}>Answered</span>
                  </div>
                  <div className={s.statDivider}/>
                  <div className={s.stat}>
                    <span className={s.statVal} style={{ color: passed ? '#16a34a' : '#dc2626' }}>
                      {passed ? 'Pass' : 'Fail'}
                    </span>
                    <span className={s.statLbl}>Status</span>
                  </div>
                </div>

                {/* The attempt stores the quiz's own pass mark (default 20%) */}
                <p className={s.threshold}>Pass mark: {att.passingGrade ?? DEFAULT_PASSING_GRADE}%</p>
              </div>
            </div>

            {/* Question breakdown */}
            {answers.length > 0 && (
              <div className={s.breakdownCard}>
                <p className={s.breakdownMeta}>Detailed Breakdown</p>
                <h3 className={s.breakdownTitle}>Question Answers</h3>

                <div className={s.qGrid}>
                {answers.map((a, i) => {
                  const aiScore  = Number(a.aiScore || 0);
                  const maxScore = Number(a.maxScore || 0);
                  const pct      = maxScore > 0 ? Math.round((aiScore / maxScore) * 100) : 0;
                  const skipped  = a.status === 'skipped';
                  const isWeak   = !skipped && pct < 60;

                  return (
                    <div key={i} className={`${s.qRow} ${isWeak || skipped ? s.qRowWrong : ''}`}>
                      <div className={s.qIcon}>
                        {skipped ? (
                          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
                          </svg>
                        ) : isWeak ? (
                          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        )}
                      </div>
                      <div className={s.qContent}>
                        <span className={s.qText}>Q{i + 1} — {a.questionText || 'Question'}</span>
                        {!skipped && a.userAnswer && (
                          <span className={s.qAnswer}>{a.userAnswer}</span>
                        )}
                        {skipped && <span className={s.qSkipped}>Skipped</span>}
                        {a.aiFeedback && <span className={s.qFeedback}>{a.aiFeedback}</span>}
                      </div>
                      <span className={`${s.scoreBadge} ${isWeak || skipped ? s.scoreBadgeWrong : s.scoreBadgeOk}`}>
                        {skipped ? '—' : `${aiScore}/${maxScore}`}
                      </span>
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            {/* Bottom action */}
            <div className={s.bottomBar}>
              {passed
                ? <button className={s.bonusBtn}>+ View Bonus Content</button>
                : <button className={s.failPolicyBtn}>Fail Policy</button>
              }
            </div>
          </>
        );
      })()}
    </div>
  );
}
