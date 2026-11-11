'use client';
import { useState, useEffect } from 'react';
import apiServiceHandler from '../service/apiService';

// Payment methods come from SuperAdmin → Payments → Manage Payment Method.
// An invoice stores the method's slug (e.g. 'upi'); its name is what's shown.

/** Readable fallback for a stored value that isn't in the table ('bank_transfer' → 'Bank Transfer'). */
function formatRaw(value) {
  return String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * @param {string} [currentValue] the value already on the record being edited —
 *   kept as a dropdown option even if that method was since deactivated.
 * @returns {{ options: {value: string, label: string}[], labelOf: (v: string) => string, loading: boolean }}
 *   `options` = active methods for a dropdown; `labelOf` names any stored value.
 */
export function usePaymentMethods(currentValue = '') {
  const [methods, setMethods] = useState([]); // every method that isn't deleted
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiServiceHandler('GET', 'payment-method/list')
      .then(res => { if (!cancelled) setMethods(Array.isArray(res?.data) ? res.data : []); })
      .catch(() => { /* labels fall back to the stored value */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const labelOf = value => {
    if (!value) return '—';
    const hit = methods.find(m => m.slug === String(value).toLowerCase());
    return hit ? hit.name : formatRaw(value);
  };

  const options = methods
    .filter(m => m.status === 'active' || m.slug === currentValue)
    .map(m => ({ value: m.slug, label: m.name }));
  if (currentValue && !options.some(o => o.value === currentValue)) {
    options.unshift({ value: currentValue, label: formatRaw(currentValue) });
  }

  return { options, labelOf, loading };
}
