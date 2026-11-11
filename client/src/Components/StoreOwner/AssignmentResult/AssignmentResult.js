'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import AssignmentReview from '../../AssignmentSubmissions/AssignmentReview';

/** Store owner · their organization's assignment videos and reviewers' comments (view-only). */
export default function AssignmentResult() {
  const user = useSelector(selectUser);
  const [orgId, setOrgId] = useState('');

  // The login record usually carries orgId; otherwise read it from the user's profile.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    const known = user.orgId?._id || user.orgId;
    const uid = user._id || user.id;
    (known ? Promise.resolve(String(known)) : apiServiceHandler('GET', `user/admin/edit/${uid}`)
      .then(r => { const rec = r?.data ?? r; return rec?.orgId ? String(rec.orgId?._id || rec.orgId) : ''; })
      .catch(() => ''))
      .then(id => { if (!cancelled) setOrgId(id); });
    return () => { cancelled = true; };
  }, [user]);

  if (!orgId) return null;
  // View-only for store owners: the comment box and the Final review section are hidden.
  return <AssignmentReview orgId={orgId} canReview={false} />;
}
