'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from '../OrgCourseAssignment/OrgCourseAssignmentList.module.css';
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, pageItems } from '../AdminKit/ListParts';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BASE_PATH = '/superadmin/user-course-assignment';
const LIMIT = 50;

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

// One group per learner (within an organization), listing that learner's courses.
function groupByLearner(records) {
  const map = new Map();
  for (const rec of records) {
    const orgId = String(rec.organizationId?._id ?? rec.organizationId ?? '');
    const userId = String(rec.userId?._id ?? rec.userId ?? '');
    const key = `${orgId}|${userId}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        orgId,
        userId,
        orgName: rec.organizationId?.org_name || rec.organizationId?.name || '—',
        learnerName: rec.userId?.name || '—',
        learnerEmail: rec.userId?.email || '',
        courses: [],
      });
    }
    map.get(key).courses.push({
      recordId: rec._id,
      title: rec.courseId?.title || '—',
      assignedOn: rec.attemptedAt,
    });
  }
  return [...map.values()];
}

function compareGroups(sortKey, sortDir) {
  const dir = sortDir === 'asc' ? 1 : -1;
  if (sortKey === 'assignedOn') {
    const latest = g => Math.max(0, ...g.courses.map(c => new Date(c.assignedOn).getTime() || 0));
    return (a, b) => (latest(a) - latest(b)) * dir;
  }
  return (a, b) => a[sortKey].toLowerCase().localeCompare(b[sortKey].toLowerCase()) * dir;
}

export default function UserCourseAssignmentList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState(searchParams.get('orgId') ?? '');
  const [page, setPage] = useState(1);
  const [hoveredKey, setHoveredKey] = useState(null);
  const [confirm, setConfirm] = useState({ show: false, id: null, label: '' });
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const fetchRecords = useCallback(() => {
    apiServiceHandler('GET', `course-assignment/list?t=${Date.now()}`)
      .then(res => setRecords(Array.isArray(res?.data) ? res.data : []))
      .catch(() => { setRecords([]); toast.warning('Failed to load user course assignments.'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    apiServiceHandler('GET', 'organization/list-pagination?limit=1000')
      .then(res => setOrgs(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setOrgs([]));
  }, []);

  const term = search.trim().toLowerCase();
  const filtered = groupByLearner(records).reduce((acc, g) => {
    if (selectedOrg && g.orgId !== selectedOrg) return acc;
    const groupMatches = !term || [g.orgName, g.learnerName, g.learnerEmail].some(v => v.toLowerCase().includes(term));
    const courses = groupMatches ? g.courses : g.courses.filter(c => c.title.toLowerCase().includes(term));
    if (courses.length > 0) acc.push({ ...g, courses });
    return acc;
  }, []);
  const sorted = sortKey ? [...filtered].sort(compareGroups(sortKey, sortDir)) : filtered;

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const paged = sorted.slice((page - 1) * LIMIT, page * LIMIT);
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to = Math.min(page * LIMIT, total);

  function toggleSort(key) {
    setPage(1);
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }
  const sortArrow = key => (sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓');
  const sortable = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

  function doDelete() {
    const { id } = confirm;
    setConfirm({ show: false, id: null, label: '' });
    apiServiceHandler('GET', `course-assignment/delete/${id}`)
      .then(() => { toast.error('Course removed from the learner.'); fetchRecords(); })
      .catch(() => toast.warning('Delete failed.'));
  }

  const addPath = selectedOrg ? `${BASE_PATH}/add?orgId=${selectedOrg}` : `${BASE_PATH}/add`;

  return (
    <SuperAdminShell activeSection="assign-user-course">
      <ConfirmModal
        show={confirm.show}
        title="Remove Course"
        message={`Remove "${confirm.label}" from ${confirm.learner || 'this learner'}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null, label: '' })}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>User Course Assignments</h1>
          <p className={s.pageSubtitle}>Manage course assignments to learners of each organization</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push(addPath)}>
          <PlusIcon />
          Add Assignment
        </button>
      </div>

      <div className={s.card}>
        <div className={s.filterBar}>
          <select className={s.orgSelect} value={selectedOrg} onChange={e => { setSelectedOrg(e.target.value); setPage(1); }}>
            <option value="">All Organizations</option>
            {orgs.map(o => <option key={o._id} value={o._id}>{o.org_name}</option>)}
          </select>
          <div className={s.searchWrap}>
            <SearchIcon />
            <input
              className={s.searchInput}
              type="text"
              placeholder="Search by organization, learner or course name…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>#</th>
                <th style={sortable} onClick={() => toggleSort('orgName')}>Organization{sortArrow('orgName')}</th>
                <th style={sortable} onClick={() => toggleSort('learnerName')}>Learner{sortArrow('learnerName')}</th>
                <th>Course</th>
                <th style={sortable} onClick={() => toggleSort('assignedOn')}>Assigned On{sortArrow('assignedOn')}</th>
                <th style={{ textAlign: 'center' }}>Delete</th>
                <th style={{ textAlign: 'center' }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={7} />
              ) : paged.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={7}><EmptyState>No assignments found.</EmptyState></td></tr>
              ) : (
                paged.flatMap((g, idx) => {
                  const serial = (page - 1) * LIMIT + idx + 1;
                  const rowClass = [idx % 2 !== 0 ? s.stripeAlt : '', hoveredKey === g.key ? s.orgHover : ''];
                  return g.courses.map((course, ci) => (
                    <tr
                      key={course.recordId}
                      className={[...rowClass, ci > 0 ? s.subRow : ''].filter(Boolean).join(' ') || undefined}
                      onMouseEnter={() => setHoveredKey(g.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                    >
                      {ci === 0 && (
                        <>
                          <td rowSpan={g.courses.length}>{serial}</td>
                          <td rowSpan={g.courses.length}><div className={s.cellMain}>{orDash(g.orgName)}</div></td>
                          <td rowSpan={g.courses.length}>
                            <div className={s.cellMain}>{g.learnerName}</div>
                            {g.learnerEmail && <div style={{ fontSize: 12, color: '#6b7280' }}>{g.learnerEmail}</div>}
                          </td>
                        </>
                      )}
                      <td>{course.title}</td>
                      <td>{fmtDate(course.assignedOn)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={s.actions} style={{ justifyContent: 'center' }}>
                          <button data-action="delete"
                            className={s.btnDelete}
                            title="Remove this course from the learner"
                            aria-label={`Remove ${course.title} from ${g.learnerName}`}
                            onClick={() => setConfirm({ show: true, id: course.recordId, label: course.title, learner: g.learnerName })}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                      {ci === 0 && (
                        <td rowSpan={g.courses.length} style={{ textAlign: 'center' }}>
                          <div className={s.actions} style={{ justifyContent: 'center' }}>
                            <button data-action="edit"
                              className={s.btnEdit}
                              title="Edit this learner's courses"
                              aria-label={`Edit ${g.learnerName}'s courses`}
                              onClick={() => router.push(`${BASE_PATH}/${g.orgId}/${g.userId}`)}
                            >
                              <EditIcon />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ));
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={s.pagination}>
          <span><ResultCount from={from} to={to} total={total} singular="assignment" plural="assignments" /></span>
          <div className={s.paginationBtns}>
            <button className={s.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            {pageItems(page, totalPages).map(p => typeof p !== 'number' ? <PageGap key={p} /> : (
              <button key={p} className={`${s.pageBtn}${page === p ? ` ${s.pageBtnActive}` : ''}`} onClick={() => setPage(p)}>
                {p}
              </button>
            ))}
            <button className={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </SuperAdminShell>
  );
}
