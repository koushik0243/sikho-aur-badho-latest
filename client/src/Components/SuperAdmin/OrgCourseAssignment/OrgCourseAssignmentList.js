'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./OrgCourseAssignmentList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, SortArrow, pageItems } from '../AdminKit/ListParts';
import useBulkDelete from '../AdminKit/useBulkDelete';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

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

function groupByOrg(records) {
  const map = new Map();
  for (const rec of records) {
    const orgKey = String(rec.orgId?._id ?? 'unknown');
    if (!map.has(orgKey)) {
      map.set(orgKey, {
        orgId:   rec.orgId?._id,
        orgName: rec.orgId?.org_name || '—',
        courses: [],
      });
    }
    map.get(orgKey).courses.push({
      recordId:  rec._id,
      title:     rec.courseId?.title || '—',
      status:    rec.status,
      createdAt: rec.createdAt,
    });
  }
  return [...map.values()];
}

const LIMIT = 50;

export default function OrgCourseAssignmentList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [records, setRecords]         = useState([]);
  const [orgs, setOrgs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [selectedOrg, setSelectedOrg] = useState(searchParams.get('orgId') ?? '');
  const [page, setPage]               = useState(1);
  const [hoveredOrg, setHoveredOrg]   = useState(null);
  const [confirm, setConfirm]         = useState({ show: false, id: null, label: '' });
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const fetchRecords = useCallback(() => {
    setLoading(true);
    apiServiceHandler('GET', 'organization-course/list')
      .then(res => setRecords(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    apiServiceHandler('GET', 'organization/list-pagination?limit=1000')
      .then(res => setOrgs(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setOrgs([]));
  }, []);

  const grouped = groupByOrg(records);

  const filtered = grouped.reduce((acc, g) => {
    if (selectedOrg && String(g.orgId) !== selectedOrg) return acc;
    const term = search.trim().toLowerCase();
    const matchingCourses = term
      ? g.courses.filter(c =>
          c.title.toLowerCase().includes(term) ||
          g.orgName.toLowerCase().includes(term)
        )
      : g.courses;
    if (matchingCourses.length === 0) return acc;
    acc.push({ ...g, courses: matchingCourses });
    return acc;
  }, []);

  useEffect(() => { setPage(1); }, [search, selectedOrg, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }

  const sorted = sortKey === 'orgName'
    ? [...filtered].sort((a, b) => {
        const av = (a.orgName ?? '').toLowerCase();
        const bv = (b.orgName ?? '').toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : sortKey === 'assignedOn'
      ? [...filtered].sort((a, b) => {
          const av = new Date(a.courses[0]?.createdAt).getTime() || 0;
          const bv = new Date(b.courses[0]?.createdAt).getTime() || 0;
          return sortDir === 'asc' ? av - bv : bv - av;
        })
      : filtered;

  const totalOrgs  = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalOrgs / LIMIT));
  const pagedFiltered = sorted.slice((page - 1) * LIMIT, page * LIMIT);
  const from = totalOrgs === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, totalOrgs);

  // One checkbox per organization on this page → "Delete Selected (N)" removes every course
  // assignment shown for the ticked organizations.
  const orgKeyOf = (g, idx) => String(g.orgId ?? `row-${idx}`);
  const coursesByOrg = new Map(pagedFiltered.map((g, idx) => [orgKeyOf(g, idx), g.courses.map(c => String(c.recordId))]));
  const bulk = useBulkDelete({
    visibleIds: [...coursesByOrg.keys()],
    recordsOf: key => coursesByOrg.get(key) || [],
    deletePath: id => `organization-course/delete/${id}`,
    singular: 'organization',
    plural: 'organizations',
    confirmMessage: n => `Remove all course assignments of ${n} selected organization${n !== 1 ? 's' : ''}? This cannot be undone.`,
    onDeleted: fetchRecords,
  });

  function doDelete() {
    const { id } = confirm;
    setConfirm({ show: false, id: null, label: '' });
    apiServiceHandler('GET', `organization-course/delete/${id}`)
      .then(() => { toast.error('Assignment deleted.'); fetchRecords(); })
      .catch(() => toast.warning('Delete failed.'));
  }

  let rowCounter = (page - 1) * LIMIT;

  return (
    <SuperAdminShell activeSection="assign-course">
      <ConfirmModal
        show={confirm.show}
        title="Delete Assignment"
        message={`Remove "${confirm.label}" from ${confirm.org || 'this organization'}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null, label: '' })}
      />
      <ConfirmModal {...bulk.confirmProps} />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Course Assignments</h1>
          <p className={s.pageSubtitle}>Manage course assignments to organizations</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push(`/superadmin/organization-course-assignment/add${selectedOrg ? `?orgId=${selectedOrg}` : ''}`)}>
          <PlusIcon />
          Add Assignment
        </button>
      </div>

      <div className={s.card}>
        <div className={s.filterBar}>
          <select
            className={s.orgSelect}
            value={selectedOrg}
            onChange={e => setSelectedOrg(e.target.value)}
          >
            <option value="">All Organizations</option>
            {orgs.map(o => (
              <option key={o._id} value={o._id}>{o.org_name}</option>
            ))}
          </select>
          <div className={s.searchWrap}>
            <SearchIcon />
            <input
              className={s.searchInput}
              type="text"
              placeholder="Search by organization or course name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}>
                  <input type="checkbox" aria-label="Select all organizations on this page" checked={bulk.allSelected} onChange={bulk.toggleAll} />
                </th>
                <th>#</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('orgName')}>Organization{sortArrow('orgName')}</th>
                <th>Course</th>
                <th>Status</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('assignedOn')}>Assigned On{sortArrow('assignedOn')}</th>
                <th style={{ textAlign: 'center' }}>Delete</th>
                <th style={{ textAlign: 'center' }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={8} />
              ) : filtered.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={8}><EmptyState>No assignments found.</EmptyState></td></tr>
              ) : (
                pagedFiltered.flatMap((g, idx) => {
                  const orgKey  = orgKeyOf(g, idx);
                  const orgTicked = bulk.isSelected(orgKey);
                  const hovered = hoveredOrg === orgKey ? s.orgHover : '';
                  const stripe  = idx % 2 !== 0 ? s.stripeAlt : '';
                  rowCounter++;
                  const orgSerial = rowCounter;

                  return g.courses.map((course, ci) => (
                    <tr
                      key={`${orgKey}-${ci}`}
                      className={[stripe, hovered, ci > 0 ? s.subRow : '', orgTicked ? s.rowSelected : ''].filter(Boolean).join(' ') || undefined}
                      onMouseEnter={() => setHoveredOrg(orgKey)}
                      onMouseLeave={() => setHoveredOrg(null)}
                    >
                      {ci === 0 && (
                        <>
                          <td rowSpan={g.courses.length} className={s.checkTd}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${g.orgName}`}
                              checked={orgTicked}
                              onChange={() => bulk.toggle(orgKey)}
                            />
                          </td>
                          <td rowSpan={g.courses.length}>{orgSerial}</td>
                          <td rowSpan={g.courses.length}>
                            <div className={s.cellMain}>{orDash(g.orgName)}</div>
                          </td>
                        </>
                      )}
                      <td>{course.title}</td>
                      <td>
                        {course.status === 'active'
                          ? <span className={s.badgeActive}>Active</span>
                          : <span className={s.badgeInactive}>Inactive</span>}
                      </td>
                      <td>{fmtDate(course.createdAt)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={s.actions} style={{ justifyContent: 'center' }}>
                          <button data-action="delete"
                            className={s.btnDelete}
                            title="Remove this course from the organization"
                            aria-label={`Remove ${course.title} from ${g.orgName}`}
                            onClick={() => setConfirm({ show: true, id: course.recordId, label: course.title, org: g.orgName })}
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
                              title="Edit this organization's courses"
                              aria-label={`Edit ${g.orgName}'s courses`}
                              onClick={() => router.push(`/superadmin/organization-course-assignment/${g.orgId}`)}
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
          <div className={s.footerLeft}>
            {bulk.selected.length > 0 && (
              <button type="button" data-bulk-action="delete" className={s.btnBulkDelete} onClick={bulk.askToDelete} disabled={bulk.deleting}>
                <TrashIcon />
                Delete Selected ({bulk.selected.length})
              </button>
            )}
            <span><ResultCount from={from} to={to} total={totalOrgs} singular="organization" plural="organizations" /></span>
          </div>
          <div className={s.paginationBtns}>
            <button className={s.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            {pageItems(page, totalPages).map(p => typeof p !== 'number' ? <PageGap key={p} /> : (
              <button
                key={p}
                className={`${s.pageBtn}${page === p ? ` ${s.pageBtnActive}` : ''}`}
                onClick={() => setPage(p)}
              >
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
