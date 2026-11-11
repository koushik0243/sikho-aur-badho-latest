import { Suspense } from 'react';
import OrgUserAssignmentAdd from '../../../../Components/SuperAdmin/OrgUserAssignment/OrgUserAssignmentAdd';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <OrgUserAssignmentAdd />
    </Suspense>
  );
}
