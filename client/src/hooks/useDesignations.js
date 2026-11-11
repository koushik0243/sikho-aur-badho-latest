'use client';
import { useState, useEffect } from 'react';
import apiServiceHandler from '../service/apiService';

/**
 * Active designations from the `designations` table (SuperAdmin → Manage
 * Designation), as names for a Designation dropdown. A learner's designation is
 * stored on the user as its name.
 *
 * @param {string} [currentValue] a value already saved on the record being
 *   edited — kept as an option even if that designation was since renamed,
 *   deactivated or deleted, so editing never silently clears it.
 * @returns {{ designations: string[], loading: boolean, error: boolean }}
 */
export default function useDesignations(currentValue = '') {
  const [names, setNames]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiServiceHandler('GET', 'designation/list?status=active')
      .then(res => {
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setNames(list.map(d => d.name).filter(Boolean));
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const designations = currentValue && !names.includes(currentValue)
    ? [currentValue, ...names]
    : names;

  return { designations, loading, error };
}
