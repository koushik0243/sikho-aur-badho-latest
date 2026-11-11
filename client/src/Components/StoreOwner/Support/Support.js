'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { selectUser } from '../../../redux/slices/authSlice';
import s from "./Support.module.css";
import apiServiceHandler from '../../../service/apiService';
import { ISSUE_TYPES, PRIORITIES } from '../../../lib/supportTickets';
import { kit as k, PageHeader, KpiTiles, Card, Pill, Pager, SkeletonRows, KitIcon } from '../PageKit/PageKit';

// ── Helpers ──────────────────────────────────────────────────────
function getTokenUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('adminToken');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload._id || null;
  } catch { return null; }
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}


// ── Icons ─────────────────────────────────────────────────────────
const ChevronDown = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

// ── Constants ─────────────────────────────────────────────────────
const EMPTY_FORM  = { issueType: '', subject: '', description: '', priority: 'Normal' };
const PER_PAGE    = 50;

const STATUS_TONE   = { open: 'info', in_progress: 'warn', resolved: 'good', close: 'neutral', not_possible: 'bad', deleted: 'neutral' };
const PRIORITY_TONE = { Low: 'neutral', Normal: 'info', High: 'warn', Urgent: 'bad' };

const STATUS_CFG = {
  open:         { label: 'Open',         cls: 'statusOpen',        progress: 12 },
  in_progress:  { label: 'In Progress',  cls: 'statusInProgress',  progress: 48 },
  resolved:     { label: 'Resolved',     cls: 'statusResolved',    progress: 100 },
  close:        { label: 'Closed',       cls: 'statusClosed',      progress: 100 },
  not_possible: { label: 'Not Possible', cls: 'statusNotPossible', progress: 60 },
  deleted:      { label: 'Deleted',      cls: 'statusDeleted',     progress: 0 },
};

// ── Toast ────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`${s.toast} ${toast.type === 'error' ? s.toastError : s.toastSuccess}`}>
      <span className={s.toastIcon}>{toast.type === 'error' ? '✕' : '✓'}</span>
      {toast.msg}
    </div>
  );
}

