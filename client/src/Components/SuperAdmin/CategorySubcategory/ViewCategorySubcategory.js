'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import { API_URL } from '../../../lib/constant';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./ViewCategorySubcategory.module.css";
import ViewDetailRows, { capitalize } from '../ViewDetailRows';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ViewCategorySubcategory() {
  const router       = useRouter();
  const { id }       = useParams();
  const searchParams = useSearchParams();
  const isSub        = searchParams.get('type') === 'sub-category';

  const [item, setItem]             = useState(null);
  const [parentName, setParentName] = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!id) return;
    const editPromise = isSub
      ? apiServiceHandler('GET', `course-subcategory/edit/${id}`)
      : apiServiceHandler('GET', `course-category/edit/${id}`);

    Promise.all([editPromise, apiServiceHandler('GET', 'course-category/list-all')])
      .then(([editRes, catRes]) => {
        const row  = editRes?.data ?? editRes;
        const cats = Array.isArray(catRes?.data) ? catRes.data : (Array.isArray(catRes) ? catRes : []);
        setItem(row);
        const parentId = isSub
          ? (row?.categoryId?._id ?? row?.categoryId ?? null)
          : (row?.parentId ?? null);
        if (parentId) {
          const parent = cats.find(c => String(c._id) === String(parentId));
          setParentName(parent?.title ?? parent?.name ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, isSub]);

  if (loading) return (
    <SuperAdminShell activeSection="category-subcategory">
      <p className={s.loadingText}>Loading…</p>
    </SuperAdminShell>
  );
  if (!item?._id) return (
    <SuperAdminShell activeSection="category-subcategory">
      <p className={s.loadingText}>Item not found.</p>
    </SuperAdminShell>
  );

  const displayName = isSub ? (item.name ?? '') : (item.title ?? item.name ?? '');
  const description = isSub ? (item.description ?? '') : (item.desc ?? item.description ?? '');
  const typeLabel   = isSub ? 'Sub-Category' : 'Category';
  const editUrl     = isSub
    ? `/superadmin/category-subcategory/${id}/edit?type=sub-category`
    : `/superadmin/category-subcategory/${id}/edit`;

  return (
    <SuperAdminShell activeSection="category-subcategory">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/category-subcategory')}>
        {BackArrow} Back to Category/Sub-Category
      </button>

      {/* Breadcrumb */}
      <div className={s.viewToolbar}>
        <nav className={s.breadcrumb}>
          <button className={s.breadcrumbLink} onClick={() => router.push('/superadmin/category-subcategory')}>
            Categories
          </button>
          <span className={s.breadcrumbSep}>›</span>
          <span className={s.breadcrumbCurr}>{displayName}</span>
        </nav>
        <button className={s.btnEditView} onClick={() => router.push(editUrl)}>
          <EditIcon /> Edit
        </button>
      </div>

      {/* Detail card */}
      <div className={s.detailCard}>

        {/* Card header */}

        {/* Body */}
        <div className={s.detailBody}>
          <ViewDetailRows s={s} rows={[
              { label: 'Name', value: displayName },
              { label: 'Type', value: typeLabel },
              { label: 'Slug', value: item.slug, variant: 'mono' },
              { label: isSub ? 'Category' : 'Parent', value: parentName },
              { label: 'Description', value: description, variant: 'desc' },
              { label: 'Image', value: item.cat_subcat_image && <img src={`${API_URL}${item.cat_subcat_image}`} alt={displayName} className={s.detailImg} /> },
              ...(isSub ? [] : [{ label: 'Total Courses', value: String(item.totalCourses ?? 0) }]),
              { label: 'Status', value: capitalize(item.status) },
              { label: 'Created', value: fmtDate(item.createdAt) },
              { label: 'Updated', value: fmtDate(item.updatedAt) },
          ]} />
        </div>

      </div>
    </SuperAdminShell>
  );
}
