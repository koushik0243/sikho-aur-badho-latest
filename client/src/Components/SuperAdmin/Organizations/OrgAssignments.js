'use client';

import { useParams } from 'next/navigation';
import SuperAdminShell from '../SuperAdminShell';
import AssignmentReview from '../../AssignmentSubmissions/AssignmentReview';
import useOrgName from './useOrgName';

/** Super admin · an organization's assignment videos (review page). */
export default function OrgAssignments() {
  const { id } = useParams();
  const orgName = useOrgName(id);
  return (
    <SuperAdminShell activeSection="organizations">
      <AssignmentReview orgId={String(id || '')} orgName={orgName} backHref="/superadmin/organizations" />
    </SuperAdminShell>
  );
}
