'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./AddOrder.module.css";
import AppDatePicker from '../AppDatePicker';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const EMPTY = {
  organizer_id: '', credit_id: '', credit_amount: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  payment_gateway: 'manual', status: 'active',
};

export default function AddOrder() {
  const router = useRouter();
  const [form, setForm]           = useState(EMPTY);
  const [orgs, setOrgs]           = useState([]);
  const [credits, setCredits]     = useState([]);
  const [errors, setErrors]       = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiServiceHandler('GET', 'organization/list-pagination?limit=1000').catch(() => null),
      apiServiceHandler('GET', 'credit/list').catch(() => null),
    ]).then(([orgRes, creditRes]) => {
      setOrgs(Array.isArray(orgRes?.data) ? orgRes.data : []);
      setCredits(Array.isArray(creditRes?.data) ? creditRes.data : []);
    });
  }, []);

  function setField(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  function handleCreditChange(creditId) {
    setField('credit_id', creditId);
    const credit = credits.find(c => String(c._id) === creditId);
    const priceVal = credit?.price?.$numberDecimal ?? credit?.price;
    const parsed = parseFloat(priceVal);
    setField('credit_amount', isNaN(parsed) ? '' : parsed);
  }

  function validate() {
    const e = {};
    if (!form.organizer_id) e.organizer_id = 'Organization is required.';
    if (!form.credit_id)    e.credit_id    = 'Credit package is required.';
    if (!form.credit_amount || isNaN(form.credit_amount)) e.credit_amount = 'Valid amount is required.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await apiServiceHandler('POST', 'order/create', {
        organizer_id:    form.organizer_id,
        credit_id:       form.credit_id,
        credit_amount:   Number(form.credit_amount),
        purchase_date:   form.purchase_date,
        payment_gateway: form.payment_gateway,
        status:          form.status,
      });
      toast.success('Order created successfully.');
      router.push('/superadmin/payments/orders');
    } catch (err) {
      toast.warning(err?.message || 'Failed to create order.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="orders">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/payments/orders')}>
        <BackArrow /> Back to Orders
      </button>
      <h1 className={s.pageTitle}>Add Order</h1>
      <p className={s.pageSubtitle}>Create a new credit purchase order</p>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.formCard}>
          <div className={s.formGrid}>

            <div className={s.formGroup}>
              <label>Organization <span className={s.required}>*</span></label>
              <select className={s.select} value={form.organizer_id} onChange={e => setField('organizer_id', e.target.value)}>
                <option value="">— Select organization —</option>
                {orgs.map(o => <option key={o._id} value={String(o._id)}>{o.org_name}</option>)}
              </select>
              {errors.organizer_id && <p className={s.errorMsg}>{errors.organizer_id}</p>}
            </div>

            <div className={s.formGroup}>
              <label>Credit Package <span className={s.required}>*</span></label>
              <select className={s.select} value={form.credit_id} onChange={e => handleCreditChange(e.target.value)}>
                <option value="">— Select credit package —</option>
                {credits.map(c => <option key={c._id} value={String(c._id)}>{c.title}</option>)}
              </select>
              {errors.credit_id && <p className={s.errorMsg}>{errors.credit_id}</p>}
            </div>

            <div className={s.formGroup}>
              <label>Credit Amount <span className={s.required}>*</span></label>
              <input
                className={s.input}
                type="number"
                step="0.01"
                placeholder="Auto-populated from Credit Package"
                value={form.credit_amount === '' || isNaN(form.credit_amount) ? '' : form.credit_amount}
                disabled
                style={{ background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }}
                autoComplete="off"
              />
              {errors.credit_amount && <p className={s.errorMsg}>{errors.credit_amount}</p>}
            </div>

            <div className={s.formGroup}>
              <label>Purchase Date</label>
              <AppDatePicker
                className={s.input}
                value={form.purchase_date}
                onChange={val => setField('purchase_date', val)}
                placeholder="Select purchase date"
                maxDate={new Date()}
              />
            </div>

            <div className={s.formGroup}>
              <label>Payment Gateway</label>
              <input
                className={s.input}
                type="text"
                placeholder="e.g. manual, stripe, bank transfer"
                value={form.payment_gateway}
                onChange={e => setField('payment_gateway', e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className={s.formGroup}>
              <label>Status</label>
              <select className={s.select} value={form.status} onChange={e => setField('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className={`${s.formActions} ${s.formGroupFull}`}>
              <button className={s.btnSave} type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Order'}
              </button>
              <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/payments/orders')}>
                Cancel
              </button>
            </div>

          </div>
        </div>
      </form>
    </SuperAdminShell>
  );
}
