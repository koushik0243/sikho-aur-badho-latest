'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import { API_URL } from '../../../lib/constant';
import ViewToolbar from '../../ViewToolbar/ViewToolbar';
import AssignmentSubmissions from '../../AssignmentSubmissions/AssignmentSubmissions';
import pageStyles from "./LearnerDetail.module.css";
import { withDetailKit } from '../PageKit/PageKit';

// Page styles + the shared store owner detail-page look.
const vp = withDetailKit(pageStyles);
const s = withDetailKit(pageStyles);

const Icon = {
  back:     <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>,
  email:    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>,
  phone:    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>,
  courses:  <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4 7.962 7.962 0 009 5.189V4.804z" /></svg>,
  verified: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
};

const STATUS_CLS = {
  active: s.statusActive,
  inactive: s.statusInactive,
  suspended: s.statusSuspended,
  deactivated: s.statusSuspended,
};

export default function LearnerDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [learner, setLearner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [assignedCourses, setAssignedCourses] = useState([]);

  const loadLearner = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [res, caRes] = await Promise.all([
        apiServiceHandler('GET', `user/admin/edit/${id}`),
        apiServiceHandler('GET', `course-assignment/list?userId=${id}`),
      ]);
      const data = res?.data ?? res;
      if (!data?._id) { setNotFound(true); }
      else { setLearner(data); }
      const caList = Array.isArray(caRes?.data) ? caRes.data : (Array.isArray(caRes) ? caRes : []);
      setAssignedCourses(caList);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadLearner(); }, [loadLearner]);

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  function formatDate(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmtDuration(hr, min) {
    const h = parseInt(hr, 10) || 0;
    const m = parseInt(min, 10) || 0;
    if (!h && !m) return null;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }

  return (
    <>
      <button className={s.backBtn} onClick={() => router.push('/storeowner/users')}>
        {Icon.back} Back to User Management
      </button>

      <ViewToolbar
        parent={{ label: 'User Management', onClick: () => router.push('/storeowner/users') }}
        current={loading ? '…' : (learner?.name || 'Learner')}
        onEdit={() => router.push(`/storeowner/users/${id}/edit`)}
        extra={
          <button type="button" className={s.btnAddLearner} onClick={() => router.push('/storeowner/add-learner')}>
            + Add Learner
          </button>
        }
      />

      {loading ? (
        <div className={s.skeletonWrap}>
          <div className={s.skeletonAvatar} />
          <div className={s.skeletonLines}>
            <div className={s.skeletonLine} style={{ width: '30%' }} />
            <div className={s.skeletonLine} style={{ width: '20%' }} />
          </div>
          <div className={s.skeletonGrid}>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className={s.skeletonCard} />)}
          </div>
        </div>
      ) : notFound ? (
        <div className={s.notFound}>
          <div className={s.notFoundTitle}>Learner not found</div>
        </div>
      ) : (
        <>
          {/* ── Profile header ── */}
          <div className={s.profileHeader}>
            <div className={s.profileAvatarLg}>{getInitials(learner.name)}</div>
            <div className={s.profileHeaderInfo}>
              <div className={s.profileName}>{learner.name || '—'}</div>
              <div className={s.profileMeta}>
                <span className={`${s.statusBadge} ${STATUS_CLS[learner.status] || s.statusActive}`}>
                  {learner.status || 'active'}
                </span>
                {learner.isVerified && (
                  <span className={s.verifiedBadge}>{Icon.verified} Verified</span>
                )}
              </div>
              <div className={s.profileContactRow}>
                {learner.email && <span className={s.contactItem}>{Icon.email}{learner.email}</span>}
                {learner.whatsapp_no && <span className={s.contactItem}>{Icon.phone}{learner.whatsapp_no}</span>}
              </div>
            </div>
          </div>

          {/* ── Detail cards ── */}
          <div className={s.cardsGrid}>

            {/* Personal Information */}
            <div className={s.card}>
              <div className={s.cardTitle}>Personal Information</div>
              <div className={vp.sectionRows}>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Full Name</span>
                  <span className={vp.sectionValue}>{learner.name || '—'}</span>
                </div>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Email</span>
                  <span className={vp.sectionValue}>{learner.email || '—'}</span>
                </div>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>WhatsApp No</span>
                  <span className={vp.sectionValue}>{learner.whatsapp_no || '—'}</span>
                </div>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Alt Phone</span>
                  <span className={vp.sectionValue}>{learner.alt_phone || '—'}</span>
                </div>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Date of Birth</span>
                  <span className={vp.sectionValue}>{formatDate(learner.dob) || '—'}</span>
                </div>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Gender</span>
                  <span className={vp.sectionValue}>{learner.gender || '—'}</span>
                </div>
                {learner.bio && (
                  <div className={vp.sectionRow} style={{ alignItems: 'flex-start' }}>
                    <span className={vp.sectionLabel} style={{ paddingTop: 2 }}>Bio</span>
                    <span className={vp.sectionValue} style={{ lineHeight: 1.55 }}>{learner.bio}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Employment Details */}
            <div className={s.card}>
              <div className={s.cardTitle}>Employment Details</div>
              <div className={vp.sectionRows}>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Employee ID</span>
                  <span className={vp.sectionValue}>{learner.emp_id || '—'}</span>
                </div>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Department</span>
                  <span className={vp.sectionValue}>{learner.department || '—'}</span>
                </div>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Designation</span>
                  <span className={vp.sectionValue}>{learner.designation || '—'}</span>
                </div>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Course Language</span>
                  <span className={vp.sectionValue}>{learner.course_language || '—'}</span>
                </div>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Access Start</span>
                  <span className={vp.sectionValue}>{formatDate(learner.access_start) || '—'}</span>
                </div>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Account Status</span>
                  <span className={`${s.statusBadge} ${STATUS_CLS[learner.status] || s.statusActive}`}>
                    {learner.status || 'active'}
                  </span>
                </div>
              </div>
            </div>

            {/* Assigned Courses */}
            <div className={`${s.card} ${s.cardFull}`}>
              <div className={s.cardTitle}>
                Assigned Courses
                {assignedCourses.length > 0 && (
                  <span className={s.coursesCount}>{assignedCourses.length}</span>
                )}
              </div>
              {assignedCourses.length === 0 ? (
                <div className={s.cardBody} style={{ color: '#9aadad', fontSize: 13 }}>No courses assigned yet</div>
              ) : (
                <div className={s.cardBody}>
                  <div className={s.courseDetailGrid}>
                    {assignedCourses.map(a => {
                      const c = a.courseId || {};
                      const thumb = c.course_image ? `${API_URL}${c.course_image}` : null;
                      const duration = fmtDuration(c.duration_hr, c.duration_min);
                      return (
                        <div key={a._id} className={s.courseDetailCard}>
                          <div className={s.courseThumb}>
                            {thumb
                              ? <img src={thumb} alt={c.title} className={s.courseThumbImg} />
                              : <div className={s.courseThumbPlaceholder}>{Icon.courses}</div>
                            }
                          </div>
                          <div className={s.courseDetailBody}>
                            <div className={s.courseDetailTitle}>{c.title || '—'}</div>
                            {c.desc && <div className={s.courseDetailDesc}>{c.desc}</div>}
                            <div className={s.courseDetailMeta}>
                              <span className={`${s.courseStatusBadge} ${a.status === 'inactive' ? s.courseStatusInactive : s.courseStatusActive}`}>
                                {a.status || 'active'}
                              </span>
                              {duration && <span className={s.courseDurationBadge}>{duration}</span>}
                              <span className={s.courseDetailDate}>Assigned {formatDate(a.createdAt) || '—'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Notification Preferences */}
            <div className={s.card}>
              <div className={s.cardTitle}>Notification Preferences</div>
              <div className={s.cardBody}>
                <div className={s.notiList}>
                  <div className={s.notiRow}>
                    <span className={s.notiLabel}>Welcome Email</span>
                    <span className={learner.email_welcome_noti ? s.notiBadgeOn : s.notiBadgeOff}>
                      {learner.email_welcome_noti ? 'On' : 'Off'}
                    </span>
                  </div>
                  <div className={s.notiRow}>
                    <span className={s.notiLabel}>Course Assignment Alerts</span>
                    <span className={learner.course_assign_noti ? s.notiBadgeOn : s.notiBadgeOff}>
                      {learner.course_assign_noti ? 'On' : 'Off'}
                    </span>
                  </div>
                  <div className={s.notiRow}>
                    <span className={s.notiLabel}>Weekly Progress Digest</span>
                    <span className={learner.weekly_progress_noti ? s.notiBadgeOn : s.notiBadgeOff}>
                      {learner.weekly_progress_noti ? 'On' : 'Off'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Homework videos this learner submitted (watchable here) */}
          <AssignmentSubmissions userId={id} showLearner={false} showOrganization={false}
            title="Assignment submissions" sub="Videos this learner uploaded after completing a homework assignment."
            className={s.submissionsCard} />
        </>
      )}
    </>
  );
}
