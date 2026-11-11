'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./AddCategorySubcategory.module.css";
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

function buildTree(items) {
  const map = {};
  items.forEach(item => (map[String(item._id)] = { ...item, children: [] }));
  const roots = [];
  items.forEach(item => {
    const pid = item.parentId ? String(item.parentId) : null;
    if (pid && map[pid]) {
      map[pid].children.push(map[String(item._id)]);
    } else if (!pid) {
      roots.push(map[String(item._id)]);
    }
  });
  return roots;
}

function flattenTree(nodes, depth = 0) {
  const result = [];
  for (const node of nodes) {
    result.push({ _id: node._id, name: node.name, depth });
    if (node.children?.length) result.push(...flattenTree(node.children, depth + 1));
  }
  return result;
}

export default function AddCategorySubcategory() {
  const router = useRouter();

  const [name, setName]             = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId]     = useState('');
  const [status, setStatus]         = useState('active');
  const [imageFile, setImageFile]   = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [allItems, setAllItems]     = useState([]);
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview('');
  }

  useEffect(() => {
    Promise.all([
      apiServiceHandler('GET', 'course-category/list-all'),
      apiServiceHandler('GET', 'course-subcategory/list'),
    ])
      .then(([catRes, subRes]) => {
        const cats = Array.isArray(catRes?.data) ? catRes.data : (Array.isArray(catRes) ? catRes : []);
        const subs = Array.isArray(subRes?.data) ? subRes.data : (Array.isArray(subRes) ? subRes : []);
        const catIds = new Set(cats.map(c => String(c._id)));
        const unified = [
          ...cats.map(c => ({ _id: String(c._id), name: c.title, parentId: c.parentId ? String(c.parentId) : null })),
          ...subs
            .filter(s => !catIds.has(String(s._id)))
            .map(s => ({
              _id: String(s._id),
              name: s.name,
              parentId: s.categoryId?._id ? String(s.categoryId._id) : (s.categoryId ? String(s.categoryId) : null),
            })),
        ];
        const tree = buildTree(unified);
        setAllItems(flattenTree(tree));
      })
      .catch(() => {});
  }, []);

  // allItems is a flat list of { _id, name, depth }
  const parentOptions = allItems;

  function validate() {
    const e = {};
    if (!name.trim()) e.name = 'Name is required.';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', name.trim());
      fd.append('desc', description.trim());
      if (parentId) fd.append('parentId', parentId);
      fd.append('status', status);
      if (imageFile) fd.append('cat_subcat_image', imageFile);
      await apiServiceHandler('POST', 'course-category/create', fd);
      toast.success('Created successfully.');
      router.push('/superadmin/category-subcategory');
    } catch {
      toast.warning('Failed to create. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="category-subcategory">
      <div>
        <button className={s.backBtn} onClick={() => router.push('/superadmin/category-subcategory')}>
          {BackArrow} Back to Categories
        </button>
      </div>
      <div>
        <h1 className={s.pageTitle}>Add Category / Sub-Category</h1>
        <p className={s.pageSubtitle}>Create a new category or sub-category</p>
      </div>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.card}>
          <div className={s.cardHeader}>{LayersIcon} Category Information</div>
          <div className={s.cardBody}>

            {/* Row 1: Name + Description */}
            <div className={s.formGrid}>
              <div className={s.formGroup}>
                <label className={s.label}>Name <span className={s.required}>*</span></label>
                <input
                  className={s.input}
                  type="text"
                  placeholder="Enter name"
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

            {/* Row 2: Status | Parent Category */}
            <div className={s.formGrid}>
              <div className={s.formGroup}>
                <label className={s.label}>Status</label>
                <select className={s.select} value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className={s.formGroup}>
                <label className={s.label}>Parent Category</label>
                <select
                  className={s.select}
                  value={parentId}
                  onChange={e => setParentId(e.target.value)}
                >
                  <option value="">— None (root category) —</option>
                  {parentOptions.map(opt => (
                    <option key={opt._id} value={opt._id}>
                      {`${'\u00a0\u00a0'.repeat(opt.depth)}${opt.depth > 0 ? '↳ ' : ''}${opt.name}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Image upload */}
            <div className={s.formGroup}>
              <label className={s.label}>Image</label>
              {imagePreview ? (
                <div className={s.imagePreviewWrap}>
                  <img src={imagePreview} alt="Preview" className={s.imagePreview} />
                  <button type="button" className={s.imageRemoveBtn} onClick={clearImage}>Remove</button>
                </div>
              ) : (
                <label className={s.imageUploadArea}>
                  <input
                    type="file"
                    accept="image/*"
                    className={s.imageFileInput}
                    onChange={handleImageChange}
                    autoComplete="off"
                  />
                  <span className={s.imageUploadIcon}>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="24" height="24">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <span className={s.imageUploadText}>Click to upload an image</span>
                  <span className={s.imageUploadHint}>PNG, JPG, WEBP up to 5 MB</span>
                </label>
              )}
            </div>

          </div>
        </div>

        <div className={s.actions}>
          <button type="submit" className={s.btnSubmit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
          <button type="button" className={s.btnCancel}
            onClick={() => router.push('/superadmin/category-subcategory')}>
            Cancel
          </button>
        </div>
      </form>
    </SuperAdminShell>
  );
}
