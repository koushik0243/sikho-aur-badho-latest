'use client';

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import s from "./Reports.module.css";

const DownloadIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
  </svg>
);

const Icon = {
  book:      <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>,
  users:     <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>,
  clipboard: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
  link:      <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" /></svg>,
  trophy:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h8V3a1 1 0 112 0v1h1a1 1 0 011 1v2a4 4 0 01-3.6 3.98A5.002 5.002 0 0111 13.9V16h2a1 1 0 110 2H7a1 1 0 110-2h2v-2.1a5.002 5.002 0 01-3.4-2.92A4 4 0 012 7V5a1 1 0 011-1h1V3a1 1 0 011-1zm-1 4v1a2 2 0 001.1 1.79A5 5 0 015 7V6H4zm11 1V6h1v1a2 2 0 01-1.1 1.79c.07-.26.1-.52.1-.79z" clipRule="evenodd" /></svg>,
  alert:     <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
  video:     <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>,
  badge:     <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
};

function toArr(res) {
  if (Array.isArray(res))             return res;
  if (Array.isArray(res?.data))       return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data?.list)) return res.data.list;
  if (Array.isArray(res?.list))       return res.list;
  return [];
}

function downloadCsv(filename, rows) {
  const csv  = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// colDefs: [{ key, label, width }]  — width in px (×0.75 → pt internally in jsPDF)
async function downloadPdf(filename, title, colDefs, dataRows) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 123, 123);
  doc.text(title, 40, 40);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130, 130, 130);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 40, 56);
  doc.setTextColor(0, 0, 0);

  if (dataRows.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(180, 180, 180);
    doc.text('No data available.', 40, 80);
  } else {
    const headers  = colDefs.map(c => ({ name: c.key, prompt: c.label, width: c.width, align: 'left' }));
    const tableData = dataRows.map(row => {
      const obj = {};
      colDefs.forEach((c, i) => { obj[c.key] = String(row[i] ?? '') || ' '; });
      return obj;
    });
    doc.table(40, 68, tableData, headers, { fontSize: 9 });
  }

  doc.save(filename);
}

function learnerName(u) {
  if (!u) return '';
  return u.name || u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || String(u._id || u);
}

