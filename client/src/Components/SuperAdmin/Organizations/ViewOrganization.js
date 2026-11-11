'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import { API_URL } from '../../../lib/constant';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./ViewOrganization.module.css";
import ViewToolbar from '../../ViewToolbar/ViewToolbar';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function StatusBadge({ status }) {
  const cls =
    status === 'active'    ? s.statusActive :
    status === 'suspended' ? s.statusSuspended :
    s.statusInactive;
  return (
    <span className={`${s.statusBadge} ${cls}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'}
    </span>
  );
}

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const OrgInfoIcon = (
  <svg viewBox="0 0 20 20" fill="#2563eb">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
  </svg>
);

const OwnerIcon = (
  <svg viewBox="0 0 20 20" fill="#0b7b7b">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

const CoursesIcon = (
  <svg viewBox="0 0 20 20" fill="#7c3aed">
    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4 7.962 7.962 0 009 5.189V4.804z" />
  </svg>
);

export default function ViewOrganization() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [loading, setLoading]               = useState(true);
  const [org, setOrg]                       = useState(null);
  const [industryTypeNames, setIndustryTypeNames] = useState([]);
  const [courseNames, setCourseNames]       = useState([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiServiceHandler('GET', `organization/edit/${id}`),
      apiServiceHandler('GET', 'industry-type/list-all'),
      apiServiceHandler('GET', `organization-course/list?orgId=${id}`),
    ])
      .then(([orgRes, indRes, ocRes]) => {
        const orgData = orgRes?.data ?? orgRes;
        setOrg(orgData);

        const allTypes = Array.isArray(indRes?.data) ? indRes.data : (Array.isArray(indRes) ? indRes : []);
        const indIds = Array.isArray(orgData?.industryTypeIds)
          ? orgData.industryTypeIds.map(i => String(i._id ?? i))
          : [];
        setIndustryTypeNames(
          indIds.map(tid => allTypes.find(t => String(t._id) === tid)?.name).filter(Boolean)
        );

        setCourseNames(
          (Array.isArray(ocRes?.data) ? ocRes.data : [])
            .map(r => r.courseId?.title ?? r.courseId?.name)
            .filter(Boolean)
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SuperAdminShell activeSection="organizations">
        <p style={{ padding: '40px', color: '#6b7280' }}>Loading…</p>
      </SuperAdminShell>
    );
  }

  if (!org) {
    return (
      <SuperAdminShell activeSection="organizations">
        <p style={{ padding: '40px', color: '#dc2626' }}>Organization not found.</p>
      </SuperAdminShell>
    );
  }

  const owner = org.ownerId && typeof org.ownerId === 'object' ? org.ownerId : null;
  const ownerEmail = owner?.email || org.owner_email || '—';
  const ownerName  = owner?.name  || '—';

  return (
    <SuperAdminShell activeSection="organizations">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/organizations')}>
        {BackArrow} Back to Organizations
      </button>

      <ViewToolbar
        parent={{ label: 'Organizations', onClick: () => router.push('/superadmin/organizations') }}
        current={org.org_name}
        onEdit={() => router.push(`/superadmin/organizations/${id}/edit`)}
      />

      {/* ── Organization Information ── */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader} style={{ cursor: 'default' }}>
          <div className={s.sectionHeaderLeft}>{OrgInfoIcon} Organization Information</div>
        </div>
        <div className={s.sectionBody}>
          <div className={s.detailGrid}>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Organization Name</span>
              <span className={s.detailValue}>{org.org_name || '—'}</span>
            </div>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Status</span>
              <div><StatusBadge status={org.status} /></div>
            </div>

            <div className={`${s.detailItem} ${s.detailFull}`}>
              <span className={s.detailLabel}>Industry Types</span>
              {industryTypeNames.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {industryTypeNames.map((name, i) => (
                    <span
                      key={i}
                      style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, padding: '3px 10px', fontSize: 13, fontWeight: 500 }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className={s.detailValue}>—</span>
              )}
            </div>

            <div className={s.detailItem}>
              <span className={s.detailLabel}>Logo Image</span>
              {org.org_logo
                ? <img src={`${API_URL}${org.org_logo}`} alt="logo" style={{ maxWidth: 90, maxHeight: 60, borderRadius: 6, border: '1px solid #e5e7eb', marginTop: 4 }} />
                : <span className={s.detailValue}>—</span>}
            </div>

            <div className={s.detailItem}>
              <span className={s.detailLabel}>Created At</span>
              <span className={s.detailValue}>{fmtDate(org.createdAt)}</span>
            </div>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Updated At</span>
              <span className={s.detailValue}>{fmtDate(org.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Owner Account ── */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader} style={{ cursor: 'default' }}>
          <div className={s.sectionHeaderLeft}>{OwnerIcon} Owner Account</div>
        </div>
        <div className={s.sectionBody}>
          <div className={s.detailGrid}>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Name</span>
              <span className={s.detailValue}>{ownerName}</span>
            </div>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Email</span>
              <span className={s.detailValue}>{ownerEmail}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Courses ── */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader} style={{ cursor: 'default' }}>
          <div className={s.sectionHeaderLeft}>
            {CoursesIcon} Courses
            {courseNames.length > 0 && (
              <span className={s.coursesBadge}>{courseNames.length} assigned</span>
            )}
          </div>
        </div>
        <div className={s.sectionBody}>
          {courseNames.length === 0 ? (
            <p className={s.coursesEmpty}>No courses assigned.</p>
          ) : (
            <div className={s.coursesList}>
              {courseNames.map((title, i) => (
                <div key={i} className={s.courseRow} style={{ cursor: 'default' }}>
                  <span className={s.courseTitle}>{title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </SuperAdminShell>
  );
}
