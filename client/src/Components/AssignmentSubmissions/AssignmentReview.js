'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../service/apiService';
import { loadSubmissionVideo, formatBytes, formatDayDate, videoComments, pauseOtherVideos } from '../../lib/assignmentSubmission';
import q from '../StoreOwner/QuizResult/QuizResult.module.css';
import s from './AssignmentReview.module.css';

// Homework review for one organization (super admin: any organization; store owner: their own —
// the server enforces this): pick a learner, course and chapter, watch every video the learner
// uploaded (free seeking) and comment on each one, then give the final review: Approved
// (complete — locked from then on) or Rejected (the learner is emailed and must upload again).

const toArr = res => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : []);
const fmtDateTime = d => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const learnerName = l => l?.name || l?.fullName || `${l?.firstName || ''} ${l?.lastName || ''}`.trim() || 'Learner';

const STATUS = {
  approved: { label: 'Approved', cls: 'pillGood' },
  reupload: { label: 'Rejected', cls: 'pillWarn' },
  pending: { label: 'Waiting for review', cls: 'pillInfo' },
  none: { label: 'Not submitted', cls: 'pillMuted' },
};
const statusOf = item => (item.review?.status || (item.submission ? 'pending' : 'none'));

const BackArrow = <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>;
const Chevron = <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;

