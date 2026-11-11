'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./CoursesList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, SortArrow, TrashIcon, pageItems } from '../AdminKit/ListParts';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const Icon = {
  search: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
    </svg>
  ),
  course: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4 7.962 7.962 0 009 5.189V4.804z" />
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
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

function fmtDuration(hr, min) {
  const h = parseInt(hr) || 0;
  const m = parseInt(min) || 0;
  if (!h && !m) return '—';
  return `${h}h ${m}m`;
}

function StatusLabel({ status }) {
  if (status === 'published') return <span className={s.statusPublished}>Published</span>;
  if (status === 'draft')     return <span className={s.statusDraft}>Draft</span>;
  if (status === 'deleted')   return <span className={s.statusDeleted}>Deleted</span>;
  return <span className={s.statusDraft}>{orDash(status)}</span>;
}

const LIMIT = 50;

export default function CoursesList() {
  const router = useRouter();

  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [debounced, setDebounced]   = useState('');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected]     = useState([]);
  const [confirm, setConfirm]       = useState({ show: false, id: null });
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [sortKey, setSortKey]       = useState('');
  const [sortDir, setSortDir]       = useState('asc');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debounced]);

  const fetchRows = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    apiServiceHandler('GET', `course/list-pagination?${params}`)
      .then(res => {
        let data = Array.isArray(res?.data) ? res.data : [];
        if (debounced) {
          const q = debounced.toLowerCase();
          data = data.filter(r =>
            (r.title ?? '').toLowerCase().includes(q) ||
            (r.catId?.title ?? '').toLowerCase().includes(q)
          );
        }
        setRows(data);
        setTotal(res?.total ?? 0);
        setTotalPages(res?.totalPages ?? 1);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page, debounced]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }

  function handleDelete(id) { setConfirm({ show: true, id }); }
  function doDelete() {
    const id = confirm.id;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `course/delete/${id}`)
      .then(() => { toast.error('Course deleted.'); fetchRows(); })
      .catch(() => toast.warning('Delete failed'));
  }

  function handleBulkDelete() { if (selected.length > 0) setBulkConfirm(true); }
  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(id => apiServiceHandler('GET', `course/delete/${id}`)))
      .then(() => { toast.error(`${ids.length} course${ids.length !== 1 ? 's' : ''} deleted.`); fetchRows(); })
      .catch(() => toast.warning('Some deletes failed'));
  }

  const allIds = rows.map(r => r._id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : allIds);
  const toggleOne = id => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const isDate = ['createdAt', 'updatedAt', 'purchase_date', 'payment_date'].includes(sortKey);
        let av = a[sortKey] ?? ''; let bv = b[sortKey] ?? '';
        if (isDate) { av = new Date(av).getTime() || 0; bv = new Date(bv).getTime() || 0; }
        else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : rows;

  return (
    <SuperAdminShell activeSection="courses">
      <ConfirmModal
        show={confirm.show}
        title="Delete Course"
        message="Are you sure you want to delete this course? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Courses"
        message={`Delete ${selected.length} selected course${selected.length !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Courses</h1>
          <p className={s.pageSubtitle}>Manage courses</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push('/superadmin/courses/add')}>
          <PlusIcon />
          Add Course
        </button>
      </div>

      <div className={s.card}>
        <div className={s.searchWrap}>
          {Icon.search}
          <input
            className={s.searchInput}
            type="text"
            placeholder="Search by title or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className={s.numCol}>#</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('title')}>Title{sortArrow('title')}</th>
                <th>Slug</th>
                <th>Category</th>
                <th>Sub-Category</th>
                <th>Duration</th>
                <th>Chapters</th>
                <th>Created By</th>
                <th>Status</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('createdAt')}>Created At{sortArrow('createdAt')}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={12} />
              ) : rows.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={12}><EmptyState>No courses found.</EmptyState></td></tr>
              ) : sorted.map((row, idx) => (
                <tr key={row._id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(row._id)}>
                  <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(row._id)}
                      onChange={() => toggleOne(row._id)}
                    />
                  </td>
                  <td className={s.numCol}>{(page - 1) * LIMIT + idx + 1}</td>
                  <td>
                    <div className={s.titleCell}>
                      <div className={s.courseIcon}>{Icon.course}</div>
                      <span className={s.courseTitle}>{orDash(row.title)}</span>
                    </div>
                  </td>
                  <td><span className={s.slugText}>{orDash(row.slug)}</span></td>
                  <td>{orDash(row.catId?.title)}</td>
                  <td>
                    {Array.isArray(row.subCatIds) && row.subCatIds.length > 0 ? (
                      <div className={s.subCatWrap}>
                        {row.subCatIds.map(sc => (
                          <span key={sc._id ?? sc} className={s.subCatTag}>{sc.name ?? sc}</span>
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                  <td>{fmtDuration(row.duration_hr, row.duration_min)}</td>
                  <td>{row.totalChapters ?? 0}</td>
                  <td>{orDash(row.createdBy?.name || row.createdBy?.email)}</td>
                  <td><StatusLabel status={row.status} /></td>
                  <td>{fmtDate(row.createdAt)}</td>
                  <td>
                    <div className={s.actions} onClick={e => e.stopPropagation()}>
                      <button data-action="view" className={s.btnView} title="View"
                        onClick={() => router.push(`/superadmin/courses/${row._id}`)}>
                        {Icon.eye}
                      </button>
                      <button data-action="edit" className={s.btnEdit} title="Edit"
                        onClick={() => router.push(`/superadmin/courses/${row._id}/edit`)}>
                        {Icon.edit}
                      </button>
                      <button data-action="delete" className={s.btnDelete} title="Delete"
                        onClick={() => handleDelete(row._id)}>
                        {Icon.trash}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={s.tableFooter}>
          <div className={s.footerLeft}>
            {selected.length > 0 && (
              <button data-bulk-action="delete" className={s.btnBulkDelete} onClick={handleBulkDelete}>
                <TrashIcon />
                Delete Selected ({selected.length})
              </button>
            )}
            <span>
              <ResultCount from={from} to={to} total={total} singular="course" plural="courses" />
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
