'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import { kit as k, PageHeader, KpiTiles, Card, Pill, Pager, SkeletonRows, KitIcon } from '../PageKit/PageKit';

const LIMIT = 10;

const STATUS_CFG = {
  success:  { label: 'Success',  cls: 'badgeSuccess' },
  pending:  { label: 'Pending',  cls: 'badgePending' },
  failed:   { label: 'Failed',   cls: 'badgeFailed' },
  canceled: { label: 'Canceled', cls: 'badgeCanceled' },
  refunded: { label: 'Refunded', cls: 'badgeRefunded' },
};
const STATUS_TONE = {"success":"good","pending":"warn","failed":"bad","canceled":"neutral","refunded":"info"};

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

export default function OrdersPage() {
  const user   = useSelector(selectUser);
  const router = useRouter();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState({ total: 0, success: 0, pending: 0, failed: 0 });
  const [page, setPage]       = useState(1);

  const loadOrders = useCallback(async () => {
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
      if (!effectiveOrgId) { setOrders([]); setLoading(false); return; }

      const res = await apiServiceHandler('GET', `order/list?organizer_id=${effectiveOrgId}`);
      const data = res?.data ?? res;
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.purchase_date || b.createdAt) - new Date(a.purchase_date || a.createdAt));
      setOrders(list);
      setStats({
        total:   list.length,
        success: list.filter(o => o.status === 'success').length,
        pending: list.filter(o => o.status === 'pending').length,
        failed:  list.filter(o => o.status === 'failed' || o.status === 'canceled').length,
      });
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.orgId]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const totalPages = Math.max(1, Math.ceil(orders.length / LIMIT));
  const from       = orders.length === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to         = Math.min(page * LIMIT, orders.length);
  const paged      = orders.slice((page - 1) * LIMIT, page * LIMIT);

  const successRate = stats.total ? Math.round((stats.success / stats.total) * 100) : 0;

  return (
    <div className={k.page}>
      <PageHeader title="Orders" sub="Every credit purchase your organisation has made, newest first." />

      <KpiTiles items={[
        { label: 'Total orders', value: loading ? '—' : stats.total,   icon: KitIcon.cart,  hint: 'All time' },
        { label: 'Successful',   value: loading ? '—' : stats.success, icon: KitIcon.check, tone: 'good', hint: loading || !stats.total ? '' : `${successRate}% of orders` },
        { label: 'Pending',      value: loading ? '—' : stats.pending, icon: KitIcon.clock, tone: stats.pending ? 'warn' : '', hint: 'Awaiting payment' },
        { label: 'Failed',       value: loading ? '—' : stats.failed,  icon: KitIcon.x,     tone: stats.failed ? 'bad' : '', hint: 'Failed or canceled' },
      ]} />

      <Card title="All orders" meta={!loading && <Pill tone="neutral">{orders.length} order{orders.length !== 1 ? 's' : ''}</Pill>} flush>
        <div className={k.tableWrap}>
          <table className={k.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Plan</th>
                <th>Credits</th>
                <th className={k.num}>Amount</th>
                <th>Gateway</th>
                <th>Status</th>
                <th className={k.num}><span className={k.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows cols={8} /> : paged.length === 0 ? (
                <tr><td colSpan={8} className={k.empty}>No orders yet.</td></tr>
              ) : paged.map((o, i) => {
                const statusKey = (o.status || 'pending').toLowerCase();
                const sc = STATUS_CFG[statusKey] ?? { label: o.status || '—' };
                const credit = o.credit_id ?? {};
                const creditRange = credit.limit_from != null && credit.limit_to != null
                  ? `${credit.limit_from}–${credit.limit_to}`
                  : credit.limit_to != null ? String(credit.limit_to)
                  : credit.limit_from != null ? `${credit.limit_from}+` : '—';
                return (
                  <tr key={o._id ?? i}>
                    <td className={k.idx}>{(page - 1) * LIMIT + i + 1}</td>
                    <td>{fmtDate(o.purchase_date || o.createdAt)}</td>
                    <td className={k.strong}>{credit.title || '—'}</td>
                    <td className={k.muted}>{creditRange}</td>
                    <td className={`${k.num} ${k.strong}`}>{fmtAmount(o.credit_amount)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{o.payment_gateway || '—'}</td>
                    <td><Pill tone={STATUS_TONE[statusKey] || 'neutral'}>{sc.label}</Pill></td>
                    <td>
                      <div className={k.actions}>
                        <button data-action="view" className={k.iconBtn} title="View order" aria-label="View order"
                          onClick={() => router.push(`/storeowner/orders/${o._id}`)}>
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
        {!loading && <Pager page={page} pageSize={LIMIT} total={orders.length} onPage={setPage} />}
      </Card>
    </div>
  );
}
