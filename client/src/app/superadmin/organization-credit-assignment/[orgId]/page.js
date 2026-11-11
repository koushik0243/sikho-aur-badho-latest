import { Suspense } from 'react';
import EditOrgCreditAssignment from '../../../../Components/SuperAdmin/OrgCreditAssignment/EditOrgCreditAssignment';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <EditOrgCreditAssignment />
    </Suspense>
  );
}
