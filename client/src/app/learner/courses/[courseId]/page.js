'use client';
import { useState, useEffect, useRef, use } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { selectUser } from '../../../../redux/slices/authSlice';
import apiServiceHandler, { clearGetCache } from '../../../../service/apiService';
import { COURSE_DELETED_NOTE, isCourseDeletedError } from '../../../../lib/courseAvailability';
import { toast } from 'sonner';
import { API_URL } from '../../../../lib/constant';
import { useMediaToken, getMediaToken, secureMediaUrl } from '../../../../lib/mediaToken';
import useVoiceAnswer from '../../../../hooks/useVoiceAnswer';
import { normalizeQuizSettings } from '../../../../Components/Learner/quizSettings';
import { fetchCourseCompletion, recordCourseCompletion, completedChapterIdSet } from '../../../../Components/Learner/courseCompletion';
import {
  unansweredIndexes, nextUnansweredCycling, prevUnansweredCycling, answersForTimeUp,
} from '../../../../Components/Learner/QuestionFlow';
import { uploadAssignmentVideo, checkSubmissionFile, formatBytes, formatDayDate, videoComments, loadSubmissionVideo, pauseOtherVideos, SUBMISSION_ACCEPT, SUBMISSION_UPLOAD_NOTE, videoLimitOf } from '../../../../lib/assignmentSubmission';
import s from "./CourseView.module.css";

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = {
  star:     <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>,
  users:    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>,
  clock:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>,
  calendar: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>,
  play:     <svg viewBox="0 0 20 20" fill="currentColor"><path width="24" height="24"d="M8 5L19 12L8 19V5Z" /></svg>,
  pause:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>,
  playFill: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>,
  rewind:   <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>,
  forward:  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>,
  thumbUp:  <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/></svg>,
  thumbDn:  <svg viewBox="0 0 20 20" fill="currentColor"><path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z"/></svg>,
  lock:     <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>,
  check:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>,
  chevDown: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>,
  mic:      <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/></svg>,
  send:     <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>,
  camera:   <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/></svg>,
  clipCheck:<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>,
  fileDown: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>,
  expand:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/></svg>,
  compress: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3"/></svg>,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function toArr(res) {
  if (Array.isArray(res))                return res;
  if (Array.isArray(res?.data))          return res.data;
  if (Array.isArray(res?.data?.data))    return res.data.data;
  if (Array.isArray(res?.data?.list))    return res.data.list;
  if (Array.isArray(res?.list))          return res.list;
  if (Array.isArray(res?.result))        return res.result;
  return [];
}

function fmtDur(hr, min, sec) {
  const h = Number(hr || 0), m = Number(min || 0), sc = Number(sec || 0);
  if (h > 0) return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
  if (m > 0) return `${m}:${String(sc).padStart(2, '0')} min`;
  if (sc > 0) return `${sc}s`;
  return null;
}
function fmtSecs(secs) {
  if (!secs || isNaN(secs) || secs <= 0) return null;
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  if (m > 0) return `${m}:${String(s).padStart(2, '0')} min`;
  return `${s}s`;
}
// ── Quiz / video activity locks ───────────────────────────────────────────────
// Quizzes and lesson videos are mutually exclusive for a learner's course in
// every tab and device, and the latest activity wins: starting a quiz rewinds
// a lesson video left part-watched elsewhere, and playing a lesson video
// cancels a quiz in progress elsewhere. A quiz can't be started while a lesson
// video is actually playing. The active tab holds a server-side lock with a
// heartbeat; other tabs poll it, and tabs in the same browser are also told
// instantly over a BroadcastChannel.
const QUIZ_LOCK_HEARTBEAT_MS = 15000;
const QUIZ_LOCK_POLL_MS      = 10000;
const QUIZ_LOCK_CHANNEL      = 'lms-quiz-lock';

// Identifies this tab, so it can tell its own locks from another tab's.
const TAB_ID = (() => {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
})();

// kind: 'quiz' | 'video'
function broadcastLock(kind, courseId, active) {
  try {
    const ch = new BroadcastChannel(QUIZ_LOCK_CHANNEL);
    ch.postMessage({ kind, courseId: String(courseId), active, ownerId: TAB_ID });
    ch.close();
  } catch { /* BroadcastChannel unsupported — the server poll still covers it */ }
}

// Whether a quiz / a lesson video is active for this course in some OTHER tab.
async function fetchCourseLocks(courseId) {
  // Timestamp defeats apiServiceHandler's 60s GET cache — this must be live.
  const res  = await apiServiceHandler('GET', `quiz-attempt/lock?courseId=${courseId}&t=${Date.now()}`);
  const data = res?.data ?? res ?? {};
  const isOthers = (lock) => !!lock?.active && lock.ownerId !== TAB_ID;
  return { quiz: isOthers(data.quiz ?? data), video: isOthers(data.video) };
}

