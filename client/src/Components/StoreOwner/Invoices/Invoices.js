'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import { kit as k, PageHeader, KpiTiles, Card, Pill, Pager, SkeletonRows, KitIcon } from '../PageKit/PageKit';
import { usePaymentMethods } from '../../../lib/paymentMethods';

const LIMIT = 10;

const PAYMENT_STATUS_CFG = {
  paid:     { label: 'Paid',     cls: 'badgePaid' },
  pending:  { label: 'Pending',  cls: 'badgePending' },
  failed:   { label: 'Failed',   cls: 'badgeFailed' },
  refunded: { label: 'Refunded', cls: 'badgeRefunded' },
};
const STATUS_TONE = {"paid":"good","pending":"warn","failed":"bad","refunded":"info"};

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

function fmtAmount(val) {
  const n = val != null ? parseFloat(val) : null;
  return n != null && !isNaN(n) ? `₹${n.toLocaleString('en-IN')}` : '—';
}

export default function InvoicesPage() {
  const { labelOf: paymentMethodLabel } = usePaymentMethods();
  const user   = useSelector(selectUser);
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState({ total: 0, paid: 0, pending: 0, failed: 0 });
  const [page, setPage]         = useState(1);

  const loadInvoices = useCallback(async () => {
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
      if (!effectiveOrgId) { setInvoices([]); setLoading(false); return; }

      const res = await apiServiceHandler('GET', `invoice/list?org_id=${effectiveOrgId}`);
      const data = res?.data ?? res;
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.payment_date || b.createdAt) - new Date(a.payment_date || a.createdAt));
      setInvoices(list);
      setStats({
        total:   list.length,
        paid:    list.filter(i => i.payment_status === 'paid').length,
        pending: list.filter(i => i.payment_status === 'pending').length,
        failed:  list.filter(i => i.payment_status === 'failed' || i.payment_status === 'refunded').length,
      });
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.orgId]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const totalPages = Math.max(1, Math.ceil(invoices.length / LIMIT));
  const from       = invoices.length === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to         = Math.min(page * LIMIT, invoices.length);
  const paged      = invoices.slice((page - 1) * LIMIT, page * LIMIT);

  const paidTotal = invoices.filter(i => i.payment_status === 'paid').reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);

  return (
    <div className={k.page}>
      <PageHeader title="Invoices" sub="Invoices for your credit purchases — open one to view or download it." />

      <KpiTiles items={[
        { label: 'Total invoices', value: loading ? '—' : stats.total,   icon: KitIcon.doc,   hint: 'All time' },
        { label: 'Paid',           value: loading ? '—' : stats.paid,    icon: KitIcon.check, tone: 'good', hint: loading ? '' : `${fmtAmount(paidTotal)} settled` },
        { label: 'Pending',        value: loading ? '—' : stats.pending, icon: KitIcon.clock, tone: stats.pending ? 'warn' : '', hint: 'Awaiting payment' },
        { label: 'Failed',         value: loading ? '—' : stats.failed,  icon: KitIcon.x,     tone: stats.failed ? 'bad' : '', hint: 'Failed or refunded' },
      ]} />

      <Card title="All invoices" meta={!loading && <Pill tone="neutral">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</Pill>} flush>
        <div className={k.tableWrap}>
          <table className={k.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Invoice no</th>
                <th>Date</th>
                <th className={k.num}>Sub total</th>
                <th className={k.num}>Discount</th>
                <th className={k.num}>Tax</th>
                <th className={k.num}>Total</th>
                <th>Method</th>
                <th>Status</th>
                <th className={k.num}><span className={k.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows cols={10} /> : paged.length === 0 ? (
                <tr><td colSpan={10} className={k.empty}>No invoices yet.</td></tr>
              ) : paged.map((inv, i) => {
                const psKey = (inv.payment_status || 'pending').toLowerCase();
                const sc = PAYMENT_STATUS_CFG[psKey] ?? { label: inv.payment_status || '—' };
                return (
                  <tr key={inv._id ?? i}>
                    <td className={k.idx}>{(page - 1) * LIMIT + i + 1}</td>
                    <td><span className={`${k.mono} ${k.strong}`}>{inv.invoice_no || '—'}</span></td>
                    <td>{fmtDate(inv.payment_date || inv.createdAt)}</td>
                    <td className={k.num}>{fmtAmount(inv.sub_total)}</td>
                    <td className={`${k.num} ${k.muted}`}>{fmtAmount(inv.discount)}</td>
                    <td className={`${k.num} ${k.muted}`}>{fmtAmount(inv.tax)}</td>
                    <td className={`${k.num} ${k.strong}`}>{fmtAmount(inv.total_amount)}</td>
                    <td>{paymentMethodLabel(inv.payment_method)}</td>
                    <td><Pill tone={STATUS_TONE[psKey] || 'neutral'}>{sc.label}</Pill></td>
                    <td>
                      <div className={k.actions}>
                        <button data-action="view" className={k.iconBtn} title="View invoice" aria-label={`View invoice ${inv.invoice_no || ''}`}
                          onClick={() => router.push(`/storeowner/invoices/${inv._id}`)}>
                          {KitIcon.eye}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && <Pager page={page} pageSize={LIMIT} total={invoices.length} onPage={setPage} />}
      </Card>
    </div>
  );
}
