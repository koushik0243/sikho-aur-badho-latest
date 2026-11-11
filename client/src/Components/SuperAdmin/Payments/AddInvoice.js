'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./AddInvoice.module.css";
import AppDatePicker from '../AppDatePicker';
import { usePaymentMethods } from '../../../lib/paymentMethods';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

function Field({ label, name, type = 'text', placeholder, required, options, form, setField, errors, maxDate }) {
  return (
    <div className={s.formGroup}>
      <label>{label}{required && <span className={s.required}> *</span>}</label>
      {options ? (
        <select className={s.select} value={form[name]} onChange={e => setField(name, e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'date' ? (
        <AppDatePicker
          className={s.input}
          value={form[name]}
          onChange={val => setField(name, val)}
          placeholder={placeholder || 'Select date'}
          maxDate={maxDate}
        />
      ) : (
        <input
          className={s.input}
          type={type}
          placeholder={placeholder}
          value={form[name]}
          onChange={e => setField(name, e.target.value)}
          autoComplete="off"
        />
      )}
      {errors[name] && <p className={s.errorMsg}>{errors[name]}</p>}
    </div>
  );
}

const EMPTY = {
  org_id: '', order_id: '',
  currency: 'INR', sub_total: '', discount: '0', tax: '0', total_amount: '',
  payment_status: 'pending', payment_method: '', transaction_id: '',
  payment_date: '',
  bill_name: '', bill_email: '', bill_phone: '', bill_addr: '',
  bill_city: '', bill_state: '', bill_country: '', bill_pincode: '', bill_gst_no: '',
  ship_name: '', ship_email: '', ship_phone: '', ship_addr: '',
  ship_city: '', ship_state: '', ship_country: '', ship_pincode: '', ship_gst_no: '',
  status: 'active',
};

export default function AddInvoice() {
  const router = useRouter();
  const [form, setForm]             = useState(EMPTY);
  // Options from SuperAdmin → Payments → Manage Payment Method.
  const { options: paymentMethodOptions, loading: paymentMethodsLoading } = usePaymentMethods(form.payment_method);
  const [orgs, setOrgs]             = useState([]);
  const [allOrders, setAllOrders]   = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiServiceHandler('GET', 'organization/list-pagination?limit=1000').catch(() => null),
      apiServiceHandler('GET', 'order/list').catch(() => null),
    ]).then(([orgRes, orderRes]) => {
      setOrgs(Array.isArray(orgRes?.data) ? orgRes.data : []);
      setAllOrders(Array.isArray(orderRes?.data) ? orderRes.data : []);
    });
  }, []);

  function setField(key, val) {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      // Auto-calc total
      if (['sub_total', 'discount', 'tax'].includes(key)) {
        const sub = parseFloat(key === 'sub_total' ? val : prev.sub_total) || 0;
        const disc = parseFloat(key === 'discount' ? val : prev.discount) || 0;
        const tax = parseFloat(key === 'tax' ? val : prev.tax) || 0;
        next.total_amount = (sub - disc + tax).toFixed(2);
      }
      return next;
    });
  }

  function handleOrgChange(orgId) {
    setField('org_id', orgId);
    setForm(prev => ({ ...prev, org_id: orgId, order_id: '' }));
    setFilteredOrders(allOrders.filter(o => String(o.organizer_id?._id ?? o.organizer_id) === orgId));

    // Pre-fill billing from org
    const org = orgs.find(o => String(o._id) === orgId);
    if (org) {
      setForm(prev => ({
        ...prev,
        org_id:     orgId,
        order_id:   '',
        bill_name:  org.org_name  || '',
        bill_email: org.org_email || '',
        bill_phone: org.org_phone || '',
      }));
    }
  }

  function validate() {
    const e = {};
    if (!form.org_id)   e.org_id   = 'Organization is required.';
    if (!form.order_id) e.order_id = 'Order is required.';
    if (!form.sub_total || isNaN(form.sub_total)) e.sub_total = 'Sub total is required.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await apiServiceHandler('POST', 'invoice/create', {
        ...form,
        sub_total:    Number(form.sub_total),
        discount:     Number(form.discount || 0),
        tax:          Number(form.tax || 0),
        total_amount: Number(form.total_amount),
        payment_date: form.payment_date || null,
      });
      toast.success('Invoice created successfully.');
      router.push('/superadmin/payments/invoices');
    } catch (err) {
      toast.warning(err?.message || 'Failed to create invoice.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="invoices">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/payments/invoices')}>
        <BackArrow /> Back to Invoices
      </button>
      <h1 className={s.pageTitle}>Add Invoice</h1>
      <p className={s.pageSubtitle}>Create a new invoice</p>

      <form onSubmit={handleSubmit} autoComplete="off">

        {/* ── Order Info ── */}
        <div className={s.sectionLabel}>Order Details</div>
        <div className={s.formCard}>
          <div className={s.formGrid}>
            <div className={s.formGroup}>
              <label>Organization <span className={s.required}>*</span></label>
              <select className={s.select} value={form.org_id} onChange={e => handleOrgChange(e.target.value)}>
                <option value="">— Select organization —</option>
                {orgs.map(o => <option key={o._id} value={String(o._id)}>{o.org_name}</option>)}
              </select>
              {errors.org_id && <p className={s.errorMsg}>{errors.org_id}</p>}
            </div>
            <div className={s.formGroup}>
              <label>Order <span className={s.required}>*</span></label>
              <select className={s.select} value={form.order_id} onChange={e => setField('order_id', e.target.value)} disabled={!form.org_id}>
                <option value="">— Select order —</option>
                {filteredOrders.map(o => (
                  <option key={o._id} value={String(o._id)}>
                    {o.credit_id?.title || o._id} — ₹{Number(o.credit_amount).toFixed(2)}
                  </option>
                ))}
              </select>
              {errors.order_id && <p className={s.errorMsg}>{errors.order_id}</p>}
            </div>
            <Field form={form} setField={setField} errors={errors}label="Currency" name="currency" placeholder="INR" />
            <Field form={form} setField={setField} errors={errors}label="Payment Status" name="payment_status" options={[
              { value: 'pending', label: 'Pending' },
              { value: 'paid',    label: 'Paid' },
              { value: 'failed',  label: 'Failed' },
              { value: 'refunded',label: 'Refunded' },
            ]} />
            <Field form={form} setField={setField} errors={errors} label="Payment Method" name="payment_method" options={[{ value: '', label: paymentMethodsLoading ? 'Loading payment methods…' : 'Select payment method' }, ...paymentMethodOptions]} />
            <Field form={form} setField={setField} errors={errors}label="Transaction ID" name="transaction_id" placeholder="TXN-XXXXXXXXXX" />
            <Field form={form} setField={setField} errors={errors} label="Payment Date" name="payment_date" type="date" maxDate={new Date()} />
            <Field form={form} setField={setField} errors={errors}label="Status" name="status" options={[
              { value: 'active',   label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]} />
          </div>
        </div>

        {/* ── Amounts ── */}
        <div className={s.sectionLabel}>Amounts</div>
        <div className={s.formCard}>
          <div className={s.formGrid}>
            <Field form={form} setField={setField} errors={errors}label="Sub Total" name="sub_total" type="number" placeholder="0.00" required />
            <Field form={form} setField={setField} errors={errors}label="Discount" name="discount" type="number" placeholder="0.00" />
            <Field form={form} setField={setField} errors={errors}label="Tax" name="tax" type="number" placeholder="0.00" />
            <div className={s.formGroup}>
              <label>Total Amount</label>
              <input className={s.input} type="number" value={form.total_amount} readOnly style={{ background: '#f9fafb' }} autoComplete="off" />
            </div>
          </div>
        </div>

        {/* ── Billing ── */}
        <div className={s.sectionLabel}>Billing Details</div>
        <div className={s.formCard}>
          <div className={s.formGrid}>
            <Field form={form} setField={setField} errors={errors}label="Name"     name="bill_name"    placeholder="Billing name" />
            <Field form={form} setField={setField} errors={errors}label="Email"    name="bill_email"   type="email" placeholder="billing@example.com" />
            <Field form={form} setField={setField} errors={errors}label="Phone"    name="bill_phone"   placeholder="+91 XXXXXXXXXX" />
            <Field form={form} setField={setField} errors={errors}label="GST No"   name="bill_gst_no"  placeholder="GST number" />
            <div className={`${s.formGroup} ${s.formGroupFull}`}>
              <label>Address</label>
              <input className={s.input} type="text" placeholder="Street address" value={form.bill_addr} onChange={e => setField('bill_addr', e.target.value)} autoComplete="off" />
            </div>
            <Field form={form} setField={setField} errors={errors}label="City"     name="bill_city"    placeholder="City" />
            <Field form={form} setField={setField} errors={errors}label="State"    name="bill_state"   placeholder="State" />
            <Field form={form} setField={setField} errors={errors}label="Country"  name="bill_country" placeholder="Country" />
            <Field form={form} setField={setField} errors={errors}label="Pincode"  name="bill_pincode" placeholder="Pincode" />
          </div>
        </div>

        {/* ── Shipping ── */}
        <div className={s.sectionLabel}>Shipping Details</div>
        <div className={s.formCard}>
          <div className={s.formGrid}>
            <Field form={form} setField={setField} errors={errors}label="Name"     name="ship_name"    placeholder="Shipping name" />
            <Field form={form} setField={setField} errors={errors}label="Email"    name="ship_email"   type="email" placeholder="shipping@example.com" />
            <Field form={form} setField={setField} errors={errors}label="Phone"    name="ship_phone"   placeholder="+91 XXXXXXXXXX" />
            <Field form={form} setField={setField} errors={errors}label="GST No"   name="ship_gst_no"  placeholder="GST number" />
            <div className={`${s.formGroup} ${s.formGroupFull}`}>
              <label>Address</label>
              <input className={s.input} type="text" placeholder="Street address" value={form.ship_addr} onChange={e => setField('ship_addr', e.target.value)} autoComplete="off" />
            </div>
            <Field form={form} setField={setField} errors={errors}label="City"     name="ship_city"    placeholder="City" />
            <Field form={form} setField={setField} errors={errors}label="State"    name="ship_state"   placeholder="State" />
            <Field form={form} setField={setField} errors={errors}label="Country"  name="ship_country" placeholder="Country" />
            <Field form={form} setField={setField} errors={errors}label="Pincode"  name="ship_pincode" placeholder="Pincode" />
          </div>
        </div>

        <div className={s.formActions}>
          <button className={s.btnSave} type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Invoice'}
          </button>
          <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/payments/invoices')}>
            Cancel
          </button>
        </div>

      </form>
    </SuperAdminShell>
  );
}
