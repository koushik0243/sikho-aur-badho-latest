'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import { API_URL } from '../../../lib/constant';
import { useMediaToken, secureMediaUrl, downloadMedia } from '../../../lib/mediaToken';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./ViewCourseBuilder.module.css";
import ViewQASection, { pickSelected } from './ViewQASection';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

/* ── Icons ──────────────────────────────────────────────────────── */
const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);
const MenuIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
);

// Shown instead of "Watch Video" while an uploaded video (MOV/AVI/MKV…) is being
// converted to an MP4 that plays in every browser.
const VIDEO_PREPARING_TEXT = 'Preparing video… (ready in a few minutes)';
const VIDEO_FAILED_TEXT = 'Video could not be prepared for playback — please upload it again.';

// Aptitude Test → Settings defaults when a course has none saved (same as the course builder).
const DEFAULT_APTITUDE_SETTINGS = {
  timeLimit: '60', timeUnit: 'Minutes', hideQuizTime: false,
  quizAutoStart: false, questionLayout: 'single', questionOrder: 'sequential', hideQuestionNumber: false,
};

const listOf = res => (Array.isArray(res?.data) ? res.data : []);

/**
 * The selected categories as a tree: every selected item plus its parents (so
 * the path is visible), nested under their parents, sorted by name.
 * @returns {Array<{ _id, name, selected: boolean, children: Array }>}
 */
