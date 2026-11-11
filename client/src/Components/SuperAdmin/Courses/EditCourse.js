'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./EditCourse.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const TOPIC_TYPES = [
  { value: 'document',  label: 'Document'  },
  { value: 'quiz',      label: 'Quiz'      },
  { value: 'file',      label: 'File'      },
  { value: 'zoom_link', label: 'Zoom Link' },
];

const CourseInfoIcon = (
  <svg viewBox="0 0 20 20" fill="#2563eb" width="18" height="18">
    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4 7.962 7.962 0 009 5.189V4.804z" />
  </svg>
);

const PricingIcon = (
  <svg viewBox="0 0 20 20" fill="#e97a0a" width="18" height="18">
    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
  </svg>
);

const TrashIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const ChevronUpIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const MenuIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
);

function parseDecimal(v) {
  if (v?.$numberDecimal !== undefined) return v.$numberDecimal;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '0.00';
}

const VALID_STATUSES = ['active', 'inactive'];
function normalizeStatus(status) {
  return VALID_STATUSES.includes(status) ? status : 'active';
}
const VALID_TOPIC_STATUSES = ['active', 'inactive'];
function normalizeTopicStatus(status) {
  return VALID_TOPIC_STATUSES.includes(status) ? status : 'active';
}

function newTopic(order) {
  return { title: '', order, type: 'document', file: null, zoom_link_url: '', status: 'active', isOpen: true };
}

function newChapter(order) {
  return { title: '', order, desc: '', status: 'active', isOpen: true, isTopicsOpen: true, topics: [newTopic(1)] };
}

