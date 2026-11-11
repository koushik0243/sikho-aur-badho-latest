'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectUser, selectAuthReady } from '../../../redux/slices/authSlice';
import apiServiceHandler, { clearGetCache } from '../../../service/apiService';
import pageStyles from "./AptitudeResults.module.css";
import { withLearnerKit } from '../../../Components/Learner/LearnerKit/LearnerKit';

// Page styles + the shared learner page look.
const s = withLearnerKit(pageStyles);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

function toArr(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

const CheckIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const XIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
  </svg>
);

const QuoteIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
    <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
  </svg>
);

const BreakdownIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <path fillRule="evenodd" d="M2 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 002 2H4a2 2 0 01-2-2V4zm3 1h6a1 1 0 010 2H5a1 1 0 010-2zm0 3h6a1 1 0 010 2H5a1 1 0 010-2zm0 3h4a1 1 0 010 2H5a1 1 0 010-2z" clipRule="evenodd" />
    <path d="M12 2h2a2 2 0 012 2v13.5a1.5 1.5 0 01-3 0V4a2 2 0 00-1-1.732z" />
  </svg>
);

function LevelIcon(level) {
  if (level === 'expert') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" width="24" height="24">
        <path d="M10 2l2.163 4.279 4.725.687-3.419 3.331.807 4.703L10 12.75l-4.276 2.25.807-4.703-3.419-3.331 4.725-.687L10 2z" />
      </svg>
    );
  }
  if (level === 'intermediate') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" width="24" height="24">
        <path fillRule="evenodd" d="M3 13a1 1 0 011-1h1a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zM8 9a1 1 0 011-1h1a1 1 0 011 1v8a1 1 0 01-1 1H9a1 1 0 01-1-1V9zM13 5a1 1 0 011-1h1a1 1 0 011 1v12a1 1 0 01-1 1h-1a1 1 0 01-1-1V5z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="24" height="24">
      <path fillRule="evenodd" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.446a1 1 0 00-.363 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.367-2.445a1 1 0 00-1.176 0l-3.367 2.445c-.784.57-1.838-.196-1.539-1.118l1.286-3.957a1 1 0 00-.363-1.118L2.826 9.385c-.783-.57-.38-1.81.588-1.81h4.163a1 1 0 00.95-.69l1.286-3.958z" clipRule="evenodd" />
    </svg>
  );
}

