'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import { generateInvoicePDF } from '../../../lib/generateInvoicePDF';
import vpPage from "./ViewInvoice.module.css";
import { usePaymentMethods } from '../../../lib/paymentMethods';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const vp = withAdminKit(vpPage);

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
  paid:     vp => vp.badgePaid,
  pending:  vp => vp.badgePending,
  failed:   vp => vp.badgeFailed,
  refunded: vp => vp.badgeRefunded,
};

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAmount(val, currency = 'INR') {
  if (val === null || val === undefined) return '—';
  const symbol = currency === 'INR' ? '₹' : (currency + ' ');
  return `${symbol}${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ViewInvoice() {
  const { labelOf: paymentMethodLabel } = usePaymentMethods();
  const router  = useRouter();
  const { id }  = useParams();
  const [invoice, setInvoice]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `invoice/edit/${id}`)
      .then(res => setInvoice(res?.data ?? null))
      .catch(() => setInvoice(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleGeneratePDF() {
    if (!invoice) return;
    setGenerating(true);
    try { await generateInvoicePDF(invoice, { paymentMethodLabel }); }
    finally { setGenerating(false); }
  }

  if (loading) return <SuperAdminShell activeSection="invoices"><p className={vp.loadingText}>Loading…</p></SuperAdminShell>;
  if (!invoice) return (
    <SuperAdminShell activeSection="invoices">
      <button className={vp.backBtn} onClick={() => router.push('/superadmin/payments/invoices')}>
        {BackArrow} Back to Invoices
      </button>
      <nav className={vp.breadcrumb}>
        <button className={vp.breadcrumbLink} onClick={() => router.push('/superadmin/payments/invoices')}>Invoices</button>
        <span className={vp.breadcrumbSep}>›</span>
        <span className={vp.breadcrumbCurr}>Not Found</span>
      </nav>
      <p className={vp.loadingText}>Invoice not found.</p>
    </SuperAdminShell>
  );

  const cur       = invoice.currency || 'INR';
  const psKey     = (invoice.payment_status || '').toLowerCase();
  const badgeCls  = PAYMENT_STATUS_BADGE[psKey] ? PAYMENT_STATUS_BADGE[psKey](vp) : vp.badgeNeutral;
  const statusText = invoice.payment_status
    ? invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)
    : '—';

  return (
    <SuperAdminShell activeSection="invoices">
      <button className={vp.backBtn} onClick={() => router.push('/superadmin/payments/invoices')}>
        {BackArrow} Back to Invoices
      </button>
      <nav className={vp.breadcrumb}>
        <button className={vp.breadcrumbLink} onClick={() => router.push('/superadmin/payments/invoices')}>Invoices</button>
        <span className={vp.breadcrumbSep}>›</span>
        <span className={vp.breadcrumbCurr}>{invoice.invoice_no || 'Invoice'}</span>
      </nav>

      <div className={vp.detailCardWide}>
        <div className={vp.detailHead}>
          <div className={vp.detailHeadLeft}>
            <div className={vp.detailAvatarAmber}>INV</div>
            <div>
              <h1 className={vp.detailTitle}>{invoice.invoice_no || 'Invoice'}</h1>
              <div className={vp.detailBadges}>
                <span className={badgeCls}>{statusText}</span>
              </div>
            </div>
          </div>
          <button
            className={vp.btnPDF}
            onClick={handleGeneratePDF}
            disabled={generating}
          >
            <PdfIcon />
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
        </div>

        <div className={vp.detailSectionsGrid}>
          {/* Organization & Order */}
          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Organization &amp; Order</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Organization</span>
                <span className={vp.sectionValue}>{invoice.org_id?.org_name || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Org Email</span>
                <span className={vp.sectionValue}>{invoice.org_id?.org_email || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Org Phone</span>
                <span className={vp.sectionValue}>{invoice.org_id?.org_phone || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Credit Package</span>
                <span className={vp.sectionValue}>{invoice.order_id?.credit_id?.title || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Currency</span>
                <span className={vp.sectionValue}>{cur}</span>
              </div>
            </div>
          </div>

          {/* Amounts */}
          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Amounts</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Sub Total</span>
                <span className={vp.sectionValue}>{fmtAmount(invoice.sub_total, cur)}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Discount</span>
                <span className={vp.sectionValue}>{fmtAmount(invoice.discount, cur)}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Tax</span>
                <span className={vp.sectionValue}>{fmtAmount(invoice.tax, cur)}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Total Amount</span>
                <span className={vp.sectionValueEmph}>{fmtAmount(invoice.total_amount, cur)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Payment Info</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Payment Method</span>
                <span className={vp.sectionValue}>{paymentMethodLabel(invoice.payment_method)}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Transaction ID</span>
                <span className={vp.sectionValueMono}>{invoice.transaction_id || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Payment Date</span>
                <span className={vp.sectionValue}>{fmtDate(invoice.payment_date)}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Created</span>
                <span className={vp.sectionValue}>{fmtDate(invoice.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Billing Details */}
          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Billing Details</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Name</span>
                <span className={vp.sectionValue}>{invoice.bill_name || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Email</span>
                <span className={vp.sectionValue}>{invoice.bill_email || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Phone</span>
                <span className={vp.sectionValue}>{invoice.bill_phone || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>GST No</span>
                <span className={vp.sectionValue}>{invoice.bill_gst_no || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Address</span>
                <span className={vp.sectionValue}>{invoice.bill_addr || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>City / State</span>
                <span className={vp.sectionValue}>{[invoice.bill_city, invoice.bill_state].filter(Boolean).join(', ') || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Country</span>
                <span className={vp.sectionValue}>{invoice.bill_country || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Pincode</span>
                <span className={vp.sectionValue}>{invoice.bill_pincode || '—'}</span>
              </div>
            </div>
          </div>

          {/* Shipping Details */}
          <div className={vp.sectionBlock}>
            <div className={vp.sectionTitle}>Shipping Details</div>
            <div className={vp.sectionRows}>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Name</span>
                <span className={vp.sectionValue}>{invoice.ship_name || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Email</span>
                <span className={vp.sectionValue}>{invoice.ship_email || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Phone</span>
                <span className={vp.sectionValue}>{invoice.ship_phone || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>GST No</span>
                <span className={vp.sectionValue}>{invoice.ship_gst_no || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Address</span>
                <span className={vp.sectionValue}>{invoice.ship_addr || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>City / State</span>
                <span className={vp.sectionValue}>{[invoice.ship_city, invoice.ship_state].filter(Boolean).join(', ') || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Country</span>
                <span className={vp.sectionValue}>{invoice.ship_country || '—'}</span>
              </div>
              <div className={vp.sectionRow}>
                <span className={vp.sectionLabel}>Pincode</span>
                <span className={vp.sectionValue}>{invoice.ship_pincode || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminShell>
  );
}
