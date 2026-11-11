'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import vpPage from "./ViewSupportTicket.module.css";
import sPage from "./ViewSupportTicket.module.css";
import ViewDetailRows, { capitalize } from '../ViewDetailRows';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const vp = withAdminKit(vpPage);
const s = withAdminKit(sPage);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
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
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${date}  ${time}`;
  } catch { return '—'; }
}

const STATUS_MAP = {
  open:         { label: 'Open',         cls: 'badgeOpen' },
  in_progress:  { label: 'In Progress',  cls: 'badgeInProgress' },
  resolved:     { label: 'Resolved',     cls: 'badgeResolved' },
  close:        { label: 'Closed',       cls: 'badgeClosed' },
  not_possible: { label: 'Not Possible', cls: 'badgeNotPossible' },
  deleted:      { label: 'Deleted',      cls: 'badgeDeleted' },
};

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

export default function ViewSupportTicket() {
  const router = useRouter();
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `support-ticket/edit/${id}`)
      .then(res => setTicket(res?.data ?? res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SuperAdminShell activeSection="support-tickets"><p className={vp.loadingText}>Loading…</p></SuperAdminShell>;
  if (!ticket?._id) return <SuperAdminShell activeSection="support-tickets"><p className={vp.loadingText}>Ticket not found.</p></SuperAdminShell>;

  const sc = STATUS_MAP[ticket.status] ?? STATUS_MAP.open;

  return (
    <SuperAdminShell activeSection="support-tickets">
      <button className={vp.backBtn} onClick={() => router.push('/superadmin/support-tickets')}>
        {BackArrow} Back to Support Tickets
      </button>
      <div className={vp.viewToolbar}>
        <nav className={vp.breadcrumb}>
          <button className={vp.breadcrumbLink} onClick={() => router.push('/superadmin/support-tickets')}>
            Support Tickets
          </button>
          <span className={vp.breadcrumbSep}>›</span>
          <span className={vp.breadcrumbCurr}>#{ticket.ticket_id}</span>
        </nav>
        <button
          className={vp.btnEdit}
          onClick={() => router.push(`/superadmin/support-tickets/${id}/edit`)}
        >
          <EditIcon /> Respond
        </button>
      </div>

      <div className={vp.detailCardWide}>
        {/* ── Card header ── */}

        {/* ── Compact metadata rows ── */}
        <div className={vp.detailBody}>
          <ViewDetailRows s={vp} rows={[
              { label: 'Ticket ID', value: ticket.ticket_id && `#${ticket.ticket_id}`, variant: 'mono' },
              { label: 'Organization', value: ticket.orgId?.org_name },
              { label: 'Issue Type', value: ticket.issue_type },
              { label: 'Priority', value: capitalize(ticket.priority) },
              { label: 'Status', value: sc.label },
              { label: 'Raised On', value: fmtDate(ticket.createdAt) },
              { label: 'Last Updated', value: fmtDate(ticket.updatedAt) },
          ]} />
        </div>

        {/* ── Text sections ── */}
        <div className={vp.detailSections}>
          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Ticket Details</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Subject</span>
                <span className={vp.sectionValue}>{ticket.subject || '—'}</span>
              </div>
              <div className={vp.sectionRow} style={{ alignItems: 'flex-start' }}>
                <span className={vp.sectionLabel} style={{ paddingTop: 2 }}>Description</span>
                <div className={s.viewPre} style={{ flex: 1, margin: 0 }}>{ticket.desc || '—'}</div>
              </div>
            </div>
          </div>

          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Resolution</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow} style={{ alignItems: 'flex-start' }}>
                <span className={vp.sectionLabel} style={{ paddingTop: 2 }}>Notes</span>
                <div className={s.viewPre} style={{ flex: 1, margin: 0 }}>{ticket.resolve_text || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ResponseLogs logs={ticket.logs} />
    </SuperAdminShell>
  );
}
