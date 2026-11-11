'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import { generateInvoicePDF } from '../../../lib/generateInvoicePDF';
import { usePaymentMethods } from '../../../lib/paymentMethods';
import pageStyles from "./ViewInvoice.module.css";
import { withDetailKit } from '../PageKit/PageKit';

// Page styles + the shared store owner detail-page look.
const vp = withDetailKit(pageStyles);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const PdfIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
  </svg>
);

const PAYMENT_STATUS_BADGE = {
  paid:     'badgePaid',
  pending:  'badgePending',
  failed:   'badgeFailed',
  refunded: 'badgeRefunded',
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

export default function ViewInvoice() {
  const { labelOf: paymentMethodLabel } = usePaymentMethods();
  const router = useRouter();
  const { id } = useParams();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `invoice/edit/${id}`)
      .then(res => setInv(res?.data ?? res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownloadPDF() {
    if (!inv) return;
    setGenerating(true);
    try { await generateInvoicePDF(inv, { paymentMethodLabel }); }
    finally { setGenerating(false); }
  }

  if (loading) return <p className={vp.loadingText}>Loading…</p>;
  if (!inv?._id) return (
    <>
      <button className={vp.backBtn} onClick={() => router.push('/storeowner/invoices')}>
        {BackArrow} Back to Invoices
      </button>
      <nav className={vp.breadcrumb}>
        <button className={vp.breadcrumbLink} onClick={() => router.push('/storeowner/invoices')}>Invoices</button>
        <span className={vp.breadcrumbSep}>›</span>
        <span className={vp.breadcrumbCurr}>Not Found</span>
      </nav>
      <p className={vp.loadingText}>Invoice not found.</p>
    </>
  );

  const psKey = (inv.payment_status || 'pending').toLowerCase();
  const badgeCls = vp[PAYMENT_STATUS_BADGE[psKey]] ?? vp.badgePending;
  const statusText = inv.payment_status
    ? inv.payment_status.charAt(0).toUpperCase() + inv.payment_status.slice(1)
    : '—';

  const credit = inv.order_id?.credit_id ?? {};
  const hasBilling = inv.name || inv.email || inv.addr;

  return (
    <>
      <button className={vp.backBtn} onClick={() => router.push('/storeowner/invoices')}>
        {BackArrow} Back to Invoices
      </button>
      <nav className={vp.breadcrumb}>
        <button className={vp.breadcrumbLink} onClick={() => router.push('/storeowner/invoices')}>Invoices</button>
        <span className={vp.breadcrumbSep}>›</span>
        <span className={vp.breadcrumbCurr}>{inv.invoice_no || 'Invoice'}</span>
      </nav>

      <div className={vp.detailCardWide}>
        <div className={vp.detailHead}>
          <div className={vp.detailHeadLeft}>
            <div className={vp.detailAvatarAmber}>INV</div>
            <div>
              <h1 className={vp.detailTitle}>{inv.invoice_no || 'Invoice'}</h1>
              <div className={vp.detailBadges}>
                <span className={badgeCls}>{statusText}</span>
              </div>
            </div>
          </div>
          <button className={vp.btnPDF} onClick={handleDownloadPDF} disabled={generating}>
            <PdfIcon />
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
        </div>

        <div className={vp.detailSectionsGrid}>
          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Invoice Details</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Payment Date</span>
                <span className={vp.sectionValue}>{fmtDate(inv.payment_date || inv.createdAt)}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Payment Method</span>
                <span className={vp.sectionValue}>{paymentMethodLabel(inv.payment_method)}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Transaction ID</span>
                <span className={vp.sectionValueMono}>{inv.transaction_id || '—'}</span>
              </div>
            </div>
          </div>

          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Amount Breakdown</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Sub Total</span>
                <span className={vp.sectionValue}>{fmtAmount(inv.sub_total)}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Discount</span>
                <span className={vp.sectionValue}>{fmtAmount(inv.discount)}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Tax</span>
                <span className={vp.sectionValue}>{fmtAmount(inv.tax)}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Total</span>
                <span className={vp.sectionValueEmph}>{fmtAmount(inv.total_amount)}</span>
              </div>
            </div>
          </div>

          {credit.title && (
            <div className={vp.sectionBlock}>
              <div className={vp.sectionTitle}>Credit Plan</div>
              <div className={vp.sectionRows}>
                <div className={vp.sectionRow}>
                  <span className={vp.sectionLabel}>Plan</span>
                  <span className={vp.sectionValue}>{credit.title}</span>
                </div>
              </div>
            </div>
          )}

          {hasBilling && (
            <div className={vp.sectionBlock}>
              <div className={vp.sectionTitle}>Billing Info</div>
              <div className={vp.sectionRows}>
                {inv.name  && <div className={vp.sectionRow}><span className={vp.sectionLabel}>Name</span><span className={vp.sectionValue}>{inv.name}</span></div>}
                {inv.email && <div className={vp.sectionRow}><span className={vp.sectionLabel}>Email</span><span className={vp.sectionValue}>{inv.email}</span></div>}
                {inv.phone && <div className={vp.sectionRow}><span className={vp.sectionLabel}>Phone</span><span className={vp.sectionValue}>{inv.phone}</span></div>}
                {inv.gst_no && <div className={vp.sectionRow}><span className={vp.sectionLabel}>GST No</span><span className={vp.sectionValueMono}>{inv.gst_no}</span></div>}
                {inv.addr  && (
                  <div className={vp.sectionRow}>
                    <span className={vp.sectionLabel}>Address</span>
                    <span className={vp.sectionValue}>{[inv.addr, inv.city, inv.state, inv.country, inv.pincode].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
