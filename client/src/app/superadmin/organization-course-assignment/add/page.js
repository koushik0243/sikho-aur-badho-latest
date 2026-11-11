import { Suspense } from 'react';
import AddOrgCourseAssignment from '../../../../Components/SuperAdmin/OrgCourseAssignment/AddOrgCourseAssignment';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <AddOrgCourseAssignment />
    </Suspense>
  );
}