/** Video `n` of the submission with normal controls: play, pause, seek and drag freely. */
function ReviewVideo({ recordId, n }) {
  const [state, setState] = useState({ id: null, url: '', error: '' });
  const key = `${recordId}#${n}`;
  useEffect(() => {
    if (!recordId) return undefined;
    let cancelled = false;
    let url = '';
    loadSubmissionVideo(recordId, n)
      .then(u => { url = u; if (!cancelled) setState({ id: key, url: u, error: '' }); else URL.revokeObjectURL(u); })
      .catch(err => { if (!cancelled) setState({ id: key, url: '', error: err.message }); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [recordId, n, key]);
  if (state.id !== key) return <div className={s.videoBox}><p className={s.videoNote}>Loading video…</p></div>;
  if (state.error) return <div className={s.videoBox}><p className={s.videoError}>{state.error}</p></div>;
  return <div className={s.videoBox}><video className={s.video} src={state.url} controls playsInline preload="metadata" controlsList="nodownload noplaybackrate noremoteplayback" disablePictureInPicture onPlay={pauseOtherVideos} /></div>;
}

/** "TCS-TSM" → "TT", "Koushik Rudra" → "KR" */
const initials = (name) => (String(name || 'R').split(/[\s\-_.]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('') || 'R').toUpperCase();

/** One uploaded video: player (free seeking), its comments, and a box to add a comment. */
function VideoReviewItem({ recordId, video, latest, locked, canReview, learnerId, topicId, onSaved }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  // Newest comment first, oldest last
  const comments = videoComments(video).filter(cm => cm.note).reverse();

  async function saveComment() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await apiServiceHandler('POST', 'topic-activity/video-comment', { userId: learnerId, topicId, video: video.n, note });
      toast.success(res?.message || 'Comment saved.');
      setNote('');
      onSaved(res?.data);
    } catch (err) {
      toast.warning(err?.response?.data?.message || 'Could not save the comment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className={`${s.vItem} ${latest ? s.vItemLatest : ''}`}>
      <ReviewVideo recordId={recordId} n={video.n} />
      <div className={s.vBody}>
        <div className={s.vHead}>
          <div className={s.vTitleRow}>
            <span className={s.vNum}>Video {video.n}</span>
            {latest && <span className={s.vLatest}>Latest</span>}
          </div>
          <span className={s.vDate}>{fmtDateTime(video.uploadedAt)}</span>
        </div>
        <div className={s.vFile} title={video.originalName}>
          <svg className={s.vFileIcon} viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="2.5" /><path d="M16 10.5 21 7.5v9l-5-3" /></svg>
          <span className={s.vFileName}>{video.originalName || `Video ${video.n}`}</span>
          <span className={s.vSize}>{formatBytes(video.size)}</span>
        </div>

        {(comments.length > 0 || !locked) && (
          <div className={s.vCmts}>
            <h5 className={s.vCmtsTitle}>Comments <span className={s.vCount}>{comments.length}</span></h5>
            {comments.length > 0 ? (
              <ul className={s.cmts} aria-label={`Comments on Video ${video.n}`}>
                {comments.map((cm, i) => (
                  <li key={i} className={s.cmtsItem}>
                    <span className={s.cmtsAvatar} aria-hidden="true">{initials(cm.reviewerName)}</span>
                    <div className={s.cmtsBody}>
                      <span className={s.cmtsHead}>
                        Comment <em>by</em> <strong>{cm.reviewerName || 'Reviewer'}</strong>{cm.reviewedAt && <> <em>on</em> {formatDayDate(cm.reviewedAt)}</>}
                      </span>
                      <p className={s.cmtsText}>{cm.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className={s.versionNoComment}>No comment on this video yet.</p>}
            {/* Comment box — only where the page allows reviewing (hidden for store owners) */}
            {!locked && canReview && (
              <div className={s.vComposer}>
                <label className={s.srOnly} htmlFor={`cm-${topicId}-${video.n}`}>Comment on Video {video.n}</label>
                <textarea id={`cm-${topicId}-${video.n}`} value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1000}
                  placeholder={comments.length ? 'Add another comment on this video…' : 'Comment on this video…'} />
                <div className={s.vComposerBar}>
                  <span className={s.vChars}>{note.length}/1000</span>
                  <button type="button" className={s.commentBtn} onClick={saveComment} disabled={saving || !note.trim()}>
                    {saving ? 'Saving…' : 'Add comment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** One assignment: every video with its comment, then the final Approved / Rejected review. */
function AssignmentCard({ item, learnerId, learner, canReview, onSaved }) {
  const current = statusOf(item);
  const locked = current === 'approved';
  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const videos = Array.isArray(item.videos) ? item.videos : [];
  const hasVideo = videos.length > 0;
  const st = STATUS[current];
  const groupName = `review-${item.topicId}`;
  const topicId = String(item.topicId);

  async function submitReview() {
    if (!choice || (choice === 'reupload' && !hasVideo)) return;
    setSaving(true);
    try {
      const res = await apiServiceHandler('POST', 'topic-activity/review', { userId: learnerId, topicId, status: choice, note });
      toast.success(res?.message || 'Saved.');
      setChoice(''); setNote('');
      onSaved(item.topicId, res?.data);
    } catch (err) {
      toast.warning(err?.response?.data?.message || 'Could not save the review.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={s.card} aria-labelledby={`asg-${item.topicId}`}>
      <div className={s.cardHead}>
        <div className={s.cardHeadText}>
          <h3 id={`asg-${item.topicId}`} className={s.cardTitle}>{item.title}</h3>
          <p className={s.cardMeta}>
            {hasVideo
              ? <>{videos.length} video{videos.length === 1 ? '' : 's'} uploaded · latest {fmtDateTime(videos[videos.length - 1].uploadedAt)}</>
              : `${learnerName(learner)} hasn't uploaded a video for this assignment yet.`}
          </p>
        </div>
        <span className={`${s.pill} ${s[st.cls]}`}>{st.label}</span>
      </div>

      <div className={s.cardInner}>
        {locked && (
          <div className={s.lockedNote} role="status">
            <strong>Approved</strong>
            <span>{item.review?.reviewerName || 'A reviewer'} approved this assignment on {fmtDateTime(item.review?.reviewedAt)} — it can no longer be changed.</span>
            {item.review?.note && <span className={s.lockedNoteText}>“{item.review.note}”</span>}
          </div>
        )}

        {/* ── Every uploaded video, each with its own comment ── */}
        {hasVideo ? (
          <ul className={s.vGrid}>
            {[...videos].reverse().map(v => (
              <VideoReviewItem key={v.n} recordId={String(item.recordId)} video={v} latest={v.n === videos.length}
                locked={locked} canReview={canReview} learnerId={learnerId} topicId={topicId} onSaved={rec => onSaved(item.topicId, rec)} />
            ))}
          </ul>
        ) : (
          <div className={`${s.videoBox} ${s.videoEmpty}`}><p className={s.videoNote}>No video uploaded</p></div>
        )}

        {/* ── Final review (after all the videos) — not shown once approved, nor where reviewing is off ── */}
        {!locked && canReview && (
          <div className={s.finalReview}>
            <h4 className={s.finalTitle}>Final review</h4>
            {current === 'reupload' && item.review?.reviewedAt && (
              <p className={s.lastReview}>
                Last decision: Rejected · {item.review.reviewerName || 'Reviewer'} · {fmtDateTime(item.review.reviewedAt)}
                {item.review.note ? ` — “${item.review.note}”` : ''}. The learner has been asked to upload again.
              </p>
            )}
            <fieldset className={s.choicesRow}>
              <legend className={s.srOnly}>Final review</legend>
              <label className={`${s.choice} ${choice === 'approved' ? s.choiceOn : ''}`}>
                <input type="radio" name={groupName} value="approved" checked={choice === 'approved'} onChange={() => setChoice('approved')} />
                <span>
                  <strong>Approved</strong>
                  <small>The assignment is complete{hasVideo ? '' : ' (even without a video)'}. It can’t be changed afterwards.</small>
                </span>
              </label>
              <label className={`${s.choice} ${s.choiceReject} ${choice === 'reupload' ? s.choiceOn : ''} ${hasVideo ? '' : s.choiceOff}`}>
                <input type="radio" name={groupName} value="reupload" checked={choice === 'reupload'} disabled={!hasVideo} onChange={() => setChoice('reupload')} />
                <span>
                  <strong>Rejected</strong>
                  <small>{hasVideo ? 'The learner is notified and must upload the video again.' : 'Available once the learner has uploaded a video.'}</small>
                </span>
              </label>
            </fieldset>
            <label className={s.noteField}>
              <span>Note for the learner {choice === 'reupload' ? '(what to fix)' : '(optional)'}</span>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000}
                placeholder={choice === 'reupload' ? 'e.g. The audio is missing — please record again with sound.' : 'e.g. Well done!'} />
            </label>
            <div className={s.actions}>
              <button type="button" className={s.saveBtn} onClick={submitReview} disabled={saving || !choice || (choice === 'reupload' && !hasVideo)}>
                {saving ? 'Saving…' : choice === 'approved' ? 'Approve assignment' : choice === 'reupload' ? 'Reject assignment' : 'Submit review'}
              </button>
              {!choice && <span className={s.lastReview}>Choose Approved or Rejected.</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * canReview=false makes the page view-only: videos and comments, no comment box or Final review.
 * initialLearnerId / initialCourseId / initialChapterId open it already filtered (Assignment Result → Results).
 * showFilters=false leaves out the "Assignment Review" box (learner / course / chapter dropdowns).
 */
export default function AssignmentReview({ orgId, orgName = '', backHref = '', canReview = true, initialLearnerId = '', initialCourseId = '', initialChapterId = '', showFilters = true }) {
  const router = useRouter();

  const [learners, setLearners] = useState([]);
  const [courses, setCourses] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [learnerId, setLearnerId] = useState(initialLearnerId);
  const [courseId, setCourseId] = useState(initialLearnerId ? initialCourseId : '');
  const [chapterId, setChapterId] = useState(initialLearnerId && initialCourseId ? initialChapterId : '');
  const [loadingBase, setLoadingBase] = useState(true);
  const [items, setItems] = useState(null); // null = not loaded for this selection

  // Learners of the organization
  useEffect(() => {
    if (!orgId) return undefined;
    let cancelled = false;
    apiServiceHandler('GET', `user/admin/list?orgId=${orgId}&user_type=employee&orgRole=employee`).catch(() => null)
      .then(lr => {
        if (cancelled) return;
        setLearners(toArr(lr));
        setLoadingBase(false);
      });
    return () => { cancelled = true; };
  }, [orgId]);

// ── Courses: only the selected learner's own courses (none until a learner is picked) ──
  useEffect(() => {
    if (!learnerId) return undefined;
    let cancelled = false;
    apiServiceHandler('GET', `course-assignment/list?userId=${learnerId}&t=${Date.now()}`)
      .then(res => {
        if (cancelled) return;
        const seen = new Map();
        toArr(res).forEach(a => {
          const c = a.courseId;
          if (c?._id && !seen.has(String(c._id))) seen.set(String(c._id), { _id: String(c._id), title: c.title || 'Untitled' });
        });
        setCourses([...seen.values()].sort((x, y) => x.title.localeCompare(y.title)));
      })
      .catch(() => { if (!cancelled) setCourses([]); });
    return () => { cancelled = true; };
  }, [learnerId]);

  // Chapters of the chosen course — only those that contain an assignment. Each keeps its
  // number in the whole course (n), so "Ch 4" stays Ch 4 even when chapters 1–3 are hidden.
  useEffect(() => {
    if (!courseId) return undefined;
    let cancelled = false;
    Promise.all([
      apiServiceHandler('GET', `chapter/list?courseId=${courseId}`),
      apiServiceHandler('GET', `topic/list?courseId=${courseId}`),
    ])
      .then(([chRes, topicRes]) => {
        if (cancelled) return;
        const withAssignment = new Set(toArr(topicRes)
          .filter(t => String(t?.video_type || '').toLowerCase() === 'assignment' && !t.deletedAt)
          .map(t => String(t.chapterId)));
        setChapters(toArr(chRes).map((ch, i) => ({ ...ch, n: i + 1 })).filter(ch => withAssignment.has(String(ch._id))));
      })
      .catch(() => { if (!cancelled) setChapters([]); });
    return () => { cancelled = true; };
  }, [courseId]);

  // Assignments in the chapter with this learner's video + review
  useEffect(() => {
    if (!learnerId || !courseId || !chapterId) return undefined;
    let cancelled = false;
    apiServiceHandler('GET', `topic-activity/review-items?userId=${learnerId}&courseId=${courseId}&chapterId=${chapterId}&t=${Date.now()}`)
      .then(res => { if (!cancelled) setItems({ key: `${learnerId}|${chapterId}`, list: toArr(res), enrolled: res?.enrolled !== false }); })
      .catch(err => { if (!cancelled) setItems({ key: `${learnerId}|${chapterId}`, list: [], enrolled: true, error: err?.response?.data?.message || 'Could not load assignments.' }); });
    return () => { cancelled = true; };
  }, [learnerId, courseId, chapterId]);

  const ready = learnerId && courseId && chapterId;
  const current = ready && items?.key === `${learnerId}|${chapterId}` ? items : null;
  const learner = learners.find(l => String(l._id) === learnerId);

  const onSaved = (topicId, rec) => setItems(prev => (prev ? {
    ...prev,
    list: prev.list.map(it => (String(it.topicId) === String(topicId)
      ? { ...it, recordId: it.recordId || rec?._id || null, review: rec?.review || it.review, videos: Array.isArray(rec?.videos) ? rec.videos : it.videos, done: rec?.review?.status === 'approved' }
      : it)),
  } : prev));

  const pickCourse = v => { setCourseId(v); setChapterId(''); setChapters([]); };
  // Picking (or clearing) the learner resets the course and chapter below it.
  const pickLearner = v => { setLearnerId(v); setCourses([]); pickCourse(''); };

  return (
      <div className={q.page}>
        <button className={q.backBtn} onClick={() => (backHref ? router.push(backHref) : router.back())}>{BackArrow} Back</button>

        {showFilters && (
        <div className={q.filterCard}>
          <p className={q.filterMeta}>Assignment Review</p>
          <h2 className={q.filterTitle}>Assignments{orgName ? ` — ${orgName}` : ''}</h2>
          <div className={`${q.filterRow} ${s.filterRow3}`}>
            <div className={q.filterGroup}>
              <label className={q.filterLabel} htmlFor="asg-learner">Learner</label>
              <div className={q.selectWrap}>
                <select id="asg-learner" className={q.select} value={learnerId} onChange={e => pickLearner(e.target.value)} disabled={loadingBase}>
                  <option value="">{loadingBase ? 'Loading learners…' : learners.length ? '— Select a learner —' : 'No learners in this organization'}</option>
                  {learners.map(l => <option key={String(l._id)} value={String(l._id)}>{learnerName(l)}</option>)}
                </select>
                <span className={q.selectArrow}>{Chevron}</span>
              </div>
            </div>
            <div className={q.filterGroup}>
              <label className={q.filterLabel} htmlFor="asg-course">Course</label>
              <div className={q.selectWrap}>
                <select id="asg-course" className={q.select} value={courseId} onChange={e => pickCourse(e.target.value)} disabled={!learnerId}>
                  <option value="">{!learnerId ? '— Select a learner first —' : courses.length ? '— Select a course —' : 'No courses assigned'}</option>
                  {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
                <span className={q.selectArrow}>{Chevron}</span>
              </div>
            </div>
            <div className={q.filterGroup}>
              <label className={q.filterLabel} htmlFor="asg-chapter">Chapter</label>
              <div className={q.selectWrap}>
                <select id="asg-chapter" className={q.select} value={chapterId} onChange={e => setChapterId(e.target.value)} disabled={!courseId}>
                  <option value="">{!courseId || chapters.length ? '— Select a chapter —' : 'No chapter with an assignment'}</option>
                  {chapters.map(ch => <option key={String(ch._id)} value={String(ch._id)}>Ch {ch.n} – {ch.title || `Chapter ${ch.n}`}</option>)}
                </select>
                <span className={q.selectArrow}>{Chevron}</span>
              </div>
            </div>
          </div>
        </div>
        )}

        {!ready ? (
          <div className={q.emptyWrap}>
            <p className={q.emptyTitle}>Select a learner, course and chapter to review assignments</p>
            <span className={q.emptySub}>Each assignment in the chapter shows the learner&apos;s video with the review options.</span>
          </div>
        ) : !current ? (
          <div className={q.loadingWrap}><div className={q.spinner} /></div>
        ) : current.error ? (
          <div className={q.emptyWrap}><p className={q.emptyTitle}>{current.error}</p></div>
        ) : !current.enrolled ? (
          <div className={q.emptyWrap}>
            <p className={q.emptyTitle}>{learnerName(learner)} isn&apos;t enrolled in this course</p>
            <span className={q.emptySub}>Choose a course assigned to this learner.</span>
          </div>
        ) : current.list.length === 0 ? (
          <div className={q.emptyWrap}>
            <p className={q.emptyTitle}>No assignments in this chapter</p>
            <span className={q.emptySub}>Pick another chapter — only chapters with a homework assignment have something to review.</span>
          </div>
        ) : (
          <div className={s.list}>
            {current.list.map(item => (
              <AssignmentCard key={`${learnerId}-${item.topicId}`} item={item} learnerId={learnerId} learner={learner} canReview={canReview} onSaved={onSaved} />
            ))}
          </div>
        )}
      </div>
  );
}
