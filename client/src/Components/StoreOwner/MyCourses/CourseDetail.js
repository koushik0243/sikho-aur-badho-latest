'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import { API_URL } from '../../../lib/constant';
import { useMediaToken, secureMediaUrl } from '../../../lib/mediaToken';
import pageStyles from "./CourseDetail.module.css";
import { withDetailKit } from '../PageKit/PageKit';

// Page styles + the shared store owner detail-page look.
const vp = withDetailKit(pageStyles);
const s = withDetailKit(pageStyles);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

function getTokenUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('adminToken');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload._id || null;
  } catch { return null; }
}

function fmtDuration(hr, min) {
  const h = parseInt(hr, 10) || 0;
  const m = parseInt(min, 10) || 0;
  if (!h && !m) return null;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

function fmtDate(val) {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

const TOPIC_TYPE_LABEL = {
  lesson:     'Lesson',
  quiz:       'Quiz',
  zoom_link:  'Live Session',
  assignment: 'Assignment',
  document:   'Document',
  file:       'File',
};

const TOPIC_TYPE_COLOR = {
  lesson:     { bg: '#e8f5f5', color: '#0b7b7b', border: '#c0dedd' },
  quiz:       { bg: '#f0f0ff', color: '#4f46e5', border: '#c7d2fe' },
  zoom_link:  { bg: '#fff8e6', color: '#9a6800', border: '#f0d890' },
  assignment: { bg: '#fdf2f8', color: '#9d174d', border: '#f9a8d4' },
  document:   { bg: '#f4f6f8', color: '#4a6060', border: '#d4dee0' },
  file:       { bg: '#f4f6f8', color: '#4a6060', border: '#d4dee0' },
};

const STATUS_CLS = {
  published: 'badgePaid',
  draft:     'badgePending',
  inactive:  'badgeNeutral',
  active:    'badgePaid',
};

export default function CourseDetail() {
  const router = useRouter();
  // Only used to read lesson durations from the (hidden) videos — the files themselves aren't shown.
  const [mediaToken] = useMediaToken();
  const { id }  = useParams();
  const user    = useSelector(selectUser);

  const [course,       setCourse]       = useState(null);
  const [orgCourse,    setOrgCourse]    = useState(null);
  const [learnerCount, setLearnerCount] = useState(0);
  const [chapters,     setChapters]     = useState([]);
  const [topicMap,     setTopicMap]     = useState({}); // { chapterId: Topic[] }
  const [openChapters, setOpenChapters] = useState({});
  const [questionMap,  setQuestionMap]  = useState({}); // topicId -> Question[]
  const [videoDurMap,  setVideoDurMap]  = useState({}); // topicId -> actual duration seconds
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      setLoading(true);
      try {
        const [courseRes, chaptersRes, topicsRes] = await Promise.all([
          apiServiceHandler('GET', `course/edit/${id}`),
          apiServiceHandler('GET', `chapter/list?courseId=${id}`).catch(() => null),
          apiServiceHandler('GET', `topic/list?courseId=${id}`).catch(() => null),
        ]);

        const courseData = courseRes?.data ?? courseRes;
        setCourse(courseData);

        const chapterList = Array.isArray(chaptersRes?.data) ? chaptersRes.data
          : Array.isArray(chaptersRes) ? chaptersRes : [];
        chapterList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setChapters(chapterList);

        // Open all chapters by default
        const openState = {};
        chapterList.forEach(ch => { openState[String(ch._id)] = true; });
        setOpenChapters(openState);

        const topicList = Array.isArray(topicsRes?.data) ? topicsRes.data
          : Array.isArray(topicsRes) ? topicsRes : [];
        topicList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const tMap = {};
        topicList.forEach(t => {
          const chId = t.chapterId?._id ? String(t.chapterId._id) : String(t.chapterId);
          if (!tMap[chId]) tMap[chId] = [];
          tMap[chId].push(t);
        });
        setTopicMap(tMap);

        // Fetch questions for every quiz topic
        const quizTopics = topicList.filter(t => (t.video_type || t.type) === 'quiz');
        if (quizTopics.length > 0) {
          const qResults = await Promise.all(
            quizTopics.map(tp =>
              apiServiceHandler('GET', `quiz-questions/list?quizId=${String(tp._id)}`).catch(() => null)
            )
          );
          const qMap = {};
          quizTopics.forEach((tp, i) => {
            const raw  = qResults[i];
            const allQ = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
            const selIds = tp.quizSettings?.selectedQuestionIds;
            if (selIds?.length > 0) {
              const idSet = new Set(selIds.map(String));
              qMap[String(tp._id)] = allQ.filter(q => idSet.has(String(q._id)));
            } else {
              qMap[String(tp._id)] = allQ;
            }
          });
          setQuestionMap(qMap);
        }

        // Resolve orgId for enrollment data
        let orgId = user?.orgId ? String(user.orgId) : null;
        if (!orgId) {
          const uid = user?._id || getTokenUserId();
          if (uid) {
            const r   = await apiServiceHandler('GET', `user/admin/edit/${uid}`);
            const rec = r?.data ?? r;
            if (rec?.orgId) orgId = String(rec.orgId);
          }
        }

        if (orgId) {
          const [ocRes, caRes] = await Promise.all([
            apiServiceHandler('GET', `organization-course/list?orgId=${orgId}`).catch(() => null),
            apiServiceHandler('GET', `course-assignment/list?organizationId=${orgId}`).catch(() => null),
          ]);

          const orgCourses = Array.isArray(ocRes?.data) ? ocRes.data : (Array.isArray(ocRes) ? ocRes : []);
          const oc = orgCourses.find(item => {
            const cId = item.courseId?._id ? String(item.courseId._id) : String(item.courseId);
            return cId === id;
          });
          setOrgCourse(oc || null);

          const assignments = Array.isArray(caRes?.data) ? caRes.data : (Array.isArray(caRes) ? caRes : []);
          const count = new Set(
            assignments
              .filter(a => {
                const cId = a.courseId?._id ? String(a.courseId._id) : String(a.courseId);
                return cId === id;
              })
              .map(a => a.userId?._id ? String(a.userId._id) : String(a.userId))
          ).size;
          setLearnerCount(count);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, user?._id, user?.orgId]);

  function toggleChapter(chId) {
    setOpenChapters(prev => ({ ...prev, [chId]: !prev[chId] }));
  }

  if (loading) return <p className={vp.loadingText}>Loading…</p>;

  if (!course?._id) return (
    <>
      <button className={vp.backBtn} onClick={() => router.push('/storeowner/my-courses')}>
        {BackArrow} Back to My Courses
      </button>
      <nav className={vp.breadcrumb}>
        <button className={vp.breadcrumbLink} onClick={() => router.push('/storeowner/my-courses')}>My Courses</button>
        <span className={vp.breadcrumbSep}>›</span>
        <span className={vp.breadcrumbCurr}>Not Found</span>
      </nav>
      <p className={vp.loadingText}>Course not found.</p>
    </>
  );

  const thumb        = course.course_image ? `${API_URL}${course.course_image}` : null;
  const duration     = fmtDuration(course.duration_hr, course.duration_min);
  const courseStatus = (course.status || 'published').toLowerCase();
  const orgStatus    = (orgCourse?.status || 'active').toLowerCase();
  const totalTopics  = Object.values(topicMap).reduce((s, arr) => s + arr.length, 0);

  const statusCls = vp[STATUS_CLS[courseStatus] || 'badgeNeutral'];

  return (
    <>
      <button className={vp.backBtn} onClick={() => router.push('/storeowner/my-courses')}>
        {BackArrow} Back to My Courses
      </button>
      <nav className={vp.breadcrumb}>
        <button className={vp.breadcrumbLink} onClick={() => router.push('/storeowner/my-courses')}>My Courses</button>
        <span className={vp.breadcrumbSep}>›</span>
        <span className={vp.breadcrumbCurr}>{course.title || 'Course Details'}</span>
      </nav>

      <div className={vp.detailCardWide}>

        {/* ── Header ── */}
        <div className={vp.detailHead}>
          <div className={vp.detailHeadLeft}>
            <div className={vp.detailAvatar}>
              {(course.title || 'C')[0].toUpperCase()}
            </div>
            <div>
              <div className={vp.detailTitle}>{course.title || '—'}</div>
              <div className={vp.detailBadges}>
                <span className={statusCls} style={{ textTransform: 'capitalize' }}>{courseStatus}</span>
                {orgStatus !== 'active' && (
                  <span className={vp.badgeInactive}>org {orgStatus}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Thumbnail ── */}
        {thumb && (
          <div style={{ padding: '16px 20px 0' }}>
            <img
              src={thumb}
              alt={course.title}
              style={{
                width: '100%',
                maxHeight: 240,
                objectFit: 'contain',
                objectPosition: 'center',
                borderRadius: 8,
                background: '#f8fafa',
                border: '1px solid #edf0f3',
                display: 'block',
                padding: '30px',
              }}
            />
          </div>
        )}

        <div className={vp.detailSectionsGrid}>

          {/* ── Course details ── */}
          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Course Details</div>
            <div className={vp.sectionRows}>
              {course.catId?.title && (
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Category</span>
                  <span className={vp.sectionValue}>{course.catId.title}</span>
                </div>
              )}
              {course.level && (
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Level</span>
                  <span className={vp.sectionValue} style={{ textTransform: 'capitalize' }}>{course.level}</span>
                </div>
              )}
              {duration && (
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Duration</span>
                  <span className={vp.sectionValue}>{duration}</span>
                </div>
              )}
              {chapters.length > 0 && (
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Chapters</span>
                  <span className={vp.sectionValue}>{chapters.length}</span>
                </div>
              )}
              {totalTopics > 0 && (
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Topics</span>
                  <span className={vp.sectionValue}>{totalTopics}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Enrollment ── */}
          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Enrollment</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Learners</span>
                <span className={vp.sectionValueEmph}>{learnerCount}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Org Status</span>
                <span className={vp.sectionValue} style={{ textTransform: 'capitalize' }}>{orgStatus}</span>
              </div>
              {orgCourse?.createdAt && (
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Added On</span>
                  <span className={vp.sectionValue}>{fmtDate(orgCourse.createdAt)}</span>
                </div>
              )}
              {course.createdAt && (
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Created</span>
                  <span className={vp.sectionValue}>{fmtDate(course.createdAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Description ── */}
          {course.desc && (
            <div className={vp.sectionBlock} style={{ gridColumn: '1 / -1' }}>
              <div className={vp.sectionTitle}>Description</div>
              <div style={{ padding: '10px 14px' }}>
                <p className={vp.detailValueDesc} style={{ margin: 0 }}>{course.desc}</p>
              </div>
            </div>
          )}

          {/* ── Tags ── */}
          {Array.isArray(course.tags) && course.tags.length > 0 && (
            <div className={vp.sectionBlock} style={{ gridColumn: '1 / -1' }}>
              <div className={vp.sectionTitle}>Tags</div>
              <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {course.tags.map((tag, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: '#e8f5f5', color: '#0b7b7b',
                    border: '1px solid #c0dedd', borderRadius: 4,
                    fontSize: 11.5, fontWeight: 600, padding: '2px 8px',
                  }}>
                    {tag?.title || tag?.name || tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Curriculum ── */}
        {chapters.length > 0 && (
          <div className={s.curriculum}>
            <div className={s.curriculumHead}>
              <span className={s.curriculumTitle}>Curriculum</span>
              <span className={s.curriculumMeta}>
                {chapters.length} chapter{chapters.length !== 1 ? 's' : ''}
                {totalTopics > 0 && ` · ${totalTopics} topic${totalTopics !== 1 ? 's' : ''}`}
              </span>
            </div>

            <div className={s.chapterList}>
              {chapters.map((ch, idx) => {
                const chId    = String(ch._id);
                const topics  = topicMap[chId] || [];
                const isOpen  = openChapters[chId] ?? true;

                return (
                  <div key={chId} className={s.chapterBlock}>
                    {/* Chapter row */}
                    <button
                      className={s.chapterRow}
                      onClick={() => toggleChapter(chId)}
                      type="button"
                    >
                      <div className={s.chapterLeft}>
                        <span className={s.chapterNum}>Ch {idx + 1}</span>
                        <span className={s.chapterTitle}>{ch.title || `Chapter ${idx + 1}`}</span>
                        {topics.length > 0 && (
                          <span className={s.chapterTopicCount}>{topics.length} topic{topics.length !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                      <span className={`${s.chevron} ${isOpen ? s.chevronOpen : ''}`}>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </button>

                    {/* Chapter description */}
                    {isOpen && ch.desc && (
                      <div className={s.chapterDesc}>{ch.desc}</div>
                    )}

                    {/* Topics */}
                    {isOpen && topics.length > 0 && (
                      <div className={s.topicList}>
                        {topics.map((tp, tIdx) => {
                          const typeKey   = tp.video_type || tp.type || 'lesson';
                          const typeLabel = TOPIC_TYPE_LABEL[typeKey] || typeKey;
                          const typeStyle = TOPIC_TYPE_COLOR[typeKey] || TOPIC_TYPE_COLOR.file;
                          const topicDur  = fmtDuration(tp.duration_hr, tp.duration_min);
                          const fileUrl   = tp.attachments?.[0]?.url || tp.fileUrl || null;

                          return (
                            <div key={String(tp._id)} className={s.topicBlock}>
                              {/* ── Topic header row ── */}
                              <div className={s.topicRow}>
                                <span className={s.topicNum}>{tIdx + 1}</span>
                                <span className={s.topicTitle}>{tp.title || `Topic ${tIdx + 1}`}</span>
                                <div className={s.topicRowRight}>
                                  {topicDur && <span className={s.topicDur}>{topicDur}</span>}
                                  <span
                                    className={s.topicTypeBadge}
                                    style={{ background: typeStyle.bg, color: typeStyle.color, borderColor: typeStyle.border }}
                                  >
                                    {typeLabel}
                                  </span>
                                  {tp.isPreview && <span className={s.previewTag}>Preview</span>}
                                </div>
                              </div>

                              {/* ── Topic content ── */}
                              {typeKey === 'lesson' && (
                                <div className={s.topicContent}>
                                  {tp.desc && (
                                    <div className={s.contentRow}>
                                      <span className={s.contentLabel}>Content</span>
                                      <span className={s.contentValue}>{tp.desc}</span>
                                    </div>
                                  )}
                                  <div className={s.contentRow}>
                                    <span className={s.contentLabel}>Video</span>
                                    {/* The course files aren't exposed to the store owner — only whether one exists. */}
                                    {tp.videoUrl
                                      ? <span className={s.contentEmpty}>Hidden</span>
                                      : <span className={s.contentEmpty}>No video uploaded</span>}
                                  </div>
                                  <div className={s.contentRow}>
                                    <span className={s.contentLabel}>Image</span>
                                    {tp.imageUrl
                                      ? <span className={s.contentEmpty}>Hidden</span>
                                      : <span className={s.contentEmpty}>No image</span>}
                                  </div>
                                  <div className={s.contentRow}>
                                    <span className={s.contentLabel}>Duration</span>
                                    <span className={s.contentValue}>
                                      {(() => {
                                        const actual = videoDurMap[String(tp._id)];
                                        if (actual > 0) {
                                          const h  = Math.floor(actual / 3600);
                                          const m  = Math.floor((actual % 3600) / 60);
                                          const sc = Math.floor(actual % 60);
                                          return `${h}h  ${m}m  ${sc}s`;
                                        }
                                        return `${tp.duration_hr || 0}h  ${tp.duration_min || 0}m  ${tp.duration_sec || 0}s`;
                                      })()}
                                    </span>
                                  </div>
                                  {/* Converting to MP4 (or that failed): not loadable — the saved duration above is used. */}
                                  {tp.videoUrl && !['processing', 'failed'].includes(tp.videoStatus) && secureMediaUrl(tp.videoUrl, mediaToken) && (
                                    <video
                                      key={String(tp._id)}
                                      src={secureMediaUrl(tp.videoUrl, mediaToken)}
                                      preload="metadata"
                                      style={{ display: 'none' }}
                                      onLoadedMetadata={e => {
                                        const d = e.target.duration;
                                        if (d && !isNaN(d) && d > 0) {
                                          setVideoDurMap(prev => ({ ...prev, [String(tp._id)]: d }));
                                        }
                                      }}
                                    />
                                  )}
                                </div>
                              )}

                              {typeKey === 'zoom_link' && (
                                <div className={s.topicContent}>
                                  <div className={s.contentRow}>
                                    <span className={s.contentLabel}>Zoom Link</span>
                                    {tp.videoUrl
                                      ? <a href={tp.videoUrl} target="_blank" rel="noreferrer" className={`${s.contentLink} ${s.contentLinkZoom}`}>{tp.videoUrl}</a>
                                      : <span className={s.contentEmpty}>No link set</span>}
                                  </div>
                                  {(tp.duration_hr || tp.duration_min) && (
                                    <div className={s.contentRow}>
                                      <span className={s.contentLabel}>Duration</span>
                                      <span className={s.contentValue}>{tp.duration_hr || 0}h &nbsp;{tp.duration_min || 0}m</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {(typeKey === 'assignment' || typeKey === 'document' || typeKey === 'file') && (
                                <div className={s.topicContent}>
                                  {tp.desc && (
                                    <div className={s.contentRow}>
                                      <span className={s.contentLabel}>Description</span>
                                      <span className={s.contentValue}>{tp.desc}</span>
                                    </div>
                                  )}
                                  <div className={s.contentRow}>
                                    <span className={s.contentLabel}>File</span>
                                    {fileUrl
                                      ? <span className={s.contentEmpty}>Hidden</span>
                                      : <span className={s.contentEmpty}>No file attached</span>}
                                  </div>
                                  {tp.attachments?.length > 1 && tp.attachments.slice(1).map((att, ai) => (
                                    <div key={ai} className={s.contentRow}>
                                      <span className={s.contentLabel}>{ai === 0 ? 'Also' : ''}</span>
                                      <span className={s.contentEmpty}>Hidden</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {typeKey === 'quiz' && (
                                <div className={s.topicContent}>
                                  {tp.desc && (
                                    <div className={s.contentRow}>
                                      <span className={s.contentLabel}>Description</span>
                                      <span className={s.contentValue}>{tp.desc}</span>
                                    </div>
                                  )}
                                  <div className={s.contentRow}>
                                    <span className={s.contentLabel}>Questions</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      {(() => {
                                        const qs    = questionMap[String(tp._id)] || [];
                                        const selIds = tp.quizSettings?.selectedQuestionIds;
                                        const count = selIds?.length ?? qs.length;
                                        if (count === 0 && qs.length === 0) {
                                          return <span className={s.contentEmpty}>No questions selected</span>;
                                        }
                                        return (
                                          <>
                                            <div className={s.quizQCount}>{count} question{count !== 1 ? 's' : ''} selected</div>
                                            {qs.length > 0 && (
                                              <div className={s.quizQList}>
                                                {qs.map((q, qi) => (
                                                  <div key={String(q._id)} className={s.quizQItem}>
                                                    <span className={s.quizQNum}>{qi + 1}</span>
                                                    <div className={s.quizQBody}>
                                                      <span className={s.quizQText}>{q.question}</span>
                                                      <div className={s.quizQMeta}>
                                                        {q.difficulty && (
                                                          <span className={`${s.quizQDiff} ${s['quizQDiff__' + q.difficulty] || ''}`}>
                                                            {q.difficulty}
                                                          </span>
                                                        )}
                                                        {q.answer && (
                                                          <span className={s.quizQAnswer}>A: {q.answer}</span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isOpen && topics.length === 0 && (
                      <div className={s.noTopics}>No topics added yet.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
