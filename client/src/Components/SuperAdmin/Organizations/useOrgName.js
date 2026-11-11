'use client';

import { useEffect, useState } from 'react';
import apiServiceHandler from '../../../service/apiService';

/** The organization's display name (for page titles); '' until loaded or if it can't be found. */
export default function useOrgName(orgId) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (!orgId) return undefined;
    let cancelled = false;
    apiServiceHandler('GET', `organization/edit/${orgId}`)
      .then(res => { const org = res?.data ?? res; if (!cancelled) setName(org?.org_name || ''); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [orgId]);
  return name;
}