function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
}
function timeAgo(d) {
  if (!d) return 'Recently';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const w = Math.floor(days / 7);
  return w < 5 ? `${w} week${w > 1 ? 's' : ''} ago` : new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ── VideoPlayer ───────────────────────────────────────────────────────────────
// Watermark position cycle: the learner's name + email drift between these spots
// so a screen recording is always traceable to the account.
const WATERMARK_SPOTS = [
  { top: '12%', left: '8%' }, { top: '70%', left: '55%' }, { top: '35%', left: '62%' },
  { top: '78%', left: '10%' }, { top: '18%', left: '48%' }, { top: '52%', left: '25%' },
];
const WATERMARK_MOVE_MS = 6000;

function VideoPlayer({ videoSrc, imgSrc, isPlaying, onToggle, onPlayStateChange, topicId, courseId, savedPosition, onProgress, onDurationLoad, isCompleted, serverPct, onVideoEnded, playCommand, courseCompleted, resetSignal = 0, watermark = '', onSourceError }) {
  const videoRef      = useRef(null);
  const containerRef  = useRef(null);
  const lastSavedRef  = useRef(0);
  const maxReachedRef = useRef(0); // furthest second ever reached this session
  const [paused,   setPaused]   = useState(true);
  const [timeNow,  setTimeNow]  = useState(0);
  const [dur,      setDur]      = useState(0);
  const [speed,    setSpeed]    = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [obscured, setObscured] = useState(false); // tab/window lost focus — video paused & blanked
  const [wmSpot, setWmSpot] = useState(0);

  // Recording deterrent: pause and blank the video whenever this tab or window
  // loses focus (another app, tab, recorder or dev tools takes it).
  useEffect(() => {
    function hide() {
      videoRef.current?.pause();
      setObscured(true);
    }
    function onVisibility() { if (document.hidden) hide(); }
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!watermark) return;
    const t = setInterval(() => setWmSpot(i => (i + 1) % WATERMARK_SPOTS.length), WATERMARK_MOVE_MS);
    return () => clearInterval(t);
  }, [watermark]);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  }

  // Unmounting (e.g. moving on to a quiz) stops playback — tell the page so it
  // releases the video lock.
  useEffect(() => () => onPlayStateChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  // When topic changes: restore saved position and reset session tracking
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const pos = savedPosition || 0;
    maxReachedRef.current = pos;   // set BEFORE currentTime so handleSeeking doesn't block it
    v.currentTime = pos;
    setTimeNow(pos);
    setPaused(true);
    onPlayStateChange?.(false);
  }, [topicId]);

  // Play requests from the sidebar's play icon. Declared after the topic-change
  // effect so a newly selected lesson restores its saved position before playing.
  useEffect(() => {
    if (!playCommand?.n || playCommand.topicId !== topicId) return;
    if (Date.now() - (playCommand.at || 0) > 2000) return; // stale request replayed on remount
    const v = videoRef.current;
    if (!v) return;
    if (playCommand.toggle && !v.paused) v.pause();
    else v.play()?.catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playCommand?.n]);

  function saveProgress(v) {
    if (!topicId || !courseId || !v.duration) return;
    onProgress?.({ topicId, courseId, watchedSeconds: Math.floor(v.currentTime), durationSeconds: Math.floor(v.duration), lastPosition: Math.floor(v.currentTime) });
    lastSavedRef.current = Date.now();
  }

  function handleTimeUpdate(e) {
    const v  = e.target;
    const ct = v.currentTime;
    if (ct > maxReachedRef.current) maxReachedRef.current = ct;
    setTimeNow(ct);
    if (Date.now() - lastSavedRef.current >= 10000) saveProgress(v);
  }

  // Block forward-seeks: user cannot skip to unseen parts
  function handleSeeking(e) {
    const v = e.target;
    if (v.currentTime > maxReachedRef.current + 0.5) {
      v.currentTime = maxReachedRef.current;
    }
  }

  function handleEnded(e) {
    const v = e.target;
    if (!topicId || !courseId || !v.duration) return;
    const d = Math.floor(v.duration);
    onProgress?.({ topicId, courseId, watchedSeconds: d, durationSeconds: d, lastPosition: 0 });
    maxReachedRef.current = d;
    setPaused(true);
    onPlayStateChange?.(false);
    if (document.fullscreenElement) document.exitFullscreen?.();
    onVideoEnded?.();
  }

  function handleLoadedMetadata(e) {
    const d = e.target.duration || 0;
    setDur(d);
    if (d > 0) onDurationLoad?.(topicId, d);
  }
  function handlePlay() { setPaused(false); onPlayStateChange?.(true); }
  function handlePause() { setPaused(true); onPlayStateChange?.(false); }

  // A quiz was started in another tab/device — the latest activity wins, so
  // this viewing is abandoned: stop and go back to the start (watch % → 0).
  // Lesson completion and best-watched progress are kept.
  useEffect(() => {
    if (!resetSignal) return;
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setTimeNow(0);
    if (topicId && courseId && v.duration) {
      onProgress?.({ topicId, courseId, watchedSeconds: 0, durationSeconds: Math.floor(v.duration), lastPosition: 0 });
      lastSavedRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.play(); else v.pause();
  }

  function handleRewatch() {
    const v = videoRef.current;
    if (!v) return;
    maxReachedRef.current = 0;
    v.currentTime = 0;
    setTimeNow(0);
    v.play();
  }

  const SPEEDS = [1, 1.25, 1.5, 2];
  function cycleSpeed() {
    const v = videoRef.current;
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (v) v.playbackRate = next;
  }

  // Rewind is always safe; forward is clamped to the furthest-watched point
  // so users still can't skip ahead of unseen content.
  function seekRelative(delta) {
    const v = videoRef.current;
    if (!v) return;
    const cap = delta > 0 ? maxReachedRef.current : v.duration || 0;
    const target = Math.max(0, Math.min(v.currentTime + delta, cap));
    v.currentTime = target;
    setTimeNow(target);
  }

  // Clicking the progress track seeks within the already-watched region only
  function handleProgressClick(e) {
    const v = videoRef.current;
    if (!v || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = pct * dur;
    if (target <= maxReachedRef.current + 0.5) {
      v.currentTime = target;
      setTimeNow(target);
    }
  }

  function fmtT(s) {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  // A completed course (certificate earned) is read-only and always shows the
  // lesson fully watched, with the cursor parked at the end of the bar.
  // localPct: real-time playback position bar
  const localPct   = courseCompleted ? 100
    : dur > 0 ? Math.min(100, Math.round((timeNow / dur) * 100)) : 0;
  // displayPct: best-ever watched % (server-persisted, shown as badge)
  const displayPct = courseCompleted ? 100
    : serverPct > 0 ? serverPct : Math.min(100, dur > 0 ? Math.round((maxReachedRef.current / dur) * 100) : 0);
  // Show Re-watch when video is server-completed and currently paused at start
  const showRewatch = !courseCompleted && isCompleted && paused && timeNow < 1;
  // Re-watching a completed lesson: show how far through this viewing is.
  const isRewatching = !courseCompleted && isCompleted && timeNow >= 1;

  if (videoSrc) {
    return (
      <div ref={containerRef} className={s.videoPlayerRoot}>
        <div className={s.videoWrap}>
          <video
            ref={videoRef}
            key={videoSrc}
            src={videoSrc}
            className={s.videoElement}
            onTimeUpdate={handleTimeUpdate}
            onSeeking={handleSeeking}
            onEnded={handleEnded}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handlePlay}
            onPause={handlePause}
            onClick={togglePlay}
            onError={() => onSourceError?.()}
            onContextMenu={e => e.preventDefault()}
            onDragStart={e => e.preventDefault()}
            draggable={false}
            controlsList="nodownload noremoteplayback noplaybackrate"
            disablePictureInPicture
            disableRemotePlayback
            playsInline
          />

          {watermark && (
            <div className={s.videoWatermark} style={WATERMARK_SPOTS[wmSpot]} aria-hidden="true">
              {watermark}
            </div>
          )}

          {obscured && (
            <button type="button" className={s.videoObscured} onClick={() => setObscured(false)}>
              <span className={s.videoObscuredTitle}>Video paused</span>
              <span className={s.videoObscuredText}>
                Playback pauses when you leave this window. Click here, then press play to continue.
              </span>
            </button>
          )}

          {/* Watched % badge — top-right */}
          <div className={s.watchPctBadge}>
            {courseCompleted
              ? <span className={s.watchPctCompleted}>{Icon.check} 100% watched</span>
              : isRewatching
              ? <span>{localPct}% re-watched</span>
              : isCompleted
              ? <span className={s.watchPctCompleted}>{Icon.check} Completed</span>
              : displayPct > 0
                ? <span>{displayPct}% watched</span>
                : null
            }
          </div>

        </div>

        {/* Progress bar — below the video. Seeking is limited to the
            already-watched region so users still can't skip ahead. */}
        <div className={s.videoProgressWrap} onClick={handleProgressClick}>
          <div className={s.videoProgressTrack}>
            <div className={s.videoProgressFill} style={{ width: `${localPct}%` }}/>
            {displayPct > localPct && (
              <div className={s.videoProgressMax} style={{ left: `${displayPct}%` }}/>
            )}
            <div className={s.videoProgressHandle} style={{ left: `${localPct}%` }}/>
          </div>
        </div>

        {/* Control bar — below the progress bar, own light background */}
        <div className={s.videoControlBar}>
          <div className={s.videoControlLeft}>
            {showRewatch ? (
              <button className={s.rewatchBtn} onClick={handleRewatch}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                </svg>
                Re-watch
              </button>
            ) : (
              <button className={s.videoCtrlIconBtn} onClick={togglePlay} title={paused ? 'Play' : 'Pause'}>
                {paused ? Icon.playFill : Icon.pause}
              </button>
            )}
            <button className={s.videoCtrlIconBtn} onClick={() => seekRelative(-10)} title="Rewind 10s">
              {Icon.rewind}
            </button>
            <button className={s.speedBadge} onClick={cycleSpeed} title="Playback speed">
              {speed}x
            </button>
            <button className={s.videoCtrlIconBtn} onClick={() => seekRelative(10)} title="Forward 10s">
              {Icon.forward}
            </button>
            <span className={s.videoTimeTxt}>{fmtT(courseCompleted ? dur : timeNow)} / {fmtT(dur)}</span>
          </div>
          <div className={s.videoControlRight}>
            <button
              className={s.videoCtrlIconBtn}
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
              {isFullscreen ? Icon.compress : Icon.expand}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No-video fallback
  return (
    <div className={s.videoWrap}>
      {imgSrc
        ? <img src={imgSrc} alt="" className={s.videoThumb}/>
        : <div className={s.videoPlaceholder}/>
      }
      <div className={s.playOverlay}>
        <button className={s.playCircle} onClick={onToggle}>
          {isPlaying ? Icon.pause : Icon.playFill}
        </button>
      </div>
      <div className={s.controls}>
        <button className={s.ctrlBtn}>{isPlaying ? Icon.pause : Icon.play}</button>
        <span className={s.ctrlGap}/>
      </div>
    </div>
  );
}

// ── OverviewTab ───────────────────────────────────────────────────────────────
function OverviewTab({ course, chapter }) {
  const points = [];
  if (course?.what_will_learn) points.push(course.what_will_learn);
  if (chapter?.desc) points.push(chapter.desc);
  const fallback = [
    'Sequential unlock — previous chapter must be passed',
    'Must watch 100% to unlock quiz',
    'Playback tracking (5s intervals)',
    'Admin override available',
  ];
  return (
    <div className={s.overviewSection}>
      {course?.desc && <p className={s.overviewDesc}>{course.desc}</p>}
      <h4 className={s.overviewTitle}>Chapter logic</h4>
      <ul className={s.bulletList}>
        {(points.length > 0 ? points : fallback).map((p, i) => <li key={i}>{p}</li>)}
      </ul>
    </div>
  );
}

// ── NoteTab ───────────────────────────────────────────────────────────────────
function NoteTab({ courseId, chapterId, topicId, topicTitle, notes, setNotes }) {
  const [text,   setText]   = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const res = await apiServiceHandler('POST', 'note/create', {
        courseId,
        chapterId: chapterId || undefined,
        topicId:   topicId   || undefined,
        text: text.trim(),
      });
      const newNote = res?.data ?? res;
      if (newNote?._id) {
        setNotes(prev => [newNote, ...prev]);
        setText('');
      }
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await apiServiceHandler('DELETE', `note/delete/${id}`);
      setNotes(prev => prev.filter(n => String(n._id) !== String(id)));
    } catch { /* silent */ }
  }

  function fmtNoteDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' · '
      + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className={s.noteWrap}>
      <span className={s.contextChip}>@ {topicTitle || 'Current Topic'}</span>
      <textarea
        className={s.noteArea}
        placeholder="Write your notes here…"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') handleSave(); }}
      />
      <div className={s.noteFooter}>
        <span className={s.noteHint}>Ctrl+Enter to save</span>
        <button className={s.sendBtn} onClick={handleSave} disabled={!text.trim() || saving} title="Save note">
          {saving ? <span style={{fontSize:11,padding:'0 4px'}}>…</span> : Icon.send}
        </button>
      </div>

      {/* Saved notes list */}
      {notes.length > 0 ? (
        <div className={s.notesList}>
          <p className={s.notesListLabel}>Saved Notes ({notes.length})</p>
          {notes.map(n => (
            <div key={String(n._id)} className={s.noteItem}>
              <div className={s.noteItemHeader}>
                <span className={s.noteItemDate}>{fmtNoteDate(n.createdAt)}</span>
                <button className={s.noteDeleteBtn} onClick={() => handleDelete(n._id)} title="Delete">✕</button>
              </div>
              <p className={s.noteItemText}>{n.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className={s.notesEmpty}>No notes saved for this topic yet.</p>
      )}
    </div>
  );
}

// ── ReviewsTab ────────────────────────────────────────────────────────────────
const RATING_LABEL = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

function ReviewsTab({ enableReview, courseId, chapterId }) {
  const [reviews,      setReviews]      = useState([]);
  const [myReview,     setMyReview]     = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [userRating,   setUserRating]   = useState(0);
  const [hover,        setHover]        = useState(0);
  const [reviewText,   setReviewText]   = useState('');
  const [saving,       setSaving]       = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [helpfulVotes, setHelpfulVotes] = useState({}); // reviewId -> 'up' | 'down' (local only, no backend support)

  useEffect(() => {
    if (!courseId || !chapterId) return;
    let cancelled = false;
    async function fetchReviews() {
      setLoading(true);
      try {
        const [listRes, mineRes] = await Promise.all([
          apiServiceHandler('GET', `review/list?courseId=${courseId}&chapterId=${chapterId}`).catch(() => null),
          apiServiceHandler('GET', `review/mine?chapterId=${chapterId}`).catch(() => null),
        ]);
        if (cancelled) return;
        setReviews(toArr(listRes));
        const mine = mineRes?.data ?? mineRes;
        if (mine?._id) {
          setMyReview(mine);
          setUserRating(mine.rating || 0);
          setReviewText(mine.text || '');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchReviews();
    return () => { cancelled = true; };
  }, [courseId, chapterId]);

  if (!enableReview) {
    return (
      <div className={s.reviewsDisabled}>
        <span className={s.reviewsDisabledIcon}>{Icon.lock}</span>
        <p className={s.reviewsDisabledMsg}>Reviews are disabled for this course.</p>
        <p className={s.reviewsDisabledSub}>The instructor has turned off reviews for this content.</p>
      </div>
    );
  }

  async function handleSubmit() {
    if (!userRating || !reviewText.trim() || saving) return;
    setSaving(true);
    try {
      const res = await apiServiceHandler('POST', 'review/submit', {
        courseId, chapterId,
        rating: userRating,
        text: reviewText.trim(),
      });
      const saved = res?.data ?? res;
      if (saved?._id) {
        setMyReview(saved);
        setReviews(prev => {
          const without = prev.filter(r => String(r._id) !== String(saved._id));
          return [{ ...saved, userId: { name: 'You' } }, ...without];
        });
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 4000);
      }
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

  function fmtDate(d) {
    if (!d) return '';
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days < 1) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    const w = Math.floor(days / 7);
    return w < 5 ? `${w} week${w > 1 ? 's' : ''} ago`
      : new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  const activeRating = hover || userRating;
  const alreadyReviewed = !!myReview;

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? Math.round((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews) * 10) / 10
    : 0;
  const starCounts = [5, 4, 3, 2, 1].map(star => reviews.filter(r => r.rating === star).length);

  function toggleHelpful(reviewId, vote) {
    setHelpfulVotes(prev => ({ ...prev, [reviewId]: prev[reviewId] === vote ? null : vote }));
  }

  return (
    <div className={s.reviewsWrap}>
      {/* ── Rating summary ── */}
      <div className={s.reviewSummaryCard}>
        <div className={s.reviewSummaryLeft}>
          <span className={s.reviewsPill}>Reviews</span>
          <h3 className={s.reviewSummaryTitle}>Our Customer Reviews</h3>
          <p className={s.leaveRatingLabel}>Leave a Rating</p>
          <div className={s.reviewStarRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n}
                style={{ cursor: 'pointer', color: activeRating >= n ? '#f59e0b' : '#d1d5db', display: 'flex' }}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setUserRating(n)}>
                {Icon.star}
              </span>
            ))}
            {userRating > 0 && <span className={s.ratingHint}>{RATING_LABEL[userRating]}</span>}
          </div>
        </div>

        {totalReviews > 0 && (
          <div className={s.reviewSummaryRight}>
            <div className={s.reviewAvgBox}>
              <span className={s.reviewAvgNum}>{avgRating}</span>
              <div className={s.reviewAvgStars}>
                {[1, 2, 3, 4, 5].map(n => (
                  <span key={n} style={{ color: Math.round(avgRating) >= n ? '#f59e0b' : '#d1d5db' }}>{Icon.star}</span>
                ))}
              </div>
              <span className={s.reviewAvgCount}>{totalReviews} Rating{totalReviews !== 1 ? 's' : ''}</span>
            </div>
            <div className={s.reviewBars}>
              {[5, 4, 3, 2, 1].map((star, i) => {
                const pct = totalReviews > 0 ? Math.round((starCounts[i] / totalReviews) * 100) : 0;
                return (
                  <div className={s.reviewBarRow} key={star}>
                    <span className={s.reviewBarLabel}>{star}</span>
                    <div className={s.reviewBarTrack}>
                      <div className={s.reviewBarFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={s.reviewBarPct}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Write / Edit review form ── */}
      <div className={s.reviewFormBox}>
        <h4 className={s.reviewFormTitle}>
          {alreadyReviewed ? 'Your Review for this Chapter' : 'Write a Review'}
        </h4>
        {userRating === 0 && (
          <p className={s.reviewFormHint}>Pick a star rating above, then share a few words about this chapter.</p>
        )}
        <textarea
          className={s.reviewTextarea}
          placeholder="Share your experience with this chapter..."
          value={reviewText}
          onChange={e => setReviewText(e.target.value)}
          rows={3}
        />
        <div className={s.reviewFormFooter}>
          {submitted && <p className={s.reviewSuccess}>
            {alreadyReviewed ? 'Review updated!' : 'Thank you! Your review has been submitted.'}
          </p>}
          <button className={s.reviewSubmitBtn} onClick={handleSubmit}
            disabled={!userRating || !reviewText.trim() || saving}>
            {saving ? 'Saving…' : alreadyReviewed ? 'Update Review' : 'Submit Review'}
          </button>
        </div>
      </div>

      {/* ── Review list */}
      {loading ? (
        <p className={s.reviewsLoading}>Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className={s.reviewsEmpty}>No reviews yet for this chapter. Be the first!</p>
      ) : (
        <>
          <h3 className={s.reviewsListTitle}>Chapter Reviews ({reviews.length})</h3>
          {reviews.map((r) => {
            const name = r.userId?.name || 'Learner';
            const rid  = String(r._id);
            const vote = helpfulVotes[rid];
            return (
              <div key={rid} className={s.reviewCard}>
                <div className={s.reviewAvatar}>{name[0].toUpperCase()}</div>
                <div className={s.reviewBody}>
                  <div className={s.reviewMeta}>
                    <span className={s.reviewName}>{name}</span>
                    <span className={s.reviewAge}>{fmtDate(r.createdAt)}</span>
                  </div>
                  <div className={s.reviewStars}>
                    {[1,2,3,4,5].map(n => (
                      <span key={n} style={{ color: r.rating >= n ? '#f59e0b' : '#d1d5db' }}>{Icon.star}</span>
                    ))}
                  </div>
                  <p className={s.reviewText}>{r.text}</p>
                  <div className={s.reviewHelpfulRow}>
                    <span className={s.reviewHelpfulLabel}>Was this review helpful?</span>
                    <button
                      className={`${s.reviewHelpfulBtn} ${vote === 'up' ? s.reviewHelpfulBtnActive : ''}`}
                      onClick={() => toggleHelpful(rid, 'up')}
                      aria-label="Mark helpful">
                      {Icon.thumbUp}
                    </button>
                    <button
                      className={`${s.reviewHelpfulBtn} ${vote === 'down' ? s.reviewHelpfulBtnActive : ''}`}
                      onClick={() => toggleHelpful(rid, 'down')}
                      aria-label="Mark not helpful">
                      {Icon.thumbDn}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── Topic type detection ──────────────────────────────────────────────────────
function getTopicType(topic) {
  if (!topic) return 'lesson';
  const vt = String(topic.video_type || topic.type || topic.contentType || '').toLowerCase().trim();
  if (vt === 'zoom_link' || vt === 'zoom' || vt === 'live' || vt === 'meeting') return 'zoom';
  if (vt === 'quiz') return 'quiz';
  if (vt === 'assignment') return 'assignment';
  // 'lesson' is the video/watch type
  return 'lesson';
}

// Same order the admin course builder shows: by `order`, and when two topics
// share an order value (older courses were saved with a chapter's lesson and
// quiz both at order 1) lessons come before quizzes, then zoom links, then
// assignments — the builder's tie-break — instead of the server's
// alphabetical-by-title fallback. Array.sort is stable, so remaining ties keep
// the server's order, as the builder does.
const TOPIC_TYPE_RANK = { lesson: 0, quiz: 1, zoom: 2, assignment: 3 };
function compareTopics(a, b) {
  return ((a.order ?? 9999) - (b.order ?? 9999))
    || ((TOPIC_TYPE_RANK[getTopicType(a)] ?? 0) - (TOPIC_TYPE_RANK[getTopicType(b)] ?? 0));
}

function getTopicIcon(topic, isActive) {
  const type = getTopicType(topic);
  if (type === 'zoom')       return Icon.camera;
  if (type === 'quiz')       return Icon.clipCheck;
  if (type === 'assignment') return Icon.fileDown;
  return isActive ? Icon.pause : Icon.play;
}

/** Tells the server the learner joined a Zoom session / finished homework (used by reports). */
function recordTopicActivity(kind, courseId, topicId) {
  if (!courseId || !topicId) return;
  apiServiceHandler('POST', `topic-activity/${kind}`, { courseId, topicId: String(topicId) }).catch(() => {});
}

// ── ZoomPanel ─────────────────────────────────────────────────────────────────
function ZoomPanel({ topic, courseId, onContinue }) {
  const link = topic.videoUrl || topic.zoom_link || topic.zoomUrl || topic.link || '';
  const rawTime = topic.zoom_time || topic.scheduled_at || topic.start_time || null;

  function fmtZoomTime(d) {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return dt.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  const displayTime = fmtZoomTime(rawTime);

  return (
    <div className={s.zoomPanel}>
      <div className={s.zoomMeta}>
        <p className={s.zoomMetaRow}>
          <span className={s.zoomMetaLabel}>Topic:</span>{' '}{topic.title}
        </p>
        {displayTime && (
          <p className={s.zoomMetaRow}>
            <span className={s.zoomMetaLabel}>Time:</span>{' '}{displayTime}
          </p>
        )}
      </div>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className={s.zoomJoinBtn}
          onClick={() => recordTopicActivity('zoom-join', courseId, topic._id)}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{flexShrink:0}}>
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
          </svg>
          Join The Zoom Meeting
        </a>
      ) : (
        <p className={s.panelNote}>Zoom link will be available when the session goes live.</p>
      )}
      {onContinue && (
        <button className={s.panelBtn} onClick={onContinue} style={{ marginTop: 16 }}>
          Continue
        </button>
      )}
    </div>
  );
}

// ── QuizPanel ─────────────────────────────────────────────────────────────────
const QuizIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
);

function ResultCircle({ passed, s }) {
  if (passed) {
    return (
      <div className={s.circleWrap}>
        <div className={`${s.circle} ${s.circlePassed}`}>
          <svg viewBox="0 0 48 48" fill="none" width="52" height="52">
            <circle cx="24" cy="24" r="22" stroke="#16a34a" strokeWidth="3" fill="#dcfce7" />
            <path d="M14 24l7 7 13-13" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className={`${s.circleRing} ${s.circleRingPassed}`} />
      </div>
    );
  }
  return (
    <div className={s.circleWrap}>
      <div className={`${s.circle} ${s.circleFailed}`}>
        <svg viewBox="0 0 48 48" fill="none" width="52" height="52">
          <circle cx="24" cy="24" r="22" stroke="#dc2626" strokeWidth="3" fill="#fee2e2" />
          <path d="M16 16l16 16M32 16L16 32" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className={`${s.circleRing} ${s.circleRingFailed}`} />
    </div>
  );
}

const QRowCheckIcon = (
  <svg viewBox="0 0 20 20" fill="none" width="13" height="13">
    <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const QRowXIcon = (
  <svg viewBox="0 0 20 20" fill="none" width="12" height="12">
    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

// Start screen summary of the quiz's rules (from its builder settings).
function QuizRulesNote({ settings }) {
  const items = [`Pass mark: ${settings.passingGrade}%`];
  const t = settings.timeLimitSeconds;
  if (t > 0) items.push(t < 60 ? `Time limit: ${t}s` : `Time limit: ${Math.round(t / 60)} min`);
  if (settings.attemptsAllowed > 0) items.push(`Attempts allowed: ${settings.attemptsAllowed}`);
  if (settings.maxQuestions > 0) items.push(`Up to ${settings.maxQuestions} questions`);
  return <p className={s.quizRulesNote}>{items.join(' · ')}</p>;
}

function QuizVideoBlockedNote() {
  return (
    <p className={s.quizBlockedNote}>
      A lesson video from this course is playing in another tab or device.
      Pause it to start the quiz.
    </p>
  );
}

function QuizPanel({ topic, chapterTitle, onQuizPass, onQuizAttempt, attemptCount = 0, isPassed = false, onContinue, onActiveChange, videoBlocked = false, onVideoConflict, onWatchLesson }) {
  // The quiz's own rules from the course builder's Settings tab.
  const qSettings = normalizeQuizSettings(topic.quizSettings);
  const timeLimit = qSettings.timeLimitSeconds; // 0 = no limit
  const attemptsLeft = qSettings.attemptsAllowed > 0
    ? Math.max(0, qSettings.attemptsAllowed - attemptCount)
    : Infinity;
  const outOfAttempts = attemptsLeft <= 0;
  const [phase,       setPhase]       = useState('start');
  const [checkingLock, setCheckingLock] = useState(false);
  const [cancelNotice, setCancelNotice] = useState(false); // quiz was cancelled by a lesson video playing elsewhere
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [questions,   setQuestions]   = useState([]);
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [answers,     setAnswers]     = useState({});   // qId -> { transcript, status }
  const [quizElapsed, setQuizElapsed] = useState(0); // seconds spent on this attempt
  const [submitError, setSubmitError] = useState('');
  const [evalResult,   setEvalResult]   = useState(null);

  // While a quiz is being taken the rest of the course is read-only — tell the
  // page so it can lock lesson playback and navigation.
  const quizActive = phase === 'loading' || phase === 'question' || phase === 'evaluating';
  useEffect(() => {
    onActiveChange?.(quizActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizActive]);
  useEffect(() => () => onActiveChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  // No refreshing mid-quiz: F5 / Ctrl+F5 / Ctrl+R / Ctrl+Shift+R (Cmd+R on Mac)
  // are swallowed, and the browser's own reload/close asks for confirmation.
  useEffect(() => {
    if (!quizActive) return;
    const onKeyDown = (e) => {
      const key = String(e.key || '').toLowerCase();
      if (key === 'f5' || ((e.ctrlKey || e.metaKey) && key === 'r')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [quizActive]);

  // A lesson video of this course started playing in another tab/device while
  // the quiz was running — the latest activity wins, so the quiz is abandoned.
  function cancelForVideo() {
    setPhase(p => (p === 'question' || p === 'loading' ? 'start' : p));
    setAnswers({}); setCurrentIdx(0); setQuizElapsed(0); setEvalResult(null);
    resetVoiceInput?.('');
    setCancelNotice(true);
  }

  // Same browser: the page hears the video start instantly over BroadcastChannel.
  // (Not while evaluating — the answers are already submitted.)
  useEffect(() => {
    if (videoBlocked && (phase === 'question' || phase === 'loading')) cancelForVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoBlocked]);

  // Hold the account-wide lock (other tabs/devices) for as long as the quiz runs.
  // The server answers { cancelled: true } once a video has started elsewhere.
  useEffect(() => {
    const cid = String(topic.courseId?._id || topic.courseId || '');
    if (!quizActive || !cid) return;
    const beat = () => apiServiceHandler('POST', 'quiz-attempt/lock', { courseId: cid, topicId: topic._id, ownerId: TAB_ID })
      .then(res => {
        const data = res?.data ?? res;
        if (data?.cancelled && phaseRef.current !== 'evaluating') cancelForVideo();
      })
      .catch(() => { /* next heartbeat retries */ });
    beat();
    broadcastLock('quiz', cid, true);
    const iv = setInterval(beat, QUIZ_LOCK_HEARTBEAT_MS);
    return () => {
      clearInterval(iv);
      apiServiceHandler('POST', 'quiz-attempt/unlock', { courseId: cid, ownerId: TAB_ID })
        .catch(() => { /* the lock lapses on its own without heartbeats */ });
      broadcastLock('quiz', cid, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizActive]);
  const {
    transcript, setTranscript,
    isRecording, recordTime, micError, isTranscribing,
    startRecording, stopRecording, reset: resetVoiceInput, clear: clearVoiceInput, usesFallback,
    liveText, maxRecordingSeconds,
  } = useVoiceAnswer();
  const answersRef     = useRef({});
  answersRef.current   = answers;

  // A lesson video of this course playing in another tab/device blocks the
  // quiz. The page's poll can be up to ~10s stale, so check live before the
  // quiz starts (and takes its own lock).
  async function isVideoPlayingElsewhere() {
    const cid = String(topic.courseId?._id || topic.courseId || '');
    if (!cid) return false;
    setCheckingLock(true);
    try {
      const { video } = await fetchCourseLocks(cid);
      if (video) onVideoConflict?.();
      return video;
    } catch {
      return false; // don't strand the learner on a network hiccup
    } finally {
      setCheckingLock(false);
    }
  }

  async function beginRetake() {
    if (outOfAttempts) return;
    if (videoBlocked || await isVideoPlayingElsewhere()) return;
    setSubmitError('');
    setAnswers({}); setCurrentIdx(0); setQuizElapsed(0); setEvalResult(null); setPhase('question');
  }

  async function startQuiz() {
    if (outOfAttempts) return;
    if (videoBlocked || await isVideoPlayingElsewhere()) return;
    setCancelNotice(false);
    setSubmitError('');
    setPhase('loading');
    try {
      // forLearner=true opts into the server's aptitude-level-weighted question selection
      // (see quiz_question.service.js listQuestionsForLearner) instead of the full admin pool.
      const res = await apiServiceHandler('GET', `quiz-questions/list?quizId=${topic._id}&forLearner=true`);
      const qs  = toArr(res);
      if (qs.length === 0) { setPhase('empty'); return; }
      // The server already applied Question Order + Max Question Allowed.
      setQuestions(qs);
      setCurrentIdx(0);
      setAnswers({});
      setEvalResult(null);
      setQuizElapsed(0);
      if (phaseRef.current !== 'loading') return; // cancelled while loading
      setPhase('question');
    } catch { setPhase('empty'); }
  }

  // Quiz clock: counts up; with a Time Limit set, the quiz auto-submits when it runs out.
  const quizTimeLeft = timeLimit > 0 ? Math.max(0, timeLimit - quizElapsed) : null;
  useEffect(() => {
    if (phase !== 'question') return;
    if (timeLimit > 0 && quizElapsed >= timeLimit) { handleTimeExpired(); return; }
    const t = setTimeout(() => setQuizElapsed(n => n + 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, quizElapsed]);

  // Quiz Auto Start: open straight into the questions (not after a pass, and
  // only while attempts remain). Only on first open, not after a cancel.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current || !qSettings.quizAutoStart || isPassed || outOfAttempts) return;
    autoStartedRef.current = true;
    startQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset mic + restore saved transcript on question change (timer continues across questions)
  useEffect(() => {
    if (phase !== 'question') return;
    stopRecording();
    const q     = questions[currentIdx];
    const saved = q ? answersRef.current[String(q._id)] : null;
    resetVoiceInput(saved?.transcript || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, phase]);

  function fmtSecs(n) {
    const h = Math.floor(n / 3600);
    const mm = String(Math.floor((n % 3600) / 60)).padStart(2, '0');
    const ss = String(n % 60).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  // Time's up → submit now; every pending question is marked "Skipped".
  function handleTimeExpired() {
    stopRecording();
    submitQuiz(questions, answersForTimeUp(questions, answersRef.current));
  }

  function advance(status) {
    stopRecording();
    const q   = questions[currentIdx];
    const qId = String(q._id);
    const saved = { status, transcript: status === 'answered' ? transcript : '' };
    const newAnswers = { ...answers, [qId]: saved };
    setAnswers(newAnswers);
    moveOnOrSubmit(newAnswers);
  }

  // Goes to the next unanswered question, wrapping round to the first
  // unanswered one after the last question (skipped questions come back until
  // they're answered). The quiz submits once every question is answered.
  function moveOnOrSubmit(answersMap) {
    if (unansweredIndexes(questions, answersMap).length === 0) { submitQuiz(questions, answersMap); return; }
    const next = nextUnansweredCycling(questions, answersMap, currentIdx);
    if (next !== -1) setCurrentIdx(next);
    // else: the current question is the only one left — stay on it
  }

  // Back only steps through questions that still need an answer (wrapping).
  function goBack() {
    stopRecording();
    const prev = prevUnansweredCycling(questions, answers, currentIdx);
    if (prev !== -1) setCurrentIdx(prev);
  }

  function goForward() {
    stopRecording();
    moveOnOrSubmit(answers);
  }

  async function submitQuiz(qs, allAnswers) {
    setPhase('evaluating');
    try {
      const payload = {
        topicId:   topic._id,
        courseId:  topic.courseId  || undefined,
        chapterId: topic.chapterId || undefined,
        answers: qs.map(q => ({
          questionId:   q._id,
          questionText: q.question,
          userAnswer:   allAnswers[String(q._id)]?.transcript || '',
          status:       allAnswers[String(q._id)]?.status     || 'skipped',
        })),
        timeTakenSec: quizElapsed,
      };
      const res    = await apiServiceHandler('POST', 'quiz-attempt/submit', payload);
      const result = res?.data || res;
      setEvalResult(result);
      onQuizAttempt?.(String(topic._id));
      if (result?.passed) onQuizPass?.(String(topic._id));
      setPhase('results');
    } catch (err) {
      // e.g. no attempts left (403) — back to the start screen with the reason.
      setSubmitError(err?.response?.data?.message || 'Your quiz could not be submitted. Please try again.');
      setPhase('start');
    }
  }

  // ── Start / Loading ──────────────────────────────────────────
  if (phase === 'start' || phase === 'loading') {
    return (
      <div className={s.panelInner}>
        <div className={s.panelIcon} style={{ background: '#fef9e7', color: '#d97706' }}>{QuizIcon}</div>
        <h3 className={s.panelTitle}>{topic.title}</h3>
        <p className={s.panelSub}>Complete this quiz to test your understanding of the chapter</p>
        <div className={s.startBtns}>
          <button className={s.panelBtn} onClick={startQuiz} disabled={phase === 'loading' || checkingLock || videoBlocked || outOfAttempts}>
            {phase === 'loading' ? 'Loading…' : checkingLock ? 'Checking…' : attemptCount > 0 ? 'Re-Take Quiz' : 'Start Quiz'}
          </button>
          {onWatchLesson && (
            <button className={s.panelBtnOutline} onClick={onWatchLesson} disabled={phase === 'loading' || checkingLock}>
              Re-watch Lesson
            </button>
          )}
        </div>
        {videoBlocked && <QuizVideoBlockedNote />}
        {cancelNotice && !videoBlocked && (
          <p className={s.quizBlockedNote}>
            Your quiz was cancelled because a lesson video of this course was played.
            Start the quiz again when you&apos;re ready.
          </p>
        )}
        {submitError && <p className={s.quizBlockedNote}>{submitError}</p>}
        <QuizRulesNote settings={qSettings} />
        {outOfAttempts ? (
          <p className={s.quizBlockedNote}>
            You&apos;ve used all {qSettings.attemptsAllowed} attempt{qSettings.attemptsAllowed === 1 ? '' : 's'} for this quiz.
          </p>
        ) : attemptCount > 0 && (
          <p className={s.attemptNote}>
            This will be your {ordinal(attemptCount + 1)} attempt at this quiz
            {Number.isFinite(attemptsLeft) ? ` (${attemptsLeft} left)` : ''}
          </p>
        )}
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────
  if (phase === 'empty') {
    return (
      <div className={s.panelInner}>
        <div className={s.panelIcon} style={{ background: '#fef9e7', color: '#d97706' }}>{QuizIcon}</div>
        <h3 className={s.panelTitle}>{topic.title}</h3>
        <p className={s.panelSub}>No questions have been added to this quiz yet.</p>
        <button className={s.panelBtn} onClick={() => setPhase('start')}>Go Back</button>
      </div>
    );
  }

  // ── Evaluating ───────────────────────────────────────────────
  if (phase === 'evaluating') {
    return (
      <div className={s.quizEvaluating}>
        <div className={s.quizEvalSpinner}/>
        <h3 className={s.quizEvalTitle}>Evaluating Your Answers…</h3>
        <p className={s.quizEvalSub}>AI is reviewing your responses. This may take a moment.</p>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────
  if (phase === 'results') {
    const score       = evalResult?.totalScore ?? 0;
    const passed      = evalResult?.passed     ?? false;
    const evaluated   = evalResult?.answers    ?? [];
    const timeTaken   = quizElapsed;
    const passMark    = evalResult?.passingGrade ?? qSettings.passingGrade;
    const timeTakenStr = `${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s`;
    const correctCount = evaluated.filter(a => a.status !== 'skipped' && a.maxScore > 0 && (a.aiScore / a.maxScore) * 100 >= 60).length;
    const chapterLabel  = chapterTitle ? `${chapterTitle} — ${topic.title}` : topic.title;

    return (
      <div className={s.resultWrap}>

        {/* Score card */}
        <div className={s.resultCard}>
          <div className={s.resultTopBar}>
            <h2 className={s.resultTitle}>Quiz Result</h2>
            <span className={`${s.resultBadge} ${passed ? s.badgePassed : s.badgeFailed}`}>
              {passed ? `Passed — ${score}%` : `Failed — ${score}%`}
            </span>
          </div>

          <div className={s.resultBody}>
            <ResultCircle passed={passed} s={s} />
            <h3 className={`${s.outcomeText} ${passed ? s.outcomePassed : s.outcomeFailed}`}>
              {passed ? 'Quiz Passed!' : 'Quiz Failed'}
            </h3>
            <p className={s.chapterLabel}>{chapterLabel}</p>

            <div className={s.resStatsRow}>
              <div className={s.resStat}>
                <span className={s.resStatVal}>{score}%</span>
                <span className={s.resStatLbl}>Final Score</span>
              </div>
              <div className={s.resStat}>
                <span className={s.resStatVal}>{correctCount}/{evaluated.length}</span>
                <span className={s.resStatLbl}>Correct</span>
              </div>
              <div className={s.resStat}>
                <span className={s.resStatVal}>{timeTakenStr}</span>
                <span className={s.resStatLbl}>Time Taken</span>
              </div>
            </div>

            <p className={s.threshold}>Pass Threshold: {passMark}%</p>
          </div>
        </div>

        {/* Per-question breakdown */}
        {evaluated.length > 0 && (
          <div className={s.breakdownSection}>
            <p className={s.breakdownMeta}>My Progress</p>
            <h3 className={s.breakdownTitle}>Question Breakdown</h3>

            <div className={s.qList}>
              {evaluated.map((a, i) => {
                const skipped = a.status === 'skipped';
                const pct     = a.maxScore > 0 ? Math.round((a.aiScore / a.maxScore) * 100) : 0;
                const isWrong = skipped || pct < 60;
                return (
                  <div key={i} className={`${s.qRow} ${isWrong ? s.qRowWrong : ''}`}>
                    <span className={`${s.qIconCircle} ${isWrong ? s.qIconWrong : s.qIconOk}`}>
                      {isWrong ? QRowXIcon : QRowCheckIcon}
                    </span>
                    <div className={s.qContent}>
                      <p className={s.qText}>Q{i + 1} - {a.questionText}</p>
                      {skipped ? (
                        <span className={s.qSkipped}>Skipped</span>
                      ) : a.userAnswer ? (
                        <p className={s.qAnswerText}>{a.userAnswer}</p>
                      ) : null}
                      {a.aiFeedback && <p className={s.qFeedback}>{a.aiFeedback}</p>}
                    </div>
                    <span className={`${s.qScorePill} ${isWrong ? s.qScorePillWrong : s.qScorePillOk}`}>
                      {skipped ? '—' : `${pct}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={s.resultBtns}>
          {!outOfAttempts && (
            <button className={s.panelBtn} onClick={beginRetake} disabled={checkingLock || videoBlocked}>
              {checkingLock ? 'Checking…' : 'Re-Take Quiz'}
            </button>
          )}
          {passed && onContinue && (
            <button className={s.panelBtn} onClick={onContinue}>
              Continue
            </button>
          )}
        </div>
        {videoBlocked && <QuizVideoBlockedNote />}
        {!passed && (!outOfAttempts ? (
          <p className={s.attemptNote}>
            Re-taking will be your {ordinal(attemptCount + 1)} attempt at this quiz
            {Number.isFinite(attemptsLeft) ? ` (${attemptsLeft} left)` : ''}
          </p>
        ) : (
          <p className={s.quizBlockedNote}>
            You&apos;ve used all {qSettings.attemptsAllowed} attempt{qSettings.attemptsAllowed === 1 ? '' : 's'} for this quiz.
          </p>
        ))}
      </div>
    );
  }

  // ── Question ─────────────────────────────────────────────────
  const q          = questions[currentIdx];
  const total      = questions.length;
  const qId        = String(q._id);
  const savedAns   = answers[qId];
  const isAnswered = savedAns?.status === 'answered';
  const hasBack    = prevUnansweredCycling(questions, answers, currentIdx) !== -1;
  const allAnswered = unansweredIndexes(questions, answers).length === 0;
  const hasSpeech  = !!String(transcript || '').trim();

  return (
    <div className={s.quizVoiceWrap}>
      {/* Header bar */}
      <div className={s.quizVoiceHeader}>
        <div className={s.quizVoiceHeaderLeft}>
          <span className={s.quizVoiceTitle}>{topic.title}</span>
          <span className={s.quizVoiceSep}>\</span>
          <span className={s.quizVoiceTag}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/>
            </svg>
            Voice Enabled
          </span>
        </div>
        <div className={s.quizVoiceStats}>
          {!qSettings.hideQuizTime && (
            <>
              <div className={s.quizVoiceStat}>
                <span className={s.quizVoiceStatLbl}>{quizTimeLeft === null ? 'Time' : 'Time Left'}</span>
                <span className={s.quizVoiceStatVal}
                  style={{ color: quizTimeLeft !== null && quizTimeLeft <= 60 ? '#dc2626' : undefined }}>
                  {fmtSecs(quizTimeLeft === null ? quizElapsed : quizTimeLeft)}
                </span>
              </div>
            </>
          )}
          {!qSettings.hideQuestionNumber && (
            <>
              {/* Divider only between two visible stats */}
              {!qSettings.hideQuizTime && <div className={s.quizVoiceStatDivider}/>}
              <div className={s.quizVoiceStat}>
                <span className={s.quizVoiceStatLbl}>Q. No</span>
                <span className={s.quizVoiceStatVal}>Q{currentIdx + 1}/{total}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Question Layout = All questions: every question listed; the
          highlighted one is answered below, unanswered ones can be picked. */}
      {qSettings.questionLayout === 'all' && (
        <ol className={s.quizAllList}>
          {questions.map((qq, i) => {
            const done = answers[String(qq._id)]?.status === 'answered';
            const isCurrent = i === currentIdx;
            return (
              <li key={String(qq._id)}>
                <button type="button"
                  className={`${s.quizAllItem} ${isCurrent ? s.quizAllItemCurrent : ''} ${done ? s.quizAllItemDone : ''}`}
                  disabled={done || isCurrent || isRecording || isTranscribing}
                  onClick={() => { stopRecording(); setCurrentIdx(i); }}>
                  {!qSettings.hideQuestionNumber && <span className={s.quizAllNum}>Q{i + 1}</span>}
                  <span className={s.quizAllText}>{qq.question}</span>
                  <span className={s.quizAllStatus}>{done ? 'Answered' : isCurrent ? 'Answering' : 'Pending'}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/* Question */}
      <div className={s.quizVoiceBody}>
        <p className={s.quizVoiceQuestion}>&ldquo;{q.question}&rdquo;</p>
        <p className={s.quizScoringTags}>
          Speech-To-Text &middot; Semantic Scoring &middot; Partial Credit Enabled
        </p>

        {/* Answer area */}
        <div className={s.quizVoiceAnswerBox}>
          <div className={s.quizTranscriptArea}>
            {isAnswered ? (
              <span>{savedAns.transcript || <em>No speech recorded.</em>}</span>
            ) : (transcript || liveText) ? (
              <span>
                {transcript}
                {liveText && <span className={s.quizLivePreview}>{transcript ? ' ' : ''}{liveText}</span>}
              </span>
            ) : (
              <span className={s.quizTranscriptPlaceholder}>Your answer will appear here as you speak…</span>
            )}
          </div>

          {!isAnswered && (
            <div className={s.quizClearRow}>
              <button
                type="button"
                className={s.quizClearBtn}
                onClick={clearVoiceInput}
                disabled={!hasSpeech && !isRecording && !isTranscribing}
                title="Clear your answer and record again"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" aria-hidden="true">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                Clear
              </button>
            </div>
          )}

          {isAnswered ? (
            <div className={s.quizAnsweredBadge}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              Answer submitted — read only
            </div>
          ) : (
            <div className={s.quizMicRow}>
              <button
                className={`${s.quizMicCircleBtn} ${isRecording ? s.quizMicActive : ''}`}
                onClick={() => isRecording ? stopRecording() : startRecording()}
                disabled={isTranscribing}
                title={isRecording ? 'Stop recording' : 'Start recording'}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"/>
                </svg>
              </button>
              <div className={s.quizWaveform}>
                {isRecording
                  ? [0,1,2,3,4,5,6,7].map(i => (
                      <span key={i} className={s.quizWaveBar} style={{ animationDelay: `${i * 80}ms` }}/>
                    ))
                  : [0,1,2,3,4,5,6,7].map(i => (
                      <span key={i} className={s.quizWaveBarStatic}/>
                    ))
                }
              </div>
              <span className={s.quizMicPrompt}>
                {isTranscribing
                  ? 'Transcribing your answer…'
                  : isRecording
                  ? (usesFallback ? 'Recording · Tap Mic To Stop And Transcribe…' : 'Tap Mic To Stop · Speak Clearly In Hindi Or English…')
                  : 'Tap Mic To Start · Speak Your Answer…'}
              </span>
              <span className={s.quizMicTimer}>{fmtSecs(recordTime)} / {fmtSecs(maxRecordingSeconds)}</span>
            </div>
          )}

          {micError && <p className={s.quizMicError}>{micError}</p>}
        </div>
      </div>

      {/* Footer */}
      <div className={s.quizVoiceFooter}>
        {hasBack && (
          <button className={s.quizBackBtn} onClick={goBack}>
            ← Back
          </button>
        )}
        {isAnswered ? (
          <button className={s.quizSubmitAnswerBtn} onClick={goForward}>
            {allAnswered ? 'Submit Quiz' : 'Next →'}
          </button>
        ) : (
          <>
            <button
              className={s.quizSubmitAnswerBtn}
              onClick={() => advance('answered')}
              disabled={isRecording || isTranscribing || !hasSpeech}
              title={!hasSpeech ? 'Record your answer first' : undefined}
            >
              Submit Answer
            </button>
            <button className={s.quizSkipBtn} onClick={() => advance('skipped')}>
              Skip Question
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Homework is done only once a reviewer approved it (or it was marked done before videos were required). */
const isAssignmentDone = rec => Boolean(rec) && (rec.review?.status === 'approved' || (!rec.submission && !rec.review));

// ── AssignmentPanel ───────────────────────────────────────────────────────────
// 1. Download the assignment. 2. Upload videos of the finished work — one at a time,
//    each ≤ 2 GB; "add more" by uploading again. 3. A super admin or the learner's store
//    owner reviews them: "complete" finishes the homework (the chapter can then complete),
//    "re-upload" asks for another video. Until it is approved the chapter stays open.
const fmtShortDate = d => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/** One uploaded video: details, the reviewer's comment, and Play (loads and plays inline). */
function SubmittedVideoTile({ recordId, video, latest, courseId, topicId, canDelete, onDeleted }) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function remove() {
    setDeleting(true); setError('');
    try {
      const res = await apiServiceHandler('POST', 'topic-activity/assignment-video-delete', { courseId, topicId, video: video.n });
      toast.success(res?.message || 'Video deleted.');
      onDeleted?.(res?.data);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Could not delete the video.');
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  async function play() {
    setState('loading'); setError('');
    try { setUrl(await loadSubmissionVideo(recordId, video.n)); setState('ready'); }
    catch (err) { setError(err.message); setState('error'); }
  }
  // Newest comment first, oldest last
  const comments = videoComments(video).filter(cm => cm.note).reverse();
  return (
    <li className={s.vidTile}>
      <div className={s.vidStage}>
        {state === 'ready'
          ? <video className={s.vidPlayer} src={url} controls autoPlay playsInline controlsList="nodownload noplaybackrate noremoteplayback" disablePictureInPicture onPlay={pauseOtherVideos} />
          : (
            <button type="button" className={s.vidPlay} onClick={play}
              disabled={state === 'loading' || video.status === 'processing'} aria-label={`Play video ${video.n}`}>
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
              {/* MOV/AVI/MKV uploads are converted to MP4 on the server first (a few minutes). */}
              <span>{video.status === 'processing' ? 'Preparing video…' : state === 'loading' ? 'Loading…' : 'Play'}</span>
            </button>
          )}
      </div>
      <div className={s.vidInfo}>
        <div className={s.vidTop}>
          <span className={s.vidLabel}>Video {video.n}{latest ? ' · latest' : ''}</span>
          <span className={s.vidTopRight}>
            <span className={s.vidMeta}>{formatBytes(video.size)} · {fmtShortDate(video.uploadedAt)}</span>
            {canDelete && !confirming && (
              <button type="button" data-action="delete" className={s.vidDelete} title="Delete video"
                aria-label={`Delete video ${video.n}`} onClick={() => setConfirming(true)}>
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" /></svg>
              </button>
            )}
          </span>
        </div>
        {confirming && (
          <div className={s.vidConfirm} role="alertdialog" aria-label={`Delete video ${video.n}?`}>
            <span>Delete Video {video.n}? {video.n <= 1 && latest ? 'Your assignment will have no video until you upload one.' : 'This can\u2019t be undone.'}</span>
            <div className={s.vidConfirmBtns}>
              <button type="button" className={s.vidConfirmCancel} onClick={() => setConfirming(false)} disabled={deleting}>Cancel</button>
              <button type="button" className={s.vidConfirmDelete} onClick={remove} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        )}
        <span className={s.vidName} title={video.originalName}>{video.originalName || `Video ${video.n}`}</span>
        {error && <span className={s.vidError}>{error}</span>}
        {comments.length > 0 && (
          <ul className={s.vidComments} aria-label="Comments">
            {comments.map((cm, i) => (
              <li key={i} className={s.vidCommentsItem}>
                <span className={s.vidCommentsHead}>
                  Comment <em>by</em> <strong>{cm.reviewerName || 'Reviewer'}</strong>{cm.reviewedAt && <> <em>on</em> {formatDayDate(cm.reviewedAt)}</>}
                </span>
                <p className={s.vidCommentsText}>{cm.note}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/** One "choose a video → Upload" row. After a successful upload it shows the file with a tick. */
function UploadRow({ courseId, topicId, onUploaded }) {
  const [file,      setFile]      = useState(null);
  const [error,     setError]     = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [doneName,  setDoneName]  = useState('');
  const inputRef = useRef(null);

  function pickFile(e) {
    const f = e.target.files?.[0] || null;
    e.target.value = '';
    if (!f) return;
    const problem = checkSubmissionFile(f);
    setFile(problem ? null : f);
    setError(problem);
  }

  async function upload() {
    if (!file || uploading) return;
    setUploading(true); setProgress(0); setError('');
    try {
      const saved = await uploadAssignmentVideo({ courseId, topicId, file, onProgress: setProgress });
      setDoneName(`${file.name} · ${formatBytes(file.size)}`);
      setFile(null);
      onUploaded(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (doneName) {
    return (
      <li className={s.upItem}>
        <div className={s.upDoneRow}>
          <span className={s.upTick} aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
          </span>
          <span className={s.upDoneName} title={doneName}>{doneName}</span>
          <span className={s.upDoneTag}>Uploaded</span>
        </div>
      </li>
    );
  }
  return (
    <li className={s.upItem}>
      <input ref={inputRef} type="file" accept={SUBMISSION_ACCEPT} className={s.subInput} onChange={pickFile} disabled={uploading} />
      <div className={s.upRow}>
        <button type="button" className={s.upPick} onClick={() => inputRef.current?.click()} disabled={uploading}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className={s.upPickText} title={file?.name || ''}>{file ? `${file.name} · ${formatBytes(file.size)}` : 'Choose a video…'}</span>
        </button>
        <button type="button" className={`${s.panelBtn} ${s.upBtn}${(!file || uploading) ? ` ${s.panelBtnDisabled}` : ''}`} onClick={upload} disabled={!file || uploading}>
          {uploading ? `Uploading… ${progress}%` : 'Upload'}
        </button>
      </div>
      {uploading && (
        <div className={s.subProgress} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className={s.subError} role="alert">{error}</p>}
    </li>
  );
}

function AssignmentPanel({ topic, courseId, record, onSubmitted, continueLabel, onContinue }) {
  const [downloading, setDownloading] = useState(false);
  // Upload rows: one "choose → Upload" row; "+ Add More" adds the next once it is uploaded.
  const [rows, setRows] = useState([{ id: 1, uploaded: false }]);
  const attachment = Array.isArray(topic.attachments) && topic.attachments.length > 0 ? topic.attachments[0] : null;
  const fileUrl  = attachment?.url || topic.videoUrl || topic.file_url || topic.fileUrl || '';
  const fileName = attachment?.name || (fileUrl ? fileUrl.split('/').pop() : 'assignment');
  const reviewStatus = record?.review?.status || '';
  const needsReupload = reviewStatus === 'reupload';
  const isDone   = isAssignmentDone(record);
  const videos   = Array.isArray(record?.videos) ? record.videos : (record?.submission ? [{ n: 1, ...record.submission }] : []);
  const waiting  = videos.length > 0 && !isDone && !needsReupload; // sent, not reviewed yet
  // "How many videos can upload?" — a hard total for this assignment (rejections don't reset it)
  const limit    = videoLimitOf(topic);
  const left     = Math.max(0, limit - videos.length);
  const atLimit  = left === 0;
  const allRowsUploaded = rows.every(r => r.uploaded);
  const addRow = () => setRows(prev => [...prev, { id: (prev[prev.length - 1]?.id || 0) + 1, uploaded: false }]);
  const rowUploaded = (id, saved) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, uploaded: true } : r)));
    onSubmitted?.(String(topic._id), saved);
  };

  async function handleDownload() {
    if (!fileUrl || downloading) return;
    setDownloading(true);
    const fullUrl = secureMediaUrl(fileUrl, await getMediaToken())
      || (fileUrl.startsWith('http') ? fileUrl : `${API_URL}${fileUrl}`);
    try {
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = fileName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(fullUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  }

  const tone = isDone ? { bg: '#f0fdf4', fg: '#16a34a' } : waiting ? { bg: '#fff7ed', fg: '#d97706' } : { bg: '#eff6ff', fg: '#2563eb' };

  return (
    <div className={`${s.panelInner} ${s.assignPanel}`}>
      <div className={s.panelIcon} style={{ background: tone.bg, color: tone.fg }}>
        {isDone ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        ) : waiting ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        )}
      </div>
      <h3 className={s.panelTitle}>{topic.title}</h3>

      {/* ── Status ── */}
      {isDone && (
        <div className={s.assignComplete} role="status">
          <strong>Assignment complete</strong>
          <span>
            {reviewStatus === 'approved'
              ? `Your instructor approved this assignment — this ${continueLabel === 'Continue' ? 'topic' : 'chapter'} is now complete.`
              : 'This assignment is complete.'}
          </span>
          {reviewStatus === 'approved' && record.review.note && <span className={s.assignCompleteNote}>“{record.review.note}”{record.review.reviewerName ? ` — ${record.review.reviewerName}` : ''}</span>}
        </div>
      )}
      {waiting && (
        <div className={s.assignWaiting} role="status">
          <strong>Waiting for review</strong>
          <span>Your {videos.length === 1 ? 'video has' : `${videos.length} videos have`} been sent. The chapter will be completed once your instructor marks the assignment as complete{atLimit ? '.' : ' — you can still upload more videos below.'}</span>
        </div>
      )}
      {needsReupload && (
        <div className={s.reuploadNote} role="alert">
          <strong>Assignment rejected — please upload your video again</strong>
          {record.review.note ? <span>“{record.review.note}”</span> : <span>Your reviewer asked for a new video of this assignment. Check the comments on your videos below.</span>}
          {record.review.reviewerName && <small>— {record.review.reviewerName}</small>}
        </div>
      )}
      {!isDone && !waiting && !needsReupload && (
        <p className={s.panelSub}>Download the assignment, complete it, then upload videos of your finished work. Your instructor reviews them before the chapter is completed.</p>
      )}

      {/* ── Download the assignment: text left, button right ── */}
      <div className={s.dlCard}>
        <span className={s.dlIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 11v6m0 0l-3-3m3 3l3-3" /></svg>
        </span>
        <div className={s.dlText}>
          <span className={s.dlTitle}>Download the assignment</span>
          <span className={s.dlFile} title={fileUrl ? fileName : ''}>{fileUrl ? fileName : 'Your instructor has not added the assignment file yet.'}</span>
        </div>
        <button type="button" className={`${s.dlBtn}${(!fileUrl || downloading) ? ` ${s.panelBtnDisabled}` : ''}`} onClick={handleDownload} disabled={!fileUrl || downloading}>
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" /></svg>
          {downloading ? 'Downloading…' : 'Download'}
        </button>
      </div>

      {/* ── Upload Assignment Videos: one video per row; "+ Add More" for the next ── */}
      {!isDone && (
        <section className={s.asgSection} aria-labelledby={`up-h-${topic._id}`}>
          <h4 id={`up-h-${topic._id}`} className={s.asgHeading}>Upload Assignment Videos</h4>
          {!atLimit && (
            <p className={s.asgHint}>
              Choose one video ({SUBMISSION_UPLOAD_NOTE}) and click Upload.
              {limit > 1 ? ' Use “+ Add More” to upload the next one.' : ''}
              {' '}You can upload <strong>{limit} video{limit === 1 ? '' : 's'}</strong> for this assignment{left < limit ? ` — ${left} left` : ''}.
            </p>
          )}
          {atLimit ? (
            <p className={s.panelNote}>
              You have uploaded {limit === 1 ? 'the video' : `all ${limit} videos`} allowed for this assignment
              {needsReupload ? ', so no more can be uploaded. Please contact your instructor.' : '.'}
            </p>
          ) : (
            <>
              <ul className={s.upList}>
                {rows.map(r => (
                  <UploadRow key={r.id} courseId={courseId} topicId={String(topic._id)} onUploaded={saved => rowUploaded(r.id, saved)} />
                ))}
              </ul>
              {left > 1 && (
                <button type="button" className={s.addMoreBtn} onClick={addRow} disabled={!allRowsUploaded}
                  title={allRowsUploaded ? 'Add another video' : 'Upload the chosen video first'}>
                  + Add More
                </button>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Section 2: the videos already uploaded (two columns) ── */}
      {videos.length > 0 && (
        <section className={`${s.vidSection} ${s.asgSection}`} aria-labelledby={`vid-h-${topic._id}`}>
          <h4 id={`vid-h-${topic._id}`} className={`${s.asgHeading} ${s.vidSectionTitle}`}>Your uploaded videos <span className={s.vidCount}>{videos.length}</span></h4>
          <ul className={s.vidGrid}>
            {[...videos].reverse().map(v => (
              <SubmittedVideoTile key={`${v.n}-${v.uploadedAt}`} recordId={String(record._id)} video={v} latest={v.n === videos.length}
                courseId={courseId} topicId={String(topic._id)} canDelete={!isDone}
                onDeleted={saved => onSubmitted?.(String(topic._id), saved)} />
            ))}
          </ul>
        </section>
      )}

      {isDone && continueLabel && (
        <div className={s.assignBtnRow}>
          <button type="button" className={s.panelBtn} onClick={onContinue}>{continueLabel}</button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CourseDetailPage({ params }) {
  const { courseId } = use(params);
  const router   = useRouter();

  const [course,       setCourse]       = useState(null);
  const [courseDeleted, setCourseDeleted] = useState(false); // deleted by the super admin: can't be opened
  const [chapters,     setChapters]     = useState([]);
  const [topics,       setTopics]       = useState([]);
  const [reviewStats,  setReviewStats]  = useState({ avgRating: 0, total: 0 });
  const [activeChId,   setActiveChId]   = useState(null);
  const [activeTopId,  setActiveTopId]  = useState(null);
  const [expanded,     setExpanded]     = useState({});
  const [activeTab,    setActiveTab]    = useState('overview');
  const [playing,      setPlaying]      = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [notes,           setNotes]           = useState([]);
  const [progressMap,     setProgressMap]     = useState({}); // topicId -> progress record
  const [quizPassedMap,   setQuizPassedMap]   = useState({}); // topicId -> true if any attempt passed
  const [quizAttemptCounts, setQuizAttemptCounts] = useState({}); // topicId -> number of attempts made
  const [assignDoneMap,   setAssignDoneMap]   = useState({}); // topicId -> submission record once the homework is done
  const [pendingAdvanceFrom, setPendingAdvanceFrom] = useState(null); // topicId just completed
  const [completion, setCompletion] = useState(null); // permanent certificate record (server), or null
  const [returnToQuiz, setReturnToQuiz] = useState(null); // { chIdx, chId, topId } — quiz to reopen after "Watch Lesson"
  const [playCommand, setPlayCommand] = useState({ n: 0, topicId: null, toggle: false }); // sidebar play-icon requests
  const [quizInProgress, setQuizInProgress] = useState(false); // a quiz is being taken — course is read-only
  const [remoteQuizActive, setRemoteQuizActive] = useState(false); // ...in another tab or device
  const [videoResetSignal, setVideoResetSignal] = useState(0); // bumped when a quiz starts elsewhere — rewinds the lesson
  const [remoteVideoActive, setRemoteVideoActive] = useState(false); // a lesson video plays in another tab/device — quizzes blocked
  const ownQuizActiveRef = useRef(false);
  const [videoDurMap,     setVideoDurMap]     = useState({}); // topicId -> actual duration seconds
  const [enrolledCount,   setEnrolledCount]   = useState(0); // distinct learners assigned this course, across all orgs

  const user = useSelector(selectUser);
  // Lesson videos need a short-lived media token (server/middleware/mediaAuth.js).
  const [mediaToken, refreshMediaToken] = useMediaToken();
  // The video URL is fixed per lesson so the background token refresh never
  // reloads a playing video; it only changes if the server rejects the token.
  const videoUrlRef = useRef({ key: '', url: null });
  const [videoUrlNonce, setVideoUrlNonce] = useState(0);
  const videoRetryRef = useRef('');
  const watermarkText = [user?.name, user?.email].filter(Boolean).join(' · ');
  async function handleVideoSourceError(rawVid) {
    // One retry per lesson + token: fetch a fresh token and rebuild the URL.
    const k = `${rawVid}|${videoUrlNonce}`;
    if (videoRetryRef.current === k) return;
    videoRetryRef.current = k;
    await refreshMediaToken();
    setVideoUrlNonce(n => n + 1);
  }
  const userId = user ? String(user._id || user.id || '') : '';

  useEffect(() => {
    clearGetCache();
    if (!courseId) return;
    let cancelled = false;

    async function load() {
      try {
        const [courseRes, chRes, topRes, statsRes, progRes, quizRes, assignRes, completionRec] = await Promise.all([
          apiServiceHandler('GET', `course/${courseId}`).catch(err => {
            if (isCourseDeletedError(err) && !cancelled) setCourseDeleted(true);
            return null;
          }),
          apiServiceHandler('GET', `chapter/list?courseId=${courseId}`).catch(() => null),
          apiServiceHandler('GET', `topic/list?courseId=${courseId}`).catch(() => null),
          apiServiceHandler('GET', `review/stats?courseId=${courseId}`).catch(() => null),
          apiServiceHandler('GET', `progress/course?courseId=${courseId}`).catch(() => null),
          apiServiceHandler('GET', `quiz-attempt/course?courseId=${courseId}`).catch(() => null),
          // No orgId filter — counts learners assigned this course across every organization
          apiServiceHandler('GET', `course-assignment/list?courseId=${courseId}`).catch(() => null),
          fetchCourseCompletion(courseId),
        ]);
        if (cancelled) return;

        const courseData  = courseRes?.data ?? courseRes;

        // Safety net: if this course requires an aptitude test and the learner
        // hasn't taken it yet (e.g. they navigated here directly by URL, bypassing
        // the course list's "Resume" gating), send them there first.
        const aptitudeSelectedIds = Array.isArray(courseData?.aptitudeSelectedQuestionIds)
          ? courseData.aptitudeSelectedQuestionIds
          : [];
        if (courseData?.aptitudeEnabled && aptitudeSelectedIds.length > 0) {
          const attemptRes = await apiServiceHandler('GET', `aptitude-attempt/list?courseId=${courseId}`).catch(() => null);
          if (cancelled) return;
          const priorAttempts = toArr(attemptRes);
          if (priorAttempts.length === 0) {
            router.replace(`/learner/courses/${courseId}/aptitude-test`);
            return;
          }
        }

        const chapterList = toArr(chRes);
        const topicList   = toArr(topRes);
        const stats       = statsRes?.data ?? statsRes;

        const assignedUserIds = new Set(
          toArr(assignRes)
            .map(a => String(a.userId?._id || a.userId || ''))
            .filter(Boolean)
        );
        setEnrolledCount(assignedUserIds.size);
        const progData    = progRes?.data ?? progRes;

        setCourse(courseData);
        setCompletion(completionRec);
        setChapters(chapterList);
        setTopics(topicList);
        if (stats?.total !== undefined) setReviewStats(stats);
        if (Array.isArray(progData?.topics)) {
          const map = {};
          progData.topics.forEach(p => { map[String(p.topicId)] = p; });
          setProgressMap(map);
        }

        // Build quiz-passed map from historical attempts
        const attempts = toArr(quizRes);
        if (attempts.length > 0) {
          const qmap = {};
          const counts = {};
          attempts.forEach(a => {
            const tid = String(a.topicId?._id || a.topicId || '');
            if (!tid) return;
            counts[tid] = (counts[tid] || 0) + 1;
            if (a.passed) qmap[tid] = true;
          });
          setQuizPassedMap(qmap);
          setQuizAttemptCounts(counts);
        }

        // Homework is done once the server has the learner's submission (a video; older records may have none)
        const activityRes = await apiServiceHandler('GET', `topic-activity/mine?courseId=${courseId}&t=${Date.now()}`).catch(() => null);
        setAssignDoneMap(Object.fromEntries((activityRes?.data || [])
          .filter(a => a.type === 'assignment_done').map(a => [String(a.topicId), a])));

        if (chapterList.length > 0) {
          // Always start on the first chapter (it is always unlocked)
          const firstId     = String(chapterList[0]._id || '');
          setActiveChId(firstId);
          setExpanded({ [firstId]: true });
          const firstTopics = topicList
            .filter(t => String(t.chapterId?._id || t.chapterId || '') === firstId)
            .sort(compareTopics);
          if (firstTopics.length > 0) setActiveTopId(String(firstTopics[0]._id || ''));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [courseId]);

  async function handleVideoProgress({ topicId, courseId: cid, watchedSeconds, durationSeconds, lastPosition }) {
    try {
      const res = await apiServiceHandler('POST', 'progress/update', {
        topicId, courseId: cid, watchedSeconds, durationSeconds, lastPosition,
      });
      const record = res?.data ?? res;
      if (record?.topicId) {
        setProgressMap(prev => ({ ...prev, [String(record.topicId)]: record }));
      }
    } catch { /* silent */ }
  }

  // Fetch notes whenever the active topic changes — runs independently of which tab is open
  useEffect(() => {
    if (!courseId || !activeTopId) return;
    let cancelled = false;
    async function loadNotes() {
      try {
        const params = [`courseId=${courseId}`];
        if (activeChId)  params.push(`chapterId=${activeChId}`);
        if (activeTopId) params.push(`topicId=${activeTopId}`);
        const res = await apiServiceHandler('GET', `note/list?${params.join('&')}`);
        if (!cancelled) setNotes(toArr(res));
      } catch { /* silent */ }
    }
    loadNotes();
    return () => { cancelled = true; };
  }, [courseId, activeChId, activeTopId]);

  // Group topics by chapterId, in the order the admin course builder shows them
  const topicsByChapter = {};
  for (const t of topics) {
    const cid = String(t.chapterId?._id || t.chapterId || '');
    if (!topicsByChapter[cid]) topicsByChapter[cid] = [];
    topicsByChapter[cid].push(t);
  }
  for (const cid of Object.keys(topicsByChapter)) topicsByChapter[cid].sort(compareTopics);

  const activeTopic   = topics.find(t => String(t._id) === activeTopId);
  const activeChapter = chapters.find(c => String(c._id) === activeChId);

  // ── Chapter gating ────────────────────────────────────────────────────────
  function isChapterComplete(chIdx) {
    // A chapter that was never unlocked can't be "complete" — without this, a
    // later locked chapter with no quiz of its own would still count as done
    // (nothing to gate on) and incorrectly cascade to unlock the chapter after
    // it, even though the learner never actually reached it.
    if (!isChapterUnlocked(chIdx)) return false;
    const ch = chapters[chIdx];
    if (!ch) return false;
    const chTopics = topicsByChapter[String(ch._id)] || [];
    // A chapter is complete only once every topic in it is done (lessons
    // watched, quizzes passed, assignments marked done) — passing the quiz
    // alone is not enough. This gates the next chapter and the certificate.
    return chTopics.every(isTopicDone);
  }
  function isChapterUnlocked(chIdx) {
    return chIdx === 0 || isChapterComplete(chIdx - 1);
  }

  // Once every chapter is complete the certificate is earned and the course
  // becomes read-only — no chapter, topic or player interaction is allowed.
  // The certificate is permanent: once the server holds a completion record the
  // course stays complete, even if the admin has since added chapters — those
  // show as inactive for this learner.
  const allChaptersDone = chapters.length > 0
    && chapters.some(ch => (topicsByChapter[String(ch._id)] || []).length > 0)
    && chapters.every((_, i) => isChapterComplete(i));
  const courseFullyComplete = !!completion || allChaptersDone;
  const completedChapterIds = completedChapterIdSet(completion);
  // A chapter the admin added after this learner earned the certificate.
  const isChapterAddedAfterCompletion = (ch) => !!completion && !completedChapterIds.has(String(ch._id));

  // First time every chapter is done: record the certificate on the server.
  const recordingCompletionRef = useRef(false);
  useEffect(() => {
    if (!allChaptersDone || completion || recordingCompletionRef.current || !courseId) return;
    recordingCompletionRef.current = true;
    recordCourseCompletion(courseId).then(rec => {
      if (rec) setCompletion(rec);
      else recordingCompletionRef.current = false; // retry on the next change
    });
  }, [allChaptersDone, completion, courseId]);

  // A finished chapter closes once the learner has moved on to the next one;
  // the last chapter stays open until the whole course is complete.
  function isChapterClosed(chIdx) {
    return chIdx < chapters.length - 1 && isChapterComplete(chIdx);
  }
  // Whether the learner can open this chapter and use its topics right now.
  // Nothing is usable while a quiz is in progress or after the certificate is earned.
  function isChapterInteractive(chIdx) {
    return !courseFullyComplete && !quizInProgress && !remoteQuizActive
      && isChapterUnlocked(chIdx) && !isChapterClosed(chIdx);
  }

  function handleDurationLoad(topicId, secs) {
    if (topicId && secs > 0) setVideoDurMap(prev => ({ ...prev, [topicId]: secs }));
  }

  // ── Topic gating (within a chapter) ───────────────────────────────────────
  // Topics unlock strictly in order: each one opens only after every topic
  // before it in the same chapter is done. A lesson with no video has nothing
  // to watch, and a zoom session has no completion signal, so both count as done.
  function isTopicDone(topic) {
    const topId = String(topic._id);
    const tType = getTopicType(topic);
    if (tType === 'zoom')       return true;
    if (tType === 'quiz')       return quizPassedMap[topId] === true;
    if (tType === 'assignment') return isAssignmentDone(assignDoneMap[topId]);
    if (!topic.videoUrl)        return true;
    return progressMap[topId]?.completed === true;
  }
  function isTopicUnlocked(chIdx, topId) {
    if (!isChapterUnlocked(chIdx)) return false;
    const ch = chapters[chIdx];
    if (!ch) return false;
    const chTopics = topicsByChapter[String(ch._id)] || [];
    const idx = chTopics.findIndex(t => String(t._id) === String(topId));
    if (idx === -1) return false;
    return chTopics.slice(0, idx).every(isTopicDone);
  }

  function handleQuizPass(topicId) {
    setQuizPassedMap(prev => ({ ...prev, [topicId]: true }));
  }

  function handleQuizAttempt(topicId) {
    setQuizAttemptCounts(prev => ({ ...prev, [topicId]: (prev[topicId] || 0) + 1 }));
  }

  // After the learner's video upload: it now waits for review — nothing completes or moves on yet.
  function handleAssignmentSubmitted(topicId, saved) {
    setAssignDoneMap(prev => ({ ...prev, [topicId]: saved || prev[topicId] || { topicId } }));
  }

  // What comes after this topic: another topic in the chapter, the next chapter, or nothing.
  function nextStepLabel(topicId) {
    const chIdx = chapters.findIndex(c => String(c._id) === activeChId);
    if (chIdx === -1) return null;
    const chTopics = topicsByChapter[String(chapters[chIdx]._id)] || [];
    const idx = chTopics.findIndex(t => String(t._id) === String(topicId));
    if (idx !== -1 && idx + 1 < chTopics.length) return 'Continue';
    return chIdx + 1 < chapters.length ? 'Continue Next Chapter' : null;
  }

  // While the open assignment waits for review, check back for the reviewer's decision
  // (every 20 s and when the learner returns to the tab) so it updates without a reload.
  const openAssignRec = activeTopic && getTopicType(activeTopic) === 'assignment' ? assignDoneMap[String(activeTopic._id)] : null;
  const awaitingReview = Boolean(openAssignRec?.submission || openAssignRec?.videos?.length) && !isAssignmentDone(openAssignRec) && openAssignRec?.review?.status !== 'reupload';
  useEffect(() => {
    if (!awaitingReview || !courseId) return undefined;
    let stopped = false;
    const refresh = () => apiServiceHandler('GET', `topic-activity/mine?courseId=${courseId}&t=${Date.now()}`)
      .then(res => {
        if (stopped || !Array.isArray(res?.data)) return;
        setAssignDoneMap(Object.fromEntries(res.data.filter(a => a.type === 'assignment_done').map(a => [String(a.topicId), a])));
      })
      .catch(() => {});
    const timer = setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [awaitingReview, courseId]);

  function handleVideoEnded(topicId) {
    // Mark the lesson done locally right away so the next topic unlocks
    // without waiting for the progress request to round-trip.
    setProgressMap(prev => ({
      ...prev,
      [topicId]: { ...(prev[topicId] || {}), topicId, completed: true, percentage: 100 },
    }));
    setPendingAdvanceFrom(topicId);
  }

  function toggleChapter(chIdx, chId) {
    if (!isChapterInteractive(chIdx)) return;
    setExpanded(prev => ({ ...prev, [chId]: !prev[chId] }));
  }

  // Sidebar play icon: plays the lesson (toggles if it's already the current one).
  // Quizzes and lesson videos are mutually exclusive in the sidebar: with a
  // quiz open (here or in another tab) the lesson links are disabled, and with
  // a lesson video open (or playing elsewhere) the quiz links are. Moving on
  // via Continue / auto-advance goes through selectTopic and isn't affected.
  function sidebarBlockReason(topic) {
    if (String(topic._id) === activeTopId) return null;
    const tType      = getTopicType(topic);
    const activeType = getTopicType(activeTopic);
    if (tType === 'lesson' && (activeType === 'quiz' || remoteQuizActive)) {
      return 'A quiz is open — lesson videos are disabled';
    }
    if (tType === 'quiz' && (activeType === 'lesson' || remoteVideoActive)) {
      return 'A lesson video is open — quizzes are disabled';
    }
    return null;
  }

  function handleSidebarTopicClick(chIdx, chId, topic) {
    if (sidebarBlockReason(topic)) return;
    if (String(topic._id) !== activeTopId) setReturnToQuiz(null);
    selectTopic(chIdx, chId, String(topic._id));
  }

  function handleTopicPlayClick(e, chIdx, chId, topic) {
    e.stopPropagation();
    const topId = String(topic._id);
    if (sidebarBlockReason(topic)) return;
    if (!isChapterInteractive(chIdx) || !isTopicUnlocked(chIdx, topId)) return;
    const isCurrent = topId === activeTopId;
    if (!isCurrent) { setReturnToQuiz(null); selectTopic(chIdx, chId, topId); }
    if (getTopicType(topic) === 'lesson') {
      setPlayCommand(c => ({ n: c.n + 1, topicId: topId, toggle: isCurrent, at: Date.now() }));
    }
  }

  function selectTopic(chIdx, chId, topId) {
    if (!isChapterInteractive(chIdx)) return;
    if (!isTopicUnlocked(chIdx, topId)) return;
    setActiveChId(chId);
    setActiveTopId(topId);
    setPlaying(false);
    setVideoPlaying(false);
    setExpanded(prev => ({ ...prev, [chId]: true }));
  }

  // Moves to the next topic in the current chapter, or to the first topic of
  // the next chapter once this one runs out (selectTopic still enforces the
  // chapter lock, so a not-yet-passed quiz blocks crossing into it).
  // The lesson a quiz tests: the nearest lesson before it in its chapter,
  // else the chapter's first lesson. null when the chapter has no lesson.
  function lessonForQuiz(quizTopId) {
    const chIdx = chapters.findIndex(c => (topicsByChapter[String(c._id)] || []).some(t => String(t._id) === quizTopId));
    if (chIdx === -1) return null;
    const chId     = String(chapters[chIdx]._id);
    const chTopics = topicsByChapter[chId] || [];
    const qIdx     = chTopics.findIndex(t => String(t._id) === quizTopId);
    const before   = chTopics.slice(0, qIdx).reverse().find(t => getTopicType(t) === 'lesson');
    const lesson   = before || chTopics.find(t => getTopicType(t) === 'lesson');
    return lesson ? { chIdx, chId, lessonId: String(lesson._id) } : null;
  }

  // "Watch Lesson" on a quiz: open and play its lesson; when the video ends
  // the pending-advance effect brings the learner back to the quiz.
  function watchLessonForQuiz(quizTopId) {
    const target = lessonForQuiz(quizTopId);
    if (!target) return;
    setReturnToQuiz({ chIdx: target.chIdx, chId: target.chId, topId: quizTopId });
    selectTopic(target.chIdx, target.chId, target.lessonId);
    setPlayCommand(c => ({ n: c.n + 1, topicId: target.lessonId, toggle: false, at: Date.now() }));
  }

  function advanceToNextTopic(fromTopicId) {
    const chIdx = chapters.findIndex(c => String(c._id) === activeChId);
    if (chIdx === -1) return;
    const chId = String(chapters[chIdx]._id);
    const chTopics = topicsByChapter[chId] || [];
    const idx = chTopics.findIndex(t => String(t._id) === String(fromTopicId));

    if (idx !== -1 && idx + 1 < chTopics.length) {
      selectTopic(chIdx, chId, String(chTopics[idx + 1]._id));
      return;
    }

    const nextChIdx = chIdx + 1;
    if (nextChIdx >= chapters.length) return;
    const nextChId = String(chapters[nextChIdx]._id);
    const nextChTopics = topicsByChapter[nextChId] || [];
    if (nextChTopics.length > 0) {
      selectTopic(nextChIdx, nextChId, String(nextChTopics[0]._id));
    }
  }

  // Completing a topic updates the maps that gate the next one; advancing in the
  // same handler would read the pre-update state and find the next topic still
  // locked, so the move happens here, after the update has rendered.
  useEffect(() => {
    if (!pendingAdvanceFrom) return;
    if (returnToQuiz) {
      // The lesson was opened from a quiz's "Watch Lesson" — go back to that quiz.
      selectTopic(returnToQuiz.chIdx, returnToQuiz.chId, returnToQuiz.topId);
      setReturnToQuiz(null);
    } else {
      advanceToNextTopic(pendingAdvanceFrom);
    }
    setPendingAdvanceFrom(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAdvanceFrom]);

  // A quiz running in this tab: the lock reported by the server/other tabs is
  // our own, so ignore it while the quiz runs and clear it the moment it ends
  // (otherwise "Continue" would stay blocked until the next poll).
  // A quiz starting in another tab/device rewinds this tab's lesson video.
  const prevRemoteQuizRef = useRef(false);
  useEffect(() => {
    if (remoteQuizActive && !prevRemoteQuizRef.current) setVideoResetSignal(n => n + 1);
    prevRemoteQuizRef.current = remoteQuizActive;
  }, [remoteQuizActive]);

  function handleQuizActiveChange(active) {
    ownQuizActiveRef.current = active;
    setQuizInProgress(active);
    if (!active) setRemoteQuizActive(false);
  }

  // While a lesson video plays here, hold the video lock so this course's
  // quizzes can't be started in another tab or on another device.
  const lessonPlaying = videoPlaying && !!activeTopId && getTopicType(activeTopic) === 'lesson';
  useEffect(() => {
    if (!lessonPlaying || !courseId) return;
    const beat = () => apiServiceHandler('POST', 'quiz-attempt/video-lock', { courseId, topicId: activeTopId, ownerId: TAB_ID })
      .catch(() => { /* next heartbeat retries */ });
    beat();
    broadcastLock('video', courseId, true);
    const iv = setInterval(beat, QUIZ_LOCK_HEARTBEAT_MS);
    return () => {
      clearInterval(iv);
      apiServiceHandler('POST', 'quiz-attempt/video-unlock', { courseId, ownerId: TAB_ID })
        .catch(() => { /* the lock lapses on its own without heartbeats */ });
      broadcastLock('video', courseId, false);
    };
  }, [lessonPlaying, courseId, activeTopId]);

  // Watch for a quiz / a lesson video running in another tab or on another device.
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    async function check() {
      if (ownQuizActiveRef.current) return;
      try {
        const { quiz, video } = await fetchCourseLocks(courseId);
        if (cancelled || ownQuizActiveRef.current) return;
        setRemoteQuizActive(quiz);
        setRemoteVideoActive(video);
      } catch { /* keep the last known state */ }
    }
    check();
    const iv = setInterval(check, QUIZ_LOCK_POLL_MS);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    let ch = null;
    try {
      ch = new BroadcastChannel(QUIZ_LOCK_CHANNEL);
      ch.onmessage = e => {
        const msg = e.data || {};
        if (String(msg.courseId) !== String(courseId) || msg.ownerId === TAB_ID) return;
        if (msg.kind === 'video') {
          setRemoteVideoActive(!!msg.active);
        } else if (!ownQuizActiveRef.current) {
          setRemoteQuizActive(!!msg.active);
        }
      };
    } catch { /* unsupported — polling covers it */ }

    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      ch?.close();
    };
  }, [courseId]);

  // On first load, open the learner's current chapter (the first unfinished
  // one) at its first unfinished topic — finished chapters are closed, so
  // landing on chapter 1 would leave a returning learner on a locked chapter.
  const placedOnCurrentRef = useRef(false);
  useEffect(() => {
    if (loading || placedOnCurrentRef.current || chapters.length === 0) return;
    placedOnCurrentRef.current = true;
    if (completion) return; // certificate earned — nothing left to resume
    const chIdx = chapters.findIndex((_, i) => !isChapterComplete(i));
    if (chIdx <= 0) return; // chapter 1 is already selected, or the course is complete
    const chId = String(chapters[chIdx]._id);
    const chTopics = topicsByChapter[chId] || [];
    const target = chTopics.find(t => !isTopicDone(t)) || chTopics[0];
    setActiveChId(chId);
    setExpanded({ [chId]: true });
    if (target) setActiveTopId(String(target._id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, chapters]);

  if (loading) {
    return <div className={s.loadingWrap}><div className={s.spinner}/></div>;
  }
  if (!course) {
    return (
      <div className={s.errorWrap}>
        <p role={courseDeleted ? 'alert' : undefined}>{courseDeleted ? COURSE_DELETED_NOTE : 'Course not found.'}</p>
        <button className={s.backBtn} onClick={() => router.push('/learner/courses')}>
          {BackArrow} Back to Courses
        </button>
      </div>
    );
  }

  const imgSrc    = course.course_image ? `${API_URL}${course.course_image}` : null;
  const totalDur  = `${course.duration_hr || 0}h ${course.duration_min || 0}m`;

  const videoTopics = topics.filter(t => t.video_type === 'lesson' || !t.video_type);
  const progValues  = videoTopics.map(t => progressMap[String(t._id)]);
  const totalProgDur = progValues.reduce((s, p) => s + (p?.durationSeconds || 0), 0);
  const totalWatched = progValues.reduce((s, p) => s + Math.min(p?.watchedSeconds || 0, p?.durationSeconds || 0), 0);
  // A completed course (certificate earned) always reports full video progress.
  const overallPercent = courseFullyComplete ? 100
    : totalProgDur > 0 ? Math.min(100, Math.round((totalWatched / totalProgDur) * 100)) : 0;
  const topicType = getTopicType(activeTopic);
  const watchTitle = activeTopic ? activeTopic.title : course.title;
  const watchKind = topicType === 'quiz' ? 'Quiz' : topicType === 'lesson' ? 'Lesson' : activeTopic ? 'Topic' : 'Course';
  return (
    <div className={s.page}>
      <button className={s.backBtn} onClick={() => router.push('/learner/courses')}>
        {BackArrow} Back to Courses
      </button>

      {/* Breadcrumb */}
      <div className={s.breadcrumb}>
        <span className={s.breadItem}>My Courses</span>
        <span className={s.breadSep}>/</span>
        <span className={s.breadItem}>{course.title}</span>
        {activeTopic && (
          <>
            <span className={s.breadSep}>/</span>
            <span className={s.breadCurrent}>{activeTopic.title}</span>
          </>
        )}
      </div>

      {courseFullyComplete && (
        <div className={s.certBanner}>
          <span className={s.certBannerText}>
            🎉 Congratulations! You&apos;ve completed every chapter and quiz in this course.
          </span>
          <button
            className={s.certBannerBtn}
            onClick={() => router.push(`/learner/certificate?courseId=${courseId}`)}
          >
            View Certificate
          </button>
        </div>
      )}

      <div className={s.layout}>
        {/* ── Left: header (bare) → stats (bare) → content card → tabs card ── */}
        <div className={s.mainCol}>

          {/* Header — no background div */}
          <div className={s.watchHead}>
            <span className={s.watchKind}>{watchKind}{activeChapter?.title ? ` · ${activeChapter.title}` : ''}</span>
            <h1 className={s.watchTitle}>{watchTitle}</h1>
          </div>

          {/* Stats — no outer background div; individual stat items keep their own boxes */}
          <div className={s.statsRow}>
            {reviewStats.total > 0 && (
              <div className={s.stat}>
                <span className={s.statStarIcon}>{Icon.star}</span>
                <span className={s.statVal}>{reviewStats.avgRating}</span>
                <span className={s.statLbl}>{reviewStats.total} {reviewStats.total === 1 ? 'Rating' : 'Ratings'}</span>
              </div>
            )}
            <div className={s.stat}>
              <span className={s.statIcon}>{Icon.users}</span>
              <span className={s.statVal}>{enrolledCount.toLocaleString()}</span>
              <span className={s.statLbl}>Students Enrolled</span>
            </div>
            <div className={s.stat}>
              <span className={s.statIcon}>{Icon.clock}</span>
              <span className={s.statVal}>{totalDur}</span>
              <span className={s.statLbl}>Total Duration</span>
            </div>
            <div className={s.stat}>
              <span className={s.statIcon}>{Icon.calendar}</span>
              <span className={s.statVal}>{timeAgo(course.updatedAt)}</span>
              <span className={s.statLbl}>Last Updated</span>
            </div>
          </div>

          {/* Content — video / zoom / quiz / assignment — its own background card */}
          <div className={`${s.contentCard} ${courseFullyComplete ? s.readOnly : ''}`}
            aria-disabled={courseFullyComplete || undefined}>
            {topicType === 'zoom'       && activeTopic && (
              <ZoomPanel topic={activeTopic} courseId={courseId} onContinue={() => advanceToNextTopic(activeTopId)}/>
            )}
            {topicType === 'quiz'       && activeTopic && (
              <QuizPanel
                key={activeTopId}
                topic={activeTopic}
                chapterTitle={activeChapter?.title}
                onQuizPass={handleQuizPass}
                onQuizAttempt={handleQuizAttempt}
                attemptCount={quizAttemptCounts[activeTopId] || 0}
                isPassed={quizPassedMap[activeTopId] === true}
                onContinue={() => advanceToNextTopic(activeTopId)}
                onActiveChange={handleQuizActiveChange}
                videoBlocked={remoteVideoActive}
                onWatchLesson={lessonForQuiz(activeTopId) ? () => watchLessonForQuiz(activeTopId) : undefined}
                onVideoConflict={() => setRemoteVideoActive(true)}
              />
            )}
            {topicType === 'assignment' && activeTopic && (
              <AssignmentPanel
                key={String(activeTopic._id)}
                topic={activeTopic}
                courseId={courseId}
                record={assignDoneMap[String(activeTopic._id)] || null}
                onSubmitted={handleAssignmentSubmitted}
                continueLabel={nextStepLabel(activeTopic._id)}
                onContinue={() => advanceToNextTopic(String(activeTopic._id))}
              />
            )}
            {topicType === 'lesson' && activeTopic?.videoStatus === 'processing' && (
              // The uploaded video is being converted to a format every browser plays.
              <div className={s.videoPreparing} role="status">
                <span className={s.videoPreparingTitle}>This video is being prepared</span>
                <span className={s.videoPreparingText}>
                  It will be ready to watch in a few minutes. Please refresh the page later.
                </span>
              </div>
            )}
            {topicType === 'lesson' && activeTopic?.videoStatus === 'failed' && (
              // Conversion failed: the stored file may not play in this browser.
              <div className={s.videoPreparing} role="alert">
                <span className={s.videoPreparingTitle}>This video is not available right now</span>
                <span className={s.videoPreparingText}>
                  Please check back later, or contact your instructor if this continues.
                </span>
              </div>
            )}
            {(topicType === 'lesson' || !activeTopic) && !['processing', 'failed'].includes(activeTopic?.videoStatus) && (() => {
              const rawVid   = activeTopic?.videoUrl || '';
              const urlKey   = `${rawVid}|${videoUrlNonce}`;
              if (videoUrlRef.current.key !== urlKey || !videoUrlRef.current.url) {
                videoUrlRef.current = { key: urlKey, url: secureMediaUrl(rawVid, mediaToken) };
              }
              const videoSrc = rawVid ? videoUrlRef.current.url : null;
              const topProg  = progressMap[activeTopId];
              return (
                <VideoPlayer
                  videoSrc={videoSrc}
                  imgSrc={imgSrc}
                  isPlaying={playing}
                  onToggle={() => setPlaying(p => !p)}
                  onPlayStateChange={setVideoPlaying}
                  topicId={activeTopId}
                  courseId={courseId}
                  savedPosition={topProg?.lastPosition}
                  onProgress={handleVideoProgress}
                  onDurationLoad={handleDurationLoad}
                  isCompleted={topProg?.completed === true}
                  serverPct={topProg?.percentage ?? 0}
                  onVideoEnded={() => handleVideoEnded(activeTopId)}
                  playCommand={playCommand}
                  courseCompleted={courseFullyComplete}
                  resetSignal={videoResetSignal}
                  watermark={watermarkText}
                  onSourceError={() => handleVideoSourceError(rawVid)}
                />
              );
            })()}
          </div>

          {/* Tabs — its own background card. Hidden entirely for quiz topics (no tabs, no reviews). */}
          {activeTopic?.video_type !== 'quiz' && (
            <div className={s.tabsPanel}>
              <div className={s.tabBar}>
                {['overview', 'note', 'reviews'].map(tab => (
                  <button key={tab}
                    className={`${s.tabBtn} ${activeTab === tab ? s.tabActive : ''}`}
                    onClick={() => setActiveTab(tab)}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <div className={s.tabContent}>
                {activeTab === 'overview' && <OverviewTab course={course} chapter={activeChapter}/>}
                {activeTab === 'note'     && <NoteTab courseId={courseId} chapterId={activeChId} topicId={activeTopId} topicTitle={activeTopic?.title} notes={notes} setNotes={setNotes}/>}
                {activeTab === 'reviews'  && <ReviewsTab enableReview={course?.enable_review !== false} courseId={courseId} chapterId={activeChId}/>}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: chapters ── */}
        <aside className={s.aside}>
          <div className={s.progressLabel}>
            My Progress
            {videoTopics.length > 0 && (
              <span className={s.progressPct} style={{ color: overallPercent >= 80 ? '#16a34a' : '#6b7280' }}>
                {overallPercent}%
              </span>
            )}
          </div>
          {videoTopics.length > 0 && (
            <div className={s.progressBarWrap}>
              <div className={s.progressBarTrack}>
                <div className={s.progressBarFill} style={{ width: `${overallPercent}%` }}/>
              </div>
            </div>
          )}
          <h2 className={s.chaptersHeading}>Course Chapters</h2>
          <div className={s.chapterList}>
            {chapters.length > 0 ? chapters.map((ch, idx) => {
              const chId      = String(ch._id || '');
              const isActive  = chId === activeChId;
              const chTopics  = topicsByChapter[chId] || [];
              const topCount  = chTopics.length || Number(ch.totalTopics || 0);
              const dur       = ch.duration || (topCount > 0 ? `${topCount * 4}:00 min` : null);
              const unlocked  = isChapterUnlocked(idx);
              const chDone    = isChapterComplete(idx);
              // Shown locked and collapsed: not reached yet, finished and left
              // behind, or the whole course is complete (certificate earned).
              const chLocked  = !unlocked || isChapterClosed(idx) || courseFullyComplete;
              // Still listed, but nothing can be clicked while a quiz is running.
              const chReadOnly = !chLocked && (quizInProgress || remoteQuizActive);
              const isOpen    = !chLocked && !!expanded[chId];
              const addedLater = isChapterAddedAfterCompletion(ch);
              const lockTitle = addedLater ? 'Added after you completed this course — not available'
                              : courseFullyComplete ? 'Course completed'
                              : isChapterClosed(idx) ? 'Chapter completed'
                              : !unlocked ? 'Complete the previous chapter to unlock' : undefined;

              return (
                <div key={chId || idx}
                  className={`${s.chapterCard} ${isActive && !chLocked ? s.chapterActive : ''} ${chLocked ? s.chapterLocked : ''} ${chReadOnly ? s.readOnly : ''}`}
                  title={lockTitle}>
                  <div className={s.chapterHeader} onClick={() => toggleChapter(idx, chId)}>
                    {chLocked && (
                      <span className={s.chLeadLockIcon}>{Icon.lock}</span>
                    )}
                    <div className={s.chInfo}>
                      <span className={s.chTitle}>
                        Ch {idx + 1} &ndash; {ch.title || `Chapter ${idx + 1}`}
                      </span>
                      {addedLater && <span className={s.chAddedLaterTag}>Added after completion</span>}
                      {(topCount > 0 || dur) && (
                        <span className={s.chMeta}>
                          {topCount > 0 ? `${topCount} topics` : ''}
                          {topCount > 0 && dur ? ' · ' : ''}
                          {dur || ''}
                        </span>
                      )}
                    </div>
                    {chLocked ? (
                      <button className={s.chActiveBtn} disabled onClick={e => e.stopPropagation()}>
                        {addedLater ? 'Inactive' : (chDone || courseFullyComplete || isChapterClosed(idx)) ? 'Completed' : 'Locked'}
                      </button>
                    ) : (
                      <span className={s.chevronBox}>
                        {chDone ? (
                          <span className={s.chDoneIcon}>{Icon.check}</span>
                        ) : (
                          <span style={{ display:'flex', width:14, height:14, transition:'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                            {Icon.chevDown}
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {isOpen && (
                    <div className={s.topicList}>
                      {chTopics.length === 0 && (
                        <p className={s.noTopicsNote}>No topics in this chapter yet.</p>
                      )}
                      {chTopics.map(topic => {
                        const topId  = String(topic._id || '');
                        const isCurr = topId === activeTopId;
                        const tType  = getTopicType(topic);
                        const topDur = fmtSecs(videoDurMap[topId]) || fmtDur(topic.duration_hr, topic.duration_min, topic.duration_sec);
                        const prog   = progressMap[topId];
                        const pct    = prog?.percentage ?? 0;
                        const topicDone   = isTopicDone(topic);
                        const topicLocked = !isTopicUnlocked(idx, topId);
                        const blockReason = topicLocked ? null : sidebarBlockReason(topic);
                        const playable    = tType === 'lesson' && !topicLocked && !blockReason && !courseFullyComplete;
                        return (
                          <div key={topId}
                            className={`${s.topicRow} ${isCurr ? s.topicActive : ''} ${topicLocked ? s.topicLocked : ''} ${blockReason ? s.topicBlocked : ''}`}
                            title={courseFullyComplete ? 'Course completed — read only'
                                 : topicLocked ? 'Complete the previous topic to unlock'
                                 : blockReason || undefined}
                            aria-disabled={topicLocked || !!blockReason || undefined}
                            onClick={() => handleSidebarTopicClick(idx, chId, topic)}>
                            <span
                              className={`${s.topicPlayIcon} ${s['topicIcon__' + tType] || ''} ${playable ? s.topicPlayClickable : ''}`}
                              onClick={e => handleTopicPlayClick(e, idx, chId, topic)}
                              title={playable ? (isCurr && videoPlaying ? 'Pause' : 'Play') : undefined}>
                              {topicLocked
                                ? <span className={s.topicLockIcon}>{Icon.lock}</span>
                                : topicDone && tType !== 'lesson'
                                  ? <span className={s.topicDoneCheck}>{Icon.check}</span>
                                  : getTopicIcon(topic, isCurr && videoPlaying)
                              }
                            </span>
                            <div className={s.topicInfo}>
                              <span className={s.topicName}>{topic.title}</span>
                              {topDur && <span className={s.topicDur}>{topDur}</span>}
                              {tType === 'lesson' && pct > 0 && !topicDone && (
                                <div className={s.topicProgressMini}>
                                  <div className={s.topicProgressFill} style={{ width: `${pct}%` }}/>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }) : (
              /* No chapters yet — show course details instead */
              <div className={s.courseInfoFallback}>
                {course.desc && (
                  <div className={s.fallbackBlock}>
                    <p className={s.fallbackLabel}>About This Course</p>
                    <p className={s.fallbackText}>{course.desc}</p>
                  </div>
                )}
                {course.what_will_learn && (
                  <div className={s.fallbackBlock}>
                    <p className={s.fallbackLabel}>What You&apos;ll Learn</p>
                    <p className={s.fallbackText}>{course.what_will_learn}</p>
                  </div>
                )}
                <div className={s.fallbackStats}>
                  <div className={s.fallbackStatRow}>
                    <span className={s.fallbackStatIcon}>{Icon.clock}</span>
                    <span className={s.fallbackStatTxt}>{totalDur} total duration</span>
                  </div>
                  {Number(course.max_students || 0) > 0 && (
                    <div className={s.fallbackStatRow}>
                      <span className={s.fallbackStatIcon}>{Icon.users}</span>
                      <span className={s.fallbackStatTxt}>{Number(course.max_students).toLocaleString()} students enrolled</span>
                    </div>
                  )}
                  <div className={s.fallbackStatRow}>
                    <span className={s.fallbackStatIcon}>{Icon.calendar}</span>
                    <span className={s.fallbackStatTxt}>Last updated {timeAgo(course.updatedAt)}</span>
                  </div>
                </div>
                <p className={s.noChaptersNote}>Chapters will appear here once added by your instructor.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
