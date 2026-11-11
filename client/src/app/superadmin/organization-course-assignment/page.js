import { Suspense } from 'react';
import OrgCourseAssignmentList from '../../../Components/SuperAdmin/OrgCourseAssignment/OrgCourseAssignmentList';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <OrgCourseAssignmentList />
    </Suspense>
  );
}
