'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./CourseSubCategoryList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, pageItems } from '../AdminKit/ListParts';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const Icon = {
  search: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
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

const LIMIT = 50;

export default function CourseSubCategoryList() {
  const router = useRouter();

  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [debounced, setDebounced]   = useState('');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected]     = useState([]);
  const [chipSel, setChipSel]       = useState([]);
  const [confirm, setConfirm]       = useState({ show: false, id: null, bulk: false });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debounced]);

  const fetchRows = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    apiServiceHandler('GET', `course-subcategory/list-pagination?${params}`)
      .then(res => {
        setRows(Array.isArray(res?.data) ? res.data : []);
        setTotal(res?.total ?? 0);
        setTotalPages(res?.totalPages ?? 1);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function handleDelete(id) { setConfirm({ show: true, id, bulk: false }); }
  function handleBulkDelete() {
    if (chipSel.length === 0) return;
    setConfirm({ show: true, id: null, bulk: true });
  }
  function doDelete() {
    const { id, bulk } = confirm;
    setConfirm({ show: false, id: null, bulk: false });
    if (bulk) {
      Promise.all(chipSel.map(sid => apiServiceHandler('GET', `course-subcategory/delete/${sid}`)))
        .then(() => { toast.error('Sub-categories deleted.'); setChipSel([]); setSelected([]); fetchRows(); })
        .catch(() => toast.warning('One or more deletes failed'));
    } else {
      apiServiceHandler('GET', `course-subcategory/delete/${id}`)
        .then(() => { toast.error('Sub-category deleted.'); fetchRows(); })
        .catch(() => toast.warning('Delete failed'));
    }
  }

  const grouped = useMemo(() => {
    const q = debounced.toLowerCase();
    const filtered = q
      ? rows.filter(r =>
          (r.name ?? '').toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q) ||
          (r.categoryId?.title ?? '').toLowerCase().includes(q)
        )
      : rows;
    const map = new Map();
    filtered.forEach(sub => {
      const catId    = sub.categoryId?._id ?? sub.categoryId ?? 'unknown';
      const catTitle = sub.categoryId?.title ?? 'Unknown Category';
      if (!map.has(catId)) map.set(catId, { catId, catTitle, subs: [] });
      map.get(catId).subs.push(sub);
    });
    return Array.from(map.values());
  }, [rows, debounced]);

  const catIds = grouped.map(g => g.catId);
  const allCatSel = catIds.length > 0 && catIds.every(id => selected.includes(id));
  const toggleAllCats = () => {
    if (allCatSel) {
      setSelected([]);
      setChipSel([]);
    } else {
      setSelected(catIds);
      setChipSel(grouped.flatMap(g => g.subs.map(sub => sub._id)));
    }
  };
  const toggleCat = catId => {
    const group  = grouped.find(g => g.catId === catId);
    const subIds = group ? group.subs.map(sub => sub._id) : [];
    const isSel  = selected.includes(catId);
    if (isSel) {
      setSelected(prev => prev.filter(x => x !== catId));
      setChipSel(prev => prev.filter(x => !subIds.includes(x)));
    } else {
      setSelected(prev => [...prev, catId]);
      setChipSel(prev => [...new Set([...prev, ...subIds])]);
    }
  };
  const toggleChip = id => setChipSel(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <SuperAdminShell activeSection="course-subcategory">
      <ConfirmModal
        show={confirm.show}
        title={confirm.bulk ? 'Delete Sub-Categories' : 'Delete Sub-Category'}
        message={
          confirm.bulk
            ? `Are you sure you want to delete ${chipSel.length} selected sub-categor${chipSel.length !== 1 ? 'ies' : 'y'}? This action cannot be undone.`
            : 'Are you sure you want to delete this sub-category? This action cannot be undone.'
        }
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null, bulk: false })}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Course Sub-Categories</h1>
          <p className={s.pageSubtitle}>Manage course sub-categories</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push('/superadmin/course-subcategory/add')}>
          <PlusIcon />
          Add Sub-Category
        </button>
      </div>

      <div className={s.card}>
        <div className={s.searchWrap}>
          {Icon.search}
          <input
            className={s.searchInput}
            type="text"
            placeholder="Search by name, description or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}>
                  <input type="checkbox" checked={allCatSel} onChange={toggleAllCats} />
                </th>
                <th>Category</th>
                <th>Sub-Category Names</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={3} />
              ) : grouped.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={3}><EmptyState>No sub-categories found.</EmptyState></td></tr>
              ) : grouped.map(group => (
                <tr key={group.catId}>
                  <td className={s.checkTd}>
                    <input
                      type="checkbox"
                      checked={selected.includes(group.catId)}
                      onChange={() => toggleCat(group.catId)}
                    />
                  </td>
                  <td>
                    <span className={s.catName}>{group.catTitle}</span>
                  </td>
                  <td>
                    <div className={s.chipsCell}>
                      {group.subs.map(sub => (
                        <div key={sub._id} className={s.chip}>
                          <input
                            type="checkbox"
                            className={s.chipCheck}
                            checked={chipSel.includes(sub._id)}
                            onChange={() => toggleChip(sub._id)}
                          />
                          <span className={s.chipName}>{sub.name}</span>
                          <div className={s.chipActions}>
                            <button data-action="view" className={s.btnView} title="View"
                              onClick={() => router.push(`/superadmin/course-subcategory/${sub._id}`)}>
                              {Icon.eye}
                            </button>
                            <button data-action="edit" className={s.btnEdit} title="Edit"
                              onClick={() => router.push(`/superadmin/course-subcategory/${sub._id}/edit`)}>
                              {Icon.edit}
                            </button>
                            <button data-action="delete" className={s.btnDelete} title="Delete"
                              onClick={() => handleDelete(sub._id)}>
                              {Icon.trash}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={s.tableFooter}>
          <div className={s.footerLeft}>
            {chipSel.length > 0 && (
              <button data-bulk-action="delete" className={s.btnBulkDelete} onClick={handleBulkDelete}>
                {Icon.trash}
                Delete Selected ({chipSel.length})
              </button>
            )}
            <span>
              <ResultCount from={from} to={to} total={total} singular="sub-category" plural="sub-categories" />
            </span>
          </div>
          <div className={s.pagination}>
            <button className={s.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </button>
            {pageItems(page, totalPages).map(p => typeof p !== 'number' ? <PageGap key={p} /> : (
              <button
                key={p}
                className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button className={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
    </SuperAdminShell>
  );
}