export default function AptitudeResultsPage() {
  const router = useRouter();
  const user = useSelector(selectUser);
  const authReady = useSelector(selectAuthReady);
  const userId = user ? String(user._id || user.id || '') : '';

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [attempts, setAttempts] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  // Load courses assigned to this learner
  useEffect(() => {
    clearGetCache();
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
        const all = toArr(allRes);

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
        // Open on the first course with an aptitude test taken (else the first course), so the page shows results straight away.
        const prog = await apiServiceHandler('GET', `my-report/progress?t=${Date.now()}`).catch(() => null);
        if (cancelled) return;
        const withResults = new Set((prog?.data?.courses || []).filter(c => c.phases?.aptitude?.score != null).map(c => String(c.courseId)));
        const pick = list.find(c => withResults.has(String(c._id))) || list[0];
        if (pick?._id) setSelectedCourse(prev => prev || String(pick._id));
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    }
    loadCourses();
    return () => { cancelled = true; };
  }, [userId, authReady]);

  // Load aptitude attempts when the selected course changes
  useEffect(() => {
    if (!selectedCourse) { setAttempts([]); return; }
    let cancelled = false;
    setLoadingResults(true);
    apiServiceHandler('GET', `aptitude-attempt/list?courseId=${selectedCourse}`)
      .then(res => { if (!cancelled) setAttempts(toArr(res)); })
      .catch(() => { if (!cancelled) setAttempts([]); })
      .finally(() => { if (!cancelled) setLoadingResults(false); });
    return () => { cancelled = true; };
  }, [selectedCourse]);

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
        <div className={s.filterLeft}>
          <p className={s.filterMeta}>My Progress</p>
          <h2 className={s.filterTitle}>Aptitude Results</h2>
        </div>
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
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      {/* ── No course selected ── */}
      {!selectedCourse && (
        <div className={s.emptyWrap}>
          <svg viewBox="0 0 48 48" fill="none" width="52" height="52" style={{ opacity: 0.25 }}>
            <rect x="6" y="8" width="36" height="32" rx="4" stroke="#0b7b7b" strokeWidth="2.5" />
            <path d="M14 18h20M14 24h14M14 30h10" stroke="#0b7b7b" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p className={s.emptyTitle}>Select a course to view your aptitude test result</p>
          <span className={s.emptySub}>Choose a course from the dropdown above.</span>
        </div>
      )}

      {/* ── Loading results ── */}
      {selectedCourse && loadingResults && (
        <div className={s.loadingWrap}><div className={s.spinner} /></div>
      )}

      {/* ── No attempts found ── */}
      {selectedCourse && !loadingResults && attempts.length === 0 && (
        <div className={s.emptyWrap}>
          <svg viewBox="0 0 48 48" fill="none" width="52" height="52" style={{ opacity: 0.25 }}>
            <circle cx="24" cy="24" r="18" stroke="#0b7b7b" strokeWidth="2.5" />
            <path d="M24 16v8M24 30v2" stroke="#0b7b7b" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p className={s.emptyTitle}>No aptitude test taken yet</p>
          <span className={s.emptySub}>
            No aptitude test attempt found for &quot;{activeCourse?.title || 'this course'}&quot;.
          </span>
        </div>
      )}

      {/* ── Result ── */}
      {selectedCourse && !loadingResults && latestAttempt && (() => {
        const att = latestAttempt;
        const score = Number(att.totalScore || 0);
        const level = att.level || 'beginner';
        const evaluated = Array.isArray(att.answers) ? att.answers : [];
        const correctCount = evaluated.filter(a => a.status !== 'skipped' && a.maxScore > 0 && (a.aiScore / a.maxScore) * 100 >= 60).length;
        const skippedCount = evaluated.filter(a => a.status === 'skipped').length;
        const wrongCount = Math.max(0, evaluated.length - correctCount - skippedCount);

        return (
          <>
            {attempts.length > 1 && (
              <div className={s.attemptsBanner}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Showing latest of {attempts.length} attempt{attempts.length > 1 ? 's' : ''} for this course
              </div>
            )}

            <div className={`${s.resultCard} ${s[`resultCard_${level}`]}`}>
              <div className={s.resultLeft}>
                <span className={`${s.resultLevelIcon} ${s[`level_${level}`]}`}>{LevelIcon(level)}</span>
                <div>
                  <h2 className={s.resultTitle}>Aptitude Test Result</h2>
                  <p className={s.resultCourse}>{activeCourse?.title || 'Course'}</p>
                  <p className={s.attemptDate}>{fmtDate(att.createdAt)}</p>
                </div>
              </div>

              <div className={s.resultDivider} />

              <div className={s.resultMiddle}>
                <div className={`${s.scoreCircle} ${s[`scoreCircle_${level}`]}`}>
                  <span className={s.scoreNum}>{score}</span>
                  <span className={s.scoreOutOf}>/ 100</span>
                </div>
                <span className={`${s.levelBadge} ${s[`level_${level}`]}`}>{LEVEL_LABEL[level] || level}</span>
              </div>

              <div className={s.resultDivider} />

              <div className={s.resultRight}>
                <div className={s.statsCol}>
                  <div className={s.stat}>
                    <span className={s.statVal}>{correctCount}/{evaluated.length}</span>
                    <span className={s.statLbl}>Correct</span>
                  </div>
                  <div className={s.stat}>
                    <span className={s.statVal}>{skippedCount}</span>
                    <span className={s.statLbl}>Skipped</span>
                  </div>
                </div>
              </div>
            </div>

            {evaluated.length > 0 && (
              <div className={s.breakdownCard}>
                <div className={s.breakdownHead}>
                  <span className={s.breakdownIcon}>{BreakdownIcon}</span>
                  <div>
                    <h3 className={s.breakdownTitle}>Question Answers</h3>
                    <p className={s.breakdownSub}>{correctCount} correct · {wrongCount} incorrect · {skippedCount} skipped</p>
                  </div>
                </div>

                <div className={s.qGrid}>
                  {evaluated.map((a, i) => {
                    const skipped = a.status === 'skipped';
                    const pct = a.maxScore > 0 ? Math.round((a.aiScore / a.maxScore) * 100) : 0;
                    const isCorrect = !skipped && pct >= 60;

                    return (
                      <div key={i} className={`${s.qCard} ${isCorrect ? s.qCardOk : s.qCardWeak}`}>
                        <div className={s.qCardHead}>
                          <span className={`${s.qIconCircle} ${isCorrect ? s.qIconOk : s.qIconWrong}`}>
                            {isCorrect ? CheckIcon : XIcon}
                          </span>
                          <span className={s.qText}>Q{i + 1} — {a.questionText || 'Question'}</span>
                          <span className={`${s.qScorePill} ${isCorrect ? s.qScorePillOk : s.qScorePillWrong}`}>
                            {skipped ? 'Skipped' : `${pct}%`}
                          </span>
                        </div>
                        <div className={s.qAnswers}>
                          <div className={s.qAnswerBlock}>
                            <span className={s.qAnswerLabel}>Expected Answer</span>
                            <p className={s.qAnswerText}>{a.originalAnswer || <em>Not available</em>}</p>
                          </div>
                          <div className={s.qAnswerBlock}>
                            <span className={s.qAnswerLabel}>Your Answer</span>
                            {skipped ? (
                              <p className={s.qSkipped}>No answer provided.</p>
                            ) : (
                              <p className={s.qAnswerText}>{a.userAnswer || <em>No speech recorded.</em>}</p>
                            )}
                          </div>
                        </div>
                        {a.aiFeedback && (
                          <p className={s.qFeedback}>{QuoteIcon} {a.aiFeedback}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
