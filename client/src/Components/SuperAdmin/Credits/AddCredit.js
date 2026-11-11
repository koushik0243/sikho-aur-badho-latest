'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./AddCredit.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const EMPTY = { title: '', limit_to: '', price: '', desc: '', status: 'active' };

export default function AddCredit() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [allCredits, setAllCredits] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiServiceHandler('GET', 'credit/list')
      .then(res => setAllCredits(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  function setField(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  function handlePriceChange(e) {
    const val = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      setField('price', val);
      setErrors(prev => ({ ...prev, price: undefined }));
    }
  }

  function handlePriceBlur() {
    const val = form.price;
    if (val === '' || isNaN(parseFloat(val))) {
      setErrors(prev => ({ ...prev, price: 'Valid price is required.' }));
    } else if (parseFloat(val) === 0) {
      setErrors(prev => ({ ...prev, price: 'Price must be greater than 0.' }));
    } else {
      setErrors(prev => ({ ...prev, price: undefined }));
    }
  }

  function handleIntChange(key, e) {
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      setField(key, val);
      if (key === 'limit_to') setErrors(prev => ({ ...prev, limit_to: undefined }));
    }
  }

  function checkDuplicate(limitVal) {
    if (limitVal === '' || Number(limitVal) === 0) return null;
    return allCredits.find(c => Number(c.limit_to) === Number(limitVal)) || null;
  }

  function handleLimitBlur() {
    const val = form.limit_to;
    if (val === '') { setErrors(prev => ({ ...prev, limit_to: 'Limits is required.' })); return; }
    if (Number(val) === 0) { setErrors(prev => ({ ...prev, limit_to: 'Value must be greater than 0.' })); return; }
    const duplicate = checkDuplicate(val);
    if (duplicate) {
      setErrors(prev => ({ ...prev, limit_to: `A credit with limit ${val} already exists ("${duplicate.title}").` }));
    } else {
      setErrors(prev => ({ ...prev, limit_to: undefined }));
    }
  }

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required.';
    if (form.limit_to === '') {
      e.limit_to = 'Limits is required.';
    } else if (Number(form.limit_to) === 0) {
      e.limit_to = 'Value must be greater than 0.';
    }
    if (form.price === '' || isNaN(parseFloat(form.price))) {
      e.price = 'Valid price is required.';
    } else if (parseFloat(form.price) === 0) {
      e.price = 'Price must be greater than 0.';
    }
    if (!e.limit_to && !e.price) {
      const duplicate = checkDuplicate(form.limit_to);
      if (duplicate) e.limit_to = `A credit with limit ${form.limit_to} already exists ("${duplicate.title}").`;
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await apiServiceHandler('POST', 'credit/create', {
        title:      form.title.trim(),
        limit_from: 0,
        limit_to:   Number(form.limit_to),
        price:      parseFloat(form.price).toFixed(2),
        desc:       form.desc.trim() || null,
        status:     form.status,
      });
      toast.success('Credit created successfully.');
      router.push('/superadmin/credits');
    } catch (err) {
      toast.warning(err?.message || 'Failed to create credit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="manage-credit">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/credits')}>
        <BackArrow /> Back to Credits
      </button>
      <h1 className={s.pageTitle}>Add Credit</h1>
      <p className={s.pageSubtitle}>Create a new credit</p>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.formCard}>
          <div className={s.formGrid}>

            {/* Title — full width */}
            <div className={`${s.formGroup} ${s.formGroupFull}`}>
              <label>Title <span className={s.required}>*</span></label>
              <input
                className={s.input}
                type="text"
                placeholder="e.g. Basic"
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                autoComplete="off"
              />
              {errors.title && <p className={s.errorMsg}>{errors.title}</p>}
            </div>

            {/* Limits */}
            <div className={s.formGroup}>
              <label>Limits <span className={s.required}>*</span></label>
              <div className={s.limitRow}>
                <span className={s.limitPrefix}>0 —</span>
                <input
                  className={s.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 30"
                  value={form.limit_to}
                  onChange={e => handleIntChange('limit_to', e)}
                  onBlur={handleLimitBlur}
                  autoComplete="off"
                />
              </div>
              {errors.limit_to && <p className={s.errorMsg}>{errors.limit_to}</p>}
            </div>

            {/* Price */}
            <div className={s.formGroup}>
              <label>Price <span className={s.required}>*</span></label>
              <input
                className={s.input}
                type="text"
                inputMode="decimal"
                placeholder="99.56"
                value={form.price}
                onChange={handlePriceChange}
                onBlur={handlePriceBlur}
                autoComplete="off"
              />
              {errors.price && <p className={s.errorMsg}>{errors.price}</p>}
            </div>

            {/* Status */}
            <div className={s.formGroup}>
              <label>Status</label>
              <select className={s.select} value={form.status} onChange={e => setField('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {errors.submit && (
              <p className={`${s.errorMsg} ${s.formGroupFull}`}>{errors.submit}</p>
            )}

            <div className={s.formActions}>
              <button className={s.btnSave} type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Credit'}
              </button>
              <button
                type="button"
                className={s.btnCancel}
                onClick={() => router.push('/superadmin/credits')}
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      </form>
    </SuperAdminShell>
  );
}
