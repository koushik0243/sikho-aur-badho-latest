'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./ViewCourseCategory.module.css";
import vsPage from "./ViewCourseCategory.module.css";
import ViewToolbar from '../../ViewToolbar/ViewToolbar';
import { withAdminKit } from '../AdminKit/AdminKit';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);
const vs = withAdminKit(vsPage);

const LayersIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
  </svg>
);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

export default function ViewCourseCategory() {
  const router  = useRouter();
  const { id }  = useParams();

  const [row, setRow]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `course-category/edit/${id}`)
      .then(res => setRow(res?.data ?? res))
      .catch(() => setError('Failed to load category.'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <SuperAdminShell activeSection="course-category">
      <div>
        <button className={s.backBtn} onClick={() => router.push('/superadmin/course-category')}>
          {BackArrow} Back to Categories
        </button>
      </div>
      <ViewToolbar
        parent={{ label: 'Course Categories', onClick: () => router.push('/superadmin/course-category') }}
        current={row?.title || (loading ? 'Loading…' : 'Category')}
        onEdit={row ? () => router.push(`/superadmin/course-category/${id}/edit`) : undefined}
      />

      {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}

      <div className={s.card}>
        <div className={s.cardHeader}>{LayersIcon} Category Information</div>
        <div className={s.cardBody}>
          {loading ? (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Loading…</p>
          ) : !row ? (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Category not found.</p>
          ) : (
            <div className={vs.grid}>
              <div className={vs.field}>
                <span className={vs.label}>Category Name</span>
                <span className={vs.value}>{orDash(row.title)}</span>
              </div>
              <div className={vs.field}>
                <span className={vs.label}>Description</span>
                <span className={vs.value}>{row.desc || '—'}</span>
              </div>
              <div className={vs.field}>
                <span className={vs.label}>Status</span>
                <span className={row.status === 'active' ? vs.badgeActive : vs.badgeInactive}>
                  {row.status === 'active' ? 'Active' : (row.status ?? 'Inactive')}
                </span>
              </div>
              <div className={vs.field}>
                <span className={vs.label}>Slug</span>
                <span className={vs.value}>{orDash(row.slug)}</span>
              </div>
              <div className={vs.field}>
                <span className={vs.label}>Total Courses</span>
                <span className={vs.value}>{row.totalCourses ?? 0}</span>
              </div>
              <div className={vs.field}>
                <span className={vs.label}>Created At</span>
                <span className={vs.value}>{fmtDate(row.createdAt)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

    </SuperAdminShell>
  );
}
