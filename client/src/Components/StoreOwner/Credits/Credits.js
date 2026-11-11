'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import s from "./Credits.module.css";
import { kit as k, PageHeader, KpiTiles, Card, Pill, Pager, SkeletonRows, KitIcon } from '../PageKit/PageKit';

function getTokenUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('adminToken');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload._id || null;
  } catch { return null; }
}

function fmtDate(val) {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

export default function CreditsPage() {
  const user = useSelector(selectUser);

  const [loading, setLoading]           = useState(true);
  const [lastCredit, setLastCredit]     = useState(null);
  const [allCredits, setAllCredits]     = useState([]);
  const [activeUsers, setActiveUsers]   = useState(0);
  const [assignedCount, setAssigned]    = useState(0);
  const [history, setHistory]           = useState([]);
  const [histPage, setHistPage]         = useState(1);

  const PAGE_SIZE = 10;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let orgId = user?.orgId ? String(user.orgId) : null;
      if (!orgId) {
        const uid = user?._id || getTokenUserId();
        if (uid) {
          const r = await apiServiceHandler('GET', `user/admin/edit/${uid}`);
          const rec = r?.data ?? r;
          if (rec?.orgId) orgId = String(rec.orgId);
        }
      }
      if (!orgId) return;

      const [creditRes, usersRes, histRes] = await Promise.all([
        apiServiceHandler('GET', `organization-credit-assignment/list?orgId=${orgId}`),
        apiServiceHandler('GET', `user/admin/list?orgId=${orgId}&user_type=employee&orgRole=employee`),
        apiServiceHandler('GET', `credit-used/list?orgId=${orgId}`),
      ]);

      // All credit purchases — sort newest first; keep last for the label
      const credits = Array.isArray(creditRes?.data) ? creditRes.data : [];
      if (credits.length > 0) {
        credits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setAllCredits(credits);
        setLastCredit(credits[0]);
      }

      // Active users count
      const userList = Array.isArray(usersRes?.data) ? usersRes.data : [];
      setActiveUsers(userList.filter(u => u.status === 'active' || !u.status).length);

      // Credit usage history from credit-used table — also the source of truth for
      // "credits used": AssignCourses.js and AddLearner.js each log one active
      // credit-used record per course assignment, so every assignment (not just a
      // learner's first) counts here.
      const hist = Array.isArray(histRes?.data) ? histRes.data
        : Array.isArray(histRes) ? histRes : [];
      hist.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setHistory(hist);
      setAssigned(hist.filter(h => (h.status || 'active') === 'active').length);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived values
  const creditInfo  = lastCredit?.creditId ?? {};
  const limitFrom   = creditInfo.limit_from ?? 0;
  const limitTo     = creditInfo.limit_to ?? 0;
  const creditLabel = creditInfo.title
    ? `${creditInfo.title} — (${limitFrom}–${limitTo}) credits`
    : '—';

  // Total credits = sum of every credit pack purchased by the org to date
  const totalCredits = allCredits.reduce(
    (sum, c) => sum + (c.creditId?.limit_to ?? 0),
    0
  );
  const creditsRemaining = totalCredits - assignedCount;

  const SNAPSHOT = [
    { label: 'Credits',           value: loading ? '…' : creditLabel,                          bold: true },
    { label: 'Total learners',    value: loading ? '…' : String(activeUsers) },
    { label: 'Credits remaining', value: loading ? '…' : String(creditsRemaining),              large: true },
    { label: 'Credit cost',       value: '1 Per Course Assigned',                              bold: true },
    { label: 'Credits used',      value: loading ? '…' : `${assignedCount} / ${totalCredits}` },
  ];

  const remaining = creditsRemaining > 0 ? creditsRemaining : 0;
  const usedPct = totalCredits > 0 ? Math.min(100, Math.round((assignedCount / totalCredits) * 100)) : 0;
  const remainingTone = loading || totalCredits === 0 ? '' : remaining === 0 ? 'bad' : remaining / totalCredits < 0.2 ? 'warn' : 'good';
  const pagedHistory = history.slice((histPage - 1) * PAGE_SIZE, histPage * PAGE_SIZE);

  return (
    <div className={k.page}>
      <PageHeader title="Credits Usage" sub="How many credits you have, how many are used, and where each one went. One credit is used per course assigned." />

      <KpiTiles items={[
        { label: 'Total credits',  value: loading ? '—' : totalCredits,  icon: KitIcon.coins, hint: 'All packs purchased' },
        { label: 'Used',           value: loading ? '—' : assignedCount, icon: KitIcon.spark, hint: loading || !totalCredits ? '' : `${usedPct}% of total` },
        { label: 'Remaining',      value: loading ? '—' : remaining,     icon: KitIcon.check, tone: remainingTone, hint: remainingTone === 'bad' ? 'Buy more to keep assigning' : remainingTone === 'warn' ? 'Running low' : 'Available to assign' },
        { label: 'Active learners', value: loading ? '—' : activeUsers,  icon: KitIcon.users },
      ]} />

      <div className={s.topGrid}>
        <Card title="Credit usage" sub="Used vs. remaining across all purchased packs.">
          <div className={s.usageHead}>
            <div>
              <span className={s.usageBig}>{loading ? '—' : assignedCount}</span>
              <span className={s.usageOf}> / {loading ? '—' : totalCredits} used</span>
            </div>
            <span className={s.usagePct}>{loading ? '' : `${usedPct}%`}</span>
          </div>
          <div className={s.usageBar} role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Credits used">
            <span className={s.usageUsed} style={{ width: `${usedPct}%` }} />
          </div>
          <ul className={s.legend}>
            <li><span className={`${s.dot} ${s.dotUsed}`} />Used <strong>{loading ? '—' : assignedCount}</strong></li>
            <li><span className={`${s.dot} ${s.dotLeft}`} />Remaining <strong>{loading ? '—' : remaining}</strong></li>
          </ul>
        </Card>

        <Card title="Store snapshot">
          <dl className={k.dl}>
            {SNAPSHOT.map(row => (
              <div key={row.label} className={k.dlRow}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card title="Credit usage history" sub="One row per course assigned to a learner, newest first."
        meta={!loading && <Pill tone="neutral">{history.length} record{history.length !== 1 ? 's' : ''}</Pill>} flush>
        <div className={k.tableWrap}>
          <table className={k.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Learner</th>
                <th>Course</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows rows={3} cols={5} /> : history.length === 0 ? (
                <tr><td colSpan={5} className={k.empty}>No credit usage history yet.</td></tr>
              ) : pagedHistory.map((row, i) => {
                const status = (row.status || 'active').toLowerCase();
                return (
                  <tr key={row._id ?? i}>
                    <td className={k.idx}>{(histPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className={k.strong}>{row.learnerId?.name || row.learnerId?.email || '—'}</td>
                    <td>{row.courseId?.title || '—'}</td>
                    <td><Pill tone={status === 'active' ? 'good' : 'neutral'}>{status}</Pill></td>
                    <td className={k.muted}>{fmtDate(row.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && <Pager page={histPage} pageSize={PAGE_SIZE} total={history.length} onPage={setHistPage} />}
      </Card>
    </div>
  );
}