export default function EditCourse() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subsByCategory, setSubsByCategory] = useState({});
  const [catSubVal, setCatSubVal] = useState('');
  const [form, setForm] = useState({
    title: '', desc: '', catId: '', subCatIds: [],
    status: 'draft', duration_hr: '0', duration_min: '00', course_price: '',
  });
  const [courseInfoOpen, setCourseInfoOpen] = useState(true);
  const [chapters, setChapters] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState(null); // { chIdx, tIdx }

  const loadDropdowns = useCallback(() => {
    const p1 = apiServiceHandler('GET', 'course-category/list')
      .then(res => setCategories(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
    const p2 = apiServiceHandler('GET', 'course-subcategory/list')
      .then(res => {
        const subs = Array.isArray(res?.data) ? res.data : [];
        const grouped = {};
        subs.forEach(sub => {
          const catId = sub.categoryId?._id ?? sub.categoryId;
          if (!grouped[catId]) grouped[catId] = [];
          grouped[catId].push(sub);
        });
        setSubsByCategory(grouped);
      })
      .catch(() => {});
    return Promise.all([p1, p2]);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const pCourse   = apiServiceHandler('GET', `course/edit/${id}`).catch(() => null);
    const pChapters = apiServiceHandler('GET', `chapter/list?courseId=${id}`).catch(() => null);
    const pTopics   = apiServiceHandler('GET', `topic/list?courseId=${id}`).catch(() => null);
    Promise.all([loadDropdowns(), pCourse, pChapters, pTopics])
      .then(([, courseRes, chaptersRes, topicsRes]) => {
        const course = courseRes?.data;
        if (!course) { setNotFound(true); setLoading(false); return; }
        setForm({
          title: course.title ?? '', desc: course.desc ?? '',
          catId: course.catId?._id ?? course.catId ?? '',
          subCatIds: Array.isArray(course.subCatIds) ? course.subCatIds.map(s => s._id ?? s) : [],
          status: course.status ?? 'draft',
          duration_hr: course.duration_hr ?? '0',
          duration_min: String(course.duration_min ?? '00').padStart(2, '0'),
          course_price: parseDecimal(course.course_price),
        });
        const catId = course.catId?._id ?? course.catId;
        const firstSubId = Array.isArray(course.subCatIds) && course.subCatIds.length > 0
          ? (course.subCatIds[0]?._id ?? course.subCatIds[0]) : '';
        if (catId && firstSubId) setCatSubVal(`${catId}__${firstSubId}`);
        else if (catId) setCatSubVal(catId);

        // Group topics by chapterId
        const allTopics = Array.isArray(topicsRes?.data) ? topicsRes.data : [];
        const topicsByChapter = {};
        allTopics.forEach(tp => {
          const chId = tp.chapterId?._id ?? tp.chapterId;
          if (!topicsByChapter[chId]) topicsByChapter[chId] = [];
          topicsByChapter[chId].push({
            _id: tp._id, title: tp.title ?? '', order: tp.order ?? 1,
            type: tp.type ?? 'document', status: normalizeTopicStatus(tp.status), file: null, zoom_link_url: tp.zoom_link_url ?? '', isOpen: true,
          });
        });

        const existingChapters = Array.isArray(chaptersRes?.data)
          ? chaptersRes.data.map(ch => ({
              _id: ch._id, title: ch.title ?? '', desc: ch.desc ?? '',
              order: ch.order ?? 1, status: normalizeStatus(ch.status), isOpen: true, isTopicsOpen: true,
              topics: topicsByChapter[ch._id]?.length
                ? topicsByChapter[ch._id]
                : [newTopic(1)],
            }))
          : [newChapter(1)];
        setChapters(existingChapters);
      })
      .finally(() => setLoading(false));
  }, [id, loadDropdowns]);

  function handleCatSubChange(e) {
    const val = e.target.value;
    setCatSubVal(val);
    if (val) {
      const [catId, subId] = val.split('__');
      setForm(prev => ({ ...prev, catId, subCatIds: subId ? [subId] : [] }));
    } else {
      setForm(prev => ({ ...prev, catId: '', subCatIds: [] }));
    }
  }

  function setField(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  // Chapter operations
  function addChapter() {
    setChapters(prev => [...prev, newChapter(prev.length + 1)]);
  }
  function removeChapter(idx) { setChapters(prev => prev.filter((_, i) => i !== idx)); }
  function updateChapter(idx, key, val) {
    setChapters(prev => { const c = [...prev]; c[idx] = { ...c[idx], [key]: val }; return c; });
  }
  function toggleChapter(idx) {
    setChapters(prev => { const c = [...prev]; c[idx] = { ...c[idx], isOpen: !c[idx].isOpen }; return c; });
  }

  function toggleTopic(chIdx, tIdx) {
    setChapters(prev => {
      const c = [...prev];
      const topics = [...c[chIdx].topics];
      topics[tIdx] = { ...topics[tIdx], isOpen: !topics[tIdx].isOpen };
      c[chIdx] = { ...c[chIdx], topics };
      return c;
    });
  }
  function toggleTopics(idx) {
    setChapters(prev => { const c = [...prev]; c[idx] = { ...c[idx], isTopicsOpen: !c[idx].isTopicsOpen }; return c; });
  }

  // Topic operations
  function addTopic(chIdx) {
    setChapters(prev => {
      const c = [...prev];
      c[chIdx] = { ...c[chIdx], topics: [...c[chIdx].topics, newTopic(c[chIdx].topics.length + 1)] };
      return c;
    });
  }
  function removeTopic(chIdx, tIdx) {
    setChapters(prev => {
      const c = [...prev];
      c[chIdx] = { ...c[chIdx], topics: c[chIdx].topics.filter((_, i) => i !== tIdx) };
      return c;
    });
  }
  function updateTopic(chIdx, tIdx, key, val) {
    setChapters(prev => {
      const c = [...prev];
      const topics = [...c[chIdx].topics];
      topics[tIdx] = { ...topics[tIdx], [key]: val };
      c[chIdx] = { ...c[chIdx], topics };
      return c;
    });
  }

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = 'Course title is required.';
    if (!form.desc.trim()) e.desc = 'Description is required.';
    if (!form.catId) e.catSubCat = 'Category / Sub-Category is required.';
    chapters.forEach((ch, i) => {
      if (!ch.title.trim()) e[`chTitle_${i}`] = `Chapter ${i + 1} title is required.`;
    });
    return e;
  }

  async function handleSubmit(publishStatus) {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await apiServiceHandler('PUT', `course/update/${id}`, {
        title: form.title.trim(), desc: form.desc.trim(),
        catId: form.catId, subCatIds: form.subCatIds,
        status: publishStatus,
        duration_hr: form.duration_hr || '0', duration_min: form.duration_min || '00',
        course_price: form.course_price || '0',
        totalChapters: chapters.length,
      });

      const chapterResults = await Promise.all(
        chapters.map((ch, idx) => {
          const data = {
            title: (ch.title ?? '').trim(), desc: (ch.desc ?? '').trim(),
            order: ch.order ?? idx + 1, status: ch.status ?? 'active',
          };
          if (ch._id) return apiServiceHandler('PUT', `chapter/update/${ch._id}`, data).then(() => ch);
          return apiServiceHandler('POST', 'chapter/create', {
            ...data, courseId: id, isPublished: true, totalTopics: ch.topics.length,
          });
        })
      );

      const topicPromises = [];
      chapters.forEach((ch, chIdx) => {
        const chId = ch._id ?? chapterResults[chIdx]?.data?._id;
        if (!chId) return;
        ch.topics.forEach((tp, tIdx) => {
          const data = {
            title: (tp.title ?? '').trim(), order: tp.order ?? tIdx + 1,
            type: tp.type, status: tp.status ?? 'active',
            zoom_link_url: tp.zoom_link_url ?? '',
          };
          if (tp._id) {
            topicPromises.push(apiServiceHandler('PUT', `topic/update/${tp._id}`, data));
          } else {
            topicPromises.push(apiServiceHandler('POST', 'topic/create', { ...data, chapterId: chId, courseId: id }));
          }
        });
      });

      await Promise.all(topicPromises);
      toast.success('Course updated successfully.');
      router.push('/superadmin/courses');
    } catch (err) {
      toast.warning(err?.message || 'Failed to update course. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SuperAdminShell activeSection="courses">
        <p style={{ padding: '40px', color: '#6b7280' }}>Loading…</p>
      </SuperAdminShell>
    );
  }

  if (notFound) {
    return (
      <SuperAdminShell activeSection="courses">
        <p style={{ padding: '40px', color: '#dc2626' }}>Course not found.</p>
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell activeSection="courses">
      <h1 className={s.pageTitle}>Edit Course</h1>
      <p className={s.pageSubtitle}>Update course details, chapters and pricing</p>

      {/* ── Course Information ─────────────────────────────────── */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader} onClick={() => setCourseInfoOpen(v => !v)}>
          <div className={s.sectionHeaderLeft}>{CourseInfoIcon} Course Information</div>
          <span className={`${s.chevron} ${!courseInfoOpen ? s.chevronDown : ''}`}>▲</span>
        </div>
        {courseInfoOpen && (
          <div className={s.sectionBody}>
            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label className={s.label}>Course Title <span className={s.required}>*</span></label>
                <input className={s.input} type="text" placeholder="Enter course title"
                  value={form.title} onChange={e => setField('title', e.target.value)} />
                {errors.title && <span className={s.errorMsg}>{errors.title}</span>}
              </div>
              <div className={s.formGroup}>
                <label className={s.label}>Category / Sub-Category <span className={s.required}>*</span></label>
                <select className={s.select} value={catSubVal} onChange={handleCatSubChange}>
                  <option value="">Select category / sub-category</option>
                  {categories.map(cat => {
                    const subs = subsByCategory[cat._id] || [];
                    if (subs.length === 0) return null;
                    return (
                      <optgroup key={cat._id} label={cat.title}>
                        {subs.map(sub => (
                          <option key={sub._id} value={`${cat._id}__${sub._id}`}>{sub.name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                {errors.catSubCat && <span className={s.errorMsg}>{errors.catSubCat}</span>}
              </div>
            </div>
            <div className={s.formRowFull}>
              <div className={s.formGroup}>
                <label className={s.label}>Description <span className={s.required}>*</span></label>
                <textarea className={s.textarea} placeholder="Enter course description"
                  value={form.desc} onChange={e => setField('desc', e.target.value)} />
                {errors.desc && <span className={s.errorMsg}>{errors.desc}</span>}
              </div>
            </div>
            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label className={s.label}>Status</label>
                <select className={s.select} value={form.status} onChange={e => setField('status', e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="deleted">Deleted</option>
                </select>
              </div>
              <div className={s.formGroup}>
                <label className={s.label}>Course Image</label>
                <input className={s.inputFile} type="file" accept="image/*" />
              </div>
            </div>
            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label className={s.label}>Duration (Hours)</label>
                <input className={s.input} type="number" min="0"
                  value={form.duration_hr} onChange={e => setField('duration_hr', e.target.value)} />
              </div>
              <div className={s.formGroup}>
                <label className={s.label}>Duration (Minutes)</label>
                <select className={s.select} value={form.duration_min} onChange={e => setField('duration_min', e.target.value)}>
                  {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label className={s.label}>Course Price (Rs.)</label>
                <input className={s.input} type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.course_price}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setField('course_price', val);
                  }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Chapters ────────────────────────────────────────────── */}
      {chapters.map((ch, chIdx) => (
        <div key={ch._id ?? chIdx} className={s.chapterCard}>
          <div className={s.chapterHeader}>
            <div className={s.chapterHeaderLeft}>
              {MenuIcon}
              <span>Chapter {chIdx + 1}</span>
            </div>
            <div className={s.chapterHeaderRight}>
              <button type="button" className={s.btnIconDanger} onClick={() => removeChapter(chIdx)} title="Remove chapter">
                {TrashIcon}
              </button>
              <button type="button" className={`${s.btnIconGray} ${ch.isOpen ? '' : s.rotated}`} onClick={() => toggleChapter(chIdx)} title="Toggle">
                {ChevronUpIcon}
              </button>
            </div>
          </div>
          {ch.isOpen && (
            <div className={s.chapterBody}>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label className={s.label}>Chapter Title <span className={s.required}>*</span></label>
                  <input className={s.input} type="text" placeholder="Enter chapter title"
                    value={ch.title} onChange={e => updateChapter(chIdx, 'title', e.target.value)} />
                  {errors[`chTitle_${chIdx}`] && <span className={s.errorMsg}>{errors[`chTitle_${chIdx}`]}</span>}
                </div>
                <div className={s.formGroup}>
                  <label className={s.label}>Order</label>
                  <input className={s.input} type="number" min="1"
                    value={ch.order} onChange={e => updateChapter(chIdx, 'order', e.target.value)} />
                </div>
              </div>
              <div className={s.formRowFull}>
                <div className={s.formGroup}>
                  <label className={s.label}>Description <span className={s.required}>*</span></label>
                  <textarea className={s.textarea} placeholder="Enter chapter description"
                    value={ch.desc} onChange={e => updateChapter(chIdx, 'desc', e.target.value)} />
                </div>
              </div>
              <div className={s.formGroupHalf}>
                <label className={s.label}>Status</label>
                <select className={s.select} value={ch.status} onChange={e => updateChapter(chIdx, 'status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Topics */}
              <div className={s.topicsContainer}>
                <div className={s.topicsHeader} onClick={() => toggleTopics(chIdx)} style={{ cursor: 'pointer' }}>
                  <span className={s.topicsLabel}>{MenuIcon} Topics ({ch.topics.length})</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" className={s.btnAddTopic} onClick={e => { e.stopPropagation(); addTopic(chIdx); }}>
                      + Add New Topic
                    </button>
                    <button type="button" className={`${s.btnIconGray} ${ch.isTopicsOpen ? '' : s.rotated}`} onClick={e => { e.stopPropagation(); toggleTopics(chIdx); }} title="Toggle topics">
                      {ChevronUpIcon}
                    </button>
                  </div>
                </div>
                {ch.isTopicsOpen && ch.topics.map((tp, tIdx) => (
                  <div key={tp._id ?? tIdx} className={s.topicCard}>
                    <div className={s.topicHeader}>
                      <div className={s.topicHeaderLeft}>
                        {MenuIcon}
                        <span>Topic {tIdx + 1}</span>
                      </div>
                      <div className={s.topicHeaderRight}>
                        <button type="button" className={s.btnIconDanger} onClick={() => setTopicToDelete({ chIdx, tIdx })} title="Remove topic">
                          {TrashIcon}
                        </button>
                        <button type="button" className={`${s.btnIconGray} ${tp.isOpen ? '' : s.rotated}`} onClick={() => toggleTopic(chIdx, tIdx)} title="Toggle topic">
                          {ChevronUpIcon}
                        </button>
                      </div>
                    </div>
                    {tp.isOpen && <div className={s.topicBody}>
                      <div className={s.formRow}>
                        <div className={s.formGroup}>
                          <label className={s.label}>Topic Title <span className={s.required}>*</span></label>
                          <input className={s.input} type="text" placeholder="Enter topic title"
                            value={tp.title} onChange={e => updateTopic(chIdx, tIdx, 'title', e.target.value)} />
                        </div>
                        <div className={s.formGroup}>
                          <label className={s.label}>Order</label>
                          <input className={s.input} type="number" min="1"
                            value={tp.order} onChange={e => updateTopic(chIdx, tIdx, 'order', e.target.value)} />
                        </div>
                      </div>
                      <div className={s.formRow}>
                        <div className={s.formGroup}>
                          <label className={s.label}>Type</label>
                          <select className={s.select} value={tp.type} onChange={e => updateTopic(chIdx, tIdx, 'type', e.target.value)}>
                            {TOPIC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div className={s.formGroup}>
                          {tp.type === 'zoom_link' ? (
                            <>
                              <label className={s.label}>Zoom Link URL</label>
                              <input key="zoom-url" className={s.input} type="url" placeholder="https://zoom.us/j/..."
                                value={tp.zoom_link_url ?? ''}
                                onChange={e => updateTopic(chIdx, tIdx, 'zoom_link_url', e.target.value)} />
                            </>
                          ) : (
                            <>
                              <label className={s.label}>File</label>
                              <input key="file-upload" className={s.inputFile} type="file" onChange={e => updateTopic(chIdx, tIdx, 'file', e.target.files[0])} />
                            </>
                          )}
                        </div>
                      </div>
                      <div className={s.formGroupHalf}>
                        <label className={s.label}>Status</label>
                        <select className={s.select} value={tp.status} onChange={e => updateTopic(chIdx, tIdx, 'status', e.target.value)}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── Add New Chapter ─────────────────────────────────────── */}
      <button type="button" className={s.btnAddChapter} onClick={addChapter}>
        + Add New Chapter
      </button>

      <ConfirmModal
        show={topicToDelete !== null}
        title="Delete Topic"
        message="Are you sure you want to delete this topic? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { removeTopic(topicToDelete.chIdx, topicToDelete.tIdx); setTopicToDelete(null); }}
        onCancel={() => setTopicToDelete(null)}
      />

      {errors.submit && <p className={s.errorMsg}>{errors.submit}</p>}
      <div className={s.formActions}>
        <button type="button" className={s.btnDraft} disabled={submitting} onClick={() => handleSubmit('draft')}>
          Save as Draft
        </button>
        <button type="button" className={s.btnPublish} disabled={submitting} onClick={() => handleSubmit('published')}>
          {submitting ? 'Saving…' : 'Save and Publish'}
        </button>
        <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/courses')}>
          Cancel
        </button>
      </div>
    </SuperAdminShell>
  );
}
