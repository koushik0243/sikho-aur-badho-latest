'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./AddCourseCategory.module.css";
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

export default function AddCourseCategory() {
  const router = useRouter();

  const [title, setTitle]           = useState('');
  const [desc, setDesc]             = useState('');
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const e = {};
    if (!title.trim()) e.title = 'Category name is required.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await apiServiceHandler('POST', 'course-category/create', { title: title.trim(), desc: desc.trim() });
      toast.success('Category created successfully.');
      router.push('/superadmin/course-category');
    } catch {
      toast.warning('Failed to create category. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="course-category">
      <div>
        <button className={s.backBtn} onClick={() => router.push('/superadmin/course-category')}>
          {BackArrow} Back to Categories
        </button>
      </div>
      <div>
        <h1 className={s.pageTitle}>Add Course Category</h1>
        <p className={s.pageSubtitle}>Create a new course category</p>
      </div>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.card}>
          <div className={s.cardHeader}>{LayersIcon} Category Information</div>
          <div className={s.cardBody}>
            <div className={s.formGrid}>
              <div className={s.formGroup}>
                <label className={s.label}>Category Name <span className={s.required}>*</span></label>
                <input
                  className={s.input}
                  type="text"
                  placeholder="Enter category name"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoComplete="off"
                />
                {errors.title && <span className={s.errorMsg}>{errors.title}</span>}
              </div>
              <div className={s.formGroup}>
                <label className={s.label}>Description</label>
                <textarea
                  className={s.textarea}
                  placeholder="Enter a short description (optional)"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {errors.submit && <p className={s.errorMsg}>{errors.submit}</p>}
        <div className={s.actions}>
          <button type="submit" className={s.btnSubmit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Category'}
          </button>
          <button type="button" className={s.btnCancel}
            onClick={() => router.push('/superadmin/course-category')}>
            Cancel
          </button>
        </div>
      </form>
    </SuperAdminShell>
  );
}
