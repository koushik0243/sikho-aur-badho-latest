'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import s from './CourseCertificate.module.css';

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
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function certNumber(templateId, userId) {
  if (!templateId) return '—';
  const hex = (String(templateId) + String(userId || '')).replace(/[^a-f0-9]/gi, '').toUpperCase();
  return 'CERT-' + hex.slice(0, 4) + '-' + hex.slice(4, 8);
}

// Inject learner data into the template HTML by replacing common placeholder tokens
function buildCertHtml(template, userName, courseName, score, completionDate, chapters, certId) {
  if (!template?.desc) return null;
  let html = template.desc;
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
  setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 600);
}

const ChevronIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

export default function CourseCertificate() {
  const router = useRouter();
  const user = useSelector(selectUser);

  const [learners, setLearners] = useState([]);
  const [orgCourses, setOrgCourses] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);

  const [selectedLearner, setSelectedLearner] = useState('');
  const [courseOptions, setCourseOptions] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');

  const [courseObj, setCourseObj] = useState(null);
  const [template, setTemplate] = useState(null);
  // Server-side completion status: every lesson watched + every quiz passed.
  const [status, setStatus] = useState(null); // { completed, completedAt, score, attempted, quizzesPassed, quizzesTotal }
  const [assignedDate, setAssignedDate] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(520);
  const certIframeRef = useRef(null);

  function handleIframeLoad() {
    const win = certIframeRef.current?.contentWindow;
    const doc = win?.document;
    if (!doc) return;
    const height = Math.max(
      doc.documentElement?.scrollHeight || 0,
      doc.body?.scrollHeight || 0,
    );
    if (height > 0) setIframeHeight(height);
  }

  // ── Resolve org, learners, org courses ──────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingBase(true);
      try {
        let orgId = user?.orgId ? String(user.orgId) : null;
        if (!orgId) {
          const uid = user?._id || user?.id;
          if (uid) {
            const r = await apiServiceHandler('GET', `user/admin/edit/${uid}`).catch(() => null);
            const rec = r?.data ?? r;
            orgId = rec?.orgId ? String(rec.orgId) : null;
          }
        }
        if (!orgId || cancelled) return;

        const [learnerRes, ocRes] = await Promise.all([
          apiServiceHandler('GET', `user/admin/list?orgId=${orgId}&user_type=employee&orgRole=employee`).catch(() => null),
          apiServiceHandler('GET', `organization-course/list?orgId=${orgId}`).catch(() => null),
        ]);
        if (cancelled) return;

        setLearners(toArr(learnerRes));

        const drop = toArr(ocRes).map(oc => {
          const c = oc.courseId;
          return c?._id ? { _id: String(c._id), title: c.title || 'Untitled' } : null;
        }).filter(Boolean);
        setOrgCourses(drop);
      } finally {
        if (!cancelled) setLoadingBase(false);
      }
    }
    if (user) load();
    return () => { cancelled = true; };
  }, [user?._id]);

  // ── Courses assigned to the selected learner ────────────────
  useEffect(() => {
    setSelectedCourse('');
    if (!selectedLearner) { setCourseOptions([]); return; }
    let cancelled = false;
    setLoadingCourses(true);
    async function load() {
      try {
        const res = await apiServiceHandler('GET', `course-assignment/list?userId=${selectedLearner}`).catch(() => null);
        if (cancelled) return;
        const assigned = toArr(res);
        let list = assigned.map(a => {
          const c = a.courseId;
          return c?._id ? { _id: String(c._id), title: c.title || 'Untitled' } : null;
        }).filter(Boolean);
        if (list.length === 0) list = orgCourses;
        setCourseOptions(list);
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedLearner]);

  // ── Certificate data for learner + course ───────────────────
  useEffect(() => {
    if (!selectedLearner || !selectedCourse) {
      setCourseObj(null); setTemplate(null); setStatus(null);
      setAssignedDate(null); setChapters([]);
      return;
    }
    let cancelled = false;
    setLoadingData(true);
    setTemplate(null);
    setIframeHeight(520);

    async function load() {
      try {
        const courseRes = await apiServiceHandler('GET', `course/${selectedCourse}`).catch(() => null);
        if (cancelled) return;
        const cData = courseRes?.data ?? courseRes;
        setCourseObj(cData || courseOptions.find(c => c._id === selectedCourse) || null);

        const tmplRef = cData?.certificate_template_id;
        const tmplId  = tmplRef?._id ? String(tmplRef._id)
                      : typeof tmplRef === 'string' && tmplRef.length === 24 ? tmplRef
                      : tmplRef ? String(tmplRef) : null;

        if (tmplId) {
          const tmplRes = await apiServiceHandler('GET', `certificate-template/details/${tmplId}`).catch(() => null);
          if (cancelled) return;
          const tmplData = tmplRes?.data ?? tmplRes;
          setTemplate(tmplData?._id ? tmplData : (tmplRef?._id ? tmplRef : null));
        } else if (tmplRef?._id) {
          setTemplate(tmplRef);
        }

        const [statusRes, chRes, assignRes] = await Promise.all([
          // Timestamp defeats the 60s GET cache — completion must be current.
          apiServiceHandler('GET', `course-completion/learner-status?userId=${selectedLearner}&courseId=${selectedCourse}&t=${Date.now()}`).catch(() => null),
          apiServiceHandler('GET', `chapter/list?courseId=${selectedCourse}`).catch(() => null),
          apiServiceHandler('GET', `course-assignment/list?userId=${selectedLearner}&courseId=${selectedCourse}`).catch(() => null),
        ]);
        if (cancelled) return;

        setStatus(statusRes?.data ?? null);
        setChapters(toArr(chRes));

        // The assignment action itself creates a course_assignments doc with no
        // topicId — later per-quiz attempts reuse the same collection with a
        // topicId set, so filter those out to find the true "assigned" record.
        const assignOnly = toArr(assignRes).filter(a => !a.topicId);
        const earliestAssign = assignOnly.reduce((earliest, a) => {
          const t = a.attemptedAt ? new Date(a.attemptedAt).getTime() : null;
          if (t === null) return earliest;
          return earliest === null || t < earliest ? t : earliest;
        }, null);
        setAssignedDate(earliestAssign ? new Date(earliestAssign) : null);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedLearner, selectedCourse]);

  // ── Derived values ───────────────────────────────────────────
  const activeLearner = learners.find(l => String(l._id) === selectedLearner);
  const learnerName = activeLearner
    ? (activeLearner.name || activeLearner.fullName || `${activeLearner.firstName || ''} ${activeLearner.lastName || ''}`.trim() || 'Learner')
    : '';
  const courseName = courseObj?.title
                    || courseOptions.find(c => c._id === selectedCourse)?.title
                    || '—';
  // A certificate is earned only once the whole course is complete (every
  // lesson watched and every quiz passed) — not on a single passed quiz.
  const passed         = status?.completed === true;
  const attempted      = status?.attempted === true;
  const score          = passed && status?.score != null ? Number(status.score) : 0;
  const completionDate = passed ? status?.completedAt || null : null;
  const chapterCount   = chapters.length;
  const hasData      = selectedLearner && selectedCourse && !loadingData;
  const certId       = certNumber(template?._id, selectedLearner);
  // Only a completed course has a certificate to preview or download.
  const certHtml     = hasData && passed ? buildCertHtml(template, learnerName, courseName, score, completionDate, chapterCount, certId) : null;

  function handleDownload() {
    if (downloading || !certHtml) return;
    setDownloading(true);
    printCertHtml(certHtml);
    setTimeout(() => setDownloading(false), 3000);
  }

  const quizzesTotal  = Number(status?.quizzesTotal || 0);
  const quizzesPassed = Number(status?.quizzesPassed || 0);
  const state = passed ? 'earned' : attempted ? 'progress' : 'none';
  const STATE_LABEL = { earned: 'Certificate earned', progress: 'In progress', none: 'Not started' };
  const initials = (learnerName || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const downloadHint = !passed
    ? 'Available once the learner completes the course.'
    : !certHtml ? 'Assign a certificate template to this course first.' : 'Opens your browser\'s print dialog — choose "Save as PDF".';

  return (
    <div className={s.page}>

      <button className={s.backBtn} onClick={() => router.back()}>
        {BackArrow} Back
      </button>

      {/* ── Header + filters ── */}
      <header className={s.head}>
        <div className={s.headText}>
          <p className={s.eyebrow}>Certificates</p>
          <h1 className={s.title}>Course Certificate</h1>
          <p className={s.subtitle}>Preview, verify and download a learner&apos;s certificate for a course.</p>
        </div>
        <div className={s.filterRow}>
          <label className={s.filterGroup}>
            <span className={s.filterLabel}>Learner</span>
            <span className={s.selectWrap}>
              <select
                className={s.select}
                value={selectedLearner}
                onChange={e => setSelectedLearner(e.target.value)}
                disabled={loadingBase}
              >
                <option value="">{loadingBase ? 'Loading learners…' : 'Select a learner'}</option>
                {learners.map(l => {
                  const uid = String(l._id || '');
                  const name = l.name || l.fullName || `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Learner';
                  return <option key={uid} value={uid}>{name}</option>;
                })}
              </select>
              <span className={s.selectArrow}>{ChevronIcon}</span>
            </span>
          </label>
          <label className={s.filterGroup}>
            <span className={s.filterLabel}>Course</span>
            <span className={s.selectWrap}>
              <select
                className={s.select}
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                disabled={!selectedLearner || loadingCourses}
              >
                <option value="">{loadingCourses ? 'Loading courses…' : selectedLearner ? 'Select a course' : 'Select a learner first'}</option>
                {courseOptions.map(c => (
                  <option key={c._id} value={c._id}>{c.title}</option>
                ))}
              </select>
              <span className={s.selectArrow}>{ChevronIcon}</span>
            </span>
          </label>
        </div>
      </header>

      {/* ── Prompt state ── */}
      {(!selectedLearner || !selectedCourse) && (
        <div className={s.emptyState}>
          <div className={s.emptyArt} aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none" width="56" height="56">
              <rect x="8" y="12" width="48" height="40" rx="5" stroke="#0b7b7b" strokeWidth="2" fill="#f0fafa" />
              <path d="M18 24h28M18 31h20M18 38h14" stroke="#0b7b7b" strokeWidth="2" strokeLinecap="round" />
              <circle cx="48" cy="44" r="10" fill="#0b7b7b" />
              <path d="M44 44l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className={s.emptyTitle}>Choose a learner and a course</p>
          <ol className={s.emptySteps}>
            <li><span>1</span>Pick a learner</li>
            <li><span>2</span>Pick one of their courses</li>
            <li><span>3</span>Preview and download the certificate</li>
          </ol>
        </div>
      )}

      {/* ── Loading ── */}
      {selectedLearner && selectedCourse && loadingData && (
        <div className={s.loadingWrap} role="status" aria-label="Loading certificate"><div className={s.spinner} /></div>
      )}

      {hasData && (
        <>
          {/* ── Status strip ── */}
          <section className={`${s.strip} ${s[`strip_${state}`]}`} aria-label="Certificate status">
            <div className={s.stripWho}>
              <span className={s.avatar} aria-hidden="true">{initials}</span>
              <div className={s.stripText}>
                <p className={s.stripName}>{learnerName}</p>
                <p className={s.stripCourse}>{courseName}</p>
              </div>
              <span className={`${s.statePill} ${s[`pill_${state}`]}`}>
                {state === 'earned' ? '✓ ' : ''}{STATE_LABEL[state]}
              </span>
            </div>
            <div className={s.stripFacts}>
              {quizzesTotal > 0 && (
                <div className={s.fact}>
                  <span className={s.factLbl}>Quizzes passed</span>
                  <span className={s.factVal}>{quizzesPassed} / {quizzesTotal}</span>
                  <span className={s.factBar} role="progressbar" aria-valuenow={quizzesPassed} aria-valuemin={0} aria-valuemax={quizzesTotal} aria-label="Quizzes passed">
                    <span style={{ width: `${Math.round((quizzesPassed / quizzesTotal) * 100)}%` }} />
                  </span>
                </div>
              )}
              <div className={s.fact}><span className={s.factLbl}>Assigned</span><span className={s.factVal}>{fmtDate(assignedDate)}</span></div>
              <div className={s.fact}><span className={s.factLbl}>Completed</span><span className={s.factVal}>{fmtDate(completionDate)}</span></div>
              <div className={s.fact}><span className={s.factLbl}>Score</span><span className={s.factVal}>{score > 0 ? `${score}%` : '—'}</span></div>
            </div>
          </section>

          <div className={s.layout}>
            {/* Preview */}
            <section className={s.certPanel} aria-labelledby="cert-preview-h">
              <div className={s.certPanelHeader}>
                <h2 id="cert-preview-h" className={s.certPanelTitle}>Certificate preview</h2>
                {template
                  ? <span className={s.templateTag}>Template: {template.title}</span>
                  : <span className={s.templateTagDefault}>No template assigned</span>}
              </div>

              <div className={s.viewer}>
                {!passed ? (
                  <div className={s.locked}>
                    <div className={s.lockIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="26" height="26"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" /></svg>
                    </div>
                    <p className={s.lockedTitle}>Certificate not earned yet</p>
                    <p className={s.lockedSub}>{learnerName || 'The learner'} receives this certificate after meeting every requirement:</p>
                    <ul className={s.reqList}>
                      {quizzesTotal > 0 && (
                        <li className={quizzesPassed >= quizzesTotal ? s.reqDone : s.reqTodo}>
                          <span className={s.reqMark} aria-hidden="true">{quizzesPassed >= quizzesTotal ? '✓' : ''}</span>
                          Pass every quiz <span className={s.reqCount}>{quizzesPassed} of {quizzesTotal}</span>
                        </li>
                      )}
                      <li className={s.reqTodo}>
                        <span className={s.reqMark} aria-hidden="true" />
                        Complete every lesson
                      </li>
                    </ul>
                  </div>
                ) : certHtml ? (
                  <div className={s.paper} style={{ height: iframeHeight }}>
                    <iframe
                      ref={certIframeRef}
                      srcDoc={certHtml}
                      className={s.certIframe}
                      style={{ height: iframeHeight }}
                      onLoad={handleIframeLoad}
                      title="Certificate preview"
                      scrolling="no"
                    />
                  </div>
                ) : (
                  <div className={s.locked}>
                    <div className={`${s.lockIcon} ${s.lockIconWarn}`} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="26" height="26"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" strokeLinecap="round" /></svg>
                    </div>
                    <p className={s.lockedTitle}>No certificate template assigned</p>
                    <p className={s.lockedSub}>{learnerName} has completed this course, but the course has no certificate template yet, so there is nothing to preview or download.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Sidebar */}
            <aside className={s.sidebar}>
              <div className={s.card}>
                <h3 className={s.cardTitle}>Download</h3>
                <button
                  className={s.downloadBtn}
                  onClick={handleDownload}
                  disabled={downloading || !certHtml}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
                    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                  </svg>
                  {downloading ? 'Opening print dialog…' : 'Download PDF'}
                </button>
                <p className={s.cardHint}>{downloadHint}</p>
              </div>

              <div className={s.card}>
                <h3 className={s.cardTitle}>Certificate details</h3>
                <dl className={s.details}>
                  {[
                    ['Certificate ID', <span key="id" className={s.mono}>{certId}</span>],
                    ['Template',       template?.title || '—'],
                    ['Course',         courseName],
                    ['Learner',        learnerName],
                    ['Chapters',       chapterCount > 0 ? chapterCount : '—'],
                    ['Assigned',       fmtDate(assignedDate)],
                    ['Completed',      fmtDate(completionDate)],
                    ['Score',          score > 0 ? `${score}%` : '—'],
                    ['Status',         <span key="st" className={passed ? s.badgePassed : s.badgeInProgress}>{passed ? 'Passed' : attempted ? 'In Progress' : 'Not Attempted'}</span>],
                  ].map(([label, value]) => (
                    <div key={label} className={s.detailRow}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
