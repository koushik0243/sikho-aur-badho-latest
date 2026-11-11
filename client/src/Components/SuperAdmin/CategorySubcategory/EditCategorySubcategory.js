'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import { API_URL } from '../../../lib/constant';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./EditCategorySubcategory.module.css";
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

function buildTree(items, excludeId = null) {
  const map = {};
  items.forEach(item => (map[String(item._id)] = { ...item, children: [] }));
  const roots = [];
  items.forEach(item => {
    if (String(item._id) === String(excludeId)) return; // skip self
    const pid = item.parentId ? String(item.parentId) : null;
    if (pid && map[pid] && String(pid) !== String(excludeId)) {
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

export default function EditCategorySubcategory() {
  const router = useRouter();
  const { id } = useParams();
  const searchParams = useSearchParams();
  const isLegacySub = searchParams.get('type') === 'sub-category';

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId]       = useState('');
  const [status, setStatus]           = useState('active');
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [existingImage, setExistingImage] = useState('');
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview('');
    setExistingImage('');
  }

  useEffect(() => {
    if (!id) return;
    const editPromise = isLegacySub
      ? apiServiceHandler('GET', `course-subcategory/edit/${id}`)
      : apiServiceHandler('GET', `course-category/edit/${id}`);
    Promise.all([
      editPromise,
      apiServiceHandler('GET', 'course-category/list-all'),
      apiServiceHandler('GET', 'course-subcategory/list'),
    ])
      .then(([editRes, catRes, subRes]) => {
        const row  = editRes?.data ?? editRes;
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
        if (isLegacySub) {
          setName(row?.name ?? '');
          setDescription(row?.description ?? '');
          const catId = row?.categoryId?._id ?? row?.categoryId ?? '';
          setParentId(catId ? String(catId) : '');
        } else {
          setName(row?.title ?? '');
          setDescription(row?.desc ?? '');
          setParentId(row?.parentId ? String(row.parentId) : '');
        }
        setStatus(row?.status ?? 'active');
        if (row?.cat_subcat_image) setExistingImage(`${API_URL}${row.cat_subcat_image}`);
        setAllCategories(unified);
      })
      .catch(() => setErrors({ fetch: 'Failed to load item.' }))
      .finally(() => setLoading(false));
  }, [id, isLegacySub]);

  // Build parent options: all items except self and its descendants (prevents circular refs)
  const parentOptions = useMemo(() => {
    if (!id || !allCategories.length) return [];
    const tree = buildTree(allCategories, id);
    return flattenTree(tree);
  }, [allCategories, id]);

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
      fd.append('status', status);
      if (imageFile) fd.append('cat_subcat_image', imageFile);
      if (isLegacySub) {
        fd.append('name', name.trim());
        fd.append('description', description.trim());
        if (parentId) fd.append('categoryId', parentId);
        await apiServiceHandler('PUT', `course-subcategory/update/${id}`, fd);
      } else {
        fd.append('title', name.trim());
        fd.append('desc', description.trim());
        fd.append('parentId', parentId || '');
        await apiServiceHandler('PUT', `course-category/update/${id}`, fd);
      }
      toast.success('Updated successfully.');
      router.push('/superadmin/category-subcategory');
    } catch {
      toast.warning('Failed to update. Please try again.');
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
        <h1 className={s.pageTitle}>Edit Category / Sub-Category</h1>
        <p className={s.pageSubtitle}>Update category or sub-category details</p>
      </div>

      {errors.fetch && <p className={s.errorMsg}>{errors.fetch}</p>}

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.card}>
          <div className={s.cardHeader}>{LayersIcon} Category Information</div>
          <div className={s.cardBody}>
            {loading ? (
              <p style={{ fontSize: 13, color: '#6b7280' }}>Loading…</p>
            ) : (
              <>
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

                {/* Row 2: Status | Parent */}
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
                          {`${'  '.repeat(opt.depth)}${opt.depth > 0 ? '↳ ' : ''}${opt.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Image upload */}
                <div className={s.formGroup}>
                  <label className={s.label}>Image</label>
                  {(imagePreview || existingImage) ? (
                    <div className={s.imagePreviewWrap}>
                      <img src={imagePreview || existingImage} alt="Preview" className={s.imagePreview} />
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
              </>
            )}
          </div>
        </div>

        <div className={s.actions}>
          <button type="submit" className={s.btnSubmit} disabled={submitting || loading}>
            {submitting ? 'Saving…' : 'Save Changes'}
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