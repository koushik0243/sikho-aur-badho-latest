'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import s from './QuizResult.module.css';
import QuizResultReport from './QuizResultReport';

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

function toArr(res) {
  if (Array.isArray(res))             return res;
  if (Array.isArray(res?.data))       return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data?.list)) return res.data.list;
  if (Array.isArray(res?.list))       return res.list;
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

function fmtDateTime(d) {
  if (!d) return '—';
  return `${fmtDate(d)}, ${fmtTimeOfDay(d)}`;
}

// Number each quiz's attempts oldest-first (1st, 2nd, …) and return them
// newest-first for the dropdown.
function numberAttempts(list) {
  const byTime = [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const counters = {};
  const numbered = byTime.map(a => {
    const tid = String(a.topicId?._id || a.topicId || '');
    counters[tid] = (counters[tid] || 0) + 1;
    return { ...a, attemptNo: counters[tid] };
  });
  return numbered.reverse();
}

const ChevronIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

/**
 * Quiz review: pick a learner, course, chapter and attempt.
 * Store owner: their own organization. Super admin passes `orgId` for any organization.
 * @param {{ orgId?: string, orgName?: string }} props
 */
export default function QuizResult({ orgId: orgIdProp = '', orgName = '' } = {}) {
  const router = useRouter();
  const user = useSelector(selectUser);

  const [orgId, setOrgId] = useState(null);
  const [learners, setLearners] = useState([]);
  const [coursesForDrop, setCoursesForDrop] = useState([]);
  const [chapters, setChapters] = useState([]);

  const [selectedLearner, setSelectedLearner] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);

  const [attempts, setAttempts] = useState([]); // this learner's attempts for the chapter, newest first
  const [selectedAttemptId, setSelectedAttemptId] = useState('');
  const [questionBank, setQuestionBank] = useState([]);
  const [searched, setSearched] = useState(false);

  // ── Resolve org, learners, org courses ──────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingBase(true);
      try {
        let resolvedOrgId = orgIdProp ? String(orgIdProp) : (user?.orgId ? String(user.orgId) : null);
        if (!resolvedOrgId) {
          const uid = user?._id || user?.id;
          if (uid) {
            const r = await apiServiceHandler('GET', `user/admin/edit/${uid}`).catch(() => null);
            const rec = r?.data ?? r;
            resolvedOrgId = rec?.orgId ? String(rec.orgId) : null;
          }
        }
        if (!resolvedOrgId) return;
        if (cancelled) return;
        setOrgId(resolvedOrgId);

        const learnerRes = await apiServiceHandler('GET', `user/admin/list?orgId=${resolvedOrgId}&user_type=employee&orgRole=employee`).catch(() => null);
        if (cancelled) return;
        setLearners(toArr(learnerRes));
      } finally {
        if (!cancelled) setLoadingBase(false);
      }
    }
    if (user) load();
    return () => { cancelled = true; };
  }, [user?._id, orgIdProp]);

