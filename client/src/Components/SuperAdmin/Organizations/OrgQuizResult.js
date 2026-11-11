'use client';

import { useParams } from 'next/navigation';
import SuperAdminShell from '../SuperAdminShell';
import QuizResult from '../../StoreOwner/QuizResult/QuizResult';
import useOrgName from './useOrgName';

/** Super admin · an organization's quiz results — the same review page store owners use, for this organization. */
export default function OrgQuizResult() {
  const { id } = useParams();
  const orgName = useOrgName(id);
  return (
    <SuperAdminShell activeSection="organizations">
      <QuizResult orgId={String(id || '')} orgName={orgName} />
    </SuperAdminShell>
  );
}
