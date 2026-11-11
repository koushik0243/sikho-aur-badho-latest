'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./EditIndustryType.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const LayersIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
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
    if (String(item._id) === String(excludeId)) return;
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

export default function EditIndustryType() {
  const router = useRouter();
  const { id } = useParams();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId]       = useState('');
  const [status, setStatus]           = useState('active');
  const [allItems, setAllItems]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiServiceHandler('GET', `industry-type/edit/${id}`),
      apiServiceHandler('GET', 'industry-type/list-all'),
    ])
      .then(([editRes, listRes]) => {
        const row  = editRes?.data ?? editRes;
        const list = Array.isArray(listRes?.data) ? listRes.data : (Array.isArray(listRes) ? listRes : []);
        setName(row?.name ?? '');
        setDescription(row?.description ?? '');
        setParentId(row?.parentId ? String(row.parentId) : '');
        setStatus(row?.status ?? 'active');
        setAllItems(list.map(item => ({
          _id:      String(item._id),
          name:     item.name,
          parentId: item.parentId ? String(item.parentId) : null,
        })));
      })
      .catch(() => setErrors({ fetch: 'Failed to load industry type.' }))
      .finally(() => setLoading(false));
  }, [id]);

  const parentOptions = useMemo(() => {
    if (!id || !allItems.length) return [];
    return flattenTree(buildTree(allItems, id));
  }, [allItems, id]);

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
      await apiServiceHandler('PUT', `industry-type/update/${id}`, {
        name:        name.trim(),
        description: description.trim(),
        parentId:    parentId || null,
        status,
      });
      toast.success('Updated successfully.');
      router.push('/superadmin/industry-type');
    } catch {
      toast.warning('Failed to update. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="industry-type">
      <div>
        <button className={s.backBtn} onClick={() => router.push('/superadmin/industry-type')}>
          {BackArrow} Back to Industry Types
        </button>
      </div>
      <div>
        <h1 className={s.pageTitle}>Edit Industry Type</h1>
        <p className={s.pageSubtitle}>Update industry type details</p>
      </div>

      {errors.fetch && <p className={s.errorMsg}>{errors.fetch}</p>}

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.card}>
          <div className={s.cardHeader}>{LayersIcon} Industry Type Information</div>
          <div className={s.cardBody}>
            {loading ? (
              <p style={{ fontSize: 13, color: '#6b7280' }}>Loading…</p>
            ) : (
              <>
                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.label}>Name <span className={s.required}>*</span></label>
                    <input
                      className={s.input}
                      type="text"
                      placeholder="Enter industry type name"
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

                <div className={s.formGrid}>
                  <div className={s.formGroup}>
                    <label className={s.label}>Status</label>
                    <select className={s.select} value={status} onChange={e => setStatus(e.target.value)}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.label}>Parent Industry Type</label>
                    <select className={s.select} value={parentId} onChange={e => setParentId(e.target.value)}>
                      <option value="">— None (root type) —</option>
                      {parentOptions.map(opt => (
                        <option key={opt._id} value={opt._id}>
                          {`${'  '.repeat(opt.depth)}${opt.depth > 0 ? '↳ ' : ''}${opt.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
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
            onClick={() => router.push('/superadmin/industry-type')}>
            Cancel
          </button>
        </div>
      </form>
    </SuperAdminShell>
  );
}