export default function ReportsPage() {
  const user = useSelector(selectUser);

  const [loading,      setLoading]      = useState(true);
  const [courses,      setCourses]      = useState([]);
  const [learners,     setLearners]     = useState([]);
  const [assignments,  setAssignments]  = useState([]);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [exporting,    setExporting]    = useState(null);

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

        const ocList      = toArr(ocRes);
        const learnerList = toArr(learnerRes);
        const assignList  = toArr(assignRes);

        setCourses(ocList);
        setLearners(learnerList);
        setAssignments(assignList);

        const courseIds = ocList.map(oc => {
          const c = oc.courseId;
          return c?._id ? String(c._id) : String(c);
        }).filter(Boolean);

        if (courseIds.length > 0) {
          const results = await Promise.all(
            courseIds.map(cid =>
              apiServiceHandler('GET', `quiz-attempt/course-all?courseId=${cid}`).catch(() => null)
            )
          );
          setQuizAttempts(results.flatMap(r => toArr(r)));
        }
      } finally {
        setLoading(false);
      }
    }
    if (user) load();
  }, [user?._id]);

  function buildCompletionMap() {
    const map = {};
    for (const att of quizAttempts) {
      const uid = String(att.userId?._id || att.userId || '');
      const cid = String(att.courseId || '');
      if (!uid || !cid) continue;
      const k = `${uid}_${cid}`;
      const d = att.createdAt ? new Date(att.createdAt) : null;
      if (d && (!map[k] || d > map[k])) map[k] = d;
    }
    return map;
  }

  function completionRows() {
    const completionMap = buildCompletionMap();
    const enrollments = assignments.filter(a => !a.topicId);
    return enrollments.map(a => {
      const uid = String(a.userId?._id || '');
      const cid = String(a.courseId?._id || a.courseId || '');
      const latestAttempt = completionMap[`${uid}_${cid}`];
      return [
        learnerName(a.userId),
        a.userId?.email || '',
        a.courseId?.title || String(cid),
        a.attemptedAt ? new Date(a.attemptedAt).toLocaleDateString('en-IN') : '',
        latestAttempt ? latestAttempt.toLocaleDateString('en-IN') : '',
      ];
    });
  }

  async function handleCsv(key) {
    setExporting(key);
    try {
      switch (key) {
        case 'completion': {
          const rows = [['Learner Name', 'Email', 'Course', 'Assigned Date', 'Completion Date'], ...completionRows()];
          downloadCsv('course_completion.csv', rows);
          break;
        }
        case 'performers': {
          const rows = [['Learner Name', 'Email', 'Course', 'Quiz Topic', 'Score', 'Passed', 'Date']];
          const sorted = [...quizAttempts].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
          for (const att of sorted) {
            rows.push([
              learnerName(att.userId),
              att.userId?.email || '',
              att.courseId?.title || String(att.courseId?._id || att.courseId || ''),
              att.topicId?.title  || String(att.topicId?._id  || att.topicId  || ''),
              att.totalScore ?? '',
              att.passed ? 'Yes' : 'No',
              att.createdAt ? new Date(att.createdAt).toLocaleDateString('en-IN') : '',
            ]);
          }
          downloadCsv('performers.csv', rows);
          break;
        }
        case 'failure': {
          const topicStats = {};
          for (const att of quizAttempts) {
            const tid   = String(att.topicId?._id || att.topicId || '');
            const tName = att.topicId?.title || tid;
            const cName = att.topicId?.chapterId?.title || att.chapterId?.title || '';
            const crs   = att.courseId?.title || '';
            if (!tid) continue;
            if (!topicStats[tid]) topicStats[tid] = { topic: tName, chapter: cName, course: crs, total: 0, failed: 0 };
            topicStats[tid].total++;
            if (!att.passed) topicStats[tid].failed++;
          }
          const rows = [['Course', 'Chapter', 'Quiz Topic', 'Total Attempts', 'Failed', 'Failure Rate %']];
          for (const d of Object.values(topicStats)) {
            const rate = d.total > 0 ? Math.round((d.failed / d.total) * 100) : 0;
            rows.push([d.course, d.chapter, d.topic, d.total, d.failed, `${rate}%`]);
          }
          downloadCsv('chapter_failure.csv', rows);
          break;
        }
        case 'zoom': {
          const rows = [['Learner Name', 'Email', 'Courses Assigned']];
          for (const l of learners) {
            const uid   = String(l._id || '');
            const count = assignments.filter(a => String(a.userId?._id || a.userId) === uid).length;
            rows.push([learnerName(l), l.email || '', count]);
          }
          downloadCsv('zoom_attendance.csv', rows);
          break;
        }
        case 'certificates': {
          const completionMap = buildCompletionMap();
          const rows = [['Learner Name', 'Email', 'Course', 'Assigned Date', 'Completion Date']];
          const enrollments = assignments.filter(a => !a.topicId);
          for (const a of enrollments) {
            const uid = String(a.userId?._id || '');
            const cid = String(a.courseId?._id || a.courseId || '');
            const latestAttempt = completionMap[`${uid}_${cid}`];
            rows.push([
              learnerName(a.userId),
              a.userId?.email || '',
              a.courseId?.title || '',
              a.attemptedAt ? new Date(a.attemptedAt).toLocaleDateString('en-IN') : '',
              latestAttempt ? latestAttempt.toLocaleDateString('en-IN') : '',
            ]);
          }
          downloadCsv('certificate_log.csv', rows);
          break;
        }
      }
    } finally {
      setExporting(null);
    }
  }

  async function handlePdf(key) {
    setExporting(`${key}_pdf`);
    try {
      switch (key) {
        case 'completion': {
          const colDefs = [
            { key: 'n',  label: 'Learner Name',    width: 180 },
            { key: 'e',  label: 'Email',           width: 225 },
            { key: 'c',  label: 'Course',          width: 280 },
            { key: 'ad', label: 'Assigned Date',   width: 160 },
            { key: 'cd', label: 'Completion Date', width: 170 },
          ];
          await downloadPdf('course_completion.pdf', 'Course Completion Report', colDefs, completionRows());
          break;
        }
        case 'performers': {
          const colDefs = [
            { key: 'n',  label: 'Learner Name', width: 145 },
            { key: 'e',  label: 'Email',        width: 190 },
            { key: 'c',  label: 'Course',       width: 190 },
            { key: 'qt', label: 'Quiz Topic',   width: 190 },
            { key: 's',  label: 'Score',        width: 85  },
            { key: 'p',  label: 'Passed',       width: 85  },
            { key: 'd',  label: 'Date',         width: 130 },
          ];
          const sorted = [...quizAttempts].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
          const rows = sorted.map(att => [
            learnerName(att.userId),
            att.userId?.email || '',
            att.courseId?.title || String(att.courseId?._id || att.courseId || ''),
            att.topicId?.title  || String(att.topicId?._id  || att.topicId  || ''),
            att.totalScore ?? '',
            att.passed ? 'Yes' : 'No',
            att.createdAt ? new Date(att.createdAt).toLocaleDateString('en-IN') : '',
          ]);
          await downloadPdf('performers.pdf', 'Top / Bottom Performers', colDefs, rows);
          break;
        }
        case 'failure': {
          const colDefs = [
            { key: 'crs',   label: 'Course',         width: 210 },
            { key: 'ch',    label: 'Chapter',        width: 210 },
            { key: 'qt',    label: 'Quiz Topic',     width: 210 },
            { key: 'total', label: 'Total Attempts', width: 135 },
            { key: 'fail',  label: 'Failed',         width: 115 },
            { key: 'rate',  label: 'Failure Rate %', width: 135 },
          ];
          const topicStats = {};
          for (const att of quizAttempts) {
            const tid   = String(att.topicId?._id || att.topicId || '');
            const tName = att.topicId?.title || tid;
            const cName = att.topicId?.chapterId?.title || att.chapterId?.title || '';
            const crs   = att.courseId?.title || '';
            if (!tid) continue;
            if (!topicStats[tid]) topicStats[tid] = { topic: tName, chapter: cName, course: crs, total: 0, failed: 0 };
            topicStats[tid].total++;
            if (!att.passed) topicStats[tid].failed++;
          }
          const rows = Object.values(topicStats).map(d => {
            const rate = d.total > 0 ? Math.round((d.failed / d.total) * 100) : 0;
            return [d.course, d.chapter, d.topic, d.total, d.failed, `${rate}%`];
          });
          await downloadPdf('chapter_failure.pdf', 'Chapter Failure Analysis', colDefs, rows);
          break;
        }
        case 'zoom': {
          const colDefs = [
            { key: 'n', label: 'Learner Name',     width: 320 },
            { key: 'e', label: 'Email',            width: 475 },
            { key: 'x', label: 'Courses Assigned', width: 220 },
          ];
          const rows = learners.map(l => {
            const uid   = String(l._id || '');
            const count = assignments.filter(a => String(a.userId?._id || a.userId) === uid).length;
            return [learnerName(l), l.email || '', count];
          });
          await downloadPdf('zoom_attendance.pdf', 'Zoom Attendance Log', colDefs, rows);
          break;
        }
        case 'certificates': {
          const colDefs = [
            { key: 'n',  label: 'Learner Name',    width: 180 },
            { key: 'e',  label: 'Email',           width: 235 },
            { key: 'c',  label: 'Course',          width: 280 },
            { key: 'ad', label: 'Assigned Date',   width: 155 },
            { key: 'cd', label: 'Completion Date', width: 165 },
          ];
          const completionMap = buildCompletionMap();
          const enrollments = assignments.filter(a => !a.topicId);
          const rows = enrollments.map(a => {
            const uid = String(a.userId?._id || '');
            const cid = String(a.courseId?._id || a.courseId || '');
            const latestAttempt = completionMap[`${uid}_${cid}`];
            return [
              learnerName(a.userId),
              a.userId?.email || '',
              a.courseId?.title || '',
              a.attemptedAt ? new Date(a.attemptedAt).toLocaleDateString('en-IN') : '',
              latestAttempt ? latestAttempt.toLocaleDateString('en-IN') : '',
            ];
          });
          await downloadPdf('certificate_log.pdf', 'Certificate Issuance Log', colDefs, rows);
          break;
        }
      }
    } finally {
      setExporting(null);
    }
  }

  const courseCount  = courses.length;
  const learnerCount = learners.length;
  const attemptCount = quizAttempts.length;
  const assignCount  = assignments.length;

  const REPORTS = [
    {
      key: 'completion', icon: Icon.book,
      title: 'Course Completion Report',
      desc: 'Every learner’s assigned courses, with the assigned date and latest activity date.',
      sub: `${courseCount} course${courseCount !== 1 ? 's' : ''} · ${learnerCount} learner${learnerCount !== 1 ? 's' : ''}`,
    },
    {
      key: 'performers', icon: Icon.trophy,
      title: 'Top / Bottom Performers',
      desc: 'All quiz attempts ranked by score — spot your strongest and weakest learners.',
      sub: `${attemptCount} quiz attempt${attemptCount !== 1 ? 's' : ''} · Ranked by score`,
    },
    {
      key: 'failure', icon: Icon.alert,
      title: 'Chapter Failure Analysis',
      desc: 'Attempts, failures and fail rate for each quiz, by course and chapter.',
      sub: `Retry rates · ${attemptCount} total attempt${attemptCount !== 1 ? 's' : ''}`,
    },
    {
      key: 'zoom', icon: Icon.video,
      title: 'Zoom Attendance Log',
      desc: 'Each learner with their email and the number of courses assigned to them.',
      sub: `${learnerCount} learner${learnerCount !== 1 ? 's' : ''} · Session-wise records`,
    },
    {
      key: 'certificates', icon: Icon.badge,
      title: 'Certificate Issuance Log',
      desc: 'Each course assignment with its assigned date and completion date.',
      sub: `${assignCount} assignment${assignCount !== 1 ? 's' : ''} · Who earned what · When`,
    },
  ];

  const KPIS = [
    { label: 'Courses',       value: courseCount,  icon: Icon.book },
    { label: 'Learners',      value: learnerCount, icon: Icon.users },
    { label: 'Quiz attempts', value: attemptCount, icon: Icon.clipboard },
    { label: 'Assignments',   value: assignCount,  icon: Icon.link },
  ];

  return (
    <div className={s.page}>
      <header className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Reports</h1>
          <p className={s.pageSub}>Export your organisation’s learning data as CSV (for spreadsheets) or PDF (for sharing).</p>
        </div>
        {loading && <span className={s.loadingNote} role="status">Loading data…</span>}
      </header>

      <section className={s.kpis} aria-label="Data included in the reports">
        {KPIS.map(k => (
          <div key={k.label} className={s.kpi}>
            <span className={s.kpiIcon} aria-hidden="true">{k.icon}</span>
            <div>
              <div className={s.kpiValue}>{loading ? '—' : k.value}</div>
              <div className={s.kpiLabel}>{k.label}</div>
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="rp-export-h">
        <h2 id="rp-export-h" className={s.sectionTitle}>Export reports</h2>
        <div className={s.reportGrid}>
          {REPORTS.map(r => {
            const busy = exporting === r.key || exporting === `${r.key}_pdf`;
            return (
              <article key={r.key} className={s.reportCard}>
                <div className={s.reportHead}>
                  <span className={s.reportIcon} aria-hidden="true">{r.icon}</span>
                  <div className={s.reportText}>
                    <h3 className={s.reportTitle}>{r.title}</h3>
                    <p className={s.reportSub}>{loading ? 'Loading…' : r.sub}</p>
                  </div>
                </div>
                <p className={s.reportDesc}>{r.desc}</p>
                <div className={s.reportActions}>
                  <button
                    suppressHydrationWarning
                    className={s.btnCsv}
                    disabled={loading || busy}
                    onClick={() => handleCsv(r.key)}
                    aria-label={`Download ${r.title} as CSV`}
                  >
                    <DownloadIcon /> {exporting === r.key ? 'Preparing…' : 'CSV'}
                  </button>
                  <button
                    suppressHydrationWarning
                    className={s.btnPdf}
                    disabled={loading || busy}
                    onClick={() => handlePdf(r.key)}
                    aria-label={`Download ${r.title} as PDF`}
                  >
                    <DownloadIcon /> {exporting === `${r.key}_pdf` ? 'Preparing…' : 'PDF'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
