'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { selectUser } from '../../../redux/slices/authSlice';
import s from "./Subscription.module.css";
import apiServiceHandler from '../../../service/apiService';
import { kit as k, PageHeader, KpiTiles, Card, Pill, Pager, KitIcon } from '../PageKit/PageKit';
import { orDash } from '../../../lib/displayValue';

function CheckCircle({ dark }) {
  return (
    <svg className={`${s.checkIcon} ${dark ? s.checkIconDark : ''}`} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill={dark ? 'rgba(255,255,255,0.2)' : '#e6f4f0'} stroke="none" />
      <path d="M6 10l3 3 5-5" stroke={dark ? '#fff' : '#0b7b7b'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

function fmtPrice(raw) {
  const p = raw?.$numberDecimal ?? raw;
  const n = p != null ? parseFloat(p) : null;
  return n != null && !isNaN(n) ? `₹${n.toLocaleString('en-IN')}` : '—';
}

const PAGE_SIZE = 10;

export default function SubscriptionPage() {
  const user = useSelector(selectUser);

  const [assignments, setAssignments]         = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [credits, setCredits]                 = useState([]);
  const [selectedCreditId, setSelectedCreditId] = useState('');
  const [purchasing, setPurchasing]           = useState(false);
  const [purchaseOrgId, setPurchaseOrgId]     = useState(null);
  const [assignPage, setAssignPage]           = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let effectiveOrgId = user?.orgId ? String(user.orgId) : null;
      if (!effectiveOrgId) {
        const uid = user?._id || getTokenUserId();
        if (uid) {
          const r = await apiServiceHandler('GET', `user/admin/edit/${uid}`);
          const rec = r?.data ?? r;
          if (rec?.orgId) effectiveOrgId = String(rec.orgId);
        }
      }

      setPurchaseOrgId(effectiveOrgId);

      const [caRes, creditRes] = await Promise.all([
        effectiveOrgId
          ? apiServiceHandler('GET', `organization-credit-assignment/list?orgId=${effectiveOrgId}`).catch(() => null)
          : Promise.resolve(null),
        apiServiceHandler('GET', 'credit/list?status=active').catch(() => null),
      ]);

      const ca = Array.isArray(caRes?.data) ? caRes.data : (Array.isArray(caRes) ? caRes : []);
      const cr = Array.isArray(creditRes?.data) ? creditRes.data : (Array.isArray(creditRes) ? creditRes : []);

      setAssignments(ca);
      setCredits(cr);
    } catch {
      setAssignments([]);
      setCredits([]);
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.orgId]);

  // Purchase -> the credit assignment is created directly server-side (see
  // server/organization_credit_assignment/organization_credit_assignment.service.js).
  async function handlePurchase() {
    if (!selectedCreditId) return;
    if (!purchaseOrgId) { toast.warning('Organisation not found.'); return; }
    setPurchasing(true);
    try {
      await apiServiceHandler('POST', 'organization-credit-assignment/create', {
        orgId:    purchaseOrgId,
        creditId: selectedCreditId,
      });
      toast.success('Credit purchased successfully.');
      setSelectedCreditId('');
      loadData();
    } catch (err) {
      toast.warning(err?.message || 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  }

  useEffect(() => { loadData(); }, [loadData]);

  const activePlan = assignments.find(a => (a.status || '').toLowerCase() === 'active') ?? assignments[0] ?? null;
  const credit     = activePlan?.creditId ?? null;
  const planTitle  = orDash(credit?.title);
  const planPrice  = fmtPrice(credit?.price);
  const limitFrom  = credit?.limit_from;
  const limitTo    = credit?.limit_to;
  const features   = (credit?.desc ?? '')
    .split(/\n|<br\s*\/?>/)
    .map(l => l.trim())
    .filter(Boolean);

  const rangeText = limitFrom != null && limitTo != null ? `${limitFrom} – ${limitTo}`
    : limitTo != null ? `Up to ${limitTo}` : limitFrom != null ? `From ${limitFrom}` : '—';
  const priceOf = c => { const n = parseFloat(c?.price?.$numberDecimal ?? c?.price); return isNaN(n) ? 0 : n; };
  const totalSpent = assignments.reduce((sum, a) => sum + priceOf(a.creditId), 0);
  const history = [...assignments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const pagedHistory = history.slice((assignPage - 1) * PAGE_SIZE, assignPage * PAGE_SIZE);
  const creditLabel = c => {
    const range = c.limit_from != null && c.limit_to != null ? `${c.limit_from}–${c.limit_to} credits`
      : c.limit_to != null ? `${c.limit_to} credits` : c.limit_from != null ? `${c.limit_from}+ credits` : null;
    const price = c.price != null ? fmtPrice(c.price) : null;
    return [c.title ?? '', range && `(${range})`, price && `— ${price}`].filter(Boolean).join(' ');
  };
  const selectedCredit = credits.find(c => c._id === selectedCreditId);

  return (
    <div className={k.page}>
      <PageHeader title="Current Credit" sub="Your active credit plan, buying more credits, and every plan assigned to your organisation." />

      <KpiTiles items={[
        { label: 'Current plan',    value: loading ? '—' : (activePlan ? planTitle : 'None'), icon: KitIcon.layers },
        { label: 'Credit range',    value: loading || !activePlan ? '—' : rangeText,          icon: KitIcon.coins },
        { label: 'Plans purchased', value: loading ? '—' : assignments.length,                icon: KitIcon.cart, hint: 'All time' },
        { label: 'Total spent',     value: loading ? '—' : fmtPrice(totalSpent),             icon: KitIcon.spark, hint: 'All plans' },
      ]} />

      <div className={s.mainGrid}>
        {/* Current plan */}
        <Card title="Current plan" meta={activePlan && <Pill tone="good">Active</Pill>}>
          {loading ? (
            <div className={s.loadingMsg}>Loading plan…</div>
          ) : !activePlan ? (
            <div className={s.noplan}>No credit plan assigned to this organisation yet. Buy one on the right to get started.</div>
          ) : (
            <div className={s.planHero}>
              <div className={s.planHeroTop}>
                <div>
                  <div className={s.planLabel}>Your plan</div>
                  <div className={s.planName}>{planTitle}</div>
                </div>
                <div className={s.planPrice}>{planPrice}</div>
              </div>
              {(limitFrom != null || limitTo != null) && (
                <div className={s.creditRange}>
                  <span className={s.creditRangeLabel}>Credits</span>
                  <span className={s.creditRangeValue}>{rangeText}</span>
                </div>
              )}
              {features.length > 0 && (
                <ul className={s.featureGrid}>
                  {features.map((ft, i) => (
                    <li key={i} className={s.featureItem}><CheckCircle /><span>{ft}</span></li>
                  ))}
                </ul>
              )}
              <div className={s.planFoot}>Assigned {formatDate(activePlan.createdAt)}</div>
            </div>
          )}
        </Card>

        {/* Purchase */}
        <Card title="Purchase credit" sub="Buy another credit pack — it’s added to your organisation straight away.">
          <label className={s.purchaseLabel} htmlFor="creditSelect">Credit pack</label>
          <select
            id="creditSelect"
            className={k.select}
            style={{ width: '100%' }}
            value={selectedCreditId}
            onChange={e => setSelectedCreditId(e.target.value)}
            disabled={purchasing}
          >
            <option value="">Select a credit option</option>
            {credits.map(c => <option key={c._id} value={c._id}>{creditLabel(c)}</option>)}
          </select>
          {selectedCredit && (
            <div className={s.purchaseSummary}>
              <span>{selectedCredit.title}</span>
              <strong>{fmtPrice(selectedCredit.price)}</strong>
            </div>
          )}
          <button
            className={k.btnPrimary}
            style={{ width: '100%', marginTop: 14 }}
            onClick={handlePurchase}
            disabled={!selectedCreditId || purchasing}
          >
            {purchasing ? 'Processing…' : 'Purchase'}
          </button>
        </Card>
      </div>

      {/* History */}
      <Card title="Assignment history" sub="Every credit plan assigned to your organisation, newest first."
        meta={!loading && <Pill tone="neutral">{history.length} plan{history.length !== 1 ? 's' : ''}</Pill>} flush>
        <div className={k.tableWrap}>
          <table className={k.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Plan</th>
                <th className={k.num}>Credits</th>
                <th className={k.num}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className={k.empty}>Loading history…</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={5} className={k.empty}>No credit assignments found.</td></tr>
              ) : pagedHistory.map((a, i) => {
                const c = a.creditId ?? {};
                return (
                  <tr key={a._id ?? i}>
                    <td className={k.idx}>{(assignPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td>{formatDate(a.createdAt)}</td>
                    <td className={k.strong}>{orDash(c.title)}</td>
                    <td className={k.num}>{c.limit_to != null ? c.limit_to : '—'}</td>
                    <td className={`${k.num} ${k.strong}`}>{fmtPrice(c.price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && <Pager page={assignPage} pageSize={PAGE_SIZE} total={history.length} onPage={setAssignPage} />}
      </Card>
    </div>
  );
}
