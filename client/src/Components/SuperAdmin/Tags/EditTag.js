'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./EditTag.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const TagIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
  </svg>
);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

export default function EditTag() {
  const router   = useRouter();
  const { id }   = useParams();

  const [title, setTitle]           = useState('');
  const [desc, setDesc]             = useState('');
  const [errors, setErrors]         = useState({});
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `tags/details/${id}`)
      .then(res => {
        const d = res?.data ?? res;
        setTitle(d?.title ?? '');
        setDesc(d?.desc ?? '');
      })
      .catch(() => toast.warning('Failed to load tag details.'))
      .finally(() => setLoading(false));
  }, [id]);

  function validate() {
    const e = {};
    if (!title.trim()) e.title = 'Tag name is required.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await apiServiceHandler('PUT', `tags/update/${id}`, { title: title.trim(), desc: desc.trim() });
      toast.success('Tag updated successfully.');
      router.push('/superadmin/tags');
    } catch {
      toast.warning('Failed to update tag. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="tags">
      <div>
        <button className={s.backBtn} onClick={() => router.push('/superadmin/tags')}>
          {BackArrow} Back to Tags
        </button>
      </div>
      <div>
        <h1 className={s.pageTitle}>Edit Tag</h1>
        <p className={s.pageSubtitle}>Update tag details</p>
      </div>

      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className={s.card}>
            <div className={s.cardHeader}>{TagIcon} Tag Information</div>
            <div className={s.cardBody}>
              <div className={s.formGrid}>
                <div className={s.formGroup}>
                  <label className={s.label}>Tag Name <span className={s.required}>*</span></label>
                  <input
                    className={s.input}
                    type="text"
                    placeholder="Enter tag name"
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

          <div className={s.actions}>
            <button type="submit" className={s.btnSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/tags')}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </SuperAdminShell>
  );
}
