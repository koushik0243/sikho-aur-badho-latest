'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectUser, selectAuthReady } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import { fetchCourseCompletion, recordCourseCompletion } from '../../../Components/Learner/courseCompletion';
import pageStyles from "./Certificate.module.css";
import { withLearnerKit } from '../../../Components/Learner/LearnerKit/LearnerKit';

// Page styles + the shared learner page look.
const s = withLearnerKit(pageStyles);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

// Certificate templates are fixed-width HTML documents (e.g. `.certificate { width: 900px }`
// with body padding on top) — wide enough that the preview panel is almost always narrower
// than the template's natural size. Rather than force the iframe to a fixed box and clip
// whatever doesn't fit, render it at this natural width and scale the whole thing down (or up)
// to match the panel's actual width, so the full certificate always shows uncropped.
const CERT_NATURAL_WIDTH = 1000;
const CERT_FALLBACK_HEIGHT = 700;

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
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
function certNumber(id) {
  if (!id) return '—';
  const hex = String(id).replace(/[^a-f0-9]/gi, '').toUpperCase();
  return 'CERT-' + hex.slice(0, 4) + '-' + hex.slice(4, 8);
}

// Inject learner data into the template HTML by replacing common placeholder tokens
function buildCertHtml(template, userName, courseName, score, completionDate, chapters) {
  if (!template?.desc) return null;
  let html = template.desc;
  const certId  = certNumber(template._id);
  const dateStr = fmtDate(completionDate);
  const scoreStr = score > 0 ? `${score}%` : '—';

  const pairs = [
    [/\{\{\s*learner[_\s]?name\s*\}\}/gi, userName],
    [/\{\{\s*student[_\s]?name\s*\}\}/gi, userName],
    [/\{\{\s*recipient[_\s]?name\s*\}\}/gi, userName],
    [/\{\{\s*full[_\s]?name\s*\}\}/gi, userName],
    [/\{\{\s*name\s*\}\}/gi, userName],
    [/\{\{\s*course[_\s]?name\s*\}\}/gi, courseName],
    [/\{\{\s*course[_\s]?title\s*\}\}/gi, courseName],
    [/\{\{\s*program[_\s]?name\s*\}\}/gi, courseName],
    [/\{\{\s*course\s*\}\}/gi, courseName],
    [/\{\{\s*completion[_\s]?date\s*\}\}/gi, dateStr],
    [/\{\{\s*date\s*\}\}/gi, dateStr],
    [/\{\{\s*score\s*\}\}/gi, scoreStr],
    [/\{\{\s*marks\s*\}\}/gi, scoreStr],
    [/\{\{\s*certificate[_\s]?id\s*\}\}/gi, certId],
    [/\{\{\s*cert[_\s]?id\s*\}\}/gi, certId],
    [/\{\{\s*chapters\s*\}\}/gi, String(chapters)],
    [/\[LEARNER[_ ]NAME\]/gi, userName],
    [/\[STUDENT[_ ]NAME\]/gi, userName],
    [/\[NAME\]/gi, userName],
    [/\[COURSE[_ ]NAME\]/gi, courseName],
    [/\[COURSE[_ ]TITLE\]/gi, courseName],
    [/\[DATE\]/gi, dateStr],
    [/\[SCORE\]/gi, scoreStr],
    [/\[CERT[_ ]ID\]/gi, certId],
    [/\{learner_?name\}/gi, userName],
    [/\{student_?name\}/gi, userName],
    [/\{name\}/gi, userName],
    [/\{course_?name\}/gi, courseName],
    [/\{course\}/gi, courseName],
    [/\{date\}/gi, dateStr],
    [/\{score\}/gi, scoreStr],
    [/\{marks\}/gi, scoreStr],
    [/\{cert_?id\}/gi, certId],
  ];
  pairs.forEach(([pat, val]) => { html = html.replace(pat, val); });
  return html;
}

