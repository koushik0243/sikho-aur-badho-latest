'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./IndustryTypeList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, TrashIcon, pageItems as pageButtons } from '../AdminKit/ListParts';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const Icon = {
  search: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
    </svg>
  ),
  item: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
};

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function buildTree(items) {
  const map = {};
  items.forEach(item => (map[item._id] = { ...item, children: [] }));
  const roots = [];
  items.forEach(item => {
    if (item.parentId && map[item.parentId]) {
      map[item.parentId].children.push(map[item._id]);
    } else {
      roots.push(map[item._id]);
    }
  });
  return roots;
}

function flattenTree(nodes, depth = 0) {
  const result = [];
  for (const node of nodes) {
    result.push({ ...node, depth });
    if (node.children?.length) result.push(...flattenTree(node.children, depth + 1));
  }
  return result;
}

const LIMIT = 50;

export default function IndustryTypeList() {
  const router = useRouter();

  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [confirm, setConfirm]   = useState({ show: false, id: null });
  const [selected, setSelected]     = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const fetchItems = useCallback(() => {
    setLoading(true);
    apiServiceHandler('GET', 'industry-type/list-all')
      .then(res => {
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const normalized = list.map(item => ({
          _id:         String(item._id),
          name:        item.name,
          description: item.description || '',
          parentId:    item.parentId ? String(item.parentId) : null,
          status:      item.status,
          createdAt:   item.createdAt,
        }));
        setAllItems(normalized);
      })
      .catch(() => setAllItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const nameById = useMemo(() => {
    const m = {};
    allItems.forEach(item => (m[item._id] = item.name));
    return m;
  }, [allItems]);

  const flatList = useMemo(() => flattenTree(buildTree(allItems)), [allItems]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flatList;
    const q = search.toLowerCase();
    return flatList.filter(item =>
      (item.name ?? '').toLowerCase().includes(q) ||
      (item.description ?? '').toLowerCase().includes(q)
    );
  }, [flatList, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const clampedPage = Math.min(page, totalPages);
  const pageItems   = filtered.slice((clampedPage - 1) * LIMIT, clampedPage * LIMIT);
  const from = filtered.length === 0 ? 0 : (clampedPage - 1) * LIMIT + 1;
  const to   = Math.min(clampedPage * LIMIT, filtered.length);

  function doDelete() {
    const { id } = confirm;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `industry-type/delete/${id}`)
      .then(() => { toast.error('Deleted successfully.'); fetchItems(); })
      .catch(() => toast.warning('Delete failed.'));
  }

  const allIds = pageItems.map(item => item._id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : allIds);
  const toggleOne = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  function handleBulkDelete() { if (selected.length > 0) setBulkConfirm(true); }
  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(id => apiServiceHandler('GET', `industry-type/delete/${id}`)))
      .then(() => { toast.error(`${ids.length} item${ids.length !== 1 ? 's' : ''} deleted.`); fetchItems(); })
      .catch(() => toast.warning('Some deletes failed'));
  }

  return (
    <SuperAdminShell activeSection="industry-type">
      <ConfirmModal
        show={confirm.show}
        title="Delete Industry Type"
        message="Are you sure you want to delete this industry type? Deleting a parent will also remove its children."
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Industry Types"
        message={`Delete ${selected.length} selected item${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Industry Type</h1>
          <p className={s.pageSubtitle}>Manage multi-level industry types</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push('/superadmin/industry-type/add')}>
          <PlusIcon />
          Add Industry Type
        </button>
      </div>

      <div className={s.card}>
        <div className={s.searchWrap}>
          {Icon.search}
          <input
            className={s.searchInput}
            type="text"
            placeholder="Search by name or description…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                <th>Name</th>
                <th>Description</th>
                <th>Parent</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={7} />
              ) : pageItems.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={7}><EmptyState>No items found.</EmptyState></td></tr>
              ) : pageItems.map(item => (
                <tr key={item._id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(item._id)}>
                  <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(item._id)} onChange={() => toggleOne(item._id)} />
                  </td>
                  <td>
                    <div className={s.nameCell} style={{ paddingLeft: item.depth * 20 }}>
                      {item.depth > 0 && <span className={s.treeArrow}>↳</span>}
                      <span className={s.catName}>{orDash(item.name)}</span>
                    </div>
                  </td>
                  <td className={s.descCell}>{item.description || '—'}</td>
                  <td>{item.parentId ? (orDash(nameById[item.parentId])) : '—'}</td>
                  <td>
                    {item.status === 'active'
                      ? <span className={s.badgeActive}>Active</span>
                      : <span className={s.badgeInactive}>{item.status ?? 'Inactive'}</span>
                    }
                  </td>
                  <td>{fmtDate(item.createdAt)}</td>
                  <td>
                    <div className={s.actions} onClick={e => e.stopPropagation()}>
                      <button data-action="view" className={s.btnView} title="View"
                        onClick={() => router.push(`/superadmin/industry-type/${item._id}`)}>
                        {Icon.eye}
                      </button>
                      <button data-action="edit" className={s.btnEdit} title="Edit"
                        onClick={() => router.push(`/superadmin/industry-type/${item._id}/edit`)}>
                        {Icon.edit}
                      </button>
                      <button data-action="delete" className={s.btnDelete} title="Delete"
                        onClick={() => setConfirm({ show: true, id: item._id })}>
                        {Icon.trash}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={s.paginationWrap}>
          <div className={s.footerLeft}>
            {selected.length > 0 && (
              <button type="button" data-bulk-action="delete" className={s.btnBulkDelete} onClick={handleBulkDelete}>
                <TrashIcon />
                Delete Selected ({selected.length})
              </button>
            )}
            <span className={s.paginInfo}>
              <ResultCount from={from} to={to} total={filtered.length} singular="industry type" plural="industry types" />
            </span>
          </div>
          <div className={s.paginBtns}>
            <button className={s.paginBtn} disabled={clampedPage <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </button>
            {pageButtons(clampedPage, totalPages).map(n => typeof n !== 'number' ? <PageGap key={n} /> : (
              <button
                key={n}
                className={`${s.paginBtn} ${clampedPage === n ? s.paginBtnActive : ''}`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button className={s.paginBtn} disabled={clampedPage >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
    </SuperAdminShell>
  );
}
