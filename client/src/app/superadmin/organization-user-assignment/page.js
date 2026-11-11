import { Suspense } from 'react';
import OrgUserAssignmentList from '../../../Components/SuperAdmin/OrgUserAssignment/OrgUserAssignmentList';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <OrgUserAssignmentList />
    </Suspense>
  );
}
