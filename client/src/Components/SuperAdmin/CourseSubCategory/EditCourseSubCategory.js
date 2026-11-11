'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./EditCourseSubCategory.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

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

export default function EditCourseSubCategory() {
  const router = useRouter();
  const { id } = useParams();

  const [categories, setCategories]   = useState([]);
  const [categoryId, setCategoryId]   = useState('');
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading]         = useState(true);
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    apiServiceHandler('GET', 'course-category/list')
      .then(res => setCategories(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `course-subcategory/edit/${id}`)
      .then(res => {
        const row = res?.data ?? res;
        setName(row?.name ?? '');
        setDescription(row?.description ?? '');
        const catId = row?.categoryId?._id ?? row?.categoryId ?? '';
        setCategoryId(String(catId));
      })
      .catch(() => setErrors({ fetch: 'Failed to load sub-category.' }))
      .finally(() => setLoading(false));
  }, [id]);

  function validate() {
    const e = {};
    if (!categoryId) e.categoryId = 'Please select a category.';
    if (!name.trim()) e.name = 'Sub-category name is required.';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await apiServiceHandler('PUT', `course-subcategory/update/${id}`, {
        name: name.trim(),
        description: description.trim(),
        categoryId,
      });
      toast.success('Sub-category updated successfully.');
      router.push('/superadmin/course-subcategory');
    } catch {
      toast.warning('Failed to update sub-category. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="course-subcategory">
      <div>
        <button className={s.backBtn} onClick={() => router.push('/superadmin/course-subcategory')}>
          {BackArrow} Back to Sub-Categories
        </button>
      </div>
      <div>
        <h1 className={s.pageTitle}>Edit Course Sub-Category</h1>
        <p className={s.pageSubtitle}>Update course sub-category details</p>
      </div>

      {errors.fetch && <p className={s.errorMsg}>{errors.fetch}</p>}

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.card}>
          <div className={s.cardHeader}>{LayersIcon} Select Category</div>
          <div className={s.cardBody}>
            <div className={s.formGroup}>
              <label className={s.label}>Category <span className={s.required}>*</span></label>
              <select
                className={s.select}
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                disabled={loading}
              >
                <option value="">-- Select a category --</option>
                {categories.map(c => (
                  <option key={c._id} value={c._id}>{c.title}</option>
                ))}
              </select>
              {errors.categoryId && <span className={s.errorMsg}>{errors.categoryId}</span>}
            </div>
          </div>
        </div>

        <div className={s.card}>
          <div className={s.cardHeader}>{LayersIcon} Sub-Category Details</div>
          <div className={s.cardBody}>
            {loading ? (
              <p style={{ fontSize: 13, color: '#6b7280' }}>Loading…</p>
            ) : (
              <div className={s.entryRow}>
                <div className={s.formGroup}>
                  <label className={s.label}>Sub-Category Name <span className={s.required}>*</span></label>
                  <input
                    className={s.input}
                    type="text"
                    placeholder="Enter sub-category name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="off"
                  />
                  {errors.name && <span className={s.errorMsg}>{errors.name}</span>}
                </div>
                <div className={s.formGroup}>
                  <label className={s.label}>Description</label>
                  <textarea
                    className={s.textarea}
                    placeholder="Enter a short description (optional)"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {errors.submit && <p className={s.errorMsg}>{errors.submit}</p>}
        <div className={s.actions}>
          <button type="submit" className={s.btnSubmit} disabled={submitting || loading}>
            {submitting ? 'Updating…' : 'Update Sub-Category'}
          </button>
          <button type="button" className={s.btnCancel}
            onClick={() => router.push('/superadmin/course-subcategory')}>
            Cancel
          </button>
        </div>
      </form>
    </SuperAdminShell>
  );
}
