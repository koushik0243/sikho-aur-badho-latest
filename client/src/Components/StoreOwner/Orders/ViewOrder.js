'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import pageStyles from "./ViewOrder.module.css";
import { withDetailKit } from '../PageKit/PageKit';

// Page styles + the shared store owner detail-page look.
const vp = withDetailKit(pageStyles);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const STATUS_BADGE = {
  success:  'badgePaid',
  pending:  'badgePending',
  failed:   'badgeFailed',
  canceled: 'badgeNeutral',
  refunded: 'badgeRefunded',
};

const STATUS_LABEL = {
  success: 'Success', pending: 'Pending', failed: 'Failed',
  canceled: 'Canceled', refunded: 'Refunded',
};

function fmtDate(val) {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function fmtAmount(val) {
  const n = val != null ? parseFloat(val) : null;
  if (n == null || isNaN(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ViewOrder() {
  const router = useRouter();
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `order/edit/${id}`)
      .then(res => setOrder(res?.data ?? res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className={vp.loadingText}>Loading…</p>;
  if (!order?._id) return (
    <>
      <button className={vp.backBtn} onClick={() => router.push('/storeowner/orders')}>
        {BackArrow} Back to Orders
      </button>
      <nav className={vp.breadcrumb}>
        <button className={vp.breadcrumbLink} onClick={() => router.push('/storeowner/orders')}>Orders</button>
        <span className={vp.breadcrumbSep}>›</span>
        <span className={vp.breadcrumbCurr}>Not Found</span>
      </nav>
      <p className={vp.loadingText}>Order not found.</p>
    </>
  );

  const statusKey = (order.status || 'pending').toLowerCase();
  const badgeCls = vp[STATUS_BADGE[statusKey]] ?? vp.badgePending;
  const statusText = STATUS_LABEL[statusKey] || order.status || '—';

  const credit = order.credit_id ?? {};
  const creditRange = credit.limit_from != null && credit.limit_to != null
    ? `${credit.limit_from}–${credit.limit_to}`
    : credit.limit_to != null ? String(credit.limit_to)
    : credit.limit_from != null ? `${credit.limit_from}+` : '—';

  const shortId = String(order._id).slice(-8).toUpperCase();

  return (
    <>
      <button className={vp.backBtn} onClick={() => router.push('/storeowner/orders')}>
        {BackArrow} Back to Orders
      </button>
      <nav className={vp.breadcrumb}>
        <button className={vp.breadcrumbLink} onClick={() => router.push('/storeowner/orders')}>Orders</button>
        <span className={vp.breadcrumbSep}>›</span>
        <span className={vp.breadcrumbCurr}>#{shortId}</span>
      </nav>

      <div className={vp.detailCardWide}>
        <div className={vp.detailHead}>
          <div className={vp.detailHeadLeft}>
            <div className={vp.detailAvatarAmber}>#</div>
            <div>
              <h1 className={vp.detailTitle}>Order #{shortId}</h1>
              <div className={vp.detailBadges}>
                <span className={badgeCls}>{statusText}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={vp.detailSections}>
          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Order Information</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Purchase Date</span>
                <span className={vp.sectionValue}>{fmtDate(order.purchase_date || order.createdAt)}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Payment Gateway</span>
                <span className={vp.sectionValue}>{order.payment_gateway || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Status</span>
                <span className={badgeCls}>{statusText}</span>
              </div>
            </div>
          </div>

          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Credit Plan</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Plan Name</span>
                <span className={vp.sectionValue}>{credit.title || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Credits</span>
                <span className={vp.sectionValue}>{creditRange}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Amount Paid</span>
                <span className={vp.sectionValueEmph}>{fmtAmount(order.credit_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
