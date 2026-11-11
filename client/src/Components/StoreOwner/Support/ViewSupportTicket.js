'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import pageStyles from "./ViewSupportTicket.module.css";
import { withDetailKit } from '../PageKit/PageKit';

// Page styles + the shared store owner detail-page look.
const vp = withDetailKit(pageStyles);
const s = withDetailKit(pageStyles);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${date}  ${time}`;
  } catch { return '—'; }
}

const STATUS_CFG = {
  open:         { label: 'Open',         cls: 'statusOpen' },
  in_progress:  { label: 'In Progress',  cls: 'statusInProgress' },
  resolved:     { label: 'Resolved',     cls: 'statusResolved' },
  close:        { label: 'Closed',       cls: 'statusClosed' },
  not_possible: { label: 'Not Possible', cls: 'statusNotPossible' },
  deleted:      { label: 'Deleted',      cls: 'statusDeleted' },
};

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`${s.toast} ${toast.type === 'error' ? s.toastError : s.toastSuccess}`}>
      <span className={s.toastIcon}>{toast.type === 'error' ? '✕' : '✓'}</span>
      {toast.msg}
    </div>
  );
}

export default function ViewSupportTicketPage() {
  const { id } = useParams();
  const router = useRouter();

  const [ticket, setTicket]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm]   = useState(false);
  const [toast, setToast]       = useState(null);

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadTicket = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiServiceHandler('GET', `support-ticket/edit/${id}`);
      const data = res?.data ?? res;
      if (!data?._id) { setNotFound(true); }
      else { setTicket(data); }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiServiceHandler('GET', `support-ticket/delete/${id}`);
      showToast('success', 'Ticket deleted.');
      setTimeout(() => router.push('/storeowner/support'), 1500);
    } catch (err) {
      showToast('error', err?.message || 'Failed to delete ticket.');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className={s.skeletonWrap}>
        <div className={s.skeletonLine} style={{ width: '35%' }} />
        <div className={s.skeletonCard} />
      </div>
    );
  }

  if (notFound || !ticket) {
    return (
      <div className={s.notFound}>
        <div className={s.notFoundTitle}>Ticket not found</div>
        <button className={s.backBtn} onClick={() => router.push('/storeowner/support')}>
          {BackArrow} Back to Support
        </button>
      </div>
    );
  }

  const sc = STATUS_CFG[ticket.status] ?? { label: ticket.status, cls: 'statusOpen' };

  return (
    <>
      <Toast toast={toast} />

      {/* ── Back button ── */}
      <button className={s.backBtn} onClick={() => router.push('/storeowner/support')}>
        {BackArrow} Back to Support
      </button>

      {/* ── Breadcrumb ── */}
      <nav className={vp.breadcrumb} style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className={vp.breadcrumbLink} onClick={() => router.push('/storeowner/support')}>
            Support Tickets
          </button>
          <span className={vp.breadcrumbSep}>›</span>
          <span className={vp.breadcrumbCurr}>#{ticket.ticket_id}</span>
        </div>
        <button className={s.btnDeleteOutline} onClick={() => setConfirm(true)} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </nav>

      {/* ── Ticket detail card ── */}
      <div className={s.detailCard}>
        <div className={s.detailHead}>
          <div className={s.ticketIdGroup}>
            <span className={s.ticketId}>#{ticket.ticket_id}</span>
            <span className={s.ticketDot}>·</span>
            <span className={s.ticketCategory}>{ticket.issue_type}</span>
          </div>
          <span className={`${s.statusBadge} ${s[sc.cls]}`}>{sc.label}</span>
        </div>

        <div className={s.detailBody}>
          <div className={s.viewSubject}>{ticket.subject}</div>

          <div className={vp.sectionRows}>
            <div className={vp.sectionRow}>
              <span className={vp.sectionLabel}>Priority</span>
              <span className={vp.sectionValue}>{ticket.priority || '—'}</span>
            </div>
            <div className={vp.sectionRow}>
              <span className={vp.sectionLabel}>Raised On</span>
              <span className={vp.sectionValue}>{formatDate(ticket.createdAt)}</span>
            </div>
            <div className={vp.sectionRow}>
              <span className={vp.sectionLabel}>Ticket ID</span>
              <span className={vp.sectionValueMono}>#{ticket.ticket_id}</span>
            </div>
            <div className={vp.sectionRow}>
              <span className={vp.sectionLabel}>Status</span>
              <span className={vp.sectionValue}>
                <span className={`${s.statusBadge} ${s[sc.cls]}`}>{sc.label}</span>
              </span>
            </div>
          </div>

          {ticket.desc && (
            <div className={s.sectionBlock}>
              <span className={s.sectionLabel}>Description</span>
              <p className={s.sectionText}>{ticket.desc}</p>
            </div>
          )}

          {ticket.resolve_text && (
            <div className={s.sectionBlock}>
              <span className={s.sectionLabel}>Resolution Notes</span>
              <p className={s.sectionText}>{ticket.resolve_text}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Response history ── */}
      {Array.isArray(ticket.logs) && ticket.logs.length > 0 && (
        <div className={s.logsCard}>
          <div className={s.logsHead}>
            <h3 className={s.logsTitle}>Response History</h3>
          </div>
          <div className={s.logsList}>
            {[...ticket.logs].reverse().map((log, i) => {
              const logSc = STATUS_CFG[log.status] ?? null;
              return (
                <div key={i} className={s.logEntry}>
                  <div className={s.logEntryHeader}>
                    <span className={s.logDate}>{formatDateTime(log.date)}</span>
                    <span className={s.logAdmin}>{log.adminName || 'Admin'}</span>
                    {logSc && (
                      <span className={`${s.statusBadge} ${s[logSc.cls]}`}>{logSc.label}</span>
                    )}
                  </div>
                  {log.comment && <p className={s.logComment}>{log.comment}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ── */}
      {confirm && (
        <div className={s.modalOverlay}>
          <div className={s.modalBox}>
            <h3 className={s.modalTitle}>Confirm Delete</h3>
            <p className={s.modalText}>
              Are you sure you want to delete ticket #{ticket.ticket_id}? This cannot be undone.
            </p>
            <div className={s.modalActions}>
              <button className={s.btnCancelModal} onClick={() => setConfirm(false)} disabled={deleting}>
                Cancel
              </button>
              <button className={s.btnConfirmDelete} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
