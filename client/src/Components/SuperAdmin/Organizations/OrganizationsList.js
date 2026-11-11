'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./OrganizationsList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, SortArrow, pageItems } from '../AdminKit/ListParts';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const Icon = {
  login: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
    </svg>
  ),
  quiz: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  assignment: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
    </svg>
  ),
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
  userPlus: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M8 9a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M8 11a6 6 0 00-6 6h12a6 6 0 00-6-6z" />
      <path d="M16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
    </svg>
  ),
  orgTable: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
    </svg>
  ),
  courses: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
    </svg>
  ),
  admins: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
    </svg>
  ),
};

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

const LIMIT = 50;

export default function OrganizationsList() {
  const router = useRouter();

  const [orgs, setOrgs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState([]);
  const [confirm, setConfirm]   = useState({ show: false, id: null });
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [sortKey, setSortKey]   = useState('');
  const [sortDir, setSortDir]   = useState('asc');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const fetchOrgs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (debouncedSearch) params.set('search', debouncedSearch);
    apiServiceHandler('GET', `organization/list-pagination?${params}`)
      .then(res => {
        setOrgs(Array.isArray(res?.data) ? res.data : []);
        setTotal(res?.total ?? 0);
        setTotalPages(res?.totalPages ?? 1);
      })
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  function handleDelete(id) { setConfirm({ show: true, id }); }
  function doDelete() {
    const id = confirm.id;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `organization/delete/${id}`)
      .then(() => { toast.error('Organization deleted.'); setSelected(prev => prev.filter(x => x !== id)); fetchOrgs(); })
      .catch(() => toast.warning('Delete failed'));
  }

  function handleBulkDelete() { if (selected.length > 0) setBulkConfirm(true); }
  function doBulkDelete() {
    setBulkConfirm(false);
    Promise.all(selected.map(id => apiServiceHandler('GET', `organization/delete/${id}`)))
      .then(() => { toast.error('Organizations deleted.'); setSelected([]); fetchOrgs(); })
      .catch(() => toast.warning('Some deletes failed'));
  }

  const allIds = orgs.map(o => o._id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  function toggleAll() { setSelected(allSelected ? [] : allIds); }
  function toggleOne(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }

  const sorted = sortKey
    ? [...orgs].sort((a, b) => {
        const isDate = ['createdAt', 'updatedAt', 'purchase_date', 'payment_date'].includes(sortKey);
        let av, bv;
        if (sortKey === 'owner_whatsapp') {
          // Not a flat field on the organization doc — it comes from the populated owner user.
          av = a.ownerId?.whatsapp_no || '';
          bv = b.ownerId?.whatsapp_no || '';
        } else {
          av = a[sortKey] ?? ''; bv = b[sortKey] ?? '';
        }
        if (isDate) { av = new Date(av).getTime() || 0; bv = new Date(bv).getTime() || 0; }
        else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : orgs;

  return (
    <SuperAdminShell activeSection="organizations">
      <ConfirmModal
        show={confirm.show}
        title="Delete Organization"
        message="Are you sure you want to delete this organization? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Organizations"
        message={`Are you sure you want to delete ${selected.length} organization${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Organizations</h1>
          <p className={s.pageSubtitle}>Manage organizations</p>
        </div>
        <div className={s.headerActions}>
          {/* <button className={s.btnAdd} onClick={() => router.push('/superadmin/organizations/add-learner')}>
            <PlusIcon />
            Add Learner &amp; Assign Course
          </button> */}
          <button className={s.btnAdd} onClick={() => router.push('/superadmin/organizations/add')}>
            <PlusIcon />
            Add Organization
          </button>
        </div>
      </div>

      <div className={s.card}>
        <div className={s.searchWrap}>
          {Icon.search}
          <input
            className={s.searchInput}
            type="text"
            placeholder="Search by name, email, or phone…"
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
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('org_name')}>Name{sortArrow('org_name')}</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('org_email')}>Email{sortArrow('org_email')}</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('owner_whatsapp')}>WhatsApp No{sortArrow('owner_whatsapp')}</th>
                <th>Status</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('createdAt')}>Created At{sortArrow('createdAt')}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={7} />
              ) : sorted.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={7}><EmptyState>No organizations found.</EmptyState></td></tr>
              ) : sorted.map(org => (
                <tr key={org._id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(org._id)}>
                  <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(org._id)}
                      onChange={() => toggleOne(org._id)}
                    />
                  </td>
                  <td>
                    <div className={s.nameCell}>
                      <span className={s.orgName}>{org.org_name || '—'}</span>
                    </div>
                  </td>
                  <td>{org.org_email || org.ownerId?.email || '—'}</td>
                  <td>{org.ownerId?.whatsapp_no || '—'}</td>
                  <td>
                    {org.status === 'active'
                      ? <span className={s.badgeActive}>Active</span>
                      : <span className={s.badgeInactive}>{org.status ?? 'Inactive'}</span>
                    }
                  </td>
                  <td>{fmtDate(org.createdAt)}</td>
                  <td>
                    <div className={s.actions} onClick={e => e.stopPropagation()}>
                      <button data-action="view" className={s.btnView} title="View"
                        onClick={() => router.push(`/superadmin/organizations/${org._id}`)}
                      >
                        {Icon.eye}
                      </button>
                      <button data-action="edit" className={s.btnEdit} title="Edit"
                        onClick={() => router.push(`/superadmin/organizations/${org._id}/edit`)}
                      >
                        {Icon.edit}
                      </button>
                      <button data-action="delete" className={s.btnDelete} title="Delete"
                        onClick={() => handleDelete(org._id)}
                      >
                        {Icon.trash}
                      </button>
                      {/* <button className={s.btnView} title="Quiz Result" aria-label={`Quiz results for ${org.org_name || 'organization'}`}
                        onClick={() => router.push(`/superadmin/organizations/${org._id}/quiz-result`)}
                      >
                        {Icon.quiz}
                      </button>
                      <button className={s.btnView} title="Assignment" aria-label={`Assignment submissions for ${org.org_name || 'organization'}`}
                        onClick={() => router.push(`/superadmin/organizations/${org._id}/assignments`)}
                      >
                        {Icon.assignment}
                      </button> */}
                      <button data-action="login" className={s.btnView} title="Log in" aria-label={`Log in as the store owner of ${org.org_name || 'this organization'} (opens a new tab)`}
                        onClick={() => window.open(`/impersonate?orgId=${org._id}`, '_blank', 'noopener')}
                      >
                        {Icon.login}
                      </button>
                      {/* <button className={s.btnCourses} title="Courses"
                        onClick={() => router.push(`/superadmin/organization-course-assignment?orgId=${org._id}`)}
                      >
                        {Icon.courses}
                      </button>
                      <button className={s.btnAssign} title="Assign Users"
                        onClick={() => router.push(`/superadmin/organization-user-assignment/add?orgId=${org._id}`)}
                      >
                        {Icon.userPlus}
                      </button>
                      <button className={s.btnAdmins} title="Admins"
                        onClick={() => router.push(`/superadmin/organization-admins?orgId=${org._id}`)}
                      >
                        {Icon.admins}
                      </button> */}
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
                {Icon.trash} Delete Selected ({selected.length})
              </button>
            )}
            <span>
              <ResultCount from={from} to={to} total={total} singular="organization" plural="organizations" />
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
