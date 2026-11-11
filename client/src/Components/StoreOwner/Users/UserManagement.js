'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import s from "./UserManagement.module.css";
import { kit as k, PageHeader, KpiTiles, Card, Pill, Pager, SkeletonRows, KitIcon } from '../PageKit/PageKit';

const STATUS_OPTIONS = [
  { value: 'active',    label: 'Active' },
  { value: 'inactive',  label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

// ── Icons (content-area only) ─────────────────────────────────────
const Icon = {
  learners: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" /></svg>,
  active: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
  inactive: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>,
  deactivated: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524L13.477 14.89zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" /></svg>,
  search: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>,
  eye: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>,
  edit: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>,
};

// Real account-status badge — pulled directly from the users table's `status`
// field (active/inactive/suspended/deleted), not a derived metric.

const LIMIT = 10;

function computeStats(list) {
  const total = list.length;
  const active = list.filter(u => u.status === 'active' || !u.status).length;
  const inactive = list.filter(u => u.status === 'inactive').length;
  const deactivated = list.filter(u => u.status === 'deactivated' || u.status === 'suspended').length;
  return { total, active, inactive, deactivated };
}

export default function UserManagementPage() {
  const user = useSelector(selectUser);
  const router = useRouter();

  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, deactivated: 0 });
  const [courseMap, setCourseMap] = useState({}); // { userId: ['Course A', 'Course B'] }
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusModalLearner, setStatusModalLearner] = useState(null);
  const [statusModalValue, setStatusModalValue] = useState('active');
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  function getTokenUserId() {
    if (typeof window === 'undefined') return null;
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload._id || null;
    } catch { return null; }
  }

  const loadLearners = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Resolve orgId — from Redux, or fetch user record from DB
      let effectiveOrgId = user?.orgId ? String(user.orgId) : null;
      if (!effectiveOrgId) {
        const effectiveUserId = user?._id || getTokenUserId();
        if (effectiveUserId) {
          const userRes = await apiServiceHandler('GET', `user/admin/edit/${effectiveUserId}`);
          const userRecord = userRes?.data ?? userRes;
          if (userRecord?.orgId) effectiveOrgId = String(userRecord.orgId);
        }
      }

      if (!effectiveOrgId) { setLearners([]); setLoading(false); return; }

      // 2. Fetch employees of this org
      const params = new URLSearchParams({ orgId: effectiveOrgId, user_type: 'employee', orgRole: 'employee' });
      const res = await apiServiceHandler('GET', `user/admin/list?${params.toString()}`);
      const data = res?.data ?? res;
      const list = Array.isArray(data) ? data : [];

      setLearners(list);
      setStats(computeStats(list));

      // Fetch all course assignments for this org in one call
      if (list.length > 0) {
        apiServiceHandler('GET', `course-assignment/list?organizationId=${effectiveOrgId}`)
          .then(caRes => {
            const assignments = Array.isArray(caRes?.data) ? caRes.data : [];
            const map = {};
            assignments.forEach(a => {
              const uid = a.userId?._id ? String(a.userId._id) : String(a.userId);
              const title = a.courseId?.title || null;
              if (!title) return;
              if (!map[uid]) map[uid] = [];
              if (!map[uid].includes(title)) map[uid].push(title);
            });
            setCourseMap(map);
          })
          .catch(() => {});
      }
    } catch {
      setLearners([]);
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.orgId]);

  useEffect(() => { loadLearners(); }, [loadLearners]);

  function formatLastActive(dateStr) {
    if (!dateStr) return 'Today';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return `${diff}d ago`;
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  function openStatusModal(learner) {
    setStatusModalLearner(learner);
    setStatusModalValue((learner.status || 'active').toLowerCase());
  }

  function closeStatusModal() {
    if (savingStatus) return;
    setStatusModalLearner(null);
  }

  async function handleSaveStatus() {
    if (!statusModalLearner) return;
    setSavingStatus(true);
    try {
      await apiServiceHandler('PUT', `user/admin/update/${statusModalLearner._id}`, { status: statusModalValue });
      setLearners(prev => {
        const next = prev.map(u => u._id === statusModalLearner._id ? { ...u, status: statusModalValue } : u);
        setStats(computeStats(next));
        return next;
      });
      toast.success('Status updated.');
      setStatusModalLearner(null);
    } catch (err) {
      toast.warning(err?.message || 'Failed to update status. Please try again.');
    } finally {
      setSavingStatus(false);
    }
  }

  const filteredLearners = debouncedSearch
    ? learners.filter(u => {
        const needle = debouncedSearch.toLowerCase();
        return (u.name || '').toLowerCase().includes(needle)
          || (u.email || '').toLowerCase().includes(needle)
          || (u.whatsapp_no || '').toLowerCase().includes(needle);
      })
    : learners;

  const totalPages    = Math.max(1, Math.ceil(filteredLearners.length / LIMIT));
  const from          = filteredLearners.length === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to            = Math.min(page * LIMIT, filteredLearners.length);
  const pagedLearners = filteredLearners.slice((page - 1) * LIMIT, page * LIMIT);
  const displayStats  = stats;

  // Real, per-org growth/share figures — replaces the old hardcoded card captions
  // ("↑ 7 This Month", "↑ 1 New", etc.) with numbers derived from this store's own
  // learner list (already scoped to orgId in loadLearners above).
  const now = new Date();
  const newThisMonth = learners.filter(u => {
    if (!u.createdAt) return false;
    const d = new Date(u.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const pctOfTotal = (n) => displayStats.total ? Math.round((n / displayStats.total) * 100) : 0;
  const activePct      = pctOfTotal(displayStats.active);
  const inactivePct    = pctOfTotal(displayStats.inactive);
  const deactivatedPct = pctOfTotal(displayStats.deactivated);

  const STATUS_TONE = { active: 'good', inactive: 'neutral', deactivated: 'bad' };

  return (
    <div className={k.page}>
      <PageHeader
        title="Users"
        sub="Every learner in your organisation — search, open a learner, edit details or change their access."
        actions={<button className={k.btnPrimary} onClick={() => router.push('/storeowner/add-learner')}>+ Add Learner</button>}
      />

      <KpiTiles items={[
        { label: 'Total learners', value: loading ? '—' : displayStats.total, icon: KitIcon.users,
          hint: loading ? '' : newThisMonth > 0 ? `↑ ${newThisMonth} this month` : 'No new learners this month' },
        { label: 'Active',      value: loading ? '—' : displayStats.active,      icon: KitIcon.check, tone: 'good', hint: loading ? '' : `${activePct}% of total · can log in` },
        { label: 'Inactive',    value: loading ? '—' : displayStats.inactive,    icon: KitIcon.clock, tone: displayStats.inactive ? 'warn' : '', hint: loading ? '' : `${inactivePct}% of total` },
        { label: 'Deactivated', value: loading ? '—' : displayStats.deactivated, icon: KitIcon.x,     tone: displayStats.deactivated ? 'bad' : '', hint: loading ? '' : `${deactivatedPct}% of total` },
      ]} />

      <Card title="All learners" meta={!loading && <Pill tone="neutral">{filteredLearners.length} learner{filteredLearners.length !== 1 ? 's' : ''}</Pill>} flush>
        <div className={k.toolbar} role="search" aria-label="Search learners">
          <label className={k.search}>
            <span className={k.srOnly}>Search learners</span>
            {KitIcon.search}
            <input className={k.input} type="text" placeholder="Search by name, email or WhatsApp no…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </label>
        </div>

        <div className={k.tableWrap}>
          <table className={k.table}>
            <thead>
              <tr>
                <th>Learner</th>
                <th>WhatsApp no</th>
                <th className={k.center}>Courses</th>
                <th>Last active</th>
                <th>Status</th>
                <th className={k.num}><span className={k.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows cols={6} /> : filteredLearners.length === 0 ? (
                <tr><td colSpan={6} className={k.empty}>{debouncedSearch ? 'No learners match your search.' : 'No learners yet.'}</td></tr>
              ) : pagedLearners.map(learner => {
                const realStatus = (learner.status || 'active').toLowerCase();
                const name = learner.name || learner.email;
                return (
                  <tr key={learner._id}>
                    <td>
                      <div className={s.nameCell}>
                        <div className={s.avatar} aria-hidden="true">{getInitials(learner.name)}</div>
                        <div className={s.nameText}>
                          <span className={k.strong}>{name}</span>
                          <span className={s.emailText}>{learner.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className={k.muted}>{learner.whatsapp_no || '—'}</td>
                    <td className={k.center}><span className={s.courseCount}>{courseMap[String(learner._id)]?.length ?? 0}</span></td>
                    <td className={k.muted}>{formatLastActive(learner.lastActive || learner.last_active)}</td>
                    <td>
                      <button type="button" className={s.statusBtn} onClick={() => openStatusModal(learner)}
                        title="Change status" aria-label={`Status: ${realStatus}. Change status for ${name}`}>
                        <Pill tone={STATUS_TONE[realStatus] || 'neutral'}>{realStatus}</Pill>
                        <svg className={s.statusCaret} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      </button>
                    </td>
                    <td>
                      <div className={k.actions}>
                        <button data-action="view" className={k.iconBtn} title="View learner" aria-label={`View ${name}`} onClick={() => router.push(`/storeowner/users/${learner._id}`)}>
                          {KitIcon.eye}
                        </button>
                        <button data-action="edit" className={k.iconBtn} title="Edit learner" aria-label={`Edit ${name}`} onClick={() => router.push(`/storeowner/users/${learner._id}/edit`)}>
                          {Icon.edit}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && <Pager page={page} pageSize={LIMIT} total={filteredLearners.length} onPage={setPage} />}
      </Card>

      {/* ── Update status modal ── */}
      {statusModalLearner && (
        <div className={s.modalOverlay} onClick={closeStatusModal}>
          <div className={s.modalBox} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="status-modal-h">
            <div id="status-modal-h" className={s.modalTitle}>Update Status</div>
            <div className={s.modalSubtitle}>Learner: {statusModalLearner.name || statusModalLearner.email}</div>

            <label className={s.modalLabel} htmlFor="status-modal-select">Account Status</label>
            <select
              id="status-modal-select"
              className={s.modalSelect}
              value={statusModalValue}
              onChange={e => setStatusModalValue(e.target.value)}
              disabled={savingStatus}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <div className={s.modalActions}>
              <button className={s.modalBtnCancel} onClick={closeStatusModal} disabled={savingStatus}>
                Cancel
              </button>
              <button className={s.modalBtnSave} onClick={handleSaveStatus} disabled={savingStatus}>
                {savingStatus ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