// ── Courses: only the selected learner's own courses (none until a learner is picked) ──
  useEffect(() => {
    if (!selectedLearner) return undefined;
    let cancelled = false;
    apiServiceHandler('GET', `course-assignment/list?userId=${selectedLearner}&t=${Date.now()}`)
      .then(res => {
        if (cancelled) return;
        const seen = new Map();
        toArr(res).forEach(a => {
          const c = a.courseId;
          if (c?._id && !seen.has(String(c._id))) seen.set(String(c._id), { _id: String(c._id), title: c.title || 'Untitled' });
        });
        setCoursesForDrop([...seen.values()].sort((x, y) => x.title.localeCompare(y.title)));
      })
      .catch(() => { if (!cancelled) setCoursesForDrop([]); });
    return () => { cancelled = true; };
  }, [selectedLearner]);

  // ── Chapters for selected course ────────────────────────────
  useEffect(() => {
    if (!selectedCourse) { setChapters([]); setSelectedChapter(''); return; }
    let cancelled = false;
    setLoadingChapters(true);
    setChapters([]);
    setSelectedChapter('');
    async function loadChapters() {
      try {
        // Only chapters that contain a quiz. Each keeps its number in the whole course (n),
        // so "Ch 4" stays Ch 4 even when earlier chapters without a quiz are hidden.
        const [chRes, topicRes] = await Promise.all([
          apiServiceHandler('GET', `chapter/list?courseId=${selectedCourse}`).catch(() => null),
          apiServiceHandler('GET', `topic/list?courseId=${selectedCourse}`).catch(() => null),
        ]);
        const withQuiz = new Set(toArr(topicRes)
          .filter(t => String(t?.video_type || '').toLowerCase() === 'quiz' && !t.deletedAt)
          .map(t => String(t.chapterId)));
        if (!cancelled) setChapters(toArr(chRes).map((ch, i) => ({ ...ch, n: i + 1 })).filter(ch => withQuiz.has(String(ch._id))));
      } finally {
        if (!cancelled) setLoadingChapters(false);
      }
    }
    loadChapters();
    return () => { cancelled = true; };
  }, [selectedCourse]);

  // ── Attempt + question bank for learner / course / chapter ──
  useEffect(() => {
    if (!selectedLearner || !selectedCourse || !selectedChapter) {
      setAttempts([]);
      setSelectedAttemptId('');
      setQuestionBank([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    setLoadingResult(true);
    setSearched(true);
    async function loadResult() {
      try {
        // Timestamp defeats apiServiceHandler's 60s GET cache so new attempts show up.
        const res = await apiServiceHandler('GET', `quiz-attempt/course-all?courseId=${selectedCourse}&t=${Date.now()}`).catch(() => null);
        if (cancelled) return;
        const all = toArr(res);
        const matches = all.filter(a => {
          const uid = String(a.userId?._id || a.userId || '');
          if (uid !== selectedLearner) return false;
          const cid = String(a.chapterId?._id || a.chapterId || '');
          if (cid !== selectedChapter) return false;
          return true;
        });
        const numbered = numberAttempts(matches);
        setAttempts(numbered);
        setSelectedAttemptId(numbered[0] ? String(numbered[0]._id) : '');
      } finally {
        if (!cancelled) setLoadingResult(false);
      }
    }
    loadResult();
    return () => { cancelled = true; };
  }, [selectedLearner, selectedCourse, selectedChapter]);

  const attempt = attempts.find(a => String(a._id) === selectedAttemptId) || null;
  const attemptTopicId = attempt ? String(attempt.topicId?._id || attempt.topicId || '') : '';
  const attemptsForTopic = attempt
    ? attempts.filter(a => String(a.topicId?._id || a.topicId || '') === attemptTopicId).length
    : 0;
  // The chapter may hold more than one quiz — then the dropdown names the quiz too.
  const multipleQuizzes = new Set(attempts.map(a => String(a.topicId?._id || a.topicId || ''))).size > 1;

  // ── Question bank (reference answers) for the selected attempt's quiz ──
  useEffect(() => {
    if (!attemptTopicId) { setQuestionBank([]); return; }
    let cancelled = false;
    apiServiceHandler('GET', `quiz-questions/list?quizId=${attemptTopicId}`)
      .then(res => { if (!cancelled) setQuestionBank(toArr(res)); })
      .catch(() => { if (!cancelled) setQuestionBank([]); });
    return () => { cancelled = true; };
  }, [attemptTopicId]);

  const activeCourse = coursesForDrop.find(c => c._id === selectedCourse);
  const activeLearner = learners.find(l => String(l._id) === selectedLearner);
  const learnerName = activeLearner
    ? (activeLearner.name || activeLearner.fullName || `${activeLearner.firstName || ''} ${activeLearner.lastName || ''}`.trim() || 'Learner')
    : '';

  const answers = attempt && Array.isArray(attempt.answers) ? attempt.answers : [];
  const questionMap = {};
  questionBank.forEach(q => { questionMap[String(q._id)] = q; });

  const topicTitle = attempt?.topicId?.title || '';
  const chapterTitle = attempt?.chapterId?.title || '';
  const label = chapterTitle ? `${chapterTitle} — ${topicTitle}` : topicTitle;

  return (
    <div className={s.page}>

      <button className={s.backBtn} onClick={() => router.back()}>
        {BackArrow} Back
      </button>

      {/* ── Filter bar ── */}
      <div className={s.filterCard}>
        <p className={s.filterMeta}>Quiz Review</p>
        <h2 className={s.filterTitle}>Quiz Result{orgName ? ` — ${orgName}` : ''}</h2>
        <div className={s.filterRow}>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Learner</label>
            <div className={s.selectWrap}>
              <select
                className={s.select}
                value={selectedLearner}
                onChange={e => { setSelectedLearner(e.target.value); setSelectedCourse(''); setCoursesForDrop([]); }}
                disabled={loadingBase}
              >
                <option value="">
                  {loadingBase ? 'Loading learners…' : '— Select a learner —'}
                </option>
                {learners.map(l => {
                  const uid = String(l._id || '');
                  const name = l.name || l.fullName || `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Learner';
                  return <option key={uid} value={uid}>{name}</option>;
                })}
              </select>
              <span className={s.selectArrow}>{ChevronIcon}</span>
            </div>
          </div>

          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Course</label>
            <div className={s.selectWrap}>
              <select
                className={s.select}
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                disabled={!selectedLearner}
              >
                <option value="">
                  {!selectedLearner ? '— Select a learner first —' : coursesForDrop.length ? '— Select a course —' : 'No courses assigned'}
                </option>
                {coursesForDrop.map(c => (
                  <option key={c._id} value={c._id}>{c.title}</option>
                ))}
              </select>
              <span className={s.selectArrow}>{ChevronIcon}</span>
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
                  {loadingChapters ? 'Loading chapters…' : !selectedCourse || chapters.length ? '— Select a chapter —' : 'No chapter with a quiz'}
                </option>
                {chapters.map(ch => (
                  <option key={String(ch._id)} value={String(ch._id)}>
                    Ch {ch.n} – {ch.title || `Chapter ${ch.n}`}
                  </option>
                ))}
              </select>
              <span className={s.selectArrow}>{ChevronIcon}</span>
            </div>
          </div>

          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Attempt</label>
            <div className={s.selectWrap}>
              <select
                className={s.select}
                value={selectedAttemptId}
                onChange={e => setSelectedAttemptId(e.target.value)}
                disabled={!selectedChapter || !selectedLearner || loadingResult || attempts.length === 0}
              >
                {attempts.length === 0 && (
                  <option value="">
                    {loadingResult ? 'Loading attempts…' : selectedChapter && selectedLearner ? 'No attempts' : '— Select an attempt —'}
                  </option>
                )}
                {attempts.map(a => (
                  <option key={String(a._id)} value={String(a._id)}>
                    Attempt {a.attemptNo} – {fmtDateTime(a.createdAt)}
                    {multipleQuizzes && a.topicId?.title ? ` (${a.topicId.title})` : ''}
                    {a.passed ? ' · Passed' : ' · Failed'}
                  </option>
                ))}
              </select>
              <span className={s.selectArrow}>{ChevronIcon}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Prompt state ── */}
      {(!selectedLearner || !selectedCourse || !selectedChapter) && (
        <div className={s.emptyWrap}>
          <svg viewBox="0 0 48 48" fill="none" width="52" height="52" style={{ opacity: 0.25 }}>
            <rect x="6" y="8" width="36" height="32" rx="4" stroke="#0b7b7b" strokeWidth="2.5" />
            <path d="M14 18h20M14 24h14M14 30h10" stroke="#0b7b7b" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p className={s.emptyTitle}>Select a learner, course and chapter to view quiz results</p>
          <span className={s.emptySub}>Choose a learner, a course and a chapter from the filters above.</span>
        </div>
      )}

      {/* ── Loading ── */}
      {selectedLearner && selectedCourse && selectedChapter && loadingResult && (
        <div className={s.loadingWrap}><div className={s.spinner} /></div>
      )}

      {/* ── No attempts found ── */}
      {selectedLearner && selectedCourse && selectedChapter && !loadingResult && searched && !attempt && (
        <div className={s.emptyWrap}>
          <svg viewBox="0 0 48 48" fill="none" width="52" height="52" style={{ opacity: 0.25 }}>
            <circle cx="24" cy="24" r="18" stroke="#0b7b7b" strokeWidth="2.5" />
            <path d="M24 16v8M24 30v2" stroke="#0b7b7b" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p className={s.emptyTitle}>No quiz attempts found</p>
          <span className={s.emptySub}>
            {learnerName || 'This learner'} has not attempted any quiz for the selected chapter yet.
          </span>
        </div>
      )}

      {/* ── Result ── */}
      {selectedLearner && selectedCourse && selectedChapter && !loadingResult && attempt && (
        <>
          <QuizResultReport
            attempt={attempt}
            answers={answers}
            questionMap={questionMap}
            learnerName={learnerName}
            quizLabel={label || activeCourse?.title || ''}
            attemptNo={attempt.attemptNo}
            attemptsForTopic={attemptsForTopic}
          />
        </>
      )}
    </div>
  );
}