function selectedCategoryTree(allCategories, selectedIds) {
  const byId = new Map(allCategories.map(c => [c._id, c]));
  const selected = new Set(selectedIds.filter(id => byId.has(id)));
  const include = new Set();
  for (const id of selected) {
    for (let cur = byId.get(id); cur && !include.has(cur._id); cur = byId.get(cur.parentId)) include.add(cur._id);
  }
  const nodes = new Map([...include].map(id => [id, { _id: id, name: byId.get(id).name, selected: selected.has(id), children: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(byId.get(node._id).parentId);
    (parent ? parent.children : roots).push(node);
  }
  const sortTree = list => { list.sort((a, b) => a.name.localeCompare(b.name)); list.forEach(n => sortTree(n.children)); return list; };
  return sortTree(roots);
}

function CategoryTree({ nodes, depth = 0 }) {
  return (
    <ul className={depth ? s.catTreeChildren : s.catTreeList} role={depth ? 'group' : 'tree'} aria-label={depth ? undefined : 'Selected categories'}>
      {nodes.map(n => (
        <li key={n._id} role="treeitem" aria-selected={n.selected}>
          <span className={n.selected ? s.catTreeSelected : s.catTreeParent}>
            {n.selected && <span className={s.catTreeCheck} aria-hidden="true">✓</span>}
            {n.name}
          </span>
          {n.children.length > 0 && <CategoryTree nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

/* ── Topic type colours (same palette as CourseBuilder) ────────── */
const TYPE_STYLE = {
  lesson:     { bg: '#eff6ff', color: '#2563eb', label: 'Lesson' },
  quiz:       { bg: '#ede9fe', color: '#7c3aed', label: 'Quiz' },
  zoom_link:  { bg: '#ecfeff', color: '#0891b2', label: 'Zoom' },
  assignment: { bg: '#fef3c7', color: '#b45309', label: 'Assignment' },
  document:   { bg: '#f0fdf4', color: '#166534', label: 'Document' },
  file:       { bg: '#fff7ed', color: '#c2410c', label: 'File' },
};

export default function ViewCourseBuilder() {
  const router = useRouter();
  // Course files open with a short-lived media token (server/middleware/mediaAuth.js).
  const [mediaToken] = useMediaToken();
  const params = useParams();
  const id = params?.id;

  const [step, setStep] = useState(1);
  const [optionTab, setOptionTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [certTemplates, setCertTemplates] = useState([]);
  const [aptitudeQuestions, setAptitudeQuestions] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState({});   // quiz topic id → its questions
  const [quizQuestionsLoading, setQuizQuestionsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiServiceHandler('GET', `course/edit/${id}`).catch(() => null),
      apiServiceHandler('GET', `chapter/list?courseId=${id}`).catch(() => null),
      apiServiceHandler('GET', `topic/list?courseId=${id}`).catch(() => null),
      apiServiceHandler('GET', 'course-category/list-all').catch(() => null),
      apiServiceHandler('GET', 'course-subcategory/list').catch(() => null),
      apiServiceHandler('GET', 'tags/list').catch(() => null),
      apiServiceHandler('GET', 'certificate-template/list').catch(() => null),
      apiServiceHandler('GET', `aptitude-questions/list?courseId=${id}`).catch(() => null),
    ]).then(([courseRes, chaptersRes, topicsRes, catRes, subRes, tagsRes, certRes, aptRes]) => {
      setAptitudeQuestions(listOf(aptRes));
      setCourse(courseRes?.data ?? null);
      setChapters(
        Array.isArray(chaptersRes?.data)
          ? chaptersRes.data.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : []
      );
      setTopics(Array.isArray(topicsRes?.data) ? topicsRes.data : []);

      const cats = Array.isArray(catRes?.data) ? catRes.data : [];
      const subs = Array.isArray(subRes?.data) ? subRes.data : [];
      const catIdSet = new Set(cats.map(c => String(c._id)));
      setAllCategories([
        ...cats.map(c => ({ _id: String(c._id), name: c.title || c.name, parentId: c.parentId ? String(c.parentId) : null })),
        ...subs
          .filter(s => !catIdSet.has(String(s._id)))
          .map(s => ({
            _id: String(s._id),
            name: s.name,
            parentId: s.categoryId?._id ? String(s.categoryId._id) : (s.categoryId ? String(s.categoryId) : null),
          })),
      ]);
      setTags(Array.isArray(tagsRes?.data) ? tagsRes.data : []);
      setCertTemplates(Array.isArray(certRes?.data) ? certRes.data : []);
    }).finally(() => setLoading(false));
  }, [id]);

  // Each quiz's questions (the topic list only carries the selected ids).
  useEffect(() => {
    const quizzes = topics.filter(t => t.video_type === 'quiz' && t._id);
    if (loading) return undefined;
    let cancelled = false;
    Promise.all(quizzes.map(q =>
      apiServiceHandler('GET', `quiz-questions/list?quizId=${q._id}`)
        .then(res => [String(q._id), listOf(res)])
        .catch(() => [String(q._id), []])))
      .then(entries => { if (!cancelled) setQuizQuestions(Object.fromEntries(entries)); })
      .finally(() => { if (!cancelled) setQuizQuestionsLoading(false); });
    return () => { cancelled = true; };
  }, [topics, loading]);

  if (loading) {
    return (
      <SuperAdminShell activeSection="course-builder">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, fontSize: 16, color: '#6b7280' }}>
          Loading course data…
        </div>
      </SuperAdminShell>
    );
  }

  if (!course) {
    return (
      <SuperAdminShell activeSection="course-builder">
        <p style={{ padding: '40px', color: '#dc2626' }}>Course not found.</p>
      </SuperAdminShell>
    );
  }

  /* ── Derive selected IDs from course data ──────────────────── */
  // All selected categories (catIds; older courses only have catId) + sub-categories.
  const catIds = (Array.isArray(course.catIds) && course.catIds.length ? course.catIds : [course.catId])
    .map(c => c?._id ?? c).filter(Boolean).map(String);
  const subCatIds = Array.isArray(course.subCatIds) ? course.subCatIds.filter(Boolean).map(sc => String(sc._id ?? sc)) : [];
  const selectedCatIds = [...new Set([...catIds, ...subCatIds])];
  const catTree = selectedCategoryTree(allCategories, selectedCatIds);
  const selectedTagIds = Array.isArray(course.tagIds) ? course.tagIds.map(t => String(t._id ?? t)) : [];
  const certTemplateId = course.certificate_template_id?._id
    ? String(course.certificate_template_id._id)
    : (course.certificate_template_id ? String(course.certificate_template_id) : '');

  /* ── Side panel (read-only mirror of CourseBuilder SidePanel) ── */
  function SidePanel() {
    return (
      <div className={s.sidePanel}>
        {/* Featured Image */}
        <div className={s.sidePanelCard} style={{ border: 'none' }}>
          <div className={s.sidePanelTitle}>Featured Image</div>
          <div className={s.sidePanelBody} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {course.course_image
              ? <img src={`${API_URL}${course.course_image}`} alt="Featured preview" style={{ maxWidth: 100, width: '100%', display: 'block', objectFit: 'contain', borderRadius: 6 }} />
              : <span className={s.uploadAreaNote}>No image uploaded</span>}
          </div>
        </div>

        {/* Intro Video */}
        <div className={s.sidePanelCard} style={{ border: 'none' }}>
          <div className={s.sidePanelTitle}>Intro Video</div>
          <div className={s.sidePanelBody}>
            {course.intro_video && course.introVideoStatus === 'processing' ? (
              <span style={{ fontSize: 13, color: '#9ca3af' }}>{VIDEO_PREPARING_TEXT}</span>
            ) : course.intro_video && course.introVideoStatus === 'failed' ? (
              <span style={{ fontSize: 13, color: '#dc2626' }}>{VIDEO_FAILED_TEXT}</span>
            ) : course.intro_video ? (
              <a
                href={secureMediaUrl(course.intro_video, mediaToken) || undefined}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13, color: '#2563eb', textDecoration: 'underline' }}
              >
                Watch Video
              </a>
            ) : (
              <span style={{ fontSize: 13, color: '#9ca3af' }}>N/A</span>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className={s.sidePanelCard} style={{ border: 'none' }}>
          <div className={s.sidePanelTitle}>Categories</div>
          <div className={s.sidePanelBody}>
            {catTree.length > 0 ? (
              <CategoryTree nodes={catTree} />
            ) : (
              <span style={{ fontSize: 13, color: '#9ca3af' }}>N/A</span>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className={s.sidePanelCard} style={{ border: 'none' }}>
          <div className={s.sidePanelTitle}>Tags</div>
          <div className={s.sidePanelBody}>
            {selectedTagIds.length > 0 ? (
              <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                {tags
                  .filter(tag => selectedTagIds.includes(String(tag._id)))
                  .map(tag => tag.title)
                  .join(', ')}
              </span>
            ) : (
              <span style={{ fontSize: 13, color: '#9ca3af' }}>N/A</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Step 1: Basics (read-only) ────────────────────────────── */
  function Step1() {
    return (
      <div className={s.builderBody}>
        <div className={s.main}>
          {/* Title & Description — 2-column */}
          <div className={s.formCard} style={{ border: 'none' }}>
            <div className={s.formCardBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                <div className={s.formGroup}>
                  <label className={s.label}>Course Title</label>
                  <div style={{ fontSize: 14, color: '#111827', padding: '6px 0', lineHeight: 1.6 }}>{course.title || '—'}</div>
                </div>
                <div className={s.formGroup}>
                  <label className={s.label}>Description</label>
                  <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', padding: '6px 0' }}>{course.desc || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {SidePanel()}

        {/* Options + Aptitude Test — full width of the content area */}
        <div className={s.fullRow}>
          {/* Options panel */}
          <div className={s.formCard} style={{ border: 'none' }}>
            <div className={s.formCardHeader}>
              <div className={s.formCardHeaderLeft}>{MenuIcon} Options</div>
            </div>
            <div className={s.optionsLayout}>
              <div className={s.optionsNav}>
                {[
                  { key: 'general',      label: 'General' },
                  { key: 'enrollment',   label: 'Enrollment' },
                ].map(tab => (
                  <div
                    key={tab.key}
                    className={`${s.optionsNavItem} ${optionTab === tab.key ? s.optionsNavItemActive : ''}`}
                    onClick={() => setOptionTab(tab.key)}
                  >
                    {tab.label}
                  </div>
                ))}
              </div>
              <div className={s.optionsPanel}>
                {optionTab === 'general' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 32px' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Difficulty Level</div>
                      <div style={{ fontSize: 14, color: '#111827', textTransform: 'capitalize' }}>{course.level || 'Beginner'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Duration (Hours)</div>
                      <div style={{ fontSize: 14, color: '#111827' }}>{course.duration_hr || '0'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Duration (Minutes)</div>
                      <div style={{ fontSize: 14, color: '#111827' }}>{course.duration_min || '00'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Enable Reviews</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: course.enable_review ? '#16a34a' : '#6b7280' }}>{course.enable_review ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Q&amp;A Enabled</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: course.qna_enabled ? '#16a34a' : '#6b7280' }}>{course.qna_enabled ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                )}
                {optionTab === 'content-drip' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 32px' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Enable Content Drip</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>No</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Release course content gradually to enrolled students over time.</div>
                    </div>
                  </div>
                )}
                {optionTab === 'enrollment' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 32px' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Max Students (0 = unlimited)</div>
                      <div style={{ fontSize: 14, color: '#111827' }}>{course.max_students || '0'}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Aptitude Test (read-only) */}
          <div className={s.formCard} style={{ border: 'none' }}>
            <div className={s.formCardHeader}>
              <div className={s.formCardHeaderLeft}>{MenuIcon} Aptitude Test</div>
            </div>
            <div style={{ padding: '4px 0 0' }}>
              <ViewQASection
                kind="aptitude"
                settings={{ ...DEFAULT_APTITUDE_SETTINGS, ...(course.aptitudeSettings || {}) }}
                questions={pickSelected(aptitudeQuestions, course.aptitudeSelectedQuestionIds)}
                totalGenerated={aptitudeQuestions.length}
                extraRows={[
                  ['Status', course.aptitudeEnabled ? 'Enabled' : 'Disabled'],
                  ['Context', course.aptitudeContext || '—'],
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Step 2: Curriculum (read-only) ────────────────────────── */
  function Step2() {
    return (
      <div className={s.curriculumWrap}>
        {chapters.length > 0 && (
          <div className={s.curriculumHeader}>
            <div className={s.curriculumHeading}>
              <button type="button" className={s.btnCurriculumBack} onClick={() => setStep(1)}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <span>Curriculum</span>
            </div>
          </div>
        )}
        {chapters.length === 0 ? (
          <div className={s.curriculumEmpty}>
            <div className={s.curriculumEmptyTitle}>No chapters added yet.</div>
            <div className={s.curriculumEmptySub}>This course has no curriculum content.</div>
          </div>
        ) : (
          <div className={s.chapterList}>
            {chapters.map((ch, chIdx) => {
              const chTopics = topics
                .filter(t => String(t.chapterId) === String(ch._id))
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              return (
                <div key={ch._id ?? chIdx} className={s.chCard} style={{ border: 'none' }}>
                  <div className={s.chSavedTop}>
                    <div className={s.chSavedInfo}>
                      <span className={s.chSavedChapterNo}>Chapter {ch.order ?? chIdx + 1}</span>
                      <span className={s.chSavedTitle}>{ch.title || '(Untitled)'}</span>
                      {ch.desc && <span className={s.chSavedDesc}>{ch.desc}</span>}
                    </div>
                  </div>
                  {chTopics.length > 0 && (
                    <div className={s.lessonList}>
                      {chTopics.map((t, ti) => {
                        const ts = TYPE_STYLE[t.video_type] ?? { bg: '#f3f4f6', color: '#374151', label: t.video_type || '—' };
                        const isZoom       = t.video_type === 'zoom_link';
                        const isAssignment = t.video_type === 'assignment';
                        const isLesson     = t.video_type === 'lesson';
                        const isQuiz       = t.video_type === 'quiz';
                        const fileUrl      = t.attachments?.[0]?.url || t.fileUrl || null;
                        return (
                          <div key={t._id ?? ti} className={s.lessonRow} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: ts.color, background: ts.bg, borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                                {ts.label}
                              </span>
                              {isZoom ? (
                                <a
                                  href={t.videoUrl || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={s.lessonName}
                                  style={{ color: '#0891b2', textDecoration: 'underline' }}
                                >
                                  {t.title || '(Untitled)'}
                                </a>
                              ) : (
                                <span className={s.lessonName}>{t.title || '(Untitled)'}</span>
                              )}
                              {!isLesson && (t.duration_hr || t.duration_min) && (
                                <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
                                  {t.duration_hr || 0}h {t.duration_min || 0}m
                                </span>
                              )}
                            </div>

                            {/* Lesson: always show all fields with labels */}
                            {isLesson && (
                              <div style={{ paddingLeft: 52, display: 'flex', flexDirection: 'column', gap: 6, width: '100%', marginTop: 2 }}>
                                {/* Content */}
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, width: 112, flexShrink: 0, paddingTop: 1 }}>Content</span>
                                  <span style={{ fontSize: 12, color: t.desc ? '#374151' : '#9ca3af', lineHeight: 1.5 }}>{t.desc || '—'}</span>
                                </div>
                                {/* Featured Image */}
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, width: 112, flexShrink: 0, paddingTop: 1 }}>Featured Image</span>
                                  {t.imageUrl
                                    ? <a href={secureMediaUrl(t.imageUrl, mediaToken) || undefined} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'underline', lineHeight: 1.5 }}>View Image</a>
                                    : <span style={{ fontSize: 12, color: '#9ca3af' }}>N/A</span>}
                                </div>
                                {/* Video */}
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, width: 112, flexShrink: 0, paddingTop: 1 }}>Video</span>
                                  {!t.videoUrl
                                    ? <span style={{ fontSize: 12, color: '#9ca3af' }}>N/A</span>
                                    : t.videoStatus === 'processing'
                                      ? <span style={{ fontSize: 12, color: '#9ca3af' }}>{VIDEO_PREPARING_TEXT}</span>
                                    : t.videoStatus === 'failed'
                                      ? <span style={{ fontSize: 12, color: '#dc2626' }}>{VIDEO_FAILED_TEXT}</span>
                                      : <a href={secureMediaUrl(t.videoUrl, mediaToken) || undefined} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'underline', lineHeight: 1.5 }}>Watch Video</a>}
                                </div>
                                {/* Video Playback Time */}
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, width: 112, flexShrink: 0 }}>Playback Time</span>
                                  <span style={{ fontSize: 12, color: '#374151' }}>{t.duration_hr || 0}h &nbsp;{t.duration_min || 0}m &nbsp;{t.duration_sec || 0}s</span>
                                </div>
                              </div>
                            )}

                            {/* Quiz: settings + selected questions & answers */}
                            {isQuiz && (
                              <div style={{ paddingLeft: 52, width: '100%', boxSizing: 'border-box', marginTop: 6 }}>
                                <ViewQASection
                                  kind="quiz"
                                  settings={t.quizSettings || {}}
                                  questions={pickSelected(quizQuestions[String(t._id)], t.quizSettings?.selectedQuestionIds)}
                                  totalGenerated={quizQuestionsLoading ? undefined : (quizQuestions[String(t._id)] || []).length}
                                  loading={quizQuestionsLoading}
                                />
                              </div>
                            )}

                            {/* Assignment: show file link */}
                            {isAssignment && fileUrl && (
                              <div style={{ paddingLeft: 52 }}>
                                <a
                                  href={secureMediaUrl(fileUrl, mediaToken) || undefined}
                                  download
                                  onClick={e => { e.preventDefault(); downloadMedia(fileUrl, t.attachments?.[0]?.name); }}
                                  style={{ fontSize: 12, color: '#b45309', textDecoration: 'underline', cursor: 'pointer' }}
                                >
                                  View Assignment
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className={s.chCardBar}>
                    <span style={{ fontSize: 13, color: '#9ca3af', padding: '4px 8px' }}>
                      {chTopics.length} topic{chTopics.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ── Step 3: Additional (read-only, 3-column) ─────────────── */
  function Step3() {
    const field = (label, value, multiline = false) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ fontSize: 14, color: '#111827', lineHeight: 1.7, whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>
          {value || '—'}
        </span>
      </div>
    );

    return (
      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        {/* Overview card */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Overview</span>
            <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 10 }}>Provide essential course information to attract and inform potential students</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 32px' }}>
            {field('What Will I Learn?', course.what_will_learn, true)}
            {field('Target Audience', course.target_audience, true)}
            {field('Total Course Duration', `${course.duration_hr || '0'} hour(s)  ${course.duration_min || '00'} min(s)`)}
            {field('Materials Included', course.materials_included, true)}
            {field('Requirements / Instructions', course.requirements, true)}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #f3f4f6', marginBottom: 28 }} />

        {/* Certificate card */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Certificate</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 32px' }}>
            {field('Certificate Template', certTemplates.find(t => String(t._id) === certTemplateId)?.title || '— None selected —')}
          </div>
        </div>
      </div>
    );
  }

  /* ── Main render ──────────────────────────────────────────── */
  return (
    <SuperAdminShell activeSection="course-builder">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/course-builder')}>
        {BackArrow} Back to Course Builder
      </button>
      <div style={{ background: '#fff', margin: '-24px -28px', minHeight: 'calc(100vh - 58px)' }}>
      {/* Top bar — same structure as CourseBuilder */}
      <div className={s.topBar}>
        <div className={s.topBarLeft}>
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          View Course
        </div>

        {/* Step tabs */}
        <div className={s.steps}>
          {[
            { n: 1, label: 'Basics' },
            { n: 2, label: 'Curriculum' },
            { n: 3, label: 'Additional' },
          ].map((st, i) => (
            <span key={st.n} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <span className={s.stepSep} />}
              <span
                className={`${s.step} ${step === st.n ? s.stepActive : ''}`}
                onClick={() => setStep(st.n)}
              >
                <span className={s.stepNum}>{st.n}</span>
                {st.label}
              </span>
            </span>
          ))}
        </div>


      </div>

      {/* Step content */}
      {step === 1 && Step1()}
      {step === 2 && Step2()}
      {step === 3 && Step3()}


      </div>
    </SuperAdminShell>
  );
}