// ── Delete Confirmation Modal ─────────────────────────────────────
function DeleteModal({ count, onCancel, onConfirm, deleting }) {
  return (
    <div className={s.modalOverlay}>
      <div className={s.modalBox}>
        <h3 className={s.modalTitle}>Confirm Delete</h3>
        <p className={s.modalText}>
          Are you sure you want to delete {count === 1 ? 'this ticket' : `${count} tickets`}?
          This action cannot be undone.
        </p>
        <div className={s.modalActions}>
          <button className={s.btnCancelModal} onClick={onCancel} disabled={deleting}>Cancel</button>
          <button className={s.btnConfirmDelete} onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : `Delete${count > 1 ? ` (${count})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function SupportPage() {
  const user = useSelector(selectUser);
  const router = useRouter();

  const [view, setView]             = useState('list');
  const [tickets, setTickets]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [orgId, setOrgId]           = useState(null);

  const [form, setForm]             = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [checked, setChecked]           = useState(new Set());
  const [page, setPage]                 = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery]   = useState('');

  const [toast, setToast]             = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting]       = useState(false);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let oid = user?.orgId ? String(user.orgId) : null;
      if (!oid) {
        const uid = user?._id || getTokenUserId();
        if (uid) {
          const r = await apiServiceHandler('GET', `user/admin/edit/${uid}`);
          const rec = r?.data ?? r;
          if (rec?.orgId) oid = String(rec.orgId);
        }
      }
      if (oid) setOrgId(oid);
      const res = await apiServiceHandler('GET', oid ? `support-ticket/list?orgId=${oid}` : 'support-ticket/list').catch(() => null);
      const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setTickets(data);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  function setField(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiServiceHandler('POST', 'support-ticket/create', {
        orgId,
        issue_type: form.issueType,
        subject:    form.subject,
        desc:       form.description,
        priority:   form.priority,
      });
      showToast('success', 'Ticket raised successfully!');
      setForm(EMPTY_FORM);
      setView('list');
      loadData();
    } catch (err) {
      showToast('error', err?.message || 'Failed to raise ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      for (const id of deleteModal) {
        await apiServiceHandler('GET', `support-ticket/delete/${id}`);
      }
      showToast('success', `${deleteModal.length} ticket${deleteModal.length > 1 ? 's' : ''} deleted.`);
      setChecked(new Set());
      setDeleteModal(null);
      setPage(1);
      await loadData();
    } catch (err) {
      showToast('error', err?.message || 'Failed to delete ticket(s).');
    } finally {
      setDeleting(false);
    }
  }

  const filteredTickets = tickets.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.replace(/^#/, '').toLowerCase();
      const matchId      = (t.ticket_id   || '').toLowerCase().includes(q);
      const matchSubject = (t.subject     || '').toLowerCase().includes(q);
      const matchType    = (t.issue_type  || '').toLowerCase().includes(q);
      if (!matchId && !matchSubject && !matchType) return false;
    }
    return true;
  });

  useEffect(() => { setPage(1); }, [statusFilter, searchQuery]);

  const totalPages     = Math.max(1, Math.ceil(filteredTickets.length / PER_PAGE));
  const pagedTickets   = filteredTickets.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pageIds        = pagedTickets.map(t => t._id);
  const allPageChecked = pageIds.length > 0 && pageIds.every(id => checked.has(id));

  function toggleCheck(id) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setChecked(prev => {
      const next = new Set(prev);
      const allOn = pageIds.every(id => next.has(id));
      allOn ? pageIds.forEach(id => next.delete(id)) : pageIds.forEach(id => next.add(id));
      return next;
    });
  }

  // ════════════════════════════════════════════════════════════════
  // ADD VIEW
  // ════════════════════════════════════════════════════════════════
  if (view === 'add') {
    return (
      <>
        <Toast toast={toast} />
        <nav className={s.breadcrumb}>
          <div className={s.breadcrumbLeft}>
            <button className={s.breadcrumbLink} onClick={() => setView('list')}>Support Tickets</button>
            <span className={s.breadcrumbSep}>›</span>
            <span className={s.breadcrumbCurr}>Raise a Ticket</span>
          </div>
        </nav>

        <div className={s.card}>
          <div className={s.formCardHead}>
            <h2 className={s.formCardTitle}>Ticket Information</h2>
          </div>
          <div className={s.formCardBody}>
            <form onSubmit={handleSubmit}>
              <div className={s.formGrid}>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Issue Type</label>
                  <div className={s.selectWrap}>
                    <select className={s.select} value={form.issueType} onChange={setField('issueType')} required>
                      <option value="" disabled>Select Issue Type…</option>
                      {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className={s.chevron}><ChevronDown /></span>
                  </div>
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Priority</label>
                  <div className={s.selectWrap}>
                    <select className={s.select} value={form.priority} onChange={setField('priority')}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <span className={s.chevron}><ChevronDown /></span>
                  </div>
                </div>
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label}>Subject</label>
                <input
                  className={s.input}
                  placeholder="Brief description of the issue…"
                  value={form.subject}
                  onChange={setField('subject')}
                  required
                />
              </div>

              <div className={s.fieldGroup}>
                <label className={s.label}>Description</label>
                <textarea
                  className={s.textarea}
                  placeholder="Describe your issue in detail…"
                  value={form.description}
                  onChange={setField('description')}
                  rows={5}
                  required
                />
              </div>

              <div className={s.formFooter}>
                <button type="button" className={s.btnCancel} onClick={() => setView('list')}>Cancel</button>
                <button type="submit" className={s.btnSubmit} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Raise a Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════════
  const countBy = st => tickets.filter(tk => st.includes(tk.status)).length;
  const openCount = countBy(['open']);
  const progressCount = countBy(['in_progress']);
  const doneCount = countBy(['resolved', 'close']);

  return (
    <div className={k.page}>
      <Toast toast={toast} />

      <PageHeader
        title="Support Tickets"
        sub="Raise an issue with the platform team and follow its progress here."
        actions={<button className={k.btnPrimary} onClick={() => setView('add')}>+ New Ticket</button>}
      />

      <KpiTiles items={[
        { label: 'Total tickets', value: loading ? '—' : tickets.length, icon: KitIcon.ticket },
        { label: 'Open',          value: loading ? '—' : openCount,      icon: KitIcon.clock, tone: openCount ? 'info' : '', hint: 'Waiting for a reply' },
        { label: 'In progress',   value: loading ? '—' : progressCount,  icon: KitIcon.spark, tone: progressCount ? 'warn' : '', hint: 'Being worked on' },
        { label: 'Resolved',      value: loading ? '—' : doneCount,      icon: KitIcon.check, tone: doneCount ? 'good' : '', hint: 'Resolved or closed' },
      ]} />

      <Card title="All tickets" meta={!loading && <Pill tone="neutral">{filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}</Pill>} flush>
        <div className={k.toolbar} role="search" aria-label="Filter tickets">
          <label className={k.search}>
            <span className={k.srOnly}>Search tickets</span>
            {KitIcon.search}
            <input
              className={k.input}
              type="text"
              placeholder="Search by subject, type or ticket ID…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </label>
          <select className={k.select} aria-label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_CFG).filter(([key]) => key !== 'deleted').map(([key, v]) => (
              <option key={key} value={key}>{v.label}</option>
            ))}
          </select>
        </div>

        <div className={k.tableWrap}>
          <table className={k.table}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" aria-label="Select all tickets on this page" checked={allPageChecked} onChange={toggleAll} />
                </th>
                <th>Ticket</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Raised on</th>
                <th className={k.num}><span className={k.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows cols={8} /> : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className={k.empty}>
                    {tickets.length === 0 ? (
                      <>No tickets yet.{' '}
                        <button className={s.emptyLink} onClick={() => setView('add')}>Raise your first ticket →</button>
                      </>
                    ) : 'No tickets match your filters.'}
                  </td>
                </tr>
              ) : pagedTickets.map(ticket => {
                const sc     = STATUS_CFG[ticket.status] ?? STATUS_CFG.open;
                const isChkd = checked.has(ticket._id);
                const open   = () => router.push(`/storeowner/support/${ticket._id}`);
                return (
                  <tr key={ticket._id} className={`${k.rowLink} ${isChkd ? k.rowChecked : ''}`} onClick={open}>
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ticket ${ticket.ticket_id}`} checked={isChkd} onChange={() => toggleCheck(ticket._id)} />
                    </td>
                    <td><span className={`${k.mono} ${k.strong}`}>#{ticket.ticket_id}</span></td>
                    <td className={k.strong}>{ticket.subject}</td>
                    <td>{ticket.issue_type || '—'}</td>
                    <td>{ticket.priority ? <Pill tone={PRIORITY_TONE[ticket.priority] || 'neutral'}>{ticket.priority}</Pill> : '—'}</td>
                    <td><Pill tone={STATUS_TONE[ticket.status] || 'neutral'}>{sc.label}</Pill></td>
                    <td className={k.muted}>{formatDate(ticket.createdAt)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className={k.actions}>
                        <button data-action="view" className={k.iconBtn} title="View ticket" aria-label={`View ticket ${ticket.ticket_id}`} onClick={open}>
                          {KitIcon.eye}
                        </button>
                        <button data-action="delete" className={`${k.iconBtn} ${k.iconBtnDanger}`} title="Delete ticket" aria-label={`Delete ticket ${ticket.ticket_id}`}
                          onClick={() => setDeleteModal([ticket._id])}>
                          {KitIcon.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && (
          <Pager
            page={page}
            pageSize={PER_PAGE}
            total={filteredTickets.length}
            onPage={setPage}
            left={checked.size > 0 && (
              <button data-bulk-action="delete" className={k.btnDanger} onClick={() => setDeleteModal([...checked])}>
                Delete Selected ({checked.size})
              </button>
            )}
          />
        )}
      </Card>

      {deleteModal && (
        <DeleteModal count={deleteModal.length} onCancel={() => setDeleteModal(null)} onConfirm={confirmDelete} deleting={deleting} />
      )}
    </div>
  );
}