// Open the certificate HTML in a new window and trigger the print dialog
function printCertHtml(html) {
  const win = window.open('', '_blank');
  if (!win) {
    // Popup blocked — fall back to blob download
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'certificate.html'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give fonts and images a moment to load before printing
  setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 600);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CertificatePage() {
  return (
    <Suspense fallback={null}>
      <CertificatePageInner />
    </Suspense>
  );
}

function CertificatePageInner() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get('courseId') || '';
  const user      = useSelector(selectUser);
  const authReady = useSelector(selectAuthReady);
  const userId    = user ? String(user._id || user.id || '') : '';

  const [courses,        setCourses]        = useState([]);
  const [selectedId,     setSelectedId]     = useState('');
  const [courseObj,      setCourseObj]      = useState(null);
  const [template,       setTemplate]       = useState(null);
  const [progress,       setProgress]       = useState(null);
  const [quizScore,      setQuizScore]      = useState(null);
  const [chapters,       setChapters]       = useState([]);
  const [topics,         setTopics]         = useState([]);
  const [quizAttempts,   setQuizAttempts]   = useState([]);
  const [assignment,     setAssignment]     = useState(null);
  const [completion,     setCompletion]     = useState(null); // permanent certificate record, or null
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingData,    setLoadingData]    = useState(false);
  const [downloading,    setDownloading]    = useState(false);
  const [certScale,        setCertScale]        = useState(1);
  const [certContentHeight, setCertContentHeight] = useState(CERT_FALLBACK_HEIGHT);
  const certFrameRef  = useRef(null);
  const certIframeRef = useRef(null);

  // Keep the scale in sync with however wide the panel actually is (initial layout + resize).
  const recomputeCertScale = useCallback(() => {
    const width = certFrameRef.current?.clientWidth;
    if (width > 0) setCertScale(width / CERT_NATURAL_WIDTH);
  }, []);

  useEffect(() => {
    recomputeCertScale();
    window.addEventListener('resize', recomputeCertScale);
    return () => window.removeEventListener('resize', recomputeCertScale);
  }, [recomputeCertScale]);

  // Once the certificate document has actually painted, measure its real height at
  // CERT_NATURAL_WIDTH so the frame can be sized to fit it exactly — no cropping,
  // no leftover blank space, and it works for every template regardless of how tall
  // its particular design is.
  function handleCertIframeLoad() {
    recomputeCertScale();
    try {
      const doc = certIframeRef.current?.contentDocument;
      const height = doc?.documentElement?.scrollHeight || doc?.body?.scrollHeight;
      if (height) setCertContentHeight(height);
    } catch {
      // Cross-origin or otherwise unreadable — keep the fallback height.
    }
  }

  // Load enrolled courses
  useEffect(() => {
    if (!authReady || !userId) { setLoadingCourses(false); return; }
    let cancelled = false;
    async function load() {
      try {
        const [assignRes, allRes, progRes] = await Promise.all([
          apiServiceHandler('GET', `course-assignment/list?userId=${userId}`).catch(() => null),
          apiServiceHandler('GET', 'course/list').catch(() => null),
          apiServiceHandler('GET', `my-report/progress?t=${Date.now()}`).catch(() => null),
        ]);
        if (cancelled) return;
        const assigned = toArr(assignRes);
        const all      = toArr(allRes);
        let list = [];
        if (assigned.length > 0) {
          list = assigned.map(a => {
            const c = all.find(x => String(x._id) === String(a.courseId?._id || a.courseId || ''));
            return { assignment: a, course: c || a.courseId || {} };
          }).filter(x => x.course?._id);
        } else {
          list = all.map(c => ({ assignment: null, course: c }));
        }
        setCourses(list);
        if (courseIdParam && list.some(x => String(x.course?._id) === courseIdParam)) {
          setSelectedId(courseIdParam);
        } else {
          // No course in the URL: open on the first course with a certificate earned.
          const earned = new Set((progRes?.data?.courses || []).filter(c => c.phases?.completion?.certificate).map(c => String(c.courseId)));
          const first = list.find(x => earned.has(String(x.course?._id)));
          if (first) setSelectedId(String(first.course._id));
        }
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, authReady]);

  // Load certificate data when course is selected
  useEffect(() => {
    if (!selectedId) {
      setCourseObj(null); setTemplate(null); setProgress(null);
      setQuizScore(null); setChapters([]); setTopics([]); setQuizAttempts([]); setAssignment(null); setCompletion(null);
      return;
    }
    let cancelled = false;
    setLoadingData(true);
    setTemplate(null);

    async function load() {
      try {
        const entry = courses.find(x => String(x.course?._id) === selectedId);

        // Fetch course with populated certificate_template_id
        const courseRes = await apiServiceHandler('GET', `course/${selectedId}`).catch(() => null);
        if (cancelled) return;
        const cData = courseRes?.data ?? courseRes;
        setCourseObj(cData || entry?.course || null);

        // Extract template ref (may be populated object or raw ObjectId)
        const tmplRef = cData?.certificate_template_id;
        const tmplId  = tmplRef?._id ? String(tmplRef._id)
                      : typeof tmplRef === 'string' && tmplRef.length === 24 ? tmplRef
                      : tmplRef ? String(tmplRef) : null;

        if (tmplId) {
          // Fetch the full template document to get its desc (HTML content)
          const tmplRes = await apiServiceHandler('GET', `certificate-template/details/${tmplId}`).catch(() => null);
          if (cancelled) return;
          const tmplData = tmplRes?.data ?? tmplRes;
          setTemplate(tmplData?._id ? tmplData : (tmplRef?._id ? tmplRef : null));
        } else if (tmplRef?._id) {
          setTemplate(tmplRef);
        }

        const [progRes, quizRes, chRes, topicRes, completionRec] = await Promise.all([
          apiServiceHandler('GET', `progress/course?courseId=${selectedId}`).catch(() => null),
          apiServiceHandler('GET', `quiz-attempt/course?courseId=${selectedId}`).catch(() => null),
          apiServiceHandler('GET', `chapter/list?courseId=${selectedId}`).catch(() => null),
          apiServiceHandler('GET', `topic/list?courseId=${selectedId}`).catch(() => null),
          fetchCourseCompletion(selectedId),
        ]);
        if (cancelled) return;

        setCompletion(completionRec);

        setProgress(progRes?.data ?? progRes ?? null);
        setChapters(toArr(chRes));
        setTopics(toArr(topicRes));
        setAssignment(entry?.assignment || null);
        const ql = toArr(quizRes);
        setQuizAttempts(ql);
        setQuizScore(ql.length > 0 ? Number(ql[0].totalScore || 0) : null);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedId]);

  // Derived values
  const userName      = user?.name || user?.email || 'Learner';
  const courseName    = courseObj?.title
                      || courses.find(x => String(x.course?._id) === selectedId)?.course?.title
                      || '—';
  const overallPct    = Number(progress?.overallPercent ?? 0);
  const score         = quizScore !== null ? quizScore : overallPct;
  // The certificate counts the chapters the learner actually completed.
  const chapterCount  = completion ? completion.chapterIds.length : chapters.length;
  const hasData       = selectedId && !loadingData;

  // Same completion rule as the course player: a chapter is complete only when
  // every topic in it is done, and the course only when every chapter is.
  const passedTopicIds = new Set(
    quizAttempts.filter(a => a.passed).map(a => String(a.topicId?._id || a.topicId || ''))
  );
  const progressByTopic = Object.fromEntries(
    (Array.isArray(progress?.topics) ? progress.topics : []).map(p => [String(p.topicId), p])
  );
  // Assignments are marked done in the course player, which stores them here.
  let assignDone = {};
  try {
    const raw = selectedId && userId ? localStorage.getItem(`lms_assign_${userId}_${selectedId}`) : null;
    if (raw) assignDone = JSON.parse(raw) || {};
  } catch { /* unavailable or malformed — treat as none done */ }

  function isTopicDone(t) {
    const topId = String(t._id);
    const vt = String(t.video_type || '').toLowerCase();
    if (vt === 'zoom_link')  return true;
    if (vt === 'quiz')       return passedTopicIds.has(topId);
    if (vt === 'assignment') return assignDone[topId] === true;
    if (!t.videoUrl)         return true;
    return progressByTopic[topId]?.completed === true;
  }
  const topicsInChapter = ch =>
    topics.filter(t => String(t.chapterId?._id || t.chapterId || '') === String(ch._id));
  const allChaptersDone = chapters.length > 0
    && chapters.some(ch => topicsInChapter(ch).length > 0)
    && chapters.every(ch => topicsInChapter(ch).every(isTopicDone));
  // The certificate is permanent: chapters the admin adds after the learner
  // finished the course don't take it away.
  const isCourseComplete = !!completion || allChaptersDone;

  // Finished but not yet recorded (e.g. the learner came straight here): record it.
  const completionCourseId = completion ? String(completion.courseId) : '';
  useEffect(() => {
    if (!hasData || !allChaptersDone || completionCourseId === selectedId) return;
    let cancelled = false;
    recordCourseCompletion(selectedId).then(rec => { if (!cancelled && rec) setCompletion(rec); });
    return () => { cancelled = true; };
  }, [hasData, allChaptersDone, completionCourseId, selectedId]);
  // A completed course (certificate earned) always reports full video progress.
  const videoPct = isCourseComplete ? 100 : overallPct;

  // Completion date: most recent passed quiz attempt is the best signal of
  // "when the learner actually finished" — fall back to the org-assignment
  // record if no quiz attempts exist (e.g. the course has none).
  const latestPassedAttemptDate = quizAttempts
    .filter(a => a.passed)
    .map(a => a.evaluatedAt || a.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;
  const completedDate = completion?.completedAt || latestPassedAttemptDate || assignment?.completedAt || assignment?.updatedAt || null;
  const certHtml      = hasData ? buildCertHtml(template, userName, courseName, score, completedDate, chapterCount) : null;
  const canShowCertificate = hasData && isCourseComplete && !!certHtml;
  const certId        = certNumber(template?._id);

  function handleDownload() {
    if (downloading || !canShowCertificate) return;
    setDownloading(true);
    printCertHtml(certHtml);
    setTimeout(() => setDownloading(false), 3000);
  }

  return (
    <div className={s.page}>

      <button
        className={s.backBtn}
        onClick={() => router.push(selectedId ? `/learner/courses/${selectedId}` : '/learner/courses')}
      >
        {BackArrow} Back to {selectedId ? 'Course' : 'Courses'}
      </button>

      {/* Selector card */}
      <div className={s.selectorCard}>
        <div className={s.selectorLeft}>
          <p className={s.selectorMeta}>My Learning</p>
          <h2 className={s.selectorTitle}>Certificate</h2>
        </div>
        <div className={s.selectorRight}>
          <label className={s.selectorLabel}>Select Course</label>
          <div className={s.selectWrap}>
            <select
              className={s.select}
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              disabled={loadingCourses}
            >
              <option value="">
                {loadingCourses ? 'Loading courses…' : '— Choose a course —'}
              </option>
              {courses.map(({ course }) => (
                <option key={String(course._id)} value={String(course._id)}>
                  {course.title || 'Untitled Course'}
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

      {/* Empty state */}
      {!selectedId && (
        <div className={s.emptyState}>
          <svg viewBox="0 0 64 64" fill="none" width="56" height="56">
            <rect x="8" y="12" width="48" height="40" rx="5" stroke="#0b7b7b" strokeWidth="2" fill="#f0fafa"/>
            <path d="M18 24h28M18 31h20M18 38h14" stroke="#0b7b7b" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="48" cy="44" r="10" fill="#0b7b7b"/>
            <path d="M44 44l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className={s.emptyTitle}>Select a course to view your certificate</p>
          <span className={s.emptySub}>Choose a course from the dropdown above to preview and download your certificate.</span>
        </div>
      )}

      {/* Loading */}
      {selectedId && loadingData && (
        <div className={s.loadingWrap}><div className={s.spinner}/></div>
      )}

      {/* Certificate layout */}
      {hasData && (
        <div className={s.layout}>

          {/* Preview */}
          <div className={s.certPanel}>
            <div className={s.certPanelHeader}>
              <h3 className={s.certPanelTitle}>Your Certificate</h3>
              <span className={s.certPanelSub}>Preview</span>
            </div>

            {!template ? (
              <div className={s.noTemplateWrap}>
                <svg viewBox="0 0 48 48" fill="none" width="40" height="40">
                  <circle cx="24" cy="24" r="20" stroke="#f59e0b" strokeWidth="2" fill="#fffbeb"/>
                  <path d="M24 14v12M24 30v4" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                <p className={s.noTemplateTitle}>No certificate template assigned</p>
                <p className={s.noTemplateSub}>
                  Ask your administrator to assign a certificate template to this course.
                </p>
              </div>
            ) : !isCourseComplete ? (
              <div className={s.noTemplateWrap}>
                <svg viewBox="0 0 48 48" fill="none" width="40" height="40">
                  <circle cx="24" cy="24" r="20" stroke="#0b7b7b" strokeWidth="2" fill="#f0fafa"/>
                  <path d="M16 24l6 6 12-14" stroke="#0b7b7b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35"/>
                  <rect x="14" y="16" width="20" height="16" rx="2" stroke="#0b7b7b" strokeWidth="2" fill="none"/>
                  <path d="M14 20h20" stroke="#0b7b7b" strokeWidth="2"/>
                </svg>
                <p className={s.noTemplateTitle}>Certificate not yet available</p>
                <p className={s.noTemplateSub}>
                  Pass the quiz in every chapter of this course to unlock your certificate.
                </p>
              </div>
            ) : canShowCertificate ? (
              <div
                className={s.certFrame}
                ref={certFrameRef}
                style={{ height: certContentHeight * certScale }}
              >
                <iframe
                  ref={certIframeRef}
                  srcDoc={certHtml}
                  className={s.certIframe}
                  title="Certificate Preview"
                  scrolling="no"
                  onLoad={handleCertIframeLoad}
                  style={{
                    width: CERT_NATURAL_WIDTH,
                    height: certContentHeight,
                    transform: `scale(${certScale})`,
                    transformOrigin: 'top left',
                  }}
                />
              </div>
            ) : null}
          </div>

          {/* Sidebar */}
          <aside className={s.sidebar}>
            <div className={s.card}>
              <h3 className={s.cardTitle}>Download Certificate</h3>
              <p className={s.cardSubtitle}>Print or save as PDF via your browser</p>
              <button
                className={s.downloadBtn}
                onClick={handleDownload}
                disabled={downloading || !canShowCertificate}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd"/>
                </svg>
                {downloading ? 'Opening print dialog…' : 'Download PDF'}
              </button>
            </div>

            <div className={s.card}>
              <h3 className={s.cardTitle}>Certificate Details</h3>
              {[
                { label: 'Certificate ID', value: certId },
                { label: 'Template',       value: template?.title || '—' },
                { label: 'Course',         value: courseName },
                { label: 'Learner',        value: userName },
                { label: 'Chapters',       value: chapterCount > 0 ? chapterCount : '—' },
                { label: 'Date',           value: fmtDate(completedDate) },
                { label: 'Score',          value: score > 0 ? `${score}%` : '—' },
              ].map(r => (
                <div key={r.label} className={s.summaryRow}>
                  <span className={s.summaryLabel}>{r.label}</span>
                  <span className={s.summaryVal}>{r.value}</span>
                </div>
              ))}
              <div className={s.summaryRow}>
                <span className={s.summaryLabel}>Video Progress</span>
                <div className={s.progressWrap}>
                  <div className={s.progressTrack}>
                    <div className={s.progressFill} style={{ width: `${videoPct}%` }}/>
                  </div>
                  <span className={s.progressPct}>{videoPct}%</span>
                </div>
              </div>
              <div className={s.summaryRow}>
                <span className={s.summaryLabel}>Status</span>
                <span className={isCourseComplete ? s.badgePassed : s.badgeInProgress}>
                  {isCourseComplete ? 'Completed' : overallPct > 0 ? 'In Progress' : 'Not Started'}
                </span>
              </div>
            </div>

            {/* Only shown once the certificate has actually been generated —
                i.e. after every chapter and zoom session is complete. */}
            {isCourseComplete && (
              <div className={`${s.achieveCard} ${
                (template?.slug || '').includes('modern')  ? s.achieveModern  :
                (template?.slug || '').includes('purple') || (template?.slug || '').includes('royal') ? s.achievePurple :
                (template?.slug || '').includes('elegant') || (template?.slug || '').includes('gold') ? s.achieveElegant : ''
              }`}>
                <svg viewBox="0 0 64 64" fill="none" width="44" height="44">
                  <path d="M32 40c-8.84 0-16-7.16-16-16V10h32v14c0 8.84-7.16 16-16 16z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/>
                  <path d="M16 14H10a4 4 0 000 8c1.5 3 4 5 6 5M48 14h6a4 4 0 010 8c-1.5 3-4 5-6 5" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"/>
                  <rect x="24" y="40" width="16" height="5" rx="2" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8"/>
                  <rect x="20" y="45" width="24" height="4" rx="2" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8"/>
                </svg>
                <h3 className={s.achieveTitle}>Great Achievement!</h3>
                <p className={s.achieveText}>
                  <strong>Congratulations!</strong> You&apos;ve successfully completed this course.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
