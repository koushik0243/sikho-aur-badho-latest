'use client';
import { useState, useEffect } from 'react';
import apiServiceHandler from '../service/apiService';

/**
 * Active departments from the `departments` table (SuperAdmin → Manage
 * Department), as names for a Department dropdown. A learner's department is
 * stored on the user as its name.
 *
 * @param {string} [currentValue] a value already saved on the record being
 *   edited — kept as an option even if that department was since renamed,
 *   deactivated or deleted, so editing never silently clears it.
 * @returns {{ departments: string[], loading: boolean, error: boolean }}
 */
export default function useDepartments(currentValue = '') {
  const [names, setNames]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiServiceHandler('GET', 'department/list?status=active')
      .then(res => {
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setNames(list.map(d => d.name).filter(Boolean));
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const departments = currentValue && !names.includes(currentValue)
    ? [currentValue, ...names]
    : names;

  return { departments, loading, error };
}
