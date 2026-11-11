'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./EditSupportTicket.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const STATUS_OPTIONS = [
  { value: 'open',         label: 'Open' },
  { value: 'in_progress',  label: 'In Progress' },
  { value: 'resolved',     label: 'Resolved' },
  { value: 'close',        label: 'Closed' },
  { value: 'not_possible', label: 'Not Possible' },
];

const STATUS_MAP = {
  open:         { label: 'Open',         cls: 'badgeOpen' },
  in_progress:  { label: 'In Progress',  cls: 'badgeInProgress' },
  resolved:     { label: 'Resolved',     cls: 'badgeResolved' },
  close:        { label: 'Closed',       cls: 'badgeClosed' },
  not_possible: { label: 'Not Possible', cls: 'badgeNotPossible' },
  deleted:      { label: 'Deleted',      cls: 'badgeDeleted' },
};

function fmtDateTime(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    const dd  = String(d.getDate()).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    const yy  = d.getFullYear();
    const hr  = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yy}  ${hr}:${min}`;
  } catch { return '—'; }
}

function ResponseLogs({ logs }) {
  if (!Array.isArray(logs) || logs.length === 0) return null;
  return (
    <div className={s.logsCard}>
      <h3 className={s.logsTitle}>Response History</h3>
      <div className={s.logsList}>
        {[...logs].reverse().map((log, i) => {
          const sc = STATUS_MAP[log.status] ?? null;
          return (
            <div key={i} className={s.logEntry}>
              <div className={s.logEntryHeader}>
                <span className={s.logDate}>{fmtDateTime(log.date)}</span>
                <span className={s.logAdmin}>{log.adminName || 'Admin'}</span>
                {sc && <span className={`${s.badge} ${s[sc.cls]}`}>{sc.label}</span>}
              </div>
              {log.comment && <p className={s.logComment}>{log.comment}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EditSupportTicket() {
  const router = useRouter();
  const { id } = useParams();

  const [ticket, setTicket]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus]       = useState('open');
  const [resolveText, setResolveText] = useState('');

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `support-ticket/edit/${id}`)
      .then(res => {
        const t = res?.data ?? res;
        if (t?._id) {
          setTicket(t);
          setStatus(t.status || 'open');
          setResolveText('');
        }
      })
      .catch(() => toast.warning('Failed to load ticket.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiServiceHandler('PUT', `support-ticket/update/${id}`, {
        status,
        resolve_text: resolveText.trim(),
      });
      toast.success('Ticket updated successfully.');
      router.push(`/superadmin/support-tickets/${id}`);
    } catch (err) {
      toast.warning(err?.message || 'Failed to update ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SuperAdminShell activeSection="support-tickets">
        <p style={{ padding: 40, color: '#6b7280' }}>Loading…</p>
      </SuperAdminShell>
    );
  }
  if (!ticket?._id) {
    return (
      <SuperAdminShell activeSection="support-tickets">
        <p style={{ padding: 40, color: '#6b7280' }}>Ticket not found.</p>
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell activeSection="support-tickets">
      <button className={s.backBtn} onClick={() => router.push(`/superadmin/support-tickets/${id}`)}>
        <BackArrow /> Back to Ticket
      </button>

      <h1 className={s.pageTitle}>Respond to #{ticket.ticket_id}</h1>
      <p className={s.pageSubtitle}>Update status and add resolution notes</p>

      <form onSubmit={handleSubmit} autoComplete="off" style={{ marginTop: 18 }}>
        <div className={s.formCard}>
          <div className={s.formGrid}>

            {/* Read-only info */}
            <div className={s.formGroup}>
              <label>Organization</label>
              <div className={s.inputReadonly}>{ticket.orgId?.org_name || '—'}</div>
            </div>
            <div className={s.formGroup}>
              <label>Issue Type</label>
              <div className={s.inputReadonly}>{ticket.issue_type}</div>
            </div>
            <div className={`${s.formGroup} ${s.formGroupFull}`}>
              <label>Subject</label>
              <div className={s.inputReadonly}>{ticket.subject}</div>
            </div>
            <div className={`${s.formGroup} ${s.formGroupFull}`}>
              <label>Description</label>
              <div className={s.inputReadonly} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {ticket.desc}
              </div>
            </div>

            <hr className={s.sectionDivider} />
            <p className={s.sectionTitle}>Your Response</p>

            {/* Editable fields */}
            <div className={s.formGroup}>
              <label>Status <span className={s.required}>*</span></label>
              <select
                className={s.select}
                value={status}
                onChange={e => setStatus(e.target.value)}
                required
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className={`${s.formGroup} ${s.formGroupFull}`}>
              <label>Resolution Notes</label>
              <textarea
                className={s.textarea}
                rows={5}
                placeholder="Describe the resolution or steps taken…"
                value={resolveText}
                onChange={e => setResolveText(e.target.value)}
              />
            </div>

            <div className={s.formActions}>
              <button className={s.btnSave} type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Response'}
              </button>
              <button
                type="button"
                className={s.btnCancel}
                onClick={() => router.push(`/superadmin/support-tickets/${id}`)}
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      </form>

      <ResponseLogs logs={ticket.logs} />
    </SuperAdminShell>
  );
}
